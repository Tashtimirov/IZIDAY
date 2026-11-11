// Метрики и журнал действий (src/web/metrics.js + metrics_ в Friends.gs): что собирается, что НЕ собирается, куда уходит.
// Сервер друзей подменён (fake_friends.mjs). Снимок карточки настроек — build/web-shots/mt-settings.png
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
import http from "http"
import fs from "fs"
import path from "path"
import { friendsServer, CLIENT } from "./fake_friends.mjs"

let fail = 0
const check = (cond, msg, got) => { console.log(cond ? "   ✓" : "   ✗", msg, cond ? "" : JSON.stringify(got)); if (!cond) fail++ }

// ── сервер ──
console.log("Сервер: журнал действий")
{
  const F = friendsServer()
  const A = F.post({ login: { id_token: "ann", nonce: "n1" } })
  const ev = [[Date.now(), "экран", "Деньги", "", 1, ""], [Date.now(), "скорость", "обмен с таблицей", 812, 3, "макс 1.2 с"], [Date.now(), "взлом", "x", 1, 1, ""], [Date.now(), "ошибка", "=HYPERLINK(\"x\")", "", 1, ""]]
  let r = F.post({ secret: A.secret, metrics: { dev: "a1b2c3", who: "friend", ver: "abc123", plat: "iPhone · приложение", ev } })
  check(r.ok && r.n === 3, "события друга приняты, чужой тип отброшен", r)
  const book = Object.values(F.books).find(b => /журнал действий/.test(b.name))
  check(book && book.getSheetByName("События") && book.getSheetByName("Сводка"), "создана таблица «IZIDAY — журнал действий» с листами «События» и «Сводка»")
  const rows = book.getSheetByName("События").cells
  check(rows[0].join("|") === "Время|Кто|Устройство|Версия|Тип|Что|Мс|Раз|Подробности", "заголовки", rows[0])
  check(rows[1][1] === "Аня · " + rows[1][1].split(" · ")[1] && rows[1][2] === "iPhone · приложение · a1b2c3" && rows[1][0] instanceof Date, "строка подписана именем друга и устройством", rows[1])
  check(rows[2][6] === 812 && rows[2][7] === 3, "время и количество", rows[2])
  check(String(rows[3][5]).startsWith("'="), "формула в тексте не выполняется", rows[3])
  check(Object.keys(book.getSheetByName("Сводка").formulas).length >= 8, "в сводке формулы")
  r = F.post({ metrics: { dev: "ffffff", who: "owner", ev: [[Date.now(), "сеанс", "открыт", 500, 1, ""]] } })
  check(r.ok && rows[4][1] === "владелец", "без ключа — строка «владелец»/«без входа», без доступа к данным", rows[4])
  r = F.post({ secret: "x".repeat(40), metrics: { dev: "eeeeee", ev: [[Date.now(), "сеанс", "открыт", "", 1, ""]] } })
  check(r.ok && rows[5][1] === "без входа", "чужой ключ — «без входа»", rows[5])
  check(Object.values(F.books).filter(b => /журнал/.test(b.name)).length === 1, "таблица журнала одна")
  F.props.METRICS_OFF = "1"
  r = F.post({ metrics: { dev: "ffffff", ev: [[Date.now(), "сеанс", "открыт", "", 1, ""]] } })
  check(r.off && rows.length === 6, "владелец может выключить сбор свойством METRICS_OFF")
}

// ── приложение ──
console.log("Приложение: сбор и отправка")
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
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", timezoneId: "Asia/Bangkok",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" })
const page = await ctx.newPage()
const errors = []
page.on("pageerror", e => errors.push(String(e)))
await page.route("https://accounts.google.com/**", r => {
  const q = new URL(r.request().url()).searchParams
  F.tokens.web1 = { aud: CLIENT, iss: "https://accounts.google.com", exp: String(Date.now() / 1000 + 3600 | 0), email_verified: "true", sub: "777", email: "masha@example.com", name: "Маша Иванова", nonce: q.get("nonce") }
  r.fulfill({ status: 302, headers: { location: q.get("redirect_uri") + "#state=" + q.get("state") + "&id_token=web1" } })
})
const posts = []
await page.route("https://script.google.com/**", r => {
  const b = JSON.parse(r.request().postData()); if (b.metrics) posts.push(b)
  r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(F.post(b)) })
})
const wait = ms => page.waitForTimeout(ms)
await page.goto(BASE)
await wait(800)
check(await page.evaluate(() => !!(window.METRICS && METRICS._hook())), "metrics.js загружен и знает сервер")
await page.click('[data-do="glogin"]')
for (let i = 0; i < 60 && !(await page.evaluate(() => !!(window.D && D.conn && D.conn.friend)).catch(() => false)); i++) await wait(250)
await wait(900)
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })

await page.evaluate(() => { setTab("plans"); setTab("money"); setTab("today") })
await page.evaluate(() => upsert("rems", { id: "r1", text: "Позвонить маме про анализы", at: Date.now() + 36e5, date: Date.now() }))
await page.evaluate(() => upsert("money", { id: "m1", date: Date.now(), type: "expense", amount: 4321, method: "cash", category: "Кафе", comment: "секретный ужин" }))
await page.evaluate(() => upsert("rems", Object.assign({}, D.rems.find(x => x.id === "r1"), { done: true })))
await page.evaluate(() => sync())
await page.evaluate(() => claude({ max_tokens: 50, messages: [{ role: "user", content: "привет" }] }))
await page.evaluate(() => { setTimeout(() => { throw new Error("сломалось у masha@example.com на сумме 4321,50") }, 0); console.error("gami", new Error("тестовая ошибка")) })
await page.evaluate(() => toast("Не удалось записать «секретный ужин»"))
await wait(300)
const ok = await page.evaluate(() => METRICS.flush())
check(ok, "отправка прошла")
const book = Object.values(F.books).find(b => /журнал действий/.test(b.name))
const rows = book ? book.getSheetByName("События").cells.slice(1) : []
const all = JSON.stringify(rows)
const has = (type, what) => rows.some(r => r[4] === type && (typeof what === "string" ? r[5] === what : what.test(r[5])))
check(rows.length >= 8 && rows.every(r => /^Маша · /.test(r[1]) && /^iPhone · браузер · [0-9a-f]{6}$/.test(r[2])), "строки подписаны «Маша» и устройством", rows.slice(0, 2))
check(has("сеанс", "открыт"), "запуск приложения")
check(has("экран", "Планы") && has("экран", "Деньги") && has("экран", "Сегодня"), "открытые экраны")
check(has("действие", "напоминания: добавлено") && has("действие", "деньги: добавлено") && has("действие", "напоминания: выполнено"), "действия по видам", rows.filter(r => r[4] === "действие").map(r => r[5]))
check(has("скорость", "обмен с таблицей") && has("скорость", "ИИ: ответ"), "скорость обмена и ответа ИИ", rows.filter(r => r[4] === "скорость").map(r => r[5]))
check(has("ошибка", /сломалось/) && has("ошибка", /тестовая ошибка/), "ошибки кода", rows.filter(r => r[4] === "ошибка").map(r => r[5]))
check(has("сбой", /подсказка: Не удалось записать/), "сбой из подсказки", rows.filter(r => r[4] === "сбой").map(r => r[5]))
check(!/Позвонить|мам|анализ|секрет|ужин|4321|masha@|example\.com|привет/i.test(all), "в журнале нет текстов, сумм, почты", all.match(/.{0,30}(Позвонить|мам|секрет|ужин|4321|masha|привет).{0,30}/i))
check(posts.every(p => p.metrics && !p.hub && JSON.stringify(p).length < 20000), "пачки небольшие и отдельно от данных")
check(await page.evaluate(() => METRICS._q().length) === 0, "очередь на телефоне очищена после отправки")

console.log("Настройки: выключить статистику")
await page.evaluate(() => setTab("more"))
await wait(600)
const card = await page.$(".card.mtr")
check(card, "карточка «Улучшение приложения» в настройках")
if (card) { await card.scrollIntoViewIfNeeded(); await wait(300); await card.screenshot({ path: path.join(SHOTS, "mt-settings.png") }) }
await page.click('[data-mtr="off"]')
await wait(200)
const n0 = posts.length
await page.evaluate(() => { setTab("plans"); return METRICS.flush() })
check(await page.evaluate(() => D.metricsOff === true && METRICS._q().length === 0) && posts.length === n0, "выключено — ничего не копится и не уходит")
await page.evaluate(() => setTab("more")); await wait(300)
await page.click('[data-mtr="on"]')
check(await page.evaluate(() => !D.metricsOff), "включается обратно")
check(await page.evaluate(() => METRICS.recent(5).length === 5), "последние события доступны форме «Сообщить о проблеме» (METRICS.recent)")
check(!errors.filter(e => !/сломалось/.test(e)).length, "без ошибок страницы", errors)
await browser.close(); server.close()
console.log(fail ? `METRICS_FAIL (${fail})` : "METRICS_OK")
process.exit(fail ? 1 : 0)
