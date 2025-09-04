// src/components/Inventario/Transformaciones/PintarTransformacion.jsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  getInventarioDetalle,
  registrarTransformacion,
  getProductos,
  getBodegas,
  getUbicaciones,
  getOperaciones, // 👈 nuevo: para llenar el select de Operación (opcional)
} from './TransformacionService'

const obtenerIdPersonal = token => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload).id_personal
  } catch (error) {
    console.error('Error al decodificar el token:', error)
    return ''
  }
}

const getAuthToken = () => localStorage.getItem('token') || ''

const PintarTransformacion = ({ transformacionData }) => {
  const token = getAuthToken()
  const personalId = token ? obtenerIdPersonal(token) : ''

  const [inventarioData, setInventarioData] = useState([])
  const [productos, setProductos] = useState([])
  const [bodegas, setBodegas] = useState([])
  const [ubicaciones, setUbicaciones] = useState([])
  const [operaciones, setOperaciones] = useState([]) // 👈 lista para el select
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState(null) // {type: 'success'|'error', text: string}

  const loteProductoTransformacion =
    transformacionData?.LoteProducto?.Id_lote_producto

  const inventarioCoincidente = useMemo(
    () =>
      inventarioData.find(
        item =>
          item?.LoteProducto?.id_lote_producto === loteProductoTransformacion
      ),
    [inventarioData, loteProductoTransformacion]
  )

  const [formData, setFormData] = useState({
    Id_lote: '',
    Cantidad_generada: '',
    Tipos_transformacion: '',
    Id_producto: '',
    Id_producto_new: '',
    id_bodega_origen: '',
    id_bodega_destino: '',
    id_ubicacion_origen: '',
    id_ubicacion_destino: '',
    Comentario: '',
    operacion: '', // 👈 NUEVO (opcional)
    Id_Personal: personalId,
    evidencia: null,
  })

  // Carga inicial
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [inventario, prods, bods, ubis, ops] = await Promise.all([
          getInventarioDetalle(),
          getProductos(),
          getBodegas(),
          getUbicaciones(),
          getOperaciones()?.catch(() => []), // por si no existe en el backend aún
        ])
        setInventarioData(inventario || [])
        setProductos(prods || [])
        setBodegas(bods || [])
        setUbicaciones(ubis || [])
        setOperaciones(Array.isArray(ops) ? ops : [])
      } catch (error) {
        console.error('Error al obtener datos:', error)
        setInventarioData([])
        setProductos([])
        setBodegas([])
        setUbicaciones([])
        setOperaciones([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Autocompletar campos origen con el inventario coincidente
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      Id_lote:
        transformacionData?.LoteProducto?.Lote?.Id_lote ||
        inventarioCoincidente?.LoteProducto?.Lote?.Id_lote ||
        '',
      Id_producto: inventarioCoincidente?.Producto?.Id_producto || '',
      id_bodega_origen: inventarioCoincidente?.id_bodega || '',
      id_ubicacion_origen: inventarioCoincidente?.id_ubicacion || '',
      Id_Personal: personalId,
    }))
  }, [transformacionData, inventarioCoincidente, personalId])

  // Ubicaciones destino filtradas por bodega destino
  const ubicacionesDestino = useMemo(() => {
    if (!formData.id_bodega_destino) return []
    return (ubicaciones || []).filter(
      u => String(u.id_bodega) === String(formData.id_bodega_destino)
    )
  }, [ubicaciones, formData.id_bodega_destino])

  const handleInputChange = e => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'id_bodega_destino' ? { id_ubicacion_destino: '' } : {}),
    }))
  }

  const handleFileChange = e => {
    setFormData(prev => ({ ...prev, evidencia: e.target.files[0] || null }))
  }

  const requiredOk =
    formData.Cantidad_generada &&
    formData.Tipos_transformacion &&
    formData.Id_producto_new &&
    formData.id_bodega_destino &&
    formData.id_ubicacion_destino &&
    formData.evidencia

  const handleSubmit = async e => {
    e.preventDefault()
    setStatus(null)

    if (!requiredOk) {
      setStatus({
        type: 'error',
        text: 'Completa los campos obligatorios y adjunta evidencia.',
      })
      return
    }

    const payload = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      // Operación es opcional; el resto se envía si tiene valor
      if (value !== null && value !== '') payload.append(key, value)
    })

    try {
      setSubmitting(true)
      await registrarTransformacion(payload)
      setStatus({ type: 'success', text: 'Transformación registrada ✅' })

      // Reset “suave” (mantener origen autocompletado)
      setFormData(prev => ({
        ...prev,
        Cantidad_generada: '',
        Tipos_transformacion: '',
        Id_producto_new: '',
        id_bodega_destino: '',
        id_ubicacion_destino: '',
        Comentario: '',
        operacion: '',
        evidencia: null,
      }))
    } catch (error) {
      console.error('Error al registrar transformación:', error)
      setStatus({ type: 'error', text: 'Error al registrar ❌' })
    } finally {
      setSubmitting(false)
      setTimeout(() => setStatus(null), 2500)
    }
  }

  // Ordenar operaciones por número (si son tipo "OP001")
  const operacionesOrdenadas = useMemo(() => {
    const toNum = id => Number(String(id || '').replace(/\D+/g, '')) || 0
    return [...operaciones].sort(
      (a, b) => toNum(b.id_operacion) - toNum(a.id_operacion)
    )
  }, [operaciones])

  return (
    <div className='container-fluid py-3'>
      {/* Status flotante */}
      {status && (
        <div
          className={`alert ${
            status.type === 'success' ? 'alert-success' : 'alert-danger'
          } text-center`}
          role='status'
        >
          {status.text}
        </div>
      )}

      <div className='row g-3'>
        {/* Columna izquierda: Formulario */}
        <div className='col-lg-7'>
          <div className='card shadow-sm'>
            <div className='card-header d-flex align-items-center justify-content-between'>
              <h6 className='m-0'>Formulario de Transformación</h6>
              {loading && <span className='badge bg-secondary'>Cargando…</span>}
            </div>
            <div className='card-body'>
              <form encType='multipart/form-data' onSubmit={handleSubmit}>
                {/* Lote & Cantidad */}
                <div className='row g-2'>
                  <div className='col-md-6'>
                    <label className='form-label mb-1'>ID Lote</label>
                    <input
                      type='text'
                      className='form-control form-control-sm'
                      name='Id_lote'
                      value={formData.Id_lote}
                      readOnly
                    />
                  </div>
                  <div className='col-md-6'>
                    <label className='form-label mb-1'>Cantidad generada</label>
                    <input
                      type='number'
                      min='0'
                      step='any'
                      className='form-control form-control-sm'
                      name='Cantidad_generada'
                      value={formData.Cantidad_generada}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                {/* Tipo & Producto Origen (readonly) */}
                <div className='row g-2 mt-1'>
                  <div className='col-md-6'>
                    <label className='form-label mb-1'>
                      Tipo transformación
                    </label>
                    <select
                      className='form-select form-select-sm'
                      name='Tipos_transformacion'
                      value={formData.Tipos_transformacion}
                      onChange={handleInputChange}
                    >
                      <option value=''>Seleccione un tipo</option>
                      <option value='Limpieza'>Limpieza</option>
                      <option value='Corte'>Corte</option>
                      <option value='Re-Ubicación'>Re-Ubicación</option>
                    </select>
                  </div>

                  <div className='col-md-6'>
                    <label className='form-label mb-1'>Producto origen</label>
                    <input
                      type='text'
                      className='form-control form-control-sm'
                      readOnly
                      value={`${
                        inventarioCoincidente?.Producto?.Nombre || ''
                      } (ID: ${
                        inventarioCoincidente?.Producto?.Id_producto || '—'
                      })`}
                    />
                  </div>
                </div>

                {/* Producto Destino & Bodega Origen (readonly) */}
                <div className='row g-2 mt-1'>
                  <div className='col-md-6'>
                    <label className='form-label mb-1'>
                      Producto destino (ID)
                    </label>
                    <select
                      className='form-select form-select-sm'
                      name='Id_producto_new'
                      value={formData.Id_producto_new}
                      onChange={handleInputChange}
                    >
                      <option value=''>Seleccione producto</option>
                      {productos.map(p => (
                        <option key={p.Id_producto} value={p.Id_producto}>
                          {p.Nombre} (ID: {p.Id_producto})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className='col-md-6'>
                    <label className='form-label mb-1'>Bodega origen</label>
                    <input
                      type='text'
                      className='form-control form-control-sm'
                      readOnly
                      value={`${
                        inventarioCoincidente?.Bodega?.nombre || ''
                      } (ID: ${inventarioCoincidente?.id_bodega || '—'})`}
                    />
                  </div>
                </div>

                {/* Bodega/Ubicación destino & Ubicación Origen (readonly) */}
                <div className='row g-2 mt-1'>
                  <div className='col-md-6'>
                    <label className='form-label mb-1'>Bodega destino</label>
                    <select
                      className='form-select form-select-sm'
                      name='id_bodega_destino'
                      value={formData.id_bodega_destino}
                      onChange={handleInputChange}
                    >
                      <option value=''>Seleccione bodega</option>
                      {bodegas.map(b => (
                        <option key={b.id_bodega} value={b.id_bodega}>
                          {b.nombre} (ID: {b.id_bodega})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className='col-md-6'>
                    <label className='form-label mb-1'>Ubicación origen</label>
                    <input
                      type='text'
                      className='form-control form-control-sm'
                      readOnly
                      value={`${
                        inventarioCoincidente?.UbicacionBodega?.nombre || ''
                      } (ID: ${inventarioCoincidente?.id_ubicacion || '—'})`}
                    />
                  </div>
                </div>

                <div className='row g-2 mt-1'>
                  <div className='col-md-6'>
                    <label className='form-label mb-1'>Ubicación destino</label>
                    <select
                      className='form-select form-select-sm'
                      name='id_ubicacion_destino'
                      value={formData.id_ubicacion_destino}
                      onChange={handleInputChange}
                      disabled={!formData.id_bodega_destino}
                    >
                      <option value=''>
                        {formData.id_bodega_destino
                          ? 'Seleccione ubicación'
                          : 'Seleccione una bodega primero'}
                      </option>
                      {ubicacionesDestino.map(u => (
                        <option key={u.id_ubicacion} value={u.id_ubicacion}>
                          {u.nombre} (ID: {u.id_ubicacion})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className='col-md-6'>
                    <label className='form-label mb-1'>Evidencia</label>
                    <input
                      type='file'
                      className='form-control form-control-sm'
                      name='evidencia'
                      onChange={handleFileChange}
                      accept='image/*'
                    />
                  </div>
                </div>

                {/* Operación (opcional) */}
                <div className='row g-2 mt-1'>
                  <div className='col-md-6'>
                    <label className='form-label mb-1'>
                      Operación (opcional)
                    </label>
                    <select
                      className='form-select form-select-sm'
                      name='operacion'
                      value={formData.operacion}
                      onChange={handleInputChange}
                    >
                      <option value=''>Sin operación</option>
                      {operacionesOrdenadas.map(op => (
                        <option key={op.id_operacion} value={op.id_operacion}>
                          {op.id_operacion}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Comentario */}
                <div className='mt-2'>
                  <label className='form-label mb-1'>Comentario</label>
                  <textarea
                    className='form-control form-control-sm'
                    name='Comentario'
                    rows={2}
                    value={formData.Comentario}
                    onChange={handleInputChange}
                  />
                </div>

                {/* IDs ocultos backend */}
                <input
                  type='hidden'
                  name='Id_Personal'
                  value={formData.Id_Personal}
                />
                <input
                  type='hidden'
                  name='Id_producto'
                  value={formData.Id_producto}
                />
                <input
                  type='hidden'
                  name='id_bodega_origen'
                  value={formData.id_bodega_origen}
                />
                <input
                  type='hidden'
                  name='id_ubicacion_origen'
                  value={formData.id_ubicacion_origen}
                />

                <div className='d-grid mt-3'>
                  <button
                    type='submit'
                    className='btn btn-primary btn-sm'
                    disabled={submitting || !requiredOk}
                    title={
                      requiredOk
                        ? 'Enviar'
                        : 'Completa datos requeridos y adjunta evidencia'
                    }
                  >
                    {submitting ? 'Guardando…' : 'Registrar Transformación'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Columna derecha: Información / tabla inventario */}
        <div className='col-lg-5'>
          <div className='card shadow-sm mb-3'>
            <div className='card-header'>
              <h6 className='m-0'>Resumen del Lote / Producto</h6>
            </div>
            <div className='card-body'>
              <ul className='list-group list-group-flush'>
                <li className='list-group-item'>
                  <strong>Lote:</strong>{' '}
                  {transformacionData?.LoteProducto?.Lote?.Id_lote ||
                    inventarioCoincidente?.LoteProducto?.Lote?.Id_lote ||
                    '—'}
                </li>
                <li className='list-group-item'>
                  <strong>Producto:</strong>{' '}
                  {inventarioCoincidente?.Producto?.Nombre || '—'} (ID:{' '}
                  {inventarioCoincidente?.Producto?.Id_producto || '—'})
                </li>
              </ul>
            </div>
          </div>

          <div className='card shadow-sm'>
            <div className='card-header'>
              <h6 className='m-0'>Inventario Coincidente</h6>
            </div>
            <div className='card-body'>
              {loading ? (
                <div className='d-flex align-items-center'>
                  <div className='spinner-border me-2' role='status' />
                  <span>Cargando datos de inventario…</span>
                </div>
              ) : inventarioCoincidente ? (
                <div className='table-responsive'>
                  <table className='table table-sm table-bordered align-middle text-center mb-0'>
                    <thead className='table-light'>
                      <tr>
                        <th>ID Inventario</th>
                        <th>Bodega</th>
                        <th>Ubicación</th>
                        <th>Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{inventarioCoincidente.id_inventario}</td>
                        <td>
                          {inventarioCoincidente?.Bodega?.nombre || '—'} <br />
                          <small className='text-muted'>
                            ID: {inventarioCoincidente?.id_bodega || '—'}
                          </small>
                        </td>
                        <td>
                          {inventarioCoincidente?.UbicacionBodega?.nombre ||
                            '—'}{' '}
                          <br />
                          <small className='text-muted'>
                            ID: {inventarioCoincidente?.id_ubicacion || '—'}
                          </small>
                        </td>
                        <td>{inventarioCoincidente?.Cantidad ?? '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className='text-muted'>
                  No se encontró inventario para el lote producto seleccionado.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PintarTransformacion
