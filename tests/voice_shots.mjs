// Снимки голосового Изи: настройки помощника, выбор голоса, живой разговор (говорит Изи / говорите вы)
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const dark = process.argv[3] === "dark", sfx = dark ? "-dark" : ""
const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-05T03:00:00Z"), dark })
// голоса iPhone и распознавание речи — заглушки
await page.evaluate(() => {
  const V = (name, uri, local) => ({ name, voiceURI: uri, lang: "ru-RU", localService: local, default: false })
  const vs = [V("Milena", "com.apple.voice.compact.ru-RU.Milena", true), V("Yuri (улучшенный)", "com.apple.voice.enhanced.ru-RU.Yuri", true), V("Katya", "com.apple.voice.compact.ru-RU.Katya", true)]
  speechSynthesis.getVoices = () => vs
  speechSynthesis.speak = u => { setTimeout(() => u.onstart && u.onstart(), 30) }
  speechSynthesis.cancel = () => {}
  window.SpeechRecognition = class { start() {} stop() {} abort() {} }
})
const shotFull = async (file) => {
  const hh = await page.evaluate(() => { const v = document.querySelector("#view"); return Math.max(844, document.querySelector("#top").offsetHeight + v.scrollHeight + 140) })
  await page.setViewportSize({ width: 390, height: Math.ceil(hh) }); await page.waitForTimeout(500)
  await page.screenshot({ path: file }); await page.setViewportSize({ width: 390, height: 844 })
}
// 1. настройки — карточка «Помощник»
await page.evaluate(() => { setTab("more") }); await page.waitForTimeout(600)
await page.setViewportSize({ width: 390, height: 2400 }); await page.waitForTimeout(400)
const card = await page.$(".izi-card")
await card.screenshot({ path: `${out}/settings${sfx}.png` }); await page.setViewportSize({ width: 390, height: 844 })
// 2. выбор голоса
await page.evaluate(() => voicePicker()); await page.waitForTimeout(700)
await page.screenshot({ path: `${out}/voice-pick${sfx}.png` })
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(400)
// 3. чат с кнопкой «Поговорить»
await page.evaluate(() => { D.chat = [{ role: "user", text: "что у меня вечером?", at: Date.now() - 600e3, voice: true }, { role: "assistant", text: "В 19:00 падел в Padel Club, ехать 25 минут — выезжайте в 18:30.", at: Date.now() - 590e3 }]; setTab("chat") })
await page.waitForTimeout(700); await page.screenshot({ path: `${out}/chat${sfx}.png` })
// 4. живой разговор: говорит Изи
await page.evaluate(() => { talkOpen() }); await page.waitForTimeout(600)
await page.evaluate(() => { talkState("say", "Лучше перенести падел на субботу: в пятницу у вас показ до семи вечера.", "Вы: а если в пятницу вечером?") })
for (let k = 0; k < 40; k++) { await page.evaluate(() => { SILK.ie = 1.2 }); await page.waitForTimeout(40) }
await page.screenshot({ path: `${out}/talk-izi${sfx}.png` })
// 5. говорите вы
await page.evaluate(() => { talkState("listen", null, "Хорошо, перенеси на субботу на десять утра и напомни взять ракетку") })
for (let k = 0; k < 40; k++) { await page.evaluate(() => { SILK.ye = 1.2 }); await page.waitForTimeout(40) }
await page.screenshot({ path: `${out}/talk-you${sfx}.png` })
// 6. думает
await page.evaluate(() => { talkState("think", "·  ·  ·", "Хорошо, перенеси на субботу на десять утра и напомни взять ракетку") })
await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/talk-think${sfx}.png` })
// 7. видео: слушает → говорит Изи → слушает
if (process.argv[4] === "video") {
  fs.mkdirSync(`${out}/fr`, { recursive: true }); let i = 0
  const grab = async (n, st, who) => { await page.evaluate(([st]) => talkState(st, st === "say" ? "Готово: падел в субботу в десять, ракетку напомню утром." : null, st === "listen" ? "перенеси падел на субботу" : ""), [st])
    for (let k = 0; k < n; k++) { if (who && k % 6 === 0 && (k / 6) % 4 !== 3) await page.evaluate(w => { SILK[w] = 1.2 }, who); await page.screenshot({ path: `${out}/fr/f${String(i++).padStart(4, "0")}.png`, clip: { x: 0, y: 40, width: 390, height: 640 } }); await page.waitForTimeout(25) } }
  await grab(50, "listen", ""); await grab(90, "listen", "ye"); await grab(40, "think", ""); await grab(110, "say", "ie"); await grab(40, "listen", "")
  console.log("frames", i)
}
console.log("errors", errors)
await browser.close(); server.close()
