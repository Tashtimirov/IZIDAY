// Кэш оболочки (sw.js): запуск без сети; новая версия приходит целиком, без смеси файлов двух версий.
// Нужна готовая сборка dist/web (python3 build_web.py). Chromium.
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
import http from "http"
import fs from "fs"
import path from "path"

const ROOT = new URL("../dist/web/", import.meta.url).pathname
let offline = false, ver = 1, hits = 0
const server = http.createServer((req, res) => {
  if (offline) { req.socket.destroy(); return }
  hits++
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]).replace(/\/$/, "/index.html"))
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end() }
  let body = fs.readFileSync(p)
  const ext = path.extname(p)
  // «новая версия» на сервере: другая версия кэша в sw.js и метка в app.js
  if (ver > 1 && p.endsWith("sw.js")) body = Buffer.from(String(body).replace(/const CACHE = "([^"]+)"/, `const CACHE = "$1-v${ver}"`))
  if (p.endsWith("app.js")) body = Buffer.concat([body, Buffer.from(`\nwindow.APPVER = ${ver}\n`)])
  if (p.endsWith("gami.js")) body = Buffer.concat([body, Buffer.from(`\nwindow.GAMIVER = ${ver}\n`)])
  const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" }[ext]
  res.writeHead(200, { "content-type": (type || "text/plain") + "; charset=utf-8", "cache-control": "no-cache" }); res.end(body)
}).listen(0)
const BASE = `http://localhost:${server.address().port}/`
let ok = true
const check = (c, msg, got) => { console.log((c ? "✓ " : "✗ ") + msg + (c ? "" : "  → " + JSON.stringify(got))); ok = ok && !!c }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const errs = []; page.on("pageerror", e => errs.push(String(e)))
await page.goto(BASE)
// на http://localhost app.js сам sw не ставит (только https) — ставим так же, как он
await page.evaluate(() => navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }))
await page.evaluate(() => navigator.serviceWorker.ready)
await page.reload(); await page.waitForTimeout(500)
check(await page.evaluate(() => !!navigator.serviceWorker.controller), "sw управляет страницей")
const cached = await page.evaluate(async () => (await (await caches.open((await caches.keys()).find(k => k !== "myday-conn"))).keys()).map(r => new URL(r.url).pathname))
check(["/", "/index.html", "/app.js", "/core.js", "/bug.js", "/style.css", "/icon-180.png"].every(f => cached.includes(f)), "в кэше вся оболочка", cached)

// повторный запуск: оболочка из кэша, в сеть идёт только проверка sw.js
hits = 0
await page.reload(); await page.waitForTimeout(800)
check(hits <= 2, `повторный запуск почти без сети (запросов: ${hits})`, hits)
check(await page.evaluate(() => !!document.querySelector("#tabs") && typeof render === "function" && window.APPVER === 1), "приложение работает из кэша")

// без сети
offline = true
await page.reload(); await page.waitForTimeout(800)
check(await page.evaluate(() => !!$("#view").innerHTML && window.APPVER === 1), "открывается без сети")
await page.goto(BASE + "?from=icon"); await page.waitForTimeout(500)
check(await page.evaluate(() => !!$("#view").innerHTML), "без сети и с ?… в адресе (запуск со значка)")
offline = false

// новая версия: пока не установилась целиком — старая; после — новая, и app.js и gami.js из одной версии
ver = 2
await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()))
await page.waitForTimeout(1500)
await page.reload(); await page.waitForTimeout(800)
const v = await page.evaluate(() => [window.APPVER, window.GAMIVER])
check(v[0] === 2 && v[1] === 2, "новая версия пришла целиком (app.js и gami.js — обе новые)", v)
const keys = await page.evaluate(() => caches.keys())
check(keys.filter(k => k !== "myday-conn").length === 1, "старый кэш удалён", keys)
check(!errs.length, "без ошибок на странице", errs)

// ошибка в разделе — карточка с выходом, а не пустой экран; ошибка в журнале недочётов
const rf = await page.evaluate(() => { const t0 = renderToday; renderToday = () => { throw new Error("сломанная запись") }; setTab("today")
  const card = /Не получилось показать/.test($("#view").textContent), log = JSON.parse(localStorage.getItem("izi.errlog") || "[]").some(x => /сломанная запись/.test(x.m))
  renderToday = t0; setTab("money"); const back = !!$("#view").innerHTML && !/Не получилось/.test($("#view").textContent); return { card, log, back } })
check(rf.card && rf.log && rf.back, "сбой раздела: карточка «Не получилось показать», запись в журнале, другие вкладки работают", rf)

await browser.close(); server.close()
console.log(ok ? "SWCACHE_OK" : "SWCACHE_FAIL"); process.exit(ok ? 0 : 1)
