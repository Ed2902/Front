// src/services/FactCompra.service.js
import axios from 'axios'

const API_URL_4 = import.meta.env.VITE_API_URL_4

const buildHeaders = (token, isFormData = false) => {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  // Para FormData NO seteamos Content-Type (axios/browser pone el boundary)
  if (!isFormData) headers['Content-Type'] = 'application/json'
  return headers
}

/* =========================
   FACT COMPRA (CRUD)
========================= */

// POST (form-data) /Financiera/fact-compra
export const crearFactCompra = async (formData, token) => {
  const { data } = await axios.post(
    `${API_URL_4}/Financiera/fact-compra`,
    formData,
    { headers: buildHeaders(token, true) }
  )
  return data
}

// ✅ GET /Financiera/fact-compra?page=1&limit=10&estado=PAGADA&linea=Fastway
// - Sin filtros: paginado (10)
// - Con estado o linea: backend trae TODO (según tu regla)
// - Se pueden combinar estado + linea
export const listarFactCompra = async (
  { page = 1, limit = 10, estado, linea } = {},
  token
) => {
  const params = { page, limit }

  if (estado) params.estado = estado // puede venir "PAGADA" o "PAGADA,VENCIDA"
  if (linea) params.linea = linea // puede venir "Fastway" o "Fastway,Harvest"

  const { data } = await axios.get(`${API_URL_4}/Financiera/fact-compra`, {
    headers: buildHeaders(token),
    params,
  })
  return data
}

// GET /Financiera/fact-compra/:id
export const getFactCompraById = async (id, token) => {
  const { data } = await axios.get(
    `${API_URL_4}/Financiera/fact-compra/${id}`,
    { headers: buildHeaders(token) }
  )
  return data
}

// PUT (form-data) /Financiera/fact-compra/:id
export const actualizarFactCompra = async (id, formData, token) => {
  const { data } = await axios.put(
    `${API_URL_4}/Financiera/fact-compra/${id}`,
    formData,
    { headers: buildHeaders(token, true) }
  )
  return data
}

// DELETE /Financiera/fact-compra/:id
export const eliminarFactCompra = async (id, token) => {
  const { data } = await axios.delete(
    `${API_URL_4}/Financiera/fact-compra/${id}`,
    { headers: buildHeaders(token) }
  )
  return data
}

/* =========================
   PAPELERA
========================= */

// GET /Financiera/fact-compra/trash
export const listarFactCompraTrash = async token => {
  const { data } = await axios.get(
    `${API_URL_4}/Financiera/fact-compra/trash`,
    { headers: buildHeaders(token) }
  )
  return data
}

// PATCH /Financiera/fact-compra/:id/restore
export const restaurarFactCompra = async (id, token) => {
  const { data } = await axios.patch(
    `${API_URL_4}/Financiera/fact-compra/${id}/restore`,
    {}, // ✅ antes era null
    { headers: buildHeaders(token) }
  )
  return data
}

/* =========================
   ABONOS
========================= */

// PUT /Financiera/fact-compra/:id/abonos  (JSON)
export const actualizarAbonosFactCompra = async (id, abonosArray, token) => {
  const payload = { abonos: abonosArray }
  const { data } = await axios.put(
    `${API_URL_4}/Financiera/fact-compra/${id}/abonos`,
    payload,
    { headers: buildHeaders(token) }
  )
  return data
}

// POST (form-data) /Financiera/fact-compra/:id/abonos/:abonoIndex/soportes
export const subirSoportesAbono = async (id, abonoIndex, formData, token) => {
  const { data } = await axios.post(
    `${API_URL_4}/Financiera/fact-compra/${id}/abonos/${abonoIndex}/soportes`,
    formData,
    { headers: buildHeaders(token, true) }
  )
  return data
}

/* =========================
   SOPORTES (eliminar / restaurar)
========================= */

// DELETE /Financiera/fact-compra/:id/soportes  (body JSON)
export const eliminarSoporteFactCompra = async (id, payload, token) => {
  const { data } = await axios.delete(
    `${API_URL_4}/Financiera/fact-compra/${id}/soportes`,
    {
      headers: buildHeaders(token),
      data: payload, // axios delete con body
    }
  )
  return data
}

// PATCH /Financiera/fact-compra/:id/soportes/restore  (body JSON)
export const restaurarSoporteFactCompra = async (id, payload, token) => {
  const { data } = await axios.patch(
    `${API_URL_4}/Financiera/fact-compra/${id}/soportes/restore`,
    payload,
    { headers: buildHeaders(token) }
  )
  return data
}
