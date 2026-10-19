import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarEstado } from '../src/modelo.js';
import { loQueDiceRender } from '../src/render-dice.js';

const HOY = '2026-10-18';
const VACIO = { proyectos: [], tomas: [], dias: [] };

function conPendientes(cuantos, proyectos = ['p1']) {
  return normalizarEstado({
    proyectos: proyectos.map((id) => ({ id, nombre: id === 'p1' ? 'Fortaleza' : 'Kromatik' })),
    tomas: Array.from({ length: cuantos }, (_, i) => ({
      id: `t${i}`,
      proyecto: proyectos[i % proyectos.length],
      queHacer: 'algo',
      diaOrigen: HOY,
      diaActual: HOY
    }))
  });
}

test('si el día tiene texto escrito a mano, gana ese', () => {
  const estado = normalizarEstado({ ...conPendientes(3), dias: [{ fecha: HOY, renderDice: 'lo que sea' }] });
  assert.equal(loQueDiceRender(estado, HOY), 'lo que sea');
});

test('cuenta lo que falta y nombra el proyecto cuando es uno solo', () => {
  assert.equal(loQueDiceRender(conPendientes(13), HOY), '13 pendientes de Fortaleza.');
});

test('con varios proyectos no nombra ninguno', () => {
  assert.equal(loQueDiceRender(conPendientes(5, ['p1', 'p2']), HOY), '5 pendientes.');
});

test('uno solo va en singular', () => {
  assert.equal(loQueDiceRender(conPendientes(1), HOY), '1 pendiente de Fortaleza.');
});

test('no habla de ayer ni de lo que quedó sin hacer', () => {
  const dicho = loQueDiceRender(conPendientes(3), HOY);
  assert.doesNotMatch(dicho, /ayer|qued|sin cerrar/i);
});

test('con todo cerrado lo dice sin felicitar de más', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'x', diaOrigen: HOY, diaActual: HOY, hecha: true, diaHecha: HOY }]
  });
  assert.equal(loQueDiceRender(estado, HOY), 'Está todo cerrado.');
});

test('sin nada anotado invita a anotar', () => {
  assert.equal(loQueDiceRender(VACIO, HOY), 'Anotá lo primero del día.');
});

test('lo que está en pausa no se cuenta', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }, { id: 'p2', nombre: 'Munich', pausado: true }],
    tomas: [
      { id: 't1', proyecto: 'p1', queHacer: 'a', diaOrigen: HOY, diaActual: HOY },
      { id: 't2', proyecto: 'p2', queHacer: 'b', diaOrigen: HOY, diaActual: HOY },
      { id: 't3', proyecto: 'p2', queHacer: 'c', diaOrigen: HOY, diaActual: HOY }
    ]
  });
  assert.equal(loQueDiceRender(estado, HOY), '1 pendiente de Fortaleza.');
});

test('nunca dice una hora', () => {
  for (const estado of [VACIO, conPendientes(1), conPendientes(5, ['p1', 'p2'])]) {
    assert.doesNotMatch(loQueDiceRender(estado, HOY), /\d{1,2}[:.]\d{2}/);
  }
});
