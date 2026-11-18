// Дорога в «Сегодня» считается от места предыдущего события дня (после школы на работу — от школы),
// а не от того места, где телефон сейчас; первое событие — от текущего места; событие-поездка само и есть дорога.
// Провал — ROUTEPREV_FAIL
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const { page, browser, server, sheet } = await boot2({ root, time: new Date("2026-11-04T22:40:00Z"),   // 05:40 Бангкок
  events: ({ bkk, iso }) => [
    { id: "trip", title: "Отвезти детей в школу", start: iso(bkk(0, 7, 32)), end: iso(bkk(0, 8, 0)), calendar: "Личное", location: "Школа" },
    { id: "work", title: "Прайм Тайм", start: iso(bkk(0, 9, 0)), end: iso(bkk(0, 9, 30)), calendar: "Личное", location: "Офис" },
    { id: "pick", title: "Забрать детей", start: iso(bkk(0, 17, 0)), end: iso(bkk(0, 17, 35)), calendar: "Личное", location: "Школа" },
    { id: "shop", title: "Купить подарок", start: iso(bkk(0, 20, 0)), end: iso(bkk(0, 20, 30)), calendar: "Личное", location: "Декатлон" }] })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
const PL = { "Школа": [7.85, 98.34], "Офис": [7.89, 98.39], "Декатлон": [7.95, 98.36] }
const ROUTES = []
await page.unroute("https://script.google.com/**")
await page.route("https://script.google.com/**", async r => {
  const b = JSON.parse(r.request().postData() || "{}"), h = b.hub || {}
  let out = sheet.post(r.request().postData())
  if (h.geo) { const c = PL[h.geo.query]; out = Object.assign({}, out, { geo: { results: c ? [{ name: h.geo.query, lat: c[0], lng: c[1] }] : [] } }) }
  if (h.route) {
    const f = h.route.from, t = h.route.to
    ROUTES.push({ from: f, to: t })
    const m = Math.round(Math.hypot(f.lat - t.lat, f.lng - t.lng) * 400)
    out = Object.assign({}, out, { route: { minutes: m, minutes_in_traffic: m, km: m / 2 } })
  }
  r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(out) })
})
await page.waitForFunction(() => !Object.keys(travBusy).length, null, { timeout: 15000 }).catch(() => {})
await page.evaluate(() => { D.conn = D.conn || "x"; D.trav = {}; GEO_C.clear(); ROUTE_C.clear(); render() })
const roads = async () => page.evaluate(() => [...document.querySelectorAll(".tl-it.road")].map(x => x.textContent.trim()))
let r = []
for (let i = 0; i < 40; i++) { await page.waitForTimeout(250); r = await roads(); if (r.length >= 3 && r.every(t => /от|выехать/.test(t))) { await page.evaluate(() => render()); r = await roads(); if (r.length >= 3) break } }
console.log("  дороги:", JSON.stringify(r))
const near = (p, c) => p && Math.abs(p.lat - c[0]) < 1e-6 && Math.abs(p.lng - c[1]) < 1e-6
ok(r.length === 3, "три полосы дороги (у поездки в школу своей полосы нет — она сама дорога)")
ok(/от Школа/.test(r[0] || "") && /дорога 26 мин/.test(r[0] || ""), "на работу — от школы: " + r[0])
ok(/от Офис/.test(r[1] || "") && /дорога 26 мин/.test(r[1] || ""), "за детьми — от офиса: " + r[1])
ok(/от Школа/.test(r[2] || ""), "в магазин — от школы: " + r[2])
ok(ROUTES.some(x => near(x.from, PL["Школа"]) && near(x.to, PL["Офис"])) && ROUTES.some(x => near(x.from, PL["Офис"]) && near(x.to, PL["Школа"])), "запросы маршрута — от места предыдущего события")
// Предыдущее событие уже прошло — считаем от текущего места
const cur = await page.evaluate(() => { const e = iphone().events.find(x => x.id === "work"); return travFrom(e, parseIso(e.start) - 60e3) })
ok(cur === "", "когда предыдущее событие прошло — от текущего места")
await browser.close(); server && server.close && server.close()
if (fails) { console.log("ROUTEPREV_FAIL", fails); process.exit(1) }
console.log("ROUTEPREV_OK")
