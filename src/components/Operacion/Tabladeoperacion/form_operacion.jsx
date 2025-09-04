// src/components/Operaciones/form_operacion.jsx
import { useEffect, useMemo, useState } from 'react'
import {
  getOperaciones,
  guardarOperacion,
  getLoteProducto,
  getClientes,
  getTiposOperacion,
  getPersonal,
} from './operacion_service'
import './form_operacion.css'

const FormOperacion = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    id_operacion: '',
    id_tipo_operacion: '',
    id_lote: '',
    id_cliente: '',
    operador_fk: '',
    Gestion_inventario: 'Pendiente',
    fecha_realizacion: new Date().toISOString(),
    fecha_fin: new Date().toISOString(),
    // ⚠️ Se dejan los campos antiguos por compatibilidad, pero ya no se usan para el payload:
    id_producto: '',
    cantidad: '',
  })

  // Catálogos
  const [loteProductoData, setLoteProductoData] = useState([]) // [{id_lote, id_producto, Producto?...}]
  const [lotesUnicos, setLotesUnicos] = useState([])
  const [listaClientes, setListaClientes] = useState([])
  const [listaTiposOperacion, setListaTiposOperacion] = useState([])
  const [listaPersonal, setListaPersonal] = useState([])

  // Picker de productos (por lote)
  const [selectedProductos, setSelectedProductos] = useState([]) // [{id_producto, nombre, cantidad}]
  const [picker, setPicker] = useState({ id_producto: '', cantidad: '' })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [operaciones, loteProducto, clientes, tiposOperacion, personal] =
          await Promise.all([
            getOperaciones(),
            getLoteProducto(),
            getClientes(),
            getTiposOperacion(),
            getPersonal(),
          ])

        const ultimoId = obtenerUltimoIdOperacion(operaciones)
        const siguienteId = generarSiguienteId(ultimoId)
        setFormData(prev => ({ ...prev, id_operacion: siguienteId }))

        const lotes = [...new Set(loteProducto.map(lp => lp.id_lote))].filter(
          Boolean
        )
        setLotesUnicos(lotes)
        setLoteProductoData(loteProducto)
        setListaClientes(clientes)
        setListaTiposOperacion(tiposOperacion)
        setListaPersonal(personal)
      } catch (err) {
        console.error('Error al cargar datos:', err)
      }
    }

    fetchData()
  }, [])

  const obtenerUltimoIdOperacion = operaciones => {
    if (!operaciones || operaciones.length === 0) return 'OP000'
    const ids = operaciones.map(op => op.id_operacion)
    const nums = ids
      .map(id => parseInt(String(id).replace('OP', '')))
      .filter(n => !isNaN(n))
      .sort((a, b) => b - a)
    return `OP${String(nums[0]).padStart(3, '0')}`
  }

  const generarSiguienteId = ultimoId => {
    const num = parseInt(String(ultimoId).replace('OP', '')) + 1
    return `OP${String(num).padStart(3, '0')}`
  }

  const handleChange = e => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Productos permitidos para el lote seleccionado
  const productosDelLote = useMemo(() => {
    if (!formData.id_lote) return []
    const delLote = loteProductoData
      .filter(lp => lp.id_lote === formData.id_lote)
      .map(lp => ({
        id_producto: String(lp.id_producto),
        nombre: lp.Producto?.nombre || String(lp.id_producto),
      }))

    // únicos por id_producto
    const unicos = []
    const seen = new Set()
    for (const p of delLote) {
      if (!seen.has(p.id_producto)) {
        seen.add(p.id_producto)
        unicos.push(p)
      }
    }
    return unicos
  }, [formData.id_lote, loteProductoData])

  const handleLoteChange = e => {
    const selectedLote = e.target.value
    setFormData(prev => ({
      ...prev,
      id_lote: selectedLote,
      // reset campos antiguos (no usados ya)
      id_producto: '',
      cantidad: '',
    }))
    setPicker({ id_producto: '', cantidad: '' })
    setSelectedProductos([]) // 👉 al cambiar lote, se limpia la selección
  }

  // ---- Picker de productos (agregar/editar/quitar) ----
  const onAddProducto = () => {
    if (!formData.id_lote) {
      alert('Primero selecciona un lote.')
      return
    }
    const idp = String(picker.id_producto || '')
    const cant = Number(picker.cantidad)
    if (!idp) {
      alert('Selecciona un producto.')
      return
    }
    if (!Number.isFinite(cant) || cant <= 0) {
      alert('Cantidad inválida.')
      return
    }
    // validar que pertenece al lote
    const existeEnLote = productosDelLote.some(p => p.id_producto === idp)
    if (!existeEnLote) {
      alert('Ese producto no pertenece al lote seleccionado.')
      return
    }

    setSelectedProductos(prev => {
      const idx = prev.findIndex(p => p.id_producto === idp)
      if (idx >= 0) {
        // si ya existe, actualiza cantidad (suma)
        const next = [...prev]
        next[idx] = {
          ...next[idx],
          cantidad: Number(next[idx].cantidad) + cant,
        }
        return next
      }
      const prod = productosDelLote.find(p => p.id_producto === idp)
      return [
        ...prev,
        { id_producto: idp, nombre: prod?.nombre || idp, cantidad: cant },
      ]
    })

    // limpiar picker
    setPicker({ id_producto: '', cantidad: '' })
  }

  const onRemoveProducto = idp => {
    setSelectedProductos(prev => prev.filter(p => p.id_producto !== idp))
  }

  const onChangeCantidad = (idp, nueva) => {
    const value = Number(nueva)
    if (!Number.isFinite(value) || value <= 0) return
    setSelectedProductos(prev =>
      prev.map(p => (p.id_producto === idp ? { ...p, cantidad: value } : p))
    )
  }

  // total sugerido (opcional)
  const totalItems = useMemo(
    () =>
      selectedProductos.reduce((acc, p) => acc + Number(p.cantidad || 0), 0),
    [selectedProductos]
  )

  const handleSubmit = async e => {
    e.preventDefault()
    if (!formData.id_tipo_operacion)
      return alert('Selecciona el tipo de operación.')
    if (!formData.id_lote) return alert('Selecciona el lote.')
    if (!formData.id_cliente) return alert('Selecciona el cliente.')
    if (!formData.operador_fk) return alert('Selecciona el operador.')
    if (selectedProductos.length === 0)
      return alert('Agrega al menos un producto del lote.')

    // payload según tu ejemplo
    const payload = {
      id_operacion: formData.id_operacion,
      id_tipo_operacion: formData.id_tipo_operacion,
      id_lote: formData.id_lote,
      id_cliente: formData.id_cliente,
      operador_fk: formData.operador_fk,
      Gestion_inventario: formData.Gestion_inventario,
      fecha_realizacion: formData.fecha_realizacion,
      fecha_fin: formData.fecha_fin,
      // 👉 productos como array:
      productos: selectedProductos.map(p => ({
        id_producto: p.id_producto,
        cantidad: Number(p.cantidad),
      })),
      // Si tu backend aún usa "cantidad" total, puedes enviarla (opcional):
      cantidad: totalItems,
    }

    try {
      await guardarOperacion(payload)
      alert('Operación guardada exitosamente')
      if (onSuccess) onSuccess()
      // reset mínimo
      setSelectedProductos([])
      setPicker({ id_producto: '', cantidad: '' })
    } catch (error) {
      console.error('Error al guardar operación:', error)
      alert('Error al guardar la operación')
    }
  }

  return (
    <div className='container-fluid mt-4'>
      <h3 className='text-center mb-4'>Registrar Nueva Operación</h3>
      <form onSubmit={handleSubmit} className='mt-4'>
        <div className='row'>
          <div className='col-md-4 mb-3'>
            <label className='form-label'>ID Operación</label>
            <input
              type='text'
              className='form-control'
              name='id_operacion'
              value={formData.id_operacion}
              readOnly
            />
          </div>

          <div className='col-md-4 mb-3'>
            <label className='form-label'>Tipo de Operación</label>
            <select
              className='form-select'
              name='id_tipo_operacion'
              value={formData.id_tipo_operacion}
              onChange={handleChange}
              required
            >
              <option value=''>Seleccione un tipo</option>
              {listaTiposOperacion.map((tipo, index) => (
                <option
                  key={tipo.id_tipo_operacion || `tipo-${index}`}
                  value={tipo.id_tipo_operacion}
                >
                  {tipo.nombre ?? tipo.Nombre ?? 'Tipo'} (
                  {tipo.id_tipo_operacion})
                </option>
              ))}
            </select>
          </div>

          <div className='col-md-4 mb-3'>
            <label className='form-label'>Lote</label>
            <select
              className='form-select'
              name='id_lote'
              value={formData.id_lote}
              onChange={handleLoteChange}
              required
            >
              <option value=''>Seleccione un lote</option>
              {lotesUnicos.map((lote, index) => (
                <option key={lote || `lote-${index}`} value={lote}>
                  {lote}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ---- Picker de productos del lote ---- */}
        <div className='row align-items-end'>
          <div className='col-md-6 mb-3'>
            <label className='form-label'>Producto del lote</label>
            <select
              className='form-select'
              value={picker.id_producto}
              onChange={e =>
                setPicker(prev => ({ ...prev, id_producto: e.target.value }))
              }
              disabled={!formData.id_lote}
            >
              <option value=''>Seleccione un producto</option>
              {productosDelLote.map((p, idx) => (
                <option
                  key={p.id_producto || `prod-${idx}`}
                  value={p.id_producto}
                >
                  {p.nombre} ({p.id_producto})
                </option>
              ))}
            </select>
          </div>

          <div className='col-md-3 mb-3'>
            <label className='form-label'>Cantidad</label>
            <input
              type='number'
              min='0'
              step='any'
              className='form-control'
              value={picker.cantidad}
              onChange={e =>
                setPicker(prev => ({ ...prev, cantidad: e.target.value }))
              }
              disabled={!formData.id_lote}
            />
          </div>

          <div className='col-md-3 mb-3'>
            <button
              type='button'
              className='btn-agregarform w-100'
              onClick={onAddProducto}
              disabled={!formData.id_lote}
              title={
                !formData.id_lote
                  ? 'Seleccione un lote primero'
                  : 'Agregar producto'
              }
            >
              Agregar producto
            </button>
          </div>
        </div>

        {/* ---- Lista de productos seleccionados ---- */}
        <div className='mb-3'>
          <div className='d-flex justify-content-between align-items-center'>
            <h6 className='mb-2'>Productos seleccionados</h6>
            <small className='text-muted'>Total ítems: {totalItems}</small>
          </div>

          {selectedProductos.length === 0 ? (
            <p className='text-muted'>Aún no has agregado productos.</p>
          ) : (
            <div className='table-responsive'>
              <table className='table table-sm table-bordered align-middle'>
                <thead className='table-light'>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>ID Producto</th>
                    <th>Nombre</th>
                    <th style={{ width: 160 }}>Cantidad</th>
                    <th style={{ width: 80 }}>Quitar</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProductos.map(p => (
                    <tr key={p.id_producto}>
                      <td>{p.id_producto}</td>
                      <td>{p.nombre}</td>
                      <td>
                        <input
                          type='number'
                          min='0'
                          step='any'
                          className='form-control form-control-sm'
                          value={p.cantidad}
                          onChange={e =>
                            onChangeCantidad(p.id_producto, e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <button
                          type='button'
                          className='btn btn-sm btn-outline-danger'
                          onClick={() => onRemoveProducto(p.id_producto)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ---- Cliente / Operador / Fechas ---- */}
        <div className='row'>
          <div className='col-md-4 mb-3'>
            <label className='form-label'>Cliente</label>
            <select
              className='form-select'
              name='id_cliente'
              value={formData.id_cliente}
              onChange={handleChange}
              required
            >
              <option value=''>Seleccione un cliente</option>
              {listaClientes.map((c, index) => (
                <option
                  key={c.id_Cliente || `cliente-${index}`}
                  value={c.id_Cliente}
                >
                  {c.Nombre} ({c.id_Cliente})
                </option>
              ))}
            </select>
          </div>

          <div className='col-md-4 mb-3'>
            <label className='form-label'>Operador</label>
            <select
              className='form-select'
              name='operador_fk'
              value={formData.operador_fk}
              onChange={handleChange}
              required
            >
              <option value=''>Seleccione un operador</option>
              {listaPersonal.map((p, index) => (
                <option
                  key={p.Id_personal || `op-${index}`}
                  value={p.Id_personal}
                >
                  {p.Nombre} {p.Apellido} - {p.Cargo} ({p.Id_personal})
                </option>
              ))}
            </select>
          </div>

          <div className='col-md-4 mb-3'>
            <label className='form-label'>Fecha Realización</label>
            <input
              type='datetime-local'
              className='form-control'
              name='fecha_realizacion'
              value={formData.fecha_realizacion.slice(0, 16)}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className='row'>
          <div className='col-md-4 mb-3'>
            <label className='form-label'>Fecha Fin</label>
            <input
              type='datetime-local'
              className='form-control'
              name='fecha_fin'
              value={formData.fecha_fin.slice(0, 16)}
              onChange={handleChange}
            />
          </div>
          <div className='col-md-8 mb-3 d-flex align-items-end justify-content-end'>
            <button type='submit' className='btn-agregarform'>
              Guardar Operación
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default FormOperacion
