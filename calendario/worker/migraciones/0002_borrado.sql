-- Las lápidas: borrar marca la fila en vez de sacarla, para que el otro
-- aparato se entere y el arrastre no la reviva al día siguiente.

ALTER TABLE proyectos ADD COLUMN borrado INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tomas     ADD COLUMN borrado INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dias      ADD COLUMN borrado INTEGER NOT NULL DEFAULT 0;
