// GLUP — motor del juego: entrada, física, entidades, cámara, dibujo y estados.
'use strict';
const W = 320, H = 180, TS = 16;
const $ = id => document.getElementById(id);
const params_debug = () => /(?:\?|&)debug=1/.test(location.search);

// ---------------------------------------------------------------- Entrada
const Input = {
  held: {}, pressed: {}, keyHeld: {}, padHeld: {}, touchHeld: {}, mode: 'keys', anyKey: false, padSeen: false,
  KEYS: { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    KeyZ: 'jump', KeyK: 'jump', Space: 'jump', KeyX: 'fish', KeyJ: 'fish', KeyC: 'puff', KeyL: 'puff', Enter: 'confirm', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', KeyF: 'fullscreen' },
  init() {
    addEventListener('keydown', e => {
      const a = Input.KEYS[e.code]; if (!a) return; e.preventDefault();
      if (!Input.keyHeld[a]) { Input.press(a); } Input.keyHeld[a] = true; Input.mode = 'keys'; Input.sync();
    });
    addEventListener('keyup', e => { const a = Input.KEYS[e.code]; if (!a) return; Input.keyHeld[a] = false; Input.sync(); });
    addEventListener('blur', () => Input.release());
    addEventListener('gamepadconnected', () => { Input.padSeen = true; });
  },
  press(a) { Input.pressed[a] = true; Input.anyKey = true; Sound.init(); },
  sync() { for (const a of new Set([...Object.keys(Input.keyHeld), ...Object.keys(Input.padHeld), ...Object.keys(Input.touchHeld)])) Input.held[a] = !!(Input.keyHeld[a] || Input.padHeld[a] || Input.touchHeld[a]); },
  release() { Input.keyHeld = {}; Input.padHeld = {}; Input.touchHeld = {}; Input.held = {}; Input.pressed = {}; Touch.release(); },
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : []; let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) return;
    const b = i => !!(pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > .5));
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    const next = { left: b(14) || ax < -.4, right: b(15) || ax > .4, up: b(12) || ay < -.5, down: b(13) || ay > .5, jump: b(0), fish: b(2) || b(5) || b(7), puff: b(1) || b(4) || b(6), pause: b(9), confirm: b(0) };
    let any = false;
    for (const a in next) { if (next[a] && !Input.padHeld[a]) { Input.press(a); any = true; } Input.padHeld[a] = next[a]; if (next[a]) any = true; }
    if (any) Input.mode = 'pad';
    Input.sync();
  },
  endFrame() { Input.pressed = {}; },
  rumble(ms, strong, weak) {
    // On a phone the same moments buzz the hand: only the ones with weight, kept short.
    if (Input.mode === 'touch' && strong >= .3) Touch.buzz(Math.round(Math.min(45, 6 + ms * .12 * strong)));
    if (Game.still || !navigator.getGamepads) return;
    for (const p of navigator.getGamepads()) { const a = p && p.vibrationActuator; if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => { }); }
  }
};

// Touch shell: a floating lily-pad stick under the left thumb and pixel-art buttons under the right one.
// The buttons read the game every frame: Bigotes' face and what he will do ("sorbe", "escupe", "flota"),
// the inhale steps and the charge on a ring, what the jump will be, and a "hablar" bubble when someone is near.
const Touch = {
  enabled: false, portrait: false, pointers: new Map(), buttons: [], dirs: new Set(), stick: { id: null, ox: 0, oy: 0 }, keys: {},
  forced: /(?:\?|&)touch=1(?:&|$)/.test(location.search),
  init() {
    Touch.buttons = [...document.querySelectorAll('[data-act]')];
    for (const b of Touch.buttons) {
      const act = b.dataset.act;
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        if (act === 'pause' || act === 'mute' || act === 'fullscreen') { Sound.init(); Input.press(act); Input.mode = 'touch'; Touch.buzz(10); return; }
        Touch.pointers.set(e.pointerId, act); b.setPointerCapture && b.setPointerCapture(e.pointerId); Touch.buzz(act === 'jump' ? 12 : 9); Touch.ripple(b); Touch.apply();
      });
      const end = e => { if (Touch.pointers.has(e.pointerId)) { Touch.pointers.delete(e.pointerId); Touch.apply(); } };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end); b.addEventListener('lostpointercapture', end);
      b.addEventListener('contextmenu', e => e.preventDefault());
    }
    // The stick: it appears under the thumb wherever it lands on the left, and follows if the thumb runs off.
    const zone = $('stick-zone'), st = $('stick'), S = Touch.stick;
    zone.addEventListener('pointerdown', e => {
      e.preventDefault(); if (S.id !== null) return; S.id = e.pointerId; zone.setPointerCapture && zone.setPointerCapture(e.pointerId);
      const r = zone.getBoundingClientRect(); S.ox = clamp(e.clientX - r.left, 60, r.width - 30); S.oy = clamp(e.clientY - r.top, 60, r.height - 60);
      st.classList.remove('snap'); st.classList.add('on'); st.style.left = S.ox + 'px'; st.style.top = S.oy + 'px'; Sound.init(); Input.mode = 'touch';
      Touch.stickMove(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', e => { if (e.pointerId === S.id) Touch.stickMove(e.clientX, e.clientY); });
    const up = e => {
      if (e.pointerId !== S.id) return; S.id = null;
      st.classList.add('snap'); st.classList.remove('on'); st.style.left = ''; st.style.top = ''; Touch.knob.style.transform = '';
      Touch.dirs = new Set(); Touch.apply(); Touch.drawBase();
    };
    zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up); zone.addEventListener('lostpointercapture', up);
    zone.addEventListener('contextmenu', e => e.preventDefault());
    Touch.knob = st.querySelector('.knob'); Touch.base = st.querySelector('.base').getContext('2d');
    const btn = a => Touch.buttons.find(b => b.dataset.act === a);
    Touch.btn = { fish: btn('fish'), jump: btn('jump'), puff: btn('puff'), talk: btn('up') };
    Touch.ctx = {}; for (const k in Touch.btn) Touch.ctx[k] = Touch.btn[k].querySelector('canvas').getContext('2d');
    Touch.drawBase(); Touch.drawKnob();
    Touch.layout(); addEventListener('resize', Touch.layout);
  },
  stickMove(cx, cy) {
    const S = Touch.stick, r = $('stick-zone').getBoundingClientRect(), sc = Touch.portrait ? 1.12 : innerHeight <= 380 ? .82 : 1, R = 38 * sc, FOLLOW = 64 * sc;
    let dx = cx - r.left - S.ox, dy = cy - r.top - S.oy, len = Math.hypot(dx, dy);
    if (len > FOLLOW) { const k = (len - FOLLOW) / len; S.ox += dx * k; S.oy += dy * k; dx -= dx * k; dy -= dy * k; len = FOLLOW; const st = $('stick'); st.style.left = S.ox + 'px'; st.style.top = S.oy + 'px'; }
    const k = len > R ? R / len : 1; Touch.knob.style.transform = 'translate(' + (dx * k / sc).toFixed(1) + 'px,' + (dy * k / sc).toFixed(1) + 'px)';
    // Eight ways, but a stricter cone for ↓ (crouching mid-run by accident is the worst) and a dead zone.
    const d = new Set();
    if (len > 12 * sc) { const c = dx / len, sn = dy / len; if (c > .38) d.add('right'); if (c < -.38) d.add('left'); if (sn < -.55) d.add('up'); if (sn > .62) d.add('down'); }
    const was = [...Touch.dirs].sort().join(), now = [...d].sort().join();
    if (was !== now) { Touch.dirs = d; if (now && (d.has('up') || d.has('down') || !was)) Touch.buzz(5); Touch.apply(); Touch.drawBase(); }
  },
  apply() {
    const held = new Set([...Touch.pointers.values(), ...Touch.dirs]);
    for (const a of ['left', 'right', 'up', 'down', 'jump', 'fish', 'puff']) {
      const now = held.has(a); if (now && !Input.touchHeld[a]) { Input.press(a); Input.mode = 'touch'; } Input.touchHeld[a] = now;
    }
    const pressed = new Set(Touch.pointers.values());
    for (const b of Touch.buttons) b.classList.toggle('held', pressed.has(b.dataset.act));
    Input.sync();
  },
  release() { Touch.pointers.clear(); Touch.dirs = new Set(); for (const b of Touch.buttons) b.classList.remove('held'); if (Touch.knob) { Touch.knob.style.transform = ''; Touch.stick.id = null; $('stick').classList.remove('on'); } },
  buzz(ms) { if (!Touch.enabled || Game.still || Save.data.noBuzz) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* not on this phone */ } },
  ripple(b) { b.classList.remove('ripple'); void b.offsetWidth; b.classList.add('ripple'); },
  layout() {
    const coarse = matchMedia('(any-pointer: coarse)').matches;
    Touch.enabled = Touch.forced || coarse || (innerWidth <= 900 && innerHeight <= 500);
    Touch.portrait = innerHeight > innerWidth;
    document.body.classList.toggle('touch', Touch.enabled);
    document.body.classList.toggle('portrait', Touch.enabled && Touch.portrait);
    Screen.fit();
  },
  // ---- pixel art for the pads
  disc(g, cx, cy, r, col, test) { g.fillStyle = col; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * .8 && (!test || test(x, y))) g.fillRect(cx + x, cy + y, 1, 1); },
  drawBase() {
    // A lily pad with its notch, veins and four arrows that light up gold with the direction held.
    const g = Touch.base, c = 33, D = Touch.dirs; g.clearRect(0, 0, 66, 66);
    const notch = (x, y) => !(y < 0 && Math.abs(x) < -y * .35);
    Touch.disc(g, c, c + 1, 31, '#1b1420', notch); Touch.disc(g, c, c, 30, '#2f6a3a', notch); Touch.disc(g, c, c - 1, 28, '#3f8a44', notch); Touch.disc(g, c - 3, c - 5, 20, '#4fa24c', (x, y) => notch(x + 3, y - 5) && x * x + y * y < 380);
    g.fillStyle = '#2f6a3a'; for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + .6 + k * .74; for (let r = 5; r < 26; r += 1) g.fillRect(Math.round(c + Math.cos(a) * r), Math.round(c + Math.sin(a) * r), 1, 1); }
    g.fillStyle = '#8fd06a'; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.28 + 2.2; g.fillRect(Math.round(c + Math.cos(a) * 29), Math.round(c - 1 + Math.sin(a) * 28), 1, 1); }
    const arrow = (dir, x, y) => {
      const on = D.has(dir), shape = { up: [[0, -3], [-1, -2], [0, -2], [1, -2], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1]], down: [[0, 3], [-1, 2], [0, 2], [1, 2], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1]], left: [[-3, 0], [-2, -1], [-2, 0], [-2, 1], [-1, -2], [-1, -1], [-1, 0], [-1, 1], [-1, 2]], right: [[3, 0], [2, -1], [2, 0], [2, 1], [1, -2], [1, -1], [1, 0], [1, 1], [1, 2]] }[dir];
      g.fillStyle = '#1b1420'; for (const [a, b] of shape) g.fillRect(x + a, y + b + 1, 1, 1);
      g.fillStyle = on ? '#fff6d6' : '#cfe8c0'; for (const [a, b] of shape) g.fillRect(x + a, y + b, 1, 1);
      if (on) { g.fillStyle = '#f2c43d'; for (const [a, b] of shape.slice(4)) g.fillRect(x + a, y + b, 1, 1); }
    };
    arrow('up', c, 9); arrow('down', c, 57); arrow('left', 9, c); arrow('right', 57, c);
  },
  drawKnob() {
    // A fat water bubble with a shine, like the ones the crías sleep in.
    const g = Touch.knob.getContext('2d'); g.clearRect(0, 0, 31, 31);
    Touch.disc(g, 15, 16, 14, '#1b1420'); Touch.disc(g, 15, 15, 13, '#6fb8c8'); Touch.disc(g, 14, 14, 11, '#a8e0e8'); Touch.disc(g, 13, 12, 7, '#d8f6f8');
    g.fillStyle = '#ffffff'; g.fillRect(9, 7, 4, 2); g.fillRect(8, 9, 2, 2); g.fillStyle = '#5a9ab0'; for (let k = 0; k < 9; k++) g.fillRect(Math.round(15 + Math.cos(.3 + k * .18) * 12), Math.round(15 + Math.sin(.3 + k * .18) * 12), 1, 1);
  },
  label(g, text, x, y, col) { ART.text(g, text, x, y, col, 'center', '#120c18'); },
  drawFish(g, t) {
    const p = Player, held = p.held, full = p.charge >= CHARGE_FULL; g.clearRect(0, 0, 36, 36);
    const face = p.spitT > 6 ? ART.fish.spit : full ? ART.fish.squint : held ? ART.fish.full : p.sucking ? ART.fish.open : (t % 200) < 6 ? ART.fish.blink : ART.fish.closed;
    const jit = p.sucking ? ((t >> 1) & 1) * (p.suckLv || 1) * .5 : full ? ((t >> 1) & 1) : 0, fx = Math.round(5 + jit), fy = 5 + (held ? 0 : Math.round(Math.sin(t / 20)));
    g.drawImage(face, fx, fy); Player.fishOverlay(g, face, fx, fy, t, { noWhiskers: true, mood: p.sucking || p.charge > 8 ? 'mad' : null, lx: 1 });
    if (p.sucking) { g.fillStyle = p.suckLv === 3 ? '#fff6d6' : '#cfe8f0'; for (let i = 0; i < 2 + p.suckLv; i++) { const k = (t * (.1 + p.suckLv * .04) + i / (2 + p.suckLv)) % 1; g.fillRect(Math.round(34 - k * 7), 7 + i * 2, 2, 1); } }
    const lab = full ? '¡zas!' : held ? (held.kind === 'agua' && !p.onGround ? 'flota' : 'escupe') : 'sorbe';
    Touch.label(g, lab, 18, 21, full ? '#f2c46a' : p.sucking ? '#fff6d6' : held ? '#bdf0d0' : '#e8fbff');
  },
  drawJump(g, t) {
    const p = Player; g.clearRect(0, 0, 36, 36);
    const air = !p.onGround && !p.grapple, lab = p.hanging || p.grapple ? 'suelta' : air && Input.held.down && Game.has('panzazo') ? 'panzazo' : air && p.airJumps > 0 && Game.has('aleteo') ? 'aletea' : 'salta';
    const N = ART.nila, spr = lab === 'panzazo' ? N.fall : lab === 'aletea' ? N.jump : N.jump, bob = lab === 'salta' ? Math.round(Math.abs(Math.sin(t / 14)) * -2) : 0;
    g.drawImage(spr, 10, 0 + bob);
    if (lab === 'aletea') { g.fillStyle = '#e8fbff'; const f = (t >> 3) & 1; g.fillRect(6, 10 + f, 3, 1); g.fillRect(27, 10 + f, 3, 1); g.fillRect(5, 12 - f, 2, 1); g.fillRect(29, 12 - f, 2, 1); }
    if (lab === 'panzazo') { g.fillStyle = '#f2c46a'; for (let i = 0; i < 3; i++) g.fillRect(12 + i * 5, 2 + ((t + i * 3) % 6), 1, 3); }
    Touch.label(g, lab, 18, 23, lab === 'salta' ? '#fff6d6' : '#f2c46a');
  },
  drawPuff(g, t) {
    // Swirling gust lines; crouched with the slide learnt, a sled arrow instead.
    const p = Player; g.clearRect(0, 0, 24, 24);
    if (!Game.has('soplido')) { g.fillStyle = '#1b1420'; g.fillRect(7, 11, 10, 8); g.fillStyle = '#9fa8b0'; g.fillRect(8, 12, 8, 6); g.fillRect(9, 6, 1, 6); g.fillRect(14, 6, 1, 6); g.fillRect(9, 5, 6, 1); g.fillStyle = '#1b1420'; g.fillRect(11, 14, 2, 2); return; }
    if (p.crouch && p.onGround && Game.has('resbalon') && !p.held) {
      const k = (t >> 2) % 4; g.fillStyle = '#1b1420'; g.fillRect(3, 15, 18, 3); g.fillStyle = '#e8b878'; g.fillRect(4, 15, 16, 2); g.fillStyle = '#fff6d6';
      for (let i = 0; i < 3; i++) g.fillRect(2 + ((i * 6 + k * 2) % 14), 9 + i * 2, 5, 1); g.fillRect(17, 9, 1, 5); g.fillRect(18, 10, 1, 3); g.fillRect(19, 11, 1, 1); return;
    }
    const k = t * .12;
    for (let i = 0; i < 3; i++) {
      const y = 7 + i * 5, len = 14 - i * 2, off = Math.round(((k + i * .7) % 1) * 3);
      g.fillStyle = '#1b1420'; g.fillRect(3 + off, y + 1, len, 1);
      g.fillStyle = i === 1 ? '#ffffff' : '#bfe6f5'; g.fillRect(3 + off, y, len, 1); g.fillRect(3 + off + len, y - 1, 2, 1); g.fillRect(3 + off + len + 2, y, 1, 2);
    }
  },
  drawTalk(g, t) { g.clearRect(0, 0, 48, 14); g.fillStyle = '#1b1420'; const ax = 5, ay = 3 + ((t >> 4) & 1); g.fillRect(ax, ay, 1, 1); g.fillRect(ax - 1, ay + 1, 3, 1); g.fillRect(ax - 2, ay + 2, 5, 1); ART.text(g, 'hablar', 27, 1, '#1b1420', 'center'); },
  // Called every frame: redraw a face only when what it says changes (and animate the busy ones).
  // Portrait: a little phone that tips over, "gira el móvil", in the game's own letters.
  drawHint(t) {
    const c = $('rotate-hint'), g = c.getContext('2d'), k = (t % 180) / 180, a = k < .35 ? 0 : k < .55 ? (k - .35) / .2 : k < .85 ? 1 : 1 - (k - .85) / .15; g.clearRect(0, 0, 104, 18);
    const w = 6 + a * 4, h = 10 - a * 4, x = 8 - w / 2, y = 9 - h / 2;
    g.fillStyle = '#1b1420'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, Math.round(w) + 2, Math.round(h) + 2); g.fillStyle = '#9fc0cc'; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); g.fillStyle = '#2f7f88'; g.fillRect(Math.round(x) + 1, Math.round(y) + 1, Math.round(w) - 2, Math.round(h) - 2);
    ART.text(g, 'gira el móvil', 18, 3, '#9fc0cc', 'left', '#0a0610');
  },
  updateButtons() {
    if (Touch.enabled && Touch.portrait && Game.t % 3 === 0 && $('rotate-hint')) Touch.drawHint(Game.t);
    if (!Touch.enabled || !Touch.btn || Game.state !== 'play' || !L.def) return;
    const p = Player, t = Game.t, B = Touch.btn, K = Touch.keys;
    const talk = !Charla.active() && !Game.learning && !Maestros.busy() && !p.dead && !!((L.maestro && L.maestro.near) || L.ents.some(e => e.kind === 'ruca' && e.near));
    B.talk.classList.toggle('show', talk); if (talk && K.talk !== (t >> 4)) { K.talk = t >> 4; Touch.drawTalk(Touch.ctx.talk, t); }
    const fk = [p.held ? p.held.kind : '', p.sucking ? p.suckLv : 0, p.charge >= CHARGE_FULL, p.spitT > 6, p.onGround, p.sucking || p.charge >= CHARGE_FULL ? t >> 1 : t >> 3].join();
    if (K.fish !== fk) { K.fish = fk; Touch.drawFish(Touch.ctx.fish, t); }
    const ring = p.sucking ? (p.suckLv || 1) / 3 : p.charge > 8 ? Math.min(1, p.charge / CHARGE_FULL) : 0;
    B.fish.style.setProperty('--charge', ring.toFixed(3)); B.fish.style.setProperty('--charge-col', p.sucking ? (p.suckLv === 3 ? '#fff6d6' : '#8fe0f0') : '#f2c46a');
    B.fish.classList.toggle('full', p.charge >= CHARGE_FULL || (p.sucking && p.suckLv === 3));
    const jk = [p.onGround, p.airJumps, !!Input.held.down, !!p.grapple, t >> 2].join(); if (K.jump !== jk) { K.jump = jk; Touch.drawJump(Touch.ctx.jump, t); }
    const slide = p.crouch && p.onGround && Game.has('resbalon') && !p.held;
    const pk = [Game.has('soplido'), slide, t >> 2].join(); if (K.puff !== pk) { K.puff = pk; Touch.drawPuff(Touch.ctx.puff, t); }
    B.puff.classList.toggle('locked', !Game.has('soplido')); B.puff.classList.toggle('hot', slide);
  }
};

// ---------------------------------------------------------------- Pantalla
const Screen = {
  canvas: null, ctx: null, buf: null, g: null, k: 1, scale: 1, rect: null,
  init() {
    Screen.canvas = $('c'); Screen.ctx = Screen.canvas.getContext('2d');
    Screen.buf = document.createElement('canvas'); Screen.buf.width = W; Screen.buf.height = H; Screen.g = Screen.buf.getContext('2d');
    Screen.g.imageSmoothingEnabled = false;
    addEventListener('resize', Screen.fit); Screen.fit();
    if (window.visualViewport) visualViewport.addEventListener('resize', Screen.fit);
  },
  fit() {
    const box = $('screen').getBoundingClientRect();
    const cw = Math.max(1, box.width), ch = Math.max(1, box.height - (Touch.enabled ? 0 : 22));
    let s = Math.min(cw / W, ch / H);
    if (!Touch.enabled && s >= 1) s = Math.floor(s);
    if (!Touch.enabled && s < 1) s = Math.max(.5, s);
    Screen.scale = s; if (params_debug()) console.log('FIT', box.width, box.height, cw, ch, s, Touch.enabled, Touch.portrait, innerWidth, innerHeight);
    const k = Math.max(1, Math.min(4, Math.ceil(s))); Screen.k = k;
    Screen.canvas.width = W * k; Screen.canvas.height = H * k;
    Screen.canvas.style.width = Math.floor(W * s) + 'px'; Screen.canvas.style.height = Math.floor(H * s) + 'px';
    Screen.ctx.imageSmoothingEnabled = false;
  },
  present() { const c = Screen.ctx; c.imageSmoothingEnabled = false; c.drawImage(Screen.buf, 0, 0, W * Screen.k, H * Screen.k); },
  toGame(clientX, clientY) { const r = Screen.canvas.getBoundingClientRect(); return { x: (clientX - r.left) / r.width * W, y: (clientY - r.top) / r.height * H }; }
};

// ---------------------------------------------------------------- Guardado
const Save = {
  // Version 2: everything per level is keyed by the level's stable id (LEVELS[i].id), not by its place in the list.
  //   abiertos {id: true}      places reached on the map (every place up to the furthest one can be played again)
  //   crias {id: {'x,y': 1}}   which crías of each level are home (tile keys; 'garza:k' for the ones in the heron's crop)
  //   best {id: secs}   powers {power: true}   seen {flags}
  data: null,
  fresh() { return { version: 2, abiertos: {}, crias: {}, best: {}, mute: false, finished: false, powers: {}, seen: {} }; },
  has(p) { return !!Save.data.powers[p]; },
  load() {
    Save.data = Save.fresh();
    try { const s = localStorage.getItem('glup.v1'); if (s) { const d = JSON.parse(s); Object.assign(Save.data, d.version >= 2 ? d : Save.migrate(d)); } } catch (e) { }
  },
  // The first saves counted by position in a list of five levels: move them over to ids.
  migrate(old) {
    const OLD = ['embarcadero', 'juncos', 'molino', 'cueva', 'nido'], d = Save.fresh();
    d.mute = !!old.mute; d.finished = !!old.finished; d.powers = old.powers || {}; d.seen = old.seen || {};
    for (let i = 0; i <= Math.min(old.unlocked || 0, OLD.length - 1); i++) d.abiertos[OLD[i]] = true;
    for (const i in old.best || {}) if (OLD[i]) d.best[OLD[i]] = old.best[i];
    // Only how many crías were counted, not which: take the first ones of the level, in reading order.
    for (const i in old.pearls || {}) { const def = LEVELS[NIVEL.index(OLD[i])]; if (!def) continue; const set = d.crias[OLD[i]] = {}; NIVEL.criasDe(def).slice(0, old.pearls[i]).forEach(k => { set[k] = 1; }); }
    return d;
  },
  write() { try { localStorage.setItem('glup.v1', JSON.stringify(Save.data)); } catch (e) { } },
  // The furthest place reached; everything up to it can be played.
  reached() { let m = 0; LEVELS.forEach((def, i) => { if (Save.data.abiertos[def.id]) m = i; }); return m; },
  open(i) { const def = LEVELS[i]; if (def && !Save.data.abiertos[def.id]) { Save.data.abiertos[def.id] = true; Save.write(); } },
  criasSet(id) { return Save.data.crias[id] || (Save.data.crias[id] = {}); },
  // Crías of a level that are home (only keys the current layout still has, so an edited level never over-counts).
  criasGot(i) { const def = LEVELS[i], set = Save.data.crias[def.id] || {}; let n = NIVEL.criasDe(def).filter(k => set[k]).length; if (def.boss) for (let k = 0; k < Boss.CRIAS; k++) if (set['garza:' + k]) n++; return n; },
  criasTotal(i) { const def = LEVELS[i]; return NIVEL.criasDe(def).length + (def.boss ? Boss.CRIAS : 0); },
  criasAll() { let got = 0, all = 0; LEVELS.forEach((d, i) => { got += Save.criasGot(i); all += Save.criasTotal(i); }); return { got, all }; },
  // What the wall of thorns counts: crías home from every other level.
  gateCount(i) { let n = 0; LEVELS.forEach((d, k) => { if (k !== i) n += Save.criasGot(k); }); return n; },
  locked(i) { const r = LEVELS[i] && LEVELS[i].requiere; return !!(r && r.crias && Save.gateCount(i) < r.crias); }
};

// ---------------------------------------------------------------- Utilidades
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rnd = (a, b) => a + Math.random() * (b - a);
const key = (x, y) => x + ',' + y;

// ---------------------------------------------------------------- Nivel
const L = { rows: null, t: null, w: 0, h: 0, def: null, index: 0, ents: [], projs: [], parts: [], solids: [], signs: [], broken: new Set(), targets: new Map(), gates: [], gateOpen: new Set(), lit: new Set(), taken: new Set(), start: null, checkpoint: null, pearlsTotal: 0, pearls: 0, time: 0, bg: null, boss: null, breakQueue: [], gateQueue: [], mush: new Map(), hitTargets: new Set(), boatSpawned: false, exit: null, words: [], ghosts: [], lily: new Map(), triggerIdx: new Map() };
const SOLID = { '#': 1, 'x': 1, 'G': 1, 'X': 1, 'M': 1 };
// Above the level, a solid top row carries on upward (a head may poke 16 px above it, but no one can
// stand and walk along the top of a closed level).
function tileAt(tx, ty) { if (tx < 0 || tx >= L.w) return '#'; if (ty < 0) return ty < -1 && L.t[0][tx] === '#' ? '#' : '.'; if (ty >= L.h) return '.'; return L.t[ty][tx]; }
function setTile(tx, ty, ch) { if (tx >= 0 && tx < L.w && ty >= 0 && ty < L.h) L.t[ty][tx] = ch; }
function solidChar(ch) { return SOLID[ch] === 1; }
function rectSolid(x, y, w, h, self) {
  const x0 = Math.floor(x) >> 4, x1 = Math.floor(x + w - .001) >> 4, y0 = Math.floor(y) >> 4, y1 = Math.floor(y + h - .001) >> 4;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidChar(tileAt(tx, ty))) return true;
  for (const s of L.solids) if (s !== self && !s.dead && s.solid && s.resting && !(s.ghost && self === Player) && x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y) return true;
  return false;
}
// One-way platform tops crossed when moving down from bottom `b0` to `b1` for the horizontal span [x, x+w).
function oneWayBelow(x, w, b0, b1, self) {
  const x0 = Math.floor(x) >> 4, x1 = Math.floor(x + w - .001) >> 4;
  for (let ty = Math.floor(b0 / TS) - 1; ty <= Math.floor((b1 - .001) / TS); ty++) for (let tx = x0; tx <= x1; tx++) {
    const ch = tileAt(tx, ty); if (ch !== '=' && ch !== 'w' && ch !== '%') continue;
    const top = ty * TS + (ch === '%' ? 6 : 0); if (b0 <= top + 1e-6 && b1 > top) return { top, ch, tx, ty };   // .01: rounding must not drop her through
  }
  for (const s of L.solids) if (s !== self && !s.dead && s.platform && x < s.x + s.w && x + w > s.x && b0 <= s.y + 3 + Math.abs(s.vx || 0) && b1 > s.y) return { top: s.y, ch: s.kind, ent: s };   // a little slack: a bobbing raft must not drop her
  return null;
}
function moveX(e, dx) {
  const s = Math.sign(dx); let rem = Math.abs(dx);
  while (rem > 0) { const st = Math.min(1, rem); const nx = e.x + s * st; if (rectSolid(nx, e.y, e.w, e.h, e)) return true; e.x = nx; rem -= st; }
  return false;
}
function moveY(e, dy) {
  const s = Math.sign(dy); let rem = Math.abs(dy);
  while (rem > 0) {
    const st = Math.min(1, rem); const ny = e.y + s * st;
    if (rectSolid(e.x, ny, e.w, e.h, e)) {
      // Settle exactly on the surface so a landing doesn't creep down a fraction per frame.
      if (s > 0) { const sy = Math.ceil(e.y + e.h - 1e-6) - e.h; if (sy > e.y && !rectSolid(e.x, sy, e.w, e.h, e)) e.y = sy; }
      return { solid: true };
    }
    if (s > 0 && !e.dropping) { const ow = oneWayBelow(e.x, e.w, e.y + e.h, ny + e.h, e); if (ow) { e.y = ow.top - e.h; return ow; } }
    e.y = ny; rem -= st;
  }
  return null;
}
function groundBelow(e) { return rectSolid(e.x, e.y + 1, e.w, e.h, e) || !!oneWayBelow(e.x, e.w, e.y + e.h, e.y + e.h + 1, e); }
function waterAt(x, y) { return tileAt(x >> 4, y >> 4) === '~'; }

function loadLevel(index) {
  const def = LEVELS[index];
  L.def = def; L.index = index; L.rows = def.rows; L.h = def.rows.length; L.w = def.rows[0].length;
  L.t = def.rows.map(r => r.split(''));
  L.ents = []; L.projs = []; L.parts = []; L.solids = []; L.signs = []; L.broken = new Set(); L.targets = new Map(); L.gates = []; L.gateOpen = new Set();
  L.lit = new Set(); L.taken = new Set(); L.pearlsTotal = 0; L.pearls = 0; L.time = 0; L.boss = null; L.breakQueue = []; L.gateQueue = []; L.mush = new Map(); L.hitTargets = new Set(); L.boatSpawned = false; L.exit = null; L.words = []; L.ghosts = []; L.lily = new Map(); L.triggerIdx = new Map(); L.gusts = []; L.bossCk = 0; L.bossFreed = 0; L.bossSlow = 0; L.bossGustHint = false; L.bossDodgeHint = false;
  L.bg = ART.background(def.theme); L.spawn = [];
  // Gates are grouped by adjacency and paired with targets in reading order.
  const targets = [], gateTiles = [], seen = new Set();
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const ch = L.t[y][x];
    if (ch === '@') { L.start = { x: x * TS + 3, y: y * TS - 4 }; L.t[y][x] = '.'; }
    else if ('sfmKcr*HL?EBORNQ'.includes(ch)) { L.spawn.push({ ch, x, y }); L.t[y][x] = '.'; if (ch === '*') L.pearlsTotal++; if (ch === 'B') L.pearlsTotal += Boss.CRIAS; /* the crías in her crop: one per blow, the rest at the end */ }
    else if (ch === '!') L.t[y][x] = '.'; // the old ground morsels: tricks are given by the teachers now
    else if (ch === 'T') targets.push({ x, y, ch });
    else if (ch === 'P' || ch === 'V') { targets.push({ x, y, ch }); L.spawn.push({ ch, x, y }); L.t[y][x] = '.'; }
    else if (ch === 'G') gateTiles.push({ x, y });
  }
  for (const g of gateTiles) {
    const k = key(g.x, g.y); if (seen.has(k)) continue;
    const group = [], stack = [g]; seen.add(k);
    while (stack.length) { const c = stack.pop(); group.push(c); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = c.x + dx, ny = c.y + dy, nk = key(nx, ny); if (!seen.has(nk) && tileAt(nx, ny) === 'G') { seen.add(nk); stack.push({ x: nx, y: ny }); } } }
    group.sort((a, b) => a.y - b.y); L.gates.push(group);
  }
  targets.sort((a, b) => a.x - b.x || a.y - b.y); L.gates.sort((a, b) => a[0].x - b[0].x);
  let ti = -1, prev = null;
  targets.forEach(t => { if (!(prev && t.ch === 'P' && prev.ch === 'P' && prev.y === t.y && prev.x === t.x - 1)) ti++; prev = t; L.targets.set(key(t.x, t.y), ti); if (t.ch !== 'T') L.triggerIdx.set(key(t.x, t.y), ti); });
  L.gates.forEach(g => { g.open = false; });
  L.checkpoint = { x: L.start.x, y: L.start.y };
  // Crías already home from an earlier visit stay home: they count from the start and leave a faint ghost bubble.
  L.home = new Set(); const set = Save.data.crias[def.id] || {};
  for (const s of L.spawn) if (s.ch === '*' && set[key(s.x, s.y)]) { L.home.add(key(s.x, s.y)); L.taken.add(key(s.x, s.y)); L.pearls++; }
  L.maestro = null;
  spawnEntities(); Player.seenPearls = L.pearls; Player.reset(L.start.x, L.start.y, true);
  Cam.snap();
}
function spawnEntities() {
  L.ents = []; L.projs = []; L.parts = []; L.solids = []; L.signs = []; L.boss = null; let signIdx = 0, rucaIdx = 0;
  for (const s of L.spawn) {
    const px = s.x * TS, py = s.y * TS;
    switch (s.ch) {
      case 's': L.ents.push(Enemy.snail(px + 1, py + 5)); break;
      case 'f': L.ents.push(Enemy.frog(px + 2, py + 5)); break;
      case 'm': L.ents.push(Enemy.mosquito(px + 3, py + 4)); break;
      case 'K': L.ents.push(Enemy.crab(px, py + 6)); break;
      case 'c': L.ents.push(Item.crate(px + 1, py + 2)); break;
      case 'r': L.ents.push(Item.rock(px + 2, py + 6)); break;
      case '*': if (!L.taken.has(key(s.x, s.y))) L.ents.push(Item.pearl(px + 3, py + 3, key(s.x, s.y), solidChar(tileAt(s.x, s.y + 1)))); else if (L.home.has(key(s.x, s.y))) L.ents.push(Item.ghostPearl(px + 3, py + 3)); break;
      case 'H': if (!L.taken.has(key(s.x, s.y))) L.ents.push(Item.heart(px + 3, py + 4, key(s.x, s.y))); break;
      case 'L': L.ents.push(Item.lantern(px + 3, py - 2, key(s.x, s.y))); break;
      case '?': L.ents.push(Item.sign(px + 1, py + 4, signIdx++)); break;
      case 'N': L.ents.push(Item.ruca(px, py + 5, rucaIdx++)); break;
      case 'E': L.ents.push(Item.boat(px - 8, py + 14)); break;
      case 'B': L.boss = Boss.create(px, py - 40); L.ents.push(L.boss); break;
      case 'O': L.ents.push(Item.anchor(px + 3, py + 3)); break;
      case 'P': L.ents.push(Item.plate(px, py + 11, L.triggerIdx.get(key(s.x, s.y)))); break;
      case 'V': L.ents.push(Item.pinwheel(px, py, L.triggerIdx.get(key(s.x, s.y)))); break;
      case 'R': L.ents.push(Item.raft(px, py + 12)); break;
      case 'Q': L.maestro = Maestros.spawn(px, py, L.def.maestro, L.maestro); L.ents.push(L.maestro); break;
    }
  }
}

// ---------------------------------------------------------------- Partículas
function spawnParts(n, x, y, opts) {
  for (let i = 0; i < n; i++) {
    const a = opts.angle !== undefined ? opts.angle + rnd(-(opts.spread || .5), opts.spread || .5) : rnd(0, Math.PI * 2);
    const sp = rnd(opts.speed ? opts.speed[0] : .5, opts.speed ? opts.speed[1] : 2);
    L.parts.push({ x: x + rnd(-(opts.jitter || 2), opts.jitter || 2), y: y + rnd(-(opts.jitter || 2), opts.jitter || 2), vx: Math.cos(a) * sp + (opts.vx || 0), vy: Math.sin(a) * sp + (opts.vy || 0),
      life: rnd(opts.life ? opts.life[0] : 20, opts.life ? opts.life[1] : 40), color: Array.isArray(opts.color) ? opts.color[(Math.random() * opts.color.length) | 0] : opts.color, size: opts.size || 1, g: opts.g === undefined ? .12 : opts.g, bounce: opts.bounce || 0, kind: opts.kind || 'dot' });
  }
}
function updateParts() {
  for (let i = L.parts.length - 1; i >= 0; i--) {
    const p = L.parts[i]; p.life--; if (p.life <= 0) { L.parts.splice(i, 1); continue; }
    p.vy += p.g; p.x += p.vx; p.y += p.vy;
    if (p.bounce && p.vy > 0 && rectSolid(p.x, p.y, 1, 1)) { p.y -= p.vy; p.vy *= -p.bounce; p.vx *= .7; }
    if (p.kind === 'amb') { p.x += Math.sin(p.life / 17 + p.ph) * .15; }
    if (p.kind === 'wetrun') { p.y0 = p.y0 || p.y; if (!rectSolid(p.x + (Math.random() < .5 ? 1 : -1), p.y + 2, 1, 1) && !rectSolid(p.x - 1, p.y + 2, 3, 1)) p.vy = 0; }
    else if (p.kind === 'fly') { p.x += Math.sin(p.life / 23 + p.ph) * .25; p.y += Math.cos(p.life / 31 + p.ph) * .18; }
    else if (p.kind === 'leaf') p.y += Math.sin(p.life / 6 + p.ph) * .5;
    else if (p.kind === 'drip' && (rectSolid(p.x, p.y, 1, 1) || waterAt(p.x, p.y))) { p.life = 0; for (let k = 0; k < 2; k++) L.parts.push({ x: p.x, y: p.y - 1, vx: k ? .4 : -.4, vy: -.6, life: 6, color: '#9ac8e8', size: 1, g: .12 }); continue; }
    if (p.kind === 'rain' && (rectSolid(p.x, p.y, 1, 1) || waterAt(p.x, p.y))) { p.life = 0; if (Math.random() < .5) L.parts.push({ x: p.x, y: p.y - 1, vx: rnd(-.5, .5), vy: -rnd(.5, 1.1), life: 7, color: '#b8c8d8', size: 1, g: .15 }); continue; }
    if (p.kind === 'cria' && p.life % 5 === 0) spawnParts(1, p.x + 3, p.y + 1, { color: '#cfe8f0', speed: [0, .2], life: [10, 16], g: -.03 });
    if (p.kind === 'suck') { const m = Player.mouth(); const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1; p.vx = dx / d * 3.2; p.vy = dy / d * 3.2; if (d < 4) p.life = 0; }
  }
}

// ---------------------------------------------------------------- Lo que Bigotes aprende
const POWERS = {
  soplido: { name: 'Soplido', food: 'un vilano de diente de león', text: 'Pulsa {puff} y Bigotes sopla: una ráfaga que aparta y aturde a los bichos, mueve molinillos y balsas.' },
  aleteo: { name: 'Aleteo', food: 'una luciérnaga dorada', text: 'Pulsa {jump} otra vez en el aire y Bigotes aletea: salto doble.' },
  ventosa: { name: 'Ventosa', food: 'una lapa del pantano', text: 'Bigotes se pega a los muros de raíces: empuja contra ellos, resbala y salta de pared en pared.' },
  chorro: { name: 'Trago de agua', food: 'un nenúfar azul', text: 'Bigotes traga agua: sórbela de una charca, escúpela sobre el fuego, o mantén {fish} en el aire para flotar con el chorro.' },
  mordisco: { name: 'Mordisco', food: 'un anzuelo viejo', text: 'Bigotes pica los anzuelos como un pez: sorbe hacia uno (con {up} si está arriba) y el sedal os izará. Salta para soltarte.' },
  panzazo: { name: 'Panzazo', food: 'un canto de río', text: 'En el aire, {down} y {jump}: Bigotes cae de panza. Rompe suelo agrietado, aturde y rebota en las setas.' },
  guindilla: { name: 'Escupitajo picante', food: 'una guindilla del pantano', text: 'Mantén {fish} con la boca llena y suelta: el escupitajo cargado sale recto, atraviesa bichos y rompe piedra reforzada.' },
  resbalon: { name: 'Resbalón', food: 'un alga resbaladiza', text: 'Agachada con {down}, pulsa {puff}: Bigotes se hace trineo y salís disparados. También corriendo y {down}. Pasa huecos bajos a toda velocidad.' } };
const POWER_ORDER = ['soplido', 'aleteo', 'ventosa', 'chorro', 'mordisco', 'panzazo', 'guindilla', 'resbalon'];

// ---------------------------------------------------------------- Nila
// How heavy each load feels: it scales the pull, the swallow and the kick of the spit (never the trajectory).
const WEIGHT = { mosquito: .35, snail: .6, frog: .7, agua: .6, rock: 1, crab: 1.1, crate: 1.5 };
// How hard each thing resists the suction (the crate is the heaviest thing Bigotes can swallow).
const SUCK_MASS = { mosquito: .7, snail: .9, frog: .9, rock: 1, crab: 1.1, crate: 1.35 };
// The inhale builds up in steps, Kirby-style: held longer, it reaches further, opens wider and pulls harder.
const SUCK_STAGES = [{ at: 0, reach: 64, cone: .45, pull: 1 }, { at: 40, reach: 82, cone: .55, pull: 1.35 }, { at: 95, reach: 104, cone: .7, pull: 1.8 }];
const CHARGE_FULL = 40, AMMO_NAMES = { rock: 'Piedra', crate: 'Caja', snail: 'Caracol', frog: 'Rana', mosquito: 'Mosquito', crab: 'Cangrejo', agua: 'Agua' };
const Player = {
  x: 0, y: 0, w: 10, h: 18, vx: 0, vy: 0, dir: 1, onGround: false, coyote: 0, jumpBuf: 0, held: null, sucking: false, suckT: 0, hp: 3, inv: 0, animT: 0, sx: 1, sy: 1,
  dead: false, deadT: 0, spitT: 0, swallowT: 0, blink: 0, hurtT: 0, stepT: 0, dropping: false, win: false, nearSign: null, airT: 0, puffCd: 0, jumpCut: false,
  charge: 0, fishDown: false, fishT: 0, hover: false, waterT: 0, puffT: 0, crouch: false, aimUp: false, grapple: null, hanging: false, carrier: null, dropT: 0, stuck: 0, airJumps: 1, onWall: 0, wallJumpT: 0, pound: false, poundT: 0, slide: 0, mantleT: 0, flap: 0, fishLag: 0, fishLagV: 0, fishLagH: 0, fishLagHV: 0, prevVx: 0, prevVy: 0, skidT: 0, wallCoyote: 0, wallSide: 0, upT: 0, downT: 0, grappleT: 0,
  reset(x, y, full) { Object.assign(Player, { x, y, h: 18, vx: 0, vy: 0, dir: 1, onGround: false, held: null, sucking: false, inv: 0, dead: false, deadT: 0, spitT: 0, swallowT: 0, sx: 1, sy: 1, win: false, airT: 0, charge: 0, fishDown: false, fishT: 0, hover: false, waterT: 0, puffT: 0, crouch: false, aimUp: false, grapple: null, hanging: false, carrier: null, dropT: 0, stuck: 0, airJumps: 1, onWall: 0, wallJumpT: 0, pound: false, poundT: 0, slide: 0, mantleT: 0, flap: 0, fishLag: 0, fishLagV: 0, fishLagH: 0, fishLagHV: 0, skidT: 0, wallCoyote: 0, wallSide: 0, upT: 0, downT: 0, grappleT: 0, lastSafe: null }); if (full) Player.hp = 3; Sound.suck(false); Sound.jet(false); },
  // Is there firm ground a knock-back could land on, that way? Water or a drop within reach says no.
  safeSide(dir) {
    const p = Player, fy = p.y + p.h;
    for (let k = 8; k <= 36; k += 7) { const x = p.x + 5 + dir * k; let ok = false; for (let dy = 0; dy < 40; dy += 4) { const t = tileAt(x >> 4, (fy + dy) >> 4); if (t === '~') break; if ('#=wMxXG'.includes(t) || rectSolid(x, fy + dy, 1, 1)) { ok = true; break; } } if (!ok) return false; }
    return true;
  },
  // Where Bigotes' mouth is: in front of the arm, or above the head when aiming up.
  mouth() { const p = Player; if (p.aimUp) return { x: p.x + 5 + p.dir * 2, y: p.y - 12 }; return { x: p.dir > 0 ? p.x + 27 : p.x - 17, y: p.y + (p.crouch ? 6 : 12) }; },
  aim() { const p = Player; if (p.grapple && !p.hanging) { const m = p.mouth(); const dx = p.grapple.x + 5 - m.x, dy = p.grapple.y + 5 - m.y, d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; } return p.aimUp ? { x: 0, y: -1 } : { x: p.dir, y: 0 }; },
  rect() { return { x: Player.x, y: Player.y, w: Player.w, h: Player.h }; },
  update() {
    const p = Player;
    if (p.dead) { p.deadT++; p.vy += .25; p.y += p.vy; p.x += p.vx; if (p.deadT === 1) { Sound.play('death'); Sound.suck(false); Sound.jet(false); } if (p.deadT > 64) Game.respawn(); return; }
    if (p.win) { p.animT++; p.sx += (1 - p.sx) * .2; p.sy += (1 - p.sy) * .2; return; }
    // Crouch: shorter hitbox; stand back up only with headroom.
    if (p.mantleT > 0) { p.mantleT--; p.vx = 0; p.vy = 0; Player.fish(); p.animT++; return; }
    // Running + down = a slide; standing + down = a crouch. Both shorten the hitbox; standing up needs headroom.
    if (Input.pressed.down && p.onGround && Math.abs(p.vx) > 1.2 && !p.slide && !p.crouch && !p.hover && !p.grapple && Game.has('resbalon')) { p.slide = 20; p.vx = p.dir * 2.8; Sound.play('step'); Cam.shake(1, 3); spawnParts(6, p.x + 5 - p.dir * 4, p.y + p.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2 - p.dir * .9, spread: .5, speed: [.5, 1.5], life: [10, 18], g: .03 }); }
    // Crouched, a tap of SOPLO: Bigotes turns sled under her and they shoot off.
    if (Input.pressed.puff && p.onGround && p.crouch && !p.slide && !p.held && !p.sucking && Game.has('resbalon')) {
      Input.pressed.puff = false; p.slide = 26; p.vx = p.dir * 3.3; p.slideGo = 10; Sound.play('whoosh'); Sound.play('flap'); Cam.punch(1.04); Cam.shake(2, 5); Input.rumble(90, .5, .4);
      spawnParts(10, p.x + 5 - p.dir * 6, p.y + p.h, { color: ['#c9b08a', '#a08a6a', '#fff6d6'], angle: -Math.PI / 2 - p.dir * 1.1, spread: .6, speed: [.8, 2.2], life: [10, 20], g: .06 });
      L.parts.push({ x: p.x + 5 - p.dir * 8 - 8, y: p.y + p.h - 4, vx: 0, vy: 0, life: 8, color: '#fff6d6', size: 1, g: 0, kind: 'ring' });
    }
    const wasSlide = p.slide > 0;
    if (p.slide > 0) { p.slide--; if (!p.onGround) p.slide = 0; else if (p.slide < 2 && p.crouch && rectSolid(p.x, p.y - 6, p.w, 18, p)) p.slide = 2; /* under a low roof the algae keeps her gliding */ }
    if (p.slideGo > 0) p.slideGo--;
    // While sliding: after-images, sparks off the ground; at the end Bigotes shakes himself and she pops up.
    if (p.slide > 0) { if (p.slide % 3 === 0) { p.slideTrail = (p.slideTrail || []).concat([{ x: p.x, y: p.y + p.h }]).slice(-3); } if (p.slide % 2 === 0) L.parts.push({ x: p.x + 5 - p.dir * 8, y: p.y + p.h - 1, vx: -p.dir * rnd(.6, 1.6), vy: -rnd(.3, 1), life: rnd(6, 12) | 0, color: Math.random() < .5 ? '#ffe36a' : '#fff6d6', size: 1, g: .08 }); }
    if (!(p.slide > 0) && p.slideTrail) p.slideTrail = null;
    else if (wasSlide && p.onGround) { p.sx = .85; p.sy = 1.18; Sound.play('step'); spawnParts(6, p.x + 5, p.y + p.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.4, speed: [.3, 1.2], life: [8, 16], g: .05 }); p.slideEnd = 12; }
    if (p.slideEnd > 0) p.slideEnd--;
    const wantCrouch = (Input.held.down || p.slide > 0) && p.onGround && !p.hover && !p.grapple;
    if (wantCrouch && !p.crouch) { p.crouch = true; p.y += 6; p.h = 12; p.sx = 1.15; }
    else if (!wantCrouch && p.crouch && !rectSolid(p.x, p.y - 6, p.w, 18, p)) { p.crouch = false; p.y -= 6; p.h = 18; p.sy = 1.1; }
    else if (!wantCrouch && p.crouch) p.slide = 0;
    const left = Input.held.left, right = Input.held.right, ax = p.onGround ? .22 : .14;
    const busy = p.sucking || p.charge > 8;
    const maxV = p.crouch ? 1.1 : busy ? (p.sucking && p.suckLv === 3 ? .45 : .7) : 1.7;
    if (p.wallJumpT > 0) p.wallJumpT--;
    if (p.grapple || p.pound) { /* Bigotes does the moving, or nothing moves */ }
    else if (p.slide > 0) { p.vx = p.dir * Math.max(2.8 * Math.sqrt(p.slide / 20), p.slide <= 2 ? 2.3 : 0); if (p.slide % 3 === 0) spawnParts(1, p.x + 5 - p.dir * 5, p.y + p.h, { color: '#c9b08a', angle: -Math.PI / 2 - p.dir * .9, spread: .4, speed: [.4, 1], life: [8, 14], g: .03 }); }
    else if (p.wallJumpT > 0) { /* the wall kick owns the first frames */ }
    else if (left && !right) { if (p.onGround && p.vx > 1 && !p.skidT) { p.skidT = 8; spawnParts(5, p.x + 8, p.y + p.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2 + .8, spread: .5, speed: [.5, 1.5], life: [10, 18], g: .03 }); } p.vx = Math.max(p.vx - ax, -maxV); if (!busy) p.dir = -1; }
    else if (right && !left) { if (p.onGround && p.vx < -1 && !p.skidT) { p.skidT = 8; spawnParts(5, p.x + 2, p.y + p.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2 - .8, spread: .5, speed: [.5, 1.5], life: [10, 18], g: .03 }); } p.vx = Math.min(p.vx + ax, maxV); if (!busy) p.dir = 1; }
    else { const f = p.onGround ? .3 : .06; if (Math.abs(p.vx) <= f) p.vx = 0; else p.vx -= Math.sign(p.vx) * f; }
    if ((busy || (p.crouch && !(p.slide > 0))) && Math.abs(p.vx) > maxV) p.vx = Math.sign(p.vx) * maxV;
    // Jump: buffered, with coyote time and a variable height. Jumping lets go of an anchor.
    if (Input.pressed.jump) p.jumpBuf = 7; else if (p.jumpBuf > 0) p.jumpBuf--;
    if (p.onGround || p.hanging) { p.coyote = 7; p.airJumps = 1; } else if (p.coyote > 0) p.coyote--;
    // A crouch or a slide stands up into the jump when there is room overhead; under a low roof it waits in the buffer.
    if (p.jumpBuf > 0 && p.crouch && (p.coyote > 0) && !rectSolid(p.x, p.y - 6, p.w, 18, p)) { p.crouch = false; p.y -= 6; p.h = 18; p.slide = 0; }
    if (p.wallCoyote > 0) p.wallCoyote--;
    if (p.jumpBuf > 0 && !p.crouch) {
      if (p.coyote > 0) {
        p.vy = -5.6; p.jumpCut = true; p.jumpBuf = 0; p.coyote = 0; p.onGround = false; p.sx = .8; p.sy = 1.25; Sound.play('jump');
        if (p.grapple) { Player.letGo(); p.vx = Input.held.left ? -1.7 : Input.held.right ? 1.7 : 0; Game.word('¡HOP!', p.x + 5, p.y - 6, '#fff6d6', false); }
        else spawnParts(5, p.x + 5, p.y + p.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.2, speed: [.5, 1.5], life: [10, 20], g: .05 });
      } else if ((p.onWall || p.wallCoyote > 0) && Game.has('ventosa')) {
        // Wall kick off the roots. A few frames of grace after letting go of the wall, so pressing away a hair early still kicks.
        const side = p.onWall || p.wallSide; p.wallCoyote = 0;
        p.vy = -5.3; p.vx = -side * 2.7; p.dir = -side; p.wallJumpT = 11; p.jumpCut = true; p.jumpBuf = 0; p.sx = .8; p.sy = 1.25; Sound.play('jump'); Cam.shake(1, 3); Input.rumble(40, .2, .2);
        spawnParts(6, p.x + (side > 0 ? p.w : 0), p.y + 8, { color: ['#5e8a2e', '#c9b08a'], angle: side > 0 ? Math.PI : 0, spread: .8, speed: [.5, 2], life: [10, 18], g: .05 }); p.onWall = 0;
      } else if (!p.hover && !p.grapple && !p.pound && Input.held.down && Game.has('panzazo')) {
        // Belly flop: hang a beat, then slam down.
        p.pound = true; p.poundT = 9; p.vx = 0; p.vy = -1.2; p.jumpBuf = 0; p.airJumps = 0; Sound.play('charge'); p.sx = 1.2; p.sy = .8;
      } else if (!p.hover && !p.grapple && !p.pound && p.airJumps > 0 && Game.has('aleteo')) {
        // Bigotes flaps: a second jump in the air.
        p.airJumps--; p.vy = -4.6; p.jumpCut = true; p.jumpBuf = 0; p.flap = 14; p.sx = .85; p.sy = 1.2; Sound.play('flap'); Input.rumble(50, .2, .3);
        L.parts.push({ x: p.x - 3, y: p.y + p.h - 2, vx: 0, vy: 0, life: 8, color: '#cfe0e8', size: 1, g: 0, kind: 'ring' });
        spawnParts(8, p.x + 5 + p.dir * 10, p.y + 12, { color: ['#cfe0e8', '#8fd9d0', '#e8fbff'], angle: Math.PI / 2, spread: 1, speed: [1, 2.5], life: [10, 18], g: .08 });
      }
    }
    if (!Input.held.jump && p.jumpCut && p.vy < -1.5) p.vy = -1.5;
    if (p.vy >= 0) p.jumpCut = false;
    if (p.grapple) Player.pull();
    else if (p.pound) { if (p.poundT > 0) { p.poundT--; p.vy = -.4; } else p.vy = Math.min(p.vy + .7, 9); }
    else if (p.hover) p.vy = Math.min(p.vy + .28, .45); else p.vy = Math.min(p.vy + .28, 5.5);
    const hitWall = moveX(p, p.vx); if (hitWall) { if (Player.mantle()) return; p.vx = 0; p.slide = 0; }
    const wasGround = p.onGround; p.onGround = false; p.carrier = null;
    const hit = p.grapple ? null : moveY(p, p.vy);
    if (hit && p.vy > 0 && p.pound) Player.slam(hit);
    if (hit && !(hit.ch === '%' && p.vy < 0)) { // a belly flop on a mushroom already bounced her up
      if (p.vy > 0) {
        p.onGround = true; if (hit.ent) p.carrier = hit.ent;
        if (hit.ch === '%') { p.vy = -8.6; p.jumpCut = false; p.onGround = false; p.sx = .7; p.sy = 1.4; L.mush.set(key(hit.tx, hit.ty), 14); Sound.play('bounce'); Cam.punch(1.03); Game.word('¡BOING!', hit.tx * TS + 8, hit.ty * TS - 4, '#f6e6c8'); spawnParts(8, hit.tx * TS + 8, hit.ty * TS + 4, { color: ['#f6e6c8', '#d95a4a'], angle: -Math.PI / 2, spread: 1.4, speed: [1, 2.5], life: [12, 24] }); }
        else {
          if (hit.ch === 'w') L.lily.set(key(hit.tx, hit.ty), 4);
          if (!wasGround && p.airT > 8) {
            // The landing answers the fall: a hop barely dents her, a drop from high squashes, shakes and rings.
            const k = clamp((p.vy - 1.5) / 4, 0, 1); p.sx = 1.08 + .28 * k; p.sy = .92 - .24 * k; Sound.play('land', k);
            spawnParts(2 + Math.round(6 * k), p.x + 5, p.y + p.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.5, speed: [.4, .6 + k], life: [8, 16], g: .04 });
            if (k > .9 && p.airT > 30) { Cam.shake(2, 6); Input.rumble(70, .4, .2); L.parts.push({ x: p.x - 3, y: p.y + p.h - 2, vx: 0, vy: 0, life: 8, color: '#c9b08a', size: 1, g: 0, kind: 'ring' }); } if (hit.ch === 'w' || hit.ch === 'raft') spawnParts(6, p.x + 5, p.y + p.h + 4, { color: ['#8fd9d0', '#c8f2ea'], angle: -Math.PI / 2, spread: 1.6, speed: [.3, 1], life: [8, 14], g: .03 }); }
          p.vy = 0;
        }
      } else { p.vy = 0; }
    }
    if (p.carrier && p.carrier.vx) moveX(p, p.carrier.vx);
    // Sliding down a root wall while pushing into it.
    p.onWall = 0;
    if (!p.onGround && !p.grapple && !p.hover && !p.pound && p.vy > 0 && p.wallJumpT === 0) {
      const d = Input.held.left ? -1 : Input.held.right ? 1 : 0;
      if (d && Game.has('ventosa') && Player.wallAt(d)) { if (p.vy > 2) { spawnParts(3, p.x + (d > 0 ? p.w : 0), p.y + 4, { color: ['#5e8a2e', '#c9b08a'], speed: [.3, 1], life: [8, 14], g: .05 }); Sound.play('step'); } p.onWall = d; p.wallCoyote = 6; p.wallSide = d; p.dir = -d; p.vy = Math.min(p.vy, .75); p.airJumps = 1; if (p.animT % 5 === 0) spawnParts(1, p.x + (d > 0 ? p.w : 0), p.y + 4, { color: ['#5e8a2e', '#c9b08a'], speed: [.2, .6], life: [8, 14], g: .05 }); }
    }
    p.airT = p.onGround || p.hanging ? 0 : p.airT + 1;
    if (p.onGround && p.vy === 0 && !groundBelow(p)) p.onGround = false;
    const feetY = p.y + p.h - 2;
    // Remember the last firm footing (both feet on solid ground or planks, nothing moving under her): a fall into
    // the water puts her back there, not at a far lantern.
    if (p.onGround && !p.carrier && !p.dead && p.inv === 0) { const fy = (p.y + p.h + 1) >> 4, l = tileAt((p.x + 1) >> 4, fy), r = tileAt((p.x + p.w - 1) >> 4, fy); if ('#=MxX'.includes(l) && '#=MxX'.includes(r)) p.lastSafe = { x: p.x, y: p.y }; }
    if (waterAt(p.x + 5, feetY - 4) && waterAt(p.x + 5, feetY)) { Game.drown(); return; }
    if (p.y > L.h * TS + 20) { Game.drown(true); return; }
    for (let ty = Math.floor(p.y) >> 4; ty <= Math.floor(p.y + p.h - 1) >> 4; ty++) for (let tx = Math.floor(p.x) >> 4; tx <= Math.floor(p.x + p.w - 1) >> 4; tx++) { const ch = tileAt(tx, ty); if ((ch === '^' && p.y + p.h > ty * TS + 6) || (ch === 'F' && p.y + p.h > ty * TS + 3)) Player.hurt(p.x < tx * TS + 8 ? -1 : 1); }
    Player.fish();
    if (p.skidT > 0) p.skidT--; if (p.flap > 0) p.flap--;
    // Bigotes' tail has inertia: it swings against every change of speed, then settles.
    const dvx = p.vx - p.prevVx, dvy = p.vy - p.prevVy; p.prevVx = p.vx; p.prevVy = p.vy;
    p.fishLagV += -dvy * .9; p.fishLagHV += dvx * p.dir * 1.3;
    p.fishLagV -= p.fishLag * .22; p.fishLagV *= .8; p.fishLag = clamp(p.fishLag + p.fishLagV, -5, 5);
    p.fishLagHV -= p.fishLagH * .22; p.fishLagHV *= .8; p.fishLagH = clamp(p.fishLagH + p.fishLagHV, -3, 3);
    if (p.spitT > 0) p.spitT--; if (p.swallowT > 0) p.swallowT--; if (p.inv > 0) p.inv--; if (p.hurtT > 0) p.hurtT--; if (p.puffCd > 0) p.puffCd--; if (p.puffT > 0) p.puffT--; if (p.puffWind > 0 && --p.puffWind === 0) Player.puff(); if (p.dropT > 0) p.dropT--;
    p.sx += (1 - p.sx) * .18; p.sy += (1 - p.sy) * .18;
    p.animT++;
    if (p.onGround && Math.abs(p.vx) > .5 && !p.carrier) { p.stepT++; if (p.stepT % 12 === 6) { Sound.play('step'); spawnParts(1, p.x + 5 - p.dir * 3, p.y + p.h, { color: '#c9b08a', angle: -Math.PI / 2 - p.dir * .6, spread: .4, speed: [.3, .8], life: [8, 14], g: .03 }); } } else p.stepT = 0;
    if (p.blink > 0) p.blink--; else if (Math.random() < .006) p.blink = 6;
    // Bigotes' moods: bored when nothing happens, wet after water, happy for each cría, dizzy after a hit.
    const busyIn = Input.held.left || Input.held.right || Input.held.jump || Input.held.fish || Input.held.up || Input.held.down;
    p.idleT = p.onGround && Math.abs(p.vx) < .1 && !p.sucking && !p.held && !busyIn && !p.dead ? (p.idleT || 0) + 1 : 0;
    if (p.hover || p.sucking && p.waterSrc) p.wetT = 200; else if (p.wetT > 0) p.wetT--;
    if (L.pearls > (p.seenPearls || 0)) p.happyT = 70; p.seenPearls = L.pearls; if (p.happyT > 0) p.happyT--;
    if (p.dizzyT > 0) p.dizzyT--;
    p.nearSign = null; for (const e of L.ents) if (e.kind === 'sign' && Math.abs(e.x + 7 - (p.x + 5)) < 22 && Math.abs(e.y - p.y) < 30) p.nearSign = e;
  },
  wallAt(d) { const p = Player; const x = d > 0 ? p.x + p.w + 1 : p.x - 2; return tileAt(x >> 4, (p.y + 3) >> 4) === 'M' || tileAt(x >> 4, (p.y + p.h - 3) >> 4) === 'M'; },
  // Reaching a ledge with the hands: Nila hauls herself up.
  mantle() {
    const p = Player; if (p.onGround || p.vy < 0 || p.grapple || p.hover || p.pound || p.crouch) return false;
    const d = Math.sign(p.vx) || p.dir; const fx = d > 0 ? p.x + p.w + 1 : p.x - 1, tx = fx >> 4, ty = Math.floor((p.y + p.h - 1) / TS);
    // Only a hand's breadth: the feet must already be within five pixels of the ledge top, so no wall becomes climbable by itself.
    if (!solidChar(tileAt(tx, ty)) || solidChar(tileAt(tx, ty - 1)) || solidChar(tileAt(tx, ty - 2)) || (p.y + p.h) - ty * TS > 5) return false;
    const nx = tx * TS + (d > 0 ? 2 : TS - 2 - p.w), ny = ty * TS - p.h;
    if (rectSolid(nx, ny, p.w, p.h, p)) return false;
    p.x = nx; p.y = ny; p.vx = 0; p.vy = 0; p.mantleT = 8; p.onGround = true; p.airJumps = 1; p.sx = 1.15; p.sy = .85; Sound.play('step');
    spawnParts(4, p.x + 5, p.y + p.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.2, speed: [.3, 1], life: [8, 14], g: .04 }); return true;
  },
  slam(hit) {
    const p = Player; p.pound = false; p.sx = 1.5; p.sy = .6; Cam.shake(5, 12); Cam.punch(1.05); Game.stop(3); Input.rumble(180, 1, .5); Sound.play('crack');
    Game.word('¡PLAF!', p.x + 5, p.y - 8, '#fff6d6', true);
    L.parts.push({ x: p.x - 3, y: p.y + p.h - 2, vx: 0, vy: 0, life: 8, color: '#c9b08a', size: 1, g: 0, kind: 'ring' });
    spawnParts(14, p.x + 5, p.y + p.h, { color: ['#c9b08a', '#a08a6a', '#e8f0c8'], angle: -Math.PI / 2, spread: 1.6, speed: [.8, 3], life: [12, 26], g: .08 });
    const ty = Math.floor((p.y + p.h + 1) / TS);
    for (let tx = Math.floor(p.x - 4) >> 4; tx <= Math.floor(p.x + p.w + 3) >> 4; tx++) if (tileAt(tx, ty) === 'x') Game.breakCracked(tx, ty, 'x');
    for (const e of L.ents) if (e.enemy && !e.dead && Math.abs(e.x + e.w / 2 - (p.x + 5)) < 48 && Math.abs(e.y - p.y) < 30) { e.stun = 50; e.vy = -2.5; e.vx = Math.sign(e.x - p.x) * 1.2; if (e.armored) e.tug = 20; }
    if (hit.ch === '%') { p.vy = -11; p.jumpCut = false; p.onGround = false; Game.word('¡BOOING!', p.x + 5, p.y - 16, '#f6e6c8', true); }
  },
  // Bigotes: hold to suck (or to charge when full), tap to spit, hold in the air with water to hover, down+tap to drop.
  // The puff has its own button, so sucking and puffing never get mixed up.
  fish() {
    const p = Player, down = Input.held.fish;
    if (Input.pressed.puff && !p.sucking && p.puffCd === 0) {
      if (p.held) { const m = p.mouth(); p.puffCd = 18; Sound.play('blub'); Game.word('mmf', m.x, m.y - 10, '#9fc0cc', false); p.sx = 1.06; p.sy = .95; }
      else if (Game.has('soplido')) Player.inhale(); else Player.burp();
    }
    if (Input.pressed.fish) { p.fishDown = true; p.fishT = 0; }
    if (down && p.fishDown) p.fishT++;
    const wasHover = p.hover; p.hover = false;
    // The aim latches for a few frames: letting go of {up} a hair before {fish} still shoots up.
    if (Input.held.up) p.upT = 8; else if (p.upT > 0) p.upT--;
    if (Input.held.down) p.downT = 8; else if (p.downT > 0) p.downT--;
    const wantUp = Input.held.up || (p.upT > 0 && p.fishDown);
    // With something in the mouth, holding {up} already bends Bigotes skyward, so the shot is aimed before it leaves.
    p.aimUp = wantUp && (p.sucking || (p.fishDown && down && !p.held) || (p.held && !wasHover && !(down && p.fishDown && p.held.kind === 'agua' && !p.onGround))) && !p.crouch;
    if (p.held) {
      if (p.sucking) { p.sucking = false; Sound.suck(false); }
      if (Input.pressed.fish && Input.held.down && p.onGround && p.held.kind !== 'agua') { Player.drop(); p.fishDown = false; return; }
      if (down && p.fishDown && p.fishT > 4) {
        if (p.held.kind === 'agua' && !p.onGround) { p.hover = true; p.charge = 0; Player.jet(); }
        else if (!Game.has('guindilla')) { /* no charge yet: the spit waits for the release */ }
        else {
          const was = p.charge; p.charge = Math.min(p.charge + 1, CHARGE_FULL + 30);
          if (p.charge > 10 && p.charge % 3 === 0) { const m = p.mouth(); spawnParts(1, m.x + rnd(-14, 14) * p.dir, m.y + rnd(-10, 10), { color: p.charge >= CHARGE_FULL ? ['#fff6d6', '#e79b3f'] : ['#cfe0e8', '#e79b3f'], speed: [0, .3], life: [8, 14], g: 0, kind: 'suck' }); }
          if (was < CHARGE_FULL && p.charge >= CHARGE_FULL) { Sound.play('charged'); Cam.shake(1, 4); Input.rumble(60, .2, .5); const m = p.mouth(); spawnParts(10, m.x, m.y, { color: ['#fff6d6', '#e79b3f', '#ffffff'], speed: [1, 2.5], life: [10, 18], g: 0 }); }
          if (p.charge === 12) Sound.play('charge');
        }
      }
      if (!down && p.fishDown) { p.fishDown = false; if (!wasHover) Player.spit(p.charge >= CHARGE_FULL); p.charge = 0; }
      if (!down) p.charge = 0;
    } else {
      p.charge = 0;
      if (down && p.fishDown && !p.sucking && p.fishT > 4) { p.sucking = true; p.suckT = 0; p.waterT = 0; p.suckLv = 1; p.suckLen = 36; p.suckPulse = 0; Sound.suck(true); }
      if (!down && p.fishDown) { p.fishDown = false; if (p.sucking) { p.sucking = false; Sound.suck(false); Player.letGo(); } }
      if (p.sucking) Player.suck();
    }
    if (wasHover && !p.hover) Sound.jet(false);
    if (p.held && p.held.kind === 'agua' && p.held.amount <= 0) { const m = p.mouth(); p.held = null; Sound.play('puff'); Game.word('pff', m.x, m.y - 8, '#9fc0cc', false); spawnParts(6, m.x, m.y, { color: ['#8fd9d0', '#cfe0e8'], speed: [.5, 1.5], life: [8, 14], g: .05 }); }
  },
  suck() {
    const p = Player, m = p.mouth(), a = p.aim(); p.suckT++;
    const lv = p.suckT >= SUCK_STAGES[2].at ? 3 : p.suckT >= SUCK_STAGES[1].at ? 2 : 1, S = SUCK_STAGES[lv - 1];
    if (lv !== p.suckLv) { p.suckLv = lv; Player.suckUp(lv); }
    p.suckLen = lerp(p.suckLen || 36, S.reach, .18); if (p.suckPulse > 0) p.suckPulse--;
    // At full blast Nila digs her heels in: dust kicks up behind her and the air hums.
    if (lv === 3 && p.onGround && p.suckT % 5 === 0) spawnParts(1, p.x + 5 - p.dir * 5, p.y + p.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2 - p.dir * .9, spread: .5, speed: [.4, 1.2], life: [8, 14], g: .04 });
    if (lv === 3 && p.suckT % 14 === 0) Cam.shake(1, 3);
    // Wind streaks converge on the mouth from along the aim.
    if (p.suckT % (lv === 3 ? 1 : 2) === 0) { const d = rnd(30, p.suckLen - 2), ang = rnd(-.45 - lv * .1, .45 + lv * .1); const c = Math.cos(ang), sn = Math.sin(ang); L.parts.push({ x: m.x + (a.x * c - a.y * sn) * d, y: m.y + (a.y * c + a.x * sn) * d, vx: 0, vy: 0, life: 40, color: ['#cfe0e8', '#9fc0cc', '#e8f2f6'][(Math.random() * 3) | 0], size: 1, g: 0, kind: 'suck' }); }
    // The ground under the cone gives up grass, dust and leaves; whatever is being pulled leaves a trail.
    if (p.suckT % (4 - lv) === 0 && !p.aimUp) { const d = rnd(14, p.suckLen - 4), gx = m.x + a.x * d; for (let dy = -8; dy < 34; dy += 3) if (rectSolid(gx, m.y + dy, 1, 1)) { const th = L.def.theme, cols = th === 'cave' ? ['#6b4a60', '#8a6a7a'] : th === 'storm' ? ['#6a7a5a', '#8a9a6a'] : ['#7fb040', '#a3cf52', '#c9b08a']; L.parts.push({ x: gx, y: m.y + dy - 1, vx: 0, vy: 0, life: 40, color: cols[(Math.random() * cols.length) | 0], size: 1, g: 0, kind: 'suck' }); break; } }
    if (p.suckT % 2 === 0) for (const e of L.ents) if (e.sucked > 0 && !e.dead) L.parts.push({ x: e.x + e.w / 2 + rnd(-2, 2), y: e.y + e.h / 2 + rnd(-2, 2), vx: -(e.vx || 0) * .2, vy: -(e.vy || 0) * .2, life: 10, max: 10, color: '#e8f6ff', size: 1, g: 0, kind: 'mist' });
    if (p.suckT % 20 === 10 && p.onGround) spawnParts(2, p.x + 5 + p.dir * 4, p.y + p.h, { color: '#c9b08a', angle: -Math.PI / 2 + p.dir * .8, spread: .4, speed: [.3, .9], life: [8, 14], g: .03 });
    if (p.grapple && !p.hanging) return;
    let water = null;
    if (!p.aimUp && Game.has('chorro')) for (let k = 1; k <= 4 + lv && !water; k++) for (const dy of [-6, 4, 14, 24]) { const wx = m.x + p.dir * k * 10, wy = m.y + dy; if (waterAt(wx, wy)) { water = { x: wx, y: wy }; break; } }
    p.waterSrc = water ? { x: water.x, y: Math.floor(water.y / TS) * TS } : null;
    if (water) {
      p.waterT++;
      if (p.suckT % 2 === 0) L.parts.push({ x: water.x + rnd(-8, 8), y: (Math.floor(water.y / TS) * TS) + rnd(0, 6), vx: 0, vy: 0, life: 30, color: ['#8fd9d0', '#c8f2ea', '#e8fbff'][(Math.random() * 3) | 0], size: 1, g: 0, kind: 'suck' });
      if (p.waterT > 22) Player.captureWater();
    } else p.waterT = Math.max(0, p.waterT - 2);
    let best = null, bestD = 1e9;
    for (const e of L.ents) {
      if (e.dead || e.held || e === p.grapple) continue;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2, ox = cx - m.x, oy = cy - m.y;
      const along = ox * a.x + oy * a.y, across = Math.abs(ox * a.y - oy * a.x);
      const inCone = r => along >= -12 && along <= r && across <= 10 + along * S.cone;
      // Too big to swallow: say so instead of silently blowing at it.
      if ((e.boss || e.kind === 'ruca' || e.kind === 'raft') && !p.grapple && p.suckT > 10 && inCone(64)) { if (!(Game.t - (e.pesaT || -99) < 70)) { e.pesaT = Game.t; Game.word('¡PESA!', cx, e.y - 8, '#cfe0e8', false); Sound.play('thud'); } continue; }
      if (!e.suckable && e.kind !== 'anchor') continue;
      if (e.kind === 'anchor' && !Game.has('mordisco')) continue;
      if (p.grapple && e.kind !== 'anchor') continue;
      const reach = e.kind === 'anchor' ? Math.max(96, S.reach) : S.reach;
      if (!inCone(reach)) {
        e.pullT = 0;
        // Just out of reach: it feels the draught (dust streams off it toward the mouth), so the player knows to step closer.
        if (e.kind !== 'anchor' && inCone(reach + 30) && p.suckT % 6 === 0) { spawnParts(1, cx + rnd(-e.w / 2, e.w / 2), cy + rnd(-e.h / 2, e.h / 2), { color: ['#e8f2f6', '#cfe0e8'], speed: [0, .2], life: [30, 40], g: 0, kind: 'suck' }); if (e.enemy) e.tug = Math.max(e.tug, 2); }
        continue;
      }
      if (e.kind === 'anchor') { const d = Math.hypot(ox, oy); if (d < bestD) { best = e; bestD = d; } continue; }
      if (e.armored && !e.flipped) {
        // The crab clamps onto the mud: a metallic refusal and, the first time ever, a hint.
        e.tug = 6; e.tugDir = -p.dir;
        if (!(Game.t - (e.clonkT || -99) < 50)) { e.clonkT = Game.t; Sound.play('clang'); Game.word('¡CLONC!', cx, e.y - 8, '#9fa8b0', false); spawnParts(4, cx - p.dir * 6, cy, { color: ['#fff6d6', '#f28b6a'], speed: [.5, 1.5], life: [6, 12], g: .1 });
          const seen = Save.data.seen || (Save.data.seen = {}); if (!seen.crab) { seen.crab = true; Save.write(); Game.toast('Se agarra: voltéalo de una pedrada', 150); } }
        continue;
      }
      // The pull has an anticipation: the thing resists and trembles, then is yanked ever faster into the mouth.
      // Heavy things (a crate) take a beat longer; a mosquito barely resists.
      const d = Math.hypot(ox, oy) || 1, mass = SUCK_MASS[e.kind] || 1;
      if (!e.sucked) e.pullT = 0; e.pullT = (e.pullT || 0) + 1;
      if (e.pullT === 1 && e.resting !== false && !e.flying) spawnParts(3, cx, e.y + e.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.2, speed: [.3, 1], life: [8, 14], g: .04 });
      const sp = Math.min(5 * (1 + (S.pull - 1) * .6), (.3 + Math.max(0, 64 - d) * .035 + e.pullT * .22) * S.pull / mass);
      const k = e.pullT < 4 ? .12 : .35;
      e.vx = lerp(e.vx || 0, -ox / d * sp, k); e.vy = lerp(e.vy || 0, -oy / d * sp, k); e.sucked = 2;
      if (e.pullT < 4 && e.enemy) e.tug = 2;
      if (d < 9) Player.capture(e);
    }
    if (best) { if (p.grapple) Game.word('¡OTRO!', best.x + 5, best.y - 8, '#e6c46a', false); p.grapple = best; p.grappleT = 0; p.hanging = false; p.vx = 0; p.vy = 0; p.crouch = false; Sound.play('glup', .6); Game.word('¡PICA!', best.x + 5, best.y - 8, '#e6c46a', true); Cam.shake(2, 5); for (let i = 0; i < 2; i++) L.parts.push({ x: best.x + 5, y: best.y - 12, vx: 0, vy: 0, life: 14 - i * 4, color: '#e8fbff', size: 1, g: 0, kind: 'ring' }); }
  },
  // One more step of the inhale: a thump of air, a shock ring racing down the cone, and at the top a ¡SÚPER!
  suckUp(lv) {
    const p = Player, m = p.mouth(), a = p.aim();
    Sound.play('suckup', lv); Sound.suckLevel(lv); Cam.shake(lv, 4 + lv * 2); Input.rumble(50 + lv * 40, .15 + lv * .2, .5);
    p.sx = 1.14; p.sy = .86; p.suckPulse = 16;
    spawnParts(4 + lv * 4, m.x, m.y, { color: lv === 3 ? ['#ffffff', '#fff6d6', '#f2c46a'] : ['#e8fbff', '#cfe0e8', '#ffffff'], speed: [1, 2 + lv * .6], life: [8, 16], g: 0 });
    if (p.onGround) spawnParts(3 + lv * 2, p.x + 5 - p.dir * 4, p.y + p.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2 - p.dir * .8, spread: .6, speed: [.5, 1.6], life: [10, 18], g: .04 });
    if (lv === 3) { Cam.punch(1.04); Game.stop(2); Game.word('¡SÚPER!', m.x + a.x * 16, m.y - 14 + a.y * 10, '#e8fbff', true); }
  },
  // Bigotes has clamped onto a ring: it reels Nila in until she hangs just under it.
  pull() {
    const p = Player, a = p.grapple; const tx = a.x + 5 - 5, ty = a.y + 10;
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy); p.grappleT++;
    // The bite: a few frames where Bigotes clamps on and the rope goes taut, then the reel accelerates.
    if (p.grappleT <= 4 && d >= 3) { p.vx = 0; p.vy = 0; if (p.grappleT === 1) { Cam.shake(1, 3); Input.rumble(40, .3, .1); p.sx = .9; p.sy = 1.12; } return; }
    if (d < 3) { if (!p.hanging) { p.sx = .88; p.sy = 1.14; Sound.play('thud'); Input.rumble(40, .3, .2); spawnParts(4, a.x + 5, a.y + 6, { color: ['#e6c46a', '#fff6d6'], speed: [.4, 1.2], life: [8, 14], g: .05 }); } p.x = tx; p.y = ty; p.hanging = true; p.vx = 0; p.vy = 0; if (p.animT % 6 === 0) L.parts.push({ x: a.x + 5, y: a.y + 5, vx: 0, vy: 0, life: 10, color: '#e6c46a', size: 1, g: 0, kind: 'suck' }); return; }
    const sp = Math.min(4.4, 1.8 + (p.grappleT - 4) * .45, d); const mx = dx / d * sp, my = dy / d * sp;
    const bx = moveX(p, mx), by = moveY(p, my); p.vy = 0;
    if ((bx && Math.abs(dx) > 4) || (by && Math.abs(dy) > 4)) { if (++p.stuck > 12) { Player.letGo(); p.stuck = 0; } } else p.stuck = 0;
    if (p.grappleT % 3 === 0) Sound.play('text');   // the reel clicking as it winds in
  },
  letGo() { const p = Player; if (p.grapple) { p.grapple = null; p.hanging = false; } if (p.sucking) { p.sucking = false; Sound.suck(false); } },
  capture(e) {
    const p = Player; e.dead = true; e.held = true;
    p.held = { kind: e.kind, sprite: e.spriteFor ? e.spriteFor() : e.sprite, w: e.w, h: e.h, proto: e };
    Player.swallowed();
  },
  captureWater() { const p = Player; p.held = { kind: 'agua', sprite: ART.drop, w: 8, h: 8, amount: 1 }; Player.swallowed(); },
  swallowed() {
    const p = Player, w = WEIGHT[p.held.kind] || 1; p.sucking = false; Sound.suck(false); Sound.play('glup', w); p.swallowT = 10; p.sx = 1.08 + w * .08; p.sy = .94 - w * .06; p.fishDown = false; Input.rumble(40 + w * 30, .2 + w * .2, .1);
    // The payoff: a heavy gulp freezes the world for a beat and pops the camera.
    if (p.held.kind !== 'agua') { Game.stop(w >= 1 ? 3 : 2); Cam.punch(1 + w * .02); Cam.shake(w >= 1 ? 2 : 1, 4); }
    const m = p.mouth(); Game.word(w >= 1.3 ? '¡GLUP!' : 'GLUP', m.x - p.dir * 6, m.y - 12, '#e8fbff', w >= 1.3); spawnParts(4 + Math.round(w * 4), m.x, m.y, { color: ['#cfe0e8', '#e8f2f6'], speed: [.5, 1.5], life: [8, 14], g: 0 });
  },
  // Down + Bigotes on the ground sets the load down gently at Nila's feet.
  drop() {
    const p = Player, h = p.held; p.held = null; p.spitT = 6; p.dropT = 10;
    const e = Item.fromHeld(h, p.x + 5 - h.w / 2, p.y + p.h - h.h); if (!e) return;
    for (let n = 0; n < 16 && rectSolid(e.x, e.y, e.w, e.h, e); n++) e.y--;
    e.ghost = true;
    if (e.enemy) e.stun = 40;
    L.ents.push(e); Sound.play('thud'); p.sx = 1.1; p.sy = .9; Game.word('plof', e.x + e.w / 2, e.y - 6, '#c9b08a', false);
    spawnParts(4, e.x + e.w / 2, e.y + e.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.4, speed: [.3, 1], life: [8, 14], g: .04 });
  },
  spit(charged) {
    const p = Player, m = p.mouth(), h = p.held; p.held = null; p.spitT = 12;
    const up = p.aimUp, down = !up && !p.onGround && (Input.held.down || (p.downT > 4 && p.airT > 12));
    if (h.kind === 'agua') { Player.spitWater(charged, up, down); return; }
    const w = WEIGHT[h.kind] || 1;
    const speed = charged ? 9.5 : 6.2;
    let vx = p.dir * speed, vy = charged ? -.6 : h.kind === 'crate' ? -1.8 : -1.6;
    if (up) { vx = p.dir * .6; vy = charged ? -9.5 : -7.2; } else if (down) { vx = p.dir * .8; vy = charged ? 8 : 6; p.vy = -4.2; p.jumpCut = false; p.sx = .85; p.sy = 1.2; }
    const proj = Proj.create(h, up || down ? m.x - h.w / 2 : (p.dir > 0 ? m.x - 4 : m.x - h.w + 4), m.y - h.h / 2 + (up ? -6 : 0), vx, vy, charged);
    // A fat crate starts a few pixels clear of the ground; pointed at a wall, the shot starts on Nila's side of it
    // (and hits it on its first step) instead of popping out over the top.
    for (let n = 0; n < 4 && rectSolid(proj.x, proj.y, proj.w, proj.h, proj); n++) proj.y += up ? 1 : -1;
    if (up) for (let n = 0; n < 16 && rectSolid(proj.x, proj.y, proj.w, proj.h, proj); n++) proj.y++;
    if (!up && !down) for (let n = 0; n < 30 && rectSolid(proj.x, proj.y, proj.w, proj.h, proj); n++) proj.x -= p.dir;
    for (let n = 0; n < 16 && rectSolid(proj.x, proj.y, proj.w, proj.h, proj); n++) proj.y--;
    L.projs.push(proj);
    // Weight: a mosquito leaves the mouth with a flick, a crate shoves Nila back and shakes the screen.
    Sound.play(charged ? 'bigspit' : 'spit', w); p.sx = (charged ? 1.3 : 1.1) + w * .06; p.sy = (charged ? .72 : .9) - w * .05;
    p.vx -= p.dir * (up || down ? .2 : (charged ? 1.6 : .8) * w); Cam.shake(charged ? 4 : Math.round(1 + w), charged ? 10 : 4 + Math.round(w * 2));
    if (up && !p.onGround) p.vy += .5 * w; // shooting a load up pushes her down a touch
    Input.rumble(charged ? 160 : 40 + w * 30, charged ? .8 : .15 + w * .2, .4); if (charged) { Cam.punch(1.06); Game.stop(3); Game.word('¡ZAS!', m.x + p.dir * 10, m.y - 14, '#e79b3f', true); }
    spawnParts(charged ? 16 : 5 + Math.round(w * 4), m.x, m.y, { color: ['#cfe0e8', '#e8f2f6', charged ? '#e79b3f' : '#9fc0cc'], angle: up ? -Math.PI / 2 : down ? Math.PI / 2 : (p.dir > 0 ? 0 : Math.PI), spread: .5, speed: [1.5, charged ? 5 : 3.5], life: [8, 16], g: 0 });
  },
  spitWater(charged, up, down) {
    const p = Player, m = p.mouth(); const n = charged ? 9 : 4;
    const volley = { projs: [], charged: !!charged, splashes: 0 };
    for (let i = 0; i < n; i++) {
      let vx = p.dir * (5.5 + i * .25 + (charged ? 1.5 : 0)), vy = -1.5 + i * .12; if (up) { vx = p.dir * .5; vy = -7 - i * .5; } else if (down) { vx = p.dir * .6; vy = 5.5; }
      const proj = Proj.create({ kind: 'agua', w: 8, h: 8, sprite: ART.drop }, m.x - 4, m.y - 4, vx, vy, false); proj.delay = i * 2; proj.volley = volley; volley.projs.push(proj); L.projs.push(proj);
    }
    Water.muzzle(m, p.dir, up, down, charged);
    if (down) { p.vy = -4.2; p.jumpCut = false; }
    for (let i = 0; i < 4; i++) L.parts.push({ x: m.x + rnd(-3, 3), y: m.y + 2, vx: rnd(-.3, .3), vy: rnd(0, .4), life: 22 + i * 6, color: ['#8fd9d0', '#e8fbff'][i & 1], size: 1, g: .1, kind: 'dot' });
    Sound.play('splash'); p.sx = 1.2; p.sy = .85; Cam.shake(charged ? 3 : 1, 6); Input.rumble(80, .3, .3);
  },
  // Before the puff is learned, a tap with an empty mouth is only a bubble: Bigotes tried, nothing happens.
  burp() { const p = Player, m = p.mouth(); p.puffCd = 18; p.puffT = 4; Sound.play('blub'); spawnParts(2, m.x, m.y, { color: ['#cfe8f0', '#e8fbff'], angle: -Math.PI / 2, spread: .6, speed: [.2, .5], life: [16, 26], g: -.03 }); },
  // The puff has a beat of anticipation: Bigotes fills his cheeks, then lets the gust go.
  inhale() { const p = Player, m = p.mouth(); p.puffCd = 22; p.puffWind = 5; Sound.play('inhale'); p.sx = .96; p.sy = 1.05; for (let i = 0; i < 4; i++) L.parts.push({ x: m.x + p.dir * rnd(8, 16), y: m.y + rnd(-6, 6), vx: -p.dir * rnd(.8, 1.4), vy: 0, life: 7, color: '#cfe8f0', size: 1, g: 0, kind: 'dot' }); },
  puff() {
    const p = Player, m = p.mouth(); p.puffT = 8; p.spitT = 6; Sound.play('gust'); p.sx = 1.14; p.sy = .9; p.vx -= p.dir * .5;
    Cam.shake(1, 4); Input.rumble(60, .25, .35);
    // The gust travels: whatever it reaches is pushed as the front goes by.
    (L.gusts || (L.gusts = [])).push({ x0: m.x, y: m.y, dir: p.dir, t: 0, front: 0, hit: new Set(), seed: Math.random() * 100 });
    for (let i = 0; i < 6; i++) L.parts.push({ x: m.x, y: m.y + rnd(-3, 3), vx: p.dir * rnd(1.5, 3), vy: rnd(-.6, .6), life: rnd(10, 18) | 0, max: 18, color: '#f2fbff', size: 1, g: -.005, kind: 'mist' });
    Game.word('¡FUUU!', m.x + p.dir * 14, m.y - 12, '#dff2fb', false); const w = L.words[L.words.length - 1]; if (w) w.drift = p.dir * .8;
    // Standing on a raft, the puff is a jet: the raft goes the other way.
    if (p.carrier && p.carrier.kind === 'raft') { p.carrier.vx -= p.dir * 1.9; Game.word('¡ALLÁ VA!', p.carrier.x + 12, p.carrier.y - 10, '#c78d4e', false); }
  },
  // A gust moves forward for a few frames; its reach grows like a cone.
  gustUpdate(q) {
    q.t++; const sp = Math.max(1.4, 6.4 - q.t * .3); q.front += sp;
    const reach = q.front, half = 9 + reach * .22, box = { x: q.dir > 0 ? q.x0 - 2 : q.x0 - reach, y: q.y - half, w: reach + 2, h: half * 2 };
    let any = false;
    for (const e of L.ents) {
      if (e.dead || q.hit.has(e) || !overlap(box, e)) continue; q.hit.add(e);
      if (e.kind === 'pinwheel') { e.blow(e, q.dir); any = true; continue; }
      if (e.kind === 'raft') { if (e !== Player.carrier) e.vx += q.dir * 2.2; any = true; continue; }
      if (!e.enemy) continue; any = true;
      if (e.armored && !e.flipped) { e.tug = 10; e.tugDir = q.dir; Game.word('¡AGARRA!', e.x + e.w / 2, e.y - 6, '#f28b6a', false); continue; }
      const k = Math.max(.6, 1 - reach / 90); e.vx = q.dir * 2.8 * k; e.vy = -2 * k; e.stun = 40; e.sucked = 0; if (e.kind === 'frog') e.state = 'sit';
      for (let i = 0; i < 5; i++) L.parts.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: q.dir * rnd(.5, 2), vy: rnd(-1.2, .4), life: rnd(10, 18) | 0, max: 18, color: '#f2fbff', size: 1, g: 0, kind: 'mist' });
      Game.word('¡FIUU!', e.x + e.w / 2, e.y - 6, '#dff2fb', false);
    }
    if (any) { Sound.play('pop'); Input.rumble(40, .2, .2); }
    // The wind carries whatever floats: mist, dust, fireflies, rain, leaves.
    for (const pt of L.parts) if (pt.kind !== 'cria' && pt.kind !== 'puddle' && pt.kind !== 'wetrun' && pt.x > box.x && pt.x < box.x + box.w && pt.y > box.y && pt.y < box.y + box.h) { pt.vx += q.dir * .35; pt.vy -= .05; }
    // Ground below the gust: leaves and dust whirl up.
    if (q.t % 2 === 0 && q.t < 12) { const fx = q.x0 + q.dir * reach; for (let dy = 0; dy < 40; dy += 4) if (rectSolid(fx, q.y + dy, 1, 1)) { const th = L.def.theme, cols = th === 'cave' ? ['#6b4a60', '#8a6a7a'] : th === 'storm' ? ['#6a7a5a', '#8a9a6a'] : ['#7fb040', '#a3cf52', '#c9b08a']; for (let i = 0; i < 3; i++) L.parts.push({ x: fx - q.dir * rnd(0, 10), y: q.y + dy - 1, vx: q.dir * rnd(.8, 2.2), vy: -rnd(.6, 1.8), life: rnd(20, 36) | 0, color: cols[i % cols.length], size: 1, g: .04, kind: 'leaf' }); break; } }
    if (q.t > 20) q.dead = true;
  },
  jet() {
    const p = Player, h = p.held; const hd = Player.fishHead; const jx = hd ? hd.x + Cam.x : p.x + 5, jy = hd ? hd.y + Cam.y + 4 : p.y + 20; const was = h.amount; h.amount -= 1 / 95; Sound.jet(true);
    // Running dry is announced: a word at a quarter left, then the jet coughs.
    if (was >= .25 && h.amount < .25) Game.word('¡POCA!', p.x + 5, p.y - 10, '#8fd9d0', false);
    if (h.amount < .25 && p.animT % 9 === 0) { Sound.play('sputter'); spawnParts(2, jx, jy, { color: ['#8fd9d0', '#e8fbff'], speed: [.5, 1.5], life: [6, 10], g: .1 }); }
    if (p.animT % 2 === 0) spawnParts(2, jx + rnd(-3, 3), jy, { color: ['#8fd9d0', '#c8f2ea', '#e8fbff'], angle: Math.PI / 2, spread: .5, speed: [2, 3.5], life: [10, 18], g: .08 });
    if (p.animT % 12 === 0) spawnParts(1, jx, jy + 2, { color: '#e8fbff', angle: Math.PI / 2, spread: .2, speed: [1, 2], life: [6, 10], g: 0, kind: 'puff' });
  },
  hurt(fromDir) {
    const p = Player; if (p.inv > 0 || p.dead || p.win) return;
    p.hp--; p.inv = 90; p.hurtT = 20; p.dizzyT = 80; p.vx = Player.safeSide(-fromDir) ? -fromDir * 2.4 : (p.carrier ? p.carrier.vx || 0 : 0);   // on a moving raft she keeps its speed, so she lands back on it p.vy = -3.2; p.onGround = false; p.charge = 0; p.hover = false; Player.letGo(); Sound.jet(false); Sound.play('hurt'); Cam.shake(3, 10); Game.stop(5); Game.hurtFlash = 14; Input.rumble(200, 1, .6);
    if (p.held) { const h = p.held; p.held = null; if (h.kind !== 'agua') { const e = Item.fromHeld(h, p.x + 5 - h.w / 2, p.y - h.h - 2); if (e) { e.vy = -2; e.vx = -fromDir * 1.5; L.ents.push(e); } } else spawnParts(8, p.x + 5, p.y + 8, { color: ['#8fd9d0', '#c8f2ea'], speed: [1, 2.5], life: [10, 18], g: .08 }); }
    if (p.hp <= 0) { p.dead = true; p.deadT = 0; p.vy = -4.5; p.vx = -fromDir * 1; }
  },
  draw(g) {
    const p = Player, cam = Cam, N = ART.nila;
    if (Aprende.posing()) return;
    if (Victoria.active()) { Victoria.drawWorld(g); return; }
    if (p.inv > 0 && (p.inv >> 2) % 2 === 0 && !p.dead) return;
    const fx = Math.round(p.x - cam.x), fy = Math.round(p.y - cam.y);
    // Every pose is 16×22 with the boots on its last row: anchor it to the bottom of the hitbox.
    let spr, by = fy + p.h;
    if (p.dead || p.hurtT > 0) spr = N.hurt;
    else if (p.win) spr = (p.animT >> 3) % 2 ? N.win : N.idle[0];
    else if (p.mantleT > 0) { spr = N.crouch; by = fy + 12 + Math.round(p.mantleT * .6); }
    else if (p.slide > 0) spr = N.slide;
    else if (p.crouch) spr = N.crouch;
    else if (p.pound || p.flap > 8) spr = N.tuck;
    else if (p.onWall) spr = N.wall;
    else if (p.hover || p.grapple) spr = N.dangle[(p.animT >> 3) % 2];
    else if (p.spitT > 6 && p.onGround) spr = N.spit;
    else if ((p.sucking || p.charge > 8) && p.onGround) spr = N.brace;
    else if (p.skidT > 0 && p.onGround) spr = N.skid;
    else if (!p.onGround) spr = p.vy < -1.5 ? N.jump : p.vy < 1.5 ? N.apex : N.fall;
    else if (Math.abs(p.vx) > .5) spr = N.run[Math.floor(p.animT / 5) % 6];
    else spr = p.blink > 0 ? N.idle[1] : (p.animT % 240) < 40 ? N.idle[2] : N.idle[0];
    if (p.dir < 0) spr = ART.flip(spr);
    const cx = fx + 5;
    // Shear around the boots: positive leans her back (away from where she faces).
    let lean = p.sucking && !p.aimUp && !p.grapple ? p.dir * .05 : p.charge > 8 ? p.dir * .06 : 0;
    if (p.slide > 0) lean = p.dir * .18; else if (p.onWall) lean = p.onWall * -.12; else if (p.onGround && Math.abs(p.vx) > 1.2 && !p.sucking) lean = -p.dir * .06;
    const recoil = p.spitT > 8 ? -p.dir * 1 : 0;
    if (p.slide > 0) { Player.drawSled(g, cx, by, spr); return; }
    const fish = Player.drawFish(g, fx, fy); fish.back();
    g.save(); g.translate(cx, by); g.scale(p.sx, p.sy); if (lean) g.transform(1, 0, lean, 1, 0, 0); g.translate(-cx, -by);
    g.drawImage(spr, cx - 8 + recoil, by - spr.height);
    g.restore();
    fish.front();
    Player.drawWater(g);
  },
  // The slide: Bigotes lies flat as a sled, head first and grinning, tail beating hard; Nila rides on his
  // belly. Speed lines stream behind them.
  drawSled(g, cx, by, spr) {
    const p = Player, t = p.animT, d = p.dir, fs = p.slideGo > 0 ? ART.fish.open : (t >> 2) % 2 ? ART.fish.open : ART.fish.full;
    const speed = Math.min(1, Math.abs(p.vx) / 3.3), go = p.slideGo > 0 ? p.slideGo / 10 : 0;
    // Speed lines.
    for (let i = 0; i < 6; i++) { const len = 10 + ((i * 7 + t * 3) % 14) * speed, y = by - 3 - i * 3 - (i % 2), x0 = cx - d * (10 + ((t * 5 + i * 11) % 9)); g.globalAlpha = .25 + speed * .5; g.fillStyle = i % 2 ? '#fff6d6' : '#dff2fb'; g.fillRect(Math.round(d > 0 ? x0 - len : x0), y, Math.round(len), 1); } g.globalAlpha = 1;
    // After-images: where they were a moment ago, fading.
    (p.slideTrail || []).forEach((q, i, a) => { const ax = Math.round(q.x - Cam.x) + 5, ay = Math.round(q.y - Cam.y); g.globalAlpha = .12 + .1 * i; g.save(); g.translate(ax, ay - 7); g.transform(1, 0, d * .22, 1, 0, 0); g.drawImage(spr, -8, -spr.height + 2); g.restore(); g.save(); g.translate(ax, ay - 5); g.scale(d, 1); g.drawImage(ART.fish.open, -11, -6); g.restore(); }); g.globalAlpha = 1;
    // Bigotes: stretched when launching, tail wagging, a little tilt with each beat.
    g.save(); g.translate(cx, by - 5); g.scale(d * (1 + go * .25), 1 - go * .15); g.rotate(Math.sin(t * .9) * .05);
    g.drawImage(fs, -11, -6); Player.fishOverlay(g, fs, -11, -6, t, { mood: 'happy', lx: 1 });
    // The tail beating: a few pixels of fin swishing at the back.
    const w = Math.sin(t * 1.4) * 3; g.fillStyle = '#7a5630'; g.fillRect(-13, Math.round(-3 + w), 2, 3); g.fillStyle = '#c8944a'; g.fillRect(-14, Math.round(-2 + w), 1, 2);
    g.restore();
    // Nila on his back, leaning into the speed.
    g.save(); g.translate(cx, by - 7); g.scale(p.sx, p.sy); g.transform(1, 0, d * .22, 1, 0, 0); g.drawImage(spr, -8, -spr.height + 2); g.restore();
  },
  // Bigotes has a spine: the sprite is drawn in one-pixel slices from the hand outward, and each slice
  // follows a curve that bends toward whatever he is about to do. The tail lags, whips and wags.
  drawFish(g, fx, fy) {
    const p = Player, t = p.animT, ease = u => u * u * (3 - 2 * u);
    let fs = ART.fish.closed;
    if (p.puffWind > 0) fs = ART.fish.full; else if (p.swallowT > 0) fs = ART.fish.swallow; else if (p.spitT > 6) fs = ART.fish.spit; else if (p.charge >= CHARGE_FULL) fs = ART.fish.squint; else if (p.held) fs = ART.fish.full; else if (p.sucking) fs = ART.fish.open;
    const n = fs.width, h = fs.height, PIV = 7, MID = 6;
    const bob = p.onGround && Math.abs(p.vx) > .5 ? ((t >> 3) % 2 ? 1 : 0) : 0;
    let hx = fx + 5 + p.dir * 7, hy = fy + (p.crouch ? 7 : 12) + bob;
    let bend = 0, tailBend = 0, wave = .6, waveSpeed = .12, spacing = 1, headStretch = 1, lunge = 0, jitter = 0, rot = 0;
    if (p.hover) { hx = fx + 5 + p.dir * 5; hy = fy + 9; bend = Math.PI / 2 * .95; wave = .5; waveSpeed = .3; }
    else if (p.grapple) { const a = p.aim(); bend = p.hanging ? -Math.PI / 2 * .9 : Math.atan2(a.y, a.x * p.dir); hx = fx + 5 + p.dir * (p.hanging ? 1 : 3); hy = fy + (p.hanging ? 1 : 5); wave = .3; }
    else if (p.aimUp) { rot = -Math.PI / 2 * .8; bend = -Math.PI / 2 * .15; hx = fx + 5 + p.dir * 6; hy = fy + 9; }
    else if (!p.onGround && !p.sucking) bend = p.vy < -1 ? -.2 : p.vy > 2 ? .24 : 0;
    if (p.onGround && Math.abs(p.vx) > .5 && !p.sucking) { wave = 1.5; waveSpeed = .38; }
    if (p.onGround && Math.abs(p.vx) < .5 && !p.sucking && !p.held && t % 190 < 14) { wave = 2.2; waveSpeed = .5; }
    if (p.sucking && !p.grapple) { const lv = p.suckLv || 1; headStretch = 1.1 + lv * .06; jitter = .2 + lv * .3; wave = .3; }
    if (p.charge > 8) { const c = Math.min(1, p.charge / CHARGE_FULL); bend += -.45 * c; tailBend = .6 * c; spacing = 1 - .14 * c; jitter = c >= 1 ? 1.1 : .4 * c; wave = .2; }
    if (p.spitT > 0) { const k = (12 - p.spitT) / 12; lunge = p.spitT > 8 ? (12 - p.spitT) * 2.2 : p.spitT * .9; tailBend = Math.sin(k * Math.PI * 2) * 1.1; headStretch = p.spitT > 6 ? 1.35 : 1; wave = 0; }
    if (p.puffWind > 0) { const k = (5 - p.puffWind) / 5; lunge = -k * 2; headStretch = 1 + k * .12; bend -= k * .15; wave = .2; }
    if (p.puffT > 0) { lunge = -3 + p.puffT * .5; headStretch = 1.15; }
    if (p.hurtT > 0 || p.dead) { bend += .7; wave = 2.5; waveSpeed = .6; }
    if (p.dropT > 0) { bend += .5 * (p.dropT / 10); }
    if (p.flap > 0) { const k = (14 - p.flap) / 14; bend += Math.sin(k * Math.PI) * 1.1; tailBend += -Math.sin(k * Math.PI * 2) * 1.3; headStretch = 1.1; wave = 0; }
    if (p.pound) { bend = p.poundT > 0 ? -.4 : Math.PI / 2 * .8; hx = fx + 5 + p.dir * 3; hy = fy + 8; wave = .2; }
    if (p.onWall) { bend += .35; hx = fx + 5 + p.dir * 6; }
    if (p.slide > 0) { bend -= .25; hy += 2; wave = 1.2; waveSpeed = .5; }
    bend += p.fishLag * .05; tailBend += p.fishLagH * .45;
    const breath = 1 + Math.sin(t / 22) * .035;
    if (!p.sucking && !p.held && p.spitT === 0 && p.swallowT === 0 && t % 230 < 5) fs = ART.fish.blink;
    const bulgeU = p.swallowT > 0 ? 1 - ((10 - p.swallowT) / 10) * .65 : -9;
    const water = p.held && p.held.kind === 'agua';
    const img = p.charge >= CHARGE_FULL && (t >> 1) % 3 === 0 ? ART.tint(fs, '#fff6d6') : fs;
    const tintW = water ? ART.tint(fs, '#7fd0c8') : null;
    const cols = new Array(n); let px = 0, py = 0;
    for (let c = PIV; c < n; c++) { const u = (c - PIV) / (n - 1 - PIV); const a = rot + bend * ease(u); cols[c] = { x: px, y: py, a }; const st = spacing * (c > 14 ? headStretch : 1); px += Math.cos(a) * st; py += Math.sin(a) * st; }
    px = 0; py = 0;
    for (let c = PIV - 1; c >= 0; c--) { const u = (PIV - 1 - c) / (PIV - 1); const a = rot - tailBend * ease(u) - bend * .12 * u; px -= Math.cos(a); py -= Math.sin(a); cols[c] = { x: px, y: py, a }; }
    for (let c = 0; c < n; c++) {
      const sl = cols[c], u = c / (n - 1);
      sl.off = Math.sin(t * waveSpeed + c * .45) * wave * (1 - u) * (1 - u) + (jitter ? (Math.random() - .5) * jitter : 0) + p.fishLag * (.15 + u * .5);
      sl.sy = breath; sl.dy = -(breath - 1) * MID; if (bulgeU > -1) { const b = Math.max(0, 1 - Math.abs(u - bulgeU) * 4); sl.sy = 1 + b * .55; sl.dy = -b * 2.6; }
    }
    // A point of the sprite (column c, row r) on screen, following the bent spine.
    const HX = Math.round(hx), HY = Math.round(hy);
    const at = (c, r) => { const sl = cols[c], yy = -MID + sl.off + sl.dy + r * sl.sy; return { x: HX + p.dir * (lunge + sl.x - Math.sin(sl.a) * yy), y: HY + sl.y + Math.cos(sl.a) * yy, a: sl.a }; };
    // Carried under her arm, his tail tucks behind Nila; when he is held out (hover, aiming, flapping...)
    // he is drawn whole in front. The far whisker always goes behind him, the near one in front.
    const tuck = !(p.hover || p.aimUp || p.grapple || p.pound || p.flap > 0 || p.onWall || p.dead || p.hurtT > 0);
    const slices = (c0, c1) => {
      g.save(); g.translate(HX, HY); g.scale(p.dir, 1); g.translate(lunge, 0);
      for (let c = c0; c < c1; c++) {
        const sl = cols[c], y0 = -MID + sl.off + sl.dy;
        g.save(); g.translate(sl.x, sl.y); g.rotate(sl.a);
        g.drawImage(img, c, 0, 1, h, -.5, y0, 1.6, h * sl.sy);
        if (tintW) { const lv = Math.max(3, Math.min(9, 5.5 + Math.sin(t / 5 + c * .55) * 1.8 + (1 - p.held.amount) * 3.5)); g.globalAlpha = .55; g.drawImage(tintW, c, lv, 1, h - lv, -.5, y0 + lv * sl.sy, 1.6, (h - lv) * sl.sy); g.globalAlpha = 1; }
        g.restore();
      }
      g.restore();
    };
    const head = cols[n - 1]; Player.fishHead = { x: HX + p.dir * (lunge + head.x), y: HY + head.y, a: head.a };
    return {
      back() { Player.drawBarbels(g, at, 'far'); if (tuck) slices(0, PIV); },
      front() {
        slices(tuck ? PIV : 0, n);
        Player.drawBarbels(g, at, 'near');
        Player.drawFishLife(g, at, fs, t);
        if (p.grapple) { const hd = Player.fishHead, a = p.grapple, top = Math.round(a.top - Cam.y), cx = Math.round(a.x + 5 - Cam.x), vib = p.hanging ? 0 : Math.sin(t * 2.3) * .6;
          g.fillStyle = '#e8f0f8'; const n = Math.max(1, Math.round(Math.hypot(hd.x - cx, hd.y - top))); for (let i = 0; i <= n; i++) { const k = i / n; g.fillRect(Math.round(cx + (hd.x - cx) * k + Math.sin(k * Math.PI) * vib), Math.round(top + 2 + (hd.y - 2 - top) * k), 1, 1); }
          Item.hookShape(g, Math.round(hd.x), Math.round(hd.y) - 10, false, t, p.dir); }
        // Nila's hand comes down over his flank, just under her chin.
        const hs = p.dir > 0 ? ART.hand : ART.flip(ART.hand);
        g.drawImage(hs, HX - (p.dir > 0 ? 3 : hs.width - 4), HY - 3);
      } };
  },
  // Bigotes' eye and its moods, drawn at (ex, ey): open with a pupil looking along (lx, ly), closed
  // when blinking, a happy arc with blush and hearts, a sleepy line with z's, brows, dizzy stars.
  drawEye(g, ex, ey, lx, ly, st, t) {
    const d = st.dir || 1;
    if (st.happy || st.sleep || st.blink) {
      g.fillStyle = '#88863a'; g.fillRect(ex - 2, ey - 1, 4, 3);
      g.fillStyle = '#1d1826'; if (st.happy) { g.fillRect(ex - 2, ey, 1, 1); g.fillRect(ex - 1, ey - 1, 3, 1); g.fillRect(ex + 2, ey, 1, 1); g.fillStyle = '#f07080'; g.fillRect(ex - 2, ey + 2, 2, 1); g.fillRect(ex + 2, ey + 2, 1, 1); }
      else g.fillRect(ex - 2, ey, 5, 1);
    } else {
      // A 4×3 white with a 2×2 pupil that shifts toward what he looks at (a wider eye when startled).
      const shock = st.shock, ew = shock ? 5 : 4, eh = shock ? 4 : 3, x0 = ex - (ew >> 1), y0 = ey - (eh >> 1);
      g.fillStyle = '#1d1826'; g.fillRect(x0 - 1, y0 - 1, ew + 2, 1); g.fillRect(x0 - 1, y0, 1, eh); g.fillRect(x0 + ew, y0, 1, eh);
      g.fillStyle = '#fbf6e0'; g.fillRect(x0, y0, ew, eh);
      const pxo = lx > .35 ? ew - 2 : lx < -.35 ? 0 : (ew - 2) >> 1, pyo = ly > .35 ? eh - 2 : ly < -.35 ? 0 : (eh - 2) >> 1;
      g.fillStyle = '#1d1826'; g.fillRect(x0 + pxo, y0 + pyo, shock ? 1 : 2, shock ? 1 : 2);
      if (!shock) { g.fillStyle = '#ffffff'; g.fillRect(x0 + pxo, y0 + pyo, 1, 1); }
    }
    if (st.mad || st.sad) { g.fillStyle = '#1d1826'; const top = ey - (st.shock ? 4 : 3); for (let i = -2; i <= 2; i++) g.fillRect(ex + i, top + Math.round((st.mad ? i * d : -i * d) * .4), 1, 1); }
    if (st.sleep) for (let i = 0; i < 3; i++) { const k = ((t + i * 40) % 120) / 120; g.globalAlpha = 1 - k; ART.text(g, 'z', Math.round(ex + 4 + k * 8 + i * 2), Math.round(ey - 6 - k * 16), '#dfe8ff', 'left'); g.globalAlpha = 1; }
    if (st.happy) for (let i = 0; i < 2; i++) { const k = (st.happyK !== undefined ? st.happyK : ((t % 60) / 60)) + i * .36; if (k > 1) continue; const hx = ex + (i ? 6 : -2) + Math.sin(k * 8 + i) * 2, hy = ey - 6 - k * 14; g.globalAlpha = 1 - k; g.fillStyle = '#f05070'; g.fillRect(Math.round(hx), Math.round(hy), 1, 1); g.fillRect(Math.round(hx) + 2, Math.round(hy), 1, 1); g.fillRect(Math.round(hx), Math.round(hy) + 1, 3, 1); g.fillRect(Math.round(hx) + 1, Math.round(hy) + 2, 1, 1); g.globalAlpha = 1; }
    if (st.dizzy) for (let i = 0; i < 3; i++) { const a = t * .18 + i * 2.1, sx = ex + Math.cos(a) * 7, sy = ey - 7 + Math.sin(a) * 2.5; g.fillStyle = Math.sin(a) > 0 ? '#fff3b8' : '#c8a850'; g.fillRect(Math.round(sx), Math.round(sy) - 1, 1, 3); g.fillRect(Math.round(sx) - 1, Math.round(sy), 3, 1); }
  },
  // The same life for Bigotes anywhere outside play (title, cinematic, HUD, map, screens): drawn on an
  // unbent sprite whose top-left is (ox, oy) in the current transform, the head facing +x.
  fishOverlay(g, spr, ox, oy, t, o = {}) {
    if (!spr || spr.width !== 22) return;
    const F = ART.fish, P = (x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(ox + x), Math.round(oy + y), w, h); };
    // Far whisker behind is skipped; the near ones sway from the jaw.
    if (!o.noWhiskers) for (const [c, r, n, base, col, tip] of [[20, 7.5, 7, .7, '#e0a45a', '#8a5a34'], [18, 8, 5, 1.1, '#9a6a3a', '#5a3e2a']]) {
      let x = c, y = r, a = base; for (let i = 0; i < n; i++) { a += .22 + Math.sin(t / 18 + i * .5 + c) * .07; x += Math.cos(a) * 1.2; y += Math.sin(a) * 1.2; P(x, y, i > n - 3 ? tip : col); }
    }
    P(12, 5.5, '#3e3a24'); P(12, 7.5, '#3e3a24'); P(11.5, 8.5, '#3e3a24'); if (Math.sin(t / 22) > .3) P(13, 7, '#d0604e');
    const fa = Math.sin(t * .22) * .6; for (let i = 0; i < 4; i++) P(13 - i * .9 + Math.cos(Math.PI / 2 + fa) * i * .3, 9.5 + Math.sin(Math.PI / 2 + fa) * i * .8, i < 2 ? '#c8944a' : '#7a5630');
    const sk = (t % 170) / 22; if (sk < 1) P(6 + sk * 13, 4.2, '#fffbe0', 2, 1);
    const baked = spr === F.blink || spr === F.squint || spr === F.spit || spr === F.swallow, eye = Player.eyeOf(spr);
    if (eye && !baked && !o.noEye) Player.drawEye(g, Math.round(ox + eye.c), Math.round(oy + eye.r), o.lx !== undefined ? o.lx : 1, o.ly || 0, { blink: (t % 230) < 5, happy: o.mood === 'happy', mad: o.mood === 'mad', sad: o.mood === 'sad', shock: o.mood === 'shock', sleep: o.mood === 'sleep', dir: 1 }, t);
  },
  // Where the eye is in each fish sprite, found once by its colours (white, shine and pupil).
  eyeOf(spr) {
    const E = Player._eyes || (Player._eyes = new Map()); if (E.has(spr)) return E.get(spr);
    let box = null; try {
      const d = spr.getContext('2d').getImageData(0, 0, spr.width, spr.height).data;
      for (let y = 2; y < 9; y++) for (let x = 12; x < spr.width; x++) { const i = (y * spr.width + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2], al = d[i + 3]; if (!al) continue; const white = r > 225 && g > 215 && b > 180, pupil = r < 40 && g < 35 && b < 45;
        if (white || pupil) box = box ? { x0: Math.min(box.x0, x), y0: Math.min(box.y0, y), x1: Math.max(box.x1, x), y1: Math.max(box.y1, y) } : { x0: x, y0: y, x1: x, y1: y }; }
    } catch (e) { box = null; }
    const eye = box ? { c: (box.x0 + box.x1) / 2, r: (box.y0 + box.y1) / 2 } : null; E.set(spr, eye); return eye;
  },
  // Life on top of the sprite: an eye that looks at things, brows for his mood, gills that breathe,
  // a paddling fin, a wet shine, drips, bubbles when bored, sleep, hearts and dizzy stars.
  drawFishLife(g, at0, fs, t) {
    const at = (c, r) => at0(Math.max(0, Math.min(fs.width - 1, Math.round(c))), r);
    const p = Player, F = ART.fish, px = (x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
    // Gills: a dark slit that opens with each breath and flashes red.
    const br = Math.sin(t / 22), g1 = at(12, 5.5), g2 = at(12, 7.5), g3 = at(11.5, 8.5);
    px(g1.x, g1.y, '#3e3a24'); px(g2.x, g2.y, '#3e3a24'); px(g3.x, g3.y, '#3e3a24'); if (br > .3 || p.charge > 8) { const gr = at(13, 7); px(gr.x, gr.y, '#d0604e'); }
    // Pectoral fin paddling under the belly.
    const act = p.hover ? 1 : p.onGround && Math.abs(p.vx) > .5 ? .8 : p.sucking ? .6 : .25, fa = Math.sin(t * (.15 + act * .35)) * (.5 + act * .6), fb = at(13, 9.5);
    for (let i = 0; i < 4; i++) { const ang = Math.PI / 2 + fa - p.dir * .6, fxp = fb.x + Math.cos(ang) * i * -p.dir * .8 - p.dir * i * .7, fyp = fb.y + Math.sin(ang) * i * .8; px(fxp, fyp, i < 2 ? '#c8944a' : '#7a5630'); }
    // Wet shine sliding along his back; more of it (and drips) after water.
    const wet = p.wetT > 0, per = wet ? 60 : 170, sk = (t % per) / 22; if (sk < 1) { const sh = at(6 + sk * 13, 4.2); px(sh.x, sh.y, '#fffbe0', 2, 1); }
    if (wet && t % 7 === 0) { const d = at(8 + Math.random() * 10, 10.5); L.parts.push({ x: d.x + Cam.x, y: d.y + Cam.y, vx: 0, vy: .3, life: 24, color: '#8fd9d0', size: 1, g: .15, kind: 'drip' }); }
    // Charging: cheeks flush and pulse.
    if (p.charge > 8) { const k = Math.min(1, p.charge / CHARGE_FULL); g.globalAlpha = .35 + k * .45 * (.6 + .4 * Math.sin(t * .8)); const ck = at(16, 8.2); px(ck.x - 1, ck.y, '#f05060', 3, 1); g.globalAlpha = 1; }
    // The eye: bigger than the sprite's, looking at whatever matters right now.
    const baked = fs === F.blink || fs === F.squint || fs === F.spit || fs === F.swallow, eye = Player.eyeOf(fs);
    if (eye && !baked) {
      const e = at(eye.c, eye.r), ex = Math.round(e.x), ey = Math.round(e.y);
      let lx = p.dir, ly = 0;
      if (p.aimUp || p.grapple) { lx = p.dir * .3; ly = -1; } else if (!p.onGround && p.vy > 4) { lx = 0; ly = 1; } else if (!p.sucking) {
        let best = null, bd = 110; for (const o of L.ents) if (!o.dead && (o.enemy || o.kind === 'pearl' || o.kind === 'maestro')) { const d = Math.hypot(o.x + o.w / 2 - (e.x + Cam.x), o.y + o.h / 2 - (e.y + Cam.y)); if (d < bd) { bd = d; best = o; } }
        if (best) { const dx = best.x + best.w / 2 - (e.x + Cam.x), dy = best.y + best.h / 2 - (e.y + Cam.y), dd = Math.hypot(dx, dy) || 1; lx = dx / dd; ly = dy / dd; }
        else if (p.idleT > 60) { const ph = Math.floor(t / 90) % 4; lx = [p.dir, -p.dir, 0, p.dir][ph]; ly = [0, -1, -1, 0][ph]; }
      }
      Player.drawEye(g, ex, ey, lx, ly, { happy: p.happyT > 0, happyK: (70 - p.happyT) / 50, sleep: p.idleT > 900, shock: !p.onGround && p.vy > 4.5 || p.hurtT > 10, blink: (t % 230) < 5, mad: p.sucking || p.charge > 8, sad: p.hurtT > 0 || p.dizzyT > 40 || p.dead, dizzy: p.dizzyT > 0, dir: p.dir }, t);
    }
    // Bored: he blows a bubble that grows at his lips and pops.
    if (p.idleT > 150 && p.idleT < 900) { const k = (p.idleT - 150) % 160; if (k < 60) { const m = at(21.5, 7), r = k / 60 * 3.5; g.globalAlpha = .85; g.strokeStyle = '#cfeef8'; g.beginPath(); g.arc(m.x + p.dir * (r + 1), m.y - r * .3, Math.max(.8, r), 0, 7); g.stroke(); g.fillStyle = '#ffffff'; g.fillRect(Math.round(m.x + p.dir * (r + 1) - r * .4), Math.round(m.y - r * .3 - r * .5), 1, 1); g.globalAlpha = 1; } if (k === 60) { const m = at(21.5, 7); Sound.play('pop'); for (let i = 0; i < 6; i++) L.parts.push({ x: m.x + Cam.x + p.dir * 4, y: m.y + Cam.y - 1, vx: Math.cos(i) * .8, vy: Math.sin(i) * .8, life: 10, color: '#cfeef8', size: 1, g: 0 }); } }
  },
  // Bigotes' whiskers: two long ones from the corners of the upper jaw that droop, trail behind with
  // inertia (a little verlet chain in world space) and get dragged forward by his own suction; and two
  // short ones under the chin that sway. `at(c, r)` maps a sprite pixel to the screen.
  drawBarbels(g, at, layer) {
    const p = Player, t = p.animT, dir = p.dir;
    const specs = { near: { c: 20, r: 7.5, n: 6, seg: 1.3, base: .55, curl: .4, col: '#d49a52', tip: '#8a5a34' }, far: { c: 18, r: 7.5, n: 5, seg: 1.3, base: .9, curl: .38, col: '#7a5634', tip: '#5a3e2a' } };
    const s = specs[layer], root = at(s.c, s.r), a = root.a;
    let base = s.base, curl = s.curl, flutter = 0;
    if (p.sucking) { base = .45; curl = -.12; flutter = .7; }
    else if (p.spitT > 6) { base = 2.4; curl = .1; flutter = .3; }
    else if (p.charge > 8) flutter = .25;
    const wx = root.x + Cam.x, wy = root.y + Cam.y;
    const key = layer === 'near' ? 'barbN' : 'barbF';
    let ch = p[key];
    const restAt = i => { let ang = base, x = wx, y = wy; for (let k = 0; k < i; k++) { const aa = ang + a; x += Math.cos(aa) * s.seg * dir; y += Math.sin(aa) * s.seg; ang += curl; } return { x, y }; };
    if (!ch || ch.t !== t - 1 && ch.t !== t) { ch = p[key] = { t, pts: [] }; for (let i = 0; i <= s.n; i++) { const q = restAt(i); ch.pts.push({ x: q.x, y: q.y, px: q.x, py: q.y }); } }
    if (ch.t !== t) {
      ch.t = t;
      const pts = ch.pts; pts[0].x = pts[0].px = wx; pts[0].y = pts[0].py = wy;
      for (let i = 1; i < pts.length; i++) {
        const q = pts[i], vx = (q.x - q.px) * .82, vy = (q.y - q.py) * .82; q.px = q.x; q.py = q.y;
        q.x += vx; q.y += vy + .06;
        const r = restAt(i), k = .16 + .1 * (1 - i / pts.length);
        q.x += (r.x - q.x) * k; q.y += (r.y - q.y) * k;
        if (flutter) { q.x += Math.sin(t * 1.3 + i * 1.7) * flutter * i / pts.length; q.y += Math.cos(t * 1.1 + i) * flutter * i / pts.length; }
      }
      for (let it = 0; it < 2; it++) for (let i = 1; i < pts.length; i++) { const A = pts[i - 1], B = pts[i], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, m = s.seg / d; B.x = A.x + dx * m; B.y = A.y + dy * m; }
    }
    // Plot it as a one-pixel line, lighter along its length and darker at the tip.
    const pts = ch.pts, last = pts.length - 1;
    for (let i = 1; i < pts.length; i++) {
      const A = pts[i - 1], B = pts[i], steps = Math.max(1, Math.ceil(Math.hypot(B.x - A.x, B.y - A.y)));
      g.fillStyle = i >= last - 1 ? s.tip : s.col;
      for (let k = 0; k < steps; k++) { const u = k / steps; g.fillRect(Math.round(A.x + (B.x - A.x) * u - Cam.x), Math.round(A.y + (B.y - A.y) * u - Cam.y), 1, 1); }
    }
    if (layer === 'near') {
      // Chin whiskers: two short strands that hang and sway.
      g.fillStyle = '#c9a86e';
      for (const [c, len, ph] of [[19, 3, 0], [17, 2, 1.7]]) { const q = at(c, 10.5), sw = Math.sin(t / 9 + ph) * .6 - p.vx * .25 * dir; for (let k = 1; k <= len; k++) g.fillRect(Math.round(q.x - dir * sw * k * .5), Math.round(q.y + k - 1), 1, 1); }
    }
  },
  // Nila with Bigotes under her arm for the still scenes (title, story, clear, ending); x, y is where her
  // hitbox corner would be. His tail tucks behind her like in play, and his whiskers hang in a hook.
  drawCarry(g, x, y, spr, fish, bob = 0) {
    const F = fish, fy = y + 6 + bob;
    g.drawImage(F, 0, 0, 7, F.height, x + 5, fy, 7, F.height);
    g.drawImage(spr, x - 3, y + 18 - spr.height);
    g.drawImage(F, 7, 0, F.width - 7, F.height, x + 12, fy, F.width - 7, F.height);
    Player.fishOverlay(g, F, x + 5, fy, Game.t, Player.carryLook || {});
    g.drawImage(ART.hand, x + 9, y + 9 + bob);
  },
  // Water in motion: the hover jet down to the ground and the thread of water climbing from a pool.
  drawWater(g) {
    const p = Player, t = Game.t; if (!Player.fishHead) return;
    const head = Player.fishHead;
    if (p.hover) {
      // The jet falls all the way down: a solid column near the mouth that breaks into ropes of drops as it drops.
      const wx = head.x + Cam.x, wy = head.y + Cam.y, maxLen = Math.max(64, H - head.y + 24); let len = 0;
      while (len < maxLen && !rectSolid(wx, wy + len, 1, 1) && !waterAt(wx, wy + len)) len += 2;
      const hitGround = len < maxLen, body = Math.min(len, 56);
      Game.drawStream(g, head.x, head.y, head.x, head.y + body, t, 1, 3.2);
      if (len > body) {
        const hx = Math.round(head.x);
        for (let s = 0; s < 3; s++) for (let y = body - 2; y < len; y++) {
          const f = (y - body) / Math.max(1, len - body), spread = 1 + f * 3, x = hx + Math.round((s - 1) * spread + Math.sin((y + s * 11) / 9 + t * .2) * f * 1.5);
          const ph = (y + s * 5 - t * 6) % 14, on = ((ph + 14) % 14) < 11 - Math.round(f * 5);
          if (!on) continue;
          const lead = ((ph + 14) % 14) < 1.5;
          g.fillStyle = '#1d4a55'; g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1);
          g.fillStyle = lead ? '#f2fffb' : s === 1 ? '#c8f2ea' : '#8fd9d0'; g.fillRect(x, y, 1, 1);
        }
        if (t % 3 === 0) L.parts.push({ x: wx + rnd(-3, 3), y: wy + body + rnd(0, len - body), vx: rnd(-.3, .3), vy: 1.5, life: 10, color: Math.random() < .4 ? '#f2fffb' : '#8fd9d0', size: 1, g: .15, kind: 'spray' });
      }
      if (hitGround) {
        if (t % 2 === 0) L.parts.push({ x: wx + rnd(-2, 2), y: wy + len - 1, vx: rnd(-1.4, 1.4), vy: rnd(-2.2, -.8), life: rnd(8, 14) | 0, color: Math.random() < .35 ? '#f2fffb' : '#8fd9d0', size: 1, g: .18, kind: 'spray' });
        g.fillStyle = '#c8f2ea'; const cw = 3 + ((t >> 1) % 3); g.fillRect(Math.round(head.x) - cw, Math.round(head.y + len) - 2, cw * 2 + 1, 1); g.fillStyle = '#f2fffb'; g.fillRect(Math.round(head.x) - cw - 1, Math.round(head.y + len) - 3 - (t % 2), 1, 1); g.fillRect(Math.round(head.x) + cw + 1, Math.round(head.y + len) - 3 - ((t + 1) % 2), 1, 1); g.fillStyle = '#e8fbff'; for (let i = 0; i < 4; i++) g.fillRect(head.x - 4 + Math.round(Math.sin(t * .9 + i * 2) * 5), head.y + len - 1 - ((t + i * 3) % 4), 1, 1); if (t % 5 === 0) L.parts.push({ x: wx, y: wy + len, vx: 0, vy: 0, life: 14, color: '#c8f2ea', size: 1, g: 0, kind: 'ripple' }); }
    }
    if (p.sucking && p.waterSrc) {
      const m = p.mouth(); const sx = p.waterSrc.x - Cam.x, sy = p.waterSrc.y - Cam.y, mx = m.x - Cam.x, my = m.y - Cam.y;
      const k = Math.max(.35, Math.min(1, p.waterT / 22));
      Game.drawStream(g, sx, sy, mx + (sx - mx) * (1 - k), my + (sy - my) * (1 - k), -t, 1, 3 + k);
      g.fillStyle = '#1d4a55'; g.fillRect(sx - 3, sy, 6, 1); g.fillStyle = '#c8f2ea'; g.fillRect(sx - 4 + (t % 3), sy - 1, 2, 1); g.fillRect(sx + 2 - (t % 3), sy - 1, 2, 1);
      if (t % 7 === 0) L.parts.push({ x: p.waterSrc.x, y: p.waterSrc.y, vx: 0, vy: 0, life: 16, color: '#8fd9d0', size: 1, g: 0, kind: 'ripple' });
    }
  },

};

// ---------------------------------------------------------------- Objetos
const Item = {
  crate(x, y) { return { kind: 'crate', x, y, w: 14, h: 14, vx: 0, vy: 0, resting: false, suckable: true, sprite: ART.crate, solid: true, update: Item.fallUpdate, draw: Item.plainDraw }; },
  rock(x, y) { return { kind: 'rock', x, y, w: 12, h: 10, vx: 0, vy: 0, resting: false, suckable: true, sprite: ART.rock, solid: false, update: Item.fallUpdate, draw: Item.plainDraw }; },
  fromHeld(h, x, y) { if (h.kind === 'crate') return Item.crate(x, y); if (h.kind === 'rock') return Item.rock(x, y); if (Enemy[h.kind]) { const e = Enemy[h.kind](x, y); e.stun = 30; return e; } return null; },
  fallUpdate(e) {
    if (e.sucked > 0) { e.sucked--; e.resting = false; e.x += e.vx; e.y += e.vy; return; }
    e.vy = Math.min(e.vy + .3, 5); e.vx *= .8; if (Math.abs(e.vx) > .05) moveX(e, e.vx);
    const hit = moveY(e, e.vy);
    if (hit) { if (e.vy > 1.5) { Sound.play('thud'); spawnParts(4, e.x + e.w / 2, e.y + e.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.4, speed: [.4, 1.2], life: [8, 14], g: .04 }); } e.vy = 0; e.resting = true; }
    else e.resting = false;
    if (e.kind === 'crate') { if (!L.solids.includes(e)) L.solids.push(e); if (e.ghost && !overlap(e, Player.rect())) e.ghost = false; }
    if (waterAt(e.x + e.w / 2, e.y + e.h - 2)) { e.dead = true; Sound.play('splash'); spawnParts(10, e.x + e.w / 2, e.y + e.h, { color: ['#8fd9d0', '#c8f2ea'], angle: -Math.PI / 2, spread: 1, speed: [1, 3], life: [14, 26] }); }
    if (e.y > L.h * TS + 40) e.dead = true;
  },
  plainDraw(e, g) { g.drawImage(e.sprite, Math.round(e.x - Cam.x + (e.w - e.sprite.width) / 2), Math.round(e.y - Cam.y + e.h - e.sprite.height)); },
  // A cría the Heron dropped, asleep in its bubble. Touching it pops the bubble and the little one swims home.
  pearl(x, y, id, resting) { return { kind: 'pearl', x, y, w: 9, h: 9, id, vy: 0, vx: 0, resting, t: Math.random() * 100, baseY: y, update: Item.pearlUpdate, draw: Item.pearlDraw }; },
  pearlUpdate(e) {
    e.t++;
    if (e.resting) { if (!rectSolid(e.x, e.y + 1, e.w, e.h) && !oneWayBelow(e.x, e.w, e.y + e.h, e.y + e.h + 1)) { e.vy = Math.min(e.vy + .25, 4); const hit = moveY(e, e.vy); if (hit) e.vy = 0; } else e.vy = 0; }
    if (e.t % 14 === 0 && Math.random() < .6) spawnParts(1, e.x + rnd(1, 8), e.y + rnd(0, 3), { color: '#cfe8f0', speed: [0, .1], life: [18, 30], g: -.02 });
    if (overlap({ x: e.x - 5, y: e.y - 5, w: e.w + 10, h: e.h + 10 }, Player.rect()) && !Player.dead) Item.freeCria(e);
  },
  freeCria(e) {
    e.dead = true; L.taken.add(e.id); L.pearls++; Save.criasSet(L.def.id)[e.id] = 1; Save.write(); Sound.play('pearl'); Game.pearlPop = 12; Input.rumble(40, .2, .2);
    const cx = e.x + 4, cy = e.y + 4, d = Player.x + 5 < cx ? 1 : -1;
    L.parts.push({ x: cx - 3, y: cy - 1, vx: d * 1.1, vy: -2.6, life: 56, color: '#fff', size: 1, g: .1, kind: 'cria' });
    L.parts.push({ x: cx - 4, y: cy - 4, vx: 0, vy: 0, life: 8, color: '#cfe8f0', size: 1, g: 0, kind: 'ring' });
    spawnParts(10, cx, cy, { color: ['#ffffff', '#cfe8f0', '#9ecbd8'], speed: [.6, 2], life: [10, 20], g: .05 });
    Game.word(L.pearls === L.pearlsTotal ? '¡TODAS!' : '¡PLOP!', cx, e.y - 6, '#e8fbff', L.pearls === L.pearlsTotal);
  },
  pearlDraw(e, g) { const bob = e.resting ? 0 : Math.round(Math.sin(e.t / 18) * 2); g.drawImage(ART.cria[(e.t >> 4) % 3], Math.round(e.x - Cam.x), Math.round(e.y - Cam.y + bob)); },
  heart(x, y, id) { return { kind: 'heart', x, y, w: 9, h: 8, id, t: 0, update(e) { e.t++; if (overlap(e, Player.rect()) && !Player.dead) { e.dead = true; L.taken.add(e.id); Player.hp = Math.min(3, Player.hp + 1); Sound.play('heart'); spawnParts(12, e.x + 4, e.y + 4, { color: ['#e2445a', '#ffb0bd', '#ffffff'], speed: [.5, 2.2], life: [14, 28], g: -.02 }); } }, draw(e, g) { g.drawImage(ART.heart, Math.round(e.x - Cam.x), Math.round(e.y - Cam.y + Math.sin(e.t / 15) * 2)); } }; },
  lantern(x, y, id) { return { kind: 'lantern', x, y, w: 10, h: 18, id, t: 0, update(e) { e.t++; if (!L.lit.has(e.id) && overlap({ x: e.x - 4, y: e.y, w: 18, h: 18 }, Player.rect()) && !Player.dead) { L.lit.add(e.id); L.checkpoint = { x: e.x - 1, y: e.y }; Sound.play('lantern'); spawnParts(16, e.x + 5, e.y + 5, { color: ['#ffcf5a', '#fff2b8', '#ffffff'], speed: [.3, 1.8], life: [20, 40], g: -.03 }); Game.toast('Farol encendido', 90); Game.word('¡FAROL!', e.x + 5, e.y - 8, '#ffcf5a', true); Cam.punch(1.03); } if (L.lit.has(e.id) && e.t % 5 === 0) spawnParts(1, e.x + 5, e.y + 5, { color: ['#ffcf5a', '#fff2b8'], speed: [.1, .5], life: [16, 30], g: -.02 }); },
    draw(e, g) { const lit = L.lit.has(e.id); if (lit) { g.globalAlpha = .18 + Math.sin(e.t / 9) * .04; g.fillStyle = '#ffcf5a'; const r = 18; g.beginPath(); g.arc(Math.round(e.x - Cam.x) + 5, Math.round(e.y - Cam.y) + 5, r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; } g.drawImage(lit ? ART.lantern.on : ART.lantern.off, Math.round(e.x - Cam.x), Math.round(e.y - Cam.y)); } }; },
  // Ruca, the old turtle: she talks when Nila asks (↑), in a real conversation that holds the world still.
  // The first time Nila meets her at the start of a level, she speaks up by herself (once).
  ruca(x, y, idx) { return { kind: 'ruca', x, y, w: 20, h: 11, idx, t: Math.random() * 100, near: false, update(e) {
      e.t++; e.dir = Player.x + 5 < e.x + 10 ? -1 : 1;
      const p = Player; e.near = !p.dead && !p.win && Math.abs(e.x + 10 - (p.x + 5)) < 30 && Math.abs(e.y - p.y) < 30;
      if (!e.near || Charla.active() || Game.learning || Maestros.busy() || Game.arrival) return;
      const seen = Save.data.seen || {}, key = 'ruca:' + L.def.id + ':' + e.idx, first = !seen[key] && !seen.rucaTodas && e.idx === 0;
      const teacherNear = L.maestro && L.maestro.near;
      if (first || (Input.pressed.up && p.onGround && !teacherNear && !p.sucking && !p.grapple)) {
        Save.data.seen = Object.assign(seen, { [key]: true }); Save.write();
        p.vx = 0; p.sucking = false; Sound.suck(false);
        Charla.start({ quien: 'ruca', ent: e, lines: [Game.noteRaw(e)] });
      }
    }, draw(e, g) { Item.rucaDraw(e, g); } }; },
  rucaDraw(e, g) {
    const s = e.talking && (e.t >> 2) % 2 ? ART.ruca.talk : (e.t % 200) < 8 ? ART.ruca.blink : ART.ruca.idle;
    const img = e.dir > 0 ? s : ART.flip(s); g.drawImage(img, Math.round(e.x - Cam.x + (e.w - s.width) / 2), Math.round(e.y - Cam.y + e.h - s.height));
    const heard = (Save.data.seen || {})['ruca:' + L.def.id + ':' + e.idx];
    if (e.near && !Charla.active() && !Game.learning) {
      // "↑ hablar" over her head, like the teachers.
      const cap = Input.mode === 'touch' ? '▲' : '↑', label = 'hablar', cw = ART.textWidth(cap) + 6, w = cw + ART.textWidth(label) + 8;
      const cx = Math.round(e.x - Cam.x + 10), y = Math.round(e.y - Cam.y) - 26 + ((e.t >> 4) % 2), x = clamp(cx - Math.round(w / 2), 2, W - w - 2);
      g.fillStyle = '#120c18'; g.fillRect(x - 1, y - 1, w + 2, 13); g.fillStyle = 'rgba(27,36,48,.95)'; g.fillRect(x, y, w, 11); g.fillStyle = '#8aa84a'; g.fillRect(x, y, w, 1);
      g.fillStyle = '#e8e0cc'; g.fillRect(x + 2, y + 2, cw, 8); g.fillStyle = '#a89a80'; g.fillRect(x + 2, y + 9, cw, 1);
      ART.text(g, cap, x + 2 + cw / 2, y + 2, '#1b2430', 'center'); Letra.text(g, label, x + cw + 5, y + 1, { color: '#fff6d6', shadow: '#120c18' });
    } else if (!heard && (e.t >> 5) % 2) g.drawImage(ART.bubble, Math.round(e.x - Cam.x) + 14, Math.round(e.y - Cam.y) - 14 + Math.round(Math.sin(e.t / 8)));
  },
  sign(x, y, idx) { return { kind: 'sign', x, y, w: 14, h: 12, idx, update() { }, draw(e, g) { g.drawImage(ART.sign, Math.round(e.x - Cam.x), Math.round(e.y - Cam.y)); } }; },
  // Where a cría was already rescued on an earlier visit: the ghost of its bubble, so the spot is remembered.
  ghostPearl(x, y) { return { kind: 'ghostPearl', x, y, w: 9, h: 9, t: Math.random() * 100, update(e) { e.t++; }, draw(e, g) { g.globalAlpha = .22 + Math.sin(e.t / 30) * .06; g.drawImage(ART.tint(ART.cria[0], '#cfe8f0'), Math.round(e.x - Cam.x), Math.round(e.y - Cam.y + Math.sin(e.t / 18) * 2)); g.globalAlpha = 1; } }; },
  // A fishing hook hanging on its line from the ledge above, with a float and a worm for bait.
  anchor(x, y) {
    let top = y - 60, tied = false; const tx = (x + 5) >> 4; for (let k = 1; k <= 8; k++) { const ty = ((y + 5) >> 4) - k; if (solidChar(tileAt(tx, ty)) || tileAt(tx, ty) === '=') { top = (ty + 1) * TS; tied = true; break; } }
    return { kind: 'anchor', x, y, w: 10, h: 10, t: Math.random() * 100, top, tied, bait: true, bite: 0, update(e) { e.t++; if (e.bite > 0) e.bite--; if (Player.grapple === e && e.bait) { e.bait = false; e.bite = 30; } }, draw(e, g) { Item.hookDraw(g, e); } }; },
  hookDraw(g, e) {
    const cx = Math.round(e.x + 5 - Cam.x), top = Math.round(e.top - Cam.y), held = Player.grapple === e;
    const sway = held ? 0 : Math.sin(e.t / 40) * 1.6, hx = Math.round(cx + sway), hy = Math.round(e.y + 1 - Cam.y + Math.sin(e.t / 25) * .8);
    // Where the line is tied: a knot round a twig under the ledge (or it runs off the top of the screen).
    if (e.tied) { g.fillStyle = '#1a1420'; g.fillRect(cx - 4, top, 9, 3); g.fillStyle = '#6b4a30'; g.fillRect(cx - 3, top, 7, 2); g.fillStyle = '#8a6a4a'; g.fillRect(cx - 3, top, 7, 1); g.fillStyle = '#5e8a2e'; g.fillRect(cx + 3, top + 2, 2, 1); }
    if (held) return;   // the hook is in Bigotes' mouth; the fish draws it and the taut line.
    // The line, a slight curve, and the float on it (it ducks under when something bites).
    g.fillStyle = '#d8e0e8'; const fy = hy - 20; for (let y = top + 2; y < hy - 11; y++) { const k = (y - top) / Math.max(1, hy - top); g.fillRect(Math.round(cx + sway * k), y, 1, 1); }
    const fx = Math.round(cx + sway * (fy - top) / Math.max(1, hy - top)); g.fillStyle = '#1a1420'; g.fillRect(fx - 3, fy - 4, 7, 10); g.fillStyle = '#e8403a'; g.fillRect(fx - 2, fy - 3, 5, 4); g.fillStyle = '#ffffff'; g.fillRect(fx - 2, fy + 1, 5, 4); g.fillStyle = '#ff9a8a'; g.fillRect(fx - 2, fy - 3, 2, 1); g.fillStyle = '#c8c0b0'; g.fillRect(fx + 1, fy + 3, 1, 2); g.fillStyle = '#1a1420'; g.fillRect(fx, fy - 7, 1, 3); g.fillStyle = '#d8e0e8'; g.fillRect(fx, fy + 6, 1, hy - 5 - (fy + 6));
    // A soft halo and a glint every so often, so the hook reads even in the dark.
    g.globalAlpha = .18 + Math.sin(e.t / 12) * .06; g.fillStyle = Game.has('mordisco') ? '#fff3b8' : '#cfe0e8'; g.beginPath(); g.arc(hx + 3, hy + 4, 11, 0, 7); g.fill(); g.globalAlpha = 1;
    Item.hookShape(g, hx, hy, e.bait, e.t);
    if ((e.t % 90) < 8) { const k = e.t % 90, r = k < 4 ? k : 8 - k; g.fillStyle = '#ffffff'; g.fillRect(hx + 9 - r, hy + 2, r * 2 + 1, 1); g.fillRect(hx + 9, hy + 2 - r, 1, r * 2 + 1); }
  },
  // The hook itself: an eye, a shank, the bend and a barbed point, in steel with a highlight; a worm curls on the bend.
  hookShape(g, hx, hy, bait, t, flip = 1, s = 2) {
    const P = (x, y, c) => { g.fillStyle = c; g.fillRect(hx + (flip > 0 ? x * s : -x * s - s + 1), hy + y * s, s, s); };
    const O = '#1a1420', S = '#b8c4d0', Sh = '#6a7480', Hi = '#ffffff';
    for (const [x, y] of [[-1, -5], [1, -5], [-1, -4], [1, -4], [0, -6], [0, -3]]) P(x, y, O);  // eye outline
    P(0, -5, '#2a3040'); P(0, -4, '#2a3040');
    for (let y = -2; y <= 3; y++) { P(-1, y, O); P(1, y, O); P(0, y, y < 0 ? Hi : S); }  // shank
    for (const [x, y, c] of [[0, 4, S], [1, 5, S], [2, 5, Sh], [3, 4, S], [4, 3, S], [4, 2, Hi], [5, 1, S]]) P(x, y, c);  // bend and point
    for (const [x, y] of [[-1, 4], [0, 5], [0, 6], [1, 6], [2, 6], [3, 6], [4, 5], [5, 4], [5, 3], [5, 2], [6, 1], [6, 0], [4, 1], [4, 0], [3, 3]]) P(x, y, O);
    P(5, 0, S); P(3, 2, Sh);  // barb
    if (bait) { const w = Math.round(Math.sin(t / 5) * 1); for (const [x, y, c] of [[1, 3, '#e88a9a'], [2, 4, '#e88a9a'], [2, 3, '#b85a6a'], [-1 + w, 6, '#e88a9a'], [-2 + w, 7, '#b85a6a'], [-2 + w * 2, 8, '#e88a9a'], [3, 3, '#e88a9a']]) P(x, y, c); }
  },
  plate(x, y, idx) { return { kind: 'plate', x, y, w: 16, h: 5, idx, pressed: false, t: 0, update(e) {
      e.t++; let on = false; const top = { x: e.x + 1, y: e.y, w: 14, h: 7 };
      if (!Player.dead && overlap(top, { x: Player.x, y: Player.y + Player.h - 2, w: Player.w, h: 3 })) on = true;
      for (const o of L.ents) if (!o.dead && (o.kind === 'crate' || o.kind === 'rock') && o.resting && overlap(top, { x: o.x, y: o.y + o.h - 2, w: o.w, h: 3 })) on = true;
      if (on !== e.pressed) { e.pressed = on; Sound.play(on ? 'switch' : 'thud'); if (on) { Game.word('CLIC', e.x + 8, e.y - 6, '#d8f0b8', false); spawnParts(6, e.x + 8, e.y, { color: ['#a6abb8', '#d0d6da'], speed: [.3, 1.2], life: [8, 16], g: .05 }); } Game.setGate(e.idx, L.ents.some(o => o.kind === 'plate' && o.idx === e.idx && o.pressed)); }
    }, draw(e, g) { g.drawImage(e.pressed ? ART.plate.on : ART.plate.off, Math.round(e.x - Cam.x), Math.round(e.y - Cam.y)); } }; },
  pinwheel(x, y, idx) { return { kind: 'pinwheel', x, y, w: 16, h: 16, idx, spin: 0, t: 0, open: false, ang: 0, vel: 0, update(e) {
      e.t++; if (e.spin > 0) e.spin--; const open = e.spin > 0; if (open !== e.open) { e.open = open; Game.setGate(e.idx, open); if (!open) Game.word('...', e.x + 8, e.y - 4, '#9fc0cc', false); }
      // Spinning fast while blown, slowing down over the last second; idle it rocks in the breeze.
      const target = e.spin > 60 ? .42 : e.spin > 0 ? .42 * e.spin / 60 : Math.sin(e.t / 50) * .012;
      e.vel += (target - e.vel) * .08; e.ang += e.vel;
      if (e.spin > 0 && e.t % 4 === 0) spawnParts(1, e.x + 8 + rnd(-7, 7), e.y + 2 + rnd(-7, 7), { color: ['#e8f0c8', '#cfe0e8'], speed: [.2, .6], life: [6, 12], g: 0 });
    }, blow(e, dir) { const fresh = e.spin === 0; e.spin = 300; e.vel += .2; Sound.play('switch'); Game.word(fresh ? '¡GIRA!' : '¡MÁS!', e.x + 8, e.y - 10, '#e8f0c8', true); spawnParts(10, e.x + 8, e.y + 2, { color: ['#d95a4a', '#f2c53d', '#4a8ad0', '#5fae5a'], speed: [.5, 2], life: [10, 20], g: .02 }); },
    draw(e, g) { Item.pinwheelDraw(g, Math.round(e.x - Cam.x) + 8, Math.round(e.y - Cam.y) + 2, e.ang, Math.abs(e.vel), e.spin > 0 && e.spin < 60 && (e.t >> 2) % 2); } }; },
  // A paper pinwheel: four folded blades (lit face, crease, shaded face) on a brass pin, a wooden stick with a bow.
  pinwheelDraw(g, cx, cy, ang, speed, flash) {
    const O = '#1a1420';
    // Stick with grain, bow of twine and a little mound of earth.
    g.fillStyle = O; g.fillRect(cx - 2, cy, 4, 16); g.fillStyle = '#8a5a34'; g.fillRect(cx - 1, cy, 2, 15); g.fillStyle = '#c08a50'; g.fillRect(cx - 1, cy, 1, 15);
    g.fillStyle = '#d8c090'; g.fillRect(cx - 3, cy + 7, 6, 1); g.fillRect(cx - 4, cy + 8, 2, 2); g.fillRect(cx + 2, cy + 8, 2, 2);
    g.fillStyle = O; g.fillRect(cx - 5, cy + 14, 10, 3); g.fillStyle = '#4a3226'; g.fillRect(cx - 4, cy + 14, 8, 2); g.fillStyle = '#7fb040'; g.fillRect(cx - 5, cy + 13, 2, 1); g.fillRect(cx + 3, cy + 13, 2, 1);
    const COLS = [['#f06a5a', '#c8403a', '#8a2a2a'], ['#ffd860', '#e0a830', '#9a6a20'], ['#6aa8f0', '#3a70c0', '#264a8a'], ['#80d070', '#4a9a4a', '#2e6a36']];
    const blades = (a0, alpha) => {
      g.globalAlpha = alpha;
      for (let i = 0; i < 4; i++) {
        const a = a0 + i * Math.PI / 2, c = COLS[i], R = 9;
        // Each blade: a triangle from the centre to the tip and back along the fold.
        const pt = (an, r) => ({ x: cx + Math.cos(an) * r, y: cy + Math.sin(an) * r });
        const tip = pt(a, R), mid = pt(a + .42, R * .82), side = pt(a + .98, R * .62);
        const tri = (p1, p2, p3, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y); g.closePath(); g.fill(); };
        // A 1-px dark rim around each face, then the lit face and the shaded face of the fold.
        const grow = q => ({ x: cx + (q.x - cx) * 1.14, y: cy + (q.y - cy) * 1.14 });
        tri({ x: cx, y: cy }, grow(tip), grow(mid), O); tri({ x: cx, y: cy }, grow(mid), grow(side), O);
        tri({ x: cx, y: cy }, tip, mid, c[0]); tri({ x: cx, y: cy }, mid, side, c[1]);
        g.fillStyle = c[2]; g.beginPath(); g.moveTo(cx, cy); g.lineTo(mid.x, mid.y); g.lineTo(cx + (mid.x - cx) * .9 + (side.x - mid.x) * .15, cy + (mid.y - cy) * .9 + (side.y - mid.y) * .15); g.fill();
        g.fillStyle = c[2]; g.fillRect(Math.round(side.x), Math.round(side.y), 1, 1); g.fillStyle = '#ffffff'; g.fillRect(Math.round(cx + Math.cos(a + .2) * 5), Math.round(cy + Math.sin(a + .2) * 5), 1, 1);
      }
      g.globalAlpha = 1;
    };
    // Motion blur: fainter copies trailing behind when it spins fast.
    if (speed > .15) { blades(ang - speed * 1.4, .25); blades(ang - speed * .7, .45); }
    blades(ang, 1);
    if (flash) { g.globalAlpha = .5; g.fillStyle = '#fff6d6'; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill(); g.globalAlpha = 1; }
    g.fillStyle = O; g.fillRect(cx - 2, cy - 2, 4, 4); g.fillStyle = '#e2b63c'; g.fillRect(cx - 1, cy - 1, 2, 2); g.fillStyle = '#fff3b0'; g.fillRect(cx - 1, cy - 1, 1, 1);
  },
  raft(x, y) { const r = { kind: 'raft', x, y, w: 24, h: 6, vx: 0, t: 0, platform: true, resting: true, solid: false, update(e) {
      e.t++; e.vx *= .975; if (Math.abs(e.vx) < .02) e.vx = 0;
      if (e.vx) { const ox = e.x; if (moveX(e, e.vx)) e.vx = 0; const ahead = e.vx > 0 ? e.x + e.w + 2 : e.x - 2; if (!waterAt(ahead, e.y + 10)) { e.x = ox; e.vx = -e.vx * .3; } }
      const ty = Math.floor((e.y + 10) / TS); e.y = ty * TS - 4 + Math.round(Math.sin(e.t / 20) * 1);
      if (Math.abs(e.vx) > .4 && e.t % 4 === 0) spawnParts(1, e.vx > 0 ? e.x : e.x + e.w, e.y + 6, { color: ['#8fd9d0', '#c8f2ea'], speed: [.2, .8], life: [8, 14], g: .02 });
    }, draw(e, g) { g.drawImage(ART.raft, Math.round(e.x - Cam.x), Math.round(e.y - Cam.y)); } }; L.solids.push(r); return r; },
  boat(x, y) { const b = { kind: 'boat', x, y, w: 32, h: 6, t: 0, platform: true, resting: true, solid: false, update(e) { e.t++; if (!Player.win && !Player.dead && overlap({ x: e.x + 4, y: e.y - 12, w: 24, h: 18 }, Player.rect())) Game.levelClear(e); }, draw(e, g) { const bob = Math.round(Math.sin(e.t / 22) * 1.5); g.drawImage(ART.boat, Math.round(e.x - Cam.x), Math.round(e.y - Cam.y - 7 + bob)); if (e.t % 6 === 0) spawnParts(1, e.x + 14, e.y - 3 + bob, { color: ['#ffcf5a', '#fff2b8'], speed: [.1, .4], life: [10, 20], g: -.02 }); } }; L.solids.push(b); L.exit = b; return b; }
};

// ---------------------------------------------------------------- Enemigos
const Enemy = {
  base(kind, x, y, w, h) { return { kind, x, y, w, h, vx: 0, vy: 0, dir: -1, t: (Math.random() * 100) | 0, suckable: true, enemy: true, sucked: 0, stun: 0, tug: 0, tugDir: 0, onGround: false }; },
  snail(x, y) { const e = Enemy.base('snail', x, y, 14, 10); e.speed = .28; e.update = Enemy.walker; e.draw = Enemy.walkerDraw; e.frames = ART.snail; e.spriteFor = () => ART.snail[0]; e.faceRight = false; return e; },
  crab(x, y) { const e = Enemy.base('crab', x, y, 16, 10); e.speed = .45; e.armored = true; e.flipped = false; e.flipT = 0; e.update = Enemy.crabUpdate; e.draw = Enemy.crabDraw; e.frames = ART.crab; e.spriteFor = () => ART.crab[0]; return e; },
  frog(x, y) { const e = Enemy.base('frog', x, y, 12, 10); e.state = 'sit'; e.wait = 40 + Math.random() * 40; e.update = Enemy.frogUpdate; e.draw = Enemy.frogDraw; e.spriteFor = () => ART.frogSit; return e; },
  mosquito(x, y) { const e = Enemy.base('mosquito', x, y, 10, 8); e.flying = true; e.baseY = y; e.ox = x; e.vx = .6; e.dir = 1; e.update = Enemy.mosquitoUpdate; e.draw = Enemy.mosquitoDraw; e.spriteFor = () => ART.mosquito[0]; return e; },
  common(e) {
    if (e.stun > 0) e.stun--; if (e.tug > 0) e.tug--;
    if (e.sucked > 0) { e.sucked--; e.x += e.vx; e.y += e.vy; if (rectSolid(e.x, e.y, e.w, e.h, e)) { e.x -= e.vx; e.y -= e.vy; } e.stretch = true; return true; }
    e.stretch = false;
    if (waterAt(e.x + e.w / 2, e.y + e.h - 1) && !e.flying) { e.dead = true; Sound.play('splash'); spawnParts(8, e.x + e.w / 2, e.y + e.h, { color: ['#8fd9d0', '#c8f2ea'], angle: -Math.PI / 2, spread: 1, speed: [1, 2.5], life: [12, 22] }); return true; }
    if (e.y > L.h * TS + 40) { e.dead = true; return true; }
    return false;
  },
  touch(e) {
    if (Player.dead || Player.win || e.stun > 0 || e.flipped || !overlap(e, Player.rect())) return;
    if (Player.slide > 0) { Enemy.bowl(e); return; }
    // A belly flop landing on a bug flattens it (stunned, crabs turned over) instead of hurting Nila.
    if (Player.pound && Player.poundT === 0 && Player.y + Player.h < e.y + e.h / 2 + 4) { Enemy.squash(e); return; }
    if (Player.inv === 0) Player.hurt(Player.x + 5 < e.x + e.w / 2 ? 1 : -1);
  },
  // Nila sliding on Bigotes' slick belly knocks bugs flying and turns crabs over.
  bowl(e) {
    const d = Player.dir; if (!Enemy.flip(e)) { e.stun = 60; e.vy = -3; e.vx = d * 2.2; if (e.kind === 'frog') e.state = 'sit'; }
    Sound.play('pop'); Cam.shake(2, 6); Game.stop(2); Input.rumble(80, .5, .3); Game.word('¡PUM!', e.x + e.w / 2, e.y - 6, '#f2c46a', true);
    spawnParts(8, e.x + e.w / 2, e.y + e.h / 2, { color: ['#ffffff', '#f2c46a', '#c9b08a'], speed: [.8, 2.4], life: [10, 20], g: .08 });
  },
  squash(e) {
    if (!Enemy.flip(e)) { e.stun = 60; e.vy = -2; e.vx = Math.sign(e.x + e.w / 2 - Player.x - 5) * 1.5; if (e.kind === 'frog') e.state = 'sit'; }
    Sound.play('pop'); Game.stop(2); Game.word('¡PLAF!', e.x + e.w / 2, e.y - 6, '#f2c46a', true);
    spawnParts(8, e.x + e.w / 2, e.y, { color: ['#ffffff', '#f2c46a', '#c9b08a'], speed: [.8, 2.4], life: [10, 20], g: .08 });
  },
  walker(e) {
    e.t++; if (Enemy.common(e)) return;
    e.vy = Math.min(e.vy + .3, 5); const hit = moveY(e, e.vy); e.onGround = false; if (hit) { e.vy = 0; e.onGround = true; }
    if (e.stun === 0 && e.onGround) {
      const ahead = e.x + (e.dir > 0 ? e.w + 1 : -1);
      const edge = !rectSolid(ahead, e.y + e.h + 1, 1, 1) && !oneWayBelow(ahead, 1, e.y + e.h, e.y + e.h + 2);
      if (edge || moveX(e, e.dir * e.speed)) e.dir = -e.dir;
    }
    Enemy.touch(e);
  },
  walkerDraw(e, g) {
    let s = e.frames[(e.t >> 4) % e.frames.length]; const faceRight = e.faceRight ? e.dir > 0 : e.dir < 0; if (!faceRight) s = ART.flip(s);
    Enemy.drawSprite(e, g, s);
  },
  drawSprite(e, g, s, extraY = 0) {
    const x = Math.round(e.x - Cam.x + (e.w - s.width) / 2), y = Math.round(e.y - Cam.y + e.h - s.height + extraY);
    if (e.stretch) { const m = Player.mouth(); const dx = m.x - (e.x + e.w / 2), dy = m.y - (e.y + e.h / 2); const horiz = Math.abs(dx) > Math.abs(dy); g.save(); g.translate(x + s.width / 2, y + s.height / 2); g.scale(horiz ? 1.3 : .85, horiz ? .85 : 1.3); g.translate(-(x + s.width / 2), -(y + s.height / 2)); g.drawImage(s, x, y); g.restore(); return; }
    if (e.tug > 0) { g.drawImage(s, x + (e.t % 2 ? 1 : -1), y); return; }
    if (e.stun > 0 && (e.t >> 1) % 2) g.drawImage(ART.tint(s, '#ffffff'), x, y); else g.drawImage(s, x, y);
    if (e.stun > 12) for (let i = 0; i < 2; i++) g.drawImage(ART.star, x + 2 + i * 7 + Math.round(Math.sin(e.t / 4 + i * 2) * 3), y - 5 + Math.round(Math.cos(e.t / 4 + i * 2) * 2));
  },
  crabUpdate(e) {
    e.t++; if (Enemy.common(e)) return;
    e.vy = Math.min(e.vy + .3, 5); const hit = moveY(e, e.vy); e.onGround = false; if (hit) { e.vy = 0; e.onGround = true; }
    if (e.flipped) { e.flipT--; if (e.flipT <= 0) { e.flipped = false; e.stun = 10; } e.suckable = true; }
    else { e.suckable = true; if (e.onGround && e.stun === 0 && e.tug === 0) { const ahead = e.x + (e.dir > 0 ? e.w + 1 : -1); const edge = !rectSolid(ahead, e.y + e.h + 1, 1, 1) && !oneWayBelow(ahead, 1, e.y + e.h, e.y + e.h + 2); if (edge || moveX(e, e.dir * e.speed)) e.dir = -e.dir; } }
    Enemy.touch(e);
  },
  crabDraw(e, g) {
    const s = e.frames[e.flipped ? 0 : (e.t >> 3) % 2];
    if (e.flipped) { const x = Math.round(e.x - Cam.x + (e.w - s.width) / 2), y = Math.round(e.y - Cam.y + e.h - s.height); g.save(); g.translate(x + s.width / 2, y + s.height / 2); g.scale(1, -1); g.rotate(Math.sin(e.t / 5) * .08); g.translate(-(x + s.width / 2), -(y + s.height / 2)); if (e.flipT < 60 && (e.t >> 2) % 2) g.drawImage(ART.tint(s, '#ffffff'), x, y); else g.drawImage(s, x, y); g.restore(); if (e.t % 8 < 4) g.drawImage(ART.star, x + 4 + ((e.t >> 3) % 3) * 4, y - 6); return; }
    Enemy.drawSprite(e, g, s);
  },
  flip(e) { if (!e.armored || e.flipped) return false; e.flipped = true; e.flipT = 300; e.vy = -3; e.vx = 0; Sound.play('stun'); return true; },
  frogUpdate(e) {
    e.t++; if (Enemy.common(e)) return;
    e.vy = Math.min(e.vy + .3, 5); if (Math.abs(e.vx) > .01 && moveX(e, e.vx)) e.vx = 0;
    const hit = moveY(e, e.vy); e.onGround = false; if (hit) { if (e.vy > 0 && e.state === 'jump') { e.state = 'sit'; e.wait = 50 + Math.random() * 50; spawnParts(3, e.x + 6, e.y + e.h, { color: '#c9b08a', angle: -Math.PI / 2, spread: 1.4, speed: [.3, 1], life: [8, 14], g: .04 }); } e.vy = 0; e.vx = 0; e.onGround = true; }
    if (e.state === 'sit' && e.onGround && e.stun === 0) {
      const dx = Player.x + 5 - (e.x + 6); if (Math.abs(dx) < 110 && Math.abs(Player.y - e.y) < 60) {
        e.dir = dx > 0 ? 1 : -1; e.wait--;
        // Telegraph: a croak and a trembling crouch before every leap, so the jump is never a surprise.
        if (e.wait <= 16 && e.wait > 0) { e.tug = 2; if (!e.warned) { e.warned = true; Sound.play('croak'); spawnParts(2, e.x + 6, e.y + e.h, { color: '#c9b08a', angle: -Math.PI / 2, spread: 1.4, speed: [.2, .6], life: [6, 10], g: .04 }); } }
        if (e.wait <= 0) { e.state = 'jump'; e.warned = false; e.vx = e.dir * 1.5; e.vy = -4.6; e.onGround = false; Sound.play('frog'); }
      }
    }
    Enemy.touch(e);
  },
  frogDraw(e, g) { let s = e.state === 'jump' ? ART.frogJump : ART.frogSit; if (e.dir < 0) s = ART.flip(s); Enemy.drawSprite(e, g, s); },
  mosquitoUpdate(e) {
    e.t++; if (Enemy.common(e)) return;
    if (e.stun > 0) { e.vy = Math.min(e.vy + .3, 5); moveY(e, e.vy); Enemy.touch(e); return; }
    if (e.baseY === undefined) e.baseY = e.y;
    const range = 70; if (Math.abs(e.x - e.ox) > range) e.dir = e.x > e.ox ? -1 : 1;
    if (moveX(e, e.dir * .7)) e.dir = -e.dir;
    e.y = e.baseY + Math.sin(e.t / 14) * 8;
    if (e.t % 90 === 0 && Math.abs(Player.x - e.x) < 120) Sound.play('buzz');
    Enemy.touch(e);
  },
  mosquitoDraw(e, g) { let s = ART.mosquito[(e.t >> 2) % 2]; if (e.dir < 0) s = ART.flip(s); Enemy.drawSprite(e, g, s); },
  kill(e, why) {
    if (e.dead) return; e.dead = true;
    const pal = { snail: ['#c8783c', '#8fbf5a', '#e9a862'], frog: ['#6cbf4e', '#a6e07a', '#e8f0c8'], mosquito: ['#8a8aa8', '#d6e2ee'], crab: ['#d9503a', '#f28b6a'] }[e.kind] || ['#ffffff'];
    spawnParts(12, e.x + e.w / 2, e.y + e.h / 2, { color: pal, speed: [.8, 3], life: [16, 30], g: .15, bounce: .4 });
    L.parts.push({ x: e.x + e.w / 2 - 3, y: e.y + e.h / 2 - 3, vx: 0, vy: -.2, life: 12, color: '#fff', size: 1, g: 0, kind: 'puff' });
    if (e.spriteFor) { let s = e.spriteFor(); if (e.dir > 0 !== !!e.faceRight && e.kind !== 'mosquito' && e.kind !== 'frog') s = ART.flip(s); L.ghosts.push({ sprite: s, x: e.x + e.w / 2 - s.width / 2, y: e.y + e.h - s.height, life: 5, grow: .08 }); }
    L.parts.push({ x: e.x + e.w / 2 - 6, y: e.y + e.h / 2 - 6, vx: 0, vy: 0, life: 7, color: '#fff', size: 1, g: 0, kind: 'ring' });
    Sound.play('pop'); if (why === 'proj') Game.stop(3);
  }
};

// ---------------------------------------------------------------- Proyectiles
// ---------------------------------------------------------------- Agua
// Water drawn as water: a thick column with a dark rim, a translucent body, a bright core and
// highlights that run along it; a stretched head with froth; spray, mist and a crown on impact.
const Water = {
  C: { rim: '#123a44', body: '#2a8a90', inner: '#5cc4bc', light: '#bdf0e4', shine: '#f2fffb', foam: '#ffffff' },
  disc(g, x, y, r, col) { g.fillStyle = col; if (r < .8) { g.fillRect(Math.round(x), Math.round(y), 1, 1); return; } const R = Math.round(r); for (let dy = -R; dy <= R; dy++) { const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy))); g.fillRect(Math.round(x) - hw, Math.round(y) + dy, hw * 2 + 1, 1); } },
  // Samples a polyline (screen coords, head first) every pixel with the normal and the 0..1 position.
  sample(pts) {
    const S = []; let total = 0; for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (total < 1) return S; let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], len = Math.hypot(b.x - a.x, b.y - a.y); if (len < .01) continue;
      const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
      for (let d = 0; d < len; d += 1) S.push({ x: a.x + (b.x - a.x) * d / len, y: a.y + (b.y - a.y) * d / len, u: (acc + d) / total, nx: ny < 0 ? nx : -nx, ny: ny < 0 ? ny : -ny, s: acc + d });
      acc += len;
    }
    return S;
  },
  // A tapered ribbon: w0 at the head, w1 at the tail. flow moves the highlights (positive: toward the head).
  ribbon(g, pts, t, o = {}) {
    const S = Water.sample(pts); if (!S.length) return; const C = Water.C, w0 = o.w0 || 6, w1 = o.w1 !== undefined ? o.w1 : 3, flow = o.flow !== undefined ? o.flow : 1;
    const rad = q => Math.max(.6, (w0 + (w1 - w0) * q.u) / 2 + Math.sin(t * .5 + q.s * .4) * .45 * (o.wobble !== undefined ? o.wobble : 1));
    const off = q => Math.sin(t * .35 + q.s * .23) * (.6 + q.u) * (o.wobble !== undefined ? o.wobble : 1);
    if (o.alpha !== undefined) g.globalAlpha = o.alpha;
    for (const q of S) Water.disc(g, q.x + q.nx * off(q), q.y + q.ny * off(q), rad(q) + 1, C.rim);
    for (const q of S) Water.disc(g, q.x + q.nx * off(q), q.y + q.ny * off(q), rad(q), C.body);
    for (const q of S) { const r = rad(q) - 1; if (r > .4) Water.disc(g, q.x + q.nx * (off(q) + .6), q.y + q.ny * (off(q) + .6), r, C.inner); }
    // Running highlights on the lit side, and a foam core when charged.
    for (const q of S) {
      const r = rad(q), o2 = off(q), ph = ((q.s - t * 3 * flow) % 11 + 11) % 11;
      if (ph < 5 && r > 1.4) { g.fillStyle = ph < 2 ? C.shine : C.light; g.fillRect(Math.round(q.x + q.nx * (o2 + r * .55)), Math.round(q.y + q.ny * (o2 + r * .55)), 1, 1); }
      if (o.foam && r > 2.2 && ((q.s + t * 2) % 5) < 3) { g.fillStyle = C.foam; g.fillRect(Math.round(q.x + q.nx * o2), Math.round(q.y + q.ny * o2), 1, 1); }
    }
    g.globalAlpha = 1;
  },
  // The leading blob: stretched along its speed, with a highlight and a fringe of froth ahead.
  head(g, x, y, vx, vy, r, t, foam) {
    const C = Water.C, sp = Math.hypot(vx, vy) || 1, ax = vx / sp, ay = vy / sp, a = r * (1 + Math.min(.8, sp * .08)), b = r * (1 - Math.min(.25, sp * .03));
    const blob = (grow, col, dx = 0, dy = 0) => { g.fillStyle = col; const A = a + grow, B = b + grow, R = Math.ceil(A) + 1; for (let py = -R; py <= R; py++) for (let px = -R; px <= R; px++) { const u = (px * ax + py * ay) / A, v = (-px * ay + py * ax) / B; if (u * u + v * v <= 1) g.fillRect(Math.round(x + px + dx), Math.round(y + py + dy), 1, 1); } };
    blob(1, C.rim); blob(0, C.body); blob(-1, C.inner, -ax * .5, -.5); if (r > 2) blob(-r * .55, C.light, ax * .6 - .8, -1.2);
    g.fillStyle = C.shine; g.fillRect(Math.round(x + ax * r * .3 - 1), Math.round(y - b * .5), 2, 1);
    g.fillStyle = foam ? C.foam : C.light; for (let i = 0; i < (foam ? 6 : 3); i++) { const k = (t * 7 + i * 41) % 13, s = i % 2 ? 1 : -1; g.fillRect(Math.round(x + ax * (a + 1 + (k % 3)) - ay * s * (k % 4)), Math.round(y + ay * (a + 1 + (k % 3)) + ax * s * (k % 4)), 1, 1); }
  },
  // A volley: the drops of one spit, drawn as one column that is still tied to Bigotes' mouth while it pours.
  drawVolley(g, v) {
    const alive = v.projs.filter(q => !q.dead && q.delay <= 0), pouring = v.projs.some(q => !q.dead && q.delay > 0) || (alive.length && alive[alive.length - 1].t < 3);
    if (!alive.length) return;
    const pt = q => ({ x: q.x - Cam.x + 4, y: q.y - Cam.y + 4, q });
    const chains = []; let cur = [pt(alive[0])];
    for (let i = 1; i < alive.length; i++) { const a = cur[cur.length - 1], b = pt(alive[i]); if (Math.hypot(b.x - a.x, b.y - a.y) > 22) { chains.push(cur); cur = [b]; } else cur.push(b); }
    chains.push(cur);
    if (pouring && !Player.dead) { const m = Player.mouth(), last = chains[chains.length - 1], e = last[last.length - 1], mp = { x: m.x - Cam.x, y: m.y - Cam.y }; if (Math.hypot(mp.x - e.x, mp.y - e.y) < 40) last.push(mp); }
    const big = v.charged ? 1.6 : 1, t = Game.t;
    chains.forEach((c, ci) => {
      const lead = c[0].q === v.projs.find(q => !q.dead && q.delay <= 0), tied = pouring && ci === chains.length - 1;
      if (c.length > 1) Water.ribbon(g, c, t, { w0: (lead ? 7 : 4.5) * big, w1: tied ? 3.2 * big : 1.6, flow: 1, foam: v.charged });
      const h = c[0]; if (lead || c.length === 1) Water.head(g, h.x, h.y, h.q.vx, h.q.vy, (lead ? 3.4 : 2.2) * big, t, v.charged);
    });
  },
  muzzle(m, dir, up, down, charged) {
    const ang = up ? -Math.PI / 2 : down ? Math.PI / 2 : dir > 0 ? 0 : Math.PI;
    L.parts.push({ x: m.x, y: m.y, vx: 0, vy: 0, life: 10, max: 10, color: '#dffcf6', size: 1, g: 0, kind: 'wring', ang, big: charged ? 1.6 : 1 });
    for (let i = 0; i < (charged ? 14 : 8); i++) { const a = ang + rnd(-.55, .55), v = rnd(1.5, charged ? 4.5 : 3.2); L.parts.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .4, life: rnd(8, 16) | 0, color: Math.random() < .4 ? '#f2fffb' : '#8fd9d0', size: 1, g: .14, kind: 'spray' }); }
    for (let i = 0; i < (charged ? 8 : 5); i++) L.parts.push({ x: m.x + rnd(-3, 3), y: m.y + rnd(-3, 3), vx: Math.cos(ang) * rnd(.2, .9) + rnd(-.2, .2), vy: Math.sin(ang) * rnd(.2, .9) - rnd(0, .3), life: rnd(14, 26) | 0, max: 26, color: '#e8fbff', size: 1, g: -.005, kind: 'mist' });
  },
  // Impact: a crown thrown back along the surface normal, a ring, mist and, on walls, runs of water.
  impact(x, y, nx, ny, strong, wallX) {
    const base = Math.atan2(ny, nx), n = strong ? 16 : 7;
    for (let i = 0; i < n; i++) { const a = base + rnd(-1.25, 1.25), v = rnd(1.2, strong ? 3.8 : 2.6); L.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - .5, life: rnd(12, 24) | 0, color: Math.random() < .35 ? '#f2fffb' : Math.random() < .5 ? '#8fd9d0' : '#5cc4bc', size: 1, g: .16, kind: 'spray', bounce: .25 }); }
    L.parts.push({ x, y, vx: 0, vy: 0, life: 12, max: 12, color: '#dffcf6', size: 1, g: 0, kind: 'wring', ang: base + Math.PI / 2 * 0, big: strong ? 1.5 : 1, flat: true, nx, ny });
    for (let i = 0; i < (strong ? 7 : 3); i++) L.parts.push({ x: x + rnd(-4, 4), y: y + rnd(-4, 2), vx: nx * rnd(.1, .6) + rnd(-.3, .3), vy: ny * rnd(.1, .6) - rnd(.1, .4), life: rnd(16, 30) | 0, max: 30, color: '#e8fbff', size: 1, g: -.004, kind: 'mist' });
    if (wallX !== undefined) for (let i = 0; i < (strong ? 4 : 2); i++) L.parts.push({ x: wallX + (nx > 0 ? 0 : -1), y: y + rnd(-6, 6), y0: 0, vx: 0, vy: rnd(.12, .3), life: rnd(70, 120) | 0, max: 120, color: '#5cc4bc', size: 1, g: 0, kind: 'wetrun' });
  }
};

const Proj = {
  create(h, x, y, vx, vy, charged) {
    const kind = h.kind; let g = kind === 'rock' ? .1 : kind === 'crate' ? .14 : kind === 'agua' ? .09 : .06;
    if (charged) g *= kind === 'agua' ? .8 : .35;
    return { kind, x, y, w: h.w, h: h.h, vx, vy, g, t: 0, sprite: h.sprite, dead: false, hits: 0, proto: h.proto, charged: !!charged, trail: [], delay: 0, pushed: new Set() };
  },
  update(p) {
    if (p.delay > 0) { p.delay--; return; }
    p.t++; p.vy = Math.min(p.vy + p.g, 7);
    if ((p.charged || p.kind === 'agua') && p.t % (p.kind === 'agua' ? 1 : 2) === 0) { p.trail.unshift({ x: p.x, y: p.y }); if (p.trail.length > (p.kind === 'agua' ? 6 : 5)) p.trail.pop(); }
    if (p.kind === 'agua' && p.t % 2 === 0 && Math.random() < .7) { const s = Math.random() < .5 ? 1 : -1, sp = Math.hypot(p.vx, p.vy) || 1; L.parts.push({ x: p.x + 4, y: p.y + 4, vx: p.vx * .25 - p.vy / sp * s * rnd(.3, .9), vy: p.vy * .25 + p.vx / sp * s * rnd(.3, .9) - .3, life: rnd(8, 16) | 0, color: Math.random() < .3 ? '#f2fffb' : '#8fd9d0', size: 1, g: .15, kind: 'spray' }); }
    if (p.kind === 'agua' && p.volley && p.volley.projs[0] === p && p.t % 3 === 0) L.parts.push({ x: p.x + 4 + rnd(-2, 2), y: p.y + 4 + rnd(-2, 2), vx: rnd(-.2, .2), vy: rnd(-.3, 0), life: 16, max: 16, color: '#e8fbff', size: 1, g: 0, kind: 'mist' });
    const hx = moveX(p, p.vx), hy = moveY(p, p.vy);
    if (hx || hy) {
      // Movement stops up to a pixel short of the wall, so probe a whole pixel past the edge.
      const lx = hx ? (p.vx > 0 ? p.x + p.w + 1 : p.x - 1) : p.x + p.w / 2, ly = hy ? (p.vy > 0 ? p.y + p.h + 1 : p.y - 1) : p.y + p.h / 2;
      const tx = Math.floor(lx) >> 4, ty = Math.floor(ly) >> 4, ch = tileAt(tx, ty);
      if (ch === 'x' && p.kind !== 'agua') Game.breakCracked(tx, ty, 'x');
      else if (ch === 'X' && p.kind !== 'agua') { if (p.charged) Game.breakCracked(tx, ty, 'X'); else { Sound.play('clang'); Game.word('¡CLONC!', tx * TS + 8, ty * TS - 4, '#9fa8b0', false); spawnParts(6, lx, ly, { color: ['#fff6d6', '#b98a3a'], speed: [.5, 2], life: [6, 12], g: .1 }); } }
      Proj.land(p, hx, hy); return;
    }
    const tx0 = Math.floor(p.x) >> 4, tx1 = Math.floor(p.x + p.w - 1) >> 4, ty0 = Math.floor(p.y) >> 4, ty1 = Math.floor(p.y + p.h - 1) >> 4;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const ch = tileAt(tx, ty);
      if (ch === 'T' && !L.hitTargets.has(key(tx, ty))) { Game.hitTarget(tx, ty); if (p.kind === 'agua') { p.dead = true; Proj.splashOut(p); return; } p.vx *= -.3; p.vy = -2; }
      if (ch === 'F' && p.kind === 'agua') { Game.douse(tx, ty); p.dead = true; Proj.splashOut(p); return; }
    }
    for (const e of L.ents) {
      if (e.dead || !e.enemy && !e.boss || e === p.proto) continue;
      if (!overlap(p, e)) continue;
      if (e.boss) { if (p.kind === 'agua') { p.dead = true; Proj.splashOut(p); return; } if (Boss.hit(e, p, p.charged ? 2 : 1)) { p.dead = true; Proj.dropAsItem(p, true); } continue; }
      if (p.kind === 'agua') { if (p.pushed.has(e)) continue; p.pushed.add(e); e.vx = Math.sign(p.vx || 1) * 2.4; e.vy = -1.5; e.stun = Math.max(e.stun, 30); if (e.armored && !e.flipped) { e.vx *= .3; e.tug = 8; } spawnParts(5, e.x + e.w / 2, e.y + e.h / 2, { color: ['#8fd9d0', '#c8f2ea'], speed: [.5, 2], life: [8, 16], g: .06 }); Sound.play('pop'); continue; }
      if (e.armored && !e.flipped) { Enemy.flip(e); if (!p.charged) { p.vx *= -.4; p.vy = -2.5; } continue; }
      Enemy.kill(e, 'proj'); p.hits++; Cam.shake(2, 5);
      if (p.hits === 2) Game.word('¡DOBLE!', e.x + e.w / 2, e.y - 8, '#f2c46a', true); else if (p.hits >= 3) Game.word('¡TRIPLE!', e.x + e.w / 2, e.y - 8, '#f2c46a', true);
      if (p.kind !== 'rock' && p.kind !== 'crate' && !p.charged) { p.dead = true; Proj.splat(p); return; }
    }
    if (p.y > L.h * TS + 40 || p.x < -40 || p.x > L.w * TS + 40) p.dead = true;
    if (waterAt(p.x + p.w / 2, p.y + p.h / 2)) { p.dead = true; if (p.kind !== 'agua') Game.word('SPLASH', p.x + p.w / 2, p.y - 6, '#8fd9d0', false); Sound.play('splash'); spawnParts(10, p.x + p.w / 2, p.y + p.h, { color: ['#8fd9d0', '#c8f2ea'], angle: -Math.PI / 2, spread: 1, speed: [1, 3], life: [14, 26] }); }
  },
  land(p, hx, hy) {
    if (p.kind === 'agua') { p.dead = true; Proj.splashOut(p, hy && p.vy > 0, hx ? Math.sign(p.vx) : 0); return; }
    if (p.kind === 'crate' || p.kind === 'rock') {
      if (hy && p.vy > 0) { p.dead = true; Proj.dropAsItem(p); Sound.play('thud'); spawnParts(5, p.x + p.w / 2, p.y + p.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.4, speed: [.4, 1.2], life: [8, 14], g: .04 }); return; }
      if (hx) { Sound.play(p.kind === 'rock' ? 'hit' : 'thud'); Cam.shake(p.kind === 'rock' ? (p.charged ? 4 : 2) : 1, 4); if (p.kind === 'crate') { p.vx = 0; p.vy = Math.max(p.vy, 0); } else { p.vx = -p.vx * .25; p.vy = Math.min(p.vy, -1.5); } p.charged = false; spawnParts(6, p.vx < 0 ? p.x + p.w : p.x, p.y + p.h / 2, { color: p.kind === 'rock' ? ['#a6abb8', '#7d8290'] : ['#c78d4e', '#e0a862'], speed: [.5, 2], life: [10, 20] }); return; }
      if (hy && p.vy < 0) { p.vy = 0; return; }
    }
    p.dead = true; Proj.splat(p);
  },
  splashOut(p, ground, wall) {
    // The first drop of a volley makes the big splash; the rest add to it without repeating the sound.
    const v = p.volley, first = !v || v.splashes++ === 0, strong = first && (!v || v.charged || v.projs.length > 3);
    const x = p.x + 4 + (wall > 0 ? 4 : wall < 0 ? -4 : 0), y = p.y + (ground ? 8 : 4);
    const nx = wall ? -wall : ground ? 0 : -Math.sign(p.vx) * .6, ny = wall ? -.35 : ground ? -1 : -.8;
    if (first || (v && v.splashes % 3 === 0)) Sound.play('splash');
    if (first) { Cam.shake(v && v.charged ? 2 : 1, 4); if (strong) Game.word('¡CHOF!', x, y - 10, '#bdf0e4', false); }
    Water.impact(x, y, nx, ny, strong, wall ? (wall > 0 ? p.x + p.w + 1 : p.x - 1) : undefined);
    if (first || Math.random() < .5) L.parts.push({ x: p.x + 4, y: p.y + (ground ? 8 : 4), vx: 0, vy: 0, life: 16, color: '#c8f2ea', size: 1, g: 0, kind: 'ripple' });
    if (ground) L.parts.push({ x: p.x + 4, y: p.y + 8, vx: 0, vy: 0, life: 90, color: '#2f7f88', size: 5 + Math.random() * 3 + (first ? 3 : 0), g: 0, kind: 'puddle' });
  },
  splat(p) { const fake = { kind: p.kind, x: p.x, y: p.y, w: p.w, h: p.h, dead: false }; Enemy.kill(fake, 'proj'); Sound.play('hit'); Cam.shake(2, 5); },
  dropAsItem(p, bounceBack) {
    const e = p.kind === 'crate' ? Item.crate(p.x, p.y) : Item.rock(p.x, p.y);
    if (bounceBack) { e.vx = -Math.sign(p.vx) * 1.5; e.vy = -2.5; }
    // Spat point-blank at a wall, the crate lands on Nila: it lets her walk out before it turns solid.
    if (e.kind === 'crate' && overlap(e, Player.rect())) e.ghost = true;
    L.ents.push(e);
  },
  draw(p, g) {
    if (p.delay > 0) return;
    let s = p.sprite;
    if (p.kind === 'rock' || p.enemy) { const f = (p.t >> 2) % 4; if (f === 1 || f === 3) s = ART.flip(s); }
    const x = Math.round(p.x - Cam.x + (p.w - s.width) / 2), y = Math.round(p.y - Cam.y + p.h - s.height);
    if (p.charged) { p.trail.forEach((t, i) => { g.globalAlpha = .35 - i * .06; g.drawImage(ART.tint(s, i % 2 ? '#e79b3f' : '#fff6d6'), Math.round(t.x - Cam.x + (p.w - s.width) / 2), Math.round(t.y - Cam.y + p.h - s.height)); }); g.globalAlpha = 1; }
    if (p.kind === 'agua') {
      // A volley is drawn once, by its first live drop, as a single column of water.
      if (p.volley) { if (p.volley.projs.find(q => !q.dead && q.delay <= 0) === p) Water.drawVolley(g, p.volley); return; }
      Water.head(g, Math.round(p.x - Cam.x) + 4, Math.round(p.y - Cam.y) + 4, p.vx, p.vy, 2.4, p.t, false);
      return;
    }
    if (p.kind !== 'crate' && p.kind !== 'rock') { const f = (p.t >> 2) % 2; g.save(); g.translate(x + s.width / 2, y + s.height / 2); g.scale(f ? -1 : 1, 1); g.rotate(Math.sin(p.t / 3) * .2); g.translate(-(x + s.width / 2), -(y + s.height / 2)); g.drawImage(s, x, y); g.restore(); }
    else g.drawImage(s, x, y);
    if (Math.abs(p.vx) > 3) { g.fillStyle = p.charged ? 'rgba(255,230,180,.6)' : 'rgba(255,255,255,.35)'; g.fillRect(x - Math.sign(p.vx) * 6 + (p.vx > 0 ? 0 : s.width), y + s.height / 2, 5, 1); }
  }
};

// ---------------------------------------------------------------- Cámara
const Cam = {
  x: 0, y: 0, look: 0, lookY: 0, fallT: 0, shakeT: 0, shakeA: 0, ox: 0, oy: 0, zoom: 1,
  punch(z) { if (Game.still) return; Cam.zoom = Math.max(Cam.zoom, z); },
  snap() { Cam.x = clamp(Player.x + 5 - W / 2, 0, L.w * TS - W); Cam.y = clamp(Player.y + 9 - H / 2, 0, L.h * TS - H); Cam.look = Player.dir * 28; Cam.lookY = 0; Cam.fallT = 0; },
  update() {
    const p = Player;
    Cam.look = lerp(Cam.look, p.dir * 28, .04);
    // Vertical intent: aiming or hanging looks up; a long fall looks down so the landing is on screen before she is.
    p.vy > 3.5 && !p.onGround && !p.hover ? Cam.fallT++ : Cam.fallT = 0;
    const wantY = (p.aimUp || p.hanging || (p.grapple && !p.hanging)) ? -30 : Cam.fallT > 10 || p.pound ? 44 : 0;
    Cam.lookY = lerp(Cam.lookY, wantY, wantY > 0 ? .08 : .05);
    let tx = clamp(p.x + 5 - W / 2 + Cam.look, 0, Math.max(0, L.w * TS - W));
    let ty = clamp(p.y + 9 - H / 2 + 10 + Cam.lookY, 0, Math.max(0, L.h * TS - H));
    // In the heron's arena the fight frames the shot.
    const bc = L.boss && Boss.cam(L.boss); if (bc) { tx = bc.x; ty = clamp(bc.y, 0, Math.max(0, L.h * TS - H)); }
    // Falling fast, the camera must keep up or Nila leaves the bottom of the screen.
    Cam.x = lerp(Cam.x, tx, .1); Cam.y = lerp(Cam.y, ty, p.vy > 4 ? .16 : .08); Cam.zoom = lerp(Cam.zoom, 1, .14); if (Cam.zoom < 1.003) Cam.zoom = 1;
    Cam.shakeOnly();
  },
  // The shake keeps trembling through a hit-stop, so a frozen frame still reads as an impact.
  shakeOnly() { if (Cam.shakeT > 0) { Cam.shakeT--; const a = Cam.shakeA * (Cam.shakeT / 10); Cam.ox = Math.round(rnd(-a, a)); Cam.oy = Math.round(rnd(-a, a)); if (Game.still) { Cam.ox = 0; Cam.oy = 0; } if (Cam.shakeT === 0) Cam.shakeA = 0; } else { Cam.ox = 0; Cam.oy = 0; } },
  shake(a, t) { if (Game.still) return; Cam.shakeA = Math.max(Cam.shakeA, a); Cam.shakeT = Math.max(Cam.shakeT, t); }
};

// ---------------------------------------------------------------- Juego
const Game = {
  state: 'title', t: 0, hitStop: 0, heldPresses: {}, hurtFlash: 0, toastText: '', toastT: 0, pearlPop: 0, level: 0, banner: 0, fade: 0, fadeTo: null, sel: 0, pauseSel: 0, clearStats: null, still: false, endT: 0, titleT: 0, capture: null, paused: false, pauseT: 0, deathT: 0,
  init() {
    Save.load(); Sound.setMuted(!!Save.data.mute);
    Screen.init(); Input.init(); Touch.init();
    Game.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const params = new URLSearchParams(location.search);
    Screen.canvas.addEventListener('pointerdown', e => { Sound.init(); Input.mode = Touch.enabled ? 'touch' : Input.mode; Game.tap(Screen.toGame(e.clientX, e.clientY)); });
    $('touch-sound').addEventListener('click', () => { Sound.init(); Game.toggleMute(); });
    $('touch-fs').addEventListener('click', () => Game.fullscreen());
    if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) $('touch-fs').hidden = true;
    document.addEventListener('visibilitychange', () => { if (document.hidden && Game.state === 'play') Game.pause(); });
    Game.updateSoundButton();
    if (params.has('escena')) Game.capture = { scene: params.get('escena'), t: parseInt(params.get('t') || '0'), n: parseInt(params.get('n') || '0'), x: parseInt(params.get('x') || '-1'), guion: (params.get('guion') || '').split(';').filter(Boolean).map(s => { const [a, r] = s.split('@'); const [f0, f1] = (r || '0').split('-').map(Number); return { a, f0, f1: f1 === undefined ? f0 : f1 }; }) };
    if (params.has('z')) Game.capZoom = +params.get('z');
    if (params.has('trucos')) for (const k of params.get('trucos').split(',')) if (k === 'todos') POWER_ORDER.forEach(q => Save.data.powers[q] = true); else Save.data.powers[k] = true;
    if (Game.capture) Game.runCapture(); else Game.state = 'gate';
    Game.last = performance.now(); Game.acc = 0; requestAnimationFrame(Game.frame);
  },
  runCapture() {
    const c = Game.capture;
    if (c.scene === 'sprites' || c.scene === 'zoom' || c.scene === 'maestros') { Game.state = 'sprites'; return; }
    if (c.scene === 'maestro') { Maestros.capture(c); return; }
    if (c.scene === 'selector' || c.scene === 'mapa') {
      Save.data = Save.fresh(); for (let i = 0; i <= Math.min(c.n, LEVELS.length - 1); i++) Save.open(i);
      LEVELS.forEach((def, i) => { if (i < c.n) { const ks = NIVEL.criasDe(def); ks.slice(0, Math.ceil(ks.length * (i % 2 ? .4 : .7))).forEach(k => { Save.criasSet(def.id)[k] = 1; }); Save.data.best[def.id] = 200 + i * 17; if (def.maestro) Save.data.powers[def.maestro.poder] = true; } });
      Game.select(); Game.sel = Math.min(c.n, LEVELS.length - 1); Mapa.place(Game.sel);
      if (c.x >= 0) { Game.sel = c.x; Mapa.place(c.x); }
      for (let i = 0; i < c.t; i++) { Input.pressed = {}; Game.update(); } Game.frozen = true; return; }
    if (c.scene === 'aprende') { Game.startLevel(0); Game.banner = 0; for (let i = 0; i < 40; i++) Game.updatePlay(); Aprende.start(POWER_ORDER[c.n]); for (let i = 0; i < c.t; i++) { Input.pressed = {}; Aprende.update(); } Game.frozen = true; return; }
    if (c.scene === 'llegada') { Game.startLevel(c.n); Barca.start(); for (let i = 0; i < c.t; i++) { Input.pressed = {}; Game.updatePlay(); } Game.frozen = true; return; }
    if (c.scene === 'cine') { Cine.start(() => { }); Cine.state.t = c.t; Game.frozen = true; return; }
    if (c.scene === 'titulo') { Game.title(); for (let i = 0; i < c.t; i++) Game.updateTitle(); Game.frozen = true; return; }
    if (c.scene === 'icono') { Game.state = 'icon'; return; }
    if (c.scene === 'victoria') { Victoria.capture(c); return; }
    if (c.scene === 'nivel') { Game.startLevel(c.n); if (c.x >= 0) { Player.x = c.x; Player.y = 0; for (let i = 0; i < 60; i++) { Player.vy = Math.min(Player.vy + .28, 5.5); if (moveY(Player, Player.vy)) { Player.vy = 0; Player.onGround = true; break; } } Cam.snap(); } Game.banner = 0; for (let i = 0; i < c.t; i++) { Input.held = {}; Input.pressed = {}; for (const g of c.guion) if (i >= g.f0 && i <= g.f1) { Input.held[g.a] = true; if (i === g.f0) Input.pressed[g.a] = true; } Game.updatePlay(); } Input.held = {}; Input.pressed = {}; Game.frozen = true; if (params_debug()) console.log('ENTS', JSON.stringify(L.ents.map(e => [e.kind, Math.round(e.x), Math.round(e.y), e.dead ? 'dead' : ''])), 'PLAYER', Math.round(Player.x), Math.round(Player.y), Player.held ? Player.held.kind : '-', 'SUCK', Player.sucking, Player.waterT, Player.charge, Player.hover, Player.fishT, 'GRAP', !!Player.grapple, Player.hanging, Player.crouch, 'MOVE', Player.onWall, Player.airJumps, Player.pound, Player.slide, Player.mantleT, 'PEARLS', L.pearls, 'PROJS', JSON.stringify(L.projs.map(p => [p.kind, Math.round(p.x), Math.round(p.y)])), 'GATES', L.gates.map(g => g.map(t => tileAt(t.x, t.y)).join('')).join('|'), 'TARGETS', [...L.hitTargets].join(';')); return; }
  },
  title() { Game.state = 'title'; Game.titleT = 0; Game.titleParts = []; Sound.playMusic('march'); },
  frame(now) {
    const dt = Math.min(100, now - Game.last); Game.last = now; Game.acc += dt;
    let steps = 0;
    while (Game.acc >= 1000 / 60 && steps < 4) { Game.acc -= 1000 / 60; Input.pollPad(); Game.update(); Input.endFrame(); steps++; }
    if (Game.acc >= 1000 / 60) Game.acc = 0;
    Game.draw(Screen.g); Screen.present();
    requestAnimationFrame(Game.frame);
  },
  update() {
    Game.t++;
    if (Input.pressed.mute) Game.toggleMute();
    if (Input.pressed.fullscreen) Game.fullscreen();
    if (Game.toastT > 0) Game.toastT--; if (Game.pearlPop > 0) Game.pearlPop--;
    if (Game.fadeTo) { Game.fade = Math.min(1, Game.fade + .06); if (Game.fade >= 1) { const f = Game.fadeTo; Game.fadeTo = null; f(); } return; }
    if (Game.fade > 0) Game.fade = Math.max(0, Game.fade - .06);
    switch (Game.state) {
      case 'title': if (!Game.frozen) Game.updateTitle(); break;
      case 'select': if (!Game.frozen) Game.updateSelect(); break;
      case 'play': if (Game.frozen) break; if (Game.paused) Game.updatePause(); else Game.updatePlay(); break;
      case 'clear': Game.updateClear(); break;
      case 'ending': Game.updateEnding(); break;
      case 'gate': Cine.gateUpdate(); break;
      case 'cine': if (!Game.frozen) Cine.update(); break;
    }
    Touch.updateButtons();
    Game.updateShell();
  },
  updateShell() {
    const inPlay = Game.state === 'play' && !Game.paused;
    document.body.classList.toggle('in-play', inPlay);
    document.body.classList.toggle('in-menu', !inPlay);
    $('hint').hidden = Touch.enabled || Game.state !== 'title';
  },
  transition(f) { if (Game.fadeTo) return; Game.fadeTo = f; Game.fade = 0; },
  // ---- title
  updateTitle() {
    Game.titleT++;
    if (Game.titleT % 6 === 0 && Game.titleParts.length < 40) Game.titleParts.push({ x: rnd(0, W), y: rnd(60, 150), vx: rnd(-.2, .2), vy: rnd(-.15, .05), life: rnd(60, 160), t: rnd(0, 100) });
    for (let i = Game.titleParts.length - 1; i >= 0; i--) { const p = Game.titleParts[i]; p.t++; p.x += p.vx + Math.sin(p.t / 20) * .2; p.y += p.vy; if (--p.life <= 0) Game.titleParts.splice(i, 1); }
    Title.update(Game.titleT);
    if (Game.titleT > 20 && (Input.pressed.jump || Input.pressed.fish || Input.pressed.confirm || Game.tapped)) {
      Game.tapped = false;
      // The first press during the intro only hurries it along; the next one starts.
      if (Game.titleT < Title.INTRO) { Game.titleT = Title.INTRO; Sound.play('select'); }
      else { Sound.play('confirm'); Title.press(Game.titleT); Game.transition(() => Game.select()); }
    }
  },
  // The map. With `from` and `to` (after finishing a level) Nila walks from the place she left to the next one.
  select(from, to) {
    Game.state = 'select'; Charla.stop();
    if (from !== undefined && to !== undefined && to < LEVELS.length) { Mapa.place(from); Game.sel = to; Mapa.select(to); }
    else { Game.sel = Math.min(Save.reached(), LEVELS.length - 1); Mapa.place(Game.sel); }
    Sound.playMusic('dock');
  },
  updateSelect() {
    if (Charla.active()) { Charla.update(); return; }
    const n = LEVELS.length, before = Game.sel; Mapa.update();
    if (Input.pressed.left || Input.pressed.down) { Game.sel = Math.max(0, Game.sel - 1); }
    if (Input.pressed.right || Input.pressed.up) { Game.sel = Math.min(n - 1, Game.sel + 1); }
    if (Game.tapSel !== undefined) { const s = Game.tapSel; Game.tapSel = undefined; if (s === Game.sel) Game.tapped = true; else Game.sel = s; }
    if (Game.sel !== before) { Mapa.select(Game.sel); Sound.play('select'); }
    // Reaching the wall of thorns for the first time: Ruca explains the song of the crías.
    if (!Mapa.walking() && Save.locked(Game.sel) && Game.sel <= Save.reached() && !(Save.data.seen || {}).muro) { Game.explainWall(Game.sel); return; }
    if (Input.pressed.jump || Input.pressed.fish || Input.pressed.confirm || Game.tapped) {
      Game.tapped = false;
      const i = Game.sel;
      if (i > Save.reached()) Sound.play('hurt');
      else if (Save.locked(i)) { Sound.play('hurt'); Mapa.shake(i); Game.explainWall(i, true); }
      else { Sound.play('confirm'); Game.transition(() => Game.startLevel(i, true)); }
    }
    if (Input.pressed.pause) { Sound.play('select'); Game.transition(() => Game.title()); }
  },
  explainWall(i, again) {
    const need = LEVELS[i].requiere.crias, have = Save.gateCount(i), left = need - have;
    Save.data.seen = Object.assign(Save.data.seen || {}, { muro: true }); Save.write();
    const lines = again ? ['Faltan ' + left + ' crías. Vuelve a los sitios donde dejaste alguna: con los trucos nuevos llegarás a los rincones que no podías.']
      : ['¡Nila, espera! El ciprés de la Garza está rodeado por un muro de zarzas encantado.',
        'Sólo se abre cuando cantan juntas muchas crías: la canción de las crías. Hacen falta ' + need + ' y hay ' + have + ' en casa.',
        'Muchas se quedaron en rincones a los que no llegabas. Con los trucos nuevos de Bigotes, vuelve a buscarlas. El mapa te dice cuántas faltan en cada sitio.'];
    Charla.start({ quien: 'ruca', lines });
  },
  // ---- play
  startLevel(i, arrive) { Maestros.reset(); Game.level = i; Game.hitStop = 0; Game.heldPresses = {}; loadLevel(i); Game.state = 'play'; Game.paused = false; Game.banner = 190; Sound.playMusic(LEVELS[i].music); Game.toastT = 0; Game.weather = { bolt: 0, next: 200, x: 0, seed: 1, thunder: 0 };  if (arrive) { Barca.start(); Game.banner = 0; } },
  respawn() { Game.transition(() => { Player.reset(L.checkpoint.x, L.checkpoint.y, true); if (L.def.boss) { if (!Boss.restart()) { loadLevel(Game.level); Game.banner = 60; } } else { spawnEntities(); } Cam.snap(); Sound.playMusic(L.def.boss ? Boss.song() : L.def.music); }); },
  drown(fell) {
    const p = Player; if (p.dead) return;
    if (!fell) { Sound.play('splash'); spawnParts(14, p.x + 5, p.y + p.h, { color: ['#8fd9d0', '#c8f2ea', '#2f7f88'], angle: -Math.PI / 2, spread: 1.2, speed: [1, 3.5], life: [16, 30] }); for (let i = 0; i < 2; i++) L.parts.push({ x: p.x + 5, y: Math.floor((p.y + p.h) / TS) * TS + 2, vx: 0, vy: 0, life: 16 - i * 5, color: '#c8f2ea', size: 1, g: 0, kind: 'ripple' }); }
    const carried = p.held && p.held.kind !== 'agua' ? p.held : null, safe = p.lastSafe;
    p.hp--; Sound.suck(false); Sound.jet(false); p.sucking = false; p.held = null; p.hover = false; p.charge = 0;
    if (p.hp <= 0) { p.dead = true; p.deadT = 40; p.vy = 0; p.vx = 0; p.y = L.h * TS + 100; }
    else if (safe) {
      // Back on the last firm ground, with the world left as it was; whatever she carried lands beside her.
      Game.transition(() => { const hp = p.hp; Player.reset(safe.x, safe.y, false); p.hp = hp; p.inv = 60; p.lastSafe = safe; Cam.snap(); Game.restoreProps();
        if (carried) { const e = Item.fromHeld(carried, safe.x + 5 - carried.w / 2, safe.y + 18 - carried.h); if (e) { for (let n = 0; n < 16 && rectSolid(e.x, e.y, e.w, e.h, e); n++) e.y--; L.ents.push(e); } } });
    }
    else { Game.transition(() => { const hp = p.hp; Player.reset(L.checkpoint.x, L.checkpoint.y, false); p.hp = hp; p.inv = 60; spawnEntities(); Cam.snap(); }); }
  },
  // After a fall into the water the world is kept, but the rafts go back to their moorings and any crate
  // or rock that was lost (sunk, carried off) reappears where it started, so no puzzle is left without its piece.
  restoreProps() {
    L.ents = L.ents.filter(e => e.kind !== 'raft');
    for (const s of L.spawn) if (s.ch === 'R') L.ents.push(Item.raft(s.x * TS, s.y * TS + 12));
    for (const [ch, kind, make] of [['c', 'crate', (x, y) => Item.crate(x, y)], ['r', 'rock', (x, y) => Item.rock(x + 1, y + 4)]]) {
      const spots = L.spawn.filter(s => s.ch === ch); let have = L.ents.filter(e => e.kind === kind && !e.dead).length + L.projs.filter(q => q.kind === kind && !q.dead).length + (Player.held && Player.held.kind === kind ? 1 : 0);
      for (const s of spots) { if (have >= spots.length) break; L.ents.push(make(s.x * TS + 1, s.y * TS + 2)); have++; }
    }
  },
  updatePlay() {
    if (Input.pressed.pause) { Game.pause(); return; }
    if (Game.learning) { Aprende.update(); return; }
    // Arriving by boat: nothing moves but the boat, Nila and the camera.
    if (Game.arrival) { Barca.update(); updateParts(); Hud.update(); return; }
    // A teacher talking, or the morsel on its way to Bigotes: the world waits.
    if (Maestros.busy()) { Maestros.updateModal(); return; }
    // A hit-stop freezes the world, not the hands: presses made during it are kept and land on the first live frame.
    if (Game.hitStop > 0) { Game.hitStop--; for (const k in Input.pressed) if (Input.pressed[k] && k !== 'pause') Game.heldPresses[k] = true; Cam.shakeOnly(); return; }
    // The heron's last blow plays in slow motion; presses are kept the same way.
    if (L.boss && Boss.skip()) { for (const k in Input.pressed) if (Input.pressed[k] && k !== 'pause') Game.heldPresses[k] = true; Cam.shakeOnly(); return; }
    for (const k in Game.heldPresses) Input.pressed[k] = true; Game.heldPresses = {};
    L.time++;
    if (Game.banner > 0) Game.banner--;
    // During the heron's entrance Nila stands and watches (the keys stay held for afterwards).
    const lock = L.boss && L.boss.lock && !L.boss.dead, keep = lock && [Input.held, Input.pressed];
    if (lock) { Input.held = {}; Input.pressed = {}; }
    Player.update();
    if (lock) { Input.held = keep[0]; Input.pressed = keep[1]; }
    for (const e of L.ents) if (!e.dead) e.update(e);
    if (L.gusts) { for (const q of L.gusts) Player.gustUpdate(q); L.gusts = L.gusts.filter(q => !q.dead); }
    Hud.update();
    for (const p of L.projs) if (!p.dead) Proj.update(p);
    L.ents = L.ents.filter(e => !e.dead); L.projs = L.projs.filter(p => !p.dead); L.solids = L.solids.filter(s => !s.dead);
    updateParts();
    // Deferred tile breaks and gate openings for a staggered feel.
    for (let i = L.breakQueue.length - 1; i >= 0; i--) { const q = L.breakQueue[i]; if (--q.d <= 0) { L.breakQueue.splice(i, 1); setTile(q.x, q.y, '.'); spawnParts(7, q.x * TS + 8, q.y * TS + 8, { color: ['#8a8f94', '#4f545a', '#a9aeb3'], speed: [.8, 2.6], life: [16, 34], g: .18, bounce: .3 }); } }
    for (let i = L.gateQueue.length - 1; i >= 0; i--) { const q = L.gateQueue[i]; if (--q.d <= 0) { L.gateQueue.splice(i, 1); setTile(q.x, q.y, '.'); spawnParts(6, q.x * TS + 8, q.y * TS + 8, { color: ['#c78d4e', '#a56f38', '#c9b08a'], speed: [.4, 1.6], life: [14, 30], g: .1 }); } }
    for (const [k, v] of L.mush) { if (v <= 1) L.mush.delete(k); else L.mush.set(k, v - 1); }
    for (const [k, v] of L.lily) { if (v <= 1) L.lily.delete(k); else L.lily.set(k, v - 1); }
    for (let i = L.words.length - 1; i >= 0; i--) { const w = L.words[i]; w.t++; if (w.t > w.life) L.words.splice(i, 1); }
    for (let i = L.ghosts.length - 1; i >= 0; i--) { const gh = L.ghosts[i]; if (--gh.life <= 0) L.ghosts.splice(i, 1); }
    if (Game.hurtFlash > 0) Game.hurtFlash--;
    Game.ambient();
    Cam.update();
    if (Player.win) Victoria.update();
  },
  ambient() {
    const th = L.def.theme, x = Cam.x + rnd(0, W), y = Cam.y + rnd(0, H);
    if (th === 'storm') {
      // Slanted rain that splashes where it lands, and now and then a bolt over the far trees.
      for (let i = 0; i < 3; i++) L.parts.push({ x: Cam.x + rnd(-20, W + 40), y: Cam.y - rnd(4, 30), vx: -1.1, vy: rnd(4.5, 5.5), life: 60, color: Math.random() < .3 ? '#b8c8d8' : '#7f93a8', size: 1, g: 0, kind: 'rain' });
      const w = Game.weather; if (w.bolt > 0) w.bolt--;
      if (w.thunder > 0 && --w.thunder === 0) { Sound.play('thunder'); Cam.shake(2, 20); Input.rumble(300, .3, .2); }
      if (--w.next <= 0) { w.bolt = 12; w.x = rnd(40, W - 40); w.seed = (Math.random() * 1e6) | 0; w.thunder = 12 + ((Math.random() * 30) | 0); w.next = 300 + ((Math.random() * 420) | 0); }
    }
    // Fireflies that glow and wander; in the cave, spores drift down and drops fall from the roof.
    if ((th === 'dusk' || th === 'night' || th === 'nest') && Math.random() < (th === 'nest' ? .015 : .05)) L.parts.push({ x, y: Cam.y + rnd(40, 170), vx: rnd(-.15, .15), vy: rnd(-.1, .05), life: 160, color: th === 'night' ? '#d8f58a' : '#f2f5a0', size: 1, g: 0, kind: 'fly', ph: rnd(0, 6) });
    if (th === 'cave' && Math.random() < .08) L.parts.push({ x, y: Cam.y - 4, vx: rnd(-.1, .1), vy: rnd(.1, .3), life: 200, color: ['#8ff4e2', '#8a6aa8', '#d8c0e8'][(Math.random() * 3) | 0], size: 1, g: 0, kind: 'amb', ph: rnd(0, 6) });
    if (th === 'cave' && Math.random() < .03) L.parts.push({ x, y: Cam.y + rnd(0, 10), vx: 0, vy: .2, life: 90, color: '#9ac8e8', size: 1, g: .12, kind: 'drip' });
    if (th === 'storm' && Math.random() < .03) L.parts.push({ x: Cam.x + W + 4, y: Cam.y + rnd(20, 150), vx: -rnd(2.2, 3.4), vy: rnd(-.3, .4), life: 160, color: ['#5e7a3a', '#7a6a3a', '#3e5a34'][(Math.random() * 3) | 0], size: 1, g: .01, kind: 'leaf', ph: rnd(0, 6) });
    if (th === 'nest' && Math.random() < .07) L.parts.push({ x, y: Cam.y - 4, vx: rnd(-.3, .1), vy: rnd(.15, .4), life: 220, color: ['#e9eef2', '#f2c46a', '#d0684a'][(Math.random() * 3) | 0], size: 1, g: 0, kind: 'amb', ph: rnd(0, 6) });
    // Embers from any fire in view.
    const x0 = Math.max(0, Cam.x >> 4), x1 = Math.min(L.w - 1, (Cam.x + W) >> 4), y0 = Math.max(0, Cam.y >> 4), y1 = Math.min(L.h - 1, (Cam.y + H) >> 4);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (L.t[ty][tx] === 'F' && Math.random() < .08) L.parts.push({ x: tx * TS + rnd(3, 13), y: ty * TS + rnd(2, 10), vx: rnd(-.2, .2), vy: rnd(-.7, -.25), life: rnd(16, 34), color: ['#b4f8dc', '#5ed8b8', '#f0fff6'][(Math.random() * 3) | 0], size: 1, g: -.01, kind: 'dot' });
  },
  breakCracked(tx, ty, kind = 'x') {
    const seen = new Set(), stack = [[tx, ty]]; let n = 0; Sound.play('crack'); Cam.shake(3, 8); Game.stop(3); Cam.punch(1.04); Game.word('¡CRAC!', tx * TS + 8, ty * TS - 6, '#d0d6da', true); Input.rumble(120, .7, .4);
    while (stack.length) { const [x, y] = stack.pop(); const k = key(x, y); if (seen.has(k) || tileAt(x, y) !== kind) continue; seen.add(k); L.breakQueue.push({ x, y, d: 1 + Math.abs(x - tx) * 3 + Math.abs(y - ty) * 3 }); n++; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) stack.push([x + dx, y + dy]); }
    setTile(tx, ty, '.'); spawnParts(8, tx * TS + 8, ty * TS + 8, { color: ['#8a8f94', '#4f545a', '#a9aeb3'], speed: [1, 3], life: [16, 34], g: .18, bounce: .3 });
  },
  setGate(idx, open) {
    const gate = L.gates[idx] || L.gates[0]; if (!gate || gate.open === open) return; gate.open = open;
    if (open) { gate.forEach((g, i) => L.gateQueue.push({ x: g.x, y: g.y, d: 8 + i * 6 })); Sound.play('gate'); return; }
    // Closing: the bars drop back unless someone is standing in the way (then they wait a moment).
    const blocked = gate.some(g => { const r = { x: g.x * TS, y: g.y * TS, w: TS, h: TS }; return overlap(r, Player.rect()) || L.ents.some(e => !e.dead && (e.kind === 'crate' || e.kind === 'rock' || e.enemy) && overlap(r, e)); });
    if (blocked) { gate.open = true; setTimeout(() => { if (Game.state === 'play') Game.setGate(idx, false); }, 400); return; }
    L.gateQueue = L.gateQueue.filter(q => !gate.some(g => g.x === q.x && g.y === q.y));
    gate.forEach(g => setTile(g.x, g.y, 'G')); Sound.play('thud'); Cam.shake(1, 4);
    spawnParts(6, gate[gate.length - 1].x * TS + 8, gate[gate.length - 1].y * TS + 14, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.4, speed: [.4, 1.2], life: [8, 14], g: .04 });
  },
  hitTarget(tx, ty) {
    const k = key(tx, ty); L.hitTargets.add(k); Sound.play('switch'); Cam.shake(2, 6); Game.word('¡DIANA!', tx * TS + 8, ty * TS - 6, '#6cbf4e', true);
    spawnParts(10, tx * TS + 8, ty * TS + 8, { color: ['#6cbf4e', '#d8f0b8', '#ffffff'], speed: [.5, 2.5], life: [14, 28], g: .05 });
    Game.setGate(L.targets.get(k), true);
  },
  levelClear(boat) {
    // The celebration (leap into the boat, crías, sailing off) lives in victoria.js.
    Player.win = true; Player.vx = 0; Player.vy = 0; Player.sucking = false; Player.hover = false; Player.charge = 0; Sound.suck(false); Sound.jet(false); Game.winT = 0;
    spawnParts(20, Player.x + 5, Player.y, { color: ['#ffffff', '#cfe8f0', '#ffcf5a'], speed: [.5, 2.5], life: [20, 50], g: -.02 });
    Victoria.start(boat);
  },
  finishLevel() {
    const i = Game.level, d = Save.data, id = L.def.id;
    // The crías freed from the heron's crop are home too.
    if (L.def.boss) { const set = Save.criasSet(id); for (let k = 0; k < Math.min(L.bossFreed || 0, Boss.CRIAS); k++) set['garza:' + k] = 1; }
    const secs = Math.floor(L.time / 60), prevBest = d.best[id]; if (!d.best[id] || secs < d.best[id]) d.best[id] = secs;
    if (i + 1 < LEVELS.length) Save.open(i + 1); else d.finished = true;
    Save.write(); Sound.duck(false);
    // The tally lists the trick this level's teacher teaches (stamped if Bigotes has it).
    const taught = NIVEL.poderDe(L.def) ? [NIVEL.poderDe(L.def)] : [];
    Game.clearStats = { name: L.def.name, pearls: L.pearls, total: L.pearlsTotal, secs, last: i + 1 >= LEVELS.length, prevBest, boss: !!L.def.boss, par: L.def.par, tricksAll: taught, tricks: taught.filter(Save.has) };
    Game.transition(() => { Game.state = 'clear'; Game.clearT = 0; Cam.fx = null; Victoria.startClear(); Sound.playMusic('victoria'); });
  },
  // The tally (letters, counts, medal) and the move on to the next level or the ending: victoria.js.
  updateClear() { Victoria.updateClear(); },
  updateEnding() { Game.endT++; if (Game.endT > 120 && (Input.pressed.jump || Input.pressed.fish || Input.pressed.confirm || Game.tapped)) { Game.tapped = false; Sound.play('confirm'); Game.transition(() => Game.select()); } },
  pause() { if (Game.state !== 'play' || Game.paused) return; Game.paused = true; Game.pauseSel = 0; Sound.suck(false); Sound.jet(false); Sound.duck(true); Input.release(); },
  resume() { Game.paused = false; Sound.duck(false); Sound.resume(); },
  updatePause() {
    const items = 3;
    if (Input.pressed.up) { Game.pauseSel = (Game.pauseSel + items - 1) % items; Sound.play('select'); }
    if (Input.pressed.down) { Game.pauseSel = (Game.pauseSel + 1) % items; Sound.play('select'); }
    if (Game.tapSel !== undefined) { Game.pauseSel = Game.tapSel; Game.tapSel = undefined; Game.tapped = true; }
    if (Input.pressed.pause) { Game.resume(); return; }
    if (Input.pressed.jump || Input.pressed.fish || Input.pressed.confirm || Game.tapped) {
      Game.tapped = false; Sound.play('confirm');
      if (Game.pauseSel === 0) Game.resume();
      else if (Game.pauseSel === 1) Game.toggleMute();
      else { Game.paused = false; Sound.duck(false); Sound.suck(false); Game.transition(() => Game.select()); }
    }
  },
  toggleMute() { Sound.setMuted(!Sound.isMuted()); Save.data.mute = Sound.isMuted(); Save.write(); Game.updateSoundButton(); if (!Sound.isMuted()) Sound.play('select'); },
  updateSoundButton() { const b = $('touch-sound'); b.setAttribute('aria-pressed', String(Sound.isMuted())); b.textContent = Sound.isMuted() ? '♪ off' : '♪'; b.classList.toggle('off', Sound.isMuted()); },
  fullscreen() { const el = document.documentElement; if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } else { (el.requestFullscreen || el.webkitRequestFullscreen).call(el).catch(() => { }); } },
  stop(n) { Game.hitStop = Math.max(Game.hitStop, n); },
  toast(text, t) { Game.toastText = text; Game.toastT = t; },
  has(p) { return Save.has(p); },
  // Bigotes eats the morsel a teacher gave him and learns a trick: a beat of celebration, then a card that waits for a press.
  learn(power, giver) {
    const p = Player; Aprende.start(power, giver); Save.data.powers[power] = true; Save.write();
    p.vx = 0; p.sucking = false; Sound.suck(false); Sound.jet(false); p.hover = false; p.charge = 0; p.swallowT = 10; Player.letGo();
    Sound.duck(true); Cam.punch(1.05); Input.rumble(200, .6, .6);
    const m = p.mouth(); Game.word('¡ÑAM!', m.x, m.y - 14, '#ffe36a', true);
    spawnParts(24, p.x + 5 + p.dir * 12, p.y + 10, { color: ['#ffe36a', '#fff6d6', '#e8fbff', '#e79b3f'], speed: [.5, 3], life: [20, 50], g: -.02 });
  },
  word(text, x, y, color = '#fff6d6', big = false) { L.words.push({ text, x, y, t: 0, life: big ? 46 : 34, color, big, wob: Math.random() * 6 }); if (L.words.length > 12) L.words.shift(); },
  douse(tx, ty) {
    const seen = new Set(), stack = [[tx, ty]]; Sound.play('hiss'); Game.word('SSSH', tx * TS + 8, ty * TS - 4, '#cfe0e8', false);
    while (stack.length) { const [x, y] = stack.pop(); const k = key(x, y); if (seen.has(k) || tileAt(x, y) !== 'F') continue; seen.add(k); setTile(x, y, '.'); spawnParts(14, x * TS + 8, y * TS + 8, { color: ['#c8d0d6', '#9fa8b0', '#e8eef2'], angle: -Math.PI / 2, spread: 1, speed: [.3, 1.6], life: [30, 70], g: -.03, kind: 'smoke' }); spawnParts(4, x * TS + 8, y * TS + 12, { color: ['#8fd9d0', '#c8f2ea'], speed: [.5, 1.5], life: [10, 18], g: .08 }); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) stack.push([x + dx, y + dy]); }
  },
  tap(pt) {
    if (Game.state === 'title') { Game.tapped = true; return; }
    if ((Game.state === 'select' || Game.state === 'play') && Charla.active()) { Game.tapped = true; return; }
    if (Game.state === 'select') { const h = Mapa.hit(pt); if (h === 'panel') Game.tapped = true; else if (h >= 0) Game.tapSel = h; return; }
    if (Game.state === 'play' && Game.learning) { Game.tapped = true; return; }
    if (Game.state === 'play' && Game.paused) { const rows = Game.pauseRows(); for (let i = 0; i < rows.length; i++) if (pt.y >= rows[i] - 6 && pt.y < rows[i] + 12) { Game.tapSel = i; return; } return; }
    if (Game.state === 'clear' || Game.state === 'ending') Game.tapped = true;
  },
  noteRaw(e) { return (e.kind === 'ruca' ? L.def.ruca : L.def.signs)[e.idx] || ''; },
  signText(idx, rawText) {
    const def = L.def; const raw = rawText !== undefined && rawText !== null ? rawText : (def.signs[idx] || ''); const m = Input.mode;
    const map = m === 'touch' ? { move: 'La cruceta', jump: 'SALTO', fish: 'BIGOTES', puff: 'SOPLO', up: '▲', down: '▼' } : m === 'pad' ? { move: 'El stick', jump: 'A', fish: 'X', puff: 'B', up: 'arriba', down: 'abajo' } : { move: 'Flechas', jump: 'Z o espacio', fish: 'X', puff: 'C', up: '↑', down: '↓' };
    return raw.replace(/\{(\w+)\}/g, (_, k) => map[k] || k).replace('▲', '↑').replace('▼', '↓');
  },
  // ---------------------------------------------------------------- Dibujo
  draw(g) {
    g.imageSmoothingEnabled = false;
    switch (Game.state) {
      case 'title': Game.drawTitle(g); break;
      case 'select': Game.drawSelect(g); if (Charla.active()) Charla.draw(g); break;
      case 'gate': Cine.gateDraw(g); break;
      case 'cine': Cine.draw(g); break;
      case 'play': Game.drawPlay(g); if (Game.learning) Aprende.draw(g); else if (Charla.active()) Charla.draw(g); if (Game.paused) Game.drawPause(g); break;
      case 'clear': Game.drawClear(g); break;
      case 'ending': Game.drawEnding(g); break;
      case 'sprites': Game.drawSprites(g); break;
      case 'icon': Game.drawIcon(g); break;
    }
    if (Game.fade > 0) { g.fillStyle = 'rgba(8,10,16,' + Game.fade + ')'; g.fillRect(0, 0, W, H); }
  },
  drawBackground(g, camX, camY, bg) {
    const w = Game.weather, bolt = Game.state === 'play' && w && w.bolt > 0 && L.def && L.def.theme === 'storm' ? gg => Game.drawBolt(gg, w) : null;
    MUNDO.drawBackground(g, camX, camY, bg, Game.t, W, H, bolt);
  },
  drawBolt(g, w) {
    g.globalAlpha = w.bolt / 12 * .5; g.fillStyle = '#cfe0f0'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    if (w.bolt < 6) return;
    let r = ART.rng(w.seed), x = w.x, y = 0; g.fillStyle = '#f4f8ff';
    while (y < 120) { const ny = y + 4 + ((r() * 8) | 0), nx = x + ((r() * 9) | 0) - 4; for (let k = 0; k <= ny - y; k++) g.fillRect(Math.round(x + (nx - x) * k / (ny - y)), y + k, 1, 1); x = nx; y = ny; if (r() < .15) { let bx = x, by = y; for (let j = 0; j < 10; j++) { bx += r() < .5 ? -1 : 1; by++; g.fillRect(bx, by, 1, 1); } } }
  },
  drawTiles(g, camX, camY, layer) { Game.terrain = MUNDO.drawTiles(g, L, camX, camY, layer, W, H, Game.t) || Game.terrain; },
  drawPlay(g) {
    const camX = Math.round(Cam.x) + Cam.ox, camY = Math.round(Cam.y) + Cam.oy;
    const zoom = Cam.zoom > 1 ? Cam.zoom : 1;
    if (Game.capZoom) { g.save(); g.translate(W / 2, H / 2); g.scale(Game.capZoom, Game.capZoom); g.translate(-(Player.x - Cam.x + 12), -(Player.y - Cam.y + 10)); }
    else if (zoom > 1) { const f = Player.win && Cam.fx != null; g.save(); g.translate(W / 2, H / 2); g.scale(zoom, zoom); g.translate(-(f ? Cam.fx : W / 2), -(f ? Cam.fy : H / 2)); }
    Game.drawBackground(g, camX, camY, L.bg);
    Game.drawTiles(g, camX, camY, 'back');
    if (Game.arrival) Barca.drawBack(g);
    // Depth: signs and lanterns behind, then items, enemies, player, projectiles.
    const order = e => e.kind === 'sign' || e.kind === 'lantern' ? 0 : e.kind === 'boat' ? 1 : e.enemy ? 3 : e.boss ? 4 : 2;
    const ents = L.ents.slice().sort((a, b) => order(a) - order(b));
    for (const e of ents) if (!e.dead && order(e) <= 1) e.draw(e, g);
    if (Player.sucking) Game.drawSuction(g);
    for (const e of ents) if (!e.dead && order(e) > 1) e.draw(e, g);
    for (const gh of L.ghosts) { const sx = 1 + (5 - gh.life) * gh.grow; g.save(); g.translate(Math.round(gh.x - Cam.x + gh.sprite.width / 2), Math.round(gh.y - Cam.y + gh.sprite.height / 2)); g.scale(sx, sx); g.globalAlpha = gh.life / 5; g.drawImage(ART.tint(gh.sprite, '#ffffff'), -gh.sprite.width / 2, -gh.sprite.height / 2); g.restore(); }
    if (Game.arrival) Barca.drawFront(g); else Player.draw(g);
    for (const p of L.projs) if (!p.dead) Proj.draw(p, g);
    Game.drawParts(g);
    Game.drawGusts(g);
    Game.drawTiles(g, camX, camY, 'front');
    if (L.boss) Boss.drawFront(g);
    if (Game.weather && Game.weather.bolt > 8 && L.def.theme === 'storm' && !Game.still) { g.globalAlpha = (Game.weather.bolt - 8) / 4 * .35; g.fillStyle = '#e8f0ff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    Game.drawLight(g, camX, camY);
    Game.drawWords(g);
    if (zoom > 1 || Game.capZoom) g.restore();
    Game.drawHud(g);
  },
  // Darkness with pools of light: the cave is lit by Nila, lanterns, fire, pearls and glowing mushrooms.
  drawLight(g, camX, camY) {
    // The cave keeps pools of light but stays readable: the dark only dims it by about half.
    const th = L.def.theme; const dark = th === 'cave' ? .56 : th === 'night' ? .2 : 0; if (!dark) return;
    if (!Game.lightMask) { Game.lightMask = document.createElement('canvas'); Game.lightMask.width = W; Game.lightMask.height = H; }
    const m = Game.lightMask.getContext('2d'); m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, W, H); m.fillStyle = th === 'cave' ? 'rgba(12,6,24,' + dark + ')' : 'rgba(4,8,24,' + dark + ')'; m.fillRect(0, 0, W, H);
    m.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, k = 1) => { for (let i = 3; i >= 1; i--) { m.fillStyle = 'rgba(0,0,0,' + (k * (i === 3 ? .35 : i === 2 ? .5 : .9)) + ')'; m.beginPath(); m.arc(Math.round(x - camX), Math.round(y - camY), r * i / 3, 0, Math.PI * 2); m.fill(); } };
    const fl = 1 + Math.sin(Game.t / 5) * .05;
    hole(Player.x + 5, Player.y + 9, 58 * fl);
    for (const e of L.ents) {
      if (e.dead) continue;
      if (e.kind === 'lantern' && L.lit.has(e.id)) hole(e.x + 5, e.y + 5, 46 * fl);
      else if (e.kind === 'pearl') hole(e.x + 3, e.y + 3, 12);
      else if (e.kind === 'boat') hole(e.x + 14, e.y - 4, 34 * fl);
      else if (e.kind === 'anchor') hole(e.x + 5, e.y + 5, 10);
      else if (e.kind === 'maestro') hole(e.x + e.w / 2, e.y + e.h / 2, 30 * fl);
      else if (e.kind === 'pinwheel' && e.spin > 0) hole(e.x + 8, e.y + 8, 18);
    }
    for (const p of L.projs) if (p.kind === 'agua') hole(p.x + 4, p.y + 4, 10);
    if (L.bg && L.bg.glowScreen) for (const [x, y, r] of L.bg.glowScreen) hole(x + camX, y + camY, r, .55);
    // Glowing fungi growing on the earth.
    if (Game.terrain && Game.terrain.glow) for (const q of Game.terrain.glow) if (q.x > camX - 20 && q.x < camX + W + 20 && q.y > camY - 20 && q.y < camY + H + 20) hole(q.x, q.y, 15 + Math.sin(Game.t / 20 + q.x) * 1.5, .7);
    const x0 = Math.max(0, camX >> 4), x1 = Math.min(L.w - 1, (camX + W) >> 4), y0 = Math.max(0, camY >> 4), y1 = Math.min(L.h - 1, (camY + H) >> 4);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const ch = L.t[ty][tx]; if (ch === 'F') hole(tx * TS + 8, ty * TS + 8, 40 * fl); else if (ch === '%') hole(tx * TS + 8, ty * TS + 10, 16, .8); else if (ch === 'T' && L.hitTargets.has(key(tx, ty))) hole(tx * TS + 8, ty * TS + 8, 14); }
    g.drawImage(Game.lightMask, 0, 0);
  },
  // A wavy ribbon of water between two points: dark edges, light core, bright beads sliding along.
  drawStream(g, x0, y0, x1, y1, t, alpha = 1, width = 3) {
    // The jet and the sip: a column from (x0,y0) to (x1,y1) that widens where it lands, highlights running along it.
    const len = Math.hypot(x1 - x0, y1 - y0); if (len < 2) return;
    const pts = []; for (let k = 0; k <= 4; k++) pts.push({ x: x1 + (x0 - x1) * k / 4, y: y1 + (y0 - y1) * k / 4 });
    Water.ribbon(g, pts, Math.abs(t), { w0: width * 1.5, w1: width * 1.05, flow: t < 0 ? 1 : -1, alpha: alpha < 1 ? alpha : undefined, wobble: .8 });
  },
  drawWords(g) {
    for (const w of L.words) {
      const t = w.t / w.life; const rise = w.big ? Math.min(6, w.t * .6) : Math.min(8, w.t * .5);
      const x = Math.round(w.x - Cam.x + (w.drift || 0) * w.t), y = Math.round(w.y - Cam.y - rise);
      g.globalAlpha = t > .7 ? (1 - t) / .3 : 1;
      // Shouts in the Letra Gorda: they land with a punch (big ones) or a small pop, and wobble a touch.
      const s = w.t < 4 ? 1 + (4 - w.t) * (w.big ? .3 : .12) : 1; g.save(); g.translate(x, y - 4); g.scale(s, s); g.rotate(Math.sin(w.wob + w.t * .1) * (w.big ? .07 : .03)); Letra.bold(g, w.text, 0, -4, { color: w.color, align: 'center' }); g.restore();
      g.globalAlpha = 1;
    }
  },
  // The suction: a vortex along the aim. Rings of pull travel to the mouth and narrow, streaks spiral
  // round the axis (bright in front, dim behind) speeding up as they arrive, and a small whirl turns
  // at Bigotes' lips. It grows in over the first frames; drinking, it turns sea-green.
  drawSuction(g) {
    const p = Player, m = p.mouth(), a = p.aim(); if (p.grapple) return;
    const lv = p.suckLv || 1, mx = m.x - Cam.x, my = m.y - Cam.y, nx = -a.y, ny = a.x, len = p.suckLen || 64, t = Game.t, ramp = Math.min(1, (p.suckT || 0) / 10);
    const wet = !!p.waterSrc, top = lv === 3 && !wet;
    const C1 = wet ? '#8fe0d0' : top ? '#ffffff' : lv === 2 ? '#e8f8ff' : '#dff2fb', C2 = wet ? '#4ab0a8' : top ? '#9fdcf0' : '#a8d0e4', C3 = wet ? '#e8fff8' : top ? '#fff6d6' : '#ffffff';
    const coneK = [.5, .6, .75][lv - 1], half = d => 4 + d * coneK, speed = 1 + (lv - 1) * .45;
    // A faint body of moving air, denser at every step.
    g.globalAlpha = (.05 + lv * .035) * ramp; g.fillStyle = C1; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + a.x * len + nx * half(len), my + a.y * len + ny * half(len)); g.lineTo(mx + a.x * len - nx * half(len), my + a.y * len - ny * half(len)); g.closePath(); g.fill();
    // Rings of pull.
    const rings = 3 + lv;
    for (let i = 0; i < rings; i++) {
      const u = 1 - ((t * .045 * speed + i / rings) % 1), d = u * len, w = half(d), cx = mx + a.x * d, cy = my + a.y * d;
      g.globalAlpha = ramp * (.25 + (1 - u) * .65); g.fillStyle = C1;
      for (let k = 0; k < 28; k++) { const an = k / 28 * Math.PI * 2, lat = Math.cos(an) * w, dep = Math.sin(an) * w * .22; if (Math.sin(an) < -.2 && (k & 1)) continue; g.fillRect(Math.round(cx + nx * lat + a.x * dep), Math.round(cy + ny * lat + a.y * dep), 1, 1); }
    }
    // Spiral streaks.
    const streaks = 5 + lv * 4;
    for (let i = 0; i < streaks; i++) {
      const ph = i * 2.3, head = (t * .03 * speed * (1 + (i % 3) * .15) + i / streaks) % 1;
      for (let j = 0; j < 12; j++) {
        const q = head - j * .012 * (1 + head * 1.5); if (q < 0) break;
        const d = (1 - q) * len, spin = q * 10 + ph + t * .12, lat = Math.sin(spin) * half(d) * .85, front = Math.cos(spin);
        g.globalAlpha = ramp * (1 - j / 12) * (front > 0 ? .9 : .35) * Math.min(1, q * 4);
        g.fillStyle = j === 0 ? C3 : front > 0 ? C1 : C2;
        const sz = j === 0 && front > 0 ? 2 : 1; g.fillRect(Math.round(mx + a.x * d + nx * lat), Math.round(my + a.y * d + ny * lat), sz, sz);
      }
    }
    // The whirl at the lips and a pulsing core.
    for (let k = 0; k < 3; k++) for (let s2 = 1; s2 < 8; s2++) { const r = s2 * .75, an = -t * .45 + k * 2.09 + s2 * .55; g.globalAlpha = ramp * (1 - s2 / 9); g.fillStyle = s2 < 3 ? C3 : C1; g.fillRect(Math.round(mx + a.x * 3 + Math.cos(an) * r), Math.round(my + a.y * 3 + Math.sin(an) * r * .8), 1, 1); }
    g.globalAlpha = ramp * (.5 + Math.sin(t * .6) * .3); g.fillStyle = C3; g.fillRect(Math.round(mx + a.x * 2) - 1, Math.round(my + a.y * 2) - 1, 2, 2);
    // Full blast: long wind lines rushing in along the edges of the cone, with golden flecks.
    if (lv === 3) for (let i = 0; i < 6; i++) {
      const u = 1 - ((t * .07 + i / 6) % 1), d = u * len, side = i & 1 ? 1 : -1, lat = side * half(d) * (.55 + (i % 3) * .15);
      g.globalAlpha = ramp * Math.min(1, u * 3) * .8; g.fillStyle = i % 3 === 0 ? '#f2c46a' : C1;
      for (let j = 0; j < 6; j++) { const dd = d + j * 1.5; g.fillRect(Math.round(mx + a.x * dd + nx * lat * (dd / Math.max(1, d))), Math.round(my + a.y * dd + ny * lat * (dd / Math.max(1, d))), 1, 1); }
    }
    // The step-up: a bright shock ring racing out to the new reach.
    if (p.suckPulse > 0) {
      const k = 1 - p.suckPulse / 16, d = k * len, w = half(d) + 2, cx = mx + a.x * d, cy = my + a.y * d;
      g.globalAlpha = (1 - k) * .9; g.fillStyle = lv === 3 ? '#fff6d6' : '#ffffff';
      for (let q = 0; q < 36; q++) { const an = q / 36 * Math.PI * 2, lat = Math.cos(an) * w, dep = Math.sin(an) * w * .25; g.fillRect(Math.round(cx + nx * lat + a.x * dep), Math.round(cy + ny * lat + a.y * dep), 2, 1); }
    }
    g.globalAlpha = 1;
  },
  // The gust: curling streaks that fan out and a pale front, ending in little spirals.
  drawGusts(g) {
    for (const q of L.gusts || []) {
      const t = q.t, reach = q.front, fade = t < 14 ? 1 : Math.max(0, 1 - (t - 14) / 7), x0 = q.x0 - Cam.x, y0 = q.y - Cam.y, d = q.dir;
      // A faint cone of moving air behind the streaks.
      const halfF = 9 + reach * .22; g.globalAlpha = fade * .1; g.fillStyle = '#e8f6ff'; g.beginPath(); g.moveTo(x0, y0 - 3); g.lineTo(x0 + d * reach, y0 - halfF); g.lineTo(x0 + d * (reach + 5), y0); g.lineTo(x0 + d * reach, y0 + halfF); g.lineTo(x0, y0 + 3); g.fill(); g.globalAlpha = 1;
      for (let s = 0; s < 7; s++) {
        const lane = (s - 3) / 3, len = reach * (.72 + ((s * 37 + q.seed) % 10) / 34), tail = Math.max(0, len - 34 - (s % 3) * 5);
        for (let u = tail; u < len; u += 1) {
          const k = (u - tail) / Math.max(1, len - tail), spread = 3 + u * .2, y = y0 + lane * spread + Math.sin(u * .22 + s * 1.7 - t * .6) * (1.2 + u * .03);
          g.globalAlpha = fade * (.3 + k * .7); g.fillStyle = k > .75 ? '#ffffff' : s % 2 ? '#dff2fb' : '#a8d4ea'; g.fillRect(Math.round(x0 + d * u), Math.round(y), 1, k > .45 && s % 3 !== 1 ? 2 : 1);
        }
        // Curl at the tip of the outer streaks.
        if (s % 2 === 0 && t > 4) { const cx = x0 + d * len, cy = y0 + lane * (3 + len * .2), r = 2 + Math.min(3, t * .2); for (let a = 0; a < 5.5; a += .35) { g.globalAlpha = fade * (.3 + a / 8); g.fillStyle = '#eef8ff'; g.fillRect(Math.round(cx + d * Math.cos(a + t * .5) * r * (1 - a / 8)), Math.round(cy + Math.sin(a + t * .5) * r * (1 - a / 8)), 1, 1); } }
      }
      // The front: a pale crescent that widens as it goes.
      const half = 9 + reach * .22; for (let yy = -half; yy <= half; yy++) { const k = yy / half, xx = x0 + d * (reach + (1 - k * k) * 4); g.globalAlpha = fade * .8 * (1 - Math.abs(k) * .5); g.fillStyle = '#ffffff'; g.fillRect(Math.round(xx), Math.round(y0 + yy), Math.abs(k) < .6 ? 2 : 1, 1); }
      g.globalAlpha = 1;
    }
  },
  drawParts(g) {
    for (const p of L.parts) {
      const x = Math.round(p.x - Cam.x), y = Math.round(p.y - Cam.y);
      if (p.kind === 'puff') { g.drawImage(ART.puff[p.life > 6 ? 1 : 0], x, y); continue; }
      if (p.kind === 'suck') { const m = Player.mouth(), dx = m.x - p.x, dy = m.y - p.y, dd = Math.hypot(dx, dy) || 1, tl = Math.min(5, 2 + (60 - dd) / 12); g.fillStyle = p.color; g.fillRect(x, y, 1, 1); g.globalAlpha = .6; for (let k = 1; k < tl; k++) g.fillRect(Math.round(x - dx / dd * k), Math.round(y - dy / dd * k), 1, 1); g.globalAlpha = 1; continue; }
      if (p.kind === 'rain') { g.fillStyle = p.color; g.fillRect(x, y, 1, 2); g.fillRect(x + 1, y - 2, 1, 2); continue; }
      if (p.kind === 'cria') { const sp = ART.criaFree[(p.life >> 2) % 2]; g.globalAlpha = Math.min(1, p.life / 14); g.drawImage(p.vx < 0 ? ART.flip(sp) : sp, x, y); g.globalAlpha = 1; continue; }
      if (p.kind === 'feather') { g.fillStyle = p.color; g.fillRect(x + Math.round(Math.sin(p.life / 5) * 2), y, 2, 1); continue; }
      if (p.kind === 'ripple') { const r = Math.max(.5, (16 - p.life) * 1.1 + 2); g.strokeStyle = p.color; g.globalAlpha = Math.min(1, p.life / 16); g.beginPath(); g.ellipse(x, y, r, r * .35, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; continue; }
      if (p.kind === 'puddle') { g.globalAlpha = Math.min(1, p.life / 40) * .6; g.fillStyle = '#2f7f88'; g.beginPath(); g.ellipse(x, y, p.size, 1.5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#8fd9d0'; g.fillRect(x - p.size / 2, y - 1, Math.max(1, p.size / 2), 1); g.globalAlpha = 1; continue; }
      if (p.kind === 'ring') { const r = Math.max(.5, (8 - p.life) * 1.6 + 2); g.strokeStyle = p.color; g.globalAlpha = Math.min(1, p.life / 8); g.beginPath(); g.ellipse(x + 8, y, r, r * .45, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; continue; }
      if (p.kind === 'smoke') { g.globalAlpha = Math.min(1, p.life / 20) * .8; g.fillStyle = p.color; const sz = p.life > 30 ? 2 : 3; g.fillRect(x, y, sz, sz); g.globalAlpha = 1; continue; }
      if (p.kind === 'amb') { g.globalAlpha = .35 + Math.sin(p.life / 9 + p.ph) * .35; g.fillStyle = p.color; g.fillRect(x, y, 1, 1); g.globalAlpha = 1; continue; }
      if (p.kind === 'fly') { const a = Math.max(0, Math.sin(p.life / 11 + p.ph)) * Math.min(1, p.life / 30); if (a > .05) { g.fillStyle = p.color; g.globalAlpha = a * .3; g.fillRect(x - 1, y - 1, 3, 3); g.globalAlpha = a * .5; g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5); g.globalAlpha = Math.min(1, a * 1.4); g.fillStyle = '#ffffe0'; g.fillRect(x, y, 1, 1); g.globalAlpha = 1; } continue; }
      if (p.kind === 'drip') { g.fillStyle = p.color; g.fillRect(x, y, 1, 2); continue; }
      if (p.kind === 'spray') { g.fillStyle = p.color; g.fillRect(x, y, 1, 1); const sp = Math.hypot(p.vx, p.vy); if (sp > 1.2) g.fillRect(Math.round(x - p.vx / sp * 1.5), Math.round(y - p.vy / sp * 1.5), 1, 1); continue; }
      if (p.kind === 'mist') { const k = p.life / (p.max || 20), sz = k > .6 ? 1 : k > .3 ? 2 : 3; g.globalAlpha = k * .55; g.fillStyle = p.color; g.fillRect(x - (sz >> 1), y - (sz >> 1), sz, sz); g.globalAlpha = 1; continue; }
      if (p.kind === 'wring') { const k = 1 - p.life / p.max, r = (2 + k * 9) * (p.big || 1); g.globalAlpha = (1 - k) * .9; g.fillStyle = p.color; const ca = Math.cos(p.flat ? Math.atan2(p.ny, p.nx) : p.ang), sa = Math.sin(p.flat ? Math.atan2(p.ny, p.nx) : p.ang); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, ex = Math.cos(a) * r * .35, ey = Math.sin(a) * r; g.fillRect(Math.round(x + ex * ca - ey * sa), Math.round(y + ex * sa + ey * ca), 1, 1); } g.globalAlpha = 1; continue; }
      if (p.kind === 'wetrun') { const k = Math.min(1, p.life / 40), y0 = Math.round((p.y0 || p.y) - Cam.y); g.globalAlpha = k * .5; g.fillStyle = '#2a8a90'; g.fillRect(x, y0, 1, Math.max(1, y - y0)); g.globalAlpha = k; g.fillStyle = p.color; g.fillRect(x, y, 1, 2); g.fillStyle = '#dffcf6'; g.fillRect(x, y, 1, 1); g.globalAlpha = 1; continue; }
      if (p.kind === 'leaf') { g.fillStyle = p.color; g.fillRect(x, y, 2, 1); if ((p.life >> 2) & 1) g.fillRect(x + 1, y - 1, 1, 1); continue; }
      g.fillStyle = p.color; g.fillRect(x, y, p.size, p.size);
    }
  },
  drawHud(g) {
    Hud.draw(g);
    Maestros.drawOverlay(g);
    if (Game.hurtFlash > 0) { g.fillStyle = 'rgba(220,60,60,' + (Game.hurtFlash / 14 * .28) + ')'; g.fillRect(0, 0, W, H); }
    if (Game.banner > 0 && !Game.capture) {
      const t = Game.banner; const a = t > 170 ? (190 - t) / 20 : t < 30 ? t / 30 : 1;
      const lines = ART.wrap(L.def.intro || (L.def.boss ? 'Devuélvele las piedras' : 'Llega a la barca'), W - 60), bh = 20 + lines.length * 10, by = 84 - bh / 2;
      g.globalAlpha = a; g.fillStyle = '#1b2430'; g.fillRect(0, by, W, bh); g.fillStyle = '#e79b3f'; g.fillRect(0, by, W, 1); g.fillRect(0, by + bh - 1, W, 1);
      ART.title(g, (Game.level + 1) + ' · ' + L.def.name, W / 2, by + 5, '#fff6d6', 'center'); lines.forEach((l, k) => ART.text(g, l, W / 2, by + 18 + k * 10, '#9fc0cc', 'center')); g.globalAlpha = 1;
    }
    if (Game.toastT > 0) { const a = Math.min(1, Game.toastT / 20); g.globalAlpha = a; ART.title(g, Game.toastText, W / 2, 28, '#fff6d6', 'center'); g.globalAlpha = 1; }
    if (Player.nearSign && !Player.dead && !Maestros.busy() && !Game.learning) {
      // The sign's words on a wooden board above the sign, in the Glup letters; it pops up when you arrive.
      const e = Player.nearSign; if (Game.signFor !== e) { Game.signFor = e; Game.signT = 0; } Game.signT++;
      const str = Game.signText(null, Game.noteRaw(e)), lines = Letra.wrap(str, 210), tw = Math.max(...lines.map(Letra.width)), w = tw + 20, h = lines.length * Letra.LINE + 10;
      const sx = Math.round(e.x + 7 - Cam.x), sy = Math.round(e.y - Cam.y);
      let bx = Math.max(6, Math.min(W - w - 6, sx - Math.round(w / 2))), by = sy - h - 14; if (by < 22) by = sy + 22;
      const k = Math.min(1, Game.signT / 8), sc = .4 + .6 * (1 - Math.pow(1 - k, 3)) + Math.sin(k * Math.PI) * .1;
      g.save(); g.translate(sx, by + h); g.scale(sc, sc); g.translate(-sx, -(by + h));
      const O = '#2a1a14';
      if (by < sy) { g.fillStyle = O; g.fillRect(sx - 2, by + h, 4, sy - by - h); g.fillStyle = '#6b4a30'; g.fillRect(sx - 1, by + h, 2, sy - by - h); }
      g.fillStyle = 'rgba(8,6,14,.35)'; g.fillRect(bx + 3, by + 3, w, h);
      g.fillStyle = O; g.fillRect(bx - 1, by - 1, w + 2, h + 2);
      g.fillStyle = '#8a5a34'; g.fillRect(bx, by, w, h);
      for (let yy = by + 5; yy < by + h - 2; yy += 6) { g.fillStyle = '#6e4630'; g.fillRect(bx, yy, w, 1); }
      g.fillStyle = '#b07848'; g.fillRect(bx, by, w, 2); g.fillStyle = '#5a3a24'; g.fillRect(bx, by + h - 2, w, 2);
      g.fillStyle = '#e8d8b0'; for (const [nx, ny] of [[bx + 2, by + 3], [bx + w - 3, by + 3], [bx + 2, by + h - 4], [bx + w - 3, by + h - 4]]) g.fillRect(nx, ny, 1, 1);
      lines.forEach((l, i) => Letra.text(g, l, bx + Math.round((w - Letra.width(l)) / 2), by + 5 + i * Letra.LINE, { color: '#fff4dc', light: '#ffffff', shadow: '#3a2418' }));
      g.restore();
    }
  },
  pauseRows() { return [70, 88, 106]; },
  drawPause(g) {
    g.fillStyle = 'rgba(8,10,16,.72)'; g.fillRect(0, 0, W, H);
    ART.title(g, 'Pausa', W / 2, 38, '#e79b3f', 'center');
    const items = ['Seguir', 'Sonido: ' + (Sound.isMuted() ? 'no' : 'sí'), 'Salir al mapa'], rows = Game.pauseRows();
    items.forEach((it, i) => { const sel = i === Game.pauseSel; ART.text(g, (sel ? '► ' : '') + it, W / 2, rows[i], sel ? '#fff6d6' : '#9fc0cc', 'center'); });
    const known = POWER_ORDER.filter(Game.has); ART.wrap(known.length ? 'Bigotes sabe: ' + known.map(k => POWERS[k].name).join(', ') : 'Bigotes aún no sabe trucos', W - 40).slice(0, 2).forEach((ln, i) => ART.text(g, ln, W / 2, 122 + i * 9, '#9fc0cc', 'center'));
    ART.text(g, Touch.enabled ? 'Toca una opción' : 'Flechas y Z', W / 2, 150, '#5f7899', 'center');
  },
  // ---- title & menus
  drawScene(g, t, theme) {
    // A dock at dusk: reflections shimmer on the water and fireflies wander.
    const bg = ART.background(theme); Game.drawBackground(g, 40 + t * .15, 44, bg);
    MUNDO.drawScene(g, t, theme, W, H);
  },
  drawTitle(g) { Title.draw(g, Game.titleT); },
  drawSelect(g) { Mapa.draw(g, Game.t, Game.sel); },
  fmtTime(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  drawClear(g) { Victoria.drawClear(g); },
  drawEnding(g) {
    const t = Game.endT; Game.drawScene(g, t, 'dusk');
    // The boat crosses the water with the two aboard; the credits float above.
    const bx = -40 + Math.min(t * .5, 200); const bob = Math.round(Math.sin(t / 22) * 1.5);
    g.drawImage(ART.boat, Math.round(bx), 130 + bob);
    // The rescued crías swim in the boat's wake.
    for (let i = 0; i < 10; i++) { const fx = Math.round(bx - 12 - i * 11 + Math.sin(t / 9 + i) * 3), fy = 150 + (i % 3) * 7 + Math.round(Math.sin(t / 13 + i * 2)); if (fx > -8) g.drawImage(ART.criaFree[((t >> 3) + i) % 2], fx, fy); }
    Player.carryLook = { mood: 'sleep' }; Player.drawCarry(g, Math.round(bx) + 10, 114 + bob, ART.nila.idle[(t % 200) < 6 ? 1 : 0], ART.fish.closed); Player.carryLook = null;
    g.fillStyle = 'rgba(8,10,16,.55)'; g.fillRect(0, 0, W, 100);
    const lines = ['La Garza voló lejos, a otro río,', 'y las crías volvieron nadando a casa.', '', 'Nila remó hasta el embarcadero', 'con Bigotes dormido en el regazo.', '', 'GRACIAS POR JUGAR'];
    const { got: tot, all } = Save.criasAll();
    lines.forEach((l, i) => { if (t > 20 + i * 18) ART.text(g, l, W / 2, 14 + i * 11, i === 6 ? '#f2c46a' : '#fff6d6', 'center'); });
    if (t > 160) ART.text(g, 'Crías rescatadas: ' + tot + '/' + all, W / 2, 168, '#9ecbd8', 'center', '#1b2430');
    if (t > 120 && (t >> 5) % 2) ART.text(g, Touch.enabled ? 'Toca para volver' : 'Z para volver', W - 6, 104, '#9fc0cc', 'right');
  },
  // ---- development scenes
  drawSprites(g) {
    g.fillStyle = '#6a7a8a'; g.fillRect(0, 0, W, H);
    if (Game.capture.scene === 'maestros') { Maestros.sheet(g, Game.t); return; }
    if (Game.capture.scene === 'zoom') { g.imageSmoothingEnabled = false; let x = 4, y = 4; for (const s of Game.zoomList()) { if (x + s.width * 3 > W) { x = 4; y += 50; } g.drawImage(s, x, y, s.width * 3, s.height * 3); x += s.width * 3 + 6; } return; }
    const items = [ART.nila.idle[0], ART.nila.idle[1], ART.nila.run[1], ART.nila.run[2], ART.nila.jump, ART.nila.fall, ART.nila.hurt, ART.nila.win, ART.fish.closed, ART.fish.open, ART.fish.full, ART.fish.spit, ART.fish.swallow, ART.hand,
      ART.snail[0], ART.snail[1], ART.frogSit, ART.frogJump, ART.mosquito[0], ART.mosquito[1], ART.crab[0], ART.crab[1], ART.crate, ART.rock, ART.cria[0], ART.cria[1], ART.cria[2], ART.criaFree[0], ART.ruca.idle, ART.ruca.blink, ART.ruca.talk, ART.bubble, ART.heart, ART.heartEmpty, ART.lantern.off, ART.lantern.on, ART.sign, ART.boat, ART.mushroom, ART.mushroomSquash, ART.thorns, ART.gate, ART.target.off, ART.target.on, ART.lily, ART.plank, ART.cracked, ART.dirt[0], ART.dirt[1], ART.grassCap[0], ART.grassCap[1], ART.roots, ART.water[0], ART.water[2], ART.waterDeep, ART.reed, ART.tuft, ART.shroomDeco, ART.egg, ART.puff[1], ART.star];
    let x = 2, y = 2, rowH = 0;
    for (const s of items) { if (x + s.width > W - 2) { x = 2; y += rowH + 3; rowH = 0; } g.drawImage(s, x, y); x += s.width + 3; rowH = Math.max(rowH, s.height); }
    y += rowH + 4; g.drawImage(ART.heronBody, 2, y); g.drawImage(ART.heronFly, 40, y); g.drawImage(ART.wingUp, 80, y); g.drawImage(ART.wingDown, 112, y); g.drawImage(ART.wingMid, 144, y);
    g.drawImage(ART.logo(), 180, y); ART.text(g, 'ÁÉÍÓÚÑ ¡HOLA! ¿QUÉ? 0123456789 ·,.:-+', 2, H - 10, '#fff');
  },
  zoomList() { const N = ART.nila; return [N.idle[0], N.run[0], N.run[2], N.jump, N.fall, N.brace, N.spit, N.tuck, N.hurt, N.win, ART.fish.closed, ART.fish.open, ART.fish.full, ART.fish.spit, ART.hand, ART.snail[0], ART.frogSit, ART.mosquito[0], ART.crab[0], ART.ruca.idle, ART.cria[0], ART.criaFree[0], ART.egg]; },
  drawIcon(g) {
    // Square badge 180×180 centred on the canvas; tools/iconos.sh crops and scales it.
    const ox = 70, S = 180; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const bg = ART.background('dusk'); g.drawImage(bg.sky, 70, 0, S, S, ox, 0, S, S);
    g.drawImage(bg.mid, 0, 40, 320, 110, ox, 60, S, 62);
    g.fillStyle = '#2f7f88'; g.fillRect(ox, 122, S, 58); g.fillStyle = '#246270'; g.fillRect(ox, 140, S, 40); g.fillStyle = '#1d4a55'; g.fillRect(ox, 160, S, 20);
    g.fillStyle = '#8fd9d0'; for (let x = 0; x < S; x += 4) g.fillRect(ox + x, 122 + (x % 8 ? 1 : 0), 3, 1);
    g.fillStyle = '#fff8e0'; for (let i = 0; i < 6; i++) g.fillRect(ox + 118 - i * 2, 128 + i * 6, 18 + i * 3, 1);
    g.save(); g.translate(ox + 90, 118); g.scale(4, 4); g.translate(-90, -118);
    Player.drawCarry(g, 70, 99, ART.nila.idle[0], ART.fish.full);
    g.restore();
  }

};

addEventListener('DOMContentLoaded', () => Game.init());
