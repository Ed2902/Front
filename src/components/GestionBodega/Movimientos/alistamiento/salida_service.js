// salida_service.js
import axios from 'axios'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const api = axios.create({
  baseURL: API_URL, // normalmente termina en /api
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/**
 * Crea 1 salida con evidencia por item (multipart/form-data)
 * Endpoint actual: POST /historial/salida
 */
export const crearSalida = async formData => {
  const { data } = await api.post('/historial/salida', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
