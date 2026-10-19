// Lo primero que pasa con cada cambio: se guarda acá y se dibuja. La subida a
// la nube va atrás, leyendo la cola.
//
// En una ventana privada o con la cuota llena el storage tira al leer y al
// escribir. La app tiene que abrir igual, así que todo va dentro de un try y
// `puedeGuardar()` dice la verdad para poder avisarle a Abel.

import { normalizarEstado } from './modelo.js';

const CLAVE_ESTADO = 'calendario:estado';
const CLAVE_COLA = 'calendario:cola';

export function crearAlmacen(storage) {
  let sirve = Boolean(storage);

  function leer(clave) {
    if (!storage) return null;
    try {
      return storage.getItem(clave);
    } catch {
      sirve = false;
      return null;
    }
  }

  function escribir(clave, valor) {
    if (!storage) return false;
    try {
      storage.setItem(clave, valor);
      return true;
    } catch {
      sirve = false;
      return false;
    }
  }

  function leerJSON(clave, porDefecto) {
    const crudo = leer(clave);
    if (crudo === null) return porDefecto;
    try {
      return JSON.parse(crudo);
    } catch {
      return porDefecto;
    }
  }

  return {
    leerEstado() {
      return normalizarEstado(leerJSON(CLAVE_ESTADO, null));
    },

    guardarEstado(estado) {
      return escribir(CLAVE_ESTADO, JSON.stringify(estado));
    },

    cola() {
      const guardada = leerJSON(CLAVE_COLA, []);
      return Array.isArray(guardada) ? guardada : [];
    },

    encolar(cambio) {
      const sin = this.cola().filter((c) => c.id !== cambio.id);
      escribir(CLAVE_COLA, JSON.stringify([...sin, cambio]));
    },

    sacarDeLaCola(ids) {
      const fuera = new Set(ids);
      escribir(CLAVE_COLA, JSON.stringify(this.cola().filter((c) => !fuera.has(c.id))));
    },

    puedeGuardar() {
      return sirve;
    }
  };
}
