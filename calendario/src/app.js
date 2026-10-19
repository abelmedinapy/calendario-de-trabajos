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
  conectar, marcarHecha, ponerEnCurso, ponerObjetivo, moverTrabajo,
  subirTrabajo, bajarTrabajo, soltarAntesDe,
  ponerTextoDeToma, ponerTextoDeProyecto,
  agregarBorradorDeToma, agregarBorradorDeProyecto, quitarBorradorVacio,
  limpiarBorradores, pausarProyecto, borrar,
  ponerGrafico, ponerValorDeGrafico
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
  let moviendo = null;

  // Guarda local sin encolar nada: para los borradores, que todavía no tienen
  // por qué viajar pero sí tienen que sobrevivir a la próxima sincronización.
  const anotarBorrador = (nuevo) => {
    estado = nuevo;
    almacen.guardarEstado(estado);
  };

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

  // Redibujar mientras Abel escribe le destruye el campo debajo del cursor y se
  // lleva puesto lo que estaba tecleando. Se espera a que salga.
  const ESCRIBIENDO = '[data-accion="objetivo"], [data-campo], [data-valor]';
  const escribiendo = () => Boolean(document.activeElement?.closest?.(ESCRIBIENDO));

  // Guarda y sube sin redibujar: el campo ya muestra lo que se escribió, y
  // volver a pintarlo le saca el cursor de lugar.
  const guardarSinDibujar = (nuevo, cambios) => {
    if (!cambios.length) return;
    estado = nuevo;
    almacen.guardarEstado(estado);
    for (const cambio of cambios) almacen.encolar(cambio);
    subir();
  };

  let quedoPorDibujar = false;

  // Si el cursor está adentro de un campo, dibujar() se posterga para no
  // pisarlo — y entonces agregar algo parecía no hacer nada. Lo soltamos
  // primero, que además guarda lo que estaba escrito.
  function soltarElCampo() {
    const activo = document.activeElement;
    if (activo?.closest?.(ESCRIBIENDO)) activo.blur();
  }

  // Después de redibujar, el cursor va al campo recién creado.
  function enfocar(selector) {
    // El DOM ya está puesto cuando se llama, así que se enfoca de una. El
    // requestAnimationFrame no sirve: en una pestaña de fondo puede no llegar.
    const campo = raiz.querySelector(selector);
    if (!campo) return;
    campo.focus();
    const sel = window.getSelection?.();
    if (sel && campo.isContentEditable) sel.selectAllChildren(campo);
  }

  function dibujar() {
    if (escribiendo()) {
      quedoPorDibujar = true;
      return;
    }
    quedoPorDibujar = false;
    raiz.innerHTML = avisos() + tableroHTML(estado, dia, { editando, moviendo: Boolean(moviendo) });
    if (moviendo) raiz.querySelector(`[data-toma="${moviendo}"]`)?.classList.add('moviendo');
    raiz.classList.toggle('editando', editando);
  }

  raiz.addEventListener('focusout', (evento) => {
    if (evento.target.closest?.(ESCRIBIENDO) && quedoPorDibujar) {
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
    estado = limpiarBorradores(almacen.leerEstado());
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

    // Agregar es un clic: aparece la tarjeta vacía y el cursor ya está adentro.
    // Nada de ventanitas encadenadas.
    'nuevo-proyecto': () => {
      soltarElCampo();
      const { estado: nuevo } = agregarBorradorDeProyecto(estado);
      anotarBorrador(nuevo);
      editando = true;
      dibujar();
      enfocar('[data-campo="nombre"]:empty');
    },

    'nueva-toma': ({ proyecto }) => {
      soltarElCampo();
      const { estado: nuevo } = agregarBorradorDeToma(estado, { proyecto, dia });
      anotarBorrador(nuevo);
      editando = true;
      dibujar();
      enfocar('[data-campo="queHacer"]:empty');
    },

    // Mover: se toca "Mover de día" en el trabajo y después el día en la barra
    // de abajo. Sin arrastrar nada, que en el celular no se puede.
    mover: ({ toma }) => {
      soltarElCampo();
      moviendo = moviendo === toma ? null : toma;
      dibujar();
    },

    // El gráfico chico: elegirlo es un clic y nace con valores a la vista, así
    // que el cursor puede ir derecho al primer número a corregirlo.
    grafico: ({ toma, grafico }) => {
      soltarElCampo();
      const { estado: nuevo, cambios } = ponerGrafico(estado, toma, grafico);
      if (!cambios.length) return;
      editando = true;
      guardar(nuevo, cambios);
      enfocar(`[data-toma="${toma}"] [data-valor]`);
    },

    valorDeGrafico: ({ toma, valor, texto }) => {
      const { estado: nuevo, cambios } = ponerValorDeGrafico(estado, toma, valor, texto);
      guardarSinDibujar(nuevo, cambios);
      // El número cambia el dibujo de arriba, no solo el renglón que se está
      // escribiendo: queda un redibujo pendiente para cuando suelte el campo.
      if (cambios.length) quedoPorDibujar = true;
    },

    // Enter encadena: cierra lo que estabas escribiendo y abre el siguiente
    // trabajo del mismo proyecto, con el cursor adentro. Anotar el día es
    // escribir una lista, no ir y volver al botón.
    siguiente: ({ proyecto, texto }) => {
      // Soltar el campo antes: si no, dibujar() se posterga para no pisar el
      // cursor y la tarjeta nueva no llega a aparecer.
      soltarElCampo();
      // Enter sobre un trabajo vacío cierra la cadena: el borrador ya se fue
      // del estado al soltarlo, pero el dibujo quedó postergado por el cursor.
      if (!texto.trim()) {
        dibujar();
        return;
      }
      const { estado: nuevo } = agregarBorradorDeToma(estado, { proyecto, dia });
      anotarBorrador(nuevo);
      editando = true;
      dibujar();
      enfocar('[data-campo="queHacer"]:empty');
    },

    pausar: ({ proyecto }) => {
      soltarElCampo();
      const { estado: nuevo, cambios } = pausarProyecto(estado, proyecto);
      guardar(nuevo, cambios);
    },

    subir: ({ toma }) => {
      soltarElCampo();
      const { estado: nuevo, cambios } = subirTrabajo(estado, toma);
      guardar(nuevo, cambios);
    },

    bajar: ({ toma }) => {
      soltarElCampo();
      const { estado: nuevo, cambios } = bajarTrabajo(estado, toma);
      guardar(nuevo, cambios);
    },

    soltar: ({ toma, destino }) => {
      const { estado: nuevo, cambios } = soltarAntesDe(estado, toma, destino);
      guardar(nuevo, cambios);
    },

    'borrar-toma': ({ toma }) => {
      if (!confirm('¿Borro este trabajo?')) return;
      const { estado: nuevo, cambios } = borrar(estado, 'tomas', toma);
      guardar(nuevo, cambios);
    },

    'borrar-proyecto': ({ proyecto }) => {
      // El Borrar del proyecto se lleva todo lo que tiene adentro. Que lo diga
      // con nombre y número antes, no después.
      const p = estado.proyectos.find((x) => x.id === proyecto);
      const suyas = estado.tomas.filter((t) => t.proyecto === proyecto && !t.borrado);
      const cuantos = suyas.length === 1 ? 'su 1 trabajo' : `sus ${suyas.length} trabajos`;
      const pregunta = suyas.length
        ? `¿Borro el proyecto ${p?.nombre || ''} y ${cuantos}?`
        : `¿Borro el proyecto ${p?.nombre || ''}?`;
      if (!confirm(pregunta)) return;
      const { estado: nuevo, cambios } = borrar(estado, 'proyectos', proyecto);
      guardar(nuevo, cambios);
    },

    objetivo: ({ texto }) => {
      const { estado: nuevo, cambios } = ponerObjetivo(estado, dia, texto);
      guardarSinDibujar(nuevo, cambios);
    },

    textoToma: ({ toma, campo, texto }) => {
      // Un trabajo que quedó sin texto nunca llegó a la nube: se va y listo.
      if (campo === 'queHacer' && !texto.trim()) {
        const { estado: nuevo, cambios } = quitarBorradorVacio(estado, toma, 'tomas');
        if (cambios.length === 0 && nuevo !== estado) {
          anotarBorrador(nuevo);
          dibujar();
        }
        return;
      }
      const { estado: nuevo, cambios } = ponerTextoDeToma(estado, toma, campo, texto);
      guardarSinDibujar(nuevo, cambios);
    },

    textoProyecto: ({ proyecto, campo, texto }) => {
      if (campo === 'nombre' && !texto.trim()) {
        const { estado: nuevo, cambios } = quitarBorradorVacio(estado, proyecto, 'proyectos');
        if (cambios.length === 0 && nuevo !== estado) {
          anotarBorrador(nuevo);
          dibujar();
        }
        return;
      }
      const { estado: nuevo, cambios } = ponerTextoDeProyecto(estado, proyecto, campo, texto);
      guardarSinDibujar(nuevo, cambios);
    },

    dia: ({ dia: elegido }) => {
      soltarElCampo();
      if (moviendo) {
        const { estado: nuevo, cambios } = moverTrabajo(estado, moviendo, elegido);
        moviendo = null;
        guardar(nuevo, cambios);
        return;
      }
      dia = elegido;
      dibujar();
    },

    hoy: () => {
      soltarElCampo();
      dia = hoy();
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

    // Cuando se publica una versión nueva, el worker nuevo toma el control y
    // la app se recarga sola una vez. Si no, Abel tiene que acordarse de
    // cerrar y abrir cada vez, y termina usando una versión vieja sin saberlo.
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recargando) return;
      recargando = true;
      location.reload();
    });
  }
}
