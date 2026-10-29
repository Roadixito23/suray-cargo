import { etiquetaMetodo, formatoFechaHora, formatoMonto, sinMonto } from '../lib/format'
import { ciudadDeSucursal } from '../lib/sucursales'
import type { Venta } from '../types'

/** Datos mínimos para dibujar un ticket (permite la vista previa con el formulario a medias). */
export type DatosTicket = Pick<
  Venta,
  | 'numeroBoleta'
  | 'sucursalOrigen'
  | 'destino'
  | 'fecha'
  | 'destinatario'
  | 'remitente'
  | 'telefonoDestinatario'
  | 'telefonoRemitente'
  | 'usuarioNombre'
  | 'monto'
  | 'cantidad'
  | 'item'
  | 'tipoProducto'
  | 'tiposArticulos'
  | 'metodoPago'
  | 'numeroComprobante'
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

/**
 * Destinatario / Remitente: el valor ocupa el ancho del ticket (5 px de margen a cada lado) y se agranda
 * hasta 16 pt; los nombres largos bajan hasta 10 pt antes de partirse en varias líneas.
 */
function CampoAncho({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const texto = valor.trim() || '-'
  const tamano = Math.min(16, Math.max(10, 330 / texto.length))
  return (
    <div className="ticket-campo-ancho">
      <span className="ticket-etiqueta">{etiqueta}</span>
      <span className="ticket-valor-ancho" style={{ fontSize: `${tamano}pt` }}>{texto}</span>
    </div>
  )
}

/** Un ticket = un paquete. El ítem es el del destinatario y es igual en todos ("12/3"); cambia el producto. Ancho 80 mm, ver estilos `.ticket*` en styles.css. */
export function Ticket({ venta, paquete }: { venta: DatosTicket; paquete: number }) {
  const total = venta.cantidad || '1'
  const porPagar = venta.metodoPago === 'por_pagar'
  return (
    <section className="ticket">
      <Cinta />
      <div className="ticket-cuerpo">
        <div className="ticket-encabezado">
          <div>
            <img src="/assets/logo/suraycargo.png" alt="Suray Cargo" className="ticket-logo" />
            <div className="ticket-destino">Origen: {ciudadDeSucursal(venta.sucursalOrigen)}</div>
            <div className="ticket-destino">Destino: {venta.destino}</div>
          </div>
          <div className="ticket-transaccion">
            <div className="ticket-rut">RUT: {RUT_EMPRESA}</div>
            <div className="ticket-trans-titulo">N° Transacción</div>
            <div className="ticket-trans-num">{venta.numeroBoleta}</div>
          </div>
        </div>
        <hr />
        <Campo etiqueta="Fecha:" valor={formatoFechaHora(venta.fecha)} />
        <Campo etiqueta="Item:" valor={`${venta.item}/${total}`} />
        <Campo etiqueta="Producto:" valor={venta.tiposArticulos?.[paquete - 1]?.tipo || venta.tipoProducto || '-'} />
        <CampoAncho etiqueta="Destinatario:" valor={venta.destinatario} />
        {venta.telefonoDestinatario?.trim() && <Campo etiqueta="Tel. destinatario:" valor={venta.telefonoDestinatario} />}
        {venta.remitente.trim() !== '' && <CampoAncho etiqueta="Remitente:" valor={venta.remitente} />}
        {venta.telefonoRemitente?.trim() && <Campo etiqueta="Tel. remitente:" valor={venta.telefonoRemitente} />}
        <hr />
        <Campo etiqueta="Vendedor:" valor={venta.usuarioNombre} />
        <hr />
        <div className="ticket-seccion">Método de Pago</div>
        <Campo etiqueta="Pago:" valor={etiquetaMetodo(venta.metodoPago)} fuerte={porPagar} />
        {!sinMonto(venta) && <Campo etiqueta="Valor:" valor={formatoMonto(venta.monto)} fuerte />}
        {!porPagar && <Campo etiqueta="N° Comprobante:" valor={venta.numeroComprobante || '-'} />}
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
