-- Esquema Suray Cargo para Supabase. Ejecutar completo en el SQL Editor del proyecto.
-- Nota de seguridad: la app usa autenticación propia (no Supabase Auth), así que la
-- llave "anon"/"publishable" queda embebida en el bundle público y da acceso equivalente
-- a "cualquier usuario logueado" a estas tablas. Por eso el hash de contraseña NUNCA se
-- expone por SELECT directo: solo sale a través de login_usuario() / exportar_respaldo().
-- No hay separación real por sucursal/rol a nivel de fila (RLS) porque no hay sesión de
-- Supabase que la identifique; eso sigue siendo responsabilidad de la app, igual que hoy.

create extension if not exists pgcrypto;

-- ── Tablas ──────────────────────────────────────────────────────────────────

create table usuarios (
  id text primary key,
  nombre text not null,
  usuario text not null unique,
  contrasena text not null,
  es_admin boolean not null default false,
  fecha_creacion timestamptz not null default now(),
  sucursal text not null check (sucursal in ('aysen', 'coyhaique'))
);

create table ventas (
  id text primary key default gen_random_uuid()::text,
  numero_boleta text not null unique,
  monto numeric not null,
  metodo_pago text not null check (metodo_pago in ('efectivo', 'tarjeta', 'por_pagar')),
  fecha timestamptz not null default now(),
  descripcion text,
  destino text not null check (destino in ('aysen', 'coyhaique')),
  item text not null,
  cantidad text not null,
  tipo_producto text not null,
  tipos_articulos jsonb,
  destinatario text not null,
  remitente text not null,
  usuario_id text not null, -- sin FK: una venta conserva su usuario aunque este se elimine luego
  usuario_nombre text not null,
  numero_comprobante text,
  anulada boolean not null default false,
  motivo_anulacion text,
  fecha_anulacion timestamptz,
  usuario_anulacion text,
  tipo_venta text not null check (tipo_venta in ('venta', 'por_pagar', 'por_facturar')),
  -- Retiro de una carga Por Pagar en el destino (se completa una sola vez, ver trigger).
  retiro_fecha timestamptz,
  retiro_nombre text,
  retiro_rut text,
  retiro_metodo_pago text check (retiro_metodo_pago in ('efectivo', 'tarjeta')),
  retiro_usuario_id text,
  retiro_usuario_nombre text
);

create table auditoria (
  id text primary key default gen_random_uuid()::text,
  "timestamp" timestamptz not null default now(),
  usuario_id text not null,
  usuario_nombre text not null,
  accion text not null,
  detalles text not null,
  documento_id text,
  coleccion text
);

create table contadores (
  sucursal text primary key check (sucursal in ('aysen', 'coyhaique')),
  valor integer not null default 0
);
insert into contadores (sucursal, valor) values ('aysen', 0), ('coyhaique', 0);

-- Usuario inicial: admin / admin (mismo hash que usa la app para "admin").
insert into usuarios (id, nombre, usuario, contrasena, es_admin, sucursal)
values ('admin', 'Administrador', 'admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', true, 'aysen');

-- ── Regla de negocio: una venta solo se puede "anular", nunca editar/borrar ─────

create or replace function proteger_venta_inmutable() returns trigger
language plpgsql as $$
begin
  -- importar_respaldo() activa esta bandera para poder restaurar un respaldo completo.
  if current_setting('app.importando', true) = 'on' then
    return new;
  end if;

  if (new.numero_boleta, new.monto, new.metodo_pago, new.fecha, new.destino, new.item, new.cantidad,
      new.tipo_producto, new.tipos_articulos, new.destinatario, new.remitente, new.usuario_id,
      new.usuario_nombre, new.tipo_venta)
     is distinct from
     (old.numero_boleta, old.monto, old.metodo_pago, old.fecha, old.destino, old.item, old.cantidad,
      old.tipo_producto, old.tipos_articulos, old.destinatario, old.remitente, old.usuario_id,
      old.usuario_nombre, old.tipo_venta)
  then
    raise exception 'Solo se pueden modificar los campos de anulación y de retiro de una venta';
  end if;

  -- Comprobante y datos de retiro: solo se completan una vez, en una carga Por Pagar vigente y aún sin retirar.
  if (new.numero_comprobante, new.retiro_fecha, new.retiro_nombre, new.retiro_rut, new.retiro_metodo_pago,
      new.retiro_usuario_id, new.retiro_usuario_nombre)
     is distinct from
     (old.numero_comprobante, old.retiro_fecha, old.retiro_nombre, old.retiro_rut, old.retiro_metodo_pago,
      old.retiro_usuario_id, old.retiro_usuario_nombre)
     and not (old.tipo_venta = 'por_pagar' and old.retiro_fecha is null and not old.anulada)
  then
    raise exception 'La carga no admite registrar un retiro (no es Por Pagar, está anulada o ya fue retirada)';
  end if;
  return new;
end;
$$;

create trigger trg_proteger_venta before update on ventas
for each row execute function proteger_venta_inmutable();

-- ── RLS + privilegios de columna ────────────────────────────────────────────

alter table usuarios enable row level security;
alter table ventas enable row level security;
alter table auditoria enable row level security;
alter table contadores enable row level security;

create policy usuarios_acceso on usuarios for all to anon using (true) with check (true);
create policy ventas_select on ventas for select to anon using (true);
create policy ventas_insert on ventas for insert to anon with check (true);
create policy ventas_update on ventas for update to anon using (true) with check (true);
-- Sin policy de delete: nadie (ni anon) puede borrar ventas.
create policy auditoria_acceso on auditoria for all to anon using (true) with check (true);
create policy contadores_select on contadores for select to anon using (true);

revoke all on ventas from anon;
grant select, insert, update on ventas to anon; -- sin delete
revoke all on usuarios from anon;
-- SELECT solo sobre columnas concretas: un REVOKE de columna no sirve si hay GRANT SELECT de tabla.
grant select (id, nombre, usuario, es_admin, fecha_creacion, sucursal) on usuarios to anon; -- el hash nunca sale por un SELECT directo
grant insert, update, delete on usuarios to anon;
grant select, insert on auditoria to anon;
grant select on contadores to anon;

-- ── Funciones (security definer: corren con permisos del dueño, no del cliente) ─

-- Login: compara el hash server-side y jamás devuelve la columna contrasena.
create or replace function login_usuario(p_usuario text, p_hash text)
returns table (id text, nombre text, usuario text, es_admin boolean, fecha_creacion timestamptz, sucursal text)
language sql security definer as $$
  select u.id, u.nombre, u.usuario, u.es_admin, u.fecha_creacion, u.sucursal
  from usuarios u
  where u.usuario = p_usuario and u.contrasena = p_hash;
$$;
grant execute on function login_usuario(text, text) to anon;

-- Boleta correlativa por sucursal: incrementa y arma el número en una sola transacción.
create or replace function crear_venta(v jsonb) returns ventas
language plpgsql security definer as $$
declare
  v_sucursal text := v ->> 'sucursalBoleta';
  v_prefijo text := case v_sucursal when 'aysen' then 'AYS' when 'coyhaique' then 'COY' else null end;
  v_num int;
  fila ventas;
begin
  if v_prefijo is null then
    raise exception 'sucursalBoleta inválida';
  end if;

  update contadores set valor = valor + 1 where sucursal = v_sucursal returning valor into v_num;

  insert into ventas (
    numero_boleta, monto, metodo_pago, descripcion, destino, item, cantidad, tipo_producto,
    tipos_articulos, destinatario, remitente, usuario_id, usuario_nombre, numero_comprobante, tipo_venta
  ) values (
    v_prefijo || '-' || lpad(v_num::text, 6, '0'), (v ->> 'monto')::numeric, v ->> 'metodoPago',
    v ->> 'descripcion', v ->> 'destino', v ->> 'item', v ->> 'cantidad', v ->> 'tipoProducto',
    v -> 'tiposArticulos', v ->> 'destinatario', v ->> 'remitente', v ->> 'usuarioId',
    v ->> 'usuarioNombre', v ->> 'numeroComprobante', v ->> 'tipoVenta'
  ) returning * into fila;

  return fila;
end;
$$;
grant execute on function crear_venta(jsonb) to anon;

-- Vista previa del próximo número de boleta, sin consumirlo.
create or replace function peek_boleta(p_sucursal text) returns text
language sql security definer as $$
  select
    (case p_sucursal when 'aysen' then 'AYS' when 'coyhaique' then 'COY' else null end)
    || '-' || lpad((valor + 1)::text, 6, '0')
  from contadores where sucursal = p_sucursal;
$$;
grant execute on function peek_boleta(text) to anon;

-- Respaldo JSON completo (incluye hashes de contraseña): única vía de lectura de contrasena.
create or replace function exportar_respaldo() returns jsonb
language sql security definer as $$
  select jsonb_build_object(
    'version', '1.0',
    'fecha', now(),
    'ventas', (select coalesce(jsonb_agg(v), '[]'::jsonb) from ventas v),
    'usuarios', (select coalesce(jsonb_agg(u), '[]'::jsonb) from usuarios u)
  );
$$;
grant execute on function exportar_respaldo() to anon;

-- Restaura un respaldo completo: mezcla por id (upsert), nunca toca el usuario "admin",
-- y reconstruye el contador de boletas a partir de los números importados.
create or replace function importar_respaldo(p_datos jsonb) returns jsonb
language plpgsql security definer as $$
declare
  r jsonb;
  v_num_ventas int := 0;
  v_num_usuarios int := 0;
  v_pref text;
  v_suc text;
  v_num int;
begin
  perform set_config('app.importando', 'on', true);

  for r in select * from jsonb_array_elements(coalesce(p_datos -> 'usuarios', '[]'::jsonb)) loop
    if r ->> 'usuario' = 'admin' then continue; end if;
    insert into usuarios (id, nombre, usuario, contrasena, es_admin, fecha_creacion, sucursal)
    values (
      r ->> 'id', r ->> 'nombre', r ->> 'usuario', r ->> 'contrasena',
      coalesce((r ->> 'esAdmin')::boolean, false), coalesce((r ->> 'fechaCreacion')::timestamptz, now()),
      r ->> 'sucursal'
    )
    on conflict (id) do update set
      nombre = excluded.nombre, usuario = excluded.usuario, contrasena = excluded.contrasena,
      es_admin = excluded.es_admin, sucursal = excluded.sucursal;
    v_num_usuarios := v_num_usuarios + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_datos -> 'ventas', '[]'::jsonb)) loop
    insert into ventas (
      id, numero_boleta, monto, metodo_pago, fecha, descripcion, destino, item, cantidad, tipo_producto,
      tipos_articulos, destinatario, remitente, usuario_id, usuario_nombre, numero_comprobante,
      anulada, motivo_anulacion, fecha_anulacion, usuario_anulacion, tipo_venta,
      retiro_fecha, retiro_nombre, retiro_rut, retiro_metodo_pago, retiro_usuario_id, retiro_usuario_nombre
    ) values (
      r ->> 'id', r ->> 'numeroBoleta', (r ->> 'monto')::numeric, r ->> 'metodoPago', (r ->> 'fecha')::timestamptz,
      r ->> 'descripcion', r ->> 'destino', r ->> 'item', r ->> 'cantidad', r ->> 'tipoProducto',
      r -> 'tiposArticulos', r ->> 'destinatario', r ->> 'remitente', r ->> 'usuarioId', r ->> 'usuarioNombre',
      coalesce(r ->> 'numeroComprobante', r ->> 'numeroOperacion'), coalesce((r ->> 'anulada')::boolean, false), r ->> 'motivoAnulacion',
      (r ->> 'fechaAnulacion')::timestamptz, r ->> 'usuarioAnulacion', r ->> 'tipoVenta',
      (r ->> 'retiroFecha')::timestamptz, r ->> 'retiroNombre', r ->> 'retiroRut', r ->> 'retiroMetodoPago',
      r ->> 'retiroUsuarioId', r ->> 'retiroUsuarioNombre'
    )
    on conflict (id) do update set
      numero_boleta = excluded.numero_boleta, monto = excluded.monto, metodo_pago = excluded.metodo_pago,
      fecha = excluded.fecha, descripcion = excluded.descripcion, destino = excluded.destino, item = excluded.item,
      cantidad = excluded.cantidad, tipo_producto = excluded.tipo_producto, tipos_articulos = excluded.tipos_articulos,
      destinatario = excluded.destinatario, remitente = excluded.remitente, usuario_id = excluded.usuario_id,
      usuario_nombre = excluded.usuario_nombre, numero_comprobante = excluded.numero_comprobante,
      anulada = excluded.anulada, motivo_anulacion = excluded.motivo_anulacion,
      fecha_anulacion = excluded.fecha_anulacion, usuario_anulacion = excluded.usuario_anulacion,
      tipo_venta = excluded.tipo_venta, retiro_fecha = excluded.retiro_fecha, retiro_nombre = excluded.retiro_nombre,
      retiro_rut = excluded.retiro_rut, retiro_metodo_pago = excluded.retiro_metodo_pago,
      retiro_usuario_id = excluded.retiro_usuario_id, retiro_usuario_nombre = excluded.retiro_usuario_nombre;
    v_num_ventas := v_num_ventas + 1;

    v_pref := split_part(r ->> 'numeroBoleta', '-', 1);
    v_suc := case v_pref when 'AYS' then 'aysen' when 'COY' then 'coyhaique' else null end;
    v_num := nullif(split_part(r ->> 'numeroBoleta', '-', 2), '')::int;
    if v_suc is not null and v_num is not null then
      update contadores set valor = greatest(valor, v_num) where sucursal = v_suc;
    end if;
  end loop;

  return jsonb_build_object('ventas', v_num_ventas, 'usuarios', v_num_usuarios);
end;
$$;
grant execute on function importar_respaldo(jsonb) to anon;
