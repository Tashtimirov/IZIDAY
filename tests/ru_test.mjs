// Версия для других (dist/MyDay-RU.js): рубли, русские категории, без личных кнопок
import fs from "fs"
const path = new URL("../dist/MyDay-RU.js", import.meta.url)
const NOW = new Date(2026, 9, 23, 14, 0)
const RealDate = Date
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW) } static now() { return NOW.getTime() } }
const src = fs.readFileSync(path, "utf8").replace(/\/\/ ───────────── Запуск[\s\S]*$/, "")
class Color { constructor(h) { this.hex = h } static dynamic(a) { return a } }
class DateFormatter { set dateFormat(p) {} string(d) { return d.toISOString() } }
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: () => true, createDirectory() {}, isFileStoredIniCloud: () => false, readString: () => "[]", writeString() {} }
const g = { Color, DateFormatter, URLScheme: { forRunningScript: () => "x" }, FileManager: { iCloud: () => fmo, local: () => fmo }, Keychain: { contains: () => false } }
const app = await new Function(...Object.keys(g), "return (async()=>{" + src +
  "; return { buildActions, splitCommands, normalizeSpeech, money, headerButtons, agentSystem, CONFIG } })()")(...Object.values(g))
let fail = 0
const check = (name, ok, got) => { console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + JSON.stringify(got)}`); if (!ok) fail++ }
const act = t => app.buildActions(app.splitCommands(app.normalizeSpeech(t)))
const one = (t, kind, amount, category) => {
  const a = act(t).find(x => x.kind === kind)
  check(`«${t}»`, a && a.amount === amount && a.category === category && !/руб|₽/.test(a.comment || ""), a)
}
one("потратил 500 рублей в пятёрочке картой", "expense", 500, "Еда и продукты")
one("пиво в магните 320 рублей наличными", "expense", 320, "Еда и продукты")
one("такси яндекс го 410 руб переводом", "expense", 410, "Транспорт")
one("заказал на вайлдберриз на 2 тысячи картой", "expense", 2000, "Покупки")
one("оплатил квартплату 6800 переводом", "expense", 6800, "Жильё")
one("получил зарплату 85000", "income", 85000, "Зарплата")
check("сумма в рублях", app.money(1234.5).replace(/\u00a0/g, " ") === "1 234,50 ₽", app.money(1234.5))
check("кнопки: таблица не подключена", app.headerButtons().map(b => b[2]).join(",") === "voice,camera,money,note" && app.headerButtons()[2][0] === "rublesign", app.headerButtons())
const sys = app.agentSystem()
check("ассистент: рубли, без чужих календарей", /в рублях/.test(sys) && !/бат|PTP|Семейная/.test(sys))
console.log(fail ? `RU_FAIL ${fail}` : "RU_OK")
process.exit(fail ? 1 : 0)
