// src/components/Inventario/Transformaciones/pintarTransformacion.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Webcam from 'react-webcam'
import {
  getInventarioDetalle,
  registrarTransformacion,
  getProductos,
  getBodegas,
  getUbicaciones,
  getOperaciones,
} from './TransformacionService'

// ---- helpers token → id_personal
const getAuthToken = () => localStorage.getItem('token') || ''
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
  } catch {
    return ''
  }
}

// Serializa FormData para el único log por iteración
const serializeFormData = fd => {
  const out = {}
  for (const [k, v] of fd.entries()) {
    if (v instanceof File) {
      out[k] = { __file: true, name: v.name, size: v.size, type: v.type }
    } else {
      out[k] = v
    }
  }
  return out
}

const PintarTransformacion = ({ transformacionData }) => {
  const token = getAuthToken()
  const personalId = token ? obtenerIdPersonal(token) : ''

  // Catálogos / datos base
  const [inventarioData, setInventarioData] = useState([])
  const [productos, setProductos] = useState([])
  const [bodegas, setBodegas] = useState([])
  const [ubicaciones, setUbicaciones] = useState([])
  const [operaciones, setOperaciones] = useState([])
  const [loading, setLoading] = useState(true)

  // Estado de envío / status
  const [procesando, setProcesando] = useState(false)
  const [status, setStatus] = useState(null) // {type, text}
  const [progreso, setProgreso] = useState([]) // [{idx, estado, mensaje}]

  // Inventario origen
  const idLP = transformacionData?.LoteProducto?.Id_lote_producto ?? ''
  const inventarioCoincidente = useMemo(
    () =>
      (inventarioData || []).find(
        i => i?.LoteProducto?.id_lote_producto === idLP
      ),
    [inventarioData, idLP]
  )

  // Cantidad del paso (UNIDADES) desde la tabla
  const cantidadPaso = Number(transformacionData?.Cantidad) || ''

  // Formulario GLOBAL
  const [globalForm, setGlobalForm] = useState({
    Id_lote: '',
    Id_producto: '',
    Id_Personal: personalId,
    id_bodega_origen: '',
    id_ubicacion_origen: '',
    id_bodega_destino: '',
    id_ubicacion_destino: '',
    Comentario: '',
    operacion: '',
    Cantidad_consumada: cantidadPaso,
  })

  // Ítems (carrito)
  const [items, setItems] = useState([])
  const [draftItem, setDraftItem] = useState({
    Id_producto_new: '',
    Cantidad_generada: '',
    Tipos_transformacion: '',
  })

  // Cámara
  const [cameraIndex, setCameraIndex] = useState(null)
  const webcamRef = useRef(null)

  // Carga inicial
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [inv, prods, bods, ubis, ops] = await Promise.all([
          getInventarioDetalle(),
          getProductos(),
          getBodegas(),
          getUbicaciones(),
          getOperaciones().catch(() => []),
        ])
        setInventarioData(inv || [])
        setProductos(prods || [])
        setBodegas(bods || [])
        setUbicaciones(ubis || [])
        setOperaciones(Array.isArray(ops) ? ops : [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Autocompletar origen global + Cantidad_consumada
  useEffect(() => {
    setGlobalForm(prev => ({
      ...prev,
      Id_lote:
        transformacionData?.LoteProducto?.Lote?.Id_lote ||
        inventarioCoincidente?.LoteProducto?.Lote?.Id_lote ||
        '',
      Id_producto: inventarioCoincidente?.Producto?.Id_producto || '',
      id_bodega_origen: inventarioCoincidente?.id_bodega || '',
      id_ubicacion_origen: inventarioCoincidente?.id_ubicacion || '',
      Id_Personal: personalId,
      Cantidad_consumada: cantidadPaso,
    }))
  }, [transformacionData, inventarioCoincidente, personalId, cantidadPaso])

  // Ubicaciones destino según bodega
  const ubicacionesDestino = useMemo(() => {
    const idB = globalForm.id_bodega_destino
    if (!idB) return []
    return (ubicaciones || []).filter(u => String(u.id_bodega) === String(idB))
  }, [ubicaciones, globalForm.id_bodega_destino])

  // Handlers
  const onGlobalChange = e => {
    const { name, value } = e.target
    setGlobalForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'id_bodega_destino' ? { id_ubicacion_destino: '' } : {}),
    }))
  }

  const onDraftChange = e => {
    const { name, value } = e.target
    setDraftItem(prev => ({ ...prev, [name]: value }))
  }

  const addItem = () => {
    const { Id_producto_new, Cantidad_generada, Tipos_transformacion } =
      draftItem
    const cant = Number(Cantidad_generada)
    if (!Id_producto_new || !cant || cant <= 0 || !Tipos_transformacion) {
      setStatus({
        type: 'error',
        text: 'Completa producto, tipo y cantidad (>0).',
      })
      setTimeout(() => setStatus(null), 2000)
      return
    }
    setItems(prev => [
      ...prev,
      {
        ...draftItem,
        Cantidad_generada: cant,
        evidenciaFile: null,
        evidenciaName: '',
      },
    ])
    setDraftItem({
      Id_producto_new: '',
      Cantidad_generada: '',
      Tipos_transformacion: '',
    })
  }

  const removeItem = idx => setItems(prev => prev.filter((_, i) => i !== idx))

  const onFileForItem = (idx, file) => {
    setItems(prev => {
      const copy = [...prev]
      copy[idx] = {
        ...copy[idx],
        evidenciaFile: file || null,
        evidenciaName: file?.name || '',
      }
      return copy
    })
  }

  const openCameraForItem = idx => setCameraIndex(idx)
  const closeCamera = () => setCameraIndex(null)
  const captureForItem = () => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (!imageSrc) return
    fetch(imageSrc)
      .then(r => r.blob())
      .then(blob => {
        const file = new File(
          [blob],
          `foto-transform-${cameraIndex}-${Date.now()}.jpg`,
          { type: 'image/jpeg' }
        )
        onFileForItem(cameraIndex, file)
        setCameraIndex(null)
      })
  }

  const allRequiredGlobal =
    globalForm.Id_lote &&
    globalForm.Id_producto &&
    globalForm.id_bodega_origen &&
    globalForm.id_ubicacion_origen &&
    globalForm.id_bodega_destino &&
    globalForm.id_ubicacion_destino &&
    globalForm.Comentario

  const allItemsHaveEvidence =
    items.length > 0 && items.every(it => !!it.evidenciaFile)

  const handleSubmit = async e => {
    e.preventDefault()
    setStatus(null)

    if (!allRequiredGlobal) {
      setStatus({
        type: 'error',
        text: 'Completa campos globales y comentario.',
      })
      setTimeout(() => setStatus(null), 2200)
      return
    }
    if (!items.length) {
      setStatus({ type: 'error', text: 'Agrega al menos un ítem destino.' })
      setTimeout(() => setStatus(null), 1800)
      return
    }
    if (!allItemsHaveEvidence) {
      setStatus({ type: 'error', text: 'Cada ítem debe tener evidencia.' })
      setTimeout(() => setStatus(null), 2200)
      return
    }

    setProcesando(true)
    setProgreso(
      items.map((_, idx) => ({ idx, estado: 'pendiente', mensaje: '' }))
    )

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const fd = new FormData()

      // Globales
      fd.append('Id_lote', globalForm.Id_lote)
      fd.append('Id_producto', globalForm.Id_producto) // ORIGEN (fijo)
      fd.append('Id_Personal', globalForm.Id_Personal || '')
      fd.append('id_bodega_origen', globalForm.id_bodega_origen)
      fd.append('id_ubicacion_origen', globalForm.id_ubicacion_origen)
      fd.append('id_bodega_destino', globalForm.id_bodega_destino)
      fd.append('id_ubicacion_destino', globalForm.id_ubicacion_destino)
      fd.append('Comentario', globalForm.Comentario)
      if (globalForm.operacion) fd.append('operacion', globalForm.operacion)

      // 👉 Cantidad_consumada en CADA iteración (como pediste)
      fd.append(
        'Cantidad_consumida',
        String(globalForm.Cantidad_consumada ?? '')
      )

      // Por ítem
      fd.append('Id_producto_new', it.Id_producto_new)
      fd.append('Cantidad_generada', String(it.Cantidad_generada))
      fd.append('Tipos_transformacion', it.Tipos_transformacion)
      fd.append('evidencia', it.evidenciaFile)

      // ÚNICO LOG por iteración: lo que enviamos al backend para este producto
      const serialized = serializeFormData(fd)
      console.log(
        `📤 [TX ${i + 1}/${items.length}] /historial-transformacion`,
        serialized
      )

      try {
        await registrarTransformacion(fd)
        setProgreso(prev => {
          const copy = [...prev]
          copy[i] = { idx: i, estado: 'ok', mensaje: 'OK' }
          return copy
        })
      } catch (err) {
        setProgreso(prev => {
          const copy = [...prev]
          copy[i] = {
            idx: i,
            estado: 'error',
            mensaje: err?.response?.data?.message || err?.message || 'Error',
          }
          return copy
        })
      }
    }

    setProcesando(false)
    setTimeout(() => {
      const huboError = (progreso || []).some(p => p.estado === 'error')
      setStatus({
        type: huboError ? 'error' : 'success',
        text: huboError
          ? 'Proceso finalizado con errores.'
          : 'Transformaciones registradas.',
      })
      setItems([])
      setTimeout(() => setStatus(null), 2800)
    }, 0)
  }

  // Ordenar operaciones (OP###)
  const operacionesOrdenadas = useMemo(() => {
    const toNum = id => Number(String(id || '').replace(/\D+/g, '')) || 0
    return [...operaciones].sort(
      (a, b) => toNum(b.id_operacion) - toNum(a.id_operacion)
    )
  }, [operaciones])

  return (
    <div className='container-fluid py-3'>
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
        {/* Izquierda: formulario */}
        <div className='col-lg-7'>
          <div className='card shadow-sm'>
            <div className='card-header d-flex justify-content-between align-items-center'>
              <h6 className='m-0'>Transformación (masivo por ítems)</h6>
              {loading && <span className='badge bg-secondary'>Cargando…</span>}
            </div>

            <div className='card-body'>
              <form onSubmit={handleSubmit} encType='multipart/form-data'>
                <div className='row g-2'>
                  <div className='col-md-4'>
                    <label className='form-label mb-1'>Lote</label>
                    <input
                      className='form-control form-control-sm'
                      value={globalForm.Id_lote}
                      readOnly
                    />
                  </div>
                  <div className='col-md-8'>
                    <label className='form-label mb-1'>Producto origen</label>
                    <input
                      className='form-control form-control-sm'
                      readOnly
                      value={
                        inventarioCoincidente?.Producto
                          ? `${inventarioCoincidente?.Producto?.Nombre} (ID: ${inventarioCoincidente?.Producto?.Id_producto})`
                          : ''
                      }
                    />
                  </div>
                </div>

                <div className='row g-2 mt-1'>
                  <div className='col-md-4'>
                    <label className='form-label mb-1'>
                      Cantidad consumida (UN)
                    </label>
                    <input
                      className='form-control form-control-sm'
                      value={globalForm.Cantidad_consumada ?? ''}
                      readOnly
                    />
                  </div>
                  <div className='col-md-4'>
                    <label className='form-label mb-1'>Bodega destino</label>
                    <select
                      className='form-select form-select-sm'
                      name='id_bodega_destino'
                      value={globalForm.id_bodega_destino}
                      onChange={onGlobalChange}
                    >
                      <option value=''>Seleccione bodega</option>
                      {bodegas.map(b => (
                        <option key={b.id_bodega} value={b.id_bodega}>
                          {b.nombre} (ID: {b.id_bodega})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className='col-md-4'>
                    <label className='form-label mb-1'>Ubicación destino</label>
                    <select
                      className='form-select form-select-sm'
                      name='id_ubicacion_destino'
                      value={globalForm.id_ubicacion_destino}
                      onChange={onGlobalChange}
                      disabled={!globalForm.id_bodega_destino}
                    >
                      <option value=''>
                        {globalForm.id_bodega_destino
                          ? 'Seleccione ubicación'
                          : 'Seleccione bodega primero'}
                      </option>
                      {ubicacionesDestino.map(u => (
                        <option key={u.id_ubicacion} value={u.id_ubicacion}>
                          {u.nombre} (ID: {u.id_ubicacion})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className='row g-2 mt-1'>
                  <div className='col-md-6'>
                    <label className='form-label mb-1'>
                      Operación (opcional)
                    </label>
                    <select
                      className='form-select form-select-sm'
                      name='operacion'
                      value={globalForm.operacion}
                      onChange={onGlobalChange}
                    >
                      <option value=''>Sin operación</option>
                      {operacionesOrdenadas.map(op => (
                        <option key={op.id_operacion} value={op.id_operacion}>
                          {op.id_operacion}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className='col-md-6'>
                    <label className='form-label mb-1'>Comentario global</label>
                    <input
                      className='form-control form-control-sm'
                      name='Comentario'
                      value={globalForm.Comentario}
                      onChange={onGlobalChange}
                      placeholder='Notas u observaciones…'
                    />
                  </div>
                </div>

                {/* Sub-ítem */}
                <div className='mt-3 p-2 border rounded'>
                  <div className='small text-muted fw-semibold mb-2'>
                    Agregar ítem (destino)
                  </div>

                  <div className='row g-2'>
                    <div className='col-md-5'>
                      <label className='form-label mb-1'>
                        Producto destino
                      </label>
                      <select
                        className='form-select form-select-sm'
                        name='Id_producto_new'
                        value={draftItem.Id_producto_new}
                        onChange={onDraftChange}
                      >
                        <option value=''>Seleccione producto</option>
                        {productos.map(p => (
                          <option key={p.Id_producto} value={p.Id_producto}>
                            {p.Nombre} (ID: {p.Id_producto})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className='col-md-3'>
                      <label className='form-label mb-1'>Tipo</label>
                      <select
                        className='form-select form-select-sm'
                        name='Tipos_transformacion'
                        value={draftItem.Tipos_transformacion}
                        onChange={onDraftChange}
                      >
                        <option value=''>Seleccione</option>
                        <option value='Limpieza'>Limpieza</option>
                        <option value='Corte'>Corte</option>
                        <option value='Re-Ubicación'>Re-Ubicación</option>
                      </select>
                    </div>
                    <div className='col-md-2'>
                      <label className='form-label mb-1'>Kg generados</label>
                      <input
                        type='number'
                        min='0'
                        step='any'
                        className='form-control form-control-sm'
                        name='Cantidad_generada'
                        value={draftItem.Cantidad_generada}
                        onChange={onDraftChange}
                      />
                    </div>
                    <div className='col-md-2 d-grid'>
                      <button
                        type='button'
                        className='btn btn-primary btn-sm mt-4'
                        onClick={addItem}
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de ítems */}
                <div className='mt-3'>
                  <div className='d-flex justify-content-between align-items-center mb-2'>
                    <span className='small text-muted'>
                      Ítems a procesar: <strong>{items.length}</strong>
                    </span>
                    <button
                      type='button'
                      className='btn btn-outline-danger btn-sm'
                      onClick={() => setItems([])}
                      disabled={!items.length || procesando}
                    >
                      Vaciar
                    </button>
                  </div>

                  <div className='table-responsive'>
                    <table className='table table-sm table-striped align-middle'>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Producto destino</th>
                          <th className='text-end'>Kg generados</th>
                          <th>Tipo</th>
                          <th>Evidencia</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan='6' className='text-center text-muted'>
                              Sin ítems
                            </td>
                          </tr>
                        ) : (
                          items.map((it, idx) => (
                            <tr key={`${it.Id_producto_new}-${idx}`}>
                              <td>{idx + 1}</td>
                              <td>
                                <div className='fw-semibold'>
                                  {productos.find(
                                    p => p.Id_producto === it.Id_producto_new
                                  )?.Nombre || it.Id_producto_new}
                                </div>
                                <div className='text-muted small'>
                                  {it.Id_producto_new}
                                </div>
                              </td>
                              <td className='text-end'>
                                {it.Cantidad_generada}
                              </td>
                              <td>{it.Tipos_transformacion}</td>
                              <td>
                                <div className='d-flex flex-column gap-2'>
                                  <div className='d-flex gap-2'>
                                    <button
                                      type='button'
                                      className='btn btn-outline-secondary btn-sm'
                                      onClick={() => openCameraForItem(idx)}
                                      disabled={procesando}
                                    >
                                      Usar cámara
                                    </button>
                                    <button
                                      type='button'
                                      className='btn btn-outline-secondary btn-sm'
                                      onClick={() =>
                                        document
                                          .getElementById(`file-item-${idx}`)
                                          .click()
                                      }
                                      disabled={procesando}
                                    >
                                      Subir imagen
                                    </button>
                                  </div>
                                  <input
                                    id={`file-item-${idx}`}
                                    type='file'
                                    accept='image/*'
                                    hidden
                                    onChange={e =>
                                      onFileForItem(
                                        idx,
                                        e.target.files?.[0] || null
                                      )
                                    }
                                  />
                                  <div className='small'>
                                    {it.evidenciaName ? (
                                      <span className='text-success'>
                                        Archivo:{' '}
                                        <strong>{it.evidenciaName}</strong>
                                      </span>
                                    ) : (
                                      <span className='text-danger'>
                                        Sin evidencia
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className='text-end'>
                                <button
                                  type='button'
                                  className='btn btn-outline-danger btn-sm'
                                  onClick={() => removeItem(idx)}
                                  disabled={procesando}
                                >
                                  Eliminar
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Cámara */}
                  {cameraIndex !== null && (
                    <div
                      className='mt-3 border rounded p-3'
                      style={{ minHeight: 320 }}
                    >
                      <div className='d-flex justify-content-between align-items-center mb-2'>
                        <div className='fw-semibold'>
                          Cámara — ítem #{cameraIndex + 1}
                        </div>
                        <button
                          type='button'
                          className='btn btn-outline-dark btn-sm'
                          onClick={closeCamera}
                        >
                          Cerrar
                        </button>
                      </div>
                      <div className='ratio ratio-16x9'>
                        <Webcam
                          ref={webcamRef}
                          screenshotFormat='image/jpeg'
                          videoConstraints={{ facingMode: 'environment' }}
                          className='w-100 h-100'
                        />
                      </div>
                      <div className='d-flex justify-content-center gap-3 mt-3'>
                        <button
                          type='button'
                          className='btn btn-primary btn-sm'
                          onClick={captureForItem}
                        >
                          Capturar
                        </button>
                        <button
                          type='button'
                          className='btn btn-outline-danger btn-sm'
                          onClick={closeCamera}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Progreso */}
                {procesando && (
                  <div className='mt-3'>
                    <div className='small text-muted mb-2'>Procesando…</div>
                    <div className='list-group'>
                      {items.map((it, i) => {
                        const p = progreso.find(x => x.idx === i)
                        const estado = p?.estado || 'pendiente'
                        const badge =
                          estado === 'ok'
                            ? 'bg-success'
                            : estado === 'error'
                            ? 'bg-danger'
                            : 'bg-secondary'
                        return (
                          <div
                            key={i}
                            className='list-group-item d-flex justify-content-between align-items-center'
                          >
                            <span>
                              {productos.find(
                                p => p.Id_producto === it.Id_producto_new
                              )?.Nombre || it.Id_producto_new}{' '}
                              — {it.Cantidad_generada} kg —{' '}
                              {it.Tipos_transformacion}
                            </span>
                            <span className={`badge ${badge}`}>{estado}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className='d-grid mt-3'>
                  <button
                    type='submit'
                    className='btn btn-primary btn-sm'
                    disabled={
                      procesando ||
                      !allRequiredGlobal ||
                      !items.length ||
                      !allItemsHaveEvidence
                    }
                    title={
                      !items.length
                        ? 'Agrega ítems'
                        : !allItemsHaveEvidence
                        ? 'Cada ítem requiere evidencia'
                        : 'Enviar'
                    }
                  >
                    {procesando ? 'Guardando…' : 'Registrar Transformaciones'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Derecha: paneles */}
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
                  <strong>Producto origen:</strong>{' '}
                  {inventarioCoincidente?.Producto?.Nombre || '—'} (ID:{' '}
                  {inventarioCoincidente?.Producto?.Id_producto || '—'})
                </li>
                <li className='list-group-item'>
                  <strong>Cantidad consumida (UN):</strong>{' '}
                  {globalForm.Cantidad_consumada ?? '—'}
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
                  <span>Cargando datos…</span>
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
                          {inventarioCoincidente?.Bodega?.nombre || '—'}
                          <br />
                          <small className='text-muted'>
                            ID: {inventarioCoincidente?.id_bodega || '—'}
                          </small>
                        </td>
                        <td>
                          {inventarioCoincidente?.UbicacionBodega?.nombre ||
                            '—'}
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
                  No se encontró inventario para el LP seleccionado.
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
