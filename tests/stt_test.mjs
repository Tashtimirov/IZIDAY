// Точное распознавание (Whisper через Groq): чат-микрофон и живой разговор отправляют текст Whisper,
// а не черновик Safari; склейка повторов Safari; фильтр «титров»; запасной путь на Safari. Провал — STT_FAIL
import { boot2 } from "./today_boot.mjs"
const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-05T03:00:00Z") })
let fails = 0
await page.clock.setSystemTime(new Date("2026-11-05T03:00:00Z"))   // время идёт: паузы считаются по часам
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
let GROQ = [], reply = "Запиши расход двести бат на падел.", status = 200
await page.route("https://api.groq.com/**", async r => {
  GROQ.push(r.request().postData() || "")
  await new Promise(x => setTimeout(x, 150))
  r.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(status === 200 ? { text: reply, segments: [{ text: reply, no_speech_prob: .01, avg_logprob: -.2 }] } : { error: { message: "rate" } }) })
})
await page.evaluate(() => {
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
  window.SAID = []
  speechSynthesis.speak = u => { SAID.push(u.text); setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 20) }, 10) }
  speechSynthesis.cancel = () => {}
  window.RECS = []
  window.SpeechRecognition = class { constructor() { RECS.push(this) } start() { this.on = true } stop() { this.on = false; setTimeout(() => this.onend && this.onend(), 5) } abort() { this.on = false } }
  // поддельный микрофон: тест сам говорит «громко» (talk) и молчит
  window.MIC = []
  STT.record = async () => {
    const h = { voiced: 0, lastVoice: 0, len: 0, closed: false, secs: () => h.len / 16000, wav: () => new Blob(["x"], { type: "audio/wav" }) }
    h.close = h.abort = h.stop = () => { h.closed = true }
    MIC.push(h); return h
  }
  window.talk = (sec = 1) => { const h = MIC[MIC.length - 1]; h.voiced += sec; h.lastVoice = Date.now(); h.len += sec * 16000 }
  window.TURNS = []
  window.agentTurn = async msgs => { const q = msgs[msgs.length - 1].content; TURNS.push(typeof q === "string" ? q : JSON.stringify(q)); await new Promise(r => setTimeout(r, 600)); return "Записала." }
})
const userMsgs = () => page.evaluate(() => D.chat.filter(m => m.role === "user").map(m => m.text))

// 0. без ключа — как раньше, Safari
ok(await page.evaluate(() => !STT.on()), "без ключа точное выключено")
// функции
ok(await page.evaluate(() => srGlue([Object.assign([{ transcript: "как дела" }], { isFinal: true }), Object.assign([{ transcript: "как дела у тебя" }], { isFinal: false })]).all === "как дела у тебя"), "склейка Safari без повтора фразы")
ok(await page.evaluate(() => srGlue([Object.assign([{ transcript: "привет" }], { isFinal: true }), Object.assign([{ transcript: "как дела" }], { isFinal: false })]).all === "привет как дела"), "обычные куски Safari склеиваются")
ok(await page.evaluate(() => STT.clean({ text: "Продолжение следует...", segments: [{ text: "Продолжение следует...", no_speech_prob: .9, avg_logprob: -1 }] }) === ""), "«титры» Whisper на тишине выброшены")
ok(await page.evaluate(() => STT.clean({ text: " Купи молоко. ", segments: [{ text: " Купи молоко.", no_speech_prob: .02, avg_logprob: -.2 }, { text: " Субтитры сделал DimaTorzok", no_speech_prob: .2, avg_logprob: -.5 }] }) === "Купи молоко."), "настоящая речь осталась, хвост-титры убраны")

// 1. ключ и настройки
await page.evaluate(() => { D.stt = { key: "gsk_" + "a".repeat(40), words: "падел, Пхукет" }; save(false) })
ok(await page.evaluate(() => STT.on()), "с ключом — точное включено")
ok(await page.evaluate(() => /падел/.test(STT.prompt()) && /Изи/.test(STT.prompt())), "подсказка Whisper: имя помощника и свои слова")
await page.evaluate(() => setTab("more")); await page.waitForTimeout(300)
ok(await page.evaluate(() => /Точное — Whisper/.test(document.body.innerText)), "в «Настройках» → «Помощник» видно «Точное — Whisper»")

// 2. чат: микрофон → пауза → Whisper → отправлено
await page.evaluate(() => setTab("chat")); await page.waitForTimeout(300)
await page.evaluate(() => micStart()); await page.waitForTimeout(100)
await page.evaluate(() => talk(1.5)); await page.waitForTimeout(1200)
ok((await userMsgs()).length === 0 && GROQ.length === 0, "пока пауза короче 2,5 с — не отправляет")
await page.waitForTimeout(2000)
// запись в строке ввода (полосы «Слушаю…» больше нет) уходит по «отправить», а не по паузе
ok((await userMsgs()).length === 0, "диктовка в строке ввода не уходит сама по паузе")
await page.evaluate(() => voiceSendNow()); await page.waitForTimeout(800)
let u = await userMsgs()
ok(u.length === 1 && u[0] === "Запиши расход двести бат на падел.", "после паузы ушёл текст Whisper: " + u.join(" | "))
ok(GROQ.length === 1 && /whisper-large-v3/.test(GROQ[0]) && /name="language"\r?\n\r?\nru/.test(GROQ[0]), "запрос в Groq: whisper-large-v3, русский")
ok(await page.evaluate(() => RECS.length === 0), "Safari не включался")
ok(await page.evaluate(() => MIC[0].closed), "микрофон отпущен")
await page.waitForTimeout(800)

// 3. одна тишина — ничего не уходит
await page.evaluate(() => micStart()); await page.waitForTimeout(100)
await page.evaluate(() => voiceSendNow()); await page.waitForTimeout(500)
ok((await userMsgs()).length === 1 && GROQ.length === 1, "тишина — ничего не отправлено и не распознавалось")

// 4. живой разговор: на паузе распознаёт, видно текст; отправляет после talkWait
reply = "Я хочу сегодня сходить в спортзал и"
await page.evaluate(() => talkOpen()); await page.waitForTimeout(300)
ok(await page.evaluate(() => TALK && TALK.state === "listen" && TALK.w), "разговор слушает через Whisper")
await page.evaluate(() => talk(1.5)); await page.waitForTimeout(1300)
ok(await page.evaluate(() => /спортзал/.test(TALK.heard)), "после паузы видно распознанное: " + await page.evaluate(() => TALK.heard))
await page.waitForTimeout(1600)
ok((await userMsgs()).length === 1, "фраза повисла на «и» — ещё ждёт")
reply = "Я хочу сегодня сходить в спортзал и потом в магазин."
await page.evaluate(() => talk(1)); await page.waitForTimeout(4200)
u = await userMsgs()
ok(u.length === 2 && u[1] === reply, "ушла вся мысль целиком: " + u.slice(1).join(" | "))
await page.waitForTimeout(1200)
ok(await page.evaluate(() => D.chat.some(m => m.role === "assistant" && m.text === "Записала.") && TALK.state === "listen" && TALK.w), "ответила и снова слушает через Whisper")

// 5. касание шара — дораспознать и отправить сразу
reply = "Сколько я потратил за неделю?"
await page.evaluate(() => talk(1)); await page.waitForTimeout(200)
await page.click(".tk-orb"); await page.waitForTimeout(700)
u = await userMsgs()
ok(u.length === 3 && u[2] === reply, "касание шара — сразу ушёл текст Whisper: " + u.slice(2).join(" | "))
await page.waitForTimeout(1500)

// 6. Groq упал (лимит) — разговор переходит на Safari, не ломается
status = 429
await page.evaluate(() => talk(1)); await page.waitForTimeout(1300)
ok(await page.evaluate(() => TALK.state === "listen" && RECS.length >= 1), "лимит Groq — слушает Safari, разговор живой")
await page.evaluate(() => talkClose()); await page.waitForTimeout(400)

// 7. обычное — выбрано вручную
await page.evaluate(() => { D.stt.mode = "safari" })
ok(await page.evaluate(() => !STT.on()), "«Обычное — iPhone» выключает Whisper")
const errs = errors.filter(e => !/429/.test(e))   // 429 — это сам проверяемый лимит Groq
ok(errs.length === 0, "без ошибок в консоли " + errs.join(" | "))
await browser.close(); server.close()
console.log(fails ? `STT_FAIL ${fails}` : "STT_OK")
