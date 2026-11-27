// Loads the game data from data/ the same way tools/build.js bundles it.
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadData() {
  const levelsDir = path.join(DATA_DIR, 'levels');
  const levels = {};
  for (const f of fs.readdirSync(levelsDir).filter((n) => n.endsWith('.json')).sort()) {
    const level = readJson(path.join(levelsDir, f));
    levels[level.id] = level;
  }
  return {
    towers: readJson(path.join(DATA_DIR, 'towers.json')),
    enemies: readJson(path.join(DATA_DIR, 'enemies.json')),
    player: readJson(path.join(DATA_DIR, 'player.json')),
    levels,
  };
}

module.exports = { loadData, DATA_DIR };
