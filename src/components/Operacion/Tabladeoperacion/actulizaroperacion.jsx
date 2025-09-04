// src/components/Operaciones/actulizaroperacion.jsx
import { useEffect, useMemo, useState } from 'react'
import {
  actualizarOperacion,
  getClientes,
  getTiposOperacion,
  getPersonal,
} from './operacion_service'

// --- Panel de información centrado (estilo modal light) ---
const InfoPanel = ({ open, title, message, onClose, type = 'info' }) => {
  if (!open) return null
  const isSuccess = type === 'success'
  const isError = type === 'error'
  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='info-panel-title'
      aria-describedby='info-panel-desc'
      style={{ position: 'fixed', inset: 0, zIndex: 3000 }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      <div
        className='shadow-lg rounded-3 border bg-white p-4'
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 440px)',
        }}
      >
        <h6 id='info-panel-title' className='mb-2'>
          {title}
        </h6>
        <p
          id='info-panel-desc'
          className={`mb-3 small ${
            isSuccess ? 'text-success' : isError ? 'text-danger' : 'text-muted'
          }`}
        >
          {message}
        </p>
        <div className='d-flex justify-content-end'>
          <button className='btn btn-sm btn-primary' onClick={onClose}>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Util para datetime-local ---
const toLocalInputValue = iso => {
  if (!iso) return ''
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) return iso
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

const ActualizarOperacion = ({ op, onCancel, onSuccess }) => {
  // Catálogos
  const [listaClientes, setListaClientes] = useState([])
  const [listaTiposOperacion, setListaTiposOperacion] = useState([])
  const [listaPersonal, setListaPersonal] = useState([])

  // UI
  const [loading, setLoading] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelType, setPanelType] = useState('info')
  const [panelTitle, setPanelTitle] = useState('')
  const [panelMsg, setPanelMsg] = useState('')

  // Form (⚠️ sin campos de producto/cantidad)
  const [formData, setFormData] = useState(() => ({
    id_operacion: op?.id_operacion || '',
    id_tipo_operacion: op?.id_tipo_operacion || '',
    id_lote: op?.id_lote || '',
    id_cliente: op?.id_cliente || '',
    operador_fk: op?.operador_fk || '',
    Gestion_inventario:
      op?.gestion_inventario || op?.Gestion_inventario || 'Pendiente',
    fecha_realizacion: toLocalInputValue(
      op?.fecha_realizacion || op?.fecha_realizacionISO || ''
    ),
    fecha_fin: toLocalInputValue(op?.fecha_fin || op?.fecha_finISO || ''),
  }))

  // Productos actuales (solo lectura)
  const productosActuales = useMemo(() => {
    // Estructura preferida: array [{id_producto, nombre?, cantidad}]
    if (Array.isArray(op?.productos) && op.productos.length > 0) {
      return op.productos.map(p => ({
        id_producto: String(p.id_producto),
        nombre: p.nombre ?? String(p.id_producto),
        cantidad: Number(p.cantidad ?? 0),
      }))
    }
    // Alternativa: string plano productos_text
    if (op?.productos_text) {
      return op.productos_text
    }
    return []
  }, [op])

  const totalItems = useMemo(() => {
    if (Array.isArray(productosActuales)) {
      return productosActuales.reduce(
        (acc, p) => acc + Number(p.cantidad || 0),
        0
      )
    }
    return op?.cantidad ?? 0
  }, [productosActuales, op?.cantidad])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientes, tipos, personal] = await Promise.all([
          getClientes(),
          getTiposOperacion(),
          getPersonal(),
        ])
        setListaClientes(clientes || [])
        setListaTiposOperacion(tipos || [])
        setListaPersonal(personal || [])
      } catch (err) {
        console.error('Error cargando catálogos:', err)
        setPanelType('error')
        setPanelTitle('No se pudieron cargar los catálogos')
        setPanelMsg('Revisa tu conexión o vuelve a intentarlo.')
        setPanelOpen(true)
      }
    }
    fetchData()
  }, [])

  const handleChange = e => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // 💡 Payload SIN productos / SIN cantidad
  const payload = useMemo(
    () => ({
      id_tipo_operacion: formData.id_tipo_operacion,
      id_lote: formData.id_lote, // se envía igual pero el control está bloqueado
      id_cliente: formData.id_cliente,
      operador_fk: formData.operador_fk,
      Gestion_inventario: formData.Gestion_inventario,
      fecha_realizacion: formData.fecha_realizacion
        ? new Date(formData.fecha_realizacion).toISOString()
        : null,
      fecha_fin: formData.fecha_fin
        ? new Date(formData.fecha_fin).toISOString()
        : null,
      // ❌ No enviar: id_producto, cantidad, productos
    }),
    [formData]
  )

  const handleSubmit = async e => {
    e.preventDefault()
    if (!formData.id_operacion) return
    try {
      setLoading(true)
      await actualizarOperacion(formData.id_operacion, payload)
      setLoading(false)
      setPanelType('success')
      setPanelTitle('Operación actualizada')
      setPanelMsg(
        `La operación ${formData.id_operacion} se actualizó correctamente.`
      )
      setPanelOpen(true)
    } catch (err) {
      console.error('Error al actualizar operación:', err)
      setLoading(false)
      setPanelType('error')
      setPanelTitle('No se pudo actualizar')
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Ocurrió un error inesperado al actualizar.'
      setPanelMsg(msg)
      setPanelOpen(true)
    }
  }

  const closePanel = () => {
    setPanelOpen(false)
    if (panelType === 'success') onSuccess?.()
  }

  return (
    <div className='container-fluid mt-2'>
      <h4 className='mb-3'>Editar / Actualizar Operación</h4>

      {/* Bloque informativo de productos (solo lectura) */}
      <div className='mb-3'>
        <h6 className='mb-2'>Productos (solo lectura)</h6>
        {Array.isArray(productosActuales) && productosActuales.length > 0 ? (
          <div className='table-responsive'>
            <table className='table table-sm table-bordered align-middle'>
              <thead className='table-light'>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>ID Producto</th>
                  <th>Nombre</th>
                  <th style={{ width: 160 }}>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {productosActuales.map(p => (
                  <tr key={p.id_producto}>
                    <td>{p.id_producto}</td>
                    <td>{p.nombre}</td>
                    <td>{p.cantidad}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={2} className='text-end'>
                    Total ítems
                  </th>
                  <th>{totalItems}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className='text-muted mb-0'>
            {typeof productosActuales === 'string'
              ? productosActuales
              : 'Sin productos registrados en esta operación.'}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className='row'>
          <div className='col-md-4 mb-3'>
            <label className='form-label'>ID Operación</label>
            <input
              type='text'
              className='form-control'
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
              disabled={loading}
            >
              <option value=''>Seleccione un tipo</option>
              {listaTiposOperacion.map((t, i) => (
                <option
                  key={t.id_tipo_operacion || `tipo-${i}`}
                  value={t.id_tipo_operacion}
                >
                  {t.nombre ?? t.Nombre ?? 'Tipo'} ({t.id_tipo_operacion})
                </option>
              ))}
            </select>
          </div>

          {/* Lote bloqueado para evitar inconsistencias con productos */}
          <div className='col-md-4 mb-3'>
            <label className='form-label'>Lote</label>
            <input
              type='text'
              className='form-control'
              value={formData.id_lote}
              readOnly
            />
            <div className='form-text'>
              El lote no puede modificarse porque los productos están asociados
              a él.
            </div>
          </div>
        </div>

        <div className='row'>
          <div className='col-md-4 mb-3'>
            <label className='form-label'>Cliente</label>
            <select
              className='form-select'
              name='id_cliente'
              value={formData.id_cliente}
              onChange={handleChange}
              required
              disabled={loading}
            >
              <option value=''>Seleccione un cliente</option>
              {listaClientes.map((c, i) => (
                <option key={c.id_Cliente || `cli-${i}`} value={c.id_Cliente}>
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
              disabled={loading}
            >
              <option value=''>Seleccione un operador</option>
              {listaPersonal.map((p, i) => (
                <option key={p.Id_personal || `per-${i}`} value={p.Id_personal}>
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
              value={formData.fecha_realizacion}
              onChange={handleChange}
              disabled={loading}
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
              value={formData.fecha_fin}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className='col-md-4 mb-3'>
            <label className='form-label'>Estado Inventario</label>
            <select
              className='form-select'
              name='Gestion_inventario'
              value={formData.Gestion_inventario}
              onChange={handleChange}
              disabled={loading}
            >
              <option value='Pendiente'>Pendiente</option>
              <option value='Parcial'>Parcial</option>
              <option value='Completado'>Completado</option>
            </select>
          </div>
        </div>

        <div className='d-flex gap-2 mt-3'>
          <button type='submit' className='btn btn-primary' disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button
            type='button'
            className='btn btn-secondary'
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
        </div>
      </form>

      <InfoPanel
        open={panelOpen}
        type={panelType}
        title={panelTitle}
        message={panelMsg}
        onClose={closePanel}
      />
    </div>
  )
}

export default ActualizarOperacion
