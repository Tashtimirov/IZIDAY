// Двойные уведомления: два пуша разом (две подписки одного телефона), тот же текст под другим id,
// пуш без новостей — у человека на экране каждое уведомление ровно один раз
import fs from "fs"
const src = fs.readFileSync(new URL("../src/web/sw.js", import.meta.url), "utf8")
const handlers = {}, shown = [], store = {}, open = new Map()
const self = { addEventListener: (t, f) => handlers[t] = f, clients: {}, registration: { scope: "https://x/",
  showNotification: async (t, o) => { await new Promise(r => setTimeout(r, 5)); shown.push({ t, o }); open.set(o.tag, { close: () => open.delete(o.tag) }) },
  getNotifications: async ({ tag }) => open.has(tag) ? [open.get(tag)] : [] } }
const caches = { open: async () => ({ match: async k => store[k] ? { json: async () => store[k] } : null, put: async (k, r) => store[k] = JSON.parse(await r.text()), addAll: async () => {} }), keys: async () => [] }
store.conn = { hook: "https://script/exec", secret: "s" }
let items = []
const fetch = () => new Promise(r => setTimeout(() => r({ json: async () => ({ push: { items } }) }), 10))
new Function("self", "caches", "fetch", "location", src)(self, caches, fetch, { origin: "https://x" })
let ok = true
const check = (c, msg, got) => { console.log((c ? "✓ " : "✗ ") + msg + (c ? "" : "  → " + JSON.stringify(got))); ok = ok && !!c }
const push = () => { let d; handlers.push({ waitUntil: p => d = p }); return d }
const g20 = { id: "g20:ev@google.com:1", at: Date.now(), title: "🚗 Через 20 минут выезжать", body: "«Прайм Тайм» в 09:00. Ехать ~15 мин (6.8 км).", url: "./" }
items = [g20]
await Promise.all([push(), push()])
const vis = () => shown.filter(x => x.o.tag !== "izi-quiet")
check(vis().length === 1, "два пуша разом — уведомление показано один раз", shown.map(x => x.o.tag))
check(!open.has("izi-quiet"), "второй пуш без новостей — служебное уведомление сразу закрыто")
items = [g20, Object.assign({}, g20, { id: "g20:copy@google.com:1", at: Date.now() })]
await push()
check(vis().length === 1, "то же событие из второго календаря (другой id, тот же текст) — не повторяется", vis().map(x => x.o.tag))
items = [g20, { id: "r0:1", at: Date.now(), title: "⏰ Напоминание", body: "Позвонить маме", url: "./" }]
await push()
check(vis().length === 2 && vis()[1].t === "⏰ Напоминание", "новое — показывается как обычно", vis().map(x => x.t))
console.log(ok ? "SWDEDUP_OK" : "SWDEDUP_FAIL"); process.exit(ok ? 0 : 1)
