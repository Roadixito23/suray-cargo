import { useEffect, useState } from 'react'
import { useUsuario } from '../auth/AuthContext'
import { nombreSucursal } from '../lib/format'
import { guardar, leer } from '../lib/storage'
import { CLAVE_OMITIR, migrarUsuarios, pendientesDeMigrar, type ItemMigracion } from '../services/migracionLocal'
import { Modal } from './Modal'
import { useToast } from './Toast'

/** Se pregunta una vez por carga de la página, salvo que el administrador elija "No volver a preguntar". */
let preguntado = false

/**
 * Si este equipo aún guarda usuarios en localStorage que no existen en la base, ofrece agregarlos.
 * Solo se monta para administradores.
 */
export function MigracionLocal() {
  const actor = useUsuario()
  const toast = useToast()
  const [items, setItems] = useState<ItemMigracion[] | null>(null)
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    if (preguntado || leer<boolean>(CLAVE_OMITIR, false)) return
    preguntado = true
    pendientesDeMigrar()
      .then((lista) => {
        if (!lista.some((i) => i.decision === 'agregar')) return
        setItems(lista)
        setElegidos(new Set(lista.filter((i) => i.decision === 'agregar').map((i) => i.local.id)))
      })
      .catch((e) => console.error('No se pudo revisar el localStorage', e))
  }, [])

  if (!items) return null

  const nuevos = items.filter((i) => i.decision === 'agregar')
  const existentes = items.filter((i) => i.decision === 'existe')
  const invalidos = items.filter((i) => i.decision === 'invalido')
  const cerrar = () => setItems(null)

  function alternar(id: string) {
    setElegidos((s) => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })
  }

  function noPreguntarMas() {
    try {
      guardar(CLAVE_OMITIR, true)
    } catch {
      /* sin almacenamiento: se preguntará de nuevo en la próxima carga */
    }
    cerrar()
  }

  async function agregar() {
    setTrabajando(true)
    try {
      const r = await migrarUsuarios(actor, nuevos.filter((i) => elegidos.has(i.local.id)).map((i) => i.local))
      if (r.agregados.length) toast(`Usuarios agregados a la base: ${r.agregados.length}`)
      if (r.omitidos.length) toast(`Ya existían (no se modificaron): ${r.omitidos.join(', ')}`, 'aviso')
      for (const f of r.fallidos) toast(`No se pudo agregar "${f.usuario}": ${f.error}`, 'error')
    } finally {
      setTrabajando(false)
      cerrar()
    }
  }

  return (
    <Modal
      titulo="Usuarios guardados en este equipo"
      onCerrar={cerrar}
      acciones={
        <>
          <button className="btn" onClick={cerrar} disabled={trabajando}>Ahora no</button>
          <button className="btn" onClick={noPreguntarMas} disabled={trabajando}>No volver a preguntar</button>
          <button className="btn primario" onClick={agregar} disabled={trabajando || elegidos.size === 0}>
            {trabajando ? 'Agregando…' : `Agregar ${elegidos.size} a la base`}
          </button>
        </>
      }
    >
      <p>
        Este equipo tiene usuarios guardados localmente que <strong>no existen en la base de datos</strong>. ¿Quieres
        agregarlos?
      </p>
      <div className="tabla-scroll">
        <table>
          <tbody>
            {nuevos.map(({ local }) => (
              <tr key={local.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={elegidos.has(local.id)}
                    onChange={() => alternar(local.id)}
                    aria-label={`Agregar ${local.usuario}`}
                  />
                </td>
                <td>{local.nombre}</td>
                <td>{local.usuario}</td>
                <td>{local.esAdmin ? 'Administrador' : nombreSucursal(local.sucursal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(existentes.length > 0 || invalidos.length > 0) && (
        <details>
          <summary>
            {existentes.length > 0 && `${existentes.length} ya existen en la base`}
            {existentes.length > 0 && invalidos.length > 0 && ' · '}
            {invalidos.length > 0 && `${invalidos.length} no se pueden migrar`}
          </summary>
          <small>
            Los que ya existen <strong>no se modifican</strong>: la base de datos tiene prioridad (nombre, sucursal, rol
            y contraseña).
          </small>
          <ul>
            {existentes.map(({ local, diferencias }) => (
              <li key={local.id}>
                {local.usuario}
                {diferencias.length > 0 && <small> — difiere en {diferencias.join('; ')}</small>}
              </li>
            ))}
            {invalidos.map(({ local, motivo }) => (
              <li key={local.id}>
                {local.usuario} <small>— {motivo}</small>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Modal>
  )
}
