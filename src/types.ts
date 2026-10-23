// Nombres de campo estables: los respaldos JSON dependen de ellos.

/** Id de una sucursal del catálogo (ver `SucursalInfo`). Ya no es un conjunto fijo. */
export type Sucursal = string

/** Nombre de una ciudad. El destino de un envío es una ciudad: lo ve y lo cobra cualquier sucursal de ella. */
export type Ciudad = string

export interface SucursalInfo {
  id: Sucursal
  nombre: string
  /** Ciudad a la que pertenece. No cambia una vez creada la sucursal (los destinos emitidos la usan). */
  ciudad: Ciudad
  /** Prefijo del correlativo de boleta (AYS-000001). No cambia una vez creada la sucursal. */
  prefijo: string
  /** Una sucursal inactiva deja de ofrecerse como origen/destino, pero conserva su historial. */
  activa: boolean
}
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
  /** Sucursal que emitió la boleta y envía la carga. */
  sucursalOrigen: Sucursal
  /** Ciudad de destino (no una sucursal concreta). */
  destino: Ciudad
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
  /** Sucursal donde se cobró (puede estar en otra ciudad que el destino); su caja es la del usuario que cobró. */
  sucursalRetiro?: Sucursal | null
}

export interface DatosRetiro {
  comprobante: string
  nombre: string
  rut: string
  metodoPago: MetodoCobro
  usuarioId: string
  usuarioNombre: string
  sucursal: Sucursal
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
  | 'sucursalRetiro'
  | 'sucursalOrigen'
> & {
  /** Sucursal que emite la boleta: define el prefijo del correlativo y queda como `sucursalOrigen`. */
  sucursalBoleta: Sucursal
}

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
  | 'crear_sucursal'
  | 'editar_sucursal'
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
  /** Amplía el alcance: además de lo propio, incluye las cargas Por Pagar con esta ciudad de destino. */
  porPagarDestino?: Ciudad
  /** Amplía el alcance: además de lo propio, incluye toda carga Por Pagar pendiente, sea cual sea su destino. */
  porPagarCualquierDestino?: boolean
  /** Amplía el alcance: además de lo propio, incluye todo envío que llega a esta ciudad. */
  destinoLlegada?: Ciudad
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
  /** Ausente en respaldos anteriores a las sucursales dinámicas. */
  sucursales?: SucursalInfo[]
}
