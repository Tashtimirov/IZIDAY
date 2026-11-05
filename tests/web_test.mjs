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
sheet.cal.off = true   // сначала Календарь Google не разрешён — события из iPhone (как у старого скрипта)
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
await page.route("https://open.er-api.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ rates: { THB: 1, USD: 0.0283, RUB: 2.33 } }) }))   // курс валют
await page.route("https://api.open-meteo.com/**", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }))   // погода на «Сегодня»
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

// 2. вода и отметка напоминания → таблица
await page.click('[data-do="water"]')
await page.click('[data-check="R1"]')
await settle()
let st = hubState()
check(st.lists.water.filter(w => !w.deleted).length === 2, "стакан воды дошёл до таблицы", st.lists.water)
check(st.lists.rems.some(r => r.id === "R1" && r.done) && st.lists.rems.some(r => r.id === "R2" && !r.done), "напоминания iPhone перенесены в приложение; отметка — в таблице", st.lists.rems)
check(!st.ops.some(o => /reminder/.test(o.tool)), "в iPhone напоминания больше не вносятся")
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
await page.evaluate(() => setTab("chat"))   // «Изи» ещё раз на экране чата открывает голосовой разговор
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
await page.click(`.day[data-day="${+day(1, 0)}"]`)
check(!(await page.textContent("#view")).includes("Падел"), "удалённое событие сразу пропало из дня")

// 6. виджет выполнил команды → приложение видит результат
sheet.post({ secret: SECRET, hub: { from: "widget", since: 0, done: st.ops.map(o => ({ id: o.id, result: { ok: true } })),
  snap: { events: [{ id: "E1", title: "Созвон с командой", start: iso(day(0, 23, 0)), end: iso(day(0, 23, 30)), calendar: "Работа" }],
    reminders: [{ id: "R2", title: "Оплатить интернет", due: null, completed: false }], watch: null } } })
await page.evaluate(() => DO.sync())
await settle()
check(/iPhone: (только что|\d+ мин)/.test(await page.textContent("#top-sub")) && !/⏳/.test(await page.textContent("#top-sub")), "очередь пуста после виджета", await page.textContent("#top-sub"))

// 7. здоровье и «Ещё»
await page.click('[data-tab="health"]')
const hv = await page.textContent("#view")
check(hv.includes("Омлет с тостом") && /0,5 л/.test(hv), "здоровье: еда и вода", hv.slice(0, 200))
await page.screenshot({ path: SHOTS + "4-health.png", fullPage: true })
await page.click('#gear')
check((await page.textContent("#view")).includes("Последний обмен"), "«Ещё»: подключено")
await page.screenshot({ path: SHOTS + "5-more.png", fullPage: true })

// 8. действие из виджета: #water добавляет стакан, но серия случайных касаний не пишется
const liveW = () => hubState().lists.water.filter(w => !w.deleted)
const before = liveW().length
await page.goto(BASE + "#water")
await settle()
check(liveW().length === before, "#water через секунды после стакана в приложении — не пишется (защита от серии)", liveW().length)
await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 120e3 })   // прошло две минуты
await page.evaluate(() => addWater(250, "widget")); await page.evaluate(() => addWater(250, "widget")); await page.evaluate(() => addWater(250, "widget"))
await settle()
check(liveW().length === before + 1, "из трёх быстрых #water записан один стакан", liveW().length)
// в приложении второй стакан подряд — с вопросом
const ask = page.evaluate(() => addWater(250))
await page.waitForSelector(".sheet", { timeout: 3000 }).catch(() => {})
check(await page.isVisible(".sheet"), "второй стакан за 10 с — спрашивает «Ещё стакан?»")
await page.click('.sheet [data-b="Отмена"]')
await ask; await settle()
check(liveW().length === before + 1, "отказ — стакан не добавлен", liveW().length)

// помощник удаляет лишнюю воду по id
const wids = await page.evaluate(() => runTool("get_health", {}).then(r => r.water.map(w => w.id)))
check(wids.length >= 2, "get_health отдаёт id записей воды", wids)
await page.evaluate(() => setTab("chat"))   // «Изи» ещё раз на экране чата открывает голосовой разговор
const del = page.evaluate(ids => runTool("delete_record", { kind: "water", ids }), wids.slice(1))
await page.waitForSelector('[data-opt="Да"]', { timeout: 5000 }).catch(() => {})
await page.click('[data-opt="Да"]')
const dr = await del; await settle()
check(dr.ok && dr.deleted === wids.length - 1 && liveW().filter(w => wids.includes(w.id)).length === 1, "delete_record удалил лишнюю воду, одна осталась", dr)

// фото и файл: вложение уходит Claude, в чате — миниатюра
claudeQueue.push({ content: [{ type: "text", text: "Это чек 7-Eleven: итог 245 ฿." }], stop_reason: "end_turn" })
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQEAP2uD/H+Ug1hAAAAAElFTkSuQmCC", "base64")
let n0 = claudeSeen.length
await page.setInputFiles("#photo-lib", { name: "check.png", mimeType: "image/png", buffer: PNG })
await page.waitForSelector("text=Это чек 7-Eleven", { timeout: 8000 }).catch(() => {})
let sent = claudeSeen[n0] && claudeSeen[n0].body.messages.at(-1).content
check(Array.isArray(sent) && sent[0].type === "image" && sent[0].source.media_type === "image/jpeg" && /вложение/.test(sent[1].text), "фото ушло Claude картинкой", sent && sent.map(c => c.type))
check(/Чек из магазина/.test(claudeSeen[n0].body.system) && /Счёт, инвойс/.test(claudeSeen[n0].body.system), "правила для еды, счёта и чека в подсказке")
check(await page.isVisible("#chat-list img.att"), "в чате видна миниатюра фото")
check(!(await page.textContent("#chat-list")).includes("📷") && await page.isVisible("#chat-list .ei-cam"), "у фото в чате иконка камеры, не смайлик")
check(await page.isVisible(".chat-bar .cam"), "в строке чата есть кнопка 📷")
await page.screenshot({ path: SHOTS + "7-chat-photo.png" })
claudeQueue.push({ content: [{ type: "text", text: "Счёт за интернет на 899 ฿." }], stop_reason: "end_turn" })
n0 = claudeSeen.length
await page.setInputFiles("#doc", { name: "bill.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%fake\n") })
await page.waitForSelector("text=Счёт за интернет", { timeout: 8000 }).catch(() => {})
sent = claudeSeen[n0] && claudeSeen[n0].body.messages.at(-1).content
check(Array.isArray(sent) && sent[0].type === "document" && sent[0].source.media_type === "application/pdf", "PDF ушёл Claude документом", sent && sent.map(c => c.type))
check((await page.textContent("#chat-list")).includes("bill.pdf") && await page.isVisible("#chat-list .ei-doc"), "в чате подпись файла с иконкой документа")
check(!/[☀🌙🧠🧹]/u.test(await page.textContent(".chat-tools")) && (await page.$$(".chat-tools .ei")).length === 4, "кнопки чата — с иконками, без смайликов")
check(!JSON.stringify(claudeSeen.at(-1).body.messages.slice(0, -1)).includes('"type":"image"'), "старое фото не отправляется повторно")

// помощник: сильная модель с размышлением, память и поиск по прошлым чатам
const last = claudeSeen.at(-1)
check(last.body.model === "claude-opus-5-5" && last.body.output_config.effort === "high" && last.body.fallbacks === "default" && last.headers["anthropic-beta"] === "server-side-fallback-2026-07-01", "чат — Opus 5.5, effort high, запасная модель при отказе", { m: last.body.model, oc: last.body.output_config })
check(/Твоя память о пользователе/.test(last.body.system) && last.body.tools.some(t => t.name === "search_chats") && last.body.tools.some(t => t.name === "remember"), "в подсказке память, есть remember и search_chats")
const rem = await page.evaluate(() => runTool("remember", { text: "Жена — Алия" }))
const rem2 = await page.evaluate(() => runTool("remember", { text: "жена — алия" }))
check(rem.ok && rem2.note === "уже помню", "remember: запомнил, дубль не пишет", [rem, rem2])
await settle()
check((hubState().lists.memory || []).some(m => m.text === "Жена — Алия" && m.kind === "fact"), "факт ушёл в таблицу")
check(sheet.ss.getSheetByName("Память помощника") && sheet.ss.getSheetByName("Память помощника").getLastRow() >= 2, "…и на лист «Память помощника»")
const sc = await page.evaluate(() => runTool("search_chats", { query: "падела завтра" }))
check(sc.messages && sc.messages.some(m => /падел/i.test(m.text)), "search_chats находит прошлый разговор про падел", sc)
// разговор закончился 4 часа назад → сводка в память
await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 4 * 3600e3; return memorize() })
await page.waitForTimeout(500)
const mem = await page.evaluate(() => live(D.memory).map(m => m.kind + ":" + m.text))
check(memSeen.length === 1 && mem.some(t => t.startsWith("chat:Обсуждали такси")) && mem.includes("fact:Играет в падел по вторникам"), "после паузы разговор сложен в память (сводка + новый факт)", mem)
const sys2 = await page.evaluate(() => chatSystem())
check(sys2.includes("Обсуждали такси") && sys2.includes("Играет в падел"), "сводка и факт попадают в подсказку следующего разговора")
await page.evaluate(() => runTool("forget", { id: live(D.memory).find(m => m.text === "Жена — Алия").id }))
check(!(await page.evaluate(() => chatSystem())).includes("Алия"), "forget убирает факт")

// место платежа: история мест от виджета → время, адрес и ссылка на карту
const payAt = Date.now() - 5 * 3600e3
sheet.post({ secret: SECRET, hub: { from: "widget", since: 0, lists: { locs: [{ id: "l1", date: payAt - 20 * 60e3, u: Date.now(), lat: 13.7466, lng: 100.5393 }, { id: "l2", date: payAt - 5 * 3600e3, u: Date.now(), lat: 13.70, lng: 100.60 }] } } })
await page.evaluate(() => sync()); await settle()
const wh = await page.evaluate(t => runTool("where_was_i", { time: t }), iso(new Date(payAt)))
check(wh.lat === 13.7466 && Math.abs(wh.minutes_from_payment + 20) <= 1 && wh.link === "https://maps.google.com/?q=13.7466,100.5393" && /Central World/.test(wh.address), "where_was_i: ближайшая точка, адрес, ссылка на карту", wh)
check(/где был пользователь в тот момент/.test(claudeSeen.at(-1).body.system), "правило: при вопросе о платеже — время и место")

// почта: поиск, чтение, отправка только после «Да»
const ms = await page.evaluate(() => runTool("mail_search", { query: "аренда" }))
check(ms.threads && ms.threads.length === 1 && ms.threads[0].id === "T1" && /Аренда/.test(ms.threads[0].subject), "mail_search находит письмо", ms)
const mr = await page.evaluate(() => runTool("mail_read", { id: "T1" }))
check(mr.messages && /25 000 THB/.test(mr.messages[0].body), "mail_read читает письмо", mr)
await page.evaluate(() => setTab("chat"))   // «Изи» ещё раз на экране чата открывает голосовой разговор
let sendP = page.evaluate(() => runTool("mail_send", { to: "rent@condo.th", subject: "Оплата", body: "Оплачу завтра." }))
await page.waitForSelector('[data-opt="Нет"]', { timeout: 5000 }).catch(() => {})
check((await page.textContent("#chat-list")).includes("Кому: rent@condo.th"), "перед отправкой видно, кому и что")
await page.click('[data-opt="Нет"]')
const sn = await sendP
check(sn.cancelled && !sheet.mail.log.some(l => l[0] === "send"), "«Нет» — письмо не ушло", sn)
sendP = page.evaluate(() => runTool("mail_reply", { id: "T1", body: "Спасибо, оплачу до 5-го." }))
await page.waitForSelector('[data-opt="Да"]', { timeout: 5000 }).catch(() => {})
await page.click('[data-opt="Да"]')
const ry = await sendP
check(ry.ok && sheet.mail.log.some(l => l[0] === "reply" && l[1] === "M1"), "«Да» — ответ ушёл в цепочку", ry)
const ar = await page.evaluate(() => runTool("mail_modify", { ids: ["T2"], op: "archive" }))
check(ar.ok && sheet.mail.log.some(l => l[0] === "archive" && l[1] === "T2"), "архив без лишних вопросов", ar)
check(claudeSeen.at(-1).body.tools.some(t => t.name === "mail_send") && /Почта Gmail/.test(claudeSeen.at(-1).body.system), "почтовые инструменты у помощника")

// помощник ведёт день: план подсказок уходит в таблицу для уведомлений виджета
const z2 = n => String(n).padStart(2, "0"), inH = h => { const d = new Date(Date.now() + h * 3600e3); return `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}T${z2(d.getHours())}:${z2(d.getMinutes())}` }
const sameDayAhead = new Date(Date.now() + 3600e3).getDate() === new Date().getDate()
const pd = await page.evaluate(() => { const at = h => iso(new Date(Date.now() + h * 3600e3)); return runTool("plan_day", { items: [{ time: at(0.5), text: "💧 Стакан воды перед созвоном" }, { time: at(-1), text: "прошлое" }] }) })
const pageAhead = await page.evaluate(() => new Date(Date.now() + 0.5 * 3600e3).getDate() === new Date().getDate())
check(pd.ok && pd.planned.length === (pageAhead ? 1 : 0), "plan_day: только будущие подсказки сегодня", pd)
await settle()
if (pageAhead) check((hubState().lists.nudges || []).some(n => /Стакан воды/.test(n.text)), "подсказки ушли в таблицу для виджета")
check(claudeSeen.at(-1).body.tools.some(t => t.name === "plan_day") && /Ты ведёшь день пользователя/.test(claudeSeen.at(-1).body.system), "помощник умеет вести день и учиться на поправках")

// «Стоп»: ответ прерывается, вопрос возвращается в строку ввода
await page.evaluate(() => setTab("chat"))   // «Изи» ещё раз на экране чата открывает голосовой разговор
await page.route("https://api.anthropic.com/v1/messages", async route => { await new Promise(r => setTimeout(r, 3000)); route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ content: [{ type: "text", text: "Поздний ответ" }], stop_reason: "end_turn" }) }).catch(() => {}) })
await page.fill("#chat-in", "сколько я потратил на кафе в октябре")
await page.click(".chat-bar .send")
await page.waitForTimeout(400)
check(await page.isVisible(".chat-bar .send.stop"), "пока помощник думает — кнопка ⏹")
await page.click(".chat-bar .send")
await page.waitForTimeout(500)
check(await page.inputValue("#chat-in") === "сколько я потратил на кафе в октябре" && !(await page.textContent("#chat-list")).includes("сколько я потратил на кафе"), "⏹: остановлено, текст снова в строке ввода", await page.inputValue("#chat-in"))
await page.waitForTimeout(3000)
check(!(await page.textContent("#chat-list")).includes("Поздний ответ"), "поздний ответ после стопа не появляется")
await page.unroute("https://api.anthropic.com/v1/messages")
// Изи задал вопрос посреди ответа — справа не мёртвый ⏹, а микрофон: нажал — отвечаешь голосом
await page.fill("#chat-in", "")
await page.evaluate(() => { chatBusy = true; chatStopCtl = new AbortController(); setBusyUI(); window.__ans = null; chatAsk("Записать в еду?", ["Да", "Нет"]).then(a => window.__ans = a) })
await page.waitForTimeout(300)
check(await page.evaluate(() => { const b = $(".chat-bar .send"); return !!b.offsetParent && b.classList.contains("mic-on") && !b.classList.contains("stop") }), "вопрос Изи — справа микрофон, а не ⏹")
await page.evaluate(() => { window.__mic = 0; const m = micStart; micStart = () => { window.__mic++ }; window.__micRestore = () => { micStart = m } })
await page.click(".chat-bar .send"); await page.waitForTimeout(100)
check(await page.evaluate(() => window.__mic === 1), "нажал микрофон — пошла запись ответа")
await page.evaluate(() => { window.__micRestore(); chatSend("да") }); await page.waitForTimeout(200)
check(await page.evaluate(() => window.__ans === "да" && $(".chat-bar .send").classList.contains("stop")), "ответил — Изи продолжает, снова рабочий ⏹", await page.evaluate(() => window.__ans))
await page.evaluate(() => { chatBusy = false; chatStopCtl = null; setBusyUI() })
check(await page.evaluate(() => $(".chat-bar .send").classList.contains("mic-on")), "Изи закончил — снова микрофон")
// ✎ у своего сообщения
await page.fill("#chat-in", "")
await page.evaluate(() => { D.chat.push({ role: "user", text: "напомни купить хлеп", at: Date.now() }, { role: "assistant", text: "Ок", at: Date.now() }); renderChat() })
await page.click("#chat-list [data-edit]:last-of-type >> nth=-1")
await page.waitForTimeout(200)
check(await page.inputValue("#chat-in") === "напомни купить хлеп" && !(await page.textContent("#chat-list")).includes("купить хлеп"), "✎: сообщение вернулось в строку для правки", await page.inputValue("#chat-in"))
await page.fill("#chat-in", "")

// «Выполнил?» из уведомления: перенос на час уходит в очередь виджета
await page.evaluate(() => { location.hash = "rem=R2" })
await page.waitForSelector(".sheet .opt", { timeout: 3000 }).catch(() => {})
check((await page.textContent(".sheet")).includes("Оплатить интернет"), "#rem открывает вопрос по напоминанию")
await page.click('.sheet .opt:has-text("Через час")')
await settle()
const r2 = () => hubState().lists.rems.find(r => r.id === "R2")
check(r2() && /T/.test(r2().due || "") && !r2().done, "перенос на час — срок в приложении", r2())
await page.evaluate(() => { location.hash = "remdone=R2" }); await settle()
check(r2().done, "«Сделано» из уведомления отмечает напоминание")

// напоминания про воду: старые убираются, новые не создаются
const wr = await page.evaluate(() => { remAdd({ title: "💧 Выпей стакан воды", due: iso(new Date()) }); D.waterRemsDropped = false; dropWaterRems(); return { left: live(D.rems).some(r => /воды/.test(r.title)), tool: runTool("create_reminder", { title: "Выпить стакан воды" }) } })
const wt = await page.evaluate(() => runTool("create_reminder", { title: "Выпить стакан воды" }))
check(!wr.left && wt.error, "напоминания про воду убраны и не создаются", wt)
// напоминания помощника — в приложении, с повтором
const cr = await page.evaluate(() => runTool("create_reminder", { title: "Выпить витамины", due: iso(new Date(Date.now() - 3600e3)), repeat: { freq: "daily" } }))
check(cr.ok && /^r/.test(cr.id), "create_reminder сохраняет в приложении", cr)
const ur = await page.evaluate(id => runTool("update_reminder", { id, completed: true }), cr.id)
check(ur.ok && !ur.reminder.completed && new Date(ur.reminder.due) > new Date(), "повторяющееся: «сделано» переносит на следующий раз", ur)
await settle()
check(hubState().lists.rems.some(r => r.id === cr.id), "напоминание дошло до таблицы")

// Google Календарь: доступ выдан — события оттуда, создание сразу
sheet.cal.off = false
sheet.cal.mk("Встреча в Google", new Date(Date.now() + 2 * 3600e3), new Date(Date.now() + 3 * 3600e3))
await page.evaluate(() => { D.gcal = null; return sync() })
await page.waitForFunction(() => D.gcal && D.gcal.ok, null, { timeout: 8000 })
const ge = await page.evaluate(() => runTool("get_events", { start: iso(new Date(Date.now() - 864e5)), end: iso(new Date(Date.now() + 864e5)) }))
check(ge.source === "Google Календарь" && ge.events.some(e => e.title === "Встреча в Google"), "события — из Google Календаря", ge)
const ce = await page.evaluate(() => runTool("create_event", { title: "Стоматолог", start: iso(new Date(Date.now() + 26 * 3600e3)), end: iso(new Date(Date.now() + 27 * 3600e3)) }))
check(ce.ok && sheet.cal.log.some(l => l[0] === "create" && l[2] === "Стоматолог"), "create_event — сразу в Google", ce)
await settle()
const ge2 = await page.evaluate(() => runTool("get_events", { start: iso(new Date()), end: iso(new Date(Date.now() + 2 * 864e5)) }))
check(ge2.events.some(e => e.title === "Стоматолог"), "новое событие видно после обновления", ge2.events.map(e => e.title))

// голос: зелёная ➤ во время записи отправляет сразу, без паузы
await page.evaluate(() => {
  class FakeSR { start() { window.__sr = this; setTimeout(() => this.onresult && this.onresult({ results: [Object.assign([{ transcript: "сколько я выпил воды" }], { isFinal: false })] }), 50) }
    stop() { setTimeout(() => this.onend && this.onend(), 10) } abort() { this.aborted = true } }
  window.SpeechRecognition = window.webkitSpeechRecognition = FakeSR
})
claudeQueue.push({ content: [{ type: "text", text: "Сегодня 0,5 л." }], stop_reason: "end_turn" })
const sentBefore = claudeSeen.length
await page.click('[data-tab="today"]'); await page.click("#fab")
await page.waitForTimeout(300)
check(await page.evaluate(() => tab === "chat" && !voice), "зелёная кнопка: нажатие — чат, без записи")
check(await page.evaluate(() => !$(".chat-bar .mic")), "в чате одна кнопка голоса — большая «Изи», маленькой волны у поля нет")
await page.evaluate(() => micStart()); await page.waitForTimeout(300)
check(await page.evaluate(() => !!voice && !$("#silk").hidden), "диктовка — сразу слушает, видна полоса записи")
await page.click("#silk .tm")
await page.waitForSelector("text=Сегодня 0,5 л", { timeout: 5000 }).catch(() => {})
check(claudeSeen.length === sentBefore + 1 && JSON.stringify(claudeSeen.at(-1).body.messages).includes("сколько я выпил воды"), "➤ отправил услышанное сразу", claudeSeen.length - sentBefore)
await page.waitForTimeout(3000)
check(claudeSeen.length === sentBefore + 1 && await page.evaluate(() => !voice), "после ➤ запись остановлена, второй отправки нет", claudeSeen.length - sentBefore)
// держать зелёную кнопку — запись команды с любого экрана, пауза не обрывает; отпустил — ушло помощнику
await page.click('[data-tab="today"]')
const fb = await page.locator("#fab").boundingBox()
await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2); await page.mouse.down()
await page.waitForTimeout(600)
check(await page.evaluate(() => !!voice && voice.ptt && tab === "today" && !$("#silk").hidden && $("#fab").classList.contains("rec")), "держу кнопку — идёт запись, видно, что слышно", await page.evaluate(() => [!!voice, tab, $("#silk").textContent]))
await page.waitForTimeout(3000)
check(await page.evaluate(() => !!voice), "пока держу, пауза запись не обрывает")
claudeQueue.push({ content: [{ type: "text", text: "Сегодня 0,5 л." }], stop_reason: "end_turn" })
const sentPtt = claudeSeen.length
await page.mouse.up()
await page.waitForTimeout(1500)
check(claudeSeen.length === sentPtt + 1 && await page.evaluate(() => tab === "chat" && !voice && $("#silk").hidden && !$("#fab").classList.contains("rec")), "отпустил — команда ушла помощнику, открыт чат", [claudeSeen.length - sentPtt, await page.evaluate(() => tab)])
check(await page.evaluate(() => !!$("#add svg")), "меню «Добавить» — кнопка «+» вверху")
// «+» в чате: плюс поворачивается, список из трёх пунктов; нажали мимо — закрылось
check(await page.evaluate(() => !!$(".chat-bar .send").offsetParent && $(".chat-bar .send").classList.contains("mic-on")), "пустое поле — справа микрофон «ответить голосом»")
await page.fill("#chat-in", "тест")
check(await page.evaluate(() => !!$(".chat-bar .send").offsetParent && !$(".chat-bar .send").classList.contains("mic-on")), "есть текст — стрелка «отправить»")
await page.fill("#chat-in", "")
await page.click(".chat-bar .cam"); await page.waitForTimeout(500)
check(await page.evaluate(() => $(".chat-bar .cam").classList.contains("open") && $$(".plus-menu button").length === 3 && /Камера.*Фото и видео.*Файл/.test($(".plus-menu").textContent)), "«+»: камера, фото и видео, файл", await page.evaluate(() => $(".plus-menu") && $(".plus-menu").textContent))
await page.mouse.click(300, 150); await page.waitForTimeout(450)
check(await page.evaluate(() => !$(".plus-menu") && !$(".chat-bar .cam").classList.contains("open")), "нажали мимо — меню закрылось")
// отмена записи: «‹ отмена» — ничего не ушло, поле пустое
await page.evaluate(() => micStart()); await page.waitForTimeout(200)
const sentCancel = claudeSeen.length
await page.click("#silk .x"); await page.waitForTimeout(1500)
check(await page.evaluate(() => !voice && $("#silk").hidden && $("#chat-in").value === "") && claudeSeen.length === sentCancel, "«‹ отмена» — запись выброшена, ничего не отправлено")
// как Safari: пока прошлая запись не закончилась, новая не стартует; после ➤ микрофон снова работает
await page.evaluate(() => {
  window.__busy = false; window.__starts = 0
  class SafariSR { start() { if (window.__busy) throw new Error("already started"); window.__busy = true; window.__starts++; window.__sr = this }
    stop() { setTimeout(() => { window.__busy = false; this.onend && this.onend() }, 200) } abort() { this.stop() } }
  window.SpeechRecognition = window.webkitSpeechRecognition = SafariSR
})
await page.evaluate(() => micStart()); await page.waitForTimeout(100)
await page.evaluate(() => { const r = window.__sr; r.onresult({ results: [Object.assign([{ transcript: "привет" }], { isFinal: true })] }) })
check(await page.evaluate(() => $("#silk .tx").textContent === "привет"), "слова видны в полосе записи", await page.evaluate(() => $("#silk .tx").textContent))
claudeQueue.push({ content: [{ type: "text", text: "Привет!" }], stop_reason: "end_turn" })
await page.click("#silk .tm")
await page.evaluate(() => window.__sr.onresult({ results: [Object.assign([{ transcript: "привет" }], { isFinal: true })] }))   // Safari присылает итог уже после stop()
check(await page.evaluate(() => $("#chat-in").value === ""), "после ➤ поле пустое: поздний итог распознавания не возвращает текст", await page.evaluate(() => $("#chat-in").value))
await page.evaluate(() => micStart()); await page.waitForTimeout(900)
check(await page.evaluate(() => !!voice && window.__starts === 2), "сразу после ➤ микрофон запускается снова", await page.evaluate(() => [!!voice, window.__starts]))
// ошибка распознавания — без бесконечного перезапуска, с подсказкой
await page.evaluate(() => { const r = window.__sr; r.onerror({ error: "network" }); window.__busy = false; r.onend() })
await page.waitForTimeout(300)
check(await page.evaluate(() => !voice && window.__starts === 2), "ошибка сети: запись остановлена, не перезапускается по кругу")
check(/нет сети/.test(await page.textContent("#toast")), "и видно, что случилось")
await page.waitForTimeout(2500)
// iPhone: коснулись поля во время записи — запись остановлена, но итог распознавания всё равно дописывается в поле;
// нажали ➤ — ушло, и поздний итог поле больше не заполняет
await page.evaluate(() => micStart()); await page.waitForTimeout(100)
await page.evaluate(() => window.__sr.onresult({ results: [Object.assign([{ transcript: "купить молоко" }], { isFinal: false })] }))
check(await page.evaluate(() => $("#chat-in").value === "купить молоко"), "слова появляются во время записи", await page.evaluate(() => $("#chat-in").value))
await page.focus("#chat-in"); await page.waitForTimeout(50)
await page.evaluate(() => window.__sr.onresult({ results: [Object.assign([{ transcript: "купить молоко и хлеб" }], { isFinal: true })] }))
check(await page.evaluate(() => !voice && $("#chat-in").value === "купить молоко и хлеб"), "коснулись поля во время записи — итог всё равно появляется", await page.evaluate(() => [!!voice, $("#chat-in").value]))
claudeQueue.push({ content: [{ type: "text", text: "Записал." }], stop_reason: "end_turn" })
await page.click(".chat-bar .send"); await page.waitForTimeout(100)
await page.evaluate(() => window.__sr.onresult({ results: [Object.assign([{ transcript: "купить молоко и хлеб" }], { isFinal: true })] }))
check(await page.evaluate(() => $("#chat-in").value === ""), "после ➤ поздний итог не задваивает", await page.evaluate(() => $("#chat-in").value))
await page.waitForTimeout(1500)
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
await page.click('[data-tab="today"]'); await page.click(".day.td")
const tv = await page.textContent("#view"); check(tv.includes("напомню рядом: Decathlon"), "на «Сегодня» видно напоминание по месту", tv.slice(0, 600))
const nf = await page.evaluate(() => runTool("remind_near", { title: "x", query: "нигде" }))
check(nf.error, "место не нашлось — просьба уточнить", nf)
// история: прошлый день и отчёты за неделю/месяц/год
await page.emulateMedia({ colorScheme: "light" })
const yd = await page.evaluate(() => {
  const y = addDays(sod(new Date()), -1), at = h => new Date(y).setHours(h, 0, 0, 0)
  D.food.push({ id: "hy1", date: at(13), u: Date.now(), title: "Том ям вчера", kcal: 610, protein: 30, fat: 20, carbs: 40 })
  D.workouts.push({ id: "hy2", date: at(7), u: Date.now(), title: "Прогулка у моря", minutes: 45, kcal: 210 })
  D.money.push({ id: "hy3", date: at(19), u: Date.now(), type: "expense", amount: 777, method: "cash", category: "Кафе", comment: "ужин" })
  D.water.push({ id: "hy4", date: at(10), u: Date.now(), ml: 500 })
  D.snap.health = [{ day: dayKey(y), steps: 12345, active: 520, exercise: 61 }]
  return +y
})
await page.click('[data-tab="today"]'); await page.click(`.day[data-day="${yd}"]`)
const hyv = await page.textContent("#view")
check(["Итоги дня", "Том ям вчера", "Прогулка у моря", "12 345", "777", "0,5 л"].every(x => hyv.includes(x)), "вчерашний день: еда, тренировка, шаги, вода, расходы", hyv.slice(0, 900))
check(!hyv.includes("Напоминания"), "в прошлом дне нет списка напоминаний")
await page.waitForTimeout(800); await page.screenshot({ path: SHOTS + "7-yesterday.png" })
await page.click('[data-tab="health"]')
const hh = await page.textContent("#view")
check(hh.includes("Вчера") && hh.includes("Том ям вчера") && hh.includes("Расходы за день") && hh.includes("12 345") && !hh.includes("+ Стакан"), "«Здоровье» листается на вчера, без кнопок добавления", hh.slice(0, 600))
await page.click('[data-hday="1"]')
await page.waitForTimeout(300); const hb = await page.textContent("#view"); check(hb.includes("Готовность сегодня") && hb.includes("Сегодня"), "› возвращает на сегодня", hb.slice(0, 300))
const rp = await page.evaluate(() => ["week", "month", "year"].map(k => { const st = periodStats(k, addDays(new Date(), -1)); return { k, exp: st.exp, w: st.workouts.length, steps: st.stepsDays, html: periodReportHTML(st).length } }))
check(rp.every(r => r.exp >= 777 && r.w >= 1 && r.steps >= 1 && r.html > 1000), "отчёты за неделю, месяц и год считают расходы, тренировки и шаги", rp)
await page.click('[data-report="week"]'); await page.waitForTimeout(300)
const fr = await page.frameLocator("iframe.report").locator("body").textContent()
check(fr.includes("Прогулка у моря") && fr.includes("По дням"), "отчёт открывается в приложении", fr.slice(0, 300))
await page.click('.sheet [data-k="year"]'); await page.waitForTimeout(200)
check((await page.textContent(".sheet .rt")).includes("год"), "переключение на год")
await page.screenshot({ path: SHOTS + "8-report.png" })
await page.click('.sheet [data-a="close"]')
check(!errors.length, "без ошибок в консоли", errors)
await browser.close(); server.close()
console.log(ok ? "\nWEB_OK" : "\nWEB_FAIL")
process.exit(ok ? 0 : 1)
