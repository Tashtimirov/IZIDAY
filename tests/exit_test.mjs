// «Выйти из IZIDAY» (exit.js) и «Стоп»/«Закрыть» в детском чате с Изи. Снимки — build/web-shots/exit-*
// Взрослый со своим виджетом, взрослый без входа (только телефон), ребёнок в семье; светлая и тёмная темы.
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const time = new Date("2026-11-05T11:00:00+07:00")
const shotEl = async (page, sel, file) => { await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: "center" }), sel); await page.waitForTimeout(350); await page.screenshot({ path: SHOTS + file }) }
const sheetShot = async (page, file) => { await page.waitForTimeout(450); await page.screenshot({ path: SHOTS + file }) }

for (const dark of [false, true]) {
  const T = dark ? "-dark" : ""
  const { page, browser, server, errors, sheet } = await boot2({ root, time, dark })
  // 1) взрослый со своим виджетом
  await page.evaluate(() => { setTab("more"); render() }); await page.waitForTimeout(300)
  const c1 = await page.evaluate(() => ({ card: !!$(".exit-card"), btn: ($(".exit-card .exit-btn") || {}).textContent, mode: EXIT.mode(), last: [...$$("#view .card")].pop().classList.contains("exit-card") }))
  check(c1.card && /Выйти из IZIDAY/.test(c1.btn) && c1.mode === "widget" && c1.last, "в Настройках внизу карточка «Выход» с кнопкой «Выйти из IZIDAY»", c1)
  await shotEl(page, ".exit-card", `exit-1-settings${T}.png`)
  await page.click(".exit-card .exit-btn")
  check(await page.evaluate(() => /таблице и в виджете/.test($(".sheet").textContent)), "виджет: объясняем, что записи останутся в таблице")
  await sheetShot(page, `exit-2-confirm${T}.png`)
  await page.click('.sheet [data-b="Отмена"]'); await page.waitForTimeout(350)
  check(await page.evaluate(() => !!D.conn), "«Отмена» — ничего не стёрто")
  // старая красная «Выйти» в «Связи с виджетом» ведёт туда же
  await page.click('[data-do="disconnect"]'); await page.waitForTimeout(350)
  await page.click('.sheet [data-b="Выйти"]'); await page.waitForTimeout(800)
  const c2 = await page.evaluate(() => ({ conn: D.conn, store: localStorage.getItem("myday.web"), tab, onb: !!document.querySelector(".onb, #onb, .ob") }))
  check(!c2.conn && c2.tab === "today", "вышли: ключей нет, открыт «Сегодня»", c2)

  // 2) взрослый без входа: записи только на телефоне — предупреждаем и стираем после второго «да»
  await page.evaluate(() => { D.onb = { intro: 1, steps: {}, tips: {} }; D.who = "adult"; D.money.push({ id: "m-x", u: Date.now(), date: Date.now(), type: "expense", amount: 120, category: "Кафе и рестораны", note: "кофе" }); FRIEND.on = () => true; save(false); setTab("more"); render() })
  await page.waitForTimeout(300)
  check(await page.evaluate(() => EXIT.mode() === "local" && /только на этом телефоне/.test($(".exit-card").textContent)), "без входа: карточка говорит, что записи только на телефоне")
  await shotEl(page, ".exit-card", `exit-3-local${T}.png`)
  await page.click(".exit-card .exit-btn")
  check(await page.evaluate(() => /сотрутся/.test($(".sheet").textContent)), "без входа: предупреждение, что записи сотрутся")
  await sheetShot(page, `exit-4-local-confirm${T}.png`)
  await page.click('.sheet [data-b="Выйти и стереть"]'); await page.waitForTimeout(450)
  await sheetShot(page, `exit-5-local-sure${T}.png`)
  await page.click('.sheet [data-b="Стереть"]'); await page.waitForTimeout(800)
  check(await page.evaluate(() => !D.money.length && !D.who), "после второго «да» телефон чистый")

  // 3) ребёнок в семье: взрослый (заново подключён) создаёт семью и ребёнка, ребёнок входит по ссылке
  if (!dark) {
    const SECRET = "s".repeat(32)
    const setup = await page.evaluate(() => 0)
    await page.goto(page.url()); await page.waitForTimeout(300)
    await page.evaluate(s => connect(s), Buffer.from(JSON.stringify({ v: 1, hook: "https://script.google.com/macros/s/TEST/exec", secret: SECRET, key: "sk-test", routes: [], cfg: { currency: "฿" } })).toString("base64"))
    await page.waitForTimeout(1500)
    const ask = async v => { await page.waitForSelector("#ask-v"); await page.fill("#ask-v", String(v)); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(350) }
    await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close(); setTab("plans"); plansF = "fam"; render() }); await page.waitForTimeout(300)
    await page.click('[data-f="new"]'); await ask("Папа"); await ask("Семья"); await page.waitForTimeout(600)
    // после создания семьи один раз открывается «Что делим с семьёй» — закрываем, как сделал бы человек
    await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close(); D.fam.shareAsked = 1; render() }); await page.waitForTimeout(300)
    await page.click('[data-f="kid"]'); await ask("Миша"); await ask(9); await page.waitForTimeout(600)
    await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
    const kidId = await page.evaluate(() => Object.entries(D.fam.data.members).find(([, m]) => m.name === "Миша")[0])
    await page.evaluate(k => { FAM.put("tasks", { id: "t1", kid: k, title: "Почистить зубы", stars: 5, when: "утро", days: [] }); FAM.put("tasks", { id: "t2", kid: k, title: "Собрать рюкзак", stars: 5, days: [] }); return FAM.push(true) }, kidId)
    const link = await page.evaluate(id => FAM.link(Object.assign({ id }, D.fam.data.members[id])), kidId)
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", timezoneId: "Asia/Bangkok" })
    const kp = await ctx2.newPage(); const kerr = []
    kp.on("pageerror", e => kerr.push(String(e)))
    await kp.clock.setFixedTime(time)
    await kp.route("https://script.google.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(sheet.post(r.request().postData())) }))
    await kp.goto(link.replace(/^https?:\/\/[^/]+\//, page.url().replace(/#.*$/, "").replace(/[^/]*$/, "")))
    await kp.waitForTimeout(2200)
    check(await kp.evaluate(() => FAM.kidMode() && !!$(".kout")), "детский «Мой день»: внизу «Выйти из IZIDAY»")
    await kp.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await kp.waitForTimeout(300)
    await kp.screenshot({ path: SHOTS + "exit-6-kid-day.png" })
    // чат с Изи: «Закрыть» всегда, «Стоп» — пока Изи говорит или слушает
    await kp.click('#knav [data-kt="izi"]'); await kp.waitForTimeout(500)
    check(await kp.evaluate(() => !!$(".kclose") && $(".kstop").hidden), "в детском чате есть «Закрыть», «Стоп» спрятан, пока тихо")
    await kp.evaluate(() => { TTS.speaking = true }); await kp.waitForTimeout(400)
    check(await kp.evaluate(() => !$(".kstop").hidden), "Изи говорит — видна кнопка «Стоп»")
    await kp.screenshot({ path: SHOTS + "exit-7-kid-stop.png" })
    await kp.click(".kstop"); await kp.waitForTimeout(400)
    check(await kp.evaluate(() => !TTS.speaking && $(".kstop").hidden), "«Стоп» замолкает Изи")
    await kp.evaluate(() => { TTS.speaking = true }); await kp.waitForTimeout(300)
    await kp.click(".kclose"); await kp.waitForTimeout(500)
    check(await kp.evaluate(() => !stack.length && !TTS.speaking), "«Закрыть» убирает окно и обрывает голос")
    // выход ребёнка
    await kp.click(".kout"); await kp.waitForTimeout(450)
    check(await kp.evaluate(() => /попроси маму или папу/.test($(".sheet").textContent)), "ребёнку объясняем, как вернуться: шар Изи у родителей")
    await kp.screenshot({ path: SHOTS + "exit-8-kid-confirm.png" })
    await kp.click('.sheet [data-b="Выйти"]'); await kp.waitForTimeout(900)
    check(await kp.evaluate(() => !FAM.kidMode() && !D.fam && !$("#knav") && !document.body.classList.contains("kidm")), "ребёнок вышел: детский режим снят, семьи на телефоне нет")
    check(await page.evaluate(k => !!D.fam.data.members[k], kidId), "в семье ребёнок остался (звёзды не пропали)")
    await kp.screenshot({ path: SHOTS + "exit-9-after.png" })
    check(!kerr.length, "у ребёнка без ошибок", kerr)
  }
  check(!errors.filter(e => !/favicon|Failed to load resource/.test(e)).length, "без ошибок на странице", errors)
  await browser.close(); server.close()
}
console.log(ok ? "EXIT_OK" : "EXIT_FAIL")
process.exit(0)
