import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarEstado } from '../src/modelo.js';
import {
  agregarProyecto, agregarToma, marcarHecha, ponerEnCurso, ponerObjetivo, borrar
} from '../src/editar.js';

const DIA = '2026-10-18';

const conProyecto = () => normalizarEstado({
  proyectos: [{ id: 'p1', nombre: 'Fortaleza', etiqueta: 'VFX' }]
});

test('agregarToma la pone en el día pedido y la deja pendiente', () => {
  const { estado } = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA });
  const t = estado.tomas[0];
  assert.equal(t.diaOrigen, DIA);
  assert.equal(t.diaActual, DIA);
  assert.equal(t.hecha, false);
  assert.equal(t.queHacer, 'roto');
});

test('agregarToma devuelve el cambio listo para la cola', () => {
  const { estado, cambios } = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA });
  assert.equal(cambios.length, 1);
  assert.equal(cambios[0].tabla, 'tomas');
  assert.equal(cambios[0].borrado, false);
  assert.equal(cambios[0].id, estado.tomas[0].id);
});

test('agregarToma pone la nueva al final de su proyecto', () => {
  const uno = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  const dos = agregarToma(uno, { proyecto: 'p1', queHacer: 'b', dia: DIA }).estado;
  assert.ok(dos.tomas[1].orden > dos.tomas[0].orden);
});

test('agregarToma sin texto no agrega nada', () => {
  const previo = conProyecto();
  const { estado, cambios } = agregarToma(previo, { proyecto: 'p1', queHacer: '   ', dia: DIA });
  assert.deepEqual(estado, previo);
  assert.deepEqual(cambios, []);
});

test('marcarHecha anota el día en que se terminó y la saca de en curso', () => {
  const previo = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const id = previo.tomas[0].id;
  const { estado } = marcarHecha(ponerEnCurso(previo, id).estado, id, DIA);
  assert.equal(estado.tomas[0].hecha, true);
  assert.equal(estado.tomas[0].diaHecha, DIA);
  assert.equal(estado.tomas[0].enCurso, false);
});

test('marcarHecha de nuevo la devuelve a pendiente y limpia diaHecha', () => {
  const previo = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const id = previo.tomas[0].id;
  const { estado } = marcarHecha(marcarHecha(previo, id, DIA).estado, id, DIA);
  assert.equal(estado.tomas[0].hecha, false);
  assert.equal(estado.tomas[0].diaHecha, null);
});

test('ponerEnCurso deja una sola encendida y encola las dos que cambiaron', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p1', queHacer: 'b', dia: DIA }).estado;
  const [a, b] = estado.tomas.map((t) => t.id);
  const primero = ponerEnCurso(estado, a).estado;
  const { estado: segundo, cambios } = ponerEnCurso(primero, b);
  assert.deepEqual(segundo.tomas.filter((t) => t.enCurso).map((t) => t.id), [b]);
  assert.deepEqual(cambios.map((c) => c.id).sort(), [a, b].sort());
});

test('borrar un proyecto borra también sus tomas', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p1', queHacer: 'b', dia: DIA }).estado;
  const { estado: despues, cambios } = borrar(estado, 'proyectos', 'p1');
  assert.deepEqual(despues.proyectos, []);
  assert.deepEqual(despues.tomas, []);
  assert.equal(cambios.length, 3);
  assert.ok(cambios.every((c) => c.borrado === true));
});

test('borrar una toma deja el proyecto en paz', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  const { estado: despues, cambios } = borrar(estado, 'tomas', estado.tomas[0].id);
  assert.equal(despues.proyectos.length, 1);
  assert.deepEqual(despues.tomas, []);
  assert.equal(cambios.length, 1);
});

test('ponerObjetivo crea el día si no existía', () => {
  const { estado, cambios } = ponerObjetivo(conProyecto(), DIA, 'Cerrar Fortaleza.');
  assert.equal(estado.dias.length, 1);
  assert.equal(estado.dias[0].objetivo, 'Cerrar Fortaleza.');
  assert.equal(cambios[0].tabla, 'dias');
  assert.equal(cambios[0].id, DIA);
});

test('ponerObjetivo sobre un día que ya existe lo reemplaza', () => {
  const uno = ponerObjetivo(conProyecto(), DIA, 'viejo').estado;
  const { estado } = ponerObjetivo(uno, DIA, 'nuevo');
  assert.equal(estado.dias.length, 1);
  assert.equal(estado.dias[0].objetivo, 'nuevo');
});

test('agregarProyecto no acepta un nombre vacío', () => {
  const previo = normalizarEstado(null);
  const { estado, cambios } = agregarProyecto(previo, { nombre: '  ' });
  assert.deepEqual(estado, previo);
  assert.deepEqual(cambios, []);
});

test('agregarProyecto le da un color de la lista', () => {
  const { estado } = agregarProyecto(normalizarEstado(null), { nombre: 'Kromatik' });
  assert.ok(['acid', 'ok', 'violet', 'warn'].includes(estado.proyectos[0].color));
});

test('editar no muta el estado que recibe', () => {
  const previo = conProyecto();
  agregarToma(previo, { proyecto: 'p1', queHacer: 'a', dia: DIA });
  assert.deepEqual(previo.tomas, []);
});
