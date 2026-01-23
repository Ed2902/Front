// AgregarHistorialservice.js
import axios from 'axios'

const API_URL_5 = import.meta.env.VITE_API_URL_5 || '' // ej: http://localhost:4000/tikets

function buildAuthHeaders(token) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  // OJO: NO setear Content-Type aquí. Axios lo pone con boundary para FormData.
  return headers
}

/**
 * Agregar evento al historial usando el endpoint existente:
 * PATCH /tikets/tickets/:ticketId/state
 *
 * @param {Object} params
 * @param {string} params.ticketId
 * @param {string} params.token
 * @param {string|number} params.id_personal
 * @param {string} params.estado_id
 * @param {string} [params.nota]
 * @param {string|null|undefined} [params.fecha_estimada] // "YYYY-MM-DD" o ISO
 * @param {File[]} [params.adjuntos] // archivos
 */
export async function agregarHistorialState({
  ticketId,
  token,
  id_personal,
  estado_id,
  nota = '',
  fecha_estimada, // undefined = no tocar; '' = enviar vacío; null = enviar vacío
  adjuntos = [],
}) {
  if (!ticketId) throw new Error('Falta ticketId')
  if (!token) throw new Error('Falta token')
  if (!id_personal) throw new Error('Falta id_personal')
  if (!estado_id) throw new Error('Falta estado_id')

  const fd = new FormData()
  fd.append('id_personal', String(id_personal))
  fd.append('estado_id', String(estado_id))
  fd.append('nota', String(nota || '').trim())

  // si lo envías, el backend lo procesa; si no lo envías, backend mantiene la actual
  if (fecha_estimada !== undefined) {
    // permite '' o null para “quitar”
    fd.append('fecha_estimada', fecha_estimada ? String(fecha_estimada) : '')
  }

  if (Array.isArray(adjuntos)) {
    for (const f of adjuntos) {
      if (f) fd.append('adjuntos', f) // ✅ mismo key repetido
    }
  }

  const url = `${API_URL_5}/tickets/${ticketId}/state`
  const { data } = await axios.patch(url, fd, {
    headers: buildAuthHeaders(token),
  })

  if (!data?.ok) {
    throw new Error(data?.error || 'No se pudo agregar al historial.')
  }

  return data
}
