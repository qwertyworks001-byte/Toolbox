// Toolbox notification service worker. It exists only so notifications work on phones (they must be shown through a
// service worker) and so tapping one opens or focuses the right Toolbox page. It does not cache anything.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.split('#')[0] === url.split('#')[0] && 'focus' in c) return c.focus();
    }
    for (const c of list) {
      if ('focus' in c && 'navigate' in c) return c.focus().then(() => c.navigate(url)).catch(() => self.clients.openWindow(url));
    }
    return self.clients.openWindow(url);
  }));
});