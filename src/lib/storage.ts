/** Envoltorio de localStorage con JSON y tolerancia a fallos. */
const PREFIX = 'suraycargo:'

export function leer<T>(clave: string, porDefecto: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + clave)
    return raw ? (JSON.parse(raw) as T) : porDefecto
  } catch {
    return porDefecto
  }
}

export function guardar<T>(clave: string, valor: T): void {
  localStorage.setItem(PREFIX + clave, JSON.stringify(valor))
}

export function borrar(clave: string): void {
  localStorage.removeItem(PREFIX + clave)
}
