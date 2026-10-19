import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizarEstado, agruparPorProyecto } from '../src/modelo.js';
import {
  agregarProyecto, agregarToma, marcarHecha, ponerEnCurso, ponerObjetivo, borrar,
  ponerTextoDeToma, ponerTextoDeProyecto,
  agregarBorradorDeToma, agregarBorradorDeProyecto, quitarBorradorVacio,
  ponerGrafico, ponerValorDeGrafico, moverTrabajo,
  subirTrabajo, bajarTrabajo, soltarAntesDe, queHaceElEnter, limpiarBorradores,
  codigoNuevo, pausarProyecto
} from '../src/editar.js';

const DIA = '2026-10-18';

const ordenados = (estado) => [...estado.tomas]
  .sort((x, y) => x.orden - y.orden)
  .map((t) => t.queHacer);

const conProyecto = () => normalizarEstado({
  proyectos: [{ id: 'p1', nombre: 'Fortaleza', etiqueta: 'VFX' }]
});

test('agregarToma la pone en el día pedido y la deja pendiente', () => {
  const { estado } = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA });
  const t = estado.tomas[0];
  assert.equal(t.diaOrigen, DIA);
  assert.equal(t.diaActual, DIA);
  assert.equal(t.hecha, false);
  assert.equal(t.queHacer, 'roto');
});

test('agregarToma devuelve el cambio listo para la cola', () => {
  const { estado, cambios } = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA });
  assert.equal(cambios.length, 1);
  assert.equal(cambios[0].tabla, 'tomas');
  assert.equal(cambios[0].fila.borrado, false);
  assert.equal(cambios[0].id, estado.tomas[0].id);
});

test('agregarToma pone la nueva al final de su proyecto', () => {
  const uno = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  const dos = agregarToma(uno, { proyecto: 'p1', queHacer: 'b', dia: DIA }).estado;
  assert.ok(dos.tomas[1].orden > dos.tomas[0].orden);
});

test('agregarToma sin texto no agrega nada', () => {
  const previo = conProyecto();
  const { estado, cambios } = agregarToma(previo, { proyecto: 'p1', queHacer: '   ', dia: DIA });
  assert.deepEqual(estado, previo);
  assert.deepEqual(cambios, []);
});

test('marcarHecha anota el día en que se terminó y la saca de en curso', () => {
  const previo = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const id = previo.tomas[0].id;
  const { estado } = marcarHecha(ponerEnCurso(previo, id).estado, id, DIA);
  assert.equal(estado.tomas[0].hecha, true);
  assert.equal(estado.tomas[0].diaHecha, DIA);
  assert.equal(estado.tomas[0].enCurso, false);
});

test('marcarHecha de nuevo la devuelve a pendiente y limpia diaHecha', () => {
  const previo = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const id = previo.tomas[0].id;
  const { estado } = marcarHecha(marcarHecha(previo, id, DIA).estado, id, DIA);
  assert.equal(estado.tomas[0].hecha, false);
  assert.equal(estado.tomas[0].diaHecha, null);
});

test('ponerEnCurso deja una sola encendida y encola las dos que cambiaron', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p1', queHacer: 'b', dia: DIA }).estado;
  const [a, b] = estado.tomas.map((t) => t.id);
  const primero = ponerEnCurso(estado, a).estado;
  const { estado: segundo, cambios } = ponerEnCurso(primero, b);
  assert.deepEqual(segundo.tomas.filter((t) => t.enCurso).map((t) => t.id), [b]);
  assert.deepEqual(cambios.map((c) => c.id).sort(), [a, b].sort());
});

test('borrar un proyecto lo saca del tablero junto con sus tomas', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p1', queHacer: 'b', dia: DIA }).estado;
  const { estado: despues, cambios } = borrar(estado, 'proyectos', 'p1');
  assert.deepEqual(agruparPorProyecto(despues, DIA), []);
  assert.equal(cambios.length, 3);
});

test('borrar una toma deja el proyecto en paz', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  const { estado: despues, cambios } = borrar(estado, 'tomas', estado.tomas[0].id);
  assert.equal(despues.proyectos[0].borrado, false);
  assert.deepEqual(agruparPorProyecto(despues, DIA, { incluirVacios: true })[0].pendientes, []);
  assert.equal(cambios.length, 1);
});

test('ponerObjetivo crea el día si no existía', () => {
  const { estado, cambios } = ponerObjetivo(conProyecto(), DIA, 'Cerrar Fortaleza.');
  assert.equal(estado.dias.length, 1);
  assert.equal(estado.dias[0].objetivo, 'Cerrar Fortaleza.');
  assert.equal(cambios[0].tabla, 'dias');
  assert.equal(cambios[0].id, DIA);
});

test('ponerObjetivo sobre un día que ya existe lo reemplaza', () => {
  const uno = ponerObjetivo(conProyecto(), DIA, 'viejo').estado;
  const { estado } = ponerObjetivo(uno, DIA, 'nuevo');
  assert.equal(estado.dias.length, 1);
  assert.equal(estado.dias[0].objetivo, 'nuevo');
});

test('agregarProyecto no acepta un nombre vacío', () => {
  const previo = normalizarEstado(null);
  const { estado, cambios } = agregarProyecto(previo, { nombre: '  ' });
  assert.deepEqual(estado, previo);
  assert.deepEqual(cambios, []);
});

test('agregarProyecto le da un color de la lista', () => {
  const { estado } = agregarProyecto(normalizarEstado(null), { nombre: 'Kromatik' });
  assert.ok(['acid', 'ok', 'violet', 'warn'].includes(estado.proyectos[0].color));
});

test('editar no muta el estado que recibe', () => {
  const previo = conProyecto();
  agregarToma(previo, { proyecto: 'p1', queHacer: 'a', dia: DIA });
  assert.deepEqual(previo.tomas, []);
});

test('borrar deja una lápida en vez de sacar la fila, para que el otro aparato se entere', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  const { estado: despues, cambios } = borrar(estado, 'tomas', estado.tomas[0].id);
  assert.equal(despues.tomas.length, 1);
  assert.equal(despues.tomas[0].borrado, true);
  assert.equal(cambios[0].fila.borrado, true);
});

test('borrar un proyecto deja lápidas de él y de sus tomas', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p1', queHacer: 'b', dia: DIA }).estado;
  const { estado: despues, cambios } = borrar(estado, 'proyectos', 'p1');
  assert.equal(despues.proyectos[0].borrado, true);
  assert.deepEqual(despues.tomas.map((t) => t.borrado), [true, true]);
  assert.equal(cambios.length, 3);
});

test('se puede corregir el texto de una toma ya escrita', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'Generar Transicion', dia: DIA }).estado;
  const id = estado.tomas[0].id;
  const { estado: despues, cambios } = ponerTextoDeToma(estado, id, 'queHacer', 'Generar transición');
  assert.equal(despues.tomas[0].queHacer, 'Generar transición');
  assert.equal(cambios[0].id, id);
  assert.equal(cambios[0].tabla, 'tomas');
});

test('se le puede poner código y detalle a una toma que no los tenía', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const id = estado.tomas[0].id;
  const conCodigo = ponerTextoDeToma(estado, id, 'codigo', 'T22').estado;
  const conDetalle = ponerTextoDeToma(conCodigo, id, 'detalle', 'sale en el 118').estado;
  assert.equal(conDetalle.tomas[0].codigo, 'T22');
  assert.equal(conDetalle.tomas[0].detalle, 'sale en el 118');
});

test('no se puede dejar una toma sin texto por error', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { estado: despues, cambios } = ponerTextoDeToma(estado, estado.tomas[0].id, 'queHacer', '   ');
  assert.deepEqual(despues, estado);
  assert.deepEqual(cambios, []);
});

test('un campo que no es de texto no se toca', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { cambios } = ponerTextoDeToma(estado, estado.tomas[0].id, 'hecha', 'sí');
  assert.deepEqual(cambios, []);
});

test('escribir el mismo texto no encola un cambio al pedo', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { cambios } = ponerTextoDeToma(estado, estado.tomas[0].id, 'queHacer', 'roto');
  assert.deepEqual(cambios, []);
});

test('un borrador de toma nace vacío y todavía no se sube', () => {
  const { estado, cambios } = agregarBorradorDeToma(conProyecto(), { proyecto: 'p1', dia: DIA });
  assert.equal(estado.tomas.length, 1);
  assert.equal(estado.tomas[0].queHacer, '');
  assert.equal(estado.tomas[0].diaActual, DIA);
  assert.deepEqual(cambios, [], 'un borrador vacío no tiene por qué viajar a la nube');
});

test('escribirle el texto al borrador es lo que lo sube', () => {
  const { estado } = agregarBorradorDeToma(conProyecto(), { proyecto: 'p1', dia: DIA });
  const id = estado.tomas[0].id;
  const { estado: despues, cambios } = ponerTextoDeToma(estado, id, 'queHacer', 'Generar transición');
  assert.equal(despues.tomas[0].queHacer, 'Generar transición');
  assert.equal(cambios.length, 1);
  assert.equal(cambios[0].fila.queHacer, 'Generar transición');
});

test('un borrador que queda vacío se va sin dejar rastro', () => {
  const previo = conProyecto();
  const { estado } = agregarBorradorDeToma(previo, { proyecto: 'p1', dia: DIA });
  const { estado: despues, cambios } = quitarBorradorVacio(estado, estado.tomas[0].id);
  assert.deepEqual(despues.tomas, []);
  assert.deepEqual(cambios, [], 'nunca se subió, así que no hay lápida que mandar');
});

test('quitarBorradorVacio no toca una toma que sí tiene texto', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { estado: despues } = quitarBorradorVacio(estado, estado.tomas[0].id);
  assert.equal(despues.tomas.length, 1);
});

test('un borrador de proyecto nace sin nombre y tampoco se sube', () => {
  const { estado, cambios } = agregarBorradorDeProyecto(normalizarEstado(null));
  assert.equal(estado.proyectos.length, 1);
  assert.equal(estado.proyectos[0].nombre, '');
  assert.deepEqual(cambios, []);
});

test('ponerle el nombre al proyecto es lo que lo sube', () => {
  const { estado } = agregarBorradorDeProyecto(normalizarEstado(null));
  const id = estado.proyectos[0].id;
  const { estado: despues, cambios } = ponerTextoDeProyecto(estado, id, 'nombre', 'Fortaleza');
  assert.equal(despues.proyectos[0].nombre, 'Fortaleza');
  assert.equal(cambios[0].tabla, 'proyectos');
});

test('un proyecto sin nombre se va sin dejar rastro', () => {
  const { estado } = agregarBorradorDeProyecto(normalizarEstado(null));
  const { estado: despues, cambios } = quitarBorradorVacio(estado, estado.proyectos[0].id, 'proyectos');
  assert.deepEqual(despues.proyectos, []);
  assert.deepEqual(cambios, []);
});

// ---------- el gráfico chico de la tarjeta ----------
// Elegir el gráfico es un clic, y sus números se escriben en la tarjeta misma,
// como el resto de los textos.

test('ponerGrafico le pone un gráfico a un trabajo que no tenía', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const id = estado.tomas[0].id;
  const { estado: despues, cambios } = ponerGrafico(estado, id, 'capas');
  assert.equal(despues.tomas[0].grafico, 'capas');
  assert.equal(cambios.length, 1);
  assert.equal(cambios[0].id, id);
  assert.equal(cambios[0].tabla, 'tomas');
});

test('el gráfico recién puesto ya se dibuja: nace con valores, no vacío', () => {
  // Con capas en cero no se vería ni una barra y parecería que no pasó nada.
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const capas = ponerGrafico(estado, estado.tomas[0].id, 'capas').estado.tomas[0];
  assert.ok(capas.graficoValores.total > 0);
  const cadencia = ponerGrafico(estado, estado.tomas[0].id, 'cadencia').estado.tomas[0];
  assert.ok(cadencia.graficoValores.cada >= 1);
});

test('cambiar de gráfico trae los valores del nuevo, no los del viejo', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const id = estado.tomas[0].id;
  estado = ponerGrafico(estado, id, 'capas').estado;
  estado = ponerGrafico(estado, id, 'cadencia').estado;
  assert.equal(estado.tomas[0].grafico, 'cadencia');
  assert.deepEqual(Object.keys(estado.tomas[0].graficoValores).sort(), ['cada', 'imgs']);
});

test('ponerGrafico sin gráfico se lo saca al trabajo', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const id = estado.tomas[0].id;
  estado = ponerGrafico(estado, id, 'curva').estado;
  const { estado: despues, cambios } = ponerGrafico(estado, id, '');
  assert.equal(despues.tomas[0].grafico, null);
  assert.equal(despues.tomas[0].graficoValores, null);
  assert.equal(cambios.length, 1);
});

test('ponerGrafico ignora un gráfico que no existe', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { cambios } = ponerGrafico(estado, estado.tomas[0].id, 'barras');
  assert.deepEqual(cambios, []);
});

test('elegir otra vez el mismo gráfico no encola un cambio al pedo', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const id = estado.tomas[0].id;
  estado = ponerGrafico(estado, id, 'capas').estado;
  const { cambios } = ponerGrafico(estado, id, 'capas');
  assert.deepEqual(cambios, []);
});

test('ponerGrafico de un trabajo que no existe no hace nada', () => {
  const previo = conProyecto();
  const { estado, cambios } = ponerGrafico(previo, 'no-existe', 'capas');
  assert.deepEqual(estado, previo);
  assert.deepEqual(cambios, []);
});

test('ponerGrafico no muta el estado que recibe', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  ponerGrafico(estado, estado.tomas[0].id, 'curva');
  assert.equal(estado.tomas[0].grafico, null);
});

const conGrafico = (tipo) => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  return ponerGrafico(estado, estado.tomas[0].id, tipo).estado;
};

test('los números del gráfico se escriben como texto y se guardan como números', () => {
  const estado = conGrafico('capas');
  const id = estado.tomas[0].id;
  const { estado: despues, cambios } = ponerValorDeGrafico(estado, id, 'total', ' 5 ');
  assert.equal(despues.tomas[0].graficoValores.total, 5);
  assert.equal(cambios.length, 1);
});

test('lo que se escribe en un valor del gráfico no pisa los otros', () => {
  const estado = conGrafico('cadencia');
  const id = estado.tomas[0].id;
  const antes = estado.tomas[0].graficoValores.imgs;
  const despues = ponerValorDeGrafico(estado, id, 'cada', '4').estado.tomas[0];
  assert.equal(despues.graficoValores.cada, 4);
  assert.equal(despues.graficoValores.imgs, antes);
});

test('la cadencia nunca queda en cero: dividir por cero no dibuja ni un cuadro', () => {
  const estado = conGrafico('cadencia');
  const despues = ponerValorDeGrafico(estado, estado.tomas[0].id, 'cada', '0').estado;
  assert.equal(despues.tomas[0].graficoValores.cada, 1);
});

test('un número con basura adentro no rompe el dibujo', () => {
  const estado = conGrafico('capas');
  const despues = ponerValorDeGrafico(estado, estado.tomas[0].id, 'total', 'tres').estado;
  assert.equal(despues.tomas[0].graficoValores.total, 0);
});

test('un total enorme no dibuja mil barritas', () => {
  const estado = conGrafico('capas');
  const despues = ponerValorDeGrafico(estado, estado.tomas[0].id, 'total', '9999').estado;
  assert.ok(despues.tomas[0].graficoValores.total <= 40);
});

test('la curva guarda tal cual lo que dice al pie', () => {
  const estado = conGrafico('curva');
  const despues = ponerValorDeGrafico(estado, estado.tomas[0].id, 'ev', ' +0.5 EV ').estado;
  assert.equal(despues.tomas[0].graficoValores.ev, '+0.5 EV');
});

test('un valor que no es de ese gráfico no se guarda', () => {
  const estado = conGrafico('capas');
  const { cambios } = ponerValorDeGrafico(estado, estado.tomas[0].id, 'ev', '+1');
  assert.deepEqual(cambios, []);
});

test('sin gráfico no hay valores que poner', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { cambios } = ponerValorDeGrafico(estado, estado.tomas[0].id, 'total', '3');
  assert.deepEqual(cambios, []);
});

test('escribir el mismo valor no encola un cambio al pedo', () => {
  const estado = conGrafico('cadencia');
  const cada = estado.tomas[0].graficoValores.cada;
  const { cambios } = ponerValorDeGrafico(estado, estado.tomas[0].id, 'cada', String(cada));
  assert.deepEqual(cambios, []);
});

test('mover un trabajo a otro día lo saca del día de hoy', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { estado: despues, cambios } = moverTrabajo(estado, estado.tomas[0].id, '2026-10-19');
  assert.equal(despues.tomas[0].diaActual, '2026-10-19');
  assert.equal(cambios.length, 1);
});

test('mover no toca el día en que nació: el historial queda', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { estado: despues } = moverTrabajo(estado, estado.tomas[0].id, '2026-10-21');
  assert.equal(despues.tomas[0].diaOrigen, DIA);
});

test('mover al mismo día no encola nada', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  assert.deepEqual(moverTrabajo(estado, estado.tomas[0].id, DIA).cambios, []);
});

test('el detalle guarda los renglones tal cual se escribieron', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const texto = '- Ver exactamente qué va\n- Generar según pedido\n- Enviar a Juanma';
  const { estado: despues } = ponerTextoDeToma(estado, estado.tomas[0].id, 'detalle', texto);
  assert.equal(despues.tomas[0].detalle, texto);
});

test('el detalle se limpia por fuera pero no por dentro', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'roto', dia: DIA }).estado;
  const { estado: despues } = ponerTextoDeToma(estado, estado.tomas[0].id, 'detalle', '\n  uno\n\n  dos  \n');
  assert.equal(despues.tomas[0].detalle, 'uno\n\n  dos');
});

test('subir un trabajo lo pone antes del de arriba', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p1', queHacer: 'b', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p1', queHacer: 'c', dia: DIA }).estado;
  const b = estado.tomas[1].id;
  const { estado: despues, cambios } = subirTrabajo(estado, b);
  assert.deepEqual(ordenados(despues), ['b', 'a', 'c']);
  assert.equal(cambios.length, 2, 'cambian de orden los dos que se cruzaron');
});

test('bajar un trabajo lo pone después del de abajo', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p1', queHacer: 'b', dia: DIA }).estado;
  const { estado: despues } = bajarTrabajo(estado, estado.tomas[0].id);
  assert.deepEqual(ordenados(despues), ['b', 'a']);
});

test('el primero no sube y el último no baja', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p1', queHacer: 'b', dia: DIA }).estado;
  assert.deepEqual(subirTrabajo(estado, estado.tomas[0].id).cambios, []);
  assert.deepEqual(bajarTrabajo(estado, estado.tomas[1].id).cambios, []);
});

test('arrastrar un trabajo lo deja justo antes del que soltaste encima', () => {
  let estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p1', queHacer: 'b', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p1', queHacer: 'c', dia: DIA }).estado;
  const [a, , c] = estado.tomas.map((t) => t.id);
  const { estado: despues } = soltarAntesDe(estado, c, a);
  assert.deepEqual(ordenados(despues), ['c', 'a', 'b']);
});

test('soltar un trabajo encima de sí mismo no hace nada', () => {
  const estado = agregarToma(conProyecto(), { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  const id = estado.tomas[0].id;
  assert.deepEqual(soltarAntesDe(estado, id, id).cambios, []);
});

test('el orden no se mezcla entre proyectos', () => {
  const dos = normalizarEstado({ proyectos: [{ id: 'p1', nombre: 'A' }, { id: 'p2', nombre: 'B' }] });
  let estado = agregarToma(dos, { proyecto: 'p1', queHacer: 'a', dia: DIA }).estado;
  estado = agregarToma(estado, { proyecto: 'p2', queHacer: 'z', dia: DIA }).estado;
  assert.deepEqual(subirTrabajo(estado, estado.tomas[1].id).cambios, []);
});

test('Enter en el título de un trabajo abre el siguiente', () => {
  assert.equal(queHaceElEnter({ campo: 'queHacer', shift: false }), 'siguiente');
});

test('Shift+Enter en el título es un salto de renglón', () => {
  assert.equal(queHaceElEnter({ campo: 'queHacer', shift: true }), 'salto');
});

test('Enter en el nombre del proyecto abre su primer trabajo', () => {
  assert.equal(queHaceElEnter({ campo: 'nombre', shift: false }), 'siguiente');
});

test('en el detalle Enter siempre es salto: ahí se hacen las listas', () => {
  assert.equal(queHaceElEnter({ campo: 'detalle', shift: false }), 'salto');
  assert.equal(queHaceElEnter({ campo: 'detalle', shift: true }), 'salto');
});

test('en la etiqueta y el código Enter cierra el campo, no abre nada', () => {
  assert.equal(queHaceElEnter({ campo: 'etiqueta', shift: false }), 'cerrar');
  assert.equal(queHaceElEnter({ campo: 'codigo', shift: false }), 'cerrar');
});

test('en el objetivo del día Enter cierra el campo', () => {
  assert.equal(queHaceElEnter({ campo: null, objetivo: true, shift: false }), 'cerrar');
});

test('limpiarBorradores saca los que quedaron sin texto de una sesión anterior', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }, { id: 'p2', nombre: '' }],
    tomas: [
      { id: 't1', proyecto: 'p1', queHacer: 'roto', diaActual: DIA },
      { id: 't2', proyecto: 'p1', queHacer: '', diaActual: DIA }
    ]
  });
  const limpio = limpiarBorradores(estado);
  assert.deepEqual(limpio.tomas.map((t) => t.id), ['t1']);
  assert.deepEqual(limpio.proyectos.map((p) => p.id), ['p1']);
});

test('limpiarBorradores no toca nada si no hay borradores', () => {
  const estado = normalizarEstado({
    proyectos: [{ id: 'p1', nombre: 'Fortaleza' }],
    tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'roto', diaActual: DIA }]
  });
  assert.equal(limpiarBorradores(estado), estado);
});

test('el código sale de la inicial del proyecto y cuatro números', () => {
  assert.match(codigoNuevo('Fortaleza', [], () => 0.8934), /^F\d{4}$/);
  assert.equal(codigoNuevo('Munich', [], () => 0.1234), 'M1234');
});

test('el código usa la primera letra de verdad, no un espacio ni un signo', () => {
  assert.match(codigoNuevo('  munich', [], () => 0.5), /^M/);
  assert.match(codigoNuevo('3 Cerditos', [], () => 0.5), /^C/);
});

test('un proyecto sin nombre todavía no tiene letra', () => {
  assert.match(codigoNuevo('', [], () => 0.5), /^\d{4}$/);
});

test('el código no se repite dentro del mismo proyecto', () => {
  let n = 0;
  const azar = () => [0.1111, 0.1111, 0.2222][n++];
  assert.equal(codigoNuevo('Fortaleza', ['F1111'], azar), 'F2222');
});

test('un trabajo nuevo nace con su código puesto', () => {
  const { estado } = agregarBorradorDeToma(conProyecto(), { proyecto: 'p1', dia: DIA });
  assert.match(estado.tomas[0].codigo, /^F\d{4}$/);
});

test('dos trabajos del mismo proyecto no comparten código', () => {
  const uno = agregarBorradorDeToma(conProyecto(), { proyecto: 'p1', dia: DIA }).estado;
  const dos = agregarBorradorDeToma(uno, { proyecto: 'p1', dia: DIA }).estado;
  assert.notEqual(dos.tomas[0].codigo, dos.tomas[1].codigo);
});

test('pausar y reanudar un proyecto', () => {
  const { estado, cambios } = pausarProyecto(conProyecto(), 'p1');
  assert.equal(estado.proyectos[0].pausado, true);
  assert.equal(cambios[0].fila.pausado, true);
  assert.equal(pausarProyecto(estado, 'p1').estado.proyectos[0].pausado, false);
});
