// Ruta del bot · 1 · El embarcadero (sin trucos; Ruca da el soplido a mitad).
'use strict';
const { R, D, near, TALK } = require('./comun');
module.exports = { id: 'embarcadero', steps: [
  R(16, 9), R(23, 11), D('face', 1), D('suck', 40), D('spit', 1), { wait: 30 }, R(37, 11),
  R(58, 11, { crouch: true }), R(60, 11), D('face', 1), D('suck', 40), D('spit', 1), { wait: 20 },
  near('crate', -2, 66), D('face', 1), D('suck', 40), R(72, 11), D('drop'), R(75, 7),
  R(85, 11), R(96, 8), R(105, 11), R(108, 11), R(111, 11), R(114, 11), R(116, 11), R(119, 11),
  TALK(), R(130, 11), D('puff', 1), R(140, 11),
  R(142, 11), D('puff', 1), R(157, 11),
  R(160, 11), D('face', 1), D('suck', 40), R(172, 11), D('drop'), R(176, 7),
  R(193, 11), D('face', 1), D('suck', 40), D('spit', 1), { wait: 60 },
  near('rock', -2), D('face', 1), D('suck', 40), D('spit', 1), { wait: 30 }, R(216, 11), R(215, 8, { tol: 1 }),
  R(231, 10, { tol: 2 })] };
