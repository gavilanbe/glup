// GLUP — revisa los niveles: filas de 20, caracteres conocidos, carteles, bocados y parejas diana/compuerta.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'levels.js'), 'utf8').replace(/screen\(\s*\n?/g, m => m);
// Re-run the level source with a screen() that reports bad rows before padding hides them.
const checked = src.replace("function screen(...rows) {", "function screen(...rows) { rows.forEach(r => { if (r.length !== 20) console.log('FILA DE', r.length, JSON.stringify(r)); });");
const ctx = vm.createContext({ console }); vm.runInContext(checked + ';this.LEVELS = LEVELS;', ctx);
const KNOWN = '.#=w~^FxXGTPVORM!%crsfmKB*HLE@?N,"\'';
ctx.LEVELS.forEach((lv, i) => {
  const rows = lv.rows, count = ch => rows.join('').split(ch).length - 1;
  const bad = [...new Set(rows.join(''))].filter(c => !KNOWN.includes(c));
  const gates = []; const seen = new Set();
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'G' && !seen.has(x)) { seen.add(x); gates.push(x); } }));
  const trig = []; rows.forEach((r, y) => [...r].forEach((c, x) => { if ('TPV'.includes(c)) trig.push(c + x); }));
  console.log(i, lv.name, 'ancho', rows[0].length / 20, 'pantallas', '· crías', count('*'), '· carteles', count('?') + '/' + lv.signs.length, '· Ruca', count('N') + '/' + lv.ruca.length, '· bocados', count('!') + '/' + (lv.powers || []).length, '· compuertas', gates.join(','), '· gatillos', trig.join(','), bad.length ? 'RAROS ' + bad : '');
});
