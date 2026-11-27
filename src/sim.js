// Game simulation. No DOM or canvas here: it runs headless in Node for tests.
//
// Units: time in seconds, distance in tiles (one tile = one step between
// adjacent hex centres). Enemies hold `progress`, a float index into the
// level's path: progress 3.5 is halfway between path[3] and path[4].
(function (root) {
  'use strict';

  const hex = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./hex.js')
    : root.TD.hex;

  // ---------- data helpers ----------

  function byId(list) {
    const m = {};
    for (const item of list) m[item.id] = item;
    return m;
  }

  // Check data files for mistakes that would break play. Returns a list of
  // error strings (empty when the data is valid).
  function validateData(data) {
    const errors = [];
    const towers = byId(data.towers);
    const enemies = byId(data.enemies);
    for (const t of data.towers) {
      for (const f of ['energy_cost', 'place_cost', 'base_damage', 'base_range_tiles', 'fire_rate']) {
        if (typeof t[f] !== 'number' || t[f] < 0) errors.push(`tower ${t.id}: ${f} must be a non-negative number`);
      }
      if (!Number.isInteger(t.base_range_tiles)) errors.push(`tower ${t.id}: base_range_tiles must be a whole number`);
    }
    for (const e of data.enemies) {
      for (const f of ['hp', 'speed', 'armor', 'bounty', 'base_damage']) {
        if (typeof e[f] !== 'number' || e[f] < 0) errors.push(`enemy ${e.id}: ${f} must be a non-negative number`);
      }
    }
    for (const id of data.player.loadout) {
      if (!towers[id]) errors.push(`player loadout: unknown tower "${id}"`);
    }
    for (const level of Object.values(data.levels)) {
      const { cols, rows } = level.grid;
      const seen = new Set();
      level.path.forEach(([c, r], i) => {
        if (!hex.inBounds(c, r, cols, rows)) errors.push(`${level.id}: path tile ${i} (${c},${r}) is off the grid`);
        const k = hex.key(c, r);
        if (seen.has(k)) errors.push(`${level.id}: path tile ${i} (${c},${r}) repeats`);
        seen.add(k);
        if (i > 0) {
          const [pc, pr] = level.path[i - 1];
          const d = hex.distance({ col: pc, row: pr }, { col: c, row: r });
          if (d !== 1) errors.push(`${level.id}: path tiles ${i - 1} and ${i} are not adjacent`);
        }
      });
      if (level.path.length < 2) errors.push(`${level.id}: path needs at least 2 tiles`);
      if (!level.waves.length) errors.push(`${level.id}: needs at least one wave`);
      level.waves.forEach((w, wi) => {
        if (!w.groups.length) errors.push(`${level.id}: wave ${wi + 1} has no enemy groups`);
        for (const g of w.groups) {
          if (!enemies[g.enemy]) errors.push(`${level.id}: wave ${wi + 1} uses unknown enemy "${g.enemy}"`);
          if (!(g.count > 0)) errors.push(`${level.id}: wave ${wi + 1} group count must be > 0`);
          if (!(g.interval > 0)) errors.push(`${level.id}: wave ${wi + 1} group interval must be > 0`);
        }
      });
    }
    return errors;
  }

  // Energy budget for a level: the level's own limit if it sets one,
  // otherwise the player's energy cap (DESIGN.md section 6).
  function energyBudget(data, level) {
    return (level.energy_budget != null) ? level.energy_budget : data.player.energy_cap;
  }

  // Energy caps how many tower TYPES the loadout holds, not placements.
  function loadoutEnergy(data, loadout) {
    const towers = byId(data.towers);
    return loadout.reduce((sum, id) => sum + towers[id].energy_cost, 0);
  }

  function checkLoadout(data, level, loadout) {
    const used = loadoutEnergy(data, loadout);
    const budget = energyBudget(data, level);
    return { ok: used <= budget, used, budget };
  }

  // Can `towerId` be added to `loadout` without breaking the budget?
  function canAddToLoadout(data, level, loadout, towerId) {
    if (loadout.includes(towerId)) return { ok: false, reason: 'already in loadout' };
    const next = checkLoadout(data, level, loadout.concat(towerId));
    return next.ok ? { ok: true } : { ok: false, reason: `needs ${next.used} energy, budget is ${next.budget}` };
  }

  // Spawn schedule for a wave: [{ time, enemy }] sorted by time.
  function waveSchedule(wave) {
    const out = [];
    for (const g of wave.groups) {
      const delay = g.delay || 0;
      for (let i = 0; i < g.count; i++) out.push({ time: delay + i * g.interval, enemy: g.enemy });
    }
    out.sort((a, b) => a.time - b.time);
    return out;
  }

  // What the HUD may reveal about a wave once it is cleared.
  function waveSummary(wave) {
    return {
      groups: wave.groups.map((g) => ({
        enemy: g.enemy, count: g.count, interval: g.interval, delay: g.delay || 0,
      })),
      total: wave.groups.reduce((n, g) => n + g.count, 0),
      hp_scale: wave.hp_scale || 1,
    };
  }

  // ---------- game state ----------

  function createGame(data, levelId, opts) {
    opts = opts || {};
    const level = data.levels[levelId];
    if (!level) throw new Error('unknown level ' + levelId);
    const loadout = (opts.loadout || data.player.loadout).slice();
    const energy = checkLoadout(data, level, loadout);
    if (!energy.ok) throw new Error(`loadout needs ${energy.used} energy, budget is ${energy.budget}`);

    const pathSet = new Set(level.path.map(([c, r]) => hex.key(c, r)));
    return {
      data,
      level,
      towerDefs: byId(data.towers),
      enemyDefs: byId(data.enemies),
      loadout,
      energy, // { used, budget }
      pathSet,
      credits: data.player.starting_credits,
      creditsEarned: 0,
      creditsSpent: 0,
      baseHealth: data.player.base_health,
      maxBaseHealth: data.player.base_health,
      phase: 'build', // build | wave | won | lost
      waveIndex: 0, // the wave in progress, or the next one to start
      wavesCleared: level.waves.map(() => false),
      waveIntel: {}, // wave index -> summary, recorded when cleared (session only)
      schedule: [],
      waveTime: 0,
      time: 0,
      towers: [],
      enemies: [],
      nextId: 1,
      kills: 0,
      leaks: 0,
      result: null, // { won, credits, wave } once the level ends
      events: [], // render hints (shots, kills, leaks); the UI drains these
    };
  }

  function towerAt(state, col, row) {
    return state.towers.find((t) => t.col === col && t.row === row) || null;
  }

  function isPath(state, col, row) {
    return state.pathSet.has(hex.key(col, row));
  }

  // Range in whole tiles for a placed tower (upgrades/support hook in later).
  function towerRange(state, tower) {
    return state.towerDefs[tower.type].base_range_tiles;
  }

  function attackZone(state, col, row, range) {
    const { cols, rows } = state.level.grid;
    return hex.tilesInRange(col, row, range, cols, rows);
  }

  function canPlace(state, towerId, col, row) {
    const def = state.towerDefs[towerId];
    const { cols, rows } = state.level.grid;
    if (state.phase === 'won' || state.phase === 'lost') return { ok: false, reason: 'level is over' };
    if (!def) return { ok: false, reason: 'unknown tower' };
    if (!state.loadout.includes(towerId)) return { ok: false, reason: 'not in loadout' };
    if (!hex.inBounds(col, row, cols, rows)) return { ok: false, reason: 'off the map' };
    if (isPath(state, col, row)) return { ok: false, reason: 'path tile' };
    if (towerAt(state, col, row)) return { ok: false, reason: 'tile occupied' };
    if (state.credits < def.place_cost) return { ok: false, reason: `needs ${def.place_cost} credits` };
    return { ok: true };
  }

  function placeTower(state, towerId, col, row) {
    const check = canPlace(state, towerId, col, row);
    if (!check.ok) return check;
    const def = state.towerDefs[towerId];
    state.credits -= def.place_cost;
    state.creditsSpent += def.place_cost;
    const tower = { id: state.nextId++, type: towerId, col, row, cooldown: 0, shots: 0 };
    state.towers.push(tower);
    return { ok: true, tower };
  }

  function canStartWave(state) {
    return state.phase === 'build' && state.waveIndex < state.level.waves.length;
  }

  function startWave(state) {
    if (!canStartWave(state)) return false;
    state.schedule = waveSchedule(state.level.waves[state.waveIndex]);
    state.waveTime = 0;
    state.phase = 'wave';
    return true;
  }

  function spawnEnemy(state, enemyId) {
    const def = state.enemyDefs[enemyId];
    const wave = state.level.waves[state.waveIndex];
    const hp = Math.round(def.hp * (wave.hp_scale || 1));
    state.enemies.push({
      id: state.nextId++,
      type: enemyId,
      hp,
      maxHp: hp,
      speed: def.speed,
      armor: def.armor,
      bounty: def.bounty,
      damage: def.base_damage,
      progress: 0,
    });
  }

  // Path tile an enemy currently occupies (nearest tile along its route).
  function enemyTile(state, enemy) {
    const path = state.level.path;
    const i = Math.min(path.length - 1, Math.max(0, Math.round(enemy.progress)));
    return { col: path[i][0], row: path[i][1] };
  }

  function endLevel(state, won) {
    state.phase = won ? 'won' : 'lost';
    state.schedule = [];
    // Final credits are stored for the campaign; no bonuses in M1.
    state.result = { won, credits: state.credits, wave: state.waveIndex + (won ? 0 : 1) };
  }

  function step(state, dt) {
    if (state.phase !== 'wave') return;
    state.time += dt;
    state.waveTime += dt;

    // 1. Spawn.
    while (state.schedule.length && state.schedule[0].time <= state.waveTime) {
      spawnEnemy(state, state.schedule.shift().enemy);
    }

    // 2. Move; enemies reaching the exit damage the base.
    const exitAt = state.level.path.length - 1;
    for (const e of state.enemies) {
      e.progress += e.speed * dt;
      if (e.progress >= exitAt) {
        e.leaked = true;
        state.baseHealth = Math.max(0, state.baseHealth - e.damage);
        state.leaks++;
        state.events.push({ type: 'leak', enemy: e.id });
      }
    }
    state.enemies = state.enemies.filter((e) => !e.leaked);
    if (state.baseHealth <= 0) { endLevel(state, false); return; }

    // 3. Towers fire at the first enemy (furthest along the path) in range.
    for (const t of state.towers) {
      const def = state.towerDefs[t.type];
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      const range = towerRange(state, t);
      let target = null;
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        if (hex.distance(t, enemyTile(state, e)) > range) continue;
        if (!target || e.progress > target.progress) target = e;
      }
      if (!target) { t.cooldown = 0; continue; } // stay ready
      const dmg = Math.max(1, def.base_damage - target.armor);
      target.hp -= dmg;
      t.shots++;
      t.cooldown += 1 / def.fire_rate;
      state.events.push({ type: 'shot', tower: t.id, enemy: target.id, progress: target.progress });
    }

    // 4. Remove the dead and pay bounties.
    const alive = [];
    for (const e of state.enemies) {
      if (e.hp > 0) { alive.push(e); continue; }
      state.credits += e.bounty;
      state.creditsEarned += e.bounty;
      state.kills++;
      state.events.push({ type: 'kill', enemy: e.id, progress: e.progress, bounty: e.bounty });
    }
    state.enemies = alive;

    // 5. Wave cleared when nothing is left to spawn and nothing is alive.
    if (!state.schedule.length && !state.enemies.length) {
      const i = state.waveIndex;
      state.wavesCleared[i] = true;
      state.waveIntel[i] = waveSummary(state.level.waves[i]);
      state.events.push({ type: 'waveCleared', wave: i });
      state.waveIndex++;
      if (state.waveIndex >= state.level.waves.length) endLevel(state, true);
      else state.phase = 'build';
    }
  }

  // Intel shown when a wave square is clicked. Uncleared waves reveal nothing.
  function waveIntel(state, i) {
    if (!state.wavesCleared[i]) return { cleared: false };
    return Object.assign({ cleared: true }, state.waveIntel[i]);
  }

  const api = {
    byId, validateData, energyBudget, loadoutEnergy, checkLoadout, canAddToLoadout,
    waveSchedule, waveSummary, createGame, towerAt, isPath, towerRange, attackZone,
    canPlace, placeTower, canStartWave, startWave, enemyTile, step, waveIntel,
  };

  root.TD = root.TD || {};
  root.TD.sim = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
