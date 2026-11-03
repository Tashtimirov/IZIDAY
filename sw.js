// Приложение открывается мгновенно и без сети: оболочка (страница, код, значки) берётся из кэша,
// а в фоне проверяется новая версия. Запросы к таблице и к Claude идут мимо кэша.
const CACHE = "myday-4540acf513"
const SHELL = ["./", "index.html", "style.css", "core.js", "app.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"]
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())) })
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== "myday-conn").map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url)
  if (e.request.method !== "GET" || url.origin !== location.origin) return
  e.respondWith(caches.open(CACHE).then(async c => {
    // Сначала сеть (чтобы значок на «Домой» сразу получал новую версию), кэш — если сети нет или она тормозит
    const net = fetch(e.request, { cache: "no-store" }).then(r => { if (r.ok) c.put(e.request, r.clone()); return r })
    const slow = new Promise(res => setTimeout(res, 3000))
    const r = await Promise.race([net.catch(() => null), slow])
    if (r) return r
    const hit = await c.match(e.request, { ignoreSearch: true })
    return hit || net
  }))
})

// ── Пуш-уведомления: подсказки присылает таблица (расписание у помощника). Пуш пустой — текст забираем из «исходящих» ──
const CONN = "myday-conn"
async function connRead(key) { const r = await (await caches.open(CONN)).match(key); return r ? r.json() : null }
async function connWrite(key, v) { await (await caches.open(CONN)).put(key, new Response(JSON.stringify(v))) }
self.addEventListener("push", e => e.waitUntil((async () => {
  let items = []
  try {
    const c = await connRead("conn")
    if (c && c.hook) {
      const r = await fetch(c.hook, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, credentials: "omit", cache: "no-store",
        body: JSON.stringify({ secret: c.secret, hub: { from: "app", push: { action: "outbox" } } }) })
      items = ((await r.json()).push || {}).items || []
    }
  } catch (err) {}
  const shown = (await connRead("shown").catch(() => null)) || []
  // старше 40 минут — уже не новость (например, после обновления приложения): не показываем повторно пачкой
  let fresh = items.filter(x => x && x.id && !shown.includes(x.id) && !(x.at && Date.now() - x.at > 40 * 60e3))
  // iPhone требует показать уведомление на каждый пуш: нечего нового — повторяем последнее с тем же tag (оно просто заменит прежнее)
  if (!fresh.length) fresh = items.length ? [items[items.length - 1]] : [{ id: "x" + Date.now(), title: "IZIDAY", body: "Есть подсказка — откройте приложение", url: "./" }]
  for (const x of fresh.slice(-4)) await self.registration.showNotification(x.title || "IZIDAY", { body: x.body || "", tag: x.id, icon: "icon-192.png", badge: "icon-192.png", data: { url: x.url || "./" } })
  await connWrite("shown", shown.concat(fresh.map(x => x.id)).slice(-200))
})()))
self.addEventListener("notificationclick", e => {
  e.notification.close()
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    for (const c of list) { try { await c.navigate(url); return c.focus() } catch (err) { return c.focus() } }
    return self.clients.openWindow(url)
  })())
})
