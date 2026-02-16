// MisTareas.utils.js

// ---------- fechas ----------
export const fmtDate = iso => {
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

// soporta Date ISO, {$date} y variantes
export const anyDateToIso = v => {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v.$date) return String(v.$date)
  if (typeof v === 'object' && v.date) return anyDateToIso(v.date)
  return String(v)
}

export const diffDaysCeil = (a, b) => {
  const ms = a.getTime() - b.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

// ---------- ids / oid ----------
export const oidToString = v => {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v.$oid) return String(v.$oid)
  if (typeof v === 'object' && v._id) return oidToString(v._id)
  return String(v)
}

// ---------- query ----------
export const getTicketIdFromQuery = () => {
  try {
    const sp = new URLSearchParams(window.location.search)
    const tid = sp.get('ticketId')
    return tid ? String(tid).trim() : ''
  } catch {
    return ''
  }
}

// ---------- personal ----------
export const getPersonaInfo = (id_personal, personalMap) => {
  const key = String(id_personal ?? '').trim()
  if (!key) return null
  return personalMap?.[key] || null
}

export const personaLabel = (id, personalMap) => {
  const p = getPersonaInfo(id, personalMap)
  if (!p) return { title: String(id), raw: String(id) }

  const nombre = String(p?.Nombre || '').trim()
  const apellido = String(p?.Apellido || '').trim()
  const full = [nombre, apellido].filter(Boolean).join(' ').trim() || String(id)

  return { title: full, raw: String(p?.Id_personal ?? id) }
}

export const changedByLabel = (changedBy, personalMap) => {
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

// ---------- asignación ----------
export const getAsignacionScope = ticket => {
  const a = ticket?.asignado_a
  if (!a?.tipo)
    return { label: '—', key: 'none', cls: 'badge bg-light text-dark' }

  if (a.tipo === 'personal') {
    return {
      label: 'Personal',
      key: 'personal',
      cls: 'badge bg-primary',
      detail: a.id,
    }
  }
  if (a.tipo === 'team')
    return { label: 'Team', key: 'team', cls: 'badge bg-success', detail: a.id }
  if (a.tipo === 'area')
    return {
      label: 'Área',
      key: 'area',
      cls: 'badge bg-info text-dark',
      detail: a.id,
    }

  return { label: '—', key: 'none', cls: 'badge bg-light text-dark' }
}

export const resolveAsignadoNombre = (asignado, maps) => {
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

// ---------- estado / historial ----------
const norm = s =>
  String(s || '')
    .trim()
    .toLowerCase()

export const getUltimoHist = ticket => {
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

// ✅ NUEVO: fecha de “último movimiento” para ordenar TODO
// last historial -> updatedAt -> createdAt
export const getLastMoveIso = ticket => {
  const last = getUltimoHist(ticket)
  const h = last?.changedAt ? anyDateToIso(last.changedAt) : ''
  return (
    h ||
    anyDateToIso(ticket?.updatedAt) ||
    anyDateToIso(ticket?.createdAt) ||
    ''
  )
}

// “Cerrado” puede cambiar de id; detectar por name/name_norm
const buildClosedEstadoIds = estadosMap => {
  const ids = new Set()
  for (const it of Object.values(estadosMap || {})) {
    const n = norm(it?.name_norm || it?.name || it?.nombre_norm || it?.nombre)
    if (n === 'cerrado') ids.add(String(it._id))
  }
  return ids
}

export const resolveEstadoItem = (estado_id, estadosMap) => {
  const id = oidToString(estado_id)
  if (!id) return null
  return estadosMap?.[id] || null
}

export const getEstadoItemDesdeHistorial = (ticket, estadosMap) => {
  const last = getUltimoHist(ticket)
  const item = resolveEstadoItem(last?.estado_id, estadosMap)
  if (item) return item

  const id = oidToString(last?.estado_id)
  if (!id) return null
  return { _id: id, name: '—' }
}

export const isTicketCerrado = (ticket, estadosMap) => {
  const closedIds = buildClosedEstadoIds(estadosMap)
  if (!closedIds.size) return false

  const currentId = oidToString(ticket?.estado_id)
  if (currentId && closedIds.has(currentId)) return true

  // fallback: último estado por historial
  const last = getUltimoHist(ticket)
  const lastId = oidToString(last?.estado_id)
  return !!(lastId && closedIds.has(lastId))
}

export const getCierreEvento = (ticket, estadosMap) => {
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

export const computeCumplimientoUI = (ticket, estadosMap) => {
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

// ---------- colores ----------
export const normalizeHex = hex => {
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

export const getContrastingTextColor = bgHex => {
  const rgb = hexToRgb(bgHex)
  if (!rgb) return '#111'
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.6 ? '#111' : '#fff'
}

const hashString = str => {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

// color determinístico por persona (solo texto)
export const textColorForUser = changedBy => {
  const k = String(changedBy || '').trim() || '—'
  const hue = hashString(k) % 360
  return `hsl(${hue} 45% 35%)`
}

// ---------- URL adjuntos ----------
const TICKETS_API = import.meta.env.VITE_API_URL_5 || ''

const ticketsOrigin = (base => {
  if (!base) return ''
  let b = String(base).replace(/\/+$/, '')
  b = b.replace(/\/tikets$/i, '')
  return b
})(TICKETS_API)

export const toTicketAbsolute = relOrAbs => {
  if (!relOrAbs) return ''
  const s = String(relOrAbs).trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (!ticketsOrigin) return s
  return `${ticketsOrigin}${s.startsWith('/') ? '' : '/'}${s}`
}
