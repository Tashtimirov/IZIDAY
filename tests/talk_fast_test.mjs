// Быстрые ответы в живом разговоре: системный промпт без минут (кэш Claude работает между репликами), прогрев кэша
// при открытии разговора, в разговоре effort low (в чате — high), законченная фраза Whisper («…?», «….») уходит
// через ~0,9 с тишины, повисшая («…, что») — ждём дольше. Провал — FAST_FAIL
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const { page, browser, server } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z") })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
const REQ = []
await page.route("https://api.anthropic.com/**", async r => {
  const b = JSON.parse(r.request().postData() || "{}"); REQ.push(b)
  await new Promise(x => setTimeout(x, 120))
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b.max_tokens === 0
    ? { content: [], stop_reason: "max_tokens", usage: { input_tokens: 10, cache_creation_input_tokens: 9000, cache_read_input_tokens: 0, output_tokens: 0 } }
    : { content: [{ type: "text", text: "Завтра у вас две встречи." }], stop_reason: "end_turn", usage: { input_tokens: 10, cache_read_input_tokens: 9000, output_tokens: 9 } }) })
})
// 1. системный промпт не меняется от минуты к минуте
const s1 = await page.evaluate(() => chatSystem())
await page.clock.setFixedTime(new Date("2026-11-05T03:47:00Z"))
const s2 = await page.evaluate(() => chatSystem())
ok(s1 === s2, "системный промпт одинаковый в 10:00 и 10:47 — кэш не сбрасывается")
ok(/Сегодня 2026-11-05, четверг/.test(s1), "дата и день недели в промпте есть")
await page.evaluate(() => {
  const base = Date.now(), p0 = performance.now(); Date.now = () => base + performance.now() - p0   // живые часы для пауз
  D.myKey = "sk-test"; D.chat = [{ role: "user", text: "привет", at: Date.now() - 6e4 }, { role: "assistant", text: "Привет!", at: Date.now() - 5e4 }]
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
  window.SAID = []
  speechSynthesis.speak = u => { SAID.push(u.text); setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 30) }, 10) }
  speechSynthesis.cancel = () => {}
  window.LVL = 0; window.WTXT = ""; window.HS = []
  window.STT = Object.assign({}, window.STT || {}, { on: () => true, prime() {}, release() {}, live: () => true,
    record: async opts => {
      const h = { opts, frames: 0, peak: .1, voiced: 0, lastVoice: 0, stopped: false, ctx: { state: "running" },
        close() { this.stopped = true; clearInterval(this.iv) }, abort() { this.close() }, stop() { this.close() }, wav: () => "wav", secs: () => 1, keepLast() {} }
      h.iv = setInterval(() => { if (h.stopped) return; h.frames++; if (LVL > .05) { h.voiced += .085; h.lastVoice = Date.now(); h.opts.onVoice && h.opts.onVoice(LVL) } h.opts.onLevel && h.opts.onLevel(LVL, .085) }, 85)
      HS.push(h); return h
    },
    transcribe: async () => { await new Promise(r => setTimeout(r, 250)); return WTXT } })
})
await page.evaluate(() => setTab("chat")); await page.waitForTimeout(300)
await page.evaluate(() => talkOpen()); await page.waitForTimeout(600)
const warm = REQ.find(b => b.max_tokens === 0)
ok(!!warm, "при открытии разговора — прогрев кэша (max_tokens 0)")
ok(warm && warm.output_config.effort === "low" && warm.messages[warm.messages.length - 1].role === "user", "прогрев с теми же настройками и кончается сообщением человека")
// 2. законченная фраза — быстро
await page.evaluate(() => { WTXT = "Что у меня завтра?"; LVL = .2 }); await page.waitForTimeout(1000)
const t0 = await page.evaluate(() => { LVL = 0; return performance.now() })
await page.waitForFunction(() => TALK.state !== "listen", null, { timeout: 5000 }).catch(() => {})
const dt = await page.evaluate(t0 => performance.now() - t0, t0)
ok(dt < 1300, "«Что у меня завтра?» ушло через " + Math.round(dt) + " мс тишины")
await page.waitForFunction(() => SAID.includes("Завтра у вас две встречи."), null, { timeout: 5000 }).catch(() => {})
const real = REQ.filter(b => b.max_tokens !== 0).pop()
ok(real && real.output_config.effort === "low", "в разговоре effort low: " + (real && real.output_config.effort))
ok(real && warm && real.system === warm.system && JSON.stringify(real.tools) === JSON.stringify(warm.tools), "запрос совпадает с прогретым началом (system и инструменты)")
ok(real && JSON.stringify(real.messages.slice(0, warm.messages.length)) === JSON.stringify(warm.messages), "история в запросе начинается с прогретой")
ok(await page.evaluate(() => /ответ за \d/.test((TALK.log || []).join(" "))), "в журнале — сколько ждали ответа: " + await page.evaluate(() => (TALK.log || []).join(" · ")))
// 3. повисшая фраза — ждём
await page.waitForFunction(() => TALK.state === "listen", null, { timeout: 5000 }).catch(() => {})
await page.waitForTimeout(500)
await page.evaluate(() => { WTXT = "Я думаю, что"; LVL = .2 }); await page.waitForTimeout(900)
await page.evaluate(() => { LVL = 0 }); await page.waitForTimeout(1700)
ok(await page.evaluate(() => TALK.state === "listen"), "«Я думаю, что» — через 1,7 с ещё слушает")
await page.waitForTimeout(2000)
ok(await page.evaluate(() => D.chat.some(m => m.role === "user" && m.text === "Я думаю, что")), "и всё же уходит после долгой паузы")
await page.evaluate(() => talkClose()); await page.waitForTimeout(500)
// 4. обычный чат — effort high
await page.evaluate(() => chatSend("сколько я потратил")); await page.waitForTimeout(800)
ok(REQ[REQ.length - 1].output_config.effort === "high", "в обычном чате effort high")
await browser.close(); server && server.close && server.close()
console.log(fails ? "FAST_FAIL " + fails : "FAST_OK"); process.exit(fails ? 1 : 0)
