import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { DatePicker, Modal as AntdModal } from 'antd'
import dayjs from 'dayjs'
import AuthContext from '../../../context/AuthContext'

import {
  deactivateTicket,
  fetchSeguimientoBundle,
  listarPersonal,
} from './service.seguimiento'

import SeguimientoFiltros from './Seguimiento.filtros.jsx'
import ExpandedComponent from './Seguimiento.expanded.jsx'
import { buildColumns, tableStyles } from './Seguimiento.columns.jsx'
import {
  fmtDate,
  getTicketIdFromQuery,
  getUltimoHist,
  isTicketCerrado,
  oidToString,
  resolveEstadoItem,
} from './Seguimiento.utils.js'

import {
  ModalAdjuntos,
  ModalCrear,
  ModalEditar,
  ModalHistorial,
} from './Seguimiento.modals.jsx'

const tableStyles93 = {
  ...tableStyles,
  table: { style: { width: '93%' } },
}

const { RangePicker } = DatePicker

const toDayRange = (date = new Date()) => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

const toWeekRange = (date = new Date()) => {
  const d = new Date(date)
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  const start = new Date(d)
  start.setDate(d.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start: start.toISOString(), end: end.toISOString() }
}

const toMonthRange = (date = new Date()) => {
  const d = new Date(date)

  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  start.setHours(0, 0, 0, 0)

  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  end.setHours(23, 59, 59, 999)

  return { start: start.toISOString(), end: end.toISOString() }
}

const toStartOfDayIso = d => {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

const toEndOfDayIso = d => {
  const date = new Date(d)
  date.setHours(23, 59, 59, 999)
  return date.toISOString()
}

const SeguimientoTickets = () => {
  const { token, user } = useContext(AuthContext)
  const idPersonalLogueado = user?.personal?.id_personal
  const dayRange = useMemo(() => toDayRange(new Date()), [])

  const [idPersonalConsulta, setIdPersonalConsulta] = useState('')
  const [createdAtDesde, setCreatedAtDesde] = useState(dayRange.start)
  const [createdAtHasta, setCreatedAtHasta] = useState(dayRange.end)
  const [dateRange, setDateRange] = useState([
    dayjs(dayRange.start),
    dayjs(dayRange.end),
  ])

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
  const [verCerradas, setVerCerradas] = useState(false)

  const [openActualizar, setOpenActualizar] = useState(false)
  const [ticketActualizar, setTicketActualizar] = useState(null)
  const [expandedTicketId, setExpandedTicketId] = useState(null)

  const [openAdjuntos, setOpenAdjuntos] = useState(false)
  const [ticketAdjuntos, setTicketAdjuntos] = useState(null)
  const [adjuntosModalTitle, setAdjuntosModalTitle] = useState('Adjuntos')

  const [openEditar, setOpenEditar] = useState(false)
  const [ticketEditar, setTicketEditar] = useState(null)

  const [openCrear, setOpenCrear] = useState(false)
  const [personalOptions, setPersonalOptions] = useState([])

  const empresas = useMemo(
    () => [
      { orgId: 'FastwaySAS', name: 'FastwaySAS' },
      { orgId: 'GreemWay', name: 'GreemWay' },
      { orgId: 'MetalHarvest', name: 'MetalHarvest' },
    ],
    []
  )

  useEffect(() => {
    const loadPersonal = async () => {
      if (!token) return
      try {
        const data = await listarPersonal(token)
        const rows = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : []
        const opts = rows
          .filter(p => p?.Id_personal)
          .map(p => {
            const nombre = String(p?.Nombre || '').trim()
            const apellido = String(p?.Apellido || '').trim()
            const full = [nombre, apellido].filter(Boolean).join(' ').trim()
            return {
              value: String(p.Id_personal),
              label: full
                ? `${p.Id_personal} - ${full}`
                : String(p.Id_personal),
            }
          })
        setPersonalOptions(opts)
      } catch {
        setPersonalOptions([])
      }
    }
    loadPersonal()
  }, [token])

  const load = useCallback(async () => {
    if (!token) return

    const pid = String(idPersonalConsulta || '').trim()
    if (!pid) {
      setError('Debes enviar un id_personal para consultar seguimiento.')
      setRawRows([])
      return
    }

    if (!createdAtDesde || !createdAtHasta) {
      setError('Debes seleccionar createdAt_desde y createdAt_hasta.')
      setRawRows([])
      return
    }

    const desdeIso = createdAtDesde
    const hastaIso = createdAtHasta

    try {
      setLoading(true)
      setError(null)

      const bundle = await fetchSeguimientoBundle(
        {
          id_personal: pid,
          page: 1,
          limit: 100,
          activo:
            filtersApplied?.activo === 'true'
              ? true
              : filtersApplied?.activo === 'false'
                ? false
                : true,
          createdAt_desde: desdeIso,
          createdAt_hasta: hastaIso,
          sortBy: 'lastMoveAt',
          sortDir: 'desc',
          orgId: filtersApplied?.orgId || '',
          tipo: filtersApplied?.tipo || '',
          estado_id: filtersApplied?.estado_id || '',
          prioridad_id: filtersApplied?.prioridad_id || '',
          categoria_id: filtersApplied?.categoria_id || '',
          search: filtersApplied?.search || '',
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
      setError('No se pudo cargar Seguimiento de tickets.')
      setRawRows([])
    } finally {
      setLoading(false)
    }
  }, [
    token,
    idPersonalConsulta,
    createdAtDesde,
    createdAtHasta,
    filtersApplied,
  ])

  const markTicketNotificationsRead = useCallback(
    async ticketId => {
      const tid = String(ticketId || '').trim()
      const pid = String(idPersonalConsulta || '').trim()
      if (!tid || !token || !pid) return

      try {
        const base = String(import.meta.env.VITE_API_URL_5 || '').replace(
          /\/+$/,
          ''
        )

        await fetch(`${base}/notifications/read-by-ticket`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id_personal: pid,
            ticketId: tid,
          }),
        })
      } catch (e) {
        console.warn('No se pudo marcar notificación como leída:', e)
      }
    },
    [token, idPersonalConsulta]
  )

  const rows = useMemo(() => {
    let data = [...rawRows]
    const f = filtersApplied || {}
    const estadosMap = maps?.estadosMap || {}
    const selectedPid = String(idPersonalConsulta || '').trim()

    data = data.filter(t => t?.activo !== false)

    if (selectedPid) {
      data = data.filter(t => {
        const creador = String(t?.creado_por || t?.createdBy || '').trim()
        return creador !== selectedPid
      })
    }

    data = data.filter(t => {
      const cerrado = isTicketCerrado(t, estadosMap)
      return verCerradas ? cerrado : !cerrado
    })

    if (f.orgId)
      data = data.filter(t => String(t.orgId || '') === String(f.orgId))
    if (f.tipo) data = data.filter(t => String(t.tipo || '') === String(f.tipo))

    if (f.prioridad_id)
      data = data.filter(
        t => oidToString(t.prioridad_id) === String(f.prioridad_id)
      )
    if (f.categoria_id)
      data = data.filter(
        t => oidToString(t.categoria_id) === String(f.categoria_id)
      )

    if (f.estado_id) {
      data = data.filter(
        t =>
          oidToString(getUltimoHist(t)?.estado_id || '') === String(f.estado_id)
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
  }, [rawRows, filtersApplied, maps, verCerradas, idPersonalConsulta])

  useEffect(() => {
    const tid = getTicketIdFromQuery()
    if (!tid) return
    if (!rows?.length) return

    const exists = rows.some(r => oidToString(r?._id) === tid)
    if (!exists) return

    setExpandedTicketId(tid)
    markTicketNotificationsRead(tid)
  }, [rows, markTicketNotificationsRead])

  const columns = useMemo(() => buildColumns({ maps }), [maps])

  const onOpenUpdate = ticket => {
    setTicketActualizar(ticket)
    setOpenActualizar(true)
  }

  const onOpenChat = () => {}

  const onOpenAdjuntos = ticket => {
    setTicketAdjuntos(ticket)
    setAdjuntosModalTitle(`Adjuntos ${ticket?.code ? `- ${ticket.code}` : ''}`)
    setOpenAdjuntos(true)
  }

  const onOpenAdjuntosEvento = ({ ticket, evento, adjuntos }) => {
    const when = fmtDate(evento?.changedAt)
    const name = resolveEstadoItem(evento?.estado_id, maps?.estadosMap || {})
    const estadoLabel =
      name?.name || name?.name_norm || name?.nombre || name?.nombre_norm || '—'

    setTicketAdjuntos({
      code: ticket?.code || '',
      adjuntos: Array.isArray(adjuntos) ? adjuntos : [],
    })
    setAdjuntosModalTitle(
      `Adjuntos del cambio ${
        ticket?.code ? `- ${ticket.code}` : ''
      } (${estadoLabel} · ${when})`
    )
    setOpenAdjuntos(true)
  }

  const onApplyFilters = f => {
    setFiltersApplied(f || {})
    setShowFilters(false)
  }

  const onOpenEditar = ticket => {
    setTicketEditar(ticket)
    setOpenEditar(true)
  }

  const confirmarEliminar = ticket => {
    if (!ticket?._id) return
    if (!idPersonalLogueado) {
      setError(
        'No hay id_personal del usuario logueado para auditar la acción.'
      )
      return
    }

    AntdModal.confirm({
      centered: true,
      title: 'Confirmar eliminación',
      content: (
        <div>
          ¿Seguro que deseas <b>eliminar (desactivar)</b> este ticket?
          <div className='text-muted' style={{ marginTop: 6 }}>
            {ticket?.code ? `Código: ${ticket.code}` : ''}{' '}
            {ticket?.titulo ? `· ${ticket.titulo}` : ''}
          </div>
        </div>
      ),
      okText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deactivateTicket(
            ticket._id,
            { id_personal: idPersonalLogueado },
            token
          )
          await load()
        } catch (e) {
          console.error(e)
          setError('No se pudo eliminar (desactivar) el ticket.')
        }
      },
    })
  }

  const adjuntosModal = Array.isArray(ticketAdjuntos?.adjuntos)
    ? ticketAdjuntos.adjuntos
    : []
  const personalMap = maps?.personalMap || {}

  return (
    <div className='card'>
      <div className='card-header d-flex align-items-end'>
        <div className='me-auto'>
          <strong>Seguimiento</strong>
          <div className='text-muted small'>
            Consulta tickets asignados por id_personal y rango de fechas.
          </div>
        </div>

        <button
          className='btn btn-sm btn-primary'
          onClick={() => setOpenCrear(true)}
          disabled={!token || !idPersonalLogueado}
          title={
            !token || !idPersonalLogueado
              ? 'Falta sesión/ID personal'
              : 'Crear ticket'
          }
        >
          Crear ticket
        </button>
      </div>

      <div className='card-body'>
        {error && <div className='alert alert-danger py-2 mb-3'>{error}</div>}

        <div className='row g-2 align-items-end mb-3'>
          <div className='col-12 col-md-3'>
            <label className='form-label mb-1'>ID personal</label>
            <select
              className='form-select form-select-sm'
              value={idPersonalConsulta}
              onChange={e => setIdPersonalConsulta(e.target.value)}
            >
              <option value=''>Selecciona personal…</option>
              {personalOptions.map(op => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          <div className='col-12 col-md-3'>
            <label className='form-label mb-1'>Rango de fechas</label>
            <RangePicker
              className='w-100'
              value={dateRange}
              format='YYYY-MM-DD'
              onChange={values => {
                if (
                  !values ||
                  values.length !== 2 ||
                  !values[0] ||
                  !values[1]
                ) {
                  setDateRange([])
                  setCreatedAtDesde('')
                  setCreatedAtHasta('')
                  return
                }
                setDateRange(values)
                setCreatedAtDesde(toStartOfDayIso(values[0].toDate()))
                setCreatedAtHasta(toEndOfDayIso(values[1].toDate()))
              }}
            />
          </div>

          <div className='col-12 col-md-6 d-flex flex-wrap gap-2'>
            <button
              className='btn btn-sm btn-primary'
              onClick={load}
              disabled={loading || !token}
            >
              Consultar
            </button>
            <button
              className='btn btn-sm btn-outline-secondary'
              onClick={() => {
                const dr = toDayRange(new Date())
                setDateRange([dayjs(dr.start), dayjs(dr.end)])
                setCreatedAtDesde(dr.start)
                setCreatedAtHasta(dr.end)
              }}
            >
              Hoy
            </button>

            <button
              className='btn btn-sm btn-outline-secondary'
              onClick={() => {
                const wr = toWeekRange(new Date())
                setDateRange([dayjs(wr.start), dayjs(wr.end)])
                setCreatedAtDesde(wr.start)
                setCreatedAtHasta(wr.end)
              }}
            >
              Esta semana
            </button>

            <button
              className='btn btn-sm btn-outline-secondary'
              onClick={() => {
                const mr = toMonthRange(new Date())
                setDateRange([dayjs(mr.start), dayjs(mr.end)])
                setCreatedAtDesde(mr.start)
                setCreatedAtHasta(mr.end)
              }}
            >
              Este mes
            </button>
          </div>
        </div>

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
            disabled={loading || !token}
          >
            Refrescar
          </button>

          <div className='form-check form-switch ms-2'>
            <input
              className='form-check-input'
              type='checkbox'
              id='verCerradasSeguimiento'
              checked={verCerradas}
              onChange={e => setVerCerradas(e.target.checked)}
            />
            <label
              className='form-check-label'
              htmlFor='verCerradasSeguimiento'
            >
              Ver cerradas
            </label>
          </div>
        </div>

        {showFilters && (
          <div className='mb-2'>
            <SeguimientoFiltros
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
          paginationRowsPerPageOptions={[10, 20, 30, 40, 50, 100]}
          highlightOnHover
          dense
          responsive
          customStyles={tableStyles93}
          persistTableHead
          defaultSortFieldId={1}
          defaultSortAsc={false}
          conditionalRowStyles={[
            {
              when: row => isTicketCerrado(row, maps?.estadosMap || {}),
              style: { backgroundColor: '#f6f6f3', color: '#6b7280' },
            },
          ]}
          expandableRows
          expandableRowExpanded={row =>
            oidToString(row?._id) === expandedTicketId
          }
          onRowExpandToggled={(expanded, row) => {
            const tid = oidToString(row?._id)
            setExpandedTicketId(expanded ? tid : null)
            if (expanded) markTicketNotificationsRead(tid)
          }}
          expandableRowsComponent={props => (
            <ExpandedComponent
              {...props}
              maps={maps}
              onOpenAdjuntos={onOpenAdjuntos}
              onOpenUpdate={onOpenUpdate}
              onOpenChat={onOpenChat}
              onOpenAdjuntosEvento={onOpenAdjuntosEvento}
              onOpenEditar={onOpenEditar}
              onEliminar={confirmarEliminar}
              canEditDelete={true}
            />
          )}
          noDataComponent={
            <div className='text-muted small py-3'>Sin datos.</div>
          }
        />
      </div>

      <ModalCrear
        open={openCrear}
        onClose={() => setOpenCrear(false)}
        onDone={() => load()}
      />

      <ModalHistorial
        open={openActualizar}
        onClose={() => setOpenActualizar(false)}
        ticket={ticketActualizar}
        maps={maps}
        onSuccess={() => {
          setOpenActualizar(false)
          load()
        }}
      />

      <ModalEditar
        open={openEditar}
        onClose={() => setOpenEditar(false)}
        ticket={ticketEditar}
        token={token}
        id_personal={idPersonalLogueado}
        onSaved={() => {
          setOpenEditar(false)
          load()
        }}
      />

      <ModalAdjuntos
        open={openAdjuntos}
        onClose={() => setOpenAdjuntos(false)}
        title={adjuntosModalTitle}
        adjuntos={adjuntosModal}
        personalMap={personalMap}
      />
    </div>
  )
}

export default SeguimientoTickets
