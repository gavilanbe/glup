// GLUP — el mapa del pantano (selector de niveles). Un río serpentea desde el embarcadero
// hasta el ciprés muerto de la Garza; cada nivel es un lugar con su icono y Nila camina
// entre ellos. Abajo, una ficha con la vista previa del nivel, las crías y el mejor tiempo.
'use strict';
const Mapa = (() => {
  const NODES = [{ x: 46, y: 118 }, { x: 104, y: 92 }, { x: 162, y: 110 }, { x: 222, y: 80 }, { x: 276, y: 54 }];
  const PANEL = { x: 8, y: 132, w: 304, h: 40 };   // the screen is 320×180
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  // The river's centre line, from the bottom left to the top right.
  const river = u => ({ x: -10 + u * 350, y: 150 - u * 150 + Math.sin(u * 9) * 18 + Math.sin(u * 23) * 4 });
  let map = null;
  function build() {
    if (map) return map;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    // Marsh ground: dithered greens that darken toward the edges.
    const greens = ['#0e1a16', '#13221c', '#182b22', '#1e3428', '#243d2c'];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = hash(x * 7.3 + y * 131.1) * .6 + Math.sin(x / 17 + y / 23) * .2 + Math.sin(x / 7 - y / 11) * .1;
      const edge = Math.min(x, W - x, y * 1.4, (H - y) * 1.4) / 60, v = Math.max(0, Math.min(4, Math.floor((n + .4) * 3 * Math.min(1, edge + .35))));
      g.fillStyle = greens[v]; g.fillRect(x, y, 1, 1);
    }
    // Pools of standing water.
    for (let i = 0; i < 14; i++) { const cx = hash(i + 9) * W, cy = hash(i + 10) * H, r = 3 + hash(i + 11) * 6; for (let y = -r; y <= r; y++) { const hw = Math.round(Math.sqrt(r * r - y * y) * 1.6); g.fillStyle = '#16323a'; g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, 1); } g.fillStyle = '#2a5662'; g.fillRect(Math.round(cx - r), Math.round(cy - r + 1), Math.round(r), 1); }
    // The river, with lighter banks.
    for (let k = 0; k <= 1400; k++) { const u = k / 1400, p = river(u), w = 7 + Math.sin(u * 13) * 2 + u * 2; g.fillStyle = '#3a5a3a'; g.fillRect(Math.round(p.x - 1), Math.round(p.y - w - 1), 3, 2 * w + 3); }
    for (let k = 0; k <= 1400; k++) { const u = k / 1400, p = river(u), w = 7 + Math.sin(u * 13) * 2 + u * 2; g.fillStyle = '#17394a'; g.fillRect(Math.round(p.x - 1), Math.round(p.y - w), 3, 2 * w + 1); g.fillStyle = '#1f4a5a'; g.fillRect(Math.round(p.x - 1), Math.round(p.y - w * .5), 3, Math.round(w)); }
    // Cypress clumps seen from above: dark crowns with a lit rim and a shadow.
    for (let i = 0; i < 70; i++) {
      const x = hash(i + 50) * W, y = hash(i + 51) * H, r = 3 + hash(i + 52) * 4; let near = false;
      for (let k = 0; k <= 60 && !near; k++) { const p = river(k / 60); if (Math.hypot(p.x - x, p.y - y) < 16) near = true; }
      for (const n of NODES) if (Math.hypot(n.x - x, n.y - y) < 20) near = true;
      if (near || y > PANEL.y - 4) continue;
      for (const [col, dx, dy, dr] of [['#0a120e', 2, 3, 0], ['#15261c', 0, 0, 0], ['#223a28', -1, -1, -1.2], ['#2f4e32', -1.5, -1.5, -2.4]]) { const rr = r + dr; if (rr <= 0) continue; for (let yy = -rr; yy <= rr; yy++) { const hw = Math.round(Math.sqrt(rr * rr - yy * yy)); g.fillStyle = col; g.fillRect(Math.round(x + dx - hw), Math.round(y + dy + yy), hw * 2 + 1, 1); } }
      if (hash(i + 53) < .4) { g.fillStyle = '#6a7a8a'; g.fillRect(Math.round(x - 1), Math.round(y + r - 1), 1, 3); }
    }
    // Reed tufts along the banks.
    for (let i = 0; i < 90; i++) { const u = hash(i + 200), p = river(u), side = hash(i + 201) < .5 ? -1 : 1, w = 9 + u * 2, x = p.x + (hash(i + 202) - .5) * 6, y = p.y + side * (w + 2 + hash(i + 203) * 3); g.fillStyle = '#4a6a3a'; g.fillRect(Math.round(x), Math.round(y) - 2, 1, 3); g.fillRect(Math.round(x) + 2, Math.round(y) - 1, 1, 2); g.fillStyle = '#6a4a2a'; g.fillRect(Math.round(x), Math.round(y) - 3, 1, 1); }
    // Soft dark vignette.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const e = Math.min(x, W - x, y, H - y); if (e < 14 && ((x + y) & 1) === (e < 7 ? 0 : 1) || e < 4) { g.fillStyle = 'rgba(5,8,10,.55)'; g.fillRect(x, y, 1, 1); } }
    map = c; return c;
  }

  // ---------------------------------------------------------------- Iconos de cada lugar
  function icon(g, i, x, y, t, lit) {
    const O = '#120c18';
    const R = (px, py, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x + px), Math.round(y + py), w, h); };
    switch (i) {
      case 0: // The dock with its lantern.
        R(-11, -2, 22, 5, O); R(-10, -1, 20, 3, '#a56f38'); R(-10, -1, 20, 1, '#e0a862'); for (let k = -9; k < 10; k += 5) R(k, -1, 1, 3, '#6b4a30');
        R(-9, 3, 2, 4, '#4a2e1a'); R(7, 3, 2, 4, '#4a2e1a'); R(6, -10, 3, 8, O); R(7, -9, 1, 7, '#6b4a30'); R(5, -13, 5, 4, O); R(6, -12, 3, 2, lit ? '#ffcf5a' : '#5a4a3a');
        if (lit) { g.globalAlpha = .2 + Math.sin(t / 8) * .06; g.fillStyle = '#ffcf5a'; g.beginPath(); g.arc(x + 7.5, y - 11, 7, 0, 7); g.fill(); g.globalAlpha = 1; }
        break;
      case 1: // Tall reeds and a crab.
        for (let k = 0; k < 7; k++) { const bx = -8 + k * 2.6, h = 10 + (k % 3) * 3, sw = Math.round(Math.sin(t / 30 + k) * 1); R(bx, -h, 1, h + 3, '#3a5a2a'); R(bx + sw, -h - 3, 2, 4, '#6a4a2a'); }
        R(-3, 1, 7, 3, O); R(-2, 1, 5, 2, '#d9503a'); R(-4, 0, 2, 2, '#d9503a'); R(4, 0, 2, 2, '#d9503a');
        break;
      case 2: { // The mill, sails turning.
        R(-5, -12, 10, 16, O); R(-4, -11, 8, 15, '#3a3a44'); R(-4, -11, 2, 15, '#4e4e5a'); R(-1, -3, 2, 3, lit ? '#f2c46a' : '#2a2a30');
        R(-6, -15, 12, 4, O); R(-5, -14, 10, 2, '#6b4a30');
        const a0 = t * .03; for (let s = 0; s < 4; s++) { const a = a0 + s * Math.PI / 2; for (let d = 1; d < 11; d++) { R(Math.cos(a) * d, -12 + Math.sin(a) * d, 1, 1, '#c8b8a0'); if (d > 4) R(Math.cos(a) * d - Math.sin(a) * 2, -12 + Math.sin(a) * d + Math.cos(a) * 2, 1, 1, '#8a7a68'); } }
        break; }
      case 3: // A cave mouth in a mound, glowing fungi.
        for (let yy = 0; yy < 12; yy++) { const hw = Math.round(Math.sqrt(144 - (12 - yy) * (12 - yy))); R(-hw, yy - 10, hw * 2, 1, yy < 2 ? '#4a3a52' : '#2e2438'); }
        for (let yy = 0; yy < 7; yy++) { const hw = Math.round(Math.sqrt(36 - (6 - yy) * (6 - yy)) * .9); R(-hw, yy - 4, hw * 2, 1, '#07050a'); }
        R(-9, 0, 2, 2, lit ? '#62e4c8' : '#2a4a44'); R(8, -2, 2, 2, lit ? '#62e4c8' : '#2a4a44'); R(-7, -3, 1, 1, lit ? '#b8fff0' : '#2a4a44');
        break;
      case 4: // The dead cypress with the heron's nest.
        R(-1, -18, 3, 22, O); R(0, -17, 1, 21, '#4a3038'); R(-6, -12, 6, 1, '#4a3038'); R(1, -8, 7, 1, '#4a3038'); R(-5, -13, 1, 2, '#4a3038');
        R(-6, -22, 13, 5, O); R(-5, -21, 11, 3, '#6a4a3a'); R(-5, -21, 11, 1, '#8a6a4a');
        if (lit) { R(-1, -27, 2, 6, '#e9eef2'); R(0, -28, 4, 2, '#e9eef2'); R(4, -27, 4, 1, '#e2b63c'); }
        break;
    }
  }

  // ---------------------------------------------------------------- Dibujo
  let previews = {};
  function preview(i) {
    if (previews[i]) return previews[i];
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    MUNDO.drawBackground(g, 200 + i * 300, 30, ART.background(LEVELS[i].theme), 0, W, H, null);
    previews[i] = c; return c;
  }
  const walk = { from: 0, to: 0, k: 1 };
  function select(i) { walk.from = walk.to; walk.to = i; walk.k = 0; }
  function place(i) { walk.from = walk.to = i; walk.k = 1; }
  function update() { if (walk.k < 1) walk.k = Math.min(1, walk.k + .05); }
  function nilaPos() {
    const a = NODES[walk.from], b = NODES[walk.to], k = walk.k, e = k * k * (3 - 2 * k);
    return { x: a.x + (b.x - a.x) * e - 17, y: a.y + (b.y - a.y) * e - Math.abs(Math.sin(k * Math.PI * 4)) * 2 * (k < 1 ? 1 : 0), moving: k < 1, dir: b.x >= a.x ? 1 : -1 };
  }
  function draw(g, t, sel) {
    const d = Save.data; g.drawImage(build(), 0, 0);
    // River glints drifting downstream.
    for (let i = 0; i < 26; i++) { const u = ((hash(i) - t * .0006 * (1 + hash(i + 1))) % 1 + 1) % 1, p = river(u); g.fillStyle = hash(i + 2) < .5 ? '#6aa8b8' : '#b8e0e8'; g.fillRect(Math.round(p.x + (hash(i + 3) - .5) * 6), Math.round(p.y + (hash(i + 4) - .5) * 8), 2, 1); }
    // Paths: stepping stones between reached places.
    for (let i = 0; i < NODES.length - 1; i++) {
      const a = NODES[i], b = NODES[i + 1], open = i + 1 <= d.unlocked;
      for (let k = 1; k < 12; k++) { const u = k / 12, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * 8; g.fillStyle = '#0a0810'; g.fillRect(Math.round(x) - 1, Math.round(y), 3, 2); g.fillStyle = open ? '#c9b08a' : '#3a3a44'; g.fillRect(Math.round(x) - 1, Math.round(y), 2, 1); }
    }
    // Places.
    NODES.forEach((n, i) => {
      const locked = i > d.unlocked, cur = i === sel, done = d.best[i] !== undefined;
      g.fillStyle = 'rgba(5,4,10,.5)'; g.beginPath(); g.ellipse(n.x, n.y + 5, 13, 4, 0, 0, 7); g.fill();
      if (cur) { const r = 13 + Math.sin(t / 10) * 1.5; g.strokeStyle = '#f2c46a'; g.globalAlpha = .7; g.beginPath(); g.ellipse(n.x, n.y + 5, r, r * .35, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
      g.globalAlpha = locked ? .45 : 1; icon(g, i, n.x, n.y, t, !locked); g.globalAlpha = 1;
      // Number badge; a star once every cría of the place is home.
      const bx = n.x + 9, by = n.y - 24, all = d.totals[i] !== undefined && (d.pearls[i] || 0) >= d.totals[i];
      g.fillStyle = '#120c18'; g.fillRect(bx - 1, by - 1, 11, 12); g.fillStyle = locked ? '#3a3a44' : cur ? '#f2c46a' : done ? '#8aa84a' : '#c9b08a'; g.fillRect(bx, by, 9, 10); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(bx, by, 9, 1);
      ART.text(g, String(i + 1), bx + 5, by + 2, '#120c18', 'center');
      if (locked) { g.fillStyle = '#120c18'; g.fillRect(n.x - 3, n.y - 3, 7, 6); g.fillStyle = '#9fa8b0'; g.fillRect(n.x - 2, n.y - 2, 5, 4); g.fillRect(n.x - 2, n.y - 5, 1, 3); g.fillRect(n.x + 2, n.y - 5, 1, 3); g.fillRect(n.x - 1, n.y - 6, 3, 1); }
      if (all) { g.fillStyle = '#f2c46a'; g.fillRect(bx + 13, by + 1, 1, 5); g.fillRect(bx + 11, by + 3, 5, 1); g.fillRect(bx + 12, by + 2, 3, 3); }
    });
    // Nila and Bigotes on the map, walking between places.
    const np = nilaPos(), spr = np.moving ? ART.nila.run[Math.floor(t / 4) % 6] : ART.nila.idle[(t % 180) < 6 ? 1 : 0];
    g.save(); g.translate(Math.round(np.x), 0); if (np.dir < 0) g.scale(-1, 1); Player.drawCarry(g, -6, Math.round(np.y) - 20, spr, ART.fish.closed, np.moving ? 0 : (t >> 5) % 2); g.restore();
    // Header.
    g.fillStyle = 'rgba(8,6,14,.75)'; g.fillRect(0, 0, W, 17); g.fillStyle = '#e79b3f'; g.fillRect(0, 17, W, 1);
    ART.text(g, 'El pantano', 8, 5, '#f2c46a', 'left');
    const known = POWER_ORDER.filter(Game.has).length; let tot = 0, all = 0; for (const k in d.totals) { tot += d.pearls[k] || 0; all += d.totals[k]; }
    const crT = tot + '/' + all, trT = known + '/' + POWER_ORDER.length + ' trucos', crX = W - 6 - ART.textWidth(crT), trX = crX - 18 - ART.textWidth(trT);
    ART.text(g, crT, crX, 5, '#9ecbd8', 'left'); g.drawImage(ART.cria[(t >> 4) % 3], crX - 12, 4);
    ART.text(g, trT, trX, 5, '#e8fbff', 'left'); g.fillStyle = '#f2c46a'; g.fillRect(trX - 8, 6, 5, 5); g.fillStyle = '#120c18'; g.fillRect(trX - 7, 7, 3, 3); g.fillStyle = '#fff6d6'; g.fillRect(trX - 6, 8, 1, 1);
    // The card of the selected place.
    const lv = LEVELS[sel], locked = sel > d.unlocked, P = PANEL;
    g.fillStyle = '#120c18'; g.fillRect(P.x - 1, P.y - 1, P.w + 2, P.h + 2); g.fillStyle = '#1b2430'; g.fillRect(P.x, P.y, P.w, P.h); g.fillStyle = '#e79b3f'; g.fillRect(P.x, P.y, P.w, 1);
    const pv = { x: P.x + 3, y: P.y + 4, w: 60, h: 33 };
    g.drawImage(preview(sel), 0, 0, W, H, pv.x, pv.y, pv.w, pv.h); g.strokeStyle = '#3a4a5a'; g.strokeRect(pv.x - .5, pv.y - .5, pv.w + 1, pv.h + 1);
    if (locked) { g.fillStyle = 'rgba(8,6,14,.7)'; g.fillRect(pv.x, pv.y, pv.w, pv.h); }
    const tx = pv.x + pv.w + 8;
    ART.text(g, (sel + 1) + ' · ' + lv.name, tx, P.y + 5, locked ? '#6a7a8a' : '#fff6d6', 'left');
    if (locked) ART.text(g, lv.boss ? 'Aquí espera la Garza' : 'Aún no has llegado hasta aquí', tx, P.y + 17, '#6a7a8a', 'left');
    else {
      const got = d.pearls[sel] || 0, tt = d.totals[sel];
      g.drawImage(ART.cria[(t >> 4) % 3], tx, P.y + 16); ART.text(g, tt !== undefined ? got + '/' + tt : '-', tx + 12, P.y + 17, '#9ecbd8', 'left');
      if (d.best[sel] !== undefined) ART.text(g, Game.fmtTime(d.best[sel]), tx + 60, P.y + 17, '#9fc0cc', 'left');
      const pw = (lv.powers || []).filter(k => !Game.has(k)).length; if (pw) ART.text(g, pw + ' bocado' + (pw > 1 ? 's' : ''), tx + 100, P.y + 17, '#f2c46a', 'left');
      if ((t >> 5) % 2) ART.text(g, Touch.enabled ? 'Toca para jugar' : 'Z para jugar', P.x + P.w - 5, P.y + 29, '#fff6d6', 'right');
    }
    ART.text(g, Touch.enabled ? '' : '← → · Esc', tx, P.y + 29, '#5f7899', 'left');
  }
  function hit(pt) {
    for (let i = 0; i < NODES.length; i++) if (Math.hypot(pt.x - NODES[i].x, pt.y - NODES[i].y + 6) < 16) return i;
    if (pt.y >= PANEL.y) return 'panel';
    return -1;
  }
  return { draw, update, select, place, hit, NODES };
})();
