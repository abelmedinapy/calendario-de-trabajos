import test from 'node:test';
import assert from 'node:assert/strict';

import { hayQueRecargar, marcaDelServidor } from '../src/version.js';

test('hay versión nueva cuando la marca del servidor cambió', () => {
  assert.equal(hayQueRecargar('abc', 'def'), true);
});

test('la misma marca no recarga nada', () => {
  assert.equal(hayQueRecargar('abc', 'abc'), false);
});

test('sin marca de un lado no se recarga: mejor quedarse que recargar en loop', () => {
  assert.equal(hayQueRecargar(null, 'def'), false);
  assert.equal(hayQueRecargar('abc', null), false);
  assert.equal(hayQueRecargar('', ''), false);
});

test('la marca junta varios archivos: un despliegue que toca solo el CSS también cuenta', async () => {
  const traer = async (url) => ({
    ok: true,
    headers: { get: (h) => (h === 'etag' ? `etag-de-${url}` : null) }
  });
  const marca = await marcaDelServidor(traer);
  assert.match(marca, /app\.js/);
  assert.match(marca, /tablero\.css/);
});

test('si un archivo no contesta, la marca es nula y no se recarga', async () => {
  const traer = async () => { throw new Error('sin red'); };
  assert.equal(await marcaDelServidor(traer), null);
});

test('no se mira index.html: Cloudflare lo redirige a / y ahí no hay etag', async () => {
  const pedidos = [];
  const traer = async (url) => {
    pedidos.push(url);
    return { ok: true, headers: { get: () => 'x' } };
  };
  await marcaDelServidor(traer);
  assert.ok(!pedidos.some((u) => u.includes('index.html')), pedidos.join(' '));
});
