// Nombres de campo estables: los respaldos JSON dependen de ellos.

export type Sucursal = 'aysen' | 'coyhaique'
export type MetodoPago = 'efectivo' | 'tarjeta' | 'por_pagar'
/** Cómo se cobra una carga Por Pagar al retirarla en destino. */
export type MetodoCobro = 'efectivo' | 'tarjeta'
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
  numeroComprobante?: string | null
  anulada: boolean
  motivoAnulacion?: string | null
  fechaAnulacion?: string | null
  usuarioAnulacion?: string | null
  tipoVenta: TipoVenta
  // Retiro de una carga Por Pagar en la sucursal destino (se completa una sola vez).
  retiroFecha?: string | null
  retiroNombre?: string | null
  retiroRut?: string | null
  retiroMetodoPago?: MetodoCobro | null
  retiroUsuarioId?: string | null
  retiroUsuarioNombre?: string | null
}

export interface DatosRetiro {
  comprobante: string
  nombre: string
  rut: string
  metodoPago: MetodoCobro
  usuarioId: string
  usuarioNombre: string
}

/** Datos que entrega la UI; el número de boleta, id y fecha los asigna la API. */
export type NuevaVenta = Omit<
  Venta,
  | 'id'
  | 'numeroBoleta'
  | 'fecha'
  | 'anulada'
  | 'motivoAnulacion'
  | 'fechaAnulacion'
  | 'usuarioAnulacion'
  | 'retiroFecha'
  | 'retiroNombre'
  | 'retiroRut'
  | 'retiroMetodoPago'
  | 'retiroUsuarioId'
  | 'retiroUsuarioNombre'
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
  | 'retirar_carga'
  | 'anular_venta'
  | 'crear_usuario'
  | 'editar_usuario'
  | 'eliminar_usuario'
  | 'crear_respaldo'
  | 'restaurar_respaldo'
  | 'migrar_usuarios_locales'

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
  /** Amplía el alcance: además de lo propio, incluye las cargas Por Pagar con este destino. */
  porPagarDestino?: Sucursal
  /** Amplía el alcance: además de lo propio, incluye todo envío que llega a esta sucursal. */
  destinoLlegada?: Sucursal
  retiroUsuarioId?: string
  retiroDesde?: Date
  retiroHasta?: Date
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
