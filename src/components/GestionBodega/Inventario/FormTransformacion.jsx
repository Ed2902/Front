// src/components/Inventario/Transformaciones/FormTransformacionLotes.jsx
import { useForm } from 'react-hook-form'
import { useEffect, useState, useContext, useRef } from 'react'
import AuthContext from '../../../context/AuthContext'
import {
  getLoteProducto,
  getOperaciones,
  crearTransformacion,
  inventarioCompletoPorLoteYProducto,
} from './transformacion_service'
import Webcam from 'react-webcam'
import Modal from 'react-modal'

Modal.setAppElement('#root')

// "OP006" -> 6
const numeroDeOP = id => Number(String(id || '').replace(/^OP/i, '')) || 0

const FormTransformacionLotes = ({ onSuccess }) => {
  const { user } = useContext(AuthContext)

  // ----- Form global (operación + comentario) -----
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm()

  // ----- Sub-form (ítem) -----
  const {
    register: registerItem,
    handleSubmit: handleSubmitItem,
    setValue: setValueItem,
    watch: watchItem,
    formState: { errors: errorsItem },
  } = useForm()

  // Catálogos básicos
  const [lotes, setLotes] = useState([])
  const [operaciones, setOperaciones] = useState([])

  // Estado de editor de ítem
  const [idLoteItem, setIdLoteItem] = useState('')
  const [inventarioItem, setInventarioItem] = useState(null)
  const [cantidadDispItem, setCantidadDispItem] = useState(null)
  const [bodegaItem, setBodegaItem] = useState('')
  const [ubicacionItem, setUbicacionItem] = useState('')

  // Carrito (ítems por transformar)
  // { id_lote, id_producto, cantidad, id_bodega_origen, id_ubicacion_origen, evidenciaFile?, evidenciaName? }
  const [items, setItems] = useState([])

  // Cámara por ítem
  const [cameraIndex, setCameraIndex] = useState(null)
  const webcamRef = useRef(null)

  // Mensajes / progreso
  const [statusMessage, setStatusMessage] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [progreso, setProgreso] = useState([]) // [{idx, estado, mensaje}]

  // Modal cámara (opcional fuera de la tabla)
  const [modalCamara, setModalCamara] = useState(false)

  // ===== Carga inicial
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lotesData, operacionesData] = await Promise.all([
          getLoteProducto(),
          getOperaciones(),
        ])
        setLotes(lotesData)
        const ordenadas = (operacionesData || [])
          .filter(op => !!op?.id_operacion)
          .sort(
            (a, b) => numeroDeOP(b.id_operacion) - numeroDeOP(a.id_operacion)
          )
        setOperaciones(ordenadas)
      } catch (e) {
        console.error('Error cargando catálogos', e)
      }
    }
    fetchData()
  }, [])

  // ===== Productos disponibles según lote
  const productosFiltradosItem = lotes
    .filter(l => l.id_lote === idLoteItem)
    .map(l => l.id_producto)

  // ===== Inventario para (lote, producto) -> autocompletar bodega/ubicación
  const productoItem = watchItem('id_producto_item')
  useEffect(() => {
    const run = async () => {
      if (!idLoteItem || !productoItem) {
        setInventarioItem(null)
        setCantidadDispItem(null)
        setBodegaItem('')
        setUbicacionItem('')
        return
      }
      try {
        const inv = await inventarioCompletoPorLoteYProducto(
          idLoteItem,
          productoItem
        )
        setInventarioItem(inv || null)
        setCantidadDispItem(inv?.Cantidad ?? null)
        const autoBodega = inv?.Bodega?.id_bodega || inv?.id_bodega || ''
        const autoUbi =
          inv?.UbicacionBodega?.id_ubicacion || inv?.id_ubicacion || ''
        setBodegaItem(autoBodega || '')
        setUbicacionItem(autoUbi || '')
      } catch (e) {
        console.error('Error inventario ítem', e)
        setInventarioItem(null)
        setCantidadDispItem(null)
        setBodegaItem('')
        setUbicacionItem('')
      }
    }
    run()
  }, [idLoteItem, productoItem])

  // ===== Evidencia por ítem
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
    const imageSrc = webcamRef.current.getScreenshot()
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

  // ===== Evitar submit con Enter en el editor de ítems
  const preventEnterSubmit = e => {
    if (e.key === 'Enter') e.preventDefault()
  }

  // ===== Agregar ítem
  const onAddItem = handleSubmitItem(
    ({ id_lote_item, id_producto_item, cantidad_item }) => {
      const cant = Number(cantidad_item)
      if (!id_lote_item || !id_producto_item || !cant || cant <= 0) return

      // Validación exacta si no se cambia la bodega/ubicación detectada
      const mismaBodega =
        !inventarioItem?.Bodega?.id_bodega ||
        bodegaItem === inventarioItem?.Bodega?.id_bodega
      const mismaUbi =
        !inventarioItem?.UbicacionBodega?.id_ubicacion ||
        ubicacionItem === inventarioItem?.UbicacionBodega?.id_ubicacion
      if (mismaBodega && mismaUbi) {
        if (cantidadDispItem != null && cant > cantidadDispItem) {
          setStatusMessage({
            type: 'error',
            text: `No hay suficiente inventario (máx: ${cantidadDispItem})`,
          })
          setTimeout(() => setStatusMessage(null), 2500)
          return
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Stock exacto solo validado en la ubicación detectada.',
        })
        setTimeout(() => setStatusMessage(null), 2500)
      }

      const nuevo = {
        id_lote: id_lote_item,
        id_producto: id_producto_item,
        cantidad: cant,
        id_bodega_origen: bodegaItem || '',
        id_ubicacion_origen: ubicacionItem || '',
        evidenciaFile: null,
        evidenciaName: '',
      }

      // Unificar si coincide Lote+Producto+Bodega+Ubicación
      const idx = items.findIndex(
        it =>
          it.id_lote === nuevo.id_lote &&
          it.id_producto === nuevo.id_producto &&
          it.id_bodega_origen === nuevo.id_bodega_origen &&
          it.id_ubicacion_origen === nuevo.id_ubicacion_origen
      )
      if (idx >= 0) {
        const copy = [...items]
        copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + cant }
        setItems(copy)
      } else {
        setItems(prev => [...prev, nuevo])
      }

      // Limpiar SOLO sub-form
      setValueItem('id_lote_item', '')
      setValueItem('id_producto_item', '')
      setValueItem('cantidad_item', '')
      setIdLoteItem('')
      setInventarioItem(null)
      setCantidadDispItem(null)
      setBodegaItem('')
      setUbicacionItem('')
    }
  )

  const removeItem = i => setItems(prev => prev.filter((_, idx) => idx !== i))

  // ===== Procesar (iterar 1x1)
  const allItemsHaveEvidence =
    items.length > 0 && items.every(it => !!it.evidenciaFile)

  const procesarTransformaciones = async data => {
    if (!items.length) {
      setStatusMessage({ type: 'error', text: 'Agrega al menos un ítem.' })
      setTimeout(() => setStatusMessage(null), 2000)
      return
    }
    if (!allItemsHaveEvidence) {
      setStatusMessage({
        type: 'error',
        text: 'Todos los ítems requieren evidencia.',
      })
      setTimeout(() => setStatusMessage(null), 2200)
      return
    }

    setProcesando(true)
    const resultados = items.map((_, idx) => ({
      idx,
      estado: 'pendiente',
      mensaje: '',
    }))
    setProgreso(resultados)

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const formData = new FormData()
      formData.append('id_lote', it.id_lote)
      formData.append('id_producto', it.id_producto)
      formData.append('operacion', data.operacion) // 👈 ID Operación global
      formData.append('cantidad', String(it.cantidad))
      formData.append('id_bodega_origen', it.id_bodega_origen)
      formData.append('id_ubicacion_origen', it.id_ubicacion_origen)
      formData.append('comentario', data.comentario || '')
      formData.append('id_personal', user?.personal?.id_personal || '')
      formData.append('evidencia', it.evidenciaFile)
      // (Firmas no aplican en Transformación)
      formData.append('firma_autorizador', '')
      formData.append('firma_conductor', '')
      formData.append('firma_receptor', '')

      try {
        await crearTransformacion(formData)
        resultados[i] = { idx: i, estado: 'ok', mensaje: 'OK' }
        setProgreso([...resultados])
      } catch (e) {
        resultados[i] = {
          idx: i,
          estado: 'error',
          mensaje: e?.response?.data?.message || e?.message || 'Error',
        }
        setProgreso([...resultados])
        // si quieres abortar al primer error, haz break
      }
    }

    setProcesando(false)
    setStatusMessage({ type: 'success', text: 'Proceso finalizado.' })

    const huboError = resultados.some(p => p.estado === 'error')
    if (!huboError) {
      reset() // limpia globales
      setItems([]) // limpia ítems
      setInventarioItem(null)
      setCantidadDispItem(null)
      setBodegaItem('')
      setUbicacionItem('')
      setTimeout(() => {
        setStatusMessage(null)
        onSuccess && onSuccess()
      }, 1200)
    } else {
      setTimeout(() => setStatusMessage(null), 2500)
    }
  }

  return (
    <div className='container-fluid mt-3'>
      <h5 className='fw-bold text-center mb-2'>
        Registrar Transformaciones (por lote)
      </h5>

      {statusMessage && (
        <div
          className='position-sticky top-0'
          style={{
            zIndex: 1200,
            borderRadius: 8,
            padding: '8px 12px',
            background:
              statusMessage.type === 'success' ? '#00BA59' : '#F74C1B',
            color: 'white',
            boxShadow: '0 6px 20px rgba(0,0,0,.15)',
            textAlign: 'center',
            marginBottom: 8,
          }}
          role='status'
        >
          {statusMessage.text}
        </div>
      )}

      {/* ===== Global: Operación + Comentario ===== */}
      <form onSubmit={handleSubmit(procesarTransformaciones)} className='mt-1'>
        <div className='row g-2'>
          <div className='col-md-6'>
            <label className='form-label mb-1'>ID Operación</label>
            <select
              className={`form-select form-select-sm ${
                errors.operacion ? 'is-invalid' : ''
              }`}
              {...register('operacion')}
            >
              <option value=''>Selecciona una operación</option>
              {operaciones.map(op => (
                <option key={op.id_operacion} value={op.id_operacion}>
                  {op.id_operacion}
                </option>
              ))}
            </select>
            {errors.operacion && (
              <div className='invalid-feedback'>Obligatorio</div>
            )}
          </div>

          <div className='col-md-6'>
            <label className='form-label mb-1'>Comentario (global)</label>
            <input
              type='text'
              className={`form-control form-select-sm ${
                errors.comentario ? 'is-invalid' : ''
              }`}
              placeholder='Notas u observaciones…'
              {...register('comentario', { required: true })}
            />
            {errors.comentario && (
              <div className='invalid-feedback'>Campo requerido</div>
            )}
          </div>
        </div>

        {/* ===== Editor de Ítems ===== */}
        <div className='mt-3 p-2 border rounded' onKeyDown={preventEnterSubmit}>
          <div className='small text-muted fw-semibold mb-2'>Agregar ítem</div>

          <div className='row g-2 align-items-end'>
            <div className='col-md-3'>
              <label className='form-label mb-1'>Lote</label>
              <select
                className={`form-select form-select-sm ${
                  errorsItem.id_lote_item ? 'is-invalid' : ''
                }`}
                {...registerItem('id_lote_item', { required: true })}
                onChange={e => {
                  const v = e.target.value
                  setIdLoteItem(v)
                  setValueItem('id_lote_item', v)
                  setValueItem('id_producto_item', '')
                  setInventarioItem(null)
                  setCantidadDispItem(null)
                  setBodegaItem('')
                  setUbicacionItem('')
                }}
              >
                <option value=''>Selecciona un lote</option>
                {Array.from(new Set(lotes.map(l => l.id_lote)))
                  .sort((a, b) => b.localeCompare(a))
                  .map(lote => (
                    <option key={lote} value={lote}>
                      {lote}
                    </option>
                  ))}
              </select>
              {errorsItem.id_lote_item && (
                <div className='invalid-feedback'>Obligatorio</div>
              )}
            </div>

            <div className='col-md-3'>
              <label className='form-label mb-1'>Producto</label>
              <select
                className={`form-select form-select-sm ${
                  errorsItem.id_producto_item ? 'is-invalid' : ''
                }`}
                {...registerItem('id_producto_item', { required: true })}
              >
                <option value=''>Selecciona un producto</option>
                {productosFiltradosItem.map((p, idx) => (
                  <option key={idx} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {errorsItem.id_producto_item && (
                <div className='invalid-feedback'>Obligatorio</div>
              )}
            </div>

            <div className='col-md-2'>
              <label className='form-label mb-1'>Cantidad</label>
              <input
                type='number'
                min='0'
                step='any'
                className={`form-control form-control-sm ${
                  errorsItem.cantidad_item ? 'is-invalid' : ''
                }`}
                {...registerItem('cantidad_item', {
                  required: 'Obligatorio',
                  validate: v =>
                    cantidadDispItem == null ||
                    Number(v) <= cantidadDispItem ||
                    `Máximo disponible: ${cantidadDispItem}`,
                })}
              />
              {errorsItem.cantidad_item && (
                <div className='invalid-feedback'>
                  {errorsItem.cantidad_item.message || 'Inválida'}
                </div>
              )}
            </div>

            <div className='col-md-2'>
              <label className='form-label mb-1'>Bodega (ítem)</label>
              <input
                type='text'
                className='form-control form-control-sm'
                value={bodegaItem}
                onChange={e => setBodegaItem(e.target.value)}
                placeholder='id_bodega'
              />
            </div>

            <div className='col-md-2'>
              <label className='form-label mb-1'>Ubicación (ítem)</label>
              <input
                type='text'
                className='form-control form-control-sm'
                value={ubicacionItem}
                onChange={e => setUbicacionItem(e.target.value)}
                placeholder='id_ubicacion'
              />
            </div>

            <div className='col-12'>
              {inventarioItem ? (
                <div className='alert alert-info py-2 mb-0 mt-2'>
                  Detectado: Bodega{' '}
                  <strong>
                    {inventarioItem?.Bodega?.nombre ||
                      inventarioItem?.id_bodega}
                  </strong>{' '}
                  · Ubicación{' '}
                  <strong>
                    {inventarioItem?.UbicacionBodega?.nombre ||
                      inventarioItem?.id_ubicacion}
                  </strong>{' '}
                  · Cantidad <strong>{inventarioItem?.Cantidad}</strong>
                  <div className='small text-muted mt-1'>
                    Puedes cambiar bodega/ubicación para este ítem si lo
                    requieres.
                  </div>
                </div>
              ) : (
                <div className='form-text mt-2'>
                  Selecciona lote y producto para autocompletar bodega/ubicación
                  y ver stock.
                </div>
              )}
            </div>

            <div className='col-md-3 mt-2'>
              <button
                type='button'
                className='btn btn-primary btn-sm w-100'
                onClick={onAddItem}
              >
                Agregar ítem
              </button>
            </div>
          </div>
        </div>

        {/* ===== Tabla de Ítems (evidencia por fila) ===== */}
        <div className='mt-3'>
          <div className='d-flex justify-content-between align-items-center mb-2'>
            <span className='small text-muted'>
              Ítems a procesar: <strong>{items.length}</strong>
            </span>
            <button
              type='button'
              className='btn btn-outline-danger btn-sm'
              disabled={!items.length || procesando}
              onClick={() => setItems([])}
            >
              Vaciar lista
            </button>
          </div>

          <div className='table-responsive'>
            <table className='table table-sm table-striped align-middle'>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Lote</th>
                  <th>Producto</th>
                  <th className='text-end'>Cantidad</th>
                  <th>Bodega</th>
                  <th>Ubicación</th>
                  <th>Evidencia</th>
                  <th style={{ width: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan='8' className='text-center text-muted'>
                      Sin ítems
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr
                      key={`${it.id_lote}-${it.id_producto}-${it.id_bodega_origen}-${it.id_ubicacion_origen}-${idx}`}
                    >
                      <td>{idx + 1}</td>
                      <td>{it.id_lote}</td>
                      <td>{it.id_producto}</td>
                      <td className='text-end'>{it.cantidad}</td>
                      <td>{it.id_bodega_origen}</td>
                      <td>{it.id_ubicacion_origen}</td>
                      <td>
                        <div className='d-flex flex-column gap-1'>
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
                              onFileForItem(idx, e.target.files?.[0] || null)
                            }
                          />
                          <div className='small'>
                            {it.evidenciaName ? (
                              <span className='text-success'>
                                Archivo: <strong>{it.evidenciaName}</strong>
                              </span>
                            ) : (
                              <span className='text-danger'>Sin evidencia</span>
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

          {/* Panel de cámara por ítem */}
          {cameraIndex !== null && (
            <div className='mt-2 border rounded p-2'>
              <div className='d-flex justify-content-between align-items-center mb-2'>
                <div className='fw-semibold'>
                  Cámara para ítem #{cameraIndex + 1}
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
                  className='w-100 h-100'
                />
              </div>
              <div className='d-flex justify-content-center gap-2 mt-2'>
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

        {/* ===== Submit & progreso ===== */}
        {procesando && (
          <div className='mt-2'>
            <div className='small text-muted mb-1'>Procesando…</div>
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
                      {it.id_lote} / {it.id_producto} — {it.cantidad} ·{' '}
                      {it.id_bodega_origen || '-'} /{' '}
                      {it.id_ubicacion_origen || '-'}
                    </span>
                    <span className={`badge ${badge}`}>{estado}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className='d-flex justify-content-end mt-3'>
          <button
            type='submit'
            className='btn-agregarform btn btn-sm'
            disabled={
              isSubmitting ||
              !items.length ||
              !allItemsHaveEvidence ||
              procesando
            }
            title={
              !items.length
                ? 'Agrega ítems'
                : !allItemsHaveEvidence
                ? 'Todos los ítems requieren evidencia'
                : 'Procesar'
            }
          >
            {procesando ? 'Procesando…' : 'Procesar transformaciones'}
          </button>
        </div>
      </form>

      {/* Modal de cámara independiente (si quisieras capturar fuera de la tabla) */}
      <Modal
        isOpen={modalCamara}
        onRequestClose={() => setModalCamara(false)}
        contentLabel='Cámara'
        style={{
          overlay: { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000 },
          content: {
            inset: '10% 5%',
            borderRadius: 8,
            padding: 12,
            zIndex: 2001,
          },
        }}
      >
        <h6 className='text-center mb-2'>Captura una foto</h6>
        <div className='ratio ratio-16x9'>
          <Webcam
            ref={webcamRef}
            screenshotFormat='image/jpeg'
            className='w-100 h-100'
          />
        </div>
        <div className='d-flex justify-content-center gap-2 mt-2'>
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
            onClick={() => setModalCamara(false)}
          >
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default FormTransformacionLotes
