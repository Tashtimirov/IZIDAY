// Функции по выбору (feat.js). Было: обучение новичков (onb.js): карточки знакомства с выбором «Взрослый / Ребёнок», «Первые шаги», подсказки разделов,
// старым пользователям знакомство само не показывается. Снимки — build/web-shots/o-*
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
import http from "http"
import fs from "fs"
import path from "path"
import { sheetScript } from "./fake_sheet.mjs"

const ROOT = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]).replace(/\/$/, "/index.html"))
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end() }
  const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" }[path.extname(p)]
  res.writeHead(200, { "content-type": (type || "text/plain") + "; charset=utf-8" }); fs.createReadStream(p).pipe(res)
}).listen(0)
const BASE = `http://localhost:${server.address().port}/`
const sheet = sheetScript()
const SECRET = "s".repeat(32)
const setup = Buffer.from(JSON.stringify({ v: 1, hook: "https://script.google.com/macros/s/TEST/exec", secret: SECRET, key: "sk-test", routes: [],
  sheetUrl: "https://docs.google.com/spreadsheets/d/T/edit", run: "scriptable:///run/MyDay",
  cfg: { currency: "฿", currencyIn: "в батах", agentModel: "claude-sonnet-5-5", health: { waterGoal: 2000, glass: 250 },
    categories: { expense: [["Транспорт", ["такси"]], ["Другое", []]], income: [["Зарплата", []], ["Другое", []]] }, calendars: [] } }), "utf8").toString("base64")

const window_sys = []
let ok = true
const check = (cond, msg, got) => { console.log(cond ? "   ✓" : "   ✗", msg, cond ? "" : JSON.stringify(got)); ok = ok && !!cond }
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU" })
await ctx.addInitScript(() => { window.ONB_TEST = 1 })
const page = await ctx.newPage()
const errors = []
page.on("pageerror", e => errors.push(String(e)))
await page.route("https://script.google.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(sheet.post(r.request().postData())) }))
await page.route("https://api.anthropic.com/**", r => r.request().method() === "OPTIONS" ? r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } })
  : (() => { const b = r.request().postData() || ""; window_sys.push(b)
    const used = /tool_result/.test(b), want = /такси/.test(b)
    const body = want && !used ? { content: [{ type: "tool_use", id: "tu1", name: "add_money", input: { type: "expense", amount: 350, method: "transfer", category: "Транспорт", comment: "такси" } }], stop_reason: "tool_use" }
      : { content: [{ type: "text", text: want ? "Записал: такси, 350 ฿, категория «Транспорт»." : "ок" }], stop_reason: "end_turn" }
    return r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) }) })())
const shot = n => page.screenshot({ path: SHOTS + n + ".png" })


const SH = process.env.FEAT_SHOTS || SHOTS
const shot2 = async n => { await page.screenshot({ path: SH + n + "-light.png" }); await page.emulateMedia({ colorScheme: "dark" }); await page.waitForTimeout(250); await page.screenshot({ path: SH + n + "-dark.png" }); await page.emulateMedia({ colorScheme: "light" }); await page.waitForTimeout(150) }
const tab = async t => { await page.evaluate(t => setTab(t), t); await page.waitForTimeout(500) }

console.log("Новичок: выбор функций в знакомстве")
await page.goto(BASE + "#setup=" + encodeURIComponent(setup))
await page.waitForTimeout(1500)
check(await page.isVisible("#onb"), "знакомство открыто")
for (let k = 0; k < 6 && !(await page.isVisible('[data-q="focus"][data-v="money"]')); k++) { await page.click('[data-ob="next"]'); await page.waitForTimeout(450) }
await page.click('[data-q="focus"][data-v="money"]'); await page.waitForTimeout(200)
await page.click('[data-ob="quiz-skip"]'); await page.waitForTimeout(600)
for (let k = 0; k < 4 && !(await page.isVisible(".ft-pick")); k++) { await page.click('[data-ob="next"]'); await page.waitForTimeout(500) }
check(await page.isVisible(".ft-pick"), "есть шаг «Что включить сейчас?»")
check(/Что включить сейчас/.test(await page.textContent("#onb")), "заголовок шага")
const st = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".ft-pick [data-ft-tg]")].map(b => [b.dataset.ftTg, b.querySelector(".tgl").classList.contains("on")])))
let s = await st()
check(s.money === true && s.health === false && s.game === false && s.fast === false && s.family === false, "по анкете: Деньги вкл, Здоровье/Игра/Голодание/Семья выкл", s)
check(!/Лекарства|Дни рождения/.test(await page.textContent(".ft-pick")), "лекарств и дней рождения в списке нет (лекарства в «Здоровье», дни рождения всегда)")
check(/лекарства/.test(await page.textContent('[data-ft-tg="health"]')), "у «Здоровья» в описании лекарства")
await page.screenshot({ path: SH + "f1-pick.png" })
await page.click('[data-ft-tg="fast"]'); await page.waitForTimeout(150)
s = await st(); check(s.fast === true, "переключатель меняется касанием", s)
await page.click('[data-ft-tg="fast"]'); await page.waitForTimeout(150)
await page.click('[data-ob="next"]'); await page.waitForTimeout(500)
for (let k = 0; k < 3 && await page.isVisible("#onb"); k++) { await page.click('[data-ob="next"]'); await page.waitForTimeout(600) }
check(!(await page.isVisible("#onb")), "знакомство закрылось")
const on = () => page.evaluate(() => Object.fromEntries(FEAT.LIST.map(x => [x[0], FEAT.on(x[0])])))
s = await on()
check(s.money && !s.health && !s.game && !s.fast && !s.family, "выбор применён", s)
check(await page.evaluate(() => !!D.gamiOff), "игра выключена через прежний «Режим игры»")

console.log("«Сегодня»: выключенные функции внизу")
await tab("today")
check(await page.isVisible(".ft-tray"), "внизу «Выключенные функции»")
check(/Здоровье/.test(await page.textContent(".ft-tray")) && /Игра/.test(await page.textContent(".ft-tray")), "в списке Здоровье и Игра")
check(!(await page.isVisible('.rings-card [data-do="water"]')), "кольцо воды скрыто без «Здоровья»")
check(!/Отметьте стакан воды/.test(await page.textContent("#view")), "в «Первых шагах» нет шага про воду")
await page.evaluate(() => document.querySelector(".ft-tray").scrollIntoView())
await page.waitForTimeout(300); await shot2("f2-tray")

console.log("Выключенный раздел — витрина")
await tab("health")
check(await page.isVisible(".ft-show"), "в «Здоровье» витрина")
check(!(await page.isVisible(".ob-tip")), "подсказка раздела не всплывает поверх витрины")
await shot2("f3-health-off")
await page.click('.ft-show [data-ft-on="health"]'); await page.waitForTimeout(500)
check(await page.evaluate(() => FEAT.on("health")) && !(await page.isVisible(".ft-show")), "«Подключить» включает раздел")

console.log("Изи и выключенные «Деньги»")
await page.evaluate(() => FEAT.set("money", false, true)); await tab("chat")
await page.fill("#chat-in", "потратил 350 на такси")
await page.evaluate(() => chatSend($("#chat-in").value)); await page.waitForTimeout(2500)
check(await page.evaluate(() => live(D.money).some(e => e.amount === 350)), "трата записана, хотя «Деньги» выключены")
check(await page.isVisible(".ft-offer-c"), "под ответом карточка «Подключить»")
check(window_sys.some(b => /выключил разделы: Деньги/.test(b)), "Изи знает, что «Деньги» выключены")
await shot2("f4-chat-offer")
await page.click('.ft-offer-c [data-ft-no]'); await page.waitForTimeout(300)
check(!(await page.isVisible(".ft-offer-c")), "«Не сейчас» убирает карточку")
await page.evaluate(() => FEAT.touched("add_money")); await page.evaluate(() => renderChat())
check(!(await page.isVisible(".ft-offer-c")), "второй раз за неделю не предлагает")

console.log("Витрина «Денег»: уже записанное можно удалить")
await tab("money")
check(await page.isVisible(".ft-ops"), "список уже записанного", await page.evaluate(() => [tab, FEAT.on("money"), $("#view").innerHTML.slice(0, 300), live(D.money).length]))
await shot2("f5-money-off")
const delOk = await page.evaluate(() => { const id = live(D.money).find(e => e.amount === 350).id; document.querySelector(`.ft-del[data-ft-del="${id}"]`).click(); return !live(D.money).some(e => e.id === id) && !document.querySelector(`.ft-del[data-ft-del="${id}"]`) })
check(delOk, "«Удалить» убирает трату")

console.log("Карточка «Можно подключить»")
await page.evaluate(() => { D.onb.intro = Date.now() - 4 * 864e5; D.featAsk = {}; FEAT._reset() }); await tab("today")
check(await page.isVisible(".ft-hint"), "через 3 дня на «Сегодня» карточка «Можно подключить»")
await page.evaluate(() => document.getElementById("ft-hint").scrollIntoView({ block: "center" })); await page.waitForTimeout(300); await shot2("f6-hint")
await page.click('.ft-hint [data-ft-hide]'); await page.waitForTimeout(500)
check(!(await page.isVisible(".ft-hint")), "«Не сейчас» скрывает")
await page.evaluate(() => FEAT._reset()); await page.evaluate(() => render())
check(!(await page.isVisible(".ft-hint")), "раньше чем через 3 дня снова не показывается")

console.log("Настройки → «Функции»")
await tab("more")
check(await page.isVisible("#ft-more"), "карточка «Функции» в настройках")
await page.evaluate(() => document.getElementById("ft-more").scrollIntoView()); await shot2("f7-settings")
await page.click('#ft-more [data-ft-tg="game"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => !D.gamiOff), "Игра включается из настроек")
await page.click('#ft-more [data-ft-tg="family"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => FEAT.on("family") && PLAN_F.some(x => x[0] === "fam")), "Семья включается и появляется в «Планах»")
await page.click('#ft-more [data-ft-tg="family"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => !PLAN_F.some(x => x[0] === "fam")), "Семья выключается — фильтра нет")
await page.click('#ft-more [data-ft-tg="money"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => FEAT.on("money")), "Деньги включаются из настроек")

console.log("Старый пользователь")
const p2 = await ctx.newPage(); p2.on("pageerror", e => errors.push(String(e)))
await p2.evaluate(() => 0)
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ru-RU" })
await ctx2.addInitScript(() => { window.ONB_TEST = 1; localStorage.setItem("myday.web", JSON.stringify({ money: [{ id: "m1", date: Date.now(), type: "expense", amount: 100, category: "Другое" }] })) })
const p3 = await ctx2.newPage(); p3.on("pageerror", e => errors.push(String(e)))
await p3.route("https://script.google.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(sheet.post(r.request().postData())) }))
await p3.goto(BASE + "#setup=" + encodeURIComponent(setup)); await p3.waitForTimeout(1500)
const s3 = await p3.evaluate(() => window.FEAT && Object.fromEntries(FEAT.LIST.map(x => [x[0], FEAT.on(x[0])])))
check(s3 && s3.money && s3.health && s3.fast, "у старого пользователя всё включено как было", s3)
check(!(await p3.isVisible(".ft-tray")) || /Игра|Семья/.test(await p3.textContent(".ft-tray")), "Деньги и Здоровье не в выключенных")

check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()
console.log(ok ? "FEAT_OK" : "FEAT_FAIL")
