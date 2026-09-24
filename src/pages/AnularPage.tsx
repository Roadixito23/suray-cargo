import { useState } from 'react'
import { useUsuario } from '../auth/AuthContext'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { VentasExplorer } from '../components/VentasExplorer'
import { anularVenta } from '../services/ventas'
import type { Venta } from '../types'

export function AnularPage() {
  const usuario = useUsuario()
  const toast = useToast()
  const [objetivo, setObjetivo] = useState<{ venta: Venta; recargar: () => void } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cerrar = () => {
    setObjetivo(null)
    setMotivo('')
  }

  async function confirmar() {
    if (!objetivo) return
    setEnviando(true)
    try {
      await anularVenta(usuario, objetivo.venta, motivo)
      toast(`Boleta ${objetivo.venta.numeroBoleta} anulada`)
      objetivo.recargar()
      cerrar()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <VentasExplorer
        acciones={(v, recargar) =>
          v.anulada ? (
            <small>{v.motivoAnulacion}</small>
          ) : (
            <button className="btn peligro" onClick={() => setObjetivo({ venta: v, recargar })}>Anular</button>
          )
        }
      />
      {objetivo && (
        <Modal
          titulo="Anular venta"
          onCerrar={cerrar}
          acciones={
            <>
              <button className="btn" onClick={cerrar}>Cancelar</button>
              <button className="btn peligro" disabled={!motivo.trim() || enviando} onClick={confirmar}>
                Anular boleta
              </button>
            </>
          }
        >
          <p>¿Confirmas que deseas anular la boleta N° <strong>{objetivo.venta.numeroBoleta}</strong>?</p>
          <label className="campo">
            <span className="etiqueta">Motivo de anulación (obligatorio)</span>
            <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
          </label>
          <small className="rojo-texto">Esta acción no se puede deshacer. La venta se conserva en el historial.</small>
        </Modal>
      )}
    </>
  )
}
