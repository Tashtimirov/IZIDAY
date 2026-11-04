// «Планы»: новое меню, свои списки, «снова пора», привычки по неделе (Chromium, экран iPhone). Снимки — build/web-shots/p-*
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

// ── «Планы»: новое меню, списки, «снова пора», привычки по неделе
check(await page.evaluate(() => [...document.querySelectorAll("#tabs button")].map(b => b.dataset.tab).join()) === "today,plans,chat,money,health", "внизу: Сегодня, Планы, Помощник, Деньги, Здоровье")
check(await page.evaluate(() => !!$("#fab .orb svg") && $("#fab").dataset.tab === "chat"), "помощник — круглая кнопка в центре")
await page.click("#gear"); await page.waitForTimeout(300)
check(await page.evaluate(() => tab === "more" && $("#top-title").textContent === "Настройки"), "шестерёнка — настройки")
await page.click('[data-tab="plans"]'); await page.waitForTimeout(300)
check(await page.evaluate(() => tab === "plans" && $("#top-title").textContent === "Планы" && $$(".pf .chip").length === 5), "«Планы» с фильтрами")

// снова пора
let r = await page.evaluate(() => runTool("add_chore", { title: "Полить цветы", every_days: 3, last_done: dayKey(addDays(new Date(), -2)) }))
check(r.ok && r.next === "завтра", "помощник: полить цветы раз в 3 дня, поливал позавчера — завтра", r)
r = await page.evaluate(() => runTool("add_chore", { title: "Помыть машину", every_days: 14, last_done: dayKey(addDays(new Date(), -15)) }))
check(r.ok && /просрочено на 1 день/.test(r.next), "машина — просрочено на день", r)
await page.evaluate(() => { choreAdd("Сменить постельное", 7, +addDays(new Date(), -3)); choreAdd("Почистить фильтр воды", 30, +addDays(new Date(), -24)) })
await page.evaluate(() => render()); await page.waitForTimeout(200)
const ch = await page.evaluate(() => $$("#chores .row .t").map(e => e.textContent))
check(ch[0] === "Помыть машину" && ch.length === 4, "самое срочное — первым", ch)
check(await page.evaluate(() => $$("#chores .ic svg").length === 4 && !/🌿|🚗/.test($("#chores").textContent)), "у дел иконки, не смайлики")
await page.click('[data-tab="today"]'); await page.waitForTimeout(200)
check(/Помыть машину/.test(await today()) && !/Полить цветы/.test(await page.textContent("#chores-today")), "на «Сегодня» — только то, что пора")
await page.click('[data-tab="plans"]'); await page.waitForTimeout(200)

// списки
r = await page.evaluate(() => runTool("add_list_items", { list: "На выходные", items: ["Пляж", "Купить рыбу на рынке", "Позвонить маме", "Кино"], create: true }))
check(r.ok && r.added.length === 4, "помощник: свой список «На выходные»", r)
r = await page.evaluate(() => runTool("list_item_done", { list: "выходные", items: ["пляж"] }))
check(r.ok && r.marked[0] === "Пляж", "отметил пункт", r)
await page.evaluate(() => { shopAdd(["Молоко", "Авокадо", "Кофе"]); goalAdd("wish", ["Научиться сёрфингу", "Увидеть северное сияние", "Прыгнуть с парашютом"]); goalToggle(goalsOf("wish")[0].id, true)
  goalAdd("dream", ["Дом у моря"], yearAhead(2)); goalSteps(goalsOf("dream")[0].id, ["Выбрать район", "Накопить 30%", "Найти дом"]); stepSet(goalsOf("dream")[0].id, stepsOf(goalsOf("dream")[0])[0].id, { done: true })
  goalAdd("month", ["Пробежать 50 км", "Прочитать книгу", "Выучить 100 слов"]); goalToggle(goalsOf("month")[0].id, true); render() })
await page.waitForTimeout(200)
const lt = await page.textContent("#lists")
check(/Покупки.*3/.test(lt) && /100 желаний.*3 из 100/.test(lt) && /Дом у моря · шаги 1 из 3/.test(lt) && /На выходные.*1 из 4/.test(lt), "списки: покупки, желания, мечты, свой", lt)
await page.click('[data-list="shop"]'); await page.waitForTimeout(300)
await page.fill("#it-t", "Хлеб"); await page.press("#it-t", "Enter"); await page.waitForTimeout(300)
check(await page.evaluate(() => shopOpen().length === 4 && !!$(".sheet #it-t")), "покупки: добавил пункт прямо в списке")
await page.click('.sheet [data-it]'); await page.waitForTimeout(300)
check(await page.evaluate(() => shopOpen().length === 3 && /Отмечено · 1/.test($(".sheet").textContent)), "отметил — ушло в «Отмечено»")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(200)
await page.click('[data-do="list-add"]'); await page.fill("#l-t", "Подарки на Новый год"); await page.waitForTimeout(100)
check(await page.evaluate(() => $("#l-i .on").dataset.i === "gift"), "значок списка подбирается сам по названию")
await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(300)
await page.fill("#it-t", "Детям — конструктор"); await page.press("#it-t", "Enter"); await page.waitForTimeout(300)
check(await page.evaluate(() => itemsOf(listFind("Подарки")).length === 1), "новый список открылся, пункт добавлен")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(200)

// привычки по неделе
await page.evaluate(() => { for (const [t, ico, n] of [["Зарядка", "dumbbell", 5], ["Чтение", "book", 3], ["Без сладкого", "ban", 0]]) {
  const h = upsert("habits", { id: uid("h"), date: +addDays(new Date(), -10), title: t, ico, bad: ico === "ban" }); for (let i = 1; i <= n; i++) habitToggle(h, addDays(new Date(), -i)) }
  habitToggle(D.habits.find(h => h.title === "Без сладкого"), addDays(new Date(), -4)); render() })
await page.waitForTimeout(200)
const hid = await page.evaluate(() => D.habits.find(h => h.title === "Чтение" && !h.deleted).id)
await page.click(`[data-hd="${hid}"].td`); await page.waitForTimeout(200)
check(await page.evaluate(id => habitOn(D.habits.find(h => h.id === id), new Date()) && /серия 4/.test($("#habits-week").textContent), hid), "кружок за сегодня — отметил, серия 4")
check(await page.evaluate(() => $$("#habits-week .dot").length === 7 * habitList().length), "по 7 дней на привычку")
await page.evaluate(() => runTool("start_pomodoro", { title: "Отчёт по продажам" }))
await page.evaluate(() => { plansF = "all"; render(); $("#view").scrollTop = 0 }); await page.waitForTimeout(2600)
await page.screenshot({ path: SHOTS + "p-plans-1.png" })
await page.evaluate(() => $("#view").scrollTop = 640); await page.waitForTimeout(200)
await page.screenshot({ path: SHOTS + "p-plans-2.png" })
await page.evaluate(() => $("#view").scrollTop = 99999); await page.waitForTimeout(200)
await page.screenshot({ path: SHOTS + "p-plans-3.png" })
await page.evaluate(() => $("#view").scrollTop = 0); await page.click('[data-pf="habits"]'); await page.waitForTimeout(300)
check(await page.evaluate(() => !!$("#habits-week") && !$("#lists")), "фильтр «Привычки»")
await page.click('[data-pf="again"]'); await page.waitForTimeout(200)
await page.click(`[data-chore-done]`); await page.waitForTimeout(500)
check(await page.evaluate(() => chores().find(c => c.title === "Помыть машину").last > Date.now() - 60e3 && /через 14 дней/i.test($("#chores").textContent)), "машину помыл — снова через 14 дней")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close(); listSheet(listFind("На выходные").id) }); await page.waitForTimeout(2600)
await page.screenshot({ path: SHOTS + "p-list.png" })
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close(); choreForm() }); await page.waitForTimeout(300)
await page.fill("#c-t", "Полить цветы на балконе"); await page.click('#c-n [data-n="3"]'); await page.click('#c-i [data-i="leaf"]')
await page.screenshot({ path: SHOTS + "p-chore.png" })
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close(); setTab("today"); $("#view").scrollTop = 0 }); await page.waitForTimeout(400)
await page.screenshot({ path: SHOTS + "p-today.png" })
// цели и мечты, удаление цели не трогает списки
check(await page.evaluate(async () => (await runTool("delete_goal", { id: listFind("Подарки").id })).error === "нет такой"), "delete_goal не удаляет списки")
check(await page.evaluate(() => !goalFind("Пляж") && !goalFind("Помыть машину")), "поиск целей не цепляет списки и дела")
await page.evaluate(() => sync()); await settle()
const hg = hubState().lists.goals.filter(g => !g.deleted)
check(hg.some(g => g.kind === "chore" && g.title === "Помыть машину") && hg.some(g => g.kind === "list" && g.items && g.items.length === 4), "списки и дела ушли в таблицу (goals)", hg.map(g => g.kind))
// желание → цель на месяц → шаги с датами → календарь
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close(); goalsForm("wish") }); await page.waitForTimeout(400)
const wid = await page.evaluate(() => goalsOf("wish").find(g => g.title === "Увидеть северное сияние").id)
await page.click(`[data-tomonth="${wid}"]`); await page.waitForTimeout(400)
check(await page.evaluate(() => goalsOf("month").some(g => g.title === "Увидеть северное сияние" && g.from) && /Разбить на шаги/.test($(".sheet").textContent)), "желание стало целью на месяц, предлагает шаги")
await page.click('.sheet [data-b="Разбить на шаги"]'); await page.waitForTimeout(400)
const gid = await page.evaluate(() => goalsOf("month").find(g => g.title === "Увидеть северное сияние").id)
const z2 = n => String(n).padStart(2, "0"), dd = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}` }
const ad = await page.evaluate(([a, b]) => runTool("add_goal_steps", { goal: "северное сияние", steps: ["Выбрать страну и даты", "Купить билеты", "Взять тёплую одежду"], dates: [a, b + "T10:00"] }), [dd(1), dd(3)])
check(ad.ok && ad.added.length === 3 && /\(/.test(ad.steps[0]), "помощник: план с датами", ad)
await page.evaluate(id => { while (stack.length) stack[stack.length - 1].close(); stepsForm(id) }, gid); await page.waitForTimeout(400)
check(await page.evaluate(() => /завтра/.test($(".sheet").textContent) && /Внести план в календарь · 2/.test($(".sheet").textContent)), "даты шагов видны, кнопка «внести план»")
await page.screenshot({ path: SHOTS + "p-steps.png" })
const opsBefore = await page.evaluate(() => gcalOn() ? -1 : pendingOps().filter(o => o.tool === "create_event").length)
await page.click('.sheet [data-a="cal"]'); await page.waitForTimeout(1500)
check(await page.evaluate(id => stepsOf(D.goals.find(g => g.id === id)).filter(x => x.cal).length === 2, gid), "два шага внесены в календарь")
check(opsBefore === -1 || await page.evaluate(n => pendingOps().filter(o => o.tool === "create_event").length === n + 2, opsBefore), "события ушли в календарь", opsBefore)
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close(); goalsForm("wish") }); await page.waitForTimeout(300)
check(await page.evaluate(() => /в целях/.test($(".sheet").textContent)), "в желаниях — пометка «в целях»")
await page.screenshot({ path: SHOTS + "p-wish.png" })
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close(); plansF = "goals"; setTab("plans") }); await page.waitForTimeout(300)
check(/дальше: Выбрать страну/.test(await page.textContent("#goals")), "на карточке целей — следующий шаг", await page.textContent("#goals"))
await page.screenshot({ path: SHOTS + "p-goals.png" })
// тёмная тема
await page.emulateMedia({ colorScheme: "dark" }); await page.evaluate(() => { setTab("plans"); $("#view").scrollTop = 0 }); await page.waitForTimeout(400)
await page.screenshot({ path: SHOTS + "p-plans-dark.png" })
check(!errors.length, "без ошибок на странице", errors)
console.log(ok ? "PLANS_OK" : "PLANS_FAIL")
await browser.close(); server.close()
