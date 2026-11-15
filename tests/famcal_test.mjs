// Календарь семьи: слои «Я · Семья · близкий · Дети» разными цветами, общие дела семьи (список events в таблице семьи),
// календарь близкого целиком (Google) своим цветом, расписание и дела детей, детский экран. Снимки — build/web-shots/fc-*
import fs from "fs"
import { boot2, shot } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const ev = (id, title, d, h, m, h2, m2, calendar, location = "") => ({ bkk, iso }) => ({ id, title, start: iso(bkk(d, h, m)), end: iso(bkk(d, h2, m2)), calendar, all_day: false, location, repeats: false })
const EVS = [
  ev("E1", "Показ виллы", 0, 11, 0, 12, 0, "Работа", "Rawai"), ev("E2", "Салон красоты", 0, 13, 0, 14, 30, "Алия"), ev("E3", "Падел", 0, 19, 0, 20, 30, "Личное"),
  ev("E4", "Планёрка", 1, 9, 0, 10, 0, "Работа"), ev("E5", "Йога", 1, 10, 30, 12, 0, "Алия"), ev("E6", "Звонок маме", 1, 17, 0, 18, 0, "Личное"),
  ev("E7", "Встреча с подругой", 2, 11, 0, 12, 30, "Алия"), ev("E9", "Показ объекта", 2, 16, 0, 17, 30, "Работа", "Kata"),
]
const DARK = process.argv.includes("--dark")
const { page, browser, server, errors, sheet } = await boot2({ root, time: new Date("2026-11-05T03:11:00Z"), dark: DARK, events: ctx => EVS.map(f => f(ctx)) })   // чт 10:11 по Бангкоку
await page.evaluate(() => { D.gcal.calendars = ["Личное", "Работа", "Алия"].map(name => ({ name })); save(false) })
await page.waitForTimeout(800)
// до семьи: ничего общего — только мои события, календарь «Алия» не красится чужим цветом
await page.click('[data-do="cal-open"]'); await page.waitForTimeout(1500); await page.evaluate(() => render()); await page.waitForTimeout(400)
let chips = await page.$$eval(".cal-l [data-ly]", l => l.map(b => b.dataset.ly))
check(chips.join() === "me,tz", "без семьи слоёв семьи нет — только «Я»", chips)
check(await page.evaluate(() => evLayer({ calendar: "Алия" }) === "me" && evLayer({ calendar: "Семья" }) === "me"), "без семьи все календари — мои")
const colorOf = t => page.evaluate(t => { const el = [...document.querySelectorAll(".cg-it.ev, .cg-a")].find(e => e.textContent.includes(t)); return el ? el.style.getPropertyValue("--c") : null }, t)
const c0 = [await colorOf("Показ виллы"), await colorOf("Салон красоты")]
check(c0[0] && c0[1] && c0[0] !== c0[1] && !c0.some(c => ["#0A9F6E", "#FF375F", "#AF52DE"].includes(c)), "без семьи календари «Работа» и «Алия» — свои цвета, не цвета семьи и не «Я»", c0)
await page.click('[data-do="cal-fam"]'); await page.waitForTimeout(400)
check(/Создать семью/.test(await page.textContent(".sheet")), "без семьи «Календарь семьи» предлагает создать семью")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(300)

// семья: папа, Алия (взрослая, вошла со своего телефона), дети Миша и Соня
const ask = async v => { await page.waitForSelector("#ask-v"); await page.fill("#ask-v", String(v)); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(350) }
await page.evaluate(() => { setTab("plans"); plansF = "fam"; render() }); await page.waitForTimeout(200)
await page.click('[data-f="new"]'); await ask("Ильдар"); await ask("Таштимировы"); await page.waitForTimeout(600)
// сразу после создания — один раз «Что делим с семьёй», всё выключено
check(await page.evaluate(() => /Что делим с семьёй/.test(stack.length && stack[stack.length - 1].el.textContent) && document.querySelectorAll(".sheet [data-fsh] .tgl.on").length === 0 && document.querySelectorAll(".sheet [data-fsh]").length === 2), "после создания семьи спрашивает, что делить; всё выключено")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(300)
for (const [n, a] of [["Миша", 9], ["Соня", 8]]) { await page.click('[data-f="kid"]'); await ask(n); await ask(a); await page.waitForTimeout(600); await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(300) }
const code = await page.evaluate(() => D.fam.code)
let r = sheet.post(JSON.stringify({ family: { op: "put", code, id: "a2", me: { name: "Алия", role: "adult", color: "#FF6FA8" } } }))
check(r.ok && r.family.members.a2 && Array.isArray(r.family.events), "Алия вошла в семью; таблица семьи хранит события", r.ok)
await page.evaluate(() => FAM.push(true)); await page.waitForTimeout(600)
const ids = await page.evaluate(() => Object.fromEntries(FAM.members().map(m => [m.name, m.id])))
// общие дела семьи и расписание детей
await page.evaluate(({ ids }) => { const P = FAM.put, t = new Date(), k = i => dayKey(addDays(t, i)), w = wdOf(t)
  P("events", { id: "f1", title: "Ужин у бабушки", who: "fam", day: k(0), time: "15:30", min: 90, by: FAM.meId() })
  P("events", { id: "f2", title: "Аквапарк", who: "fam", day: k(1), time: "13:00", min: 150, take: "плавки", by: FAM.meId() })
  P("events", { id: "f3", title: "День рождения дедушки", who: "fam", day: k(2), time: "", by: FAM.meId() })
  P("events", { id: "f4", title: "Плавание", who: ids["Миша"], days: [w, w % 7 + 1].sort(), time: "16:00", min: 60, take: "очки", by: FAM.meId() })
  P("events", { id: "f5", title: "Рисование", who: ids["Соня"], days: [w, (w + 1) % 7 + 1].sort(), time: "17:30", min: 60, by: FAM.meId() })
  P("events", { id: "f6", title: "Стоматолог", who: "a2", day: k(2), time: "14:00", min: 60, by: FAM.meId() })
  P("tasks", { id: "t1", kid: ids["Миша"], title: "Почистить зубы", stars: 5, days: [] }); P("tasks", { id: "t2", kid: ids["Миша"], title: "Собрать рюкзак", stars: 5, days: [] })
  P("tasks", { id: "t3", kid: ids["Соня"], title: "Покормить кота", stars: 5, days: [] })
  return FAM.push(true) }, { ids })
await page.waitForTimeout(700)
r = sheet.post(JSON.stringify({ family: { op: "put", code, id: "a2", me: { name: "Алия", role: "adult" } } }))
check(r.family.events.length === 6 && r.family.events.find(x => x.id === "f2").take === "плавки", "события семьи дошли до таблицы — их получит телефон Алии", r.family.events.length)
await page.evaluate(() => { setTab("cal"); calStart = null; render() }); await page.waitForTimeout(700)
check((await page.$$eval(".cal-l [data-ly]", l => l.map(b => b.dataset.ly))).join() === "me,tz" && !/Ужин у бабушки/.test(await page.textContent("#view")), "семья есть, но общий календарь не включён — видно только своё")
await page.click('[data-do="cal-fam"]'); await page.waitForTimeout(400)
check(/только ваши события/.test(await page.textContent(".sheet")), "«Календарь семьи» предлагает включить общий календарь")
await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(400)
await page.click('.sheet [data-fsh="cal"]'); await page.waitForTimeout(200)
check(await page.evaluate(() => FAM.share("cal") && !FAM.share("money")), "включили только календарь")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(500)
chips = await page.$$eval(".cal-l [data-ly]", l => l.map(b => b.textContent.trim()))
check(chips.slice(0, 4).join() === "Я,Семья,Алия,Дети", "чипы слоёв с именем близкого из семьи", chips)
const cs = {}; for (const t of ["Показ виллы", "Ужин у бабушки", "Салон красоты", "Плавание", "Рисование", "Аквапарк", "Стоматолог", "День рождения дедушки", "Миша: 0 из 2", "Соня: 0 из 1"]) cs[t] = await colorOf(t)
check(cs["Ужин у бабушки"] === "#FF375F" && cs["Аквапарк"] === "#FF375F" && cs["День рождения дедушки"] === "#FF375F", "общие дела семьи — своим цветом", cs)
check(cs["Стоматолог"] === "#AF52DE" && cs["Салон красоты"] === "#AF52DE", "дело, записанное Алии, — её цветом, как и её календарь", cs)
check(cs["Плавание"] === "#FF9F0A" && cs["Рисование"] === "#0A84FF" && cs["Миша: 0 из 2"] === "#FF9F0A" && cs["Соня: 0 из 1"] === "#0A84FF", "расписание и дела каждого ребёнка — его цветом", cs)
check(new Set([cs["Показ виллы"], cs["Ужин у бабушки"], cs["Салон красоты"], cs["Плавание"], cs["Рисование"]]).size === 5, "пять разных цветов: я, семья, Алия, Миша, Соня")
await shot(page, SHOTS + `fc-1-cal${DARK ? "-dark" : ""}.png`)
// выключить слой — события пропали
await page.click('.cal-l [data-ly="fam"]'); await page.waitForTimeout(300)
check(!/Ужин у бабушки/.test(await page.textContent("#view")) && /Показ виллы/.test(await page.textContent("#view")), "слой «Семья» выключается одним касанием")
await page.click('.cal-l [data-ly="fam"]'); await page.waitForTimeout(300)
// день
await page.evaluate(() => calSetView("1")); await page.waitForTimeout(500)
await shot(page, SHOTS + `fc-2-day${DARK ? "-dark" : ""}.png`)
await page.evaluate(() => calSetView("3")); await page.waitForTimeout(400)
// «Сегодня»: семейное событие в списке дня
await page.evaluate(() => setTab("today")); await page.waitForTimeout(500)
check(/Ужин у бабушки/.test(await page.textContent("#view")), "общее дело семьи видно и на «Сегодня»")
await shot(page, SHOTS + `fc-3-today${DARK ? "-dark" : ""}.png`)
// новое событие фразой — «чьё»: семья
await page.evaluate(() => { setTab("cal"); calQuick() }); await page.waitForTimeout(400)
await page.fill("#cq", "завтра в 19 кино всей семьёй"); await page.waitForTimeout(500)
check(await page.$$eval("[data-own]", l => l.map(b => b.textContent.trim()).join()) === "Моё,Семья,Алия,Миша,Соня", "у нового события выбор: моё, семья, близкие", await page.$$eval("[data-own]", l => l.map(b => b.textContent.trim()).join()))
await page.click('[data-own="fam"]'); await page.waitForTimeout(200)
await shot(page, SHOTS + `fc-4-new${DARK ? "-dark" : ""}.png`, ".sheet")
await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(900)
check(await page.evaluate(() => FAM.L("events").some(x => /кино/i.test(x.title) && x.who === "fam" && x.time === "19:00") && !(window.__created || []).length), "событие «Семья» ушло в календарь семьи, а не в личный Google")
// окно «Календарь семьи» и правка
await page.click('[data-do="cal-fam"]'); await page.waitForTimeout(450)
check(/Ужин у бабушки/.test(await page.textContent(".sheet")) && /Плавание/.test(await page.textContent(".sheet")) && /каждую неделю/.test(await page.textContent(".sheet")), "окно «Календарь семьи»: общие дела и расписание детей")
await shot(page, SHOTS + `fc-5-family${DARK ? "-dark" : ""}.png`, ".sheet")
await page.click('.sheet [data-a="sch"]'); await page.waitForTimeout(600)
await page.fill("#fe-t", "Английский"); await page.click(`#fe-w [data-k="${ids["Соня"]}"]`); await page.click('#fe-days [data-d="2"]'); await page.fill("#fe-h", "15:00")
await shot(page, SHOTS + `fc-6-schedule${DARK ? "-dark" : ""}.png`, ".sheet")
await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(700)
check(await page.evaluate(k => FAM.L("events").some(x => x.title === "Английский" && x.who === k && x.days.join() === "2" && x.time === "15:00"), ids["Соня"]), "расписание ребёнка сохраняется по дням недели")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(400)
// удалить дело семьи
await page.evaluate(() => famEvForm(FAM.L("events").find(x => x.id === "f3"))); await page.waitForTimeout(400)
await page.click('.sheet [data-a="del"]'); await page.waitForTimeout(500)
check(await page.evaluate(() => !FAM.L("events").some(x => x.id === "f3") && !iphone().events.some(e => e.id === "fam:f3")), "дело семьи удаляется у всех")
// цвета: сменить цвет семьи
await page.evaluate(() => calSettings()); await page.waitForTimeout(400)
await page.click('[data-cs-k="fam"]'); await page.waitForTimeout(250)
await shot(page, SHOTS + `fc-7-colors${DARK ? "-dark" : ""}.png`, ".sheet")
await page.click('[data-cs-c="#30B0C7"]'); await page.waitForTimeout(250)
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(400)
check(await colorOf("Ужин у бабушки") === "#30B0C7", "цвет слоя меняется в «Цвета и календари»", await colorOf("Ужин у бабушки"))
await page.evaluate(() => { delete D.cal.colors.fam; save(false); render() })
// «Дела детей» с выбором ребёнка из семьи → копия в календарь семьи
await page.evaluate(() => kidsForm()); await page.waitForTimeout(400)
await page.fill("#k-t", "Футбол"); await page.click('#k-d [data-d="6"]'); await page.fill("#k-h", "10:00"); await page.click(`#k-kc [data-kid="${ids["Миша"]}"]`); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(500)
check(await page.evaluate(k => D.kids.some(x => x.title === "Футбол" && x.kid === "Миша") && FAM.L("events").some(x => x.title === "Футбол" && x.who === k) && iphone().events.filter(e => /Футбол/.test(e.title)).length === 0, ids["Миша"]), "«Дела детей» с ребёнком из семьи видны второму взрослому и ребёнку, без дублей у себя")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close(); return FAM.push(true) }); await page.waitForTimeout(600)
// детский экран: расписание на сегодня
await page.evaluate(k => { D.fam.id = k; D.fam.role = "kid"; D.fam.name = "Миша"; save(false); render() }, ids["Миша"]); await page.waitForTimeout(600)
const kt = await page.textContent("#view")
check(/Расписание/.test(kt) && /Плавание/.test(kt) && /16:00/.test(kt) && /Ужин у бабушки/.test(kt) && !/Рисование/.test(kt), "у ребёнка на экране — его расписание и общие дела семьи на сегодня", kt.slice(0, 300))
await page.waitForTimeout(6000); await shot(page, SHOTS + `fc-8-kid.png`)
check(!errors.length, "без ошибок в консоли", errors.slice(0, 3))
await browser.close(); server.close()
console.log(ok ? "FAMCAL_OK" : "FAMCAL_FAIL")
