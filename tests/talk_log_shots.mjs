// Переписка в живом разговоре: снимки (история + Изи говорит, вы говорите, думает) и проверка поведения. Печатает TALKLOG_OK / TALKLOG_FAIL
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const dark = process.argv[3] === "dark", sfx = dark ? "-dark" : ""
const { page, browser, server, errors } = await boot2({ root: process.env.SITE || new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-11T10:00:00Z"), dark })
await page.evaluate(() => {
  speechSynthesis.speak = u => { setTimeout(() => u.onstart && u.onstart(), 30) }
  speechSynthesis.cancel = () => {}
  window.SpeechRecognition = window.webkitSpeechRecognition = class { start() {} stop() {} abort() {} }
  if (window.STT) STT.on = () => false
})
const fail = []
await page.evaluate(() => {
  const n = Date.now()
  D.chat = [
    { role: "user", text: "что у меня сегодня вечером?", at: n - 900e3 },
    { role: "assistant", text: "В 19:00 падел в Padel Club, ехать 25 минут — выезжайте в 18:30. После него ничего нет.", at: n - 890e3 },
    { role: "user", text: "а продукты я купил?", at: n - 600e3, voice: true },
    { role: "assistant", text: "Нет, в списке покупок ещё молоко, яйца и авокадо.", at: n - 590e3 }]
  setTab("chat")
})
await page.waitForTimeout(600)
await page.evaluate(() => talkOpen()); await page.waitForTimeout(700)
const vis = await page.evaluate(() => [...document.querySelectorAll("#talk .tk-msgs .tk-m")].map(e => e.textContent))
if (vis.length !== 4 || !vis[1].includes("Padel")) fail.push("история не видна: " + JSON.stringify(vis))
// говорите вы
await page.evaluate(() => { TALK.heard = "Перенеси падел на субботу на десять утра"; talkState("listen", null, TALK.heard) })
for (let k = 0; k < 30; k++) { await page.evaluate(() => { SILK.ye = 1.2 }); await page.waitForTimeout(40) }
await page.screenshot({ path: `${out}/1-vy-govorite${sfx}.png` })
if (!(await page.$("#talk .tk-live .tk-m.u.live"))) fail.push("нет пузыря с тем, что говорят")
if (await page.evaluate(() => getComputedStyle(document.querySelector("#talk .tk-you")).display !== "none")) fail.push("фраза дублируется подписью")
// думает: фраза ушла в чат
await page.evaluate(() => { TALK.sent = TALK.heard; talkState("think", "·  ·  ·", TALK.heard); D.chat.push({ role: "user", text: TALK.sent, at: Date.now(), voice: true }); talkLog() })
await page.waitForTimeout(900); await page.screenshot({ path: `${out}/2-dumaet${sfx}.png` })
const nu = await page.evaluate(() => [...document.querySelectorAll("#talk .tk-log .tk-m.u")].filter(e => e.textContent.includes("на десять утра")).length)
if (nu !== 1) fail.push("сказанное в переписке " + nu + " раз")
if (!(await page.$("#talk .tk-m.dots"))) fail.push("нет точек «думает»")
// Изи говорит: ответ в переписке, произносимая фраза подсвечена
await page.evaluate(() => { const r = "Готово: падел перенесла на субботу, 10:00. Утром напомню взять ракетку. Хотите, напишу тренеру?"; D.chat.push({ role: "assistant", text: r, at: Date.now() }); TALK.sayParts = sentences(r); TALK.sayI = 2; talkState("say", TALK.sayParts[1], "") })
for (let k = 0; k < 40; k++) { await page.evaluate(() => { SILK.ie = 1.2 }); await page.waitForTimeout(40) }
await page.screenshot({ path: `${out}/3-izi-govorit${sfx}.png` })
const now = await page.evaluate(() => (document.querySelector("#talk .tk-m.say .now") || {}).textContent)
if (!/Утром напомню/.test(now || "")) fail.push("подсвечена не та фраза: " + now)
if (await page.$("#talk .tk-m.dots")) fail.push("точки остались")
const sc = await page.evaluate(() => { const l = document.querySelector("#talk .tk-log"); return l.scrollHeight - l.scrollTop - l.clientHeight })
if (sc > 4) fail.push("переписка не прокручена вниз: " + sc)
// закрепили — переписка прячется, панель как раньше
await page.evaluate(() => talkPin(true)); await page.waitForTimeout(600)
if (await page.evaluate(() => getComputedStyle(document.querySelector("#talk .tk-log")).display !== "none")) fail.push("переписка в закреплённой панели")
await page.screenshot({ path: `${out}/4-zakrepleno${sfx}.png` })
await page.evaluate(() => talkClose()); await page.waitForTimeout(600)
// пустой чат: шар большой, переписки нет
await page.evaluate(() => { D.chat = []; renderChat(); talkOpen() }); await page.waitForTimeout(800)
const w = await page.evaluate(() => document.querySelector("#talk .tk-orb").offsetWidth)
if (w < 300) fail.push("пустой чат — шар маленький " + w)
await page.screenshot({ path: `${out}/0-pustoj${sfx}.png` })
await page.evaluate(() => talkClose()); await page.waitForTimeout(500)
const errs = errors.filter(e => !/favicon|net::|Failed to load resource/i.test(e))
if (errs.length) fail.push("ошибки: " + errs.join(" | "))
console.log(fail.length ? "TALKLOG_FAIL " + fail.join("; ") : "TALKLOG_OK")
await browser.close(); server.close()
