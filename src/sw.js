// Turnwise offline: CACHE and FILES are written in by the build. Pages come from the network first, everything else from the cache first
const INDEX = new URL('./', self.location).href
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())))
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())))
self.addEventListener('fetch', e => {
  const r = e.request
  if (r.method !== 'GET' || !r.url.startsWith('http')) return
  if (r.mode === 'navigate') return e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(INDEX, copy)) } return res }).catch(() => caches.match(INDEX, { ignoreVary: true })))
  e.respondWith(caches.match(r, { ignoreVary: true }).then(hit => hit || fetch(r).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)) } // fonts and anything loaded later
    return res
  })))
})
