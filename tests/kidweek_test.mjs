// Неделя ребёнка: календарь на 7 дней вперёд, уроки по дням (взрослый заполняет в «Уроки»), кружки и общие дела семьи.
// Снимки — build/web-shots/kw-*
import fs from "fs"
import { boot2, shot } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const DARK = process.argv.includes("--dark")
const { page, browser, server, errors, sheet } = await boot2({ root, time: new Date("2026-11-16T11:30:00Z"), dark: DARK, events: () => [] })   // пн 18:30 по Бангкоку
await page.waitForTimeout(600)
const ask = async v => { await page.waitForSelector("#ask-v"); await page.fill("#ask-v", String(v)); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(350) }
const closeAll = () => page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
await page.evaluate(() => { setTab("plans"); plansF = "fam"; render() }); await page.waitForTimeout(200)
await page.click('[data-f="new"]'); await ask("Ильдар"); await ask("Таштимировы"); await page.waitForTimeout(600)
await closeAll(); await page.waitForTimeout(300); await page.evaluate(() => { D.fam.share = Object.assign({}, D.fam.share, { cal: 1 }); save(false); render() })
await page.click('[data-f="kid"]'); await ask("Миша"); await ask(9); await page.waitForTimeout(600); await closeAll(); await page.waitForTimeout(300)
const kid = await page.evaluate(() => FAM.members().find(m => m.name === "Миша").id)

// взрослый: «Календарь семьи» → «Уроки детей»
await page.evaluate(() => { setTab("cal"); calStart = null; render() }); await page.waitForTimeout(600)
await page.click('[data-do="cal-fam"]'); await page.waitForTimeout(400)
check(await page.$('.sheet [data-a="les"]'), "в «Календаре семьи» есть кнопка «Уроки детей»")
await page.click('.sheet [data-a="les"]'); await page.waitForTimeout(500)
const L = { 1: "Математика\nРусский язык\nЧтение\nФизкультура\nОкружающий мир", 2: "Английский, Математика, Русский язык, Музыка", 3: "1. Чтение\n2. Математика\n3. Рисование\n4. Русский язык\n5. Технология",
  4: "Русский язык\nМатематика\nАнглийский\nФизкультура", 5: "Чтение\nОкружающий мир\nМатематика" }
for (const [d, t] of Object.entries(L)) await page.fill(`.lsday[data-d="${d}"] .ls-l`, t)
await page.fill('.lsday[data-d="2"] .ls-x', "форма на физкультуру, кроссовки")
await page.fill('.lsday[data-d="1"] .ls-t', "08:00")
await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(600)
await page.evaluate(() => FAM.lessonsForm()); await page.waitForTimeout(500)
await shot(page, SHOTS + `kw-3-lessons${DARK ? "-dark" : ""}.png`, ".sheet")
await closeAll(); await page.waitForTimeout(300)
const evs = await page.evaluate(() => FAM.L("events").filter(x => x.kind === "school"))
check(evs.length === 5 && evs.find(x => x.days[0] === 3).lessons[0] === "Чтение" && evs.find(x => x.days[0] === 2).lessons.length === 4 && evs.find(x => x.days[0] === 2).take, "уроки сохранены по дням: номера и запятые убраны, «не забыть» на месте", evs.map(x => [x.days, x.lessons]))
check(evs.every(x => JSON.stringify(x).length < 2000), "каждая запись влезает в лимит таблицы семьи (2000 знаков)")
// кружок и общее дело
await page.evaluate(k => { const t = new Date(), kk = i => dayKey(addDays(t, i))
  FAM.put("events", { id: "f1", title: "Плавание", who: k, days: [2, 4], time: "16:00", min: 60, take: "очки", by: FAM.meId() })
  FAM.put("events", { id: "f2", title: "Ужин у бабушки", who: "fam", day: kk(3), time: "18:00", min: 90, by: FAM.meId() })
  FAM.put("tasks", { id: "t1", kid: k, title: "Почистить зубы", stars: 5, days: [] }); FAM.put("tasks", { id: "t2", kid: k, title: "Собрать рюкзак", stars: 5, days: [] })
  return FAM.push(true) }, kid)
await page.waitForTimeout(600)
const code = await page.evaluate(() => D.fam.code)
const r = sheet.post(JSON.stringify({ family: { op: "put", code, id: "a2", me: { name: "Алия", role: "adult" } } }))
check(r.family.events.filter(x => x.kind === "school").length === 5, "уроки дошли до таблицы семьи — их получит телефон ребёнка", r.family.events.length)
// в календаре взрослого — «Школа · Миша» со списком уроков
await closeAll(); await page.evaluate(() => { setTab("cal"); calStart = null; render() }); await page.waitForTimeout(500)
const sch = await page.evaluate(() => iphone().events.find(e => /^Школа · Миша/.test(e.title) && /Математика/.test(e.notes)))
check(sch && /1\. Математика/.test(sch.notes), "у взрослого в календаре «Школа · Миша», в заметке — список уроков", sch)

// ребёнок: «Мой день» → «Моя неделя»
await page.evaluate(k => { D.fam.id = k; D.fam.role = "kid"; D.fam.name = "Миша"; D.who = "kid"; save(false); render() }, kid); await page.waitForTimeout(700)
let t = await page.textContent("#view")
check(/Моя неделя/.test(t) && /Расписание на сегодня/.test(t) && /Математика/.test(t) && /Окружающий мир/.test(t) && /5 уроков/.test(t), "у ребёнка — «Моя неделя», сегодня 5 уроков", t.slice(0, 400))
check(await page.$$eval(".kwd", l => l.length) === 7, "7 дней вперёд")
for (const id of ["t1", "t2"]) { await page.click(`[data-ktask="${id}"]`); await page.waitForTimeout(300) }
t = await page.textContent(".kbub")
check(/Завтра 4 урока с 08:00/.test(t) && /рюкзак/.test(t), "вечером, когда дела сделаны, Изи напоминает про завтрашние уроки и рюкзак", t)
await page.evaluate(() => document.querySelector(".kweek").scrollIntoView({ block: "start" })); await page.evaluate(() => window.scrollBy(0, -120))
await page.waitForTimeout(5000)
await shot(page, SHOTS + `kw-1-today.png`)
await page.click('[data-kwd="1"]'); await page.waitForTimeout(500)
t = await page.textContent(".kweek")
check(/на завтра/.test(t) && /Английский/.test(t) && /Плавание/.test(t) && /Собери с вечера/.test(t) && /форма на физкультуру/.test(t) && /очки/.test(t), "завтра: уроки, плавание и «Собери с вечера»", t)
await page.evaluate(() => document.querySelector(".kweek").scrollIntoView({ block: "start" })); await page.evaluate(() => window.scrollBy(0, -16)); await page.waitForTimeout(500)
await shot(page, SHOTS + `kw-2-tomorrow.png`)
await page.click('[data-kwd="5"]'); await page.waitForTimeout(400)
t = await page.textContent(".kweek")
check(/Выходной/.test(t), "в субботу — «Выходной! Уроков нет.»", t)
await page.click('[data-kwd="3"]'); await page.waitForTimeout(400)
t = await page.textContent(".kweek")
check(/Ужин у бабушки/.test(t) && /вся семья/.test(t), "общее дело семьи видно в нужный день", t)
// Изи знает неделю
const ctx = await page.evaluate(() => typeof kidCtx === "function" ? kidCtx() : FAM.weekText(D.fam.id))
check(/завтра: уроки с 08:00 — Английский/.test(ctx), "Изи знает уроки на неделю", ctx.slice(0, 300))
// взрослый видит уроки в карточке ребёнка
await page.evaluate(() => { D.fam.id = FAM.members().find(m => m.role === "adult").id; D.fam.role = "adult"; D.who = "adult"; save(false); render() }); await page.waitForTimeout(400)
await page.evaluate(k => FAM.kidSheet(k), kid); await page.waitForTimeout(500)
t = await page.textContent(".sheet")
check(/Расписание уроков/.test(t) && /Изменить уроки/.test(t), "в карточке ребёнка у взрослого — расписание уроков и «Изменить уроки»", t.slice(0, 200))
await page.evaluate(() => { const h = [...document.querySelectorAll(".sheet h4")].find(x => /Расписание уроков/.test(x.textContent)); h.scrollIntoView({ block: "start" }) }); await page.waitForTimeout(300)
await shot(page, SHOTS + `kw-4-kidcard${DARK ? "-dark" : ""}.png`, ".sheet")
check(!errors.length, "без ошибок в консоли", errors.slice(0, 3))
await browser.close(); server.close()
console.log(ok ? "KIDWEEK_OK" : "KIDWEEK_FAIL")
