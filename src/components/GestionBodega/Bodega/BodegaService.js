import axios from 'axios'

// ✅ Instancia de Axios base
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ✅ Obtener token del localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

//
// ─────────────────────────────────────────────────────────────
// 📦 BODEGAS - Información general
// ─────────────────────────────────────────────────────────────
//

/**
 * ✅ GET /bodega
 * Trae todas las bodegas con su información básica
 */
export const getBodegas = async () => {
  const token = getAuthToken()
  const response = await api.get('/bodega', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

/**
 * ✅ POST /bodega
 * Crea una nueva bodega (requiere token)
 */
export const createBodega = async data => {
  const token = getAuthToken()
  const response = await api.post('/bodega', data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

//
// ─────────────────────────────────────────────────────────────
// 📍 UBICACIONES - Listado y creación
// ─────────────────────────────────────────────────────────────
//

/**
 * ✅ GET /ubicacion
 * Trae todas las ubicaciones activas
 */
export const getUbicaciones = async () => {
  const token = getAuthToken()
  const response = await api.get('/ubicacion', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

/**
 * ✅ POST /ubicacion_bodega
 * Crea una nueva ubicación (requiere token)
 */
export const createUbicacion = async data => {
  const token = getAuthToken()
  const response = await api.post('/ubicacion', data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

//
// ─────────────────────────────────────────────────────────────
// 📊 OCUPACIÓN - Inventario y volumen ocupado
// ─────────────────────────────────────────────────────────────
//

/**
 * ✅ GET /inventario/detalle/completo
 * Trae los registros de inventario con relaciones para calcular volumen ocupado
 */
export const getOcupacionDetalle = async () => {
  const token = getAuthToken()
  const response = await api.get('/inventario/detalle/completo', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}
