// Los archivos de la app se piden a la red y se guardan de paso; si no hay red,
// salen del cache. Al revés (cache primero) la app abría rápido pero se quedaba
// con la versión vieja hasta que cambiara el nombre del cache, y entonces una
// corrección podía no llegar nunca. La API nunca se guarda.

import { listaDeArchivos, VERSION } from './src/archivos.js';

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
