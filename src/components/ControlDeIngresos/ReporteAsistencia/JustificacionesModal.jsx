// src/components/ControlIngresos/Marcacion/JustificacionesModal.jsx
import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import SecureArchivo from './SecureImage' // ajusta ruta si difiere

const isImagePath = (p = '') =>
  /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(String(p).split('?')[0] || '')
const isPdfPath = (p = '') => /\.pdf$/i.test(String(p).split('?')[0] || '')
const normalizeRel = (src = '') =>
  String(src).replace(/\\/g, '/').replace(/^\/+/, '')

function ModalContent({ loading, entrada, salida, onClose }) {
  const renderEvidencia = (label, rawUrl) => {
    if (!rawUrl) return null
    const relSrc = normalizeRel(rawUrl)
    const tipo = isImagePath(relSrc)
      ? 'image'
      : isPdfPath(relSrc)
      ? 'pdf'
      : 'other'
    const filename =
      (relSrc.split('/').pop() || `evidencia-${label}`).split('?')[0] ||
      `evidencia-${label}`

    return (
      <div className='flex flex-col gap-2'>
        {/* Preview fija en alto para que no “salte” */}
        <SecureArchivo
          src={relSrc}
          preview={tipo === 'image'}
          alt={`Justificación ${label}`}
          height={260}
        />
        {/* Acciones */}
        <div className='flex flex-wrap items-center gap-2'>
          <SecureArchivo src={relSrc} mode='download' filename={filename}>
            <button type='button' className='btn btn-outline-secondary btn-sm'>
              Descargar
            </button>
          </SecureArchivo>
          <SecureArchivo src={relSrc} mode='open'>
            <span className='small text-decoration-underline'>
              Abrir en nueva pestaña
            </span>
          </SecureArchivo>
        </div>
        {/* Etiqueta tipo cuando no es imagen */}
        {tipo !== 'image' && (
          <div className='border rounded p-3 small bg-light'>
            {tipo === 'pdf' ? 'Archivo PDF' : 'Archivo adjunto'}
            <div className='text-truncate mt-1' title={filename}>
              {filename}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderCol = (titulo, item) => (
    <div className='col'>
      <h6 className='mb-3'>{titulo}</h6>
      {!item ? (
        <div className='text-muted small'>Sin justificación.</div>
      ) : (
        <div className='d-flex flex-column gap-3'>
          {item.texto && (
            <div>
              <strong>Texto:</strong>
              <div
                className='mt-1 p-2 border rounded bg-light'
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 280,
                  overflowY: 'auto',
                }}
              >
                {item.texto}
              </div>
            </div>
          )}
          {item.imagen_url && renderEvidencia(titulo, item.imagen_url)}
          {!item.texto && !item.imagen_url && (
            <div className='text-muted small'>
              Sin información de justificación.
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div
      role='dialog'
      aria-modal='true'
      className='position-fixed top-0 start-0 w-100 h-100'
      style={{ zIndex: 1055 }}
    >
      {/* Backdrop fijo a pantalla */}
      <div
        className='position-fixed top-0 start-0 w-100 h-100'
        style={{ background: 'rgba(0,0,0,.5)' }}
        onClick={onClose}
      />

      {/* Contenedor centrado fullscreen con padding */}
      <div
        className='position-fixed top-50 start-50 translate-middle w-100'
        style={{ maxWidth: '1200px', padding: '16px' }}
      >
        <div
          className='card shadow-lg'
          style={{ borderRadius: 16, maxHeight: '90vh', display: 'flex' }}
        >
          <div
            className='card-header d-flex align-items-center'
            style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
          >
            <h5 className='mb-0'>Justificaciones</h5>
            <button
              type='button'
              className='btn-close ms-auto'
              onClick={onClose}
              aria-label='Cerrar'
            />
          </div>

          {/* Cuerpo en layout horizontal: dos columnas lado a lado */}
          <div className='card-body' style={{ overflow: 'auto' }}>
            {loading ? (
              <div className='text-muted'>Cargando…</div>
            ) : (
              <div
                className='row'
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '24px',
                }}
              >
                {renderCol('Entrada', entrada)}
                {renderCol('Salida', salida)}
              </div>
            )}
          </div>

          <div
            className='card-footer d-flex justify-content-end'
            style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
          >
            <button className='btn btn-secondary' onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function JustificacionesModal({
  open,
  loading,
  entrada,
  salida,
  onClose,
}) {
  // Bloquea scroll de fondo
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <ModalContent
      loading={loading}
      entrada={entrada}
      salida={salida}
      onClose={onClose}
    />,
    document.body
  )
}
