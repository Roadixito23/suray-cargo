import { useEffect, useMemo, useState } from 'react'
import { useUsuario } from '../auth/AuthContext'
import { Modal } from '../components/Modal'
import { useImprimir } from '../components/PrintContext'
import { ReporteCierre } from '../components/ReporteCierre'
import { ListaRetiros, ListaVentasDia, TarjetasResumen } from '../components/ResumenDia'
import { useToast } from '../components/Toast'
import { formatoFecha, nombreSucursal } from '../lib/format'
import { resumenCaja, retirosDelDia, ventasDelDia } from '../services/ventas'
import type { Venta } from '../types'

/** El cierre es un reporte: no borra ni bloquea ventas (regla de negocio, ver bóveda). */
export function CierrePage() {
  const usuario = useUsuario()
  const imprimir = useImprimir()
  const toast = useToast()
  const [ventas, setVentas] = useState<Venta[]>([])
  const [retiros, setRetiros] = useState<Venta[]>([])
  const [confirmar, setConfirmar] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    Promise.all([ventasDelDia(usuario), retirosDelDia(usuario)])
      .then(([v, r]) => {
        setVentas(v)
        setRetiros(r)
      })
      .finally(() => setCargando(false))
  }, [usuario])

  const resumen = useMemo(() => resumenCaja(ventas, retiros), [ventas, retiros])
  const anuladas = ventas.filter((v) => v.anulada)
  const activas = ventas.filter((v) => !v.anulada)

  function cerrar() {
    setConfirmar(false)
    imprimir(<ReporteCierre fecha={new Date()} resumen={resumen} usuarioNombre={usuario.nombre} sucursalNombre={nombreSucursal(usuario.sucursal)} />)
    toast('Cierre de caja realizado. Reporte generado.')
  }

  return (
    <div className="panel">
      <h2>Cierre de caja — {formatoFecha(new Date())}</h2>
      <p className="sub">Cierre individual de {usuario.nombre}: solo tus ventas y cobros del día</p>
      <TarjetasResumen r={resumen} cargando={cargando} />
      <button className="btn primario grande" disabled={cargando} onClick={() => setConfirmar(true)}>Realizar cierre de caja</button>

      <h3>Ventas del día</h3>
      <ListaVentasDia ventas={activas} admin={false} cargando={cargando} />
      {retiros.length > 0 && (
        <>
          <h3>Retiros Por Pagar cobrados hoy</h3>
          <ListaRetiros retiros={retiros} />
        </>
      )}
      {anuladas.length > 0 && (
        <>
          <h3>Ventas anuladas</h3>
          <ListaVentasDia ventas={anuladas} admin={false} />
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
