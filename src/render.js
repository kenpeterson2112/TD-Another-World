// Canvas rendering. Reads simulation state; never changes it.
(function (root) {
  'use strict';
  const hex = root.TD.hex;
  const sim = root.TD.sim;

  const COLORS = {
    bg: '#0a0e18',
    tile: '#18213a',
    tileEdge: '#26324f',
    path: '#5b4128',
    pathEdge: '#7a5834',
    spawn: '#8a5cff',
    base: '#35d0e0',
    zoneFill: 'rgba(80, 200, 255, 0.16)',
    zoneEdge: 'rgba(80, 200, 255, 0.55)',
    hover: 'rgba(255, 255, 255, 0.10)',
    ghostOk: 'rgba(90, 230, 140, 0.55)',
    ghostBad: 'rgba(255, 90, 90, 0.55)',
    tower: '#4fd1a5',
    towerEdge: '#0f3d30',
    towerSelected: '#ffffff',
    shot: 'rgba(160, 255, 220, 0.9)',
    basic: '#ff9a3c',
    fast: '#ff4fa3',
    enemyEdge: '#1a0f08',
    hpBack: 'rgba(0,0,0,0.6)',
    hpFill: '#7cff6b',
    bounty: '#ffe27a',
  };

  // Fit the grid into a w x h CSS-pixel box. Returns the view transform.
  function fitView(level, w, h) {
    const { cols, rows } = level.grid;
    const pad = 6;
    const unit = hex.gridPixelBounds(cols, rows, 1);
    const size = Math.max(4, Math.min((w - pad * 2) / unit.width, (h - pad * 2) / unit.height));
    const b = hex.gridPixelBounds(cols, rows, size);
    return {
      size,
      ox: (w - b.width) / 2 - b.minX,
      oy: (h - b.height) / 2 - b.minY,
      w, h,
    };
  }

  function tileCenter(view, col, row) {
    const p = hex.hexToPixel(col, row, view.size);
    return { x: p.x + view.ox, y: p.y + view.oy };
  }

  function pixelToTile(view, x, y) {
    return hex.pixelToHex(x - view.ox, y - view.oy, view.size);
  }

  // Pixel position along the path for a fractional progress value.
  function pathPoint(view, level, progress) {
    const path = level.path;
    const last = path.length - 1;
    const p = Math.min(last, Math.max(0, progress));
    const i = Math.min(last - 1, Math.floor(p));
    const f = p - i;
    const a = tileCenter(view, path[i][0], path[i][1]);
    const b = tileCenter(view, path[i + 1][0], path[i + 1][1]);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  function hexPath(ctx, cx, cy, size) {
    const pts = hex.hexCorners(cx, cy, size);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }

  function drawZone(ctx, view, state, col, row, range) {
    ctx.fillStyle = COLORS.zoneFill;
    ctx.strokeStyle = COLORS.zoneEdge;
    ctx.lineWidth = 1;
    for (const t of sim.attackZone(state, col, row, range)) {
      const c = tileCenter(view, t.col, t.row);
      hexPath(ctx, c.x, c.y, view.size * 0.94);
      ctx.fill();
      ctx.stroke();
    }
  }

  // fx: transient visuals owned by the UI: { shots: [], pops: [] }
  // ui: { hover, placing, pending, selectedId, now, aim: { towerId: angle } }
  function draw(ctx, view, state, ui, fx) {
    const { level } = state;
    const { cols, rows } = level.grid;
    const s = view.size;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, view.w, view.h);

    // Tiles.
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const c = tileCenter(view, col, row);
        const onPath = sim.isPath(state, col, row);
        hexPath(ctx, c.x, c.y, s * 0.96);
        ctx.fillStyle = onPath ? COLORS.path : COLORS.tile;
        ctx.fill();
        ctx.strokeStyle = onPath ? COLORS.pathEdge : COLORS.tileEdge;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Spawn and base markers at the path ends.
    const [sc, sr] = level.path[0];
    const [ec, er] = level.path[level.path.length - 1];
    const sp = tileCenter(view, sc, sr);
    const ep = tileCenter(view, ec, er);
    ctx.strokeStyle = COLORS.spawn;
    ctx.lineWidth = Math.max(2, s * 0.12);
    hexPath(ctx, sp.x, sp.y, s * 0.6);
    ctx.stroke();
    ctx.fillStyle = COLORS.base;
    hexPath(ctx, ep.x, ep.y, s * 0.55);
    ctx.fill();
    ctx.strokeStyle = '#0b3a40';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hover highlight.
    const focus = ui.pending || ui.hover;
    if (focus && hex.inBounds(focus.col, focus.row, cols, rows)) {
      const c = tileCenter(view, focus.col, focus.row);
      hexPath(ctx, c.x, c.y, s * 0.96);
      ctx.fillStyle = COLORS.hover;
      ctx.fill();
    }

    // Attack zones: selected tower, hovered tower, and the placement ghost.
    const selected = state.towers.find((t) => t.id === ui.selectedId);
    if (selected) drawZone(ctx, view, state, selected.col, selected.row, sim.towerRange(state, selected));
    if (!ui.placing && ui.hover) {
      const hovered = sim.towerAt(state, ui.hover.col, ui.hover.row);
      if (hovered && hovered !== selected) drawZone(ctx, view, state, hovered.col, hovered.row, sim.towerRange(state, hovered));
    }
    if (ui.placing && focus && hex.inBounds(focus.col, focus.row, cols, rows)) {
      const def = state.towerDefs[ui.placing];
      const ok = sim.canPlace(state, ui.placing, focus.col, focus.row).ok;
      if (ok) drawZone(ctx, view, state, focus.col, focus.row, def.base_range_tiles);
      const c = tileCenter(view, focus.col, focus.row);
      ctx.fillStyle = ok ? COLORS.ghostOk : COLORS.ghostBad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Enemies.
    for (const e of state.enemies) {
      const p = pathPoint(view, level, e.progress);
      const r = s * (e.type === 'fast' ? 0.3 : 0.38);
      ctx.fillStyle = COLORS[e.type] || COLORS.basic;
      ctx.strokeStyle = COLORS.enemyEdge;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (e.type === 'fast') {
        ctx.moveTo(p.x, p.y - r * 1.2);
        ctx.lineTo(p.x + r, p.y);
        ctx.lineTo(p.x, p.y + r * 1.2);
        ctx.lineTo(p.x - r, p.y);
        ctx.closePath();
      } else {
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      if (e.hp < e.maxHp) {
        const bw = s * 0.8;
        const bh = Math.max(2, s * 0.1);
        const bx = p.x - bw / 2;
        const by = p.y - r * 1.3 - bh - 2;
        ctx.fillStyle = COLORS.hpBack;
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = COLORS.hpFill;
        ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), bh);
      }
    }

    // Towers (drawn over enemies so they stay readable).
    for (const t of state.towers) {
      const c = tileCenter(view, t.col, t.row);
      const r = s * 0.5;
      ctx.fillStyle = COLORS.tower;
      ctx.strokeStyle = t.id === ui.selectedId ? COLORS.towerSelected : COLORS.towerEdge;
      ctx.lineWidth = t.id === ui.selectedId ? 3 : 2;
      hexPath(ctx, c.x, c.y, r);
      ctx.fill();
      ctx.stroke();
      // Barrel pointing at the last target.
      const ang = ui.aim[t.id] != null ? ui.aim[t.id] : -Math.PI / 2;
      ctx.strokeStyle = COLORS.towerEdge;
      ctx.lineWidth = Math.max(2, s * 0.16);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(ang) * r * 0.95, c.y + Math.sin(ang) * r * 0.95);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    // Shot tracers.
    ctx.lineWidth = Math.max(1.5, s * 0.08);
    for (const f of fx.shots) {
      const a = 1 - (ui.now - f.t0) / f.life;
      if (a <= 0) continue;
      ctx.strokeStyle = COLORS.shot;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(f.x0, f.y0);
      ctx.lineTo(f.x1, f.y1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Bounty pops.
    ctx.font = `bold ${Math.max(10, Math.round(s * 0.45))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of fx.pops) {
      const k = (ui.now - f.t0) / f.life;
      if (k >= 1) continue;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = COLORS.bounty;
      ctx.fillText(f.text, f.x, f.y - k * s * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  const api = { COLORS, fitView, tileCenter, pixelToTile, pathPoint, draw };
  root.TD = root.TD || {};
  root.TD.render = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
