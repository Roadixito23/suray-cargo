-- Origen y destino por ciudad. Cada sucursal pertenece a una ciudad y el destino de una venta
-- pasa a ser una CIUDAD (ya no una sucursal): la ven y pueden cobrarla todas las sucursales de esa ciudad.
-- Ejecutar UNA sola vez en el SQL Editor de Supabase, DESPUÉS de parche_04 y ANTES de desplegar el código nuevo.

alter table sucursales add column ciudad text;
-- Ajustar después de ejecutar si alguna sucursal quedó en una ciudad que no corresponde (ver la pantalla Sucursales).
update sucursales set ciudad = nombre;
update sucursales set ciudad = 'Puerto Aysén' where id = 'aysen';
update sucursales set ciudad = 'Coyhaique' where nombre ilike '%coyhaique%';
alter table sucursales alter column ciudad set not null;

-- El destino histórico era el id de una sucursal: pasa a ser el nombre de su ciudad.
-- ventas es inmutable por trigger; este bloque usa la misma bandera que importar_respaldo().
alter table ventas drop constraint ventas_destino_fkey;
do $$
begin
  perform set_config('app.importando', 'on', true);
  update ventas v set destino = s.ciudad from sucursales s where s.id = v.destino;
end;
$$;

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
  if not exists (select 1 from sucursales where ciudad = v ->> 'destino' and activa) then
    raise exception 'destino inválido o inactivo';
  end if;
  if exists (select 1 from sucursales where id = v_sucursal and ciudad = v ->> 'destino') then
    raise exception 'El destino no puede ser la misma ciudad de origen';
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
    insert into sucursales (id, nombre, prefijo, ciudad, activa)
    values (r ->> 'id', r ->> 'nombre', r ->> 'prefijo', coalesce(r ->> 'ciudad', r ->> 'nombre'),
            coalesce((r ->> 'activa')::boolean, true))
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
      r ->> 'descripcion', coalesce((select s.ciudad from sucursales s where s.id = r ->> 'destino'), r ->> 'destino'),
      coalesce(r ->> 'sucursalOrigen', v_suc), r ->> 'item', r ->> 'cantidad',
      r ->> 'tipoProducto', r -> 'tiposArticulos', r ->> 'destinatario', r ->> 'remitente', r ->> 'usuarioId',
      r ->> 'usuarioNombre', coalesce(r ->> 'numeroComprobante', r ->> 'numeroOperacion'),
      coalesce((r ->> 'anulada')::boolean, false), r ->> 'motivoAnulacion',
      (r ->> 'fechaAnulacion')::timestamptz, r ->> 'usuarioAnulacion', r ->> 'tipoVenta',
      (r ->> 'retiroFecha')::timestamptz, r ->> 'retiroNombre', r ->> 'retiroRut', r ->> 'retiroMetodoPago',
      r ->> 'retiroUsuarioId', r ->> 'retiroUsuarioNombre',
      case when r ->> 'retiroFecha' is null then null else coalesce(
        r ->> 'sucursalRetiro',
        (select s.id from sucursales s where s.ciudad = coalesce((select c.ciudad from sucursales c where c.id = r ->> 'destino'), r ->> 'destino') order by s.id limit 1)
      ) end
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
