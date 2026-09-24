// GLUP — el mapa del pantano (selector de niveles y centro del viaje). El río serpentea desde el
// embarcadero hasta el ciprés muerto de la Garza, se mete bajo tierra pasada la cueva y vuelve a
// salir al pie del nido; cada nivel es un lugar con su icono y Nila camina entre ellos. Cada lugar
// dice cuántas crías hay en casa y, en la ficha de abajo, qué trucos piden las que siguen escondidas.
// El nido está rodeado por un muro de zarzas que sólo abren las crías (requiere: { crias }).
'use strict';
const Mapa = (() => {
  // One place per level, in river order; each with its icon.
  const NODES = [
    { x: 24, y: 108, icon: 'embarcadero' }, { x: 57, y: 72, icon: 'juncos' }, { x: 90, y: 108, icon: 'raices' },
    { x: 124, y: 72, icon: 'molino' }, { x: 158, y: 108, icon: 'muelle' }, { x: 192, y: 72, icon: 'turbera' },
    { x: 225, y: 106, icon: 'cueva' }, { x: 256, y: 74, icon: 'rio' }, { x: 292, y: 46, icon: 'nido' }];
  const PANEL = { x: 8, y: 132, w: 304, h: 42 };   // the screen is 320×180
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  // The river's centre line: a smooth curve through these points, weaving between the places.
  // From UNDER on it runs below ground (between the cave and the mouth of the underground river).
  const RIVER = [[-12, 121], [30, 120], [70, 118], [110, 121], [150, 119], [190, 121], [222, 120], [238, 112], [248, 98], [258, 84], [272, 72], [292, 58], [312, 42], [334, 28]];
  const UNDER = [0.47, 0.68];
  function river(u) {
    const n = RIVER.length - 1, f = Math.max(0, Math.min(n - 1e-6, u * n)), i = Math.floor(f), t = f - i;
    const p = k => RIVER[Math.max(0, Math.min(n, k))];
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const cr = (a, b, c, d) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    return { x: cr(p0[0], p1[0], p2[0], p3[0]), y: cr(p0[1], p1[1], p2[1], p3[1]) };
  }
  const under = u => u > UNDER[0] && u < UNDER[1];
  let map = null;
  function build() {
    if (map) return map;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    // Marsh ground: dithered greens that darken toward the edges, browner toward the peat bog.
    const greens = ['#0e1a16', '#13221c', '#182b22', '#1e3428', '#243d2c'], peat = ['#16120e', '#1c1612', '#231c16', '#2a2219', '#31281d'];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = hash(x * 7.3 + y * 131.1) * .6 + Math.sin(x / 17 + y / 23) * .2 + Math.sin(x / 7 - y / 11) * .1;
      const edge = Math.min(x, W - x, y * 1.4, (H - y) * 1.4) / 60, v = Math.max(0, Math.min(4, Math.floor((n + .4) * 3 * Math.min(1, edge + .35))));
      const bog = Math.hypot(x - 192, (y - 66) * 1.3) < 26 + hash(x + y * 3) * 6;
      g.fillStyle = (bog ? peat : greens)[v]; g.fillRect(x, y, 1, 1);
    }
    // The hill over the cave and the underground river: a dark rocky ridge.
    for (let y = 60; y < 128; y++) for (let x = 206; x < 280; x++) { const d = Math.hypot((x - 242) / 36, (y - 98) / 28); if (d < 1 && hash(x * 3.1 + y * 7.7) < 1.25 - d) { g.fillStyle = d < .6 ? '#2a2432' : '#221e2a'; g.fillRect(x, y, 1, 1); } }
    // Pools of standing water.
    for (let i = 0; i < 16; i++) { const cx = hash(i + 9) * W, cy = 22 + hash(i + 10) * 100, r = 3 + hash(i + 11) * 5; if (Math.abs(cy - river(cx / W).y) < 20) continue; for (let y = -r; y <= r; y++) { const hw = Math.round(Math.sqrt(r * r - y * y) * 1.6); g.fillStyle = '#16323a'; g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, 1); } g.fillStyle = '#2a5662'; g.fillRect(Math.round(cx - r), Math.round(cy - r + 1), Math.round(r), 1); }
    // The river, with lighter banks; under the hill only a dotted trace of it shows.
    const K = 1600;
    for (let k = 0; k <= K; k++) { const u = k / K, p = river(u), w = 6 + Math.sin(u * 13) * 1.5 + u * 2; if (under(u)) continue; g.fillStyle = '#3a5a3a'; g.fillRect(Math.round(p.x - 1), Math.round(p.y - w - 1), 3, 2 * w + 3); }
    for (let k = 0; k <= K; k++) { const u = k / K, p = river(u), w = 6 + Math.sin(u * 13) * 1.5 + u * 2; if (under(u)) { if (k % 14 < 5) { g.fillStyle = '#17394a'; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); } continue; } g.fillStyle = '#17394a'; g.fillRect(Math.round(p.x - 1), Math.round(p.y - w), 3, 2 * w + 1); g.fillStyle = '#1f4a5a'; g.fillRect(Math.round(p.x - 1), Math.round(p.y - w * .5), 3, Math.round(w)); }
    // Cypress clumps seen from above: dark crowns with a lit rim and a shadow.
    for (let i = 0; i < 80; i++) {
      const x = hash(i + 50) * W, y = 20 + hash(i + 51) * (H - 20), r = 3 + hash(i + 52) * 4; let near = false;
      for (let k = 0; k <= 80 && !near; k++) { const p = river(k / 80); if (Math.hypot(p.x - x, p.y - y) < 15) near = true; }
      for (const n of NODES) if (Math.hypot(n.x - x, n.y - 8 - y) < 22) near = true;
      if (near || y > PANEL.y - 4) continue;
      for (const [col, dx, dy, dr] of [['#0a120e', 2, 3, 0], ['#15261c', 0, 0, 0], ['#223a28', -1, -1, -1.2], ['#2f4e32', -1.5, -1.5, -2.4]]) { const rr = r + dr; if (rr <= 0) continue; for (let yy = -rr; yy <= rr; yy++) { const hw = Math.round(Math.sqrt(rr * rr - yy * yy)); g.fillStyle = col; g.fillRect(Math.round(x + dx - hw), Math.round(y + dy + yy), hw * 2 + 1, 1); } }
      if (hash(i + 53) < .4) { g.fillStyle = '#6a7a8a'; g.fillRect(Math.round(x - 1), Math.round(y + r - 1), 1, 3); }
    }
    // Reed tufts along the banks.
    for (let i = 0; i < 100; i++) { const u = hash(i + 200); if (under(u)) continue; const p = river(u), side = hash(i + 201) < .5 ? -1 : 1, w = 8 + u * 2, x = p.x + (hash(i + 202) - .5) * 6, y = p.y + side * (w + 2 + hash(i + 203) * 3); g.fillStyle = '#4a6a3a'; g.fillRect(Math.round(x), Math.round(y) - 2, 1, 3); g.fillRect(Math.round(x) + 2, Math.round(y) - 1, 1, 2); g.fillStyle = '#6a4a2a'; g.fillRect(Math.round(x), Math.round(y) - 3, 1, 1); }
    // Soft dark vignette.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const e = Math.min(x, W - x, y, H - y); if (e < 14 && ((x + y) & 1) === (e < 7 ? 0 : 1) || e < 4) { g.fillStyle = 'rgba(5,8,10,.55)'; g.fillRect(x, y, 1, 1); } }
    map = c; return c;
  }

  // ---------------------------------------------------------------- Iconos de cada lugar
  function icon(g, id, x, y, t, lit, open) {
    const O = '#120c18';
    const R = (px, py, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x + px), Math.round(y + py), w, h); };
    const glow = (px, py, r, c) => { g.globalAlpha = .2 + Math.sin(t / 8) * .06; g.fillStyle = c; g.beginPath(); g.arc(x + px, y + py, r, 0, 7); g.fill(); g.globalAlpha = 1; };
    switch (id) {
      case 'embarcadero': // The dock with its lantern.
        R(-11, -2, 22, 5, O); R(-10, -1, 20, 3, '#a56f38'); R(-10, -1, 20, 1, '#e0a862'); for (let k = -9; k < 10; k += 5) R(k, -1, 1, 3, '#6b4a30');
        R(-9, 3, 2, 4, '#4a2e1a'); R(7, 3, 2, 4, '#4a2e1a'); R(6, -10, 3, 8, O); R(7, -9, 1, 7, '#6b4a30'); R(5, -13, 5, 4, O); R(6, -12, 3, 2, lit ? '#ffcf5a' : '#5a4a3a');
        if (lit) glow(7.5, -11, 7, '#ffcf5a');
        break;
      case 'juncos': // Tall reeds and a crab.
        for (let k = 0; k < 7; k++) { const bx = -8 + k * 2.6, h = 10 + (k % 3) * 3, sw = Math.round(Math.sin(t / 30 + k) * 1); R(bx, -h, 1, h + 3, '#3a5a2a'); R(bx + sw, -h - 3, 2, 4, '#6a4a2a'); }
        R(-3, 1, 7, 3, O); R(-2, 1, 5, 2, '#d9503a'); R(-4, 0, 2, 2, '#d9503a'); R(4, 0, 2, 2, '#d9503a');
        if (lit && (t >> 4) % 3 === 0) R(5, -12, 1, 1, '#ffe36a');
        break;
      case 'raices': // A bald cypress on its arching roots, knees poking out of the mud.
        for (let yy = 0; yy < 9; yy++) { const hw = Math.round(Math.sqrt(1 - Math.pow((yy - 4) / 4.6, 2)) * 8); R(-hw, yy - 25, hw * 2, 1, yy < 2 ? '#3f6a3a' : yy < 5 ? '#2a4a2e' : '#1e3a24'); }
        R(-6, -24, 3, 1, '#5a8a4a'); R(-1, -16, 3, 15, O); R(0, -16, 1, 15, '#6b4a30'); R(1, -16, 1, 15, '#4a3226');
        for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const px = s * (1 + k), py = -4 + Math.round(k * k * .12) + (k > 3 ? 1 : 0); R(px - (s < 0 ? 1 : 0), py, 2, 2, k % 2 ? '#4a3226' : '#6b4a30'); }
        R(-9, -2, 2, 3, '#6b4a30'); R(-9, -3, 2, 1, O); R(7, -3, 2, 4, '#6b4a30'); R(7, -4, 2, 1, O); R(-12, 3, 24, 1, '#0a0810');
        break;
      case 'molino': { // The mill, sails turning.
        R(-5, -12, 10, 16, O); R(-4, -11, 8, 15, '#3a3a44'); R(-4, -11, 2, 15, '#4e4e5a'); R(-1, -3, 2, 3, lit ? '#f2c46a' : '#2a2a30');
        R(-6, -15, 12, 4, O); R(-5, -14, 10, 2, '#6b4a30');
        const a0 = t * .03; for (let s = 0; s < 4; s++) { const a = a0 + s * Math.PI / 2; for (let d = 1; d < 11; d++) { R(Math.cos(a) * d, -12 + Math.sin(a) * d, 1, 1, '#c8b8a0'); if (d > 4) R(Math.cos(a) * d - Math.sin(a) * 2, -12 + Math.sin(a) * d + Math.cos(a) * 2, 1, 1, '#8a7a68'); } }
        break; }
      case 'muelle': { // The fisherman's hut, his pier on stilts and the fishing boat at the end of it.
        R(-13, -9, 10, 10, O); R(-12, -8, 8, 8, '#7a5a3a'); R(-12, -8, 2, 8, '#9a7446'); R(-9, -5, 3, 3, lit ? '#ffcf5a' : '#3a2a20');
        for (let k = 0; k < 6; k++) R(-14 + k, -10 - k, 12 - k * 2, 1, k === 0 ? O : k % 2 ? '#a8402e' : '#8a3026');
        R(-4, -1, 14, 3, O); R(-3, -1, 12, 1, '#c89a5a'); R(-3, 0, 12, 1, '#8a6a3a'); for (const k of [-2, 3, 8]) R(k, 2, 1, 4, '#4a2e1a');
        if (lit) glow(-7.5, -3.5, 6, '#ffcf5a');
        const bob = Math.round(Math.sin(t / 20)); R(8, 3 + bob, 10, 3, O); R(9, 3 + bob, 8, 2, '#a8402e'); R(9, 3 + bob, 8, 1, '#d8704a'); R(14, -6 + bob, 1, 9, '#6b4a30'); g.fillStyle = 'rgba(220,230,240,.6)'; for (let k = 0; k < 6; k++) g.fillRect(Math.round(x + 15 + k), Math.round(y - 6 + bob + k * k * .2), 1, 1);
        break; }
      case 'turbera': // Stacked peat bricks and a bog pool that bubbles, cotton grass nodding.
        for (let row = 0; row < 3; row++) for (let k = 0; k < 3 - row; k++) { const bx = -12 + k * 5 + row * 2.5, by = -3 - row * 3; R(bx, by, 5, 3, O); R(bx + 1, by, 3, 2, row === 2 ? '#6a4a30' : '#4a3222'); R(bx + 1, by, 3, 1, '#7a5a3a'); }
        for (let yy = 0; yy < 5; yy++) { const hw = Math.round(Math.sqrt(1 - Math.pow((yy - 2) / 2.6, 2)) * 7); R(5 - hw, yy - 3, hw * 2, 1, yy === 0 ? '#3a4a3a' : '#1e2a26'); }
        { const b = (t >> 3) % 12; if (b < 6) R(4 + (b > 2 ? 2 : 0), -2 - (b % 3), 1, 1, '#8aa89a'); }
        for (const [px, h] of [[1, 7], [9, 9], [12, 6]]) { const sw = Math.round(Math.sin(t / 26 + px)); R(px, -h, 1, h - 2, '#5a6a3a'); R(px - 1 + sw, -h - 2, 3, 2, '#e8e8e0'); }
        break;
      case 'cueva': // A cave mouth in a mound, glowing fungi.
        for (let yy = 0; yy < 12; yy++) { const hw = Math.round(Math.sqrt(144 - (12 - yy) * (12 - yy))); R(-hw, yy - 10, hw * 2, 1, yy < 2 ? '#4a3a52' : '#2e2438'); }
        for (let yy = 0; yy < 7; yy++) { const hw = Math.round(Math.sqrt(36 - (6 - yy) * (6 - yy)) * .9); R(-hw, yy - 4, hw * 2, 1, '#07050a'); }
        R(-9, 0, 2, 2, lit ? '#62e4c8' : '#2a4a44'); R(8, -2, 2, 2, lit ? '#62e4c8' : '#2a4a44'); R(-7, -3, 1, 1, lit ? '#b8fff0' : '#2a4a44');
        break;
      case 'rio': { // Where the river comes out from under the hill: a rock arch, dark inside, water glinting.
        for (let yy = 0; yy < 14; yy++) { const hw = Math.round(Math.sqrt(1 - Math.pow((13 - yy) / 13.5, 2)) * 13); R(-hw, yy - 13, hw * 2, 1, yy < 3 ? '#5a5068' : yy < 8 ? '#40384e' : '#2e2838'); }
        for (let yy = 0; yy < 9; yy++) { const hw = Math.round(Math.sqrt(1 - Math.pow((8 - yy) / 8.5, 2)) * 7); R(-hw, yy - 8, hw * 2, 1, '#05040a'); }
        for (const k of [-4, 0, 3]) R(k, -8, 1, 2 + (k & 1), '#8a809a');
        R(-7, 0, 14, 2, '#17394a'); R(-5, 0, 10, 1, '#1f4a5a'); { const s = (t >> 2) % 14; R(-7 + s, 0, 2, 1, '#8fd9d0'); }
        if (lit) R(-2, -4, 1, 1, (t >> 4) % 2 ? '#62e4c8' : '#2a4a44');
        break; }
      case 'nido': // The dead cypress with the heron's nest; the enchanted wall of thorns while it is closed.
        R(-1, -18, 3, 22, O); R(0, -17, 1, 21, '#4a3038'); R(-6, -12, 6, 1, '#4a3038'); R(1, -8, 7, 1, '#4a3038'); R(-5, -13, 1, 2, '#4a3038');
        R(-6, -22, 13, 5, O); R(-5, -21, 11, 3, '#6a4a3a'); R(-5, -21, 11, 1, '#8a6a4a');
        if (lit) { R(-1, -27, 2, 6, '#e9eef2'); R(0, -28, 4, 2, '#e9eef2'); R(4, -27, 4, 1, '#e2b63c'); }
        thorns(g, x, y + 2, t, open);
        break;
    }
  }
  // The wall of thorns: a ring of dark brambles with red thorns; open, it withers apart in the middle.
  function thorns(g, x, y, t, open) {
    for (let k = 0; k < 44; k++) {
      const a = k / 44 * Math.PI * 2, gapped = open && Math.abs(Math.sin(a / 2 - Math.PI / 4)) > .92;
      if (gapped) continue;
      const rx = 15 + Math.sin(k * 1.7) * 1.5, ry = 6 + Math.cos(k * 2.3), px = Math.round(x + Math.cos(a) * rx), py = Math.round(y + Math.sin(a) * ry) - (Math.sin(a) < 0 ? 3 : 0);
      g.fillStyle = '#120c18'; g.fillRect(px - 1, py - 1, 3, 3); g.fillStyle = open ? '#4a4030' : k % 3 ? '#3a4a2a' : '#2a3a22'; g.fillRect(px, py, 2, 2);
      if (k % 4 === 0) { g.fillStyle = open ? '#6a5040' : '#c8384a'; g.fillRect(px + (k % 8 ? 2 : -1), py - 1, 1, 1); }
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
  const walk = { from: 0, to: 0, k: 1 }, shakeOf = {};
  function select(i) { walk.from = walk.to; walk.to = i; walk.k = 0; }
  function place(i) { walk.from = walk.to = i; walk.k = 1; }
  function update() { if (walk.k < 1) walk.k = Math.min(1, walk.k + .035); for (const k in shakeOf) if (--shakeOf[k] <= 0) delete shakeOf[k]; }
  const walking = () => walk.k < 1;
  function shake(i) { shakeOf[i] = 16; }
  // The path between two places: stepping stones on a gentle arc (crossing the river as they go).
  function pathPoint(a, b, u) { return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * 6 }; }
  function nilaPos() {
    const a = NODES[walk.from], b = NODES[walk.to], k = walk.k, e = k * k * (3 - 2 * k);
    const p = Math.abs(walk.to - walk.from) === 1 ? pathPoint(a, b, e) : { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
    return { x: p.x - 17, y: p.y - Math.abs(Math.sin(k * Math.PI * 5)) * 2 * (k < 1 ? 1 : 0), moving: k < 1, dir: b.x >= a.x ? 1 : -1 };
  }
  // Secrets still waiting in a place: for each trick, how many crías it hides (only while some crías are missing).
  function secretsOf(i) { const lv = LEVELS[i]; if (Save.criasGot(i) >= Save.criasTotal(i)) return []; return (lv.secretos || []).filter(s => s.crias > 0); }
  function draw(g, t, sel) {
    const reached = Save.reached(); g.drawImage(build(), 0, 0);
    // River glints drifting downstream (not under the hill).
    for (let i = 0; i < 30; i++) { const u = ((hash(i) - t * .0005 * (1 + hash(i + 1))) % 1 + 1) % 1; if (under(u)) continue; const p = river(u); g.fillStyle = hash(i + 2) < .5 ? '#6aa8b8' : '#b8e0e8'; g.fillRect(Math.round(p.x + (hash(i + 3) - .5) * 6), Math.round(p.y + (hash(i + 4) - .5) * 8), 2, 1); }
    // Paths: stepping stones between places, lit up to the furthest one reached.
    for (let i = 0; i < NODES.length - 1; i++) {
      const a = NODES[i], b = NODES[i + 1], open = i + 1 <= reached;
      for (let k = 2; k < 13; k++) { const p = pathPoint(a, b, k / 14); g.fillStyle = '#0a0810'; g.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 2); g.fillStyle = open ? '#c9b08a' : '#3a3a44'; g.fillRect(Math.round(p.x) - 1, Math.round(p.y), 2, 1); }
    }
    // Places.
    NODES.forEach((n, i) => {
      const lv = LEVELS[i]; if (!lv) return;
      const far = i > reached, cur = i === sel, done = Save.data.best[lv.id] !== undefined, wall = !!(lv.requiere && lv.requiere.crias), shut = wall && Save.locked(i);
      const sx = shakeOf[i] ? Math.round(Math.sin(shakeOf[i] * 1.7) * 2) : 0, x = n.x + sx;
      g.fillStyle = 'rgba(5,4,10,.5)'; g.beginPath(); g.ellipse(x, n.y + 5, 13, 4, 0, 0, 7); g.fill();
      if (cur) { const r = 13 + Math.sin(t / 10) * 1.5; g.strokeStyle = '#f2c46a'; g.globalAlpha = .7; g.beginPath(); g.ellipse(x, n.y + 5, r, r * .35, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
      g.globalAlpha = far ? .45 : 1; icon(g, n.icon, x, n.y, t, !far, !shut); g.globalAlpha = 1;
      // Number badge; a star once every cría of the place is home.
      const got = Save.criasGot(i), all = Save.criasTotal(i), bx = x + 9, by = n.y - 26;
      g.fillStyle = '#120c18'; g.fillRect(bx - 1, by - 1, 11, 12); g.fillStyle = far ? '#3a3a44' : cur ? '#f2c46a' : done ? '#8aa84a' : '#c9b08a'; g.fillRect(bx, by, 9, 10); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(bx, by, 9, 1);
      ART.text(g, String(i + 1), bx + 5, by + 2, '#120c18', 'center');
      if (far && !wall) { g.fillStyle = '#120c18'; g.fillRect(x - 3, n.y - 3, 7, 6); g.fillStyle = '#9fa8b0'; g.fillRect(x - 2, n.y - 2, 5, 4); g.fillRect(x - 2, n.y - 5, 1, 3); g.fillRect(x + 2, n.y - 5, 1, 3); g.fillRect(x - 1, n.y - 6, 3, 1); }
      if (got >= all && all > 0) { g.fillStyle = '#f2c46a'; g.fillRect(bx + 13, by + 1, 1, 5); g.fillRect(bx + 11, by + 3, 5, 1); g.fillRect(bx + 12, by + 2, 3, 3); }
      // Under the place: the crías home (or, at the wall, how many it asks for).
      if (!far || wall) {
        const txt = wall ? Save.gateCount(i) + '/' + lv.requiere.crias : got + '/' + all, tw = ART.textWidth(txt), lx = Math.round(x - tw / 2), ly = n.y + 8;
        g.fillStyle = 'rgba(8,6,14,.72)'; g.fillRect(lx - 2, ly - 1, tw + 3, 9);
        ART.text(g, txt, lx, ly, wall ? (shut ? '#f07080' : '#ffe36a') : got >= all ? '#ffe36a' : '#9ecbd8', 'left');
        // Crías that the tricks Bigotes knows now can reach: a little golden arrow calls Nila back.
        if (!wall && !far && secretsOf(i).some(s => Game.has(s.poder)) && got < all && (t >> 4) % 2) { g.fillStyle = '#120c18'; g.fillRect(x - 13, n.y - 12, 5, 6); g.fillStyle = '#ffe36a'; g.fillRect(x - 12, n.y - 11, 3, 1); g.fillRect(x - 12, n.y - 10, 3, 1); g.fillRect(x - 11, n.y - 9, 1, 2); }
      }
    });
    // Nila and Bigotes on the map, walking between places.
    const np = nilaPos(), spr = np.moving ? ART.nila.run[Math.floor(t / 4) % 6] : ART.nila.idle[(t % 180) < 6 ? 1 : 0];
    g.save(); g.translate(Math.round(np.x), 0); if (np.dir < 0) g.scale(-1, 1); Player.drawCarry(g, -6, Math.round(np.y) - 20, spr, ART.fish.closed, np.moving ? 0 : (t >> 5) % 2); g.restore();
    // Header.
    g.fillStyle = 'rgba(8,6,14,.75)'; g.fillRect(0, 0, W, 17); g.fillStyle = '#e79b3f'; g.fillRect(0, 17, W, 1);
    ART.title(g, 'El pantano', 8, 4, '#f2c46a', 'left');
    const known = POWER_ORDER.filter(Game.has).length, tot = Save.criasAll();
    const crT = tot.got + '/' + tot.all, trT = known + '/' + POWER_ORDER.length + ' trucos', crX = W - 6 - ART.textWidth(crT), trX = crX - 18 - ART.textWidth(trT);
    ART.text(g, crT, crX, 5, '#9ecbd8', 'left'); g.drawImage(ART.cria[(t >> 4) % 3], crX - 12, 4);
    ART.text(g, trT, trX, 5, '#e8fbff', 'left'); g.fillStyle = '#f2c46a'; g.fillRect(trX - 8, 6, 5, 5); g.fillStyle = '#120c18'; g.fillRect(trX - 7, 7, 3, 3); g.fillStyle = '#fff6d6'; g.fillRect(trX - 6, 8, 1, 1);
    drawPanel(g, t, sel, reached);
  }
  // The card of the selected place: preview, name, crías and best time, the teacher's trick, and the hidden crías.
  function drawPanel(g, t, sel, reached) {
    const lv = LEVELS[sel], far = sel > reached, P = PANEL, id = lv.id;
    g.fillStyle = '#120c18'; g.fillRect(P.x - 1, P.y - 1, P.w + 2, P.h + 2); g.fillStyle = '#1b2430'; g.fillRect(P.x, P.y, P.w, P.h); g.fillStyle = '#e79b3f'; g.fillRect(P.x, P.y, P.w, 1);
    const pv = { x: P.x + 3, y: P.y + 4, w: 60, h: 34 };
    g.drawImage(preview(sel), 0, 0, W, H, pv.x, pv.y, pv.w, pv.h); g.strokeStyle = '#3a4a5a'; g.strokeRect(pv.x - .5, pv.y - .5, pv.w + 1, pv.h + 1);
    if (far) { g.fillStyle = 'rgba(8,6,14,.7)'; g.fillRect(pv.x, pv.y, pv.w, pv.h); }
    const tx = pv.x + pv.w + 8, r1 = P.y + 4, r2 = P.y + 16, r3 = P.y + 28;
    ART.text(g, (sel + 1) + ' · ' + lv.name, tx, r1, far ? '#6a7a8a' : '#fff6d6', 'left');
    const wall = lv.requiere && lv.requiere.crias;
    if (wall) {
      const have = Save.gateCount(sel), need = lv.requiere.crias, shut = have < need;
      thornIcon(g, tx + 3, r2 + 4, shut);
      ART.text(g, shut ? 'Muro de zarzas: ' + have + '/' + need + ' crías' : 'Las crías han abierto el muro', tx + 12, r2, shut ? '#f07080' : '#ffe36a', 'left');
      ART.text(g, far ? 'Aún no has llegado hasta aquí' : shut ? 'Faltan ' + (need - have) + '. Vuelve a por las escondidas' : Save.data.best[id] !== undefined ? 'Mejor: ' + Game.fmtTime(Save.data.best[id]) : 'Aquí espera la Garza', tx, r3, '#9fc0cc', 'left');
      if (!far && !shut && (t >> 5) % 2) ART.text(g, Touch.enabled ? 'Toca' : 'Z', P.x + P.w - 5, r1, '#fff6d6', 'right');
      return;
    }
    if (far) { ART.text(g, 'Aún no has llegado hasta aquí', tx, r2, '#6a7a8a', 'left'); return; }
    // Row 2: crías home, best time, and the trick the place's teacher gives.
    const got = Save.criasGot(sel), all = Save.criasTotal(sel);
    g.drawImage(ART.cria[(t >> 4) % 3], tx, r2 - 1); ART.text(g, got + '/' + all, tx + 12, r2, got >= all ? '#ffe36a' : '#9ecbd8', 'left');
    if (Save.data.best[id] !== undefined) ART.text(g, Game.fmtTime(Save.data.best[id]), tx + 50, r2, '#9fc0cc', 'left');
    const m = lv.maestro;
    if (m && POWERS[m.poder]) { const have = Game.has(m.poder), mx = tx + 86; morsel(g, m.poder, mx, r2 - 1, have); ART.text(g, (Maestros.QUIEN[m.quien] ? Maestros.QUIEN[m.quien].name + ': ' : '') + POWERS[m.poder].name, mx + 11, r2, have ? '#e8fbff' : '#f2c46a', 'left'); }
    // Row 3: the crías still hidden and the tricks they need (grey until Bigotes has it).
    const sec = secretsOf(sel);
    if (sec.length) {
      ART.text(g, 'Escondidas:', tx, r3, '#9fc0cc', 'left'); let x = tx + ART.textWidth('Escondidas:') + 5;
      for (const s of sec) { morsel(g, s.poder, x, r3 - 1, Game.has(s.poder)); ART.text(g, '×' + s.crias, x + 10, r3, Game.has(s.poder) ? '#ffe36a' : '#5f7899', 'left'); x += 12 + ART.textWidth('×' + s.crias) + 4; }
    } else if (got >= all) ART.text(g, '¡Todas en casa!', tx, r3, '#ffe36a', 'left');
    if ((t >> 5) % 2) ART.text(g, Touch.enabled ? 'Toca para jugar' : 'Z para jugar', P.x + P.w - 5, r3, '#fff6d6', 'right');
  }
  // A trick's morsel as a small icon, in colour once learned, a grey silhouette before.
  function morsel(g, pw, x, y, have) {
    const spr = ART.morsels[pw]; if (!spr) return;
    if (have) g.drawImage(spr, x, y); else { g.globalAlpha = .8; g.drawImage(ART.tint(spr, '#4a5a70'), x, y); g.globalAlpha = 1; }
  }
  function thornIcon(g, x, y, shut) {
    for (let k = 0; k < 7; k++) { const px = x - 4 + k + Math.round(Math.sin(k * 2) * .6), py = y - 2 + Math.round(Math.sin(k * 1.3) * 2); g.fillStyle = '#120c18'; g.fillRect(px - 1, py - 1, 3, 3); g.fillStyle = shut ? '#3a4a2a' : '#4a4030'; g.fillRect(px, py, 2, 2); if (k % 2) { g.fillStyle = shut ? '#c8384a' : '#6a5040'; g.fillRect(px + 1, py - 1, 1, 1); } }
  }
  function hit(pt) {
    for (let i = 0; i < NODES.length; i++) if (Math.hypot(pt.x - NODES[i].x, pt.y - NODES[i].y + 8) < 16) return i;
    if (pt.y >= PANEL.y) return 'panel';
    return -1;
  }
  return { draw, update, select, place, hit, walking, shake, NODES };
})();
