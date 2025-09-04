import axios from 'axios'

// Instancia base
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token desde localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// 🚀 Obtener todos los clientes (con DocumentoCliente incluido)
export const getClientes = async () => {
  const token = getAuthToken()
  const response = await api.get('/cliente', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 🚀 Obtener un cliente por ID
export const getClienteById = async idCliente => {
  const token = getAuthToken()
  const response = await api.get(`/cliente/${idCliente}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 🚀 Obtener documentos subidos de un cliente (archivos individuales)
export const getDocumentosCliente = async idCliente => {
  const token = getAuthToken()
  const response = await api.get(`/cliente/${idCliente}/documentos`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data.archivos
}

export const abrirDocumentoCliente = async (
  rutaRelativa,
  token = getAuthToken()
) => {
  try {
    // 🌐 Usa el host actual sin `/api`
    const baseURL = window.location.origin
    const url = `${baseURL}${rutaRelativa}` // ← NO usa import.meta.env.VITE_API_URL

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
  } catch (error) {
    console.error('❌ Error al abrir el documento:', error)
    throw error
  }
}
// ✅ Exporta también el token para uso en componentes
export { getAuthToken }

// 🚀 Crear nuevo cliente con documentos (FormData)
export const crearCliente = async formData => {
  const token = getAuthToken()
  const response = await axios.post(
    `${import.meta.env.VITE_API_URL}/cliente`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`,
      },
    }
  )
  return response.data
}

// 🚀 Actualizar cliente con documentos (FormData)
export const actualizarCliente = async (idCliente, formData) => {
  const token = getAuthToken()
  const response = await axios.put(
    `${import.meta.env.VITE_API_URL}/cliente/${idCliente}/con-documentos`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`,
      },
    }
  )
  return response.data
}
