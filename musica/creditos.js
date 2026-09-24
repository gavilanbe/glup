// GLUP — Créditos. Traída tal cual del secuenciador antiguo; se reescribirá.
Sound.cancion('creditos', {
  titulo: 'Créditos', tempo: 112, compas: '4/4', swing: 0.12,
  pistas: {
    bajo: { inst: 'contrabajo', vol: 0.76, pan: 0, rev: 0.06 },
    melodia: { inst: 'flautaPan', vol: 0.6, pan: -0.1, rev: 0.3 },
    acomp: { inst: 'marimba', vol: 0.41, pan: 0.25, rev: 0.2 },
    perc: { inst: 'bateria', vol: 0.7 } },
  secciones: {
    A: { compases: 8,
      bajo: `D2s rs D2s rs A1s rs D2s rs D2s rs D2s rs A1s rs D2s rs |
        G1s rs G1s rs D2s rs G1s rs G1s rs G1s rs D2s rs G1s rs |
        B1s rs B1s rs F#2s rs B1s rs A1s rs A1s rs E2s rs A1s rs |
        A1s rs A1s rs E2s rs A1s rs A1s rs A1s rs C#2s rs E2s rs |
        D2s rs D2s rs A1s rs D2s rs D2s rs D2s rs A1s rs D2s rs |
        G1s rs G1s rs D2s rs G1s rs G1s rs G1s rs D2s rs G1s rs |
        A1s rs A1s rs E2s rs A1s rs A1s rs A1s rs E2s rs A1s rs |
        D2s rs D2s rs A1s rs D2s rs D2s rq.+s`,
      melodia: `D4e. A3s D4e F#4e A4q G4e F#4e |
        G4q D4q B3q D4q |
        F#4q B4q C#5q E4e G4e |
        A4h A4s rs G4s rs F#4s rs E4s rs |
        D4e. A3s D4e F#4e A4q B4e A4e |
        G4q B4q D5q B4q |
        A4q F#4q G4q E4q |
        D4h rh`,
      acomp: `D3s F#3s A3s F#3s D3s F#3s A3s F#3s D3s F#3s A3s F#3s D3s F#3s A3s F#3s |
        G2s B2s D3s B2s G2s B2s D3s B2s G2s B2s D3s B2s G2s B2s D3s B2s |
        B2s D3s F#3s D3s B2s D3s F#3s D3s A2s C#3s E3s C#3s A2s C#3s E3s C#3s |
        A2s C#3s E3s C#3s A2s C#3s E3s C#3s A2s C#3s E3s C#3s A2s C#3s E3s C#3s |
        D3s F#3s A3s F#3s D3s F#3s A3s F#3s D3s F#3s A3s F#3s D3s F#3s A3s F#3s |
        G2s B2s D3s B2s G2s B2s D3s B2s G2s B2s D3s B2s G2s B2s D3s B2s |
        A2s C#3s E3s C#3s A2s C#3s E3s C#3s A2s C#3s E3s C#3s A2s C#3s E3s C#3s |
        D3s F#3s A3s F#3s D3s F#3s A3s D4s rh`,
      perc: `
        shaker    x.x. x.x. x.x. x.xx
        escobilla .... x... .... x...
        bombo     x... x... x... x.x.` } },
  forma: ['A'] });
