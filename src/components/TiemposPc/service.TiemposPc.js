// service.TiemposPc.js
import axios from 'axios'

// ======================= Axios base =======================
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL3,
  headers: { Accept: 'application/json' },
})

// ======================= Utils =======================
function sumBy(arr, pick) {
  return (arr || []).reduce((acc, x) => acc + (Number(pick(x)) || 0), 0)
}

function formatHHMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = n => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
}

// ======================= Core =======================
function computeMetrics(report) {
  const apps = Array.isArray(report?.apps) ? report.apps : []
  const totals = report?.totals || {}

  const operandoSec = sumBy(apps, a => a.total_sec)
  const activeSec = Number(totals.active_sec) || 0
  const afkSec = Number(totals.afk_sec) || 0
  const inactividadRealSec = Math.max(0, operandoSec - activeSec)

  const lock = apps.find(
    a => String(a.app || '').toLowerCase() === 'lockapp.exe'
  )
  const bloqueadoSec = Number(lock?.total_sec) || 0

  const totalObservadoSec = activeSec + afkSec
  const denom = totalObservadoSec > 0 ? totalObservadoSec : 1
  const pct = x => (Number(x) * 100) / denom

  return {
    context: {
      date: report?.date || null,
      user: report?.user || null,
      hostname: report?.hostname || null,
      generated_at: report?.meta?.generated_at || null,
    },
    seconds: {
      operando: operandoSec,
      espera: afkSec,
      inactividad_real: inactividadRealSec,
      bloqueado: bloqueadoSec,
      total_observado: totalObservadoSec,
    },
    human: {
      operando: formatHHMMSS(operandoSec),
      espera: formatHHMMSS(afkSec),
      inactividad_real: formatHHMMSS(inactividadRealSec),
      bloqueado: formatHHMMSS(bloqueadoSec),
      total_observado: formatHHMMSS(totalObservadoSec),
    },
    percent_of_total_observado: {
      operando: pct(operandoSec),
      espera: pct(afkSec),
      inactividad_real: pct(inactividadRealSec),
      bloqueado: pct(bloqueadoSec),
    },
    top: {
      apps: [...apps].sort((a, b) => (b.total_sec || 0) - (a.total_sec || 0)),
      web: Array.isArray(report?.web)
        ? [...report.web].sort(
            (a, b) => (b.total_sec || 0) - (a.total_sec || 0)
          )
        : [],
    },
  }
}

// ======================= API =======================
async function getUsers() {
  const { data } = await api.get('/reports/users')
  return Array.isArray(data?.items) ? data.items : []
}

async function getLatest(user) {
  const { data } = await api.get(
    `/reports/latest?user=${encodeURIComponent(user)}`
  )
  return data
}

async function getReportByDateHost({ user, date, hostname }) {
  const params = new URLSearchParams({ user, date, hostname })
  const { data } = await api.get(`/reports?${params.toString()}`)
  return data
}

// ======================= Flows =======================
async function buildDailyForUser(user) {
  const latest = await getLatest(user)
  const date = latest?.date
  const hostname = latest?.hostname
  if (!date || !hostname) {
    throw new Error('No se pudo resolver date/hostname desde /reports/latest')
  }
  const report = await getReportByDateHost({ user, date, hostname })
  return computeMetrics(report)
}

async function buildDailyForAllUsers() {
  const users = await getUsers()
  const results = []
  for (const user of users) {
    try {
      const metrics = await buildDailyForUser(user)
      results.push({ user, ...metrics })
    } catch (err) {
      results.push({ user, error: String(err?.message || err) })
    }
  }
  return results
}

export default {
  api,
  formatHHMMSS,
  computeMetrics,
  // api
  getUsers,
  getLatest,
  getReportByDateHost,
  // flows
  buildDailyForUser,
  buildDailyForAllUsers,
}
