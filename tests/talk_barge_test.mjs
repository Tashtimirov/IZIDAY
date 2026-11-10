// Перебить Изи голосом: пока она говорит, «ухо» слушает громкость; заговорили громче эха — замолкает, слушает,
// и сказанное уходит с пометкой, на чём перебили. Эхо не перебивает; шум без слов — договаривает. Провал — BARGE_FAIL
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const { page, browser, server } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z") })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
await page.evaluate(() => {
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
  window.SAID = []; window.SPK = false
  // каждая фраза звучит 700 мс
  speechSynthesis.speak = u => { SAID.push(u.text); u.tm = setTimeout(() => { SPK = true; u.onstart && u.onstart(); u.tm = setTimeout(() => { SPK = false; u.onend && u.onend() }, 700) }, 10); window.CUR = u }
  speechSynthesis.cancel = () => { if (window.CUR) clearTimeout(CUR.tm); SPK = false; window.CANCELS = (window.CANCELS || 0) + 1 }
  Object.defineProperty(speechSynthesis, "speaking", { get: () => SPK, configurable: true })
  window.RECS = []
  window.SpeechRecognition = class { constructor() { RECS.push(this) } start() { this.on = true; setTimeout(() => { this.onstart && this.onstart(); this.onaudiostart && this.onaudiostart() }, 20) } stop() { this.on = false } abort() { this.on = false } }
  window.hear = s => { const r = RECS.filter(r => r.on).pop(); if (!r) return false; r.onresult({ results: [Object.assign([{ transcript: s }], { isFinal: false })] }); return true }
  // микрофон «уха»: уровень задаём из теста, кадры по 85 мс
  window.LVL = .02; window.HS = []; window.WH = false; window.WTXT = ""
  window.STT = Object.assign({}, window.STT || {}, {
    on: () => WH, prime() {},
    record: async opts => {
      const h = { opts, frames: 0, voiced: 0, lastVoice: 0, parts: [], stopped: false, ctx: { state: "running" },
        close() { this.stopped = true; clearInterval(this.iv) }, abort() { this.close() }, stop() { this.close() },
        wav: () => "wav", secs: () => 1, keepLast(s) { this.kept = s } }
      h.iv = setInterval(() => { if (h.stopped) return; h.frames++; if (LVL > .05) { h.voiced += .085; h.lastVoice = Date.now(); h.opts.onVoice && h.opts.onVoice(LVL) } h.opts.onLevel && h.opts.onLevel(LVL, .085) }, 85)
      HS.push(h); return h
    },
    transcribe: async () => WTXT
  })
  let n = 0; window.CTX = []
  window.agentTurn = async ctx => { CTX.push(JSON.stringify(ctx)); await new Promise(r => setTimeout(r, 150)); n++; return n === 1 ? "Первое предложение ответа. Второе длинное предложение. Третье предложение. Четвёртое предложение. Пятое предложение. Шестое предложение." : "Хорошо, поняла." }
})
const st = () => page.evaluate(() => TALK && TALK.state)
await page.evaluate(() => setTab("chat")); await page.waitForTimeout(300)

// 1. Safari: эхо — не перебивает, голос громче эха — Изи замолкает и слушает
await page.evaluate(() => talkOpen()); await page.waitForTimeout(400)
await page.evaluate(() => hear("расскажи про мой день")); await page.waitForTimeout(2600)
ok(await st() === "say", "Изи говорит: " + await st())
await page.evaluate(() => { LVL = .03 }); await page.waitForTimeout(1100)   // эхо голоса Изи
ok(await st() === "say" && await page.evaluate(() => HS.length === 1 && !HS[0].stopped), "эхо не перебивает, ухо слушает")
await page.evaluate(() => { LVL = .12 }); await page.waitForTimeout(450)
ok(await st() === "listen", "заговорил громче — Изи замолчала и слушает: " + await st())
ok(await page.evaluate(() => HS[0].stopped), "в Safari-режиме запись уха отпущена")
const saidN = await page.evaluate(() => SAID.length)
ok(saidN < 7, "договорить не успела: " + (saidN - 1) + " из 6 фраз")
await page.evaluate(() => { LVL = .01; hear("подожди а что завтра") }); await page.waitForTimeout(2600)
const last = await page.evaluate(() => { const u = D.chat.filter(m => m.role === "user").pop(); return u.prompt || "" })
ok(/перебили на словах: «Первое предложение ответа\./.test(last) && /подожди а что завтра$/.test(last), "помощник знает, где перебили: " + last.slice(0, 90))
ok(await page.evaluate(() => /перебили/.test(CTX[CTX.length - 1])), "пометка ушла в запрос")
ok(await page.evaluate(() => D.chat.filter(m => m.role === "user").pop().text === "подожди а что завтра"), "в чате — только слова человека")
await page.waitForTimeout(1500)
ok(await page.evaluate(() => SAID.includes("Хорошо, поняла.")), "ответила одной репликой")
await page.evaluate(() => talkClose()); await page.waitForTimeout(600)

// 2. шум без слов — договаривает с прерванной фразы
await page.evaluate(() => { LVL = .02; HS.length = 0; SAID.length = 0; window.agentTurn = async () => "Раз два три. Четыре пять шесть. Семь восемь девять."; talkOpen() }); await page.waitForTimeout(400)
await page.evaluate(() => hear("посчитай")); await page.waitForTimeout(2400)
await page.evaluate(() => { LVL = .03 }); await page.waitForTimeout(900)
await page.evaluate(() => { LVL = .2 }); await page.waitForTimeout(400)
await page.evaluate(() => { LVL = .02 })
ok(await st() === "listen", "кашель перебил")
const before = await page.evaluate(() => SAID.slice())
await page.waitForTimeout(3900)
const after = await page.evaluate(n => SAID.slice(n), before.length)
ok(await st() === "say" && after.length && before.includes(after[0]), "не слова — договаривает с той же фразы: " + after.join(" | "))
await page.evaluate(() => talkClose()); await page.waitForTimeout(600)

await page.evaluate(() => { const b = Date.now(), p0 = performance.now(); Date.now = () => b + performance.now() - p0 })   // Whisper считает паузы по Date.now(), а часы теста стоят
// 3. Whisper: та же запись уха становится записью ответа (первые слова не теряются)
await page.evaluate(() => { WH = true; LVL = .02; HS.length = 0; SAID.length = 0; window.agentTurn = async () => "Длинный ответ первый. Второй кусок. Третий кусок. Четвёртый кусок. Пятый кусок. Шестой кусок."; talkOpen() }); await page.waitForTimeout(300)
await page.evaluate(() => { WTXT = "что у меня сегодня"; LVL = .12 }); await page.waitForTimeout(600); await page.evaluate(() => { LVL = .01 }); await page.waitForTimeout(3600)
ok(await st() === "say", "Whisper: Изи говорит: " + await st() + " " + await page.evaluate(() => JSON.stringify({v: HS.map(h => [h.voiced, h.stopped, h.frames]), heard: TALK.heard, busy: chatBusy, w: TALK.w, on: STT.on(), off: sttOffUntil - Date.now()}) + (TALK.log||[]).join(" · ") + " | " + D.chat.slice(-3).map(m => m.role + ":" + m.text).join(" / ")))
await page.evaluate(() => { WTXT = "стоп а завтра"; LVL = .03 }); await page.waitForTimeout(1000)
const nh = await page.evaluate(() => HS.length)
await page.evaluate(() => { LVL = .15 }); await page.waitForTimeout(400)
ok(await st() === "listen", "Whisper: перебил — слушает")
ok(await page.evaluate(n => HS.length === n && TALK.rec === HS[n - 1] && HS[n - 1].kept === .45, nh), "та же запись продолжается, с последних 0,45 с " + await page.evaluate(() => JSON.stringify({n: HS.length, same: HS.indexOf(TALK.rec), kept: HS.map(h => h.kept), log: TALK.log})))
await page.evaluate(() => { LVL = .01 }); await page.waitForTimeout(3200)
ok(await page.evaluate(() => /перебили.*стоп а завтра$/.test(D.chat.filter(m => m.role === "user").pop().prompt || "")), "Whisper: ушло с пометкой")

// 4. выключатель
await page.evaluate(() => { talkClose(); D.izi = Object.assign(D.izi || {}, { barge: false }) }); await page.waitForTimeout(600)
await page.evaluate(() => { WH = false; HS.length = 0; talkOpen() }); await page.waitForTimeout(400)
await page.evaluate(() => hear("ещё раз")); await page.waitForTimeout(2600)
ok(await page.evaluate(() => HS.length === 0), "barge:false — уха нет")
await browser.close(); server && server.close && server.close()
console.log(fails ? "BARGE_FAIL " + fails : "BARGE_OK"); process.exit(fails ? 1 : 0)
