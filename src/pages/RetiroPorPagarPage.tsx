import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUsuario } from '../auth/AuthContext'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { etiquetaMetodo, formatoFecha, formatoFechaHora, formatoMonto, nombreSucursal } from '../lib/format'
import { formatearRut, normalizarRut, validarRut } from '../lib/rut'
import { useSucursales } from '../lib/sucursales'
import { porPagarPendientes, registrarRetiro } from '../services/ventas'
import type { MetodoCobro, Sucursal, Venta } from '../types'

/** Registro del retiro de cargas Por Pagar en la sucursal destino (cobro + datos de quien retira). */
export function RetiroPorPagarPage() {
  const usuario = useUsuario()
  const toast = useToast()
  const sucursales = useSucursales()
  // Admin: filtra por sucursal de destino ('' = todas). Resto: puede incluir cargas de otros destinos.
  const [sucursalFiltro, setSucursalFiltro] = useState<'' | Sucursal>('')
  const [todas, setTodas] = useState(false)
  const [pendientes, setPendientes] = useState<Venta[]>([])
  const [cargando, setCargando] = useState(true)
  const [texto, setTexto] = useState('')
  const [objetivo, setObjetivo] = useState<Venta | null>(null)
  const [comprobante, setComprobante] = useState('')
  const [nombre, setNombre] = useState('')
  const [rut, setRut] = useState('')
  const [cobro, setCobro] = useState<MetodoCobro>('efectivo')
  const [enviando, setEnviando] = useState(false)

  const recargar = useCallback(() => {
    setCargando(true)
    porPagarPendientes(usuario, { sucursal: sucursalFiltro || undefined, todas })
      .then(setPendientes)
      .catch((e) => toast((e as Error).message, 'error'))
      .finally(() => setCargando(false))
  }, [usuario, toast, sucursalFiltro, todas])

  useEffect(recargar, [recargar])

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase()
    if (!q) return pendientes
    return pendientes.filter(
      (v) =>
        v.numeroBoleta.toLowerCase().includes(q) ||
        v.destinatario.toLowerCase().includes(q) ||
        v.remitente.toLowerCase().includes(q),
    )
  }, [pendientes, texto])

  const rutValido = validarRut(rut)
  const completo = comprobante.trim() !== '' && nombre.trim() !== '' && rutValido

  function cerrar() {
    setObjetivo(null)
    setComprobante('')
    setNombre('')
    setRut('')
    setCobro('efectivo')
  }

  async function confirmar() {
    if (!objetivo || !completo || enviando) return
    setEnviando(true)
    try {
      await registrarRetiro(usuario, objetivo, { comprobante, nombre, rut, metodoPago: cobro, sucursal: sucursalFiltro || undefined })
      toast(`Retiro de la boleta ${objetivo.numeroBoleta} registrado: ${formatoMonto(objetivo.monto)} (${etiquetaMetodo(cobro)})`)
      cerrar()
      recargar()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <div className="panel">
        <p className="sub">
          Cargas Por Pagar pendientes de retiro
          {usuario.esAdmin
            ? sucursalFiltro ? ` con destino ${nombreSucursal(sucursalFiltro)}` : ' de todas las sucursales'
            : todas ? ' en todas las sucursales' : ` en ${nombreSucursal(usuario.sucursal)}`}.
        </p>
        <div className="filtros">
          <input
            type="search"
            placeholder="Boleta, destinatario o remitente"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Buscar"
          />
          {usuario.esAdmin ? (
            <select value={sucursalFiltro} onChange={(e) => setSucursalFiltro(e.target.value)} aria-label="Sucursal de destino">
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>Destino: {s.nombre}</option>
              ))}
            </select>
          ) : (
            <label className="check">
              <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} />
              Incluir cargas de otros destinos
            </label>
          )}
        </div>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Boleta</th><th>Fecha</th><th>Origen</th><th>Destino</th><th>Destinatario</th><th>Remitente</th>
                <th className="der">Monto</th><th />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((v) => (
                <tr key={v.id}>
                  <td>{v.numeroBoleta}</td>
                  <td>{formatoFechaHora(v.fecha)}</td>
                  <td>{nombreSucursal(v.sucursalOrigen)}</td>
                  <td>{nombreSucursal(v.destino)}</td>
                  <td>{v.destinatario}</td>
                  <td>{v.remitente}</td>
                  <td className="der">{formatoMonto(v.monto)}</td>
                  <td className="acciones">
                    <button className="btn primario" onClick={() => setObjetivo(v)}>Registrar retiro</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cargando && filtradas.length === 0 && <p className="vacio">No hay cargas Por Pagar pendientes.</p>}
        </div>
        <small>{filtradas.length} pendiente(s)</small>
      </div>

      {objetivo && (
        <Modal
          titulo="Registrar retiro Por Pagar"
          onCerrar={cerrar}
          acciones={
            <>
              <button className="btn" onClick={cerrar}>Cancelar</button>
              <button className="btn primario" disabled={!completo || enviando} onClick={confirmar}>
                {enviando ? 'Guardando…' : `Registrar y cobrar ${formatoMonto(objetivo.monto)}`}
              </button>
            </>
          }
        >
          <p>
            Boleta <strong>{objetivo.numeroBoleta}</strong> — {objetivo.destinatario} (de {objetivo.remitente}) —{' '}
            <strong>{formatoMonto(objetivo.monto)}</strong>
          </p>
          {!usuario.esAdmin && objetivo.destino !== usuario.sucursal && (
            <div className="aviso">
              Esta carga está destinada a <strong>{nombreSucursal(objetivo.destino)}</strong>. Si la cobras aquí, el dinero
              entra en tu caja ({nombreSucursal(usuario.sucursal)}) y queda registrado como cobro de otro destino.
            </div>
          )}
          <div className="campo">
            <span className="etiqueta">Cobro</span>
            <div className="segmentado">
              {(['efectivo', 'tarjeta'] as const).map((m) => (
                <button key={m} type="button" className={cobro === m ? 'sel' : ''} onClick={() => setCobro(m)}>
                  {etiquetaMetodo(m)}
                </button>
              ))}
            </div>
          </div>
          <label className="campo">
            <span className="etiqueta">N° de comprobante</span>
            <input value={comprobante} onChange={(e) => setComprobante(e.target.value)} autoFocus />
          </label>
          <label className="campo">
            <span className="etiqueta">Nombre de quien retira</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label className="campo">
            <span className="etiqueta">RUT de quien retira</span>
            <input value={rut} onChange={(e) => setRut(formatearRut(e.target.value))} placeholder="12.345.678-9" />
            {normalizarRut(rut).length > 1 && !rutValido && <small className="rojo-texto">RUT no válido.</small>}
          </label>
          <small>Fecha de retiro: {formatoFecha(new Date())} (se registra automáticamente).</small>
        </Modal>
      )}
    </>
  )
}
