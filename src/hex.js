// Hex grid maths. Pointy-top hexes, "odd-r" offset coordinates in data
// (odd rows are shifted right by half a hex), axial/cube coordinates for maths.
//
// Offset tile:  { col, row }
// Axial:        { q, r }        (cube s = -q - r)
//
// Pixel maths uses a hex "size" = centre-to-corner distance. With size 1,
// adjacent centres are sqrt(3) apart; the simulation measures distance in
// tiles (one tile = one centre-to-centre step), so it never needs pixels.
(function (root) {
  'use strict';

  const SQRT3 = Math.sqrt(3);

  // Axial neighbour directions (same order for every hex).
  const AXIAL_DIRS = [
    { q: +1, r: 0 }, { q: +1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: +1 }, { q: 0, r: +1 },
  ];

  function offsetToAxial(col, row) {
    // odd-r: q = col - (row - (row & 1)) / 2
    return { q: col - (row - (row & 1)) / 2, r: row };
  }

  function axialToOffset(q, r) {
    return { col: q + (r - (r & 1)) / 2, row: r };
  }

  function axialDistance(a, b) {
    const dq = a.q - b.q;
    const dr = a.r - b.r;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }

  // Distance in tiles between two offset tiles.
  function distance(a, b) {
    return axialDistance(offsetToAxial(a.col, a.row), offsetToAxial(b.col, b.row));
  }

  // The six neighbours of an offset tile (may fall outside the grid).
  function neighbours(col, row) {
    const a = offsetToAxial(col, row);
    return AXIAL_DIRS.map((d) => axialToOffset(a.q + d.q, a.r + d.r));
  }

  function inBounds(col, row, cols, rows) {
    return col >= 0 && col < cols && row >= 0 && row < rows;
  }

  // Every offset tile within `radius` tiles of (col,row), including itself,
  // clipped to the grid. Radius 1 gives the tile plus its six neighbours.
  function tilesInRange(col, row, radius, cols, rows) {
    const c = offsetToAxial(col, row);
    const out = [];
    for (let dq = -radius; dq <= radius; dq++) {
      const lo = Math.max(-radius, -dq - radius);
      const hi = Math.min(radius, -dq + radius);
      for (let dr = lo; dr <= hi; dr++) {
        const o = axialToOffset(c.q + dq, c.r + dr);
        if (inBounds(o.col, o.row, cols, rows)) out.push(o);
      }
    }
    return out;
  }

  // Round fractional axial coordinates to the nearest hex (via cube rounding).
  function axialRound(q, r) {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(s);
    const dq = Math.abs(rq - q);
    const dr = Math.abs(rr - r);
    const ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    // Normalise -0 to 0 so results compare cleanly.
    return { q: rq + 0, r: rr + 0 };
  }

  // Centre of an offset tile in pixels, for a hex of the given size,
  // with tile (0,0) centred at (0,0).
  function hexToPixel(col, row, size) {
    return {
      x: size * SQRT3 * (col + 0.5 * (row & 1)),
      y: size * 1.5 * row,
    };
  }

  // Offset tile containing pixel (x,y). Same origin as hexToPixel.
  function pixelToHex(x, y, size) {
    const q = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
    const r = ((2 / 3) * y) / size;
    const a = axialRound(q, r);
    return axialToOffset(a.q, a.r);
  }

  // Corner points of a pointy-top hex centred at (cx,cy).
  function hexCorners(cx, cy, size) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
    }
    return pts;
  }

  // Pixel extent of a cols x rows odd-r grid (tile (0,0) centred at (0,0)).
  function gridPixelBounds(cols, rows, size) {
    const w = SQRT3 * size;
    return {
      minX: -w / 2,
      minY: -size,
      width: w * (cols + (rows > 1 ? 0.5 : 0)),
      height: size * (1.5 * (rows - 1) + 2),
    };
  }

  const key = (col, row) => col + ',' + row;

  const api = {
    SQRT3, AXIAL_DIRS,
    offsetToAxial, axialToOffset, axialDistance, distance, neighbours,
    inBounds, tilesInRange, axialRound, hexToPixel, pixelToHex, hexCorners,
    gridPixelBounds, key,
  };

  root.TD = root.TD || {};
  root.TD.hex = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
