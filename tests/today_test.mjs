// «Сегодня» 2.0: сейчас и дорога, кольца, три главных, перегруз, таймлайн с окнами, погода, подсказка, шаблоны, итоги дня и недели. Снимки — build/web-shots/td-*
import fs from "fs"
import { boot2, shot } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const mk = when => boot2({ root, time: when,
  lists: ({ bkk, iso, dk }) => ({
    money: [{ id: "i1", date: +bkk(-4, 12), u: 1, type: "income", amount: 120000, method: "transfer", category: "Зарплата" },
      { id: "f1", date: +bkk(0, 9, 10), u: 1, type: "expense", amount: 450, method: "cash", category: "Транспорт" },
      { id: "f2", date: +bkk(-1, 13), u: 1, type: "expense", amount: 5100, method: "transfer", category: "Кафе и рестораны" }],
    budgets: [{ id: "b:Кафе и рестораны", date: 1, u: 1, category: "Кафе и рестораны", limit: 6000 }],
    water: [{ id: "w1", date: +bkk(0, 8), u: 1, ml: 500 }],
    rems: [
      { id: "r1", date: 1, u: 1, title: "Отправить договор", due: dk(bkk(0, 0)), done: false },
      { id: "r2", date: 1, u: 1, title: "Позвонить маме", due: dk(bkk(0, 0)), done: false },
      { id: "r3", date: 1, u: 1, title: "Купить цветы", due: iso(bkk(0, 17)), done: false },
      { id: "r4", date: 1, u: 1, title: "Сверить договор", due: dk(bkk(0, 0)), done: false, est: 240 },
      { id: "r5", date: 1, u: 1, title: "Разобрать почту", due: dk(bkk(0, 0)), done: false, est: 120 },
      { id: "r6", date: 1, u: 1, title: "Оплатить интернет", due: dk(bkk(-1, 0)), done: false, est: 60 }] }),
  events: ({ bkk, iso }) => [
    { id: "E1", title: "Показ виллы", start: iso(bkk(0, 11)), end: iso(bkk(0, 12)), calendar: "Работа", color: "#0A9F6E", all_day: false, location: "Rawai", repeats: false },
    { id: "E2", title: "Падел", start: iso(bkk(0, 19)), end: iso(bkk(0, 21)), calendar: "Личное", color: "#FF9F0A", all_day: false, location: "", repeats: false }] })

let { page, browser, server, errors } = await mk(new Date("2026-11-05T03:11:00Z"))   // чт 10:11 по Бангкоку
await page.waitForTimeout(1500); await page.evaluate(() => render()); await page.waitForTimeout(500)
const txt = () => page.textContent("#view")
let t = await txt()
check(/Показ виллы/.test(await page.textContent(".hero-now")) && /выехать в 10:\d\d/.test(await page.textContent(".hero-now")), "«Сейчас»: следующее событие и когда выезжать (дорога из таблицы)", await page.textContent(".hero-now"))
check(/31°, после 16:00 ливень/.test(await page.textContent("#top-sub")), "погода в шапке", await page.textContent("#top-sub"))
check(await page.$$eval(".rings .rg", x => x.length) === 5 && /можно/.test(t), "пять колец дня, «можно» — сколько потратить", t.slice(0, 300))
check(await page.$(".warn-card") && /Перенести «/.test(await page.textContent(".warn-card")), "день перегружен — предлагает перенести")
check(await page.$$eval(".tl .free", x => x.length) >= 2 && /дорога \d+ мин/.test(t) && /tl-now/.test(await page.innerHTML(".tl")), "таймлайн: окна, дорога, линия «сейчас»")
check(/До лимита «Кафе и рестораны» осталось 900/.test(t), "одна подсказка: лимит кафе")
// три главных
await page.evaluate(() => DO["td-top3"]()); await page.waitForTimeout(300)
await page.click('.t3[data-id="r1"]'); await page.click('.t3[data-id="r2"]')
await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(500)
check(await page.evaluate(() => top3Ids().join()) === "r1,r2" && await page.$$eval(".top3 .row", x => x.length) === 2, "три главных выбраны и наверху")
// перенести лишнее
await page.click('[data-do="td-move"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => D.rems.filter(r => r.due === "2026-11-06").length) >= 1 && !(await page.$(".warn-card")), "перегруз: перенесено на завтра")
// окно → дело на время
await page.click(".tl .free"); await page.waitForTimeout(300)
await page.click(".sheet [data-gr]");   // свободное окно открывает «Новое событие» с делами-кандидатами (cal-lily)
await page.waitForTimeout(0); await page.waitForTimeout(500)
check(await page.evaluate(() => live(D.rems).some(r => /T12:/.test(r.due || ""))), "нажали на окно — дело встало на 12:00")
// шаблон
await page.evaluate(() => upsert("goals", { id: "dt1", date: 1, kind: "dtpl", title: "Рабочий", ico: "brief", items: [{ t: "Планёрка", time: "09:30" }, { t: "Почта", time: "" }] })); await page.evaluate(() => render())
await page.click('[data-tpl="dt1"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => live(D.rems).some(r => r.title === "Планёрка" && /T09:30/.test(r.due))), "шаблон дня ставит дела со временем")
// подсказку можно скрыть
await page.click("[data-tip-off]"); await page.waitForTimeout(500)
check(!/До лимита «Кафе/.test(await txt()), "подсказка скрыта до завтра")
await shot(page, SHOTS + "td-morning.png")
check(!errors.length, "без ошибок", errors)
await browser.close(); server.close()

;({ page, browser, server, errors } = await mk(new Date("2026-11-08T14:00:00Z")))   // вс 21:00
await page.waitForTimeout(1500); await page.evaluate(() => render()); await page.waitForTimeout(400)
check(await page.$(".hero-eve") && !(await page.$(".warn-card")), "вечером: «Закрыть день», без перегруза")
check(/Итог недели/.test(await txt()), "в воскресенье — итог недели")
await page.click(".hero-eve"); await page.waitForTimeout(300)
await page.click('.cd [data-m="tm"]'); await page.fill("#cd-t", "Хороший день"); await page.click('#cd-m [data-i="3"]'); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => { const g = goalOf("daynote", dayKey(new Date())); return g && g.text === "Хороший день" && g.mood === 3 }), "итог дня и настроение сохранены")
await shot(page, SHOTS + "td-evening.png")
check(!errors.length, "без ошибок", errors)
await browser.close(); server.close()
console.log(ok ? "TODAY_OK" : "TODAY_FAIL")
