-- Un proyecto en pausa sigue a la vista pero no es parte del día: no cuenta en
-- los contadores y lo suyo no se arrastra hacia hoy.

ALTER TABLE proyectos ADD COLUMN pausado INTEGER NOT NULL DEFAULT 0;
