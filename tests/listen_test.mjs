// Изи дослушивает: паузы в речи не отправляют фразу раньше времени, повисшее «и…» ждёт дольше,
// Safari рвёт распознавание — услышанное копится, продолжил говорить после отправки — ответ отменяется
// и Изи отвечает на всю мысль, эхо голоса Изи не считается словами человека. Провал — LISTEN_FAIL
import { boot2 } from "./today_boot.mjs"
const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-05T03:00:00Z") })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
await page.evaluate(() => {
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
  window.SAID = []
  speechSynthesis.speak = u => { SAID.push(u.text); setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 20) }, 10) }
  speechSynthesis.cancel = () => {}
  window.RECS = []
  window.SpeechRecognition = class { constructor() { RECS.push(this) } start() { this.on = true } stop() { this.on = false; setTimeout(() => this.onend && this.onend(), 5) } abort() { this.on = false } }
  // одна сессия распознавания: s — весь текст этой сессии
  window.hear = s => { const r = RECS[RECS.length - 1]; r.onresult({ results: [Object.assign([{ transcript: s }], { isFinal: false })] }) }
  window.safariEnds = () => { const r = RECS[RECS.length - 1]; r.on = false; r.onend() }
  window.TURNS = []
  window.agentTurn = async (msgs, sys, tools) => { const q = msgs[msgs.length - 1].content; TURNS.push(typeof q === "string" ? q : JSON.stringify(q)); await new Promise(r => setTimeout(r, 1500)); if (chatStopCtl && chatStopCtl.signal.aborted) return null; return "Поняла." }
})
const userMsgs = () => page.evaluate(() => D.chat.filter(m => m.role === "user" && !m.auto).map(m => m.text))   // без «Утреннего плана», который Изи кладёт в чат сам
await page.evaluate(() => setTab("chat")); await page.waitForTimeout(300)
await page.evaluate(() => talkOpen()); await page.waitForTimeout(500)
ok(await page.evaluate(() => TALK && TALK.state === "listen"), "разговор открыт, слушаю")
ok(await page.evaluate(() => /никогда не говори «вы прервались»/.test(chatSystem())), "в промпте: не говорить «вы прервались»")
// 1. пауза 1,5 с посреди мысли — не отправляет
// (обычная пауза до отправки теперь 1,5 с — TALK_SILENCE, поэтому ждём с запасом меньше неё)
await page.evaluate(() => hear("я хочу сегодня сходить")); await page.waitForTimeout(800)
ok(await page.evaluate(() => TALK.state === "listen") && (await userMsgs()).length === 0, "пауза 0,8 с — Изи ещё слушает")
// 2. Safari сам закрыл распознавание на паузе — копим и слушаем дальше
await page.evaluate(() => safariEnds()); await page.waitForTimeout(300)
ok(await page.evaluate(() => TALK.state === "listen" && RECS.length >= 2), "Safari оборвал запись — Изи не отправила, слушает дальше")
await page.evaluate(() => hear("в спортзал и")); await page.waitForTimeout(2600)
ok(await page.evaluate(() => TALK.state === "listen") && (await userMsgs()).length === 0, "фраза повисла на «и» — ждёт дольше обычного")
await page.evaluate(() => hear("в спортзал и потом в магазин")); await page.waitForTimeout(1900)
let u = await userMsgs()
ok(u.length === 1 && u[0] === "я хочу сегодня сходить в спортзал и потом в магазин", "после паузы ушла вся фраза целиком: " + u.join(" | "))
ok(await page.evaluate(() => TALK.state === "think"), "Изи думает")
// 3. отправили, а человек продолжил — ответ отменяется, слушаем дальше и отправляем всё вместе
await page.evaluate(() => hear("в спортзал и потом в магазин за продуктами на неделю")); await page.waitForTimeout(200)
ok(await page.evaluate(() => TALK.state === "listen"), "продолжил говорить после отправки — Изи снова слушает")
await page.waitForTimeout(1000)
u = await userMsgs()
ok(u.length === 0, "оборванный вопрос убран из чата")
await page.waitForTimeout(1600)
u = await userMsgs()
ok(u.length === 1 && u[0] === "я хочу сегодня сходить в спортзал и потом в магазин за продуктами на неделю", "ушла вся мысль: " + u.join(" | "))
await page.waitForTimeout(2200)
ok(await page.evaluate(() => SAID.includes("Поняла.") && TALK.state === "listen"), "ответила один раз и снова слушает")
ok(await page.evaluate(() => D.chat.filter(m => m.role === "assistant").length === 1), "в чате один ответ, без «вы прервались»")
// 4. эхо: микрофон поймал хвост голоса Изи — не считается
await page.waitForTimeout(400)
await page.evaluate(() => hear("поняла")); await page.waitForTimeout(3300)
ok(await page.evaluate(() => TALK.state === "listen" && !TALK.heard) && (await userMsgs()).length === 1, "эхо «поняла» от голоса Изи не ушло как слова человека")
// 5. касание шара — отправить сразу, не дожидаясь паузы
await page.evaluate(() => hear("запиши расход двести бат")); await page.waitForTimeout(300)
await page.click(".tk-orb"); await page.waitForTimeout(200)
ok((await userMsgs()).length === 2 && await page.evaluate(() => TALK.state === "think"), "касание шара — отправлено сразу")
ok(errors.length === 0, "без ошибок в консоли " + errors.join(" | "))
await browser.close(); server.close()
console.log(fails ? `LISTEN_FAIL ${fails}` : "LISTEN_OK")
