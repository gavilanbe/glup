// GLUP — nivel 5 · El muelle del pescador (PROVISIONAL: un esbozo corto que se puede terminar; se rediseñará).
// Don Anselmo quiere su caja de aparejos (encargo «entregar») y a cambio da el anzuelo: el mordisco sube el pozo.
'use strict';
(() => {
  const { screen, join, G3 } = NIVEL;
  const muelle = join(
    screen(
      '....................',
      '....................',
      '..............*.....',
      '....................',
      '....................',
      '..@..N....c.........', ...G3),
    screen(
      '....................',
      '....................',
      '.........*..........',
      '....................',
      '....................',
      '.L....Q....,........', ...G3),
    screen(
      '....................',
      '..........##########',
      '........O.##########',
      '......*...##########',
      '..........##########',
      '.......O..##########',
      '..........##########',
      '..........##########',
      '........O.##########',
      '..........##########',
      '..........##########', ...G3),
    screen(
      '....................',
      '######..............',
      '######..............',
      '######......*.......',
      '######..............',
      '######..............',
      '######..............',
      '######..............',
      '######..............',
      '######..............',
      '######...L.......E..',
      '################~~~~',
      '################~~~~',
      '####################'));
  NIVEL.registrar({ id: 'muelle', name: 'El muelle del pescador', theme: 'dusk', music: 'dock', par: 90, rows: muelle,
    intro: 'En el muelle viejo, un pescador vio pasar a la Garza.',
    ruca: ['Don Anselmo lleva toda la vida pescando aquí. Si alguien sabe de anzuelos, es él.'],
    signs: [],
    maestro: { quien: 'anselmo', poder: 'mordisco',
      dialogo: ['Buenas tardes, pequeña. ¿Una garza grande? La vi pasar esta mañana, con el buche lleno.',
        'Así que ese pez gato tuyo quiere morder anzuelos... Los peces listos muerden el cebo y no el hierro. Bueno, ya veremos.'],
      despedida: 'Sorbe hacia el anzuelo, que el pez lo pique, y el sedal os sube. ¡Buena pesca!',
      encargo: { tipo: 'entregar', cosa: 'crate', radio: 48,
        pide: 'Pero antes, ¿me traes mi caja de aparejos? Se me quedó en la orilla, ahí atrás. Déjala a mis pies.',
        hecho: '¡Mi caja! Aquí guardo el mejor anzuelo del pantano. Es tuyo, Bigotes.' } },
    secretos: [{ poder: 'panzazo', crias: 1 }] });
})();
