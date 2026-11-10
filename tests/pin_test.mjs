// Закрепление голосового окна: держать «Изи» и смахнуть вверх → разговор панелью над меню, вкладки работают.
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
// 1. разговор закреплён панелью (удержание «Изи» убрано — открываем напрямую)
await page.evaluate(() => talkOpen({ pin: true, say: "напомни купить воду завтра в девять" })); await page.waitForTimeout(500)
ok(await page.evaluate(() => TALK && TALK.pin && document.body.classList.contains("talk-pin")), "разговор закреплён панелью")
ok(await page.evaluate(() => tab === "today"), "остались на вкладке «Сегодня»")
ok(await page.evaluate(() => D.chat.some(m => m.role === "user" && /купить воду/.test(m.text))), "услышанное ушло Изи сразу")
await page.waitForTimeout(700)
ok(await page.evaluate(() => TALK.state === "say" || TALK.state === "listen"), "Изи отвечает голосом, вкладка та же: " + await page.evaluate(() => TALK.state + " / " + tab))
await page.evaluate(() => talkState("say", "Записал: купить воду завтра в девять.", "")); await page.waitForTimeout(900)
await page.screenshot({ path: `${out}/2-pinned-today${sfx}.png` })
// 2. ходим по вкладкам
await page.click('#tabs [data-tab="money"]'); await page.waitForTimeout(700)
ok(await page.evaluate(() => tab === "money" && TALK && TALK.pin), "вкладка «Деньги» открылась, разговор остался")
await page.evaluate(() => talkState("listen", null, "запиши расход триста батов на такси")); await page.waitForTimeout(900)
await page.screenshot({ path: `${out}/3-pinned-money${sfx}.png` })
await page.click('#tabs [data-tab="health"]'); await page.waitForTimeout(700)
await page.evaluate(() => talkState("think", "·  ·  ·", "сколько воды я сегодня выпил?")); await page.waitForTimeout(900)
await page.screenshot({ path: `${out}/4-pinned-health${sfx}.png` })
await page.evaluate(() => setTab("chat")); await page.waitForTimeout(700)
await page.evaluate(() => talkState("listen", null, "Говорите — я слушаю")); await page.waitForTimeout(900)
await page.screenshot({ path: `${out}/5-pinned-chat${sfx}.png` })
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
// 3. панель вверх — на весь экран; там вверх — снова панель; вниз — закончить
await swipe(-80)
ok(await page.evaluate(() => TALK && !TALK.pin), "панель вверх — разговор на весь экран")
await page.evaluate(() => talkState("say", "Готово. Что-нибудь ещё?", "")); await page.waitForTimeout(700)
await page.screenshot({ path: `${out}/6-full${sfx}.png` })
await swipe(-160)
ok(await page.evaluate(() => TALK && TALK.pin), "полный экран вверх — снова панель")
await swipe(80)
ok(await page.evaluate(() => !TALK && !document.body.classList.contains("talk-pin")), "панель вниз — разговор закончен")
// 4. удержание «Изи» больше не записывает
await page.evaluate(() => setTab("today")); await page.waitForTimeout(500)
const n0 = await page.evaluate(() => D.chat.length)
await page.mouse.move(fab.x, fab.y); await page.mouse.down(); await page.waitForTimeout(450)
await page.mouse.up(); await page.waitForTimeout(500)
ok(await page.evaluate(n0 => D.chat.length === n0 && !voice && tab === "chat", n0), "держать «Изи» — записи нет, просто чат")
ok(!errors.length, "без ошибок в консоли " + errors.join(" | "))
console.log(fails ? "PIN_FAIL" : "PIN_OK")
await browser.close(); server.close()
