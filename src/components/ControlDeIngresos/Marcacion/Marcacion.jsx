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

const mapTipo = t => {
  const s = String(t || '').toLowerCase()
  if (s === 'on_almuerzo') return 'En almuerzo (inicio)'
  if (s === 'off_almuerzo') return 'Fin de almuerzo'
  if (s === 'entrada') return 'Entrada'
  if (s === 'salida') return 'Salida'
  return t || ''
}
const formatDuration = ms => {
  const sec = Math.max(0, Math.floor(ms / 1000))
  const hh = String(Math.floor(sec / 3600)).padStart(2, '0')
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

// ---------- Panel de Confirmación ----------
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
      <div
        onClick={!loading ? onCancel : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      <div
        className='shadow rounded-3 border bg-white p-4'
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 420px)',
        }}
      >
        <h6 id='confirm-title' className='mb-2'>
          Confirmar marcación
        </h6>
        <p id='confirm-desc' className='mb-3 text-muted small'>
          {desc}
        </p>
        <div className='d-flex gap-2 justify-content-end'>
          <button
            className='btn btn-sm btn-light'
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
            {loading ? 'Procesando…' : 'Confirmar'}
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
  resultType,
  resultMsg,
  countdown,
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
      <div
        onClick={!saving ? onClose : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      <div
        className='shadow rounded-3 border bg-white p-3'
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 420px)',
        }}
      >
        <h6 id='preview-title' className='mb-2'>
          Validación de marcación
        </h6>
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

  // Forzar selección manual
  const [forceManual, setForceManual] = useState(false)

  // Confirmación de lógica horario (entrada/salida)
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
  const [lastTipo, setLastTipo] = useState(null) // 'entrada' | 'salida' | 'on_almuerzo' | 'off_almuerzo' | null

  // Cronómetro de almuerzo
  const [lunchStart, setLunchStart] = useState(null) // Date | null
  const [lunchElapsed, setLunchElapsed] = useState(0) // ms

  // Para refrescar la tabla tras cada registro
  const [reloadKey, setReloadKey] = useState(0)

  // Derivados de habilitación (cuando NO es manual)
  const base_canEntrada =
    !saving && !['entrada', 'on_almuerzo', 'off_almuerzo'].includes(lastTipo)
  const base_canSalida =
    !saving && (lastTipo === 'entrada' || lastTipo === 'off_almuerzo')
  const base_canOnAlmuerzo = !saving && lastTipo === 'entrada'
  const base_canOffAlmuerzo = !saving && lastTipo === 'on_almuerzo'

  // Si es manual, habilita todo (salvo cuando saving)
  const canEntrada = forceManual ? !saving : base_canEntrada
  const canSalida = forceManual ? !saving : base_canSalida
  const canOnAlmuerzo = forceManual ? !saving : base_canOnAlmuerzo
  const canOffAlmuerzo = forceManual ? !saving : base_canOffAlmuerzo

  // Cargar última marcación del usuario al montar
  const fetchLastEstado = async () => {
    try {
      const data = await getMarcacionHistorialDelUsuarioActual()
      if (Array.isArray(data) && data.length > 0) {
        const ordered = [...data].sort(
          (a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora)
        )
        const last = ordered[0]
        const t = String(last.tipo || '')
          .toLowerCase()
          .replace(/\s+/g, '_')
        setLastTipo(t)
        if (t === 'on_almuerzo') {
          const start = new Date(last.fecha_hora || Date.now())
          setLunchStart(start)
        } else {
          setLunchStart(null)
          setLunchElapsed(0)
        }
      } else {
        setLastTipo(null)
        setLunchStart(null)
        setLunchElapsed(0)
      }
    } catch (err) {
      console.error('No se pudo obtener la última marcación:', err)
      setLastTipo(null)
      setLunchStart(null)
      setLunchElapsed(0)
    }
  }
  useEffect(() => {
    fetchLastEstado()
  }, [])

  // Tick del cronómetro cuando estás en almuerzo
  useEffect(() => {
    if (!lunchStart) return
    const id = setInterval(() => {
      setLunchElapsed(Date.now() - lunchStart.getTime())
    }, 1000)
    setLunchElapsed(Date.now() - lunchStart.getTime())
    return () => clearInterval(id)
  }, [lunchStart])

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
    // Si NO es manual, respeta reglas de estado
    if (!forceManual) {
      if (tipo === 'entrada' && !canEntrada) return
      if (tipo === 'salida' && !canSalida) return
      if (tipo === 'on_almuerzo' && !canOnAlmuerzo) return
      if (tipo === 'off_almuerzo' && !canOffAlmuerzo) return
    }

    const cap = capturar()
    if (!cap) {
      setPreviewSrc(null)
      setResultType('danger')
      setResultMsg('No se pudo capturar la imagen. Revisa permisos de cámara.')
      setPreviewOpen(true)
      return
    }

    // Confirmación:
    // - En modo manual SIEMPRE confirma
    // - En modo normal, solo confirma si "sospechoso" por horario
    if (forceManual) {
      const humanTipo = mapTipo(tipo)
      setConfirmDesc(
        `Vas a registrar "${humanTipo}". Por favor verifica que el tipo sea correcto antes de continuar.`
      )
      setPending({ tipo, file: cap.file, preview: cap.preview })
      setConfirmOpen(true)
      return
    } else if (tipo === 'entrada' || tipo === 'salida') {
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
        extra: {},
        onProgress: p => setUploadProgress(p),
      })

      const ok = data?.match === true && data?.registrado === true
      let when = ''
      if (data?.fecha_hora) {
        when = ` (${formatFecha(data.fecha_hora)})`
      }

      if (ok) {
        setFailCount(0)
        const nombre = `${data?.nombres ?? ''} ${data?.apellidos ?? ''}`.trim()
        const doc = data?.documento ?? ''
        let texto = ''
        switch (tipo) {
          case 'entrada':
            texto = `¡Bienvenido, ${nombre} (${doc})! Entrada registrada${when}.`
            break
          case 'salida':
            texto = `¡Hasta luego, ${nombre} (${doc})! Salida registrada${when}.`
            break
          case 'on_almuerzo':
            texto = `¡Buen provecho, ${nombre} (${doc})! Almuerzo iniciado${when}.`
            break
          case 'off_almuerzo':
            texto = `¡De vuelta, ${nombre} (${doc})! Almuerzo finalizado${when}.`
            break
          default:
            texto = `Marcación registrada${when}.`
        }
        setResultType('success')
        setResultMsg(texto)
        setLastTipo(tipo)
        if (tipo === 'on_almuerzo') {
          const startTs = data?.fecha_hora
            ? new Date(data.fecha_hora)
            : new Date()
          setLunchStart(startTs)
          setLunchElapsed(0)
        } else if (
          tipo === 'off_almuerzo' ||
          tipo === 'salida' ||
          tipo === 'entrada'
        ) {
          setLunchStart(null)
          setLunchElapsed(0)
        }
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
      // 🔄 Releer estado + recargar tabla SIEMPRE
      fetchLastEstado()
      setReloadKey(k => k + 1)
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

  // Etiquetas de estado
  const EstadoBadge = () => {
    if (lastTipo === 'entrada' || lastTipo === 'off_almuerzo') {
      return <span className='badge text-bg-success'>Estado: Dentro</span>
    }
    if (lastTipo === 'on_almuerzo') {
      return (
        <span className='badge text-bg-warning text-dark'>
          Estado: En almuerzo
        </span>
      )
    }
    if (lastTipo === 'salida') {
      return <span className='badge text-bg-secondary'>Estado: Fuera</span>
    }
    return (
      <span className='badge text-bg-light text-dark'>
        Sin marcaciones previas
      </span>
    )
  }

  return (
    <div className='container-fluid py-3'>
      {/* Cabecera */}
      <div className='d-flex align-items-center justify-content-between mb-2'>
        <h4 className='m-0'>Marcación</h4>
        <div className='small d-flex align-items-center gap-3'>
          <label
            className='form-check m-0'
            title='Permite escoger cualquier tipo y siempre pedirá confirmación'
          >
            <input
              type='checkbox'
              className='form-check-input me-2'
              checked={forceManual}
              onChange={e => setForceManual(e.target.checked)}
            />
            <span className='form-check-label'>Forzar selección manual</span>
          </label>
          <EstadoBadge />
        </div>
      </div>

      {/* Cámara PEQUEÑA y CENTRADA */}
      <div className='card shadow-sm mb-3'>
        <div className='card-body'>
          <div className='mb-2 text-muted small text-center'>Cámara</div>
          <div
            className='rounded overflow-hidden bg-dark mx-auto'
            style={{ width: 'min(95vw, 480px)', aspectRatio: '4 / 3' }}
          >
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat='image/jpeg'
              videoConstraints={{ facingMode: 'user' }}
              className='w-100 h-100'
              style={{ objectFit: 'cover' }}
            />
          </div>

          {/* Cronómetro de almuerzo */}
          {lastTipo === 'on_almuerzo' && (
            <div className='d-flex justify-content-center mt-3'>
              <div
                className='card border-warning w-100'
                style={{ maxWidth: 600 }}
              >
                <div className='card-body py-2'>
                  <div className='d-flex align-items-center justify-content-between'>
                    <strong className='text-warning-emphasis'>
                      Tiempo de almuerzo
                    </strong>
                    <span className='badge text-bg-warning text-dark'>
                      {formatDuration(lunchElapsed)}
                    </span>
                  </div>
                  <div className='progress mt-2' aria-hidden='true'>
                    <div
                      className='progress-bar progress-bar-striped progress-bar-animated'
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Controles */}
          <div className='d-flex flex-wrap justify-content-center gap-2 mt-3'>
            <button
              type='button'
              className='btn btn-success'
              onClick={() => handleClick('entrada')}
              disabled={!canEntrada}
              title={
                !canEntrada
                  ? 'No disponible en tu estado actual'
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
                  ? 'Debes estar dentro (y no en almuerzo)'
                  : 'Registrar salida'
              }
            >
              SALIDA
            </button>

            <button
              type='button'
              className='btn btn-warning'
              onClick={() => handleClick('on_almuerzo')}
              disabled={!canOnAlmuerzo}
              title={
                !canOnAlmuerzo
                  ? 'Solo puedes iniciar almuerzo si estás dentro'
                  : 'Iniciar almuerzo'
              }
            >
              IR A ALMUERZO
            </button>

            <button
              type='button'
              className='btn btn-outline-warning'
              onClick={() => handleClick('off_almuerzo')}
              disabled={!canOffAlmuerzo}
              title={
                !canOffAlmuerzo
                  ? 'Solo puedes acabar almuerzo si lo has iniciado'
                  : 'Finalizar almuerzo'
              }
            >
              ACABAR ALMUERZO
            </button>
          </div>

          {/* Progreso breve (cuando está enviando) */}
          {saving && (
            <div className='mt-3'>
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
                Validando…
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabla GRANDE */}
      <div className='mt-3'>
        <div className='d-flex align-items-center justify-content-between mb-1'>
          <h6 className='m-0'>Mis marcaciones</h6>
          <small className='text-muted'>Últimos registros</small>
        </div>
        {/* 🔄 La tabla se recarga cuando cambia reloadKey */}
        <TablaMarcaciones mapTipo={mapTipo} reloadKey={reloadKey} />
      </div>

      {/* Panel confirmación */}
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
    </div>
  )
}

export default Marcacion
