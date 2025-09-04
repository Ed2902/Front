import axios from 'axios'

// --- Instancia base de Axios ---
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// --- Helpers de auth ---
const getAuthToken = () => localStorage.getItem('token')

// Interceptor: agrega siempre el Bearer token
api.interceptors.request.use(
  config => {
    const token = getAuthToken()
    if (!token) {
      // igual que tu ejemplo: error explícito si falta token
      throw new Error('No hay token en localStorage. Inicia sesión de nuevo.')
    }
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

// Interceptor de respuesta opcional (solo logs claros)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response) {
      const { status, data } = err.response
      if (status === 400) {
        console.error('Solicitud inválida (400):', data)
      } else if (status === 401) {
        console.error('No autorizado (401). Token ausente/expirado.')
      } else if (status === 403) {
        console.error('Prohibido (403). Falta de permisos.')
      }
    }
    return Promise.reject(err)
  }
)

/**
 * Lista todo el personal externo.
 * GET /personal-externo
 * @returns {Promise<Array>}
 */
export const getExternos = async () => {
  const response = await api.get('/personal-externo')
  return response.data
}

/**
 * Crea un personal externo.
 * POST /personal-externo
 * @param {{id_externo:string, nombre:string, apellidos:string, edad:number|string, eps:string, arl:string, telefono:string, cargo:string}} externo
 * @returns {Promise<Object>}
 */
export const crearExterno = async externo => {
  const response = await api.post('/personal-externo', externo)
  return response.data
}

/**
 * Actualiza un personal externo por ID.
 * PUT /personal-externo/:id_externo
 * @param {string} id_externo
 * @param {Partial<{nombre:string, apellidos:string, edad:number|string, eps:string, arl:string, telefono:string, cargo:string}>} payload
 * @returns {Promise<Object>}
 */
export const actualizarExterno = async (id_externo, payload) => {
  const response = await api.put(`/personal-externo/${id_externo}`, payload)
  return response.data
}

/**
 * Elimina un personal externo por ID.
 * DELETE /personal-externo/:id_externo
 * @param {string} id_externo
 * @returns {Promise<Object|void>} - Según tu backend, podría venir vacío (204).
 */
export const eliminarExterno = async id_externo => {
  const response = await api.delete(`/personal-externo/${id_externo}`)
  return response.data
}

export default api
