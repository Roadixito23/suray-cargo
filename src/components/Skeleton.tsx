/** Marcadores de carga: bloques con la forma del contenido real y un brillo animado (ver `.skeleton` en styles.css). */

export function Skeleton({ ancho = '100%', alto, className = '' }: { ancho?: string; alto?: string; className?: string }) {
  return <span className={`skeleton ${className}`.trim()} style={{ width: ancho, height: alto }} aria-hidden="true" />
}

// Anchos variados para que las filas no parezcan una rejilla uniforme.
const ANCHOS = ['70%', '55%', '85%', '60%', '45%']

/** Filas de tabla de relleno: colocar dentro de `<tbody>` mientras llegan los datos. */
export function FilasSkeleton({ columnas, filas = 5 }: { columnas: number; filas?: number }) {
  return (
    <>
      {Array.from({ length: filas }, (_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: columnas }, (_, j) => (
            <td key={j}>
              <Skeleton ancho={ANCHOS[(i + j * 2) % ANCHOS.length]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/** Misma rejilla que `TarjetasResumen`. */
export function TarjetasSkeleton({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <div className="tarjetas" aria-hidden="true">
      {Array.from({ length: cantidad }, (_, i) => (
        <div className="tarjeta" key={i}>
          <Skeleton ancho="40%" alto=".7rem" />
          <Skeleton ancho="70%" alto="1.5rem" />
          <Skeleton ancho="35%" alto=".7rem" />
        </div>
      ))}
    </div>
  )
}

/** Esqueleto de toda la app (menú lateral, barra y un panel) mientras se restaura la sesión. */
export function PantallaInicialSkeleton() {
  return (
    <div className="app" role="status" aria-busy="true" aria-label="Cargando">
      <aside className="lateral" aria-hidden="true">
        <div className="marca">
          <Skeleton ancho="40px" alto="40px" />
          <div style={{ flex: 1, display: 'grid', gap: '.4rem' }}>
            <Skeleton ancho="70%" alto=".9rem" />
            <Skeleton ancho="90%" alto=".7rem" />
          </div>
        </div>
        <nav>
          {[3, 4].map((n, s) => (
            <div className="nav-seccion" key={s}>
              <div className="nav-titulo">
                <Skeleton ancho="35%" alto=".6rem" />
              </div>
              {Array.from({ length: n }, (_, i) => (
                <div className="nav-skeleton" key={i}>
                  <Skeleton ancho="18px" alto="18px" />
                  <Skeleton ancho={ANCHOS[(i + s) % ANCHOS.length]} />
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="contenido">
        <header className="barra" aria-hidden="true">
          <h1 style={{ flex: 1 }}>
            <Skeleton ancho="12rem" alto="1.1rem" />
          </h1>
          <Skeleton ancho="9rem" />
        </header>
        <main aria-hidden="true">
          <div className="panel">
            <TarjetasSkeleton />
            <table>
              <tbody>
                <FilasSkeleton columnas={5} filas={6} />
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}
