// Живой разговор продолжается: после ответа Изи микрофон снова слушает, даже если iPhone «глушит» первый
// запуск распознавания (Safari: нет начала звука; Whisper: звук не идёт). Провал — TURNS_FAIL
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const { page, browser, server } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z") })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
await page.evaluate(() => {
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
  window.SAID = []
  speechSynthesis.speak = u => { SAID.push(u.text); setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 30) }, 10) }
  speechSynthesis.cancel = () => {}
  window.RECS = []; window.DEAF = 0
  // DEAF — сколько следующих распознавателей «глухие»: start без начала звука
  window.SpeechRecognition = class { constructor() { RECS.push(this) } start() { this.on = true; this.deaf = DEAF > 0 && DEAF--; if (!this.deaf) setTimeout(() => this.onstart && this.onstart(), 20) } stop() { this.on = false } abort() { this.on = false } }
  window.hear = s => { const r = RECS.filter(r => r.on && !r.deaf).pop(); if (!r) return false; r.onresult({ results: [Object.assign([{ transcript: s }], { isFinal: false })] }); return true }
  let n = 0
  window.agentTurn = async () => { await new Promise(r => setTimeout(r, 200)); return "Ответ номер " + (++n) + "." }
})
const users = () => page.evaluate(() => D.chat.filter(m => m.role === "user").map(m => m.text))
await page.evaluate(() => setTab("chat")); await page.waitForTimeout(300)
await page.evaluate(() => talkOpen()); await page.waitForTimeout(500)
await page.evaluate(() => { hear("первая фраза для изи"); DEAF = 1 }); await page.waitForTimeout(3600)
ok(await page.evaluate(() => SAID.includes("Ответ номер 1.")), "Изи ответила на первую")
// после ответа первый распознаватель глухой
await page.waitForTimeout(300)
ok(await page.evaluate(() => RECS[RECS.length - 1].deaf), "после ответа включился глухой распознаватель")
ok(await page.evaluate(() => TALK.state === "listen"), "после ответа — снова «Слушаю»")
await page.waitForTimeout(3200)
ok(await page.evaluate(() => hear("вторая фраза для изи")), "глухой распознаватель заменён новым")
await page.waitForTimeout(3600)
ok((await users()).includes("вторая фраза для изи") && await page.evaluate(() => SAID.includes("Ответ номер 2.")), "вторая фраза ушла, Изи ответила: " + (await users()).join(" | "))
await page.waitForTimeout(900)
ok(await page.evaluate(() => hear("третья фраза")), "и снова слушает")
// Whisper: звук не идёт — переходим на Safari
await page.evaluate(() => { talkClose() }); await page.waitForTimeout(600)
await page.evaluate(() => {
  D.stt = { key: "k" }
  window.STT = Object.assign({}, STT, { on: () => true, prime() {}, record: async () => ({ frames: 0, voiced: 0, lastVoice: 0, close() { this.closed = true }, abort() {}, wav() {}, secs: () => 0 }), transcribe: async () => "" })
  talkOpen()
})
await page.waitForTimeout(2600)
ok(await page.evaluate(() => hear("whisper молчит а safari слышит")), "Whisper без звука — слушает Safari")
await browser.close(); server && server.close && server.close()
console.log(fails ? "TURNS_FAIL " + fails : "TURNS_OK"); process.exit(fails ? 1 : 0)
