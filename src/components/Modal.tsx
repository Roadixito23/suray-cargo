import { useEffect, type ReactNode } from 'react'

interface Props {
  titulo: string
  onCerrar(): void
  children: ReactNode
  acciones?: ReactNode
}

export function Modal({ titulo, onCerrar, children, acciones }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrar])

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <h3>{titulo}</h3>
        <div className="modal-cuerpo">{children}</div>
        {acciones && <div className="modal-acciones">{acciones}</div>}
      </div>
    </div>
  )
}
