// src/services/RegistrarUsuario_service.js
import axios from 'axios'

// Instancia base (sin token)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL_2,
})

// 👉 1) Crear personal (JSON)
export const crearPersonal = async payload => {
  // Asegurar que horas_semana vaya como número
  const body = {
    ...payload,
    horas_semana:
      payload?.horas_semana !== undefined
        ? Number(payload.horas_semana)
        : undefined,
  }

  const resp = await api.post('/app/personal', body, {
    headers: { 'Content-Type': 'application/json' },
  })
  return resp.data // { id, documento, nombres, ... }
}

// 👉 2) Subir 5 fotos (FormData)
//    - personalId: number | string (id devuelto por crearPersonal)
//    - files: File[] (exactamente 5)
//    - onProgress: (porcentaje 0-100) => void (opcional)
export const subirFotosPersonal = async (personalId, files, onProgress) => {
  const formData = new FormData()
  formData.append('personal_id', String(personalId))

  // Repetir la clave 'files' por cada imagen (como en tu screenshot)
  files.forEach(file => {
    formData.append('files', file)
  })

  const resp = await api.post('/app/vectores/from-images', formData, {
    // Deja que Axios ponga el boundary correcto para multipart
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // ~120s por si tarda ~19.45s
    onUploadProgress: evt => {
      if (onProgress && evt.total) {
        const porcentaje = Math.round((evt.loaded * 100) / evt.total)
        onProgress(porcentaje)
      }
    },
  })

  return resp.data
}
