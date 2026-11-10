// Живой разговор: смахнули вниз — окно сразу уезжает с того места, где отпустили палец, микрофон гаснет.
// Быстрый короткий рывок тоже закрывает; отменённое касание (touchcancel) не оставляет окно на полпути. Провал — SWIPE_FAIL
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const { page, browser, server } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z") })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
await page.evaluate(() => {
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
  speechSynthesis.speak = () => {}; speechSynthesis.cancel = () => {}
  window.RECS = []
  window.SpeechRecognition = class { constructor() { RECS.push(this) } start() { this.on = true } stop() { this.on = false } abort() { this.on = false } }
  window.drag = (path, end = "touchend", gap = 16) => new Promise(res => {
    const el = document.getElementById("talk")
    const tc = y => [new Touch({ identifier: 1, target: el, clientX: 200, clientY: y })]
    el.dispatchEvent(new TouchEvent("touchstart", { touches: tc(path[0]), bubbles: true }))
    let i = 1
    const step = () => {
      if (i < path.length) { el.dispatchEvent(new TouchEvent("touchmove", { touches: tc(path[i++]), bubbles: true })); return setTimeout(step, gap) }
      el.dispatchEvent(new TouchEvent(end, { touches: [], bubbles: true })); res()
    }
    setTimeout(step, gap)
  })
  window.sheetY = () => { const s = document.querySelector("#talk .tk-sheet"); return s ? s.getBoundingClientRect().top : null }
})
await page.evaluate(() => setTab("chat")); await page.waitForTimeout(300)
// 1. медленно протянули на 300 px и отпустили
await page.evaluate(() => talkOpen()); await page.waitForTimeout(700)
await page.evaluate(() => drag([100, 160, 220, 280, 340, 400], "touchend", 60))
const y1 = await page.evaluate(() => sheetY()); await page.waitForTimeout(150)
const y2 = await page.evaluate(() => sheetY())
ok(y2 > y1 + 40, `окно сразу едет вниз после отпускания (${Math.round(y1)} → ${Math.round(y2)})`)
await page.waitForTimeout(80)
ok(await page.evaluate(() => RECS.every(r => !r.on)), "микрофон выключен")
await page.waitForTimeout(600)
ok(await page.evaluate(() => !document.getElementById("talk") && !TALK), "окно убрано")
// 2. быстрый короткий рывок вниз на 70 px
await page.evaluate(() => talkOpen()); await page.waitForTimeout(700)
await page.evaluate(() => drag([100, 125, 150, 170], "touchend", 16))
await page.waitForTimeout(600)
ok(await page.evaluate(() => !TALK), "быстрый рывок закрывает")
// 3. касание отменено системой на полпути (коротко) — окно возвращается на место
await page.evaluate(() => talkOpen()); await page.waitForTimeout(700)
await page.evaluate(() => drag([100, 130, 160], "touchcancel", 80))
await page.waitForTimeout(600)
ok(await page.evaluate(() => TALK && Math.abs(sheetY()) < 2), "touchcancel — окно вернулось, разговор открыт")
await browser.close(); server && server.close && server.close()
console.log(fails ? "SWIPE_FAIL " + fails : "SWIPE_OK"); process.exit(fails ? 1 : 0)
