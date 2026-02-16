import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import AuthContext from '../../../context/AuthContext'
import FiltrosMisTareas from './FiltrosMisTareas.jsx'

import ExpandedTicket from './MisTareas.expanded.jsx'
import { ModalAdjuntos, ModalHistorial } from './MisTareas.modals.jsx'
import { useMisTareasBundle } from './MisTareas.hook.js'
import { useMisTareasColumns } from './MisTareas.columns.jsx'

import {
  fmtDate,
  getTicketIdFromQuery,
  getUltimoHist,
  isTicketCerrado,
  oidToString,
  resolveEstadoItem,
} from './MisTareas.utils.js'

const tableStyles = {
  table: { style: { width: '93%' } },
  headRow: { style: { minHeight: '34px' } },
  headCells: {
    style: {
      fontWeight: 700,
      fontSize: '12px',
      paddingTop: '6px',
      paddingBottom: '6px',
      paddingLeft: '8px',
      paddingRight: '8px',
      whiteSpace: 'nowrap',
    },
  },
  rows: { style: { minHeight: '38px' } },
  cells: {
    style: {
      fontSize: '12px',
      paddingTop: '6px',
      paddingBottom: '6px',
      paddingLeft: '8px',
      paddingRight: '8px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  },
}

const MisTareas = () => {
  const { token, user } = useContext(AuthContext)
  const id_personal = user?.personal?.id_personal

  const [filtersApplied, setFiltersApplied] = useState({})
  const [showFilters, setShowFilters] = useState(false)

  const [verCerradas, setVerCerradas] = useState(false)

  const [openActualizar, setOpenActualizar] = useState(false)
  const [ticketActualizar, setTicketActualizar] = useState(null)
  const [expandedTicketId, setExpandedTicketId] = useState(null)

  const [openAdjuntos, setOpenAdjuntos] = useState(false)
  const [ticketAdjuntos, setTicketAdjuntos] = useState(null)
  const [adjuntosModalTitle, setAdjuntosModalTitle] = useState('Adjuntos')

  const empresas = useMemo(
    () => [
      { orgId: 'FastwaySAS', name: 'FastwaySAS' },
      { orgId: 'GreemWay', name: 'GreemWay' },
      { orgId: 'MetalHarvest', name: 'MetalHarvest' },
    ],
    []
  )

  const { rawRows, maps, loading, error, load } = useMisTareasBundle({
    token,
    id_personal,
    orgId: filtersApplied?.orgId || '',
  })

  const markTicketNotificationsRead = useCallback(
    async ticketId => {
      const tid = String(ticketId || '').trim()
      if (!tid || !token || !id_personal) return

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
            id_personal: String(id_personal),
            ticketId: tid,
          }),
        })
      } catch (e) {
        console.warn('No se pudo marcar notificación como leída:', e)
      }
    },
    [token, id_personal]
  )

  const rows = useMemo(() => {
    let data = [...rawRows]
    const f = filtersApplied || {}
    const estadosMap = maps?.estadosMap || {}

    data = data.filter(t => t?.activo !== false)

    const pid = String(id_personal || '').trim()
    if (pid) {
      data = data.filter(t => {
        const creador = String(t?.creado_por || t?.createdBy || '').trim()
        return creador !== pid
      })
    }

    // ✅ ocultar cerradas por defecto / solo cerradas si toggle
    data = data.filter(t => {
      const cerrado = isTicketCerrado(t, estadosMap)
      return verCerradas ? cerrado : !cerrado
    })

    if (f.orgId)
      data = data.filter(t => String(t.orgId || '') === String(f.orgId))
    if (f.tipo) data = data.filter(t => String(t.tipo || '') === String(f.tipo))

    if (f.activo === 'true') data = data.filter(t => t.activo === true)
    if (f.activo === 'false') data = data.filter(t => t.activo === false)

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
  }, [rawRows, filtersApplied, id_personal, maps, verCerradas])

  useEffect(() => {
    const tid = getTicketIdFromQuery()
    if (!tid) return
    if (!rows?.length) return

    const exists = rows.some(r => oidToString(r?._id) === tid)
    if (!exists) return

    setExpandedTicketId(tid)
    markTicketNotificationsRead(tid)
  }, [rows, markTicketNotificationsRead])

  const columns = useMisTareasColumns(maps)

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

  const adjuntosModal = Array.isArray(ticketAdjuntos?.adjuntos)
    ? ticketAdjuntos.adjuntos
    : []
  const personalMap = maps?.personalMap || {}

  return (
    <div className='card'>
      <div className='card-header d-flex align-items-end'>
        <div className='me-auto'>
          <strong>Mis Tickets Asignados</strong>
          <div className='text-muted small'>
            Tickets que requieren tu atención
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

          <div className='form-check form-switch ms-2'>
            <input
              className='form-check-input'
              type='checkbox'
              id='verCerradas'
              checked={verCerradas}
              onChange={e => setVerCerradas(e.target.checked)}
            />
            <label className='form-check-label' htmlFor='verCerradas'>
              Ver cerradas
            </label>
          </div>
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

        {/* ✅ ya no forzamos scroll por minWidth */}
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
          customStyles={tableStyles}
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
            <ExpandedTicket
              {...props}
              maps={maps}
              onOpenAdjuntos={onOpenAdjuntos}
              onOpenUpdate={onOpenUpdate}
              onOpenChat={onOpenChat}
              onOpenAdjuntosEvento={onOpenAdjuntosEvento}
            />
          )}
          noDataComponent={
            <div className='text-muted small py-3'>Sin datos.</div>
          }
        />
      </div>

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

export default MisTareas
