import axios from 'axios'

// ======================= Axios base =======================
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL_2, // p.ej. http://127.0.0.1:8000
})

// ======================= Constantes negocio =======================
const REF_ENTRADA = { h: 7, m: 30 } // 07:30
const REF_SALIDA = { h: 17, m: 30 } // 17:30
const LUNCH_START = { h: 13, m: 0 } // 13:00
const LUNCH_END = { h: 14, m: 0 } // 14:00
const ONE_HOUR_MS = 60 * 60 * 1000

// ======================= Utils =======================
const pad2 = n => String(n).padStart(2, '0')

const ymd = d =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

const atTime = (dateObj, h, m) => {
  const t = new Date(dateObj)
  t.setHours(h, m, 0, 0)
  return t
}

const clampMsNonNegative = ms => (ms < 0 ? 0 : ms)

export const msToHMS = ms => {
  let rest = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(rest / 3600)
  rest -= hours * 3600
  const minutes = Math.floor(rest / 60)
  const seconds = rest - minutes * 60
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

export const minutesDiff = (a, b) =>
  Math.round((a.getTime() - b.getTime()) / 60000)

// ======================= Fetch crudo =======================
/**
 * Trae marcaciones desde /app/marcacion y filtra por rango (front).
 * @param {{from?: string, to?: string}} params - YYYY-MM-DD (local)
 */
export const fetchMarcaciones = async (params = {}) => {
  const resp = await api.get('/app/marcacion')
  const data = Array.isArray(resp.data) ? resp.data : []

  const { from, to } = params
  if (!from && !to) return data

  const start = from ? new Date(`${from}T00:00:00`) : null
  const end = to ? new Date(`${to}T23:59:59.999`) : null

  return data.filter(r => {
    const dt = new Date(r.fecha_hora)
    if (start && dt < start) return false
    if (end && dt > end) return false
    return true
  })
}

// ======================= Transformación: por persona/día =======================
/**
 * Agrupa por persona (documento) y fecha (YYYY-MM-DD), toma:
 * - primera ENTRADA del día
 * - última SALIDA del día
 * Calcula: retraso, salida antes, horas trabajadas (regla de almuerzo 13–14).
 */
export const buildDiarioPorPersona = (marcaciones, options = {}) => {
  const tolerancia = Number.isFinite(options.toleranciaRetrasoMin)
    ? options.toleranciaRetrasoMin
    : 0

  // Orden asc por fecha
  const list = [...marcaciones].sort(
    (a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora)
  )

  // Mapa: { [doc]: { [YYYY-MM-DD]: { persona, entradas:[], salidas:[] } } }
  const byPersonDay = new Map()

  for (const item of list) {
    const dt = new Date(item.fecha_hora)
    const dayKey = ymd(dt)
    const doc = String(item?.personal?.documento ?? '')
    if (!doc) continue

    if (!byPersonDay.has(doc)) byPersonDay.set(doc, new Map())
    const dayMap = byPersonDay.get(doc)
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, {
        persona: {
          documento: doc,
          id: item?.personal?.id ?? null,
          nombres: item?.personal?.nombres ?? '',
          apellidos: item?.personal?.apellidos ?? '',
        },
        entradas: [],
        salidas: [],
      })
    }

    const bucket = dayMap.get(dayKey)
    if (item.tipo === 'entrada') bucket.entradas.push(item)
    if (item.tipo === 'salida') bucket.salidas.push(item)
  }

  const dailyRows = []
  for (const [, dayMap] of byPersonDay) {
    for (const [dayKey, bucket] of dayMap) {
      const firstEntrada = bucket.entradas.length
        ? bucket.entradas.reduce((min, x) =>
            new Date(x.fecha_hora) < new Date(min.fecha_hora) ? x : min
          )
        : null

      const lastSalida = bucket.salidas.length
        ? bucket.salidas.reduce((max, x) =>
            new Date(x.fecha_hora) > new Date(max.fecha_hora) ? x : max
          )
        : null

      let retrasoMin = 0
      let salidaAntesMin = 0
      let horasDiaMs = 0
      let novedad = 'A tiempo'

      if (!firstEntrada || !lastSalida) {
        novedad = 'Falta entrada/salida'
      }

      if (firstEntrada) {
        const dEntrada = new Date(firstEntrada.fecha_hora)
        const refIn = atTime(dEntrada, REF_ENTRADA.h, REF_ENTRADA.m)
        const diffMin = minutesDiff(dEntrada, refIn)
        retrasoMin = Math.max(0, diffMin - tolerancia)
      }

      if (lastSalida) {
        const dSalida = new Date(lastSalida.fecha_hora)
        const refOut = atTime(dSalida, REF_SALIDA.h, REF_SALIDA.m)
        const diffMin = minutesDiff(refOut, dSalida)
        salidaAntesMin = Math.max(0, diffMin)
      }

      if (firstEntrada && lastSalida) {
        const dEntrada = new Date(firstEntrada.fecha_hora)
        const dSalida = new Date(lastSalida.fecha_hora)
        const bruto = clampMsNonNegative(dSalida - dEntrada)

        // Almuerzo: descuenta 1h solo si cubre [13:00–14:00] completo
        const lunchStartMs = atTime(
          dEntrada,
          LUNCH_START.h,
          LUNCH_START.m
        ).getTime()
        const lunchEndMs = atTime(dEntrada, LUNCH_END.h, LUNCH_END.m).getTime()
        const coversLunch =
          dEntrada.getTime() <= lunchStartMs && dSalida.getTime() >= lunchEndMs
        const lunchDeduct = coversLunch ? ONE_HOUR_MS : 0

        horasDiaMs = clampMsNonNegative(bruto - lunchDeduct)

        if (retrasoMin > 0 && salidaAntesMin > 0)
          novedad = 'Retraso + Salida antes'
        else if (retrasoMin > 0) novedad = 'Retraso'
        else if (salidaAntesMin > 0) novedad = 'Salida antes'
        else novedad = 'A tiempo'
      }

      dailyRows.push({
        fecha: dayKey,
        persona: bucket.persona,
        entrada: firstEntrada ? firstEntrada.fecha_hora : null,
        salida: lastSalida ? lastSalida.fecha_hora : null,
        retrasoMin,
        salidaAntesMin,
        horasDiaMs,
        horasDiaHMS: msToHMS(horasDiaMs),
        novedad,
      })
    }
  }

  // Orden por persona y fecha desc
  dailyRows.sort((a, b) => {
    if (a.persona.documento !== b.persona.documento) {
      return a.persona.documento.localeCompare(b.persona.documento)
    }
    return new Date(b.fecha) - new Date(a.fecha)
  })

  return dailyRows
}

// ======================= Resumen por persona =======================
export const resumenPorPersona = (dailyRows, options = {}) => {
  const horasSemanalesPorDoc = options.horasSemanalesPorDoc || {}

  const agg = new Map()
  for (const row of dailyRows) {
    const doc = row.persona.documento
    if (!agg.has(doc)) {
      agg.set(doc, {
        persona: row.persona,
        dias: 0,
        horasMs: 0,
        retrasoMin: 0,
        salidaAntesMin: 0,
        diasRetraso: 0,
        diasSalidaAntes: 0,
        diasATiempo: 0,
        diasIncompletos: 0,
      })
    }
    const a = agg.get(doc)
    a.dias += 1
    a.horasMs += row.horasDiaMs
    a.retrasoMin += row.retrasoMin
    a.salidaAntesMin += row.salidaAntesMin

    if (row.novedad === 'Falta entrada/salida') a.diasIncompletos += 1
    else if (row.novedad === 'A tiempo') a.diasATiempo += 1
    else {
      if (row.retrasoMin > 0) a.diasRetraso += 1
      if (row.salidaAntesMin > 0) a.diasSalidaAntes += 1
    }
  }

  const out = []
  for (const [, val] of agg) {
    const doc = val.persona.documento
    const comprometidasHoras = Number(horasSemanalesPorDoc[doc]) || null
    out.push({
      ...val,
      horasHMS: msToHMS(val.horasMs),
      comprometidasHoras,
    })
  }

  out.sort((a, b) => b.horasMs - a.horasMs)
  return out
}

// ======================= API alto nivel =======================
export const getReporteDetalleDiario = async (params = {}) => {
  const raw = await fetchMarcaciones({ from: params.from, to: params.to })
  return buildDiarioPorPersona(raw, {
    toleranciaRetrasoMin: params.toleranciaRetrasoMin ?? 0,
  })
}

export const getReporteResumenPorPersona = async (params = {}) => {
  const daily = await getReporteDetalleDiario(params)
  return resumenPorPersona(daily, {
    horasSemanalesPorDoc: params.horasSemanalesPorDoc || {},
  })
}
