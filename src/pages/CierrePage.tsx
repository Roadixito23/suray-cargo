import { useEffect, useMemo, useState } from 'react'
import { useUsuario } from '../auth/AuthContext'
import { Modal } from '../components/Modal'
import { useImprimir } from '../components/PrintContext'
import { ReporteCierre } from '../components/ReporteCierre'
import { ListaVentasDia, TarjetasResumen } from '../components/ResumenDia'
import { useToast } from '../components/Toast'
import { formatoFecha } from '../lib/format'
import { resumenCaja, ventasDelDia } from '../services/ventas'
import type { Venta } from '../types'

/** El cierre es un reporte: no borra ni bloquea ventas (regla de negocio, ver bóveda). */
export function CierrePage() {
  const usuario = useUsuario()
  const imprimir = useImprimir()
  const toast = useToast()
  const [ventas, setVentas] = useState<Venta[]>([])
  const [confirmar, setConfirmar] = useState(false)

  useEffect(() => {
    ventasDelDia(usuario).then(setVentas)
  }, [usuario])

  const resumen = useMemo(() => resumenCaja(ventas), [ventas])
  const anuladas = ventas.filter((v) => v.anulada)
  const activas = ventas.filter((v) => !v.anulada)

  function cerrar() {
    setConfirmar(false)
    imprimir(<ReporteCierre fecha={new Date()} resumen={resumen} usuarioNombre={usuario.nombre} />)
    toast('Cierre de caja realizado. Reporte generado.')
  }

  return (
    <div className="panel">
      <h2>Cierre de caja — {formatoFecha(new Date())}</h2>
      <p className="sub">{usuario.esAdmin ? 'Todas las ventas del día' : 'Tus ventas del día'}</p>
      <TarjetasResumen r={resumen} />
      <button className="btn primario grande" onClick={() => setConfirmar(true)}>Realizar cierre de caja</button>

      <h3>Ventas del día</h3>
      <ListaVentasDia ventas={activas} admin={usuario.esAdmin} />
      {anuladas.length > 0 && (
        <>
          <h3>Ventas anuladas</h3>
          <ListaVentasDia ventas={anuladas} admin={usuario.esAdmin} />
        </>
      )}

      {confirmar && (
        <Modal
          titulo="Confirmar cierre de caja"
          onCerrar={() => setConfirmar(false)}
          acciones={
            <>
              <button className="btn" onClick={() => setConfirmar(false)}>Cancelar</button>
              <button className="btn primario" onClick={cerrar}>Confirmar</button>
            </>
          }
        >
          ¿Realizar el cierre de caja? Se generará el reporte del día. Las ventas no se eliminan.
        </Modal>
      )}
    </div>
  )
}
