// src/components/GestionBodega/Lotes/formatoEquivalente.service.js
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

const getAuthToken = () => localStorage.getItem('token')

export const actualizarCamposNuevosLote = async (idLote, payload) => {
  const { data } = await api.patch(`/lote/${idLote}/campos-nuevos`, payload, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  })
  return data
}

export const generarPDFFormatoEquivalente = async idLote => {
  // Importante: no enviar `null` como body; omitimos el cuerpo (undefined)
  const { data } = await api.post(
    `/lote/${idLote}/formato-equivalente`,
    undefined,
    { headers: { Authorization: `Bearer ${getAuthToken()}` } }
  )
  return data // { message, pdfPath }
}

// Reutilizamos la ruta general de lote-producto para actualizar campos de precio
export const actualizarPrecioLoteProducto = async (idLoteProducto, payload) => {
  // Enviamos ambas variantes de nombres de campo por compatibilidad
  const body = {
    ...payload,
    valor_unitario: payload.valor_unitario ?? payload.ValorUnitario,
    ValorUnitario: payload.ValorUnitario ?? payload.valor_unitario,
  }
  const { data } = await api.put(`/lote-producto/${idLoteProducto}`, body, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  })
  return data
}
