// Снимки итоговой сборки stable: «Планы» одним списком и подстраница, карточка сбоя раздела, «Нашли недочёт?» в Настройках
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-11T05:00:00Z") })
const shot = async n => { await page.waitForTimeout(450); await page.screenshot({ path: `${out}/${n}.png` }) }
await page.evaluate(() => { setTab("plans"); plansF = "all"; render() }); await shot("s1-plany-vse")
await page.evaluate(() => { plansF = "habits"; render(); $("#view").scrollTop = 0 }); await shot("s2-plany-podstranica")
await page.evaluate(() => { window._rt = renderMoney; renderMoney = () => { throw new Error("Cannot read properties of undefined (reading 'amount')") }; setTab("money") }); await shot("s3-sboj-razdela")
await page.evaluate(() => { renderMoney = window._rt; setTab("more"); $("#view").scrollTop = 0 }); await shot("s4-nastrojki-nedochet")
console.log(errors.length ? "errors: " + errors.join(" | ") : "SHOTS_OK")
await browser.close(); server.close()
