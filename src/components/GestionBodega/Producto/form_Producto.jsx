// FormProducto.jsx
import { useForm } from 'react-hook-form'
import { useEffect, useMemo, useState } from 'react'
import { createProducto, getProductos } from './Producto_service'
import { getPrefijos } from './Prefijos_service'
import { usePermisos } from '../../../hooks/usePermisos'

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

  const [prefijos, setPrefijos] = useState([])
  const [loadingPrefijos, setLoadingPrefijos] = useState(false)
  const [errorPrefijos, setErrorPrefijos] = useState(null)
  const [buscarPrefijo, setBuscarPrefijo] = useState('')

  // ---- Permisos (no modificamos tu hook) ----
  const { tienePermiso } = usePermisos()
  const puedeVerRS = !!tienePermiso?.('productosRS')

  // cargar productos (para correlativo)
  useEffect(() => {
    ;(async () => {
      try {
        const data = await getProductos()
        setProductos(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error('Error obteniendo productos:', e)
        setProductos([])
      }
    })()
  }, [])

  // cargar prefijos
  useEffect(() => {
    ;(async () => {
      try {
        setLoadingPrefijos(true)
        setErrorPrefijos(null)
        const list = await getPrefijos()
        setPrefijos(list)
      } catch (e) {
        console.error('Error obteniendo prefijos:', e)
        setErrorPrefijos('No fue posible cargar los prefijos')
        setPrefijos([])
      } finally {
        setLoadingPrefijos(false)
      }
    })()
  }, [])

  // observar prefijo seleccionado
  const selectedPrefijo = watch('Prefijo')

  // recalcular Id_producto cuando cambia prefijo
  useEffect(() => {
    const pref = (selectedPrefijo || '').toUpperCase().trim()
    if (!pref) {
      setValue('Id_producto', '')
      return
    }

    const max = productos.reduce((m, p) => {
      const id = String(p?.Id_producto || p?.id_producto || '').toUpperCase()
      if (!id.startsWith(pref)) return m
      const suf = id.slice(pref.length)
      const n = parseInt(suf, 10)
      return Number.isFinite(n) && n > m ? n : m
    }, 0)

    const siguiente = max + 1
    const ancho = siguiente < 1000 ? 3 : String(siguiente).length
    const candidato = `${pref}${String(siguiente).padStart(ancho, '0')}`

    setValue('Id_producto', candidato)
  }, [selectedPrefijo, productos, setValue])

  // filtrar por búsqueda + permisos
  const prefijosFiltrados = useMemo(() => {
    const q = buscarPrefijo.trim().toLowerCase()
    return prefijos
      .filter(p => {
        // Ocultar RS si no hay permiso
        if (
          !puedeVerRS &&
          (p.tipo === 'RS_ESPECIFICO' || p.tipo === 'RS_GENERICO')
        ) {
          return false
        }
        return true
      })
      .filter(p => {
        if (!q) return true
        return (
          p.prefijo.toLowerCase().includes(q) ||
          p.nombre.toLowerCase().includes(q) ||
          String(p.id_prefijo).toLowerCase().includes(q)
        )
      })
  }, [buscarPrefijo, prefijos, puedeVerRS])

  // agrupar por tipo
  const prefijosAgrupados = useMemo(() => {
    return prefijosFiltrados.reduce((acc, p) => {
      if (!acc[p.tipo]) acc[p.tipo] = []
      acc[p.tipo].push(p)
      return acc
    }, {})
  }, [prefijosFiltrados])

  // submit
  const onSubmit = async data => {
    const confirmar = window.confirm('¿Seguro que desea guardar este producto?')
    if (!confirmar) return

    try {
      setLoading(true)
      const payload = {
        ...data,
        Id_producto: (data.Id_producto || '').toUpperCase().trim(),
        Prefijo: (data.Prefijo || '').toUpperCase().trim(),
      }
      const response = await createProducto(payload)
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

  const disabledSelect = loadingPrefijos // no hay loading de permisos en tu hook

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

      {/* Prefijo + búsqueda */}
      <div className='col-md-6'>
        <label className='form-label'>Prefijo</label>

        <input
          type='text'
          className='form-control mb-2'
          placeholder='Buscar por prefijo, nombre o código...'
          value={buscarPrefijo}
          onChange={e => setBuscarPrefijo(e.target.value)}
          disabled={disabledSelect}
        />

        <select
          className={`form-select ${errors.Prefijo ? 'is-invalid' : ''}`}
          {...register('Prefijo', { required: true })}
          disabled={disabledSelect}
        >
          <option value=''>Seleccione un prefijo</option>
          {Object.entries(prefijosAgrupados).map(([tipo, items]) => (
            <optgroup key={tipo} label={tipo}>
              {items.map(p => (
                <option key={p.id_prefijo} value={p.prefijo}>
                  {p.prefijo} — {p.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {errors.Prefijo && (
          <div className='invalid-feedback'>El prefijo es requerido</div>
        )}
        {errorPrefijos && (
          <div className='text-danger mt-1'>{errorPrefijos}</div>
        )}
        {!puedeVerRS && (
          <div className='form-text mt-1'>
            Algunos prefijos RS no se muestran por permisos.
          </div>
        )}
      </div>

      {/* ID Producto */}
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

      {/* Botón Submit */}
      <div className='col-12'>
        <button
          type='submit'
          className='btn-agregarform'
          disabled={loading || loadingPrefijos}
        >
          {loading ? 'Guardando...' : 'Guardar Producto'}
        </button>
      </div>
    </form>
  )
}

export default FormProducto
