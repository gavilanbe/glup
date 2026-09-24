// GLUP — La Garza I. Traída tal cual del secuenciador antiguo; se reescribirá.
Sound.cancion('heron', {
  titulo: 'La Garza I', tempo: 138, compas: '4/4', swing: 0,
  pistas: {
    bajo: { inst: 'contrabajo', vol: 0.84, pan: 0, rev: 0.06 },
    melodia: { inst: 'cuerdas', vol: 0.77, pan: -0.1, rev: 0.3 },
    acomp: { inst: 'pizzicato', vol: 0.56, pan: 0.25, rev: 0.25 },
    perc: { inst: 'bateria', vol: 0.7 } },
  secciones: {
    A: { compases: 4,
      bajo: `E2s rs E2s rs E2s rs E2s rs E2s rs E2s rs G2s rs A2s rs |
        C2s rs C2s rs C2s rs C2s rs C2s rs C2s rs D2s rs E2s rs |
        E2s rs E2s rs E2s rs E2s rs E2s rs E2s rs G2s rs A2s rs |
        B1s rs B1s rs B1s rs B1s rs B1s rs D2s rs D2s rs B1s rs`,
      melodia: `E4s re E4s re G4s re. A4s rs B4s re. |
        C5s re B4s re A4s re. G4s re. E4s rs |
        E4s re E4s re G4s re. A4s rs B4s re. |
        D5s re B4s re A4s re. F#4s rq+s`,
      acomp: `E3s rs G3s rs B3s rs G3s rs E3s rs G3s rs B3s rs E4s rs |
        C3s rs E3s rs G3s rs E3s rs C3s rs E3s rs G3s rs C4s rs |
        E3s rs G3s rs B3s rs G3s rs E3s rs G3s rs B3s rs E4s rs |
        B2s rs D3s rs F#3s rs D3s rs B2s rs D3s rs F#3s rs B3s rs`,
      perc: `
        shaker    x.x. x.xx x.x. x.xx | x.x. x.xx x.x. x.xx | x.x. x.xx x.x. x.xx | x.x. x.xx x.xx x.xx
        bombo     x... x... x... x... | x... x... x... x.x. | x... x... x... x... | x... x... x.x. x.x.` } },
  forma: ['A'] });
