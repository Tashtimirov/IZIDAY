// Изи выполняет задание быстрее: фоновый обмен с таблицей ждёт конца ответа (таблица обслуживает запросы по одному),
// несколько запросов на чтение — параллельно, дорога и поиск места — из памяти на 5 и 30 минут. Провал — TOOLSPEED_FAIL
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const { page, browser, server, sheet } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z") })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
const HUB = []
await page.unroute("https://script.google.com/**")
await page.route("https://script.google.com/**", async r => {
  const b = JSON.parse(r.request().postData() || "{}"), h = b.hub || {}, t0 = Date.now()
  const kind = h.lists ? "sync" : h.route ? "route" : h.geo ? "geo" : h.mail ? "mail" : h.cal ? "cal" : "other"
  HUB.push({ kind, t0 })
  await new Promise(x => setTimeout(x, 400))
  let out = sheet.post(r.request().postData())
  if (h.route) out = Object.assign({}, out, { route: { minutes: 25, km: 12 } })
  if (h.geo) out = Object.assign({}, out, { geo: { results: [{ name: "Decathlon", lat: 7.85, lng: 98.34 }] } })
  if (h.mail) out = Object.assign({}, out, { mail: { items: [{ id: "1", subject: "x" }] } })
  HUB[HUB.length - 1].t1 = Date.now()
  r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(out) })
})
// Claude: сценарий ответов по очереди
await page.evaluate(() => {
  window.SCN = []; window.REQ = []
  const of = window.fetch
  window.fetch = async (url, o) => {
    if (!/api\.anthropic\.com/.test(url)) return of(url, o)
    REQ.push(JSON.parse(o.body))
    const m = SCN.shift() || { content: [{ type: "text", text: "Готово." }], stop_reason: "end_turn" }
    return new Response(JSON.stringify(m), { headers: { "content-type": "application/json" } })
  }
})
await page.evaluate(() => { window.TU = (id, name, input) => ({ type: "tool_use", id, name, input }) })
// 1. фоновый обмен ждёт конца ответа: запрос почты не стоит в очереди за обменом
HUB.length = 0
await page.evaluate(() => {
  SCN.push({ content: [TU("a1", "add_money", { type: "expense", amount: 100, category: "Другое", comment: "кофе" })], stop_reason: "tool_use" })
  SCN.push({ content: [TU("m1", "mail_search", { query: "счёт" })], stop_reason: "tool_use" })
  SCN.push({ content: [{ type: "text", text: "Записал и нашёл письмо." }], stop_reason: "end_turn" })
  return chatSend("запиши кофе 100 и найди счёт")
})
const doneAt = Date.now()
await page.waitForTimeout(1500)
const during = HUB.filter(x => x.t0 < doneAt - 50)
ok(during.some(x => x.kind === "mail") && !during.some(x => x.kind === "sync"), "во время ответа — только запрос почты, обмена нет: " + during.map(x => x.kind).join(","))
ok(HUB.some(x => x.kind === "sync" && x.t0 >= doneAt - 50), "после ответа обмен прошёл (запись кофе ушла в таблицу)")
// 2. два запроса на чтение — параллельно
HUB.length = 0
const t2 = await page.evaluate(async () => {
  SCN.push({ content: [TU("m2", "mail_search", { query: "банк" }), TU("m3", "mail_search", { query: "такси" })], stop_reason: "tool_use" })
  SCN.push({ content: [{ type: "text", text: "Нашёл оба." }], stop_reason: "end_turn" })
  const t = performance.now(); await chatSend("найди письма банка и такси"); return performance.now() - t
})
const mails = HUB.filter(x => x.kind === "mail")
ok(mails.length === 2 && Math.abs(mails[0].t0 - mails[1].t0) < 200, "два поиска почты ушли одновременно (разница " + (mails.length === 2 ? Math.abs(mails[0].t0 - mails[1].t0) : "?") + " мс), ответ за " + Math.round(t2) + " мс")
const tr = await page.evaluate(() => REQ[REQ.length - 1].messages.slice(-1)[0].content)
ok(tr.length === 2 && tr[0].tool_use_id === "m2" && tr[1].tool_use_id === "m3", "результаты обоих — в одном сообщении, по порядку")
// 3. дорога дважды подряд — один запрос места и один маршрута
HUB.length = 0
await page.evaluate(async () => {
  SCN.push({ content: [TU("r1", "route_to", { to: "Decathlon" })], stop_reason: "tool_use" })
  SCN.push({ content: [TU("r2", "route_to", { to: "Decathlon" })], stop_reason: "tool_use" })
  SCN.push({ content: [{ type: "text", text: "25 минут." }], stop_reason: "end_turn" })
  await chatSend("сколько ехать до Decathlon")
})
ok(HUB.filter(x => x.kind === "geo").length === 1 && HUB.filter(x => x.kind === "route").length === 1, "место и маршрут спрошены по разу: " + HUB.map(x => x.kind).join(","))
const rr = await page.evaluate(() => JSON.parse(REQ[REQ.length - 1].messages.slice(-1)[0].content[0].content))
ok(rr.minutes === 25 && rr.place === "Decathlon", "второй ответ из памяти тот же: " + JSON.stringify(rr))
await browser.close(); server && server.close && server.close()
console.log(fails ? "TOOLSPEED_FAIL " + fails : "TOOLSPEED_OK"); process.exit(fails ? 1 : 0)
