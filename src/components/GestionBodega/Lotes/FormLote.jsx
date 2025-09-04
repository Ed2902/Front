import { useForm } from 'react-hook-form'
import { useState, useEffect } from 'react'
import {
  getLotesDisponibles,
  getProductosDisponibles,
  createLoteProducto,
  createLote,
  getClientesDisponibles,
  getProveedoresDisponibles,
} from './Lotes_service.js'
import { usePermisos } from '../../../hooks/usePermisos'

const FormLote = ({ onSuccess = () => {} }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()

  const { tienePermiso } = usePermisos()

  const [lotes, setLotes] = useState([])
  const [productos, setProductos] = useState([])
  const [clientes, setClientes] = useState([])
  const [proveedores, setProveedores] = useState([])

  const [selectedLote, setSelectedLote] = useState('')
  const [selectedProducto, setSelectedProducto] = useState('')
  const [tipoTercero, setTipoTercero] = useState('')

  const [loading, setLoading] = useState(false)
  const [serverResponse, setServerResponse] = useState(null)
  const [showCrearLote, setShowCrearLote] = useState(false)
  const [nuevoLote, setNuevoLote] = useState({
    Id_lote: '',
    Fecha_vence: '',
    Fecha_fabri: '',
    Comentarios: '',
  })

  const permisoProductosRS = tienePermiso('productosRS')
  const permisoProductosBodega = tienePermiso('productosBodega')

  useEffect(() => {
    fetchLotes()
    fetchProductos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const cargarTerceros = async () => {
      try {
        if (tipoTercero === 'cliente') {
          const data = await getClientesDisponibles()
          setClientes(data)
        } else if (tipoTercero === 'proveedor') {
          const data = await getProveedoresDisponibles()
          setProveedores(data)
        }
      } catch (err) {
        console.error('Error cargando terceros:', err)
      }
    }

    if (tipoTercero) cargarTerceros()
  }, [tipoTercero])

  const fetchLotes = async () => {
    try {
      const data = await getLotesDisponibles()
      setLotes(data)

      const sugerido = sugerirSiguienteId(data.map(l => l.Id_lote))
      setNuevoLote(prev => ({
        ...prev,
        Id_lote: sugerido,
      }))
    } catch (error) {
      console.error('Error cargando lotes:', error)
    }
  }

  const fetchProductos = async () => {
    try {
      const data = await getProductosDisponibles()

      const productosFiltrados = data.filter(p => {
        if (permisoProductosRS && p.Tipo === 'RS') return true
        if (permisoProductosBodega && p.Tipo === 'Bodega') return true
        if (permisoProductosRS && permisoProductosBodega) return true
        return false
      })

      setProductos(productosFiltrados)
    } catch (error) {
      console.error('Error cargando productos:', error)
    }
  }

  function sugerirSiguienteId(ids) {
    const prefix = 'FW_'
    const numeros = ids
      .filter(id => id.startsWith(prefix))
      .map(id => parseInt(id.replace(prefix, ''), 10))
      .filter(num => !isNaN(num))

    const max = numeros.length ? Math.max(...numeros) : 0
    const siguienteNumero = max + 1
    const idFormateado = siguienteNumero.toString().padStart(3, '0')
    return `${prefix}${idFormateado}`
  }

  const handleCrearLote = async e => {
    e.preventDefault()
    const { Id_lote, Fecha_vence, Fecha_fabri, Comentarios } = nuevoLote

    if (!Id_lote) {
      alert('El campo Id_lote es obligatorio.')
      return
    }

    const existe = lotes.some(l => l.Id_lote === Id_lote.trim())
    if (existe) {
      alert(`El ID de lote "${Id_lote}" ya existe.`)
      return
    }

    const payload = {
      Id_lote: Id_lote.trim(),
      Fecha_vence: Fecha_vence || null,
      Fecha_fabri: Fecha_fabri || null,
      Comentarios: Comentarios?.trim() || null,
    }

    try {
      console.log('Enviando nuevo lote:', payload)
      await createLote(payload)
      await fetchLotes()
      setNuevoLote({
        Id_lote: '',
        Fecha_vence: '',
        Fecha_fabri: '',
        Comentarios: '',
      })
      setShowCrearLote(false)
      alert('Lote creado correctamente.')
    } catch (error) {
      console.error('Error creando lote:', error)
      alert('Error al crear lote.')
    }
  }

  const onSubmit = async data => {
    const confirmar = window.confirm(
      '¿Seguro que desea guardar este lote-producto?'
    )
    if (!confirmar) return

    try {
      setLoading(true)
      const payload = {
        id_lote: selectedLote,
        id_producto: selectedProducto,
        Cantidad: data.Cantidad,
        ...(tipoTercero === 'cliente' && { id_Cliente: data.id_Cliente }),
        ...(tipoTercero === 'proveedor' && { id_proveedor: data.id_Proveedor }),
      }

      console.log('Payload final enviado:', payload)
      await createLoteProducto(payload)

      setServerResponse({ mensaje: 'Registro exitoso.' })
      reset()
      setSelectedLote('')
      setSelectedProducto('')
      setTipoTercero('')

      setTimeout(() => {
        onSuccess()
      }, 1000)
    } catch (error) {
      console.error('Error al guardar lote-producto:', error)
      setServerResponse({ error: 'Ocurrió un error al guardar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='row g-3'>
      {serverResponse && (
        <div
          className={`alert text-center w-100 ${
            serverResponse.error ? 'alert-danger' : 'alert-success'
          }`}
        >
          {serverResponse?.mensaje ||
            serverResponse?.error ||
            'Registro exitoso.'}
        </div>
      )}

      <div className='col-md-8'>
        <label className='form-label'>Lote</label>
        <select
          className='form-select'
          value={selectedLote}
          onChange={e => setSelectedLote(e.target.value)}
        >
          <option value=''>Seleccione un lote</option>
          {lotes.map(l => (
            <option key={l.Id_lote} value={l.Id_lote}>
              {l.Id_lote}
            </option>
          ))}
        </select>
      </div>

      <div className='col-md-4 d-flex align-items-end'>
        <button
          type='button'
          className='btn btn-secondary w-100'
          onClick={() => {
            if (!showCrearLote) {
              const sugerido = sugerirSiguienteId(lotes.map(l => l.Id_lote))
              setNuevoLote(prev => ({ ...prev, Id_lote: sugerido }))
            }
            setShowCrearLote(!showCrearLote)
          }}
        >
          {showCrearLote ? 'Cancelar' : 'Crear Lote'}
        </button>
      </div>

      {showCrearLote && (
        <div className='col-12 border rounded p-3 bg-light'>
          <div className='mb-2'>
            <label className='form-label'>ID Lote *</label>
            <input
              type='text'
              className='form-control'
              value={nuevoLote.Id_lote}
              onChange={e =>
                setNuevoLote(prev => ({ ...prev, Id_lote: e.target.value }))
              }
              required
            />
          </div>
          <div className='mb-2'>
            <label className='form-label'>Fecha de fabricación</label>
            <input
              type='date'
              className='form-control'
              value={nuevoLote.Fecha_fabri}
              onChange={e =>
                setNuevoLote(prev => ({ ...prev, Fecha_fabri: e.target.value }))
              }
            />
          </div>
          <div className='mb-2'>
            <label className='form-label'>Fecha de vencimiento</label>
            <input
              type='date'
              className='form-control'
              value={nuevoLote.Fecha_vence}
              onChange={e =>
                setNuevoLote(prev => ({ ...prev, Fecha_vence: e.target.value }))
              }
            />
          </div>
          <div className='mb-2'>
            <label className='form-label'>Comentarios</label>
            <textarea
              className='form-control'
              rows='2'
              value={nuevoLote.Comentarios}
              onChange={e =>
                setNuevoLote(prev => ({ ...prev, Comentarios: e.target.value }))
              }
            ></textarea>
          </div>
          <div className='text-end'>
            <button className='btn btn-success' onClick={handleCrearLote}>
              Guardar Lote
            </button>
          </div>
        </div>
      )}

      <div className='col-12'>
        <label className='form-label'>Producto</label>
        <select
          className='form-select'
          value={selectedProducto}
          onChange={e => setSelectedProducto(e.target.value)}
        >
          <option value=''>Seleccione un producto</option>
          {productos.map(p => (
            <option key={p.Id_producto} value={p.Id_producto}>
              {p.Nombre} ({p.Id_producto})
            </option>
          ))}
        </select>
      </div>

      {selectedLote && selectedProducto && (
        <>
          <div className='col-md-6'>
            <label className='form-label'>Tipo</label>
            <select
              className='form-select'
              value={tipoTercero}
              onChange={e => setTipoTercero(e.target.value)}
            >
              <option value=''>Seleccione tipo</option>
              <option value='cliente'>Cliente</option>
              <option value='proveedor'>Proveedor</option>
            </select>
          </div>

          {tipoTercero === 'cliente' && (
            <div className='col-md-6'>
              <label className='form-label'>Cliente</label>
              <select
                className={`form-select ${
                  errors.id_Cliente ? 'is-invalid' : ''
                }`}
                {...register('id_Cliente', { required: true })}
              >
                <option value=''>Seleccione un cliente</option>
                {clientes.map(cliente => (
                  <option
                    key={cliente.id_Cliente || cliente.Id_Cliente}
                    value={cliente.id_Cliente || cliente.Id_Cliente}
                  >
                    {cliente.Nombre} ({cliente.id_Cliente || cliente.Id_Cliente}
                    )
                  </option>
                ))}
              </select>
              {errors.id_Cliente && (
                <div className='invalid-feedback'>Cliente requerido</div>
              )}
            </div>
          )}

          {tipoTercero === 'proveedor' && (
            <div className='col-md-6'>
              <label className='form-label'>Proveedor</label>
              <select
                className={`form-select ${
                  errors.id_Proveedor ? 'is-invalid' : ''
                }`}
                {...register('id_Proveedor', { required: true })}
              >
                <option value=''>Seleccione un proveedor</option>
                {proveedores.map(p => (
                  <option
                    key={p.id_proveedor || p.Id_proveedor}
                    value={p.id_proveedor || p.Id_proveedor}
                  >
                    {p.Nombre} ({p.id_proveedor || p.Id_proveedor})
                  </option>
                ))}
              </select>
              {errors.id_Proveedor && (
                <div className='invalid-feedback'>Proveedor requerido</div>
              )}
            </div>
          )}

          <div className='col-12'>
            <label className='form-label'>Cantidad</label>
            <input
              type='number'
              step='0.01'
              className={`form-control ${errors.Cantidad ? 'is-invalid' : ''}`}
              {...register('Cantidad', { required: true })}
            />
            {errors.Cantidad && (
              <div className='invalid-feedback'>Cantidad requerida</div>
            )}
          </div>

          <div className='col-12'>
            <button
              type='submit'
              className='btn-agregarform'
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar Lote Producto'}
            </button>
          </div>
        </>
      )}
    </form>
  )
}

export default FormLote
