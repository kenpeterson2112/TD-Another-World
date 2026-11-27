// Hex maths checks. Run with: node tests/run.js
'use strict';
const hex = require('../src/hex.js');

module.exports = function (t) {
  t.group('hex: offset <-> axial');
  // odd-r: odd rows shift right, so (0,1) sits below-right of (0,0).
  t.deepEqual(hex.offsetToAxial(0, 0), { q: 0, r: 0 }, '(0,0) -> axial (0,0)');
  t.deepEqual(hex.offsetToAxial(0, 1), { q: 0, r: 1 }, '(0,1) -> axial (0,1)');
  t.deepEqual(hex.offsetToAxial(0, 2), { q: -1, r: 2 }, '(0,2) -> axial (-1,2)');
  t.deepEqual(hex.offsetToAxial(3, 5), { q: 1, r: 5 }, '(3,5) -> axial (1,5)');
  let roundTrip = true;
  for (let row = -5; row < 25; row++) {
    for (let col = -5; col < 12; col++) {
      const a = hex.offsetToAxial(col, row);
      const o = hex.axialToOffset(a.q, a.r);
      if (o.col !== col || o.row !== row) roundTrip = false;
    }
  }
  t.ok(roundTrip, 'offset -> axial -> offset round-trips over a wide area');

  t.group('hex: neighbours');
  const sortTiles = (ts) => ts.map((o) => hex.key(o.col, o.row)).sort();
  // Even row: neighbours lean left. Odd row: neighbours lean right.
  t.deepEqual(
    sortTiles(hex.neighbours(2, 2)),
    sortTiles([
      { col: 3, row: 2 }, { col: 1, row: 2 },
      { col: 1, row: 1 }, { col: 2, row: 1 },
      { col: 1, row: 3 }, { col: 2, row: 3 },
    ]),
    'even-row neighbours of (2,2)'
  );
  t.deepEqual(
    sortTiles(hex.neighbours(2, 3)),
    sortTiles([
      { col: 3, row: 3 }, { col: 1, row: 3 },
      { col: 2, row: 2 }, { col: 3, row: 2 },
      { col: 2, row: 4 }, { col: 3, row: 4 },
    ]),
    'odd-row neighbours of (2,3)'
  );
  let allDist1 = true;
  for (const [c, r] of [[0, 0], [2, 2], [2, 3], [5, 17]]) {
    for (const n of hex.neighbours(c, r)) {
      if (hex.distance({ col: c, row: r }, n) !== 1) allDist1 = false;
    }
  }
  t.ok(allDist1, 'every neighbour is at distance 1');

  t.group('hex: distance');
  t.equal(hex.distance({ col: 0, row: 0 }, { col: 0, row: 0 }), 0, 'same tile = 0');
  t.equal(hex.distance({ col: 0, row: 0 }, { col: 5, row: 0 }), 5, 'along a row = column difference');
  t.equal(hex.distance({ col: 0, row: 0 }, { col: 0, row: 4 }), 4, 'straight down a column, 4 rows');
  t.equal(hex.distance({ col: 0, row: 0 }, { col: 2, row: 4 }), 4, '(0,0)->(2,4) = 4 (diagonal is free)');
  t.equal(hex.distance({ col: 0, row: 0 }, { col: 3, row: 4 }), 5, '(0,0)->(3,4) = 5');
  t.equal(hex.distance({ col: 5, row: 17 }, { col: 0, row: 0 }), 17, 'corner to corner of 6x18');
  t.equal(
    hex.distance({ col: 1, row: 3 }, { col: 4, row: 8 }),
    hex.distance({ col: 4, row: 8 }, { col: 1, row: 3 }),
    'distance is symmetric'
  );

  t.group('hex: tiles in range');
  t.equal(hex.tilesInRange(10, 10, 0, 30, 30).length, 1, 'radius 0 = 1 tile');
  t.equal(hex.tilesInRange(10, 10, 1, 30, 30).length, 7, 'radius 1 = 7 tiles (self + 6)');
  t.equal(hex.tilesInRange(10, 10, 2, 30, 30).length, 19, 'radius 2 = 19 tiles');
  t.equal(hex.tilesInRange(10, 10, 3, 30, 30).length, 37, 'radius 3 = 37 tiles');
  const r2 = hex.tilesInRange(2, 7, 2, 6, 18);
  t.ok(r2.every((o) => hex.distance({ col: 2, row: 7 }, o) <= 2), 'every tile in range is within the radius');
  // Brute force: the range set equals all in-bounds tiles within distance.
  let brute = 0;
  for (let row = 0; row < 18; row++) {
    for (let col = 0; col < 6; col++) {
      if (hex.distance({ col: 2, row: 7 }, { col, row }) <= 2) brute++;
    }
  }
  t.equal(r2.length, brute, 'range set matches brute-force count');
  t.equal(hex.tilesInRange(0, 0, 1, 6, 18).length, 3, 'corner (0,0) radius 1 clipped to 3 tiles');

  t.group('hex: pixel <-> hex');
  const size = 20;
  let centresOk = true;
  let nearOk = true;
  for (let row = 0; row < 18; row++) {
    for (let col = 0; col < 6; col++) {
      const p = hex.hexToPixel(col, row, size);
      const back = hex.pixelToHex(p.x, p.y, size);
      if (back.col !== col || back.row !== row) centresOk = false;
      // Points well inside the hex (70% of inner radius) map to the same tile.
      const inner = size * hex.SQRT3 / 2 * 0.7;
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2;
        const b = hex.pixelToHex(p.x + inner * Math.cos(ang), p.y + inner * Math.sin(ang), size);
        if (b.col !== col || b.row !== row) nearOk = false;
      }
    }
  }
  t.ok(centresOk, 'every tile centre maps back to its tile');
  t.ok(nearOk, 'points inside each hex map to that hex');
  const p01 = hex.hexToPixel(0, 1, size);
  t.ok(Math.abs(p01.x - size * hex.SQRT3 / 2) < 1e-9, 'odd row shifted right by half a hex');
  const a = hex.hexToPixel(0, 0, size);
  const b = hex.hexToPixel(1, 0, size);
  t.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - size * hex.SQRT3) < 1e-9, 'adjacent centres are sqrt(3)*size apart');
  t.deepEqual(hex.axialRound(-0.2, 0.1), { q: 0, r: 0 }, 'axialRound normalises -0');
};
