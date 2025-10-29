// src/components/ControlIngresos/Marcacion/ModalJustificar.jsx
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { BiPaperclip } from 'react-icons/bi'
import { putActualizarMarcacion } from './Marcacion_service'
import SecureArchivo from '../ReporteAsistencia/SecureImage'

const pad2 = n => String(n).padStart(2, '0')
const fmtDT = iso => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad2(d.getDate())}/${pad2(
    d.getMonth() + 1
  )}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const isImagePath = p =>
  /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test((p || '').split('?')[0] || '')
const isPdfPath = p => /\.pdf(\?|$)/i.test((p || '').split('?')[0] || '')

/**
 * Props:
 * - open: boolean
 * - row: { id, tipo, efectiva, justificacion, observacion, evidencia_url }
 * - mode: 'view' | 'edit'
 * - onClose: () => void
 * - onSaved?: (updatedRow) => void   // solo en modo 'edit'
 */
const ModalJustificar = ({ open, row, mode = 'view', onClose, onSaved }) => {
  const readOnly = mode !== 'edit'

  const [just, setJust] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  // Sincroniza valores al abrir
  useEffect(() => {
    if (open && row) {
      setJust(row.justificacion || '')
      setFile(null)
      setSaving(false)
    }
  }, [open, row])

  // Bloquea el scroll del body mientras esté abierto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !row) return null

  const evidenceSrc =
    row.evidencia_url && String(row.evidencia_url).trim() !== ''
      ? row.evidencia_url
      : row.id
      ? `/app/marcacion/${row.id}/evidencia`
      : ''

  const doSave = async () => {
    try {
      setSaving(true)
      const updated = await putActualizarMarcacion(row.id, {
        // Solo enviamos lo permitido: justificación y evidencia.
        justificacion: just || undefined,
        file: file || undefined,
      })
      onSaved?.(updated)
    } catch (e) {
      console.error(e)
      alert('No se pudo guardar la justificación.')
      setSaving(false)
    }
  }

  const modalContent = (
    <div
      role='dialog'
      aria-modal='true'
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={() => !saving && onClose?.()}
    >
      <div
        className='card shadow'
        style={{
          width: 'min(92vw, 660px)',
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: '14px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className='card-body'>
          <div className='d-flex justify-content-between align-items-center mb-2'>
            <h5 className='m-0'>
              {readOnly ? 'Ver justificación' : 'Justificar marcación'}
            </h5>
            <button
              className='btn btn-sm btn-outline-secondary'
              disabled={saving}
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>

          <div className='small text-muted mb-3'>
            <strong>Marcación:</strong> #{row.id} —{' '}
            {String(row.tipo || '').replace('_', ' ')} — {fmtDT(row.efectiva)}
          </div>

          {/* Justificación */}
          <div className='mb-3'>
            <label className='form-label'>Justificación</label>
            {readOnly ? (
              <div
                className='form-control'
                style={{ minHeight: 80, whiteSpace: 'pre-wrap' }}
              >
                {just ? (
                  just
                ) : (
                  <span className='text-muted'>Sin justificación</span>
                )}
              </div>
            ) : (
              <>
                <textarea
                  className='form-control'
                  rows={3}
                  maxLength={500}
                  value={just}
                  onChange={e => setJust(e.target.value)}
                  disabled={saving}
                  placeholder='Motivo de llegada tarde / salida anticipada…'
                />
                <div className='form-text text-end'>{just.length}/500</div>
              </>
            )}
          </div>

          {/* Observación (solo visualización si existe) */}
          {readOnly && (row.observacion ?? '') !== '' && (
            <div className='mb-3'>
              <label className='form-label'>Observación</label>
              <div className='form-control' style={{ whiteSpace: 'pre-wrap' }}>
                {row.observacion}
              </div>
            </div>
          )}

          {/* Evidencia */}
          <div className='mb-3'>
            <label className='form-label'>
              {readOnly ? (
                'Evidencia'
              ) : (
                <>
                  Evidencia (opcional) <BiPaperclip />
                </>
              )}
            </label>

            {evidenceSrc ? (
              isImagePath(evidenceSrc) ? (
                // Imagen: preview + abrir
                <div className='mb-2'>
                  <SecureArchivo
                    src={evidenceSrc}
                    preview={true}
                    mode='open'
                    alt='Evidencia'
                    height={180}
                  >
                    <span className='btn btn-sm btn-outline-secondary'>
                      Abrir evidencia
                    </span>
                  </SecureArchivo>
                </div>
              ) : (
                // PDF u otros: sin preview, pero indicamos claramente que hay archivo
                <div className='border rounded p-3 bg-light d-flex align-items-center justify-content-between'>
                  <span className='text-muted small'>
                    Archivo adjunto disponible
                    {isPdfPath(evidenceSrc) ? ' (PDF)' : ''}. No hay vista
                    previa.
                  </span>
                  <SecureArchivo src={evidenceSrc} mode='open'>
                    <span className='btn btn-sm btn-outline-secondary'>
                      Abrir evidencia
                    </span>
                  </SecureArchivo>
                </div>
              )
            ) : (
              <div className='text-muted'>Sin evidencia adjunta</div>
            )}

            {/* Input de archivo solo en edición */}
            {!readOnly && (
              <input
                type='file'
                className='form-control mt-2'
                accept='.pdf,image/*'
                onChange={e => setFile(e.target.files?.[0] || null)}
                disabled={saving}
              />
            )}
          </div>

          {!readOnly && (
            <div className='d-flex justify-content-end gap-2'>
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
                disabled={saving || (!just && !file)}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return ReactDOM.createPortal(modalContent, document.body)
}

export default ModalJustificar
