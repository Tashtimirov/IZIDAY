// Скрытые события: «удали» для события, которое календарь удалить не даёт (праздники, чужой календарь, только чтение),
// скрывает его в IZIDAY — кнопкой и через Изи. Плюс hide_event / unhide_event, список «Скрытые события» с «Вернуть».
// Снимки — build/web-shots/hide-*.png. Запуск после сборки: node tests/hide_events_test.mjs [--dark]
import fs from "fs"
import { boot2, shot } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const dark = process.argv.includes("--dark"), sfx = dark ? "-dark" : ""
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const ev = (id, title, d, h, h2, calendar, repeats = false) => ({ bkk, iso }) => ({ id, title, start: iso(bkk(d, h)), end: iso(bkk(d, h2)), calendar, all_day: false, location: "", repeats, recurring: repeats })
const EVS = [ev("E1", "Показ виллы", 0, 11, 12, "Работа"), ev("H1", "Loy Krathong", 0, 14, 15, "Праздники Таиланда"),
  ev("S1", "Йога Алии", 0, 17, 18, "Алия", true), ev("S1", "Йога Алии", 1, 17, 18, "Алия", true), ev("E2", "Падел", 1, 19, 21, "Личное")]

const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-14T03:11:00Z"), dark, events: ctx => EVS.map(f => f(ctx)) })
await page.evaluate(() => {
  D.gcal.calendars = ["Личное", "Работа", "Праздники Таиланда", "Алия"].map(name => ({ name })); window.__del = []
  window.calDo = async (a, x) => { if (a !== "delete") return { ok: true }
    window.__del.push(x)
    const e = D.gcal.events.find(v => v.id === x.id)
    if (e && /Праздники|Алия/.test(e.calendar)) return { error: "Exception: Action not allowed" }
    if (x.id === "NET") return { error: "Google Календарь не ответил за 25 секунд — проверьте календарь, возможно, изменение всё же прошло" }
    D.gcal.events = D.gcal.events.filter(v => v.id !== x.id); return { ok: true } }
  window.chatConfirm = async () => true
  save(false); render()
})
await page.waitForTimeout(800)
const titles = () => page.evaluate(() => iphone().events.map(e => e.title + "@" + e.start.slice(8, 13)))
check((await titles()).includes("Loy Krathong@14T14"), "праздник виден до скрытия", await titles())

// 1. Изи: «удали Loy Krathong» — календарь не даёт, событие скрыто, ответ без «не могу»
const h1 = (await page.evaluate(() => iphone().events.find(e => e.id === "H1")))
const r1 = await page.evaluate(x => runTool("delete_event", { id: "H1", occurrence_start: x }), h1.start)
check(r1.ok && r1.hidden && /осталось/.test(r1.note), "Изи: удалить нельзя → скрыто, ok", r1)
check(!(await titles()).some(t => /Loy/.test(t)), "праздник пропал из календаря IZIDAY", await titles())
const tool = await page.evaluate(() => runTool("get_events", { start: "2026-11-14T00:00", end: "2026-11-16T00:00" }))
check(!JSON.stringify(tool).includes("Loy"), "и из ответа get_events для Изи")
check(await page.evaluate(() => live(D.goals).filter(g => g.kind === "evhide").length === 1), "запись evhide в goals (синхронизируется)")

// 2. Кнопка: повторяющееся событие из календаря Алии, «Это и все следующие» → скрыта вся серия
await page.evaluate(() => { const e = iphone().events.find(v => v.id === "S1"); eventSheet(e) })
await page.waitForTimeout(400)
await page.click('.sheet.show button:has-text("Удалить")'); await page.waitForTimeout(400)
await page.click('.sheet.show button:has-text("Это и все следующие")'); await page.waitForTimeout(600)
check(!(await titles()).some(t => /Йога/.test(t)), "кнопка: серия «Йога Алии» скрыта целиком", await titles())
const toastT = await page.evaluate(() => ["#undo.show", "#toast.show"].map(q => (document.querySelector(q) || {}).textContent || "").join(" "))
await page.screenshot({ path: SHOTS + `hide-0-toast${sfx}.png` })
check(/Серия скрыта в IZIDAY/.test(toastT), "подсказка: скрыто в IZIDAY (с «Отменить»)", toastT)

// 3. своё событие удаляется по-настоящему, сетевую ошибку не прячем
const r3 = await page.evaluate(() => runTool("delete_event", { id: "E2", occurrence_start: iphone().events.find(e => e.id === "E2").start }))
check(r3.ok && !r3.hidden && (await page.evaluate(() => __del.some(x => x.id === "E2"))), "своё событие — обычное удаление", r3)
await page.evaluate(() => { D.gcal.events.push({ id: "NET", title: "Созвон", start: "2026-11-15T10:00", end: "2026-11-15T11:00", calendar: "Работа" }); save(false) })
const r4 = await page.evaluate(() => runTool("delete_event", { id: "NET", occurrence_start: "2026-11-15T10:00" }))
check(r4.error && !(await titles()).length === false && (await titles()).some(t => /Созвон/.test(t)), "таймаут — честная ошибка, событие не скрыто", r4)

// 4. hide_event / unhide_event
const r5 = await page.evaluate(() => runTool("hide_event", { id: "E1", occurrence_start: iphone().events.find(e => e.id === "E1").start }))
check(r5.ok && !(await titles()).some(t => /Показ/.test(t)), "hide_event скрывает своё событие без удаления", r5)
check(!(await page.evaluate(() => __del.some(x => x.id === "E1"))), "hide_event не трогает Google")

// 5. список «Скрытые события» и «Вернуть»
await page.evaluate(() => { setTab("cal") }); await page.waitForTimeout(5600)
check(!!(await page.$('[data-do="cal-hidden"]')), "в календаре строка «Скрытые события»")
await page.evaluate(() => document.querySelector('[data-do="cal-hidden"]').scrollIntoView({ block: "center" })); await page.waitForTimeout(300)
await page.screenshot({ path: SHOTS + `hide-1-row${sfx}.png` })
await page.click('[data-do="cal-hidden"]'); await page.waitForTimeout(500)
const listT = await page.textContent(".sheet.show")
check(/Loy Krathong/.test(listT) && /все повторения/.test(listT) && /Показ виллы/.test(listT), "в списке три скрытых", listT)
await page.screenshot({ path: SHOTS + `hide-2-list${sfx}.png` })
await page.click('.sheet.show [data-back]'); await page.waitForTimeout(400)
check(await page.evaluate(() => live(D.goals).filter(g => g.kind === "evhide").length === 2), "«Вернуть» снимает одно скрытие")
const r6 = await page.evaluate(() => runTool("unhide_event", { query: "йога" }))
check(r6.ok && (await titles()).some(t => /Йога/.test(t)), "unhide_event: серия вернулась", r6)

// 6. Изи в чате: ответ, когда удалить нельзя
await page.evaluate(() => { const s = stack.slice(); s.forEach(x => x.close()) }); await page.waitForTimeout(300)
await page.evaluate(() => { D.chat.push({ role: "user", text: "Удали Loy Krathong", at: Date.now() - 4000 }, { role: "assistant", text: "Скрыл «Loy Krathong» в IZIDAY — в календаре «Праздники Таиланда» оно осталось. Вернуть можно в Календаре → «Скрытые события».", at: Date.now() }); save(false); setTab("chat") })
await page.waitForTimeout(900)
await page.screenshot({ path: SHOTS + `hide-3-chat${sfx}.png` })

check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()
console.log(ok ? "HIDE_EVENTS_OK" : "HIDE_EVENTS_FAIL")
process.exit(ok ? 0 : 1)
