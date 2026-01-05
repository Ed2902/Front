// tabla_alistamientos.jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from 'react-data-table-component'
import { Modal as AntdModal } from 'antd'
import { FaEdit, FaTimesCircle, FaArrowUp } from 'react-icons/fa'
import {
  listarAlistamientos,
  cancelarAlistamiento,
} from './alistamiento_service'
import SecureArchivo from './SecureArchivo'

// ===================== Helpers =====================
const fmtDate = iso => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const safeUpper = v => String(v || '').toUpperCase()

const badgeByEstado = estado => {
  const e = safeUpper(estado)
  if (e === 'ABIERTO') return 'badge bg-warning text-dark'
  if (e === 'DESPACHADO') return 'badge bg-success'
  if (e === 'CANCELADO') return 'badge bg-danger'
  return 'badge bg-secondary'
}

const tableStyles = {
  headCells: {
    style: {
      fontWeight: 700,
      whiteSpace: 'nowrap',
      paddingTop: '0.55rem',
      paddingBottom: '0.55rem',
    },
  },
  cells: {
    style: {
      paddingTop: '0.45rem',
      paddingBottom: '0.45rem',
    },
  },
  rows: { style: { minHeight: '44px' } },
}

const Ellipsis = ({ title, children }) => (
  <span
    title={title || children}
    style={{
      display: 'inline-block',
      maxWidth: '100%',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      verticalAlign: 'bottom',
    }}
  >
    {children}
  </span>
)

const pickFirstDefined = (...vals) => vals.find(v => v != null && v !== '')

const idAlist = r =>
  pickFirstDefined(r?.id_alistamiento, r?.Id_alistamiento, r?.id, r?.Id)

const getEstado = r => pickFirstDefined(r?.estado, r?.Estado)
const getNombre = r => pickFirstDefined(r?.nombre, r?.Nombre)
const getCliente = r =>
  pickFirstDefined(r?.id_cliente, r?.id_Cliente, r?.Id_cliente, r?.Id_Cliente)
const getPersonal = r => pickFirstDefined(r?.id_personal, r?.Id_personal)

const getObservaciones = r =>
  pickFirstDefined(
    r?.observaciones,
    r?.Observaciones,
    r?.comentario,
    r?.Comentario
  )

const getCreatedAt = r =>
  pickFirstDefined(
    r?.createdAt,
    r?.CreatedAt,
    r?.fecha,
    r?.Fecha,
    r?.Fecha_creacion
  )

// ✅ Normaliza ruta para que SIEMPRE sea "uploads/..."
const normalizeRutaRelativa = input => {
  if (!input) return ''
  let s = String(input).trim()
  if (!s) return ''

  // si ya es url absoluta
  if (/^(https?:\/\/|data:)/i.test(s)) return s

  const lower = s.toLowerCase()

  // si trae /uploads/ en la url, recorta desde ahí
  const idxUploads = lower.indexOf('/uploads/')
  if (idxUploads >= 0) s = s.slice(idxUploads + 1) // "uploads/..."

  // limpia prefijos
  s = s.replace(/^\/+/, '')
  s = s.replace(/^api\/+/i, '')
  s = s.replace(/^uploads\/+/i, 'uploads/')

  // 🔥 si viene solo filename (como tu API), asumimos carpeta "alistamientos/"
  // si tu backend guarda en otra carpeta, cambia aquí:
  if (!/^uploads\//i.test(s)) s = `uploads/alistamientos/${s}`

  return s
}

const getDetalles = a =>
  (Array.isArray(a?.detalles) && a.detalles) ||
  (Array.isArray(a?.Detalles) && a.Detalles) ||
  (Array.isArray(a?.items) && a.items) ||
  (Array.isArray(a?.Items) && a.Items) ||
  []

// ✅ Lotes únicos (detalle.lote es objeto en tu API)
const getLotesUnicos = alist => {
  const detalles = getDetalles(alist)

  const lotes = detalles
    .map(d => {
      return (
        pickFirstDefined(d?.id_lote, d?.Id_lote) ||
        pickFirstDefined(d?.lote?.Id_lote, d?.lote?.id_lote) ||
        pickFirstDefined(d?.Lote?.Id_lote, d?.Lote?.id_lote) ||
        null
      )
    })
    .filter(Boolean)
    .map(String)

  return Array.from(new Set(lotes))
}

// ✅ Nombre de producto (detalle.producto.Nombre)
const getProductoLabel = det => {
  const idProd = pickFirstDefined(det?.id_producto, det?.Id_producto) || '—'
  const nombre = pickFirstDefined(det?.producto?.Nombre, det?.producto?.nombre)
  if (nombre) return `${nombre} (${idProd})`
  return idProd
}

// ===================== Normaliza respuesta listados =====================
const normalizeListResponse = resp => {
  if (Array.isArray(resp)) {
    return {
      data: resp,
      meta: { page: 1, limit: resp.length, total: resp.length, totalPages: 1 },
    }
  }

  const data =
    resp?.data || resp?.rows || resp?.alistamientos || resp?.result || []

  const meta = resp?.meta
  if (meta) {
    return {
      data: Array.isArray(data) ? data : [],
      meta: {
        page: Number(meta.page) || 1,
        limit: Number(meta.limit) || 10,
        total: Number(meta.total) || (Array.isArray(data) ? data.length : 0),
        totalPages: Number(meta.totalPages) || 1,
      },
    }
  }

  const list = Array.isArray(data) ? data : []
  const total = Number(resp?.count ?? list.length) || list.length
  return {
    data: list,
    meta: { page: 1, limit: list.length || 10, total, totalPages: 1 },
  }
}

// ===================== Expanded =====================
const ExpandedComponent = ({ data }) => {
  const id = idAlist(data)
  const estado = safeUpper(getEstado(data))
  const nombre = getNombre(data) || '—'
  const cliente = getCliente(data)
  const personal = getPersonal(data)
  const obs = getObservaciones(data) || '—'
  const createdAt = getCreatedAt(data)

  const evidenciaRaw = pickFirstDefined(
    data?.evidencia_general,
    data?.Evidencia_general,
    data?.ruta_evidencia_general,
    data?.Ruta_evidencia_general,
    data?.evidencia,
    data?.Evidencia
  )
  const evidenciaRuta = normalizeRutaRelativa(evidenciaRaw)

  const detalles = getDetalles(data)

  return (
    <div className='w-100 px-2 py-2'>
      <div className='border rounded bg-light p-3'>
        <div className='d-flex flex-wrap gap-2 justify-content-between align-items-center mb-2'>
          <div className='d-flex flex-wrap gap-2 align-items-center'>
            <span className='badge bg-info text-dark'>ID: {id ?? '—'}</span>
            <span className={badgeByEstado(estado)}>{estado || '—'}</span>
            <span className='badge bg-secondary'>Ítems: {detalles.length}</span>
          </div>

          {evidenciaRuta ? (
            <SecureArchivo
              rutaRelativa={evidenciaRuta}
              nombreArchivo={String(evidenciaRaw || '')
                .split('/')
                .pop()}
              compact
            />
          ) : (
            <span className='text-muted small'>Sin evidencia</span>
          )}
        </div>

        <div className='row g-3'>
          <div className='col-12 col-md-6'>
            <div className='fw-bold mb-1'>Nombre</div>
            <div className='text-muted'>{nombre}</div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Cliente</div>
            <div className='text-muted'>{cliente ?? '—'}</div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Operador (id_personal)</div>
            <div className='text-muted'>{personal ?? '—'}</div>
          </div>

          <div className='col-12 col-md-4'>
            <div className='fw-bold mb-1'>Creado</div>
            <div className='text-muted'>{fmtDate(createdAt)}</div>
          </div>

          <div className='col-12 col-md-8'>
            <div className='fw-bold mb-1'>Observaciones</div>
            <div className='text-muted'>{obs}</div>
          </div>

          <div className='col-12'>
            <div className='fw-bold mb-2'>Ítems</div>

            {detalles.length ? (
              <div className='table-responsive'>
                <table className='table table-sm table-striped align-middle mb-0'>
                  <thead>
                    <tr>
                      <th style={{ width: 120 }}>Lote</th>
                      <th>Producto</th>
                      <th style={{ width: 120 }} className='text-end'>
                        Cantidad
                      </th>
                      <th>Referencia</th>
                      <th>Unidad</th>
                      <th>Comentario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalles.map((it, idx) => {
                      const lote =
                        pickFirstDefined(it?.id_lote, it?.Id_lote) ||
                        pickFirstDefined(
                          it?.lote?.Id_lote,
                          it?.lote?.id_lote
                        ) ||
                        '—'

                      const prodLabel = getProductoLabel(it)

                      const cant =
                        pickFirstDefined(it?.cantidad, it?.Cantidad) ?? '—'
                      const ref = pickFirstDefined(
                        it?.producto?.Referencia,
                        it?.producto?.referencia
                      )
                      const unidad = pickFirstDefined(
                        it?.producto?.Unidad_de_medida,
                        it?.producto?.unidad_de_medida,
                        it?.producto?.unidad
                      )
                      const comentario =
                        pickFirstDefined(it?.comentario, it?.Comentario) || '—'

                      const key = `${lote}-${
                        pickFirstDefined(it?.id_producto, it?.Id_producto) ||
                        idx
                      }-${idx}`

                      return (
                        <tr key={key}>
                          <td className='fw-semibold'>{lote}</td>
                          <td>
                            <Ellipsis title={prodLabel}>{prodLabel}</Ellipsis>
                          </td>
                          <td className='text-end fw-semibold'>{cant}</td>
                          <td className='text-muted'>{ref ?? '—'}</td>
                          <td className='text-muted'>{unidad ?? '—'}</td>
                          <td>
                            <Ellipsis title={comentario}>{comentario}</Ellipsis>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='text-muted'>—</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ===================== Main =====================
const TablaAlistamientos = ({ onEditar, onCrearSalida }) => {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 1,
  })
  const [error, setError] = useState(null)

  const [showFilters, setShowFilters] = useState(false)

  // filtros
  const [estado, setEstado] = useState('')
  const [nombre, setNombre] = useState('')
  const [idCliente, setIdCliente] = useState('')
  const [idPersonal, setIdPersonal] = useState('')
  const [q, setQ] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // paginación server
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(100)

  const params = useMemo(() => {
    const p = { page, limit }
    if (estado) p.estado = estado
    if (nombre.trim()) p.nombre = nombre.trim()
    if (q.trim()) p.q = q.trim()
    if (idCliente !== '') p.id_cliente = idCliente
    if (idPersonal.trim()) p.id_personal = idPersonal.trim()
    if (desde) p.desde = desde
    if (hasta) p.hasta = hasta
    return p
  }, [page, limit, estado, nombre, q, idCliente, idPersonal, desde, hasta])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await listarAlistamientos(params)
      const norm = normalizeListResponse(resp)

      setRows(Array.isArray(norm?.data) ? norm.data : [])

      const m = norm?.meta || {}
      setMeta({
        page: Number(m.page) || page,
        limit: Number(m.limit) || limit,
        total: Number(m.total) || 0,
        totalPages: Number(m.totalPages) || 1,
      })
    } catch (e) {
      console.error(e)
      setRows([])
      setMeta({ page, limit, total: 0, totalPages: 1 })
      setError(
        e?.response?.data?.message ||
          e?.message ||
          'No se pudo cargar Alistamientos.'
      )
    } finally {
      setLoading(false)
    }
  }, [params, page, limit])

  useEffect(() => {
    load()
  }, [load])

  const onResetFiltros = () => {
    setEstado('')
    setNombre('')
    setIdCliente('')
    setIdPersonal('')
    setQ('')
    setDesde('')
    setHasta('')
    setPage(1)
    setLimit(100)
  }

  // ✅ FIX: useCallback + dep stable
  const handleCancelar = useCallback(
    row => {
      const id = idAlist(row)
      const est = safeUpper(getEstado(row))
      if (est !== 'ABIERTO') return

      AntdModal.confirm({
        title: 'Cancelar alistamiento',
        content: `¿Deseas cancelar el alistamiento ${id}?`,
        okText: 'Cancelar',
        okType: 'danger',
        cancelText: 'Cerrar',
        centered: true,
        async onOk() {
          await cancelarAlistamiento(id)
          await load()
        },
      })
    },
    [load]
  )

  // ✅ NUEVO: pasar datos al FormSalida (sin tocar UI/UX)
  const handleCrearSalida = useCallback(
    row => {
      // si el padre provee handler, se respeta
      if (typeof onCrearSalida === 'function') return onCrearSalida(row)

      // fallback: navegar directo y pasar el alistamiento completo (incluye detalles)
      navigate('/movimientos/salida', {
        state: { prefillSalida: row },
      })
    },
    [onCrearSalida, navigate]
  )

  const columns = useMemo(() => {
    return [
      {
        name: 'ID',
        selector: r => idAlist(r),
        sortable: true,
        width: '65px',
        cell: r => (
          <span className='fw-semibold'>
            <Ellipsis title={String(idAlist(r) ?? '')}>
              {idAlist(r) ?? '—'}
            </Ellipsis>
          </span>
        ),
      },
      {
        name: 'Estado',
        selector: r => getEstado(r),
        sortable: true,
        width: '100px',
        cell: r => {
          const est = safeUpper(getEstado(r))
          return <span className={badgeByEstado(est)}>{est || '—'}</span>
        },
      },
      {
        name: 'Nombre',
        selector: r => getNombre(r),
        sortable: true,
        grow: 3,
        cell: r => {
          const v = getNombre(r) || '—'
          return <Ellipsis title={v}>{v}</Ellipsis>
        },
      },
      {
        name: 'Lotes',
        sortable: false,
        grow: 2,
        cell: r => {
          const lotes = getLotesUnicos(r)
          if (!lotes.length) return <span className='text-muted'>—</span>
          const txt = lotes.join(', ')
          return <Ellipsis title={txt}>{txt}</Ellipsis>
        },
      },
      {
        name: 'Items',
        sortable: true,
        width: '70px',
        selector: r => getDetalles(r).length,
        cell: r => (
          <span className='badge bg-dark'>{getDetalles(r).length}</span>
        ),
      },
      {
        name: 'Cliente',
        selector: r => getCliente(r),
        sortable: true,
        width: '140px',
        cell: r => <span className='text-muted'>{getCliente(r) ?? '—'}</span>,
      },
      {
        name: 'Operador',
        selector: r => getPersonal(r),
        sortable: true,
        width: '100px',
        cell: r => <span className='text-muted'>{getPersonal(r) ?? '—'}</span>,
      },
      {
        name: 'Fecha',
        selector: r => getCreatedAt(r),
        sortable: true,
        width: '90px',
        cell: r => (
          <span className='text-muted'>{fmtDate(getCreatedAt(r))}</span>
        ),
      },
      {
        name: 'Evidencia',
        right: true,
        width: '110px',
        cell: r => {
          const evidenciaRaw = pickFirstDefined(
            r?.evidencia_general,
            r?.Evidencia_general,
            r?.ruta_evidencia_general,
            r?.Ruta_evidencia_general,
            r?.evidencia,
            r?.Evidencia
          )
          const evidenciaRuta = normalizeRutaRelativa(evidenciaRaw)
          if (!evidenciaRuta) return <span className='text-muted small'>—</span>
          return (
            <SecureArchivo
              rutaRelativa={evidenciaRuta}
              nombreArchivo={String(evidenciaRaw || '')
                .split('/')
                .pop()}
              compact
            />
          )
        },
      },
      {
        name: 'Acciones',
        right: true,
        width: '110px',
        cell: r => {
          const est = safeUpper(getEstado(r))
          const canEdit = est === 'ABIERTO'
          if (!canEdit) return <span className='text-muted small'>—</span>

          return (
            <div className='d-flex justify-content-end gap-2 w-100'>
              <button
                type='button'
                className='btn btn-sm btn-outline-primary p-1'
                title='Editar'
                onClick={() => onEditar?.(r)}
              >
                <FaEdit size={14} />
              </button>

              <button
                type='button'
                className='btn btn-sm btn-outline-danger p-1'
                title='Cancelar'
                onClick={() => handleCancelar(r)}
              >
                <FaTimesCircle size={14} />
              </button>

              <button
                type='button'
                className='btn btn-sm btn-outline-success p-1'
                title='Crear salida'
                onClick={() => handleCrearSalida(r)}
              >
                <FaArrowUp size={14} />
              </button>
            </div>
          )
        },
      },
    ]
  }, [onEditar, handleCrearSalida, handleCancelar])

  return (
    <div className='card'>
      <div className='card-header d-flex align-items-end'>
        <div className='me-auto'>
          <strong>Alistamientos</strong>
          <div className='text-muted small'>
            Listado con detalle desplegable, filtros y paginación.
          </div>
        </div>
      </div>

      <div className='card-body'>
        {error ? (
          <div className='alert alert-danger py-2 mb-3'>{error}</div>
        ) : null}

        <div className='d-flex flex-wrap gap-2 align-items-center mb-2'>
          <button
            className='btn btn-sm btn-outline-primary'
            onClick={() => setShowFilters(v => !v)}
          >
            {showFilters ? 'Ocultar filtros' : 'Filtros'}
          </button>

          <button
            className='btn btn-sm btn-outline-secondary'
            onClick={load}
            disabled={loading}
          >
            Refrescar
          </button>

          <div className='ms-auto d-flex gap-2 align-items-center'>
            <span className='text-muted small'>
              Total: <b>{meta.total}</b>
            </span>
          </div>
        </div>

        {showFilters && (
          <div className='border rounded p-3 mb-2 bg-light'>
            <div className='row g-2 align-items-end'>
              <div className='col-12 col-md-2'>
                <label className='form-label small mb-1'>Estado</label>
                <select
                  className='form-select form-select-sm'
                  value={estado}
                  onChange={e => {
                    setEstado(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value=''>Todos</option>
                  <option value='ABIERTO'>ABIERTO</option>
                  <option value='DESPACHADO'>DESPACHADO</option>
                  <option value='CANCELADO'>CANCELADO</option>
                </select>
              </div>

              <div className='col-12 col-md-3'>
                <label className='form-label small mb-1'>Nombre</label>
                <input
                  className='form-control form-control-sm'
                  placeholder='Nombre (contiene)'
                  value={nombre}
                  onChange={e => {
                    setNombre(e.target.value)
                    setPage(1)
                  }}
                />
              </div>

              <div className='col-12 col-md-2'>
                <label className='form-label small mb-1'>Cliente</label>
                <input
                  className='form-control form-control-sm'
                  placeholder='id_cliente'
                  value={idCliente}
                  onChange={e => {
                    setIdCliente(e.target.value)
                    setPage(1)
                  }}
                />
              </div>

              <div className='col-12 col-md-2'>
                <label className='form-label small mb-1'>Operador</label>
                <input
                  className='form-control form-control-sm'
                  placeholder='id_personal'
                  value={idPersonal}
                  onChange={e => {
                    setIdPersonal(e.target.value)
                    setPage(1)
                  }}
                />
              </div>

              <div className='col-12 col-md-3'>
                <label className='form-label small mb-1'>Buscar</label>
                <input
                  className='form-control form-control-sm'
                  placeholder='q (texto libre)'
                  value={q}
                  onChange={e => {
                    setQ(e.target.value)
                    setPage(1)
                  }}
                />
              </div>

              <div className='col-12 col-md-2'>
                <label className='form-label small mb-1'>Desde</label>
                <input
                  type='date'
                  className='form-control form-control-sm'
                  value={desde}
                  onChange={e => {
                    setDesde(e.target.value)
                    setPage(1)
                  }}
                />
              </div>

              <div className='col-12 col-md-2'>
                <label className='form-label small mb-1'>Hasta</label>
                <input
                  type='date'
                  className='form-control form-control-sm'
                  value={hasta}
                  onChange={e => {
                    setHasta(e.target.value)
                    setPage(1)
                  }}
                />
              </div>

              <div className='col-12 col-md-2'>
                <label className='form-label small mb-1'>Filas</label>
                <select
                  className='form-select form-select-sm'
                  value={limit}
                  onChange={e => {
                    const v = Number(e.target.value) || 100
                    setLimit(Math.min(100, v))
                    setPage(1)
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className='col-12 col-md-2 d-flex gap-2'>
                <button
                  type='button'
                  className='btn btn-sm btn-outline-dark w-100'
                  onClick={onResetFiltros}
                  disabled={loading}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          data={rows}
          progressPending={loading}
          highlightOnHover
          dense
          responsive
          customStyles={tableStyles}
          persistTableHead
          expandableRows
          expandableRowsComponent={props => <ExpandedComponent {...props} />}
          noDataComponent={
            <div className='text-muted small py-3'>
              {loading ? 'Cargando…' : 'Sin datos.'}
            </div>
          }
        />

        <div className='d-flex justify-content-between align-items-center mt-2'>
          <div className='small text-muted'>
            Página <b>{meta.page}</b> / {meta.totalPages}
          </div>

          <div className='d-flex gap-2 align-items-center'>
            <button
              className='btn btn-outline-secondary btn-sm'
              disabled={loading || page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              ◀
            </button>

            <button
              className='btn btn-outline-secondary btn-sm'
              disabled={loading || page >= meta.totalPages}
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
            >
              ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TablaAlistamientos
