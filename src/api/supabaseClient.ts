import { createClient } from '@supabase/supabase-js'

/** Tiempo máximo por petición: sin esto, una red caída deja la app esperando para siempre. */
const TIMEOUT_MS = 15000

function fetchConTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('Tiempo de espera agotado al conectar con el servidor')), TIMEOUT_MS)
  init?.signal?.addEventListener('abort', () => ctrl.abort(init.signal?.reason))
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: fetchConTimeout },
})
