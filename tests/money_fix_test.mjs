// «Деньги» по замечаниям тестеров: валюту выбирает человек (знакомство и «Деньги»), несколько валют по выбору,
// сумма в основной валюте с правкой, «Откуда оплачено» со счётом по умолчанию, правка даты, «Прислать чек Изи».
//   node tests/money_fix_test.mjs [папка для снимков]
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const out = process.argv[2] || ""
if (out) fs.mkdirSync(out, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const NOW = new Date("2026-11-05T03:11:00Z")
const lists = ({ bkk }) => {
  const m = (id, d, h, amount, category, comment, x = {}) => Object.assign({ id, date: +bkk(d, h), u: 1, type: "expense", amount, method: "transfer", category, comment }, x)
  return { money: [m("i1", -2, 12, 150000, "Зарплата", "", { type: "income" }), m("e1", 0, 9, 450, "Транспорт", "такси", { method: "cash" }),
    m("e2", 0, 8, 1800, "Кафе и рестораны", "обед"), m("e3", -1, 20, 3400, "Продукты", "Big C")] }
}
const sp = s => String(s || "").replace(/\s+/g, " ")
for (const dark of [false, true]) {
  console.log(dark ? "Тёмная тема" : "Светлая тема")
  const { page, browser, server, errors } = await boot2({ root, time: NOW, lists, dark })
  const shot = async n => { if (out) { await page.waitForTimeout(450); await page.addStyleTag({ content: "#toast, #undo, .gm-toast, [class*=achv] { visibility: hidden !important }" }); await page.screenshot({ path: `${out}/${n}${dark ? "-dark" : ""}.png` }) } }
  const wait = ms => page.waitForTimeout(ms)
  const closeSheet = async () => { await page.evaluate(() => { const b = document.querySelector('.sheet [data-a="no"]'); b && b.click() }); await wait(450) }

  // 1. Знакомство: валюту спрашиваем прямо
  await page.evaluate(() => { delete D.conn.cfg.currency; delete D.cur; delete D.onb; D.mny = {}; save(false); curApply(); ONB.intro() }); await wait(700)
  const toCur = async () => { for (let i = 0; i < 20; i++) { if (await page.$("#onb [data-cur]")) return true; await page.evaluate(() => document.querySelector('#onb [data-ob="next"]').click()); await wait(350) } return false }
  check(await toCur(), "в знакомстве есть карточка «В какой валюте считать деньги?»")
  check(await page.$$eval("#onb [data-cur].on", e => e.length) === 0, "ни одна валюта не выбрана заранее")
  await page.evaluate(() => document.querySelector('#onb [data-ob="next"]').click()); await wait(350)
  check(!!(await page.$("#onb [data-cur]")), "без выбора «Дальше» не пускает")
  await shot("1-onb-currency")
  await page.evaluate(() => document.querySelector('#onb [data-cur="RUB"]').click()); await wait(300)
  check(await page.evaluate(() => D.cur === "RUB" && core.CONFIG.currency === "₽"), "выбрал рубль — суммы в рублях (хотя телефон в Таиланде)")
  await shot("1b-onb-currency-picked")
  await page.evaluate(() => { document.querySelector('#onb [data-ob="next"]').click() }); await wait(300)
  await page.evaluate(() => { const o = document.getElementById("onb"); if (o) { D.onb = { intro: Date.now(), steps: "old", tips: { plans: 1, money: 1, health: 1, chat: 1, cal: 1 } }; o.remove() } delete D.cur; D.feat = {}; save(false); curApply() })

  // 2. «Деньги»: кто не выбирал — спрашиваем на экране
  await page.evaluate(() => setTab("money")); await wait(900)
  check(!!(await page.$(".mn-curask")), "валюта не выбрана — карточка «В какой валюте считать?»")
  await shot("2-money-ask")
  await page.click('.mn-curask [data-curset="THB"]'); await wait(500)
  check(!(await page.$(".mn-curask")) && await page.evaluate(() => D.cur === "THB"), "выбрал — карточка ушла")
  check(await page.evaluate(() => !multiOn()) && !(await page.$(".mn-hero .pill")), "несколько валют выключены: без пересчётов в доллары")
  check(/Прислать чек Изи/.test(sp(await page.textContent(".mn-rcpt"))), "кнопка «Прислать чек Изи»")
  await page.evaluate(() => document.querySelector(".mn-tot").scrollIntoView({ block: "center" })); await shot("3-money-receipt")

  // 3. «Прислать чек» открывает чат и его «+»
  await page.click(".mn-rcpt"); await wait(1100)
  check(await page.evaluate(() => tab === "chat" && !!document.querySelector(".plus-menu.show")), "открылся чат Изи с меню «+»")
  await shot("4-receipt-plus")
  await page.evaluate(() => { const s = document.querySelector(".plus-scrim"); s && s.click() }); await wait(400)

  // 4. Окно траты: одна валюта, без счетов
  await page.evaluate(() => { setTab("money") }); await wait(600)
  await page.evaluate(() => { moneyForm("expense") }); await wait(600)
  check(await page.evaluate(() => getComputedStyle($("#m-cur")).display === "none" && getComputedStyle($("#m-base")).display === "none" && $("#m-cur").hidden && !$("#m-multi").hidden && !!$("#m-acc-add")), "новичок: одна валюта, ссылки «Платил в другой валюте» и «добавить счёт»")
  await shot("5-form-simple")
  await closeSheet()

  // 5. Счёт в долларах — несколько валют включаются сами; счёт по умолчанию
  await page.evaluate(() => { upsert("goals", { id: "a1", kind: "acct", date: Date.now() - 2e3, title: "Kasikorn", type: "bank", amount: 50000, cur: "THB" }); acctForm() }); await wait(500)
  await page.fill("#a-t", "Долларовая карта"); await page.fill("#a-a", "1200"); await page.click('#a-c [data-c="USD"]')
  await shot("6-acct-form")
  await page.click('.sheet [data-a="ok"]'); await wait(600)
  check(await page.evaluate(() => multiOn()), "счёт в другой валюте — «Несколько валют» включились сами")
  await page.evaluate(() => acctForm(D.goals.find(g => g.id === "a1"))); await wait(500)
  await page.click("#a-def"); await shot("6b-acct-default"); await page.click('.sheet [data-a="ok"]'); await wait(600)
  check(await page.evaluate(() => acctDef() === "a1"), "«Основной счёт для трат» запомнен")

  // 6. Трата: счёт по умолчанию выбран, другой счёт — другая валюта, обе суммы, правка итога
  await page.evaluate(() => { moneyForm("expense") }); await wait(600)
  check(await page.$eval("#m-acc .chip.on", e => e.textContent.trim()) === "Kasikorn", "в окне траты выбран основной счёт")
  await page.fill("#m-amt", "100"); await page.fill("#m-com", "ужин")
  await page.evaluate(() => [...document.querySelectorAll("#m-acc .chip")].find(b => /Долларовая/.test(b.textContent)).click()); await wait(300)
  check(await page.evaluate(() => !$("#m-base").hidden && $("#m-bamt").value === "3534" && $("#m-cur button.on").dataset.c === "USD"), "долларовая карта — сумма в долларах и в батах", await page.evaluate(() => [$("#m-base").hidden, $("#m-bamt").value]))
  check(/В батах выходит/.test(sp(await page.textContent("#m-base"))) && /поправьте сумму/.test(sp(await page.textContent("#m-fx"))), "подпись «В батах выходит» и подсказка про курс")
  await shot("7-form-two-sums")
  await page.fill("#m-bamt", "3600"); await page.click('.sheet [data-a="ok"]'); await wait(700)
  const rec = await page.evaluate(() => live(D.money).find(e => e.comment === "ужин"))
  check(rec && rec.amount === 3600 && rec.orig === 100 && rec.cur === "USD" && rec.acct, "записаны обе суммы: 100 $ и свои 3600 ฿, со счётом", rec)
  await page.evaluate(() => document.querySelector(".mn-ops").scrollIntoView({ block: "start" })); await wait(300)
  check(/Долларовая карта · \$100 ≈ 3 600 ฿/.test(sp(await page.textContent(".mn-ops"))), "в списке видно счёт и обе суммы", sp(await page.textContent(".mn-ops")).slice(0, 300))
  await shot("8-ops")

  // 7. Правка даты: перенести трату в прошлый месяц
  check(/поправить сумму, дату/.test(sp(await page.textContent(".mn-ops"))), "подсказка: нажмите на операцию, чтобы поправить дату")
  await page.evaluate(() => { moneyForm("expense", D.money.find(x => x.id === "e3")) }); await wait(600)
  await page.fill("#m-date", "2026-10-28"); await shot("9-edit-date")
  await page.click('.sheet [data-a="ok"]'); await wait(600)
  check(await page.evaluate(() => { const e = D.money.find(x => x.id === "e3"); return core.monthKey(new Date(e.date)) === "2026-10" && e.amount === 3400 }), "трата переехала в октябрь")

  // 8. Изи: перенос даты, счёт, вопрос про счёт, подтверждение суммы
  const r = await page.evaluate(async () => {
    delete MNY().acct; delete MNY().acctLast
    const a = await runTool("add_money", { type: "expense", amount: 50, method: "transfer", category: "Продукты", comment: "вода", currency: "USD" })
    const b = await runTool("update_money", { id: a.id, date: "2026-10-30", amount: 1800, account: "kasikorn" })
    const e = live(D.money).find(x => x.id === a.id)
    return { a, b, month: core.monthKey(new Date(e.date)), amount: e.amount, acct: e.acct }
  })
  check(/откуда оплачено/.test(r.a.account_question || "") && /верно ли/.test(r.a.confirm || ""), "Изи: спросит счёт и подтвердит сумму в батах", r.a)
  check(r.month === "2026-10" && r.amount === 1800 && r.acct === "a1", "Изи: update_money меняет дату, сумму и счёт", r)

  // 9. Настройки: переключатель «Несколько валют»
  await page.evaluate(() => setTab("more")); await wait(600)
  await page.evaluate(() => document.querySelector('[data-do="multi-tg"]').scrollIntoView({ block: "center" })); await wait(300)
  check(await page.$eval('[data-do="multi-tg"] .tgl', e => e.classList.contains("on")), "в Настройках «Несколько валют» включено")
  await shot("10-settings")
  await page.click('[data-do="multi-tg"]'); await wait(500)
  check(await page.evaluate(() => !multiOn()), "выключается одним касанием")
  check(!errors.length, "без ошибок в консоли", errors)
  await browser.close(); server.close()
}
console.log(ok ? "MONEY_FIX_OK" : "MONEY_FIX_FAIL")
process.exit(ok ? 0 : 1)
