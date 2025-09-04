// src/components/Terceros/Externos/form_personalexterno.jsx

import { useEffect, useState } from 'react'
import { crearExterno, actualizarExterno } from './serviceexterno'

/** Panel de confirmación centrado (modal liviano) */
const ConfirmSavePanel = ({
  open,
  loading,
  mode,
  datos,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null
  const titulo =
    mode === 'edit'
      ? `Actualizar ${datos?.id_externo || ''}`
      : 'Crear personal externo'
  const desc =
    mode === 'edit'
      ? `¿Deseas actualizar los datos de ${datos?.nombre} ${datos?.apellidos}?`
      : `¿Deseas crear el registro de ${datos?.nombre} ${datos?.apellidos}?`

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='confirm-save-title'
      aria-describedby='confirm-save-desc'
      style={{ position: 'fixed', inset: 0, zIndex: 2000 }}
      onKeyDown={e => {
        if (e.key === 'Escape' && !loading) onCancel?.()
      }}
    >
      {/* Backdrop */}
      <div
        onClick={!loading ? onCancel : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      {/* Card centrada */}
      <div
        className='shadow-lg rounded-3 border bg-white p-4'
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 480px)',
        }}
      >
        <h6 id='confirm-save-title' className='mb-2'>
          {titulo}
        </h6>
        <p id='confirm-save-desc' className='mb-3 small text-muted'>
          {desc}
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
            className='btn btn-sm btn-primary'
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const FormPersonalExterno = ({
  mode = 'create',
  initialData = null,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    id_externo: '',
    nombre: '',
    apellidos: '',
    edad: '',
    eps: '',
    arl: '',
    telefono: '',
    cargo: '',
  })

  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Precarga en modo edición
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        id_externo: initialData.id_externo ?? '',
        nombre: initialData.nombre ?? '',
        apellidos: initialData.apellidos ?? '',
        edad: initialData.edad ?? '',
        eps: initialData.eps ?? '',
        arl: initialData.arl ?? '',
        telefono: initialData.telefono ?? '',
        cargo: initialData.cargo ?? '',
      })
    }
  }, [mode, initialData])

  const handleChange = e => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Abre confirmación en vez de enviar directo
  const handleSubmit = e => {
    e.preventDefault()
    setErrorMsg('')
    setConfirmOpen(true)
  }

  // Envía al backend tras confirmar
  const doSubmit = async () => {
    try {
      setSaving(true)
      const payload = {
        id_externo: String(formData.id_externo).trim(),
        nombre: String(formData.nombre).trim(),
        apellidos: String(formData.apellidos).trim(),
        edad: formData.edad === '' ? null : Number(formData.edad),
        eps: String(formData.eps).trim(),
        arl: String(formData.arl).trim(),
        telefono: String(formData.telefono).trim(),
        cargo: String(formData.cargo).trim(),
      }

      if (mode === 'edit') {
        // ✅ usar la función correcta del servicio
        await actualizarExterno(payload.id_externo, payload)
      } else {
        // ✅ usar la función correcta del servicio
        await crearExterno(payload)
      }

      setSaving(false)
      setConfirmOpen(false)
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error(err)
      setSaving(false)
      setErrorMsg(
        err?.response?.data?.message ||
          err?.message ||
          'No se pudo guardar el registro.'
      )
      setConfirmOpen(false)
    }
  }

  return (
    <>
      {/* Confirmación previa al envío */}
      <ConfirmSavePanel
        open={confirmOpen}
        loading={saving}
        mode={mode}
        datos={formData}
        onConfirm={doSubmit}
        onCancel={() => setConfirmOpen(false)}
      />

      <h4 className='mb-3'>
        {mode === 'edit'
          ? 'Actualizar Personal Externo'
          : 'Agregar Personal Externo'}
      </h4>

      {errorMsg && <div className='alert alert-danger py-2'>{errorMsg}</div>}

      <form onSubmit={handleSubmit}>
        <div className='row'>
          <div className='col-md-4 mb-3'>
            <label className='form-label'>ID Externo</label>
            <input
              type='text'
              className='form-control'
              name='id_externo'
              value={formData.id_externo}
              onChange={e =>
                handleChange({
                  target: {
                    name: 'id_externo',
                    value: e.target.value.toUpperCase(),
                  },
                })
              }
              placeholder='Cedula, TI, Pasaporte'
              required
              readOnly={mode === 'edit'}
            />
          </div>

          <div className='col-md-4 mb-3'>
            <label className='form-label'>Nombre</label>
            <input
              type='text'
              className='form-control'
              name='nombre'
              value={formData.nombre}
              onChange={handleChange}
              required
            />
          </div>

          <div className='col-md-4 mb-3'>
            <label className='form-label'>Apellidos</label>
            <input
              type='text'
              className='form-control'
              name='apellidos'
              value={formData.apellidos}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className='row'>
          <div className='col-md-3 mb-3'>
            <label className='form-label'>Edad</label>
            <input
              type='number'
              className='form-control'
              name='edad'
              value={formData.edad}
              onChange={handleChange}
              min='0'
              step='1'
              required
            />
          </div>

          <div className='col-md-3 mb-3'>
            <label className='form-label'>EPS</label>
            <input
              type='text'
              className='form-control'
              name='eps'
              value={formData.eps}
              onChange={handleChange}
              required
            />
          </div>

          <div className='col-md-3 mb-3'>
            <label className='form-label'>ARL</label>
            <input
              type='text'
              className='form-control'
              name='arl'
              value={formData.arl}
              onChange={handleChange}
              required
            />
          </div>

          <div className='col-md-3 mb-3'>
            <label className='form-label'>Teléfono</label>
            <input
              type='tel'
              className='form-control'
              name='telefono'
              value={formData.telefono}
              onChange={handleChange}
              inputMode='numeric'
              pattern='[0-9]*'
              placeholder='3191234567'
              required
            />
          </div>
        </div>

        <div className='row'>
          <div className='col-md-6 mb-3'>
            <label className='form-label'>Cargo</label>
            <input
              type='text'
              className='form-control'
              name='cargo'
              value={formData.cargo}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className='d-flex justify-content-end gap-2 mt-2'>
          <button
            type='button'
            className='btn btn-outline-secondary'
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type='submit'
            className='btn btn-primary'
            disabled={saving}
            title='Guardar (requiere confirmación)'
          >
            {saving ? 'Guardando…' : mode === 'edit' ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </form>
    </>
  )
}

export default FormPersonalExterno
