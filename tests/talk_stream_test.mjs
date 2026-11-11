// Живой разговор потоком: ответ Claude приходит кусками (SSE), Изи говорит первую фразу, пока остальное ещё пишется;
// текст до инструмента звучит сразу; быстрый режим (speed fast) только в разговоре и только со своим ключом;
// перебили посреди ответа — ответ останавливается, сказанное остаётся в переписке; запросы помощника к таблице
// без списков, календарь — в том же запросе, что и обмен. Провал — STREAM_FAIL
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const { page, browser, server } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z") })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
await page.evaluate(() => {
  const base = Date.now(), p0 = performance.now(); Date.now = () => base + performance.now() - p0
  D.myKey = "sk-test"; D.izi = Object.assign({}, D.izi, { fast: true }); D.chat = [{ role: "user", text: "привет", at: Date.now() - 6e4 }, { role: "assistant", text: "Привет!", at: Date.now() - 5e4 }]
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
  window.SAID = []; window.SAIDAT = []
  speechSynthesis.speak = u => { SAID.push(u.text); SAIDAT.push(performance.now()); setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 60) }, 10) }
  speechSynthesis.cancel = () => {}
  window.LVL = 0; window.WTXT = ""
  window.STT = Object.assign({}, window.STT || {}, { on: () => true, prime() {}, release() {}, live: () => true,
    record: async opts => {
      const h = { opts, frames: 0, peak: .1, voiced: 0, lastVoice: 0, stopped: false, ctx: { state: "running" },
        close() { this.stopped = true; clearInterval(this.iv) }, abort() { this.close() }, stop() { this.close() }, wav: () => "wav", secs: () => 1, keepLast() {} }
      h.iv = setInterval(() => { if (h.stopped) return; h.frames++; if (LVL > .05) { h.voiced += .085; h.lastVoice = Date.now(); h.opts.onVoice && h.opts.onVoice(LVL) } h.opts.onLevel && h.opts.onLevel(LVL, .085) }, 85)
      return h
    },
    transcribe: async () => { await new Promise(r => setTimeout(r, 200)); return WTXT } })
  // Claude потоком: сценарий SCN — список [задержка мс, событие]
  window.REQ = []; window.SCN = []; window.DONEAT = 0
  const of = window.fetch
  window.fetch = async (url, o) => {
    if (!/api\.anthropic\.com/.test(url)) return of(url, o)
    const b = JSON.parse(o.body); REQ.push(b)
    if (!b.stream) return new Response(JSON.stringify({ content: [{ type: "text", text: "Обычный ответ." }], stop_reason: "end_turn", usage: {} }), { headers: { "content-type": "application/json" } })
    const evs = SCN.shift() || [], enc = new TextEncoder(), sig = o.signal
    const body = new ReadableStream({ async start(c) {
      let dead = false
      if (sig) sig.addEventListener("abort", () => { dead = true; try { c.error(new DOMException("aborted", "AbortError")) } catch (x) {} })   // как настоящий fetch: обрыв — сразу
      for (const [ms, e] of evs) {
        await new Promise(r => setTimeout(r, ms))
        if (dead) return
        c.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`))
      }
      DONEAT = performance.now(); c.close()
    } })
    return new Response(body, { headers: { "content-type": "text/event-stream" } })
  }
  const msg = (blocks, stop) => {
    const ev = [[0, { type: "message_start", message: { id: "m", role: "assistant", content: [], usage: { input_tokens: 5 } } }]]
    blocks.forEach((b, i) => {
      if (b.type === "text") { ev.push([20, { type: "content_block_start", index: i, content_block: { type: "text", text: "" } }]); b.chunks.forEach(([ms, t]) => ev.push([ms, { type: "content_block_delta", index: i, delta: { type: "text_delta", text: t } }])) }
      if (b.type === "thinking") { ev.push([10, { type: "content_block_start", index: i, content_block: { type: "thinking", thinking: "" } }]); ev.push([10, { type: "content_block_delta", index: i, delta: { type: "signature_delta", signature: "SIG" } }]) }
      if (b.type === "tool_use") { ev.push([10, { type: "content_block_start", index: i, content_block: { type: "tool_use", id: "tu1", name: b.name, input: {} } }]); ev.push([10, { type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json: b.json.slice(0, 5) } }]); ev.push([10, { type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json: b.json.slice(5) } }]) }
      ev.push([5, { type: "content_block_stop", index: i }])
    })
    ev.push([5, { type: "message_delta", delta: { stop_reason: stop || "end_turn" }, usage: { output_tokens: 30 } }]); ev.push([5, { type: "message_stop" }])
    return ev
  }
  window.MSG = msg
})
await page.evaluate(() => setTab("chat")); await page.waitForTimeout(300)
await page.evaluate(() => talkOpen()); await page.waitForTimeout(600)
// 1. первая фраза звучит, пока ответ ещё пишется
await page.evaluate(() => { SCN.push(MSG([{ type: "thinking" }, { type: "text", chunks: [[100, "Завтра у вас две "], [100, "встречи. Первая "], [1500, "в десять, вторая в два."]] }])) })
await page.evaluate(() => { WTXT = "Что у меня завтра?"; LVL = .2 }); await page.waitForTimeout(900)
await page.evaluate(() => { LVL = 0 })
await page.waitForFunction(() => DONEAT && SAID.includes("в десять, вторая в два."), null, { timeout: 8000 }).catch(() => {})
const r1 = await page.evaluate(() => ({ said: SAID.slice(), at: SAIDAT.slice(), done: DONEAT, req: REQ.filter(b => b.max_tokens !== 0).pop(), warm: REQ.find(b => b.max_tokens === 0), chat: D.chat.slice(-1)[0], log: (TALK.log || []).join(" · "), lat: D.talkLat }))
const i1 = r1.said.indexOf("Завтра у вас две встречи.")
ok(i1 >= 0 && r1.at[i1] < r1.done - 1000, `первая фраза зазвучала за ${i1 >= 0 ? Math.round(r1.done - r1.at[i1]) : "?"} мс до конца ответа`)
ok(r1.said.join(" ").includes("Первая в десять, вторая в два."), "остаток договорён: " + r1.said.join(" | "))
ok(r1.req && r1.req.stream === true && r1.req.speed === "fast", "в разговоре — поток и быстрый режим")
ok(r1.warm && r1.warm.speed === "fast", "прогрев кэша — тоже быстрым режимом (общий кэш)")
ok(r1.chat && r1.chat.role === "assistant" && r1.chat.text === "Завтра у вас две встречи. Первая в десять, вторая в два.", "в переписке полный ответ")
ok(r1.lat && r1.lat.some(x => x.voice != null && x.stt != null && x.total != null), "замеры: " + JSON.stringify(r1.lat))
// 2. текст до инструмента звучит сразу; история с thinking-подписью и tool_use собрана верно
await page.waitForFunction(() => TALK.state === "listen", null, { timeout: 6000 }).catch(() => {})
await page.waitForTimeout(400)
await page.evaluate(() => { SAID.length = 0; SCN.push(MSG([{ type: "thinking" }, { type: "text", chunks: [[50, "Сейчас посмотрю."]] }, { type: "tool_use", name: "get_health", json: '{"days":1}' }], "tool_use"))
  SCN.push(MSG([{ type: "text", chunks: [[300, "Вы прошли пять тысяч шагов."]] }])) })
await page.evaluate(() => { WTXT = "Сколько я прошёл?"; LVL = .2 }); await page.waitForTimeout(900)
await page.evaluate(() => { LVL = 0 })
await page.waitForFunction(() => SAID.includes("Вы прошли пять тысяч шагов."), null, { timeout: 8000 }).catch(() => {})
const r2 = await page.evaluate(() => ({ said: SAID.slice(), second: REQ.filter(b => b.max_tokens !== 0).pop() }))
ok(r2.said[0] === "Сейчас посмотрю." && r2.said.includes("Вы прошли пять тысяч шагов."), "сначала «Сейчас посмотрю.», потом ответ: " + r2.said.join(" | "))
const asst = r2.second && r2.second.messages.slice(-2)[0], tr = r2.second && r2.second.messages.slice(-1)[0]
ok(asst && asst.role === "assistant" && asst.content[0].type === "thinking" && asst.content[0].signature === "SIG" && asst.content[2].type === "tool_use" && asst.content[2].input.days === 1,
  "поток собран в то же сообщение: thinking с подписью, текст, tool_use с разобранным input")
ok(tr && tr.content[0].type === "tool_result" && tr.content[0].tool_use_id === "tu1", "результат инструмента ушёл следующим запросом")
// 3. перебили посреди ответа — ответ остановлен, сказанное в переписке
await page.waitForFunction(() => TALK.state === "listen", null, { timeout: 6000 }).catch(() => {})
await page.waitForTimeout(400)
await page.evaluate(() => { SAID.length = 0; SCN.push(MSG([{ type: "text", chunks: [[50, "Расскажу про бюджет. "], [4000, "Это никто не услышит."]] }])) })
await page.evaluate(() => { WTXT = "Что с бюджетом?"; LVL = .2 }); await page.waitForTimeout(900)
await page.evaluate(() => { LVL = 0 })
await page.waitForFunction(() => SAID.includes("Расскажу про бюджет."), null, { timeout: 6000 }).catch(() => {})
await page.waitForTimeout(300)
await page.evaluate(() => talkTap())   // перебить касанием
await page.waitForTimeout(500)
const r3 = await page.evaluate(() => ({ busy: chatBusy, last: D.chat.slice(-2), st: TALK.state }))
ok(!r3.busy && r3.st === "listen", "ответ остановлен, Изи слушает: " + JSON.stringify(r3))
ok(r3.last[0].role === "user" && r3.last[0].text === "Что с бюджетом?" && r3.last[1].role === "assistant" && /^Расскажу про бюджет\./.test(r3.last[1].text), "вопрос и сказанное остались в переписке")
await page.waitForTimeout(4200)
ok(!(await page.evaluate(() => SAID.includes("Это никто не услышит."))), "остаток после перебивания не звучит")
// без явного включения — обычная скорость (цена ключа та же)
await page.evaluate(() => { D.izi.fast = undefined })
ok(await page.evaluate(() => !talkFastOK()), "быстрый режим по умолчанию выключен")
await page.evaluate(() => talkClose()); await page.waitForTimeout(500)
// 4. обычный чат — без потока и быстрого режима
await page.evaluate(() => chatSend("сколько я потратил")); await page.waitForTimeout(800)
const r4 = await page.evaluate(() => REQ[REQ.length - 1])
ok(!r4.stream && !r4.speed, "в обычном чате — как раньше (без потока и speed)")
// 5. запросы помощника к таблице — без списков; календарь — в одном запросе с обменом
const hub = []
await page.route(/script\.google|hook/, r => { hub.push(JSON.parse(r.request().postData() || "{}").hub); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, now: Date.now(), lists: {}, cal: { events: [], calendars: [] }, mail: { items: [] } }) }) })
const hasHook = await page.evaluate(() => { D.conn = Object.assign({ hook: "https://script.google.com/macros/s/x/exec", secret: "s" }, D.conn || {}); D.conn.hook = "https://script.google.com/macros/s/x/exec"; D.gcal = null; return true })
await page.evaluate(() => sync()); await page.waitForTimeout(800)
await page.evaluate(() => hubPost({ mail: { action: "search", q: "x" } })); await page.waitForTimeout(500)
const sy = hub.find(h => h && h.lists), ml = hub.find(h => h && h.mail)
ok(hasHook && sy && sy.cal && sy.cal.action === "list", "обмен сразу забирает и календарь (один запрос вместо двух)")
ok(hub.filter(h => h && h.cal && !h.lists).length === 0, "отдельного запроса календаря нет")
ok(ml && ml.since > 1e15 && ml.snapAt > 1e15, "запрос почты — без списков и снимка (since в будущем)")
await browser.close(); server && server.close && server.close()
console.log(fails ? "STREAM_FAIL " + fails : "STREAM_OK"); process.exit(fails ? 1 : 0)
