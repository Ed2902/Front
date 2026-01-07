import axios from 'axios'

// Instancia base de Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

const getAuthToken = () => localStorage.getItem('token')

// -----------------------------
// LOTE PRODUCTO (acordeón)
// -----------------------------
export const getLotes = async () => {
  const token = getAuthToken()
  const response = await api.get('/lote-producto', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const createLoteProducto = async loteData => {
  const token = getAuthToken()
  const response = await api.post('/lote-producto', loteData, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const updateLoteProducto = async (id, loteData) => {
  const token = getAuthToken()
  const response = await api.put(`/lote-producto/${id}`, loteData, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// -----------------------------
// LOTE (para select y creación)
// -----------------------------
export const getLotesDisponibles = async () => {
  const token = getAuthToken()
  const response = await api.get('/lote', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const createLote = async loteData => {
  const token = getAuthToken()
  const response = await api.post('/lote', loteData, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// -----------------------------
// PRODUCTOS (para el select)
// -----------------------------
export const getProductosDisponibles = async () => {
  const token = getAuthToken()
  const response = await api.get('/producto', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// -----------------------------
// ✅ CLIENTES (para formularios)
// -----------------------------
export const getClientesDisponibles = async () => {
  const token = getAuthToken()
  const response = await api.get('/cliente', {
    headers: { Authorization: `Bearer ${token}` },
  })

  // ✅ Tu backend devuelve { data: [...], meta: {...} }
  return Array.isArray(response.data?.data) ? response.data.data : []
}

// -----------------------------
// ✅ PROVEEDORES (para formularios)
// -----------------------------
export const getProveedoresDisponibles = async () => {
  const token = getAuthToken()
  const response = await api.get('/proveedor', {
    headers: { Authorization: `Bearer ${token}` },
  })

  // ✅ Si backend devuelve { data: [...], meta: {...} } lo manejamos
  if (Array.isArray(response.data?.data)) return response.data.data

  // ✅ Si devuelve array directo (por si acaso)
  if (Array.isArray(response.data)) return response.data

  return []
}

// -----------------------------
// INVENTARIO (resumen general)
// -----------------------------
export const getInventarioResumen = async () => {
  const token = getAuthToken()
  const response = await api.get('/inventario/resumen', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}
