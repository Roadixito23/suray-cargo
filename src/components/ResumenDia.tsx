import { etiquetaMetodo, formatoFechaHora, formatoMonto } from '../lib/format'
import type { ResumenCaja } from '../services/ventas'
import type { Venta } from '../types'

export function TarjetasResumen({ r }: { r: ResumenCaja }) {
  const t = (titulo: string, valor: string, sub?: string, destacada?: boolean) => (
    <div className={destacada ? 'tarjeta destacada' : 'tarjeta'}>
      <small>{titulo}</small>
      <strong>{valor}</strong>
      {sub && <small>{sub}</small>}
    </div>
  )
  return (
    <div className="tarjetas">
      {t('Efectivo', formatoMonto(r.totalEfectivo), `${r.cantidadEfectivo} ventas`)}
      {t('Tarjeta', formatoMonto(r.totalTarjeta), `${r.cantidadTarjeta} ventas`)}
      {t('Total general', formatoMonto(r.totalGeneral), `${r.cantidadEfectivo + r.cantidadTarjeta} ventas`, true)}
      {t('Anulaciones', formatoMonto(r.totalAnulaciones), `${r.cantidadAnulaciones} anuladas`)}
    </div>
  )
}

export function ListaVentasDia({ ventas, admin }: { ventas: Venta[]; admin: boolean }) {
  if (!ventas.length) return <p className="vacio">Sin ventas.</p>
  return (
    <div className="tabla-scroll">
      <table>
        <thead>
          <tr>
            <th>Boleta</th><th>Hora</th><th>Destinatario</th><th>Pago</th><th className="der">Monto</th>{admin && <th>Vendedor</th>}
          </tr>
        </thead>
        <tbody>
          {ventas.map((v) => (
            <tr key={v.id} className={v.anulada ? 'anulada' : ''}>
              <td>{v.numeroBoleta}{v.anulada && <span className="badge rojo">Anulada</span>}</td>
              <td>{formatoFechaHora(v.fecha).slice(-5)}</td>
              <td>{v.destinatario}</td>
              <td>{etiquetaMetodo(v.metodoPago)}</td>
              <td className="der">{formatoMonto(v.monto)}</td>
              {admin && <td>{v.usuarioNombre}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
