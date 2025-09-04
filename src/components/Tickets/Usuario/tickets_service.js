// services/tickets_service.js
import axios from 'axios'

// -------------------------------------------------------------
// AXIOS INSTANCE
// -------------------------------------------------------------
const api = axios.create({
  // Si usas proxy en Vite, puedes apuntar a '/api' y evitas CORS en dev
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
})

// Helpers de auth
const getAuthToken = () => localStorage.getItem('token')

// Request interceptor: auth + content-type dinámico
api.interceptors.request.use(config => {
  // Auth
  const token = getAuthToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }

  // Content-Type dinámico (no romper FormData)
  const isForm =
    typeof FormData !== 'undefined' && config.data instanceof FormData
  if (isForm) {
    if (config.headers && config.headers['Content-Type']) {
      delete config.headers['Content-Type']
    }
  } else {
    config.headers = config.headers || {}
    if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json'
    }
  }

  return config
})

// -------------------------------------------------------------
// Utilidades
// -------------------------------------------------------------
const authHeaders = () => {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Log amable de FormData (debug)
const logFormData = form => {
  console.group('sendMessage → FormData que se envía')
  try {
    if (typeof form.forEach === 'function') {
      form.forEach((val, key) => {
        if (val instanceof Blob) {
          console.log(
            `${key}: [Blob] name="${val.name}" type="${val.type}" size=${val.size} bytes`
          )
        } else {
          console.log(`${key}:`, val)
        }
      })
    } else if (typeof form.entries === 'function') {
      for (const [key, val] of form.entries()) {
        if (val instanceof Blob) {
          console.log(
            `${key}: [Blob] name="${val.name}" type="${val.type}" size=${val.size} bytes`
          )
        } else {
          console.log(`${key}:`, val)
        }
      }
    } else {
      console.warn('No se puede iterar FormData en este entorno')
    }
  } catch (e) {
    console.warn('Error inspeccionando FormData:', e)
  }
  console.groupEnd()
}

// -------------------------------------------------------------
//  Tickets
// -------------------------------------------------------------
export const listTickets = async (params = {}) => {
  // params sugeridos: { page, size, estado, search, ... }
  const { data } = await api.get('/tikets', {
    headers: authHeaders(),
    params,
  })
  return data
}

export const createTicket = async payload => {
  const { data } = await api.post('/tikets', payload, {
    headers: authHeaders(),
  })
  return data
}

// PATCH /tikets/:id_tiket/estado  Body: { Estado, Id_personal }
export const changeTicketState = async (id_tiket, payload) => {
  const { data } = await api.patch(`/tikets/${id_tiket}/estado`, payload, {
    headers: authHeaders(),
  })
  return data
}

// Atajo por si prefieres pasar args directos
export const changeTicketEstado = async (id_tiket, Estado, Id_personal) => {
  const { data } = await api.patch(
    `/tikets/${id_tiket}/estado`,
    { Estado, Id_personal },
    { headers: authHeaders() }
  )
  return data
}

// PATCH /tikets/:id_tiket/asignar  Body: { Id_personal_soporte }
export const assignTicket = async (id_tiket, payload) => {
  const { data } = await api.patch(`/tikets/${id_tiket}/asignar`, payload, {
    headers: authHeaders(),
  })
  return data
}

export const getTicketAudit = async (id_tiket, params = {}) => {
  const { data } = await api.get('/ticket-audit', {
    headers: authHeaders(),
    params: { id_tiket, ...params },
  })
  return data
}

// -------------------------------------------------------------
//  Mensajes (chat)
// -------------------------------------------------------------
export const getMessages = async idTicket => {
  const resp = await api.get(`/mensajes/${idTicket}`, {
    headers: { ...authHeaders() },
  })
  return resp.data
}

export const sendMessage = async (
  idTicket,
  { Mensaje, Id_personal, files = [] },
  { onProgress } = {}
) => {
  const form = new FormData()
  form.append('Mensaje', Mensaje ?? '')
  if (Id_personal != null) form.append('Id_personal', String(Id_personal))
  ;(files || []).forEach((f, idx) => {
    const safeName = f?.name || `file_${idx}`
    form.append('files', f, safeName)
  })

  logFormData(form)

  const resp = await api.post(`/mensajes/${idTicket}`, form, {
    headers: { ...authHeaders() },
    onUploadProgress: e => {
      if (!onProgress) return
      const total = e?.total || 0
      if (total > 0) {
        const p = Math.round((e.loaded * 100) / total)
        onProgress(Math.min(100, Math.max(0, p)))
      }
    },
  })
  return resp.data
}

// Marca mensajes como vistos por IDs: payload = { messageIds: number[] }
export const markMessagesSeen = async payload => {
  const resp = await api.post(`/mensajes/seen`, payload, {
    headers: { ...authHeaders() },
  })
  return resp.data
}

// -------------------------------------------------------------
//  Personal
// -------------------------------------------------------------
export const listPersonal = async (params = {}) => {
  // params opcionales: { page, size, search, ... }
  const { data } = await api.get('/personal', {
    headers: authHeaders(),
    params,
  })
  return data
}

export const getPersonalById = async id_personal => {
  const { data } = await api.get(`/personal/${id_personal}`, {
    headers: authHeaders(),
  })
  return data
}
