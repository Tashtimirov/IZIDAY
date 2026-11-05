import { boot2 } from "./today_boot.mjs"
const out = process.argv[2]
const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-05T03:00:00Z") })
await page.evaluate(() => { setTab("chat") })
await page.waitForTimeout(500)
await page.evaluate(() => { voice = { text: "", t0: Date.now(), done: "", base: "" }; silkShow("Изи, что у меня сегодня вечером") })
let i = 0
const grab = async (n, talk) => { for (let k = 0; k < n; k++) { if (talk && k % 8 === 0) await page.evaluate(() => { SILK.en = 1 }); await page.screenshot({ path: `${out}/f${String(i++).padStart(4, "0")}.png`, clip: { x: 0, y: 560, width: 390, height: 284 } }); await page.waitForTimeout(40) } }
await grab(60, false); await grab(90, true); await grab(60, false)
console.log("frames", i, errors)
await browser.close(); server.close()
