import axios from 'axios'

// Instancia base de Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Función para obtener el token desde localStorage
const getAuthToken = () => {
  const token = localStorage.getItem('token') // Obtener el token desde localStorage
  if (!token) {
    console.error('Token no disponible') // Si no hay token, mostrar error
  }
  return token
}

export const getOperaciones = async () => {
  const token = getAuthToken()
  const response = await api.get('/operacion', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// 📊 Obtener historial completo (sin filtros)
export const getHistorialConLote = async () => {
  const token = getAuthToken()
  if (!token) {
    console.error('Token no disponible')
    throw new Error('Token no disponible')
  }

  try {
    const response = await api.get('/historial/con-lote', {
      headers: {
        Authorization: `Bearer ${token}`, // Enviar token en la cabecera Authorization
      },
    })
    return response.data
  } catch (error) {
    console.error('Error al obtener historial completo:', error.message)
    throw error
  }
}

// 📊 Obtener historial filtrado por id_lote e id_producto
export const getHistorialPorLoteYProducto = async (
  id_lote = '',
  id_producto = ''
) => {
  const token = getAuthToken()
  if (!token) {
    console.error('Token no disponible')
    throw new Error('Token no disponible')
  }

  try {
    const response = await api.get('/historial/con-lote', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        id_lote,
        id_producto,
      },
    })
    return response.data
  } catch (error) {
    console.error(
      'Error al obtener historial por lote y producto:',
      error.message
    )
    throw error
  }
}

// 📂 Obtener la URL de la evidencia (imagen o PDF)
export const getEvidenciaUrl = filename => {
  const token = getAuthToken()
  if (!token) {
    console.error('Token no disponible')
    throw new Error('Token no disponible')
  }

  return `${import.meta.env.VITE_API_URL}/historial/evidencia/${filename}` // URL para la imagen
}

// 📂 Obtener la URL del documento (PDF)
export const getDocumentoUrl = id_historial => {
  const token = getAuthToken()
  if (!token) {
    console.error('Token no disponible')
    throw new Error('Token no disponible')
  }
  return `${import.meta.env.VITE_API_URL}/historial/${id_historial}/pdf` // URL para el PDF
}
// 📦 Obtener archivo (imagen o PDF) como blob
export const fetchEvidenciaBlob = async nombreArchivo => {
  const token = getAuthToken()
  if (!token) {
    console.error('Token no disponible')
    throw new Error('Token no disponible')
  }

  try {
    const response = await api.get(`/evidencias/${nombreArchivo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: 'blob', // 👈 esto es clave para manejar archivos
    })

    // Crear URL temporal del blob
    const url = URL.createObjectURL(response.data)
    return url
  } catch (error) {
    console.error('Error al obtener evidencia:', error.message)
    throw error
  }
}
