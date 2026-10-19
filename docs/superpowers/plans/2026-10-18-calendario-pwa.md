# Calendario de trabajos — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una PWA de una sola pantalla que muestra en qué va a trabajar Abel hoy, igual en la Mac, la PC y el celu, instalable y usable sin internet.

**Architecture:** HTML, CSS y JavaScript a mano, sin framework ni paso de build. La lógica vive en módulos ESM puros (datos adentro, datos o HTML afuera) para que se puedan probar con `node --test` sin navegador; el DOM solo se toca en `editar.js` y `app.js`. Local primero: todo se escribe en `localStorage` y se responde al toque, y una cola de cambios sube al Worker atrás. Al abrir, baja lo remoto y fusiona por fila con la última escritura.

**Tech Stack:** JavaScript ESM, `node --test` (sin dependencias de test), Cloudflare D1 (SQLite) para los datos y un Worker que sirve la app y la API con una llave compartida, service worker propio, repo público en GitHub.

**Spec:** `docs/superpowers/specs/2026-10-18-calendario-diseno.md`

## Global Constraints

- Modo oscuro siempre. No hay modo claro ni `prefers-color-scheme`.
- **No aparece la hora del día en ningún lado**: ni en la interfaz, ni en la línea de RENDER, ni en los datos que se muestran.
- El día corta a las **05:00 en `America/Asuncion`**, no a medianoche.
- Una sola vista: el día. Sin chips de Día / Semana / Proyectos / Hecho.
- Los controles de editar están ocultos en reposo y aparecen al pasar el mouse o al tocar.
- La referencia visual es `.superpowers/brainstorm/2913-1792365922/content/d-tablero.html` (escritorio) y `e-celular.html` (celular). Se implementan, no se rediseñan.
- Tipografías Bricolage Grotesque (títulos) y Figtree (interfaz), servidas desde el repo, nunca desde Google Fonts.
- Sin dependencias de npm en tiempo de ejecución ni de test. La app habla con su propia API por `fetch`; no hay SDK de nadie.
- Textos de interfaz en español rioplatense, voseo, minúscula de oración.
- Nada de `console.log` en el código que queda.

## Review Focus

Entradas que el diseño implica y que ninguna tarea probaría sola. Cada línea tiene su test asignado a la tarea que es dueña del código:

1. **`localStorage` bloqueado o lleno** (ventana privada, cuota llena): la app abre igual y avisa que no guarda local, en vez de romperse al arrancar. → Tarea 6.
2. **Aparato nuevo sin internet**: no hay nada local ni sesión; la pantalla lo dice, no queda en blanco. → Tarea 11.
3. **Dos aparatos editan la misma toma sin conexión**: al sincronizar gana la última escritura por fila, no se duplica la toma ni se pierden los campos que el otro no tocó. → Tarea 8.
4. **Día sin proyectos, o proyecto sin tomas**: el tablero vacío invita a anotar y el riel no queda colgado. → Tarea 5.
5. **Textos largos** (nombre de proyecto, detalle de toma): no desbordan la tarjeta ni ensanchan la columna, porque eso arruina la captura. → Tarea 5.

---

### Task 1: El repo y el corte del día

**Files:**
- Create: `calendario/.gitignore`, `calendario/README.md`, `calendario/package.json`
- Create: `calendario/src/dia.js`
- Test: `calendario/tests/dia.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `hoy(ahora?: Date): string` (ISO `YYYY-MM-DD`), `ventanaScrubber(dia: string, cuantos: number): string[]`, `diasDeAtraso(desde: string, hasta: string): number`, `nombreCorto(dia: string): {dia: string, numero: string}` (ej. `{dia:"sáb", numero:"18"}`), `fechaLarga(dia: string): string` (ej. `"sábado 18 de octubre"`).

`package.json` solo declara `"type": "module"` y `"scripts": {"test": "node --test tests/"}`. Sin dependencias.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/dia.test.js`

```js
test('a las 2 AM el día sigue siendo el de ayer', () => {
  assert.equal(hoy(new Date('2026-10-19T05:00:00Z')), '2026-10-18'); // 02:00 en Asunción
});
test('a las 5 AM empieza el día nuevo', () => {
  assert.equal(hoy(new Date('2026-10-19T08:00:00Z')), '2026-10-19'); // 05:00 en Asunción
});
test('la ventana del scrubber centra el día abierto', () => {
  assert.deepEqual(ventanaScrubber('2026-10-18', 7),
    ['2026-10-15','2026-10-16','2026-10-17','2026-10-18','2026-10-19','2026-10-20','2026-10-21']);
});
test('la ventana cruza el borde del mes', () => {
  assert.equal(ventanaScrubber('2026-10-02', 7)[0], '2026-09-29');
});
test('los días de atraso cuentan de día a día', () => {
  assert.equal(diasDeAtraso('2026-10-15', '2026-10-18'), 3);
});
test('fechaLarga y nombreCorto salen en español', () => {
  assert.equal(fechaLarga('2026-10-18'), 'sábado 18 de octubre');
  assert.deepEqual(nombreCorto('2026-10-18'), { dia: 'sáb', numero: '18' });
});
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `cd calendario && npm test`
Expected: FAIL, `dia.js` no existe.

- [ ] **Step 3: Implementar `src/dia.js`**

Las cinco funciones de arriba. `hoy()` resta 5 horas al instante y después lo formatea en `America/Asuncion` con `Intl.DateTimeFormat`; los nombres en español salen de `Intl` con locale `es-PY`, no de una tabla a mano.

- [ ] **Step 4: Correr los tests y ver que pasan**

Run: `cd calendario && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add calendario && git commit -m "feat: el corte del día a las 5 AM y la ventana del scrubber"
```

---

### Task 2: El modelo y los contadores

**Files:**
- Create: `calendario/src/modelo.js`
- Test: `calendario/tests/modelo.test.js`

**Interfaces:**
- Consumes: `dia.js`.
- Produces: `normalizarEstado(crudo: unknown): Estado`, `agruparPorProyecto(estado: Estado, dia: string): Grupo[]`, `contadores(estado, dia): {proyectos: number, tomas: number, listas: number}`, `marcarEnCurso(estado, tomaId: string): Estado`.
  - `Estado = {proyectos: Proyecto[], tomas: Toma[], dias: Dia[]}`
  - `Proyecto = {id, nombre, etiqueta, color, archivado, actualizado}`
  - `Toma = {id, proyecto, codigo, queHacer, detalle, diaOrigen, diaActual, hecha, diaHecha, enCurso, grafico, graficoValores, orden, actualizado}`
  - `Dia = {fecha, objetivo, renderDice, actualizado}`
  - `Grupo = {proyecto: Proyecto, hechas: Toma[], pendientes: Toma[]}`
  - `color` es una de `'acid' | 'ok' | 'violet' | 'warn'`.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/modelo.test.js`

```js
test('normalizarEstado tolera campos que faltan y basura', () => {
  const e = normalizarEstado({ tomas: [{ id: 't1', proyecto: 'p1', queHacer: 'roto' }] });
  assert.deepEqual(e.proyectos, []);
  assert.equal(e.tomas[0].hecha, false);
  assert.equal(e.tomas[0].enCurso, false);
  assert.equal(e.tomas[0].orden, 0);
});
test('agruparPorProyecto separa hechas de pendientes y respeta el orden', () => { /* 1 proyecto, 3 tomas */ });
test('agruparPorProyecto saltea los proyectos sin tomas ese día', () => { /* ... */ });
test('contadores cuenta proyectos con tomas, tomas del día y hechas', () => {
  assert.deepEqual(contadores(estado, '2026-10-18'), { proyectos: 3, tomas: 7, listas: 2 });
});
test('marcarEnCurso apaga la que estaba en curso', () => { /* solo queda una con enCurso */ });
test('marcarEnCurso sobre una toma hecha no la enciende', () => { /* ... */ });
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `cd calendario && npm test -- tests/modelo.test.js`
Expected: FAIL

- [ ] **Step 3: Implementar `src/modelo.js`**

Las cuatro funciones. Todas devuelven estructuras nuevas, nunca mutan lo que reciben. `agruparPorProyecto` filtra por `diaActual === dia` y ordena por `orden` y después por `actualizado`.

- [ ] **Step 4: Correr los tests y ver que pasan**

Run: `cd calendario && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add calendario/src/modelo.js calendario/tests/modelo.test.js
git commit -m "feat: el modelo del tablero, los grupos y los contadores"
```

---

### Task 3: El arrastre

**Files:**
- Create: `calendario/src/arrastre.js`
- Test: `calendario/tests/arrastre.test.js`

**Interfaces:**
- Consumes: `dia.js`, `modelo.js`.
- Produces: `arrastrar(estado: Estado, hoy: string): {estado: Estado, movidas: string[]}`, `diasConTrabajo(estado: Estado, dias: string[]): Set<string>`.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/arrastre.test.js`

```js
test('una toma pendiente de ayer pasa a hoy', () => { /* diaActual === hoy, diaOrigen intacto */ });
test('las tomas hechas no se mueven', () => { /* ... */ });
test('salta directo a hoy sin pasar por los días del medio', () => {
  // pendiente del 14, hoy es el 18 -> diaActual '2026-10-18', diasDeAtraso 4
});
test('correrlo dos veces no cambia nada ni vuelve a reportar movidas', () => {
  const a = arrastrar(estado, '2026-10-18');
  const b = arrastrar(a.estado, '2026-10-18');
  assert.deepEqual(b.movidas, []);
  assert.deepEqual(b.estado, a.estado);
});
test('no arrastra tomas de días futuros', () => { /* anotada para el 20, hoy 18 -> queda en el 20 */ });
test('diasConTrabajo marca el día donde nació una toma aunque se haya arrastrado', () => {
  // toma nacida el 15, hoy en el 18 -> el 15 sigue teniendo punto
});
test('diasConTrabajo marca el día en que se terminó una toma', () => { /* diaHecha */ });
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `cd calendario && npm test -- tests/arrastre.test.js`
Expected: FAIL

- [ ] **Step 3: Implementar `src/arrastre.js`**

`arrastrar` solo toca tomas con `hecha === false` y `diaActual < hoy`; les pone `diaActual = hoy` y refresca `actualizado`. `diasConTrabajo` junta `diaOrigen` de toda toma y `diaHecha` de las hechas, y devuelve solo los que estén en `dias`.

- [ ] **Step 4: Correr los tests y ver que pasan**

Run: `cd calendario && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add calendario/src/arrastre.js calendario/tests/arrastre.test.js
git commit -m "feat: el arrastre de lo pendiente y los puntitos del scrubber"
```

---

### Task 4: Lo que dice RENDER

**Files:**
- Create: `calendario/src/render-dice.js`
- Test: `calendario/tests/render-dice.test.js`

**Interfaces:**
- Consumes: `dia.js`, `modelo.js`.
- Produces: `loQueDiceRender(estado: Estado, dia: string): string`.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/render-dice.test.js`

```js
test('si el día tiene texto escrito a mano, gana ese', () => {
  assert.equal(loQueDiceRender(conRenderDice('lo que sea'), '2026-10-18'), 'lo que sea');
});
test('cuenta lo que quedó sin cerrar y nombra el proyecto cuando es uno solo', () => {
  assert.equal(loQueDiceRender(estado, '2026-10-18'),
    'Ayer quedaron 3 tomas de Fortaleza sin cerrar.');
});
test('con varios proyectos no nombra ninguno', () => {
  assert.equal(loQueDiceRender(estado, '2026-10-18'), 'Ayer quedaron 5 tomas sin cerrar.');
});
test('una sola toma va en singular', () => {
  assert.match(loQueDiceRender(estado, '2026-10-18'), /^Ayer quedó 1 toma/);
});
test('si no quedó nada pendiente, saluda sin inventar', () => {
  assert.equal(loQueDiceRender(estado, '2026-10-18'), 'Ayer cerraste todo. Arrancamos limpio.');
});
test('el primer día de todos no habla de ayer', () => {
  assert.equal(loQueDiceRender({proyectos:[],tomas:[],dias:[]}, '2026-10-18'), 'Anotá lo primero del día.');
});
test('nunca dice una hora', () => {
  assert.doesNotMatch(loQueDiceRender(estado, '2026-10-18'), /\d{1,2}[:.]\d{2}/);
});
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `cd calendario && npm test -- tests/render-dice.test.js`
Expected: FAIL

- [ ] **Step 3: Implementar `src/render-dice.js`**

Mira las tomas arrastradas hacia `dia` (las que tienen `diaOrigen < dia` y siguen pendientes). Las cuatro frases exactas de los tests son las únicas que existe; no hay plantillas sueltas.

- [ ] **Step 4: Correr los tests y ver que pasan**

Run: `cd calendario && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add calendario/src/render-dice.js calendario/tests/render-dice.test.js
git commit -m "feat: la línea que dice RENDER sobre el día de ayer"
```

---

### Task 5: La vista

**Files:**
- Create: `calendario/src/vista.js`, `calendario/css/tablero.css`, `calendario/index.html`
- Create: `calendario/assets/render.png` (copiar de `Proyectos_Claude/RENDER/render/estatico/sprites/frente_tablet.png`)
- Test: `calendario/tests/vista.test.js`

**Interfaces:**
- Consumes: `dia.js`, `modelo.js`, `arrastre.js`, `render-dice.js`.
- Produces: `tableroHTML(estado: Estado, dia: string): string`, `tarjetaHTML(toma: Toma): string`, `scrubberHTML(estado: Estado, dia: string): string`.

El CSS y la estructura salen tal cual de los dos mockups: mismo HTML para escritorio y celular, la diferencia la hace una media query en `tablero.css`. Los tokens de color, el riel, el codito curvo, las tarjetas, los tres gráficos (`capas`, `curva`, `cadencia`) y el scrubber ya están resueltos ahí — se copian, no se reinventan.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/vista.test.js`

```js
test('el tablero muestra el objetivo del día', () => {
  assert.match(tableroHTML(estado, '2026-10-18'), /Cerrar los VFX de Fortaleza/);
});
test('hay un nodo del riel por proyecto con tomas', () => { /* 3 nodos */ });
test('la toma en curso lleva la clase live y es una sola', () => { /* ... */ });
test('las tomas hechas salen como chip tachado, no como tarjeta', () => { /* ... */ });
test('la tarjeta dibuja el gráfico que pide la toma', () => {
  assert.match(tarjetaHTML(tomaCapas), /class="layers"/);
  assert.match(tarjetaHTML(tomaCurva), /<svg/);
  assert.doesNotMatch(tarjetaHTML(tomaPelada), /class="layers"|<svg/);
});
test('una toma arrastrada dice cuántos días lleva', () => {
  assert.match(tarjetaHTML(arrastradaTresDias), /3 días/);
});
test('un día sin proyectos invita a anotar', () => {   // Review Focus 4
  const html = tableroHTML({proyectos:[],tomas:[],dias:[]}, '2026-10-18');
  assert.match(html, /Anotá lo primero del día/);
  assert.doesNotMatch(html, /class="wire"/);
});
test('escapa el HTML que venga en los textos', () => {   // Review Focus 5
  assert.doesNotMatch(tarjetaHTML(tomaConScript), /<script>/);
});
test('un texto larguísimo no mete atributos de ancho en el HTML', () => {  // Review Focus 5
  // el recorte es del CSS, no del HTML: el texto sale entero
  assert.match(tarjetaHTML(tomaTextoLargo), /aaaaaaaaaa/);
});
test('el scrubber marca el día abierto y los días con trabajo', () => { /* clases now y has */ });
test('con seis proyectos o más el tablero avisa, sin impedir nada', () => {
  const html = tableroHTML(conSeisProyectos, '2026-10-18');
  assert.match(html, /seis proyectos en un día/);
  assert.equal((html.match(/class="node"/g) || []).length, 6);
});
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `cd calendario && npm test -- tests/vista.test.js`
Expected: FAIL

- [ ] **Step 3: Implementar `src/vista.js`, `css/tablero.css` e `index.html`**

`vista.js` devuelve strings, no toca el DOM, y escapa todo texto que venga de los datos. En `tablero.css` el desborde de texto largo se resuelve con `overflow-wrap: anywhere` y `min-width: 0` en las columnas del riel; las columnas tienen `minmax(300px, 1fr)` y se envuelven en filas, cada fila con su tramo de riel.

- [ ] **Step 4: Correr los tests y ver que pasan, y mirar la página**

Run: `cd calendario && npm test`
Expected: PASS
Abrir `index.html` con datos de ejemplo y compararla con los dos mockups, en 1280 px y en 390 px. Mirarla además con uno, tres y siete proyectos en el día: con siete el riel se envuelve en filas y ninguna columna baja de 300 px.

- [ ] **Step 5: Commit**

```bash
git add calendario/src/vista.js calendario/css calendario/index.html calendario/assets calendario/tests/vista.test.js
git commit -m "feat: el tablero dibujado, escritorio y celular"
```

---

### Task 6: Guardado local y cola de cambios

**Files:**
- Create: `calendario/src/almacen-local.js`
- Test: `calendario/tests/almacen-local.test.js`

**Interfaces:**
- Consumes: `modelo.js`.
- Produces: `crearAlmacen(storage: Storage): Almacen` con `leerEstado(): Estado`, `guardarEstado(estado: Estado): boolean`, `encolar(cambio: Cambio): void`, `cola(): Cambio[]`, `sacarDeLaCola(ids: string[]): void`, `puedeGuardar(): boolean`.
  - `Cambio = {id: string, tabla: 'proyectos'|'tomas'|'dias', fila: object, borrado: boolean}`

`crearAlmacen` recibe el `Storage` por parámetro para que los tests le pasen un doble; en el navegador recibe `localStorage`.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/almacen-local.test.js`

```js
test('lo guardado se lee igual', () => { /* ida y vuelta */ });
test('leerEstado devuelve un estado vacío si no hay nada', () => { /* {proyectos:[],tomas:[],dias:[]} */ });
test('leerEstado devuelve un estado vacío si lo guardado es basura', () => { /* texto que no es JSON */ });
test('la cola conserva el orden y sacarDeLaCola saca solo lo pedido', () => { /* ... */ });
test('encolar dos veces el mismo id deja un solo cambio, el último', () => { /* ... */ });
test('si el storage tira al escribir, guardarEstado devuelve false y no explota', () => {  // Review Focus 1
  const roto = { getItem: () => null, setItem: () => { throw new DOMException('lleno'); } };
  const a = crearAlmacen(roto);
  assert.equal(a.guardarEstado(estado), false);
  assert.equal(a.puedeGuardar(), false);
});
test('si el storage tira al leer, leerEstado devuelve el estado vacío', () => {  // Review Focus 1
  const roto = { getItem: () => { throw new DOMException('bloqueado'); }, setItem: () => {} };
  assert.deepEqual(crearAlmacen(roto).leerEstado(), { proyectos: [], tomas: [], dias: [] });
});
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `cd calendario && npm test -- tests/almacen-local.test.js`
Expected: FAIL

- [ ] **Step 3: Implementar `src/almacen-local.js`**

Toda lectura y toda escritura van adentro de un `try`. Dos claves: `calendario:estado` y `calendario:cola`.

- [ ] **Step 4: Correr los tests y ver que pasan**

Run: `cd calendario && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add calendario/src/almacen-local.js calendario/tests/almacen-local.test.js
git commit -m "feat: guardado local tolerante a fallas y cola de cambios"
```

---

### Task 7: La base en Cloudflare y el Worker

**Files:**
- Create: `calendario/src/filas.js`, `calendario/src/config.js`
- Create: `calendario/worker/index.js`, `calendario/worker/esquema.sql`, `calendario/wrangler.jsonc`
- Modify: `Proyectos_Claude/CLAVES Y COSAS DE LOS PROYECTOS/` — anotar ahí la llave y la URL
- Test: `calendario/tests/filas.test.js`

**Interfaces:**
- Consumes: `modelo.js`.
- Produces: `aFila(tabla: string, obj: object): object` y `deFila(tabla: string, fila: object): object` en `filas.js`; `API: string` y `LLAVE_GUARDADA: string` (la clave de `localStorage`) en `config.js`. El Worker expone `GET /api/estado` → `Estado` y `POST /api/cambios` con `Cambio[]` → `{aplicados: string[]}`, los dos detrás de la cabecera `Authorization: Llave <secreto>`.

El Worker sirve la app y la API desde el mismo origen, así que `API` es `/api` y no hay CORS. Un solo usuario: no hay tabla de usuarios, lo que protege los datos es la llave.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/filas.test.js`

```js
test('aFila pasa a snake_case lo que la base espera', () => {
  const f = aFila('tomas', toma);
  assert.equal(f.que_hacer, 'Roto del brazo');
  assert.equal(f.dia_origen, '2026-10-18');
});
test('los booleanos viajan como 0 y 1', () => { /* hecha, en_curso */ });
test('graficoValores viaja como texto JSON y vuelve como objeto', () => { /* ida y vuelta */ });
test('deFila(aFila(x)) devuelve x', () => { /* para las tres tablas */ });
test('deFila tolera un grafico_valores nulo o roto', () => { /* null */ });
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `cd calendario && node --test tests/filas.test.js`
Expected: FAIL, `filas.js` no existe.

- [ ] **Step 3: Implementar `filas.js`, el esquema, el Worker y `wrangler.jsonc`**

`esquema.sql`: tres tablas SQLite (`proyectos`, `tomas`, `dias`) con los campos del modelo en `snake_case`, un índice por `dia_actual` y un índice único parcial `una_en_curso on tomas(en_curso) where en_curso = 1`. El Worker compara la llave con `crypto.subtle.timingSafeEqual` sobre los bytes, responde 401 sin cuerpo cuando no coincide, y aplica los cambios con `INSERT ... ON CONFLICT(id) DO UPDATE` en un `batch`. `wrangler.jsonc` ata el binding `DB` a la base y declara los assets estáticos de la carpeta de la app.

- [ ] **Step 4: Correr los tests, crear la base y desplegar**

Run: `cd calendario && npm test`
Expected: PASS

Después: crear la base D1, aplicarle el esquema, generar la llave y guardarla como secreto del Worker, desplegar, y comprobar contra la URL publicada que sin llave contesta 401 y con la llave contesta 200 con las tres listas vacías. Dejar lo comprobado escrito en `worker/verificar-llave.md`.

- [ ] **Step 5: Commit**

```bash
git add calendario/src/filas.js calendario/src/config.js calendario/worker calendario/wrangler.jsonc calendario/tests/filas.test.js
git commit -m "feat: la base en D1 y el Worker que la cuida con una llave"
```

---

### Task 8: La nube y la sincronización

**Files:**
- Create: `calendario/src/nube.js`, `calendario/src/sync.js`
- Test: `calendario/tests/sync.test.js`

**Interfaces:**
- Consumes: `config.js`, `modelo.js`, `almacen-local.js`.
- Produces:
  - `nube.js`: `crearNube({llave, traer}): Nube` con `bajarEstado(): Promise<Estado>`, `subirCambios(cambios: Cambio[]): Promise<string[]>` (devuelve los ids aplicados) y `hayLlave(): boolean`. `traer` es `fetch`, que los tests reemplazan por un doble.
  - `sync.js`: `fusionar(local: Estado, remoto: Estado): Estado`, `sincronizar({almacen, nube}): Promise<{estado: Estado, subio: boolean}>`.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/sync.test.js`

```js
test('fusionar: para la misma fila gana la de actualizado más nuevo', () => { /* ... */ });
test('fusionar: una fila que solo está de un lado sobrevive', () => { /* ... */ });
test('fusionar no duplica filas con el mismo id', () => { /* ... */ });   // Review Focus 3
test('fusionar: el que gana aporta la fila entera, no se mezclan campos', () => {  // Review Focus 3
  // local con detalle viejo y actualizado nuevo -> queda el detalle local entero
});
test('sincronizar sube la cola y la vacía solo con lo que confirmó la nube', () => {
  // la nube acepta 2 de 3 -> el tercero sigue en la cola
});
test('si la nube falla, sincronizar devuelve el estado local y subio=false', () => {  // Review Focus 3
  // nada se pierde de la cola
});
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `cd calendario && npm test -- tests/sync.test.js`
Expected: FAIL

- [ ] **Step 3: Implementar `src/nube.js` y `src/sync.js`**

`nube.js` habla con el Worker por `fetch`, manda la llave en la cabecera `Authorization` y normaliza lo que baja; la traducción de nombres ya la hace el Worker con `filas.js`. `sync.js` no conoce la red: recibe `almacen` y `nube` y trabaja contra sus interfaces, por eso los tests le pasan dobles.

- [ ] **Step 4: Correr los tests y ver que pasan**

Run: `cd calendario && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add calendario/src/nube.js calendario/src/sync.js calendario/tests/sync.test.js calendario/tests/nube.test.js
git commit -m "feat: bajar, subir y fusionar con la última escritura"
```

---

### Task 9: Editar

**Files:**
- Create: `calendario/src/editar.js`
- Modify: `calendario/css/tablero.css` (los controles que aparecen al pasar el mouse o al tocar)
- Test: `calendario/tests/editar.test.js`

**Interfaces:**
- Consumes: `modelo.js`, `dia.js`.
- Produces: `agregarProyecto(estado, {nombre, etiqueta, color}): {estado, cambio}`, `agregarToma(estado, {proyecto, codigo, queHacer, detalle, dia}): {estado, cambio}`, `marcarHecha(estado, tomaId, dia): {estado, cambio}`, `ponerObjetivo(estado, dia, texto): {estado, cambio}`, `borrar(estado, tabla, id): {estado, cambio}`, y `conectar(raiz: HTMLElement, acciones): void` que ata los clicks del tablero a esas funciones.

Las cinco primeras son puras y devuelven también el `Cambio` para la cola. `conectar` es lo único que toca el DOM, con delegación de eventos sobre la raíz.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/editar.test.js`

```js
test('agregarToma la pone en el día pedido y la deja pendiente', () => { /* diaOrigen === diaActual === dia */ });
test('agregarToma devuelve el cambio listo para la cola', () => { /* {tabla:'tomas', borrado:false} */ });
test('marcarHecha anota el día en que se terminó y la saca de en curso', () => { /* hecha, diaHecha, enCurso:false */ });
test('marcarHecha de nuevo la devuelve a pendiente y limpia diaHecha', () => { /* ... */ });
test('borrar un proyecto borra también sus tomas', () => { /* cambios en cascada */ });
test('ponerObjetivo crea el día si no existía', () => { /* ... */ });
test('agregarProyecto no acepta un nombre vacío', () => { /* estado sin tocar, cambio null */ });
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `cd calendario && npm test -- tests/editar.test.js`
Expected: FAIL

- [ ] **Step 3: Implementar `src/editar.js` y los estilos de los controles**

En reposo no se ve ningún botón de editar aparte del punto de marcar hecha, que es parte del dibujo. El resto aparece con `:hover`, `:focus-visible` y, en táctil, al tocar la tarjeta.

- [ ] **Step 4: Correr los tests y ver que pasan**

Run: `cd calendario && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add calendario/src/editar.js calendario/css/tablero.css calendario/tests/editar.test.js
git commit -m "feat: agregar, marcar, editar y borrar sin ensuciar la captura"
```

---

### Task 10: Instalable y offline

**Files:**
- Create: `calendario/app.webmanifest`, `calendario/sw.js`
- Create: `calendario/assets/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
- Create: `calendario/assets/fonts/` (Bricolage Grotesque y Figtree recortadas a latín, woff2)
- Modify: `calendario/index.html` (enlazar manifest y fuentes), `calendario/css/tablero.css` (`@font-face`)
- Test: `calendario/tests/sw.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `listaDeArchivos(): string[]` exportada desde `sw.js` para poder probarla.

Los iconos salen del sprite de RENDER sobre el fondo `#0D0E0C`. Las fuentes se recortan con `pyftsubset`, igual que ya hace el proyecto RENDER.

- [ ] **Step 1: Escribir el test que falla** en `tests/sw.test.js`

```js
test('la lista del service worker nombra todo lo que la app necesita para abrir sola', () => {
  const l = listaDeArchivos();
  for (const f of ['./', './index.html', './css/tablero.css', './src/app.js',
                   './vendor/supabase.js', './assets/render.png'])
    assert.ok(l.includes(f), `falta ${f}`);
});
test('todas las fuentes del css están en la lista', () => { /* leer el css y cruzar */ });
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `cd calendario && npm test -- tests/sw.test.js`
Expected: FAIL

- [ ] **Step 3: Implementar el manifest, el service worker, los iconos y las fuentes**

El service worker cachea todo al instalar y sirve desde el cache primero para los archivos de la app, red primero para Supabase. El manifest va en modo `standalone`, fondo y tema `#0D0E0C`.

- [ ] **Step 4: Correr los tests y probar la instalación**

Run: `cd calendario && npm test`
Expected: PASS
Después: servir la carpeta, instalar la app, cortar la red y ver que abre y muestra el último día.

- [ ] **Step 5: Commit**

```bash
git add calendario/app.webmanifest calendario/sw.js calendario/assets calendario/index.html calendario/css calendario/tests/sw.test.js
git commit -m "feat: PWA instalable que abre sin internet"
```

---

### Task 11: Entrar y arrancar

**Files:**
- Create: `calendario/src/app.js`
- Modify: `calendario/index.html` (la pantalla de entrar)
- Test: `calendario/tests/app.test.js`

**Interfaces:**
- Consumes: todos los módulos anteriores.
- Produces: `decidirArranque({haySesion, hayLocal, hayRed}): 'tablero' | 'entrar' | 'sin-nada'`.

El arranque: leer local y dibujar al toque; en paralelo pedir sesión, bajar, fusionar, arrastrar y volver a dibujar. Nunca una pantalla en blanco esperando la red.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/app.test.js`

```js
test('con sesión y datos locales abre el tablero aunque no haya red', () => {
  assert.equal(decidirArranque({haySesion:true, hayLocal:true, hayRed:false}), 'tablero');
});
test('sin sesión y con red pide entrar', () => {
  assert.equal(decidirArranque({haySesion:false, hayLocal:false, hayRed:true}), 'entrar');
});
test('aparato nuevo sin red no puede hacer nada y lo dice', () => {   // Review Focus 2
  assert.equal(decidirArranque({haySesion:false, hayLocal:false, hayRed:false}), 'sin-nada');
});
test('con sesión pero sin nada local ni red, muestra el tablero vacío, no sin-nada', () => {
  assert.equal(decidirArranque({haySesion:true, hayLocal:false, hayRed:false}), 'tablero');
});
```

- [ ] **Step 2: Correr los tests y ver que fallan**

Run: `cd calendario && npm test -- tests/app.test.js`
Expected: FAIL

- [ ] **Step 3: Implementar `src/app.js` y la pantalla de entrar**

Entrar con mail y contraseña, sesión persistente. `sin-nada` muestra una línea: no hay nada guardado en este aparato y hace falta internet para entrar la primera vez. Si `almacen.puedeGuardar()` es `false`, el tablero avisa en una línea que en este navegador no se guarda nada local.

- [ ] **Step 4: Correr los tests y ver que pasan**

Run: `cd calendario && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add calendario/src/app.js calendario/index.html calendario/tests/app.test.js
git commit -m "feat: entrar una vez por aparato y arrancar sin esperar la red"
```

---

### Task 12: Publicar

**Files:**
- Create: `calendario/.github/workflows/pages.yml`
- Modify: `calendario/README.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la URL pública de la app.

- [ ] **Step 1: Correr la suite entera**

Run: `cd calendario && npm test`
Expected: PASS, sin tests salteados.

- [ ] **Step 2: Crear el repo público y publicarlo**

Repo público en `abelmedinapy`, GitHub Pages desde la rama principal con el workflow. Esperar el primer despliegue.

- [ ] **Step 3: Probar la app publicada en los tres aparatos**

Entrar en la Mac, anotar un día con tres proyectos. Entrar en el celu y ver lo mismo. Instalarla en el celu, poner el aparato en modo avión, marcar una toma como hecha, volver a tener red y ver que el cambio llegó a la Mac.

- [ ] **Step 4: Escribir el README**

Qué es, cómo se corre local, cómo se corren los tests, dónde está el esquema, y que la clave publicable está en el repo a propósito porque lo que protege los datos es RLS.

- [ ] **Step 5: Commit**

```bash
git add calendario/.github calendario/README.md
git commit -m "chore: publicar en GitHub Pages"
```
