// Голодание: выбор (сутки, 16:8, 18:6, своё), запуск «на сутки», своё на 60 ч с предупреждением и подтверждением,
// идущее голодание (кольцо, стадия, вода, подсказки пушем fs…), лимит 7 суток, Изи (start_fast с confirm). Снимки — build/web-shots/fast-*
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const NOW = new Date("2026-11-05T03:11:00Z")   // чт 10:11 по Бангкоку
const dark = process.argv.includes("--dark")
const lists = ({ bkk }) => ({
  water: [{ id: "w0", date: +bkk(0, 8), u: 1, ml: 500 }],
  fast: [{ id: "gold1", date: +bkk(-6, 20), u: 1, start: +bkk(-6, 20), hours: 16, end: +bkk(-5, 12) }],
})
const { page, browser, server, errors } = await boot2({ root, time: NOW, lists, dark })
const P = dark ? "fast-dark-" : "fast-"
await page.evaluate(() => setTab("health")); await page.waitForTimeout(1500); await page.evaluate(() => render())
const scrollTo = async () => { await page.waitForTimeout(2600); await page.evaluate(() => document.getElementById("fast").scrollIntoView({ block: "center" })); await page.waitForTimeout(800) }
const card = () => page.$eval("#fast", e => e.innerText.replace(/\s+/g, " "))
let t = await card()
check(/Сутки/.test(t) && /16:8/.test(t) && /18:6/.test(t) && /Своё/.test(t) && /до 7 суток/.test(t), "выбор: сутки, 16:8, 18:6, своё", t)
check(/Прошлое: 16 ч/.test(t), "прошлое голодание", t)
await scrollTo(); await page.screenshot({ path: SHOTS + P + "1-choose.png" })

// «Сутки» → окно запуска
await page.click('[data-fs="24"]'); await page.waitForTimeout(500)
let s = await page.$eval(".sheet.show", e => e.innerText.replace(/\s+/g, " "))
check(/Длительность 24 часа/.test(s) && /Конец завтра в 10:11/.test(s), "окно: сутки, конец завтра в 10:11", s)
check(/Пейте воду/.test(s) && !/Долгое голодание/.test(s), "на сутки — только мягкий совет", s)
check(!(await page.$eval("[data-go]", b => b.disabled)), "кнопка «Начать» доступна")
await page.screenshot({ path: SHOTS + P + "2-day.png" })

// своё: 60 часов → предупреждение и подтверждение
await page.fill("#fs-n", "60"); await page.waitForTimeout(200)
s = await page.$eval(".sheet.show", e => e.innerText.replace(/\s+/g, " "))
check(/Долгое голодание — бережно/.test(s) && /диабете/.test(s) && /до 18 лет/.test(s) && /Сразу прервите/.test(s), "60 ч: предупреждение", s)
check(await page.$eval("[data-go]", b => b.disabled) && /Отметьте предупреждение/.test(s), "без галочки начать нельзя")
await page.evaluate(() => document.querySelector(".sheet.show").scrollTo(0, 0))
await page.screenshot({ path: SHOTS + P + "3-warn.png" })
await page.fill("#fs-n", "200"); await page.waitForTimeout(150)
s = await page.$eval(".sheet.show", e => e.innerText.replace(/\s+/g, " "))
check(/Больше 7 суток не ставлю/.test(s) && await page.$eval("[data-go]", b => b.disabled), "больше 7 суток — нельзя", s)
await page.click('#fs-u [data-u="d"]'); await page.fill("#fs-n", "3"); await page.waitForTimeout(150)
s = await page.$eval(".sheet.show", e => e.innerText.replace(/\s+/g, " "))
check(/Длительность 3 суток/.test(s) && /От 3 суток — лучше под присмотром врача/.test(s), "3 суток: совет про врача", s)
// последняя еда раньше: вчера 20:00
await page.click('#fs-a [data-a="1"]'); await page.fill("#fs-t", "2026-11-04T20:00"); await page.dispatchEvent("#fs-t", "change")
await page.check("#fs-ok"); await page.waitForTimeout(150)
s = await page.$eval(".sheet.show", e => e.innerText.replace(/\s+/g, " "))
check(/Конец вс, 8 ноя|Конец .*в 20:00/.test(s) && !(await page.$eval("[data-go]", b => b.disabled)), "с галочкой — можно, конец через 72 ч от вчера 20:00", s)
await page.click("[data-go]"); await page.waitForTimeout(700); await page.evaluate(() => render())
let f = await page.evaluate(() => fastNow())
check(f && f.hours === 72 && f.ack === 1 && new Date(f.start).getUTCHours() === 13, "голодание 72 ч с вчерашних 20:00", f)
t = await card()
check(/14:11/.test(t) && /из 3 суток/.test(t) && /Переход на жиры/.test(t), "кольцо: 14:11 из 3 суток, стадия", t)
check(/0,5 л/.test(t) || /0,50 л/.test(t) || /воды с начала/.test(t), "вода с начала голодания", t)
check(/Пейте 2–3 л воды/.test(t), "короткое предупреждение в карточке", t)
let nd = await page.evaluate(() => live(D.nudges).filter(n => /^fs/.test(n.id)).map(n => ({ id: n.id, t: new Date(n.date).toString().slice(16, 21), title: n.title, text: n.text })))
check(nd.some(n => n.title === "Сутки позади") && nd.some(n => /Голодание · вода/.test(n.title)) && nd.every(n => +n.t.slice(0, 2) >= 9 && +n.t.slice(0, 2) <= 21 || /позади|конец/i.test(n.title)), "подсказки: вода днём и «сутки позади»", nd)
await scrollTo(); await page.screenshot({ path: SHOTS + P + "4-running.png" })
// подробнее
await page.click('[data-fs="more"]'); await page.waitForTimeout(500)
s = await page.$eval(".sheet.show", e => e.innerText.replace(/\s+/g, " "))
check(/Стадии примерные/.test(s) && /24 ч · Сутки/.test(s) && /Продлить или сократить/.test(s), "подробнее: стадии и продление", s)
await page.screenshot({ path: SHOTS + P + "5-stages.png" })
await page.click(".sheet.show [data-stop]"); await page.waitForTimeout(600)
f = await page.evaluate(() => fastNow())
nd = await page.evaluate(() => live(D.nudges).filter(n => /^fs/.test(n.id) && n.date > Date.now()).length)
check(!f && nd === 0, "закончить: подсказки убраны", nd)

// Изи: 60 ч без подтверждения — сначала предупреждение
let r = await page.evaluate(() => runTool("start_fast", { hours: 60 }))
check(r.need_confirm && /диабете/.test(r.warning), "Изи: 60 ч — просит подтверждение", r)
r = await page.evaluate(() => runTool("start_fast", { hours: 300, confirm: true }))
check(/7 суток/.test(r.error || ""), "Изи: 300 ч — отказ", r)
r = await page.evaluate(() => runTool("start_fast", { hours: 24, started_hours_ago: 2 }))
check(r.ok && r.hours === 24, "Изи: сутки, начал 2 часа назад", r); await page.evaluate(() => render())
t = await card()
check(/2:00/.test(t) && /из 24 ч/.test(t), "карточка: 2:00 из 24 ч", t)
const sys = await page.evaluate(() => agentSystem())
check(/Голодание \(start_fast/.test(sys) && /до 18 лет/.test(sys), "Изи знает про безопасность")

check(!errors.length, "без ошибок в консоли", errors)
await browser.close(); server.close()
console.log(ok ? "FAST_OK" : "FAST_FAIL")
