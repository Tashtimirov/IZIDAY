// Проверка «как тестировщик»: каждый раздел на трёх размерах iPhone (SE, 14, Pro Max), светлая и тёмная тема,
// взрослый и ребёнок. В каждом разделе нажимается каждая кнопка (кроме выхода и удаления), после нажатия —
// ошибки на странице, карточка «Не получилось показать», вылезание за край экрана, белые поля в тёмной теме.
//   node tests/qa_explore.mjs [--quick]   → итог QA_OK или список ✗; подробности build/qa-explore.md
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const OUT = new URL("../build/", import.meta.url).pathname
const QUICK = process.argv.includes("--quick")
const SIZES = QUICK ? [[390, 844, "iPhone 14"]] : [[375, 667, "iPhone SE"], [390, 844, "iPhone 14"], [430, 932, "iPhone Pro Max"]]
const TABS = ["today", "plans", "chat", "money", "health", "more"]
const SKIP = /Выйти|Удалить аккаунт|Удалить всё|Стереть|Сбросить|Выход|Log out|Delete account/i
const found = new Map()   // ключ → { what, where, n }
const add = (what, where) => { const k = what + "|" + where.replace(/^[^:]+: /, ""); const f = found.get(k); if (f) { f.n++; f.places.add(where.split(":")[0]) } else found.set(k, { what, where, n: 1, places: new Set([where.split(":")[0]]) }) }

const time = new Date("2026-11-12T03:30:00Z")
for (const [w, h, dev] of SIZES) for (const dark of [false, true]) for (const role of ["adult", "kid"]) {
  if (role === "kid" && (QUICK || w !== 390)) continue
  const tag = `${dev}, ${dark ? "тёмная" : "светлая"}, ${role === "kid" ? "ребёнок" : "взрослый"}`
  const { page, browser, server, errors } = await boot2({ root, time, dark, h, ctxOpts: { viewport: { width: w, height: h } },
    events: ({ bkk, iso }) => [{ id: "e1", title: "Встреча с застройщиком по проекту", s: iso(bkk(0, 10)), e: iso(bkk(0, 11)), calendar: "Работа" },
      { id: "e2", title: "Бассейн", s: iso(bkk(0, 17)), e: iso(bkk(0, 18)), calendar: "Личное" }] })
  page.on("dialog", d => d.dismiss().catch(() => {}))
  await page.evaluate(async () => { try {
    const now = Date.now()
    upsert("money", { id: "q1", date: now, type: "expense", amount: 1250, method: "cash", category: "Кафе и рестораны", comment: "ужин с семьёй в ресторане на пляже" })
    upsert("money", { id: "q2", date: now - 864e5, type: "income", amount: 85000, method: "card", category: "Зарплата", comment: "" })
    remAdd({ title: "Позвонить в банк и уточнить комиссию за перевод", due: null })
    await addWater(250, "widget")
    upsert("food", { id: "f1", date: now, title: "Омлет", kcal: 320, p: 20, f: 22, c: 4 })
    upsert("habits", { id: "h1", date: now, title: "Зарядка", days: [] })
    shopAdd(["молоко", "хлеб"]); goalAdd("wish", ["Увидеть северное сияние"])
    D.chat.push({ role: "user", text: "привет", at: now }, { role: "assistant", text: "Привет! Чем помочь?", at: now + 1 }); save(false)
  } catch (e) { console.error("подготовка: " + e) } })
  if (role === "kid") {
    // семья: папа + ребёнок, затем смотрим глазами ребёнка
    const ask = async v => { await page.waitForSelector("#ask-v"); await page.fill("#ask-v", String(v)); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(350) }
    await page.evaluate(() => { setTab("plans"); plansF = "fam"; render() }); await page.waitForTimeout(200)
    await page.click('[data-f="new"]'); await ask("Папа"); await ask("Таштимировы"); await page.waitForTimeout(600)
    await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close(); D.fam.shareAsked = 1; render() }); await page.waitForTimeout(300)
    await page.click('[data-f="kid"]'); await ask("Миша"); await ask(9); await page.waitForTimeout(600)
    await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close()
      const kid = FAM.members().find(m => m.name === "Миша").id
      FAM.put("tasks", { id: "t1", kid, title: "Собрать рюкзак", stars: 5, days: [], when: "вечером" })
      FAM.put("events", { id: "f1", title: "Плавание", who: kid, day: dayKey(new Date()), time: "16:00", min: 60, place: "Бассейн", by: FAM.meId() })
      D.fam.id = kid; D.fam.role = "kid"; D.fam.name = "Миша"; save(false); setTab("today"); render() })
    await page.waitForTimeout(600)
  }
  const closeAll = () => page.evaluate(() => { if (typeof stack === "undefined") return; try { while (stack.length) stack[stack.length - 1].close() } catch (e) {} document.querySelectorAll("#layer > *").forEach(x => x.remove()) })
  const isApp = () => page.evaluate(() => typeof setTab === "function" && location.pathname.endsWith("/")).catch(() => false)
  const ensureApp = async () => { for (let k = 0; k < 4; k++) { if (await isApp()) return true
      await page.waitForLoadState("load").catch(() => {}); await page.waitForTimeout(1500); if (await isApp()) return true
      await page.goBack().catch(() => {}); await page.waitForTimeout(1500) } return false }
  const probe = (where) => page.evaluate(({ where, dark }) => {
    const out = [], vw = innerWidth
    if (/Не получилось показать/.test(document.body.innerText)) out.push(["карточка «Не получилось показать»", where])
    if (document.documentElement.scrollWidth > vw + 1) out.push([`страница шире экрана (${document.documentElement.scrollWidth} > ${vw})`, where])
    const scrollable = el => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/auto|scroll|hidden|clip/.test(s.overflowX)) return true } return false }
    for (const el of document.querySelectorAll("#view *, #layer *, #top *, #tabs *")) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue
      const s = getComputedStyle(el); if (s.visibility === "hidden" || s.display === "none" || +s.opacity === 0) continue
      if ((r.right > vw + 2 || r.left < -2) && !scrollable(el) && !/fixed/.test(s.position) && r.top < innerHeight * 3) {
        const name = (el.id ? "#" + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""))
        out.push([`за краем экрана: ${name} «${(el.innerText || el.value || "").trim().slice(0, 40)}» (${Math.round(r.left)}…${Math.round(r.right)} из ${vw})`, where]); if (out.length > 6) break
      }
      if (dark && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== "checkbox" && el.type !== "radio" && el.type !== "range" && el.type !== "file" && el.type !== "color") {
        const bg = s.backgroundColor.match(/\d+(\.\d+)?/g) || []
        if (bg.length >= 3 && +bg[0] > 230 && +bg[1] > 230 && +bg[2] > 230 && (bg[3] === undefined || +bg[3] > 0.5)) out.push([`белое поле в тёмной теме: ${el.name || el.id || el.placeholder || el.type}`, where])
      }
    }
    return out
  }, { where, dark })
  const errStart = () => errors.length
  for (const t of TABS) {
    if (role === "kid" && t === "money") continue
    if (!(await ensureApp())) { add("приложение не вернулось", tag); break }
    await closeAll(); await page.evaluate(t => { setTab(t); window.scrollTo(0, 0) }, t); await page.waitForTimeout(350)
    const where = `${tag}: ${t}`
    for (const [what, wh] of await probe(where)) add(what, wh)
    const n = await page.evaluate(src => { const SK = new RegExp(src, "i"); const els = [...document.querySelectorAll("#view button, #view [data-a], #view [data-act], #view [onclick], #view .row[data-id], #view a[href^='#']")]
      .filter(e => e.offsetParent && !SK.test(e.innerText || ""))
      els.forEach((e, i) => e.setAttribute("data-qa", i)); return els.length }, SKIP.source)
    const max = QUICK ? Math.min(n, 25) : Math.min(n, 70)
    for (let i = 0; i < max; i++) {
      const e0 = errStart()
      const label = await page.evaluate(i => { const e = document.querySelector(`[data-qa="${i}"]`); if (!e || !e.offsetParent) return null
        const l = (e.innerText || e.getAttribute("aria-label") || e.dataset.a || e.className || "").trim().replace(/\s+/g, " ").slice(0, 40)
        if (/Выйти|Удалить аккаунт|Стереть|Сбросить/i.test(l)) return null
        try { e.scrollIntoView({ block: "center" }); e.click() } catch (err) { console.error("клик: " + err) } return l }, i)
      if (label === null) continue
      await page.waitForTimeout(220)
      const w2 = `${where} → «${label}»`
      for (const [what, wh] of await probe(w2)) add(what, wh)
      for (const er of errors.slice(e0)) add("ошибка на странице: " + er.slice(0, 200), w2)
      // нажатие открыло другую страницу (форма недочётов, политика) — вернуться назад
      if (!(await ensureApp())) { add("не вернуться в приложение после нажатия", w2); break }
      // если нажатие увело в другой раздел или открыло окно — вернуться и заново разметить кнопки
      await closeAll()
      const back = await page.evaluate(t => { const cur = typeof tab !== "undefined" ? tab : null; if (cur !== t) { setTab(t) } else render()
        const els = [...document.querySelectorAll("#view button, #view [data-a], #view [data-act], #view [onclick], #view .row[data-id], #view a[href^='#']")].filter(e => e.offsetParent && !/Выйти|Удалить аккаунт|Удалить всё|Стереть|Сбросить/i.test(e.innerText || ""))
        els.forEach((e, j) => e.setAttribute("data-qa", j)); return els.length }, t)
      await page.waitForTimeout(120)
      if (back < i) break
    }
  }
  // меню «+», поиск, настройки, «Сообщить об ошибке»
  for (const sel of ["#add", "#find", "#gear", "#bugq"]) {
    if (!(await ensureApp())) break
    await closeAll(); await page.evaluate(() => setTab("today")); const e0 = errStart()
    await page.evaluate(sel => { const b = document.querySelector(sel); b && b.click() }, sel); await page.waitForTimeout(400)
    for (const [what, wh] of await probe(`${tag}: ${sel}`)) add(what, wh)
    for (const er of errors.slice(e0)) add("ошибка на странице: " + er.slice(0, 200), `${tag}: ${sel}`)
  }
  for (const er of errors) if (![...found.values()].some(f => f.what.includes(er.slice(0, 60)))) add("ошибка на странице: " + er.slice(0, 200), tag)
  console.log(`  ${tag}: готово, ошибок на странице ${errors.length}`)
  await browser.close(); server.close()
}
const list = [...found.values()]
const md = ["# Проверка всех кнопок по разделам", "", ...list.map(f => `- ${f.what} — ${f.where} (${f.n}×; ${[...f.places].join("; ")})`)]
fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(OUT + "qa-explore.md", md.join("\n") + "\n")
for (const f of list) console.log(`✗ ${f.what} — ${f.where} (${f.n}×)`)
console.log(list.length ? `QA_FAIL: ${list.length}` : "QA_OK")
