// Service Worker - La Ampolleta PWA (Web Push / VAPID)
const CACHE_NAME = 'ampolleta-v1';

// Al instalar, saltar tiempo de espera para activación inmediata
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Al activar, reclamar clientes para control inmediato
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Oyente de eventos Push enviados desde el servidor
self.addEventListener('push', (event) => {
  console.log('✉️ [Service Worker] - Evento Push Recibido.');

  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        title: 'La Ampolleta',
        body: event.data.text()
      };
    }
  }

  const title = payload.title || 'La Ampolleta';
  const options = {
    body: payload.body || 'Nueva notificación recibida.',
    icon: payload.icon || '/icon-black.png',
    badge: payload.badge || '/isotipo.png',
    vibrate: [100, 50, 100],
    data: {
      url: payload.url || '/'
    },
    // Asegurar que notificaciones repetidas se reemplacen si es necesario
    tag: payload.tag || 'ampolleta-notification',
    renotify: payload.tag ? true : false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Oyente al hacer clic en la notificación
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ [Service Worker] - Clic en notificación detectado.');
  
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  // Buscar si ya hay una pestaña de la app abierta
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si hay una pestaña abierta, enfocarla y navegar a la ruta
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Si no hay pestañas abiertas, abrir una nueva ventana
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
