// Снимки порядка блоков на «Сегодня»: сегодня и другой выбранный день. node tests/order_shots.mjs <папка> [dark] [корень]
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const dark = process.argv[3] === "dark", sfx = dark ? "-dark" : ""
const root = process.argv[4] || new URL("../dist/web/", import.meta.url).pathname
const time = new Date("2026-11-05T11:00:00+07:00")
const { page, browser, server, errors } = await boot2({ root, time, dark,
  events: ({ bkk, iso }) => [
    { id: "e1", title: "Показ квартиры, Kata", start: iso(bkk(0, 14)), end: iso(bkk(0, 15)), calendar: "Работа", color: "#0A84FF", location: "Kata Beach" },
    { id: "e2", title: "Падел", start: iso(bkk(0, 19)), end: iso(bkk(0, 20, 30)), calendar: "Личное", color: "#30D158" },
    { id: "e3", title: "Встреча с застройщиком", start: iso(bkk(1, 10)), end: iso(bkk(1, 11)), calendar: "Работа", color: "#0A84FF", location: "Офис" },
    { id: "e4", title: "Ужин с семьёй", start: iso(bkk(1, 19)), end: iso(bkk(1, 21)), calendar: "Личное", color: "#30D158" }],
  lists: ({ bkk, dk }) => ({
    rems: [{ id: "ra", date: +bkk(-1, 9), u: 1, title: "Отправить договор", due: dk(bkk(0, 0)), done: false },
      { id: "rb", date: +bkk(-1, 9), u: 1, title: "Позвонить маме", due: dk(bkk(0, 0)), done: false },
      { id: "rc", date: +bkk(-1, 9), u: 1, title: "Забрать документы", due: dk(bkk(1, 0)), done: false }],
    water: [{ id: "w1", date: +bkk(0, 9), u: 1, ml: 750 }],
    habits: [{ id: "hz", date: +bkk(-5, 9), u: 1, title: "Зарядка" }, { id: "hy", date: +bkk(-5, 9), u: 1, title: "Чтение 20 минут" }],
  }) })
await page.evaluate(() => { D.onb = Object.assign(D.onb || {}, { intro: 1, seen: 1, steps: { done: 1, hide: 1 } }); D.who = "adult"; save(false) })
const full = async (file) => {
  const hh = await page.evaluate(() => { window.scrollTo(0, 0); const v = document.querySelector("#view"); v.scrollTop = 0; return Math.max(844, Math.min(3200, document.querySelector("#top").offsetHeight + v.scrollHeight + 140)) })
  await page.setViewportSize({ width: 390, height: Math.ceil(hh) }); await page.waitForTimeout(1300)
  await page.screenshot({ path: file }); await page.setViewportSize({ width: 390, height: 844 })
}
await page.evaluate(() => setTab("today")); await page.waitForTimeout(400)
await full(`${out}/1-today${sfx}.png`)
const order = await page.evaluate(() => [...document.querySelectorAll("#view > *")].map(e => (e.querySelector("h2,.dh-t,.t,b") || e).textContent.trim().slice(0, 30)))
console.log(order.join(" | "))
await page.evaluate(() => { const b = [...document.querySelectorAll("#strip .day")].find(b => b.classList.contains("td")).nextElementSibling; b.click() }); await page.waitForTimeout(600)
await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector("#view").scrollTop = 0 }); await page.waitForTimeout(800)
await page.screenshot({ path: `${out}/2-tomorrow${sfx}.png` })
console.log(errors.length ? "ERR " + errors.join("\n") : "no errors")
await browser.close(); server.close()
