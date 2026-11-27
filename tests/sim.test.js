// Simulation checks, run headless (no canvas).
'use strict';
const sim = require('../src/sim.js');
const hex = require('../src/hex.js');
const { loadData } = require('./loadData.js');
const bot = require('./bot.js');

const DT = 1 / 60;

function runWave(state, maxSeconds) {
  let n = 0;
  while (state.phase === 'wave' && n++ < maxSeconds * 60) sim.step(state, DT);
}

// A tiny custom level for precise checks: a straight 6-tile path.
function testData(overrides) {
  const data = loadData();
  data.levels.test = Object.assign({
    id: 'test',
    name: 'Test strip',
    grid: { cols: 6, rows: 3 },
    path: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1]],
    waves: [{ groups: [{ enemy: 'basic', count: 1, interval: 1 }] }],
  }, overrides || {});
  return data;
}

module.exports = function (t) {
  t.group('sim: placement');
  {
    const data = loadData();
    const s = sim.createGame(data, 'level1');
    t.equal(s.credits, 100, 'start with 100 credits');
    t.equal(sim.canPlace(s, 'blaster', 0, 0).reason, 'path tile', 'cannot place on a path tile');
    t.equal(sim.canPlace(s, 'blaster', 9, 0).reason, 'off the map', 'cannot place off the map');
    t.ok(sim.placeTower(s, 'blaster', 1, 1).ok, 'can place on a buildable tile');
    t.equal(s.credits, 0, 'placing deducts the place cost');
    s.credits = 500;
    t.equal(sim.canPlace(s, 'blaster', 1, 1).reason, 'tile occupied', 'cannot place on an occupied tile');
    s.credits = 99;
    t.equal(sim.canPlace(s, 'blaster', 2, 2).reason, 'needs 100 credits', 'cannot place without enough credits');
    t.equal(sim.canPlace(s, 'lance', 2, 2).reason, 'unknown tower', 'unknown tower types are rejected');
  }

  t.group('sim: energy (caps tower types in the loadout)');
  {
    const data = loadData();
    const level = data.levels.level1;
    t.equal(sim.energyBudget(data, level), 1, 'budget falls back to the player energy cap (1)');
    const s = sim.createGame(data, 'level1');
    t.deepEqual(s.energy, { ok: true, used: 1, budget: 1 }, 'Blaster-only loadout uses 1 of 1');
    // A second tower type would exceed the budget.
    data.towers.push(Object.assign({}, data.towers[0], { id: 'testgun', name: 'Test Gun', energy_cost: 1 }));
    t.equal(sim.canAddToLoadout(data, level, ['blaster'], 'testgun').ok, false, 'a second type is blocked at budget 1');
    let threw = false;
    try { sim.createGame(data, 'level1', { loadout: ['blaster', 'testgun'] }); } catch (e) { threw = true; }
    t.ok(threw, 'an over-budget loadout cannot start a mission');
    level.energy_budget = 2;
    t.equal(sim.canAddToLoadout(data, level, ['blaster'], 'testgun').ok, true, 'a level budget override of 2 allows two types');
    const s2 = sim.createGame(data, 'level1', { loadout: ['blaster'] });
    s2.credits = 1000;
    let placed = 0;
    for (let col = 1; col <= 4; col++) if (sim.placeTower(s2, 'blaster', col, 1).ok) placed++;
    t.equal(placed, 4, 'energy does not limit how many towers you place');
    t.equal(sim.canPlace(s2, 'testgun', 1, 2).reason, 'not in loadout', 'types outside the loadout cannot be placed');
  }

  t.group('sim: movement, leaks and base health');
  {
    const data = testData();
    const s = sim.createGame(data, 'test');
    sim.startWave(s);
    sim.step(s, DT);
    t.equal(s.enemies.length, 1, 'enemy spawns at the start of the wave');
    for (let i = 0; i < 60; i++) sim.step(s, DT);
    const e = s.enemies[0];
    t.ok(Math.abs(e.progress - 2 * 61 / 60) < 1e-6, 'basic enemy moves 2 tiles per second');
    runWave(s, 10);
    t.equal(s.baseHealth, 19, 'a leaked enemy costs 1 base health');
    t.equal(s.leaks, 1, 'leak is counted');
    t.equal(s.phase, 'won', 'single-wave level ends once its only wave is over');
  }

  t.group('sim: targeting');
  {
    // Tough enemies so nobody dies: check every shot hits the enemy furthest
    // along the path among those in range.
    const data = testData({ waves: [{ groups: [{ enemy: 'basic', count: 4, interval: 0.3 }] }] });
    data.enemies.find((e) => e.id === 'basic').hp = 1000;
    const s = sim.createGame(data, 'test');
    sim.placeTower(s, 'blaster', 3, 0);
    sim.startWave(s);
    let shots = 0;
    let correct = 0;
    let contested = 0;
    while (s.phase === 'wave') {
      sim.step(s, DT);
      for (const ev of s.events) {
        if (ev.type !== 'shot') continue;
        shots++;
        const inRange = s.enemies.filter((x) => hex.distance(s.towers[0], sim.enemyTile(s, x)) <= 2);
        if (inRange.length > 1) contested++;
        const best = inRange.reduce((a, b) => (b.progress > a.progress ? b : a));
        if (best.id === ev.enemy) correct++;
      }
      s.events.length = 0;
    }
    t.ok(contested > 0, `test covers shots with several enemies in range (${contested})`);
    t.equal(correct, shots, `every shot hits the first enemy in range (${correct}/${shots})`);
  }

  t.group('sim: kills and credits');
  {
    const data = testData({ waves: [{ groups: [{ enemy: 'basic', count: 3, interval: 1.5 }] }] });
    const s = sim.createGame(data, 'test');
    sim.placeTower(s, 'blaster', 3, 0);
    s.credits = 7; // leftover after building
    sim.startWave(s);
    runWave(s, 30);
    t.equal(s.kills, 3, 'one Blaster (10 dmg) kills all three 10 hp crawlers');
    t.equal(s.credits, 7 + 15, 'each kill pays 5 credits');
    t.equal(s.creditsEarned, 15, 'creditsEarned tracks bounties');
    t.equal(s.creditsSpent, 100, 'creditsSpent tracks placements');
    t.ok(s.result && s.result.won && s.result.credits === s.credits, 'final credits are stored on the result, with no bonus added');
  }

  t.group('sim: armor');
  {
    const data = testData();
    const basic = data.enemies.find((e) => e.id === 'basic');
    basic.armor = 5; basic.hp = 1000; basic.speed = 0.5;
    const s = sim.createGame(data, 'test');
    sim.placeTower(s, 'blaster', 2, 0);
    sim.startWave(s);
    for (let i = 0; i < 90 && !s.towers[0].shots; i++) sim.step(s, DT);
    t.equal(s.enemies[0].hp, 1000 - 5, 'armor 5 turns a 10 damage hit into 5');
  }

  t.group('sim: fire rate and range');
  {
    const data = testData({
      path: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1]],
      waves: [{ groups: [{ enemy: 'basic', count: 1, interval: 1 }] }],
    });
    data.enemies.find((e) => e.id === 'basic').hp = 1000; // never dies
    data.enemies.find((e) => e.id === 'basic').speed = 0.5; // slow, long exposure
    const s = sim.createGame(data, 'test');
    sim.placeTower(s, 'blaster', 2, 0);
    sim.startWave(s);
    let shotTimes = [];
    while (s.phase === 'wave') {
      sim.step(s, DT);
      if (s.events.some((ev) => ev.type === 'shot')) shotTimes.push({ t: s.waveTime, p: s.enemies[0] && s.enemies[0].progress });
      s.events.length = 0;
    }
    const gaps = shotTimes.slice(1).map((x, i) => x.t - shotTimes[i].t);
    t.ok(gaps.length > 2 && gaps.every((g) => Math.abs(g - 1) < DT * 1.5), 'shots are 1 second apart (1 shot/s)');
    // Tower at (2,0) with range 2: path tiles (0..3,1) are within 2; (4,1) is 3 away.
    const lastShotTile = sim.enemyTile(s, { progress: shotTimes[shotTimes.length - 1].p });
    t.ok(hex.distance({ col: 2, row: 0 }, lastShotTile) <= 2, 'never shoots outside its range');
    t.ok(shotTimes[shotTimes.length - 1].p < 3.5, 'stops shooting once the enemy moves onto tile 4 (out of range)');
    t.ok(shotTimes[shotTimes.length - 1].p > 2.5, 'keeps shooting while the enemy is still on tile 3 (in range)');
  }

  t.group('sim: wave flow and intel');
  {
    const data = loadData();
    const s = sim.createGame(data, 'level1');
    t.equal(sim.waveIntel(s, 0).cleared, false, 'uncleared wave reveals nothing');
    t.deepEqual(Object.keys(sim.waveIntel(s, 0)), ['cleared'], 'uncleared intel has no enemy details');
    t.ok(sim.startWave(s), 'can start wave 1 in build phase');
    t.equal(sim.startWave(s), false, 'cannot start another wave while one is running');
    sim.placeTower(s, 'blaster', 1, 2);
    runWave(s, 120);
    t.equal(s.wavesCleared[0], true, 'wave 1 is marked cleared');
    const intel = sim.waveIntel(s, 0);
    t.ok(intel.cleared && intel.groups[0].enemy === 'basic' && intel.groups[0].count === data.levels.level1.waves[0].groups[0].count, 'cleared wave intel lists enemy types and counts');
    t.equal(s.waveIndex, 1, 'next wave is wave 2');
    t.equal(s.phase, 'build', 'back to build phase between waves');
  }

  t.group('sim: whole level (headless bot)');
  {
    const data = loadData();
    const full = bot.play(data, 'level1');
    t.equal(full.state.phase, 'won', `a player who keeps building wins all 20 waves (base ${full.state.baseHealth}/20)`);
    t.ok(full.state.baseHealth < full.state.maxBaseHealth, 'and it is not a flawless walkover');
    t.equal(full.state.wavesCleared.filter(Boolean).length, 20, 'all 20 wave squares cleared');
    const none = bot.play(data, 'level1', { maxTowers: 0 });
    t.equal(none.state.phase, 'lost', 'no towers loses');
    const few = bot.play(data, 'level1', { maxTowers: 8 });
    t.equal(few.state.phase, 'lost', `stopping at 8 towers loses (at wave ${few.state.result.wave})`);
    t.equal(few.state.baseHealth, 0, 'a loss means base health hit 0');
    let restarted = sim.createGame(data, 'level1');
    t.ok(restarted.phase === 'build' && restarted.credits === 100 && restarted.towers.length === 0, 'a new game (restart) starts fresh');
  }
};
