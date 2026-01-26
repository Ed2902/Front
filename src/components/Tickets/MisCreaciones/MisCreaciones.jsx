import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { Modal as AntdModal } from 'antd'
import AuthContext from '../../../context/AuthContext'

import {
  fetchMisCreacionesBundle,
  putTicket,
  deactivateTicket,
} from './service.MisCreaciones'

import CrearTicketWizard from '../CrearTicket/CrearTicketWizard.jsx'

import FiltrosMisTareas from '../MisTareas/FiltrosMisTareas.jsx'
import SecureArchivotikects from '../SecureArchivotikects.jsx'
import AgregarHistorialTicket from '../historial/AgregarHistorialTicket.jsx'

const fmtDate = iso => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CO', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const anyDateToIso = v => {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v.$date) return String(v.$date)
  if (typeof v === 'object' && v.date) return anyDateToIso(v.date)
  return String(v)
}

// ✅ FIX: ObjectId helper
const oidToString = v => {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v.$oid) return String(v.$oid)
  if (typeof v === 'object' && v._id) return oidToString(v._id)
  return String(v)
}

const getTicketIdFromQuery = () => {
  try {
    const sp = new URLSearchParams(window.location.search)
    const tid = sp.get('ticketId')
    return tid ? String(tid).trim() : ''
  } catch {
    return ''
  }
}

const getUltimoHist = ticket => {
  const h = Array.isArray(ticket?.estado_historial)
    ? ticket.estado_historial
    : []
  if (!h.length) return null
  return h
    .slice()
    .sort(
      (a, b) =>
        new Date(anyDateToIso(a.changedAt)) -
        new Date(anyDateToIso(b.changedAt))
    )
    .at(-1)
}

const norm = s =>
  String(s || '')
    .trim()
    .toLowerCase()

const buildClosedEstadoIds = estadosMap => {
  const ids = new Set()
  for (const it of Object.values(estadosMap || {})) {
    const n = norm(it?.name_norm || it?.name || it?.nombre_norm || it?.nombre)
    if (n === 'cerrado') ids.add(String(it._id))
  }
  return ids
}

const isTicketCerrado = (ticket, estadosMap) => {
  const closedIds = buildClosedEstadoIds(estadosMap)
  if (!closedIds.size) return false

  const currentId = oidToString(ticket?.estado_id)
  if (currentId && closedIds.has(currentId)) return true

  const last = getUltimoHist(ticket)
  const lastId = oidToString(last?.estado_id)
  return !!(lastId && closedIds.has(lastId))
}

const getCierreEvento = (ticket, estadosMap) => {
  const closedIds = buildClosedEstadoIds(estadosMap)
  if (!closedIds.size) return null

  const hist = Array.isArray(ticket?.estado_historial)
    ? ticket.estado_historial
    : []
  if (!hist.length) return null

  const cerradoEvents = hist
    .filter(h => closedIds.has(oidToString(h?.estado_id)))
    .slice()
    .sort(
      (a, b) =>
        new Date(anyDateToIso(a.changedAt)) -
        new Date(anyDateToIso(b.changedAt))
    )

  return cerradoEvents.at(-1) || null
}

const diffDaysCeil = (a, b) => {
  const ms = a.getTime() - b.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

const computeCumplimientoUI = (ticket, estadosMap) => {
  const cierreEv = getCierreEvento(ticket, estadosMap)
  const cierreAt = cierreEv?.changedAt
    ? new Date(anyDateToIso(cierreEv.changedAt))
    : null
  const est = ticket?.fecha_estimada
    ? new Date(anyDateToIso(ticket.fecha_estimada))
    : null

  const cerrado = isTicketCerrado(ticket, estadosMap)
  const raw = String(ticket?.cumplimiento || '').trim() || '—'

  if (!cerrado) {
    return {
      cerrado: false,
      raw,
      cierreAt: null,
      retrasoDias: null,
      label: raw,
    }
  }

  if (
    cierreAt &&
    est &&
    !Number.isNaN(cierreAt.getTime()) &&
    !Number.isNaN(est.getTime())
  ) {
    const retraso = Math.max(0, diffDaysCeil(cierreAt, est))
    const label = retraso === 0 ? 'cumplido' : `incumplido (+${retraso} días)`
    return { cerrado: true, raw, cierreAt, retrasoDias: retraso, label }
  }

  return {
    cerrado: true,
    raw,
    cierreAt: cierreAt && !Number.isNaN(cierreAt.getTime()) ? cierreAt : null,
    retrasoDias: null,
    label: raw,
  }
}

const tableStyles = {
  table: { style: { width: '100%' } },
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

const Ell = ({ children, title, maxWidth = '100%' }) => (
  <span
    title={title}
    style={{
      display: 'inline-block',
      maxWidth,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      verticalAlign: 'middle',
    }}
  >
    {children}
  </span>
)

// ---------- color utils ----------
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

const CatalogBadge = ({ item, fallback = '—', maxW = 110 }) => {
  const label =
    item?.name ||
    item?.name_norm ||
    item?.nombre ||
    item?.nombre_norm ||
    fallback

  const bg = normalizeHex(item?.color)
  const style = bg
    ? {
        background: bg,
        color: getContrastingTextColor(bg),
        border: '1px solid rgba(0,0,0,.15)',
      }
    : {}

  return (
    <span
      className={bg ? 'badge' : 'badge bg-light text-dark'}
      title={label}
      style={{
        ...style,
        borderRadius: 10,
        padding: '0.20rem 0.45rem',
        fontWeight: 800,
        fontSize: 12,
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: maxW,
      }}
    >
      <Ell title={label} maxWidth={Math.max(40, maxW - 18)}>
        {label}
      </Ell>
    </span>
  )
}

const orgBadgeStyle = orgId => {
  const org = String(orgId || '')
    .trim()
    .toLowerCase()

  if (org === 'fastwaysas')
    return {
      background: '#FFE3C2',
      color: '#7A3E00',
      border: '1px solid #FFD2A3',
    }

  if (org === 'greemway' || org === 'greenway')
    return {
      background: '#CFF7F3',
      color: '#075B57',
      border: '1px solid #AEEDE6',
    }

  if (org === 'metalharvest')
    return {
      background: '#DFF5D8',
      color: '#1F5A1A',
      border: '1px solid #C9EDBF',
    }

  return { background: '#EFEFEF', color: '#333', border: '1px solid #E2E2E2' }
}

const OrgBadge = ({ orgId, maxW = 110 }) => (
  <span
    className='badge'
    style={{
      ...orgBadgeStyle(orgId),
      fontWeight: 800,
      borderRadius: 10,
      padding: '0.20rem 0.45rem',
      fontSize: 12,
      display: 'inline-flex',
      alignItems: 'center',
      maxWidth: maxW,
    }}
    title={orgId || '—'}
  >
    <Ell title={orgId || '—'} maxWidth={Math.max(40, maxW - 18)}>
      {orgId || '—'}
    </Ell>
  </span>
)

const getAsignacionScope = ticket => {
  const a = ticket?.asignado_a
  if (!a?.tipo)
    return { label: '—', key: 'none', cls: 'badge bg-light text-dark' }

  if (a.tipo === 'personal')
    return { label: 'Personal', key: 'personal', cls: 'badge bg-primary' }
  if (a.tipo === 'team')
    return { label: 'Team', key: 'team', cls: 'badge bg-success' }
  if (a.tipo === 'area')
    return { label: 'Área', key: 'area', cls: 'badge bg-info text-dark' }

  return { label: '—', key: 'none', cls: 'badge bg-light text-dark' }
}

const getPersonaInfo = (id_personal, personalMap) => {
  const key = String(id_personal ?? '').trim()
  if (!key) return null
  return personalMap?.[key] || null
}

const personaLabel = (id, personalMap) => {
  const p = getPersonaInfo(id, personalMap)
  if (!p) return { title: String(id), raw: String(id) }

  const nombre = String(p?.Nombre || '').trim()
  const apellido = String(p?.Apellido || '').trim()
  const full = [nombre, apellido].filter(Boolean).join(' ').trim() || String(id)

  return { title: full, raw: String(p?.Id_personal ?? id) }
}

const resolveEstadoItem = (estado_id, estadosMap) => {
  const id = oidToString(estado_id)
  if (!id) return null
  return estadosMap?.[id] || null
}

const getEstadoItemDesdeHistorial = (ticket, estadosMap) => {
  const last = getUltimoHist(ticket)
  const item = resolveEstadoItem(last?.estado_id, estadosMap)
  if (item) return item
  const id = oidToString(last?.estado_id)
  if (!id) return null
  return { _id: id, name: '—' }
}

const changedByLabel = (changedBy, personalMap) => {
  const v = String(changedBy ?? '').trim()
  if (!v) return '—'
  const p = getPersonaInfo(v, personalMap)
  if (!p) return v
  const full = [
    String(p?.Nombre || '').trim(),
    String(p?.Apellido || '').trim(),
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
  return full || v
}

const TICKETS_API = import.meta.env.VITE_API_URL_5 || ''
const ticketsOrigin = (base => {
  if (!base) return ''
  let b = String(base).replace(/\/+$/, '')
  b = b.replace(/\/tikets$/i, '')
  return b
})(TICKETS_API)

const toTicketAbsolute = relOrAbs => {
  if (!relOrAbs) return ''
  const s = String(relOrAbs).trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (!ticketsOrigin) return s
  return `${ticketsOrigin}${s.startsWith('/') ? '' : '/'}${s}`
}

const hashString = str => {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}
const textColorForUser = changedBy => {
  const k = String(changedBy || '').trim() || '—'
  const hue = hashString(k) % 360
  return `hsl(${hue} 45% 35%)`
}

const AsigBadge = ({ ticket }) => {
  const s = getAsignacionScope(ticket)
  return (
    <div className='w-100 d-flex justify-content-center'>
      <span
        className={s.cls}
        style={{
          fontSize: 12,
          fontWeight: 900,
          borderRadius: 10,
          padding: '0.20rem 0.45rem',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        {s.label}
      </span>
    </div>
  )
}

const CreatorName = ({ ticket, maps }) => {
  const personalMap = maps?.personalMap || {}
  const creadorId = ticket?.creado_por
  if (!creadorId) return <span className='text-muted'>—</span>
  const info = personaLabel(creadorId, personalMap)
  return (
    <div
      className='w-100 d-flex justify-content-center'
      style={{ minWidth: 0 }}
    >
      <div
        className='d-flex flex-column align-items-center'
        style={{ minWidth: 0, textAlign: 'center' }}
        title={info.raw}
      >
        <Ell title={info.title} maxWidth={160}>
          <span className='fw-semibold'>{info.title}</span>
        </Ell>
      </div>
    </div>
  )
}

const resolveAsignadoNombre = (asignado, maps) => {
  const tipo = asignado?.tipo
  const id = asignado?.id
  if (!tipo || !id) return '—'
  if (tipo === 'team') {
    const t = maps?.teamsMap?.[String(id)] || null
    return t?.nombre_norm || t?.nombre || String(id)
  }
  if (tipo === 'area') {
    const a = maps?.areasMap?.[String(id)] || null
    return a?.nombre || a?.name || String(id)
  }
  return String(id)
}

// ✅ mini form de edición (simple y seguro con validator.put)
const EditarTicketForm = ({ ticket, token, id_personal, onSaved }) => {
  const [titulo, setTitulo] = useState(ticket?.titulo || '')
  const [descripcion, setDescripcion] = useState(ticket?.descripcion || '')
  const [fecha_estimada, setFechaEstimada] = useState(() => {
    const iso = anyDateToIso(ticket?.fecha_estimada)
    if (!iso) return ''
    return String(iso).slice(0, 10)
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const onSubmit = async e => {
    e.preventDefault()
    try {
      setSaving(true)
      setErr(null)

      const payload = {
        id_personal: String(id_personal),
        titulo,
        descripcion,
        fecha_estimada: fecha_estimada ? `${fecha_estimada}T00:00:00.000Z` : '',
      }

      await putTicket(ticket?._id, payload, token)
      onSaved?.()
    } catch (e2) {
      console.error(e2)
      setErr('No se pudo editar el ticket.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className='d-flex flex-column gap-2'>
      {err && <div className='alert alert-danger py-2 mb-1'>{err}</div>}

      <div>
        <label className='form-label fw-semibold'>Título</label>
        <input
          className='form-control'
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          required
        />
      </div>

      <div>
        <label className='form-label fw-semibold'>Descripción</label>
        <textarea
          className='form-control'
          rows={4}
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          required
        />
      </div>

      <div>
        <label className='form-label fw-semibold'>Fecha estimada</label>
        <input
          type='date'
          className='form-control'
          value={fecha_estimada}
          onChange={e => setFechaEstimada(e.target.value)}
        />
      </div>

      <div className='d-flex justify-content-end gap-2 mt-2'>
        <button className='btn btn-primary' type='submit' disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

const ExpandedComponent = ({
  data,
  maps,
  onOpenAdjuntos,
  onOpenUpdate,
  onOpenChat,
  onOpenAdjuntosEvento,
  onOpenEditar,
  onEliminar,
  canEditDelete,
}) => {
  const estadosMap = maps?.estadosMap || {}
  const cierreInfo = computeCumplimientoUI(data, estadosMap)

  // ✅ FIX: ids pueden venir como {$oid}
  const prioridadId = oidToString(data?.prioridad_id)
  const categoriaId = oidToString(data?.categoria_id)

  const prioridadItem = maps?.prioridadesMap?.[prioridadId] || null
  const categoriaItem = maps?.categoriasMap?.[categoriaId] || null
  const estadoItem = getEstadoItemDesdeHistorial(data, estadosMap)

  const asignado = data?.asignado_a || {}
  const personalMap = maps?.personalMap || {}

  const historial = Array.isArray(data?.estado_historial)
    ? data.estado_historial
    : []
  const historialOrdenado = historial
    .slice()
    .sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt))

  const adjuntosTicket = Array.isArray(data?.adjuntos) ? data.adjuntos : []
  const scope = getAsignacionScope(data)

  // ✅ NUEVO: operación visible
  const isOperacion = String(data?.tipo || '').toLowerCase() === 'operacion'
  const op = data?.operacion || {}
  const opCliente = String(op?.cliente || '').trim()
  const opLote = String(op?.lote || '').trim()
  const opProducto = String(op?.producto || '').trim()

  return (
    <div className='w-100 px-2 py-2'>
      <div className='border rounded bg-light p-3'>
        <div className='d-flex flex-wrap gap-2 justify-content-end mb-3'>
          <button
            type='button'
            className='btn btn-sm btn-outline-primary'
            onClick={() => onOpenChat?.(data)}
            disabled={cierreInfo.cerrado}
            title={
              cierreInfo.cerrado
                ? 'Ticket cerrado: chat deshabilitado'
                : 'Abrir chat'
            }
          >
            Abrir chat
          </button>

          <button
            type='button'
            className='btn btn-sm btn-outline-secondary'
            onClick={() => onOpenAdjuntos?.(data)}
            disabled={!adjuntosTicket.length}
            title={
              !adjuntosTicket.length
                ? 'Este ticket no tiene adjuntos'
                : 'Ver adjuntos'
            }
          >
            adjuntos {adjuntosTicket.length ? `(${adjuntosTicket.length})` : ''}
          </button>

          <button
            type='button'
            className='btn btn-sm btn-primary'
            onClick={() => onOpenUpdate?.(data)}
            disabled={cierreInfo.cerrado}
            title={
              cierreInfo.cerrado
                ? 'Ticket cerrado: no puedes agregar historial'
                : 'Agregar al historial'
            }
          >
            Agregar al historial
          </button>

          <button
            type='button'
            className='btn btn-sm btn-warning'
            onClick={() => onOpenEditar?.(data)}
            disabled={!canEditDelete || cierreInfo.cerrado}
            title={
              !canEditDelete
                ? 'Solo el creador puede editar'
                : cierreInfo.cerrado
                  ? 'Ticket cerrado: edición deshabilitada'
                  : 'Editar ticket'
            }
          >
            Editar
          </button>

          <button
            type='button'
            className='btn btn-sm btn-danger'
            onClick={() => onEliminar?.(data)}
            disabled={!canEditDelete || !data?.activo}
            title={
              !canEditDelete
                ? 'Solo el creador puede eliminar'
                : !data?.activo
                  ? 'Ya está desactivado'
                  : 'Eliminar (desactivar)'
            }
          >
            Eliminar
          </button>
        </div>

        <div className='row g-3'>
          <div className='col-12 col-md-6'>
            <div className='fw-bold mb-1'>Descripción</div>
            <div className='text-muted'>{data?.descripcion || '—'}</div>
          </div>

          <div className='col-12 col-md-6'>
            <div className='fw-bold mb-1'>Asignación</div>
            <div className='d-flex align-items-start gap-2 flex-wrap'>
              <span
                className={scope.cls}
                style={{
                  fontWeight: 900,
                  borderRadius: 10,
                  padding: '0.20rem 0.45rem',
                }}
              >
                {scope.label}
              </span>

              {asignado?.tipo === 'personal' ? (
                <span className='text-muted'>
                  {personaLabel(asignado.id, personalMap).title}
                </span>
              ) : (
                <span className='text-muted'>
                  {resolveAsignadoNombre(asignado, maps)}
                </span>
              )}
            </div>
          </div>

          {/* ✅ Operación */}
          {isOperacion && (
            <div className='col-12'>
              <div className='fw-bold mb-1'>Operación</div>
              <div className='d-flex flex-wrap gap-2'>
                <span className='badge bg-white text-dark border'>
                  <b>Cliente:</b> {opCliente || '—'}
                </span>
                <span className='badge bg-white text-dark border'>
                  <b>Lote:</b> {opLote || '—'}
                </span>
                <span className='badge bg-white text-dark border'>
                  <b>Producto:</b> {opProducto || '—'}
                </span>
              </div>
            </div>
          )}

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Estado</div>
            <div className='text-muted'>
              <CatalogBadge item={estadoItem} fallback='—' maxW={160} />
            </div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Categoría</div>
            <div className='text-muted'>
              <CatalogBadge item={categoriaItem} fallback='—' maxW={160} />
            </div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Prioridad</div>
            <div className='text-muted'>
              <CatalogBadge item={prioridadItem} fallback='—' maxW={160} />
            </div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Org</div>
            <div className='text-muted'>
              <OrgBadge orgId={data?.orgId} maxW={160} />
            </div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Creado</div>
            <div className='text-muted'>{fmtDate(data?.createdAt)}</div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Actualizado</div>
            <div className='text-muted'>{fmtDate(data?.updatedAt)}</div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Fecha estimada</div>
            <div className='text-muted'>{fmtDate(data?.fecha_estimada)}</div>
          </div>

          <div className='col-6 col-md-3'>
            <div className='fw-bold mb-1'>Cumplimiento</div>
            <div className='text-muted'>
              {computeCumplimientoUI(data, estadosMap).label || '—'}
            </div>
          </div>

          <div className='col-12'>
            <div className='fw-bold mb-2'>Trazabilidad de estado</div>

            {historialOrdenado.length ? (
              <div className='border rounded bg-white p-2'>
                {historialOrdenado.map((h, idx) => {
                  const item =
                    resolveEstadoItem(h?.estado_id, estadosMap) || null
                  const adjuntosEvento = Array.isArray(h?.adjuntos)
                    ? h.adjuntos
                    : []

                  const byText = changedByLabel(h.changedBy, personalMap)
                  const byColor = textColorForUser(h.changedBy)

                  return (
                    <div
                      key={`${oidToString(h?.estado_id)}-${h.changedAt}-${idx}`}
                      className='py-2'
                      style={{
                        borderBottom:
                          idx === historialOrdenado.length - 1
                            ? 'none'
                            : '1px solid #eee',
                      }}
                    >
                      <div className='d-flex align-items-start justify-content-between gap-3 flex-wrap'>
                        <div
                          className='d-flex align-items-center gap-2'
                          style={{ minWidth: 0 }}
                        >
                          <CatalogBadge item={item} fallback='—' maxW={200} />
                        </div>

                        <div className='d-flex align-items-start gap-2 flex-wrap justify-content-end'>
                          {!!adjuntosEvento.length && (
                            <button
                              type='button'
                              className='btn btn-sm btn-outline-secondary'
                              onClick={() =>
                                onOpenAdjuntosEvento?.({
                                  ticket: data,
                                  evento: h,
                                  adjuntos: adjuntosEvento,
                                })
                              }
                              style={{ padding: '2px 8px' }}
                            >
                              📎({adjuntosEvento.length})
                            </button>
                          )}

                          <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
                            <div
                              className='text-muted'
                              style={{ fontSize: 12 }}
                            >
                              <span style={{ color: byColor }}>{byText}</span>
                            </div>
                            <div
                              className='text-muted'
                              style={{ fontSize: 12 }}
                            >
                              {fmtDate(h.changedAt)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className='mt-2' style={{ paddingLeft: 2 }}>
                        <div style={{ fontSize: 13, color: '#333' }}>
                          <b>Nota:</b> {h.nota?.trim() ? h.nota : '—'}
                        </div>
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

const MisCreaciones = () => {
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
  const [expandedTicketId, setExpandedTicketId] = useState(null)

  const [openAdjuntos, setOpenAdjuntos] = useState(false)
  const [ticketAdjuntos, setTicketAdjuntos] = useState(null)
  const [adjuntosModalTitle, setAdjuntosModalTitle] = useState('Adjuntos')

  const [openEditar, setOpenEditar] = useState(false)
  const [ticketEditar, setTicketEditar] = useState(null)

  // ✅ Modal crear (Wizard)
  const [openCrear, setOpenCrear] = useState(false)

  const empresas = useMemo(
    () => [
      { orgId: 'FastwaySAS', name: 'FastwaySAS' },
      { orgId: 'GreemWay', name: 'GreemWay' },
      { orgId: 'MetalHarvest', name: 'MetalHarvest' },
    ],
    []
  )

  const load = useCallback(async () => {
    if (!token || !id_personal) return
    try {
      setLoading(true)
      setError(null)

      const bundle = await fetchMisCreacionesBundle(
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
      setError('No se pudo cargar Mis Creaciones.')
      setRawRows([])
    } finally {
      setLoading(false)
    }
  }, [token, id_personal, filtersApplied?.orgId])

  useEffect(() => {
    load()
  }, [load])

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

    // ✅ NO mostrar activo=false
    data = data.filter(t => t?.activo !== false)

    // ✅ SOLO lo que yo creé
    const pid = String(id_personal || '').trim()
    if (pid) {
      data = data.filter(t => {
        const creador = String(t?.creado_por || t?.createdBy || '').trim()
        return creador === pid
      })
    }

    if (f.orgId)
      data = data.filter(t => String(t.orgId || '') === String(f.orgId))
    if (f.tipo) data = data.filter(t => String(t.tipo || '') === String(f.tipo))

    // ✅ FIX: filtros por catálogo soportan {$oid}
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
  }, [rawRows, filtersApplied, id_personal])

  useEffect(() => {
    const tid = getTicketIdFromQuery()
    if (!tid) return
    if (!rows?.length) return

    const exists = rows.some(r => oidToString(r?._id) === tid)
    if (!exists) return

    setExpandedTicketId(tid)
    markTicketNotificationsRead(tid)
  }, [rows, markTicketNotificationsRead])

  const columns = useMemo(() => {
    const ellipsis = (text, title) => (
      <span
        title={title || text}
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          verticalAlign: 'middle',
        }}
      >
        {text || '—'}
      </span>
    )

    return [
      {
        name: 'Code',
        selector: r => r.code,
        sortable: true,
        width: '76px',
        cell: r => ellipsis(r.code, r.code),
      },
      {
        name: 'Org',
        selector: r => r.orgId,
        sortable: true,
        width: '130px',
        cell: r => <OrgBadge orgId={r.orgId} maxW={120} />,
      },
      {
        name: 'Asig.',
        sortable: true,
        width: '82px',
        center: true,
        selector: r => getAsignacionScope(r).key,
        cell: r => <AsigBadge ticket={r} />,
      },
      {
        name: 'Asignación',
        sortable: true,
        center: true,
        grow: 1,
        selector: r => {
          const a = r?.asignado_a
          if (!a?.tipo) return '—'
          return `${a.tipo}:${a.id || ''}`
        },
        cell: r => {
          const asignado = r?.asignado_a
          if (!asignado?.tipo || !asignado?.id) {
            return <div className='w-100 text-center'>—</div>
          }

          if (asignado.tipo === 'personal') {
            const info = personaLabel(asignado.id, maps?.personalMap || {})
            return (
              <div className='w-100 text-center'>
                <Ell maxWidth={220} title={info.title}>
                  {info.title}
                </Ell>
              </div>
            )
          }

          const label = resolveAsignadoNombre(asignado, maps)
          return (
            <div className='w-100 text-center'>
              <Ell maxWidth={220} title={label}>
                {label}
              </Ell>
            </div>
          )
        },
      },

      {
        name: 'Título',
        selector: r => r.titulo,
        sortable: true,
        grow: 2,
        minWidth: '220px',
        cell: r => ellipsis(r.titulo, r.titulo),
      },
      {
        name: 'Tipo',
        selector: r => r.tipo,
        sortable: true,
        width: '78px',
        cell: r => ellipsis(r.tipo, r.tipo),
      },
      {
        name: 'Estado',
        sortable: true,
        width: '120px',
        selector: r => {
          const item = getEstadoItemDesdeHistorial(r, maps?.estadosMap || {})
          return (
            item?.name ||
            item?.name_norm ||
            item?.nombre ||
            item?.nombre_norm ||
            '—'
          )
        },
        cell: r => {
          const item = getEstadoItemDesdeHistorial(r, maps?.estadosMap || {})
          return <CatalogBadge item={item} fallback='—' maxW={110} />
        },
      },
      {
        name: 'Pri.',
        sortable: true,
        width: '110px',
        selector: r => {
          const id = oidToString(r?.prioridad_id)
          return maps?.prioridadesMap?.[id]?.name || '—'
        },
        cell: r => {
          const id = oidToString(r?.prioridad_id)
          return (
            <CatalogBadge
              item={maps?.prioridadesMap?.[id] || null}
              fallback='—'
              maxW={100}
            />
          )
        },
      },
      {
        name: 'Cat.',
        sortable: true,
        width: '130px',
        selector: r => {
          const id = oidToString(r?.categoria_id)
          return maps?.categoriasMap?.[id]?.name || '—'
        },
        cell: r => {
          const id = oidToString(r?.categoria_id)
          return (
            <CatalogBadge
              item={maps?.categoriasMap?.[id] || null}
              fallback='—'
              maxW={120}
            />
          )
        },
      },
    ]
  }, [maps])

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
      `Adjuntos del cambio ${ticket?.code ? `- ${ticket.code}` : ''} (${estadoLabel} · ${when})`
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

  // ✅ CONFIRMACIÓN ANTD (centrada, NO navegador)
  const confirmarEliminar = ticket => {
    if (!ticket?._id) return
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
          await deactivateTicket(ticket._id, { id_personal }, token)
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
          <strong>Mis Creaciones</strong>
          <div className='text-muted small'>
            Solo tickets creados por mí (con editar / eliminar). (No muestra
            activo=false)
          </div>
        </div>

        <button
          className='btn btn-sm btn-primary'
          onClick={() => setOpenCrear(true)}
          disabled={!token || !id_personal}
          title={
            !token || !id_personal ? 'Falta sesión/ID personal' : 'Crear ticket'
          }
        >
          Crear ticket
        </button>
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
          paginationRowsPerPageOptions={[10, 20, 30, 40, 50, 100]}
          highlightOnHover
          dense
          responsive
          customStyles={tableStyles}
          persistTableHead
          expandableRows
          // ✅ NUEVO: controlar expansión por ticketId y marcar leído al expandir
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

      {/* ✅ MODAL: CREAR TICKET (Wizard) */}
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
          onClose={() => {
            // ✅ refresca para ver el nuevo ticket al cerrar el resumen
            setOpenCrear(false)
            load()
          }}
        />
      </AntdModal>

      {/* Modal: Agregar al historial */}
      <AntdModal
        open={openActualizar}
        title={`Agregar al historial ${ticketActualizar?.code || ''}`}
        onCancel={() => setOpenActualizar(false)}
        footer={null}
        centered
        width={760}
      >
        {!ticketActualizar?._id ? (
          <div className='text-muted'>Selecciona un ticket.</div>
        ) : (
          <AgregarHistorialTicket
            ticketId={ticketActualizar._id}
            orgId={ticketActualizar.orgId}
            maps={maps}
            onSuccess={() => {
              setOpenActualizar(false)
              load()
            }}
          />
        )}
      </AntdModal>

      {/* Modal: Editar */}
      <AntdModal
        open={openEditar}
        title={`Editar ${ticketEditar?.code || ''}`}
        onCancel={() => setOpenEditar(false)}
        footer={null}
        centered
        width={760}
      >
        {!ticketEditar?._id ? (
          <div className='text-muted'>Selecciona un ticket.</div>
        ) : (
          <EditarTicketForm
            ticket={ticketEditar}
            token={token}
            id_personal={id_personal}
            onSaved={() => {
              setOpenEditar(false)
              load()
            }}
          />
        )}
      </AntdModal>

      {/* Modal adjuntos */}
      <AntdModal
        open={openAdjuntos}
        title={adjuntosModalTitle}
        onCancel={() => setOpenAdjuntos(false)}
        footer={null}
        centered
        width={720}
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
      >
        {!adjuntosModal.length ? (
          <div className='text-muted'>No hay adjuntos.</div>
        ) : (
          <div className='d-flex flex-column gap-3'>
            {adjuntosModal.map((a, idx) => {
              const rel = a?.url
              const rutaRelativa = /^https?:\/\//i.test(String(rel || ''))
                ? toTicketAbsolute(rel)
                : rel
              const title = a?.name || a?.fileId || `Adjunto ${idx + 1}`

              return (
                <div
                  key={`${a?.fileId || idx}`}
                  className='border rounded bg-white p-2'
                >
                  <div className='d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2'>
                    <div style={{ minWidth: 0 }}>
                      <div className='fw-semibold'>
                        <Ell title={title} maxWidth='520px'>
                          {title}
                        </Ell>
                      </div>
                      <div className='text-muted small'>
                        {a?.mime || '—'} ·{' '}
                        {typeof a?.size === 'number'
                          ? `${Math.round(a.size / 1024)} KB`
                          : '—'}
                      </div>
                    </div>

                    <span className='badge bg-dark-subtle text-dark'>
                      {a?.uploadedBy
                        ? changedByLabel(a.uploadedBy, personalMap)
                        : '—'}
                    </span>
                  </div>

                  <SecureArchivotikects
                    rutaRelativa={rutaRelativa}
                    nombreArchivo={title}
                  />
                </div>
              )
            })}
          </div>
        )}
      </AntdModal>
    </div>
  )
}

export default MisCreaciones
