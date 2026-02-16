import { useContext, useMemo, useState } from 'react'
import AuthContext from '../../../context/AuthContext'
import { agregarHistorialState } from './AgregarHistorialservice'

const MAX_FILES = 20

export default function AgregarHistorialTicket({
  ticketId,
  orgId,
  maps,
  onSuccess,
  onError,
  className = '',
  hideCerrado = false, // ✅ NUEVO
}) {
  const { token, user } = useContext(AuthContext)
  const id_personal = user?.personal?.id_personal

  const [estadoId, setEstadoId] = useState('')
  const [nota, setNota] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const estados = useMemo(() => {
    const m = maps?.estadosMap || {}

    return (
      Object.values(m)
        .filter(Boolean)
        .filter(s => {
          if (!orgId) return true
          if (s.orgId === undefined) return true
          return String(s.orgId) === String(orgId)
        })
        // ✅ SOLO filtra Cerrado si hideCerrado=true
        .filter(s => {
          if (!hideCerrado) return true
          const labelRaw =
            s.name || s.name_norm || s.nombre || s.nombre_norm || s.code || ''
          const label = String(labelRaw).trim().toLowerCase()
          return label !== 'cerrado'
        })
        .map(s => ({
          _id: String(s._id),
          label:
            s.name ||
            s.name_norm ||
            s.nombre ||
            s.nombre_norm ||
            s.code ||
            String(s._id),
          order: Number(s.order ?? 9999),
        }))
        .sort((a, b) => a.order - b.order)
    )
  }, [maps, orgId, hideCerrado])

  const onPickFiles = e => {
    const list = Array.from(e.target.files || [])

    if (list.length > MAX_FILES) {
      setError(`Máximo ${MAX_FILES} adjuntos permitidos.`)
      setFiles(list.slice(0, MAX_FILES))
      return
    }

    setError('')
    setFiles(list)
  }

  const resetForm = () => {
    setEstadoId('')
    setNota('')
    setFiles([])
    setError('')
  }

  const submit = async e => {
    e.preventDefault()
    setError('')

    if (!ticketId) return setError('Falta ticketId')
    if (!token) return setError('No hay token')
    if (!id_personal) return setError('No hay id_personal en AuthContext')
    if (!estadoId) return setError('Selecciona un estado')

    try {
      setLoading(true)

      const data = await agregarHistorialState({
        ticketId,
        token,
        id_personal,
        estado_id: estadoId,
        nota,
        adjuntos: files,
      })

      resetForm()
      onSuccess?.(data)
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Error agregando al historial'

      setError(msg)
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`border rounded p-3 bg-white ${className}`}>
      <div className='d-flex align-items-center justify-content-between mb-2'>
        <div className='fw-bold'>Agregar al historial</div>
        <span className='badge bg-light text-dark'>usa /state</span>
      </div>

      {error && <div className='alert alert-danger py-2 mb-2'>{error}</div>}

      <form onSubmit={submit} className='d-flex flex-column gap-2'>
        <label className='small fw-semibold'>Estado</label>
        <select
          className='form-select form-select-sm'
          value={estadoId}
          onChange={e => setEstadoId(e.target.value)}
        >
          <option value=''>— Selecciona —</option>
          {estados.map(s => (
            <option key={s._id} value={s._id}>
              {s.label}
            </option>
          ))}
        </select>

        <label className='small fw-semibold mt-1'>Nota</label>
        <textarea
          className='form-control form-control-sm'
          rows={3}
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder='Escribe una nota...'
        />

        <label className='small fw-semibold mt-1'>
          Adjuntos (opcional)
          <span className='text-muted ms-1'>— máximo 20</span>
        </label>
        <input
          type='file'
          className='form-control form-control-sm'
          multiple
          onChange={onPickFiles}
        />

        {files.length > 0 && (
          <div className='small text-muted'>
            📎 {files.length} / {MAX_FILES} archivo(s)
          </div>
        )}

        <div className='d-flex gap-2 mt-2'>
          <button
            type='submit'
            className='btn btn-sm btn-primary'
            disabled={loading}
          >
            {loading ? 'Guardando...' : 'Agregar al historial'}
          </button>

          <button
            type='button'
            className='btn btn-sm btn-outline-secondary'
            onClick={resetForm}
            disabled={loading}
          >
            Limpiar
          </button>
        </div>
      </form>
    </div>
  )
}
