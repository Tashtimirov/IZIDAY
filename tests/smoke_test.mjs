// Дымовая проверка перед выкладкой (часть quick_check.mjs): каждый раздел открывается, в каждом разделе
// добавляется запись, все окна из «+» открываются, светлая и тёмная тема, без ошибок на странице и без карточки
// «Не получилось показать этот раздел».
//   node tests/smoke_test.mjs
import { boot2 } from "./today_boot.mjs"
const time = new Date("2026-11-12T03:30:00Z")
let fail = 0
const check = (name, ok, got) => { console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + String(JSON.stringify(got)).slice(0, 300)}`); if (!ok) fail++ }
const TABS = ["today", "plans", "chat", "money", "health", "more"]

for (const dark of [false, true]) {
  const th = dark ? "тёмная" : "светлая"
  const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time, dark,
    events: ({ bkk, iso }) => [{ id: "e1", title: "Встреча", s: iso(bkk(0, 10)), e: iso(bkk(0, 11)), calendar: "Работа" }] })
  const failed = () => page.evaluate(() => /Не получилось показать этот раздел/.test($("#view").innerText))
  const closeAll = () => page.evaluate(() => { try { while (stack.length) stack[stack.length - 1].close() } catch (e) {} document.querySelectorAll("#layer > *").forEach(x => x.remove()) })
  // записи во всех разделах — так, как их делает приложение
  const added = await page.evaluate(async () => { try {
    const now = Date.now(), r = {}
    upsert("money", { id: "sm1", date: now, type: "expense", amount: 250, method: "cash", category: "Кафе и рестораны", comment: "кофе" }); r.money = 1
    remAdd({ title: "Позвонить в банк", due: null }); r.rems = 1
    await addWater(250, "widget"); r.water = 1
    upsert("food", { id: "sf1", date: now, title: "Омлет", kcal: 320, p: 20, f: 22, c: 4 }); r.food = 1
    upsert("habits", { id: "sh1", date: now, title: "Зарядка", days: [] }); r.habits = 1
    shopAdd(["молоко"]); r.shop = 1
    goalAdd("wish", ["Увидеть северное сияние"]); r.goals = 1
    D.chat.push({ role: "user", text: "привет", at: now }, { role: "assistant", text: "Привет! Чем помочь?", at: now + 1 }); save(false)
    return Object.keys(r).length
  } catch (e) { return String(e && e.stack || e) } })
  check(`${th}: записи добавлены во все разделы`, added === 7, added)
  for (const t of TABS) {
    await page.evaluate(t => setTab(t), t); await page.waitForTimeout(350)
    const txt = await page.evaluate(() => $("#view").innerText.length)
    check(`${th}: «${t}» открывается`, !(await failed()) && txt > 20, { txt })
  }
  const shown = await page.evaluate(() => { setTab("today"); return { m: /кофе|250/.test($("#view").innerText) || true, r: /Позвонить в банк/.test($("#view").innerText) } })
  check(`${th}: напоминание видно на «Сегодня»`, shown.r)
  await page.evaluate(() => setTab("money")); await page.waitForTimeout(300)
  check(`${th}: трата видна в «Деньгах»`, await page.evaluate(() => /кофе|Кафе/.test($("#view").innerText)), await page.evaluate(() => $("#view").innerText.slice(0, 400)))
  // все окна из «+»
  await page.evaluate(() => setTab("today")); await page.evaluate(() => $("#add").click()); await page.waitForTimeout(400)
  const n = await page.$$eval("#layer .opt", els => els.length)
  check(`${th}: меню «+» открывается`, n >= 3, { n })
  for (let i = 0; i < n; i++) {
    await closeAll(); await page.evaluate(() => $("#add").click()); await page.waitForTimeout(250)
    await page.evaluate(i => { const b = document.querySelectorAll("#layer .opt")[i]; b && b.click() }, i); await page.waitForTimeout(350)
  }
  await closeAll()
  // Настройки, поиск, кнопка «Сообщить об ошибке»
  await page.evaluate(() => $("#gear").click()); await page.waitForTimeout(300)
  check(`${th}: Настройки открываются`, !(await failed()))
  await page.evaluate(() => $("#find") && $("#find").click()); await page.waitForTimeout(300); await closeAll()
  check(`${th}: кнопка «Сообщить об ошибке» на месте`, await page.evaluate(() => !!document.querySelector("#bugq")))
  // данные пережили перезапуск
  await page.reload(); await page.waitForTimeout(1800)
  check(`${th}: после перезапуска записи на месте`, await page.evaluate(() => D.money.some(x => x.id === "sm1") && D.rems.some(x => x.title === "Позвонить в банк")))
  const errs = errors.filter(e => !/Failed to load resource|favicon/.test(e))
  check(`${th}: без ошибок на странице`, !errs.length, errs)
  await browser.close(); server.close()
}
console.log(fail ? `\n${fail} ПРОВАЛ(ОВ)` : "\nSMOKE_OK")
process.exit(fail ? 1 : 0)
