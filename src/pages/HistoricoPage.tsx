import { useEffect, useMemo, useState } from 'react'
import { useUsuario } from '../auth/AuthContext'
import { ListaVentasDia, TarjetasResumen } from '../components/ResumenDia'
import { DIAS_HISTORICO, claveDia, inicioDelDia, mismoDia } from '../lib/fechas'
import { listarVentas, resumenCaja } from '../services/ventas'
import type { Venta } from '../types'

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const mesLargo = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' })
const diaLargo = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** Los "cierres" se derivan de las ventas por fecha (igual que en la app Flutter). */
export function HistoricoPage() {
  const usuario = useUsuario()
  const hoy = useMemo(() => inicioDelDia(new Date()), [])
  const limite = useMemo(() => new Date(hoy.getTime() - DIAS_HISTORICO * 86_400_000), [hoy])
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  const [dia, setDia] = useState<Date>(hoy)
  const [ventas, setVentas] = useState<Venta[]>([])

  useEffect(() => {
    listarVentas(usuario, { desde: limite }).then(setVentas)
  }, [usuario, limite])

  const porDia = useMemo(() => {
    const m = new Map<string, Venta[]>()
    for (const v of ventas) {
      const k = claveDia(new Date(v.fecha))
      m.set(k, [...(m.get(k) ?? []), v])
    }
    return m
  }, [ventas])

  // Semana de lunes a domingo.
  const celdas = useMemo(() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1)
    const desfase = (primero.getDay() + 6) % 7
    const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
    return [
      ...Array<null>(desfase).fill(null),
      ...Array.from({ length: total }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1)),
    ]
  }, [mes])

  const delDia = porDia.get(claveDia(dia)) ?? []
  const puedeAtras = new Date(mes.getFullYear(), mes.getMonth(), 0) >= limite
  const puedeAdelante = new Date(mes.getFullYear(), mes.getMonth() + 1, 1) <= hoy

  return (
    <div className="historico">
      <div className="panel">
        <div className="cal-cabecera">
          <button className="btn" disabled={!puedeAtras} onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} aria-label="Mes anterior">‹</button>
          <strong className="capitalizar">{mesLargo.format(mes)}</strong>
          <button className="btn" disabled={!puedeAdelante} onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} aria-label="Mes siguiente">›</button>
        </div>
        <div className="cal">
          {DIAS.map((d) => <span key={d} className="cal-dia-nombre">{d}</span>)}
          {celdas.map((d, i) =>
            d ? (
              <button
                key={i}
                className={['cal-dia', mismoDia(d, dia) ? 'sel' : '', mismoDia(d, hoy) ? 'hoy' : '', porDia.has(claveDia(d)) ? 'con-ventas' : ''].join(' ')}
                disabled={d < limite || d > hoy}
                onClick={() => setDia(d)}
              >
                {d.getDate()}
              </button>
            ) : (
              <span key={i} />
            ),
          )}
        </div>
        <small>Últimos {DIAS_HISTORICO} días. Un punto indica días con ventas.</small>
      </div>

      <div className="panel">
        <h2 className="capitalizar">{diaLargo.format(dia)}</h2>
        <TarjetasResumen r={resumenCaja(delDia)} />
        <ListaVentasDia ventas={delDia} admin={usuario.esAdmin} />
      </div>
    </div>
  )
}
