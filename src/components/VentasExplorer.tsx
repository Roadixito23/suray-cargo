import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useUsuario } from '../auth/AuthContext'
import { aInputDate, desdeInputDate, finDelDia } from '../lib/fechas'
import { etiquetaMetodo, formatoFechaHora, formatoMonto, nombreSucursal } from '../lib/format'
import { listarVentas } from '../services/ventas'
import type { Sucursal, Venta } from '../types'

interface Props {
  /** Botones por fila (reimprimir, anular, detalle…). Recibe `recargar` para refrescar tras actuar. */
  acciones(v: Venta, recargar: () => void): ReactNode
  /** Si es true, oculta las anuladas. */
  soloActivas?: boolean
}

/**
 * Listado filtrable de ventas compartido por Buscar / Reimprimir / Anular.
 * Alcance por rol vía `listarVentas`.
 */
export function VentasExplorer({ acciones, soloActivas }: Props) {
  const usuario = useUsuario()
  const hoy = aInputDate(new Date())
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const [texto, setTexto] = useState('')
  const [destino, setDestino] = useState<'' | Sucursal>('')
  const [metodo, setMetodo] = useState('')
  const [ventas, setVentas] = useState<Venta[]>([])
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(() => {
    setCargando(true)
    const h = desdeInputDate(hasta)
    listarVentas(usuario, { desde: desdeInputDate(desde), hasta: h ? finDelDia(h) : undefined })
      .then(setVentas)
      .finally(() => setCargando(false))
  }, [usuario, desde, hasta])

  useEffect(recargar, [recargar])

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return ventas.filter(
      (v) =>
        (!soloActivas || !v.anulada) &&
        (!destino || v.destino === destino) &&
        (!metodo || v.metodoPago === metodo) &&
        (!q ||
          v.numeroBoleta.toLowerCase().includes(q) ||
          v.destinatario.toLowerCase().includes(q) ||
          v.remitente.toLowerCase().includes(q)),
    )
  }, [ventas, texto, destino, metodo, soloActivas])

  return (
    <div className="panel">
      <div className="filtros">
        <input
          type="search"
          placeholder="Boleta, destinatario o remitente"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Buscar"
        />
        <label>Desde <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} /></label>
        <label>Hasta <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} /></label>
        <select value={destino} onChange={(e) => setDestino(e.target.value as '' | Sucursal)} aria-label="Destino">
          <option value="">Todos los destinos</option>
          <option value="aysen">Aysén</option>
          <option value="coyhaique">Coyhaique</option>
        </select>
        <select value={metodo} onChange={(e) => setMetodo(e.target.value)} aria-label="Método de pago">
          <option value="">Todo método</option>
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
        </select>
      </div>

      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Boleta</th><th>Fecha</th><th>Destino</th><th>Destinatario</th><th>Remitente</th>
              <th className="der">Monto</th><th>Pago</th>{usuario.esAdmin && <th>Vendedor</th>}<th />
            </tr>
          </thead>
          <tbody>
            {filtradas.map((v) => (
              <tr key={v.id} className={v.anulada ? 'anulada' : ''}>
                <td>{v.numeroBoleta}{v.anulada && <span className="badge rojo">Anulada</span>}</td>
                <td>{formatoFechaHora(v.fecha)}</td>
                <td>{nombreSucursal(v.destino)}</td>
                <td>{v.destinatario}</td>
                <td>{v.remitente}</td>
                <td className="der">{formatoMonto(v.monto)}</td>
                <td>{etiquetaMetodo(v.metodoPago)}</td>
                {usuario.esAdmin && <td>{v.usuarioNombre}</td>}
                <td className="acciones">{acciones(v, recargar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cargando && filtradas.length === 0 && <p className="vacio">No hay ventas para los filtros seleccionados.</p>}
      </div>
      <small>{filtradas.length} resultado(s)</small>
    </div>
  )
}
