import axios from 'axios'

// Instancia base (JSON)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

const getAuthToken = () => localStorage.getItem('token')

const authHeaders = (extra = {}) => ({
  ...extra,
  Authorization: `Bearer ${getAuthToken()}`,
})

export { getAuthToken }

// ✅ GET paginado: /proveedor?page&limit (máx 100)
export const getProveedores = async ({ page = 1, limit = 20 } = {}) => {
  const response = await api.get('/proveedor', {
    headers: authHeaders(),
    params: { page, limit },
  })
  return response.data // { data, meta }
}

// ✅ GET por ID: /proveedor/:id
export const getProveedorById = async id => {
  const response = await api.get(`/proveedor/${id}`, {
    headers: authHeaders(),
  })
  return response.data
}

// ✅ GET documentos físicos (lista): /proveedor/:id/documentos
export const getDocumentosProveedor = async id => {
  const response = await api.get(`/proveedor/${id}/documentos`, {
    headers: authHeaders(),
  })
  // backend: { archivos: [...] }
  return response.data.archivos || []
}

// ✅ POST crear (multipart): /proveedor
export const crearProveedor = async formData => {
  const response = await axios.post(
    `${import.meta.env.VITE_API_URL}/proveedor`,
    formData,
    {
      headers: authHeaders({ 'Content-Type': 'multipart/form-data' }),
    }
  )
  return response.data
}

// ✅ PUT actualizar datos (JSON): /proveedor/:id
export const actualizarProveedorDatos = async (id, payload) => {
  const response = await api.put(`/proveedor/${id}`, payload, {
    headers: authHeaders(),
  })
  return response.data
}

// ✅ PATCH activo: /proveedor/:id/activo
export const actualizarProveedorActivo = async (id, Activo) => {
  const response = await api.patch(
    `/proveedor/${id}/activo`,
    { Activo },
    { headers: authHeaders() }
  )
  return response.data
}

// ✅ PUT solo documentos (multipart): /proveedor/:id/documentos
// (Si aún no lo tienes en backend, no lo uses por ahora)
export const actualizarSoloDocumentosProveedor = async (id, formData) => {
  const response = await axios.put(
    `${import.meta.env.VITE_API_URL}/proveedor/${id}/documentos`,
    formData,
    {
      headers: authHeaders({ 'Content-Type': 'multipart/form-data' }),
    }
  )
  return response.data
}

// ✅ DELETE documento campo: /proveedor/:id/documentos/:campo
// (Si aún no lo tienes en backend, no lo uses por ahora)
export const eliminarDocumentoProveedor = async (id, campo) => {
  const response = await api.delete(`/proveedor/${id}/documentos/${campo}`, {
    headers: authHeaders(),
  })
  return response.data
}
