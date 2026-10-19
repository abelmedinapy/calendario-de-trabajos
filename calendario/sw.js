// VERSION se reescribe sola en cada publicación (npm run publicar). Que cambie
// este archivo es lo que hace que el navegador reinstale el worker, tire los
// caches viejos y tome el control: sin eso se puede quedar con app.js de una
// versión y vista.js de otra, y la app hace cosas a medias.
import { listaDeArchivos } from './src/archivos.js';

const VERSION = 'calendario-2026-10-19T02-07-52';

// Los archivos de la app se piden a la red y se guardan de paso; si no hay red,
// salen del cache. La API nunca se guarda.

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(listaDeArchivos()))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  if (new URL(pedido.url).pathname.startsWith('/api/')) return;

  evento.respondWith(
    fetch(pedido)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(pedido, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(pedido).then((guardado) => guardado || Response.error()))
  );
});
