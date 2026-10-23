import { useState } from 'react'
import { useUsuario } from '../auth/AuthContext'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { ciudadesDe, useSucursales } from '../lib/sucursales'
import { guardarSucursal, type DatosSucursal } from '../services/sucursales'

const VACIA: DatosSucursal = { nombre: '', ciudad: '', prefijo: '', activa: true }

export function SucursalesPage() {
  const actor = useUsuario()
  const toast = useToast()
  const sucursales = useSucursales()
  const [form, setForm] = useState<DatosSucursal | null>(null)

  const set = (c: Partial<DatosSucursal>) => setForm((f) => (f ? { ...f, ...c } : f))

  async function guardar() {
    if (!form) return
    try {
      await guardarSucursal(actor, form)
      toast(form.id ? 'Sucursal actualizada' : 'Sucursal creada')
      setForm(null)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <div className="panel">
      <p className="sub">
        Cada sucursal pertenece a una ciudad. Los envíos se emiten desde una sucursal y se dirigen a una ciudad:
        la carga Por Pagar la ven y pueden cobrar todas las sucursales de esa ciudad. Una sucursal nunca se borra:
        se desactiva y su historial se conserva.
      </p>
      <div className="filtros">
        <button className="btn primario" onClick={() => setForm(VACIA)}>+ Nueva sucursal</button>
      </div>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Nombre</th><th>Ciudad</th><th>Prefijo de boleta</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {sucursales.map((s) => (
              <tr key={s.id}>
                <td>{s.nombre}</td>
                <td>{s.ciudad}</td>
                <td>{s.prefijo}</td>
                <td><span className={s.activa ? 'badge azul' : 'badge'}>{s.activa ? 'Activa' : 'Inactiva'}</span></td>
                <td className="acciones">
                  <button className="btn" onClick={() => setForm({ id: s.id, nombre: s.nombre, ciudad: s.ciudad, prefijo: s.prefijo, activa: s.activa })}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal
          titulo={form.id ? 'Editar sucursal' : 'Nueva sucursal'}
          onCerrar={() => setForm(null)}
          acciones={
            <>
              <button className="btn" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn primario" onClick={guardar}>Guardar</button>
            </>
          }
        >
          <label className="campo">
            <span className="etiqueta">Nombre</span>
            <input value={form.nombre} onChange={(e) => set({ nombre: e.target.value })} autoFocus />
          </label>
          <label className="campo">
            <span className="etiqueta">Ciudad</span>
            <input
              value={form.ciudad}
              disabled={!!form.id}
              list="ciudades-existentes"
              onChange={(e) => set({ ciudad: e.target.value })}
              placeholder="Coyhaique"
            />
            <datalist id="ciudades-existentes">
              {ciudadesDe(sucursales).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <small>
              {form.id
                ? 'La ciudad no se puede cambiar: los envíos ya emitidos apuntan a ella.'
                : 'Elige una ciudad existente o escribe una nueva.'}
            </small>
          </label>
          <label className="campo">
            <span className="etiqueta">Prefijo de boleta (2 a 4 letras o números)</span>
            <input
              value={form.prefijo}
              maxLength={4}
              disabled={!!form.id}
              onChange={(e) => set({ prefijo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
              placeholder="CO2"
            />
            <small>
              {form.id
                ? 'El prefijo no se puede cambiar: las boletas ya emitidas lo llevan impreso.'
                : 'Las boletas de esta sucursal serán PREFIJO-000001, con numeración propia.'}
            </small>
          </label>
          <label className="check">
            <input type="checkbox" checked={form.activa} onChange={(e) => set({ activa: e.target.checked })} /> Activa
          </label>
        </Modal>
      )}
    </div>
  )
}
