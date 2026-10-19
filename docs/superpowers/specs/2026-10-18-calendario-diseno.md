# Calendario de trabajos — diseño

Fecha: 2026-10-18
Para: Abel Medina (post / VFX / color)

## Qué es y por qué

Una PWA de un solo tablero: **lo que Abel va a hacer hoy**. Se abre a la mañana
en la Mac para anotar el día, y queda disponible en el celu y en la PC durante
la jornada. La segunda función es igual de importante que la primera: el tablero
tiene que verse lo bastante bien como para **sacarle una captura de pantalla y
mandarla por WhatsApp** para que un cliente o un compañero sepa en qué está
trabajando y cuál es su objetivo del día.

No es una app de tareas genérica. El contenido es el de un post house chico:
proyecto → toma → qué hay que hacer en esa toma ("Fortaleza, T22, roto del
brazo, 3 capas"). El vocabulario, los códigos de toma y las tarjetas están
hechos para eso.

La dirección visual ya está aprobada: mockup en
`.superpowers/brainstorm/2913-1792365922/content/d-tablero.html`. **Ese archivo
es la referencia visual de la construcción** — no se rediseña, se implementa.

## Objetivos

- Anotar el día rápido: proyecto, toma, qué hacer, un detalle corto.
- Ver lo mismo en la Mac, en la PC Windows y en el celu, sin pensar en sincronizar.
- Que una captura de pantalla del tablero se entienda sola y se vea bien.
- Que se instale como app (icono propio) en iPhone/Android y en la Mac.
- Que siga funcionando sin internet y se ponga al día solo cuando vuelve.
- Modo oscuro siempre. No hay modo claro.

## No objetivos (quedan afuera de esta versión)

- Horarios. **No hay hora del día en ningún lado**: ni franjas, ni "de 10 a 13",
  ni recordatorios. El día es una lista, no una agenda.
- Botón de exportar imagen. Abel captura a mano (decisión suya).
- Las vistas Semana, Proyectos y Hecho. **La primera versión es una sola
  pantalla: el día.** Los chips de arriba salen hasta que haya una segunda
  vista que mostrar.
- Leer los proyectos reales desde el `index.json` de RENDER.
- Conexión con Resolve, After Effects, la PC o el render queue.
- Compartir con otras personas, comentarios, multiusuario, notificaciones.
- Adjuntar imágenes o archivos a una toma.

## Anti objetivos (esto sería un fracaso aunque funcione)

- Que dependa de que la Mac esté prendida para ver el día en el celu.
- Que se pierda lo anotado por no haber internet en ese momento.
- Que termine pareciendo una app de to-do genérica: tarjetas todas iguales,
  casillas de verificación grises, nada que hable de post.
- Que la captura de pantalla salga con botones de editar, barras o menús.

## Decisiones ya tomadas

### De Abel

- **Tiene que estar disponible siempre y mostrar lo mismo en los tres aparatos**
  (Mac, PC, celu). Esto descarta guardar solo en el navegador y descarta un
  servidor en la Mac.
- **La captura la saca él a mano**, no hay botón de exportar.
- **Captura desde los dos aparatos**, Mac y celu. El layout vertical no es un
  apilado de apuro: se diseña con el mismo cuidado que el de escritorio y tiene
  su propio mockup aprobado antes de construir.
- **No quiere configurar nada.** Toda la infraestructura la deja armada el
  constructor: el proyecto de Supabase, las tablas, las políticas y su cuenta.
  Lo único que hace Abel es escribir una contraseña la primera vez en cada
  aparato.
- **El repositorio es público** en GitHub (`abelmedinapy`), servido por GitHub
  Pages. Queda público el código, el manifest y el sprite de RENDER; los datos
  no, que van detrás del login y de RLS.
- **Los proyectos se escriben a mano**, no se leen de RENDER.
- **Lo no terminado pasa solo al día siguiente**, marcado como arrastrado.
- **Siempre modo oscuro.**
- El muñequito **RENDER** está en el tablero, con su tablet en la mano
  (`Proyectos_Claude/RENDER/render/estatico/sprites/frente_tablet.png`).

### Mías (revisables)

Abel dijo "ve dónde puede ser"; estas son decisiones de constructor, no cosas
que él haya pedido:

- **Cloudflare** para todo: los datos en **D1**, la API y el hosting en un
  **Worker**. Su cuenta ya está autenticada en la Mac con permisos de `d1`,
  `workers` y `pages`, así que no hay nada que crear ni configurar. Es gratis,
  está siempre arriba y da HTTPS, que es condición para instalar una PWA y para
  el service worker. El mismo Worker sirve la app y la API, así que no hay CORS
  ni dos lugares que mantener.
  *(Supabase quedó descartado: el plan free admite dos proyectos por usuario y
  él ya tiene dos. `mqvsa-membresia` y `mqvsa-devocional` no se tocan.)*
- **El código, igual en un repo público de GitHub** (`abelmedinapy`), por
  historial y respaldo, aunque quien sirva la app sea Cloudflare.
- **Una sola llave compartida** en vez de cuentas y contraseñas: el Worker
  guarda un secreto, Abel lo escribe una vez por aparato y queda guardado en el
  navegador. No hay tabla de usuarios ni sesiones que vencen. La llave la genera
  el constructor y la deja anotada en
  `Proyectos_Claude/CLAVES Y COSAS DE LOS PROYECTOS`.
- **HTML, CSS y JavaScript a mano, sin framework ni paso de build.** Es una sola
  pantalla, tiene que andar offline y tiene que ser fácil de retocar después.
  Supabase entra por su cliente ESM desde CDN.
- **Local primero**: todo lo que escribe se guarda primero en el navegador y se
  responde al toque; la subida a Supabase va atrás. Al abrir, baja lo último.
  Si no hay internet, el día se ve y se edita igual.
- **Tipografías Bricolage Grotesque (títulos) y Figtree (interfaz)**, servidas
  desde el repo, no desde Google Fonts, para que la app se vea igual sin
  internet. Mismo criterio que ya usa RENDER con Satoshi e IBM Plex Mono.

## Qué tiene que hacer

### El tablero del día

Tal cual el mockup aprobado:

1. **Barra de arriba** — "Hoy" con la fecha al lado. Sin chips de vista, porque
   por ahora hay una sola vista.
2. **Panel** — RENDER con su tablet a la izquierda, diciendo en una línea cómo
   quedó ayer. Al lado, el **objetivo del día** en una línea editable, y los
   contadores: proyectos, tomas, listas.
3. **El riel** — una línea horizontal con un nodo por proyecto. De cada nodo
   baja un codito curvo hacia su columna. En la columna: el nombre del proyecto
   con su etiqueta (VFX, Spot, Propio), los chips de las tomas ya hechas
   (tachadas), y las tarjetas de lo que falta.
4. **Las tarjetas** — código de toma, qué hay que hacer, un detalle corto. Y
   cuando el dato lo pide, un gráfico chico del oficio: barra de capas del roto,
   curva de grade, tira de cuadros de la cadencia. Estos gráficos son opcionales
   por tarjeta, no obligatorios.
5. **El scrubber de abajo** — una fila de días con un puntito donde hubo
   trabajo y el día abierto resaltado. Es la navegación entre días: no tiene
   horas.

En celular el riel se vuelve vertical, con su propio diseño aprobado aparte.

### Editar

- Agregar proyecto: nombre y etiqueta. Queda guardado para elegirlo después.
- Agregar toma a un proyecto: código opcional (T22, grade, out), qué hacer,
  detalle opcional.
- Marcar una toma como hecha, y desmarcarla.
- Editar el objetivo del día.
- Borrar una toma o un proyecto del día.
- **Los controles de editar no se ven en reposo**: aparecen al pasar el mouse o
  al tocar. Es lo que mantiene limpia la captura de pantalla.

### El arrastre

Al abrir un día nuevo, las tomas sin terminar de días anteriores aparecen en su
proyecto marcadas como arrastradas, con cuántos días llevan. No se duplican: es
la misma toma que cambió de día.

Cada toma guarda **dos fechas**: el día en que nació y el día en el que está
hoy. El arrastre lo corre el navegador al abrir, mueve lo pendiente directo al
día de hoy sin pasar por los días del medio, y es repetible sin romper nada, así
que no importa si lo corren la Mac y el celu a la vez. El puntito del scrubber
marca los días que tuvieron trabajo de verdad: tomas nacidas ese día o tomas
terminadas ese día. Por eso un día pasado nunca queda vacío por culpa del
arrastre.

El día no corta a medianoche sino a las **5 de la mañana, hora de Asunción**,
porque Abel trabaja de noche: a las 2 AM el tablero sigue siendo el de ayer.

### Detalles que resolví yo al revisar el mockup

Un revisor leyó este documento y el mockup y encontró huecos. Estos los cerré
yo; son decisiones de constructor, no cosas que Abel haya pedido, y se pueden
cambiar si no le gustan:

- **Cuántos proyectos entran en el riel.** Las columnas tienen un ancho mínimo
  (alrededor de 300 px) y se envuelven en filas; cada fila lleva su tramo de
  riel. Así el tablero no se achica hasta ser ilegible, que es lo que arruinaría
  la captura. A partir de seis proyectos en un día la app avisa, sin impedirlo.
- **Hay un tercer estado: "en curso".** Una sola toma a la vez puede estar en
  curso, y es la que lleva el borde encendido del mockup. Es lo que contesta la
  pregunta "¿en qué está trabajando ahora?" cuando alguien mira la captura.
- **El punto de la tarjeta es el botón de marcar hecha.** Se queda visible
  siempre porque es parte del dibujo, no un control que ensucie la captura.
- **El chip "3 tomas del trencito" sale del diseño.** Los chips de arriba son
  solamente tomas hechas; un contador de pendientes ahí confundía.
- **La línea de RENDER se calcula** de los datos del día anterior y nunca dice
  horas. Abel puede sobrescribirla a mano si quiere que diga otra cosa.
- **El scrubber es una ventana corrida**, no el mes entero: doce días en
  escritorio y siete en el celu, centrados en el día abierto. Se puede abrir y
  editar cualquier día, pasado o futuro.

### Instalación y offline

- Manifest con icono propio y arranque a pantalla completa.
- Service worker que cachea la app entera para que abra sin internet.
- Los cambios hechos sin conexión se suben cuando vuelve.

## Datos

Una idea de la forma, no el esquema final:

Las tablas viven en D1 (SQLite). Como hay un solo usuario, no hay columna de
usuario ni políticas por fila: lo que protege los datos es la llave que pide el
Worker en cada pedido.

- `proyectos` — nombre, etiqueta, color, si está archivado.
- `tomas` — proyecto, código, qué hacer, detalle, el día en que nació, el día en
  el que está, si está hecha, si está en curso, el gráfico opcional y sus
  valores.
- `dias` — la fecha, el objetivo del día y la línea de RENDER si fue escrita a
  mano.

El Worker rechaza con 401 cualquier pedido sin la llave correcta.

## Qué queda a criterio del constructor

- El esquema exacto de las tablas, los índices y las políticas de RLS.
- Cómo se resuelve un conflicto si edita en dos aparatos a la vez (lo más simple
  que funcione: gana la última escritura, por campo o por fila).
- El formulario de agregar: en línea sobre la tarjeta, o un panel que se abre.
- Cómo se eligen los colores de cada proyecto.
- Qué tipos de gráfico chico existen y cómo se cargan sus valores.
- El nombre del repositorio y la URL final.
- Cómo se prueba: qué se cubre con tests y qué se mira a ojo.

## Cómo se sabe que está listo

Abel abre la app en la Mac, anota el día, la abre en el celu desde la calle y ve
lo mismo, le saca una captura y la manda sin tener que recortar nada.
