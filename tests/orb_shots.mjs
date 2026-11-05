// Снимки «одна сфера»: кнопка Изи, чат (пусто / есть текст), разговор, настройки. node tests/orb_shots.mjs <папка> [dark] [корень dist/web]
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const dark = process.argv[3] === "dark", sfx = dark ? "-dark" : ""
const root = process.argv[4] || new URL("../dist/web/", import.meta.url).pathname
const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z"), dark })
await page.evaluate(() => {
  speechSynthesis.getVoices = () => []; speechSynthesis.speak = u => { setTimeout(() => u.onstart && u.onstart(), 30) }; speechSynthesis.cancel = () => {}
  window.SpeechRecognition = class { start() {} stop() {} abort() {} }
})
await page.waitForTimeout(800)
await page.screenshot({ path: `${out}/today${sfx}.png` })
await page.screenshot({ path: `${out}/fab${sfx}.png`, clip: { x: 125, y: 744, width: 140, height: 100 } })
await page.evaluate(() => { D.chat = [{ role: "user", text: "что у меня вечером?", at: Date.now() - 600e3, voice: true }, { role: "assistant", text: "В 19:00 падел в Padel Club, ехать 25 минут — выезжайте в 18:30.", at: Date.now() - 590e3 }]; setTab("chat") })
await page.waitForTimeout(800); await page.screenshot({ path: `${out}/chat${sfx}.png` })
await page.fill("#chat-in", "перенеси падел на субботу"); await page.waitForTimeout(400)
await page.screenshot({ path: `${out}/chat-typed${sfx}.png` })
await page.fill("#chat-in", "")
if (typeof (await page.evaluate(() => typeof talkOpen)) === "string" && await page.evaluate(() => typeof talkOpen === "function")) {
  await page.evaluate(() => { talkOpen() }); await page.waitForTimeout(600)
  await page.evaluate(() => { talkState("say", "Лучше перенести падел на субботу: в пятницу у вас показ до семи вечера.", "Вы: а если в пятницу вечером?") })
  for (let k = 0; k < 40; k++) { await page.evaluate(() => { SILK.ie = 1.2 }); await page.waitForTimeout(40) }
  await page.screenshot({ path: `${out}/talk${sfx}.png` })
  await page.evaluate(() => { talkState("listen", null, "Хорошо, перенеси на субботу на десять утра") })
  for (let k = 0; k < 40; k++) { await page.evaluate(() => { SILK.ye = 1.2 }); await page.waitForTimeout(40) }
  await page.screenshot({ path: `${out}/talk-you${sfx}.png` })
}
console.log("errors", errors)
await browser.close(); server.close()
