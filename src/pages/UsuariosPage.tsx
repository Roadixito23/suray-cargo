import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useUsuario } from '../auth/AuthContext'
import { Modal } from '../components/Modal'
import { FilasSkeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { formatoFecha, nombreSucursal } from '../lib/format'
import { useSucursales } from '../lib/sucursales'
import { eliminarUsuario, guardarUsuario, type DatosUsuario } from '../services/usuarios'
import type { Usuario } from '../types'

const vacio = (sucursal: string): DatosUsuario => ({ nombre: '', usuario: '', contrasena: '', esAdmin: false, sucursal })

export function UsuariosPage() {
  const actor = useUsuario()
  const toast = useToast()
  const sucursales = useSucursales()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState<DatosUsuario | null>(null)
  const [borrar, setBorrar] = useState<Usuario | null>(null)

  const cargar = useCallback(() => {
    api.usuarios.listar().then(setUsuarios).finally(() => setCargando(false))
  }, [])
  useEffect(cargar, [cargar])

  async function guardar() {
    if (!form) return
    try {
      await guardarUsuario(actor, form)
      toast(form.id ? 'Usuario actualizado' : 'Usuario creado')
      setForm(null)
      cargar()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function confirmarBorrar() {
    if (!borrar) return
    try {
      await eliminarUsuario(actor, borrar)
      toast('Usuario eliminado')
      cargar()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
    setBorrar(null)
  }

  const set = (c: Partial<DatosUsuario>) => setForm((f) => (f ? { ...f, ...c } : f))

  return (
    <div className="panel">
      <div className="filtros">
        <button className="btn primario" onClick={() => setForm(vacio(sucursales.find((s) => s.activa)?.id ?? ''))}>+ Nuevo usuario</button>
      </div>
      <div className="tabla-scroll" aria-busy={cargando}>
        <table>
          <thead><tr><th>Nombre</th><th>Usuario</th><th>Sucursal</th><th>Rol</th><th>Creado</th><th /></tr></thead>
          <tbody>
            {cargando && <FilasSkeleton columnas={6} />}
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre}</td>
                <td>{u.usuario}</td>
                <td>{nombreSucursal(u.sucursal)}</td>
                <td><span className={u.esAdmin ? 'badge azul' : 'badge'}>{u.esAdmin ? 'Administrador' : 'Usuario'}</span></td>
                <td>{formatoFecha(u.fechaCreacion)}</td>
                <td className="acciones">
                  <button className="btn" onClick={() => setForm({ id: u.id, nombre: u.nombre, usuario: u.usuario, contrasena: '', esAdmin: u.esAdmin, sucursal: u.sucursal })}>Editar</button>
                  <button className="btn peligro" disabled={u.usuario === 'admin' || u.id === actor.id} onClick={() => setBorrar(u)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal
          titulo={form.id ? 'Editar usuario' : 'Nuevo usuario'}
          onCerrar={() => setForm(null)}
          acciones={
            <>
              <button className="btn" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn primario" onClick={guardar}>Guardar</button>
            </>
          }
        >
          <label className="campo"><span className="etiqueta">Nombre</span><input value={form.nombre} onChange={(e) => set({ nombre: e.target.value })} autoFocus /></label>
          <label className="campo"><span className="etiqueta">Usuario (login)</span><input value={form.usuario} onChange={(e) => set({ usuario: e.target.value })} autoComplete="off" /></label>
          <label className="campo">
            <span className="etiqueta">Contraseña {form.id && '(vacía = no cambiar)'}</span>
            <input type="password" value={form.contrasena} onChange={(e) => set({ contrasena: e.target.value })} autoComplete="new-password" />
          </label>
          <label className="campo">
            <span className="etiqueta">Sucursal</span>
            <select value={form.sucursal} onChange={(e) => set({ sucursal: e.target.value })}>
              {sucursales
                .filter((s) => s.activa || s.id === form.sucursal)
                .map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}{s.activa ? '' : ' (inactiva)'}</option>
                ))}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={form.esAdmin} onChange={(e) => set({ esAdmin: e.target.checked })} /> Administrador</label>
        </Modal>
      )}

      {borrar && (
        <Modal
          titulo="Eliminar usuario"
          onCerrar={() => setBorrar(null)}
          acciones={
            <>
              <button className="btn" onClick={() => setBorrar(null)}>Cancelar</button>
              <button className="btn peligro" onClick={confirmarBorrar}>Eliminar</button>
            </>
          }
        >
          ¿Eliminar a <strong>{borrar.nombre}</strong> ({borrar.usuario})? Sus ventas se conservan.
        </Modal>
      )}
    </div>
  )
}
