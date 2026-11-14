// Дубли событий от Изи (журналы друзей 13.11): ход обрывался после записи в календарь — перебили голосом, свернули
// приложение, пропала связь, — и на повторную просьбу Изи ставил второе событие, часто с другим названием.
// Проверяем: похожее событие на это время не создаётся; тот же день в другое время — предупреждение (update_event);
// два одновременных вызова — одно событие; календарь «не ответил», но создал — второго нет; оборванный ход помнит,
// что уже сделано, и человек это видит. Запуск: python3 build_web.py && node tests/event_dedup_test.mjs
import { boot2 } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }

const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-13T03:30:00Z"),   // пт 10:30 по Бангкоку
  events: ({ bkk, iso }) => [{ id: "G1", title: "Читка «Дождь»", start: "2026-11-17T11:00", end: "2026-11-17T12:00", calendar: "Личное", all_day: false },
    { id: "G2", title: "Ужин", start: "2026-11-13T19:00", end: "2026-11-13T20:00", calendar: "Личное", all_day: false },
    { id: "G3", title: "Звонок маме", start: "2026-11-14T10:00", end: "2026-11-14T10:30", calendar: "Личное", all_day: false }] })
await page.evaluate(() => { window.__created = []; window.__slow = 0
  window.calDo = async (a, x) => {
    if (a !== "create") return { ok: true }
    if (__slow) await new Promise(r => setTimeout(r, __slow))
    const e = Object.assign({ id: "N" + __created.length }, x); __created.push(e); D.gcal.events.push(e); return { ok: true, event: e } } })
const rt = (n, x) => page.evaluate(([n, x]) => runTool(n, x), [n, x])
const made = () => page.evaluate(() => __created.length)

console.log("— похожее событие на это время")
let r = await rt("create_event", { title: "Совещание по Ферина с партнёрами и управляющей компанией", start: "2026-11-13T15:00", end: "2026-11-13T16:00" })
check(r.ok && !r.duplicate && await made() === 1, "первое совещание создано", r)
r = await rt("create_event", { title: "Совещание по Ферина: партнёры и управляющая компания", start: "2026-11-13T15:00", end: "2026-11-13T16:00" })
check(r.ok && r.duplicate && r.id === "N0" && await made() === 1, "то же совещание другими словами — второе не создано (случай Кирилла)", r)
r = await rt("create_event", { title: "Встреча: читка дождь", start: "2026-11-17T11:00", end: "2026-11-17T12:00" })
check(r.ok && r.duplicate && r.id === "G1" && await made() === 1, "«Встреча: читка дождь» при «Читка «Дождь»» — второе не создано (случай Лили)", r)
r = await rt("create_event", { title: "Читка онлайн", start: "2026-11-13T16:00", end: "2026-11-13T17:00" })
const r2 = await rt("create_event", { title: "Читка онлайн", start: "2026-11-13T16:00", end: "2026-11-13T17:00" })
check(r.ok && !r.duplicate && r2.duplicate && await made() === 2, "та же просьба второй раз — второе не создано", [r, r2])
check(await page.evaluate(() => live(D.log).filter(j => /Читка онлайн/.test(j.text)).length) === 1, "в журнале «Создал событие» один раз, а не два")

console.log("— другое событие не путается")
r = await rt("create_event", { title: "Звонок папе", start: "2026-11-14T10:00", end: "2026-11-14T10:30" })
check(r.ok && !r.duplicate && await made() === 3, "«Звонок папе» в то же время, что «Звонок маме», — создано", r)
r = await rt("create_event", { title: "Бассейн", start: "2026-11-15T16:00", end: "2026-11-15T17:00" })
const r3 = await rt("create_event", { title: "Бассейн", start: "2026-11-16T16:00", end: "2026-11-16T17:00" })
check(r.ok && r3.ok && !r3.duplicate && await made() === 5, "«Бассейн» в разные дни — оба созданы", [r, r3])

console.log("— тот же день, другое время")
r = await rt("create_event", { title: "Ужин с семьёй", start: "2026-11-13T20:00", end: "2026-11-13T21:00" })
check(r.warning && /Ужин/.test(r.warning) && /update_event/.test(r.warning) && /G2/.test(r.warning) && await made() === 5, "есть «Ужин» в 19:00 — предупреждение: перенести через update_event", r)
r = await rt("create_event", { title: "Ужин с семьёй", start: "2026-11-13T20:00", end: "2026-11-13T21:00", force: true })
check(r.ok && await made() === 6, "с force: true — создаётся (если правда нужно второе)", r)

console.log("— два вызова одновременно")
await page.evaluate(() => { __slow = 1500 })
const both = await page.evaluate(() => Promise.all([runTool("create_event", { title: "Массаж", start: "2026-11-15T14:45", end: "2026-11-15T15:45" }),
  runTool("create_event", { title: "Массаж", start: "2026-11-15T14:45", end: "2026-11-15T15:45" })]))
check(await made() === 7 && both.filter(x => x.duplicate).length === 1, "одновременно два одинаковых — одно событие", both)
await page.evaluate(() => { __slow = 0 })

console.log("— календарь не ответил, но событие создал")
await page.evaluate(() => { window.__realCalDo = calDo
  window.calDo = async (a, x) => { const e = Object.assign({ id: "T" + __created.length }, x); __created.push(e); window.__lost = e; return { error: "Google Календарь не ответил за 25 секунд — проверьте календарь, возможно, изменение всё же прошло" } }
  window.hubPostOnce = async h => ({ ok: true, cal: { events: [__lost] } }) })
r = await rt("create_event", { title: "Стоматолог", start: "2026-11-18T15:00", end: "2026-11-18T16:00" })
check(r.ok && r.id === "T7" && await made() === 8, "ответа не было — проверил день, событие есть, ошибки и повтора нет", r)
r = await rt("create_event", { title: "Стоматолог", start: "2026-11-18T15:00", end: "2026-11-18T16:00" })
check(r.duplicate && await made() === 8, "повторная просьба — второго не создаёт", r)
await page.evaluate(() => { window.calDo = __realCalDo })

console.log("— ход оборвался после записи в календарь")
// 1-й запрос к Claude: create_event; 2-й (после записи) — связь пропала. Человек видит, что уже сделано; Изи — тоже
let calls = 0, lastBody = null
await page.route("https://api.anthropic.com/**", route => {
  if (route.request().method() === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } })
  calls++; lastBody = JSON.parse(route.request().postData())
  const msgs = lastBody.messages, last = msgs[msgs.length - 1]
  const toolResult = Array.isArray(last.content) && last.content.some(c => c.type === "tool_result")
  if (toolResult && calls <= 2) return route.abort("failed")   // обрыв после записи (и тихий повтор izi-stable — тоже)
  const hdr = { "access-control-allow-origin": "*" }
  if (!toolResult) return route.fulfill({ status: 200, contentType: "application/json", headers: hdr, body: JSON.stringify({ stop_reason: "tool_use",
    content: [{ type: "tool_use", id: "tu" + calls, name: "create_event", input: { title: calls < 3 ? "Читка онлайн у Леры" : "Читка онлайн Лера", start: "2026-11-19T15:30", end: "2026-11-19T16:30" } }] }) })
  route.fulfill({ status: 200, contentType: "application/json", headers: hdr, body: JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: "Уже стоит." }] }) })
})
await page.evaluate(() => chatSend("поставь читку онлайн у Леры в среду в 15:30")); await page.waitForTimeout(500)
let st = await page.evaluate(() => ({ n: __created.filter(e => /Лер/.test(e.title)).length, last: D.chat[D.chat.length - 1], user: D.chat[D.chat.length - 2] }))
check(st.n === 1 && st.user.acts && /создал событие «Читка онлайн у Леры», 19 ноя 15:30/.test(st.user.acts[0]), "событие создано, и это записано в саму просьбу", st)
check(/Уже сделано: создал событие «Читка онлайн у Леры»/.test(st.last.text), "связь пропала — в ответе видно, что событие уже создано", st.last.text)
await page.evaluate(() => chatSend("ну так поставь читку")); await page.waitForTimeout(500)
const sent = JSON.stringify(lastBody.messages)
check(/Уже сделано: создал событие «Читка онлайн у Леры»/.test(sent) && /Не повторяй/.test(sent), "в следующем запросе Изи видит, что уже сделано", sent.slice(0, 300))
st = await page.evaluate(() => ({ n: __created.filter(e => /Лер/.test(e.title)).length, last: D.chat[D.chat.length - 1].text }))
check(st.n === 1 && st.last === "Уже стоит.", "повторная просьба — второе не создано", st)

console.log("— «Стоп» после записи")
await page.unroute("https://api.anthropic.com/**")
let stopNow = null
await page.route("https://api.anthropic.com/**", route => {
  if (route.request().method() === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } })
  const msgs = JSON.parse(route.request().postData()).messages, last = msgs[msgs.length - 1]
  const hdr = { "access-control-allow-origin": "*" }
  if (Array.isArray(last.content) && last.content.some(c => c.type === "tool_result")) { stopNow = route; return }   // висит, пока не нажмут «Стоп»
  route.fulfill({ status: 200, contentType: "application/json", headers: hdr, body: JSON.stringify({ stop_reason: "tool_use",
    content: [{ type: "tool_use", id: "tz", name: "create_event", input: { title: "Уборщица от офиса", start: "2026-11-20T10:00", end: "2026-11-20T12:00" } }] }) })
})
page.evaluate(() => chatSend("уборщица от офиса в четверг с 10 до 12")).catch(() => {})
for (let i = 0; i < 30 && !stopNow; i++) await page.waitForTimeout(100)
await page.evaluate(() => chatStop()); await page.waitForTimeout(500)
st = await page.evaluate(() => ({ n: __created.filter(e => /Уборщ/.test(e.title)).length, tail: D.chat.slice(-2).map(m => m.role + ": " + m.text), inp: document.querySelector("#chat-in") && document.querySelector("#chat-in").value }))
check(st.n === 1 && /уборщица от офиса/.test(st.tail[0]) && /^assistant: Успел: создал событие «Уборщица от офиса»/.test(st.tail[1]) && !st.inp, "остановили после записи — просьба осталась, видно «Успел: создал событие», в строку ввода не вернулась", st)

const errs = errors.filter(e => !/Failed to load resource/.test(e))   // обрыв связи в тесте — нарочно
check(!errs.length, "без ошибок на странице", errs)
await browser.close(); server.close()
console.log(ok ? "EVDEDUP_OK" : "EVDEDUP_FAIL")
process.exit(ok ? 0 : 1)
