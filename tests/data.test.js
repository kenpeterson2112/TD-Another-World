// Data file checks.
'use strict';
const sim = require('../src/sim.js');
const hex = require('../src/hex.js');
const { loadData } = require('./loadData.js');

module.exports = function (t) {
  const data = loadData();
  const level = data.levels.level1;

  t.group('data: validation');
  const errors = sim.validateData(data);
  t.deepEqual(errors, [], 'validateData reports no errors');

  t.group('data: level 1 map');
  t.deepEqual(level.grid, { cols: 6, rows: 18 }, 'grid is 6 columns x 18 rows');
  // The exact zigzag from the M1 brief.
  const expected = [];
  const add = (c, r) => { if (!expected.some(([a, b]) => a === c && b === r)) expected.push([c, r]); };
  for (let r = 0; r <= 4; r++) add(0, r);
  for (let c = 0; c <= 5; c++) add(c, 4);
  for (let r = 4; r <= 8; r++) add(5, r);
  for (let c = 5; c >= 0; c--) add(c, 8);
  for (let r = 8; r <= 12; r++) add(0, r);
  for (let c = 0; c <= 5; c++) add(c, 12);
  for (let r = 12; r <= 17; r++) add(5, r);
  t.deepEqual(level.path, expected, 'path matches the brief tile for tile');
  t.equal(level.path.length, 33, '33 path tiles');
  t.deepEqual(level.path[level.path.length - 1], [5, 17], 'path exits at (5,17)');
  let adjacent = true;
  for (let i = 1; i < level.path.length; i++) {
    const [a, b] = level.path[i - 1];
    const [c, d] = level.path[i];
    if (hex.distance({ col: a, row: b }, { col: c, row: d }) !== 1) adjacent = false;
  }
  t.ok(adjacent, 'consecutive path tiles are hex neighbours');

  t.group('data: waves and stats');
  t.equal(level.waves.length, 20, '20 waves');
  const totals = level.waves.map((w) => w.groups.reduce((n, g) => n + g.count, 0));
  t.ok(totals.every((n, i) => i === 0 || n >= totals[i - 1]), 'wave sizes never shrink');
  t.ok(level.waves.slice(3).every((w) => w.groups.some((g) => g.enemy === 'fast')), 'fast enemies mixed in from wave 4');
  t.deepEqual(data.enemies.map((e) => e.id).sort(), ['basic', 'fast'], 'two enemy types: basic and fast');
  t.deepEqual(data.towers.map((x) => x.id), ['blaster'], 'one tower: blaster');
  t.equal(data.player.starting_credits, 100, 'starting credits 100 (DESIGN.md)');
  t.equal(data.towers[0].place_cost, 100, 'Blaster costs 100 (DESIGN.md)');
  t.ok(data.enemies.every((e) => e.bounty === 5), 'every kill pays 5 credits (DESIGN.md)');
  t.equal(data.towers[0].fire_rate, 1, 'Blaster fires 1 shot/second (DESIGN.md)');
  t.equal(data.enemies.find((e) => e.id === 'basic').speed, 2, 'basic enemy speed 2 tiles/second (DESIGN.md)');
};
