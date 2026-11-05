// Деньги 2.0: «сегодня можно потратить», копилки, распределение дохода, валюты, капитал, подписки, категории с одной поправки,
// семейный бюджет, долги и займы, неделя в деньгах с характером. Снимки — build/web-shots/money-*
import fs from "fs"
import { boot2, shot } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const NOW = new Date("2026-11-05T03:11:00Z")   // чт 10:11 по Бангкоку
const lists = ({ bkk }) => {
  const t = (d, h, m = 0) => +bkk(d, h, m)
  const m = (id, d, h, amount, category, comment, x = {}) => Object.assign({ id, date: t(d, h), u: 1, type: "expense", amount, method: "transfer", category, comment }, x)
  return {
    money: [
      m("i1", -2, 12, 150000, "Зарплата", "", { type: "income" }),
      m("e1", 0, 9, 450, "Транспорт", "такси", { method: "cash" }),
      m("e2", -1, 8, 2146, "Другое", "Подарок маме", { cur: "RUB", orig: 5000 }),
      m("e3", -1, 20, 424, "Другое", "Сервер для сайта", { cur: "USD", orig: 12 }),
      m("e4", -1, 13, 1800, "Кафе и рестораны", "обед", { shared: true }),
      m("e5", -9, 13, 4100, "Кафе и рестораны", "ужин"), m("e6", -4, 19, 1800, "Кафе и рестораны", "кафе"),
      m("n1", -62, 10, 419, "Другое", "Netflix"), m("n2", -31, 10, 419, "Другое", "Netflix"), m("n3", -1, 10, 419, "Другое", "Netflix"),
      m("s1", -3, 18, 260, "Другое", "7-Eleven"), m("s2", -2, 21, 185, "Другое", "7-Eleven"), m("s3", 0, 7, 120, "Другое", "7-Eleven, вода"),
      m("o1", -35, 12, 900, "Другое", "что-то"), m("o2", -34, 12, 700, "Другое", "ещё"),
      m("p1", -3, 12, 3400, "Продукты", "Big C", { shared: true }),
    ],
    recur: [
      { id: "rc1", date: 1, u: 1, title: "Аренда", amount: 25000, day: 10, method: "transfer", category: "Другое", type: "expense", paid: {} },
      { id: "rc2", date: 1, u: 1, title: "Интернет", amount: 900, day: 15, method: "transfer", category: "Другое", type: "expense", paid: {} },
      { id: "rc3", date: 1, u: 1, title: "Школа", amount: 16100, day: 20, method: "transfer", category: "Другое", type: "expense", paid: {} },
      { id: "rc4", date: 1, u: 1, title: "Фитнес-клуб", amount: 2900, day: 1, method: "transfer", category: "Другое", type: "expense", paid: { "2026-11": "x" } },
    ],
    goals: [
      { id: "j1", date: 1, u: 1, kind: "jar", title: "Отпуск в Японии", target: 150000, saved: 62000, s0: 20000, start: "2026-08", due: "2027-06", dep: {} },
      { id: "j2", date: 2, u: 1, kind: "jar", title: "Подушка на 6 месяцев", target: 480000, saved: 255000, s0: 150000, start: "2026-05", due: "2027-08", dep: {}, shared: true },
      { id: "a1", date: 1, u: 1, kind: "acct", title: "Kasikorn", type: "bank", amount: 520000, cur: "THB" },
      { id: "a2", date: 2, u: 1, kind: "acct", title: "Наличные", type: "cash", amount: 164000, cur: "THB" },
      { id: "a3", date: 3, u: 1, kind: "acct", title: "Вклад", type: "dep", amount: 28000, cur: "USD" },
      { id: "a4", date: 4, u: 1, kind: "acct", title: "Квартира", type: "prop", amount: 1650000, cur: "THB" },
      { id: "caphist", date: 1, u: 1, kind: "caphist", m: { "2026-05": 2810000, "2026-06": 2870000, "2026-07": 2860000, "2026-08": 2950000, "2026-09": 3010000, "2026-10": 3060000 } },
      { id: "q1", date: 1, u: 1, kind: "debt", title: "Автокредит", dir: "loan", amount: 150000, pay: 15000, rate: 6 },
      { id: "q2", date: 2, u: 1, kind: "debt", title: "Андрей", dir: "in", amount: 8000, due: "2026-11-15" },
    ],
  }
}
const { page, browser, server, errors } = await boot2({ root, time: NOW, lists })
await page.evaluate(() => setTab("money")); await page.waitForTimeout(900)
const sp = x => String(x || "").replace(/[\s\u00a0\u202f]+/g, " ")
const txt = async () => sp(await page.textContent("#view"))
let t = await txt()
// 1. можно потратить
const cs = await page.evaluate(() => canSpend())
check(cs && cs.today > 0 && cs.jars > 0 && cs.bills === 42000, "можно потратить: учтены платежи и копилки", cs)
await page.waitForTimeout(900)
check(/Сегодня можно потратить/.test(t) && (await page.textContent(".mn-hero .v")).replace(/\D/g, "") === String(cs.today) && /≈ \$\d+/.test(sp(await page.textContent(".mn-hero"))) && /≈ [\d ]+ ₽/.test(sp(await page.textContent(".mn-hero"))),
  "большое число и ≈ $ / ₽", await page.textContent(".mn-hero"))
check(await page.evaluate(() => { const g = D.goals.find(x => x.id === "spend"); return g && g.today === canSpend().today && g.day === "2026-11-05" }), "число для виджета записано в goals")
// 3. распределение
check(/Пришло 150 000 ฿ — разложим\?/.test(t) && /Обязательные платежи \d+%/.test(t) && /Подушка безопасности/.test(t) && /Изи предложил/.test(t) && /аренда, интернет, школа/.test(t) && /На жизнь/.test(t), "карточка «Пришло — разложим?»", t.match(/Пришло.{0,200}/))
check(/Отпуск в Японии/.test(t) && /Подушка на 6 месяцев/.test(t) && /отстаёте на \d месяц/.test(t) && /успеваете/.test(t), "копилки: план и «отстаёте»", t.match(/Копилки.{0,300}/))
// 5. капитал, 9. долги, 6. подписки
check(/Капитал/.test(t) && await page.$$eval(".cap-g .tile", x => x.length) >= 5 && await page.$(".cap-ch") && /\$28 000/.test(t), "капитал: плитки, график, вклад в долларах")
const cap = await page.evaluate(() => capital())
check(cap.total === Math.round(520000 + 164000 + 28000 / 0.0283 + 1650000 + 8000 - 150000), "капитал = счета + долги вам − кредит", cap)
check(/Автокредит/.test(t) && /\+5 000 ฿ в месяц → на \d+ месяц/.test(t) && /Андрей должен вам/.test(t) && /обещал до 15 ноября/.test(t), "долги: план погашения и «должен вам»", t.match(/Долги и займы.{0,260}/))
check(/Похоже на подписки/.test(t) && /Netflix · 419 ฿ \/ мес/.test(t) && /Фитнес-клуб/.test(t), "охотник за подписками нашёл Netflix и фитнес", t.match(/Похоже.{0,200}/))
// 4. валюты в операциях
check(/−5 000 ₽/.test(t) && /5 000 ₽ ≈ 2 146 ฿/.test(t) && /−\$12/.test(t), "операции в своей валюте и ≈ в батах", t.match(/Операции.{0,300}/))
// 10. неделя
const w1 = await page.textContent("#mn-week")
check(/Красавчик/.test(w1), "неделя: «похвали»", w1)
await shot(page, SHOTS + "money-1.png")
await page.click('[data-tone="roast"]'); await page.waitForTimeout(300)
const w2 = await page.textContent("#mn-week")
await page.click('[data-tone="dry"]'); await page.waitForTimeout(300)
const w3 = await page.textContent("#mn-week")
check(w2 !== w1 && w3 !== w2 && /Неделя: −/.test(w3) && await page.evaluate(() => D.mny.tone) === "dry", "тон «пожури» и «сухо» меняют текст", [w2, w3])
await page.click('[data-tone="praise"]')
// распределить
const before = await page.evaluate(() => D.goals.filter(g => g.kind === "jar").map(j => j.saved))
// план раскладки: выбрать статьи — Изи предлагает проценты
await page.click('.mn-alloc [data-do="plan-edit"]'); await page.waitForTimeout(400)
await page.click('#pl-ch [data-k="charity"]'); await page.click('#pl-ch [data-k="invest"]'); await page.waitForTimeout(200)
const pl = await page.evaluate(() => [...document.querySelectorAll("#pl-l .pl-row")].map(r => r.textContent.replace(/\s+/g, " ").trim()))
const pv = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-p]")].map(i => [i.dataset.p, +i.value])))
const lifeP = await page.evaluate(() => +document.querySelector(".pl-life").textContent.replace(/\D/g, ""))
check(pv.bills === 30 && pv.charity >= 1 && pv.invest >= 5 && pv.goals > 0 && pv.cushion >= 5 && lifeP + Object.values(pv).reduce((a, b) => a + b, 0) === 100, "предложены проценты под платежи, копилки, подушку, инвестиции, благотворительность", { pv, lifeP, pl })
await page.screenshot({ path: SHOTS + "money-plan.png" })
await page.fill('[data-p="charity"]', "5"); await page.dispatchEvent('[data-p="charity"]', "input"); await page.waitForTimeout(100)
check(+(await page.textContent(".pl-life")).replace(/\D/g, "") === lifeP - (5 - pv.charity), "поправил процент — «На жизнь» пересчиталось")
await page.click('.sheet:last-child [data-a="ok"]'); await page.waitForTimeout(400)
t = await txt()
check(/Благотворительность 5%/.test(t) && /Инвестиции \d+%/.test(t) && /Как раскладываю доход/.test(t), "раскладка дохода по сохранённому плану", t.match(/Пришло.{0,400}/))
await page.waitForTimeout(2600); await page.evaluate(() => { document.querySelector("#tabs").style.visibility = "hidden"; document.querySelector("#fab") && (document.querySelector("#fab").style.visibility = "hidden") }); await page.locator(".mn-alloc").screenshot({ path: SHOTS + "money-alloc.png" }); await page.evaluate(() => { document.querySelector("#tabs").style.visibility = ""; document.querySelector("#fab") && (document.querySelector("#fab").style.visibility = "") })
await page.click('[data-do="mn-alloc"]'); await page.waitForTimeout(500)
check(await page.evaluate(() => aplan().items.filter(z => !["bills", "life", "goals"].includes(z.k)).every(z => envJar(z.k) && jarDep(envJar(z.k)) === Math.round(150000 * z.pct / 100 / 10) * 10) && envJar("cushion").title === "Подушка на 6 месяцев" && !gk("jar").some(j => j.env === "cushion")), "конверты получили доли, подушка — в свою копилку", await page.evaluate(() => gk("jar").map(j => [j.title, j.saved])))
const after = await page.evaluate(() => D.goals.filter(g => g.kind === "jar" && !g.deleted).map(j => ({ s: j.saved, d: j.dep })))
check(after[0].s > before[0] && after[1].s > before[1] && !/разложим\?/.test(await txt()) && await page.evaluate(() => D.goals.some(g => g.id === "al:i1")), "«Разложить так» — деньги в копилках, карточка ушла", after)
check(/в ноябре отложено/.test(await txt()), "после раскладки копилки «в ноябре отложено»")
// 6. отменить подписку
await page.click('[data-sub="m:netflix"][data-keep="0"]'); await page.waitForTimeout(500)
check(await page.evaluate(() => live(D.rems).some(r => r.title === "Отменить подписку: Netflix" && r.due === "2026-11-05")) && !/Netflix · 419/.test(await txt()), "«Отменить» — дело на сегодня, строка ушла")
await page.click('[data-sub="r:rc4"][data-keep="1"]'); await page.waitForTimeout(500)
check(/оставили · 34 800 ฿ в год/.test(await txt()), "«Оставить» — галочка и сумма в год")
// 7. категория с одной поправки
await page.click('[data-money="s1"]'); await page.waitForTimeout(400)
await page.click('#m-cats [data-c="Продукты"]'); await page.waitForTimeout(100)
check(/Запомню: «7-Eleven» → Продукты/.test(sp(await page.textContent("#m-rule"))), "форма: «Запомню»")
await page.click('.sheet:last-child [data-a="ok"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => catRules().some(r => r.key === "7 eleven" && r.cat === "Продукты")), "правило сохранено")
const n = await page.evaluate(() => rulesApply()); await page.evaluate(() => render()); await page.waitForTimeout(300)
check(n === 2 && await page.evaluate(() => D.money.filter(e => /7-Eleven/.test(e.comment)).every(e => e.category === "Продукты")), "остальные траты 7-Eleven сами ушли в «Продукты»", n)
t = await txt()
check(/Запомнил: 7-Eleven → Продукты/.test(t) && /«Другое» в этом месяце: \d трат/.test(t), "карточка «Запомнил»", t.match(/Запомнил.{0,120}/))
check(await page.evaluate(() => ruleFor("7-eleven у дома") === "Продукты"), "правило узнаёт похожие комментарии")
await shot(page, SHOTS + "money-2.png")
// 4. валюта в форме
await page.click('[data-do="expense"]'); await page.waitForTimeout(400)
await page.fill("#m-amt", "1000"); await page.click('#m-cur [data-c="RUB"]'); await page.fill("#m-com", "книга"); await page.waitForTimeout(150)
check(/≈ 429 ฿ по курсу сегодня/.test(sp(await page.textContent("#m-fx"))), "форма: ₽ → ≈ ฿ сразу", sp(await page.textContent("#m-fx")))
await page.click("#m-sh"); await page.waitForTimeout(200)
await page.screenshot({ path: SHOTS + "money-form.png" })
await page.click('.sheet:last-child [data-a="ok"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => D.money.some(e => e.comment === "книга" && e.amount === 429 && e.cur === "RUB" && e.orig === 1000 && e.shared)), "сохранено: 429 ฿, оригинал 1 000 ₽, общая")
// 8. семья
await page.click('[data-mv="mine"]'); await page.waitForTimeout(500)
t = await txt()
check(!/книга/.test(t) && !/обед/.test(t) && /такси/i.test(t) && !/Подушка/.test(t), "«Мои» — без общих трат и общей копилки")
await page.click('[data-mv="shared"]'); await page.waitForTimeout(500)
t = await txt()
check(/Общие с Олей/.test(t) && /книга/i.test(t) && /Big C/.test(t) && !/такси/i.test(t) && /Подушка/.test(t) && !/Японии/.test(t), "«Общие с Олей» — только общее")
await page.click('[data-mv="all"]'); await page.waitForTimeout(500)
// долги: платёж по кредиту
await page.click('[data-debt="q1"]'); await page.waitForTimeout(400)
check(await page.$eval("#d-p", x => x.value) === "15000" && await page.$eval(".d-due", x => x.hidden), "форма кредита: платёж, без срока")
await page.evaluate(() => document.querySelector(".sheet:last-child").remove())
// инструменты Изи
const r = await page.evaluate(async () => ({
  usd: await runTool("add_money", { type: "expense", amount: 20, currency: "USD", method: "transfer", category: "Другое", comment: "домен" }),
  oth: await runTool("add_money", { type: "expense", amount: 90, method: "cash", category: "Другое", comment: "7-Eleven" }),
  jar: await runTool("add_jar", { title: "Новая машина", target: 600000, due: "2028-01" }),
  dep: await runTool("jar_deposit", { title: "япония", amount: 5000 }),
  debt: await runTool("add_debt", { title: "Серёжа", dir: "out", amount: 3000, due: "2026-11-06" }),
  get: await runTool("get_money", {}) }))
check(r.usd.ok && /\$20 ≈ 707 ฿/.test(sp(r.usd.converted)), "add_money в долларах пересчитан", r.usd)
check(r.oth.category === "Продукты", "add_money «Другое» по правилу → «Продукты»", r.oth)
check(r.jar.ok && r.jar.per_month > 0 && r.dep.ok && r.debt.ok && r.get.jars.length === 3 && r.get.debts.length === 3 && typeof r.get.can_spend_today === "number" && r.get.capital.total > 0, "копилка, взнос, долг и get_money для Изи", r)
await page.evaluate(() => { setTab("today") }); await page.waitForTimeout(600)
check(/Вы должны: Серёжа/.test(await txt()) || /можно/.test(await txt()), "на «Сегодня»: подсказка о долге или кольцо «можно»")
check(!errors.filter(e => !/favicon/.test(e)).length, "без ошибок в консоли", errors)
// тёмная тема
await browser.close(); server.close()
const b2 = await boot2({ root, time: NOW, lists, dark: true })
await b2.page.evaluate(() => setTab("money")); await b2.page.waitForTimeout(1800)
await shot(b2.page, SHOTS + "money-dark.png")
await b2.browser.close(); b2.server.close()
console.log(ok ? "MONEY_OK" : "MONEY_FAIL")
