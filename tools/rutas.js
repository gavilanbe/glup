// GLUP — rutas del bot, una por nivel. { reach: [col, fila] } lleva a Nila a pisar esa celda
// (la fila es la del suelo que pisa); las demás acciones son de Bigotes. Ver tools/bot.js.
'use strict';
const R = (x, y, o) => Object.assign({ reach: [x, y] }, o || {});
const D = (name, ...args) => ({ do: name, args });
// Spit straight up: hold {up} with {fish}; the aim latches for a few frames after {up} is let go.
const UP = [{ hold: { fish: 1, up: 1 }, n: 2 }, { hold: { up: 1 }, n: 1 }, { wait: 10 }];
// Jump, flap and keep {fish} held: with water in the mouth the jet holds Nila up while she drifts `dir`.
const HOVER = (dir, n = 150, run = 0) => { const d = dir < 0 ? { left: 1 } : { right: 1 }; return [...(run ? [{ hold: d, n: run }] : []), { hold: Object.assign({ jump: 1 }, d), n: 16 }, { hold: d, n: 1 }, { hold: Object.assign({ jump: 1 }, d), n: 12 }, { hold: Object.assign({ fish: 1 }, d), n }]; };
// Free-form step: runs `fn(g)` frame by frame (for timing that depends on where Nila is).
const DO = (label, fn) => ({ check: g => { const r = fn(g); return r === undefined ? true : r; }, label });
// Belly-flop once Nila is past `px` (pixels) while walking `dir`: walk off, wait out the coyote time (unless `fall` is false), then {down}+{jump}.
const POUND_AT = (px, dir = 1, fall = true) => DO('panzazo en x=' + px, g => {
  const d = dir < 0 ? { left: 1 } : { right: 1 };
  for (let n = 0; n < 200 && (dir > 0 ? g.P.x < px : g.P.x > px); n++) g.frame(d);
  if (fall) { for (let n = 0; n < 30 && g.P.onGround; n++) g.frame(d); for (let n = 0; n < 8 && !g.P.onGround; n++) g.frame({}); } // past the coyote time, or the press is a plain jump
  else g.frame({});
  g.frame({ down: 1, jump: 1 }); g.frame({ down: 1, jump: 1 });
  for (let n = 0; n < 60 && g.P.pound; n++) g.frame({ down: 1 });
  return g.P.pound ? 'no aterrizó el panzazo' : true;
});
// Search moves that keep the water jet on.
const JET = { extra: [-1, 0, 1].map(dir => ({ dir, jump: 0, hold: { fish: 1 } })) };
// Fill Bigotes with water facing `dir`: spit out whatever else he holds (a bug that flew in) and sip until full.
const WATER = dir => DO('agua', g => {
  const d = dir < 0 ? { left: 1 } : { right: 1 };
  for (let tries = 0; tries < 4; tries++) {
    if (g.P.held && g.P.held.kind === 'agua' && g.P.held.amount >= 1) return true;
    if (g.P.held) { g.run(d, 1); g.run({}, 1); g.run({ fish: 1 }, 2); g.run({}, 12); continue; }
    g.run(d, 1); g.run({}, 2);
    for (let n = 0; n < 60 && !g.P.held; n++) g.frame({ fish: 1 });
    g.run({}, 2);
  }
  return g.P.held && g.P.held.kind === 'agua' || 'no traga agua';
});
// Jump and flap at the top, drifting `dir`.
const FLAP = (dir, n = 14) => { const d = dir < 0 ? { left: 1 } : dir > 0 ? { right: 1 } : {}; return [{ hold: Object.assign({ jump: 1 }, d), n: 16 }, { hold: d, n: 1 }, { hold: Object.assign({ jump: 1 }, d), n }]; };
// Wait until the nearest live `kind` walks away `dir`, run after it and slide into it (the slide flips crabs over).
const BOWL = (kind, dir = 1, maxGap = 1e9) => DO('resbalón contra ' + kind, g => {
  const d = dir < 0 ? { left: 1 } : { right: 1 };
  const e = () => g.L.ents.filter(o => !o.dead && o.kind === kind).sort((a, b) => Math.abs(a.x - g.P.x) - Math.abs(b.x - g.P.x))[0];
  for (let n = 0; n < 900; n++) { const c = e(); if (!c) return 'no hay ' + kind; const gp = dir > 0 ? c.x - g.P.x : g.P.x - c.x; if (c.dir === dir && gp > 50 && gp < maxGap) break; g.frame({}); }
  for (let n = 0; n < 200; n++) {
    const c = e(); if (!c) return 'no hay ' + kind;
    const gap = dir > 0 ? c.x - (g.P.x + g.P.w) : g.P.x - (c.x + c.w);
    if (gap < 30 && Math.abs(g.P.vx) > 1.2) { g.frame(Object.assign({ down: 1 }, d)); for (let k = 0; k < 24 && !c.flipped; k++) g.frame(Object.assign({ down: 1 }, d)); g.run({}, 4); return c.flipped || 'no lo volteó'; }
    const ahead = Math.floor((dir > 0 ? g.P.x + g.P.w + 10 : g.P.x - 10) / 16), below = Math.floor((g.P.y + g.P.h + 2) / 16);
    if (g.P.onGround && g.tileAt(ahead, below) === '~') { g.run(Object.assign({ jump: 1 }, d), 14); continue; }
    g.frame(d);
  }
  return 'no llegó';
});
// Run `dir` and slide once past `px`; then keep running for `n` frames (a low roof keeps the slide going).
const SLIDE_AT = (px, dir = 1, n = 200) => DO('resbalón en x=' + px, g => {
  const d = dir < 0 ? { left: 1 } : { right: 1 };
  for (let k = 0; k < 200 && (dir > 0 ? g.P.x < px : g.P.x > px); k++) g.frame(d);
  g.frame(Object.assign({ down: 1 }, d)); if (!(g.P.slide > 0)) return 'no resbala';
  g.run(d, n);
});
// Stand still until `cond(g)` holds (at most `n` frames).
const UNTIL = (label, cond, n = 3000) => DO(label, g => { for (let k = 0; k < n && !cond(g); k++) g.frame({}); return cond(g) || 'nunca: ' + label; });
// The heron fight, played frame by frame with real inputs. The bot reads her state (it is allowed to know
// what the telegraphs say) and, every frame: gets out of any marked danger (the dive's shadow, the stab's
// reach, the darts' crosses, the falling rocks), counters the wing gust with a puff, and otherwise fetches a
// stone and returns it: up at her when she flies, a charged spit when her beak is stuck or she is dizzy.
const HERON = DO('pelea con la Garza', g => {
  const side = d => d < 0 ? { left: 1 } : d > 0 ? { right: 1 } : {};
  const VULN = { hover: 1, aim: 1, rise: 1, rainUp: 1, fanAir: 1, lock: 1 }, OPEN = { stuck: 1, stagger: 1, land: 1 };
  let charging = 0, sucking = 0, stuckT = 0, lastX = 0, deaths = 0, wasDead = false;
  const log = [];
  for (let n = 0; n < 40000; n++) {
    const b = g.L.boss, P = g.P, L = g.L;
    if (L.boatSpawned) return deaths ? 'Nila murió ' + deaths + ' veces' : true;
    if (P.dead) { if (!wasDead) { deaths++; wasDead = true; log.push('muerte en ' + (b && b.state) + ' fase ' + (b && b.phase)); } charging = 0; sucking = 0; g.frame({}); continue; }
    wasDead = false;
    if (!b || b.dead || !b.fight || b.lock || g.Game.fadeTo || ['intro', 'final', 'dying', 'leave', 'return'].includes(b.state)) { charging = 0; sucking = 0; g.frame({}); continue; }
    const c0 = L.w - 24, floor = (L.h - 3) * 16, wet = b.phase >= 3 || L.bossCk >= 3;
    const lo = (c0 + (wet ? 3 : 1)) * 16 + 12, hi = (L.w - (wet ? 4 : 2)) * 16 - 12;
    const px = P.x + 5, bc = b.x + 15, st = b.state, onFloor = b.y + 30 >= floor - 2;
    // ---- Danger: intervals of x where Nila's centre must not be.
    const zones = [];
    if (st === 'lock' || st === 'plunge') zones.push([b.tx - 32, b.tx + 32]);
    if (st === 'aim' && b.dive === 2) zones.push([bc - 34, bc + 34]);
    if (onFloor && !['stuck', 'stagger', 'reel2'].includes(st)) zones.push([b.x - 10, b.x + 40]);
    if (st === 'windup' || st === 'stab') { const d = b.sdir || b.dir; zones.push(d < 0 ? [b.x - 62, b.x + 40] : [b.x - 10, b.x + 92]); }
    if (st === 'walk' && P2(b) === 'stab') zones.push([bc - 40, bc + 40]);
    if (b.aims) for (const q of b.aims) zones.push([q.sx - 18, q.sx + 18]);
    for (const e of L.ents) if (!e.dead && ((e.kind === 'plume' && !e.stuck) || e.hazard)) { const x = e.kind === 'plume' ? e.sx : e.x + 6, r = e.kind === 'plume' ? 18 : 16; zones.push([x - r, x + r]); }
    if (b.rain) for (const x of b.rain) zones.push([x - 16, x + 16]);
    if (st === 'rainUp' && b.st < 30) zones.push([px - 20, px + 20]);
    const bad = x => zones.some(([a, c]) => x > a && x < c) || x < lo || x > hi;
    const safeNear = x => { x = Math.max(lo, Math.min(hi, x)); if (!bad(x)) return x; for (let d = 2; d < 400; d += 2) { if (!bad(x + d)) return x + d; if (!bad(x - d)) return x - d; } return x; };
    const go = (x, extra = {}) => {
      const d = x - px; const inp = Object.assign({}, Math.abs(d) > 2 ? side(d) : {}, extra);
      // Blocked by a crate: hop onto it.
      if (Math.abs(d) > 6 && P.onGround && Math.abs(P.x - lastX) < .05 && !P.crouch) { if (++stuckT > 3) { inp.jump = 1; stuckT = 0; } } else stuckT = 0;
      lastX = P.x; g.frame(inp);
    };
    // ---- A charge in progress: keep holding, let go when full (or when the window closes).
    if (charging) {
      charging++;
      const open = OPEN[st] || VULN[st];
      if (P.charge >= 40 || !open || charging > 70 || !P.held) { charging = 0; g.frame({}); g.frame({}); continue; }
      if (bad(px)) { charging = 0; g.frame({}); continue; }
      g.frame({ fish: 1 }); continue;
    }
    // ---- The wing gust: empty the mouth, face her and puff back.
    if ((st === 'gustWind' && b.st > 14) || st === 'gust') {
      const toward = bc > px ? 1 : -1;
      if (P.held && P.onGround) { g.frame({}); g.frame({ down: 1, fish: 1 }); g.frame({}); continue; }
      if (!P.held && P.puffCd === 0 && !(P.puffWind > 0)) { if (P.dir !== toward) { g.frame(side(toward)); continue; } g.frame({ puff: 1 }); continue; }
      g.frame({}); continue;
    }
    // ---- Out of harm's way first.
    if (bad(px)) { sucking = 0; go(safeNear(px)); continue; }
    // ---- A stone in the mouth: return it.
    if (P.held) {
      // In the air she sidesteps a stone unless she is committed (aiming, shaking the nest, throwing darts),
      // or has not been hit yet at all.
      const open = OPEN[st] && b.inv === 0, fly = b.inv === 0 && !onFloor && (['aim', 'rainUp', 'fanAir'].includes(st) || (st === 'hover' && b.hp === b.maxHp) || (VULN[st] && b.dodgeCd > 0));
      if (open) {
        const left = st === 'stuck' ? (b.phase === 2 ? 110 : 80) - b.st : st === 'stagger' ? 140 - b.st : 30 - b.st;
        const want = bc + (px < bc ? -52 : 52), dist = Math.abs(px - bc);
        if (dist > 72 || dist < 30) { go(safeNear(want)); continue; }
        const toward = bc > px ? 1 : -1;
        if (P.dir !== toward) { g.frame(side(toward)); continue; }
        if (left > 56 && g.Save.has('guindilla')) { charging = 1; g.frame({ fish: 1 }); continue; }
        g.frame({ fish: 1 }); g.frame({}); continue;
      }
      if (fly) {
        const mx = px + P.dir * 2;
        if (Math.abs(bc - mx) < 7) { g.frame({ fish: 1, up: 1 }); g.frame({ up: 1 }); continue; }
        go(safeNear(bc - P.dir * 2)); continue;
      }
      // She parries now: wait at a distance, baiting the stab when it is due.
      idle(b, P, px, bc, go, safeNear, lo, hi); continue;
    }
    // ---- Empty mouth: fetch the nearest stone.
    const rocks = L.ents.filter(e => !e.dead && e.kind === 'rock' && !e.hazard && e.x + 6 > lo - 10 && e.x + 6 < hi + 10 && !bad(e.x + 6)).sort((a, c) => Math.abs(a.x - P.x) - Math.abs(c.x - P.x));
    if (!rocks.length) { sucking = 0; idle(b, P, px, bc, go, safeNear, lo, hi); continue; }
    const r = rocks[0], rx = r.x + 6;
    if (r.y + r.h < P.y) {
      // Up on a branch or the pile: stand under it and sip upwards.
      const want = rx - P.dir * 2;
      if (Math.abs(want - px) > 4 && !sucking) { go(safeNear(want)); continue; }
      if (++sucking > 50) { sucking = 0; g.frame({}); continue; }
      g.frame({ fish: 1, up: 1 }); continue;
    }
    const d = rx - px, dist = Math.abs(d), toward = Math.sign(d) || 1;
    if (!sucking && (dist > 50 || dist < 28)) { go(safeNear(rx - toward * 40)); continue; }
    if (!sucking && P.dir !== toward) { g.frame(side(toward)); continue; }
    if (++sucking > 50) { sucking = 0; g.frame({}); g.frame({}); continue; }
    g.frame({ fish: 1 });
  }
  return 'la pelea no acabó: ' + log.join('; ');
  // Phase II plan (mirrors garza.js): what she will do next.
  function P2(b) { return ['stab', 'fan', 'stab', 'gust'][b.pat % 4]; }
  // Nothing to shoot yet: in phase II keep just inside her stab range when a stab is due (so she stabs and
  // misses), hop over her if cornered; otherwise wait at a safe distance.
  function idle(b, P, px, bc, go, safeNear, lo, hi) {
    if (b.phase === 2 && b.state === 'walk') {
      const away = px < bc ? -1 : 1, room = away < 0 ? px - lo : hi - px;
      if (room < 70 && Math.abs(px - bc) < 90) {
        // Cornered: jump over her.
        if (P.onGround && Math.abs(px - bc) < 58) { g.frame(Object.assign({ jump: 1 }, side(-away))); for (let k = 0; k < 14; k++) g.frame(Object.assign({ jump: 1 }, side(-away))); g.frame(side(-away)); for (let k = 0; k < 12; k++) g.frame(Object.assign({ jump: 1 }, side(-away))); for (let k = 0; k < 40 && !P.onGround; k++) g.frame(side(-away)); return; }
        go(bc - away * 40); return;
      }
      if (P2(b) === 'stab') { go(safeNear(bc + away * 50)); return; }
      go(safeNear(bc + away * 96)); return;
    }
    go(safeNear(px));
  }
});
// Ride the raft to the right, puffing backwards, and hop up for any cría that passes overhead.
const RAFT = DO('balsa', g => {
  const raft = g.L.ents.find(e => e.kind === 'raft'); if (!raft) return 'sin balsa';
  for (let n = 0; n < 900; n++) {
    const P = g.P; if (P.dead) return 'Nila se cayó';
    if (P.onGround && P.carrier === raft && Math.abs(raft.vx) < .6 && raft.x > 850) return true;
    if (!P.onGround) { const t = raft.x + 7; g.frame(Object.assign({ jump: 1 }, P.x < t - 1 ? { right: 1 } : P.x > t + 1 ? { left: 1 } : {})); continue; }
    const cria = g.L.ents.find(e => e.kind === 'pearl' && e.y < P.y && Math.abs(e.x + 4 - (P.x + 5 + raft.vx * 12)) < 9);
    if (cria) { g.frame({ jump: 1 }); continue; }
    if (raft.vx < .6) { g.frame({ left: 1 }); g.run({}, 3); g.frame({ puff: 1 }); g.run({}, 8); continue; }
    g.frame({});
  }
  return 'la balsa no llegó';
});
const near = (kind, side, fromX) => ({ reach: require('./bot').beside(kind, side, fromX), tol: 1 });
module.exports = [
  { powers: [], steps: [
    R(16, 9), R(23, 11), D('face', 1), D('suck', 40), D('spit', 1), { wait: 30 }, R(37, 11),
    R(58, 11, { crouch: true }), R(60, 11), D('face', 1), D('suck', 40), D('spit', 1), { wait: 20 },
    near('crate', -2, 66), D('face', 1), D('suck', 40), R(72, 11), D('drop'), R(75, 7),
    R(85, 11), R(96, 6), R(105, 11), R(111, 11), R(116, 11), R(119, 11),
    R(126, 11), R(130, 11), D('puff', 1), R(140, 11),
    R(142, 11), D('puff', 1), R(157, 11),
    R(160, 11), D('face', 1), D('suck', 40), R(172, 11), D('drop'), R(176, 5),
    R(193, 11), D('face', 1), D('suck', 40), D('spit', 1), { wait: 60 },
    near('rock', -2), D('face', 1), D('suck', 40), D('spit', 1), { wait: 30 }, R(216, 11), R(215, 8, { tol: 1 }),
    R(231, 10, { tol: 2 })] },
  { powers: ['aleteo', 'soplido'], steps: [
    near('rock', -2), D('face', 1), D('suck', 40), R(24, 11), D('face', 1), D('spit', 1), { wait: 40 }, near('crab', -2), D('face', 1), D('suck', 40), D('spit', 1), { wait: 30 },
    { check: g => g.L.hitTargets.size === 1 || 'la diana 1 no se abrió' }, R(28, 11), ...FLAP(0), R(38, 11),
    R(41, 11), R(44, 10, { tol: 1 }), RAFT, R(58, 11),
    R(63, 11), R(73, 2), R(84, 2), R(95, 11),
    R(108, 11), { hold: { fish: 1, up: 1 }, n: 140 },
    { hold: { left: 1, jump: 1 }, n: 14 }, { hold: { fish: 1, up: 1 }, n: 160 }, { check: g => g.P.hanging || 'no volvió al aro' }, { hold: { fish: 1, up: 1, right: 1, jump: 1 }, n: 12 }, R(112, 1),
    R(127, 11), near('rock', -2), D('face', 1), D('suck', 40), R(131, 11), D('face', 1), ...UP, { wait: 30 },
    { check: g => g.L.hitTargets.size === 2 || 'la diana 2 no se abrió' }, R(138, 11),
    R(141, 11), { hold: { right: 1 }, n: 1 },
    DO('aros, salto atrás a la cría y vuelta al aro', g => {
      for (let n = 0; n < 110 && !(g.P.hanging && g.P.x > 2420); n++) g.frame({ fish: 1 });
      if (!g.P.hanging) return 'no llegó al aro';
      g.frame({ fish: 1, jump: 1, left: 1 }); g.run({ jump: 1, left: 1 }, 17); g.run({ jump: 1, right: 1 }, 6);
      for (let n = 0; n < 60 && !g.P.hanging; n++) g.frame({ fish: 1, right: 1 });
      return g.P.hanging || 'no volvió al aro';
    }), { hold: { fish: 1, right: 1, jump: 1 }, n: 14 }, R(157, 11),
    near('rock', -2), D('face', 1), D('suck', 40), D('spit', 1), { wait: 20 }, D('suck', 40), D('spit', 1), { wait: 20 }, D('suck', 40),
    R(172, 11), D('face', 1), D('spit', 1), { wait: 30 },
    { check: g => g.L.hitTargets.size === 3 || 'la diana 3 no se abrió' }, R(167, 11), ...FLAP(0), R(178, 11),
    R(189, 8), R(197, 10, { tol: 2 })] },
  { powers: ['aleteo', 'soplido', 'ventosa', 'mordisco'], steps: [
    R(24, 11), D('face', 1), D('suck', 40), D('spit', 1), { wait: 30 }, R(40, 11), R(45, 11), D('face', 1), D('suck', 40), ...HOVER(1, 14, 14), { hold: { right: 1 }, n: 14 }, { hold: { fish: 1, right: 1 }, n: 110 }, R(60, 11), D('spit', -1), { wait: 10 },
    near('crate', -2), D('face', 1), D('suck', 40), R(70, 11), D('drop'), { wait: 40 }, R(77, 11), R(82, 11), R(86, 7), R(90, 7),
    { hold: { jump: 1 }, n: 8 }, { hold: {}, n: 1 }, { hold: { down: 1, jump: 1 }, n: 2 }, { hold: { down: 1 }, n: 30 }, { wait: 20 },
    R(107, 11), POUND_AT(1741, 1, false), { hold: { right: 1 }, n: 70 }, R(116, 1), R(125, 1), { hold: { right: 1, jump: 1 }, n: 18 }, { hold: { right: 1 }, n: 1 }, { hold: { right: 1, jump: 1 }, n: 40 }, { hold: { right: 1 }, n: 20 },
    { hold: { right: 1, jump: 1 }, n: 14 }, { hold: { left: 1 }, n: 14 }, R(133, 4, { tol: 1 }), R(133, 11), { hold: { left: 1 }, n: 1 }, { hold: { fish: 1 }, n: 80 }, { wait: 2 }, D('spit', 1), { wait: 20 }, D('face', -1), D('suck', 40), D('spit', 1), { wait: 30 },
    R(143, 11), D('face', 1), D('suck', 40), ...HOVER(1, 20, 6), R(151, 11, JET), WATER(1), UNTIL('mosquito lejos', g => g.L.ents.filter(e => e.kind === 'mosquito' && Math.abs(e.x - g.P.x) < 200).every(e => e.dir > 0 && e.x > 2470)), ...HOVER(1, 110, 4), R(168, 11), { hold: { jump: 1 }, n: 40 },
    near('crate', -2), D('face', 1), D('suck', 40), R(190, 8, { tol: 1 }), D('drop'), { wait: 30 },
    { hold: { jump: 1, right: 1 }, n: 16 }, { hold: { right: 1 }, n: 1 }, { hold: { jump: 1, right: 1 }, n: 14 }, R(200, 11), D('face', 1), D('suck', 40), D('spit', 1), { wait: 30 },
    R(209, 11), { hold: { jump: 1 }, n: 30 }, R(214, 10, { tol: 2 }), { hold: { right: 1 }, n: 30 }] },
  { powers: ['aleteo', 'soplido', 'ventosa', 'mordisco', 'chorro', 'panzazo'], steps: [
    R(6, 11), near('rock', -2), D('face', 1), D('suck', 40), R(14, 11), D('charge', 1), { wait: 40 }, R(8, 11), ...FLAP(0), R(20, 11), R(40, 11),
    R(42, 11), WATER(1), D('spit', 1), { wait: 30 }, R(51, 11), ...FLAP(0),
    R(42, 11), UNTIL('cangrejo al fondo del túnel', g => g.L.ents.some(e => e.kind === 'crab' && e.dir > 0 && e.x > 1150)), R(62, 11), { check: g => g.Save.has('resbalon') || 'sin resbalón' }, D('face', 1), D('puff', 1), { check: g => g.L.ents.some(e => e.kind === 'pinwheel' && e.spin > 0) || 'el molinillo no gira' }, R(58, 11), SLIDE_AT(1008, 1, 220),
    R(96, 11), R(109, 11), { hold: { fish: 1, up: 1 }, n: 160 },
    { hold: { left: 1, jump: 1 }, n: 18 }, { hold: { fish: 1, up: 1 }, n: 160 }, { check: g => g.P.hanging || 'no volvió al aro' }, { hold: { fish: 1, up: 1, right: 1, jump: 1 }, n: 12 }, R(114, 1, { tol: 1 }), R(126, 1),
    UNTIL('cangrejos lejos', g => g.L.ents.filter(e => e.kind === 'crab' && e.x > 2040).every(e => e.x > 2100)),
    DO('salto a la cría y panzazo', g => { while (g.P.x < 2040) g.frame({ right: 1 }); g.frame({ right: 1, jump: 1 }); for (let n = 0; n < 60 && g.P.x < 2070; n++) g.frame({ right: 1, jump: 1 }); g.frame({}); g.run({ down: 1, jump: 1 }, 2); for (let n = 0; n < 80 && g.P.pound; n++) g.frame({ down: 1 }); return !g.P.pound || 'sin panzazo'; }), { wait: 4 }, DO('atrás', g => { for (let n = 0; n < 20 && g.P.x > 2050; n++) g.frame({ left: 1 }); g.run({}, 6); g.frame({ right: 1 }); }),
    DO('sorbe la piedra', g => { for (let n = 0; n < 30 && !g.P.held; n++) g.frame({ fish: 1 }); g.frame({}); return !!g.P.held || 'sin piedra'; }),
    { hold: { fish: 1 }, n: 44 }, { wait: 30 }, { check: g => g.L.hitTargets.size === 1 || 'la diana no se abrió' },
    R(139, 11), near('rock', -2), D('face', 1), D('suck', 40), R(143, 11), { wait: 24 }, D('charge', 1), { wait: 40 }, R(157, 11), R(167, 11), R(172, 10, { tol: 2 }), { hold: { right: 1 }, n: 30 }] },
  { powers: ['aleteo', 'soplido', 'ventosa', 'mordisco', 'chorro', 'panzazo', 'guindilla', 'resbalon'], steps: [
    R(8, 9), R(18, 11), R(27, 8), R(39, 11), HERON, R(57, 12, { tol: 3 }), { wait: 60 }] },
];
