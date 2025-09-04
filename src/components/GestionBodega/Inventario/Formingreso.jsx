// src/components/Inventario/Entradas/FormIngreso.jsx
import { useForm } from 'react-hook-form'
import { useEffect, useState, useContext, useRef } from 'react'
import AuthContext from '../../../context/AuthContext'
import {
  getLoteProducto,
  getBodegas,
  getUbicaciones,
  crearEntrada,
  getInventarioPorLoteYProducto,
  getOperaciones,
} from './entrada_service'
import Webcam from 'react-webcam'
import Modal from 'react-modal'
import { saveAs } from 'file-saver'
import { generarPdfIngreso } from '../../../utils/pdfIngreso' // 👈 NUEVO

Modal.setAppElement('#root')

// "OP006" -> 6
const numeroDeOP = id => Number(String(id || '').replace(/^OP/i, '')) || 0

const FormIngreso = ({ onSuccess }) => {
  const { user } = useContext(AuthContext)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm()

  const [lotes, setLotes] = useState([])
  const [bodegas, setBodegas] = useState([])
  const [ubicaciones, setUbicaciones] = useState([])
  const [operaciones, setOperaciones] = useState([])
  const [archivoEvidencia, setArchivoEvidencia] = useState(null)
  const [statusMessage, setStatusMessage] = useState(null)
  const [modalCamara, setModalCamara] = useState(false)

  // Modal con el resultado del backend
  const [modalResultado, setModalResultado] = useState(false)
  const [respuestaBackend, setRespuestaBackend] = useState(null)

  const [infoLote, setInfoLote] = useState(null)
  const [idLoteSeleccionado, setIdLoteSeleccionado] = useState('')

  const webcamRef = useRef(null)
  const idBodegaSeleccionada = watch('id_bodega_destino')
  const idLote = watch('id_lote')
  const idProducto = watch('id_producto')

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

        const ordenadas = [...operacionesData]
          .filter(op => !!op?.id_operacion)
          .sort(
            (a, b) => numeroDeOP(b.id_operacion) - numeroDeOP(a.id_operacion)
          )
        setOperaciones(ordenadas)
      } catch (error) {
        console.error('Error cargando datos:', error)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (!idLote || !idProducto) return
    const cargarInfoLote = async () => {
      try {
        const data = await getInventarioPorLoteYProducto(idLote, idProducto)
        if (data.length > 0) {
          const lp = data[0].LoteProducto
          const cantidad = lp?.Cantidad || 0
          const origen =
            lp?.Proveedor?.Nombre || lp?.Cliente?.Nombre || 'Desconocido'
          setInfoLote({ cantidad, origen })
        } else {
          setInfoLote(null)
        }
      } catch (err) {
        console.error('Error consultando info de lote:', err)
        setInfoLote(null)
      }
    }
    cargarInfoLote()
  }, [idLote, idProducto])

  const ubicacionesFiltradas = ubicaciones.filter(
    u => u.id_bodega === idBodegaSeleccionada
  )
  const productosFiltrados = lotes
    .filter(l => l.id_lote === idLoteSeleccionado)
    .map(l => l.id_producto)

  const handleImageUpload = e => {
    const f = e.target.files[0]
    if (f) setArchivoEvidencia(f)
  }

  const capturarFoto = () => {
    const imageSrc = webcamRef.current.getScreenshot()
    fetch(imageSrc)
      .then(res => res.blob())
      .then(blob => {
        setArchivoEvidencia(
          new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' })
        )
        setModalCamara(false)
      })
  }

  // Utilidades para QR complementarias
  const descargarQRpng = (dataUrl, nombre = 'qr.png') => {
    if (!dataUrl) return
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => saveAs(blob, nombre))
      .catch(() => {})
  }

  const onSubmit = async data => {
    console.log('[FormIngreso] Enviando datos…', data)

    if (!archivoEvidencia) {
      setStatusMessage({
        type: 'error',
        text: 'Adjunta una evidencia (foto o imagen).',
      })
      return
    }

    try {
      const formData = new FormData()
      formData.append('operacion', data.operacion)
      formData.append('id_lote', data.id_lote)
      formData.append('id_producto', data.id_producto)
      formData.append('cantidad', data.cantidad)
      formData.append('id_bodega_origen', '')
      formData.append('id_bodega_destino', data.id_bodega_destino)
      formData.append('id_ubicacion_origen', '')
      formData.append('id_ubicacion_destino', data.id_ubicacion_destino)
      formData.append('comentario', data.comentario)
      formData.append('id_personal', user?.personal?.id_personal)
      formData.append('evidencia', archivoEvidencia)
      formData.append('firma_autorizador', '')
      formData.append('firma_conductor', '')
      formData.append('firma_receptor', '')

      const resp = await crearEntrada(formData)
      const payload = resp && resp.data ? resp.data : resp
      console.log('[FormIngreso] Respuesta cruda:', resp)
      console.log('[FormIngreso] Payload normalizado:', payload)

      setRespuestaBackend(payload || { message: 'Sin datos', data: {} })
      setModalCamara(false) // cerrar cámara si quedó abierta
      setModalResultado(true) // abrir modal de resultado

      const msgTop =
        payload?.message ||
        payload?.mensaje ||
        payload?.data?.mensaje ||
        'Entrada registrada ✅'
      setStatusMessage({ type: 'success', text: msgTop })
      setTimeout(() => setStatusMessage(null), 2500)
    } catch (err) {
      console.error('[FormIngreso] Error al registrar entrada:', err)
      const apiMsg =
        err?.response?.data?.message || err?.message || 'Error al registrar ❌'
      setStatusMessage({ type: 'error', text: apiMsg })
      setModalResultado(false)
    }
  }

  // ---- Datos normalizados para el modal (fuera del JSX) ----
  const datos =
    respuestaBackend?.data && typeof respuestaBackend.data === 'object'
      ? respuestaBackend.data
      : respuestaBackend || {}

  const historial = datos?.historial || {}
  const inventario = datos?.inventario || {}
  const qrImage = datos?.qr_image || ''
  const lote = datos?.codigo_qr?.id_lote || historial?.id_lote || '-' // 👈 SOLO Lote
  const producto =
    historial?.id_producto || datos?.codigo_qr?.id_producto || '-'
  const nombreQR = `QR_${lote}_${producto}.png`

  // Resolver URL pública del PDF si solo vino el nombre
  const PUBLIC_BASE = (
    import.meta.env.VITE_API_PUBLIC_URL ||
    import.meta.env.VITE_API_URL ||
    ''
  ).replace(/\/$/, '')
  const urlPDFBackend = (() => {
    const file = datos?.documento_pdf
    if (!file) return null
    if (typeof file === 'string' && /^https?:\/\//i.test(file)) return file
    if (!PUBLIC_BASE) return null
    return `${PUBLIC_BASE}/uploads/${file}`
  })()

  // Cerrar modal de resultado: ahora sí limpiamos y notificamos
  const handleCerrarResultado = () => {
    setModalResultado(false)
    reset()
    setArchivoEvidencia(null)
    setInfoLote(null)
    setIdLoteSeleccionado('')
    onSuccess && onSuccess()
  }

  return (
    <div className='container-fluid mt-3'>
      <h5 className='fw-bold text-center mb-2'>Registrar Entrada</h5>

      {statusMessage && (
        <div
          style={{
            position: 'sticky',
            top: 8,
            zIndex: 1200, // menor que los modales
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

      <form onSubmit={handleSubmit(onSubmit)} className='mt-1'>
        {/* Fila 1: (1) Lote  (2) Producto */}
        <div className='row g-2'>
          <div className='col-md-6'>
            <label className='form-label mb-1'>Lote</label>
            <select
              className={`form-select form-select-sm ${
                errors.id_lote ? 'is-invalid' : ''
              }`}
              {...register('id_lote', { required: true })}
              onChange={e => {
                setIdLoteSeleccionado(e.target.value)
                setValue('id_lote', e.target.value)
                setValue('id_producto', '')
                setInfoLote(null)
              }}
            >
              <option value=''>Selecciona un lote</option>
              {lotes.map(l => (
                <option key={l.id_lote_producto} value={l.id_lote}>
                  {l.id_lote}
                </option>
              ))}
            </select>
            {errors.id_lote && (
              <div className='invalid-feedback'>Obligatorio</div>
            )}
          </div>

          <div className='col-md-6'>
            <label className='form-label mb-1'>Producto</label>
            <select
              className={`form-select form-select-sm ${
                errors.id_producto ? 'is-invalid' : ''
              }`}
              {...register('id_producto', { required: true })}
            >
              <option value=''>Selecciona un producto</option>
              {productosFiltrados.map((p, idx) => (
                <option key={idx} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {errors.id_producto && (
              <div className='invalid-feedback'>Obligatorio</div>
            )}
          </div>
        </div>

        {/* Fila 2: (3) ID Operación  (4) Cantidad */}
        <div className='row g-2 mt-1'>
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
            <label className='form-label mb-1'>Cantidad</label>
            <input
              type='number'
              min='0'
              step='any'
              className={`form-control form-control-sm ${
                errors.cantidad ? 'is-invalid' : ''
              }`}
              {...register('cantidad', { required: true })}
            />
            {errors.cantidad && (
              <div className='invalid-feedback'>
                Ingresa una cantidad válida
              </div>
            )}
          </div>
        </div>

        {/* Info del lote */}
        {infoLote && (
          <div className='mt-2'>
            <div className='alert alert-info py-2 mb-1'>
              Cantidad en lote: <strong>{infoLote.cantidad}</strong> | Origen:{' '}
              <strong>{infoLote.origen}</strong>
            </div>
          </div>
        )}

        {/* Fila 3: (5) Bodega  (6) Ubicación */}
        <div className='row g-2 mt-1'>
          <div className='col-md-6'>
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

          <div className='col-md-6'>
            <label className='form-label mb-1'>Ubicación</label>
            <select
              className={`form-select form-select-sm ${
                errors.id_ubicacion_destino ? 'is-invalid' : ''
              }`}
              {...register('id_ubicacion_destino', { required: true })}
            >
              <option value=''>Selecciona ubicación</option>
              {ubicacionesFiltradas.map(u => (
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

        {/* Fila 4: Comentario / Evidencia */}
        <div className='row g-2 mt-1'>
          <div className='col-md-6'>
            <label className='form-label mb-1'>Comentario</label>
            <textarea
              className={`form-control form-control-sm ${
                errors.comentario ? 'is-invalid' : ''
              }`}
              rows={3}
              placeholder='Notas u observaciones…'
              {...register('comentario', { required: true })}
            />
            {errors.comentario && (
              <div className='invalid-feedback'>Campo requerido</div>
            )}
          </div>

          <div className='col-md-6'>
            <label className='form-label mb-1'>Evidencia</label>
            <div className='d-flex gap-2'>
              <button
                type='button'
                className='btn btn-outline-secondary btn-sm flex-fill'
                onClick={() => setModalCamara(true)}
              >
                Usar cámara
              </button>
              <button
                type='button'
                className='btn btn-outline-secondary btn-sm flex-fill'
                onClick={() => document.getElementById('input-archivo').click()}
              >
                Subir imagen
              </button>
            </div>
            <input
              id='input-archivo'
              type='file'
              accept='image/*'
              hidden
              onChange={handleImageUpload}
            />
            {!archivoEvidencia && (
              <div className='form-text text-danger'>
                Debes capturar o subir una imagen
              </div>
            )}
            {archivoEvidencia && (
              <div className='form-text'>
                Imagen lista: <strong>{archivoEvidencia.name}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className='d-flex justify-content-end mt-2'>
          <button
            type='submit'
            className='btn btn-primary btn-sm'
            disabled={isSubmitting || !archivoEvidencia}
            title={!archivoEvidencia ? 'Adjunta una evidencia' : 'Guardar'}
          >
            {isSubmitting ? 'Guardando…' : 'Registrar Entrada'}
          </button>
        </div>
      </form>

      {/* Modal cámara */}
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
            videoConstraints={{ facingMode: 'environment' }}
            className='w-100 h-100'
          />
        </div>
        <div className='d-flex justify-content-center gap-2 mt-2'>
          <button
            type='button'
            className='btn btn-primary btn-sm'
            onClick={capturarFoto}
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

      {/* Modal de resultado (respuesta del backend) */}
      <Modal
        isOpen={modalResultado}
        onRequestClose={() => {}}
        shouldCloseOnOverlayClick={false}
        shouldCloseOnEsc={false}
        contentLabel='Resultado de Registro'
        style={{
          overlay: { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000 },
          content: {
            inset: '8% 5%',
            borderRadius: 12,
            padding: 14,
            maxWidth: 900,
            margin: '0 auto',
            zIndex: 2001,
          },
        }}
      >
        <div className='d-flex justify-content-between align-items-center mb-2'>
          <h6 className='m-0 fw-bold' style={{ color: '#F74C1B' }}>
            {respuestaBackend?.message ||
              respuestaBackend?.data?.mensaje ||
              'Resultado'}
          </h6>
          <div className='d-flex gap-2'>
            <button
              className='btn btn-sm btn-outline-primary'
              onClick={() => generarPdfIngreso(datos)} // 👈 genera y descarga PDF
              disabled={!datos}
              title='Generar PDF'
            >
              Generar PDF
            </button>
            <button
              className='btn btn-sm btn-outline-secondary'
              onClick={handleCerrarResultado}
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Cabecera */}
        <div className='row g-2'>
          <div className='col-md-6'>
            <div className='border rounded p-2 h-100'>
              <div className='small text-muted'>Operación</div>
              <div className='fw-semibold'>{historial?.operacion || '-'}</div>
              <div className='small text-muted mt-2'>Mensaje</div>
              <div>
                {respuestaBackend?.data?.mensaje ||
                  respuestaBackend?.mensaje ||
                  '-'}
              </div>
            </div>
          </div>
          <div className='col-md-6'>
            <div className='border rounded p-2 h-100'>
              <div className='small text-muted'>Historial</div>
              <div className='mb-1'>
                ID: <strong>{historial?.id_historial ?? '-'}</strong>
              </div>
              <div className='small text-muted'>Inventario</div>
              <div>
                ID: <strong>{inventario?.id_inventario ?? '-'}</strong> ·
                Cantidad total: <strong>{inventario?.Cantidad ?? '-'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* QR + Acciones */}
        <div className='row g-2 mt-2'>
          <div className='col-md-6'>
            <div className='border rounded p-2 h-100 d-flex flex-column align-items-center'>
              <div className='small text-muted mb-1'>Código QR</div>
              {qrImage ? (
                <img
                  src={qrImage}
                  alt='QR'
                  style={{
                    maxWidth: '280px',
                    width: '100%',
                    borderRadius: 8,
                    border: '1px dashed #59A1F7',
                    padding: 8,
                  }}
                />
              ) : (
                <div className='text-muted'>No se recibió imagen QR</div>
              )}
              <div className='d-flex gap-2 mt-2'>
                <button
                  type='button'
                  className='btn btn-sm btn-outline-primary'
                  onClick={() => descargarQRpng(qrImage, nombreQR)}
                  disabled={!qrImage}
                >
                  Descargar PNG
                </button>
              </div>
            </div>
          </div>

          <div className='col-md-6'>
            <div className='border rounded p-2 h-100'>
              <div className='small text-muted mb-1'>
                Documento PDF (backend)
              </div>
              {urlPDFBackend ? (
                <a
                  href={urlPDFBackend}
                  target='_blank'
                  rel='noreferrer'
                  className='btn btn-sm btn-outline-dark'
                >
                  Abrir PDF del backend
                </a>
              ) : (
                <div className='text-muted'>
                  {datos?.documento_pdf
                    ? `Archivo: ${datos.documento_pdf} (configura la ruta pública en tu API)`
                    : 'No se recibió URL pública del PDF'}
                </div>
              )}

              <div className='small text-muted mt-3'>Resumen</div>
              <ul className='mb-0'>
                <li>
                  Lote: <strong>{lote}</strong>
                </li>
                <li>
                  Producto: <strong>{producto}</strong>
                </li>
                <li>
                  Cantidad ingresada:{' '}
                  <strong>
                    {historial?.Cantidad ??
                      datos?.codigo_qr?.cantidad_ingresada ??
                      '-'}
                  </strong>
                </li>
                <li>
                  Bodega/Ubi:{' '}
                  <strong>
                    {historial?.id_bodega_destino ||
                      datos?.codigo_qr?.id_bodega_actual ||
                      '-'}
                  </strong>{' '}
                  /{' '}
                  <strong>
                    {historial?.id_ubicacion_destino ||
                      datos?.codigo_qr?.id_ubicacion_actual ||
                      '-'}
                  </strong>
                </li>
                <li>
                  Fecha:{' '}
                  <strong>
                    {new Date(
                      historial?.Fecha_movimiento ||
                        datos?.codigo_qr?.fecha ||
                        Date.now()
                    ).toLocaleString()}
                  </strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default FormIngreso
