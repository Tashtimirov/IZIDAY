// Снимки экранов для треда «Поправить экраны и тексты до теста»: владелец и друг-новичок, светлая и тёмная тема
import { boot2, shot } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const only = process.argv[3] ? process.argv[3].split(",") : null
const root = new URL("../dist/web/", import.meta.url).pathname
const all = []
for (const dark of [false, true]) for (const who of ["owner", "friend"]) {
  const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-14T03:00:00Z"), dark })
  if (who === "friend") await page.evaluate(() => { D.conn.friend = { email: "masha@example.com", name: "Маша" }; save(false); render() })
  for (const t of ["today", "plans", "chat", "money", "health", "more"]) {
    if (only && !only.includes(t)) continue
    await page.evaluate(t => { setTab(t); window.scrollTo(0, 0) }, t); await page.waitForTimeout(500)
    await shot(page, `${out}/${who}-${t}${dark ? "-dark" : ""}.png`)
  }
  all.push(...errors.map(e => `${who}${dark ? "/dark" : ""}: ${e}`))
  await browser.close(); server.close()
}
console.log(all.length ? "errors: " + all.join(" | ") : "SHOTS_OK")
