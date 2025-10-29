// src/components/ControlIngresos/Marcacion/ModalMarcacionManual.jsx
import React, { useEffect, useRef, useState } from 'react'
import Webcam from 'react-webcam'

const pad2 = n => String(n).padStart(2, '0')
const todayCO = () => {
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000
  const co = new Date(utcMs - 5 * 60 * 60000)
  const y = co.getFullYear()
  const m = pad2(co.getMonth() + 1)
  const d = pad2(co.getDate())
  return `${y}-${m}-${d}`
}
const defaultHour = '07:45'

// util local para convertir screenshot base64 a File
const dataURLtoFile = (dataUrl, filename) => {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new File([u8arr], filename, { type: mime })
}

/**
 * Modal de marcación manual con cámara integrada.
 *
 * Props:
 *  - open: boolean
 *  - data: { fecha_manual, hora_manual, justificacion, evidenciaFile }
 *  - onChange: (patch) => void
 *  - onClose: () => void
 *  - onSubmitTipo: (tipo, selfieFile) => void   // ← envía tipo + selfie
 *  - busy: boolean
 */
const ModalMarcacionManual = ({
  open,
  data,
  onChange,
  onClose,
  onSubmitTipo,
  busy = false,
}) => {
  const [touched, setTouched] = useState(false)
  const webcamRef = useRef(null)
  const [camError, setCamError] = useState('')

  useEffect(() => {
    if (open) {
      setTouched(false)
      setCamError('')
    }
  }, [open])

  // Al abrir, si no hay valores iniciales en el state, setéalos
  useEffect(() => {
    if (!open) return
    const patch = {}
    if (!data?.fecha_manual) patch.fecha_manual = todayCO()
    if (!data?.hora_manual) patch.hora_manual = defaultHour
    if (Object.keys(patch).length) onChange?.(patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const { fecha_manual, hora_manual, justificacion, evidenciaFile } = data || {}

  const isFileLike =
    (typeof File !== 'undefined' && evidenciaFile instanceof File) ||
    (evidenciaFile &&
      typeof evidenciaFile === 'object' &&
      'name' in evidenciaFile)

  const validForm =
    !!fecha_manual &&
    !!hora_manual &&
    !!justificacion &&
    justificacion.trim().length >= 5 &&
    isFileLike

  const disabledMsg = !validForm
    ? 'Completa fecha, hora, justificación y evidencia para habilitar los botones.'
    : undefined

  const handleFile = e => {
    const f = e.target.files?.[0] || null
    onChange?.({ evidenciaFile: f })
  }

  // Captura selfie desde la webcam del modal
  const captureSelfie = () => {
    try {
      const shot = webcamRef.current?.getScreenshot()
      if (!shot) return null
      return {
        file: dataURLtoFile(shot, `marcacion_${Date.now()}.jpg`),
        preview: shot,
      }
    } catch (err) {
      console.error('No se pudo capturar la selfie', err)
      return null
    }
  }

  const handleSubmitTipo = tipo => {
    if (!validForm || busy) return
    const cap = captureSelfie()
    if (!cap?.file) {
      setCamError(
        'No se pudo capturar la imagen de la cámara. Verifica permisos o intenta nuevamente.'
      )
      return
    }
    setCamError('')
    onSubmitTipo?.(tipo, cap.file, cap.preview)
  }

  const TipoButton = ({ tipo, className, children }) => (
    <button
      type='button'
      className={className}
      onClick={() => handleSubmitTipo(tipo)}
      disabled={!validForm || busy}
      title={disabledMsg || `Registrar ${children}`}
    >
      {busy ? 'Procesando…' : children}
    </button>
  )

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='manual-title'
      style={{ position: 'fixed', inset: 0, zIndex: 3000 }}
      onKeyDown={e => {
        if (e.key === 'Escape' && !busy) onClose?.()
      }}
    >
      {/* Fondo */}
      <div
        onClick={!busy ? onClose : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
        }}
      />

      {/* Contenido */}
      <div
        className='shadow-lg rounded-3 border bg-white'
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(96vw, 900px)',
          maxHeight: '92vh',
          overflow: 'auto',
        }}
      >
        <div className='p-3 border-bottom d-flex align-items-center justify-content-between'>
          <h5 id='manual-title' className='m-0'>
            Marcación manual (fecha/hora + justificación)
          </h5>
          <button
            className='btn btn-sm btn-outline-secondary'
            onClick={onClose}
            disabled={busy}
            aria-label='Cerrar'
          >
            Cerrar
          </button>
        </div>

        <div className='p-3'>
          <div className='row g-3'>
            {/* Cámara a la izquierda, formulario a la derecha */}
            <div className='col-12 col-lg-5'>
              <div className='mb-2 text-muted small'>Cámara</div>
              <div
                className='rounded overflow-hidden bg-dark'
                style={{ width: '100%', aspectRatio: '4 / 3' }}
              >
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat='image/jpeg'
                  videoConstraints={{ facingMode: 'user' }}
                  className='w-100 h-100'
                  style={{ objectFit: 'cover' }}
                />
              </div>
              {camError && (
                <div className='alert alert-danger py-2 mt-2 mb-0'>
                  {camError}
                </div>
              )}
              <div className='form-text'>
                La selfie se tomará automáticamente al presionar un botón.
              </div>
            </div>

            <div className='col-12 col-lg-7'>
              <div className='row g-3'>
                <div className='col-12 col-md-6'>
                  <label className='form-label'>Fecha (YYYY-MM-DD)</label>
                  <input
                    type='date'
                    className='form-control'
                    value={fecha_manual || todayCO()}
                    onChange={e => onChange?.({ fecha_manual: e.target.value })}
                    disabled={busy}
                    max={todayCO()}
                  />
                </div>
                <div className='col-12 col-md-6'>
                  <label className='form-label'>Hora (HH:MM)</label>
                  <input
                    type='time'
                    className='form-control'
                    value={hora_manual || defaultHour}
                    onChange={e => onChange?.({ hora_manual: e.target.value })}
                    disabled={busy}
                  />
                </div>
                <div className='col-12'>
                  <label className='form-label'>Evidencia (imagen o PDF)</label>
                  <input
                    type='file'
                    accept='image/*,.pdf'
                    className='form-control'
                    onChange={handleFile}
                    disabled={busy}
                  />
                  {isFileLike && (
                    <div className='form-text mt-1'>
                      Archivo seleccionado:{' '}
                      <strong>{evidenciaFile?.name}</strong>
                    </div>
                  )}
                </div>
                <div className='col-12'>
                  <label className='form-label'>Justificación</label>
                  <textarea
                    className='form-control'
                    rows={3}
                    placeholder='Describe brevemente el motivo (mín. 5 caracteres)'
                    value={justificacion || ''}
                    onChange={e =>
                      onChange?.({ justificacion: e.target.value })
                    }
                    onBlur={() => setTouched(true)}
                    disabled={busy}
                  />
                  {touched &&
                    (!justificacion || justificacion.trim().length < 5) && (
                      <div className='text-danger small mt-1'>
                        Ingresa al menos 5 caracteres.
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className='mt-4'>
            <div className='d-flex flex-wrap justify-content-center gap-2'>
              <TipoButton tipo='entrada' className='btn btn-success'>
                ENTRADA
              </TipoButton>
              <TipoButton tipo='salida' className='btn btn-danger'>
                SALIDA
              </TipoButton>
              <TipoButton tipo='on_almuerzo' className='btn btn-warning'>
                IR A ALMUERZO
              </TipoButton>
              <TipoButton
                tipo='off_almuerzo'
                className='btn btn-outline-warning'
              >
                ACABAR ALMUERZO
              </TipoButton>
            </div>
            {!validForm && (
              <div className='text-center text-muted small mt-2'>
                {disabledMsg}
              </div>
            )}
          </div>
        </div>

        <div className='p-3 border-top d-flex justify-content-end gap-2'>
          <button className='btn btn-light' onClick={onClose} disabled={busy}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalMarcacionManual
