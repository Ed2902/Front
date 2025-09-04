import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  // No pongas headers aquí, se añaden dinámicamente
})

const getAuthToken = () => localStorage.getItem('token')

export const inventarioCompletoPorLoteYProducto = async (
  id_lote,
  id_producto
) => {
  const token = getAuthToken()
  const response = await api.get('/inventario/detalle/completo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = response.data

  // Corregido: comparar con Producto.Id_producto y LoteProducto.id_lote
  return data.find(
    item =>
      item.LoteProducto?.id_lote === id_lote &&
      item.Producto?.Id_producto === id_producto
  )
}

export const getOperaciones = async () => {
  const token = getAuthToken()
  const response = await api.get('/operacion', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// ✅ GET - Lotes Producto
export const getLoteProducto = async () => {
  const token = getAuthToken()
  const response = await api.get('/lote-producto', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// ✅ GET - Bodegas
export const getBodegas = async () => {
  const token = getAuthToken()
  const response = await api.get('/bodega', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// ✅ GET - Ubicaciones
export const getUbicaciones = async () => {
  const token = getAuthToken()
  const response = await api.get('/ubicacion', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// ✅ POST - Crear transformación (con FormData)
export const crearTransformacion = async data => {
  const token = getAuthToken()
  const response = await api.post('/historial/transformacion', data, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}
export const getInventarioPorLoteYProducto = async (id_lote, id_producto) => {
  const token = localStorage.getItem('token')
  const response = await api.get(
    `/inventario/por-lote-producto?id_lote=${id_lote}&id_producto=${id_producto}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
  return response.data
}
