// Быстрый ввод из Siri / кнопки «Действие»: Быстрая команда передаёт продиктованный текст в MyDay,
// помощник отвечает без окон, ответ возвращается в команду; переписка — в общем чате; окна не открываются
import fs from "fs"
const load = file => fs.readFileSync(new URL(file, import.meta.url), "utf8").replace(/\/\/ ───────────── Запуск[\s\S]*$/, "")
class Color { constructor(h) { this.hex = h } static dynamic(a) { return a } }
class DateFormatter { set dateFormat(p) {} string(d) { return "1 ноя 10:00" } }
const files = {}
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: p => p in files, createDirectory() {},
  writeString(p, t) { files[p] = t }, readString: p => files[p], isFileStoredIniCloud: () => false }
const keys = { "myday.anthropic.key": "k" }
const sent = []
let reply = { content: [{ type: "text", text: "Записал **расход**: такси 300 ฿." }], stop_reason: "end_turn" }
class Request { constructor(u) { this.url = u } async loadJSON() {
  const body = this.body ? JSON.parse(this.body) : null
  sent.push({ url: this.url, body })
  if (/anthropic\.com\/v1\/messages/.test(this.url)) return reply
  return {} } async loadString() { return "" } }
let alerts = 0
class Alert { constructor() { alerts++ } addAction() {} addCancelAction() {} addTextField() {} async presentAlert() { throw new Error("Alerts are not supported in Siri") } async presentSheet() { throw new Error("Alerts are not supported in Siri") } }
class Notification { async schedule() {} static removePending() {} static async allPending() { return [] } }
let output = null
const g = { Color, DateFormatter, Request, Alert, Notification, URLScheme: { forRunningScript: () => "scriptable:///run/MyDay" }, FileManager: { iCloud: () => fmo, local: () => fmo },
  Keychain: { contains: k => k in keys, get: k => keys[k], set: (k, v) => { keys[k] = v } }, config: { runsWithSiri: true, runsInWidget: false },
  Script: { setShortcutOutput: s => { output = s } }, args: {} }
const app = await new Function(...Object.keys(g), "return (async()=>{" + load("../src/iphone/MyDay.js") + "; return { quickText, quickAsk, ask, choose, loadJSON, CHAT_FILE, runTool, placesCheck }})()")(...Object.values(g))
let ok = true
const check = (c, msg, got) => { console.log((c ? "✓ " : "✗ ") + msg + (c ? "" : "  → " + JSON.stringify(got))); ok = ok && !!c }

check(app.quickText("потратил 300 на такси") === "потратил 300 на такси", "продиктованный текст — помощнику")
check(app.quickText({ q: "стакан воды" }) === "стакан воды" && app.quickText({ text: "x" }) === "x", "словарь с q / text — тоже")
check(app.quickText({ steps: 5000 }) === null && app.quickText('{"steps":1}') === null && app.quickText("  ") === null, "данные Здоровья — не сюда")

await app.quickAsk("потратил 300 на такси")
const ai = sent.find(s => /anthropic\.com\/v1\/messages/.test(s.url))
check(ai && JSON.stringify(ai.body.messages).includes("потратил 300 на такси"), "фраза ушла помощнику", sent.map(s => s.url))
check(output === "Записал расход: такси 300 ฿.", "ответ вернулся в Быструю команду, без разметки", output)
const hist = await app.loadJSON(app.CHAT_FILE)
check(hist.length === 2 && hist[0].text === "потратил 300 на такси" && hist[0].voice && hist[1].role === "assistant", "переписка сохранена в общем чате", hist)
check(await app.ask("t", "p") === null && await app.choose("t", ["a"]) === -1 && alerts === 0, "из Siri окна не открываются: вопросы молча отменяются")

reply = null
await app.quickAsk("второй раз")
check(/не получилось|ошибк/.test(output), "ошибка — понятный ответ, а не падение", output)
delete keys["myday.anthropic.key"]
await app.quickAsk("ещё")
check(/нужен ключ/.test(output), "без ключа помощника — подсказка, где его ввести", output)
// покупки и голодание из Siri (виджет)
let s = await app.runTool("add_shopping", { items: ["молоко", "хлеб", "Молоко"] })
check(s.ok && s.to_buy.join() === "молоко,хлеб", "виджет: покупки без повторов", s)
s = await app.runTool("shop_done", { items: ["молок"] })
check(s.to_buy.join() === "хлеб", "виджет: куплено", s)
const f = await app.runTool("start_fast", {})
check(f.ok && f.hours === 16 && (await app.runTool("start_fast", {})).error && (await app.runTool("stop_fast", {})).ok, "виджет: голодание старт/стоп", f)
const g1 = await app.runTool("add_goal", { kind: "wish", items: ["Прыгнуть с парашютом", "прыгнуть с парашютом"] })
const g2 = await app.runTool("add_goal", { kind: "dream", items: ["Дом"], due: "2099-01-01" }), gg = await app.runTool("get_goals", {})
check(g1.ok && g1.total === 1 && g2.ok && gg.wish.length === 1 && gg.dream[0].due < "2099", "виджет: желания и мечты из Siri", gg)
console.log(ok ? "QUICK_OK" : "QUICK_FAIL")
process.exit(ok ? 0 : 1)
