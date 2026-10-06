import { beforeEach, describe, expect, it } from 'vitest'
import { api } from '../api'
import { resetLocal } from '../api/localApi'
import type { NuevaVenta, UsuarioSesion } from '../types'
import { formatearRut, normalizarRut, validarRut } from '../lib/rut'
import {
  anularVenta, listarVentas, porPagarPendientes, registrarRetiro, registrarVenta, resumenCaja, retirosDelDia, ventasDelDia,
} from './ventas'
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

describe('cierre de caja individual', () => {
  const ana: UsuarioSesion = { ...cajero, id: 'u2', nombre: 'Ana', usuario: 'ana' }
  const venta = (u: UsuarioSesion, o: Partial<NuevaVenta> = {}) =>
    registrarVenta(u, base({ usuarioId: u.id, usuarioNombre: u.nombre, ...o }))

  it('cada secretaria de la misma sucursal ve solo sus ventas y retiros', async () => {
    await venta(cajero, { monto: 1000 })
    await venta(ana, { monto: 2500 })
    const porPagar = await venta(ana, { metodoPago: 'por_pagar', tipoVenta: 'por_pagar', numeroComprobante: null, monto: 7000 })
    await registrarRetiro(cajero, porPagar, { comprobante: '1', nombre: 'Juan', rut: '12345678-5', metodoPago: 'efectivo' })

    const deCajero = resumenCaja(await ventasDelDia(cajero), await retirosDelDia(cajero))
    const deAna = resumenCaja(await ventasDelDia(ana), await retirosDelDia(ana))
    expect(deCajero.totalGeneral).toBe(1000 + 7000) // su venta + el retiro que él cobró
    expect(deAna.totalGeneral).toBe(2500) // el Por Pagar de Ana se cobró en caja de otra persona
  })

  it('un admin tampoco mezcla ventas ajenas en su propio cierre', async () => {
    await venta(cajero)
    await venta(admin, { monto: 300 })
    const mias = await ventasDelDia(admin)
    expect(mias).toHaveLength(1)
    expect(mias[0].usuarioId).toBe(admin.id)
  })
})

describe('Por Pagar', () => {
  const secretaria: UsuarioSesion = { ...cajero, id: 'u2', nombre: 'Secretaria', usuario: 'sec', sucursal: 'aysen' }
  const porPagar = (o: Partial<NuevaVenta> = {}) =>
    base({ metodoPago: 'por_pagar', tipoVenta: 'por_pagar', numeroComprobante: null, monto: 5000, ...o })
  const datos = { comprobante: '123', nombre: 'Juan Pérez', rut: '12345678-5', metodoPago: 'efectivo' as const }

  it('no suma a caja al venderse; sí al retirarse, según el método de cobro', async () => {
    const v = await registrarVenta(cajero, porPagar())
    expect(resumenCaja(await api.ventas.listar()).totalGeneral).toBe(0)
    await registrarRetiro(secretaria, v, datos)
    const r = resumenCaja([], await retirosDelDia(secretaria))
    expect(r).toMatchObject({ totalEfectivo: 5000, totalTarjeta: 0, totalGeneral: 5000, cantidadEfectivo: 1 })
  })

  it('guarda comprobante, retirante y fecha; formatea el RUT', async () => {
    const v = await registrarVenta(cajero, porPagar())
    const r = await registrarRetiro(secretaria, v, { ...datos, rut: '12345678-5', metodoPago: 'tarjeta' })
    expect(r).toMatchObject({
      numeroComprobante: '123', retiroNombre: 'Juan Pérez', retiroRut: '12.345.678-5',
      retiroMetodoPago: 'tarjeta', retiroUsuarioId: 'u2',
    })
    expect(r.retiroFecha).toBeTruthy()
  })

  it('rechaza doble retiro, RUT inválido, datos vacíos y ventas que no son Por Pagar', async () => {
    const v = await registrarVenta(cajero, porPagar())
    await expect(registrarRetiro(secretaria, v, { ...datos, rut: '12345678-9' })).rejects.toThrow('RUT')
    await expect(registrarRetiro(secretaria, v, { ...datos, nombre: ' ' })).rejects.toThrow('nombre')
    await expect(registrarRetiro(secretaria, v, { ...datos, comprobante: '' })).rejects.toThrow('comprobante')
    await registrarRetiro(secretaria, v, datos)
    await expect(api.ventas.registrarRetiro(v.id, { ...datos, usuarioId: 'u2', usuarioNombre: 'S' })).rejects.toThrow('ya fue retirada')
    const normal = await registrarVenta(cajero, base())
    await expect(registrarRetiro(secretaria, normal, datos)).rejects.toThrow('no es Por Pagar')
  })

  it('no se puede retirar una carga anulada', async () => {
    const v = await registrarVenta(cajero, porPagar())
    const anulada = await anularVenta(cajero, v, 'error')
    await expect(registrarRetiro(secretaria, anulada, datos)).rejects.toThrow('anulada')
  })

  it('la secretaria de destino ve las pendientes de su sucursal y no las de otra', async () => {
    await registrarVenta(cajero, porPagar()) // coyhaique → aysen
    await registrarVenta(cajero, porPagar({ destino: 'coyhaique' }))
    const pendientes = await porPagarPendientes(secretaria)
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0].destino).toBe('aysen')
    expect(await listarVentas(secretaria)).toHaveLength(0) // el alcance general no cambia
  })
})

describe('envíos que llegan a la sucursal', () => {
  it('un usuario de destino los encuentra con destinoLlegada, sin ampliar el alcance por defecto', async () => {
    const receptor: UsuarioSesion = { ...cajero, id: 'u2', nombre: 'Receptor', usuario: 'rec', sucursal: 'aysen' }
    await registrarVenta(cajero, base()) // coyhaique → aysen, efectivo
    await registrarVenta(cajero, base({ destino: 'coyhaique' })) // no llega a Aysen
    expect(await listarVentas(receptor)).toHaveLength(0)
    const llegadas = await listarVentas(receptor, { destinoLlegada: 'aysen' })
    expect(llegadas).toHaveLength(1)
    expect(llegadas[0].destino).toBe('aysen')
  })
})

describe('RUT', () => {
  it('valida dígito verificador y formatea', () => {
    expect(validarRut('12.345.678-5')).toBe(true)
    expect(validarRut('12345678-9')).toBe(false)
    expect(validarRut('1-9')).toBe(false)
    expect(formatearRut('123456785')).toBe('12.345.678-5')
    expect(normalizarRut('12.345.678-k')).toBe('12345678K')
  })
})
