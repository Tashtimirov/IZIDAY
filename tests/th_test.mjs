// Версия для друзей в Таиланде (dist/MyDay-TH.js): баты, тайские категории, без личных кнопок
import fs from "fs"
const path = new URL("../dist/MyDay-TH.js", import.meta.url)
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
  check(`«${t}»`, a && a.amount === amount && a.category === category && !/бат|฿/.test(a.comment || ""), a)
}
one("потратил 300 бат в макро картой", "expense", 300, "Еда и продукты")
one("грэб 150 бат наличными", "expense", 150, "Транспорт")
one("заказал на лазаде на 2 тысячи картой", "expense", 2000, "Покупки")
one("продление визы 1900 переводом", "expense", 1900, "Визы и документы")
one("тайский массаж 400 наличными", "expense", 400, "Красота и массаж")
one("получил зарплату 85000", "income", 85000, "Зарплата")
check("сумма в батах", app.money(1234.5).replace(/\u00a0/g, " ") === "1 234,50 ฿", app.money(1234.5))
check("кнопки: таблица не подключена", app.headerButtons().map(b => b[2]).join(",") === "voice,camera,money,note" && app.headerButtons()[2][0] === "bahtsign", app.headerButtons())
const sys = app.agentSystem()
check("ассистент: баты, без чужих календарей", /в батах/.test(sys) && !/рубл|PTP|Семейная|Алкоголь/.test(sys))
console.log(fail ? `TH_FAIL ${fail}` : "TH_OK")
process.exit(fail ? 1 : 0)
