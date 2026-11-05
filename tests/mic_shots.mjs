// Снимки кнопки справа от поля: вопрос Изи (микрофон), Изи отвечает (стоп), пусто (микрофон), текст (➤). node tests/mic_shots.mjs <папка>
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-05T06:40:00Z") })
await page.evaluate(() => { speechSynthesis.speak = () => {}; speechSynthesis.cancel = () => {} })
await page.evaluate(() => { D.chat = [{ role: "user", text: "что съел на обед — паста с курицей", at: Date.now() - 120e3 }]; setTab("chat") }); await page.waitForTimeout(600)
await page.evaluate(() => { chatBusy = true; chatStopCtl = new AbortController(); renderChat(); setBusyUI() }); await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/1-izi-answers-stop.png` })
await page.evaluate(() => { chatAsk("Это паста с курицей и морковью: около 650 ккал, белки 42 г, жиры 16 г, углеводы 82 г. Записать в еду?", ["Да", "Нет"]) }); await page.waitForTimeout(600)
await page.screenshot({ path: `${out}/2-question-mic.png` })
await page.evaluate(() => { chatSend("да"); chatBusy = false; chatStopCtl = null; D.chat.push({ role: "assistant", text: "Записал обед: 650 ккал.", at: Date.now() }); renderChat(); setBusyUI() }); await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/3-idle-mic.png` })
await page.fill("#chat-in", "а ужин?"); await page.waitForTimeout(300)
await page.screenshot({ path: `${out}/4-typed-send.png` })
console.log("errors", errors); await browser.close(); server.close()
