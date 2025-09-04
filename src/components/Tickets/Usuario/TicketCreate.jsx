import { useContext, useState } from 'react'
import AuthContext from '../../../context/AuthContext' // ajusta si tu ruta difiere
import { createTicket } from './tickets_service' // ajusta si tu ruta difiere

const CATEGORIAS = [
  'Hardware',
  'Software',
  'Redes',
  'Correo',
  'Telefonía',
  'Impresoras',
  'Accesos',
  'Seguridad',
  'Servidor',
  'Aplicaciones',
  'Otros',
]

/**
 * Props:
 * - onCreated?: (row) => void   // callback al crear exitosamente
 */
const TicketCreate = ({ onCreated }) => {
  const { user } = useContext(AuthContext)
  const idPersonal = user?.personal?.id_personal || user?.id_personal || ''

  const [asunto, setAsunto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [nivel, setNivel] = useState('Media')
  const [categoria, setCategoria] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const resetForm = () => {
    setAsunto('')
    setDescripcion('')
    setNivel('Media')
    setCategoria('')
    setError('')
    setSuccess('')
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validación mínima
    if (!asunto.trim() || !descripcion.trim() || !categoria) {
      setError('Completa Asunto, Descripción y Categoría.')
      return
    }
    if (!idPersonal) {
      setError('No se encontró Id_personal_solicitante en la sesión.')
      return
    }

    // Confirmación explícita
    const confirmado = window.confirm('¿Confirmas crear este ticket?')
    if (!confirmado) return

    const payload = {
      Asunto: asunto.trim(),
      Descripcion: descripcion.trim(),
      Nivel: nivel, // 'Alta' | 'Media' | 'Baja'
      Categoria: categoria, // según lista de CATEGORIAS
      Id_personal_solicitante: String(idPersonal),
    }

    try {
      setLoading(true)
      const resp = await createTicket(payload) // { ok: true, row: {...} }
      if (!resp?.ok) {
        setError('No se pudo crear el ticket.')
        return
      }

      const idCreado = resp?.row?.id_tiket ?? ''
      setSuccess(
        `Ticket creado correctamente${idCreado ? ` (ID: ${idCreado})` : ''}.`
      )

      // Notificar al padre
      onCreated?.(resp.row)

      // Opcional: limpiar el formulario tras crear
      resetForm()
      setSuccess(
        `Ticket creado correctamente${idCreado ? ` (ID: ${idCreado})` : ''}.`
      )
    } catch (err) {
      console.error(err)
      setError('Ocurrió un error al crear el ticket.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='p-3 border rounded'>
      <h5 className='mb-3'>Crear Ticket</h5>

      {error && <div className='alert alert-danger py-2'>{error}</div>}
      {success && <div className='alert alert-success py-2'>{success}</div>}

      <div className='mb-3'>
        <label className='form-label'>Asunto *</label>
        <input
          className='form-control'
          value={asunto}
          onChange={e => setAsunto(e.target.value)}
          maxLength={120}
          placeholder='Describe el problema en una línea'
          required
          disabled={loading}
        />
      </div>

      <div className='mb-3'>
        <label className='form-label'>Descripción *</label>
        <textarea
          className='form-control'
          rows={4}
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          placeholder='Incluye detalles útiles para soporte'
          required
          disabled={loading}
        />
      </div>

      <div className='row g-2'>
        <div className='col-md-6'>
          <label className='form-label'>Categoría *</label>
          <select
            className='form-select'
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            required
            disabled={loading}
          >
            <option value=''>Selecciona...</option>
            {CATEGORIAS.map(op => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>

        <div className='col-md-6'>
          <label className='form-label'>Nivel</label>
          <select
            className='form-select'
            value={nivel}
            onChange={e => setNivel(e.target.value)}
            disabled={loading}
          >
            <option value='Alta'>Alta</option>
            <option value='Media'>Media</option>
            <option value='Baja'>Baja</option>
          </select>
        </div>
      </div>

      <div className='mt-3'>
        <small className='text-muted'>
          Id_personal_solicitante: <strong>{idPersonal}</strong>
        </small>
      </div>

      <div className='mt-3 d-flex gap-2'>
        <button type='submit' className='btn btn-primary' disabled={loading}>
          {loading ? 'Creando…' : 'Crear'}
        </button>
        <button
          type='button'
          className='btn btn-outline-secondary'
          onClick={resetForm}
          disabled={loading}
        >
          Limpiar
        </button>
      </div>
    </form>
  )
}

export default TicketCreate
