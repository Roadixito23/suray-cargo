import { api } from '../api'
import { sha256 } from '../lib/hash'
import { borrar, guardar, leer } from '../lib/storage'
import type { Sucursal, Usuario, UsuarioSesion } from '../types'
import { auditar } from './auditoria'

const CLAVE_SESION = 'sesion'

export const sinContrasena = ({ contrasena: _c, ...resto }: Usuario): UsuarioSesion => resto

export async function login(login: string, contrasena: string): Promise<UsuarioSesion | null> {
  const sesion = await api.usuarios.verificarLogin(login.trim(), await sha256(contrasena))
  if (!sesion) return null
  guardar(CLAVE_SESION, { usuarioId: sesion.id })
  await auditar(sesion, 'login', `Inicio de sesión — ${sesion.nombre} (${sesion.usuario})`)
  return sesion
}

export async function logout(usuario: UsuarioSesion | null): Promise<void> {
  if (usuario) await auditar(usuario, 'logout', 'Cierre de sesión')
  borrar(CLAVE_SESION)
}

/** Recupera la sesión guardada (revalidando que el usuario aún exista). */
export async function restaurarSesion(): Promise<UsuarioSesion | null> {
  const s = leer<{ usuarioId: string } | null>(CLAVE_SESION, null)
  if (!s) return null
  const u = await api.usuarios.obtener(s.usuarioId)
  return u ? sinContrasena(u) : null
}

export interface DatosUsuario {
  id?: string
  nombre: string
  usuario: string
  /** Vacía al editar = conservar la actual. */
  contrasena: string
  esAdmin: boolean
  sucursal: Sucursal
}

export async function guardarUsuario(actor: UsuarioSesion, datos: DatosUsuario): Promise<void> {
  const nombre = datos.nombre.trim()
  const login = datos.usuario.trim()
  if (!nombre || !login) throw new Error('Nombre y usuario son obligatorios')

  const existente = datos.id ? await api.usuarios.obtener(datos.id) : null
  const duplicado = await api.usuarios.buscarPorLogin(login)
  if (duplicado && duplicado.id !== datos.id) throw new Error('Ese nombre de usuario ya existe')
  if (!existente && !datos.contrasena) throw new Error('La contraseña es obligatoria')

  const usuario = {
    id: existente?.id ?? `${Date.now()}`,
    nombre,
    usuario: login,
    contrasenaHash: datos.contrasena ? await sha256(datos.contrasena) : null,
    esAdmin: datos.esAdmin,
    sucursal: datos.sucursal,
    fechaCreacion: existente?.fechaCreacion ?? new Date().toISOString(),
  }
  await api.usuarios.guardar(usuario)
  await auditar(
    actor,
    existente ? 'editar_usuario' : 'crear_usuario',
    `${existente ? 'Editado' : 'Creado'} usuario "${nombre}" (${login}) — Sucursal: ${datos.sucursal} — Admin: ${datos.esAdmin ? 'Sí' : 'No'}`,
    usuario.id,
    'usuarios',
  )
}

export async function eliminarUsuario(actor: UsuarioSesion, usuario: Usuario): Promise<void> {
  if (usuario.id === actor.id) throw new Error('No puedes eliminar tu propio usuario')
  if (usuario.usuario === 'admin') throw new Error('No se puede eliminar el usuario admin')
  await api.usuarios.eliminar(usuario.id)
  await auditar(actor, 'eliminar_usuario', `Eliminado usuario "${usuario.nombre}" (${usuario.usuario})`, usuario.id, 'usuarios')
}
