// Доп. снимки: сжатая шапка, «+» в чате с «Очистить чат», окно «Что нового»
import { boot2 } from "./today_boot.mjs"
const out = process.argv[2]
for (const dark of [false, true]) {
  const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-14T03:00:00Z"), dark })
  const sfx = dark ? "-dark" : ""
  await page.evaluate(() => setTab("health")); await page.waitForTimeout(500)
  await page.evaluate(() => { const v = $("#view"); v.scrollTop = 400; v.dispatchEvent(new Event("scroll")) }); await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/x1-shapka${sfx}.png` })
  await page.evaluate(() => setTab("chat")); await page.waitForTimeout(500)
  await page.evaluate(() => plusMenu($(".chat-bar .cam"))); await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/x2-chat-plus${sfx}.png` })
  await page.evaluate(() => { plusClose && plusClose(); setTab("more") }); await page.waitForTimeout(500)
  await page.evaluate(() => DO["whats-new"]()); await page.waitForTimeout(700)
  await page.screenshot({ path: `${out}/x3-chto-novogo${sfx}.png` })
  console.log(errors.length ? "errors " + errors.join(" | ") : "OK")
  await browser.close(); server.close()
}
