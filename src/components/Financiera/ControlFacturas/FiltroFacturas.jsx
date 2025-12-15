// src/modules/Financiera/FactCompra/FiltroFacturas.jsx
import { Button, Form } from 'react-bootstrap'

const ESTADOS = ['BORRADOR', 'PENDIENTE', 'PAGADA', 'VENCIDA', 'ANULADA']
const LINEAS = ['Harvest', 'Fastway', 'Greenway', 'Compras Gen']

export default function FiltroFacturas({
  estadoValue,
  lineaValue,
  onEstadoChange,
  onLineaChange,
  onClear,
}) {
  const hayFiltro = !!estadoValue || !!lineaValue

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Form.Select
        size='sm'
        value={estadoValue || ''}
        onChange={e => onEstadoChange?.(e.target.value)}
        style={{ width: 220 }}
        title='Filtrar por estado'
      >
        <option value=''>Estado: Todos</option>
        {ESTADOS.map(es => (
          <option key={es} value={es}>
            {es}
          </option>
        ))}
      </Form.Select>

      <Form.Select
        size='sm'
        value={lineaValue || ''}
        onChange={e => onLineaChange?.(e.target.value)}
        style={{ width: 220 }}
        title='Filtrar por línea'
      >
        <option value=''>Línea: Todas</option>
        {LINEAS.map(li => (
          <option key={li} value={li}>
            {li}
          </option>
        ))}
      </Form.Select>

      {hayFiltro ? (
        <Button
          size='sm'
          variant='outline-secondary'
          onClick={() => onClear?.()}
          title='Quitar filtros'
        >
          Quitar filtros
        </Button>
      ) : null}
    </div>
  )
}
