// Приложение открывается мгновенно и без сети: оболочка (страница, код, стили, значки) лежит в кэше этой версии
// и отдаётся сразу, без ожидания сети. Новая версия скачивается целиком в фоне (установка нового sw.js —
// браузер сверяет его при каждом открытии), и только потом подменяет старую одним махом: файлы двух разных
// версий никогда не смешиваются. Страница перезагружается сама (app.js, controllerchange).
// Запросы к таблице и к Claude идут мимо кэша (другой адрес).
const CACHE = "myday-b6efdbd3e8"
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "style.css", "gami.css", "quest.css", "onb.css", "health.css", "fast.css", "family.css", "album.css", "mem.css", "design.css", "order.css", "undo.css", "tablet.css", "i18n-en.js", "i18n.js", "bug.js", "gami.js", "quest.js", "family.js", "docread.js", "core.js", "app.js", "stt.js", "friends.js", "onb.js", "health.js", "fast.js", "album.js", "mem.js", "design.js", "order.js", "undo.js", "tablet.js", "metrics.js"]   // build_web.py подставляет список файлов из index.html
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()))
})
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== "myday-conn").map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url)
  if (e.request.method !== "GET" || url.origin !== location.origin) return
  e.respondWith((async () => {
    const c = await caches.open(CACHE)
    // файл оболочки — сразу из кэша (запуск со значка — сама страница «./» с любым ?… после адреса)
    const hit = await c.match(e.request.mode === "navigate" && /\/(index\.html)?$/.test(url.pathname) ? "./" : e.request, { ignoreSearch: true })
    if (hit) return hit
    // остальное (w.json, bug.html, privacy.html, PDF) — из сети; в кэш версии не кладём
    return fetch(e.request, { cache: "no-store" })
  })())
})

// ── Пуш-уведомления: подсказки присылает таблица (расписание у помощника). Пуш пустой — текст забираем из «исходящих» ──
const CONN = "myday-conn"
async function connRead(key) { const r = await (await caches.open(CONN)).match(key); return r ? r.json() : null }
async function connWrite(key, v) { await (await caches.open(CONN)).put(key, new Response(JSON.stringify(v))) }
// Заголовок — суть подсказки, а не «IZIDAY»: значок и подпись «from IZIDAY» iPhone и так показывает
const EMO = [[/ужин|обед|завтрак|перекус|ккал|белок|поешь|еда/i, "🍽"], [/вод[аыу]|стакан|попей/i, "💧"], [/трениров|шаг|прогул|зарядк|пробеж/i, "🏃"],
  [/сон|спать|ложись|лечь/i, "😴"], [/потрат|бюджет|деньг|฿|₽|€|₸|оплат|расход/i, "💰"], [/дет[ия]|школ/i, "👧"], [/встреч|созвон|звонок/i, "📅"]]
function pretty(x) {
  const t = String(x.title || "").trim(), b = String(x.body || "").trim()
  if (t && !/^[^\p{L}]*IZIDAY[^\p{L}]*$/iu.test(t)) return { t, b }
  if (!b) return { t: t || "IZIDAY", b: "" }
  const e = (EMO.find(([r]) => r.test(b)) || [, "💡"])[1], cap = s => s.charAt(0).toUpperCase() + s.slice(1)
  let m = b.match(/^([^:.!?\n]{2,32}):\s*([\s\S]+)$/)
  if (m) return { t: `${e} ${cap(m[1].trim())}`, b: cap(m[2].trim()) }
  m = b.match(/^(.{6,60}?)[.!?]\s+([\s\S]+)$/)
  if (m) return { t: `${e} ${m[1]}`, b: m[2] }
  return b.length <= 60 ? { t: `${e} ${b}`, b: "" } : { t: `${e} ${b.slice(0, 57).replace(/\s+\S*$/, "")}…`, b }
}
self.addEventListener("push", e => e.waitUntil((async () => {
  let items = []
  try {
    const c = await connRead("conn")
    if (c && c.hook) {
      // iPhone даёт на пуш считаные секунды: не успели показать уведомление — пуш считается «тихим», и после
      // нескольких таких iPhone молча отзывает подписку (уведомления пропадают совсем). Поэтому ждём таблицу не дольше 6 с
      const ab = new AbortController(), tm = setTimeout(() => ab.abort(), 6000)
      try {
        const r = await fetch(c.hook, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, credentials: "omit", cache: "no-store", signal: ab.signal,
          body: JSON.stringify({ secret: c.secret, hub: { from: "app", push: { action: "outbox" } } }) })
        items = ((await r.json()).push || {}).items || []
      } finally { clearTimeout(tm) }
    }
  } catch (err) {}
  const shown = (await connRead("shown").catch(() => null)) || []
  // старше 40 минут — уже не новость (например, после обновления приложения): не показываем повторно пачкой
  let fresh = items.filter(x => x && x.id && !shown.includes(x.id) && !(x.at && Date.now() - x.at > 40 * 60e3))
  // iPhone требует показать уведомление на каждый пуш: нечего нового — повторяем последнее с тем же tag (оно просто заменит прежнее)
  if (!fresh.length) fresh = items.length ? [items[items.length - 1]] : [{ id: "x" + Date.now(), title: "IZIDAY", body: "Есть напоминание — нажмите, чтобы открыть", url: "./" }]
  for (const x of fresh.slice(-4)) { const p = pretty(x)
    // подсказка помощника: нажатие открывает чат с этой подсказкой и сразу микрофон — ответить голосом
    const url = /#chat$/.test(x.url || "") ? "./#reply=" + encodeURIComponent((p.t + "\n" + p.b).trim()) : x.url
    await self.registration.showNotification(p.t, { body: p.b, tag: x.id, icon: "icon-192.png", badge: "icon-192.png", data: { url } }) }
  await connWrite("shown", shown.concat(fresh.map(x => x.id)).slice(-200))
})()))
self.addEventListener("notificationclick", e => {
  e.notification.close()
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    // приложение открыто — не меняем адрес (iPhone тогда заново спрашивает микрофон и камеру), а передаём действие сообщением
    const hash = new URL(url).hash
    for (const c of list) { try { if (hash) c.postMessage({ type: "izi-open", hash }); return c.focus() } catch (err) { return c.focus() } }
    return self.clients.openWindow(url)
  })())
})
