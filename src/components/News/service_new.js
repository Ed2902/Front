// src/services/news/service_new.js
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // <-- viene de tu .env
})

const getAuthToken = () => localStorage.getItem('token')

// GET /api/news?from&to
export const listarNoticias = async (params = {}) => {
  const token = getAuthToken()
  const res = await api.get('/news', {
    params,
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data
}

// GET /api/news/:id
export const obtenerNoticia = async id => {
  const token = getAuthToken()
  const res = await api.get(`/news/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data
}

// POST /api/news  (multipart/form-data: image, title?, text, date)
export const crearNoticia = async ({ title = '', text, date, imageFile }) => {
  const token = getAuthToken()
  const fd = new FormData()
  if (title) fd.append('title', title)
  fd.append('text', text)
  fd.append('date', date)
  fd.append('image', imageFile) // campo esperado por el backend

  // No seteamos Content-Type manualmente (axios pone boundary)
  const res = await api.post('/news', fd, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data
}

// PUT /api/news/:id  (multipart/form-data opcional: image)
export const actualizarNoticia = async (
  id,
  { title, text, date, imageFile }
) => {
  const token = getAuthToken()
  const fd = new FormData()
  if (title !== undefined) fd.append('title', title)
  if (text !== undefined) fd.append('text', text)
  if (date !== undefined) fd.append('date', date)
  if (imageFile) fd.append('image', imageFile)

  const res = await api.put(`/news/${id}`, fd, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data
}

// DELETE /api/news/:id
export const eliminarNoticia = async id => {
  const token = getAuthToken()
  const res = await api.delete(`/news/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data
}
