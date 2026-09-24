// Nombres de campo estables: los respaldos JSON dependen de ellos.

export type Sucursal = 'aysen' | 'coyhaique'
export type MetodoPago = 'efectivo' | 'tarjeta'
export type TipoVenta = 'venta' | 'por_pagar' | 'por_facturar'

export interface TipoArticulo {
  tipo: string
  precio: number
}

export interface Venta {
  id: string
  numeroBoleta: string // AYS-000001 / COY-000001
  monto: number
  metodoPago: MetodoPago
  fecha: string // ISO 8601
  descripcion?: string | null
  destino: Sucursal
  item: string
  cantidad: string
  tipoProducto: string
  tiposArticulos?: TipoArticulo[] | null
  destinatario: string
  remitente: string
  usuarioId: string
  usuarioNombre: string
  numeroOperacion?: string | null
  anulada: boolean
  motivoAnulacion?: string | null
  fechaAnulacion?: string | null
  usuarioAnulacion?: string | null
  tipoVenta: TipoVenta
}

/** Datos que entrega la UI; el número de boleta, id y fecha los asigna la API. */
export type NuevaVenta = Omit<
  Venta,
  'id' | 'numeroBoleta' | 'fecha' | 'anulada' | 'motivoAnulacion' | 'fechaAnulacion' | 'usuarioAnulacion'
> & { sucursalBoleta: Sucursal }

export interface Usuario {
  id: string
  nombre: string
  usuario: string
  /** Hash SHA-256 (hex). Provisorio: el backend real deberá manejar credenciales. */
  contrasena: string
  esAdmin: boolean
  fechaCreacion: string
  sucursal: Sucursal
}

export type UsuarioSesion = Omit<Usuario, 'contrasena'>

/** Para guardar sin tener que leer de vuelta el hash existente (nunca sale por SELECT). */
export type DatosGuardarUsuario = Omit<Usuario, 'contrasena'> & {
  /** null = no cambiar la contraseña actual. */
  contrasenaHash: string | null
}

export type AccionAuditoria =
  | 'login'
  | 'logout'
  | 'crear_venta'
  | 'anular_venta'
  | 'crear_usuario'
  | 'editar_usuario'
  | 'eliminar_usuario'
  | 'crear_respaldo'
  | 'restaurar_respaldo'

export interface RegistroAuditoria {
  id: string
  timestamp: string
  usuarioId: string
  usuarioNombre: string
  accion: AccionAuditoria
  detalles: string
  documentoId?: string | null
  coleccion?: string | null
}

export interface FiltroVentas {
  desde?: Date
  hasta?: Date
  usuarioId?: string
}

export interface FiltroAuditoria {
  usuarioId?: string
  accion?: string
  desde?: Date
  hasta?: Date
  limit?: number
}

export interface Respaldo {
  version: '1.0'
  fecha: string
  ventas: Venta[]
  usuarios: Usuario[]
}
