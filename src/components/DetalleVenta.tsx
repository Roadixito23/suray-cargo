import { etiquetaMetodo, etiquetaTipoVenta, formatoFechaHora, formatoMonto, nombreSucursal } from '../lib/format'
import type { Venta } from '../types'

/** Ficha de una venta: encabezado, monto y forma de pago destacados, y datos agrupados por tema. */
export function DetalleVenta({ v }: { v: Venta }) {
  const campo = (etiqueta: string, valor: string | null | undefined) =>
    valor ? (
      <div className="campo">
        <span className="etiqueta">{etiqueta}</span>
        <strong>{valor}</strong>
      </div>
    ) : null

  const fila = (a: string, b: string) => (
    <div className="detalle-fila">
      <span>{a}</span>
      <strong>{b}</strong>
    </div>
  )

  const pendiente = v.metodoPago === 'por_pagar' && !v.anulada && !v.retiroFecha

  return (
    <div className="detalle">
      {v.anulada && (
        <div className="error">
          Anulada el {formatoFechaHora(v.fechaAnulacion!)} por {v.usuarioAnulacion} — {v.motivoAnulacion}
        </div>
      )}

      <h2>
        {v.numeroBoleta} <span className="badge">{etiquetaTipoVenta(v.tipoVenta)}</span>
        {v.anulada && <span className="badge rojo">Anulada</span>}
        {pendiente && <span className="badge azul">Pendiente de retiro</span>}
      </h2>
      <p className="sub">{formatoFechaHora(v.fecha)}</p>

      <div className="tarjetas">
        <div className="tarjeta destacada">
          <small>Monto</small>
          <strong>{formatoMonto(v.monto)}</strong>
        </div>
        <div className="tarjeta">
          <small>Forma de pago</small>
          <strong>{etiquetaMetodo(v.metodoPago)}</strong>
          {v.numeroComprobante && <small>Comprobante {v.numeroComprobante}</small>}
        </div>
      </div>

      <hr />
      <h4 className="etiqueta">Envío</h4>
      <div className="fila">
        {campo('Destinatario', v.destinatario)}
        {campo('Remitente', v.remitente)}
        {campo('Destino', nombreSucursal(v.destino))}
        {campo('Ítem / Cantidad', `${v.item} / ${v.cantidad}`)}
      </div>

      {v.tiposArticulos?.length ? (
        <>
          <h4 className="etiqueta">Artículos</h4>
          {v.tiposArticulos.map((a, i) => (
            <div key={i}>{fila(`${i + 1}. ${a.tipo}`, formatoMonto(a.precio))}</div>
          ))}
        </>
      ) : (
        <div className="fila">{campo('Producto', v.tipoProducto)}</div>
      )}

      {v.retiroFecha && (
        <>
          <hr />
          <h4 className="etiqueta">Retiro</h4>
          <div className="fila">
            {campo('Retira', v.retiroNombre)}
            {campo('RUT', v.retiroRut)}
            {campo('Fecha de retiro', formatoFechaHora(v.retiroFecha))}
            {campo('Cobro', v.retiroMetodoPago ? etiquetaMetodo(v.retiroMetodoPago) : null)}
            {campo('Registrado por', v.retiroUsuarioNombre)}
          </div>
        </>
      )}

      <hr />
      <div className="fila">{campo('Vendedor', v.usuarioNombre)}</div>
    </div>
  )
}
