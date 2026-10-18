// El día de trabajo no corta a medianoche sino a las 5 de la mañana en Asunción:
// a las 2 AM el tablero sigue siendo el de ayer.

const ZONA = 'America/Asuncion';
const CORTE_HORAS = 5;
const UN_DIA = 86400000;

const isoEnZona = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit'
});
const largo = new Intl.DateTimeFormat('es-PY', {
  timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long'
});
const diaCorto = new Intl.DateTimeFormat('es-PY', { timeZone: 'UTC', weekday: 'short' });

function aUTC(dia) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function aISO(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function limpiar(texto) {
  return texto.replace(/\.$/, '');
}

export function hoy(ahora = new Date()) {
  return isoEnZona.format(new Date(ahora.getTime() - CORTE_HORAS * 3600000));
}

export function ventanaScrubber(dia, cuantos) {
  const centro = aUTC(dia);
  const antes = Math.floor((cuantos - 1) / 2);
  return Array.from({ length: cuantos }, (_, i) =>
    aISO(new Date(centro.getTime() + (i - antes) * UN_DIA)));
}

export function diasDeAtraso(desde, hasta) {
  return Math.round((aUTC(hasta) - aUTC(desde)) / UN_DIA);
}

export function nombreCorto(dia) {
  const fecha = aUTC(dia);
  return { dia: limpiar(diaCorto.format(fecha)), numero: String(fecha.getUTCDate()) };
}

export function fechaLarga(dia) {
  return largo.format(aUTC(dia)).replace(',', '');
}
