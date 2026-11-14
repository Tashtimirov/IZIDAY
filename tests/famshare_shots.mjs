// «Что делим с семьёй»: без семьи ничего общего не видно; после входа в семью — один раз выбор, всё выключено.
// Снимки — build/web-shots/fs-*  (--dark — тёмная тема)
import fs from "fs"
import { boot2, shot } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const DARK = process.argv.includes("--dark"), sfx = DARK ? "-dark" : ""
const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-05T03:11:00Z"), dark: DARK })
const closeAll = async () => { await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(400) }
// 1. «Деньги» без семьи
await page.evaluate(() => { setTab("money"); render() }); await page.waitForTimeout(800)
check(!(await page.$("[data-mv]")) && !/Общие с/.test(await page.textContent("#view")), "«Деньги» без семьи: нет «Общие с …»")
await shot(page, SHOTS + `fs-1-money-nofam${sfx}.png`)
await page.click('[data-do="mn-family"]'); await page.waitForTimeout(500)
check(/только по вашему выбору/.test(await page.textContent(".sheet")), "«Деньги → Семья» без семьи объясняет и ведёт к семье")
await shot(page, SHOTS + `fs-2-money-family-btn${sfx}.png`, ".sheet")
await closeAll()
// 2. создать семью → один раз «Что делим с семьёй»
const ask = async v => { await page.waitForSelector("#ask-v"); await page.fill("#ask-v", String(v)); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(350) }
await page.evaluate(() => { setTab("plans"); plansF = "fam"; render() }); await page.waitForTimeout(300)
await page.click('[data-f="new"]'); await ask("Ильдар"); await ask("Таштимировы"); await page.waitForTimeout(900)
check(/Что делим с семьёй/.test(await page.textContent(".sheet")) && (await page.$$(".sheet [data-fsh] .tgl.on")).length === 0, "после создания семьи — выбор, всё выключено")
await shot(page, SHOTS + `fs-3-share-sheet${sfx}.png`, ".sheet")
await page.click('.sheet [data-fsh="money"]'); await page.waitForTimeout(250)
await shot(page, SHOTS + `fs-4-share-money-on${sfx}.png`, ".sheet")
await closeAll()
// 3. карточка в «Семье»
await page.evaluate(() => { const c = document.querySelector(".fshare"); if (c) c.scrollIntoView({ block: "center" }) }); await page.waitForTimeout(400)
await shot(page, SHOTS + `fs-5-family-card${sfx}.png`)
// 4. «Деньги» с общим бюджетом
await page.evaluate(() => { setTab("money"); render(); window.scrollTo(0, 0) }); await page.waitForTimeout(800)
check(!!(await page.$('[data-mv="shared"]')), "после включения — «Все / Мои / Общие»")
await page.evaluate(() => { const c = document.querySelector(".mn-seg"); if (c) c.scrollIntoView({ block: "center" }) }); await page.waitForTimeout(300)
await shot(page, SHOTS + `fs-6-money-shared${sfx}.png`)
check(!errors.length, "без ошибок в консоли", errors.slice(0, 3))
await browser.close(); server.close()
console.log(ok ? "FAMSHARE_OK" : "FAMSHARE_FAIL")
