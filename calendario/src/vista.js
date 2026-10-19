// Los datos entran, sale HTML. No se toca el DOM acá: así la vista se puede
// probar sin navegador y el DOM queda solo en editar.js y app.js.

import { fechaLarga, nombreCorto, ventanaScrubber, diasDeAtraso } from './dia.js';
import { agruparPorProyecto, contadores } from './modelo.js';
import { diasConTrabajo } from './arrastre.js';
import { loQueDiceRender } from './render-dice.js';

const DIAS_SCRUBBER = 12;
const DEMASIADOS = 6;

export function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function graficoHTML(toma) {
  const v = toma.graficoValores || {};
  if (toma.grafico === 'capas') {
    const total = Number(v.total) || 0;
    const hechas = Number(v.hechas) || 0;
    const barras = Array.from({ length: total },
      (_, i) => `<i class="${i < hechas ? 'f' : ''}"></i>`).join('');
    return `<div class="layers">${barras}</div>
      <div class="meta"><span>Capas</span><b>${hechas} / ${total}</b></div>`;
  }
  if (toma.grafico === 'curva') {
    return `<div class="curve"><svg viewBox="0 0 300 58" preserveAspectRatio="none" aria-hidden="true">
      <path class="antes" d="M0 56 C 70 54, 110 34, 150 31 S 240 20, 300 16"/>
      <path class="ahora" d="M0 52 C 70 50, 110 22, 150 20 S 240 8, 300 5"/>
    </svg></div>
      <div class="meta"><span>Pase anterior punteado</span><b>${escapar(v.ev ?? '')}</b></div>`;
  }
  if (toma.grafico === 'cadencia') {
    const cada = Number(v.cada) || 3;
    const cuadros = Array.from({ length: 10 },
      (_, i) => `<i class="${i % cada === 0 ? 'k' : ''}"></i>`).join('');
    return `<div class="strip">${cuadros}</div>
      <div class="meta"><span>1 de cada ${cada} cuadros</span><b>${escapar(v.imgs ?? '')} img/s</b></div>`;
  }
  return '';
}

export function tarjetaHTML(toma) {
  const atraso = diasDeAtraso(toma.diaOrigen, toma.diaActual);
  const arrastrada = atraso > 0
    ? `<span class="late">${atraso} ${atraso === 1 ? 'día' : 'días'}</span>`
    : '';
  const codigo = toma.codigo ? `<u>${escapar(toma.codigo)}</u>` : '';
  const detalle = toma.detalle ? `<p>${escapar(toma.detalle)}</p>` : '';
  return `<article class="card${toma.enCurso ? ' live' : ''}" data-toma="${escapar(toma.id)}">
    <h3>${codigo}<span class="que">${escapar(toma.queHacer)}</span>${arrastrada}
      <button class="mark" data-accion="hecha" aria-label="Marcar como hecha"></button></h3>
    ${detalle}
    ${graficoHTML(toma)}
    <button class="oculto borrar" data-accion="borrar-toma" aria-label="Borrar la toma">Borrar</button>
  </article>`;
}

function chipHTML(toma) {
  const codigo = toma.codigo ? `${escapar(toma.codigo)} · ` : '';
  return `<span class="chip" data-toma="${escapar(toma.id)}">
    <button class="marca" data-accion="hecha" aria-label="Volver a pendiente">✓</button>
    <s>${codigo}${escapar(toma.queHacer)}</s>
    <button class="oculto borrar chico" data-accion="borrar-toma" aria-label="Borrar la toma">×</button></span>`;
}

function columnaHTML(grupo) {
  const etiqueta = grupo.proyecto.etiqueta
    ? `<span>${escapar(grupo.proyecto.etiqueta)}</span>` : '';
  const chips = grupo.hechas.length
    ? `<div class="chips">${grupo.hechas.map(chipHTML).join('')}</div>` : '';
  return `<div class="col ${escapar(grupo.proyecto.color)}" data-proyecto="${escapar(grupo.proyecto.id)}">
    <span class="node"></span>
    <div class="elbow"></div>
    <div class="pname"><h2>${escapar(grupo.proyecto.nombre)}</h2>${etiqueta}
      <button class="oculto borrar" data-accion="borrar-proyecto" aria-label="Borrar el proyecto">Borrar</button></div>
    ${chips}
    ${grupo.pendientes.map(tarjetaHTML).join('')}
    <button class="oculto suma" data-accion="nueva-toma">Agregar una toma</button>
  </div>`;
}

export function scrubberHTML(estado, fecha) {
  const dias = ventanaScrubber(fecha, DIAS_SCRUBBER);
  const conTrabajo = diasConTrabajo(estado, dias);
  const celdas = dias.map((d) => {
    const { dia, numero } = nombreCorto(d);
    const clases = ['day', d === fecha ? 'now' : '', conTrabajo.has(d) ? 'has' : '']
      .filter(Boolean).join(' ');
    return `<button class="${clases}" data-dia="${d}">
      <span class="bump"></span><u>${dia}</u>${numero}</button>`;
  }).join('');
  return `<nav class="scrub">${celdas}</nav>`;
}

export function tableroHTML(estado, fecha, { editando = false } = {}) {
  // Un proyecto sin tomas no ensucia la captura de un día ya cargado, pero si
  // el día está vacío tiene que verse: si no, cargás un proyecto, el tablero
  // sigue diciendo "no hay nada anotado" y lo cargás otra vez.
  const hayTomas = estado.tomas.some((t) => !t.borrado && t.diaActual === fecha);
  const grupos = agruparPorProyecto(estado, fecha, { incluirVacios: editando || !hayTomas });
  const n = contadores(estado, fecha);
  const delDia = estado.dias.find((d) => d.fecha === fecha);

  // El texto de ayuda va en un atributo y lo dibuja el CSS: adentro del campo
  // editable, `textContent` se lo llevaría puesto al guardar.
  const objetivo = delDia && delDia.objetivo ? escapar(delDia.objetivo) : '';

  const aviso = grupos.length >= DEMASIADOS
    ? `<p class="aviso">Son seis proyectos en un día. Entran, pero la captura se achica.</p>`
    : '';

  const riel = grupos.length
    ? `<div class="rail"><div class="cols">${grupos.map(columnaHTML).join('')}</div>
        <button class="oculto suma nuevo" data-accion="nuevo-proyecto">Agregar un proyecto</button></div>`
    : `<div class="rail vacio"><p>Todavía no hay nada anotado para hoy.</p>
        <button class="agregar" data-accion="nuevo-proyecto">Agregar un proyecto</button></div>`;

  return `<header class="top">
    <h1 class="title">Hoy<em>${escapar(fechaLarga(fecha))}</em></h1>
    <button class="lapiz" data-accion="editar" aria-label="Mostrar los controles de editar">Editar</button>
  </header>

  <section class="panel">
    <div class="bot">
      <img src="./assets/render.png" alt="RENDER" width="112" height="224">
      <div class="says"><b>RENDER</b><p>${escapar(loQueDiceRender(estado, fecha))}</p></div>
    </div>
    <div class="goal">
      <div class="lbl">Objetivo del día</div>
      <p contenteditable="plaintext-only" data-accion="objetivo"
         data-vacio="Escribí el objetivo del día">${objetivo}</p>
    </div>
    <div class="stats">
      <div class="stat"><span class="lbl">Proyectos</span><i>${n.proyectos}</i></div>
      <div class="stat"><span class="lbl">Tomas</span><i>${n.tomas}</i></div>
      <div class="stat"><span class="lbl">Listas</span><i>${n.listas}<s>/${n.tomas}</s></i></div>
    </div>
  </section>

  ${aviso}
  ${riel}
  ${scrubberHTML(estado, fecha)}`;
}
