// salida_service.js
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

const getAuthToken = () => localStorage.getItem('token')

// ===============================
// HELPERS: PRODUCTOS / PERSONAL
// ===============================

// ✅ como tu ejemplo: /producto para obtener nombre
export const getProductos = async () => {
  const token = getAuthToken()
  const response = await api.get('/producto', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// ✅ /personal para obtener nombre del operador
export const getPersonal = async () => {
  const token = getAuthToken()
  const response = await api.get('/personal', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// ===============================
// SALIDAS (SOLO LECTURA)
// ===============================

// Listar salidas (tabla)
// Soporta query params si tu back los implementa: q, page, limit, desde, hasta, etc.
// Importante: limit máximo 100
export const listarSalidas = async params => {
  const token = getAuthToken()
  const safe = { ...(params || {}) }

  // fuerza limit <= 100
  if (safe.limit) safe.limit = Math.min(100, Number(safe.limit) || 10)

  const response = await api.get('/salidas', {
    params: safe,
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// Obtener 1 salida (por si la necesitas en otra pantalla)
export const obtenerSalida = async idSalida => {
  const token = getAuthToken()
  const response = await api.get(`/salidas/${idSalida}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}
