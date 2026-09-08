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
  const NILA = { o: '#33242c', Y: '#f2c53d', y: '#c9932a', W: '#fbe37a', s: '#f3cba6', k: '#d9a077', e: '#2b2230', p: '#e88a83', m: '#a3513f', r: '#c9463a', R: '#8a2f2c' };
  const nilaBody = [
    '.....oooo.....',
    '...ooYWWYoo...',
    '..oYWWYYYYYo..',
    '.oYWWYYYYYYYo.',
    '.oYWYYYYYYYYYo',
    '.oYYYyyyyyyYYo',
    'oYYYysssssyYYo',
    'oYYysssssssyYo',
    'oYYysesseskyYo',
    'oYYysesseskyYo',
    'oYYypsssskpyYo',
    '.oYyksmmsskyYo',
    '.oYYyyyyyyyyYo',
    '..oYYYYYYYYYo.',
    '..oYyYYYYYYyo.',
    '..oYyYYYYYYyo.',
    '..oyyYYYYYyyo.',
    '..oyyyyyyyyyo.'];
  const nilaBlink = nilaBody.map((r, i) => i === 8 ? 'oYYysssssskyYo' : i === 9 ? 'oYYyseesseekyYo'.slice(0, 3) + 'yseessekyYo' : r);
  const feet = {
    stand: ['..orro..orro..', '..oRRo..oRRo..'],
    spread: ['.orro....orro.', '.oRRo....oRRo.'],
    together: ['....orroorro..', '....oRRooRRo..'],
    jump: ['...orro.orro..', '...oRRo.oRRo..'],
    fall: ['.orro....orro.', '.oRRo....oRRo.'],
    wide: ['orro......orro', 'oRRo......oRRo'],
    dangle1: ['..orro...orro.', '..oRRo...oRRo.'],
    dangle2: ['...orro.orro..', '...oRRo.oRRo..'] };
  const blank = '..............';
  function nilaFrame(body, f, bob = 0) {
    const rows = body.slice(); if (bob) rows.unshift(blank);
    const out = rows.concat(feet[f]); while (out.length < 20) out.push(blank); return sprite(out.slice(0, 20), NILA, 'nila');
  }
  const nila = {
    idle: [nilaFrame(nilaBody, 'stand'), nilaFrame(nilaBlink, 'stand')],
    run: [nilaFrame(nilaBody, 'stand'), nilaFrame(nilaBody, 'spread', 1), nilaFrame(nilaBody, 'together'), nilaFrame(nilaBody, 'spread', 1)],
    jump: nilaFrame(nilaBody.slice(0, 17), 'jump'),
    fall: nilaFrame(nilaBody, 'fall'),
    hurt: nilaFrame(nilaBody.map((r, i) => i === 8 || i === 9 ? r.replace(/e/g, 'k') : i === 11 ? '.oYykssmmskyYo' : r), 'spread', 1),
    win: nilaFrame(nilaBody.map((r, i) => i === 11 ? '.oYyksmmmmkyYo' : r), 'together'),
    brace: nilaFrame(nilaBody, 'wide', 1),
    dangle: [nilaFrame(nilaBody, 'dangle1'), nilaFrame(nilaBody, 'dangle2')],
    crouch: sprite(nilaBody.slice(1, 13).concat(['..oyyYYYYYyyo.', '..oyyyyyyyyyo.', '.orro....orro.', '.oRRo....oRRo.']), NILA, 'nila-crouch') };

  // ---------------------------------------------------------------- Bigotes, el pez gato
  const FISH = { o: '#26303f', B: '#5f7899', b: '#43597a', L: '#8aa3c0', W: '#d3dbe2', w: '#a7b4c1', E: '#161a24', H: '#f4f6f8', F: '#e79b3f', f: '#b8692a', m: '#7c2f44', t: '#d96a7c' };
  const fishClosed = [
    '........ooo...........',
    '.......oBLBo..........',
    '.o....oBLBBBooooo....F',
    '.oo..oLLBBBBBBBBBoo.F.',
    '.oBo.oLBBBBBBBBBBBBoF.',
    '.oBBooBBBBBBBBBBHEBBo.',
    '.oBBBBBBBBBBBBBBBBBmo.',
    '.oBo.obWWWWWWWWWWwboF.',
    '.oo..owwWWWWWWWwwbo.F.',
    '.o....oooooooooooo...F'];
  const fishOpen = [
    '........ooo...........',
    '.......oBLBo..........',
    '.o....oBLBBBooooo....F',
    '.oo..oLLBBBBBBBBBoo.F.',
    '.oBo.oLBBBBBBBBBBoooF.',
    '.oBBooBBBBBBBBBHEommo.',
    '.oBBBBBBBBBBBBBBommmo.',
    '.oBo.obWWWWWWWWWommoF.',
    '.oo..owwWWWWWWwwoooF..',
    '.o....oooooooooooo.F..'];
  const fishFull = [
    '........ooo...........',
    '.......oBLBo..........',
    '.o....oBLBBBooooooo..F',
    '.oo..oLLBBBBBLLBBBBoF.',
    '.oBo.oLBBBBBLBBBBBBBoF',
    '.oBBooBBBBBBBBBBBHEBo.',
    '.oBBBBBBBBBBBBBBBBBBmo',
    '.oBo.obWWWWWWWWWWWWoF.',
    '.oo..owwWWWWWWWwwwoF..',
    '.o....ooooooooooooo..F'];
  const fishSpit = fishOpen.map((r, i) => i === 6 ? '.oBBBBBBBBBBBBBBotttoF' : i === 7 ? '.oBo.obWWWWWWWWWottoF.' : r);
  const fishFullOpen = fishFull.map((r, i) => i === 5 ? '.oBBooBBBBBBBBBBBHEoo.' : i === 6 ? '.oBBBBBBBBBBBBBBBBommo' : i === 7 ? '.oBo.obWWWWWWWWWWWoFo.' : r);
  const fishTail = fishClosed.map((r, i) => i >= 1 && i <= 4 ? fishClosed[i + 1].slice(0, 5) + r.slice(5) : i === 5 ? '.oBBo' + r.slice(5) : r);
  const fishSquint = fishFull.map((r, i) => i === 5 ? r.replace('HE', 'oo') : r);
  const fish = { tail: sprite(fishTail, FISH, 'fish-tail'), squint: sprite(fishSquint, FISH, 'fish-squint'), closed: sprite(fishClosed, FISH, 'fish'), open: sprite(fishOpen, FISH, 'fish-open'), full: sprite(fishFull, FISH, 'fish-full'), spit: sprite(fishSpit, FISH, 'fish-spit'), swallow: sprite(fishFullOpen, FISH, 'fish-swallow') };
  const hand = sprite(['.ooo.', 'oYYYo', 'oYyYo', '.ooo.'], NILA, 'hand');

  // ---------------------------------------------------------------- Enemigos
  const SNAIL = { o: '#3a2a22', S: '#c8783c', s: '#94512a', L: '#e9a862', B: '#8fbf5a', b: '#5f8a3a', E: '#1c1c1c' };
  const snailRows = [
    '....oooooo......',
    '...oLLSSSSo...oo',
    '..oLSSssSSSo.oEo',
    '..oSSsLLsSSo.oo.',
    '..oSSsLssSSo..o.',
    '..oSSSssSSSo..o.',
    '.ooSSSSSSSSoBBo.',
    'oBBoSSSSSSoBBBBo',
    'oBBBoooooBBBbBBo',
    '.oBbBBBBBBBbBBo.',
    '..oooooooooooo..'];
  const snailRows2 = snailRows.map((r, i) => i === 1 ? '...oLLSSSSo..oo.' : i === 2 ? '..oLSSssSSSooEo.' : i === 3 ? '..oSSsLLsSSo.o..' : i === 4 ? '..oSSsLssSSo.o..' : i === 5 ? '..oSSSssSSSo.o..' : r);
  const snail = [sprite(snailRows, SNAIL, 'snail'), sprite(snailRows2, SNAIL, 'snail2')];
  const FROG = { o: '#233a1e', G: '#6cbf4e', g: '#478a36', L: '#a6e07a', W: '#e8f0c8', E: '#111111', H: '#ffffff', m: '#7a3a44' };
  const frogSit = sprite([
    '..ooo....ooo..',
    '.oHHEo..oHHEo.',
    '.oHHEo..oHHEo.',
    '.oGoooGGoooGo.',
    'oGGGLGGGGGGGGo',
    'oGLGGGGGGGGGGo',
    'oGGGGGGGmmmmmo',
    'ogGWWWWWWWWggo',
    'ooGgWWWWWWgoGo',
    'oGgooggggooGgo',
    '.oooo.....ooo.'], FROG, 'frog');
  const frogJump = sprite([
    '..ooo....ooo..',
    '.oHHEo..oHHEo.',
    '.oHHEo..oHHEo.',
    '.oGoooGGoooGo.',
    'oGGGLGGGGGGGGo',
    'oGLGGGGGGGGGGo',
    'oGGGGGGGmmmmmo',
    'ogGWWWWWWWWggo',
    '.oGgWWWWWWgGo.',
    '.oGoggggggoGo.',
    '.oGo.oooo.oGo.',
    '.ogo......ogo.',
    'oggo......oggo',
    'oooo......oooo'], FROG, 'frog-jump');
  const MOSQ = { o: '#2a2a3a', B: '#8a8aa8', b: '#5c5c78', W: '#d6e2ee', E: '#ff6a5a', P: '#3a3a4a' };
  const mosquito = [sprite([
    '..WWWW......',
    '.WWWWWWW....',
    '..WWWWWoo...',
    '...ooBBBBo..',
    '..oBbBBBBEo.',
    '..obBBBBBooP',
    '...ooooooPP.',
    '..o.o..o.o..'], MOSQ, 'mosq'), sprite([
    '............',
    '............',
    '........oo..',
    '.WWWWWBBBBo.',
    '.WWWWbBBBEo.',
    '..obBBBBBooP',
    '...ooooooPP.',
    '..o.o..o.o..'], MOSQ, 'mosq2')];
  const CRAB = { o: '#4a1a1a', R: '#d9503a', r: '#a0342a', L: '#f28b6a', E: '#111111', H: '#ffffff' };
  const crabRows = [
    '.....oo....oo.....',
    '....oHEo..oHEo....',
    '.oo..oo.oo.oo..oo.',
    'oRRooRRRRRRRRooRRo',
    'oRLRoRRLLRRRRoRLRo',
    'oRRRRRRRRRRRRRRRRo',
    '.oorRRRRRRRRRRroo.',
    '..orrRRRRRRRRrro..',
    '..oo.o.oooo.o.oo..',
    '.o..o.o....o.o..o.'];
  const crab = [sprite(crabRows, CRAB, 'crab'), sprite(crabRows.map((r, i) => i === 8 ? '..o.oo.oooo.oo.o..' : i === 9 ? '..o..o.o..o.o..o..' : r), CRAB, 'crab2')];

  // ---------------------------------------------------------------- La Garza (jefa)
  const HERON = { o: '#1f2733', G: '#7d8fa6', g: '#5a6b82', L: '#a9b8c9', W: '#e9eef2', w: '#c2cbd5', K: '#22262e', Y: '#e2b63c', y: '#b1852a', E: '#1a1a1a', H: '#ffffff' };
  const heronBody = sprite([
    '..........ooooKKK...............',
    '.........oGGGGGGKKo.............',
    '........oGGLLGGEGGKo............',
    'ooooooooGGLGGGGGGGGo............',
    'YYYYYYYYoGGGGGGGGGo.............',
    'oooooooooGGGWWGGGo..............',
    '.........oGWWWGGo...............',
    '..........oWWWGo................',
    '..........oWWGGo................',
    '..........oWWGGo................',
    '..........oWWGGGo...............',
    '..........oWWGGGGo..............',
    '..........oWWWGGGGoooo..........',
    '...........oWWWGGGGGGGoooo......',
    '...........oWWWGGGGGGGGGGGooo...',
    '............oWWGGGGGGGGGGGGGGoo.',
    '............oWWGGGGGGGGGGGGGGGGo',
    '............oWWWGGGGGgGGGGGGGGo.',
    '.............oWWWGGGGgggGGGGGo..',
    '.............oWWWWGGGGgggGGGo...',
    '..............oWWWWGGGGggGoo....',
    '...............oWWWWGGGGoo......',
    '................ooWWWooo........',
    '..................oooo..........',
    '..................yy.y..........',
    '..................yy.y..........',
    '..................yy.y..........',
    '..................yy.y..........',
    '.................oyyoyy.........',
    '................oyyyoyyy........'], HERON, 'heron');
  const heronFly = sprite([
    '..........ooooKKK...............',
    '.........oGGGGGGKKo.............',
    '........oGGLLGGEGGKo............',
    'ooooooooGGLGGGGGGGGo............',
    'YYYYYYYYoGGGGGGGGGo.............',
    'oooooooooGGGWWGGGo..............',
    '.........oGWWWGGGo..............',
    '..........oWWWGGGo..............',
    '..........oWWWGGGGoooo..........',
    '..........oWWWGGGGGGGGoooo......',
    '..........oWWWWGGGGGGGGGGGooo...',
    '...........oWWWGGGGGGGGGGGGGGoo.',
    '...........oWWWGGGGGGGGGGGGGGGGo',
    '...........oWWWWGGGGGgGGGGGGGGo.',
    '............oWWWWGGGGgggGGGGGo..',
    '............oWWWWWGGGGgggGGGo...',
    '.............oWWWWWGGGGggGoo....',
    '..............oWWWWWGGGGoo......',
    '...............ooWWWWooo........',
    '.................ooooo..........',
    '..................yyy...........',
    '...................yyy..........',
    '....................yyy.........',
    '.....................yyy........'], HERON, 'heron-fly');
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
    '.ooooooooooooooooooooooo....'], HERON, 'wing-up');
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
    '.....................oo.....'], HERON, 'wing-down');
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
    '..............................'], HERON, 'wing-mid');
  const egg = sprite(['..oo..', '.oWLo.', 'oWWLLo', 'oWLLLo', 'oLLllo', '.oLlo.', '..oo..'], { o: '#4a5a6a', W: '#fff6dc', L: '#e6d9b8', l: '#c8b890' }, 'egg');

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
  const PEARL = { o: '#4a6a7a', W: '#ffffff', L: '#cfe8f0', l: '#9ecbd8' };
  const pearl = [sprite(['..ooo..', '.oWWLo.', 'oWWWLLo', 'oWWLLLo', 'oLLLllo', '.oLllo.', '..ooo..'], PEARL, 'pearl'),
    sprite(['..ooo..', '.oLLLo.', 'oLWWLlo', 'oLWLLlo', 'oLLlllo', '.olllo.', '..ooo..'], PEARL, 'pearl2'),
    sprite(['..ooo..', '.oLLLo.', 'oLLLLlo', 'oLLLWlo', 'oLllWlo', '.olllo.', '..ooo..'], PEARL, 'pearl3')];
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
    nest: { sky: ['#3a1f3a', '#6b2f4a', '#a4444e', '#d0684a', '#e89a52', '#f2c46a'], moon: [60, 40], moonBase: '#fff1c4', moonLight: '#fffbe8', moonEdge: '#e8c98a', star: '#f6dfb0',
      far: { fill: '#5c2f4a' }, mid: { fill: '#3a2038', moss: '#6a4a3a' }, reeds: { stem: '#2a1a24', head: '#4a2a1c', leaf: '#4a3a2a' }, fog: '#b86a5a', ground: '#1a0d14' } };
  const bgCache = {};
  function background(theme) {
    if (bgCache[theme]) return bgCache[theme];
    const p = THEMES[theme];
    return bgCache[theme] = { clouds: theme === 'cave' ? null : cloudLayer(p.cloud || 'rgba(255,240,220,.10)', 41), sky: skyLayer(p), far: treeLayer(480, 120, p.far, 11, 1.2, 40), mid: treeLayer(640, 150, p.mid, 23, 1.4, 70), reeds: reedLayer(320, p.reeds, 31), fog: p.fog, ground: p.ground, theme: p };
  }

  return { sprite, flip, tint, canvas, rng, text, textWidth, wrap, glyph, logo, background, THEMES, GROUND, WATER,
    nila, fish, hand, snail, frogSit, frogJump, mosquito, crab, heronBody, heronFly, wingUp, wingDown, wingMid, egg,
    crate, rock, pearl, heart, drop, fire, ash, ring, plate, pinwheel, hard, raft, heartEmpty, lantern, sign, boat, mushroom, mushroomSquash, thorns, gate, target, lily, plank, puff, star, cracked,
    dirt, grassCap, roots, edgeL, edgeR, water, waterDeep, reed, tuft, shroomDeco };
})();
