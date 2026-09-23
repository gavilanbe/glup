// GLUP — la Garza, jefa del nido. Una pelea en tres fases, cada una con su truco, su música y su
// punto de control; todo ataque avisa al menos medio segundo antes (sombra, grito, alas, líneas).
//   I   El vuelo — planea, suelta piedras (la munición) y se lanza en picado donde marca la sombra.
//       Se le devuelven las piedras hacia arriba; tras el picado se queda un momento en el suelo.
//   II  El barro — rompe el nido y baja al suelo. Para con el ala lo que le tires, salvo cuando:
//       · el picotazo falla y el pico se le clava en el barro (el escupitajo picante quita dos, el panzazo vale);
//       · bate las alas para echarte a las zarzas y le soplas en contra: pierde el equilibrio.
//       Y lanza plumas en abanico: unas cruces rojas marcan dónde caerán.
//   III La furia — ojos rojos y sube el agua por los lados. Lluvia de piedras con sombras, doble picado
//       (el segundo la deja clavada) y abanico desde el aire.
// Cada golpe le hace escupir una cría; el último, a cámara lenta y con destello, suelta todas las que quedan.
'use strict';
const Boss = (() => {
  const MAX_HP = 8, CRIAS = 10, PHASE_HP = [8, 6, 3], HOVER_Y = 64, SONGS = ['heron', 'heron2', 'heron3'];
  // Phase II plan, in order: a stab, a fan of feathers, another stab, the wing gust.
  const P2 = ['stab', 'fan', 'stab', 'gust'], P3 = ['dive', 'rain', 'fan', 'dive', 'fan', 'rain'];
  // She can be hurt in these states; in these others she parries with a wing (¡TOC!).
  // Gliding about she sees a stone coming and sidesteps it (not before the first blow, so phase I can teach):
  // she has to be caught while committed — aiming a dive, on the ground, shaking the nest or throwing darts.
  const DODGE = { hover: 1, rise: 1 };
  const VULN = { hover: 1, aim: 1, lock: 1, plunge: 1, land: 1, rise: 1, stuck: 1, stagger: 1, rainUp: 1, fanAir: 1 };
  const PARRY = { walk: 1, windup: 1, stab: 1, pull: 1, yank: 1, gustWind: 1, gust: 1, fanWind: 1, fanPost: 1 };
  // Touching her hurts in these (never while she is stuck, dizzy, knocked about or in a cutscene).
  const HARM = { hover: 1, aim: 1, lock: 1, plunge: 1, land: 1, rise: 1, walk: 1, windup: 1, stab: 1, pull: 1, yank: 1, gustWind: 1, gust: 1, fanWind: 1, fanPost: 1, rainUp: 1, fanAir: 1 };
  const SPAWN = 'sfmKcr*HL?EBOR!N@PV';

  // ---------------------------------------------------------------- El ruedo
  // The arena is the last 24 columns: a gate of bars on its left, brambles at both ends, two branches,
  // and the nest up on the dead cypress.
  function arena(phase) {
    const c0 = L.w - 24, floor = (L.h - 3) * TS, wet = (phase || L.bossCk || 0) >= 3;
    return { c0, x0: c0 * TS, x1: L.w * TS, floor, lo: (c0 + (wet ? 3 : 1)) * TS + 6, hi: (L.w - (wet ? 4 : 2)) * TS - 6,
      perch: { x: (c0 + 12) * TS, y: 4 * TS }, entry: { x: (c0 + 3) * TS + 3, y: floor - 20 }, mid: (c0 + 12) * TS };
  }
  const WET_COLS = A => [A.c0, A.c0 + 1, A.c0 + 2, L.w - 4, L.w - 3, L.w - 2, L.w - 1];
  function arenaTiles(phase) {
    const A = arena(phase), out = [];
    for (let y = 4; y <= L.h - 4; y++) out.push([A.c0 - 1, y, 'G']);
    out.push([A.c0, L.h - 4, '^']);
    if (phase >= 2) { for (let x = A.c0 + 9; x <= A.c0 + 14; x++) out.push([x, 4, '.']); for (let x = A.c0 + 10; x <= A.c0 + 13; x++) out.push([x, 9, '=']); }
    if (phase >= 3) for (const x of WET_COLS(A)) out.push([x, L.h - 4, '.'], [x, L.h - 3, '~'], [x, L.h - 2, '~']);
    return out;
  }
  // Put the arena back as it was at the start of `phase` (a respawn at a phase checkpoint).
  function applyArena(phase) {
    const A = arena(phase);
    for (let y = 0; y < L.h; y++) for (let x = A.c0 - 1; x < L.w; x++) { const ch = L.def.rows[y][x]; L.t[y][x] = SPAWN.includes(ch) ? '.' : ch; }
    for (const [x, y, ch] of arenaTiles(phase)) setTile(x, y, ch);
  }
  function rocks() {
    let n = 0; for (const e of L.ents) if (!e.dead && e.kind === 'rock') n++;
    for (const p of L.projs) if (!p.dead && p.kind === 'rock') n++; if (Player.held && Player.held.kind === 'rock') n++; return n;
  }
  function dust(x, y, n = 10, spread = 1.5) { spawnParts(n, x, y, { color: ['#c9b08a', '#a08a6a', '#6a5a4a'], angle: -Math.PI / 2, spread, speed: [.5, 2.4], life: [12, 26] }); }
  function feathers(x, y, n = 8) { spawnParts(n, x, y, { color: ['#e9eef2', '#a9b8c9', '#7d8fa6'], speed: [.3, 1.8], life: [24, 50], g: .02, kind: 'feather' }); }
  function set(b, s) { b.state = s; b.st = 0; }
  function face(b, px) { b.dir = px < b.x + 15 ? -1 : 1; }
  function shriek(b, big) {
    Sound.play('shriek', big ? 1 : .6); b.shriek = big ? 50 : 30; Input.rumble(big ? 300 : 120, big ? .8 : .3, .5);
    Game.word(big ? '¡KRAAAAA!' : '¡KRAAA!', b.x + 15, b.y - 10 < Cam.y + 30 ? b.y + 50 : b.y - 10, big ? '#ff9a6a' : '#f2c46a', true); Cam.shake(big ? 4 : 1, big ? 30 : 8);
  }
  // The beak: where the tip is, standing (for mud and glints).
  function beak(b, A) { return { x: b.dir < 0 ? b.x - 10 : b.x + 40, y: A.floor - 2 }; }

  // ---------------------------------------------------------------- Crear y reaparecer
  function create() {
    // A capture scene can start at a phase checkpoint: FASE=2 (tools/captura.sh), FASE=2.3 with her plan at step 3,
    // FASE=1.trans1 straight into a state.
    const fase = typeof location !== 'undefined' && Game.capture && /[?&]fase=(\d)(?:\.(\d))?(?:\.(\w+))?/.exec(location.search || '');
    if (fase && !L.bossCk) { L.bossCk = +fase[1]; applyArena(L.bossCk); L.checkpoint = { x: arena().entry.x, y: arena().entry.y }; }
    const A = arena(), ck = L.bossCk || 0;
    const b = { kind: 'heron', boss: true, x: A.perch.x + 90, y: -80, w: 30, h: 28, vx: 0, vy: 0, dir: -1, t: 0, st: 0, state: 'wait', phase: 1, hp: MAX_HP, maxHp: MAX_HP,
      flash: 0, inv: 0, shriek: 0, lock: false, card: null, pat: 0, tx: 0, dive: 0, air: true, rage: 0, fight: false, aims: null, rain: null, whiteT: 0, redT: 0, riseTo: HOVER_Y, after: 'hover', gdir: 1, sdir: -1, hx: 0, dodge: 0, dodgeCd: 0,
      update, draw, dead: false };
    if (ck >= 4) { b.dead = true; return b; }
    if (ck) { b.fight = true; b.phase = ck; b.hp = PHASE_HP[ck - 1]; b.rage = ck >= 3 ? 1 : 0; b.x = A.x1 - 10; b.y = -50; set(b, 'return'); }
    if (fase) {
      b.pat = +(fase[2] || 0); const s = fase[3];
      if (s) { b.x = A.mid + 30; b.y = s === 'trans1' || s === 'final' ? HOVER_Y : A.floor - 30; b.air = b.y < A.floor - 30; b.hp = s === 'trans1' ? PHASE_HP[1] : s === 'trans2' ? PHASE_HP[2] : s === 'final' ? 1 : b.hp; set(b, s); if (s === 'final') { b.hp = 0; finale(b); } }
    }
    return b;
  }
  // Nila died after the fight began: back at the arena gate, the arena as it was when this phase began,
  // the crías already freed stay freed. Returns false before the fight (then the level reloads).
  function restart() {
    const ck = L.bossCk || 0; if (!ck) return false;
    if (ck < 4) applyArena(ck);
    spawnEntities();
    const A = arena(Math.min(ck, 3)); L.checkpoint = { x: A.entry.x, y: A.entry.y };
    if (ck >= 4) { L.ents.push(Item.boat((L.w - 4) * TS + 2, A.floor + 14)); L.boatSpawned = true; }
    Player.reset(L.checkpoint.x, L.checkpoint.y, true); Player.lastSafe = null;
    return true;
  }
  function song() { const ck = L.bossCk || 0; return ck >= 4 ? 'dock' : ck ? SONGS[ck - 1] : L.def.music; }
  // Slow motion after the last blow: two frames out of three stand still.
  function skip() { if (!(L.bossSlow > 0)) return false; L.bossSlow--; return L.bossSlow % 3 !== 0; }

  // ---------------------------------------------------------------- Estados
  const S = {
    // Out of sight until Nila walks into the arena.
    wait(b, A, px, P) { b.x = A.perch.x + 100; b.y = -80; if (px > A.x0 + 40 && P.onGround && !P.dead) set(b, 'intro'); },
    // The gate slams, the camera looks up at the nest, she lands on it and shrieks; her name card slides in.
    intro(b, A, px) {
      const pc = A.perch;
      if (b.st === 1) {
        b.fight = true; b.lock = true; L.bossCk = 1; L.checkpoint = { x: A.entry.x, y: A.entry.y }; Sound.stopMusic(); Sound.play('gate'); Sound.play('thud');
        for (const [x, y, ch] of arenaTiles(1)) { setTile(x, y, ch); if (ch === 'G') spawnParts(2, x * TS + 8, y * TS + 8, { color: ['#c78d4e', '#a56f38'], speed: [.3, 1.2], life: [10, 20], g: .1 }); }
        dust(A.x0 - 8, A.floor, 12); Cam.shake(3, 12);
      }
      if (b.st < 36) { b.x = pc.x + 100; b.y = -70; b.air = true; }
      else if (b.st < 100) { const k = (b.st - 36) / 64, e = 1 - (1 - k) * (1 - k); b.x = pc.x + 100 - 115 * e; b.y = -70 + (pc.y - 30 + 70) * e; b.air = true; if (b.st % 14 === 0) Sound.play('flap'); }
      else { b.air = false; b.x = pc.x - 15; b.y = pc.y - 30; }
      if (b.st === 100) { Sound.play('thud'); Cam.shake(2, 8); spawnParts(10, pc.x, pc.y, { color: ['#4a2e1a', '#6b4a30', '#c78d4e'], angle: -Math.PI / 2, spread: 1.4, speed: [.5, 1.8], life: [14, 26], g: .12 }); }
      if (b.st > 36) face(b, px);
      if (b.st === 118) { shriek(b, true); Game.stop(8); Sound.playMusic(SONGS[0]); b.card = { title: 'La Garza', sub: 'reina del ciprés muerto', t: 0, life: 220 }; }
      if (b.st >= 180) { b.lock = false; b.air = true; set(b, 'hover'); }
    },
    // After a respawn: she swoops back in, shrieks, and the phase goes on.
    return(b, A, px) {
      const ground = b.phase === 2, ty = ground ? A.floor - 30 : HOVER_Y;
      b.air = true; b.x = lerp(b.x, A.mid + 50 - 15, .05); b.y = lerp(b.y, ty, .06); face(b, px);
      if (b.st === 40) shriek(b, false);
      if (b.st >= 70) { if (ground) { b.y = A.floor - 30; b.air = false; set(b, 'walk'); } else set(b, 'hover'); }
    },
    // ---- I and III: in the air
    // Glides to a spot beside Nila (picked once, so she can be walked under) and bobs there.
    hover(b, A, px) {
      const p3 = b.phase === 3, dur = p3 ? 80 : 150, off = [70, -70, 40, -40][b.pat % 4] * (p3 ? .8 : 1);
      if (b.st === 1 || (!p3 && b.st === 80)) b.hx = clamp(px + off * (b.st === 1 ? 1 : -.6), A.x0 + 80, A.x1 - 80);
      b.air = true; b.x = lerp(b.x, b.hx - 15, p3 ? .05 : .03);
      b.y = lerp(b.y, HOVER_Y + Math.sin(b.t / (p3 ? 12 : 22)) * (p3 ? 6 : 4), .1); face(b, px);
      if (b.phase === 1 && (b.st === 30 || b.st === 100)) dropRock(b);
      if (b.st > dur) nextAir(b);
    },
    // Follows Nila from above, rising; then the mark is fixed.
    aim(b, A, px) {
      const n = b.dive === 2 ? 10 : 24, x = clamp(px, A.lo, A.hi);
      b.air = true; b.x = lerp(b.x, x - 15, .12); b.y = lerp(b.y, b.dive === 2 ? 80 : HOVER_Y - 6, .1); face(b, px);
      if (b.st >= n) { b.tx = x; set(b, 'lock'); }
    },
    // The shadow blinks where she will fall; she shrieks and trembles.
    lock(b) {
      const n = b.phase === 1 ? 34 : b.dive === 2 ? 26 : 28;
      if (b.st === 1) shriek(b, false);
      b.x = b.tx - 15 + Math.sin(b.st * 1.3) * 1.2;
      if (b.st >= n) { b.vy = 1; set(b, 'plunge'); Sound.play('swoop'); }
    },
    plunge(b, A) {
      b.vy = Math.min(b.vy + .9, 9); b.y += b.vy; b.x = lerp(b.x, b.tx - 15, .3);
      if (b.y + 30 >= A.floor) {
        b.y = A.floor - 30; b.air = false; Cam.shake(b.phase === 3 ? 4 : 3, 10); Sound.play('stab'); Sound.play('thud'); Input.rumble(120, .5, .3);
        dust(b.x + 15, A.floor, 14, 1.7); L.parts.push({ x: b.x + 7, y: A.floor - 2, vx: 0, vy: 0, life: 8, color: '#c9b08a', size: 1, g: 0, kind: 'ring' });
        if (b.phase === 3 && b.dive === 2) set(b, 'stuck'); else set(b, 'land');
      }
    },
    // A beat on the ground after the dive (in phase I a window for a straight shot).
    land(b) {
      b.air = false;
      if (b.st >= (b.phase === 1 ? 30 : 10)) {
        if (b.phase === 3 && b.dive === 1) { b.dive = 2; b.riseTo = 80; b.after = 'aim'; } else { b.riseTo = HOVER_Y; b.after = 'hover'; }
        set(b, 'rise');
      }
    },
    rise(b, A, px) {
      b.air = true; b.y -= b.phase === 3 ? 3.2 : 2.4; face(b, px);
      if (b.y <= b.riseTo) { b.y = b.riseTo; set(b, b.after); }
    },
    // Hit in the air: knocked up and spinning, then back to it.
    reel(b, A) {
      b.air = true; if (b.st === 1) b.vy = -2.4; b.vy = Math.min(b.vy + .12, 1.5); b.y = clamp(b.y + b.vy, 24, A.floor - 40); b.x = clamp(b.x - b.dir * 1.2, A.x0, A.x1 - 30);
      if (b.st % 5 === 0) feathers(b.x + 15, b.y + 12, 2);
      if (b.st >= 40) { b.riseTo = HOVER_Y; b.after = 'hover'; set(b, b.y > HOVER_Y + 4 ? 'rise' : 'hover'); }
    },
    // ---- III: the rain of rocks
    rainUp(b, A, px) {
      b.air = true; b.x = lerp(b.x, A.mid - 15, .06); b.y = lerp(b.y, 48, .08); face(b, px);
      if (b.st === 26) { Sound.play('rumble'); Cam.shake(4, 30); Game.word('¡KRAK!', A.mid, 60, '#f2c46a', true); b.rain = [0, 72, -72, 144, -144].map(o => px + o).filter(x => x > A.lo && x < A.hi); }
      if (b.rain && b.st >= 30 && (b.st - 30) % 12 === 0 && b.rain.length) rainRock(b.rain.shift());
      if (b.st >= 30 + 12 * 5 + 40) set(b, 'hover');
    },
    // ---- III: a fan of feathers from the air
    fanAir(b, A, px) {
      b.air = true; b.y = lerp(b.y, HOVER_Y + 6, .08); if (b.st < 10) face(b, px);
      if (b.st === 1) Sound.play('ruffle');
      if (b.st === 10) b.aims = fanAims(b, A, true);
      if (b.st === 40) fire(b);
      if (b.st % 4 === 0 && b.st < 36) feathers(b.x + 15, b.y + 12, 1);
      if (b.st >= 60) set(b, 'hover');
    },
    // ---- II: on the ground
    walk(b, A, px) {
      b.air = false; b.y = A.floor - 30; face(b, px);
      const dx = px - (b.x + 15), want = P2[b.pat % P2.length];
      if (Math.abs(dx) > 44) b.x = clamp(b.x + Math.sign(dx) * .75, A.x0 + 18, A.x1 - 48);
      if (b.st < 26) return;
      if (want === 'stab' && Math.abs(dx) < 60) return set(b, 'windup');
      if (want === 'fan' && b.st > 40) return set(b, 'fanWind');
      if (want === 'gust' && b.st > 40) return set(b, Math.abs(dx) > 50 ? 'gustWind' : 'windup');
      if (b.st > 160) set(b, Math.abs(dx) > 80 ? 'gustWind' : 'windup');
    },
    // The stab: she rears back (a "!" and a glint on the beak) and strikes where Nila stands.
    windup(b) {
      if (b.st === 1) { b.sdir = b.dir; Sound.play('charge'); }
      if (b.st >= 30) { b.hurtNila = false; set(b, 'stab'); Sound.play('stab'); }
    },
    stab(b, A) {
      b.dir = b.sdir;
      if (b.st <= 8) b.x = clamp(b.x + b.sdir * 2, A.x0 + 4, A.x1 - 34);
      const P = Player;
      if (b.st >= 2 && b.st <= 12 && P.inv === 0 && !P.dead && !P.win && overlap(stabZone(b, A), P.rect())) { P.hurt(-b.sdir); b.hurtNila = true; }
      if (b.st === 9) { const k = beak(b, A); Cam.shake(2, 6); Sound.play('squelch'); spawnParts(10, k.x, k.y, { color: ['#6a5a4a', '#8a7058', '#c9b08a'], angle: -Math.PI / 2, spread: 1.2, speed: [.8, 2.4], life: [12, 22], g: .15 }); }
      if (b.st >= 12) set(b, b.hurtNila ? 'pull' : 'stuck');
    },
    pull(b) { if (b.st >= 24) { b.pat++; set(b, 'walk'); } },
    // The beak is in the mud: the window. Longer in phase II, shorter when she is furious.
    stuck(b, A) {
      b.air = false; const n = b.phase === 2 ? 110 : 80, k = beak(b, A);
      if (b.st === 1) { Game.word('¡ATASCADA!', b.x + 15, b.y - 10, '#fff6d6', true); Sound.play('squelch'); }
      if (b.st % 7 === 0) spawnParts(2, k.x, k.y, { color: ['#6a5a4a', '#8a7058'], angle: -Math.PI / 2 - b.dir * .4, spread: .6, speed: [.6, 1.6], life: [10, 18], g: .15 });
      if (b.st >= n) set(b, 'yank');
    },
    // She pulls the beak free with a spray of mud; the stab loosens a stone (ammo for the next window).
    yank(b, A) {
      if (b.st === 1) {
        const k = beak(b, A); Sound.play('squelch'); spawnParts(14, k.x, k.y, { color: ['#6a5a4a', '#8a7058', '#c9b08a'], angle: -Math.PI / 2, spread: 1.4, speed: [1, 3], life: [14, 26], g: .15 });
        if (rocks() < 2) { const r = Item.rock(clamp(k.x - 6, A.lo, A.hi - 12), A.floor - 14); r.vy = -3.2; r.vx = -b.dir * 1.4; L.ents.push(r); Game.word('¡CLOC!', k.x, k.y - 12, '#c9b08a', false); }
      }
      if (b.st >= 18) {
        if (b.phase === 2) { b.pat++; set(b, 'walk'); }
        else { b.riseTo = HOVER_Y; b.after = 'hover'; set(b, 'rise'); }
      }
    },
    // The wing gust: wings up and the leaves rush to her (the warning), then a gale that pushes Nila to the brambles.
    // A puff against it breaks it and she loses her balance.
    gustWind(b, A, px) {
      if (b.st === 1) { b.gdir = px >= b.x + 15 ? 1 : -1; Sound.play('inhale'); Game.word('¡FFF...!', b.x + 15, b.y - 10, '#dff2fb', false);
        if (!L.bossGustHint) { L.bossGustHint = true; Game.toast(Game.signText(null, '¡Sopla con {puff} contra su viento!'), 170); } }
      if (b.st % 2 === 0) { const d = rnd(30, 90); L.parts.push({ x: b.x + 15 + b.gdir * d, y: A.floor - rnd(2, 40), vx: -b.gdir * 2.2, vy: 0, life: Math.round(d / 2.2), color: ['#7fb040', '#a3cf52', '#c9b08a'][(Math.random() * 3) | 0], size: 1, g: 0, kind: 'leaf', ph: 0 }); }
      if (b.st > 12 && countered(b, px)) return clash(b);
      if (b.st >= 40) { set(b, 'gust'); Sound.play('gustWind'); }
    },
    gust(b, A, px) {
      const P = Player;
      if (countered(b, px)) return clash(b);
      if (b.st > 4 && !P.dead && !P.win) {
        let push = P.onGround ? 1.6 : 2; if (P.crouch) push *= .5; if (shelter(b, P)) push = 0;
        if (push) { moveX(P, b.gdir * push); if (Math.sign(P.vx) === -b.gdir) P.vx *= .9; }
      }
      for (let i = 0; i < 2; i++) L.parts.push({ x: b.x + 15 + b.gdir * rnd(10, 30), y: A.floor - rnd(2, 44), vx: b.gdir * rnd(3, 5.5), vy: rnd(-.3, .3), life: rnd(20, 40) | 0, max: 30, color: ['#f2fbff', '#dff2fb', '#a8d4ea'][i], size: 1, g: 0, kind: 'mist' });
      if (b.st % 3 === 0) spawnParts(1, b.x + 15 + b.gdir * rnd(20, 120), A.floor - 1, { color: ['#7fb040', '#c9b08a'], angle: b.gdir > 0 ? -.3 : Math.PI + .3, spread: .3, speed: [2, 4], life: [16, 30], g: .02, kind: 'leaf' });
      if (b.st % 24 === 1) Sound.play('gust');
      if (b.st >= 120) { b.pat++; set(b, 'walk'); }
    },
    // Countered: off balance, dizzy, open.
    stagger(b, A) {
      b.air = false; if (b.st < 14) b.x = clamp(b.x - b.gdir * 1.2, A.x0 + 4, A.x1 - 34);
      if (b.st % 9 === 0) feathers(b.x + 15, b.y + 10, 1);
      if (b.st >= 140) { b.pat++; set(b, 'walk'); }
    },
    // A volley of feather darts: she puffs up (bristling), red marks show where each will land, then she lobs them.
    fanWind(b, A) {
      if (b.st === 1) Sound.play('ruffle');
      if (b.st % 4 === 0) feathers(b.x + 15 + rnd(-8, 8), b.y + 12, 1);
      if (b.st === 10) b.aims = fanAims(b, A, false);
      if (b.st >= 40) { fire(b); set(b, 'fanPost'); }
    },
    fanPost(b) { if (b.st >= 40) { b.pat++; set(b, 'walk'); } },
    // Hit while stuck or dizzy: she stumbles back.
    reel2(b, A) { b.air = false; if (b.st < 16) b.x = clamp(b.x - b.dir * 1.6, A.x0 + 4, A.x1 - 34); if (b.st % 6 === 0) feathers(b.x + 15, b.y + 10, 1); if (b.st >= 34) { b.pat++; set(b, 'walk'); } },
    // ---- Transitions
    // I → II: a scream, back to the nest, two stamps and the nest gives way; branches, stones and a crate come down with her.
    trans1(b, A, px) {
      const pc = A.perch;
      if (b.st === 1) { L.bossCk = 2; b.air = true; shriek(b, true); Game.stop(12); b.card = null; }
      if (b.st < 60) { b.x = lerp(b.x, pc.x - 15, .08); b.y = lerp(b.y, pc.y - 30, .08); face(b, px); if (b.st > 50) b.air = false; }
      if (b.st === 60 || b.st === 78) { Cam.shake(5, 16); Sound.play('rumble'); Game.word('¡PUM!', pc.x, pc.y - 4, '#f2c46a', true); spawnParts(8, pc.x + rnd(-40, 40), pc.y, { color: ['#4a2e1a', '#6b4a30', '#c78d4e'], speed: [.4, 1.5], life: [20, 40], g: .12 }); }
      if (b.st === 92) {
        for (let x = A.c0 + 9; x <= A.c0 + 14; x++) { setTile(x, 4, '.'); spawnParts(5, x * TS + 8, pc.y + 4, { color: ['#4a2e1a', '#6b4a30', '#c78d4e', '#8a6a3a'], angle: Math.PI / 2, spread: 1.2, speed: [.5, 2], life: [30, 50], g: .15, bounce: .3 }); }
        Sound.play('crack'); Game.word('¡CRAC!', pc.x, pc.y - 6, '#d0d6da', true); Cam.shake(6, 24); Sound.playMusic(SONGS[1]);
        for (const [dx, kind] of [[-50, 'rock'], [40, 'rock'], [74, 'crate']]) { const e = kind === 'rock' ? Item.rock(pc.x + dx, pc.y + 4) : Item.crate(pc.x + dx, pc.y + 4); e.vx = Math.sign(dx) * .6; if (kind === 'crate') e.ghost = true; L.ents.push(e); }
        b.card = { title: 'II · El barro', sub: 'si se le clava el pico, ¡dale!', t: 0, life: 170 };
        b.air = true; b.vy = -2;
      }
      if (b.st > 92) {
        if (b.y + 30 < A.floor) { b.vy = Math.min(b.vy + .3, 6); b.y += b.vy; b.x = lerp(b.x, A.mid + 40 - 15, .05); if (b.y + 30 >= A.floor) { b.y = A.floor - 30; b.air = false; Cam.shake(4, 12); Sound.play('thud'); dust(b.x + 15, A.floor, 16, 1.8); } }
        face(b, px);
      }
      if (b.st === 110) for (let x = A.c0 + 10; x <= A.c0 + 13; x++) { setTile(x, 9, '='); spawnParts(4, x * TS + 8, 9 * TS, { color: ['#4a2e1a', '#c78d4e'], angle: -Math.PI / 2, spread: 1.2, speed: [.4, 1.2], life: [10, 20] }); }
      if (b.st >= 140 && !b.air) { b.phase = 2; b.pat = 0; set(b, 'walk'); }
    },
    // II → III: up to the middle, red eyes, and the water rises at both ends of the arena (bubbles warn first).
    trans2(b, A, px) {
      if (b.st === 1) { L.bossCk = 3; b.air = true; shriek(b, true); Game.stop(14); Cam.shake(5, 40); b.card = null; Game.toast('¡Sube el agua!', 110); }
      b.air = true; b.x = lerp(b.x, A.mid - 15, .05); b.y = lerp(b.y, 70, .05); face(b, px);
      if (b.st < 70 && b.st % 3 === 0) for (const x of WET_COLS(A)) if (Math.random() < .3) spawnParts(1, x * TS + rnd(2, 14), A.floor + 2, { color: ['#8fd9d0', '#c8f2ea'], angle: -Math.PI / 2, spread: .4, speed: [.4, 1.2], life: [10, 20], g: .05 });
      if (b.st === 40) { b.rage = 1; b.redT = 24; Game.word('¡FURIA!', b.x + 15, b.y - 12, '#ff5a3a', true); Sound.play('shriek', 1); Cam.punch(1.06); }
      if (b.st === 70) flood(A);
      if (b.st >= 120) { b.phase = 3; b.pat = 0; set(b, 'hover'); }
    },
    // The last blow: slow motion, white flash, every cría left comes out at once; she tumbles down.
    final(b, A) {
      b.air = true; b.vy = Math.min(b.vy + .12, 3); b.y += b.vy; b.x = clamp(b.x - b.dir * .5, A.x0, A.x1 - 30);
      if (b.st % 4 === 0) feathers(b.x + 15, b.y + 12, 2);
      if (b.y + 30 >= A.floor) { b.y = A.floor - 30; b.air = false; Cam.shake(4, 16); Sound.play('thud'); dust(b.x + 15, A.floor, 18, 1.8); set(b, 'dying'); }
    },
    dying(b) {
      b.air = false; if (b.st % 6 === 0) feathers(b.x + rnd(0, b.w), b.y + rnd(0, b.h), 3);
      if (b.st > 90) { set(b, 'leave'); Sound.play('heron'); }
    },
    leave(b) { b.air = true; b.y -= 1.6 + b.st * .04; b.x += -b.dir * 1.2; if (b.st > 120) { b.dead = true; won(); } }
  };

  function dodge(b, A) {
    if (b.dodge > 0) { b.dodge--; const nx = clamp(b.x + b.dodgeDir * 3.2, A.x0 + 10, A.x1 - 40); if (b.hx) b.hx += nx - b.x; b.x = nx; return; }
    if (b.dodgeCd > 0) { b.dodgeCd--; return; }
    for (const p of L.projs) {
      if (p.dead || p.kind === 'agua') continue;
      const dx = b.x + 15 - (p.x + p.w / 2), dy = b.y + 14 - (p.y + p.h / 2);
      if (Math.hypot(dx, dy) > 74 || dx * p.vx + dy * p.vy <= 0) continue;
      let d = Math.sign(dx) || 1; if ((d > 0 && b.x + 60 > A.x1) || (d < 0 && b.x - 30 < A.x0)) d = -d;
      b.dodge = 14; b.dodgeDir = d; b.dodgeCd = 40; Sound.play('flap'); feathers(b.x + 15, b.y + 14, 4); Game.word('¡FUP!', b.x + 15, b.y - 8, '#dff2fb', false);
      if (!L.bossDodgeHint) { L.bossDodgeHint = true; Game.toast('¡Lo esquiva! Dale cuando se lance', 150); }
      return;
    }
  }
  function nextAir(b) {
    if (b.phase === 1) { b.pat++; b.dive = 1; set(b, 'aim'); return; }
    const s = P3[b.pat++ % P3.length];
    if (s === 'dive') { b.dive = 1; set(b, 'aim'); } else if (s === 'rain') set(b, 'rainUp'); else set(b, 'fanAir');
  }
  function stabZone(b, A) { return b.sdir < 0 ? { x: b.x - 30, y: A.floor - 24, w: 36, h: 24 } : { x: b.x + 24, y: A.floor - 24, w: 36, h: 24 }; }
  // A crate between her and Nila takes the wind.
  function shelter(b, P) { const cx = b.x + 15, px = P.x + 5; return L.ents.some(e => !e.dead && e.kind === 'crate' && e.resting && (e.x + 7 - cx) * (px - (e.x + 7)) > 0 && Math.abs(px - (e.x + 7)) < 30 && e.y < P.y + P.h && e.y + e.h > P.y + 4); }
  function countered(b, px) {
    const toward = b.x + 15 > px ? 1 : -1;
    for (const q of L.gusts || []) if (!q.vsHeron && q.dir === toward && q.t < 6) { q.vsHeron = true; return true; }
    return false;
  }
  function clash(b) {
    const mx = (b.x + 15 + Player.x + 5) / 2, my = Player.y + 10;
    Game.word('¡CONTRA!', b.x + 15, b.y - 12, '#dff2fb', true); Sound.play('pop'); Sound.play('heronHit'); Cam.shake(3, 12); Cam.punch(1.04); Game.stop(4);
    for (let i = 0; i < 16; i++) L.parts.push({ x: mx, y: my + rnd(-8, 8), vx: rnd(-2.5, 2.5), vy: rnd(-1.5, 1), life: rnd(14, 26) | 0, max: 26, color: '#f2fbff', size: 1, g: 0, kind: 'mist' });
    feathers(b.x + 15, b.y + 10, 10); Game.word('¡LE FALLAN LAS PATAS!', b.x + 15, b.y - 22, '#f2c46a', false);
    set(b, 'stagger');
  }
  // Where the darts will land: on Nila and every 44 px around her, never on the heron herself or in the water.
  // Each dart is lobbed to land on its mark after T frames, so the marks are all the player needs to read.
  const PLUME_G = .12;
  function fanAims(b, A, air) {
    const P = Player, ox = b.dir < 0 ? b.x + 2 : b.x + 28, oy = b.y + 5, px = clamp(P.x + 5, A.lo, A.hi), T = air ? 46 : 58;
    return [-88, -44, 0, 44, 88].map(o => px + o).filter(x => x > A.lo - 4 && x < A.hi + 4 && (air || Math.abs(x - (b.x + 15)) > 26))
      .map(sx => ({ x: ox, y: oy, sx, T, vx: (sx - ox) / T, vy: (A.floor - 2 - oy - .5 * PLUME_G * T * T) / T }));
  }
  function fire(b) {
    for (const q of b.aims || []) L.ents.push(plume(q.x, q.y, q.vx, q.vy, q.sx));
    b.aims = null; Sound.play('feathers'); feathers(b.x + 15, b.y + 10, 6); Cam.shake(1, 4);
  }
  function flood(A) {
    for (const x of WET_COLS(A)) { setTile(x, L.h - 4, '.'); setTile(x, L.h - 3, '~'); setTile(x, L.h - 2, '~'); spawnParts(6, x * TS + 8, A.floor, { color: ['#8fd9d0', '#c8f2ea', '#2f7f88'], angle: -Math.PI / 2, spread: .8, speed: [1, 3.2], life: [14, 30] }); }
    Sound.play('splash'); Sound.play('rumble'); Cam.shake(4, 20);
    // Nila is never left standing where the water comes up: the wave sets her on the dry middle.
    const P = Player, B = arena(3), safe = clamp(P.x, B.lo, B.hi - P.w);
    if (safe !== P.x && P.onGround) { P.x = safe; P.vx = 0; Game.word('¡UF!', P.x + 5, P.y - 8, '#8fd9d0', false); }
    P.lastSafe = { x: clamp(P.lastSafe ? P.lastSafe.x : P.x, B.lo, B.hi - P.w), y: A.floor - P.h };
  }
  function dropRock(b) {
    if (rocks() >= 3) return;
    const r = Item.rock(b.x + b.w / 2 - 6, b.y + b.h); r.vy = 1; L.ents.push(r); Sound.play('puff'); feathers(b.x + 15, b.y + b.h, 4);
  }
  // A rock falling from the nest: a shadow grows under it, it hurts on the way down and is ammo once it lands.
  function rainRock(x) {
    const r = Item.rock(x - 6, Math.min(Cam.y, 24) - 24); r.hazard = true; r.update = rainUpdate; L.ents.push(r); Sound.play('whistle');
  }
  function rainUpdate(e) {
    Item.fallUpdate(e); if (e.dead) return;
    if (e.resting) { e.hazard = false; e.update = Item.fallUpdate; Cam.shake(2, 6); if (rocks() > 5) { e.dead = true; spawnParts(8, e.x + 6, e.y + 5, { color: ['#a6abb8', '#7d8290', '#4f545a'], speed: [.8, 2.4], life: [14, 26], g: .15, bounce: .3 }); Sound.play('crack'); } return; }
    if (e.vy > 1.5 && Player.inv === 0 && !Player.dead && !Player.win && overlap(e, Player.rect())) Player.hurt(Player.x + 5 < e.x + 6 ? 1 : -1);
  }
  // A feather dart: arcs to its mark, hurts on the way, sticks in the mud and fades.
  function plume(x, y, vx, vy, sx) { return { kind: 'plume', x: x - 3, y: y - 2, w: 6, h: 4, vx, vy, sx, t: 0, stuck: 0, update: plumeUpdate, draw: plumeDraw }; }
  function plumeUpdate(e) {
    e.t++;
    if (e.stuck) { if (--e.stuck <= 0) e.dead = true; return; }
    e.vy += PLUME_G; e.x += e.vx; e.y += e.vy; const cx = e.x + 3, cy = e.y + 2;
    if (e.vy > 0 && (rectSolid(cx - 1, cy - 1, 2, 2) || waterAt(cx, cy))) { e.stuck = 60; Sound.play('step'); spawnParts(3, cx, cy, { color: ['#c9b08a', '#e9eef2'], speed: [.3, 1], life: [8, 14], g: .08 }); return; }
    if (e.t % 3 === 0) L.parts.push({ x: cx - e.vx, y: cy - e.vy, vx: 0, vy: 0, life: 8, max: 8, color: '#e9eef2', size: 1, g: 0, kind: 'mist' });
    const P = Player; if (P.inv === 0 && !P.dead && !P.win && overlap(e, P.rect())) { P.hurt(e.vx > 0 ? -1 : 1); e.dead = true; feathers(cx, cy, 4); }
    if (e.x < -20 || e.x > L.w * TS + 20 || e.y > L.h * TS + 20 || e.y < -80) e.dead = true;
  }
  function plumeDraw(e, g) {
    const sp = Math.hypot(e.vx, e.vy) || 1, ux = e.vx / sp, uy = e.vy / sp, x = e.x + 3 - Cam.x, y = e.y + 2 - Cam.y, a = e.stuck ? Math.min(1, e.stuck / 20) : 1;
    g.globalAlpha = a;
    for (let i = -3; i <= 4; i++) {
      const X = Math.round(x + ux * i), Y = Math.round(y + uy * i);
      g.fillStyle = i >= 3 ? '#3a3d56' : '#f2efe8'; g.fillRect(X, Y, 1, 1);
      if (i > -3 && i < 3) { g.fillStyle = i < 0 ? '#a9b8c9' : '#c9d4e0'; g.fillRect(Math.round(X - uy), Math.round(Y + ux), 1, 1); if (i < 1) g.fillRect(Math.round(X + uy), Math.round(Y - ux), 1, 1); }
    }
    g.globalAlpha = 1;
  }
  function free(b, n) {
    for (let k = 0; k < n && L.bossFreed < CRIAS; k++) {
      L.bossFreed++; L.pearls++; Game.pearlPop = 12;
      L.parts.push({ x: b.x + (b.dir < 0 ? 0 : b.w - 6), y: b.y + 8, vx: (b.dir < 0 ? -1 : 1) * rnd(.8, 1.6) + k * .3, vy: -rnd(2, 3), life: 70, color: '#fff', size: 1, g: .1, kind: 'cria' });
    }
  }
  function finale(b) {
    set(b, 'final'); b.vy = -1.5; b.whiteT = 22; b.card = null; L.bossSlow = 96; Game.stop(24); Cam.shake(7, 50); Cam.punch(1.14); Input.rumble(600, 1, 1);
    Sound.play('bossDown'); Sound.stopMusic(); Sound.duck(true);
    const rest = CRIAS - L.bossFreed;
    for (let k = 0; k < rest; k++) { L.bossFreed++; L.pearls++; L.parts.push({ x: b.x + 12, y: b.y + 8, vx: (k - (rest - 1) / 2) * .55, vy: -rnd(3, 4.6), life: 110, color: '#fff', size: 1, g: .1, kind: 'cria' }); }
    Game.pearlPop = 12; feathers(b.x + 15, b.y + 12, 30);
    Game.word('¡LAS CRÍAS!', b.x + 15, b.y - 16, '#e8fbff', true);
  }
  function hit(b, p, dmg = 1) {
    if (!b.fight || b.dead) return false;
    const cx = b.x + 15;
    if (PARRY[b.state] && b.inv === 0) {
      Sound.play('clang'); Game.word('¡TOC!', cx, b.y - 6, '#cfd6e0', false); spawnParts(5, cx - b.dir * -10, b.y + 12, { color: ['#fff6d6', '#a9b8c9'], speed: [.5, 1.8], life: [6, 12], g: .1 });
      if (!b.parryHint) { b.parryHint = true; Game.toast('Lo para con el ala: espera a que falle', 140); }
      return true;
    }
    if (!VULN[b.state] || b.inv > 0) return false;
    b.rain = null; b.aims = null;
    const floorHp = PHASE_HP[b.phase] || 0, before = b.hp; b.hp = Math.max(floorHp, b.hp - dmg);
    b.flash = 14; b.inv = 40; Cam.punch(dmg > 1 ? 1.08 : 1.04); Input.rumble(220, 1, .5); Sound.play('heronHit'); Cam.shake(5, 14); Game.stop(dmg > 1 ? 9 : 6);
    Game.word(dmg > 1 ? '¡ZAS!' : '¡PAF!', cx, b.y - 6, '#fff6d6', true); feathers(cx, b.y + 14, 14);
    free(b, before - b.hp); Game.word('¡PLOP!', cx, b.y + b.h + 4, '#e8fbff', false);
    if (b.hp <= 0) finale(b);
    else if (b.hp === floorHp) set(b, b.phase === 1 ? 'trans1' : 'trans2');
    else set(b, b.air ? 'reel' : 'reel2');
    return true;
  }
  function vulnerable(b) { return !!(b.fight && !b.dead && VULN[b.state] && b.inv === 0); }

  // ---------------------------------------------------------------- Actualizar
  function update(b) {
    b.t++; b.st++; if (b.flash > 0) b.flash--; if (b.inv > 0) b.inv--; if (b.shriek > 0) b.shriek--; if (b.whiteT > 0) b.whiteT--; if (b.redT > 0) b.redT--;
    if (b.card) { b.card.t++; if (b.card.t > b.card.life) b.card = null; }
    const A = arena(b.phase), P = Player, px = P.x + 5;
    if (DODGE[b.state] && b.inv === 0 && !(b.phase === 1 && b.hp === MAX_HP)) dodge(b, A);
    S[b.state](b, A, px, P);
    if (b.dead || b.state === 'wait') return;
    if (b.rage && b.t % 5 === 0) spawnParts(1, b.x + (b.dir < 0 ? 11 : 20), b.y + 3, { color: ['#ff5a3a', '#ffb070'], speed: [.1, .4], life: [8, 16], g: -.03 });
    // A belly flop onto her while she is open counts as a blow.
    const body = { x: b.x + 3, y: b.y + 4, w: b.w - 6, h: b.h - 6 };
    if (P.pound && P.vy > 2 && vulnerable(b) && overlap(body, P.rect())) {
      hit(b, null, 1); P.pound = false; P.vy = -6.5; P.jumpCut = false; P.onGround = false; P.airJumps = 1; P.sx = 1.4; P.sy = .7;
      Game.word('¡PLAF!', P.x + 5, P.y - 8, '#fff6d6', true); Sound.play('crack'); return;
    }
    // Contact hurts, except in the first moments after she recovers (Nila may still be standing next to her).
    if (HARM[b.state] && !(b.state === 'walk' && b.st < 16) && P.inv === 0 && !P.dead && !P.win && overlap(body, P.rect())) P.hurt(px < b.x + 15 ? 1 : -1);
  }

  // ---------------------------------------------------------------- Dibujo
  // A shadow on every surface under x: planks and the floor (the water too).
  function shadow(g, x, rx, alpha, warn) {
    const tx = Math.floor(x) >> 4;
    for (let ty = 5; ty < L.h; ty++) {
      const ch = tileAt(tx, ty); if (ch !== '=' && ch !== '~' && !solidChar(ch)) continue;
      const sx = Math.round(x - Cam.x), sy = ty * TS - Cam.y + 1;
      g.globalAlpha = alpha; g.fillStyle = '#120a14'; g.beginPath(); g.ellipse(sx, sy, rx, Math.max(2, rx * .28), 0, 0, Math.PI * 2); g.fill();
      if (rx > 8) { g.globalAlpha = alpha * .8; g.beginPath(); g.ellipse(sx, sy, rx * .55, Math.max(1.5, rx * .16), 0, 0, Math.PI * 2); g.fill(); }
      if (warn) { g.globalAlpha = .95; g.strokeStyle = warn; g.beginPath(); g.ellipse(sx, sy, rx + 2, Math.max(2.5, rx * .32), 0, 0, Math.PI * 2); g.stroke(); }
      g.globalAlpha = 1; if (ch !== '=') break;
    }
  }
  // Her nest on the perch: a bowl of sticks over the planks, until it breaks in phase II.
  let twigs = null;
  function drawNest(g, A) {
    if (tileAt(A.c0 + 9, 4) !== '=') return;
    if (!twigs) { twigs = []; let r = 7; const rn = () => (r = (r * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 70; i++) { const u = rn(), x = -48 + u * 96, d = Math.abs(x) / 48, y = -5 + d * d * 6 + rn() * 9, a = (rn() - .5) * .9, len = 6 + rn() * 12; twigs.push([x, y, a, len, rn() < .3]); } }
    const cx = A.perch.x - Cam.x, cy = A.perch.y - Cam.y;
    g.fillStyle = '#2a1a14'; g.beginPath(); g.ellipse(cx, cy + 4, 50, 8, 0, 0, Math.PI); g.fill(); g.fillRect(cx - 50, cy - 1, 100, 5);
    for (const [x, y, a, len, light] of twigs) { g.fillStyle = light ? '#8a6a3a' : '#4a2e1a'; for (let k = 0; k < len; k++) g.fillRect(Math.round(cx + x + Math.cos(a) * (k - len / 2)), Math.round(cy + y + Math.sin(a) * (k - len / 2)), 1, 1); }
    g.fillStyle = '#c78d4e'; for (let x = -46; x < 46; x += 3) g.fillRect(Math.round(cx + x), Math.round(cy - 3 + (x * x) / 900), 2, 1);
  }
  function drawShadows(b, g, A) {
    if (b.state === 'lock' || b.state === 'plunge') {
      const n = b.phase === 1 ? 34 : 26, k = b.state === 'lock' ? Math.min(1, .45 + .55 * b.st / n) : 1, blink = (b.st >> 2) % 2 === 0;
      shadow(g, b.tx, 18 * k, .6, blink ? '#ff5a3a' : '#ffb070');
      // The line of the dive, dashes running down from her to the mark.
      if (b.state === 'lock') { const sx = Math.round(b.tx - Cam.x); for (let yy = b.y + 30; yy < A.floor - 4; yy += 6) { const ph = (yy - b.y + b.st * 2) % 12; if (ph < 6) continue; g.globalAlpha = .45; g.fillStyle = '#ff7a4a'; g.fillRect(sx, Math.round(yy - Cam.y), 1, 3); } g.globalAlpha = 1; }
    } else if (b.state === 'aim') shadow(g, b.x + 15, 10, .25, null);
    else if (b.air && !['wait', 'intro', 'leave'].includes(b.state) && b.y + 30 < A.floor - 8) shadow(g, b.x + 15, 8, .18, null);
    for (const e of L.ents) if (!e.dead && e.hazard) {
      const h = A.floor - (e.y + e.h), k = clamp(1 - h / 190, .25, 1);
      shadow(g, e.x + 6, 4 + 7 * k, .3 + .35 * k, (Game.t >> 2) % 2 ? '#ff5a3a' : null);
    }
  }
  function draw(b, g) {
    const A = arena(b.phase);
    drawNest(g, A);
    if (b.state === 'wait') return;
    drawShadows(b, g, A);
    const x = Math.round(b.x - Cam.x), y = Math.round(b.y - Cam.y), faceLeft = b.dir < 0, st = b.state, t = b.t;
    const flying = b.air && st !== 'final';
    const body = flying ? ART.heronFly : ART.heronBody;
    const white = b.flash > 0 && (b.flash >> 1) % 2;
    const put = (s, dx, dy) => { const sp = faceLeft ? s : ART.flip(s); const ox = faceLeft ? dx : (body.width - dx - s.width); g.drawImage(white ? ART.tint(sp, '#ffffff') : sp, x + ox, y + dy); };
    const wings = [ART.wingUp, ART.wingMid, ART.wingDown, ART.wingMid];
    // How far she leans: back for the wind-up, beak down for the stab and while stuck.
    let pitch = 0, jx = 0, jy = 0, scale = 1;
    if (st === 'windup') { pitch = -.24 * Math.min(1, b.st / 10); jx = Math.sin(b.st * 1.9) * (b.st > 18 ? 1 : 0); }
    else if (st === 'stab') pitch = .8 * Math.min(1, b.st / 3);
    else if (st === 'stuck') { pitch = .8 + Math.sin(t * .7) * .06; jx = Math.sin(t * 1.3) * .8; }
    else if (st === 'yank') pitch = .8 * (1 - b.st / 18) - (b.st > 9 ? .12 : 0);
    else if (st === 'pull') pitch = .6 * (1 - b.st / 24);
    else if (st === 'land' && b.phase !== 1) pitch = .3;
    else if (st === 'stagger') pitch = Math.sin(t / 5) * .18;
    else if (st === 'reel2') pitch = -.3;
    else if (st === 'fanWind') { scale = 1 + Math.min(1, b.st / 20) * .1; jx = (b.st > 12 && (t & 1)) ? 1 : 0; }
    else if (st === 'dying') pitch = Math.sin(t / 6) * .18;
    else if (st === 'final') pitch = b.st * .15;
    else if (st === 'reel') pitch = Math.sin(b.st * .5) * .5;
    const pvx = x + (faceLeft ? 19 : 12), pvy = y + 30;
    g.save();
    g.translate(Math.round(jx), Math.round(jy));
    if (pitch || scale !== 1) { g.translate(pvx, pvy); g.rotate(faceLeft ? -pitch : pitch); g.scale(scale, scale); g.translate(-pvx, -pvy); }
    if (flying) {
      const fast = b.phase === 3 || st === 'reel' ? 2 : 3;
      const wf = st === 'plunge' ? 2 : st === 'lock' || st === 'aim' || st === 'intro' && b.st > 90 ? 0 : ((t >> fast) % 4);
      put(wings[wf], 6, wf === 0 ? -10 : wf === 2 ? 8 : 2);
    }
    else if (st === 'gustWind') put(ART.wingUp, 4, -8);
    else if (st === 'gust') { const wf = (t >> 2) % 2 ? 0 : 2; put(wings[wf], 4, wf === 0 ? -8 : 8); }
    put(body, 0, 0);
    if (!flying && st !== 'gustWind' && st !== 'gust') put(st === 'stagger' || st === 'dying' ? ART.wingDown : ART.wingMid, 4, st === 'stagger' || st === 'dying' ? 10 : 6);
    // Eyes: red with fury in phase III.
    if (b.rage && !white) { const ex = faceLeft ? 11 : 19; g.fillStyle = 'rgba(255,60,40,.35)'; g.fillRect(x + ex - 1, y + 2, 4, 3); g.fillStyle = '#ff3a2a'; g.fillRect(x + ex, y + 3, 2, 1); g.fillStyle = '#ffd0a0'; g.fillRect(x + (faceLeft ? ex : ex + 1), y + 3, 1, 1); }
    // The glint on the beak just before the stab.
    if (st === 'windup' && b.st > 16 && (b.st >> 1) % 2) { const bx = faceLeft ? x + 1 : x + 30, by = y + 4; g.fillStyle = '#ffffff'; g.fillRect(bx - 2, by, 5, 1); g.fillRect(bx, by - 2, 1, 5); }
    g.restore();
    // A big "!" over her head while she winds up a stab.
    if (st === 'windup' && (b.st >> 2) % 3) { const ex = x + 15, ey = y - 14 - (b.st < 6 ? 6 - b.st : 0); g.fillStyle = '#1b1020'; g.fillRect(ex - 2, ey - 1, 5, 11); g.fillStyle = '#ffec8a'; g.fillRect(ex - 1, ey, 3, 6); g.fillRect(ex - 1, ey + 7, 3, 2); g.fillStyle = '#ffffff'; g.fillRect(ex - 1, ey, 1, 5); }
    if ((st === 'stuck' || st === 'stagger') && (t >> 3) % 2) for (let i = 0; i < 3; i++) g.drawImage(ART.star, x + 6 + i * 8 + Math.round(Math.sin(t / 5 + i) * 3), y - 4 + Math.round(Math.cos(t / 5 + i) * 2));
    if (b.shriek > 0) { g.fillStyle = '#fff'; const sx = faceLeft ? x - 4 : x + body.width + 2; for (let i = 0; i < 3; i++) { const r = 2 + (b.shriek % 10) * .4; g.fillRect(Math.round(sx + (faceLeft ? -i * 3 - r : i * 3 + r)), y + 2 + i * 3 - 4, 2, 1); } }
  }
  // In front of everything: the letterbox of the intro, the wind lines, the aim lines of a fan, and the flashes.
  function drawFront(g) {
    const b = L.boss; if (!b || !b.fight) return;
    const A = arena(b.phase), t = Game.t;
    if (b.state === 'gust' || b.state === 'gustWind') {
      const cx = b.x + 15, n = b.state === 'gust' ? 18 : 6;
      for (let i = 0; i < n; i++) {
        const yy = A.floor - 3 - ((i * 37) % 46), ph = (t * (b.state === 'gust' ? 7 : 3) + i * 53) % 240, sx = b.state === 'gust' ? cx + b.gdir * (18 + ph) : cx + b.gdir * (120 - ph * .45);
        g.globalAlpha = b.state === 'gust' ? .55 : .3; g.fillStyle = i % 3 ? '#dff2fb' : '#ffffff'; g.fillRect(Math.round(Math.min(sx, sx - b.gdir * 18) - Cam.x), Math.round(yy - Cam.y + Math.sin(ph * .1 + i) * 1.5), 18, i % 4 ? 1 : 2);
      }
      g.globalAlpha = 1;
    }
    const marks = []; if (b.aims) for (const q of b.aims) marks.push(q.sx); for (const e of L.ents) if (!e.dead && e.kind === 'plume' && !e.stuck) marks.push(e.sx);
    for (const mx of marks) mark(g, mx, A.floor, t);
    // The arcs, faint, while she winds up.
    if (b.aims) for (const q of b.aims) { let x = q.x, y = q.y, vy = q.vy; for (let k = 0; k < q.T; k++) { vy += PLUME_G; x += q.vx; y += vy; if (k % 3) continue; g.globalAlpha = .12 + .3 * (k / q.T); g.fillStyle = '#fff6d6'; g.fillRect(Math.round(x - Cam.x), Math.round(y - Cam.y), 1, 1); } g.globalAlpha = 1; }
    if (b.lock) { const k = Math.min(1, b.st / 20), hb = Math.round(12 * k); g.fillStyle = '#07060c'; g.fillRect(0, 0, W, hb); g.fillRect(0, H - hb, W, hb); }
    if (b.rage && !Game.still) { const a = .06 + Math.sin(t / 14) * .03; g.fillStyle = 'rgba(200,30,20,' + a + ')'; g.fillRect(0, 0, W, 5); g.fillRect(0, H - 5, W, 5); g.fillRect(0, 0, 5, H); g.fillRect(W - 5, 0, 5, H); }
    if (b.redT > 0) { g.fillStyle = 'rgba(255,60,30,' + (b.redT / 24 * .35) + ')'; g.fillRect(0, 0, W, H); }
    if (b.whiteT > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.min(1, b.whiteT / 20) + ')'; g.fillRect(0, 0, W, H); }
  }
  // A red cross on the ground where a dart will land.
  function mark(g, x, floor, t) {
    const sx = Math.round(x - Cam.x), sy = Math.round(floor - Cam.y - 3), on = (t >> 2) % 2;
    g.globalAlpha = .55; g.fillStyle = '#120a14'; g.beginPath(); g.ellipse(sx, sy + 3, 8, 2, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = .9; g.strokeStyle = on ? '#ff5a3a' : '#ffb070'; g.beginPath(); g.ellipse(sx, sy + 3, 9, 2.6, 0, 0, Math.PI * 2); g.stroke();
    // A faint column of light over it, so it reads from far away.
    for (let k = 4; k < 26; k += 3) { g.globalAlpha = .35 * (1 - k / 26); g.fillStyle = '#ffb070'; g.fillRect(sx, sy - k, 1, 2); }
    g.globalAlpha = 1; g.fillStyle = on ? '#ff5a3a' : '#fff0c8'; for (let i = -3; i <= 3; i++) { g.fillRect(sx + i, sy + Math.round(i * .6), 2, 1); g.fillRect(sx + i, sy - Math.round(i * .6), 2, 1); }
  }
  // The camera frames the arena, leaning a little toward her; during the intro it looks up at the nest.
  function cam(b) {
    if (!b.fight || b.dead) return null;
    const A = arena(b.phase), P = Player;
    if (b.lock) return { x: clamp(A.perch.x - W / 2, A.x0 - 16, A.x1 - W), y: 18 };
    // Stamping on the nest: the camera looks up at her.
    if (b.state === 'trans1' && b.st < 100) return { x: clamp(lerp(P.x + 5, A.perch.x, .6) - W / 2, A.x0 - 16, A.x1 - W), y: 6 };
    const fx = lerp(P.x + 5, b.state === 'leave' ? P.x + 5 : b.x + 15, .3) + P.dir * 10;
    return { x: clamp(fx - W / 2, A.x0 - 16, A.x1 - W), y: Math.min(24, P.y - 60) };
  }
  function won() {
    const A = arena(3);
    Sound.duck(false); Sound.play('clear'); Sound.playMusic('dock'); Game.toast('¡La Garza se ha ido!', 150); L.bossCk = 4;
    for (let y = 4; y <= L.h - 4; y++) if (tileAt(A.c0 - 1, y) === 'G') L.gateQueue.push({ x: A.c0 - 1, y, d: 6 + (L.h - 4 - y) * 5 });
    if (tileAt(A.c0, L.h - 4) === '^') setTile(A.c0, L.h - 4, '.');
    // The boat pulls up on the shore; the last stretch of ground becomes water for it (it already is, after the flood).
    for (let x = L.w - 4; x < L.w; x++) { setTile(x, L.h - 4, '.'); setTile(x, L.h - 3, '~'); setTile(x, L.h - 2, '~'); }
    L.ents.push(Item.boat((L.w - 4) * TS + 2, A.floor + 14)); L.boatSpawned = true;
    spawnParts(16, A.x1 - 16, A.floor - 8, { color: ['#8fd9d0', '#c8f2ea'], angle: -Math.PI / 2, spread: 1.2, speed: [1, 3], life: [14, 30] });
  }
  return { CRIAS, MAX_HP, PHASE_HP, create, update, draw, drawFront, hit, won, cam, skip, restart, song, arena, vulnerable };
})();
