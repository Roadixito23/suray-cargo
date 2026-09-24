import { useState } from 'react'
import { DetalleVenta } from '../components/DetalleVenta'
import { Modal } from '../components/Modal'
import { VentasExplorer } from '../components/VentasExplorer'
import type { Venta } from '../types'

export function BuscarPage() {
  const [detalle, setDetalle] = useState<Venta | null>(null)
  return (
    <>
      <VentasExplorer
        incluirPorPagar
        acciones={(v) => (
          <button className="btn" onClick={() => setDetalle(v)}>Ver detalle</button>
        )}
      />
      {detalle && (
        <Modal titulo="Detalle de la venta" onCerrar={() => setDetalle(null)} acciones={<button className="btn" onClick={() => setDetalle(null)}>Cerrar</button>}>
          <DetalleVenta v={detalle} />
        </Modal>
      )}
    </>
  )
}
