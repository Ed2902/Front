// src/components/Inventario/Entradas/FormIngreso.jsx
import { useForm } from 'react-hook-form'
import { useEffect, useState, useContext, useRef } from 'react'
import AuthContext from '../../../context/AuthContext'
import {
  getLoteProducto,
  getBodegas,
  getUbicaciones,
  getOperaciones,
  crearEntrada,
  getProductos, // nombres / unidades
} from './entrada_service'
import Modal from 'react-modal'
import Webcam from 'react-webcam'
import { saveAs } from 'file-saver'
import { generarZIPPDFsBonito } from '../../../utils/pdfIngreso'

Modal.setAppElement('#root')

// "OP006" -> 6
const numeroDeOP = id => Number(String(id || '').replace(/^OP/i, '')) || 0

// Normaliza url pública (para qr_image) cuando viene como nombre/relativa
const resolvePublicUrl = maybeUrlOrFile => {
  if (!maybeUrlOrFile) return null
  if (/^(data:|https?:\/\/)/i.test(maybeUrlOrFile)) return maybeUrlOrFile
  const PUBLIC_BASE = (
    import.meta.env.VITE_API_PUBLIC_URL ||
    import.meta.env.VITE_API_URL ||
    ''
  ).replace(/\/$/, '')
  if (!PUBLIC_BASE) return maybeUrlOrFile
  const filename = String(maybeUrlOrFile).replace(/^\/?uploads\/?/, '')
  return `${PUBLIC_BASE}/uploads/${filename}`
}

const FormIngreso = ({ onSuccess }) => {
  const { user } = useContext(AuthContext)

  // ===== Form global =====
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm()

  // ===== Catálogos =====
  const [lotesRaw, setLotesRaw] = useState([])
  const [bodegas, setBodegas] = useState([])
  const [ubicaciones, setUbicaciones] = useState([])
  const [operaciones, setOperaciones] = useState([])
  const [prodById, setProdById] = useState({}) // mapa Id_producto -> objeto /producto

  // ===== Estado global =====
  const [idLoteGlobal, setIdLoteGlobal] = useState('')
  const [infoLote, setInfoLote] = useState(null) // {cantidad, origen}
  const [statusMessage, setStatusMessage] = useState(null)

  // Bodega/Ubi global (destino)
  const idBodegaDestino = watch('id_bodega_destino')
  const ubicacionesDeBodega = ubicaciones.filter(
    u => u.id_bodega === (idBodegaDestino || '')
  )

  // ===== Ítems (carrito) =====
  // Cada ítem: { id_producto, cantidad, evidenciaFile?, evidenciaName? }
  const [items, setItems] = useState([])

  // Sub-form de ítem
  const {
    register: registerItem,
    handleSubmit: handleSubmitItem,
    setValue: setValueItem,
    watch: watchItem,
    formState: { errors: errorsItem },
  } = useForm()

  const productoItem = watchItem('id_producto_item')

  // Cámara por ítem
  const [cameraIndex, setCameraIndex] = useState(null)
  const webcamRef = useRef(null)

  // ========= CARGA INICIAL =========
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          lotesData,
          bodegasData,
          ubicacionesData,
          operacionesData,
          productosData,
        ] = await Promise.all([
          getLoteProducto(), // <- fuente para Cantidad/Origen
          getBodegas(),
          getUbicaciones(),
          getOperaciones(),
          getProductos(), // <- fuente para Nombre/Unidad
        ])

        setLotesRaw(lotesData || [])
        setBodegas(bodegasData || [])
        setUbicaciones(ubicacionesData || [])

        const ordenadas = (operacionesData || [])
          .filter(op => !!op?.id_operacion)
          .sort(
            (a, b) => numeroDeOP(b.id_operacion) - numeroDeOP(a.id_operacion)
          )
        setOperaciones(ordenadas)

        const map = {}
        ;(productosData || []).forEach(p => {
          map[p.Id_producto] = p
        })
        setProdById(map)
      } catch (err) {
        console.error('Error cargando datos:', err)
        setStatusMessage({ type: 'error', text: 'Error cargando catálogos' })
      }
    }
    fetchData()
  }, [])

  // ====== DEDUPE: lotes únicos para el select (solo 1 vez por id_lote) ======
  const lotesUnicos = Array.from(
    new Map((lotesRaw || []).map(l => [l.id_lote, l])).values()
  )

  // Productos disponibles (únicos) del lote global (IDs)
  const productosUnicosDelLote = Array.from(
    new Set(
      (lotesRaw || [])
        .filter(l => l.id_lote === idLoteGlobal)
        .map(l => l.id_producto)
    )
  )

  // Nombre / unidad del producto desde /producto (fallback: lotes)
  const productoNombre = idProd => {
    const p = prodById[idProd]
    if (p?.Nombre) return p.Nombre
    const found = (lotesRaw || []).find(
      l => l.id_lote === idLoteGlobal && l.id_producto === idProd
    )
    return (
      found?.Producto?.Nombre ||
      found?.producto_nombre ||
      found?.nombre_producto ||
      idProd
    )
  }
  const productoUnidad = idProd => prodById[idProd]?.Unidad_de_medida || ''

  // ========= INFO LOTE (Cantidad / Origen) desde getLoteProducto =========
  useEffect(() => {
    // Busca la última fila por Fecha_registro para el mismo lote+producto
    const computeInfo = () => {
      if (!idLoteGlobal || !productoItem) {
        setInfoLote(null)
        return
      }
      const filas = (lotesRaw || []).filter(
        x => x.id_lote === idLoteGlobal && x.id_producto === productoItem
      )
      if (!filas.length) {
        setInfoLote(null)
        return
      }
      const sorted = [...filas].sort(
        (a, b) => new Date(a.Fecha_registro) - new Date(b.Fecha_registro)
      )
      const last = sorted[sorted.length - 1]
      const cantidad = last?.Cantidad ?? null
      const origen =
        last?.Proveedor?.Nombre || last?.Cliente?.Nombre || 'Desconocido'
      setInfoLote({ cantidad, origen })
    }
    computeInfo()
  }, [idLoteGlobal, productoItem, lotesRaw])

  // ========= Evidencia por ítem =========
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
          `foto-item-${cameraIndex}-${Date.now()}.jpg`,
          { type: 'image/jpeg' }
        )
        onFileForItem(cameraIndex, file)
        setCameraIndex(null)
      })
  }

  // ========= UTIL: Descarga PNG desde dataURL o URL =========
  const descargarPNG = (src, nombre = 'qr.png') => {
    if (!src) return
    fetch(src)
      .then(res => res.blob())
      .then(blob => saveAs(blob, nombre))
      .catch(() => {})
  }

  // ========= ZIP: QRs (PNG) =========
  const descargarZIPQRs = async lista => {
    try {
      const JSZip = (await import(/* @vite-ignore */ 'jszip')).default
      const zip = new JSZip()
      let added = 0

      for (let i = 0; i < (lista || []).length; i++) {
        const r = lista[i]
        const src = r?.qr_image
        if (!src) continue
        const lote = r?.lote || idLoteGlobal || 'LOTE'
        const prod = r?.producto || `PROD_${i + 1}`
        const safeProd = String(prod).replace(/[^a-z0-9_\-.]/gi, '_')
        const safeLote = String(lote).replace(/[^a-z0-9_\-.]/gi, '_')
        const name = `QR_${safeLote}_${safeProd}_${i + 1}.png`
        const blob = await fetch(src).then(res => res.blob())
        zip.file(name, blob)
        added++
      }

      if (!added) {
        setStatusMessage({ type: 'error', text: 'No hay QR para comprimir.' })
        setTimeout(() => setStatusMessage(null), 2000)
        return
      }

      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `QRs_${idLoteGlobal || 'lote'}.zip`)
    } catch (err) {
      console.error('ZIP QR error', err)
      setStatusMessage({
        type: 'error',
        text: 'Para ZIP instala: npm i jszip',
      })
      setTimeout(() => setStatusMessage(null), 3000)
    }
  }

  // ========= SUBFORM: Agregar ítem =========
  const onAddItem = handleSubmitItem(({ id_producto_item, cantidad_item }) => {
    const cant = Number(cantidad_item)
    if (!idLoteGlobal) {
      setStatusMessage({ type: 'error', text: 'Selecciona el lote global.' })
      setTimeout(() => setStatusMessage(null), 1800)
      return
    }
    if (!id_producto_item || !cant || cant <= 0) return

    if (!productosUnicosDelLote.includes(id_producto_item)) {
      setStatusMessage({
        type: 'error',
        text: 'El producto no pertenece al lote seleccionado.',
      })
      setTimeout(() => setStatusMessage(null), 2200)
      return
    }

    // Unificar si coincide producto
    const idx = items.findIndex(it => it.id_producto === id_producto_item)
    if (idx >= 0) {
      const copy = [...items]
      copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + cant }
      setItems(copy)
    } else {
      setItems(prev => [
        ...prev,
        {
          id_producto: id_producto_item,
          cantidad: cant,
          evidenciaFile: null,
          evidenciaName: '',
        },
      ])
    }

    // Limpiar subform
    setValueItem('id_producto_item', '')
    setValueItem('cantidad_item', '')
  })

  const removeItem = i => setItems(prev => prev.filter((_, idx) => idx !== i))

  // ========= SUBMIT GLOBAL: procesar entradas =========
  const [procesando, setProcesando] = useState(false)
  const [progreso, setProgreso] = useState([]) // [{idx, estado, mensaje}]
  const [modalResultado, setModalResultado] = useState(false)
  const [respuestas, setRespuestas] = useState([]) // array por ítem

  const allItemsHaveEvidence =
    items.length > 0 && items.every(it => !!it.evidenciaFile)

  const procesarEntradas = async data => {
    if (!idLoteGlobal) {
      setStatusMessage({ type: 'error', text: 'Selecciona el lote global.' })
      setTimeout(() => setStatusMessage(null), 1800)
      return
    }
    if (!items.length) {
      setStatusMessage({ type: 'error', text: 'Agrega al menos un ítem.' })
      setTimeout(() => setStatusMessage(null), 1800)
      return
    }
    if (!data.id_bodega_destino || !data.id_ubicacion_destino) {
      setStatusMessage({
        type: 'error',
        text: 'Selecciona bodega y ubicación destino.',
      })
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
    const resps = []

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const formData = new FormData()
      formData.append('operacion', data.operacion || '')
      formData.append('id_lote', idLoteGlobal)
      formData.append('id_producto', it.id_producto)
      formData.append('cantidad', String(it.cantidad))
      formData.append('id_bodega_origen', '')
      formData.append('id_bodega_destino', data.id_bodega_destino)
      formData.append('id_ubicacion_origen', '')
      formData.append('id_ubicacion_destino', data.id_ubicacion_destino)
      formData.append('comentario', data.comentario || '')
      formData.append('id_personal', user?.personal?.id_personal || '')
      // Evidencia por ítem
      formData.append('evidencia', it.evidenciaFile)

      try {
        const resp = await crearEntrada(formData)
        const payload = resp && resp.data ? resp.data : resp

        // Normalizar
        const datos =
          payload?.data && typeof payload.data === 'object'
            ? payload.data
            : payload || {}

        const historial = datos?.historial || {}
        const inventario = datos?.inventario || {}
        const codigoQR = datos?.codigo_qr || {}

        const qrRaw = datos?.qr_image || ''
        const qrImage = resolvePublicUrl(qrRaw)

        resps.push({
          raw: payload,
          historial,
          inventario,
          qr_image: qrImage,
          codigo_qr: codigoQR,
          lote: codigoQR?.id_lote || historial?.id_lote || idLoteGlobal,
          producto:
            historial?.id_producto || codigoQR?.id_producto || it.id_producto,
          cantidad_ingresada:
            historial?.Cantidad ?? codigoQR?.cantidad_ingresada ?? it.cantidad,
          fecha:
            historial?.Fecha_movimiento ||
            codigoQR?.fecha ||
            new Date().toISOString(),
          mensaje:
            payload?.message ||
            payload?.mensaje ||
            payload?.data?.mensaje ||
            'OK',
        })

        resultados[i] = { idx: i, estado: 'ok', mensaje: 'OK' }
        setProgreso([...resultados])
      } catch (err) {
        resultados[i] = {
          idx: i,
          estado: 'error',
          mensaje: err?.response?.data?.message || err?.message || 'Error',
        }
        setProgreso([...resultados])
      }
    }

    setProcesando(false)
    setRespuestas(resps)
    setModalResultado(true)

    const huboError = resultados.some(p => p.estado === 'error')
    setStatusMessage({
      type: huboError ? 'error' : 'success',
      text: huboError ? 'Proceso finalizado con errores.' : 'Proceso exitoso.',
    })
    setTimeout(() => setStatusMessage(null), 2500)
  }

  // ========= Modal Resultado: Helpers =========
  const cerrarModalResultado = () => {
    setModalResultado(false)
    // Limpieza al cerrar
    reset()
    setItems([])
    setIdLoteGlobal('')
    setInfoLote(null)
    onSuccess && onSuccess()
  }

  // ========= RENDER =========
  return (
    <div className='container-fluid mt-3'>
      <h5 className='fw-bold text-center mb-2'>Registrar Entradas (masivo)</h5>

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

      {/* ===== GLOBAL: Lote, operación, comentario, bodega/ubi ===== */}
      <form onSubmit={handleSubmit(procesarEntradas)} className='mt-1'>
        <div className='row g-2'>
          <div className='col-md-3'>
            <label className='form-label mb-1'>Lote (global)</label>
            <select
              className='form-select form-select-sm'
              value={idLoteGlobal}
              onChange={e => {
                const v = e.target.value
                setIdLoteGlobal(v)
                setItems([])
                setInfoLote(null)
                setValueItem('id_producto_item', '')
                setValueItem('cantidad_item', '')
              }}
            >
              <option value=''>Selecciona un lote</option>
              {lotesUnicos.map(l => (
                <option key={l.id_lote} value={l.id_lote}>
                  {l.id_lote}
                </option>
              ))}
            </select>
          </div>

          <div className='col-md-3'>
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

          <div className='col-md-3'>
            <label className='form-label mb-1'>Bodega destino</label>
            <select
              className={`form-select form-select-sm ${
                errors.id_bodega_destino ? 'is-invalid' : ''
              }`}
              {...register('id_bodega_destino', { required: true })}
            >
              <option value=''>Selecciona una bodega</option>
              {bodegas.map(b => (
                <option key={b.id_bodega} value={b.id_bodega}>
                  {b.nombre}
                </option>
              ))}
            </select>
            {errors.id_bodega_destino && (
              <div className='invalid-feedback'>Obligatorio</div>
            )}
          </div>

          <div className='col-md-3'>
            <label className='form-label mb-1'>Ubicación destino</label>
            <select
              className={`form-select form-select-sm ${
                errors.id_ubicacion_destino ? 'is-invalid' : ''
              }`}
              {...register('id_ubicacion_destino', { required: true })}
            >
              <option value=''>Selecciona ubicación</option>
              {ubicacionesDeBodega.map(u => (
                <option key={u.id_ubicacion} value={u.id_ubicacion}>
                  {u.nombre}
                </option>
              ))}
            </select>
            {errors.id_ubicacion_destino && (
              <div className='invalid-feedback'>Obligatorio</div>
            )}
          </div>
        </div>

        <div className='row g-2 mt-1'>
          <div className='col-md-12'>
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

        {/* Info del lote / producto de referencia (desde lotesRaw) */}
        {infoLote && productoItem && (
          <div className='mt-2'>
            <div className='alert alert-info py-2 mb-1'>
              Lote: <strong>{idLoteGlobal}</strong> · Producto:{' '}
              <strong>{productoNombre(productoItem)}</strong> ·{' '}
              <strong>Cantidad: {infoLote.cantidad ?? '-'}</strong> · Origen:{' '}
              <strong>{infoLote.origen}</strong>
            </div>
          </div>
        )}

        {/* ===== ÍTEMS: editor + tabla ===== */}
        <div className='mt-3 p-3 border rounded'>
          <div className='small text-muted fw-semibold mb-3'>
            Agregar ítem al listado
          </div>

          <div className='row g-3 align-items-end'>
            <div className='col-md-6'>
              <label className='form-label mb-1'>Producto</label>
              <select
                className={`form-select form-select-sm ${
                  errorsItem.id_producto_item ? 'is-invalid' : ''
                }`}
                {...registerItem('id_producto_item', { required: true })}
                disabled={!idLoteGlobal}
                onChange={e => {
                  setValueItem('id_producto_item', e.target.value)
                }}
              >
                <option value=''>Selecciona un producto</option>
                {productosUnicosDelLote.map((p, idx) => {
                  const ya = items.some(it => it.id_producto === p)
                  const labelNombre = productoNombre(p)
                  const label =
                    labelNombre && labelNombre !== p
                      ? `${p} — ${labelNombre}`
                      : p
                  return (
                    <option
                      key={idx}
                      value={p}
                      style={
                        ya ? { color: '#B00020', fontWeight: 600 } : undefined
                      }
                    >
                      {ya ? `${label} — AGREGADO` : label}
                    </option>
                  )
                })}
              </select>
              {errorsItem.id_producto_item && (
                <div className='invalid-feedback'>Obligatorio</div>
              )}
            </div>

            <div className='col-md-3'>
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
                  validate: v => Number(v) > 0 || 'Debe ser mayor a 0',
                })}
                disabled={!idLoteGlobal}
              />
              {errorsItem.cantidad_item && (
                <div className='invalid-feedback'>
                  {errorsItem.cantidad_item.message || 'Inválida'}
                </div>
              )}
            </div>

            <div className='col-md-3'>
              <button
                type='button'
                className='btn btn-primary btn-sm w-100'
                onClick={onAddItem}
                disabled={!idLoteGlobal}
              >
                Agregar ítem
              </button>
            </div>
          </div>

          {/* Tabla de Ítems con evidencia por fila */}
          <div className='mt-4'>
            <div className='d-flex justify-content-between align-items-center mb-3'>
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
                    <th>Producto</th>
                    <th className='text-end'>Cantidad</th>
                    <th>Evidencia</th>
                    <th style={{ width: 120 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan='5' className='text-center text-muted'>
                        Sin ítems
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={`${it.id_producto}-${idx}`}>
                        <td>{idx + 1}</td>
                        <td>
                          <div className='fw-semibold'>
                            {productoNombre(it.id_producto)}
                          </div>
                          <div className='text-muted small'>
                            {it.id_producto}
                          </div>
                        </td>
                        <td className='text-end'>
                          {it.cantidad} {productoUnidad(it.id_producto)}
                        </td>
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
                                onFileForItem(idx, e.target.files?.[0] || null)
                              }
                            />
                            <div className='small'>
                              {it.evidenciaName ? (
                                <span className='text-success'>
                                  Archivo: <strong>{it.evidenciaName}</strong>
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

            {/* Panel de cámara por ítem */}
            {cameraIndex !== null && (
              <div
                className='mt-3 border rounded p-3'
                style={{ minHeight: 320 }}
              >
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
                      Lote {idLoteGlobal} — {productoNombre(it.id_producto)} —{' '}
                      {it.cantidad} {productoUnidad(it.id_producto)}
                    </span>
                    <span className={`badge ${badge}`}>{estado}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className='d-flex justify-content-end mt-4'>
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
            {procesando ? 'Procesando…' : 'Registrar Entradas'}
          </button>
        </div>
      </form>

      {/* Modal de resultado con TODOS los QR */}
      <Modal
        isOpen={modalResultado}
        onRequestClose={() => {}}
        shouldCloseOnOverlayClick={false}
        shouldCloseOnEsc={false}
        contentLabel='Resultado de Registro'
        style={{
          overlay: { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000 },
          content: {
            inset: '5% 4%',
            borderRadius: 16,
            padding: 20,
            maxWidth: 1280,
            margin: '0 auto',
            zIndex: 2001,
          },
        }}
      >
        <div className='d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3'>
          <h6 className='m-0 fw-bold' style={{ color: '#1E73B6' }}>
            Resultado de entradas — Lote {idLoteGlobal || '-'}
          </h6>
          <div className='d-flex flex-wrap gap-3'>
            <button
              className='btn btn-sm btn-outline-primary'
              onClick={() => descargarZIPQRs(respuestas)}
              title='Descargar todos los QR en ZIP'
            >
              Descargar QR (ZIP)
            </button>
            <button
              className='btn btn-sm btn-outline-dark'
              onClick={() =>
                generarZIPPDFsBonito(respuestas, {
                  productoNombre,
                  productoUnidad,
                  idLote: idLoteGlobal,
                })
              }
              title='Generar todos los PDFs en un ZIP'
            >
              Generar PDF (todos, ZIP)
            </button>
            <button
              className='btn btn-sm btn-outline-secondary'
              onClick={cerrarModalResultado}
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Grid de QRs con más aire */}
        <div className='row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 gy-4 gx-4'>
          {respuestas.length === 0 ? (
            <div className='text-muted'>No hay respuestas</div>
          ) : (
            respuestas.map((r, i) => {
              const nombrePNG = `QR_${r.lote}_${r.producto}_${i + 1}.png`
              return (
                <div key={i} className='col'>
                  <div
                    className='border rounded-3 p-4 h-100 d-flex flex-column shadow-sm'
                    style={{ minHeight: 560 }}
                  >
                    <div className='small text-muted mb-1'>
                      {r.mensaje || 'OK'}
                    </div>
                    <div className='fw-semibold mb-1'>
                      {productoNombre(r.producto)} · {r.cantidad_ingresada}{' '}
                      {productoUnidad(r.producto)}
                    </div>
                    <div className='small text-muted mb-3'>
                      {new Date(r.fecha).toLocaleString()}
                    </div>

                    <div className='d-flex justify-content-center mb-4'>
                      {r.qr_image ? (
                        <img
                          src={r.qr_image}
                          alt='QR'
                          style={{
                            maxWidth: 260,
                            width: '100%',
                            borderRadius: 10,
                            border: '1px dashed #59A1F7',
                            padding: 10,
                          }}
                        />
                      ) : (
                        <div className='text-muted'>Sin QR</div>
                      )}
                    </div>

                    <div className='d-flex flex-wrap gap-3 mt-auto'>
                      <button
                        type='button'
                        className='btn btn-sm btn-outline-primary'
                        onClick={() =>
                          r.qr_image && descargarPNG(r.qr_image, nombrePNG)
                        }
                        disabled={!r.qr_image}
                      >
                        Descargar PNG
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Modal>
    </div>
  )
}

export default FormIngreso
