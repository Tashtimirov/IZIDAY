// Видео перетаскивания блоков: «Сегодня» (привычки — наверх) и «Деньги». node tests/order_video.mjs <папка> [dark]
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2], dark = process.argv[3] === "dark"; fs.mkdirSync(out, { recursive: true })
const root = new URL("../dist/web/", import.meta.url).pathname
const time = new Date("2026-11-05T11:00:00+07:00")
const { page, browser, server, errors } = await boot2({ root, time, dark, ctxOpts: { recordVideo: { dir: out, size: { width: 780, height: 1688 } } },
  events: ({ bkk, iso }) => [
    { id: "e1", title: "Показ квартиры, Kata", start: iso(bkk(0, 14)), end: iso(bkk(0, 15)), calendar: "Работа", color: "#0A84FF", location: "Kata Beach" },
    { id: "e2", title: "Падел", start: iso(bkk(0, 19)), end: iso(bkk(0, 20, 30)), calendar: "Личное", color: "#30D158" }],
  lists: ({ bkk, dk }) => ({
    rems: [{ id: "ra", date: +bkk(-1, 9), u: 1, title: "Отправить договор", due: dk(bkk(0, 0)), done: false },
      { id: "rb", date: +bkk(-1, 9), u: 1, title: "Позвонить маме", due: dk(bkk(0, 0)), done: false }],
    water: [{ id: "w1", date: +bkk(0, 9), u: 1, ml: 750 }],
    habits: [{ id: "hz", date: +bkk(-5, 9), u: 1, title: "Зарядка" }, { id: "hy", date: +bkk(-5, 9), u: 1, title: "Чтение 20 минут" }],
    money: [{ id: "m1", date: +bkk(0, 9), u: 1, type: "expense", amount: 120, category: "Кафе и рестораны", method: "transfer", comment: "кофе" }],
  }) })
await page.evaluate(() => { D.onb = Object.assign(D.onb || {}, { intro: 1, seen: 1, steps: { done: 1, hide: 1 } }); D.who = "adult"; D.blocksHint = 1; D.gamiIntro = 0; save(false); render()
  // «палец» — полупрозрачный круг там, где касание
  const f = document.createElement("div"); f.style.cssText = "position:fixed;z-index:9999;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(120,120,120,.35);border:2px solid rgba(255,255,255,.8);box-shadow:0 2px 10px rgba(0,0,0,.25);pointer-events:none;opacity:0;transition:opacity .15s,transform .15s;transform:scale(.6)"
  document.body.append(f)
  const at = e => { const t = e.touches[0]; if (t) { f.style.left = t.clientX + "px"; f.style.top = t.clientY + "px" } }
  addEventListener("touchstart", e => { at(e); f.style.opacity = 1; f.style.transform = "scale(1)" }, { capture: true, passive: true })
  addEventListener("touchmove", at, { capture: true, passive: true })
  addEventListener("touchend", () => { f.style.opacity = 0; f.style.transform = "scale(.6)" }, { capture: true, passive: true }) })
const cdp = await page.context().newCDPSession(page)
const T = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] })
const W = ms => page.waitForTimeout(ms)
const box = s => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width * .6, y: r.top + 22 } }, s)
async function drag(sel, toY, ms = 1100, pre) {
  if (pre) { await page.evaluate(([s, b]) => document.querySelector(s).scrollIntoView({ block: b, behavior: "smooth" }), [sel, pre]); await W(700) }
  const a = await box(sel)
  await T("touchStart", a.x, a.y); await W(700)
  const n = Math.round(ms / 25)
  for (let i = 1; i <= n; i++) { const k = i / n, e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; await T("touchMove", a.x + Math.sin(k * 3) * 6, a.y + (toY - a.y) * e); await W(25) }
  await W(sel.includes("Куда") ? 1200 : 350); await T("touchEnd"); await W(900)
}
await page.evaluate(() => setTab("today")); await W(1500)
await page.evaluate(() => document.querySelector("#view").scrollTo({ top: 260, behavior: "smooth" })); await W(900)
await drag('#view > [data-bk="Привычки"]', 250, 1300)
await page.evaluate(() => document.querySelector("#view").scrollTo({ top: 0, behavior: "smooth" })); await W(1300)
await page.evaluate(() => setTab("money")); await W(1400)
await drag('#view > [data-bk="Куда ушли деньги"]', 200, 1500, "center")
await page.evaluate(() => document.querySelector("#view").scrollTo({ top: 0, behavior: "smooth" })); await W(1600)
console.log(errors.length ? "ERR " + errors.join("\n") : "no errors")
const v = page.video(); await page.context().close(); fs.renameSync(await v.path(), `${out}/raw${dark ? "-dark" : ""}.webm`)
await browser.close(); server.close()
