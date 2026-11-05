// Android (Chrome): установка, кнопка «Назад», высота окна, тексты без «Safari»
import { boot2 } from "./today_boot.mjs"
import path from "path"; import fs from "fs"
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../dist/web")
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
const out = process.argv[2]
const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-05T10:00:00+07:00"), h: 851, ctxOpts: { userAgent: UA, viewport: { width: 412, height: 851 }, deviceScaleFactor: 1 } })
let fail = 0
const ok = (c, m) => { console.log((c ? "   ✓ " : "   ✗ ") + m); if (!c) fail++ }
const st = () => page.evaluate(() => ({ tab, sheets: stack.length }))
ok(await page.evaluate(() => IS_DROID && !IS_IOS), "Android распознан")
// manifest
const m = JSON.parse(fs.readFileSync(root + "/manifest.webmanifest", "utf8"))
ok(m.id && m.icons.some(i => i.purpose === "maskable" && i.sizes === "512x512"), "manifest: id и значок maskable 512")
// высота: на Android окно не растягивается под screen.height
ok(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-h")) === innerHeight), "высота окна = innerHeight")
// «Назад»: окно → закрыто
await page.mouse.click(5, 300); await page.waitForTimeout(500)
await page.evaluate(() => { ui.info("Тест", "окно") }); await page.waitForTimeout(400)
ok((await st()).sheets === 1, "окно открыто")
await page.goBack(); await page.waitForTimeout(600)
ok((await st()).sheets === 0, "«Назад» закрыл окно")
// вкладка → «Сегодня»
await page.click('[data-tab="money"]'); await page.waitForTimeout(500)
await page.goBack(); await page.waitForTimeout(600)
ok((await st()).tab === "today", "«Назад» вернул на «Сегодня»")
ok(page.url().startsWith("http://localhost"), "приложение не закрылось")
// установка: баннер Android и кнопка после beforeinstallprompt
await page.evaluate(() => setTab("more")); await page.waitForTimeout(500)
let txt = await page.locator("#view").innerText()
ok(/Установите приложение/.test(txt), "баннер установки для Chrome")
await page.evaluate(() => { const e = new Event("beforeinstallprompt", { cancelable: true }); e.prompt = () => { window.__prompted = 1 }; e.userChoice = Promise.resolve({ outcome: "accepted" }); dispatchEvent(e) })
await page.waitForTimeout(400)
if (out) await page.screenshot({ path: out + "/android-install.png" })
const btn = page.locator('[data-do="install"]')
ok(await btn.count() === 1, "кнопка «Установить IZIDAY»")
await btn.click(); await page.waitForTimeout(300)
ok(await page.evaluate(() => window.__prompted === 1), "кнопка вызывает установку Chrome")
await page.evaluate(() => setTab("today")); await page.waitForTimeout(600)
if (out) await page.screenshot({ path: out + "/android-today.png" })
ok(!errors.length, "без ошибок" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""))
await browser.close(); server.close()
console.log(fail ? "ANDROID_FAIL " + fail : "ANDROID_OK")
