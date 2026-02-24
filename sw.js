/* ═══════════════════════════════════════════════════
   KRONOS — Service Worker
   Handles: PWA caching + Push Notifications
═══════════════════════════════════════════════════ */

const CACHE = 'kronos-v1';
const PRECACHE = ['/login.html', '/app.html', '/manifest.json'];

/* ── Install: cache core files ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: network first, cache fallback ── */
self.addEventListener('fetch', e => {
  // Only handle same-origin GET requests
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Update cache with fresh response
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

/* ── Push Notifications ── */
self.addEventListener('push', e => {
  let data = { title: 'Kronos', body: '', icon: 'https://i.imgur.com/j7zxM6Z.png' };
  try { data = { ...data, ...e.data.json() }; } catch(err) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  data.icon,
      badge: data.icon,
      tag:   data.tag || 'kronos',
      data:  data.url ? { url: data.url } : {},
      vibrate: [200, 100, 200],
    })
  );
});

/* ── Notification click: focus or open the app ── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/app.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('app.html'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

/* ── Local notification scheduler ──
   The app posts messages here to schedule
   period-end warnings without needing a server ── */
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_NOTIFICATION') {
    const { delayMs, title, body, tag } = e.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon:    'https://i.imgur.com/j7zxM6Z.png',
        badge:   'https://i.imgur.com/j7zxM6Z.png',
        tag,
        vibrate: [200, 100, 200],
      });
    }, delayMs);
  }

  if (e.data?.type === 'CANCEL_NOTIFICATIONS') {
    self.registration.getNotifications().then(notifs =>
      notifs.forEach(n => n.close())
    );
  }
});
