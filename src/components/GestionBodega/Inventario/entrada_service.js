import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  // ❌ No pongas headers aquí
})

// Obtener token del localStorage
const getAuthToken = () => localStorage.getItem('token')

// GETs
export const getLoteProducto = async () => {
  const token = getAuthToken()
  const response = await api.get('/lote-producto', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}
export const getOperaciones = async () => {
  const token = getAuthToken()
  const response = await api.get('/operacion', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}
export const getBodegas = async () => {
  const token = getAuthToken()
  const response = await api.get('/bodega', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const getUbicaciones = async () => {
  const token = getAuthToken()
  const response = await api.get('/ubicacion', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// POST con FormData
export const crearEntrada = async data => {
  const token = getAuthToken()
  const response = await api.post('/historial', data, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const getInventarioPorLoteYProducto = async (id_lote, id_producto) => {
  const token = localStorage.getItem('token')
  const response = await fetch(
    `${
      import.meta.env.VITE_API_URL
    }/inventario/por-lote-producto?id_lote=${id_lote}&id_producto=${id_producto}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
  return await response.json()
}
