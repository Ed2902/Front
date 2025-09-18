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

/* ✅ NUEVO: /lote-producto por id_producto
   - Retorna los registros de lote-producto filtrados por producto
   - Usa el mismo api + token de arriba (sin crear otro service)
*/
export const getLotesProductoByProducto = async id_producto => {
  if (!id_producto) return []
  const token = getAuthToken()
  const { data } = await api.get('/lote-producto', {
    params: { id_producto },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return Array.isArray(data) ? data : []
}

// ✅ Inventario resumen (producto+lote con PU ya resuelto en el backend)
export const getInventarioResumen = async () => {
  const token = localStorage.getItem('token')
  const response = await api.get('/inventario/resumen', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}
