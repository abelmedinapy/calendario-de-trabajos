-- Un solo usuario: no hay tabla de usuarios ni columna de dueño. Lo que cuida
-- estos datos es la llave que el Worker pide en cada pedido.

CREATE TABLE IF NOT EXISTS proyectos (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL DEFAULT '',
  etiqueta    TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT 'acid',
  archivado   INTEGER NOT NULL DEFAULT 0,
  pausado     INTEGER NOT NULL DEFAULT 0,
  borrado     INTEGER NOT NULL DEFAULT 0,
  actualizado TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tomas (
  id              TEXT PRIMARY KEY,
  proyecto        TEXT NOT NULL,
  codigo          TEXT NOT NULL DEFAULT '',
  que_hacer       TEXT NOT NULL DEFAULT '',
  detalle         TEXT NOT NULL DEFAULT '',
  dia_origen      TEXT NOT NULL,
  dia_actual      TEXT NOT NULL,
  hecha           INTEGER NOT NULL DEFAULT 0,
  dia_hecha       TEXT,
  en_curso        INTEGER NOT NULL DEFAULT 0,
  grafico         TEXT,
  grafico_valores TEXT,
  orden           INTEGER NOT NULL DEFAULT 0,
  borrado         INTEGER NOT NULL DEFAULT 0,
  actualizado     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS dias (
  fecha       TEXT PRIMARY KEY,
  objetivo    TEXT NOT NULL DEFAULT '',
  render_dice TEXT NOT NULL DEFAULT '',
  borrado     INTEGER NOT NULL DEFAULT 0,
  actualizado TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS tomas_por_dia ON tomas (dia_actual);

-- Borrar deja una lápida (borrado = 1) en vez de sacar la fila: si la fila
-- desapareciera, el otro aparato la volvería a subir en la próxima fusión.

-- Una sola toma en curso a la vez, por regla de la base y no solo de la app.
CREATE UNIQUE INDEX IF NOT EXISTS una_en_curso ON tomas (en_curso) WHERE en_curso = 1;
