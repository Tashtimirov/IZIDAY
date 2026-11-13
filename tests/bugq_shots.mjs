// Кнопка «Сообщить об ошибке» на каждом экране + форма с экраном и голосом. node tests/bugq_shots.mjs <папка> [dark]
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const dark = process.argv[3] === "dark", sfx = dark ? "-dark" : "-light"
const root = new URL("../dist/web/", import.meta.url).pathname
const time = new Date("2026-11-13T11:00:00+07:00")
const { page, browser, server, errors } = await boot2({ root, time, dark,
  events: ({ bkk, iso }) => [{ id: "e1", title: "Показ квартиры, Kata", start: iso(bkk(0, 14)), end: iso(bkk(0, 15)), calendar: "Работа", color: "#0A84FF" }],
  lists: ({ bkk, dk }) => ({ rems: [{ id: "ra", date: +bkk(-1, 9), u: 1, title: "Отправить договор", due: dk(bkk(0, 0)), done: false }] }) })
await page.evaluate(() => { D.onb = Object.assign(D.onb || {}, { intro: 1, seen: 1, steps: { done: 1, hide: 1 } }); D.who = "adult"; save(false) })
await page.setViewportSize({ width: 390, height: 844 })
const ok = []
const shown = sel => page.evaluate(sel => { const b = document.querySelector(sel); return !!b && getComputedStyle(b).display !== "none" && b.getBoundingClientRect().width > 0 }, sel)
for (const t of ["today", "plans", "money", "health"]) {
  await page.evaluate(t => setTab(t), t); await page.waitForTimeout(700)
  ok.push([t, await shown("#bugq")])
  if (t === "today" || t === "money") await page.screenshot({ path: `${out}/1-${t}${sfx}.png` })
}
// окно: меню «+»
await page.evaluate(() => setTab("money")); await page.waitForTimeout(300)
await page.evaluate(() => { ui.choose("Новый расход", "Выберите, как добавить", ["Голосом", "Вручную", "Фото чека"]) }); await page.waitForTimeout(700)
ok.push(["sheet", await shown("#layer .sheet .bugw")])
await page.screenshot({ path: `${out}/2-window${sfx}.png` })
// куда ведёт: перехватываем переход
const url = await page.evaluate(() => new Promise(res => {
  const b = document.querySelector("#layer .sheet .bugw")
  window.addEventListener("beforeunload", () => {}, { once: true })
  const o = Object.getOwnPropertyDescriptor(Location.prototype, "href")
  document.addEventListener("click", e => { if (e.target.closest("[data-bug]")) { e.stopImmediatePropagation(); e.preventDefault()
    // повторяем логику open() без перехода
    const sh = [...document.querySelectorAll("#layer .sheet")].pop(); res((document.body.dataset.scr) + " / " + sh.querySelector("h3").textContent) } }, { capture: true, once: true })
  b.click() }))
ok.push(["where", url])
// форма
const port = server.address().port
await page.goto(`http://localhost:${port}/bug.html?from=app&where=money&win=${encodeURIComponent("Новый расход")}`); await page.waitForTimeout(800)
await page.screenshot({ path: `${out}/3-form${sfx}.png` })
ok.push(["form", await page.evaluate(() => document.querySelector("#scr").textContent + " | " + !!document.querySelector("#rec"))])
console.log(JSON.stringify(ok))
console.log(ok.filter(x => x[1] === false).length ? "BUGQ_FAIL" : "BUGQ_OK")
console.log(errors.length ? "ERR " + errors.join("\n") : "no errors")
await browser.close(); server.close()
