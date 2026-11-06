// Лента дней на «Сегодня»: выбрать день в другой неделе, затем нажать сегодня — лента не должна уезжать. node tests/strip_test.mjs [корень]
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const time = new Date("2026-11-05T11:00:00+07:00")
const { page, browser, server } = await boot2({ root, time, events: () => [], lists: () => ({}) })
await page.evaluate(() => { D.onb = Object.assign(D.onb || {}, { intro: 1, seen: 1, steps: { done: 1, hide: 1 } }); D.who = "adult"; save(false); setTab("today") })
await page.waitForTimeout(400)
let bad = 0
const check = (ok, name, x) => { console.log((ok ? "✓ " : "✗ ") + name, ok ? "" : JSON.stringify(x)); if (!ok) bad++ }
const vis = () => page.evaluate(() => { const s = $("#strip"), col = s.children[1].offsetLeft - s.children[0].offsetLeft
  const d = new Date(+s.children[Math.round(s.scrollLeft / col)].dataset.day); return { first: d.toDateString(), lbl: $("#wk-lbl").textContent } })
const swipe = async (days) => { await page.evaluate(n => { const s = $("#strip"), col = s.children[1].offsetLeft - s.children[0].offsetLeft
  s.dispatchEvent(new Event("pointerdown")); s.scrollLeft += n * col }, days); await page.waitForTimeout(500) }
const tap = async (pred) => { await page.evaluate(p => { const b = [...$$("#strip .day")].find(new Function("b", p)); b.click() }, pred); await page.waitForTimeout(400) }
for (const w of [1, 3, -2, 6]) {
  await page.evaluate(() => { selDay = sod(new Date()); stripCenter = null; stripJump = true; render() }); await page.waitForTimeout(300)
  const v0 = await vis()
  await swipe(w * 7); const v1 = await vis()
  // нажать среду видимой недели
  await tap(`const s=$("#strip"),col=s.children[1].offsetLeft-s.children[0].offsetLeft,i=Math.round(s.scrollLeft/col);return b===s.children[i+2]`)
  const v2 = await vis()
  check(v2.first === v1.first, `неделя ${w}: после нажатия на день лента на месте`, { v1, v2 })
  // вернуться пальцем к неделе с сегодня и нажать сегодня
  await swipe(-w * 7); const v3 = await vis()
  await tap(`return b.classList.contains("td")`)
  const v4 = await vis()
  check(v4.first === v3.first && v4.first === v0.first, `неделя ${w}: после нажатия на сегодня лента на месте`, { v0, v3, v4 })
}
console.log(bad ? "STRIP_FAIL" : "STRIP_OK")
await browser.close(); if (server && server.close) server.close()
