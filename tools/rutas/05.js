// Ruta del bot · 5 · El muelle del pescador (provisional). Don Anselmo pide su caja (encargo «entregar»)
// antes de dar el anzuelo; con el mordisco se sube el pozo de los anzuelos.
'use strict';
const { R, D, near, TALK } = require('./comun');
module.exports = { id: 'muelle', steps: [
  R(20, 11), TALK({ learns: false }),
  near('crate', -2), D('face', 1), D('suck', 40), R(24, 11), D('drop'), { wait: 20 },
  TALK({ side: 2 }),
  R(48, 11), { hold: { fish: 1, up: 1 }, n: 140 },
  { hold: { left: 1, jump: 1 }, n: 14 }, { hold: { fish: 1, up: 1 }, n: 160 }, { check: g => g.P.hanging || 'no volvió al aro' }, { hold: { fish: 1, up: 1, right: 1, jump: 1 }, n: 12 }, R(52, 1),
  R(62, 1), R(70, 11), R(77, 10, { tol: 2 })] };
