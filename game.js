// GLUP — motor del juego: entrada, física, entidades, cámara, dibujo y estados.
'use strict';
const W = 320, H = 180, TS = 16;
const $ = id => document.getElementById(id);
const params_debug = () => /(?:\?|&)debug=1/.test(location.search);

// ---------------------------------------------------------------- Entrada
const Input = {
  held: {}, pressed: {}, keyHeld: {}, padHeld: {}, touchHeld: {}, mode: 'keys', anyKey: false, padSeen: false,
  KEYS: { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    KeyZ: 'jump', KeyK: 'jump', Space: 'jump', KeyX: 'fish', KeyJ: 'fish', KeyC: 'fish', Enter: 'confirm', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', KeyF: 'fullscreen' },
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
    const next = { left: b(14) || ax < -.4, right: b(15) || ax > .4, up: b(12) || ay < -.5, down: b(13) || ay > .5, jump: b(0), fish: b(2) || b(1) || b(5) || b(7), pause: b(9), confirm: b(0) };
    let any = false;
    for (const a in next) { if (next[a] && !Input.padHeld[a]) { Input.press(a); any = true; } Input.padHeld[a] = next[a]; if (next[a]) any = true; }
    if (any) Input.mode = 'pad';
    Input.sync();
  },
  endFrame() { Input.pressed = {}; },
  rumble(ms, strong, weak) {
    if (Game.still || !navigator.getGamepads) return;
    for (const p of navigator.getGamepads()) { const a = p && p.vibrationActuator; if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => { }); }
  }
};

// Touch shell: the HTML buttons around or over the canvas feed the same actions.
const Touch = {
  enabled: false, portrait: false, pointers: new Map(), buttons: [],
  forced: /(?:\?|&)touch=1(?:&|$)/.test(location.search),
  init() {
    Touch.buttons = [...document.querySelectorAll('[data-act]')];
    for (const b of Touch.buttons) {
      const act = b.dataset.act;
      b.addEventListener('pointerdown', e => { e.preventDefault(); if (act === 'pause' || act === 'mute' || act === 'fullscreen') { Sound.init(); Input.press(act); Input.mode = 'touch'; return; } Touch.pointers.set(e.pointerId, act); b.setPointerCapture && b.setPointerCapture(e.pointerId); Touch.apply(); });
      const end = e => { if (Touch.pointers.has(e.pointerId)) { Touch.pointers.delete(e.pointerId); Touch.apply(); } };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end); b.addEventListener('lostpointercapture', end);
      b.addEventListener('contextmenu', e => e.preventDefault());
    }
    // Sliding a thumb across the pad switches direction without lifting.
    const pad = $('touch-pad');
    pad.addEventListener('pointermove', e => {
      if (!Touch.pointers.has(e.pointerId)) return; const r = pad.getBoundingClientRect();
      const act = e.clientX < r.left + r.width / 2 ? 'left' : 'right';
      if (Touch.pointers.get(e.pointerId) !== act) { Touch.pointers.set(e.pointerId, act); Touch.apply(); }
    });
    Touch.layout(); addEventListener('resize', Touch.layout);
  },
  apply() {
    const held = new Set(Touch.pointers.values());
    for (const a of ['left', 'right', 'up', 'down', 'jump', 'fish']) {
      const now = held.has(a); if (now && !Input.touchHeld[a]) { Input.press(a); Input.mode = 'touch'; } Input.touchHeld[a] = now;
    }
    for (const b of Touch.buttons) b.classList.toggle('held', held.has(b.dataset.act));
    Input.sync();
  },
  release() { Touch.pointers.clear(); for (const b of Touch.buttons) b.classList.remove('held'); },
  layout() {
    const coarse = matchMedia('(any-pointer: coarse)').matches;
    Touch.enabled = Touch.forced || coarse || (innerWidth <= 900 && innerHeight <= 500);
    Touch.portrait = innerHeight > innerWidth;
    document.body.classList.toggle('touch', Touch.enabled);
    document.body.classList.toggle('portrait', Touch.enabled && Touch.portrait);
    Screen.fit();
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
  data: { unlocked: 0, pearls: {}, totals: {}, best: {}, mute: false, finished: false },
  load() { try { const s = localStorage.getItem('glup.v1'); if (s) Object.assign(Save.data, JSON.parse(s)); } catch (e) { } },
  write() { try { localStorage.setItem('glup.v1', JSON.stringify(Save.data)); } catch (e) { } }
};

// ---------------------------------------------------------------- Utilidades
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rnd = (a, b) => a + Math.random() * (b - a);
const key = (x, y) => x + ',' + y;

// ---------------------------------------------------------------- Nivel
const L = { rows: null, t: null, w: 0, h: 0, def: null, index: 0, ents: [], projs: [], parts: [], solids: [], signs: [], broken: new Set(), targets: new Map(), gates: [], gateOpen: new Set(), lit: new Set(), taken: new Set(), start: null, checkpoint: null, pearlsTotal: 0, pearls: 0, time: 0, bg: null, boss: null, breakQueue: [], gateQueue: [], mush: new Map(), hitTargets: new Set(), boatSpawned: false, exit: null, words: [], ghosts: [], lily: new Map(), triggerIdx: new Map() };
const SOLID = { '#': 1, 'x': 1, 'G': 1, 'X': 1 };
function tileAt(tx, ty) { if (tx < 0 || tx >= L.w) return '#'; if (ty < 0 || ty >= L.h) return '.'; return L.t[ty][tx]; }
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
    const top = ty * TS + (ch === '%' ? 6 : 0); if (b0 <= top && b1 > top) return { top, ch, tx, ty };
  }
  for (const s of L.solids) if (s !== self && !s.dead && s.platform && x < s.x + s.w && x + w > s.x && b0 <= s.y + (s.vx ? Math.abs(s.vx) + 1 : 0) && b1 > s.y) return { top: s.y, ch: s.kind, ent: s };
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
    if (rectSolid(e.x, ny, e.w, e.h, e)) return { solid: true };
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
  L.lit = new Set(); L.taken = new Set(); L.pearlsTotal = 0; L.pearls = 0; L.time = 0; L.boss = null; L.breakQueue = []; L.gateQueue = []; L.mush = new Map(); L.hitTargets = new Set(); L.boatSpawned = false; L.exit = null; L.words = []; L.ghosts = []; L.lily = new Map(); L.triggerIdx = new Map();
  L.bg = ART.background(def.theme); L.spawn = [];
  // Gates are grouped by adjacency and paired with targets in reading order.
  const targets = [], gateTiles = [], seen = new Set();
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const ch = L.t[y][x];
    if (ch === '@') { L.start = { x: x * TS + 3, y: y * TS - 4 }; L.t[y][x] = '.'; }
    else if ('sfmKcr*HL?EBOR'.includes(ch)) { L.spawn.push({ ch, x, y }); L.t[y][x] = '.'; if (ch === '*') L.pearlsTotal++; }
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
  spawnEntities(); Player.reset(L.start.x, L.start.y, true);
  Cam.snap();
}
function spawnEntities() {
  L.ents = []; L.projs = []; L.parts = []; L.solids = []; L.signs = []; L.boss = null; let signIdx = 0;
  for (const s of L.spawn) {
    const px = s.x * TS, py = s.y * TS;
    switch (s.ch) {
      case 's': L.ents.push(Enemy.snail(px + 1, py + 5)); break;
      case 'f': L.ents.push(Enemy.frog(px + 2, py + 5)); break;
      case 'm': L.ents.push(Enemy.mosquito(px + 3, py + 4)); break;
      case 'K': L.ents.push(Enemy.crab(px, py + 6)); break;
      case 'c': L.ents.push(Item.crate(px + 1, py + 2)); break;
      case 'r': L.ents.push(Item.rock(px + 2, py + 6)); break;
      case '*': if (!L.taken.has(key(s.x, s.y))) L.ents.push(Item.pearl(px + 4, py + 4, key(s.x, s.y), solidChar(tileAt(s.x, s.y + 1)))); break;
      case 'H': if (!L.taken.has(key(s.x, s.y))) L.ents.push(Item.heart(px + 3, py + 4, key(s.x, s.y))); break;
      case 'L': L.ents.push(Item.lantern(px + 3, py - 2, key(s.x, s.y))); break;
      case '?': L.ents.push(Item.sign(px + 1, py + 4, signIdx++)); break;
      case 'E': L.ents.push(Item.boat(px - 8, py + 14)); break;
      case 'B': L.boss = Boss.create(px, py - 40); L.ents.push(L.boss); break;
      case 'O': L.ents.push(Item.anchor(px + 3, py + 3)); break;
      case 'P': L.ents.push(Item.plate(px, py + 11, L.triggerIdx.get(key(s.x, s.y)))); break;
      case 'V': L.ents.push(Item.pinwheel(px, py, L.triggerIdx.get(key(s.x, s.y)))); break;
      case 'R': L.ents.push(Item.raft(px, py + 12)); break;
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
    if (p.kind === 'suck') { const m = Player.mouth(); const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1; p.vx = dx / d * 3.2; p.vy = dy / d * 3.2; if (d < 4) p.life = 0; }
  }
}

// ---------------------------------------------------------------- Nila
const CHARGE_FULL = 40, AMMO_NAMES = { rock: 'Piedra', crate: 'Caja', snail: 'Caracol', frog: 'Rana', mosquito: 'Mosquito', crab: 'Cangrejo', agua: 'Agua' };
const Player = {
  x: 0, y: 0, w: 10, h: 18, vx: 0, vy: 0, dir: 1, onGround: false, coyote: 0, jumpBuf: 0, held: null, sucking: false, suckT: 0, hp: 3, inv: 0, animT: 0, sx: 1, sy: 1,
  dead: false, deadT: 0, spitT: 0, swallowT: 0, blink: 0, hurtT: 0, stepT: 0, dropping: false, win: false, nearSign: null, airT: 0, puffCd: 0, jumpCut: false,
  charge: 0, fishDown: false, fishT: 0, hover: false, waterT: 0, puffT: 0, crouch: false, aimUp: false, grapple: null, hanging: false, carrier: null, dropT: 0, stuck: 0,
  reset(x, y, full) { Object.assign(Player, { x, y, h: 18, vx: 0, vy: 0, dir: 1, onGround: false, held: null, sucking: false, inv: 0, dead: false, deadT: 0, spitT: 0, swallowT: 0, sx: 1, sy: 1, win: false, airT: 0, charge: 0, fishDown: false, fishT: 0, hover: false, waterT: 0, puffT: 0, crouch: false, aimUp: false, grapple: null, hanging: false, carrier: null, dropT: 0, stuck: 0 }); if (full) Player.hp = 3; Sound.suck(false); Sound.jet(false); },
  // Where Bigotes' mouth is: in front of the arm, or above the head when aiming up.
  mouth() { const p = Player; if (p.aimUp) return { x: p.x + 5 + p.dir * 2, y: p.y - 12 }; return { x: p.dir > 0 ? p.x + 27 : p.x - 17, y: p.y + (p.crouch ? 6 : 12) }; },
  aim() { const p = Player; if (p.grapple && !p.hanging) { const m = p.mouth(); const dx = p.grapple.x + 5 - m.x, dy = p.grapple.y + 5 - m.y, d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; } return p.aimUp ? { x: 0, y: -1 } : { x: p.dir, y: 0 }; },
  rect() { return { x: Player.x, y: Player.y, w: Player.w, h: Player.h }; },
  update() {
    const p = Player;
    if (p.dead) { p.deadT++; p.vy += .25; p.y += p.vy; p.x += p.vx; if (p.deadT === 1) { Sound.play('death'); Sound.suck(false); Sound.jet(false); } if (p.deadT > 80) Game.respawn(); return; }
    if (p.win) { p.animT++; p.sx += (1 - p.sx) * .2; p.sy += (1 - p.sy) * .2; return; }
    // Crouch: shorter hitbox; stand back up only with headroom.
    const wantCrouch = Input.held.down && p.onGround && !p.hover && !p.grapple;
    if (wantCrouch && !p.crouch) { p.crouch = true; p.y += 6; p.h = 12; p.sx = 1.15; }
    else if (!wantCrouch && p.crouch && !rectSolid(p.x, p.y - 6, p.w, 18, p)) { p.crouch = false; p.y -= 6; p.h = 18; p.sy = 1.1; }
    const left = Input.held.left, right = Input.held.right, ax = p.onGround ? .22 : .14;
    const busy = p.sucking || p.charge > 8;
    const maxV = p.crouch ? 1.1 : busy ? .7 : 1.7;
    if (p.grapple) { /* Bigotes does the moving */ }
    else if (left && !right) { p.vx = Math.max(p.vx - ax, -maxV); if (!busy) p.dir = -1; }
    else if (right && !left) { p.vx = Math.min(p.vx + ax, maxV); if (!busy) p.dir = 1; }
    else { const f = p.onGround ? .3 : .06; if (Math.abs(p.vx) <= f) p.vx = 0; else p.vx -= Math.sign(p.vx) * f; }
    if ((busy || p.crouch) && Math.abs(p.vx) > maxV) p.vx = Math.sign(p.vx) * maxV;
    // Jump: buffered, with coyote time and a variable height. Jumping lets go of an anchor.
    if (Input.pressed.jump) p.jumpBuf = 7; else if (p.jumpBuf > 0) p.jumpBuf--;
    if (p.onGround || p.hanging) p.coyote = 7; else if (p.coyote > 0) p.coyote--;
    if (p.jumpBuf > 0 && p.coyote > 0 && !p.crouch) {
      p.vy = -5.4; p.jumpCut = true; p.jumpBuf = 0; p.coyote = 0; p.onGround = false; p.sx = .8; p.sy = 1.25; Sound.play('jump');
      if (p.grapple) { Player.letGo(); p.vx = Input.held.left ? -1.7 : Input.held.right ? 1.7 : 0; Game.word('¡HOP!', p.x + 5, p.y - 6, '#fff6d6', false); }
      else spawnParts(5, p.x + 5, p.y + p.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.2, speed: [.5, 1.5], life: [10, 20], g: .05 });
    }
    if (!Input.held.jump && p.jumpCut && p.vy < -1.5) p.vy = -1.5;
    if (p.vy >= 0) p.jumpCut = false;
    if (p.grapple) Player.pull();
    else if (p.hover) p.vy = Math.min(p.vy + .28, .45); else p.vy = Math.min(p.vy + .28, 5.5);
    const hitWall = moveX(p, p.vx); if (hitWall) p.vx = 0;
    const wasGround = p.onGround; p.onGround = false; p.carrier = null;
    const hit = p.grapple ? null : moveY(p, p.vy);
    if (hit) {
      if (p.vy > 0) {
        p.onGround = true; if (hit.ent) p.carrier = hit.ent;
        if (hit.ch === '%') { p.vy = -8.6; p.jumpCut = false; p.onGround = false; p.sx = .7; p.sy = 1.4; L.mush.set(key(hit.tx, hit.ty), 14); Sound.play('bounce'); Cam.punch(1.03); Game.word('¡BOING!', hit.tx * TS + 8, hit.ty * TS - 4, '#f6e6c8'); spawnParts(8, hit.tx * TS + 8, hit.ty * TS + 4, { color: ['#f6e6c8', '#d95a4a'], angle: -Math.PI / 2, spread: 1.4, speed: [1, 2.5], life: [12, 24] }); }
        else {
          if (hit.ch === 'w') L.lily.set(key(hit.tx, hit.ty), 4);
          if (!wasGround && p.airT > 8) { p.sx = 1.3; p.sy = .72; Sound.play('land'); spawnParts(6, p.x + 5, p.y + p.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.5, speed: [.4, 1.2], life: [8, 16], g: .04 }); if (p.airT > 30) { Cam.shake(1, 4); L.parts.push({ x: p.x - 3, y: p.y + p.h - 2, vx: 0, vy: 0, life: 8, color: '#c9b08a', size: 1, g: 0, kind: 'ring' }); } if (hit.ch === 'w' || hit.ch === 'raft') spawnParts(6, p.x + 5, p.y + p.h + 4, { color: ['#8fd9d0', '#c8f2ea'], angle: -Math.PI / 2, spread: 1.6, speed: [.3, 1], life: [8, 14], g: .03 }); }
          p.vy = 0;
        }
      } else { p.vy = 0; }
    }
    if (p.carrier && p.carrier.vx) moveX(p, p.carrier.vx);
    p.airT = p.onGround || p.hanging ? 0 : p.airT + 1;
    if (p.onGround && p.vy === 0 && !groundBelow(p)) p.onGround = false;
    const feetY = p.y + p.h - 2;
    if (waterAt(p.x + 5, feetY - 4) && waterAt(p.x + 5, feetY)) { Game.drown(); return; }
    if (p.y > L.h * TS + 20) { Game.drown(true); return; }
    for (let ty = Math.floor(p.y) >> 4; ty <= Math.floor(p.y + p.h - 1) >> 4; ty++) for (let tx = Math.floor(p.x) >> 4; tx <= Math.floor(p.x + p.w - 1) >> 4; tx++) { const ch = tileAt(tx, ty); if ((ch === '^' && p.y + p.h > ty * TS + 6) || (ch === 'F' && p.y + p.h > ty * TS + 3)) Player.hurt(p.x < tx * TS + 8 ? -1 : 1); }
    Player.fish();
    if (p.spitT > 0) p.spitT--; if (p.swallowT > 0) p.swallowT--; if (p.inv > 0) p.inv--; if (p.hurtT > 0) p.hurtT--; if (p.puffCd > 0) p.puffCd--; if (p.puffT > 0) p.puffT--; if (p.dropT > 0) p.dropT--;
    p.sx += (1 - p.sx) * .18; p.sy += (1 - p.sy) * .18;
    p.animT++;
    if (p.onGround && Math.abs(p.vx) > .5 && !p.carrier) { p.stepT++; if (p.stepT % 12 === 6) { Sound.play('step'); spawnParts(1, p.x + 5 - p.dir * 3, p.y + p.h, { color: '#c9b08a', angle: -Math.PI / 2 - p.dir * .6, spread: .4, speed: [.3, .8], life: [8, 14], g: .03 }); } } else p.stepT = 0;
    if (p.blink > 0) p.blink--; else if (Math.random() < .006) p.blink = 6;
    p.nearSign = null; for (const e of L.ents) if (e.kind === 'sign' && Math.abs(e.x + 7 - (p.x + 5)) < 22 && Math.abs(e.y - p.y) < 30) p.nearSign = e;
  },
  // Bigotes: hold to suck (or to charge when full), tap to puff (or to spit when full), hold in the air with water to hover, down+tap to drop.
  fish() {
    const p = Player, down = Input.held.fish;
    if (Input.pressed.fish) { p.fishDown = true; p.fishT = 0; }
    if (down && p.fishDown) p.fishT++;
    const wasHover = p.hover; p.hover = false;
    p.aimUp = Input.held.up && (p.sucking || (p.fishDown && down && !p.held)) && !p.crouch;
    if (p.held) {
      if (p.sucking) { p.sucking = false; Sound.suck(false); }
      if (Input.pressed.fish && Input.held.down && p.onGround && p.held.kind !== 'agua') { Player.drop(); p.fishDown = false; return; }
      if (down && p.fishDown && p.fishT > 4) {
        if (p.held.kind === 'agua' && !p.onGround) { p.hover = true; p.charge = 0; Player.jet(); }
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
      if (down && p.fishDown && !p.sucking && p.fishT > 4) { p.sucking = true; p.suckT = 0; p.waterT = 0; Sound.suck(true); }
      if (!down && p.fishDown) { p.fishDown = false; if (p.sucking) { p.sucking = false; Sound.suck(false); Player.letGo(); } else if (p.fishT <= 4 && p.puffCd === 0) Player.puff(); }
      if (p.sucking) Player.suck();
    }
    if (wasHover && !p.hover) Sound.jet(false);
    if (p.held && p.held.kind === 'agua' && p.held.amount <= 0) { const m = p.mouth(); p.held = null; Sound.play('puff'); Game.word('pff', m.x, m.y - 8, '#9fc0cc', false); spawnParts(6, m.x, m.y, { color: ['#8fd9d0', '#cfe0e8'], speed: [.5, 1.5], life: [8, 14], g: .05 }); }
  },
  suck() {
    const p = Player, m = p.mouth(), a = p.aim(); p.suckT++;
    // Wind streaks converge on the mouth from along the aim.
    if (p.suckT % 2 === 0) { const d = rnd(30, 62), ang = rnd(-.55, .55); const c = Math.cos(ang), sn = Math.sin(ang); L.parts.push({ x: m.x + (a.x * c - a.y * sn) * d, y: m.y + (a.y * c + a.x * sn) * d, vx: 0, vy: 0, life: 40, color: ['#cfe0e8', '#9fc0cc', '#e8f2f6'][(Math.random() * 3) | 0], size: 1, g: 0, kind: 'suck' }); }
    if (p.suckT % 20 === 10 && p.onGround) spawnParts(2, p.x + 5 + p.dir * 4, p.y + p.h, { color: '#c9b08a', angle: -Math.PI / 2 + p.dir * .8, spread: .4, speed: [.3, .9], life: [8, 14], g: .03 });
    if (p.grapple && !p.hanging) return;
    let water = null;
    if (!p.aimUp) for (let k = 1; k <= 4 && !water; k++) for (const dy of [-6, 4, 14, 24]) { const wx = m.x + p.dir * k * 10, wy = m.y + dy; if (waterAt(wx, wy)) { water = { x: wx, y: wy }; break; } }
    if (water) {
      p.waterT++;
      if (p.suckT % 2 === 0) L.parts.push({ x: water.x + rnd(-8, 8), y: (Math.floor(water.y / TS) * TS) + rnd(0, 6), vx: 0, vy: 0, life: 30, color: ['#8fd9d0', '#c8f2ea', '#e8fbff'][(Math.random() * 3) | 0], size: 1, g: 0, kind: 'suck' });
      if (p.waterT > 22) Player.captureWater();
    } else p.waterT = Math.max(0, p.waterT - 2);
    let best = null, bestD = 1e9;
    for (const e of L.ents) {
      if (e.dead || e.held || e === p.grapple) continue;
      if (!e.suckable && e.kind !== 'anchor') continue;
      if (p.grapple && e.kind !== 'anchor') continue;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2, ox = cx - m.x, oy = cy - m.y;
      const along = ox * a.x + oy * a.y, across = Math.abs(ox * a.y - oy * a.x);
      const reach = e.kind === 'anchor' ? 96 : 64;
      if (along < -6 || along > reach || across > 10 + along * .45) continue;
      if (e.kind === 'anchor') { const d = Math.hypot(ox, oy); if (d < bestD) { best = e; bestD = d; } continue; }
      if (e.armored && !e.flipped) { e.tug = 6; e.tugDir = -p.dir; continue; }
      const d = Math.hypot(ox, oy) || 1;
      const sp = Math.min(3.4, 1 + (64 - d) / 20);
      e.vx = lerp(e.vx, -ox / d * sp, .3); e.vy = lerp(e.vy, -oy / d * sp, .3); e.sucked = 2;
      if (d < 9) Player.capture(e);
    }
    if (best) { if (p.grapple) Game.word('¡OTRO!', best.x + 5, best.y - 8, '#e6c46a', false); p.grapple = best; p.hanging = false; p.vx = 0; p.vy = 0; p.crouch = false; Sound.play('confirm'); Game.word('¡ARO!', best.x + 5, best.y - 8, '#e6c46a', false); }
  },
  // Bigotes has clamped onto a ring: it reels Nila in until she hangs just under it.
  pull() {
    const p = Player, a = p.grapple; const tx = a.x + 5 - 5, ty = a.y + 10;
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d < 3) { p.x = tx; p.y = ty; p.hanging = true; p.vx = 0; p.vy = 0; if (p.animT % 6 === 0) L.parts.push({ x: a.x + 5, y: a.y + 5, vx: 0, vy: 0, life: 10, color: '#e6c46a', size: 1, g: 0, kind: 'suck' }); return; }
    const sp = 3.6; const mx = dx / d * sp, my = dy / d * sp;
    const bx = moveX(p, mx), by = moveY(p, my); p.vy = 0;
    if ((bx && Math.abs(dx) > 4) || (by && Math.abs(dy) > 4)) { if (++p.stuck > 12) { Player.letGo(); p.stuck = 0; } } else p.stuck = 0;
    if (p.animT % 2 === 0) L.parts.push({ x: a.x + 5 + rnd(-3, 3), y: a.y + 5 + rnd(-3, 3), vx: 0, vy: 0, life: 24, color: ['#e6c46a', '#fff6d6'][(Math.random() * 2) | 0], size: 1, g: 0, kind: 'suck' });
  },
  letGo() { const p = Player; if (p.grapple) { p.grapple = null; p.hanging = false; } if (p.sucking) { p.sucking = false; Sound.suck(false); } },
  capture(e) {
    const p = Player; e.dead = true; e.held = true;
    p.held = { kind: e.kind, sprite: e.spriteFor ? e.spriteFor() : e.sprite, w: e.w, h: e.h, proto: e };
    Player.swallowed();
  },
  captureWater() { const p = Player; p.held = { kind: 'agua', sprite: ART.drop, w: 8, h: 8, amount: 1 }; Player.swallowed(); },
  swallowed() {
    const p = Player; p.sucking = false; Sound.suck(false); Sound.play('glup'); p.swallowT = 10; p.sx = 1.15; p.sy = .9; p.fishDown = false; Input.rumble(50, .3, .1);
    const m = p.mouth(); Game.word('GLUP', m.x - p.dir * 6, m.y - 12, '#e8fbff'); spawnParts(6, m.x, m.y, { color: ['#cfe0e8', '#e8f2f6'], speed: [.5, 1.5], life: [8, 14], g: 0 });
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
    const up = Input.held.up, down = Input.held.down && !p.onGround;
    if (h.kind === 'agua') { Player.spitWater(charged, up, down); return; }
    const speed = charged ? 9.5 : 6.2;
    let vx = p.dir * speed, vy = charged ? -.6 : h.kind === 'crate' ? -1.8 : -1.6;
    if (up) { vx = p.dir * .6; vy = charged ? -9.5 : -7.2; } else if (down) { vx = p.dir * .8; vy = charged ? 8 : 6; p.vy = -4.2; p.jumpCut = false; p.sx = .85; p.sy = 1.2; }
    const proj = Proj.create(h, up || down ? m.x - h.w / 2 : (p.dir > 0 ? m.x - 4 : m.x - h.w + 4), m.y - h.h / 2 + (up ? -6 : 0), vx, vy, charged);
    for (let n = 0; n < 16 && rectSolid(proj.x, proj.y, proj.w, proj.h, proj); n++) proj.y--; // a fat crate starts clear of the ground
    L.projs.push(proj);
    Sound.play(charged ? 'bigspit' : 'spit'); p.sx = charged ? 1.35 : 1.2; p.sy = charged ? .7 : .85; p.vx -= p.dir * (up || down ? .2 : charged ? 2.2 : 1.1); Cam.shake(charged ? 4 : 2, charged ? 10 : 6);
    Input.rumble(charged ? 160 : 60, charged ? .8 : .3, .4); if (charged) { Cam.punch(1.06); Game.hitStop = 3; Game.word('¡ZAS!', m.x + p.dir * 10, m.y - 14, '#e79b3f', true); }
    spawnParts(charged ? 16 : 8, m.x, m.y, { color: ['#cfe0e8', '#e8f2f6', charged ? '#e79b3f' : '#9fc0cc'], angle: up ? -Math.PI / 2 : down ? Math.PI / 2 : (p.dir > 0 ? 0 : Math.PI), spread: .5, speed: [1.5, charged ? 5 : 3.5], life: [8, 16], g: 0 });
  },
  spitWater(charged, up, down) {
    const p = Player, m = p.mouth(); const n = charged ? 3 : 1;
    for (let i = 0; i < n; i++) {
      let vx = p.dir * (5.5 + i * .6), vy = -1.4 + i * .5; if (up) { vx = p.dir * .5; vy = -7 - i * .5; } else if (down) { vx = p.dir * .6; vy = 5.5; }
      const proj = Proj.create({ kind: 'agua', w: 8, h: 8, sprite: ART.drop }, m.x - 4 - (p.dir * i * 6), m.y - 4, vx, vy, charged); proj.delay = i * 3; L.projs.push(proj);
    }
    if (down) { p.vy = -4.2; p.jumpCut = false; }
    Sound.play('splash'); p.sx = 1.2; p.sy = .85; Cam.shake(charged ? 3 : 1, 6); Input.rumble(80, .3, .3);
    spawnParts(charged ? 14 : 7, m.x, m.y, { color: ['#8fd9d0', '#c8f2ea', '#e8fbff'], angle: up ? -Math.PI / 2 : down ? Math.PI / 2 : (p.dir > 0 ? 0 : Math.PI), spread: .4, speed: [1.5, 4], life: [8, 18], g: .05 });
  },
  puff() {
    const p = Player, m = p.mouth(); p.puffCd = 18; p.puffT = 8; p.spitT = 6; Sound.play('puff'); p.sx = 1.1; p.sy = .92;
    L.parts.push({ x: m.x - 3, y: m.y - 3, vx: p.dir * 2.2, vy: 0, life: 12, color: '#fff', size: 1, g: 0, kind: 'puff' });
    spawnParts(6, m.x, m.y, { color: ['#cfe0e8', '#e8f2f6'], angle: p.dir > 0 ? 0 : Math.PI, spread: .5, speed: [1.5, 3], life: [8, 14], g: 0 });
    Game.word('PFF', m.x + p.dir * 8, m.y - 10, '#cfe0e8', false);
    const box = { x: p.dir > 0 ? m.x - 2 : m.x - 34, y: m.y - 16, w: 36, h: 32 }; let any = false;
    // Standing on a raft, the puff is a jet: the raft goes the other way.
    if (p.carrier && p.carrier.kind === 'raft') { p.carrier.vx -= p.dir * 1.9; any = true; Game.word('¡ALLÁ VA!', p.carrier.x + 12, p.carrier.y - 10, '#c78d4e', false); }
    for (const e of L.ents) {
      if (e.dead || !overlap(box, e)) continue;
      if (e.kind === 'pinwheel') { e.blow(e, p.dir); any = true; continue; }
      if (e.kind === 'raft') { if (e !== p.carrier) e.vx += p.dir * 2.2; any = true; continue; }
      if (!e.enemy) continue; any = true;
      if (e.armored && !e.flipped) { e.tug = 10; e.tugDir = p.dir; continue; }
      e.vx = p.dir * 2.6; e.vy = -1.8; e.stun = 40; e.sucked = 0; if (e.kind === 'frog') e.state = 'sit'; spawnParts(4, e.x + e.w / 2, e.y + e.h / 2, { color: '#ffffff', speed: [.5, 1.5], life: [6, 12], g: 0 });
    }
    if (any) { Sound.play('pop'); Input.rumble(40, .2, .2); }
  },
  jet() {
    const p = Player, h = p.held; const jx = p.x + 5 + p.dir * 6, jy = p.y + 20; h.amount -= 1 / 95; Sound.jet(true);
    if (p.animT % 2 === 0) spawnParts(2, jx + rnd(-3, 3), jy, { color: ['#8fd9d0', '#c8f2ea', '#e8fbff'], angle: Math.PI / 2, spread: .5, speed: [2, 3.5], life: [10, 18], g: .08 });
    if (p.animT % 12 === 0) spawnParts(1, jx, jy + 2, { color: '#e8fbff', angle: Math.PI / 2, spread: .2, speed: [1, 2], life: [6, 10], g: 0, kind: 'puff' });
  },
  hurt(fromDir) {
    const p = Player; if (p.inv > 0 || p.dead || p.win) return;
    p.hp--; p.inv = 90; p.hurtT = 20; p.vx = -fromDir * 2.4; p.vy = -3.2; p.onGround = false; p.charge = 0; p.hover = false; Player.letGo(); Sound.jet(false); Sound.play('hurt'); Cam.shake(3, 10); Game.hitStop = 5; Game.hurtFlash = 14; Input.rumble(200, 1, .6);
    if (p.held) { const h = p.held; p.held = null; if (h.kind !== 'agua') { const e = Item.fromHeld(h, p.x + 5 - h.w / 2, p.y - h.h - 2); if (e) { e.vy = -2; e.vx = -fromDir * 1.5; L.ents.push(e); } } else spawnParts(8, p.x + 5, p.y + 8, { color: ['#8fd9d0', '#c8f2ea'], speed: [1, 2.5], life: [10, 18], g: .08 }); }
    if (p.hp <= 0) { p.dead = true; p.deadT = 0; p.vy = -4.5; p.vx = -fromDir * 1; }
  },
  draw(g) {
    const p = Player, cam = Cam;
    if (p.inv > 0 && (p.inv >> 2) % 2 === 0 && !p.dead) return;
    const fx = Math.round(p.x - cam.x), fy = Math.round(p.y - cam.y);
    let spr, sy = fy - 2;
    if (p.dead || p.hurtT > 0) spr = ART.nila.hurt;
    else if (p.win) spr = (p.animT >> 3) % 2 ? ART.nila.win : ART.nila.idle[0];
    else if (p.crouch) { spr = ART.nila.crouch; sy = fy - 4; }
    else if (p.hover || p.grapple) spr = ART.nila.dangle[(p.animT >> 3) % 2];
    else if ((p.sucking || p.charge > 8) && p.onGround) spr = ART.nila.brace;
    else if (!p.onGround) spr = p.vy < 0 ? ART.nila.jump : ART.nila.fall;
    else if (Math.abs(p.vx) > .5) spr = ART.nila.run[(p.animT >> 3) % 4];
    else spr = ART.nila.idle[p.blink > 0 ? 1 : 0];
    if (p.dir < 0) spr = ART.flip(spr);
    const cx = fx + 5, by = fy + p.h;
    const lean = p.sucking && !p.aimUp && !p.grapple ? -p.dir * .1 : p.charge > 8 ? p.dir * .06 : 0;
    const recoil = p.spitT > 8 ? -p.dir * 1 : 0;
    g.save(); g.translate(cx, by); g.scale(p.sx, p.sy); if (lean) g.transform(1, 0, lean, 1, 0, 0); g.translate(-cx, -by);
    g.drawImage(spr, fx - 2 + recoil, sy);
    g.restore();
    Player.drawFish(g, fx, fy);
  },
  // Bigotes is drawn from the hand outward, so it can swing to any pose: forward, up, down (jet) or toward a ring.
  drawFish(g, fx, fy) {
    const p = Player;
    let fs = ART.fish.closed;
    if (p.swallowT > 0) fs = ART.fish.swallow; else if (p.spitT > 0) fs = ART.fish.spit; else if (p.charge >= CHARGE_FULL) fs = ART.fish.squint; else if (p.held) fs = ART.fish.full; else if (p.sucking) fs = ART.fish.open; else if (p.onGround && Math.abs(p.vx) < .5 && p.animT % 190 < 8) fs = ART.fish.tail;
    const bob = p.onGround && Math.abs(p.vx) > .5 ? ((p.animT >> 3) % 2 ? 1 : 0) : 0;
    // Pivot: the hand.
    let hx = fx + 5 + p.dir * 7, hy = fy + (p.crouch ? 6 : 11) + bob; let rot = 0;
    if (p.hover) { hx = fx + 5 + p.dir * 4; hy = fy + 8; rot = Math.PI / 2; }
    else if (p.grapple) { const a = p.aim(); rot = Math.atan2(a.y, a.x * p.dir); hx = fx + 5; hy = fy + 4; }
    else if (p.aimUp) { rot = -Math.PI / 2; hx = fx + 5 + p.dir * 2; hy = fy + 6; }
    else if (!p.onGround && !p.sucking) rot = p.vy < -1 ? -.12 : p.vy > 2 ? .14 : 0;
    // Lunge forward on a spit, tremble on suction, shake while charging.
    let lunge = 0; if (p.spitT > 0) lunge = p.spitT > 8 ? (12 - p.spitT) * 2 : p.spitT * .8;
    if (p.sucking && !p.grapple) lunge += (p.animT % 4) < 2 ? 1 : 0;
    let shake = 0; if (p.charge > 8) shake = (p.animT % 2 ? 1 : -1) * (p.charge >= CHARGE_FULL ? 2 : 1);
    let scx = 1, scy = 1;
    if (p.swallowT > 0) { const t = p.swallowT / 10; scx = 1 - t * .12; scy = 1 + t * .2; }
    else if (p.charge > 8) { const t = Math.min(1, p.charge / CHARGE_FULL) * .18; scx = 1 + t * .4; scy = 1 + t; }
    else if (p.sucking) { scx = 1.08; scy = .95; }
    g.save();
    g.translate(Math.round(hx), Math.round(hy)); g.scale(p.dir, 1); g.rotate(rot); g.translate(lunge, shake); g.scale(scx, scy);
    const img = p.charge >= CHARGE_FULL && (p.animT >> 1) % 3 === 0 ? ART.tint(fs, '#fff6d6') : fs;
    g.drawImage(img, -7, -5);
    if (p.held && p.held.kind === 'agua') { g.globalAlpha = .45; g.drawImage(ART.tint(fs, '#8fd9d0'), -7, -5); g.globalAlpha = 1; }
    g.restore();
    g.drawImage(ART.hand, Math.round(hx) - 2, Math.round(hy) - 6);
  }
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
  pearl(x, y, id, resting) { return { kind: 'pearl', x, y, w: 7, h: 7, id, vy: 0, vx: 0, resting, t: Math.random() * 100, baseY: y, update: Item.pearlUpdate, draw: Item.pearlDraw }; },
  pearlUpdate(e) {
    e.t++;
    if (e.resting) { if (!rectSolid(e.x, e.y + 1, e.w, e.h) && !oneWayBelow(e.x, e.w, e.y + e.h, e.y + e.h + 1)) { e.vy = Math.min(e.vy + .25, 4); const hit = moveY(e, e.vy); if (hit) e.vy = 0; } else e.vy = 0; }
    if (e.t % 9 === 0 && Math.random() < .5) spawnParts(1, e.x + rnd(0, 7), e.y + rnd(0, 7), { color: '#e8fbff', speed: [0, .2], life: [10, 18], g: -.01 });
    if (overlap({ x: e.x - 2, y: e.y - 2, w: e.w + 4, h: e.h + 4 }, Player.rect()) && !Player.dead) { e.dead = true; L.taken.add(e.id); L.pearls++; Sound.play('pearl'); spawnParts(10, e.x + 3, e.y + 3, { color: ['#ffffff', '#cfe8f0', '#9ecbd8'], speed: [.5, 2], life: [12, 24], g: 0 }); Game.pearlPop = 12; Game.word('+1', e.x + 3, e.y - 6, '#e8fbff', false); }
  },
  pearlDraw(e, g) { const bob = e.resting ? 0 : Math.round(Math.sin(e.t / 18) * 2); g.drawImage(ART.pearl[(e.t >> 4) % 3], Math.round(e.x - Cam.x), Math.round(e.y - Cam.y + bob)); },
  heart(x, y, id) { return { kind: 'heart', x, y, w: 9, h: 8, id, t: 0, update(e) { e.t++; if (overlap(e, Player.rect()) && !Player.dead) { e.dead = true; L.taken.add(e.id); Player.hp = Math.min(3, Player.hp + 1); Sound.play('heart'); spawnParts(12, e.x + 4, e.y + 4, { color: ['#e2445a', '#ffb0bd', '#ffffff'], speed: [.5, 2.2], life: [14, 28], g: -.02 }); } }, draw(e, g) { g.drawImage(ART.heart, Math.round(e.x - Cam.x), Math.round(e.y - Cam.y + Math.sin(e.t / 15) * 2)); } }; },
  lantern(x, y, id) { return { kind: 'lantern', x, y, w: 10, h: 18, id, t: 0, update(e) { e.t++; if (!L.lit.has(e.id) && overlap({ x: e.x - 4, y: e.y, w: 18, h: 18 }, Player.rect()) && !Player.dead) { L.lit.add(e.id); L.checkpoint = { x: e.x - 1, y: e.y }; Sound.play('lantern'); spawnParts(16, e.x + 5, e.y + 5, { color: ['#ffcf5a', '#fff2b8', '#ffffff'], speed: [.3, 1.8], life: [20, 40], g: -.03 }); Game.toast('Farol encendido', 90); Game.word('¡FAROL!', e.x + 5, e.y - 8, '#ffcf5a', true); Cam.punch(1.03); } if (L.lit.has(e.id) && e.t % 5 === 0) spawnParts(1, e.x + 5, e.y + 5, { color: ['#ffcf5a', '#fff2b8'], speed: [.1, .5], life: [16, 30], g: -.02 }); },
    draw(e, g) { const lit = L.lit.has(e.id); if (lit) { g.globalAlpha = .18 + Math.sin(e.t / 9) * .04; g.fillStyle = '#ffcf5a'; const r = 18; g.beginPath(); g.arc(Math.round(e.x - Cam.x) + 5, Math.round(e.y - Cam.y) + 5, r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; } g.drawImage(lit ? ART.lantern.on : ART.lantern.off, Math.round(e.x - Cam.x), Math.round(e.y - Cam.y)); } }; },
  sign(x, y, idx) { return { kind: 'sign', x, y, w: 14, h: 12, idx, update() { }, draw(e, g) { g.drawImage(ART.sign, Math.round(e.x - Cam.x), Math.round(e.y - Cam.y)); } }; },
  anchor(x, y) { return { kind: 'anchor', x, y, w: 10, h: 10, t: 0, update(e) { e.t++; }, draw(e, g) { const sx = Math.round(e.x - Cam.x), sy = Math.round(e.y - Cam.y); g.fillStyle = '#2a2418'; for (let yy = sy - 1; yy >= sy - 10; yy -= 2) g.fillRect(sx + 4, yy, 2, 1); g.fillStyle = '#4a3a24'; g.fillRect(sx - 4, sy - 13, 18, 3); g.fillStyle = '#5e8a2e'; g.fillRect(sx - 2, sy - 14, 3, 1); g.fillRect(sx + 9, sy - 14, 4, 1); g.drawImage(ART.ring, sx, sy + (Player.grapple === e ? 1 : Math.round(Math.sin(e.t / 30) * 1))); if (Player.grapple === e && (e.t >> 2) % 2) g.drawImage(ART.tint(ART.ring, '#fff6d6'), sx, sy + 1); } }; },
  plate(x, y, idx) { return { kind: 'plate', x, y, w: 16, h: 5, idx, pressed: false, t: 0, update(e) {
      e.t++; let on = false; const top = { x: e.x + 1, y: e.y, w: 14, h: 7 };
      if (!Player.dead && overlap(top, { x: Player.x, y: Player.y + Player.h - 2, w: Player.w, h: 3 })) on = true;
      for (const o of L.ents) if (!o.dead && (o.kind === 'crate' || o.kind === 'rock') && o.resting && overlap(top, { x: o.x, y: o.y + o.h - 2, w: o.w, h: 3 })) on = true;
      if (on !== e.pressed) { e.pressed = on; Sound.play(on ? 'switch' : 'thud'); if (on) { Game.word('CLIC', e.x + 8, e.y - 6, '#d8f0b8', false); spawnParts(6, e.x + 8, e.y, { color: ['#a6abb8', '#d0d6da'], speed: [.3, 1.2], life: [8, 16], g: .05 }); } Game.setGate(e.idx, L.ents.some(o => o.kind === 'plate' && o.idx === e.idx && o.pressed)); }
    }, draw(e, g) { g.drawImage(e.pressed ? ART.plate.on : ART.plate.off, Math.round(e.x - Cam.x), Math.round(e.y - Cam.y)); } }; },
  pinwheel(x, y, idx) { return { kind: 'pinwheel', x, y, w: 16, h: 16, idx, spin: 0, t: 0, open: false, update(e) {
      e.t++; if (e.spin > 0) e.spin--; const open = e.spin > 0; if (open !== e.open) { e.open = open; Game.setGate(e.idx, open); if (!open) Game.word('...', e.x + 8, e.y - 4, '#9fc0cc', false); }
      if (e.spin > 0 && e.t % 4 === 0) spawnParts(1, e.x + 8 + rnd(-6, 6), e.y + 6 + rnd(-6, 6), { color: ['#e8f0c8', '#cfe0e8'], speed: [.2, .6], life: [6, 12], g: 0 });
    }, blow(e, dir) { const fresh = e.spin === 0; e.spin = 300; Sound.play('switch'); Game.word(fresh ? '¡GIRA!' : '¡MÁS!', e.x + 8, e.y - 6, '#e8f0c8', true); spawnParts(10, e.x + 8, e.y + 6, { color: ['#d95a4a', '#f2c53d', '#5fae5a', '#e8f0c8'], speed: [.5, 2], life: [10, 20], g: .02 }); },
    draw(e, g) { const f = e.spin > 0 ? (e.t >> (e.spin < 60 ? 2 : 1)) % 2 : 0; g.drawImage(ART.pinwheel[f], Math.round(e.x - Cam.x), Math.round(e.y - Cam.y)); if (e.spin > 0 && e.spin < 60 && (e.t >> 2) % 2) g.drawImage(ART.tint(ART.pinwheel[f], '#fff6d6'), Math.round(e.x - Cam.x), Math.round(e.y - Cam.y)); } }; },
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
    if (e.stun > 0) e.stun--;
    if (e.sucked > 0) { e.sucked--; e.x += e.vx; e.y += e.vy; if (rectSolid(e.x, e.y, e.w, e.h, e)) { e.x -= e.vx; e.y -= e.vy; } e.stretch = true; return true; }
    e.stretch = false;
    if (waterAt(e.x + e.w / 2, e.y + e.h - 1) && !e.flying) { e.dead = true; Sound.play('splash'); spawnParts(8, e.x + e.w / 2, e.y + e.h, { color: ['#8fd9d0', '#c8f2ea'], angle: -Math.PI / 2, spread: 1, speed: [1, 2.5], life: [12, 22] }); return true; }
    if (e.y > L.h * TS + 40) { e.dead = true; return true; }
    return false;
  },
  touch(e) { if (!Player.dead && !Player.win && Player.inv === 0 && e.stun === 0 && !(e.flipped) && overlap(e, Player.rect())) Player.hurt(Player.x + 5 < e.x + e.w / 2 ? 1 : -1); },
  walker(e) {
    e.t++; if (Enemy.common(e)) return;
    e.vy = Math.min(e.vy + .3, 5); const hit = moveY(e, e.vy); e.onGround = false; if (hit) { e.vy = 0; e.onGround = true; }
    if (e.stun === 0 && e.onGround) {
      const ahead = e.x + (e.dir > 0 ? e.w + 1 : -1);
      const edge = !rectSolid(ahead, e.y + e.h + 1, 1, 1) && !oneWayBelow(ahead, 1, e.y + e.h, e.y + e.h + 2);
      if (edge || moveX(e, e.dir * e.speed)) e.dir = -e.dir;
    }
    if (e.tug > 0) { e.tug--; }
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
    if (e.tug > 0) e.tug--;
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
      const dx = Player.x + 5 - (e.x + 6); if (Math.abs(dx) < 110 && Math.abs(Player.y - e.y) < 60) { e.dir = dx > 0 ? 1 : -1; e.wait--; if (e.wait <= 0) { e.state = 'jump'; e.vx = e.dir * 1.5; e.vy = -4.6; e.onGround = false; if (Math.abs(dx) < 160) Sound.play(Math.random() < .5 ? 'frog' : 'croak'); } }
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
    Sound.play('pop'); Game.hitStop = why === 'proj' ? 3 : 0;
  }
};

// ---------------------------------------------------------------- Proyectiles
const Proj = {
  create(h, x, y, vx, vy, charged) {
    const kind = h.kind; let g = kind === 'rock' ? .1 : kind === 'crate' ? .14 : kind === 'agua' ? .09 : .06;
    if (charged) g *= kind === 'agua' ? .8 : .35;
    return { kind, x, y, w: h.w, h: h.h, vx, vy, g, t: 0, sprite: h.sprite, dead: false, hits: 0, proto: h.proto, charged: !!charged, trail: [], delay: 0, pushed: new Set() };
  },
  update(p) {
    if (p.delay > 0) { p.delay--; return; }
    p.t++; p.vy = Math.min(p.vy + p.g, 7);
    if (p.charged && p.t % 2 === 0) { p.trail.unshift({ x: p.x, y: p.y }); if (p.trail.length > 5) p.trail.pop(); }
    const hx = moveX(p, p.vx), hy = moveY(p, p.vy);
    if (hx || hy) {
      const lx = hx ? (p.vx > 0 ? p.x + p.w + .5 : p.x - .5) : p.x + p.w / 2, ly = hy ? (p.vy > 0 ? p.y + p.h + .5 : p.y - .5) : p.y + p.h / 2;
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
    if (p.kind === 'agua') { p.dead = true; Proj.splashOut(p); return; }
    if (p.kind === 'crate' || p.kind === 'rock') {
      if (hy && p.vy > 0) { p.dead = true; Proj.dropAsItem(p); Sound.play('thud'); spawnParts(5, p.x + p.w / 2, p.y + p.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.4, speed: [.4, 1.2], life: [8, 14], g: .04 }); return; }
      if (hx) { Sound.play(p.kind === 'rock' ? 'hit' : 'thud'); Cam.shake(p.kind === 'rock' ? (p.charged ? 4 : 2) : 1, 4); if (p.kind === 'crate') { p.vx = 0; p.vy = Math.max(p.vy, 0); } else { p.vx = -p.vx * .25; p.vy = Math.min(p.vy, -1.5); } p.charged = false; spawnParts(6, p.vx < 0 ? p.x + p.w : p.x, p.y + p.h / 2, { color: p.kind === 'rock' ? ['#a6abb8', '#7d8290'] : ['#c78d4e', '#e0a862'], speed: [.5, 2], life: [10, 20] }); return; }
      if (hy && p.vy < 0) { p.vy = 0; return; }
    }
    p.dead = true; Proj.splat(p);
  },
  splashOut(p) { Sound.play('splash'); spawnParts(9, p.x + 4, p.y + 4, { color: ['#8fd9d0', '#c8f2ea', '#e8fbff'], speed: [.5, 2.5], life: [10, 20], g: .08 }); },
  splat(p) { const fake = { kind: p.kind, x: p.x, y: p.y, w: p.w, h: p.h, dead: false }; Enemy.kill(fake, 'proj'); Sound.play('hit'); Cam.shake(2, 5); },
  dropAsItem(p, bounceBack) {
    const e = p.kind === 'crate' ? Item.crate(p.x, p.y) : Item.rock(p.x, p.y);
    if (bounceBack) { e.vx = -Math.sign(p.vx) * 1.5; e.vy = -2.5; }
    L.ents.push(e);
  },
  draw(p, g) {
    if (p.delay > 0) return;
    let s = p.sprite;
    if (p.kind === 'rock' || p.enemy) { const f = (p.t >> 2) % 4; if (f === 1 || f === 3) s = ART.flip(s); }
    const x = Math.round(p.x - Cam.x + (p.w - s.width) / 2), y = Math.round(p.y - Cam.y + p.h - s.height);
    if (p.charged) { p.trail.forEach((t, i) => { g.globalAlpha = .35 - i * .06; g.drawImage(ART.tint(s, i % 2 ? '#e79b3f' : '#fff6d6'), Math.round(t.x - Cam.x + (p.w - s.width) / 2), Math.round(t.y - Cam.y + p.h - s.height)); }); g.globalAlpha = 1; }
    if (p.kind === 'agua') { g.drawImage(s, x, y + ((p.t >> 2) % 2)); return; }
    if (p.kind !== 'crate' && p.kind !== 'rock') { const f = (p.t >> 2) % 2; g.save(); g.translate(x + s.width / 2, y + s.height / 2); g.scale(f ? -1 : 1, 1); g.rotate(Math.sin(p.t / 3) * .2); g.translate(-(x + s.width / 2), -(y + s.height / 2)); g.drawImage(s, x, y); g.restore(); }
    else g.drawImage(s, x, y);
    if (Math.abs(p.vx) > 3) { g.fillStyle = p.charged ? 'rgba(255,230,180,.6)' : 'rgba(255,255,255,.35)'; g.fillRect(x - Math.sign(p.vx) * 6 + (p.vx > 0 ? 0 : s.width), y + s.height / 2, 5, 1); }
  }
};

// ---------------------------------------------------------------- La Garza
const Boss = {
  create(x, y) { return { kind: 'heron', boss: true, x, y, w: 30, h: 28, vx: 0, vy: 0, dir: -1, t: 0, state: 'enter', st: 0, hp: 5, maxHp: 5, hover: 0, drops: 0, targetX: x, targetY: y, flash: 0, wing: 0, dive: null, update: Boss.update, draw: Boss.draw, dead: false, sprite: ART.heronBody, shriek: 0 }; },
  arena() { return { x0: (L.w - 40) * TS + 20, x1: L.w * TS - 40, y: 34 }; },
  update(b) {
    b.t++; b.st++; if (b.flash > 0) b.flash--;
    const a = Boss.arena(); const px = Player.x + 5;
    b.dir = px < b.x + b.w / 2 ? -1 : 1;
    switch (b.state) {
      case 'enter': { b.y = lerp(b.y, a.y, .05); b.x = lerp(b.x, px + 90 * (px < (a.x0 + a.x1) / 2 ? 1 : -1), .03); if (b.st === 30) { Sound.play('heron'); Game.toast('¡La Garza!', 120); } if (b.st > 110) Boss.setState(b, 'hover'); break; }
      case 'hover': {
        b.targetX = clamp(px + [80, 0, -80][b.hover % 3], a.x0, a.x1); b.x = lerp(b.x, b.targetX, .035); b.y = a.y + Math.sin(b.t / 22) * 5;
        if (b.st % 150 === 100) { Boss.dropRock(b); b.drops++; }
        if (b.st > 260) { b.hover++; Boss.setState(b, b.drops >= 1 ? 'aim' : 'hover'); if (b.state === 'hover') b.st = 0; }
        break; }
      case 'aim': { b.x += Math.sin(b.st / 2) * .6; if (b.st === 1) { Sound.play('heron'); b.shriek = 30; } if (b.st > 45) { const dx = px - (b.x + b.w / 2), dy = Player.y - b.y - 10; const d = Math.hypot(dx, dy) || 1; b.dive = { vx: dx / d * 5, vy: dy / d * 5 }; Boss.setState(b, 'dive'); Sound.play('swoop'); } break; }
      case 'dive': {
        b.x += b.dive.vx; b.y += b.dive.vy;
        if (b.y + b.h > (L.h - 3) * TS - 2 || b.st > 40) { Boss.setState(b, 'rise'); spawnParts(10, b.x + b.w / 2, b.y + b.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.5, speed: [.5, 2], life: [10, 20] }); }
        if (b.x < a.x0 - 30) b.x = a.x0 - 30; if (b.x > a.x1 + 30) b.x = a.x1 + 30;
        break; }
      case 'rise': { b.y -= 2.4; b.x += b.dive.vx * .3; if (b.y <= a.y) { b.y = a.y; b.drops = 0; Boss.setState(b, 'hover'); } break; }
      case 'stunned': {
        b.vy = Math.min(b.vy + .3, 5); const hit = moveY(b, b.vy); if (hit) { if (b.vy > 2) { Cam.shake(4, 10); Sound.play('thud'); spawnParts(12, b.x + b.w / 2, b.y + b.h, { color: ['#c9b08a', '#a08a6a'], angle: -Math.PI / 2, spread: 1.6, speed: [.6, 2.4], life: [10, 24] }); } b.vy = 0; }
        if (b.st > 150) { Boss.setState(b, 'rise'); b.dive = { vx: 0, vy: 0 }; }
        break; }
      case 'dying': {
        b.vy = Math.min(b.vy + .25, 4); const hit = moveY(b, b.vy); if (hit) b.vy = 0;
        if (b.st % 6 === 0) spawnParts(3, b.x + rnd(0, b.w), b.y + rnd(0, b.h), { color: ['#e9eef2', '#a9b8c9', '#7d8fa6'], speed: [.3, 1.5], life: [20, 50], g: .02, kind: 'feather' });
        if (b.st > 140) { Boss.setState(b, 'leave'); Sound.play('heron'); }
        break; }
      case 'leave': { b.y -= 1.6 + b.st * .04; b.x += b.dir * -1.2; if (b.st > 120) { b.dead = true; Boss.won(); } break; }
    }
    if (!['stunned', 'dying', 'leave'].includes(b.state) && Player.inv === 0 && !Player.dead && !Player.win && overlap({ x: b.x + 4, y: b.y + 6, w: b.w - 8, h: b.h - 8 }, Player.rect())) Player.hurt(px < b.x + b.w / 2 ? 1 : -1);
  },
  setState(b, s) { b.state = s; b.st = 0; },
  dropRock(b) {
    let rocks = 0; for (const e of L.ents) if (!e.dead && e.kind === 'rock') rocks++; for (const p of L.projs) if (!p.dead && p.kind === 'rock') rocks++; if (Player.held && Player.held.kind === 'rock') rocks++;
    if (rocks >= 3) return;
    const r = Item.rock(b.x + b.w / 2 - 6, b.y + b.h); r.vy = 1; L.ents.push(r); Sound.play('puff');
    spawnParts(4, b.x + b.w / 2, b.y + b.h, { color: ['#e9eef2', '#a9b8c9'], speed: [.2, 1], life: [20, 40], g: .02, kind: 'feather' });
  },
  hit(b, p, dmg = 1) {
    if (['stunned', 'dying', 'leave', 'enter'].includes(b.state)) return false;
    b.hp = Math.max(0, b.hp - dmg); b.flash = 12; Cam.punch(dmg > 1 ? 1.08 : 1.04); Input.rumble(220, 1, .5); Game.word(dmg > 1 ? '¡ZAS!' : '¡PAF!', b.x + b.w / 2, b.y - 6, '#fff6d6', true); Sound.play('heronHit'); Cam.shake(5, 14); Game.hitStop = 6;
    spawnParts(14, b.x + b.w / 2, b.y + b.h / 2, { color: ['#e9eef2', '#a9b8c9', '#7d8fa6'], speed: [.5, 2.5], life: [20, 50], g: .03, kind: 'feather' });
    if (b.hp <= 0) { Boss.setState(b, 'dying'); b.vy = -2; Sound.play('heron'); Sound.duck(true); }
    else { Boss.setState(b, 'stunned'); b.vy = -2; }
    return true;
  },
  won() {
    Sound.duck(false); Sound.play('clear'); Game.toast('¡La Garza se ha ido!', 150);
    const a = Boss.arena(); const bx = a.x1 - 16, by = (L.h - 3) * TS - 8;
    // The boat pulls up on the shore; the last stretch of ground becomes water for it.
    for (let x = L.w - 5; x < L.w; x++) { setTile(x, L.h - 3, '~'); setTile(x, L.h - 2, '~'); }
    L.ents.push(Item.boat((L.w - 5) * TS + 4, (L.h - 3) * TS + 14)); L.boatSpawned = true;
    spawnParts(16, bx, by, { color: ['#8fd9d0', '#c8f2ea'], angle: -Math.PI / 2, spread: 1.2, speed: [1, 3], life: [14, 30] });
  },
  draw(b, g) {
    const x = Math.round(b.x - Cam.x), y = Math.round(b.y - Cam.y);
    const flying = !['stunned', 'dying'].includes(b.state);
    const body = flying ? ART.heronFly : ART.heronBody;
    const wingF = b.state === 'dive' ? 2 : b.state === 'aim' ? 0 : ((b.t >> 3) % 4);
    const wings = [ART.wingUp, ART.wingMid, ART.wingDown, ART.wingMid];
    const faceLeft = b.dir < 0;
    const draw = (s, dx, dy) => { const sp = faceLeft ? s : ART.flip(s); const ox = faceLeft ? dx : (body.width - dx - s.width); const img = b.flash > 0 && (b.flash >> 1) % 2 ? ART.tint(sp, '#ffffff') : sp; g.drawImage(img, x + ox, y + dy); };
    g.save();
    if (b.state === 'stunned' || b.state === 'dying') { g.translate(x + 16, y + 30); g.rotate(Math.sin(b.t / 6) * .06 * (b.state === 'dying' ? 3 : 1)); g.translate(-(x + 16), -(y + 30)); }
    if (flying) { draw(wings[wingF], 6, wingF === 0 ? -10 : wingF === 2 ? 8 : 2); }
    draw(body, 0, 0);
    if (!flying) { draw(ART.wingMid, 4, 6); }
    g.restore();
    if (b.state === 'stunned' && (b.t >> 3) % 2) for (let i = 0; i < 3; i++) g.drawImage(ART.star, x + 4 + i * 8 + Math.round(Math.sin(b.t / 5 + i) * 3), y - 6 + Math.round(Math.cos(b.t / 5 + i) * 2));
    if (b.shriek > 0) { b.shriek--; g.fillStyle = '#fff'; const bx = faceLeft ? x - 4 : x + body.width + 2; for (let i = 0; i < 3; i++) g.fillRect(bx + (faceLeft ? -i * 3 : i * 3), y + 2 + i * 3 - 4, 2, 1); }
  }
};

// ---------------------------------------------------------------- Cámara
const Cam = {
  x: 0, y: 0, look: 0, shakeT: 0, shakeA: 0, ox: 0, oy: 0, zoom: 1,
  punch(z) { if (Game.still) return; Cam.zoom = Math.max(Cam.zoom, z); },
  snap() { Cam.x = clamp(Player.x + 5 - W / 2, 0, L.w * TS - W); Cam.y = clamp(Player.y + 9 - H / 2, 0, L.h * TS - H); Cam.look = Player.dir * 28; },
  update() {
    Cam.look = lerp(Cam.look, Player.dir * 28, .04);
    const tx = clamp(Player.x + 5 - W / 2 + Cam.look, 0, Math.max(0, L.w * TS - W));
    const ty = clamp(Player.y + 9 - H / 2 + 10, 0, Math.max(0, L.h * TS - H));
    Cam.x = lerp(Cam.x, tx, .1); Cam.y = lerp(Cam.y, ty, .08); Cam.zoom = lerp(Cam.zoom, 1, .14); if (Cam.zoom < 1.003) Cam.zoom = 1;
    if (Cam.shakeT > 0) { Cam.shakeT--; const a = Cam.shakeA * (Cam.shakeT / 10); Cam.ox = Math.round(rnd(-a, a)); Cam.oy = Math.round(rnd(-a, a)); if (Game.still) { Cam.ox = 0; Cam.oy = 0; } } else { Cam.ox = 0; Cam.oy = 0; }
  },
  shake(a, t) { if (Game.still) return; Cam.shakeA = Math.max(Cam.shakeA, a); Cam.shakeT = Math.max(Cam.shakeT, t); }
};

// ---------------------------------------------------------------- Juego
const Game = {
  state: 'title', t: 0, hitStop: 0, hurtFlash: 0, toastText: '', toastT: 0, pearlPop: 0, level: 0, banner: 0, fade: 0, fadeTo: null, sel: 0, pauseSel: 0, clearStats: null, still: false, endT: 0, titleT: 0, capture: null, paused: false, pauseT: 0, deathT: 0,
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
    if (Game.capture) Game.runCapture(); else Game.title();
    Game.last = performance.now(); Game.acc = 0; requestAnimationFrame(Game.frame);
  },
  runCapture() {
    const c = Game.capture;
    if (c.scene === 'sprites') { Game.state = 'sprites'; return; }
    if (c.scene === 'titulo') { Game.title(); Game.titleT = c.t; for (let i = 0; i < c.t; i++) Game.updateTitle(); return; }
    if (c.scene === 'icono') { Game.state = 'icon'; return; }
    if (c.scene === 'nivel') { Game.startLevel(c.n); if (c.x >= 0) { Player.x = c.x; Player.y = 0; for (let i = 0; i < 60; i++) { Player.vy = Math.min(Player.vy + .28, 5.5); if (moveY(Player, Player.vy)) { Player.vy = 0; Player.onGround = true; break; } } Cam.snap(); } Game.banner = 0; for (let i = 0; i < c.t; i++) { Input.held = {}; Input.pressed = {}; for (const g of c.guion) if (i >= g.f0 && i <= g.f1) { Input.held[g.a] = true; if (i === g.f0) Input.pressed[g.a] = true; } Game.updatePlay(); } Input.held = {}; Input.pressed = {}; Game.frozen = true; if (params_debug()) console.log('ENTS', JSON.stringify(L.ents.map(e => [e.kind, Math.round(e.x), Math.round(e.y), e.dead ? 'dead' : ''])), 'PLAYER', Math.round(Player.x), Math.round(Player.y), Player.held ? Player.held.kind : '-', 'SUCK', Player.sucking, Player.waterT, Player.charge, Player.hover, Player.fishT, 'GRAP', !!Player.grapple, Player.hanging, Player.crouch, 'PROJS', JSON.stringify(L.projs.map(p => [p.kind, Math.round(p.x), Math.round(p.y)])), 'GATES', L.gates.map(g => g.map(t => tileAt(t.x, t.y)).join('')).join('|'), 'TARGETS', [...L.hitTargets].join(';')); return; }
  },
  title() { Game.state = 'title'; Game.titleT = 0; Game.titleParts = []; Sound.playMusic('dock'); },
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
      case 'title': Game.updateTitle(); break;
      case 'select': Game.updateSelect(); break;
      case 'play': if (Game.frozen) break; if (Game.paused) Game.updatePause(); else Game.updatePlay(); break;
      case 'clear': Game.updateClear(); break;
      case 'ending': Game.updateEnding(); break;
    }
    Touch.updateButtons && Touch.updateButtons();
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
    if (Game.titleT > 20 && (Input.pressed.jump || Input.pressed.fish || Input.pressed.confirm || Game.tapped)) { Game.tapped = false; Sound.play('confirm'); Game.transition(() => Game.select()); }
  },
  select() { Game.state = 'select'; Game.sel = Math.min(Save.data.unlocked, LEVELS.length - 1); Sound.playMusic('dock'); },
  updateSelect() {
    const n = LEVELS.length;
    if (Input.pressed.left) { Game.sel = (Game.sel + n - 1) % n; Sound.play('select'); }
    if (Input.pressed.right) { Game.sel = (Game.sel + 1) % n; Sound.play('select'); }
    if (Game.tapSel !== undefined) { const s = Game.tapSel; Game.tapSel = undefined; if (s === Game.sel) Game.tapped = true; else { Game.sel = s; Sound.play('select'); } }
    if (Input.pressed.jump || Input.pressed.fish || Input.pressed.confirm || Game.tapped) {
      Game.tapped = false;
      if (Game.sel <= Save.data.unlocked) { Sound.play('confirm'); Game.transition(() => Game.startLevel(Game.sel)); } else Sound.play('hurt');
    }
    if (Input.pressed.pause) { Sound.play('select'); Game.transition(() => Game.title()); }
  },
  // ---- play
  startLevel(i) { Game.level = i; loadLevel(i); Game.state = 'play'; Game.paused = false; Game.banner = 150; Sound.playMusic(LEVELS[i].music); Game.toastT = 0; },
  respawn() { Game.transition(() => { Player.reset(L.checkpoint.x, L.checkpoint.y, true); if (L.def.boss) { loadLevel(Game.level); Game.banner = 60; } else { spawnEntities(); } Cam.snap(); Sound.playMusic(L.def.music); }); },
  drown(fell) {
    const p = Player; if (p.dead) return;
    if (!fell) { Sound.play('splash'); spawnParts(14, p.x + 5, p.y + p.h, { color: ['#8fd9d0', '#c8f2ea', '#2f7f88'], angle: -Math.PI / 2, spread: 1.2, speed: [1, 3.5], life: [16, 30] }); }
    p.hp--; Sound.suck(false); Sound.jet(false); p.sucking = false; p.held = null; p.hover = false; p.charge = 0;
    if (p.hp <= 0) { p.dead = true; p.deadT = 40; p.vy = 0; p.vx = 0; p.y = L.h * TS + 100; }
    else { Game.transition(() => { const hp = p.hp; Player.reset(L.checkpoint.x, L.checkpoint.y, false); p.hp = hp; p.inv = 60; spawnEntities(); Cam.snap(); }); }
  },
  updatePlay() {
    if (Input.pressed.pause) { Game.pause(); return; }
    if (Game.hitStop > 0) { Game.hitStop--; return; }
    L.time++;
    if (Game.banner > 0) Game.banner--;
    Player.update();
    for (const e of L.ents) if (!e.dead) e.update(e);
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
    if (Player.win) { Game.winT++; if (Game.winT > 70) Game.finishLevel(); }
  },
  ambient() {
    const th = L.def.theme, x = Cam.x + rnd(0, W), y = Cam.y + rnd(0, H);
    if ((th === 'dusk' || th === 'night') && Math.random() < .05) L.parts.push({ x, y: Cam.y + rnd(40, 170), vx: rnd(-.15, .15), vy: rnd(-.1, .05), life: 140, color: th === 'night' ? '#d8f58a' : '#e9f58a', size: 1, g: 0, kind: 'amb', ph: rnd(0, 6) });
    if (th === 'cave' && Math.random() < .08) L.parts.push({ x, y: Cam.y - 4, vx: rnd(-.1, .1), vy: rnd(.1, .3), life: 200, color: ['#b48ad0', '#8a6aa8', '#d8c0e8'][(Math.random() * 3) | 0], size: 1, g: 0, kind: 'amb', ph: rnd(0, 6) });
    if (th === 'nest' && Math.random() < .07) L.parts.push({ x, y: Cam.y - 4, vx: rnd(-.3, .1), vy: rnd(.15, .4), life: 220, color: ['#e9eef2', '#f2c46a', '#d0684a'][(Math.random() * 3) | 0], size: 1, g: 0, kind: 'amb', ph: rnd(0, 6) });
    // Embers from any fire in view.
    const x0 = Math.max(0, Cam.x >> 4), x1 = Math.min(L.w - 1, (Cam.x + W) >> 4), y0 = Math.max(0, Cam.y >> 4), y1 = Math.min(L.h - 1, (Cam.y + H) >> 4);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (L.t[ty][tx] === 'F' && Math.random() < .08) L.parts.push({ x: tx * TS + rnd(3, 13), y: ty * TS + rnd(4, 12), vx: rnd(-.2, .2), vy: rnd(-.8, -.3), life: rnd(14, 30), color: ['#ffd34a', '#f28b2a', '#fff3b0'][(Math.random() * 3) | 0], size: 1, g: -.01, kind: 'dot' });
  },
  breakCracked(tx, ty, kind = 'x') {
    const seen = new Set(), stack = [[tx, ty]]; let n = 0; Sound.play('crack'); Cam.shake(3, 8); Game.hitStop = 3; Cam.punch(1.04); Game.word('¡CRAC!', tx * TS + 8, ty * TS - 6, '#d0d6da', true); Input.rumble(120, .7, .4);
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
    Player.win = true; Player.vx = 0; Player.vy = 0; Player.sucking = false; Sound.suck(false); Player.x = boat.x + 10; Player.y = boat.y - Player.h; Game.winT = 0;
    Sound.play('clear'); Sound.duck(true);
    spawnParts(20, Player.x + 5, Player.y, { color: ['#ffffff', '#cfe8f0', '#ffcf5a'], speed: [.5, 2.5], life: [20, 50], g: -.02 });
  },
  finishLevel() {
    const i = Game.level; const d = Save.data;
    d.pearls[i] = Math.max(d.pearls[i] || 0, L.pearls); d.totals[i] = L.pearlsTotal;
    const secs = Math.floor(L.time / 60); if (!d.best[i] || secs < d.best[i]) d.best[i] = secs;
    if (i + 1 < LEVELS.length) d.unlocked = Math.max(d.unlocked, i + 1); else d.finished = true;
    Save.write(); Sound.duck(false);
    Game.clearStats = { name: L.def.name, pearls: L.pearls, total: L.pearlsTotal, secs, last: i + 1 >= LEVELS.length };
    Game.transition(() => { Game.state = 'clear'; Game.clearT = 0; Sound.playMusic('dock'); });
  },
  updateClear() {
    Game.clearT++;
    if (Game.clearT > 40 && (Input.pressed.jump || Input.pressed.fish || Input.pressed.confirm || Game.tapped)) {
      Game.tapped = false; Sound.play('confirm');
      if (Game.clearStats.last) Game.transition(() => { Game.state = 'ending'; Game.endT = 0; Sound.playMusic('dock'); });
      else Game.transition(() => Game.startLevel(Game.level + 1));
    }
  },
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
  toast(text, t) { Game.toastText = text; Game.toastT = t; },
  word(text, x, y, color = '#fff6d6', big = false) { L.words.push({ text, x, y, t: 0, life: big ? 46 : 34, color, big, wob: Math.random() * 6 }); if (L.words.length > 12) L.words.shift(); },
  douse(tx, ty) {
    const seen = new Set(), stack = [[tx, ty]]; Sound.play('hiss'); Game.word('SSSH', tx * TS + 8, ty * TS - 4, '#cfe0e8', false);
    while (stack.length) { const [x, y] = stack.pop(); const k = key(x, y); if (seen.has(k) || tileAt(x, y) !== 'F') continue; seen.add(k); setTile(x, y, '.'); spawnParts(8, x * TS + 8, y * TS + 8, { color: ['#9fa8b0', '#6a7078', '#d0d6da'], angle: -Math.PI / 2, spread: .8, speed: [.3, 1.2], life: [24, 50], g: -.02, kind: 'smoke' }); spawnParts(4, x * TS + 8, y * TS + 12, { color: ['#8fd9d0', '#c8f2ea'], speed: [.5, 1.5], life: [10, 18], g: .08 }); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) stack.push([x + dx, y + dy]); }
  },
  tap(pt) {
    if (Game.state === 'title') { Game.tapped = true; return; }
    if (Game.state === 'select') { const cards = Game.selectCards(); for (let i = 0; i < cards.length; i++) { const c = cards[i]; if (pt.x >= c.x && pt.x < c.x + c.w && pt.y >= c.y && pt.y < c.y + c.h) { Game.tapSel = i; return; } } return; }
    if (Game.state === 'play' && Game.paused) { const rows = Game.pauseRows(); for (let i = 0; i < rows.length; i++) if (pt.y >= rows[i] - 6 && pt.y < rows[i] + 12) { Game.tapSel = i; return; } return; }
    if (Game.state === 'clear' || Game.state === 'ending') Game.tapped = true;
  },
  signText(idx) {
    const def = L.def; const raw = def.signs[idx] || ''; const m = Input.mode;
    const map = m === 'touch' ? { move: 'La cruceta', jump: 'SALTO', fish: 'BIGOTES', up: '▲', down: '▼' } : m === 'pad' ? { move: 'El stick', jump: 'A', fish: 'X', up: 'arriba', down: 'abajo' } : { move: 'Flechas', jump: 'Z o espacio', fish: 'X', up: '↑', down: '↓' };
    return raw.replace(/\{(\w+)\}/g, (_, k) => map[k] || k).replace('▲', '↑').replace('▼', '↓');
  },
  // ---------------------------------------------------------------- Dibujo
  draw(g) {
    g.imageSmoothingEnabled = false;
    switch (Game.state) {
      case 'title': Game.drawTitle(g); break;
      case 'select': Game.drawSelect(g); break;
      case 'play': Game.drawPlay(g); if (Game.paused) Game.drawPause(g); break;
      case 'clear': Game.drawClear(g); break;
      case 'ending': Game.drawEnding(g); break;
      case 'sprites': Game.drawSprites(g); break;
      case 'icon': Game.drawIcon(g); break;
    }
    if (Game.fade > 0) { g.fillStyle = 'rgba(8,10,16,' + Game.fade + ')'; g.fillRect(0, 0, W, H); }
  },
  drawBackground(g, camX, camY, bg) {
    g.drawImage(bg.sky, 0, 0);
    if (bg.clouds) { const cx = -Math.floor((camX * .08 + Game.t * .06) % bg.clouds.width); for (let x = cx - bg.clouds.width; x < W; x += bg.clouds.width) g.drawImage(bg.clouds, x, 8); }
    const far = bg.far, mid = bg.mid;
    const fx = -Math.floor((camX * .18) % far.width), fy = H - far.height + 8 - Math.floor(camY * .1);
    for (let x = fx - far.width; x < W; x += far.width) g.drawImage(far, x, fy);
    g.fillStyle = bg.fog; g.globalAlpha = .28; g.fillRect(0, fy + far.height - 40, W, 40); g.globalAlpha = 1;
    const mx = -Math.floor((camX * .42) % mid.width), my = H - mid.height + 24 - Math.floor(camY * .25);
    for (let x = mx - mid.width; x < W; x += mid.width) g.drawImage(mid, x, my);
    const rx = -Math.floor((camX * .7) % bg.reeds.width), ry = H - bg.reeds.height + 10 - Math.floor(camY * .5);
    for (let x = rx - bg.reeds.width; x < W; x += bg.reeds.width) g.drawImage(bg.reeds, x, ry);
  },
  drawTiles(g, camX, camY, layer) {
    const x0 = Math.max(0, camX >> 4), x1 = Math.min(L.w - 1, (camX + W) >> 4), y0 = Math.max(0, camY >> 4), y1 = Math.min(L.h - 1, (camY + H) >> 4);
    const frame = (Game.t >> 3) % 4;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const ch = L.t[ty][tx]; if (ch === '.') continue; const px = tx * TS - camX, py = ty * TS - camY;
      if (layer === 'back') {
        switch (ch) {
          case '#': { g.drawImage(ART.dirt[(tx * 7 + ty * 13) & 3], px, py); const up = tileAt(tx, ty - 1), dn = tileAt(tx, ty + 1); if (!solidChar(up)) g.drawImage(ART.grassCap[(tx + ty) & 1], px, py); if (!solidChar(dn) && dn !== '~') g.drawImage(ART.roots, px, py + 12); if (!solidChar(tileAt(tx - 1, ty))) g.drawImage(ART.edgeL, px, py); if (!solidChar(tileAt(tx + 1, ty))) g.drawImage(ART.edgeR, px + 15, py); break; }
          case '=': g.drawImage(ART.plank, px, py); break;
          case 'w': g.drawImage(ART.lily, px, py + Math.round(Math.sin((Game.t + tx * 9) / 20)) + (L.lily.has(key(tx, ty)) ? 2 : 0)); break;
          case 'F': g.drawImage(ART.fire[((Game.t + tx * 3) >> 3) % 2], px, py); break;
          case '^': g.drawImage(ART.thorns, px, py + 8); break;
          case 'x': g.drawImage(ART.cracked, px, py); break;
          case 'X': g.drawImage(ART.hard, px, py); break;
          case 'G': g.drawImage(ART.gate, px, py); break;
          case 'T': g.drawImage(L.hitTargets.has(key(tx, ty)) ? ART.target.on : ART.target.off, px, py); break;
          case '%': { const sq = L.mush.get(key(tx, ty)); if (sq) g.drawImage(ART.mushroomSquash, px, py + 10); else g.drawImage(ART.mushroom, px, py + 6); break; }
          case ',': g.drawImage(ART.tuft, px + 5, py + 13); break;
          case "'": g.drawImage(ART.reed, px + 5, py + 4); break;
          case '"': g.drawImage(ART.shroomDeco, px + 5, py + 11); break;
          case '~': { const up = tileAt(tx, ty - 1); if (up !== '~') { g.fillStyle = ART.WATER.mid; g.fillRect(px, py + 4, 16, 12); } else g.drawImage(ART.waterDeep, px, py); break; }
        }
      } else if (ch === '~') {
        const up = tileAt(tx, ty - 1); g.globalAlpha = .72; if (up !== '~') g.drawImage(ART.water[frame], px, py); else g.drawImage(ART.waterDeep, px, py); g.globalAlpha = 1;
      }
    }
  },
  drawPlay(g) {
    const camX = Math.round(Cam.x) + Cam.ox, camY = Math.round(Cam.y) + Cam.oy;
    const zoom = Cam.zoom > 1 ? Cam.zoom : 1;
    if (zoom > 1) { g.save(); g.translate(W / 2, H / 2); g.scale(zoom, zoom); g.translate(-W / 2, -H / 2); }
    Game.drawBackground(g, camX, camY, L.bg);
    Game.drawTiles(g, camX, camY, 'back');
    // Depth: signs and lanterns behind, then items, enemies, player, projectiles.
    const order = e => e.kind === 'sign' || e.kind === 'lantern' ? 0 : e.kind === 'boat' ? 1 : e.enemy ? 3 : e.boss ? 4 : 2;
    const ents = L.ents.slice().sort((a, b) => order(a) - order(b));
    for (const e of ents) if (!e.dead && order(e) <= 1) e.draw(e, g);
    if (Player.sucking) Game.drawSuction(g);
    for (const e of ents) if (!e.dead && order(e) > 1) e.draw(e, g);
    for (const gh of L.ghosts) { const sx = 1 + (5 - gh.life) * gh.grow; g.save(); g.translate(Math.round(gh.x - Cam.x + gh.sprite.width / 2), Math.round(gh.y - Cam.y + gh.sprite.height / 2)); g.scale(sx, sx); g.globalAlpha = gh.life / 5; g.drawImage(ART.tint(gh.sprite, '#ffffff'), -gh.sprite.width / 2, -gh.sprite.height / 2); g.restore(); }
    Player.draw(g);
    for (const p of L.projs) if (!p.dead) Proj.draw(p, g);
    Game.drawParts(g);
    Game.drawTiles(g, camX, camY, 'front');
    Game.drawLight(g, camX, camY);
    Game.drawWords(g);
    if (zoom > 1) g.restore();
    Game.drawHud(g);
  },
  // Darkness with pools of light: the cave is lit by Nila, lanterns, fire, pearls and glowing mushrooms.
  drawLight(g, camX, camY) {
    const th = L.def.theme; const dark = th === 'cave' ? .84 : th === 'night' ? .22 : 0; if (!dark) return;
    if (!Game.lightMask) { Game.lightMask = document.createElement('canvas'); Game.lightMask.width = W; Game.lightMask.height = H; }
    const m = Game.lightMask.getContext('2d'); m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, W, H); m.fillStyle = 'rgba(6,3,12,' + dark + ')'; m.fillRect(0, 0, W, H);
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
      else if (e.kind === 'pinwheel' && e.spin > 0) hole(e.x + 8, e.y + 8, 18);
    }
    for (const p of L.projs) if (p.kind === 'agua') hole(p.x + 4, p.y + 4, 10);
    const x0 = Math.max(0, camX >> 4), x1 = Math.min(L.w - 1, (camX + W) >> 4), y0 = Math.max(0, camY >> 4), y1 = Math.min(L.h - 1, (camY + H) >> 4);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const ch = L.t[ty][tx]; if (ch === 'F') hole(tx * TS + 8, ty * TS + 8, 40 * fl); else if (ch === '%') hole(tx * TS + 8, ty * TS + 10, 16, .8); else if (ch === 'T' && L.hitTargets.has(key(tx, ty))) hole(tx * TS + 8, ty * TS + 8, 14); }
    g.drawImage(Game.lightMask, 0, 0);
  },
  drawWords(g) {
    for (const w of L.words) {
      const t = w.t / w.life; const rise = w.big ? Math.min(6, w.t * .6) : Math.min(8, w.t * .5);
      const x = Math.round(w.x - Cam.x), y = Math.round(w.y - Cam.y - rise);
      g.globalAlpha = t > .7 ? (1 - t) / .3 : 1;
      if (w.big) { const s = w.t < 4 ? 1 + (4 - w.t) * .25 : 1; g.save(); g.translate(x, y); g.scale(s, s); g.rotate(Math.sin(w.wob) * .06); ART.text(g, w.text, 0, -4, w.color, 'center', '#1b2430'); g.restore(); }
      else ART.text(g, w.text, x, y - 4, w.color, 'center', '#1b2430');
      g.globalAlpha = 1;
    }
  },
  drawSuction(g) {
    const m = Player.mouth(), a = Player.aim(); const mx = Math.round(m.x - Cam.x), my = Math.round(m.y - Cam.y); const len = Player.grapple ? 0 : 64;
    if (!len) return;
    g.globalAlpha = .12; g.fillStyle = '#cfe0e8';
    g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + a.x * len - a.y * 36, my + a.y * len + a.x * 36); g.lineTo(mx + a.x * len + a.y * 36, my + a.y * len - a.x * 36); g.closePath(); g.fill(); g.globalAlpha = 1;
  },
  drawParts(g) {
    for (const p of L.parts) {
      const x = Math.round(p.x - Cam.x), y = Math.round(p.y - Cam.y);
      if (p.kind === 'puff') { g.drawImage(ART.puff[p.life > 6 ? 1 : 0], x, y); continue; }
      if (p.kind === 'suck') { g.fillStyle = p.color; const m = Player.mouth(); const dx = m.x - p.x, dy = m.y - p.y, dd = Math.hypot(dx, dy) || 1; g.fillRect(x, y, 1, 1); g.fillRect(Math.round(x - dx / dd * 2), Math.round(y - dy / dd * 2), 1, 1); continue; }
      if (p.kind === 'feather') { g.fillStyle = p.color; g.fillRect(x + Math.round(Math.sin(p.life / 5) * 2), y, 2, 1); continue; }
      if (p.kind === 'ring') { const r = (8 - p.life) * 1.6 + 2; g.strokeStyle = p.color; g.globalAlpha = p.life / 8; g.beginPath(); g.ellipse(x + 8, y, r, r * .45, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; continue; }
      if (p.kind === 'smoke') { g.globalAlpha = Math.min(1, p.life / 20) * .8; g.fillStyle = p.color; const sz = p.life > 30 ? 2 : 3; g.fillRect(x, y, sz, sz); g.globalAlpha = 1; continue; }
      if (p.kind === 'amb') { g.globalAlpha = .35 + Math.sin(p.life / 9 + p.ph) * .35; g.fillStyle = p.color; g.fillRect(x, y, 1, 1); g.globalAlpha = 1; continue; }
      g.fillStyle = p.color; g.fillRect(x, y, p.size, p.size);
    }
  },
  drawHud(g) {
    for (let i = 0; i < 3; i++) g.drawImage(i < Player.hp ? ART.heart : ART.heartEmpty, 5 + i * 11, 5);
    const pop = Game.pearlPop > 0 ? 1 : 0;
    const px = Touch.enabled && !Touch.portrait ? W - 108 : W - 44;
    g.drawImage(ART.pearl[(Game.t >> 4) % 3], px - pop, 5 - pop);
    ART.text(g, L.pearls + '/' + L.pearlsTotal, px + 10, 5, '#e8fbff', 'left', '#1b2430');
    if (L.boss && !L.boss.dead && L.boss.state !== 'enter' && L.boss.state !== 'leave') { const bw = 60; g.fillStyle = '#1b2430'; g.fillRect(W / 2 - bw / 2 - 1, 5, bw + 2, 6); g.fillStyle = '#d9503a'; g.fillRect(W / 2 - bw / 2, 6, Math.round(bw * L.boss.hp / L.boss.maxHp), 4); ART.text(g, 'La Garza', W / 2, 12, '#f2c46a', 'center', '#1b2430'); }
    // Bigotes' mouth: what is inside, the water left, or the charge building up.
    const hx = 5, hy = 16; g.drawImage(Player.held ? ART.fish.full : ART.fish.closed, hx, hy);
    if (Player.held) {
      const nm = AMMO_NAMES[Player.held.kind] || Player.held.kind; ART.text(g, nm, hx + 25, hy + 2, Player.charge >= CHARGE_FULL ? '#fff6d6' : '#e8fbff', 'left', '#1b2430');
      if (Player.held.kind === 'agua') { g.fillStyle = '#1b2430'; g.fillRect(hx + 25, hy + 10, 32, 3); g.fillStyle = '#8fd9d0'; g.fillRect(hx + 26, hy + 11, Math.round(30 * Math.max(0, Player.held.amount)), 1); }
      if (Player.charge > 4) { const full = Player.charge >= CHARGE_FULL; g.fillStyle = '#1b2430'; g.fillRect(hx + 25, hy + 10, 32, 3); g.fillStyle = full && (Game.t >> 2) % 2 ? '#fff6d6' : '#e79b3f'; g.fillRect(hx + 26, hy + 11, Math.round(30 * Math.min(1, Player.charge / CHARGE_FULL)), 1); }
    } else if (Player.sucking) ART.text(g, '...', hx + 25, hy + 2, '#9fc0cc');
    if (Game.hurtFlash > 0) { g.fillStyle = 'rgba(220,60,60,' + (Game.hurtFlash / 14 * .28) + ')'; g.fillRect(0, 0, W, H); }
    if (Game.banner > 0 && !Game.capture) {
      const t = Game.banner; const a = t > 130 ? (150 - t) / 20 : t < 30 ? t / 30 : 1;
      g.globalAlpha = a; g.fillStyle = '#1b2430'; g.fillRect(0, 70, W, 30); g.fillStyle = '#e79b3f'; g.fillRect(0, 70, W, 1); g.fillRect(0, 99, W, 1);
      ART.text(g, (Game.level + 1) + ' · ' + L.def.name, W / 2, 76, '#fff6d6', 'center'); ART.text(g, L.def.boss ? 'Devuélvele las piedras' : 'Llega a la barca', W / 2, 88, '#9fc0cc', 'center'); g.globalAlpha = 1;
    }
    if (Game.toastT > 0) { const a = Math.min(1, Game.toastT / 20); g.globalAlpha = a; ART.text(g, Game.toastText, W / 2, 30, '#fff6d6', 'center', '#1b2430'); g.globalAlpha = 1; }
    if (Player.nearSign && !Player.dead) {
      const lines = ART.wrap(Game.signText(Player.nearSign.idx), W - 40); const h = lines.length * 10 + 10; const y = H - h - 6;
      g.fillStyle = 'rgba(27,36,48,.9)'; g.fillRect(14, y, W - 28, h); g.fillStyle = '#c78d4e'; g.fillRect(14, y, W - 28, 1); g.fillRect(14, y + h - 1, W - 28, 1);
      lines.forEach((l, i) => ART.text(g, l, W / 2, y + 5 + i * 10, '#fff6d6', 'center'));
    }
  },
  pauseRows() { return [70, 88, 106]; },
  drawPause(g) {
    g.fillStyle = 'rgba(8,10,16,.72)'; g.fillRect(0, 0, W, H);
    ART.text(g, 'Pausa', W / 2, 40, '#e79b3f', 'center', '#1b2430');
    const items = ['Seguir', 'Sonido: ' + (Sound.isMuted() ? 'no' : 'sí'), 'Salir al mapa'], rows = Game.pauseRows();
    items.forEach((it, i) => { const sel = i === Game.pauseSel; ART.text(g, (sel ? '► ' : '') + it, W / 2, rows[i], sel ? '#fff6d6' : '#9fc0cc', 'center'); });
    ART.text(g, Touch.enabled ? 'Toca una opción' : 'Flechas y Z', W / 2, 140, '#5f7899', 'center');
  },
  // ---- title & menus
  drawScene(g, t, theme) {
    // A dock at dusk: reflections shimmer on the water and fireflies wander.
    const bg = ART.background(theme); Game.drawBackground(g, 40 + t * .15, 0, bg);
    g.fillStyle = ART.WATER.top; g.fillRect(0, 132, W, 48); g.fillStyle = ART.WATER.mid; g.fillRect(0, 140, W, 40); g.fillStyle = ART.WATER.deep; g.fillRect(0, 156, W, 24);
    g.fillStyle = ART.WATER.foam; for (let x = 0; x < W; x += 2) { const y = 132 + Math.round(Math.sin((x + t * .8) / 9) * 1.2); g.fillRect(x, y, 1, 1); }
    // Moon reflection as broken bands.
    const p = bg.theme; g.fillStyle = p.moonLight; for (let i = 0; i < 9; i++) { const y = 138 + i * 4; const w = 18 - i * 1.5; const off = Math.round(Math.sin((t + i * 30) / 15) * 3); if (i % 2 === 0) g.fillRect(p.moon[0] - w / 2 + off, y, w, 1); }
    for (let i = 0; i < 4; i++) { g.fillStyle = ART.WATER.glint; g.fillRect(((i * 83 + t * .6) % (W + 20)) - 10, 145 + i * 7, 5, 1); }
    // Dock.
    for (let x = 96; x < 224; x += 16) g.drawImage(ART.plank, x, 128);
    g.fillStyle = '#5a3a24'; g.fillRect(100, 134, 3, 30); g.fillRect(216, 134, 3, 30); g.fillStyle = '#3a2416'; g.fillRect(103, 134, 1, 30); g.fillRect(219, 134, 1, 30);
    g.drawImage(ART.lantern.on, 205, 110);
    g.globalAlpha = .15 + Math.sin(t / 9) * .03; g.fillStyle = '#ffcf5a'; g.beginPath(); g.arc(210, 115, 20, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    for (let x = 0; x < 96; x += 16) { g.drawImage(ART.dirt[(x >> 4) & 3], x, 128); g.drawImage(ART.grassCap[(x >> 4) & 1], x, 128); g.drawImage(ART.dirt[(x >> 4) & 3], x, 144); g.drawImage(ART.dirt[1], x, 160); }
    for (let x = 224; x < W; x += 16) { g.drawImage(ART.dirt[(x >> 4) & 3], x, 128); g.drawImage(ART.grassCap[(x >> 4) & 1], x, 128); g.drawImage(ART.dirt[(x >> 4) & 3], x, 144); g.drawImage(ART.dirt[1], x, 160); }
    g.drawImage(ART.reed, 232, 108); g.drawImage(ART.reed, 240, 112); g.drawImage(ART.tuft, 60, 125); g.drawImage(ART.shroomDeco, 30, 123);
  },
  drawTitle(g) {
    const t = Game.titleT; Game.drawScene(g, t, 'dusk');
    // Nila and Bigotes on the dock, breathing.
    const px = 150, py = 108, blink = (t % 200) < 6;
    g.drawImage(ART.nila.idle[blink ? 1 : 0], px - 2, py - 2 + (t % 60 < 30 ? 0 : 0));
    const fishS = (t % 240) < 20 ? ART.fish.open : ART.fish.closed; g.drawImage(fishS, px + 5, py + 6 + ((t >> 5) % 2)); g.drawImage(ART.hand, px + 11, py + 5 + ((t >> 5) % 2));
    if ((t % 240) < 20 && t % 3 === 0) { g.fillStyle = '#cfe0e8'; g.fillRect(px + 32 + (t % 20) * 2, py + 10 + Math.round(Math.sin(t) * 4), 2, 1); }
    // Fireflies.
    for (const f of Game.titleParts) { g.globalAlpha = .4 + Math.sin(f.t / 8) * .4; g.fillStyle = '#e9f58a'; g.fillRect(Math.round(f.x), Math.round(f.y), 1, 1); } g.globalAlpha = 1;
    // Logo drops in and settles.
    const logo = ART.logo(); const ly = Math.round(Math.min(0, -60 + t * 3) + 18 + Math.sin(t / 40) * 1.5);
    g.drawImage(logo, (W - logo.width) / 2, ly);
    ART.text(g, 'Nila y el pez gato', W / 2, ly + logo.height + 2, '#f2c46a', 'center', '#1b2430');
    if (t > 40 && (t >> 5) % 2) ART.text(g, Touch.enabled ? 'Toca para empezar' : 'Pulsa Z o espacio', W / 2, 160, '#fff6d6', 'center', '#1b2430');
    ART.text(g, 'gavilanbe · 2026', W - 4, H - 9, '#5f7899', 'right');
  },
  selectCards() { const n = LEVELS.length, cw = 64, gap = 8, x0 = (W - (n * cw + (n - 1) * gap)) / 2; return LEVELS.map((_, i) => ({ x: x0 + i * (cw + gap), y: 54, w: cw, h: 74 })); },
  drawSelect(g) {
    Game.drawScene(g, Game.t, 'night');
    g.fillStyle = 'rgba(8,10,16,.55)'; g.fillRect(0, 0, W, H);
    ART.text(g, 'El pantano', W / 2, 20, '#e79b3f', 'center', '#1b2430');
    ART.text(g, 'Elige por dónde seguir', W / 2, 32, '#9fc0cc', 'center');
    const cards = Game.selectCards(); const d = Save.data;
    cards.forEach((c, i) => {
      const lv = LEVELS[i], locked = i > d.unlocked, sel = i === Game.sel;
      const y = c.y + (sel ? Math.round(Math.sin(Game.t / 12) * 2) - 3 : 0);
      g.fillStyle = sel ? '#e79b3f' : '#1b2430'; g.fillRect(c.x - 1, y - 1, c.w + 2, c.h + 2);
      g.fillStyle = locked ? '#1f2733' : '#26303f'; g.fillRect(c.x, y, c.w, c.h);
      // Little themed vignette with the sky of that level.
      const bg = ART.background(lv.theme); g.drawImage(bg.sky, 60, 20, 160, 60, c.x + 2, y + 2, c.w - 4, 26);
      g.drawImage(bg.mid, 100, 60, 200, 90, c.x + 2, y + 6, c.w - 4, 22);
      if (locked) { g.fillStyle = 'rgba(8,10,16,.6)'; g.fillRect(c.x + 2, y + 2, c.w - 4, 26); }
      ART.text(g, String(i + 1), c.x + c.w / 2, y + 32, locked ? '#5f7899' : '#fff6d6', 'center');
      const lines = ART.wrap(lv.name, c.w - 6); lines.forEach((l, k) => ART.text(g, l, c.x + c.w / 2, y + 42 + k * 9, locked ? '#5f7899' : '#e8fbff', 'center'));
      if (!locked) { const got = d.pearls[i] || 0, tot = d.totals[i]; g.drawImage(ART.pearl[0], c.x + 8, y + 62); ART.text(g, tot !== undefined ? got + '/' + tot : '' + got, c.x + 18, y + 62, '#9ecbd8'); if (d.best[i]) ART.text(g, Game.fmtTime(d.best[i]), c.x + c.w - 4, y + 62, '#5f7899', 'right'); }
      else ART.text(g, lv.boss ? 'jefa' : 'cerrado', c.x + c.w / 2, y + 62, '#5f7899', 'center');
    });
    ART.text(g, Touch.enabled ? 'Toca un nivel para jugar' : '← → elegir · Z jugar · Esc volver', W / 2, 150, '#9fc0cc', 'center');
    if (d.finished) ART.text(g, '★ Pantano completado ★', W / 2, 162, '#f2c46a', 'center');
  },
  fmtTime(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  drawClear(g) {
    const s = Game.clearStats; Game.drawScene(g, Game.t, L.def.theme);
    g.fillStyle = 'rgba(8,10,16,.6)'; g.fillRect(0, 0, W, H);
    const t = Game.clearT;
    g.fillStyle = '#1b2430'; g.fillRect(50, 40, W - 100, 100); g.fillStyle = '#e79b3f'; g.fillRect(50, 40, W - 100, 1); g.fillRect(50, 139, W - 100, 1);
    ART.text(g, '¡A la barca!', W / 2, 48, '#f2c46a', 'center');
    ART.text(g, s.name, W / 2, 62, '#fff6d6', 'center');
    if (t > 20) { g.drawImage(ART.pearl[(t >> 4) % 3], W / 2 - 30, 82); ART.text(g, 'Perlas ' + s.pearls + '/' + s.total, W / 2 - 18, 82, '#e8fbff'); }
    if (t > 40) ART.text(g, 'Tiempo ' + Game.fmtTime(s.secs), W / 2, 96, '#9fc0cc', 'center');
    if (t > 60 && s.pearls === s.total) ART.text(g, '★ Todas las perlas ★', W / 2, 110, '#f2c46a', 'center');
    if (t > 40 && (t >> 5) % 2) ART.text(g, s.last ? 'Continuar' : 'Siguiente nivel', W / 2, 126, '#fff6d6', 'center');
    g.drawImage(ART.nila.win, 60, 100); g.drawImage(ART.fish.full, 67, 108); g.drawImage(ART.hand, 73, 107);
  },
  drawEnding(g) {
    const t = Game.endT; Game.drawScene(g, t, 'dusk');
    // The boat crosses the water with the two aboard; the credits float above.
    const bx = -40 + Math.min(t * .5, 200); const bob = Math.round(Math.sin(t / 22) * 1.5);
    g.drawImage(ART.boat, Math.round(bx), 130 + bob);
    g.drawImage(ART.nila.idle[(t % 200) < 6 ? 1 : 0], Math.round(bx) + 8, 112 + bob); g.drawImage(ART.fish.closed, Math.round(bx) + 15, 120 + bob); g.drawImage(ART.hand, Math.round(bx) + 21, 119 + bob);
    g.fillStyle = 'rgba(8,10,16,.55)'; g.fillRect(0, 0, W, 100);
    const lines = ['La Garza se fue a otro nido', 'y el pantano volvió a su calma.', '', 'Nila remó hasta el embarcadero', 'con Bigotes dormido en el regazo.', '', 'GRACIAS POR JUGAR'];
    const d = Save.data; let tot = 0, all = 0; for (const i in d.totals) { tot += d.pearls[i] || 0; all += d.totals[i]; }
    lines.forEach((l, i) => { if (t > 20 + i * 18) ART.text(g, l, W / 2, 14 + i * 11, i === 6 ? '#f2c46a' : '#fff6d6', 'center'); });
    if (t > 160) ART.text(g, 'Perlas del pantano: ' + tot + '/' + all, W / 2, 168, '#9ecbd8', 'center', '#1b2430');
    if (t > 120 && (t >> 5) % 2) ART.text(g, Touch.enabled ? 'Toca para volver' : 'Z para volver', W - 6, 104, '#9fc0cc', 'right');
  },
  // ---- development scenes
  drawSprites(g) {
    g.fillStyle = '#6a7a8a'; g.fillRect(0, 0, W, H);
    const items = [ART.nila.idle[0], ART.nila.idle[1], ART.nila.run[1], ART.nila.run[2], ART.nila.jump, ART.nila.fall, ART.nila.hurt, ART.nila.win, ART.fish.closed, ART.fish.open, ART.fish.full, ART.fish.spit, ART.fish.swallow, ART.hand,
      ART.snail[0], ART.snail[1], ART.frogSit, ART.frogJump, ART.mosquito[0], ART.mosquito[1], ART.crab[0], ART.crab[1], ART.crate, ART.rock, ART.pearl[0], ART.pearl[1], ART.heart, ART.heartEmpty, ART.lantern.off, ART.lantern.on, ART.sign, ART.boat, ART.mushroom, ART.mushroomSquash, ART.thorns, ART.gate, ART.target.off, ART.target.on, ART.lily, ART.plank, ART.cracked, ART.dirt[0], ART.dirt[1], ART.grassCap[0], ART.grassCap[1], ART.roots, ART.water[0], ART.water[2], ART.waterDeep, ART.reed, ART.tuft, ART.shroomDeco, ART.egg, ART.puff[1], ART.star];
    let x = 2, y = 2, rowH = 0;
    for (const s of items) { if (x + s.width > W - 2) { x = 2; y += rowH + 3; rowH = 0; } g.drawImage(s, x, y); x += s.width + 3; rowH = Math.max(rowH, s.height); }
    y += rowH + 4; g.drawImage(ART.heronBody, 2, y); g.drawImage(ART.heronFly, 40, y); g.drawImage(ART.wingUp, 80, y); g.drawImage(ART.wingDown, 112, y); g.drawImage(ART.wingMid, 144, y);
    g.drawImage(ART.logo(), 180, y); ART.text(g, 'ÁÉÍÓÚÑ ¡HOLA! ¿QUÉ? 0123456789 ·,.:-+', 2, H - 10, '#fff');
  },
  drawIcon(g) {
    // Square badge 180×180 centred on the canvas; tools/iconos.sh crops and scales it.
    const ox = 70, S = 180; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const bg = ART.background('dusk'); g.drawImage(bg.sky, 70, 0, S, S, ox, 0, S, S);
    g.drawImage(bg.mid, 0, 40, 320, 110, ox, 60, S, 62);
    g.fillStyle = '#2f7f88'; g.fillRect(ox, 122, S, 58); g.fillStyle = '#246270'; g.fillRect(ox, 140, S, 40); g.fillStyle = '#1d4a55'; g.fillRect(ox, 160, S, 20);
    g.fillStyle = '#8fd9d0'; for (let x = 0; x < S; x += 4) g.fillRect(ox + x, 122 + (x % 8 ? 1 : 0), 3, 1);
    g.fillStyle = '#fff8e0'; for (let i = 0; i < 6; i++) g.fillRect(ox + 118 - i * 2, 128 + i * 6, 18 + i * 3, 1);
    g.save(); g.translate(ox + 90, 118); g.scale(4, 4); g.translate(-90, -118);
    g.drawImage(ART.nila.idle[0], 68, 97); g.drawImage(ART.fish.full, 75, 105); g.drawImage(ART.hand, 81, 104);
    g.restore();
  }

};

addEventListener('DOMContentLoaded', () => Game.init());
