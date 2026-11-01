// Приложение открывается мгновенно и без сети: оболочка (страница, код, значки) берётся из кэша,
// а в фоне проверяется новая версия. Запросы к таблице и к Claude идут мимо кэша.
const CACHE = "myday-868849c676"
const SHELL = ["./", "index.html", "style.css", "core.js", "app.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"]
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())) })
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url)
  if (e.request.method !== "GET" || url.origin !== location.origin) return
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true })
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r }).catch(() => hit)
    return hit || net
  }))
})
