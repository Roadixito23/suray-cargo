import { useEffect, type RefObject } from 'react'

const BORDE_PX = 90
const VELOCIDAD_MAX_PX = 18

/**
 * Autoscroll según la posición del mouse: mientras el puntero está sobre `ref` y cerca del borde
 * superior (bajo la barra fija) o inferior de la ventana, la página se desplaza; cuanto más cerca
 * del borde, más rápido. No actúa con un botón del mouse presionado (selección de texto) ni si el
 * usuario prefiere menos movimiento.
 */
export function useAutoScrollPorMouse(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let y = 0
    let velocidad = 0
    let raf = 0

    const paso = () => {
      if (velocidad === 0) {
        raf = 0
        return
      }
      window.scrollBy(0, velocidad)
      raf = requestAnimationFrame(paso)
    }

    const alMover = (e: MouseEvent) => {
      y = e.clientY
      const arriba = document.querySelector('.barra')?.getBoundingClientRect().bottom ?? 0
      const abajo = window.innerHeight
      let v = 0
      if (e.buttons === 0) {
        if (y < arriba + BORDE_PX) v = -VELOCIDAD_MAX_PX * Math.min(1, (arriba + BORDE_PX - y) / BORDE_PX)
        else if (y > abajo - BORDE_PX) v = VELOCIDAD_MAX_PX * Math.min(1, (y - (abajo - BORDE_PX)) / BORDE_PX)
      }
      velocidad = Math.round(v)
      if (velocidad !== 0 && !raf) raf = requestAnimationFrame(paso)
    }
    const detener = () => {
      velocidad = 0
    }

    el.addEventListener('mousemove', alMover)
    el.addEventListener('mouseleave', detener)
    window.addEventListener('blur', detener)
    return () => {
      el.removeEventListener('mousemove', alMover)
      el.removeEventListener('mouseleave', detener)
      window.removeEventListener('blur', detener)
      cancelAnimationFrame(raf)
    }
  }, [ref])
}
