import axios from 'axios'

// Instancia base (JSON)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token desde localStorage
const getAuthToken = () => localStorage.getItem('token')

const authHeaders = (extra = {}) => ({
  ...extra,
  Authorization: `Bearer ${getAuthToken()}`,
})

// ✅ Exporta también el token para uso en componentes
export { getAuthToken }

/**
 * 🚀 Obtener clientes (PAGINADO)
 * Backend devuelve: { data: [], meta: { page, limit, total, totalPages } }
 */
export const getClientes = async ({ page = 1, limit = 20 } = {}) => {
  const response = await api.get('/cliente', {
    headers: authHeaders(),
    params: { page, limit },
  })
  return response.data
}

// 🚀 Obtener un cliente por ID
export const getClienteById = async idCliente => {
  const response = await api.get(`/cliente/${idCliente}`, {
    headers: authHeaders(),
  })
  return response.data
}

// 🚀 Obtener documentos subidos de un cliente (archivos individuales)
export const getDocumentosCliente = async idCliente => {
  const response = await api.get(`/cliente/${idCliente}/documentos`, {
    headers: authHeaders(),
  })
  return response.data.archivos
}

// 📄 Abrir documento protegido (PDF en nueva pestaña / descarga)
export const abrirDocumentoCliente = async (
  rutaRelativa,
  token = getAuthToken()
) => {
  const baseURL = window.location.origin
  const url = `${baseURL}${rutaRelativa}`

  const response = await axios.get(url, {
    responseType: 'blob',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/pdf',
  })

  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, '_blank')
}

/**
 * 🚀 Crear nuevo cliente con documentos (FormData)
 * POST /cliente
 */
export const crearCliente = async formData => {
  const response = await axios.post(
    `${import.meta.env.VITE_API_URL}/cliente`,
    formData,
    {
      headers: authHeaders({
        'Content-Type': 'multipart/form-data',
      }),
    }
  )
  return response.data
}

/**
 * ✅ Actualizar datos (JSON)
 * PUT /cliente/:id
 */
export const actualizarClienteDatos = async (idCliente, payload) => {
  const response = await api.put(`/cliente/${idCliente}`, payload, {
    headers: authHeaders(),
  })
  return response.data
}

/**
 * ✅ Activar / desactivar
 * PATCH /cliente/:id/activo
 */
export const actualizarClienteActivo = async (idCliente, Activo) => {
  const response = await api.patch(
    `/cliente/${idCliente}/activo`,
    { Activo },
    { headers: authHeaders() }
  )
  return response.data
}

/**
 * ✅ Actualizar observaciones
 * PATCH /cliente/:id/observaciones
 */
export const actualizarClienteObservaciones = async (
  idCliente,
  Observaciones
) => {
  const response = await api.patch(
    `/cliente/${idCliente}/observaciones`,
    { Observaciones },
    { headers: authHeaders() }
  )
  return response.data
}

/**
 * ✅ Subir / reemplazar SOLO documentos
 * PUT /cliente/:id/documentos
 */
export const actualizarSoloDocumentosCliente = async (idCliente, formData) => {
  const response = await axios.put(
    `${import.meta.env.VITE_API_URL}/cliente/${idCliente}/documentos`,
    formData,
    {
      headers: authHeaders({
        'Content-Type': 'multipart/form-data',
      }),
    }
  )
  return response.data
}

/**
 * ✅ Eliminar un documento por campo
 * DELETE /cliente/:id/documentos/:campo
 */
export const eliminarDocumentoCliente = async (idCliente, campo) => {
  const response = await api.delete(
    `/cliente/${idCliente}/documentos/${campo}`,
    {
      headers: authHeaders(),
    }
  )
  return response.data
}

/**
 * 🔁 Mantengo tu endpoint anterior (por si todavía lo usas)
 * PUT /cliente/:id/con-documentos
 */
export const actualizarClienteConDocumentos = async (idCliente, formData) => {
  const response = await axios.put(
    `${import.meta.env.VITE_API_URL}/cliente/${idCliente}/con-documentos`,
    formData,
    {
      headers: authHeaders({
        'Content-Type': 'multipart/form-data',
      }),
    }
  )
  return response.data
}
