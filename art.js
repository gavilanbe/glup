// GLUP — arte. Todo el pixel art está dibujado a mano como matrices de caracteres
// con una paleta por sprite; los fondos y la tierra se generan por procedimiento
// con la misma paleta. Nada se carga de fuera.
'use strict';
const ART = (() => {
  const canvases = [];
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; canvases.push(c); return c; }
  function hex(h) { if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function sprite(rows, pal, name = '?') {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const c = canvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = rows[y][x] || '.'; if (ch === '.') continue;
      const col = pal[ch]; if (!col) { console.warn('GLUP: color desconocido', ch, 'en', name); continue; }
      const [r, gg, b] = hex(col), i = (y * w + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
    }
    if (rows.some(r => r.length !== w)) console.warn('GLUP: filas desiguales en', name, rows.map(r => r.length).join(','));
    g.putImageData(img, 0, 0); c.w = w; c.h = h; return c;
  }
  const flipCache = new WeakMap();
  function flip(c) {
    let f = flipCache.get(c); if (f) return f;
    f = canvas(c.width, c.height); const g = f.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
    f.w = c.width; f.h = c.height; flipCache.set(c, f); return f;
  }
  const tintCache = new WeakMap();
  function tint(c, color) {
    let m = tintCache.get(c); if (!m) tintCache.set(c, m = new Map());
    if (m.has(color)) return m.get(color);
    const f = canvas(c.width, c.height), g = f.getContext('2d');
    g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    f.w = c.width; f.h = c.height; m.set(color, f); return f;
  }
  function replaceRows(rows, from, to) { return rows.map(r => r.split(from).join(to)); }

  // ---------------------------------------------------------------- Nila
  // Nila mira a la derecha. Cada pose es un lienzo de 16×22 con los pies en la última fila: la caja
  // de choque (10×18) cae en las columnas 3–12 y la capucha asoma por encima. Las poses se montan
  // por capas (piernas, abrigo, cabeza con su gesto) para que todas compartan la misma cara.
  // Luz desde arriba a la izquierda; sombras hacia el rojo y el violeta, nunca negro puro.
  const NILA = { q: '#2c2a4e', o: '#3b2335', W: '#fff4a8', Y: '#f7c843', y: '#dc8a2c', z: '#9c4f33', s: '#fcdcbc', k: '#e8a37f', p: '#f2847e', e: '#2b1d3e',
    h: '#6e3a36', n: '#a45e3e', r: '#e4473b', R: '#992c42', l: '#ff9e7a', L: '#3d3b66', m: '#a8373f', w: '#ffffff' };
  function paint(w, h, layers) {
    const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill('.'));
    for (const [rows, dx, dy] of layers) rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = r[x], X = x + dx, Y = y + dy; if (ch !== '.' && X >= 0 && X < w && Y >= 0 && Y < h) g[Y][X] = ch === '_' ? '.' : ch; } });
    return g.map(r => r.join(''));
  }
  // Capucha de chubasquero con visera, flequillo castaño asomando y la cara abierta hacia delante.
  const HOOD = [
    '.....oooooo.....',
    '...ooWWWYYYoo...',
    '..oWWYYYYYYYYoo.',
    '.oWYYYYYYYYYYYYo',
    '.oWYYYYYyyyyyyyo',
    'oWYYYYyhhhhhhhho',
    'oYYYYyhhnnhhhnho',
    'oYYYYyhhhshhshso',
    'oYYYYyhssessesso',
    'oYYYyyhssessesso',
    'oyYYyyhkpssmspko',
    '.oyyyyyokkkkkoo.'];
  // Gestos: filas 8–10 de la capucha (ojos, mejillas, boca), columnas 7–14.
  const FACES = {
    calm: ['ssessess', 'ssessess', 'kpssmspk'], blink: ['ssssssss', 'seessees', 'kpssmspk'],
    happy: ['ssessess', 'seseeses', 'kpsmmspk'], hurt: ['sesssses', 'ssessess', 'kesmmsek'],
    oh: ['ssessess', 'ssessess', 'kpsmmspk'], strain: ['ssssssss', 'seessees', 'kpmwwmpk'], shut: ['ssssssss', 'seessees', 'kpsmmspk'] };
  function head(face) { const f = FACES[face]; return HOOD.map((r, i) => i >= 8 && i <= 10 ? r.slice(0, 7) + f[i - 8] + r.slice(15) : r); }
  // Abrigo (filas 12–18) con el brazo de atrás; el de delante sostiene a Bigotes (la mano va aparte).
  const COAT = {
    stand: [
      '....oyyyyyyyo...',
      '...oWYYYYYYYYo..',
      '..oWYoYYYzYYyyo.',
      '.oYYyoYYYYYYyyyo',
      '.oyyyoYYYzYyyyzo',
      'ozzzoskzzzzzzzzo'],
    back: [
      '....oyyyyyyyo...',
      '...oWYYYYYYYYo..',
      '..oWYYYYYzYYyyo.',
      '.ooYYYYYYYYYyyyo',
      'oyYoyYYYYzYyyyzo',
      'oskozzzzzzzzzzzo'],
    fwd: [
      '....oyyyyyyyo...',
      '...oWYYYYYYYYo..',
      '..oWYYoYYzYYyyo.',
      '.oYYYYyoYYYYyyyo',
      '.oyyyyyoYzYyyyzo',
      'ozzzzzzoskzzzzzo'],
    flare: [
      '....oyyyyyyyo...',
      '...oWYYYYYYYYo..',
      '..oWYoYYYzYYyyo.',
      '.oYYyoYYYYYYyyyo',
      'oyyyyoskyzyyyyzo',
      'ozzzzzoozzzzzzzo'],
    reach: [
      '....oyyyyyyyo...',
      '...oWYYYYYYYYo..',
      '..oWYYYYYzYYyyo.',
      '..oYYYYYYYYYyyyo',
      '.oyyyyYYYzYyyyzo',
      '.ozzzzzzzzzzzzzo'] };
  // Piernas con botas de agua rojas; la de atrás, más oscura. Cada una: [x de la bota, cuánto se levanta].
  function legs(back, front) {
    const g = []; for (let y = 0; y < 22; y++) g.push(new Array(16).fill('.'));
    const put = (x, y, ch, soft) => { if (x >= 0 && x < 16 && y >= 0 && y < 22 && (!soft || g[y][x] === '.')) g[y][x] = ch; };
    [[back, 5, true], [front, 9, false]].forEach(([[bx, lift], hip, far]) => {
      const by = 20 - lift, L = far ? 'q' : 'L';
      for (let r = 17; r < by; r++) { const t = (r - 17) / Math.max(1, by - 17), x = Math.round(hip + (bx + 1 - hip) * t); put(x - 1, r, 'o', true); put(x, r, L); put(x + 1, r, L); put(x + 2, r, 'o', true); }
      const top = far ? 'oRrRo' : 'olrro';
      for (let i = 0; i < 5; i++) put(bx + i, by, top[i]); for (let i = 0; i < 6; i++) put(bx + i, by + 1, 'oRRRRo'[i]);
      if (lift) for (let i = 1; i < 5; i++) put(bx + i, by + 2, 'o', true);
    });
    return g.map(r => r.join(''));
  }
  // Mano de atrás apoyada en la pared.
  const PALM = ['.oo', 'osk', 'oYo', 'oYo'];
  // pose(gesto, abrigo, piernas, opciones): hx/hy mueven la cabeza, cx/cy el abrigo (inclinación, rebote);
  // low pone las botas por delante del abrigo (agachada, deslizándose).
  function pose(face, coat, lg, o = {}) {
    const c = [COAT[coat], o.cx || 0, 12 + (o.cy || 0)], layers = o.low ? [c, [lg, 0, 0], [head(face), o.hx || 0, 1 + (o.hy || 0)]] : [[lg, 0, 0], c, [head(face), o.hx || 0, 1 + (o.hy || 0)]];
    if (o.extra) layers.push(...o.extra);
    return sprite(paint(16, 22, layers), NILA, 'nila-' + face + '-' + coat);
  }
  const STAND = legs([3, 0], [8, 0]);
  const nila = {
    idle: [pose('calm', 'stand', STAND), pose('blink', 'stand', STAND), pose('calm', 'stand', STAND, { hy: 1 })],
    // Carrera: contacto, recepción (baja), paso (sube); dos veces con las piernas cambiadas.
    run: [
      pose('calm', 'back', legs([0, 0], [10, 0])),
      pose('calm', 'stand', legs([2, 1], [8, 0]), { hy: 1, cy: 1 }),
      pose('calm', 'fwd', legs([6, 3], [7, 0]), { hy: -1, cy: -1 }),
      pose('calm', 'fwd', legs([10, 0], [0, 0])),
      pose('calm', 'stand', legs([8, 0], [2, 1]), { hy: 1, cy: 1 }),
      pose('calm', 'back', legs([7, 0], [5, 3]), { hy: -1, cy: -1 })],
    jump: pose('oh', 'fwd', legs([4, 3], [8, 2]), { hy: -1, cy: -1 }),
    apex: pose('oh', 'flare', legs([3, 2], [9, 1])),
    fall: pose('oh', 'flare', legs([2, 0], [10, 1]), { hy: 1 }),
    tuck: pose('shut', 'flare', legs([3, 5], [9, 5]), { hy: 4, cy: 2, low: true }),
    skid: pose('strain', 'reach', legs([3, 0], [11, 0]), { hx: -1, cx: -1 }),
    hurt: pose('hurt', 'flare', legs([1, 1], [10, 0]), { hx: -1 }),
    win: pose('happy', 'stand', STAND, { hy: 1 }),
    brace: pose('strain', 'reach', legs([0, 0], [10, 0]), { hx: -1, cx: -1 }),
    spit: pose('shut', 'reach', legs([1, 0], [9, 0]), { hx: -1 }),
    wall: pose('strain', 'back', legs([2, 1], [9, 3]), { extra: [[PALM, 0, 7]] }),
    dangle: [pose('calm', 'flare', legs([3, 0], [8, 1])), pose('calm', 'flare', legs([4, 1], [9, 0]))],
    crouch: pose('calm', 'flare', legs([1, 0], [10, 0]), { hy: 6, cy: 4, low: true }),
    slide: pose('strain', 'flare', legs([0, 0], [11, 1]), { hx: -1, hy: 7, cy: 5, low: true }) };
  // ---------------------------------------------------------------- Bigotes, el pez gato
  // Un bagre joven: lomo oliva moteado, panza crema, cabeza ancha y chata con bocaza, ojos
  // pequeños y separados en lo alto, aleta dorsal corta y cola redonda. Mira a la derecha: la
  // columna 0 es la punta de la cola y la última, la boca. La fila 6 es la espina (drawFish).
  // Los bigotes largos no están aquí: se dibujan aparte para que ondeen con inercia.
  const FISH = { o: '#2b2233', D: '#4a4a2c', B: '#88863a', L: '#b6b04e', T: '#e4d86c', S: '#565430', C: '#fff0b4', c: '#eab66a', F: '#7a5630', f: '#c8944a',
    E: '#1d1826', H: '#ffffff', w: '#e9e2c0', l: '#e4b98a', m: '#5a1f35', t: '#e0707f', k: '#8a3a44' };
  const fishClosed = [
    '......................',
    '..........ooo.........',
    '.........oTfo.........',
    '........oTfFoooooo....',
    '.oo...ooLLLLLLLLLTLoo.',
    'oFfoooLLBBSBBBLLLwHELo',
    'oFfFFoBBBBBSBBBBBwEEBo',
    'oFfFFBBSBBBBBBSBBBBBBo',
    'oFfFFoDBBBBBBBBBBBommo',
    'oFfoooccCCCCCCooCClllo',
    '.oo...oocCCCCoFfocco..',
    '........oFoFo.oo.oo...'];
  const fishRows = (base, map) => base.map((r, i) => map[i] !== undefined ? r.slice(0, 22 - map[i].length) + map[i] : r);
  // Boca abierta de par en par para sorber: un agujero redondo con labios claros.
  const fishOpen = fishRows(fishClosed, { 4: 'LLLLTLooo', 5: 'LLwHEloo.', 6: 'BBwEElmmo', 7: 'BBBBlmmmo', 8: 'BBBBlmmmo', 9: 'CClllmmo.', 10: 'occlooo..' });
  // Llena: carrillos hinchados y panza redonda, los ojos un poco apretados de satisfacción.
  const fishFull = [
    '..........ooo.........',
    '.........oTfooooo.....',
    '........oTfFLLLLLoo...',
    '......ooLLLLLLLLLTLoo.',
    '.oo..oLLBBSBBBLLLwHELo',
    'oFfooBBBBBBSBBBBBwEEBo',
    'oFfFFBBSBBBBBBSBBBBBBo',
    'oFfFFoDBBBBBBBBBBBBmmo',
    'oFfFoocCCCCCCCCCCCClko',
    'oFfo.occCCCCCooCCCCco.',
    '.oo...oocCCCoFfocccoo.',
    '........oooo.oo.ooo...'];
  const fishSpit = fishRows(fishClosed, { 4: 'LLLLTLooo', 5: 'LLwwwloo.', 6: 'BBEEElttmo', 7: 'BBBBltttmo', 8: 'BBBBlmtmo', 9: 'CClllmmo.', 10: 'occlooo..' });
  const fishFullOpen = fishRows(fishFull, { 3: 'LLLTLLooo', 4: 'LLwHEloo.', 5: 'BBwEElmmo', 6: 'BBBBlmmmo', 7: 'BBBBlmmmo', 8: 'CCCClmmo.', 9: 'CCCClooo.', 10: 'cccoo....' });
  const fishTail = fishClosed;
  const fishSquint = fishFull.map((r, i) => i === 4 ? r.replace('wHE', 'www') : i === 5 ? r.replace('wEE', 'EEE') : r);
  const fish = { blink: sprite(fishClosed.map((r, i) => i === 5 ? r.replace('wHE', 'www') : i === 6 ? r.replace('wEE', 'EEE') : r), FISH, 'fish-blink'), tail: sprite(fishTail, FISH, 'fish-tail'), squint: sprite(fishSquint, FISH, 'fish-squint'), closed: sprite(fishClosed, FISH, 'fish'), open: sprite(fishOpen, FISH, 'fish-open'), full: sprite(fishFull, FISH, 'fish-full'), spit: sprite(fishSpit, FISH, 'fish-spit'), swallow: sprite(fishFullOpen, FISH, 'fish-swallow') };
  // La mano de Nila por encima del lomo de Bigotes: puño de manga amarilla y dedos que lo agarran.
  const hand = sprite(['.ooo..', 'oWYYo.', 'oYyyso', '.oksko', '..ooo.'], NILA, 'hand');

  // ---------------------------------------------------------------- Enemigos
  // Caracol: mira a la izquierda (walkerDraw lo voltea al ir a la derecha). Concha en espiral
  // con el surco más oscuro, pie baboso y ojos en antenas.
  const SNAIL = { o: '#3a2230', S: '#d98a48', s: '#a4563a', d: '#6e3440', L: '#f7c47a', B: '#a6cf6e', b: '#6a9a52', k: '#3f6a4a', E: '#231a2a', W: '#ffffff', p: '#e89a8a', m: '#6a2a3a' };
  const snailShell = [
    '...oooo...',
    '.ooLLSSoo.',
    'oLLSSSSSso',
    'oLSddddSso',
    'oSdSLLdSso',
    'oSdSdsdSso',
    'oSdSSSdsso',
    '.osddddso.',
    '..oooooo..'];
  const SNAIL_BODY = [
    '.oo..oo.........',
    'oEWooEWo........',
    'oWWooWWo........',
    '.oo..oo.........',
    '..ob..ob........',
    '..ob.ob.........',
    '.oBBBBBo........',
    'oBBBBBBBo.......',
    'oBBBBBBBBo......',
    'oBpmBBBBBBoooooo',
    'obBBBBBBBBBBBBBo',
    '.oooooooooooooo.'];
  function snailBody(lower, foot) {
    const rows = SNAIL_BODY.slice(); if (lower) rows.splice(0, 5, '................', SNAIL_BODY[0], SNAIL_BODY[1], SNAIL_BODY[2], '..obob..........');
    if (foot) rows[11] = foot; return paint(16, 12, [[rows, 0, 0], [snailShell, 6, 1]]);
  }
  const snail = [sprite(snailBody(0), SNAIL, 'snail'), sprite(snailBody(1, 'ookoookooookooo.'), SNAIL, 'snail2')];
  // Rana: ojos saltones arriba, papada crema, mofletes. Mira a la derecha.
  const FROG = { o: '#1f3328', G: '#6cc24a', g: '#3c8a4a', d: '#2a5e44', L: '#b8ea7a', W: '#f2f2c4', w: '#c9d49a', E: '#1d1a26', H: '#ffffff', m: '#6a2a3a', p: '#f09a8a' };
  const frogTop = [
    '..ooo...ooo...',
    '.oHHEo.oHHEo..',
    '.oHEEoooHEEoo.',
    'oLLGoGGGGoGGGo',
    'oLGGGGGGGGGGGo',
    'oGGGGGGGGGpGmo',
    'ogGGGGGGmmmmGo',
    'ogGWWWWWWWWGgo'];
  const frogSit = sprite(frogTop.concat([
    'oggwWWWWWWwgGo',
    'oGGgoddddoGgGo',
    '.ooo.oooo.ooo.']), FROG, 'frog');
  const frogJump = sprite(frogTop.concat([
    '.oGwwWWWWwwGo.',
    '.oGodddddoGgo.',
    '.oGo.oooo.oGo.',
    '.ogo......ogo.',
    'oggo......oggo',
    'oooo......oooo']), FROG, 'frog-jump');
  // Mosquito: alas translúcidas, abdomen a rayas, ojo rojo y trompa afilada. Mira a la derecha.
  const MOSQ = { o: '#2a2438', B: '#9a8ab8', b: '#5c4e7a', W: '#e4f2fa', w: '#9fc0d8', E: '#ff5a4a', e: '#ffd0a0', P: '#4a3a5a' };
  const mosquito = [sprite([
    '...ww.......',
    '..wWWw......',
    '..wWWWw.....',
    '...wWWw.....',
    'oo..wwoooo..',
    'obBbBoBBBEo.',
    '.oobbobBBoPP',
    '..oo.oooo..P',
    '.o..o..o.o..'], MOSQ, 'mosq'), sprite([
    '............',
    '............',
    '............',
    '.wwww.......',
    'owWWWwoooo..',
    'obWWWwBBBEo.',
    '.oowwobBBoPP',
    '..oo.oooo..P',
    '..o.o..o..o.'], MOSQ, 'mosq2')];
  // Cangrejo: pinzas en alto, ojos en pedúnculo, caparazón con brillo arriba a la izquierda.
  const CRAB = { o: '#4a1a2a', R: '#e0583e', r: '#a8303a', d: '#6e2238', L: '#ffa070', E: '#1d1a26', H: '#ffffff' };
  const crabRows = [
    '......oo..oo......',
    '.....oHEooHEo.....',
    '.ooo..oo..oo..ooo.',
    'oLRRo.oo..oo.oLRRo',
    'oRooRooooooooRooRo',
    'oRRRRoLLRRRRoRRRro',
    '.oorRLLRRRRRRRroo.',
    '..orRRRRRRRRRRrro.',
    '..oo.orrddrro.oo..',
    '.o..o.o....o.o..o.'];
  const crab = [sprite(crabRows, CRAB, 'crab'), sprite(crabRows.map((r, i) => i === 4 ? 'oRRRRooooooooRRRRo' : i === 8 ? '..o.oorrddrroo.o..' : i === 9 ? '..o..o.o..o.o..o..' : r), CRAB, 'crab2')];

  // ---------------------------------------------------------------- La Garza (jefa)
  // Garza real: gris azulado con sombras hacia el violeta, cuello blanco con rayas oscuras, penacho
  // negro, ojo amarillo que no parpadea y pico largo. Mira a la izquierda.
  const HERON = { o: '#23202e', G: '#8196b0', g: '#5a6488', L: '#b9c9da', W: '#f2efe8', w: '#c9c3cc', k: '#3a3d56', K: '#2a2638', Y: '#f0c444', y: '#b8782a', E: '#ffd23a', e: '#1d1a26' };
  // Plumas: puntas oscuras (primarias) y vetas que siguen la forma del ala.
  const feather = tip => (r, y) => r.replace(/G/g, (ch, x) => tip(x, y) ? 'k' : y % 3 === 2 && x % 3 !== 0 ? 'g' : 'G');
  const heronHead = [
    '...........ooooo................',
    '..........oLLGGGoKKo............',
    '.........oLLGKKGGoKKKo..........',
    'oooooooooLGeEGGGGGooKKKo........',
    'YYYYYYYYYoGGGGGGGGGo.oKKo.......',
    'yyyyyyyyyoGGWWWGGGo...ooo.......',
    'ooooooooooGWWWWGGo..............'];
  const heronBody = sprite(heronHead.concat([
    '..........oWkWWGGo..............',
    '..........oWWkWGo...............',
    '...........oWkWGo...............',
    '...........oWWkGo...............',
    '..........oWkWWGGo..............',
    '..........oWWkWGGGoooo..........',
    '...........oWWWGLLLGGGoooo......',
    '...........oWWWGLGGLLGGGGGooo...',
    '............oWWGLGgGGgGGGGGGGoo.',
    '............oWWGGgGGgGGgGGGGGGGo',
    '............oWWWGGgGGgGGgGgggGo.',
    '.............oWWWGGgGGgGgggkko..',
    '.............oWWWWGGgGgggkkko...',
    '..............oWWWWGGgggkkoo....',
    '...............owWWWGGGgoo......',
    '................oowwWooo........',
    '..................oooo..........',
    '..................yy.y..........',
    '..................yy.y..........',
    '..................yy.y..........',
    '..................yy.y..........',
    '.................oyyoyy.........',
    '................oyyyoyyy........']), HERON, 'heron');
  const heronFly = sprite(heronHead.concat([
    '..........oWkWGGGo..............',
    '..........oWWkGGGGoooo..........',
    '..........oWWWGLLLGGGGoooo......',
    '..........oWWWWGLGGLLGGGGGooo...',
    '...........oWWWGLGgGGgGGGGGGGoo.',
    '...........oWWWGGgGGgGGgGGGGGGGo',
    '...........oWWWWGGgGGgGGgGgggGo.',
    '............oWWWWGGgGGgGgggkko..',
    '............oWWWWWGGgGgggkkko...',
    '.............owWWWWGGgggkkoo....',
    '..............owwWWWGGGgoo......',
    '...............oowwWWooo........',
    '.................ooooo..........',
    '..................yyy...........',
    '...................yyy..........',
    '....................yyy.........',
    '.....................yyy........']), HERON, 'heron-fly');
  const wingUp = sprite([
    '......................oo....',
    '....................ooGGo...',
    '..................ooGGGGo...',
    '................ooGGGGGGo...',
    '..............ooGGGGGGGGo...',
    '............ooGGGGGGGGGgo...',
    '..........ooGGGGGGGGGGggo...',
    '........ooGGGGGGGGGGGGggo...',
    '......ooGGGGGGGGGGGGGgggo...',
    '....ooGGGGGGGGGGGGGGggggo...',
    '..ooGGGGGGGGGGGGGGGGggggo...',
    'ooGGGGGGGGGGGGGGGGGGggggo...',
    'oggggggggggggggggggggggo....',
    '.ooooooooooooooooooooooo....'].map(feather((x, y) => y < 5)), HERON, 'wing-up');
  const wingDown = sprite([
    'ooooooooooooooooooooooo.....',
    'oGGGGGGGGGGGGGGGGGGGGGGo....',
    '.oggGGGGGGGGGGGGGGGGGGGGo...',
    '...ooggGGGGGGGGGGGGGGGGGo...',
    '.....ooggGGGGGGGGGGGGGGGo...',
    '.......ooggGGGGGGGGGGGGGo...',
    '.........ooggGGGGGGGGGGgo...',
    '...........ooggGGGGGGGGgo...',
    '.............ooggGGGGGGgo...',
    '...............ooggGGGGgo...',
    '.................ooggGGgo...',
    '...................ooggo....',
    '.....................oo.....'].map(feather((x, y) => y > 8)), HERON, 'wing-down');
  const wingMid = sprite([
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    'ooooooooooooooooooooooooo.....',
    'oGGGGGGGGGGGGGGGGGGGGGGGGo....',
    'oLGGGGGGGGGGGGGGGGGGGGGGGGo...',
    '.oggGGGGGGGGGGGGGGGGGGGGggo...',
    '..ooooggggggggggggggggggggo...',
    '......oooooooooooooooooooo....',
    '..............................',
    '..............................',
    '..............................'].map(feather((x, y) => x < 7)), HERON, 'wing-mid');
  // Huevo de garza: azul verdoso pálido con motas.
  const egg = sprite(['..oo..', '.oWLo.', 'oWWLLo', 'oWLsLo', 'oLLllo', '.olso.', '..oo..'], { o: '#34425a', W: '#eefaf4', L: '#b8dcd4', l: '#80aab0', s: '#5e8088' }, 'egg');

  // ---------------------------------------------------------------- Objetos
  const WOOD = { o: '#4a2e1a', W: '#c78d4e', w: '#a56f38', L: '#e0a862', P: '#6b4a30', T: '#5a3a24' };
  const crate = sprite([
    'oooooooooooooo',
    'oWWWWWWWWWWWWo',
    'oWwwwwwwwwwwWo',
    'oWwLwwwwwwLwWo',
    'oWwwLwwwwLwwWo',
    'oWwwwLwwLwwwWo',
    'oWwwwwLLwwwwWo',
    'oWwwwwLLwwwwWo',
    'oWwwwLwwLwwwWo',
    'oWwwLwwwwLwwWo',
    'oWwLwwwwwwLwWo',
    'oWwwwwwwwwwwWo',
    'oWWWWWWWWWWWWo',
    'oooooooooooooo'], WOOD, 'crate');
  const rock = sprite([
    '....oooo....',
    '..ooLLSSoo..',
    '.oLLLSSSSSo.',
    'oLLSSSSSSsso',
    'oLSSSSSSSsso',
    'oSSSSSSssSso',
    'oSSSSsssssso',
    '.osssssssso.',
    '..oossssoo..',
    '....oooo....'], { o: '#2e2f3a', S: '#7d8290', s: '#565a68', L: '#a6abb8' }, 'rock');
  // Las crías de pez gato que la Garza escupió por el pantano, cada una en su burbuja: un Bigotes
  // en miniatura (lomo oliva, panza crema, ojito y bigotes) dentro de una pompa con brillo.
  const CRIA = { c: '#a8dcea', d: '#5f9ab8', W: '#ffffff', B: '#8a7d45', b: '#665a36', C: '#f4e1a4', E: '#1d1826', F: '#e0a45a' };
  const criaRows = [
    ['..ccccc..', '.cW....c.', 'cW......c', 'c..BBB..c', 'cbBBBBEBc', 'c.bCCCCFd', 'c.....F.d', '.c.....d.', '..cccdd..'],
    ['..ccccc..', '.c.W...c.', 'c.W.....c', 'c..BBB..c', 'c.bBBBEBc', 'cb.CCCCFd', 'c......Fd', '.c.....d.', '..cccdd..'],
    ['..ccccc..', '.c.....c.', 'c.W.BBB.c', 'cW.BBBEBc', 'c.bBCCCFd', 'c..bCC.Fd', 'c.......d', '.c.....d.', '..cccdd..']];
  const cria = criaRows.map((r, i) => sprite(r, CRIA, 'cria' + i));
  const criaFree = [sprite(['...BB...', 'bBBBBBE.', '.bCCCCCF', '......F.'], CRIA, 'cria-free'), sprite(['...BB...', '.bBBBBE.', 'b.CCCCCF', '.....F..'], CRIA, 'cria-free2')];
  // Ruca, la tortuga vieja del pantano: concha con musgo y escudos marcados, cejas blancas,
  // párpados caídos y mucha paciencia. Mira a la derecha.
  const RUCA = { o: '#24301f', S: '#7a8a44', s: '#56663a', d: '#3c4a34', L: '#a8b85e', M: '#9ac25a', H: '#d8c47a', h: '#a8904e', K: '#a8b47a', k: '#7a8458', E: '#1d1a26', W: '#fffbe8', q: '#5a2a2a', r: '#c9463a' };
  const rucaRows = [
    '.......oooooo...........',
    '.....ooMMMMMMoo.........',
    '....oMMLSdSSSMMo...oooo.',
    '...oLLSSSdSSSSdSo.oWWWKo',
    '..oLSSSSddddSSdSSooKkkKo',
    '..oSSddSdSSSdddSSooKEEKo',
    '.oSSSSSdSSSSSdSSSooKKqqo',
    '.oHHHhHHHhHHHHhHHHoKKoo.',
    'oKKohhhhhhhhhhhhhooKo...',
    'oKKKo.oKKo...oKKo.oo....',
    '.ooo..oooo...oooo.......'];
  const ruca = { idle: sprite(rucaRows, RUCA, 'ruca'),
    blink: sprite(rucaRows.map((r, i) => i === 5 ? r.replace('oKEEKo', 'oKkkKo') : r), RUCA, 'ruca-blink'),
    talk: sprite(rucaRows.map((r, i) => i === 6 ? r.replace('KKqqo', 'Kqrqo') : i === 7 ? r.replace('oKKoo.', 'oKqro.') : r), RUCA, 'ruca-talk') };
  const bubble = sprite(['.ooooooo.', 'oWWWWWWWo', 'oWkWkWkWo', 'oWWWWWWWo', '.oooWWoo.', '....oWo..', '.....o...'], { o: '#1b2430', W: '#fff6d6', k: '#1b2430' }, 'bubble');
  const heart = sprite(['.oo...oo.', 'oRRo.oRRo', 'oRHRoRRRo', 'oRRRRRRRo', '.oRRRRRo.', '..oRRRo..', '...oRo...', '....o....'], { o: '#4a1a2a', R: '#e2445a', H: '#ffb0bd' }, 'heart');
  const heartEmpty = sprite(['.oo...oo.', 'oddo.oddo', 'oddodrddo', 'odddddddo', '.oddddDo.', '..odddo..', '...odo...', '....o....'], { o: '#2a1a24', d: '#3f2f3a', r: '#4a3644', D: '#4a3644' }, 'heart-empty');
  const lanternRows = [
    '....oo....',
    '...oYYo...',
    '..oyyyyo..',
    '..oGGGGo..',
    '..oGLLGo..',
    '..oGLLGo..',
    '..oGGGGo..',
    '..oyyyyo..',
    '....oo....',
    '....oo....',
    '...oPPo...',
    '...oPPo...',
    '...oPPo...',
    '...oPPo...',
    '...oPPo...',
    '...oPPo...',
    '..ooPPoo..',
    '..oooooo..'];
  const lantern = { off: sprite(lanternRows, { o: '#2f2320', Y: '#b98a3a', y: '#8a6428', G: '#3c4652', L: '#55606e', P: '#6b4a30' }, 'lantern'),
    on: sprite(lanternRows, { o: '#2f2320', Y: '#b98a3a', y: '#8a6428', G: '#ffcf5a', L: '#fff2b8', P: '#6b4a30' }, 'lantern-on') };
  const sign = sprite([
    'oooooooooooooo',
    'oWWWWWWWWWWWWo',
    'oWwwwwwwwwwwWo',
    'oWwTTTTTTTTwWo',
    'oWwwwwwwwwwwWo',
    'oWwTTTTTTwwwWo',
    'oWwwwwwwwwwwWo',
    'oWWWWWWWWWWWWo',
    'oooooooooooooo',
    '.....oPPo.....',
    '.....oPPo.....',
    '.....oPPo.....'], WOOD, 'sign');
  const boat = sprite([
    '.............oo.................',
    '............oYYo................',
    '............oyyo................',
    '.............oo.................',
    '.............oo.................',
    'oo...........oo...............oo',
    'oWWooooooooooooooooooooooooooWWo',
    '.oWWWWWWWWWWWWWWWWWWWWWWWWWWWWo.',
    '..oWwwwwwwwwwwwwwwwwwwwwwwwwWo..',
    '...oWwwwwwwwwwwwwwwwwwwwwwwWo...',
    '....oowwwwwwwwwwwwwwwwwwwwoo....',
    '......oooooooooooooooooooo......'], { o: '#3a2416', W: '#c78d4e', w: '#a56f38', Y: '#ffcf5a', y: '#e2a63c' }, 'boat');
  const mushroom = sprite([
    '....oooooooo....',
    '..ooRRRRWRRRoo..',
    '.oRRWRRRRRRRRRo.',
    'oRRRRRRRRWRRRRRo',
    'oRWRRRRRRRRRRWRo',
    'oooooooooooooooo',
    '....oWWWWWWo....',
    '....oWwwwwWo....',
    '....oWwwwwWo....',
    '....oooooooo....'], { o: '#3a1f2a', R: '#d95a4a', W: '#f6e6c8', w: '#cfb99a' }, 'mushroom');
  const mushroomSquash = sprite([
    '..oooooooooooo..',
    '.oRRWRRRRRWRRRo.',
    'oRWRRRRRWRRRRRRo',
    'oooooooooooooooo',
    '...oWWWWWWWWo...',
    '...oooooooooo...'], { o: '#3a1f2a', R: '#d95a4a', W: '#f6e6c8', w: '#cfb99a' }, 'mushroom-squash');
  const thorns = sprite([
    '..o.....o....o..',
    '.oTo...oTo..oTo.',
    '.oTo.o.oTo.ooTo.',
    'oTTToTToTTToTTTo',
    'oTTtTTtTTTtTTTto',
    'oTtTTtTTtTtTTTto',
    '.oTTTTTTTTTTTTo.',
    '..oooooooooooo..'], { o: '#1e2a1a', T: '#4c7a3a', t: '#2f5226' }, 'thorns');
  const gateRows = ['oooooooooooooooo'];
  for (let i = 1; i < 15; i++) gateRows.push(i === 3 || i === 12 ? 'oWWWWWWWWWWWWWWo' : 'oWwoWwoWwoWwoWwo');
  gateRows.push('oooooooooooooooo');
  const gate = sprite(gateRows, WOOD, 'gate');
  const targetRows = [
    'oooooooooooooooo',
    'oWwwwwwwwwwwwwWo',
    'oWwwwwooooowwwWo',
    'oWwwooRRRRRoowWo',
    'oWwoRRRWWWRRRowo',
    'oWwoRRWWWWWRRowo',
    'oWwoRRWWRWWRRowo',
    'oWwoRRWWWWWRRowo',
    'oWwoRRRWWWRRRowo',
    'oWwwooRRRRRoowWo',
    'oWwwwwooooowwwWo',
    'oWwwwwwwwwwwwwWo',
    'oWWWWWWWWWWWWWWo',
    'oooooooooooooooo',
    '.....oPPPPo.....',
    '.....oPPPPo.....'];
  const target = { off: sprite(targetRows, Object.assign({ R: '#d9503a' }, WOOD, { W: '#f6e6c8' }), 'target'),
    on: sprite(targetRows.map(r => r.replace(/[RW]/g, ch => ch === 'R' ? 'G' : 'L')), Object.assign({ G: '#6cbf4e', L: '#d8f0b8' }, WOOD), 'target-on') };
  const lily = sprite([
    '....oooooooo....',
    '..ooGGGGGGGGoo..',
    '.oGGgGGGGGGGgGGo',
    'oGGGGGGGgGGGGGGo',
    '.oggggggggggggo.',
    '..oooooooooooo..'], { o: '#1f3a2a', G: '#5fae5a', g: '#3f8a44' }, 'lily');
  const plank = sprite([
    'oooooooooooooooo',
    'oWWWWWWWWWWWWWWo',
    'oWwwwwwwwwwwwwWo',
    'oowwowwwwowwwwoo',
    'oooooooooooooooo',
    '.o.o........o.o.'], WOOD, 'plank');
  const puff = [sprite(['.ww.', 'wWWw', 'wWWw', '.ww.'], { w: '#b9c8d4', W: '#eef3f6' }, 'puff'), sprite(['..ww..', '.wWWw.', 'wWWWWw', 'wWWWWw', '.wWWw.', '..ww..'], { w: '#b9c8d4', W: '#eef3f6' }, 'puff2')];
  const star = sprite(['.o.', 'ooo', '.o.'], { o: '#fff2b8' }, 'star');
  const drop = sprite(['..oo..', '.oWLo.', 'oWWLLo', 'oLLLlo', '.oLlo.', '..oo..'], { o: '#1d4a55', W: '#e8fbff', L: '#8fd9d0', l: '#2f7f88' }, 'drop');
  const FIRE = { o: '#5a1a0a', R: '#d9503a', O: '#f28b2a', Y: '#ffd34a', W: '#fff3b0', k: '#2a1a14', g: '#4a3a2a' };
  const fire = [sprite([
    '.......Y........',
    '......YY....Y...',
    '.....OYY...Y....',
    '....OOYY..OY....',
    '...ROOYYY.OOY...',
    '..RROOYYYROOYY..',
    '..RROOYYYROOYYR.',
    '.RRROOYYYROOYYR.',
    '.RRROOOYYYOOOYRR',
    'RRRROOOYYYOOORRR',
    'RRRRROOOOOOORRRR',
    '.RRRRROOOOORRRR.',
    '..RRRRRRRRRRRR..',
    '.ggkkgkkgkkgkkgg',
    'gkkggkkgkkgkkgkk',
    '.ggggggggggggg..'], FIRE, 'fire'), sprite([
    '....Y...........',
    '....YY.....Y....',
    '...OYY....YY....',
    '...OOYY..OYY....',
    '..ROOYY.ROOY....',
    '..ROOYYYROOYY...',
    '.RROOYYYROOYYR..',
    '.RROOOYYYOOYYRR.',
    'RRROOOYYYOOOYRRR',
    'RRRROOOYYYOOORRR',
    'RRRRROOOOOOORRRR',
    '.RRRRROOOOORRRR.',
    '..RRRRRRRRRRRR..',
    '.ggkkgkkgkkgkkgg',
    'gkkggkkgkkgkkgkk',
    '.ggggggggggggg..'], FIRE, 'fire2')];
  const ash = sprite(['.kk.', 'kggk', 'kggk', '.kk.'], { k: '#2a1a14', g: '#4a3a2a' }, 'ash');
  const ring = sprite([
    '....oo....',
    '....oo....',
    '...oMMo...',
    '..oMLLMo..',
    '.oMLooLMo.',
    '.oMo..oMo.',
    '.oMLooLMo.',
    '..oMmmMo..',
    '...oMMo...',
    '....oo....'], { o: '#2a2418', M: '#b98a3a', L: '#e6c46a', m: '#8a6428' }, 'ring');
  const PLATE = { o: '#2e2f3a', S: '#7d8290', s: '#565a68', L: '#a6abb8', R: '#d9503a', G: '#6cbf4e' };
  const plate = { off: sprite(['..oooooooooooo..', '.oLLLLLLLLLLLLo.', '.oSSSRRRRRRSSSo.', 'oosssssssssssso.', 'oooooooooooooooo'], PLATE, 'plate'),
    on: sprite(['................', '................', '..oooooooooooo..', 'ooLLGGGGGGGGLLoo', 'oooooooooooooooo'], PLATE, 'plate-on') };
  const PIN = { o: '#3a2416', P: '#6b4a30', p: '#4a3020', W: '#e8f0c8', w: '#c8d0a8', R: '#d95a4a', Y: '#f2c53d', B: '#5fae5a' };
  const pinwheel = [sprite([
    '.......oo.......',
    '..oo..oWWo..oo..',
    '.oRRo.oWWo.oYYo.',
    '.oRRRooWWooYYYo.',
    '..oRRRoWWoYYYo..',
    '...ooRRWWYYoo...',
    'ooooooWWWWoooooo',
    'oBBBBBWWWWRRRRRo',
    'oBBBBBWWWWRRRRRo',
    'ooooooWWWWoooooo',
    '...ooYYWWBBoo...',
    '..oYYYoWWoBBBo..',
    '.oYYYooWWooBBBo.',
    '.oYYo.oWWo.oBBo.',
    '..oo..oPpo..oo..',
    '......oPpo......'], PIN, 'pinwheel'), sprite([
    'oo.....oo.....oo',
    'oRRo..oWWo..oYYo',
    'oRRRo.oWWo.oYYYo',
    '.oRRRooWWooYYYo.',
    '..oRRRoWWoYYYo..',
    '...ooRRWWYYoo...',
    '....ooWWWWoo....',
    '...oBBWWWWRRo...',
    '...oBBWWWWRRo...',
    '....ooWWWWoo....',
    '...ooYYWWBBoo...',
    '..oYYYoWWoBBBo..',
    '.oYYYooWWooBBBo.',
    'oYYYo.oWWo.oBBBo',
    'oYYo..oPpo..oBBo',
    'oo....oPpo....oo'], PIN, 'pinwheel2')];
  const hard = sprite([
    'oooooooooooooooo',
    'oLLLLLsLLLLLLLLo',
    'oLSSSsSSSSSsSSSo',
    'oMMMMMMMMMMMMMMo',
    'oLSsSSSSSSsSSSSo',
    'oSsSSSSSSSsSSSSo',
    'oSSsSSSSSsSSSSSo',
    'oSSSsSSSsSSSSSSo',
    'oSSSSsSsSSSSSSSo',
    'oSSSSSsSSSSSSSSo',
    'oSSSSSSsSSSSSSSo',
    'oSSSSSSSsSSSSSSo',
    'oMMMMMMMMMMMMMMo',
    'oSSSSSSSSSsSSSSo',
    'osssssssssssssso',
    'oooooooooooooooo'], { o: '#2b2f38', S: '#6f747c', s: '#3f444c', L: '#8d9299', M: '#b98a3a' }, 'hard');
  const raft = sprite([
    '.oooooooooooooooooooooo.',
    'oWwWwWwWwWwWwWwWwWwWwWwo',
    'oWWWWWWWWWWWWWWWWWWWWWWo',
    'oPwwwwwwwwwwwwwwwwwwwwPo',
    'oPPPPPPPPPPPPPPPPPPPPPPo',
    '.oooooooooooooooooooooo.',
    '..oPPo..........oPPo....',
    '..oooo..........oooo....'], { o: '#3a2416', W: '#c78d4e', w: '#a56f38', P: '#6b4a30' }, 'raft');
  function cloudLayer(color, seed) {
    const c = canvas(480, 50), g = c.getContext('2d'), r = rng(seed); g.fillStyle = color;
    for (let i = 0; i < 6; i++) { const x = (r() * 480) | 0, y = 6 + (r() * 30) | 0, w = 30 + (r() * 50) | 0; for (let k = 0; k < 5; k++) { const bw = (w * (0.4 + r() * 0.6)) | 0, bh = 3 + (r() * 5) | 0; g.fillRect(x + ((r() * w) | 0) - bw / 2, y + k * 2 - bh / 2, bw, bh); } }
    return c;
  }
  // Storm clouds: a low, heavy bank with lighter bellies, tiled sideways.
  function stormLayer(seed) {
    const c = canvas(480, 64), g = c.getContext('2d'), r = rng(seed);
    const blob = (x, y, rad, col) => { g.fillStyle = col; for (let dy = -rad; dy <= rad; dy++) { const hw = Math.round(Math.sqrt(rad * rad - dy * dy)); for (const dx of [-480, 0, 480]) g.fillRect(x - hw + dx, y + dy, hw * 2, 1); } };
    const clouds = []; for (let i = 0; i < 14; i++) clouds.push({ x: (r() * 480) | 0, y: 8 + (r() * 22) | 0, n: 3 + (r() * 4) | 0, rad: 7 + (r() * 7) | 0 });
    for (const pass of [['#1c2430', 2], ['#10151d', 0]]) for (const cl of clouds) for (let k = 0; k < cl.n; k++) { const rr = r(); blob(cl.x + k * cl.rad, cl.y + pass[1] + ((rr * 4) | 0), Math.round(cl.rad * (.7 + rr * .5)), pass[0]); }
    g.fillStyle = '#10151d'; g.fillRect(0, 0, 480, 12);
    return c;
  }
  // The old flooded mill on the horizon; its sails are drawn live so they turn in the wind.
  function millLayer() {
    const c = canvas(40, 70), g = c.getContext('2d');
    g.fillStyle = '#0d1219'; for (let y = 0; y < 52; y++) { const hw = 6 + (y * 7 / 52) | 0; g.fillRect(20 - hw, 18 + y, hw * 2, 1); }
    g.fillRect(12, 14, 16, 5); g.fillRect(14, 11, 12, 3); g.fillRect(17, 9, 6, 2);
    g.fillStyle = '#f2c46a'; g.fillRect(18, 40, 3, 4); g.fillStyle = '#8a6a3a'; g.fillRect(18, 44, 3, 1);
    return c;
  }
  const mossWall = sprite([
    'dDdgDdDDdgDdDDdd',
    'DdgDDdgDDdgDDdgD',
    'dDgdDvDdgDdDvDdD',
    'DDdDvdDdDdDvdDdD',
    'dgDdvDdgDgDvDdgd',
    'DdDdvDDdDdDvDDdD',
    'DDgdvdgDdgdvdDDd',
    'dDdDvDDdDDDvDgDd',
    'DgDdvdDgDdDvdDdD',
    'dDdDvDdDdgDvDdDd',
    'DDdgvDDdDDdvDDgD',
    'dgDdvdDgdDDvdDdD',
    'DdDDvDdDDgDvDDdD',
    'dDgdvDgdDdDvDdgd',
    'DDdDvdDDdDdvdDdD',
    'dgDdDdgDdgDDDdgd'], { d: '#4a3222', D: '#5a3d28', g: '#5e8a2e', v: '#3f7a2a' }, 'mosswall');
  // Bocados: what Bigotes eats to learn each trick.
  const morsels = {
    soplido: sprite(['...W....', '.W.W.W..', '..WWW...', 'WWWgWWW.', '..WWW...', '.W.g.W..', '...g....', '...g....'], { W: '#f4f6f8', g: '#9ab06a' }, 'vilano'),
    aleteo: sprite(['..oo....', '.oYYo...', 'oYWWYo..', 'oYWYYo..', '.oYYo.o.', '..oo.o..', '..k.k...', '...k....'], { o: '#6a5a1a', Y: '#ffe36a', W: '#fffbd0', k: '#3a2a14' }, 'luciernaga'),
    ventosa: sprite(['...oo...', '..oSLo..', '.oSSSLo.', 'oSsSSSLo', 'oSsssSSo', 'oPPPPPPo', '.oPpPpo.', '..oooo..'], { o: '#3a2a22', S: '#c8a06a', s: '#94714a', L: '#f0d8a0', P: '#d98a8a', p: '#b06060' }, 'lapa'),
    chorro: sprite(['...oo...', '..oBBo..', '.oBLLBo.', 'oBLWWLBo', 'oBBLLBBo', '.oGGGGo.', '..oGGo..', '...oo...'], { o: '#1f3a5a', B: '#4a7fd0', L: '#8ab8ff', W: '#e8f4ff', G: '#5fae5a' }, 'nenufar'),
    mordisco: sprite(['...oo...', '..oMo...', '..oMo...', '..oMo...', '..oMo.o.', '..oMooMo', '...oMMo.', '....oo..'], { o: '#2a2418', M: '#b8b0a0' }, 'anzuelo'),
    panzazo: sprite(['..oooo..', '.oLLSSo.', 'oLLSSSSo', 'oLSSSSso', 'oSSSSsso', 'oSSsssso', '.osssso.', '..oooo..'], { o: '#2e2f3a', S: '#7d8290', s: '#565a68', L: '#a6abb8' }, 'canto'),
    guindilla: sprite(['.....gg.', '....og..', '...oRo..', '..oRRo..', '..oRRo..', '.oRRo...', '.oRo....', '.oo.....'], { o: '#4a1a1a', R: '#e0402a', g: '#5fae5a' }, 'guindilla'),
    resbalon: sprite(['.G......', 'G.G..G..', '.GG.G.G.', '..GGG...', '.GgGgG..', 'GgGGGgG.', '.GGgGG..', '..GGG...'], { G: '#5fae5a', g: '#2f7f88' }, 'alga') };
  const cracked = sprite([
    'oooooooooooooooo',
    'oLLLLLsLLLLLLLLo',
    'oLSSSsSSSSSsSSSo',
    'oLSSsSSSSSSsSSSo',
    'oLSsSSSSSSsSSSSo',
    'oSsSSSSSSSsSSSSo',
    'oSSsSSSSSsSSSSSo',
    'oSSSsSSSsSSSSSSo',
    'oSSSSsSsSSSSSSSo',
    'oSSSSSsSSSSSSSSo',
    'oSSSSSSsSSSSSSSo',
    'oSSSSSSSsSSSSSSo',
    'oSSSSSSSSsSSSSSo',
    'oSSSSSSSSSsSSSSo',
    'osssssssssssssso',
    'oooooooooooooooo'], { o: '#3b3f45', S: '#8a8f94', s: '#4f545a', L: '#a9aeb3' }, 'cracked');

  // ---------------------------------------------------------------- Tierra, hierba y agua
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const GROUND = { dirt: '#5a3d28', dark: '#4a3222', light: '#6b4a30', root: '#3e2a1c', stone: '#7a6a58', grass: '#7fb040', grassDark: '#5e8a2e', grassLight: '#a3cf52' };
  function dirtTile(seed) {
    const c = canvas(16, 16), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = GROUND.dirt; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 22; i++) { g.fillStyle = r() < .55 ? GROUND.dark : GROUND.light; g.fillRect((r() * 16) | 0, (r() * 16) | 0, 1 + (r() < .3 ? 1 : 0), 1); }
    if (r() < .5) { g.fillStyle = GROUND.stone; const x = 2 + (r() * 10) | 0, y = 3 + (r() * 9) | 0; g.fillRect(x, y, 3, 2); g.fillStyle = GROUND.dark; g.fillRect(x, y + 2, 3, 1); }
    if (r() < .5) { g.fillStyle = GROUND.root; const x = 1 + (r() * 12) | 0, y = 1 + (r() * 10) | 0; g.fillRect(x, y, 1, 4); g.fillRect(x + 1, y + 3, 1, 2); g.fillRect(x - 1, y + 1, 1, 1); }
    return c;
  }
  const dirt = [1, 2, 3, 4].map(dirtTile);
  const grassCap = [sprite([
    '.g..gG.g...gG...',
    'gGGgGGGgGgGGGGgG',
    'GGGGGGGGGGGGGGGG',
    'gGgGGgGGGgGGgGGg',
    'dgdgdgdgdgdgdgdg'], { G: GROUND.grass, g: GROUND.grassDark, d: GROUND.dirt, L: GROUND.grassLight }, 'grass'), sprite([
    '...gG..g..G.g...',
    'GgGGGGgGGGGGGGgG',
    'GGGLGGGGGGLGGGGG',
    'gGGgGGgGgGGGGgGg',
    'gdgdgdgdgdgdgdgd'], { G: GROUND.grass, g: GROUND.grassDark, d: GROUND.dirt, L: GROUND.grassLight }, 'grass2')];
  const roots = sprite(['dgdgdgdgdgdgdgdg', 'd.d.d.d.d...d.d.', '..r...r..r....r.', '..r......r......', '..........r.....'], { d: GROUND.dark, g: GROUND.dirt, r: GROUND.root }, 'roots');
  const edgeL = sprite(['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l'], { l: GROUND.light }, 'edgeL');
  const edgeR = sprite(['d', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd'], { d: GROUND.dark }, 'edgeR');
  const WATER = { deep: '#1d4a55', mid: '#246270', top: '#2f7f88', foam: '#8fd9d0', glint: '#c8f2ea' };
  const water = [];
  for (let f = 0; f < 4; f++) {
    const c = canvas(16, 16), g = c.getContext('2d');
    g.fillStyle = WATER.top; g.fillRect(0, 0, 16, 16);
    g.fillStyle = WATER.mid; g.fillRect(0, 6, 16, 10); g.fillStyle = WATER.deep; g.fillRect(0, 12, 16, 4);
    g.fillStyle = WATER.foam; for (let x = 0; x < 16; x++) { const y = Math.round(1 + Math.sin((x + f * 4) / 16 * Math.PI * 2) * 1); g.fillRect(x, y, 1, 1); }
    g.fillStyle = WATER.glint; g.fillRect((f * 5 + 3) % 16, 3, 2, 1); g.fillRect((f * 5 + 11) % 16, 8, 3, 1);
    water.push(c);
  }
  const waterDeep = (() => { const c = canvas(16, 16), g = c.getContext('2d'); g.fillStyle = WATER.deep; g.fillRect(0, 0, 16, 16); g.fillStyle = WATER.mid; g.fillRect(3, 5, 4, 1); g.fillRect(10, 12, 3, 1); return c; })();
  const reed = sprite(['..o..', '.oGo.', '.oGo.', '.ogo.', '..g..', '..g..', '..g..', 'g.g..', '.gg.g', '..gg.', '..g..', '..g..'], { o: '#4a3a24', G: '#6b4a30', g: '#5e8a2e' }, 'reed');
  const tuft = sprite(['g.G.g', 'gGgGg', '.ggg.'], { g: '#5e8a2e', G: '#7fb040' }, 'tuft');
  const shroomDeco = sprite(['.RRR.', 'RWRRR', 'ooooo', '.oWo.', '.oWo.'], { R: '#c26a8a', W: '#f0e0d0', o: '#3a1f2a' }, 'shroom');

  // ---------------------------------------------------------------- Fuente 5×7
  const GLYPHS = {
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'], J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], 1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], 3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], 5: ['#####', '#....', '#....', '####.', '....#', '....#', '####.'],
    6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'], 7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], 9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
    'Á': ['...#.', '.###.', '#...#', '#...#', '#####', '#...#', '#...#'], 'É': ['...#.', '#####', '#....', '####.', '#....', '#....', '#####'],
    'Í': ['...#.', '#####', '..#..', '..#..', '..#..', '..#..', '#####'], 'Ó': ['...#.', '.###.', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'Ú': ['...#.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], 'Ñ': ['.#..#', '#.##.', '#...#', '##..#', '#.#.#', '#..##', '#...#'],
    'Ü': ['.#.#.', '.....', '#...#', '#...#', '#...#', '#...#', '.###.'],
    '!': ['#', '#', '#', '#', '#', '.', '#'], '¡': ['#', '.', '#', '#', '#', '#', '#'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'], '¿': ['..#..', '.....', '..#..', '.#...', '#....', '#...#', '.###.'],
    '.': ['..', '..', '..', '..', '..', '##', '##'], ',': ['..', '..', '..', '..', '.#', '.#', '#.'], ':': ['..', '##', '##', '..', '##', '##', '..'],
    "'": ['#', '#', '.', '.', '.', '.', '.'], '-': ['....', '....', '....', '####', '....', '....', '....'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'], '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'], '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'], ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
    '·': ['..', '..', '..', '##', '##', '..', '..'], '♥': ['.#.#.', '#####', '#####', '#####', '.###.', '..#..', '.....'],
    '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....'], '←': ['.....', '..#..', '.#...', '#####', '.#...', '..#..', '.....'],
    '↑': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..#..'], '↓': ['..#..', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'],
    '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'], '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
    '~': ['.....', '.....', '.#..#', '#.#.#', '#..#.', '.....', '.....'], '★': ['..#..', '.###.', '#####', '.###.', '#.#.#', '.....', '.....'],
    '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'], '[': ['##', '#.', '#.', '#.', '#.', '#.', '##'], ']': ['##', '.#', '.#', '.#', '.#', '.#', '##']
  };
  const glyphCache = new Map();
  function glyph(ch, color) {
    const key = ch + color; let c = glyphCache.get(key); if (c) return c;
    const rows = GLYPHS[ch]; if (!rows) return null;
    c = sprite(rows, { '#': color }, 'glyph'); glyphCache.set(key, c); return c;
  }
  function textWidth(str) {
    let w = 0; for (const ch of str.toUpperCase()) { if (ch === ' ') { w += 3; continue; } const rows = GLYPHS[ch]; w += (rows ? rows[0].length : 3) + 1; }
    return Math.max(0, w - 1);
  }
  // Dibuja texto en mayúsculas; align: 'left' | 'center' | 'right'. shadow pinta una sombra 1px abajo.
  function text(g, str, x, y, color = '#ffffff', align = 'left', shadow = null) {
    str = String(str).toUpperCase();
    const w = textWidth(str); if (align === 'center') x -= w >> 1; else if (align === 'right') x -= w;
    x = Math.round(x); y = Math.round(y);
    if (shadow) { let cx = x; for (const ch of str) { if (ch === ' ') { cx += 3; continue; } const s = glyph(ch, shadow); if (s) g.drawImage(s, cx, y + 1); cx += (s ? s.width : 3) + 1; } }
    let cx = x; for (const ch of str) { if (ch === ' ') { cx += 3; continue; } const s = glyph(ch, color); if (s) g.drawImage(s, cx, y); cx += (s ? s.width : 3) + 1; }
    return w;
  }
  // Word wrap to a pixel width; returns lines.
  function wrap(str, maxW) {
    const words = String(str).split(' '), lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (textWidth(t) > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line); return lines;
  }

  // ---------------------------------------------------------------- Logotipo
  function logo() {
    const word = 'GLUP', S = 4, pad = 6;
    const w = textWidth(word) * S + pad * 2, h = 7 * S + pad * 2 + 6;
    const c = canvas(w, h), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const mask = canvas(textWidth(word), 7); text(mask.getContext('2d'), word, 0, 0, '#000');
    const big = canvas(mask.width * S, 7 * S); const bg = big.getContext('2d'); bg.imageSmoothingEnabled = false; bg.drawImage(mask, 0, 0, big.width, big.height);
    // Outline: the mask stamped around in the outline colour, then the fill in three bands of blue like the fish.
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 3; dy++) if (dx * dx + dy * dy <= 5) g.drawImage(tint(big, '#1b2430'), pad + dx, pad + dy);
    g.drawImage(tint(big, '#26303f'), pad, pad + 3); g.drawImage(tint(big, '#26303f'), pad, pad + 4);
    const bands = [['#a9c4dd', 0, 7], ['#8aa3c0', 7, 13], ['#5f7899', 13, 21], ['#43597a', 21, 28]];
    for (const [col, y0, y1] of bands) { const t = tint(big, col); g.drawImage(t, 0, y0, big.width, y1 - y0, pad, pad + y0, big.width, y1 - y0); }
    // Highlight glints on the top-left of each letter and three whisker-orange dots at the end.
    g.fillStyle = '#e5eef6'; g.fillRect(pad + 3, pad + 2, 6, 2); g.fillRect(pad + 3, pad + 4, 2, 2);
    g.fillStyle = '#e79b3f'; g.fillRect(w - 10, pad + 22, 3, 3); g.fillRect(w - 6, pad + 18, 2, 2); g.fillRect(w - 5, pad + 13, 2, 2);
    c.w = w; c.h = h; return c;
  }

  // ---------------------------------------------------------------- Fondos
  function skyLayer(pal) {
    const c = canvas(320, 180), g = c.getContext('2d');
    const bands = pal.sky; const n = bands.length;
    for (let y = 0; y < 180; y++) {
      const t = y / 180 * (n - 1), i = Math.min(n - 2, t | 0), f = t - i;
      for (let x = 0; x < 320; x++) { g.fillStyle = ((x + y) & 1) === 0 && f > .5 || f > .85 ? bands[i + 1] : bands[i]; g.fillRect(x, y, 1, 1); }
    }
    // Moon with a dark limb and a few stars with different blink phases stored as pixels.
    const mx = pal.moon[0], my = pal.moon[1], r = 12;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = x * x + y * y; if (d > r * r) continue;
      const inner = (x + 4) * (x + 4) + (y - 2) * (y - 2) < (r - 3) * (r - 3);
      g.fillStyle = d > (r - 1) * (r - 1) ? pal.moonEdge : inner ? pal.moonLight : pal.moonBase; g.fillRect(mx + x, my + y, 1, 1);
    }
    g.fillStyle = pal.moonEdge; g.fillRect(mx - 3, my + 5, 2, 1); g.fillRect(mx + 6, my - 4, 1, 1); g.fillRect(mx + 2, my + 8, 2, 1);
    const rr = rng(77); g.fillStyle = pal.star;
    for (let i = 0; i < 40; i++) { const x = (rr() * 320) | 0, y = (rr() * 90) | 0; if (Math.hypot(x - mx, y - my) > 20) g.fillRect(x, y, 1, 1); }
    return c;
  }
  function treeLayer(w, h, pal, seed, density, tall) {
    const c = canvas(w, h), g = c.getContext('2d'), r = rng(seed);
    // Ground band with a ragged horizon, then trunks with drooping canopies and hanging moss.
    g.fillStyle = pal.fill;
    const base = h - 20;
    for (let x = 0; x < w; x++) { const y = base + Math.round(Math.sin(x / 13 + seed) * 2 + Math.sin(x / 5) * 1); g.fillRect(x, y, 1, h - y); }
    let x = (r() * 10) | 0;
    while (x < w) {
      const th = tall * (0.6 + r() * 0.5), tw = 3 + (r() * 3) | 0, top = base - th;
      g.fillStyle = pal.fill; g.fillRect(x, top + 6, tw, th);
      const cw = 14 + (r() * 16) | 0;
      for (let i = 0; i < 4; i++) { const cy = top + i * 5, half = (cw * (0.5 + i * 0.18)) >> 1; g.fillRect(x + (tw >> 1) - half, cy, half * 2, 5); }
      if (pal.moss) { g.fillStyle = pal.moss; for (let m = 0; m < 4; m++) { const mx = x + (tw >> 1) - (cw >> 1) + ((r() * cw) | 0), len = 4 + (r() * 10) | 0; g.fillRect(mx, top + 18, 1, len); } }
      x += cw * density + (r() * 20) | 0;
    }
    return c;
  }
  function reedLayer(w, pal, seed) {
    const c = canvas(w, 40), g = c.getContext('2d'), r = rng(seed);
    for (let i = 0; i < w / 6; i++) {
      const x = (r() * w) | 0, h = 12 + (r() * 24) | 0, y = 40 - h;
      g.fillStyle = pal.stem; g.fillRect(x, y, 1, h);
      if (r() < .5) { g.fillStyle = pal.head; g.fillRect(x - 1, y - 4, 3, 6); }
      else { g.fillStyle = pal.leaf; g.fillRect(x + 1, y + 4, 1, 3); g.fillRect(x + 2, y + 2, 1, 3); }
    }
    return c;
  }
  const THEMES = {
    dusk: { sky: ['#1c2140', '#2b2f5c', '#5a3e6b', '#a55a52', '#d8874a', '#e9b25e'], moon: [246, 30], moonBase: '#f4e6b8', moonLight: '#fff8e0', moonEdge: '#d9c48f', star: '#f0e6c8',
      far: { fill: '#3a2f52' }, mid: { fill: '#26283f', moss: '#334a3a' }, reeds: { stem: '#1e2a24', head: '#3b2a1c', leaf: '#2d4a2a' }, fog: '#6e4f6a', ground: '#10141c' },
    night: { sky: ['#0b0f1e', '#121a33', '#1a2a4a', '#1f3a52', '#265266', '#2f6a70'], moon: [252, 34], moonBase: '#e6f0f4', moonLight: '#ffffff', moonEdge: '#b6c8d4', star: '#dbe8ff',
      far: { fill: '#16243a' }, mid: { fill: '#0f1a2a', moss: '#1f3d3a' }, reeds: { stem: '#0d1a1a', head: '#2a1e14', leaf: '#1e3a26' }, fog: '#2f5566', ground: '#0a0d14' },
    cave: { sky: ['#0d0a12', '#160f1c', '#1f1526', '#2a1b30', '#33223a', '#3a2a40'], moon: [-100, -100], moonBase: '#000', moonLight: '#000', moonEdge: '#000', star: '#5d4a6e',
      far: { fill: '#241a2c' }, mid: { fill: '#1a1220', moss: '#4a3358' }, reeds: { stem: '#2a1e30', head: '#3a2a44', leaf: '#3c2a48' }, fog: '#4a3358', ground: '#0a070d' },
    storm: { sky: ['#0e1016', '#151a24', '#1c2330', '#232c3a', '#2a3442', '#33404c'], moon: [-100, -100], moonBase: '#000', moonLight: '#000', moonEdge: '#000', star: '#2a3442', cloud: 'rgba(120,140,160,.18)',
      far: { fill: '#1c2430' }, mid: { fill: '#121820', moss: '#24323a' }, reeds: { stem: '#0c1216', head: '#1e1a16', leaf: '#16241e' }, fog: '#3a4a58', ground: '#0a0d12' },
    nest: { sky: ['#3a1f3a', '#6b2f4a', '#a4444e', '#d0684a', '#e89a52', '#f2c46a'], moon: [60, 40], moonBase: '#fff1c4', moonLight: '#fffbe8', moonEdge: '#e8c98a', star: '#f6dfb0',
      far: { fill: '#5c2f4a' }, mid: { fill: '#3a2038', moss: '#6a4a3a' }, reeds: { stem: '#2a1a24', head: '#4a2a1c', leaf: '#4a3a2a' }, fog: '#b86a5a', ground: '#1a0d14' } };
  const bgCache = {};
  function background(theme) {
    if (bgCache[theme]) return bgCache[theme];
    const p = THEMES[theme];
    return bgCache[theme] = { clouds: theme === 'cave' ? null : cloudLayer(p.cloud || 'rgba(255,240,220,.10)', 41), sky: skyLayer(p), far: treeLayer(480, 120, p.far, 11, 1.2, 40), mid: treeLayer(640, 150, p.mid, 23, 1.4, 70), reeds: reedLayer(320, p.reeds, 31), fog: p.fog, ground: p.ground, theme: p, storm: theme === 'storm' ? stormLayer(57) : null, mill: theme === 'storm' ? millLayer() : null };
  }

  return { sprite, flip, tint, canvas, rng, text, textWidth, wrap, glyph, logo, background, THEMES, GROUND, WATER,
    nila, fish, hand, snail, frogSit, frogJump, mosquito, crab, heronBody, heronFly, wingUp, wingDown, wingMid, egg,
    crate, rock, pearl: cria, cria, criaFree, ruca, bubble, heart, drop, fire, ash, ring, plate, pinwheel, hard, raft, mossWall, morsels, heartEmpty, lantern, sign, boat, mushroom, mushroomSquash, thorns, gate, target, lily, plank, puff, star, cracked,
    dirt, grassCap, roots, edgeL, edgeR, water, waterDeep, reed, tuft, shroomDeco };
})();
