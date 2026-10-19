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

// Una sola sincronización en vuelo. Con varias a la vez, la que terminaba
// última guardaba su foto vieja de lo local y hacía desaparecer de la pantalla
// lo que se había anotado en el medio.
let enVuelo = null;

async function unaVuelta({ almacen, nube }) {
  if (!nube.hayLlave()) {
    return { estado: almacen.leerEstado(), subio: false, rechazados: [] };
  }

  try {
    const respuesta = await nube.subirCambios(almacen.cola());
    // La nube vieja devolvía solo la lista de aplicados.
    const aplicados = Array.isArray(respuesta) ? respuesta : (respuesta.aplicados ?? []);
    const rechazados = Array.isArray(respuesta) ? [] : (respuesta.rechazados ?? []);
    // Los rechazados también salen: reintentarlos taponaba la cola para siempre.
    almacen.sacarDeLaCola([...aplicados, ...rechazados.map((r) => r.id)]);

    const remoto = await nube.bajarEstado();
    // Se relee: mientras el pedido viajaba, Abel pudo haber escrito algo más.
    const estado = fusionar(almacen.leerEstado(), remoto);
    almacen.guardarEstado(estado);
    return { estado, subio: true, rechazados };
  } catch {
    return { estado: almacen.leerEstado(), subio: false, rechazados: [] };
  }
}

export function sincronizar({ almacen, nube }) {
  const siguiente = Promise.resolve(enVuelo)
    .catch(() => {})
    .then(() => unaVuelta({ almacen, nube }));
  enVuelo = siguiente.catch(() => {});
  return siguiente;
}
