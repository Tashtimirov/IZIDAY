// Голосовое «да» / «нет» на подтверждение Изи (удалить событие и т.п.) — в живом разговоре и в чате. Провал — YES_FAIL
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const { page, browser, server } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z") })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
// разбор ответов
const yn = await page.evaluate(() => ["Да", "да.", "Ага", "ну да", "Давай удаляй", "Конечно, удали", "Удали", "добавь", "ок", "Нет", "нет, не надо", "Не надо", "Да нет, оставь", "отмена", "лучше перенеси на завтра", "Изи, да"].map(a => [a, yesNo(a)]))
const want = [true, true, true, true, true, true, true, true, true, false, false, false, false, false, null, true]
yn.forEach(([a, v], i) => ok(v === want[i], `«${a}» → ${v}`))
// эхо: «да» — не эхо вопроса «…в календарь?»
ok(await page.evaluate(() => !talkEcho("да", "Добавить «Йога» в календарь?")), "«да» после вопроса — не эхо")
ok(await page.evaluate(() => talkEcho("в календарь", "Добавить «Йога» в календарь?")), "хвост вопроса — эхо")
ok(await page.evaluate(() => !talkEcho("да", "Встреча в календаре")), "«да» не эхо от слова «календаре»")
await page.evaluate(() => {
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
  window.SAID = []
  speechSynthesis.speak = u => { SAID.push(u.text); setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 30) }, 10) }
  speechSynthesis.cancel = () => {}
  window.RECS = []
  window.SpeechRecognition = class { constructor() { RECS.push(this) } start() { this.on = true; setTimeout(() => this.onstart && this.onstart(), 20) } stop() { this.on = false } abort() { this.on = false } }
  window.hear = s => { const r = RECS.filter(r => r.on).pop(); if (!r) return false; r.onresult({ results: [Object.assign([{ transcript: s }], { isFinal: false })] }); return true }
})
await page.evaluate(() => setTab("chat")); await page.waitForTimeout(300)
await page.evaluate(() => talkOpen()); await page.waitForTimeout(500)
// Изи спрашивает подтверждение — отвечаем голосом «да»
await page.evaluate(() => { window.ANS = "—"; chatConfirm("Удалить «Йога»?\nСреда, 10:00").then(v => ANS = v) })
await page.waitForTimeout(700)
ok(await page.evaluate(() => SAID.some(s => /Удалить «Йога»/.test(s) && !/Да или Нет/i.test(s))), "вопрос прочитан без «Да или Нет?»: " + (await page.evaluate(() => SAID.slice(-1)[0])))
ok(await page.evaluate(() => TALK.state === "listen"), "после вопроса — слушает")
ok(await page.evaluate(() => hear("да")), "сказали «да»")
await page.waitForTimeout(1600)
ok(await page.evaluate(() => ANS === true), "«да» голосом подтвердило за ~1 с: " + await page.evaluate(() => ANS))
// «нет»
await page.evaluate(() => { talkClose() }); await page.waitForTimeout(600)
await page.evaluate(() => talkOpen()); await page.waitForTimeout(500)
await page.evaluate(() => { window.ANS = "—"; chatConfirm("Удалить напоминание «Купить хлеб»?").then(v => ANS = v) })
await page.waitForTimeout(700); await page.evaluate(() => hear("нет не надо")); await page.waitForTimeout(1600)
ok(await page.evaluate(() => ANS === false), "«нет, не надо» голосом — отмена")
// своими словами — ответ уходит помощнику
await page.evaluate(() => { talkClose() }); await page.waitForTimeout(600)
await page.evaluate(() => talkOpen()); await page.waitForTimeout(500)
await page.evaluate(() => { window.ANS = "—"; chatConfirm("Удалить «Йога»?").then(v => ANS = [v, confirmSaid]) })
await page.waitForTimeout(700); await page.evaluate(() => hear("лучше перенеси на завтра")); await page.waitForTimeout(3600)
ok(await page.evaluate(() => ANS[0] === false && ANS[1] === "лучше перенеси на завтра"), "ответ своими словами передан помощнику: " + JSON.stringify(await page.evaluate(() => ANS)))
await page.evaluate(() => { talkClose() }); await page.waitForTimeout(600)
// обычный чат: кнопки «Да»/«Нет» остаются, ответ голосом/текстом «давай» тоже подтверждает
await page.evaluate(() => { window.ANS = "—"; chatConfirm("Удалить «Йога»?").then(v => ANS = v) }); await page.waitForTimeout(300)
ok(await page.evaluate(() => !!askWait), "в чате ждёт ответа")
await page.evaluate(() => chatSend("Давай", { voice: true })); await page.waitForTimeout(200)
ok(await page.evaluate(() => ANS === true), "в чате «Давай» голосом — подтверждено")
await browser.close(); server && server.close && server.close()
console.log(fails ? "YES_FAIL " + fails : "YES_OK"); process.exit(fails ? 1 : 0)
