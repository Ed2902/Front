import { useForm } from 'react-hook-form'
import { updateProducto } from './Producto_service'
import { useState, useEffect } from 'react'

const FormEditarProducto = ({ producto, onSuccess = () => {} }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm()

  const [loading, setLoading] = useState(false)
  const [serverResponse, setServerResponse] = useState(null)

  // Pre-cargar los datos del producto al abrir el formulario
  useEffect(() => {
    if (producto) {
      setValue('Nombre', producto.Nombre)
      setValue('Referencia', producto.Referencia)
      setValue('Tipo', producto.Tipo)
      setValue('Alto', producto.Alto)
      setValue('Ancho', producto.Ancho)
      setValue('Largo', producto.Largo)
      setValue('Unidad_de_medida', producto.Unidad_de_medida)
    }
  }, [producto, setValue])

  const onSubmit = async data => {
    const confirmar = window.confirm(
      '¿Seguro que desea actualizar este producto?'
    )
    if (!confirmar) return

    try {
      setLoading(true)
      const response = await updateProducto(producto.Id_producto, data)
      console.log('Respuesta del servidor:', response)

      setServerResponse(response)
      reset()

      setTimeout(() => {
        onSuccess() // refresca tabla y cierra modal
      }, 1000)
    } catch (error) {
      console.error('Error actualizando producto:', error.message)
      setServerResponse({
        error: 'Ocurrió un error al actualizar el producto.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='row g-3'>
      {/* Mensaje del servidor */}
      {serverResponse && (
        <div
          className={`alert ${
            serverResponse.error ? 'alert-danger' : 'alert-success'
          } text-center w-100`}
        >
          {serverResponse?.mensaje ||
            serverResponse?.error ||
            'Producto actualizado exitosamente.'}
        </div>
      )}

      {/* ID Producto (solo mostrar, no editar) */}
      <div className='col-12'>
        <label className='form-label'>ID Producto</label>
        <input
          type='text'
          className='form-control'
          value={producto?.Id_producto || ''}
          disabled
        />
      </div>

      {/* Nombre */}
      <div className='col-md-6'>
        <label className='form-label'>Nombre</label>
        <input
          type='text'
          className={`form-control ${errors.Nombre ? 'is-invalid' : ''}`}
          {...register('Nombre', { required: true })}
          placeholder='Ingrese nombre del producto'
        />
        {errors.Nombre && (
          <div className='invalid-feedback'>Nombre es requerido</div>
        )}
      </div>

      {/* Referencia */}
      <div className='col-md-6'>
        <label className='form-label'>Referencia</label>
        <input
          type='text'
          className={`form-control ${errors.Referencia ? 'is-invalid' : ''}`}
          {...register('Referencia', { required: true })}
          placeholder='Ingrese referencia'
        />
        {errors.Referencia && (
          <div className='invalid-feedback'>Referencia es requerida</div>
        )}
      </div>

      {/* Tipo */}
      <div className='col-md-6'>
        <label className='form-label'>Tipo</label>
        <select
          className={`form-select ${errors.Tipo ? 'is-invalid' : ''}`}
          {...register('Tipo', { required: true })}
        >
          <option value=''>Seleccione un tipo</option>
          <option value='RS'>RS</option>
          <option value='Bodega'>Bodega</option>
        </select>
        {errors.Tipo && (
          <div className='invalid-feedback'>Tipo es requerido</div>
        )}
      </div>

      {/* Alto */}
      <div className='col-md-4'>
        <label className='form-label'>Alto</label>
        <input
          type='number'
          step='0.01'
          className={`form-control ${errors.Alto ? 'is-invalid' : ''}`}
          {...register('Alto', { required: true })}
          placeholder='Alto en cm'
        />
        {errors.Alto && (
          <div className='invalid-feedback'>Alto es requerido</div>
        )}
      </div>

      {/* Ancho */}
      <div className='col-md-4'>
        <label className='form-label'>Ancho</label>
        <input
          type='number'
          step='0.01'
          className={`form-control ${errors.Ancho ? 'is-invalid' : ''}`}
          {...register('Ancho', { required: true })}
          placeholder='Ancho en cm'
        />
        {errors.Ancho && (
          <div className='invalid-feedback'>Ancho es requerido</div>
        )}
      </div>

      {/* Largo */}
      <div className='col-md-4'>
        <label className='form-label'>Largo</label>
        <input
          type='number'
          step='0.01'
          className={`form-control ${errors.Largo ? 'is-invalid' : ''}`}
          {...register('Largo', { required: true })}
          placeholder='Largo en cm'
        />
        {errors.Largo && (
          <div className='invalid-feedback'>Largo es requerido</div>
        )}
      </div>

      {/* Unidad de medida */}
      <div className='col-12'>
        <label className='form-label'>Unidad de medida</label>
        <select
          className={`form-select ${
            errors.Unidad_de_medida ? 'is-invalid' : ''
          }`}
          {...register('Unidad_de_medida', { required: true })}
        >
          <option value=''>Seleccione una unidad</option>
          <option value='unidades'>Unidades</option>
          <option value='kilos'>Kilos</option>
          <option value='pallet'>Pallet</option>
        </select>
        {errors.Unidad_de_medida && (
          <div className='invalid-feedback'>Unidad de medida es requerida</div>
        )}
      </div>

      {/* Botón Guardar Cambios */}
      <div className='col-12'>
        <button type='submit' className='btn-agregarform' disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  )
}

export default FormEditarProducto
