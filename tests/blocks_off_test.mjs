// Скрытый блок = без подсказок по нему: убрали блок (удержать → «−») — не приходят пуши таблицы, подсказки Изи и карточки;
// данные целы, вернули блок — подсказки снова идут. Сервер (pushTick) молчит по видам из push_cfg.off.
// Снимки — build/web-shots/blocks-off/ (или BOFF_SHOTS)
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
import { sheetScript } from "./fake_sheet.mjs"

const ROOT = new URL("../dist/web/", import.meta.url).pathname
const SH = process.env.BOFF_SHOTS || new URL("../build/web-shots/blocks-off/", import.meta.url).pathname
fs.mkdirSync(SH, { recursive: true })
let ok = true
const check = (c, msg, got) => { console.log(c ? "   ✓" : "   ✗", msg, c ? "" : JSON.stringify(got)); ok = ok && !!c }

const time = new Date("2026-11-16T07:00:00Z")   // 14:00 Бангкок
const { page, browser, server, errors } = await boot2({ root: ROOT, time,
  lists: ({ bkk }) => ({ water: [{ id: "w1", date: +bkk(0, 9, 30), u: +time, ml: 250 }],
    rems: [{ id: "r1", date: +time, u: +time, title: "Позвонить в банк", due: "2026-11-16T18:00" }],
    nudges: [{ id: "n1", date: +bkk(0, 16), u: +time, text: "💧 Пора стакан воды" }, { id: "n2", date: +bkk(0, 17), u: +time, text: "Через час встреча — подготовь договор" }] }) })
await page.evaluate(() => { D.feat = {}; save(false); HEALTH.medAdd({ title: "Витамин D", times: ["20:00"] }); setTab("health") }); await page.waitForTimeout(800)
const md = () => page.evaluate(() => live(D.nudges).filter(n => /^md/.test(n.id)).length)
check(await md() > 0, "подсказки про лекарство поставлены", await md())

const hide = async key => { await page.evaluate(k => BLOCKS.enter(), key); await page.waitForTimeout(500)
  await page.click(`#view > [data-bk="${key}"] > .bk-rm`); await page.waitForTimeout(700) }
const show = async key => { await page.click(`[data-bk-add="${key}"]`); await page.waitForTimeout(700) }
const both = async (name, sel) => {
  for (const sc of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: sc }); await page.waitForTimeout(300)
    if (sel) { await page.evaluate(s => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: "center" }) }, sel); await page.waitForTimeout(250) }
    await page.screenshot({ path: SH + name + (sc === "dark" ? "-dark" : "") + ".png" })
  }
  await page.emulateMedia({ colorScheme: "light" })
}

console.log("«Здоровье»: скрыли «Воду» и «Лекарства»")
await hide("Вода"); await hide("#meds")
check(await page.evaluate(() => { const o = tipsOff(); return o.has("water") && o.has("meds") && !o.has("sleep") }), "вода и лекарства выключены, сон — нет")
check(await page.evaluate(() => { const c = pushCfg(); return c.water === 0 && c.off.includes("water") && c.off.includes("meds") }), "таблице уходит off: [meds, water]")
check(await md() === 0, "будущие подсказки про лекарство убраны")
const nud = await page.evaluate(() => live(D.nudges).map(n => n.id))
check(!nud.includes("n1") && nud.includes("n2"), "подсказка Изи про воду убрана, остальные остались", nud)
check(await page.isVisible(".bk-tray-n"), "в «Скрытых блоках» сказано, что подсказки не приходят")
await both("bo-1-health-hidden", ".bk-tray")
const sys = await page.evaluate(() => agentSystem())
check(/подсказки по ним выключены: [^\n]*вода[^\n]*лекарства/.test(sys), "Изи знает, о чём не напоминать")
const pd = await page.evaluate(() => planDay([{ time: dayKey(new Date()) + "T18:00", text: "Выпей стакан воды" }, { time: dayKey(new Date()) + "T19:00", text: "Прими витамины" }, { time: dayKey(new Date()) + "T18:30", text: "Прогулка 20 минут" }]))
check(pd.planned.length === 1 && /Прогулка/.test(pd.planned[0].text) && pd.skipped === 2, "plan_day не ставит подсказки скрытых блоков", pd)
check(await page.evaluate(() => live(D.goals).filter(g => g.kind === "med").length === 1 && today(D.water).length === 1), "данные (лекарство, вода) на месте")

console.log("Вернули «Лекарства»")
await show("#meds")
check(await page.evaluate(() => tipOn("meds") && !pushCfg().off.includes("meds")), "лекарства снова включены")
check(await md() > 0, "подсказки про лекарство вернулись", await md())
await page.evaluate(() => BLOCKS.leave()); await page.waitForTimeout(400)
check(await page.isVisible("#meds"), "блок «Лекарства» на экране с прежними данными")

console.log("Настройки: включили «Подсказки про воду» — блок «Вода» вернулся")
await page.evaluate(() => setTab("more")); await page.waitForTimeout(600)
check(!(await page.$eval("[data-water-tg] .tgl", e => e.classList.contains("on"))), "переключатель выключен, пока блок скрыт")
await page.click("[data-water-tg]"); await page.waitForTimeout(400)
check(await page.evaluate(() => waterTips() && !(D.blocksOff.health || {})["Вода"]), "вода включена, блок вернулся")

console.log("«Сегодня»: скрыли «Напоминания»")
await page.evaluate(() => setTab("today")); await page.waitForTimeout(700)
await hide("Напоминания")
check(await page.evaluate(() => pushCfg().off.includes("rems")), "off: rems")
check(await page.evaluate(() => D.rems.some(r => r.id === "r1" && !r.deleted)), "само напоминание не удалено")
await both("bo-2-today-hidden", ".bk-tray")
await page.evaluate(() => BLOCKS.leave()); await page.waitForTimeout(300)

console.log("Выключили функцию «Деньги» — без подсказок про платежи")
await page.evaluate(() => FEAT.set("money", false, true))
check(await page.evaluate(() => ["bills", "budget", "debts"].every(k => !tipOn(k))), "платежи, лимиты, долги выключены")
await page.evaluate(() => FEAT.set("money", true, true))
check(await page.evaluate(() => tipOn("bills")), "включили — снова есть")
check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()

console.log("Сервер (pushTick): off — без пушей по скрытым блокам")
const sh = sheetScript(), S = "s".repeat(32), hub = h => sh.post({ secret: S, hub: h }), now = Date.now()
const z = n => String(n).padStart(2, "0"), iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
hub({ from: "app", since: 0 })
const subscribe = off => hub({ from: "app", push: { action: "subscribe", sub: { endpoint: "https://push.example/abc", keys: { p256dh: "x", auth: "y" } }, cfg: { waterGoal: 2000, water: 1, off } } })
const lists = u => ({ nudges: [{ id: "md1" + u, date: now - 60e3, u, title: "Лекарства", text: "Пора принять: Витамин D" }, { id: "sl1" + u, date: now - 60e3, u, title: "Скоро спать", text: "Лечь до 23:00" },
    { id: "n2" + u, date: now - 60e3, u, text: "Через час встреча — подготовь договор" }],
  rems: [{ id: "r1" + u, date: now, u, title: "Позвонить в банк", due: iso(new Date(now - 60e3)) }],
  fast: [{ id: "f1" + u, date: now, u, start: now - 16 * 3600e3 - 60e3, hours: 16 }] })
subscribe(["fast", "meds", "rems"])
hub({ from: "widget", since: 0, snap: { pushAware: 1, events: [] }, lists: lists(1) })
sh.pushTick()
let out = hub({ from: "app", push: { action: "outbox" } }).push.items.map(x => x.title + " | " + x.body)
check(!out.some(x => /Витамин|Позвонить|Окно открыто/.test(x)), "нет лекарств, напоминаний, голодания", out)
check(out.some(x => /договор/.test(x)) && out.some(x => /Скоро спать/.test(x)), "остальное идёт", out)
subscribe([])
hub({ from: "widget", since: 0, lists: lists(2) })
sh.pushTick()
out = hub({ from: "app", push: { action: "outbox" } }).push.items.map(x => x.title + " | " + x.body)
check(out.some(x => /Витамин/.test(x)) && out.some(x => /Позвонить/.test(x)) && out.some(x => /Окно открыто/.test(x)), "вернули блоки — пуши снова приходят", out)

console.log(ok ? "BLOCKS_OFF_OK" : "BLOCKS_OFF_FAIL")
process.exit(ok ? 0 : 1)
