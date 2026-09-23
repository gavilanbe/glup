// GLUP — pantalla de título. El logotipo está dibujado a trazos gordos con la piel de
// Bigotes (oliva moteado, relieve y brillo) y la G es su cabeza: la abertura es la boca,
// con ojo y bigotes. Al entrar, Bigotes salta del agua y escupe las letras una a una.
'use strict';
const Title = (() => {
  const INTRO = 170;                 // frames until everything is in place
  const LEAP = 30, APEX = 58, SPIT0 = 64, SPIT_GAP = 9, FLY = 22, DROP = 104, CATCH = 128;
  const TOP = 12, M = 4, EXT = 4;    // logo top, canvas margin, extrusion depth

  // ---------------------------------------------------------------- Letras
  // Each letter is a set of strokes stamped with a round brush, so the shapes come out chunky and soft.
  const R = 5.2;
  const seg = (x0, y0, x1, y1) => ({ seg: [x0, y0, x1, y1] });
  const arc = (cx, cy, r, a0, a1) => ({ arc: [cx, cy, r, a0, a1] });
  const D = Math.PI / 180;
  const LETTERS = [
    { ch: 'G', w: 42, strokes: [arc(21, 23, 15, -52 * D, -336 * D), seg(34.5, 28, 35, 25), seg(35, 25, 26, 25)] },
    { ch: 'L', w: 30, strokes: [seg(8, 7, 8, 38), seg(8, 38, 26, 38)] },
    { ch: 'U', w: 40, strokes: [seg(8, 7, 8, 25), arc(20, 25, 12, Math.PI, 0), seg(32, 25, 32, 7)] },
    { ch: 'P', w: 35, strokes: [seg(8, 7, 8, 38), seg(8, 7, 20, 7), arc(20, 15.5, 8.5, -Math.PI / 2, Math.PI / 2), seg(20, 24, 8, 24)] }];
  const LH = 46;
  const FILL = ['#fff3b8', '#f2e08a', '#dccd68', '#bdb452', '#9ca044', '#7c883a', '#5f6e30'];

  function stamp(mask, w, h, x, y) {
    for (let dy = -Math.ceil(R); dy <= Math.ceil(R); dy++) for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
      if (dx * dx + dy * dy > R * R) continue;
      const px = Math.round(x + dx) + M, py = Math.round(y + dy) + M; if (px >= 0 && py >= 0 && px < w && py < h) mask[py * w + px] = 1;
    }
  }
  function buildLetter(L, seed) {
    const w = L.w + M * 2, h = LH + M * 2 + EXT, mask = new Uint8Array(w * h);
    for (const s of L.strokes) {
      if (s.seg) { const [x0, y0, x1, y1] = s.seg, n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2)); for (let i = 0; i <= n; i++) stamp(mask, w, h, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); }
      else { const [cx, cy, r, a0, a1] = s.arc, n = Math.ceil(Math.abs(a1 - a0) * r * 2); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; stamp(mask, w, h, cx + Math.cos(a) * r, cy + Math.sin(a) * r); } }
    }
    const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
    const ext = (x, y) => { if (at(x, y)) return 0; for (let k = 1; k <= EXT; k++) if (at(x, y - k)) return k; return 0; };
    const solid = (x, y) => at(x, y) || ext(x, y) > 0;
    // Distance to the edge, for spots that stay inside the stroke.
    const inner = (x, y) => { for (let d = 1; d <= 3; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) if (!at(x + dx, y + dy)) return d - 1; return 3; };
    let s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const spots = new Set(); for (let i = 0; i < 9; i++) { const x = (rnd() * w) | 0, y = (rnd() * h) | 0; if (at(x, y) && inner(x, y) >= 2) { spots.add(y * w + x); spots.add(y * w + x + 1); if (rnd() < .5) spots.add((y + 1) * w + x); } }
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    let top = h, bottom = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y)) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (at(x, y)) {
        const f = (y - top) / Math.max(1, bottom - top) * (FILL.length - 1), i = Math.min(FILL.length - 2, f | 0), fr = f - i;
        let col = fr > .66 || (fr > .33 && ((x + y) & 1)) ? FILL[i + 1] : FILL[i];
        if (spots.has(y * w + x)) col = '#6a7430';
        if (!at(x, y - 1)) col = '#fffbe6'; else if (!at(x, y - 2) && y - top < 12) col = FILL[0];
        else if (!at(x - 1, y)) col = y - top < (bottom - top) * .6 ? '#f6ea9c' : FILL[3];
        else if (!at(x + 1, y) || !at(x, y + 1)) col = '#4f5c28';
        px(x, y, col);
      } else if (ext(x, y)) px(x, y, ext(x, y) <= 2 ? '#48522a' : '#2f3820');
      else { let near = false; for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) if (dx * dx + dy * dy <= 5 && solid(x + dx, y + dy)) near = true; if (near) px(x, y, '#1a1420'); }
    }
    // A little gloss on the upper left of the stroke.
    g.fillStyle = '#ffffff'; for (let y = top + 2; y < top + 4; y++) for (let x = 0; x < w; x++) if (at(x, y) && inner(x, y) >= 1 && x < w * .45 && (x + y) % 5 !== 0) { g.fillRect(x, y, 1, 1); break; }
    // Drip points: bottom edges that hang over air.
    const drips = []; for (let x = 2; x < w - 2; x++) { let y = h - 1; while (y > 0 && !solid(x, y)) y--; if (y > 0 && solid(x, y) && !solid(x - 1, y + 1) && !solid(x + 1, y + 1) && at(x, y - EXT) && rnd() < .08) drips.push({ x, y: y + 2 }); }
    // The shape used by the shine sweep: the face of the letter only.
    const face = document.createElement('canvas'); face.width = w; face.height = h; const fg = face.getContext('2d'); fg.fillStyle = '#fffbe6'; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y)) fg.fillRect(x, y, 1, 1);
    return { c, face, w, h, drips, mask, at };
  }
  let letters = null;
  function build() {
    if (letters) return letters;
    const total = LETTERS.reduce((a, l) => a + l.w, 0) + 1 * (LETTERS.length - 1);
    let x = Math.round((W - total) / 2);
    letters = LETTERS.map((L, i) => { const b = buildLetter(L, 97 + i * 31); b.slotX = x - M; b.slotY = TOP - M; x += L.w + 1; b.i = i; return b; });
    return letters;
  }

  // ---------------------------------------------------------------- Coreografía
  // Bigotes' path: up out of the water, a hang at the top while he spits, then down into Nila's arms.
  const NILA = { x: 150, y: 108 };
  function fishAt(t) {
    const x0 = 188, y0 = 146, ax = 188, ay = 80, cx = NILA.x + 10, cy = NILA.y + 7;
    if (t < LEAP) return null;
    if (t < APEX) { const k = (t - LEAP) / (APEX - LEAP), e = 1 - (1 - k) * (1 - k); return { x: x0, y: y0 + (ay - y0) * e, a: -Math.PI / 2, mouth: 'closed' }; }
    if (t < DROP) { const k = t - APEX, sp = (t - SPIT0) % SPIT_GAP, spitting = t >= SPIT0 && t < SPIT0 + SPIT_GAP * 4 && sp < 4; return { x: ax + Math.sin(k / 6) * 1.5, y: ay + Math.sin(k / 9) * 2 + (spitting ? 2 - sp * .5 : 0), a: -Math.PI / 2 + Math.sin(k / 7) * .12, mouth: spitting ? 'spit' : 'open' }; }
    if (t < CATCH) { const k = (t - DROP) / (CATCH - DROP); return { x: ax + (cx - ax) * k, y: ay + (cy - ay) * k - Math.sin(k * Math.PI) * 22, a: -Math.PI / 2 + k * (Math.PI / 2 + Math.PI * 2), mouth: 'closed' }; }
    return null;
  }
  function letterAt(b, t) {
    const t0 = SPIT0 + b.i * SPIT_GAP, k = (t - t0) / FLY;
    if (t < t0) return null;
    if (k < 1) {
      const mx = 188 - b.w / 2, my = 70 - b.h / 2, e = k * (2 - k);
      return { x: mx + (b.slotX - mx) * e, y: my + (b.slotY - my) * e - Math.sin(k * Math.PI) * 26, s: .35 + .65 * k, rot: (1 - k) * (b.i % 2 ? 1 : -1) * 2.4, sx: 1, sy: 1 };
    }
    const land = t - t0 - FLY, sq = land < 16 ? Math.exp(-land / 5) * Math.cos(land / 1.6) : 0;
    const bob = t > INTRO ? Math.round(Math.sin((t + b.i * 23) / 28) * 1.2) : 0;
    return { x: b.slotX, y: b.slotY + bob, s: 1, rot: 0, sx: 1 + sq * .28, sy: 1 - sq * .28 };
  }

  // ---------------------------------------------------------------- Partículas y sonido
  const S = { parts: [], drops: [], lastT: -1 };
  function burst(x, y, n, col, spd, up) { for (let i = 0; i < n; i++) { const a = up ? -Math.PI / 2 + (Math.random() - .5) * 1.6 : Math.random() * Math.PI * 2, v = spd * (.4 + Math.random() * .8); S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 16 + Math.random() * 16, col: col[(Math.random() * col.length) | 0], g: .12 }); } }
  function update(t) {
    if (t === 1 || t < S.lastT) { S.parts = []; S.drops = []; }
    S.lastT = t; const L = build();
    if (t < LEAP && t % 5 === 0) S.parts.push({ x: 186 + Math.random() * 5, y: 150, vx: 0, vy: -.5, life: 30, col: '#c8f2ea', g: -.01, bubble: true });
    if (t === LEAP) { burst(188, 132, 18, ['#c8f2ea', '#8fd9d0', '#ffffff'], 2.4, true); Sound.play('splash'); }
    for (let i = 0; i < 4; i++) { const t0 = SPIT0 + i * SPIT_GAP; if (t === t0) { Sound.play('spit', .5 + i * .2); burst(188, 72, 5, ['#fff3b8', '#dccd68'], 1.2, false); } if (t === t0 + FLY) { Sound.play('land', .8); const b = L[i]; burst(b.slotX + b.w / 2, b.slotY + b.h - 4, 10, ['#fff3b8', '#9ca044', '#ffffff'], 1.6, true); } }
    if (t === CATCH) { Sound.play('glup', 1); burst(NILA.x + 14, NILA.y + 10, 12, ['#fff6d6', '#f2c46a', '#ffffff'], 1.8, false); }
    // After the intro, now and then a drop of swamp slides off a letter and falls.
    if (t > INTRO && Math.random() < .02) { const b = L[(Math.random() * 4) | 0]; if (b.drips.length) { const d = b.drips[(Math.random() * b.drips.length) | 0]; S.drops.push({ x: b.slotX + d.x, y: b.slotY + d.y, vy: 0, grow: 0 }); } }
    for (let i = S.drops.length - 1; i >= 0; i--) { const d = S.drops[i]; if (d.grow < 24) d.grow++; else { d.vy += .12; d.y += d.vy; } if (d.y > 128) { if (d.x > 96 && d.x < 224) burst(d.x, 129, 4, ['#c8f2ea', '#8fd9d0'], 1, true); S.drops.splice(i, 1); } }
    for (let i = S.parts.length - 1; i >= 0; i--) { const p = S.parts[i]; p.vy += p.g; p.x += p.vx; p.y += p.vy; if (p.bubble) p.x += Math.sin(p.life / 3) * .3; if (--p.life <= 0 || (p.bubble && p.y < 131)) S.parts.splice(i, 1); }
  }

  // ---------------------------------------------------------------- Dibujo
  function drawLetter(g, b, st, t) {
    g.save(); g.translate(Math.round(st.x + b.w / 2), Math.round(st.y + b.h)); if (st.rot) g.rotate(st.rot); g.scale(st.s * st.sx, st.s * st.sy);
    g.drawImage(b.c, -b.w / 2, -b.h);
    // Shine: a slanted band sweeps across the faces every few seconds.
    const sw = (t - INTRO) % 300; if (t > INTRO && sw < 60) {
      const bx = (sw / 60) * (W + 80) - 40 - (b.slotX - (letters[0].slotX)) - 20;
      g.save(); g.beginPath(); for (let y = 0; y < b.h; y++) g.rect(-b.w / 2 + bx + y * .5, -b.h + y, 5, 1); g.clip(); g.globalAlpha = .75; g.drawImage(b.face, -b.w / 2, -b.h); g.restore();
    }
    g.restore();
  }
  // The G is Bigotes' head: an eye over the mouth and two whiskers hanging from its corners.
  function drawFace(g, b, st, t) {
    if (st.s < 1 || st.rot) return;
    const ox = Math.round(st.x), oy = Math.round(st.y), ex = ox + M + 24, ey = oy + M + 10, blink = (t % 210) < 6;
    g.fillStyle = '#1a1420'; g.fillRect(ex - 3, ey - 3, 7, 7); g.fillRect(ex - 2, ey - 4, 5, 9); g.fillRect(ex - 4, ey - 2, 9, 5);
    if (blink) { g.fillStyle = '#9ca044'; g.fillRect(ex - 3, ey - 2, 7, 5); g.fillStyle = '#1a1420'; g.fillRect(ex - 3, ey, 7, 1); }
    else { g.fillStyle = '#fffbe6'; g.fillRect(ex - 2, ey - 2, 5, 5); g.fillRect(ex - 3, ey - 1, 7, 3); g.fillRect(ex - 1, ey - 3, 3, 7); const lx = t % 400 < 200 ? 1 : 0; g.fillStyle = '#1a1420'; g.fillRect(ex - 1 + lx, ey - 1, 2, 3); g.fillStyle = '#ffffff'; g.fillRect(ex - 1 + lx, ey - 1, 1, 1); }
    // Whiskers: pixel chains that curl down and sway.
    const whisk = (x, y, len, ph, a0) => {
      const pts = []; let px = x, py = y; for (let i = 0; i < len; i++) { const a = a0 + i * .1 + Math.sin(t / 24 + ph + i * .22) * (.05 + i * .012); px += Math.cos(a); py += Math.sin(a); pts.push([Math.round(px), Math.round(py), i]); }
      g.fillStyle = '#1a1420'; for (const [x, y, i] of pts) { const k = i < len * .5 ? 4 : 3; g.fillRect(x - 1, y - 1, k, k); }
      for (const [x, y, i] of pts) { const k = i < len * .5 ? 2 : 1; g.fillStyle = i > len - 5 ? '#b8743a' : '#f0c070'; g.fillRect(x, y, k, k); }
    };
    whisk(ox + M + 33, oy + M + 12, 22, 0, -.15); whisk(ox + M + 37, oy + M + 30, 16, 1.7, .45);
  }
  function drawFish(g, f, t) {
    if (!f) return;
    const spr = f.mouth === 'spit' ? ART.fish.spit : f.mouth === 'open' ? ART.fish.open : ART.fish.closed;
    g.save(); g.translate(Math.round(f.x), Math.round(f.y)); g.rotate(f.a); g.drawImage(spr, -spr.width / 2, -spr.height / 2); Player.fishOverlay(g, spr, -spr.width / 2, -spr.height / 2, t, { mood: f.mouth === 'open' ? 'mad' : null }); g.restore();
  }
  function drawSign(g, t, y) {
    const text = 'Nila y el pez gato', tw = ART.textWidth(text), w = tw + 16, x = Math.round((W - w) / 2), sway = Math.round(Math.sin(t / 50) * 1);
    g.fillStyle = '#6b4a30'; g.fillRect(x + 6, y - 8, 1, 8); g.fillRect(x + w - 7, y - 8, 1, 8);
    g.save(); g.translate(sway, 0);
    g.fillStyle = '#1a1420'; g.fillRect(x - 1, y - 1, w + 2, 15); g.fillStyle = '#8a5a34'; g.fillRect(x, y, w, 13); g.fillStyle = '#a56f38'; g.fillRect(x, y, w, 2); g.fillRect(x, y + 6, w, 1); g.fillStyle = '#6b4a30'; g.fillRect(x, y + 11, w, 2);
    g.fillStyle = '#4a2e1a'; g.fillRect(x + 2, y + 2, 1, 1); g.fillRect(x + w - 3, y + 2, 1, 1);
    ART.text(g, text, W / 2, y + 3, '#fff3b8', 'center', '#4a2e1a');
    g.restore();
  }
  function draw(g, t) {
    const L = build();
    Game.drawScene(g, t, 'dusk');
    // Nila waits on the dock looking at the water until Bigotes lands in her arms.
    const blink = (t % 200) < 6, caught = t >= CATCH;
    if (caught) { const k = t - CATCH, sq = k < 14 ? Math.exp(-k / 4) * Math.cos(k / 1.4) : 0; g.save(); g.translate(NILA.x + 5, NILA.y + 18); g.scale(1 + sq * .2, 1 - sq * .2); g.translate(-(NILA.x + 5), -(NILA.y + 18)); Player.drawCarry(g, NILA.x, NILA.y, ART.nila.idle[blink ? 1 : 0], (t % 240) < 18 ? ART.fish.open : ART.fish.closed, (t >> 5) % 2); g.restore(); }
    else { const spr = t > LEAP ? (ART.nila.brace || ART.nila.idle[0]) : ART.nila.idle[blink ? 1 : 0]; g.drawImage(spr, NILA.x - 3, NILA.y + 18 - spr.height); if (t > LEAP && t < CATCH) ART.text(g, '!', NILA.x + 5, NILA.y - 12 - ((t >> 3) % 2), '#f2c46a', 'center', '#1b2430'); }
    // Fireflies.
    for (const f of Game.titleParts || []) { const a = Math.max(0, Math.sin(f.t / 8)), x = Math.round(f.x), y = Math.round(f.y); g.fillStyle = '#f2f5a0'; g.globalAlpha = a * .3; g.fillRect(x - 1, y - 1, 3, 3); g.globalAlpha = .3 + a * .7; g.fillStyle = '#ffffe0'; g.fillRect(x, y, 1, 1); } g.globalAlpha = 1;
    // Letter shadows on the sky, then the letters, then the drops.
    for (const b of L) { const st = letterAt(b, t); if (st) drawLetter(g, b, st, t); }
    { const st = letterAt(L[0], t); if (st) drawFace(g, L[0], st, t); }
    for (const d of S.drops) { const r = d.grow < 24 ? d.grow / 12 : 2; g.fillStyle = '#7c883a'; g.fillRect(Math.round(d.x), Math.round(d.y), 1, Math.max(1, Math.round(r))); g.fillStyle = '#dccd68'; g.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); }
    drawFish(g, fishAt(t), t);
    for (const p of S.parts) { g.fillStyle = p.col; if (p.bubble) { g.globalAlpha = .8; g.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1); g.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3); g.globalAlpha = 1; } else g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    // The sign drops in on its ropes once the letters are home.
    if (t > INTRO - 30) { const k = Math.min(1, (t - INTRO + 30) / 20), y = Math.round(66 - (1 - k * k) * 30 + (k >= 1 ? 0 : 0)); g.globalAlpha = Math.min(1, k * 2); drawSign(g, t, y); g.globalAlpha = 1; }
    if (t > INTRO) {
      const msg = Touch.enabled ? 'Toca para empezar' : 'Pulsa Z o espacio', a = .55 + Math.sin(t / 14) * .45;
      const mw = ART.textWidth(msg) + 24, mx = Math.round((W - mw) / 2);
      g.fillStyle = 'rgba(16,12,24,.72)'; g.fillRect(mx, 157, mw, 13); g.fillRect(mx + 1, 156, mw - 2, 15);
      g.globalAlpha = .7 + a * .3; ART.text(g, msg, W / 2 + 4, 160, '#fff6d6', 'center', '#1b2430'); g.globalAlpha = 1;
      const bx = mx + 6 + Math.round(Math.sin(t / 8) * 1.5); g.fillStyle = '#f2c46a'; g.fillRect(bx, 160, 1, 5); g.fillRect(bx + 1, 161, 1, 3); g.fillRect(bx + 2, 162, 1, 1);
    }
    ART.text(g, 'gavilanbe · 2026', W - 4, H - 9, '#6a5a78', 'right');
  }
  return { INTRO, update, draw, build };
})();
