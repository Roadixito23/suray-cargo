/** Preferencia de tema: 'sistema' sigue la configuración del sistema operativo. */
export type PreferenciaTema = 'claro' | 'oscuro' | 'sistema'
export type Tema = 'claro' | 'oscuro'

/** Misma clave (con prefijo) que lee el script de index.html para evitar el destello al cargar. */
export const CLAVE_TEMA = 'suraycargo:tema'

export const PREFERENCIAS: readonly PreferenciaTema[] = ['claro', 'oscuro', 'sistema']

const esPreferencia = (v: unknown): v is PreferenciaTema => PREFERENCIAS.includes(v as PreferenciaTema)

export function leerPreferencia(): PreferenciaTema {
  try {
    const raw = localStorage.getItem(CLAVE_TEMA)
    const valor: unknown = raw ? JSON.parse(raw) : null
    return esPreferencia(valor) ? valor : 'sistema'
  } catch {
    return 'sistema'
  }
}

export function guardarPreferencia(pref: PreferenciaTema): void {
  try {
    localStorage.setItem(CLAVE_TEMA, JSON.stringify(pref))
  } catch {
    // Sin almacenamiento (modo privado, cuota): el tema sigue funcionando durante la sesión.
  }
}

export const sistemaPrefiereOscuro = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches

export function resolverTema(pref: PreferenciaTema, sistemaOscuro: boolean): Tema {
  if (pref === 'sistema') return sistemaOscuro ? 'oscuro' : 'claro'
  return pref
}

/** Refleja el tema en <html data-tema> y en <meta name="theme-color">. */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement
  raiz.dataset.tema = tema
  raiz.style.colorScheme = tema === 'oscuro' ? 'dark' : 'light'
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', tema === 'oscuro' ? '#0f1220' : '#f4f6fb')
}

export interface Origen {
  x: number
  y: number
}

const DURACION_MS = 650

/**
 * Ejecuta `aplicar` (el cambio de tema) con animación: un círculo que se expande desde `origen`
 * (View Transitions API). Sin soporte usa un fundido de colores (clase `.cambiando-tema`); con
 * "reducir movimiento" activado no anima.
 */
export function conTransicion(aplicar: () => void, origen?: Origen): void {
  const reducir = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reducir) return aplicar()

  const raiz = document.documentElement
  if (typeof document.startViewTransition !== 'function') {
    raiz.classList.add('cambiando-tema')
    aplicar()
    window.setTimeout(() => raiz.classList.remove('cambiando-tema'), 400)
    return
  }

  const x = origen?.x ?? window.innerWidth / 2
  const y = origen?.y ?? window.innerHeight / 2
  const radio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  document
    .startViewTransition(aplicar)
    .ready.then(() =>
      raiz.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
        { duration: DURACION_MS, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' },
      ),
    )
    .catch(() => {}) // transición omitida (p. ej. pestaña oculta): el tema ya quedó aplicado
}
