// components/TablaUsuariosTiempos.jsx
import React, { useMemo, useState, useRef, useEffect } from 'react'
import DataTable from 'react-data-table-component'
import { Button } from 'react-bootstrap'
import DetalleActividad from './DetalleActividad'

// ===== Helpers =====
function BadgePct({ value }) {
  const pct = Number(value) || 0
  let variant = 'secondary'
  if (pct >= 60) variant = 'success'
  else if (pct >= 40) variant = 'warning'
  else variant = 'danger'
  return <span className={`badge bg-${variant}`}>{pct.toFixed(1)}%</span>
}

export default function TablaUsuariosTiempos({
  rows = [],
  loading = false,
  error = '',
}) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [detalleRow, setDetalleRow] = useState(null)
  const detalleRef = useRef(null)

  // Scroll al detalle cuando exista
  useEffect(() => {
    if (detalleRow?.metrics && detalleRef.current) {
      detalleRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [detalleRow])

  // Filtro global
  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      r =>
        (r.user || '').toLowerCase().includes(q) ||
        (r.hostname || '').toLowerCase().includes(q)
    )
  }, [rows, globalFilter])

  // Columnas compactas + wrap donde conviene
  const columns = useMemo(
    () => [
      {
        name: 'Usuario',
        selector: r => r.user,
        sortable: true,
        width: '100px',
        wrap: true,
      },
      {
        name: 'Hostname',
        selector: r => r.hostname,
        sortable: true,
        grow: 2,
        maxWidth: '130px',
        wrap: true,
      },
      {
        name: 'Fecha',
        selector: r => r.date || r.metrics?.context?.date,
        sortable: true,
        width: '110px',
      },
      {
        name: 'Operando',
        selector: r => r.metrics?.seconds?.operando ?? 0, // ordena por segundos
        width: '110px',
        right: true,
        cell: r => r.metrics?.human?.operando || '00:00:00',
      },
      {
        name: 'Inactividad',
        sortable: true,
        width: '120px',
        selector: r => r.metrics?.seconds?.inactividad_real ?? 0,
        cell: r => (
          <div className='w-100 text-center'>
            <span className='text-danger fw-semibold'>
              {r.metrics?.human?.inactividad_real || '00:00:00'}
            </span>
          </div>
        ),
      },
      {
        name: 'Bloqueado',
        sortable: true,
        width: '120px',
        selector: r => r.metrics?.seconds?.bloqueado ?? 0,
        cell: r => (
          <div className='w-100 text-center'>
            <span className='text-danger fw-semibold'>
              {r.metrics?.human?.bloqueado || '00:00:00'}
            </span>
          </div>
        ),
      },
      {
        name: '% Operando',
        selector: r => r.metrics?.percent_of_total_observado?.operando ?? 0,
        width: '110px',
        right: true,
        cell: r => (
          <BadgePct
            value={r.metrics?.percent_of_total_observado?.operando ?? 0}
          />
        ),
      },
      {
        name: 'Acciones',
        button: true,
        width: '120px',
        cell: r => (
          <Button
            size='sm'
            variant='outline-primary'
            onClick={() => setDetalleRow(r)}
          >
            Ver detalles
          </Button>
        ),
      },
    ],
    []
  )

  // Estilos: header multilínea, celdas con wrap y números a la derecha
  const customStyles = {
    headCells: {
      style: {
        fontWeight: 600,
        fontSize: '13px',
        backgroundColor: '#f8f9fa',
        whiteSpace: 'normal',
        lineHeight: 1.1,
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
      },
    },
    cells: {
      style: {
        display: 'flex',
        alignItems: 'center', // ← centra vertical
        whiteSpace: 'normal',
        lineHeight: 1.2,
        paddingTop: '0.35rem',
        paddingBottom: '0.35rem',
      },
    },
    rows: { style: { minHeight: '44px' } },
  }

  const SubHeader = (
    <div className='d-flex w-100 align-items-center gap-2'>
      <div className='input-group input-group-sm' style={{ maxWidth: 280 }}>
        <span className='input-group-text'>Buscar</span>
        <input
          type='text'
          className='form-control'
          placeholder='Usuario o hostname…'
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
        />
      </div>
      <div className='ms-auto text-muted small'>
        Total registros: {filtered.length}
      </div>
    </div>
  )

  const showDetalle = !!(detalleRow && detalleRow.metrics)

  return (
    <>
      <div className='card'>
        <div className='card-body'>
          {error && <div className='alert alert-danger py-2 mb-3'>{error}</div>}
          <DataTable
            columns={columns}
            data={filtered}
            progressPending={loading}
            pagination
            paginationPerPage={20}
            paginationRowsPerPageOptions={[20, 50, 100]}
            highlightOnHover
            dense
            responsive
            customStyles={customStyles}
            subHeader
            subHeaderComponent={SubHeader}
            persistTableHead
            noDataComponent={
              <div className='text-muted small py-3'>Sin datos.</div>
            }
          />
        </div>
      </div>

      {showDetalle && (
        <div ref={detalleRef} className='mt-4'>
          <DetalleActividad
            row={detalleRow}
            onClose={() => setDetalleRow(null)}
          />
        </div>
      )}
    </>
  )
}
