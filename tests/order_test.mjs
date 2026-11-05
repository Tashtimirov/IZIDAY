// Перетаскивание блоков (order.js): удержание + ведение пальцем, порядок запоминается, нажатия внутри блоков не ломаются.
// node tests/order_test.mjs [корень] → ORDER_OK / ORDER_FAIL
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const time = new Date("2026-11-05T11:00:00+07:00")
const { page, browser, server, errors } = await boot2({ root, time,
  events: ({ bkk, iso }) => [{ id: "e1", title: "Показ квартиры", start: iso(bkk(0, 14)), end: iso(bkk(0, 15)), calendar: "Работа", color: "#0A84FF" }],
  lists: ({ bkk, dk }) => ({ rems: [{ id: "ra", date: +bkk(-1, 9), u: 1, title: "Отправить договор", due: dk(bkk(0, 0)), done: false }, { id: "rb", date: +bkk(-1, 9), u: 1, title: "Позвонить маме", due: dk(bkk(0, 0)), done: false }],
    habits: [{ id: "hz", date: +bkk(-5, 9), u: 1, title: "Зарядка" }] }) })
await page.evaluate(() => { D.onb = Object.assign(D.onb || {}, { intro: 1, seen: 1, steps: { done: 1, hide: 1 } }); D.who = "adult"; D.blocksHint = 1; save(false) })
const cdp = await page.context().newCDPSession(page)
const T = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] })
const fails = []
const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? "✓ " : "✗ ") + m) }
const order = () => page.evaluate(() => [...document.querySelectorAll("#view > *")].filter(e => e.dataset.bk).map(e => e.dataset.bk))
const box = sel => page.evaluate(s => { const el = typeof s === "string" ? document.querySelector(s) : null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 20, b: r.bottom, t: r.top } }, sel)
async function dragTo(fromSel, toY, steps = 14) {
  await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: "center" }), fromSel); await page.waitForTimeout(200)
  const a = await box(fromSel)
  await T("touchStart", a.x, a.y); await page.waitForTimeout(560)
  for (let i = 1; i <= steps; i++) { await T("touchMove", a.x, a.y + (toY - a.y) * i / steps); await page.waitForTimeout(30) }
  await page.waitForTimeout(150); await T("touchEnd"); await page.waitForTimeout(500)
}
const hab = '#view > [data-bk="Привычки"]'
await page.evaluate(() => setTab("today")); await page.waitForTimeout(500)
const o0 = await order()
console.log(o0.join(" | "))
ok(o0[0] === ".daycard" && o0[1] === "Напоминания" && o0[2] === "Привычки", "по умолчанию: события, напоминания, привычки")
await dragTo(hab, 140, 20); await page.waitForTimeout(1500)
const o1 = await order()
console.log(o1.join(" | "))
ok(o1[0] === "Привычки", "привычки подняты наверх")
ok(await page.evaluate(() => (D.blocks.today || [])[0] === "Привычки"), "порядок сохранён")
await page.evaluate(() => setTab("plans")); await page.waitForTimeout(300); await page.evaluate(() => setTab("today")); await page.waitForTimeout(500)
ok((await order())[0] === "Привычки", "после перерисовки порядок тот же")
// обычное нажатие внутри блока работает
const chk = await box('[data-check="ra"]')
await page.tap('[data-check="ra"]'); await page.waitForTimeout(600)
ok(await page.evaluate(() => (D.rems.find(r => r.id === "ra") || {}).done === true || !document.querySelector('[data-check="ra"]')), "нажатие на галочку внутри блока срабатывает")
// листание (палец сразу двигается) не поднимает блок
const r = await box('#view > [data-bk="Напоминания"]')
await T("touchStart", r.x, r.y); for (let i = 1; i <= 6; i++) { await T("touchMove", r.x, r.y - i * 12); await page.waitForTimeout(16) }
await page.waitForTimeout(600)
ok(!(await page.evaluate(() => !!document.querySelector(".bk-lift"))), "листание не поднимает блок"); await T("touchEnd")
// удержание без движения: блок поднят, после отпускания нажатие не открывает окно
const before = await page.evaluate(() => document.querySelectorAll(".sheet").length)
const rm = await box('#view > [data-bk="Напоминания"]')
await T("touchStart", rm.x, rm.y + 30); await page.waitForTimeout(560)
ok(await page.evaluate(() => !!document.querySelector(".bk-lift")), "удержание поднимает блок")
await T("touchEnd"); await page.waitForTimeout(500)
ok((await page.evaluate(() => document.querySelectorAll(".sheet").length)) === before, "после удержания окно не открылось")
// другие разделы
for (const t of ["plans", "money", "health"]) {
  await page.evaluate(t => setTab(t), t); await page.waitForTimeout(500)
  const o = await order(), last = `#view > [data-bk="${o[o.length - 1]}"]`, first = await box(`#view > [data-bk="${o[0]}"]`)
  await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: "center" }), last); await page.waitForTimeout(200)
  // тянем последний блок к верху экрана — список листается сам
  const a = await box(last)
  await T("touchStart", a.x, a.y); await page.waitForTimeout(560)
  for (let i = 1; i <= 10; i++) { await T("touchMove", a.x, a.y + (130 - a.y) * i / 10); await page.waitForTimeout(30) }
  await page.waitForTimeout(2500); await T("touchMove", a.x, 129); await page.waitForTimeout(300); await T("touchEnd"); await page.waitForTimeout(500)
  const n = await order()
  console.log(t + ": " + n.join(" | "))
  ok(n.indexOf(o[o.length - 1]) < o.length - 2 && n.length === o.length, `${t}: блок переехал вверх`)
  ok(await page.evaluate(t => (D.blocks[t] || []).length > 0, t), `${t}: порядок сохранён`)
}
// вернуть как было
await page.evaluate(() => setTab("more")); await page.waitForTimeout(400)
await page.click('[data-do="bk-reset"]'); await page.waitForTimeout(300)
ok(await page.evaluate(() => !Object.keys(D.blocks).length), "«Вернуть как было» очищает порядок")
await page.evaluate(() => setTab("today")); await page.waitForTimeout(400)
ok((await order())[0] === ".daycard", "после сброса — порядок по умолчанию")
// новый блок, которого нет в сохранённом порядке, встаёт за своим соседом
ok(await page.evaluate(() => JSON.stringify(BLOCKS.merge(["a", "b", "x", "c"], ["c", "a", "b"])) === JSON.stringify(["c", "a", "b", "x"])), "новый блок — за соседом по умолчанию")
ok(!errors.length, "без ошибок" + (errors.length ? ": " + errors.join("; ") : ""))
console.log(fails.length ? "ORDER_FAIL" : "ORDER_OK")
await browser.close(); server.close()
