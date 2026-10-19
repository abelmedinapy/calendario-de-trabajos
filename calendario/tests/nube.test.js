import test from 'node:test';
import assert from 'node:assert/strict';

import { crearNube } from '../src/nube.js';

function traerFalso(respuestas) {
  const pedidos = [];
  const traer = async (url, opciones = {}) => {
    pedidos.push({ url, opciones });
    const r = respuestas.shift();
    if (r instanceof Error) throw r;
    return {
      ok: r.estado < 400,
      status: r.estado,
      json: async () => r.cuerpo
    };
  };
  traer.pedidos = pedidos;
  return traer;
}

test('bajarEstado manda la llave en la cabecera', async () => {
  const traer = traerFalso([{ estado: 200, cuerpo: { proyectos: [], tomas: [], dias: [] } }]);
  await crearNube({ llave: 'secreta', traer }).bajarEstado();
  assert.equal(traer.pedidos[0].url, '/api/estado');
  assert.equal(traer.pedidos[0].opciones.headers.Authorization, 'Llave secreta');
});

test('bajarEstado normaliza lo que viene de la red', async () => {
  const traer = traerFalso([{ estado: 200, cuerpo: { tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'x' }] } }]);
  const estado = await crearNube({ llave: 'secreta', traer }).bajarEstado();
  assert.deepEqual(estado.proyectos, []);
  assert.equal(estado.tomas[0].hecha, false);
});

test('un 401 avisa que la llave no sirve', async () => {
  const traer = traerFalso([{ estado: 401, cuerpo: { error: 'llave' } }]);
  await assert.rejects(crearNube({ llave: 'mala', traer }).bajarEstado(), /llave/);
});

test('subirCambios devuelve los ids que la nube confirmó', async () => {
  const traer = traerFalso([{ estado: 200, cuerpo: { aplicados: ['c1'] } }]);
  const ids = await crearNube({ llave: 'secreta', traer })
    .subirCambios([{ id: 'c1', tabla: 'tomas', fila: {}, borrado: false }]);
  assert.deepEqual(ids, ['c1']);
  assert.equal(traer.pedidos[0].opciones.method, 'POST');
});

test('subirCambios sin cambios no toca la red', async () => {
  const traer = traerFalso([]);
  assert.deepEqual(await crearNube({ llave: 'secreta', traer }).subirCambios([]), []);
  assert.equal(traer.pedidos.length, 0);
});

test('hayLlave dice si hay con qué entrar', () => {
  assert.equal(crearNube({ llave: '', traer: traerFalso([]) }).hayLlave(), false);
  assert.equal(crearNube({ llave: 'secreta', traer: traerFalso([]) }).hayLlave(), true);
});

test('si no hay red, el error sale para arriba', async () => {
  const traer = traerFalso([new Error('sin red')]);
  await assert.rejects(crearNube({ llave: 'secreta', traer }).bajarEstado(), /sin red/);
});
