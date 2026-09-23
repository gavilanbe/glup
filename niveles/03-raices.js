// GLUP — nivel 3 · El bosque de raíces (PROVISIONAL: un esbozo corto que se puede terminar; se rediseñará).
// Tía Lapa enseña la ventosa; la chimenea de raíces sólo se sube pegándose a los muros.
'use strict';
(() => {
  const { screen, join, G3 } = NIVEL;
  const raices = join(
    screen(
      '....................',
      '....................',
      '....................',
      '....................',
      '.............*......',
      '....................',
      '...........===......',
      '....................',
      '....................',
      '..@..N..,.....s.....', ...G3),
    screen(
      '....................',
      '....................',
      '.................O..',
      '....................',
      '.................*..',
      '................####',
      '....................',
      '....................',
      '....................',
      '....................',
      '.L.....Q............', ...G3),
    screen(
      '....................',
      '.........*..........',
      '...........#########',
      '.......M...M########',
      '.......M...M########',
      '.......M...M########',
      '.......M...M########',
      '.......M...M########',
      '.......M...M########',
      '...........M########',
      '...........M########', ...G3),
    screen(
      '....................',
      '....................',
      '#####...............',
      '#####...............',
      '#####.........*.....',
      '#####...............',
      '#####...............',
      '#####...............',
      '#####...............',
      '#####...............',
      '#####....L.......E..',
      '################~~~~',
      '################~~~~',
      '####################'));
  NIVEL.registrar({ id: 'raices', name: 'El bosque de raíces', theme: 'night', music: 'marsh', par: 90, rows: raices,
    intro: 'Bajo los cipreses, las raíces trepan como muros.',
    ruca: ['Aquí las raíces crecen hacia arriba, como paredes. Dicen que una lapa vieja sabe cómo subirlas.'],
    signs: [],
    maestro: { quien: 'lapa', poder: 'ventosa',
      dialogo: ['¿Y tú qué miras? Nunca has visto una lapa, ¿eh? Pues aquí me tienes, pegada a mi roca desde antes de que nacieras.',
        '¿Subir las raíces? Hay que agarrarse. Como yo. Nadie se agarra como una lapa.',
        'Hmpf. Anda, toma una lapa del pantano. Que el pez aprenda a pegarse, que buena falta le hace.'],
      despedida: 'Empuja contra el muro de raíces y salta de pared en pared. Y no me hagas repetirlo.' },
    secretos: [{ poder: 'mordisco', crias: 1 }] });
})();
