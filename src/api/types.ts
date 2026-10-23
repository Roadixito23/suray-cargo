import type {
  DatosGuardarUsuario,
  DatosRetiro,
  FiltroAuditoria,
  FiltroVentas,
  NuevaVenta,
  RegistroAuditoria,
  Respaldo,
  Sucursal,
  SucursalInfo,
  Usuario,
  UsuarioSesion,
  Venta,
} from '../types'

export interface EstadoConexion {
  /** ok = responde bien; lento = responde pero tarda; error = sin conexión o la base rechaza la consulta. */
  estado: 'ok' | 'lento' | 'error'
  ms: number
  detalle?: string
}

/**
 * Contrato del backend. Hoy lo implementa `localApi` (localStorage) y `httpApi` (Supabase).
 * Cambiar el export en `api/index.ts`. Nada más en la app toca el almacenamiento.
 */
export interface Api {
  ventas: {
    listar(filtro?: FiltroVentas): Promise<Venta[]>
    obtener(id: string): Promise<Venta | null>
    /** Asigna id, fecha y número de boleta correlativo (atómico) y guarda. */
    crear(v: NuevaVenta): Promise<Venta>
    /** Única modificación permitida sobre una venta. */
    anular(id: string, motivo: string, usuarioNombre: string): Promise<Venta>
    /** Registra el retiro de una carga Por Pagar (una sola vez): comprobante, retirante, cobro y fecha de hoy. */
    registrarRetiro(id: string, datos: DatosRetiro): Promise<Venta>
    peekNumeroBoleta(sucursal: Sucursal): Promise<string>
  }
  sucursales: {
    listar(): Promise<SucursalInfo[]>
    /** Crea la sucursal o, si el id ya existe, actualiza nombre y estado (el prefijo no cambia). */
    guardar(s: SucursalInfo): Promise<void>
  }
  usuarios: {
    listar(): Promise<Usuario[]>
    buscarPorLogin(usuario: string): Promise<Usuario | null>
    obtener(id: string): Promise<Usuario | null>
    /** Compara el hash server-side; nunca expone la columna contraseña. */
    verificarLogin(usuario: string, contrasenaHash: string): Promise<UsuarioSesion | null>
    guardar(u: DatosGuardarUsuario): Promise<void>
    eliminar(id: string): Promise<void>
  }
  auditoria: {
    registrar(r: Omit<RegistroAuditoria, 'id' | 'timestamp'>): Promise<void>
    listar(filtro?: FiltroAuditoria): Promise<RegistroAuditoria[]>
  }
  conexion: {
    /** Consulta liviana para saber si la base responde. Nunca lanza: los fallos vuelven como estado 'error'. */
    verificar(): Promise<EstadoConexion>
  }
  respaldo: {
    exportar(): Promise<Respaldo>
    /** Mezcla ventas por id; usuarios excepto `admin`. */
    importar(r: Respaldo): Promise<{ ventas: number; usuarios: number }>
  }
}
