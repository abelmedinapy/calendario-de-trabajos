// La línea que dice RENDER arriba del tablero. Habla de lo que quedó de antes
// y nunca de horas.

export function loQueDiceRender(estado, fecha) {
  const delDia = estado.dias.find((d) => d.fecha === fecha);
  if (delDia && delDia.renderDice) return delDia.renderDice;

  const arrastradas = estado.tomas.filter(
    (t) => !t.hecha && t.diaActual === fecha && t.diaOrigen < fecha);

  if (arrastradas.length === 0) {
    const huboPasado =
      estado.tomas.some((t) => t.diaOrigen < fecha) ||
      estado.dias.some((d) => d.fecha < fecha);
    return huboPasado ? 'Ayer cerraste todo. Arrancamos limpio.' : 'Anotá lo primero del día.';
  }

  const proyectos = new Set(arrastradas.map((t) => t.proyecto));
  const deQuien = proyectos.size === 1
    ? ` de ${estado.proyectos.find((p) => p.id === [...proyectos][0])?.nombre ?? ''}`.trimEnd()
    : '';

  return arrastradas.length === 1
    ? `Ayer quedó 1 toma${deQuien} sin cerrar.`
    : `Ayer quedaron ${arrastradas.length} tomas${deQuien} sin cerrar.`;
}
