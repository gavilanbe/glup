// GLUP — audio. Todo se sintetiza con WebAudio, sin muestras: un mezclador con reverb de sala y
// eco, instrumentos acústicos simulados (cuerdas pulsadas Karplus–Strong, láminas, vientos, cuerdas
// frotadas, coros, bajos, acordeón, metales, percusión), un secuenciador de canciones por secciones
// (cada canción vive en musica/<nombre>.js; la guía para componer está en musica/LEEME.md),
// paisajes sonoros vivos para cada lugar (Sound.ambiente) y los efectos del juego (Sound.play).
'use strict';
const Sound = (() => {
  const WIN = typeof window !== 'undefined' ? window : {};
  const AC = WIN.AudioContext || WIN.webkitAudioContext, OAC = WIN.OfflineAudioContext || WIN.webkitOfflineAudioContext;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, clock = () => (WIN.performance ? WIN.performance.now() : Date.now());
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(name) { const m = /^([A-G])(#|b)?(-?\d)$/.exec(name); return m ? NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12 : null; }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function freq(name) { const m = midi(name); return m === null ? 0 : mtof(m); }
  const amp = v => Math.pow(clamp(v, 0, 1.25), 1.6);   // velocity (0..1) to gain: soft notes fall away like real ones

  // ================================================================ DSP en JS
  // A small toolkit to render sounds into Float32Arrays once (notes, drums, animal calls) and play
  // them afterwards as cached buffers: rich synthesis at the cost of two nodes per note.
  const noiseArr = n => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1; return a; };
  function biq(x, type, f, q, sr, db = 0) {   // RBJ biquad, in place: 'lp' 'hp' 'bp' 'pk'
    const w = TAU * Math.min(f, sr * .45) / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q), A = Math.pow(10, db / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
    return x;
  }
  // State-variable filter (TPT) whose cutoff may move: fc is Hz or a function of the sample index.
  function svf(x, fc, q, sr, mode = 'lp') {
    let s1 = 0, s2 = 0, g = 0, a1 = 0, a2 = 0, a3 = 0; const k = 1 / q, fixed = typeof fc === 'number';
    const setF = f => { g = Math.tan(Math.PI * clamp(f, 10, sr * .45) / sr); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; };
    if (fixed) setF(fc);
    for (let i = 0; i < x.length; i++) {
      if (!fixed && (i & 15) === 0) setF(fc(i));
      const v0 = x[i], v3 = v0 - s2, v1 = a1 * s1 + a2 * v3, v2 = s2 + a2 * s1 + a3 * v3; s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
      x[i] = mode === 'lp' ? v2 : mode === 'bp' ? v1 : v0 - k * v1 - v2;
    }
    return x;
  }
  // A decaying sine partial, added in (a recursive oscillator: no Math.sin per sample).
  function partial(out, sr, f, a, t60, atk = .001, at = 0, ph = Math.random() * TAU) {
    if (f >= sr * .45 || f <= 0 || a <= 0) return;
    const w = TAU * f / sr, c = Math.cos(w), s = Math.sin(w), d = Math.pow(.001, 1 / (Math.max(.005, t60) * sr)), na = Math.max(1, atk * sr), n0 = Math.floor(at * sr);
    let x = Math.cos(ph), y = Math.sin(ph), g = a;
    for (let i = n0, k = 0; i < out.length; i++, k++) { out[i] += y * g * (k < na ? k / na : 1); const nx = x * c - y * s; y = x * s + y * c; x = nx; g *= d; if (g < 2e-5) break; }
  }
  // A sine that glides exponentially from f0 to f1 over len seconds, decaying (drops, bubbles, whistles).
  function sweep(out, sr, f0, f1, len, a, t60, at = 0, h2 = 0) {
    const s = Math.floor(at * sr), n = Math.min(out.length - s, Math.floor(sr * (len + t60))), d = Math.pow(.001, 1 / (t60 * sr)), L = Math.max(1, len * sr);
    let ph = 0, g = a;
    for (let i = 0; i < n; i++) { const k = Math.min(1, i / L), f = f0 * Math.pow(f1 / f0, k); ph += TAU * f / sr; const e = i < 60 ? i / 60 : 1; out[s + i] += (Math.sin(ph) + h2 * Math.sin(2 * ph)) * g * e; if (i > L) g *= d; }
  }
  function burst(out, sr, len, f, q, a, mode = 'bp', at = 0, shape = 2) {   // a filtered noise hit
    const n = Math.floor(len * sr), z = svf(noiseArr(n), f, q, sr, mode), s = Math.floor(at * sr);
    for (let i = 0; i < n && s + i < out.length; i++) out[s + i] += z[i] * a * Math.pow(1 - i / n, shape);
  }
  function norm(x, peak = .9) { let m = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > m) m = v; } if (m > 0) { const k = peak / m; for (let i = 0; i < x.length; i++) x[i] *= k; } return x; }
  function fade(x, sr, secs = .03) { const n = Math.min(x.length, Math.floor(secs * sr)); for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n; return x; }
  const arr = (sr, secs) => new Float32Array(Math.max(1, Math.floor(sr * secs)));

  // The buffer cache: every rendered note or sound, least recently used out first past ~40 MB.
  const BUF = new Map(); let bufBytes = 0; const BUF_MAX = 32e6;
  function bufOf(c, key, gen) {
    const k = c.sampleRate + '|' + key; let b = BUF.get(k);
    if (b) { BUF.delete(k); BUF.set(k, b); return b; }
    let d = gen(c.sampleRate); d = Array.isArray(d) ? d : [d];
    b = c.createBuffer(d.length, d[0].length, c.sampleRate); d.forEach((a, i) => b.getChannelData(i).set(a));
    BUF.set(k, b); bufBytes += d.length * d[0].length * 4;
    while (bufBytes > BUF_MAX && BUF.size > 8) { const [fk, fb] = BUF.entries().next().value; BUF.delete(fk); bufBytes -= fb.length * fb.numberOfChannels * 4; }
    return b;
  }
  // Warm-up queue: buffers a song will need are rendered a few at a time, a few ms per tick.
  const WARM = [];
  function warmUp(budget) { const t0 = clock(); while (WARM.length && clock() - t0 < budget) { const [c, key, gen] = WARM.shift(); if (!BUF.has(c.sampleRate + '|' + key)) bufOf(c, key, gen); } }

  // ================================================================ Mezclador
  // master → glue compressor → limiter → out. Buses for music, ambience and effects; a shared hall
  // reverb (and a short room for the effects) fed by per-track sends. Each song and each ambience
  // plays into its own gains, so they can crossfade.
  const LEVEL = { music: .6, amb: .55, sfx: .8 }, PERF = {};
  let M = null, ctx = null, sfxBus = null, noiseBuffer = null, muted = false;
  function impulse(c, secs, pre, dark, early) {
    const sr = c.sampleRate, p0 = Math.floor(pre * sr), n = p0 + Math.floor(secs * sr), b = c.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = new Float32Array(n); let lp = 0, e2 = 0;
      for (let i = p0; i < n; i++) {
        const t = (i - p0) / sr, a = Math.min(.95, .08 + dark * t / secs), env = Math.pow(.001, t / secs) * (1 - Math.exp(-t / .015));
        lp = lp * a + (Math.random() * 2 - 1) * (1 - a); d[i] = lp * env * Math.sqrt((1 + a) / (1 - a));
      }
      for (let k = 0; k < early; k++) { const i = p0 + Math.floor(rnd(.003, .06) * sr); d[i] += rnd(-1, 1) * .5 * (1 - k / early); }
      for (let i = 0; i < n; i++) e2 += d[i] * d[i];
      const k = 1 / Math.sqrt(e2 || 1); for (let i = 0; i < n; i++) d[i] *= k;
      b.getChannelData(ch).set(d);
    }
    return b;
  }
  function gainNode(c, v, to) { const n = c.createGain(); n.gain.value = v; if (to) n.connect(to); return n; }
  // Filters whose cutoff moves compute their coefficients once per block instead of per sample.
  function krate(param) { try { param.automationRate = 'k-rate'; } catch (e) { } return param; }
  function panner(c, p) { if (c.createStereoPanner) { const n = c.createStereoPanner(); n.pan.value = clamp(p, -1, 1); return n; } return c.createGain(); }
  function buildMixer(c) {
    const X = { c, sr: c.sampleRate, waves: {} };
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 14; comp.ratio.value = 2.4; comp.attack.value = .02; comp.release.value = .3;
    const lim = c.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .12;
    X.master = gainNode(c, muted ? 0 : 1); X.master.connect(comp); comp.connect(lim); lim.connect(c.destination);
    const conv = (ir, lvl) => { const cv = c.createConvolver(); cv.normalize = false; cv.buffer = ir; const i = gainNode(c, 1); i.channelCount = 1; i.channelCountMode = 'explicit'; i.connect(cv); cv.connect(gainNode(c, lvl, X.master)); return i; };
    X.hall = conv(impulse(c, PERF.noRev ? .05 : 2.7, .024, .85, 10), 1); X.room = conv(impulse(c, .7, .006, .5, 16), 1);
    X.music = gainNode(c, LEVEL.music, X.master); X.musicWet = gainNode(c, LEVEL.music, X.hall);
    X.amb = gainNode(c, LEVEL.amb, X.master); X.ambWet = gainNode(c, LEVEL.amb, X.hall);
    X.sfx = gainNode(c, LEVEL.sfx, X.master); X.sfx.connect(gainNode(c, .22, X.room)); X.sfx.connect(gainNode(c, .06, X.hall));
    X.sfxWet = gainNode(c, LEVEL.sfx, X.hall);
    X.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); X.noise.getChannelData(0).set(noiseArr(c.sampleRate * 2));
    return X;
  }
  function wave(X, name) {
    if (X.waves[name]) return X.waves[name];
    const h = WAVES[name], re = new Float32Array(h.length + 1), im = new Float32Array(h.length + 1); h.forEach((a, i) => { im[i + 1] = a; });
    return X.waves[name] = X.c.createPeriodicWave(re, im);
  }
  const WAVES = {   // harmonic amplitudes (1st, 2nd, 3rd...)
    sine: [1], flauta: [1, .32, .12, .06, .025, .01], pan: [1, .04, .3, .02, .12, .01, .05], ocarina: [1, .07, .04, .01],
    clarinete: [1, .04, .55, .03, .32, .02, .18, .01, .1, 0, .05], fretless: [1, .5, .28, .14, .08, .04, .02], bajo: [1, .32, .1, .03],
    reed: [1, .8, .62, .5, .42, .35, .28, .22, .17, .13, .1, .08, .06, .05], armonica: [1, .5, .75, .3, .45, .2, .25, .1, .12],
    horn: [1, .75, .52, .36, .24, .15, .1, .06, .04, .02] };

  // ================================================================ Voces
  // A track: its voices go to tr.dest (the instrument's insert, if any) → tr.in (volume) → pan → the
  // song; tr.in also feeds the reverb and echo sends. Voices are registered so the polyphony stays
  // capped: past it, the oldest voice fades out in 20 ms.
  function mkTrack(host, key, d) {
    const c = host.c, inst = ALIAS[d.inst] || d.inst, I = INST[inst], drum = inst === 'bateria';
    const tr = { key, d, c, M: host.M, inst, I, drum, voices: [], sub: {}, host };
    tr.in = gainNode(c, d.vol ?? .7); tr.pan = panner(c, d.pan || 0); tr.in.connect(tr.pan); tr.pan.connect(host.out);
    const rv = d.rev ?? (I && I.rev) ?? (drum ? .12 : .2); if (rv > 0) tr.in.connect(gainNode(c, rv, host.wet));
    if (d.eco && host.echo) tr.in.connect(gainNode(c, d.eco, host.echo));
    tr.dest = tr.in; if (I && I.track) I.track(tr);
    return tr;
  }
  function reg(tr, t, end, g) {
    const v = tr.voices; for (let i = v.length - 1; i >= 0; i--) if (v[i].end < t) v.splice(i, 1);
    const poly = tr.d.poly || (tr.I && tr.I.poly) || 8;
    while (v.length >= poly) { const o = v.shift(); try { const p = o.g.gain; if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t); p.setTargetAtTime(0, t, .012); } catch (e) { } }
    v.push({ end, g });
  }
  // Glides a parameter through [[seconds after t, midi], ...] (legato slurs, slides).
  function glide(param, t, m0, list, map, secs = .07) { let prev = m0; for (const [dt, m] of list) { param.setValueAtTime(map(prev), t + dt); param.linearRampToValueAtTime(map(m), t + dt + secs); prev = m; } }

  // A pre-rendered note: the cached buffer, a gain, and a low-pass that closes on soft notes.
  function playBuf(tr, name, I, t, m, dur, vel, o) {
    const c = tr.c, buf = bufOf(c, name + m, sr => I.gen(m, sr)), src = c.createBufferSource(); src.buffer = buf;
    const r0 = o.rate || 1; src.playbackRate.setValueAtTime(o.scoop ? r0 * .92 : r0, t); if (o.scoop) src.playbackRate.linearRampToValueAtTime(r0, t + .08);
    if (o.glide) glide(src.playbackRate, t, m, o.glide, m1 => r0 * Math.pow(2, (m1 - m) / 12), I.glideT || .06);
    const g = c.createGain(), a = amp(vel) * (I.gain || 1) * (o.amp || 1), len = buf.duration / r0; let node = src;
    if (I.velLP && vel < .97) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(16000, mtof(m) * (1.5 + 26 * vel * vel)); f.Q.value = .5; src.connect(f); node = f; }
    node.connect(g); g.connect(o.dest || tr.dest); g.gain.setValueAtTime(a, t);
    let end = t + len;
    if (!I.ring || o.stac) { const off = t + Math.max(.03, dur), rel = I.rel || .12; if (off < end) { g.gain.setValueAtTime(a, off); g.gain.setTargetAtTime(0, off, rel / 4); end = Math.min(end, off + rel); } }
    src.start(t); src.stop(end + .03); reg(tr, t, end, g); return end;
  }
  // Breath instruments: one oscillator with the pipe's harmonics, a band of breath noise around the
  // note with a 'chiff' at the attack, a slight scoop into pitch and a vibrato that comes in late.
  function wind(tr, t, m, dur, vel, o, p) {
    const c = tr.c, f = mtof(m), a = amp(vel) * p.gain * (o.amp || 1), off = t + dur, end = off + p.rel * 2, at = Math.min(p.atk, dur * .6);
    const vg = c.createGain(); vg.connect(o.dest || tr.dest);
    const osc = c.createOscillator(), g = c.createGain(); osc.setPeriodicWave(wave(tr.M, p.wave)); osc.frequency.setValueAtTime(f, t);
    if (o.glide) glide(osc.frequency, t, m, o.glide, mtof, p.glideT || .06);
    const sc = o.scoop ? 140 : p.scoop || 0; if (sc) { osc.detune.setValueAtTime(-sc, t); osc.detune.linearRampToValueAtTime(0, t + .07 + sc / 2000); }
    let src = osc; if (p.lp) { const lf = c.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = Math.min(12000, f * p.lp[0] + p.lp[1] * vel); lf.Q.value = .5; osc.connect(lf); src = lf; }
    src.connect(g); g.connect(vg);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * (p.over || 1.15), t + at); g.gain.setTargetAtTime(a, t + at, .07); g.gain.setTargetAtTime(0, off, p.rel / 3);
    if (p.vib && dur > .3) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = p.vib[0] * rnd(.92, 1.08); lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + p.vibD); lg.gain.linearRampToValueAtTime(p.vib[1] * (o.vib ?? 1), t + p.vibD + .45); l.connect(lg); lg.connect(osc.detune); l.start(t); l.stop(end); }
    if (p.breath) {
      const n = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain(); n.buffer = tr.M.noise; n.loop = true;
      bp.type = 'bandpass'; krate(bp.frequency); bp.frequency.setValueAtTime(Math.min(12000, f * p.bf), t); bp.Q.value = p.bq; if (o.glide) glide(bp.frequency, t, m, o.glide, m1 => Math.min(12000, mtof(m1) * p.bf));
      ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(a * p.chiff, t + .012); ng.gain.setTargetAtTime(a * p.breath, t + .02, .05); ng.gain.setTargetAtTime(0, off, p.rel / 3);
      n.connect(bp); bp.connect(ng); ng.connect(vg); n.start(t, rnd(0, 1.5)); n.stop(end);
    }
    osc.start(t); osc.stop(end); reg(tr, t, end, vg); return end;
  }
  // Bowed, blown and sung sections: several detuned oscillators spread in stereo, a low-pass that
  // opens with the attack (brighter when louder), formant peaks, delayed vibrato, optional tremolo.
  function ensemble(tr, t, m, dur, vel, o, p) {
    const c = tr.c, f = mtof(m), a = amp(vel) * p.gain * (o.amp || 1), off = t + Math.max(dur, .05), end = off + p.rel * 2.2, n = p.n || 1, at = Math.min(p.atk, dur * .7 + .02);
    const lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.Q.value = p.q || .6; krate(lp.frequency);
    const top = Math.min(p.cutMax || 9000, f * p.cut[0] + p.cut[1] * vel); lp.frequency.setValueAtTime(top * (p.cut0 ?? .5), t); lp.frequency.linearRampToValueAtTime(top, t + at * 1.3); lp.frequency.setTargetAtTime(top * .7, off, p.rel / 2);
    let last = lp; for (const [pf, pq, pg] of p.peaks || []) { const k = c.createBiquadFilter(); k.type = 'peaking'; k.frequency.value = pf; k.Q.value = pq; k.gain.value = pg; last.connect(k); last = k; }
    if (p.trem || o.trem) { const tg = c.createGain(), l = c.createOscillator(), lg = c.createGain(), [rate, dep] = p.trem || [12.5, .7]; tg.gain.value = 1 - dep / 2; lg.gain.value = dep / 2; l.frequency.value = rate * rnd(.95, 1.05); l.connect(lg); lg.connect(tg.gain); last.connect(tg); last = tg; l.start(t); l.stop(end); }
    last.connect(g); g.connect(o.dest || tr.dest);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + at); if (p.dec) g.gain.setTargetAtTime(a * p.dec[0], t + at, p.dec[1]); g.gain.setTargetAtTime(0, off, p.rel / 3);
    let lg = null; if (p.vib && dur > .3) { const l = c.createOscillator(); lg = c.createGain(); l.frequency.value = p.vib[0] * rnd(.9, 1.1); lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + p.vibD); lg.gain.linearRampToValueAtTime(p.vib[1] * (o.vib ?? 1), t + p.vibD + .6); l.connect(lg); l.start(t); l.stop(end); }
    for (let i = 0; i < n; i++) {
      const osc = c.createOscillator(); if (p.wave) osc.setPeriodicWave(wave(tr.M, p.wave)); else osc.type = p.type || 'sawtooth';
      osc.frequency.setValueAtTime(f, t); if (o.glide) glide(osc.frequency, t, m, o.glide, mtof, p.glideT || .08);
      const dt = (n > 1 ? (i / (n - 1) * 2 - 1) * (p.det || 0) : 0) + rnd(-2, 2); osc.detune.setValueAtTime(dt - (o.scoop ? 120 : 0), t); if (o.scoop) osc.detune.linearRampToValueAtTime(dt, t + .1);
      osc.connect(lp);
      if (lg) lg.connect(osc.detune); osc.start(t); osc.stop(end);
    }
    reg(tr, t, end, g); return end;
  }
  // Fretless and synth bass: a round tone whose filter opens and settles ('mwah'), mono, slides.
  function bassV(tr, t, m, dur, vel, o, p) {
    const c = tr.c, f = mtof(m), a = amp(vel) * p.gain * (o.amp || 1), off = t + Math.max(dur, .04), end = off + p.rel * 2;
    const osc = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); osc.setPeriodicWave(wave(tr.M, p.wave)); osc.frequency.setValueAtTime(f, t);
    if (o.glide) glide(osc.frequency, t, m, o.glide, mtof, p.glideT || .1);
    if (o.scoop) { osc.detune.setValueAtTime(-200, t); osc.detune.linearRampToValueAtTime(0, t + .12); }
    lp.type = 'lowpass'; lp.Q.value = p.q; krate(lp.frequency); lp.frequency.setValueAtTime(f * 2 + 120, t); lp.frequency.linearRampToValueAtTime(f * p.open + 700 * vel, t + p.mwah); lp.frequency.setTargetAtTime(f * 2.2 + 150, t + p.mwah, .25);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .006); g.gain.setTargetAtTime(a * p.sus, t + .02, p.decay); g.gain.setTargetAtTime(0, off, p.rel / 3);
    osc.connect(lp); lp.connect(g); g.connect(o.dest || tr.dest); osc.start(t); osc.stop(end); reg(tr, t, end, g); return end;
  }

  // ---------------------------------------------------------------- Generadores de notas
  // Karplus–Strong plucked string: a delay line one period long, fed with a burst of shaped noise,
  // with a loss filter and a fractional all-pass for exact tuning; then the body's resonances.
  function ks(m, sr, o) {
    const f = mtof(m), N = sr / f, b = o.b || .5, dly = 1 - b, L = Math.max(2, Math.floor(N - dly - .2)), d = N - L - dly, C = (1 - d) / (1 + d);
    const t60 = Math.min(o.max, o.t60 * Math.pow(261.6 / f, o.tk ?? .5)), out = arr(sr, Math.min(o.max, t60 + .05)), rho = Math.pow(.001, 1 / (f * t60));
    const buf = new Float32Array(L), kb = .08 + .92 * o.bright * o.bright; let lp = 0, mean = 0;
    for (let i = 0; i < L; i++) { lp += (Math.random() * 2 - 1 - lp) * kb; buf[i] = lp; mean += lp; }
    mean /= L; for (let i = 0; i < L; i++) buf[i] -= mean;
    const pp = Math.max(1, Math.round(L * (o.pos || .2))); for (let i = L - 1; i >= pp; i--) buf[i] -= buf[i - pp] * .9;
    norm(buf, 1);
    let p = 0, last = 0, ax = 0, ay = 0;
    for (let n = 0; n < out.length; n++) { const x = buf[p]; out[n] = x; const lf = rho * (b * x + (1 - b) * last); last = x; const y = C * lf + ax - C * ay; ax = lf; ay = y; buf[p] = y; if (++p === L) p = 0; }
    for (const [bf, bq, bg] of o.body || []) biq(out, 'pk', bf, bq, sr, bg);
    if (o.click) burst(out, sr, .004, 3500, .7, o.click, 'hp');
    return norm(fade(out, sr, .04), .9);
  }
  // Struck bars and tines: inharmonic partials with their own decays, a mallet click, a tremolo.
  function mallet(m, sr, o) {
    const f = mtof(m), sc = Math.pow(261.6 / f, o.tk ?? .5), out = arr(sr, Math.min(o.max, o.parts[0][2] * sc + .12));
    for (const [r, a, t60] of o.parts) partial(out, sr, f * r, a * (f * r > 7000 ? .4 : 1), t60 * sc, o.atk || .0012);
    if (o.click) burst(out, sr, o.click[0], Math.min(o.click[1] * (o.clickF ? f / 261.6 : 1), 12000), 1.2, o.click[2], 'bp');
    if (o.trem) for (let i = 0; i < out.length; i++) out[i] *= 1 - o.trem[1] * (.5 + .5 * Math.sin(TAU * o.trem[0] * i / sr - 1.57));
    if (o.post) o.post(out, sr, f);
    return norm(fade(out, sr, .04), .9);
  }
  // Rhodes-like electric piano: 1:1 FM whose brightness decays, plus the tine's bell.
  function epiano(m, sr) {
    const f = mtof(m), T = Math.min(4.5, 3.4 * Math.pow(261.6 / f, .5)), out = arr(sr, T), w = TAU * f / sr;
    for (let i = 0, ph = 0; i < out.length; i++, ph += w) { const t = i / sr, I = .25 + 1.5 * Math.exp(-t / .3), e = (t < .002 ? t / .002 : 1) * (.5 * Math.exp(-t / .3) + .5) * Math.pow(.001, t / T); out[i] = Math.sin(ph + I * Math.sin(ph)) * e; }
    partial(out, sr, f * 7.02, .06, .35); burst(out, sr, .006, 1200, .8, .05, 'bp');
    return norm(fade(out, sr), .9);
  }
  // A soft piano: stretched harmonics with a two-stage decay, a hammer thump and a slow beat.
  function piano(m, sr) {
    const f = mtof(m), B = .00018 * Math.pow(2, (m - 60) / 18), T = Math.min(6, 4.8 * Math.pow(261.6 / f, .55)), out = arr(sr, Math.min(4.5, T));
    const K = Math.min(18, Math.floor(7500 / f));
    for (let n = 1; n <= K; n++) {
      const fn = f * n * Math.sqrt(1 + B * n * n), a = Math.pow(n, -1.15) * Math.exp(-n / 9), tn = T / (1 + .45 * (n - 1));
      partial(out, sr, fn, a * .65, tn * .25, .002); partial(out, sr, fn * 1.0007, a * .35, tn, .002);
    }
    burst(out, sr, .012, 900, .7, .08, 'lp');
    return norm(fade(out, sr, .08), .9);
  }
  function timpani(m, sr) {
    const f = mtof(m), out = arr(sr, 3);
    [[1, 1, 1.8], [1.504, .55, 1.3], [1.742, .35, 1], [2, .28, .8], [2.245, .18, .6], [2.494, .12, .45]].forEach(([r, a, t]) => partial(out, sr, f * r, a, t, .003));
    sweep(out, sr, f * .75, f * .6, .08, .5, .15); burst(out, sr, .04, 350, .7, .5, 'lp');
    return norm(fade(out, sr, .1), .9);
  }

  // ================================================================ Instrumentos
  // kind 'buf': pre-rendered per note (gen); 'live': built from nodes when played (play).
  // ring: lets the note sound out whatever its written length (a staccato mark ' still damps it).
  const WIND = {
    flauta: { wave: 'flauta', atk: .06, rel: .13, gain: .42, vib: [5.2, 16], vibD: .28, breath: .045, chiff: .3, bf: 1, bq: 2.5, scoop: 18, over: 1.2 },
    flautaPan: { wave: 'pan', atk: .03, rel: .22, gain: .36, vib: [4.6, 9], vibD: .45, breath: .08, chiff: .7, bf: 1, bq: 1.5, scoop: 35, over: 1.4 },
    ocarina: { wave: 'ocarina', atk: .045, rel: .1, gain: .38, vib: [5.6, 13], vibD: .22, breath: .025, chiff: .12, bf: 1, bq: 4, scoop: 10 },
    silbido: { wave: 'sine', atk: .03, rel: .08, gain: .34, vib: [6.2, 26], vibD: .12, breath: .015, chiff: .06, bf: 1, bq: 6, scoop: 60, glideT: .09 },
    clarinete: { wave: 'clarinete', atk: .04, rel: .1, gain: .38, vib: [5, 5], vibD: .5, breath: .03, chiff: .1, bf: 2, bq: 1.5, lp: [5, 2200] } };
  const ENS = {
    cuerdas: { n: 3, det: 10, spread: .7, cut: [4, 1600], cutMax: 6000, cut0: .35, atk: .38, rel: .75, vib: [5.2, 9], vibD: .3, gain: .2 },
    tremolo: { n: 3, det: 10, spread: .7, cut: [5, 2400], cutMax: 7000, cut0: .6, atk: .06, rel: .35, trem: [13, .75], gain: .28 },
    violin: { n: 1, cut: [6, 2400], cutMax: 8000, cut0: .5, q: .7, atk: .09, rel: .22, vib: [5.6, 22], vibD: .2, gain: .3, peaks: [[290, 1.4, 5], [1100, 1.2, 3], [3000, 1.5, 4]] },
    chelo: { n: 1, cut: [5, 1400], cutMax: 4200, cut0: .5, q: .7, atk: .12, rel: .3, vib: [5, 18], vibD: .25, gain: .32, peaks: [[200, 1.3, 6], [650, 1.6, 3]] },
    pad: { n: 3, det: 14, spread: .85, cut: [2, 550], cutMax: 2400, cut0: .25, q: .9, atk: .9, rel: 1.6, vib: [.25, 7], vibD: 0, gain: .2 },
    coro: { n: 3, det: 13, spread: .8, cut: [0, 6500], cutMax: 6500, cut0: 1, atk: .45, rel: .9, vib: [5, 16], vibD: .1, gain: .2 },
    coroU: { n: 3, det: 11, spread: .8, cut: [0, 3000], cutMax: 3000, cut0: 1, atk: .5, rel: 1, vib: [4.8, 14], vibD: .1, gain: .24 },
    trompa: { n: 2, wave: 'horn', det: 4, spread: .2, cut: [2.2, 900], cutMax: 2600, cut0: .35, atk: .17, rel: .28, vib: [5, 6], vibD: .45, gain: .36 },
    metales: { n: 3, det: 8, spread: .5, cut: [3, 2600], cutMax: 5200, cut0: .3, atk: .035, rel: .18, vib: [5.5, 5], vibD: .4, gain: .3 },
    acordeon: { n: 2, wave: 'reed', det: 8, spread: .25, cut: [0, 2400], cutMax: 4400, cut0: .8, atk: .05, rel: .09, trem: [5.2, .12], gain: .5 },
    armonica: { n: 1, wave: 'armonica', cut: [0, 2600], cutMax: 5000, cut0: .7, atk: .035, rel: .08, vib: [5.2, 24], vibD: .2, gain: .45, peaks: [[1500, 2, 5]] } };
  const BASS = {
    fretless: { wave: 'fretless', gain: .62, q: 2.2, open: 5, mwah: .07, sus: .55, decay: .45, rel: .09, glideT: .12 },
    bajo: { wave: 'bajo', gain: .5, q: .8, open: 3, mwah: .02, sus: .75, decay: .6, rel: .07, glideT: .06 } };
  // Track inserts: formants for the choir, a slow chorus for the sections and pads.
  // A stereo chorus per track (not per voice): two short delays swaying in opposite directions, left and right.
  function chorus(tr) {
    const c = tr.c, i = gainNode(c, 1), l = c.createOscillator(), mg = c.createChannelMerger(2), wet = gainNode(c, .7); l.frequency.value = .27; l.start(); i.connect(gainNode(c, .75, tr.in));
    [.012, .017].forEach((dt, k) => { const d = c.createDelay(.05); d.delayTime.value = dt; l.connect(gainNode(c, k ? -.003 : .003, d.delayTime)); i.connect(d); d.connect(mg, 0, k); });
    mg.connect(wet); wet.connect(tr.in); tr.dest = i; tr.lfo = l;
  }
  function formants(tr, F) { chorus(tr); const c = tr.c, i = gainNode(c, 1), sum = gainNode(c, 1); for (const [f, q, g] of F) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; i.connect(b); b.connect(gainNode(c, g, sum)); } sum.connect(tr.dest); tr.dest = i; }
  const INST = {};
  const def = (name, o) => { INST[name] = o; if (o.kind === 'buf') o.play = (tr, t, m, dur, vel, x) => playBuf(tr, name, o, t, m, dur, vel, x); };
  const KS = {
    arpa: { t60: 2.6, tk: .6, max: 3.6, bright: .5, b: .55, pos: .28, body: [[220, 1.2, 3], [1200, 1, -3]], click: .03 },
    guitarra: { t60: 2.1, tk: .5, max: 2.8, bright: .4, b: .52, pos: .16, body: [[105, 1.6, 5], [210, 1.4, 3], [420, 2, 2], [3000, 1, -4]], click: .02 },
    koto: { t60: 1.7, tk: .45, max: 2.2, bright: .8, b: .68, pos: .1, body: [[340, 2, 4], [2200, 2, 2]], click: .08 },
    banjo: { t60: .9, tk: .35, max: 1.3, bright: .92, b: .72, pos: .08, body: [[480, 3, 7], [1500, 2, 3]], click: .12 },
    pizzicato: { t60: .45, tk: .4, max: .9, bright: .35, b: .5, pos: .24, body: [[300, 1, 4], [900, 1.5, 2]] },
    contrabajo: { t60: 1.5, tk: .25, max: 2.2, bright: .3, b: .5, pos: .22, body: [[95, 1, 4], [700, 1, -4]], click: .015 } };
  const KSI = { arpa: { rango: 'C2-G6', ring: 1, poly: 12, rev: .35, velLP: 1, gain: .9, d: 'arpa de concierto: arpegios, glissandos, brillos' },
    guitarra: { rango: 'E2-B5', ring: 0, rel: .25, poly: 8, rev: .22, velLP: 1, d: 'guitarra de nailon: rasgueos (rasgueo:), bossa, punteos' },
    koto: { rango: 'D3-D6', ring: 1, poly: 6, rev: .3, velLP: 1, gain: 1.2, d: 'koto/cítara: punteos brillantes, pentatónicas' },
    banjo: { rango: 'C3-D6', ring: 1, poly: 6, rev: .15, velLP: 1, gain: 1.4, d: 'banjo: rasgueo seco y alegre, el pescador' },
    pizzicato: { rango: 'C2-C6', ring: 1, poly: 10, rev: .28, velLP: 1, gain: 1.3, d: 'cuerdas en pizzicato: pasos juguetones, sigilo' },
    contrabajo: { rango: 'E1-G3', ring: 0, rel: .12, poly: 2, rev: .06, velLP: 1, gain: 1, glideT: .09, d: 'contrabajo pulsado: walking jazz, bajo redondo (con _ desliza)' } };
  for (const k in KS) def(k, Object.assign({ kind: 'buf', gen: (m, sr) => ks(m, sr, KS[k]) }, KSI[k]));
  const MAL = {
    marimba: [{ parts: [[1, 1, 1.1], [3.93, .28, .26], [9.21, .09, .07]], tk: .7, max: 2.2, click: [.004, 2800, .25], atk: .0025 }, { rango: 'A2-C7', rev: .22, d: 'marimba de palo: ostinatos, acordes rotos, cálida' }],
    xilofono: [{ parts: [[1, 1, .6], [3, .5, .28], [6.1, .18, .1], [10.1, .07, .05]], tk: .5, max: 1.3, click: [.003, 5000, .45] }, { rango: 'F4-C8', rev: .2, d: 'xilófono: brillante, seco, travieso' }],
    vibrafono: [{ parts: [[1, 1, 3.4], [4, .22, .9], [10, .05, .25]], tk: .45, max: 4.5, click: [.003, 2500, .1], trem: [5.4, .38], atk: .003 }, { rango: 'F3-F6', rev: .3, d: 'vibráfono con motor: jazz nocturno, acordes suspendidos' }],
    glock: [{ parts: [[1, 1, 2.2], [2.76, .42, .9], [5.4, .2, .4], [8.93, .1, .2]], tk: .3, max: 3, click: [.002, 6500, .22] }, { rango: 'G5-C8', rev: .32, d: 'glockenspiel: destellos, doblar la melodía arriba' }],
    cajita: [{ parts: [[1, 1, 1.4], [1.0028, .35, 1.4], [6.27, .32, .3], [17.55, .07, .06]], tk: .35, max: 2.4, click: [.002, 7000, .3] }, { rango: 'C5-C8', rev: .3, d: 'caja de música: nanas, recuerdos, créditos' }],
    kalimba: [{ parts: [[1, 1, 1.7], [5.93, .2, .12], [12.9, .05, .04]], tk: .5, max: 2.4, click: [.006, 1100, .3], post: (x, sr) => biq(x, 'pk', 190, 1.2, sr, 4) }, { rango: 'C4-E6', rev: .28, d: 'kalimba (sanza): motivos cíclicos, íntima y mágica' }],
    campana: [{ parts: [[.5, .5, 4], [1, 1, 3], [1.19, .55, 2.3], [1.5, .38, 2], [2, .65, 1.8], [2.52, .3, 1.2], [3.01, .22, .9], [4.1, .14, .5]], tk: .4, max: 5, click: [.002, 4000, .18] }, { rango: 'C4-C7', rev: .4, d: 'campana: finales, amanecer, momentos solemnes' }] };
  for (const k in MAL) def(k, Object.assign({ kind: 'buf', ring: 1, poly: 10, velLP: 1, gen: (m, sr) => mallet(m, sr, MAL[k][0]) }, MAL[k][1]));
  def('epiano', { kind: 'buf', ring: 0, rel: .35, poly: 10, rev: .22, velLP: 1, gen: epiano, rango: 'E2-C7', d: 'piano eléctrico (Rhodes): acordes jazz, colchón cálido' });
  def('piano', { kind: 'buf', ring: 0, rel: .4, poly: 14, rev: .25, velLP: 1, gen: piano, rango: 'A1-C8', d: 'piano suave: acordes, melodías tristes o tiernas' });
  def('timbal', { kind: 'buf', ring: 1, poly: 4, rev: .3, gen: timpani, rango: 'D2-C4', d: 'timbales: redobles (%), la Garza, dramatismo' });
  for (const k in WIND) def(k, { kind: 'live', mono: 1, poly: 2, rev: .3, play: (tr, t, m, d, v, o) => wind(tr, t, m, d, v, o, WIND[k]) });
  for (const k in ENS) def(k, { kind: 'live', poly: 8, rev: .3, play: (tr, t, m, d, v, o) => ensemble(tr, t, m, d, v, o, ENS[k]) });
  for (const k in BASS) def(k, { kind: 'live', mono: 1, poly: 1, rev: .05, play: (tr, t, m, d, v, o) => bassV(tr, t, m, d, v, o, BASS[k]) });
  Object.assign(INST.flauta, { rango: 'C4-C7', d: 'flauta travesera: melodías líricas, vibrato tardío' });
  Object.assign(INST.flautaPan, { rango: 'G3-G6', d: 'flauta de pan / zampoña: soplo y chiff, la voz del pantano' });
  Object.assign(INST.ocarina, { rango: 'A3-F6', d: 'ocarina: redonda y pura, nostalgia' });
  Object.assign(INST.silbido, { rango: 'C5-C7', d: 'silbido humano: portamento, el pescador silbando' });
  Object.assign(INST.clarinete, { rango: 'D3-G6', d: 'clarinete: grave cálido, contracantos jazz' });
  Object.assign(INST.cuerdas, { rango: 'C2-C7', poly: 10, rev: .38, trem: 1, track: chorus, d: 'sección de cuerdas: colchones, acordes (x) largos, crecendos' });
  Object.assign(INST.tremolo, { rango: 'C2-C7', poly: 10, rev: .35, track: chorus, d: 'cuerdas en trémolo: tensión, peligro' });
  Object.assign(INST.violin, { rango: 'G3-E7', mono: 1, poly: 2, rev: .32, trem: 1, d: 'violín solista: melodías expresivas (usa _ para ligar)' });
  Object.assign(INST.chelo, { rango: 'C2-A5', mono: 1, poly: 2, rev: .3, trem: 1, d: 'violonchelo: contracantos graves, tristeza' });
  Object.assign(INST.pad, { rango: 'C2-C6', poly: 10, rev: .4, track: chorus, d: 'colchón de sintetizador cálido: fondo, intro, niebla' });
  Object.assign(INST.coro, { rango: 'C3-C6', poly: 10, rev: .45, track: tr => formants(tr, [[750, 5, 3.2], [1150, 7, 2.2], [2800, 9, 1.4], [3600, 10, .6]]), d: 'coro "aah": majestuoso, misterio, la Garza' });
  Object.assign(INST.coroU, { rango: 'C3-C6', poly: 10, rev: .45, track: tr => formants(tr, [[380, 5, 3.4], [800, 6, 1.6], [2500, 9, .5]]), d: 'coro "ooh": suave, nocturno, nana' });
  Object.assign(INST.trompa, { rango: 'F2-F5', poly: 6, rev: .38, d: 'trompa / metal grave: llamadas heroicas, crecidas' });
  Object.assign(INST.metales, { rango: 'E2-C6', poly: 8, rev: .3, d: 'sección de metales: golpes (stabs), fanfarrias' });
  Object.assign(INST.acordeon, { rango: 'F2-A6', poly: 8, rev: .2, d: 'acordeón musette: el muelle del pescador, vals' });
  Object.assign(INST.armonica, { rango: 'C4-C7', mono: 1, rev: .2, d: 'armónica: blues de muelle, ^ para bends' });
  Object.assign(INST.fretless, { rango: 'B0-G3', d: 'bajo sin trastes: redondo, "mwah", deslizamientos con _' });
  Object.assign(INST.bajo, { rango: 'B0-G3', d: 'bajo de sintetizador suave: pulso sencillo' });
  // An orchestral hit: brass and strings stab, with the timpani and a crash on the first note.
  def('golpe', { kind: 'live', poly: 16, rev: .4, rango: 'C3-C6', d: 'golpe orquestal: metales + cuerdas + timbal + platillo', play(tr, t, m, dur, vel, o) {
    const d = Math.min(dur, .4); ensemble(tr, t, m, d, vel, o, ENS.metales); ensemble(tr, t, m + 12, d, vel * .8, o, ENS.tremolo);
    if (!o.i) { let tm = m - 12; while (tm > 60) tm -= 12; while (tm < 38) tm += 12; playBuf(tr, 'timbal', INST.timbal, t, tm, 1, vel, {}); playDrum(tr, 'plato', t, vel * .8, {}); }
    return t + d + .5; } });
  def('bateria', { kind: 'kit', d: 'percusión: una rejilla por instrumento (ver BATERÍA)' });
  const ALIAS = { harp: 'arpa', guitar: 'guitarra', pizz: 'pizzicato', upright: 'contrabajo', bass: 'bajo', xylophone: 'xilofono', glockenspiel: 'glock', musicbox: 'cajita',
    vibraphone: 'vibrafono', bell: 'campana', timpani: 'timbal', flute: 'flauta', panflute: 'flautaPan', whistle: 'silbido', clarinet: 'clarinete', strings: 'cuerdas',
    cello: 'chelo', choir: 'coro', choirOoh: 'coroU', accordion: 'acordeon', harmonica: 'armonica', horn: 'trompa', brass: 'metales', hit: 'golpe', drums: 'bateria', kit: 'bateria', perc: 'bateria', percusion: 'bateria' };

  // ================================================================ Percusión
  // Each drum renders a few variants (so a groove never machine-guns) and plays through its own
  // little pan inside the track. pre: seconds it starts before the beat (a swell that peaks on it).
  const DR = {
    bombo: { g: .7, pan: 0, gen(sr) { const o = arr(sr, .5); let ph = 0; for (let i = 0; i < o.length; i++) { const t = i / sr, f = 52 + 75 * Math.exp(-t / .028); ph += TAU * f / sr; o[i] = Math.sin(ph) * Math.exp(-t / .17); } burst(o, sr, .008, 1800, .7, .18, 'lp'); return norm(o); } },
    caja: { g: .6, gen(sr) { const o = arr(sr, .3); partial(o, sr, 190, .6, .1); partial(o, sr, 330, .3, .06); burst(o, sr, .22, 3200, .6, .8, 'bp', 0, 3); return norm(o); } },
    escobilla: { g: .5, gen(sr) { const o = arr(sr, .25); burst(o, sr, .2, 3800, .45, .7, 'bp', 0, 2.5); partial(o, sr, 200, .18, .05); for (let i = 0; i < 90; i++) o[i] *= i / 90; return norm(o); } },
    barrido: { g: .4, gen(sr) { const o = arr(sr, .5), z = svf(noiseArr(o.length), i => 1800 + 2600 * i / o.length, .6, sr, 'bp'); for (let i = 0; i < o.length; i++) { const k = i / o.length; o[i] = z[i] * Math.sin(Math.PI * Math.pow(k, .7)); } return norm(o); } },
    aro: { g: .5, gen(sr) { const o = arr(sr, .12); partial(o, sr, 1750, .6, .035); partial(o, sr, 480, .5, .05); burst(o, sr, .004, 2200, 4, .6); return norm(o); } },
    hat: { g: .3, pan: .3, gen(sr) { return metal(sr, .06, 7500); } },
    hatAbierto: { g: .3, pan: .3, gen(sr) { return metal(sr, .45, 7000); } },
    ride: { g: .28, pan: -.35, gen(sr) { const o = metal(sr, 1.8, 5000, .25); partial(o, sr, 3150 * rnd(.99, 1.01), .25, .9); partial(o, sr, 4720, .12, .6); return norm(o); } },
    plato: { g: .35, pan: -.25, gen(sr) { const o = metal(sr, 2.2, 3200, .5); burst(o, sr, .05, 5000, .7, .5, 'hp'); return norm(o); } },
    platillo: { g: .32, pan: .2, pre: 1.6, vars: 2, gen(sr) { const o = metal(sr, 1.75, 4000, .7, true); return norm(o); } },
    shaker: { g: .3, pan: .45, vars: 4, gen(sr) { const o = arr(sr, .09); burst(o, sr, .08, 6200, 1.3, 1, 'bp', 0, 3); for (let i = 0, n = sr * .012; i < n; i++) o[i] *= i / n; return norm(o); } },
    pandereta: { g: .3, pan: .4, gen(sr) { const o = arr(sr, .3); for (let k = 0; k < 4; k++) { const at = k * rnd(.004, .009); [5200, 7400, 9100, 11600].forEach(f => partial(o, sr, f * rnd(.97, 1.03), .25, .13, .0005, at)); } burst(o, sr, .1, 8000, .8, .4, 'hp'); partial(o, sr, 260, .2, .05); return norm(o); } },
    conga: { g: .6, pan: -.3, gen(sr) { return membrane(sr, 330, .32, .12); } },
    congaBaja: { g: .6, pan: -.15, gen(sr) { return membrane(sr, 205, .4, .1); } },
    congaSlap: { g: .5, pan: -.3, gen(sr) { const o = membrane(sr, 340, .06, .05); burst(o, sr, .05, 1800, 1, 1.2, 'bp', 0, 3); return norm(o); } },
    congaMute: { g: .5, pan: -.3, gen(sr) { return membrane(sr, 300, .045, .15); } },
    bongo: { g: .5, pan: .25, gen(sr) { return membrane(sr, 520, .14, .1); } },
    bongoBajo: { g: .5, pan: .2, gen(sr) { return membrane(sr, 370, .18, .1); } },
    taco: { g: .45, pan: .35, gen(sr) { return wood(sr, 1050); } },
    tacoBajo: { g: .45, pan: .25, gen(sr) { return wood(sr, 720); } },
    claves: { g: .4, pan: -.4, gen(sr) { const o = arr(sr, .2); partial(o, sr, 2480 * rnd(.99, 1.01), 1, .1); partial(o, sr, 6900, .15, .03); burst(o, sr, .003, 3000, 2, .3); return norm(o); } },
    triangulo: { g: .22, pan: .5, gen(sr) { const o = arr(sr, 2.4), f = 1180 * rnd(.99, 1.01); [[1, .6, 2], [2.76, .5, 1.6], [4.1, .6, 1.3], [5.6, .35, 1], [7.3, .2, .7]].forEach(([r, a, t]) => partial(o, sr, f * r, a, t)); return norm(o); } },
    trianguloMute: { g: .22, pan: .5, gen(sr) { const o = arr(sr, .12), f = 1180; [[1, .6, .08], [2.76, .5, .07], [4.1, .6, .06], [5.6, .35, .05]].forEach(([r, a, t]) => partial(o, sr, f * r, a, t)); return norm(o); } },
    lluvia: { g: .35, pan: -.2, vars: 2, gen(sr) { const o = arr(sr, 2.6); for (let k = 0; k < 700; k++) { const u = Math.pow(Math.random(), .8), at = u * 2.4, d = Math.sin(Math.PI * Math.min(1, u * 1.1)); partial(o, sr, rnd(2200, 7000), rnd(.2, 1) * d, rnd(.01, .03), .0003, at); } return norm(biq(o, 'hp', 1500, .7, sr)); } },
    guiro: { g: .4, pan: .3, gen(sr) { return scrape(sr, .32, 55, 80, 2900); } },
    rana: { g: .4, pan: -.3, gen(sr) { return scrape(sr, .26, 30, 45, 1300); } },
    chasquido: { g: .45, pan: .15, gen(sr) { const o = arr(sr, .1); burst(o, sr, .035, 2300, 1.4, 1, 'bp', 0, 4); partial(o, sr, 1400, .15, .02); return norm(o); } },
    palmas: { g: .45, gen(sr) { const o = arr(sr, .25); [0, .009, .019].forEach(at => burst(o, sr, .012, 1150, 1.2, .8, 'bp', at)); burst(o, sr, .15, 1150, 1, .4, 'bp', .028, 3); return norm(o); } },
    gota: { g: .35, pan: .3, vars: 5, gen(sr) { const o = arr(sr, .25), f = rnd(700, 1500); sweep(o, sr, f, f * 1.7, .02, 1, .08); return norm(o); } },
    tom: { g: .6, gen(sr) { return membrane(sr, 150, .4, .08); } },
    tomBajo: { g: .6, gen(sr) { return membrane(sr, 96, .5, .08); } },
    tambor: { g: .75, gen(sr) { const o = membrane(sr, 62, .75, .12); burst(o, sr, .06, 500, .7, .4, 'lp'); return norm(o); } } };
  function metal(sr, len, hp, noiseAmt = .35, swell = false) {   // cymbals: a cluster of inharmonic partials and noise
    const o = arr(sr, len + (swell ? .1 : 0)), f0 = rnd(330, 360);
    [1, 1.47, 1.82, 2.61, 3.11, 3.79, 4.52, 5.3, 6.17, 7.4, 8.9].forEach(r => partial(o, sr, f0 * r * 4 * rnd(.99, 1.01), rnd(.3, 1), len * rnd(.4, 1), .0005));
    const z = noiseArr(o.length); for (let i = 0; i < o.length; i++) o[i] += z[i] * noiseAmt * Math.pow(.001, i / sr / len);
    biq(o, 'hp', hp, .7, sr);
    if (swell) { const n = Math.floor(len * sr); for (let i = 0; i < o.length; i++) { const k = i / n; o[i] = o[n - 1 - Math.min(i, n - 1)] * Math.pow(Math.min(1, k), 2.2) * (k > 1 ? Math.exp(-(k - 1) * 40) : 1); } }
    return norm(fade(o, sr, .05));
  }
  function membrane(sr, f, t60, slap) {   // hand drums: a pitch that settles, two overtones, the skin's slap
    const o = arr(sr, t60 + .1), ff = f * rnd(.985, 1.015); let ph = 0;
    for (let i = 0; i < o.length; i++) { const t = i / sr, fr = ff * (1 + .06 * Math.exp(-t / .015)); ph += TAU * fr / sr; o[i] = Math.sin(ph) * Math.pow(.001, t / t60); }
    partial(o, sr, ff * 1.59, .35, t60 * .5); partial(o, sr, ff * 2.14, .18, t60 * .3); burst(o, sr, .012, ff * 5, .8, slap * 3, 'bp');
    return norm(fade(o, sr, .02));
  }
  function wood(sr, f) { const o = arr(sr, .16), ff = f * rnd(.99, 1.01); partial(o, sr, ff, 1, .07); partial(o, sr, ff * 2.72, .3, .03); burst(o, sr, .003, ff * 3, 1.5, .4); return norm(o); }
  function scrape(sr, len, r0, r1, f) {   // guiro / wooden frog: a train of little clicks through a resonance
    const o = arr(sr, len + .05); let t = 0, k = 0; while (t < len) { const u = t / len; partial(o, sr, f * rnd(.9, 1.1), rnd(.5, 1) * Math.sin(Math.PI * Math.min(1, u * 1.2 + .1)), .012, .0003, t); t += 1 / (r0 + (r1 - r0) * u); k++; }
    burst(o, sr, len, f, 2, .3, 'bp'); return norm(o);
  }
  const DR_ALIAS = { kick: 'bombo', snare: 'caja', brush: 'escobilla', swish: 'barrido', rim: 'aro', openhat: 'hatAbierto', crash: 'plato', swell: 'platillo', tambourine: 'pandereta',
    congaLow: 'congaBaja', slap: 'congaSlap', mute: 'congaMute', bongoLow: 'bongoBajo', woodblock: 'taco', woodblockLow: 'tacoBajo', triangle: 'triangulo', triangleMute: 'trianguloMute',
    rainstick: 'lluvia', frog: 'rana', snap: 'chasquido', clap: 'palmas', drip: 'gota', tomLow: 'tomBajo', taiko: 'tambor', maraca: 'shaker' };
  function drumSub(tr, name, D) { let s = tr.sub[name]; if (!s) { s = tr.sub[name] = panner(tr.c, D.pan || 0); s.connect(tr.dest); } return s; }
  function playDrum(tr, name, t, vel, o) {
    const D = DR[name]; if (!D) return 0; const c = tr.c, k = (Math.random() * (D.vars || 3)) | 0, buf = bufOf(c, 'dr:' + name + k, sr => D.gen(sr, k));
    const src = c.createBufferSource(), g = c.createGain(); src.buffer = buf; src.playbackRate.value = (o.rate || 1) * (1 + rnd(-.012, .012));
    g.gain.value = amp(vel) * (D.g || 1) * (o.amp || 1); src.connect(g); g.connect(o.dest || drumSub(tr, name, D));
    let st = t - (D.pre || 0), off = 0; const cn = c.currentTime; if (st < cn) { off = cn - st; st = cn; } if (off >= buf.duration) return 0;
    src.start(st, off); return st + buf.duration;
  }

  // ================================================================ Canciones: lectura
  // See musica/LEEME.md. A song: tempo, meter, tracks (instrument + mix), themes (reusable bars),
  // sections (patterns per track) and the form (the order, and where it loops back).
  const SONGS = {}, DYN = { ppp: .2, pp: .3, p: .42, mp: .55, mf: .68, f: .82, ff: .94, fff: 1.05 };
  const DUR = { w: 4, h: 2, q: 1, e: .5, s: .25, x: .125 };
  const MODES = { mayor: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10], dorico: [0, 2, 3, 5, 7, 9, 10], frigio: [0, 1, 3, 5, 7, 8, 10], lidio: [0, 2, 4, 6, 7, 9, 11],
    mixolidio: [0, 2, 4, 5, 7, 9, 10], locrio: [0, 1, 3, 5, 6, 8, 10], armonica: [0, 2, 3, 5, 7, 8, 11], melodica: [0, 2, 3, 5, 7, 9, 11], pentatonica: [0, 2, 4, 7, 9], pentaMenor: [0, 3, 5, 7, 10],
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10] };
  const CHORDS = { '': [0, 4, 7], M: [0, 4, 7], m: [0, 3, 7], min: [0, 3, 7], '5': [0, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '69': [0, 4, 7, 9, 14], m69: [0, 3, 7, 9, 14],
    '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], M7: [0, 4, 7, 11], 'Δ': [0, 4, 7, 11], m7: [0, 3, 7, 10], mmaj7: [0, 3, 7, 11], '9': [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14],
    add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], '11': [0, 7, 10, 14, 17], m11: [0, 3, 7, 10, 14, 17], '13': [0, 4, 7, 10, 14, 21], maj13: [0, 4, 7, 11, 14, 21], m13: [0, 3, 7, 10, 14, 21],
    sus2: [0, 2, 7], sus4: [0, 5, 7], sus: [0, 5, 7], '7sus4': [0, 5, 7, 10], '9sus4': [0, 5, 7, 10, 14], dim: [0, 3, 6], '°': [0, 3, 6], dim7: [0, 3, 6, 9], '°7': [0, 3, 6, 9],
    m7b5: [0, 3, 6, 10], 'ø': [0, 3, 6, 10], aug: [0, 4, 8], '+': [0, 4, 8], '7b9': [0, 4, 7, 10, 13], '7#9': [0, 4, 7, 10, 15], '7#11': [0, 4, 7, 10, 18], 'maj7#11': [0, 4, 7, 11, 18], '7b13': [0, 4, 7, 10, 20], '7#5': [0, 4, 8, 10] };
  const pcOf = n => (NOTE[n[0]] + (n[1] === '#' ? 1 : n[1] === 'b' ? -1 : 0) + 12) % 12;
  function parseChord(s) { const m = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/.exec(s); if (!m || !CHORDS[m[2]]) return null; return { root: pcOf(m[1]), iv: CHORDS[m[2]], bass: m[3] ? pcOf(m[3]) : pcOf(m[1]) }; }
  function durOf(s) { let tot = 0; for (const part of s.split('+')) { const m = /^([whqesx])(\.\.?|t)?$/.exec(part); if (!m) return null; let d = DUR[m[1]]; if (m[2] === '.') d *= 1.5; else if (m[2] === '..') d *= 1.75; else if (m[2] === 't') d *= 2 / 3; tot += d; } return tot; }
  function rangeOf(s, lo, hi) { const m = /^([A-G][#b]?-?\d)\s*-\s*([A-G][#b]?-?\d)$/.exec(s || ''); return m ? [midi(m[1]), midi(m[2])] : [lo, hi]; }
  // Chord voicing: the most characteristic tones (3rd, 7th, colours, then root, 5th), closest to the
  // previous voicing of the track (smooth voice leading), inside the track's range.
  function voicing(ch, lo, hi, n, prev, open) {
    const rank = i => { const s = i % 12; return s === 3 || s === 4 ? 0 : s === 10 || s === 11 ? 1 : i >= 12 ? 2 : s === 9 || s === 2 || s === 5 || s === 6 || s === 8 ? 1.5 : s === 0 ? 3 : 4; };
    const pcs = [...new Set(ch.iv.slice().sort((a, b) => rank(a) - rank(b)).slice(0, n).map(i => (ch.root + i) % 12))];
    let best = null, bs = 1e9;
    for (let b = lo; b <= hi; b++) {
      if (!pcs.includes(b % 12)) continue;
      const v = [b]; for (const p of pcs.filter(p => p !== b % 12).sort((x, y) => ((x - b) % 12 + 12) % 12 - ((y - b) % 12 + 12) % 12)) { let x = v[v.length - 1] + 1; while (x % 12 !== p) x++; v.push(x); }
      if (open && v.length >= 4) { const s = v.splice(v.length - 2, 1)[0] - 12; if (s < lo) continue; v.unshift(s); }
      if (v[v.length - 1] > hi) continue;
      const sc = prev ? v.reduce((a, x) => a + Math.min(...prev.map(y => Math.abs(x - y))), 0) + prev.reduce((a, y) => a + Math.min(...v.map(x => Math.abs(x - y))), 0) : Math.abs((v[0] + v[v.length - 1]) / 2 - (lo + hi) / 2);
      if (sc < bs) { bs = sc; best = v; }
    }
    return best || [lo + ((ch.root - lo) % 12 + 12) % 12];
  }
  const TOK = /\{[^}]*\}(?:\[[^\]]*\]|\([^)]*\))?\S*|\[[^\]]*\]\S*|\([^)]*\)\S*|\S+/g;
  const TAIL = /^((?:[whqesx](?:\.\.?|t)?)(?:\+[whqesx](?:\.\.?|t)?)*)?([!?'_~^*%]*)$/;
  function parseTok(tok, W) {
    if (DYN[tok] !== undefined) return { k: 'dyn', v: DYN[tok] };
    if (tok === '<' || tok === '>') return { k: 'hair' };
    if (tok === 'R') return { k: 'fill' };
    let grace = null, m = /^\{([^}]*)\}(.*)$/.exec(tok);
    if (m) { grace = m[1].trim().split(/\s+/).map(midi); if (grace.some(x => x === null)) { W('adorno raro: ' + tok); grace = null; } tok = m[2]; }
    let ms = null, chord = null, rest;
    if ((m = /^\[([^\]]*)\](.*)$/.exec(tok))) { ms = m[1].trim().split(/\s+/).map(midi); rest = m[2]; if (ms.some(x => x === null)) { W('acorde de notas raro: ' + tok); return null; } }
    else if ((m = /^\(([^)]*)\)(.*)$/.exec(tok))) { chord = parseChord(m[1]); rest = m[2]; if (!chord) { W('cifrado desconocido: ' + m[1]); return null; } chord.sym = m[1]; }
    else if ((m = /^r(.*)$/.exec(tok))) { rest = m[1]; }
    else if ((m = /^([A-G](?:#|b)?-?\d)(.*)$/.exec(tok))) { ms = [midi(m[1])]; rest = m[2]; }
    else { W('no entiendo "' + tok + '"'); return null; }
    const t = TAIL.exec(rest); if (!t) { W('duración o marca rara: ' + tok); return null; }
    const dur = t[1] ? durOf(t[1]) : null, mods = t[2] || '';
    let acc = 1; for (const ch of mods) acc *= ch === '!' ? 1.25 : ch === '?' ? .6 : 1;
    return { k: ms || chord ? 'note' : 'rest', ms, chord, dur, mods, acc, grace };
  }
  function expand(str, temas, W, depth = 0) {
    return depth > 8 ? str : str.replace(/\$(\w+)(?:\*(\d+))?/g, (all, n, k) => {
      const v = temas && temas[n]; if (typeof v !== 'string') { W('tema desconocido: $' + n); return ''; }
      const e = expand(v, temas, W, depth + 1).trim().replace(/^\||\|$/g, ''); return Array(+(k || 1)).fill(e).join(' | ');
    });
  }
  const splitBars = s => s.split('|').map(b => b.trim()).filter(b => b.length);
  function prep(song) {
    if (song._p) return song._p;
    const warn = new Set(), W = s => warn.add(s), [num, den] = String(song.compas || '4/4').split('/').map(Number), bpb = num * 4 / den;
    const tracks = Object.keys(song.pistas || {}).map(key => { const d = song.pistas[key], inst = ALIAS[d.inst] || d.inst; if (!INST[inst]) W('instrumento desconocido: ' + d.inst + ' (pista ' + key + ')'); return { key, d, inst, I: INST[inst], drum: inst === 'bateria' }; });
    const forma = song.forma || Object.keys(song.secciones || {}); forma.forEach(n => { if (!song.secciones[n]) W('la forma nombra una sección que no existe: ' + n); });
    const vuelta = typeof song.vuelta === 'string' ? Math.max(0, forma.indexOf(song.vuelta)) : song.vuelta || 0;
    let scale = null; const sm = /^([A-G][#b]?)\s*(\w*)$/.exec(song.tono || ''); if (sm) scale = { root: pcOf(sm[1]), steps: MODES[sm[2] || 'mayor'] || MODES.mayor };
    return song._p = { song, bpb, tracks, forma, vuelta, bucle: song.bucle !== false, swingU: song.swingEn === 'e' ? .5 : .25, scale, warn, W };
  }
  function upper(S, m) { if (!S.scale) return m + 2; for (let k = 1; k <= 3; k++) if (S.scale.steps.includes(((m + k - S.scale.root) % 12 + 12) % 12)) return m + k; return m + 2; }

  // ================================================================ Canciones: compilación
  // One pass of a section → events { at, t, tr, m | d, dur, vel, o } in seconds from its start
  // (at: when to schedule it, earlier than t for swells that must peak on the beat).
  function compileSection(P, name, vez, exact) {
    const S = P.S, song = S.song, sec = song.secciones[name]; if (!sec) return null;
    const bpb = S.bpb, tempo = sec.tempo || song.tempo || 100, spb = 60 / tempo, evs = [], parts = [];
    for (let ti = 0; ti < S.tracks.length; ti++) {
      const tk = S.tracks[ti]; let v = sec[tk.key]; if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v = v[vez % v.length];
      if (v && v.azar) v = exact ? v.azar[0] : pick(v.azar);
      let ov = {}; if (v && typeof v === 'object' && !Array.isArray(v)) { ov = v; v = v.p; if (Array.isArray(v)) v = v[vez % v.length]; } if (!v) continue;
      const d = Object.assign({}, tk.d, ov, { amp: ov.vol ?? 1 }), src = expand(v, song.temas, S.W);
      parts.push({ tk, ti, d, src, n: tk.drum ? 0 : splitBars(src).length });
    }
    const bars = sec.compases || Math.max(1, ...parts.map(p => p.n));
    for (const p of parts) (p.tk.drum ? drumEvents : noteEvents)(P, p.tk, p.ti, p.src, bars, bpb, p.d, evs, (sec.trans || 0) + (song.trans || 0), name, exact);
    const sw = song.swing || 0, su = S.swingU;
    for (const e of evs) {
      let b = e.b; const q = b / su; if (sw && Math.abs(q - Math.round(q)) < 1e-6 && Math.round(q) % 2 === 1) b += sw * su;
      e.t = b * spb + (e.dt || 0) + (exact ? 0 : rnd(-1, 1) * (e.h || 0) / 1000); e.dur *= spb;
      if (e.o.glide) e.o.glide = e.o.glide.map(([gb, m]) => [gb * spb, m]);
      if (!exact && e.hv) e.vel *= 1 + rnd(-e.hv, e.hv);
      e.at = e.t - (e.pre || 0);
    }
    evs.sort((a, b) => a.at - b.at);
    return { name, vez, bars, bpb, spb, dur: bars * bpb * spb, ev: evs };
  }
  function noteEvents(P, tk, ti, src, bars, bpb, d, out, trans, secName, exact) {
    const S = P.S, I = tk.I || {}, mono = I.mono, list = splitBars(src), W = S.W; if (!list.length) return;
    const st = { dur: 1, dyn: DYN[d.din] || DYN.mf, hair: null }, notes = [];
    let prevBar = '';
    for (let bi = 0; bi < bars; bi++) {
      let bar = list[bi % list.length]; if (bar === '%') bar = prevBar; prevBar = bar;
      let pos = 0; const b0 = bi * bpb;
      for (const tok of bar.match(TOK) || []) {
        const x = parseTok(tok, W); if (!x) continue;
        if (x.k === 'dyn') { if (st.hair) { const h = st.hair, n = notes.length - h.i; for (let j = 0; j < n; j++) notes[h.i + j].vel *= (h.v + (x.v - h.v) * (j + 1) / (n + 1)) / h.v; } st.dyn = x.v; st.hair = null; continue; }
        if (x.k === 'hair') { st.hair = { i: notes.length, v: st.dyn }; continue; }
        if (x.k === 'fill') { pos = Math.max(pos, bpb); continue; }
        const dur = x.dur ?? st.dur; st.dur = dur;
        if (x.k === 'note') notes.push({ b: b0 + pos, ms: x.ms, chord: x.chord, dur, vel: st.dyn * x.acc, mods: x.mods, grace: x.grace });
        pos += dur;
      }
      if (Math.abs(pos - bpb) > 1e-6 && bi < list.length) W(`${secName}/${tk.key}: el compás ${bi + 1} dura ${+pos.toFixed(3)} negras (el compás tiene ${bpb})`);
    }
    // Ties (~) join equal notes; slurs (_) on monophonic voices turn the next note into a glide.
    const res = [];
    for (const n of notes) {
      const last = res[res.length - 1], one = n.ms && n.ms.length === 1, adj = last && Math.abs(last.b + last.dur - n.b) < 1e-6;
      if (adj && one && last.tie && last.cur === n.ms[0]) { last.dur += n.dur; last.tie = n.mods.includes('~'); last.leg = n.mods.includes('_'); continue; }
      if (adj && one && last.leg && mono && last.ms && last.ms.length === 1) { (last.glide = last.glide || []).push([n.b - last.b, n.ms[0]]); last.cur = n.ms[0]; last.dur += n.dur; last.tie = n.mods.includes('~'); last.leg = n.mods.includes('_'); continue; }
      n.tie = n.mods.includes('~'); n.leg = n.mods.includes('_'); n.cur = one ? n.ms[0] : null; if (last && last.leg && !mono) last.dur *= 1.08; res.push(n);
    }
    const shift = (d.oct || 0) * 12 + (d.trans || 0) + trans, [lo, hi] = rangeOf(d.rango, 55, 74), hum = d.humano ?? 8, hv = d.humanoVel ?? .07, ring = I.ring;
    const push = (m, b, dur, vel, o, dt) => { m += shift; if (d.amp !== 1) o.amp = d.amp; if (P.range && tk.I && tk.I.rango) { const [a, z] = rangeOf(tk.I.rango); if (m < a - 2 || m > z + 2) W(`${secName}/${tk.key}: nota ${m} fuera del rango de ${tk.inst} (${tk.I.rango})`); } out.push({ tr: ti, m, b, dur, vel, o, h: hum, hv, dt: dt || 0 }); };
    for (const n of res) {
      let ms = n.ms;
      if (n.chord) { ms = voicing(n.chord, lo, hi, d.voces || 4, P.vl[ti], d.abierto); P.vl[ti] = ms; if (d.bajo) { let bm = lo - 12 + ((n.chord.bass - lo) % 12 + 12) % 12; ms = [bm, ...ms]; } }
      const md = n.mods, o = {}; let dur = n.dur;
      if (md.includes("'")) { dur *= .45; o.stac = 1; }
      if (md.includes('^')) o.scoop = 1;
      if (n.glide) o.glide = n.glide.map(([gb, m]) => [gb, m + shift]);
      if (n.grace) n.grace.forEach((g, k) => push(g, n.b, .12, n.vel * .6, {}, -(n.grace.length - k) * .055));
      if (md.includes('%') || md.includes('*')) {
        if (md.includes('%') && I.trem) { o.trem = 1; ms.forEach((m, i) => push(m, n.b, dur, n.vel, Object.assign({ i }, o))); continue; }
        const step = .125, k = Math.max(2, Math.round(dur / step)), tr = md.includes('*');
        for (let j = 0; j < k; j++) ms.forEach((m, i) => push(tr && j % 2 ? upper(S, m) : m, n.b + j * step, step * 1.1, n.vel * (j === 0 ? 1 : rnd(.72, .9)), { i }));
        continue;
      }
      if (ms.length > 1 && d.arp) {
        const base = ms.slice().sort((a, b) => a - b), pool = []; for (let k = 0; k < (d.arpOct || 1); k++) for (const m of base) pool.push(m + 12 * k);
        const seq = d.arp === 'down' ? pool.slice().reverse() : d.arp === 'updown' ? pool.concat(pool.slice(1, -1).reverse()) : /\d/.test(d.arp) ? String(d.arp).trim().split(/\s+/).map(x => { const i = +x - 1; return pool[i % pool.length] + 12 * Math.floor(i / pool.length); }) : pool;
        const step = durOf(d.arpPaso || 'e') || .5;
        for (let j = 0, p = 0; p < dur - 1e-6; j++, p += step) push(d.arp === 'random' ? pick(pool) : seq[j % seq.length], n.b + p, ring ? step * 2 : Math.min(step * 1.05, dur - p), n.vel * (j === 0 ? 1 : .85), { i: j });
        continue;
      }
      const strum = d.rasgueo || 0;
      ms.forEach((m, i) => push(m, n.b, dur, n.vel * (i && strum ? .9 : 1), Object.assign({ i }, o), strum * i));
    }
  }
  function drumEvents(P, tk, ti, src, bars, bpb, d, out, trans, secName, exact) {
    const W = P.S.W, hum = d.humano ?? 5, hv = d.humanoVel ?? .08;
    for (const line of src.split('\n')) {
      const s = line.trim(); if (!s) continue;
      const m = /^([A-Za-z]\w*)\s+(.+)$/.exec(s); if (!m) { W(`${secName}/${tk.key}: línea de percusión rara: "${s}"`); continue; }
      const name = DR_ALIAS[m[1]] || m[1], D = DR[name]; if (!D) { W(`${secName}/${tk.key}: percusión desconocida: ${m[1]}`); continue; }
      const list = splitBars(m[2]).map(x => x.replace(/\s+/g, ''));
      for (let bi = 0; bi < bars; bi++) {
        const g = list[bi % list.length], n = g.length, step = bpb / n;
        for (let i = 0; i < n; i++) {
          const ch = g[i]; if (ch === '.' || ch === '-' || ch === '_') continue;
          const b = bi * bpb + i * step, e = (vel, dt = 0) => out.push({ tr: ti, d: name, b, dur: step, vel, o: d.amp !== 1 ? { amp: d.amp } : {}, pre: D.pre, h: hum, hv, dt });
          if (ch === 'x') e(.72); else if (ch === 'X') e(1); else if (ch === 'o') e(.38);
          else if (ch === 'f') { e(.42, -.028); e(.8); }
          else if (ch === 'R') { for (let k = 0; k < 4; k++) out.push({ tr: ti, d: name, b: b + k * step / 4, dur: step / 4, vel: .45 + k * .08, o: {}, pre: D.pre, h: 2, hv }); }
          else if (ch >= '1' && ch <= '9') { if (exact || Math.random() < (ch - '0') / 10) e(.55); }
          else W(`${secName}/${tk.key}: carácter de rejilla raro "${ch}" en ${name}`);
        }
        if (bi < list.length && bpb * 4 % n !== 0 && n !== 3 && n % 3 !== 0) W(`${secName}/${tk.key}: ${name} tiene ${n} pasos en el compás ${bi + 1}`);
      }
    }
  }

  // ================================================================ Reproductor
  // A player owns one song's gains (for the crossfade), its tracks and echo, and a queue of compiled
  // sections laid out in absolute time; pump() schedules whatever falls before the horizon.
  function Player(X, song, name, t0, log, fadeIn = .05) {
    const c = X.c, S = prep(song), P = { X, c, S, song, name, log, q: [], k: 0, vez: {}, hist: [], vl: {}, next: t0, t0, M: X };
    P.out = gainNode(c, 0, X.music); P.wet = gainNode(c, 0, X.musicWet);
    if (song.eco) {   // a ping-pong echo, in time with the song
      const e = song.eco, spb = 60 / (song.tempo || 100), dt = Math.min(1.9, (durOf(e.tiempo || 'e.') || .75) * spb), a = c.createDelay(2), b = c.createDelay(2), fb = gainNode(c, e.fb ?? .35), lp = c.createBiquadFilter();
      a.delayTime.value = dt; b.delayTime.value = dt; lp.type = 'lowpass'; lp.frequency.value = e.tono || 2600;
      P.echo = gainNode(c, 1); P.echo.connect(a); a.connect(lp); lp.connect(b); b.connect(fb); fb.connect(a);
      const pl = panner(c, -.6), pr = panner(c, .6); lp.connect(pl); b.connect(pr); pl.connect(P.out); pr.connect(P.out); lp.connect(gainNode(c, .3, P.wet));
    }
    P.host = { c, M: X, out: P.out, wet: P.wet, echo: P.echo };
    P.tracks = S.tracks.map(tk => mkTrack(P.host, tk.key, tk.d));
    const v = song.vol ?? 1; [P.out, P.wet].forEach(g => { g.gain.setValueAtTime(0, Math.max(0, t0 - .05)); g.gain.linearRampToValueAtTime(v, t0 + fadeIn); });
    return P;
  }
  function enqueue(P) {
    const S = P.S, f = S.forma; if (!f.length) { P.done = true; return; }
    for (let guard = 0; guard < f.length + 1; guard++) {
      if (P.k >= f.length) { if (!S.bucle) { P.done = true; return; } P.k = S.vuelta; P.loops = (P.loops || 0) + 1; }
      const name = f[P.k++], vez = P.vez[name] = (P.vez[name] ?? -1) + 1, sec = compileSection(P, name, vez, false);
      if (!sec || sec.dur <= 0) continue;
      sec.start = P.next; sec.end = P.next + sec.dur; sec.i = 0; P.next = sec.end; P.q.push(sec); P.hist.push({ name, vez, k: P.k - 1, start: sec.start, end: sec.end, bars: sec.bars, spb: sec.spb, bpb: sec.bpb }); if (P.hist.length > 64) P.hist.shift();
      for (const e of sec.ev) { const tr = P.tracks[e.tr]; if (e.d) { const D = DR[e.d]; for (let k = 0; k < (D.vars || 3); k++) WARM.push([P.c, 'dr:' + e.d + k, sr => D.gen(sr, k)]); } else if (tr.I && tr.I.kind === 'buf') WARM.push([P.c, tr.inst + e.m, sr => tr.I.gen(e.m, sr)]); }
      return;
    }
    P.done = true;
  }
  function pump(P, horizon, cur) {
    while (!P.done && P.next < horizon + 3) enqueue(P);
    for (const s of P.q) {
      while (s.i < s.ev.length && s.start + s.ev[s.i].at < horizon) {
        const e = s.ev[s.i++], t = s.start + e.t; if (!P.offline && t < cur - .04) continue;
        const tr = P.tracks[e.tr];
        try { if (e.d) playDrum(tr, e.d, t, e.vel, e.o); else if (tr.I && tr.I.play) tr.I.play(tr, Math.max(t, cur), e.m, e.dur, e.vel, e.o); } catch (err) { if (!P.err) { P.err = 1; console.warn('♪', err); } }
        if (P.log) P.log.push([+t.toFixed(3), tr.key, e.d || tr.inst, e.m ?? null, s.name]);
      }
    }
    P.q = P.q.filter(s => s.i < s.ev.length || s.end > cur - 1);
  }
  function release(P, t, secs) {
    P.stopped = true; for (const g of [P.out, P.wet]) { const p = g.gain; if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); } p.linearRampToValueAtTime(0, t + secs); }
    setTimeout(() => { try { P.out.disconnect(); P.wet.disconnect(); P.tracks.forEach(tr => tr.lfo && tr.lfo.stop()); } catch (e) { } }, (secs + 5) * 1000);
  }

  // ================================================================ Ambientes
  // A living bed per place: continuous layers (water, wind, rain, hum) whose levels wander, and
  // generators of events (crickets, frogs answering each other, birds, splashes, creaks, thunder)
  // placed at random times, pans and distances, so nothing ever loops audibly.
  const AMBS = {
    atardecer: { capas: [['agua', .8], ['brisa', .35], ['insectos', .25]], eventos: [['grillos', { n: 5 }], ['ranas', { tipos: ['ribbit', 'croac', 'toro'], cada: [1.5, 6] }], ['evento', { son: 'pez', cada: [12, 35] }], ['evento', { son: 'pajaro', cada: [9, 24] }], ['evento', { son: 'ola', cada: [2.5, 6] }]] },
    noche: { capas: [['viento', .45], ['agua', .45], ['insectos', .6]], eventos: [['grillos', { n: 7 }], ['ranas', { tipos: ['pip', 'ribbit'], cada: [2, 7] }], ['evento', { son: 'buho', cada: [14, 35] }], ['evento', { son: 'hojas', cada: [3, 9] }], ['evento', { son: 'pez', cada: [25, 60] }]] },
    raices: { capas: [['brisa', .45], ['insectos', .35]], eventos: [['grillos', { n: 3 }], ['evento', { son: 'crujido', cada: [5, 14] }], ['evento', { son: 'hojas', cada: [3, 8] }], ['evento', { son: 'carpintero', cada: [18, 45] }], ['evento', { son: 'pajaro', cada: [8, 20] }], ['evento', { son: 'cigarra', cada: [10, 26] }], ['ranas', { tipos: ['toro'], cada: [10, 30], resp: .3 }]] },
    tormenta: { capas: [['lluvia', 1], ['viento', .7]], eventos: [['evento', { son: 'racha', cada: [5, 12] }], ['evento', { son: 'trueno', cada: [9, 24] }], ['evento', { son: 'goteras', cada: [.4, 1.1] }], ['ranas', { tipos: ['toro', 'croac'], cada: [8, 22], resp: .5 }]] },
    cueva: { capas: [['zumbido', 1], ['hilo', .5]], eco: [.31, .42], eventos: [['evento', { son: 'gota', cada: [.5, 2.4] }], ['evento', { son: 'burbujas', cada: [7, 18] }], ['evento', { son: 'piedra', cada: [18, 45] }]] },
    rio: { capas: [['rio', 1], ['zumbido', .6]], eco: [.27, .35], eventos: [['evento', { son: 'gota', cada: [1.2, 4] }], ['evento', { son: 'burbujas', cada: [1, 4] }]] },
    nido: { capas: [['viento', 1], ['silbo', .6], ['brisa', .4]], eventos: [['evento', { son: 'crujido', cada: [4, 10] }], ['evento', { son: 'hojas', cada: [3, 8] }], ['evento', { son: 'garza', cada: [16, 40] }], ['evento', { son: 'racha', cada: [6, 14] }]] },
    alba: { capas: [['agua', .55], ['brisa', .3]], eventos: [['evento', { son: 'canto', cada: [1.5, 5] }], ['evento', { son: 'canto', cada: [3, 9] }], ['evento', { son: 'paloma', cada: [12, 28] }], ['evento', { son: 'pez', cada: [20, 50] }], ['grillos', { n: 2 }], ['ranas', { tipos: ['ribbit'], cada: [8, 20], resp: .4 }]] },
    lluvia: { capas: [['lluvia', .8]], eventos: [['evento', { son: 'goteras', cada: [.6, 1.4] }]] } };
  const AMB_ALIAS = { dusk: 'atardecer', night: 'noche', roots: 'raices', storm: 'tormenta', cave: 'cueva', river: 'rio', nest: 'nido', dawn: 'alba', rain: 'lluvia' };
  function noiseSrc(A, t) { const s = A.c.createBufferSource(); s.buffer = A.X.noise; s.loop = true; s.playbackRate.value = rnd(.9, 1.1); s.start(t, rnd(0, 1.9)); return s; }
  function filt(c, type, f, q) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  // A continuous layer: noise → filters → level; wander() re-aims the level and colour now and then.
  function layer(A, t0, v, chain, send, wander) {
    const c = A.c, s = noiseSrc(A, t0), g = gainNode(c, 0); let n = s; for (const f of chain) { n.connect(f); n = f; } n.connect(g); g.connect(A.out); if (send) g.connect(gainNode(c, send, A.wet));
    let next = t0; return { g, tick(h) { while (next < h) next += wander(next, g, chain) || 1; }, stop(t) { try { s.stop(t); } catch (e) { } } };
  }
  const BEDS = {
    agua(A, t0, v) { const c = A.c; return layer(A, t0, v, [filt(c, 'lowpass', 420, .8), filt(c, 'highpass', 70, .7)], .3, (t, g, [lp]) => { const pk = rnd(.25, 1) * v * .2, up = rnd(.25, .8); g.gain.setTargetAtTime(pk, t, up * .5); g.gain.setTargetAtTime(pk * .3, t + up, rnd(.3, .6)); lp.frequency.setTargetAtTime(rnd(280, 700), t, .3); return up + rnd(.6, 1.8); }); },
    brisa(A, t0, v) { const c = A.c; return layer(A, t0, v, [filt(c, 'bandpass', 900, .5), filt(c, 'lowpass', 3000, .5)], .4, (t, g, [bp]) => { g.gain.setTargetAtTime(rnd(.15, 1) * v * .07, t, rnd(1, 2.5)); bp.frequency.setTargetAtTime(rnd(500, 1600), t, 1.5); return rnd(2, 5); }); },
    viento(A, t0, v) { const c = A.c; return layer(A, t0, v, [filt(c, 'bandpass', 600, 1.1)], .45, (t, g, [bp]) => { g.gain.setTargetAtTime(rnd(.2, 1) * v * .18, t, rnd(.8, 2)); bp.frequency.setTargetAtTime(rnd(280, 1200), t, rnd(.8, 2)); return rnd(1.5, 4); }); },
    silbo(A, t0, v) { const c = A.c; return layer(A, t0, v, [filt(c, 'bandpass', 1200, 14)], .6, (t, g, [bp]) => { g.gain.setTargetAtTime(Math.random() < .35 ? 0 : rnd(.3, 1) * v * .9, t, rnd(.6, 1.5)); bp.frequency.setTargetAtTime(rnd(700, 1900), t, rnd(.5, 1.5)); return rnd(1.5, 4); }); },
    lluvia(A, t0, v) { const c = A.c, a = layer(A, t0, v, [filt(c, 'highpass', 600, .6), filt(c, 'lowpass', 7500, .5)], .35, (t, g) => { g.gain.setTargetAtTime(rnd(.8, 1) * v * .13, t, 1.5); return rnd(2, 4); }), b = layer(A, t0, v, [filt(c, 'lowpass', 700, .7)], .2, (t, g) => { g.gain.setTargetAtTime(rnd(.6, 1) * v * .15, t, 2); return rnd(2, 5); }); return { tick(h) { a.tick(h); b.tick(h); }, stop(t) { a.stop(t); b.stop(t); } }; },
    rio(A, t0, v) { const c = A.c, a = layer(A, t0, v, [filt(c, 'bandpass', 700, .6)], .4, (t, g, [bp]) => { g.gain.setTargetAtTime(rnd(.5, 1) * v * .25, t, rnd(.1, .4)); bp.frequency.setTargetAtTime(rnd(450, 1100), t, .2); return rnd(.2, .7); }), b = layer(A, t0, v, [filt(c, 'highpass', 2500, .6)], .3, (t, g) => { g.gain.setTargetAtTime(rnd(.2, 1) * v * .05, t, .15); return rnd(.2, .6); }); return { tick(h) { a.tick(h); b.tick(h); }, stop(t) { a.stop(t); b.stop(t); } }; },
    hilo(A, t0, v) { const c = A.c; return layer(A, t0, v, [filt(c, 'bandpass', 2400, 2)], .5, (t, g, [bp]) => { g.gain.setTargetAtTime(rnd(.1, 1) * v * .05, t, .1); bp.frequency.setTargetAtTime(rnd(1800, 3200), t, .1); return rnd(.1, .35); }); },
    zumbido(A, t0, v) { const c = A.c, g = gainNode(c, 0, A.out), os = [44, 66.5, 88.3].map((f, i) => { const o = c.createOscillator(); o.frequency.value = f; o.connect(gainNode(c, [1, .4, .25][i], g)); o.start(t0); return o; }), nz = layer(A, t0, v, [filt(c, 'lowpass', 160, .7)], .5, (t, gg) => { gg.gain.setTargetAtTime(rnd(.4, 1) * v * .2, t, 2); return rnd(3, 6); });
      let next = t0; return { tick(h) { nz.tick(h); while (next < h) { g.gain.setTargetAtTime(rnd(.3, 1) * v * .05, next, 3); next += rnd(3, 7); } }, stop(t) { os.forEach(o => o.stop(t)); nz.stop(t); } }; },
    insectos(A, t0, v) { const c = A.c, out = []; for (const p of [-.6, .6]) { const s = c.createBufferSource(); s.buffer = bufOf(c, 'amb:trino' + (p > 0 ? 1 : 0), sr => trill(sr)); s.loop = true; s.playbackRate.value = rnd(.94, 1.06); const g = gainNode(c, 0), pn = panner(c, p); s.connect(g); g.connect(pn); pn.connect(A.out); g.connect(gainNode(c, .5, A.wet)); s.start(t0, rnd(0, 3)); out.push({ s, g }); }
      let next = t0; return { tick(h) { while (next < h) { out.forEach(o => o.g.gain.setTargetAtTime(rnd(.2, 1) * v * .05, next, 2)); next += rnd(3, 8); } }, stop(t) { out.forEach(o => o.s.stop(t)); } }; } };
  // Plays a pre-rendered sound in the ambience: near is dry and bright; far is quieter, darker, wetter.
  function ambHit(A, buf, t, o) {
    const c = A.c, src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = o.rate || 1; let n = src; const dist = o.dist ?? .5;
    if (dist > .45) { const lp = filt(c, 'lowpass', 9000 - dist * 6500, .5); src.connect(lp); n = lp; }
    const dry = gainNode(c, o.vol * (1 - dist * .7)), pn = panner(c, o.pan || 0); n.connect(dry); dry.connect(pn); pn.connect(A.out);
    n.connect(gainNode(c, o.vol * (.2 + dist * .8), A.wet)); if (o.echo && A.echo) n.connect(gainNode(c, o.vol * o.echo, A.echo));
    src.start(Math.max(t, c.currentTime)); return buf.duration / (o.rate || 1);
  }
  const hit = (A, key, gen, t, o) => ambHit(A, bufOf(A.c, 'amb:' + key, gen), t, o);
  const pos = (d0 = .2, d1 = .9) => ({ pan: rnd(-.85, .85), dist: rnd(d0, d1) });
  const SONES = {   // one-shot sounds of the ambiences: (A, t) → duration
    pez: (A, t) => hit(A, 'pez' + (Math.random() * 4 | 0), splash, t, Object.assign(pos(.3, .9), { vol: .35, rate: rnd(.85, 1.15) })),
    ola: (A, t) => hit(A, 'ola' + (Math.random() * 4 | 0), lap, t, Object.assign(pos(.1, .6), { vol: .2, rate: rnd(.8, 1.2) })),
    pajaro: (A, t) => hit(A, 'pajaro' + (Math.random() * 6 | 0), birdCall, t, Object.assign(pos(.55, .95), { vol: .3, rate: rnd(.9, 1.1) })),
    canto(A, t) { const k = Math.random() * 8 | 0; A.bird = A.bird || {}; const p = A.bird[k] = A.bird[k] || pos(.2, .85); return hit(A, 'canto' + k, song => birdSong(song, k), t, Object.assign({}, p, { vol: .22 })); },
    paloma: (A, t) => hit(A, 'paloma' + (Math.random() * 3 | 0), dove, t, Object.assign(pos(.4, .9), { vol: .35 })),
    buho: (A, t) => hit(A, 'buho' + (Math.random() * 3 | 0), owl, t, Object.assign(pos(.45, .95), { vol: .45 })),
    hojas: (A, t) => hit(A, 'hojas' + (Math.random() * 5 | 0), leaves, t, Object.assign(pos(.1, .7), { vol: .25, rate: rnd(.8, 1.2) })),
    crujido: (A, t) => hit(A, 'crujido' + (Math.random() * 5 | 0), creak, t, Object.assign(pos(.2, .8), { vol: .3, rate: rnd(.8, 1.25) })),
    carpintero: (A, t) => hit(A, 'carp' + (Math.random() * 3 | 0), woodpecker, t, Object.assign(pos(.5, .95), { vol: .3 })),
    cigarra: (A, t) => hit(A, 'cigarra' + (Math.random() * 3 | 0), cicada, t, Object.assign(pos(.3, .8), { vol: .12, rate: rnd(.92, 1.08) })),
    garza: (A, t) => hit(A, 'garza' + (Math.random() * 3 | 0), heronCall, t, Object.assign(pos(.6, .95), { vol: .45, rate: rnd(.9, 1.05) })),
    trueno: (A, t) => hit(A, 'trueno' + (Math.random() * 4 | 0), thunderRoll, t, Object.assign(pos(.5, .9), { vol: .6, rate: rnd(.8, 1.1) })),
    goteras: (A, t) => hit(A, 'goteras' + (Math.random() * 4 | 0), patter, t, Object.assign(pos(.1, .6), { vol: .18, rate: rnd(.8, 1.2) })),
    gota: (A, t) => hit(A, 'gota' + (Math.random() * 10 | 0), caveDrip, t, Object.assign(pos(.2, .9), { vol: .3, echo: .6 })),
    burbujas: (A, t) => hit(A, 'burb' + (Math.random() * 5 | 0), bubbles, t, Object.assign(pos(.2, .7), { vol: .25, echo: .2 })),
    piedra: (A, t) => hit(A, 'piedra' + (Math.random() * 3 | 0), pebbles, t, Object.assign(pos(.5, .9), { vol: .25, echo: .5 })),
    racha(A, t) {   // a gust: a band of noise that swells and sweeps across
      const c = A.c, len = rnd(2, 4), s = noiseSrc(A, t), bp = filt(c, 'bandpass', 300, .9), g = gainNode(c, 0), pn = panner(c, 0), p0 = rnd(-.8, .8);
      bp.frequency.setValueAtTime(rnd(250, 400), t); bp.frequency.linearRampToValueAtTime(rnd(800, 1600), t + len * .5); bp.frequency.linearRampToValueAtTime(rnd(300, 500), t + len);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(rnd(.07, .15), t + len * .45); g.gain.linearRampToValueAtTime(0, t + len);
      if (pn.pan) { pn.pan.setValueAtTime(p0, t); pn.pan.linearRampToValueAtTime(-p0 * .6, t + len); }
      s.connect(bp); bp.connect(g); g.connect(pn); pn.connect(A.out); g.connect(gainNode(c, .5, A.wet)); s.stop(t + len + .1); return len;
    } };
  const GENS = {
    evento(A, t0, o) { let next = t0 + rnd(o.cada[0] * .2, o.cada[1] * .6); return { tick(h) { while (next < h) { const d = SONES[o.son](A, next, o) || 0; next += Math.max(d * .5, rnd(o.cada[0], o.cada[1])); } } }; },
    grillos(A, t0, o) {   // a chorus of crickets, each with its own pitch, pulse count and rhythm, singing and resting
      const cr = []; for (let i = 0; i < (o.n || 4); i++) cr.push(Object.assign(pos(.2, .9), { pitch: Math.round(rnd(3700, 5300) / 100) * 100, pulses: 2 + (Math.random() * 3 | 0), period: rnd(.42, 1.05), next: t0 + rnd(0, 2), on: Math.random() < .75, flip: t0 + rnd(5, 18), vol: rnd(.5, 1) }));
      return { tick(h) { for (const k of cr) while (k.next < h) {
        if (k.next > k.flip) { k.on = !k.on; k.flip = k.next + (k.on ? rnd(8, 30) : rnd(2, 10)); }
        if (k.on) hit(A, 'grillo' + k.pitch + '_' + k.pulses, sr => chirp(sr, k.pitch, k.pulses), k.next, { vol: .11 * k.vol, pan: k.pan, dist: k.dist });
        k.next += k.period * rnd(.96, 1.04); } } };
    },
    ranas(A, t0, o) {   // frogs calling in phrases, often answered by another from elsewhere
      const pool = []; for (let i = 0; i < 5; i++) pool.push(Object.assign(pos(.2, .95), { tipo: pick(o.tipos), rate: rnd(.88, 1.12), v: Math.random() * 3 | 0 }));
      const call = (f, t) => { const R = FROG[f.tipo], n = R.reps[0] + (Math.random() * (R.reps[1] - R.reps[0] + 1) | 0); let tt = t; for (let i = 0; i < n; i++) { hit(A, 'rana' + f.tipo + f.v, sr => frog(sr, f.tipo), tt, { vol: R.vol, pan: f.pan, dist: f.dist, rate: f.rate * rnd(.98, 1.02) }); tt += R.gap * rnd(.85, 1.2); } return tt - t; };
      let next = t0 + rnd(.5, 3);
      return { tick(h) { while (next < h) { const f = pick(pool), d = call(f, next); let e = d; if (Math.random() < (o.resp ?? .6)) { const g = pick(pool.filter(x => x !== f)), at = d + rnd(.25, .9); e = at + call(g, next + at); } next += e + rnd(o.cada[0], o.cada[1]); } } };
    } };
  function Amb(X, name, t0, vol, fadeIn) {
    const def = AMBS[name], c = X.c, A = { X, c, name, beds: [], gens: [] };
    A.out = gainNode(c, 0, X.amb); A.wet = gainNode(c, 0, X.ambWet);
    [A.out, A.wet].forEach(g => { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + fadeIn); });
    if (def.eco) { const d = c.createDelay(1), fb = gainNode(c, def.eco[1]), lp = filt(c, 'lowpass', 2400, .5); d.delayTime.value = def.eco[0]; A.echo = gainNode(c, 1, d); d.connect(lp); lp.connect(fb); fb.connect(d); const pn = panner(c, .4); lp.connect(pn); pn.connect(A.out); lp.connect(gainNode(c, .6, A.wet)); }
    for (const [k, v] of def.capas) A.beds.push(BEDS[k](A, t0, v));
    for (const [k, o] of def.eventos) A.gens.push(GENS[k](A, t0, o));
    return A;
  }
  function ambPump(A, h) { for (const b of A.beds) b.tick(h); for (const g of A.gens) g.tick(h); }
  function ambRelease(A, t, secs) { A.stopped = true; for (const g of [A.out, A.wet]) { const p = g.gain; if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); } p.linearRampToValueAtTime(0, t + secs); } A.beds.forEach(b => b.stop(t + secs + .1)); setTimeout(() => { try { A.out.disconnect(); A.wet.disconnect(); } catch (e) { } }, (secs + 4) * 1000); }

  // ---------------------------------------------------------------- Sonidos de la naturaleza
  function chirp(sr, p, pulses) {   // a cricket: a few pulses of a pure high tone
    const pp = 1 / rnd(27, 34), o = arr(sr, pulses * pp + .03);
    for (let k = 0; k < pulses; k++) { const s = Math.floor(k * pp * sr), n = Math.floor(.016 * sr); for (let i = 0; i < n; i++) { const e = Math.sin(Math.PI * i / n), t = i / sr; o[s + i] += e * (Math.sin(TAU * p * t) + .12 * Math.sin(TAU * 2 * p * t)); } }
    return norm(o, .8);
  }
  function trill(sr) {   // a far-off insect chorus: pulsed high tones drifting in level
    const o = arr(sr, 4); let lv = .5;
    for (const f of [6400, 5800, 7100]) { let ph = 0; const r = rnd(38, 52); for (let i = 0; i < o.length; i++) { if (i % 2048 === 0) lv = clamp(lv + rnd(-.15, .15), .1, 1); ph += TAU * f / sr; const am = Math.pow(Math.max(0, Math.sin(TAU * r * i / sr)), 3); o[i] += Math.sin(ph) * am * lv * .3; } }
    const n = Math.floor(.3 * sr); for (let i = 0; i < n; i++) { const k = i / n; o[i] = o[i] * k + o[o.length - n + i] * (1 - k); }   // crossfade the loop point
    return norm(o.subarray(0, o.length - n).slice(), .6);
  }
  const FROG = { ribbit: { reps: [1, 3], gap: .32, vol: .3 }, croac: { reps: [2, 4], gap: .45, vol: .32 }, toro: { reps: [1, 3], gap: .95, vol: .35 }, pip: { reps: [2, 6], gap: .5, vol: .16 } };
  function frog(sr, kind) {   // a pulse train (the vocal sacs) through two formants
    if (kind === 'pip') { const o = arr(sr, .2), f = rnd(2600, 3000); sweep(o, sr, f, f * 1.15, .1, 1, .05); return norm(o, .8); }
    const P = { ribbit: { len: .19, rate: [120, 90], f: [1300, 2500], syl: [[0, .07], [.1, .08]] }, croac: { len: .3, rate: [42, 36], f: [520, 1350], syl: [[0, .28]] }, toro: { len: .7, rate: [118, 105], f: [260, 620], syl: [[0, .65]] } }[kind];
    const o = arr(sr, P.len + .1), x = new Float32Array(o.length), f1 = P.f[0] * rnd(.9, 1.1), f2 = P.f[1] * rnd(.9, 1.1);
    for (const [s0, len] of P.syl) { let t = s0; while (t < s0 + len) { const u = (t - s0) / len, i = Math.floor(t * sr); if (i < x.length) x[i] += Math.sin(Math.PI * u) * (kind === 'toro' ? Math.min(1, u * 4) : 1); t += 1 / (P.rate[0] + (P.rate[1] - P.rate[0]) * u) * rnd(.93, 1.07); } }
    const a = biq(x.slice(), 'bp', f1, 6, sr), b = biq(x.slice(), 'bp', f2, 8, sr); for (let i = 0; i < o.length; i++) o[i] = a[i] + b[i] * .6;
    if (kind === 'toro') biq(o, 'lp', 900, .7, sr);
    return norm(fade(o, sr), .8);
  }
  function splash(sr) { const o = arr(sr, 1.1), z = svf(noiseArr(o.length), i => 3500 * Math.exp(-i / sr / .12) + 350, .8, sr, 'lp'); for (let i = 0; i < o.length; i++) o[i] += z[i] * Math.pow(.001, i / sr / .45) * .8; for (let k = 0; k < 7; k++) { const f = rnd(450, 1100); sweep(o, sr, f, f * 1.8, .03, rnd(.1, .3), .04, rnd(.02, .35)); } for (let k = 0; k < 5; k++) { const f = rnd(1400, 2600); sweep(o, sr, f, f * 1.5, .015, rnd(.05, .12), .03, rnd(.3, .9)); } return norm(fade(o, sr), .8); }
  function lap(sr) { const len = rnd(.9, 1.6), o = arr(sr, len), z = svf(noiseArr(o.length), rnd(350, 650), .8, sr, 'lp'); for (let i = 0; i < o.length; i++) { const u = i / o.length; o[i] = z[i] * Math.sin(Math.PI * Math.pow(u, .6)) * .8; } for (let k = 0; k < 3; k++) { const f = rnd(250, 500); sweep(o, sr, f, f * 1.9, .05, rnd(.05, .12), .05, rnd(.1, len * .6)); } return norm(o, .7); }
  function birdCall(sr) {   // a distant bird: a two or three note whistle, or a short trill
    const o = arr(sr, 1.2), f = rnd(1800, 3000), k = Math.random();
    if (k < .4) { sweep(o, sr, f, f * 1.15, .12, .8, .04, 0, .1); sweep(o, sr, f * 1.1, f * .8, .35, .8, .08, .22, .1); }
    else if (k < .75) { for (let i = 0; i < 3; i++) sweep(o, sr, f * (1.2 - i * .12), f * (1.1 - i * .12), .14, .7, .05, i * .22, .1); }
    else { for (let i = 0; i < 9; i++) sweep(o, sr, f * 1.3, f * 1.1, .03, .5, .02, i * .055, .1); }
    return norm(fade(o, sr), .7);
  }
  function birdSong(sr, seed) {   // a songbird phrase built from syllables: sweeps up and down, whistles, trills
    const o = arr(sr, 2.2), base = rnd(2400, 4600); let t = 0; const n = 4 + (Math.random() * 7 | 0);
    for (let i = 0; i < n && t < 1.9; i++) {
      const k = Math.random(), f = base * rnd(.8, 1.25);
      if (k < .3) { sweep(o, sr, f * .8, f * 1.3, .06, .7, .02, t, .15); t += .08; }
      else if (k < .55) { sweep(o, sr, f * 1.3, f * .75, .07, .7, .02, t, .15); t += .09; }
      else if (k < .75) { sweep(o, sr, f, f * 1.02, .14, .6, .04, t, .2); t += .17; }
      else { for (let j = 0; j < 6; j++) sweep(o, sr, f * 1.1, f * .95, .018, .45, .01, t + j * .028); t += .18; }
      t += rnd(.02, .09);
    }
    return norm(fade(o, sr), .7);
  }
  function dove(sr) { const o = arr(sr, 1.9), f = rnd(480, 560); [[0, .3, 1], [.42, .5, 1.12], [1.05, .25, 1], [1.4, .3, .96]].forEach(([at, len, k]) => { const s = Math.floor(at * sr), n = Math.floor(len * sr); let ph = 0; for (let i = 0; i < n && s + i < o.length; i++) { ph += TAU * f * k * (1 + .04 * Math.sin(Math.PI * i / n)) / sr; o[s + i] += (Math.sin(ph) + .25 * Math.sin(2 * ph)) * Math.pow(Math.sin(Math.PI * i / n), 1.5); } }); return norm(biq(o, 'lp', 1400, .7, sr), .7); }
  function owl(sr) { const o = arr(sr, 2.2), f = rnd(360, 420); [[0, .35], [.75, .16], [.95, .16], [1.25, .6]].forEach(([at, len]) => { const s = Math.floor(at * sr), n = Math.floor(len * sr); let ph = 0; for (let i = 0; i < n; i++) { const u = i / n; ph += TAU * f * (1 - .06 * u) / sr; o[s + i] += (Math.sin(ph) + .15 * Math.sin(2 * ph)) * Math.pow(Math.sin(Math.PI * u), .8); } }); burst(o, sr, 2, 700, .8, .02, 'bp'); return norm(o, .7); }
  function leaves(sr) { const len = rnd(.4, 1), o = arr(sr, len); for (let k = 0; k < 260; k++) { const u = Math.random(); partial(o, sr, rnd(2500, 8000), rnd(.1, 1) * Math.sin(Math.PI * u), rnd(.003, .01), .0002, u * len * .95); } return norm(biq(o, 'hp', 1800, .7, sr), .6); }
  function creak(sr) {   // wood under strain: stick-slip clicks at a wandering rate through the wood's modes
    const len = rnd(.5, 1.3), x = arr(sr, len + .1); let t = 0; const r0 = rnd(18, 40), r1 = rnd(25, 70);
    while (t < len) { const u = t / len; x[Math.floor(t * sr)] += Math.sin(Math.PI * u); t += 1 / (r0 + (r1 - r0) * Math.sin(Math.PI * u)) * rnd(.9, 1.1); }
    const f = rnd(.8, 1.25), a = biq(x.slice(), 'bp', 280 * f, 10, sr), b = biq(x.slice(), 'bp', 760 * f, 8, sr), c = biq(x.slice(), 'bp', 1750 * f, 6, sr);
    for (let i = 0; i < x.length; i++) x[i] = a[i] + b[i] * .7 + c[i] * .4; return norm(fade(x, sr), .7);
  }
  function woodpecker(sr) { const n = 12 + (Math.random() * 10 | 0), r = rnd(15, 20), o = arr(sr, n / r + .1); for (let k = 0; k < n; k++) { const g = 1 - k / n * .6; partial(o, sr, 1150, g, .025, .0003, k / r); partial(o, sr, 2700, g * .4, .015, .0003, k / r); } return norm(o, .7); }
  function cicada(sr) { const o = arr(sr, rnd(2, 3.5)), z = svf(noiseArr(o.length), rnd(4500, 6000), 3, sr, 'bp'), r = rnd(180, 230); for (let i = 0; i < o.length; i++) { const u = i / o.length; o[i] = z[i] * Math.pow(Math.max(0, Math.sin(TAU * r * i / sr)), 2) * Math.min(1, u * 3) * Math.min(1, (1 - u) * 4); } return norm(o, .6); }
  function heronCall(sr) {   // a distant heron: a harsh, nasal 'fraank'
    const o = arr(sr, .7), x = new Float32Array(o.length); let t = 0; const len = rnd(.35, .55);
    while (t < len) { const u = t / len; x[Math.floor(t * sr)] += Math.sin(Math.PI * Math.min(1, u * 1.4)) * rnd(.7, 1); t += 1 / (rnd(210, 240) - 60 * u) * rnd(.92, 1.08); }
    const a = biq(x.slice(), 'bp', 950, 5, sr), b = biq(x.slice(), 'bp', 2100, 6, sr); for (let i = 0; i < o.length; i++) o[i] = a[i] + b[i] * .8;
    burst(o, sr, len, 1800, 1.5, .04, 'bp'); return norm(fade(o, sr), .8);
  }
  function thunderRoll(sr) {   // far thunder: rumbling bursts of low noise that come and go
    const len = rnd(4.5, 7), o = arr(sr, len), bumps = []; for (let k = 0; k < 3 + (Math.random() * 4 | 0); k++) bumps.push([rnd(0, len * .5), rnd(.08, .5), rnd(.8, 2.5), rnd(.4, 1)]);
    const fc = []; for (let k = 0; k < 20; k++) fc.push(rnd(70, 380));
    const z = svf(noiseArr(o.length), i => fc[Math.floor(i / o.length * 19.99)], .7, sr, 'lp');
    for (let i = 0; i < o.length; i++) { const t = i / sr; let e = 0; for (const [s, a, d, g] of bumps) if (t > s) e += g * (t < s + a ? (t - s) / a : Math.exp(-(t - s - a) / d)); o[i] = z[i] * e; }
    return norm(fade(o, sr, .5), .9);
  }
  function patter(sr) { const o = arr(sr, 1.5); for (let k = 0; k < 45; k++) { const at = rnd(0, 1.4); if (Math.random() < .5) partial(o, sr, rnd(1800, 6000), rnd(.2, 1), rnd(.008, .02), .0002, at); else { const f = rnd(900, 2400); sweep(o, sr, f, f * 1.6, .008, rnd(.1, .4), .02, at); } } return norm(o, .6); }
  function caveDrip(sr) { const o = arr(sr, .4), f = rnd(650, 2100); sweep(o, sr, f, f * rnd(1.4, 2), .018, 1, .09); partial(o, sr, f * .5, .15, .05); return norm(o, .8); }
  function bubbles(sr) { const o = arr(sr, .8); let t = 0; for (let k = 0; k < 3 + (Math.random() * 7 | 0); k++) { const f = rnd(280, 900); sweep(o, sr, f, f * 1.7, .03, rnd(.3, 1), .05, t); t += rnd(.02, .12); } return norm(o, .7); }
  function pebbles(sr) { const o = arr(sr, 1); let t = 0; for (let k = 0; k < 5 + (Math.random() * 5 | 0); k++) { partial(o, sr, rnd(1500, 4000), rnd(.3, 1) * (1 - k / 12), .02, .0002, t); partial(o, sr, rnd(500, 900), .3, .03, .0002, t); t += rnd(.04, .15) * (1 + k * .15); } return norm(o, .6); }

  // ================================================================ Efectos del juego
  // (The same effects as before, now through the mixer with a little room reverb.)
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
    land(k = 1) { const t = ctx.currentTime; noise(t, .06 + k * .05, .08 + k * .16, 'lowpass', 300 + k * 200, 120); osc('sine', 110 - k * 30, t, .07, .06 + k * .14, sfxBus, 40); },
    step() { const t = ctx.currentTime; noise(t, .04, .05, 'bandpass', 900, 500, 2); },
    // Weighted sounds: `w` is how heavy the load is (a mosquito .35, a rock 1, a crate 1.5); heavier is lower and longer.
    glup(w = 1) { const t = ctx.currentTime, f = 1.25 - w * .3; osc('sine', 520 * f, t, .14 + w * .03, .25, sfxBus, 150 * f, .005, .08); osc('triangle', 260 * f, t + .04, .12, .15, sfxBus, 90 * f); noise(t, .1, .1, 'lowpass', 900, 200); if (w >= 1) osc('sine', 90, t + .06, .1, .18 * w, sfxBus, 45); },
    spit(w = 1) { const t = ctx.currentTime, f = 1.3 - w * .35; noise(t, .12 + w * .05, .22 + w * .08, 'bandpass', 700 * f, 2400 * f, 1.5); osc('square', 180 * f, t, .08, .12, sfxBus, 900 * f); if (w >= 1) osc('sine', 80, t, .1, .12 * w, sfxBus, 40); },
    blub() { const t = ctx.currentTime; osc('sine', 300, t, .08, .12, sfxBus, 620, .005, .04); osc('sine', 420, t + .07, .06, .08, sfxBus, 800, .005, .03); },
    sputter() { const t = ctx.currentTime; noise(t, .06, .14, 'bandpass', 1800, 700, 2); osc('sine', 240, t, .05, .06, sfxBus, 120); },
    puff() { const t = ctx.currentTime; noise(t, .1, .15, 'highpass', 1500, 4000); },
    hit() { const t = ctx.currentTime; noise(t, .12, .3, 'lowpass', 1500, 200); osc('square', 220, t, .1, .15, sfxBus, 60); },
    pop() { const t = ctx.currentTime; osc('sine', 800, t, .06, .2, sfxBus, 300); noise(t, .05, .12, 'highpass', 2000); },
    crack() { const t = ctx.currentTime; noise(t, .25, .4, 'lowpass', 2500, 300, .8); osc('triangle', 120, t, .2, .2, sfxBus, 40); },
    thud() { const t = ctx.currentTime; noise(t, .1, .2, 'lowpass', 500, 100); osc('sine', 70, t, .1, .25, sfxBus, 35); },
    hurt() { const t = ctx.currentTime; osc('sawtooth', 500, t, .25, .16, sfxBus, 120); osc('square', 250, t + .05, .2, .1, sfxBus, 70); },
    death() { const t = ctx.currentTime; [0, .12, .24, .4].forEach((d, i) => osc('square', 400 - i * 80, t + d, .16, .14, sfxBus, 200 - i * 40)); },
    pearl() { const t = ctx.currentTime; osc('sine', 900, t, .05, .16, sfxBus, 300, .002, .04); noise(t, .04, .08, 'highpass', 3000); osc('sine', 1046, t + .06, .08, .16, sfxBus, 1400, .003, .05); osc('sine', 1568, t + .13, .14, .14, sfxBus, 1900, .003, .1); },
    thunder() { const t = ctx.currentTime; noise(t, 2.2, .5, 'lowpass', 900, 60, .7); noise(t + .05, .25, .35, 'highpass', 1500, 400); osc('sine', 48, t, 1.2, .3, sfxBus, 30, .02, .8); },
    // The ending: a bird greeting the sun, and a soft bell for the last card.
    chirp() { const t = ctx.currentTime; osc('sine', 2500, t, .06, .05, sfxBus, 3300, .003, .03); osc('sine', 2800, t + .09, .05, .045, sfxBus, 3700, .003, .03); osc('sine', 3100, t + .16, .08, .04, sfxBus, 2600, .003, .05); },
    bell() { const t = ctx.currentTime; [[587, 0], [880, .005], [1175, .01]].forEach(([f, d], i) => osc('sine', f, t + d, 1.6, .12 / (i + 1), sfxBus, f * .998, .004, 1.2)); },
    learn() { const t = ctx.currentTime; ['C5', 'E5', 'G5', 'B5', 'D6', 'G6'].forEach((n, i) => osc('sine', freq(n), t + i * .05, .5 - i * .05, .1, sfxBus, null, .005, .3)); noise(t, .6, .05, 'highpass', 5000, 9000); osc('triangle', 130, t, .5, .12, sfxBus, 260, .02, .3); },
    gust() { const t = ctx.currentTime; noise(t, .45, .42, 'bandpass', 700, 2600, 1.4); noise(t + .05, .35, .2, 'lowpass', 500, 180); osc('sine', 140, t, .25, .12, sfxBus, 70, .01, .15); },
    inhale() { const t = ctx.currentTime; noise(t, .12, .12, 'bandpass', 2200, 900, 2); },
    talk(p) { const t = ctx.currentTime, f = p || 180; osc('triangle', f + Math.random() * f * .33, t, .05, .1, sfxBus, f * .78, .005, .03); },
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
    // The heron's fight: a scream in layers, the wind of her wings, feathers, the stab into the mud...
    shriek(k = 1) { const t = ctx.currentTime; for (let i = 0; i < 3; i++) osc('sawtooth', (1250 - i * 180) * (.9 + k * .1), t + i * .04, .32 + k * .3, .1 + k * .05, sfxBus, 420 - i * 60, .01, .2); osc('square', 1600, t + .06, .18 + k * .2, .05, sfxBus, 700, .01, .12); noise(t, .3 + k * .3, .12 + k * .1, 'bandpass', 2600, 900, 2); },
    gustWind() { const t = ctx.currentTime; noise(t, 1.9, .34, 'bandpass', 380, 1500, 1.2); noise(t + .2, 1.5, .18, 'lowpass', 600, 200); },
    ruffle() { const t = ctx.currentTime; for (let i = 0; i < 7; i++) noise(t + i * .045, .05, .12, 'bandpass', 2400 + i * 200, 1500, 3); },
    feathers() { const t = ctx.currentTime; for (let i = 0; i < 4; i++) noise(t + i * .03, .16, .2, 'bandpass', 900 + i * 400, 3200, 2); osc('square', 900, t, .08, .06, sfxBus, 1800); },
    stab() { const t = ctx.currentTime; noise(t, .14, .3, 'bandpass', 1500, 400, 1.5); osc('triangle', 300, t, .1, .14, sfxBus, 90); },
    squelch() { const t = ctx.currentTime; noise(t, .22, .3, 'lowpass', 700, 150, 2); osc('sine', 180, t, .16, .18, sfxBus, 60, .005, .08); osc('sine', 260, t + .1, .08, .1, sfxBus, 120); },
    rumble() { const t = ctx.currentTime; noise(t, 1.3, .5, 'lowpass', 260, 60, .8); osc('sine', 46, t, 1, .32, sfxBus, 32, .02, .5); },
    whistle() { const t = ctx.currentTime; osc('sine', 1500, t, .65, .06, sfxBus, 420, .05, .1); },
    bossDown() { const t = ctx.currentTime; noise(t, 1.2, .55, 'lowpass', 3000, 90, .7); osc('sine', 70, t, 1, .4, sfxBus, 30, .01, .6); ['E4', 'B4', 'E5', 'G5'].forEach((n, i) => osc('triangle', freq(n), t + .25 + i * .09, .9, .09, sfxBus, null, .01, .6)); },
    stun() { const t = ctx.currentTime; [0, .1, .2, .3, .4].forEach((d, i) => osc('sine', 900 + Math.sin(i) * 300, t + d, .08, .1, sfxBus, 700 + i * 50)); },
    select() { const t = ctx.currentTime; osc('square', 660, t, .05, .1, sfxBus, null, .003, .03); },
    confirm() { const t = ctx.currentTime; osc('square', 523, t, .07, .12, sfxBus, null, .003, .04); osc('square', 784, t + .07, .12, .12, sfxBus, null, .003, .08); },
    clear() { const t = ctx.currentTime; ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'].forEach((n, i) => osc('triangle', freq(n), t + i * .1, .25, .16, sfxBus, null, .005, .15)); },
    text() { const t = ctx.currentTime; osc('square', 1200, t, .02, .05, sfxBus, null, .002, .02); },
    splash() { const t = ctx.currentTime; noise(t, .4, .35, 'lowpass', 2000, 300, .7); osc('sine', 400, t, .15, .12, sfxBus, 80); },
    suckup(lv = 2) { const t = ctx.currentTime, k = [1, 1.26, 1.5][lv - 1]; noise(t, .22, .1 + lv * .04, 'bandpass', 500 * lv, 2600 * lv, 2); osc('triangle', 330 * k, t, .14, .12, sfxBus, 700 * k, .005, .08); if (lv === 3) osc('square', 990, t + .08, .12, .07, sfxBus, 1480, .003, .06); },
    // The learning cinematic: the bite, the big gulp, the power rising in him and bursting out.
    chomp() { const t = ctx.currentTime; noise(t, .09, .22, 'lowpass', 2200, 300, 1); osc('square', 190, t, .09, .12, sfxBus, 70, .002, .05); },
    gulpBig() { const t = ctx.currentTime; osc('sine', 320, t, .4, .2, sfxBus, 80, .01, .15); osc('triangle', 160, t + .05, .3, .08, sfxBus, 60, .01, .1); },
    shing() { const t = ctx.currentTime; osc('sine', 1800, t, .35, .09, sfxBus, 3600, .003, .3); osc('triangle', 2700, t + .03, .3, .05, sfxBus, 5400, .003, .25); noise(t, .12, .05, 'highpass', 5000); },
    heartbeat() { const t = ctx.currentTime; osc('sine', 70, t, .16, .32, sfxBus, 40, .004, .1); osc('sine', 62, t + .2, .14, .24, sfxBus, 36, .004, .1); },
    powerRise() { const t = ctx.currentTime; osc('sawtooth', 70, t, 1.05, .045, sfxBus, 560, .35, .15); osc('triangle', 140, t, 1.05, .07, sfxBus, 1120, .35, .15); osc('sine', 280, t + .5, .55, .05, sfxBus, 1680, .1, .1); noise(t, 1.05, .06, 'bandpass', 250, 3200, 3); },
    powerBurst() { const t = ctx.currentTime; noise(t, .6, .24, 'lowpass', 3500, 180, 1); osc('sine', 70, t, .6, .3, sfxBus, 28, .004, .35); ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => osc('triangle', freq(n), t + .03 * i, .9, .07, sfxBus, null, .005, .45)); },
    charge() { const t = ctx.currentTime; osc('sawtooth', 120, t, .55, .08, sfxBus, 420, .05, .2); },
    charged() { const t = ctx.currentTime; osc('square', 660, t, .06, .12, sfxBus, null, .003, .04); osc('square', 990, t + .06, .1, .12, sfxBus, null, .003, .06); noise(t, .12, .1, 'highpass', 3000); },
    bigspit() { const t = ctx.currentTime; noise(t, .3, .45, 'bandpass', 500, 3000, 1.2); osc('square', 140, t, .12, .2, sfxBus, 1200); osc('sine', 60, t, .18, .3, sfxBus, 30); },
    hiss() { const t = ctx.currentTime; noise(t, .7, .3, 'highpass', 2500, 900, .8); osc('sine', 300, t, .2, .06, sfxBus, 120); },
    clang() { const t = ctx.currentTime; osc('square', 1800, t, .08, .1, sfxBus, 900, .002, .1); osc('triangle', 2400, t, .12, .06, sfxBus, 1200, .002, .1); noise(t, .06, .1, 'highpass', 4000); },
    flap() { const t = ctx.currentTime; noise(t, .12, .2, 'bandpass', 900, 300, 1.5); osc('sine', 420, t, .1, .12, sfxBus, 180, .005, .06); },
    // The level-clear jingle: a snare roll that swells, a run up, a big chord with a cymbal, a quick
    // turn and the final chord with the bass an octave down, a sparkle gliss on top.
    fanfare() { const t = ctx.currentTime;
      for (let i = 0; i < 10; i++) noise(t + i * .03, .05, .05 + i * .02, 'bandpass', 1900, 1200, .9);
      ['C4', 'E4', 'G4', 'C5', 'E5', 'G5'].forEach((n, i) => { osc('square', freq(n), t + .3 + i * .055, .08, .07, sfxBus, null, .003, .04); osc('triangle', freq(n), t + .3 + i * .055, .09, .12, sfxBus, null, .003, .05); });
      const c1 = t + .66;
      ['C6', 'G5', 'E5', 'C5'].forEach((n, i) => osc(i ? 'triangle' : 'square', freq(n), c1, .42, i ? .11 : .08, sfxBus, null, .005, .18));
      osc('triangle', freq('C3'), c1, .42, .22, sfxBus, null, .005, .15); osc('sine', 110, c1, .16, .32, sfxBus, 45); noise(c1, .9, .14, 'highpass', 5000, 9000, .6); noise(c1, .14, .22, 'bandpass', 1800, 900, 1);
      ['A5', 'B5', 'D6'].forEach((n, i) => { osc('square', freq(n), t + 1.12 + i * .1, .09, .08, sfxBus, null, .003, .05); osc('triangle', freq(n), t + 1.12 + i * .1, .09, .1, sfxBus, null, .003, .05); });
      osc('triangle', freq('G2'), t + 1.12, .3, .2, sfxBus, null, .005, .1); noise(t + 1.12, .08, .12, 'bandpass', 1900, 1000, .9); noise(t + 1.32, .08, .14, 'bandpass', 1900, 1000, .9);
      const c2 = t + 1.44;
      ['C6', 'G5', 'E5', 'C5', 'G4'].forEach((n, i) => osc(i ? 'triangle' : 'square', freq(n), c2, 1.3, i ? .11 : .08, sfxBus, null, .005, .7));
      osc('triangle', freq('C2'), c2, 1.3, .26, sfxBus, null, .005, .7); osc('triangle', freq('C3'), c2, 1.3, .16, sfxBus, null, .005, .7);
      osc('sine', 130, c2, .18, .36, sfxBus, 40); noise(c2, .3, .3, 'bandpass', 1600, 700, 1); noise(c2, 1.6, .1, 'highpass', 6000, 9000, .5);
      for (let i = 0; i < 8; i++) osc('sine', freq(['C6', 'E6', 'G6', 'C7', 'E7', 'G7', 'C8', 'E8'][i]), c2 + .15 + i * .04, .2, .05, sfxBus, null, .002, .15); },
    // Tally sounds: a counter tick (k raises the pitch), a letter slamming down, a rubber stamp, the bonus bell.
    tick(k = 0) { const t = ctx.currentTime, f = 1100 * Math.pow(2, (k % 12) / 24); osc('square', f, t, .025, .06, sfxBus, null, .002, .015); },
    slam(k = 0) { const t = ctx.currentTime; noise(t, .09, .22, 'lowpass', 900, 150); osc('triangle', 220 + (k % 8) * 18, t, .1, .2, sfxBus, 70, .002, .05); osc('square', 660 + (k % 8) * 40, t, .03, .05, sfxBus, null, .002, .02); },
    stamp(k = 0) { const t = ctx.currentTime; noise(t, .25, .45, 'lowpass', 1400, 120, .8); osc('sine', 90, t, .2, .4, sfxBus, 35); if (k) { ['E6', 'G6', 'C7'].forEach((n, i) => osc('sine', freq(n), t + .08 + i * .06, .25, .07, sfxBus, null, .003, .2)); noise(t + .08, .5, .05, 'highpass', 6000, 9000); } },
    kaching() { const t = ctx.currentTime; osc('square', 1568, t, .06, .08, sfxBus, null, .002, .04); osc('square', 2093, t + .06, .25, .08, sfxBus, null, .002, .2); noise(t, .3, .08, 'highpass', 5000, 9000); },
    bloop(k = 0) { const t = ctx.currentTime, f = 300 * Math.pow(2, (k % 8) / 12); osc('sine', f, t, .12, .16, sfxBus, f * 2.4, .004, .06); noise(t, .06, .06, 'highpass', 2500); },
    whoosh() { const t = ctx.currentTime; noise(t, .35, .2, 'bandpass', 400, 2400, 1.6); },
    win() { const t = ctx.currentTime; ['D4', 'F4', 'A4', 'D5', 'C5', 'D5', 'F5', 'A5'].forEach((n, i) => osc('triangle', freq(n), t + i * .12, .3, .16, sfxBus, null, .005, .2)); } };
  function play(name, arg) { if (!ctx || muted) return; try { sfx[name] && sfx[name](arg); } catch (e) { /* audio is never fatal */ } }
  // The suction is a looping wind: a noise through a bandpass that rises while the mouth is open.
  // Each step of the inhale: the wind climbs, gets louder and wobbles faster.
  let suckNode = null, jetNode = null;
  function suckLevel(lv) {
    if (!ctx || !suckNode) return; const n = suckNode, t = ctx.currentTime;
    n.fl.frequency.cancelScheduledValues(t); n.fl.frequency.setTargetAtTime([1400, 1900, 2600][lv - 1], t, .08);
    n.g.gain.setTargetAtTime([.22, .28, .34][lv - 1], t, .05); n.lfo.frequency.setTargetAtTime([9, 13, 19][lv - 1], t, .05);
  }
  function suck(on) {
    if (!ctx) return;
    if (on && !suckNode) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 3; fl.frequency.setValueAtTime(400, ctx.currentTime); fl.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 1.2);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(.22, ctx.currentTime + .15);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 9; lg.gain.value = 300; lfo.connect(lg); lg.connect(fl.frequency); lfo.start();
      src.connect(fl); fl.connect(g); g.connect(sfxBus); src.start(); suckNode = { src, g, lfo, fl };
    } else if (!on && suckNode) {
      const n = suckNode; suckNode = null; n.g.gain.setTargetAtTime(0, ctx.currentTime, .05); n.src.stop(ctx.currentTime + .3); n.lfo.stop(ctx.currentTime + .3);
    }
  }
  // The water jet is a soft hiss that follows the hover.
  function jet(on) {
    if (!ctx) return;
    if (on && !jetNode) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 1.2; fl.frequency.value = 2600;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(.16, ctx.currentTime + .08);
      src.connect(fl); fl.connect(g); g.connect(sfxBus); src.start(); jetNode = { src, g };
    } else if (!on && jetNode) { const n = jetNode; jetNode = null; n.g.gain.setTargetAtTime(0, ctx.currentTime, .05); n.src.stop(ctx.currentTime + .3); }
  }

  // ================================================================ Motor en vivo
  const music = { name: null, P: null }, ambS = { name: null, A: null, vol: 1 }, rainS = { on: false, A: null };
  let timer = null;
  function init() {
    if (ctx) { if (ctx.state !== 'running') ctx.resume(); return; }
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    M = buildMixer(ctx); sfxBus = M.sfx; noiseBuffer = M.noise;
    if (music.name) startSong(.05); if (ambS.name) startAmb(.5); if (rainS.on) rain(true);
    timer = setInterval(tick, 40);
  }
  const stats = { ticks: 0, ms: 0, max: 0 };
  function tick() {
    if (!M) return; const t = ctx.currentTime, la = WIN.document && WIN.document.hidden ? 1.6 : .3, c0 = clock();
    if (music.P && !music.P.stopped) pump(music.P, t + la, t);
    if (ambS.A) ambPump(ambS.A, t + la); if (rainS.A) ambPump(rainS.A, t + la);
    warmUp(4);
    const d = clock() - c0; stats.ticks++; stats.ms += d; if (d > stats.max) stats.max = d;
  }
  function startSong(fadeIn) {
    const t = ctx.currentTime; if (music.P) release(music.P, t, 1.3); music.P = null;
    const song = SONGS[music.name]; if (!song) return;
    music.P = Player(M, song, music.name, t + .06, null, fadeIn);
    pump(music.P, t + .3, t);
  }
  function playMusic(name) { if (music.name === name) return; const had = !!music.P; music.name = name; if (ctx) startSong(had ? .9 : .05); }
  function stopMusic() { music.name = null; if (music.P && ctx) release(music.P, ctx.currentTime, 1); music.P = null; }
  function startAmb(fadeIn) { const t = ctx.currentTime; if (ambS.A) ambRelease(ambS.A, t, 2); ambS.A = null; if (AMBS[ambS.name]) { ambS.A = Amb(M, ambS.name, t + .05, ambS.vol, fadeIn); ambPump(ambS.A, t + .3); } }
  // Sound.ambiente('atardecer' | 'dusk' ..., { vol }) crossfades to that place's bed; null silences it.
  function ambiente(name, o = {}) {
    name = name ? AMB_ALIAS[name] || name : null; const vol = o.vol ?? 1;
    if (name === ambS.name) { if (ambS.A && vol !== ambS.vol && ctx) { ambS.vol = vol; [ambS.A.out, ambS.A.wet].forEach(g => g.gain.setTargetAtTime(vol, ctx.currentTime, .8)); } return; }
    ambS.name = name; ambS.vol = vol; if (ctx) { if (name) startAmb(o.fundido ?? 2.5); else if (ambS.A) { ambRelease(ambS.A, ctx.currentTime, 2); ambS.A = null; } }
  }
  // Rain on top of whatever ambience plays (the storm ambience has its own).
  function rain(on) {
    rainS.on = on; if (!ctx) return;
    if (on && !rainS.A) { rainS.A = Amb(M, 'lluvia', ctx.currentTime + .05, 1, 1.5); ambPump(rainS.A, ctx.currentTime + .3); }
    else if (!on && rainS.A) { ambRelease(rainS.A, ctx.currentTime, 1.5); rainS.A = null; }
  }
  function duck(on) {
    if (!M) return; const t = ctx.currentTime, k = on ? .32 : 1, ka = on ? .55 : 1;
    M.music.gain.setTargetAtTime(LEVEL.music * k, t, .12); M.musicWet.gain.setTargetAtTime(LEVEL.music * k, t, .12);
    M.amb.gain.setTargetAtTime(LEVEL.amb * ka, t, .2); M.ambWet.gain.setTargetAtTime(LEVEL.amb * ka, t, .2);
  }
  function setMuted(m) { muted = m; if (M) M.master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, .02); }
  function isMuted() { return muted; }
  function resume() { if (ctx && ctx.state !== 'running') ctx.resume(); }
  // Where the music is now (for the jukebox): song, section, bar, time.
  function estado() {
    const P = music.P, o = { cancion: music.name, ambiente: ambS.name };
    if (!P || !ctx) return o; const t = ctx.currentTime, h = P.hist.find(s => t >= s.start && t < s.end) || P.hist[0]; if (!h) return o;
    return Object.assign(o, { titulo: P.song.titulo || music.name, seccion: h.name, idx: h.k, vez: h.vez, compas: Math.floor((t - h.start) / (h.spb * h.bpb)) + 1, compases: h.bars, t: Math.max(0, t - P.t0), forma: P.S.forma, vueltas: P.loops || 0 });
  }
  // Plays one note (or a drum) outside any song, for effects and auditions: Sound.tocar('marimba', 'E5', .5, .8, { pan, rev }).
  const solo = {};
  function tocar(inst, nota, dur = .5, vel = .8, o = {}) {
    if (!ctx || muted) return; inst = ALIAS[inst] || DR_ALIAS[inst] || inst; const drum = !!DR[inst], k = inst + '|' + (o.pan || 0) + '|' + (o.rev ?? '');
    let tr = solo[k]; if (!tr) tr = solo[k] = mkTrack({ c: ctx, M, out: M.sfx, wet: M.sfxWet }, k, { inst: drum ? 'bateria' : inst, vol: 1, pan: o.pan || 0, rev: o.rev ?? (drum ? .1 : .25) });
    const t = ctx.currentTime + (o.en || 0) + .01;
    try { if (drum) playDrum(tr, inst, t, vel, {}); else for (const n of [].concat(nota)) { const m = typeof n === 'number' ? n : midi(n); if (m !== null && tr.I) tr.I.play(tr, t, m, dur, vel, { i: 0 }); } } catch (e) { }
  }
  function demo(inst) {   // a little phrase across the instrument's range
    const I = INST[ALIAS[inst] || inst]; if (DR[DR_ALIAS[inst] || inst]) { for (let i = 0; i < 8; i++) tocar(inst, null, .2, [.9, .4, .6, .4, 1, .4, .6, .7][i], { en: i * .22 }); return; }
    if (!I || !I.rango) return; const [lo, hi] = rangeOf(I.rango), c = Math.round((lo + hi) / 2 / 12) * 12 - 3;
    [0, 4, 7, 12, 11, 7, 9, 5].forEach((iv, i) => tocar(inst, clamp(c + iv - 6, lo, hi), i === 7 ? 1.4 : .3, .75, { en: i * .3 }));
    tocar(inst, [c - 6, c - 2, c + 1].map(m => clamp(m, lo, hi)), 1.6, .6, { en: 2.6 });
  }

  // ================================================================ Herramientas
  // info(name): the form's first pass without randomness — sections, lengths, repetition.
  function info(name) {
    const song = SONGS[name]; if (!song) return null; const S = prep(song), P = { S, vl: {}, range: true }, secs = [], sigs = [], vez = {};
    let t = 0;
    const walk = (from, to, rec) => { for (let k = from; k < to; k++) { const n = S.forma[k], v = vez[n] = (vez[n] ?? -1) + 1, sec = compileSection(P, n, v, true); if (!sec) continue;
      const bl = sec.bpb * sec.spb, bars = Array.from({ length: sec.bars }, () => []);
      for (const e of sec.ev) { const bi = clamp(Math.floor((e.t + 1e-6) / bl), 0, sec.bars - 1); bars[bi].push(e.tr + ':' + (e.d || e.m) + '@' + Math.round((e.t - bi * bl) / sec.spb * 48)); }
      if (!rec) continue; bars.forEach(b => sigs.push(b.sort().join(' ')));
      secs.push({ nombre: n, vez: v, compases: sec.bars, segundos: +sec.dur.toFixed(2), inicio: +t.toFixed(2), notas: sec.ev.length }); t += sec.dur; } };
    walk(0, S.forma.length, true); const primera = t; if (S.bucle) walk(S.vuelta, S.forma.length, false);   // the second pass only to catch warnings in its variations
    const n1 = secs.reduce((a, s) => a + s.compases, 0), first = sigs;
    return { nombre: name, titulo: song.titulo, tempo: song.tempo, compas: song.compas || '4/4', secciones: secs, primeraVuelta: +primera.toFixed(2), vuelveA: S.bucle ? S.forma[S.vuelta] : null,
      compases: n1, compasesDistintos: new Set(first).size, compasesVacios: first.filter(s => !s).length, avisos: [...S.warn] };
  }
  function validar(name) { const i = info(name); return i ? i.avisos : ['no existe la canción ' + name]; }
  // A test piece for one instrument: runs, a held note, staccatos, a chord and a slur (or a groove for a drum).
  function demoSong(name) {
    name = ALIAS[name] || DR_ALIAS[name] || name;
    if (DR[name]) return { titulo: name, tempo: 100, pistas: { d: { inst: 'bateria', vol: .9 } }, secciones: { A: { compases: 4, d: name + ' x.x. X..o x..x X.x. | x... .... X... .... | xoxo xoxo XoXo xxxx | f... R... x... ....' } }, forma: ['A'], bucle: false };
    const I = INST[name]; if (!I || !I.rango) return { tempo: 100, pistas: {}, secciones: { A: {} }, forma: ['A'] };
    const [lo, hi] = rangeOf(I.rango), c = Math.max(lo + 7, Math.min(hi - 16, Math.round((lo + hi) / 2 / 12) * 12)), n = k => { const x = c + k; return ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][x % 12] + (Math.floor(x / 12) - 1); };
    const run = [0, 2, 4, 5, 7, 9, 11, 12].map(k => n(k) + 'e').join(' ');
    return { titulo: name, tempo: 96, pistas: { a: { inst: name, vol: .9 } }, secciones: { A: { compases: 5, a: `mf ${run} | ${[12, 11, 9, 7, 5, 4, 2, 0].map(k => n(k) + 'e').join(' ')} | p < ${n(0)}h ${n(7)}h ff | mp ${n(4)}q' ${n(5)}q' ${n(7)}q'! ${n(9)}e_ ${n(11)}e_ | [${n(0)} ${n(4)} ${n(7)} ${n(11)}]w` } }, forma: ['A'], bucle: false };
  }
  // render(what, secs): renders a song ('marsh') and/or an ambience ('amb:noche') offline → { buffer, log, hist }.
  async function render(what, secs = 60, o = {}) {
    if (!OAC) throw new Error('sin OfflineAudioContext');
    if (what.startsWith('inst:')) { SONGS.__inst = demoSong(what.slice(5)); delete SONGS.__inst._p; what = '__inst'; }
    const sr = o.sr || 44100, oc = new OAC(2, Math.ceil(sr * secs), sr), X = buildMixer(oc), log = [];
    const ambName = o.amb || (what.startsWith('amb:') ? what.slice(4) : null), song = SONGS[what];
    let P = null, A = null; if (song) { P = Player(X, song, what, .05, log); P.offline = true; } if (ambName) A = Amb(X, AMB_ALIAS[ambName] || ambName, 0, o.ambVol ?? 1, .5);
    const step = o.paso || .25, go = t => { if (P) pump(P, t + .6, t); if (A) ambPump(A, t + .6); };
    go(0); const at = k => oc.suspend(k * step).then(() => { go(k * step); if ((k + 1) * step < secs) at(k + 1); oc.resume(); }); if (step < secs) at(1);
    const buffer = await oc.startRendering();
    return { buffer, log, hist: P ? P.hist : [], info: song ? info(what) : null };
  }

  return { init, play, suck, suckLevel, jet, rain, playMusic, stopMusic, duck, setMuted, isMuted, resume, get ready() { return !!ctx; },
    cancion(name, d) { SONGS[name] = d; delete d._p; }, definicion: name => SONGS[name], ambiente, estado, tocar, demo, info, validar, render,
    canciones: () => Object.keys(SONGS).map(k => ({ nombre: k, titulo: SONGS[k].titulo || k })), ambientes: () => Object.keys(AMBS).filter(k => k !== 'lluvia'),
    instrumentos: () => Object.keys(INST).filter(k => k !== 'bateria').map(k => ({ nombre: k, rango: INST[k].rango, desc: INST[k].d })), percusion: () => Object.keys(DR),
    midi, freq, PERF, stats: () => Object.assign({ buffers: BUF.size, mb: +(bufBytes / 1e6).toFixed(1), estado: ctx && ctx.state }, stats) };
})();
