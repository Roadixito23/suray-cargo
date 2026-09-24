import type {
  DatosGuardarUsuario,
  FiltroAuditoria,
  FiltroVentas,
  NuevaVenta,
  RegistroAuditoria,
  Respaldo,
  Sucursal,
  Usuario,
  UsuarioSesion,
  Venta,
} from '../types'

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
    peekNumeroBoleta(sucursal: Sucursal): Promise<string>
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
  respaldo: {
    exportar(): Promise<Respaldo>
    /** Mezcla ventas por id; usuarios excepto `admin`. */
    importar(r: Respaldo): Promise<{ ventas: number; usuarios: number }>
  }
}
