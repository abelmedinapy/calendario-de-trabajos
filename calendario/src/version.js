// Saber si el servidor tiene una versión más nueva que la que está corriendo.
//
// Es una PWA instalada: queda abierta días. Sin esto, se sigue usando el código
// de hace tres despliegues sin enterarse, y un arreglo publicado no llega nunca.
// El service worker no alcanza: solo se reinstala si cambia su propio archivo.

export function hayQueRecargar(marcaVieja, marcaNueva) {
  if (!marcaVieja || !marcaNueva) return false;
  return marcaVieja !== marcaNueva;
}

// La marca es lo que el servidor diga de index.html: con Cloudflare es el etag.
export async function marcaDelServidor(traer = fetch) {
  try {
    const r = await traer('./index.html', { method: 'HEAD', cache: 'no-store' });
    return r.headers.get('etag') || r.headers.get('last-modified') || null;
  } catch {
    return null;
  }
}
