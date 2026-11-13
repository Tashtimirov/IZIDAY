// Разрешения один раз: на iPhone (приложение на экране «Домой») смена адреса (#…, replaceState, перезагрузка)
// заставляет iOS заново спрашивать микрофон, камеру и место. Нажатие на уведомление при открытом приложении
// не должно менять адрес — sw.js передаёт действие сообщением izi-open. Нужна сборка dist/web. Chromium.
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
import http from "http"
import fs from "fs"
import path from "path"

const ROOT = new URL("../dist/web/", import.meta.url).pathname
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]).replace(/\/$/, "/index.html"))
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end() }
  const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" }[path.extname(p)]
  res.writeHead(200, { "content-type": (type || "text/plain") + "; charset=utf-8", "cache-control": "no-cache" }); res.end(fs.readFileSync(p))
}).listen(0)
const BASE = `http://localhost:${server.address().port}/`
let ok = true
const check = (c, msg, got) => { console.log((c ? "✓ " : "✗ ") + msg + (c ? "" : "  → " + JSON.stringify(got))); ok = ok && !!c }

const sw = fs.readFileSync(ROOT + "sw.js", "utf8")
const click = sw.slice(sw.indexOf("notificationclick"))
check(!/\.navigate\(/.test(click) && /izi-open/.test(click), "уведомление: без navigate, действие сообщением")

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => { window.SW_TEST = true })
const page = await ctx.newPage()
const errs = []; page.on("pageerror", e => errs.push(String(e)))
await page.goto(BASE)
await page.evaluate(() => navigator.serviceWorker.ready)
await page.reload(); await page.waitForTimeout(600)
const url0 = page.url()
await page.evaluate(() => { window.LOADS = (window.LOADS || 0) + 1; window.hashes = 0; addEventListener("hashchange", () => hashes++); window.rs = 0; const o = history.replaceState.bind(history); history.replaceState = (...a) => { rs++; return o(...a) } })
const w = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker")
await w.evaluate(async () => { const l = await self.clients.matchAll({ type: "window", includeUncontrolled: true }); for (const c of l) c.postMessage({ type: "izi-open", hash: "#reply=" + encodeURIComponent("Выпили воду") }) })
await page.waitForTimeout(800)
const r = await page.evaluate(() => ({ url: location.href, tab, loads: window.LOADS, hashes, rs, last: (D.chat[D.chat.length - 1] || {}).text }))
check(r.url === url0 && r.hashes === 0 && r.rs === 0, "адрес не менялся", r)
check(r.loads === 1, "страница не перезагружалась", r)
check(r.tab === "chat" && r.last === "Выпили воду", "открылся чат с подсказкой", r)
check(!errs.length, "без ошибок на странице", errs)
await browser.close(); server.close()
console.log(ok ? "PERMONCE_OK" : "PERMONCE_FAIL")
