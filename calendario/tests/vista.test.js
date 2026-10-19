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

test('la tarjeta no anuncia cuántos días lleva arrastrándose', () => {
  // Con todo pasando solo de un día al otro, ese cartelito aparecía en casi
  // todas las tarjetas y era puro ruido.
  assert.doesNotMatch(tarjetaHTML(unaToma({ diaOrigen: '2026-10-15', diaActual: HOY })), /3 días/);
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
  const html = scrubberHTML(conProyectos(1), HOY, { hoy: HOY });
  assert.equal(cuantos(html, /class="day[^"]*abierto/g), 1);
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

test('se puede escribir en una cápsula sin prender ningún modo', () => {
  // Se hace clic en la que uno quiere y se escribe. Lo que mantiene limpia la
  // captura no es que no se pueda escribir, sino que no haya nada dibujado de
  // más: ni botones ni textos de ayuda.
  const html = tarjetaHTML(unaToma({ codigo: 'T22', detalle: 'x' }));
  assert.match(html, /contenteditable="plaintext-only"[^>]*data-campo="queHacer"/);
  assert.match(html, /data-campo="detalle"/);
});

test('en reposo no aparecen los campos vacíos con su texto de ayuda', () => {
  const html = tarjetaHTML(unaToma());
  assert.doesNotMatch(html, /data-campo="codigo"/);
  assert.doesNotMatch(html, /data-campo="detalle"/);
});

test('en modo editar aparecen el código y el detalle vacíos para poder ponerlos', () => {
  const html = tarjetaHTML(unaToma(), { editando: true });
  assert.match(html, /data-campo="codigo"/);
  assert.match(html, /data-campo="detalle"/);
  assert.match(html, /data-vacio="/);
});

test('el modo editar es lo que saca los campos vacíos a la luz', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'roto', diaActual: HOY }]
  });
  assert.match(tableroHTML(estado, HOY), /data-campo="queHacer"/);
  assert.doesNotMatch(tableroHTML(estado, HOY), /data-campo="detalle"/);
  assert.match(tableroHTML(estado, HOY, { editando: true }), /data-campo="detalle"/);
});

test('en la pantalla se dice trabajo, no toma', () => {
  const html = tableroHTML(conProyectos(1), HOY, { editando: true });
  assert.match(html, /Agregar trabajo/);
  assert.match(html, />Trabajos</);
  assert.doesNotMatch(html, /Agregar una toma|>Tomas</);
});

test('un trabajo recién agregado se dibuja vacío, listo para escribirle', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: '', diaActual: HOY }]
  });
  const html = tableroHTML(estado, HOY, { editando: true });
  assert.match(html, /data-campo="queHacer"[^>]*data-vacio="¿Qué hay que hacer\?"/);
  assert.match(html, /data-toma="t1"/);
});

test('un proyecto recién agregado se dibuja con el nombre vacío', () => {
  const estado = normalizarEstado({ proyectos: [{ id: 'p1', nombre: '' }] });
  const html = tableroHTML(estado, HOY, { editando: true });
  assert.match(html, /data-campo="nombre"/);
  assert.match(html, /data-campo="etiqueta"/);
  assert.match(html, /data-proyecto="p1"/);
});

test('el nombre del proyecto también se corrige con un clic', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'roto', diaActual: HOY }]
  });
  assert.match(tableroHTML(estado, HOY), /data-campo="nombre"/);
});

test('si el día abierto no es hoy, el título lo dice en vez de mentir', () => {
  const html = tableroHTML(VACIO, '2026-10-21', { hoy: HOY });
  assert.doesNotMatch(html, /class="title">Hoy</);
  assert.match(html, /miércoles 21 de octubre/);
  assert.match(html, /data-accion="hoy"/);
});

test('en el día de hoy el título dice Hoy y no ofrece volver', () => {
  const html = tableroHTML(VACIO, HOY, { hoy: HOY });
  assert.match(html, /class="title">Hoy</);
  assert.doesNotMatch(html, /data-accion="hoy"/);
});

test('el día abierto se marca fuerte en el scrubber', () => {
  const html = scrubberHTML(VACIO, '2026-10-21', { hoy: HOY });
  assert.match(html, /class="day[^"]*abierto[^"]*"[^>]*data-dia="2026-10-21"/);
  assert.match(html, /class="day[^"]*hoy[^"]*"[^>]*data-dia="2026-10-18"/);
});

test('cada trabajo terminado deja un mini AM en su chip', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [
      { id: 't1', proyecto: 'p1', queHacer: 'a', diaActual: HOY, hecha: true },
      { id: 't2', proyecto: 'p1', queHacer: 'b', diaActual: HOY, hecha: true },
      { id: 't3', proyecto: 'p1', queHacer: 'c', diaActual: HOY, hecha: true },
      { id: 't4', proyecto: 'p1', queHacer: 'd', diaActual: HOY, hecha: true }
    ]
  });
  const html = tableroHTML(estado, HOY);
  assert.equal(cuantos(html, /class="mini"/g), 4);
  // las tres caras se van turnando, para que no sean cuatro clones
  for (const cara of ['0', '1', '2']) {
    assert.match(html, new RegExp(`data-cara="${cara}"`), `falta la cara ${cara}`);
  }
});

test('un trabajo sin terminar no tiene mini', () => {
  assert.doesNotMatch(tarjetaHTML(unaToma()), /class="mini"/);
});

test('AM está en el tablero y dice cómo viene el día', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [
      { id: 't1', proyecto: 'p1', queHacer: 'a', diaActual: HOY, hecha: true },
      { id: 't2', proyecto: 'p1', queHacer: 'b', diaActual: HOY }
    ]
  });
  const html = tableroHTML(estado, HOY);
  assert.match(html, /class="am"/);
  assert.match(html, /data-avance="50"/);
});

test('sin nada anotado AM no muestra avance inventado', () => {
  assert.match(tableroHTML(VACIO, HOY), /data-avance="0"/);
});

// ---------- elegir y cargar el gráfico chico ----------
// Los tres gráficos estaban dibujados pero no había forma de ponerlos desde la
// pantalla. Se eligen con un clic y los números se escriben en la tarjeta.

test('la tarjeta ofrece los tres gráficos y la opción de ninguno', () => {
  const html = tarjetaHTML(unaToma(), { editando: true });
  for (const tipo of ['capas', 'curva', 'cadencia']) {
    assert.match(html, new RegExp(`data-accion="grafico"[^>]*data-grafico="${tipo}"`), tipo);
  }
  assert.match(html, /data-accion="grafico"[^>]*data-grafico=""/);
});

test('esos controles están ocultos como el resto', () => {
  const html = tarjetaHTML(unaToma(), { editando: true });
  assert.equal(cuantos(html, /class="oculto[^"]*"[^>]*data-accion="grafico"/g), 4);
});

test('en reposo no están: la tarjeta de la captura queda igual que siempre', () => {
  // Si estuvieran escondidos pero puestos, en el celular la fila se parte en
  // dos y la tarjeta crece un renglón aunque no se vea nada.
  const html = tarjetaHTML(unaToma());
  assert.doesNotMatch(html, /data-accion="grafico"/);
  assert.doesNotMatch(tableroHTML(conProyectos(1), HOY), /data-accion="grafico"|data-valor=/);
});

test('van en la misma fila que borrar', () => {
  const html = tarjetaHTML(unaToma(), { editando: true });
  const fila = html.match(/<div class="tools">([\s\S]*?)<\/div>/);
  assert.ok(fila, 'no encontré la fila de controles');
  assert.equal(cuantos(fila[1], /data-accion="grafico"/g), 4);
  assert.match(fila[1], /data-accion="borrar-toma"/);
});

test('el gráfico que ya tiene se nota en su botón', () => {
  const html = tarjetaHTML(unaToma({ grafico: 'curva', graficoValores: { ev: '+0.5' } }),
    { editando: true });
  assert.match(html, /class="oculto elegido"[^>]*data-grafico="curva"/);
  assert.equal(cuantos(html, /elegido/g), 1);
});

test('sin gráfico, el elegido es "ninguno"', () => {
  assert.match(tarjetaHTML(unaToma(), { editando: true }), /class="oculto elegido"[^>]*data-grafico=""/);
});

test('en modo editar los números de las capas se escriben en la tarjeta', () => {
  const html = tarjetaHTML(unaToma({ grafico: 'capas', graficoValores: { hechas: 2, total: 3 } }),
    { editando: true });
  for (const valor of ['hechas', 'total']) {
    assert.match(html, new RegExp(`contenteditable="plaintext-only"[^>]*data-valor="${valor}"`), valor);
  }
  assert.match(html, /data-valor="hechas"[^>]*>2</);
  assert.match(html, /data-valor="total"[^>]*>3</);
});

test('en modo editar la curva deja escribir lo que dice al pie', () => {
  const html = tarjetaHTML(unaToma({ grafico: 'curva', graficoValores: { ev: '+0.5 EV' } }),
    { editando: true });
  assert.match(html, /contenteditable="plaintext-only"[^>]*data-valor="ev"[^>]*>\+0\.5 EV</);
});

test('en modo editar la cadencia deja escribir los cuadros y las imágenes por segundo', () => {
  const html = tarjetaHTML(unaToma({ grafico: 'cadencia', graficoValores: { cada: 3, imgs: 8 } }),
    { editando: true });
  assert.match(html, /contenteditable="plaintext-only"[^>]*data-valor="cada"[^>]*>3</);
  assert.match(html, /contenteditable="plaintext-only"[^>]*data-valor="imgs"[^>]*>8</);
  assert.match(html, /1 de cada/);
  assert.match(html, /img\/s/);
});

test('los números del gráfico se corrigen escribiéndolos encima', () => {
  const html = tarjetaHTML(unaToma({ grafico: 'capas', graficoValores: { hechas: 2, total: 3 } }));
  assert.match(html, /2/);
  assert.match(html, /3/);
});

test('un valor del gráfico con HTML adentro sale escapado', () => {
  const html = tarjetaHTML(unaToma({ grafico: 'curva', graficoValores: { ev: '<script>alert(1)</script>' } }),
    { editando: true });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('el campo vacío de la curva avisa qué va adentro', () => {
  const html = tarjetaHTML(unaToma({ grafico: 'curva', graficoValores: { ev: '' } }), { editando: true });
  assert.match(html, /data-valor="ev"[^>]*data-vacio="|data-vacio="[^"]*"[^>]*data-valor="ev"/);
});

test('el tablero deja elegir el gráfico de cada trabajo en modo editar', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'roto', diaActual: HOY }]
  });
  assert.match(tableroHTML(estado, HOY, { editando: true }), /data-accion="grafico"/);
});

test('lo que mandaste a un día futuro no figura como atrasado', () => {
  const futuro = unaToma({ diaOrigen: HOY, diaActual: '2026-10-21' });
  assert.doesNotMatch(tarjetaHTML(futuro, { hoy: HOY }), /class="late"/);
});

test('cada trabajo trae su botón de mover de día, oculto como el de borrar', () => {
  assert.match(tarjetaHTML(unaToma()), /class="oculto"[^>]*data-accion="mover"/);
});

test('cuando hay un trabajo esperando destino, el scrubber lo dice', () => {
  const html = scrubberHTML(VACIO, HOY, { hoy: HOY, moviendo: true });
  assert.match(html, /class="scrub eligiendo"/);
  assert.match(html, /¿A qué día/);
});

test('cada trabajo trae sus flechas para subir y bajar, ocultas', () => {
  const html = tarjetaHTML(unaToma());
  assert.match(html, /class="oculto[^"]*"[^>]*data-accion="subir"/);
  assert.match(html, /class="oculto[^"]*"[^>]*data-accion="bajar"/);
});

test('el agarre solo aparece en modo editar', () => {
  assert.match(tarjetaHTML(unaToma(), { editando: true }), /class="agarre"/);
  assert.doesNotMatch(tarjetaHTML(unaToma()), /class="agarre"/);
});

test('un proyecto en pausa lo dice en el tablero', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Munich', pausado: true }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'a', diaActual: HOY }]
  });
  const html = tableroHTML(estado, HOY);
  assert.match(html, /EN PAUSA/);
  assert.match(html, /class="col [^"]*pausado/);
});

test('cada proyecto trae su botón de pausar, oculto', () => {
  const html = tableroHTML(conProyectos(1), HOY);
  assert.match(html, /class="oculto[^"]*"[^>]*data-accion="pausar"/);
});

test('el botón dice reanudar cuando ya está en pausa', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Munich', pausado: true }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'a', diaActual: HOY }]
  });
  assert.match(tableroHTML(estado, HOY), /data-accion="pausar">Reanudar</);
});

test('la tarjeta trae un agarre, y es lo único de donde se la puede agarrar', () => {
  const html = tarjetaHTML(unaToma(), { editando: true });
  assert.match(html, /class="agarre"/);
  assert.doesNotMatch(html, /<article[^>]*agarre/);
});

test('en reposo no hay agarre', () => {
  assert.doesNotMatch(tarjetaHTML(unaToma()), /class="agarre"/);
});

test('el tablero muestra qué versión está corriendo', () => {
  const html = tableroHTML(VACIO, HOY, { version: '2026-10-19T02-30-00' });
  assert.match(html, /class="version"/);
  assert.match(html, /19 oct 02:30/);
});

test('la versión se lee pero no se mete en el medio', () => {
  const html = tableroHTML(VACIO, HOY, { version: '2026-10-19T02-30-00' });
  // va al final, después del scrubber
  assert.ok(html.indexOf('class="version"') > html.indexOf('class="scrub'), 'la versión va al final');
});

test('el agarre no usa el arrastre de HTML: en Safari y en el celular no anda', () => {
  const html = tarjetaHTML(unaToma(), { editando: true });
  assert.match(html, /class="agarre"/);
  assert.doesNotMatch(html, /draggable="true"/);
});

test('AM anda con tres mini AM alrededor', () => {
  const html = tableroHTML(conProyectos(1), HOY);
  assert.equal(cuantos(html, /class="mini suelto"/g), 3);
});

test('el proyecto en pausa tiene su mini AM dormido con zetas', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Munich', pausado: true }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'a', diaActual: HOY }]
  });
  const html = tableroHTML(estado, HOY);
  assert.match(html, /class="dormido"/);
  assert.match(html, /class="mini" data-cara="0"/);
  assert.equal(cuantos(html, /class="z"/g), 3);
});

test('el que no está en pausa no duerme', () => {
  assert.doesNotMatch(tableroHTML(conProyectos(1), HOY), /class="dormido"/);
});
