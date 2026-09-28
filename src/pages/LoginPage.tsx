import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { SelectorTema } from '../components/SelectorTema'

export function LoginPage() {
  const { usuario, cargando, login } = useAuth()
  const navigate = useNavigate()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!cargando && usuario) return <Navigate to="/ventas" replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError('')
    const ok = await login(user, pass)
    setEnviando(false)
    if (ok) navigate('/ventas', { replace: true })
    else setError('Usuario o contraseña incorrectos')
  }

  return (
    <div className="login-fondo">
      <SelectorTema className="en-login" />
      <div className="login-card">
        <div className="login-izq">
          <img src="/assets/logo/logo.png" alt="Suray Cargo" />
          <p>Sistema de Control de Ventas</p>
        </div>
        <form className="login-der" onSubmit={enviar}>
          <h2>Iniciar sesión</h2>
          <label>
            Usuario
            <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoFocus required />
          </label>
          <label>
            Contraseña
            <span className="con-boton">
              <input
                type={ver ? 'text' : 'password'}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" className="btn-icono" onClick={() => setVer((v) => !v)} aria-label="Mostrar contraseña">
                {ver ? 'Ocultar' : 'Ver'}
              </button>
            </span>
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn primario" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
