// GLUP — La cueva de barro. Traída tal cual del secuenciador antiguo; se reescribirá.
Sound.cancion('cave', {
  titulo: 'La cueva de barro', tempo: 88, compas: '4/4', swing: 0.15,
  pistas: {
    bajo: { inst: 'fretless', vol: 0.75, pan: 0, rev: 0.08 },
    acomp: { inst: 'kalimba', oct: 1, vol: 0.56, pan: 0.25, rev: 0.4 },
    melodia: { inst: 'ocarina', vol: 0.48, pan: -0.15, rev: 0.45 },
    perc: { inst: 'bateria', vol: 0.7 } },
  secciones: {
    A: { compases: 8,
      bajo: `E2s rq+s E2s re. E2s rq+s |
        G2s rq+s G2s re. G2s rq+s |
        A2s rq+s A2s re. A2s rq+s |
        B1s rq+s B1s re. D2s rq+s`,
      acomp: `E3s re. B3s re. E3s re. G3s re. |
        G3s re. D4s re. G3s re. B3s re. |
        A3s re. E4s re. A3s re. C4s re. |
        B3s re. F#4s re. B3s re. D4s re.`,
      melodia: `rh E4e. rs D4e re |
        rh B3q. re |
        rh C4e. rs B3e re |
        rh A3h |
        rh E4e. rs G4e re |
        rh F#4q D4e re |
        rh E4e. rs B3e re |
        rh E4h`,
      perc: `
        gota      .... ..x. .... .... | .... .... ...x .... | ...x .... .... .... | .... .... .... ..x.
        bombo     x... .... ..x. .... | x... .... ..x. .... | x... .... ..x. .... | x... .... x... x...` } },
  forma: ['A'] });
