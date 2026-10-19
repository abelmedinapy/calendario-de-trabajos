# Calendario de trabajos

El tablero del día: en qué proyectos voy a trabajar hoy, qué toma de cada uno y
qué hay que hacerle. Una sola pantalla, modo oscuro, pensada para sacarle una
captura y mandarla por WhatsApp para que se entienda en qué estoy.

**https://calendario.abelmedina-py.workers.dev**

Se instala como app en el celular y en la Mac, y abre sin internet con lo último
que quedó guardado.

## Cómo está hecho

HTML, CSS y JavaScript a mano: sin framework, sin paso de build y sin
dependencias en tiempo de ejecución.

- `src/` — la lógica, en módulos que se pueden probar sin navegador.
  `dia.js` (el corte del día), `modelo.js` (la forma de los datos),
  `arrastre.js` (lo que no se terminó), `render-dice.js` (lo que dice RENDER),
  `vista.js` (datos → HTML), `almacen-local.js`, `nube.js`, `sync.js`,
  `editar.js`, `app.js`.
- `worker/` — la API en Cloudflare Workers y el esquema de la base.
- `css/tablero.css` — todo el diseño, escritorio y celular.
- `sw.js` + `app.webmanifest` — lo que la hace instalable y la deja abrir
  sin internet.

El Worker sirve la app y la API desde el mismo origen, así que no hay CORS.
Los datos viven en Cloudflare D1.

## Correr y probar

    npm test              # los tests, con el corredor que trae Node
    npm run dev           # la app en http://localhost:8799 con una base local

Para el modo local hace falta un archivo `.dev.vars` con una llave de prueba:

    LLAVE=llave-de-prueba

y el esquema aplicado a la base local:

    wrangler d1 execute calendario --local --file worker/esquema.sql

## Desplegar

    wrangler deploy

## La llave

La app pide una llave la primera vez en cada aparato y después la guarda. No
está en este repositorio: vive como secreto del Worker. Para cambiarla:

    wrangler secret put LLAVE

## Dos cosas que no son obvias

- **El día corta a las 5 de la mañana**, no a medianoche. A las 2 AM el tablero
  sigue siendo el de ayer, porque las noches de trabajo cruzan la medianoche.
- **No hay horas en ningún lado.** El día es una lista de lo que hay que hacer,
  no una agenda. El scrubber de abajo navega entre días, no entre horas.

El diseño y el plan están en `../docs/superpowers/`.
