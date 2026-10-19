// La única puerta a la red. Habla con el Worker, que está en el mismo origen.

import { API } from './config.js';
import { normalizarEstado } from './modelo.js';

export function crearNube({ llave, traer = fetch }) {
  const cabeceras = () => ({
    Authorization: `Llave ${llave}`,
    'content-type': 'application/json'
  });

  async function pedir(ruta, opciones) {
    const r = await traer(`${API}${ruta}`, { headers: cabeceras(), ...opciones });
    if (r.status === 401) throw new Error('la llave no sirve');
    if (!r.ok) throw new Error(`la nube contestó ${r.status}`);
    return r.json();
  }

  return {
    hayLlave: () => Boolean(llave),

    async bajarEstado() {
      return normalizarEstado(await pedir('/estado', { method: 'GET' }));
    },

    async subirCambios(cambios) {
      if (cambios.length === 0) return { aplicados: [], rechazados: [] };
      const r = await pedir('/cambios', { method: 'POST', body: JSON.stringify(cambios) });
      return {
        aplicados: Array.isArray(r.aplicados) ? r.aplicados : [],
        rechazados: Array.isArray(r.rechazados) ? r.rechazados : []
      };
    }
  };
}
