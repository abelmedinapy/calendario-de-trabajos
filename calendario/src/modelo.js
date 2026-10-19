// La forma de los datos del tablero. Todo lo que entra pasa por acá, así el
// resto de la app no tiene que preguntarse si un campo existe.

const COLORES = ['acid', 'ok', 'violet', 'warn'];

const lista = (x) => (Array.isArray(x) ? x : []);
const texto = (x, porDefecto = '') => (typeof x === 'string' ? x : porDefecto);
const siNo = (x) => x === true;
const nulo = (x) => (typeof x === 'string' && x !== '' ? x : null);

function proyecto(crudo) {
  return {
    id: texto(crudo.id),
    nombre: texto(crudo.nombre),
    etiqueta: texto(crudo.etiqueta),
    color: COLORES.includes(crudo.color) ? crudo.color : 'acid',
    archivado: siNo(crudo.archivado),
    pausado: siNo(crudo.pausado),
    borrado: siNo(crudo.borrado),
    actualizado: texto(crudo.actualizado)
  };
}

function toma(crudo) {
  return {
    id: texto(crudo.id),
    proyecto: texto(crudo.proyecto),
    codigo: texto(crudo.codigo),
    queHacer: texto(crudo.queHacer),
    detalle: texto(crudo.detalle),
    diaOrigen: texto(crudo.diaOrigen, texto(crudo.diaActual)),
    diaActual: texto(crudo.diaActual, texto(crudo.diaOrigen)),
    hecha: siNo(crudo.hecha),
    diaHecha: nulo(crudo.diaHecha),
    enCurso: siNo(crudo.enCurso),
    grafico: nulo(crudo.grafico),
    graficoValores: crudo.graficoValores ?? null,
    orden: Number.isFinite(crudo.orden) ? crudo.orden : 0,
    borrado: siNo(crudo.borrado),
    actualizado: texto(crudo.actualizado)
  };
}

function dia(crudo) {
  return {
    fecha: texto(crudo.fecha),
    objetivo: texto(crudo.objetivo),
    renderDice: texto(crudo.renderDice),
    borrado: siNo(crudo.borrado),
    actualizado: texto(crudo.actualizado)
  };
}

// Una fila sin clave no es una fila: al fusionar, todas las que no tienen id
// colapsarían en una sola.
const tieneClave = (clave) => (fila) =>
  fila && typeof fila === 'object' && typeof fila[clave] === 'string' && fila[clave] !== '';

export function normalizarEstado(crudo) {
  const fuente = crudo && typeof crudo === 'object' ? crudo : {};
  return {
    proyectos: lista(fuente.proyectos).filter(tieneClave('id')).map(proyecto),
    tomas: lista(fuente.tomas).filter(tieneClave('id')).map(toma),
    dias: lista(fuente.dias).filter(tieneClave('fecha')).map(dia)
  };
}

function porOrden(a, b) {
  return a.orden - b.orden || a.actualizado.localeCompare(b.actualizado);
}

// `incluirVacios` es para el modo editar: en reposo un proyecto sin tomas no
// ensucia el tablero, pero si no se ve nunca se le puede agregar la primera.
export function agruparPorProyecto(estado, fecha, { incluirVacios = false } = {}) {
  const grupos = [];
  // Lo pausado va al final: sigue a la vista, pero no es lo del día.
  const enOrden = [...estado.proyectos].sort((a, b) => Number(a.pausado) - Number(b.pausado));
  for (const p of enOrden) {
    if (p.archivado || p.borrado) continue;
    if (!p.nombre && !incluirVacios) continue;
    const suyas = estado.tomas
      .filter((t) => !t.borrado && t.proyecto === p.id && t.diaActual === fecha)
      .sort(porOrden);
    if (suyas.length === 0 && !incluirVacios) continue;
    grupos.push({
      proyecto: p,
      hechas: suyas.filter((t) => t.hecha),
      pendientes: suyas.filter((t) => !t.hecha)
    });
  }
  return grupos;
}

// Los contadores salen de lo que el tablero muestra, no de las filas sueltas:
// una toma de un proyecto borrado no está a la vista y no se cuenta.
export function contadores(estado, fecha) {
  const grupos = agruparPorProyecto(estado, fecha).filter((g) => !g.proyecto.pausado);
  const delDia = grupos.flatMap((g) => [...g.hechas, ...g.pendientes]);
  return {
    proyectos: grupos.length,
    tomas: delDia.length,
    listas: delDia.filter((t) => t.hecha).length
  };
}

export function marcarEnCurso(estado, tomaId) {
  return {
    ...estado,
    tomas: estado.tomas.map((t) => ({ ...t, enCurso: t.id === tomaId && !t.hecha }))
  };
}
