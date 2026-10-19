// La API del calendario. Sirve dos rutas y nada más; los archivos de la app
// los sirve Cloudflare antes de llegar acá.

import { aFila, deFila, claveDe, columnasDe } from '../src/filas.js';

const TABLAS = ['proyectos', 'tomas', 'dias'];

const json = (cuerpo, estado = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });

async function resumen(texto) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
}

// Comparamos resúmenes para que ni el largo ni el contenido de la llave se
// filtren por el tiempo que tarda la comparación.
async function llaveCorrecta(pedido, secreto) {
  if (!secreto) return false;
  const traida = (pedido.headers.get('authorization') || '').replace(/^Llave /, '');
  if (!traida) return false;
  const [a, b] = await Promise.all([resumen(traida), resumen(secreto)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

function sentenciaDeAlta(tabla) {
  const columnas = columnasDe(tabla);
  const clave = claveDe(tabla);
  const huecos = columnas.map(() => '?').join(', ');
  const actualiza = columnas
    .filter((c) => c !== clave)
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  return `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${huecos})
          ON CONFLICT(${clave}) DO UPDATE SET ${actualiza}`;
}

async function estado(db) {
  const leidas = await db.batch(TABLAS.map((t) => db.prepare(`SELECT * FROM ${t}`)));
  return Object.fromEntries(
    TABLAS.map((tabla, i) => [tabla, leidas[i].results.map((f) => deFila(tabla, f))])
  );
}

function sentenciasDe(db, cambios) {
  const sentencias = [];
  // El índice único deja una sola toma en curso: apagamos todas antes de
  // encender la nueva, si no la escritura choca contra el índice.
  if (cambios.some((c) => c.tabla === 'tomas' && !c.borrado && c.fila?.enCurso)) {
    sentencias.push(db.prepare('UPDATE tomas SET en_curso = 0 WHERE en_curso = 1'));
  }
  for (const cambio of cambios) {
    const { tabla, fila, borrado } = cambio;
    if (!TABLAS.includes(tabla)) continue;
    const clave = claveDe(tabla);
    if (borrado) {
      sentencias.push(db.prepare(`DELETE FROM ${tabla} WHERE ${clave} = ?`).bind(fila[clave === 'fecha' ? 'fecha' : 'id']));
    } else {
      const valores = aFila(tabla, fila);
      sentencias.push(db.prepare(sentenciaDeAlta(tabla)).bind(...columnasDe(tabla).map((c) => valores[c])));
    }
  }
  return sentencias;
}

export default {
  async fetch(pedido, env) {
    const ruta = new URL(pedido.url).pathname;
    if (!ruta.startsWith('/api/')) return env.ASSETS.fetch(pedido);

    if (!(await llaveCorrecta(pedido, env.LLAVE))) {
      return json({ error: 'llave' }, 401);
    }

    if (ruta === '/api/estado' && pedido.method === 'GET') {
      return json(await estado(env.DB));
    }

    if (ruta === '/api/cambios' && pedido.method === 'POST') {
      const cambios = await pedido.json().catch(() => null);
      if (!Array.isArray(cambios)) return json({ error: 'cambios' }, 400);
      if (cambios.length === 0) return json({ aplicados: [] });
      const sentencias = sentenciasDe(env.DB, cambios);
      if (sentencias.length === 0) return json({ aplicados: [] });
      await env.DB.batch(sentencias);
      return json({ aplicados: cambios.map((c) => c.id) });
    }

    return json({ error: 'ruta' }, 404);
  }
};
