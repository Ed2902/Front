import axios from 'axios'

// Instancia base de Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Función para obtener el token desde localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// 📊 Obtener historial enriquecido con joins (para análisis)
export const getHistorialConLote = async () => {
  const token = getAuthToken()
  const response = await api.get('/historial/con-lote', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 📦 Obtener inventario base (sin joins)
export const getInventarioPlano = async () => {
  const token = getAuthToken()
  const response = await api.get('/inventario', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 📇 Obtener lista de proveedores
export const getProveedores = async () => {
  const token = getAuthToken()
  const response = await api.get('/proveedor', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}
