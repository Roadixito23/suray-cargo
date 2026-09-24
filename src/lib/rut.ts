/** Deja solo dígitos y K (mayúscula): "12.345.678-k" → "12345678K". */
export const normalizarRut = (rut: string) => rut.replace(/[^0-9kK]/g, '').toUpperCase()

/** "12345678K" → "12.345.678-K". Si tiene menos de 2 caracteres devuelve lo normalizado. */
export function formatearRut(rut: string): string {
  const n = normalizarRut(rut)
  if (n.length < 2) return n
  const cuerpo = n.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpo}-${n.slice(-1)}`
}

/** Valida largo y dígito verificador (módulo 11). */
export function validarRut(rut: string): boolean {
  const n = normalizarRut(rut)
  if (!/^\d{7,8}[0-9K]$/.test(n)) return false
  const cuerpo = n.slice(0, -1)
  let suma = 0
  let factor = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const resto = 11 - (suma % 11)
  const dv = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
  return n.slice(-1) === dv
}
