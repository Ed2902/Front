// src/components/ControlIngresos/asistencia_config.js
export const HH_ENTRADA = { h: 7, m: 30 } // 07:30
export const HH_SALIDA = { h: 17, m: 30 } // 17:30
export const LUNCH_START = { h: 13, m: 0 } // 13:00
export const LUNCH_END = { h: 14, m: 0 } // 14:00
export const ONE_HOUR_MS = 60 * 60 * 1000

// -------- Utils (idénticas a las de Marcaciones) --------
const pad2 = n => String(n).padStart(2, '0')

export const atTime = (dateObj, h, m) => {
  const t = new Date(dateObj)
  t.setHours(h, m, 0, 0)
  return t
}

export const msToHMS = ms => {
  let total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  total -= h * 3600
  const m = Math.floor(total / 60)
  const s = total - m * 60

  const parts = []
  if (h > 0) parts.push(`${h}h`)
  if (h > 0 || m > 0) parts.push(`${m}m`)
  parts.push(`${String(s).padStart(2, '0')}s`)
  return parts.join(' ')
}

export const fmtHM = iso => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// -------- Cálculos específicos para reporte --------
export const computeRetrasoMin = (entradaIso, toleranciaMin = 0) => {
  if (!entradaIso) return 0
  const d = new Date(entradaIso)
  const threshold = atTime(d, HH_ENTRADA.h, HH_ENTRADA.m)
  const lateMs = d.getTime() - threshold.getTime()
  const raw = lateMs > 0 ? Math.round(lateMs / 60000) : 0
  return Math.max(0, raw - (Number(toleranciaMin) || 0))
}

export const computeSalidaAntesMin = salidaIso => {
  if (!salidaIso) return 0
  const d = new Date(salidaIso)
  const threshold = atTime(d, HH_SALIDA.h, HH_SALIDA.m)
  const earlyMs = threshold.getTime() - d.getTime()
  return earlyMs > 0 ? Math.round(earlyMs / 60000) : 0
}

export const computeHorasDiaHMS = (entradaIso, salidaIso) => {
  if (!entradaIso || !salidaIso) return ''
  const start = new Date(entradaIso)
  const end = new Date(salidaIso)
  const gross = Math.max(0, end.getTime() - start.getTime())

  // Descuento de almuerzo 13:00–14:00 sólo si cruza por completo esa ventana
  const lunchStartMs = atTime(start, LUNCH_START.h, LUNCH_START.m).getTime()
  const lunchEndMs = atTime(start, LUNCH_END.h, LUNCH_END.m).getTime()
  const lunchDeduction =
    start.getTime() <= lunchStartMs && end.getTime() >= lunchEndMs
      ? ONE_HOUR_MS
      : 0

  const workMs = Math.max(0, gross - lunchDeduction)
  return msToHMS(workMs) || '00s'
}
