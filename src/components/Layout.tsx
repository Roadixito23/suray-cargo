import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { nombreSucursal } from '../lib/format'
import { Modal } from './Modal'

const RUTAS = [
  { to: '/ventas', texto: 'Registro de Ventas' },
  { to: '/cierre', texto: 'Cierre de Caja' },
  { to: '/buscar', texto: 'Buscar Envío' },
  { to: '/reimprimir', texto: 'Reimprimir' },
  { to: '/anular', texto: 'Anular Venta' },
  { to: '/historico', texto: 'Histórico de Cierres' },
]
const RUTAS_ADMIN = [
  { to: '/admin/auditoria', texto: 'Auditoría' },
  { to: '/admin/usuarios', texto: 'Usuarios' },
  { to: '/admin/respaldos', texto: 'Respaldos' },
]

export function Layout() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menu, setMenu] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  if (!usuario) return null

  const todas = [...RUTAS, ...(usuario.esAdmin ? RUTAS_ADMIN : [])]
  const titulo = todas.find((r) => pathname.startsWith(r.to))?.texto ?? 'Suray Cargo'

  const link = (r: (typeof RUTAS)[number]) => (
    <NavLink key={r.to} to={r.to} onClick={() => setMenu(false)} className={({ isActive }) => (isActive ? 'nav activo' : 'nav')}>
      {r.texto}
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
          </div>
        </div>
        <nav>
          {RUTAS.map(link)}
          {usuario.esAdmin && <hr />}
          {usuario.esAdmin && RUTAS_ADMIN.map(link)}
        </nav>
        <button className="nav salir" onClick={() => setConfirmar(true)}>
          Cerrar Sesión
        </button>
      </aside>

      <div className="contenido">
        <header className="barra">
          <button className="hamburguesa" aria-label="Menú" onClick={() => setMenu((m) => !m)}>Menú</button>
          <h1>{titulo}</h1>
          <span className="usuario-info">
            {usuario.nombre} · {usuario.esAdmin ? 'Administrador' : nombreSucursal(usuario.sucursal)}
          </span>
        </header>
        <main>
          <Outlet />
        </main>
      </div>

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
