// Ruta del bot · 4 · El molino anegado (llega con soplido, aleteo y ventosa; Olga da el trago de agua).
'use strict';
const { R, D, DO, HOVER, JET, WATER, UNTIL, near, TALK } = require('./comun');
module.exports = { id: 'molino', steps: [
  TALK(), R(24, 11), D('face', 1), D('suck', 40), D('spit', 1), { wait: 30 }, R(40, 11), R(45, 11), D('face', 1), D('suck', 40), ...HOVER(1, 14, 14), { hold: { right: 1 }, n: 14 }, { hold: { fish: 1, right: 1 }, n: 110 }, R(60, 11), D('spit', -1), { wait: 10 },
  near('crate', -2), D('face', 1), D('suck', 40), R(70, 11), D('drop'), { wait: 40 }, R(77, 11), R(82, 11), R(90, 11),
  // The mushroom in the pit bounces her up; a flap at the top reaches the roof.
  R(107, 11), DO('seta, aleteo y al tejado', g => { let flap = false; for (let n = 0; n < 200; n++) { const inp = { right: 1 }; if (!flap && n > 20 && g.P.vy > -.8 && g.P.y < 120) { inp.jump = 1; flap = true; } g.frame(inp); if (flap && g.P.onGround) break; } return (g.P.onGround && g.P.y < 70) || 'no llegó al tejado'; }), R(125, 4), R(133, 4, { tol: 1 }), R(133, 11), { hold: { left: 1 }, n: 1 }, { hold: { fish: 1 }, n: 80 }, { wait: 2 }, D('spit', 1), { wait: 20 }, D('face', -1), D('suck', 40), D('spit', 1), { wait: 30 },
  R(143, 11), D('face', 1), D('suck', 40), ...HOVER(1, 20, 6), R(151, 11, JET), WATER(1), UNTIL('mosquito lejos', g => g.L.ents.filter(e => e.kind === 'mosquito' && Math.abs(e.x - g.P.x) < 200).every(e => e.dir > 0 && e.x > 2470)), ...HOVER(1, 110, 4), R(168, 11), { hold: { jump: 1 }, n: 40 },
  near('crate', -2), D('face', 1), D('suck', 40), R(190, 8, { tol: 1 }), D('drop'), { wait: 30 },
  { hold: { jump: 1, right: 1 }, n: 16 }, { hold: { right: 1 }, n: 1 }, { hold: { jump: 1, right: 1 }, n: 14 }, R(200, 11), D('face', 1), D('suck', 40), D('spit', 1), { wait: 30 },
  R(209, 11), { hold: { jump: 1 }, n: 30 }, R(214, 10, { tol: 2 }), { hold: { right: 1 }, n: 30 }] };
