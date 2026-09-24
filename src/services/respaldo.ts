import { api } from '../api'
import { claveDia } from '../lib/fechas'
import type { Respaldo, UsuarioSesion, Venta } from '../types'
import { auditar } from './auditoria'

/** Descarga un Blob como archivo. */
export function descargar(nombre: string, contenido: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

const sello = () => {
  const d = new Date()
  const hh = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join('-')
  return `${claveDia(d)}_${hh}`
}

export async function descargarRespaldo(actor: UsuarioSesion): Promise<void> {
  const r = await api.respaldo.exportar()
  descargar(`respaldo_${sello()}.json`, JSON.stringify(r), 'application/json')
  await auditar(actor, 'crear_respaldo', `Respaldo descargado: ${r.ventas.length} ventas, ${r.usuarios.length} usuarios`)
}

export async function restaurarRespaldo(actor: UsuarioSesion, archivo: File): Promise<{ ventas: number; usuarios: number }> {
  let datos: Respaldo
  try {
    datos = JSON.parse(await archivo.text())
  } catch {
    throw new Error('El archivo no es un JSON válido')
  }
  const res = await api.respaldo.importar(datos)
  await auditar(actor, 'restaurar_respaldo', `Restaurado "${archivo.name}": ${res.ventas} ventas, ${res.usuarios} usuarios`)
  return res
}

const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

export function ventasACsv(ventas: Venta[]): string {
  const cab = ['Boleta', 'Fecha', 'Destino', 'Item', 'Cantidad', 'Tipo', 'Destinatario', 'Remitente', 'Monto', 'Método', 'N° Operación', 'Vendedor', 'Tipo venta', 'Anulada', 'Motivo anulación']
  const filas = ventas.map((v) => [
    v.numeroBoleta, v.fecha, v.destino, v.item, v.cantidad, v.tipoProducto, v.destinatario, v.remitente,
    v.monto, v.metodoPago, v.numeroOperacion, v.usuarioNombre, v.tipoVenta, v.anulada ? 'Sí' : 'No', v.motivoAnulacion,
  ])
  // BOM para que Excel lea bien las tildes.
  return '﻿' + [cab, ...filas].map((f) => f.map(esc).join(';')).join('\r\n')
}

export async function descargarCsv(): Promise<void> {
  descargar(`ventas_${sello()}.csv`, ventasACsv(await api.ventas.listar()), 'text/csv;charset=utf-8')
}
