import axios from 'axios'

const API_PERSONAL = import.meta.env.VITE_API_URL || ''
const API_CHAT = import.meta.env.VITE_API_URL_5 || ''

const normalizeBase = base => String(base || '').replace(/\/+$/, '')

const buildFilesOriginFromApi = apiBase => {
  let b = normalizeBase(apiBase)
  b = b.replace(/\/tikets\/?$/i, '')
  b = b.replace(/\/api\/?$/i, '')
  return b
}

export const PERSONAL_ORIGIN = buildFilesOriginFromApi(API_PERSONAL)
export const CHAT_ORIGIN = buildFilesOriginFromApi(API_CHAT)

// ✅ Socket se conecta al backend de chat (4000)
export const FILES_ORIGIN = CHAT_ORIGIN

export const http = token =>
  axios.create({
    headers: { Authorization: `Bearer ${token}` },
  })

const clampPage = page => Math.max(1, Number(page) || 1)
const clampLimit100 = limit => Math.min(Math.max(1, Number(limit) || 100), 100)

export const isAbsoluteUrl = u => /^https?:\/\//i.test(String(u || ''))

export const buildAbsoluteFromOrigin = (origin, ruta) => {
  const r = String(ruta || '').trim()
  if (!r) return ''
  if (isAbsoluteUrl(r)) return r
  const o = normalizeBase(origin)
  const rr = r.startsWith('/') ? r : `/${r}`
  return `${o}${rr}`
}

// ✅ Decide de qué API es el archivo según la ruta
export const resolveFileOrigin = rutaOrUrl => {
  const r0 = String(rutaOrUrl || '').trim()
  if (!r0) return CHAT_ORIGIN
  if (isAbsoluteUrl(r0)) {
    // si ya es absoluta, tomamos su origin real
    try {
      return new URL(r0).origin
    } catch {
      return CHAT_ORIGIN
    }
  }

  const r = r0.startsWith('/') ? r0 : `/${r0}`

  // personal uploads
  if (r.startsWith('/uploads/personal/') || r.startsWith('/uploads/persona/')) {
    return PERSONAL_ORIGIN
  }

  // chat uploads
  if (r.startsWith('/uploads/')) return CHAT_ORIGIN

  return CHAT_ORIGIN
}

// ✅ URL absoluta final para attachments/links
export const buildAbsoluteUrl = rutaOrUrl => {
  const r0 = String(rutaOrUrl || '').trim()
  if (!r0) return ''
  if (isAbsoluteUrl(r0)) return r0

  const origin = resolveFileOrigin(r0)
  return buildAbsoluteFromOrigin(origin, r0)
}

// ✅ Fotos SIEMPRE desde personal API
export function buildPhotoUrl(ruta_foto) {
  const r = String(ruta_foto || '').trim()
  if (!r) return ''
  if (isAbsoluteUrl(r)) return r

  if (r.startsWith('/uploads/'))
    return buildAbsoluteFromOrigin(PERSONAL_ORIGIN, r)
  if (r.startsWith('uploads/'))
    return buildAbsoluteFromOrigin(PERSONAL_ORIGIN, `/${r}`)

  return buildAbsoluteFromOrigin(
    PERSONAL_ORIGIN,
    `/uploads/${r.replace(/^\/+/, '')}`
  )
}

// ===============================
// API calls
// ===============================
export async function fetchPersonas({ token }) {
  const { data } = await http(token).get(
    `${normalizeBase(API_PERSONAL)}/personal`
  )
  return data || []
}

export async function fetchChats({
  token,
  id_personal,
  page = 1,
  limit = 100,
  contextType,
  search,
}) {
  const params = {
    id_personal: String(id_personal),
    page: clampPage(page),
    limit: clampLimit100(limit), // ✅ max 100
  }
  if (contextType) params.contextType = contextType
  if (search) params.search = search

  const { data } = await http(token).get(`${normalizeBase(API_CHAT)}/chats`, {
    params,
  })
  return data
}

export async function createFreeChat({
  token,
  id_personal,
  title = '',
  participants,
}) {
  const { data } = await http(token).post(`${normalizeBase(API_CHAT)}/chats`, {
    id_personal: String(id_personal),
    title,
    participants,
  })
  return data?.chat || data?.item || data?.conversation || data
}

export async function fetchMessages({
  token,
  chatId,
  id_personal,
  page = 1,
  limit = 50,
}) {
  const params = {
    id_personal: String(id_personal),
    page: clampPage(page),
    limit: clampLimit100(limit),
  }
  const { data } = await http(token).get(
    `${normalizeBase(API_CHAT)}/chats/${chatId}/messages`,
    { params }
  )
  return data
}

export async function sendMessage({
  token,
  chatId,
  id_personal,
  text = '',
  attachments = [],
}) {
  const { data } = await http(token).post(
    `${normalizeBase(API_CHAT)}/chats/${chatId}/messages`,
    {
      id_personal: String(id_personal),
      text,
      attachments,
    }
  )
  return data?.message || data?.item || data
}

export async function markRead({ token, chatId, id_personal, at }) {
  const payload = { id_personal: String(id_personal) }
  if (at) payload.at = at
  const { data } = await http(token).patch(
    `${normalizeBase(API_CHAT)}/chats/${chatId}/read`,
    payload
  )
  return data
}

export async function uploadChatFiles({ token, chatId, id_personal, files }) {
  const form = new FormData()
  form.append('id_personal', String(id_personal))
  for (const f of files || []) form.append('files', f)

  const { data } = await axios.post(
    `${normalizeBase(API_CHAT)}/chats/${chatId}/attachments`,
    form,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  return data?.files || []
}

export function buildPersonaMap(personasArray) {
  const map = new Map()
  for (const p of personasArray || []) {
    const id = String(p?.Id_personal || '').trim()
    if (!id) continue
    map.set(id, p)
  }
  return map
}

export function getChatDisplay({ chat, myId, personaMap }) {
  const participants = chat?.participants || []
  const isDM = participants.length === 2
  const title = String(chat?.title || '').trim()

  if (chat?.contextType === 'ticket')
    return {
      name: title || 'Chat de Ticket',
      ruta_foto: null,
      subtitle: 'Ticket',
    }
  if (title) return { name: title, ruta_foto: null, subtitle: 'Grupo' }

  if (isDM) {
    const otherId = participants.find(p => String(p) !== String(myId))
    const other = personaMap?.get(String(otherId))
    const name = other
      ? `${other.Nombre || ''} ${other.Apellido || ''}`.trim()
      : `Usuario ${otherId || ''}`.trim()
    const subtitle = other?.Cargo || other?.Area || ''
    return { name, ruta_foto: other?.ruta_foto || null, subtitle }
  }

  return {
    name: 'Chat',
    ruta_foto: null,
    subtitle: `${participants.length} personas`,
  }
}

export function formatRelativeDate(isoOrDate) {
  if (!isoOrDate) return ''
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
