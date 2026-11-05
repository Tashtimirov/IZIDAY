// Снимки улучшений дизайна (идеи 52–60): экраны всех вкладок, окно, пустой чат, крупный текст.
// node tests/design_shots.mjs <папка> [dark] [корень dist/web]
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const dark = process.argv[3] === "dark", sfx = dark ? "-dark" : ""
const root = process.argv[4] || new URL("../dist/web/", import.meta.url).pathname
const time = new Date("2026-11-05T11:00:00+07:00")
const { page, browser, server, errors } = await boot2({ root, time, dark,
  events: ({ bkk }) => [
    { id: "e1", title: "Показ квартиры, Kata", s: +bkk(0, 14), e: +bkk(0, 15), calendar: "Работа", color: "#0A84FF", location: "Kata Beach" },
    { id: "e2", title: "Падел", s: +bkk(0, 19), e: +bkk(0, 20, 30), calendar: "Личное", color: "#30D158" }],
  lists: ({ bkk, dk }) => ({
    rems: [{ id: "ra", date: +bkk(-1, 9), u: 1, title: "Отправить договор", due: dk(bkk(0, 0)), done: false },
      { id: "rb", date: +bkk(-1, 9), u: 1, title: "Позвонить маме", due: dk(bkk(0, 0)), done: false }],
    money: [{ id: "m1", date: +bkk(0, 9), u: 1, method: "cash", type: "expense", amount: 320, category: "Транспорт", comment: "такси" },
      { id: "m2", date: +bkk(0, 10), u: 1, method: "transfer", type: "expense", amount: 180, category: "Кафе и рестораны", comment: "кофе" },
      { id: "m3", date: +bkk(-2, 10), u: 1, method: "transfer", type: "income", amount: 85000, category: "Зарплата", comment: "зарплата" }],
    water: [{ id: "w1", date: +bkk(0, 9), u: 1, ml: 750 }],
    habits: [{ id: "hz", date: +bkk(-5, 9), u: 1, title: "Зарядка" }],
  }) })
await page.evaluate(() => { D.onb = Object.assign(D.onb || {}, { intro: 1, seen: 1, steps: { done: 1, hide: 1 } }); D.who = "adult"; save(false) })
const full = async (file) => {
  const hh = await page.evaluate(() => { window.scrollTo(0, 0); const v = document.querySelector("#view"); v.scrollTop = 0; return Math.max(844, Math.min(2600, document.querySelector("#top").offsetHeight + v.scrollHeight + 140)) })
  await page.setViewportSize({ width: 390, height: Math.ceil(hh) }); await page.waitForTimeout(1300)
  await page.screenshot({ path: file }); await page.setViewportSize({ width: 390, height: 844 })
}
const closeAll = () => page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
for (const t of ["today", "plans", "money", "health"]) { await page.evaluate(t => setTab(t), t); await page.waitForTimeout(300); await full(`${out}/${t}${sfx}.png`) }
// пустой чат
await page.evaluate(() => { D.chat = []; setTab("chat") }); await page.waitForTimeout(1200)
await page.screenshot({ path: `${out}/chat-empty${sfx}.png` })
// окно (напоминание) — до половины экрана
await page.evaluate(() => setTab("today")); await page.waitForTimeout(400)
await page.evaluate(() => { reminderForm() }); await page.waitForTimeout(900)
await page.screenshot({ path: `${out}/sheet${sfx}.png` }); await closeAll(); await page.waitForTimeout(400)
// длинное окно — выбор
await page.evaluate(() => { ui.choose("Куда отнести расход?", "Такси 320 ฿ сегодня в 9:00", ["Транспорт", "Кафе и рестораны", "Продукты", "Подарки", "Здоровье", "Дом", "Другое", "Развлечения", "Одежда", "Дети"]) }); await page.waitForTimeout(1600)
await page.screenshot({ path: `${out}/sheet-long${sfx}.png` }); await closeAll(); await page.waitForTimeout(400)
if (await page.evaluate(() => !!window.DS)) {
  // загрузка: заглушки
  await page.evaluate(() => { window._k = [D.gcal, D.snap]; D.gcal = null; D.snap = null; setTab("money"); setTab("today") }); await page.waitForTimeout(500)
  await page.evaluate(() => { const l = document.querySelector(".ds-loading"), v = document.querySelector("#view"); if (l) v.scrollTop = l.closest(".card").getBoundingClientRect().top - v.getBoundingClientRect().top + v.scrollTop - 220 }); await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/loading${sfx}.png` })
  await page.evaluate(() => { [D.gcal, D.snap] = window._k; render() })
  // раскрытие карточки: кадры замедленного раскрытия (×6)
  await page.evaluate(() => { document.querySelector("#view").scrollTop = 0; const c = document.querySelector('#view .rg[data-do="td-top3"]'); c.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); DS.slow = 6; c.click() })
  let k = 0
  for (const t of [60, 350, 700, 1800]) { await page.waitForTimeout(t); await page.screenshot({ path: `${out}/morph-${++k}${sfx}.png` }) }
  await page.evaluate(() => { DS.slow = 1 }); await closeAll(); await page.waitForTimeout(600)
  // Настройки → «Размер текста»
  await page.evaluate(() => { setTab("more") }); await page.waitForTimeout(400)
  await page.evaluate(() => { const c = document.querySelector(".ds-ts"); c.scrollIntoView({ block: "center" }) }); await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/settings${sfx}.png` })
  // крупный текст iPhone
  await page.evaluate(() => DS.textScale(1.3)); await page.evaluate(() => setTab("today")); await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/bigtext${sfx}.png` }); await page.evaluate(() => DS.textScale(1))
}
console.log("errors", errors)
await browser.close(); server.close()
