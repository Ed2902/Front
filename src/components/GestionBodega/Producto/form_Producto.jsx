import { useForm } from 'react-hook-form'
import { useState, useEffect } from 'react'
import { createProducto, getProductos } from './Producto_service'
import { OPCIONES_TIPO_PRODUCTO } from './prefijos' // tu repo de opciones

// Mapa local: tipo → prefijo (mantener en sync con prefijos.js)
const PREFIJO_POR_TIPO = {
  YUTES: 'YUT',
  ROLLOS: 'ROL',
  PALLETS: 'PAL',
  CAJAS: 'CAJ',
  UNITARIO: 'UNI',
  EXTRADIMENSIONADO: 'EXT',
  BULTOS: 'BUL',
}

const FormProducto = ({ onSuccess = () => {} }) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm()

  const [loading, setLoading] = useState(false)
  const [serverResponse, setServerResponse] = useState(null)
  const [productos, setProductos] = useState([])

  // Cargar productos existentes (para calcular siguiente ID por prefijo)
  useEffect(() => {
    ;(async () => {
      try {
        const data = await getProductos()
        setProductos(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error('Error obteniendo productos para prefijos:', e)
        setProductos([])
      }
    })()
  }, [])

  // Observa el tipo de producto (prefijo)
  const tipoProducto = watch('Tipo_producto')

  // Calcula el siguiente ID cuando cambia el tipo de producto o la lista
  useEffect(() => {
    if (!tipoProducto) {
      setValue('Id_producto', '')
      return
    }
    const pref = (PREFIJO_POR_TIPO[tipoProducto] || '').toUpperCase()
    if (!pref) {
      setValue('Id_producto', '')
      return
    }

    // Busca el mayor correlativo existente para ese prefijo (case-insensitive)
    const max = productos.reduce((m, p) => {
      const id = String(p?.Id_producto || p?.id_producto || '').toUpperCase()
      if (!id.startsWith(pref)) return m
      const suf = id.slice(pref.length)
      const n = parseInt(suf, 10)
      return Number.isFinite(n) && n > m ? n : m
    }, 0)

    const siguiente = max + 1
    // 3 cifras por defecto; si superas 999, crece automáticamente
    const ancho = siguiente < 1000 ? 3 : String(siguiente).length
    const candidato = `${pref}${String(siguiente).padStart(ancho, '0')}`

    setValue('Id_producto', candidato)
  }, [tipoProducto, productos, setValue])

  const onSubmit = async data => {
    const confirmar = window.confirm('¿Seguro que desea guardar este producto?')
    if (!confirmar) return

    try {
      setLoading(true)
      // Enviar como viene: Id_producto ya está en readOnly/autogenerado
      const response = await createProducto({
        ...data,
        Id_producto: (data.Id_producto || '').toUpperCase().trim(),
      })

      setServerResponse(response)
      reset()
      setTimeout(() => onSuccess(), 1000)
    } catch (error) {
      console.error('Error creando producto:', error)
      const mensaje =
        error?.response?.data?.mensaje ||
        error?.message ||
        'Ocurrió un error al guardar el producto.'
      setServerResponse({ error: mensaje })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='row g-3'>
      {/* Mensaje servidor */}
      {serverResponse && (
        <div
          className={`alert ${
            serverResponse.error ? 'alert-danger' : 'alert-success'
          } text-center w-100`}
        >
          {serverResponse?.mensaje ||
            serverResponse?.error ||
            'Producto creado exitosamente.'}
        </div>
      )}

      {/* NUEVO: Tipo de producto (prefijo) */}
      <div className='col-md-6'>
        <label className='form-label'>Tipo de producto</label>
        <select
          className={`form-select ${errors.Tipo_producto ? 'is-invalid' : ''}`}
          {...register('Tipo_producto', { required: true })}
        >
          <option value=''>Seleccione un tipo</option>
          {OPCIONES_TIPO_PRODUCTO.map(op => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
        {errors.Tipo_producto && (
          <div className='invalid-feedback'>Tipo de producto es requerido</div>
        )}
      </div>

      {/* ID Producto (readOnly, autogenerado por prefijo) */}
      <div className='col-md-6'>
        <label className='form-label'>ID Producto</label>
        <input
          type='text'
          className={`form-control ${errors.Id_producto ? 'is-invalid' : ''}`}
          {...register('Id_producto', { required: true })}
          placeholder='Se autogenera por prefijo'
          readOnly
        />
        {errors.Id_producto && (
          <div className='invalid-feedback'>ID Producto es requerido</div>
        )}
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

      {/* Tipo (RS/Bodega) */}
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

      {/* Botón Submit */}
      <div className='col-12'>
        <button type='submit' className='btn-agregarform' disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar Producto'}
        </button>
      </div>
    </form>
  )
}

export default FormProducto
