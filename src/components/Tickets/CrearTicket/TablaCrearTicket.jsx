import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { Modal as AntdModal } from 'antd'
import AuthContext from '../../../context/AuthContext'
import { fetchMisCreacionesBundle } from './service.CrearTicket'
import Filtros from './Filtros.jsx'
import CrearTicketWizard from './CrearTicketWizard.jsx'

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

const getEstadoNombreDesdeHistorial = (ticket, estadosMap) => {
  const last = getUltimoHist(ticket)
  if (!last?.estado_id) return '—'
  return estadosMap?.[last.estado_id]?.name || last.estado_id
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

const badgeClass = name => {
  const v = String(name || '').toLowerCase()
  if (v.includes('cerr')) return 'badge bg-secondary'
  if (v.includes('resu') || v.includes('solu')) return 'badge bg-success'
  if (v.includes('proce') || v.includes('curso')) return 'badge bg-primary'
  if (v.includes('pend')) return 'badge bg-warning text-dark'
  if (v.includes('abier')) return 'badge bg-info text-dark'
  return 'badge bg-light text-dark'
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

const ExpandedComponent = ({ data, maps, onOpenUpdate, onOpenChat }) => {
  const estadosMap = maps?.estadosMap || {}
  const prioridad = maps?.prioridadesMap?.[data?.prioridad_id]?.name || '—'
  const categoria = maps?.categoriasMap?.[data?.categoria_id]?.name || '—'

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

  const historial = Array.isArray(data?.estado_historial)
    ? data.estado_historial
    : []
  const historialOrdenado = historial
    .slice()
    .sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt))

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
            <div className='fw-bold mb-1'>Asignado a</div>
            <div className='text-muted'>{asignadoLabel}</div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Categoría</div>
            <div className='text-muted'>{categoria}</div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Prioridad</div>
            <div className='text-muted'>{prioridad}</div>
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
                  const estName = estadosMap?.[h.estado_id]?.name || h.estado_id
                  return (
                    <div
                      key={`${h.estado_id}-${h.changedAt}-${idx}`}
                      className='py-2 border-bottom'
                    >
                      <div className='d-flex flex-wrap gap-2 align-items-center'>
                        <span className={badgeClass(estName)}>{estName}</span>
                        <span className='text-muted'>
                          <b>Fecha:</b> {fmtDate(h.changedAt)}
                        </span>
                        <span className='text-muted'>
                          <b>Por:</b> {h.changedBy || '—'}
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
        </div>
      </div>
    </div>
  )
}

const TablaCrearTicket = () => {
  const { token, user } = useContext(AuthContext)
  const id_personal = user?.personal?.id_personal

  const [rawRows, setRawRows] = useState([])
  const [maps, setMaps] = useState({
    estadosMap: {},
    prioridadesMap: {},
    categoriasMap: {},
    teamsMap: {},
    areasMap: {},
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [filtersApplied, setFiltersApplied] = useState({})
  const [showFilters, setShowFilters] = useState(false)

  const [openCrear, setOpenCrear] = useState(false)
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

      const bundle = await fetchMisCreacionesBundle(
        { id_personal, page: 1, limit: 100 },
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
        }
      )
    } catch (e) {
      console.error(e)
      setError('No se pudo cargar Mis Creaciones.')
      setRawRows([])
    } finally {
      setLoading(false)
    }
  }, [token, id_personal])

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
            .includes(q)
      )
    }

    return data
  }, [rawRows, filtersApplied])

  const columns = useMemo(() => {
    return [
      {
        name: 'Org',
        selector: r => r.orgId,
        sortable: true,
        width: '115px',
        cell: r => <OrgBadge orgId={r.orgId} />,
      },
      { name: 'Code', selector: r => r.code, sortable: true, width: '95px' },
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
              maxWidth: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {r.titulo || '—'}
          </span>
        ),
      },
      { name: 'Tipo', selector: r => r.tipo, sortable: true, width: '105px' },
      {
        name: 'Estado',
        selector: r => getEstadoNombreDesdeHistorial(r, maps?.estadosMap),
        sortable: true,
        width: '120px',
        cell: r => {
          const est = getEstadoNombreDesdeHistorial(r, maps?.estadosMap)
          return <span className={badgeClass(est)}>{est}</span>
        },
      },
      {
        name: 'Pri.',
        selector: r => maps?.prioridadesMap?.[r?.prioridad_id]?.name || '—',
        sortable: true,
        width: '90px',
      },
      {
        name: 'Cat.',
        selector: r => maps?.categoriasMap?.[r?.categoria_id]?.name || '—',
        sortable: true,
        width: '110px',
        cell: r => {
          const c = maps?.categoriasMap?.[r?.categoria_id]?.name || '—'
          return (
            <span
              title={c}
              style={{
                display: 'inline-block',
                maxWidth: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {c}
            </span>
          )
        },
      },
      {
        name: 'Creado',
        selector: r => r.createdAt,
        sortable: true,
        width: '135px',
        cell: r => <span className='text-muted'>{fmtDate(r.createdAt)}</span>,
      },
      {
        name: 'Act.',
        selector: r => r.updatedAt,
        sortable: true,
        width: '135px',
        cell: r => <span className='text-muted'>{fmtDate(r.updatedAt)}</span>,
      },
    ]
  }, [maps])

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
          <strong>Mis Creaciones</strong>
          <div className='text-muted small'>
            Lista de tickets creados por ti con detalle desplegable.
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

          <div className='ms-auto'>
            <button
              className='btn btn-sm btn-primary'
              onClick={() => setOpenCrear(true)}
            >
              Crear ticket
            </button>
          </div>
        </div>

        {showFilters && (
          <div className='mb-2'>
            <Filtros
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
            />
          )}
          noDataComponent={
            <div className='text-muted small py-3'>Sin datos.</div>
          }
        />
      </div>

      {/* ✅ MODAL CREAR */}
      <AntdModal
        open={openCrear}
        title='Crear ticket'
        onCancel={() => setOpenCrear(false)}
        footer={null}
        centered
        width={980}
        destroyOnClose
      >
        <CrearTicketWizard
          token={token}
          onClose={async () => {
            setOpenCrear(false)
            await load()
          }}
        />
      </AntdModal>

      {/* MODAL ACTUALIZAR */}
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

export default TablaCrearTicket
