import { api } from '../api'
import { finDelDia, inicioDelDia } from '../lib/fechas'
import { etiquetaMetodo, formatoMonto, nombreSucursal } from '../lib/format'
import type { FiltroVentas, NuevaVenta, UsuarioSesion, Venta } from '../types'
import { auditar } from './auditoria'

/** Admin ve todo; el resto solo sus propias ventas. */
export function alcance(usuario: UsuarioSesion): FiltroVentas {
  return usuario.esAdmin ? {} : { usuarioId: usuario.id }
}

export function listarVentas(usuario: UsuarioSesion, filtro: FiltroVentas = {}) {
  return api.ventas.listar({ ...filtro, ...alcance(usuario) })
}

export function ventasDelDia(usuario: UsuarioSesion, dia = new Date()) {
  return listarVentas(usuario, { desde: inicioDelDia(dia), hasta: finDelDia(dia) })
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
 * Regla de negocio: solo suman ventas no anuladas de tipo 'venta'
 * (por_pagar / por_facturar no generan ingreso de caja).
 */
export function resumenCaja(ventas: Venta[]): ResumenCaja {
  const activas = ventas.filter((v) => !v.anulada && v.tipoVenta === 'venta')
  const anuladas = ventas.filter((v) => v.anulada)
  const efectivo = activas.filter((v) => v.metodoPago === 'efectivo')
  const tarjeta = activas.filter((v) => v.metodoPago === 'tarjeta')
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
