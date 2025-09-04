// src/components/ControlIngresos/ReporteAsistencia/ReporteAsistencia.jsx
import { useMemo, useState } from 'react'
import ReporteDetalleDiario from './ReporteDetalleDiario'
import ReporteResumenPersona from './ReporteResumenPersona'

// === Helpers de fecha LOCAL (YYYY-MM-DD) ===
const ymdLocal = (d = new Date()) => {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const hoyISO = () => ymdLocal()

const primerDiaMesISO = () => {
  const d = new Date()
  d.setDate(1)
  return ymdLocal(d)
}

const lunesDeEstaSemanaISO = () => {
  const d = new Date()
  // getDay(): 0=domingo, 1=lunes,...; convertir domingo a 7 para cálculo
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (dow - 1)) // retrocede hasta el lunes
  return ymdLocal(d)
}

const ReporteAsistencia = () => {
  const [mode, setMode] = useState('detalle') // 'detalle' | 'resumen'
  const [from, setFrom] = useState(primerDiaMesISO())
  const [to, setTo] = useState(hoyISO())
  const [tolerancia, setTolerancia] = useState(0)

  // Presets rápidos
  const setHoy = () => {
    const t = hoyISO()
    setFrom(t)
    setTo(t)
  }
  const setSemana = () => {
    setFrom(lunesDeEstaSemanaISO())
    setTo(hoyISO())
  }
  const setMes = () => {
    setFrom(primerDiaMesISO())
    setTo(hoyISO())
  }

  const filtros = useMemo(
    () => ({ from, to, toleranciaRetrasoMin: Number(tolerancia) || 0 }),
    [from, to, tolerancia]
  )

  return (
    <div className='container-fluid py-3'>
      <div className='d-flex flex-wrap gap-2 align-items-end mb-3'>
        <h4 className='me-auto mb-0'>Reporte de Asistencia</h4>

        <div className='d-flex align-items-center'>
          <label className='form-label mb-0 small me-2'>Vista</label>
          <div className='btn-group'>
            <button
              className={`btn btn-sm btn-${
                mode === 'detalle' ? 'primary' : 'outline-primary'
              }`}
              onClick={() => setMode('detalle')}
            >
              Detalle diario
            </button>
            <button
              className={`btn btn-sm btn-${
                mode === 'resumen' ? 'primary' : 'outline-primary'
              }`}
              onClick={() => setMode('resumen')}
            >
              Resumen por persona
            </button>
          </div>
        </div>

        <div>
          <label className='form-label mb-1 small'>Desde</label>
          <input
            type='date'
            className='form-control form-control-sm'
            value={from}
            onChange={e => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className='form-label mb-1 small'>Hasta</label>
          <input
            type='date'
            className='form-control form-control-sm'
            value={to}
            onChange={e => setTo(e.target.value)}
          />
        </div>

        <div>
          <label className='form-label mb-1 small'>
            Tolerancia retraso (min)
          </label>
          <input
            type='number'
            min={0}
            className='form-control form-control-sm'
            value={tolerancia}
            onChange={e => setTolerancia(e.target.value)}
            placeholder='0'
          />
        </div>

        <div className='btn-group'>
          <button className='btn btn-sm btn-outline-secondary' onClick={setHoy}>
            Hoy
          </button>
          <button
            className='btn btn-sm btn-outline-secondary'
            onClick={setSemana}
          >
            Semana
          </button>
          <button className='btn btn-sm btn-outline-secondary' onClick={setMes}>
            Mes
          </button>
        </div>
      </div>

      {mode === 'detalle' ? (
        <ReporteDetalleDiario filtros={filtros} />
      ) : (
        <ReporteResumenPersona filtros={filtros} />
      )}
    </div>
  )
}

export default ReporteAsistencia
