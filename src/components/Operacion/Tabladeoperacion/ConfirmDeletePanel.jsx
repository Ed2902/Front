import React from 'react'

const ConfirmDeletePanel = ({ open, op, loading, onConfirm, onCancel }) => {
  if (!open || !op) return null
  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='confirm-del-title'
      aria-describedby='confirm-del-desc'
      style={{ position: 'fixed', inset: 0, zIndex: 2000 }}
      onKeyDown={e => {
        if (e.key === 'Escape' && !loading) onCancel?.()
      }}
    >
      <div
        onClick={!loading ? onCancel : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      <div
        className='shadow-lg rounded-3 border bg-white p-4'
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 420px)',
        }}
      >
        <h6 id='confirm-del-title' className='mb-2'>
          Eliminar operación
        </h6>
        <p id='confirm-del-desc' className='mb-3 small text-muted'>
          ¿Seguro que deseas eliminar la operación{' '}
          <strong>{op.id_operacion}</strong>? Esta acción es irreversible.
        </p>
        <div className='d-flex gap-2 justify-content-end'>
          <button
            className='btn btn-sm btn-outline-secondary'
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className='btn btn-sm btn-danger'
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDeletePanel
