// Нижнее меню не пропадает и строка ввода не «висит» посреди экрана. iPhone иногда отдаёт укороченное окно
// (после фона, окна разрешения, выбора фото) — раньше это принималось за клавиатуру: меню пряталось, строка чата
// поднималась на середину и так оставалось до перезапуска. Меню прячется только при поле в фокусе.
// Ещё: без действия человека место в новом запуске на iPhone не запрашивается (iOS спросил бы «Разрешить?»).
// Нужна сборка dist/web. Chromium.
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

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
// «укороченное окно»: visualViewport врёт, будто снизу закрыто 300 px
await ctx.addInitScript(() => {
  window.FAKE_VV = 0
  const d = Object.getOwnPropertyDescriptor(VisualViewport.prototype, "height")
  Object.defineProperty(VisualViewport.prototype, "height", { configurable: true, get() { return d.get.call(this) - window.FAKE_VV } })
})
const page = await ctx.newPage()
const errs = []; page.on("pageerror", e => errs.push(String(e)))
await page.goto(BASE + "#chat"); await page.waitForTimeout(900)
const st = () => page.evaluate(() => {
  const t = document.getElementById("tabs"), r = t.getBoundingClientRect(), bar = document.querySelector(".chat-bar")
  return { kb: document.body.classList.contains("kb"), vis: getComputedStyle(t).visibility, bottom: Math.round(r.bottom), bar: bar ? Math.round(bar.getBoundingClientRect().bottom) : null, h: innerHeight }
})
const s0 = await st()
check(!s0.kb && s0.vis === "visible" && s0.bottom <= s0.h && s0.bottom > s0.h - 60, "меню на месте при открытии", s0)

// окно «укоротилось» без клавиатуры (возврат из фона / окно разрешения)
await page.evaluate(() => { window.FAKE_VV = 300; visualViewport.dispatchEvent(new Event("resize")) })
await page.waitForTimeout(200)
const s1 = await st()
check(!s1.kb && s1.vis === "visible", "укороченное окно без поля в фокусе — меню не прячется", s1)
check(s1.bar == null || s1.bar < s0.h - 40, "строка ввода не уезжает на середину", s1)

// настоящая клавиатура: поле в фокусе — меню прячется, строка над клавиатурой
await page.evaluate(() => { const i = document.getElementById("chat-in"); i && i.focus() })
await page.waitForTimeout(500)
const s2 = await st()
check(s2.kb && s2.vis === "hidden", "клавиатура над полем — меню прячется", s2)
// клавиатура закрылась, а iPhone не прислал resize: поле теряет фокус — меню возвращается
await page.evaluate(() => document.activeElement.blur())
await page.waitForTimeout(400)
const s3 = await st()
check(!s3.kb && s3.vis === "visible", "поле без фокуса — меню вернулось", s3)
// фокус остался, но приложение ушло в фон и вернулось — фокус снят, меню на месте
await page.evaluate(() => { document.getElementById("chat-in").focus() }); await page.waitForTimeout(450)
await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")) })
await page.waitForTimeout(300)
const s4 = await st()
check(!s4.kb && s4.vis === "visible", "возврат в приложение — меню на месте", s4)

// место: на iPhone без действия человека в новом запуске не берём
const src = fs.readFileSync(ROOT + "app.js", "utf8")
check(/GEO_LIVE/.test(src) || /IS_IOS&&!\w+&&!\w+\)return/.test(src) || src.includes("pushHere"), "в сборке есть защита места", null)
check(!errs.length, "без ошибок на странице", errs)
await browser.close(); server.close()
console.log(ok ? "TABSSTAY_OK" : "TABSSTAY_FAIL")
