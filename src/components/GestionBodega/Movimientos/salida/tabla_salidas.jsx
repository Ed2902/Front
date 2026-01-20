// tabla_salidas.jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import SecureArchivo from '../../Inventario/SecureArchivo'
import { listarSalidas, getProductos, getPersonal } from './salida_service'

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

const pickNombre = obj => {
  if (!obj) return '—'
  return (
    obj?.Nombre ||
    obj?.nombre ||
    obj?.Razon_social ||
    obj?.razon_social ||
    obj?.Nombre_completo ||
    obj?.nombre_completo ||
    obj?.name ||
    obj?.label ||
    '—'
  )
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

// ✅ Normaliza ruta para que SIEMPRE sea "uploads/..."
const normalizeRutaRelativa = input => {
  if (!input) return ''
  let s = String(input).trim()
  if (!s || s === 'PENDIENTE') return ''

  const lower = s.toLowerCase()

  // Si viene URL completa, extrae desde /uploads/ o /salidas/
  const idxUploads = lower.indexOf('/uploads/')
  if (idxUploads >= 0) {
    s = s.slice(idxUploads + 1) // "uploads/..."
  } else {
    const idxSalidas = lower.indexOf('/salidas/')
    if (idxSalidas >= 0) {
      s = s.slice(idxSalidas + 1) // "salidas/..."
    }
  }

  s = s.replace(/^\/+/, '')
  s = s.replace(/^api\/+/i, '')
  s = s.replace(/^uploads\/+/i, 'uploads/')

  if (!/^uploads\//i.test(s)) s = `uploads/${s}`
  return s
}

const getDetalles = row => {
  if (Array.isArray(row?.detalles)) return row.detalles
  if (Array.isArray(row?.Detalles)) return row.Detalles
  return []
}

// ✅ Lotes únicos para la tabla principal (igual estilo entradas)
const getLotesUnicos = salida => {
  const detalles = getDetalles(salida)
  const lotes = detalles
    .map(d => d?.id_lote || d?.Id_lote)
    .filter(Boolean)
    .map(String)
  return Array.from(new Set(lotes))
}

const sumCantidad = detalles =>
  detalles.reduce((acc, d) => acc + (Number(d?.cantidad) || 0), 0)

// ===================== Expanded =====================
const ExpandedComponent = ({ data, maps }) => {
  const id = data?.id_salida ?? data?.Id_salida ?? '—'
  const consecutivo = data?.nombre || `Salida #${id}`
  const fecha = data?.fecha_salida || data?.createdAt
  const comentario = data?.comentario || '—'

  const idPersonal = data?.id_personal ?? '—'
  const nombrePersonal =
    maps?.personalById?.get(String(idPersonal)) || String(idPersonal)

  const pdfRuta = normalizeRutaRelativa(data?.ruta_pdf || '')

  const detalles = getDetalles(data)

  return (
    <div className='w-100 px-2 py-2'>
      <div className='border rounded bg-light p-3'>
        <div className='d-flex flex-wrap gap-2 justify-content-between align-items-center mb-2'>
          <div className='d-flex flex-wrap gap-2 align-items-center'>
            <span className='badge bg-info text-dark'>
              Consecutivo: {consecutivo}
            </span>
            <span className='text-muted small'>{fmtDate(fecha)}</span>
            <span className='badge bg-secondary'>
              Detalles: {detalles.length}
            </span>
            <span className='badge bg-dark'>
              Total: {sumCantidad(detalles)}
            </span>
          </div>

          {pdfRuta ? (
            <SecureArchivo
              rutaRelativa={pdfRuta}
              nombreArchivo={pdfRuta.split('/').pop()}
              compact
            />
          ) : (
            <span className='text-muted small'>Sin PDF</span>
          )}
        </div>

        <div className='row g-3'>
          <div className='col-12 col-md-4'>
            <div className='fw-bold mb-1'>Operador</div>
            <div className='text-muted'>{nombrePersonal}</div>
          </div>

          <div className='col-12 col-md-4'>
            <div className='fw-bold mb-1'>Alistamiento</div>
            <div className='text-muted'>
              {String(data?.id_alistamiento ?? '—')}
            </div>
          </div>

          <div className='col-12 col-md-4'>
            <div className='fw-bold mb-1'>Cliente</div>
            <div className='text-muted'>{String(data?.id_cliente ?? '—')}</div>
          </div>

          <div className='col-12'>
            <div className='fw-bold mb-1'>Comentario</div>
            <div className='text-muted'>{comentario || '—'}</div>
          </div>

          <div className='col-12'>
            <div className='fw-bold mb-2'>Detalles</div>

            {detalles.length ? (
              <div className='table-responsive'>
                <table className='table table-sm table-striped align-middle mb-0'>
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>Producto</th>
                      <th>Nombre</th>
                      <th style={{ width: 110 }}>Lote</th>
                      <th style={{ width: 110 }} className='text-end'>
                        Cantidad
                      </th>
                      <th style={{ width: 160 }}>Evidencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalles.map(d => {
                      const prodId = d?.id_producto ?? d?.Id_producto
                      const prodNom =
                        maps?.productoById?.get(String(prodId)) ||
                        d?.Producto?.Nombre ||
                        d?.Producto?.nombre ||
                        '—'
                      const loteId = d?.id_lote ?? d?.Id_lote
                      const cantidad = d?.cantidad ?? d?.Cantidad ?? '—'

                      const evidenciaRuta = normalizeRutaRelativa(
                        d?.evidencia_foto ||
                          d?.Evidencia_foto ||
                          d?.ruta_evidencia ||
                          d?.Ruta_evidencia ||
                          ''
                      )

                      const key = `${String(id)}-${String(
                        d?.id_detalle ?? d?.Id_detalle ?? `${prodId}-${loteId}`
                      )}`

                      return (
                        <tr key={key}>
                          <td>{prodId || '—'}</td>
                          <td>
                            <Ellipsis title={prodNom}>{prodNom}</Ellipsis>
                          </td>
                          <td>{loteId || '—'}</td>
                          <td className='text-end'>{cantidad}</td>
                          <td>
                            {evidenciaRuta ? (
                              <SecureArchivo
                                rutaRelativa={evidenciaRuta}
                                nombreArchivo={evidenciaRuta.split('/').pop()}
                                compact
                              />
                            ) : (
                              <span className='text-muted small'>—</span>
                            )}
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
const TablaSalidas = () => {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  })

  const [error, setError] = useState(null)

  // panel filtros (igual entradas)
  const [showFilters, setShowFilters] = useState(false)

  // filtros
  const [q, setQ] = useState('')

  // paginación server
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  // catálogos (id -> nombre)
  const [productoById, setProductoById] = useState(new Map())
  const [personalById, setPersonalById] = useState(new Map())

  const maps = useMemo(
    () => ({ productoById, personalById }),
    [productoById, personalById]
  )

  const params = useMemo(
    () => ({
      q: q?.trim() || undefined,
      page,
      limit: Math.min(100, limit),
    }),
    [q, page, limit]
  )

  // carga catálogos una sola vez
  useEffect(() => {
    let alive = true

    const loadCatalogos = async () => {
      try {
        const [prods, pers] = await Promise.all([getProductos(), getPersonal()])

        if (!alive) return

        // productos: puede venir {data:[...]} o [...]
        const listaProductos = Array.isArray(prods?.data)
          ? prods.data
          : Array.isArray(prods)
            ? prods
            : []
        const mProd = new Map()
        listaProductos.forEach(p => {
          const id = p?.Id_producto ?? p?.id_producto ?? p?.id ?? p?.Id
          if (!id) return
          const nombre = p?.Nombre ?? p?.nombre ?? p?.name ?? p?.label
          if (nombre) mProd.set(String(id), String(nombre))
        })
        setProductoById(mProd)

        // personal: puede venir {data:[...]} o [...]
        const listaPersonal = Array.isArray(pers?.data)
          ? pers.data
          : Array.isArray(pers)
            ? pers
            : []
        const mPer = new Map()
        listaPersonal.forEach(per => {
          const id =
            per?.Id_personal ??
            per?.id_personal ??
            per?.id ??
            per?.Id ??
            per?.Cedula ??
            per?.cedula
          if (!id) return
          const nombre = pickNombre(per)
          if (nombre) mPer.set(String(id), String(nombre))
        })
        setPersonalById(mPer)
      } catch (e) {
        // si falla catálogo, la tabla igual funciona (muestra ids)
        console.warn('[TablaSalidas] No se pudieron cargar catálogos:', e)
      }
    }

    loadCatalogos()
    return () => {
      alive = false
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await listarSalidas(params)
      const list = Array.isArray(resp?.data) ? resp.data : []
      const m = resp?.meta || {}

      setRows(list)
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
      setError(e?.message || 'No se pudo cargar Salidas.')
    } finally {
      setLoading(false)
    }
  }, [page, limit, params])

  useEffect(() => {
    load()
  }, [load])

  const columns = useMemo(() => {
    return [
      {
        name: 'Consecutivo',
        selector: r => r?.nombre,
        sortable: true,
        width: '170px',
        cell: r => (
          <span className='fw-semibold'>
            <Ellipsis title={r?.nombre || '—'}>{r?.nombre || '—'}</Ellipsis>
          </span>
        ),
      },
      {
        name: 'Lote(s)',
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
        name: 'Fecha',
        selector: r => r?.fecha_salida || r?.createdAt,
        sortable: true,
        width: '130px',
        cell: r => (
          <span className='text-muted'>
            {fmtDate(r?.fecha_salida || r?.createdAt)}
          </span>
        ),
      },
      {
        name: 'Operador',
        sortable: true,
        grow: 2,
        cell: r => {
          const idPer = r?.id_personal
          const nom = personalById.get(String(idPer)) || String(idPer || '—')
          return <Ellipsis title={nom}>{nom}</Ellipsis>
        },
      },
      {
        name: 'Comentario',
        sortable: false,
        grow: 3,
        cell: r => {
          const v = r?.comentario || '—'
          return <Ellipsis title={v}>{v}</Ellipsis>
        },
      },
      {
        name: 'PDF',
        right: true,
        width: '120px',
        cell: r => {
          const pdfRuta = normalizeRutaRelativa(r?.ruta_pdf)
          if (!pdfRuta) return <span className='text-muted small'>—</span>
          return (
            <SecureArchivo
              rutaRelativa={pdfRuta}
              nombreArchivo={pdfRuta.split('/').pop()}
              compact
            />
          )
        },
      },
    ]
  }, [personalById])

  const onResetFiltros = () => {
    setQ('')
    setPage(1)
    setLimit(10)
  }

  return (
    <div className='card'>
      <div className='card-header d-flex align-items-end'>
        <div className='me-auto'>
          <strong>Salidas</strong>
          <div className='text-muted small'>
            Listado con detalle desplegable, filtros y paginación.
          </div>
        </div>
      </div>

      <div className='card-body'>
        {error && <div className='alert alert-danger py-2 mb-3'>{error}</div>}

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
              <div className='col-12 col-md-5'>
                <label className='form-label small mb-1'>Buscar</label>
                <input
                  className='form-control form-control-sm'
                  placeholder='Consecutivo / comentario...'
                  value={q}
                  onChange={e => {
                    setQ(e.target.value)
                    setPage(1)
                  }}
                />
              </div>

              <div className='col-12 col-md-3'>
                <label className='form-label small mb-1'>Filas</label>
                <select
                  className='form-select form-select-sm'
                  value={limit}
                  onChange={e => {
                    const v = Number(e.target.value) || 10
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
          expandableRowsComponent={props => (
            <ExpandedComponent {...props} maps={maps} />
          )}
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

export default TablaSalidas
