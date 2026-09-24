import { beforeEach, describe, expect, it } from 'vitest'
import { api } from '../api'
import { resetLocal } from '../api/localApi'
import type { Usuario, UsuarioSesion } from '../types'
import { migrarUsuarios, planificarMigracion } from './migracionLocal'

const admin: UsuarioSesion = {
  id: 'a1', nombre: 'Admin', usuario: 'admin', esAdmin: true, sucursal: 'aysen', fechaCreacion: '',
}

const local = (o: Partial<Usuario> = {}): Usuario => ({
  id: '1', nombre: 'Dante', usuario: 'dante', contrasena: 'hash-local', esAdmin: false,
  fechaCreacion: '2026-01-01T00:00:00.000Z', sucursal: 'aysen', ...o,
})
const remoto = (o: Partial<Usuario> = {}) => ({ nombre: 'Dante', usuario: 'dante', esAdmin: false, sucursal: 'aysen' as const, ...o })

beforeEach(() => resetLocal())

describe('planificarMigracion', () => {
  it('agrega solo lo que no existe en la base', () => {
    const plan = planificarMigracion([local({ usuario: 'nuevo', id: '2' }), local()], [remoto()])
    expect(plan.map((i) => [i.local.usuario, i.decision])).toEqual([['nuevo', 'agregar'], ['dante', 'existe']])
  })

  it('nunca migra admin y compara el login sin distinguir mayúsculas', () => {
    const plan = planificarMigracion([local({ usuario: 'admin' }), local({ usuario: 'DANTE', id: '3' })], [remoto()])
    expect(plan).toHaveLength(1)
    expect(plan[0].decision).toBe('existe')
  })

  it('informa las diferencias de un usuario existente sin proponer sobrescribirlas', () => {
    const [item] = planificarMigracion([local({ nombre: 'Dante R.', esAdmin: true, sucursal: 'coyhaique' })], [remoto()])
    expect(item.decision).toBe('existe')
    expect(item.diferencias).toHaveLength(3)
  })

  it('descarta duplicados locales e inválidos', () => {
    const plan = planificarMigracion(
      [local({ usuario: 'a', id: '1' }), local({ usuario: 'A', id: '2' }), local({ usuario: 'b', contrasena: '' })],
      [],
    )
    expect(plan.map((i) => i.decision)).toEqual(['agregar', 'invalido'])
  })
})

describe('migrarUsuarios', () => {
  it('agrega usuarios nuevos conservando su hash y nunca pisa uno existente', async () => {
    await api.usuarios.guardar({
      id: 'db1', nombre: 'Dante (base)', usuario: 'dante', contrasenaHash: 'hash-base',
      esAdmin: true, sucursal: 'coyhaique', fechaCreacion: '2026-02-02T00:00:00.000Z',
    })

    const r = await migrarUsuarios(admin, [local(), local({ id: '2', usuario: 'maria', nombre: 'María' })])

    expect(r.agregados).toEqual(['maria'])
    expect(r.omitidos).toEqual(['dante'])
    const dante = await api.usuarios.buscarPorLogin('dante')
    expect(dante).toMatchObject({ id: 'db1', nombre: 'Dante (base)', esAdmin: true, sucursal: 'coyhaique', contrasena: 'hash-base' })
    expect(await api.usuarios.buscarPorLogin('maria')).toMatchObject({ nombre: 'María', contrasena: 'hash-local' })
    const auditoria = await api.auditoria.listar()
    expect(auditoria.some((a) => a.accion === 'migrar_usuarios_locales')).toBe(true)
  })

  it('genera un id nuevo si el id local ya lo usa otra fila de la base', async () => {
    await api.usuarios.guardar({
      id: '1', nombre: 'Otro', usuario: 'otro', contrasenaHash: 'h', esAdmin: false, sucursal: 'aysen', fechaCreacion: '',
    })
    await migrarUsuarios(admin, [local({ id: '1' })])
    expect((await api.usuarios.buscarPorLogin('otro'))?.id).toBe('1')
    expect((await api.usuarios.buscarPorLogin('dante'))?.id).not.toBe('1')
  })
})
