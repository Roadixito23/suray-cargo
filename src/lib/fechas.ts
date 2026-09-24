export const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const finDelDia = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

export const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export const claveDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Valor para <input type="date"> */
export const aInputDate = claveDia

export function desdeInputDate(v: string): Date | undefined {
  if (!v) return undefined
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const DIAS_HISTORICO = 90
