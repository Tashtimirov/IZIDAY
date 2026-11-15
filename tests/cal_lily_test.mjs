// Календарь по замечаниям тестеров (Лиля, 2026-11-15):
// 1) Изи честно говорит, подключён ли Google Календарь, и даёт кнопку «Подключить Google Календарь»;
// 2) «Цвета и календари»: «+» своя категория с названием и цветом, «Скрыть» убирает календарь и с «Сегодня»;
// 3) «Сегодня»: календари разными цветами, точки календарей в ленте дней;
// 4) нажатие на свободное окно открывает полную форму события со временем и длительностью окна.
// Снимки — build/web-shots/ll-* (с --dark — ll-*-dark)
import fs from "fs"
import { boot2, shot } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const DARK = process.argv.includes("--dark"), SUF = DARK ? "-dark" : ""
const ev = (id, title, d, h, m, h2, m2, calendar, location = "") => ({ bkk, iso }) => ({ id, title, start: iso(bkk(d, h, m)), end: iso(bkk(d, h2, m2)), calendar, all_day: false, location, repeats: false })
const EVS = [
  ev("E1", "Показ виллы", 0, 11, 0, 12, 0, "Работа", "Rawai"), ev("E2", "Забрать детей", 0, 15, 0, 15, 45, "Ильдар"), ev("E3", "Падел", 0, 19, 0, 20, 30, "Личное"),
  ev("E4", "Планёрка", 1, 9, 0, 10, 0, "Работа"), ev("E5", "Тренировка", 1, 18, 0, 19, 0, "Ильдар"), ev("E6", "Звонок маме", 2, 17, 0, 18, 0, "Личное"),
]
const { page, browser, server, errors, sheet } = await boot2({ root, time: new Date("2026-11-05T03:11:00Z"), dark: DARK, events: ctx => EVS.map(f => f(ctx)) })   // чт 10:11 по Бангкоку
await page.evaluate(() => { D.gcal.calendars = ["Личное", "Работа", "Ильдар"].map(name => ({ name })); save(false); render() })
await page.waitForTimeout(800)
const ask = async v => { await page.waitForSelector("#ask-v"); await page.fill("#ask-v", String(v)); await page.locator('.sheet [data-a="ok"]').last().click(); await page.waitForTimeout(400) }
const closeAll = async () => { await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(350) }
const todayColor = t => page.evaluate(t => { const el = [...document.querySelectorAll(".daycard [data-ev]")].find(e => e.textContent.includes(t)); return el ? (el.style.getPropertyValue("--c") || (el.querySelector(".bar-l") || {}).style?.background || "") : null }, t)

// — до настройки (без семьи): всё цветом «Я», в ленте дней — точки
// без настройки календари не сливаются: основной («Личное», первый в списке Google) — цветом «Я», остальные — свои цвета
const c0 = [await todayColor("Падел"), await todayColor("Показ виллы"), await todayColor("Забрать детей")]
check(c0[0] === "#0A9F6E" && c0[1] && c0[2] && new Set(c0).size === 3, "без настройки: основной календарь цветом «Я», рабочий и другие — каждый своим", c0)
check(await page.$$eval(".week.strip .day.on .cdots i", l => l.length) === 3, "в ленте дней у дня точки цветов календарей", await page.$$eval(".week.strip .day.on .cdots i", l => l.length))
await page.evaluate(() => { D.gcal.calendars = [{ name: "Работа" }, { name: "Личное", primary: true }, { name: "Ильдар" }]; render() }); await page.waitForTimeout(300)
check(await todayColor("Падел") === "#0A9F6E" && await todayColor("Показ виллы") !== "#0A9F6E", "основной календарь Google (primary) — цветом «Я»", [await todayColor("Падел"), await todayColor("Показ виллы")])
await page.evaluate(() => { D.gcal.calendars = ["Личное", "Работа", "Ильдар"].map(name => ({ name })); render() }); await page.waitForTimeout(300)
// «Свой цвет» в «Цвета и календари»; выбор «Я» делает календарь зелёным, «+» — категорией
await page.evaluate(() => calSettings()); await page.waitForTimeout(400)
check(await page.$$eval('.sheet [data-cal="1"] .chip.on', l => l.map(b => b.textContent.trim()).join("|")) === "Свой цвет", "у рабочего календаря выбран «Свой цвет»")
await page.click('.sheet [data-cal="1"] [data-k="me"]'); await page.waitForTimeout(250)
check(await page.evaluate(() => D.cal.map["Работа"]) === "me" && await page.$$eval('.sheet [data-cal="1"] [data-k="auto"]', l => l.length) === 0, "выбор «Я» — календарь цветом «Я», «Свой цвет» пропал")
await page.evaluate(() => { delete D.cal.map["Работа"]; save(false) }); await closeAll(); await page.evaluate(() => render()); await page.waitForTimeout(300)

// — «Цвета и календари»: «+» у календаря «Ильдар» → своя категория «Муж»
await page.evaluate(() => calSettings()); await page.waitForTimeout(400)
check(await page.$$eval('.sheet [data-cal] [data-k="+"]', l => l.length) === 3, "у каждого календаря Google есть «+»")
check(await page.$$eval('.sheet [data-cal="0"] .chip', l => l.map(b => b.textContent.trim()).join("|")) === "Я|Скрыть|", "без семьи выбор: Я · Скрыть · +", await page.$$eval('.sheet [data-cal="0"] .chip', l => l.map(b => b.textContent.trim())))
await page.click('.sheet [data-cal="2"] [data-k="+"]'); await ask("Муж")
const S = await page.evaluate(() => ({ custom: D.cal.custom, map: D.cal.map }))
check(S.custom.length === 1 && S.custom[0].name === "Муж" && S.map["Ильдар"] === S.custom[0].k, "«+» создал категорию «Муж» и привязал к ней календарь", S)
const muzhC = S.custom[0].c
check(muzhC && muzhC !== "#0A9F6E", "у новой категории свой цвет", muzhC)
check(await page.$$eval('.sheet [data-cal="0"] .chip', l => l.map(b => b.textContent.trim()).join("|")) === "Я|Муж|Скрыть|", "категория появилась в выборе у всех календарей")
check(/Муж/.test(await page.textContent("#cs-rows")) && await page.$$eval("#cs-rows [data-cs-add]", l => l.length) === 1, "в списке цветов — «Муж» и кнопка «Своя категория»")
// цвет категории меняется
await page.click('#cs-rows [data-cs-k^="u:"]'); await page.waitForTimeout(250)
check(await page.$$eval("#cs-rows [data-cs-del]", l => l.length) === 1, "у своей категории есть «Удалить категорию» и «Переименовать»")
await page.click('#cs-rows [data-cs-c="#0A84FF"]'); await page.waitForTimeout(250)
check(await page.evaluate(() => layerC(D.cal.custom[0].k)) === "#0A84FF", "цвет категории выбирается из палитры")
// «Работа» — скрыть
await page.click('.sheet [data-cal="1"] [data-k="off"]'); await page.waitForTimeout(250)
check(await page.evaluate(() => D.cal.map["Работа"]) === "off", "календарь «Работа» скрыт")
await page.evaluate(() => { const s = document.querySelector(".sheet"); if (s) s.scrollTop = 0 })
await shot(page, SHOTS + `ll-2-colors${SUF}.png`, ".sheet")
await page.setViewportSize({ width: 390, height: 1500 }); await page.waitForTimeout(500)
await page.screenshot({ path: SHOTS + `ll-3-colors-cals${SUF}.png` })
await page.setViewportSize({ width: 390, height: 844 })
await closeAll(); await page.evaluate(() => render()); await page.waitForTimeout(400)

// — «Сегодня»: «Муж» своим цветом, «Работа» не показывается, точки двух цветов
check(await todayColor("Забрать детей") === "#0A84FF", "на «Сегодня» события мужа — цветом категории", await todayColor("Забрать детей"))
check(await todayColor("Падел") === "#0A9F6E", "свои — цветом «Я»")
check(await todayColor("Показ виллы") === null, "скрытый календарь не показывается на «Сегодня»")
check(await page.$$eval(".week.strip .day.on .cdots i", l => l.length) === 2, "в ленте дней две точки — «Я» и «Муж»", await page.$$eval(".week.strip .day.on .cdots i", l => l.length))
await shot(page, SHOTS + `ll-1-today${SUF}.png`)

// — свободное окно → полная форма события
const gap = await page.$('.daycard [data-gap]')
check(!!gap, "на «Сегодня» есть свободное окно")
const g = await page.evaluate(b => [+b.dataset.gap, +b.dataset.gapEnd], gap)
await gap.click(); await page.waitForTimeout(500)
const f = await page.evaluate(() => ({ t: !!document.querySelector(".sheet #cf-t"), s: (document.querySelector(".sheet #cf-s") || {}).value, m: (document.querySelector(".sheet #cf-m") || {}).value, l: !!document.querySelector(".sheet #cf-l"), r: !!document.querySelector(".sheet #cf-r"), box: document.querySelector(".sheet .cq-box").hidden, h: document.querySelector(".sheet h3").textContent }))
const want = await page.evaluate(s => iso(new Date(s)), g[0])
check(f.h === "Новое событие" && f.t && f.l && f.r && f.box, "открылась форма события: название, начало, длительность, напоминание, место", f)
check(f.s === want, "начало — время свободного окна", [f.s, want])
check(+f.m === Math.min(60, Math.round((g[1] - g[0]) / 60e3)), "длительность — по окну (не больше часа)", [f.m, g])
await page.screenshot({ path: SHOTS + `ll-4-gap-form${SUF}.png` })
// без названия не сохраняет
await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(300)
check(await page.$(".sheet #cf-t") !== null, "без названия форма не закрывается")
await page.fill(".sheet #cf-t", "Стоматолог"); await page.fill(".sheet #cf-l", "Bangkok Hospital"); await page.fill(".sheet #cf-m", "45")
await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(1500)
const made = await page.evaluate(() => (D.gcal.events || []).find(e => e.title === "Стоматолог"))
check(made && made.start === want && made.location === "Bangkok Hospital" && (new Date(made.end) - new Date(made.start)) / 60e3 === 45, "событие записано в календарь: время окна, место, 45 мин", made)

// — Изи: честное состояние календаря и кнопка
const fr = await page.evaluate(() => {
  const keep = { on: FRIEND.on, me: FRIEND.me, gc: FRIEND.gcalConnect }
  window.__gc = 0
  FRIEND.on = () => true; FRIEND.me = () => ({ name: "Лиля", email: "l@x", gcal: "" }); FRIEND.gcalConnect = () => { window.__gc++ }
  const sys = agentSystem()
  chatGo = []
  return { sys: sys.includes("Google Календарь НЕ подключён") && sys.includes("Настройки → Аккаунт → Подключить Google Календарь") && sys.includes("open_screen"), tool: chatTools().some(t => t.name === "open_screen") }
})
check(fr.sys, "без Google Изи знает: календарь НЕ подключён, путь «Настройки → Аккаунт»", fr)
check(fr.tool, "у Изи есть инструмент open_screen")
const tr = await page.evaluate(async () => { const r = await runTool("open_screen", { screen: "google_calendar" }); return { r, go: chatGo.slice() } })
check(tr.r.ok && tr.go.join() === "google_calendar", "open_screen ставит кнопку под ответ", tr)
await page.evaluate(() => { D.chat.push({ role: "user", text: "Подключи мой календарь", at: Date.now() }); D.chat.push({ role: "assistant", text: "Сам подключить Google Календарь я не могу — это делаете вы. Нажмите кнопку ниже или откройте Настройки → Аккаунт → «Подключить Google Календарь». Пока календаря Google нет, события живут внутри IZIDAY.", at: Date.now(), go: ["google_calendar"] }); save(false); setTab("chat") })
await page.waitForTimeout(700)
check(/Подключить Google Календарь/.test(await page.textContent('#view [data-go="google_calendar"]')), "под ответом кнопка «Подключить Google Календарь»")
await page.screenshot({ path: SHOTS + `ll-5-izi${SUF}.png` })
await page.click('#view [data-go="google_calendar"]'); await page.waitForTimeout(300)
check(await page.evaluate(() => window.__gc) === 1, "кнопка запускает подключение Google Календаря")
const st2 = await page.evaluate(() => { FRIEND.me = () => ({ name: "Лиля", gcal: "l@gmail.com" }); D.gcal.error = "доступ к Google Календарю отозван — подключите его снова: Настройки → Аккаунт"; return calStateLine() })
check(/ошибкой/.test(st2) && /заново/.test(st2), "при ошибке Изи видит ошибку и что надо подключить заново", st2)

check(!errors.length, "без ошибок в консоли", errors)
await browser.close(); server.close()
console.log(ok ? "CAL_LILY_OK" : "CAL_LILY_FAIL")
process.exit(ok ? 0 : 1)
