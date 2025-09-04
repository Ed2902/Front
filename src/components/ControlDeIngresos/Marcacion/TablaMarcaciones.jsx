// src/components/ControlIngresos/Marcacion/TablaMarcaciones.jsx
import { useEffect, useMemo, useState } from 'react'
import { BiLogIn, BiLogOut } from 'react-icons/bi'
import { getMarcacionHistorialDelUsuarioActual as getMarcacionesUsuario } from './Marcacion_service'

const HH_ENTRADA = { h: 7, m: 40 } // 07:40
const HH_SALIDA = { h: 17, m: 30 } // 17:30
const ONE_HOUR_MS = 60 * 60 * 1000
const LUNCH_START = { h: 13, m: 0 } // 13:00
const LUNCH_END = { h: 14, m: 0 } // 14:00

// ---- Utils ----
const pad2 = n => String(n).padStart(2, '0')

const fmtDateTime = iso => {
  if (!iso) return ''
  const d = new Date(iso)
  const y = d.getFullYear()
  const M = pad2(d.getMonth() + 1)
  const D = pad2(d.getDate())
  const h = pad2(d.getHours())
  const m = pad2(d.getMinutes())
  return `${y}-${M}-${D} ${h}:${m}`
}

const getDayKey = d =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

const atTime = (dateObj, h, m) => {
  const t = new Date(dateObj)
  t.setHours(h, m, 0, 0)
  return t
}

const diffToHM = ms => {
  const sign = ms < 0 ? -1 : 1
  let rest = Math.abs(ms)
  const hours = Math.floor(rest / 3600000)
  rest -= hours * 3600000
  const minutes = Math.floor(rest / 60000)
  const text = (hours > 0 ? `${hours}h ` : '') + `${minutes}m`
  return { sign, text: text.trim() }
}
const msToHMS = ms => {
  let total = Math.max(0, Math.floor(ms / 1000)) // a segundos
  const h = Math.floor(total / 3600)
  total -= h * 3600
  const m = Math.floor(total / 60)
  const s = total - m * 60

  const parts = []
  if (h > 0) parts.push(`${h}h`)
  if (h > 0 || m > 0) parts.push(`${m}m`)
  parts.push(`${String(s).padStart(2, '0')}s`) // segundos siempre

  return parts.join(' ')
}

// ---- Component ----
const TablaMarcaciones = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Filtros
  const [fromDate, setFromDate] = useState('') // YYYY-MM-DD
  const [toDate, setToDate] = useState('') // YYYY-MM-DD
  const [onlyLast, setOnlyLast] = useState(false)
  const [tipoFilter, setTipoFilter] = useState('all') // 'all' | 'entrada' | 'salida'

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getMarcacionesUsuario() // ya filtra por documento del token
      const ordered = [...data].sort(
        (a, b) =>
          new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime()
      )
      setRows(ordered)
    } catch (e) {
      console.error(e)
      setError('No se pudo cargar el historial de marcaciones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Resumen por día (primera entrada y última salida)
  const dailySummary = useMemo(() => {
    const map = new Map()
    for (const row of rows) {
      const dt = new Date(row.fecha_hora)
      const dayKey = getDayKey(dt)
      if (!map.has(dayKey)) {
        map.set(dayKey, { entrada: null, salida: null })
      }
      const entry = map.get(dayKey)

      if (row.tipo === 'entrada') {
        if (
          !entry.entrada ||
          new Date(row.fecha_hora) < new Date(entry.entrada.fecha_hora)
        ) {
          entry.entrada = row
        }
      } else if (row.tipo === 'salida') {
        if (
          !entry.salida ||
          new Date(row.fecha_hora) > new Date(entry.salida.fecha_hora)
        ) {
          entry.salida = row
        }
      }
    }
    return map
  }, [rows])

  // Filtro por fechas, tipo y “solo último”
  const filteredRows = useMemo(() => {
    let out = rows

    if (fromDate) {
      const start = new Date(fromDate + 'T00:00:00')
      out = out.filter(r => new Date(r.fecha_hora) >= start)
    }
    if (toDate) {
      const end = new Date(toDate + 'T23:59:59.999')
      out = out.filter(r => new Date(r.fecha_hora) <= end)
    }

    if (tipoFilter !== 'all') {
      out = out.filter(r => r.tipo === tipoFilter)
    }

    if (onlyLast) {
      return out.length ? [out[0]] : []
    }
    return out
  }, [rows, fromDate, toDate, tipoFilter, onlyLast])

  const computeEstado = row => {
    const dt = new Date(row.fecha_hora)

    if (row.tipo === 'entrada') {
      const threshold = atTime(dt, HH_ENTRADA.h, HH_ENTRADA.m)
      const lateMs = dt.getTime() - threshold.getTime()
      if (lateMs > 0) {
        const { text } = diffToHM(lateMs)
        return { kind: 'danger', text: `Retraso ${text}` }
      }
      return { kind: 'success', text: 'A tiempo' }
    }

    if (row.tipo === 'salida') {
      const threshold = atTime(dt, HH_SALIDA.h, HH_SALIDA.m)
      const earlyMs = threshold.getTime() - dt.getTime()
      if (earlyMs > 0) {
        const { text } = diffToHM(earlyMs)
        return { kind: 'danger', text: `Salida antes ${text}` }
      }
      return { kind: 'success', text: 'Cumplida' }
    }

    return { kind: 'secondary', text: '-' }
  }

  // Horas trabajadas del día (se muestra SOLO en la fila de SALIDA)
  const computeHorasDia = row => {
    if (row.tipo !== 'salida') return '-'

    const dt = new Date(row.fecha_hora)
    const dayKey = getDayKey(dt)
    const summary = dailySummary.get(dayKey)
    if (!summary || !summary.entrada || !summary.salida) return '-'

    const startMs = new Date(summary.entrada.fecha_hora).getTime()
    const endMs = new Date(summary.salida.fecha_hora).getTime()
    const grossMs = Math.max(0, endMs - startMs)

    // Ventana de almuerzo 13:00–14:00 (solo si entra antes de 13:00 y sale después de 14:00)
    const lunchStartMs = atTime(dt, LUNCH_START.h, LUNCH_START.m).getTime()
    const lunchEndMs = atTime(dt, LUNCH_END.h, LUNCH_END.m).getTime()
    const lunchDeduction =
      startMs <= lunchStartMs && endMs >= lunchEndMs ? ONE_HOUR_MS : 0

    const workMs = Math.max(0, grossMs - lunchDeduction)
    return msToHMS(workMs) || '00s'
  }

  return (
    <div className='card mt-3'>
      <div className='card-header d-flex flex-wrap gap-2 align-items-end'>
        <div className='me-auto'>
          <strong>Historial de marcaciones</strong>
        </div>

        <div>
          <label className='form-label mb-1 small'>Tipo</label>
          <select
            className='form-select form-select-sm'
            value={tipoFilter}
            onChange={e => setTipoFilter(e.target.value)}
          >
            <option value='all'>Todos</option>
            <option value='entrada'>Entradas</option>
            <option value='salida'>Salidas</option>
          </select>
        </div>

        <div>
          <label className='form-label mb-1 small'>Desde</label>
          <input
            type='date'
            className='form-control form-control-sm'
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label className='form-label mb-1 small'>Hasta</label>
          <input
            type='date'
            className='form-control form-control-sm'
            value={toDate}
            onChange={e => setToDate(e.target.value)}
          />
        </div>

        <div className='form-check ms-2'>
          <input
            id='onlyLast'
            className='form-check-input'
            type='checkbox'
            checked={onlyLast}
            onChange={e => setOnlyLast(e.target.checked)}
          />
          <label className='form-check-label small' htmlFor='onlyLast'>
            Solo último
          </label>
        </div>

        <button
          className='btn btn-sm btn-outline-secondary ms-2'
          onClick={fetchData}
        >
          Refrescar
        </button>
      </div>

      <div className='card-body p-0'>
        {loading ? (
          <div className='p-3 text-center text-muted small'>Cargando…</div>
        ) : error ? (
          <div className='p-3 text-danger small'>{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className='p-3 text-center text-muted small'>Sin registros.</div>
        ) : (
          <div className='table-responsive'>
            <table className='table table-sm table-striped align-middle mb-0'>
              <thead className='table-light'>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Fecha / Hora</th>
                  <th>Tipo</th>
                  <th>Persona</th>
                  <th>Estado</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Horas día</th>
                  <th>—</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => {
                  const estado = computeEstado(row)
                  const horasDia = computeHorasDia(row)
                  const persona = row?.personal
                    ? `${row.personal.nombres ?? ''} ${
                        row.personal.apellidos ?? ''
                      } (${row.personal.documento ?? ''})`
                    : '-'

                  return (
                    <tr key={row.id}>
                      <td>{fmtDateTime(row.fecha_hora)}</td>
                      <td>
                        {row.tipo === 'entrada' ? (
                          <span className='badge text-bg-success'>
                            <BiLogIn className='me-1' /> Entrada
                          </span>
                        ) : (
                          <span className='badge text-bg-primary'>
                            <BiLogOut className='me-1' /> Salida
                          </span>
                        )}
                      </td>
                      <td>{persona}</td>
                      <td>
                        {estado.kind === 'success' && (
                          <span className='badge text-bg-success'>
                            {estado.text}
                          </span>
                        )}
                        {estado.kind === 'warning' && (
                          <span className='badge text-bg-warning text-dark'>
                            {estado.text}
                          </span>
                        )}
                        {estado.kind === 'danger' && (
                          <span className='badge text-bg-danger'>
                            {estado.text}
                          </span>
                        )}
                        {estado.kind === 'secondary' && (
                          <span className='badge text-bg-secondary'>
                            {estado.text}
                          </span>
                        )}
                      </td>
                      <td>{horasDia}</td>
                      <td>
                        {index === 0 && !onlyLast && (
                          <span className='badge text-bg-info'>Último</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default TablaMarcaciones
