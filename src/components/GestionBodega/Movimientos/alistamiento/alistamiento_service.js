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

// GET - catálogo de personas (para resolver nombre por id_personal)
export const listarPersonas = async () => {
  const token = getAuthToken()
  const response = await api.get('/personal', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// GET - catálogo de clientes (para resolver nombre por id_cliente)
export const listarClientes = async (params = { page: 1, limit: 100 }) => {
  const token = getAuthToken()
  const response = await api.get('/cliente', {
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

// PUT - actualizar cabecera de alistamiento (puede incluir evidencia_general opcional)
export const actualizarAlistamiento = async (id_alistamiento, payload) => {
  const token = getAuthToken()

  const response = await api.put(`/alistamientos/${id_alistamiento}`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  return response.data
}

// POST - agregar ítem al alistamiento
export const agregarItemAlistamiento = async (id_alistamiento, payload) => {
  const token = getAuthToken()
  const response = await api.post(
    `/alistamientos/${id_alistamiento}/items`,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  return response.data
}

// PUT - editar ítem del alistamiento
export const editarItemAlistamiento = async (
  id_alistamiento,
  itemId,
  payload
) => {
  const token = getAuthToken()
  const response = await api.put(
    `/alistamientos/${id_alistamiento}/items/${itemId}`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return response.data
}

// DELETE - eliminar ítem del alistamiento
export const eliminarItemAlistamiento = async (id_alistamiento, itemId) => {
  const token = getAuthToken()
  const response = await api.delete(
    `/alistamientos/${id_alistamiento}/items/${itemId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
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
