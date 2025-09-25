import { useEffect, useMemo, useRef, useState } from 'react'
import DataTable from 'react-data-table-component'
import { FaExternalLinkAlt, FaCloudUploadAlt } from 'react-icons/fa'
import { getLotesFinancieros, uploadDocsLote } from '../service.Financiera'
import SecureArchivo from './SecureArchivo'
import DetalleLoteFinanciero from './DetalleLoteFinanciero'

const moneyCO = n =>
  (Number(n) || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

const isPdfFile = file =>
  !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''))

export default function TablaFinanciera() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  // inputs ocultos
  const cuentaInputRef = useRef(null)
  const soporteInputRef = useRef(null)
  const [loteCuenta, setLoteCuenta] = useState(null)
  const [loteSoporte, setLoteSoporte] = useState(null)

  // archivos pendientes por lote
  const [pendCuenta, setPendCuenta] = useState({})
  const [pendSoporte, setPendSoporte] = useState({})

  // estados de guardado por lote
  const [savingCuenta, setSavingCuenta] = useState({})
  const [savingSoporte, setSavingSoporte] = useState({})

  // drag visual
  const [dragOverCuenta, setDragOverCuenta] = useState(null)
  const [dragOverSoporte, setDragOverSoporte] = useState(null)

  // helpers estado
  const setPendCuentaFor = (id, fileOrNull) =>
    setPendCuenta(prev => ({ ...prev, [id]: fileOrNull || undefined }))
  const setPendSoporteFor = (id, fileOrNull) =>
    setPendSoporte(prev => ({ ...prev, [id]: fileOrNull || undefined }))

  const setSavingCuentaFor = (id, val) =>
    setSavingCuenta(prev => ({ ...prev, [id]: !!val }))
  const setSavingSoporteFor = (id, val) =>
    setSavingSoporte(prev => ({ ...prev, [id]: !!val }))

  // cargar/refresh
  const refresh = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getLotesFinancieros()
      setRows(data)
    } catch (e) {
      console.error(e)
      setError('No se pudo cargar la información financiera.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getLotesFinancieros()
        if (!cancelled) setRows(data)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('No se pudo cargar la información financiera.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // abrir selector de archivo
  const openCuentaPicker = idLote => {
    setLoteCuenta(idLote)
    cuentaInputRef.current?.click()
  }
  const openSoportePicker = idLote => {
    setLoteSoporte(idLote)
    soporteInputRef.current?.click()
  }

  // onChange (solo PDF)
  const onCuentaFileChange = e => {
    const file = e.target.files?.[0]
    if (file && !isPdfFile(file)) {
      setError('Solo se permite PDF en Cuenta de cobro.')
    } else if (file && loteCuenta) {
      setPendCuentaFor(loteCuenta, file)
    }
    e.target.value = ''
    setLoteCuenta(null)
  }
  const onSoporteFileChange = e => {
    const file = e.target.files?.[0]
    if (file && !isPdfFile(file)) {
      setError('Solo se permite PDF en Soporte de pago.')
    } else if (file && loteSoporte) {
      setPendSoporteFor(loteSoporte, file)
    }
    e.target.value = ''
    setLoteSoporte(null)
  }

  // drag & drop
  const prevent = e => {
    e.preventDefault()
    e.stopPropagation()
  }
  const handleDragOverCuenta = (e, idLote) => {
    prevent(e)
    setDragOverCuenta(idLote)
  }
  const handleDragLeaveCuenta = e => {
    prevent(e)
    setDragOverCuenta(null)
  }
  const handleDropCuenta = (e, idLote) => {
    prevent(e)
    setDragOverCuenta(null)
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    if (!isPdfFile(file)) {
      setError('Solo se permite PDF en Cuenta de cobro.')
      return
    }
    setPendCuentaFor(idLote, file)
  }
  const handleDragOverSoporte = (e, idLote) => {
    prevent(e)
    setDragOverSoporte(idLote)
  }
  const handleDragLeaveSoporte = e => {
    prevent(e)
    setDragOverSoporte(null)
  }
  const handleDropSoporte = (e, idLote) => {
    prevent(e)
    setDragOverSoporte(null)
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    if (!isPdfFile(file)) {
      setError('Solo se permite PDF en Soporte de pago.')
      return
    }
    setPendSoporteFor(idLote, file)
  }

  // guardar pendientes usando uploadDocsLote
  const guardarCuenta = async idLote => {
    const file = pendCuenta[idLote]
    if (!file) return
    try {
      setSavingCuentaFor(idLote, true)
      await uploadDocsLote(idLote, { cuentaFile: file })
      setPendCuentaFor(idLote, null)
      await refresh()
    } catch (e) {
      console.error(e)
      setError('Error al subir la cuenta de cobro.')
    } finally {
      setSavingCuentaFor(idLote, false)
    }
  }

  const guardarSoporte = async idLote => {
    const file = pendSoporte[idLote]
    if (!file) return
    try {
      setSavingSoporteFor(idLote, true)
      await uploadDocsLote(idLote, { soporteFile: file })
      setPendSoporteFor(idLote, null)
      await refresh()
    } catch (e) {
      console.error(e)
      setError('Error al subir el soporte de pago.')
    } finally {
      setSavingSoporteFor(idLote, false)
    }
  }

  // filtro
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      Object.values(r || {}).some(v =>
        String(v ?? '')
          .toLowerCase()
          .includes(q)
      )
    )
  }, [rows, search])

  // celda “pendiente”
  const PendingBadge = ({ nombre, onSave, onCancel, saving }) => (
    <div
      className='d-flex align-items-center gap-2'
      style={{ whiteSpace: 'nowrap' }}
    >
      <span
        className='badge bg-light text-dark'
        title={nombre}
        style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {nombre}
      </span>
      <div
        className='btn-group btn-group-sm'
        role='group'
        aria-label='acciones archivo'
      >
        <button
          type='button'
          className='btn btn-success'
          onClick={onSave}
          disabled={saving}
          title='Guardar'
        >
          {saving ? (
            <span
              className='spinner-border spinner-border-sm'
              role='status'
              aria-hidden='true'
            />
          ) : (
            'Guardar'
          )}
        </button>
        <button
          type='button'
          className='btn btn-outline-secondary'
          onClick={onCancel}
          disabled={saving}
          title='Cancelar'
        >
          Cancelar
        </button>
      </div>
    </div>
  )

  const columns = [
    { name: 'Lote', selector: r => r.Id_lote, sortable: true, width: '120px' },
    {
      name: 'Unidad',
      selector: r => r.unidad_negocio ?? '—',
      sortable: true,
      width: '90px',
    },
    {
      name: 'Valor total',
      selector: r => r.valor_total_lote ?? 0,
      sortable: true,
      right: true,
      width: '120px',
      cell: r => (
        <span className='fw-semibold'>{moneyCO(r.valor_total_lote)}</span>
      ),
    },
    {
      name: 'Pago',
      selector: r => r.pago_estado ?? '—',
      sortable: true,
      width: '120px',
      cell: r => {
        const estado = (r.pago_estado || '').toLowerCase()
        const cls =
          estado === 'pagado'
            ? 'badge bg-success'
            : estado === 'pendiente'
            ? 'badge bg-warning text-dark'
            : 'badge bg-secondary'
        return (
          <span className={cls} style={{ fontWeight: 600 }}>
            {r.pago_estado || '—'}
          </span>
        )
      },
    },
    {
      name: 'Aceptación',
      selector: r => (r.aceptacion ? 'Sí' : 'No'),
      sortable: true,
      width: '120px',
      cell: r =>
        r.aceptacion ? (
          <span className='badge bg-primary'>Sí</span>
        ) : (
          <span className='badge bg-secondary'>No</span>
        ),
    },
    {
      name: 'Fecha aceptación',
      selector: r =>
        r.aceptacion_fecha
          ? new Date(r.aceptacion_fecha).toLocaleString('es-CO')
          : '—',
      sortable: true,
      width: '200px',
    },
    // ------- ARCHIVOS -------
    {
      name: 'PDF',
      allowOverflow: true,
      width: '90px',
      center: true,
      cell: r =>
        r.pdf_generado || r.pdf_generado_url ? (
          <SecureArchivo
            src={r.pdf_generado || r.pdf_generado_url}
            title='Abrir PDF'
            aria-label='Abrir PDF'
            className='p-0 text-decoration-none'
          >
            <FaExternalLinkAlt size={18} style={{ color: '#59A1F7' }} />
          </SecureArchivo>
        ) : (
          <span className='text-muted'>—</span>
        ),
    },
    {
      name: 'Cuenta',
      allowOverflow: true,
      grow: 2,
      minWidth: '100px',
      cell: r => {
        const pend = pendCuenta[r.Id_lote]
        if (pend) {
          const saving = !!savingCuenta[r.Id_lote]
          return (
            <PendingBadge
              nombre={pend.name}
              saving={saving}
              onSave={() => guardarCuenta(r.Id_lote)}
              onCancel={() => setPendCuentaFor(r.Id_lote, null)}
            />
          )
        }
        return r.cuenta_cobro || r.cuenta_cobro_url ? (
          <SecureArchivo
            src={r.cuenta_cobro || r.cuenta_cobro_url}
            title='Ver cuenta de cobro (PDF)'
            aria-label='Ver cuenta de cobro (PDF)'
            className='p-0 text-decoration-none'
          >
            <FaExternalLinkAlt size={18} style={{ color: '#59A1F7' }} />
          </SecureArchivo>
        ) : (
          <div
            onDragOver={e => handleDragOverCuenta(e, r.Id_lote)}
            onDragLeave={handleDragLeaveCuenta}
            onDrop={e => handleDropCuenta(e, r.Id_lote)}
            title='Arrastra un PDF o haz clic para seleccionar'
            style={{
              border:
                dragOverCuenta === r.Id_lote
                  ? '2px dashed #59A1F7'
                  : '2px dashed transparent',
              borderRadius: 8,
              padding: 2,
              display: 'inline-block',
              whiteSpace: 'nowrap',
            }}
          >
            <button
              type='button'
              className='btn btn-link p-0 text-decoration-none'
              aria-label='Cargar cuenta de cobro (PDF)'
              onClick={() => openCuentaPicker(r.Id_lote)}
              style={{ color: '#59A1F7', lineHeight: 1 }}
              title='Cargar cuenta de cobro (PDF)'
            >
              <FaCloudUploadAlt size={18} />
            </button>
            <small className='text-muted ms-1'>PDF</small>
          </div>
        )
      },
    },
    {
      name: 'Soporte',
      allowOverflow: true,
      grow: 2,
      minWidth: '280px',
      cell: r => {
        const pend = pendSoporte[r.Id_lote]
        if (pend) {
          const saving = !!savingSoporte[r.Id_lote]
          return (
            <PendingBadge
              nombre={pend.name}
              saving={saving}
              onSave={() => guardarSoporte(r.Id_lote)}
              onCancel={() => setPendSoporteFor(r.Id_lote, null)}
            />
          )
        }
        return r.soporte_pago || r.soporte_pago_url ? (
          <SecureArchivo
            src={r.soporte_pago || r.soporte_pago_url}
            title='Ver soporte de pago (PDF)'
            aria-label='Ver soporte de pago (PDF)'
            className='p-0 text-decoration-none'
          >
            <FaExternalLinkAlt size={18} style={{ color: '#00BA59' }} />
          </SecureArchivo>
        ) : (
          <div
            onDragOver={e => handleDragOverSoporte(e, r.Id_lote)}
            onDragLeave={handleDragLeaveSoporte}
            onDrop={e => handleDropSoporte(e, r.Id_lote)}
            title='Arrastra un PDF o haz clic para seleccionar'
            style={{
              border:
                dragOverSoporte === r.Id_lote
                  ? '2px dashed #00BA59'
                  : '2px dashed transparent',
              borderRadius: 8,
              padding: 2,
              display: 'inline-block',
              whiteSpace: 'nowrap',
            }}
          >
            <button
              type='button'
              className='btn btn-link p-0 text-decoration-none'
              aria-label='Cargar soporte de pago (PDF)'
              onClick={() => openSoportePicker(r.Id_lote)}
              style={{ color: '#00BA59', lineHeight: 1 }}
              title='Cargar soporte de pago (PDF)'
            >
              <FaCloudUploadAlt size={18} />
            </button>
            <small className='text-muted ms-1'>PDF</small>
          </div>
        )
      },
    },
  ]

  // --- estilos compactos (sin tocar anchos definidos)
  const tableStyles = {
    table: {
      style: {
        fontSize: '0.9rem',
      },
    },
    headCells: {
      style: {
        fontWeight: 600,
        paddingTop: '0.35rem',
        paddingBottom: '0.35rem',
        lineHeight: 1.1,
      },
    },
    rows: {
      style: {
        minHeight: '34px', // ↓ alto por fila
      },
    },
    cells: {
      style: {
        paddingTop: '0.25rem',
        paddingBottom: '0.25rem',
        paddingLeft: '0.5rem',
        paddingRight: '0.5rem',
        overflow: 'visible', // evita corte de botones
        lineHeight: 1.1,
      },
    },
  }

  const SubHeader = (
    <div className='d-flex flex-wrap gap-2 w-100 align-items-center'>
      <div className='input-group' style={{ maxWidth: 360 }}>
        <span className='input-group-text'>Buscar</span>
        <input
          type='text'
          className='form-control'
          placeholder='Filtrar por cualquier campo…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
    </div>
  )

  const ExpandedComponent = ({ data }) => (
    <div className='w-100 px-2 py-2'>
      <DetalleLoteFinanciero idLote={data.Id_lote} />
    </div>
  )

  return (
    <div className='card'>
      <div className='card-header d-flex align-items-end'>
        <div className='me-auto'>
          <strong>Financiera – Lotes</strong>
          <div className='text-muted small'>
            Despliega cada lote para ver el detalle de productos asociados.
          </div>
        </div>
      </div>

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
          customStyles={tableStyles}
          subHeader
          subHeaderComponent={SubHeader}
          persistTableHead
          expandableRows
          expandableRowsComponent={ExpandedComponent}
          noDataComponent={
            <div className='text-muted small py-3'>Sin datos.</div>
          }
        />

        {/* inputs ocultos (solo PDF) */}
        <input
          ref={cuentaInputRef}
          type='file'
          accept='application/pdf,.pdf'
          style={{ display: 'none' }}
          onChange={onCuentaFileChange}
        />
        <input
          ref={soporteInputRef}
          type='file'
          accept='application/pdf,.pdf'
          style={{ display: 'none' }}
          onChange={onSoporteFileChange}
        />
      </div>
    </div>
  )
}
