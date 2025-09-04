// src/components/Operaciones/asignarcuadrilla.jsx
import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  getPersonalExterno,
  getPersonalExternoById,
  asignarCuadrillaBatch,
} from '../Tabladeoperacion/operacion_service'

const ConfirmAssignPanel = ({
  open,
  loading,
  idOperacion,
  items,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null
  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='confirm-assign-title'
      aria-describedby='confirm-assign-desc'
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
      {/* Card */}
      <div
        className='shadow-lg rounded-3 border bg-white p-4'
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 520px)',
        }}
      >
        <h6 id='confirm-assign-title' className='mb-2'>
          Confirmar asignación
        </h6>
        <p id='confirm-assign-desc' className='small text-muted'>
          Vas a asignar <strong>{items.length}</strong>{' '}
          {items.length === 1 ? 'persona' : 'personas'} externa(s) a la
          operación <strong>{idOperacion}</strong>.
        </p>

        <div
          className='border rounded p-2 mb-3'
          style={{ maxHeight: 160, overflow: 'auto' }}
        >
          {items.map(p => (
            <div key={p.id_externo} className='small'>
              • {p.id_externo} — {p.nombre} {p.apellidos} (
              {p.cargo || 'Sin cargo'})
            </div>
          ))}
        </div>

        <div className='d-flex justify-content-end gap-2'>
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
            {loading ? 'Asignando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const AsignarCuadrilla = ({ idOperacion, onSuccess, onClose }) => {
  const [externos, setExternos] = useState([]) // catálogo completo
  const [busqueda, setBusqueda] = useState('') // texto de búsqueda
  const [addingId, setAddingId] = useState('') // entrada directa por ID
  const [seleccionados, setSeleccionados] = useState([]) // lista a enviar
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Carga catálogo
  useEffect(() => {
    const cargar = async () => {
      try {
        setErrorMsg('')
        const data = await getPersonalExterno()
        setExternos(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
        setErrorMsg('No fue posible cargar el personal externo.')
      }
    }
    cargar()
  }, [])

  // Filtro por id/nombre/apellidos
  const resultados = useMemo(() => {
    if (!busqueda.trim()) return externos.slice(0, 10)
    const q = busqueda.trim().toLowerCase()
    return externos
      .filter(
        p =>
          String(p.id_externo || '')
            .toLowerCase()
            .includes(q) ||
          String(p.nombre || '')
            .toLowerCase()
            .includes(q) ||
          String(p.apellidos || '')
            .toLowerCase()
            .includes(q)
      )
      .slice(0, 10)
  }, [busqueda, externos])

  const yaSeleccionado = useCallback(
    id => seleccionados.some(s => s.id_externo === id),
    [seleccionados]
  )

  // Agregar desde la lista filtrada
  const agregarDesdeLista = p => {
    if (!p?.id_externo) return
    if (yaSeleccionado(p.id_externo)) return
    setSeleccionados(prev => [...prev, p])
  }

  // Agregar manual por ID (busca en caché o al backend)
  const agregarPorId = async () => {
    const id = addingId.trim().toUpperCase()
    if (!id) return
    if (yaSeleccionado(id)) {
      setAddingId('')
      return
    }
    // En caché
    const cached = externos.find(x => String(x.id_externo).toUpperCase() === id)
    if (cached) {
      setSeleccionados(prev => [...prev, cached])
      setAddingId('')
      return
    }
    // Buscar en API
    try {
      const one = await getPersonalExternoById(id)
      if (one && one.id_externo) {
        setSeleccionados(prev => [...prev, one])
        setAddingId('')
      } else {
        setErrorMsg(`No se encontró el personal externo con ID ${id}.`)
      }
    } catch (err) {
      console.error(err)
      setErrorMsg(`Error buscando ID ${id}.`)
    }
  }

  const quitarSeleccion = id => {
    setSeleccionados(prev => prev.filter(s => s.id_externo !== id))
  }

  // Abrir confirmación
  const pedirConfirmacion = () => {
    setErrorMsg('')
    setSuccessMsg('')
    if (!idOperacion) {
      setErrorMsg('Falta el ID de la operación.')
      return
    }
    if (seleccionados.length === 0) {
      setErrorMsg('Agrega al menos una persona a la lista.')
      return
    }
    setConfirmOpen(true)
  }

  // Enviar (batch)
  const confirmarAsignacion = async () => {
    try {
      setLoading(true)
      const ids = seleccionados.map(s => s.id_externo)
      const result = await asignarCuadrillaBatch(idOperacion, ids)

      setConfirmOpen(false)

      if (result.fail.length === 0) {
        setSuccessMsg(
          `Asignación completada: ${result.ok.length} ${
            result.ok.length === 1 ? 'externo' : 'externos'
          } agregado(s).`
        )
        setSeleccionados([])
        onSuccess && onSuccess()
      } else {
        // Mostramos resumen; si hubo algunos OK también lo indicamos
        const okCount = result.ok.length
        const failLines = result.fail
          .map(f => `• ${f.id}: ${f.error || 'Error'}`)
          .join('\n')
        setErrorMsg(
          `Se asignaron ${okCount} y fallaron ${result.fail.length}:\n${failLines}`
        )
        // Si hubo algunos OK, refrescamos la vista externa igualmente
        if (okCount > 0) onSuccess && onSuccess()
        // Mantenemos en seleccionados los que FALLARON para que el usuario decida
        const failedIds = new Set(result.fail.map(f => f.id))
        setSeleccionados(prev => prev.filter(p => failedIds.has(p.id_externo)))
      }
    } catch (err) {
      console.error(err)
      setErrorMsg(
        err?.response?.data?.message ||
          err?.message ||
          'No se pudo asignar la cuadrilla.'
      )
      setConfirmOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Confirmación previa */}
      <ConfirmAssignPanel
        open={confirmOpen}
        loading={loading}
        idOperacion={idOperacion}
        items={seleccionados}
        onConfirm={confirmarAsignacion}
        onCancel={() => setConfirmOpen(false)}
      />

      <div className='d-flex align-items-center justify-content-between mb-3'>
        <h5 className='mb-0'>
          Asignar cuadrilla a {idOperacion || '(sin operación)'}
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
        <pre
          className='alert alert-danger py-2 mb-3'
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {errorMsg}
        </pre>
      )}
      {successMsg && (
        <div className='alert alert-success py-2 mb-3'>{successMsg}</div>
      )}

      {/* Buscar por texto */}
      <div className='row g-2'>
        <div className='col-md-8'>
          <label className='form-label'>Buscar (ID / nombre / apellidos)</label>
          <input
            type='text'
            className='form-control'
            placeholder='EX123, Juan, Gómez…'
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <div
            className='mt-2 border rounded'
            style={{ maxHeight: 220, overflow: 'auto' }}
          >
            <table className='table table-sm mb-0'>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>ID</th>
                  <th>Nombre</th>
                  <th>Apellidos</th>
                  <th>Cargo</th>
                  <th style={{ width: 1 }} />
                </tr>
              </thead>
              <tbody>
                {resultados.length === 0 ? (
                  <tr>
                    <td colSpan='5' className='text-muted small'>
                      Sin resultados
                    </td>
                  </tr>
                ) : (
                  resultados.map(p => (
                    <tr key={p.id_externo}>
                      <td>{p.id_externo}</td>
                      <td>{p.nombre}</td>
                      <td>{p.apellidos}</td>
                      <td>{p.cargo || '—'}</td>
                      <td className='text-end'>
                        <button
                          className='btn btn-sm btn-outline-primary'
                          onClick={() => agregarDesdeLista(p)}
                          disabled={yaSeleccionado(p.id_externo)}
                          title='Agregar a la lista'
                        >
                          Agregar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Agregar por ID directamente */}
        <div className='col-md-4'>
          <label className='form-label'>Agregar por ID</label>
          <div className='input-group'>
            <input
              type='text'
              className='form-control'
              placeholder='EX001'
              value={addingId}
              onChange={e => setAddingId(e.target.value.toUpperCase())}
            />
            <button className='btn btn-outline-primary' onClick={agregarPorId}>
              Agregar
            </button>
          </div>

          {/* Seleccionados */}
          <div className='mt-3'>
            <div className='d-flex align-items-center justify-content-between mb-1'>
              <strong className='mb-0'>Seleccionados</strong>
              <span className='badge bg-secondary'>{seleccionados.length}</span>
            </div>
            <div
              className='border rounded p-2'
              style={{ maxHeight: 260, overflow: 'auto' }}
            >
              {seleccionados.length === 0 ? (
                <div className='text-muted small'>
                  Aún no has agregado personas.
                </div>
              ) : (
                <ul className='list-group list-group-flush'>
                  {seleccionados.map(p => (
                    <li
                      key={p.id_externo}
                      className='list-group-item d-flex justify-content-between align-items-center px-0'
                    >
                      <div className='me-2'>
                        <div className='fw-semibold small'>{p.id_externo}</div>
                        <div className='small text-muted'>
                          {p.nombre} {p.apellidos} — {p.cargo || '—'}
                        </div>
                      </div>
                      <button
                        className='btn btn-sm btn-outline-danger'
                        onClick={() => quitarSeleccion(p.id_externo)}
                        title='Quitar de la lista'
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              className='btn btn-primary w-100 mt-3'
              onClick={pedirConfirmacion}
              disabled={loading || seleccionados.length === 0 || !idOperacion}
              title='Asignar a la operación (requiere confirmación)'
            >
              {loading ? 'Procesando…' : 'Asignar a operación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AsignarCuadrilla
