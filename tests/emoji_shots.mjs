// Снимки «иконки вместо смайликов»: чат, меню «Добавить», память, привычки. node tests/emoji_shots.mjs <папка> [dark] [корень dist/web]
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const dark = process.argv[3] === "dark", sfx = dark ? "-dark" : ""
const root = process.argv[4] || new URL("../dist/web/", import.meta.url).pathname
const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-05T03:00:00Z"), dark })
await page.waitForTimeout(800)
const shot = async n => { await page.waitForTimeout(600); await page.screenshot({ path: `${out}/${n}${sfx}.png` }) }
const closeAll = async () => { await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(400) }
await page.evaluate(() => {
  D.chat = [
    { role: "user", text: "☀️ Утренняя сводка", prompt: "x", at: Date.now() - 900e3 },
    { role: "assistant", text: "Сегодня: в 11:00 показ виллы, в 19:00 падел. Выпейте воды — пока 0,5 л из 2,5.", at: Date.now() - 890e3 },
    { role: "user", text: "что у меня вечером?", at: Date.now() - 600e3, voice: true },
    { role: "assistant", text: "В 19:00 падел в Padel Club, ехать 25 минут — выезжайте в 18:30.", at: Date.now() - 590e3 },
    { role: "user", text: "📄 bill.pdf", at: Date.now() - 300e3 },
    { role: "assistant", text: "Задачу передал в Claude Code.", at: Date.now() - 290e3, links: ["https://claude.ai/code/x"] },
  ]
  setTab("chat")
})
await shot("1-chat")
await page.evaluate(() => { addMenu() }); await shot("2-add-menu"); await closeAll()
await page.evaluate(() => { D.memory = [{ id: "m1", date: Date.now(), text: "Любит падел по вечерам" }]; save(false); typeof memoryMenu === "function" ? memoryMenu() : document.querySelector('[data-do="memory"]').click() })
await shot("3-memory"); await closeAll()
await page.evaluate(() => { D.habits = [{ id: "h1", date: Date.now() - 5 * 864e5, title: "Зарядка", ico: "activity", emoji: "🏃" }, { id: "h2", date: Date.now(), title: "Чтение", emoji: "📖" }, { id: "h3", date: Date.now(), title: "Без сладкого", emoji: "🍬", bad: true }]; save(false); setTab("plans") })
await page.waitForTimeout(500)
await page.evaluate(() => { const h = [...document.querySelectorAll(".card h2")].find(x => /Привычки/.test(x.textContent)); if (h) h.scrollIntoView({ block: "start" }) })
await page.evaluate(() => toast("🔥 5 дней подряд"))
await shot("4-habits-toast")
console.log("errors", errors)
await browser.close(); server.close()
