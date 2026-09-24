import type { Sucursal } from '../types'

const moneda = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 })
export const formatoMonto = (n: number) => `$${moneda.format(n)}`

const fechaHora = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
export const formatoFechaHora = (iso: string | Date) => fechaHora.format(new Date(iso)).replace(',', '')

const fecha = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
export const formatoFecha = (iso: string | Date) => fecha.format(new Date(iso))

export const nombreSucursal = (s: Sucursal) => (s === 'aysen' ? 'Aysén' : 'Coyhaique')
export const prefijoBoleta = (s: Sucursal) => (s === 'aysen' ? 'AYS' : 'COY')
export const sucursalOpuesta = (s: Sucursal): Sucursal => (s === 'aysen' ? 'coyhaique' : 'aysen')

export const etiquetaMetodo = (m: string) => (m === 'efectivo' ? 'Efectivo' : 'Tarjeta')
export const etiquetaTipoVenta = (t: string) =>
  t === 'por_pagar' ? 'Por Pagar' : t === 'por_facturar' ? 'Por Facturar' : 'Venta'
