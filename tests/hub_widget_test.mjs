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
const pending = []   // запланированные уведомления
class Notif {
  async schedule() { const i = pending.findIndex(n => n.identifier && n.identifier === this.identifier); if (i >= 0) pending.splice(i, 1); pending.push(this) }
  setTriggerDate(d) { this.at = d }
  addAction(t, u) { (this.actions ||= []).push([t, u]) }
  static async allPending() { return pending.slice() }
  static removePending(ids) { for (const id of ids) { const i = pending.findIndex(n => n.identifier === id); if (i >= 0) pending.splice(i, 1) } }
}
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
  Notification: Notif, Safari: { open() {} }, Timer: { schedule: (ms, rep, fn) => setTimeout(fn, ms) },
  Location: { setAccuracyToHundredMeters() {}, current: async () => ({ latitude: 13.7563, longitude: 100.5018 }) },
  Request: class { async loadJSON() { const b = JSON.parse(this.body); requests.push(b); tick += 1000; return sheet.post(b) } } }
let ok = true
const check = (cond, msg, got) => { console.log(cond ? "   ✓" : "   ✗", msg, cond ? "" : JSON.stringify(got)); ok = ok && cond }
const w = await new Function(...Object.keys(g), "return (async()=>{" + src + "; return { hubSync, buildWidget, loadSettings, placesCheck, hereNow, scheduleAgenda, waterGap, logLoc, waterNudgeLevel } })()")(...Object.values(g))

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
// 6. место: снимок несёт координаты, напоминание «когда буду рядом» срабатывает один раз и уходит в приложение
check(requests[0].hub.snap.loc && Math.abs(requests[0].hub.snap.loc.lat - 13.7563) < 1e-6, "снимок: где сейчас iPhone", requests[0].hub.snap.loc)
sheet.post({ secret: "s".repeat(32), hub: { from: "app", lists: { places: [
  { id: "pNear", date: Date.now(), u: Date.now(), title: "Заехать в Декатлон", query: "Decathlon", radius: 1500, points: [{ name: "Decathlon Rama 4", lat: 13.7600, lng: 100.5050 }] },
  { id: "pFar", date: Date.now(), u: Date.now(), title: "Купить кофе", query: "Starbucks Pattaya", radius: 1500, points: [{ name: "Pattaya", lat: 12.93, lng: 100.88 }] }] } } })
await w.hubSync()
await w.placesCheck(await w.hereNow())
const pn = pending.filter(x => (x.identifier || "").startsWith("myday-place-"))
check(pn.length === 1 && pn[0].title.includes("Декатлон") && pn[0].openURL.startsWith(APP + "#place="), "рядом с Декатлоном — уведомление, открывает приложение", pn.map(x => x.title))
await w.placesCheck(await w.hereNow())
check(pending.filter(x => (x.identifier || "").startsWith("myday-place-")).length === 1, "второй раз не напоминает")
requests.length = 0
await w.hubSync()
check(requests[0].hub.lists.places.some(x => x.id === "pNear" && x.done) && !requests[0].hub.lists.places.some(x => x.id === "pFar" && x.done), "отметка «сработало» ушла в приложение", requests[0].hub.lists.places)

// история мест: одна точка, на том же месте в течение часа — не дублируется, уходит в таблицу
await w.logLoc(await w.hereNow()); await w.logLoc(await w.hereNow())
const locs = JSON.parse(files["/d/my-day/locs.json"])
check(locs.length === 1 && Math.abs(locs[0].lat - 13.7563) < 1e-4, "история мест: точка записана один раз", locs)
requests.length = 0
await w.hubSync()
check(requests[0].hub.lists.locs && requests[0].hub.lists.locs.length === 1, "история мест уходит в таблицу", requests[0].hub.lists.locs)

// 7. уведомления о делах: встреча за 10 минут, напоминание вовремя — открывают приложение; лишние убираются
store.push({ identifier: "E9", title: "Встреча с застройщиком", startDate: at(1, 14), endDate: at(1, 15), calendar: cal, location: "Офис\nэтаж 3" })
reminders.push({ identifier: "RI", title: "Из Напоминаний iPhone", dueDate: at(1, 16), dueDateIncludesTime: true, isCompleted: false, calendar: { title: "Текущие" }, save() {} })
const z2 = n => String(n).padStart(2, "0"), loc = d => `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}T${z2(d.getHours())}:${z2(d.getMinutes())}`
pending.push(Object.assign(new Notif(), { identifier: "myday-ag-e-OLD-1-x", title: "старое" }))
sheet.post({ secret: "s".repeat(32), hub: { from: "app", lists: { nudges: [{ id: "n1", date: at(1, 15).getTime(), u: Date.now(), text: "Перед встречей выпей воды" }, { id: "n2", date: at(1, 15).getTime(), u: Date.now(), text: "удалена", deleted: true }],
  rems: [{ id: "R9", date: Date.now(), u: Date.now(), title: "Позвонить маме", due: loc(at(1, 16)), done: false }, { id: "R8", date: Date.now(), u: Date.now(), title: "Готово уже", due: loc(at(1, 16)), done: true }] } } })
await w.hubSync()
await w.scheduleAgenda()
const nd = pending.filter(x => (x.identifier || "").startsWith("myday-ag-n-"))
check(nd.length === 1 && nd[0].body === "Перед встречей выпей воды" && nd[0].at.getHours() === 15 && nd[0].openURL === APP + "#chat", "подсказка помощника — уведомление в своё время, открывает чат", nd.map(x => x.body))
const ag = pending.filter(x => (x.identifier || "").startsWith("myday-ag-"))
const ev = ag.find(x => x.title === "📅 Встреча с застройщиком"), rm = ag.find(x => x.title === "⏰ Позвонить маме")
check(ev && ev.at.getHours() === 13 && ev.at.getMinutes() === 50 && ev.openURL === APP && /Офис/.test(ev.body) && !/этаж/.test(ev.body), "встреча: уведомление за 10 минут", ev && { at: String(ev.at), body: ev.body })
check(rm && rm.at.getHours() === 16, "напоминание со временем: уведомление вовремя", rm && String(rm.at))
check(rm && rm.openURL === APP + "#rem=R9" && !ag.some(x => /Из Напоминаний iPhone|Готово уже/.test(x.title + x.body)), "напоминания — из приложения; iPhone и выполненные не напоминают", rm && rm.openURL)
check(!ag.some(x => x.title === "старое"), "устаревшее уведомление убрано")
const fu = ag.filter(x => (x.identifier || "").startsWith("myday-ag-f-R9-")).sort((a, b) => a.at - b.at)
check(fu.length === 3 && fu[0].at.getHours() === 17 && fu[1].at.getHours() === 19 && fu[2].at.getHours() === 10 && fu[0].title === "⏰ Выполнил?" && fu[0].openURL === APP + "#rem=R9",
  "не отмечено: «Выполнил?» через час, ещё через 2 ч, утром снова", fu.map(x => [x.title, String(x.at.getHours())]))
check(fu[0].actions && fu[0].actions.some(a => a[1] === APP + "#remdone=R9") && fu[0].actions.some(a => a[1] === APP + "#remlater=R9"), "в уведомлении кнопки «Сделано» и «Через час»")
const cnt = ag.length
await w.scheduleAgenda()
check(pending.filter(x => (x.identifier || "").startsWith("myday-ag-")).length === cnt, "повторный запуск не дублирует")
// вода: уведомления нарастают — ласково, настойчивее, вопрос; попил — снова с первого
{
  const today = new Date(), dk = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const now = Date.now()
  check(w.waterNudgeLevel(3, {}, 0) === 0, "3 ч без воды — первое, ласковое")
  check(w.waterNudgeLevel(4, { waterNudgeDay: dk, waterNudgeAt: now - 3600e3, waterNudgeLevel: 1 }, 0) === -1, "через час после первого — ещё не повторяет")
  check(w.waterNudgeLevel(4, { waterNudgeDay: dk, waterNudgeAt: now - 1.6 * 3600e3, waterNudgeLevel: 1 }, 0) === 1, "через 1,5 ч — настойчивее")
  check(w.waterNudgeLevel(6, { waterNudgeDay: dk, waterNudgeAt: now - 1.6 * 3600e3, waterNudgeLevel: 2 }, 0) === 2, "потом — вопрос «почему не пьёшь?»")
  check(w.waterNudgeLevel(8, { waterNudgeDay: dk, waterNudgeAt: now - 1.6 * 3600e3, waterNudgeLevel: 3 }, 0) === -1, "больше трёх за раз не шлёт")
  check(w.waterNudgeLevel(3, { waterNudgeDay: dk, waterNudgeAt: now - 4 * 3600e3, waterNudgeLevel: 3 }, now - 3.5 * 3600e3) === 0, "попил после уведомлений — отсчёт заново, снова ласково")
}
// 8. вода: подсказка вместо уведомлений — с 9 до 21, больше 3 часов без записи
const wd = (ml, ...times) => ({ water: ml, waterList: times.map(t => ({ date: t.getTime(), ml: 250 })) })
check(w.waterGap(wd(250, at(1, 10)), new RealDate(2026, 10, 1, 12, 30)) === 0, "2,5 ч без воды — без подсказки")
check(w.waterGap(wd(250, at(1, 10)), new RealDate(2026, 10, 1, 13, 40)) === 3, "3,7 ч без воды — «3 ч без воды»")
check(w.waterGap(wd(0), new RealDate(2026, 10, 1, 12, 10)) === 3, "без воды с утра — отсчёт от 9:00")
check(w.waterGap(wd(0), new RealDate(2026, 10, 1, 8, 50)) === 0 && w.waterGap(wd(0), new RealDate(2026, 10, 1, 21, 5)) === 0, "до 9 и после 21 — тихо")
check(w.waterGap(wd(2000, at(1, 9)), new RealDate(2026, 10, 1, 15, 0)) === 0, "норма выпита — тихо")
console.log(ok ? "\nHUB_WIDGET_OK" : "\nHUB_WIDGET_FAIL")
process.exit(ok ? 0 : 1)
