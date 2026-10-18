import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarEstado, agruparPorProyecto, contadores, marcarEnCurso } from '../src/modelo.js';

const DIA = '2026-10-18';

function toma(id, proyecto, extra = {}) {
  return normalizarEstado({
    tomas: [{ id, proyecto, queHacer: id, diaOrigen: DIA, diaActual: DIA, ...extra }]
  }).tomas[0];
}

function estadoDeEjemplo() {
  return normalizarEstado({
    proyectos: [
      { id: 'p1', nombre: 'Fortaleza', etiqueta: 'VFX', color: 'acid' },
      { id: 'p2', nombre: 'Kromatik', etiqueta: 'Spot', color: 'ok' },
      { id: 'p3', nombre: 'MCAL', etiqueta: 'Propio', color: 'violet' },
      { id: 'p4', nombre: 'Petrobras', etiqueta: 'Spot', color: 'warn' }
    ],
    tomas: [
      { id: 't1', proyecto: 'p1', queHacer: 'track', diaOrigen: DIA, diaActual: DIA, hecha: true, diaHecha: DIA },
      { id: 't2', proyecto: 'p1', queHacer: 'roto', diaOrigen: DIA, diaActual: DIA },
      { id: 't3', proyecto: 'p1', queHacer: 'cleanup', diaOrigen: DIA, diaActual: DIA },
      { id: 't4', proyecto: 'p2', queHacer: 'nodos', diaOrigen: DIA, diaActual: DIA, hecha: true, diaHecha: DIA },
      { id: 't5', proyecto: 'p2', queHacer: 'grade', diaOrigen: DIA, diaActual: DIA },
      { id: 't6', proyecto: 'p2', queHacer: 'prores', diaOrigen: DIA, diaActual: DIA },
      { id: 't7', proyecto: 'p3', queHacer: 'cadencia', diaOrigen: DIA, diaActual: DIA }
    ],
    dias: [{ fecha: DIA, objetivo: 'Cerrar los VFX de Fortaleza.' }]
  });
}

test('normalizarEstado tolera campos que faltan y basura', () => {
  const e = normalizarEstado({ tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'roto' }] });
  assert.deepEqual(e.proyectos, []);
  assert.equal(e.tomas[0].hecha, false);
  assert.equal(e.tomas[0].enCurso, false);
  assert.equal(e.tomas[0].orden, 0);
});

test('normalizarEstado de null o basura devuelve el estado vacío', () => {
  assert.deepEqual(normalizarEstado(null), { proyectos: [], tomas: [], dias: [] });
  assert.deepEqual(normalizarEstado('qué sé yo'), { proyectos: [], tomas: [], dias: [] });
});

test('agruparPorProyecto separa hechas de pendientes y respeta el orden', () => {
  const e = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [
      { id: 'c', proyecto: 'p1', queHacer: 'c', diaActual: DIA, orden: 2 },
      { id: 'a', proyecto: 'p1', queHacer: 'a', diaActual: DIA, orden: 0, hecha: true },
      { id: 'b', proyecto: 'p1', queHacer: 'b', diaActual: DIA, orden: 1 }
    ]
  });
  const [grupo] = agruparPorProyecto(e, DIA);
  assert.equal(grupo.proyecto.nombre, 'Fortaleza');
  assert.deepEqual(grupo.hechas.map(t => t.id), ['a']);
  assert.deepEqual(grupo.pendientes.map(t => t.id), ['b', 'c']);
});

test('agruparPorProyecto saltea los proyectos sin tomas ese día', () => {
  const grupos = agruparPorProyecto(estadoDeEjemplo(), DIA);
  assert.deepEqual(grupos.map(g => g.proyecto.id), ['p1', 'p2', 'p3']);
});

test('agruparPorProyecto ignora las tomas de otro día', () => {
  const e = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'x', diaActual: '2026-10-17' }]
  });
  assert.deepEqual(agruparPorProyecto(e, DIA), []);
});

test('contadores cuenta proyectos con tomas, tomas del día y hechas', () => {
  assert.deepEqual(contadores(estadoDeEjemplo(), DIA), { proyectos: 3, tomas: 7, listas: 2 });
});

test('marcarEnCurso apaga la que estaba en curso', () => {
  const previo = normalizarEstado({
    tomas: [
      { id: 't1', proyecto: 'p1', queHacer: 'a', diaActual: DIA, enCurso: true },
      { id: 't2', proyecto: 'p1', queHacer: 'b', diaActual: DIA }
    ]
  });
  const e = marcarEnCurso(previo, 't2');
  assert.deepEqual(e.tomas.filter(t => t.enCurso).map(t => t.id), ['t2']);
});

test('marcarEnCurso no muta el estado que recibe', () => {
  const previo = normalizarEstado({
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'a', diaActual: DIA }]
  });
  marcarEnCurso(previo, 't1');
  assert.equal(previo.tomas[0].enCurso, false);
});

test('marcarEnCurso sobre una toma hecha no la enciende', () => {
  const previo = normalizarEstado({
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'a', diaActual: DIA, hecha: true }]
  });
  assert.equal(marcarEnCurso(previo, 't1').tomas[0].enCurso, false);
});

test('una toma normalizada tiene todos los campos del modelo', () => {
  const t = toma('t1', 'p1');
  assert.deepEqual(Object.keys(t).sort(), [
    'actualizado', 'codigo', 'detalle', 'diaActual', 'diaHecha', 'diaOrigen',
    'enCurso', 'grafico', 'graficoValores', 'hecha', 'id', 'orden', 'proyecto', 'queHacer'
  ]);
});
