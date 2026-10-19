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
    actualizado: texto(crudo.actualizado)
  };
}

function dia(crudo) {
  return {
    fecha: texto(crudo.fecha),
    objetivo: texto(crudo.objetivo),
    renderDice: texto(crudo.renderDice),
    actualizado: texto(crudo.actualizado)
  };
}

const conId = (fila) => fila && typeof fila === 'object';

export function normalizarEstado(crudo) {
  const fuente = crudo && typeof crudo === 'object' ? crudo : {};
  return {
    proyectos: lista(fuente.proyectos).filter(conId).map(proyecto),
    tomas: lista(fuente.tomas).filter(conId).map(toma),
    dias: lista(fuente.dias).filter(conId).map(dia)
  };
}

function porOrden(a, b) {
  return a.orden - b.orden || a.actualizado.localeCompare(b.actualizado);
}

// `incluirVacios` es para el modo editar: en reposo un proyecto sin tomas no
// ensucia el tablero, pero si no se ve nunca se le puede agregar la primera.
export function agruparPorProyecto(estado, fecha, { incluirVacios = false } = {}) {
  const grupos = [];
  for (const p of estado.proyectos) {
    if (p.archivado) continue;
    const suyas = estado.tomas
      .filter((t) => t.proyecto === p.id && t.diaActual === fecha)
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

export function contadores(estado, fecha) {
  const delDia = estado.tomas.filter((t) => t.diaActual === fecha);
  return {
    proyectos: agruparPorProyecto(estado, fecha).length,
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
