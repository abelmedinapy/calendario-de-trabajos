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
const TEXTOS_DE_PROYECTO = ['nombre', 'etiqueta'];

// Agregar es un clic y escribir en la tarjeta misma. El borrador nace vacío y
// no viaja a la nube: lo que lo sube es el primer texto. Si queda vacío se va
// sin dejar lápida, porque nunca llegó a existir afuera.
export function agregarBorradorDeToma(estado, { proyecto, dia } = {}) {
  if (!proyecto || !dia) return nada(estado);
  const hermanas = estado.tomas.filter((t) => t.proyecto === proyecto && !t.borrado);
  const toma = {
    id: nuevoId(),
    proyecto,
    codigo: '',
    queHacer: '',
    detalle: '',
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
  return { estado: { ...estado, tomas: [...estado.tomas, toma] }, cambios: [] };
}

export function agregarBorradorDeProyecto(estado) {
  const proyecto = {
    id: nuevoId(),
    nombre: '',
    etiqueta: '',
    color: COLORES[estado.proyectos.filter((p) => !p.borrado).length % COLORES.length],
    archivado: false,
    borrado: false,
    actualizado: ahora()
  };
  return { estado: { ...estado, proyectos: [...estado.proyectos, proyecto] }, cambios: [] };
}

export function quitarBorradorVacio(estado, id, tabla = 'tomas') {
  if (tabla === 'proyectos') {
    const p = estado.proyectos.find((x) => x.id === id);
    if (!p || p.nombre) return nada(estado);
    return { estado: { ...estado, proyectos: estado.proyectos.filter((x) => x.id !== id) }, cambios: [] };
  }
  const t = estado.tomas.find((x) => x.id === id);
  if (!t || t.queHacer) return nada(estado);
  return { estado: { ...estado, tomas: estado.tomas.filter((x) => x.id !== id) }, cambios: [] };
}

export function ponerTextoDeProyecto(estado, proyectoId, campo, texto) {
  if (!TEXTOS_DE_PROYECTO.includes(campo)) return nada(estado);
  const viejo = estado.proyectos.find((p) => p.id === proyectoId);
  if (!viejo) return nada(estado);

  const limpio = (texto || '').trim();
  if (campo === 'nombre' && !limpio) return nada(estado);
  if (viejo[campo] === limpio) return nada(estado);

  const nuevo = { ...viejo, [campo]: limpio, actualizado: ahora() };
  return {
    estado: { ...estado, proyectos: estado.proyectos.map((p) => (p.id === proyectoId ? nuevo : p)) },
    cambios: [cambioDe('proyectos', nuevo)]
  };
}

// Corregir lo que ya está escrito. Sin esto, una toma con un error se arregla
// borrándola y escribiéndola de nuevo.
export function ponerTextoDeToma(estado, tomaId, campo, texto) {
  if (!TEXTOS_DE_TOMA.includes(campo)) return nada(estado);
  const vieja = estado.tomas.find((t) => t.id === tomaId);
  if (!vieja) return nada(estado);

  // El detalle puede ser una lista de varios renglones, así que solo se le
  // sacan los extremos: lo de adentro queda tal cual se escribió.
  const limpio = (texto || '').replace(/^\s*\n|\s+$/g, '').trim() === ''
    ? ''
    : (texto || '').replace(/^\s+|\s+$/g, '');
  // queHacer es lo único que no puede quedar vacío: es el renglón de la tarjeta.
  if (campo === 'queHacer' && !limpio) return nada(estado);
  if (vieja[campo] === limpio) return nada(estado);

  const nueva = { ...vieja, [campo]: limpio, actualizado: ahora() };
  return {
    estado: { ...estado, tomas: estado.tomas.map((t) => (t.id === tomaId ? nueva : t)) },
    cambios: [cambioDe('tomas', nueva)]
  };
}

// ---------- el gráfico chico de la tarjeta ----------
// Los tres dibujos ya existían en la vista pero no había forma de ponerlos.
// El tipo se elige con un clic y los valores se escriben en la tarjeta misma,
// como el resto de los textos.

// Nace con valores para que se vea apenas lo elegís: un gráfico en cero no
// dibuja nada y parece que el clic no hizo nada.
const GRAFICOS = {
  capas: { hechas: 0, total: 3 },
  curva: { ev: '' },
  cadencia: { cada: 3, imgs: 8 }
};

// Cuánto aguanta cada número sin romper el dibujo: cuarenta barritas ya no se
// distinguen, y una cadencia en cero no marcaría ni un cuadro.
const LIMITES = {
  hechas: [0, 99], total: [0, 40], cada: [1, 10], imgs: [0, 999]
};

const entre = (n, [minimo, maximo]) => Math.min(Math.max(n, minimo), maximo);

const comoNumero = (texto, limites) => {
  const n = Math.trunc(Number(String(texto ?? '').trim()));
  return entre(Number.isFinite(n) ? n : 0, limites);
};

const conGrafico = (vieja, grafico, valores) => ({
  ...vieja, grafico, graficoValores: valores, actualizado: ahora()
});

export function ponerGrafico(estado, tomaId, grafico) {
  const vieja = estado.tomas.find((t) => t.id === tomaId);
  if (!vieja) return nada(estado);
  // '' es "sin gráfico"; cualquier otra cosa que no sea de la lista, se ignora.
  if (grafico && !GRAFICOS[grafico]) return nada(estado);
  const tipo = grafico || null;
  if (vieja.grafico === tipo) return nada(estado);

  const nueva = conGrafico(vieja, tipo, tipo ? { ...GRAFICOS[tipo] } : null);
  return {
    estado: { ...estado, tomas: estado.tomas.map((t) => (t.id === tomaId ? nueva : t)) },
    cambios: [cambioDe('tomas', nueva)]
  };
}

export function ponerValorDeGrafico(estado, tomaId, valor, texto) {
  const vieja = estado.tomas.find((t) => t.id === tomaId);
  if (!vieja || !vieja.grafico) return nada(estado);

  const suyos = GRAFICOS[vieja.grafico];
  if (!suyos || !(valor in suyos)) return nada(estado);

  const limpio = LIMITES[valor]
    ? comoNumero(texto, LIMITES[valor])
    : String(texto ?? '').trim();
  const valores = { ...suyos, ...vieja.graficoValores };
  if (valores[valor] === limpio) return nada(estado);

  const nueva = conGrafico(vieja, vieja.grafico, { ...valores, [valor]: limpio });
  return {
    estado: { ...estado, tomas: estado.tomas.map((t) => (t.id === tomaId ? nueva : t)) },
    cambios: [cambioDe('tomas', nueva)]
  };
}

// Mover a mano. El día en que nació no se toca: es lo que deja ver después
// cuánto viene arrastrándose algo.
export function moverTrabajo(estado, tomaId, dia) {
  const vieja = estado.tomas.find((t) => t.id === tomaId);
  if (!vieja || !dia || vieja.diaActual === dia) return nada(estado);
  const nueva = { ...vieja, diaActual: dia, actualizado: ahora() };
  return {
    estado: { ...estado, tomas: estado.tomas.map((t) => (t.id === tomaId ? nueva : t)) },
    cambios: [cambioDe('tomas', nueva)]
  };
}

// ---------- el orden de los trabajos ----------
// Se ordenan dentro de su proyecto y su día. El `orden` se reescribe entero
// cada vez: así nunca quedan dos con el mismo número ni huecos raros.

function hermanas(estado, toma) {
  return estado.tomas
    .filter((t) => !t.borrado && !t.hecha
      && t.proyecto === toma.proyecto && t.diaActual === toma.diaActual)
    .sort((x, y) => x.orden - y.orden || x.actualizado.localeCompare(y.actualizado));
}

function reordenar(estado, lista) {
  const sello = ahora();
  const cambios = [];
  const nuevas = new Map();
  lista.forEach((t, i) => {
    if (t.orden === i) return;
    const nueva = { ...t, orden: i, actualizado: sello };
    nuevas.set(t.id, nueva);
    cambios.push(cambioDe('tomas', nueva));
  });
  if (cambios.length === 0) return nada(estado);
  return {
    estado: { ...estado, tomas: estado.tomas.map((t) => nuevas.get(t.id) || t) },
    cambios
  };
}

function correr(estado, tomaId, paso) {
  const toma = estado.tomas.find((t) => t.id === tomaId);
  if (!toma) return nada(estado);
  const lista = hermanas(estado, toma);
  const i = lista.findIndex((t) => t.id === tomaId);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= lista.length) return nada(estado);
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return reordenar(estado, lista);
}

export const subirTrabajo = (estado, tomaId) => correr(estado, tomaId, -1);
export const bajarTrabajo = (estado, tomaId) => correr(estado, tomaId, 1);

// Arrastrar: el que movés queda justo arriba del que soltaste encima.
export function soltarAntesDe(estado, tomaId, destinoId) {
  if (tomaId === destinoId) return nada(estado);
  const toma = estado.tomas.find((t) => t.id === tomaId);
  const destino = estado.tomas.find((t) => t.id === destinoId);
  if (!toma || !destino) return nada(estado);
  if (toma.proyecto !== destino.proyecto || toma.diaActual !== destino.diaActual) return nada(estado);

  const lista = hermanas(estado, toma).filter((t) => t.id !== tomaId);
  const donde = lista.findIndex((t) => t.id === destinoId);
  if (donde < 0) return nada(estado);
  lista.splice(donde, 0, toma);
  return reordenar(estado, lista);
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
        proyecto: columna?.dataset.proyecto,
        grafico: boton.dataset.grafico
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

  const campoDe = (nodo) => nodo.closest?.('[data-accion="objetivo"], [data-campo], [data-valor]');

  function avisar(campo) {
    if (campo.dataset.accion === 'objetivo') {
      acciones.objetivo?.({ texto: campo.textContent });
      return;
    }
    if (campo.dataset.valor) {
      acciones.valorDeGrafico?.({
        toma: campo.closest('[data-toma]')?.dataset.toma,
        valor: campo.dataset.valor,
        texto: campo.textContent
      });
      return;
    }
    const tarjeta = campo.closest('[data-toma]');
    if (tarjeta) {
      acciones.textoToma?.({
        toma: tarjeta.dataset.toma, campo: campo.dataset.campo, texto: campo.textContent
      });
      return;
    }
    const columna = campo.closest('[data-proyecto]');
    if (columna) {
      acciones.textoProyecto?.({
        proyecto: columna.dataset.proyecto, campo: campo.dataset.campo, texto: campo.textContent
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

  // Arrastrar una tarjeta para cambiar el orden. En táctil no hay arrastre, y
  // por eso las flechas hacen lo mismo.
  let arrastrando = null;

  raiz.addEventListener('dragstart', (evento) => {
    const tarjeta = evento.target.closest?.('[data-toma][draggable="true"]');
    if (!tarjeta) return;
    arrastrando = tarjeta.dataset.toma;
    tarjeta.classList.add('arrastrando');
    evento.dataTransfer.effectAllowed = 'move';
    // Firefox no arranca el arrastre si no se le pone algo adentro.
    evento.dataTransfer.setData('text/plain', arrastrando);
  });

  raiz.addEventListener('dragover', (evento) => {
    if (!arrastrando) return;
    const tarjeta = evento.target.closest?.('[data-toma]');
    if (!tarjeta || tarjeta.dataset.toma === arrastrando) return;
    evento.preventDefault();
    for (const otra of raiz.querySelectorAll('.destino')) otra.classList.remove('destino');
    tarjeta.classList.add('destino');
  });

  raiz.addEventListener('drop', (evento) => {
    const tarjeta = evento.target.closest?.('[data-toma]');
    if (!arrastrando || !tarjeta) return;
    evento.preventDefault();
    acciones.soltar?.({ toma: arrastrando, destino: tarjeta.dataset.toma });
    arrastrando = null;
  });

  raiz.addEventListener('dragend', () => {
    arrastrando = null;
    for (const otra of raiz.querySelectorAll('.arrastrando, .destino')) {
      otra.classList.remove('arrastrando', 'destino');
    }
  });
}
