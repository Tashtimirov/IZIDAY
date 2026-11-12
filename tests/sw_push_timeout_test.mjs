// Таблица не отвечает (замок занят рассылкой) — уведомление всё равно показывается за ~6 с, иначе iPhone отзывает подписку
import fs from "fs"
const src = fs.readFileSync(new URL("../src/web/sw.js", import.meta.url), "utf8")
const handlers = {}, shown = [], store = {}
const self = { addEventListener: (t, f) => handlers[t] = f, registration: { showNotification: async (t, o) => shown.push({ t, o }), scope: "https://x/" }, clients: {} }
const caches = { open: async () => ({ match: async k => store[k] ? { json: async () => store[k] } : null, put: async (k, r) => store[k] = JSON.parse(await r.text()), addAll: async () => {} }), keys: async () => [] }
store.conn = { hook: "https://script/exec", secret: "s" }
let mode = "hang"
const fetch = (u, o) => mode === "hang"
  ? new Promise((_, rej) => o.signal.addEventListener("abort", () => rej(new Error("aborted"))))
  : Promise.resolve({ json: async () => ({ push: { items: [{ id: "r0:1", at: Date.now(), title: "⏰ Напоминание", body: "Школа", url: "./" }] } }) })
new Function("self", "caches", "fetch", "location", src)(self, caches, fetch, { origin: "https://x" })
let ok = true
const check = (c, msg, got) => { console.log((c ? "✓ " : "✗ ") + msg + (c ? "" : "  → " + JSON.stringify(got))); ok = ok && !!c }
let done; const t0 = Date.now()
handlers.push({ waitUntil: p => done = p }); await done
const dt = Date.now() - t0
check(shown.length === 1 && dt < 7000 && dt >= 5500, "таблица висит — уведомление показано через ~6 с", { dt, shown })
mode = "ok"; shown.length = 0
handlers.push({ waitUntil: p => done = p }); await done
check(shown.length === 1 && shown[0].t === "⏰ Напоминание", "таблица ответила — показан текст напоминания", shown)
console.log(ok ? "SWPUSH_OK" : "SWPUSH_FAIL"); process.exit(ok ? 0 : 1)
