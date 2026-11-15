// Подсказка про воду: крестик (скрыть до завтра), «Больше не показывать» (D.waterOff), переключатель в Настройках,
// выключенное «Здоровье» — без подсказок про воду; Изи не ставит их в plan_day; сервер (pushTick) молчит про воду при cfg.water === 0.
// Снимки — build/web-shots/water-off/ (или WATER_SHOTS)
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
import { sheetScript } from "./fake_sheet.mjs"

const ROOT = new URL("../dist/web/", import.meta.url).pathname
const SH = process.env.WATER_SHOTS || new URL("../build/web-shots/water-off/", import.meta.url).pathname
fs.mkdirSync(SH, { recursive: true })
let ok = true
const check = (c, msg, got) => { console.log(c ? "   ✓" : "   ✗", msg, c ? "" : JSON.stringify(got)); ok = ok && !!c }

// 14:00 по Бангкоку, последний стакан в 9:30 — 4 ч без воды
const time = new Date("2026-11-16T07:00:00Z")
const { page, browser, server, errors, bkk } = await boot2({ root: ROOT, time,
  lists: ({ bkk }) => ({ water: [{ id: "w1", date: +bkk(0, 9, 30), u: +time, ml: 250 }],
    nudges: [{ id: "n1", date: +bkk(0, 16), u: +time, text: "💧 Пора стакан воды" }, { id: "n2", date: +bkk(0, 17), u: +time, text: "Через час встреча — подготовь договор" }] }) })
await page.evaluate(() => { D.feat = {}; save(false); setTab("today") }); await page.waitForTimeout(700)

const both = async (name, sel) => {
  for (const sc of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: sc }); await page.waitForTimeout(300)
    if (sel) { await page.evaluate(s => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: "center" }) }, sel); await page.waitForTimeout(250) }
    await page.screenshot({ path: SH + name + (sc === "dark" ? "-dark" : "") + ".png" })
  }
  await page.emulateMedia({ colorScheme: "light" })
}

console.log("Карточка «N ч без воды» на «Сегодня»")
const card = () => page.$('.tip-card[data-tip="w"]')
check(!!(await card()), "карточка про воду есть")
check(/4 ч без воды/.test(await page.textContent(".tip-card")), "текст «4 ч без воды»", await page.textContent(".tip-card"))
check(await page.isVisible('.tip-card [data-tip-off="w"]'), "крестик есть")
check(await page.isVisible('.tip-card [data-tip-never="w"]'), "кнопка «Больше не показывать» с подписью")
await both("w-1-card", ".tip-card")

console.log("Крестик — только до завтра")
await page.click('.tip-card [data-tip-off="w"]'); await page.waitForTimeout(500)
check(!(await card()), "после крестика карточки нет")
check(await page.evaluate(() => !D.waterOff && waterTips()), "подсказки не выключены навсегда")
await page.evaluate(() => { D.tdOff = {}; save(false); render() }); await page.waitForTimeout(400)
check(!!(await card()), "назавтра (сброс) карточка снова есть")

console.log("«Больше не показывать»")
await page.click('.tip-card [data-tip-never="w"]'); await page.waitForTimeout(700)
check(!(await card()), "карточки нет")
check(await page.evaluate(() => D.waterOff === 1 && !waterTips() && pushCfg().water === 0), "D.waterOff, в пуш-настройки уходит water: 0")
const nud = await page.evaluate(() => live(D.nudges).map(n => n.id))
check(!nud.includes("n1") && nud.includes("n2"), "будущая подсказка про воду убрана, другая осталась", nud)
await page.evaluate(() => { D.tdOff = {}; render() }); await page.waitForTimeout(300)
check(!(await card()), "и назавтра не появляется")
const sys = await page.evaluate(() => agentSystem())
check(/Подсказки про воду пользователь выключил/.test(sys) && !/о воде напоминай сам/.test(sys), "Изи знает: про воду не напоминать")
const pd = await page.evaluate(() => planDay([{ time: dayKey(new Date()) + "T18:00", text: "Выпей стакан воды" }, { time: dayKey(new Date()) + "T18:30", text: "Прогулка 20 минут" }]))
check(pd.planned.length === 1 && /Прогулка/.test(pd.planned[0].text) && pd.skipped === 1, "plan_day не ставит подсказку про воду", pd)

console.log("Настройки → Уведомления: переключатель")
await page.evaluate(() => setTab("more")); await page.waitForTimeout(600)
check(await page.isVisible("[data-water-tg]"), "есть «Подсказки про воду»")
check(!(await page.$eval("[data-water-tg] .tgl", e => e.classList.contains("on"))), "выключен")
await both("w-2-settings-off", "[data-water-tg]")
await page.click("[data-water-tg]"); await page.waitForTimeout(400)
check(await page.evaluate(() => !D.waterOff && waterTips() && pushCfg().water === 1), "включили обратно")
await both("w-3-settings-on", "[data-water-tg]")

console.log("Выключено «Здоровье»")
await page.evaluate(() => { D.water = D.water.filter(w => w.id === "w1"); FEAT.set("health", false); setTab("today") }); await page.waitForTimeout(600)
check(await page.evaluate(() => !waterTips() && pushCfg().water === 0), "без «Здоровья» подсказки про воду выключены, на сервер — water: 0")
check(!(await card()), "карточки про воду нет")
check(/Подсказки про воду пользователь выключил/.test(await page.evaluate(() => agentSystem())), "Изи про воду не напоминает")
await page.evaluate(() => setTab("more")); await page.waitForTimeout(500)
check(!(await page.isVisible("[data-water-tg]")), "в Настройках переключателя нет (раздел выключен)")
await page.evaluate(() => { FEAT.set("health", true); setTab("today") }); await page.waitForTimeout(600)
check(await page.evaluate(() => waterTips() && pushCfg().water === 1) && !!(await card()), "включили «Здоровье» — подсказка вернулась")
await page.evaluate(() => { D.waterOff = 1 })
check(await page.evaluate(async () => { await runTool("add_water", { ml: 250 }); return today(D.water).length === 2 && D.waterOff === 1 }), "записать воду по просьбе можно")
check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()

console.log("Сервер (pushTick): water: 0 — без воды")
const sh = sheetScript(), S = "s".repeat(32), hub = h => sh.post({ secret: S, hub: h }), now = Date.now()
hub({ from: "app", since: 0 })
const subscribe = water => hub({ from: "app", push: { action: "subscribe", sub: { endpoint: "https://push.example/abc", keys: { p256dh: "x", auth: "y" } }, cfg: { waterGoal: 2000, water } } })
subscribe(0)
hub({ from: "widget", since: 0, snap: { pushAware: 1, events: [] }, lists: {
  nudges: [{ id: "n1", date: now - 60e3, u: now, text: "💧 Выпей стакан воды" }, { id: "n2", date: now - 60e3, u: now, text: "Через час встреча — подготовь договор" }],
  water: [{ id: "w1", date: now - 5 * 3600e3, u: now, ml: 250 }] } })
sh.pushTick()
let out = hub({ from: "app", push: { action: "outbox" } }).push.items.map(x => x.title + " | " + x.body)
check(!out.some(x => /вод|стакан/i.test(x)), "ни подсказки, ни напоминания про воду", out)
check(out.some(x => /договор/.test(x)), "остальные подсказки идут", out)
subscribe(1)
hub({ from: "widget", since: 0, lists: { nudges: [{ id: "n3", date: now - 30e3, u: now + 1, text: "💧 Стакан воды" }] } })
sh.pushTick()
out = hub({ from: "app", push: { action: "outbox" } }).push.items.map(x => x.title + " | " + x.body)
check(out.some(x => /Стакан воды/.test(x)), "water: 1 — подсказка про воду снова приходит", out)

console.log(ok ? "WATER_OFF_OK" : "WATER_OFF_FAIL")
process.exit(ok ? 0 : 1)
