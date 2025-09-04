import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { getBodegas, createUbicacion } from './BodegaService'

const FormUbicacion = ({ onSuccess }) => {
  const [bodegas, setBodegas] = useState([])
  const [statusMessage, setStatusMessage] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm()

  useEffect(() => {
    const fetchBodegas = async () => {
      try {
        const res = await getBodegas()
        setBodegas(res)
      } catch (err) {
        console.error('Error al cargar bodegas:', err)
      }
    }
    fetchBodegas()
  }, [])

  const onSubmit = async data => {
    try {
      const payload = {
        ...data,
        activo: data.activo === 'Sí',
      }

      await createUbicacion(payload)
      reset()
      setStatusMessage({
        type: 'success',
        text: 'Ubicación guardada exitosamente ✅',
      })

      setTimeout(() => {
        setStatusMessage(null)
        onSuccess()
      }, 1500)
    } catch (err) {
      console.error('Error al crear ubicación:', err)
      setStatusMessage({
        type: 'error',
        text: 'Error al guardar la ubicación ❌',
      })
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

      {/* ID Ubicación */}
      <div className='col-md-6'>
        <label className='form-label'>ID Ubicación</label>
        <input
          className={`form-control ${errors.id_ubicacion ? 'is-invalid' : ''}`}
          {...register('id_ubicacion', { required: true })}
        />
        {errors.id_ubicacion && (
          <div className='invalid-feedback'>Campo obligatorio</div>
        )}
      </div>

      {/* Bodega Asociada */}
      <div className='col-md-6'>
        <label className='form-label'>Bodega Asociada</label>
        <select
          className={`form-select ${errors.id_bodega ? 'is-invalid' : ''}`}
          {...register('id_bodega', { required: true })}
        >
          <option value=''>Seleccione una bodega</option>
          {bodegas.map(b => (
            <option key={b.id_bodega} value={b.id_bodega}>
              {b.nombre}
            </option>
          ))}
        </select>
        {errors.id_bodega && (
          <div className='invalid-feedback'>Seleccione una bodega</div>
        )}
      </div>

      {/* Nombre */}
      <div className='col-md-6'>
        <label className='form-label'>Nombre</label>
        <input
          className={`form-control ${errors.nombre ? 'is-invalid' : ''}`}
          {...register('nombre', { required: true })}
        />
        {errors.nombre && (
          <div className='invalid-feedback'>Campo obligatorio</div>
        )}
      </div>

      {/* Activo */}
      <div className='col-md-6'>
        <label className='form-label'>Activo</label>
        <select
          className={`form-select ${errors.activo ? 'is-invalid' : ''}`}
          {...register('activo', { required: true })}
        >
          <option value='Sí'>Sí</option>
          <option value='No'>No</option>
        </select>
      </div>

      {/* Capacidad */}
      <div className='col-md-12'>
        <label className='form-label'>Capacidad en m³</label>
        <input
          type='number'
          step='any'
          min='0'
          className={`form-control ${errors.capacidad ? 'is-invalid' : ''}`}
          {...register('capacidad', { required: true, min: 0 })}
        />
        {errors.capacidad && (
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
          {isSubmitting ? 'Guardando...' : 'Guardar Ubicación'}
        </button>
      </div>
    </form>
  )
}

export default FormUbicacion
