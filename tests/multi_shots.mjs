// Снимки «несколько фото сразу»: карточка с пачкой фото, подпись ко всем, ушло сеткой, камера серией. node tests/multi_shots.mjs <папка>
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
// ненастоящие «фото»: тарелка, чек, страница счёта — рисуются в браузере
const FAKE = () => {
  window.fakePhoto = (kind, hue) => {
    const c = document.createElement("canvas"); c.width = 900; c.height = 1200; const g = c.getContext("2d")
    const bg = g.createLinearGradient(0, 0, 900, 1200); bg.addColorStop(0, `hsl(${hue},35%,55%)`); bg.addColorStop(1, `hsl(${hue + 30},40%,30%)`); g.fillStyle = bg; g.fillRect(0, 0, 900, 1200)
    if (kind === "plate") {
      g.fillStyle = "#f4f1ea"; g.beginPath(); g.arc(450, 600, 330, 0, 7); g.fill()
      g.fillStyle = `hsl(${hue + 10},70%,55%)`; g.beginPath(); g.arc(380, 560, 140, 0, 7); g.fill()
      g.fillStyle = "#e9d9a8"; g.beginPath(); g.ellipse(560, 680, 130, 90, .4, 0, 7); g.fill()
      g.fillStyle = "#5c9e4a"; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(520 + i * 14, 470 + (i % 3) * 22, 26, 0, 7); g.fill() }
    } else {
      g.save(); g.translate(450, 600); g.rotate(kind === "check" ? -.06 : .03); g.fillStyle = "#fbfbf7"; g.fillRect(-260, -440, 520, 880)
      g.fillStyle = "#333"; g.font = "bold 44px sans-serif"; g.fillText(kind === "check" ? "BIG C" : "INVOICE", -200, -360)
      g.fillStyle = "#999"; for (let i = 0; i < 14; i++) g.fillRect(-200, -280 + i * 48, 260 + (i * 37) % 140, 16)
      g.fillStyle = "#333"; g.fillRect(-200, 400, 400, 6); g.restore()
    }
    return c.toDataURL("image/jpeg", .85)
  }
  window.fakeAtt = async (kind, hue) => { const u = fakePhoto(kind, hue); return { type: "image", media_type: "image/jpeg", data: u.split(",")[1], thumb: await shrinkData(u, 360) } }
  // камера: поток с холста
  navigator.mediaDevices.getUserMedia = async () => {
    const c = document.createElement("canvas"); c.width = 1080; c.height = 1440; const g = c.getContext("2d"), img = new Image()
    img.src = fakePhoto("plate", 25); await new Promise(r => img.onload = r)
    const tick = () => { g.drawImage(img, 0, 0, 1080, 1440); requestAnimationFrame(tick) }; tick()
    return c.captureStream(30)
  }
}
for (const dark of [false, true]) {
  const sfx = dark ? "-dark" : ""
  const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-05T06:40:00Z"), dark })
  await page.evaluate(() => { speechSynthesis.speak = () => {}; speechSynthesis.cancel = () => {} })
  await page.evaluate(FAKE)
  await page.evaluate(() => { D.chat = [{ role: "user", text: "что у меня сегодня?", at: Date.now() - 600e3 }, { role: "assistant", text: "В 15:00 встреча с Олей, вечером спортзал.", at: Date.now() - 590e3 }]; setTab("chat") })
  await page.waitForTimeout(500)
  // 1. из галереи выбрали 4 фото
  await page.evaluate(async () => { for (const [k, h] of [["plate", 25], ["plate", 140], ["check", 210], ["page", 260]]) attStage(await fakeAtt(k, h), "📷 Фото") })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${out}/1-pachka${sfx}.png` })
  // 2. нажали на кадр — «Убрать»
  await page.click(".att-th[data-k='1']"); await page.waitForTimeout(350)
  await page.fill("#chat-in", "обед и чек из Big C"); await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/2-podpis${sfx}.png` })
  // 3. ушло одним сообщением — в ленте сетка
  await page.evaluate(() => { $$(".att-th.pick").forEach(x => x.classList.remove("pick")); const c = attCaption(chatAtt, "обед и чек из Big C", false)
    D.chat.push({ role: "user", text: c.show, prompt: c.prompt, thumbs: chatAtt.map(x => x.att.thumb), at: Date.now() }); window.__p = c.prompt; chatAtt = null
    D.chat.push({ role: "assistant", text: "Обед: том ям и рис с овощами, около 720 ккал — записал в еду. Чек Big C: 486 ฿, продукты — записал расход. Третье фото — счёт за интернет на 599 ฿ до 10 ноября, поставил напоминание оплатить.", at: Date.now() }); $("#chat-in").value = ""; grow($("#chat-in")); renderChat(); attTray(); setBusyUI() })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/3-ushlo${sfx}.png` })
  if (!dark) console.log("prompt:", await page.evaluate(() => window.__p))
  // 4. камера серией: три щелчка
  await page.evaluate(() => seriesCam()); await page.waitForTimeout(900)
  for (let i = 0; i < 3; i++) { await page.click(".scam-shot"); await page.waitForTimeout(450) }
  await page.screenshot({ path: `${out}/4-kamera${sfx}.png` })
  await page.click(".scam-done"); await page.waitForTimeout(2000)
  await page.screenshot({ path: `${out}/5-posle-kamery${sfx}.png` })
  console.log("after cam:", await page.evaluate(() => chatAtt && chatAtt.length))
  // 6. меню «+»
  await page.evaluate(() => { chatAtt = null; attTray() }); await page.waitForTimeout(300)
  await page.click(".chat-bar .cam"); await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/6-menu${sfx}.png` })
  console.log("errors", errors); await browser.close(); server.close()
}
