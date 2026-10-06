import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { UsuarioSesion } from '../types'
import { login as loginSvc, logout as logoutSvc, restaurarSesion } from '../services/usuarios'

interface AuthState {
  usuario: UsuarioSesion | null
  cargando: boolean
  login(usuario: string, contrasena: string): Promise<boolean>
  logout(): Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    restaurarSesion()
      .then(setUsuario)
      .catch((e) => {
        // Sin conexión o sesión inválida: se muestra el login en vez de quedar "Cargando…".
        console.error('No se pudo restaurar la sesión', e)
        setUsuario(null)
      })
      .finally(() => setCargando(false))
  }, [])

  const login = useCallback(async (u: string, c: string) => {
    const s = await loginSvc(u, c)
    setUsuario(s)
    return s !== null
  }, [])

  const logout = useCallback(async () => {
    await logoutSvc(usuario)
    setUsuario(null)
  }, [usuario])

  const value = useMemo(() => ({ usuario, cargando, login, logout }), [usuario, cargando, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

/** Usuario garantizado (para páginas dentro de rutas protegidas). */
export function useUsuario(): UsuarioSesion {
  const { usuario } = useAuth()
  if (!usuario) throw new Error('Ruta protegida sin sesión')
  return usuario
}
