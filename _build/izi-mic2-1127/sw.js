// Приложение открывается мгновенно и без сети: оболочка (страница, код, стили, значки) лежит в кэше этой версии
// и отдаётся сразу, без ожидания сети. Новая версия ставится целиком в фоне (установка нового sw.js —
// браузер сверяет его при каждом открытии), и только потом подменяет старую одним махом: файлы двух разных
// версий никогда не смешиваются. Страница перезагружается сама (app.js, controllerchange).
// Скачиваются только изменившиеся файлы: у каждого файла метка содержимого (HASH); файл с той же меткой
// берётся из кэша прежней версии — обновление весит десятки КБ, а не мегабайт.
// Запросы к таблице и к Claude идут мимо кэша (другой адрес).
const CACHE = "myday-ddc2798d9b"
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "style.css", "gami.css", "quest.css", "onb.css", "health.css", "fast.css", "family.css", "album.css", "mem.css", "design.css", "feat.css", "plan.css", "order.css", "undo.css", "menu.css", "tablet.css", "kids.css", "i18n.js", "bug.js", "gami.js", "quest.js", "qr.js", "family.js", "docread.js", "core.js", "app.js", "stt.js", "friends.js", "grow.js", "onb.js", "health.js", "fast.js", "album.js", "mem.js", "feat.js", "plan.js", "design.js", "order.js", "undo.js", "tablet.js", "kids-data.js", "kids.js", "exit.js", "metrics.js", "settings.js"]   // build_web.py подставляет список файлов из index.html
const HASH = {"index.html": "b6cbd4f77d7d", "manifest.webmanifest": "594977e0ed42", "icon-180.png": "b3201af1b002", "icon-192.png": "6b378f54a210", "style.css": "9105a7724166", "gami.css": "5eb0e6be4905", "quest.css": "2a188669b8cc", "onb.css": "011d13c7c520", "health.css": "edd3c2a537e4", "fast.css": "44d97c07493f", "family.css": "2e7ef33050e0", "album.css": "ad04493c951d", "mem.css": "1358242c99ad", "design.css": "e8858012e4c5", "feat.css": "a52f1e287eb5", "plan.css": "cc8b6fdc2572", "order.css": "19b6c4cf64e1", "undo.css": "13cb436d1460", "menu.css": "02d94e695158", "tablet.css": "0736c3075fe6", "kids.css": "4f83e05ef608", "i18n.js": "e73d9d722a92", "bug.js": "4074f294bd52", "gami.js": "1af3f0cb7d29", "quest.js": "be9918bb5e1c", "qr.js": "43beb85f4625", "family.js": "e1d95db7f498", "docread.js": "775e70c4b766", "core.js": "30137d67f257", "app.js": "c5b0ddfbf3d6", "stt.js": "42ecf82919f8", "friends.js": "f4047fda0a6a", "grow.js": "500cdf36bea9", "onb.js": "bc7d17c8300b", "health.js": "eae8723993a7", "fast.js": "8269b640ba68", "album.js": "86b29143159f", "mem.js": "74d1c8e59a67", "feat.js": "8d96bba14134", "plan.js": "ee851288d22d", "design.js": "e0fc9086a30e", "order.js": "e01d5ec76fe3", "undo.js": "08a410ed99f6", "tablet.js": "e7e38467fb28", "kids-data.js": "7714348bc829", "kids.js": "a59646ae6c36", "exit.js": "1d26eaa269e7", "metrics.js": "18e6ae8fd3f2", "settings.js": "2026c7fb1fc6", "i18n-en.js": "1a73d51af3c7"}  // build_web.py: файл → метка содержимого
// Английский словарь нужен только при английском языке: кладём в кэш, если он уже был (и не менялся) или им пользуются
const OPT = ["i18n-en.js"], EN_FLAG = "lang-en"
const META = "./__shell-hash__"
async function oldCaches() { return (await caches.keys()).filter(k => k !== CACHE && /^myday-/.test(k) && k !== "myday-conn") }
// Ответ с пометкой «был переход» (сайт отдаёт index.html через переход на «/») iPhone и iPad отказываются
// показывать как страницу: «Response served by service worker has redirections». Кладём в кэш чистую копию.
async function clean(r) { return r && r.redirected ? new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers }) : r }
async function install() {
  const c = await caches.open(CACHE), olds = []
  for (const k of await oldCaches()) { try { const o = await caches.open(k), m = await o.match(META); if (m) olds.push({ o, h: await m.json() }) } catch (err) {} }
  const reuse = async f => { if (!HASH[f]) return null; for (const { o, h } of olds) if (h[f] === HASH[f]) { const r = await o.match(f, { ignoreSearch: true }); if (r) return r } return null }
  const en = await connRead(EN_FLAG).catch(() => null)
  const want = SHELL.concat(OPT.filter(f => en))
  await Promise.all(want.map(async u => {
    const f = u === "./" ? "index.html" : u
    const r = await reuse(f).catch(() => null)
    if (r) return c.put(u, await clean(r))
    const n = await fetch(new Request(u, { cache: "reload" }))
    if (!n.ok) throw new Error(u + " " + n.status)
    return c.put(u, await clean(n))
  }))
  // словарь, которым не пользуются, переносим только если он не менялся (бесплатно, без скачивания)
  for (const f of OPT) if (!want.includes(f)) { const r = await reuse(f).catch(() => null); if (r) await c.put(f, await clean(r)) }
  await c.put(META, new Response(JSON.stringify(HASH), { headers: { "content-type": "application/json" } }))
}
self.addEventListener("install", e => {
  e.waitUntil(install().catch(async err => {
    // что-то пошло не так с переносом — ставим версию по-старому, целиком из сети
    await caches.delete(CACHE); const c = await caches.open(CACHE)
    await Promise.all(SHELL.map(async u => { const n = await fetch(new Request(u, { cache: "reload" })); if (!n.ok) throw new Error(u + " " + n.status); await c.put(u, await clean(n)) }))
    await c.put(META, new Response(JSON.stringify(HASH)))
  }).then(() => self.skipWaiting()))
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
    const opt = OPT.find(f => url.pathname.endsWith("/" + f))
    if (opt) connWrite(EN_FLAG, 1).catch(() => {})   // словарь попросили — дальше держим его в кэше
    if (hit) return clean(hit)
    // словарь не в кэше — скачать и положить в кэш этой версии (для работы без сети)
    if (opt) { const r = await fetch(e.request, { cache: "no-store" }); if (r.ok) c.put(opt, r.clone()).catch(() => {}); return r }
    // остальное (w.json, bug.html, privacy.html, PDF, большой значок) — из сети; в кэш версии не кладём
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
// Защита от двойных уведомлений. (1) Два пуша почти разом (две подписки одного телефона, повтор с сервера) раньше
// читали список «показано» одновременно и оба показывали одно и то же: теперь показ идёт строго по очереди.
// (2) Одинаковый текст (то же событие в двух календарях, тот же пуш с другим id) за 3 часа второй раз не показываем.
// (3) Нечего показать нового — iPhone всё равно требует уведомление на каждый пуш, иначе снимет подписку; раньше
// повторяли последнее, а iPhone не заменяет его по tag и показывает дубль. Теперь — тихое служебное, которое тут же закрываем
let showQ = Promise.resolve()
const inQueue = f => { const j = showQ.then(f, f); showQ = j.catch(() => {}); return j }
const txtKey = x => (String(x.title || "") + "|" + String(x.body || "")).replace(/\s+/g, " ").trim()
self.addEventListener("push", e => e.waitUntil((async () => {
  let items = [], got = false
  try {
    const c = await connRead("conn")
    if (c && c.hook) {
      // iPhone даёт на пуш считаные секунды: не успели показать уведомление — пуш считается «тихим», и после
      // нескольких таких iPhone молча отзывает подписку (уведомления пропадают совсем). Поэтому ждём таблицу не дольше 6 с
      const ab = new AbortController(), tm = setTimeout(() => ab.abort(), 6000)
      try {
        const r = await fetch(c.hook, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, credentials: "omit", cache: "no-store", signal: ab.signal,
          body: JSON.stringify({ secret: c.secret, hub: { from: "app", push: { action: "outbox" } } }) })
        items = ((await r.json()).push || {}).items || []; got = true
      } finally { clearTimeout(tm) }
    }
  } catch (err) {}
  // «Вышло обновление» (владелец объявил выкладку): новую версию начинаем качать сразу, ещё до нажатия —
  // к открытию она уже стоит, и закрывать-открывать приложение не нужно (открытое обновится само, app.js)
  const upd = items.some(x => x && x.upd) ? self.registration.update().catch(() => {}) : null
  await inQueue(async () => {
    const shown = (await connRead("shown").catch(() => null)) || []
    const txt = ((await connRead("shownTxt").catch(() => null)) || []).filter(t => t && Date.now() - t.at < 3 * 3600e3)
    const seen = new Set(txt.map(t => t.k))
    // старше 40 минут — уже не новость (например, после обновления приложения): не показываем повторно пачкой
    const fresh = []
    for (const x of items) {
      if (!x || !x.id || shown.includes(x.id) || (x.at && Date.now() - x.at > 40 * 60e3)) continue
      shown.push(x.id)   // и id, и текст отмечаем сразу: дубль в той же пачке тоже отсекается
      const k = txtKey(x); if (seen.has(k)) continue
      seen.add(k); txt.push({ k, at: Date.now() }); fresh.push(x)
    }
    // таблица не ответила — текст неизвестен, но пуш мог быть важным: общее уведомление
    if (!fresh.length && !got) fresh.push({ id: "x" + Date.now(), title: "IZIDAY", body: "Есть напоминание — нажмите, чтобы открыть", url: "./" })
    if (!fresh.length) {
      // ничего нового: служебное уведомление, сразу закрытое — iPhone доволен, у человека в списке ничего не появляется
      await self.registration.showNotification("IZIDAY", { body: "", tag: "izi-quiet", silent: true, data: { url: "./" } })
      try { for (const n of await self.registration.getNotifications({ tag: "izi-quiet" })) n.close() } catch (err) {}
    }
    for (const x of fresh.slice(-4)) { const p = pretty(x)
      // подсказка помощника: нажатие открывает чат с этой подсказкой и сразу микрофон — ответить голосом
      const url = /#chat$/.test(x.url || "") ? "./#reply=" + encodeURIComponent((p.t + "\n" + p.b).trim()) : x.url
      await self.registration.showNotification(p.t, { body: p.b, tag: x.id, icon: "icon-192.png", badge: "icon-192.png", data: { url } }) }
    await connWrite("shown", shown.slice(-200))
    await connWrite("shownTxt", txt.slice(-100))
  })
  if (upd) await Promise.race([upd, new Promise(r => setTimeout(r, 8000))])
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
