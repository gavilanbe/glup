// Ruta del bot · 8 · El río subterráneo (provisional). Alga da el resbalón: soplar al molinillo y cruzar
// el túnel bajo resbalando antes de que se cierre la compuerta.
'use strict';
const { R, D, SLIDE_AT, TALK } = require('./comun');
module.exports = { id: 'rio', steps: [
  TALK(), R(17, 11), R(22, 11), D('face', 1), D('puff', 1), { check: g => g.L.ents.some(e => e.kind === 'pinwheel' && e.spin > 0) || 'el molinillo no gira' },
  R(18, 11), SLIDE_AT(23 * 16, 1, 220), R(56, 11), R(66, 11), R(73, 10, { tol: 2 }), { hold: { right: 1 }, n: 30 }] };
