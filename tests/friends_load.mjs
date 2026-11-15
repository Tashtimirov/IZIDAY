// Нагрузка на сервер «IZIDAY Друзья» — ТОЛЬКО НА КОПИИ (src/friends/LoadTest.gs: loadSeed даёт ключи тестовых людей).
//   node tests/friends_load.mjs <ссылка /exec копии> <secrets.json> [людей=20] [минут=3]
// Каждый «человек» ведёт себя как приложение при активном пользовании: обмен раз в 20–40 с с 1–3 новыми записями,
// иногда задание Изи (календарь) и запрос к Изи. Без ключа Claude в копии запрос к Изи сразу отвечает «не подключён» —
// проверяется очередь и счётчики, деньги не тратятся. Итог: время ответа (медиана, 95%, максимум), ошибки, вердикт.
import fs from "fs"
const [url, file, nArg, mArg] = process.argv.slice(2)
if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url || "") || !file) { console.log("node tests/friends_load.mjs <ссылка /exec копии> <secrets.json> [людей] [минут]"); process.exit(2) }
const secrets = JSON.parse(fs.readFileSync(file, "utf8")), N = Math.min(+nArg || 20, secrets.length), MIN = +mArg || 3
const end = Date.now() + MIN * 60e3, res = { sync: [], tool: [], ai: [] }, errs = {}
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function post(body, kind) {
  const t = Date.now()
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow", signal: AbortSignal.timeout(90e3) })
    const j = await r.json().catch(() => ({ ok: false, error: "не JSON, код " + r.status }))
    const ms = Date.now() - t
    const bad = kind === "ai" ? !(j.type === "error" && j.error && (j.error.type === "nokey" || j.error.type === "limit")) && !j.content : !j.ok
    if (bad) { const e = kind + ": " + String((j.error && (j.error.message || j.error)) || "ошибка").slice(0, 80); errs[e] = (errs[e] || 0) + 1 }
    res[kind].push(ms)
    return j
  } catch (e) { const k = kind + ": " + (e.name === "TimeoutError" ? "нет ответа 90 с" : String(e.message).slice(0, 60)); errs[k] = (errs[k] || 0) + 1; res[kind].push(Date.now() - t) }
}
async function person(i) {
  const secret = secrets[i]; let since = 0, n = 0
  await sleep(Math.random() * 2000)   // все начинают почти разом — худший случай
  while (Date.now() < end) {
    const now = Date.now(), lists = { money: [], rems: [] }
    for (let k = 0; k < 1 + (Math.random() * 3 | 0); k++) lists[Math.random() < .6 ? "money" : "rems"].push(
      { id: `L${i}-${n++}`, date: now, u: now, type: "expense", amount: 100 + n, method: "cash", category: "Кафе и рестораны", comment: "нагрузка", title: "нагрузка " + n })
    const j = await post({ secret, hub: { from: "app", since, snapAt: 0, lists, ops: [] } }, "sync")
    if (j && j.ok) since = j.now
    if (Math.random() < .3) await post({ secret, hub: { from: "app", since: 9e15, snapAt: 9e15, cal: { action: "list", from: new Date().toISOString().slice(0, 10) } } }, "tool")
    if (Math.random() < .3) await post({ secret, ai: { model: "x", max_tokens: 10, messages: [{ role: "user", content: "привет" }] } }, "ai")
    await sleep(20e3 + Math.random() * 20e3)
  }
}
console.log(`${N} человек, ${MIN} мин, ${url.slice(0, 60)}…`)
await Promise.all(Array.from({ length: N }, (_, i) => person(i)))
const st = a => { const s = a.slice().sort((x, y) => x - y), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0; return { n: s.length, med: q(.5), p95: q(.95), max: s[s.length - 1] || 0 } }
const f = ms => (ms / 1000).toFixed(1) + " с"
let lines = [`# Нагрузка на копию сервера друзей: ${N} человек, ${MIN} мин`, ""]
for (const k of ["sync", "tool", "ai"]) { const s = st(res[k]); lines.push(`- ${{ sync: "Обмен", tool: "Задание Изи (календарь)", ai: "Запрос к Изи (без ключа)" }[k]}: ${s.n} запросов, медиана ${f(s.med)}, 95% быстрее ${f(s.p95)}, самый долгий ${f(s.max)}`) }
const ne = Object.values(errs).reduce((a, b) => a + b, 0)
lines.push("", ne ? "Ошибки:" : "Ошибок нет.")
for (const [k, v] of Object.entries(errs)) lines.push(`- ${k}: ${v}`)
const ok = !ne && st(res.sync).p95 < 15e3
lines.push("", ok ? "ИТОГ: сервер выдерживает" : "ИТОГ: есть проблемы — см. выше")
console.log(lines.join("\n")); fs.writeFileSync("friends-load-report.md", lines.join("\n") + "\n")
process.exit(ok ? 0 : 1)
