// GLUP — La marcha. Traída tal cual del secuenciador antiguo; se reescribirá.
Sound.cancion('march', {
  titulo: 'La marcha', tempo: 126, compas: '4/4', swing: 0,
  pistas: {
    bajo: { inst: 'contrabajo', vol: 0.8, pan: 0, rev: 0.06 },
    melodia: { inst: 'flautaPan', vol: 0.64, pan: -0.1, rev: 0.3 },
    acomp: { inst: 'marimba', vol: 0.49, pan: 0.25, rev: 0.2 },
    perc: { inst: 'bateria', vol: 0.7 } },
  secciones: {
    A: { compases: 4,
      bajo: `D2s rs D2s rs A1s rs D2s rs D2s rs D2s rs A1s rs D2s rs |
        G1s rs G1s rs D2s rs G1s rs G1s rs G1s rs D2s rs G1s rs |
        Bb1s rs Bb1s rs F2s rs Bb1s rs C2s rs C2s rs G2s rs C2s rs |
        D2s rs D2s rs A1s rs D2s rs A1s rs A1s rs C#2s rs A1s rs`,
      melodia: `D4e. A3s D4e F4e A4q G4e F4e |
        G4q D4q Bb3q D4q |
        F4q Bb4q C5q E4e G4e |
        A4h A4s rs G4s rs E4s rs C#4s rs`,
      acomp: `D3s F3s A3s F3s D3s F3s A3s F3s D3s F3s A3s F3s D3s F3s A3s F3s |
        G2s Bb2s D3s Bb2s G2s Bb2s D3s Bb2s G2s Bb2s D3s Bb2s G2s Bb2s D3s Bb2s |
        Bb2s D3s F3s D3s Bb2s D3s F3s D3s C3s E3s G3s E3s C3s E3s G3s E3s |
        A2s C#3s E3s C#3s A2s C#3s E3s C#3s A2s C#3s E3s C#3s A2s C#3s E3s C#3s`,
      perc: `
        shaker    x.x. x.x. x.x. x.xx | x.x. x.x. x.x. xxxx
        bombo     x... x... x... x.x. | x... x... x... x.xx` } },
  forma: ['A'] });
