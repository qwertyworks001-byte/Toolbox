// Habit Tracker service worker: lets the app open and work with no connection.
// Network first (so updates arrive as soon as you're online), cache as the fallback.
const CACHE = 'habit-tracker-v2';
const SHELL = ['./habit-tracker.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', '../style.css', '../firebase-config.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;       // never touch Firebase / Google requests
  e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
    .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./habit-tracker.html') : Response.error()))));
});