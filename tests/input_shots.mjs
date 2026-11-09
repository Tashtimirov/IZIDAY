// Снимки строки ввода «как в ChatGPT»: node tests/input_shots.mjs <папка> <клавиатура.jpg>
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const kb = process.argv[3] ? "data:image/jpeg;base64," + fs.readFileSync(process.argv[3]).toString("base64") : null
for (const dark of [true, false]) {
  const sfx = dark ? "-dark" : "-light"
  const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-09T08:40:00Z"), dark })
  await page.evaluate(() => { speechSynthesis.speak = () => {}; speechSynthesis.cancel = () => {} })
  await page.evaluate(() => { D.chat = [{ role: "user", text: "что у меня сегодня?", at: Date.now() - 600e3 }, { role: "assistant", text: "В 15:00 встреча с Олей, вечером спортзал. Напомнить выехать заранее?", at: Date.now() - 590e3 }]; save(false) })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/0-menu${sfx}.png` })
  // нажали «Изи» — чат и фокус в поле
  await page.tap("#fab"); await page.waitForTimeout(500)
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id)
  console.log("focus after tap:", focused)
  // клавиатура iPhone (картинка): поднимаем строку, как это делает приложение
  const showKb = () => page.evaluate(src => {
    if (!src) return
    let k = document.getElementById("fake-kb"); if (!k) { k = document.createElement("img"); k.id = "fake-kb"; k.src = src; k.style.cssText = "position:fixed;left:0;right:0;bottom:0;width:100%;z-index:99;display:block"; document.body.append(k) }
    const h = innerWidth * 1041 / 1290
    document.documentElement.style.setProperty("--kb", h + "px"); document.body.classList.add("kb")
  }, kb)
  await showKb(); await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}/1-open${sfx}.png` })
  await page.evaluate(() => { const i = $("#chat-in"); i.value = "Напомни завтра в 9 позвонить маме"; grow(i) }); await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}/2-typed${sfx}.png` })
  await page.evaluate(() => { const i = $("#chat-in"); i.value = ""; grow(i)
    voice = { done: "", base: "", bar: true, t0: Date.now(), text: "" }; pttShow("")
    setInterval(() => { SILK.en = Math.random() < .25 ? .05 : .4 + Math.random() * .6 }, 90) })
  await page.waitForTimeout(3200)
  await page.screenshot({ path: `${out}/3-dictate${sfx}.png` })
  await page.evaluate(() => { voiceReset(); D.chat.push({ role: "user", text: "Напомни завтра в 9 позвонить маме", at: Date.now() }); chatBusy = true; renderChat(); setBusyUI() })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/4-answering${sfx}.png` })
  console.log("errors", errors); await browser.close(); server.close()
}
