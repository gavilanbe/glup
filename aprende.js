// GLUP — aprender un truco. Primero una escena de cine en primer plano, con bandas negras: el bocado
// llega flotando a la boca de Bigotes, ¡ÑAM!, el trago le baja por el cuerpo como un bulto de luz, el
// poder le sube por dentro (se enciende con el color del truco, tiembla, la energía converge, cada truco
// con su detalle) y estalla en un fogonazo. Después, como coger un objeto en Zelda: Nila lo alza con
// rayos de luz y fanfarria, el nombre cruza la pantalla en una cinta y un recuadro enseña el truco en
// bucle con los botones que tocan. Un toque salta la escena.
'use strict';
const Aprende = (() => {
  const ABSORB = 34, RAISE = 36, NAME = 80, DEMO = 118, READY = 150, EXIT = 22;
  // The cinematic before the card: the morsel comes in, the bite, the gulp, the power rising, the burst.
  const BITE = 46, GULPED = 92, CINE = 152, FLASH = 26;
  // Each trick has its colour and its sensation.
  const FEEL = {
    soplido: { col: '#bfe6f5', deep: '#3a6a8a', kind: 'wind' }, aleteo: { col: '#ffe36a', deep: '#8a6a1a', kind: 'spark' },
    ventosa: { col: '#8fd06a', deep: '#2f6a3a', kind: 'ring' }, chorro: { col: '#6fd8e8', deep: '#1d5a6a', kind: 'drop' },
    mordisco: { col: '#e6c46a', deep: '#6a5a3a', kind: 'glint' }, panzazo: { col: '#e0904a', deep: '#6a3a1a', kind: 'rock' },
    guindilla: { col: '#ff5a3a', deep: '#7a1a10', kind: 'fire' }, resbalon: { col: '#7fe0c0', deep: '#1d6a5a', kind: 'slime' } };
  // The card's timeline starts where the old absorption ended: t on the card = frames after the burst + ABSORB.
  const cardT = l => l.t - CINE + ABSORB;
  const KEYS = {
    aleteo: '{jump} otra vez en el aire', soplido: 'Pulsa {puff} para soplar', ventosa: '{jump} pegada al muro de raíces',
    chorro: 'Con agua, mantén {fish} en el aire', mordisco: 'Mantén {fish} para colgarte; suelta y otra vez {fish} al siguiente', panzazo: '{down} y {jump} en el aire',
    guindilla: 'Mantén {fish} con la boca llena y suelta', resbalon: 'Agachada, {down} y {puff}' };
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : 1 - (1 - k) * (1 - k);
  let shade = null;
  function shadeCanvas() { if (!shade) { shade = document.createElement('canvas'); shade.width = W; shade.height = H; } return shade; }

  function start(power, giver) { Game.learning = { power, giver, t: 0, exit: 0, motes: [] }; Sound.play('whoosh'); }
  // The moment the power bursts out: flash, rings, a shower of its colour around Nila, the fanfare.
  function burst(l) {
    const f = FEEL[l.power] || FEEL.aleteo, P = Player;
    Sound.play('powerBurst'); Sound.play('learn'); Cam.shake(5, 18); Cam.punch(1.1); Input.rumble(420, 1, .8);
    spawnParts(40, P.x + 5, P.y + 2, { color: [f.col, '#ffffff', '#fff6d6', f.deep], speed: [1, 4.5], life: [20, 50], g: .02 });
    for (let i = 0; i < 3; i++) L.parts.push({ x: P.x + 5, y: P.y + 2, vx: 0, vy: 0, life: 16 + i * 6, color: i ? f.col : '#ffffff', size: 1, g: 0, kind: 'ring' });
  }
  function cineUpdate(l) {
    const t = l.t, f = FEEL[l.power] || FEEL.aleteo;
    if (t === BITE) { Sound.play('chomp'); Sound.play('glup', 2); Input.rumble(160, .9, .4); }
    if (t === BITE + 10) Sound.play('gulpBig');
    if (t === GULPED) Sound.play('powerRise');
    if (t > GULPED && t % 14 === 0) Input.rumble(40, .1 + (t - GULPED) / (CINE - GULPED) * .6, .3);
    // Energy motes: during the rise they stream in from the edges to the fish.
    if (t > GULPED - 10 && t < CINE) for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, r = 120 + Math.random() * 60; l.motes.push({ a, r, v: 1.5 + Math.random() * 2.5, c: Math.random() < .3 ? '#ffffff' : f.col }); }
    for (let i = l.motes.length - 1; i >= 0; i--) { const m = l.motes[i]; m.r -= m.v; m.v *= 1.05; m.a += .03; if (m.r < 8) l.motes.splice(i, 1); }
  }
  function update() {
    const l = Game.learning; l.t++;
    Player.animT++; Player.sx += (1 - Player.sx) * .18; Player.sy += (1 - Player.sy) * .18; if (Player.swallowT > 0) Player.swallowT--;
    updateParts(); for (let i = L.words.length - 1; i >= 0; i--) { const w = L.words[i]; w.t++; if (w.t > w.life) L.words.splice(i, 1); }
    const go = Input.pressed.jump || Input.pressed.fish || Input.pressed.confirm || Game.tapped; Game.tapped = false;
    if (l.t < CINE) { cineUpdate(l); if (go && l.t > 14) { l.t = CINE - 1; } return; }
    if (l.t === CINE) burst(l);
    const t = cardT(l);
    if (t === ABSORB + 20) Sound.play('win');
    if (t === NAME + 4) Sound.play('lantern');
    if (l.exit) { if (++l.exit > EXIT) { Game.learning = null; Sound.duck(false); Input.release(); } return; }
    if (go && t > ABSORB + 20 && t < READY) { l.t = READY - ABSORB + CINE; return; }
    if (go && t >= READY) { l.exit = 1; Sound.play('confirm'); }
  }
  // Player.draw steps aside while the pose is on.
  function posing() { const l = Game.learning; return !!(l && !l.exit); }

  // ---------------------------------------------------------------- La escena
  const clamp01 = k => k < 0 ? 0 : k > 1 ? 1 : k;
  const smooth = k => { k = clamp01(k); return k * k * (3 - 2 * k); };
  // Bigotes, big: drawn column by column so a gulp can travel down him as a bulge (lump: 0 = tail, 1 = mouth).
  function bigFish(g, spr, x, y, S, lump, lumpAmt, mood, t, tint) {
    const w = spr.width, h = spr.height;
    for (let i = 0; i < w; i++) {
      const u = i / (w - 1), d = (u - lump) * 5, bump = 1 + lumpAmt * Math.exp(-d * d), sh = h * S * bump;
      g.drawImage(spr, i, 0, 1, h, x + i * S, y - sh / 2, S, sh);
    }
    g.save(); g.translate(x, y - h * S / 2); g.scale(S, S); Player.fishOverlay(g, spr, 0, 0, t, { mood, lx: 1, noWhiskers: true }); g.restore();
    // His barbels, drawn big: two soft curves hanging from the corner of the mouth, swaying.
    const mx = x + (w - 2) * S, my = y + S * 1.5;
    for (const [len, ph, off] of [[34, 0, 0], [26, 1.9, 5]]) for (let i = 0; i < len; i++) {
      const u = i / len, bx = mx + 3 - off * .4 + i * .4 + Math.sin(u * 3.5 + t / 7 + ph) * 5 * u, by = my + 2 + off * .3 + i * .85;
      g.fillStyle = '#1b1420'; g.fillRect(Math.round(bx), Math.round(by) + 1, 2, 2); g.fillStyle = u < .2 ? '#e8c890' : '#c9a060'; g.fillRect(Math.round(bx), Math.round(by), 2, 2);
    }
    if (tint && tint.a > 0) { g.globalAlpha = tint.a; g.drawImage(ART.tint(spr, tint.c), x, y - h * S / 2, w * S, h * S); g.globalAlpha = 1; }
  }
  function cineDraw(g, l) {
    const t = l.t, f = FEEL[l.power] || FEEL.aleteo, S = 5, spr0 = ART.fish.closed, fw = spr0.width * S;
    const rise = clamp01((t - GULPED) / (CINE - GULPED)), shake = t > GULPED ? rise * rise * 3 : t >= BITE && t < BITE + 8 ? (BITE + 8 - t) * .8 : 0;
    const jx = (Math.random() - .5) * shake * 2, jy = (Math.random() - .5) * shake * 2;
    // Backdrop: the night closes in, then glows with the trick's colour as the power rises.
    const inK = smooth(t / 14);
    g.globalAlpha = inK; g.fillStyle = '#07060d'; g.fillRect(0, 0, W, H);
    const cx = W / 2 - 18 + jx, cy = H / 2 + 6 + jy, gr = g.createRadialGradient(cx, cy, 4, cx, cy, 150);
    gr.addColorStop(0, f.col); gr.addColorStop(.35, f.deep); gr.addColorStop(1, 'rgba(7,6,13,0)');
    g.globalAlpha = inK * (.18 + rise * .55 + (t >= BITE && t < BITE + 6 ? .4 : 0)); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    // Rays behind him while the power rises, turning faster and longer.
    if (t > GULPED) { g.save(); g.translate(cx, cy); for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28 + t * (.01 + rise * .05), len = 60 + rise * 140; g.globalAlpha = (.08 + rise * .22) * (i % 2 ? 1 : .5); g.fillStyle = i % 3 ? f.col : '#ffffff'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - .06) * len, Math.sin(a - .06) * len); g.lineTo(Math.cos(a + .06) * len, Math.sin(a + .06) * len); g.fill(); } g.restore(); g.globalAlpha = 1; }
    // Speed lines on the bite.
    if (t >= BITE && t < BITE + 10) { g.fillStyle = '#ffffff'; for (let i = 0; i < 26; i++) { const a = i / 26 * 6.28 + i, r0 = 50 + (i * 37) % 40, r1 = r0 + 30 + (i * 13) % 50; g.globalAlpha = (BITE + 10 - t) / 10 * .8; for (let r = r0; r < r1; r += 2) g.fillRect(Math.round(cx + fw / 2 + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * .6), 1, 1); } g.globalAlpha = 1; }
    // Energy motes streaming in.
    for (const m of l.motes) { g.fillStyle = m.c; g.globalAlpha = Math.min(1, m.r / 40); g.fillRect(Math.round(cx + Math.cos(m.a) * m.r), Math.round(cy + Math.sin(m.a) * m.r * .7), 2, 2); } g.globalAlpha = 1;
    // Bigotes. The mouth opens as the morsel comes, snaps shut on it, the lump rides down him.
    const fx = Math.round(cx - fw / 2), open = t > 18 && t < BITE, gulpK = clamp01((t - BITE - 4) / (GULPED - BITE - 14));
    let spr = open ? ART.fish.open : t < BITE + 6 ? ART.fish.swallow : t < GULPED ? ART.fish.full : rise > .85 ? ART.fish.squint : ART.fish.closed;
    if (t > 0 && t <= 18 && (t % 90) < 5) spr = ART.fish.blink;
    let lump = 0, lumpAmt = 0; if (t >= BITE && t < GULPED + 4) { lump = 1 - smooth(gulpK) * .7; lumpAmt = .35 * (1 - clamp01((t - GULPED + 8) / 12)); }
    // Per-trick sensation while the power rises.
    let sxK = 1, syK = 1, dy = 0, tintC = f.col;
    if (t > GULPED) {
      if (f.kind === 'wind') syK = 1 + Math.max(0, Math.sin(t / 5)) * .12 * rise;                 // cheeks puffing
      if (f.kind === 'spark') dy = Math.sin(t / 4) * 3 * rise;                                    // fins flapping him up and down
      if (f.kind === 'rock' && t < GULPED + 12) dy = (t - GULPED) * 1.2;                          // heavy: a drop and a thud
      if (f.kind === 'rock' && t === GULPED + 12) { Cam.shake(3, 8); Sound.play('thud'); }
      if (f.kind === 'slime') sxK = 1 + Math.sin(t / 6) * .06 * rise;                             // wobbly
      if (f.kind === 'fire') tintC = '#ff3a1a';
    }
    const Sx = S * sxK, Sy = S * syK, mood = t < BITE ? null : t < GULPED ? 'shock' : rise > .6 ? 'mad' : 'shock';
    // His aura, then him.
    if (t > GULPED) { const a = .25 + rise * .5 + Math.sin(t / 3) * .08, sc = 1.08 + Math.sin(t / 4) * .03 + rise * .06; g.globalAlpha = a; g.drawImage(ART.tint(spr, f.col), Math.round(cx - fw * sc / 2), Math.round(cy + dy - spr.height * S * sc / 2), Math.round(fw * sc), Math.round(spr.height * S * sc)); g.globalAlpha = 1; }
    g.save(); g.translate(cx, cy + dy); g.scale(sxK, syK); g.translate(-cx, -(cy + dy));
    bigFish(g, spr, fx, Math.round(cy + dy), S, lump, lumpAmt, mood, t, { c: t > GULPED ? tintC : '#ffffff', a: t > GULPED ? rise * rise * .75 : 0 });
    g.restore();
    // The glowing lump itself, seen through him.
    if (lumpAmt > .02) { const lx = fx + lump * fw, a = .35 + Math.sin(t / 3) * .1; g.globalAlpha = a; g.fillStyle = f.col; g.beginPath(); g.arc(Math.round(lx), Math.round(cy + dy), 9, 0, 7); g.fill(); g.globalAlpha = 1; }
    // Sensation particles around him.
    if (t > GULPED) {
      const n = 2 + Math.round(rise * 6);
      for (let i = 0; i < n; i++) {
        const k = ((t * .02 + i / n) % 1), a = i * 2.4 + t * .05;
        let x = cx + Math.cos(a) * (fw * .6 + k * 20), y = cy + dy + Math.sin(a) * (30 + k * 12);
        g.globalAlpha = 1 - k;
        if (f.kind === 'wind') { g.fillStyle = '#ffffff'; g.fillRect(Math.round(x), Math.round(y), 6, 1); }
        else if (f.kind === 'drop' || f.kind === 'slime') { y = cy + dy + 20 + k * 40; x = fx + ((i * 37) % fw); g.fillStyle = f.col; g.fillRect(Math.round(x), Math.round(y), 2, 3); }
        else if (f.kind === 'fire') { x = fx + fw * .7 + ((i * 11) % 30) - 15; y = cy + dy - 30 - k * 50; g.fillStyle = k < .4 ? '#fff6d6' : k < .7 ? '#ff9a3a' : '#9aa0a8'; g.fillRect(Math.round(x), Math.round(y), 2, 2); }
        else if (f.kind === 'glint') { if ((t + i * 7) % 20 < 3) { const mx = fx + fw - 6, my = cy + dy + 2; g.fillStyle = '#ffffff'; g.fillRect(mx - 4, my, 9, 1); g.fillRect(mx, my - 4, 1, 9); } }
        else if (f.kind === 'ring') { g.strokeStyle = f.col; g.lineWidth = 1; g.beginPath(); g.ellipse(Math.round(cx), Math.round(cy + dy + 28), 8 + k * 50, 2 + k * 8, 0, 0, 7); g.stroke(); }
        else { g.fillStyle = i % 2 ? '#ffffff' : f.col; g.fillRect(Math.round(x), Math.round(y), 2, 2); }
      }
      g.globalAlpha = 1;
    }
    // The morsel: it drifts in from the right, turning and glowing, straight into the open mouth.
    if (t < BITE) {
      const k = smooth(t / (BITE - 2)), mx = fx + fw + 4, my = cy - 2, x = W + 30 + (mx - W - 30) * k, y = my - Math.sin(k * Math.PI) * 26, ms = 4 - k * 1.5, ic = ART.morsels[l.power];
      g.globalAlpha = .3; g.fillStyle = f.col; g.beginPath(); g.arc(Math.round(x), Math.round(y), 9 * ms / 2 + Math.sin(t / 3) * 2, 0, 7); g.fill(); g.globalAlpha = 1;
      if (ic) { g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(t * .08); g.scale(ms, ms); g.drawImage(ic, -4, -4); g.restore(); }
      if (t % 3 === 0) spawnMote(l, x, y, f.col);
      const food = l.food || (POWERS[l.power] || {}).food; if (food && t > 8) { g.globalAlpha = clamp01((t - 8) / 10) * clamp01((BITE - t) / 6); ART.text(g, food, W / 2, H - 40, '#fff6d6', 'center', '#120c18'); g.globalAlpha = 1; }
    }
    // Crumbs trail of the morsel and the bite's spray.
    for (let i = (l.trail || []).length - 1; i >= 0; i--) { const q = l.trail[i]; q.x += q.vx; q.y += q.vy; q.vy += .08; if (--q.life <= 0) { l.trail.splice(i, 1); continue; } g.globalAlpha = Math.min(1, q.life / 10); g.fillStyle = q.c; g.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); } g.globalAlpha = 1;
    if (t === BITE) for (let i = 0; i < 18; i++) (l.trail || (l.trail = [])).push({ x: fx + fw, y: cy, vx: 1 + Math.random() * 3, vy: -2 + Math.random() * 3, life: 20 + Math.random() * 20, c: i % 2 ? f.col : '#ffffff' });
    // ¡ÑAM!
    if (t >= BITE && t < BITE + 34) { const k = t - BITE, sc = k < 5 ? 2.2 - k * .2 : 1.2, a = clamp01((BITE + 34 - t) / 8); g.save(); g.translate(Math.round(fx + fw + 26), Math.round(cy - 40)); g.rotate(-.12); g.scale(sc, sc); g.globalAlpha = a; ART.title(g, '¡ÑAM!', 0, 0, '#fff6d6', 'center'); g.restore(); g.globalAlpha = 1; }
    // The bite's flash.
    if (t >= BITE && t < BITE + 6) { g.globalAlpha = (BITE + 6 - t) / 6 * .7; g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    // Brightening into the burst.
    if (rise > .8) { g.globalAlpha = (rise - .8) / .2 * .85; g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    // Letterbox.
    const bar = Math.round(18 * smooth(t / 12)); g.fillStyle = '#000000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    if (t > 20 && t < CINE - 10 && (t >> 4) % 2) { g.globalAlpha = .5; ART.text(g, Touch.enabled ? 'toca para saltar' : 'Z salta', W - 6, H - 13, '#8a86a8', 'right'); g.globalAlpha = 1; }
  }
  function spawnMote(l, x, y, c) { (l.trail || (l.trail = [])).push({ x: x + (Math.random() - .5) * 6, y: y + (Math.random() - .5) * 6, vx: .6 + Math.random() * .8, vy: -.4 + Math.random() * .6, life: 14 + Math.random() * 10, c: Math.random() < .4 ? '#ffffff' : c }); }

  // ---------------------------------------------------------------- Dibujo
  function keycaps(g, text, cx, y) {
    const m = Input.mode, map = m === 'touch' ? { jump: 'SALTO', fish: 'BIGOTES', puff: 'SOPLO', up: '▲', down: '▼' } : m === 'pad' ? { jump: 'A', fish: 'X', puff: 'B', up: '↑', down: '↓' } : { jump: 'Z', fish: 'X', puff: 'C', up: '↑', down: '↓' };
    const parts = text.split(/(\{\w+\})/).filter(Boolean).map(s => { const k = /^\{(\w+)\}$/.exec(s); return k ? { cap: map[k[1]] || k[1] } : { txt: s }; });
    const wOf = p => p.cap ? ART.textWidth(p.cap) + 8 : ART.textWidth(p.txt);
    let x = Math.round(cx - parts.reduce((a, p) => a + wOf(p), 0) / 2);
    for (const p of parts) {
      if (p.cap) { const w = wOf(p); g.fillStyle = '#120c18'; g.fillRect(x - 1, y - 3, w + 2, 14); g.fillStyle = '#e8e0cc'; g.fillRect(x, y - 2, w, 11); g.fillStyle = '#fffbe8'; g.fillRect(x, y - 2, w, 2); g.fillStyle = '#a89a80'; g.fillRect(x, y + 7, w, 2); ART.text(g, p.cap, x + w / 2, y, '#1b2430', 'center'); x += w + 2; }
      else { ART.text(g, p.txt, x, y, '#e8fbff', 'left'); x += wOf(p); }
    }
  }
  // Letters of the name drop in one by one, then a shine sweeps across them.
  function bigName(g, name, cx, cy, t) {
    const s = 2, total = ART.textWidth(name) * s; let x = cx - total / 2;
    for (let i = 0; i < name.length; i++) {
      const ch = name[i], w = ART.textWidth(ch) * s, k = Math.min(1, Math.max(0, (t - i * 2) / 10)), dy = (1 - ease(k)) * -14, bounce = k >= 1 ? 0 : Math.sin(k * Math.PI) * 2;
      if (k > 0) { g.save(); g.translate(Math.round(x), Math.round(cy + dy - bounce)); g.scale(s, s); g.globalAlpha = k; ART.text(g, ch, 0, 0, '#fff3b8', 'left', '#4a2e1a'); g.restore(); g.globalAlpha = 1; }
      x += w;
    }
    const sw = (t - name.length * 2 - 10) * 6; if (sw > 0 && sw < total + 40) { g.save(); g.beginPath(); g.rect(cx - total / 2 + sw - 20, cy - 4, 6, 20); g.clip(); g.save(); g.translate(Math.round(cx - total / 2), Math.round(cy)); g.scale(s, s); ART.text(g, name, 0, 0, '#ffffff', 'left'); g.restore(); g.restore(); }
  }
  // Tiny looping dioramas: each trick shown by a mini Nila and Bigotes.
  function demo(g, power, t, x0, y0, w, h) {
    const T = MUNDO.tiles(L.def.theme), ground = y0 + h - 10, N = ART.nila, run = N.run;
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    g.fillStyle = '#16202c'; g.fillRect(x0, y0, w, h); g.fillStyle = '#1e2c3a'; g.fillRect(x0, y0 + h * .55, w, h * .45);
    g.fillStyle = '#35222a'; g.fillRect(x0, ground, w, 10); g.fillStyle = '#7fb040'; g.fillRect(x0, ground, w, 2); g.fillStyle = '#5e8a2e'; for (let x = x0; x < x0 + w; x += 3) g.fillRect(x, ground - 1, 1, 1);
    const carry = (x, y, spr, fish, flip) => { g.save(); if (flip) { g.translate(x * 2 + 10, 0); g.scale(-1, 1); } Player.drawCarry(g, x, y - 18, spr, fish || ART.fish.closed, 0); g.restore(); };
    const loop = (n) => t % n, cx = x0 + w / 2;
    switch (power) {
      case 'aleteo': {
        const k = loop(100), x = x0 + 20 + k * .8; let y = ground, spr = N.idle[0];
        if (k > 10 && k < 70) { const a = k - 10, y1 = a < 24 ? -(a * 1.9 - a * a * .048) : -(24 * 1.9 - 24 * 24 * .048) - ((a - 24) * 1.6 - (a - 24) * (a - 24) * .042); y = ground + Math.min(0, y1); spr = a < 24 ? N.jump : a < 30 ? N.tuck : N.fall; if (a >= 24 && a < 30) { g.fillStyle = '#dff2fb'; const r = (a - 24) * 2; g.fillRect(Math.round(x - r), Math.round(y + 2), r * 2 + 10, 1); ART.text(g, 'FLAP', x + 8, y - 26, '#dff2fb', 'center'); } }
        carry(x, y, spr, ART.fish.closed); break; }
      case 'soplido': {
        const k = loop(90), sx = x0 + 70 + (k > 30 ? Math.min(40, (k - 30) * 2) : 0), sy = ground - 10 - (k > 30 && k < 50 ? Math.sin((k - 30) / 20 * Math.PI) * 8 : 0);
        carry(x0 + 18, ground, k > 22 && k < 32 ? N.brace || N.idle[0] : N.idle[0], k > 22 && k < 30 ? ART.fish.full : ART.fish.closed);
        if (sx < x0 + w - 4) g.drawImage(ART.snail[0], Math.round(sx), Math.round(sy));
        if (k >= 28 && k < 48) { const r = (k - 28) * 3; for (let s = 0; s < 5; s++) { g.fillStyle = s % 2 ? '#dff2fb' : '#ffffff'; for (let u = Math.max(0, r - 14); u < r; u++) g.fillRect(Math.round(x0 + 44 + u), Math.round(ground - 12 + (s - 2) * (2 + u * .12) + Math.sin(u * .3 + s) * 1), 1, 1); } }
        break; }
      case 'ventosa': {
        const wl = x0 + 26, wr = x0 + w - 36; for (let y = y0; y < ground; y += 16) { const rw = T.rootWall.mid[(y >> 4) & 1]; g.drawImage(rw, wl - 16, y); g.drawImage(rw, wr, y); }
        const k = loop(120), hop = Math.floor(k / 30), f = (k % 30) / 30, side = hop % 2, xa = side ? wr - 12 : wl + 2, xb = side ? wl + 2 : wr - 12, yb = ground - 12 - hop * 16, ya = yb + 16;
        const x = xa + (xb - xa) * f, y = ya + (yb - ya) * f - Math.sin(f * Math.PI) * 10; carry(x, y + 6, f < .15 ? N.wall || N.brace : N.jump, ART.fish.closed, xb < xa);
        break; }
      case 'chorro': {
        g.fillStyle = '#1d4446'; g.fillRect(x0 + 30, ground, w - 60, 10); g.fillStyle = '#8cc8a8'; g.fillRect(x0 + 30, ground, w - 60, 1);
        const k = loop(120), x = x0 + 16 + k * .9, y = ground - 26 + Math.sin(k / 8) * 2;
        carry(x, y, N.dangle ? N.dangle[(k >> 3) % 2] : N.fall, ART.fish.full); Game.drawStream(g, x + 20, y - 4, x + 20, ground, t, 1, 3);
        break; }
      case 'mordisco': {
        const rx = cx, ry = y0 + 14; g.fillStyle = '#d8e0e8'; g.fillRect(rx, y0, 1, ry - y0 - 6); Item.hookShape(g, rx, ry, (t % 110) < 30, t);
        const k = loop(110), up = k > 30 ? Math.min(1, (k - 30) / 30) : 0, y = ground - up * (ground - ry - 30);
        carry(cx - 10, y, up > 0 && up < 1 ? (N.dangle ? N.dangle[0] : N.jump) : N.idle[0], k > 20 ? ART.fish.open : ART.fish.closed);
        if (k > 20 && k < 34) { g.fillStyle = '#cfe8f0'; for (let i = 0; i < 4; i++) g.fillRect(rx - 2 + i, ry + 8 + ((k * 2 + i * 5) % 20), 1, 2); }
        if (k > 30 && k < 44) ART.text(g, '¡PICA!', rx + 12, ry - 6, '#f2c46a', 'center', '#1b2430');
        break; }
      case 'panzazo': {
        const bx = cx - 8, k = loop(110); if (k < 62) g.drawImage(T.cracked ? T.cracked[0] : ART.cracked, bx, ground - 16);
        const up = k < 30 ? Math.sin(k / 30 * Math.PI / 2) * 44 : k < 36 ? 44 : Math.max(0, 44 - (k - 36) * 3.5), y = ground - 16 - up + (k > 62 ? 16 : 0);
        carry(bx - 2, Math.min(y, ground), k >= 30 && k < 62 ? N.tuck : N.idle[0], ART.fish.closed);
        if (k >= 62 && k < 90) for (let i = 0; i < 10; i++) { const a = hash(i) * Math.PI, v = 1 + hash(i + 3) * 2, f = k - 62; g.fillStyle = i % 2 ? '#8a8f94' : '#4f545a'; g.fillRect(Math.round(bx + 8 + Math.cos(a) * v * f * (i % 2 ? 1 : -1)), Math.round(ground - 8 - Math.sin(a) * v * f + f * f * .1), 2, 2); }
        if (k >= 62 && k < 80) ART.text(g, '¡CRAC!', cx, ground - 40, '#d0d6da', 'center', '#1b2430');
        break; }
      case 'guindilla': {
        const hx = x0 + w - 30, k = loop(120); if (k < 80) g.drawImage(T.hard ? T.hard[0] : ART.hard, hx, ground - 16);
        const charging = k > 10 && k < 50, fired = k >= 50; carry(x0 + 14, ground, charging ? N.brace || N.idle[0] : N.idle[0], charging ? ART.fish.squint : ART.fish.full);
        if (charging && (k >> 1) % 2) { g.fillStyle = '#e79b3f'; g.fillRect(x0 + 46, ground - 14, 2, 2); }
        if (fired && k < 80) { const px = x0 + 46 + (k - 50) * 5; if (px < hx) { g.drawImage(ART.rock, Math.round(px), ground - 16); g.fillStyle = '#fff6d6'; g.fillRect(Math.round(px) - 12, ground - 11, 10, 1); } }
        if (k >= 76 && k < 100) { for (let i = 0; i < 10; i++) { const f = k - 76, a = hash(i + 7) * 3; g.fillStyle = i % 2 ? '#6f747c' : '#b98a3a'; g.fillRect(Math.round(hx + 8 + Math.cos(a) * f * 2), Math.round(ground - 8 - Math.sin(a) * f * 2 + f * f * .12), 2, 2); } ART.text(g, '¡ZAS!', hx, ground - 38, '#e79b3f', 'center', '#1b2430'); }
        break; }
      case 'resbalon': {
        g.fillStyle = '#35222a'; g.fillRect(cx - 20, y0, 40, ground - y0 - 13); g.fillStyle = '#281b25'; g.fillRect(cx - 20, ground - 15, 40, 2);
        const k = loop(100), x = x0 + 6 + k * 1.3, sliding = x > cx - 36 && x < cx + 24;
        carry(x, ground, sliding ? N.slide || N.crouch : run[(k >> 2) % 6], ART.fish.closed);
        if (sliding && k % 3 === 0) { g.fillStyle = '#c9b08a'; g.fillRect(Math.round(x - 2), ground - 2, 2, 1); }
        break; }
    }
    g.restore();
  }
  function draw(g) {
    const l0 = Game.learning; if (l0.t < CINE) { cineDraw(g, l0); return; }
    const l = l0, pw = POWERS[l.power], t = cardT(l), P = Player, px = Math.round(P.x - Cam.x) + 5, py = Math.round(P.y - Cam.y) + 8;
    const out = l.exit ? 1 - l.exit / EXIT : 1;
    // Darkness with a spotlight on Nila.
    const sc = shadeCanvas(), sg = sc.getContext('2d'), dark = Math.min(1, t / 20) * .82 * out, rad = 34 + Math.sin(t / 12) * 2;
    sg.clearRect(0, 0, W, H); sg.globalCompositeOperation = 'source-over'; sg.fillStyle = 'rgba(6,8,16,' + dark + ')'; sg.fillRect(0, 0, W, H);
    sg.globalCompositeOperation = 'destination-out'; const gr = sg.createRadialGradient(px, py, rad * .4, px, py, rad); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, W, H); sg.globalCompositeOperation = 'source-over';
    g.drawImage(sc, 0, 0);
    // Straight out of the burst: the white flash fades off the world and rings open around them.
    const since = l.t - CINE, fe = FEEL[l.power] || FEEL.aleteo;
    if (since < FLASH) {
      for (let i = 0; i < 3; i++) { const r = since * (3 + i * 1.6); g.globalAlpha = (1 - since / FLASH) * .9; g.strokeStyle = i ? fe.col : '#ffffff'; g.lineWidth = 2; g.beginPath(); g.arc(px, py, r, 0, 7); g.stroke(); }
    }
    // Absorption: golden sparks spiral into Bigotes.
    if (t < ABSORB + 6 && !l.exit) for (let i = 0; i < 26; i++) { const k = (t + i * 3) / ABSORB, u = Math.max(0, 1 - k), a = i * 2.4 + t * .15, r = u * 60; if (u <= 0) continue; g.fillStyle = i % 3 ? '#ffe36a' : '#fff6d6'; g.fillRect(Math.round(px + P.dir * 12 + Math.cos(a) * r), Math.round(py + Math.sin(a) * r * .7), 2, 2); }
    // The pose: Nila holds Bigotes up high, with rays behind.
    if (t >= ABSORB) {
      const k = Math.min(1, (t - ABSORB) / 14), lift = ease(k) * 6;
      g.save(); g.globalAlpha = out * Math.min(1, (t - ABSORB) / 10); g.translate(px, py - 30 - lift);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + t * .012, len = 70 + Math.sin(t / 10 + i) * 8; g.fillStyle = i % 2 ? 'rgba(255,227,106,.16)' : 'rgba(255,246,214,.1)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - .09) * len, Math.sin(a - .09) * len); g.lineTo(Math.cos(a + .09) * len, Math.sin(a + .09) * len); g.fill(); }
      g.restore();
      if (!l.exit) {
        const spr = ART.nila.win, fs = (t % 60) < 5 ? ART.fish.blink : ART.fish.full; g.drawImage(spr, px - 8, py + 10 - spr.height);
        g.save(); g.translate(px, py - 14 - lift); g.rotate(-Math.PI / 2 + Math.sin(t / 9) * .08); g.drawImage(fs, -fs.width / 2, -fs.height / 2); Player.fishOverlay(g, fs, -fs.width / 2, -fs.height / 2, t, { mood: t > 60 ? 'happy' : 'shock' }); g.restore();
        g.drawImage(ART.hand, px - 4, py - 10); g.drawImage(ART.hand, px + 1, py - 10);
      }
      // The morsel floats big above them.
      const ic = ART.morsels[l.power], iy = l.exit ? py - 52 + (32 - (py - 52)) * ease(l.exit / EXIT) : py - 52 + Math.sin(t / 14) * 2, ix = l.exit ? px + (17 - px) * ease(l.exit / EXIT) : px, is = l.exit ? 3 - 2 * ease(l.exit / EXIT) : 3 * ease(Math.min(1, (t - ABSORB) / 12));
      g.save(); g.translate(Math.round(ix), Math.round(iy)); g.globalAlpha = .35; g.fillStyle = '#ffe36a'; g.beginPath(); g.arc(0, 0, 6 * is, 0, 7); g.fill(); g.globalAlpha = 1; g.scale(is, is); g.drawImage(ic, -4, -4); g.restore();
      if (!l.exit && (t >> 3) % 3 === 0) { g.fillStyle = '#ffffff'; g.fillRect(px + 10, py - 62, 1, 5); g.fillRect(px + 8, py - 60, 5, 1); }
    }
    if (since < FLASH) { g.globalAlpha = Math.pow(1 - since / FLASH, 2); g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    if (l.exit) return;
    // The ribbon with the name.
    if (t >= NAME) {
      const k = ease(Math.min(1, (t - NAME) / 14)), ry = 22, rw = W * k;
      g.fillStyle = '#120c18'; g.fillRect(W / 2 - rw / 2, ry - 2, rw, 30); g.fillStyle = '#8a3a2a'; g.fillRect(W / 2 - rw / 2, ry, rw, 26); g.fillStyle = '#c8583e'; g.fillRect(W / 2 - rw / 2, ry, rw, 3); g.fillStyle = '#5a2020'; g.fillRect(W / 2 - rw / 2, ry + 23, rw, 3);
      if (k >= 1) { for (const s of [-1, 1]) { const ex = W / 2 + s * (W / 2); g.fillStyle = '#6a2a20'; g.beginPath(); g.moveTo(ex, ry - 2); g.lineTo(ex - s * 10, ry + 12); g.lineTo(ex, ry + 28); g.fill(); } }
      ART.title(g, '¡Bigotes ha aprendido!', W / 2, ry - 13, '#f2c46a', 'center');
      bigName(g, pw.name, W / 2, ry + 6, t - NAME - 8);
      if (t > NAME + 26) ART.text(g, l.giver ? l.giver + ' le ha dado ' + (l.food || pw.food) : 'Se ha tragado ' + pw.food, W / 2, ry + 32, '#cfe0e8', 'center', '#120c18');
    }
    // The demo box and the buttons.
    if (t >= DEMO) {
      const k = ease(Math.min(1, (t - DEMO) / 12)), bw = 150, bh = 64, bx = Math.round(W / 2 - bw / 2), by = Math.round(H - bh - 30 + (1 - k) * 60), onRight = px < W / 2;
      const dx = onRight ? Math.min(W - bw - 8, Math.max(bx, px + 50)) : Math.max(8, Math.min(bx, px - bw - 50));
      g.fillStyle = '#120c18'; g.fillRect(dx - 2, by - 2, bw + 4, bh + 4); g.fillStyle = '#e79b3f'; g.fillRect(dx - 1, by - 1, bw + 2, bh + 2);
      demo(g, l.power, t - DEMO, dx, by, bw, bh);
      keycaps(g, KEYS[l.power] || '', dx + bw / 2, by + bh + 6);
    }
    if (t >= READY && (t >> 4) % 2) ART.text(g, Touch.enabled ? 'Toca para seguir' : 'Z para seguir', W - 6, H - 10, '#fff6d6', 'right', '#120c18');
  }
  return { start, update, draw, posing };
})();
