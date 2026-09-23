// Ruta del bot · 6 · La turbera (provisional). Canto pide los dos faroles encendidos (encargo «faroles»);
// con el panzazo se rompe la costra agrietada y se sigue por debajo del muro.
'use strict';
const { R, TALK } = require('./comun');
module.exports = { id: 'turbera', steps: [
  R(10, 7), R(20, 7), TALK({ learns: false }), R(35, 7), { check: g => g.L.lit.size === 2 || 'faltan faroles' }, TALK({ side: 2 }),
  R(46, 7), { hold: { jump: 1 }, n: 8 }, { hold: {}, n: 1 }, { hold: { down: 1, jump: 1 }, n: 2 }, { hold: { down: 1 }, n: 30 }, { wait: 20 },
  R(46, 12), R(60, 12), R(72, 12), R(75, 11, { tol: 2 }), { hold: { right: 1 }, n: 30 }] };
