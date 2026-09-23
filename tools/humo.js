// GLUP — prueba de humo: dibuja cada nivel, la charla con su maestro (con el encargo cumplido a la
// fuerza), el regalo del bocado y la ceremonia de aprenderlo, el fin de nivel y el mapa (con el muro
// de zarzas cerrado y abierto, y la explicación de Ruca). Sólo comprueba que nada revienta.
//   node tools/humo.js
'use strict';
const { load } = require('./sim');
const g = load();
const draw = () => g.ev("Game.draw(document.createElement('canvas').getContext('2d'))");
let fails = 0;
const step = (label, fn) => { try { fn(); console.log('ok   ' + label); } catch (e) { fails++; console.log('FAIL ' + label + ': ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); } };
g.LEVELS.forEach((lv, i) => {
  step((i + 1) + ' ' + lv.id + ': nivel', () => { g.start(i, g.NIVEL.poderesAntes(i)); for (let n = 0; n < 40; n++) { g.frame({ right: n % 3 === 0 ? 1 : 0 }); if (n % 10 === 0) draw(); } });
  if (!lv.maestro) return;
  step((i + 1) + ' ' + lv.id + ': maestro, regalo y ceremonia', () => {
    g.start(i, g.NIVEL.poderesAntes(i));
    const e = g.L.maestro; if (!e) throw new Error('sin Q');
    g.P.x = e.x + e.w / 2 - 30; g.P.y = e.y + e.h - 18; g.run({}, 10); draw();
    if (!e.near) throw new Error('Nila no queda cerca del maestro');
    if (lv.maestro.encargo) { g.frame({ up: 1 }); for (let n = 0; n < 600 && g.Charla.active(); n++) { g.frame(n % 6 === 0 ? { confirm: 1 } : {}); if (n % 7 === 0) draw(); } g.ev('Maestros.force(true)'); }
    g.frame({}); g.frame({ up: 1 });
    // Read the lines one by one, then watch the gift and the card (the sim skips the card, so drive it by hand here).
    for (let n = 0; n < 900 && (g.Charla.active() || g.Maestros.busy()); n++) { g.ev('Input.held = {}; Input.pressed = ' + (n % 9 === 0 && g.Charla.active() ? '{ confirm: true }' : '{}') + '; Game.update(); Input.pressed = {};'); if (n % 5 === 0) draw(); }
    for (let n = 0; n < 400 && g.Game.learning; n++) { g.ev('Input.pressed = ' + (g.Game.learning.t > 160 ? '{ confirm: true }' : '{}') + '; Game.update();'); if (n % 6 === 0) draw(); }
    if (!g.Save.has(lv.maestro.poder)) throw new Error('no aprendió ' + lv.maestro.poder);
    g.frame({ up: 1 }); for (let n = 0; n < 300 && g.Charla.active(); n++) { g.frame(n % 6 === 0 ? { confirm: 1 } : {}); if (n % 7 === 0) draw(); }
    g.ev('Maestros.force(false)');
  });
});
step('fin de nivel y vuelta al mapa', () => {
  g.start(2, g.NIVEL.poderesAntes(2));
  g.ev("Victoria.capture({ n: 2, t: 0, x: 1 })"); g.ev('Game.frozen = false; Game.capture = null');
  for (let n = 0; n < 900 && g.Game.state !== 'select'; n++) { g.frame(n % 30 === 0 ? { confirm: 1 } : {}); if (n % 9 === 0) draw(); }
  if (g.Game.state !== 'select') throw new Error('no volvió al mapa (' + g.Game.state + ')');
  for (let n = 0; n < 60; n++) { g.frame({}); if (n % 6 === 0) draw(); }
});
step('mapa: muro cerrado, Ruca lo explica y no deja entrar', () => {
  g.ev("Save.data = Save.fresh(); LEVELS.forEach(d => { Save.data.abiertos[d.id] = true; }); Game.select(7, 8);");
  for (let n = 0; n < 200 && !g.Charla.active(); n++) { g.frame({}); if (n % 9 === 0) draw(); }
  if (!g.Charla.active()) throw new Error('Ruca no explicó el muro');
  for (let n = 0; n < 900 && g.Charla.active(); n++) { g.frame(n % 6 === 0 ? { confirm: 1 } : {}); if (n % 7 === 0) draw(); }
  g.frame({}); g.frame({ confirm: 1 }); g.run({}, 3); draw();
  if (g.Game.fadeTo) throw new Error('entró en el nido sin crías');
  for (let n = 0; n < 900 && g.Charla.active(); n++) g.frame(n % 6 === 0 ? { confirm: 1 } : {});
});
step('mapa: muro abierto', () => {
  g.ev("LEVELS.forEach(d => { const s = Save.criasSet(d.id); NIVEL.criasDe(d).forEach(k => { s[k] = 1; }); }); Game.select();");
  for (let n = 0; n < 40; n++) { g.frame(n === 20 ? { right: 1 } : {}); if (n % 5 === 0) draw(); }
  if (g.ev('Save.locked(8)')) throw new Error('sigue cerrado con todas las crías');
});
step('partida vieja (v1) migrada', () => {
  g.ev(`localStorage.setItem('glup.v1', JSON.stringify({ unlocked: 2, pearls: { 0: 6, 1: 10 }, totals: { 0: 11, 1: 10 }, best: { 0: 245 }, powers: { aleteo: true, soplido: true }, seen: { intro: true } })); Save.load();`);
  const d = g.Save.data;
  if (!d.abiertos.molino || d.best.embarcadero !== 245 || g.ev('Save.criasGot(0)') !== 6 || g.ev('Save.criasGot(1)') !== 10) throw new Error('migración: ' + JSON.stringify(d));
  g.ev('Game.select()'); for (let n = 0; n < 10; n++) { g.frame({}); draw(); }
});
console.log(fails ? fails + ' fallos' : 'Sin fallos.');
process.exit(fails ? 1 : 0);
