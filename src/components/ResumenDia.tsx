import { etiquetaMetodo, formatoFechaHora, formatoMonto } from '../lib/format'
import { ciudadDeSucursal } from '../lib/sucursales'
import type { ResumenCaja } from '../services/ventas'
import type { Venta } from '../types'
import { FilasSkeleton, TarjetasSkeleton } from './Skeleton'

export function TarjetasResumen({ r, cargando }: { r: ResumenCaja; cargando?: boolean }) {
  if (cargando) return <TarjetasSkeleton />
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

export function ListaRetiros({ retiros }: { retiros: Venta[] }) {
  return (
    <div className="tabla-scroll">
      <table>
        <thead>
          <tr>
            <th>Boleta</th><th>Hora</th><th>Origen → Destino</th><th>Retira</th><th>RUT</th><th>Comprobante</th><th>Cobro</th><th className="der">Monto</th>
          </tr>
        </thead>
        <tbody>
          {retiros.map((v) => (
            <tr key={v.id}>
              <td>{v.numeroBoleta}</td>
              <td>{v.retiroFecha ? formatoFechaHora(v.retiroFecha).slice(-5) : ''}</td>
              <td>{ciudadDeSucursal(v.sucursalOrigen)} → {v.destino}</td>
              <td>{v.retiroNombre}</td>
              <td>{v.retiroRut}</td>
              <td>{v.numeroComprobante}</td>
              <td>{v.retiroMetodoPago ? etiquetaMetodo(v.retiroMetodoPago) : ''}</td>
              <td className="der">{formatoMonto(v.monto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ListaVentasDia({ ventas, admin, cargando }: { ventas: Venta[]; admin: boolean; cargando?: boolean }) {
  if (!cargando && !ventas.length) return <p className="vacio">Sin ventas.</p>
  return (
    <div className="tabla-scroll" aria-busy={cargando}>
      <table>
        <thead>
          <tr>
            <th>Boleta</th><th>Hora</th><th>Destinatario</th><th>Pago</th><th className="der">Monto</th>{admin && <th>Vendedor</th>}
          </tr>
        </thead>
        <tbody>
          {cargando && <FilasSkeleton columnas={admin ? 6 : 5} filas={4} />}
          {!cargando && ventas.map((v) => (
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
