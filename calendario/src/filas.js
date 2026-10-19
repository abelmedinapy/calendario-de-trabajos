// La app habla en camelCase y la base en snake_case. La traducción vive acá,
// una sola vez, y la usan los dos lados: el Worker y el cliente.

const COLUMNAS = {
  proyectos: {
    id: 'id', nombre: 'nombre', etiqueta: 'etiqueta', color: 'color',
    archivado: 'archivado', pausado: 'pausado', borrado: 'borrado',
    actualizado: 'actualizado'
  },
  tomas: {
    id: 'id', proyecto: 'proyecto', codigo: 'codigo', queHacer: 'que_hacer',
    detalle: 'detalle', diaOrigen: 'dia_origen', diaActual: 'dia_actual',
    hecha: 'hecha', diaHecha: 'dia_hecha', enCurso: 'en_curso',
    grafico: 'grafico', graficoValores: 'grafico_valores',
    orden: 'orden', borrado: 'borrado', actualizado: 'actualizado'
  },
  dias: {
    fecha: 'fecha', objetivo: 'objetivo', renderDice: 'render_dice',
    borrado: 'borrado', actualizado: 'actualizado'
  }
};

const BOOLEANOS = new Set(['archivado', 'pausado', 'hecha', 'enCurso', 'borrado']);
const JSONS = new Set(['graficoValores']);

export const columnasDe = (tabla) => Object.values(COLUMNAS[tabla]);
export const claveDe = (tabla) => (tabla === 'dias' ? 'fecha' : 'id');

export function aFila(tabla, obj) {
  const fila = {};
  for (const [campo, columna] of Object.entries(COLUMNAS[tabla])) {
    const valor = obj[campo];
    if (BOOLEANOS.has(campo)) fila[columna] = valor ? 1 : 0;
    else if (JSONS.has(campo)) fila[columna] = valor == null ? null : JSON.stringify(valor);
    else fila[columna] = valor ?? null;
  }
  return fila;
}

export function deFila(tabla, fila) {
  const obj = {};
  for (const [campo, columna] of Object.entries(COLUMNAS[tabla])) {
    const valor = fila[columna];
    if (BOOLEANOS.has(campo)) obj[campo] = valor === 1 || valor === true;
    else if (JSONS.has(campo)) {
      try {
        obj[campo] = valor == null ? null : JSON.parse(valor);
      } catch {
        obj[campo] = null;
      }
    } else obj[campo] = valor;
  }
  return obj;
}
