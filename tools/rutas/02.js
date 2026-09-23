// Ruta del bot · 2 · Los juncos (llega con el soplido; Lumi da el aleteo).
'use strict';
const { R, D, UP, FLAP, RAFT, near, TALK } = require('./comun');
module.exports = { id: 'juncos', steps: [
  near('rock', -2), D('face', 1), D('suck', 40), R(24, 11), D('face', 1), D('spit', 1), { wait: 40 }, near('crab', -2), D('face', 1), D('suck', 40), D('spit', 1), { wait: 30 },
  { check: g => g.L.hitTargets.size === 1 || 'la diana 1 no se abrió' }, R(28, 11), ...FLAP(0), R(38, 11),
  R(41, 11), R(44, 10, { tol: 1 }), RAFT, R(58, 11),
  TALK(), R(65, 7), R(69, 3), R(73, 2), R(84, 2), R(95, 11),
  R(108, 11), R(108, 8), R(105, 5), R(108, 2), R(112, 1),
  R(127, 11), near('rock', -2), D('face', 1), D('suck', 40), R(131, 11), D('face', 1), ...UP, { wait: 30 },
  { check: g => g.L.hitTargets.size === 2 || 'la diana 2 no se abrió' }, R(138, 11),
  R(141, 11), R(146, 8), R(153, 8), R(157, 11),
  near('rock', -2), D('face', 1), D('suck', 40), D('spit', 1), { wait: 20 }, D('suck', 40), D('spit', 1), { wait: 20 }, D('suck', 40),
  R(172, 11), D('face', 1), D('spit', 1), { wait: 30 },
  { check: g => g.L.hitTargets.size === 3 || 'la diana 3 no se abrió' }, R(167, 11), ...FLAP(0), R(178, 11),
  R(189, 8), R(197, 10, { tol: 2 })] };
