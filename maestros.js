// GLUP — los maestros del pantano. Cada nivel tiene uno (la Q del mapa): un personaje que habla
// letra a letra en un cuadro con su retrato y, al acabar, le ofrece a Bigotes un bocado. El bocado
// vuela en arco hasta la boca del pez, Bigotes lo traga y aprende el truco (aprende.js). Algunos
// piden antes un pequeño encargo (llevarles algo, encender los faroles, apagar un fuego…).
//
// En el nivel:  maestro: { quien, poder, bocado?, dialogo: [...], despedida, charla?, encargo? }
//   quien       'ruca' 'lumi' 'lapa' 'olga' 'anselmo' 'canto' 'pinzas' 'alga'
//   poder       el truco que enseña (ver POWERS en game.js)
//   bocado      opcional: cómo se nombra lo que da ('una luciérnaga dorada'); si no, el de POWERS
//   dialogo     frases de la primera charla (la última suele ofrecer el bocado)
//   despedida   lo que dice en cuanto ya ha dado el bocado y en las visitas siguientes
//   encargo     opcional: { tipo, pide, hecho, ... } — mientras no se cumpla, dice `pide` y no da nada;
//               cumplido, dice `hecho` y da el bocado. Tipos:
//                 entregar  { cosa: 'crate'|'rock'|…, radio: px }   algo de esa clase quieto a menos de radio px
//                 faroles   { n }                                    n faroles encendidos (sin n: todos los del nivel)
//                 apagar    { radio: celdas }                        ningún fuego fatuo (F) a menos de radio celdas
//                 dianas    { n }                                    n dianas acertadas
// Se habla con {up} al lado del maestro (o tocando ▲); las frases avanzan con salto, Bigotes o tocando.
'use strict';

// ---------------------------------------------------------------- El cuadro de diálogo
// Shared by the teachers in the level and by Ruca on the map. Lines are typed a few letters a frame.
const Charla = (() => {
  let S = null;
  const SPEED = 1.2;
  function start(o) {
    const who = typeof o.quien === 'string' ? Maestros.QUIEN[o.quien] : o.quien;
    S = { who, ent: o.ent || null, lines: o.lines.filter(Boolean), i: 0, t: 0, alFinal: o.alFinal || null, wait: 8, shown: 0 };
    Input.release();
  }
  function stop() { S = null; }
  const active = () => !!S;
  const text = () => Game.signText(null, S.lines[S.i]);
  function update() {
    if (!S) return;
    S.t++; S.lineT = (S.lineT || 0) + 1; if (S.wait > 0) S.wait--;
    const full = text().length, before = Math.floor(S.shown);
    S.shown = Math.min(full, S.shown + SPEED);
    if (Math.floor(S.shown) > before && Math.floor(S.shown) % 3 === 0 && S.shown < full) Sound.play('talk', S.who.voz);
    if (S.ent) S.ent.talking = S.shown < full;
    const go = Input.pressed.jump || Input.pressed.fish || Input.pressed.confirm || Input.pressed.up || Game.tapped; Game.tapped = false;
    if (!go || S.wait > 0) return;
    if (S.shown < full) { S.shown = full; return; }
    Sound.play('select');
    if (++S.i < S.lines.length) { S.shown = 0; S.wait = 4; S.lineT = 0; return; }
    const f = S.alFinal, ent = S.ent; S = null; if (ent) ent.talking = false; Input.release();
    if (f) f();
  }
  // The speech bubble: it comes out of whoever speaks, with its tail pointing at them, above them if
  // there's room (below if not). Cream paper, a little portrait, the name on a wooden tag, the Glup
  // letters typed one by one with a pop, and a small fish bobbing when there's more to read.
  function draw(g) {
    if (!S) return;
    const who = S.who, str = text(), maxW = 190, lines = Letra.wrap(str, maxW), tw = Math.max(60, ...lines.map(Letra.width));
    const w = tw + 44, h = Math.max(34, lines.length * Letra.LINE + 16);
    // Where the speaker is on screen (or a spot at the bottom when nobody is in the scene).
    const e = S.ent, ax = e ? Math.round(e.x + e.w / 2 - Cam.x) : W / 2, ay = e ? Math.round(e.y - Cam.y + (e.fy || 0)) : H;
    let bx = Math.max(6, Math.min(W - w - 6, ax - Math.round(w * .35))), by = ay - h - 16, below = false;
    if (!e) by = H - h - 8; else if (by < 20) { by = ay + (e.h || 16) + 16; below = true; }
    by = Math.max(4, Math.min(H - h - 4, by));
    // Pop in from the speaker's mouth, with a little overshoot; a squash on each new line.
    const k = Math.min(1, S.t / 9), sc = k < 1 ? .3 + .7 * (1 - Math.pow(1 - k, 3)) + Math.sin(k * Math.PI) * .12 : 1 + (S.lineT < 6 ? Math.sin(S.lineT / 6 * Math.PI) * .03 : 0);
    const ox = e ? Math.max(bx + 10, Math.min(bx + w - 10, ax)) : bx + w / 2, oy = below ? by : by + h;
    g.save(); g.translate(ox, oy); g.scale(sc, sc); g.translate(-ox, -oy);
    const O = '#2a1e2e', P = '#fff4dc', Pd = '#ecd6ae';
    // Tail toward the speaker.
    if (e) { const tx = Math.max(bx + 12, Math.min(bx + w - 12, ax)), ty0 = below ? by : by + h - 1, ty1 = below ? by - 10 : by + h + 9, tip = Math.max(-6, Math.min(6, ax - tx));
      for (let r = 0; r <= 10; r++) { const yy = below ? ty0 - r : ty0 + r, half = Math.round((10 - r) * .45), cx = Math.round(tx + tip * r / 10); g.fillStyle = O; g.fillRect(cx - half - 1, yy, half * 2 + 3, 1); if (half > 0 && r < 10) { g.fillStyle = P; g.fillRect(cx - half, yy, half * 2 + 1, 1); } } }
    // Rounded paper with a dark rim, a lit top and a soft shadow at the bottom.
    g.fillStyle = 'rgba(8,6,14,.35)'; g.fillRect(bx + 3, by + 3, w, h);
    g.fillStyle = O; g.fillRect(bx + 2, by, w - 4, h); g.fillRect(bx, by + 2, w, h - 4); g.fillRect(bx + 1, by + 1, w - 2, h - 2);
    g.fillStyle = P; g.fillRect(bx + 2, by + 1, w - 4, h - 2); g.fillRect(bx + 1, by + 2, w - 2, h - 4);
    g.fillStyle = Pd; g.fillRect(bx + 2, by + h - 4, w - 4, 2); g.fillStyle = '#ffffff'; g.fillRect(bx + 3, by + 2, w - 10, 1);
    // The little portrait in its round frame.
    const pw = 26, px = bx + 6, py = by + Math.round((h - pw) / 2);
    g.fillStyle = O; g.fillRect(px, py - 1, pw, pw + 2); g.fillRect(px - 1, py, pw + 2, pw);
    g.fillStyle = who.fondo || '#2e4a3a'; g.fillRect(px, py, pw, pw);
    g.save(); g.beginPath(); g.rect(px, py, pw, pw); g.clip(); Maestros.portrait(g, who, px, py, pw, pw, S.shown < str.length, S.t); g.restore();
    g.fillStyle = who.edge; g.fillRect(px, py + pw - 2, pw, 2);
    // The name on a wooden tag with two nails.
    const nw = Letra.width(who.name) + 12, nx = bx + 8, ny = by - 9;
    g.fillStyle = O; g.fillRect(nx - 1, ny - 1, nw + 2, 13); g.fillStyle = '#8a5a34'; g.fillRect(nx, ny, nw, 11); g.fillStyle = '#b07848'; g.fillRect(nx, ny, nw, 2); g.fillStyle = '#5a3a24'; g.fillRect(nx, ny + 9, nw, 2);
    g.fillStyle = '#e8d8b0'; g.fillRect(nx + 2, ny + 4, 1, 1); g.fillRect(nx + nw - 3, ny + 4, 1, 1);
    Letra.text(g, who.name, nx + 6, ny + 1, { color: '#fff4dc', light: '#ffffff', shadow: '#3a2418' });
    // The words, typed with a pop.
    let left = Math.floor(S.shown);
    lines.forEach((l, i) => { if (left > 0) Letra.text(g, l, bx + 38, by + 7 + i * Letra.LINE, { color: O, shadow: '#e2c9a0', shown: left, t: S.t }); left -= l.length + 1; });
    // More to read: a little fish nodding; the end: a small shell.
    if (S.shown >= str.length) {
      const ix = bx + w - 14, iy = by + h - 9 + ((S.t >> 3) % 2);
      if (S.i < S.lines.length - 1) { const f = ART.criaFree[(S.t >> 3) % 2]; g.drawImage(f, ix - 2, iy); }
      else { g.fillStyle = O; g.fillRect(ix, iy, 5, 4); g.fillStyle = '#f2c46a'; g.fillRect(ix + 1, iy + 1, 3, 2); }
    }
    g.restore();
  }
  return { start, stop, active, update, draw };
})();

// ---------------------------------------------------------------- Los maestros
const Maestros = (() => {
  // Overwrite `str` into a copy of `rows` at column x of row y ('_' leaves a pixel as it was).
  function put(rows, x, y, str) { const r = rows.slice(); const row = r[y].split(''); for (let i = 0; i < str.length; i++) if (str[i] !== '_') row[x + i] = str[i]; r[y] = row.join(''); return r; }
  function edit(rows, list) { for (const [x, y, s] of list) rows = put(rows, x, y, s); return rows; }
  // Move a band of rows sideways by dx (for sways and bobs).
  function shiftRows(rows, y0, y1, dx) { return rows.map((r, y) => y < y0 || y > y1 ? r : dx > 0 ? ('.'.repeat(dx) + r).slice(0, r.length) : (r + '.'.repeat(-dx)).slice(-dx)); }
  function upRows(rows, y0, y1) { const r = rows.slice(); for (let y = y0; y <= y1; y++) r[y - 1] = rows[y]; r[y1] = '.'.repeat(rows[0].length); return r; }

  // ---- Each teacher's pixel art: frames (idle, a second idle pose, blink, talk), where the face sits
  // for the portrait [x, y, w, h], where the morsel comes out of, the voice and the colours of the box.
  let built = null;
  function build() {
    if (built) return built;
    const S = ART.sprite, B = {};

    // Ruca, the old turtle: already drawn in art.js. Her head bobs while she talks.
    // Her second pose lifts the head a pixel: a slow, patient nod.
    const nod = src => { const c = ART.canvas(src.width, src.height), cg = c.getContext('2d'); cg.drawImage(src, 0, 0); cg.clearRect(17, 0, 7, src.height); cg.drawImage(src, 17, 0, 7, src.height, 17, -1, 7, src.height); return c; };
    B.ruca = { idle: [ART.ruca.idle, nod(ART.ruca.idle)], blink: ART.ruca.blink, talk: [ART.ruca.talk, nod(ART.ruca.talk)], face: [15, 1, 9, 10], hand: [20, 6] };

    // Lumi, the old firefly who lights the reeds: seen from the front, a round head with white brows and a
    // drooping moustache, a lantern of a belly, glowing antenna tips and wings that never stop.
    const LUMI = { o: '#2b1f3a', B: '#4a3d6a', P: '#6e5f96', H: '#f6f0dc', e: '#ffffff', E: '#1d1826', n: '#f0a0a0', W: '#dff2fb', w: '#8fbcd4', y: '#ffd84a', Y: '#fff6b0', g: '#d09a2a' };
    const lumi = [
      '..y............y..',
      '...o..........o...',
      '....o........o....',
      '.....oooooooo.....',
      '....oPPBBBBBBo....',
      '...oPBBBBBBBBBo...',
      '..oPHHHBBBBHHHBo..',
      '..oBBeEEBBBeEEBo..',
      '..oBBBBBnnBBBBBo..',
      '.WoBHHHHHHHHHHBoW.',
      'WwWoHHHooooHHHoWwW',
      'WwwWoHHyyyyHHoWwwW',
      '.WwWoyYYYYYYyoWwW.',
      '..WoyYYYYYYYYyoW..',
      '...oyYYYYYYYYyo...',
      '...ogyYYYYYYygo...',
      '....ogyyyyyygo....',
      '.....oooooooo.....'];
    const lumiB = edit(lumi, [[0, 4, 'WW'], [16, 4, 'WW'], [0, 5, 'WwW'], [15, 5, 'WwW'], [0, 6, '.W'], [16, 6, 'W.'],
      [0, 9, '..'], [16, 9, '..'], [0, 10, '...'], [15, 10, '...'], [0, 11, '....'], [14, 11, '....'], [0, 12, '....'], [14, 12, '....'], [0, 13, '...'], [15, 13, '...']]);
    const lumiShut = put(lumi, 2, 7, 'oBBoooBBBoooBo');
    B.lumi = { idle: [S(lumi, LUMI, 'lumi'), S(lumiB, LUMI, 'lumi2')], blink: S(lumiShut, LUMI, 'lumi-blink'),
      talk: [S(put(lumi, 7, 10, 'oEEo'), LUMI, 'lumi-talk'), S(put(lumiB, 7, 10, 'oEEo'), LUMI, 'lumi-talk2')], face: [2, 1, 14, 12], hand: [9, 13], float: true };
    // Tía Lapa, a grumpy limpet stuck to her rock: a ribbed shell with a flower, frowning under the rim.
    const LAPA = { o: '#2a2226', R: '#7a7068', r: '#5a5250', q: '#9a9088', S: '#cdbb9c', s: '#978468', T: '#65523f', L: '#f4dca8', F: '#e8906a', f: '#b8604a', E: '#1d1826', e: '#ffffff', K: '#4a2a22', p: '#f27aa0', y: '#ffe36a', v: '#5e8a2e' };
    const lapa = [
      '..........oo..........',
      '.........oLSo.........',
      '........oLSTso........',
      '.......oLSTSsso..opo..',
      '......oLSSTSSTso.pyp..',
      '.....oLSTSSTSsTsoopv..',
      '....oLSSTSSTSSsTsso...',
      '...oLSTSSSTSSSsTsTso..',
      '..ooooooooooooooooooo.',
      '...oFKKKFFFFFFKKKFfo..',
      '...oFFEeFFFFFFEeFffo..',
      '..oqoFFFFFoooFFFFfoRo.',
      '.oqqqooooooFFooooooRRo',
      'oqqRRRRRRRRRRRRRRRrrRo',
      'oRRRRRrrRRRRRRrRRRrrro',
      '.ooooooooooooooooooooo'];
    const lapaUp = upRows(lapa, 1, 8);   // she lifts her shell for a look around
    B.lapa = { idle: [S(lapa, LAPA, 'lapa'), S(lapaUp, LAPA, 'lapa2')], blink: S(put(lapa, 5, 10, 'KKFFFFFFFKK'), LAPA, 'lapa-blink'),
      talk: [S(put(lapa, 10, 11, 'oEEo'), LAPA, 'lapa-talk'), S(put(lapaUp, 10, 11, 'oooo'), LAPA, 'lapa-talk2')], face: [2, 3, 19, 14], hand: [11, 8] };

    // Olga, the otter who runs the mill: flour on her head, an apron with a blue band, a thick tail.
    const OLGA = { e: '#ffffff', o: '#2a1a14', F: '#8a5a3a', f: '#6a4028', U: '#b0844e', C: '#f0dcb8', c: '#d0b890', N: '#2a1a14', E: '#1d1826', W: '#ffffff', A: '#e8eef4', a: '#a8b8c8', B: '#4a7fc0', k: '#e8e0d0', m: '#7a3a2a' };
    const olga = [
      '.....oooo.......',
      '...ooWWWUoo.....',
      '..oUWWUUFFFo....',
      '..oUUFFFFFFFo...',
      '..oUFFFFFeEFFo..',
      '..oFFFFFFCCCCNo.',
      '..oFFFFFCCCCCo.k',
      '...oFFFCCCmCo.k.',
      '....ooFCCCCo....',
      '...oFFAAAAAAo...',
      '..oFFAAAAAAAAo..',
      '..oFUAAaAAAAFo..',
      '..oFFAAAAAAAoFo.',
      'o.oFFBBBBBBBoFo.',
      'FooFoAAAAAAAFo..',
      'oFFoFAAAaAAAFo..',
      '.oFFoAAAAAAAFo..',
      '..oFFAaAAAAAFo..',
      '...oFFFFFFFFo...',
      '...oFFo..oFFo...',
      '..oCCCo..oCCCo..',
      '..ooooo..ooooo..'];
    const olgaB = edit(olga, [[0, 13, '._'], [0, 14, 'oF'], [0, 15, '.o'], [0, 12, 'o.'], [1, 13, 'F']]);
    B.olga = { idle: [S(olga, OLGA, 'olga'), S(olgaB, OLGA, 'olga2')], blink: S(put(olga, 9, 4, 'ff'), OLGA, 'olga-blink'),
      talk: [S(put(olga, 9, 7, 'CoC'), OLGA, 'olga-talk'), S(olga, OLGA, 'olga-talk2')], face: [2, 0, 14, 11], hand: [12, 12] };

    // Don Anselmo, the old fisherman: a green oilskin hat, a white beard, a red nose and his pipe.
    const ANS = { o: '#1e1a24', H: '#3a5a3a', h: '#2a422a', J: '#5a7a4a', S: '#f0c8a0', s: '#c8906a', R: '#d86a5a', W: '#f4f0e8', w: '#c8c0b8', N: '#34406a', n: '#262e50', I: '#4a5a8a', P: '#6a5a44', p: '#4a3e30', B: '#2a2a30', T: '#7a4a24', t: '#f28a3a', E: '#1d1826' };
    const ans = [
      '......ooooo.......',
      '.....oJJJHHo......',
      '....oJHHHHHho.....',
      '..ooooooooooooo...',
      '...osSSSSSSSo.....',
      '...osSWWSSESo.....',
      '...osSSSSSSRRo....',
      '...owWWWWWWRRo....',
      '...owWWWWWWWoTTTt.',
      '..owWWWWWWWWo.o...',
      '..owwWWWWWWWo.....',
      '..onwWWWWWwno.....',
      '.oNNnwWWWwnNNo....',
      'oNNNNnwwwnNNNNo...',
      'oNINNNnnnNNNSso...',
      'oNINNNNNNNNNSSo...',
      'oNNNNNNNNNNNoo....',
      '.oNNNNNNNNNNo.....',
      '.onnnnnnnnnno.....',
      '..oPPPPoPPPPo.....',
      '..oPPPpoPPPpo.....',
      '..oPPPpoPPPpo.....',
      '..oBBBBoBBBBo.....',
      '.oBBBBBoBBBBBo....',
      '.ooooooooooooo....'];
    const ansB = edit(ans, [[13, 8, 'TTTt'], [16, 7, '_']]);
    B.anselmo = { idle: [S(ans, ANS, 'anselmo'), S(put(ans, 16, 8, 'T'), ANS, 'anselmo2')], blink: S(put(ans, 10, 5, 's'), ANS, 'anselmo-blink'),
      talk: [S(put(ans, 5, 8, 'wWoooWW'), ANS, 'anselmo-talk'), S(ansB, ANS, 'anselmo-talk2')], face: [2, 0, 15, 13], hand: [13, 14], pipe: [17, 8] };

    // Canto, the mole: pops out of his mound with round glasses, a pink star of a nose and big digging hands.
    const CANTO = { o: '#1e1624', F: '#4a3e5a', f: '#342a44', U: '#6a5e7e', N: '#f28aa0', n: '#c85a78', H: '#f0a8a0', h: '#c87a78', G: '#c8d8e8', g: '#ffffff', E: '#1d1826', D: '#6b4a30', d: '#4a3222', L: '#8a6a44' };
    const canto = [
      '......oooooo......',
      '....ooUUUUUFoo....',
      '...oUUUFFFFFFFo...',
      '..oUUFFFFFFFFFFo..',
      '..oUGGGFFFFGGGFo..',
      '.oFGgEGGooGgEGFFo.',
      '.oFFGGGFNNFGGGFFo.',
      '.oFFFFNnNNnNFFFFo.',
      '.oFFFFFNnnNFFFFFo.',
      'oHHoFFFFNNFFFFoHHo',
      'HhHHoFFFfffFFoHHhH',
      'oDDDDDDDDDDDDDDDDo',
      'oDLDDdDDLDDdDLDDdo',
      'odDDddDdDDddDDdDdo',
      '.oooooooooooooooo.'];
    const cantoB = edit(canto, [[6, 6, 'FNNNNF'], [6, 7, 'NnNNnN']]);   // the star nose sniffs
    B.canto = { idle: [S(canto, CANTO, 'canto'), S(cantoB, CANTO, 'canto2')], blink: S(put(put(canto, 3, 5, 'GGGG'), 10, 5, 'GGGG'), CANTO, 'canto-blink'),
      talk: [S(put(canto, 7, 9, 'FoooF'), CANTO, 'canto-talk'), S(canto, CANTO, 'canto-talk2')], face: [0, 0, 18, 11], hand: [15, 9] };

    // Don Pinzas, the crab cook: a tall chef's hat between his eye stalks, a curly moustache and a ladle.
    const PIN = { o: '#3a1418', R: '#d9503a', r: '#a8302a', L: '#f28a6a', W: '#ffffff', w: '#c8d0dc', E: '#1d1826', e: '#ffffff', K: '#2a1a14', S: '#c8c0b0', s: '#7a7468', M: '#5a1a1a' };
    const pin = [
      '.........oooo.........',
      '........oWWWWo........',
      '.......oWWWWWWo.......',
      '......oWWWwWWWWo......',
      '......oWWWWWwWWo......',
      '.......oWWWWWWo.......',
      '..oo...owwwwwwo...oo..',
      '.oeEo..oooooooo..oeEo.',
      '..oo..oLLRRRRRRo..oo..',
      '..o..oLRRRRRRRRRo..o..',
      '.oSo.oRRKKRRKKRRo.oLo.',
      'oSSso.oRRKMMKRRo.oLRRo',
      '.oso..oRRRRRRRRo..oRo.',
      '..os.oLRRRRRRRRRo.oRo.',
      '..os.oRRRRRRRRRro.oRo.',
      '...oooRrrrrrrrrro.oo..',
      '....oRo.oRo.oRo.oRo...',
      '....oo..oo..oo..oo....'];
    const pinB = edit(pin, [[17, 10, 'oRLo'], [17, 11, 'oLRRo'], [18, 12, '.oRo']]);   // the free claw snips
    B.pinzas = { idle: [S(pin, PIN, 'pinzas'), S(pinB, PIN, 'pinzas2')], blink: S(put(put(pin, 2, 7, 'oo'), 18, 7, 'oo'), PIN, 'pinzas-blink'),
      talk: [S(put(pin, 9, 11, 'KMooMK'), PIN, 'pinzas-talk'), S(pin, PIN, 'pinzas-talk2')], face: [3, 0, 16, 15], hand: [2, 11] };

    // Alga, the eel: rises in an S from her puddle, half-asleep, with a lazy smile.
    const ALGA = { o: '#14281e', G: '#4a8a4a', g: '#2f6a3a', L: '#7ab85a', Y: '#d8d890', y: '#b0b070', F: '#8ac86a', E: '#1d1826', e: '#ffffff', M: '#1d1826', w: '#5cc4bc', W: '#bdf0e4', d: '#2a8a90' };
    const alga = [
      '..............ooooo.....',
      '............ooLLGGGo....',
      '...........oLGGGGGGGo...',
      '...........oGGeEEGGGGo..',
      '...........oGGGGGGGGGGo.',
      '..........oGGGGGYMMYYYo.',
      '..........oGGGYYYYYYYo..',
      '.........oGGGYYYyoooo...',
      '.....F..oGGGYYyo........',
      '....FFooGGGYYyo.........',
      '...FFoGGGGYYyo..........',
      '....oGGGGYYyo...........',
      '...oGGGGYYYo............',
      '...oGGGGYYYYo...........',
      '....oGGGGYYYYoo.........',
      '..wwwoGGGGGYYYGoww......',
      '.wWWwwwoooooooowwWww....',
      '..wwdwwwwwwwwwwwwdw.....'];
    const algaL = shiftRows(alga, 0, 7, -1), algaR = shiftRows(alga, 0, 7, 1);
    B.alga = { idle: [S(algaL, ALGA, 'alga'), S(algaR, ALGA, 'alga2')], blink: S(put(algaL, 13, 3, 'gGGG'), ALGA, 'alga-blink'),
      talk: [S(put(algaL, 16, 5, 'YoooY'), ALGA, 'alga-talk'), S(algaL, ALGA, 'alga-talk2')], face: [8, 0, 16, 10], hand: [20, 6] };
    built = B; return B;
  }

  // ---- Who they are: name, colours of the dialogue box, pitch of the voice, and how they idle.
  const QUIEN = {
    ruca: { name: 'Ruca', edge: '#8aa84a', tag: '#d8f0b8', fondo: '#2e4a3a', voz: 150 },
    lumi: { name: 'Lumi', edge: '#e0b84a', tag: '#fff3b8', fondo: '#2a2a4e', voz: 520 },
    lapa: { name: 'Tía Lapa', edge: '#c8a06a', tag: '#f4dca8', fondo: '#3a3440', voz: 260 },
    olga: { name: 'Olga', edge: '#6a9ad0', tag: '#d8e8ff', fondo: '#3a3048', voz: 330 },
    anselmo: { name: 'Don Anselmo', edge: '#7a9a6a', tag: '#e8f0d8', fondo: '#2a3444', voz: 120 },
    canto: { name: 'Canto', edge: '#b08a5a', tag: '#f0d8b8', fondo: '#3a2c30', voz: 210 },
    pinzas: { name: 'Don Pinzas', edge: '#e0604a', tag: '#ffd0c0', fondo: '#3a2430', voz: 280 },
    alga: { name: 'Alga', edge: '#5aa86a', tag: '#d0f4d0', fondo: '#1e3a3c', voz: 170 } };
  for (const k in QUIEN) QUIEN[k].id = k;
  const art = who => build()[who.id];
  // The frame to show: talking alternates its two mouths, idling alternates its two poses slowly, with a blink.
  function frame(who, t, talking, seed = 0) {
    const a = art(who);
    if (talking) return a.talk[(t >> 3) % 2];
    const u = (t + seed) % 240; if (u < 6) return a.blink;
    return a.idle[((t + seed) >> 5) % 2];
  }
  function portrait(g, who, x, y, w, h, talking, t) {
    const a = art(who), f = frame(who, t, talking), [fx, fy, fw, fh] = a.face, s = Math.max(1, Math.min(Math.floor(w / fw), Math.floor(h / fh), 3));
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    const dx = Math.round(x + (w - fw * s) / 2), dy = Math.round(y + (h - fh * s) / 2) + (talking && (t >> 3) % 2 ? -1 : 0);
    g.drawImage(f, fx, fy, fw, fh, dx, dy, fw * s, fh * s);
    g.restore();
  }

  // ---------------------------------------------------------------- En el nivel
  const TALK_R = 34;
  function spawn(px, py, def, prev) {
    const who = QUIEN[def && def.quien] || QUIEN.ruca, a = art(who), f = a.idle[0];
    const e = { kind: 'maestro', who, def: def || { quien: 'ruca', dialogo: ['…'] }, x: px + 8 - Math.round(f.width / 2), y: py + 16 - f.height, w: f.width, h: f.height, t: (px * 7) % 200, dir: -1,
      met: false, done: false, talking: false, near: false, flag: 0, update, draw };
    if (prev) { e.met = prev.met; e.done = prev.done; }
    return e;
  }
  function given(e) { return !!(e.def.poder && Save.has(e.def.poder)); }
  // For captures and tests: every quest counts as done.
  let forced = false; const force = v => { forced = !!v; };
  // The quest's condition, checked every frame.
  function quest(e) {
    const q = e.def.encargo; if (!q || forced) return true;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    switch (q.tipo) {
      case 'entregar': return !!delivered(e);
      case 'faroles': { const n = q.n || L.ents.filter(o => o.kind === 'lantern').length; return L.lit.size >= n; }
      case 'apagar': { const r = q.radio || 5, tx = Math.floor(cx / TS), ty = Math.floor(cy / TS); for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (tileAt(x, y) === 'F') return false; return true; }
      case 'dianas': return L.hitTargets.size >= (q.n || 1);
    }
    return true;
  }
  function delivered(e) {
    const q = e.def.encargo, cx = e.x + e.w / 2, cy = e.y + e.h / 2, r = q.radio || 40;
    return L.ents.find(o => !o.dead && o.kind === q.cosa && !o.held && Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy) < r);
  }
  function update(e) {
    e.t++; const p = Player;
    if (!e.talking) e.dir = p.x + 5 < e.x + e.w / 2 ? -1 : 1;
    e.near = !p.dead && !p.win && Math.abs(p.x + 5 - (e.x + e.w / 2)) < TALK_R + e.w / 2 && Math.abs(p.y + p.h - (e.y + e.h)) < 30;
    const ok = quest(e);
    if (ok && !e.done && e.def.encargo && !given(e)) { e.done = true; e.flag = 40; Sound.play('switch'); Game.word('¡!', e.x + e.w / 2, e.y - 10, '#ffe36a', true); spawnParts(10, e.x + e.w / 2, e.y, { color: ['#ffe36a', '#fff6d6'], speed: [.5, 1.8], life: [14, 26], g: -.02 }); }
    if (e.flag > 0) e.flag--;
    // Fireflies and pipe smoke: each teacher has a little life of their own.
    const a = art(e.who);
    if (e.who.id === 'lumi' && e.t % 5 === 0) spawnParts(1, e.x + rnd(1, 7), e.y + e.h - 4 + fly(e), { color: ['#ffe36a', '#fff6d6'], speed: [0, .3], life: [14, 26], g: -.02 });
    if (a.pipe && e.t % 18 === 0) spawnParts(1, e.x + (e.dir > 0 ? a.pipe[0] : e.w - a.pipe[0]), e.y + a.pipe[1] - 1, { color: ['#c8d0d6', '#9fa8b0'], angle: -Math.PI / 2, spread: .3, speed: [.2, .4], life: [30, 50], g: -.01, kind: 'smoke' });
    if (e.near && !Charla.active() && !Game.learning && !regalo && p.onGround && !p.sucking && p.charge < 8 && !p.grapple && Input.pressed.up) talk(e);
  }
  const fly = e => art(e.who).float ? Math.round(Math.sin(e.t / 20) * 2) - 3 : 0;
  function draw(e, g) {
    const f = frame(e.who, e.t, e.talking, e.x | 0), img = e.dir > 0 ? f : ART.flip(f);
    const x = Math.round(e.x - Cam.x), y = Math.round(e.y - Cam.y) + fly(e);
    if (e.who.id === 'lumi') { g.globalAlpha = .2 + Math.sin(e.t / 9) * .06; g.fillStyle = '#ffe36a'; g.beginPath(); g.arc(x + (e.dir > 0 ? 4 : e.w - 4), y + 11, 10, 0, 7); g.fill(); g.globalAlpha = 1; }
    else { g.fillStyle = 'rgba(8,6,14,.35)'; g.fillRect(x + 2, Math.round(e.y - Cam.y) + e.h - 1, e.w - 4, 2); }
    g.drawImage(img, x, y);
    // Don Anselmo's rod leans on his shoulder, its line swaying.
    if (e.who.id === 'anselmo') { const d = e.dir, bx = x + (d > 0 ? 14 : e.w - 14), by = y + 14; g.fillStyle = '#6b4a30'; for (let k = 0; k < 22; k++) g.fillRect(bx + d * Math.round(k * .45), by - k, 1, 1); g.fillStyle = 'rgba(220,230,240,.5)'; const tx = bx + d * 10, ty = by - 22; for (let k = 0; k < 16; k++) g.fillRect(tx + d * Math.round(Math.sin(e.t / 30 + k / 5) * 2 + k * .3), ty + k, 1, 1); }
    // A bubble saying there is something to say (or, quest done, something to give).
    if (!e.near && !e.talking && !given(e)) {
      const bx = x + Math.round(e.w / 2) - 4, by = y - 12 + Math.round(Math.sin(e.t / 8));
      if (e.done || (e.met && e.def.encargo && quest(e))) { g.fillStyle = '#120c18'; g.fillRect(bx + 2, by - 1, 5, 11); g.fillStyle = '#ffe36a'; g.fillRect(bx + 3, by, 3, 6); g.fillRect(bx + 3, by + 7, 3, 2); }
      else if ((e.t >> 5) % 2 || !e.met) g.drawImage(ART.bubble, bx, by);
    }
  }
  // The prompt over the teacher when Nila is close: "↑ hablar", with the right key for the device.
  function drawOverlay(g) {
    if (regalo) drawGift(g);
    const e = L.maestro; if (!e || e.dead || !e.near || e.talking || Charla.active() || Game.learning || regalo || Game.paused || Player.dead) return;
    const cap = Input.mode === 'touch' ? '▲' : '↑', label = 'hablar', cw = ART.textWidth(cap) + 6, w = cw + ART.textWidth(label) + 8;
    const cx = Math.round(e.x - Cam.x + e.w / 2), y = Math.round(e.y - Cam.y) + fly(e) - 18 + ((e.t >> 4) % 2);
    const x = clamp(cx - Math.round(w / 2), 2, W - w - 2);
    g.fillStyle = '#120c18'; g.fillRect(x - 1, y - 1, w + 2, 13); g.fillStyle = 'rgba(27,36,48,.95)'; g.fillRect(x, y, w, 11); g.fillStyle = e.who.edge; g.fillRect(x, y, w, 1);
    g.fillStyle = '#120c18'; g.fillRect(cx - 2, y + 11, 5, 2); g.fillRect(cx - 1, y + 13, 3, 1); g.fillStyle = 'rgba(27,36,48,.95)'; g.fillRect(cx - 1, y + 11, 3, 1); g.fillRect(cx, y + 12, 1, 1);
    g.fillStyle = '#e8e0cc'; g.fillRect(x + 2, y + 2, cw, 8); g.fillStyle = '#a89a80'; g.fillRect(x + 2, y + 9, cw, 1);
    ART.text(g, cap, x + 2 + cw / 2, y + 2, '#1b2430', 'center');
    Letra.text(g, label, x + cw + 5, y + 1, { color: '#fff6d6', shadow: '#120c18' });
  }

  // ---- The talk: what they say depends on whether the trick is given and the quest done.
  function talk(e) {
    const d = e.def, q = d.encargo, first = !e.met; e.met = true; e.talking = true;
    let lines, give = false;
    if (given(e) || !d.poder) lines = [d.despedida || d.charla || '…'];
    else if (q && !quest(e)) lines = first ? [...(d.dialogo || []), q.pide] : [q.pide];
    else { lines = first ? [...(d.dialogo || [])] : []; if (q) lines.push(q.hecho || '¡Gracias! Toma.'); if (!lines.length) lines = ['Toma, Bigotes.']; give = true; }
    Player.vx = 0; Player.sucking = false; Sound.suck(false); Player.dir = e.x + e.w / 2 > Player.x + 5 ? 1 : -1;
    Charla.start({ quien: e.who, ent: e, lines, alFinal: give ? () => offer(e) : null });
  }
  // ---- The gift: the morsel leaves the teacher's hand, arcs over and drops into Bigotes' mouth.
  let regalo = null;
  const GIFT_T = 42;
  function offer(e) {
    const a = art(e.who), hx = e.dir > 0 ? e.x + a.hand[0] : e.x + e.w - a.hand[0], hy = e.y + a.hand[1] + fly(e);
    // A delivered thing is taken by the teacher.
    if (e.def.encargo && e.def.encargo.tipo === 'entregar') { const o = delivered(e); if (o) { o.dead = true; spawnParts(8, o.x + o.w / 2, o.y + o.h / 2, { color: ['#fff6d6', '#c9b08a'], speed: [.4, 1.4], life: [12, 22], g: .02 }); } }
    regalo = { e, t: 0, x0: hx, y0: hy, power: e.def.poder };
    Sound.play('select'); Player.dir = hx > Player.x + 5 ? 1 : -1;
  }
  function giftPos() { const r = regalo, m = Player.mouth(), k = Math.min(1, r.t / GIFT_T), e = k * k * (3 - 2 * k); return { x: r.x0 + (m.x - r.x0) * e, y: r.y0 + (m.y - r.y0) * e - Math.sin(k * Math.PI) * 28, k }; }
  function updateGift() {
    const r = regalo; r.t++;
    Player.animT++; updateParts(); r.e.t++;
    for (let i = L.words.length - 1; i >= 0; i--) { const w = L.words[i]; w.t++; if (w.t > w.life) L.words.splice(i, 1); }
    const p = giftPos();
    if (r.t % 2 === 0) spawnParts(1, p.x, p.y, { color: ['#ffe36a', '#fff6d6', '#e8fbff'], speed: [0, .3], life: [10, 20], g: -.01 });
    if (r.t === GIFT_T - 8) { Player.swallowT = 12; Sound.play('pop'); }
    if (r.t >= GIFT_T) {
      regalo = null;
      Game.learn(r.power, r.e.who.name); if (Game.learning && r.e.def.bocado) Game.learning.food = r.e.def.bocado;
    }
  }
  function drawGift(g) {
    const p = giftPos(), spr = ART.morsels[regalo.power]; if (!spr) return;
    const x = Math.round(p.x - Cam.x), y = Math.round(p.y - Cam.y), s = 1 + Math.sin(p.k * Math.PI) * .6;
    g.globalAlpha = .3; g.fillStyle = '#ffe36a'; g.beginPath(); g.arc(x, y, 7 * s, 0, 7); g.fill(); g.globalAlpha = 1;
    g.save(); g.translate(x, y); g.scale(s, s); g.rotate(p.k * 6); g.drawImage(spr, -4, -4); g.restore();
  }
  const busy = () => Charla.active() || !!regalo;
  function updateModal() {
    if (regalo) { updateGift(); return; }
    Charla.update();
    // The world holds still, but it still breathes: teachers blink, particles drift.
    if (L.maestro) L.maestro.t++;
    updateParts(); Cam.shakeOnly();
  }
  function reset() { regalo = null; Charla.stop(); }

  // ---- Capture: ?escena=maestro&n=<0..7>&t=frames — the teacher of that trick, with Nila next to him,
  // t frames into the talk (t=0: just the prompt; large t: the gift and the learning card).
  function capture(c) {
    const pw = POWER_ORDER[c.n] || 'soplido', i = LEVELS.findIndex(d => d.maestro && d.maestro.poder === pw);
    Save.data.powers = {}; NIVEL.poderesAntes(i).forEach(k => { Save.data.powers[k] = true; });
    Game.startLevel(i); Game.banner = 0;
    const e = L.maestro; if (!e) { Game.frozen = true; return; }
    force(true);
    Player.x = e.x - 26; Player.y = e.y + e.h - 18; Player.dir = 1; Player.onGround = true; Cam.snap();
    for (let n = 0; n < 30; n++) Game.updatePlay();
    if (c.t > 0) {
      talk(e);
      for (let n = 0; n < c.t; n++) {
        Input.pressed = {}; if (c.x > 0 && n % c.x === c.x - 1 && Charla.active()) Input.pressed.confirm = true;
        Game.updatePlay(); Game.t++;
      }
    }
    Input.pressed = {}; Game.frozen = true;
  }
  // The sprite sheet of every teacher and frame, for checking the art: ?escena=maestros
  function sheet(g, t) {
    g.fillStyle = '#5a6a7a'; g.fillRect(0, 0, W, H);
    const B = build(); let x = 4, y = 4, rowH = 0;
    const page = (Game.capture && Game.capture.n) || 0;   // ?escena=maestros&n=0, 1 or 2: three teachers a page
    for (const k of Object.keys(QUIEN).slice(page * 3, page * 3 + 3)) {
      const a = B[k], frames = [a.idle[0], a.idle[1], a.blink, a.talk[0], a.talk[1]];
      let w = 0; for (const f of frames) w += f.width * 2 + 3;
      if (x + w > W) { x = 4; y += rowH + 12; rowH = 0; }
      ART.text(g, QUIEN[k].name, x, y, '#fff6d6');
      for (const f of frames) { g.drawImage(f, x, y + 9, f.width * 2, f.height * 2); x += f.width * 2 + 3; rowH = Math.max(rowH, f.height * 2); }
      x += 6;
    }
  }
  return { QUIEN, spawn, busy, updateModal, drawOverlay, portrait, capture, sheet, reset, quest, force, frame, build };
})();
