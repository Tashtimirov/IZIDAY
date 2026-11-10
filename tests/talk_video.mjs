// Видео шара живого разговора с ровными кадрами 30 в секунду: слушаю → говорите вы → думаю → говорит Изи → слушаю.
// node tests/talk_video.mjs <корень dist/web> <папка>
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const [root, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true })
const { page, browser, server } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z") })
await page.evaluate(() => {
  speechSynthesis.getVoices = () => []; speechSynthesis.speak = () => {}; speechSynthesis.cancel = () => {}
  window.SpeechRecognition = class { start() {} stop() {} abort() {} }
})
await page.evaluate(() => { talkOpen() }); await page.waitForTimeout(900)
await page.evaluate(() => { window.__q = []; window.__t = performance.now(); window.requestAnimationFrame = f => { __q.push(f); return __q.length } })
await page.waitForTimeout(200)
let i = 0
const tick = () => page.evaluate(() => { for (let k = 0; k < 2; k++) { __t += 1000 / 60; const q = __q; __q = []; q.forEach(f => f(Math.round(__t))) } })
const seg = async (n, st, who, izi, you) => {
  await page.evaluate(([st, izi, you]) => talkState(st, izi, you), [st, izi, you])
  for (let k = 0; k < n; k++) {
    if (who && k % 5 === 0 && (k / 5) % 5 !== 4) await page.evaluate(w => { SILK[w] = Math.min(1.3, SILK[w] + .5) }, who)
    await tick()
    await page.screenshot({ path: `${out}/f${String(i++).padStart(4, "0")}.png`, clip: { x: 0, y: 30, width: 390, height: 560 } })
  }
}
await seg(45, "listen", "", null, "")
await seg(90, "listen", "ye", null, "перенеси падел на субботу")
await seg(45, "think", "", "·  ·  ·", "перенеси падел на субботу")
await seg(110, "say", "ie", "Готово: падел в субботу в десять.", "")
await seg(40, "listen", "", null, "")
console.log("frames", i)
await browser.close(); server.close()
