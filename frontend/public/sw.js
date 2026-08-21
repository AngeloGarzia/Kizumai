// Service Worker Kizumai — notifications Web Push.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/** Uniquement chemins same-origin (anti open-redirect). */
function safeNotificationUrl(raw) {
  const fallback = '/';
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const u = new URL(raw, self.location.origin);
    if (u.origin !== self.location.origin) return fallback;
    return `${u.pathname}${u.search}${u.hash}` || fallback;
  } catch {
    return fallback;
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Kizumai', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Kizumai';
  const options = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: safeNotificationUrl(data.url || '/') },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = safeNotificationUrl(event.notification.data?.url || '/');

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(targetUrl).catch(() => {});
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
