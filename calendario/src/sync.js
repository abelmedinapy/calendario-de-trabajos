// Local y nube se juntan acá. Para cada fila gana la escritura más nueva, y la
// fila entera viene del que gana: no se mezclan campos de los dos lados, que es
// como se arman datos que nadie escribió.

import { claveDe } from './filas.js';

function fusionarTabla(tabla, locales, remotas) {
  const clave = claveDe(tabla);
  const porId = new Map();
  for (const fila of [...remotas, ...locales]) {
    const previa = porId.get(fila[clave]);
    if (!previa || fila.actualizado >= previa.actualizado) porId.set(fila[clave], fila);
  }
  return [...porId.values()];
}

export function fusionar(local, remoto) {
  return {
    proyectos: fusionarTabla('proyectos', local.proyectos, remoto.proyectos),
    tomas: fusionarTabla('tomas', local.tomas, remoto.tomas),
    dias: fusionarTabla('dias', local.dias, remoto.dias)
  };
}

export async function sincronizar({ almacen, nube }) {
  const local = almacen.leerEstado();
  if (!nube.hayLlave()) return { estado: local, subio: false };

  try {
    const aplicados = await nube.subirCambios(almacen.cola());
    almacen.sacarDeLaCola(aplicados);
    const estado = fusionar(local, await nube.bajarEstado());
    almacen.guardarEstado(estado);
    return { estado, subio: true };
  } catch {
    return { estado: local, subio: false };
  }
}
