// Снимки иконки «Сообщить о недочёте» в шапке «Сегодня» (и её отсутствия на других вкладках). node tests/bugq_shots.mjs <папка> [dark] [en]
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const dark = process.argv[3] === "dark", en = process.argv.includes("en"), sfx = (dark ? "-dark" : "-light") + (en ? "-en" : "")
const root = new URL("../dist/web/", import.meta.url).pathname
const time = new Date("2026-11-13T11:00:00+07:00")
const { page, browser, server, errors } = await boot2({ root, time, dark,
  events: ({ bkk, iso }) => [{ id: "e1", title: "Показ квартиры, Kata", start: iso(bkk(0, 14)), end: iso(bkk(0, 15)), calendar: "Работа", color: "#0A84FF" }],
  lists: ({ bkk, dk }) => ({ rems: [{ id: "ra", date: +bkk(-1, 9), u: 1, title: "Отправить договор", due: dk(bkk(0, 0)), done: false }] }) })
await page.evaluate(() => { D.onb = Object.assign(D.onb || {}, { intro: 1, seen: 1, steps: { done: 1, hide: 1 } }); D.who = "adult"; save(false) })
await page.setViewportSize({ width: 390, height: 844 })
await page.evaluate(() => setTab("today")); await page.waitForTimeout(900)
await page.screenshot({ path: `${out}/1-today${sfx}.png` })
const vis = t => page.evaluate(t => { setTab(t); const b = document.querySelector("#bugq"); return b && getComputedStyle(b).display !== "none" }, t)
const r = { today: await vis("today"), money: await vis("money"), plans: await vis("plans") }
await page.waitForTimeout(600); await page.screenshot({ path: `${out}/2-plans${sfx}.png` })
await vis("today"); await page.waitForTimeout(300)
const href = await page.evaluate(() => new Promise(res => { const o = window.IZIBUG.open; let u = null
  Object.defineProperty(window, "__go", { value: 1 }); const a = location.href
  document.addEventListener("click", e => { if (e.target.closest("[data-bug]")) { e.stopImmediatePropagation(); e.preventDefault(); res("ok") } }, { capture: true, once: true })
  document.querySelector("#bugq").click() }))
const lbl = await page.evaluate(() => document.querySelector("#bugq").textContent)
console.log(JSON.stringify(r), href, lbl)
console.log(r.today && !r.money && !r.plans ? "BUGQ_OK" : "BUGQ_FAIL")
console.log(errors.length ? "ERR " + errors.join("\n") : "no errors")
await browser.close(); server.close()
