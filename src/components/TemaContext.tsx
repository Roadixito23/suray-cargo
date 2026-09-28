import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import {
  CLAVE_TEMA,
  aplicarTema,
  conTransicion,
  guardarPreferencia,
  leerPreferencia,
  type Origen,
  resolverTema,
  sistemaPrefiereOscuro,
  type PreferenciaTema,
  type Tema,
} from '../lib/tema'

interface TemaCtx {
  /** Lo elegido por la persona (incluye 'sistema'). */
  preferencia: PreferenciaTema
  /** Tema efectivo que se está mostrando. */
  tema: Tema
  /** `origen`: punto de pantalla desde donde se expande la animación (p. ej. el botón pulsado). */
  setPreferencia: (p: PreferenciaTema, origen?: Origen) => void
}

const Ctx = createContext<TemaCtx | null>(null)

export function TemaProvider({ children }: { children: ReactNode }) {
  const [preferencia, setPref] = useState<PreferenciaTema>(leerPreferencia)
  const [sistemaOscuro, setSistemaOscuro] = useState(sistemaPrefiereOscuro)

  const tema = resolverTema(preferencia, sistemaOscuro)

  useEffect(() => aplicarTema(tema), [tema])

  // Seguir los cambios del sistema operativo (solo afecta a la preferencia 'sistema').
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const alCambiar = (e: MediaQueryListEvent) => setSistemaOscuro(e.matches)
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])

  // Mantener sincronizadas otras pestañas abiertas.
  useEffect(() => {
    const alAlmacenar = (e: StorageEvent) => {
      if (e.key === CLAVE_TEMA || e.key === null) setPref(leerPreferencia())
    }
    window.addEventListener('storage', alAlmacenar)
    return () => window.removeEventListener('storage', alAlmacenar)
  }, [])

  const setPreferencia = useCallback(
    (p: PreferenciaTema, origen?: Origen) => {
      guardarPreferencia(p)
      const nuevo = resolverTema(p, sistemaPrefiereOscuro())
      if (nuevo === tema) return setPref(p) // cambia la preferencia pero no lo que se ve: sin animación
      // El DOM debe quedar en el tema nuevo dentro del callback para que la transición capture el "después".
      conTransicion(() => {
        flushSync(() => setPref(p))
        aplicarTema(nuevo)
      }, origen)
    },
    [tema],
  )

  const valor = useMemo(() => ({ preferencia, tema, setPreferencia }), [preferencia, tema, setPreferencia])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useTema(): TemaCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTema debe usarse dentro de <TemaProvider>')
  return ctx
}
