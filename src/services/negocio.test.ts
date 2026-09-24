import { beforeEach, describe, expect, it } from 'vitest'
import { api } from '../api'
import { resetLocal } from '../api/localApi'
import type { NuevaVenta, UsuarioSesion } from '../types'
import { anularVenta, listarVentas, registrarVenta, resumenCaja } from './ventas'
import { login } from './usuarios'

const cajero: UsuarioSesion = {
  id: 'u1', nombre: 'Cajero', usuario: 'caj', esAdmin: false, sucursal: 'coyhaique', fechaCreacion: '',
}
const admin: UsuarioSesion = { ...cajero, id: 'a1', nombre: 'Admin', usuario: 'admin', esAdmin: true }

const base = (o: Partial<NuevaVenta> = {}): NuevaVenta => ({
  sucursalBoleta: 'coyhaique', monto: 1000, metodoPago: 'efectivo', destino: 'aysen', item: '1', cantidad: '1',
  tipoProducto: 'Caja', destinatario: 'A', remitente: 'B', usuarioId: cajero.id, usuarioNombre: cajero.nombre,
  tipoVenta: 'venta', ...o,
})

beforeEach(() => resetLocal())

describe('boletas', () => {
  it('numera correlativo por sucursal', async () => {
    expect((await registrarVenta(cajero, base())).numeroBoleta).toBe('COY-000001')
    expect((await registrarVenta(cajero, base())).numeroBoleta).toBe('COY-000002')
    expect((await registrarVenta(cajero, base({ sucursalBoleta: 'aysen' }))).numeroBoleta).toBe('AYS-000001')
    expect(await api.ventas.peekNumeroBoleta('coyhaique')).toBe('COY-000003')
  })
})

describe('anulación', () => {
  it('exige motivo, no permite doble anulación y conserva la venta', async () => {
    const v = await registrarVenta(cajero, base())
    await expect(anularVenta(cajero, v, '  ')).rejects.toThrow('motivo')
    const a = await anularVenta(cajero, v, 'Error de digitación')
    expect(a.anulada).toBe(true)
    await expect(anularVenta(cajero, v, 'otra vez')).rejects.toThrow('ya está anulada')
    expect(await api.ventas.listar()).toHaveLength(1)
  })

  it('un usuario no puede anular ventas ajenas, un admin sí', async () => {
    const v = await registrarVenta(cajero, base({ usuarioId: 'otro' }))
    await expect(anularVenta(cajero, v, 'x')).rejects.toThrow('propias')
    await expect(anularVenta(admin, v, 'x')).resolves.toBeTruthy()
  })
})

describe('alcance por rol', () => {
  it('usuario ve solo lo suyo; admin todo', async () => {
    await registrarVenta(cajero, base())
    await registrarVenta(cajero, base({ usuarioId: 'otro' }))
    expect(await listarVentas(cajero)).toHaveLength(1)
    expect(await listarVentas(admin)).toHaveLength(2)
  })
})

describe('resumen de caja', () => {
  it('excluye anuladas y por_pagar/por_facturar; separa por método', async () => {
    const a = await registrarVenta(cajero, base({ monto: 1000 }))
    await registrarVenta(cajero, base({ monto: 2000, metodoPago: 'tarjeta' }))
    await registrarVenta(cajero, base({ monto: 500, tipoVenta: 'por_pagar' }))
    const c = await registrarVenta(cajero, base({ monto: 300 }))
    await anularVenta(cajero, c, 'x')
    const r = resumenCaja(await api.ventas.listar())
    expect(r).toMatchObject({
      totalEfectivo: 1000, totalTarjeta: 2000, totalGeneral: 3000,
      cantidadEfectivo: 1, cantidadTarjeta: 1, totalAnulaciones: 300, cantidadAnulaciones: 1,
    })
    expect(a.id).toBeTruthy()
  })
})

describe('login y respaldo', () => {
  it('admin inicial entra con admin/admin y rechaza claves malas', async () => {
    expect(await login('admin', 'mala')).toBeNull()
    const s = await login('admin', 'admin')
    expect(s?.esAdmin).toBe(true)
    expect(s).not.toHaveProperty('contrasena')
  })

  it('exporta/importa y reconstruye contadores', async () => {
    await registrarVenta(cajero, base())
    await registrarVenta(cajero, base())
    const r = await api.respaldo.exportar()
    resetLocal()
    await api.respaldo.importar(r)
    expect(await api.ventas.listar()).toHaveLength(2)
    expect(await api.ventas.peekNumeroBoleta('coyhaique')).toBe('COY-000003')
  })
})
