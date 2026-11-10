// Видео волн шара разговора с «настоящим» входом: громкость Whisper каждые ~100 мс (rms 0,01…0,16, паузы между словами),
// слова голоса Изи каждые ~0,3 с. Одинаковые случайные числа — можно сравнить было/стало.
// node tests/talk_wave_video.mjs <корень dist/web> <папка>
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const [root, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true })
const { page, browser, server } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z") })
await page.evaluate(() => {
  speechSynthesis.getVoices = () => []; speechSynthesis.speak = () => {}; speechSynthesis.cancel = () => {}
  window.SpeechRecognition = class { start() {} stop() {} abort() {} }
})
await page.evaluate(() => { talkOpen() }); await page.waitForTimeout(900)
// сторожа разговора (тишина → «Пауза») в браузере без микрофона мешают — держим нужное состояние сами
await page.evaluate(() => { const t = TALK; for (const k of ["talkListen", "talkWake"]) window[k] = () => {}; window.__st = s => { if (t.state !== s.st) talkState(s.st, s.izi, s.you) } })
await page.evaluate(() => { window.__q = []; window.__t = performance.now(); window.requestAnimationFrame = f => { __q.push(f); return __q.length } })
await page.waitForTimeout(200)
let i = 0, seed = 7
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const tick = () => page.evaluate(() => { for (let k = 0; k < 2; k++) { __t += 1000 / 60; const q = __q; __q = []; q.forEach(f => f(Math.round(__t))) } })
const voice = (w, l) => page.evaluate(([w, l]) => {
  if (typeof silkVoice === "function") silkVoice(w, w === "ye" ? Math.sqrt(l * 8) : .8)
  else SILK[w] = w === "ye" ? Math.min(1.3, SILK[w] + l * 6) : Math.min(1.3, SILK[w] + .45)
}, [w, l])
const seg = async (n, st, who, izi, you) => {
  await page.evaluate(([st, izi, you]) => talkState(st, izi, you), [st, izi, you])
  for (let k = 0; k < n; k++) {
    if (who === "ye" && k % 3 === 0) { const r = rnd(); if ((k / 3) % 8 < 6) await voice("ye", .01 + r * r * .15) }
    if (who === "ie" && k % 9 === 0 && (k / 9) % 6 !== 5) await voice("ie", 0)
    await page.evaluate(a => __st(a), { st, izi, you })
    await tick()
    await page.screenshot({ path: `${out}/f${String(i++).padStart(4, "0")}.png`, clip: { x: 0, y: 30, width: 390, height: 560 } })
  }
}
await seg(30, "listen", "", null, "")
await seg(120, "listen", "ye", null, "перенеси падел на субботу")
await seg(40, "think", "", "·  ·  ·", "перенеси падел на субботу")
await seg(120, "say", "ie", "Готово: падел в субботу в десять.", "")
await seg(40, "listen", "", null, "")
console.log("frames", i)
await browser.close(); server.close()
