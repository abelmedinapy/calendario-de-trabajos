// La línea que dice RENDER arriba del tablero. Cuenta lo que falta, no lo que
// quedó sin hacer ayer: hablar de "lo que quedó" suena a reproche, y lo que
// sirve a la mañana es saber cuánto hay por delante. Nunca dice horas.

export function loQueDiceRender(estado, fecha) {
  const delDia = estado.dias.find((d) => d.fecha === fecha);
  if (delDia && delDia.renderDice) return delDia.renderDice;

  const enPausa = new Set(estado.proyectos.filter((p) => p.pausado).map((p) => p.id));
  const delTablero = estado.tomas.filter(
    (t) => !t.borrado && t.diaActual === fecha && !enPausa.has(t.proyecto));
  const pendientes = delTablero.filter((t) => !t.hecha);

  if (pendientes.length === 0) {
    return delTablero.length === 0
      ? 'Anotá lo primero del día.'
      : 'Está todo cerrado.';
  }

  const proyectos = new Set(pendientes.map((t) => t.proyecto));
  const deQuien = proyectos.size === 1
    ? ` de ${estado.proyectos.find((p) => p.id === [...proyectos][0])?.nombre ?? ''}`.trimEnd()
    : '';

  return pendientes.length === 1
    ? `1 pendiente${deQuien}.`
    : `${pendientes.length} pendientes${deQuien}.`;
}
