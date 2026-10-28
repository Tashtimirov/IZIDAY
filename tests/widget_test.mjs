// Виджет всех размеров строится за один запрос к календарю и одно чтение каждого файла;
// запуск из виджета: сначала окно, потом выгрузка в таблицу, после операции — экран «Домой»
import fs from "fs"
const NOW = new Date(2026, 9, 22, 20, 0)
const RealDate = Date
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW) } static now() { return NOW.getTime() } }
const full = fs.readFileSync(new URL("../src/iphone/MyDay.js", import.meta.url), "utf8")
const src = full.replace(/\/\/ ───────────── Запуск[\s\S]*$/, "")
const launch = full.slice(full.indexOf("// ───────────── Запуск"))
const z = n => String(n).padStart(2, "0")
class Color { constructor(h) { this.hex = h } static dynamic(a) { return a } static white() { return new Color("#fff") } }
class DateFormatter { set dateFormat(p) { this.p = p } string(d) { return `${z(d.getDate())}.${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}` } }
const at = (d, h) => new RealDate(2026, 9, d, h)
const files = {
  "/d/my-day/finance.json": JSON.stringify([{ id: "a", date: NOW.getTime() - 864e5, type: "expense", amount: 150, method: "cash", category: "Транспорт" }]),
  "/d/my-day/food.json": JSON.stringify([{ id: "m1", date: NOW.getTime() - 3600e3, kcal: 500, protein: 20 }]),
  "/d/my-day/settings.json": JSON.stringify({ sheetHook: "https://script.google.com/x/exec", sheetSigAll: "старое" }),
}
const reads = {}
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: p => p in files || p === "/d/my-day",
  createDirectory() {}, isFileStoredIniCloud: () => false, modificationDate: () => NOW,
  readString: p => { reads[p] = (reads[p] || 0) + 1; return files[p] }, writeString: (p, s) => { files[p] = s } }
const store = [
  { title: "Созвон", startDate: at(22, 21), endDate: at(22, 22), calendar: { title: "Работа" } },
  { title: "Йога", startDate: at(24, 8), endDate: at(24, 9), calendar: { title: "Личное" } },
  { title: "Падел", startDate: at(28, 18), endDate: at(28, 19), calendar: { title: "Личное" } },
  { title: "Прошло", startDate: at(22, 9), endDate: at(22, 10), calendar: { title: "Личное" } },
]
let calQueries = 0
class CalendarEvent { static async between(a, b) { calQueries++; return store.filter(e => e.startDate < b && e.endDate > a) } }
class Reminder { static async allIncomplete() { return [{ title: "Купить хлеб", dueDate: at(23, 9) }] } }
// всё, что рисует виджет, — пустышки, которые принимают любые вызовы и свойства
const urls = [], texts = []
const stub = () => new Proxy(function () {}, {
  get: (t, k) => k === "then" ? undefined : k === "addText" ? (s => (texts.push(s), stub())) : k in t ? t[k] : (t[k] = stub()),
  set: (t, k, v) => { if (k === "url") urls.push(v); t[k] = v; return true },
  apply: () => stub(), construct: () => stub() })
const log = []
const g = { Color, DateFormatter, CalendarEvent, Reminder, URLScheme: { forRunningScript: () => "scriptable:///run/MyDay" },
  FileManager: { iCloud: () => fmo, local: () => fmo }, Keychain: { contains: k => k === "myday.home" },
  ListWidget: stub(), LinearGradient: stub(), Font: stub(), Size: stub(), SFSymbol: stub(), Point: stub(), DrawContext: stub(),
  Notification: class { async schedule() { log.push("уведомление") } setTriggerDate() {} },
  Safari: { open: u => log.push("открыто " + decodeURIComponent(u)) },
  Request: class { async loadJSON() { log.push("выгрузка в таблицу"); return { ok: true } } } }
let ok = true
const check = (cond, msg) => { console.log(cond ? "   ✓" : "   ✗", msg); ok = ok && cond }

const app = await new Function(...Object.keys(g), "return (async()=>{" + src + "; return { buildWidget, upcoming, getCalendar, weekDays, TEXT } })()")(...Object.values(g))
for (const [family, param] of [["small"], ["small", "здоровье"], ["medium"], ["medium", "неделя"], ["medium", "здоровье"], ["large"],
  ["accessoryInline"], ["accessoryCircular"], ["accessoryRectangular"]]) {
  calQueries = 0
  let err = null
  try { await app.buildWidget(family, param) } catch (e) { err = e }
  check(!err && calQueries === 1, `${family}${param ? " · " + param : ""}: построен, запросов к календарю: ${calQueries}${err ? " — " + err.stack : ""}`)
}
check(Object.values(reads).every(n => n === 1), "каждый файл прочитан с диска один раз: " + JSON.stringify(reads))
// большой виджет: в строке дней названия событий, а не их число («1 соб»)
store.push({ title: "Турнир по паделу", startDate: at(25, 18), endDate: at(25, 20), calendar: { title: "Личное" } },
  { title: "Ужин", startDate: at(25, 21), endDate: at(25, 22), calendar: { title: "Личное" } },
  { title: "Врач", startDate: at(26, 9), endDate: at(26, 10), calendar: { title: "Личное" } },
  { title: "Почта", startDate: at(26, 11), endDate: at(26, 12), calendar: { title: "Личное" } },
  { title: "Кино", startDate: at(26, 19), endDate: at(26, 21), calendar: { title: "Личное" } })
texts.length = 0
await app.buildWidget("large")
check(!texts.some(t => /\d+\s*соб|событи[еяй]\b/.test(String(t))) && texts.includes("Йога"), "большой виджет: у дня названия событий, не число: " + texts.filter(t => /соб|Йога/.test(String(t))).join(", "))
check(texts.includes("Турнир по паделу") && texts.includes("Ужин"), "два события в дне — оба названия")
check(texts.includes("Врач") && texts.includes("+2 ещё") && !texts.includes("Кино"), "три события — первое название и «+2 ещё»")
store.splice(-5)
const ev = app.upcoming(await app.getCalendar(app.weekDays())).map(e => e.title)
check(ev.join() === "Созвон,Йога", "ближайшие встречи — сегодня и 2 дня вперёд, без прошедших: " + ev.join())
check(urls.filter(u => typeof u === "string" && u.startsWith("scriptable")).every(u => u.includes("from=widget")), "все ссылки виджета помечены from=widget")

// запуск из виджета: кнопка 💧
const run = async query => {
  log.length = 0
  const args = { queryParameters: query }, config = { runsInWidget: false }, Script = { complete() {} }
  await new Function(...Object.keys(g), "args", "config", "Script", "info",
    "return (async()=>{" + src.replace("async function waterMenu() {", "async function waterMenu() { log.push('окно воды'); return;") + "\n" + launch + "})()")(
    ...Object.values(g), args, config, Script)
}
g.log = log
await run({ from: "widget", action: "water" })
check(log[0] === "окно воды", "окно открывается первым, до выгрузки: " + log.join(" → "))
check(log[1] === "открыто shortcuts://run-shortcut?name=Мой день - домой", "после операции — команда «Мой день - домой»")
check(log.includes("выгрузка в таблицу") && log.indexOf("выгрузка в таблицу") > 1, "выгрузка в таблицу после возврата")
await run({ action: "water" })
check(!log.some(x => x.startsWith("открыто")), "из уведомления и из приложения домой не уходим: " + log.join(" → "))

console.log(ok ? "\nWIDGET_OK" : "\nWIDGET_FAIL")
process.exit(ok ? 0 : 1)
