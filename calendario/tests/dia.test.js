import test from 'node:test';
import assert from 'node:assert/strict';

import { hoy, ventanaScrubber, diasDeAtraso, nombreCorto, fechaLarga } from '../src/dia.js';

test('a las 2 AM el día sigue siendo el de ayer', () => {
  assert.equal(hoy(new Date('2026-10-19T05:00:00Z')), '2026-10-18'); // 02:00 en Asunción
});

test('a las 5 AM empieza el día nuevo', () => {
  assert.equal(hoy(new Date('2026-10-19T08:00:00Z')), '2026-10-19'); // 05:00 en Asunción
});

test('la ventana del scrubber centra el día abierto', () => {
  assert.deepEqual(ventanaScrubber('2026-10-18', 7),
    ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21']);
});

test('la ventana cruza el borde del mes', () => {
  assert.equal(ventanaScrubber('2026-10-02', 7)[0], '2026-09-29');
});

test('los días de atraso cuentan de día a día', () => {
  assert.equal(diasDeAtraso('2026-10-15', '2026-10-18'), 3);
});

test('fechaLarga y nombreCorto salen en español', () => {
  assert.equal(fechaLarga('2026-10-18'), 'domingo 18 de octubre');
  assert.deepEqual(nombreCorto('2026-10-18'), { dia: 'dom', numero: '18' });
});
