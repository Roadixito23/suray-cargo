import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Tipo = 'ok' | 'error' | 'aviso'
interface Item { id: number; tipo: Tipo; texto: string }

const ToastContext = createContext<(texto: string, tipo?: Tipo) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])

  const mostrar = useCallback((texto: string, tipo: Tipo = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((l) => [...l, { id, tipo, texto }])
    setTimeout(() => setItems((l) => l.filter((i) => i.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={mostrar}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`toast toast-${i.tipo}`}>{i.texto}</div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
