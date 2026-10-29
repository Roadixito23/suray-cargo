import { beforeEach, describe, expect, it } from 'vitest'
import { api } from '../api'
import { resetLocal } from '../api/localApi'
import type { NuevaVenta, UsuarioSesion } from '../types'
import { formatearRut, normalizarRut, validarRut } from '../lib/rut'
import {
  anularVenta, listarVentas, porPagarPendientes, registrarRetiro, registrarVenta, resumenCaja, retirosDelDia, siguienteItem, ventasDelDia,
} from './ventas'
import { ciudadDeSucursal } from '../lib/sucursales'
import { cargarSucursales, guardarSucursal, type DatosSucursal } from './sucursales'
import { login } from './usuarios'

const cajero: UsuarioSesion = {
  id: 'u1', nombre: 'Cajero', usuario: 'caj', esAdmin: false, sucursal: 'coyhaique', fechaCreacion: '',
}
const admin: UsuarioSesion = { ...cajero, id: 'a1', nombre: 'Admin', usuario: 'admin', esAdmin: true }

const base = (o: Partial<NuevaVenta> = {}): NuevaVenta => ({
  sucursalBoleta: 'coyhaique', monto: 1000, metodoPago: 'efectivo', destino: 'Puerto Aysén', item: '1', cantidad: '1',
  tipoProducto: 'Caja', destinatario: 'A', remitente: 'B', usuarioId: cajero.id, usuarioNombre: cajero.nombre,
  tipoVenta: 'venta', ...o,
})

beforeEach(async () => {
  resetLocal()
  await cargarSucursales() // el catálogo en memoria se reinicia junto con el almacenamiento local
})

describe('boletas', () => {
  it('numera correlativo por sucursal', async () => {
    expect((await registrarVenta(cajero, base())).numeroBoleta).toBe('COY-000001')
    expect((await registrarVenta(cajero, base())).numeroBoleta).toBe('COY-000002')
    expect((await registrarVenta(cajero, base({ sucursalBoleta: 'aysen', destino: 'Coyhaique' }))).numeroBoleta).toBe('AYS-000001')
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
      retiroMetodoPago: 'tarjeta', retiroUsuarioId: 'u2', sucursalRetiro: 'aysen',
    })
    expect(r.retiroFecha).toBeTruthy()
  })

  it('rechaza doble retiro, RUT inválido, datos vacíos y ventas que no son Por Pagar', async () => {
    const v = await registrarVenta(cajero, porPagar())
    await expect(registrarRetiro(secretaria, v, { ...datos, rut: '12345678-9' })).rejects.toThrow('RUT')
    await expect(registrarRetiro(secretaria, v, { ...datos, nombre: ' ' })).rejects.toThrow('nombre')
    await expect(registrarRetiro(secretaria, v, { ...datos, comprobante: '' })).rejects.toThrow('comprobante')
    await registrarRetiro(secretaria, v, datos)
    await expect(api.ventas.registrarRetiro(v.id, { ...datos, usuarioId: 'u2', usuarioNombre: 'S', sucursal: 'aysen' })).rejects.toThrow('ya fue retirada')
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
    await registrarVenta(cajero, porPagar({ sucursalBoleta: 'aysen', destino: 'Coyhaique' })) // no es para Aysén
    const pendientes = await porPagarPendientes(secretaria)
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0].destino).toBe('Puerto Aysén')
    expect(await listarVentas(secretaria)).toHaveLength(0) // el alcance general no cambia
  })
})

describe('ciudades con varias sucursales', () => {
  // Coyhaique tiene dos sucursales: la histórica y el Terminal, con su propio prefijo y correlativo.
  const terminal = { id: 'terminal', nombre: 'Terminal de Coyhaique', ciudad: 'Coyhaique', prefijo: 'TER', activa: true }
  const deAysen: UsuarioSesion = { ...cajero, id: 'ua', nombre: 'Ana', usuario: 'ana', sucursal: 'aysen' }
  const deCoy: UsuarioSesion = { ...cajero, id: 'uc', nombre: 'Carla', usuario: 'carla', sucursal: 'coyhaique' }
  const deTerminal: UsuarioSesion = { ...cajero, id: 'uk', nombre: 'Karla', usuario: 'karla', sucursal: 'terminal' }
  const desdeAysen = (o: Partial<NuevaVenta> = {}) =>
    base({ sucursalBoleta: 'aysen', destino: 'Coyhaique', usuarioId: deAysen.id, usuarioNombre: deAysen.nombre, ...o })
  const porPagar = (o: Partial<NuevaVenta> = {}) =>
    desdeAysen({ metodoPago: 'por_pagar', tipoVenta: 'por_pagar', numeroComprobante: null, monto: 4000, ...o })
  const datos = { comprobante: '9', nombre: 'Juan Pérez', rut: '12345678-5', metodoPago: 'efectivo' as const }

  beforeEach(async () => {
    await api.sucursales.guardar(terminal)
    await cargarSucursales()
  })

  it('numera cada sucursal con su propio prefijo y guarda el origen; el ticket sale por ciudad', async () => {
    const a = await registrarVenta(deTerminal, base({ sucursalBoleta: 'terminal', destino: 'Puerto Aysén' }))
    expect(a).toMatchObject({ numeroBoleta: 'TER-000001', sucursalOrigen: 'terminal', destino: 'Puerto Aysén' })
    expect(ciudadDeSucursal(a.sucursalOrigen)).toBe('Coyhaique')
    expect((await registrarVenta(deCoy, base({ sucursalBoleta: 'coyhaique', destino: 'Puerto Aysén' }))).numeroBoleta).toBe('COY-000001')
    expect(await api.ventas.peekNumeroBoleta('terminal')).toBe('TER-000002')
  })

  it('no se puede enviar a la misma ciudad de origen ni a una ciudad sin sucursales', async () => {
    await expect(registrarVenta(deTerminal, base({ sucursalBoleta: 'terminal', destino: 'Coyhaique' }))).rejects.toThrow('misma ciudad')
    await expect(registrarVenta(deAysen, desdeAysen({ destino: 'Santiago' }))).rejects.toThrow('destino')
  })

  it('una carga para Coyhaique la ven las dos sucursales de Coyhaique, y no la de Aysén', async () => {
    const v = await registrarVenta(deAysen, porPagar())
    expect((await porPagarPendientes(deCoy)).map((x) => x.id)).toEqual([v.id])
    expect((await porPagarPendientes(deTerminal)).map((x) => x.id)).toEqual([v.id])
    expect(await porPagarPendientes(deAysen)).toHaveLength(0)
  })

  it('cualquiera de las dos sucursales de la ciudad la cobra y deja de estar pendiente para ambas', async () => {
    const v = await registrarVenta(deAysen, porPagar())
    const cobrada = await registrarRetiro(deTerminal, v, datos)
    expect(cobrada).toMatchObject({ sucursalRetiro: 'terminal', retiroUsuarioId: 'uk', destino: 'Coyhaique' })
    expect(await porPagarPendientes(deCoy)).toHaveLength(0)
    const deKarla = resumenCaja(await ventasDelDia(deTerminal), await retirosDelDia(deTerminal))
    expect(deKarla).toMatchObject({ totalEfectivo: 4000, cantidadCobrosOtroDestino: 0 })
    expect(resumenCaja(await ventasDelDia(deCoy), await retirosDelDia(deCoy)).totalGeneral).toBe(0)
  })

  it('el admin ve todas las pendientes y filtra por ciudad', async () => {
    await registrarVenta(deAysen, porPagar())
    await registrarVenta(deCoy, base({ sucursalBoleta: 'coyhaique', destino: 'Puerto Aysén', metodoPago: 'por_pagar', tipoVenta: 'por_pagar', numeroComprobante: null }))
    expect(await porPagarPendientes(admin)).toHaveLength(2)
    expect((await porPagarPendientes(admin, { ciudad: 'Coyhaique' })).map((v) => v.destino)).toEqual(['Coyhaique'])
    expect((await porPagarPendientes(admin, { ciudad: 'Puerto Aysén' })).map((v) => v.destino)).toEqual(['Puerto Aysén'])
  })

  it('cobrar una carga de otra ciudad la suma a la caja de quien cobra y lo marca como cobro de otro destino', async () => {
    const v = await registrarVenta(deAysen, porPagar())
    expect(await porPagarPendientes(deAysen)).toHaveLength(0) // por defecto solo su ciudad
    expect((await porPagarPendientes(deAysen, { todas: true })).map((x) => x.id)).toEqual([v.id])

    const cobrada = await registrarRetiro(deAysen, v, datos)
    expect(cobrada).toMatchObject({ sucursalRetiro: 'aysen', retiroUsuarioId: 'ua', destino: 'Coyhaique' })
    const deAna = resumenCaja(await ventasDelDia(deAysen), await retirosDelDia(deAysen))
    expect(deAna).toMatchObject({ totalEfectivo: 4000, cantidadCobrosOtroDestino: 1, totalCobrosOtroDestino: 4000 })
    expect(await porPagarPendientes(deTerminal)).toHaveLength(0)
  })

  it('el admin cobra en una sucursal de la ciudad destino salvo que indique otra', async () => {
    const v1 = await registrarVenta(deAysen, porPagar())
    const v2 = await registrarVenta(deAysen, porPagar())
    expect(['coyhaique', 'terminal']).toContain((await registrarRetiro(admin, v1, datos)).sucursalRetiro)
    expect((await registrarRetiro(admin, v2, { ...datos, sucursal: 'aysen' })).sucursalRetiro).toBe('aysen')
  })

  it('no permite vender desde o hacia sucursales inactivas', async () => {
    await api.sucursales.guardar({ ...terminal, activa: false })
    await api.sucursales.guardar({ id: 'coyhaique', nombre: 'Coyhaique', ciudad: 'Coyhaique', prefijo: 'COY', activa: false })
    await cargarSucursales()
    await expect(registrarVenta(deAysen, desdeAysen())).rejects.toThrow('destino') // Coyhaique ya no tiene sucursales activas
    await expect(registrarVenta(deTerminal, base({ sucursalBoleta: 'terminal', destino: 'Puerto Aysén' }))).rejects.toThrow('sucursalBoleta')
  })

  it('respaldo: conserva sucursales, origen y contadores; uno antiguo traduce el destino a ciudad', async () => {
    await registrarVenta(deTerminal, base({ sucursalBoleta: 'terminal', destino: 'Puerto Aysén' }))
    const r = await api.respaldo.exportar()
    expect(r.sucursales?.find((x) => x.id === 'terminal')?.ciudad).toBe('Coyhaique')
    resetLocal()
    await api.respaldo.importar(r)
    expect(await api.ventas.peekNumeroBoleta('terminal')).toBe('TER-000002')

    // Respaldo anterior a las ciudades: el destino era el id de una sucursal y no había origen.
    const antiguo = {
      ...r,
      sucursales: undefined,
      ventas: r.ventas.map(({ sucursalOrigen: _o, sucursalRetiro: _s, ...v }) => ({ ...v, destino: 'coyhaique', numeroBoleta: 'AYS-000007' })),
    }
    resetLocal()
    await api.respaldo.importar(antiguo as never)
    expect((await api.ventas.listar())[0]).toMatchObject({ destino: 'Coyhaique', sucursalOrigen: 'aysen' })
  })
})

describe('gestión de sucursales', () => {
  it('valida ciudad, prefijo, nombres repetidos y que quede una activa; prefijo y ciudad no cambian al editar', async () => {
    const nueva = (o: Partial<DatosSucursal>) => ({ nombre: 'Nueva', ciudad: 'Coyhaique', prefijo: 'NUE', activa: true, ...o })
    await expect(guardarSucursal(admin, nueva({ prefijo: 'X' }))).rejects.toThrow('prefijo')
    await expect(guardarSucursal(admin, nueva({ prefijo: 'AYS' }))).rejects.toThrow('prefijo')
    await expect(guardarSucursal(admin, nueva({ nombre: 'aysén' }))).rejects.toThrow('nombre')
    await expect(guardarSucursal(admin, nueva({ ciudad: ' ' }))).rejects.toThrow('ciudad')

    // "coyhaique" en minúsculas reutiliza la ciudad existente en vez de crear otra.
    await guardarSucursal(admin, nueva({ nombre: 'Terminal de Coyhaique', ciudad: 'coyhaique', prefijo: 'ter' }))
    expect((await api.sucursales.listar()).find((s) => s.id === 'terminal_de_coyhaique')).toMatchObject({
      nombre: 'Terminal de Coyhaique', ciudad: 'Coyhaique', prefijo: 'TER', activa: true,
    })

    await guardarSucursal(admin, { id: 'terminal_de_coyhaique', nombre: 'Terminal', ciudad: 'Otra', prefijo: 'ZZZ', activa: true })
    expect((await api.sucursales.listar()).find((s) => s.id === 'terminal_de_coyhaique')).toMatchObject({
      nombre: 'Terminal', ciudad: 'Coyhaique', prefijo: 'TER',
    })

    const editar = (id: string, nombre: string, ciudad: string, prefijo: string, activa: boolean) =>
      guardarSucursal(admin, { id, nombre, ciudad, prefijo, activa })
    await editar('aysen', 'Aysén', 'Puerto Aysén', 'AYS', false)
    await editar('coyhaique', 'Coyhaique', 'Coyhaique', 'COY', false)
    await expect(editar('terminal_de_coyhaique', 'Terminal', 'Coyhaique', 'TER', false)).rejects.toThrow('al menos una')
  })
})

describe('envíos que llegan a la sucursal', () => {
  it('un usuario de destino los encuentra con destinoLlegada, sin ampliar el alcance por defecto', async () => {
    const receptor: UsuarioSesion = { ...cajero, id: 'u2', nombre: 'Receptor', usuario: 'rec', sucursal: 'aysen' }
    await registrarVenta(cajero, base()) // coyhaique → aysen, efectivo
    await registrarVenta(cajero, base({ sucursalBoleta: 'aysen', destino: 'Coyhaique' })) // no llega a Aysén
    expect(await listarVentas(receptor)).toHaveLength(0)
    const llegadas = await listarVentas(receptor, { destinoLlegada: 'Puerto Aysén' })
    expect(llegadas).toHaveLength(1)
    expect(llegadas[0].destino).toBe('Puerto Aysén')
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

describe('ítem por destinatario', () => {
  it('parte en 1 y sigue desde el mayor ítem usado, también si fue personalizado', async () => {
    expect(siguienteItem([])).toBe(1)
    await registrarVenta(cajero, base({ item: '1', cantidad: '3' })) // 3 paquetes, un solo ítem
    expect(siguienteItem(await ventasDelDia(cajero))).toBe(2)
    await registrarVenta(cajero, base({ item: '12' })) // ítem personalizado
    expect(siguienteItem(await ventasDelDia(cajero))).toBe(13)
  })
})
