// Английский интерфейс: обход разделов и окон в языке «en», сбор непереведённого текста (L.miss),
// проверка, что валюта выбирается отдельно (English + ฿, English + $), снимки.
//   node tests/i18n_en_test.mjs [папка для снимков]
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2] || ""
if (out) fs.mkdirSync(out, { recursive: true })
const time = new Date("2026-11-12T03:30:00Z")
const { page, browser, server, errors } = await boot2({
  root: new URL("../dist/web/", import.meta.url).pathname, time, dark: !!process.env.DARK,
  ctxOpts: { locale: "en-US" }, init: () => { try { localStorage.setItem("izi-lang", "en") } catch (e) {} },
  events: ({ bkk, iso }) => [
    { id: "e1", title: "Standup", s: iso(bkk(0, 10)), e: iso(bkk(0, 10, 30)), calendar: "Работа" },
    { id: "e2", title: "Dentist", s: iso(bkk(0, 15)), e: iso(bkk(0, 16)), location: "Sukhumvit 24" },
    { id: "e3", title: "Padel", s: iso(bkk(1, 18)), e: iso(bkk(1, 19, 30)) },
  ],
})
const ALL = new Set()
const grab = async () => (await page.evaluate(() => { const a = [...L.miss]; L.miss.clear(); return a })).forEach(x => ALL.add(x))
const shot = async n => { if (!out) return; await page.waitForTimeout(400); await page.screenshot({ path: `${out}/${n}.png` }) }
const closeSheets = () => page.evaluate(() => { try { while (typeof stack !== "undefined" && stack.length) stack[stack.length - 1].close() } catch (e) {} document.querySelectorAll("#layer > *").forEach(x => x.remove()) })

const ok = []
ok.push(await page.evaluate(() => L.lang === "en" && document.documentElement.lang === "en"))
// немного данных: траты, вода, привычка
await page.evaluate(() => {
  const now = Date.now()
  upsert("money", { id: "t1", date: now - 3600e3, type: "expense", amount: 350, method: "transfer", category: "Транспорт", comment: "Grab" })
  upsert("money", { id: "t2", date: now - 7200e3, type: "expense", amount: 120, method: "cash", category: "Кафе и рестораны", comment: "coffee" })
  upsert("money", { id: "t3", date: now - 86400e3, type: "income", amount: 60000, method: "transfer", category: "Зарплата", comment: "" })
  render()
})
for (const t of ["today", "plans", "money", "health", "chat", "more"]) {
  await page.evaluate(t => { setTab(t); $("#view").scrollTop = 0 }, t); await page.waitForTimeout(500)
  await shot("en-" + t); await grab()
}
for (const f of ["lists", "habits", "again", "goals"]) { await page.evaluate(f => { setTab("plans"); plansF = f; render() }, f); await page.waitForTimeout(300); await grab() }
// окна из «+»
await page.evaluate(() => $("#add").click()); await page.waitForTimeout(500); await shot("en-add"); await grab()
const items = await page.$$eval("#layer .opt", els => els.length)
for (let i = 0; i < items; i++) {
  await closeSheets(); await page.evaluate(() => $("#add").click()); await page.waitForTimeout(300)
  await page.evaluate(i => { const b = document.querySelectorAll("#layer .opt")[i]; b && b.click() }, i); await page.waitForTimeout(400); await grab()
}
await closeSheets()
// язык и валюта по отдельности
await page.evaluate(() => { setTab("more") }); await page.waitForTimeout(300)
const card = await page.evaluate(() => [...document.querySelectorAll("#view .card h2")].map(h => h.textContent).join(" | "))
ok.push(/Language/.test(card) && /Currency/.test(card))
for (const [cur, sym, name] of [["THB", "฿", "baht"], ["USD", "$", "usd"]]) {
  await page.evaluate(c => { D.cur = c; curApply(); save(false); setTab("money"); $("#view").scrollTop = 0 }, cur); await page.waitForTimeout(500)
  const txt = await page.evaluate(() => $("#view").innerText)
  ok.push(txt.includes(sym) && !/[А-Яа-яЁё]{4,}/.test(txt.replace(/Grab|coffee/g, "")))
  await shot(`en-money-${name}`); await grab()
}
await page.evaluate(() => { setTab("more"); render() }); await page.waitForTimeout(300)
await page.evaluate(() => document.querySelector('[data-do="lang-pick"]').click()); await page.waitForTimeout(500); await shot("en-lang-pick"); await grab(); await closeSheets()
await page.evaluate(() => document.querySelector('[data-do="cur-pick"]').click()); await page.waitForTimeout(500); await shot("en-cur-pick"); await grab(); await closeSheets()
// Изи получает правило про английский
ok.push(await page.evaluate(() => /Always reply to the user in English/.test(chatSystem())))
const miss = [...ALL]
console.log("непереведено:", miss.length); miss.slice(0, 80).forEach(m => console.log("  · " + m))
const bad = ok.indexOf(false)
console.log(errors.length ? "errors: " + errors.slice(0, 5).join(" | ") : "")
console.log(bad < 0 && !errors.length ? "I18N_EN_OK" : `I18N_EN_FAIL (проверка ${bad})`)
await browser.close(); server.close()
