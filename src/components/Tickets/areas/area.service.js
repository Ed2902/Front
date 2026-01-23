// src/services/area.service.js
import axios from 'axios'

const API_URL_5 = import.meta.env.VITE_API_URL_5 // http://localhost:4000/tikets
const API_URL = import.meta.env.VITE_API_URL // http://localhost:3000/api (personal)

const buildHeaders = (token, isFormData = false) => {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'
  return headers
}

// ✅ Encuentra el token aunque no esté en localStorage.getItem("token")
export const getToken = () => {
  // 1) keys comunes
  const keys = ['token', 'authToken', 'accessToken', 'jwt', 'userToken']
  for (const k of keys) {
    const t = localStorage.getItem(k)
    if (t && String(t).trim()) return String(t).trim()
  }

  // 2) objetos json comunes
  const objKeys = ['auth', 'session', 'usuario', 'user', 'dataUser']
  for (const k of objKeys) {
    const raw = localStorage.getItem(k)
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw)
      const t =
        parsed?.token ||
        parsed?.accessToken ||
        parsed?.jwt ||
        parsed?.data?.token ||
        parsed?.user?.token
      if (t && String(t).trim()) return String(t).trim()
    } catch {
      // ignore
    }
  }

  return ''
}

// =====================
// AREAS (API_URL_5)
// =====================
export async function listAreas({ page = 1, limit = 10 } = {}) {
  const token = getToken()
  const { data } = await axios.get(`${API_URL_5}/areas`, {
    headers: buildHeaders(token),
    params: { page, limit },
  })
  return data
}

export async function getAreaById(id) {
  const token = getToken()
  const { data } = await axios.get(`${API_URL_5}/areas/${id}`, {
    headers: buildHeaders(token),
  })
  return data
}

export async function createArea(payload) {
  const token = getToken()
  const { data } = await axios.post(`${API_URL_5}/areas`, payload, {
    headers: buildHeaders(token),
  })
  return data
}

export async function updateArea(id, payload) {
  const token = getToken()
  const { data } = await axios.put(`${API_URL_5}/areas/${id}`, payload, {
    headers: buildHeaders(token),
  })
  return data
}

export async function deactivateArea(id) {
  const token = getToken()
  const { data } = await axios.patch(
    `${API_URL_5}/areas/${id}/deactivate`,
    {},
    { headers: buildHeaders(token) }
  )
  return data
}

// =====================
// PERSONAL (API_URL)
// =====================
export async function getPersonal() {
  const token = getToken()
  const { data } = await axios.get(`${API_URL}/personal`, {
    headers: buildHeaders(token),
  })
  return data
}
