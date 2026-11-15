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
// 4. смахнули с главного экрана: Изи молчит, попадаем в чат (не на «Сегодня»), переписка на месте
await page.evaluate(() => { setTab("today"); window.SPOKE = []; speechSynthesis.speak = u => SPOKE.push(u.text); D.chat.push({ role: "user", text: "Привет", at: Date.now(), voice: true }, { role: "assistant", text: "Привет! Чем помочь?", at: Date.now() }); save(false) })
await page.evaluate(() => talkOpen()); await page.waitForTimeout(700)
await page.evaluate(() => { TALK.heard = "запиши встречу на"; TALK.state = "listen" })
await page.evaluate(() => drag([100, 160, 220, 280, 340, 400], "touchend", 40))
await page.waitForTimeout(700)
ok(await page.evaluate(() => !TALK && tab === "chat"), "после смахивания открыт чат, а не главный экран")
ok(await page.evaluate(() => /Чем помочь/.test((document.querySelector(".chat-list") || {}).textContent || "")), "переписка разговора видна в чате")
ok(await page.evaluate(() => ($("#chat-in") || {}).value === "запиши встречу на"), "недосказанная фраза — в строке ввода")
ok(await page.evaluate(() => RECS.every(r => !r.on)), "микрофон выключен после смахивания")
// 5. вопрос Изи, пришедший после смахивания на голосовую реплику из разговора, не читается вслух
await page.evaluate(() => { $("#chat-in").value = ""; SPOKE = []; D.izi = Object.assign(D.izi || {}, { aloud: true }); D.chat.push({ role: "user", text: "удали встречу", at: talkHushAt - 500, voice: true }); chatAsk("Удалить встречу?", ["Да", "Нет"]) })
await page.waitForTimeout(300)
ok(await page.evaluate(() => SPOKE.length === 0), "после смахивания Изи не говорит вслух (вопрос только текстом)")
await page.evaluate(() => { const w = askWait; askWait = null; w && w("") })
// 6. кнопка «Закончить» с подписью — то же самое
await page.evaluate(() => setTab("money")); await page.waitForTimeout(200)
await page.evaluate(() => talkOpen()); await page.waitForTimeout(700)
ok(await page.evaluate(() => { const b = document.querySelector("#talk .tk-end"); return b && /Закончить/.test(b.textContent) && b.getBoundingClientRect().width > 60 }), "кнопка «Закончить» с подписью видна")
await page.evaluate(() => document.querySelector("#talk .tk-end").click()); await page.waitForTimeout(700)
ok(await page.evaluate(() => !TALK && tab === "chat" && RECS.every(r => !r.on)), "«Закончить» — разговор закрыт, открыт чат")
await browser.close(); server && server.close && server.close()
console.log(fails ? "SWIPE_FAIL " + fails : "SWIPE_OK"); process.exit(fails ? 1 : 0)
