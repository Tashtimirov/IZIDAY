// Карточка события (все сведения + правка, календарь только для чтения → «Скрыть») и окно напоминания
// (открыть любую позицию, поправить, добавить время). Снимки — build/web-shots/ee-*.png.
// Запуск после сборки: node tests/event_edit_test.mjs [--dark]
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const dark = process.argv.includes("--dark"), sfx = dark ? "-dark" : ""
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const ev = (id, title, d, h, h2, calendar, x = {}) => ({ bkk, iso }) => Object.assign({ id, title, start: iso(bkk(d, h)), end: iso(bkk(d, h2)), calendar, all_day: false, location: "", notes: "" }, x)
const EVS = [ev("E1", "Показ виллы", 0, 15, 16, "Работа", { location: "Laguna, Bang Tao", notes: "Клиент из Москвы, бюджет до 25 млн.\nВзять ключи и планировки." }),
  ev("H1", "Loy Krathong", 0, 18, 19, "Праздники Таиланда"), ev("A1", "Йога Алии", 0, 19, 20, "Алия", { recurring: true }),
  ({ bkk, iso }) => ({ id: "D1", title: "День рождения мамы", start: iso(bkk(1, 0)).slice(0, 10), end: iso(bkk(1, 0)).slice(0, 10), all_day: true, calendar: "Личное", location: "", notes: "" })]
const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-14T03:11:00Z"), dark, events: ctx => EVS.map(f => f(ctx)) })
await page.evaluate(() => {
  D.gcal.calendars = ["Личное", "Работа", "Праздники Таиланда", "Алия"].map(name => ({ name })); window.__upd = []
  window.calDo = async (a, x) => { if (a !== "update") return { ok: true }
    window.__upd.push(x)
    const e = D.gcal.events.find(v => v.id === x.id)
    if (e && /Алия/.test(e.calendar)) return { error: "Exception: Action not allowed" }
    return { ok: true } }
  remAdd({ title: "Позвонить в банк" }); remAdd({ title: "Забрать костюм из химчистки", due: dayKey(new Date()) }); remAdd({ title: "Оплатить интернет", due: dayKey(new Date()) + "T18:00" })
  save(false); render()
})
await page.waitForTimeout(800)
const closeAll = async () => { await page.evaluate(() => stack.slice().forEach(x => x.close())); await page.waitForTimeout(350) }
const T = () => page.textContent(".sheet.show")
const snap = async n => { await page.waitForTimeout(350); await page.screenshot({ path: SHOTS + `ee-${n}${sfx}.png` }) }
const set = (q, v) => page.evaluate(([q, v]) => { const el = document.querySelector(".sheet.show " + q); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })) }, [q, v])

// 1. Карточка: начало, конец, длительность, место, календарь, описание
await page.evaluate(() => eventSheet(iphone().events.find(e => e.id === "E1"))); await page.waitForTimeout(400)
let t = await T()
check(/Показ виллы/.test(t) && /15:00–16:00 · 1 ч/.test(t) && /Laguna/.test(t) && /Календарь «Работа»/.test(t) && /бюджет до 25 млн/.test(t), "карточка показывает время, место, календарь и описание", t)
check(/Изменить/.test(t) && /Удалить/.test(t) && /Скрыть/.test(t), "кнопки с подписями")
await snap("1-card")

// 2. Правка: название, начало (конец едет следом), место, описание → в Google Календарь уходит только изменённое
await page.click('.sheet.show [data-a="edit"]'); await page.waitForTimeout(250)
await snap("2-edit")
const day = await page.evaluate(() => dayKey(new Date()))
await set("#ee-t", "Показ виллы в Laguna"); await set("#ee-s", day + "T16:30")
check(await page.evaluate(() => document.querySelector("#ee-e").value.slice(11)) === "17:30", "сдвинули начало — конец сдвинулся на ту же длительность")
await set("#ee-e", day + "T18:00"); await set("#ee-l", "Laguna Park 2")
await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(500)
const u = await page.evaluate(() => __upd[0])
check(u && u.id === "E1" && u.title === "Показ виллы в Laguna" && u.start === day + "T16:30" && u.end === day + "T18:00" && u.location === "Laguna Park 2" && !("notes" in u) && u.occurrence_start === day + "T15:00", "update: название, время, место; описание не трогали — не отправляется", u)
t = await T()
check(/16:30–18:00 · 1 ч 30 мин/.test(t) && /Laguna Park 2/.test(t), "карточка сразу показывает новое", t)
check(await page.evaluate(() => iphone().events.find(e => e.id === "E1").title === "Показ виллы в Laguna"), "и календарь тоже, не дожидаясь обмена")
await closeAll()

// 3. Ничего не меняли — в календарь ничего не уходит; конец раньше начала — не сохраняем
await page.evaluate(() => eventSheet(iphone().events.find(e => e.id === "E1"))); await page.waitForTimeout(400)
await page.click('.sheet.show [data-a="edit"]'); await page.waitForTimeout(200)
await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(300)
check(await page.evaluate(() => __upd.length) === 1, "без изменений — без запроса")
await page.click('.sheet.show [data-a="edit"]'); await page.waitForTimeout(200)
await page.evaluate(d => { document.querySelector("#ee-e").value = d + "T10:00" }, day)
await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(300)
check(await page.evaluate(() => __upd.length) === 1 && !!(await page.$(".sheet.show #ee-e")), "конец раньше начала — не сохраняется")
await closeAll()

// 4. Праздники: только для чтения сразу, без «Изменить», со «Скрыть в IZIDAY»
await page.evaluate(() => eventSheet(iphone().events.find(e => e.id === "H1"))); await page.waitForTimeout(400)
t = await T()
check(/только для чтения/.test(t) && /Скрыть в IZIDAY/.test(t) && !(await page.$('.sheet.show [data-a="edit"]')), "праздники: честно «только для чтения», правки нет", t)
await snap("3-readonly")
await page.click('.sheet.show [data-a="hide"]'); await page.waitForTimeout(500)
check(!(await page.evaluate(() => iphone().events.some(e => e.id === "H1"))), "«Скрыть в IZIDAY» убирает событие")

// 5. Чужой календарь: о запрете узнаём при сохранении, запоминаем, показываем честно
await closeAll()
await page.evaluate(() => eventSheet(iphone().events.find(e => e.id === "A1"))); await page.waitForTimeout(400)
await page.click('.sheet.show [data-a="edit"]'); await page.waitForTimeout(200)
await set("#ee-t", "Йога"); await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(500)
t = await T()
check(/только для чтения/.test(t) && /Йога Алии/.test(t) && !(await page.$('.sheet.show [data-a="edit"]')), "календарь не дал изменить → карточка «только для чтения», название прежнее", t)
check(await page.evaluate(() => calRO({ calendar: "Алия" }) && !calRO({ calendar: "Работа" })), "запомнили, что календарь «Алия» только для чтения")
await closeAll()

// 6. Событие на весь день: «Указать время» превращает его в событие со временем
await page.evaluate(() => eventSheet(iphone().events.find(e => e.id === "D1"))); await page.waitForTimeout(400)
check(/Весь день/.test(await T()), "событие на весь день")
await page.click('.sheet.show [data-a="edit"]'); await page.waitForTimeout(200)
await page.click('.sheet.show [data-a="time"]'); await page.waitForTimeout(200)
const d1 = await page.evaluate(() => dayKey(addDays(new Date(), 1)))
await set("#ee-s", d1 + "T19:00"); await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(500)
const u2 = await page.evaluate(() => __upd[__upd.length - 1])
check(u2.id === "D1" && u2.start === d1 + "T19:00" && u2.end === d1 + "T20:00", "весь день → 19:00–20:00", u2)
await closeAll()

// 7. Напоминания: любая строка открывается; тому, что без времени, добавляем время
await page.evaluate(() => setTab("today")); await page.waitForTimeout(700)
const rows = await page.$$eval("[data-rem]", l => l.map(e => e.textContent.trim().replace(/\s+/g, " ")))
check(rows.some(r => /Позвонить в банк/.test(r)) && rows.some(r => /химчистки/.test(r)), "в списке на «Сегодня» строки открываются", rows)
await page.evaluate(() => { const el = [...document.querySelectorAll("[data-rem]")].find(e => /Позвонить в банк/.test(e.textContent)); el.scrollIntoView({ block: "center" }) })
await snap("4-list")
await page.evaluate(() => [...document.querySelectorAll("[data-rem]")].find(e => /Позвонить в банк/.test(e.textContent)).click()); await page.waitForTimeout(400)
t = await T()
check(/Напоминание/.test(t) && /Без срока/.test(t) && await page.evaluate(() => document.querySelector("#rm-t").value === "Позвонить в банк" && !document.querySelector("#rm-d").value && !document.querySelector("#rm-h").value), "окно напоминания без срока", t)
await snap("5-rem")
await set("#rm-h", "17:30"); await page.waitForTimeout(150)
check(/Напомню сегодня в 17:30/.test(await T()), "только время → ближайшее такое время (сегодня)", await T())
await set("#rm-t", "Позвонить в банк про карту")
await snap("6-rem-time")
await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(500)
const r1 = await page.evaluate(() => live(D.rems).find(r => /банк/.test(r.title)))
check(r1.title === "Позвонить в банк про карту" && r1.due === day + "T17:30", "сохранено: текст и время", r1)

// 8. Другое напоминание: дата есть, времени нет → добавили время и повтор; затем «Без срока»
const id2 = await page.evaluate(() => live(D.rems).find(r => /химчистки/.test(r.title)).id)
await page.evaluate(id => remSheet(id), id2); await page.waitForTimeout(400)
await set("#rm-h", "12:00"); await page.click('.sheet.show #rm-r [data-k="weekly"]'); await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(400)
const r2 = await page.evaluate(id => D.rems.find(r => r.id === id), id2)
check(r2.due === day + "T12:00" && r2.repeat && r2.repeat.freq === "weekly", "добавлено время и повтор", r2)
await page.evaluate(id => remSheet(id), id2); await page.waitForTimeout(400)
await page.click('.sheet.show [data-q="x"]'); await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(300)
check(/выберите день/i.test(await page.evaluate(() => (document.querySelector("#toast.show") || {}).textContent || "")), "повтор без дня — просим день")
await page.click('.sheet.show #rm-r [data-k=""]'); await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(400)
check(await page.evaluate(id => { const r = D.rems.find(r => r.id === id); return !r.due && !r.repeat }, id2), "«Без срока» убирает день и время")
// 9. «Удалить» и «Выполнено» из окна
await page.evaluate(id => remSheet(id), id2); await page.waitForTimeout(400)
await page.click('.sheet.show [data-a="del"]'); await page.waitForTimeout(400)
check(!(await page.evaluate(id => live(D.rems).some(r => r.id === id), id2)), "«Удалить» убирает напоминание")
const id3 = await page.evaluate(() => live(D.rems).find(r => /интернет/.test(r.title)).id)
await page.evaluate(id => remSheet(id), id3); await page.waitForTimeout(400)
await page.click('.sheet.show [data-a="done"]'); await page.waitForTimeout(400)
check(await page.evaluate(id => D.rems.find(r => r.id === id).done, id3), "«Выполнено» отмечает")

check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()
console.log(ok ? "EVENT_EDIT_OK" : "EVENT_EDIT_FAIL")
process.exit(ok ? 0 : 1)
