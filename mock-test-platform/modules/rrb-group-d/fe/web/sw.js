// Service Worker — caches the exam shell for offline access
const CACHE    = 'rrb-group-d-v1'
const PRECACHE = ['/', '/index.html', '/app.js', '/storage.js', '/sync.js']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // Only cache GET requests for shell assets — API calls always go to network
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('/exam/')) return

  e.respondWith(
    caches.match(e.request).then(cached => cached ?? fetch(e.request))
  )
})
