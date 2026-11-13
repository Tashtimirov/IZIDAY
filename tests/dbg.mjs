import { boot2 } from "./today_boot.mjs"
const { page, browser, server } = await boot2({ root: process.argv[2], time: new Date("2026-11-12T08:40:00Z"), dark: true })
console.log(await page.evaluate(() => [typeof planForm, Object.keys(window).length, Object.keys(window).filter(k => /Form$/.test(k)).join(",")]))
await page.evaluate(() => planForm()); await page.waitForTimeout(500)
console.log(await page.evaluate(() => [...document.querySelectorAll(".pl-pct input")].map(i => getComputedStyle(i).backgroundColor + " / " + getComputedStyle(i).color)))
await browser.close(); server.close()
