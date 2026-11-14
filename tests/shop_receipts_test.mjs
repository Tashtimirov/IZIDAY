// Умный список покупок: Изи запоминает позиции и цены из чека (save_receipt), в «Покупках» — выбор магазина,
// цены у пунктов, «Обычно в …» и примерная сумма на кассе.
//   node tests/shop_receipts_test.mjs [папка для снимков]   (DARK=1 — тёмная тема, LANG=en — английский)
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
const out = process.argv[2] || ""
if (out) fs.mkdirSync(out, { recursive: true })
const dark = !!process.env.DARK, en = process.env.LANG_UI === "en", sfx = (en ? "-en" : "") + (dark ? "-dark" : "")
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const NOW = new Date("2026-11-14T10:30:00Z")
const day = 864e5
const lists = () => ({
  shop: [
    { id: "b1", date: 1, u: 1, title: "Молоко", done: false },
    { id: "b2", date: 2, u: 1, title: "Яйца", done: false },
    { id: "b3", date: 3, u: 1, title: "Курица филе", done: false },
    { id: "b4", date: 4, u: 1, title: "Подгузники", done: false },
  ],
  goals: [
    { id: "stM", date: 1, u: 1, kind: "store", title: "Makro", rc: 2, last: +NOW - 12 * day,
      items: [{ n: "Подгузники Mamypoko L 54 шт", p: 409, q: 1, c: 2, at: +NOW - 12 * day }, { n: "Рис жасмин 5 кг", p: 219, q: 1, c: 2, at: +NOW - 12 * day }] },
  ],
})
const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: NOW, lists, dark,
  ...(en ? { ctxOpts: { locale: "en-US" }, init: () => { try { localStorage.setItem("izi-lang", "en") } catch (e) {} } } : {}) })
const sp = x => String(x || "").replace(/[\s  ]+/g, " ")
const shot = async n => { if (!out) return; await page.waitForTimeout(450); await page.screenshot({ path: `${out}/${n}${sfx}.png` }) }
const close = () => page.evaluate(() => { try { while (stack.length) stack[stack.length - 1].close() } catch (e) {} document.querySelectorAll("#layer > *").forEach(x => x.remove()) })

// 1. Два чека Big C: позиции, цены, частота
const r1 = await page.evaluate(() => runTool("save_receipt", { store: "Big C", date: "2026-11-02", items: [
  { name: "Молоко Meiji 2 л", price: 92, qty: 1 }, { name: "Яйца 30 шт", price: 135 }, { name: "Курица филе 1 кг", price: 125, qty: 2 },
  { name: "Йогурт Dutchie", price: 62 }, { name: "Вода 6 × 1,5 л", total: 84 }] }))
check(r1.ok && r1.store === "Big C" && r1.remembered === 5 && r1.new_items === 5, "первый чек: 5 позиций запомнено", r1)
check(r1.marked_bought.length === 3 && r1.to_buy.join() === "Подгузники", "пункты списка из чека отмечены купленными", r1)
const r2 = await page.evaluate(() => runTool("save_receipt", { store: "Big C", date: "2026-11-09", items: [
  { name: "Молоко Meiji 2 л", price: 95 }, { name: "Яйца 30 шт", price: 139 }, { name: "Курица филе 1 кг", price: 129, qty: 2 }, { name: "Рис жасмин 5 кг", price: 235 }, { name: "Бананы", price: 45 }] }))
check(r2.ok && r2.receipts === 2 && r2.new_items === 2, "второй чек того же магазина дописан", r2)
const cat = await page.evaluate(() => storeFind("big c"))
check(cat && cat.items[0].c === 2 && cat.items.find(i => i.n === "Молоко Meiji 2 л").p === 95, "цена обновилась по свежему чеку, частые сверху", cat && cat.items.slice(0, 3))
// старый чек после нового не перебивает цену
await page.evaluate(() => runTool("save_receipt", { store: "BIG C", date: "2026-10-20", items: [{ name: "молоко meiji 2 л", price: 80 }] }))
check(await page.evaluate(() => storeFind("Big C").items.find(i => i.n === "Молоко Meiji 2 л").p) === 95, "старый чек не перебивает свежую цену")
// валюта: чек в долларах переводится в основную
await page.evaluate(() => runTool("save_receipt", { store: "Duty Free", currency: "USD", items: [{ name: "Шоколад", price: 10 }] }))
check(await page.evaluate(() => { const p = storeFind("Duty Free").items[0].p; return p > 200 && p < 500 }), "чек в $ переведён в ฿")
const bad = await page.evaluate(() => runTool("save_receipt", { store: "", items: [] }))
check(bad.error, "без магазина — ошибка", bad)

// 2. Примерная сумма (вернуть отмеченные чеками пункты в список)
await page.evaluate(() => { for (const id of ["b1", "b2", "b3"]) shopToggle(id, false) })
await page.evaluate(() => { D.shopSt = storeFind("Big C").id; save() })
const est = await page.evaluate(() => shopEstimate())
// молоко 95 + яйца 139 + курица 2×129 + подгузники ≈409 (из Makro)
check(est.sum === 95 + 139 + 258 + 409 && est.known === 4 && est.all === 4, "сумма: Big C + цена подгузников из Makro", est)
const gs = await page.evaluate(() => runTool("get_shopping", {}))
check(gs.estimate && gs.estimate.sum === est.sum && gs.receipt_stores.length === 3, "get_shopping отдаёт сумму и магазины", gs)

// 3. Карточка «Сегодня» и лист «Покупки»
await page.evaluate(() => { setTab("today"); render() }); await page.waitForTimeout(500)
const card = sp(await page.textContent("#shop"))
check(/≈ 901 ฿ на кассе в Big C|≈ 901 ฿ at the checkout/.test(card) || /901/.test(card), "на карточке «Покупки» видна сумма", card)
await page.evaluate(() => shopSheet()); await page.waitForTimeout(500)
let t = sp(await page.textContent("#layer .sheet:last-child"))
check(/Big C/.test(t) && /Makro/.test(t) && /Любой|Any/.test(t) && /901/.test(t), "лист: магазины и сумма", t.slice(0, 300))
check(/≈ (409|฿409)/.test(t) && /Makro/.test(t), "подгузники с ценой из другого магазина и «≈»", t)
await shot("1-pokupki")
// переключение магазина
await page.click('[data-st="stM"]'); await page.waitForTimeout(400)
t = sp(await page.textContent("#layer .sheet:last-child"))
check(await page.evaluate(() => D.shopSt === "stM"), "выбран Makro", t.slice(0, 200))
await close()
await page.evaluate(() => { D.shopSt = storeFind("Big C").id; save(); shopSheet() }); await page.waitForTimeout(400)
await page.click('[data-a="usual"]'); await page.waitForTimeout(500)
t = sp(await page.textContent("#layer .sheet:last-child"))
check(/Обычно берёте здесь|Big C/.test(t) && /Рис жасмин 5 кг/.test(t) && !/Молоко Meiji/.test(t) && !/Яйца 30/.test(t), "«Обычно в Big C»: без того, что уже в списке", t.slice(0, 400))
const rows = await page.$$("[data-u]")
for (const k of [0, 1, 2]) await rows[k].click()
await page.waitForTimeout(300)
const tot = sp(await page.textContent("#u-tot"))
check(/Отмечено 3|3 selected|Selected 3/.test(tot) || /3/.test(tot), "итог отмеченного", tot)
await shot("2-obychno")
await page.click('#layer .sheet:last-child [data-a="ok"]'); await page.waitForTimeout(600)
check(await page.evaluate(() => shopOpen().length) === 7, "три позиции добавлены в список", await page.evaluate(() => shopOpen().map(s => s.title)))
await shot("3-pokupki-posle")
await close()

if (en) {
  const miss = await page.evaluate(() => [...L.miss])
  const USER = /^(Молоко|Яйца|Курица филе|Подгузники|Рис жасмин 5 кг|Бананы|Йогурт Dutchie|Вода 6 × 1,5 л)$/
  const left = miss.filter(x => !USER.test(x) && !/ и ещё \d+$/.test(x))   // «… и ещё N» — тост отмены (undo.js), было и раньше
  check(!left.length, "английский: всё переведено (кроме названий покупок)", left)
}
check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()
console.log(ok ? "SHOP_OK" : "SHOP_FAIL")
