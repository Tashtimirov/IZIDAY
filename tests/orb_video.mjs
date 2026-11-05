// Кадры кнопки Изи с ровными «кадрами экрана» 60 в секунду (время округляется до мс и чуть плавает, ±1,5 мс, как в настоящем браузере).
// node tests/orb_video.mjs <корень dist/web> <папка> [кадров]
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const [root, out, n = 360] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true })
const { page, browser, server } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z") })
await page.evaluate(() => { window.__q = []; window.__t = performance.now(); let z = 7; window.__j = () => { z = (z * 16807) % 2147483647; return (z / 2147483647 - .5) * 3 }; window.requestAnimationFrame = f => { __q.push(f); return __q.length } })
await page.waitForTimeout(300)
const r = await page.evaluate(() => { const b = document.querySelector("#fab .orb").getBoundingClientRect(); return { x: b.x - 6, y: b.y - 6, width: b.width + 12, height: b.height + 12 } })
for (let i = 0; i < +n; i++) {
  await page.evaluate(() => { __t += 1000 / 60; const q = __q; __q = []; const ts = Math.round(__t + __j()); q.forEach(f => f(ts)) })
  await page.screenshot({ path: `${out}/f${String(i).padStart(4, "0")}.png`, clip: r })
}
await browser.close(); server.close()
