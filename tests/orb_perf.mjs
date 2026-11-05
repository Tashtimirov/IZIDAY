// Замер плавности шара Изи: интервалы между кадрами волны и время отрисовки. node tests/orb_perf.mjs [корень] [замедление CPU]
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const thr = +(process.argv[3] || 4)
const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z") })
await page.evaluate(() => { $("#fab .orb canvas").dataset.lv = 6 })   // шар с рангом: с подсветкой
const cdp = await page.context().newCDPSession(page)
await cdp.send("Emulation.setCPUThrottlingRate", { rate: thr })
await page.evaluate(() => {
  window.__d = []; const o = silkOrb
  silkOrb = function (c) { const t0 = performance.now(); o.apply(this, arguments); if (c.closest("#fab")) __d.push([t0, performance.now() - t0]) }
})
await page.waitForTimeout(4000)
const r = await page.evaluate(() => { const d = __d.slice(5); const iv = d.slice(1).map((x, i) => x[0] - d[i][0]); const s = a => a.slice().sort((p, q) => p - q)
  const q = (a, p) => s(a)[Math.floor(a.length * p)]
  return { frames: d.length, fps: (d.length / ((d.at(-1)[0] - d[0][0]) / 1000)).toFixed(1), ivMed: q(iv, .5).toFixed(1), iv95: q(iv, .95).toFixed(1), ivMax: Math.max(...iv).toFixed(1), jitterOver50: iv.filter(x => x > 50).length, drawMed: q(d.map(x => x[1]), .5).toFixed(2), draw95: q(d.map(x => x[1]), .95).toFixed(2) } })
console.log(JSON.stringify(r), errors.length ? errors : "")
await browser.close(); server.close()
