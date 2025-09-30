import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

// Token desde localStorage
const getAuthToken = () => localStorage.getItem('token')

// GET - Detalle completo de inventario por lote y producto
export const getInventarioPorLoteYProducto = async (id_lote, id_producto) => {
  const token = getAuthToken()
  const response = await api.get('/inventario/detalle/completo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = response.data
  // Filtrar el inventario que coincida con el lote y producto seleccionados
  return data.find(
    item =>
      item.LoteProducto?.id_lote === id_lote &&
      item.Producto?.Id_producto === id_producto
  )
}

export const getOperaciones = async () => {
  const token = getAuthToken()
  const response = await api.get('/operacion', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// GET - Lotes producto
export const getLoteProducto = async () => {
  const token = getAuthToken()
  const response = await api.get('/lote-producto', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// GET - Bodegas
export const getBodegas = async () => {
  const token = getAuthToken()
  const response = await api.get('/bodega', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// GET - Ubicaciones
export const getUbicaciones = async () => {
  const token = getAuthToken()
  const response = await api.get('/ubicacion', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// POST - Registrar salida (con FormData)
export const crearSalida = async formData => {
  const token = getAuthToken()
  const response = await api.post('/historial/salida', formData, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// ===== Documentos de Salida (PDF resumen de salidas masivas) =====
// IMPORTANTE: estos endpoints NO alteran inventario ni historial;
// solo generan/listan/obtienen/descargan el documento PDF “resumen”.

export const crearDocumentoSalida = async payload => {
  // payload: { lotes: [...], productos: [...], items: [...], comentarios, firmas, ... }
  const token = getAuthToken()
  const response = await api.post('/documentos-salida', payload, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const listarDocumentosSalida = async (params = {}) => {
  // params opcionales: { desde, hasta, creado_por, limit, offset }
  const token = getAuthToken()
  const response = await api.get('/documentos-salida', {
    headers: { Authorization: `Bearer ${token}` },
    params,
  })
  return response.data
}

export const obtenerDocumentoSalida = async id_documento => {
  const token = getAuthToken()
  const response = await api.get(`/documentos-salida/${id_documento}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const descargarDocumentoSalida = async id_documento => {
  // Devuelve un Blob del PDF. En el front puedes crear un ObjectURL y forzar descarga.
  const token = getAuthToken()
  const response = await api.get(
    `/documentos-salida/${id_documento}/download`,
    {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob',
    }
  )
  return response.data // Blob
}
