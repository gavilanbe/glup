// GLUP — niveles. Cada nivel se compone de pantallas de 20×14 tiles que se
// pegan de izquierda a derecha; las filas que faltan arriba se rellenan de aire.
// Leyenda:
//   #  barro sólido        =  tablón o rama (se atraviesa desde abajo)   w  nenúfar (igual, flota)
//   ~  agua (te hundes)    ^  espinas            F  fuego fatuo (se apaga con agua)
//   x  piedra agrietada (una pedrada o un panzazo rompe todo el bloque)   X  piedra reforzada (sólo el escupitajo picante)
//   G  compuerta   T  diana (la abre para siempre)   P  placa (la abre mientras algo pese)   V  molinillo (la abre mientras gira con el soplido)
//   O  aro: sorbe hacia él (arriba o de frente) y Bigotes iza a Nila      R  balsa: sopla hacia atrás para impulsarla
//   M  muro de raíces: Nila resbala por él y puede saltar de pared en pared
//   !  bocado: Bigotes lo traga y aprende un truco (los trucos van en `powers`, por orden)
//   %  seta saltarina      c  caja               r  piedra
//   s  caracol   f  rana   m  mosquito   K  cangrejo   B  la Garza
//   *  cría de pez gato en su burbuja    H  corazón   L  farol (punto de control)   E  barca (salida)   @  Nila
//   ?  cartel (los textos van en `signs`)   N  Ruca, la tortuga (sus frases van en `ruca`)   , "  decoración (mata, seta)
// Medidas (tools/bot.js las comprueba): Nila salta tres celdas de alto y tres de hueco; con el aleteo, cinco de alto
// y seis de hueco; subida a una caja y aleteando, seis. Más arriba sólo llegan los aros, las raíces y las setas.
// Las dianas, placas y molinillos se emparejan con las compuertas por orden de izquierda a derecha.
'use strict';
const LEVELS = (() => {
  const H = 14;
  function screen(...rows) { while (rows.length < H) rows.unshift('....................'); return rows.map(r => r.padEnd(20, '.').slice(0, 20)); }
  function join(...screens) {
    const rows = []; for (let y = 0; y < H; y++) rows.push(screens.map(s => s[y]).join(''));
    return rows;
  }
  const G3 = ['####################', '####################', '####################'];

  // ---------------------------------------------------------------- 1 · El embarcadero
  // Sorber, escupir, agacharse y la caja; luego el aleteo (libélula) y el soplido (vilano).
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
      '...............#####',
      '#####..........#####',
      '#####..........#####',
      '#####..........#####',
      '#####.....!....#####', ...G3),
    screen(
      '####................',
      '####................',
      '####...........*....',
      '####................',
      '####................',
      '####~w~~~~~w~~~~w~##',
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
      '.L....!.....V....G..', ...G3),
    screen(
      '....................',
      '.......m......m.....',
      '....................',
      '....................',
      '...*f.........f..H..',
      '####====~~~~====####',
      '####~~~~~~~~~~~~####',
      '####################'),
    screen(
      '....................',
      '.......*......######',
      '..............######',
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

  // ---------------------------------------------------------------- 2 · Los juncos
  // Cangrejos, dianas y la balsa; luego la ventosa (lapa) en la chimenea de raíces y el mordisco (anzuelo) en los aros.
  const juncos = join(
    screen(
      '....................',
      '....................',
      '..@..N..,..s...r,...', ...G3),
    screen(
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '........*.....G.....',
      '..............G.....',
      '.?........K..TG.....', ...G3),
    screen(
      '....................',
      '.......*.....*......',
      '....................',
      '....................',
      '.?..R...............',
      '##~~~~~~~~~~~~~~~~##',
      '##~~~~~~~~~~~~~~~~##',
      '####################'),
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
      '.L.!.......M########', ...G3),
    screen(
      '....................',
      '....*...............',
      '########............',
      '########............',
      '########.......m....',
      '########............',
      '########............',
      '########............',
      '########............',
      '########............',
      '########.......!....', ...G3),
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
      '................G...',
      '######..........G...',
      '######..........G...',
      '######.....###..G...',
      '######......T...G...',
      '######..*.......G...',
      '######..........G...',
      '######..........G...',
      '######..........G...',
      '######..........G...',
      '######...r.?....G...', ...G3),
    screen(
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '.........*..........',
      '....................',
      '......O.....O.......',
      '....................',
      '.L..................',
      '####^^^^^^^^^^^^####',
      '####################',
      '####################'),
    screen(
      '...............G....',
      '...............G....',
      '...............G....',
      '...............G....',
      '...............G....',
      '...............G....',
      '...............G....',
      '.......*.......G....',
      '...............G....',
      '...............G....',
      '..r..K...K....TG.H..', ...G3),
    screen(
      '....................',
      '.........*..........',
      '........===.........',
      '....................',
      '..f..N.......L...E..',
      '################~~~~',
      '################~~~~',
      '####################'));

  // ---------------------------------------------------------------- 3 · El molino anegado
  // Tormenta. El trago de agua (nenúfar): apagar fuegos fatuos y flotar sobre el río; la placa;
  // el panzazo (canto rodado) rompe suelo agrietado y hace rebotar las setas altísimo.
  const molino = join(
    screen(
      '....................',
      '....................',
      '..@..N.....,........', ...G3),
    screen(
      '....................',
      '....................',
      '..........##########',
      '..........##########',
      '....................',
      '..!.?.....FFFF....*.',
      '#####~~~############',
      '#####~~~############',
      '####################'),
    screen(
      '....................',
      '....................',
      '######..............',
      '######......*.......',
      '....................',
      '...?................',
      '######~~~~~~~~~~~~~#',
      '######~~~~~~~~~~~~~#',
      '####################'),
    screen(
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '..............G.....',
      '..c...?...PP..G..*..', ...G3),
    screen(
      '...............#####',
      '...............#####',
      '...............#####',
      '...............#####',
      '...............#####',
      '...............#####',
      '...............#####',
      '....#####xxx########',
      '....#...............',
      '....#......*........',
      '.L!.#...............', ...G3),
    screen(
      '#####...............',
      '#####.........######',
      '#####.........######',
      '#####.........######',
      '#####.........######',
      '#####....*....######',
      '#####.........######',
      '#####.........######',
      '..............######',
      '..............######',
      '..............######',
      '########...#########',
      '########.%.#########',
      '####################'),
    screen(
      '....................',
      '######..............',
      '######.........*....',
      '######..............',
      '######......###.....',
      '######......###.....',
      '######..............',
      '######..............',
      '######..............',
      '######..............',
      '######....f....FF...',
      '######~~~~##########',
      '######~~~~##########',
      '####################'),
    screen(
      '....................',
      '....................',
      '..........*.........',
      '..............m.....',
      '....................',
      '.L..................',
      '####~~~~~~~w~~~~~~~~',
      '####~~~~~~~~~~~~~~~~',
      '####################'),
    screen(
      '....................',
      '....................',
      '........*...........',
      '....................',
      '....................',
      '....................',
      '~~~~~###############',
      '~~~~~###############',
      '####################'),
    screen(
      '................G...',
      '................G...',
      '................G...',
      '.............*..G...',
      '................G...',
      '................G...',
      '................G...',
      '..........PP....G...',
      '..........##....G...',
      '..........##....G...',
      '..c.?.....##....G...', ...G3),
    screen(
      '....................',
      '.........*..........',
      '....FFF...N...L.E...',
      '#~~###########~~~~~~',
      '#~~###########~~~~~~',
      '####################'));

  // ---------------------------------------------------------------- 4 · La cueva de barro
  // A oscuras. El escupitajo picante (guindilla) rompe piedra reforzada y atraviesa cangrejos;
  // el resbalón (alga) cruza túneles bajos a toda velocidad y derriba a los bichos.
  const cueva = join(
    screen(
      '.................X..',
      '.................X..',
      '.................X..',
      '.................X..',
      '........*........X..',
      '.................X..',
      '.................X..',
      '.................X..',
      '.................X..',
      '.................X..',
      '..@.N.!...r......X..', ...G3),
    screen(
      '....................',
      '..........*.........',
      '....................',
      '....................',
      '....................',
      '...%....^^^^^....%..', ...G3),
    screen(
      '...........*........',
      '....................',
      '....................',
      '..?.....FFFF...K....',
      '###~~###############',
      '###~~###############',
      '####################'),
    screen(
      '....................',
      '....................',
      '....................',
      '.....###############',
      '.....###############',
      '.....###############',
      '.....###############',
      '.?!.V...............', ...G3),
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
      '............########',
      '.........O..########',
      '......*.....########',
      '............########',
      '..........O.########',
      '............########',
      '............########',
      '.........O..########',
      '............########',
      '..?.........########', ...G3),
    screen(
      '..................G.',
      '########..........G.',
      '########..........G.',
      '########..*.......G.',
      '########..........G.',
      '########..........G.',
      '########..........G.',
      '########..........G.',
      '########..........G.',
      '########..........G.',
      '########.rK.K.K..TG.', ...G3),
    screen(
      '.............X......',
      '.............X......',
      '.............X......',
      '.............X......',
      '.............X......',
      '.............X......',
      '.............X......',
      '.............X......',
      '....######...X......',
      '....######...X...*..',
      '..r.......s..X...H..', ...G3),
    screen(
      '....................',
      '.......*............',
      '..L.N........E......',
      '##########~~~~~~~~~~',
      '##########~~~~~~~~~~',
      '####################'));

  // ---------------------------------------------------------------- 5 · El nido de la Garza
  const nido = join(
    screen(
      '....................',
      '........*...........',
      '.......===..........',
      '..@..N.......L....H.', ...G3),
    screen(
      '.................===',
      '....................',
      '....====............',
      '....................',
      '....................',
      '....................',
      '.....B...r..........', ...G3),
    screen(
      '===.................',
      '....................',
      '............====....',
      '....................',
      '....................',
      '....................',
      '....................', ...G3));

  return [
    { name: 'El embarcadero', theme: 'dusk', music: 'marsh', rows: embarcadero, powers: ['aleteo', 'soplido'],
      intro: 'La Garza voló río arriba con las crías en el buche.',
      ruca: ['¡Nila! La Garza se ha llevado a todas las crías del pantano. Bigotes es el único que queda. Síguela: {move} para andar, {jump} para saltar.'],
      signs: [
        'Mantén {fish}: Bigotes sorbe lo que tenga delante. Con la boca llena, pulsa {fish} y lo escupe. Prueba contra la roca rajada.',
        'Por la madriguera se pasa agachada: mantén {down}.',
        'Sorbe la caja y escúpela contra el saliente: se queda donde cae. Con {down} y {fish} la sueltas a tus pies.',
        'Ni aleteando llegas tan alto. Súbete antes a la caja.'] },
    { name: 'Los juncos', theme: 'night', music: 'marsh', rows: juncos, powers: ['ventosa', 'mordisco'],
      intro: 'Entre los juncos, de noche, mandan los cangrejos.',
      ruca: ['¿Que cómo llegué antes? Atajos de tortuga. Ojo: los cangrejos no se dejan sorber hasta que los volteas de una pedrada.',
        'La Garza se posó en el molino viejo. Toma la barca; yo voy por mis atajos.'],
      signs: [
        'Dale a la diana con algo escupido y la compuerta se abrirá para siempre.',
        'Súbete a la balsa, mira hacia atrás y sopla con {fish}: Bigotes la empuja.',
        'Mantén {up} al escupir y Bigotes lanza hacia arriba.'] },
    { name: 'El molino anegado', theme: 'storm', music: 'storm', rows: molino, powers: ['chorro', 'panzazo'],
      intro: 'La tormenta obligó a la Garza a pasar la noche en el molino.',
      ruca: ['Huele a pluma mojada: la Garza durmió aquí. Y esos fuegos fatuos... el pantano está revuelto.',
        'Cada cría que sueltas vuelve nadando a casa. La Garza ha seguido hacia la cueva de barro.'],
      signs: [
        'Bigotes también sorbe agua: mantén {fish} frente a la charca. Escúpela sobre el fuego fatuo.',
        'El río es ancho. Con agua en la boca, mantén {fish} en el aire: el chorro te sostiene.',
        'La compuerta sólo se abre mientras algo pese en la placa. Deja la caja encima con {down} y {fish}.',
        'Esta placa está en alto: sube con la caja en la boca.'] },
    { name: 'La cueva de barro', theme: 'cave', music: 'cave', rows: cueva, powers: ['guindilla', 'resbalon'],
      intro: 'Bajo el cerro, un río oscuro lleva hasta el nido.',
      ruca: ['Esa pared no la rompe una pedrada normal. Hace falta algo... picante.',
        'Al otro lado del río está el ciprés muerto. El nido. Ve con cuidado, Nila.'],
      signs: [
        'Esa charca da para apagar el fuego. O salta con ganas.',
        'Sopla al molinillo y corre: el túnel es largo. Corriendo, {down} y Nila se desliza sobre Bigotes.',
        'Aros hacia arriba: sorbe con {up} y, desde cada aro, busca el siguiente.'] },
    { name: 'El nido de la Garza', theme: 'nest', music: 'heron', rows: nido, boss: true,
      intro: 'En lo alto del ciprés muerto, la Garza espera.',
      ruca: ['Tiene a las últimas crías en el buche. Cuando suelte piedras, sórbelas y devuélveselas. Si se atasca en el barro, ¡es tu momento!'],
      signs: [] }];
})();
