import axios from 'axios'

// Instancia base de Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

// Obtener token desde localStorage
const getAuthToken = () => localStorage.getItem('token')

// GET - Inventario por Lote y Producto
export const getInventarioPorLoteYProducto = async (id_lote, id_producto) => {
  const token = getAuthToken()

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
// GET - Lote-Producto
export const getLoteProducto = async () => {
  const token = localStorage.getItem('token')
  const response = await api.get('/lote-producto', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}
