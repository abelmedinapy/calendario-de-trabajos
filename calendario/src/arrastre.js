// El tablero se copia al día siguiente tal cual quedó: lo pendiente y también
// lo ya terminado, que sigue siendo parte de la lista del proyecto. Lo único
// que no se copia es lo de un proyecto en pausa, que para eso se pausa.
//
// El día en que nació el trabajo y el día en que se terminó no se tocan: son
// los que hacen que el scrubber marque dónde hubo trabajo de verdad.

export function arrastrar(estado, hoy, ahora = new Date()) {
  const sello = ahora.toISOString();
  const movidas = [];
  const enPausa = new Set(estado.proyectos.filter((p) => p.pausado).map((p) => p.id));
  const tomas = estado.tomas.map((t) => {
    if (t.borrado || t.diaActual >= hoy || enPausa.has(t.proyecto)) return t;
    movidas.push(t.id);
    return { ...t, diaActual: hoy, actualizado: sello };
  });
  return movidas.length === 0
    ? { estado, movidas }
    : { estado: { ...estado, tomas }, movidas };
}

export function diasConTrabajo(estado, dias) {
  const pedidos = new Set(dias);
  const conTrabajo = new Set();
  for (const t of estado.tomas) {
    if (t.borrado) continue;
    for (const d of [t.diaOrigen, t.diaHecha, t.hecha ? null : t.diaActual]) {
      if (d && pedidos.has(d)) conTrabajo.add(d);
    }
  }
  return conTrabajo;
}
