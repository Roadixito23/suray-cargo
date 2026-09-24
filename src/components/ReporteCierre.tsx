import { formatoFecha, formatoMonto } from '../lib/format'
import type { ResumenCaja } from '../services/ventas'
import { RUT_EMPRESA } from './Ticket'

interface Props {
  fecha: Date
  resumen: ResumenCaja
  usuarioNombre: string
}

const Fila = ({ a, b, fuerte }: { a: string; b: string; fuerte?: boolean }) => (
  <div className={fuerte ? 'ticket-campo fuerte' : 'ticket-campo'}>
    <span className="ticket-etiqueta">{a}</span>
    <span className="ticket-valor">{b}</span>
  </div>
)

/** Reporte de cierre de caja en formato ticket de 80 mm. */
export function ReporteCierre({ fecha, resumen: r, usuarioNombre }: Props) {
  const hora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <section className="ticket ticket-cierre">
      <div className="ticket-cuerpo">
        <h2 className="centrado">Suray Cargo</h2>
        <div className="centrado fuerte">RUT: {RUT_EMPRESA}</div>
        <h3 className="centrado">CIERRE DE CAJA</h3>
        <hr />
        <Fila a="Fecha:" b={formatoFecha(fecha)} />
        <Fila a="Hora:" b={hora} />
        <Fila a="Usuario:" b={usuarioNombre} />
        <hr />
        <div className="fuerte">EFECTIVO</div>
        <Fila a="Cantidad de ventas:" b={String(r.cantidadEfectivo)} />
        <Fila a="Total:" b={formatoMonto(r.totalEfectivo)} />
        <hr />
        <div className="fuerte">TARJETA</div>
        <Fila a="Cantidad de ventas:" b={String(r.cantidadTarjeta)} />
        <Fila a="Total:" b={formatoMonto(r.totalTarjeta)} />
        <hr />
        <Fila a="TOTAL GENERAL:" b={formatoMonto(r.totalGeneral)} fuerte />
      </div>
    </section>
  )
}
