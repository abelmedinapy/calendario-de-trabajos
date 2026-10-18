// Lo que no se terminó no se pierde: al abrir un día nuevo salta directo a hoy,
// sin pasar por los días del medio y sin borrar el día en que nació.

export function arrastrar(estado, hoy, ahora = new Date()) {
  const sello = ahora.toISOString();
  const movidas = [];
  const tomas = estado.tomas.map((t) => {
    if (t.hecha || t.diaActual >= hoy) return t;
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
    for (const d of [t.diaOrigen, t.diaHecha, t.hecha ? null : t.diaActual]) {
      if (d && pedidos.has(d)) conTrabajo.add(d);
    }
  }
  return conTrabajo;
}
