import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

// Token desde localStorage
const getAuthToken = () => localStorage.getItem('token')

// GET - listar alistamientos (paginado 100 en back)
export const listarAlistamientos = async (params = {}) => {
  const token = getAuthToken()
  const response = await api.get('/alistamientos', {
    headers: { Authorization: `Bearer ${token}` },
    params,
  })
  return response.data
}

// GET - detalle alistamiento
export const obtenerAlistamiento = async id_alistamiento => {
  const token = getAuthToken()
  const response = await api.get(`/alistamientos/${id_alistamiento}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// POST - crear alistamiento (FormData)
// FormData:
// - nombre
// - id_cliente (opcional)
// - id_personal
// - comentario (opcional)
// - items (JSON string)
// - evidencia_general (FILE) obligatorio
export const crearAlistamiento = async formData => {
  const token = getAuthToken()
  const response = await api.post('/alistamientos', formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      // axios setea multipart automáticamente, no forzamos boundary
    },
  })
  return response.data
}

// PATCH - cancelar alistamiento (si ya lo tienes en back)
export const cancelarAlistamiento = async id_alistamiento => {
  const token = getAuthToken()
  const response = await api.patch(
    `/alistamientos/${id_alistamiento}/cancelar`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return response.data
}
