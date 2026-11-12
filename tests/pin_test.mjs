// Панели разговора над меню («Изи · Пауза — Не слышу…») больше нет: ни кнопкой чата, ни «+», ни смахиванием вверх.
// node tests/pin_test.mjs <папка для снимков> [dark]
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2] || "/tmp/pin"; fs.mkdirSync(out, { recursive: true })
const dark = process.argv[3] === "dark", sfx = dark ? "-dark" : ""
const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-05T03:00:00Z"), dark })
let fails = 0
const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails++ }
await page.evaluate(() => {
  speechSynthesis.speak = u => { setTimeout(() => u.onstart && u.onstart(), 30) }
  speechSynthesis.cancel = () => {}
  window.RECS = []
  window.SpeechRecognition = class { constructor() { RECS.push(this) } start() {} stop() { setTimeout(() => this.onend && this.onend(), 20) } abort() {} }
  window.hear = s => { const r = RECS[RECS.length - 1]; r.onresult({ results: [Object.assign([{ transcript: s }], { isFinal: false })] }) }
  window.agentTurn = async () => { await new Promise(r => setTimeout(r, 300)); D.tasks = D.tasks || []; return "Записал: купить воду завтра в девять." }
})
await page.evaluate(() => setTab("today")); await page.waitForTimeout(700)
const fab = await page.$eval("#fab", e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
const pinned = () => page.evaluate(() => !!(TALK && TALK.pin) || document.body.classList.contains("talk-pin") || !!document.querySelector("#talk.pin"))
// 1. даже если кто-то просит закрепить — разговор на весь экран
await page.evaluate(() => talkOpen({ pin: true })); await page.waitForTimeout(500)
ok(await page.evaluate(() => !!TALK) && !(await pinned()), "talkOpen({pin}) — без панели, на весь экран")
await page.evaluate(() => talkPin(true)); await page.waitForTimeout(300)
ok(!(await pinned()), "talkPin(true) — панели нет")
const swipe = async (dy) => {
  const box = await page.$eval("#talk .tk-sheet", e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 300) } })
  await page.evaluate(({ x, y, dy }) => {
    const el = document.querySelector("#talk .tk-sheet"), T = (yy) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: yy })]
    el.dispatchEvent(new TouchEvent("touchstart", { touches: T(y), bubbles: true }))
    el.dispatchEvent(new TouchEvent("touchmove", { touches: T(y + dy), bubbles: true }))
    el.dispatchEvent(new TouchEvent("touchend", { touches: [], bubbles: true }))
  }, { ...box, dy })
  await page.waitForTimeout(550)
}
// 2. смахнуть вверх — панели нет, разговор открыт
await swipe(-200)
ok(await page.evaluate(() => !!TALK) && !(await pinned()), "вверх — панели нет, разговор на весь экран")
// 3. кнопка чата в разговоре — разговор закончен, открыт чат, панели нет
await page.evaluate(() => $("#talk .tk-chat").click()); await page.waitForTimeout(700)
ok(await page.evaluate(() => !TALK && tab === "chat" && !document.querySelector("#talk")) && !(await pinned()), "кнопка «чат» — разговор закончен, чат без панели")
await page.screenshot({ path: `${out}/chat-no-panel${sfx}.png` })
// 4. «+» в разговоре — тоже без панели
await page.evaluate(() => talkOpen()); await page.waitForTimeout(500)
await page.evaluate(() => { const t = document.querySelector("#talk .tk-plus"); t && t.click() }); await page.waitForTimeout(900)
ok(await page.evaluate(() => !TALK && tab === "chat") && !(await pinned()), "«+» в разговоре — чат, панели нет")
// 5. вниз — закончить
await page.evaluate(() => talkOpen()); await page.waitForTimeout(500)
await swipe(200); await page.waitForTimeout(300)
ok(await page.evaluate(() => !TALK), "вниз — разговор закончен")
// 6. держать «Изи» — записи нет
await page.evaluate(() => setTab("today")); await page.waitForTimeout(500)
const n0 = await page.evaluate(() => D.chat.length)
await page.mouse.move(fab.x, fab.y); await page.mouse.down(); await page.waitForTimeout(450)
await page.mouse.up(); await page.waitForTimeout(500)
ok(await page.evaluate(n0 => D.chat.length === n0 && !voice && tab === "chat", n0), "держать «Изи» — записи нет, просто чат")
ok(!errors.length, "без ошибок в консоли " + errors.join(" | "))
console.log(fails ? "PIN_FAIL" : "PIN_OK")
await browser.close(); server.close()
