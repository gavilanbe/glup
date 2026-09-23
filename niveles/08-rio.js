// GLUP — nivel 8 · El río subterráneo (PROVISIONAL: un esbozo corto que se puede terminar; se rediseñará).
// Alga, la anguila, da el alga resbaladiza: el resbalón cruza el túnel bajo antes de que se cierre la compuerta.
'use strict';
(() => {
  const { screen, join, G3 } = NIVEL;
  const rio = join(
    screen(
      '....................',
      '....................',
      '............*.......',
      '....................',
      '..........===.......',
      '....................',
      '....................',
      '..@.N....Q.......L..', ...G3),
    screen(
      '....................',
      '....................',
      '....................',
      '.....###############',
      '.....###############',
      '.....###############',
      '.....###############',
      '.?..V...............', ...G3),
    screen(
      '....................',
      '....................',
      '....................',
      '#############.......',
      '#############.......',
      '#############.......',
      '#############.......',
      '..........G.....*...', ...G3),
    screen(
      '....................',
      '.......*............',
      '..L..........E......',
      '##########~~~~~~~~~~',
      '##########~~~~~~~~~~',
      '####################'));
  NIVEL.registrar({ id: 'rio', name: 'El río subterráneo', theme: 'cave', music: 'cave', par: 90, rows: rio,
    intro: 'Bajo la cueva, el agua corre a oscuras hacia el ciprés muerto.',
    ruca: ['Ya casi estamos. Este río sale justo al pie del ciprés de la Garza.'],
    signs: ['Sopla al molinillo con {puff} y corre. Corriendo, {down} y Nila se desliza sobre Bigotes.'],
    maestro: { quien: 'alga', poder: 'resbalon',
      dialogo: ['Mmmh... ¿qué? Ah, hola. Estaba echando una siesta. Aquí abajo siempre es de noche, ¿sabes?',
        '¿Ese túnel? Se pasa resbalando, como yo. Sin prisa... pero muy deprisa.',
        'Toma, un alga resbaladiza. Un bocado y ya no hay quien te pare.'],
      despedida: 'Corriendo, {down}: Nila se desliza sobre Bigotes. Cuidado con los techos bajos... o no.' },
    secretos: [] });
})();
