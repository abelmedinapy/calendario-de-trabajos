// El arranque. Dibuja con lo que hay guardado y sale a la red atrás: nunca una
// pantalla en blanco esperando internet.

import { LLAVE_GUARDADA } from './config.js';
import { hoy } from './dia.js';
import { crearAlmacen } from './almacen-local.js';
import { crearNube } from './nube.js';
import { sincronizar } from './sync.js';
import { arrastrar } from './arrastre.js';
import { tableroHTML } from './vista.js';
import {
  conectar, agregarProyecto, agregarToma, marcarHecha, ponerEnCurso, ponerObjetivo, borrar
} from './editar.js';

export function decidirArranque({ hayLlave, hayLocal, hayRed }) {
  if (hayLlave) return 'tablero';
  if (hayRed) return 'entrar';
  return hayLocal ? 'entrar' : 'sin-nada';
}

// Lo de abajo solo corre en el navegador; los tests importan únicamente la
// función de arriba.
if (typeof document !== 'undefined') arrancar();

function arrancar() {
  const raiz = document.getElementById('tablero');

  let storage = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }

  const almacen = crearAlmacen(storage);
  let llave = '';
  try {
    llave = storage?.getItem(LLAVE_GUARDADA) || '';
  } catch {
    llave = '';
  }

  let estado = almacen.leerEstado();
  let dia = hoy();
  let editando = false;
  let sinSubir = 0;
  let rechazados = [];

  const guardar = (nuevo, cambios) => {
    estado = nuevo;
    almacen.guardarEstado(estado);
    for (const cambio of cambios) almacen.encolar(cambio);
    dibujar();
    subir();
  };

  const nube = () => crearNube({ llave });

  async function subir() {
    if (!llave) return;
    const resultado = await sincronizar({ almacen, nube: nube() });
    sinSubir = resultado.subio ? 0 : almacen.cola().length;
    if (resultado.rechazados.length) rechazados = resultado.rechazados;
    if (resultado.subio) estado = resultado.estado;
    dibujar();
  }

  function avisos() {
    const lineas = [];
    if (!almacen.puedeGuardar()) {
      lineas.push('Este navegador no guarda nada en el aparato. Lo que anotes se sube a la nube, pero si cerrás la pestaña antes de que suba, se pierde.');
    }
    if (sinSubir > 0) {
      lineas.push(sinSubir === 1
        ? 'Hay 1 cambio sin subir. Lo intento de nuevo solo.'
        : `Hay ${sinSubir} cambios sin subir. Lo intento de nuevo solo.`);
    }
    if (rechazados.length) {
      lineas.push(rechazados.length === 1
        ? 'Un cambio no se pudo guardar en la nube y lo descarté.'
        : `${rechazados.length} cambios no se pudieron guardar en la nube y los descarté.`);
    }
    return lineas.map((l) => `<p class="aviso">${l}</p>`).join('');
  }

  // Redibujar mientras Abel escribe el objetivo le destruye el campo debajo del
  // cursor y se lleva puesto lo que estaba tecleando. Se espera a que salga.
  const escribiendoElObjetivo = () =>
    Boolean(document.activeElement?.closest?.('[data-accion="objetivo"]'));

  let quedoPorDibujar = false;

  function dibujar() {
    if (escribiendoElObjetivo()) {
      quedoPorDibujar = true;
      return;
    }
    quedoPorDibujar = false;
    raiz.innerHTML = avisos() + tableroHTML(estado, dia, { editando });
    raiz.classList.toggle('editando', editando);
  }

  raiz.addEventListener('focusout', (evento) => {
    if (evento.target.closest?.('[data-accion="objetivo"]') && quedoPorDibujar) {
      setTimeout(dibujar, 0);
    }
  });

  function pantallaDeEntrada(modo) {
    raiz.innerHTML = modo === 'sin-nada'
      ? `<section class="entrar">
           <h1>Calendario</h1>
           <p>En este aparato no hay nada guardado todavía, y tampoco hay internet.
              Hace falta conexión para entrar la primera vez.</p>
         </section>`
      : `<section class="entrar">
           <h1>Calendario</h1>
           <p>Escribí la llave. Se pide una sola vez por aparato.</p>
           <form id="puerta">
             <input type="password" name="llave" autocomplete="current-password"
                    aria-label="La llave" required>
             <button type="submit">Entrar</button>
             <p class="error" hidden>Esa llave no sirve.</p>
           </form>
         </section>`;

    const form = document.getElementById('puerta');
    form?.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const escrita = new FormData(form).get('llave');
      const error = form.querySelector('.error');
      try {
        await crearNube({ llave: escrita }).bajarEstado();
      } catch {
        error.hidden = false;
        return;
      }
      llave = escrita;
      try {
        storage?.setItem(LLAVE_GUARDADA, llave);
      } catch { /* sin guardado local la llave dura lo que dure la pestaña */ }
      await empezar();
    });
  }

  async function empezar() {
    estado = almacen.leerEstado();
    dia = hoy();
    dibujar();
    await subir();
    const { estado: corrido, movidas } = arrastrar(estado, dia);
    if (movidas.length) {
      guardar(corrido, corrido.tomas
        .filter((t) => movidas.includes(t.id))
        .map((t) => ({ id: t.id, tabla: 'tomas', fila: t, borrado: false })));
    }
  }

  conectar(raiz, {
    editar: () => { editando = !editando; dibujar(); },

    hecha: ({ toma }) => {
      const { estado: nuevo, cambios } = marcarHecha(estado, toma, dia);
      guardar(nuevo, cambios);
    },

    enCurso: ({ toma }) => {
      if (!editando) return;
      const { estado: nuevo, cambios } = ponerEnCurso(estado, toma);
      guardar(nuevo, cambios);
    },

    'nuevo-proyecto': () => {
      const nombre = prompt('¿Cómo se llama el proyecto?');
      if (nombre === null) return;
      const etiqueta = prompt('¿Qué es? (VFX, Spot, Propio…)') ?? '';
      const { estado: nuevo, cambios } = agregarProyecto(estado, { nombre, etiqueta });
      guardar(nuevo, cambios);
    },

    'nueva-toma': ({ proyecto }) => {
      const queHacer = prompt('¿Qué hay que hacer?');
      if (queHacer === null) return;
      const codigo = prompt('Código de la toma (T22, grade, out…)') ?? '';
      const detalle = prompt('Un detalle, si hace falta') ?? '';
      const { estado: nuevo, cambios } = agregarToma(estado, { proyecto, queHacer, codigo, detalle, dia });
      guardar(nuevo, cambios);
    },

    'borrar-toma': ({ toma }) => {
      if (!confirm('¿Borro esta toma?')) return;
      const { estado: nuevo, cambios } = borrar(estado, 'tomas', toma);
      guardar(nuevo, cambios);
    },

    'borrar-proyecto': ({ proyecto }) => {
      if (!confirm('¿Borro el proyecto y todas sus tomas?')) return;
      const { estado: nuevo, cambios } = borrar(estado, 'proyectos', proyecto);
      guardar(nuevo, cambios);
    },

    objetivo: ({ texto }) => {
      const { estado: nuevo, cambios } = ponerObjetivo(estado, dia, texto);
      // Sin redibujar: el campo ya muestra lo que Abel escribió, y volver a
      // pintarlo mientras escribe le saca el cursor de lugar.
      estado = nuevo;
      almacen.guardarEstado(estado);
      for (const cambio of cambios) almacen.encolar(cambio);
      subir();
    },

    dia: ({ dia: elegido }) => {
      dia = elegido;
      dibujar();
    }
  });

  const modo = decidirArranque({
    hayLlave: Boolean(llave),
    hayLocal: estado.tomas.length > 0 || estado.proyectos.length > 0,
    hayRed: navigator.onLine
  });

  if (modo === 'tablero') empezar();
  else pantallaDeEntrada(modo);

  window.addEventListener('online', subir);

  // Una PWA instalada en el celu casi nunca se cierra: al volver a mirarla hay
  // que traer lo que se anotó en la Mac, y si cruzó las 5 de la mañana, empezar
  // el día nuevo con lo pendiente arrastrado.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const ahora = hoy();
    if (ahora !== dia) {
      dia = ahora;
      empezar();
    } else {
      subir();
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { type: 'module' }).catch(() => {
      // sin service worker la app anda igual, solo que necesita internet
    });
  }
}
