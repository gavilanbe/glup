// GLUP — el mundo: la tierra del pantano con autotiles, el agua, las piezas del
// decorado y los fondos en capas. Se carga después de art.js y reemplaza sus
// versiones sencillas de esas piezas; los personajes siguen viviendo en art.js.
// Luz de la luna (o del sol) desde arriba a la izquierda: bordes superiores e
// izquierdos iluminados, bajos y derechos en sombra. Nada de negro puro.
'use strict';
const MUNDO = (() => {
  // ---------------------------------------------------------------- Color y ruido
  const rgbCache = new Map();
  function rgb(c) {
    if (typeof c !== 'string') return c;
    let v = rgbCache.get(c); if (v) return v;
    let h = c.slice(1); if (h.length === 3) h = h.replace(/./g, '$&$&');
    const n = parseInt(h, 16); v = [n >> 16 & 255, n >> 8 & 255, n & 255]; rgbCache.set(c, v); return v;
  }
  function mix(a, b, t) { a = rgb(a); b = rgb(b); return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
  const css = c => { c = rgb(c); return '#' + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1); };
  // Evenly spaced colours through a list of key colours.
  function ramp(keys, n) {
    const out = []; for (let i = 0; i < n; i++) { const t = i / (n - 1) * (keys.length - 1), k = Math.min(keys.length - 2, t | 0); out.push(mix(keys[k], keys[k + 1], t - k)); }
    return out;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
  const dith = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  // Pick from a ramp with an ordered dither between neighbouring steps; t in 0..1.
  function pick(r, t, x, y) { const n = r.length - 1; let i = Math.floor(t * n + dith(x, y)); return r[i < 0 ? 0 : i > n ? n : i]; }
  // White noise from a 1024×1024 table (a real hash per pixel is too slow for whole levels on phones).
  const RT = new Float32Array(1 << 20);
  { let h = 2463534242; for (let i = 0; i < RT.length; i++) { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; RT[i] = (h >>> 0) / 4294967296; } }
  const hash = (x, y, s) => RT[((x + s * 97) & 1023) | (((y + s * 57) & 1023) << 10)];
  function noise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = (xi + s * 97) & 1023, x1 = (x0 + 1) & 1023, y0 = ((yi + s * 57) & 1023) << 10, y1 = ((yi + 1 + s * 57) & 1023) << 10;
    const a = RT[x0 | y0], b = RT[x1 | y0], c = RT[x0 | y1], d = RT[x1 | y1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const smooth = v => { v = clamp01(v); return v * v * (3 - 2 * v); };

  // ---------------------------------------------------------------- Lienzos de píxeles
  function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.w = w; c.h = h; return c; }
  function Buf(w, h) { return { w, h, d: new Uint8ClampedArray(w * h * 4) }; }
  function put(b, x, y, c, a) {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
    c = rgb(c); const i = (y * b.w + x) * 4, d = b.d;
    if (a === undefined || a >= 1) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; return; }
    const sa = d[i + 3] / 255, oa = a + sa * (1 - a); if (oa <= 0) return;
    for (let k = 0; k < 3; k++) d[i + k] = (c[k] * a + d[i + k] * sa * (1 - a)) / oa;
    d[i + 3] = oa * 255;
  }
  const alphaAt = (b, x, y) => x < 0 || y < 0 || x >= b.w || y >= b.h ? 0 : b.d[(y * b.w + x) * 4 + 3];
  function rect(b, x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c, a); }
  function toCanvas(b, x0 = 0, w = b.w) {
    const c = newCanvas(w, b.h), g = c.getContext('2d'), img = g.createImageData(w, b.h);
    if (x0 === 0 && w === b.w) img.data.set(b.d);
    else for (let y = 0; y < b.h; y++) img.data.set(b.d.subarray((y * b.w + x0) * 4, (y * b.w + x0 + w) * 4), y * w * 4);
    g.putImageData(img, 0, 0); return c;
  }
  function paint(w, h, fn) { const b = Buf(w, h); fn(b); return toCanvas(b); }
  // Dark outline around everything drawn so far (only on transparent pixels); sides picks which neighbours count.
  function outline(b, col, diag) {
    const src = new Uint8Array(b.w * b.h); for (let i = 0; i < src.length; i++) src[i] = b.d[i * 4 + 3] > 0 ? 1 : 0;
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      if (src[y * b.w + x]) continue;
      const at = (i, j) => i >= 0 && j >= 0 && i < b.w && j < b.h && src[j * b.w + i];
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) || (diag && (at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1)))) put(b, x, y, col);
    }
  }
  const sprite = (rows, pal, name) => ART.sprite(rows, pal, name);

  // ---------------------------------------------------------------- Paletas del mundo
  const OUT = '#1a1420';
  const STONE = ramp(['#16141e', '#262532', '#383846', '#4e4e5c', '#686874', '#86848a', '#aaa49c'], 8);
  const ROOT = ramp(['#130d13', '#21161a', '#33221f', '#482f26', '#624232', '#7e5a40'], 7);
  const BONE = ramp(['#241d24', '#4c4346', '#7c7068', '#aa9e8a', '#d4c8ac', '#eee4ca'], 6);
  const SHELL = ramp(['#241d24', '#5c4248', '#966a6a', '#ca9c88', '#ecc8a8', '#fbe8cc'], 6);
  const TERRA = {
    dusk: { peat: ['#140f19', '#1d1520', '#281b25', '#35222a', '#452c2e', '#573833', '#6c4739', '#835840', '#9c6c4a'],
      moss: ['#1c2626', '#27392d', '#355030', '#476a32', '#5f8836', '#7fa43e', '#a4c050', '#cad86a'], flowers: ['#f2d36b', '#ee9fb8', '#f6f0dc', '#b9a4e8'], cap: '#c8583e', grass: 1 },
    night: { peat: ['#0e1018', '#141722', '#1b1e2a', '#252632', '#302f3a', '#3e3a44', '#4e484e', '#605854', '#746a5e'],
      moss: ['#122024', '#18302e', '#1f4034', '#2a5438', '#386a3e', '#4a8446', '#64a052', '#86bc68'], flowers: ['#bcd8f8', '#f0f4ff', '#c4b0f0', '#9ae0d0'], cap: '#9a5a7a', grass: 1 },
    storm: { peat: ['#0f1116', '#15171e', '#1e2028', '#282830', '#34333a', '#433f45', '#534c50', '#655c5c', '#786e6a'],
      moss: ['#131b1c', '#1a2824', '#23362a', '#2e4630', '#3b5834', '#4c6c3a', '#628244', '#7e9a56'], flowers: ['#e8ecf0', '#d0d8a0'], cap: '#a85a40', grass: 1 },
    cave: { peat: ['#110c16', '#18111e', '#211727', '#2c1e31', '#38263b', '#473046', '#583c52', '#6b4a60', '#80596e'],
      moss: ['#111a22', '#15242c', '#1a3036', '#203e40', '#284e4a', '#325e52', '#407260', '#528a70'], flowers: ['#5fe8d6'], cap: '#5fe8d6', grass: 0 },
    nest: { peat: ['#170e16', '#22131c', '#2e1a22', '#3c2228', '#4d2c2c', '#613830', '#784636', '#90563c', '#a86a46'],
      moss: ['#2a1c22', '#3a2a26', '#4e3a2a', '#66502e', '#826a34', '#a0863c', '#c0a24a', '#e2c464'], flowers: ['#f6d890', '#f4f0e0', '#e88a5a'], cap: '#c04a3a', grass: 1 } };
  for (const k in TERRA) {
    const p = TERRA[k]; p.peatR = p.peat.map(rgb); p.mossR = ramp(p.moss, 10);
    // Roots, shells and bones borrow some of the earth's colour so they sit inside it.
    const tie = (R, k2) => R.map((c, i) => mix(c, p.peatR[Math.min(8, Math.round(i / (R.length - 1) * 8))], k2));
    p.rootR = tie(ROOT, .5); p.boneR = tie(BONE, .3); p.shellR = tie(SHELL, .35); p.stoneR = tie(STONE, .25);
  }

  // ---------------------------------------------------------------- Tierra
  // Builds the whole terrain of a level (the '#' tiles) as a few wide canvases: rounded
  // corners, a moss lip with loose blades, dark topsoil, strata, roots, pebbles, shells
  // and bones, all getting darker and calmer with the distance to open air.
  const CHUNK = 256;
  function buildTerrain(grid, theme, seed = 1) {
    const P = TERRA[theme] || TERRA.dusk, PEAT = P.peatR, MOSS = P.mossR, grassy = !!P.grass;
    const TW = grid[0].length, TH = grid.length, PW = TW * 16, PH = TH * 16, N = PW * PH;
    const ch = (tx, ty) => tx < 0 || tx >= TW ? '#' : ty < 0 ? '.' : ty >= TH ? '#' : grid[ty][tx];
    // Gates and cracked stone can go away, so the earth behind them is finished as if open.
    const kind = c => c === '#' ? 2 : c === 'X' || c === 'M' ? 1 : c === '~' || c === 'w' ? 3 : 0;
    const tk = (tx, ty) => kind(ch(tx, ty));
    const solid = k => k === 1 || k === 2;
    // m: 0 air, 1 other solid, 2 terrain, 3 water.
    const m = new Uint8Array(N);
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) { const k = tk(tx, ty); if (k) for (let y = 0; y < 16; y++) m.fill(k, (ty * 16 + y) * PW + tx * 16, (ty * 16 + y) * PW + tx * 16 + 16); }
    const setPx = (x, y, v) => { if (x >= 0 && y >= 0 && x < PW && y < PH) m[y * PW + x] = v; };
    const getPx = (x, y) => x < 0 || x >= PW || y >= PH ? 2 : y < 0 ? 0 : m[y * PW + x];
    const corner = (tx, ty, sx, sy, r, v, fill) => {
      for (let j = 0; j < r; j++) for (let i = 0; i < r; i++) {
        const dx = r - i - .5, dy = r - j - .5; if (dx * dx + dy * dy <= r * r) continue;
        const x = tx * 16 + (sx < 0 ? i : 15 - i), y = ty * 16 + (sy < 0 ? j : 15 - j);
        if (fill ? getPx(x, y) !== 1 : getPx(x, y) === 2) setPx(x, y, v);
      }
    };
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      const k = tk(tx, ty), L = tk(tx - 1, ty), R = tk(tx + 1, ty), U = tk(tx, ty - 1), D = tk(tx, ty + 1);
      if (k === 2) {
        if (!solid(L) && !solid(U) && !solid(tk(tx - 1, ty - 1))) corner(tx, ty, -1, -1, 5, U === 3 ? 3 : L, false);
        if (!solid(R) && !solid(U) && !solid(tk(tx + 1, ty - 1))) corner(tx, ty, 1, -1, 5, U === 3 ? 3 : R, false);
        if (!solid(L) && !solid(D) && !solid(tk(tx - 1, ty + 1))) corner(tx, ty, -1, 1, 6, D === 3 ? 3 : L, false);
        if (!solid(R) && !solid(D) && !solid(tk(tx + 1, ty + 1))) corner(tx, ty, 1, 1, 6, D === 3 ? 3 : R, false);
      } else if (k === 0) {
        // Concave corners get a small fillet of earth.
        if (L === 2 && D === 2 && tk(tx - 1, ty + 1) === 2) corner(tx, ty, -1, 1, 4, 2, true);
        if (R === 2 && D === 2 && tk(tx + 1, ty + 1) === 2) corner(tx, ty, 1, 1, 4, 2, true);
        if (L === 2 && U === 2 && tk(tx - 1, ty - 1) === 2) corner(tx, ty, -1, -1, 3, 2, true);
        if (R === 2 && U === 2 && tk(tx + 1, ty - 1) === 2) corner(tx, ty, 1, -1, 3, 2, true);
      }
    }
    // Ragged undersides and a little wobble on the walls.
    const ragged = new Float32Array(PW); for (let x = 0; x < PW; x++) ragged[x] = noise(x / 4, 0, seed + 3);
    for (const th of [.3, .55, .78]) for (let y = 1; y < PH - 1; y++) for (let x = 0, i = y * PW; x < PW; x++, i++) {
      if (m[i] === 2 && m[i + PW] === 0 && m[i - PW] === 2 && ragged[x] > th) m[i] = 0;
    }
    const m0 = m.slice(), get0 = (x, y) => x < 0 || x >= PW || y >= PH ? 2 : y < 0 ? 0 : m0[y * PW + x];
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const i = y * PW + x; if (m0[i] !== 2 || get0(x, y - 1) !== 2) continue;
      const lft = get0(x - 1, y), rgt = get0(x + 1, y);
      if ((lft === 0 && noise(y / 3, x * .37, seed + 5) > .62) || (rgt === 0 && noise(y / 3, x * .37, seed + 6) > .62)) m[i] = 0;
    }
    // Distances to open air: straight up, down, left, right, and a chamfer distance.
    const up = new Uint8Array(N), dn = new Uint8Array(N), lf = new Uint8Array(N), rt = new Uint8Array(N), D = new Uint16Array(N);
    for (let x = 0; x < PW; x++) {
      let r = 0; for (let y = 0, i = x; y < PH; y++, i += PW) { const v = m[i]; r = v === 2 ? (r < 250 ? r + 1 : 250) : v === 1 ? 250 : 0; up[i] = r; }
      r = 250; for (let y = PH - 1, i = y * PW + x; y >= 0; y--, i -= PW) { const v = m[i]; r = v === 2 ? (r < 250 ? r + 1 : 250) : v === 1 ? 250 : 0; dn[i] = r; }
    }
    for (let y = 0; y < PH; y++) {
      let r = 250; for (let x = 0, i = y * PW; x < PW; x++, i++) { const v = m[i]; r = v === 2 ? (r < 250 ? r + 1 : 250) : v === 1 ? 250 : 0; lf[i] = r; }
      r = 250; for (let x = PW - 1, i = y * PW + x; x >= 0; x--, i--) { const v = m[i]; r = v === 2 ? (r < 250 ? r + 1 : 250) : v === 1 ? 250 : 0; rt[i] = r; }
    }
    for (let i = 0; i < N; i++) D[i] = m[i] === 1 || m[i] === 2 ? 9999 : 0;
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const i = y * PW + x; if (!D[i]) continue; let v = D[i];
      const a = y > 0 ? D[i - PW] + 3 : 3; if (a < v) v = a;
      if (x > 0) { const b = D[i - 1] + 3; if (b < v) v = b; }
      if (y > 0 && x > 0) { const c = D[i - PW - 1] + 4; if (c < v) v = c; } else if (y === 0 && 4 < v) v = 4;
      if (y > 0 && x < PW - 1) { const c = D[i - PW + 1] + 4; if (c < v) v = c; }
      D[i] = v;
    }
    for (let y = PH - 1; y >= 0; y--) for (let x = PW - 1; x >= 0; x--) {
      const i = y * PW + x; if (!D[i]) continue; let v = D[i];
      if (x < PW - 1) { const b = D[i + 1] + 3; if (b < v) v = b; }
      if (y < PH - 1) { const a = D[i + PW] + 3; if (a < v) v = a; if (x < PW - 1) { const c = D[i + PW + 1] + 4; if (c < v) v = c; } if (x > 0) { const c = D[i + PW - 1] + 4; if (c < v) v = c; } }
      D[i] = v;
    }
    // Features stamped into the earth: material (1 stone, 2 root, 3 bone, 4 shell, 5 shade) and a value.
    const fm = new Uint8Array(N), fv = new Uint8Array(N);
    const stamp = (x, y, mat, v, minD = 3) => { if (x < 0 || y < 0 || x >= PW || y >= PH) return; const i = y * PW + x; if (m[i] !== 2 || D[i] < minD * 3) return; fm[i] = mat; fv[i] = Math.round(clamp01(v) * 255); };
    const surfTop = i => { const u = up[i]; if (u >= 250) return -1; const j = i - u * PW; return j < 0 ? 0 : m[j]; };
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      if (tk(tx, ty) !== 2) continue;
      const r = rng((tx * 7919 + ty * 104729 + seed * 31) >>> 0), bx = tx * 16, by = ty * 16;
      const nearTop = !solid(tk(tx, ty - 1)) || !solid(tk(tx, ty - 2));
      // Pebbles, lit from the top-left, with a shadow under them.
      const np = (r() < .45 ? 1 : 0) + (r() < .15 ? 1 : 0);
      for (let k = 0; k < np; k++) {
        const cx = bx + 2 + r() * 12, cy = by + 3 + r() * 11, rw = 1.2 + r() * 2.2, rh = rw * (.55 + r() * .3), tone = r() * .12;
        for (let y = Math.floor(cy - rh - 1); y <= cy + rh + 1; y++) for (let x = Math.floor(cx - rw - 1); x <= cx + rw + 1; x++) {
          const dx = (x + .5 - cx) / rw, dy = (y + .5 - cy) / rh, e = dx * dx + dy * dy;
          if (e <= 1) stamp(x, y, 1, (dx + dy < -.7 ? .66 : dx + dy > .55 ? .28 : .46) + tone, 4);
          else if (e <= 1.9 && dy > .3 && dx > -.5) stamp(x, y, 5, .1, 4);
        }
      }
      // Roots creeping down from the surface.
      if (nearTop && surfTop(by * PW + bx + 8) === 0) {
        const nr = r() * 2.2 | 0;
        for (let k = 0; k < nr; k++) {
          let x = bx + (r() * 16 | 0), y = by + 5 + (r() * 5 | 0); const len = 6 + r() * 20 | 0;
          for (let s = 0; s < len; s++) {
            stamp(x, y, 2, s < len * .4 ? .7 : .58, 2); if (s < len * .3) stamp(x + 1, y, 2, .45, 2);
            if (s < len * .5 && s % 2 === 0) stamp(x - 1, y, 2, .82, 2);
            y++; const q = r(); if (q < .22) x--; else if (q > .78) x++;
            if (r() < .08) { let bx2 = x, by2 = y; const d = r() < .5 ? -1 : 1; for (let t = 0; t < 3 + r() * 4; t++) { bx2 += d; if (r() < .6) by2++; stamp(bx2, by2, 2, .55, 2); } }
          }
        }
      }
      // A snail shell now and then, and old bones deeper down.
      if (r() < .07) {
        const x = bx + 3 + (r() * 9 | 0), y = by + 4 + (r() * 9 | 0);
        const sh = ['.aa.', 'abca', '.bb.']; const val = { a: .78, b: .5, c: .25 };
        sh.forEach((row, j) => [...row].forEach((c2, i2) => { if (c2 !== '.') stamp(x + i2, y + j, 4, val[c2], 4); }));
      }
      if (!nearTop && r() < .1) {
        const x = bx + 2 + (r() * 5 | 0), y = by + 4 + (r() * 8 | 0);
        const fish = r() < .5;
        const rows = fish ? ['..a.a.a...', 'aaaaaaaaab', '..c.c.c...'] : ['a.....a', 'aaaaaaa', 'c.....c'];
        const val = { a: .72, b: .5, c: .42 };
        rows.forEach((row, j) => [...row].forEach((c2, i2) => { if (c2 !== '.') stamp(x + i2, y + j, 3, val[c2], 4); }));
      }
    }
    // Shade every earth pixel.
    const out = Buf(PW, PH), d = out.d;
    const setc = (i, c) => { if (typeof c === 'string') c = rgb(c); const k = i * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255; };
    // Per-column noise, computed once: moss thickness, topsoil depth and the wobble of the strata.
    const MT = new Uint8Array(PW), TS = new Float32Array(PW), SW = [];
    for (let x = 0; x < PW; x++) { MT[x] = 3 + Math.floor(noise(x / 5, 0, seed + 11) * 3.4); TS[x] = noise(x / 7, 1, seed + 2) * 5; }
    for (let k = 0; k <= PH >> 6; k++) { const a = new Float32Array(PW); for (let x = 0; x < PW; x++) a[x] = noise(x / 23, k, seed + 3) * 9; SW.push(a); }
    const mossT = x => MT[x];
    const MATS = [null, P.stoneR, P.rootR, P.boneR, P.shellR];
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const i = y * PW + x; if (m[i] !== 2) continue;
      const dd = D[i] / 3, dk = smooth((dd - 4) / 24), con = 1 - .68 * dk;
      const u = up[i], l = lf[i], r = rt[i], b = dn[i];
      const top = surfTop(i), open = top === 0, wet = top === 3;
      const mt = grassy ? mossT(x) : 2;
      // Moss lip on open tops, draped a little down the walls near the corners.
      const faceL = l <= 2, faceR = r <= 2;
      const drape = open && u <= 14 && (faceL || faceR) ? 3 + Math.floor(hash(faceL ? x - l : x + r, (y - u) >> 4, seed + 17) * 9) - (faceL ? l : r) * 2 : 0;
      if (open && (u <= mt || u <= drape)) {
        let t = u <= mt ? .98 - (u - 1) / mt * .6 : .6 - u / drape * .35;
        if (u === mt && hash(x, y, seed) < .45) { setc(i, PEAT[1]); continue; }
        if (faceR && r === 1) t -= .3; else if (faceL && l === 1) t += .06;
        t += (hash(x, y, seed + 1) - .5) * .12;
        setc(i, pick(MOSS, t, x, y)); continue;
      }
      if (fm[i]) {
        const f = fm[i]; let t = fv[i] / 255 - .5 * dk;
        setc(i, f === 5 ? PEAT[Math.max(0, Math.round(1 - dk))] : pick(MATS[f], t, x, y)); continue;
      }
      let t;
      if (open && u <= mt + 1) t = .05;
      else if (wet && u <= 2) t = .6 - u * .08;
      else {
        const soil = .5 - .36 * dk;
        const topsoil = (open || wet) ? mt + 7 + TS[x] : 0;
        if (u <= topsoil) t = .27 + (noise(x / 3, y / 2, seed + 4) - .5) * .12 - (u < mt + 4 ? .05 : 0);
        else if (u <= topsoil + 3) t = .28 + (soil - .28) * (u - topsoil) / 3;
        else t = soil;
        // Strata that follow the surface above.
        const ly = (u < 250 ? u : y) + SW[y >> 6][x], band = Math.floor(ly / 7);
        t += (hash(band, 0, seed + 9) - .5) * .16 * con;
        if (ly - band * 7 < 1 && hash(band, 1, seed + 9) < .45) t -= .08 * con;
        if (dk < .97) t += (noise(x / 9, y / 6, seed + 1) - .5) * .22 * con + (noise(x / 3, y / 2, seed + 7) - .5) * .1 * con;
        t += (hash(x, y, seed + 2) - .5) * .035 * con;
      }
      // Rim light on the left walls, shadow on the right walls and undersides.
      if (l === 1) t += .2; else if (l === 2) t += .09; else if (l === 3 && (x + y) & 1) t += .06;
      if (r === 1) t = Math.min(t, .06); else if (r === 2) t -= .08; else if (r < 14) t -= .1 * (1 - r / 14);
      if (b === 1) t = .0; else if (b === 2) t = Math.min(t, .12); else if (b <= 4) t -= .08;
      setc(i, pick(PEAT, t, x, y));
    }
    // Things that grow out into the air: blades, flowers, fungi, hanging roots and moss.
    const glow = [];
    const air = (x, y, c, onlyWater) => { if (x < 0 || y < 0 || x >= PW || y >= PH) return false; const v = m[y * PW + x]; if (onlyWater ? v !== 3 : v !== 0) return false; const k = (y * PW + x) * 4; if (d[k + 3]) return false; setc(y * PW + x, c); return true; };
    const airAny = (x, y, c) => { if (x < 0 || y < 0 || x >= PW || y >= PH) return; const v = m[y * PW + x]; if (v === 1 || v === 2) return; setc(y * PW + x, c); };
    for (let y = 1; y < PH; y++) for (let x = 0; x < PW; x++) {
      const i = y * PW + x; if (m[i] !== 2) continue;
      const above = m[i - PW];
      if (above === 0 && grassy) {
        const dens = noise(x / 11, y / 16, seed + 4), p = .3 + dens * .66;
        if (hash(x, y, seed + 5) < p) {
          let h = 1 + Math.floor(hash(x, y, seed + 6) * (1.5 + dens * 5)); if (hash(x, y, seed + 8) < .07) h += 3;
          const lean = hash(x, y, seed + 7), lx = lean < .33 ? -1 : lean > .67 ? 1 : 0;
          for (let k = 1; k <= h; k++) air(x + (h >= 3 && k >= h - 1 ? lx : 0), y - k, pick(MOSS, .42 + .55 * k / h, x, y - k));
        }
      } else if (above === 0) {
        if (hash(x, y, seed + 5) < .35) air(x, y - 1, pick(MOSS, .5 + hash(x, y, 3) * .3, x, y));
      } else if (above === 3 && hash(x, y, seed + 12) < .22) {
        // Water weeds swaying up from drowned banks.
        const h = 2 + Math.floor(hash(x, y, seed + 13) * 7);
        for (let k = 1; k <= h; k++) air(x + ((k >> 2) & 1), y - k, pick(MOSS, .2 + .3 * k / h, x, y - k), true);
      }
      const below = y < PH - 1 ? m[i + PW] : 2;
      if (below === 0) {
        const q = hash(x, y, seed + 14);
        if (q < .075) {
          let rx = x; const len = 3 + Math.floor(hash(x, y, seed + 15) * 11);
          for (let k = 1; k <= len; k++) { airAny(rx, y + k, pick(ROOT, k % 3 === 0 ? .55 : .3, rx, y + k)); if (hash(x, k, seed + 16) < .25) rx += hash(x, k, 9) < .5 ? -1 : 1; }
        } else if (q < .075 + (grassy ? .16 : .1)) {
          const len = 1 + Math.floor(hash(x, y, seed + 18) * 4);
          for (let k = 1; k <= len; k++) airAny(x, y + k, pick(MOSS, .22 + .3 * k / len, x, y + k));
        } else if (!grassy && q < .3) {
          const len = 2 + Math.floor(hash(x, y, seed + 19) * 5);
          for (let k = 1; k <= len; k++) airAny(x, y + k, PEAT[k < len - 1 ? 3 : 5]);
        }
      }
      // Roots poking out of the walls.
      const lft = x > 0 ? m[i - 1] : 2, rgt = x < PW - 1 ? m[i + 1] : 2;
      if ((lft === 0 || rgt === 0) && hash(x, y, seed + 20) < .045 && up[i] > 6) {
        const s = lft === 0 ? -1 : 1, len = 2 + Math.floor(hash(x, y, seed + 21) * 3);
        let rx = x, ry = y;
        for (let k = 0; k < len + 2; k++) { if (k < len) rx += s; else ry++; airAny(rx, ry, pick(ROOT, s < 0 ? .6 : .32, rx, ry)); }
      }
      // Moss hanging over the lip of a ledge.
      if (grassy && (lft === 0 || rgt === 0) && up[i] <= 2 && surfTop(i) === 0 && hash(x, y, seed + 22) < .7) {
        const s = lft === 0 ? -1 : 1, len = 2 + Math.floor(hash(x, y, seed + 23) * 7);
        for (let k = 0; k < len; k++) airAny(x + s, y + k, pick(MOSS, .6 - .4 * k / len, x, y + k));
      }
    }
    // Little plants on top of each open tile.
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      if (tk(tx, ty) !== 2 || tk(tx, ty - 1) !== 0) continue;
      const r = rng((tx * 3571 + ty * 1597 + seed * 13) >>> 0);
      const n = theme === 'cave' ? (r() < .55 ? 1 + (r() * 2 | 0) : 0) : (r() < .7 ? 1 : 0) + (r() < .25 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const x = tx * 16 + 2 + (r() * 12 | 0); let y = ty * 16 - 4;
        while (y < ty * 16 + 8 && getPx(x, y) !== 2) y++;
        if (getPx(x, y) !== 2 || getPx(x, y - 1) !== 0) continue;
        const kind2 = r();
        if (theme === 'cave') {
          // Glowing fungi: a few small caps on thin pale stems.
          const caps = 1 + (r() * 3 | 0);
          for (let c = 0; c < caps; c++) {
            const cx = x + c * 2 - caps + 1, h = 1 + (r() * 3 | 0);
            for (let s = 1; s <= h; s++) airAny(cx, y - s, '#8a7c9a');
            airAny(cx - 1, y - h - 1, '#2fa89a'); airAny(cx, y - h - 1, '#8ff4e2'); airAny(cx + 1, y - h - 1, '#3cc4b0'); airAny(cx, y - h - 2, '#d8fff6');
          }
          glow.push({ x, y: y - 3 });
        } else if (kind2 < .42) {
          const h = 2 + (r() * 3 | 0), col = P.flowers[r() * P.flowers.length | 0];
          for (let s = 1; s <= h; s++) airAny(x, y - s, pick(MOSS, .35, x, y - s));
          airAny(x, y - h - 1, '#f6e27a'); airAny(x - 1, y - h - 1, col); airAny(x + 1, y - h - 1, col); airAny(x, y - h - 2, col); airAny(x, y - h, mix(col, OUT, .35));
          if (r() < .5) { airAny(x + 1, y - 2, pick(MOSS, .6, x, y)); airAny(x + 2, y - 3, pick(MOSS, .75, x, y)); }
        } else if (kind2 < .62) {
          const cap = rgb(P.cap), hi = mix(cap, '#fff0d0', .45), lo = mix(cap, OUT, .45);
          airAny(x, y - 1, '#d8ccb4'); airAny(x, y - 2, '#b8aa94');
          airAny(x - 1, y - 3, cap); airAny(x, y - 3, hi); airAny(x + 1, y - 3, cap); airAny(x - 1, y - 2, lo); airAny(x + 1, y - 2, lo);
          if (r() < .5) { airAny(x + 3, y - 1, '#d8ccb4'); airAny(x + 2, y - 2, lo); airAny(x + 3, y - 2, hi); airAny(x + 4, y - 2, lo); }
        } else if (kind2 < .85) {
          // A fern: two arching fronds.
          const fr = [[0, 1], [0, 2], [-1, 3], [-2, 3], [-3, 2], [1, 3], [2, 4], [3, 4], [4, 3], [-1, 2], [1, 2]];
          for (const [ox, oy] of fr) airAny(x + ox, y - oy, pick(MOSS, .5 + oy * .1, x + ox, y - oy));
        } else {
          airAny(x, y - 1, STONE[5]); airAny(x + 1, y - 1, STONE[4]); airAny(x + 2, y - 1, STONE[3]); airAny(x + 1, y - 2, STONE[6]); airAny(x + 2, y - 2, STONE[5]);
        }
      }
    }
    const chunks = []; for (let x0 = 0; x0 < PW; x0 += CHUNK) chunks.push(toCanvas(out, x0, Math.min(CHUNK, PW - x0)));
    return { chunks, PW, PH, glow };
  }
  const rng = ART.rng;

  // Terrain of the level being played, rebuilt only if its earth or water change.
  const terrCache = new Map();
  function sigOf(t) { return t.map(r => r.join ? r.join('') : r).join('\n').replace(/[^#~wxXMG\n]/g, '.'); }
  function levelTerrain(L) {
    const k = L.index + ':' + L.def.theme; let T = terrCache.get(k);
    if (T && T.rows !== L.t) {
      // Same level loaded again: keep the cache if the layout matches.
      const s = sigOf(L.t); if (s === T.sig) T.rows = L.t; else T = null;
    }
    if (!T) { const t0 = performance.now(); T = buildTerrain(L.t.map(r => r.slice()), L.def.theme, 1 + L.index * 17); T.sig = sigOf(L.t); T.rows = L.t; T.snap = L.t.map(r => r.map(c => c === '#' || c === '~' ? c : '.')); terrCache.set(k, T); if (window.location && /debug/.test(location.search)) console.log('TERRENO', k, Math.round(performance.now() - t0) + 'ms'); }
    return T;
  }
  function drawTerrain(g, L, camX, camY, W, H) {
    let T = levelTerrain(L);
    // Earth or water that changed in view (the flood at the end of the heron's fight) means a rebuild.
    const x0 = Math.max(0, camX >> 4), x1 = Math.min(L.w - 1, (camX + W) >> 4), y0 = Math.max(0, camY >> 4), y1 = Math.min(L.h - 1, (camY + H) >> 4);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const c = L.t[ty][tx], s = T.snap[ty][tx];
      if ((c === '#' || c === '~' ? c : '.') !== s) { terrCache.delete(L.index + ':' + L.def.theme); T.rows = null; T = levelTerrain(L); ty = y1 + 1; break; }
    }
    const k0 = Math.max(0, Math.floor(camX / CHUNK)), k1 = Math.min(T.chunks.length - 1, Math.floor((camX + W) / CHUNK));
    for (let k = k0; k <= k1; k++) g.drawImage(T.chunks[k], k * CHUNK - camX, -camY);
    return T;
  }
  // Small terrain pieces for the title and menu scenes.
  const sceneCache = {};
  function sceneTerrain(name, rows, theme) { return sceneCache[name + theme] || (sceneCache[name + theme] = buildTerrain(rows.map(r => r.split('')), theme, 5)); }


  // ---------------------------------------------------------------- Agua
  const AGUA = {
    dusk: { body: ['#0e1a26', '#122632', '#17343c', '#1d4446', '#255450', '#2f6658', '#3e7a60'], line: '#8cc8a8', foam: '#e6f6e0', glint: '#ffe2b0' },
    night: { body: ['#08111c', '#0b1828', '#0f2234', '#142c40', '#1a384a', '#214656', '#2a5662'], line: '#74aac0', foam: '#dcf2ff', glint: '#ffffff' },
    storm: { body: ['#0b1116', '#0f181e', '#142028', '#1a2a32', '#21343c', '#2a4046', '#344c52'], line: '#86a2ac', foam: '#d6e2e8', glint: '#eef4f8' },
    cave: { body: ['#0b0c1a', '#0e1224', '#12192e', '#162238', '#1b2e44', '#223a4e', '#2a4858'], line: '#62b4c0', foam: '#c4f4f0', glint: '#d8fff6' },
    nest: { body: ['#151126', '#1b1830', '#22223a', '#2b2c44', '#35384c', '#424654', '#52545a'], line: '#f0a878', foam: '#ffe8c8', glint: '#fff0c8' } };
  const SURF = 3;
  const waterCache = {};
  function water(theme) {
    if (waterCache[theme]) return waterCache[theme];
    const A = AGUA[theme] || AGUA.dusk, body = ramp(A.body, 9);
    // Opaque body, darker with depth, with specks of silt and faint light streaks near the top.
    const back = [0, 1, 2, 3].map(row => [0, 1].map(v => paint(16, 16, b => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const wy = row * 16 + y; if (wy <= SURF) continue;
        let t = .9 - (wy - SURF) / 44; if (t < .06) t = .06;
        let c = pick(body, t, x, y);
        const sp = hash(x + v * 16, wy, 41), n = body.length - 1, k = Math.round(t * n);
        if (sp < .014) c = body[Math.min(n, k + 3)];
        else if (wy < 22 && noise((x + v * 16) / 5, wy / 1.6, 42) > .74) c = body[Math.min(n, k + 1)];
        put(b, x, y, c);
      }
    })));
    // Translucent front: the moving surface line and a tint over whatever is under water.
    const tint = body[3];
    const front = []; for (let f = 0; f < 8; f++) front.push(paint(16, 16, b => {
      for (let x = 0; x < 16; x++) {
        const ph = (x / 16 + f / 8) * Math.PI * 2, w = Math.sin(ph) * .9 + Math.sin(ph * 2 - f * .8) * .45, y0 = SURF + Math.round(w);
        for (let y = y0 + 2; y < 16; y++) put(b, x, y, tint, .34);
        put(b, x, y0, w < -.6 ? A.foam : A.line); put(b, x, y0 + 1, body[7], .9);
        if (y0 + 2 <= SURF + 1) put(b, x, y0 + 2, body[6], .8);
        if (w < -1) put(b, x, y0 - 1, A.foam, .55);
      }
      const gx = (f * 2 + 3) % 16; put(b, gx, 7, A.glint, .75); put(b, (gx + 1) % 16, 7, A.glint, .45);
      const gx2 = (21 - f * 2) % 16; put(b, gx2, 11, A.line, .45); put(b, (gx2 + 1) % 16, 11, A.line, .3);
    }));
    const deepFront = paint(16, 16, b => rect(b, 0, 0, 16, 16, tint, .34));
    // Foam where the water laps against a bank (for a bank on the left; flipped for the right).
    const foam = []; for (let f = 0; f < 4; f++) foam.push(paint(8, 9, b => {
      const r = rng(7 + f * 13);
      for (let k = 0; k < 9; k++) { const x = (r() * r() * 7) | 0, y = SURF - 1 + ((r() * 3) | 0); put(b, x, y, k < 5 ? A.foam : A.line, k < 5 ? 1 : .8); }
      put(b, 0, SURF, A.foam); put(b, 1, SURF, A.foam); put(b, 0, SURF + 1, A.foam, .8); put(b, 0, SURF + 2, A.line, .6);
      put(b, 2 + (f % 3), SURF + 3 + (f & 1), A.foam, .5); put(b, 1 + (f % 2), SURF + 5, A.line, .4);
    }));
    return waterCache[theme] = { back, front, deepFront, foam, A, body, tint };
  }

  // ---------------------------------------------------------------- Piezas del decorado
  const WOOD = ramp(['#1c1218', '#35222a', '#533428', '#744a32', '#96643e', '#b8824e', '#dcac6c'], 7);
  const MUD = ramp(['#1c1820', '#2c2830', '#3e383e', '#544b4e', '#6c6060', '#877a74', '#a6968a'], 7);
  const IRON = ramp(['#16141c', '#2a2832', '#403e4a', '#5a5864', '#787682', '#a09ea8'], 6);
  const RUST = ['#5a2a20', '#8a4428', '#b86a38'];
  const VINE = ramp(['#1e1020', '#3a1c2c', '#5c2c38', '#84464a'], 4);
  const CAP = ramp(['#2a1020', '#5a1a2c', '#8a2834', '#b83c3c', '#dc5c44', '#f08c5c', '#fcc088'], 7);
  const WISP = ramp(['#123a4a', '#17666c', '#22a092', '#5ed8b8', '#b4f8dc', '#f0fff6'], 6);
  const tileCache = {};
  function tiles(theme) {
    if (tileCache[theme]) return tileCache[theme];
    const P = TERRA[theme] || TERRA.dusk, MOSS = P.mossR;
    // Planks of the boardwalk: a lit top, grain, seams with nails, moss here and there.
    const plank = (v, endL, endR) => paint(16, 9, b => {
      for (let x = 0; x < 16; x++) for (let y = 0; y < 6; y++) {
        if ((endL && x === 0 || endR && x === 15) && (y === 0 || y === 5)) continue;
        let c;
        if (y === 5 || endL && x === 0 || endR && x === 15) c = OUT;
        else if (y === 0) c = WOOD[hash(x, v, 3) < .18 ? 5 : 6];
        else if (y === 4) c = WOOD[2];
        else { const gr = noise(x / 4 + v * 5, y * 1.9, 5); c = WOOD[gr > .64 ? 3 : gr < .3 ? 5 : 4]; }
        put(b, x, y, c);
      }
      const seam = v ? 9 : 4; if (!(endL && seam < 2)) { for (let y = 1; y < 5; y++) put(b, seam, y, WOOD[1]); put(b, seam - 1, 1, WOOD[6]); put(b, seam + 1, 2, IRON[5]); put(b, seam - 2, 2, IRON[4]); }
      const r = rng(55 + v * 9 + (endL ? 3 : 0) + (endR ? 7 : 0));
      for (let k = 0; k < 3; k++) { const x = r() * 16 | 0; if (r() < .6) { put(b, x, 0, pick(MOSS, .8, x, 0)); put(b, x + 1, 0, pick(MOSS, .6, x, 1)); } }
      if (v === 1 || endR) { const x = 3 + (r() * 10 | 0), len = 1 + (r() * 3 | 0); for (let k = 0; k < len; k++) put(b, x, 6 + k, pick(MOSS, .5 - k * .12, x, k)); put(b, x + 1, 6, pick(MOSS, .3, x, 1)); }
      if (endL) { put(b, 1, 1, WOOD[6]); put(b, 1, 2, WOOD[5]); }
    });
    const planks = { mid: [plank(0), plank(1)], left: plank(0, true, false), right: plank(1, false, true), one: plank(0, true, true) };
    // A post driven into the water under the boardwalk.
    const post = paint(5, 30, b => {
      for (let y = 0; y < 30; y++) { put(b, 0, y, OUT); put(b, 1, y, WOOD[5]); put(b, 2, y, WOOD[4]); put(b, 3, y, WOOD[2]); put(b, 4, y, OUT); if (hash(0, y, 9) < .2) put(b, 2, y, WOOD[3]); }
      for (const y of [2, 3]) { put(b, 1, y, '#c8b48a'); put(b, 2, y, '#a8946a'); put(b, 3, y, '#6a5a44'); }
      for (let y = 12; y < 30; y++) if (hash(1, y, 4) < .5) put(b, 1 + (y & 1), y, pick(MOSS, .35, 1, y));
    });
    // Brambles: looping briar canes studded with pale thorns, a few red berries and leaves.
    const thorn = v => { const b = Buf(16, 8);
      for (let x = 0; x < 16; x++) for (let y = 6; y < 8; y++) put(b, x, y, hash(x, y, v + 20) < .45 ? VINE[0] : VINE[1]);
      const arcs = v ? [[2, 4.5, 5.5], [9, 5, 6.5], [14.5, 3.5, 4.5]] : [[4, 5, 6.5], [11, 4.5, 5.5], [-1, 3.5, 4]];
      const tips = [];
      for (const [cx, rx, ry] of arcs) for (let a = 0; a <= Math.PI; a += .06) {
        const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(7 - Math.sin(a) * ry);
        put(b, x, y, a > .6 && a < 2.5 ? VINE[3] : VINE[2]); put(b, x, y + 1, VINE[1]);
      }
      for (const [cx, rx, ry] of arcs) for (let a = .35; a < Math.PI; a += .55) {
        const nx = Math.cos(a), ny = -Math.sin(a), x = cx + nx * rx, y = 7 + ny * ry;
        tips.push([Math.round(x + nx * 1.4), Math.round(y + ny * 1.4)]);
        put(b, Math.round(x + nx * 1.2), Math.round(y + ny * 1.2), '#c8b494');
      }
      for (const [x, y] of tips) put(b, x, y, '#f6ecd8');
      const r = rng(71 + v);
      for (let k = 0; k < 2; k++) { const x = 3 + (r() * 10 | 0), y = 4 + (r() * 2 | 0); put(b, x, y, '#ff8a9a'); put(b, x + 1, y, '#c8304a'); put(b, x, y + 1, '#a8203c'); put(b, x + 1, y + 1, '#6a1028'); }
      const lx = 6 + v * 3; put(b, lx, 5, '#4e7a34'); put(b, lx + 1, 5, '#6a9a3c'); put(b, lx + 1, 4, '#8fb448');
      outline(b, OUT); return toCanvas(b); };
    const thorns = [thorn(0), thorn(1)];
    // Cracked mudstone blocks laid in a running bond, with cracks that say "this breaks".
    const cracked = v => paint(16, 16, b => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const row = y < 8 ? 0 : 1, jx = row === 0 ? (v & 1 ? 5 : 0) : (v & 1 ? 13 : 8), ly = y - row * 8, lx = (x - jx + 16) % 16;
        let c;
        if (ly === 7 || lx === 15) c = MUD[0];
        else if (ly === 0 || lx === 0) c = MUD[5];
        else if (ly === 6 || lx === 14) c = MUD[2];
        else c = pick(MUD, .5 + (noise(x / 3 + v * 7, y / 3, 13) - .5) * .35, x, y);
        put(b, x, y, c);
      }
      const r = rng(101 + v * 17);
      for (let k = 0; k < 2; k++) {
        let x = 3 + (r() * 10 | 0), y = 1 + (r() * 5 | 0) + k * 8; const dx = r() < .5 ? -1 : 1;
        for (let s = 0; s < 7 + (r() * 5 | 0); s++) { put(b, x, y, MUD[0]); put(b, x + 1, y, MUD[6]); y++; if (r() < .55) x += dx; if (r() < .2) { put(b, x - dx, y, MUD[1]); } if (y > 15) break; }
      }
      for (let k = 0; k < 4; k++) { const x = r() * 16 | 0, y = r() * 16 | 0; put(b, x, y, MUD[1]); }
    });
    // Reinforced stone: big blocks strapped with iron, rivets and rust.
    const hard = v => paint(16, 16, b => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let c;
        if (y === 15 || x === 15) c = STONE[0]; else if (y === 0 || x === 0) c = STONE[5]; else if (y === 14 || x === 14) c = STONE[2];
        else c = pick(STONE, .42 + (noise(x / 4 + v * 5, y / 4, 17) - .5) * .3, x, y);
        put(b, x, y, c);
      }
      for (const by of [3, 11]) {
        for (let x = 0; x < 16; x++) { put(b, x, by - 1, STONE[0]); put(b, x, by, IRON[4]); put(b, x, by + 1, IRON[2]); put(b, x, by + 2, IRON[1]); }
        for (const rx of [2, 7, 12]) { put(b, rx, by, IRON[5]); put(b, rx + 1, by + 1, IRON[0]); }
        const r = rng(by * 7 + v * 3); for (let k = 0; k < 2; k++) { const x = 1 + (r() * 14 | 0), len = 1 + (r() * 3 | 0); for (let s = 0; s < len; s++) put(b, x, by + 3 + s, RUST[s === 0 ? 1 : 0]); put(b, x, by + 2, RUST[2]); }
      }
    });
    // Root walls: three twisted roots and a crossing root every tile to hold on to.
    const roots = (v, top, bottom) => paint(16, 16, b => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(b, x, y, hash(x, y + v * 16, 30) < .06 ? pick(MOSS, .2, x, y) : ROOT[hash(x, y, 31) < .5 ? 0 : 1]);
      for (let k = 0; k < 3; k++) {
        const w = k === 1 ? 5 : 4;
        for (let y = 0; y < 16; y++) {
          const cx = 2.6 + k * 5.2 + Math.sin(((y + v * 8) / 16 + k * .37) * Math.PI * 2) * 1.5, x0 = Math.round(cx - w / 2);
          if (top && y < 2 && k !== 1) continue;
          for (let i = 0; i < w; i++) {
            const rel = i / (w - 1); let t = rel < .25 ? .95 : rel < .55 ? .75 : rel < .85 ? .55 : .3;
            if (noise(x0 + i, (y + v * 16) / 2.5, 32 + k) > .72) t -= .2;
            const narrow = bottom && y > 11 ? (y - 11) : 0; if (i < narrow / 2 || i >= w - narrow / 2) continue;
            put(b, x0 + i, y, pick(ROOT, t, x0 + i, y));
          }
          put(b, x0 - 1, y, OUT); put(b, x0 + w, y, ROOT[0]);
        }
      }
      const ry = 7 + (v & 1) * 2;
      for (let x = 0; x < 16; x++) { const yy = ry + Math.round(Math.sin(x / 16 * Math.PI * 2) * .8); put(b, x, yy - 1, OUT); put(b, x, yy, ROOT[6]); put(b, x, yy + 1, ROOT[4]); put(b, x, yy + 2, ROOT[1]); }
      for (let k = 0; k < 3; k++) { const x = hash(k, v, 33) * 16 | 0, y = hash(k, v, 34) * 16 | 0; put(b, x, y, pick(MOSS, .55, x, y)); put(b, x, y + 1, pick(MOSS, .35, x, y)); }
    });
    const rootWall = { mid: [roots(0), roots(1)], top: roots(0, true), bottom: roots(1, false, true) };
    // A moss lip with blades for the tops of stone, root and gate tiles (drawn 4px above the tile).
    const cap = v => paint(16, 9, b => {
      const mt = 3;
      for (let x = 0; x < 16; x++) {
        const d = mt + (hash(x, v, 40) < .35 ? 1 : 0);
        for (let y = 0; y < d; y++) put(b, x, 4 + y, pick(MOSS, .95 - y / d * .6, x, y));
        if (hash(x, v, 41) < .5) { const h = 1 + (hash(x, v, 42) * 4 | 0); for (let k = 1; k <= h; k++) put(b, x, 4 - k, pick(MOSS, .45 + .5 * k / h, x, k)); }
        if (hash(x, v, 43) < .2) put(b, x, 4 + d, pick(MOSS, .3, x, 0));
      }
    });
    const caps = [cap(0), cap(1), cap(2)];
    // Gate: three poles and iron bands; the top tile has a beam, the bottom one stakes.
    const gate = (top, bottom) => paint(16, 16, b => {
      for (const x0 of [1, 6, 11]) for (let y = 0; y < 16; y++) {
        const pt = bottom && y > 12 ? y - 12 : 0;
        for (let i = 0; i < 4; i++) {
          if (pt && (i < pt - 1 || i > 4 - pt) && !(pt === 3 && (i === 1 || i === 2))) continue;
          if (pt === 3 && i !== 1 && i !== 2) continue;
          let c = WOOD[[5, 4, 3, 2][i]]; if (noise(x0 * 3 + i, y / 3, 50) > .7) c = WOOD[[4, 3, 2, 1][i]];
          put(b, x0 + i, y, c);
        }
        if (!pt) { put(b, x0 - 1, y, OUT); put(b, x0 + 4, y, OUT); }
      }
      for (const by of [3, 11]) { for (let x = 0; x < 16; x++) { put(b, x, by - 1, OUT); put(b, x, by, IRON[4]); put(b, x, by + 1, IRON[2]); put(b, x, by + 2, OUT); } for (const rx of [2, 7, 12]) put(b, rx, by, IRON[5]); }
      if (top) for (let x = 0; x < 16; x++) { put(b, x, 0, WOOD[6]); put(b, x, 1, WOOD[4]); put(b, x, 2, WOOD[2]); put(b, x, 3, OUT); }
    });
    const gates = { mid: gate(), top: gate(true), bottom: gate(false, true), one: gate(true, true) };
    // Target: a painted drum on a stake.
    const target = on => paint(16, 16, b => {
      for (let y = 12; y < 16; y++) { put(b, 6, y, OUT); put(b, 7, y, WOOD[5]); put(b, 8, y, WOOD[3]); put(b, 9, y, OUT); }
      const ring = on ? ['#e8f8d0', '#5ab04a', '#e8f8d0', '#b8ff9a'] : ['#eadcc0', '#c83a32', '#eadcc0', '#e8584a'];
      for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) {
        const dx = x - 7.5, dy = y - 6.5, d = Math.hypot(dx, dy); if (d > 7.2) continue;
        let c = d > 6.3 ? OUT : d > 5.1 ? WOOD[dx + dy < -3 ? 6 : dx + dy > 3 ? 2 : 4] : d > 3.9 ? ring[0] : d > 2.7 ? ring[1] : d > 1.5 ? ring[2] : ring[3];
        if (d <= 5.1 && dx + dy > 3.2 && d > 1.5) c = mix(c, '#3a2030', .3);
        put(b, x, y, c);
      }
      put(b, 5, 3, '#ffffff');
    });
    const targets = { off: target(false), on: target(true) };
    // Bouncy toadstool.
    const toad = squash => paint(16, squash ? 6 : 10, b => {
      const capH = squash ? 3 : 6, h = squash ? 6 : 10;
      for (let y = 0; y < capH; y++) {
        const f = (capH - y - .3) / capH, hw = Math.round(Math.sqrt(Math.max(0, 1 - f * f)) * 6.6 + .4);
        for (let x = 8 - hw; x < 8 + hw; x++) {
          const lx = (x - 8 + .5) / 7, t = .72 - lx * .3 - (y / capH) * .25 + (y === 0 ? .12 : 0);
          put(b, x, y, pick(CAP, t, x, y));
        }
      }
      for (const [sx, sy] of squash ? [[4, 1], [9, 0], [11, 1]] : [[4, 2], [8, 1], [11, 3], [6, 4], [2, 4]]) if (alphaAt(b, sx, sy)) { put(b, sx, sy, '#f6ead0'); if (alphaAt(b, sx + 1, sy)) put(b, sx + 1, sy, '#d8c4a8'); }
      for (let x = 2; x < 14; x++) put(b, x, capH, x % 2 ? '#c89c80' : '#e8c8a8');
      for (let y = capH + 1; y < h; y++) for (let x = 5; x < 11; x++) put(b, x, y, x === 5 ? '#fff4dc' : x < 8 ? '#e8dcc0' : x < 10 ? '#c8b89c' : '#9a8a78');
      outline(b, OUT);
    });
    const mushroom = toad(false), mushroomSquash = toad(true);
    // Will-o'-wisp fire: pale ghost flames licking up from a charred, mossy stump.
    const fire = [0, 1, 2, 3].map(f => paint(16, 16, b => {
      for (let y = 12; y < 16; y++) { const hw = [5, 6, 7, 7][y - 12]; for (let x = 8 - hw; x < 8 + hw; x++) put(b, x, y, y === 12 ? '#3a2c34' : hash(x, y, f) < .14 ? WISP[2] : hash(x, y, 60) < .5 ? '#241c26' : '#2e2430'); }
      const TONGUES = [[[4, 7, 3], [8, 12, 3.6], [12, 8, 2.8]], [[4, 9, 3], [8, 10, 3.4], [11.5, 6, 2.6]], [[4.5, 6, 2.8], [8, 12, 3.8], [12, 9, 3]], [[3.5, 8, 3], [8.5, 11, 3.4], [12, 7, 2.6]]][f];
      for (let y = 0; y < 13; y++) for (let x = 0; x < 16; x++) {
        let inten = 0;
        for (const [tx, th, tw] of TONGUES) {
          const top = 12 - th, u = (y - top) / th; if (u < 0) continue;
          const sway = Math.sin(u * 3 + f * 1.57 + tx) * (1 - u) * 1.2, w = tw * Math.pow(Math.sin(Math.min(1, u * 1.15) * Math.PI / 2), .8) + .3;
          const v = 1 - Math.abs(x - tx - sway) / w; if (v > 0) inten = Math.max(inten, v * (.55 + u * .6));
        }
        if (inten <= .05) continue;
        put(b, x, y, WISP[inten > .72 ? 5 : inten > .52 ? 4 : inten > .32 ? 3 : inten > .16 ? 2 : 1]);
      }
      const ox = [3, 12, 5, 11][f], oy = [2, 1, 0, 3][f]; put(b, ox, oy, WISP[4]); put(b, 15 - ox, (oy + 3) % 5, WISP[3]);
    }));
    // Lily pads, with a water lily on some.
    const LILY = { o: '#15261e', L: '#b8d468', G: '#6a9a3c', g: '#4a7a34', d: '#2e5030', v: '#8ab850' };
    const lilies = [sprite([
      '...ooooo.ooo....',
      '.ooLLGGGoGGGoo..',
      'oLLGvGGGGGGvGGo.',
      'oGGGGvGGGGvGGggo',
      '.oggggvggvgggdo.',
      '..oooooooooooo..'], LILY, 'lily-a'), sprite([
      '....ooo.ooooo...',
      '..ooLLoGGGGGGoo.',
      '.oLLGGGvGGGvGGGo',
      'oGGvGGGGGGGGvGgo',
      '.oggggvgggvgggdo',
      '..oooooooooooo..'], LILY, 'lily-b')];
    const lotus = sprite(['...w...', '.wWpWw.', 'wpWYWpw', '.opppo.', '..ooo..'], { w: '#fff4f6', W: '#ffffff', p: '#e8a0b8', Y: '#ffd860', o: '#8a4a6a' }, 'lotus');
    // Decorations: a grass clump, cattails, a cluster of little mushrooms.
    const tuft = paint(11, 8, b => {
      for (let k = 0; k < 9; k++) { const bx = 1 + k, h = 2 + Math.round(Math.sin(k * 1.3) * 1.5 + 2.5); const lean = k < 3 ? -1 : k > 6 ? 1 : 0; for (let s = 0; s < h; s++) put(b, bx + (s > h - 3 ? lean : 0), 7 - s, pick(MOSS, .35 + .6 * s / h, bx, s)); }
      if (theme !== 'cave') { const fc = P.flowers[0]; put(b, 3, 1, fc); put(b, 8, 2, P.flowers[P.flowers.length > 1 ? 1 : 0]); put(b, 3, 2, pick(MOSS, .4, 3, 2)); }
    });
    const reed = paint(11, 16, b => {
      const stems = [[3, 1, -1], [6, 0, 0], [8, 4, 1]];
      for (const [sx, top, lean] of stems) {
        for (let y = top + 6; y < 16; y++) put(b, sx + (y < top + 9 ? lean : 0), y, pick(MOSS, .3 + (y & 1) * .1, sx, y));
        for (let y = top + 1; y < top + 6; y++) { put(b, sx - 1, y, WOOD[3]); put(b, sx, y, WOOD[y < top + 3 ? 4 : 3]); put(b, sx - 1, y, y === top + 1 ? WOOD[5] : WOOD[3]); }
        put(b, sx, top, pick(MOSS, .4, sx, 0));
      }
      for (let y = 8; y < 16; y++) { put(b, 1 + ((16 - y) >> 2), y, pick(MOSS, .6, 0, y)); put(b, 10 - ((16 - y) >> 2), y, pick(MOSS, .45, 1, y)); }
    });
    const shroom = paint(9, 7, b => {
      const glowy = theme === 'cave';
      const caps = glowy ? ['#2fa89a', '#8ff4e2', '#d8fff6'] : [css(mix(P.cap, OUT, .4)), P.cap, css(mix(P.cap, '#fff0d0', .5))];
      for (const [cx, h, w] of [[2, 3, 3], [5, 5, 4], [7, 2, 2]]) {
        for (let y = 7 - h; y < 7; y++) put(b, cx, y, glowy ? '#8a7c9a' : '#dccfb8');
        const y0 = 7 - h - 1; for (let i = -((w - 1) >> 1); i <= (w >> 1); i++) put(b, cx + i, y0, i < 0 ? caps[2] : i === 0 ? caps[1] : caps[0]);
        if (w > 2) { put(b, cx, y0 - 1, caps[2]); put(b, cx + 1, y0 - 1, caps[1]); }
      }
    });
    return tileCache[theme] = { planks, post, thorns, cracked: [cracked(0), cracked(1)], hard: [hard(0), hard(1)], rootWall, caps, gates, targets, mushroom, mushroomSquash, fire, lilies, lotus, tuft, reed, shroom };
  }

  // Draws the non-earth tiles of one layer ('back' or 'front').
  function drawTiles(g, L, camX, camY, layer, W, H, t) {
    const x0 = Math.max(0, camX >> 4), x1 = Math.min(L.w - 1, (camX + W) >> 4), y0 = Math.max(0, camY >> 4), y1 = Math.min(L.h - 1, (camY + H) >> 4);
    const th = L.def.theme, S = tiles(th), A = water(th), at = (x, y) => x < 0 || x >= L.w ? '#' : y < 0 ? '.' : y >= L.h ? '#' : L.t[y][x];
    const wet = c => c === '~' || c === 'w', solidC = c => c === '#' || c === 'x' || c === 'X' || c === 'M' || c === 'G';
    const wf = (t >> 3) % 8;
    if (layer === 'back') {
      const T = drawTerrain(g, L, camX, camY, W, H);
      const posts = [];
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const ch = L.t[ty][tx]; if (ch === '.' || ch === '#') continue; const px = tx * 16 - camX, py = ty * 16 - camY, h = hash(tx, ty, 3);
        switch (ch) {
          case '=': { const l = at(tx - 1, ty) === '=', r = at(tx + 1, ty) === '='; g.drawImage(!l && !r ? S.planks.one : !l ? S.planks.left : !r ? S.planks.right : S.planks.mid[tx & 1], px, py);
            const dn = at(tx, ty + 1); if (dn === '~' && (!l || !r || tx % 3 === 0)) posts.push([px + (!l ? 2 : !r ? 9 : 5), py + 4]); break; }
          case 'w': {
            const top = !wet(at(tx, ty - 1)); g.drawImage(A.back[top ? 0 : 1][tx & 1], px, py);
            const bob = Math.round(Math.sin((t + tx * 9) / 20)) + (L.lily.has(tx + ',' + ty) ? 2 : 0);
            g.drawImage(S.lilies[tx & 1], px, py + bob); if (h < .4) g.drawImage(S.lotus, px + 4 + (tx & 1) * 3, py - 4 + bob); break; }
          case 'F': g.drawImage(S.fire[((t >> 3) + tx) % 4], px, py); break;
          case '^': g.drawImage(S.thorns[tx & 1], px, py + 8); break;
          case 'x': g.drawImage(S.cracked[(tx + ty) & 1], px, py); if (!solidC(at(tx, ty - 1))) g.drawImage(S.caps[tx % 3], px, py - 4); break;
          case 'X': g.drawImage(S.hard[ty & 1], px, py); if (!solidC(at(tx, ty - 1))) g.drawImage(S.caps[(tx + 1) % 3], px, py - 4); break;
          case 'M': { const u = at(tx, ty - 1) === 'M', d = at(tx, ty + 1) === 'M'; g.drawImage(!u ? S.rootWall.top : !d && !solidC(at(tx, ty + 1)) ? S.rootWall.bottom : S.rootWall.mid[ty & 1], px, py); if (!solidC(at(tx, ty - 1))) g.drawImage(S.caps[tx % 3], px, py - 4); break; }
          case 'G': { const u = at(tx, ty - 1) === 'G', d = at(tx, ty + 1) === 'G'; g.drawImage(!u && !d ? S.gates.one : !u ? S.gates.top : !d ? S.gates.bottom : S.gates.mid, px, py); break; }
          case 'T': g.drawImage(L.hitTargets.has(tx + ',' + ty) ? S.targets.on : S.targets.off, px, py); break;
          case '%': { if (L.mush.get(tx + ',' + ty)) g.drawImage(S.mushroomSquash, px, py + 10); else g.drawImage(S.mushroom, px, py + 6); break; }
          case ',': g.drawImage(S.tuft, px + 2 + (h * 4 | 0), py + 9); break;
          case "'": g.drawImage(S.reed, px + 2 + (h * 3 | 0), py + 1); break;
          case '"': g.drawImage(S.shroom, px + 3 + (h * 4 | 0), py + 10); break;
          case '~': { const u = at(tx, ty - 1); let row = 0; if (wet(u)) { row = 1; if (wet(at(tx, ty - 2))) row = wet(at(tx, ty - 3)) ? 3 : 2; } g.drawImage(A.back[row][(tx + ty) & 1], px, py); break; }
        }
      }
      for (const [x, y] of posts) g.drawImage(S.post, x, y);
      return T;
    }
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const ch = L.t[ty][tx]; if (ch !== '~') continue; const px = tx * 16 - camX, py = ty * 16 - camY;
      if (wet(at(tx, ty - 1))) { g.drawImage(A.deepFront, px, py); continue; }
      g.drawImage(A.front[(wf + tx) % 8], px, py);
      const fr = ((t >> 3) + tx) % 4;
      if (solidC(at(tx - 1, ty))) g.drawImage(A.foam[fr], px, py);
      if (solidC(at(tx + 1, ty))) g.drawImage(ART.flip(A.foam[(fr + 2) % 4]), px + 8, py);
    }
  }

  // ---------------------------------------------------------------- Objetos
  const WP = { o: OUT, d: css(WOOD[1]), m: css(WOOD[2]), w: css(WOOD[3]), W: css(WOOD[4]), L: css(WOOD[5]), H: css(WOOD[6]), i: css(IRON[2]), I: css(IRON[4]), n: css(IRON[5]), g: '#4e7a34', G: '#8fb448' };
  const props = {
    crate: sprite([
      '.oooooooooooo.',
      'oIHHGgHHHHHHIo',
      'oHLLLLLLLLLLwo',
      'oLmmmmmmmmmmmo',
      'oLWWWWWWWLLWmo',
      'oLWwwwwwLLmWmo',
      'oLWwwwwLLmwWmo',
      'oLWwwwLLmwwWmo',
      'oLWwwLLmwwwWmo',
      'oLWwLLmwwwwWmo',
      'oLmmmmmmmmmmmo',
      'oLWWWWWWWWWWmo',
      'oImmmmmmmmmmIo',
      '.oooooooooooo.'], WP, 'crate'),
    rock: sprite([
      '....oGgGo...',
      '..ooHGLLSoo.',
      '.oHHLLLSSSso',
      'oHLLLSSSSSso',
      'oLLSSSSSSsso',
      'oLSSSSSSssdo',
      'oSSSSsSsssdo',
      '.osssssssddo',
      '..oodddddoo.',
      '....ooooo...'], { o: OUT, H: css(STONE[6]), L: css(STONE[5]), S: css(STONE[4]), s: css(STONE[3]), d: css(STONE[2]), G: '#8fb448', g: '#4e7a34' }, 'rock'),
    heart: sprite(['.oo...oo.', 'oRRo.oRRo', 'oRWRoRRro', 'oRRRRRRro', '.oRRRRro.', '..oRRro..', '...oro...', '....o....'], { o: '#3a1428', R: '#e8445a', W: '#ffd8de', r: '#a82848' }, 'heart'),
    sign: sprite([
      '.oooooooooooo.',
      'oHGgHHHHHGHHwo',
      'oHLLLLLLLLLLmo',
      'oHLddddddLLLmo',
      'oHLLLLLLLLLLmo',
      'oHLdddLddddLmo',
      'oHWWWWWWWWWWmo',
      'ommmmmmmmmmmmo',
      '.oooooooooooo.',
      '.....oLmo.....',
      '.....oLmo.....',
      '....ooWmoo....'], WP, 'sign'),
    raft: sprite([
      '.oooooooooooooooooooooo.',
      'oHLHHLHHHLHHLHHHLHHLHHWo',
      'oLWnLWWLWWLnWLWWLWnLWWmo',
      'oWmiWmmWmmWimWmmWmiWmmdo',
      'odddddddddddddddddddddd.',
      '.oooooooooooooooooooooo.',
      '..oddo..........oddo....',
      '..oooo..........oooo....'], WP, 'raft'),
    boat: sprite([
      '.............oo.................',
      '............oYYo................',
      '............oyyo................',
      '.............oo.................',
      '.............ow.................',
      'oo...........ow...............oo',
      'oLHooooooooooooooooooooooooooHLo',
      '.oLHHHHHHHHHHHHHHHHHHHHHHHHHHLo.',
      '..oWLLLLLLLLLLLLLLLLLLLLLLLLWo..',
      '...omWWWWWWWWWWWWWWWWWWWWWWmo...',
      '....oommmmmmmmmmmmmmmmmmmmoo....',
      '......oooooooooooooooooooo......'], Object.assign({ Y: '#fff2b8', y: '#ffc84a' }, WP), 'boat'),
    plate: { off: sprite(['..oooooooooooo..', '.oHLLLLLLLLLLSo.', '.oLSSrrrrrrSSso.', 'oossssssssssssoo', 'oooooooooooooooo'], { o: OUT, H: css(STONE[6]), L: css(STONE[5]), S: css(STONE[4]), s: css(STONE[2]), r: '#c8583e' }, 'plate'),
      on: sprite(['................', '................', '..oooooooooooo..', 'ooLLGGGGGGGGLLoo', 'oooooooooooooooo'], { o: OUT, L: css(STONE[5]), G: '#8ff0a0' }, 'plate-on') } };
  const lanternRows = [
    '....oo....',
    '...oIIo...',
    '..oIIIio..',
    '.oIIiiiio.',
    '.oooooooo.',
    '.oGgLLgGo.',
    '.oGLWWLGo.',
    '.oGLWWLgo.',
    '.oGgLLggo.',
    '.oooooooo.',
    '..oIiiio..',
    '...oHmo...',
    '...oHmo...',
    '...owmo...',
    '...oHmo...',
    '...oHmo...',
    '..oowmoo..',
    '.oooooooo.'];
  props.lantern = { off: sprite(lanternRows, Object.assign({}, WP, { G: '#26303c', g: '#1e2632', L: '#34404e', W: '#44505e' }), 'lantern'),
    on: sprite(lanternRows, Object.assign({}, WP, { G: '#f0a038', g: '#c87428', L: '#ffd868', W: '#fff8d8' }), 'lantern-on') };

  // ---------------------------------------------------------------- Fondos
  // Sky gradients run top to horizon; hills, far trees, bald cypresses and reeds get
  // closer to the sky colour the farther away they are.
  const BG = {
    dusk: { sky: ['#17183a', '#232450', '#352c5c', '#523866', '#78456a', '#a25666', '#c86c5c', '#e2905c', '#f0b66a', '#f6d284'],
      moon: { x: 244, y: 32, r: 11, dark: '#caa87a', base: '#f2e0b0', light: '#fffae6', halo: '#fbe0a8' }, stars: 1,
      cloud: { top: '#40325e', mid: '#6a4468', lit: '#ec9e7a', below: true },
      hills: ['#9a5a70', '#7a4c6c'], far: '#553a64', farRim: '#9a6072', mist: '#c88480', water: '#f0b070',
      mid: '#2e2444', midRim: '#6e4a6e', moss: '#5c5474', reeds: '#1b1629', reedRim: '#4e3652', head: '#3e2228' },
    night: { sky: ['#060914', '#0a1022', '#0e1830', '#12213c', '#172c48', '#1c3852', '#22465c', '#2a5664'],
      moon: { x: 250, y: 34, r: 12, dark: '#9ab0c0', base: '#e2eef4', light: '#ffffff', halo: '#a8d0e8' }, stars: 1.6, milky: 1,
      cloud: { top: '#20304a', mid: '#18243a', lit: '#6a8aa8', below: false },
      hills: ['#1e3448', '#18293e'], far: '#142438', farRim: '#34566e', mist: '#2e5266', water: '#7ab0c8',
      mid: '#0d1727', midRim: '#35587a', moss: '#2a4256', reeds: '#09101a', reedRim: '#224058', head: '#1e1814' },
    storm: { sky: ['#0b0d13', '#10131b', '#161a24', '#1c222e', '#232b37', '#2b3440', '#343f4a', '#3e4a54'],
      stars: 0, cloud: null,
      hills: ['#26303c', '#1e2632'], far: '#1a212c', farRim: '#34404e', mist: '#3e4a58', water: '#6a7a88',
      mid: '#10161e', midRim: '#2e3a48', moss: '#28343e', reeds: '#0a0e14', reedRim: '#22303a', head: '#1e1a16' },
    cave: { sky: ['#0a0810', '#0e0b16', '#130f1d', '#181224', '#1d162b', '#221a31', '#281e37'], stars: 0, cave: 1,
      rock: ['#140f1b', '#1c1526', '#261c31', '#30243c', '#3c2e48', '#4c3c5a', '#5e4c6c'], mist: '#3a2e52', glow: ['#2fa89a', '#8ff4e2', '#e0fff8'], worm: '#8ad0ff',
      mid: '#161020', midRim: '#4a3a60', reeds: '#120d19', reedRim: '#4a3a60' },
    nest: { sky: ['#24122e', '#3a1a3c', '#5a2446', '#7e2e4a', '#a43c4a', '#c8524a', '#e0704c', '#ee9452', '#f6b862', '#fad68a'],
      moon: { x: 74, y: 96, r: 16, dark: '#f8b060', base: '#ffd88a', light: '#fff4d0', halo: '#ffc070', sun: 1 }, stars: .25,
      cloud: { top: '#5a2442', mid: '#8a3448', lit: '#f8b070', below: true },
      hills: ['#b25a5a', '#8e4452'], far: '#6c3048', farRim: '#d8805c', mist: '#e8966c', water: '#f8c080',
      mid: '#3a1a30', midRim: '#c06050', moss: '#6a3a44', reeds: '#1f0e19', reedRim: '#7a3432', head: '#2a1414', snag: '#2a1226', snagRim: '#e88a60' } };

  function skyLayer(p) {
    const b = Buf(320, 180), R = ramp(p.sky, 28), M = p.moon;
    for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) put(b, x, y, pick(R, Math.min(1, y / 150), x, y));
    const twinkle = [];
    if (p.milky) for (let y = 0; y < 130; y++) for (let x = 0; x < 320; x++) {
      const d = Math.abs((x - 40) * .42 - y + 10) / 26; if (d > 1) continue;
      const n = noise(x / 14, y / 10, 5) * (1 - d);
      if (n > .38 && dith(x, y) < (n - .38) * 2.4) put(b, x, y, '#6a7aa8', .22);
      if (hash(x, y, 6) < .03 * (1 - d)) put(b, x, y, '#9ab0d8', .7);
    }
    if (p.stars) {
      const r = rng(77);
      for (let i = 0; i < 90 * p.stars; i++) {
        const x = r() * 320 | 0, y = (r() * r()) * 130 | 0; if (M && Math.hypot(x - M.x, y - M.y) < M.r * 3) continue;
        const k = r(), sky = R[Math.round(Math.min(1, y / 150) * 27)];
        if (k < .08) { put(b, x, y, '#fffbe8'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(b, x + dx, y + dy, mix(sky, '#e8ecff', .45)); twinkle.push({ x, y, c: '#ffffff', ph: r() * 6, sp: .03 + r() * .05 }); }
        else put(b, x, y, mix(sky, '#f0f0ff', .35 + k * .55));
        if (k > .8) twinkle.push({ x, y, c: '#ffffff', ph: r() * 6, sp: .04 + r() * .06 });
      }
    }
    if (M) {
      const HR = M.r * (M.sun ? 5 : 3.8);
      for (let y = Math.max(0, M.y - HR | 0); y < Math.min(180, M.y + HR); y++) for (let x = Math.max(0, M.x - HR | 0); x < Math.min(320, M.x + HR); x++) {
        const d = Math.hypot(x - M.x, y - M.y); if (d <= M.r || d > HR) continue;
        const s = Math.pow(1 - (d - M.r) / (HR - M.r), 1.7), lv = Math.floor(s * 5 + dith(x, y) * .999) / 5;
        if (lv > 0) put(b, x, y, M.halo, lv * (M.sun ? .6 : .42));
      }
      for (let y = -M.r; y <= M.r; y++) for (let x = -M.r; x <= M.r; x++) {
        const d = Math.hypot(x, y); if (d > M.r + .3) continue;
        const lit = (-x - y) / (M.r * 1.4);
        let t = .55 + lit * .5; if (!M.sun && noise((x + 40) / 3.2, (y + 40) / 3.2, 8) > .66) t -= .35;
        if (d > M.r - 1.2 && x + y > 0) t -= .3;
        const col = pick([rgb(M.dark), rgb(M.base), rgb(M.light)], clamp01(t), x, y);
        put(b, M.x + x, M.y + y, col);
      }
      if (M.sun) for (const [yy, w] of [[M.y + 5, 44], [M.y + 9, 30], [M.y - 3, 22]]) for (let x = M.x - w; x < M.x + w; x++) if (hash(x, yy, 3) < .9) put(b, x, yy, mix(p.sky[4], M.halo, .25));
    }
    const c = toCanvas(b); c.twinkle = twinkle; return c;
  }
  // Puffy clouds with flat bellies, lit from below at sunset and from above by the moon,
  // plus a few long thin streaks.
  function cloudLayer(p, seed) {
    const W = 480, H = 70, M = Mask(W, H), r = rng(seed);
    for (let i = 0; i < 6; i++) {
      const cx = r() * W, by = 16 + r() * 44, w = 24 + r() * 60, n = 3 + (r() * 4 | 0);
      for (let k = 0; k < n; k++) {
        const px = cx + (k / (n - 1) - .5) * w, rad = (4 + r() * 7) * (1 - Math.abs(k / (n - 1) - .5) * .8), py = by - rad * .5;
        for (let y = Math.floor(py - rad); y <= by; y++) for (let x = Math.floor(px - rad * 1.5); x <= px + rad * 1.5; x++) {
          const dx = (x - px) / (rad * 1.5), dy = (y - py) / rad, e = dx * dx + dy * dy;
          if (e > 1 || e > .7 && noise(x / 2, y / 2, seed) < (e - .7) * 2.5) continue;
          mset(M, x, y, 1);
        }
      }
      for (let x = Math.floor(cx - w * .7); x < cx + w * .7; x++) if (r() < .8) mset(M, x, by, 1);
    }
    for (let i = 0; i < 5; i++) { const x0 = r() * W, y = 8 + r() * 58 | 0, len = 20 + r() * 70; for (let x = x0; x < x0 + len; x++) if (noise(x / 6, y, seed) > .35) mset(M, x, y, 3); }
    const b = Buf(W, H), C = p.cloud;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = mget(M, x, y); if (!v) continue;
      if (v === 3) { put(b, x, y, C.below ? C.lit : C.mid, .8); continue; }
      const dn1 = !mget(M, x, y + 1), dn2 = !mget(M, x, y + 2), dn3 = !mget(M, x, y + 3), up1 = !mget(M, x, y - 1), up2 = !mget(M, x, y - 2);
      let c;
      if (C.below) c = dn1 ? C.lit : dn2 ? (dith(x, y) < .75 ? C.lit : C.mid) : dn3 ? (dith(x, y) < .3 ? C.lit : C.mid) : up1 || (up2 && dith(x, y) < .5) ? C.top : C.mid;
      else c = up1 ? C.lit : up2 ? (dith(x, y) < .5 ? C.lit : C.mid) : dn1 ? C.top : C.mid;
      put(b, x, y, c);
    }
    return toCanvas(b);
  }
  function hillLayer(p, seed) {
    const W = 640, H = 60, b = Buf(W, H), tau = Math.PI * 2;
    for (let x = 0; x < W; x++) {
      const u = x / W * tau;
      const y1 = 20 + Math.sin(u * 2 + seed) * 7 + Math.sin(u * 5 + 1) * 3 + Math.sin(u * 13) * 1.2;
      const y2 = 32 + Math.sin(u * 3 + 2) * 5 + Math.sin(u * 7 + seed) * 2.5 + Math.sin(u * 17) * 1;
      for (let y = Math.round(y1); y < H; y++) put(b, x, y, p.hills[0]);
      for (let y = Math.round(y2); y < H; y++) put(b, x, y, p.hills[1]);
      if (hash(x, 0, seed) < .06) { const h = 2 + hash(x, 1, seed) * 5 | 0, top = Math.round(y2) - h; for (let y = top; y < y2; y++) { put(b, x, y, p.hills[1]); if (y > top + 1) { put(b, x - 1, y, p.hills[1]); put(b, x + 1, y, p.hills[1]); } } }
    }
    return toCanvas(b);
  }
  // Silhouettes are drawn into a mask (1 wood, 2 moss) and coloured afterwards with a rim light.
  function Mask(w, h) { return { w, h, m: new Uint8Array(w * h) }; }
  function mset(M, x, y, v) { y = Math.round(y); if (y < 0 || y >= M.h) return; x = ((Math.round(x) % M.w) + M.w) % M.w; if (v === 2 && M.m[y * M.w + x]) return; M.m[y * M.w + x] = v; }
  const mget = (M, x, y) => y < 0 || y >= M.h ? 0 : M.m[y * M.w + (((x % M.w) + M.w) % M.w)];
  function blob(M, cx, cy, rw, rh, s) {
    for (let y = Math.floor(cy - rh - 2); y <= cy + rh; y++) for (let x = Math.floor(cx - rw - 1); x <= cx + rw + 1; x++) {
      const dx = (x - cx) / rw, dy = (y - cy) / (y < cy ? rh + 1.5 * noise(x / 3, 0, s) : rh);
      if (dx * dx + dy * dy <= 1) mset(M, x, y, 1);
    }
  }
  function thick(M, x0, y0, x1, y1, w0, w1) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, w = w0 + (w1 - w0) * t; for (let dy = -w / 2; dy <= w / 2; dy += .5) for (let dx = -w / 2; dx <= w / 2; dx += .5) mset(M, x + dx, y + dy, 1); }
  }
  // A bald cypress: flared trunk with knees, a broad clumpy crown lit from the top-left,
  // and curtains of Spanish moss. Mask values: 1 wood, 3 leaves, 4 lit leaves, 2 moss.
  function clump(M, cx, cy, rw, rh, s) {
    for (let y = Math.floor(cy - rh - 1); y <= cy + rh + 1; y++) for (let x = Math.floor(cx - rw - 1); x <= cx + rw + 1; x++) {
      const dx = (x - cx) / rw, dy = (y - cy) / rh, e = dx * dx + dy * dy;
      if (e > 1.15) continue;
      if (e > .55 && noise(x / 2.2, y / 2, s) < (e - .55) * 1.6) continue;
      const cur = mget(M, x, y), lit = dx + dy * 1.3 < -.55 && e < .9;
      if (cur === 1) continue;
      mset(M, x, y, lit ? 4 : cur === 4 ? 4 : 3);
    }
  }
  function cypress(M, x0, gy, h, r, opt = {}) {
    const tw = opt.tw || Math.max(2, h / 14), lean = (r() - .5) * .2, flare = opt.flare || tw * 1.5;
    const top = gy - h;
    for (let y = gy + 2; y >= top + h * .12; y--) {
      const t = (gy - y) / h, half = tw / 2 * (1 - t * .5) + flare * Math.pow(Math.max(0, 1 - t * 3.4), 2.2), cx = x0 + lean * (gy - y);
      for (let x = Math.floor(cx - half); x <= cx + half; x++) mset(M, x, y, 1);
    }
    for (let k = 0; k < 3; k++) { const kx = x0 + (r() - .5) * flare * 6, kh = 2 + r() * Math.max(2, h / 16); for (let y = 0; y < kh; y++) { const w = (1 - y / kh) * 1.6; for (let x = Math.floor(kx - w); x <= kx + w; x++) mset(M, x, gy - y, 1); } }
    if (opt.dead) return;
    const sc = h / 70, crownW = (opt.crown || 16 + r() * 12) * sc, pads = [];
    const n = Math.round(5 + h / 9);
    for (let k = 0; k < n; k++) {
      const t = .5 + r() * .48, y = gy - h * t, tx = x0 + lean * h * t;
      const spread = crownW * (.35 + .65 * (t - .45) / .55), cx = tx + (r() * 2 - 1) * spread;
      const rw = (3 + r() * 5) * Math.max(.7, sc), rh = (1.6 + r() * 2.2) * Math.max(.7, sc);
      thick(M, tx, y + rh + 2, cx, y + rh * .5, Math.max(1, 2 * sc), 1);
      pads.push([cx, y, rw, rh]);
    }
    const tx = x0 + lean * h;
    pads.push([tx, top + 2 * sc, crownW * .45, 2.5 * Math.max(.8, sc)]);
    pads.sort((a, b) => b[1] - a[1]);
    for (const [cx, cy, rw, rh] of pads) clump(M, cx, cy, rw, rh, (cx * 7 + cy) | 0);
    for (const [cx, cy, rw, rh] of pads) for (let x = Math.floor(cx - rw * .8); x <= cx + rw * .8; x++) {
      if (r() > .42) continue;
      let y = Math.round(cy); while (mget(M, x, y + 1) >= 3 || mget(M, x, y + 1) === 1 && mget(M, x, y) >= 3) y++;
      if (mget(M, x, y + 1) === 1) continue;
      const len = (2 + r() * (opt.moss || 10) * (1 - Math.abs(x - cx) / rw)) | 0;
      for (let k = 1; k <= len; k++) mset(M, x + (opt.wind && k > 3 ? Math.round(k * opt.wind) : 0), y + k, 2);
    }
  }
  // Colours a mask: wood and leaves with a rim light on top-left edges; moss lighter, darker at its tips.
  function colourMask(M, body, rim, moss, fog, fogFrom, leaf) {
    const b = Buf(M.w, M.h), mossDark = moss ? mix(moss, body, .5) : null, leafC = leaf || body, leafLit = mix(leafC, rim || leafC, .45);
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
      const v = M.m[y * M.w + x]; if (!v) continue;
      let c;
      if (v === 2) c = mget(M, x, y + 1) !== 2 || mget(M, x, y + 2) !== 2 && dith(x, y) < .5 ? mossDark : moss;
      else {
        const edge = !mget(M, x, y - 1) || mget(M, x, y - 1) === 2 || !mget(M, x - 1, y) && (y & 1);
        c = rim && edge ? rim : v === 4 ? (dith(x, y) < .55 ? leafLit : leafC) : v === 3 ? leafC : body;
      }
      if (fog && y > fogFrom) { const f = (y - fogFrom) / (M.h - fogFrom); c = mix(c, fog, Math.floor(f * 4 + dith(x, y) * .5) / 4 * .45); }
      put(b, x, y, c);
    }
    return b;
  }
  function farLayer(p, seed) {
    const W = 480, H = 96, gy = 82, M = Mask(W, H), r = rng(seed);
    for (let x = 0; x < W; x++) for (let y = gy + Math.round(Math.sin(x / 17 + seed) * 1.2); y < gy + 3; y++) mset(M, x, y, 1);
    for (let x = 4; x < W; x += 12 + r() * 22) cypress(M, x, gy, 16 + r() * 30, r, { moss: 5, crown: 12 + r() * 10, wind: p === BG.storm ? .5 : 0 });
    const b = colourMask(M, p.far, p.farRim, mix(p.far, p.mist, .3), p.mist, gy - 30, mix(p.far, p.farRim, .15));
    // Still water under the far bank, mirroring it.
    for (let y = gy + 3; y < H; y++) for (let x = 0; x < W; x++) {
      const my = 2 * (gy + 2) - y, refl = mget(M, x + Math.round(Math.sin(y * 1.7) * 1.2), my);
      let c = mix(p.far, p.water, .2 + (y - gy) * .012);
      if (refl && (y & 1) === 0) c = mix(p.far, p.water, .06);
      if ((y & 1) && hash(x >> 3, y, 5) < .07) c = mix(p.water, p.mist, .35);
      put(b, x, y, c);
    }
    const c = toCanvas(b); c.gy = gy; return c;
  }
  function midLayer(p, seed) {
    const W = 640, H = 160, gy = 148, M = Mask(W, H), r = rng(seed);
    for (let x = 0; x < W; x++) for (let y = gy + Math.round(Math.sin(x / 23 + seed) * 2); y < H; y++) mset(M, x, y, 1);
    // Shrubs along the bank.
    for (let x = 0; x < W; x += 6 + r() * 10) blob(M, x, gy - 1, 5 + r() * 9, 2 + r() * 4, x);
    const n = 6; for (let k = 0; k < n; k++) cypress(M, k * W / n + r() * 50, gy, (k % 2 ? 50 : 70) + r() * 40, r, { moss: 16, wind: p === BG.storm ? .6 : 0 });
    const c = toCanvas(colourMask(M, p.mid, p.midRim, p.moss, p.mist, gy - 16, mix(p.mid, p.midRim, .18))); c.gy = gy; return c;
  }
  // The dead bald cypress where the heron nests.
  function snagLayer(p) {
    const W = 200, H = 190, gy = 186, M = Mask(W, H), r = rng(404), cx = 96;
    for (let y = gy; y > 34; y--) {
      const t = (gy - y) / 152, half = 8 * (1 - t * .55) + 16 * Math.pow(Math.max(0, 1 - t * 3), 2.4), sx = cx + Math.sin(t * 3) * 4;
      for (let x = Math.floor(sx - half); x <= sx + half; x++) mset(M, x, y, 1);
    }
    const limbs = [[.35, -1, 38, .5], [.48, 1, 44, .35], [.6, -1, 30, .7], [.7, 1, 26, .9], [.8, -1, 20, .4], [.9, 1, 16, .6]];
    for (const [t, side, len, up] of limbs) {
      const y0 = gy - 152 * t, x0 = cx + Math.sin(t * 3) * 4; let x = x0, y = y0, w = 4.5 * (1.1 - t * .6);
      const steps = len / 2;
      for (let s = 0; s < steps; s++) { const nx = x + side * 2, ny = y - 2 * up + (r() - .5) * 2; thick(M, x, y, nx, ny, w, w * .9); x = nx; y = ny; w = Math.max(1, w * .93); if (r() < .15) { let bx = x, by = y; for (let q = 0; q < 6; q++) { bx += side * (r() < .5 ? 1 : 0); by -= 1; mset(M, bx, by, 1); } } }
      for (let q = 0; q < 6; q++) mset(M, x + side * q * .6, y - q, 1);
    }
    // Moss rags on the limbs.
    for (let x = 0; x < W; x++) for (let y = 30; y < gy - 60; y++) if (mget(M, x, y) === 1 && !mget(M, x, y + 1) && r() < .35) { const len = 2 + r() * 9 | 0; for (let k = 1; k <= len; k++) mset(M, x, y + k, 2); }
    const b = colourMask(M, p.snag, p.snagRim, p.moss, p.mist, gy - 40);
    // The nest: a bowl of sticks on top of the trunk.
    for (let y = 18; y < 40; y++) for (let x = cx - 28; x < cx + 28; x++) {
      const dx = (x - cx) / 26, dy = (y - 32) / 8; if (dx * dx + dy * dy > 1 || y < 25 - Math.abs(dx) * -2) continue;
      put(b, x, y, (x + y * 2) % 5 === 0 ? mix(p.snag, p.snagRim, .5) : (x - y) % 7 === 0 ? mix(p.snag, '#000', .2) : p.snag);
    }
    for (let k = 0; k < 26; k++) { const a = r() * Math.PI, len = 8 + r() * 12, x0 = cx + (r() - .5) * 46, y0 = 26 + r() * 8; for (let s = 0; s < len; s++) put(b, x0 + Math.cos(a) * s * (r() < .5 ? 1 : -1), y0 - Math.sin(a) * s * .25, s < 2 ? mix(p.snag, p.snagRim, .6) : p.snag); }
    for (let x = cx - 25; x < cx + 25; x++) if (hash(x, 1, 7) < .6) put(b, x, 24 + Math.round(Math.abs(x - cx) / 8), p.snagRim);
    const c = toCanvas(b); c.gy = gy; return c;
  }
  function reedLayer(p, seed) {
    const W = 320, H = 56, b = Buf(W, H), r = rng(seed);
    for (let i = 0; i < 70; i++) {
      const x = r() * W | 0, dens = noise(x / 30, 0, seed); if (r() > dens * 1.4) continue;
      const h = 14 + r() * 36 | 0, lean = (r() - .5) * .3, top = H - h;
      for (let y = H - 1; y > top; y--) { const xx = Math.round(x + lean * (H - y)); put(b, xx, y, p.reeds); if (y < H - 4 && y % 3 === 0) put(b, xx - 1, y, p.reedRim); }
      const hx = Math.round(x + lean * h);
      if (r() < .55) { for (let y = top + 2; y < top + 9; y++) { put(b, hx - 1, y, y < top + 4 ? p.reedRim : p.head); put(b, hx, y, p.head); put(b, hx + 1, y, p.reeds); } put(b, hx, top, p.reeds); put(b, hx, top + 1, p.reeds); }
      for (let k = 0; k < 2; k++) { const side = k ? 1 : -1, len = 8 + r() * 16 | 0; let lx = x, ly = H - 2; for (let s = 0; s < len; s++) { put(b, lx, ly, p.reeds); if (s < len * .4) put(b, lx + side, ly, p.reeds); ly--; if (s > len * .4 && s % 2) lx += side; } put(b, lx, ly, p.reedRim); }
    }
    const c = toCanvas(b); c.gy = H; return c;
  }
  function mistLayer(color, seed, alpha) {
    const W = 320, H = 26, b = Buf(W, H), tau = Math.PI * 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const bell = Math.sin(y / H * Math.PI), wave = .65 + .35 * Math.sin(x / W * tau * 3 + seed + y * .1) * Math.sin(x / W * tau * 2 + 1);
      const dens = bell * bell * wave, lv = Math.floor(dens * 4 + dith(x, y) * .6) / 4;
      if (lv > 0) put(b, x, y, color, alpha * lv);
    }
    return toCanvas(b);
  }
  // Storm clouds: a low, heavy bank with bellies lit by the lightning.
  function stormLayer(seed) {
    const W = 480, H = 70, M = Mask(W, H), r = rng(seed);
    for (let i = 0; i < 16; i++) { const x = r() * W, y = 10 + r() * 28, n = 3 + (r() * 4 | 0), rad = 7 + r() * 8; for (let k = 0; k < n; k++) blob(M, x + k * rad, y + r() * 5, rad * (.8 + r() * .5), rad * (.5 + r() * .3), i * 9 + k); }
    for (let x = 0; x < W; x++) for (let y = 0; y < 12 + Math.sin(x / W * Math.PI * 8) * 3 + noise(x / 7, 0, seed) * 4; y++) mset(M, x, y, 1);
    const b = Buf(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!mget(M, x, y)) continue;
      const dn = !mget(M, x, y + 1), dn2 = !mget(M, x, y + 2), up = !mget(M, x, y - 1);
      put(b, x, y, dn ? '#4a5868' : dn2 && dith(x, y) < .5 ? '#34404e' : up ? '#2a3440' : noise(x / 10, y / 4, seed) > .6 ? '#1c242e' : '#141a22');
    }
    return toCanvas(b);
  }
  function millLayer() {
    return paint(40, 72, b => {
      const body = '#0e141c', rim = '#2c3a4a';
      for (let y = 0; y < 52; y++) { const hw = 6 + (y * 7 / 52) | 0; for (let x = 20 - hw; x < 20 + hw; x++) put(b, x, 18 + y, x === 20 - hw ? rim : body); }
      rect(b, 12, 14, 16, 5, body); rect(b, 14, 11, 12, 3, body); rect(b, 17, 9, 6, 2, body); rect(b, 12, 14, 16, 1, rim); rect(b, 14, 11, 12, 1, rim);
      rect(b, 18, 40, 3, 4, '#f2c46a'); put(b, 18, 40, '#fff0c0'); rect(b, 18, 44, 3, 1, '#8a6a3a');
      for (let y = 22; y < 68; y += 7) put(b, 16 + (y % 3), y, rim);
    });
  }
  // Cave: layered rock with stalactites, glow-worms on the ceiling and glowing fungi.
  function fungus(b, x, y, p, big) {
    const n = big ? 3 + (hash(x, y, 1) * 3 | 0) : 2 + (hash(x, y, 1) * 2 | 0), out = [];
    for (let k = 0; k < n; k++) {
      const fx = x + Math.round((k - (n - 1) / 2) * (big ? 4 : 3) + (hash(x, k, 2) - .5) * 2), h = (big ? 3 : 1) + (hash(x, k, 3) * (big ? 6 : 3) | 0), w = big ? 2 + (hash(k, x, 4) * 2 | 0) : 1;
      for (let s = 0; s < h; s++) put(b, fx, y - s, '#7a6a90');
      const cy = y - h;
      for (let i = -w; i <= w; i++) put(b, fx + i, cy, i < 0 ? p.glow[1] : p.glow[0]);
      for (let i = -w + 1; i <= w - 1; i++) put(b, fx + i, cy - 1, i < 0 ? p.glow[2] : p.glow[1]);
      if (w > 1) put(b, fx, cy - 2, p.glow[2]);
      out.push([fx, cy]);
    }
    for (let dy = -9; dy <= 6; dy++) for (let dx = -12; dx <= 12; dx++) { const d = Math.hypot(dx, dy * 1.4); if (d < 12 && dith(x + dx, y + dy) < (1 - d / 12) * .6) put(b, x + dx, y + dy - 3, p.glow[0], .3); }
    return out;
  }
  function caveFar(p) {
    const W = 480, H = 200, b = Buf(W, H), R = ramp(p.rock, 8), tau = Math.PI * 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const wob = Math.sin(x / W * tau * 3) * 5 + Math.sin(x / W * tau * 7 + 1) * 2, band = Math.floor((y + wob) / 9);
      const pocket = Math.sin(x / W * tau * 4 + 1) * Math.sin(y / 26 + 1) + (noise(x / 20, y / 14, 2) - .5) * .8;
      if (y > 40 && y < 170 && pocket > .55) { put(b, x, y, pick(R, .04, x, y)); continue; }
      let t = .3 + hash(band, 0, 3) * .3;
      if (((y + wob) % 9) < 1) t -= .2; else if (((y + wob) % 9) < 2) t += .12;
      t += (noise(x / 8, y / 5, 4) - .5) * .2 - (pocket > .4 ? .15 : 0);
      put(b, x, y, pick(R, t, x, y));
    }
    const r = rng(9);
    for (let i = 0; i < 46; i++) {
      const x = r() * W | 0, len = 8 + r() * 34, w = 2 + r() * 4;
      for (let y = 0; y < len; y++) { const hw = w * (1 - y / len); for (let xx = Math.floor(x - hw); xx <= x + hw; xx++) put(b, (xx + W) % W, 10 + y, xx < x - hw + 1 ? R[6] : xx > x + hw - 1 ? R[1] : R[3]); }
    }
    for (let i = 0; i < 160; i++) { const x = r() * W | 0, y = 6 + r() * r() * 90 | 0; put(b, x, y, p.worm, .45 + r() * .55); if (r() < .15) { put(b, x + 1, y, p.worm, .3); put(b, x, y + 1, p.worm, .3); } }
    const c = toCanvas(b); c.gy = H; return c;
  }
  function caveMid(p, seed) {
    const W = 640, H = 200, M = Mask(W, H), r = rng(seed), gy = 160;
    for (let x = 0; x < W; x++) for (let y = 0; y < 8 + Math.sin(x / 13) * 3 + Math.sin(x / 41) * 5; y++) mset(M, x, y, 1);
    for (let i = 0; i < 18; i++) { const x = r() * W, len = 16 + r() * 56, w = 3 + r() * 8; for (let y = 0; y < len; y++) { const hw = w * Math.pow(1 - y / len, .8); for (let xx = Math.floor(x - hw); xx <= x + hw; xx++) mset(M, xx, y, 1); } }
    for (let x = 0; x < W; x++) for (let y = gy + Math.round(Math.sin(x / 19) * 3); y < H; y++) mset(M, x, y, 1);
    const tips = [];
    for (let i = 0; i < 12; i++) { const x = r() * W, len = 14 + r() * 46, w = 4 + r() * 8; for (let y = 0; y < len; y++) { const hw = w * Math.pow(1 - y / len, .7); for (let xx = Math.floor(x - hw); xx <= x + hw; xx++) mset(M, xx, gy - y, 1); } tips.push([Math.round(x + w * .6), Math.round(gy - len * .35)]); }
    for (let i = 0; i < 3; i++) { const x = 80 + i * 210 + r() * 40; for (let y = 0; y < H; y++) { const hw = 6 + Math.sin(y / 20 + i) * 2 + Math.pow(Math.abs(y - gy / 2) / (gy / 2), 3) * 14; for (let xx = Math.floor(x - hw); xx <= x + hw; xx++) mset(M, xx, y, 1); } }
    const b = colourMask(M, p.mid, p.midRim, null, null, 0);
    for (let i = 0; i < 50; i++) { const x = r() * W | 0; let y = 0; while (y < H && mget(M, x, y)) y++; if (y > 90) continue; const len = 3 + r() * 18 | 0; for (let k = 0; k < len; k++) put(b, x, y + k, p.midRim, .5); put(b, x, y + len, p.worm); put(b, x, y + len + 1, p.worm, .5); }
    const glows = [];
    for (let i = 0; i < 16; i++) {
      const x = 10 + r() * (W - 20) | 0; let y = gy - 40; while (y < H - 1 && !mget(M, x, y + 1)) y++;
      if (y > gy + 4) continue;
      for (const q of fungus(b, x, y, p, r() < .4)) glows.push(q);
    }
    const c = toCanvas(b); c.gy = H; c.glows = glows.filter((q, i) => i % 2 === 0); return c;
  }
  function caveNear(p, seed) {
    const W = 320, H = 70, b = Buf(W, H), r = rng(seed), glows = [];
    for (let i = 0; i < 5; i++) {
      const x = 20 + r() * (W - 40) | 0, h = 14 + r() * 22 | 0, cw = 5 + r() * 5 | 0;
      for (let y = H - h; y < H; y++) { put(b, x - 1, y, p.reedRim); put(b, x, y, '#4a3a5c'); put(b, x + 1, y, p.reeds); }
      for (let dx = -cw; dx <= cw; dx++) {
        const f = dx / (cw + .5), yy = H - h - Math.round(Math.sqrt(Math.max(0, 1 - f * f)) * 4);
        for (let y = yy; y <= H - h; y++) put(b, x + dx, y, y === yy ? p.glow[2] : y === yy + 1 || dx < -cw / 2 ? p.glow[1] : p.glow[0]);
        put(b, x + dx, H - h + 1, dx % 2 ? '#1c6a64' : '#2a8a80');
      }
      glows.push([x, H - h - 2]);
    }
    const c = toCanvas(b); c.gy = H; c.glows = glows; return c;
  }
  function raysLayer(p) {
    return paint(320, 180, b => {
      for (const [x0, w] of [[70, 16], [150, 10], [250, 22]]) for (let y = 0; y < 180; y++) {
        const x1 = x0 + y * .35;
        for (let x = Math.floor(x1); x < x1 + w + y * .08; x++) { const f = (1 - y / 180) * .9; if (dith(x, y) < f * .45) put(b, x, y, '#b8a8e8', .16); }
      }
    });
  }
  const bgCache = {};
  function background(theme) {
    if (bgCache[theme]) return bgCache[theme];
    const p = BG[theme] || BG.dusk, cave = !!p.cave;
    const bg = { theme: p, name: theme, fog: p.mist, ground: '#10141c', sky: skyLayer(p) };
    bg.stars = bg.sky.twinkle;
    if (cave) { bg.far = caveFar(p); bg.mid = caveMid(p, 23); bg.reeds = caveNear(p, 31); bg.rays = raysLayer(p); bg.mistA = mistLayer(p.mist, 3, .5); }
    else {
      bg.clouds = p.cloud ? cloudLayer(p, 41) : null; bg.hills = hillLayer(p, 5); bg.far = farLayer(p, 11); bg.mid = midLayer(p, theme === 'nest' ? 29 : 23); bg.reeds = reedLayer(p, 31);
      bg.mistA = mistLayer(p.mist, 3, .45); bg.mistB = mistLayer(mix(p.mist, p.mid, .3), 7, .35);
      if (theme === 'storm') { bg.storm = stormLayer(57); bg.mill = millLayer(); }
      if (theme === 'nest') bg.snag = snagLayer(p);
    }
    return bgCache[theme] = bg;
  }
  // Parallax: every layer scrolls slower the farther it is; H is the screen height.
  function drawBackground(g, camX, camY, bg, t, W, H, bolt) {
    g.drawImage(bg.sky, 0, 0);
    const dy = 44 - camY;
    const layer = (c, k, y, drift = 0) => { if (!c) return; const w = c.width; let ox = -Math.floor(((camX * k + drift) % w + w) % w); for (let x = ox; x < W; x += w) g.drawImage(c, x, Math.round(y)); if (ox > 0) g.drawImage(c, ox - w, Math.round(y)); };
    if (bg.stars) for (const s of bg.stars) { const a = Math.sin(t * s.sp + s.ph); if (a > .55) { g.globalAlpha = (a - .55) * 2.2; g.fillStyle = s.c; g.fillRect(s.x - 1, s.y, 3, 1); g.fillRect(s.x, s.y - 1, 1, 3); g.globalAlpha = 1; } }
    if (bg.name === 'cave') {
      bg.glowScreen = [];
      const glowAt = (c, k, y, rad) => { const w = c.width, ox = -Math.floor(((camX * k) % w + w) % w); for (const [gx, gy] of c.glows) for (let x = ox; x < W + w; x += w) { const sx = x + gx, sy = Math.round(y) + gy; if (sx > -20 && sx < W + 20 && sy > -20 && sy < H + 20) bg.glowScreen.push([sx, sy, rad]); } };
      layer(bg.far, .1, -14 + dy * .1);
      g.drawImage(bg.rays, 0, 0);
      layer(bg.mistA, .15, 100 + dy * .15, t * .08);
      layer(bg.mid, .3, -24 + dy * .2); glowAt(bg.mid, .3, -24 + dy * .2, 9);
      layer(bg.reeds, .6, 176 - bg.reeds.gy + dy * .45); glowAt(bg.reeds, .6, 176 - bg.reeds.gy + dy * .45, 16);
      return;
    }
    layer(bg.clouds, .04, 6 + dy * .02, t * .05);
    if (bolt) bolt(g);
    if (bg.storm) layer(bg.storm, .08, -6, t * .25);
    layer(bg.hills, .07, 88 + dy * .05);
    if (bg.mill) {
      const px = camX * .1; for (let k = Math.floor(px / 700); k <= Math.floor((px + W) / 700) + 1; k++) {
        const mx = Math.round(k * 700 + 180 - px), my = 62 + Math.round(dy * .06); if (mx < -60 || mx > W + 60) continue;
        g.drawImage(bg.mill, mx - 20, my); const a0 = t * .02, cx = mx, cy = my + 15; g.fillStyle = '#0e141c';
        for (let s = 0; s < 4; s++) { const a = a0 + s * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a); for (let d = 2; d < 26; d++) { g.fillRect(Math.round(cx + ca * d), Math.round(cy + sa * d), 1, 1); if (d > 8) g.fillRect(Math.round(cx + ca * d - sa * 3), Math.round(cy + sa * d + ca * 3), 2, 1); } }
        g.fillRect(cx - 1, cy - 1, 3, 3);
      }
    }
    layer(bg.far, .14, 128 - bg.far.gy + dy * .1);
    layer(bg.mistA, .18, 104 + dy * .1, t * .1);
    if (bg.snag) g.drawImage(bg.snag, Math.round(250 - camX * .3 - 96), Math.round(166 - bg.snag.gy + dy * .18));
    layer(bg.mid, .36, 150 - bg.mid.gy + dy * .22);
    layer(bg.mistB, .5, 128 + dy * .25, t * .2);
    layer(bg.reeds, .62, 166 - bg.reeds.gy + dy * .42);
  }

  // ---------------------------------------------------------------- Escena del embarcadero
  // Title, level select and the end: two mossy banks, a boardwalk over still water, a lantern.
  const DOCK = ['....................', '....................', '....................', '....................', '....................', '....................', '....................', '....................',
    '######~~~~~~~~######', '######~~~~~~~~######', '######~~~~~~~~######', '######~~~~~~~~######'];
  function drawScene(g, t, theme, W, H) {
    const A = water(theme), S = tiles(theme), T = sceneTerrain('dock', DOCK, theme), p = BG[theme] || BG.dusk, wf = (t >> 3) % 8;
    for (let x = 96; x < 224; x += 16) for (let r = 0; r < 4; r++) g.drawImage(A.back[r][(x >> 4) & 1], x, 128 + r * 16);
    // The moon (or sun) laid on the water in broken bands.
    if (p.moon && p.moon.x > 90 && p.moon.x < 230) { g.fillStyle = p.moon.light; for (let i = 0; i < 9; i++) { const y = 136 + i * 4, w = 16 - i * 1.4, off = Math.round(Math.sin((t + i * 30) / 15) * 3); if (i % 2 === 0) g.fillRect(Math.round(p.moon.x - w / 2 + off), y, Math.round(w), 1); } }
    else { g.fillStyle = A.A.glint; for (let i = 0; i < 5; i++) { const y = 138 + i * 6, off = Math.round(Math.sin((t + i * 40) / 18) * 4); g.fillRect(150 - 8 + i + off, y, 14 - i * 2, 1); } }
    for (const c of T.chunks.map((c, i) => [c, i])) g.drawImage(c[0], c[1] * CHUNK, 0);
    for (let x = 96; x < 224; x += 16) g.drawImage(x === 96 ? S.planks.left : x === 208 ? S.planks.right : S.planks.mid[(x >> 4) & 1], x, 128);
    for (const x of [98, 150, 214]) g.drawImage(S.post, x, 132);
    for (let x = 96; x < 224; x += 16) { g.drawImage(A.front[(wf + (x >> 4)) % 8], x, 128); for (let r = 1; r < 4; r++) g.drawImage(A.deepFront, x, 128 + r * 16); }
    g.drawImage(A.foam[(t >> 3) % 4], 96, 128); g.drawImage(ART.flip(A.foam[((t >> 3) + 2) % 4]), 216, 128);
    g.drawImage(ART.lantern.on, 205, 110);
    g.globalAlpha = .15 + Math.sin(t / 9) * .03; g.fillStyle = '#ffcf5a'; g.beginPath(); g.arc(210, 115, 20, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    g.drawImage(S.reed, 232, 113); g.drawImage(S.reed, 244, 115); g.drawImage(S.tuft, 60, 121); g.drawImage(S.shroom, 30, 122); g.drawImage(S.reed, 72, 114);
  }

  return { rgb, mix, css, ramp, pick, dith, hash, noise, Buf, put, rect, paint, toCanvas, outline, newCanvas, alphaAt,
    TERRA, AGUA, BG, STONE, ROOT, WOOD, OUT, buildTerrain, levelTerrain, drawTerrain, sceneTerrain, water, tiles, drawTiles, props, background, drawBackground, drawScene };
})();
// The world pieces replace the simple ones in ART; characters are left alone.
Object.assign(ART, MUNDO.props, { background: MUNDO.background });
