import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarEstado } from '../src/modelo.js';
import { sentenciaDeAlta, valoresDe, hayQueApagarEnCurso, cambioValido } from '../src/sentencias.js';

const toma = (extra = {}) => normalizarEstado({
  tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'roto', diaOrigen: '2026-10-18', diaActual: '2026-10-18', ...extra }]
}).tomas[0];

test('el alta inserta y actualiza por la clave de la tabla', () => {
  const sql = sentenciaDeAlta('tomas');
  assert.match(sql, /^INSERT INTO tomas \(/);
  assert.match(sql, /ON CONFLICT\(id\) DO UPDATE SET/);
  assert.match(sql, /que_hacer = excluded\.que_hacer/);
  assert.doesNotMatch(sql, /id = excluded\.id/);
});

test('los días se resuelven por fecha, no por id', () => {
  assert.match(sentenciaDeAlta('dias'), /ON CONFLICT\(fecha\) DO UPDATE SET/);
});

test('los valores salen en el mismo orden que las columnas del INSERT', () => {
  const sql = sentenciaDeAlta('tomas');
  const columnas = sql.match(/INSERT INTO tomas \(([^)]+)\)/)[1].split(', ');
  const valores = valoresDe('tomas', toma());
  assert.equal(valores.length, columnas.length);
  assert.equal(valores[columnas.indexOf('que_hacer')], 'roto');
  assert.equal(valores[columnas.indexOf('hecha')], 0);
});

test('hay que apagar las en curso solo si algún cambio enciende una', () => {
  assert.equal(hayQueApagarEnCurso([{ tabla: 'tomas', fila: toma({ enCurso: true }) }]), true);
  assert.equal(hayQueApagarEnCurso([{ tabla: 'tomas', fila: toma() }]), false);
  assert.equal(hayQueApagarEnCurso([{ tabla: 'dias', fila: {} }]), false);
});

test('un cambio sin tabla conocida o sin fila no es válido', () => {
  assert.equal(cambioValido({ id: 'c1', tabla: 'tomas', fila: toma() }), true);
  assert.equal(cambioValido({ id: 'c1', tabla: 'otra', fila: toma() }), false);
  assert.equal(cambioValido({ id: 'c1', tabla: 'tomas' }), false);
  assert.equal(cambioValido({ tabla: 'tomas', fila: toma() }), false);
  assert.equal(cambioValido(null), false);
});

test('un cambio sin la clave de su tabla no es válido: taponaría la cola', () => {
  assert.equal(cambioValido({ id: 'c1', tabla: 'tomas', fila: { queHacer: 'sin id' } }), false);
  assert.equal(cambioValido({ id: 'c1', tabla: 'dias', fila: { objetivo: 'sin fecha' } }), false);
});
