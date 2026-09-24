// GLUP — la letra Glup. Una fuente de píxel propia para las conversaciones: mayúsculas y
// minúsculas de verdad (con ascendentes y descendentes), acentos, eñe, ü, ¡ y ¿; se dibuja con
// borde oscuro, sombra y un tono más claro arriba, y cada letra aparece con un pequeño rebote.
'use strict';
const Letra = (() => {
  // 9 rows: 0-6 up to the baseline (capitals are 7 tall, lowercase x-height rows 2-6), 7-8 descenders.
  // Each glyph: rows separated by '|', starting at `top` (default 0). '#' is ink.
  const G = {
    A: '.##.|#..#|#..#|####|#..#|#..#|#..#', B: '###.|#..#|#..#|###.|#..#|#..#|###.', C: '.###|#...|#...|#...|#...|#...|.###',
    D: '###.|#..#|#..#|#..#|#..#|#..#|###.', E: '####|#...|#...|###.|#...|#...|####', F: '####|#...|#...|###.|#...|#...|#...',
    G: '.###|#...|#...|#.##|#..#|#..#|.###', H: '#..#|#..#|#..#|####|#..#|#..#|#..#', I: '###|.#.|.#.|.#.|.#.|.#.|###',
    J: '..##|...#|...#|...#|#..#|#..#|.##.', K: '#..#|#.#.|##..|#...|##..|#.#.|#..#', L: '#...|#...|#...|#...|#...|#...|####',
    M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#..#|##.#|##.#|#.##|#.##|#..#|#..#', O: '.##.|#..#|#..#|#..#|#..#|#..#|.##.',
    P: '###.|#..#|#..#|###.|#...|#...|#...', Q: '.##.|#..#|#..#|#..#|#.##|#..#|.###|...#', R: '###.|#..#|#..#|###.|#.#.|#..#|#..#',
    S: '.###|#...|#...|.##.|...#|...#|###.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..', U: '#..#|#..#|#..#|#..#|#..#|#..#|.##.',
    V: '#...#|#...#|#...#|#...#|.#.#.|.#.#.|..#..', W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
    Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '####|...#|..#.|.#..|#...|#...|####',
    a: '2:.##.|...#|.###|#..#|.###', b: '#...|#...|###.|#..#|#..#|#..#|###.', c: '2:.##|#..|#..|#..|.##', d: '...#|...#|.###|#..#|#..#|#..#|.###',
    e: '2:.##.|#..#|####|#...|.##.', f: '..#|.#.|###|.#.|.#.|.#.|.#.', g: '2:.###|#..#|#..#|#..#|.###|...#|.##.', h: '#...|#...|###.|#..#|#..#|#..#|#..#',
    i: '#|.|#|#|#|#|#', j: '.#|..|.#|.#|.#|.#|.#|.#|#.', k: '#...|#...|#..#|#.#.|##..|#.#.|#..#', l: '#.|#.|#.|#.|#.|#.|.#',
    m: '2:####.|#.#.#|#.#.#|#.#.#|#.#.#', n: '2:###.|#..#|#..#|#..#|#..#', o: '2:.##.|#..#|#..#|#..#|.##.', p: '2:###.|#..#|#..#|#..#|###.|#...|#...',
    q: '2:.###|#..#|#..#|#..#|.###|...#|...#', r: '2:#.##|##..|#...|#...|#...', s: '2:.###|#...|.##.|...#|###.', t: '.#.|.#.|###|.#.|.#.|.#.|..#',
    u: '2:#..#|#..#|#..#|#..#|.###', v: '2:#...#|#...#|.#.#.|.#.#.|..#..', w: '2:#...#|#.#.#|#.#.#|#.#.#|.#.#.', x: '2:#..#|#..#|.##.|#..#|#..#',
    y: '2:#..#|#..#|#..#|#..#|.###|...#|.##.', z: '2:####|..#.|.#..|#...|####',
    0: '.##.|#..#|#.##|##.#|#..#|#..#|.##.', 1: '.#.|##.|.#.|.#.|.#.|.#.|###', 2: '.##.|#..#|...#|..#.|.#..|#...|####', 3: '###.|...#|...#|.##.|...#|...#|###.',
    4: '#..#|#..#|#..#|####|...#|...#|...#', 5: '####|#...|###.|...#|...#|#..#|.##.', 6: '.##.|#...|#...|###.|#..#|#..#|.##.', 7: '####|...#|..#.|..#.|.#..|.#..|.#..',
    8: '.##.|#..#|#..#|.##.|#..#|#..#|.##.', 9: '.##.|#..#|#..#|.###|...#|...#|.##.',
    '.': '6:#', ',': '6:#|#', ':': '2:#|.|.|.|#', ';': '2:#|.|.|.|#|#', '!': '#|#|#|#|#|.|#', '¡': '#|.|#|#|#|#|#',
    '?': '.##.|#..#|...#|..#.|.#..|....|.#..', '¿': '..#.|....|..#.|.#..|#...|#..#|.##.', '-': '3:###', '+': '2:.#.|###|.#.', '·': '3:#',
    '"': '#.#|#.#', "'": '#|#', '(': '.#|#.|#.|#.|#.|#.|.#', ')': '#.|.#|.#|.#|.#|.#|#.', '/': '...#|..#.|..#.|.#..|.#..|#...|#...',
    '«': '2:.#.#|#.#.|.#.#', '»': '2:#.#.|.#.#|#.#.', '…': '6:#.#.#', '↑': '.#.|###|#.#|.#.|.#.|.#.|.#.', '↓': '.#.|.#.|.#.|.#.|#.#|###|.#.',
    '←': '2:.#...|#####|.#...', '→': '2:...#.|#####|...#.', '▲': '3:.#.|###', '▼': '3:###|.#.' };
  const ACC = { á: ['a', 'acute'], é: ['e', 'acute'], í: ['ı', 'acute'], ó: ['o', 'acute'], ú: ['u', 'acute'], ü: ['u', 'diaer'], ñ: ['n', 'tilde'],
    Á: ['A', 'acute'], É: ['E', 'acute'], Í: ['I', 'acute'], Ó: ['O', 'acute'], Ú: ['U', 'acute'], Ü: ['U', 'diaer'], Ñ: ['N', 'tilde'] };
  G['ı'] = '2:#|#|#|#|#';
  const cache = new Map();
  // A glyph as a list of lit pixels, its width and its accent marks.
  function glyph(ch) {
    if (cache.has(ch)) return cache.get(ch);
    let src = G[ch], mark = null, base = ch;
    if (!src && ACC[ch]) { base = ACC[ch][0]; mark = ACC[ch][1]; src = G[base]; }
    if (!src && G[ch.toUpperCase()]) src = G[ch.toUpperCase()];
    let r = null;
    if (src) {
      let top = 0, body = src; const m = /^(\d):(.*)$/.exec(src); if (m) { top = +m[1]; body = m[2]; }
      const rows = body.split('|'), w = Math.max(...rows.map(s => s.length)), px = [];
      rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') px.push([x, y + top]); }));
      if (mark) {
        const upper = base === base.toUpperCase() && base !== 'ı', y0 = upper ? -3 : 0, cx = Math.floor((w - 1) / 2);
        if (mark === 'acute') px.push([cx + 1, y0], [cx, y0 + 1]);
        else if (mark === 'diaer') px.push([0, y0 + 1], [w - 1, y0 + 1]);
        else if (mark === 'tilde') { px.push([0, y0 + 1], [1, y0], [2, y0 + 1], [3, y0]); }
      }
      r = { w, px };
    }
    cache.set(ch, r); return r;
  }
  const SPACE = 3, GAP = 1, LINE = 12;
  function width(str) { let w = 0; for (const ch of str) { if (ch === ' ') { w += SPACE; continue; } const gl = glyph(ch); w += (gl ? gl.w : 3) + GAP; } return Math.max(0, w - GAP); }
  function wrap(str, max) {
    const out = []; let line = '';
    for (const word of str.split(' ')) { const t = line ? line + ' ' + word : word; if (width(t) > max && line) { out.push(line); line = word; } else line = t; }
    if (line) out.push(line); return out;
  }
  // Draw a string. o: { color, light (top rows), shadow, outline, shown (typed chars), bounce (frame counter for the pop), wave }.
  function text(g, str, x, y, o = {}) {
    const col = o.color || '#2a1e2e', light = o.light || null, out = o.outline === undefined ? null : o.outline, sh = o.shadow || null;
    let cx = x; const shown = o.shown === undefined ? Infinity : o.shown, t = o.t || 0; let i = 0;
    for (const ch of str) {
      if (i >= shown) break;
      if (ch === ' ') { cx += SPACE; i++; continue; }
      const gl = glyph(ch); if (!gl) { cx += 3 + GAP; i++; continue; }
      // The newest letters pop up from below and settle.
      const age = shown === Infinity ? 99 : shown - i, pop = age < 4 ? Math.round((4 - age) * .75) : 0;
      const wy = o.wave ? Math.round(Math.sin(t / 6 + i * .7) * 1) : 0, oy = y + wy + pop;
      const P = (dx, dy, c) => { g.fillStyle = c; for (const [px, py] of gl.px) g.fillRect(cx + px + dx, oy + py + dy, 1, 1); };
      if (sh) P(0, 1, sh);
      if (out) { P(-1, 0, out); P(1, 0, out); P(0, -1, out); P(0, 1, out); }
      g.fillStyle = col; for (const [px, py] of gl.px) { g.fillStyle = light && py <= 1 ? light : col; g.fillRect(cx + px, oy + py, 1, 1); }
      cx += gl.w + GAP; i++;
    }
    return cx - x;
  }
  return { text, width, wrap, glyph, LINE };
})();
