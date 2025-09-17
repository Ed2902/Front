import { useState, useEffect, useMemo } from 'react'
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
  const { tienePermiso } = usePermisos()

  // Catálogos
  const [lotes, setLotes] = useState([])
  const [productos, setProductos] = useState([])
  const [clientes, setClientes] = useState([])
  const [proveedores, setProveedores] = useState([])

  // Selecciones maestras
  const [selectedLote, setSelectedLote] = useState('')
  const [tipoTercero, setTipoTercero] = useState('') // '', 'cliente', 'proveedor'
  const [selectedCliente, setSelectedCliente] = useState('')
  const [selectedProveedor, setSelectedProveedor] = useState('')

  // Peso opcional/obligatorio (aplica a todas las filas)
  const [pesoRequerido, setPesoRequerido] = useState(false)

  // Filas
  const [rows, setRows] = useState([
    { id: Date.now(), id_producto: '', cantidad: '', peso: '' },
  ])

  // Crear Lote inline
  const [showCrearLote, setShowCrearLote] = useState(false)
  const [nuevoLote, setNuevoLote] = useState({
    Id_lote: '',
    Fecha_vence: '',
    Fecha_fabri: '',
    Comentarios: '',
  })

  const [loading, setLoading] = useState(false)
  const [serverResponse, setServerResponse] = useState(null)

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
      setNuevoLote(prev => ({ ...prev, Id_lote: sugerido }))
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
    if (!Id_lote) return alert('El campo Id_lote es obligatorio.')

    const existe = lotes.some(l => l.Id_lote === Id_lote.trim())
    if (existe) return alert(`El ID de lote "${Id_lote}" ya existe.`)

    const payload = {
      Id_lote: Id_lote.trim(),
      Fecha_vence: Fecha_vence || null,
      Fecha_fabri: Fecha_fabri || null,
      Comentarios: Comentarios?.trim() || null,
    }

    try {
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

  // Helpers de filas
  const addRow = () => {
    setRows(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        id_producto: '',
        cantidad: '',
        peso: '',
      },
    ])
  }
  const removeRow = id => {
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev))
  }
  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)))
  }

  // Validaciones locales (sin forzar número en id_producto)
  const validoMaestro = useMemo(() => {
    if (!selectedLote) return false
    if (!tipoTercero) return false
    if (tipoTercero === 'cliente' && !selectedCliente) return false
    if (tipoTercero === 'proveedor' && !selectedProveedor) return false
    return true
  }, [selectedLote, tipoTercero, selectedCliente, selectedProveedor])

  const filasNormalizadas = useMemo(() => {
    // id_producto se mantiene string; cantidades/peso a número cuando haya valor
    return rows.map(r => ({
      id_producto: String(r.id_producto || '').trim(),
      cantidad: r.cantidad === '' ? '' : Number(r.cantidad),
      peso: r.peso === '' ? '' : Number(r.peso),
    }))
  }, [rows])

  const validoFilas = useMemo(() => {
    return filasNormalizadas.every(r => {
      const okProd = r.id_producto !== ''
      const okCant = r.cantidad !== '' && Number(r.cantidad) > 0
      const okPeso = pesoRequerido ? r.peso !== '' && Number(r.peso) > 0 : true
      return okProd && okCant && okPeso
    })
  }, [filasNormalizadas, pesoRequerido])

  const hayDuplicados = useMemo(() => {
    const keyBy = new Set()
    for (const r of filasNormalizadas) {
      const key = `${selectedLote}|${
        tipoTercero === 'cliente'
          ? `C${selectedCliente}`
          : `P${selectedProveedor}`
      }|${r.id_producto}`
      if (keyBy.has(key)) return true
      keyBy.add(key)
    }
    return false
  }, [
    filasNormalizadas,
    selectedLote,
    tipoTercero,
    selectedCliente,
    selectedProveedor,
  ])

  // Envío MASIVO (secuencial)
  const onSubmit = async () => {
    if (!validoMaestro) {
      alert('Completa Lote y Tercero antes de enviar.')
      return
    }
    if (!validoFilas) {
      alert('Revisa las filas: producto/cantidad y, si corresponde, peso.')
      return
    }
    if (hayDuplicados) {
      alert(
        'Hay productos duplicados para el mismo lote y tercero. Unifícalos o elimínalos.'
      )
      return
    }

    const confirmar = window.confirm(
      '¿Seguro que deseas guardar todos los registros?'
    )
    if (!confirmar) return

    setLoading(true)
    setServerResponse(null)

    const terceroPayload =
      tipoTercero === 'cliente'
        ? { id_Cliente: selectedCliente } // si tu backend exige número, usa Number(selectedCliente)
        : { id_proveedor: selectedProveedor } // idem

    // Construir payloads por fila
    const payloads = filasNormalizadas.map(r => ({
      id_lote: selectedLote.trim(),
      id_producto: r.id_producto, // ← string intacto
      Cantidad: Number(r.cantidad),
      PesoUnitarioKg: r.peso === '' ? null : Number(r.peso), // ← null si no aplica
      ...terceroPayload,
    }))

    const detalleFallos = []
    let ok = 0

    try {
      for (let i = 0; i < payloads.length; i++) {
        try {
          console.log('➡️ Enviando fila', i + 1, JSON.stringify(payloads[i]))
          await createLoteProducto(payloads[i])
          ok++
        } catch (err) {
          const backendMsg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            JSON.stringify(err?.response?.data || {})
          console.error('🧨 Error fila', i + 1, backendMsg)
          detalleFallos.push({ index: i + 1, error: backendMsg })
        }
      }

      const total = payloads.length
      const fail = total - ok
      setServerResponse({
        mensaje: `Procesadas ${total}. Éxitos: ${ok}. Fallos: ${fail}.`,
        detalleFallos,
      })

      if (fail === 0) {
        setRows([{ id: Date.now(), id_producto: '', cantidad: '', peso: '' }])
        setTipoTercero('')
        setSelectedCliente('')
        setSelectedProveedor('')
        setPesoRequerido(false)
        setTimeout(() => onSuccess(), 300)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='row g-3'>
      {/* Mensaje servidor */}
      {serverResponse && (
        <div
          className={`alert text-center w-100 ${
            serverResponse.error ? 'alert-danger' : 'alert-success'
          }`}
        >
          {serverResponse.mensaje || serverResponse.error}
          {serverResponse.detalleFallos?.length > 0 && (
            <details className='mt-2'>
              <summary>Ver fallos</summary>
              <ul className='text-start'>
                {serverResponse.detalleFallos.map(df => (
                  <li key={df.index}>
                    Fila #{df.index}: {String(df.error)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Selección de Lote */}
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

      {/* Crear Lote inline */}
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
            />
          </div>
          <div className='text-end'>
            <button className='btn btn-success' onClick={handleCrearLote}>
              Guardar Lote
            </button>
          </div>
        </div>
      )}

      {/* Tercero */}
      <div className='col-md-4'>
        <label className='form-label'>Tipo de tercero</label>
        <select
          className='form-select'
          value={tipoTercero}
          onChange={e => {
            setTipoTercero(e.target.value)
            setSelectedCliente('')
            setSelectedProveedor('')
          }}
        >
          <option value=''>Seleccione tipo</option>
          <option value='cliente'>Cliente</option>
          <option value='proveedor'>Proveedor</option>
        </select>
      </div>

      {tipoTercero === 'cliente' && (
        <div className='col-md-8'>
          <label className='form-label'>Cliente</label>
          <select
            className='form-select'
            value={selectedCliente}
            onChange={e => setSelectedCliente(e.target.value)}
          >
            <option value=''>Seleccione un cliente</option>
            {clientes.map(c => (
              <option
                key={c.id_Cliente || c.Id_Cliente}
                value={c.id_Cliente || c.Id_Cliente}
              >
                {c.Nombre} ({c.id_Cliente || c.Id_Cliente})
              </option>
            ))}
          </select>
        </div>
      )}

      {tipoTercero === 'proveedor' && (
        <div className='col-md-8'>
          <label className='form-label'>Proveedor</label>
          <select
            className='form-select'
            value={selectedProveedor}
            onChange={e => setSelectedProveedor(e.target.value)}
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
        </div>
      )}

      {/* Switch Peso */}
      <div className='col-12 d-flex align-items-center gap-2'>
        <input
          id='pesoReq'
          type='checkbox'
          className='form-check-input'
          checked={pesoRequerido}
          onChange={e => setPesoRequerido(e.target.checked)}
        />
        <label htmlFor='pesoReq' className='form-check-label'>
          Requerir PesoUnitarioKg en cada fila
        </label>
      </div>

      {/* Tabla de filas */}
      <div className='col-12'>
        <div className='table-responsive'>
          <table className='table table-sm align-middle'>
            <thead>
              <tr>
                <th style={{ width: '45%' }}>Producto</th>
                <th style={{ width: '20%' }}>Cantidad</th>
                <th style={{ width: '25%' }}>
                  PesoUnitarioKg {pesoRequerido ? '*' : '(opcional)'}
                </th>
                <th style={{ width: '10%' }} className='text-end'>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <select
                      className='form-select'
                      value={r.id_producto}
                      onChange={e =>
                        updateRow(r.id, 'id_producto', e.target.value)
                      }
                    >
                      <option value=''>Seleccione un producto</option>
                      {productos.map(p => (
                        <option key={p.Id_producto} value={p.Id_producto}>
                          {p.Nombre} ({p.Id_producto})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type='number'
                      step='0.01'
                      className='form-control'
                      value={r.cantidad}
                      onChange={e =>
                        updateRow(r.id, 'cantidad', e.target.value)
                      }
                      placeholder='0.00'
                    />
                  </td>
                  <td>
                    <input
                      type='number'
                      step='0.01'
                      className='form-control'
                      value={r.peso}
                      onChange={e => updateRow(r.id, 'peso', e.target.value)}
                      placeholder={pesoRequerido ? 'Obligatorio' : 'Opcional'}
                    />
                  </td>
                  <td className='text-end'>
                    <button
                      type='button'
                      className='btn btn-outline-danger btn-sm'
                      onClick={() => removeRow(r.id)}
                      title='Quitar fila'
                      disabled={rows.length === 1}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className='d-flex gap-2'>
          <button
            type='button'
            className='btn btn-outline-primary'
            onClick={addRow}
          >
            + Agregar fila
          </button>
          <button
            type='button'
            className='btn-agregarform'
            disabled={loading}
            onClick={onSubmit}
          >
            {loading ? 'Guardando...' : 'Guardar Carga Masiva'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default FormLote
