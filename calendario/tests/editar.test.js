import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarEstado, agruparPorProyecto } from '../src/modelo.js';
import {
  agregarProyecto, agregarToma, marcarHecha, ponerEnCurso, ponerObjetivo, borrar,
  ponerTextoDeToma, ponerTextoDeProyecto,
  agregarBorradorDeToma, agregarBorradorDeProyecto, quitarBorradorVacio, moverTrabajo
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
  assert.equal(cambios[0].fila.borrado, false);
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

test('borrar un proyecto lo saca del tablero junto con sus tomas', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p1', queHacer: 'b', dia: DIA }).estado;
  const { estado: despues, cambios } = borrar(estado, 'proyectos', 'p1');
  assert.deepEqual(agruparPorProyecto(despues, DIA), []);
  assert.equal(cambios.length, 3);
});

test('borrar una toma deja el proyecto en paz', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  const { estado: despues, cambios } = borrar(estado, 'tomas', estado.tomas[0].id);
  assert.equal(despues.proyectos[0].borrado, false);
  assert.deepEqual(agruparPorProyecto(despues, DIA, { incluirVacios: true })[0].pendientes, []);
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

test('borrar deja una lápida en vez de sacar la fila, para que el otro aparato se entere', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  const { estado: despues, cambios } = borrar(estado, 'tomas', estado.tomas[0].id);
  assert.equal(despues.tomas.length, 1);
  assert.equal(despues.tomas[0].borrado, true);
  assert.equal(cambios[0].fila.borrado, true);
});

test('borrar un proyecto deja lápidas de él y de sus tomas', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p1', queHacer: 'b', dia: DIA }).estado;
  const { estado: despues, cambios } = borrar(estado, 'proyectos', 'p1');
  assert.equal(despues.proyectos[0].borrado, true);
  assert.deepEqual(despues.tomas.map((t) => t.borrado), [true, true]);
  assert.equal(cambios.length, 3);
});

test('se puede corregir el texto de una toma ya escrita', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'Generar Transicion', dia: DIA }).estado;
  const id = estado.tomas[0].id;
  const { estado: despues, cambios } = ponerTextoDeToma(estado, id, 'queHacer', 'Generar transición');
  assert.equal(despues.tomas[0].queHacer, 'Generar transición');
  assert.equal(cambios[0].id, id);
  assert.equal(cambios[0].tabla, 'tomas');
});

test('se le puede poner código y detalle a una toma que no los tenía', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const id = estado.tomas[0].id;
  const conCodigo = ponerTextoDeToma(estado, id, 'codigo', 'T22').estado;
  const conDetalle = ponerTextoDeToma(conCodigo, id, 'detalle', 'sale en el 118').estado;
  assert.equal(conDetalle.tomas[0].codigo, 'T22');
  assert.equal(conDetalle.tomas[0].detalle, 'sale en el 118');
});

test('no se puede dejar una toma sin texto por error', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { estado: despues, cambios } = ponerTextoDeToma(estado, estado.tomas[0].id, 'queHacer', '   ');
  assert.deepEqual(despues, estado);
  assert.deepEqual(cambios, []);
});

test('un campo que no es de texto no se toca', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { cambios } = ponerTextoDeToma(estado, estado.tomas[0].id, 'hecha', 'sí');
  assert.deepEqual(cambios, []);
});

test('escribir el mismo texto no encola un cambio al pedo', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { cambios } = ponerTextoDeToma(estado, estado.tomas[0].id, 'queHacer', 'roto');
  assert.deepEqual(cambios, []);
});

test('un borrador de toma nace vacío y todavía no se sube', () => {
  const { estado, cambios } = agregarBorradorDeToma(conProyecto(), { proyecto: 'p1', dia: DIA });
  assert.equal(estado.tomas.length, 1);
  assert.equal(estado.tomas[0].queHacer, '');
  assert.equal(estado.tomas[0].diaActual, DIA);
  assert.deepEqual(cambios, [], 'un borrador vacío no tiene por qué viajar a la nube');
});

test('escribirle el texto al borrador es lo que lo sube', () => {
  const { estado } = agregarBorradorDeToma(conProyecto(), { proyecto: 'p1', dia: DIA });
  const id = estado.tomas[0].id;
  const { estado: despues, cambios } = ponerTextoDeToma(estado, id, 'queHacer', 'Generar transición');
  assert.equal(despues.tomas[0].queHacer, 'Generar transición');
  assert.equal(cambios.length, 1);
  assert.equal(cambios[0].fila.queHacer, 'Generar transición');
});

test('un borrador que queda vacío se va sin dejar rastro', () => {
  const previo = conProyecto();
  const { estado } = agregarBorradorDeToma(previo, { proyecto: 'p1', dia: DIA });
  const { estado: despues, cambios } = quitarBorradorVacio(estado, estado.tomas[0].id);
  assert.deepEqual(despues.tomas, []);
  assert.deepEqual(cambios, [], 'nunca se subió, así que no hay lápida que mandar');
});

test('quitarBorradorVacio no toca una toma que sí tiene texto', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { estado: despues } = quitarBorradorVacio(estado, estado.tomas[0].id);
  assert.equal(despues.tomas.length, 1);
});

test('un borrador de proyecto nace sin nombre y tampoco se sube', () => {
  const { estado, cambios } = agregarBorradorDeProyecto(normalizarEstado(null));
  assert.equal(estado.proyectos.length, 1);
  assert.equal(estado.proyectos[0].nombre, '');
  assert.deepEqual(cambios, []);
});

test('ponerle el nombre al proyecto es lo que lo sube', () => {
  const { estado } = agregarBorradorDeProyecto(normalizarEstado(null));
  const id = estado.proyectos[0].id;
  const { estado: despues, cambios } = ponerTextoDeProyecto(estado, id, 'nombre', 'Fortaleza');
  assert.equal(despues.proyectos[0].nombre, 'Fortaleza');
  assert.equal(cambios[0].tabla, 'proyectos');
});

test('un proyecto sin nombre se va sin dejar rastro', () => {
  const { estado } = agregarBorradorDeProyecto(normalizarEstado(null));
  const { estado: despues, cambios } = quitarBorradorVacio(estado, estado.proyectos[0].id, 'proyectos');
  assert.deepEqual(despues.proyectos, []);
  assert.deepEqual(cambios, []);
});

test('mover un trabajo a otro día lo saca del día de hoy', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { estado: despues, cambios } = moverTrabajo(estado, estado.tomas[0].id, '2026-10-19');
  assert.equal(despues.tomas[0].diaActual, '2026-10-19');
  assert.equal(cambios.length, 1);
});

test('mover no toca el día en que nació: el historial queda', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { estado: despues } = moverTrabajo(estado, estado.tomas[0].id, '2026-10-21');
  assert.equal(despues.tomas[0].diaOrigen, DIA);
});

test('mover al mismo día no encola nada', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  assert.deepEqual(moverTrabajo(estado, estado.tomas[0].id, DIA).cambios, []);
});
