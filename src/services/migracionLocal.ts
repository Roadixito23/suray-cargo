import { api } from '../api'
import { leer } from '../lib/storage'
import type { Sucursal, Usuario, UsuarioSesion } from '../types'
import { auditar } from './auditoria'

/**
 * Migración de usuarios que quedaron en el localStorage de este equipo (versión previa a Supabase)
 * hacia la base de datos.
 *
 * Regla de conflicto: la base de datos manda. Si el usuario ya existe (mismo nombre de usuario,
 * sin distinguir mayúsculas) NO se toca nada de lo que hay en la base: ni nombre, ni sucursal, ni
 * rol, ni contraseña. Un dato local viejo podría deshacer un cambio de contraseña o de permisos
 * hecho después. Solo se agregan los que no existen. "admin" nunca se migra.
 */

const CLAVE_LOCAL = 'usuarios'
export const CLAVE_OMITIR = 'migracion_omitida'
const SUCURSALES: Sucursal[] = ['aysen', 'coyhaique']

export type Decision = 'agregar' | 'existe' | 'invalido'

export interface ItemMigracion {
  local: Usuario
  decision: Decision
  /** Para 'existe': campos donde lo local difiere de la base (solo informativo, no se aplica). */
  diferencias: string[]
  /** Para 'invalido': por qué no se puede migrar. */
  motivo?: string
}

const clave = (login: string) => login.trim().toLowerCase()

export function leerUsuariosLocales(): Usuario[] {
  const lista = leer<unknown>(CLAVE_LOCAL, [])
  return Array.isArray(lista) ? (lista as Usuario[]) : []
}

export function planificarMigracion(locales: Usuario[], remotos: Pick<Usuario, 'nombre' | 'usuario' | 'sucursal' | 'esAdmin'>[]): ItemMigracion[] {
  const enBase = new Map(remotos.map((u) => [clave(u.usuario), u]))
  const vistos = new Set<string>()
  const items: ItemMigracion[] = []

  for (const local of locales) {
    const login = typeof local?.usuario === 'string' ? clave(local.usuario) : ''
    if (!login || login === 'admin' || vistos.has(login)) continue
    vistos.add(login)

    const remoto = enBase.get(login)
    if (remoto) {
      const diferencias: string[] = []
      if (local.nombre !== remoto.nombre) diferencias.push(`nombre: "${local.nombre}" (local) vs "${remoto.nombre}" (base)`)
      if (local.sucursal !== remoto.sucursal) diferencias.push(`sucursal: ${local.sucursal} (local) vs ${remoto.sucursal} (base)`)
      if (!!local.esAdmin !== remoto.esAdmin) diferencias.push(`administrador: ${local.esAdmin ? 'sí' : 'no'} (local) vs ${remoto.esAdmin ? 'sí' : 'no'} (base)`)
      items.push({ local, decision: 'existe', diferencias })
      continue
    }

    const motivo = !local.nombre?.trim()
      ? 'sin nombre'
      : !local.contrasena
        ? 'sin contraseña guardada'
        : !SUCURSALES.includes(local.sucursal)
          ? 'sucursal inválida'
          : undefined
    items.push({ local, decision: motivo ? 'invalido' : 'agregar', diferencias: [], motivo })
  }
  return items
}

/** Lee la base y compara con el localStorage. Devuelve [] si no hay nada que ofrecer. */
export async function pendientesDeMigrar(): Promise<ItemMigracion[]> {
  const locales = leerUsuariosLocales()
  if (locales.length === 0) return []
  return planificarMigracion(locales, await api.usuarios.listar())
}

export interface ResultadoMigracion {
  agregados: string[]
  omitidos: string[]
  fallidos: { usuario: string; error: string }[]
}

/** Agrega solo los usuarios elegidos, revalidando en la base justo antes de insertar. */
export async function migrarUsuarios(actor: UsuarioSesion, elegidos: Usuario[]): Promise<ResultadoMigracion> {
  const res: ResultadoMigracion = { agregados: [], omitidos: [], fallidos: [] }

  for (const [i, u] of elegidos.entries()) {
    try {
      // Otro administrador pudo crearlo mientras este diálogo estaba abierto.
      if (await api.usuarios.buscarPorLogin(u.usuario.trim())) {
        res.omitidos.push(u.usuario)
        continue
      }
      // El id local es un timestamp; si ya lo usa otra fila de la base, se genera uno nuevo.
      const id = (await api.usuarios.obtener(u.id)) ? `${Date.now()}${i}` : u.id
      await api.usuarios.guardar({
        id,
        nombre: u.nombre.trim(),
        usuario: u.usuario.trim(),
        contrasenaHash: u.contrasena,
        esAdmin: !!u.esAdmin,
        sucursal: u.sucursal,
        fechaCreacion: u.fechaCreacion || new Date().toISOString(),
      })
      res.agregados.push(u.usuario)
    } catch (e) {
      res.fallidos.push({ usuario: u.usuario, error: (e as Error).message })
    }
  }

  if (res.agregados.length > 0) {
    await auditar(
      actor,
      'migrar_usuarios_locales',
      `Usuarios del localStorage agregados a la base: ${res.agregados.join(', ')}` +
        (res.omitidos.length ? ` — ya existían: ${res.omitidos.join(', ')}` : ''),
      undefined,
      'usuarios',
    )
  }
  return res
}
