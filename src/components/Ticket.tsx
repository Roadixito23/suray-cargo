import { formatoFechaHora, formatoMonto, nombreSucursal } from '../lib/format'
import type { Venta } from '../types'

/** Datos mínimos para dibujar un ticket (permite la vista previa con el formulario a medias). */
export type DatosTicket = Pick<
  Venta,
  'numeroBoleta' | 'destino' | 'fecha' | 'destinatario' | 'remitente' | 'usuarioNombre' | 'monto' | 'cantidad'
>

export const RUT_EMPRESA = '76.334.380-4'

function Cinta() {
  return <div className="ticket-cinta">COLOCAR CINTA AQUÍ</div>
}

function Campo({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="ticket-campo">
      <span className="ticket-etiqueta">{etiqueta}</span>
      <span className={fuerte ? 'ticket-valor fuerte' : 'ticket-valor'}>{valor}</span>
    </div>
  )
}

/** Un ticket = un paquete (N/total). Ancho 80 mm, ver estilos `.ticket*` en styles.css. */
export function Ticket({ venta, paquete }: { venta: DatosTicket; paquete: number }) {
  const total = venta.cantidad || '1'
  return (
    <section className="ticket">
      <Cinta />
      <div className="ticket-cuerpo">
        <div className="ticket-encabezado">
          <div>
            <img src="/assets/logo/suraycargo.png" alt="Suray Cargo" className="ticket-logo" />
            <div className="ticket-destino">Destino: {nombreSucursal(venta.destino)}</div>
          </div>
          <div className="ticket-transaccion">
            <div className="ticket-rut">RUT: {RUT_EMPRESA}</div>
            <div className="ticket-trans-titulo">N° Transacción</div>
            <div className="ticket-trans-num">{venta.numeroBoleta}</div>
          </div>
        </div>
        <hr />
        <Campo etiqueta="Fecha:" valor={formatoFechaHora(venta.fecha)} />
        <Campo etiqueta="Item:" valor={`${paquete}/${total}`} />
        <Campo etiqueta="Destinatario:" valor={venta.destinatario} />
        <Campo etiqueta="Remitente:" valor={venta.remitente} />
        <hr />
        <Campo etiqueta="Vendedor:" valor={venta.usuarioNombre} />
        <Campo etiqueta="Valor:" valor={formatoMonto(venta.monto)} fuerte />
      </div>
      <Cinta />
    </section>
  )
}

/** Todos los tickets de una venta: uno por paquete. */
export function TicketsVenta({ venta }: { venta: Venta }) {
  const n = Math.max(1, parseInt(venta.cantidad, 10) || 1)
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <Ticket key={i} venta={venta} paquete={i + 1} />
      ))}
    </>
  )
}
