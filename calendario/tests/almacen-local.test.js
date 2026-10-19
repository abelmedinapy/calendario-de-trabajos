import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarEstado } from '../src/modelo.js';
import { crearAlmacen } from '../src/almacen-local.js';

const VACIO = { proyectos: [], tomas: [], dias: [] };

function storageFalso(inicial = {}) {
  const datos = { ...inicial };
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v); },
    removeItem: (k) => { delete datos[k]; },
    datos
  };
}

const estadoDeEjemplo = () => normalizarEstado({
  proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
  tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'roto', diaActual: '2026-10-18' }]
});

const cambio = (id, extra = {}) => ({ id, tabla: 'tomas', fila: { id }, borrado: false, ...extra });

test('lo guardado se lee igual', () => {
  const a = crearAlmacen(storageFalso());
  const estado = estadoDeEjemplo();
  assert.equal(a.guardarEstado(estado), true);
  assert.deepEqual(a.leerEstado(), estado);
});

test('leerEstado devuelve un estado vacío si no hay nada', () => {
  assert.deepEqual(crearAlmacen(storageFalso()).leerEstado(), VACIO);
});

test('leerEstado devuelve un estado vacío si lo guardado es basura', () => {
  const a = crearAlmacen(storageFalso({ 'calendario:estado': 'no soy json' }));
  assert.deepEqual(a.leerEstado(), VACIO);
});

test('la cola conserva el orden y sacarDeLaCola saca solo lo pedido', () => {
  const a = crearAlmacen(storageFalso());
  a.encolar(cambio('c1'));
  a.encolar(cambio('c2'));
  a.encolar(cambio('c3'));
  assert.deepEqual(a.cola().map((c) => c.id), ['c1', 'c2', 'c3']);
  a.sacarDeLaCola(['c1', 'c3']);
  assert.deepEqual(a.cola().map((c) => c.id), ['c2']);
});

test('encolar dos veces el mismo id deja un solo cambio, el último', () => {
  const a = crearAlmacen(storageFalso());
  a.encolar(cambio('c1', { fila: { id: 'c1', queHacer: 'viejo' } }));
  a.encolar(cambio('c1', { fila: { id: 'c1', queHacer: 'nuevo' } }));
  assert.equal(a.cola().length, 1);
  assert.equal(a.cola()[0].fila.queHacer, 'nuevo');
});

test('la cola sobrevive a otro almacén sobre el mismo storage', () => {
  const storage = storageFalso();
  crearAlmacen(storage).encolar(cambio('c1'));
  assert.deepEqual(crearAlmacen(storage).cola().map((c) => c.id), ['c1']);
});

test('si el storage tira al escribir, guardarEstado devuelve false y no explota', () => {
  const roto = { getItem: () => null, setItem: () => { throw new Error('lleno'); } };
  const a = crearAlmacen(roto);
  assert.equal(a.guardarEstado(estadoDeEjemplo()), false);
  assert.equal(a.puedeGuardar(), false);
});

test('si el storage tira al leer, leerEstado devuelve el estado vacío', () => {
  const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => {} };
  assert.deepEqual(crearAlmacen(roto).leerEstado(), VACIO);
});

test('si el storage tira, encolar no explota y el cambio no se pierde', () => {
  const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('lleno'); } };
  const a = crearAlmacen(roto);
  a.encolar(cambio('c1'));
  assert.deepEqual(a.cola().map((c) => c.id), ['c1']);
});

test('sin storage del todo el almacén igual funciona', () => {
  const a = crearAlmacen(null);
  assert.deepEqual(a.leerEstado(), VACIO);
  assert.equal(a.guardarEstado(estadoDeEjemplo()), false);
  assert.equal(a.puedeGuardar(), false);
});

test('puedeGuardar es true mientras el storage responda', () => {
  assert.equal(crearAlmacen(storageFalso()).puedeGuardar(), true);
});

test('con el storage roto el almacén igual recuerda dentro de la pestaña', () => {
  // Sin esto, en una ventana privada no se guarda ni local ni en la nube: la
  // cola también vive en el storage, así que el cambio se perdía en silencio.
  const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('lleno'); } };
  const a = crearAlmacen(roto);
  const estado = estadoDeEjemplo();
  a.guardarEstado(estado);
  assert.deepEqual(a.leerEstado(), estado);
  a.encolar(cambio('c1'));
  assert.deepEqual(a.cola().map((c) => c.id), ['c1']);
  a.sacarDeLaCola(['c1']);
  assert.deepEqual(a.cola(), []);
});

test('con el storage roto puedeGuardar sigue diciendo que no', () => {
  const roto = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
  const a = crearAlmacen(roto);
  a.guardarEstado(estadoDeEjemplo());
  assert.equal(a.puedeGuardar(), false);
});

test('sin storage del todo también recuerda dentro de la pestaña', () => {
  const a = crearAlmacen(null);
  a.encolar(cambio('c1'));
  assert.deepEqual(a.cola().map((c) => c.id), ['c1']);
});
