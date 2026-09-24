import { api } from '../api'
import type { AccionAuditoria, UsuarioSesion } from '../types'

/** Registro de auditoría "best effort": un fallo nunca interrumpe la operación principal. */
export async function auditar(
  usuario: Pick<UsuarioSesion, 'id' | 'nombre'> | null,
  accion: AccionAuditoria,
  detalles: string,
  documentoId?: string,
  coleccion?: string,
): Promise<void> {
  try {
    await api.auditoria.registrar({
      usuarioId: usuario?.id ?? 'sistema',
      usuarioNombre: usuario?.nombre ?? 'Sistema',
      accion,
      detalles,
      documentoId: documentoId ?? null,
      coleccion: coleccion ?? null,
    })
  } catch (e) {
    console.error('Error al registrar auditoría', e)
  }
}
