// GLUP — nivel 1.
'use strict';
(() => {
  const { screen, join, G3 } = NIVEL;
  // ---------------------------------------------------------------- 1 · El embarcadero
  // Sorber, escupir, agacharse y la caja; a mitad, Ruca da el soplido (vilano) para el molinillo.
  const embarcadero = join(
    screen(
      '...............*....',
      '....................',
      '..............###...',
      '.@..N...,....####.,.',
      '========############',
      '~~~~~~~~############',
      '~~~~~~~~############'),
    screen(
      '..............x.....',
      '..............x.....',
      '..............x.....',
      '..............x.....',
      '..............x.....',
      '..?.r....s....x..*..', ...G3),
    screen(
      '...#############....',
      '...#############....',
      '...#############....',
      '...#############....',
      '...#############....',
      '..?.....*......,....', ...G3),
    screen(
      '....................',
      '.......*.....#######',
      '.............#######',
      '.............#######',
      '..c...?......#######', ...G3),
    screen(
      '..........*.........',
      '....................',
      '....................',
      '#####...............',
      '#####..........#####',
      '#####..........#####',
      '#####..........#####', ...G3),
    screen(
      '####................',
      '####................',
      '####...........*....',
      '####................',
      '####................',
      '####~w~~w~~w~~w~w~##',
      '####~~~~~~~~~~~~~~##',
      '####################'),
    screen(
      '................###.',
      '................###.',
      '................###.',
      '.................G..',
      '.................G..',
      '........*........G..',
      '.................G..',
      '.................G..',
      '.................G..',
      '.................G..',
      '.L....Q.....V....G..', ...G3),
    screen(
      '....................',
      '.......m......m.....',
      '....................',
      '....................',
      '...*f.........f..H..',
      '####====~~~=====####',
      '####~~~~~~~~~~~~####',
      '####################'),
    screen(
      '....................',
      '.......*............',
      '....................',
      '..............######',
      '..............######',
      '..............######',
      '..c....?......######', ...G3),
    screen(
      '..........*.........',
      '....................',
      '######..............',
      '######....======....',
      '######..............',
      '######..............',
      '######..........m...',
      '######..s.......r...', ...G3),
    screen(
      '....................',
      '.............x######',
      '.............x..*.##',
      '....f........x..H.##', ...G3),
    screen(
      '....................',
      '....................',
      '..,..L.....E........',
      '#########~~~~~~~~~~~',
      '#########~~~~~~~~~~~',
      '####################'));
  NIVEL.registrar({ id: 'embarcadero', name: 'El embarcadero', theme: 'dusk', music: 'marsh', par: 210, rows: embarcadero,
    intro: 'La Garza voló río arriba con las crías en el buche.',
    ruca: ['¡Nila! La Garza se ha llevado a todas las crías del pantano. Bigotes es el único que queda. Síguela: {move} para andar, {jump} para saltar.'],
    signs: [
      'Mantén {fish}: Bigotes sorbe lo que tenga delante. Con la boca llena, pulsa {fish} y lo escupe. Prueba contra la roca rajada.',
      'Por la madriguera se pasa agachada: mantén {down}.',
      'Sorbe la caja y escúpela contra el saliente: se queda donde cae. Con {down} y {fish} la sueltas a tus pies.',
      'Muy alto. Súbete antes a la caja.'],
    maestro: { quien: 'ruca', poder: 'soplido',
      dialogo: ['¡Uf, qué carrera! Por mis atajos se llega antes, pero se aprende poco.',
        'Ese molinillo abre la compuerta mientras gira. Y para que gire hace falta viento.',
        'Toma, Bigotes: un vilano de diente de león. Trágatelo y sopla con ganas.'],
      despedida: 'Sopla al molinillo con {puff} y cruza antes de que pare. Nos vemos río arriba.' },
    secretos: [{ poder: 'aleteo', crias: 3 }, { poder: 'mordisco', crias: 1 }] });
})();
