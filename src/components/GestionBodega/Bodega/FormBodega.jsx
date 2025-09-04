import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { createBodega } from './BodegaService'

const FormBodega = ({ onSuccess }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm()

  const [statusMessage, setStatusMessage] = useState(null)

  const onSubmit = async data => {
    try {
      await createBodega(data)
      reset()
      setStatusMessage({
        type: 'success',
        text: 'Bodega guardada exitosamente ✅',
      })

      setTimeout(() => {
        setStatusMessage(null)
        onSuccess()
      }, 1500)
    } catch (err) {
      console.error('Error al crear la bodega:', err)
      setStatusMessage({ type: 'error', text: 'Error al guardar la bodega ❌' })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='row g-3'>
      {/* Mensaje */}
      {statusMessage && (
        <div
          className={`alert ${
            statusMessage.type === 'success' ? 'alert-success' : 'alert-danger'
          } text-center w-100`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Nombre */}
      <div className='col-md-6'>
        <label className='form-label'>Nombre</label>
        <input
          className={`form-control ${errors.nombre ? 'is-invalid' : ''}`}
          {...register('nombre', { required: true })}
        />
        {errors.nombre && (
          <div className='invalid-feedback'>Este campo es obligatorio</div>
        )}
      </div>

      {/* Tipo */}
      <div className='col-md-6'>
        <label className='form-label'>Tipo</label>
        <input
          className={`form-control ${errors.tipo ? 'is-invalid' : ''}`}
          {...register('tipo', { required: true })}
        />
        {errors.tipo && (
          <div className='invalid-feedback'>Este campo es obligatorio</div>
        )}
      </div>

      {/* Descripción */}
      <div className='col-12'>
        <label className='form-label'>Descripción</label>
        <textarea
          className='form-control'
          rows='3'
          {...register('descripcion')}
        />
      </div>

      {/* Ubicación */}
      <div className='col-md-6'>
        <label className='form-label'>Ubicación</label>
        <input
          className={`form-control ${errors.ubicacion ? 'is-invalid' : ''}`}
          {...register('ubicacion', { required: true })}
        />
        {errors.ubicacion && (
          <div className='invalid-feedback'>Este campo es obligatorio</div>
        )}
      </div>

      {/* Capacidad */}
      <div className='col-md-6'>
        <label className='form-label'>Capacidad en m³</label>
        <input
          type='number'
          step='any'
          min='0'
          className={`form-control ${errors.Capacidad ? 'is-invalid' : ''}`}
          {...register('Capacidad', { required: true, min: 0 })}
        />
        {errors.Capacidad && (
          <div className='invalid-feedback'>Ingresa una capacidad válida</div>
        )}
      </div>

      {/* Botón */}
      <div className='col-12'>
        <button
          type='submit'
          className='btn-agregarform w-100'
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Bodega'}
        </button>
      </div>
    </form>
  )
}

export default FormBodega
