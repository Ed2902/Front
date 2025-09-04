import axios from 'axios'

// Instancia base con URL del backend
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

// Función para obtener token desde localStorage
const getAuthToken = () => {
  const token = localStorage.getItem('token')
  return token
}

export const getOperaciones = async () => {
  const token = getAuthToken()
  const response = await api.get('/operacion', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}
// 🚀 Obtener vista enriquecida de transformaciones con filtro de permisos
export const getTransformaciones = async permisos => {
  const token = getAuthToken()

  try {
    // Obtener las transformaciones
    const transformacionesResponse = await api.get(
      '/transformacion-paso/vista',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    // Obtener los productos
    const productosResponse = await api.get('/producto', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const transformacionesData = transformacionesResponse.data
    const productosData = productosResponse.data

    // Filtrar las transformaciones en base al tipo de producto y permisos
    const filteredTransformaciones = transformacionesData.filter(item => {
      const producto = productosData.find(
        p => p.Id_producto === item.Id_producto
      )

      if (!producto) return false // Si no encontramos el producto, no lo mostramos

      // Filtramos según los permisos del usuario
      if (producto.Tipo === 'RS' && permisos?.verProductosRS) {
        return true
      }
      if (producto.Tipo === 'Bodega' && permisos?.verProductosBodega) {
        return true
      }
      return false
    })

    return filteredTransformaciones
  } catch (error) {
    console.error('Error al obtener transformaciones:', error.message)
    throw error
  }
}

// 📜 Obtener historial de transformaciones
export const getHistorialTransformaciones = async () => {
  const token = getAuthToken()

  try {
    const response = await api.get('/historial-transformacion', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error(
      'Error al obtener historial de transformaciones:',
      error.message
    )
    throw error
  }
}

// 🔐 Obtener URL protegida de evidencia (imagen)
export const getEvidenciaUrl = filename => {
  return `${import.meta.env.VITE_API_URL}/evidencias/${filename}`
}

// 🖼 Obtener blob autenticado para evidencias (modo seguro)
export const fetchEvidenciaBlob = async filename => {
  const token = getAuthToken()

  try {
    const response = await api.get(`/evidencias/${filename}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: 'blob',
    })
    return URL.createObjectURL(response.data)
  } catch (error) {
    console.error('Error al obtener blob de evidencia:', error.message)
    throw error
  }
}

// ✅ Registrar nueva transformación (POST con form-data)
export const registrarTransformacion = async formData => {
  const token = getAuthToken()

  try {
    const response = await api.post('/historial-transformacion', formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  } catch (error) {
    console.error('Error al registrar transformación:', error.message)
    throw error
  }
}

// 🧾 Obtener lote-producto (GET)
export const getLoteProducto = async () => {
  const token = getAuthToken()

  try {
    const response = await api.get('/lote-producto', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error('Error al obtener lote-producto:', error.message)
    throw error
  }
}

// 🧠 Obtener historial por lote y producto (GET con-lote)
export const getHistorialPorLote = async (id_lote, id_producto) => {
  const token = getAuthToken()

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

// 🏷 Obtener inventario detallado (GET) - Devuelve TODO el inventario
export const getInventarioDetalle = async () => {
  const token = getAuthToken()

  try {
    const response = await api.get('/inventario/detalle/completo', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error('Error al obtener inventario detallado:', error.message)
    throw error
  }
}

// 🚀 Obtener productos (nuevos datos)
export const getProductos = async () => {
  const token = getAuthToken()

  try {
    const response = await api.get('/producto', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error('Error al obtener productos:', error.message)
    throw error
  }
}

// Obtener lista de bodegas
export const getBodegas = async () => {
  const token = localStorage.getItem('token')
  try {
    const response = await api.get('/bodega', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.data
  } catch (error) {
    console.error('Error al obtener bodegas:', error.message)
    throw error
  }
}

// Obtener lista de ubicaciones
export const getUbicaciones = async () => {
  const token = localStorage.getItem('token')
  try {
    const response = await api.get('/ubicacion', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.data
  } catch (error) {
    console.error('Error al obtener ubicaciones:', error.message)
    throw error
  }
}

// 🎯 Obtener productos únicos desde inventario (para transformación destino)
export const getProductosDesdeInventario = async () => {
  const token = getAuthToken()

  try {
    const response = await api.get('/inventario/detalle/completo', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const inventario = response.data || []

    // Agrupar por Id_producto
    const productosUnicos = Object.values(
      inventario.reduce((acc, item) => {
        const id = item?.Producto?.Id_producto
        if (id && !acc[id]) {
          acc[id] = {
            Id_producto: id,
            Nombre: item?.Producto?.Nombre || id,
          }
        }
        return acc
      }, {})
    )

    return productosUnicos
  } catch (error) {
    console.error('Error al obtener productos desde inventario:', error.message)
    throw error
  }
}
