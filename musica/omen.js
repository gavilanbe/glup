// GLUP — El presagio. Traída tal cual del secuenciador antiguo; se reescribirá.
Sound.cancion('omen', {
  titulo: 'El presagio', tempo: 56, compas: '4/4', swing: 0,
  pistas: {
    bajo: { inst: 'pad', oct: 1, vol: 0.84, pan: 0, rev: 0.2 },
    melodia: { inst: 'coroU', vol: 0.57, pan: 0, rev: 0.5 },
    perc: { inst: 'bateria', vol: 0.7 } },
  secciones: {
    A: { compases: 4,
      bajo: `A1w |
        Bb1w`,
      melodia: `rh E4q F4q |
        rh E4h |
        rh D4q Eb4q |
        rh D4h`,
      perc: `
        gota      .... .... .... x... | .... x... .... ....` } },
  forma: ['A'] });
