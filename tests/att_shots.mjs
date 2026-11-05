// Снимки подписи к вложению: карточка над полем, подпись набрана, ушло с подписью, файл. node tests/att_shots.mjs <папка> <фото.jpg>
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const img = "data:image/jpeg;base64," + fs.readFileSync(process.argv[3]).toString("base64")
for (const dark of [false, true]) {
  const sfx = dark ? "-dark" : ""
  const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-05T06:40:00Z"), dark })
  await page.evaluate(() => { speechSynthesis.speak = () => {}; speechSynthesis.cancel = () => {} })
  await page.evaluate(() => { D.chat = [{ role: "user", text: "что у меня сегодня?", at: Date.now() - 600e3 }, { role: "assistant", text: "В 15:00 встреча с Олей, вечером спортзал.", at: Date.now() - 590e3 }]; setTab("chat") })
  await page.waitForTimeout(500)
  await page.evaluate(async src => { const t = await shrinkData(src, 360); attStage({ type: "image", media_type: "image/jpeg", data: "x", thumb: t }, "📷 Фото") }, img)
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${out}/1-photo-card${sfx}.png` })
  await page.fill("#chat-in", "это мой обед"); await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/2-caption${sfx}.png` })
  await page.evaluate(() => { const c = attCaption(chatAtt, "это мой обед", true); D.chat.push({ role: "user", text: c.show, prompt: c.prompt, voice: true, thumb: chatAtt.att.thumb, at: Date.now() }); chatAtt = null
    D.chat.push({ role: "assistant", text: "Обед: паста с курицей и морковью, около 650 ккал (Б 42 · Ж 16 · У 82). Записал в еду — за день 1 120 ккал.", at: Date.now() }); $("#chat-in").value = ""; grow($("#chat-in")); renderChat(); attTray(); setBusyUI() })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/3-sent${sfx}.png` })
  await page.evaluate(() => attStage({ type: "document", media_type: "application/pdf", data: "x", name: "Счёт за интернет, ноябрь.pdf" }, "📄 Счёт за интернет, ноябрь.pdf"))
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${out}/4-file-card${sfx}.png` })
  console.log("errors", errors); await browser.close(); server.close()
}
