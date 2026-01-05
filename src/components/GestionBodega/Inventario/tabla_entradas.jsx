import { useCallback, useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { Modal as AntdModal } from 'antd'
import { FaCheckCircle, FaEdit } from 'react-icons/fa'
import { listarEntradas, confirmarEntrada } from './entrada_service'
import FormIngreso from './Formingreso' // ajusta si tu ruta real es distinta
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

const badgeByEstado = estado => {
  const e = String(estado || '').toUpperCase()
  if (e === 'BORRADOR') return 'badge bg-warning text-dark'
  if (e === 'CONFIRMADA') return 'badge bg-success'
  if (e === 'ANULADA') return 'badge bg-secondary'
  return 'badge bg-light text-dark'
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

// ✅ Lotes únicos para mostrar en la tabla principal
const getLotesUnicos = entrada => {
  const detalles = Array.isArray(entrada?.Detalles) ? entrada.Detalles : []
  const lotes = detalles
    .map(d => d?.Id_lote || d?.id_lote)
    .filter(Boolean)
    .map(String)

  return Array.from(new Set(lotes))
}

// ✅ Normaliza ruta para que SIEMPRE sea "uploads/..."
const normalizeRutaRelativa = input => {
  if (!input) return ''
  let s = String(input).trim()
  if (!s) return ''

  const lower = s.toLowerCase()

  // Si viene URL completa, extrae desde /uploads/ o /entradas/
  const idxUploads = lower.indexOf('/uploads/')
  if (idxUploads >= 0) {
    s = s.slice(idxUploads + 1) // "uploads/..."
  } else {
    const idxEntradas = lower.indexOf('/entradas/')
    if (idxEntradas >= 0) {
      s = s.slice(idxEntradas + 1) // "entradas/..."
    }
  }

  // limpia prefijos
  s = s.replace(/^\/+/, '')
  s = s.replace(/^api\/+/i, '')
  s = s.replace(/^uploads\/+/i, 'uploads/')

  // si no inicia por uploads/, lo asumimos dentro de uploads
  if (!/^uploads\//i.test(s)) {
    s = `uploads/${s}`
  }

  return s
}

// ===================== Expanded =====================
const ExpandedComponent = ({ data }) => {
  const consecutivo = data?.Numero_documento || '—'
  const estado = data?.Estado || '—'

  const proveedor = data?.Proveedor ? pickNombre(data.Proveedor) : '—'
  const cliente = data?.Cliente ? pickNombre(data.Cliente) : '—'
  const personal = data?.Personal ? pickNombre(data.Personal) : '—'

  const bodega = data?.Id_bodega_destino ?? '—'
  const ubicacion = data?.Id_ubicacion_destino ?? '—'
  const obs = data?.Observaciones || data?.observaciones || '—'

  const pdfRuta = normalizeRutaRelativa(
    data?.Ruta_pdf || data?.ruta_pdf || data?.Ruta_pdf_url || data?.ruta_pdf_url
  )

  const detalles = Array.isArray(data?.Detalles) ? data.Detalles : []

  return (
    <div className='w-100 px-2 py-2'>
      <div className='border rounded bg-light p-3'>
        <div className='d-flex flex-wrap gap-2 justify-content-between align-items-center mb-2'>
          <div className='d-flex flex-wrap gap-2 align-items-center'>
            <span className='badge bg-info text-dark'>
              Consecutivo: {consecutivo}
            </span>
            <span className={badgeByEstado(estado)}>
              {String(estado).toUpperCase()}
            </span>
          </div>

          {pdfRuta ? (
            <SecureArchivo
              rutaRelativa={pdfRuta}
              nombreArchivo={`Entrada-${consecutivo}.pdf`}
              compact
            />
          ) : (
            <span className='text-muted small'>Sin PDF</span>
          )}
        </div>

        <div className='row g-3'>
          <div className='col-12 col-md-4'>
            <div className='fw-bold mb-1'>Proveedor</div>
            <div className='text-muted'>{proveedor}</div>
          </div>

          <div className='col-12 col-md-4'>
            <div className='fw-bold mb-1'>Cliente</div>
            <div className='text-muted'>{cliente}</div>
          </div>

          <div className='col-12 col-md-4'>
            <div className='fw-bold mb-1'>Operador</div>
            <div className='text-muted'>{personal}</div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Bodega destino</div>
            <div className='text-muted'>{String(bodega)}</div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Ubicación destino</div>
            <div className='text-muted'>{String(ubicacion)}</div>
          </div>

          <div className='col-12 col-md-6'>
            <div className='fw-bold mb-1'>Observaciones</div>
            <div className='text-muted'>{obs}</div>
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
                      const prodId = d?.Id_producto || d?.id_producto
                      const prodNom =
                        d?.Producto?.Nombre ||
                        d?.Producto?.nombre ||
                        d?.producto_nombre ||
                        '—'
                      const loteId = d?.Id_lote || d?.id_lote
                      const cantidad = d?.Cantidad ?? d?.cantidad ?? '—'

                      const evidenciaRuta = normalizeRutaRelativa(
                        d?.Ruta_foto ||
                          d?.ruta_foto ||
                          d?.Ruta_foto_url ||
                          d?.ruta_foto_url ||
                          d?.Ruta_evidencia ||
                          d?.ruta_evidencia ||
                          ''
                      )

                      const key = `${prodId || 'x'}-${loteId || 'y'}-${
                        d?.Id_detalle || d?.id_detalle || Math.random()
                      }`

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
const TablaEntradas = () => {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  })

  const [error, setError] = useState(null)

  // panel filtros
  const [showFilters, setShowFilters] = useState(false)

  // filtros aplicados
  const [estado, setEstado] = useState('') // '' = todas
  const [q, setQ] = useState('')

  // paginación server
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  // modal editar con FormIngreso
  const [openEdit, setOpenEdit] = useState(false)
  const [entradaEditar, setEntradaEditar] = useState(null)

  const params = useMemo(
    () => ({
      estado: estado || undefined,
      q: q?.trim() || undefined,
      page,
      limit,
    }),
    [estado, q, page, limit]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let resp

      // Si hay estado: usa endpoint /entradas/estado/:estado
      if (estado) {
        const token = localStorage.getItem('token')
        const baseURL = import.meta.env.VITE_API_URL
        const url = `${String(baseURL || '').replace(
          /\/$/,
          ''
        )}/entradas/estado/${encodeURIComponent(estado)}`

        const qs = new URLSearchParams()
        qs.set('page', String(page))
        qs.set('limit', String(limit))
        if (q?.trim()) qs.set('q', q.trim())

        const r = await fetch(`${url}?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await r.json()
        if (!r.ok) throw new Error(json?.message || 'Error listando entradas')
        resp = json
      } else {
        resp = await listarEntradas(params)
      }

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
      setError(e?.message || 'No se pudo cargar Entradas.')
    } finally {
      setLoading(false)
    }
  }, [estado, q, page, limit, params])

  useEffect(() => {
    load()
  }, [load])

  const openEditar = r => {
    setEntradaEditar(r)
    setOpenEdit(true)
  }

  const closeEditar = () => {
    setOpenEdit(false)
    setEntradaEditar(null)
  }

  const columns = useMemo(() => {
    return [
      {
        name: 'Consecutivo',
        selector: r => r?.Numero_documento,
        sortable: true,
        width: '110px',
        cell: r => (
          <span className='fw-semibold'>
            <Ellipsis title={r?.Numero_documento}>
              {r?.Numero_documento || '—'}
            </Ellipsis>
          </span>
        ),
      },
      {
        name: 'Estado',
        selector: r => r?.Estado,
        sortable: true,
        width: '120px',
        cell: r => (
          <span className={badgeByEstado(r?.Estado)}>
            {String(r?.Estado || '—').toUpperCase()}
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
        selector: r => r?.Fecha_entrada || r?.createdAt,
        sortable: true,
        width: '120px',
        cell: r => (
          <span className='text-muted'>
            {fmtDate(r?.Fecha_entrada || r?.createdAt)}
          </span>
        ),
      },
      {
        name: 'Proveedor',
        selector: r => pickNombre(r?.Proveedor),
        sortable: true,
        grow: 2,
        cell: r => {
          const v = pickNombre(r?.Proveedor)
          return <Ellipsis title={v}>{v}</Ellipsis>
        },
      },
      {
        name: 'Cliente',
        selector: r => pickNombre(r?.Cliente),
        sortable: true,
        grow: 2,
        cell: r => {
          const v = pickNombre(r?.Cliente)
          return <Ellipsis title={v}>{v}</Ellipsis>
        },
      },
      {
        name: 'Destino',
        sortable: false,
        grow: 2,
        cell: r => (
          <div className='small text-muted'>
            <div>
              <b>Bodega:</b> {String(r?.Id_bodega_destino ?? '—')}
            </div>
            <div>
              <b>Ubic:</b> {String(r?.Id_ubicacion_destino ?? '—')}
            </div>
          </div>
        ),
      },
      {
        name: 'PDF',
        right: true,
        width: '120px',
        cell: r => {
          const pdfRuta = normalizeRutaRelativa(
            r?.Ruta_pdf || r?.ruta_pdf || r?.Ruta_pdf_url || r?.ruta_pdf_url
          )
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

      // ✅ Acciones compactas (iconos + tooltip)
      {
        name: 'Acciones',
        right: true,
        width: '90px',
        cell: r => {
          const est = String(r?.Estado || '').toUpperCase()

          if (est !== 'BORRADOR') {
            return <span className='text-muted small'>—</span>
          }

          const onConfirm = () => {
            const id = r?.Id_entrada || r?.id_entrada
            AntdModal.confirm({
              title: 'Confirmar entrada',
              content: `¿Deseas confirmar la entrada ${
                r?.Numero_documento || id
              }?`,
              okText: 'Confirmar',
              okType: 'primary',
              cancelText: 'Cancelar',
              centered: true,
              async onOk() {
                await confirmarEntrada(id)
                await load()
              },
            })
          }

          return (
            <div className='d-flex justify-content-end gap-2 w-100'>
              <button
                type='button'
                className='btn btn-sm btn-outline-primary p-1'
                title='Editar'
                onClick={() => openEditar(r)}
              >
                <FaEdit size={14} />
              </button>

              <button
                type='button'
                className='btn btn-sm btn-outline-success p-1'
                title='Confirmar borrador'
                onClick={onConfirm}
              >
                <FaCheckCircle size={14} />
              </button>
            </div>
          )
        },
      },
    ]
  }, [load])

  const onResetFiltros = () => {
    setEstado('')
    setQ('')
    setPage(1)
    setLimit(10)
  }

  return (
    <>
      <div className='card'>
        <div className='card-header d-flex align-items-end'>
          <div className='me-auto'>
            <strong>Entradas</strong>
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
                <div className='col-12 col-md-3'>
                  <label className='form-label small mb-1'>Estado</label>
                  <select
                    className='form-select form-select-sm'
                    value={estado}
                    onChange={e => {
                      setEstado(e.target.value)
                      setPage(1)
                    }}
                  >
                    <option value=''>Todas</option>
                    <option value='BORRADOR'>Borrador</option>
                    <option value='CONFIRMADA'>Confirmada</option>
                    <option value='ANULADA'>Anulada</option>
                  </select>
                </div>

                <div className='col-12 col-md-4'>
                  <label className='form-label small mb-1'>Buscar</label>
                  <input
                    className='form-control form-control-sm'
                    placeholder='Consecutivo / texto...'
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

      <AntdModal
        open={openEdit}
        onCancel={closeEditar}
        footer={null}
        width={1100}
        centered
        destroyOnClose
        title={
          <div className='d-flex flex-wrap align-items-center gap-2'>
            <span>Editar Entrada</span>
            {entradaEditar?.Numero_documento && (
              <span className='badge bg-info text-dark'>
                {entradaEditar.Numero_documento}
              </span>
            )}
            <span className={badgeByEstado(entradaEditar?.Estado)}>
              {String(entradaEditar?.Estado || '').toUpperCase()}
            </span>
          </div>
        }
      >
        <FormIngreso
          key={entradaEditar?.Id_entrada || entradaEditar?.id_entrada || 'edit'}
          initialEntrada={entradaEditar}
          onClose={closeEditar}
          onSuccess={async () => {
            closeEditar()
            await load()
          }}
        />
      </AntdModal>
    </>
  )
}

export default TablaEntradas
