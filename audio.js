// GLUP — audio. Todo es WebAudio sintetizado: efectos y un secuenciador por pasos.
'use strict';
const Sound = (() => {
  let ctx = null, master = null, sfxBus = null, musicBus = null, muted = false, suckNode = null;
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(name) { // 'Bb2', 'F#3', 'A3'
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name); if (!m) return 0;
    let n = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3]) + 1) * 12;
    return 440 * Math.pow(2, (n - 69) / 12);
  }
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .8; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = .5; musicBus.connect(master);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (music.song) { music.next = ctx.currentTime + .05; if (!music.timer) music.timer = setInterval(schedule, music.interval); }
  }
  let noiseBuffer = null;
  function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, .02); }
  function isMuted() { return muted; }
  function env(node, t, a, d, s, r, peak = 1, sustainLevel = 0) {
    node.gain.cancelScheduledValues(t); node.gain.setValueAtTime(0, t); node.gain.linearRampToValueAtTime(peak, t + a);
    node.gain.linearRampToValueAtTime(peak * sustainLevel, t + a + d); node.gain.setValueAtTime(peak * sustainLevel, t + a + d + s);
    node.gain.linearRampToValueAtTime(0, t + a + d + s + r);
  }
  function osc(type, f, t, dur, vol, bus = sfxBus, slide = null, attack = .005, release = .05) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    env(g, t, attack, Math.max(0, dur - attack - release) * .3, Math.max(0, dur - attack - release) * .7, release, vol, .6);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + release + .02); return o;
  }
  function noise(t, dur, vol, filterType = 'bandpass', f0 = 1200, f1 = null, q = 1, bus = sfxBus) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.setValueAtTime(f0, t); fl.Q.value = q;
    if (f1) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain(); env(g, t, .004, dur * .3, dur * .4, dur * .3, vol, .5);
    src.connect(fl); fl.connect(g); g.connect(bus); src.start(t); src.stop(t + dur + .05);
  }
  const sfx = {
    jump() { const t = ctx.currentTime; osc('square', 300, t, .12, .12, sfxBus, 620); osc('triangle', 150, t, .08, .1, sfxBus, 300); },
    land() { const t = ctx.currentTime; noise(t, .08, .18, 'lowpass', 400, 120); osc('sine', 90, t, .07, .15, sfxBus, 40); },
    step() { const t = ctx.currentTime; noise(t, .04, .05, 'bandpass', 900, 500, 2); },
    glup() { const t = ctx.currentTime; osc('sine', 520, t, .16, .25, sfxBus, 150, .005, .08); osc('triangle', 260, t + .04, .12, .15, sfxBus, 90); noise(t, .1, .1, 'lowpass', 900, 200); },
    spit() { const t = ctx.currentTime; noise(t, .16, .3, 'bandpass', 700, 2400, 1.5); osc('square', 180, t, .08, .12, sfxBus, 900); },
    puff() { const t = ctx.currentTime; noise(t, .1, .15, 'highpass', 1500, 4000); },
    hit() { const t = ctx.currentTime; noise(t, .12, .3, 'lowpass', 1500, 200); osc('square', 220, t, .1, .15, sfxBus, 60); },
    pop() { const t = ctx.currentTime; osc('sine', 800, t, .06, .2, sfxBus, 300); noise(t, .05, .12, 'highpass', 2000); },
    crack() { const t = ctx.currentTime; noise(t, .25, .4, 'lowpass', 2500, 300, .8); osc('triangle', 120, t, .2, .2, sfxBus, 40); },
    thud() { const t = ctx.currentTime; noise(t, .1, .2, 'lowpass', 500, 100); osc('sine', 70, t, .1, .25, sfxBus, 35); },
    hurt() { const t = ctx.currentTime; osc('sawtooth', 500, t, .25, .16, sfxBus, 120); osc('square', 250, t + .05, .2, .1, sfxBus, 70); },
    death() { const t = ctx.currentTime; [0, .12, .24, .4].forEach((d, i) => osc('square', 400 - i * 80, t + d, .16, .14, sfxBus, 200 - i * 40)); },
    pearl() { const t = ctx.currentTime; osc('sine', 1046, t, .09, .18, sfxBus, null, .003, .06); osc('sine', 1568, t + .07, .16, .18, sfxBus, null, .003, .1); },
    heart() { const t = ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => osc('triangle', f, t + i * .06, .12, .16, sfxBus, null, .003, .08)); },
    lantern() { const t = ctx.currentTime; [392, 523, 659, 784, 1046].forEach((f, i) => osc('triangle', f, t + i * .07, .2, .15, sfxBus, null, .003, .12)); noise(t, .4, .06, 'highpass', 4000); },
    bounce() { const t = ctx.currentTime; osc('sine', 180, t, .22, .25, sfxBus, 720, .005, .08); osc('triangle', 90, t, .1, .1, sfxBus, 360); },
    switch() { const t = ctx.currentTime; osc('square', 440, t, .08, .14, sfxBus, null, .003, .04); osc('square', 660, t + .09, .14, .14, sfxBus, null, .003, .08); noise(t, .1, .12, 'lowpass', 1200, 300); },
    gate() { const t = ctx.currentTime; noise(t, .5, .2, 'lowpass', 600, 150, 1); for (let i = 0; i < 6; i++) osc('square', 80 + i * 6, t + i * .07, .06, .08, sfxBus, 70); },
    frog() { const t = ctx.currentTime; osc('sawtooth', 160, t, .12, .1, sfxBus, 260, .01, .06); },
    croak() { const t = ctx.currentTime; osc('sawtooth', 110, t, .18, .12, sfxBus, 90, .02, .08); },
    buzz() { const t = ctx.currentTime; osc('sawtooth', 700, t, .12, .04, sfxBus, 760, .02, .06); },
    heron() { const t = ctx.currentTime; osc('sawtooth', 900, t, .3, .14, sfxBus, 400, .02, .1); osc('square', 1200, t + .05, .2, .06, sfxBus, 500, .02, .1); },
    heronHit() { const t = ctx.currentTime; noise(t, .3, .35, 'lowpass', 1800, 200); osc('sawtooth', 700, t, .35, .16, sfxBus, 150, .01, .15); },
    swoop() { const t = ctx.currentTime; noise(t, .5, .25, 'bandpass', 300, 1800, 2); },
    stun() { const t = ctx.currentTime; [0, .1, .2, .3, .4].forEach((d, i) => osc('sine', 900 + Math.sin(i) * 300, t + d, .08, .1, sfxBus, 700 + i * 50)); },
    select() { const t = ctx.currentTime; osc('square', 660, t, .05, .1, sfxBus, null, .003, .03); },
    confirm() { const t = ctx.currentTime; osc('square', 523, t, .07, .12, sfxBus, null, .003, .04); osc('square', 784, t + .07, .12, .12, sfxBus, null, .003, .08); },
    clear() { const t = ctx.currentTime; ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'].forEach((n, i) => osc('triangle', freq(n), t + i * .1, .25, .16, sfxBus, null, .005, .15)); },
    text() { const t = ctx.currentTime; osc('square', 1200, t, .02, .05, sfxBus, null, .002, .02); },
    splash() { const t = ctx.currentTime; noise(t, .4, .35, 'lowpass', 2000, 300, .7); osc('sine', 400, t, .15, .12, sfxBus, 80); },
    win() { const t = ctx.currentTime; ['D4', 'F4', 'A4', 'D5', 'C5', 'D5', 'F5', 'A5'].forEach((n, i) => osc('triangle', freq(n), t + i * .12, .3, .16, sfxBus, null, .005, .2)); } };
  function play(name) { if (!ctx || muted) return; try { sfx[name] && sfx[name](); } catch (e) { /* audio is never fatal */ } }
  // The suction is a looping wind: a noise through a bandpass that rises while the mouth is open.
  function suck(on) {
    if (!ctx) return;
    if (on && !suckNode) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 3; fl.frequency.setValueAtTime(400, ctx.currentTime); fl.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 1.2);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(.22, ctx.currentTime + .15);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 9; lg.gain.value = 300; lfo.connect(lg); lg.connect(fl.frequency); lfo.start();
      src.connect(fl); fl.connect(g); g.connect(sfxBus); src.start(); suckNode = { src, g, lfo };
    } else if (!on && suckNode) {
      const n = suckNode; suckNode = null; n.g.gain.setTargetAtTime(0, ctx.currentTime, .05); n.src.stop(ctx.currentTime + .3); n.lfo.stop(ctx.currentTime + .3);
    }
  }

  // ---------------------------------------------------------------- Música
  // Each song: bpm, swing (0–.5), and tracks with 16-step-per-bar patterns. '.' rest, '-' hold.
  const P = s => s.trim().split(/\s+/);
  const SONGS = {
    marsh: { bpm: 96, swing: .2, tracks: [
      { inst: 'bass', vol: .5, steps: P(`
        D2 . . D2 . . D2 . . . D2 . A1 . C2 .   Bb1 . . Bb1 . . Bb1 . . . Bb1 . F2 . D2 .
        F2 . . F2 . . F2 . . . F2 . C2 . A1 .   C2 . . C2 . . C2 . . . C2 . G2 . E2 .`) },
      { inst: 'pluck', vol: .32, steps: P(`
        D3 . F3 . A3 . F3 . D3 . F3 . A3 . D4 .   Bb2 . D3 . F3 . D3 . Bb2 . D3 . F3 . Bb3 .
        F3 . A3 . C4 . A3 . F3 . A3 . C4 . F4 .   C3 . E3 . G3 . E3 . C3 . E3 . G3 . C4 .`) },
      { inst: 'lead', vol: .16, steps: P(`
        . . A3 - . . F3 - . . D3 - - . . .   . . D4 - . . C4 - . . A3 - - - . .
        . . A3 - . . C4 - . . D4 - - . C4 .   . . G3 - . . A3 - . F3 - . D3 - - -
        . . A3 - . . F3 - . . D3 - - . . .   . . D4 - . . F4 - . . D4 - - - . .
        . . C4 - . . A3 - . . F3 - - . . .   . . E3 - . . G3 - . A3 - - - - . .`) },
      { inst: 'hat', vol: .12, steps: P(`
        x . . x . . x . x . . x . . x .   x . . x . . x . x . . x . . x x
        x . . x . . x . x . . x . . x .   x . . x . . x . x . . x . x . x`) },
      { inst: 'kick', vol: .35, steps: P(`
        x . . . . . . . x . . . . . x .   x . . . . . . . x . . . . . . .
        x . . . . . . . x . . . . . x .   x . . . . . . . x . . . x . . .`) } ] },
    cave: { bpm: 88, swing: .15, tracks: [
      { inst: 'bass', vol: .5, steps: P(`
        E2 . . . . . E2 . . . E2 . . . . .   G2 . . . . . G2 . . . G2 . . . . .
        A2 . . . . . A2 . . . A2 . . . . .   B1 . . . . . B1 . . . D2 . . . . .`) },
      { inst: 'pluck', vol: .26, steps: P(`
        E3 . . . B3 . . . E3 . . . G3 . . .   G3 . . . D4 . . . G3 . . . B3 . . .
        A3 . . . E4 . . . A3 . . . C4 . . .   B3 . . . F#4 . . . B3 . . . D4 . . .`) },
      { inst: 'lead', vol: .14, steps: P(`
        . . . . . . . . E4 - - . D4 - . .   . . . . . . . . B3 - - - - - . .
        . . . . . . . . C4 - - . B3 - . .   . . . . . . . . A3 - - - - - - -
        . . . . . . . . E4 - - . G4 - . .   . . . . . . . . F#4 - - - D4 - . .
        . . . . . . . . E4 - - . B3 - . .   . . . . . . . . E4 - - - - - - -`) },
      { inst: 'drip', vol: .2, steps: P(`
        . . . . . . x . . . . . . . . .   . . . . . . . . . . . x . . . .
        . . . x . . . . . . . . . . . .   . . . . . . . . . . . . . . x .`) },
      { inst: 'kick', vol: .3, steps: P(`
        x . . . . . . . . . x . . . . .   x . . . . . . . . . x . . . . .
        x . . . . . . . . . x . . . . .   x . . . . . . . x . . . x . . .`) } ] },
    heron: { bpm: 138, swing: 0, tracks: [
      { inst: 'bass', vol: .55, steps: P(`
        E2 . E2 . E2 . E2 . E2 . E2 . G2 . A2 .   C2 . C2 . C2 . C2 . C2 . C2 . D2 . E2 .
        E2 . E2 . E2 . E2 . E2 . E2 . G2 . A2 .   B1 . B1 . B1 . B1 . B1 . D2 . D2 . B1 .`) },
      { inst: 'lead', vol: .18, steps: P(`
        E4 . . E4 . . G4 . . . A4 . B4 . . .   C5 . . B4 . . A4 . . . G4 . . . E4 .
        E4 . . E4 . . G4 . . . A4 . B4 . . .   D5 . . B4 . . A4 . . . F#4 . . . . .`) },
      { inst: 'pluck', vol: .22, steps: P(`
        E3 . G3 . B3 . G3 . E3 . G3 . B3 . E4 .   C3 . E3 . G3 . E3 . C3 . E3 . G3 . C4 .
        E3 . G3 . B3 . G3 . E3 . G3 . B3 . E4 .   B2 . D3 . F#3 . D3 . B2 . D3 . F#3 . B3 .`) },
      { inst: 'hat', vol: .14, steps: P(`
        x . x . x . x x x . x . x . x x   x . x . x . x x x . x . x . x x
        x . x . x . x x x . x . x . x x   x . x . x . x x x . x x x . x x`) },
      { inst: 'kick', vol: .45, steps: P(`
        x . . . x . . . x . . . x . . .   x . . . x . . . x . . . x . x .
        x . . . x . . . x . . . x . . .   x . . . x . . . x . x . x . x .`) } ] },
    dock: { bpm: 72, swing: .25, tracks: [
      { inst: 'pluck', vol: .28, steps: P(`
        D3 . . . A3 . . . F3 . . . A3 . . .   Bb2 . . . F3 . . . D3 . . . F3 . . .
        F3 . . . C4 . . . A3 . . . C4 . . .   C3 . . . G3 . . . E3 . . . G3 . . .`) },
      { inst: 'bass', vol: .35, steps: P(`
        D2 . . . . . . . . . . . . . . .   Bb1 . . . . . . . . . . . . . . .
        F2 . . . . . . . . . . . . . . .   C2 . . . . . . . . . . . . . . .`) },
      { inst: 'lead', vol: .12, steps: P(`
        . . . . . . . . A3 - - - F3 - - -   . . . . . . . . D4 - - - - - - -
        . . . . . . . . C4 - - - A3 - - -   . . . . . . . . G3 - - - - - - -`) } ] } };
  const music = { song: null, name: null, step: 0, next: 0, timer: null, lookahead: .12, interval: 25 };
  function inst(name, f, t, dur, vol) {
    switch (name) {
      case 'bass': { osc('triangle', f, t, dur * .9, vol, musicBus, null, .01, .06); osc('square', f, t, dur * .5, vol * .25, musicBus, null, .01, .05); break; }
      case 'pluck': { const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 6, t); fl.frequency.exponentialRampToValueAtTime(f * 1.5, t + .25); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .35); o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + .4); break; }
      case 'lead': { const o = ctx.createOscillator(), g = ctx.createGain(), v = ctx.createOscillator(), vg = ctx.createGain(); o.type = 'square'; o.frequency.value = f; v.frequency.value = 5.5; vg.gain.value = f * .012; v.connect(vg); vg.connect(o.frequency); const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2200; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .03); g.gain.setValueAtTime(vol, t + dur - .04); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); v.start(t); o.stop(t + dur + .01); v.stop(t + dur + .01); break; }
      case 'hat': noise(t, .04, vol, 'highpass', 6000, null, 1, musicBus); break;
      case 'kick': osc('sine', 120, t, .12, vol, musicBus, 40, .002, .06); break;
      case 'drip': osc('sine', 1800 + Math.random() * 600, t, .08, vol, musicBus, 700, .002, .1); break;
    }
  }
  function schedule() {
    if (!music.song || !ctx) return;
    const s = music.song, stepDur = 60 / s.bpm / 4;
    while (music.next < ctx.currentTime + music.lookahead) {
      const i = music.step, swing = (i & 1) ? stepDur * s.swing : 0, t = music.next + swing;
      for (const tr of s.tracks) {
        const len = tr.steps.length, tok = tr.steps[i % len];
        if (tok === '.' || tok === '-') continue;
        if (tok === 'x') { inst(tr.inst, 0, t, stepDur, tr.vol); continue; }
        let hold = 1; while (tr.steps[(i + hold) % len] === '-') hold++;
        inst(tr.inst, freq(tok), t, stepDur * hold - .02, tr.vol);
      }
      music.step++; music.next += stepDur;
    }
  }
  function playMusic(name) {
    if (music.name === name) return;
    music.name = name; music.song = SONGS[name] || null; music.step = 0;
    if (!ctx) return; music.next = ctx.currentTime + .05;
    if (!music.timer) music.timer = setInterval(schedule, music.interval);
  }
  function stopMusic() { music.name = null; music.song = null; }
  function duck(on) { if (musicBus) musicBus.gain.setTargetAtTime(on ? .18 : .5, ctx.currentTime, .1); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); if (music.song && ctx) music.next = Math.max(music.next, ctx.currentTime + .05); }
  return { init, play, suck, playMusic, stopMusic, duck, setMuted, isMuted, resume, get ready() { return !!ctx; } };
})();
