// История воды за сегодня в «Здоровье»: время и объём, новые сверху, удаление корзиной и смахиванием.
// Снимки — build/web-shots/water-log-*.png
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const NOW = new Date("2026-11-05T07:20:00Z")   // 14:20 по Бангкоку
const lists = ({ bkk }) => ({ water: [
  { id: "wa", date: +bkk(0, 7, 45), u: 1, ml: 250 }, { id: "wb", date: +bkk(0, 9, 10), u: 1, ml: 500 },
  { id: "wc", date: +bkk(0, 11, 30), u: 1, ml: 250 }, { id: "wd", date: +bkk(0, 13, 5), u: 1, ml: 330 },
  { id: "wy", date: +bkk(-1, 12), u: 1, ml: 2000 }] })
async function card(page, file) {
  const el = await page.evaluateHandle(() => [...document.querySelectorAll("#view .card")].find(c => /Вода/.test(c.querySelector("h2")?.textContent || "")))
  await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(900); await el.screenshot({ path: file })
}
for (const dark of [false, true]) {
  const { page, browser, server, errors } = await boot2({ root, time: NOW, lists, dark })
  await page.evaluate(() => setTab("health")); await page.waitForTimeout(1500); await page.evaluate(() => render()); await page.waitForTimeout(1200)
  const rows = await page.$$eval(".hl-wrow", r => r.map(x => x.innerText.replace(/\s+/g, " ").trim()))
  if (!dark) {
    check(rows.length === 4, "4 отметки за сегодня (вчерашняя не попала)", rows)
    check(rows[0] === "13:05 330 мл" && rows[3] === "07:45 250 мл", "новые сверху, время и объём", rows)
    const hh = await page.evaluate(() => { const c = document.querySelector(".hl-water"); return c.offsetHeight })
    const h0 = await page.evaluate(() => { const l = document.querySelector(".hl-wlog"), d = l.style.display; l.style.display = "none"; const r = document.querySelector(".hl-water").offsetHeight; l.style.display = d; return r })
    check(hh === h0, "плашка не выросла", [hh, h0])
  }
  await card(page, SHOTS + `water-log-${dark ? "dark" : "light"}.png`)
  if (!dark) {
    await page.click('[data-wdel="wb"]'); await page.waitForTimeout(500)
    await page.click('#layer button:has-text("Удалить")'); await page.waitForTimeout(800)
    const left = await page.$$eval(".hl-wrow", r => r.map(x => x.dataset.wrow))
    check(left.length === 3 && !left.includes("wb"), "нажатие и «Удалить» убирает отметку", left)
    check(/0,83 л/.test(await page.$eval("#view", v => v.innerText)), "итог пересчитан: 0,83 л")
    await card(page, SHOTS + "water-log-deleted.png")
    check(!errors.length, "без ошибок", errors)
  }
  await browser.close(); server.close()
}
console.log(ok ? "WATER_LOG_OK" : "WATER_LOG_FAIL")
