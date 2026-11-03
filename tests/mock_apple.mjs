// Веб-приложение в настоящем браузере (Chromium, экран iPhone): подключение кодом, календарь от виджета,
// очередь команд, вода и деньги через таблицу, помощник с инструментами и подтверждением. Снимки — build/web-shots/
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")   // Playwright установлен глобально
import http from "http"
import fs from "fs"
import path from "path"
import { sheetScript } from "./fake_sheet.mjs"

const ROOT = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]).replace(/\/$/, "/index.html"))
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end() }
  const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" }[path.extname(p)]
  res.writeHead(200, { "content-type": (type || "text/plain") + "; charset=utf-8" }); fs.createReadStream(p).pipe(res)
}).listen(0)
const BASE = `http://localhost:${server.address().port}/`

const sheet = sheetScript()
const SECRET = "s".repeat(32), HOOK = "https://script.google.com/macros/s/TEST/exec"
const z = n => String(n).padStart(2, "0")
const now = new Date(), day = (d, h, m = 0) => { const x = new Date(now); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x }
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
// виджет уже прислал снимок iPhone и свои записи
sheet.post({ secret: SECRET, hub: { from: "widget", since: 0,
  lists: { money: [{ id: "f1", date: Date.now() - 3600e3, u: Date.now() - 3600e3, type: "expense", amount: 450, method: "cash", category: "Транспорт", comment: "такси" }],
           water: [{ id: "w1", date: Date.now() - 1800e3, u: Date.now() - 1800e3, ml: 250 }],
           food: [{ id: "m1", date: Math.max(Date.now() - 7200e3, new Date().setHours(0, 1, 0, 0)), u: Date.now() - 7200e3, title: "Омлет с тостом", kcal: 420, protein: 24, fat: 22, carbs: 30 }], workouts: [] },
  snap: { events: [
      { id: "E1", title: "Созвон с командой", start: iso(day(0, 23, 0)), end: iso(day(0, 23, 30)), calendar: "Работа", color: "#2E6B57", all_day: false, location: "", repeats: false },
      { id: "E2", title: "Падел", start: iso(day(1, 19)), end: iso(day(1, 21)), calendar: "Личное", color: "#0FA89C", all_day: false, location: "Padel Club", repeats: true }],
    reminders: [{ id: "R1", title: "Купить цветы", due: iso(day(0, 22)), completed: false, list: "Напоминания" }, { id: "R2", title: "Оплатить интернет", due: null, completed: false, list: "Дом" }],
    calendars: ["Личное", "Работа"], lists: ["Напоминания", "Дом"],
    watch: { day: iso(now).slice(0, 10), steps: 8421, active: 380, exercise: 24, updated: Date.now() - 600e3 } } } })

const setup = Buffer.from(JSON.stringify({ v: 1, hook: HOOK, secret: SECRET, key: "sk-test", routes: [{ name: "Личное", hint: "личные задачи", url: "https://api.anthropic.com/v1/claude_code/routines/trig_x/fire", token: "t" }],
  sheetUrl: "https://docs.google.com/spreadsheets/d/T/edit", run: "scriptable:///run/MyDay",
  cfg: { currency: "฿", currencyIn: "в батах", agentModel: "claude-sonnet-5-5", health: { waterGoal: 2000, glass: 250, moveGoal: 500, exerciseGoal: 30, weight: 92 },
    categories: { expense: [["Транспорт", ["такси"]], ["Кафе и рестораны", ["кафе"]], ["Другое", []]], income: [["Зарплата", ["зарплат"]], ["Другое", []]] },
    calendars: [{ calendar: "Работа", list: "Работа", hint: "«рабочий»" }] } }), "utf8").toString("base64")

// ответы Claude по очереди: [{content, stop_reason}]
const claudeQueue = [], claudeSeen = []
let ok = true
const check = (cond, msg, got) => { console.log(cond ? "   ✓" : "   ✗", msg, cond ? "" : JSON.stringify(got)); ok = ok && !!cond }
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU" })
const page = await ctx.newPage()
const errors = []
page.on("pageerror", e => errors.push(String(e)))
page.on("console", m => { if (m.type() === "error") errors.push(m.text()) })
await page.route("https://script.google.com/**", async route => {
  const body = route.request().postData()
  await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(sheet.post(body)) })
})
await page.route("https://api.anthropic.com/**", async route => {
  const req = route.request()
  if (req.method() === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } })
  const body = JSON.parse(req.postData())
  if (body.model === "claude-haiku-5-5") {   // фоновая память: сводка разговора
    memSeen.push(body)
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ summary: "Обсуждали такси и падел; падел на завтра удалён.", facts: ["Играет в падел по вторникам"], outdated: [] }) }], stop_reason: "end_turn" }) })
  }
  if (/Сейчас ты сам, без запроса/.test(body.system || "")) {   // утренний план дня в фоне
    planSeen.push(body)
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ content: [{ type: "text", text: "План на день готов." }], stop_reason: "end_turn" }) })
  }
  claudeSeen.push({ body, headers: req.headers() })
  const next = claudeQueue.shift() || { content: [{ type: "text", text: "Готово." }], stop_reason: "end_turn" }
  await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(next) })
})
const memSeen = [], planSeen = []
const hubState = () => sheet.post({ secret: SECRET, hub: { from: "app", since: 0 } })
const settle = () => page.waitForTimeout(1600)

// 1. подключение кодом из виджета
await page.goto(BASE + "#setup=" + encodeURIComponent(setup))
await settle()
check(!(await page.evaluate(() => location.hash)), "код подключения убран из адреса")
const sub = await page.textContent("#top-sub")
check(/iPhone: (только что|\d+ мин)/.test(sub), "шапка: календарь от виджета получен", sub)
const todayText = await page.textContent("#view")
check(todayText.includes("Созвон с командой") && todayText.includes("Купить цветы") && todayText.includes("Оплатить интернет"), "сегодня: событие и напоминания iPhone", todayText.slice(0, 300))
check(/−450/.test(todayText) && /0,25 л/.test(todayText), "за день: деньги и вода виджета", todayText.match(/За день.*/)?.[0])
await page.screenshot({ path: SHOTS + "1-today.png", fullPage: true })


// ── Макет: тот же экран в текущем стиле и в стиле Apple (светлая и тёмная тема) ──
const OUT = "/mnt/project-files/mockups/apple/"
fs.mkdirSync(OUT, { recursive: true })
const CSS = ""
await page.evaluate(() => { D.chat = [{ role: "user", text: "что у меня сегодня?", at: Date.now() - 60e3 }, { role: "assistant", text: "Сегодня в 23:00 созвон с командой, а до вечера — купить цветы.\nВоды пока 0,25 л из 2 — налить стакан?", at: Date.now() - 50e3 }]; save(false) })
for (const [scheme, sfx] of [["light", "light"], ["dark", "dark"]]) {
  await page.emulateMedia({ colorScheme: scheme })
  await page.evaluate(() => setTab("today")); await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}0-now-today-${sfx}.png` })
  const tag = await page.addStyleTag({ content: CSS })
  for (const t of ["today", "chat", "health", "money"]) { await page.evaluate(t => setTab(t), t); await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}${t}-${sfx}.png` }) }
  await tag.evaluate(el => el.remove())
}
await browser.close(); server.close()
console.log("MOCK_OK")
process.exit(0)
