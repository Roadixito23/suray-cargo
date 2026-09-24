-- Renombra numero_operacion -> numero_comprobante en una base ya creada y recrea las funciones que la usan.
alter table ventas rename column numero_operacion to numero_comprobante;

create or replace function proteger_venta_inmutable() returns trigger
language plpgsql as $$
begin
  -- importar_respaldo() activa esta bandera para poder restaurar un respaldo completo.
  if current_setting('app.importando', true) = 'on' then
    return new;
  end if;

  if (new.numero_boleta, new.monto, new.metodo_pago, new.fecha, new.destino, new.item, new.cantidad,
      new.tipo_producto, new.tipos_articulos, new.destinatario, new.remitente, new.usuario_id,
      new.usuario_nombre, new.numero_comprobante, new.tipo_venta)
     is distinct from
     (old.numero_boleta, old.monto, old.metodo_pago, old.fecha, old.destino, old.item, old.cantidad,
      old.tipo_producto, old.tipos_articulos, old.destinatario, old.remitente, old.usuario_id,
      old.usuario_nombre, old.numero_comprobante, old.tipo_venta)
  then
    raise exception 'Solo se pueden modificar los campos de anulación de una venta';
  end if;
  return new;
end;
$$;

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
      anulada, motivo_anulacion, fecha_anulacion, usuario_anulacion, tipo_venta
    ) values (
      r ->> 'id', r ->> 'numeroBoleta', (r ->> 'monto')::numeric, r ->> 'metodoPago', (r ->> 'fecha')::timestamptz,
      r ->> 'descripcion', r ->> 'destino', r ->> 'item', r ->> 'cantidad', r ->> 'tipoProducto',
      r -> 'tiposArticulos', r ->> 'destinatario', r ->> 'remitente', r ->> 'usuarioId', r ->> 'usuarioNombre',
      coalesce(r ->> 'numeroComprobante', r ->> 'numeroOperacion'), coalesce((r ->> 'anulada')::boolean, false), r ->> 'motivoAnulacion',
      (r ->> 'fechaAnulacion')::timestamptz, r ->> 'usuarioAnulacion', r ->> 'tipoVenta'
    )
    on conflict (id) do update set
      numero_boleta = excluded.numero_boleta, monto = excluded.monto, metodo_pago = excluded.metodo_pago,
      fecha = excluded.fecha, descripcion = excluded.descripcion, destino = excluded.destino, item = excluded.item,
      cantidad = excluded.cantidad, tipo_producto = excluded.tipo_producto, tipos_articulos = excluded.tipos_articulos,
      destinatario = excluded.destinatario, remitente = excluded.remitente, usuario_id = excluded.usuario_id,
      usuario_nombre = excluded.usuario_nombre, numero_comprobante = excluded.numero_comprobante,
      anulada = excluded.anulada, motivo_anulacion = excluded.motivo_anulacion,
      fecha_anulacion = excluded.fecha_anulacion, usuario_anulacion = excluded.usuario_anulacion,
      tipo_venta = excluded.tipo_venta;
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
