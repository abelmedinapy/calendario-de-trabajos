// El SQL que arma el Worker. Vive acá, separado del handler, para poder
// probarlo sin levantar nada: tabla, columnas y clave salen siempre de
// `filas.js`, nunca del pedido, así que no hay forma de inyectar nada.

import { aFila, claveDe, columnasDe } from './filas.js';

export const TABLAS = ['proyectos', 'tomas', 'dias'];

export function sentenciaDeAlta(tabla) {
  const columnas = columnasDe(tabla);
  const clave = claveDe(tabla);
  const huecos = columnas.map(() => '?').join(', ');
  const actualiza = columnas
    .filter((c) => c !== clave)
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  return `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${huecos}) `
    + `ON CONFLICT(${clave}) DO UPDATE SET ${actualiza}`;
}

export function valoresDe(tabla, fila) {
  const valores = aFila(tabla, fila);
  return columnasDe(tabla).map((c) => valores[c]);
}

// El índice único deja una sola toma en curso: si un cambio enciende una, hay
// que apagar las demás antes, o la escritura choca contra el índice.
export function hayQueApagarEnCurso(cambios) {
  return cambios.some((c) => c.tabla === 'tomas' && Boolean(c.fila?.enCurso));
}

// Un cambio que la base no puede aplicar tapona la cola para siempre si el
// cliente lo reintenta. Se descartan acá, antes de tocar la base.
export function cambioValido(cambio) {
  if (!cambio || typeof cambio !== 'object') return false;
  if (typeof cambio.id !== 'string' || cambio.id === '') return false;
  if (!TABLAS.includes(cambio.tabla)) return false;
  if (!cambio.fila || typeof cambio.fila !== 'object') return false;
  const clave = claveDe(cambio.tabla);
  return typeof cambio.fila[clave] === 'string' && cambio.fila[clave] !== '';
}
