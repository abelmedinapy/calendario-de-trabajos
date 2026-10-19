import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarEstado } from '../src/modelo.js';
import { fusionar, sincronizar } from '../src/sync.js';

const DIA = '2026-10-18';

const estadoCon = (tomas, extra = {}) => normalizarEstado({
  proyectos: [{ id: 'p1', nombre: 'Fortaleza', actualizado: 'a' }],
  tomas,
  ...extra
});

const toma = (id, actualizado, extra = {}) => ({
  id, proyecto: 'p1', queHacer: id, diaOrigen: DIA, diaActual: DIA, actualizado, ...extra
});

function almacenFalso(estado, cola = []) {
  let guardado = estado;
  let pendientes = [...cola];
  return {
    leerEstado: () => guardado,
    guardarEstado: (e) => { guardado = e; return true; },
    cola: () => pendientes,
    sacarDeLaCola: (ids) => { pendientes = pendientes.filter((c) => !ids.includes(c.id)); },
    puedeGuardar: () => true,
    get loGuardado() { return guardado; }
  };
}

test('fusionar: para la misma fila gana la de actualizado más nuevo', () => {
  const local = estadoCon([toma('t1', '2026-10-18T10:00:00Z', { queHacer: 'local' })]);
  const remoto = estadoCon([toma('t1', '2026-10-18T09:00:00Z', { queHacer: 'remoto' })]);
  assert.equal(fusionar(local, remoto).tomas[0].queHacer, 'local');
  assert.equal(fusionar(remoto, local).tomas[0].queHacer, 'local');
});

test('fusionar: una fila que solo está de un lado sobrevive', () => {
  const local = estadoCon([toma('t1', 'a')]);
  const remoto = estadoCon([toma('t2', 'a')]);
  assert.deepEqual(fusionar(local, remoto).tomas.map((t) => t.id).sort(), ['t1', 't2']);
});

test('fusionar no duplica filas con el mismo id', () => {
  const local = estadoCon([toma('t1', 'a')]);
  const remoto = estadoCon([toma('t1', 'b')]);
  assert.equal(fusionar(local, remoto).tomas.length, 1);
  assert.equal(fusionar(local, remoto).proyectos.length, 1);
});

test('fusionar: el que gana aporta la fila entera, no se mezclan campos', () => {
  const local = estadoCon([toma('t1', '2026-10-18T10:00:00Z', { detalle: 'el bueno', codigo: '' })]);
  const remoto = estadoCon([toma('t1', '2026-10-18T09:00:00Z', { detalle: 'el viejo', codigo: 'T22' })]);
  const t = fusionar(local, remoto).tomas[0];
  assert.equal(t.detalle, 'el bueno');
  assert.equal(t.codigo, '');
});

test('fusionar junta los días por fecha, no por id', () => {
  const local = normalizarEstado({ dias: [{ fecha: DIA, objetivo: 'nuevo', actualizado: 'b' }] });
  const remoto = normalizarEstado({ dias: [{ fecha: DIA, objetivo: 'viejo', actualizado: 'a' }] });
  const d = fusionar(local, remoto).dias;
  assert.equal(d.length, 1);
  assert.equal(d[0].objetivo, 'nuevo');
});

test('sincronizar sube la cola y la vacía solo con lo que confirmó la nube', () => {
  const almacen = almacenFalso(estadoCon([]), [
    { id: 'c1', tabla: 'tomas', fila: toma('t1', 'a'), borrado: false },
    { id: 'c2', tabla: 'tomas', fila: toma('t2', 'a'), borrado: false },
    { id: 'c3', tabla: 'tomas', fila: toma('t3', 'a'), borrado: false }
  ]);
  const nube = {
    hayLlave: () => true,
    subirCambios: async () => ['c1', 'c2'],
    bajarEstado: async () => estadoCon([])
  };
  return sincronizar({ almacen, nube }).then(({ subio }) => {
    assert.equal(subio, true);
    assert.deepEqual(almacen.cola().map((c) => c.id), ['c3']);
  });
});

test('si la nube falla, sincronizar devuelve el estado local y subio=false', async () => {
  const local = estadoCon([toma('t1', 'a')]);
  const almacen = almacenFalso(local, [{ id: 'c1', tabla: 'tomas', fila: toma('t1', 'a'), borrado: false }]);
  const nube = {
    hayLlave: () => true,
    subirCambios: async () => { throw new Error('sin red'); },
    bajarEstado: async () => { throw new Error('sin red'); }
  };
  const { estado, subio } = await sincronizar({ almacen, nube });
  assert.equal(subio, false);
  assert.deepEqual(estado, local);
  assert.deepEqual(almacen.cola().map((c) => c.id), ['c1']);
});

test('sin llave no toca la red ni vacía la cola', async () => {
  const almacen = almacenFalso(estadoCon([]), [{ id: 'c1', tabla: 'tomas', fila: toma('t1', 'a'), borrado: false }]);
  let tocó = false;
  const nube = {
    hayLlave: () => false,
    subirCambios: async () => { tocó = true; return []; },
    bajarEstado: async () => { tocó = true; return estadoCon([]); }
  };
  const { subio } = await sincronizar({ almacen, nube });
  assert.equal(tocó, false);
  assert.equal(subio, false);
  assert.deepEqual(almacen.cola().map((c) => c.id), ['c1']);
});

test('sincronizar guarda localmente lo que fusionó', async () => {
  const almacen = almacenFalso(estadoCon([toma('t1', 'a')]));
  const nube = {
    hayLlave: () => true,
    subirCambios: async () => [],
    bajarEstado: async () => estadoCon([toma('t2', 'a')])
  };
  const { estado } = await sincronizar({ almacen, nube });
  assert.deepEqual(estado.tomas.map((t) => t.id).sort(), ['t1', 't2']);
  assert.deepEqual(almacen.loGuardado, estado);
});

test('sincronizar relee lo local después de subir: no pisa lo que se escribió mientras viajaba', async () => {
  const almacen = almacenFalso(estadoCon([toma('t1', 'a')]));
  const nube = {
    hayLlave: () => true,
    subirCambios: async () => {
      // mientras el pedido viaja, Abel agrega otra toma
      almacen.guardarEstado(estadoCon([toma('t1', 'a'), toma('t2', 'b')]));
      return [];
    },
    bajarEstado: async () => estadoCon([toma('t1', 'a')])
  };
  const { estado } = await sincronizar({ almacen, nube });
  assert.deepEqual(estado.tomas.map((t) => t.id).sort(), ['t1', 't2']);
});

test('los cambios que la nube rechaza salen de la cola y se informan', async () => {
  const almacen = almacenFalso(estadoCon([]), [
    { id: 'c1', tabla: 'tomas', fila: toma('t1', 'a') },
    { id: 'c2', tabla: 'tomas', fila: { roto: true } }
  ]);
  const nube = {
    hayLlave: () => true,
    subirCambios: async () => ({ aplicados: ['c1'], rechazados: [{ id: 'c2', motivo: 'mal formado' }] }),
    bajarEstado: async () => estadoCon([])
  };
  const { rechazados } = await sincronizar({ almacen, nube });
  assert.deepEqual(almacen.cola(), []);
  assert.deepEqual(rechazados.map((r) => r.id), ['c2']);
});

test('dos sincronizaciones a la vez no se pisan: la segunda espera', async () => {
  const almacen = almacenFalso(estadoCon([toma('t1', 'a')]));
  let enVuelo = 0;
  let maximo = 0;
  const nube = {
    hayLlave: () => true,
    subirCambios: async () => {
      enVuelo += 1;
      maximo = Math.max(maximo, enVuelo);
      await new Promise((r) => setTimeout(r, 20));
      enVuelo -= 1;
      return [];
    },
    bajarEstado: async () => estadoCon([toma('t1', 'a')])
  };
  await Promise.all([
    sincronizar({ almacen, nube }),
    sincronizar({ almacen, nube }),
    sincronizar({ almacen, nube })
  ]);
  assert.equal(maximo, 1);
});
