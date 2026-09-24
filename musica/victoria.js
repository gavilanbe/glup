// GLUP — Victoria. Traída tal cual del secuenciador antiguo; se reescribirá.
Sound.cancion('victoria', {
  titulo: 'Victoria', tempo: 136, compas: '4/4', swing: 0.1,
  pistas: {
    bajo: { inst: 'contrabajo', vol: 0.76, pan: 0, rev: 0.06 },
    acomp: { inst: 'marimba', vol: 0.42, pan: 0.25, rev: 0.2 },
    melodia: { inst: 'xilofono', vol: 0.45, pan: -0.15, rev: 0.25 },
    melodia2: { inst: 'xilofono', vol: 0.19, pan: -0.15, rev: 0.25 },
    perc: { inst: 'bateria', vol: 0.7 } },
  secciones: {
    A: { compases: 4,
      bajo: `C2s rs C2s G1s C2s rs E2s rs F2s rs F2s C2s F2s rs A2s rs |
        G2s rs G2s D2s G2s rs B1s rs C2s rs E2s rs G2s rs C2s rs |
        A1s rs A1s E2s A1s rs C2s rs F1s rs F1s C2s F1s rs A1s rs |
        G1s rs G1s D2s G1s rs B1s rs C2s rs G1s rs C2s re.`,
      acomp: `E4s G4s C5s G4s E4s G4s C5s G4s F4s A4s C5s A4s F4s A4s C5s A4s |
        D4s G4s B4s G4s D4s G4s B4s G4s E4s G4s C5s G4s E4s G4s C5s G4s |
        C4s E4s A4s E4s C4s E4s A4s E4s C4s F4s A4s F4s C4s F4s A4s F4s |
        B3s D4s G4s D4s B3s D4s G4s D4s C4s E4s G4s C5s E5s re.`,
      melodia: `G5e E5s rs G5e C6e A5q F5e A5e |
        B5e G5s rs D5e G5e C6q. re |
        E5e C5s rs E5e A5e F5e A5e C6e A5e |
        D6q B5e G5e C6h`,
      melodia2: `rq E5q rq C5q |
        rq D5q rq E5q |
        rq C5q rq C5q |
        rq G5q rq G5q`,
      perc: `
        escobilla .... x... .... x... | .... x... .... x.xx
        shaker    x.xx x.x. x.xx x.x.
        bombo     x... ..x. x... .... | x... ..x. x... x...` } },
  forma: ['A'] });
