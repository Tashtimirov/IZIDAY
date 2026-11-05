// Память Изи и сейф (src/web/mem.js): шифрование в таблицу, Face ID (виртуальный passkey с PRF), код восстановления,
// сокровенное, запрет паролей и карт, журнал с отменой, ключ рутины в свойствах скрипта.
// Запуск: python3 build.py && python3 build_web.py --no-minify && node tests/mem_test.mjs [папка для скриншотов]
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const ROOT = new URL("../dist/web/", import.meta.url).pathname
const OUT = process.argv[2] || ""
if (OUT) fs.mkdirSync(OUT, { recursive: true })
let fail = 0
const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fail++ }
const time = new Date("2026-11-05T09:30:00+07:00")
const facts = [["Жена — Оля, любит том ям и пионы", 0, "family", "Оля"], ["Сын ходит на плавание по средам", 1, "family"], ["Продаёт виллы на Пхукете, клиенты из России", 2, "work"], ["Хочет 10 сделок в квартале", 3, "goals"]]
const { page, browser, server, errors, sheet } = await boot2({ root: ROOT, time,
  lists: () => ({ memory: facts.map(([t, i, sphere, person]) => ({ id: "k" + i, date: +time - (10 - i) * 864e5, u: +time - 1e6, kind: "fact", text: t, sphere, person })) }) })
const ctx = page.context()
const cdp = await ctx.newCDPSession(page)
await cdp.send("WebAuthn.enable")
await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true } })
const SECRET = "s".repeat(32)
const hubMem = () => sheet.post({ secret: SECRET, hub: { from: "widget", since: 0 } }).lists.memory
const sheetText = name => JSON.stringify((sheet.ss.getSheetByName(name) || { cells: [] }).cells)
const snap = async (name, sel = ".sheet:last-of-type") => { if (!OUT) return; await page.waitForTimeout(450); const el = page.locator(sel).last(); await el.evaluate(e => { e.style.maxHeight = "none" }); await el.screenshot({ path: `${OUT}/${name}.png` }) }

ok((await page.evaluate(() => memAll().length)) === 4, "старые факты видны")
ok(sheetText("Память помощника").includes("пионы"), "до сейфа текст в таблице открыт")

// 1. Включить сейф
await page.evaluate(() => DO.memory()); await page.waitForTimeout(500)
await snap("1-know-before")
await page.click('.sheet [data-a="setup"]'); await page.waitForTimeout(400)
const code = (await page.locator(".mm-code").last().innerText()).replace(/\s+/g, "-")
ok(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){5}$/.test(code), "код восстановления 24 знака: " + code.replace(/[A-Z0-9]/g, "•"))
await snap("2-setup")
await page.click('.sheet [data-a="go"]'); await page.waitForTimeout(4000)
const m = await page.evaluate(() => { const r = D.memory.find(x => x.kind === "vault"); return r && r.meta })
ok(m && m.rc && m.pub, "сейф создан: обёртка кодом и открытый ключ")
ok(m && m.pk && m.pk.id, "Face ID (passkey с PRF) подключён")
await page.evaluate(() => { document.querySelectorAll(".sheet").forEach(() => stack.length && stack[stack.length - 1].close()) }); await page.waitForTimeout(400)
await page.evaluate(() => sync()); await page.waitForTimeout(1500)
const hm = hubMem()
ok(!JSON.stringify(hm).includes("пионы") && hm.some(x => String(x.sealed || "").startsWith("d1:")), "в _hub таблицы — только шифр d1:")
ok(!sheetText("Память помощника").includes("пионы") && sheetText("Память помощника").includes("зашифровано"), "на листе «Память помощника» текст заменён пометкой")
ok((await page.evaluate(() => memAll().length)) === 4, "на телефоне Изи по-прежнему читает все факты")

// 2. Сокровенное: записать можно без Face ID, прочитать — только после
const r1 = await page.evaluate(() => runTool("remember", { text: "Поссорился с Сергеем из-за сделки, после встреч с ним выбит из колеи", sphere: "friends", person: "Сергей", secret: true }))
ok(r1.ok, "сокровенный факт записан")
await page.evaluate(() => vault.lock())
const rec = await page.evaluate(id => D.memory.find(x => x.id === id), r1.id)
ok(rec.secret && rec.sealed.startsWith("v1:") && !rec.text, "на телефоне сокровенное тоже шифром v1:")
ok(!(await page.evaluate(() => memAll().some(f => f.secret))), "закрыто — Изи сокровенное не видит")
ok((await page.evaluate(() => memoryBlock())).includes("open_secret"), "в памяти разговора — подсказка про open_secret")
await page.evaluate(() => { window._open = vault.open() }); await page.waitForTimeout(500)
await snap("3-unlock")
await page.click('.sheet [data-a="face"]'); await page.waitForTimeout(2500)
ok(await page.evaluate(() => vault.isOpen()), "открыто по Face ID")
ok((await page.evaluate(() => memAll().filter(f => f.secret).map(f => f.text))).join().includes("Сергеем"), "после Face ID сокровенное читается")
const sealedStr = await page.evaluate(() => vault.seal({ text: "дневник: тяжёлый день" }))
ok(sealedStr.startsWith("v1:") && (await page.evaluate(s => vault.unseal(s), sealedStr)).text === "дневник: тяжёлый день", "API vault.seal/unseal для дневника")

// 3. Пароли и карты не запоминаются
const p1 = await page.evaluate(() => runTool("remember", { text: "Пароль от банка 4471-Kata", sphere: "money" }))
const p2 = await page.evaluate(() => runTool("remember", { text: "Карта 4111 1111 1111 1111 до 09/28", sphere: "money" }))
ok(p1.error && p2.error, "пароль и номер карты отклонены")
ok(!(await page.evaluate(() => JSON.stringify(D.memory))).includes("4471"), "пароля нет в памяти")

// 4. Журнал и отмена
await page.evaluate(() => runTool("add_water", { ml: 300 }))
const w1 = await page.evaluate(() => live(D.water).length)
const j = await page.evaluate(() => live(D.log).filter(x => x.text && /вод/i.test(x.text)).pop())
ok(j && /вод/i.test(j.text) && j.undo && j.undo.length, "журнал: «Записал воду» с отменой")
await page.evaluate(() => DO.journal()); await page.waitForTimeout(400)
await snap("5-journal")
await page.click(`.sheet [data-undo="${j.id}"]`); await page.waitForTimeout(400)
ok((await page.evaluate(() => live(D.water).length)) === w1 - 1, "«Отменить» убрала запись воды")
ok((await page.evaluate(() => D.log.some(x => x.text && /Отказался запомнить/.test(x.text)))), "отказ запомнить пароль — в журнале")
await page.evaluate(() => stack.slice().reverse().forEach(s => s.close())); await page.waitForTimeout(300)
await page.evaluate(() => sync()); await page.waitForTimeout(1500)
ok(sheetText("Журнал").includes("зашифровано") && !sheetText("Журнал").includes("воду"), "лист «Журнал» в таблице — шифр")

// 5. Подборка памяти по теме и «взял с собой»
await page.evaluate(() => { D.chat.push({ role: "user", text: "Что подарить Оле на годовщину?", at: Date.now() }); memoryBlock() })
ok((await page.evaluate(() => memUsed())).includes("Оля") && !(await page.evaluate(() => memUsed())).includes("сокровенное"), "по теме взята карточка: " + (await page.evaluate(() => memUsed().join(", "))))

// 6. Экран «Что Изи знает» и «Безопасность»
await page.evaluate(() => DO.memory()); await page.waitForTimeout(600)
await snap("4-know")
await page.evaluate(() => DO.security()); await page.waitForTimeout(400)
await snap("6-security")
await page.evaluate(() => stack.slice().reverse().forEach(s => s.close()))

// 7. Новое устройство: ключа нет — память шифром; открыть кодом восстановления
const page2 = await ctx.browser().newContext({ viewport: { width: 390, height: 844 }, isMobile: true, locale: "ru-RU" }).then(c => c.newPage())
await page2.route("https://script.google.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(sheet.post(r.request().postData())) }))
await page2.route("https://api.anthropic.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" }, body: JSON.stringify({ content: [{ type: "text", text: "{}" }] }) }))
const setup = await page.evaluate(() => btoa(unescape(encodeURIComponent(JSON.stringify(Object.assign({ v: 1 }, D.conn))))))
await page2.goto(page.url().split("#")[0] + "#setup=" + encodeURIComponent(setup)); await page2.waitForTimeout(1500)
await page2.evaluate(() => sync()); await page2.waitForTimeout(2000)
ok(await page2.evaluate(() => vault.isOn() && memAll().length === 0 && D.memory.some(x => x.sealed)), "новое устройство: сейф есть, факты пока шифром")
await page2.evaluate(() => { window._o = vault.open() }); await page2.waitForTimeout(500)
await page2.fill(".sheet #mm-code", code.toLowerCase().replace(/-/g, " ")); await page2.click('.sheet [data-a="code"]'); await page2.waitForTimeout(4000)
ok(await page2.evaluate(() => memAll().length >= 5 && memAll().some(f => /пионы/.test(f.text)) && memAll().some(f => f.secret)), "код восстановления вернул всю память, включая сокровенное")
ok((await page2.evaluate(s => vault.unseal(s).then(x => x.text).catch(() => ""), sealedStr)) === "дневник: тяжёлый день", "второе устройство читает шифр первого")

// 8. Ключ рутины: в таблице, а не в телефоне
const f0 = sheet.post({ secret: SECRET, hub: { from: "app", since: Date.now(), fire: { url: "https://api.anthropic.com/v1/claude_code/routines/trig_TEST01/fire", text: "x" } } }).fire
ok(f0 && /ROUTES/.test(f0.error || ""), "без ключа в свойствах скрипта задача не уходит")
sheet.props.ROUTES = JSON.stringify([{ name: "Личное", url: "https://api.anthropic.com/v1/claude_code/routines/trig_TEST01/fire", token: "tok" }])
const f1 = sheet.post({ secret: SECRET, hub: { from: "app", since: Date.now(), fire: { url: "https://api.anthropic.com/v1/claude_code/routines/trig_TEST01/fire", text: "x" } } }).fire
ok(f1 && f1.ok && f1.session_url, "ключ из свойств скрипта — задача ушла")
ok(!(await page.evaluate(() => JSON.stringify(D.conn.routes || []))).includes("token"), "в приложении ключей рутин нет")

const errs = errors.filter(e => !/favicon|404|ERR_|net::/.test(e))
ok(!errs.length, "без ошибок на странице" + (errs.length ? ": " + errs.slice(0, 3).join(" | ") : ""))
await browser.close(); server.close()
console.log(fail ? `MEM_FAIL ${fail}` : "MEM_OK")
