// MisCreaciones.forms.jsx
import React, { useState } from 'react'
import { anyDateToIso } from './MisCreaciones.utils.js'
import { putTicket } from './service.MisCreaciones'

export const EditarTicketForm = ({ ticket, token, id_personal, onSaved }) => {
  const [titulo, setTitulo] = useState(ticket?.titulo || '')
  const [descripcion, setDescripcion] = useState(ticket?.descripcion || '')
  const [fecha_estimada, setFechaEstimada] = useState(() => {
    const iso = anyDateToIso(ticket?.fecha_estimada)
    if (!iso) return ''
    return String(iso).slice(0, 10)
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const onSubmit = async e => {
    e.preventDefault()
    try {
      setSaving(true)
      setErr(null)

      const payload = {
        id_personal: String(id_personal),
        titulo,
        descripcion,
        fecha_estimada: fecha_estimada ? `${fecha_estimada}T00:00:00.000Z` : '',
      }

      await putTicket(ticket?._id, payload, token)
      onSaved?.()
    } catch (e2) {
      console.error(e2)
      setErr('No se pudo editar el ticket.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className='d-flex flex-column gap-2'>
      {err && <div className='alert alert-danger py-2 mb-1'>{err}</div>}

      <div>
        <label className='form-label fw-semibold'>Título</label>
        <input
          className='form-control'
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          required
        />
      </div>

      <div>
        <label className='form-label fw-semibold'>Descripción</label>
        <textarea
          className='form-control'
          rows={4}
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          required
        />
      </div>

      <div>
        <label className='form-label fw-semibold'>Fecha estimada</label>
        <input
          type='date'
          className='form-control'
          value={fecha_estimada}
          onChange={e => setFechaEstimada(e.target.value)}
        />
      </div>

      <div className='d-flex justify-content-end gap-2 mt-2'>
        <button className='btn btn-primary' type='submit' disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
