// Снимки: раскладка дохода (% или сумма) и поля ввода в тёмной/светлой теме. node tests/plan_amt_shots.mjs <папка>
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true })
const NOW = new Date("2026-11-05T03:11:00Z")
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

for (const dark of [true, false]) {
  const sfx = dark ? "dark" : "light"
  const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: NOW, lists, dark })
  await page.evaluate(() => { D.cur = "RUB"; curApply(); save(false); setTab("money") }); await page.waitForTimeout(900)
  await page.evaluate(() => planForm()); await page.waitForTimeout(500)
  await page.click('#pl-ch [data-k="invest"]'); await page.click('#pl-ch [data-k="charity"]'); await page.waitForTimeout(200)
  await page.click('[data-u="invest"][data-v="amt"]'); await page.fill('[data-p="invest"]', "15000"); await page.dispatchEvent('[data-p="invest"]', "input")
  await page.click('[data-u="charity"][data-v="amt"]'); await page.fill('[data-p="charity"]', "3000"); await page.dispatchEvent('[data-p="charity"]', "input")
  await page.focus('[data-p="cushion"]'); await page.waitForTimeout(300)
  await page.evaluate(() => { const s = document.querySelector(".sheet:last-child"); s.scrollTop = s.scrollHeight })
  await page.waitForTimeout(400); await page.screenshot({ path: `${out}/1-raskladka-${sfx}.png` })
  await page.click('.sheet:last-child [data-a="ok"]'); await page.waitForTimeout(700)
  await page.evaluate(() => { const c = [...document.querySelectorAll(".card h2")].find(h => /Как раскладываю/.test(h.textContent)); c && c.scrollIntoView({ block: "start" }); scrollBy(0, -130) }); await page.waitForTimeout(3600)
  await page.screenshot({ path: `${out}/2-plan-${sfx}.png` })
  await page.evaluate(() => { document.querySelectorAll(".sheet,.scrim").forEach(e => e.remove()); moneyForm("expense") }); await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/3-zapis-${sfx}.png` })
  console.log(sfx, "errors", errors)
  await browser.close(); server.close()
}
