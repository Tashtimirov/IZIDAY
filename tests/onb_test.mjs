// Обучение новичков (onb.js): карточки знакомства с выбором «Взрослый / Ребёнок», «Первые шаги», подсказки разделов,
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
  : r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ content: [{ type: "text", text: "ок" }], stop_reason: "end_turn" }) }))
const shot = n => page.screenshot({ path: SHOTS + n + ".png" })

console.log("Новый пользователь: знакомство")
await page.goto(BASE + "#setup=" + encodeURIComponent(setup))
await page.waitForTimeout(1500)
check(await page.isVisible("#onb"), "при первом запуске открыто знакомство")
check(/Привет! Я\s*Изи/.test(await page.textContent("#onb")), "Изи здоровается", await page.textContent("#onb .ob-h"))
await shot("o-1-hello")
await page.evaluate(() => { window._who = []; window.addEventListener("izi:who", e => window._who.push(e.detail)) })
await page.click('[data-who="kid"]'); await page.waitForTimeout(500)
check(await page.evaluate(() => D.who === "kid" && $("#onb").classList.contains("kid")), "выбор «Ребёнок» — детские карточки")
check(/помогу копить на мечту/.test(await page.textContent("#onb")), "детский текст")
await shot("o-kid-1")
await page.click('[data-ob="next"]'); await page.waitForTimeout(500); await shot("o-kid-2")
await page.click('[data-ob="quiz-skip"]'); await page.waitForTimeout(500)
await page.click('[data-ob="next"]'); await page.waitForTimeout(600); await shot("o-kid-3")
check(/Поехали/.test(await page.textContent('[data-ob="next"]')), "у ребёнка последняя кнопка «Поехали!»")
for (let k = 0; k < 9 && !(await page.isVisible('[data-who="adult"]')); k++) {
await page.evaluate(() => { const o = $("#onb"); o.dispatchEvent(new TouchEvent("touchstart", { touches: [new Touch({ identifier: 1, target: o, clientX: 60, clientY: 400 })] })); o.dispatchEvent(new TouchEvent("touchend", { changedTouches: [new Touch({ identifier: 1, target: o, clientX: 300, clientY: 405 })] })) }); await page.waitForTimeout(450)
}
check(await page.isVisible('[data-who="adult"]'), "смахивание вправо возвращает на первую карточку")
await page.click('[data-who="adult"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => D.who === "adult" && !$("#onb").classList.contains("kid")), "обратно «Взрослый»")
check(JSON.stringify(await page.evaluate(() => window._who)) === '["kid","adult"]', "событие izi:who для детского режима", await page.evaluate(() => window._who))
await page.click('[data-ob="next"]'); await page.waitForTimeout(650)
check(/Пара вопросов/.test(await page.textContent("#onb")), "дальше — предложение ответить на вопросы")
await page.click('[data-ob="next"]'); await page.waitForTimeout(650)
check(/Вопрос 1 из 6/.test(await page.textContent("#onb")), "первый вопрос анкеты")
await page.click('[data-v="biz"]'); await page.waitForTimeout(900)
await page.click('[data-ob="next"]'); await page.waitForTimeout(600)
check(/Вопрос 2 из 6/.test(await page.textContent("#onb")) && (await page.evaluate(() => D.prof.occ)) === "biz", "ответ запомнен, «Дальше» — следующий вопрос")
await page.click('[data-ob="next"]'); await page.waitForTimeout(600)
await page.click('[data-v="money"]'); await page.click('[data-v="sleep"]')
check(JSON.stringify(await page.evaluate(() => D.prof.focus)) === '["money","sleep"]', "несколько ответов в одном вопросе", await page.evaluate(() => D.prof.focus))
await page.click('[data-ob="next"]'); await page.waitForTimeout(600)
await page.click('[data-v="water"]'); await page.click('[data-ob="next"]'); await page.waitForTimeout(600)
check(await page.evaluate(() => live(D.habits).some(h => h.title === "Пить воду")), "привычка из анкеты — в «Планах»")
check(/наладить: деньги, сон/.test(await page.evaluate(() => iziStyle())), "Изи знает ответы анкеты")
await page.click('[data-ob="quiz-skip"]'); await page.waitForTimeout(600)
check(/Просто скажите/.test(await page.textContent("#onb")), "«Пропустить анкету» — сразу к обучению")
for (const n of [2, 3]) { await page.click('[data-ob="next"]'); await page.waitForTimeout(650); await shot("o-" + n) }
check(/Начать/.test(await page.textContent('[data-ob="next"]')), "последняя карточка — «Начать»")
await page.click('[data-ob="next"]'); await page.waitForTimeout(800)
check(!(await page.$("#onb")), "знакомство закрылось")

console.log("Первые шаги")
check(await page.isVisible("#ob-steps"), "на «Сегодня» карточка «Первые шаги»")
check(/1 из 6/.test(await page.textContent("#ob-steps")), "сделан только шаг «Планы» (привычка из анкеты)", await page.textContent("#ob-steps .ob-st-h"))
await shot("o-steps")
await page.click('[data-obs="water"]'); await page.waitForTimeout(900)
check(/2 из 6/.test(await page.textContent("#ob-steps")) && await page.$('[data-obs="water"].done'), "стакан воды — шаг отмечен сам", await page.textContent("#ob-steps .ob-st-h"))
await shot("o-steps-1")

console.log("Подсказки разделов")
await page.evaluate(() => setTab("money")); await page.waitForTimeout(1100)
check(await page.isVisible(".ob-tip") && /чек/.test(await page.textContent(".ob-tip")), "в «Деньгах» подсказка про чек")
await shot("o-tip-money")
await page.click(".ob-tip button"); await page.waitForTimeout(500)
check(!(await page.$(".ob-tip")), "«Понятно» закрывает")
await page.evaluate(() => { setTab("today"); setTab("money") }); await page.waitForTimeout(1100)
check(!(await page.$(".ob-tip")), "второй раз подсказка не показывается")
await page.evaluate(() => setTab("health")); await page.waitForTimeout(1100)
const tipEl = await page.$(".ob-tip"); check(tipEl, "в «Здоровье» своя подсказка")
await page.evaluate(() => { const t = $(".ob-tip"); t.dispatchEvent(new TouchEvent("touchstart", { touches: [new Touch({ identifier: 2, target: t, clientX: 200, clientY: 600 })] })); t.dispatchEvent(new TouchEvent("touchend", { changedTouches: [new Touch({ identifier: 2, target: t, clientX: 200, clientY: 720 })] })) })
await page.waitForTimeout(500)
check(!(await page.$(".ob-tip")), "смахивание вниз закрывает подсказку")

console.log("Настройки и повтор")
await page.evaluate(() => setTab("more")); await page.waitForTimeout(600)
check(/Знакомство/.test(await page.textContent("#view")), "в настройках карточка «Знакомство»")
await page.click('[data-do="onb-intro"]'); await page.waitForTimeout(600)
check(await page.isVisible("#onb"), "знакомство открывается из настроек")
await page.click('[data-ob="skip"]'); await page.waitForTimeout(600)
check(!(await page.$("#onb")), "«Пропустить» закрывает")
await page.reload(); await page.waitForTimeout(1500)
check(!(await page.$("#onb")), "после перезапуска знакомство не повторяется")

console.log("Старый пользователь")
const old = await page.evaluate(() => { delete D.onb; D.who = undefined; D.water.push({ id: "x1", date: Date.now(), u: Date.now(), ml: 250 }); D.chat.push({ role: "user", text: "привет", at: Date.now() }); ONB.start(); return { ov: !!$("#onb"), steps: !!$("#ob-steps"), o: D.onb } })
check(!old.ov && !old.steps && old.o.intro, "у того, кто уже пользовался, знакомство и шаги сами не появляются", old)

await page.emulateMedia({ colorScheme: "dark" })
await page.evaluate(() => { delete D.onb.steps; D.onb.tips = {}; ONB.intro() }); await page.waitForTimeout(700); await shot("o-1-dark")
check(!errors.length, "без ошибок на странице", errors)
console.log(ok ? "ONB_OK" : "ONB_FAIL")
await browser.close(); server.close()
