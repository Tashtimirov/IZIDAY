// Автообновление установленного приложения: новая версия скачивается в фоне и применяется сама —
// сразу после запуска/возврата в приложение, но не посреди ввода, окна или разговора с Изи.
// Раздел сохраняется, обновление тихое, без подсказки. Нужна сборка dist/web. Chromium.
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
import http from "http"
import fs from "fs"
import path from "path"

const ROOT = new URL("../dist/web/", import.meta.url).pathname
let ver = 1
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]).replace(/\/$/, "/index.html"))
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end() }
  let body = fs.readFileSync(p)
  // в настоящей сборке у изменённого app.js и метка содержимого (HASH) новая
  if (ver > 1 && p.endsWith("sw.js")) body = Buffer.from(String(body).replace(/const CACHE = "([^"]+)"/, `const CACHE = "$1-v${ver}"`).replace(/"app\.js": "([0-9a-f]+)"/, `"app.js": "$1v${ver}"`))
  if (p.endsWith("app.js")) body = Buffer.concat([body, Buffer.from(`\nwindow.APPVER = ${ver}\n`)])
  const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" }[path.extname(p)]
  res.writeHead(200, { "content-type": (type || "text/plain") + "; charset=utf-8", "cache-control": "no-cache" }); res.end(body)
}).listen(0)
const BASE = `http://localhost:${server.address().port}/`
let ok = true
const check = (c, msg, got) => { console.log((c ? "✓ " : "✗ ") + msg + (c ? "" : "  → " + JSON.stringify(got))); ok = ok && !!c }
const wait = ms => new Promise(r => setTimeout(r, ms))

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => { window.SW_TEST = true })
const page = await ctx.newPage()
const errs = []; page.on("pageerror", e => errs.push(String(e)))
await page.goto(BASE)
await page.evaluate(() => navigator.serviceWorker.ready)
await page.reload(); await page.waitForTimeout(600)
check(await page.evaluate(() => !!navigator.serviceWorker.controller && window.APPVER === 1), "приложение установлено, версия 1")

// возврат в приложение: новая версия сама скачалась и применилась, без закрытия и второго открытия
await page.evaluate(() => setTab("money"))
ver = 2
await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))   // «вернулись в приложение»
await page.waitForFunction(() => window.APPVER === 2, null, { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(700)
const a = await page.evaluate(() => ({ v: window.APPVER, tab, toast: $("#toast").textContent }))
check(a.v === 2, "после возврата новая версия применилась сама", a)
check(a.tab === "money", "раздел сохранился («Деньги»)", a)
check(!/обновл/i.test(a.toast), "обновление тихое: подсказки «IZIDAY обновлён» нет (так просил владелец)", a)

// посреди ввода — не перезагружаем; как только поле пустое и руки свободны — обновляемся
await page.evaluate(() => { setTab("chat"); const t = $("#chat-in"); t.focus(); t.value = "пишу сообщение" })
ver = 3
await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
await wait(6000)
const b = await page.evaluate(() => ({ v: window.APPVER, val: $("#chat-in") && $("#chat-in").value }))
check(b.v === 2 && b.val === "пишу сообщение", "пока печатаете — не перезагружается, текст на месте", b)
await page.evaluate(() => { const t = $("#chat-in"); t.value = ""; t.blur() })
await page.waitForFunction(() => window.APPVER === 3, null, { timeout: 10000 }).catch(() => {})
check(await page.evaluate(() => window.APPVER) === 3, "дописали и убрали клавиатуру — обновилось")

// открыто окно — ждём, закрыли — обновилось
await page.evaluate(() => { setTab("today"); ui.info("Окно", "текст") })
ver = 4
await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
await wait(6000)
check(await page.evaluate(() => window.APPVER) === 3, "открыто окно — не перезагружается")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
await page.waitForFunction(() => window.APPVER === 4, null, { timeout: 10000 }).catch(() => {})
check(await page.evaluate(() => window.APPVER) === 4, "окно закрыли — обновилось")

// старые кэши удалены, офлайн-оболочка одна
const keys = await page.evaluate(() => caches.keys())
check(keys.filter(k => k !== "myday-conn").length === 1, "в кэше одна версия", keys)
check(!errs.length, "без ошибок на странице", errs)
await browser.close(); server.close()
console.log(ok ? "SWAUTO_OK" : "SWAUTO_FAIL"); process.exit(ok ? 0 : 1)
