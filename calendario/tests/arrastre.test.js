import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarEstado } from '../src/modelo.js';
import { arrastrar, diasConTrabajo } from '../src/arrastre.js';
import { diasDeAtraso } from '../src/dia.js';

const HOY = '2026-10-18';

function conTomas(...tomas) {
  return normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: tomas.map((t, i) => ({ id: `t${i + 1}`, proyecto: 'p1', queHacer: 'algo', ...t }))
  });
}

test('una toma pendiente de ayer pasa a hoy', () => {
  const { estado, movidas } = arrastrar(
    conTomas({ diaOrigen: '2026-10-17', diaActual: '2026-10-17' }), HOY);
  assert.deepEqual(movidas, ['t1']);
  assert.equal(estado.tomas[0].diaActual, HOY);
  assert.equal(estado.tomas[0].diaOrigen, '2026-10-17');
});

test('las tomas hechas no se mueven', () => {
  const { estado, movidas } = arrastrar(
    conTomas({ diaOrigen: '2026-10-17', diaActual: '2026-10-17', hecha: true, diaHecha: '2026-10-17' }), HOY);
  assert.deepEqual(movidas, []);
  assert.equal(estado.tomas[0].diaActual, '2026-10-17');
});

test('salta directo a hoy sin pasar por los días del medio', () => {
  const { estado } = arrastrar(
    conTomas({ diaOrigen: '2026-10-14', diaActual: '2026-10-14' }), HOY);
  assert.equal(estado.tomas[0].diaActual, HOY);
  assert.equal(diasDeAtraso(estado.tomas[0].diaOrigen, HOY), 4);
});

test('correrlo dos veces no cambia nada ni vuelve a reportar movidas', () => {
  const estado = conTomas({ diaOrigen: '2026-10-17', diaActual: '2026-10-17' });
  const a = arrastrar(estado, HOY);
  const b = arrastrar(a.estado, HOY);
  assert.deepEqual(b.movidas, []);
  assert.deepEqual(b.estado, a.estado);
});

test('no arrastra tomas de días futuros', () => {
  const { estado, movidas } = arrastrar(
    conTomas({ diaOrigen: '2026-10-20', diaActual: '2026-10-20' }), HOY);
  assert.deepEqual(movidas, []);
  assert.equal(estado.tomas[0].diaActual, '2026-10-20');
});

test('no arrastra las del día de hoy', () => {
  const { movidas } = arrastrar(conTomas({ diaOrigen: HOY, diaActual: HOY }), HOY);
  assert.deepEqual(movidas, []);
});

test('arrastrar no muta el estado que recibe', () => {
  const estado = conTomas({ diaOrigen: '2026-10-17', diaActual: '2026-10-17' });
  arrastrar(estado, HOY);
  assert.equal(estado.tomas[0].diaActual, '2026-10-17');
});

test('diasConTrabajo marca el día donde nació una toma aunque se haya arrastrado', () => {
  const { estado } = arrastrar(
    conTomas({ diaOrigen: '2026-10-15', diaActual: '2026-10-15' }), HOY);
  const dias = diasConTrabajo(estado, ['2026-10-14', '2026-10-15', HOY]);
  assert.ok(dias.has('2026-10-15'));
  assert.ok(dias.has(HOY));
  assert.ok(!dias.has('2026-10-14'));
});

test('diasConTrabajo marca el día en que se terminó una toma', () => {
  const estado = conTomas({ diaOrigen: '2026-10-15', diaActual: '2026-10-17', hecha: true, diaHecha: '2026-10-17' });
  const dias = diasConTrabajo(estado, ['2026-10-15', '2026-10-16', '2026-10-17']);
  assert.deepEqual([...dias].sort(), ['2026-10-15', '2026-10-17']);
});

test('diasConTrabajo solo devuelve días de los que le pidieron', () => {
  const estado = conTomas({ diaOrigen: '2026-10-01', diaActual: '2026-10-01' });
  assert.deepEqual([...diasConTrabajo(estado, [HOY])], []);
});
