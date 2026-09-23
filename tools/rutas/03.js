// Ruta del bot · 3 · El bosque de raíces (provisional; Tía Lapa da la ventosa para la chimenea de raíces).
'use strict';
const { R, TALK } = require('./comun');
module.exports = { id: 'raices', steps: [
  R(14, 7), R(20, 11), TALK(), R(35, 11), R(45, 11), R(53, 2), R(64, 2), R(70, 11), R(77, 10, { tol: 2 })] };
