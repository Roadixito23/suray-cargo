import { api } from '../api'
import { fijarSucursales } from '../lib/sucursales'
import type { SucursalInfo, UsuarioSesion } from '../types'
import { auditar } from './auditoria'

const PREFIJO_VALIDO = /^[A-Z0-9]{2,4}$/

/** Carga el catálogo desde la API y lo deja disponible para toda la app. */
export async function cargarSucursales(): Promise<SucursalInfo[]> {
  const lista = await api.sucursales.listar()
  fijarSucursales(lista)
  return lista
}

/** Id estable a partir del nombre (sin tildes ni espacios); no cambia aunque luego se renombre. */
export function idDesdeNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
}

const sinTildes = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

export interface DatosSucursal {
  /** Presente al editar una sucursal existente. */
  id?: string
  nombre: string
  /** Ciudad a la que pertenece; solo se define al crear. */
  ciudad: string
  prefijo: string
  activa: boolean
}

export async function guardarSucursal(actor: UsuarioSesion, datos: DatosSucursal): Promise<void> {
  const nombre = datos.nombre.trim()
  const prefijo = datos.prefijo.trim().toUpperCase()
  if (!nombre) throw new Error('El nombre es obligatorio')

  // Se lee de la API (no del catálogo en memoria) para validar contra lo que hay hoy en la base.
  const actuales = await api.sucursales.listar()
  const existente = datos.id ? actuales.find((s) => s.id === datos.id) : undefined
  const clave = (t: string) => t.trim().toLowerCase()
  if (actuales.some((s) => s.id !== existente?.id && clave(s.nombre) === clave(nombre))) {
    throw new Error('Ya existe una sucursal con ese nombre')
  }

  // Una ciudad ya existente se reutiliza con su grafía (así "coyhaique" no crea una ciudad distinta de "Coyhaique").
  const ciudadEscrita = datos.ciudad.trim()
  const ciudad = actuales.find((s) => sinTildes(s.ciudad) === sinTildes(ciudadEscrita))?.ciudad ?? ciudadEscrita

  if (!existente) {
    if (!ciudad) throw new Error('La ciudad es obligatoria')
    if (!PREFIJO_VALIDO.test(prefijo)) throw new Error('El prefijo debe tener de 2 a 4 letras o números')
    if (actuales.some((s) => s.prefijo === prefijo)) throw new Error('Ese prefijo ya lo usa otra sucursal')
  } else if (!datos.activa && existente.activa && actuales.filter((s) => s.activa).length <= 1) {
    throw new Error('Debe quedar al menos una sucursal activa')
  }

  const id = existente?.id ?? idDesdeNombre(nombre)
  if (id.length < 2) throw new Error('El nombre debe tener al menos 2 letras o números')
  if (!existente && actuales.some((s) => s.id === id)) throw new Error('Ya existe una sucursal con un nombre equivalente')

  await api.sucursales.guardar({
    id,
    nombre,
    ciudad: existente?.ciudad ?? ciudad,
    prefijo: existente?.prefijo ?? prefijo,
    activa: datos.activa,
  })
  await cargarSucursales()
  await auditar(
    actor,
    existente ? 'editar_sucursal' : 'crear_sucursal',
    `${existente ? 'Editada' : 'Creada'} sucursal "${nombre}" (${existente?.prefijo ?? prefijo}) de ${existente?.ciudad ?? ciudad} — ${datos.activa ? 'Activa' : 'Inactiva'}`,
    id,
    'sucursales',
  )
}
