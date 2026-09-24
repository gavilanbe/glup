// GLUP — El alba. Traída tal cual del secuenciador antiguo; se reescribirá.
Sound.cancion('alba', {
  titulo: 'El alba', tempo: 76, compas: '4/4', swing: 0.2,
  pistas: {
    acomp: { inst: 'arpa', vol: 0.54, pan: 0.2, rev: 0.35 },
    bajo: { inst: 'cuerdas', oct: 1, vol: 0.41, pan: 0, rev: 0.3 },
    melodia: { inst: 'flauta', vol: 0.49, pan: -0.1, rev: 0.35 },
    perc: { inst: 'bateria', vol: 0.7 } },
  secciones: {
    A: { compases: 8,
      acomp: `D3s rs A3s rs D4s rs F#4s rs A4s rs F#4s rs D4s rs A3s rs |
        A2s rs E3s rs A3s rs C#4s rs E4s rs C#4s rs A3s rs E3s rs |
        B2s rs F#3s rs B3s rs D4s rs F#4s rs D4s rs B3s rs F#3s rs |
        G2s rs D3s rs G3s rs B3s rs D4s rs B3s rs G3s rs D3s rs`,
      bajo: `D2w |
        A1w |
        B1w |
        G1w`,
      melodia: `rq F#4q A4q D5q |
        C#5h A4h |
        rq B4q A4q F#4q |
        G4h rh |
        rq F#4q A4q D5q |
        E5h C#5q A4q |
        rq D5q C#5q B4q |
        A4h. rq`,
      perc: `
        gota      .... .... .... ..x. | .... ..x. .... .... | .... .... ..x. .... | .... .... .... ....` } },
  forma: ['A'] });
