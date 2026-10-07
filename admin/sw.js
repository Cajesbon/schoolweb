/* Service worker: receives push messages and shows notifications even when the dashboard is closed. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (e) {
    d = { title: 'School website', body: event.data ? event.data.text() : '' };
  }
  const options = {
    body: d.body || '',
    icon: d.icon || '/admin/icon-192.png',
    badge: '/admin/icon-192.png',
    tag: d.tag || 'school-admin',
    renotify: true,
    data: { url: d.url || '/admin/' },
  };
  event.waitUntil(self.registration.showNotification(d.title || 'School website', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/admin/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.indexOf(self.location.origin + '/admin') === 0 && 'focus' in c) {
          if ('navigate' in c) c.navigate(target);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
