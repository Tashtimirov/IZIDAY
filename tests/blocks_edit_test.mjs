// Убрать и вернуть блоки (order.js): «Изменить блоки» → «−» → «Скрытые блоки» → «+». node tests/blocks_edit_test.mjs [папка снимков] [dark] → EDIT_OK / EDIT_FAIL
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; if (out) fs.mkdirSync(out, { recursive: true })
const dark = process.argv[3] === "dark", sfx = dark ? "-dark" : ""
const root = new URL("../dist/web/", import.meta.url).pathname
const time = new Date("2026-11-05T11:00:00+07:00")
const { page, browser, server, errors } = await boot2({ root, time, dark,
  events: ({ bkk, iso }) => [{ id: "e1", title: "Показ квартиры, Kata", start: iso(bkk(0, 14)), end: iso(bkk(0, 15)), calendar: "Работа", color: "#0A84FF" }],
  lists: ({ bkk, dk }) => ({ rems: [{ id: "ra", date: +bkk(-1, 9), u: 1, title: "Отправить договор", due: dk(bkk(0, 0)), done: false }],
    habits: [{ id: "hz", date: +bkk(-5, 9), u: 1, title: "Зарядка" }] }) })
await page.evaluate(() => { D.onb = Object.assign(D.onb || {}, { intro: 1, seen: 1, steps: { done: 1, hide: 1 } }); D.who = "adult"; D.blocksHint = 1; save(false) })
const cdp = await page.context().newCDPSession(page)
const T = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] })
const fails = [], ok = (c, m) => { if (!c) fails.push(m); console.log((c ? "✓ " : "✗ ") + m) }
const shot = async n => { if (out) { await page.waitForTimeout(700); await page.screenshot({ path: `${out}/${n}${sfx}.png` }) } }
const vis = () => page.evaluate(() => BLOCKS.blocks().map(e => e.dataset.bk))
const H = '#view > [data-bk="Привычки"]'
await page.evaluate(() => setTab("today")); await page.waitForTimeout(500)
ok(await page.evaluate(() => !!document.querySelector("#view > .bk-foot")), "внизу раздела есть «Изменить блоки»")
// долгое нажатие и отпускание без движения → правка
const a = await page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 20 } }, H)
await T("touchStart", a.x, a.y); await page.waitForTimeout(560); await T("touchEnd"); await page.waitForTimeout(800)
ok(await page.evaluate(() => BLOCKS.editing() && document.querySelectorAll("#view .bk-rm").length > 2), "удержание и отпускание включает правку, у блоков «−»")
ok(await page.evaluate(() => document.querySelector("#bk-pill.show") && !!document.querySelector("#view > .bk-tray")), "есть «Готово» и «Скрытые блоки»")
await shot("1-pravka")
// нажатие внутри блока в правке не срабатывает
const before = await page.evaluate(() => (D.rems.find(r => r.id === "ra") || {}).done)
await page.evaluate(() => document.querySelector('[data-check="ra"]')?.click()); await page.waitForTimeout(300)
ok((await page.evaluate(() => (D.rems.find(r => r.id === "ra") || {}).done)) === before, "в правке нажатия внутри блока не срабатывают")
// убрать «Привычки»
await page.tap(H + " > .bk-rm"); await page.waitForTimeout(900)
ok(!(await vis()).includes("Привычки"), "«Привычки» убраны")
ok(await page.evaluate(() => !!(D.blocksOff.today || {})["Привычки"]), "скрытые сохранены")
ok(await page.evaluate(() => !!document.querySelector('[data-bk-add="Привычки"]')), "«Привычки» в скрытых")
await page.tap('#view > [data-bk=".gq"] > .bk-rm'); await page.waitForTimeout(900)
await page.evaluate(() => document.querySelector("#view > .bk-tray").scrollIntoView({ block: "center" }))
await shot("2-skrytye")
// выход и перерисовка — блок остаётся скрытым
await page.tap("#bk-pill button"); await page.waitForTimeout(500)
ok(await page.evaluate(() => !BLOCKS.editing() && !document.querySelector(".bk-rm")), "«Готово» выключает правку")
await page.evaluate(() => setTab("plans")); await page.waitForTimeout(300); await page.evaluate(() => setTab("today")); await page.waitForTimeout(500)
ok(!(await vis()).includes("Привычки"), "после перерисовки «Привычки» скрыты")
// вернуть через «Изменить блоки» и «+»
await page.evaluate(() => document.querySelector("#view > .bk-foot").scrollIntoView({ block: "center" })); await page.waitForTimeout(200)
await page.tap("#view > .bk-foot button"); await page.waitForTimeout(600)
await page.tap('[data-bk-add="Привычки"]'); await page.waitForTimeout(900)
const v = await vis()
ok(v.indexOf("Привычки") === v.indexOf("Напоминания") + 1, "«Привычки» вернулись на своё место")
await shot("3-vernuli")
// уход в другой раздел выключает правку
await page.evaluate(() => setTab("money")); await page.waitForTimeout(400)
ok(await page.evaluate(() => !BLOCKS.editing() && !document.querySelector("#bk-pill.show")), "другой раздел — правка выключена")
// перетаскивание всё ещё работает: «Вернуть как было» сбрасывает и скрытые
await page.evaluate(() => setTab("more")); await page.waitForTimeout(400)
await page.click('[data-do="bk-reset"]'); await page.waitForTimeout(300)
ok(await page.evaluate(() => !Object.keys(D.blocksOff).length), "«Вернуть как было» возвращает скрытые")
ok(!errors.length, "без ошибок" + (errors.length ? ": " + errors.join("; ") : ""))
console.log(fails.length ? "EDIT_FAIL" : "EDIT_OK")
await browser.close(); server.close()
