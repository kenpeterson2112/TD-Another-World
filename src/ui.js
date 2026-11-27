// DOM, input and the game loop. Glues the simulation to the canvas.
(function (root) {
  'use strict';
  const { hex, sim, render } = root.TD;
  const DATA = root.TD.DATA;
  const LEVEL_ID = 'level1';
  const DT = 1 / 60; // fixed simulation step, seconds
  const MAX_STEPS_PER_FRAME = 20;

  const $ = (id) => document.getElementById(id);
  const el = {};

  let state = null;
  let view = null;
  let ctx = null;
  let paused = false;
  let speed = 1;
  let acc = 0;
  let lastTs = null;
  let overlayShown = false;
  let intelOpen = null; // index of the wave whose intel is showing
  let messageTimer = null;
  // Final credits are stored here when a level ends (session memory only;
  // the save file arrives in M4).
  let lastResult = null;

  const ui = { hover: null, placing: null, pending: null, selectedId: null, now: 0, aim: {} };
  const fx = { shots: [], pops: [] };
  const hudCache = {};

  // ---------- setup ----------

  function init() {
    for (const id of ['map', 'stage', 'waves', 'palette', 'intel', 'overlay', 'overlay-title',
      'overlay-stats', 'overlay-credits', 'btn-restart', 'btn-start', 'btn-pause', 'btn-speed',
      'message', 'stat-health', 'stat-credits', 'stat-wave', 'stat-energy']) {
      el[id] = $(id);
    }
    ctx = el.map.getContext('2d');

    const errors = sim.validateData(DATA);
    if (errors.length) {
      console.error('Data errors:\n' + errors.join('\n'));
      el.message.textContent = 'Data error: ' + errors[0];
      return;
    }

    el['btn-start'].addEventListener('click', onStart);
    el['btn-pause'].addEventListener('click', togglePause);
    el['btn-speed'].addEventListener('click', toggleSpeed);
    el['btn-restart'].addEventListener('click', newGame);

    const canvas = el.map;
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') ui.hover = tileFromEvent(e);
    });
    canvas.addEventListener('pointerleave', () => { ui.hover = null; });
    canvas.addEventListener('pointerup', (e) => {
      handleTap(tileFromEvent(e), e.pointerType !== 'mouse');
    });
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); cancelPlacing(); });
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', (e) => {
      // Tapping outside the intel panel (and not on a wave square) closes it.
      if (intelOpen != null && !el.intel.contains(e.target) && !e.target.closest('.wave-sq')) closeIntel();
    });

    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(el.stage);

    newGame();
    resize();
    requestAnimationFrame(frame);
  }

  function newGame() {
    state = sim.createGame(DATA, LEVEL_ID);
    paused = false;
    speed = 1;
    acc = 0;
    overlayShown = false;
    ui.hover = null;
    ui.placing = null;
    ui.pending = null;
    ui.selectedId = null;
    ui.aim = {};
    fx.shots.length = 0;
    fx.pops.length = 0;
    for (const k of Object.keys(hudCache)) delete hudCache[k];
    el.overlay.hidden = true;
    closeIntel();
    buildWaveSquares();
    buildPalette();
    if (view) view = render.fitView(state.level, view.w, view.h);
    say('Pick the Blaster, tap a dark tile to build, then start the wave.');
  }

  function resize() {
    if (!state) return;
    const rect = el.stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    el.map.width = Math.round(rect.width * dpr);
    el.map.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view = render.fitView(state.level, rect.width, rect.height);
  }

  function buildWaveSquares() {
    const n = state.level.waves.length;
    el.waves.style.setProperty('--wave-count', n);
    el.waves.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wave-sq';
      b.setAttribute('aria-label', 'Wave ' + (i + 1));
      b.addEventListener('click', () => (intelOpen === i ? closeIntel() : showIntel(i)));
      el.waves.appendChild(b);
    }
  }

  function buildPalette() {
    el.palette.innerHTML = '';
    for (const id of state.loadout) {
      const def = state.towerDefs[id];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tower-card';
      b.dataset.tower = id;
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<span class="swatch"></span><span class="meta"><span></span><small></small></span>';
      b.querySelector('.meta span').textContent = def.name;
      b.querySelector('small').textContent =
        `${def.place_cost} cr · range ${def.base_range_tiles} · ${def.energy_cost} energy`;
      b.addEventListener('click', () => togglePlacing(id));
      el.palette.appendChild(b);
    }
  }

  // ---------- input ----------

  function tileFromEvent(e) {
    const rect = el.map.getBoundingClientRect();
    const t = render.pixelToTile(view, e.clientX - rect.left, e.clientY - rect.top);
    const { cols, rows } = state.level.grid;
    return hex.inBounds(t.col, t.row, cols, rows) ? t : null;
  }

  function sameTile(a, b) { return a && b && a.col === b.col && a.row === b.row; }

  // Mouse: click places at once (hover shows the preview).
  // Touch: first tap previews the tile and its attack zone, second tap places.
  function handleTap(tile, touch) {
    if (!tile) { ui.pending = null; return; }
    if (ui.placing) {
      const def = state.towerDefs[ui.placing];
      const check = sim.canPlace(state, ui.placing, tile.col, tile.row);
      if (touch && !sameTile(ui.pending, tile)) {
        ui.pending = tile;
        say(check.ok ? `Tap again to build ${def.name} (${def.place_cost} cr).` : `Can't build here: ${check.reason}.`);
        return;
      }
      ui.pending = null;
      const res = sim.placeTower(state, ui.placing, tile.col, tile.row);
      if (res.ok) {
        const more = state.credits >= def.place_cost ? '' : ' Earn more credits to build another.';
        say(`${def.name} built.${more}`);
      } else {
        say(`Can't build here: ${res.reason}.`);
      }
      return;
    }
    const tower = sim.towerAt(state, tile.col, tile.row);
    if (tower && tower.id !== ui.selectedId) {
      ui.selectedId = tower.id;
      const def = state.towerDefs[tower.type];
      say(`${def.name}: ${def.base_damage} damage, ${def.fire_rate} shot/s, range ${sim.towerRange(state, tower)} tiles. ${tower.shots} shots fired.`);
    } else {
      ui.selectedId = null;
      ui.pending = tile;
      if (sim.isPath(state, tile.col, tile.row)) say('Enemy path. Towers go on the dark tiles.');
    }
  }

  function togglePlacing(id) {
    if (ui.placing === id) { cancelPlacing(); return; }
    ui.placing = id;
    ui.pending = null;
    ui.selectedId = null;
    const def = state.towerDefs[id];
    if (state.credits < def.place_cost) say(`${def.name} costs ${def.place_cost} cr; you have ${state.credits}.`);
    else say(`Building ${def.name}: tap a dark tile. Tap the card again to stop.`);
  }

  function cancelPlacing() {
    ui.placing = null;
    ui.pending = null;
    ui.selectedId = null;
  }

  function onKey(e) {
    if (e.key === 'Escape') { cancelPlacing(); closeIntel(); }
    else if (e.key === ' ' && e.target === document.body) {
      e.preventDefault();
      if (sim.canStartWave(state)) onStart(); else if (state.phase === 'wave') togglePause();
    }
  }

  function onStart() {
    if (sim.startWave(state)) {
      paused = false;
      say(`Wave ${state.waveIndex + 1} incoming.`);
    }
  }

  function togglePause() {
    if (state.phase !== 'wave') return;
    paused = !paused;
    say(paused ? 'Paused. You can still build.' : '');
  }

  function toggleSpeed() {
    speed = speed === 1 ? 2 : 1;
  }

  // ---------- wave intel ----------

  function enemyName(id) {
    return state.enemyDefs[id] ? state.enemyDefs[id].name : id;
  }

  function showIntel(i) {
    intelOpen = i;
    const info = sim.waveIntel(state, i);
    const p = el.intel;
    p.innerHTML = '';
    const close = document.createElement('button');
    close.className = 'close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', closeIntel);
    const h = document.createElement('h2');
    h.textContent = `Wave ${i + 1}`;
    p.append(close, h);
    if (!info.cleared) {
      const m = document.createElement('p');
      m.className = 'muted';
      m.textContent = 'Not yet cleared.';
      p.append(m);
    } else {
      const ul = document.createElement('ul');
      for (const g of info.groups) {
        const li = document.createElement('li');
        const start = g.delay > 0 ? `, from ${g.delay}s` : '';
        li.textContent = `${enemyName(g.enemy)} × ${g.count}: one every ${g.interval}s${start}`;
        ul.append(li);
      }
      const m = document.createElement('p');
      m.className = 'muted';
      m.textContent = `${info.total} enemies. Toughness ×${info.hp_scale}.`;
      p.append(ul, m);
    }
    p.hidden = false;
  }

  function closeIntel() {
    intelOpen = null;
    if (el.intel) el.intel.hidden = true;
  }

  // ---------- loop ----------

  function frame(ts) {
    const t = ts / 1000;
    const real = lastTs == null ? 0 : Math.min(0.1, t - lastTs);
    lastTs = t;
    ui.now = t;

    if (state.phase === 'wave' && !paused) {
      acc += real * speed;
      let n = 0;
      while (acc >= DT && n < MAX_STEPS_PER_FRAME) { sim.step(state, DT); acc -= DT; n++; }
      if (n === MAX_STEPS_PER_FRAME) acc = 0;
    } else {
      acc = 0;
    }

    consumeEvents();
    fx.shots = fx.shots.filter((f) => ui.now - f.t0 < f.life);
    fx.pops = fx.pops.filter((f) => ui.now - f.t0 < f.life);

    if (view) render.draw(ctx, view, state, ui, fx);
    updateHud();
    if (state.result && !overlayShown) showOverlay();
    requestAnimationFrame(frame);
  }

  function consumeEvents() {
    if (!state.events.length) return;
    for (const ev of state.events) {
      if (ev.type === 'shot' && view) {
        const tw = state.towers.find((x) => x.id === ev.tower);
        if (!tw) continue;
        const a = render.tileCenter(view, tw.col, tw.row);
        const b = render.pathPoint(view, state.level, ev.progress);
        ui.aim[tw.id] = Math.atan2(b.y - a.y, b.x - a.x);
        fx.shots.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, t0: ui.now, life: 0.12 });
      } else if (ev.type === 'kill' && view) {
        const p = render.pathPoint(view, state.level, ev.progress);
        fx.pops.push({ x: p.x, y: p.y, text: '+' + ev.bounty, t0: ui.now, life: 0.7 });
      } else if (ev.type === 'leak') {
        flash(el['stat-health']);
      } else if (ev.type === 'waveCleared' && state.phase === 'build') {
        say(`Wave ${ev.wave + 1} cleared. Tap its square to review it.`);
      }
    }
    state.events.length = 0;
    // Keep effects bounded when many kills land in one frame (e.g. at 2x).
    if (fx.shots.length > 80) fx.shots.splice(0, fx.shots.length - 80);
    if (fx.pops.length > 24) fx.pops.splice(0, fx.pops.length - 24);
  }

  // ---------- HUD ----------

  function setStat(node, key, text) {
    if (hudCache[key] === text) return;
    hudCache[key] = text;
    node.querySelector('.value').textContent = text;
  }

  function flash(node) {
    node.classList.remove('flash');
    void node.offsetWidth; // restart the animation
    node.classList.add('flash');
  }

  function updateHud() {
    const n = state.level.waves.length;
    setStat(el['stat-health'], 'hp', `${state.baseHealth}/${state.maxBaseHealth}`);
    el['stat-health'].classList.toggle('danger', state.baseHealth <= state.maxBaseHealth * 0.25);
    setStat(el['stat-credits'], 'cr', String(state.credits));
    setStat(el['stat-wave'], 'wave', `${Math.min(state.waveIndex + 1, n)}/${n}`);
    setStat(el['stat-energy'], 'en', `${state.energy.used}/${state.energy.budget}`);

    // Wave squares: cleared filled, current outlined, upcoming empty.
    const key = state.wavesCleared.map((c) => (c ? 1 : 0)).join('') + '|' + state.waveIndex + '|' + state.phase;
    if (hudCache.waves !== key) {
      hudCache.waves = key;
      const squares = el.waves.children;
      for (let i = 0; i < n; i++) {
        const cleared = state.wavesCleared[i];
        const current = i === state.waveIndex && state.phase !== 'won';
        squares[i].classList.toggle('cleared', cleared);
        squares[i].classList.toggle('current', current);
        squares[i].setAttribute('aria-label', `Wave ${i + 1}: ${cleared ? 'cleared' : current ? 'current' : 'upcoming'}`);
      }
      if (intelOpen != null) showIntel(intelOpen);
    }

    // Controls.
    const start = el['btn-start'];
    const canStart = sim.canStartWave(state);
    start.disabled = !canStart;
    const label = state.phase === 'wave' ? `Wave ${state.waveIndex + 1} in progress`
      : state.phase === 'build' ? `Start wave ${state.waveIndex + 1}` : 'Level over';
    if (start.textContent !== label) start.textContent = label;
    const pause = el['btn-pause'];
    pause.disabled = state.phase !== 'wave';
    const pl = paused ? 'Resume' : 'Pause';
    if (pause.textContent !== pl) pause.textContent = pl;
    const sl = speed + 'x';
    if (el['btn-speed'].textContent !== sl) el['btn-speed'].textContent = sl;

    for (const card of el.palette.children) {
      const def = state.towerDefs[card.dataset.tower];
      card.setAttribute('aria-pressed', String(ui.placing === def.id));
      card.classList.toggle('unaffordable', state.credits < def.place_cost);
    }
  }

  function showOverlay() {
    overlayShown = true;
    lastResult = state.result;
    cancelPlacing();
    closeIntel();
    const r = state.result;
    const n = state.level.waves.length;
    const cleared = state.wavesCleared.filter(Boolean).length;
    el.overlay.className = r.won ? 'won' : 'lost';
    el['overlay-title'].textContent = r.won ? 'Base held!' : 'Base overrun';
    el['overlay-stats'].textContent = `Waves cleared: ${cleared}/${n} · Kills: ${state.kills} · Leaks: ${state.leaks}`;
    el['overlay-credits'].textContent = `Final credits: ${lastResult.credits}`;
    el.overlay.hidden = false;
    say('');
  }

  function say(text) {
    clearTimeout(messageTimer);
    el.message.textContent = text;
    if (text) messageTimer = setTimeout(() => { el.message.textContent = ''; }, 6000);
  }

  // Exposed for debugging in the browser console.
  root.TD.game = { get state() { return state; }, get lastResult() { return lastResult; }, newGame };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof globalThis !== 'undefined' ? globalThis : this);
