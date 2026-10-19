import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarEstado } from '../src/modelo.js';
import { aFila, deFila } from '../src/filas.js';

const unaToma = (extra = {}) => normalizarEstado({
  tomas: [{
    id: 't1', proyecto: 'p1', codigo: 'T22', queHacer: 'Roto del brazo',
    detalle: 'sale en el 118', diaOrigen: '2026-10-18', diaActual: '2026-10-18',
    orden: 2, actualizado: '2026-10-18T12:00:00.000Z', ...extra
  }]
}).tomas[0];

const unProyecto = () => normalizarEstado({
  proyectos: [{ id: 'p1', nombre: 'Fortaleza', etiqueta: 'VFX', color: 'ok', actualizado: 'x' }]
}).proyectos[0];

const unDia = () => normalizarEstado({
  dias: [{ fecha: '2026-10-18', objetivo: 'cerrar', renderDice: '', actualizado: 'x' }]
}).dias[0];

test('aFila pasa a snake_case lo que la base espera', () => {
  const f = aFila('tomas', unaToma());
  assert.equal(f.que_hacer, 'Roto del brazo');
  assert.equal(f.dia_origen, '2026-10-18');
  assert.equal(f.dia_actual, '2026-10-18');
  assert.ok(!('queHacer' in f));
});

test('los booleanos viajan como 0 y 1', () => {
  const f = aFila('tomas', unaToma({ hecha: true, enCurso: false }));
  assert.equal(f.hecha, 1);
  assert.equal(f.en_curso, 0);
});

test('graficoValores viaja como texto JSON y vuelve como objeto', () => {
  const t = unaToma({ grafico: 'capas', graficoValores: { hechas: 2, total: 3 } });
  const f = aFila('tomas', t);
  assert.equal(typeof f.grafico_valores, 'string');
  assert.deepEqual(deFila('tomas', f).graficoValores, { hechas: 2, total: 3 });
});

test('deFila(aFila(x)) devuelve x', () => {
  for (const [tabla, obj] of [['tomas', unaToma()], ['proyectos', unProyecto()], ['dias', unDia()]]) {
    assert.deepEqual(deFila(tabla, aFila(tabla, obj)), obj, tabla);
  }
});

test('deFila tolera un grafico_valores nulo o roto', () => {
  const base = aFila('tomas', unaToma());
  assert.equal(deFila('tomas', { ...base, grafico_valores: null }).graficoValores, null);
  assert.equal(deFila('tomas', { ...base, grafico_valores: 'no soy json' }).graficoValores, null);
});

test('deFila devuelve booleanos de verdad, no ceros y unos', () => {
  const f = { ...aFila('tomas', unaToma()), hecha: 1, en_curso: 0 };
  const t = deFila('tomas', f);
  assert.equal(t.hecha, true);
  assert.equal(t.enCurso, false);
});

test('aFila no inventa columnas que la tabla no tiene', () => {
  const f = aFila('proyectos', unProyecto());
  assert.deepEqual(Object.keys(f).sort(),
    ['actualizado', 'archivado', 'color', 'etiqueta', 'id', 'nombre']);
});
