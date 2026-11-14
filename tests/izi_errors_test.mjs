// Сбои Claude: перегрузка — тихий повтор; лимит, ключ, нет связи — понятный текст без английского. Провал — IZIERR_FAIL
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const { page, browser, server } = await boot2({ root, time: new Date("2026-11-14T03:00:00Z") })
let fails = 0
const ok = (c, m, x = "") => { if (!c) fails++; console.log(c ? "✓" : "✗", m, c ? "" : x) }
await page.evaluate(() => { window.SCN = []; window.N = 0; const of = window.fetch
  window.fetch = async (u, o) => { if (!/api\.anthropic\.com/.test(u)) return of(u, o); N++; const m = SCN.shift(); if (m === "NET") throw new TypeError("Load failed")
    return new Response(JSON.stringify(m || { content: [{ type: "text", text: "Готово." }], stop_reason: "end_turn" }), { headers: { "content-type": "application/json" } }) } })
const last = () => page.evaluate(() => D.chat.filter(m => m.role === "assistant").pop().text)
const run = (scn, t) => page.evaluate(([s, t]) => { SCN = s; N = 0; return chatSend(t) }, [scn, t])
await run([{ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, { content: [{ type: "text", text: "Записал." }], stop_reason: "end_turn" }], "кофе 100")
ok(await last() === "Записал." && await page.evaluate(() => N) === 2, "перегрузка: тихий повтор, человек видит обычный ответ", await last())
await run([{ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }], "кофе 100")
let t = await last(); ok(/перегружен/.test(t) && !/Overloaded|Claude ответил/.test(t), "перегрузка дважды: понятный текст", t)
await run([{ type: "error", error: { type: "limit", message: "На сегодня Изи устал: дневной лимит исчерпан. Завтра снова на связи." } }], "кофе 100")
t = await last(); ok(/^На сегодня Изи устал/.test(t), "лимит друга: без приставки «Claude ответил ошибкой»", t)
await run([{ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }], "кофе 100")
t = await last(); ok(/Ключ Claude не подходит/.test(t), "неверный ключ: куда идти", t)
await run(["NET", "NET"], "кофе 100")
t = await last(); ok(/Нет связи/.test(t) && await page.evaluate(() => N) === 2, "нет сети: один повтор, потом понятный текст", t)
await run(["NET", { content: [{ type: "text", text: "Есть." }], stop_reason: "end_turn" }], "кофе 100")
ok(await last() === "Есть.", "сеть мигнула: повтор удался", await last())
await browser.close(); server.close()
console.log(fails ? "IZIERR_FAIL" : "IZIERR_OK")
