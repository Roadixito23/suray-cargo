import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Impresión: se monta el contenido en `#zona-impresion` y se llama a window.print().
 * Los estilos @media print (styles.css) ocultan el resto de la app y fijan @page a 80 mm.
 * Para imprimir sin diálogo en el PC de caja: abrir Chrome con --kiosk-printing.
 */
const PrintContext = createContext<(contenido: ReactNode) => void>(() => {})

export function PrintProvider({ children }: { children: ReactNode }) {
  const [contenido, setContenido] = useState<ReactNode>(null)

  const imprimir = useCallback((c: ReactNode) => setContenido(c), [])

  useEffect(() => {
    if (!contenido) return
    // Esperar a que el logo esté decodificado antes de abrir el diálogo.
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('#zona-impresion img'))
    let cancelado = false
    Promise.all(imgs.map((i) => i.decode().catch(() => undefined))).then(() => {
      if (!cancelado) requestAnimationFrame(() => window.print())
    })
    const limpiar = () => setContenido(null)
    window.addEventListener('afterprint', limpiar)
    return () => {
      cancelado = true
      window.removeEventListener('afterprint', limpiar)
    }
  }, [contenido])

  return (
    <PrintContext.Provider value={imprimir}>
      {children}
      {contenido && createPortal(<div id="zona-impresion">{contenido}</div>, document.body)}
    </PrintContext.Provider>
  )
}

export const useImprimir = () => useContext(PrintContext)
