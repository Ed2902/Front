// salida_service.js
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

/**
 * ✅ POST - Crear salida NUEVA (1 sola salida + muchos detalles)
 * IMPORTANTE:
 * - Back espera multipart/form-data
 * - campos: id_alistamiento, nombre, comentario, id_personal
 * - items: JSON.stringify([...])
 * - evidencias: N archivos (mismo orden que items)
 */
export const crearSalida = async formData => {
  const token = getAuthToken()
  const response = await api.post('/salidas', formData, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// ✅ RESUMEN DE INVENTARIO (para selects de lote/producto/posición)
export const getInventarioResumen = async () => {
  const token = localStorage.getItem('token')
  const resp = await api.get('/inventario/resumen', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return resp.data
}

/**
 * ⛔️ Ya NO se usa en el flujo actual (si ya eliminaron documentos-salida).
 * Lo dejo comentado para que no se rompa nada si aún existe en otros lugares.
 *
 * export const crearDocumentoSalida = async payload => {...}
 * export const listarDocumentosSalida = async (params={}) => {...}
 * export const obtenerDocumentoSalida = async id => {...}
 * export const descargarDocumentoSalida = async id => {...}
 */
