// FormSalidaDesdeAlistamiento.jsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useContext,
} from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Webcam from 'react-webcam'
import AuthContext from '../../../../context/AuthContext'

import { obtenerAlistamiento } from './alistamiento_service'
import { getInventarioResumen } from '../../Inventario/inventario_service'
import { crearSalida } from './salida_service'

// ===== helpers
const pick = (...v) => v.find(x => x != null && x !== '')
const toNum = v => {
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}
const keyLP = (lote, prod) => `${String(lote)}__${String(prod)}`
const sortOpciones = (a, b) => toNum(b.cantidad) - toNum(a.cantidad)

export default function FormSalidaDesdeAlistamiento() {
  const { user } = useContext(AuthContext)
  const { id_alistamiento } = useParams()
  const navigate = useNavigate()

  const webcamRef = useRef(null)
  const [cameraIndex, setCameraIndex] = useState(null)

  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState(null)

  const [alistamiento, setAlistamiento] = useState(null)
  const [invResumen, setInvResumen] = useState([])

  const [items, setItems] = useState([])
  const [statusMessage, setStatusMessage] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()

  // ===== cargar alistamiento + inventario
  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const [a, inv] = await Promise.all([
          obtenerAlistamiento(id_alistamiento),
          getInventarioResumen(),
        ])

        setAlistamiento(a)
        setInvResumen(Array.isArray(inv) ? inv : [])

        const detalles = Array.isArray(a?.detalles) ? a.detalles : []

        // Precarga items desde detalles del alistamiento
        const mapped = detalles.map((d, idx) => {
          const id_lote = pick(
            d?.id_lote,
            d?.lote?.Id_lote,
            d?.lote?.id_lote,
            ''
          )
          const id_producto = pick(
            d?.id_producto,
            d?.producto?.Id_producto,
            d?.producto?.id_producto,
            ''
          )
          const cantidad = toNum(d?.cantidad)
          const nombreProd = pick(
            d?.producto?.Nombre,
            d?.producto?.nombre,
            id_producto
          )

          return {
            id_lote,
            id_producto,
            cantidad,

            id_bodega_origen: '',
            id_ubicacion_origen: '',

            evidenciaFile: null,
            evidenciaName: '',

            producto_nombre_view: nombreProd,
            _idx: idx,
          }
        })

        setItems(mapped)

        reset({
          id_alistamiento: String(a?.id_alistamiento || id_alistamiento || ''),
          comentario: a?.observaciones || '',
          id_cliente: a?.id_cliente ?? '',
          id_personal_alisto: a?.id_personal ?? '',
        })
      } catch (e) {
        console.error(e)
        setError(
          e?.response?.data?.message ||
            e?.message ||
            'No se pudo cargar el alistamiento.'
        )
      } finally {
        setLoading(false)
      }
    }

    if (id_alistamiento) run()
  }, [id_alistamiento, reset])

  // ===== opciones por lote+producto desde inventario
  const opcionesPorLP = useMemo(() => {
    const out = new Map()

    ;(invResumen || []).forEach(r => {
      const id_lote = pick(r?.Id_lote, r?.id_lote)
      const id_producto = pick(r?.Id_producto, r?.id_producto)
      if (!id_lote || !id_producto) return

      const id_bodega = pick(
        r?.id_bodega,
        r?.Id_bodega,
        r?.Bodega?.Id,
        r?.BodegaId,
        ''
      )
      const id_ubicacion = pick(
        r?.id_ubicacion,
        r?.Id_ubicacion,
        r?.Ubicacion?.Id,
        r?.UbicacionId,
        ''
      )
      if (!id_bodega || !id_ubicacion) return

      const bodegaNombre = pick(
        r?.Bodega?.Nombre,
        r?.BodegaNombre,
        r?.Bodega,
        id_bodega
      )
      const ubicacionNombre = pick(
        r?.Ubicacion?.Nombre,
        r?.UbicacionNombre,
        r?.Ubicacion,
        r?.ubicacion,
        id_ubicacion
      )

      const cantidad = toNum(
        pick(r?.Cantidad_Inventario, r?.Cantidad, r?.Cantidad_Lote, 0)
      )
      if (cantidad <= 0) return

      const lk = keyLP(id_lote, id_producto)
      if (!out.has(lk)) out.set(lk, new Map())

      const bucket = out.get(lk)
      const k = `${id_bodega}|${id_ubicacion}`

      if (!bucket.has(k)) {
        bucket.set(k, {
          key: k,
          id_bodega,
          id_ubicacion,
          bodegaNombre,
          ubicacionNombre,
          cantidad: 0,
        })
      }
      bucket.get(k).cantidad += cantidad
    })

    const final = new Map()
    for (const [lk, bucket] of out.entries()) {
      const arr = Array.from(bucket.values()).sort(sortOpciones)
      final.set(lk, arr)
    }
    return final
  }, [invResumen])

  const getOpciones = useCallback(
    (lote, prod) => opcionesPorLP.get(keyLP(lote, prod)) || [],
    [opcionesPorLP]
  )

  const setUbicacion = (idx, key) => {
    setItems(prev => {
      const copy = [...prev]
      const it = copy[idx]
      const opts = getOpciones(it.id_lote, it.id_producto)
      const op = opts.find(o => o.key === key)

      copy[idx] = {
        ...it,
        id_bodega_origen: op?.id_bodega || '',
        id_ubicacion_origen: op?.id_ubicacion || '',
      }
      return copy
    })
  }

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

  const closeCamera = () => setCameraIndex(null)

  const captureForItem = async () => {
    try {
      const imageSrc = webcamRef.current?.getScreenshot()
      if (!imageSrc) return
      const blob = await fetch(imageSrc).then(r => r.blob())
      const file = new File(
        [blob],
        `foto-item-${cameraIndex}-${Date.now()}.jpg`,
        {
          type: 'image/jpeg',
        }
      )
      onFileForItem(cameraIndex, file)
      setCameraIndex(null)
    } catch (e) {
      console.error(e)
    }
  }

  const allHaveUbicacion =
    items.length > 0 &&
    items.every(it => !!it.id_bodega_origen && !!it.id_ubicacion_origen)

  const allHaveEvidencia =
    items.length > 0 && items.every(it => !!it.evidenciaFile)

  const submit = async form => {
    if (!items.length) {
      setStatusMessage({
        type: 'error',
        text: 'Este alistamiento no tiene detalles.',
      })
      setTimeout(() => setStatusMessage(null), 2200)
      return
    }

    if (!allHaveUbicacion) {
      setStatusMessage({
        type: 'error',
        text: 'Selecciona Bodega/Ubicación en todos los ítems.',
      })
      setTimeout(() => setStatusMessage(null), 2200)
      return
    }

    if (!allHaveEvidencia) {
      setStatusMessage({
        type: 'error',
        text: 'Todos los ítems requieren evidencia.',
      })
      setTimeout(() => setStatusMessage(null), 2200)
      return
    }

    const idAlist = String(form.id_alistamiento || id_alistamiento || '')
    if (!idAlist) {
      setStatusMessage({ type: 'error', text: 'Falta id_alistamiento.' })
      setTimeout(() => setStatusMessage(null), 2200)
      return
    }

    setProcesando(true)
    setStatusMessage(null)

    try {
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const fd = new FormData()

        // ===== encabezado obligatorio
        fd.append('id_alistamiento', idAlist)
        fd.append('comentario', form.comentario || '')
        fd.append('id_personal', user?.personal?.id_personal || '')

        // ===== detalle obligatorio
        fd.append('id_lote', it.id_lote)
        fd.append('id_producto', it.id_producto)
        fd.append('cantidad', String(it.cantidad))
        fd.append('id_bodega_origen', it.id_bodega_origen)
        fd.append('id_ubicacion_origen', it.id_ubicacion_origen)

        // ===== evidencia por item
        fd.append('evidencia', it.evidenciaFile)

        await crearSalida(fd)
      }

      setStatusMessage({
        type: 'success',
        text: 'Salidas registradas correctamente.',
      })
      setTimeout(() => setStatusMessage(null), 1800)
    } catch (e) {
      console.error(e)
      setStatusMessage({
        type: 'error',
        text:
          e?.response?.data?.message ||
          e?.message ||
          'Error registrando salidas.',
      })
      setTimeout(() => setStatusMessage(null), 3500)
    } finally {
      setProcesando(false)
    }
  }

  if (loading) {
    return (
      <div className='container py-3'>
        <div className='alert alert-secondary'>Cargando alistamiento…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='container py-3'>
        <div className='alert alert-danger'>{error}</div>
        <button
          className='btn btn-outline-secondary btn-sm'
          onClick={() => navigate(-1)}
          type='button'
        >
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className='container-fluid mt-3'>
      <h5 className='fw-bold text-center mb-2'>Salida desde Alistamiento</h5>

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

      <form onSubmit={handleSubmit(submit)}>
        {/* ===== Encabezado ===== */}
        <div className='row g-2'>
          <div className='col-md-3'>
            <label className='form-label mb-1'>ID Alistamiento</label>
            <input
              className={`form-control form-control-sm ${
                errors.id_alistamiento ? 'is-invalid' : ''
              }`}
              readOnly
              {...register('id_alistamiento', { required: true })}
            />
            {errors.id_alistamiento && (
              <div className='invalid-feedback'>Obligatorio</div>
            )}
          </div>

          <div className='col-md-3'>
            <label className='form-label mb-1'>Cliente</label>
            <input
              className='form-control form-control-sm'
              readOnly
              {...register('id_cliente')}
            />
          </div>

          <div className='col-md-3'>
            <label className='form-label mb-1'>Alistó</label>
            <input
              className='form-control form-control-sm'
              readOnly
              {...register('id_personal_alisto')}
            />
          </div>

          <div className='col-md-3'>
            <label className='form-label mb-1'>Ejecuta</label>
            <input
              className='form-control form-control-sm'
              readOnly
              value={user?.personal?.id_personal || ''}
            />
          </div>

          <div className='col-12'>
            <label className='form-label mb-1'>Comentario (global)</label>
            <input
              className={`form-control form-control-sm ${
                errors.comentario ? 'is-invalid' : ''
              }`}
              placeholder='Observaciones…'
              {...register('comentario', { required: true })}
            />
            {errors.comentario && (
              <div className='invalid-feedback'>Requerido</div>
            )}
          </div>
        </div>

        {/* ===== Detalles ===== */}
        <div className='mt-3'>
          <div className='d-flex justify-content-between align-items-center mb-2'>
            <div className='small text-muted'>
              Detalles: <b>{items.length}</b>
            </div>
            <div className='small text-muted'>
              Estado alistamiento: <b>{alistamiento?.estado || '—'}</b>
            </div>
          </div>

          <div className='table-responsive'>
            <table className='table table-sm table-striped align-middle'>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Lote</th>
                  <th>Producto</th>
                  <th className='text-end'>Cantidad</th>
                  <th style={{ minWidth: 340 }}>Bodega / Ubicación</th>
                  <th>Evidencia</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan='6' className='text-center text-muted py-3'>
                      Este alistamiento no tiene detalles.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => {
                    const opciones = getOpciones(it.id_lote, it.id_producto)
                    const selectedKey = `${it.id_bodega_origen || ''}|${
                      it.id_ubicacion_origen || ''
                    }`

                    return (
                      <tr key={`${it.id_lote}-${it.id_producto}-${idx}`}>
                        <td>{idx + 1}</td>
                        <td className='fw-semibold'>{it.id_lote}</td>
                        <td>
                          {it.producto_nombre_view
                            ? `${it.producto_nombre_view} (${it.id_producto})`
                            : it.id_producto}
                        </td>
                        <td className='text-end'>{it.cantidad}</td>

                        <td>
                          <select
                            className={`form-select form-select-sm ${
                              !it.id_bodega_origen || !it.id_ubicacion_origen
                                ? 'is-invalid'
                                : ''
                            }`}
                            value={
                              it.id_bodega_origen && it.id_ubicacion_origen
                                ? selectedKey
                                : ''
                            }
                            onChange={e => setUbicacion(idx, e.target.value)}
                            disabled={procesando}
                          >
                            <option value=''>
                              {opciones.length
                                ? 'Selecciona bodega/ubicación'
                                : 'Sin ubicaciones con stock'}
                            </option>
                            {opciones.map(op => (
                              <option key={op.key} value={op.key}>
                                {op.bodegaNombre} → {op.ubicacionNombre} — Cant:{' '}
                                {toNum(op.cantidad)}
                              </option>
                            ))}
                          </select>
                          {(!it.id_bodega_origen ||
                            !it.id_ubicacion_origen) && (
                            <div className='invalid-feedback d-block'>
                              Requerido
                            </div>
                          )}
                        </td>

                        <td>
                          <div className='d-flex flex-column gap-1'>
                            <div className='d-flex gap-2'>
                              <button
                                type='button'
                                className='btn btn-outline-secondary btn-sm'
                                onClick={() => setCameraIndex(idx)}
                                disabled={procesando}
                              >
                                Cámara
                              </button>
                              <button
                                type='button'
                                className='btn btn-outline-secondary btn-sm'
                                onClick={() =>
                                  document
                                    .getElementById(`file-item-${idx}`)
                                    ?.click()
                                }
                                disabled={procesando}
                              >
                                Subir
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
                                  {it.evidenciaName}
                                </span>
                              ) : (
                                <span className='text-danger'>
                                  Sin evidencia
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ===== Cámara por ítem ===== */}
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

        <div className='d-flex justify-content-end gap-2 mt-3'>
          <button
            type='submit'
            className='btn btn-primary btn-sm'
            disabled={
              procesando ||
              !items.length ||
              !allHaveUbicacion ||
              !allHaveEvidencia
            }
            title={
              !items.length
                ? 'Sin ítems'
                : !allHaveUbicacion
                ? 'Falta bodega/ubicación'
                : !allHaveEvidencia
                ? 'Falta evidencia'
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
