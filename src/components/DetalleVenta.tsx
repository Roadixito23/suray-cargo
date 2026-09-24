import { etiquetaMetodo, etiquetaTipoVenta, formatoFechaHora, formatoMonto, nombreSucursal } from '../lib/format'
import type { Venta } from '../types'

export function DetalleVenta({ v }: { v: Venta }) {
  const fila = (a: string, b: string | null | undefined) =>
    b ? (
      <div className="detalle-fila">
        <span>{a}</span>
        <strong>{b}</strong>
      </div>
    ) : null

  return (
    <div className="detalle">
      {v.anulada && <div className="error">Anulada el {formatoFechaHora(v.fechaAnulacion!)} por {v.usuarioAnulacion} — {v.motivoAnulacion}</div>}
      {fila('Boleta', v.numeroBoleta)}
      {fila('Fecha', formatoFechaHora(v.fecha))}
      {fila('Destino', nombreSucursal(v.destino))}
      {fila('Ítem / Cantidad', `${v.item} / ${v.cantidad}`)}
      {fila('Destinatario', v.destinatario)}
      {fila('Remitente', v.remitente)}
      {fila('Monto', formatoMonto(v.monto))}
      {fila('Pago', etiquetaMetodo(v.metodoPago))}
      {fila('N° operación', v.numeroOperacion)}
      {fila('Tipo de venta', etiquetaTipoVenta(v.tipoVenta))}
      {fila('Vendedor', v.usuarioNombre)}
      {v.tiposArticulos?.length ? (
        <>
          <h4>Artículos</h4>
          {v.tiposArticulos.map((a, i) => fila(`${i + 1}. ${a.tipo}`, formatoMonto(a.precio)))}
        </>
      ) : (
        fila('Producto', v.tipoProducto)
      )}
    </div>
  )
}
