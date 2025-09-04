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

// 🚛 Obtener inventario completo con joins (producto, lote, bodega, ubicación, cliente/proveedor)
export const getInventarioCompleto = async () => {
  const token = getAuthToken()
  const response = await api.get('/inventario/detalle/completo', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 📦 Obtener inventario plano sin joins (opcional)
export const getInventarioPlano = async () => {
  const token = getAuthToken()
  const response = await api.get('/inventario', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 📜 Obtener historial de movimientos (entradas, salidas, etc.)
export const getHistorialMovimientos = async () => {
  const token = getAuthToken()
  const response = await api.get('/historial', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

export const getHistorialConLote = async () => {
  const token = localStorage.getItem('token')
  const response = await api.get('/historial/con-lote', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}
