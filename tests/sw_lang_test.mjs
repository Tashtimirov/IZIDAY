// Английский словарь (i18n-en.js, ~320 КБ) в кэше только у тех, кто им пользуется: русскому — не скачивается при обновлениях,
// английскому — кладётся в кэш при первом запросе, работает без сети и переживает обновление.
// Нужна сборка dist/web. Chromium.
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
import http from "http"; import fs from "fs"; import path from "path"
const ROOT = new URL("../dist/web/", import.meta.url).pathname
let offline = false, ver = 1, got = []
const server = http.createServer((req, res) => {
  if (offline) { req.socket.destroy(); return }
  got.push(req.url.split(/[?#]/)[0])
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]).replace(/\/$/, "/index.html"))
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end() }
  let body = fs.readFileSync(p)
  if (ver > 1 && p.endsWith("sw.js")) body = Buffer.from(String(body).replace(/const CACHE = "([^"]+)"/, `const CACHE = "$1-v${ver}"`).replace(/"app\.js": "([0-9a-f]+)"/, `"app.js": "$1v${ver}"`))
  if (p.endsWith("app.js")) body = Buffer.concat([body, Buffer.from(`\nwindow.APPVER = ${ver}\n`)])
  const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" }[path.extname(p)]
  res.writeHead(200, { "content-type": (type || "text/plain") + "; charset=utf-8", "cache-control": "no-cache" }); res.end(body)
}).listen(0)
const BASE = `http://localhost:${server.address().port}/`
let ok = true
const check = (c, msg, v) => { console.log((c ? "✓ " : "✗ ") + msg + (c ? "" : "  → " + JSON.stringify(v))); ok = ok && !!c }
const browser = await chromium.launch()
const cachedFiles = page => page.evaluate(async () => (await (await caches.open((await caches.keys()).find(k => k !== "myday-conn"))).keys()).map(r => new URL(r.url).pathname))
const update = async (page, v) => { ver = v; got = []; await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update())); await page.waitForTimeout(1500); await page.reload(); await page.waitForTimeout(900) }

for (const lang of ["ru", "en"]) {
  ver = 1; offline = false
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: lang === "en" ? "en-US" : "ru-RU" })
  await ctx.addInitScript(l => { try { localStorage.setItem("izi-lang", l) } catch (e) {} }, lang)
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(String(e)))
  await page.goto(BASE)
  await page.evaluate(() => navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })); await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload(); await page.waitForTimeout(800)
  const isEn = await page.evaluate(() => !!(window.L && L.en))
  check(isEn === (lang === "en"), `${lang}: язык ${lang}`, isEn)
  const c1 = await cachedFiles(page)
  if (lang === "ru") {
    check(!c1.includes("/i18n-en.js"), "ru: словарь не в кэше", c1)
    await update(page, 2)
    check(!got.includes("/i18n-en.js") && got.includes("/app.js"), "ru: при обновлении словарь не скачивается", got)
  } else {
    check(c1.includes("/i18n-en.js"), "en: словарь в кэше после первого запуска", c1)
    offline = true; await page.reload(); await page.waitForTimeout(900)
    check(await page.evaluate(() => !!window.EN_DICT && /Today|Plans/.test(document.querySelector("#tabs").innerText)), "en: без сети — по-английски", await page.evaluate(() => document.querySelector("#tabs").innerText))
    offline = false
    await update(page, 2)
    const c2 = await cachedFiles(page)
    check(await page.evaluate(() => window.APPVER) === 2 && c2.includes("/i18n-en.js") && !got.includes("/i18n-en.js"), "en: после обновления словарь в кэше, не скачивался заново", { got, c2 })
    offline = true; await page.reload(); await page.waitForTimeout(900)
    check(await page.evaluate(() => !!window.EN_DICT && window.APPVER === 2), "en: новая версия без сети — по-английски")
    offline = false
  }
  check(!errs.length, `${lang}: без ошибок на странице`, errs)
  await ctx.close()
}
await browser.close(); server.close()
console.log(ok ? "SWLANG_OK" : "SWLANG_FAIL"); process.exit(ok ? 0 : 1)
