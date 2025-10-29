// src/components/ControlIngresos/RegistrarUsuario/RegistrarUsuario_service.js
import axios from 'axios'

let api = axios.create({
  baseURL: import.meta.env.VITE_API_URL_2 || 'http://localhost:8000',
})

/** Permite inyectar una instancia de axios (con Authorization/X-API-Key) desde el AuthContext */
export const setApi = instance => {
  api = instance || api
}

/** Crear personal (JSON) */
export const crearPersonal = async payload => {
  // ⚠️ Reemplaza horas_semana por horarios (ya lo manejas en el componente)
  const body = {
    documento: String(payload.documento || '').trim(),
    nombres: payload.nombres ?? '',
    apellidos: payload.apellidos ?? '',
    email: payload.email ?? '',
    telefono: payload.telefono ?? '',
    estado: payload.estado ?? 'inactivo',
    horario_int: payload.horario_int ?? '', // "HH:MM"
    horario_off: payload.horario_off ?? '', // "HH:MM"
  }

  const resp = await api.post('/app/personal', body, {
    headers: { 'Content-Type': 'application/json' },
  })
  return resp.data // { id, documento, ... }
}

/**
 * Buscar personal por documento.
 * Si el backend devuelve un ARRAY, filtramos por coincidencia EXACTA de documento (string).
 * Si devuelve un OBJETO, validamos también que coincida el documento.
 */
export const verPersonalPorDocumento = async documento => {
  const doc = String(documento ?? '').trim()
  if (!doc) return null

  const resp = await api.get('/app/personal', {
    params: { documento: doc },
    // por si el backend ignora params, no cachear
    headers: { 'Cache-Control': 'no-cache' },
  })
  const data = resp.data

  // Caso: backend retorna un ARRAY (lista completa o filtrada)
  if (Array.isArray(data)) {
    // buscamos coincidencia exacta, normalizando a string
    const match = data.find(p => String(p?.documento ?? '').trim() === doc)
    return match || null
  }

  // Caso: backend retorna un OBJETO único
  if (data && typeof data === 'object') {
    const foundDoc = String(data?.documento ?? '').trim()
    if (foundDoc === doc) return data
    // si no coincide, considera que no hay resultado
    return null
  }

  return null
}

/** Ver personal por ID */
export const verPersonalPorId = async id => {
  const resp = await api.get(`/app/personal/${id}`)
  return resp.data
}

/** Ver vectores de un personal */
export const verVectoresPorPersonal = async personalId => {
  const resp = await api.get(`/app/vectores/${personalId}`)
  return resp.data // { id_personal, vector1..vector5, ... }
}

/** Subir 1..5 fotos (crea o reemplaza por POST) */
export const subirFotosPersonal = async (personalId, files, onProgress) => {
  const formData = new FormData()
  formData.append('personal_id', String(personalId))
  files.forEach(file => formData.append('files', file))

  const resp = await api.post('/app/vectores/from-images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    onUploadProgress: evt => {
      if (onProgress && evt.total) {
        const porcentaje = Math.round((evt.loaded * 100) / evt.total)
        onProgress(porcentaje)
      }
    },
  })
  return resp.data
}

/** Actualizar (reemplazar) 1..5 fotos (PUT) */
export const actualizarFotosPersonal = async (
  personalId,
  files,
  onProgress
) => {
  const formData = new FormData()
  formData.append('personal_id', String(personalId))
  files.forEach(file => formData.append('files', file))

  const resp = await api.put('/app/vectores/from-images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    onUploadProgress: evt => {
      if (onProgress && evt.total) {
        const porcentaje = Math.round((evt.loaded * 100) / evt.total)
        onProgress(porcentaje)
      }
    },
  })
  return resp.data
}
