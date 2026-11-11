// Друг подключает свой Google Календарь в приложении: кнопка → Google (код) → сервер друзей → встречи из Google в IZIDAY.
// Google, его API Календаря и сервер подменены (fake_friends.mjs, fake_gcal.mjs). Снимки — build/web-shots/gc-*
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
import http from "http"
import fs from "fs"
import path from "path"
import { friendsServer, CLIENT } from "./fake_friends.mjs"
import { fakeGoogle } from "./fake_gcal.mjs"

const ROOT = process.env.SITE || new URL("../dist/web/", import.meta.url).pathname
const SHOTS = process.argv[2] || new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]).replace(/\/$/, "/index.html"))
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end() }
  const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" }[path.extname(p)]
  res.writeHead(200, { "content-type": (type || "text/plain") + "; charset=utf-8" }); fs.createReadStream(p).pipe(res)
}).listen(0)
const BASE = `http://localhost:${server.address().port}/`
const { G, google } = fakeGoogle()
const F = friendsServer({ google })
F.props.GOOGLE_SECRET = "sec"

let ok = true
const check = (cond, msg, got) => { console.log(cond ? "   ✓" : "   ✗", msg, cond ? "" : JSON.stringify(got)); ok = ok && !!cond }
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", timezoneId: "Europe/Moscow" })
const page = await ctx.newPage()
const errors = []
page.on("pageerror", e => errors.push(String(e)))
const asks = []
await page.route("https://accounts.google.com/**", r => {
  const q = new URL(r.request().url()).searchParams
  asks.push(Object.fromEntries(q))
  if (q.get("response_type") === "code") {   // согласие на календарь: Google отдаёт разовый код в адресе
    G.codes["code" + asks.length] = "rt-web"
    return r.fulfill({ status: 302, headers: { location: q.get("redirect_uri") + "?state=" + q.get("state") + "&code=code" + asks.length + "&scope=" + encodeURIComponent(q.get("scope")) } })
  }
  const id = "web" + asks.length
  F.tokens[id] = { aud: CLIENT, iss: "https://accounts.google.com", exp: String(Date.now() / 1000 + 3600 | 0), email_verified: "true", sub: "777", email: "kirill@example.com", name: "Кирилл Штефан", nonce: q.get("nonce") }
  r.fulfill({ status: 302, headers: { location: q.get("redirect_uri") + "#state=" + q.get("state") + "&id_token=" + id } })
})
await page.route("https://script.google.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(F.post(JSON.parse(r.request().postData()))) }))
const shot = n => page.screenshot({ path: path.join(SHOTS, n + ".png") })
const wait = ms => page.waitForTimeout(ms)
const until = async (fn, ms = 10000) => { for (let t = 0; t < ms; t += 250) { try { if (await page.evaluate(fn)) return true } catch (e) {} await wait(250) } return false }
const closeAll = () => page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })

console.log("Кирилл входит через Google")
await page.goto(BASE)
await wait(800)
await page.click('[data-do="glogin"]')
await until(() => !!(D.conn && D.conn.friend))
await wait(900)
await closeAll()
check(!/calendar/.test(asks[0].scope), "вход по-прежнему просит только имя и почту", asks[0].scope)
// у Кирилла уже есть встречи в Google Календаре
const day = n => { const d = new Date(Date.now() + n * 864e5); return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(d) }
G.cals.primary.push({ id: "g1", summary: "Встреча с инвестором", location: "Москва-Сити", start: { dateTime: day(1) + "T15:00:00+03:00" }, end: { dateTime: day(1) + "T16:00:00+03:00" } })
await page.evaluate(() => calDo("create", { title: "Тренировка", start: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) + "T08:00" }))

console.log("Календарь подсказывает подключить Google")
await page.evaluate(() => setTab("cal"))
await wait(900)
check(await page.$('[data-gc="on"]'), "в календаре — «Подключить» Google Календарь")
await shot("gc-1-calendar-hint")
await page.evaluate(() => setTab("more"))
await wait(900)
check(/Подключить Google Календарь/.test(await page.textContent("#view")), "в «Аккаунте» — кнопка «Подключить Google Календарь»")
await shot("gc-2-account")

console.log("Подключение")
await page.click('#view [data-gc="on"]')
await wait(500)
check(/Приложение не проверено/.test(await page.textContent("#layer")), "заранее объясняем экран «Приложение не проверено»")
await shot("gc-3-explain")
await page.click('#layer .btn:has-text("Подключить")')
await until(() => !!(D.conn && D.conn.friend && D.conn.friend.gcal))
await wait(1200)
const a = asks.at(-1)
check(a.response_type === "code" && a.access_type === "offline" && /calendar\.events/.test(a.scope) && a.login_hint === "kirill@example.com" && a.redirect_uri === BASE, "Google получил верный запрос доступа к календарю", a)
check(!/code=/.test(await page.evaluate(() => location.href)), "код Google убран из адреса")
const layer = await page.textContent("#layer")
check(/Google Календарь подключён/.test(layer) && /1 событие из IZIDAY перенесено|1 событие из IZIDAY перенесены/.test(layer), "сообщение: подключён, своё событие перенесено", layer)
await shot("gc-4-done")
await closeAll()
check(G.cals.primary.some(e => e.summary === "Тренировка"), "событие из IZIDAY теперь в Google Календаре")
await until(() => gcalOn() && D.gcal.events.some(e => e.title === "Встреча с инвестором"))
check(await page.evaluate(() => D.gcal.events.some(e => e.title === "Встреча с инвестором" && e.location === "Москва-Сити")), "встречи из Google Календаря в приложении")
check(!JSON.stringify(await page.evaluate(() => D)).includes("rt-web"), "ключ Google на телефон не попадает")

console.log("Изменения из приложения уходят в Google")
const cr = await page.evaluate(d => calDo("create", { title: "Ужин с семьёй", start: d + "T19:00" }), day(3))
check(cr.ok && G.cals.primary.some(e => e.summary === "Ужин с семьёй"), "новое событие — в Google Календаре", cr)
await page.evaluate(() => setTab("cal"))
await wait(900)
check(!(await page.$('[data-gc="on"]')), "после подключения подсказки в календаре нет")
await shot("gc-5-calendar")
await page.evaluate(() => setTab("more"))
await wait(900)
check(/Google · ann\.real@gmail\.com/.test(await page.textContent("#view")), "в «Аккаунте»: Google и почта календаря")
await shot("gc-6-account-on")

console.log("Отключение")
await page.click('#view [data-gc="off"]')
await wait(400)
await page.click('#layer .btn:has-text("Отключить")')
await until(() => !D.conn.friend.gcal)
check(G.revoked.includes("rt-web"), "доступ отозван у Google")

check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()
console.log(ok ? "FRIENDS_GCAL_WEB_OK" : "FRIENDS_GCAL_WEB_FAIL")
