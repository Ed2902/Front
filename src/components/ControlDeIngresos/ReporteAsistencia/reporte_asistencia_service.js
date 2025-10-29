// ======================= Axios base =======================
import axios from 'axios'
import Holidays from 'date-holidays'

// Crea una instancia dedicada (no mezclamos con otros módulos)
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL_2,
})

// ---- Helpers auth y baseURL
export const setApiAuthToken = token => {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`
  else delete api.defaults.headers.common.Authorization
}
export const setApiBaseURL = url => {
  if (url) api.defaults.baseURL = url
}

// ======================= Constantes negocio =======================
const ONE_HOUR_MS = 60 * 60 * 1000
const TZ_OFFSET = '-05:00' // America/Bogota

// ======================= Utils =======================
const pad2 = n => String(n).padStart(2, '0')
const ymdLocal = d =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

const clampMsNonNegative = ms => (ms < 0 ? 0 : ms)

const atTime = (dateObj, h, m) => {
  const t = new Date(dateObj)
  t.setHours(h, m, 0, 0)
  return t
}

const minutesDiff = (a, b) => Math.round((a.getTime() - b.getTime()) / 60000)

export const msToHMS = ms => {
  let rest = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(rest / 3600)
  rest -= hours * 3600
  const minutes = Math.floor(rest / 60)
  const seconds = rest - minutes * 60
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

const enumerateDatesYMD = (from, to) => {
  if (!from || !to) return []
  const start = new Date(`${from}T00:00:00${TZ_OFFSET}`)
  const end = new Date(`${to}T00:00:00${TZ_OFFSET}`)
  const days = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(ymdLocal(d))
  }
  return days
}

const isWeekend = isoYmd => {
  const dt = new Date(`${isoYmd}T12:00:00${TZ_OFFSET}`)
  const dow = dt.getDay()
  return dow === 0 || dow === 6
}

// ======================= Festivos CO =======================
const hd = new Holidays('CO')
const isFestivo = isoYmd =>
  !!hd.isHoliday(new Date(`${isoYmd}T12:00:00${TZ_OFFSET}`))

// ======================= Fetch crudo =======================

/**
 * GET /app/marcacion  →  array de marcas
 * Estructura: {
 *  id, tipo ('entrada'|'salida'|'almuerzo_inicio'|'almuerzo_fin'),
 *  creado_en, fecha_hora, observacion, justificacion, evidencia_url, aprobado,
 *  personal:{ id, documento, nombres, apellidos }
 * }
 */
export const fetchMarcaciones = async (params = {}) => {
  const resp = await api.get('/app/marcacion')
  const data = Array.isArray(resp.data) ? resp.data : []

  const { from, to } = params
  if (!from && !to) return data

  const start = from ? new Date(`${from}T00:00:00${TZ_OFFSET}`) : null
  const end = to ? new Date(`${to}T23:59:59.999${TZ_OFFSET}`) : null

  return data.filter(r => {
    const iso = r.creado_en || r.fecha_hora // ⬅️ creado_en primero
    if (!iso) return false
    const dt = new Date(iso)
    if (start && dt < start) return false
    if (end && dt > end) return false
    return true
  })
}

/**
 * GET /app/personal → horarios: horario_int (HH:MM:SS), horario_off (HH:MM:SS)
 * Devuelve Map<documento, {entrada:'HH:MM', salida:'HH:MM'}>
 */
export const fetchHorariosPorPersona = async () => {
  const resp = await api.get('/app/personal')
  const list = Array.isArray(resp.data) ? resp.data : []
  const map = new Map()

  for (const p of list) {
    const doc = String(p?.documento ?? '').trim()
    if (!doc) continue
    const entrada = (p?.horario_int || '').slice(0, 5) || null
    const salida = (p?.horario_off || '').slice(0, 5) || null
    if (entrada || salida) map.set(doc, { entrada, salida })
  }
  return map
}

// ======================= Cálculo diario =======================
const sumarBloquesEmparejados = (inicios, fines) => {
  const starts = [...inicios].sort((a, b) => new Date(a) - new Date(b))
  const ends = [...fines].sort((a, b) => new Date(a) - new Date(b))
  let i = 0,
    j = 0,
    total = 0,
    incompleto = false

  while (i < starts.length && j < ends.length) {
    const s = new Date(starts[i])
    const e = new Date(ends[j])
    if (e <= s) {
      j++
      continue
    }
    total += e - s
    i++
    j++
  }
  if (i < starts.length || j < ends.length) incompleto = true
  return { ms: clampMsNonNegative(total), incompleto }
}

// Normaliza la evidencia_url con backslashes y leading slashes
const normalizeEvidenciaPath = evidencia_url => {
  if (!evidencia_url) return null
  return String(evidencia_url).replace(/\\/g, '/').replace(/^\/+/, '')
}

export const buildDiarioPorPersona = (marcaciones, options = {}) => {
  const { from, to, getHorarioPara } = options

  // Orden global por creado_en (fallback fecha_hora)
  const list = [...marcaciones].sort(
    (a, b) =>
      new Date(a.creado_en || a.fecha_hora) -
      new Date(b.creado_en || b.fecha_hora)
  )

  const personas = new Map() // doc -> {documento, nombres, apellidos, id}
  const buckets = new Map() // doc -> Map<YYYY-MM-DD, { entradas:[], salidas:[], aStart:[], aEnd:[] }>

  for (const item of list) {
    const baseISO = item.creado_en || item.fecha_hora
    if (!baseISO) continue
    const dt = new Date(baseISO)
    const dayKey = ymdLocal(dt)
    const doc = String(item?.personal?.documento ?? '')
    if (!doc) continue

    if (!personas.has(doc)) {
      personas.set(doc, {
        documento: doc,
        id: item?.personal?.id ?? null,
        nombres: item?.personal?.nombres ?? '',
        apellidos: item?.personal?.apellidos ?? '',
      })
    }

    if (!buckets.has(doc)) buckets.set(doc, new Map())
    const dayMap = buckets.get(doc)
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { entradas: [], salidas: [], aStart: [], aEnd: [] })
    }

    const tipo = String(item?.tipo || '')
      .trim()
      .toLowerCase()
    const box = dayMap.get(dayKey)
    if (tipo === 'entrada') box.entradas.push(item)
    else if (tipo === 'salida') box.salidas.push(item)
    else if (tipo === 'almuerzo_inicio') box.aStart.push(item)
    else if (tipo === 'almuerzo_fin') box.aEnd.push(item)
  }

  const days = enumerateDatesYMD(from, to)
  const dailyRows = []

  for (const [doc, persona] of personas.entries()) {
    const dayMap = buckets.get(doc) || new Map()

    for (const dayKey of days) {
      // Festivo / FDS
      if (isFestivo(dayKey)) {
        dailyRows.push({
          fecha: dayKey,
          persona,
          estado: 'FESTIVO',
          observacion: 'Festivo (CO)',
          horasDiaHMS: msToHMS(0),
          retrasoMin: 0,
          salidaAntesMin: 0,
        })
        continue
      }
      if (isWeekend(dayKey)) {
        dailyRows.push({
          fecha: dayKey,
          persona,
          estado: 'FIN_DE_SEMANA',
          observacion: 'Fin de semana',
          horasDiaHMS: msToHMS(0),
          retrasoMin: 0,
          salidaAntesMin: 0,
        })
        continue
      }

      const bucket = dayMap.get(dayKey) || {
        entradas: [],
        salidas: [],
        aStart: [],
        aEnd: [],
      }

      // Sin actividad
      if (
        bucket.entradas.length === 0 &&
        bucket.salidas.length === 0 &&
        bucket.aStart.length === 0 &&
        bucket.aEnd.length === 0
      ) {
        dailyRows.push({
          fecha: dayKey,
          persona,
          estado: 'AUSENTE',
          observacion: 'Sin marcaciones',
          horasDiaHMS: msToHMS(0),
          retrasoMin: 0,
          salidaAntesMin: 0,
        })
        continue
      }

      // === Determinar primera entrada y última salida ===
      const firstEntradaItem = bucket.entradas[0] || null
      const lastSalidaItem =
        bucket.salidas.length > 0
          ? bucket.salidas[bucket.salidas.length - 1]
          : null

      // === Tiempos efectivos (creado_en) y “anteriores” (fecha_hora) ===
      const firstEntradaCreado =
        firstEntradaItem?.creado_en || firstEntradaItem?.fecha_hora || null
      const lastSalidaCreado =
        lastSalidaItem?.creado_en || lastSalidaItem?.fecha_hora || null

      const firstEntradaAnterior = firstEntradaItem?.fecha_hora || null
      const lastSalidaAnterior = lastSalidaItem?.fecha_hora || null

      // Si hay actividad pero falta in/out
      if (!firstEntradaCreado || !lastSalidaCreado) {
        dailyRows.push({
          fecha: dayKey,
          persona,

          // visibilidad (creado_en) + pares anteriores:
          entrada: firstEntradaCreado,
          salida: lastSalidaCreado,
          entradaCreadoEn: firstEntradaCreado,
          salidaCreadoEn: lastSalidaCreado,
          entrada_fecha_hora: firstEntradaAnterior,
          salida_fecha_hora: lastSalidaAnterior,

          entradaId: firstEntradaItem?.id ?? null,
          salidaId: lastSalidaItem?.id ?? null,
          horasDiaMs: 0,
          horasDiaHMS: msToHMS(0),
          retrasoMin: 0,
          salidaAntesMin: 0,
          estado: 'INCOMPLETO',
          observacion: 'Falta entrada o salida',
          observacionEntrada: firstEntradaItem?.observacion || '',
          observacionSalida: lastSalidaItem?.observacion || '',
          aprobadoEntrada: firstEntradaItem?.aprobado ?? null,
          aprobadoSalida: lastSalidaItem?.aprobado ?? null,
          justEntrada: {
            texto: firstEntradaItem?.justificacion || '',
            imagen_url: normalizeEvidenciaPath(firstEntradaItem?.evidencia_url),
          },
          justSalida: {
            texto: lastSalidaItem?.justificacion || '',
            imagen_url: normalizeEvidenciaPath(lastSalidaItem?.evidencia_url),
          },
          id: firstEntradaItem?.id ?? lastSalidaItem?.id ?? null,
        })
        continue
      }

      // Jornada usando creado_en
      const dEntrada = new Date(firstEntradaCreado)
      const dSalida = new Date(lastSalidaCreado)
      const bruto = clampMsNonNegative(dSalida - dEntrada)

      const { ms: almuerzoMs, incompleto } = sumarBloquesEmparejados(
        bucket.aStart.map(x => x.creado_en || x.fecha_hora),
        bucket.aEnd.map(x => x.creado_en || x.fecha_hora)
      )

      const descAlmuerzo =
        incompleto || almuerzoMs === 0 ? ONE_HOUR_MS : almuerzoMs
      const horasDiaMs = clampMsNonNegative(bruto - descAlmuerzo)

      // Horario esperado
      const horario =
        typeof getHorarioPara === 'function'
          ? getHorarioPara(doc, dayKey)
          : null

      let retrasoMin = 0
      let salidaAntesMin = 0
      if (horario?.entrada) {
        const [hIn, mIn] = horario.entrada.split(':').map(Number)
        const refIn = atTime(dEntrada, hIn, mIn)
        const diff = minutesDiff(dEntrada, refIn) // >0 tarde
        retrasoMin = Math.max(0, diff)
      }
      if (horario?.salida) {
        const [hOut, mOut] = horario.salida.split(':').map(Number)
        const refOut = atTime(dSalida, hOut, mOut)
        const diff = minutesDiff(refOut, dSalida) // >0 salida antes
        salidaAntesMin = Math.max(0, diff)
      }

      let estado = 'OK'
      let observacion = ''
      if (incompleto) {
        estado = 'INCOMPLETO'
        observacion = 'Almuerzo incompleto'
      } else if (retrasoMin > 0 && salidaAntesMin > 0) {
        estado = 'TARDE_Y_SALIDA_ANTES'
      } else if (retrasoMin > 0) {
        estado = 'TARDE'
      } else if (salidaAntesMin > 0) {
        estado = 'SALIDA_ANTES'
      }

      const obsMarcas =
        (firstEntradaItem?.observacion ?? '') ||
        (lastSalidaItem?.observacion ?? '') ||
        ''
      const observacionFinal = observacion || obsMarcas

      dailyRows.push({
        fecha: dayKey,
        persona,

        // visibilidad (creado_en) y pares anteriores
        entrada: firstEntradaCreado,
        salida: lastSalidaCreado,
        entradaCreadoEn: firstEntradaCreado,
        salidaCreadoEn: lastSalidaCreado,
        entrada_fecha_hora: firstEntradaAnterior,
        salida_fecha_hora: lastSalidaAnterior,

        entradaId: firstEntradaItem?.id ?? null,
        salidaId: lastSalidaItem?.id ?? null,
        horasDiaMs,
        horasDiaHMS: msToHMS(horasDiaMs),
        retrasoMin,
        salidaAntesMin,
        estado,
        observacion: observacionFinal,
        observacionEntrada: firstEntradaItem?.observacion || '',
        observacionSalida: lastSalidaItem?.observacion || '',
        aprobadoEntrada: firstEntradaItem?.aprobado ?? null,
        aprobadoSalida: lastSalidaItem?.aprobado ?? null,
        justEntrada: {
          texto: firstEntradaItem?.justificacion || '',
          imagen_url: normalizeEvidenciaPath(firstEntradaItem?.evidencia_url),
        },
        justSalida: {
          texto: lastSalidaItem?.justificacion || '',
          imagen_url: normalizeEvidenciaPath(lastSalidaItem?.evidencia_url),
        },
        id: firstEntradaItem?.id ?? lastSalidaItem?.id ?? null,
      })
    }
  }

  return dailyRows
}

// ======================= Endpoints REALES (PUT/GET por marcación) =======================

/** PUT /app/marcacion/{id}  →  aprobar/rechazar (opcional: observación) */
export const putAprobacionMarcacion = async (
  id_marcacion,
  aprobado,
  observacion = ''
) => {
  if (!id_marcacion) throw new Error('id_marcacion requerido')
  const form = new FormData()
  form.append('aprobado', String(!!aprobado))
  if (observacion) form.append('observacion', observacion)
  const resp = await api.put(`/app/marcacion/${id_marcacion}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return resp.data
}

/** PUT /app/marcacion/{id}  →  actualizar solo observación */
export const putObservacionMarcacion = async (id_marcacion, observacion) => {
  if (!id_marcacion) throw new Error('id_marcacion requerido')
  const form = new FormData()
  form.append('observacion', observacion || '')
  const resp = await api.put(`/app/marcacion/${id_marcacion}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return resp.data
}

/**
 * Descarga la evidencia como BLOB (con Authorization) y devuelve un objectURL para <img src=...>
 * Acepta rutas con backslashes y relativas (ej. 'upload/justificaciones\\2025...png')
 */
export const getEvidenciaObjectURL = async evidencia_url => {
  const rel = normalizeEvidenciaPath(evidencia_url)
  if (!rel) return null
  const resp = await api.get(`/${rel}`, { responseType: 'blob' })
  const blob = resp.data
  return URL.createObjectURL(blob)
}

// ======================= API alto nivel =======================
export const getReporteDetalleDiario = async (params = {}) => {
  const { from, to, getHorarioPara } = params
  const raw = await fetchMarcaciones({ from, to })
  const horariosMap = await fetchHorariosPorPersona()
  const horarioFn =
    typeof getHorarioPara === 'function'
      ? getHorarioPara
      : doc => horariosMap.get(String(doc)) || null
  return buildDiarioPorPersona(raw, { from, to, getHorarioPara: horarioFn })
}
