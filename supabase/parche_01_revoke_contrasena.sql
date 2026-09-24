-- Corrige la fuga del hash: quita el SELECT de tabla y lo da solo por columna.
revoke select on usuarios from anon;
grant select (id, nombre, usuario, es_admin, fecha_creacion, sucursal) on usuarios to anon;
