// Календарь 2.0: виды день/3 дня/неделя/месяц, слои, дорога, защищённое время, дела в окна (и сдвиг за встречей),
// ввод фразой с предпросмотром, шаблоны, нагрузка месяца, «когда я свободен», погода, второй пояс. Снимки — build/web-shots/cal-*
import fs from "fs"
import { boot2, shot } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const ev = (id, title, d, h, m, h2, m2, calendar, location = "") => ({ bkk, iso }) => ({ id, title, start: iso(bkk(d, h, m)), end: iso(bkk(d, h2, m2)), calendar, all_day: false, location, repeats: false })
const EVS = [
  ev("E1", "Показ виллы", 0, 11, 0, 12, 0, "Работа", "Rawai"), ev("E2", "Обед с Олей", 0, 14, 0, 15, 0, "Оля"), ev("E3", "Падел", 0, 19, 0, 21, 0, "Личное"),
  ev("E4", "Планёрка", 1, 9, 0, 10, 0, "Работа"), ev("E5", "Сын · плавание", 1, 12, 0, 13, 30, "Дети"), ev("E6", "Звонок маме", 1, 16, 0, 17, 0, "Личное"),
  ev("E7", "Оля · йога", 2, 10, 0, 12, 0, "Оля"), ev("E8", "Пляж с детьми", 2, 13, 0, 15, 30, "Дети"), ev("E9", "Показ объекта", 2, 17, 0, 18, 30, "Работа", "Kata"),
]
for (const [d, n] of [[4, 6], [5, 5]]) for (let i = 0; i < n; i++) EVS.push(ev(`L${d}${i}`, `Встреча ${i + 1}`, d, 9 + i * 2, 0, 10 + i * 2, 30, "Работа"))
const mk = (when, dark = false) => boot2({ root, time: when, dark,
  lists: ({ bkk, iso, dk }) => ({
    rems: [{ id: "r1", date: 1, u: 1, title: "Сверить договор", due: dk(bkk(0, 0)), done: false, est: 40 },
      { id: "r2", date: 1, u: 1, title: "Заехать в банк", due: null, done: false }],
    goals: [{ id: "p1", date: 1, u: 1, kind: "pblk", title: "Падел", days: [4], from: "19:00", to: "21:00" },
      { id: "p2", date: 1, u: 1, kind: "pblk", title: "Вечер с детьми", days: [5], from: "18:00", to: "21:00" }] }),
  events: ctx => EVS.map(f => f(ctx)) })

let { page, browser, server, errors } = await mk(new Date("2026-11-05T03:11:00Z"))   // чт 10:11 по Бангкоку
await page.evaluate(() => { D.fam = Object.assign({ code: "T", url: "https://script.google.com/macros/s/TEST/exec", role: "adult", share: { cal: 1 }, shareAsked: 1, data: { members: {} } }, D.fam || {}); D.gcal.calendars = ["Личное", "Работа", "Оля", "Дети"].map(name => ({ name })); window.__created = []
  window.calDo = async (a, x) => { if (a === "create") { const e = Object.assign({ id: "N" + __created.length }, x); __created.push(e); D.gcal.events.push(e); save(false); return { ok: true, event: e } } return { ok: true } } })
await page.waitForTimeout(1200)
await page.click('[data-do="cal-open"]'); await page.waitForTimeout(1800); await page.evaluate(() => render()); await page.waitForTimeout(500)
const txt = () => page.textContent("#view")
let t = await txt()
check(await page.textContent("#top-title") === "Календарь" && /Ноябрь · 3 дня/.test(await page.textContent("#top-sub")) && await page.$eval('#tabs [data-tab="today"]', b => b.classList.contains("on")), "открылся экран «Календарь», вкладка «Сегодня» подсвечена")
check(await page.$$eval(".cg-col", x => x.length) === 3 && /Показ виллы/.test(t) && /Пляж с детьми/.test(t), "3 дня: события всех слоёв", t.slice(0, 200))
check(await page.$$eval(".cg-dh .wx", x => x.length) >= 2, "погода у каждого дня")
await page.waitForSelector(".cg-it.road", { timeout: 6000 }).catch(() => {})
check(await page.$(".cg-it.road") && /дорога \d+ мин/.test(await page.textContent(".cg-it.road")), "дорога перед встречей с адресом — блоком")
check(await page.$$eval(".cg-it.prot", x => x.length) >= 2 && /Вечер с детьми/.test(t), "защищённое время: «Падел» и «Вечер с детьми»")
check(await page.$('.cg-it.ev[style*="#AF52DE"]') && await page.$('.cg-it.ev[style*="#FF9F0A"]'), "цвета слоёв: Оля и Дети")
await page.click('[data-ly="olya"]'); await page.waitForTimeout(300)
check(!/Обед с Олей/.test(await page.textContent(".cal-card")), "слой «Оля» выключается одной кнопкой")
await page.click('[data-ly="olya"]'); await page.click('[data-ly="tz"]'); await page.waitForTimeout(300)
check(/Мск/.test(await page.textContent(".cg-body .cg-tc")) && /у них 12:00/.test(await txt()), "второй пояс: московское время слева и «у них» на звонке", await page.textContent(".cg-body .cg-tc"))
// дела без времени
t = await txt()
check(/Без времени/.test(t) && /Сверить договор/.test(t) && /предлагаю сегодня 12:15/.test(t), "дело без времени — предложено окно после показа", t.match(/Без времени.{0,160}/))
await page.click('[data-slot="r1"]'); await page.waitForTimeout(500)
check(await page.evaluate(() => { const r = D.rems.find(x => x.id === "r1"); return r.due === "2026-11-05T12:15" && r.anchor && r.anchor.ev === "E1" }), "«Ок» — дело встало в окно и привязано к встрече")
await page.evaluate(() => { const e = D.gcal.events.find(x => x.id === "E1"); e.end = "2026-11-05T12:30"; calReflow(); render() })
check(await page.evaluate(() => D.rems.find(x => x.id === "r1").due) === "2026-11-05T12:45", "встреча кончилась позже — дело сдвинулось следом")
await page.evaluate(() => { const e = D.gcal.events.find(x => x.id === "E1"); e.end = "2026-11-05T12:00"; calReflow(); D.rems.find(x => x.id === "r1").due = "2026-11-05"; D.rems.find(x => x.id === "r1").anchor = null; save(false); render() })
await page.waitForTimeout(600)
check(/Нагрузка ноября/.test(await txt()) && /9–10 ноября перегружены: 11 встреч/.test(await txt()), "нагрузка месяца и предупреждение о перегрузе", (await txt()).match(/Нагрузка.{0,200}/))
await shot(page, SHOTS + "cal-3days.png")
// неделя, день, месяц
await page.click('[data-cv="7"]'); await page.waitForTimeout(600)
check(await page.$$eval(".cg-col", x => x.length) === 7, "неделя — 7 колонок")
await shot(page, SHOTS + "cal-week.png")
await page.click('[data-cv="m"]'); await page.waitForTimeout(700)
check(await page.$$eval(".cal-load.big .hm", x => x.length) === 30, "месяц — карта нагрузки")
await shot(page, SHOTS + "cal-month.png")
await page.click('.cal-load.big .hm.td'); await page.waitForTimeout(600)
check(await page.$$eval(".cg-col", x => x.length) === 1 && /Четверг, 5 ноября/.test(await page.textContent(".cal-nav b")), "нажали на день в месяце — открылся день")
await page.click('[data-cs="1"]'); await page.waitForTimeout(500)
check(/Пятница, 6 ноября/.test(await page.textContent(".cal-nav b")), "листание вперёд")
await page.click('[data-cv="3"]'); await page.click('[data-do="cal-today"]').catch(() => {}); await page.waitForTimeout(500)
// ввод фразой
await page.click("#add"); await page.waitForTimeout(400)
await page.fill("#cq", "завтра в 15 стоматолог на Сукхумвите, напомни за час"); await page.waitForTimeout(1500)
let pv = await page.textContent("#cq-pv")
check(/Стоматолог/.test(pv) && /Пятница, 6 ноября · 15:00–16:00/.test(pv) && /Сукхумвите/.test(pv) && /выехать в 14:\d\d/.test(pv) && /напомнить в 14:00/.test(pv), "предпросмотр: время, место, когда выехать, напоминание", pv)
await page.waitForTimeout(400); await page.screenshot({ path: SHOTS + "cal-quick.png" })
await page.click('#cq-pv [data-a="mk"]'); await page.waitForTimeout(300)
await page.fill("#et-b", "паспорт, снимок"); await page.click('.sheet:last-child [data-a="ok"]'); await page.waitForTimeout(300)
check(await page.evaluate(() => etpls().some(t => t.title === "Стоматолог" && t.location === "Сукхумвите" && t.remind === 60 && t.bring === "паспорт, снимок")), "«Сделать шаблоном» — шаблон сохранён")
await page.click('#cq-pv [data-a="ok"]'); await page.waitForTimeout(500)
check(await page.evaluate(() => __created.length === 1 && __created[0].title === "Стоматолог" && __created[0].start === "2026-11-06T15:00" && __created[0].location === "Сукхумвите") &&
  await page.evaluate(() => live(D.rems).some(r => r.due === "2026-11-06T14:00" && /Стоматолог в 15:00/.test(r.title))), "сохранено событие и напоминание за час")
// шаблон подставляет длительность, место, напоминание
await page.evaluate(() => { calQuick({}); document.querySelector("#cq").value = "стоматолог в субботу в 10"; document.querySelector("#cq").dispatchEvent(new Event("input")) }); await page.waitForTimeout(600)
pv = await page.textContent("#cq-pv")
check(/по шаблону «Стоматолог»/.test(pv) && /Сукхумвите/.test(pv) && /взять: паспорт/.test(pv) && /напомнить в 09:00/.test(pv), "по шаблону: место, «взять», напоминание", pv)
await page.evaluate(() => stack.slice().forEach(s => s.close())); await page.waitForTimeout(300)
// защищённое время
await page.evaluate(() => { calQuick({}); document.querySelector("#cq").value = "в пятницу в 19 встреча с клиентом"; document.querySelector("#cq").dispatchEvent(new Event("input")) }); await page.waitForTimeout(600)
check(/Это время защищено/.test(await page.textContent("#cq-pv")) && /Вечер с детьми/.test(await page.textContent("#cq-pv")), "предупреждение: время защищено")
await page.waitForTimeout(400); await page.screenshot({ path: SHOTS + "cal-protect.png" })
await page.click('#cq-pv [data-a="other"]'); await page.waitForTimeout(300)
pv = await page.textContent("#cq-pv")
check(!/Это время защищено/.test(pv) && /Пятница, 6 ноября · 21:00/.test(pv), "«Другое время» — нашлось свободное окно", pv)
await page.evaluate(() => stack.slice().forEach(s => s.close())); await page.waitForTimeout(300)
const aiw = await page.evaluate(() => runTool("create_event", { title: "Клиент", start: "2026-11-06T19:30", end: "2026-11-06T20:30" }))
check(aiw.warning && /защищено/.test(aiw.warning) && await page.evaluate(() => __created.length) === 1, "помощник тоже не ставит встречу на защищённое время без «да»", aiw)
// когда я свободен
await page.waitForTimeout(3500); await page.click('[data-do="cal-free"]'); await page.waitForTimeout(400)
const ft = await page.inputValue("#fs-t")
check(/^Здравствуйте! Могу показать объект:\n• чт 5 ноября — /.test(ft) && /\n• пт 6 ноября — 10:00–14:00, 17:00–18:00\n/.test(ft) && /чт 5 ноября — 12:00–14:00, 15:00–19:00/.test(ft), "«Когда я свободен»: окна текстом, без защищённого времени", ft)
await page.waitForTimeout(400); await page.screenshot({ path: SHOTS + "cal-free.png" })
await page.evaluate(() => stack.slice().forEach(s => s.close())); await page.waitForTimeout(300)
await page.click('[data-do="cal-prot"]'); await page.waitForTimeout(300)
check(/Падел/.test(await page.textContent(".sheet")) && /\+ Ужин с семьёй/.test(await page.textContent(".sheet")), "список защищённого времени и быстрые варианты")
await page.evaluate(() => stack.slice().forEach(s => s.close())); await page.waitForTimeout(300)
await page.click('[data-do="cal-set"]'); await page.waitForTimeout(300)
check(/Оля/.test(await page.textContent(".sheet")) && /Уфа/.test(await page.textContent(".sheet")), "настройки слоёв и пояса")
await page.evaluate(() => stack.slice().forEach(s => s.close())); await page.waitForTimeout(300)
check(!errors.length, "без ошибок", errors)
await browser.close(); server.close()

;({ page, browser, server, errors } = await mk(new Date("2026-11-05T03:11:00Z"), true))
await page.evaluate(() => { D.gcal.calendars = ["Личное", "Работа", "Оля", "Дети"].map(name => ({ name })); calS().tzOn = 1; calStart = null; setTab("cal") }); await page.waitForTimeout(1800); await page.evaluate(() => render()); await page.waitForTimeout(500)
await shot(page, SHOTS + "cal-3days-dark.png")
check(!errors.length, "без ошибок (тёмная тема)", errors)
await browser.close(); server.close()
console.log(ok ? "CALENDAR_OK" : "CALENDAR_FAIL")
