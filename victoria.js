// GLUP — la victoria. Dos tiempos, como el final de acto de Sonic y el de Rayman:
//  1. En el nivel: la música se corta y suena la fanfarria, la cámara se acerca, Nila salta a la
//     barca dando una vuelta, Bigotes asoma feliz, las crías rescatadas saltan del agua alrededor
//     en arcos y chapuzones, llueve confeti de gotas y luciérnagas, y la barca se va con estela
//     mientras Nila saluda.
//  2. El recuento: «¡NIVEL SUPERADO!» cae letra a letra, una cinta con el nombre del nivel, y las
//     líneas cuentan con tic-tic: crías (cada una salta a su hueco), tiempo contra el par, trucos
//     aprendidos (los bocados se estampan) y los puntos; al final cae el sello con la medalla.
//     Nila baila a un lado con Bigotes. Una pulsación adelanta la cuenta y otra sigue.
'use strict';
const Victoria = (() => {
  const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
  const outBack = k => { if (k >= 1) return 1; const c = 1.8; k -= 1; return 1 + (c + 1) * k * k * k + c * k * k; };
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const CONFETTI = ['#f7c843', '#fff4a8', '#8fd9d0', '#e8fbff', '#d8f58a', '#f07080', '#dc8a2c'];
  const V = { run: null, clear: null };
  // A leaping cría, bigger and outlined so it reads against the water: a Bigotes in miniature.
  let fry = null;
  function frySprites() {
    if (fry) return fry;
    const C = { o: '#1d1826', B: '#b0a458', b: '#6e6238', C: '#f4e1a4', W: '#ffffff', E: '#1d1826', F: '#e0a45a' };
    fry = [ART.sprite(['.....ooo...', 'o..ooBBBoo.', 'oooBBBBBWEo', 'obBbCCCCCCo', 'o.ooCCCCFFo', '.....oooF..'], C, 'fry0'),
      ART.sprite(['.....ooo...', '...ooBBBoo.', 'oooBBBBBWEo', 'obBbCCCCCCo', 'oooooCCCFFo', '.....oooF..'], C, 'fry1')];
    return fry;
  }

  // ================================================================ 1. En el nivel
  const LEAP0 = 8, LAND = 38, CRIA0 = 46, GAP = 6;
  function surfaceOf(b) {
    for (let y = b.y - 12; y < b.y + 40; y++) if (waterAt(b.x + 16, y)) return (y >> 4) * 16 + 3;
    return b.y + 3;
  }
  function start(boat) {
    const p = Player, n = Math.min(L.pearls, 12);
    const sail = 118 + n * 4;
    V.run = { t: 0, boat, x0: p.x, y0: p.y, bx0: boat.x, by0: boat.y, surf: surfaceOf(boat), n, sail, end: sail + 105, crias: [], conf: [], sailV: 0, dip: 0, dipV: 0, pop: 0, popV: 0,
      camX: Cam.x, camY: Cam.y, zoom: 1, fx: null, fy: null, flash: 0, finished: false, nx: p.x, ny: p.y, time: L.time };
    Sound.stopMusic(); Sound.play('fanfare'); Sound.duck(false);
    Game.word('¡A LA BARCA!', p.x + 5, p.y - 12, '#ffe36a', true);
    Input.rumble(160, .5, .5);
    return V.run;
  }
  function active() { return Player.win && !!V.run; }

  // A cría leaps out of the water somewhere around the boat; if that spot is dry land, it tries the other side.
  function launchCria(r, i) {
    const b = r.boat, cx = b.x + 16;
    let side = i % 2 ? 1 : -1, x = cx;
    for (let k = 0; k < 6; k++) { const tx = cx + side * R(20, 54); if (waterAt(tx, r.surf + 4)) { x = tx; break; } side = -side; }
    const c = { x, y: r.surf + 2, vx: -side * R(.5, 1.25), vy: -R(3.4, 4.6), air: true, wait: 0, hops: 0, i, ph: R(0, 6) };
    r.crias.push(c); splash(r, x, 1);
    Sound.play('bloop', i);
    if (i === r.n - 1) Game.word(r.n > 1 ? '¡' + r.n + ' CRÍAS!' : '¡UNA CRÍA!', cx, r.surf - 36, '#e8fbff', true);
  }
  function splash(r, x, k) {
    spawnParts(Math.round(6 + k * 6), x, r.surf, { color: ['#8fd9d0', '#c8f2ea', '#e8fbff'], angle: -Math.PI / 2, spread: .9, speed: [.6, 1.6 + k * 1.4], life: [12, 26], g: .14, kind: 'spray' });
    L.parts.push({ x, y: r.surf + 1, vx: 0, vy: 0, life: 16, color: '#c8f2ea', size: 1, g: 0, kind: 'ripple' });
  }
  function confetti(r, x, y, n, up) {
    for (let i = 0; i < n; i++) r.conf.push({ x: x + R(-6, 6), y: y + R(-4, 4), vx: up ? R(-2.2, 2.2) : R(-.3, .3), vy: up ? -R(1.8, 4.6) : R(.2, .6), rot: R(0, 6), vr: R(-.3, .3), col: pick(CONFETTI), life: R(90, 160), drop: Math.random() < .3 });
  }

  function update() {
    const r = V.run || start(L.exit || { x: Player.x - 10, y: Player.y + Player.h, t: 0 });
    const p = Player, b = r.boat, t = ++r.t;
    Game.winT = t; L.time = r.time;   // the clock stops at the boat
    // ---- Nila: crouch, spinning leap, landing, dance in the boat.
    if (t === LEAP0) { Sound.play('whoosh'); spawnParts(8, r.x0 + 5, r.y0 + 18, { color: ['#c9b08a', '#a08a6a', '#e0c8a0'], angle: -Math.PI / 2, spread: 1.3, speed: [.4, 1.6], life: [10, 20], g: .06 }); }
    if (t === LAND) {
      Sound.play('splash'); Sound.play('land', 1); Cam.shake(3, 10); r.dipV = 3.2; r.pop = -7; r.popV = 0; r.flash = 6; Input.rumble(200, .8, .6);
      splash(r, b.x + 2, 1.2); splash(r, b.x + 30, 1.2);
      confetti(r, b.x + 16, b.y - 16, 46, true);
      Game.word('¡YUPI!', b.x + 16, b.y - 40, '#fff6d6', true);
    }
    if (t > LAND) { r.dipV += -r.dip * .22; r.dipV *= .8; r.dip += r.dipV; r.popV += -r.pop * .25; r.popV *= .78; r.pop += r.popV; }
    b.y = r.by0 + Math.round(r.dip);
    const bob = Math.round(Math.sin(b.t / 22) * 1.5), seatX = b.x + 10, seatY = b.y - 14 + bob;
    if (t < LEAP0) { r.nx = r.x0; r.ny = r.y0; }
    else if (t < LAND) {
      const k = (t - LEAP0) / (LAND - LEAP0);
      r.nx = r.x0 + (seatX - r.x0) * ease(k); r.ny = r.y0 + (seatY - r.y0) * k - Math.sin(k * Math.PI) * 26;
      if (t % 2 === 0) L.parts.push({ x: r.nx + 5, y: r.ny + 9, vx: 0, vy: 0, life: 14, color: pick(['#fff4a8', '#f7c843', '#e8fbff']), size: 1, g: -.02, kind: 'dot' });
    } else { r.nx = seatX; r.ny = seatY; }
    p.x = r.nx; p.y = r.ny;
    // ---- The crías burst out of the water one after another, then hop along after the boat.
    for (let i = 0; i < r.n; i++) if (t === CRIA0 + i * GAP) launchCria(r, i);
    for (const c of r.crias) {
      if (c.air) {
        c.vy += .17; c.x += c.vx; c.y += c.vy;
        if (c.vy > 0 && c.y >= r.surf + 1) { c.air = false; c.y = r.surf + 2; c.wait = R(8, 26); splash(r, c.x, .5); if (Math.random() < .5) Sound.play('blub'); }
        if (c.vy < 0 && c.vy > -.3 && Math.random() < .6) { L.parts.push({ x: c.x, y: c.y - 6, vx: 0, vy: -.4, life: 30, color: '#f05070', size: 1, g: 0, kind: 'dot' }); }
      } else {
        c.x += r.sailV * .92 + Math.sin((t + c.ph * 20) / 9) * .15;
        if (--c.wait <= 0 && (c.hops < 2 || t > r.sail)) {
          let target = t > r.sail ? b.x - 8 - (c.i % 6) * 9 : b.x + 16 + (c.x < b.x + 16 ? -1 : 1) * R(18, 46);
          if (!waterAt(target, r.surf + 4)) target = 2 * (b.x + 16) - target;
          c.hops++; c.air = true; c.vy = -R(2.4, 3.6); c.vx = Math.max(-1.4, Math.min(1.4 + r.sailV, (target - c.x) / 36 + r.sailV)); splash(r, c.x, .4);
        }
      }
    }
    // ---- Confetti of drops and petals, fireflies around the boat.
    if (t > LAND && t < r.sail + 50 && t % 3 === 0) confetti(r, Cam.x + R(0, W), Cam.y - 4, 1, false);
    if (t > LAND && t % 4 === 0) L.parts.push({ x: b.x + R(-30, 60), y: b.y - R(10, 50), vx: R(-.15, .15), vy: R(-.2, 0), life: 120, color: '#f2f5a0', size: 1, g: 0, kind: 'fly', ph: R(0, 6) });
    for (let i = r.conf.length - 1; i >= 0; i--) { const q = r.conf[i]; q.vy = Math.min(q.vy + .07, q.drop ? 2.4 : .9); q.vx *= .97; q.x += q.vx + Math.sin(q.rot) * .3; q.y += q.vy; q.rot += q.vr; if (--q.life <= 0 || q.y > r.surf + 2) { if (q.y > r.surf && q.drop && waterAt(q.x, r.surf + 4)) L.parts.push({ x: q.x, y: r.surf + 1, vx: 0, vy: 0, life: 10, color: '#c8f2ea', size: 1, g: 0, kind: 'ripple' }); r.conf.splice(i, 1); } }
    // ---- Sail away with a wake.
    if (t === r.sail) { Sound.play('whoosh'); Game.word('¡HASTA LUEGO!', b.x + 16, b.y - 40, '#ffe36a', false); }
    if (t > r.sail) {
      r.sailV = Math.min(1.7, r.sailV + .03); b.x += r.sailV; p.x = r.nx = b.x + 10;
      if (t % 3 === 0) { L.parts.push({ x: b.x + 4, y: r.surf + 1, vx: 0, vy: 0, life: 18, color: '#c8f2ea', size: 1, g: 0, kind: 'ripple' }); spawnParts(2, b.x + 1, r.surf, { color: ['#8fd9d0', '#e8fbff'], angle: -Math.PI / 2 - .7, spread: .4, speed: [.5, 1.6], life: [10, 18], g: .12, kind: 'spray' }); }
      if (t % 5 === 0) spawnParts(2, b.x + 31, r.surf, { color: ['#c8f2ea', '#ffffff'], angle: -Math.PI / 2 + .6, spread: .4, speed: [.5, 1.2], life: [8, 14], g: .12, kind: 'spray' });
    }
    // ---- Camera: close in on the boat, then hold still and let it sail out of frame.
    const zt = Game.still ? 1.2 : t < 40 ? 1 + .45 * ease(t / 40) : t < r.sail ? 1.45 : 1.45 - .3 * ease((t - r.sail) / 60);
    r.zoom = zt;
    if (t <= r.sail) {
      r.camX += (Math.max(0, Math.min(L.w * TS - W, b.x + 16 - W / 2)) - r.camX) * .12;
      r.camY += (Math.max(0, Math.min(L.h * TS - H, b.y - 24 - H / 2 + 20)) - r.camY) * .12;
      r.fwx = b.x + 16; r.fwy = b.y - 14;
    }
    Cam.x = r.camX; Cam.y = r.camY; Cam.zoom = r.zoom;
    const hw = W / (2 * r.zoom), hh = H / (2 * r.zoom);
    Cam.fx = Math.max(hw, Math.min(W - hw, r.fwx - Cam.x)); Cam.fy = Math.max(hh, Math.min(H - hh, r.fwy - Cam.y));
    if (r.flash > 0) r.flash--;
    // ---- Off to the tally. A press after the landing hurries it along.
    const press = Input.pressed.jump || Input.pressed.fish || Input.pressed.confirm || Game.tapped;
    if (!r.finished && (t >= r.end || (t > LAND + 10 && press))) { r.finished = true; Game.tapped = false; Game.finishLevel(); }
  }

  // Nila with Bigotes at (x, y) (hitbox corner, screen); optional spin, squash, a waving arm.
  function drawNila(g, x, y, o) {
    const N = ART.nila, cx = x + 5, pivY = o.rot ? y + 9 : y + 18;
    g.save(); g.translate(cx, pivY); if (o.rot) g.rotate(o.rot); g.scale(o.sx || 1, o.sy || 1); g.translate(-cx, -pivY);
    Player.carryLook = { mood: o.mood }; Player.drawCarry(g, x, y, o.spr || N.win, o.fish || ART.fish.full, o.bob || 0); Player.carryLook = null;
    if (o.wave !== undefined) drawArm(g, x - 2, y + 8, o.wave);
    g.restore();
  }
  // The free arm raised and waving: a yellow sleeve with its outline and a little hand.
  function drawArm(g, sx, sy, a) {
    const n = 8, pts = []; for (let k = 0; k <= n; k++) pts.push([Math.round(sx + Math.cos(a) * k), Math.round(sy + Math.sin(a) * k)]);
    g.fillStyle = '#3b2335'; for (const [px, py] of pts) g.fillRect(px - 1, py - 1, 3, 3);
    g.fillStyle = '#f7c843'; for (const [px, py] of pts.slice(0, n - 1)) g.fillRect(px, py, 1, 1);
    const [hx, hy] = pts[n]; g.fillStyle = '#3b2335'; g.fillRect(hx - 2, hy - 2, 4, 4); g.fillStyle = '#fcdcbc'; g.fillRect(hx - 1, hy - 1, 2, 2); g.fillStyle = '#fff4e0'; g.fillRect(hx - 1, hy - 1, 1, 1);
  }
  function drawWorld(g) {
    const r = V.run; if (!r) return;
    const t = r.t, b = r.boat, N = ART.nila;
    // Crías that are under water show only a head bump and bubbles.
    for (const c of r.crias) if (!c.air) { g.fillStyle = '#665a36'; const x = Math.round(c.x - Cam.x), y = Math.round(r.surf - Cam.y); if ((t + c.i * 7) % 20 < 14) g.fillRect(x - 1, y, 3, 1); }
    let o;
    if (t < LEAP0) { const k = t / LEAP0; o = { spr: N.idle[0], sy: 1 - .22 * k, sx: 1 + .16 * k, mood: 'shock' }; }
    else if (t < LAND) { const k = (t - LEAP0) / (LAND - LEAP0); o = { spr: k < .5 ? N.jump : N.fall, rot: Game.still ? 0 : ease(k) * Math.PI * 2, sx: k < .2 ? .88 : 1, sy: k < .2 ? 1.14 : 1, mood: 'shock', fish: ART.fish.open }; }
    else {
      const d = t - LAND, squash = d < 14 ? Math.exp(-d / 4) * Math.cos(d / 1.8) : 0, sail = t > r.sail;
      const hop = !sail && d > 30 && (d % 48) < 14 ? Math.sin((d % 48) / 14 * Math.PI) * 5 : 0;
      o = { spr: hop > 0 ? N.jump : (t >> 3) % 2 ? N.win : N.idle[0], sx: 1 + squash * .3, sy: 1 - squash * .3, mood: 'happy', fish: (d % 48) < 16 && d > 4 ? ART.fish.open : ART.fish.full, bob: Math.round(r.pop), hopY: hop };
      if (sail || d > 20) o.wave = -Math.PI / 2 - .55 + Math.sin(t * .3) * .4;
    }
    drawNila(g, Math.round(r.nx - Cam.x), Math.round(r.ny - Cam.y - (o.hopY || 0)), o);
    // The front of the hull over her boots, so she stands inside the boat.
    const bob = Math.round(Math.sin(b.t / 22) * 1.5), bx = Math.round(b.x - Cam.x), by = Math.round(b.y - Cam.y - 7 + bob);
    if (t >= LAND - 2) g.drawImage(ART.boat, 0, 6, 32, 6, bx, by + 6, 32, 6);
    // Leaping crías, bent along their arc.
    for (const c of r.crias) if (c.air) {
      const spr = frySprites()[((t >> 2) + c.i) % 2];
      g.save(); g.translate(Math.round(c.x - Cam.x), Math.round(c.y - Cam.y)); g.scale(c.vx < 0 ? -1 : 1, 1); g.rotate(Math.atan2(c.vy, Math.abs(c.vx) + .01) * .8); g.drawImage(spr, -6, -3); g.restore();
    }
    // Confetti: flat petals that flutter and turn, and falling drops.
    for (const q of r.conf) {
      const x = Math.round(q.x - Cam.x), y = Math.round(q.y - Cam.y); g.fillStyle = q.col; g.globalAlpha = Math.min(1, q.life / 20);
      if (q.drop) { g.fillStyle = '#c8f2ea'; g.fillRect(x, y, 1, 2); } else { const w = Math.abs(Math.cos(q.rot)) > .5 ? 2 : 1; g.fillRect(x, y, w, 3 - w); }
      g.globalAlpha = 1;
    }
    if (r.flash > 0 && !Game.still) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = r.flash / 6 * .45; g.fillStyle = '#fffbe0'; g.fillRect(0, 0, W, H); g.restore(); }
  }

  // ================================================================ 2. El recuento
  // Big letters in the logo's skin: a pixel glyph blown up 3×, outlined, with a yellow-to-olive fill and a dark extrusion.
  const FILL = ['#fffbe6', '#fff3b8', '#f2e08a', '#dccd68', '#bdb452', '#9ca044', '#7c883a'];
  const bigCache = new Map();
  function bigGlyph(ch, S = 3) {
    const k = ch + S; if (bigCache.has(k)) return bigCache.get(k);
    const src = ART.glyph(ch, '#000'); if (!src) return null;
    let d; try { d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data; } catch (e) { d = new Uint8ClampedArray(src.width * src.height * 4); }
    const gw = src.width, gh = src.height, on = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && d[(y * gw + x) * 4 + 3] > 0;
    const P = 2, EX = 3, w = gw * S + P * 2, h = gh * S + P * 2 + EX, c = ART.canvas(w, h), g = c.getContext('2d');
    const at = (x, y) => on(Math.floor((x - P) / S), Math.floor((y - P) / S)) && x >= P && y >= P;
    const solid = (x, y) => { if (at(x, y)) return 1; for (let e = 1; e <= EX; e++) if (at(x, y - e)) return 2; return 0; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = solid(x, y);
      if (s === 1) {
        const f = (y - P) / (gh * S) * (FILL.length - 1), i = Math.min(FILL.length - 2, Math.max(0, f | 0)), fr = f - i;
        let col = fr > .66 || (fr > .33 && ((x + y) & 1)) ? FILL[i + 1] : FILL[i];
        if (!at(x, y - 1)) col = '#ffffff'; else if (!at(x + 1, y) || !at(x, y + 1)) col = '#5f6e30';
        g.fillStyle = col; g.fillRect(x, y, 1, 1);
      } else if (s === 2) { g.fillStyle = solid(x, y - 2) === 1 || at(x, y - 1) ? '#48522a' : '#2f3820'; g.fillRect(x, y, 1, 1); }
      else { let near = false; for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) if (solid(x + dx, y + dy)) near = true; if (near) { g.fillStyle = '#1a1420'; g.fillRect(x, y, 1, 1); } }
    }
    const out = { c, w, h, adv: gw * S + S }; bigCache.set(k, out); return out;
  }
  const TITLE = '¡NIVEL SUPERADO!';
  function titleLayout() {
    const items = []; let x = 0, n = 0;
    for (const ch of TITLE) { if (ch === ' ') { x += 8; continue; } const b = bigGlyph(ch); if (!b) continue; items.push({ ch, b, x, i: n++ }); x += b.adv; }
    const off = Math.round((W - (x - 3)) / 2); for (const it of items) it.x += off;
    return items;
  }
  const PAR = [210, 190, 200, 170, 150];
  const MEDALS = {
    bronce: { name: 'BRONCE', stars: 1, rim: '#7a4424', face: '#c07a44', hi: '#f0b27a', lo: '#8e5230' },
    plata: { name: 'PLATA', stars: 2, rim: '#5a6474', face: '#b8c4d0', hi: '#f2f6fa', lo: '#7d8a9a' },
    oro: { name: 'ORO', stars: 3, rim: '#7a5a14', face: '#f2c43a', hi: '#fff4a8', lo: '#c08a1c' },
    perfecto: { name: '¡PERFECTO!', stars: 3, rim: '#6a2a6a', face: '#f2c43a', hi: '#ffffff', lo: '#c08a1c', rainbow: true } };

  const LT0 = 6, LGAP = 3, CGAP = 6, TGAP = 14;
  function startClear() {
    const s = Game.clearStats || { name: '', pearls: 0, total: 0, secs: 0, last: false };
    const par = s.par || PAR[Game.level] || 200, fast = s.secs <= par, ratio = s.total ? s.pearls / s.total : 1;
    const rank = ratio >= 1 && fast ? 'perfecto' : ratio >= 1 || (ratio >= .75 && fast) ? 'oro' : ratio >= .5 ? 'plata' : 'bronce';
    const tricks = s.tricks || [], boss = !!s.boss;
    const items = titleLayout(), titleEnd = LT0 + items.length * LGAP + 8;
    const T = { banner: titleEnd, crias0: titleEnd + 16 };
    T.criasEnd = T.crias0 + Math.max(1, s.pearls) * CGAP + 8;
    T.time0 = T.criasEnd + 2; T.timeEnd = T.time0 + 30; T.bonus = T.timeEnd + 4;
    T.tricks0 = T.bonus + 12; T.tricksEnd = T.tricks0 + Math.max(1, boss ? 1 : tricks.length) * TGAP + 4;
    T.total = T.tricksEnd + 2; T.rank = T.total + 30; T.end = T.rank + 40;
    const pts = { crias: s.pearls * 100, time: fast ? (par - s.secs) * 10 : 0, tricks: tricks.length * 500, all: s.total && s.pearls >= s.total ? 1000 : 0, boss: boss ? 5000 : 0 };
    V.clear = { s, par, fast, rank, tricks, boss, items, T, pts, target: 0, shown: 0, shake: 0, parts: [], rings: [], jig: {}, flash: 0, record: s.prevBest !== undefined && s.prevBest !== null && s.secs < s.prevBest, skipped: false, doneT: -1 };
  }
  function scoreAt(c, t) {
    const T = c.T, s = c.s; let v = 0;
    v += Math.min(s.pearls, Math.max(0, Math.floor((t - T.crias0) / CGAP) + 1)) * 100 * (t >= T.crias0 ? 1 : 0);
    if (t >= T.bonus) v += c.pts.time;
    if (t >= T.tricks0) v += Math.min(c.tricks.length, Math.floor((t - T.tricks0) / TGAP) + 1) * 500;
    if (t >= T.total) v += c.pts.all + c.pts.boss;
    return v;
  }
  function burst(c, x, y, n, cols, spd, up, kind) { for (let i = 0; i < n; i++) { const a = up ? -Math.PI / 2 + R(-.9, .9) : R(0, Math.PI * 2), v = spd * R(.4, 1.2); c.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: R(16, 34), max: 34, col: pick(cols), g: kind === 'spark' ? .02 : .12, kind: kind || 'dot', rot: R(0, 6) }); } }
  const medalPos = { x: 280, y: 92 };
  const ROW = { x0: 88, x1: 238, crias: 60, time: 86, tricks: 108, total: 134 };

  function updateClear() {
    if (!V.clear) startClear();
    const c = V.clear; if (Game.frozen) return;
    Game.clearT++;
    const t = Game.clearT, T = c.T, s = c.s;
    // Title letters slam in.
    for (const it of c.items) if (t === LT0 + it.i * LGAP + 7) { Sound.play('slam', it.i); c.shake = Math.max(c.shake, 3); c.jig[it.i] = t; burst(c, it.x + it.b.w / 2, 30, 5, ['#fff3b8', '#dccd68', '#c9b08a'], 1.4, true); }
    if (t === T.banner - 4) { Sound.play('clear'); c.flash = 5; c.hopT = t; burst(c, W / 2, 20, 20, CONFETTI, 2.6, false, 'conf'); }
    if (t === T.banner + 2) Sound.play('whoosh');
    // Crías hop into their slots.
    for (let i = 0; i < s.pearls; i++) if (t === T.crias0 + i * CGAP) { Sound.play('tick', i); const q = slotPos(c, i); burst(c, q.x + 4, q.y + 4, 6, ['#e8fbff', '#8fd9d0', '#ffffff'], 1.4, false, 'spark'); }
    if (s.total && s.pearls >= s.total && t === T.criasEnd - 4) { Sound.play('stamp', 0); c.shake = 4; burst(c, ROW.x1 - 10, ROW.crias + 3, 14, CONFETTI, 2, false, 'conf'); }
    // The clock runs up with ticks.
    if (t >= T.time0 && t < T.timeEnd && (t - T.time0) % 3 === 0) Sound.play('tick', 4 + ((t - T.time0) / 3 | 0) % 5);
    if (t === T.bonus) { if (c.fast) { Sound.play('kaching'); burst(c, ROW.x1 - 16, ROW.time + 12, 12, ['#ffe36a', '#fff6d6'], 1.8, true, 'spark'); } else Sound.play('thud'); if (c.record) c.shake = 3; }
    // Morsels stamp in.
    const nt = c.boss ? 1 : c.tricks.length;
    for (let i = 0; i < nt; i++) if (t === T.tricks0 + i * TGAP + 6) { Sound.play('slam', 8 + i); c.shake = 4; const x = trickX(i) + 8; burst(c, x, ROW.tricks + 12, 10, ['#ffe36a', '#fff6d6', '#e79b3f'], 1.8, false, 'spark'); c.rings.push({ x, y: ROW.tricks + 8, t: 0 }); }
    // The score rolls up to whatever has been revealed.
    c.target = scoreAt(c, t);
    if (c.shown < c.target) { c.shown = Math.min(c.target, c.shown + Math.max(9, Math.ceil((c.target - c.shown) * .1))); if (t % 2 === 0) Sound.play('tick', 9); }
    // The medal stamp.
    if (t === T.rank) landMedal(c);
    for (let i = 0; i < MEDALS[c.rank].stars; i++) if (t === T.rank + 10 + i * 8) { Sound.play('kaching'); burst(c, medalPos.x + (i - (MEDALS[c.rank].stars - 1) / 2) * 13, medalPos.y - 32, 8, ['#ffe36a', '#ffffff'], 1.6, false, 'spark'); }
    if (t === T.total) { if (c.pts.all) c.parts.push({ x: ROW.x1 - 12, y: ROW.total - 4, vx: 0, vy: -.5, life: 50, max: 50, col: '#ffe36a', g: 0, kind: 'txt', txt: '+' + c.pts.all }); if (c.pts.boss) c.parts.push({ x: ROW.x1 - 12, y: ROW.total - 4, vx: 0, vy: -.5, life: 50, max: 50, col: '#f07080', g: 0, kind: 'txt', txt: '+' + c.pts.boss }); }
    // Nila's dance: a few notes and hearts.
    if (t % 26 === 0) c.parts.push({ x: 44 + R(-8, 8), y: 80, vx: R(-.2, .2), vy: -.45, life: 60, max: 60, col: pick(['#fff6d6', '#ffe36a', '#8fd9d0']), g: 0, kind: 'note', rot: R(0, 6) });
    if (t > T.rank && t % 40 === 0) burst(c, medalPos.x + R(-16, 16), medalPos.y + R(-16, 16), 3, ['#ffffff', '#fff4a8'], .6, false, 'spark');
    // Particles.
    for (let i = c.parts.length - 1; i >= 0; i--) { const p = c.parts[i]; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += .2; if (p.kind === 'conf') { p.vx *= .96; p.vy = Math.min(p.vy, 1.2); } if (p.kind === 'note') p.x += Math.sin(p.life / 8) * .3; if (--p.life <= 0) c.parts.splice(i, 1); }
    for (const q of c.rings) q.t++; c.rings = c.rings.filter(q => q.t < 16);
    if (c.shake > 0) c.shake--; if (c.flash > 0) c.flash--;
    // A first press fast-forwards the count; the next one moves on.
    const press = Input.pressed.jump || Input.pressed.fish || Input.pressed.confirm || Game.tapped;
    if (press) {
      Game.tapped = false;
      if (t < T.rank) { Game.clearT = T.rank; c.shown = c.target = scoreAt(c, T.end); landMedal(c); }
      else if (t > T.rank + 10) {
        Sound.play('confirm');
        if (s.last) Game.transition(() => { Game.state = 'ending'; Game.endT = 0; Sound.playMusic('dock'); });
        else Game.transition(() => Game.startLevel(Game.level + 1));
      }
    }
  }
  function landMedal(c) {
    if (c.landed) return; c.landed = true;
    Sound.play('stamp', 1); c.shake = 8; c.flash = 4;
    burst(c, medalPos.x, medalPos.y, 26, ['#ffffff', '#fff4a8', MEDALS[c.rank].face], 2.6, false, 'spark');
    if (c.rank === 'perfecto' || c.rank === 'oro') burst(c, medalPos.x, medalPos.y - 10, 30, CONFETTI, 3, true, 'conf');
    c.rings.push({ x: medalPos.x, y: medalPos.y, t: 0, big: true });
    Input.rumble(220, 1, .6);
  }
  function slotPos(c, i) {
    const n = Math.max(1, c.s.total), span = ROW.x1 - ROW.x0 - 34, step = Math.min(10, Math.floor(span / n));
    return { x: ROW.x0 + i * step, y: ROW.crias + 10 };
  }
  const trickX = i => ROW.x0 + 42 + i * 22;

  // ---- drawing
  function panelBox(g, x, y, w, h) {
    g.fillStyle = 'rgba(20,26,38,.86)'; g.fillRect(x + 1, y, w - 2, h); g.fillRect(x, y + 1, w, h - 2);
    g.fillStyle = '#e79b3f'; g.fillRect(x + 2, y, w - 4, 1); g.fillRect(x + 2, y + h - 1, w - 4, 1);
    g.fillStyle = '#3a4a5e'; g.fillRect(x, y + 2, 1, h - 4); g.fillRect(x + w - 1, y + 2, 1, h - 4);
  }
  function drawTitle(g, c, t) {
    const hopK = c.hopT !== undefined ? t - c.hopT : -1, idle = t > c.T.banner + 60 ? (t - c.T.banner) % 240 : -1;
    for (const it of c.items) {
      const t0 = LT0 + it.i * LGAP, k = (t - t0) / 7; if (k < 0) continue;
      let y = 8, sx = 1, sy = 1, a = 1;
      if (k < 1) { y = 8 - 46 * (1 - k) * (1 - k); sx = .8; sy = 1.35; a = Math.min(1, k * 2); }
      else {
        const d = t - t0 - 7, sq = d < 18 ? Math.exp(-d / 5) * Math.cos(d / 1.6) : 0; sx = 1 + sq * .35; sy = 1 - sq * .35;
        const jd = c.jig[it.i + 1] !== undefined ? t - c.jig[it.i + 1] : 99; if (jd < 10) { sy -= Math.exp(-jd / 3) * .12; sx += Math.exp(-jd / 3) * .08; }
        const hk = hopK >= 0 ? (hopK - it.i * 2) / 14 : -1; if (hk >= 0 && hk < 1) y -= Math.sin(hk * Math.PI) * 6;
        const ik = idle >= 0 ? (idle - it.i * 3) / 14 : -1; if (ik >= 0 && ik < 1) y -= Math.sin(ik * Math.PI) * 4;
        y += Math.round(Math.sin((t + it.i * 9) / 24));
      }
      const cx = it.x + it.b.w / 2, by = y + it.b.h;
      g.save(); g.globalAlpha = a; g.translate(cx, by); g.scale(sx, sy); g.drawImage(it.b.c, -it.b.w / 2, -it.b.h); g.restore();
    }
  }
  function drawBanner(g, c, t) {
    const k = ease((t - c.T.banner) / 14); if (k <= 0) return;
    const label = (Game.level + 1) + ' · ' + c.s.name, tw = ART.textWidth(label), w = Math.round((tw + 30) * k), x = Math.round(W / 2 - w / 2), y = 36;
    // Folded ribbon tails, then the band.
    g.fillStyle = '#8a3a2a'; g.fillRect(x - 8, y + 3, 10, 9); g.fillRect(x + w - 2, y + 3, 10, 9);
    g.fillStyle = '#1b2430'; g.fillRect(x - 8, y + 7, 3, 1); g.fillRect(x - 7, y + 6, 1, 3); g.fillRect(x + w + 5, y + 7, 3, 1); g.fillRect(x + w + 6, y + 6, 1, 3);
    g.fillStyle = '#5a2418'; g.fillRect(x, y + 11, 3, 1); g.fillRect(x + w - 3, y + 11, 3, 1);
    g.fillStyle = '#c8543a'; g.fillRect(x, y, w, 11); g.fillStyle = '#e8785a'; g.fillRect(x, y, w, 1); g.fillStyle = '#9a3a28'; g.fillRect(x, y + 10, w, 1);
    if (k > .8) ART.text(g, label, W / 2, y + 2, '#fff6d6', 'center', '#5a2418');
  }
  function drawRows(g, c, t) {
    const T = c.T, s = c.s, x0 = ROW.x0, x1 = ROW.x1;
    if (t < T.crias0 - 12) return;
    const k = ease((t - (T.crias0 - 12)) / 10);
    g.save(); g.globalAlpha = k; panelBox(g, x0 - 6, 54, x1 - x0 + 12, 98); g.restore();
    if (k < 1) return;
    // Crías.
    const got = Math.min(s.pearls, Math.max(0, Math.floor((t - T.crias0) / CGAP) + 1) * (t >= T.crias0 ? 1 : 0));
    ART.text(g, 'Crías', x0, ROW.crias, '#9fc0cc');
    const bump = got && t - (T.crias0 + (got - 1) * CGAP) < 8 ? 1 : 0;
    ART.text(g, got + '/' + s.total, x1, ROW.crias - bump, got >= s.total && s.total ? '#ffe36a' : '#e8fbff', 'right');
    for (let i = 0; i < s.total; i++) {
      const q = slotPos(c, i), d = t - (T.crias0 + i * CGAP);
      if (i < got) {
        const sc = d < 10 ? outBack(d / 10) * (1 + .4 * Math.exp(-d / 4)) : 1, hop = d >= 10 ? Math.max(0, Math.sin((t + i * 11) / 9)) * (t > T.rank ? 2 : 0) : 0;
        g.save(); g.translate(q.x + 4.5, q.y + 4.5 - hop); g.scale(sc, sc); g.drawImage(ART.cria[((t >> 4) + i) % 3], -4.5, -4.5); g.restore();
      } else { g.globalAlpha = .35; g.drawImage(ART.tint(ART.cria[0], '#5f7899'), q.x, q.y); g.globalAlpha = 1; }
    }
    if (s.total && s.pearls >= s.total && t >= T.criasEnd - 4) stampText(g, '¡TODAS!', x1, ROW.crias + 11, t - (T.criasEnd - 4), '#ffe36a', -.12, 'right');
    // Time against the par.
    if (t >= T.time0) {
      const secs = Math.round(s.secs * Math.min(1, (t - T.time0) / (T.timeEnd - T.time0)));
      ART.text(g, 'Tiempo', x0, ROW.time, '#9fc0cc'); ART.text(g, Game.fmtTime(secs), x1, ROW.time, '#e8fbff', 'right');
      ART.text(g, 'Par ' + Game.fmtTime(c.par), x0, ROW.time + 10, '#5f7899');
      if (t >= T.bonus) {
        const d = t - T.bonus;
        if (c.fast) stampText(g, '¡RÁPIDO! +' + c.pts.time, x1, ROW.time + 10, d, '#ffe36a', 0, 'right');
        else ART.text(g, 'sin prisa', x1, ROW.time + 10, '#5f7899', 'right');
        if (c.record) stampText(g, '¡RÉCORD!', x0 + 76, ROW.time + 10, d - 6, '#f07080', .1);
      }
    }
    // Tricks learned here (or the Heron beaten).
    if (t >= T.tricks0) {
      ART.text(g, c.boss ? 'Garza' : 'Trucos', x0, ROW.tricks + 4, '#9fc0cc');
      if (c.boss) { const d = t - T.tricks0 - 6; if (d >= 0) stampText(g, '¡VENCIDA!', x1, ROW.tricks + 4, d, '#ffe36a', -.1, 'right'); }
      else {
        const all = s.tricksAll || c.tricks;
        all.forEach((pw, i) => {
          const have = c.tricks.includes(pw), d = t - (T.tricks0 + i * TGAP + 6), x = trickX(i), y = ROW.tricks;
          const spr = ART.morsels[pw]; if (!spr) return;
          if (have && d >= -6) {
            const k = d < 0 ? (d + 6) / 6 : 1, sc = d < 0 ? 4 - 2 * k : 2 * (1 + (d < 10 ? Math.exp(-d / 3) * Math.cos(d / 1.5) * .25 : 0));
            g.save(); g.globalAlpha = Math.min(1, k * 1.5); g.translate(x + 8, y + 8); g.rotate(d < 0 ? (1 - k) * .8 : 0); g.scale(sc, sc); g.drawImage(spr, -4, -4); g.restore();
          } else if (!have) { g.globalAlpha = .3; g.drawImage(ART.tint(spr, '#5f7899'), x, y, 16, 16); g.globalAlpha = 1; }
        });
        if (t >= T.tricksEnd - 6) ART.text(g, c.tricks.length + '/' + all.length, x1, ROW.tricks + 4, '#e8fbff', 'right');
      }
    }
    // Points.
    if (t >= T.total - 8) {
      g.fillStyle = '#3a4a5e'; for (let x = x0; x <= x1; x += 3) g.fillRect(x, ROW.total - 5, 2, 1);
      ART.text(g, 'Puntos', x0, ROW.total, '#f2c46a');
      const str = String(Math.floor(c.shown)).padStart(5, '0'), rolling = c.shown < c.target;
      ART.text(g, str, x1, ROW.total + (rolling && (t & 2) ? -1 : 0), rolling ? '#fff6d6' : '#ffe36a', 'right', '#1b2430');
    }
  }
  // A word that slams down like a rubber stamp: big and tilted, then settles with a wobble.
  function stampText(g, str, x, y, d, col, tilt = 0, align = 'left') {
    if (d < 0) return;
    const w = ART.textWidth(str), ax = align === 'right' ? x - w / 2 : align === 'center' ? x : x + w / 2;
    const s = d < 6 ? 3 - 2 * (d / 6) : 1 + (d < 16 ? Math.exp(-(d - 6) / 3) * Math.cos((d - 6) / 1.4) * .25 : 0);
    g.save(); g.globalAlpha = Math.min(1, d / 3 + .2); g.translate(Math.round(ax), y + 3); g.rotate(tilt * (d < 6 ? 2 : 1)); g.scale(s, s); ART.text(g, str, 0, -3, col, 'center', '#1b2430'); g.restore();
  }
  function drawMedal(g, c, t) {
    const T = c.T, M = MEDALS[c.rank], d = t - T.rank; if (d < -10) return;
    let s = 1, rot = 0, a = 1;
    if (d < 0) { const k = (d + 10) / 10; s = 4 - 3 * k * k; rot = (1 - k) * -1.2; a = k; }
    else if (d < 20) { s = 1 + Math.exp(-d / 4) * Math.cos(d / 1.3) * .22; }
    rot += Math.sin(t / 30) * .05;
    const { x, y } = medalPos, r = 20;
    g.save(); g.globalAlpha = Math.max(0, Math.min(1, a)); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    // Ribbon tails behind.
    g.fillStyle = '#2a5a9a'; g.fillRect(-12, 10, 8, 20); g.fillStyle = '#c8543a'; g.fillRect(4, 10, 8, 20);
    g.fillStyle = '#1b2430'; for (let i = 0; i < 4; i++) { g.fillRect(-12 + i, 29 - i, 1, 1 + i); g.fillRect(-4 - i - 1, 29 - i, 1, 1 + i); g.fillRect(4 + i, 29 - i, 1, 1 + i); g.fillRect(12 - i - 1, 29 - i, 1, 1 + i); }
    // Rays behind a rainbow medal.
    if (M.rainbow) { const cols = ['#f07080', '#ffe36a', '#8fd9d0', '#a0a8ff']; for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2 + t / 40; g.fillStyle = cols[i % 4]; g.globalAlpha = .55 * Math.max(0, Math.min(1, a)); for (let k = r + 2; k < r + 9; k++) g.fillRect(Math.round(Math.cos(an) * k), Math.round(Math.sin(an) * k), 2, 2); } g.globalAlpha = Math.max(0, Math.min(1, a)); }
    const disc = (rr, col) => { g.fillStyle = col; for (let dy = -rr; dy <= rr; dy++) { const hw = Math.round(Math.sqrt(rr * rr - dy * dy)); g.fillRect(-hw, dy, hw * 2 + 1, 1); } };
    disc(r + 1, '#1b2430'); disc(r, M.rim); disc(r - 2, M.lo); disc(r - 3, M.face);
    // Shine: an upper-left crescent and a sweeping glint.
    g.fillStyle = M.hi; for (let dy = -r + 4; dy < -2; dy++) { const hw = Math.round(Math.sqrt((r - 4) * (r - 4) - dy * dy)); g.fillRect(-hw, dy, Math.max(1, Math.round(hw * .5)), 1); }
    const sweep = ((t - T.rank) % 120) / 20; if (sweep < 1) { g.fillStyle = '#ffffff'; g.globalAlpha *= .7; for (let k = -r; k < r; k++) { const sx = Math.round(-r + sweep * r * 2 + k * .4); if (sx * sx + k * k < (r - 3) * (r - 3)) g.fillRect(sx, k, 2, 1); } g.globalAlpha = Math.max(0, Math.min(1, a)); }
    // A big embossed star in the middle.
    const st = ART.glyph('★', M.hi), sd = ART.glyph('★', M.rim);
    if (sd && st) { g.drawImage(sd, -7, -6, 15, 21); g.drawImage(sd, -8, -7, 15, 21); g.drawImage(sd, -6, -7, 15, 21); g.drawImage(st, -7, -7, 15, 21); }
    g.restore();
    // The rating stars pop in above the medal one by one.
    for (let i = 0; i < M.stars; i++) {
      const sd2 = d - 10 - i * 8; if (sd2 < 0) continue;
      const sc = sd2 < 8 ? outBack(sd2 / 8) * 2 : 2, sx = x + (i - (M.stars - 1) / 2) * 13, sy = y - 32 + (M.stars === 3 && i === 1 ? -3 : 0);
      const big = ART.glyph('★', '#ffe36a'), rim = ART.glyph('★', '#1b2430');
      g.save(); g.translate(Math.round(sx), Math.round(sy)); g.rotate(sd2 < 8 ? (1 - sd2 / 8) * 1.5 : Math.sin(t / 20 + i) * .08); g.scale(sc, sc);
      if (rim) { g.drawImage(rim, -2.5, -1.5); g.drawImage(rim, -3.5, -2.5); g.drawImage(rim, -1.5, -2.5); } if (big) g.drawImage(big, -2.5, -2.5); g.restore();
    }
    if (d >= 0) {
      const lab = M.name, col = M.rainbow ? ['#f07080', '#ffe36a', '#8fd9d0', '#fff6d6'][(t >> 3) % 4] : '#fff6d6';
      stampText(g, lab, x, y + 34, d, col, 0, 'center');
    }
  }
  function drawDancer(g, c, t) {
    // Nila and Bigotes at 2×, dancing on the bank: bounce, crouch, jump with a spin, waves.
    const N = ART.nila, k = t % 128, x = 9, feet = 64;
    let spr = (t >> 3) % 2 ? N.win : N.idle[0], hy = 0, rot = 0, sx = 1, sy = 1, fish = ART.fish.full, wave;
    if (k < 24) { spr = (k >> 3) % 2 ? N.win : N.idle[0]; hy = Math.abs(Math.sin(k / 24 * Math.PI * 2)) * 2; }
    else if (k < 32) { const q = (k - 24) / 8; sy = 1 - .2 * Math.sin(q * Math.PI); sx = 1 + .15 * Math.sin(q * Math.PI); spr = N.idle[0]; }
    else if (k < 56) { const q = (k - 32) / 24; hy = Math.sin(q * Math.PI) * 18; spr = q < .5 ? N.jump : N.fall; fish = ART.fish.open; if ((t >> 7) % 2) rot = q * Math.PI * 2; }
    else if (k < 64) { const q = (k - 56) / 8; sy = 1 - .25 * Math.sin(q * Math.PI); sx = 1 + .2 * Math.sin(q * Math.PI); }
    else if (k < 96) { spr = N.win; wave = -Math.PI / 2 - .55 + Math.sin(t * .3) * .4; fish = (k >> 3) % 2 ? ART.fish.open : ART.fish.full; }
    else { spr = (k >> 2) % 2 ? N.win : N.idle[0]; hy = Math.abs(Math.sin((k - 96) / 32 * Math.PI * 4)) * 3; }
    // A round shadow on the bank.
    g.fillStyle = 'rgba(10,8,20,.35)'; const sw = 22 - Math.round(hy * .6); g.fillRect(x * 2 + 22 - sw / 2 + 4, feet * 2 - 1, sw, 2);
    g.save(); g.scale(2, 2);
    drawNila(g, x, feet - 18 - hy, { spr, rot, sx, sy, fish, mood: 'happy', wave });
    g.restore();
  }
  function drawClear(g) {
    if (!V.clear) startClear();
    const c = V.clear, t = Game.clearT, T = c.T;
    const theme = L.def ? L.def.theme : 'dusk';
    const sh = c.shake > 0 && !Game.still ? c.shake * .6 : 0, ox = Math.round(R(-sh, sh)), oy = Math.round(R(-sh, sh));
    g.save(); g.translate(ox, oy);
    Game.drawScene(g, Game.t, theme);
    g.fillStyle = 'rgba(8,10,16,.5)'; g.fillRect(-4, -4, W + 8, H + 8);
    // Sunburst behind the title.
    g.save(); g.translate(W / 2, 22); g.globalAlpha = .07; g.fillStyle = '#fff4a8';
    for (let i = 0; i < 14; i++) { const a0 = i / 14 * Math.PI * 2 + t / 200; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a0) * 260, Math.sin(a0) * 260); g.lineTo(Math.cos(a0 + .18) * 260, Math.sin(a0 + .18) * 260); g.fill(); }
    g.restore();
    drawDancer(g, c, t);
    drawRows(g, c, t);
    drawMedal(g, c, t);
    drawBanner(g, c, t);
    drawTitle(g, c, t);
    for (const q of c.rings) { const rr = (q.big ? 8 : 4) + q.t * (q.big ? 2.4 : 1.2); g.strokeStyle = '#fff4a8'; g.globalAlpha = 1 - q.t / 16; g.beginPath(); g.arc(q.x, q.y, rr, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; }
    for (const p of c.parts) {
      const x = Math.round(p.x), y = Math.round(p.y); g.globalAlpha = Math.min(1, p.life / 12); g.fillStyle = p.col;
      if (p.kind === 'spark') { g.fillRect(x, y, 1, 1); if (p.life > 12) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } }
      else if (p.kind === 'conf') { const w = Math.abs(Math.cos(p.rot)) > .5 ? 2 : 1; g.fillRect(x, y, w, 3 - w); }
      else if (p.kind === 'txt') ART.text(g, p.txt, x, y, p.col, 'center', '#1b2430');
      else if (p.kind === 'note') { g.fillRect(x, y, 1, 5); g.fillRect(x - 2, y + 4, 3, 2); g.fillRect(x + 1, y, 2, 1); g.fillRect(x + 2, y + 1, 1, 1); }
      else g.fillRect(x, y, 1, 1);
      g.globalAlpha = 1;
    }
    g.restore();
    if (c.flash > 0 && !Game.still) { g.globalAlpha = c.flash / 6 * .35; g.fillStyle = '#fffbe0'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    if (t > T.rank + 10 && (t >> 5) % 2 === 0) { const msg = (Touch.enabled ? 'Toca · ' : '') + (c.s.last ? 'Continuar →' : 'Siguiente nivel →'); ART.text(g, msg, 200, 166, '#fff6d6', 'center', '#1b2430'); }
    else if (t < T.rank && t > 30) ART.text(g, Touch.enabled ? 'Toca para adelantar' : 'Z adelanta', W - 6, 170, '#5f7899', 'right');
  }

  // ================================================================ Captura
  // ?escena=victoria&n=nivel&t=fotogramas&x=crías que faltan (fase de nivel y luego el recuento).
  function capture(c) {
    Game.startLevel(c.n); Game.banner = 0;
    if (!L.exit && L.def.boss && typeof Boss !== 'undefined' && Boss.won) { if (L.boss) L.boss.dead = true; Boss.won(); }
    const b = L.exit || (() => { const e = Item.boat((L.w - 5) * TS + 4, (L.h - 3) * TS + 14); L.ents.push(e); return e; })();
    L.pearls = Math.max(0, L.pearlsTotal - Math.max(0, c.x)); L.time = 60 * 150;
    Player.x = b.x - 14; Player.y = b.y - 20; Player.onGround = true; Cam.snap();
    Game.levelClear(b);
    for (let i = 0; i < c.t; i++) { Input.held = {}; Input.pressed = {}; Game.update(); }
    Game.frozen = true;
  }

  return { start, active, update, drawWorld, startClear, updateClear, drawClear, capture, get run() { return V.run; }, reset() { V.run = null; V.clear = null; } };
})();
