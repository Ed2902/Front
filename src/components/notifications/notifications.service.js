// src/components/Notifications/notifications.service.js

const apiTicketsBase = () =>
  String(import.meta.env.VITE_API_URL_5 || '').replace(/\/+$/, '') // incluye /tikets

const apiPersonalBase = () =>
  String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '') // base general (sin /tikets)

async function httpJson(url, { method = 'GET', token, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => null)

  if (!res.ok || !data?.ok) {
    const msg =
      data?.error ||
      (Array.isArray(data?.errors) ? data.errors.join(' | ') : '') ||
      `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }

  return data
}

/**
 * GET /notifications?id_personal=...&page=...&limit=...&isRead=...
 */
export async function listNotifications({
  token,
  id_personal,
  page = 1,
  limit = 20,
  isRead,
} = {}) {
  const base = apiTicketsBase()
  const pid = String(id_personal || '').trim()
  if (!pid) throw new Error('id_personal es requerido')

  const sp = new URLSearchParams()
  sp.set('id_personal', pid)
  sp.set('page', String(page))
  sp.set('limit', String(limit))
  if (isRead !== undefined && isRead !== null) sp.set('isRead', String(isRead))

  return httpJson(`${base}/notifications?${sp.toString()}`, { token })
}

/**
 * GET /notifications/count?id_personal=...
 * (tu backend lo pide igual)
 */
export async function countNotifications({ token, id_personal } = {}) {
  const base = apiTicketsBase()
  const pid = String(id_personal || '').trim()
  if (!pid) throw new Error('id_personal es requerido')

  const sp = new URLSearchParams()
  sp.set('id_personal', pid)

  return httpJson(`${base}/notifications/count?${sp.toString()}`, { token })
}

/**
 * PATCH /notifications/:id/read
 * body: { id_personal }
 */
export async function markNotificationRead({
  token,
  notificationId,
  id_personal,
}) {
  const base = apiTicketsBase()
  return httpJson(`${base}/notifications/${notificationId}/read`, {
    method: 'PATCH',
    token,
    body: { id_personal: String(id_personal) },
  })
}

/**
 * PATCH /notifications/read-all
 * body: { id_personal }
 */
export async function markAllNotificationsRead({ token, id_personal }) {
  const base = apiTicketsBase()
  return httpJson(`${base}/notifications/read-all`, {
    method: 'PATCH',
    token,
    body: { id_personal: String(id_personal) },
  })
}

/**
 * Personal viene de VITE_API_URL + /personal/:id
 * Respuesta real: objeto directo con Nombre/Apellido
 */
export async function fetchPersonalById({ token, id }) {
  const base = apiPersonalBase()
  const pid = String(id || '').trim()
  if (!base || !pid) return null

  const res = await fetch(`${base}/personal/${encodeURIComponent(pid)}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!res.ok) return null
  const p = await res.json().catch(() => null)
  if (!p) return null
  return p
}
