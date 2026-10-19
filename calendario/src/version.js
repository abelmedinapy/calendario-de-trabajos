// Saber si el servidor tiene una versión más nueva que la que está corriendo.
//
// Es una PWA instalada: queda abierta días. Sin esto se sigue usando el código
// de hace varios despliegues sin enterarse, y un arreglo publicado no llega
// nunca. El service worker no alcanza: solo se reinstala si cambia su propio
// archivo, y el mío casi nunca cambia.
//
// La marca NO puede salir de index.html: Cloudflare lo redirige a / y ahí no
// viene etag. Sale de los archivos de la app, que sí lo traen.

const MIRADOS = ['./src/app.js', './src/vista.js', './css/tablero.css'];

export function hayQueRecargar(marcaVieja, marcaNueva) {
  if (!marcaVieja || !marcaNueva) return false;
  return marcaVieja !== marcaNueva;
}

export async function marcaDelServidor(traer = fetch) {
  try {
    const marcas = await Promise.all(MIRADOS.map(async (archivo) => {
      const r = await traer(archivo, { method: 'HEAD', cache: 'no-store' });
      const marca = r.headers.get('etag') || r.headers.get('last-modified');
      if (!marca) throw new Error(`${archivo} no trae marca`);
      return `${archivo}:${marca}`;
    }));
    return marcas.join('|');
  } catch {
    return null;
  }
}
