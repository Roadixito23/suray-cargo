import { useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { api } from '../api'
import { useUsuario } from '../auth/AuthContext'
import { useImprimir } from '../components/PrintContext'
import { Ticket, TicketsVenta, type DatosTicket } from '../components/Ticket'
import { useToast } from '../components/Toast'
import { etiquetaMetodo, formatoMonto } from '../lib/format'
import { guardar, leer } from '../lib/storage'
import { ciudadDeSucursal, ciudadesDe, useSucursalesActivas } from '../lib/sucursales'
import { registrarVenta, resumenCaja, retirosDelDia, ventasDelDia } from '../services/ventas'
import type { Ciudad, MetodoPago, Sucursal, TipoArticulo, Venta } from '../types'

const MAX_PAQUETES = 10
const NUMERO_REFRESCO_MS = 15_000

export function VentaPage() {
  const usuario = useUsuario()
  const toast = useToast()
  const imprimir = useImprimir()

  const [hoy, setHoy] = useState<Venta[]>([])
  const [retiros, setRetiros] = useState<Venta[]>([])
  const [proximo, setProximo] = useState('')
  const [ahora, setAhora] = useState(() => new Date())
  const [guardando, setGuardando] = useState(false)

  // Cada usuario emite desde su sucursal (el admin elige la de la boleta) y elige la CIUDAD de destino
  // entre las demás ciudades con sucursales activas: la carga la ve y la cobra cualquier sucursal de esa ciudad.
  const activas = useSucursalesActivas()
  const [origenElegido, setOrigenElegido] = useState<Sucursal>(usuario.sucursal)
  const origen = usuario.esAdmin && activas.some((s) => s.id === origenElegido) ? origenElegido : usuario.sucursal
  const ciudadOrigen = ciudadDeSucursal(origen)
  const destinos = ciudadesDe(activas).filter((c) => c !== ciudadOrigen)
  const [destinoElegido, setDestinoElegido] = useState<Ciudad>('')
  const [destinoBloqueado, setDestinoBloqueado] = useState(false)
  // Sin elección válida (o si cambió el origen) se propone la primera opción.
  const destino = destinos.includes(destinoElegido) ? destinoElegido : (destinos[0] ?? '')

  const [autoItem, setAutoItem] = useState(true)
  const [itemManual, setItemManual] = useState('')
  const [autoOp, setAutoOp] = useState(() => leer('autoOp', true))
  const [opManual, setOpManual] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [tipoProducto, setTipoProducto] = useState('')
  const [monto, setMonto] = useState('')
  const [articulos, setArticulos] = useState<TipoArticulo[]>([])
  const [destinatario, setDestinatario] = useState('')
  const [remitente, setRemitente] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')

  const n = Math.min(MAX_PAQUETES, Math.max(1, parseInt(cantidad, 10) || 1))
  const multi = n > 1

  const cargar = useCallback(async () => {
    const [ventas, cobros, num] = await Promise.all([
      ventasDelDia(usuario),
      retirosDelDia(usuario),
      api.ventas.peekNumeroBoleta(origen),
    ])
    setHoy(ventas)
    setRetiros(cobros)
    setProximo(num)
  }, [usuario, origen])

  // El correlativo es por sucursal: otros usuarios pueden vender mientras esta pantalla está abierta.
  const refrescarNumero = useCallback(() => {
    api.ventas.peekNumeroBoleta(origen).then(setProximo, () => {})
  }, [origen])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    const t = setInterval(refrescarNumero, NUMERO_REFRESCO_MS)
    const alVolver = () => {
      if (document.visibilityState === 'visible') refrescarNumero()
    }
    window.addEventListener('focus', alVolver)
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', alVolver)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [refrescarNumero])

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    guardar('autoOp', autoOp)
  }, [autoOp])

  // Una fila (tipo + precio) por paquete cuando cantidad > 1.
  useEffect(() => {
    setArticulos((prev) => {
      if (n <= 1) return prev.length ? [] : prev
      if (prev.length === n) return prev
      return Array.from({ length: n }, (_, i) => prev[i] ?? { tipo: '', precio: 0 })
    })
  }, [n])

  // Cada paquete consume un número de ítem, aunque varias ventas los agrupen en una boleta.
  const paquetesHoy = hoy.reduce((s, v) => s + (parseInt(v.cantidad, 10) || 1), 0)
  const item = autoItem ? String(paquetesHoy + 1) : itemManual
  const porPagar = metodo === 'por_pagar'
  // Las ventas Por Pagar no llevan comprobante, así que no consumen número.
  const numeroComprobante = porPagar
    ? ''
    : autoOp
      ? String(hoy.filter((v) => v.metodoPago !== 'por_pagar').length + 1)
      : opManual
  const montoCalculado = multi ? articulos.reduce((s, a) => s + (a.precio || 0), 0) : Number(monto) || 0

  const completo =
    destino !== '' &&
    item !== '' &&
    destinatario.trim() !== '' &&
    remitente.trim() !== '' &&
    (multi
      ? articulos.length === n && articulos.every((a) => a.tipo.trim() !== '' && a.precio > 0)
      : tipoProducto.trim() !== '' && Number(monto) > 0)

  const resumen = useMemo(() => resumenCaja(hoy, retiros), [hoy, retiros])

  const vistaPrevia: DatosTicket = {
    numeroBoleta: proximo,
    sucursalOrigen: origen,
    destino,
    fecha: ahora.toISOString(),
    destinatario,
    remitente,
    usuarioNombre: usuario.nombre,
    monto: montoCalculado,
    cantidad: String(n),
    metodoPago: metodo,
    numeroComprobante,
  }

  function limpiar() {
    setCantidad('1')
    setTipoProducto('')
    setMonto('')
    setArticulos([])
    setDestinatario('')
    setRemitente('')
    setOpManual('')
    setItemManual('')
    setMetodo('efectivo')
    if (!destinoBloqueado) setDestinoElegido('')
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!completo || guardando) return
    setGuardando(true)
    try {
      const venta = await registrarVenta(usuario, {
        sucursalBoleta: origen,
        monto: montoCalculado,
        metodoPago: metodo,
        descripcion: null,
        destino,
        item,
        cantidad: String(n),
        tipoProducto: multi ? articulos[0].tipo.trim() : tipoProducto.trim(),
        tiposArticulos: multi ? articulos.map((a) => ({ tipo: a.tipo.trim(), precio: a.precio })) : null,
        destinatario: destinatario.trim(),
        remitente: remitente.trim(),
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        numeroComprobante: numeroComprobante.trim() ? numeroComprobante.trim() : null,
        tipoVenta: porPagar ? 'por_pagar' : 'venta',
      })
      toast(`Venta #${venta.numeroBoleta} registrada: ${formatoMonto(venta.monto)}`)
      limpiar()
      await cargar()
      imprimir(<TicketsVenta venta={venta} />)
    } catch (err) {
      toast(`No se pudo guardar la venta: ${(err as Error).message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  // Enter avanza al siguiente campo (flujo rápido de caja); en el último, envía.
  function alTeclear(e: KeyboardEvent<HTMLFormElement>) {
    const t = e.target as HTMLElement
    if (e.key !== 'Enter' || t.tagName !== 'INPUT' || (t as HTMLInputElement).type === 'checkbox') return
    e.preventDefault()
    const campos = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('input:not([disabled]):not([type=checkbox]):not([readonly])'),
    )
    const i = campos.indexOf(t)
    if (i >= 0 && i < campos.length - 1) campos[i + 1].focus()
    else e.currentTarget.requestSubmit()
  }

  const setArticulo = (i: number, cambio: Partial<TipoArticulo>) =>
    setArticulos((l) => l.map((a, j) => (j === i ? { ...a, ...cambio } : a)))

  return (
    <div className="venta-grid">
      <form className="panel" onSubmit={enviar} onKeyDown={alTeclear}>
        <div className="resumen-dia">
          <span>Total Efectivo: <strong>{formatoMonto(resumen.totalEfectivo)}</strong></span>
          <span>Total Tarjeta: <strong>{formatoMonto(resumen.totalTarjeta)}</strong></span>
          <span>Total hoy: <strong>{formatoMonto(resumen.totalGeneral)}</strong></span>
        </div>

        {usuario.esAdmin && (
          <div className="campo">
            <span className="etiqueta">Sucursal de origen (boleta)</span>
            <div className="segmentado">
              {activas.map((s) => (
                <button key={s.id} type="button" className={origen === s.id ? 'sel' : ''} onClick={() => setOrigenElegido(s.id)}>
                  {s.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="campo">
          <span className="etiqueta">Destino</span>
          <div className="segmentado">
            {destinos.map((c) => (
              <button
                key={c}
                type="button"
                className={destino === c ? 'sel' : ''}
                disabled={destinoBloqueado}
                onClick={() => setDestinoElegido(c)}
              >
                {c}
              </button>
            ))}
          </div>
          {destinos.length === 0 && <small className="rojo-texto">No hay otra ciudad activa a la que enviar.</small>}
          <small>Origen: {ciudadOrigen}.</small>
          <label className="check">
            <input type="checkbox" checked={destinoBloqueado} onChange={(e) => setDestinoBloqueado(e.target.checked)} />
            Mantener destino entre ventas
          </label>
        </div>

        <div className="fila">
          <label className="campo">
            <span className="etiqueta">Ítem</span>
            <input
              inputMode="numeric"
              value={item}
              readOnly={autoItem}
              onChange={(e) => setItemManual(e.target.value.replace(/\D/g, ''))}
            />
            <label className="check">
              <input type="checkbox" checked={autoItem} onChange={(e) => setAutoItem(e.target.checked)} />
              Autocompletar
            </label>
          </label>
          <label className="campo">
            <span className="etiqueta">Cantidad (paquetes)</span>
            <input
              type="number"
              min={1}
              max={MAX_PAQUETES}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </label>
        </div>

        {multi ? (
          <div className="campo">
            <span className="etiqueta">Artículos (uno por paquete)</span>
            {articulos.map((a, i) => (
              <div className="fila articulo" key={i}>
                <span className="num">{i + 1}</span>
                <input
                  placeholder="Tipo"
                  aria-label={`Tipo paquete ${i + 1}`}
                  value={a.tipo}
                  onChange={(e) => setArticulo(i, { tipo: e.target.value })}
                />
                <input
                  placeholder="Precio"
                  aria-label={`Precio paquete ${i + 1}`}
                  inputMode="numeric"
                  value={a.precio || ''}
                  onChange={(e) => setArticulo(i, { precio: Number(e.target.value.replace(/\D/g, '')) })}
                />
                {i > 0 && (
                  <button
                    type="button"
                    className="btn-icono"
                    title="Copiar tipo y precio del artículo anterior"
                    onClick={() => setArticulo(i, { tipo: articulos[i - 1].tipo, precio: articulos[i - 1].precio })}
                  >
                    ⧉
                  </button>
                )}
              </div>
            ))}
            <div className="total-linea">Total: <strong>{formatoMonto(montoCalculado)}</strong></div>
          </div>
        ) : (
          <div className="fila">
            <label className="campo">
              <span className="etiqueta">Tipo de producto</span>
              <input value={tipoProducto} onChange={(e) => setTipoProducto(e.target.value)} />
            </label>
            <label className="campo">
              <span className="etiqueta">Monto</span>
              <input inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))} />
            </label>
          </div>
        )}

        <div className="fila">
          <label className="campo">
            <span className="etiqueta">Destinatario</span>
            <input value={destinatario} onChange={(e) => setDestinatario(e.target.value)} />
          </label>
          <label className="campo">
            <span className="etiqueta">Remitente</span>
            <input value={remitente} onChange={(e) => setRemitente(e.target.value)} />
          </label>
        </div>

        <div className="campo">
          <span className="etiqueta">Método de pago</span>
          <div className="segmentado">
            {(['efectivo', 'tarjeta', 'por_pagar'] as const).map((m) => (
              <button key={m} type="button" className={metodo === m ? 'sel' : ''} onClick={() => setMetodo(m)}>
                {etiquetaMetodo(m)}
              </button>
            ))}
          </div>
          {porPagar && <small>Se cobra al retirar en {destino}; no lleva N° de comprobante.</small>}
        </div>

        {!porPagar && (
          <label className="campo">
            <span className="etiqueta">N° de comprobante</span>
            <input value={numeroComprobante} readOnly={autoOp} onChange={(e) => setOpManual(e.target.value)} />
            <label className="check">
              <input type="checkbox" checked={autoOp} onChange={(e) => setAutoOp(e.target.checked)} />
              Autoincrementar por venta
            </label>
          </label>
        )}

        <button className="btn primario grande" disabled={!completo || guardando}>
          {guardando ? 'Guardando…' : 'Registrar venta e imprimir'}
        </button>
      </form>

      <aside className="panel vista-previa">
        <h3>Vista previa del ticket</h3>
        <div className="ticket-marco">
          <Ticket venta={vistaPrevia} paquete={Number(item) || 1} />
        </div>
        <small>N° de transacción estimado: el definitivo lo asigna el sistema al guardar.</small>
        {multi && <small>Se imprimirán {n} tickets (uno por paquete).</small>}
      </aside>
    </div>
  )
}
