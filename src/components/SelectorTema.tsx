import { useTema } from './TemaContext'
import type { PreferenciaTema } from '../lib/tema'

const OPCIONES: { valor: PreferenciaTema; texto: string; ayuda: string }[] = [
  { valor: 'claro', texto: 'Claro', ayuda: 'Usar el modo claro' },
  { valor: 'oscuro', texto: 'Oscuro', ayuda: 'Usar el modo oscuro' },
  { valor: 'sistema', texto: 'Auto', ayuda: 'Seguir la configuración del sistema' },
]

/** Selector de apariencia: Claro / Oscuro / Auto (sigue al sistema). */
export function SelectorTema({ className = '' }: { className?: string }) {
  const { preferencia, setPreferencia } = useTema()
  return (
    <div className={`selector-tema ${className}`.trim()} role="group" aria-label="Apariencia">
      {OPCIONES.map((o) => (
        <button
          key={o.valor}
          type="button"
          className={preferencia === o.valor ? 'sel' : ''}
          aria-pressed={preferencia === o.valor}
          title={o.ayuda}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setPreferencia(o.valor, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
          }}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}
