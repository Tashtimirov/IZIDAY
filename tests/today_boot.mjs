import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
import http from "http"; import fs from "fs"; import path from "path"
import { sheetScript } from "./fake_sheet.mjs"
// opts: root, time (Date), lists(fn(t,day)) → extra hub lists, events(fn) → snap events
export async function boot2({ root, time, lists = () => ({}), events = () => [], dark = false, h = 844, ctxOpts = {}, init = null }) {
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split(/[?#]/)[0]).replace(/\/$/, "/index.html"))
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end() }
    const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" }[path.extname(p)]
    res.writeHead(200, { "content-type": (type || "text/plain") + "; charset=utf-8" }); fs.createReadStream(p).pipe(res)
  }).listen(0)
  const BASE = `http://localhost:${server.address().port}/`
  const sheet = sheetScript(), SECRET = "s".repeat(32)
  const z = n => String(n).padStart(2, "0")
  // время в Бангкоке: строим даты как локальные для Asia/Bangkok
  const tzOff = 7 * 3600e3
  const bkk = (dd, hh, mm = 0) => { const d = new Date(+time + tzOff); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + dd, hh, mm) - tzOff) }
  const iso = d => { const x = new Date(+d + tzOff); return `${x.getUTCFullYear()}-${z(x.getUTCMonth() + 1)}-${z(x.getUTCDate())}T${z(x.getUTCHours())}:${z(x.getUTCMinutes())}` }
  const dk = d => iso(d).slice(0, 10)
  const L = lists({ bkk, iso, dk })
  sheet.post({ secret: SECRET, hub: { from: "widget", since: 0, lists: L,
    snap: { events: events({ bkk, iso }), reminders: [], calendars: ["Личное", "Работа"], lists: [],
      watch: { day: dk(time), steps: 8421, active: 380, exercise: 24, updated: +time - 600e3 } } } })
  const setup = Buffer.from(JSON.stringify({ v: 1, hook: "https://script.google.com/macros/s/TEST/exec", secret: SECRET, key: "sk-test", routes: [],
    sheetUrl: "https://docs.google.com/spreadsheets/d/T/edit", run: "scriptable:///run/MyDay",
    cfg: { currency: "฿", currencyIn: "в батах", agentModel: "claude-sonnet-5-5", health: { waterGoal: 2500, glass: 250, moveGoal: 500, exerciseGoal: 30, weight: 92 },
      categories: { expense: [["Транспорт", ["такси"]], ["Кафе и рестораны", ["кафе"]], ["Продукты", []], ["Другое", []]], income: [["Зарплата", ["зарплат"]], ["Другое", []]] }, calendars: [] } }), "utf8").toString("base64")
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", timezoneId: "Asia/Bangkok",
    colorScheme: dark ? "dark" : "light", geolocation: { latitude: 7.84, longitude: 98.33 }, permissions: ["geolocation"], ...ctxOpts })
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  const errors = []
  page.on("pageerror", e => errors.push(String(e)))
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()) })
  await page.clock.setFixedTime(time)
  await page.route("https://script.google.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(sheet.post(r.request().postData())) }))
  await page.route("https://open.er-api.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ rates: { THB: 1, USD: 0.0283, RUB: 2.33 } }) }))   // курс валют
  await page.route("https://api.open-meteo.com/**", r => {
    const t0 = bkk(0, 0), time = [], temp = [], pp = [], pr = []
    for (let i = 0; i < 72; i++) { const d = new Date(+t0 + i * 3600e3); time.push(iso(d)); const hh = i % 24; temp.push(hh < 6 ? 26 : hh < 15 ? 31 : 28); pp.push(hh >= 16 && hh <= 18 ? 85 : 10); pr.push(hh >= 16 && hh <= 18 ? 6 : 0) }
    r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ hourly: { time, temperature_2m: temp, precipitation_probability: pp, precipitation: pr } }) })
  })
  await page.route("https://api.anthropic.com/**", r => r.request().method() === "OPTIONS" ? r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } }) : r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ content: [{ type: "text", text: "ок" }], stop_reason: "end_turn" }) }))
  await page.goto(BASE + "#setup=" + encodeURIComponent(setup))
  await page.waitForTimeout(1500); await page.evaluate(() => sync()); await page.waitForTimeout(1500)
  await page.evaluate(ev => { D.gcal = Object.assign(D.gcal || {}, { ok: true, at: Date.now(), events: ev }); save(false); render() }, events({ bkk, iso }))
  return { page, browser, server, errors, bkk, iso, dk, sheet }
}
export async function shot(page, file, sel = "#view") {
  const hh = await page.evaluate(() => { window.scrollTo(0, 0); const v = document.querySelector("#view"); return Math.max(844, document.querySelector("#top").offsetHeight + v.scrollHeight + 140) })
  await page.setViewportSize({ width: 390, height: Math.ceil(hh) }); await page.waitForTimeout(400)
  await page.screenshot({ path: file })
  await page.setViewportSize({ width: 390, height: 844 })
}
