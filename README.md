# TD-Another-World
Tower defense... In space!!

Live @ https://kenpeterson2112.github.io/TD-Another-World/


See [DESIGN.md](DESIGN.md) for the core design doc and build plan. Current state: **Milestone 1, playable skeleton** (one level, one tower, 20 waves).

## Play

Open `index.html` in a browser. That's it: it is one self-contained file with no server, no install and no network needed.

- **Desktop:** double-click `index.html`, or drag it into a browser window.
- **Phone:** copy `index.html` to the phone (AirDrop, email, cloud drive) and open it in the browser, or serve it from GitHub Pages and open the URL.

How to play:
1. Tap the **Blaster** card, then tap a dark tile. On a touchscreen the first tap previews the tile and the tower's attack zone, and a second tap on the same tile builds. With a mouse, hover to preview and click to build. Tap the card again (or press Esc) to stop building.
2. Press **Start wave**. Enemies walk the brown path from the purple spawn to your base (cyan, bottom right). Each kill pays 5 credits; each enemy that reaches the base costs 1 base health.
3. Tap a placed tower to see its attack zone. Tap a filled (cleared) wave square to see what that wave contained.
4. Clear all 20 waves to win. Base health 0 loses. Restart from the end screen.

Keys: Space starts the next wave (or pauses during one), Esc cancels building.

## Develop

The code and data are split into source files; `index.html` is **generated** from them. Edit the sources, then rebuild:

```bash
node tools/build.js
```

Run the tests (hex maths, data, simulation, and a check that `index.html` is up to date):

```bash
node tests/run.js
```

Needs Node 16 or newer. There are no npm dependencies.

To balance the game, edit the JSON in `data/` and rebuild. No code changes are needed for stats, costs, the map or waves.

## Folder layout

```
index.html               the game: generated, self-contained, open this
DESIGN.md                design doc (source of truth for rules)
data/
  towers.json            tower stats (cost, damage, range, fire rate, energy)
  enemies.json           enemy stats (hp, speed in tiles/s, armor, bounty)
  player.json            starting credits, base health, energy cap, loadout
  levels/level1.json     6x18 map, enemy path, 20 waves
src/
  hex.js                 hex grid maths (odd-r offset <-> axial, distance, range, pixel <-> hex)
  sim.js                 game rules and state; no DOM, runs headless in Node
  render.js              canvas drawing (reads state, never changes it)
  ui.js                  HUD, controls, input and the game loop
  style.css              page styles
  index.template.html    page skeleton the build fills in
tools/
  build.js               bundles src/ + data/ into index.html
tests/
  run.js                 test runner (no dependencies)
  *.test.js              hex, data, sim and build checks
  bot.js                 headless player used to check the level is winnable
  loadData.js            reads data/ for the build and the tests
```
