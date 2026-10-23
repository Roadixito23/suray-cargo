import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usaBaseRemota } from '../api'
import { nombreSucursal } from '../lib/format'
import { EstadoConexion } from './EstadoConexion'
import { MigracionLocal } from './MigracionLocal'
import { Modal } from './Modal'
import { SelectorTema } from './SelectorTema'
import { APP_VERSION } from '../version'

type Icono = 'venta' | 'cierre' | 'historico' | 'buscar' | 'porPagar' | 'reimprimir' | 'anular' | 'auditoria' | 'usuarios' | 'sucursales' | 'respaldos'

// Trazos de 24×24 (estilo línea); se dibujan con `currentColor` para seguir el tema.
const ICONOS: Record<Icono, string[]> = {
  venta: ['M6 2h12v20l-3-2-3 2-3-2-3 2z', 'M9 8h6', 'M9 12h6'],
  cierre: ['M3 7h18v13H3z', 'M8 7V4h8v3', 'M3 12h18'],
  historico: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5', 'M12 8v4l3 2'],
  buscar: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M21 21l-5-5'],
  porPagar: ['M3 7l9-4 9 4v10l-9 4-9-4z', 'M3 7l9 4 9-4', 'M12 11v10'],
  reimprimir: ['M6 9V3h12v6', 'M6 18H4v-7h16v7h-2', 'M7 14h10v7H7z'],
  anular: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M5.6 5.6l12.8 12.8'],
  auditoria: ['M9 3h6l1 2h3v16H5V5h3z', 'M9 12l2 2 4-4'],
  usuarios: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1', 'M17 4a4 4 0 0 1 0 7', 'M22 21v-1a6 6 0 0 0-4-5.6'],
  sucursales: ['M3 21h18', 'M5 21V8l7-5 7 5v13', 'M10 21v-6h4v6'],
  respaldos: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 19h16'],
}

function IconoNav({ nombre }: { nombre: Icono }) {
  return (
    <svg className="nav-icono" viewBox="0 0 24 24" aria-hidden="true">
      {ICONOS[nombre].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

interface Ruta {
  to: string
  texto: string
  icono: Icono
}

const SECCIONES: { titulo: string; admin?: boolean; rutas: Ruta[] }[] = [
  {
    titulo: 'Caja',
    rutas: [
      { to: '/ventas', texto: 'Registro de Ventas', icono: 'venta' },
      { to: '/cierre', texto: 'Cierre de Caja', icono: 'cierre' },
      { to: '/historico', texto: 'Histórico de Cierres', icono: 'historico' },
    ],
  },
  {
    titulo: 'Envíos',
    rutas: [
      { to: '/buscar', texto: 'Buscar Envío', icono: 'buscar' },
      { to: '/retiro-por-pagar', texto: 'Registrar Carga Por Pagar', icono: 'porPagar' },
      { to: '/reimprimir', texto: 'Reimprimir', icono: 'reimprimir' },
      { to: '/anular', texto: 'Anular Venta', icono: 'anular' },
    ],
  },
  {
    titulo: 'Administración',
    admin: true,
    rutas: [
      { to: '/admin/auditoria', texto: 'Auditoría', icono: 'auditoria' },
      { to: '/admin/usuarios', texto: 'Usuarios', icono: 'usuarios' },
      { to: '/admin/sucursales', texto: 'Sucursales', icono: 'sucursales' },
      { to: '/admin/respaldos', texto: 'Respaldos', icono: 'respaldos' },
    ],
  },
]

export function Layout() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menu, setMenu] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  if (!usuario) return null

  const secciones = SECCIONES.filter((sec) => !sec.admin || usuario.esAdmin)
  const titulo = secciones.flatMap((sec) => sec.rutas).find((r) => pathname.startsWith(r.to))?.texto ?? 'Suray Cargo'

  const link = (r: Ruta) => (
    <NavLink key={r.to} to={r.to} onClick={() => setMenu(false)} className={({ isActive }) => (isActive ? 'nav activo' : 'nav')}>
      <IconoNav nombre={r.icono} />
      <span>{r.texto}</span>
    </NavLink>
  )

  return (
    <div className="app">
      <aside className={menu ? 'lateral abierto' : 'lateral'}>
        <div className="marca">
          <img src="/assets/logo/logo.png" alt="" />
          <div>
            <strong>Suray Cargo</strong>
            <small>Sistema de Gestión</small>
            <small className="version">{APP_VERSION}</small>
          </div>
        </div>
        <nav>
          {secciones.map((sec) => (
            <div className="nav-seccion" key={sec.titulo} role="group" aria-label={sec.titulo}>
              <div className="nav-titulo">{sec.titulo}</div>
              {sec.rutas.map(link)}
            </div>
          ))}
        </nav>
        <SelectorTema className="en-lateral" />
        <button className="nav salir" onClick={() => setConfirmar(true)}>
          Cerrar Sesión
        </button>
      </aside>

      <div className="contenido">
        <header className="barra">
          <button className="hamburguesa" aria-label="Menú" onClick={() => setMenu((m) => !m)}>Menú</button>
          <h1>{titulo}</h1>
          {usuario.esAdmin && usaBaseRemota && <EstadoConexion />}
          <span className="usuario-info">
            {usuario.nombre} · {usuario.esAdmin ? 'Administrador' : nombreSucursal(usuario.sucursal)}
          </span>
        </header>
        <main>
          <Outlet />
        </main>
      </div>

      {usuario.esAdmin && usaBaseRemota && <MigracionLocal />}

      {confirmar && (
        <Modal
          titulo="Cerrar sesión"
          onCerrar={() => setConfirmar(false)}
          acciones={
            <>
              <button className="btn" onClick={() => setConfirmar(false)}>Cancelar</button>
              <button
                className="btn peligro"
                onClick={async () => {
                  await logout()
                  navigate('/login', { replace: true })
                }}
              >
                Cerrar sesión
              </button>
            </>
          }
        >
          ¿Estás seguro de que deseas cerrar sesión?
        </Modal>
      )}
    </div>
  )
}
