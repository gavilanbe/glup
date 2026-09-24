// GLUP — La Garza II. Traída tal cual del secuenciador antiguo; se reescribirá.
Sound.cancion('heron2', {
  titulo: 'La Garza II', tempo: 148, compas: '4/4', swing: 0,
  pistas: {
    bajo: { inst: 'contrabajo', vol: 0.84, pan: 0, rev: 0.06 },
    melodia: { inst: 'metales', vol: 0.75, pan: -0.1, rev: 0.3 },
    acomp: { inst: 'pizzicato', vol: 0.54, pan: 0.25, rev: 0.25 },
    perc: { inst: 'bateria', vol: 0.7 } },
  secciones: {
    A: { compases: 4,
      bajo: `E2s E2s rs E2s E3s rs E2s rs E2s E2s rs E2s G2s rs A2s rs |
        C2s C2s rs C2s C3s rs C2s rs C2s C2s rs C2s D2s rs E2s rs |
        E2s E2s rs E2s E3s rs E2s rs E2s E2s rs E2s G2s rs A2s rs |
        B1s B1s rs B1s B2s rs B1s rs D2s D2s rs D2s F#2s rs B1s rs`,
      melodia: `E4e B4e re G4e A4s rs B4e C5e B4s rs |
        C5q B4e A4e G4e. rs E4e. rs |
        E4e B4e re G4e A4s rs B4e D5e B4s rs |
        D5q C5e B4e A4e F#4q re`,
      acomp: `E3s G3s B3s G3s E3s G3s B3s G3s E3s G3s B3s G3s E3s G3s B3s E4s |
        C3s E3s G3s E3s C3s E3s G3s E3s C3s E3s G3s E3s C3s E3s G3s C4s |
        E3s G3s B3s G3s E3s G3s B3s G3s E3s G3s B3s G3s E3s G3s B3s E4s |
        B2s D3s F#3s D3s B2s D3s F#3s D3s B2s D3s F#3s D3s B2s D3s F#3s B3s`,
      perc: `
        shaker    xxx. xxxx xxx. xxxx | xxx. xxxx xxx. xxxx
        escobilla .... x... .... x... | .... x... .... x.xx
        bombo     x... x..x x... x... | x... x..x x... x.x.` } },
  forma: ['A'] });
