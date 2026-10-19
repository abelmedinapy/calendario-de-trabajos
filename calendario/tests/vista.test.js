import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarEstado } from '../src/modelo.js';
import { tableroHTML, tarjetaHTML, scrubberHTML } from '../src/vista.js';

const HOY = '2026-10-18';
const VACIO = normalizarEstado(null);

const cuantos = (html, patron) => (html.match(patron) || []).length;

function unaToma(extra = {}) {
  return normalizarEstado({
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'Roto del brazo', diaOrigen: HOY, diaActual: HOY, ...extra }]
  }).tomas[0];
}

function conProyectos(cantidad) {
  return normalizarEstado({
    proyectos: Array.from({ length: cantidad }, (_, i) => ({ id: `p${i}`, nombre: `Proyecto ${i}`, etiqueta: 'VFX' })),
    tomas: Array.from({ length: cantidad }, (_, i) => ({
      id: `t${i}`, proyecto: `p${i}`, queHacer: 'algo', diaOrigen: HOY, diaActual: HOY
    })),
    dias: [{ fecha: HOY, objetivo: 'Cerrar los VFX de Fortaleza y mandar el pase 2 de Kromatik.' }]
  });
}

test('el tablero muestra el objetivo del día', () => {
  assert.match(tableroHTML(conProyectos(3), HOY), /Cerrar los VFX de Fortaleza/);
});

test('hay un nodo del riel por proyecto con tomas', () => {
  assert.equal(cuantos(tableroHTML(conProyectos(3), HOY), /class="node"/g), 3);
});

test('la toma en curso lleva la clase live y es una sola', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [
      { id: 't1', proyecto: 'p1', queHacer: 'a', diaActual: HOY, enCurso: true },
      { id: 't2', proyecto: 'p1', queHacer: 'b', diaActual: HOY }
    ]
  });
  assert.equal(cuantos(tableroHTML(estado, HOY), /card live/g), 1);
});

test('las tomas hechas salen como chip tachado, no como tarjeta', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'track de cámara', diaActual: HOY, hecha: true }]
  });
  const html = tableroHTML(estado, HOY);
  assert.match(html, /class="chip"/);
  assert.equal(cuantos(html, /class="card/g), 0);
});

test('la tarjeta dibuja el gráfico que pide la toma', () => {
  assert.match(tarjetaHTML(unaToma({ grafico: 'capas', graficoValores: { hechas: 2, total: 3 } })), /class="layers"/);
  assert.match(tarjetaHTML(unaToma({ grafico: 'curva', graficoValores: { ev: '+0.5' } })), /<svg/);
  assert.match(tarjetaHTML(unaToma({ grafico: 'cadencia', graficoValores: { cada: 3, imgs: 8 } })), /class="strip"/);
  const pelada = tarjetaHTML(unaToma());
  assert.doesNotMatch(pelada, /class="layers"|<svg|class="strip"/);
});

test('una toma arrastrada dice cuántos días lleva', () => {
  assert.match(tarjetaHTML(unaToma({ diaOrigen: '2026-10-15', diaActual: HOY })), /3 días/);
});

test('una toma de hoy no dice nada de días', () => {
  assert.doesNotMatch(tarjetaHTML(unaToma()), /días/);
});

test('un día sin proyectos invita a anotar', () => {
  const html = tableroHTML(VACIO, HOY);
  assert.match(html, /Anotá lo primero del día/);
  assert.doesNotMatch(html, /class="cols"|class="col /);
});

test('escapa el HTML que venga en los textos', () => {
  const html = tarjetaHTML(unaToma({ queHacer: '<script>alert(1)</script>', detalle: 'a & b' }));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /a &amp; b/);
});

test('un texto larguísimo no mete atributos de ancho en el HTML', () => {
  const largo = 'a'.repeat(400);
  const html = tarjetaHTML(unaToma({ detalle: largo }));
  assert.match(html, new RegExp(largo));
  assert.doesNotMatch(html, /style="/);
});

test('el scrubber marca el día abierto y los días con trabajo', () => {
  const html = scrubberHTML(conProyectos(1), HOY);
  assert.equal(cuantos(html, /class="day[^"]*now/g), 1);
  assert.ok(cuantos(html, /has/g) >= 1);
});

test('con seis proyectos o más el tablero avisa, sin impedir nada', () => {
  const html = tableroHTML(conProyectos(6), HOY);
  assert.match(html, /seis proyectos en un día/);
  assert.equal(cuantos(html, /class="node"/g), 6);
});

test('con cinco proyectos todavía no avisa', () => {
  assert.doesNotMatch(tableroHTML(conProyectos(5), HOY), /seis proyectos en un día/);
});

test('los controles de editar están en el HTML pero marcados como ocultos', () => {
  const html = tableroHTML(conProyectos(1), HOY);
  for (const accion of ['nueva-toma', 'borrar-proyecto', 'nuevo-proyecto']) {
    assert.match(html, new RegExp(`class="oculto[^"]*"[^>]*data-accion="${accion}"`), accion);
  }
});

test('la tarjeta trae su botón de borrar, oculto', () => {
  assert.match(tarjetaHTML(unaToma()), /class="oculto[^"]*"[^>]*data-accion="borrar-toma"/);
});

test('el botón de marcar hecha no está oculto: es parte del dibujo', () => {
  assert.doesNotMatch(tarjetaHTML(unaToma()), /class="oculto[^"]*"[^>]*data-accion="hecha"/);
});

test('hay un botón para mostrar los controles', () => {
  assert.match(tableroHTML(conProyectos(1), HOY), /data-accion="editar"/);
});

test('en modo editar se ve el proyecto que todavía no tiene tomas', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }, { id: 'p2', nombre: 'Kromatik' }],
    tomas: [{ id: 't1', proyecto: 'p2', queHacer: 'grade', diaActual: HOY }]
  });
  assert.doesNotMatch(tableroHTML(estado, HOY), /Fortaleza/);
  assert.match(tableroHTML(estado, HOY, { editando: true }), /Fortaleza/);
});

test('un proyecto vacío en modo editar trae su botón de agregar toma', () => {
  const estado = normalizarEstado({ proyectos: [{ id: 'p1', nombre: 'Fortaleza' }] });
  assert.match(tableroHTML(estado, HOY, { editando: true }), /data-accion="nueva-toma"/);
});

test('el campo del objetivo no lleva el texto de ayuda adentro', () => {
  // Si el placeholder es un hijo del campo editable, textContent lo arrastra y
  // termina guardado adelante de lo que escribió Abel.
  const html = tableroHTML(VACIO, HOY);
  const campo = html.match(/<p[^>]*data-accion="objetivo"[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(campo, 'no encontré el campo del objetivo');
  assert.equal(campo[1].trim(), '');
  assert.match(html, /data-vacio="Escribí el objetivo del día"/);
});

test('el campo del objetivo muestra lo escrito cuando hay objetivo', () => {
  const html = tableroHTML(conProyectos(1), HOY);
  const campo = html.match(/<p[^>]*data-accion="objetivo"[^>]*>([\s\S]*?)<\/p>/);
  assert.match(campo[1], /Cerrar los VFX de Fortaleza/);
});

test('una toma hecha se puede desmarcar desde su chip', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'track', diaActual: HOY, hecha: true }]
  });
  const html = tableroHTML(estado, HOY);
  assert.match(html, /data-accion="hecha"[^>]*>[\s\S]*?<\/button>[\s\S]*?<s>/);
  assert.match(html, /data-toma="t1"/);
});

test('el chip de una toma hecha trae su botón de borrar, oculto', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'track', diaActual: HOY, hecha: true }]
  });
  assert.match(tableroHTML(estado, HOY), /class="oculto[^"]*"[^>]*data-accion="borrar-toma"/);
});

test('si el día no tiene ninguna toma, los proyectos vacíos igual se ven', () => {
  // Si no, cargás un proyecto y el tablero sigue diciendo "no hay nada anotado":
  // parece que no se guardó y lo cargás de nuevo.
  const estado = normalizarEstado({ proyectos: [{ id: 'p1', nombre: 'Fortaleza', etiqueta: 'VFX' }] });
  const html = tableroHTML(estado, HOY);
  assert.match(html, /Fortaleza/);
  assert.match(html, /data-accion="nueva-toma"/);
  assert.doesNotMatch(html, /Todavía no hay nada anotado/);
});

test('con el día ya cargado, un proyecto vacío no ensucia la captura', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }, { id: 'p2', nombre: 'Vacío' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'roto', diaActual: HOY }]
  });
  const html = tableroHTML(estado, HOY);
  assert.match(html, /Fortaleza/);
  assert.doesNotMatch(html, /Vacío/);
});

test('sin proyectos ni tomas sigue invitando a anotar', () => {
  assert.match(tableroHTML(VACIO, HOY), /Todavía no hay nada anotado/);
});

test('en modo editar se puede escribir encima del texto de la tarjeta', () => {
  const html = tarjetaHTML(unaToma({ codigo: 'T22', detalle: 'sale en el 118' }), { editando: true });
  for (const campo of ['queHacer', 'codigo', 'detalle']) {
    assert.match(html, new RegExp(`contenteditable="plaintext-only"[^>]*data-campo="${campo}"`), campo);
  }
});

test('en reposo la tarjeta no es editable: la captura no se toca sin querer', () => {
  assert.doesNotMatch(tarjetaHTML(unaToma({ codigo: 'T22', detalle: 'x' })), /contenteditable/);
});

test('en modo editar aparecen el código y el detalle vacíos para poder ponerlos', () => {
  const html = tarjetaHTML(unaToma(), { editando: true });
  assert.match(html, /data-campo="codigo"/);
  assert.match(html, /data-campo="detalle"/);
  assert.match(html, /data-vacio="/);
});

test('el tablero pasa el modo editar a sus tarjetas', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'roto', diaActual: HOY }]
  });
  assert.doesNotMatch(tableroHTML(estado, HOY), /data-campo="queHacer"/);
  assert.match(tableroHTML(estado, HOY, { editando: true }), /data-campo="queHacer"/);
});
