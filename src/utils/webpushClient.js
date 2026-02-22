// src/utils/webpushClient.js
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function fetchJson(url, { method = 'GET', headers = {}, body } = {}) {
  const resp = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const ct = resp.headers.get('content-type') || ''
  const data = ct.includes('application/json')
    ? await resp.json()
    : await resp.text()

  return { ok: resp.ok, status: resp.status, data }
}

/**
 * Registra / asegura la suscripción WebPush para un usuario.
 *
 * Reglas:
 * - Reusa la suscripción existente si ya hay.
 * - Solo crea una nueva si no existe y el usuario dio permiso.
 * - Obtiene VAPID public key desde backend: GET /notifications/public-key
 * - Guarda la suscripción en backend: POST /notifications/subscribe
 *
 * apiBaseUrl debe incluir "/tikets" según tu setup:
 *   ej: http://localhost:4000/tikets
 */
export async function registerWebPush({
  axiosInstance, // opcional
  headers = {}, // aquí metes Authorization: Bearer ...
  apiBaseUrl, // ej: import.meta.env.VITE_API_URL_5
  principalId, // tu id_personal
}) {
  try {
    if (!('serviceWorker' in navigator)) {
      return { ok: false, reason: 'no_service_worker' }
    }
    if (!('PushManager' in window)) {
      return { ok: false, reason: 'no_push_manager' }
    }
    if (!principalId) {
      return { ok: false, reason: 'no_principalId' }
    }
    if (!axiosInstance && !apiBaseUrl) {
      return { ok: false, reason: 'no_transport' }
    }

    // 1) Asegurar SW en /sw.js (ubicado en public/sw.js)
    let registration = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js')
    }

    // 2) Permiso
    let permission = Notification.permission // 'default' | 'granted' | 'denied'
    if (permission === 'default') {
      permission = await Notification.requestPermission()
    }
    if (permission !== 'granted') {
      return { ok: false, reason: `permission_${permission}` }
    }

    // 3) Obtener VAPID public key desde backend
    let publicKeyResp
    if (axiosInstance) {
      const resp = await axiosInstance.get('/notifications/public-key', {
        headers,
      })
      publicKeyResp = {
        ok: resp.status >= 200 && resp.status < 300,
        status: resp.status,
        data: resp.data,
      }
    } else {
      publicKeyResp = await fetchJson(
        `${apiBaseUrl}/notifications/public-key`,
        { headers }
      )
    }

    const publicKey = publicKeyResp?.data?.publicKey
    if (!publicKey) {
      return { ok: false, reason: 'no_public_key', detail: publicKeyResp }
    }

    // 4) Reusar o crear suscripción
    let sub = await registration.pushManager.getSubscription()
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }
    if (!sub) {
      return { ok: false, reason: 'no_subscription' }
    }

    // 5) Guardar en backend
    const body = {
      id_personal: String(principalId),
      subscription: sub,
    }

    let saveResp
    if (axiosInstance) {
      const resp = await axiosInstance.post('/notifications/subscribe', body, {
        headers,
      })
      saveResp = {
        ok: resp.status >= 200 && resp.status < 300,
        status: resp.status,
        data: resp.data,
      }
    } else {
      saveResp = await fetchJson(`${apiBaseUrl}/notifications/subscribe`, {
        method: 'POST',
        headers,
        body,
      })
    }

    if (!saveResp.ok) {
      return { ok: false, reason: 'backend_subscribe_failed', detail: saveResp }
    }

    return { ok: true, subscription: sub, backend: saveResp.data }
  } catch (err) {
    return { ok: false, reason: 'exception', error: err }
  }
}

/**
 * Desactiva WebPush:
 * - unsubscribe en el navegador (si existe)
 * - notifica backend: POST /notifications/unsubscribe { id_personal, endpoint }
 */
export async function unregisterWebPush({
  axiosInstance,
  headers = {},
  apiBaseUrl,
  principalId,
}) {
  try {
    if (!principalId) {
      return { ok: false, reason: 'no_principalId' }
    }
    if (!axiosInstance && !apiBaseUrl) {
      return { ok: false, reason: 'no_transport' }
    }

    // 1) Obtener SW
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')

    // 2) Subscription actual
    const sub = registration
      ? await registration.pushManager.getSubscription()
      : null

    // 3) Avisar backend (si tenemos endpoint)
    if (sub?.endpoint) {
      const body = { id_personal: String(principalId), endpoint: sub.endpoint }

      let resp
      if (axiosInstance) {
        const r = await axiosInstance.post('/notifications/unsubscribe', body, {
          headers,
        })
        resp = {
          ok: r.status >= 200 && r.status < 300,
          status: r.status,
          data: r.data,
        }
      } else {
        resp = await fetchJson(`${apiBaseUrl}/notifications/unsubscribe`, {
          method: 'POST',
          headers,
          body,
        })
      }

      if (!resp.ok) {
        // no retornamos aún; igual intentamos unsubscribe local
      }
    }

    // 4) Unsubscribe local
    if (sub) {
      await sub.unsubscribe()
      return { ok: true }
    }

    return { ok: true, reason: 'no_local_subscription' }
  } catch (err) {
    return { ok: false, reason: 'exception', error: err }
  }
}
