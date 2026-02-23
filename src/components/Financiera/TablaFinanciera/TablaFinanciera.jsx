import { useEffect, useMemo, useRef, useState } from 'react'
import DataTable from 'react-data-table-component'
import { FaCloudUploadAlt, FaListUl } from 'react-icons/fa'
import { usePermisos } from '../../../hooks/usePermisos'
import {
  getDocumentosLote,
  getLotesFinancieros,
  uploadDocsLote,
} from '../service.Financiera'
import DetalleLoteFinanciero from './DetalleLoteFinanciero'
import DocumentosLoteModal from './DocumentosLoteModal'

const moneyCO = n =>
  (Number(n) || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

const fmtDateCompact = value => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CO')
}

const isAllowedUploadFile = file =>
  !!file &&
  (file.type === 'application/pdf' ||
    String(file.type || '').startsWith('image/') ||
    /\.(pdf|png|jpe?g|webp|gif)$/i.test(file.name || ''))

const appendUniqueFiles = (current = [], incoming = []) => {
  const out = [...current]
  const seen = new Set(
    out.map(f => `${f?.name || ''}:${f?.size || 0}:${f?.lastModified || 0}`)
  )

  for (const file of incoming) {
    const key = `${file?.name || ''}:${file?.size || 0}:${file?.lastModified || 0}`
    if (seen.has(key)) continue
    out.push(file)
    seen.add(key)
  }

  return out
}

export default function TablaFinanciera() {
  const { tienePermiso } = usePermisos()
  const canViewPrices = tienePermiso('verPreciosFinanciera')

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
  const [docsViewer, setDocsViewer] = useState({
    open: false,
    idLote: null,
    loading: false,
    error: null,
    docs: [],
    selectedDoc: null,
  })

  // helpers estado
  const setPendCuentaFor = (id, filesOrNull) =>
    setPendCuenta(prev => ({
      ...prev,
      [id]: Array.isArray(filesOrNull) ? filesOrNull : undefined,
    }))
  const setPendSoporteFor = (id, filesOrNull) =>
    setPendSoporte(prev => ({
      ...prev,
      [id]: Array.isArray(filesOrNull) ? filesOrNull : undefined,
    }))

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

  // onChange (PDF/Imagen)
  const onCuentaFileChange = e => {
    const files = Array.from(e.target.files || [])
    const invalid = files.find(file => !isAllowedUploadFile(file))
    if (invalid) {
      setError('Solo se permiten archivos PDF o imagen en Cuenta de cobro.')
    } else if (files.length && loteCuenta) {
      setPendCuenta(prev => ({
        ...prev,
        [loteCuenta]: appendUniqueFiles(prev[loteCuenta] || [], files),
      }))
    }
    e.target.value = ''
    setLoteCuenta(null)
  }
  const onSoporteFileChange = e => {
    const files = Array.from(e.target.files || [])
    const invalid = files.find(file => !isAllowedUploadFile(file))
    if (invalid) {
      setError('Solo se permiten archivos PDF o imagen en Soporte de pago.')
    } else if (files.length && loteSoporte) {
      setPendSoporte(prev => ({
        ...prev,
        [loteSoporte]: appendUniqueFiles(prev[loteSoporte] || [], files),
      }))
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
    const files = Array.from(e.dataTransfer?.files || [])
    if (!files.length) return
    if (files.some(file => !isAllowedUploadFile(file))) {
      setError('Solo se permiten archivos PDF o imagen en Cuenta de cobro.')
      return
    }
    setPendCuenta(prev => ({
      ...prev,
      [idLote]: appendUniqueFiles(prev[idLote] || [], files),
    }))
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
    const files = Array.from(e.dataTransfer?.files || [])
    if (!files.length) return
    if (files.some(file => !isAllowedUploadFile(file))) {
      setError('Solo se permiten archivos PDF o imagen en Soporte de pago.')
      return
    }
    setPendSoporte(prev => ({
      ...prev,
      [idLote]: appendUniqueFiles(prev[idLote] || [], files),
    }))
  }

  // guardar pendientes usando uploadDocsLote
  const guardarCuenta = async idLote => {
    const files = pendCuenta[idLote] || []
    if (!files.length) return
    try {
      setSavingCuentaFor(idLote, true)
      await uploadDocsLote(idLote, { cuentaFile: files })
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
    const files = pendSoporte[idLote] || []
    if (!files.length) return
    try {
      setSavingSoporteFor(idLote, true)
      await uploadDocsLote(idLote, { soporteFile: files })
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

  const openDocsViewer = async idLote => {
    setDocsViewer({
      open: true,
      idLote,
      loading: true,
      error: null,
      docs: [],
      selectedDoc: null,
    })
    try {
      const docs = await getDocumentosLote(idLote)
      setDocsViewer({
        open: true,
        idLote,
        loading: false,
        error: null,
        docs,
        selectedDoc: docs[0] || null,
      })
    } catch (e) {
      console.error(e)
      setDocsViewer({
        open: true,
        idLote,
        loading: false,
        error: 'No se pudieron cargar los documentos del lote.',
        docs: [],
        selectedDoc: null,
      })
    }
  }

  const openSinglePreview = ({ src, title, tipo }) => {
    if (!src) return
    setDocsViewer({
      open: true,
      idLote: null,
      loading: false,
      error: null,
      docs: [
        {
          _id: `single-${Date.now()}`,
          ruta: src,
          url: src,
          nombre_original: title || 'Documento',
          tipo: tipo || 'documento',
        },
      ],
      selectedDoc: {
        _id: `single-${Date.now()}`,
        ruta: src,
        url: src,
        nombre_original: title || 'Documento',
        tipo: tipo || 'documento',
      },
    })
  }

  const closeDocsViewer = () => {
    setDocsViewer({
      open: false,
      idLote: null,
      loading: false,
      error: null,
      docs: [],
      selectedDoc: null,
    })
  }

  // celda “pendiente”
  const PendingBadge = ({ files = [], onSave, onCancel, saving }) => (
    <div
      className='d-flex align-items-center gap-2 flex-wrap'
      style={{ maxWidth: '100%' }}
    >
      <span className='badge bg-info text-dark fw-semibold'>
        {files.length} archivo(s)
      </span>
      <span
        className='text-muted'
        style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis' }}
        title={files
          .slice(0, 3)
          .map(f => f.name)
          .join(', ')}
      >
        {files
          .slice(0, 2)
          .map(f => f.name)
          .join(' · ')}
        {files.length > 2 ? ` +${files.length - 2}` : ''}
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

  const columns = useMemo(() => {
    const baseCols = [
      { name: 'Lote', selector: r => r.Id_lote, sortable: true, width: '95px' },
    ]

    // Agregar Unidad y Valor solo si tiene permiso
    if (canViewPrices) {
      baseCols.push({
        name: 'Unidad',
        selector: r => r.unidad_negocio ?? '—',
        sortable: true,
        width: '80px',
      })
      baseCols.push({
        name: 'Valor',
        selector: r => r.valor_total_lote ?? 0,
        sortable: true,
        right: true,
        width: '110px',
        cell: r => (
          <span className='fw-semibold'>{moneyCO(r.valor_total_lote)}</span>
        ),
      })
    }

    // Resto de columnas (siempre visibles)
    baseCols.push(
      {
        name: 'Pago',
        selector: r => r.pago_estado ?? '—',
        sortable: true,
        width: '95px',
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
        name: 'Acepta',
        selector: r => (r.aceptacion ? 'Sí' : 'No'),
        sortable: true,
        width: '90px',
        cell: r =>
          r.aceptacion ? (
            <span className='badge bg-primary'>Sí</span>
          ) : (
            <span className='badge bg-secondary'>No</span>
          ),
      },
      {
        name: 'F. aceptación',
        selector: r => fmtDateCompact(r.aceptacion_fecha),
        cell: r => (
          <span className='text-muted'>
            {fmtDateCompact(r.aceptacion_fecha)}
          </span>
        ),
        sortable: true,
        width: '130px',
      }
    )

    // Agregar PDF solo si tiene permiso
    if (canViewPrices) {
      baseCols.push({
        name: 'PDF',
        allowOverflow: true,
        width: '80px',
        center: true,
        cell: r =>
          r.pdf_generado || r.pdf_generado_url ? (
            <button
              type='button'
              className='btn btn-sm btn-outline-primary'
              onClick={() =>
                openSinglePreview({
                  src: r.pdf_generado_url || r.pdf_generado,
                  title: `PDF lote ${r.Id_lote}`,
                  tipo: 'pdf_generado',
                })
              }
            >
              Ver
            </button>
          ) : (
            <span className='text-muted'>—</span>
          ),
      })
    }

    // Columnas de archivos: SIEMPRE visibles
    // Si tiene permiso: interfaz completa
    // Si NO tiene permiso: solo muestra "ok" + botón Ver (sin upload)
    baseCols.push(
      {
        name: 'Cuenta',
        allowOverflow: true,
        grow: 2,
        minWidth: '210px',
        cell: r => {
          const pend = pendCuenta[r.Id_lote] || []
          const latest = r.cuenta_cobro_url || r.cuenta_cobro
          const saving = !!savingCuenta[r.Id_lote]
          const hasFile = !!latest

          // Sin permiso y sin archivo: no mostrar interfaz
          if (!canViewPrices && !hasFile) {
            return <small className='text-muted'>Sin archivos</small>
          }

          // Sin permiso pero CON archivo: mostrar solo "ok" (lectura bloqueada)
          if (!canViewPrices && hasFile) {
            return <span className='badge bg-success'>ok</span>
          }

          // CON permiso: interfaz completa
          return (
            <div
              className='d-flex flex-column gap-1'
              onDragOver={e => handleDragOverCuenta(e, r.Id_lote)}
              onDragLeave={handleDragLeaveCuenta}
              onDrop={e => handleDropCuenta(e, r.Id_lote)}
              title='Arrastra uno o varios archivos (PDF o imagen)'
              style={{
                border:
                  dragOverCuenta === r.Id_lote
                    ? '2px dashed #59A1F7'
                    : '2px dashed transparent',
                borderRadius: 8,
                padding: 4,
                minWidth: 0,
              }}
            >
              <div className='d-flex align-items-center gap-2 flex-wrap'>
                <button
                  type='button'
                  className='btn btn-sm btn-outline-primary'
                  aria-label='Agregar cuenta de cobro (múltiple)'
                  onClick={() => openCuentaPicker(r.Id_lote)}
                  title='Agregar cuenta de cobro (PDF/Imagen)'
                >
                  <FaCloudUploadAlt size={14} /> +
                </button>

                <button
                  type='button'
                  className='btn btn-sm btn-outline-secondary'
                  title='Ver historial de documentos del lote'
                  onClick={() => openDocsViewer(r.Id_lote)}
                >
                  <FaListUl size={13} /> Hist.
                </button>

                {latest ? (
                  <button
                    type='button'
                    className='btn btn-sm btn-outline-info'
                    onClick={() =>
                      openSinglePreview({
                        src: latest,
                        title: `Última cuenta de cobro - ${r.Id_lote}`,
                        tipo: 'cuenta_cobro',
                      })
                    }
                  >
                    Última
                  </button>
                ) : (
                  <small className='text-muted'>Sin archivos</small>
                )}
              </div>

              {!!pend.length && (
                <PendingBadge
                  files={pend}
                  saving={saving}
                  onSave={() => guardarCuenta(r.Id_lote)}
                  onCancel={() => setPendCuentaFor(r.Id_lote, null)}
                />
              )}
            </div>
          )
        },
      },
      {
        name: 'Soporte',
        allowOverflow: true,
        grow: 2,
        minWidth: '210px',
        cell: r => {
          const pend = pendSoporte[r.Id_lote] || []
          const latest = r.soporte_pago_url || r.soporte_pago
          const saving = !!savingSoporte[r.Id_lote]
          const hasFile = !!latest

          // Sin permiso y sin archivo: no mostrar interfaz
          if (!canViewPrices && !hasFile) {
            return <small className='text-muted'>Sin archivos</small>
          }

          // Sin permiso pero CON archivo: mostrar solo "ok" (lectura bloqueada)
          if (!canViewPrices && hasFile) {
            return <span className='badge bg-success'>ok</span>
          }

          // CON permiso: interfaz completa
          return (
            <div
              className='d-flex flex-column gap-1'
              onDragOver={e => handleDragOverSoporte(e, r.Id_lote)}
              onDragLeave={handleDragLeaveSoporte}
              onDrop={e => handleDropSoporte(e, r.Id_lote)}
              title='Arrastra uno o varios archivos (PDF o imagen)'
              style={{
                border:
                  dragOverSoporte === r.Id_lote
                    ? '2px dashed #00BA59'
                    : '2px dashed transparent',
                borderRadius: 8,
                padding: 4,
                minWidth: 0,
              }}
            >
              <div className='d-flex align-items-center gap-2 flex-wrap'>
                <button
                  type='button'
                  className='btn btn-sm btn-outline-success'
                  aria-label='Agregar soporte de pago (múltiple)'
                  onClick={() => openSoportePicker(r.Id_lote)}
                  title='Agregar soporte de pago (PDF/Imagen)'
                >
                  <FaCloudUploadAlt size={14} /> +
                </button>

                <button
                  type='button'
                  className='btn btn-sm btn-outline-secondary'
                  title='Ver historial de documentos del lote'
                  onClick={() => openDocsViewer(r.Id_lote)}
                >
                  <FaListUl size={13} /> Hist.
                </button>

                {latest ? (
                  <button
                    type='button'
                    className='btn btn-sm btn-outline-info'
                    onClick={() =>
                      openSinglePreview({
                        src: latest,
                        title: `Último soporte de pago - ${r.Id_lote}`,
                        tipo: 'soporte_pago',
                      })
                    }
                  >
                    Último
                  </button>
                ) : (
                  <small className='text-muted'>Sin archivos</small>
                )}
              </div>

              {!!pend.length && (
                <PendingBadge
                  files={pend}
                  saving={saving}
                  onSave={() => guardarSoporte(r.Id_lote)}
                  onCancel={() => setPendSoporteFor(r.Id_lote, null)}
                />
              )}
            </div>
          )
        },
      }
    )

    return baseCols
  }, [
    canViewPrices,
    pendCuenta,
    pendSoporte,
    savingCuenta,
    savingSoporte,
    dragOverCuenta,
    dragOverSoporte,
  ])

  // --- estilos compactos (sin tocar anchos definidos)
  const tableStyles = {
    table: {
      style: {
        width: '100%',
        fontSize: '0.9rem',
      },
    },
    headRow: { style: { minHeight: '36px' } },
    headCells: {
      style: {
        fontWeight: 700,
        fontSize: '11px',
        paddingTop: '8px',
        paddingBottom: '8px',
        lineHeight: 1.15,
        whiteSpace: 'normal',
      },
    },
    rows: {
      style: {
        minHeight: '38px',
      },
    },
    cells: {
      style: {
        fontSize: '11px',
        paddingTop: '6px',
        paddingBottom: '6px',
        paddingLeft: '8px',
        paddingRight: '8px',
        overflow: 'visible',
        lineHeight: 1.15,
        whiteSpace: 'normal',
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

        <DocumentosLoteModal
          open={docsViewer.open}
          viewer={docsViewer}
          onClose={closeDocsViewer}
          onSelectDoc={doc =>
            setDocsViewer(prev => ({
              ...prev,
              selectedDoc: doc,
            }))
          }
        />

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
          accept='application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp,.gif'
          multiple
          style={{ display: 'none' }}
          onChange={onCuentaFileChange}
        />
        <input
          ref={soporteInputRef}
          type='file'
          accept='application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp,.gif'
          multiple
          style={{ display: 'none' }}
          onChange={onSoporteFileChange}
        />
      </div>
    </div>
  )
}
