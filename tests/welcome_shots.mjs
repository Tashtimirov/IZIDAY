// Обучение новичков (onb.js): карточки знакомства с выбором «Взрослый / Ребёнок», «Первые шаги», подсказки разделов,
// старым пользователям знакомство само не показывается. Снимки — build/web-shots/o-*
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
import http from "http"
import fs from "fs"
import path from "path"
import { sheetScript } from "./fake_sheet.mjs"

const ROOT = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = process.env.SHOTS || new URL("../build/web-shots/", import.meta.url).pathname
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


await page.goto(BASE + "#setup=" + encodeURIComponent(setup))
await page.waitForTimeout(2200)
const nx = async (w = 900) => { await page.click('[data-ob="next"]'); await page.waitForTimeout(w) }
await shot("w01-hello")
await nx(); await shot("w02-quiz-start")
await nx(); await page.waitForTimeout(300); await page.click('[data-v="biz"]'); await page.waitForTimeout(400); await shot("w03-q1-occ"); await nx()
await page.click('[data-q="wake"][data-v="7"]'); await page.click('[data-q="sleep"][data-v="23"]'); await page.waitForTimeout(500); await shot("w04-q2-rhythm")
await nx(); await page.click('[data-v="money"]'); await page.click('[data-v="sleep"]'); await page.click('[data-v="sport"]'); await page.waitForTimeout(500); await shot("w05-q3-focus")
await nx(); await page.click('[data-v="water"]'); await page.click('[data-v="read"]'); await page.waitForTimeout(500); await shot("w06-q4-habits")
await nx(); await shot("w07-q5-goal")
await page.click('[data-v="save"]'); await nx()
await page.click('[data-q="mode"][data-v="friend"]'); await page.waitForTimeout(500); await shot("w08-q6-izi")
await nx(); await shot("w09-voice")
await nx(); await shot("w10-sections")
await nx(); await shot("w11-final")
console.log("prof", JSON.stringify(await page.evaluate(() => [D.prof, D.izi, live(D.habits).map(h => h.title)])))
console.log("style", await page.evaluate(() => iziStyle().split("\n").pop()))
await nx(1200)
await page.evaluate(() => $("#ob-steps").scrollIntoView({block:"center"})); await page.waitForTimeout(400); await shot("w12-today"); console.log("steps", await page.evaluate(() => [!!$("#ob-steps"), JSON.stringify(D.onb)]))
await page.evaluate(() => setTab("chat")); await page.waitForTimeout(1500); await shot("w13-chat")
await page.evaluate(() => { D.who = "kid"; ONB.intro() }); await page.waitForTimeout(1500); await shot("k01-hello")
await nx(); await nx(); await page.click('[data-v="draw"]'); await page.click('[data-v="games"]'); await page.waitForTimeout(500); await shot("k02-likes")
console.log("errors", errors)
await browser.close(); server.close()
