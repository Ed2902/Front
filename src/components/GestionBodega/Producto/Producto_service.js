import axios from 'axios'

// Instancia base de Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Función auxiliar para obtener el token
const getAuthToken = () => {
  return localStorage.getItem('token') // <-- aquí obtienes el token correcto
}

// 🚀 Obtener todos los productos
export const getProductos = async () => {
  const token = getAuthToken()
  const response = await api.get('/producto', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 🚀 Obtener un producto por ID
export const getProductoById = async id => {
  const token = getAuthToken()
  const response = await api.get(`/producto/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 🚀 Crear un nuevo producto
export const createProducto = async productoData => {
  const token = getAuthToken()
  const response = await api.post('/producto', productoData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 🚀 Actualizar un producto existente
export const updateProducto = async (id, productoData) => {
  const token = getAuthToken()
  const response = await api.put(`/producto/${id}`, productoData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 🚀 Eliminar un producto
export const deleteProducto = async id => {
  const token = getAuthToken()
  const response = await api.delete(`/producto/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}
