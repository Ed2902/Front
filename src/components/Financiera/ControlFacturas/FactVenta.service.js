import axios from 'axios'

const API_URL_4 = import.meta.env.VITE_API_URL_4

const buildHeaders = (token, isFormData = false) => {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'
  return headers
}

/* =========================
   FACT VENTA (CRUD)
========================= */

// POST /Financiera/fact-venta
export const crearFactVenta = async (formData, token) => {
  const { data } = await axios.post(
    `${API_URL_4}/Financiera/fact-venta`,
    formData,
    { headers: buildHeaders(token, true) }
  )
  return data
}

// GET /Financiera/fact-venta
export const listarFactVenta = async ({ page = 1, limit = 50 } = {}, token) => {
  const { data } = await axios.get(`${API_URL_4}/Financiera/fact-venta`, {
    headers: buildHeaders(token),
    params: { page, limit },
  })
  return data
}

// GET /Financiera/fact-venta/:id
export const getFactVentaById = async (id, token) => {
  const { data } = await axios.get(`${API_URL_4}/Financiera/fact-venta/${id}`, {
    headers: buildHeaders(token),
  })
  return data
}

// PUT /Financiera/fact-venta/:id
export const actualizarFactVenta = async (id, formData, token) => {
  const { data } = await axios.put(
    `${API_URL_4}/Financiera/fact-venta/${id}`,
    formData,
    { headers: buildHeaders(token, true) }
  )
  return data
}

// DELETE /Financiera/fact-venta/:id
export const eliminarFactVenta = async (id, token) => {
  const { data } = await axios.delete(
    `${API_URL_4}/Financiera/fact-venta/${id}`,
    { headers: buildHeaders(token) }
  )
  return data
}

/* =========================
   PAPELERA
========================= */

// GET /Financiera/fact-venta/trash
export const listarFactVentaTrash = async token => {
  const { data } = await axios.get(`${API_URL_4}/Financiera/fact-venta/trash`, {
    headers: buildHeaders(token),
  })
  return data
}

// PATCH /Financiera/fact-venta/:id/restore
export const restaurarFactVenta = async (id, token) => {
  const { data } = await axios.patch(
    `${API_URL_4}/Financiera/fact-venta/${id}/restore`,
    {}, // ⚠️ nunca null
    { headers: buildHeaders(token) }
  )
  return data
}

/* =========================
   ABONOS
========================= */

// PUT /Financiera/fact-venta/:id/abonos
export const actualizarAbonosFactVenta = async (id, abonosArray, token) => {
  const payload = { abonos: abonosArray }
  const { data } = await axios.put(
    `${API_URL_4}/Financiera/fact-venta/${id}/abonos`,
    payload,
    { headers: buildHeaders(token) }
  )
  return data
}

// POST /Financiera/fact-venta/:id/abonos/:abonoIndex/soportes
export const subirSoportesAbonoVenta = async (
  id,
  abonoIndex,
  formData,
  token
) => {
  const { data } = await axios.post(
    `${API_URL_4}/Financiera/fact-venta/${id}/abonos/${abonoIndex}/soportes`,
    formData,
    { headers: buildHeaders(token, true) }
  )
  return data
}

/* =========================
   SOPORTES
========================= */

// DELETE /Financiera/fact-venta/:id/soportes
export const eliminarSoporteFactVenta = async (id, payload, token) => {
  const { data } = await axios.delete(
    `${API_URL_4}/Financiera/fact-venta/${id}/soportes`,
    {
      headers: buildHeaders(token),
      data: payload,
    }
  )
  return data
}

// PATCH /Financiera/fact-venta/:id/soportes/restore
export const restaurarSoporteFactVenta = async (id, payload, token) => {
  const { data } = await axios.patch(
    `${API_URL_4}/Financiera/fact-venta/${id}/soportes/restore`,
    payload,
    { headers: buildHeaders(token) }
  )
  return data
}
