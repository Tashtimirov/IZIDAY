// Удаление операции прямо из списка «Денег»: смахивание влево → «Удалить», режим «Изменить», отмена плашкой.
//   node tests/money_swipe_test.mjs [папка для снимков]
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
    m("e2", 0, 8, 1800, "Кафе и рестораны", "обед"), m("e3", -1, 20, 3400, "Продукты", "Big C"), m("e4", -1, 13, 260, "Другое", "7-Eleven")] }
}
const alive = (page, id) => page.evaluate(id => { const e = D.money.find(x => x.id === id); return !!e && !e.deleted }, id)
for (const dark of [false, true]) {
  const { page, browser, server, errors } = await boot2({ root, time: NOW, lists, dark })
  const shot = async n => { if (out) { await page.waitForTimeout(450); await page.screenshot({ path: `${out}/${n}${dark ? "-dark" : ""}.png` }) } }
  await page.evaluate(() => setTab("money")); await page.waitForTimeout(900)
  await page.evaluate(() => $(".mn-ops").scrollIntoView({ block: "start" })); await page.waitForTimeout(300)
  check(await page.$$eval(".mn-ops .swd", e => e.length) === 5, "у каждой операции есть кнопка удаления")
  check(/смахните её влево/.test(await page.textContent(".mn-ops")), "подсказка, как удалить")
  await shot("1-list")
  // смахнуть «такси» влево
  const r = await page.$('.mn-ops [data-money="e1"]'); const b = await r.boundingBox()
  await page.mouse.move(b.x + b.width - 20, b.y + b.height / 2); await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(b.x + b.width - 20 - i * 15, b.y + b.height / 2)
  await page.mouse.up(); await page.waitForTimeout(350)
  check(await page.$eval('.mn-ops [data-money="e1"]', e => e.parentNode.classList.contains("open")), "смахнул — видна кнопка «Удалить»")
  check(!(await page.$("#layer .sheet, .sheet.show")), "окно правки не открылось")
  await shot("2-swiped")
  await page.click('.mn-ops [data-money="e1"] + .swd-del'); await page.waitForTimeout(600)
  check(!(await alive(page, "e1")), "«такси» удалено")
  check(await page.evaluate(() => { const u = document.querySelector(".undo, #undo, [class*=undo]"); return !!u && /Отменить/.test(u.textContent) }), "плашка «Отменить»")
  await shot("3-deleted")
  await page.evaluate(() => { const u = [...document.querySelectorAll("button")].find(x => /Отменить/.test(x.textContent)); u && u.click() }); await page.waitForTimeout(500)
  check(await alive(page, "e1"), "«Отменить» вернула операцию")
  // режим «Изменить»
  await page.waitForTimeout(5500)
  await page.evaluate(() => $('[data-do="mn-edit"]').click()); await page.waitForTimeout(500)
  await page.evaluate(() => $(".mn-ops").scrollIntoView({ block: "start" })); await page.waitForTimeout(300)
  check(await page.$eval(".mn-ops", e => e.classList.contains("swd-all")) && /Готово/.test(await page.textContent(".mn-ops h2")), "«Изменить» показывает кнопки у всех")
  await shot("4-edit")
  await page.click('.mn-ops [data-money="e4"] + .swd-del'); await page.waitForTimeout(600)
  check(!(await alive(page, "e4")), "удаление в режиме «Изменить»")
  // строка на «Сегодня» тоже смахивается
  await page.evaluate(() => setTab("today")); await page.waitForTimeout(600)
  const n = await page.$$eval(".swd [data-money]", e => e.length)
  console.log("   · строк трат со смахиванием на «Сегодня»:", n)
  // обычное нажатие по строке открывает правку
  await page.evaluate(() => setTab("money")); await page.waitForTimeout(600)
  await page.evaluate(() => $('.mn-ops [data-money="e2"]').click()); await page.waitForTimeout(500)
  check(await page.evaluate(() => /Изменить/.test(document.body.textContent) && !!document.querySelector('[data-a="del"]')), "нажатие по строке открывает окно правки с «Удалить»")
  check(!errors.length, "без ошибок в консоли", errors)
  await browser.close(); server.close && server.close()
}
console.log(ok ? "MONEY_SWIPE_OK" : "MONEY_SWIPE_FAIL")
process.exit(0)
