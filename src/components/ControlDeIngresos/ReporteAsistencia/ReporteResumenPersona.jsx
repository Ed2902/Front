// src/components/ControlIngresos/ReporteAsistencia/ReporteResumenPersona.jsx
import { useEffect, useMemo, useState } from 'react'
import { utils, writeFile } from 'xlsx'
import { getReporteResumenPorPersona } from './reporte_asistencia_service'

// Referencia estable para default (no crea {} en cada render)
const DEFAULT_HORAS_SEMANALES = Object.freeze({})

const ReporteResumenPersona = ({ filtros = {} }) => {
  // fallbacks sin crear objetos nuevos en cada render
  const from = filtros?.from ?? ''
  const to = filtros?.to ?? ''
  const toleranciaRetrasoMin = filtros?.toleranciaRetrasoMin ?? 0
  const horasSemanalesPorDoc =
    filtros?.horasSemanalesPorDoc ?? DEFAULT_HORAS_SEMANALES

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Filtro local: mínimo de días con retraso
  const [minDiasRetraso, setMinDiasRetraso] = useState(0)

  // Clave estable para detectar cambios REALES del objeto
  const horasKey = useMemo(
    () => JSON.stringify(horasSemanalesPorDoc),
    [horasSemanalesPorDoc]
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getReporteResumenPorPersona({
          from,
          to,
          toleranciaRetrasoMin,
          horasSemanalesPorDoc,
        })
        if (!cancelled) setRows(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
        if (!cancelled) setError('No se pudo cargar el resumen por persona.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // 👇 Dependencias PRIMITIVAS + clave estable del objeto
  }, [from, to, toleranciaRetrasoMin, horasKey, horasSemanalesPorDoc])

  const filteredRows = useMemo(() => {
    const min = Number(minDiasRetraso) || 0
    if (min <= 0) return rows
    return rows.filter(r => (r?.diasRetraso ?? 0) >= min)
  }, [rows, minDiasRetraso])

  const exportar = () => {
    const wb = utils.book_new()
    const ws = utils.json_to_sheet(
      filteredRows.map(r => ({
        Documento: r.persona.documento,
        Nombre: `${r.persona.nombres} ${r.persona.apellidos}`.trim(),
        Días: r.dias,
        'Horas totales (HH:MM:SS)': r.horasHMS,
        'Retraso total (min)': r.retrasoMin,
        'Días con retraso': r.diasRetraso,
        'Salida antes total (min)': r.salidaAntesMin,
        'Días salida antes': r.diasSalidaAntes,
        'Días a tiempo': r.diasATiempo,
        'Días incompletos': r.diasIncompletos,
      }))
    )
    utils.book_append_sheet(wb, ws, 'Resumen')
    writeFile(
      wb,
      `Resumen_Asistencia_${from || 'inicio'}_a_${to || 'fin'}.xlsx`
    )
  }

  return (
    <div className='card'>
      <div className='card-header d-flex flex-wrap gap-2 align-items-end'>
        <strong className='me-auto'>Resumen por persona</strong>

        <div>
          <label className='form-label mb-1 small'>Mín. días con retraso</label>
          <input
            type='number'
            min={0}
            className='form-control form-control-sm'
            value={minDiasRetraso}
            onChange={e => setMinDiasRetraso(e.target.value)}
            placeholder='0'
            style={{ width: 120 }}
          />
        </div>

        <button
          className='btn btn-sm btn-success'
          onClick={exportar}
          disabled={loading || filteredRows.length === 0}
        >
          Exportar Excel
        </button>
      </div>

      <div className='card-body p-0'>
        {loading ? (
          <div className='p-3 text-center text-muted small'>Cargando…</div>
        ) : error ? (
          <div className='p-3 text-danger small'>{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className='p-3 text-center text-muted small'>Sin datos.</div>
        ) : (
          <div className='table-responsive'>
            <table className='table table-sm table-striped align-middle mb-0'>
              <thead className='table-light'>
                <tr>
                  <th>Documento</th>
                  <th>Nombre</th>
                  <th>Días</th>
                  <th>Horas totales</th>
                  <th>Retraso (min)</th>
                  <th>Días con retraso</th>
                  <th>Salida antes (min)</th>
                  <th>Días salida antes</th>
                  <th>A tiempo</th>
                  <th>Incompletos</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(r => (
                  <tr key={r.persona.documento}>
                    <td>{r.persona.documento}</td>
                    <td>
                      {`${r.persona.nombres} ${r.persona.apellidos}`.trim()}
                    </td>
                    <td>{r.dias}</td>
                    <td>{r.horasHMS}</td>
                    <td>{r.retrasoMin}</td>
                    <td>{r.diasRetraso}</td>
                    <td>{r.salidaAntesMin}</td>
                    <td>{r.diasSalidaAntes}</td>
                    <td>{r.diasATiempo}</td>
                    <td>{r.diasIncompletos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReporteResumenPersona
