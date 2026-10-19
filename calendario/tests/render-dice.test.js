import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarEstado } from '../src/modelo.js';
import { loQueDiceRender } from '../src/render-dice.js';

const HOY = '2026-10-18';
const VACIO = { proyectos: [], tomas: [], dias: [] };

function arrastradas(cuantas, proyectos = ['p1']) {
  return normalizarEstado({
    proyectos: proyectos.map((id) => ({ id, nombre: id === 'p1' ? 'Fortaleza' : 'Kromatik' })),
    tomas: Array.from({ length: cuantas }, (_, i) => ({
      id: `t${i}`,
      proyecto: proyectos[i % proyectos.length],
      queHacer: 'algo',
      diaOrigen: '2026-10-17',
      diaActual: HOY
    }))
  });
}

test('si el día tiene texto escrito a mano, gana ese', () => {
  const estado = normalizarEstado({ ...arrastradas(3), dias: [{ fecha: HOY, renderDice: 'lo que sea' }] });
  assert.equal(loQueDiceRender(estado, HOY), 'lo que sea');
});

test('cuenta lo que quedó sin cerrar y nombra el proyecto cuando es uno solo', () => {
  assert.equal(loQueDiceRender(arrastradas(3), HOY),
    'Ayer quedaron 3 trabajos de Fortaleza sin cerrar.');
});

test('con varios proyectos no nombra ninguno', () => {
  assert.equal(loQueDiceRender(arrastradas(5, ['p1', 'p2']), HOY),
    'Ayer quedaron 5 trabajos sin cerrar.');
});

test('un solo trabajo va en singular', () => {
  assert.equal(loQueDiceRender(arrastradas(1), HOY),
    'Ayer quedó 1 trabajo de Fortaleza sin cerrar.');
});

test('si no quedó nada pendiente, saluda sin inventar', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'x', diaOrigen: '2026-10-17', diaActual: '2026-10-17', hecha: true, diaHecha: '2026-10-17' }]
  });
  assert.equal(loQueDiceRender(estado, HOY), 'Ayer cerraste todo. Arrancamos limpio.');
});

test('el primer día de todos no habla de ayer', () => {
  assert.equal(loQueDiceRender(VACIO, HOY), 'Anotá lo primero del día.');
});

test('un día con tomas nuevas pero sin pasado tampoco habla de ayer', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'x', diaOrigen: HOY, diaActual: HOY }]
  });
  assert.equal(loQueDiceRender(estado, HOY), 'Anotá lo primero del día.');
});

test('los trabajos hechos no cuentan como arrastrados', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [
      { id: 't1', proyecto: 'p1', queHacer: 'x', diaOrigen: '2026-10-17', diaActual: HOY, hecha: true, diaHecha: HOY },
      { id: 't2', proyecto: 'p1', queHacer: 'y', diaOrigen: '2026-10-17', diaActual: HOY }
    ]
  });
  assert.equal(loQueDiceRender(estado, HOY), 'Ayer quedó 1 trabajo de Fortaleza sin cerrar.');
});

test('nunca dice una hora', () => {
  for (const estado of [VACIO, arrastradas(1), arrastradas(5, ['p1', 'p2'])]) {
    assert.doesNotMatch(loQueDiceRender(estado, HOY), /\d{1,2}[:.]\d{2}/);
  }
});

test('RENDER también habla de trabajos, no de tomas', () => {
  assert.equal(loQueDiceRender(arrastradas(3), HOY),
    'Ayer quedaron 3 trabajos de Fortaleza sin cerrar.');
  assert.equal(loQueDiceRender(arrastradas(1), HOY),
    'Ayer quedó 1 trabajo de Fortaleza sin cerrar.');
});
