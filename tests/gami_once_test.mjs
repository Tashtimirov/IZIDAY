// Плашка «+N Веха: …» — один раз. Веха, пришедшая с сервера после запуска (сделана давно или уже показана), не показывается снова.
import { boot2 } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const time = new Date("2026-11-10T21:00:00+07:00")
const { page, browser, server, errors, bkk } = await boot2({ root, time, lists: ({ bkk, dk }) => ({
  rems: [{ id: "ra", date: +bkk(-1, 9), u: 1, title: "Отправить договор", due: dk(bkk(0, 0)), done: false }] }) })
let now = +time
const later = async s => { now += s * 1000; await page.clock.setFixedTime(now) }
const shown = () => page.evaluate(() => { const t = $("#gtoast"); const r = t && t.classList.contains("show") ? t.textContent : ""; if (t) t.classList.remove("show"); return r })
const goal = (at, gid = "gw") => page.evaluate(([at, gid]) => { upsert("goals", { id: gid, date: at - 864e5, u: 1, kind: "wish", title: "Паспорт", steps: [{ id: "s1", t: "Созвониться с Лау по паспорту", done: true, at }] }); save(false) }, [at, gid])

await later(10); await page.evaluate(() => GAMI.tick()); await shown()
// 1) синхронизация принесла веху, сделанную 2 часа назад — без плашки
await goal(now - 2 * 3600e3); await page.evaluate(() => GAMI.tick())
{ const t = await shown(); check(!/Веха/.test(t), "веха двухчасовой давности из синхронизации — без плашки", t) }
check(await page.evaluate(() => GAMI.stats().today.items.some(i => /Веха/.test(i.t))), "баллы за веху всё равно начислены")
// 2) сделали дело сейчас — плашка есть
await later(5); await page.evaluate(() => { remSet("ra", { completed: true }); GAMI.tick() })
check(/Отправить договор/.test(await shown()), "свежее дело — плашка «+N»")
// 3) свежая веха — плашка один раз
await page.evaluate(() => { D.goals = D.goals.filter(g => g.id !== "gw"); save(false) }); await page.evaluate(() => GAMI.tick()); await shown()
await later(5); await goal(now, "gw2"); await page.evaluate(() => GAMI.tick())
{ const t = await shown(); check(/Веха: Созвониться/.test(t), "свежая веха — плашка", t) }
await page.evaluate(() => GAMI.tick())
check(!(await shown()), "повторный tick — без плашки")
// 4) перезапуск: старые данные без вехи, затем синхронизация её возвращает — плашки нет
await page.reload(); await page.waitForTimeout(1500)
await page.evaluate(() => { D.goals = D.goals.filter(g => g.id !== "gw2"); save(false) })
await later(10); await page.evaluate(() => GAMI.tick()); await shown()
await later(60); await goal(now - 120e3, "gw2"); await page.evaluate(() => GAMI.tick())
check(!(await shown()), "после перезапуска та же веха не показывается снова")

check(!errors.length, "без ошибок", errors)
await browser.close(); server.close()
console.log(ok ? "GAMI_ONCE_OK" : "GAMI_ONCE_FAIL")
