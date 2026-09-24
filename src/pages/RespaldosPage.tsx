import { useRef, useState } from 'react'
import { useUsuario } from '../auth/AuthContext'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { descargarCsv, descargarRespaldo, restaurarRespaldo } from '../services/respaldo'

export function RespaldosPage() {
  const actor = useUsuario()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)

  async function ejecutar(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn()
      toast(ok)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function restaurar() {
    if (!archivo) return
    const f = archivo
    setArchivo(null)
    try {
      const r = await restaurarRespaldo(actor, f)
      toast(`Restauración completa: ${r.ventas} ventas, ${r.usuarios} usuarios`)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
    if (input.current) input.current.value = ''
  }

  return (
    <div className="panel">
      <p>
        Los datos viven en este navegador (localStorage). Descarga respaldos con regularidad: si se borra el
        almacenamiento del navegador, se pierden.
      </p>
      <div className="tarjetas">
        <div className="tarjeta">
          <strong>Respaldo completo (JSON)</strong>
          <small>Ventas y usuarios. Compatible con los respaldos de la app Flutter.</small>
          <button className="btn primario" onClick={() => ejecutar(() => descargarRespaldo(actor), 'Respaldo descargado')}>Descargar respaldo</button>
        </div>
        <div className="tarjeta">
          <strong>Exportar ventas (CSV)</strong>
          <small>Para abrir en Excel.</small>
          <button className="btn" onClick={() => ejecutar(descargarCsv, 'CSV descargado')}>Descargar CSV</button>
        </div>
        <div className="tarjeta">
          <strong>Restaurar desde archivo</strong>
          <small>Mezcla las ventas por id; el usuario admin no se sobrescribe.</small>
          <input ref={input} type="file" accept="application/json,.json" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      {archivo && (
        <Modal
          titulo="Restaurar respaldo"
          onCerrar={() => setArchivo(null)}
          acciones={
            <>
              <button className="btn" onClick={() => setArchivo(null)}>Cancelar</button>
              <button className="btn peligro" onClick={restaurar}>Restaurar</button>
            </>
          }
        >
          ¿Restaurar <strong>{archivo.name}</strong>? Se agregarán o actualizarán ventas y usuarios con el mismo id.
        </Modal>
      )}
    </div>
  )
}
