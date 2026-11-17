// Изи считает маршрут через несколько точек (A→B→C) с любой стартовой точки: один вызов route_to с from/via/to,
// участки и итог. Старый вызов (только to, от текущего места) не меняется. Провал — ROUTEMULTI_FAIL
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const { page, browser, server, sheet } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z"),
  events: ({ bkk, iso }) => [{ id: "pick", title: "Забрать детей из школы и домой", start: iso(bkk(0, 15, 40)), end: iso(bkk(0, 16, 15)), calendar: "Личное" }] })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
const PL = { "Отель": [7.80, 98.30], "Школа": [7.85, 98.34], "Офис": [7.89, 98.39], "Декатлон": [7.95, 98.36] }
const HUB = []
await page.unroute("https://script.google.com/**")
await page.route("https://script.google.com/**", async r => {
  const b = JSON.parse(r.request().postData() || "{}"), h = b.hub || {}
  let out = sheet.post(r.request().postData())
  if (h.geo) { HUB.push({ geo: h.geo.query }); const c = PL[h.geo.query]; out = Object.assign({}, out, { geo: { results: c ? [{ name: h.geo.query, lat: c[0], lng: c[1] }] : [] } }) }
  if (h.route) {
    HUB.push({ route: h.route })
    const f = h.route.from, t = h.route.to
    const r2 = typeof t === "string" || typeof f === "string" ? (t === "Нигде" ? { error: "маршрут не найден (NOT_FOUND)" } : { minutes: 5, km: 2 })
      : { minutes: Math.round(Math.hypot(f.lat - t.lat, f.lng - t.lng) * 300), minutes_in_traffic: Math.round(Math.hypot(f.lat - t.lat, f.lng - t.lng) * 400), km: Math.round(Math.hypot(f.lat - t.lat, f.lng - t.lng) * 1100) / 10 }
    out = Object.assign({}, out, { route: r2 })
  }
  r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(out) })
})
await page.evaluate(() => {
  window.SCN = []; window.REQ = []
  const of = window.fetch
  window.fetch = async (url, o) => {
    if (!/api\.anthropic\.com/.test(url)) return of(url, o)
    REQ.push(JSON.parse(o.body))
    const m = SCN.shift() || { content: [{ type: "text", text: "Готово." }], stop_reason: "end_turn" }
    return new Response(JSON.stringify(m), { headers: { "content-type": "application/json" } })
  }
  window.TU = (id, name, input) => ({ type: "tool_use", id, name, input })
})
const lastTool = () => page.evaluate(() => JSON.parse(REQ[REQ.length - 1].messages.slice(-1)[0].content[0].content))
// 0. Изи знает про несколько точек: в описании инструмента и в правилах
const sys = await page.evaluate(async () => { SCN.push({ content: [{ type: "text", text: "Да." }], stop_reason: "end_turn" }); await chatSend("привет"); const q = REQ[REQ.length - 1]; return { tool: JSON.stringify(q.tools.find(t => t.name === "route_to")), sys: JSON.stringify(q.system) } })
ok(/via/.test(sys.tool) && /from/.test(sys.tool), "у route_to есть from и via")
ok(/Маршрут через несколько мест/.test(sys.sys), "в правилах Изи — маршрут через несколько мест одним вызовом")
ok(/не пересекаются/.test(sys.sys) && /и домой/.test(sys.sys), "в правилах: события маршрута встык, без наложений, старую остановку поправить")
// 1. Не от текущего места: Отель → Школа → Офис → Декатлон
HUB.length = 0
await page.evaluate(async () => {
  SCN.push({ content: [TU("m1", "route_to", { from: "Отель", via: ["Школа", "Офис"], to: "Декатлон" })], stop_reason: "tool_use" })
  SCN.push({ content: [{ type: "text", text: "Весь путь — около часа." }], stop_reason: "end_turn" })
  await chatSend("сколько ехать от отеля в школу, потом в офис и в Декатлон")
})
let r = await lastTool()
const names = r => (r.stops || []).map(x => x.place || x)
ok(names(r).join(">") === "Отель>Школа>Офис>Декатлон", "точки по порядку: " + names(r).join(" → "))
ok(r.legs && r.legs.length === 3 && r.legs[0].from === "Отель" && r.legs[2].to === "Декатлон", "три участка: " + (r.legs || []).map(l => l.from + "→" + l.to + " " + l.minutes + " мин").join("; "))
const sum = (r.legs || []).reduce((a, l) => a + l.minutes, 0), sumT = (r.legs || []).reduce((a, l) => a + l.minutes_in_traffic, 0)
ok(r.drive_minutes === sumT && r.total_km > 0, `дорога = сумма участков с пробками: ${r.drive_minutes} мин, ${r.total_km} км`)
ok(r.stops[1].stay_min === 10 && /примерно/.test(r.stops[1].stay_note || "") && r.stops[2].stay_min === 45 && r.total_minutes === sumT + 55, `стоянки без слов пользователя прикинуты сами: школа ${r.stops[1].stay_min}, офис ${r.stops[2].stay_min}, всего ${r.total_minutes} мин`)
const routes = HUB.filter(x => x.route)
ok(routes.length === 3 && routes[0].route.from.lat === 7.80 && routes[2].route.to.lat === 7.95, "три запроса маршрута, первый — от отеля, не от текущего места")
ok(!("from_location" in r), "текущая геопозиция в маршруте не участвует")
// 2. От текущего места через точку
HUB.length = 0
await page.evaluate(async () => {
  SCN.push({ content: [TU("m2", "route_to", { via: ["Школа"], to: "Офис" })], stop_reason: "tool_use" })
  SCN.push({ content: [{ type: "text", text: "Ок." }], stop_reason: "end_turn" })
  await chatSend("через школу в офис")
})
r = await lastTool()
ok(r.legs && r.legs.length === 2 && names(r)[0] === "текущее место" && r.from_location, "от текущего места: " + names(r).join(" → ") + (r.error ? " / " + r.error : ""))
// 3. Один участок не нашёлся — остальные посчитаны, есть пояснение
await page.evaluate(async () => {
  SCN.push({ content: [TU("m3", "route_to", { from: "Отель", via: ["Нигде"], to: "Офис" })], stop_reason: "tool_use" })
  SCN.push({ content: [{ type: "text", text: "Ок." }], stop_reason: "end_turn" })
  await chatSend("от отеля через нигде в офис")
})
r = await lastTool()
ok(r.legs && r.legs.length === 2 && r.legs[0].error && !r.error && /не посчитаны/.test(r.note || ""), "участок с ошибкой отмечен, итог по остальным: " + (r.note || r.error))
// 4. Непрерывно со стоянками: забрать детей 10 мин, покупки по списку, выезд 15:30
await page.evaluate(() => { for (const t of ["Молоко", "Хлеб", "Яйца", "Сыр", "Рис"]) upsert("shop", { id: uid("b"), date: Date.now(), title: t, done: false }) })
await page.evaluate(async () => {
  SCN.push({ content: [TU("m5", "route_to", { from: "Отель", via: [{ place: "Школа", stay_min: 10 }, { place: "Офис", shop: true }], to: "Декатлон", depart: "15:30" })], stop_reason: "tool_use" })
  SCN.push({ content: [{ type: "text", text: "Ок." }], stop_reason: "end_turn" })
  await chatSend("в 15:30 от отеля: забрать детей 10 минут, потом покупки, потом Декатлон")
})
r = await lastTool()
const shopN = await page.evaluate(() => shopOpen().length)
const est = Math.min(60, Math.max(15, 10 + 2 * shopN))
ok(r.stay_minutes === 10 + est && r.total_minutes === r.drive_minutes + r.stay_minutes, `стоянки прибавлены: дорога ${r.drive_minutes} + стоянки ${r.stay_minutes} = ${r.total_minutes} (покупок в списке ${shopN})`)
ok(r.depart === "15:30" && r.stops[1].arrive && r.stops[1].leave && r.stops[1].stay_min === 10 && /списку/.test(r.stops[2].stay_note || ""), "расписание: " + r.stops.map(x => `${x.place} ${x.arrive || ""}–${x.leave || ""}`).join(", ") + " → конец " + r.finish)
ok((r.busy || []).some(e => e.id === "pick") && /не создавай второе/.test(r.busy_note || ""), "уже стоящее «Забрать детей… и домой» показано Изи как занятое: " + (r.busy || []).map(e => e.title + " " + e.time).join(", "))
const mins = h => +h.slice(0, 2) * 60 + +h.slice(3)
ok(mins(r.finish) - mins(r.depart) === r.total_minutes, "выезд + всё время = окончание")
// 5. «быть к 18:00» — выезд считается назад
await page.evaluate(async () => {
  SCN.push({ content: [TU("m6", "route_to", { from: "Отель", via: [{ place: "Школа", stay_min: 10 }], to: "Офис", arrive_by: "18:00" })], stop_reason: "tool_use" })
  SCN.push({ content: [{ type: "text", text: "Ок." }], stop_reason: "end_turn" })
  await chatSend("во сколько выехать, чтобы к 18 быть в офисе через школу")
})
r = await lastTool()
ok(r.finish === "18:00" && mins(r.finish) - mins(r.depart) === r.total_minutes, `arrive_by: выезд ${r.depart}, в офисе ${r.finish}`)
// 6. Старый вызов: только to — как раньше
HUB.length = 0
await page.evaluate(async () => {
  SCN.push({ content: [TU("m4", "route_to", { to: "Школа" })], stop_reason: "tool_use" })
  SCN.push({ content: [{ type: "text", text: "Ок." }], stop_reason: "end_turn" })
  await chatSend("сколько до школы")
})
r = await lastTool()
ok(r.minutes > 0 && r.place === "Школа" && !r.legs, "одна точка — прежний ответ: " + JSON.stringify(r))
await browser.close(); server && server.close && server.close()
console.log(fails ? "ROUTEMULTI_FAIL " + fails : "ROUTEMULTI_OK"); process.exit(fails ? 1 : 0)
