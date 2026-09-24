// GLUP — La Garza III. Traída tal cual del secuenciador antiguo; se reescribirá.
Sound.cancion('heron3', {
  titulo: 'La Garza III', tempo: 162, compas: '4/4', swing: 0,
  pistas: {
    bajo: { inst: 'fretless', oct: -1, vol: 0.86, pan: 0, rev: 0.06 },
    melodia: { inst: 'violin', vol: 0.82, pan: -0.1, rev: 0.3 },
    acomp: { inst: 'pizzicato', vol: 0.52, pan: 0.25, rev: 0.25 },
    perc: { inst: 'bateria', vol: 0.7 } },
  secciones: {
    A: { compases: 4,
      bajo: `F2s F3s F2s F3s F2s F3s F2s F3s F2s F3s F2s F3s Ab2s Ab3s Bb2s Bb3s |
        Db2s Db3s Db2s Db3s Db2s Db3s Db2s Db3s Db2s Db3s Db2s Db3s Eb2s Eb3s F2s F3s |
        F2s F3s F2s F3s F2s F3s F2s F3s F2s F3s F2s F3s Ab2s Ab3s Bb2s Bb3s |
        C2s C3s C2s C3s C2s C3s C2s C3s E2s E3s E2s E3s G2s G3s C2s C3s`,
      melodia: `F5e rs F5s re Ab5e Bb5e rs C6e rs Bb5s rs |
        Db6q C6e Bb5e Ab5e. rs F5e. rs |
        F5e rs F5s re Ab5e Bb5e rs C6e rs Eb6s rs |
        E5q G5q C6q Bb5e G5e`,
      acomp: `F3s Ab3s C4s Ab3s F3s Ab3s C4s Ab3s F3s Ab3s C4s Ab3s F3s Ab3s C4s F4s |
        Db3s F3s Ab3s F3s Db3s F3s Ab3s F3s Db3s F3s Ab3s F3s Db3s F3s Ab3s Db4s |
        F3s Ab3s C4s Ab3s F3s Ab3s C4s Ab3s F3s Ab3s C4s Ab3s F3s Ab3s C4s F4s |
        C3s E3s G3s E3s C3s E3s G3s E3s C3s E3s G3s E3s C3s E3s G3s C4s`,
      perc: `
        shaker    xxxx xxxx xxxx xxxx
        escobilla .... x... .... x... | .... x... .... x.xx | .... x... .... x... | .... x..x ..x. xxxx
        gota      x... .... x... ....
        bombo     x..x x... x..x x... | x..x x... x.x. x.x.` } },
  forma: ['A'] });
