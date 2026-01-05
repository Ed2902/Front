import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { Modal as AntdModal } from 'antd'
import AuthContext from '../../../context/AuthContext'
import { fetchMisTareasBundle } from './service.MisTareas'
import FiltrosMisTareas from './FiltrosMisTareas.jsx'

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

const getUltimoHist = ticket => {
  const h = Array.isArray(ticket?.estado_historial)
    ? ticket.estado_historial
    : []
  if (!h.length) return null
  return h
    .slice()
    .sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt))
    .at(-1)
}

const tableStyles = {
  headCells: {
    style: {
      fontWeight: 600,
      whiteSpace: 'nowrap',
      paddingTop: '0.5rem',
      paddingBottom: '0.5rem',
    },
  },
  cells: { style: { paddingTop: '0.4rem', paddingBottom: '0.4rem' } },
  rows: { style: { minHeight: '40px' } },
}

// ✅ color utils (para catálogos)
const normalizeHex = hex => {
  const s = String(hex || '').trim()
  if (!s) return ''
  if (s.startsWith('#') && (s.length === 7 || s.length === 4)) return s
  if (/^[0-9a-f]{6}$/i.test(s)) return `#${s}`
  if (/^[0-9a-f]{3}$/i.test(s)) return `#${s}`
  return ''
}

const hexToRgb = hex => {
  const h = normalizeHex(hex)
  if (!h) return null
  let r, g, b
  if (h.length === 4) {
    r = parseInt(h[1] + h[1], 16)
    g = parseInt(h[2] + h[2], 16)
    b = parseInt(h[3] + h[3], 16)
  } else {
    r = parseInt(h.slice(1, 3), 16)
    g = parseInt(h.slice(3, 5), 16)
    b = parseInt(h.slice(5, 7), 16)
  }
  if ([r, g, b].some(v => Number.isNaN(v))) return null
  return { r, g, b }
}

const getContrastingTextColor = bgHex => {
  const rgb = hexToRgb(bgHex)
  if (!rgb) return '#111'
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.6 ? '#111' : '#fff'
}

const CatalogBadge = ({ item, fallback = '—' }) => {
  const label = item?.name || item?.nombre || fallback
  const bg = normalizeHex(item?.color)
  if (!bg) {
    return (
      <span className='badge bg-light text-dark' title={label}>
        {label}
      </span>
    )
  }
  const color = getContrastingTextColor(bg)
  return (
    <span
      className='badge'
      title={label}
      style={{
        background: bg,
        color,
        border: '1px solid rgba(0,0,0,.15)',
        borderRadius: 10,
        padding: '0.25rem 0.5rem',
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  )
}

const orgBadgeStyle = orgId => {
  const org = String(orgId || '').toLowerCase()
  if (org === 'fastway')
    return {
      background: '#FFE3C2',
      color: '#7A3E00',
      border: '1px solid #FFD2A3',
    }
  if (org === 'harvest')
    return {
      background: '#DFF5D8',
      color: '#1F5A1A',
      border: '1px solid #C9EDBF',
    }
  if (org === 'greenway')
    return {
      background: '#D8EEFF',
      color: '#0B3D6E',
      border: '1px solid #C1E4FF',
    }
  return { background: '#EFEFEF', color: '#333', border: '1px solid #E2E2E2' }
}

const OrgBadge = ({ orgId }) => (
  <span
    className='badge'
    style={{
      ...orgBadgeStyle(orgId),
      fontWeight: 700,
      borderRadius: 10,
      padding: '0.25rem 0.5rem',
    }}
    title={orgId || '—'}
  >
    {orgId || '—'}
  </span>
)

const getAsignacionScope = (ticket, id_personal) => {
  const a = ticket?.asignado_a
  if (!a?.tipo)
    return { label: '—', key: 'none', cls: 'badge bg-light text-dark' }

  if (a.tipo === 'personal') {
    const isMe = String(a.id) === String(id_personal)
    return {
      label: isMe ? 'Personal' : 'Personal',
      key: 'personal',
      cls: 'badge bg-primary',
      detail: a.id,
    }
  }

  if (a.tipo === 'team') {
    return { label: 'Team', key: 'team', cls: 'badge bg-success', detail: a.id }
  }

  if (a.tipo === 'area') {
    return {
      label: 'Área',
      key: 'area',
      cls: 'badge bg-info text-dark',
      detail: a.id,
    }
  }

  return { label: '—', key: 'none', cls: 'badge bg-light text-dark' }
}

// ✅ personal map helpers
const getPersonaInfo = (id_personal, personalMap) => {
  const key = String(id_personal ?? '').trim()
  if (!key) return null
  return personalMap?.[key] || null
}

const personaLabel = (id, personalMap) => {
  const p = getPersonaInfo(id, personalMap)
  if (!p) return { title: String(id), subtitle: '—', raw: String(id) }

  const nombre = String(p?.Nombre || '').trim()
  const apellido = String(p?.Apellido || '').trim()
  const cargo = String(p?.Cargo || '').trim()

  const full = [nombre, apellido].filter(Boolean).join(' ').trim() || String(id)
  const sub = cargo || '—'
  return { title: full, subtitle: sub, raw: String(p?.Id_personal ?? id) }
}

// ✅ estado (desde historial) -> item de catálogo
const getEstadoItemDesdeHistorial = (ticket, estadosMap) => {
  const last = getUltimoHist(ticket)
  const id = last?.estado_id
  if (!id) return null
  return estadosMap?.[id] || { _id: id, name: id }
}

// ✅ NUEVO: mostrar "Por:" con nombre si changedBy es id_personal
const changedByLabel = (changedBy, personalMap) => {
  const v = String(changedBy ?? '').trim()
  if (!v) return '—'
  const p = getPersonaInfo(v, personalMap)
  if (!p) return v
  const nombre = String(p?.Nombre || '').trim()
  const apellido = String(p?.Apellido || '').trim()
  const full = [nombre, apellido].filter(Boolean).join(' ').trim()
  return full || v
}

const ExpandedComponent = ({
  data,
  maps,
  onOpenUpdate,
  onOpenChat,
  id_personal,
}) => {
  const estadosMap = maps?.estadosMap || {}
  const prioridadItem = maps?.prioridadesMap?.[data?.prioridad_id] || null
  const categoriaItem = maps?.categoriasMap?.[data?.categoria_id] || null
  const estadoItem = getEstadoItemDesdeHistorial(data, estadosMap)

  const asignado = data?.asignado_a || {}
  const teamObj =
    asignado.tipo === 'team' ? maps?.teamsMap?.[asignado.id] : null
  const areaObj =
    asignado.tipo === 'area' ? maps?.areasMap?.[asignado.id] : null

  const asignadoLabel =
    teamObj?.nombre ||
    teamObj?.name ||
    areaObj?.nombre ||
    areaObj?.name ||
    (asignado?.id ? `${asignado.tipo}: ${asignado.id}` : '—')

  const assignedMembers =
    Array.isArray(data?.assignedMembers) && data.assignedMembers.length
      ? data.assignedMembers
      : teamObj?.personal_ids ||
        teamObj?.personalIds ||
        teamObj?.miembros ||
        teamObj?.members ||
        teamObj?.integrantes ||
        []

  const watchers = Array.isArray(data?.watchers) ? data.watchers : []

  const historial = Array.isArray(data?.estado_historial)
    ? data.estado_historial
    : []
  const historialOrdenado = historial
    .slice()
    .sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt))

  const scope = getAsignacionScope(data, id_personal)
  const personalMap = maps?.personalMap || {}

  return (
    <div className='w-100 px-2 py-2'>
      <div className='border rounded bg-light p-3'>
        <div className='d-flex flex-wrap gap-2 justify-content-end mb-3'>
          <button
            type='button'
            className='btn btn-sm btn-outline-primary'
            onClick={() => onOpenChat?.(data)}
          >
            Abrir chat
          </button>
          <button
            type='button'
            className='btn btn-sm btn-primary'
            onClick={() => onOpenUpdate?.(data)}
          >
            Actualizar
          </button>
        </div>

        <div className='row g-3'>
          <div className='col-12 col-md-6'>
            <div className='fw-bold mb-1'>Descripción</div>
            <div className='text-muted'>{data?.descripcion || '—'}</div>
          </div>

          <div className='col-12 col-md-6'>
            <div className='fw-bold mb-1'>Asignación</div>
            <div className='d-flex align-items-center gap-2'>
              <span className={scope.cls} title={scope.detail || ''}>
                {scope.label}
              </span>
              <span className='text-muted'>{asignadoLabel}</span>
            </div>

            <div className='mt-2'>
              <div className='fw-bold mb-1'>Compañeros</div>

              {Array.isArray(assignedMembers) && assignedMembers.length > 0 ? (
                <div className='d-flex flex-column gap-2'>
                  {assignedMembers.map((id, idx) => {
                    const info = personaLabel(id, personalMap)
                    return (
                      <div
                        key={`${id}-${idx}`}
                        className='border rounded bg-white px-2 py-2'
                      >
                        <div className='d-flex align-items-center justify-content-between flex-wrap gap-2'>
                          <div>
                            <div className='fw-semibold'>{info.title}</div>
                            <div className='text-muted small'>
                              {info.subtitle}
                            </div>
                          </div>
                          <span
                            className='badge bg-dark-subtle text-dark'
                            title='id_personal'
                          >
                            {info.raw}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className='text-muted'>—</div>
              )}
            </div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Estado</div>
            <div className='text-muted'>
              <CatalogBadge item={estadoItem} fallback='—' />
            </div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Categoría</div>
            <div className='text-muted'>
              <CatalogBadge item={categoriaItem} fallback='—' />
            </div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Prioridad</div>
            <div className='text-muted'>
              <CatalogBadge item={prioridadItem} fallback='—' />
            </div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Org</div>
            <div className='text-muted'>
              <OrgBadge orgId={data?.orgId} />
            </div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Actualizado</div>
            <div className='text-muted'>{fmtDate(data?.updatedAt)}</div>
          </div>

          <div className='col-12'>
            <div className='fw-bold mb-2'>Trazabilidad de estado</div>

            {historialOrdenado.length ? (
              <div className='border rounded bg-white p-2'>
                {historialOrdenado.map((h, idx) => {
                  const item = estadosMap?.[h.estado_id] || {
                    _id: h.estado_id,
                    name: h.estado_id,
                  }
                  return (
                    <div
                      key={`${h.estado_id}-${h.changedAt}-${idx}`}
                      className='py-2 border-bottom'
                    >
                      <div className='d-flex flex-wrap gap-2 align-items-center'>
                        <CatalogBadge item={item} fallback={h.estado_id} />
                        <span className='text-muted'>
                          <b>Fecha:</b> {fmtDate(h.changedAt)}
                        </span>
                        <span className='text-muted'>
                          <b>Por:</b> {changedByLabel(h.changedBy, personalMap)}
                        </span>
                      </div>
                      <div className='text-muted mt-1'>
                        <b>Nota:</b> {h.nota?.trim() ? h.nota : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className='text-muted'>—</div>
            )}
          </div>

          {/* ✅ CAMBIO: Watchers ahora por nombre */}
          <div className='col-12'>
            <div className='fw-bold mb-1'>Watchers</div>

            {watchers.length ? (
              <div className='d-flex flex-column gap-2'>
                {watchers.map((w, idx) => {
                  const info = personaLabel(w, personalMap)
                  return (
                    <div
                      key={`${w}-${idx}`}
                      className='border rounded bg-white px-2 py-2'
                    >
                      <div className='d-flex align-items-center justify-content-between flex-wrap gap-2'>
                        <div>
                          <div className='fw-semibold'>{info.title}</div>
                          <div className='text-muted small'>
                            {info.subtitle}
                          </div>
                        </div>
                        <span
                          className='badge bg-dark-subtle text-dark'
                          title='id_personal'
                        >
                          {info.raw}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className='text-muted'>—</div>
            )}
          </div>

          {data?.tipo === 'operacion' && (
            <div className='col-12'>
              <div className='fw-bold mb-2'>Operación</div>
              <div className='row g-2'>
                <div className='col-12 col-md-4'>
                  <div className='text-muted'>
                    <b>Cliente:</b> {data?.operacion?.cliente || '—'}
                  </div>
                </div>
                <div className='col-12 col-md-4'>
                  <div className='text-muted'>
                    <b>Lote:</b> {data?.operacion?.lote || '—'}
                  </div>
                </div>
                <div className='col-12 col-md-4'>
                  <div className='text-muted'>
                    <b>Producto:</b> {data?.operacion?.producto || '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const MisTareas = () => {
  const { token, user } = useContext(AuthContext)
  const id_personal = user?.personal?.id_personal

  const [rawRows, setRawRows] = useState([])
  const [maps, setMaps] = useState({
    estadosMap: {},
    prioridadesMap: {},
    categoriasMap: {},
    teamsMap: {},
    areasMap: {},
    personalMap: {},
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [filtersApplied, setFiltersApplied] = useState({})
  const [showFilters, setShowFilters] = useState(false)

  const [openActualizar, setOpenActualizar] = useState(false)
  const [ticketActualizar, setTicketActualizar] = useState(null)

  const empresas = useMemo(
    () => [
      { orgId: 'Fastway', name: 'Fastway' },
      { orgId: 'Harvest', name: 'Harvest' },
      { orgId: 'Greenway', name: 'Greenway' },
    ],
    []
  )

  const load = useCallback(async () => {
    if (!token || !id_personal) return
    try {
      setLoading(true)
      setError(null)

      const bundle = await fetchMisTareasBundle(
        {
          id_personal,
          page: 1,
          limit: 100,
          orgId: filtersApplied?.orgId || '',
        },
        token
      )

      setRawRows(Array.isArray(bundle.rows) ? bundle.rows : [])
      setMaps(
        bundle.maps || {
          estadosMap: {},
          prioridadesMap: {},
          categoriasMap: {},
          teamsMap: {},
          areasMap: {},
          personalMap: {},
        }
      )
    } catch (e) {
      console.error(e)
      setError('No se pudo cargar Mis Tickets Asignados.')
      setRawRows([])
    } finally {
      setLoading(false)
    }
  }, [token, id_personal, filtersApplied?.orgId])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    let data = [...rawRows]
    const f = filtersApplied || {}

    if (f.orgId)
      data = data.filter(t => String(t.orgId || '') === String(f.orgId))
    if (f.tipo) data = data.filter(t => String(t.tipo || '') === String(f.tipo))

    if (f.activo === 'true') data = data.filter(t => t.activo === true)
    if (f.activo === 'false') data = data.filter(t => t.activo === false)

    if (f.prioridad_id)
      data = data.filter(
        t => String(t.prioridad_id || '') === String(f.prioridad_id)
      )
    if (f.categoria_id)
      data = data.filter(
        t => String(t.categoria_id || '') === String(f.categoria_id)
      )

    if (f.estado_id) {
      data = data.filter(
        t => String(getUltimoHist(t)?.estado_id || '') === String(f.estado_id)
      )
    }

    if (f.team_id) {
      data = data.filter(
        t =>
          t?.asignado_a?.tipo === 'team' &&
          String(t?.asignado_a?.id || '') === String(f.team_id)
      )
    }
    if (f.area_id) {
      data = data.filter(
        t =>
          t?.asignado_a?.tipo === 'area' &&
          String(t?.asignado_a?.id || '') === String(f.area_id)
      )
    }

    if (f.search?.trim()) {
      const q = f.search.trim().toLowerCase()
      data = data.filter(
        t =>
          String(t.code || '')
            .toLowerCase()
            .includes(q) ||
          String(t.titulo || '')
            .toLowerCase()
            .includes(q) ||
          String(t.descripcion || '')
            .toLowerCase()
            .includes(q) ||
          String(t.operacion?.cliente || '')
            .toLowerCase()
            .includes(q) ||
          String(t.operacion?.producto || '')
            .toLowerCase()
            .includes(q) ||
          String(t.operacion?.lote || '')
            .toLowerCase()
            .includes(q)
      )
    }

    return data
  }, [rawRows, filtersApplied])

  const columns = useMemo(() => {
    return [
      { name: 'Code', selector: r => r.code, sortable: true, width: '90px' },
      {
        name: 'Org',
        selector: r => r.orgId,
        sortable: true,
        width: '100px',
        cell: r => <OrgBadge orgId={r.orgId} />,
      },
      {
        name: 'Asignación',
        sortable: true,
        width: '100px',
        selector: r => getAsignacionScope(r, id_personal).key,
        cell: r => {
          const s = getAsignacionScope(r, id_personal)
          return (
            <span className={s.cls} title={s.detail || ''}>
              {s.label}
            </span>
          )
        },
      },
      {
        name: 'Título',
        selector: r => r.titulo,
        sortable: true,
        grow: 2,
        wrap: false,
        cell: r => (
          <span
            title={r.titulo}
            style={{
              display: 'inline-block',
              maxWidth: '120%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {r.titulo || '—'}
          </span>
        ),
      },
      { name: 'Tipo', selector: r => r.tipo, sortable: true, width: '90px' },
      {
        name: 'Estado',
        sortable: true,
        width: '110px',
        selector: r => {
          const item = getEstadoItemDesdeHistorial(r, maps?.estadosMap || {})
          return item?.name || item?.nombre || '—'
        },
        cell: r => {
          const item = getEstadoItemDesdeHistorial(r, maps?.estadosMap || {})
          return <CatalogBadge item={item} fallback='—' />
        },
      },
      {
        name: 'Pri.',
        sortable: true,
        width: '100px',
        selector: r => maps?.prioridadesMap?.[r?.prioridad_id]?.name || '—',
        cell: r => (
          <CatalogBadge
            item={maps?.prioridadesMap?.[r?.prioridad_id] || null}
            fallback='—'
          />
        ),
      },
      {
        name: 'Cat.',
        sortable: true,
        width: '100px',
        selector: r => maps?.categoriasMap?.[r?.categoria_id]?.name || '—',
        cell: r => (
          <CatalogBadge
            item={maps?.categoriasMap?.[r?.categoria_id] || null}
            fallback='—'
          />
        ),
      },
      {
        name: 'Creado',
        selector: r => r.createdAt,
        sortable: true,
        width: '105px',
        cell: r => <span className='text-muted'>{fmtDate(r.createdAt)}</span>,
      },
      {
        name: 'Act.',
        selector: r => r.updatedAt,
        sortable: true,
        width: '105px',
        cell: r => <span className='text-muted'>{fmtDate(r.updatedAt)}</span>,
      },
    ]
  }, [maps, id_personal])

  const onOpenUpdate = ticket => {
    setTicketActualizar(ticket)
    setOpenActualizar(true)
  }

  const onOpenChat = () => {}

  const onApplyFilters = f => {
    setFiltersApplied(f || {})
    setShowFilters(false)
  }

  return (
    <div className='card'>
      <div className='card-header d-flex align-items-end'>
        <div className='me-auto'>
          <strong>Mis Tickets Asignados</strong>
          <div className='text-muted small'>
            Identifica si la asignación es Personal / Team / Área.
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
        </div>

        {showFilters && (
          <div className='mb-2'>
            <FiltrosMisTareas
              token={token}
              empresas={empresas}
              defaultOrgId=''
              onApply={onApplyFilters}
            />
          </div>
        )}

        <DataTable
          columns={columns}
          data={rows}
          progressPending={loading}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[
            10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
          ]}
          highlightOnHover
          dense
          responsive
          customStyles={tableStyles}
          persistTableHead
          expandableRows
          expandableRowsComponent={props => (
            <ExpandedComponent
              {...props}
              maps={maps}
              onOpenUpdate={onOpenUpdate}
              onOpenChat={onOpenChat}
              id_personal={id_personal}
            />
          )}
          noDataComponent={
            <div className='text-muted small py-3'>Sin datos.</div>
          }
        />
      </div>

      <AntdModal
        open={openActualizar}
        title={`Actualizar ticket ${ticketActualizar?.code || ''}`}
        onCancel={() => setOpenActualizar(false)}
        footer={null}
        centered
      >
        <p>Hola mundo 🚧</p>
      </AntdModal>
    </div>
  )
}

export default MisTareas
