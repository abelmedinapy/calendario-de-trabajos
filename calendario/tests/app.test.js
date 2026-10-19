import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { decidirArranque } from '../src/app.js';
import { listaDeArchivos } from '../src/archivos.js';

const raiz = fileURLToPath(new URL('../', import.meta.url));

test('con llave y datos locales abre el tablero aunque no haya red', () => {
  assert.equal(decidirArranque({ hayLlave: true, hayLocal: true, hayRed: false }), 'tablero');
});

test('sin llave y con red pide entrar', () => {
  assert.equal(decidirArranque({ hayLlave: false, hayLocal: false, hayRed: true }), 'entrar');
});

test('aparato nuevo sin red no puede hacer nada y lo dice', () => {
  assert.equal(decidirArranque({ hayLlave: false, hayLocal: false, hayRed: false }), 'sin-nada');
});

test('con llave pero sin nada local ni red, muestra el tablero vacío, no sin-nada', () => {
  assert.equal(decidirArranque({ hayLlave: true, hayLocal: false, hayRed: false }), 'tablero');
});

test('sin llave pero con datos locales igual hay que entrar: la llave es la puerta', () => {
  assert.equal(decidirArranque({ hayLlave: false, hayLocal: true, hayRed: true }), 'entrar');
});

test('todos los módulos que importa app.js están en la lista del cache', () => {
  const l = listaDeArchivos();
  const importados = [...readFileSync(raiz + 'src/app.js', 'utf-8')
    .matchAll(/from '\.\/([a-z-]+\.js)'/g)].map((m) => m[1]);
  assert.ok(importados.length > 0, 'app.js no importa nada');
  for (const m of importados) assert.ok(l.includes(`./src/${m}`), `falta ${m}`);
});

test('app.js importa todo lo que usa de editar.js', () => {
  // app.js solo corre en el navegador, así que una función usada sin importar
  // no rompe ningún test: la app se rompe recién al apretar el botón.
  const app = readFileSync(raiz + 'src/app.js', 'utf-8');
  const exportados = [...readFileSync(raiz + 'src/editar.js', 'utf-8')
    .matchAll(/export function (\w+)/g)].map((m) => m[1]);
  const importados = app.match(/import \{([\s\S]*?)\} from '\.\/editar\.js'/)[1];
  assert.ok(exportados.length > 0, 'editar.js no exporta nada');
  for (const nombre of exportados) {
    if (!new RegExp(`\\b${nombre}\\(`).test(app)) continue;
    assert.ok(new RegExp(`\\b${nombre}\\b`).test(importados), `falta importar ${nombre}`);
  }
});
