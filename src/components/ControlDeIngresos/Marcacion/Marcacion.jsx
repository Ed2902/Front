// src/components/ControlIngresos/Marcacion/Marcacion.jsx
import { useRef, useState, useEffect } from 'react'
import Webcam from 'react-webcam'
import {
  postMarcacionAuto,
  getMarcacionHistorialDelUsuarioActual,
} from './Marcacion_service'
import TablaMarcaciones from './TablaMarcaciones'

// ---------- Utils ----------
function dataURLtoFile(dataUrl, filename) {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new File([u8arr], filename, { type: mime })
}
const formatFecha = iso => {
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch {
    return iso
  }
}
const isAntesDeMediodia = () => new Date().getHours() < 12

// ---------- Panel de Confirmación (MISMO PATRÓN que tu ejemplo) ----------
const ConfirmPanel = ({ open, desc, onConfirm, onCancel, loading }) => {
  if (!open) return null

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='confirm-title'
      aria-describedby='confirm-desc'
      style={{ position: 'fixed', inset: 0, zIndex: 2000 }}
      onKeyDown={e => {
        if (e.key === 'Escape' && !loading) onCancel?.()
      }}
    >
      {/* Backdrop */}
      <div
        onClick={!loading ? onCancel : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      {/* Tarjeta */}
      <div
        className='shadow-lg rounded-3 border bg-white p-4'
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 380px)',
        }}
      >
        <h6 id='confirm-title' className='mb-2'>
          Confirmar marcación
        </h6>
        <p id='confirm-desc' className='mb-3 small text-muted'>
          {desc}
        </p>
        <div className='d-flex gap-2 justify-content-end'>
          <button
            className='btn btn-sm btn-outline-secondary'
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className='btn btn-sm btn-primary'
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Panel de Previsualización + Estado + Resultado ----------
const PreviewPanel = ({
  open,
  previewSrc,
  saving,
  progress,
  resultType, // 'success' | 'danger' | null
  resultMsg,
  countdown, // segundos para autocerrar cuando hay resultado
  onClose,
}) => {
  if (!open) return null

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='preview-title'
      style={{ position: 'fixed', inset: 0, zIndex: 2000 }}
      onKeyDown={e => {
        if (e.key === 'Escape' && !saving) onClose?.()
      }}
    >
      {/* Backdrop */}
      <div
        onClick={!saving ? onClose : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
        }}
      />

      {/* Tarjeta */}
      <div
        className='shadow-lg rounded-3 border bg-white p-3'
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 380px)',
        }}
      >
        <h6 id='preview-title' className='mb-2'>
          Validación de marcación
        </h6>

        {/* Cuadro 1:1 */}
        <div
          className='rounded overflow-hidden bg-light'
          style={{ width: '100%', aspectRatio: '1 / 1' }}
        >
          {previewSrc ? (
            <img
              src={previewSrc}
              alt='Captura'
              className='w-100 h-100'
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className='w-100 h-100 d-flex align-items-center justify-content-center text-muted'>
              Sin captura
            </div>
          )}
        </div>

        {/* Progreso mientras envía/valida */}
        {saving && (
          <div className='mt-3'>
            <div className='d-flex align-items-center gap-2'>
              <div
                className='spinner-border spinner-border-sm text-secondary'
                role='status'
              />
              <span className='small text-muted'>Validando…</span>
            </div>
            <div
              className='progress mt-2'
              role='progressbar'
              aria-valuemin='0'
              aria-valuemax='100'
            >
              <div
                className='progress-bar progress-bar-striped progress-bar-animated'
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Resultado */}
        {resultType && (
          <div
            className={`alert alert-${resultType} py-2 mt-3 mb-2`}
            role='alert'
          >
            {resultMsg}
          </div>
        )}

        <div className='d-flex justify-content-between align-items-center mt-2'>
          {resultType ? (
            <small className='text-muted'>Se cerrará en {countdown}s…</small>
          ) : (
            <span />
          )}
          <button
            type='button'
            className='btn btn-sm btn-outline-secondary'
            onClick={onClose}
            disabled={saving}
          >
            Cerrar ahora
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Componente principal ----------
const Marcacion = () => {
  const webcamRef = useRef(null)

  // Estado de envío / validación
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Confirmación de lógica horario
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmDesc, setConfirmDesc] = useState('')
  const [pending, setPending] = useState(null) // { tipo, file, preview }

  // Previsualización + resultado
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewSrc, setPreviewSrc] = useState(null)
  const [resultType, setResultType] = useState(null) // 'success' | 'danger' | null
  const [resultMsg, setResultMsg] = useState('')
  const [countdown, setCountdown] = useState(5)

  // Reintentos de match fallido
  const [failCount, setFailCount] = useState(0)

  // Estado actual según última marcación del usuario
  const [lastTipo, setLastTipo] = useState(null) // 'entrada' | 'salida' | null
  const canEntrada = !saving && lastTipo !== 'entrada'
  const canSalida = !saving && lastTipo === 'entrada' // solo si la última fue entrada

  // Cargar última marcación del usuario al montar
  const fetchLastEstado = async () => {
    try {
      const data = await getMarcacionHistorialDelUsuarioActual()
      if (Array.isArray(data) && data.length > 0) {
        const ordered = [...data].sort(
          (a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora)
        )
        setLastTipo(ordered[0].tipo) // 'entrada' | 'salida'
      } else {
        setLastTipo(null)
      }
    } catch (err) {
      console.error('No se pudo obtener la última marcación:', err)
      setLastTipo(null)
    }
  }

  useEffect(() => {
    fetchLastEstado()
  }, [])

  // Autocierre cuando ya hay resultado
  useEffect(() => {
    if (!previewOpen || !resultType) return
    setCountdown(5)
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          setPreviewOpen(false)
          setResultType(null)
          setResultMsg('')
          setPreviewSrc(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [previewOpen, resultType])

  const capturar = () => {
    const shot = webcamRef.current?.getScreenshot()
    if (!shot) return null
    return {
      file: dataURLtoFile(shot, `marcacion_${Date.now()}.jpg`),
      preview: shot,
    }
  }

  const handleClick = tipo => {
    // Guard-rails por estado actual
    if (tipo === 'entrada' && !canEntrada) return
    if (tipo === 'salida' && !canSalida) return

    const cap = capturar()
    if (!cap) {
      // Abrimos panel con error directo (sin preview)
      setPreviewSrc(null)
      setResultType('danger')
      setResultMsg('No se pudo capturar la imagen. Revisa permisos de cámara.')
      setPreviewOpen(true)
      return
    }

    const antes = isAntesDeMediodia()
    const necesitaConfirmar =
      (antes && tipo === 'salida') || (!antes && tipo === 'entrada')

    if (necesitaConfirmar) {
      setConfirmDesc(
        antes
          ? 'Estás marcando SALIDA antes del mediodía. ¿Deseas continuar?'
          : 'Estás marcando ENTRADA después del mediodía. ¿Deseas continuar?'
      )
      setPending({ tipo, file: cap.file, preview: cap.preview })
      setConfirmOpen(true)
      return
    }

    iniciarProceso(tipo, cap.file, cap.preview)
  }

  const iniciarProceso = (tipo, file, preview) => {
    setPreviewSrc(preview || null)
    setResultType(null)
    setResultMsg('')
    setPreviewOpen(true)
    enviar(tipo, file)
  }

  const enviar = async (tipo, file) => {
    try {
      setSaving(true)
      setUploadProgress(0)

      const data = await postMarcacionAuto({
        tipo,
        file,
        umbral: 0.55,
        onProgress: p => setUploadProgress(p),
      })

      const ok = data?.match === true && data?.registrado === true
      if (ok) {
        setFailCount(0)
        const nombre = `${data?.nombres ?? ''} ${data?.apellidos ?? ''}`.trim()
        const doc = data?.documento ?? ''
        const when = data?.fecha_hora
          ? ` (${formatFecha(data.fecha_hora)})`
          : ''
        const texto =
          tipo === 'entrada'
            ? `¡Bienvenido, ${nombre} (${doc})! Entrada registrada${when}.`
            : `¡Hasta luego, ${nombre} (${doc})! Salida registrada${when}.`
        setResultType('success')
        setResultMsg(texto)

        // 👉 Actualiza estado de botones inmediatamente
        setLastTipo(tipo)
      } else {
        const next = failCount + 1
        setFailCount(next)
        if (next >= 5) {
          setResultType('danger')
          setResultMsg(
            'No se pudo validar tu rostro tras varios intentos. Por favor, comunícate con soporte Green-Way.'
          )
        } else {
          const scoreInfo =
            typeof data?.score === 'number' && typeof data?.umbral === 'number'
              ? ` (score: ${data.score.toFixed(2)}, umbral: ${data.umbral})`
              : ''
          setResultType('danger')
          setResultMsg(
            `No se pudo validar tu rostro, intenta nuevamente.${scoreInfo}`
          )
        }
      }
    } catch (err) {
      console.error(err)
      setResultType('danger')
      setResultMsg('Error al registrar la marcación. Intenta nuevamente.')
    } finally {
      setSaving(false)
      setUploadProgress(0)
      // Refresca estado real desde servidor (por si hubo cambios externos)
      fetchLastEstado()
    }
  }

  // Confirmación
  const confirmarEnvio = () => {
    if (pending?.file && pending?.tipo) {
      iniciarProceso(pending.tipo, pending.file, pending.preview)
    }
    setConfirmOpen(false)
    setPending(null)
  }
  const cancelarEnvio = () => {
    setConfirmOpen(false)
    setPending(null)
  }

  return (
    <div className='container-fluid mt-3'>
      <h3 className='mb-2 text-center'>Marcación</h3>

      {/* Contenedor compacto sin scroll a botones */}
      <div className='mx-auto' style={{ maxWidth: 560 }}>
        <div className='card'>
          <div className='card-body'>
            <div className='mb-2 small text-muted'>Cámara</div>

            {/* Webcam ratio 4:3 compacto */}
            <div className='ratio ratio-4x3 bg-dark rounded overflow-hidden'>
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat='image/jpeg'
                videoConstraints={{ video: { facingMode: 'user' } }}
                className='w-100 h-100'
                style={{ objectFit: 'cover' }}
              />
            </div>

            {/* Estado actual */}
            <div className='text-center mt-2 small'>
              {lastTipo === 'entrada' && (
                <span className='badge text-bg-success'>
                  Estado actual: Dentro
                </span>
              )}
              {lastTipo === 'salida' && (
                <span className='badge text-bg-secondary'>
                  Estado actual: Fuera
                </span>
              )}
              {lastTipo === null && (
                <span className='badge text-bg-light text-dark'>
                  Sin marcaciones previas
                </span>
              )}
            </div>

            {/* Controles */}
            <div className='d-flex justify-content-center gap-2 mt-2'>
              <button
                type='button'
                className='btn btn-success'
                onClick={() => handleClick('entrada')}
                disabled={!canEntrada}
                title={
                  !canEntrada
                    ? 'Ya tienes una entrada activa'
                    : 'Registrar entrada'
                }
              >
                ENTRADA
              </button>
              <button
                type='button'
                className='btn btn-danger'
                onClick={() => handleClick('salida')}
                disabled={!canSalida}
                title={
                  !canSalida
                    ? 'Debes marcar una entrada primero'
                    : 'Registrar salida'
                }
              >
                SALIDA
              </button>
            </div>

            {/* Progreso breve (cuando está enviando) */}
            {saving && (
              <div className='mt-2'>
                <div
                  className='progress'
                  role='progressbar'
                  aria-valuemin='0'
                  aria-valuemax='100'
                >
                  <div
                    className='progress-bar progress-bar-striped progress-bar-animated'
                    style={{ width: `${uploadProgress}%` }}
                  >
                    {uploadProgress}%
                  </div>
                </div>
                <div className='text-center small text-muted mt-1'>
                  Validando… (1.5–5 s aprox.)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel confirmación horario */}
      <ConfirmPanel
        open={confirmOpen}
        desc={confirmDesc}
        onConfirm={confirmarEnvio}
        onCancel={cancelarEnvio}
        loading={false}
      />

      {/* Panel preview + estado + resultado */}
      <PreviewPanel
        open={previewOpen}
        previewSrc={previewSrc}
        saving={saving}
        progress={uploadProgress}
        resultType={resultType}
        resultMsg={resultMsg}
        countdown={countdown}
        onClose={() => {
          if (!saving) setPreviewOpen(false)
        }}
      />

      {/* ⬇️ Historial del usuario */}
      <div className='mt-3'>
        <TablaMarcaciones />
      </div>
    </div>
  )
}

export default Marcacion
