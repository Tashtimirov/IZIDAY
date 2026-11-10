// iPhone: «ухо» для перебивания берёт микрофон ДО речи (getUserMedia во время голоса iOS обрывает речь),
// перебить голосом можно; если с открытым микрофоном голос не пошёл — Изи говорит без «уха». Провал — BARGEIOS_FAIL
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const { page, browser, server } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z"), ctxOpts: { userAgent: UA } })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
await page.evaluate(() => {
  const b = Date.now(), p0 = performance.now(); Date.now = () => b + performance.now() - p0
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
  window.SAID = []; window.SPK = false; window.LOG = []; window.MUTE = false
  // iOS: микрофон открыли, пока голос звучит, — речь обрывается молча; MUTE — с открытым микрофоном голос не идёт вовсе
  speechSynthesis.speak = u => { SAID.push(u.text); LOG.push("speak"); if (MUTE && LIVE) return; u.tm = setTimeout(() => { SPK = true; u.onstart && u.onstart(); u.tm = setTimeout(() => { SPK = false; if (!u.killed) u.onend && u.onend() }, 700) }, 10); window.CUR = u }
  speechSynthesis.cancel = () => { if (window.CUR) clearTimeout(CUR.tm); SPK = false }
  Object.defineProperty(speechSynthesis, "speaking", { get: () => SPK, configurable: true })
  window.RECS = []
  window.SpeechRecognition = class { constructor() { RECS.push(this) } start() { this.on = true; setTimeout(() => { this.onstart && this.onstart(); this.onaudiostart && this.onaudiostart() }, 20) } stop() { this.on = false } abort() { this.on = false } }
  window.hear = s => { const r = RECS.filter(r => r.on).pop(); if (!r) return false; r.onresult({ results: [Object.assign([{ transcript: s }], { isFinal: false })] }); return true }
  window.LVL = .02; window.LIVE = false; window.GUM = 0; window.KILLED = 0
  window.STT = Object.assign({}, window.STT || {}, {
    on: () => false, prime() {}, live: () => LIVE, release() { LIVE = false; LOG.push("release") },
    record: async opts => {
      if (!LIVE) { GUM++; LOG.push("gum" + (SPK ? "-во-время-речи" : "")); if (SPK && window.CUR) { CUR.killed = true; KILLED++ } LIVE = true }
      const h = { opts, frames: 0, voiced: 0, lastVoice: 0, parts: [], stopped: false, ctx: { state: "running" },
        close() { this.stopped = true; clearInterval(this.iv) }, abort() { this.close() }, stop() { this.close() }, wav: () => "w", secs: () => 1, keepLast(s) { this.kept = s } }
      h.iv = setInterval(() => { if (h.stopped) return; h.frames++; h.opts.onLevel && h.opts.onLevel(LVL, .085) }, 85)
      return h
    }, transcribe: async () => ""
  })
  let n = 0; window.agentTurn = async () => { await new Promise(r => setTimeout(r, 100)); n++; return n === 1 ? "Раз предложение. Два предложение. Три предложение. Четыре предложение. Пять предложение." : "Поняла." }
})
ok(await page.evaluate(() => IS_IOS), "это iPhone")
const st = () => page.evaluate(() => TALK && TALK.state)
await page.evaluate(() => setTab("chat")); await page.waitForTimeout(300)
await page.evaluate(() => talkOpen()); await page.waitForTimeout(400)
await page.evaluate(() => hear("расскажи")); await page.waitForTimeout(4000)
ok(await st() === "say", "говорит: " + await st())
ok(await page.evaluate(() => KILLED === 0 && LOG.indexOf("gum") >= 0 && LOG.indexOf("gum") < LOG.indexOf("speak", 1)), "микрофон взят до речи, речь не оборвана: " + await page.evaluate(() => LOG.join(",")))
await page.evaluate(() => { LVL = .03 }); await page.waitForTimeout(900)
await page.evaluate(() => { LVL = .15 }); await page.waitForTimeout(450)
ok(await st() === "listen", "перебил голосом — слушает: " + await st() + " | " + await page.evaluate(() => (TALK.log || []).join(" · ")))
await page.evaluate(() => { LVL = .01; hear("стоп а завтра") }); await page.waitForTimeout(2600)
ok(await page.evaluate(() => /перебили/.test(D.chat.filter(m => m.role === "user").pop().prompt || "")), "ушло с пометкой")
await page.evaluate(() => talkClose()); await page.waitForTimeout(600)
// с открытым микрофоном iPhone не говорит — без «уха»
await page.evaluate(() => { MUTE = true; LIVE = false; SAID.length = 0; talkOpen() }); await page.waitForTimeout(400)
await page.evaluate(() => hear("ещё вопрос")); await page.waitForTimeout(7000)
ok(await page.evaluate(() => TALK.noEar && SAID.includes("Поняла.")), "голос не пошёл — сказала без уха: " + await page.evaluate(() => (TALK.log || []).join(" · ")))
await browser.close(); server && server.close && server.close()
console.log(fails ? "BARGEIOS_FAIL " + fails : "BARGEIOS_OK"); process.exit(fails ? 1 : 0)
