// Виджет ↔ таблица ↔ веб-приложение: виджет отдаёт снимок iPhone и записи, получает записи приложения,
// выполняет его команды без окон подтверждения, кнопки виджета открывают приложение
import fs from "fs"
import { sheetScript } from "./fake_sheet.mjs"
const NOW = new Date(2026, 10, 1, 10, 0)
const RealDate = Date
let tick = 0
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW.getTime() + tick) } static now() { return NOW.getTime() + tick } }
const APP = "https://tashtimirov.github.io/myday-app/"
const full = fs.readFileSync(new URL("../src/iphone/MyDay.js", import.meta.url), "utf8").replace('webApp: "__WEB_APP__"', `webApp: "${APP}"`)
const src = full.replace(/\/\/ ───────────── Запуск[\s\S]*$/, "")
const z = n => String(n).padStart(2, "0")
class Color { constructor(h) { this.hex = h } static dynamic(a) { return a } static white() { return new Color("fff") } }
class DateFormatter { set dateFormat(p) { this.p = p } string(d) { return this.p === "yyyy-MM-dd'T'HH:mm" ? `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}` : `${z(d.getDate())}.${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}` } }
const at = (d, h) => new RealDate(2026, 10, d, h)
const files = {
  "/d/my-day/finance.json": JSON.stringify([{ id: "f1", date: NOW.getTime() - 3600e3, u: NOW.getTime() - 3600e3, type: "expense", amount: 150, method: "cash", category: "Транспорт" }]),
  "/d/my-day/water.json": JSON.stringify([{ id: "w1", date: NOW.getTime() - 60e3, u: NOW.getTime() - 60e3, ml: 250 }]),
  "/d/my-day/settings.json": JSON.stringify({ sheetHook: "https://script.google.com/x/exec", sheetSecret: "s".repeat(32) }),
}
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: p => p in files || p === "/d/my-day",
  createDirectory() {}, isFileStoredIniCloud: () => false, modificationDate: () => NOW,
  readString: p => files[p], writeString: (p, s) => { files[p] = s } }
const cal = { title: "Личное", color: new Color("1E9E8F") }
const store = [{ identifier: "E1", title: "Падел", startDate: at(1, 19), endDate: at(1, 21), calendar: cal, location: "", remove() { store.splice(store.indexOf(this), 1) } }]
class CalendarEvent {
  static async between(a, b) { return store.filter(e => e.startDate < b && e.endDate > a) }
  save() { if (!this.identifier) { this.identifier = "E" + (store.length + 1); this.calendar ||= cal; store.push(this) } }
  addRecurrenceRule() {}
  remove() { store.splice(store.indexOf(this), 1) }
}
const reminders = [{ identifier: "R1", title: "Купить цветы", dueDate: at(1, 18), dueDateIncludesTime: true, isCompleted: false, calendar: { title: "Напоминания" }, save() {} }]
class Reminder { static async allIncomplete() { return reminders.filter(r => !r.isCompleted) } static async allCompleted() { return reminders.filter(r => r.isCompleted) } }
const alerts = []
class Alert { addAction() {} addDestructiveAction() {} addCancelAction() {} async presentAlert() { alerts.push(this.title); return -1 } }
const sheet = sheetScript()
const requests = []
const urls = []
const stub = () => new Proxy(function () {}, {
  get: (t, k) => k === "then" ? undefined : k in t ? t[k] : (t[k] = stub()),
  set: (t, k, v) => { if (k === "url") urls.push(v); t[k] = v; return true },
  apply: () => stub(), construct: () => stub() })
const g = { Color, DateFormatter, CalendarEvent, Reminder, Alert, URLScheme: { forRunningScript: () => "scriptable:///run/MyDay" },
  FileManager: { iCloud: () => fmo, local: () => fmo }, Keychain: { contains: () => false },
  Calendar: { forEvents: async () => [cal], forReminders: async () => [{ title: "Напоминания" }], defaultForEvents: async () => cal },
  ListWidget: stub(), LinearGradient: stub(), Font: stub(), Size: stub(), SFSymbol: stub(), Point: stub(), DrawContext: stub(),
  Notification: class { async schedule() {} setTriggerDate() {} }, Safari: { open() {} },
  Request: class { async loadJSON() { const b = JSON.parse(this.body); requests.push(b); tick += 1000; return sheet.post(b) } } }
let ok = true
const check = (cond, msg, got) => { console.log(cond ? "   ✓" : "   ✗", msg, cond ? "" : JSON.stringify(got)); ok = ok && cond }
const w = await new Function(...Object.keys(g), "return (async()=>{" + src + "; return { hubSync, buildWidget, loadSettings } })()")(...Object.values(g))

// 1. первый обмен: виджет отдаёт всё и снимок
let n = await w.hubSync()
check(n === 0 && requests.length === 1, "первый обмен: один запрос, команд нет", requests.length)
const h0 = requests[0].hub
check(h0.from === "widget" && h0.lists.money.length === 1 && h0.lists.water.length === 1, "виджет отдал деньги и воду", h0.lists)
check(h0.snap.events[0].title === "Падел" && h0.snap.events[0].start === "2026-11-01T19:00" && h0.snap.events[0].color === "#1E9E8F", "снимок: событие с цветом календаря", h0.snap.events)
check(h0.snap.reminders[0].id === "R1" && h0.snap.calendars[0] === "Личное", "снимок: напоминания и календари", h0.snap)

// 2. приложение: получает снимок, добавляет расход, удаляет воду, ставит команды
let a = sheet.post({ secret: "s".repeat(32), hub: { from: "app", since: 0, snapAt: 0 } })
check(a.snap && a.snap.events.length === 1 && a.lists.money.length === 1, "приложение видит снимок и деньги виджета", a)
const u = NOW.getTime() + 5000
a = sheet.post({ secret: "s".repeat(32), hub: { from: "app", since: a.now, snapAt: a.snap.at,
  lists: { money: [{ id: "fA", date: u, u, type: "expense", amount: 1200, method: "transfer", category: "Кафе и рестораны", comment: "ужин" }],
           water: [{ id: "w1", deleted: true, u }] },
  ops: [{ id: "op1", tool: "create_event", input: { title: "Стоматолог", start: "2026-11-03T15:00", end: "2026-11-03T16:00" } },
        { id: "op2", tool: "update_reminder", input: { id: "R1", completed: true } },
        { id: "op3", tool: "delete_event", input: { id: "E1", occurrence_start: "2026-11-01T19:00" } },
        { id: "op4", tool: "add_money", input: {} }] } })

// 3. виджет: получает, выполняет, сообщает
requests.length = 0
n = await w.hubSync()
check(n === 4 && requests.length === 2, "виджет выполнил 4 команды и сообщил результат вторым запросом", { n, r: requests.length })
const money = JSON.parse(files["/d/my-day/finance.json"])
check(money.some(x => x.id === "fA" && x.amount === 1200 && !("s" in x)), "расход из приложения записан у виджета (без служебного s)", money)
check(JSON.parse(files["/d/my-day/water.json"]).find(x => x.id === "w1").deleted, "вода удалена и у виджета")
check(store.some(e => e.title === "Стоматолог" && e.startDate.getHours() === 15), "событие создано в календаре iPhone", store.map(e => e.title))
check(reminders[0].isCompleted === true, "напоминание отмечено выполненным")
check(!store.some(e => e.identifier === "E1"), "событие удалено")
check(alerts.length === 0, "окна подтверждения не показывались", alerts)
const done = requests[1].hub.done
check(done.find(d => d.id === "op4").result.error && done.filter(d => d.result.ok).length === 3, "чужая команда (add_money) не выполняется", done)
check(requests[1].hub.snap.events.some(e => e.title === "Стоматолог"), "свежий снимок с новым событием")
a = sheet.post({ secret: "s".repeat(32), hub: { from: "app", since: 0, snapAt: 0 } })
check(a.ops.every(o => o.state === "done") && a.snap.events.some(e => e.title === "Стоматолог"), "приложение видит выполненные команды", a.ops)

// 4. повторный обмен: только новое, без повторных команд
requests.length = 0
n = await w.hubSync()
check(n === 0 && requests.length === 1 && requests[0].hub.lists.money.every(x => x.u > NOW.getTime() - 120000), "повторный обмен: без команд, только свежие записи", requests[0].hub.lists)
const st = await w.loadSettings()
check(st.hubSince > 0 && st.hubAt > 0, "время обмена запомнено")

// 5. кнопки виджета открывают приложение
urls.length = 0
await w.buildWidget("large")
const web = urls.filter(x => typeof x === "string" && x.startsWith(APP))
check(web.includes(APP + "#voice") && web.includes(APP + "#chat") && web.includes(APP + "#money") && web.includes(APP + "#camera"), "кнопки шапки → приложение", web)
check(urls.includes(APP), "нажатие на виджет — приложение")
check(!urls.some(x => typeof x === "string" && /scriptable.*action=(voice|chat|money|camera|water)/.test(x)), "кнопки не открывают Scriptable")
console.log(ok ? "\nHUB_WIDGET_OK" : "\nHUB_WIDGET_FAIL")
process.exit(ok ? 0 : 1)
