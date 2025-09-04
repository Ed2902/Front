// src/components/Operacion/Tabladeoperador/asignarservicios.jsx
import { useEffect, useMemo, useState } from 'react'
import { actualizarServiciosOperacion } from '../Tabladeoperacion/operacion_service'
import {
  getServiciosCatalogo,
  toServiciosObjeto,
  mergeServicios,
  serviciosActivos,
} from './servicios'

// Helpers visuales
const prettify = s =>
  String(s || '')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())

// ───────────────────────────────────────────────────────────────────────────────
//  Panel de confirmación / éxito (overlay simple) — muestra SOLO servicios activos
// ───────────────────────────────────────────────────────────────────────────────
const ConfirmPanel = ({
  open,
  title,
  desc,
  items = [], // array de strings (servicios activos)
  loading,
  onCancel,
  onConfirm,
  confirmText = 'Confirmar',
}) => {
  if (!open) return null
  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='confirm-title'
      aria-describedby='confirm-desc'
      style={{ position: 'fixed', inset: 0, zIndex: 3000 }}
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
      {/* Card */}
      <div
        className='shadow-lg rounded-3 border bg-white p-4'
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 560px)',
        }}
      >
        <h6 id='confirm-title' className='mb-2'>
          {title}
        </h6>
        {desc && (
          <p id='confirm-desc' className='small text-muted mb-2'>
            {desc}
          </p>
        )}

        <div
          className='border rounded p-2 mb-3'
          style={{ maxHeight: 220, overflow: 'auto' }}
        >
          {items.length === 0 ? (
            <div className='small text-muted'>No hay servicios activos.</div>
          ) : (
            <ul className='small mb-0'>
              {items.map(s => (
                <li key={s}>{prettify(s)}</li>
              ))}
            </ul>
          )}
        </div>

        <div className='d-flex justify-content-end gap-2'>
          {onCancel && (
            <button
              className='btn btn-sm btn-outline-secondary'
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </button>
          )}
          <button
            className='btn btn-sm btn-primary'
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Procesando…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
//  Principal
// ───────────────────────────────────────────────────────────────────────────────
const AsignarServicios = ({
  idOperacion, // ej. "OP006" (requerido)
  serviciosIniciales = {}, // objeto o JSON string
  onSuccess,
  onClose, // se llama automáticamente tras guardar OK
}) => {
  const [modelo, setModelo] = useState(getServiciosCatalogo())
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Estado de modales
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const AUTO_CLOSE_DELAY_MS = 1200

  // Inicializa el modelo cuando cambia la operación
  useEffect(() => {
    try {
      const merged = mergeServicios(getServiciosCatalogo(), serviciosIniciales)
      setModelo(merged)
    } catch {
      setModelo(getServiciosCatalogo())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idOperacion])

  // Llaves ordenadas: montacarga primero, luego alfabético
  const keys = useMemo(() => {
    const arr = Object.keys(modelo)
    arr.sort((a, b) => {
      if (a === 'montacarga') return -1
      if (b === 'montacarga') return 1
      return a.localeCompare(b)
    })
    return arr
  }, [modelo])

  const activos = useMemo(() => serviciosActivos(modelo), [modelo])

  // Colores corporativos
  const COLOR_PRIMARY = '#F74C1B' // primario
  const COLOR_SECOND = '#59A1F7' // secundario
  const SELECTED_BG = '#EAF3FF'
  const SELECTED_BORDER = COLOR_SECOND

  const toggle = k => setModelo(prev => ({ ...prev, [k]: !prev[k] }))
  const seleccionarTodo = () => {
    const next = { ...modelo }
    for (const k of Object.keys(next)) next[k] = true
    setModelo(next)
  }
  const limpiarTodo = () => setModelo(getServiciosCatalogo())

  const pedirConfirmacion = () => {
    setErrorMsg('')
    setSuccessMsg('')
    if (!idOperacion) {
      setErrorMsg('Falta el ID de la operación.')
      return
    }
    setConfirmOpen(true)
  }

  const cancelarConfirmacion = () => setConfirmOpen(false)

  const confirmarGuardar = async () => {
    try {
      setLoading(true)
      const serviciosObj = toServiciosObjeto(modelo)
      await actualizarServiciosOperacion(idOperacion, serviciosObj)

      setSuccessMsg('Servicios actualizados correctamente.')
      onSuccess && onSuccess({ idOperacion, servicios: serviciosObj })

      // Mostrar modal de éxito con la lista de activos en texto
      setConfirmOpen(false)
      setSuccessOpen(true)

      // Auto-cerrar el modal padre
      setTimeout(() => {
        setSuccessOpen(false)
        onClose && onClose()
      }, AUTO_CLOSE_DELAY_MS)
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'No fue posible actualizar los servicios.'
      setErrorMsg(msg)
      setConfirmOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='p-1'>
      {/* Modal de confirmación (previo a guardar) */}
      <ConfirmPanel
        open={confirmOpen}
        title='Confirmar actualización'
        desc={`Vas a guardar servicios de la operación ${idOperacion}. Activos: ${activos.length}`}
        items={activos}
        loading={loading}
        onCancel={cancelarConfirmacion}
        onConfirm={confirmarGuardar}
        confirmText='Confirmar'
      />

      {/* Modal de éxito: lista de activos y cierre */}
      <ConfirmPanel
        open={successOpen}
        title='Servicios actualizados'
        desc={`Operación ${idOperacion}. Estos servicios quedaron activos:`}
        items={activos}
        loading={false}
        onCancel={null}
        onConfirm={() => {
          setSuccessOpen(false)
          onClose && onClose()
        }}
        confirmText='Aceptar'
      />

      <div className='d-flex align-items-center justify-content-between mb-3'>
        <h5 className='mb-0'>
          Asignar servicios a {idOperacion || '(sin operación)'}
        </h5>
        {onClose && (
          <button
            className='btn btn-sm btn-outline-secondary'
            onClick={onClose}
          >
            Cerrar
          </button>
        )}
      </div>

      {errorMsg && (
        <div className='alert alert-danger py-2 mb-3'>{errorMsg}</div>
      )}
      {successMsg && (
        <div className='alert alert-success py-2 mb-3'>{successMsg}</div>
      )}

      {/* Controles rápidos */}
      <div className='d-flex gap-2 mb-2'>
        <button
          type='button'
          className='btn btn-sm btn-outline-primary'
          onClick={seleccionarTodo}
        >
          Seleccionar todo
        </button>
        <button
          type='button'
          className='btn btn-sm btn-outline-secondary'
          onClick={limpiarTodo}
        >
          Limpiar
        </button>
        <span className='ms-auto small text-muted'>
          Activos: {activos.length}
        </span>
      </div>

      {/* Grid de tarjetas clickeables (todo el cuadro clickeable, con color al seleccionar) */}
      <div className='row g-2'>
        {keys.map(k => {
          const selected = !!modelo[k]
          return (
            <div key={k} className='col-12 col-sm-6 col-md-4'>
              <div
                className='border rounded p-3 h-100 d-flex align-items-start gap-2'
                role='button'
                tabIndex={0}
                onClick={() => toggle(k)}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    toggle(k)
                  }
                }}
                style={{
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: selected ? SELECTED_BG : '#FFFFFF',
                  borderColor: selected ? SELECTED_BORDER : '#dee2e6',
                  borderWidth: 2,
                  boxShadow: selected
                    ? '0 0 0 3px rgba(89,161,247,0.18) inset'
                    : 'none',
                  transition:
                    'background 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
                }}
              >
                <input
                  className='form-check-input mt-1'
                  type='checkbox'
                  id={`srv-${k}`}
                  checked={selected}
                  onChange={() => toggle(k)}
                  onClick={e => e.stopPropagation()} // evita doble toggle
                />
                <label
                  className='form-check-label ms-1'
                  htmlFor={`srv-${k}`}
                  style={{ textTransform: 'capitalize', marginTop: 1 }}
                  onClick={e => e.stopPropagation()}
                >
                  {prettify(k)}
                </label>
              </div>
            </div>
          )
        })}
      </div>

      <div className='d-flex justify-content-end mt-3'>
        <button
          className='btn btn-primary'
          onClick={pedirConfirmacion}
          disabled={loading || !idOperacion}
          title='Guardar servicios de la operación'
          style={{ backgroundColor: COLOR_PRIMARY, borderColor: COLOR_PRIMARY }}
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

export default AsignarServicios
