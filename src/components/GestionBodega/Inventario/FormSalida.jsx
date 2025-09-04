// src/components/Inventario/Salidas/FormSalidaLotes.jsx
import { useForm } from 'react-hook-form'
import { useEffect, useState, useContext, useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import AuthContext from '../../../context/AuthContext'
import {
  getLoteProducto,
  getBodegas,
  getUbicaciones,
  getOperaciones,
  crearSalida,
  getInventarioPorLoteYProducto,
} from './salida_service'
import Webcam from 'react-webcam'

const numeroDeOP = id => Number(String(id || '').replace(/^OP/i, '')) || 0

const FormSalidaLotes = ({ onSuccess }) => {
  const { user } = useContext(AuthContext)

  // Form principal (globales)
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm()

  // Sub-form (ítem)
  const {
    register: registerItem,
    handleSubmit: handleSubmitItem,
    setValue: setValueItem,
    watch: watchItem,
    formState: { errors: errorsItem },
  } = useForm()

  // Catálogos
  const [lotes, setLotes] = useState([])
  const [bodegas, setBodegas] = useState([])
  const [ubicaciones, setUbicaciones] = useState([])
  const [operaciones, setOperaciones] = useState([])

  // Estado ítem
  const [idLoteItem, setIdLoteItem] = useState('')
  const [inventarioItem, setInventarioItem] = useState(null)
  const [cantidadDisponibleItem, setCantidadDisponibleItem] = useState(null)
  const [bodegaItem, setBodegaItem] = useState('')
  const [ubicacionItem, setUbicacionItem] = useState('')

  const productosFiltradosItem = lotes
    .filter(l => l.id_lote === idLoteItem)
    .map(l => l.id_producto)
  const ubicacionesDeBodegaItem = ubicaciones.filter(
    u => u.id_bodega === (bodegaItem || '')
  )

  // Carrito
  // { id_lote, id_producto, cantidad, id_bodega_origen, id_ubicacion_origen, evidenciaFile?, evidenciaName? }
  const [items, setItems] = useState([])

  // Cámara por ítem
  const [cameraIndex, setCameraIndex] = useState(null)
  const webcamRef = useRef(null)

  // Firmas globales
  const firmaRefs = {
    autorizador: useRef(),
    conductor: useRef(),
    receptor: useRef(),
  }
  const [firmaActual, setFirmaActual] = useState(null)
  const [firmas, setFirmas] = useState({})

  // Mensajes / progreso
  const [statusMessage, setStatusMessage] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [progreso, setProgreso] = useState([])

  // Carga inicial
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lotesData, bodegasData, ubicacionesData, operacionesData] =
          await Promise.all([
            getLoteProducto(),
            getBodegas(),
            getUbicaciones(),
            getOperaciones(),
          ])
        setLotes(lotesData)
        setBodegas(bodegasData)
        setUbicaciones(ubicacionesData)
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

  // Inventario del ítem -> autocompletar Bodega/Ubi
  const productoItem = watchItem('id_producto_item')
  useEffect(() => {
    const run = async () => {
      if (!idLoteItem || !productoItem) {
        setInventarioItem(null)
        setCantidadDisponibleItem(null)
        setBodegaItem('')
        setUbicacionItem('')
        return
      }
      try {
        const inv = await getInventarioPorLoteYProducto(
          idLoteItem,
          productoItem
        )
        setInventarioItem(inv || null)
        setCantidadDisponibleItem(inv?.Cantidad ?? null)
        const autoBodega = inv?.Bodega?.id_bodega || inv?.id_bodega || ''
        const autoUbi =
          inv?.UbicacionBodega?.id_ubicacion || inv?.id_ubicacion || ''
        setBodegaItem(autoBodega || '')
        setUbicacionItem(autoUbi || '')
      } catch (e) {
        console.error('Error inventario item', e)
        setInventarioItem(null)
        setCantidadDisponibleItem(null)
        setBodegaItem('')
        setUbicacionItem('')
      }
    }
    run()
  }, [idLoteItem, productoItem])

  // Firmas
  const guardarFirma = tipo => {
    const canvas = firmaRefs[tipo].current
    if (!canvas || canvas.isEmpty()) return alert('Firma vacía')
    const b64 = canvas.toDataURL('image/png')
    setFirmas(prev => ({ ...prev, [tipo]: b64 }))
    setFirmaActual(null)
  }
  const limpiarFirma = tipo => firmaRefs[tipo].current?.clear()

  // Evidencia por ítem
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
          `foto-item-${cameraIndex}-${Date.now()}.jpg`,
          { type: 'image/jpeg' }
        )
        onFileForItem(cameraIndex, file)
        setCameraIndex(null)
      })
  }

  // Evitar submit al presionar Enter dentro del editor de ítems
  const preventEnterSubmit = e => {
    if (e.key === 'Enter') e.preventDefault()
  }

  // Agregar ítem
  const onAddItem = handleSubmitItem(
    ({ id_lote_item, id_producto_item, cantidad_item }) => {
      const cant = Number(cantidad_item)
      if (!id_lote_item || !id_producto_item || !cant || cant <= 0) return

      const mismaBodegaDetectada =
        !inventarioItem?.Bodega?.id_bodega ||
        bodegaItem === inventarioItem?.Bodega?.id_bodega
      const mismaUbiDetectada =
        !inventarioItem?.UbicacionBodega?.id_ubicacion ||
        ubicacionItem === inventarioItem?.UbicacionBodega?.id_ubicacion

      if (mismaBodegaDetectada && mismaUbiDetectada) {
        if (cantidadDisponibleItem != null && cant > cantidadDisponibleItem) {
          setStatusMessage({
            type: 'error',
            text: `No hay suficiente inventario para ${id_lote_item}/${id_producto_item} (máx: ${cantidadDisponibleItem})`,
          })
          setTimeout(() => setStatusMessage(null), 2500)
          return
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Stock exacto solo validado en la ubicación detectada. Verifica al cambiar bodega/ubicación.',
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

      // 🔹 Limpiar SOLO el sub-form (NO reset global)
      setValueItem('id_lote_item', '')
      setValueItem('id_producto_item', '')
      setValueItem('cantidad_item', '')
      setIdLoteItem('')
      setInventarioItem(null)
      setCantidadDisponibleItem(null)
      setBodegaItem('')
      setUbicacionItem('')
    }
  )

  const removeItem = i => setItems(prev => prev.filter((_, idx) => idx !== i))

  // Procesar (1x1)
  const allItemsHaveEvidence =
    items.length > 0 && items.every(it => !!it.evidenciaFile)

  const procesarSalidas = async data => {
    if (!items.length) {
      setStatusMessage({ type: 'error', text: 'Agrega al menos un ítem.' })
      setTimeout(() => setStatusMessage(null), 2000)
      return
    }
    if (!allItemsHaveEvidence) {
      setStatusMessage({
        type: 'error',
        text: 'Todos los ítems deben tener evidencia.',
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
      formData.append('operacion', data.operacion) // global
      formData.append('cantidad', String(it.cantidad))
      formData.append('comentario', data.comentario || '') // global
      formData.append('id_personal', user?.personal?.id_personal || '')
      formData.append('id_bodega_origen', it.id_bodega_origen)
      formData.append('id_ubicacion_origen', it.id_ubicacion_origen)
      formData.append('evidencia', it.evidenciaFile)
      formData.append('firma_autorizador', firmas.autorizador || '') // global
      formData.append('firma_conductor', firmas.conductor || '') // global
      formData.append('firma_receptor', firmas.receptor || '') // global

      try {
        await crearSalida(formData)
        resultados[i] = { idx: i, estado: 'ok', mensaje: 'OK' }
        setProgreso([...resultados])
      } catch (e) {
        resultados[i] = {
          idx: i,
          estado: 'error',
          mensaje: e?.response?.data?.message || e?.message || 'Error',
        }
        setProgreso([...resultados])
        // si prefieres detener aquí: break
      }
    }

    setProcesando(false)
    setStatusMessage({ type: 'success', text: 'Proceso finalizado.' })

    const huboError = resultados.some(p => p.estado === 'error')
    if (!huboError) {
      reset() // limpia globales
      setItems([]) // limpia ítems
      setInventarioItem(null)
      setCantidadDisponibleItem(null)
      setBodegaItem('')
      setUbicacionItem('')
      setFirmas({})
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
      <h5 className='fw-bold text-center mb-2'>Registrar Salidas (por lote)</h5>

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

      {/* ===== GLOBAL: Operación, comentario y firmas ===== */}
      <form onSubmit={handleSubmit(procesarSalidas)} className='mt-1'>
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

        {/* ===== ÍTEMS: editor + tabla ===== */}
        <div className='mt-3 p-2 border rounded' onKeyDown={preventEnterSubmit}>
          <div className='small text-muted fw-semibold mb-2'>
            Agregar ítem al listado
          </div>

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
                  setCantidadDisponibleItem(null)
                  setBodegaItem('')
                  setUbicacionItem('')
                }}
              >
                <option value=''>Selecciona un lote</option>
                {lotes.map(l => (
                  <option key={l.id_lote_producto} value={l.id_lote}>
                    {l.id_lote}
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
                    cantidadDisponibleItem == null ||
                    Number(v) <= cantidadDisponibleItem ||
                    `Máximo disponible: ${cantidadDisponibleItem}`,
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
              <select
                className='form-select form-select-sm'
                value={bodegaItem}
                onChange={e => {
                  setBodegaItem(e.target.value)
                  setUbicacionItem('')
                }}
              >
                <option value=''>Selecciona bodega</option>
                {bodegas.map(b => (
                  <option key={b.id_bodega} value={b.id_bodega}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className='col-md-2'>
              <label className='form-label mb-1'>Ubicación (ítem)</label>
              <select
                className='form-select form-select-sm'
                value={ubicacionItem}
                onChange={e => setUbicacionItem(e.target.value)}
              >
                <option value=''>Selecciona ubicación</option>
                {ubicacionesDeBodegaItem.map(u => (
                  <option key={u.id_ubicacion} value={u.id_ubicacion}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className='col-md-12'>
              {inventarioItem ? (
                <div className='alert alert-info py-2 mb-0 mt-2'>
                  Detectado: Bodega{' '}
                  <strong>{inventarioItem?.Bodega?.nombre}</strong> · Ubicación{' '}
                  <strong>{inventarioItem?.UbicacionBodega?.nombre}</strong> ·
                  Cantidad <strong>{inventarioItem?.Cantidad}</strong>
                  <div className='small text-muted mt-1'>
                    Puedes cambiar bodega/ubicación para este ítem si lo
                    requieres.
                  </div>
                </div>
              ) : (
                <div className='form-text mt-2'>
                  Selecciona lote y producto para ver inventario y autocompletar
                  bodega/ubicación.
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

        {/* Tabla de Ítems con evidencia por fila */}
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
                      <td>
                        {bodegas.find(b => b.id_bodega === it.id_bodega_origen)
                          ?.nombre ||
                          it.id_bodega_origen ||
                          '-'}
                      </td>
                      <td>
                        {ubicaciones.find(
                          u => u.id_ubicacion === it.id_ubicacion_origen
                        )?.nombre ||
                          it.id_ubicacion_origen ||
                          '-'}
                      </td>
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

        {/* Firmas globales */}
        <div className='row g-2 mt-2'>
          {['autorizador', 'conductor', 'receptor'].map(tipo => (
            <div key={tipo} className='col-md-4'>
              <div className='border rounded p-2 h-100'>
                <div className='small text-muted mb-1'>Firma {tipo}</div>
                {firmaActual === tipo ? (
                  <>
                    <SignatureCanvas
                      ref={firmaRefs[tipo]}
                      canvasProps={{
                        className: 'w-100',
                        style: { border: '1px dashed #ccc', height: 140 },
                      }}
                    />
                    <div className='d-flex gap-2 mt-2'>
                      <button
                        type='button'
                        className='btn btn-primary btn-sm'
                        onClick={() => guardarFirma(tipo)}
                      >
                        Guardar
                      </button>
                      <button
                        type='button'
                        className='btn btn-outline-secondary btn-sm'
                        onClick={() => limpiarFirma(tipo)}
                      >
                        Limpiar
                      </button>
                      <button
                        type='button'
                        className='btn btn-outline-dark btn-sm'
                        onClick={() => setFirmaActual(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type='button'
                    className={`btn btn-sm ${
                      firmas[tipo] ? 'btn-success' : 'btn-outline-primary'
                    }`}
                    onClick={() => setFirmaActual(tipo)}
                  >
                    {firmas[tipo] ? 'Firmado ✅' : 'Firmar ✍️'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Progreso */}
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

        {/* Submit */}
        <div className='d-flex justify-content-end mt-3'>
          <button
            type='submit'
            className='btn btn-primary btn-sm'
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
            {procesando ? 'Procesando…' : 'Procesar salidas'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default FormSalidaLotes
