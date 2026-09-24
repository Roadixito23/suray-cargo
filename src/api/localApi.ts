import { sha256 } from '../lib/hash'
import { borrar, guardar, leer } from '../lib/storage'
import { prefijoBoleta } from '../lib/format'
import type { Api } from './types'
import type {
  FiltroAuditoria,
  FiltroVentas,
  RegistroAuditoria,
  Sucursal,
  Usuario,
  Venta,
} from '../types'

const K = {
  ventas: 'ventas',
  usuarios: 'usuarios',
  auditoria: 'auditoria',
  contadores: 'contadores',
}

type Contadores = Record<Sucursal, number>

const leerContadores = () => leer<Contadores>(K.contadores, { aysen: 0, coyhaique: 0 })
const formatoBoleta = (s: Sucursal, n: number) => `${prefijoBoleta(s)}-${String(n).padStart(6, '0')}`

let idSeq = 0
const nuevoId = () => `${Date.now()}${String(idSeq++ % 1000).padStart(3, '0')}`

/** Usuario inicial (solo si no existe). Cambiar la contraseña al primer ingreso. */
async function asegurarAdmin(): Promise<void> {
  const usuarios = leer<Usuario[]>(K.usuarios, [])
  if (usuarios.some((u) => u.usuario === 'admin')) return
  usuarios.push({
    id: nuevoId(),
    nombre: 'Administrador',
    usuario: 'admin',
    contrasena: await sha256('admin'),
    esAdmin: true,
    fechaCreacion: new Date().toISOString(),
    sucursal: 'aysen',
  })
  guardar(K.usuarios, usuarios)
}

/** Promesa compartida: cada lectura de usuarios espera a que exista el admin. */
let listo = asegurarAdmin()

export const localApi: Api = {
  ventas: {
    async listar(filtro: FiltroVentas = {}) {
      const { desde, hasta, usuarioId } = filtro
      return leer<Venta[]>(K.ventas, [])
        .filter((v) => {
          const t = new Date(v.fecha).getTime()
          if (desde && t < desde.getTime()) return false
          if (hasta && t > hasta.getTime()) return false
          if (usuarioId && v.usuarioId !== usuarioId) return false
          return true
        })
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    },

    async obtener(id) {
      return leer<Venta[]>(K.ventas, []).find((v) => v.id === id) ?? null
    },

    async crear(nueva) {
      const { sucursalBoleta, ...datos } = nueva
      // Lectura + incremento + escritura son síncronos: atómico dentro del navegador.
      const contadores = leerContadores()
      contadores[sucursalBoleta] += 1
      const venta: Venta = {
        ...datos,
        id: nuevoId(),
        numeroBoleta: formatoBoleta(sucursalBoleta, contadores[sucursalBoleta]),
        fecha: new Date().toISOString(),
        anulada: false,
        motivoAnulacion: null,
        fechaAnulacion: null,
        usuarioAnulacion: null,
      }
      const ventas = leer<Venta[]>(K.ventas, [])
      ventas.push(venta)
      guardar(K.ventas, ventas)
      guardar(K.contadores, contadores)
      return venta
    },

    async anular(id, motivo, usuarioNombre) {
      const ventas = leer<Venta[]>(K.ventas, [])
      const v = ventas.find((x) => x.id === id)
      if (!v) throw new Error('Venta no encontrada')
      if (v.anulada) throw new Error('La venta ya está anulada')
      v.anulada = true
      v.motivoAnulacion = motivo
      v.fechaAnulacion = new Date().toISOString()
      v.usuarioAnulacion = usuarioNombre
      guardar(K.ventas, ventas)
      return v
    },

    async peekNumeroBoleta(sucursal) {
      return formatoBoleta(sucursal, leerContadores()[sucursal] + 1)
    },
  },

  usuarios: {
    async listar() {
      await listo
      return leer<Usuario[]>(K.usuarios, [])
    },
    async buscarPorLogin(login) {
      await listo
      return leer<Usuario[]>(K.usuarios, []).find((u) => u.usuario === login) ?? null
    },
    async obtener(id) {
      await listo
      return leer<Usuario[]>(K.usuarios, []).find((u) => u.id === id) ?? null
    },
    async verificarLogin(login, hash) {
      await listo
      const u = leer<Usuario[]>(K.usuarios, []).find((x) => x.usuario === login && x.contrasena === hash)
      if (!u) return null
      const { contrasena: _c, ...resto } = u
      return resto
    },
    async guardar(datos) {
      await listo
      const { contrasenaHash, ...resto } = datos
      const usuarios = leer<Usuario[]>(K.usuarios, [])
      const i = usuarios.findIndex((x) => x.id === resto.id)
      if (i >= 0) usuarios[i] = { ...resto, contrasena: contrasenaHash ?? usuarios[i].contrasena }
      else {
        if (!contrasenaHash) throw new Error('La contraseña es obligatoria')
        usuarios.push({ ...resto, contrasena: contrasenaHash })
      }
      guardar(K.usuarios, usuarios)
    },
    async eliminar(id) {
      guardar(
        K.usuarios,
        leer<Usuario[]>(K.usuarios, []).filter((u) => u.id !== id),
      )
    },
  },

  auditoria: {
    async registrar(r) {
      const registros = leer<RegistroAuditoria[]>(K.auditoria, [])
      registros.push({ ...r, id: nuevoId(), timestamp: new Date().toISOString() })
      // Tope para no agotar la cuota de localStorage (~5 MB).
      guardar(K.auditoria, registros.slice(-5000))
    },
    async listar(filtro: FiltroAuditoria = {}) {
      const { usuarioId, accion, desde, hasta, limit = 200 } = filtro
      return leer<RegistroAuditoria[]>(K.auditoria, [])
        .filter((r) => {
          const t = new Date(r.timestamp).getTime()
          if (usuarioId && r.usuarioId !== usuarioId) return false
          if (accion && r.accion !== accion) return false
          if (desde && t < desde.getTime()) return false
          if (hasta && t > hasta.getTime()) return false
          return true
        })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, limit)
    },
  },

  conexion: {
    async verificar() {
      return { estado: 'ok', ms: 0, detalle: 'Modo local (sin base de datos)' }
    },
  },

  respaldo: {
    async exportar() {
      await listo
      return {
        version: '1.0',
        fecha: new Date().toISOString(),
        ventas: leer<Venta[]>(K.ventas, []),
        usuarios: leer<Usuario[]>(K.usuarios, []),
      }
    },
    async importar(r) {
      if (!Array.isArray(r?.ventas) || !Array.isArray(r?.usuarios)) {
        throw new Error('Archivo de respaldo inválido')
      }
      const porId = new Map(leer<Venta[]>(K.ventas, []).map((v) => [v.id, v]))
      for (const v of r.ventas) porId.set(v.id, v)
      guardar(K.ventas, [...porId.values()])

      const usuarios = leer<Usuario[]>(K.usuarios, [])
      let importados = 0
      for (const u of r.usuarios) {
        if (u.usuario === 'admin') continue // nunca sobrescribir el admin
        const i = usuarios.findIndex((x) => x.id === u.id)
        if (i >= 0) usuarios[i] = u
        else usuarios.push(u)
        importados++
      }
      guardar(K.usuarios, usuarios)

      // Los contadores se reconstruyen desde las boletas importadas.
      const contadores = leerContadores()
      for (const v of porId.values()) {
        const [pref, num] = v.numeroBoleta.split('-')
        const s: Sucursal | null = pref === 'AYS' ? 'aysen' : pref === 'COY' ? 'coyhaique' : null
        if (s) contadores[s] = Math.max(contadores[s], Number(num) || 0)
      }
      guardar(K.contadores, contadores)
      return { ventas: r.ventas.length, usuarios: importados }
    },
  },
}

/** Borra todos los datos locales y recrea el admin (pruebas). */
export function resetLocal(): void {
  Object.values(K).forEach(borrar)
  borrar('sesion')
  listo = asegurarAdmin()
}
