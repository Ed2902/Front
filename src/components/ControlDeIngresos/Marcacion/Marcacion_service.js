// src/services/Marcacion_service.js
import axios from 'axios'

/* ===========================================================
   Zona horaria Colombia: America/Bogota (UTC-5, sin DST)
   =========================================================== */
const CO_TZ = 'America/Bogota'
const CO_OFFSET_STR = '-05:00' // ±HH:MM
const CO_OFFSET_MINUTES = -300 // minutos vs UTC
const LUNCH_DEFAULT = ['13:00', '14:00'] // política por defecto

/* ================ Instancia base con Authorization ================ */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL_2,
  timeout: 15000,
})

// Lee token desde localStorage (ajusta la clave si usas otra)
const getRawToken = () => localStorage.getItem('token') || null

api.interceptors.request.use(config => {
  const token = getRawToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err?.response?.status === 401) {
      // localStorage.removeItem('token')
      // window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

/* ================= Helpers de token/JWT ================= */

// Decodifica el payload de un JWT (base64url → JSON)
const decodeJwtPayload = jwt => {
  try {
    const parts = jwt.split('.')
    if (parts.length < 2) return null
    const payload = parts[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

// Documento (cédula) desde el token si viene
export const getDocumentoIdentidadDesdeToken = () => {
  const payload = decodeJwtPayload(getRawToken() || '')
  return payload?.personal?.documento ?? payload?.documento ?? null
}

// (Se mantiene por compat) id_personal desde token
export const getDocumentoDesdeToken = () => {
  const payload = decodeJwtPayload(getRawToken() || '')
  return payload?.id_personal ?? payload?.personal?.id_personal ?? null
}

/* ================= Helpers de fecha/hora Colombia ================= */

const pad2 = n => String(n).padStart(2, '0')

/** Retorna un Date con la hora ACTUAL de Colombia (UTC-5) */
export const getNowInColombia = () => {
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000
  return new Date(utcMs - 5 * 60 * 60000) // UTC - 5h
}

/** Devuelve { dateStr:'YYYY-MM-DD', timeStr:'HH:MM' } para la hora actual de Colombia */
export const getNowPartsColombia = () => {
  const co = getNowInColombia()
  const y = co.getFullYear()
  const m = pad2(co.getMonth() + 1)
  const d = pad2(co.getDate())
  const hh = pad2(co.getHours())
  const mm = pad2(co.getMinutes())
  return { dateStr: `${y}-${m}-${d}`, timeStr: `${hh}:${mm}` }
}

/** Construye una ISO local con offset Colombia a partir de YYYY-MM-DD y HH:MM */
export const buildColombiaISOFromParts = (dateStr, timeStr) => {
  return `${dateStr}T${timeStr}:00${CO_OFFSET_STR}`
}

/** Normaliza extra a formato Colombia y agrega ALIAS de campos para máxima compatibilidad con backend */
const normalizeExtraColombia = (extra = {}) => {
  const out = { ...(extra || {}) }

  // Si front manda fecha/hora manual pero no ISO, la componemos:
  if (out.fecha_manual && out.hora_manual && !out.fecha_hora_manual) {
    out.fecha_hora_manual = buildColombiaISOFromParts(
      out.fecha_manual,
      out.hora_manual
    )
  }

  // Si piden usar "ahora Colombia" explícitamente
  if (out.use_colombia_now) {
    const { dateStr, timeStr } = getNowPartsColombia()
    out.fecha_manual = dateStr
    out.hora_manual = timeStr
    out.fecha_hora_manual = buildColombiaISOFromParts(dateStr, timeStr)
    delete out.use_colombia_now
  }

  // Siempre adjuntamos tz y offset de Colombia si no vienen:
  if (!out.tz) out.tz = CO_TZ
  if (typeof out.offset_minutes !== 'number')
    out.offset_minutes = CO_OFFSET_MINUTES

  // —— ALIAS comunes —— //
  if (out.fecha_manual && !out.fecha) out.fecha = out.fecha_manual
  if (out.hora_manual && !out.hora) out.hora = out.hora_manual

  const iso = out.fecha_hora_manual
  if (iso) {
    if (!out.fechaHoraManual) out.fechaHoraManual = iso
    if (!out.fecha_hora) out.fecha_hora = iso
    if (!out.fechaHora) out.fechaHora = iso
  }

  return out
}

/* ===================== Services existentes (marcación) ===================== */

/**
 * POST /app/marcacion/auto
 */
export const postMarcacionAuto = async ({
  tipo,
  file,
  umbral = 0.55,
  extra = {},
  onProgress,
}) => {
  const formData = new FormData()
  formData.append('tipo', tipo)
  formData.append('umbral', String(umbral))
  if (file) formData.append('file', file)

  // Normalizamos y anexamos los extras a formato Colombia
  const extraCO = normalizeExtraColombia(extra)
  Object.entries(extraCO).forEach(([k, v]) => {
    if (v !== undefined && v !== null) formData.append(k, String(v))
  })

  const resp = await api.post('/app/marcacion/auto', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    onUploadProgress: evt => {
      if (onProgress && evt.total) {
        const pct = Math.round((evt.loaded * 100) / evt.total)
        onProgress(pct)
      }
    },
  })
  return resp.data
}

// GET /app/marcacion → historial completo (array)
export const getMarcacionHistorial = async () => {
  const resp = await api.get('/app/marcacion')
  return resp.data
}

// GET filtrado por el usuario actual (matchea token.id_personal con personal.documento del registro)
export const getMarcacionHistorialDelUsuarioActual = async () => {
  const documentoToken = getDocumentoDesdeToken()
  const data = await getMarcacionHistorial()
  if (!documentoToken) return []

  const arr = Array.isArray(data) ? data : []
  return arr.filter(item => {
    const doc = item?.personal?.documento
    return doc != null && String(doc) === String(documentoToken)
  })
}

/**
 * PUT /app/marcacion/{marcacion_id}
 * Actualiza justificación/observación/aprobado y/o evidencia (archivo)
 */
export const putActualizarMarcacion = async (
  marcacion_id,
  { justificacion, observacion, aprobado, file } = {}
) => {
  const form = new FormData()
  if (justificacion != null) form.append('justificacion', justificacion)
  if (observacion != null) form.append('observacion', observacion)
  if (typeof aprobado === 'boolean') form.append('aprobado', String(aprobado))
  if (file instanceof File) form.append('file', file)

  const resp = await api.put(`/app/marcacion/${marcacion_id}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return resp.data
}

/** Rol simple desde token (para habilitar aprobación en UI si lo decides) */
export const getCargoDesdeToken = () => {
  const payload = decodeJwtPayload(getRawToken() || '')
  return payload?.personal?.cargo || payload?.cargo || null
}

/* ===================== NUEVO: Services de Personal/Horario ===================== */

// Cache simple en memoria para evitar golpear /app/personal en cada render
let _personalCache = null
let _personalCacheAt = 0
const CACHE_TTL_MS = 60_000 // 1 minuto

/** GET /app/personal → lista completa de personal */
export const getPersonalLista = async ({ force = false } = {}) => {
  const now = Date.now()
  if (!force && _personalCache && now - _personalCacheAt < CACHE_TTL_MS) {
    return _personalCache
  }
  const resp = await api.get('/app/personal')
  _personalCache = Array.isArray(resp.data) ? resp.data : []
  _personalCacheAt = now
  return _personalCache
}

export const getHorarioDe = async documento => {
  const lista = await getPersonalLista()
  const person = lista.find(p => String(p.documento) === String(documento))
  if (!person) return null

  const hIn = person.horario_int
  const hOut = person.horario_off
  if (!hIn || !hOut) return null

  // nos quedamos con HH:MM
  const entrada = String(hIn).slice(0, 5)
  const salida = String(hOut).slice(0, 5)

  return { entrada, salida, lunch: LUNCH_DEFAULT }
}

/**
 * Saca automáticamente el documento del token y retorna su horario
 * - Si no hay documento en token o no hay métrica asignada → null
 */
export const getMiHorarioDesdeToken = async () => {
  const doc = getDocumentoIdentidadDesdeToken()
  if (!doc) return null
  return getHorarioDe(doc)
}
/**
 * PUT /app/marcacion/{marcacion_id}/fecha
 * Actualiza SOLO la fecha/hora efectiva (columna creado_en) de una marcación aprobada.
 * - Requiere: usar_manual=true + (fecha_manual & hora_manual) o un ISO manual.
 * - Usa helpers y normalización a zona Colombia.
 */
export const putActualizarFechaMarcacion = async (
  marcacion_id,
  {
    fecha_manual, // 'YYYY-MM-DD'
    hora_manual, // 'HH:MM'
    fecha_hora_manual, // opcional: 'YYYY-MM-DDTHH:MM[:SS]-05:00'
    tz = CO_TZ, // por defecto 'America/Bogota'
    use_colombia_now = false, // si true, usa "ahora" de Colombia
  } = {}
) => {
  // Preparamos payload base y lo normalizamos a formato Colombia + alias
  const base = {
    usar_manual: true,
    fecha_manual,
    hora_manual,
    fecha_hora_manual,
    tz,
    use_colombia_now,
  }
  const extraCO = normalizeExtraColombia(base)

  const form = new FormData()
  Object.entries(extraCO).forEach(([k, v]) => {
    if (v !== undefined && v !== null) form.append(k, String(v))
  })

  const resp = await api.put(`/app/marcacion/${marcacion_id}/fecha`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return resp.data
}
