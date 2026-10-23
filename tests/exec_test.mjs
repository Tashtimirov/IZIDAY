import fs from "fs"
const NOW = new Date(2026, 9, 22, 20, 0)
const RealDate = Date
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW) } static now() { return NOW.getTime() } }
const src = fs.readFileSync(new URL("../src/iphone/MyDay.js", import.meta.url), "utf8").replace(/\/\/ ───────────── Запуск[\s\S]*$/, "")
class Color { constructor(h) { this.hex = h } static dynamic(a) { return a } static white() { return new Color("#fff") } }
const W = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"], z = n => String(n).padStart(2, "0")
class DateFormatter { set dateFormat(p) { this.p = p } string(d) { return this.p === "HH:mm" ? `${z(d.getHours())}:${z(d.getMinutes())}` : `${W[d.getDay()]} ${z(d.getDate())}.${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}` } }
const files = { "/d/my-day/finance.json": JSON.stringify([
  { id: "a", date: NOW.getTime() - 864e5, type: "expense", amount: 150, method: "cash", category: "Транспорт", comment: "такси" },
  { id: "b", date: NOW.getTime() - 2 * 864e5, type: "expense", amount: 220, method: "transfer", category: "Транспорт", comment: "грэб" },
  { id: "c", date: NOW.getTime() - 3 * 864e5, type: "expense", amount: 400, method: "cash", category: "Кафе и рестораны", comment: "кофе" }]) }
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: p => p in files || p === "/d/my-day",
  createDirectory() {}, isFileStoredIniCloud: () => false, readString: p => files[p], writeString: (p, s) => { files[p] = s } }
const at = (d, h, m = 0) => new RealDate(2026, 9, d, h, m)
const store = []
const ev = (id, title, s, e) => ({ identifier: id, title, startDate: s, endDate: e, isAllDay: false, saves: 0, save() { this.saves++ } })
for (const d of [16, 23, 30]) store.push(ev("DATE", "Свидание ❤️", at(d, 18), at(d, 20)))
store.push(ev("CALL", "Созвон с Кириллом", at(23, 10), at(23, 12)))
store.push(ev("YOGA", "Йога", at(26, 8), at(26, 9)))
const rems = [{ identifier: "R1", title: "Купить хлеб", dueDate: at(23, 9), dueDateIncludesTime: true, isCompleted: false, save() {} },
              { identifier: "R2", title: "Позвонить маме", dueDate: null, isCompleted: false, save() {} }]
class CalendarEvent { static async between(a, b) { return store.filter(e => e.startDate < b && e.endDate > a) } }
class Reminder { static async allIncomplete() { return rems.filter(r => !r.isCompleted) } }
const answers = [], shown = []
class Alert { constructor() { this.actions = [] } addAction(a) { this.actions.push(a) } addCancelAction() {} addDestructiveAction(a) { this.actions.push(a) } addTextField() { return { setDecimalPadKeyboard() {} } }
  async presentAlert() { const want = answers.shift(); shown.push(`${this.title} | ${String(this.message || "").replace(/\n/g, " ⏎ ")}`)
    console.log(`   [окно] ${this.title}${this.message ? " — " + String(this.message).split("\n\n🎤")[0].replace(/\n/g, " ⏎ ") : ""}${this.actions.length > 1 ? " | " + this.actions.join(" / ") : ""} → ${want ?? "OK"}`)
    const i = this.actions.indexOf(want); return want === undefined ? 0 : i } async presentSheet() { return this.presentAlert() } textFieldValue() { return "" } }
const g = { Color, DateFormatter, CalendarEvent, Reminder, Alert, URLScheme: { forRunningScript: () => "x" },
  FileManager: { iCloud: () => fmo, local: () => fmo }, Keychain: { contains: () => false }, Request: class { async loadJSON() { return { ok: true } } },
  DatePicker: class { async pickDateAndTime() { return at(23, 21) } } }
const app = await new Function(...Object.keys(g), "return (async()=>{" + src + "; return { voiceCommand } })()")(...Object.values(g))
const show = id => store.filter(e => e.identifier === id).map(e => `${e.startDate.getDate()}.10 ${z(e.startDate.getHours())}:${z(e.startDate.getMinutes())}–${z(e.endDate.getHours())}:${z(e.endDate.getMinutes())}`).join(", ")
let ok = true
const check = (cond, msg) => { console.log(cond ? "   ✓" : "   ✗", msg); ok = ok && cond }

console.log("🎤 Перенеси свидание завтрашнее с 6 вечера на 8")
answers.push("Сохранить")
await app.voiceCommand("Перенеси свидание завтрашнее с 6 вечера на 8")
check(show("DATE") === "16.10 18:00–20:00, 23.10 20:00–22:00, 30.10 18:00–20:00", "перенесено только 23-е: " + show("DATE"))

console.log("🎤 перенеси свидание   (без времени → уточнение)")
answers.push("Свидание ❤️ · пт 30.10 18:00".replace("пт 30.10 18:00", "Пт, пт 30.10 18:00, 18:00"), "На час позже", "Сохранить")
// варианты выбора — проверим по фактическому списку
answers.length = 0
answers.push(undefined)
const origPush = answers.push
await (async () => {
  answers.length = 0
  // 1-е окно: выбор из двух свиданий (23 и 30) → берём второе по индексу через подмену
  const A = g.Alert.prototype.presentAlert
  let n = 0
  g.Alert.prototype.presentAlert = async function () { n++; const r = n === 1 ? 1 : n === 2 ? 0 : 0
    console.log(`   [окно] ${this.title} | ${this.actions.join(" / ")} → ${this.actions[r]}`); return r }
  await app.voiceCommand("перенеси свидание")
  g.Alert.prototype.presentAlert = A
})()
check(show("DATE").includes("30.10 19:00–21:00"), "30-е сдвинуто на час позже: " + show("DATE"))

console.log("🎤 сдвинь йогу на полчаса раньше")
answers.push("Сохранить")
await app.voiceCommand("сдвинь йогу на полчаса раньше")
check(show("YOGA") === "26.10 07:30–08:30", "йога: " + show("YOGA"))

console.log("🎤 хлеб купил")
answers.push("Сохранить")
await app.voiceCommand("хлеб купил")
check(rems[0].isCompleted, "«Купить хлеб» выполнено")

console.log("🎤 что у меня завтра")
await app.voiceCommand("что у меня завтра")
check(shown.some(x => /Созвон с Кириллом/.test(x) && /Свидание/.test(x)), "показан список дел на завтра")

console.log("🎤 сколько ушло на такси")
await app.voiceCommand("сколько ушло на такси")
check(shown.some(x => /Транспорт/.test(x) && /370/.test(x)), "показана сумма по транспорту (150+220=370)")

console.log("🎤 когда у меня йога")
await app.voiceCommand("когда у меня йога")
check(shown.some(x => /^Йога/.test(x) && /07:30/.test(x)), "показано ближайшее занятие")

console.log(ok ? "\nEXEC_OK" : "\nEXEC_FAIL")
