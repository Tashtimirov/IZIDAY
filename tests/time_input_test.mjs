// Поля времени и даты: выбор значения не должен пересоздавать поле и закрывать окно.
// На iPhone колёсико времени шлёт change после каждого поворота (час, потом минуты). Если обработчик перерисовывает форму,
// поле исчезает и колёсико закрывается после выбора часа — ошибка уже возвращалась (редактор плана недели, 2026-11-15).
// Проверка: в каждом окне с полем time/date/datetime-local шлём input+change и смотрим, что это тот же узел, он в фокусе, окно открыто.
import { boot2 } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-17T01:30:00Z") })

// окна: имя → как открыть (в странице). Чего нет в сборке — пропускается, но обязательные должны открыться
const FORMS = [
  ["план недели: редактор", `FEAT.set("plan", true, true); const wk = WPLAN.curWk(); WPLAN.tool({ action: "add", title: "Обзвон базы", days: ["пн", "ср"], time: "09:00", minutes: 30 }); WPLAN.editSheet(wk); setTimeout(() => { const o = document.querySelector(".sheet [data-ed-o]"); if (o) o.click() }, 150)`, true],
  ["трата", `moneyForm("expense")`, true],
  ["событие", `const a = new Date(Date.now() + 3600e3); eventSheet({ id: "te1", title: "Встреча", start: a, end: new Date(+a + 3600e3) }); setTimeout(() => { const b = document.querySelector('#ev-b [data-a="edit"]'); if (b) b.click() }, 150)`, false],
  ["напоминание", `upsert("rems", { id: "tr1", title: "Позвонить", due: new Date(Date.now() + 3600e3).toISOString() }); remSheet("tr1")`, true],
  ["быстрое событие", `calQuick({ form: true, start: new Date(Date.now() + 3600e3) })`, false],
  ["дни рождения", `bdaysForm(true)`, false],
  ["цель", `goalsForm()`, false],
  ["долг", `debtForm()`, false],
  ["дети: будильник", `kidsForm()`, false],
  ["семейное событие", `famEvForm()`, false],
  ["обследование", `protForm()`, false],
  ["голодание", `FAST.startSheet(); setTimeout(() => { const b = document.querySelector('#fs-a button[data-a="1"]'); if (b) b.click() }, 100)`, false],
]
const closeAll = async () => { await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(350) }
let reached = 0, fields = 0
for (const [name, open, must] of FORMS) {
  await closeAll()
  const opened = await page.evaluate(async src => { try { new Function(src)(); return "" } catch (e) { return String(e && e.message || e) } }, open)
  await page.waitForTimeout(500)
  const res = await page.evaluate(async () => {
    const top = stack[stack.length - 1]; if (!top) return { n: 0, bad: [], none: "окно не открылось" }
    const sel = 'input[type="time"], input[type="date"], input[type="datetime-local"]'
    const n = top.el.querySelectorAll(sel).length, bad = []
    for (let i = 0; i < n; i++) {
      const el = top.el.querySelectorAll(sel)[i]; if (!el) { bad.push("поле " + i + " пропало"); continue }
      const id = el.id || el.dataset.f || el.dataset.k || el.type
      const vals = el.type === "time" ? ["10:00", "10:25"] : el.type === "date" ? ["2026-11-20", "2026-11-21"] : ["2026-11-20T10:00", "2026-11-20T10:25"]
      el.focus()
      for (const v of vals) {   // два шага, как час и минуты на колёсике
        el.value = v
        el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }))
        await new Promise(r => setTimeout(r, 120))
        if (!el.isConnected) { bad.push(id + ": поле пересоздано после выбора " + v); break }
        if (stack[stack.length - 1] !== top) { bad.push(id + ": окно закрылось после выбора " + v); break }
        if (el.offsetParent && document.activeElement !== el) { bad.push(id + ": поле потеряло фокус после выбора " + v); break }
        if (el.value !== v) { bad.push(id + ": значение сброшено (" + el.value + " вместо " + v + ")"); break }
      }
    }
    return { n, bad }
  })
  if (!res.n) { check(!must, `${name}: ${must ? "обязательное окно без полей времени" : "пропущено"}`, opened || res.none || "полей времени нет"); continue }
  reached++; fields += res.n
  check(!res.bad.length, `${name}: полей ${res.n}, выбор не закрывает и не пересоздаёт`, res.bad)
}
await closeAll()
check(reached >= 6, `проверено окон: ${reached}, полей: ${fields}`, reached)
// значение из редактора плана сохранилось
check(await page.evaluate(() => D.goals.some(g => g.kind === "wt" && g.tm === "10:25")), "план недели: время сохранено без перерисовки")
check(!errors.length, "ошибок в консоли нет", errors.slice(0, 3))
await browser.close(); server.close()
console.log(ok ? "TIME_INPUT_OK" : "TIME_INPUT_FAIL")
process.exit(ok ? 0 : 1)
