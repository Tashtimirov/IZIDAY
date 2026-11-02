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
  claudeSeen.push({ body, headers: req.headers() })
  const next = claudeQueue.shift() || { content: [{ type: "text", text: "Готово." }], stop_reason: "end_turn" }
  await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(next) })
})
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

// 2. вода и отметка напоминания → таблица
await page.click('[data-do="water"]')
await page.click('[data-check="R1"]')
await settle()
let st = hubState()
check(st.lists.water.filter(w => !w.deleted).length === 2, "стакан воды дошёл до таблицы", st.lists.water)
check(st.ops.some(o => o.tool === "update_reminder" && o.input.id === "R1" && o.input.completed && o.state === "new"), "отметка напоминания — в очереди для виджета", st.ops)
check(!(await page.textContent("#view")).includes("Купить цветы"), "отмеченное напоминание скрыто сразу")

// 3. расход вручную
await page.click('[data-tab="money"]')
await page.click('[data-do="expense"]')
await page.fill("#m-amt", "1200")
await page.fill("#m-com", "ужин в кафе")
await page.click('#m-meth [data-m="transfer"]')
await page.click('.sheet [data-a="ok"]')
await settle()
st = hubState()
check(st.lists.money.some(m => m.amount === 1200 && m.category === "Кафе и рестораны" && m.method === "transfer"), "расход с категорией по словам ушёл в таблицу", st.lists.money)
check(sheet.ss.getSheetByName("Операции").getLastRow() === 3, "…и в лист «Операции»")
await page.screenshot({ path: SHOTS + "2-money.png", fullPage: true })

// 4. помощник: записать расход инструментом
claudeQueue.push({ content: [{ type: "tool_use", id: "tu1", name: "add_money", input: { type: "expense", amount: 300, method: "cash", category: "Транспорт", comment: "такси" } }], stop_reason: "tool_use" },
  { content: [{ type: "text", text: "Записал −300 ฿ на такси наличными." }], stop_reason: "end_turn" })
await page.click('[data-tab="chat"]')
await page.fill("#chat-in", "потратил 300 на такси наличными")
await page.click(".chat-bar .send")
await page.waitForSelector("text=Записал −300", { timeout: 5000 }).catch(() => {})
const chat1 = await page.textContent("#chat-list")
check(chat1.includes("Записал −300"), "помощник ответил", chat1)
check(claudeSeen[0] && claudeSeen[0].headers["anthropic-dangerous-direct-browser-access"] === "true" && claudeSeen[0].headers["x-api-key"] === "sk-test", "запрос к Claude из браузера с ключом", claudeSeen[0] && claudeSeen[0].headers)
check(claudeSeen[0].body.tools.some(t => t.name === "claude_code") && /Транспорт/.test(claudeSeen[0].body.system) && /92 кг/.test(claudeSeen[0].body.system), "инструменты с маршрутом, категории и вес из виджета")
check(claudeSeen[1].body.messages.at(-1).content[0].type === "tool_result" && /"ok":true/.test(claudeSeen[1].body.messages.at(-1).content[0].content), "результат инструмента вернулся Claude")
await settle()
check(hubState().lists.money.some(m => m.amount === 300 && m.comment === "такси"), "расход от помощника в таблице")

// 5. помощник удаляет событие — подтверждение кнопками в чате
claudeQueue.push({ content: [{ type: "tool_use", id: "tu2", name: "get_events", input: { start: iso(day(1, 0)), end: iso(day(2, 0)), query: "падел" } }], stop_reason: "tool_use" },
  { content: [{ type: "tool_use", id: "tu3", name: "delete_event", input: { id: "E2", occurrence_start: iso(day(1, 19)) } }], stop_reason: "tool_use" },
  { content: [{ type: "text", text: "Удалю падел завтра — внесу при обновлении виджета." }], stop_reason: "end_turn" })
await page.fill("#chat-in", "убери завтрашний падел")
await page.click(".chat-bar .send")
await page.waitForSelector('[data-opt="Да"]', { timeout: 5000 }).catch(() => {})
await page.screenshot({ path: SHOTS + "3-chat-confirm.png", fullPage: true })
const ev = JSON.parse(claudeSeen.at(-1).body.messages.at(-1).content[0].content)
check(ev.events && ev.events[0].id === "E2" && ev.events[0].location === "Padel Club", "get_events отдаёт события из снимка", ev)
await page.click('[data-opt="Да"]')
await page.waitForSelector("text=Удалю падел", { timeout: 5000 }).catch(() => {})
await settle()
st = hubState()
check(st.ops.some(o => o.tool === "delete_event" && o.input.id === "E2"), "удаление — в очереди для виджета", st.ops)
await page.click('[data-tab="today"]')
await page.click(".week .day:nth-child(2)")
check(!(await page.textContent("#view")).includes("Падел"), "удалённое событие сразу пропало из дня")

// 6. виджет выполнил команды → приложение видит результат
sheet.post({ secret: SECRET, hub: { from: "widget", since: 0, done: st.ops.map(o => ({ id: o.id, result: { ok: true } })),
  snap: { events: [{ id: "E1", title: "Созвон с командой", start: iso(day(0, 23, 0)), end: iso(day(0, 23, 30)), calendar: "Работа" }],
    reminders: [{ id: "R2", title: "Оплатить интернет", due: null, completed: false }], watch: null } } })
await page.click("#sync")
await settle()
check(/iPhone: (только что|\d+ мин)/.test(await page.textContent("#top-sub")) && !/⏳/.test(await page.textContent("#top-sub")), "очередь пуста после виджета", await page.textContent("#top-sub"))

// 7. здоровье и «Ещё»
await page.click('[data-tab="health"]')
const hv = await page.textContent("#view")
check(hv.includes("Омлет с тостом") && /0,5 л/.test(hv), "здоровье: еда и вода", hv.slice(0, 200))
await page.screenshot({ path: SHOTS + "4-health.png", fullPage: true })
await page.click('[data-tab="more"]')
check((await page.textContent("#view")).includes("Последний обмен"), "«Ещё»: подключено")
await page.screenshot({ path: SHOTS + "5-more.png", fullPage: true })

// 8. действие из виджета: #water добавляет стакан
const before = hubState().lists.water.filter(w => !w.deleted).length
await page.goto(BASE + "#water")
await settle()
check(hubState().lists.water.filter(w => !w.deleted).length === before + 1, "ссылка виджета #water добавила стакан")
// тёмная тема
await page.emulateMedia({ colorScheme: "dark" })
await page.click('[data-tab="today"]')
await page.screenshot({ path: SHOTS + "6-today-dark.png", fullPage: true })

// место: сколько ехать и «напомни, когда буду рядом»
await ctx.grantPermissions(["geolocation"]); await ctx.setGeolocation({ latitude: 13.75, longitude: 100.5 })
const rt = await page.evaluate(() => runTool("route_to", { to: "Декатлон" }))
check(rt.minutes === 25 && rt.km === 12.3 && rt.place === "Decathlon Rama 4" && rt.from_location === "сейчас", "сколько ехать: минуты, км, ближайший филиал", rt)
const rn = await page.evaluate(() => runTool("remind_near", { title: "Заехать в Декатлон", query: "Decathlon" }))
check(rn.ok && rn.points.length === 1 && /Rama 4/.test(rn.points[0]), "напоминание по месту: только точки рядом (Чиангмай отброшен)", rn)
await page.waitForTimeout(1500)
const pl = hubState().lists.places || []
check(pl.some(p => p.title === "Заехать в Декатлон" && p.radius === 1500 && p.points.length === 1), "место ушло в таблицу для виджета", pl)
await page.click('[data-tab="today"]'); await page.click(".day:first-child")
const tv = await page.textContent("#view"); check(tv.includes("напомню рядом: Decathlon"), "на «Сегодня» видно напоминание по месту", tv.slice(0, 600))
const nf = await page.evaluate(() => runTool("remind_near", { title: "x", query: "нигде" }))
check(nf.error, "место не нашлось — просьба уточнить", nf)
check(!errors.length, "без ошибок в консоли", errors)
await browser.close(); server.close()
console.log(ok ? "\nWEB_OK" : "\nWEB_FAIL")
process.exit(ok ? 0 : 1)
