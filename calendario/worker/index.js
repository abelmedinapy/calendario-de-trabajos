// La API del calendario. Sirve dos rutas y nada más; los archivos de la app
// los sirve Cloudflare antes de llegar acá.

import { deFila } from '../src/filas.js';
import {
  TABLAS, sentenciaDeAlta, valoresDe, hayQueApagarEnCurso, cambioValido
} from '../src/sentencias.js';

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

async function estado(db) {
  const leidas = await db.batch(TABLAS.map((t) => db.prepare(`SELECT * FROM ${t}`)));
  return Object.fromEntries(
    TABLAS.map((tabla, i) => [tabla, leidas[i].results.map((f) => deFila(tabla, f))])
  );
}

// Uno por uno y no en un solo batch: así un cambio que la base rechaza se
// informa por su nombre en vez de hacer fracasar a todos, que es como la cola
// del cliente quedaba taponada reintentando lo mismo para siempre.
async function aplicar(db, cambios) {
  const aplicados = [];
  const rechazados = [];

  if (hayQueApagarEnCurso(cambios)) {
    try {
      await db.prepare('UPDATE tomas SET en_curso = 0 WHERE en_curso = 1').run();
    } catch {
      // si falla, el alta de abajo va a chocar contra el índice y se informa ahí
    }
  }

  for (const cambio of cambios) {
    if (!cambioValido(cambio)) {
      rechazados.push({ id: cambio?.id ?? null, motivo: 'cambio mal formado' });
      continue;
    }
    try {
      await db.prepare(sentenciaDeAlta(cambio.tabla))
        .bind(...valoresDe(cambio.tabla, cambio.fila))
        .run();
      aplicados.push(cambio.id);
    } catch (error) {
      rechazados.push({ id: cambio.id, motivo: String(error?.message || error) });
    }
  }

  return { aplicados, rechazados };
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
      return json(await aplicar(env.DB, cambios));
    }

    return json({ error: 'ruta' }, 404);
  }
};
