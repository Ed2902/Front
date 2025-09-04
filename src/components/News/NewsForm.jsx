// src/components/News/NewsForm.jsx
import { useRef, useState } from 'react'
import { crearNoticia } from './service_new.js'

const MAX_TEXT = 250

export default function NewsForm({ onCreated }) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')

    if (!text.trim()) return setError('Debes escribir el texto de la noticia.')
    if (text.length > MAX_TEXT)
      return setError(`Máximo ${MAX_TEXT} caracteres.`)
    if (!date) return setError('Selecciona la fecha.')
    if (!file) return setError('Debes seleccionar una imagen.')

    try {
      setSubmitting(true)
      const created = await crearNoticia({
        title: title.trim(),
        text: text.trim(),
        date,
        imageFile: file,
      })

      // notificar al padre (opcional)
      onCreated?.(created)

      // limpiar formulario
      setTitle('')
      setText('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        (e?.response?.status === 409
          ? 'Solo se permiten 2 noticias por día.'
          : e?.message) ||
        'No se pudo crear la noticia.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className='border rounded p-3 bg-white' onSubmit={handleSubmit}>
      <div className='row g-3'>
        <div className='col-12 col-md-6'>
          <label className='form-label'>Título (opcional)</label>
          <input
            type='text'
            className='form-control'
            placeholder='Ej. Cambio de horario'
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div className='col-12 col-md-3'>
          <label className='form-label'>Fecha</label>
          <input
            type='date'
            className='form-control'
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
      </div>

      <div className='mt-3'>
        <label className='form-label'>
          Texto (máx. {MAX_TEXT} caracteres)
          <span className='ms-2 text-muted small'>
            {text.length}/{MAX_TEXT}
          </span>
        </label>
        <textarea
          className='form-control'
          rows={3}
          value={text}
          onChange={e => setText(e.target.value.slice(0, MAX_TEXT))}
        />
      </div>

      <div className='mt-3'>
        <label className='form-label'>Imagen (archivo)</label>
        <input
          ref={fileInputRef}
          type='file'
          className='form-control'
          accept='image/png, image/jpeg, image/jpg, image/webp, image/gif'
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && <div className='alert alert-danger mt-3 mb-0'>{error}</div>}

      <div className='mt-3'>
        <button type='submit' className='btn btn-primary' disabled={submitting}>
          {submitting ? 'Guardando...' : 'Agregar noticia'}
        </button>
      </div>
    </form>
  )
}
