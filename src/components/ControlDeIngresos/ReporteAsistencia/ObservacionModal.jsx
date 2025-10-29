import React from 'react'

const ObservacionModal = ({
  open,
  value,
  saving,
  onChange,
  onCancel,
  onSave,
}) => {
  if (!open) return null

  return (
    <div className='modal show d-block' tabIndex='-1'>
      <div className='modal-dialog'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>Editar observación</h5>
            <button type='button' className='btn-close' onClick={onCancel} />
          </div>
          <div className='modal-body'>
            <textarea
              className='form-control'
              rows={4}
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder='Escribe o edita una observación…'
            />
          </div>
          <div className='modal-footer'>
            <button className='btn btn-secondary' onClick={onCancel}>
              Cancelar
            </button>
            <button
              className='btn btn-primary'
              disabled={saving}
              onClick={onSave}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ObservacionModal
