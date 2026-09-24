import { supabase } from './supabaseClient'
import type { Api } from './types'
import type { FiltroAuditoria, FiltroVentas, RegistroAuditoria, Sucursal, Usuario, Venta } from '../types'

// Nunca se selecciona la columna "contrasena": el privilegio SELECT sobre ella
// está revocado para el rol `anon` en la base (ver supabase/schema.sql).
const COLUMNAS_USUARIO = 'id, nombre, usuario, es_admin, fecha_creacion, sucursal'
const COLUMNAS_VENTA =
  'id, numero_boleta, monto, metodo_pago, fecha, descripcion, destino, item, cantidad, tipo_producto,' +
  ' tipos_articulos, destinatario, remitente, usuario_id, usuario_nombre, numero_operacion, anulada,' +
  ' motivo_anulacion, fecha_anulacion, usuario_anulacion, tipo_venta'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filaAVenta(f: any): Venta {
  return {
    id: f.id,
    numeroBoleta: f.numero_boleta,
    monto: Number(f.monto),
    metodoPago: f.metodo_pago,
    fecha: f.fecha,
    descripcion: f.descripcion,
    destino: f.destino,
    item: f.item,
    cantidad: f.cantidad,
    tipoProducto: f.tipo_producto,
    tiposArticulos: f.tipos_articulos,
    destinatario: f.destinatario,
    remitente: f.remitente,
    usuarioId: f.usuario_id,
    usuarioNombre: f.usuario_nombre,
    numeroOperacion: f.numero_operacion,
    anulada: f.anulada,
    motivoAnulacion: f.motivo_anulacion,
    fechaAnulacion: f.fecha_anulacion,
    usuarioAnulacion: f.usuario_anulacion,
    tipoVenta: f.tipo_venta,
  }
}

// El hash jamás llega aquí (columna no seleccionable); se deja vacío y nunca se muestra.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filaAUsuario(f: any): Usuario {
  return {
    id: f.id,
    nombre: f.nombre,
    usuario: f.usuario,
    contrasena: '',
    esAdmin: f.es_admin,
    fechaCreacion: f.fecha_creacion,
    sucursal: f.sucursal,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filaARegistro(f: any): RegistroAuditoria {
  return {
    id: f.id,
    timestamp: f.timestamp,
    usuarioId: f.usuario_id,
    usuarioNombre: f.usuario_nombre,
    accion: f.accion,
    detalles: f.detalles,
    documentoId: f.documento_id,
    coleccion: f.coleccion,
  }
}

export const httpApi: Api = {
  ventas: {
    async listar(filtro: FiltroVentas = {}) {
      let q = supabase.from('ventas').select(COLUMNAS_VENTA).order('fecha', { ascending: false })
      if (filtro.desde) q = q.gte('fecha', filtro.desde.toISOString())
      if (filtro.hasta) q = q.lte('fecha', filtro.hasta.toISOString())
      if (filtro.usuarioId) q = q.eq('usuario_id', filtro.usuarioId)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return (data ?? []).map(filaAVenta)
    },

    async obtener(id) {
      const { data, error } = await supabase.from('ventas').select(COLUMNAS_VENTA).eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? filaAVenta(data) : null
    },

    async crear(nueva) {
      // El correlativo de boleta se asigna atómicamente en el servidor (evita choques entre usuarios).
      const { data, error } = await supabase.rpc('crear_venta', { v: nueva })
      if (error) throw new Error(error.message)
      return filaAVenta(data)
    },

    async anular(id, motivo, usuarioNombre) {
      const { data, error } = await supabase
        .from('ventas')
        .update({
          anulada: true,
          motivo_anulacion: motivo,
          fecha_anulacion: new Date().toISOString(),
          usuario_anulacion: usuarioNombre,
        })
        .eq('id', id)
        .select(COLUMNAS_VENTA)
        .single()
      if (error) throw new Error(error.message)
      return filaAVenta(data)
    },

    async peekNumeroBoleta(sucursal: Sucursal) {
      const { data, error } = await supabase.rpc('peek_boleta', { p_sucursal: sucursal })
      if (error) throw new Error(error.message)
      return data as string
    },
  },

  usuarios: {
    async listar() {
      const { data, error } = await supabase.from('usuarios').select(COLUMNAS_USUARIO)
      if (error) throw new Error(error.message)
      return (data ?? []).map(filaAUsuario)
    },

    async buscarPorLogin(login) {
      const { data, error } = await supabase
        .from('usuarios')
        .select(COLUMNAS_USUARIO)
        .eq('usuario', login)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data ? filaAUsuario(data) : null
    },

    async obtener(id) {
      const { data, error } = await supabase.from('usuarios').select(COLUMNAS_USUARIO).eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      return data ? filaAUsuario(data) : null
    },

    async verificarLogin(login, hash) {
      // RPC security definer: compara el hash en el servidor y jamás devuelve la columna contrasena.
      const { data, error } = await supabase.rpc('login_usuario', { p_usuario: login, p_hash: hash })
      if (error) throw new Error(error.message)
      const fila = Array.isArray(data) ? data[0] : null
      return fila ? filaAUsuario(fila) : null
    },

    async guardar(datos) {
      const { contrasenaHash, ...resto } = datos
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fila: Record<string, any> = {
        id: resto.id,
        nombre: resto.nombre,
        usuario: resto.usuario,
        es_admin: resto.esAdmin,
        sucursal: resto.sucursal,
        fecha_creacion: resto.fechaCreacion,
      }
      // Se omite la columna si es null: el UPDATE no la toca y conserva el hash actual.
      if (contrasenaHash) fila.contrasena = contrasenaHash
      // No se usa upsert: ON CONFLICT DO UPDATE exige SELECT sobre "contrasena" (revocado para anon)
      // y su INSERT choca con NOT NULL cuando se edita sin cambiar la clave.
      const { data: actualizadas, error } = await supabase
        .from('usuarios')
        .update(fila)
        .eq('id', fila.id)
        .select('id')
      if (error) throw new Error(error.message)
      if (actualizadas.length > 0) return
      if (!contrasenaHash) throw new Error('Un usuario nuevo requiere contraseña')
      const { error: errorInsert } = await supabase.from('usuarios').insert(fila)
      if (errorInsert) throw new Error(errorInsert.message)
    },

    async eliminar(id) {
      const { error } = await supabase.from('usuarios').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
  },

  auditoria: {
    async registrar(r) {
      const { error } = await supabase.from('auditoria').insert({
        usuario_id: r.usuarioId,
        usuario_nombre: r.usuarioNombre,
        accion: r.accion,
        detalles: r.detalles,
        documento_id: r.documentoId,
        coleccion: r.coleccion,
      })
      if (error) throw new Error(error.message)
    },

    async listar(filtro: FiltroAuditoria = {}) {
      let q = supabase
        .from('auditoria')
        .select('id, timestamp, usuario_id, usuario_nombre, accion, detalles, documento_id, coleccion')
        .order('timestamp', { ascending: false })
        .limit(filtro.limit ?? 200)
      if (filtro.usuarioId) q = q.eq('usuario_id', filtro.usuarioId)
      if (filtro.accion) q = q.eq('accion', filtro.accion)
      if (filtro.desde) q = q.gte('timestamp', filtro.desde.toISOString())
      if (filtro.hasta) q = q.lte('timestamp', filtro.hasta.toISOString())
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return (data ?? []).map(filaARegistro)
    },
  },

  respaldo: {
    async exportar() {
      // Única vía que sí puede leer los hashes de contraseña (RPC security definer, ver schema.sql).
      const { data, error } = await supabase.rpc('exportar_respaldo')
      if (error) throw new Error(error.message)
      return {
        version: '1.0',
        fecha: data.fecha,
        ventas: (data.ventas ?? []).map(filaAVenta),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        usuarios: (data.usuarios ?? []).map((f: any) => ({ ...filaAUsuario(f), contrasena: f.contrasena })),
      }
    },

    async importar(r) {
      if (!Array.isArray(r?.ventas) || !Array.isArray(r?.usuarios)) {
        throw new Error('Archivo de respaldo inválido')
      }
      // RPC security definer: mezcla por id y reconstruye el contador de boletas atómicamente.
      const { data, error } = await supabase.rpc('importar_respaldo', { p_datos: r })
      if (error) throw new Error(error.message)
      return { ventas: data.ventas, usuarios: data.usuarios }
    },
  },
}
