// src/services/Marcacion_service.js
import axios from 'axios'

// Instancia base (sin Authorization)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL_2,
})

/* ================= Helpers de token/JWT ================= */

// Lee el token crudo desde localStorage
const getRawToken = () => localStorage.getItem('token') || null

// Decodifica el payload de un JWT (base64url → JSON)
const decodeJwtPayload = jwt => {
  try {
    const [, payload] = jwt.split('.')
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

// Obtiene el id_personal del token (acepta dos formas: directa o dentro de "personal")
export const getDocumentoDesdeToken = () => {
  const token = getRawToken()
  if (!token) return null
  const payload = decodeJwtPayload(token)
  return payload?.id_personal ?? payload?.personal?.id_personal ?? null
}

/* ===================== Services ===================== */

// POST /app/marcacion/auto
// Envia form-data con: tipo (entrada|salida), file (File), umbral (oculto, fijo en 0.55)
// onProgress es opcional para barra de carga (0-100)
export const postMarcacionAuto = async ({
  tipo,
  file,
  umbral = 0.55,
  onProgress,
}) => {
  const formData = new FormData()
  formData.append('tipo', tipo)
  formData.append('file', file)
  formData.append('umbral', String(umbral))

  const resp = await api.post('/app/marcacion/auto', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // por si tarda ~20s
    onUploadProgress: evt => {
      if (onProgress && evt.total) {
        const pct = Math.round((evt.loaded * 100) / evt.total)
        onProgress(pct)
      }
    },
  })
  return resp.data
}

// GET /app/marcacion → historial completo (array)
export const getMarcacionHistorial = async () => {
  const resp = await api.get('/app/marcacion')
  return resp.data
}

// GET filtrado por el usuario actual (matchea token.id_personal con personal.documento)
export const getMarcacionHistorialDelUsuarioActual = async () => {
  const documentoToken = getDocumentoDesdeToken() // p.ej. "1032485205"
  const data = await getMarcacionHistorial()
  if (!documentoToken) return [] // si no hay token, no filtramos (o decide devolver data)

  const arr = Array.isArray(data) ? data : []
  return arr.filter(item => {
    const doc = item?.personal?.documento
    return doc != null && String(doc) === String(documentoToken)
  })
}
