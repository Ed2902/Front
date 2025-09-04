// src/components/Operacion/Tabladeoperador/asignarpersonal.jsx
import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  getPersonal,
  asignarPersonalInternoBatch,
} from '../Tabladeoperacion/operacion_service'

// ───────────────────────────────────────────────────────────────────────────────
//  Diálogo de confirmación
// ───────────────────────────────────────────────────────────────────────────────
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
          {items.length === 1 ? 'persona' : 'personas'} interna(s) a la
          operación <strong>{idOperacion}</strong>.
        </p>

        <div
          className='border rounded p-2 mb-3'
          style={{ maxHeight: 160, overflow: 'auto' }}
        >
          {items.map((p, idx) => (
            <div key={`${p.id_personal}-${idx}`} className='small'>
              • {p.id_personal} — {p.nombre} {p.apellidos} (
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

// ───────────────────────────────────────────────────────────────────────────────
//  Helpers para forma de respuesta y normalización
// ───────────────────────────────────────────────────────────────────────────────
const extractArray = raw => {
  if (Array.isArray(raw)) return raw
  const c1 =
    raw?.data ??
    raw?.results ??
    raw?.personal ??
    raw?.items ??
    raw?.rows ??
    raw?.content
  if (Array.isArray(c1)) return c1
  if (Array.isArray(raw?.data?.results)) return raw.data.results
  if (Array.isArray(raw?.data?.personal)) return raw.data.personal
  return []
}

const normalizePersonal = (arr = []) => {
  if (!Array.isArray(arr)) return []

  const normalized = arr
    .map((p, idx) => {
      // id (soporta variantes de nombre/caso)
      const id =
        p?.id_personal ??
        p?.Id_personal ??
        p?.ID_PERSONAL ??
        p?.id ??
        p?.Id ??
        p?.ID ??
        p?.documento ??
        p?.Documento ??
        p?.DOCUMENTO ??
        p?.cedula ??
        p?.Cedula ??
        p?.CEDULA ??
        idx

      // nombre(s)
      const nombre = p?.nombre ?? p?.Nombre ?? p?.nombres ?? p?.first_name ?? ''

      // apellido(s)
      const apellidos =
        p?.apellidos ??
        p?.Apellido ??
        [p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' ') ??
        p?.last_name ??
        ''

      // cargo/rol
      const cargo = p?.cargo ?? p?.Cargo ?? p?.rol ?? p?.puesto ?? ''

      return {
        id_personal: id != null ? String(id) : String(idx),
        nombre: nombre || '',
        apellidos: apellidos || '',
        cargo: cargo || '',
      }
    })
    .filter(x => x.id_personal)

  // Dedupe por id_personal
  const byId = new Map()
  for (const item of normalized) {
    if (!byId.has(item.id_personal)) byId.set(item.id_personal, item)
  }
  return Array.from(byId.values())
}

// ───────────────────────────────────────────────────────────────────────────────
//  Componente principal
// ───────────────────────────────────────────────────────────────────────────────
const AsignarPersonal = ({ idOperacion, onSuccess, onClose }) => {
  const [internos, setInternos] = useState([]) // catálogo completo
  const [busqueda, setBusqueda] = useState('') // texto de búsqueda
  const [addingId, setAddingId] = useState('') // entrada directa por ID
  const [seleccionados, setSeleccionados] = useState([]) // lista a enviar
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, lastId: null })

  // Carga catálogo
  useEffect(() => {
    const cargar = async () => {
      try {
        setErrorMsg('')
        const raw = await getPersonal()
        console.log('Respuesta /personal ->', raw)
        const payload = extractArray(raw)
        const normalized = normalizePersonal(payload)
        setInternos(normalized)
        if (normalized.length === 0) {
          console.warn(
            'getPersonal() devolvió vacío o con llaves distintas:',
            raw
          )
        }
      } catch (err) {
        console.error('Error cargando /personal:', err)
        setErrorMsg('No fue posible cargar el personal interno.')
      }
    }
    cargar()
  }, [])

  // Filtro por id/nombre/apellidos
  const resultados = useMemo(() => {
    if (!busqueda.trim()) return internos.slice(0, 20)
    const q = busqueda.trim().toLowerCase()
    return internos
      .filter(
        p =>
          String(p.id_personal || '')
            .toLowerCase()
            .includes(q) ||
          String(p.nombre || '')
            .toLowerCase()
            .includes(q) ||
          String(p.apellidos || '')
            .toLowerCase()
            .includes(q)
      )
      .slice(0, 20)
  }, [busqueda, internos])

  const yaSeleccionado = useCallback(
    id => seleccionados.some(s => String(s.id_personal) === String(id)),
    [seleccionados]
  )

  // Agregar desde la lista filtrada
  const agregarDesdeLista = p => {
    if (!p?.id_personal) return
    if (yaSeleccionado(p.id_personal)) return
    setSeleccionados(prev => [...prev, p])
  }

  // Agregar manual por ID (sólo desde caché local)
  const agregarPorId = async () => {
    const id = addingId.trim()
    if (!id) return
    if (yaSeleccionado(id)) {
      setAddingId('')
      return
    }
    const found = internos.find(x => String(x.id_personal) === id)
    if (found) {
      setSeleccionados(prev => [...prev, found])
      setAddingId('')
    } else {
      setErrorMsg(
        `No se encontró el personal interno con ID ${id} en el catálogo cargado.`
      )
    }
  }

  const quitarSeleccion = id => {
    setSeleccionados(prev =>
      prev.filter(s => String(s.id_personal) !== String(id))
    )
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

  // Enviar (batch) con validación de IDs contra catálogo
  const confirmarAsignacion = async () => {
    try {
      setLoading(true)
      setProgress({ done: 0, total: seleccionados.length, lastId: null })

      const ids = seleccionados.map(s => s.id_personal)
      const validSet = new Set(internos.map(x => String(x.id_personal)))
      const idsValid = ids.filter(id => validSet.has(String(id)))
      const idsInvalid = ids.filter(id => !validSet.has(String(id)))

      if (idsValid.length === 0) {
        setErrorMsg(
          'No hay IDs válidos para asignar. Verifica que los registros tengan id_personal correcto.'
        )
        setLoading(false)
        setConfirmOpen(false)
        return
      }

      const result = await asignarPersonalInternoBatch(idOperacion, idsValid, {
        onProgress: ({ done, total, id }) =>
          setProgress({ done, total, lastId: id }),
      })

      setConfirmOpen(false)

      // Adjunta errores por IDs inválidos (si los hubo)
      if (idsInvalid.length > 0) {
        result.fail = [
          ...result.fail,
          ...idsInvalid.map(id => ({
            id,
            error: 'ID inválido (no está en catálogo)',
          })),
        ]
      }

      if (result.fail.length === 0) {
        setSuccessMsg(
          `Asignación completada: ${result.ok.length} ${
            result.ok.length === 1 ? 'interno' : 'internos'
          } agregado(s).`
        )
        setSeleccionados([])
        onSuccess && onSuccess()
      } else {
        const okCount = result.ok.length
        const failLines = result.fail
          .map(f => `• ${f.id}: ${f.error || 'Error'}`)
          .join('\n')
        setErrorMsg(
          `Se asignaron ${okCount} y fallaron ${result.fail.length}:\n${failLines}`
        )
        if (okCount > 0) onSuccess && onSuccess()
        // Mantener sólo los que FALLARON para reintentar
        const failedIds = new Set(result.fail.map(f => String(f.id)))
        setSeleccionados(prev =>
          prev.filter(p => failedIds.has(String(p.id_personal)))
        )
      }
    } catch (err) {
      console.error(err)
      setErrorMsg(
        err?.response?.data?.message ||
          err?.message ||
          'No se pudo asignar el personal.'
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
          Asignar personal a {idOperacion || '(sin operación)'}
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
            placeholder='1032…, Juan, Gómez…'
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
                  resultados.map((p, idx) => (
                    <tr key={`${p.id_personal}-${idx}`}>
                      <td>{p.id_personal}</td>
                      <td>{p.nombre}</td>
                      <td>{p.apellidos}</td>
                      <td>{p.cargo || '—'}</td>
                      <td className='text-end'>
                        <button
                          className='btn btn-sm btn-outline-primary'
                          onClick={() => agregarDesdeLista(p)}
                          disabled={yaSeleccionado(p.id_personal)}
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
              placeholder='1032485205'
              value={addingId}
              onChange={e => setAddingId(e.target.value.replace(/\D/g, ''))}
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
                  {seleccionados.map((p, idx) => (
                    <li
                      key={`${p.id_personal}-${idx}`}
                      className='list-group-item d-flex justify-content-between align-items-center px-0'
                    >
                      <div className='me-2'>
                        <div className='fw-semibold small'>{p.id_personal}</div>
                        <div className='small text-muted'>
                          {p.nombre} {p.apellidos} — {p.cargo || '—'}
                        </div>
                      </div>
                      <button
                        className='btn btn-sm btn-outline-danger'
                        onClick={() => quitarSeleccion(p.id_personal)}
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
              {loading
                ? `Procesando… (${progress.done}/${progress.total}${
                    progress.lastId ? ` • ${progress.lastId}` : ''
                  })`
                : 'Asignar a operación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AsignarPersonal
