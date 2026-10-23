import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useUsuario } from '../auth/AuthContext'
import { aInputDate, desdeInputDate, finDelDia } from '../lib/fechas'
import { api } from '../api'
import { etiquetaMetodo, formatoFecha, formatoFechaHora, formatoMonto } from '../lib/format'
import { normalizarRut } from '../lib/rut'
import { ciudadDeSucursal, useCiudades } from '../lib/sucursales'
import { listarVentas } from '../services/ventas'
import type { Ciudad, Venta } from '../types'

interface Props {
  /** Botones por fila (reimprimir, anular, detalle…). Recibe `recargar` para refrescar tras actuar. */
  acciones(v: Venta, recargar: () => void): ReactNode
  /** Si es true, oculta las anuladas. */
  soloActivas?: boolean
  /** Buscar Envío: suma los envíos de otras sucursales que llegan a la del usuario y los retiros del rango. */
  incluirLlegadas?: boolean
}

/**
 * Listado filtrable de ventas compartido por Buscar / Reimprimir / Anular.
 * Alcance por rol vía `listarVentas`.
 */
export function VentasExplorer({ acciones, soloActivas, incluirLlegadas }: Props) {
  const usuario = useUsuario()
  const ciudades = useCiudades()
  const hoy = aInputDate(new Date())
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const [texto, setTexto] = useState('')
  const [destino, setDestino] = useState<'' | Ciudad>('')
  const [metodo, setMetodo] = useState('')
  const [ventas, setVentas] = useState<Venta[]>([])
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(() => {
    setCargando(true)
    const d = desdeInputDate(desde)
    const h = desdeInputDate(hasta)
    const fin = h ? finDelDia(h) : undefined
    const porFecha = listarVentas(usuario, {
      desde: d,
      hasta: fin,
      ...(incluirLlegadas ? { destinoLlegada: ciudadDeSucursal(usuario.sucursal) } : {}),
    })
    // Un envío Por Pagar puede venderse un día y retirarse otro: también se buscan por fecha de retiro.
    const porRetiro = incluirLlegadas
      ? api.ventas.listar({
          retiroDesde: d,
          retiroHasta: fin,
          ...(usuario.esAdmin ? {} : { retiroUsuarioId: usuario.id }),
        })
      : Promise.resolve<Venta[]>([])
    Promise.all([porFecha, porRetiro])
      .then(([a, b]) => {
        const ids = new Set(a.map((v) => v.id))
        setVentas([...a, ...b.filter((v) => !ids.has(v.id))].sort((x, y) => y.fecha.localeCompare(x.fecha)))
      })
      .finally(() => setCargando(false))
  }, [usuario, desde, hasta, incluirLlegadas])

  useEffect(recargar, [recargar])

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase()
    const qRut = normalizarRut(texto)
    return ventas.filter(
      (v) =>
        (!soloActivas || !v.anulada) &&
        (!destino || v.destino === destino) &&
        (!metodo || v.metodoPago === metodo) &&
        (!q ||
          v.numeroBoleta.toLowerCase().includes(q) ||
          v.destinatario.toLowerCase().includes(q) ||
          v.remitente.toLowerCase().includes(q) ||
          (v.retiroNombre ?? '').toLowerCase().includes(q) ||
          (v.numeroComprobante ?? '').toLowerCase().includes(q) ||
          (qRut.length > 1 && normalizarRut(v.retiroRut ?? '').includes(qRut))),
    )
  }, [ventas, texto, destino, metodo, soloActivas])

  return (
    <div className="panel">
      <div className="filtros">
        <input
          type="search"
          placeholder={incluirLlegadas ? 'Boleta, nombre, RUT o comprobante' : 'Boleta, destinatario o remitente'}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Buscar"
        />
        <label>Desde <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} /></label>
        <label>Hasta <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} /></label>
        <select value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Destino">
          <option value="">Todos los destinos</option>
          {ciudades.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={metodo} onChange={(e) => setMetodo(e.target.value)} aria-label="Método de pago">
          <option value="">Todo método</option>
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="por_pagar">Por Pagar</option>
        </select>
      </div>

      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Boleta</th><th>Fecha</th><th>Origen</th><th>Destino</th><th>Destinatario</th><th>Remitente</th>
              <th className="der">Monto</th><th>Pago</th>{usuario.esAdmin && <th>Vendedor</th>}<th />
            </tr>
          </thead>
          <tbody>
            {filtradas.map((v) => (
              <tr key={v.id} className={v.anulada ? 'anulada' : ''}>
                <td>{v.numeroBoleta}{v.anulada && <span className="badge rojo">Anulada</span>}</td>
                <td>{formatoFechaHora(v.fecha)}</td>
                <td>{ciudadDeSucursal(v.sucursalOrigen)}</td>
                <td>{v.destino}</td>
                <td>{v.destinatario}</td>
                <td>{v.remitente}</td>
                <td className="der">{formatoMonto(v.monto)}</td>
                <td>
                  {etiquetaMetodo(v.metodoPago)}
                  {v.metodoPago === 'por_pagar' && !v.anulada && (
                    <span className={v.retiroFecha ? 'badge' : 'badge rojo'}>
                      {v.retiroFecha ? `Retirado ${formatoFecha(v.retiroFecha)}` : 'Pendiente'}
                    </span>
                  )}
                </td>
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
