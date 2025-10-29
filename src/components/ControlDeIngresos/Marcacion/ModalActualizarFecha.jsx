// src/components/ControlIngresos/Marcacion/ModalActualizarFecha.jsx
import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'
import { putActualizarFechaMarcacion } from './Marcacion_service'

const pad2 = n => String(n).padStart(2, '0')

const ModalActualizarFecha = ({ open, row, onClose, onSaved }) => {
  const [dateStr, setDateStr] = useState('')
  const [timeStr, setTimeStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // --- Backdrop y cierre con ESC ---
  useEffect(() => {
    if (!open) return
    const onKey = e => {
      if (e.key === 'Escape' && !saving) onClose?.()
    }
    document.body.classList.add('modal-open')
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('modal-open')
      document.removeEventListener('keydown', onKey)
    }
  }, [open, saving, onClose])

  // --- Valores iniciales ---
  useEffect(() => {
    if (open && row) {
      const d = new Date(
        row.efectiva || row.creado_en || row.fecha_hora || Date.now()
      )
      setDateStr(
        `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
      )
      setTimeStr(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`)
      setError('')
      setSaving(false)
    }
  }, [open, row])

  const previewText = useMemo(() => {
    if (!dateStr || !timeStr) return '—'
    try {
      const d = new Date(`${dateStr}T${timeStr}:00`)
      return d.toLocaleString('es-CO')
    } catch {
      return '—'
    }
  }, [dateStr, timeStr])

  if (!open || !row) return null

  const validate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      setError('Completa la fecha (YYYY-MM-DD).')
      return false
    }
    if (!/^\d{2}:\d{2}$/.test(timeStr)) {
      setError('Completa la hora (HH:MM).')
      return false
    }
    setError('')
    return true
  }

  const doSave = async () => {
    if (!validate()) return
    try {
      setSaving(true)
      const updated = await putActualizarFechaMarcacion(row.id, {
        fecha_manual: dateStr,
        hora_manual: timeStr,
      })
      const merged = {
        ...row,
        ...updated,
        efectiva: updated?.creado_en || updated?.fecha_hora,
      }
      onSaved?.(merged)
    } catch (e) {
      console.error(e)
      setError('No se pudo actualizar la fecha/hora.')
      setSaving(false)
    }
  }

  // --- Helpers ---
  const applyDateDelta = days => {
    if (!dateStr) return
    const d = new Date(`${dateStr}T${timeStr || '00:00'}:00`)
    d.setDate(d.getDate() + days)
    setDateStr(
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    )
  }
  const setToday = () => {
    const d = new Date()
    setDateStr(
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    )
  }
  const applyMinuteDelta = mins => {
    const base = `${dateStr || new Date().toISOString().slice(0, 10)}T${
      timeStr || '00:00'
    }:00`
    const d = new Date(base)
    d.setMinutes(d.getMinutes() + mins)
    setDateStr(
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    )
    setTimeStr(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`)
  }

  const quickTimes = ['07:45', '12:00', '13:00', '17:30']

  return ReactDOM.createPortal(
    <>
      <div className='modal-backdrop fade show' />
      <div
        className='modal fade show'
        style={{ display: 'block' }}
        role='dialog'
        aria-modal='true'
        onMouseDown={e => {
          if (!saving && e.target.classList.contains('modal')) onClose?.()
        }}
      >
        <div className='modal-dialog modal-dialog-centered modal-lg'>
          <div className='modal-content'>
            <div className='modal-header'>
              <h5 className='modal-title'>Actualizar fecha y hora</h5>
              <button
                type='button'
                className='btn-close'
                onClick={onClose}
                disabled={saving}
              />
            </div>

            <div className='modal-body'>
              <div className='small text-muted mb-3'>
                <strong>Marcación:</strong> #{row.id} —{' '}
                {String(row.tipo).replace('_', ' ')} —{' '}
                {row.efectiva ? new Date(row.efectiva).toLocaleString() : '—'}
              </div>

              {error && <div className='alert alert-warning py-2'>{error}</div>}

              <div className='row g-4'>
                {/* FECHA */}
                <div className='col-12 col-md-6'>
                  <label className='form-label fw-semibold'>Fecha</label>
                  <input
                    type='date'
                    className='form-control form-control-lg'
                    value={dateStr}
                    onChange={e => setDateStr(e.target.value)}
                    disabled={saving}
                  />
                  <div className='d-flex flex-wrap gap-2 mt-2'>
                    <button
                      className='btn btn-outline-secondary btn-sm'
                      onClick={() => applyDateDelta(-1)}
                      disabled={saving}
                    >
                      −1 día
                    </button>
                    <button
                      className='btn btn-outline-primary btn-sm'
                      onClick={setToday}
                      disabled={saving}
                    >
                      Hoy
                    </button>
                    <button
                      className='btn btn-outline-secondary btn-sm'
                      onClick={() => applyDateDelta(1)}
                      disabled={saving}
                    >
                      +1 día
                    </button>
                  </div>
                </div>

                {/* HORA - centrada, más limpia */}
                <div className='col-12 col-md-6'>
                  <label className='form-label fw-semibold'>Hora</label>
                  <div className='text-center'>
                    <input
                      type='time'
                      className='form-control form-control-lg text-center mx-auto'
                      style={{ maxWidth: 220, fontSize: '1.5rem' }}
                      step='60'
                      value={timeStr}
                      onChange={e => setTimeStr(e.target.value)}
                      disabled={saving}
                    />
                  </div>

                  {/* Ajustes rápidos */}
                  <div className='d-flex flex-wrap justify-content-center gap-2 mt-3'>
                    <button
                      className='btn btn-outline-secondary btn-sm'
                      onClick={() => applyMinuteDelta(-15)}
                      disabled={saving}
                    >
                      −15 min
                    </button>
                    <button
                      className='btn btn-outline-secondary btn-sm'
                      onClick={() => applyMinuteDelta(-5)}
                      disabled={saving}
                    >
                      −5 min
                    </button>
                    <button
                      className='btn btn-outline-secondary btn-sm'
                      onClick={() => applyMinuteDelta(5)}
                      disabled={saving}
                    >
                      +5 min
                    </button>
                    <button
                      className='btn btn-outline-secondary btn-sm'
                      onClick={() => applyMinuteDelta(15)}
                      disabled={saving}
                    >
                      +15 min
                    </button>
                  </div>

                  {/* Sugerencias comunes */}
                  <div className='d-flex flex-wrap justify-content-center gap-2 mt-3'>
                    {quickTimes.map(t => (
                      <button
                        key={t}
                        className={`btn btn-outline-dark btn-sm ${
                          timeStr === t ? 'active' : ''
                        }`}
                        onClick={() => setTimeStr(t)}
                        disabled={saving}
                        style={{ minWidth: 80 }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className='border rounded p-3 mt-4 bg-light'>
                <div className='fw-semibold'>Previsualización</div>
                <div className='fs-5'>{previewText}</div>
                <small className='text-muted'>
                  Zona: America/Bogota (UTC-5)
                </small>
              </div>
            </div>

            <div className='modal-footer'>
              <button
                className='btn btn-light'
                onClick={onClose}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className='btn btn-primary'
                onClick={doSave}
                disabled={saving}
              >
                {saving ? 'Actualizando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

export default ModalActualizarFecha
