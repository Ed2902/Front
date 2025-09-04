import { useEffect, useState } from 'react'
import { utils, writeFile } from 'xlsx'
import { getReporteDetalleDiario } from './reporte_asistencia_service'

const pad2 = n => String(n).padStart(2, '0')
const fmtHM = iso => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const ReporteDetalleDiario = ({ filtros = {} }) => {
  const { from = '', to = '', toleranciaRetrasoMin = 0 } = filtros || {}

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getReporteDetalleDiario({
          from,
          to,
          toleranciaRetrasoMin,
        })
        setRows(data)
      } catch (err) {
        console.error(err)
        setError('No se pudo cargar el detalle diario.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [from, to, toleranciaRetrasoMin])

  const exportar = () => {
    const wb = utils.book_new()
    const ws = utils.json_to_sheet(
      rows.map(d => ({
        Fecha: d.fecha,
        Documento: d.persona.documento,
        Nombre: `${d.persona.nombres} ${d.persona.apellidos}`.trim(),
        Entrada: d.entrada ? fmtHM(d.entrada) : '',
        Salida: d.salida ? fmtHM(d.salida) : '',
        'Horas día (HH:MM:SS)': d.horasDiaHMS,
        'Retraso (min)': d.retrasoMin,
        'Salida antes (min)': d.salidaAntesMin,
        Novedad: d.novedad,
      }))
    )
    utils.book_append_sheet(wb, ws, 'Detalle')
    writeFile(
      wb,
      `Detalle_Asistencia_${from || 'inicio'}_a_${to || 'fin'}.xlsx`
    )
  }

  return (
    <div className='card'>
      <div className='card-header d-flex justify-content-between align-items-center'>
        <strong>Detalle diario</strong>
        <button
          className='btn btn-sm btn-success'
          onClick={exportar}
          disabled={loading || rows.length === 0}
        >
          Exportar Excel
        </button>
      </div>
      <div className='card-body p-0'>
        {loading ? (
          <div className='p-3 text-center text-muted small'>Cargando…</div>
        ) : error ? (
          <div className='p-3 text-danger small'>{error}</div>
        ) : rows.length === 0 ? (
          <div className='p-3 text-center text-muted small'>Sin datos.</div>
        ) : (
          <div className='table-responsive'>
            <table className='table table-sm table-striped align-middle mb-0'>
              <thead className='table-light'>
                <tr>
                  <th>Fecha</th>
                  <th>Documento</th>
                  <th>Nombre</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Horas día</th>
                  <th>Retraso (min)</th>
                  <th>Salida antes (min)</th>
                  <th>Novedad</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d, i) => (
                  <tr key={`${d.persona.documento}-${d.fecha}-${i}`}>
                    <td>{d.fecha}</td>
                    <td>{d.persona.documento}</td>
                    <td>
                      {`${d.persona.nombres} ${d.persona.apellidos}`.trim()}
                    </td>
                    <td>{d.entrada ? fmtHM(d.entrada) : ''}</td>
                    <td>{d.salida ? fmtHM(d.salida) : ''}</td>
                    <td>{d.horasDiaHMS}</td>
                    <td>{d.retrasoMin}</td>
                    <td>{d.salidaAntesMin}</td>
                    <td>{d.novedad}</td>
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

export default ReporteDetalleDiario
