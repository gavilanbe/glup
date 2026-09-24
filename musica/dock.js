// GLUP — El muelle. Traída tal cual del secuenciador antiguo; se reescribirá.
Sound.cancion('dock', {
  titulo: 'El muelle', tempo: 72, compas: '4/4', swing: 0.25,
  pistas: {
    acomp: { inst: 'guitarra', vol: 0.63, pan: 0.2, rev: 0.25 },
    bajo: { inst: 'contrabajo', vol: 0.63, pan: 0, rev: 0.08 },
    melodia: { inst: 'acordeon', vol: 0.54, pan: -0.15, rev: 0.25 } },
  secciones: {
    A: { compases: 4,
      acomp: `D3s re. A3s re. F3s re. A3s re. |
        Bb2s re. F3s re. D3s re. F3s re. |
        F3s re. C4s re. A3s re. C4s re. |
        C3s re. G3s re. E3s re. G3s re.`,
      bajo: `D2s rh.+e. |
        Bb1s rh.+e. |
        F2s rh.+e. |
        C2s rh.+e.`,
      melodia: `rh A3q F3q |
        rh D4h |
        rh C4q A3q |
        rh G3h` } },
  forma: ['A'] });
