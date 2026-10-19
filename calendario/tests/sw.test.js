import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { listaDeArchivos } from '../src/archivos.js';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const leer = (f) => readFileSync(raiz + f, 'utf-8');

test('la lista del service worker nombra todo lo que la app necesita para abrir sola', () => {
  const l = listaDeArchivos();
  for (const f of ['./', './index.html', './css/tablero.css', './src/app.js',
                   './src/vista.js', './assets/render.png']) {
    assert.ok(l.includes(f), `falta ${f}`);
  }
});

test('todas las fuentes del css están en la lista', () => {
  const l = listaDeArchivos();
  const enElCss = [...leer('css/tablero.css').matchAll(/url\(([^)]+)\)/g)]
    .map((m) => m[1].replace(/['"]/g, ''));
  assert.ok(enElCss.length > 0, 'el css no declara ninguna fuente');
  for (const url of enElCss) {
    assert.ok(l.includes(`./${url.replace(/^\.\.\//, '')}`), `falta ${url}`);
  }
});

test('todo lo que nombra el manifest está en la lista', () => {
  const l = listaDeArchivos();
  const manifest = JSON.parse(leer('app.webmanifest'));
  for (const icono of manifest.icons) {
    assert.ok(l.includes(`./${icono.src.replace(/^\.\//, '')}`), `falta ${icono.src}`);
  }
});

test('la lista no tiene repetidos', () => {
  const l = listaDeArchivos();
  assert.equal(new Set(l).size, l.length);
});

test('la lista no incluye la API: eso siempre va a la red', () => {
  assert.ok(!listaDeArchivos().some((f) => f.includes('/api')));
});
