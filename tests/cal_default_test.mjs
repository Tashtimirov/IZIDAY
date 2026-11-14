// Календарь по умолчанию для новых событий (Цвета и календари → «Новые события записывать в»),
// просьба Изи «в календарь С», выбор календаря в «Новом событии»; план подсказок — одна попытка в день.
// Снимки — build/web-shots/cd-*.png. Запуск после сборки: node tests/cal_default_test.mjs [--dark]
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const dark = process.argv.includes("--dark"), sfx = dark ? "-dark" : ""
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-14T03:11:00Z"), dark, events: () => [] })
await page.evaluate(() => {
  D.gcal.calendars = [{ name: "lilya@gmail.com", primary: true }, { name: "С" }, { name: "Работа" }, { name: "Праздники Таиланда", ro: true }]
  window.__cal = []
  window.hubPost = async h => { if (h.cal) { window.__cal.push(h.cal); return { cal: h.cal.action === "create" ? { ok: true, event: { id: "N" + __cal.length, title: h.cal.title, start: h.cal.start, calendar: h.cal.calendar || "lilya@gmail.com" } } : { events: D.gcal.events, calendars: D.gcal.calendars } } } return {} }
  save(false); render()
})
await page.waitForTimeout(600)
const closeAll = async () => { await page.evaluate(() => stack.slice().forEach(x => x.close())); await page.waitForTimeout(350) }
const snap = async n => { await page.waitForTimeout(350); await page.screenshot({ path: SHOTS + `cd-${n}${sfx}.png` }) }
const last = () => page.evaluate(() => __cal.filter(c => c.action === "create").pop())

// 1. Без выбора — как раньше: календарь не указываем, Google кладёт в основной
await page.evaluate(() => runTool("create_event", { title: "Маникюр", start: "2026-11-15T11:00", end: "2026-11-15T12:00" }))
check(!(await last()).calendar, "без настройки — календарь не передаём (основной)", await last())

// 2. Окно «Цвета и календари»: выбрать «С»
await page.evaluate(() => calSettings()); await page.waitForTimeout(400)
let t = await page.textContent(".sheet.show")
check(/Новые события записывать в/.test(t) && !/#cs-def[^]*Праздники/.test(await page.innerHTML("#cs-def")), "в окне есть выбор; календари только для чтения не предлагаем", t)
await page.click('#cs-def [data-def="С"]'); await page.waitForTimeout(200)
await page.evaluate(() => document.querySelector("#cs-def").scrollIntoView({ block: "center" }))
await snap("1-settings")
check(await page.evaluate(() => D.cal.def) === "С", "выбор сохранён")
await closeAll()

// 3. Изи создаёт событие без названия календаря → в «С»
await page.evaluate(() => runTool("create_event", { title: "Йога", start: "2026-11-16T09:00", end: "2026-11-16T10:00" }))
check((await last()).calendar === "С", "Изи: по умолчанию — в «С»", await last())
// 4. Просьба «в календарь работа» → «Работа»; «в календарь с» → «С»
await page.evaluate(() => runTool("create_event", { title: "Созвон", start: "2026-11-16T14:00", end: "2026-11-16T15:00", calendar: "календарь работа" }))
check((await last()).calendar === "Работа", "«в календарь работа» → «Работа»", await last())
await page.evaluate(() => runTool("create_event", { title: "Ужин", start: "2026-11-16T19:00", end: "2026-11-16T20:00", calendar: "с" }))
check((await last()).calendar === "С", "«с» → «С»", await last())
// 5. Нет такого календаря → Изи переспросит
const r = await page.evaluate(() => runTool("create_event", { title: "Бассейн", start: "2026-11-17T08:00", end: "2026-11-17T09:00", calendar: "Спорт" }))
check(r.error && /нет/.test(r.error) && /«С»/.test(r.error), "неизвестный календарь — Изи получает список и переспрашивает", r)
// 6. Изи знает календари и умолчание
const sys = await page.evaluate(() => chatSystem())
check(/куда можно записывать: «lilya@gmail.com», «С», «Работа»\./.test(sys) && /по умолчанию идут в «С»/.test(sys), "в подсказке Изи — список календарей и «С» по умолчанию", sys.match(/- Календари Google[^\n]*/))

// 7. «Новое событие»: чипы календаря, по умолчанию «С», можно сменить
await page.evaluate(() => calQuick({ text: "завтра в 15 стоматолог" })); await page.waitForTimeout(700)
check(await page.evaluate(() => document.querySelector('.sheet.show [data-cn="С"]').classList.contains("on")), "в новом событии выбран «С»")
await snap("2-new")
await page.click('.sheet.show [data-cn="Работа"]'); await page.waitForTimeout(200)
await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(600)
check((await last()).calendar === "Работа" && /стоматолог/i.test((await last()).title), "сохранили в выбранный «Работа»", await last())
await closeAll()

// 8. План подсказок: одна попытка в день
const plan = await page.evaluate(async () => {
  let calls = 0
  window.agentTurn = async () => { calls++; return "" }   // Изи ответил, но plan_day не вызвал
  window.aiKey = () => "k"
  D.planDay = ""; D.planTry = null
  await autoPlan(); await autoPlan(); await autoPlan()
  const a = calls
  // попытка оборвалась (телефон усыпил приложение): повтор не раньше чем через 30 минут и не больше двух
  D.planTry = { day: dayKey(new Date()), n: 1, at: Date.now() - 10 * 60e3 }; await autoPlan(); const b = calls
  D.planTry.at = Date.now() - 40 * 60e3; await autoPlan(); const c = calls
  D.planTry.at = Date.now() - 40 * 60e3; delete D.planTry.end; await autoPlan(); const d = calls
  // план уже составлен на другом устройстве — подсказки с отметкой pd пришли из таблицы
  D.planTry = null; D.planDay = ""; upsert("nudges", { id: "nX", date: Date.now() + 3600e3, text: "Выпей воды", pd: dayKey(new Date()) })
  await autoPlan(); const e = calls
  return { a, b, c, d, e }
})
check(plan.a === 1, "три открытия подряд — один запрос к Изи", plan)
check(plan.b === 1 && plan.c === 2 && plan.d === 2, "оборванная попытка повторяется один раз через 30 мин, не больше двух", plan)
check(plan.e === 2, "план с другого устройства — не составляем заново", plan)

check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()
console.log(ok ? "CALDEF_OK" : "CALDEF_FAIL")
process.exit(ok ? 0 : 1)
