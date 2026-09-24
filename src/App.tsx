import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { AnularPage } from './pages/AnularPage'
import { AuditoriaPage } from './pages/AuditoriaPage'
import { BuscarPage } from './pages/BuscarPage'
import { CierrePage } from './pages/CierrePage'
import { HistoricoPage } from './pages/HistoricoPage'
import { LoginPage } from './pages/LoginPage'
import { ReimprimirPage } from './pages/ReimprimirPage'
import { RetiroPorPagarPage } from './pages/RetiroPorPagarPage'
import { RespaldosPage } from './pages/RespaldosPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { VentaPage } from './pages/VentaPage'

function Protegida({ admin, children }: { admin?: boolean; children: React.ReactNode }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return <div className="cargando">Cargando…</div>
  if (!usuario) return <Navigate to="/login" replace />
  if (admin && !usuario.esAdmin) return <Navigate to="/ventas" replace />
  return <>{children}</>
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protegida>
            <Layout />
          </Protegida>
        }
      >
        <Route path="/ventas" element={<VentaPage />} />
        <Route path="/cierre" element={<CierrePage />} />
        <Route path="/buscar" element={<BuscarPage />} />
        <Route path="/retiro-por-pagar" element={<RetiroPorPagarPage />} />
        <Route path="/reimprimir" element={<ReimprimirPage />} />
        <Route path="/anular" element={<AnularPage />} />
        <Route path="/historico" element={<HistoricoPage />} />
        <Route path="/admin/auditoria" element={<Protegida admin><AuditoriaPage /></Protegida>} />
        <Route path="/admin/usuarios" element={<Protegida admin><UsuariosPage /></Protegida>} />
        <Route path="/admin/respaldos" element={<Protegida admin><RespaldosPage /></Protegida>} />
      </Route>
      <Route path="*" element={<Navigate to="/ventas" replace />} />
    </Routes>
  )
}
