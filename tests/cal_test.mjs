import fs from "fs"
const NOW = new Date(2026, 9, 23, 13, 0)
const RD = Date
globalThis.Date = class extends RD { constructor(...a) { a.length ? super(...a) : super(NOW) } static now() { return NOW.getTime() } }
const src = fs.readFileSync(process.argv[2] || new URL("../src/iphone/MyDay.js", import.meta.url), "utf8").replace(/\/\/ ───────────── Запуск[\s\S]*$/, "")
class Color { constructor(h) { this.hex = h } static dynamic(a) { return a } static white() { return new Color("#fff") } }
const z = n => String(n).padStart(2, "0")
class DateFormatter { set dateFormat(p) {} string(d) { return `${z(d.getDate())}.${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}` } }
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: () => false, createDirectory() {}, isFileStoredIniCloud: () => false, readString: () => "[]", writeString() {} }
let CALS = [{ title: "realtashtimirov@gmail.com" }, { title: "Семейная группа" }, { title: "PTP" }]
const LISTS = [{ title: "Напоминания" }, { title: "Семья" }, { title: "Работа" }]
const saved = []
class CalendarEvent { constructor() { this.calendar = { title: "по умолчанию" } } addRecurrenceRule() {} save() { saved.push(`событие «${this.title}» → ${this.calendar.title}`) } }
class Reminder { constructor() { this.calendar = { title: "по умолчанию" } } addRecurrenceRule() {} save() { saved.push(`напоминание «${this.title}» → ${this.calendar.title}`) } }
const answers = []
class Alert { constructor() { this.actions = [] } addAction(a) { this.actions.push(a) } addCancelAction() {} addTextField() {}
  async presentAlert() { const w = answers.shift(); if (this.title !== "Сохранить?") console.log(`   [окно] ${this.title} | ${this.actions.join(" / ")} → ${w}`); return w === undefined ? 0 : this.actions.indexOf(w) } async presentSheet() { return this.presentAlert() } }
const g = { Color, DateFormatter, CalendarEvent, Reminder, Alert, URLScheme: { forRunningScript: () => "x" },
  FileManager: { iCloud: () => fmo, local: () => fmo }, Keychain: { contains: () => false }, Notification: class { schedule() {} setTriggerDate() {} },
  Calendar: { forEvents: async () => CALS, forReminders: async () => LISTS } }
const app = await new Function(...Object.keys(g), "return (async()=>{" + src + "; return { voiceCommand } })()")(...Object.values(g))
const cases = [
  ["добавь в семейный календарь ужин у мамы в субботу в 7", "событие «Ужин у мамы» → Семейная группа"],
  ["питипи созвон с командой в понедельник в 10", "событие «Созвон с командой» → PTP"],
  ["показ квартиры в пятницу в 14 календарь PTP", "событие «Показ квартиры» → PTP"],
  ["встреча с Олей завтра в 10", "событие «Встреча с Олей» → по умолчанию"],
  ["напомни в семейном календаре купить торт завтра", "напоминание «Купить торт» → Семья"],
  ["напомни в рабочий календарь отправить договор в 17", "напоминание «Отправить договор» → Работа"],
]
let ok = true
for (const [t, want] of cases) {
  saved.length = 0; answers.push("Сохранить")
  await app.voiceCommand(t)
  const got = saved.join("; ")
  console.log(got === want ? "✓" : "✗", t, "→", got || "(ничего)")
  ok = ok && got === want
}
console.log("— календаря PTP нет на устройстве:")
CALS = [{ title: "realtashtimirov@gmail.com" }, { title: "Семейная группа" }]
saved.length = 0; answers.push("realtashtimirov@gmail.com", "Сохранить")
await app.voiceCommand("питипи встреча с юристом завтра в 12")
console.log("  ", saved.join("; "))
ok = ok && saved[0] === "событие «Встреча с юристом» → realtashtimirov@gmail.com"
console.log(ok ? "CAL_OK" : "CAL_FAIL")
