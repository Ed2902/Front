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

const safeNum = v => (Number.isFinite(Number(v)) ? Number(v) : 0)
const unique = arr => Array.from(new Set(arr))

// % Operando = Operando / (Operando + Inactividad)
const calcPctOperando = r => {
  const op = safeNum(r?.metrics?.seconds?.operando)
  const ina = safeNum(r?.metrics?.seconds?.inactividad_real)
  const denom = op + ina
  if (denom <= 0) return 0
  return (op / denom) * 100
}

// Conteos
const countApps = r => {
  const apps = Array.isArray(r?.metrics?.top?.apps) ? r.metrics.top.apps : []
  const names = apps.map(a => String(a.app || '').toLowerCase()).filter(Boolean)
  return unique(names).length
}

const countUrls = r => {
  const web = Array.isArray(r?.metrics?.top?.web) ? r.metrics.top.web : []
  const domains = web
    .map(w => String(w.domain || '').toLowerCase())
    .filter(Boolean)
  return unique(domains).length
}

// Misma lógica que "Documentos" del DetalleActividad (solo apps de documentos)
const DOC_APPS = new Set([
  'excel.exe',
  'winword.exe',
  'powerpnt.exe',
  'acrord32.exe',
  'pdf.exe',
  'notepad.exe',
  'photos.exe',
])

const countDocuments = r => {
  const apps = Array.isArray(r?.metrics?.top?.apps) ? r.metrics.top.apps : []
  const titles = []
  for (const a of apps) {
    const exe = String(a?.app || '').toLowerCase()
    if (!DOC_APPS.has(exe)) continue
    const ts = Array.isArray(a?.top_titles) ? a.top_titles : []
    for (const t of ts) {
      const s = String(t || '').trim()
      if (s) titles.push(s)
    }
  }
  return unique(titles).length
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
        width: '110px',
        wrap: true,
      },
      {
        name: 'Hostname',
        selector: r => r.hostname,
        sortable: true,
        grow: 2,
        maxWidth: '160px',
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
        selector: r => safeNum(r?.metrics?.seconds?.operando), // ordena por segundos
        width: '110px',
        right: true,
        cell: r => r?.metrics?.human?.operando || '00:00:00',
      },
      {
        name: 'Inactividad',
        sortable: true,
        width: '120px',
        selector: r => safeNum(r?.metrics?.seconds?.inactividad_real),
        cell: r => (
          <div className='w-100 text-center'>
            <span className='text-danger fw-semibold'>
              {r?.metrics?.human?.inactividad_real || '00:00:00'}
            </span>
          </div>
        ),
      },
      {
        name: 'Bloqueado',
        sortable: true,
        width: '120px',
        selector: r => safeNum(r?.metrics?.seconds?.bloqueado),
        cell: r => (
          <div className='w-100 text-center'>
            <span className='text-danger fw-semibold'>
              {r?.metrics?.human?.bloqueado || '00:00:00'}
            </span>
          </div>
        ),
      },
      // --- Nuevos contadores ---
      {
        name: 'Apps',
        selector: r => countApps(r),
        width: '80px',
        right: true,
      },
      {
        name: 'URLs',
        selector: r => countUrls(r),
        width: '80px',
        right: true,
      },
      {
        name: 'Documentos',
        selector: r => countDocuments(r),
        width: '115px',
        right: true,
      },
      // % Operando = Operando / (Operando + Inactividad)
      {
        name: '% Operando',
        selector: r => calcPctOperando(r),
        width: '120px',
        right: true,
        cell: r => <BadgePct value={calcPctOperando(r)} />,
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
        alignItems: 'center',
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
