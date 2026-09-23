// GLUP — aprender un truco. Como coger un objeto en Zelda: el mundo se para, las chispas
// entran en Bigotes, Nila lo alza con rayos de luz y fanfarria, el nombre cruza la pantalla
// en una cinta y un recuadro enseña el truco en bucle con los botones que tocan.
'use strict';
const Aprende = (() => {
  const ABSORB = 34, RAISE = 36, NAME = 80, DEMO = 118, READY = 150, EXIT = 22;
  const KEYS = {
    aleteo: '{jump} otra vez en el aire', soplido: 'Toca {fish} con la boca vacía', ventosa: '{jump} pegada al muro de raíces',
    chorro: 'Con agua, mantén {fish} en el aire', mordisco: '{up} y mantén {fish} hacia el aro', panzazo: '{down} y {jump} en el aire',
    guindilla: 'Mantén {fish} con la boca llena y suelta', resbalon: '{down} mientras corres' };
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : 1 - (1 - k) * (1 - k);
  let shade = null;
  function shadeCanvas() { if (!shade) { shade = document.createElement('canvas'); shade.width = W; shade.height = H; } return shade; }

  function start(power) { Game.learning = { power, t: 0, exit: 0 }; Sound.play('learn'); }
  function update() {
    const l = Game.learning; l.t++;
    Player.animT++; Player.sx += (1 - Player.sx) * .18; Player.sy += (1 - Player.sy) * .18; if (Player.swallowT > 0) Player.swallowT--;
    updateParts(); for (let i = L.words.length - 1; i >= 0; i--) { const w = L.words[i]; w.t++; if (w.t > w.life) L.words.splice(i, 1); }
    if (l.t === ABSORB) { Sound.play('win'); Cam.punch(1.06); Input.rumble(260, .7, .5); }
    if (l.t === NAME + 4) Sound.play('lantern');
    if (l.exit) { if (++l.exit > EXIT) { Game.learning = null; Sound.duck(false); Input.release(); } return; }
    const go = Input.pressed.jump || Input.pressed.fish || Input.pressed.confirm || Game.tapped; Game.tapped = false;
    if (go && l.t > 20 && l.t < READY) { l.t = READY; return; }
    if (go && l.t >= READY) { l.exit = 1; Sound.play('confirm'); }
  }
  // Player.draw steps aside while the pose is on.
  function posing() { const l = Game.learning; return l && l.t >= ABSORB && !l.exit; }

  // ---------------------------------------------------------------- Dibujo
  function keycaps(g, text, cx, y) {
    const m = Input.mode, map = m === 'touch' ? { jump: 'SALTO', fish: 'BIGOTES', up: '▲', down: '▼' } : m === 'pad' ? { jump: 'A', fish: 'X', up: '↑', down: '↓' } : { jump: 'Z', fish: 'X', up: '↑', down: '↓' };
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
        const rx = cx, ry = y0 + 14; g.drawImage(ART.ring, rx - 5, ry - 5);
        const k = loop(110), up = k > 30 ? Math.min(1, (k - 30) / 30) : 0, y = ground - up * (ground - ry - 30);
        carry(cx - 10, y, up > 0 && up < 1 ? (N.dangle ? N.dangle[0] : N.jump) : N.idle[0], k > 20 ? ART.fish.open : ART.fish.closed);
        if (k > 20 && k < 34) { g.fillStyle = '#cfe8f0'; for (let i = 0; i < 4; i++) g.fillRect(rx - 2 + i, ry + 8 + ((k * 2 + i * 5) % 20), 1, 2); }
        if (k > 60 && k < 70) ART.text(g, '¡ARO!', rx, ry - 12, '#f2c46a', 'center', '#1b2430');
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
    const l = Game.learning, pw = POWERS[l.power], t = l.t, P = Player, px = Math.round(P.x - Cam.x) + 5, py = Math.round(P.y - Cam.y) + 8;
    const out = l.exit ? 1 - l.exit / EXIT : 1;
    // Darkness with a spotlight on Nila.
    const sc = shadeCanvas(), sg = sc.getContext('2d'), dark = Math.min(1, t / 20) * .82 * out, rad = 34 + Math.sin(t / 12) * 2;
    sg.clearRect(0, 0, W, H); sg.globalCompositeOperation = 'source-over'; sg.fillStyle = 'rgba(6,8,16,' + dark + ')'; sg.fillRect(0, 0, W, H);
    sg.globalCompositeOperation = 'destination-out'; const gr = sg.createRadialGradient(px, py, rad * .4, px, py, rad); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, W, H); sg.globalCompositeOperation = 'source-over';
    g.drawImage(sc, 0, 0);
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
    if (l.exit) return;
    // The ribbon with the name.
    if (t >= NAME) {
      const k = ease(Math.min(1, (t - NAME) / 14)), ry = 22, rw = W * k;
      g.fillStyle = '#120c18'; g.fillRect(W / 2 - rw / 2, ry - 2, rw, 30); g.fillStyle = '#8a3a2a'; g.fillRect(W / 2 - rw / 2, ry, rw, 26); g.fillStyle = '#c8583e'; g.fillRect(W / 2 - rw / 2, ry, rw, 3); g.fillStyle = '#5a2020'; g.fillRect(W / 2 - rw / 2, ry + 23, rw, 3);
      if (k >= 1) { for (const s of [-1, 1]) { const ex = W / 2 + s * (W / 2); g.fillStyle = '#6a2a20'; g.beginPath(); g.moveTo(ex, ry - 2); g.lineTo(ex - s * 10, ry + 12); g.lineTo(ex, ry + 28); g.fill(); } }
      ART.text(g, '¡Bigotes ha aprendido!', W / 2, ry - 12, '#f2c46a', 'center', '#120c18');
      bigName(g, pw.name, W / 2, ry + 6, t - NAME - 8);
      if (t > NAME + 26) ART.text(g, 'Se ha tragado ' + pw.food, W / 2, ry + 32, '#cfe0e8', 'center', '#120c18');
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
