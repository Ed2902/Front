self.addEventListener('install', () => {
  console.log('🛠 Service Worker instalado')
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  console.log('✅ Service Worker activado')
  event.waitUntil(self.clients.claim())
})
self.addEventListener('push', event => {
  console.log('📨 Push recibido en SW:', event)

  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    console.error('❌ Error parseando payload de push:', e)
  }

  const title = data.title || 'Nueva notificación'
  const body = data.body || ''
  const urlFromPayload = data.url || (data.data && data.data.url) || '/'

  const options = {
    body,
    // Puedes ajustar estos iconos si los tienes:
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: {
      // lo importante: guardar la URL a la que queremos ir
      url: urlFromPayload,
      ...data.data, // ticketId, code, actorId, etc.
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ===============================
// Evento CLICK en la notificación
// ===============================
self.addEventListener('notificationclick', event => {
  console.log('🖱 notificationclick:', event)
  event.notification.close()

  const notifData = event.notification.data || {}
  const relativeUrl = notifData.url || '/'
  const targetUrl = new URL(relativeUrl, self.location.origin).href

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // 1) Si ya hay una pestaña de la app abierta, la enfocamos y navegamos
      for (const client of allClients) {
        // Si tu app es SPA en la misma origin, basta con esto:
        if (client.url.startsWith(self.location.origin)) {
          console.log('🔁 Reutilizando pestaña existente:', client.url)
          await client.focus()
          // Para SPA: navegamos a la ruta del ticket
          client.navigate(targetUrl)
          return
        }
      }

      // 2) Si no hay pestañas, abrimos una nueva
      console.log('🆕 No hay pestañas, abriendo nueva:', targetUrl)
      await self.clients.openWindow(targetUrl)
    })()
  )
})
