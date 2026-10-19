import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const ignorados = () => readFileSync(raiz + '.assetsignore', 'utf-8')
  .split('\n').map((l) => l.trim()).filter(Boolean);

// Los assets se sirven desde la carpeta de la app: lo que no esté acá queda
// público en internet. Wrangler no excluye los archivos que empiezan con punto.
test('nada con secretos ni estado local se publica', () => {
  const fuera = ignorados();
  for (const f of ['.dev.vars', '.dev.vars.*', '.wrangler/', 'worker/', 'tests/',
                   'node_modules/', 'package.json', 'wrangler.jsonc', '.gitignore']) {
    assert.ok(fuera.includes(f), `falta ${f} en .assetsignore`);
  }
});

test('todo lo que el .gitignore esconde también queda fuera de los assets', () => {
  const fuera = ignorados();
  const enGit = readFileSync(raiz + '.gitignore', 'utf-8')
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const f of enGit) {
    assert.ok(fuera.some((i) => i === f || i === `${f}/` || i.replace(/\/$/, '') === f.replace(/\/$/, '')),
      `${f} está en .gitignore pero se publicaría`);
  }
});
