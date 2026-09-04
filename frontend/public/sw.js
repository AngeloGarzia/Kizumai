// Service Worker Kizumai — notifications Web Push.

/** Préfixe app (ex. /kizumai) dérivé du scope d'enregistrement du SW. */
function scopeBasePath() {
  try {
    const path = new URL(self.registration.scope).pathname;
    if (path === '/' || path === '') return '';
    return path.endsWith('/') ? path.slice(0, -1) : path;
  } catch {
    return '';
  }
}

function assetPath(relative) {
  const rel = relative.startsWith('/') ? relative : `/${relative}`;
  const base = scopeBasePath();
  return base ? `${base}${rel}` : rel;
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/** Uniquement chemins same-origin (anti open-redirect). */
function safeNotificationUrl(raw) {
  const fallback = assetPath('/');
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
    icon: assetPath('/icon.svg'),
    badge: assetPath('/icon.svg'),
    data: { url: safeNotificationUrl(data.url || assetPath('/')) },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = safeNotificationUrl(event.notification.data?.url || assetPath('/'));

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
