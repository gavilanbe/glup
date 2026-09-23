// GLUP — historia. El prólogo que se ve antes del primer nivel: cómo la Garza se
// llevó a las crías de pez gato y por qué Bigotes es el único que queda. Viñetas
// animadas con el mismo arte del juego; se pasan con salto o Bigotes y Esc lo salta todo.
'use strict';
const Story = (() => {
  const PANELS = [
    { text: 'Cada verano, las crías de pez gato nacen bajo el embarcadero de Nila.', len: 200, draw: calm },
    { text: 'Pero aquel anochecer bajó la Garza.', len: 150, draw: swoop },
    { text: 'Se las tragó a todas, una tras otra, y voló río arriba con el buche lleno.', len: 170, draw: away },
    { text: 'A todas menos a una: la más pequeña, que se escondió entre los pilotes.', len: 170, draw: hidden },
    { text: 'Bigotes es pequeño, pero lo aprende todo comiendo. «Vamos a por ellas», dijo Nila.', len: 220, draw: together }];
  const S = { i: 0, t: 0, done: null, fish: [] };

  function start(done) {
    S.i = 0; S.t = 0; S.done = done; Game.state = 'story'; Sound.playMusic('dock');
    S.fish = []; for (let k = 0; k < 9; k++) S.fish.push({ x: 104 + Math.random() * 100, y: 136 + Math.random() * 14, d: Math.random() < .5 ? -1 : 1, v: .2 + Math.random() * .3, ph: Math.random() * 6 });
  }
  function finish() { Save.data.seen = Object.assign(Save.data.seen || {}, { prologue: true }); Save.write(); const f = S.done; S.done = null; Game.transition(f); }
  function shown() { return Math.min(PANELS[S.i].text.length, Math.floor(S.t * .9)); }
  function update() {
    S.t++;
    const P = PANELS[S.i], go = Input.pressed.jump || Input.pressed.fish || Input.pressed.confirm || Game.tapped; Game.tapped = false;
    if (S.t % 4 === 0 && shown() < P.text.length) Sound.play('text');
    if (Input.pressed.pause) { finish(); return; }
    if (go && shown() < P.text.length) { S.t = Math.ceil(P.text.length / .9); return; }
    if (go || S.t > P.len + P.text.length) { if (++S.i >= PANELS.length) { S.i = PANELS.length - 1; finish(); } else { S.t = 0; Sound.play('select'); } }
  }

  // ---- escenas
  function babies(g, t, scatter) {
    g.save(); g.beginPath(); g.rect(100, 132, 116, 48); g.clip();
    for (const f of S.fish) {
      if (scatter) { f.v = Math.min(f.v + .05, 2.2); }
      f.x += f.d * f.v; if (!scatter && (f.x < 102 || f.x > 206)) f.d = -f.d;
      const sp = ART.criaFree[((t + f.ph * 10) >> 3) % 2], y = Math.round(f.y + Math.sin(t / 14 + f.ph) * 1.5);
      g.drawImage(f.d < 0 ? ART.flip(sp) : sp, Math.round(f.x), y);
    }
    g.restore();
  }
  function nila(g, t, x, y, fish) {
    g.drawImage(ART.nila.idle[(t % 180) < 6 ? 1 : 0], x - 2, y - 2);
    if (fish) { g.drawImage((t % 150) < 5 ? ART.fish.blink : ART.fish.closed, x + 5, y + 6 + ((t >> 5) % 2)); g.drawImage(ART.hand, x + 11, y + 5 + ((t >> 5) % 2)); }
  }
  function heron(g, t, x, y, left, scale = 1, wing) {
    const body = ART.heronFly, wings = [ART.wingUp, ART.wingMid, ART.wingDown, ART.wingMid], wf = wing !== undefined ? wing : (t >> 3) % 4;
    g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(scale, scale);
    const d = (s, dx, dy) => { const sp = left ? s : ART.flip(s); const ox = left ? dx : body.width - dx - s.width; g.drawImage(sp, ox, dy); };
    d(wings[wf], 6, wf === 0 ? -10 : wf === 2 ? 8 : 2); d(body, 0, 0); g.restore();
  }
  function calm(g, t) { Game.drawScene(g, t, 'dusk'); babies(g, t, false); nila(g, t, 150, 108, false); }
  function swoop(g, t) {
    Game.drawScene(g, t, 'dusk'); const k = Math.min(1, t / 90);
    babies(g, t, t > 40);
    const hx = W + 20 - k * 230, hy = 10 + Math.sin(k * Math.PI) * 110;
    // The shadow slides over the water before she lands.
    g.globalAlpha = .3; g.fillStyle = '#0c1016'; g.fillRect(Math.round(hx), 150, 34, 3); g.globalAlpha = 1;
    heron(g, t, hx, hy, true, 1, k < 1 ? 2 : undefined);
    nila(g, t, 150, 108, false); if (t > 50) ART.text(g, '!', 157, 96 - ((t >> 2) % 2), '#f2c46a', 'center', '#1b2430');
    if (t > 55 && t < 110 && t % 6 === 0) { g.fillStyle = '#c8f2ea'; for (let i = 0; i < 6; i++) g.fillRect(Math.round(hx + 10 + Math.random() * 20), 130 - Math.random() * 12, 1, 2); }
  }
  function away(g, t) {
    Game.drawScene(g, t, 'dusk'); const k = Math.min(1, t / 160), sc = 1 - k * .75;
    heron(g, t, 90 - k * 70, 90 - k * 80, true, sc);
    nila(g, t, 150, 108, false);
    if ((t >> 4) % 3 === 0) ART.text(g, '...', 156, 96, '#fff6d6', 'center', '#1b2430');
  }
  function hidden(g, t) {
    Game.drawScene(g, t, 'dusk');
    // Two little eyes blink in the dark between the posts, then Bigotes peeks out.
    const peek = Math.min(14, Math.max(0, (t - 50) / 3)), blink = t < 50 && (t % 40) < 4;
    if (t < 50) { g.fillStyle = blink ? '#1d4a55' : '#fff6d6'; g.fillRect(208, 141, 1, 1); g.fillRect(211, 141, 1, 1); }
    else { g.drawImage((t % 90) < 5 ? ART.fish.blink : ART.fish.closed, 218 - Math.round(peek), 137 + ((t >> 4) % 2)); g.fillStyle = '#5a3a24'; g.fillRect(216, 134, 3, 30); }
    nila(g, t, 150, 108, false); if (t > 90) ART.text(g, '?', 157, 96, '#9fc0cc', 'center', '#1b2430');
  }
  function together(g, t) {
    Game.drawScene(g, t, 'dusk'); nila(g, t, 150, 108, true);
    if (t % 40 < 20) g.drawImage(ART.heart, 170, 92 - ((t % 40) >> 2));
    heron(g, t, 40, 30, true, .2);
  }

  function draw(g) {
    const P = PANELS[S.i]; g.save(); g.translate(0, -26); P.draw(g, S.t); g.restore();
    // Letterbox and caption.
    g.fillStyle = '#0a0d14'; g.fillRect(0, 0, W, 14); g.fillRect(0, H - 44, W, 44);
    g.fillStyle = '#e79b3f'; g.fillRect(0, H - 44, W, 1);
    const lines = ART.wrap(P.text, W - 40); let left = shown();
    lines.forEach((l, i) => { const s = l.slice(0, Math.max(0, left)); left -= l.length + 1; if (s) ART.text(g, s, 20, H - 36 + i * 10, '#fff6d6', 'left'); });
    for (let i = 0; i < PANELS.length; i++) { g.fillStyle = i === S.i ? '#f2c46a' : '#3a4a5a'; g.fillRect(W / 2 - PANELS.length * 4 + i * 8, 5, 5, 3); }
    ART.text(g, Touch.enabled ? 'Toca para seguir' : 'Esc: saltar', W - 4, H - 10, '#5f7899', 'right');
  }
  return { start, update, draw, get state() { return S; } };
})();
