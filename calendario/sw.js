// Los archivos de la app salen del cache; la API siempre va a la red. Así el
// tablero abre aunque no haya internet, con lo último que quedó guardado.

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
    caches.match(pedido).then((guardado) => guardado || fetch(pedido).then((respuesta) => {
      if (respuesta.ok) {
        const copia = respuesta.clone();
        caches.open(VERSION).then((cache) => cache.put(pedido, copia));
      }
      return respuesta;
    }))
  );
});
