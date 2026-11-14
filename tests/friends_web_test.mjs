// Вход для друзей в приложении (friends.js): кнопка «Войти через Google» → Google → сервер друзей заводит таблицу →
// календарь, деньги, Изи работают без виджета. Google и сервер подменены (fake_friends.mjs). Снимки — build/web-shots/fr-*
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
import http from "http"
import fs from "fs"
import path from "path"
import { friendsServer, CLIENT } from "./fake_friends.mjs"

const ROOT = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = process.argv[2] || new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]).replace(/\/$/, "/index.html"))
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end() }
  const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" }[path.extname(p)]
  res.writeHead(200, { "content-type": (type || "text/plain") + "; charset=utf-8" }); fs.createReadStream(p).pipe(res)
}).listen(0)
const BASE = `http://localhost:${server.address().port}/`
const F = friendsServer()
F.props.ANTHROPIC_KEY = "sk-owner"

let ok = true
const check = (cond, msg, got) => { console.log(cond ? "   ✓" : "   ✗", msg, cond ? "" : JSON.stringify(got)); ok = ok && !!cond }
check(!/__FRIENDS_HOOK__|__GOOGLE_CLIENT__/.test(fs.readFileSync(ROOT + "friends.js", "utf8")), "в сборке сайта есть адрес сервера и вход Google")
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", timezoneId: "Asia/Bangkok" })
const page = await ctx.newPage()
const errors = []
page.on("pageerror", e => errors.push(String(e)))
const google = []
await page.route("https://accounts.google.com/**", r => {
  const u = new URL(r.request().url()), q = u.searchParams
  google.push(Object.fromEntries(q))
  const id = "web" + google.length
  F.tokens[id] = { aud: CLIENT, iss: "https://accounts.google.com", exp: String(Date.now() / 1000 + 3600 | 0), email_verified: "true", sub: "777", email: "masha@example.com", name: "Маша Иванова", nonce: q.get("nonce") }
  r.fulfill({ status: 302, headers: { location: q.get("redirect_uri") + "#state=" + q.get("state") + "&id_token=" + id + "&authuser=0&prompt=consent" } })
})
let calls = 0
await page.route("https://script.google.com/**", r => { calls++; r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(F.post(JSON.parse(r.request().postData()))) }) })
await page.route("https://api.anthropic.com/**", r => { ok = false; console.log("   ✗ телефон друга обратился к Claude напрямую"); r.abort() })
const shot = n => page.screenshot({ path: path.join(SHOTS, n + ".png") })
const wait = ms => page.waitForTimeout(ms)
async function waitLogin() {   // во время перехода к Google и обратно страница перезагружается
  for (let i = 0; i < 60; i++) { try { if (await page.evaluate(() => !!(D.conn && D.conn.friend))) return true } catch (e) {} await wait(250) }
  return false
}

console.log("Новый человек открывает приложение")
await page.goto(BASE)
await wait(800)
check(await page.$('[data-do="glogin"]'), "на «Сегодня» — кнопка «Войти через Google»")
check(/Войдите через Google/.test(await page.textContent("#top-sub")), "сверху подсказка «Войдите через Google»")
check(!/Подключите приложение к виджету/.test(await page.textContent("#view")), "про виджет новичку не говорим")
await shot("fr-1-login")

console.log("Вход")
await page.click('[data-do="glogin"]')
await waitLogin()
await wait(900)
const g0 = google[0] || {}
check(g0.client_id && g0.response_type === "id_token" && /openid/.test(g0.scope) && g0.redirect_uri === BASE && g0.nonce && g0.state, "Google получил верный запрос входа", g0)
check(!/id_token/.test(await page.evaluate(() => location.href)), "пропуск Google убран из адреса")
check(/Готово, Маша/.test(await page.textContent("#layer")), "приветствие по имени")
await shot("fr-2-welcome")
const conn = await page.evaluate(() => D.conn)
check(conn.friend.email === "masha@example.com" && conn.key === "srv" && conn.secret.length >= 32 && !conn.sheetUrl, "на телефоне: почта, ключ сервера, без ключа Claude", conn)
check(Object.values(F.books).some(b => /Маша/.test(b.name)), "на сервере заведена таблица Маши")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })

console.log("Всё работает без виджета")
await page.evaluate(() => sync())
await wait(500)
await page.evaluate(() => { D.money.push({ id: "e1", date: Date.now(), u: Date.now(), type: "expense", amount: 250, method: "cash", category: "Кафе и рестораны", comment: "кофе" }); save() })
await wait(1800)
const masha = Object.values(F.books).find(b => /Маша/.test(b.name))
check(masha.getSheetByName("Операции").getLastRow() === 2, "расход ушёл в таблицу Маши")
const cr = await page.evaluate(() => calDo("create", { title: "Йога", start: new Date(Date.now() + 864e5).toISOString().slice(0, 10) + "T08:00", end: new Date(Date.now() + 864e5).toISOString().slice(0, 10) + "T09:00" }))
check(cr.ok, "событие создаётся в календаре IZIDAY", cr)
await page.waitForFunction(() => gcalOn() && D.gcal.events.some(e => e.title === "Йога"), null, { timeout: 8000 }).catch(() => {})
check(await page.evaluate(() => gcalOn() && D.gcal.events.some(e => e.title === "Йога")), "календарь работает сам, без Google Календаря и виджета")
const res = await page.evaluate(() => claude({ max_tokens: 200, messages: [{ role: "user", content: "привет" }] }))
check(res.content && res.content[0].text === "Привет!" && F.aiCalls.length === 1 && F.aiCalls[0].key === "sk-owner", "Изи отвечает через сервер, ключ владельца на телефон не попадает", res)
check(await page.evaluate(() => !chatTools().some(t => /^mail_/.test(t.name))), "Изи не предлагает почту, которой у друзей нет")

console.log("Настройки")
await page.evaluate(() => setTab("more"))
await wait(1200)
const more = await page.textContent("#view")
check(/Аккаунт/.test(more) && /masha@example\.com/.test(more) && !/Связь с виджетом/.test(more), "карточка «Аккаунт» вместо виджета")
await shot("fr-3-settings")

console.log("Перезапуск и выход")
await page.reload()
await wait(900)
check(await page.evaluate(() => !!(D.conn && D.conn.friend)), "после перезапуска вход сохраняется")
await page.evaluate(() => setTab("more"))
await wait(400)
await page.click('[data-do="glogout"]')
await wait(300)
await page.click('#layer .btn:has-text("Выйти")')
await wait(600)
check(await page.evaluate(() => !D.conn), "выход: телефон забыл ключ")
check(F.post({ secret: conn.secret, hub: { since: 0 } }).error === "forbidden", "выход: ключ телефона на сервере отозван")

console.log("Повторный вход — те же записи")
await page.evaluate(() => setTab("today"))
await wait(300)
await page.click('[data-do="glogin"]')
await waitLogin()
await wait(2500)
check(/С возвращением/.test(await page.textContent("#layer")), "«С возвращением»")
check(await page.evaluate(() => D.money.some(e => e.id === "e1")), "расход Маши вернулся с сервера")
check(Object.values(F.books).filter(b => /Маша/.test(b.name)).length === 1, "вторая таблица не заводится")

console.log("Знакомство новичка заканчивается входом")
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU" })
await ctx2.addInitScript(() => { window.ONB_TEST = 1 })
const p2 = await ctx2.newPage()
p2.on("pageerror", e => errors.push(String(e)))
await p2.route("https://accounts.google.com/**", r => r.fulfill({ status: 302, headers: { location: new URL(r.request().url()).searchParams.get("redirect_uri") + "#error=access_denied&state=x" } }))
await p2.route("https://script.google.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(F.post(JSON.parse(r.request().postData()))) }))
await p2.goto(BASE)
await p2.waitForSelector("#onb .ob-btn")
// карточек знакомства со временем стало больше: листаем до последней, а не фиксированное число раз
for (let k = 0; k < 12 && /Дальше|Начнём/.test(await p2.textContent('#onb [data-ob="next"]')); k++) { await p2.click('#onb [data-ob="next"]'); await p2.waitForTimeout(350) }
const btn = await p2.textContent('#onb [data-ob="next"]')
check(/Войти через Google/.test(btn) && /войти через Google/.test(await p2.textContent("#onb")), "последняя карточка знакомства — «Войти через Google»", btn)
await p2.screenshot({ path: path.join(SHOTS, "fr-0-intro.png") })
const nav = p2.waitForRequest(/accounts\.google\.com/, { timeout: 5000 }).then(() => true).catch(() => false)
await p2.click('#onb [data-ob="next"]')
check(await nav, "нажатие ведёт ко входу Google")
await p2.waitForTimeout(1500)
await p2.waitForFunction(() => typeof D !== "undefined", null, { timeout: 8000 })
check(await p2.evaluate(() => !D.conn && !document.getElementById("onb")), "отказ в Google — приложение остаётся открытым без ошибок")
await ctx2.close()

check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()
console.log(ok ? "FRIENDS_WEB_OK" : "FRIENDS_WEB_FAIL")
