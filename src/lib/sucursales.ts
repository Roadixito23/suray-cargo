import { useSyncExternalStore } from 'react'
import type { Ciudad, Sucursal, SucursalInfo } from '../types'

/**
 * Catálogo de sucursales cargado desde la API al abrir la app. Es un almacén de módulo (y no un
 * contexto) porque helpers síncronos como `nombreSucursal` o el ticket impreso lo necesitan sin hooks.
 * Mientras no cargue, rige el catálogo histórico de dos sucursales.
 */
export const SUCURSALES_INICIALES: SucursalInfo[] = [
  { id: 'aysen', nombre: 'Aysén', ciudad: 'Puerto Aysén', prefijo: 'AYS', activa: true },
  { id: 'coyhaique', nombre: 'Coyhaique', ciudad: 'Coyhaique', prefijo: 'COY', activa: true },
]

let catalogo: SucursalInfo[] = SUCURSALES_INICIALES
const oyentes = new Set<() => void>()

export const obtenerSucursales = () => catalogo

export function fijarSucursales(lista: SucursalInfo[]): void {
  catalogo = lista
  oyentes.forEach((f) => f())
}

function suscribir(f: () => void) {
  oyentes.add(f)
  return () => {
    oyentes.delete(f)
  }
}

/** Todas las sucursales (incluidas las inactivas): sirve para mostrar nombres de datos históricos. */
export function useSucursales(): SucursalInfo[] {
  return useSyncExternalStore(suscribir, obtenerSucursales)
}

/** Solo las que se pueden elegir al vender o asignar a un usuario. */
export function useSucursalesActivas(): SucursalInfo[] {
  const todas = useSucursales()
  return todas.filter((s) => s.activa)
}

export const nombreSucursal = (id: Sucursal) => catalogo.find((s) => s.id === id)?.nombre ?? id
export const prefijoBoleta = (id: Sucursal) => catalogo.find((s) => s.id === id)?.prefijo ?? id.slice(0, 3).toUpperCase()

/** Ciudad de una sucursal (el origen se muestra por ciudad). */
export const ciudadDeSucursal = (id: Sucursal): Ciudad => catalogo.find((s) => s.id === id)?.ciudad ?? id

/** Sucursales que pertenecen a una ciudad. */
export const sucursalesDeCiudad = (ciudad: Ciudad) => catalogo.filter((s) => s.ciudad === ciudad)

/** Ciudades distintas de una lista de sucursales, ordenadas por nombre. */
export const ciudadesDe = (lista: SucursalInfo[]): Ciudad[] =>
  [...new Set(lista.map((s) => s.ciudad))].sort((a, b) => a.localeCompare(b, 'es'))

/** Ciudades a las que se puede enviar o desde las que se puede vender hoy. */
export function useCiudadesActivas(): Ciudad[] {
  return ciudadesDe(useSucursalesActivas())
}

/** Todas las ciudades conocidas, incluso las de sucursales inactivas (para filtrar historial). */
export function useCiudades(): Ciudad[] {
  return ciudadesDe(useSucursales())
}
