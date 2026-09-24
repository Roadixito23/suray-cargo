import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { aInputDate, desdeInputDate, finDelDia } from '../lib/fechas'
import { formatoFechaHora } from '../lib/format'
import type { RegistroAuditoria, Usuario } from '../types'

const ACCIONES: Record<string, string> = {
  login: 'Inicio de sesión',
  logout: 'Cierre de sesión',
  crear_venta: 'Venta creada',
  anular_venta: 'Venta anulada',
  crear_usuario: 'Usuario creado',
  editar_usuario: 'Usuario editado',
  eliminar_usuario: 'Usuario eliminado',
  crear_respaldo: 'Respaldo creado',
  restaurar_respaldo: 'Respaldo restaurado',
  migrar_usuarios_locales: 'Usuarios locales migrados',
}

export function AuditoriaPage() {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usuarioId, setUsuarioId] = useState('')
  const [accion, setAccion] = useState('')
  const [desde, setDesde] = useState(aInputDate(new Date(Date.now() - 7 * 86_400_000)))
  const [hasta, setHasta] = useState(aInputDate(new Date()))

  useEffect(() => {
    api.usuarios.listar().then(setUsuarios)
  }, [])

  const cargar = useCallback(() => {
    const h = desdeInputDate(hasta)
    api.auditoria
      .listar({ usuarioId: usuarioId || undefined, accion: accion || undefined, desde: desdeInputDate(desde), hasta: h ? finDelDia(h) : undefined })
      .then(setRegistros)
  }, [usuarioId, accion, desde, hasta])

  useEffect(cargar, [cargar])

  return (
    <div className="panel">
      <div className="filtros">
        <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} aria-label="Usuario">
          <option value="">Todos los usuarios</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <select value={accion} onChange={(e) => setAccion(e.target.value)} aria-label="Acción">
          <option value="">Todas las acciones</option>
          {Object.entries(ACCIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label>Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label>Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
        <button className="btn" onClick={cargar}>Actualizar</button>
      </div>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.id}>
                <td>{formatoFechaHora(r.timestamp)}</td>
                <td>{r.usuarioNombre}</td>
                <td><span className="badge">{ACCIONES[r.accion] ?? r.accion}</span></td>
                <td>{r.detalles}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {registros.length === 0 && <p className="vacio">Sin registros.</p>}
      </div>
      <small>Mostrando hasta 200 registros.</small>
    </div>
  )
}
