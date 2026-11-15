// Основной список покупок можно переименовать и удалить (с подтверждением). Удалённый скрыт, цены из чеков остаются;
// попросили купить — список появляется снова. Изи видит новое название (get_shopping, add_list_items).
//   node tests/shop_list_edit_test.mjs [папка для снимков]   (DARK=1 — тёмная тема)
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
const out = process.argv[2] || ""
if (out) fs.mkdirSync(out, { recursive: true })
const dark = !!process.env.DARK, sfx = dark ? "-dark" : ""
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const NOW = new Date("2026-11-15T10:30:00Z")
const lists = () => ({
  shop: [{ id: "b1", date: 1, u: 1, title: "Молоко", done: false }, { id: "b2", date: 2, u: 1, title: "Хлеб", done: false }],
  goals: [{ id: "stM", date: 1, u: 1, kind: "store", title: "Makro", rc: 1, last: +NOW - 864e5, items: [{ n: "Молоко", p: 50, q: 1, c: 1, at: +NOW - 864e5 }] },
    { id: "o1", date: 2, u: 1, kind: "list", title: "В отпуск", ico: "plane", items: [] }],
})
const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: NOW, lists, dark })
const sp = x => String(x || "").replace(/[\s  ]+/g, " ")
const shot = async n => { if (!out) return; await page.waitForTimeout(450); await page.screenshot({ path: `${out}/${n}${sfx}.png` }) }
const top = () => page.textContent("#layer .sheet:last-child").then(sp)
const listsTxt = () => page.evaluate(() => { const d = document.createElement("div"); d.innerHTML = listsCard(); return d.textContent })

// 1. Переименовать
await page.evaluate(() => shopSheet()); await page.waitForTimeout(400)
let t = await top()
check(/Переименовать/.test(t) && /Удалить/.test(t), "в листе «Покупки» есть «Переименовать» и «Удалить»", t)
await shot("sl-1-sheet")
await page.click('[data-a="ren"]'); await page.waitForTimeout(400)
await page.fill("#ask-v", "продукты"); await shot("sl-2-rename")
await page.click('#layer .sheet:last-child [data-a="ok"]'); await page.waitForTimeout(500)
t = await top()
check(/Продукты/.test(t) && /Молоко/.test(t), "после переименования лист называется «Продукты», пункты на месте", t)
check(/Продукты/.test(await listsTxt()), "в «Списках» новое название")
let gs = await page.evaluate(() => runTool("get_shopping", {}))
check(gs.list_name === "Продукты" && gs.to_buy.length === 2, "Изи видит новое название", gs)
const al = await page.evaluate(() => runTool("add_list_items", { list: "продукты", items: ["Сыр"] }))
check(al.ok && al.added.join() === "Сыр" && !(await page.evaluate(() => myLists().some(l => /продукт/i.test(l.title)))), "add_list_items «Продукты» пишет в основной список, а не создаёт новый", al)
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })

// 2. Удалить: подтверждение, отмена ничего не трогает
await page.evaluate(() => shopSheet()); await page.waitForTimeout(400)
await page.click('#layer .sheet:last-child [data-a="del"]'); await page.waitForTimeout(400)
t = await top()
check(/Удалить список\?/.test(t) && /Продукты/.test(t) && /все пункты/.test(t) && /Цены из чеков останутся/.test(t), "подтверждение с названием", t)
await shot("sl-3-confirm")
await page.click('#layer .sheet:last-child [data-b="Отмена"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => shopOpen().length) === 3, "«Отмена» ничего не удаляет")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
await page.evaluate(() => shopSheet()); await page.waitForTimeout(400)
await page.click('#layer .sheet:last-child [data-a="del"]'); await page.waitForTimeout(400)
await page.click('#layer .sheet:last-child [data-b="Удалить"]'); await page.waitForTimeout(600)
check(await page.evaluate(() => shopOpen().length === 0 && shopOff()), "список удалён и скрыт")
let lt = await listsTxt()
check(!/Продукты/.test(lt) && /В отпуск/.test(lt), "в «Списках» его больше нет, свои списки на месте", lt)
check(await page.evaluate(() => storeCats().length === 1 && storeCats()[0].items.length === 1), "цены из чеков сохранились")
await page.evaluate(() => { setTab("plans"); render() }); await page.waitForTimeout(500)
await shot("sl-4-after")
// «Отменить» возвращает список
const und = await page.evaluate(() => !!(UNDO.last && !UNDO.last.done))
check(und, "есть «Отменить» на удаление")
if (und) {
  await page.evaluate(() => UNDO.undo(UNDO.last)); await page.waitForTimeout(500)
  check(await page.evaluate(() => shopOpen().length === 3 && !shopOff()), "«Отменить» вернуло список с пунктами")
  await page.evaluate(() => { for (const x of live(D.shop)) remove("shop", x.id); shopMetaSet({ off: true }) })
}
// 3. Попросили купить — список появляется снова
gs = await page.evaluate(() => runTool("get_shopping", {}))
check(gs.deleted === true, "Изи знает, что список удалён", gs)
const ad = await page.evaluate(() => runTool("add_shopping", { items: ["Кофе"] }))
check(ad.ok && ad.to_buy.join() === "Кофе" && !(await page.evaluate(() => shopOff())), "add_shopping вернул список", ad)
lt = await listsTxt()
check(/Продукты/.test(lt) && /Кофе/.test(lt), "список снова в «Списках» со старым названием", lt)

check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()
console.log(ok ? "SHOPLIST_OK" : "SHOPLIST_FAIL")
