// src/services/personalService.js
import axios from 'axios'

const API_URL_2 = import.meta.env.VITE_API_URL_2
const API_URL = import.meta.env.VITE_API_URL

export const getPersonalListado = async token => {
  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const { data } = await axios.get(`${API_URL_2}/app/personal`, { headers })

  if (!Array.isArray(data)) {
    throw new Error('Respuesta inesperada del servidor en /app/personal')
  }

  return data
}

export const getMiPerfilDetalle = async (documento, token) => {
  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const { data } = await axios.get(`${API_URL_2}/app/personal`, { headers })

  if (!Array.isArray(data)) {
    throw new Error('Respuesta inesperada del servidor en /app/personal')
  }

  const encontrado = data.find(item => item.documento === documento)

  return encontrado || null
}

/* ============================================================
   🔥 ENDPOINT PARA HISTORIAL DEL PERSONAL
   personal-historial/personal/:idPersonal
   (usa VITE_API_URL, NO API_URL_2)
============================================================ */
export const getHistorialPersonal = async (idPersonal, token) => {
  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  // 👇 aquí usamos API_URL
  const url = `${API_URL}/personal-historial/personal/${idPersonal}`

  const { data } = await axios.get(url, { headers })

  if (!data || typeof data !== 'object' || !Array.isArray(data.historial)) {
    throw new Error(
      'Respuesta inesperada del servidor en /personal-historial/personal'
    )
  }

  return data // { id_personal, historial: [...] }
}
