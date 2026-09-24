import { useImprimir } from '../components/PrintContext'
import { TicketsVenta } from '../components/Ticket'
import { VentasExplorer } from '../components/VentasExplorer'

export function ReimprimirPage() {
  const imprimir = useImprimir()
  return (
    <VentasExplorer
      acciones={(v) => (
        <button className="btn" onClick={() => imprimir(<TicketsVenta venta={v} />)}>Reimprimir</button>
      )}
    />
  )
}
