// Игра IZIDAY (gami.js): баллы из данных, потолок, чистый день ×2, ранги, ачивки, награды, заморозка, лига в таблице, инструменты Изи.
// Снимки — build/web-shots/gm-*
import fs from "fs"
import { boot2, shot } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const time = new Date("2026-11-05T11:00:00+07:00")
const { page, browser, server, errors, sheet } = await boot2({ root, time, lists: ({ bkk, dk }) => {
  const hlog = [], rems = [], water = []
  for (let i = 1; i <= 16; i++) hlog.push({ id: `h:hz:${dk(bkk(-i, 0))}`, date: +bkk(-i, 0), u: 1, habit: "hz", day: dk(bkk(-i, 0)) })
  for (let i = 1; i <= 5; i++) { rems.push({ id: "p" + i, date: +bkk(-9, 9), u: 1, title: "Дело " + i, due: dk(bkk(-i, 0)), done: true, doneAt: +bkk(-i, 11) }); water.push({ id: "w" + i, date: +bkk(-i, 12), u: 1, ml: 2600 }) }
  rems.push({ id: "ra", date: +bkk(-2, 9), u: 1, title: "Отправить договор", due: dk(bkk(0, 0)), done: false }, { id: "rb", date: +bkk(-2, 9), u: 1, title: "Позвонить маме", due: dk(bkk(0, 0)), done: false })
  return { habits: [{ id: "hz", date: +bkk(-17, 9), u: 1, title: "Зарядка" }], hlog, rems, water,
    goals: [{ id: "t3", date: +bkk(0, 8), u: 1, kind: "top3", day: dk(bkk(0, 0)), ids: ["ra"] }] }
} })

let st = await page.evaluate(() => { const s = GAMI.stats(); return { earned: s.earned, lv: s.lv, today: s.today.total, streak: s.streak, clean: s.today.clean } })
check(st.earned > 0 && st.lv >= 2, "баллы посчитаны из прошлых дней, ранг вырос", st)
check(st.streak >= 5, "серия дней с баллами", st)
check(st.clean.total === 3 && !st.clean.ok, "чистый день: 2 дела + привычка, пока не закрыт", st.clean)
check(await page.evaluate(() => !!$(".gstrip") && /сегодня/.test($(".gstrip").textContent)), "на «Сегодня» — полоска ранга")
check(await page.evaluate(() => $$(".top3 .gp").some(e => e.textContent === "+20")), "у главного дела «+20»")

// дело → +20, привычка с серией 16 → ×1,5; всё закрыто → чистый день ×2
const t0 = st.today
await page.evaluate(() => { remSet("ra", { completed: true }); render() })
let t1 = await page.evaluate(() => GAMI.stats().today)
check(t1.items.some(i => i.t === "Отправить договор" && i.p === 20), "главное дело дало 20", t1.items)
await page.evaluate(() => { remSet("rb", { completed: true }); habitToggle(D.habits.find(h => h.id === "hz"), new Date()); render() })
t1 = await page.evaluate(() => GAMI.stats().today)
check(t1.items.some(i => i.t === "Зарядка" && i.p === 8), "привычка на 17-й день: 5 × 1,5 = 8", t1.items)
check(t1.clean.ok && t1.bonus === t1.capped, "чистый день удвоил баллы", t1)
check(await page.evaluate(() => !!$(".gclean.ok")), "на «Сегодня» — «Чистый день ×2»")

// потолок 250 в день
const cap = await page.evaluate(() => { for (let i = 0; i < 40; i++) upsert("rems", { id: "x" + i, date: Date.now(), title: "Мелочь " + i, due: dayKey(new Date()), done: true, doneAt: Date.now() }); const s = GAMI.stats(); return { base: s.today.base, capped: s.today.capped } })
check(cap.base > 250 && cap.capped === 250, "потолок 250 баллов в день", cap)
await page.evaluate(() => { for (let i = 0; i < 40; i++) remove("rems", "x" + i) })

// повторяющееся дело хранит историю отметок
const rep = await page.evaluate(() => { const r = remAdd({ title: "Полить цветы", due: dayKey(new Date()), repeat: { freq: "daily" } }); remSet(r.id, { completed: true }); const x = D.rems.find(z => z.id === r.id); return { hist: x.hist, pts: GAMI.stats().today.items.some(i => i.t === "Полить цветы") } })
check(rep.hist && rep.hist.length === 1 && rep.pts, "повторяющееся дело: баллы и история отметок", rep)

// ачивки
const ach = await page.evaluate(() => { GAMI.tick(); return GAMI.achList(GAMI.stats()).filter(a => a.ok).map(a => a.key) })
check(ach.includes("first") && ach.includes("fire7") && ach.includes("clean1"), "ачивки: первый шаг, неделя огня, чистый день", ach)
check(await page.evaluate(() => live(D.goals).filter(g => g.kind === "ach").length === GAMI.achList(GAMI.stats()).filter(a => a.ok).length), "ачивки записаны в goals (синхронизируются)")

// «Мой путь» в «Планах»
for (const seg of ["path", "ach", "rew", "lg"]) { await page.evaluate(s => GAMI.openGame(s), seg); await page.waitForTimeout(150); await shot(page, `${SHOTS}gm-${seg}.png`) }
check(await page.evaluate(() => tab === "plans" && $$(".gseg button").length === 4 && !!$(".pf [data-pf=game].on")), "«Мой путь»: Путь · Ачивки · Награды · Лига")

// награды: покупка списывает баланс, ранг не падает
const buy = await page.evaluate(async () => {
  upsert("goals", { id: "rw1", date: Date.now(), kind: "reward", title: "Кофе", cost: 100, ico: "coffee" }); save(false)
  const a = GAMI.stats(); GAMI.openGame("rew"); await new Promise(r => setTimeout(r, 100))
  $('[data-gbuy="rw1"]').click(); await new Promise(r => setTimeout(r, 300))
  $$("#layer .btn").find(b => b.textContent === "Получить").click(); await new Promise(r => setTimeout(r, 400))
  const b = GAMI.stats(); while (stack.length) stack[stack.length - 1].close()
  return { a: [a.balance, a.earned, a.lv], b: [b.balance, b.earned, b.lv] }
})
// первая покупка ещё и открывает ачивку «Заслужил» (+25)
check(buy.b[0] === buy.a[0] - 100 + 25 && buy.b[1] === buy.a[1] + 25 && buy.b[2] >= buy.a[2], "награда: −100 со счёта, заработанное не уменьшилось (+25 за ачивку «Заслужил»)", buy)

// награда по SMART: совет цены по темпу, «слишком легко» и «слишком высоко для срока»
const sm = await page.evaluate(() => { const st = GAMI.stats(), p = GAMI.pace(st), wk = dayKey(addDays(new Date(), 7))
  return { p, rec: GAMI.smartOf(0, wk, st).rec, low: GAMI.smartOf(60, wk, st).v, high: GAMI.smartOf(20000, wk, st).v, ok: GAMI.smartOf(GAMI.smartOf(0, wk, st).rec, wk, st).v } })
check(sm.p > 0 && sm.rec === Math.max(50, Math.round(sm.p * 0.7 * 7 / 50) * 50), "совет цены: 70% темпа × дни до срока", sm)
check(sm.low === "low" && sm.high === "high" && sm.ok === "ok", "подсказка: низко, высоко, в самый раз", sm)
await page.evaluate(() => GAMI.openGame("rew")); await page.waitForTimeout(100)
await page.evaluate(() => $('[data-g="rew-add"]').click()); await page.waitForTimeout(350)
await page.fill("#rw-t", "Массаж"); await page.fill("#rw-c", "20000"); await page.dispatchEvent("#rw-c", "input"); await page.waitForTimeout(100)
check(await page.evaluate(() => $("#rw-h").classList.contains("high") && !!$("#rw-h [data-rec]")), "форма: слишком высоко — кнопка «Поставить …»")
await page.evaluate(() => { const t = $("#gtoast"); if (t) t.classList.remove("show"); $(".sheet:last-child").scrollTop = 400 }); await page.waitForTimeout(300); await page.screenshot({ path: `${SHOTS}gm-smart-high.png` })
await page.evaluate(() => $("#rw-h [data-rec]").click()); await page.waitForTimeout(100)
check(await page.evaluate(() => $("#rw-h").classList.contains("ok")), "после совета — «в самый раз»")
await shot(page, `${SHOTS}gm-smart.png`)
await page.evaluate(() => $('#layer [data-a="ok"]').click()); await page.waitForTimeout(300)
const rw = await page.evaluate(() => live(D.goals).find(g => g.kind === "reward" && g.title === "Массаж"))
check(rw && rw.due && rw.cost < 20000, "награда сохранена со сроком и честной ценой", rw)
const iz = await page.evaluate(() => runTool("add_reward", { title: "Кофе", cost: 5000, due: dayKey(addDays(new Date(), 1)) }))
check(iz.verdict === "high" && iz.recommended < 5000, "Изи: add_reward подсказывает, что цена высока для срока", iz)

// заморозка: пропущенный вчера день не рвёт серию
const fr = await page.evaluate(() => {
  const y = dayKey(addDays(new Date(), -1))
  upsert("goals", { id: "z1", date: Date.now(), kind: "freeze", day: y })
  for (const r of D.rems) if (r.doneAt && sameDay(r.doneAt, addDays(new Date(), -1))) upsert("rems", Object.assign({}, r, { doneAt: +addDays(new Date(), -3) }))
  for (const x of D.hlog) if (x.day === y) remove("hlog", x.id)
  for (const w of D.water) if (sameDay(w.date, addDays(new Date(), -1))) remove("water", w.id)
  return GAMI.stats().streak
})
check(fr >= 5, "заморозка держит серию", fr)

// Изи: инструменты
const izi = await page.evaluate(async () => ({ p: await runTool("get_progress", {}), r: await runTool("add_reward", { title: "Вечер кино", cost: 500 }), sys: agentSystem() }))
check(izi.p.rank && izi.p.points_total > 0 && izi.p.rules, "get_progress: ранг, баллы, правила", izi.p)
check(izi.r.ok && /get_progress/.test(izi.sys), "add_reward и правило в подсказке Изи", izi.r)

// лига в таблице: создать (с ключом), вступить и прислать итоги (без ключа), вызов
const SECRET = "s".repeat(32)
let r = sheet.post(JSON.stringify({ league: { op: "new", name: "Семья" } }))
check(!r.ok, "без ключа таблицы лигу не создать", r)
r = sheet.post(JSON.stringify({ secret: SECRET, league: { op: "new", name: "Семья" } }))
check(r.ok && r.league && r.league.code, "хозяин создаёт лигу", r)
const code = r.league.code
r = sheet.post(JSON.stringify({ league: { op: "put", code, id: "olya", name: "Оля", rank: "Практик", level: 3, streak: 9, week: "2026-11-02", pts: 610, steps: 35900, water: 3 } }))
check(r.ok && r.league.members.olya.weeks["2026-11-02"].pts === 610, "друг вступает и присылает баллы недели", r)
r = sheet.post(JSON.stringify({ league: { op: "challenge", code, id: "olya", kind: "steps", week: "2026-11-02", title: "Кто больше шагов", stake: "ужин" } }))
check(r.ok && r.league.challenges.length === 1, "вызов на шаги", r)
check(!sheet.post(JSON.stringify({ league: { op: "put", code: "nope", id: "x" } })).ok, "чужой код — нет такой лиги")
check(!JSON.stringify(r).includes(SECRET), "в ответе лиги нет ключа таблицы")

check(!errors.length, "без ошибок в консоли", errors)
await browser.close(); server.close()
console.log(ok ? "GAMI_OK" : "GAMI_FAIL")
