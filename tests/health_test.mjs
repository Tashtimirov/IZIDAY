// Еда, вода и данные Apple Watch: разбор параметра Быстрой команды, хранение, инструменты Claude, отрисовка
import fs from "fs"
const NOW = new Date(2026, 9, 23, 14, 0)
const RealDate = Date
let clock = NOW.getTime()
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(clock) } static now() { return clock } }
const src = fs.readFileSync(new URL("../src/iphone/MyDay.js", import.meta.url), "utf8").replace(/\/\/ ───────────── Запуск[\s\S]*$/, "")
class Color { constructor(h) { this.hex = h } static dynamic(a) { return a } }
const z = n => String(n).padStart(2, "0")
class DateFormatter { set dateFormat(p) {} string(d) { return `${z(d.getHours())}:${z(d.getMinutes())}` } }
const files = {}
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: p => p in files || p === "/d/my-day",
  createDirectory() {}, isFileStoredIniCloud: () => false, readString: p => files[p], writeString: (p, s) => { files[p] = s } }
// Любой элемент виджета: принимает любые свойства и вызовы, считает созданные тексты
const texts = []
const el = () => new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === "addText" ? s => { texts.push(s); return el() } : () => el()), set: (t, k, v) => { t[k] = v; return true } })
let output = null
const g = { Color, DateFormatter, URLScheme: { forRunningScript: () => "x" }, FileManager: { iCloud: () => fmo, local: () => fmo },
  Keychain: { contains: () => false }, Size: class { constructor(w, h) { this.width = w; this.height = h } }, Font: new Proxy({}, { get: () => () => ({}) }),
  SFSymbol: { named: () => ({ image: {} }) }, Script: { setShortcutOutput: s => { output = s } } }
const app = await new Function(...Object.keys(g), "return (async()=>{" + src +
  "; return { parseHealth, receiveHealth, addFood, addWater, dayHealth, runTool, healthStrip, healthPanel, liters, saveFood } })()")(...Object.values(g))

let fail = 0
const check = (name, ok, got) => { console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + JSON.stringify(got)}`); if (!ok) fail++ }

// 1. Параметр из Быстрых команд: русские ключи, числа строками с запятой и пробелами
let h = app.parseHealth({ "Шаги": "6 512", "Активные": "423,7", "exercise": 28, "HR": "58", "Сон": "7,25" })
check("словарь из команды", h && h.steps === 6512 && h.active === 423.7 && h.exercise === 28 && h.hr === 58 && h.sleep === 7.25, h)
check("несколько строк — сумма", app.parseHealth({ steps: "8327\n0", active: "412,5 ккал\n" }).steps === 8327 &&
  app.parseHealth({ steps: "8327\n0", active: "412,5 ккал\n" }).active === 412.5, app.parseHealth({ steps: "8327\n0", active: "412,5 ккал\n" }))
check("JSON-строка", app.parseHealth('{"steps": 100, "active": 5}').steps === 100)
h = app.parseHealth({ steps: 5000, active: ["120,5", "80"], exercise: { value: "12" }, hr: "" })
check("список и объект", h.active === 200.5 && h.exercise === 12 && h.hr === 0, h)
await app.receiveHealth({ steps: 5000, active: "нет данных", exercise: "" })
check("сообщает, что не понял", /Не понял: active = «"нет данных"»/.test(output), output)
check("мусор не принимается", app.parseHealth("привет") === null && app.parseHealth({ foo: 1 }) === null)
await app.receiveHealth({ steps: "8000", active: "350" })
check("сохранено из команды", /сохранено/.test(output) && /8 000 шагов, 350 ккал/.test(output) && JSON.parse(files["/d/my-day/health.json"]).steps === 8000, output)

// 2. Еда и вода за сегодня
await app.addFood({ title: "Том ям", kcal: 420.4, protein: 25, fat: 18, carbs: 30 })
clock += 60000
await app.addWater(250); clock += 60000; await app.addWater(500); clock += 60000
let d = await app.dayHealth()
check("калории и БЖУ", d.kcal === 420 && d.protein === 25 && d.food.length === 1, d)
check("вода", d.water === 750 && app.liters(d.water) === "0,75 л", d.water)
check("активность сегодня", d.act && d.act.active === 350, d.act)

// 3. Вчерашние записи и вчерашние данные часов не попадают в сегодня
clock = NOW.getTime() + 864e5
d = await app.dayHealth()
check("новый день — с нуля", d.kcal === 0 && d.water === 0 && d.act === null, d)
clock = NOW.getTime() + 3 * 60000

// 4. Инструменты для Claude
check("add_food", (await app.runTool("add_food", { title: "Кофе с молоком", kcal: 120 })).ok)
check("add_food без калорий — ошибка", !!(await app.runTool("add_food", { title: "Вода" })).error)
check("add_water", (await app.runTool("add_water", { ml: 250 })).ok)
const gh = await app.runTool("get_health", {})
check("get_health", gh.eaten_kcal === 540 && gh.water_ml === 1000 && gh.meals.length === 2 && gh.watch.steps === 8000, gh)

// 5. Отрисовка: полоса в большом виджете и панель «здоровье»
d = await app.dayHealth()
texts.length = 0; app.healthStrip(el(), d)
check("полоса в виджете", texts.includes("540 ккал") && texts.some(t => /1 л \/ 2 л/.test(t)) && texts.some(t => /350 ккал · 8 000 ш\./.test(t)), texts)
texts.length = 0; app.healthPanel(el(), d, false)
check("панель среднего виджета", texts.includes("540") && texts.includes("350") && texts.some(t => /8 000/.test(t)), texts)
texts.length = 0; app.healthPanel(el(), Object.assign({}, d, { act: null }), false)
check("без часов", texts.includes("Нет данных с часов"), texts)

console.log(fail ? `\nОШИБОК: ${fail}` : "\nHEALTH_OK")
process.exit(fail ? 1 : 0)
