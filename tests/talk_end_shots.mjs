// Живой разговор: смахнули вниз или «Закончить» — Изи сразу замолкает, микрофон гаснет, переписка остаётся в обычном чате.
// Взрослый (светлая и тёмная темы) и ребёнок (детский чат: смахивание во время разговора не закрывает окно). Снимки — build/web-shots/te-*
// Провал — TALKEND_FAIL
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let fails = 0
const ok = (c, m, got) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m, JSON.stringify(got || "")) } }
const time = new Date("2026-11-15T09:30:00+07:00")
const FAKES = () => {
  window.SPOKE = []
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
  speechSynthesis.speak = u => { SPOKE.push(u.text); window.TTSON = true; setTimeout(() => u.onstart && u.onstart(), 10) }
  speechSynthesis.cancel = () => { window.TTSON = false }
  window.RECS = []
  window.SpeechRecognition = window.webkitSpeechRecognition = class { constructor() { RECS.push(this) } start() { this.on = true } stop() { this.on = false; this.onend && this.onend() } abort() { this.on = false } }
  window.drag = (sel, path, gap = 30) => new Promise(res => {
    const el = document.querySelector(sel)
    const tc = y => [new Touch({ identifier: 1, target: el, clientX: 200, clientY: y })]
    el.dispatchEvent(new TouchEvent("touchstart", { touches: tc(path[0]), bubbles: true }))
    let i = 1
    const step = () => {
      if (i < path.length) { el.dispatchEvent(new TouchEvent("touchmove", { touches: tc(path[i++]), bubbles: true })); return setTimeout(step, gap) }
      el.dispatchEvent(new TouchEvent("touchend", { touches: [], bubbles: true })); res()
    }
    setTimeout(step, gap)
  })
}
const now = +time
const CHAT = [
  { role: "user", text: "Что у меня сегодня?", at: now - 60e3, voice: true },
  { role: "assistant", text: "Сегодня две встречи: в 11:00 созвон с Кириллом и в 15:30 стоматолог. Ещё напоминание — оплатить интернет.", at: now - 55e3 },
  { role: "user", text: "Перенеси стоматолога на завтра на то же время", at: now - 30e3, voice: true },
  { role: "assistant", text: "Готово: стоматолог перенесён на завтра, 15:30. Напомнить за час?", at: now - 25e3 },
]
for (const dark of [false, true]) {
  const T = dark ? "-dark" : ""
  const { page, browser, server, errors, sheet } = await boot2({ root, time, dark })
  await page.evaluate(FAKES)
  await page.evaluate(c => { D.chat = c; save(false); setTab("today") }, CHAT)
  await page.waitForTimeout(300)
  // 1. разговор, Изи говорит; кнопка «Закончить» с подписью слева вверху
  await page.evaluate(() => talkOpen()); await page.waitForTimeout(700)
  await page.evaluate(() => { const t = "Хорошо, напомню завтра в 14:30. Что-нибудь ещё на сегодня?"; D.chat.push({ role: "user", text: "Да, напомни", at: Date.now() - 4e3, voice: true }, { role: "assistant", text: t, at: Date.now() }); talkHear(t) }); await page.waitForTimeout(600)
  const b = await page.evaluate(() => { const r = $("#talk .tk-end").getBoundingClientRect(); const inp = $("#talk .tk-in").getBoundingClientRect(); return { t: $("#talk .tk-end").textContent.trim(), below: r.top >= inp.bottom - 1, w: r.width, vis: r.bottom <= innerHeight, st: TALK.state } })
  ok(b.t === "Закончить" && b.below && b.vis && b.w > 80, "кнопка «Закончить» с подписью под строкой ввода", b)
  ok(b.st === "say", "Изи говорит", b)
  await page.screenshot({ path: SHOTS + `te-1-talk${T}.png` })
  // 2. тянут вниз — на полпути
  await page.evaluate(() => { const el = $("#talk"), tc = y => [new Touch({ identifier: 1, target: el, clientX: 200, clientY: y })]
    el.dispatchEvent(new TouchEvent("touchstart", { touches: tc(120), bubbles: true })); el.dispatchEvent(new TouchEvent("touchmove", { touches: tc(200), bubbles: true })); el.dispatchEvent(new TouchEvent("touchmove", { touches: tc(300), bubbles: true })) })
  await page.waitForTimeout(150)
  await page.screenshot({ path: SHOTS + `te-2-swipe${T}.png` })
  await page.evaluate(() => { const el = $("#talk"); el.dispatchEvent(new TouchEvent("touchend", { touches: [], bubbles: true })) })
  await page.waitForTimeout(120)
  ok(await page.evaluate(() => !TALK && !TTSON && !TTS.speaking), "смахнули — Изи сразу замолчала")
  await page.waitForTimeout(700)
  const c = await page.evaluate(() => ({ tab, mic: RECS.some(r => r.on), list: ($(".chat-list") || {}).textContent || "" }))
  ok(c.tab === "chat", "попали в чат, а не на «Сегодня»", c.tab)
  ok(!c.mic, "микрофон выключен")
  ok(/стоматолог перенесён/.test(c.list) && /напомню завтра в 14:30/.test(c.list), "вся переписка разговора — текстом в чате", c.list.slice(0, 200))
  await page.screenshot({ path: SHOTS + `te-3-chat${T}.png` })
  // 3. недосказанная фраза уходит в строку ввода; «Закончить» работает как смахивание
  await page.evaluate(() => setTab("money")); await page.waitForTimeout(200)
  await page.evaluate(() => talkOpen()); await page.waitForTimeout(700)
  await page.evaluate(() => { TALK.heard = "и купи молоко"; talkState("listen", null, "и купи молоко") }); await page.waitForTimeout(200)
  await page.click("#talk .tk-end"); await page.waitForTimeout(800)
  const d = await page.evaluate(() => ({ tab, v: ($("#chat-in") || {}).value, n: SPOKE.length }))
  ok(d.tab === "chat" && d.v === "и купи молоко", "«Закончить»: чат, недосказанное — в строке ввода", d)
  if (!dark) await page.screenshot({ path: SHOTS + `te-4-draft.png` })
  ok(!errors.filter(e => !/favicon|Failed to load resource/.test(e)).length, "без ошибок на странице", errors)

  if (!dark) {   // ребёнок
    const SECRET = "s".repeat(32)
    await page.evaluate(s => connect(s), Buffer.from(JSON.stringify({ v: 1, hook: "https://script.google.com/macros/s/TEST/exec", secret: SECRET, key: "sk-test", routes: [], cfg: { currency: "฿" } })).toString("base64"))
    await page.waitForTimeout(1500)
    const ask = async v => { await page.waitForSelector("#ask-v"); await page.fill("#ask-v", String(v)); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(350) }
    await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close(); setTab("plans"); plansF = "fam"; render() }); await page.waitForTimeout(300)
    await page.click('[data-f="new"]'); await ask("Папа"); await ask("Семья"); await page.waitForTimeout(600)
    await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close(); D.fam.shareAsked = 1; render() }); await page.waitForTimeout(300)
    await page.click('[data-f="kid"]'); await ask("Миша"); await ask(9); await page.waitForTimeout(600)
    await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
    const kidId = await page.evaluate(() => Object.entries(D.fam.data.members).find(([, m]) => m.name === "Миша")[0])
    const link = await page.evaluate(id => FAM.link(Object.assign({ id }, D.fam.data.members[id])), kidId)
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", timezoneId: "Asia/Bangkok" })
    const kp = await ctx2.newPage(); const kerr = []
    kp.on("pageerror", e => kerr.push(String(e)))
    await kp.clock.setFixedTime(time)
    await kp.route("https://script.google.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(sheet.post(r.request().postData())) }))
    await kp.goto(link.replace(/^https?:\/\/[^/]+\//, page.url().replace(/#.*$/, "").replace(/[^/]*$/, "")))
    await kp.waitForTimeout(2200)
    await kp.evaluate(FAKES)
    await kp.evaluate(() => { D.kchat = [{ role: "user", content: "Сколько звёзд мне до велосипеда?" }, { role: "assistant", content: "Осталось 40 звёзд. Если делать все утренние дела, хватит недели за две!" }]; save(false) })
    await kp.click('#knav [data-kt="izi"]'); await kp.waitForTimeout(500)
    await kp.click(".kgo"); await kp.waitForTimeout(500)
    await kp.evaluate(() => { TTS.speaking = true }); await kp.waitForTimeout(400)
    ok(await kp.evaluate(() => !$(".klivep").hidden), "ребёнок: живой разговор открыт")
    await kp.screenshot({ path: SHOTS + "te-5-kid-live.png" })
    await kp.evaluate(() => drag(".kid-sheet", [120, 200, 280, 360, 440]))
    await kp.waitForTimeout(700)
    const k = await kp.evaluate(() => ({ open: stack.length > 0 && !!$(".kmsgs"), live: !$(".klivep").hidden, rec: RECS.some(r => r.on), say: TTS.speaking, txt: $(".kmsgs").textContent }))
    ok(k.open, "ребёнок: смахнул — окно чата осталось", k)
    ok(!k.live && !k.rec && !k.say, "ребёнок: Изи замолчала, микрофон выключен, разговор закончен", k)
    ok(/40 звёзд/.test(k.txt), "ребёнок: переписка осталась", k.txt)
    await kp.screenshot({ path: SHOTS + "te-6-kid-after.png" })
    await kp.evaluate(() => drag(".kid-sheet", [120, 200, 280, 360, 440]))
    await kp.waitForTimeout(700)
    ok(await kp.evaluate(() => !stack.length), "ребёнок: в тишине смахивание закрывает окно, как раньше")
    ok(!kerr.length, "у ребёнка без ошибок", kerr)
  }
  await browser.close(); server && server.close && server.close()
}
console.log(fails ? "TALKEND_FAIL " + fails : "TALKEND_OK"); process.exit(fails ? 1 : 0)
