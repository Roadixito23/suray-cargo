import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { EstadoConexion as Estado } from '../api/types'

const INTERVALO_MS = 30_000

const TEXTO = {
  verificando: 'Verificando conexión con la base de datos…',
  ok: 'Conectado a la base de datos',
  lento: 'Conectado, pero la base de datos responde lento',
  error: 'Sin conexión con la base de datos',
} as const

/** Punto discreto: verde = conectado, amarillo = lento, rojo = sin conexión. Clic para reverificar. */
export function EstadoConexion() {
  const [estado, setEstado] = useState<Estado | null>(null)

  const verificar = useCallback(async () => {
    try {
      setEstado(await api.conexion.verificar())
    } catch (e) {
      setEstado({ estado: 'error', ms: 0, detalle: (e as Error).message })
    }
  }, [])

  useEffect(() => {
    void verificar()
    const t = setInterval(verificar, INTERVALO_MS)
    window.addEventListener('online', verificar)
    window.addEventListener('offline', verificar)
    return () => {
      clearInterval(t)
      window.removeEventListener('online', verificar)
      window.removeEventListener('offline', verificar)
    }
  }, [verificar])

  const clave = estado?.estado ?? 'verificando'
  const detalle = estado ? [estado.ms > 0 ? `${estado.ms} ms` : '', estado.detalle ?? ''].filter(Boolean).join(' · ') : ''
  const titulo = detalle ? `${TEXTO[clave]} (${detalle})` : TEXTO[clave]

  return (
    <button type="button" className={`conexion-dot ${clave}`} title={titulo} aria-label={titulo} onClick={verificar} />
  )
}
