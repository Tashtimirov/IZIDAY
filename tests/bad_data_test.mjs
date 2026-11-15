// Испорченные записи (из таблицы, со старой версии, от Изи) не ломают ни один раздел: в каждый список по очереди
// кладутся записи без полей, с числами строкой, с непонятным типом — все вкладки должны открываться без карточки сбоя.
//   node tests/bad_data_test.mjs → BAD_DATA_OK
import { boot2 } from "./today_boot.mjs"
const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-12T03:30:00Z") })
let bad = 0
const lists = await page.evaluate(() => Object.keys(D).filter(k => Array.isArray(D[k])))
console.log("списки:", lists.join(", "))
const BAD = [{}, { id: "b1" }, { id: "b2", date: "вчера", title: null, amount: "сто" }, { id: "b3", date: Date.now(), title: 123, kind: "непонятно", type: "x", method: "card", category: null, ml: "250", days: "пн" }, { id: "b4", date: null, due: "2026-13-45", time: "25:99", title: "" }]
for (const k of lists) {
  if (k === "chat") continue
  const e0 = errors.length
  const res = await page.evaluate(({ k, BAD }) => {
    const keep = D[k].slice(); D[k].push(...BAD.map(b => Object.assign({}, b, { id: (b.id || "x") + k })))
    const out = []
    for (const t of ["today", "plans", "money", "health", "chat", "more"]) { try { setTab(t) } catch (e) { out.push(t + ": " + e.message) } if (/Не получилось показать/.test($("#view").innerText)) out.push(t + ": карточка сбоя") }
    D[k] = keep; save(false); setTab("today")
    return out
  }, { k, BAD })
  const er = errors.slice(e0)
  if (res.length || er.length) bad++, console.log("✗", k, JSON.stringify(res), er.slice(0, 2).map(x => x.slice(0, 220)))
}
await browser.close(); server.close()
console.log(bad ? "BAD_DATA_FAIL" : "BAD_DATA_OK"); process.exit(bad ? 1 : 0)
