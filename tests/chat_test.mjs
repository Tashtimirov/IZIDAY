// Чат с помощником (личная версия): маршруты в Claude Code, ссылка на сессию, контекст чата, кнопки, сводки
import fs from "fs"
const load = file => fs.readFileSync(new URL(file, import.meta.url), "utf8").replace(/\/\/ ───────────── Запуск[\s\S]*$/, "")
class Color { constructor(h) { this.hex = h } static dynamic(a) { return a } }
class DateFormatter { set dateFormat(p) {} string(d) { return "1 ноя 10:00" } }
const files = {}
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: p => p in files, createDirectory() {},
  writeString(p, t) { files[p] = t }, readString: p => files[p], isFileStoredIniCloud: () => false }
const keys = { "myday.anthropic.key": "k", "myday.routes": JSON.stringify([
  { name: "Личное", hint: "личные дела", url: "https://api.anthropic.com/v1/claude_code/routines/trig_1/fire", token: "sk-ant-oat01-x" },
  { name: "Работа: PTP", hint: "работа", url: "https://api.anthropic.com/v1/claude_code/routines/trig_2/fire", token: "sk-ant-oat01-y" }]) }
const sent = []; let n = 0
class Request { constructor(u) { this.url = u } async loadJSON() {
  sent.push({ url: this.url, headers: this.headers, body: JSON.parse(this.body) })
  if (/routines/.test(this.url)) return { type: "routine_fire", claude_code_session_id: "s1", claude_code_session_url: "https://claude.ai/code/session_1" }
  n++
  if (n === 1) return { content: [{ type: "tool_use", id: "t1", name: "claude_code", input: { route: "Личное", task: "Подобрать отель в Пхукете" } }], stop_reason: "tool_use" }
  return { content: [{ type: "text", text: "Передал в «Личное»." }], stop_reason: "end_turn" } } }
const notes = []
class Notification { constructor() { notes.push(this) } setDailyTrigger(h, m, r) { this.daily = [h, m, r] } async schedule() {} static removePending() {} }
const g = { Color, DateFormatter, Request, Notification, URLScheme: { forRunningScript: () => "scriptable:///run/MyDay" }, FileManager: { iCloud: () => fmo, local: () => fmo },
  Keychain: { contains: k => k in keys, get: k => keys[k], set: (k, v) => { keys[k] = v } } }
const run = src => new Function(...Object.keys(g), "return (async()=>{" + src + "; return { chatReply, chatContext, chatSystem, chatTools, headerButtons, scheduleBriefs, chatHTML, CONFIG, loadJSON }})()")(...Object.values(g))
const app = await run(load("../src/iphone/MyDay.js"))
let ok = true
const check = (c, msg) => { console.log((c ? "✓ " : "✗ ") + msg); ok = ok && c }

const tools = app.chatTools().map(t => t.name)
check(tools.includes("claude_code") && app.chatTools().find(t => t.name === "claude_code").input_schema.properties.route.enum.length === 2, "маршруты попадают в инструмент claude_code")
check(/claude_code/.test(app.chatSystem()) && /друг/.test(app.chatSystem()) && !/В конце ответь/.test(app.chatSystem()), "system помощника: друг, передача задач, без лимита 1–4 строки")

const hist = []
const r = await app.chatReply(hist, { role: "user", text: "Найди мне отель на выходные", at: Date.now() })
const fire = sent.find(s => /routines/.test(s.url))
check(fire && fire.url.includes("trig_1") && fire.headers.Authorization === "Bearer sk-ant-oat01-x" && fire.body.text === "Подобрать отель в Пхукете", "задача уходит в нужный маршрут с токеном")
check(r.text === "Передал в «Личное»." && r.links[0] === "https://claude.ai/code/session_1", "ответ со ссылкой на сессию")
check(JSON.parse(files["/d/my-day/chat.json"]).length === 2, "переписка сохраняется")

const ctx = app.chatContext([{ role: "assistant", text: "привет" }, { role: "user", text: "а" }, { role: "user", text: "б", prompt: "ПРОМПТ" }, { role: "assistant", text: "в" }])
check(ctx.length === 2 && ctx[0].role === "user" && /а\n\n\[.*\] ПРОМПТ/.test(ctx[0].content), "контекст: начинается с пользователя, подряд идущие склеены, у сводки — полный промпт")

check(app.headerButtons().some(b => b[2] === "chat") && !app.headerButtons().some(b => b[2] === "note"), "в шапке 💬 вместо ✎")
await app.scheduleBriefs()
check(notes.length === 2 && notes[0].daily.join() === "8,0,true" && notes[1].daily.join() === "21,0,true" && /action=brief&kind=evening/.test(notes[1].openURL), "сводки: каждый день в 8:00 и 21:00, открывают чат")

const html = app.chatHTML([{ role: "user", text: "<b>x</b>", time: "10:00" }])
const script = html.match(/<script>([\s\S]*)<\/script>/)[1]
try { new Function(script); check(true, "скрипт страницы чата без синтаксических ошибок") } catch (e) { check(false, "скрипт чата: " + e) }

// версии для других: заметки остаются, чата нет
if (fs.existsSync(new URL("../dist/MyDay-TH.js", import.meta.url))) {
  notes.length = 0
  const th = await run(load("../dist/MyDay-TH.js"))
  check(th.headerButtons().some(b => b[2] === "note") && !th.headerButtons().some(b => b[2] === "chat"), "версия для других: ✎ заметки на месте")
  await th.scheduleBriefs(); check(notes.length === 0, "версия для других: без сводок")
}
console.log(ok ? "CHAT_OK" : "FAIL")
