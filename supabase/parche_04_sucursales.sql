-- Sucursales dinámicas + sucursal de origen y de cobro en cada venta.
-- Ejecutar UNA sola vez en el SQL Editor de Supabase, ANTES de desplegar el código nuevo.
-- Después, crear las sucursales nuevas desde la app (Administración → Sucursales).

-- ── Catálogo ───────────────────────────────────────────────────────────────────
create table sucursales (
  id text primary key check (id ~ '^[a-z0-9_]{2,30}$'),
  nombre text not null,
  prefijo text not null unique check (prefijo ~ '^[A-Z0-9]{2,4}$'),
  activa boolean not null default true
);
insert into sucursales (id, nombre, prefijo) values ('aysen', 'Aysén', 'AYS'), ('coyhaique', 'Coyhaique', 'COY');

-- Cada sucursal nueva recibe su contador de boletas.
create or replace function crear_contador_sucursal() returns trigger
language plpgsql security definer as $$
begin
  insert into contadores (sucursal, valor) values (new.id, 0) on conflict do nothing;
  return new;
end;
$$;
create trigger trg_contador_sucursal after insert on sucursales
for each row execute function crear_contador_sucursal();

alter table sucursales enable row level security;
create policy sucursales_select on sucursales for select to anon using (true);
create policy sucursales_insert on sucursales for insert to anon with check (true);
create policy sucursales_update on sucursales for update to anon using (true) with check (true);
revoke all on sucursales from anon;
grant select, insert, update on sucursales to anon; -- sin delete: se desactivan

-- ── Los check fijos pasan a claves foráneas ────────────────────────────────────
alter table usuarios drop constraint usuarios_sucursal_check;
alter table usuarios add constraint usuarios_sucursal_fkey foreign key (sucursal) references sucursales (id);

alter table contadores drop constraint contadores_sucursal_check;
alter table contadores add constraint contadores_sucursal_fkey foreign key (sucursal) references sucursales (id);

alter table ventas drop constraint ventas_destino_check;
alter table ventas add constraint ventas_destino_fkey foreign key (destino) references sucursales (id);

-- ── Origen y sucursal de cobro de cada venta ───────────────────────────────────
-- Se rellenan ANTES de reemplazar el trigger de inmutabilidad (que hoy no las conoce).
alter table ventas add column sucursal_origen text references sucursales (id);
alter table ventas add column sucursal_retiro text references sucursales (id);

-- Origen: el prefijo de la boleta (AYS-000001) identifica la sucursal que la emitió.
update ventas v set sucursal_origen = s.id
from sucursales s
where s.prefijo = split_part(v.numero_boleta, '-', 1);

-- Cobro: la sucursal del usuario que registró el retiro; si ya no existe, el destino.
update ventas v set sucursal_retiro = u.sucursal
from usuarios u
where v.retiro_fecha is not null and u.id = v.retiro_usuario_id;
update ventas set sucursal_retiro = destino where retiro_fecha is not null and sucursal_retiro is null;

-- Falla (y revierte) si alguna boleta tiene un prefijo desconocido.
alter table ventas alter column sucursal_origen set not null;

-- ── Trigger de inmutabilidad: el origen no se toca; la sucursal de cobro solo al retirar ──
create or replace function proteger_venta_inmutable() returns trigger
language plpgsql as $$
begin
  -- importar_respaldo() activa esta bandera para poder restaurar un respaldo completo.
  if current_setting('app.importando', true) = 'on' then
    return new;
  end if;

  if (new.numero_boleta, new.monto, new.metodo_pago, new.fecha, new.destino, new.sucursal_origen, new.item,
      new.cantidad, new.tipo_producto, new.tipos_articulos, new.destinatario, new.remitente, new.usuario_id,
      new.usuario_nombre, new.tipo_venta)
     is distinct from
     (old.numero_boleta, old.monto, old.metodo_pago, old.fecha, old.destino, old.sucursal_origen, old.item,
      old.cantidad, old.tipo_producto, old.tipos_articulos, old.destinatario, old.remitente, old.usuario_id,
      old.usuario_nombre, old.tipo_venta)
  then
    raise exception 'Solo se pueden modificar los campos de anulación y de retiro de una venta';
  end if;

  -- Comprobante y datos de retiro: solo se completan una vez, en una carga Por Pagar vigente y aún sin retirar.
  if (new.numero_comprobante, new.retiro_fecha, new.retiro_nombre, new.retiro_rut, new.retiro_metodo_pago,
      new.retiro_usuario_id, new.retiro_usuario_nombre, new.sucursal_retiro)
     is distinct from
     (old.numero_comprobante, old.retiro_fecha, old.retiro_nombre, old.retiro_rut, old.retiro_metodo_pago,
      old.retiro_usuario_id, old.retiro_usuario_nombre, old.sucursal_retiro)
     and not (old.tipo_venta = 'por_pagar' and old.retiro_fecha is null and not old.anulada)
  then
    raise exception 'La carga no admite registrar un retiro (no es Por Pagar, está anulada o ya fue retirada)';
  end if;
  return new;
end;
$$;

-- ── Funciones: el prefijo sale del catálogo, ya no de un case fijo ─────────────
create or replace function crear_venta(v jsonb) returns ventas
language plpgsql security definer as $$
declare
  v_sucursal text := v ->> 'sucursalBoleta';
  v_prefijo text;
  v_num int;
  fila ventas;
begin
  select prefijo into v_prefijo from sucursales where id = v_sucursal and activa;
  if v_prefijo is null then
    raise exception 'sucursalBoleta inválida o inactiva';
  end if;
  if not exists (select 1 from sucursales where id = v ->> 'destino' and activa) then
    raise exception 'destino inválido o inactivo';
  end if;

  update contadores set valor = valor + 1 where sucursal = v_sucursal returning valor into v_num;

  insert into ventas (
    numero_boleta, monto, metodo_pago, descripcion, destino, sucursal_origen, item, cantidad, tipo_producto,
    tipos_articulos, destinatario, remitente, usuario_id, usuario_nombre, numero_comprobante, tipo_venta
  ) values (
    v_prefijo || '-' || lpad(v_num::text, 6, '0'), (v ->> 'monto')::numeric, v ->> 'metodoPago',
    v ->> 'descripcion', v ->> 'destino', v_sucursal, v ->> 'item', v ->> 'cantidad', v ->> 'tipoProducto',
    v -> 'tiposArticulos', v ->> 'destinatario', v ->> 'remitente', v ->> 'usuarioId',
    v ->> 'usuarioNombre', v ->> 'numeroComprobante', v ->> 'tipoVenta'
  ) returning * into fila;

  return fila;
end;
$$;
grant execute on function crear_venta(jsonb) to anon;

create or replace function peek_boleta(p_sucursal text) returns text
language sql security definer as $$
  select s.prefijo || '-' || lpad((c.valor + 1)::text, 6, '0')
  from contadores c join sucursales s on s.id = c.sucursal
  where c.sucursal = p_sucursal;
$$;
grant execute on function peek_boleta(text) to anon;

create or replace function exportar_respaldo() returns jsonb
language sql security definer as $$
  select jsonb_build_object(
    'version', '1.0',
    'fecha', now(),
    'ventas', (select coalesce(jsonb_agg(v), '[]'::jsonb) from ventas v),
    'usuarios', (select coalesce(jsonb_agg(u), '[]'::jsonb) from usuarios u),
    'sucursales', (select coalesce(jsonb_agg(s), '[]'::jsonb) from sucursales s)
  );
$$;
grant execute on function exportar_respaldo() to anon;

create or replace function importar_respaldo(p_datos jsonb) returns jsonb
language plpgsql security definer as $$
declare
  r jsonb;
  v_num_ventas int := 0;
  v_num_usuarios int := 0;
  v_suc text;
  v_num int;
begin
  perform set_config('app.importando', 'on', true);

  -- Primero las sucursales: usuarios y ventas dependen de ellas (el trigger crea sus contadores).
  for r in select * from jsonb_array_elements(coalesce(p_datos -> 'sucursales', '[]'::jsonb)) loop
    insert into sucursales (id, nombre, prefijo, activa)
    values (r ->> 'id', r ->> 'nombre', r ->> 'prefijo', coalesce((r ->> 'activa')::boolean, true))
    on conflict (id) do update set nombre = excluded.nombre, activa = excluded.activa;
  end loop;

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
    -- Respaldos anteriores no traen sucursalOrigen: se deduce del prefijo de la boleta.
    select s.id into v_suc from sucursales s where s.prefijo = split_part(r ->> 'numeroBoleta', '-', 1);

    insert into ventas (
      id, numero_boleta, monto, metodo_pago, fecha, descripcion, destino, sucursal_origen, item, cantidad,
      tipo_producto, tipos_articulos, destinatario, remitente, usuario_id, usuario_nombre, numero_comprobante,
      anulada, motivo_anulacion, fecha_anulacion, usuario_anulacion, tipo_venta,
      retiro_fecha, retiro_nombre, retiro_rut, retiro_metodo_pago, retiro_usuario_id, retiro_usuario_nombre,
      sucursal_retiro
    ) values (
      r ->> 'id', r ->> 'numeroBoleta', (r ->> 'monto')::numeric, r ->> 'metodoPago', (r ->> 'fecha')::timestamptz,
      r ->> 'descripcion', r ->> 'destino', coalesce(r ->> 'sucursalOrigen', v_suc), r ->> 'item', r ->> 'cantidad',
      r ->> 'tipoProducto', r -> 'tiposArticulos', r ->> 'destinatario', r ->> 'remitente', r ->> 'usuarioId',
      r ->> 'usuarioNombre', coalesce(r ->> 'numeroComprobante', r ->> 'numeroOperacion'),
      coalesce((r ->> 'anulada')::boolean, false), r ->> 'motivoAnulacion',
      (r ->> 'fechaAnulacion')::timestamptz, r ->> 'usuarioAnulacion', r ->> 'tipoVenta',
      (r ->> 'retiroFecha')::timestamptz, r ->> 'retiroNombre', r ->> 'retiroRut', r ->> 'retiroMetodoPago',
      r ->> 'retiroUsuarioId', r ->> 'retiroUsuarioNombre',
      case when r ->> 'retiroFecha' is null then null else coalesce(r ->> 'sucursalRetiro', r ->> 'destino') end
    )
    on conflict (id) do update set
      numero_boleta = excluded.numero_boleta, monto = excluded.monto, metodo_pago = excluded.metodo_pago,
      fecha = excluded.fecha, descripcion = excluded.descripcion, destino = excluded.destino,
      sucursal_origen = excluded.sucursal_origen, item = excluded.item,
      cantidad = excluded.cantidad, tipo_producto = excluded.tipo_producto, tipos_articulos = excluded.tipos_articulos,
      destinatario = excluded.destinatario, remitente = excluded.remitente, usuario_id = excluded.usuario_id,
      usuario_nombre = excluded.usuario_nombre, numero_comprobante = excluded.numero_comprobante,
      anulada = excluded.anulada, motivo_anulacion = excluded.motivo_anulacion,
      fecha_anulacion = excluded.fecha_anulacion, usuario_anulacion = excluded.usuario_anulacion,
      tipo_venta = excluded.tipo_venta, retiro_fecha = excluded.retiro_fecha, retiro_nombre = excluded.retiro_nombre,
      retiro_rut = excluded.retiro_rut, retiro_metodo_pago = excluded.retiro_metodo_pago,
      retiro_usuario_id = excluded.retiro_usuario_id, retiro_usuario_nombre = excluded.retiro_usuario_nombre,
      sucursal_retiro = excluded.sucursal_retiro;
    v_num_ventas := v_num_ventas + 1;

    v_num := nullif(split_part(r ->> 'numeroBoleta', '-', 2), '')::int;
    if v_suc is not null and v_num is not null then
      update contadores set valor = greatest(valor, v_num) where sucursal = v_suc;
    end if;
  end loop;

  return jsonb_build_object('ventas', v_num_ventas, 'usuarios', v_num_usuarios);
end;
$$;
grant execute on function importar_respaldo(jsonb) to anon;
