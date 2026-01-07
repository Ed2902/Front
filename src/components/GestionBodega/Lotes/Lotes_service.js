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
  return localStorage.getItem('token')
}

// -----------------------------
// LOTE PRODUCTO (acordeón)
// -----------------------------

// 🚀 Obtener todos los lotes-producto (agrupados por id_lote)
export const getLotes = async () => {
  const token = getAuthToken()
  const response = await api.get('/lote-producto', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 🚀 Crear nuevo lote-producto
export const createLoteProducto = async loteData => {
  const token = getAuthToken()
  const response = await api.post('/lote-producto', loteData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 🚀 Editar lote-producto
export const updateLoteProducto = async (id, loteData) => {
  const token = getAuthToken()
  const response = await api.put(`/lote-producto/${id}`, loteData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// -----------------------------
// LOTE (para select y creación)
// -----------------------------

// ✅ GET /lote - obtener lotes para el select
export const getLotesDisponibles = async () => {
  const token = getAuthToken()
  const response = await api.get('/lote', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// ✅ POST /lote - crear un nuevo lote
export const createLote = async loteData => {
  const token = getAuthToken()
  const response = await api.post('/lote', loteData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// -----------------------------
// PRODUCTOS (para el select)
// -----------------------------

// ✅ GET /producto - obtener productos para el select
export const getProductosDisponibles = async () => {
  const token = getAuthToken()
  const response = await api.get('/producto', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// -----------------------------
// CLIENTES (para los formularios)
// -----------------------------

// ✅ GET /cliente - obtener lista de clientes
export const getClientesDisponibles = async () => {
  const token = getAuthToken()
  const response = await api.get('/cliente', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  // ✅ el backend devuelve {data: [...], meta: {...}}
  return response.data?.data || []
}

// -----------------------------
// PROVEEDORES (para los formularios)
// -----------------------------

// ✅ GET /proveedor - obtener lista de proveedores
export const getProveedoresDisponibles = async () => {
  const token = getAuthToken()
  const response = await api.get('/proveedor', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  // ✅ por seguridad lo mismo (si backend devuelve {data, meta})
  return response.data?.data || response.data || []
}

// -----------------------------
// INVENTARIO (resumen general)
// -----------------------------

export const getInventarioResumen = async () => {
  const token = localStorage.getItem('token')
  const response = await api.get('/inventario/resumen', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}
