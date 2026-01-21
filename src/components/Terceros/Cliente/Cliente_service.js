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
 * ✅ PUT /cliente/:id/con-documentos
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

/**
 * ✅ NUEVO: actualiza datos y (si hay) documentos en UNA sola función
 * - Si hay docs -> usa /con-documentos (FormData)
 * - Si no hay docs -> usa /:id (JSON)
 *
 * payload: { Nombre, Correo, Celular, Direccion?, Linea_servicio?, Id_personal? }
 * formDataDocs: FormData con archivos (keys: rut, camara_comercio, ...)
 */
export const actualizarClienteAuto = async (
  idCliente,
  payload,
  formDataDocs
) => {
  const hasDocs =
    formDataDocs instanceof FormData &&
    typeof formDataDocs.entries === 'function' &&
    Array.from(formDataDocs.entries()).length > 0

  if (!hasDocs) {
    return await actualizarClienteDatos(idCliente, payload)
  }

  // construir FormData final (campos + archivos)
  const fd = new FormData()

  // campos de texto -> FormData
  Object.entries(payload || {}).forEach(([k, v]) => {
    // si es null/undefined no lo mandes
    if (v === undefined || v === null) return
    fd.append(k, String(v))
  })

  // archivos (ya vienen con key backend correcta)
  for (const [k, v] of formDataDocs.entries()) {
    fd.append(k, v)
  }

  return await actualizarClienteConDocumentos(idCliente, fd)
}

// ✅ Traer nombre del personal desde /personal
export const getNombrePersonal = async idPersonal => {
  if (!idPersonal) return ''
  const response = await api.get(`/personal/${idPersonal}`, {
    headers: authHeaders(),
  })

  const p = response.data
  const nombre = p?.Nombre || p?.nombre || ''
  const apellido = p?.Apellido || p?.apellido || ''
  const full = `${nombre} ${apellido}`.trim()
  return full || String(idPersonal)
}
