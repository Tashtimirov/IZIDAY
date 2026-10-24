// Автозапись в Google Таблицу (версия для других): свой ключ, еда/вода/активность, ссылка на таблицу, без лишних отправок
import fs from "fs"
const NOW = new Date(2026, 9, 23, 14, 0)
const RealDate = Date
let clock = NOW.getTime()
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(clock) } static now() { return clock } }
const src = fs.readFileSync(new URL("../dist/MyDay-RU.js", import.meta.url), "utf8").replace(/\/\/ ───────────── Запуск[\s\S]*$/, "")
class Color { constructor(h) { this.hex = h } static dynamic(a) { return a } }
class DateFormatter { set dateFormat(p) {} string(d) { return "" } }
const files = {}
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: p => p in files || p === "/d/my-day",
  createDirectory() {}, isFileStoredIniCloud: () => false, readString: p => files[p], writeString: (p, s) => { files[p] = s } }
const sent = []
class Request { constructor(url) { this.url = url } async loadJSON() { sent.push(JSON.parse(this.body)); return { ok: true, added: 1, removed: 0, url: "https://docs.google.com/spreadsheets/d/XYZ/edit", sheets: { "Еда и активность": 777 } } } }
const g = { Color, DateFormatter, Request, URLScheme: { forRunningScript: () => "x" }, FileManager: { iCloud: () => fmo, local: () => fmo },
  Keychain: { contains: () => false }, Script: { setShortcutOutput() {} } }
const app = await new Function(...Object.keys(g), "return (async()=>{" + src +
  "; return { syncSheet, autoSyncSheet, saveSettings, loadSettings, addFood, addWater, receiveHealth, saveMoney, sheetUrlOf, sheetTabUrl, headerButtons, setUrl: u => { SHEET_URL = u } } })()")(...Object.values(g))
let fail = 0
const check = (name, ok, got) => { console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + JSON.stringify(got)}`); if (!ok) fail++ }

check("без подключения ничего не шлёт", (await app.syncSheet(true)) === null && sent.length === 0)
await app.saveSettings({ sheetHook: "https://script.google.com/macros/s/abc/exec", sheetUrl: "" })
await app.addFood({ title: "Плов", kcal: 650, protein: 20, fat: 25, carbs: 80 }); clock += 1000
await app.addWater(250); clock += 1000
await app.receiveHealth({ steps: "7 500", active: "410" })
check("активность сразу уходит в таблицу", sent.length === 1, sent.length)
const b = sent[0]
check("свой ключ на 32 знака", /^[a-z0-9]{32}$/.test(b.secret), b.secret)
check("еда, вода, активность", b.food.length === 1 && b.food[0].kcal === 650 && b.water[0].ml === 250 &&
  b.health[0].steps === 7500 && b.health[0].day === "2026-10-23", b)
let st = await app.loadSettings()
check("ключ запомнен", st.sheetSecret === b.secret)
check("калории ведут на лист «Еда и активность»", app.sheetTabUrl(st, "Еда и активность") === "https://docs.google.com/spreadsheets/d/XYZ/edit#gid=777", app.sheetTabUrl(st, "Еда и активность"))
check("ссылка на таблицу пришла от таблицы", app.sheetUrlOf(st) === "https://docs.google.com/spreadsheets/d/XYZ/edit", st.sheetUrl)
await app.autoSyncSheet()
check("без изменений повторно не шлёт", sent.length === 1, sent.length)
clock += 1000
await app.saveMoney([{ id: "f1", date: clock, u: clock, type: "expense", amount: 500, method: "transfer", category: "Еда и продукты", comment: "Пятёрочка" }])
check("расход уходит сразу, с тем же ключом", sent.length === 2 && sent[1].entries.length === 1 && sent[1].secret === b.secret, sent.length)
clock += 1000
await app.addWater(300)
await app.autoSyncSheet()
check("новая вода — догоняющая выгрузка", sent.length === 3 && sent[2].water.length === 2, sent.length)
app.setUrl(app.sheetUrlOf(st))
check("кнопка ▦ появилась", app.headerButtons().some(x => x[2] === "sheet"))
console.log(fail ? `SHEET_FAIL ${fail}` : "SHEET_OK")
process.exit(fail ? 1 : 0)
