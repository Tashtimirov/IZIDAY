// Проверка Изи: набор типичных просьб (tests/izi_scenarios.mjs) прогоняется через настоящее приложение и настоящую модель.
// Запуск:  IZI_EVAL_KEY=sk-ant-… node tests/izi_eval.mjs [папка сайта] [id,id…]
// Без ключа — только быстрые проверки инструкций (размер, лишнее у друзей). Итог: IZIEVAL_OK / IZIEVAL_FAIL и отчёт izi-eval-report.md.
// Стоимость полного прогона: ~40 просьб × 2–4 запроса к Claude (с кэшем инструкций) — примерно 2–4 $ на Opus.
import { boot2 } from "./today_boot.mjs"
import { SCENARIOS } from "./izi_scenarios.mjs"
import fs from "fs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const only = (process.argv[3] || "").split(",").filter(Boolean)
const MOCK = !!process.env.IZI_EVAL_MOCK   // проверка самой проверки: вместо Claude — заготовленные ответы
const KEY = process.env.IZI_EVAL_KEY || (MOCK ? "mock" : "")
const OUT = process.env.IZI_EVAL_OUT || new URL("../izi-eval-report.md", import.meta.url).pathname
const time = new Date("2026-11-14T03:00:00Z")   // сб 10:00 по Бангкоку
const lists = ({ bkk, dk }) => ({
  money: [{ id: "mt1", date: +bkk(0, 9), u: 1, type: "expense", amount: 320, method: "cash", category: "Транспорт", comment: "такси" },
    { id: "mk1", date: +bkk(-1, 15), u: 1, type: "expense", amount: 120, method: "transfer", category: "Кафе и рестораны", comment: "кофе" }],
  rems: [{ id: "ri", date: +bkk(-1, 9), u: 1, title: "Оплатить интернет", due: dk(bkk(0, 0)), done: false }] })
const events = ({ bkk, iso }) => [
  { id: "E1", title: "Свидание с Аней", start: iso(bkk(1, 18)), end: iso(bkk(1, 20)), calendar: "Личное", all_day: false, location: "", repeats: false },
  { id: "E2", title: "Созвон с Кириллом", start: iso(bkk(2, 11)), end: iso(bkk(2, 12)), calendar: "Работа", all_day: false, location: "", repeats: false },
  { id: "E4", title: "День Конституции", start: iso(bkk(26, 0)).slice(0, 10), end: iso(bkk(27, 0)).slice(0, 10), calendar: "Праздники", all_day: true, location: "", repeats: false, readonly: true },
  { id: "E3", title: "Падел", start: iso(bkk(2, 19)), end: iso(bkk(2, 21)), calendar: "Личное", all_day: false, location: "", repeats: false }]

const BANNED = /(Конечно!|Отличный вопрос|С радостью помогу|Надеюсь, это поможет|Обращайтесь|Дайте знать|Подводя итог|является|представляет собой|важно отметить|^#{1,3} |\*\*)/im
let fails = 0
const rows = []
const ok = (c, m) => { if (!c) fails++; console.log(c ? "✓" : "✗", m) }

async function fresh(friend) {
  const b = await boot2({ root, time, lists, events })
  // ответы на вопросы Изи и подтверждения — сами, как человек; ошибка инструмента по заданию сценария
  await b.page.evaluate(() => {
    window.EV = { calls: [], ask: null, fail: "" }
    window.chatAsk = async (q, opts) => { EV.calls.push({ name: "ask_user", input: { question: q, options: opts } }); return EV.ask || (opts && opts[0]) || "Да" }
    ui.confirm = async (t, h, btns) => btns ? btns[btns.length - 1] : true
    const rt = runTool
    window.runTool = runTool = async (name, x) => { EV.calls.push({ name, input: x }); if (EV.fail === name) return { error: "таблица не ответила" }; return rt(name, x) }
  }).catch(() => {})
  if (friend) await b.page.evaluate(() => { D.conn.friend = { name: "Тест", email: "t@example.com" }; save(false) })
  return b
}

async function staticChecks() {
  for (const friend of [false, true]) {
    const b = await fresh(friend)
    await b.page.evaluate(() => { window.REQ = []; const of = window.fetch
      window.fetch = async (u, o) => { if (!/api\.anthropic\.com/.test(u)) return of(u, o); REQ.push(JSON.parse(o.body)); return new Response(JSON.stringify({ content: [{ type: "text", text: "Готово." }], stop_reason: "end_turn" }), { headers: { "content-type": "application/json" } }) } })
    await b.page.evaluate(() => chatSend("привет"))
    const r = await b.page.evaluate(() => REQ[REQ.length - 1])
    const sys = typeof r.system === "string" ? r.system : r.system.map(x => x.text).join("\n")
    const who = friend ? "друг" : "владелец"
    ok(/IZIDAY/.test(sys) && !/«Мой день»/.test(sys), `${who}: Изи знает, что он в IZIDAY`)
    ok(/Точность/.test(sys) && /Сообщить об ошибке/.test(sys), `${who}: правила точности и подсказки по приложению в инструкциях`)
    if (friend) ok(!/диспетчер|Claude Code|Scriptable|в виджете: меню/i.test(sys), "друг: в инструкциях нет виджета, Claude Code и рабочей почты владельца")
    const toks = Math.round((sys.length + JSON.stringify(r.tools).length) / 3.2)
    console.log(`  ${who}: инструкции ${sys.length} знаков, инструментов ${r.tools.length}, ≈${toks} токенов на запрос`)
    await b.browser.close(); b.server.close()
  }
}

async function runScenario(s) {
  const b = await fresh(s.friend)
  const { page } = b
  let mk = 0
  if (MOCK) await page.route("https://api.anthropic.com/**", rt => {
    const t = (s.tools || [])[0], body = mk++ === 0 && t ? { content: [{ type: "tool_use", id: "t1", name: t, input: { id: "mt1", type: "expense", amount: 450, method: "cash", category: "Продукты", comment: "продукты" } }], stop_reason: "tool_use" }
      : { content: [{ type: "text", text: "Записал 450 ฿ на продукты." }], stop_reason: "end_turn" }
    rt.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) })
  })
  else if (KEY) await page.route("https://api.anthropic.com/**", async rt => {
    const req = rt.request()
    const headers = Object.assign({}, req.headers(), { "x-api-key": KEY })
    delete headers["content-length"]; delete headers.host; delete headers.origin; delete headers.referer
    const body = JSON.parse(req.postData()); delete body.stream
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body: JSON.stringify(body) })
      const txt = await res.text()
      try { const j = JSON.parse(txt); if (j.usage) USAGE.push(j.usage) } catch (e) {}
      rt.fulfill({ status: res.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: txt })
    } catch (e) { rt.abort() }
  })
  if (s.friend) await page.evaluate(() => { D.conn.key = D.conn.key || "sk-test" })
  await page.evaluate(x => { EV.ask = x.ask || null; EV.fail = x.fail || "" }, s)
  const t0 = Date.now()
  await page.evaluate(t => chatSend(t), s.t).catch(e => {})
  const ms = Date.now() - t0
  const calls = await page.evaluate(() => EV.calls)
  const answer = await page.evaluate(() => { const m = D.chat.filter(m => m.role === "assistant").pop(); return m ? String(m.text || "") : "" })
  await b.browser.close(); b.server.close()
  const errs = []
  const names = calls.map(c => c.name)
  for (const t of s.tools || []) if (!names.includes(t)) errs.push(`не вызвал ${t}`)
  if (s.anyOf && !s.anyOf.some(t => names.includes(t))) errs.push(`не вызвал ни один из: ${s.anyOf.join(", ")}`)
  for (const t of s.no || []) if (names.includes(t)) errs.push(`лишнее действие ${t}`)
  for (const [t, n] of Object.entries(s.minCalls || {})) if (names.filter(x => x === t).length < n) errs.push(`${t} меньше ${n} раз`)
  for (const x of s.input || []) {
    const [, tool, field, re] = x.match(/^(\w+)\.(\w+)~(.*)$/)
    const vals = calls.filter(c => c.name === tool).map(c => c.input && c.input[field])
    if (!vals.some(v => v != null && new RegExp(re, "i").test(typeof v === "object" ? JSON.stringify(v) : String(v)))) errs.push(`${tool}.${field}: ${vals.map(v => JSON.stringify(v)).join(" | ") || "нет"} ≠ /${re}/`)
  }
  if (s.check) { const e = s.check(calls, answer); if (e) errs.push(e) }
  if (s.say && !s.say.test(answer)) errs.push(`в ответе нет ${s.say}`)
  if (s.notSay && s.notSay.test(answer)) errs.push(`в ответе лишнее ${s.notSay}`)
  if (BANNED.test(answer)) errs.push(`штамп или разметка: «${answer.match(BANNED)[0]}»`)
  const lines = answer.split("\n").filter(l => l.trim()).length
  if (lines > (s.maxLines || 8)) errs.push(`длинно: ${lines} строк`)
  if (!answer.trim()) errs.push("пустой ответ")
  if (/Claude ответил ошибкой|Нет связи/.test(answer)) errs.push("сбой связи: " + answer.slice(0, 80))
  rows.push({ s, ok: !errs.length, errs, ms, calls: names, answer })
  console.log(errs.length ? "✗" : "✓", `[${s.area}] ${s.t}  (${(ms / 1000).toFixed(1)} с; ${names.join(", ") || "без действий"})`)
  if (errs.length) { console.log("    " + errs.join("\n    ")); console.log("    ответ: " + answer.replace(/\n/g, " / ").slice(0, 300)) }
}

const USAGE = []
await staticChecks()
if (!KEY) console.log("\nКлюча нет (IZI_EVAL_KEY) — прогон просьб пропущен, проверены только инструкции.")
else {
  const list = SCENARIOS.filter(s => !only.length || only.includes(s.id))
  for (const s of list) await runScenario(s)
  const pass = rows.filter(r => r.ok).length
  const byArea = {}
  for (const r of rows) { const a = byArea[r.s.area] = byArea[r.s.area] || [0, 0]; a[1]++; if (r.ok) a[0]++ }
  const ms = rows.map(r => r.ms).sort((a, b) => a - b)
  const inT = USAGE.reduce((a, u) => a + (u.input_tokens || 0), 0), cr = USAGE.reduce((a, u) => a + (u.cache_read_input_tokens || 0), 0), cw = USAGE.reduce((a, u) => a + (u.cache_creation_input_tokens || 0), 0), outT = USAGE.reduce((a, u) => a + (u.output_tokens || 0), 0)
  const md = [`# Проверка Изи — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, "",
    `Итог: **${pass} из ${rows.length}** просьб выполнено верно. Время ответа: медиана ${(ms[ms.length >> 1] / 1000).toFixed(1)} с, худшее ${(ms[ms.length - 1] / 1000).toFixed(1)} с.`,
    `Запросов к Claude: ${USAGE.length}; токены: вход ${inT}, из кэша ${cr}, в кэш ${cw}, ответ ${outT}.`, "",
    "| Раздел | Верно |", "|---|---|", ...Object.entries(byArea).map(([a, [p, n]]) => `| ${a} | ${p} из ${n} |`), "",
    "## Ошибки", "", ...rows.filter(r => !r.ok).map(r => `- **${r.s.t}** — ${r.errs.join("; ")}. Действия: ${r.calls.join(", ") || "нет"}. Ответ: «${r.answer.replace(/\n/g, " / ").slice(0, 300)}»`), "",
    "## Все ответы", "", ...rows.map(r => `- ${r.ok ? "✓" : "✗"} ${r.s.t} → «${r.answer.replace(/\n/g, " / ").slice(0, 300)}» (${(r.ms / 1000).toFixed(1)} с)`)]
  fs.writeFileSync(OUT, md.join("\n"))
  console.log(`\nИТОГО: ${pass}/${rows.length}. Отчёт: ${OUT}`)
  if (pass < rows.length * 0.9) fails++
}
console.log(fails ? "IZIEVAL_FAIL" : "IZIEVAL_OK")
