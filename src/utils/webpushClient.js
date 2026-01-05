// src/utils/webpushClient.js (por ejemplo)
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registra / asegura la suscripción WebPush para un principal.
 *
 * - NO destruye la suscripción anterior.
 * - Reusa la existente si ya hay.
 * - Solo crea una nueva si no existe y el usuario dio permiso.
 */
export async function registerWebPush({
  axiosInstance,   // opción 1: axios
  headers = {},    // cabeceras extra (incluido Authorization)
  apiBaseUrl,      // opción 2: base URL para fetch
  orgId,
  principalId,
}) {
  try {
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Workers no soportados en este navegador');
      return;
    }
    if (!('PushManager' in window)) {
      console.warn('⚠️ PushManager no soportado en este navegador');
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      console.warn('⚠️ VITE_VAPID_PUBLIC_KEY no definida en el frontend');
      return;
    }
    if (!principalId) {
      console.warn('⚠️ registerWebPush sin principalId, no se puede guardar suscripción');
      return;
    }

    // 1) Obtener o registrar el Service Worker para /sw.js
    let registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
    }

    // 2) Revisar permiso de notificaciones
    let permission = Notification.permission; // 'default' | 'granted' | 'denied'

    if (permission === 'default') {
      // Solo pedimos una vez, no en cada vista
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.warn('⚠️ Permiso de notificaciones no concedido:', permission);
      return;
    }

    // 3) Ver si ya existe una suscripción
    let sub = await registration.pushManager.getSubscription();

    // 4) Si no existe, crear una nueva
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    if (!sub) {
      console.warn('⚠️ No se pudo obtener o crear la suscripción de push');
      return;
    }

    const body = {
      orgId,
      principalId,
      subscription: sub,
    };

    // Cabeceras mínimas para backend
    const baseHeaders = {
      'x-org-id': orgId,
      'x-principal-id': principalId,
      ...headers,
    };

    let status;
    let data;

    if (axiosInstance) {
      // MODO AXIOS
      const resp = await axiosInstance.post(
        '/notifications/subscriptions', // ajusta la ruta si tu backend es /tikets/notifications/...
        body,
        { headers: baseHeaders }
      );
      status = resp.status;
      data = resp.data;
    } else if (apiBaseUrl) {
      // MODO FETCH
      const resp = await fetch(`${apiBaseUrl}/notifications/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...baseHeaders,
        },
        body: JSON.stringify(body),
      });

      status = resp.status;
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        data = await resp.json();
      } else {
        data = { raw: await resp.text() };
      }
    } else {
      console.warn('❌ registerWebPush llamado sin axiosInstance ni apiBaseUrl');
      return;
    }

    console.log('📩 Respuesta backend WebPush:', status, data);

    if (status < 200 || status >= 300) {
      console.error('❌ Error guardando suscripción:', data);
    }
  } catch (err) {
    console.error('❌ Error en registerWebPush:', err);
  }
}

/**
 * Elimina / desactiva las suscripciones de un principal (p. ej. en logout).
 */
export async function unregisterWebPush({
  axiosInstance,
  headers = {},
  apiBaseUrl,
  orgId,
  principalId,
}) {
  try {
    if (!principalId) {
      console.warn('⚠️ unregisterWebPush sin principalId');
      return;
    }

    const baseHeaders = {
      'x-org-id': orgId,
      'x-principal-id': principalId,
      'Content-Type': 'application/json',
      ...headers,
    };

    const body = { orgId, principalId };

    let status;
    let data;

    if (axiosInstance) {
      const resp = await axiosInstance.delete('/notifications/subscriptions', {
        headers: baseHeaders,
        data: body,
      });
      status = resp.status;
      data = resp.data;
    } else if (apiBaseUrl) {
      const resp = await fetch(`${apiBaseUrl}/notifications/subscriptions`, {
        method: 'DELETE',
        headers: baseHeaders,
        body: JSON.stringify(body),
      });
      status = resp.status;
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        data = await resp.json();
      } else {
        data = { raw: await resp.text() };
      }
    } else {
      console.warn('❌ unregisterWebPush llamado sin axiosInstance ni apiBaseUrl');
      return;
    }

    console.log('🧹 Respuesta backend unregister WebPush:', status, data);
  } catch (err) {
    console.error('❌ Error en unregisterWebPush:', err);
  }
}
