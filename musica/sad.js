// GLUP — Tristeza. Traída tal cual del secuenciador antiguo; se reescribirá.
Sound.cancion('sad', {
  titulo: 'Tristeza', tempo: 68, compas: '4/4', swing: 0.15,
  pistas: {
    acomp: { inst: 'arpa', vol: 0.54, pan: 0.15, rev: 0.35 },
    bajo: { inst: 'cuerdas', oct: 1, vol: 0.46, pan: 0, rev: 0.3 },
    melodia: { inst: 'chelo', vol: 0.65, pan: -0.15, rev: 0.3 } },
  secciones: {
    A: { compases: 4,
      acomp: `A2s rs E3s rs A3s rs C4s rs E4s rs C4s rs A3s rs E3s rs |
        F2s rs C3s rs F3s rs A3s rs C4s rs A3s rs F3s rs C3s rs |
        C3s rs G3s rs C4s rs E4s rs G4s rs E4s rs C4s rs G3s rs |
        E2s rs B2s rs E3s rs G#3s rs B3s rs G#3s rs E3s rs B2s rs`,
      bajo: `A1w |
        F1w |
        C2w |
        E1w`,
      melodia: `rq E4q D4e C4e B3q |
        rq C4q A3h |
        rq G4q F4e E4e D4q |
        rq E4h.` } },
  forma: ['A'] });
