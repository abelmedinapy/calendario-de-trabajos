import test from 'node:test';
import assert from 'node:assert/strict';

import { hayQueRecargar } from '../src/version.js';

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
