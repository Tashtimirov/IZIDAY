// Лимиты, регулярные платежи, привычки, вес и поиск в веб-приложении (Chromium, экран iPhone). Снимки — build/web-shots/f-*
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

const today = () => page.textContent("#view")
await page.goto(BASE + "#setup=" + encodeURIComponent(setup))
await settle(); await page.evaluate(() => sync()); await settle()
// 1. «Сегодня» без хвостов календаря iPhone
let t = await today()
check(!/Внести|Ждём календарь|Не внеслось/.test(t), "на «Сегодня» нет баннеров календаря iPhone", t.slice(0, 200))
check(/Обновлено/.test(await page.textContent("#top-sub")), "шапка: «Обновлено», а не «iPhone»", await page.textContent("#top-sub"))
check(t.includes("Привычки"), "карточка привычек на «Сегодня»")

// 2. привычки: добавить, отметить, серия, в таблицу
await page.click('[data-do="habits"]')
await page.fill("#h-t", "Зарядка"); await page.click('#h-e [data-e="💪"]'); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(300)
await page.fill("#h-t", "Без алкоголя"); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(300)
await page.click('.sheet [data-a="no"]'); await page.waitForTimeout(300)
const hs = await page.evaluate(() => habitList().map(h => ({ t: h.title, bad: !!h.bad, id: h.id })))
check(hs.length === 2 && hs[1].bad && !hs[0].bad, "две привычки, «без алкоголя» — бросаю (сама)", hs)
await page.evaluate(id => { const h = D.habits.find(x => x.id === id); habitToggle(h, addDays(new Date(), -1)); habitToggle(h, addDays(new Date(), -2)) }, hs[0].id)
await page.click(`[data-habit="${hs[0].id}"]`); await page.waitForTimeout(300)
check((await page.textContent(`[data-habit="${hs[0].id}"]`)).includes("3 дня подряд"), "серия 3 дня подряд", await page.textContent(`[data-habit="${hs[0].id}"]`))
await page.click(`[data-habit="${hs[0].id}"]`); await page.waitForTimeout(200)
check((await page.textContent(`[data-habit="${hs[0].id}"]`)).includes("2 дня подряд"), "снятие отметки за сегодня: серия до вчера")
await page.click(`[data-habit="${hs[0].id}"]`)
await page.evaluate(() => sync()); await settle()
let st = hubState()
check(st.lists.habits.length === 2 && st.lists.hlog.filter(x => !x.deleted).length === 3, "привычки и отметки дошли до таблицы", st.lists.hlog)

// 3. лимиты: форма, предупреждение при расходе
await page.click('[data-tab="money"]'); await page.waitForTimeout(300)
await page.click('[data-do="budgets"]')
await page.fill('.sheet [data-b="Транспорт"]', "1000"); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(300)
t = (await today()).replace(/\s/g, " ")
check(/450.{0,4}из 1 000/.test(t), "в «Куда ушли деньги» — 450 из 1 000", t.match(/Куда ушли.{0,120}/)?.[0])
await page.click('[data-do="expense"]'); await page.fill("#m-amt", "400"); await page.fill("#m-com", "такси"); await page.click('.sheet [data-a="ok"]')
await page.waitForTimeout(200)
check((await page.textContent("#toast")).includes("⚠️ Транспорт"), "тост предупреждает про лимит", await page.textContent("#toast"))
const r1 = await page.evaluate(() => runTool("add_money", { type: "expense", amount: 300, method: "cash", category: "Транспорт" }))
check(r1.budget && r1.budget.left === -150 && r1.budget.warn, "помощник видит превышение лимита", r1)
await page.evaluate(() => render())
check((await page.$$(".cat .prog.red")).length === 1, "полоска лимита красная")

// 4. регулярные платежи: срок сегодня → в «Сегодня», «Оплачено» пишет расход
await page.click('[data-do="recur-add"]')
await page.fill("#p-t", "Интернет"); await page.fill("#p-a", "599"); await page.fill("#p-d", String(new Date().getDate()))
await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(300)
check((await today()).includes("Интернет"), "платёж в списке «Регулярные платежи»")
await page.screenshot({ path: SHOTS + "f-money.png", fullPage: true })
await page.click('[data-tab="today"]'); await page.waitForTimeout(300)
check((await today()).includes("оплатить сегодня"), "на «Сегодня»: оплатить сегодня", (await today()).match(/Напоминания.{0,200}/)?.[0])
await page.screenshot({ path: SHOTS + "f-today.png", fullPage: true })
await page.click("[data-recur-pay]"); await page.waitForTimeout(300)
const paid = await page.evaluate(() => ({ m: live(D.money).find(e => e.comment === "Интернет"), r: live(D.recur)[0] }))
check(paid.m && paid.m.amount === 599 && Object.values(paid.r.paid)[0] === paid.m.id, "«Оплачено» записало расход и отметило месяц", paid)
check(!(await today()).includes("оплатить сегодня"), "оплаченный платёж ушёл с «Сегодня»")
const rr = await page.evaluate(() => runTool("add_recurring", { title: "Аренда", amount: 25000, day: 1, category: "Другое", paid_now: true }))
const gm = await page.evaluate(() => runTool("get_money", {}))
check(rr.ok && gm.recurring.length === 2 && gm.recurring.every(r => r.paid) && gm.budgets[0].limit === 1000, "add_recurring и get_money (лимиты, платежи)", gm.recurring)

// 5. вес
await page.click('[data-tab="health"]'); await page.waitForTimeout(300)
await page.evaluate(() => { logWeight(93.4, Date.now() - 20 * 864e5); logWeight(92.6, Date.now() - 10 * 864e5) })
await page.click('[data-do="weight"]'); await page.fill("#ask-v", "91,8"); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(300)
t = await today()
check(/91,8 кг/.test(t) && /−1,6 кг/.test(t), "вес и изменение за 30 дней", t.match(/Вес.{0,80}/)?.[0])
check(await page.$(".spark polyline"), "график веса")
check(await page.evaluate(() => H().weight === 92), "последний вес — для расчёта тренировок")
const lw = await page.evaluate(() => runTool("log_weight", { kg: 91.5 }))
check(lw.ok && lw.change_30d === -1.9, "log_weight от помощника", lw)
await page.screenshot({ path: SHOTS + "f-health.png", fullPage: true })

// 6. помощник отмечает привычку, создаёт новую
const mh = await page.evaluate(() => runTool("mark_habit", { habit: "алкоголь", done: false }))
const mh2 = await page.evaluate(() => runTool("mark_habit", { habit: "Чтение", create: true }))
const gh = await page.evaluate(() => runTool("get_health", {}))
check(mh.ok && mh2.ok && gh.habits.length === 3 && gh.habits.find(h => h.title === "Чтение").done_today && gh.weight.kg === 91.5, "mark_habit и get_health", gh.habits)
const bud = await page.evaluate(() => runTool("set_budget", { category: "Кафе и рестораны", limit: 5000 }))
check(bud.ok && bud.limit === 5000, "set_budget", bud)

// 7. поиск
await page.click("#find"); await page.fill("#q", "такси"); await page.waitForTimeout(400)
let q = await page.textContent("#q-res")
check(/Деньги · [23]/.test(q), "поиск «такси» находит операции", q.slice(0, 200))
await page.fill("#q", "599"); await page.waitForTimeout(400)
q = await page.textContent("#q-res")
check(q.includes("Интернет") && q.includes("Регулярные платежи"), "поиск по сумме", q.slice(0, 200))
await page.evaluate(s => { D.gcal.events.push({ id: "G1", title: "Созвон с командой", start: s, end: s }) }, iso(day(1, 11)))
await page.fill("#q", "созвон"); await page.waitForTimeout(400)
check((await page.textContent("#q-res")).includes("Календарь"), "поиск по календарю")
await page.screenshot({ path: SHOTS + "f-search.png" })
await page.click('#q-res [data-q="0"]'); await page.waitForTimeout(400)
check(await page.$(".sheet"), "результат открывается")

// 8. тёмная тема
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(300)
await page.emulateMedia({ colorScheme: "dark" })
await page.click('[data-tab="today"]'); await page.waitForTimeout(500)
await page.screenshot({ path: SHOTS + "f-today-dark.png", fullPage: true })
check(!errors.length, "без ошибок в консоли", errors)
await browser.close(); server.close()
console.log(ok ? "\nFEATURES_OK" : "\nFEATURES_FAIL")
process.exit(ok ? 0 : 1)
