import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

const getAuthToken = () => localStorage.getItem('token')

// ===============================
// CATÁLOGOS (se mantienen)
// ===============================
export const getLoteProducto = async () => {
  const token = getAuthToken()
  const response = await api.get('/lote-producto', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const getBodegas = async () => {
  const token = getAuthToken()
  const response = await api.get('/bodega', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const getUbicaciones = async () => {
  const token = getAuthToken()
  const response = await api.get('/ubicacion', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const getProductos = async () => {
  const token = getAuthToken()
  const response = await api.get('/producto', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// ===============================
// ENTRADAS
// ===============================

// 1) Crear cabecera (BORRADOR) - JSON
export const crearEntradaCabecera = async payload => {
  const token = getAuthToken()
  const response = await api.post('/entradas', payload, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// 1b) Actualizar cabecera (BORRADOR) - JSON
export const actualizarEntradaCabecera = async (idEntrada, payload) => {
  const token = getAuthToken()
  const response = await api.put(`/entradas/${idEntrada}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// 2) Agregar detalles - JSON
export const agregarDetallesEntrada = async (idEntrada, detalles) => {
  const token = getAuthToken()
  const response = await api.post(
    `/entradas/${idEntrada}/detalles`,
    { detalles },
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return response.data
}

// 3) Subir foto por detalle - FormData field "foto"
export const subirFotoDetalleEntrada = async (idDetalle, file) => {
  const token = getAuthToken()
  const formData = new FormData()
  formData.append('foto', file)

  const response = await api.post(
    `/entradas/detalles/${idDetalle}/foto`,
    formData,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return response.data
}

// 4) Confirmar entrada (genera PDF si falta + crea movimientos + QRs)
export const confirmarEntrada = async idEntrada => {
  const token = getAuthToken()
  const response = await api.post(
    `/entradas/${idEntrada}/confirmar`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return response.data
}

// 5) Obtener 1 entrada (para editar/ver)
export const obtenerEntrada = async idEntrada => {
  const token = getAuthToken()
  const response = await api.get(`/entradas/${idEntrada}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// 6) Listar entradas (tabla)
// Soporta query params si tu back los implementa: estado, q, page, limit, desde, hasta
export const listarEntradas = async params => {
  const token = getAuthToken()
  const response = await api.get('/entradas', {
    params: params || {},
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// ===============================
// HELPERS (para NO duplicar)
// ===============================

// Guarda borrador completo: crea cabecera si no existe, agrega detalles, sube fotos.
// Devuelve { idEntrada, entrada, detallesCreados }
export const guardarBorradorCompleto = async ({
  idEntrada, // opcional
  cabeceraPayload,
  detallesPayload, // [{Id_producto, Id_lote, Cantidad, Comentario?}]
  fotosByProducto, // Map(Id_producto -> File)
}) => {
  // 1) crear o actualizar cabecera
  let entradaResp
  if (!idEntrada) {
    entradaResp = await crearEntradaCabecera(cabeceraPayload)
  } else {
    entradaResp = await actualizarEntradaCabecera(idEntrada, cabeceraPayload)
  }

  const entrada = entradaResp?.data || entradaResp
  const newId =
    entrada?.Id_entrada || entrada?.id_entrada || entrada?.Id || idEntrada

  if (!newId) throw new Error('No se obtuvo Id_entrada en guardarBorrador')

  // 2) crear detalles (en tu back actual, este endpoint CREA, no actualiza)
  const respDetalles = await agregarDetallesEntrada(newId, detallesPayload)
  const detallesCreados = respDetalles?.data || respDetalles || []

  // 3) subir fotos por detalle (por producto)
  const detallePorProducto = new Map()
  ;(detallesCreados || []).forEach(d => {
    detallePorProducto.set(d.Id_producto, d.Id_detalle)
  })

  for (const d of detallesPayload) {
    const idProd = d.Id_producto
    const file = fotosByProducto?.get?.(idProd)
    const idDet = detallePorProducto.get(idProd)
    if (file && idDet) {
      await subirFotoDetalleEntrada(idDet, file)
    }
  }

  return { idEntrada: newId, entrada, detallesCreados }
}

// Crear y confirmar (flujo DIRECTO) sin duplicar
export const crearYConfirmarCompleto = async args => {
  const saved = await guardarBorradorCompleto(args)
  const respConf = await confirmarEntrada(saved.idEntrada)
  return { ...saved, confirmacion: respConf?.data || respConf }
}
