// Todo lo que el service worker guarda para que la app abra sin internet.
// Vive acá y no adentro del worker para que los tests la puedan leer.

const ARCHIVOS = [
  './',
  './index.html',
  './app.webmanifest',
  './css/tablero.css',
  './assets/fonts/bricolage-grotesque.woff2',
  './assets/fonts/figtree.woff2',
  './assets/render.png',
  './assets/am.png',
  './assets/am-minis.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png',
  './apple-touch-icon.png',
  './src/app.js',
  './src/almacen-local.js',
  './src/archivos.js',
  './src/arrastre.js',
  './src/config.js',
  './src/dia.js',
  './src/editar.js',
  './src/filas.js',
  './src/modelo.js',
  './src/nube.js',
  './src/render-dice.js',
  './src/sync.js',
  './src/version.js',
  './src/vista.js'
];

export function listaDeArchivos() {
  return [...ARCHIVOS];
}
