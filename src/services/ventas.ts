import { api } from '../api'
import { finDelDia, inicioDelDia } from '../lib/fechas'
import { etiquetaMetodo, formatoMonto, nombreSucursal } from '../lib/format'
import { formatearRut, validarRut } from '../lib/rut'
import type { FiltroVentas, MetodoCobro, NuevaVenta, UsuarioSesion, Venta } from '../types'
import { auditar } from './auditoria'

/** Admin ve todo; el resto solo sus propias ventas. */
export function alcance(usuario: UsuarioSesion): FiltroVentas {
  return usuario.esAdmin ? {} : { usuarioId: usuario.id }
}

export function listarVentas(usuario: UsuarioSesion, filtro: FiltroVentas = {}) {
  return api.ventas.listar({ ...filtro, ...alcance(usuario) })
}

/**
 * Ventas del día de ESTE usuario. El cierre de caja es individual: ni siquiera un admin
 * mezcla las ventas de otras personas (para eso está el Histórico). El filtro final por
 * `usuarioId` es un resguardo por si el origen de datos devolviera filas ajenas.
 */
export async function ventasDelDia(usuario: UsuarioSesion, dia = new Date()) {
  const ventas = await api.ventas.listar({ desde: inicioDelDia(dia), hasta: finDelDia(dia), usuarioId: usuario.id })
  return ventas.filter((v) => v.usuarioId === usuario.id)
}

export async function registrarVenta(usuario: UsuarioSesion, datos: NuevaVenta): Promise<Venta> {
  const venta = await api.ventas.crear(datos)
  await auditar(
    usuario,
    'crear_venta',
    `Boleta ${venta.numeroBoleta} — ${nombreSucursal(venta.destino)} — ${formatoMonto(venta.monto)} (${etiquetaMetodo(venta.metodoPago)})`,
    venta.id,
    'ventas',
  )
  return venta
}

export async function anularVenta(usuario: UsuarioSesion, venta: Venta, motivo: string): Promise<Venta> {
  const texto = motivo.trim()
  if (!texto) throw new Error('Debes ingresar un motivo')
  if (!usuario.esAdmin && venta.usuarioId !== usuario.id) {
    throw new Error('Solo puedes anular tus propias ventas')
  }
  const anulada = await api.ventas.anular(venta.id, texto, usuario.nombre)
  await auditar(
    usuario,
    'anular_venta',
    `Anulación de boleta ${venta.numeroBoleta} — Motivo: ${texto}`,
    venta.id,
    'ventas',
  )
  return anulada
}

// ── Por Pagar: retiro en la sucursal destino ────────────────────────────────────

/** Cargas Por Pagar que esperan retiro: las que llegan a la sucursal del usuario (admin: todas). */
export async function porPagarPendientes(usuario: UsuarioSesion): Promise<Venta[]> {
  const ventas = await api.ventas.listar(usuario.esAdmin ? {} : { usuarioId: usuario.id, porPagarDestino: usuario.sucursal })
  return ventas.filter(
    (v) =>
      v.tipoVenta === 'por_pagar' &&
      !v.anulada &&
      !v.retiroFecha &&
      (usuario.esAdmin || v.destino === usuario.sucursal),
  )
}

/** Retiros cobrados en el día por este usuario (nunca los de otros, ni siquiera siendo admin); alimentan su cierre. */
export async function retirosDelDia(usuario: UsuarioSesion, dia = new Date()) {
  const ventas = await api.ventas.listar({
    retiroDesde: inicioDelDia(dia),
    retiroHasta: finDelDia(dia),
    retiroUsuarioId: usuario.id,
  })
  return ventas.filter((v) => v.retiroUsuarioId === usuario.id)
}

/** Retiros cobrados por el usuario desde una fecha (admin: de todos); para el Histórico. */
export function retirosDesde(usuario: UsuarioSesion, desde: Date) {
  return api.ventas.listar({ retiroDesde: desde, ...(usuario.esAdmin ? {} : { retiroUsuarioId: usuario.id }) })
}

export interface DatosNuevoRetiro {
  comprobante: string
  nombre: string
  rut: string
  metodoPago: MetodoCobro
}

export async function registrarRetiro(usuario: UsuarioSesion, venta: Venta, datos: DatosNuevoRetiro): Promise<Venta> {
  const comprobante = datos.comprobante.trim()
  const nombre = datos.nombre.trim()
  if (venta.tipoVenta !== 'por_pagar') throw new Error('La venta no es Por Pagar')
  if (venta.anulada) throw new Error('La venta está anulada')
  if (venta.retiroFecha) throw new Error('La carga ya fue retirada')
  if (!comprobante) throw new Error('Debes ingresar el N° de comprobante')
  if (!nombre) throw new Error('Debes ingresar el nombre de quien retira')
  if (!validarRut(datos.rut)) throw new Error('El RUT no es válido')
  const retirada = await api.ventas.registrarRetiro(venta.id, {
    comprobante,
    nombre,
    rut: formatearRut(datos.rut),
    metodoPago: datos.metodoPago,
    usuarioId: usuario.id,
    usuarioNombre: usuario.nombre,
  })
  await auditar(
    usuario,
    'retirar_carga',
    `Retiro de boleta ${venta.numeroBoleta} — ${nombre} (${formatearRut(datos.rut)}) — ${formatoMonto(venta.monto)} (${etiquetaMetodo(datos.metodoPago)}) — Comprobante ${comprobante}`,
    venta.id,
    'ventas',
  )
  return retirada
}

// ── Cálculos (puros) ────────────────────────────────────────────────────────────

export interface ResumenCaja {
  totalEfectivo: number
  totalTarjeta: number
  totalGeneral: number
  cantidadEfectivo: number
  cantidadTarjeta: number
  totalAnulaciones: number
  cantidadAnulaciones: number
}

/**
 * Regla de negocio: suman las ventas no anuladas de tipo 'venta' (por_pagar / por_facturar no generan
 * ingreso al venderse) y los retiros Por Pagar cobrados en el período, según su método de cobro.
 */
export function resumenCaja(ventas: Venta[], retiros: Venta[] = []): ResumenCaja {
  const activas = ventas.filter((v) => !v.anulada && v.tipoVenta === 'venta')
  const anuladas = ventas.filter((v) => v.anulada)
  const cobrados = retiros.filter((v) => !v.anulada && v.retiroFecha)
  const efectivo = [...activas.filter((v) => v.metodoPago === 'efectivo'), ...cobrados.filter((v) => v.retiroMetodoPago === 'efectivo')]
  const tarjeta = [...activas.filter((v) => v.metodoPago === 'tarjeta'), ...cobrados.filter((v) => v.retiroMetodoPago === 'tarjeta')]
  const suma = (l: Venta[]) => l.reduce((s, v) => s + v.monto, 0)
  return {
    totalEfectivo: suma(efectivo),
    totalTarjeta: suma(tarjeta),
    totalGeneral: suma(efectivo) + suma(tarjeta),
    cantidadEfectivo: efectivo.length,
    cantidadTarjeta: tarjeta.length,
    totalAnulaciones: suma(anuladas),
    cantidadAnulaciones: anuladas.length,
  }
}
