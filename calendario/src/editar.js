// Cada edición devuelve el estado nuevo y los cambios para la cola. Son
// funciones puras: no tocan el DOM ni la red, así se pueden probar solas.
// Lo único que toca el DOM es `conectar`, al final.

const COLORES = ['acid', 'ok', 'violet', 'warn'];

const ahora = () => new Date().toISOString();
const nuevoId = () => (globalThis.crypto?.randomUUID
  ? globalThis.crypto.randomUUID()
  : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`);

const nada = (estado) => ({ estado, cambios: [] });

const cambioDe = (tabla, fila) => ({
  id: tabla === 'dias' ? fila.fecha : fila.id,
  tabla,
  fila
});

export function agregarProyecto(estado, { nombre, etiqueta = '', color } = {}) {
  const limpio = (nombre || '').trim();
  if (!limpio) return nada(estado);
  const proyecto = {
    id: nuevoId(),
    nombre: limpio,
    etiqueta: etiqueta.trim(),
    color: COLORES.includes(color) ? color : COLORES[estado.proyectos.length % COLORES.length],
    archivado: false,
    borrado: false,
    actualizado: ahora()
  };
  return {
    estado: { ...estado, proyectos: [...estado.proyectos, proyecto] },
    cambios: [cambioDe('proyectos', proyecto)]
  };
}

export function agregarToma(estado, { proyecto, codigo = '', queHacer, detalle = '', dia } = {}) {
  const limpio = (queHacer || '').trim();
  if (!limpio || !proyecto || !dia) return nada(estado);
  const hermanas = estado.tomas.filter((t) => t.proyecto === proyecto);
  const toma = {
    id: nuevoId(),
    proyecto,
    codigo: codigo.trim(),
    queHacer: limpio,
    detalle: detalle.trim(),
    diaOrigen: dia,
    diaActual: dia,
    hecha: false,
    diaHecha: null,
    enCurso: false,
    borrado: false,
    grafico: null,
    graficoValores: null,
    orden: hermanas.length ? Math.max(...hermanas.map((t) => t.orden)) + 1 : 0,
    actualizado: ahora()
  };
  return {
    estado: { ...estado, tomas: [...estado.tomas, toma] },
    cambios: [cambioDe('tomas', toma)]
  };
}

export function marcarHecha(estado, tomaId, dia) {
  const vieja = estado.tomas.find((t) => t.id === tomaId);
  if (!vieja) return nada(estado);
  const hecha = !vieja.hecha;
  const nueva = {
    ...vieja,
    hecha,
    diaHecha: hecha ? dia : null,
    enCurso: false,
    actualizado: ahora()
  };
  return {
    estado: { ...estado, tomas: estado.tomas.map((t) => (t.id === tomaId ? nueva : t)) },
    cambios: [cambioDe('tomas', nueva)]
  };
}

export function ponerEnCurso(estado, tomaId) {
  const sello = ahora();
  const cambios = [];
  const tomas = estado.tomas.map((t) => {
    const deberia = t.id === tomaId && !t.hecha;
    if (t.enCurso === deberia) return t;
    const nueva = { ...t, enCurso: deberia, actualizado: sello };
    cambios.push(cambioDe('tomas', nueva));
    return nueva;
  });
  return cambios.length ? { estado: { ...estado, tomas }, cambios } : nada(estado);
}

const TEXTOS_DE_TOMA = ['queHacer', 'codigo', 'detalle'];

// Corregir lo que ya está escrito. Sin esto, una toma con un error se arregla
// borrándola y escribiéndola de nuevo.
export function ponerTextoDeToma(estado, tomaId, campo, texto) {
  if (!TEXTOS_DE_TOMA.includes(campo)) return nada(estado);
  const vieja = estado.tomas.find((t) => t.id === tomaId);
  if (!vieja) return nada(estado);

  const limpio = (texto || '').trim();
  // queHacer es lo único que no puede quedar vacío: es el renglón de la tarjeta.
  if (campo === 'queHacer' && !limpio) return nada(estado);
  if (vieja[campo] === limpio) return nada(estado);

  const nueva = { ...vieja, [campo]: limpio, actualizado: ahora() };
  return {
    estado: { ...estado, tomas: estado.tomas.map((t) => (t.id === tomaId ? nueva : t)) },
    cambios: [cambioDe('tomas', nueva)]
  };
}

export function ponerObjetivo(estado, fecha, texto) {
  const viejo = estado.dias.find((d) => d.fecha === fecha);
  const dia = {
    fecha,
    objetivo: (texto || '').trim(),
    renderDice: viejo ? viejo.renderDice : '',
    borrado: false,
    actualizado: ahora()
  };
  return {
    estado: {
      ...estado,
      dias: viejo
        ? estado.dias.map((d) => (d.fecha === fecha ? dia : d))
        : [...estado.dias, dia]
    },
    cambios: [cambioDe('dias', dia)]
  };
}

// Borrar deja una lápida en vez de sacar la fila: si la fila desapareciera, el
// otro aparato la volvería a subir en la próxima fusión, y al día siguiente el
// arrastre la revivía. La lápida viaja como un cambio más y gana por fecha.
export function borrar(estado, tabla, id) {
  const sello = ahora();
  const enterrar = (fila) => ({ ...fila, borrado: true, enCurso: false, actualizado: sello });

  if (tabla === 'proyectos') {
    const proyecto = estado.proyectos.find((p) => p.id === id && !p.borrado);
    if (!proyecto) return nada(estado);
    const suyas = estado.tomas.filter((t) => t.proyecto === id && !t.borrado);
    const lapidas = suyas.map(enterrar);
    const lapidaDelProyecto = enterrar(proyecto);
    return {
      estado: {
        ...estado,
        proyectos: estado.proyectos.map((p) => (p.id === id ? lapidaDelProyecto : p)),
        tomas: estado.tomas.map((t) => lapidas.find((l) => l.id === t.id) || t)
      },
      cambios: [
        ...lapidas.map((t) => cambioDe('tomas', t)),
        cambioDe('proyectos', lapidaDelProyecto)
      ]
    };
  }

  if (tabla === 'tomas') {
    const toma = estado.tomas.find((t) => t.id === id && !t.borrado);
    if (!toma) return nada(estado);
    const lapida = enterrar(toma);
    return {
      estado: { ...estado, tomas: estado.tomas.map((t) => (t.id === id ? lapida : t)) },
      cambios: [cambioDe('tomas', lapida)]
    };
  }

  return nada(estado);
}

// Un solo oyente en la raíz: las tarjetas se redibujan enteras y no hay que
// volver a atar nada.
export function conectar(raiz, acciones) {
  raiz.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-accion]');
    if (boton) {
      const tarjeta = boton.closest('[data-toma]');
      const columna = boton.closest('[data-proyecto]');
      acciones[boton.dataset.accion]?.({
        toma: tarjeta?.dataset.toma,
        proyecto: columna?.dataset.proyecto
      });
      return;
    }
    const dia = evento.target.closest('[data-dia]');
    if (dia) {
      acciones.dia?.({ dia: dia.dataset.dia });
      return;
    }
    if (campoDe(evento.target)) return;
    const tarjeta = evento.target.closest('[data-toma]');
    if (tarjeta) acciones.enCurso?.({ toma: tarjeta.dataset.toma });
  });

  // Los textos se guardan mientras se escriben, con un respiro de medio segundo.
  // Atados solo al blur se perdían cuando el teclado del celular se cierra sin
  // sacarle el foco al campo.
  const relojes = new Map();

  const campoDe = (nodo) => nodo.closest?.('[data-accion="objetivo"], [data-campo]');

  function avisar(campo) {
    if (campo.dataset.accion === 'objetivo') {
      acciones.objetivo?.({ texto: campo.textContent });
    } else {
      acciones.textoToma?.({
        toma: campo.closest('[data-toma]')?.dataset.toma,
        campo: campo.dataset.campo,
        texto: campo.textContent
      });
    }
  }

  raiz.addEventListener('input', (evento) => {
    const campo = campoDe(evento.target);
    if (!campo) return;
    clearTimeout(relojes.get(campo));
    relojes.set(campo, setTimeout(() => avisar(campo), 500));
  });

  raiz.addEventListener('focusout', (evento) => {
    const campo = campoDe(evento.target);
    if (!campo) return;
    clearTimeout(relojes.get(campo));
    avisar(campo);
  });
}
