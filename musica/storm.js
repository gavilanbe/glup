// GLUP — La tormenta. Traída tal cual del secuenciador antiguo; se reescribirá.
Sound.cancion('storm', {
  titulo: 'La tormenta', tempo: 100, compas: '4/4', swing: 0.1,
  pistas: {
    bajo: { inst: 'fretless', vol: 0.75, pan: 0, rev: 0.08 },
    acomp: { inst: 'guitarra', vol: 0.59, pan: 0.25, rev: 0.25 },
    melodia: { inst: 'clarinete', vol: 0.6, pan: -0.15, rev: 0.3 },
    perc: { inst: 'bateria', vol: 0.7 } },
  secciones: {
    A: { compases: 8,
      bajo: `A1s re A1s re A1s re. A1s rs C2s rs E2s rs |
        F1s re F1s re F1s re. F1s rs A1s rs C2s rs |
        D2s re D2s re D2s re. D2s rs F2s rs A2s rs |
        E2s re E2s re E2s re. G#1s rs B1s rs E2s rs`,
      acomp: `A3s rs C4s rs E4s rs C4s rs A3s rs C4s rs E4s rs A4s rs |
        F3s rs A3s rs C4s rs A3s rs F3s rs A3s rs C4s rs F4s rs |
        D3s rs F3s rs A3s rs F3s rs D3s rs F3s rs A3s rs D4s rs |
        E3s rs G#3s rs B3s rs G#3s rs E3s rs G#3s rs B3s rs E4s rs`,
      melodia: `rq E4e. rs D4e C4e B3e re |
        rq C4e. rs D4e E4q re |
        rq F4e. rs E4e D4e C4e re |
        rq B3q G#3q. re |
        rq E4e. rs A4e G4e E4e re |
        rq F4e. rs E4e C4q re |
        rq D4e. rs F4e E4e D4e re |
        rq E4h+e re`,
      perc: `
        gota      .... .... .... ..x. | .... ..x. .... ....
        bombo     x... ..x. x... .... | x... ..x. x... x...` } },
  forma: ['A'] });
