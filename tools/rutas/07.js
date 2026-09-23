// Ruta del bot · 7 · La cueva de barro (llega con todo menos guindilla y resbalón). Don Pinzas quiere
// el fogón apagado (encargo «apagar»): agua de la charquita de al lado, escupida al fuego.
'use strict';
const { R, D, DO, FLAP, WATER, near, TALK } = require('./comun');
module.exports = { id: 'cueva', steps: [
  TALK({ learns: false }), R(12, 11), WATER(1), D('spit', -1), { wait: 30 }, { check: g => g.tileAt(9, 10) !== 'F' || 'el fogón sigue encendido' },
  TALK({ side: 2 }),
  near('rock', -2), D('face', 1), D('suck', 40), R(16, 11), D('charge', 1), { wait: 40 }, R(20, 11), R(40, 11),
  R(42, 11), WATER(1), D('spit', 1), { wait: 30 }, R(51, 11), ...FLAP(0),
  R(62, 11), D('face', 1), D('puff', 1), { check: g => g.L.ents.some(e => e.kind === 'pinwheel' && e.spin > 0) || 'el molinillo no gira' },
  DO('corre por el túnel antes de que se cierre', g => { for (let n = 0; n < 400 && g.P.x < 93 * 16; n++) g.frame({ right: 1 }); return g.P.x >= 93 * 16 || 'la compuerta se cerró'; }),
  R(96, 11), R(109, 11), { hold: { fish: 1, up: 1 }, n: 160 },
  { hold: { left: 1, jump: 1 }, n: 18 }, { hold: { fish: 1, up: 1 }, n: 160 }, { check: g => g.P.hanging || 'no volvió al aro' }, { hold: { fish: 1, up: 1, right: 1, jump: 1 }, n: 12 }, R(114, 1, { tol: 1 }), R(126, 1),
  DO('espera a los cangrejos', g => { for (let n = 0; n < 3000 && !g.L.ents.filter(e => e.kind === 'crab' && e.x > 2040).every(e => e.x > 2100); n++) g.frame({}); }),
  DO('salto a la cría y panzazo', g => { while (g.P.x < 2040) g.frame({ right: 1 }); g.frame({ right: 1, jump: 1 }); for (let n = 0; n < 60 && g.P.x < 2070; n++) g.frame({ right: 1, jump: 1 }); g.frame({}); g.run({ down: 1, jump: 1 }, 2); for (let n = 0; n < 80 && g.P.pound; n++) g.frame({ down: 1 }); return !g.P.pound || 'sin panzazo'; }), { wait: 4 }, DO('atrás', g => { for (let n = 0; n < 20 && g.P.x > 2050; n++) g.frame({ left: 1 }); g.run({}, 6); g.frame({ right: 1 }); }),
  DO('sorbe la piedra', g => { for (let n = 0; n < 30 && !g.P.held; n++) g.frame({ fish: 1 }); g.frame({}); return !!g.P.held || 'sin piedra'; }),
  { hold: { fish: 1 }, n: 44 }, { wait: 30 }, { check: g => g.L.hitTargets.size === 1 || 'la diana no se abrió' },
  R(139, 11), near('rock', -2), D('face', 1), D('suck', 40), R(143, 11), { wait: 24 }, D('charge', 1), { wait: 40 }, R(157, 11), R(167, 11), R(172, 10, { tol: 2 }), { hold: { right: 1 }, n: 30 }] };
