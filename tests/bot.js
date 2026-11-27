// A simple headless player used to check that level data is winnable and
// not trivial. Strategy: before each wave, spend all credits on the free
// tiles that cover the most path tiles (ties go to tiles near the exit).
'use strict';
const sim = require('../src/sim.js');
const hex = require('../src/hex.js');

function bestTiles(state, towerId) {
  const { cols, rows } = state.level.grid;
  const range = state.towerDefs[towerId].base_range_tiles;
  const path = state.level.path;
  const scored = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (sim.isPath(state, col, row) || sim.towerAt(state, col, row)) continue;
      let cover = 0;
      let late = 0;
      path.forEach(([c, r], i) => {
        if (hex.distance({ col, row }, { col: c, row: r }) <= range) { cover++; late += i; }
      });
      scored.push({ col, row, cover, late });
    }
  }
  scored.sort((a, b) => b.cover - a.cover || b.late - a.late);
  return scored;
}

// opts.maxTowers caps how many towers the bot builds (to test "too few loses").
function play(data, levelId, opts) {
  opts = opts || {};
  const state = sim.createGame(data, levelId);
  const towerId = state.loadout[0];
  const dt = 1 / 60;
  const log = [];
  while (state.phase !== 'won' && state.phase !== 'lost') {
    for (const t of bestTiles(state, towerId)) {
      if (opts.maxTowers != null && state.towers.length >= opts.maxTowers) break;
      if (!sim.placeTower(state, towerId, t.col, t.row).ok) break;
    }
    const hpBefore = state.baseHealth;
    sim.startWave(state);
    let guard = 0;
    while (state.phase === 'wave' && guard++ < 60 * 600) sim.step(state, dt);
    state.events.length = 0;
    log.push({ wave: log.length + 1, towers: state.towers.length, credits: state.credits, hp: state.baseHealth, lost: hpBefore - state.baseHealth });
  }
  return { state, log };
}

module.exports = { play, bestTiles };

if (require.main === module) {
  const { loadData } = require('./loadData.js');
  const data = loadData();
  for (const maxTowers of [undefined, 0, 1, 3]) {
    const { state, log } = play(data, 'level1', { maxTowers });
    console.log(`\nmaxTowers=${maxTowers ?? 'unlimited'}: ${state.phase} at wave ${state.waveIndex + (state.phase === 'won' ? 0 : 1)}, base ${state.baseHealth}, kills ${state.kills}, leaks ${state.leaks}`);
    if (maxTowers === undefined) for (const l of log) console.log('  ', JSON.stringify(l));
  }
}
