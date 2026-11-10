// Живой разговор: Изи отвечает голосом даже при выключенном «Читать ответы вслух»,
// а если Safari не прислал конец речи — через пару секунд снова слушает. Провал — TALKWD_FAIL
import { boot2 } from "./today_boot.mjs"
const { page, browser, server } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-05T03:00:00Z") })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
await page.evaluate(() => {
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
  window.SAID = []
  speechSynthesis.speak = u => { SAID.push(u.text); setTimeout(() => u.onstart && u.onstart(), 10) }   // onend не приходит никогда
  speechSynthesis.cancel = () => {}
  window.RECS = []
  window.SpeechRecognition = class { constructor() { RECS.push(this) } start() {} stop() {} abort() {} }
  window.agentTurn = async () => { await new Promise(r => setTimeout(r, 300)); return "Привет, слышу тебя." }
})
await page.evaluate(() => setTab("chat")); await page.waitForTimeout(300)
await page.evaluate(() => iziSet("aloud", false))
ok(await page.evaluate(() => !IZX().aloud), "«Читать ответы вслух» выключено")
await page.evaluate(() => talkOpen()); await page.waitForTimeout(500)
await page.evaluate(() => { const r = RECS[RECS.length - 1]; r.onresult({ results: [Object.assign([{ transcript: "привет изи как дела" }], { isFinal: false })] }) })
await page.waitForTimeout(3300)
ok(await page.evaluate(() => SAID.includes("Привет, слышу тебя.")), "Изи ответила голосом")
ok(await page.evaluate(() => TALK.state === "say"), "говорит")
await page.waitForTimeout(4000)
ok(await page.evaluate(() => TALK.state === "listen"), "конец речи не пришёл — всё равно снова слушает")
// iPhone «вечно говорит»: speaking не сбрасывается — по пределу длины всё равно слушаем
await page.evaluate(() => { Object.defineProperty(speechSynthesis, "speaking", { get: () => true, configurable: true }); talkHear("Коротко.") })
await page.waitForTimeout(1500)
ok(await page.evaluate(() => TALK.state === "say"), "говорит (speaking завис)")
await page.waitForTimeout(5500)
ok(await page.evaluate(() => TALK.state === "listen"), "предел по длине — снова слушает")
await browser.close(); server && server.close && server.close()
console.log(fails ? "TALKWD_FAIL " + fails : "TALKWD_OK"); process.exit(fails ? 1 : 0)
