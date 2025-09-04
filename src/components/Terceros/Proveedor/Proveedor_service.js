// src/services/Proveedor_service.js

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

// 🚀 Obtener todos los proveedores (con documentos incluidos)
export const getProveedores = async () => {
  const token = getAuthToken()
  const response = await api.get('/proveedor', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 🚀 Obtener un proveedor por ID
export const getProveedorById = async idProveedor => {
  const token = getAuthToken()
  const response = await api.get(`/proveedor/${idProveedor}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// 🚀 Obtener documentos subidos de un proveedor (archivos individuales)
export const getDocumentosProveedor = async idProveedor => {
  const token = getAuthToken()
  const response = await api.get(`/proveedor/${idProveedor}/documentos`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data.archivos
}

// 📄 Abrir documento en nueva pestaña (PDF o Word)
export const abrirDocumentoProveedor = async (
  rutaRelativa,
  token = getAuthToken()
) => {
  try {
    // 🌐 Usa el host actual sin `/api`
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
  } catch (error) {
    console.error('❌ Error al abrir el documento del proveedor:', error)
    throw error
  }
}

// ✅ Exporta también el token para uso en componentes
export { getAuthToken }

// 🚀 Crear nuevo proveedor con documentos (FormData)
export const crearProveedor = async formData => {
  const token = localStorage.getItem('token')
  const response = await axios.post(
    `${import.meta.env.VITE_API_URL}/proveedor`,
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
