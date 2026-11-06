// Отмена действия (undo.js): после отметки, удаления и правки — плашка «Отменить», возвращает как было.
// node tests/undo_test.mjs [корень] [папка для снимков] → UNDO_OK / UNDO_FAIL
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const shots = process.argv[3]; if (shots) fs.mkdirSync(shots, { recursive: true })
const time = new Date("2026-11-05T11:00:00+07:00")
const dark = process.argv[4] === "dark"
const { page, browser, server, errors } = await boot2({ root, time, dark,
  lists: ({ bkk, dk }) => ({ rems: [{ id: "ra", date: +bkk(-1, 9), u: 1, title: "Отправить договор", due: dk(bkk(0, 0)), done: false }, { id: "rb", date: +bkk(-1, 9), u: 1, title: "Позвонить маме", due: dk(bkk(0, 0)), done: false }],
    habits: [{ id: "hz", date: +bkk(-5, 9), u: 1, title: "Зарядка" }],
    shop: [{ id: "s1", date: +bkk(-1, 9), u: 1, title: "Молоко", done: false }, { id: "s2", date: +bkk(-1, 9), u: 2, title: "Хлеб", done: false }] }) })
await page.evaluate(() => { D.onb = Object.assign(D.onb || {}, { intro: 1, seen: 1, steps: { done: 1, hide: 1 } }); D.who = "adult"; D.blocksHint = 1; D.gamiOff = 1; save(false) })
const fails = [], ok = (c, m) => { if (!c) fails.push(m); console.log((c ? "✓ " : "✗ ") + m) }
const bar = () => page.evaluate(() => { const e = document.getElementById("undo"); return e && e.classList.contains("show") ? e.querySelector(".u-tx").textContent : "" })
const rem = id => page.evaluate(i => { const r = D.rems.find(x => x.id === i); return r && !r.deleted && !r.done ? "open" : r && r.done ? "done" : "gone" }, id)
await page.evaluate(() => setTab("today")); await page.waitForTimeout(500)

// 1. отметили напоминание
await page.tap('[data-check="ra"]'); await page.waitForTimeout(600)
ok(await rem("ra") === "done", "напоминание отмечено")
const t1 = await bar(); console.log("  плашка:", t1)
ok(/Выполнено/.test(t1) && /Отправить договор/.test(t1), "плашка: «Выполнено · Отправить договор»")
ok(!(await page.evaluate(() => document.getElementById("toast").classList.contains("show"))), "обычная подсказка не дублирует плашку")
if (shots) await page.screenshot({ path: `${shots}/1-otmetka.png` })
await page.tap("#undo .u-btn"); await page.waitForTimeout(500)
ok(await rem("ra") === "open", "«Отменить» вернуло напоминание")
ok(await page.evaluate(() => !!document.querySelector('[data-check="ra"]')), "оно снова на экране")
if (shots) await page.screenshot({ path: `${shots}/2-otmeneno.png` })
await page.waitForTimeout(1500)
ok(await bar() === "", "плашка ушла")

// 2. удаление покупки в окне списка, отмена перерисовывает окно
await page.evaluate(() => shopSheet()); await page.waitForTimeout(500)
await page.tap('[data-ix="s1"]'); await page.waitForTimeout(600)
ok(await page.evaluate(() => D.shop.find(x => x.id === "s1").deleted === true), "покупка удалена")
const t2 = await bar(); console.log("  плашка:", t2)
ok(/Удалено/.test(t2) && /Молоко/.test(t2), "плашка: «Удалено · Молоко»")
if (shots) await page.screenshot({ path: `${shots}/3-udalenie.png` })
await page.tap("#undo .u-btn"); await page.waitForTimeout(700)
ok(await page.evaluate(() => !D.shop.find(x => x.id === "s1").deleted), "покупка вернулась")
ok(await page.evaluate(() => !!document.querySelector('.sheet [data-ix="s1"]')), "и видна в открытом окне")
await page.evaluate(() => document.querySelectorAll(".scrim").forEach(s => s.click())); await page.waitForTimeout(500)

// 3. привычка: плашки нет (снимается тем же нажатием)
await page.tap('[data-habit="hz"]'); await page.waitForTimeout(600)
ok(await bar() === "", "отметка привычки — без плашки")

// 4. фоновая запись без нажатия — не отменяется
await page.waitForTimeout(1700)
await page.evaluate(() => upsert("rems", Object.assign({}, D.rems.find(x => x.id === "rb"), { title: "Позвонить маме вечером" })))
await page.waitForTimeout(500)
const t4 = await bar()
ok(t4 === "", "запись без нажатия — без плашки")

// 5. смахивание убирает плашку
await page.tap('[data-check="rb"]'); await page.waitForTimeout(600)
ok(/Выполнено/.test(await bar()), "плашка для второго напоминания")
const cdp = await page.context().newCDPSession(page)
const r = await page.evaluate(() => { const b = document.getElementById("undo").getBoundingClientRect(); return { x: b.left + 40, y: b.top + b.height / 2 } })
const T = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] })
await T("touchStart", r.x, r.y); for (let i = 1; i <= 8; i++) { await T("touchMove", r.x + i * 18, r.y); await page.waitForTimeout(16) } await T("touchEnd"); await page.waitForTimeout(600)
ok(await bar() === "", "смахнули — плашка ушла")
ok(await rem("rb") === "done", "а действие осталось")

// 6. ⌘Z на iPad
await page.keyboard.press("Meta+z"); await page.waitForTimeout(500)
ok(await rem("rb") === "open", "⌘Z отменил последнее действие")

ok(!errors.length, "без ошибок на странице" + (errors.length ? ": " + errors.join("; ") : ""))
await browser.close(); server.close()
console.log(fails.length ? "UNDO_FAIL" : "UNDO_OK")
