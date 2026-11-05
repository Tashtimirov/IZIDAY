// Здоровье 2.0: готовность, сон, закономерности, настроение и дыхание, дневник с паролем, вода-сосуд, лекарства с пушами,
// план тренировок, тренд веса, медкарта семьи, отчёт за месяц. Снимки — build/web-shots/health-*
import fs from "fs"
import { boot2, shot } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const NOW = new Date("2026-11-05T03:11:00Z")   // чт 10:11 по Бангкоку
const SLEEP = [6.2, 7.6, 8.1, 5.4, 6.8, 6.1, 7.2]   // пт…чт
const lists = ({ bkk, dk }) => {
  const t = (d, h, m = 0) => +bkk(d, h, m)
  const food = [], water = [], weight = [], workouts = [], goals = []
  for (let i = 1; i <= 40; i++) {
    const short = i % 4 === 0   // каждая 4-я ночь короткая — после неё едим больше и без тренировки
    food.push({ id: "f" + i, date: t(-i, 13), u: 1, title: "Обед", kcal: short ? 2500 : 2050, protein: 120 })
    water.push({ id: "w" + i, date: t(-i, 11), u: 1, ml: 2000 + (i % 3) * 300 })
    if (!short && i % 2) workouts.push({ id: "t" + i, date: t(-i, 7), u: 1, title: "Зал", minutes: 45, kcal: 380 })
    if (i % 3 === 0) weight.push({ id: "kg" + i, date: t(-i, 8), u: 1, kg: 91.2 + i * 0.06 + (i % 2 ? .4 : -.3) })
    goals.push({ id: "mo" + i, date: t(-i, 20), u: 1, kind: "mood", day: dk(bkk(-i, 12)), v: short ? 2 : (i % 5 ? 4 : 3) })
  }
  weight.push({ id: "kg0", date: t(0, 7), u: 1, kg: 91.2 })
  food.push({ id: "f0", date: t(0, 8, 30), u: 1, title: "Омлет и кофе", kcal: 420, protein: 28, fat: 24, carbs: 12 })
  water.push({ id: "w0", date: t(0, 8), u: 1, ml: 500 }, { id: "w01", date: t(0, 9, 40), u: 1, ml: 450 })
  goals.push(
    { id: "hcfg", kind: "hcfg", date: 1, u: 1, wake: "06:30", need: 7.5, wgoal: 86 },
    { id: "me1", kind: "med", date: 1, u: 1, title: "Витамин D 2000", dose: "1 капсула", times: ["08:00"], stock: 40, taken: { [dk(bkk(0, 12))]: ["08:00@08:20"] } },
    { id: "me2", kind: "med", date: 2, u: 1, title: "Омега-3", dose: "с обедом", times: ["13:00"], stock: 6, taken: {} },
    { id: "mr1", kind: "medrec", date: 1, u: 1, who: "Я", title: "Общий анализ крови", last: "2025-09-10", every: 12 },
    { id: "mr2", kind: "medrec", date: 2, u: 1, who: "Сын", title: "Прививка", next: "2026-12-12", every: 0 },
    { id: "mr3", kind: "medrec", date: 3, u: 1, who: "Оля", title: "Стоматолог", last: "2026-09-15", every: 6 },
    { id: "wplan", kind: "wplan", date: 1, u: 1, goal: "−6 кг и сила", items: [{ wd: 1, title: "Грудь и спина", min: 45, time: "07:00" }, { wd: 2, title: "Падел", min: 120, time: "18:00" }, { wd: 4, title: "Ноги · +2,5 кг к приседу", min: 45, time: "18:30" }, { wd: 6, title: "Бег 5 км, темп 6:10", min: 35, time: "07:00" }] },
  )
  workouts.push({ id: "tp1", date: t(-3, 7), u: 1, title: "Зал", minutes: 45, kcal: 380 }, { id: "tp2", date: t(-2, 18), u: 1, title: "Падел", minutes: 120, kcal: 900 })
  return { food, water, weight, workouts, goals }
}
const { page, browser, server, errors, bkk, dk } = await boot2({ root, time: NOW, lists })
// история сна и пульса — как присылает виджет (snap.health); сегодня — snap.watch
await page.evaluate(({ days, today }) => {
  D.snap.health = days; D.snap.watch = Object.assign({}, D.snap.watch, today); save(false); render()
}, { days: [...Array(40)].map((_, i) => { const d = 40 - i, h = d <= 6 ? SLEEP[6 - d] : (d % 4 === 0 ? 5.5 : 7.3)
    return { day: dk(bkk(-d, 12)), steps: 6000 + (d % 5) * 1500, active: 420, exercise: d === 1 ? 50 : 30, sleep: h * 60, rhr: 57 + (d % 3), bed: d % 2 ? "23:10" : "00:40", updated: 1 } }),
  today: { sleep: 432, rhr: 58, bed: "23:15", wake: "06:30" } })
await page.evaluate(() => setTab("health")); await page.waitForTimeout(3600); await page.evaluate(() => render())
const txt = () => page.$eval("#view", v => v.innerText)
let t = await txt()
const sshot = async f => { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500); await page.screenshot({ path: f }) }
const sp = s => String(s).replace(/ /g, " ")
check(/Готовность сегодня/.test(t) && /\d+ из 100/.test(t.replace(/\n/g, " ")), "готовность показана", t.slice(0, 300))
check(/готовность \d+/.test(await page.$eval("#top-sub", e => e.textContent)), "в шапке «Сегодня · готовность N»")
check(/Сон/.test(t) && /лечь до 23:00/.test(t.replace(/\n/g, " ")), "сон: совет лечь до 23:00", t.match(/Сон[\s\S]{0,300}/)?.[0])
check(/Ложитесь в разное время/.test(t), "сон: неровный режим замечен")
check(/Закономерность/.test(t) && /ккал больше/.test(t), "закономерность про сон и еду найдена", t.match(/Законом[\s\S]{0,200}/)?.[0])
check(/Как вы сейчас/.test(t) && /Дыхание 1 мин/.test(t) && /Дневник/.test(t), "настроение, дыхание, дневник")
check(/0,95 л/.test(t) && /сосуд наполняется/.test(t), "вода-сосуд", t.match(/Вода[\s\S]{0,120}/)?.[0])
check(/Витамин D 2000/.test(t) && /принят 08:20/.test(t) && /осталось 6/.test(t) && /в покупки/.test(t), "лекарства: принят и «заканчивается»")
check(/План тренировок/.test(t) && /Падел/.test(t) && /сделано/.test(t) && /Ноги[^\n]*\n[^\n]*сегодня/.test(t), "план тренировок со статусами")
check(/Тренд −0,\d кг в неделю/.test(t) && /Цель 86 кг — примерно/.test(t), "тренд веса с прогнозом", t.match(/Тренд[^\n]*/)?.[0])
check(/Медкарта семьи/.test(t) && /Общий анализ крови/.test(t) && /пора/.test(t) && /Записаться/.test(t) && /Сын · Прививка/.test(t), "медкарта семьи")
check(/Отчёт за месяц/.test(t) && /PDF для врача/.test(t), "отчёт за месяц")
// подсказки пушем: лекарства (Омега в 13:00), «скоро спать» в 22:30
const nd = await page.evaluate(() => live(D.nudges).filter(n => /^(md|sl|mr)/.test(n.id)).map(n => ({ id: n.id, at: new Date(n.date).toTimeString().slice(0, 5), text: n.text })))
check(nd.some(n => /Омега/.test(n.text) && n.at === "13:00") && !nd.some(n => /Витамин D/.test(n.text) && n.at === "08:00" && n.id.includes("1105")) && nd.some(n => n.id.startsWith("sl") && n.at === "22:30"), "пуши: лекарство и «скоро спать»", nd)
await shot(page, SHOTS + "health-1.png")
// отметка лекарства
await page.click('[data-med="me2"]'); await page.waitForTimeout(600)
const m2 = await page.evaluate(() => D.goals.find(g => g.id === "me2"))
const nd2 = await page.evaluate(() => live(D.nudges).filter(n => n.id.startsWith("mdme2")).map(n => new Date(n.date).getDate()))
check(m2.stock === 5 && Object.values(m2.taken)[0].length === 1 && !nd2.includes(5), "принял Омегу: запас −1, сегодняшний пуш снят", { m2, nd2 })
await page.click('[data-medshop="me2"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => shopOpen().some(s => /Омега/.test(s.title))), "Омега-3 → в покупки")
// настроение
await page.click('[data-mood="4"]'); await page.waitForTimeout(700)
check(await page.evaluate(() => live(D.goals).filter(g => g.kind === "mood" && g.day === dayKey(new Date())).length) === 1, "настроение записано")
// дневник: открытая запись, потом закрыть паролем → в данных только шифр
await page.click('[data-hl="diary"]'); await page.waitForTimeout(500)
await page.fill("#dy-t", "Хороший день. Падел вечером, спал нормально.")
await page.click('.sheet:last-child [data-a="ok"]'); await page.waitForTimeout(900)
check(await page.evaluate(() => live(D.goals).some(g => g.kind === "diary" && /Падел/.test(g.text))), "запись в дневнике")
await page.waitForTimeout(400)
await sshot(SHOTS + "health-diary.png")
await page.click('.sheet:last-child [data-a="lock"]'); await page.waitForTimeout(700)
await page.fill("#hp1", "1234"); await page.fill("#hp2", "1234")
await sshot(SHOTS + "health-pass.png")
await page.click('.sheet:last-child [data-a="ok"]'); await page.waitForTimeout(2500)
const dy = await page.evaluate(() => live(D.goals).filter(g => g.kind === "diary"))
check(dy.length === 1 && /^p1:/.test(dy[0].sealed) && !dy[0].text && !JSON.stringify(dy).includes("Падел"), "с паролем в данных только шифр", dy)
const back = await page.evaluate(async () => { HEALTH.tmpVault.forget(); const ok1 = await HEALTH.tmpVault.unlock("0000"); const ok2 = await HEALTH.tmpVault.unlock("1234"); return { ok1, ok2, list: await HEALTH.diaryRead() } })
check(!back.ok1 && back.ok2 && /Падел/.test(back.list[0].text), "неверный пароль не открывает, верный — открывает", back)
await page.evaluate(() => { document.querySelectorAll(".sheet, .scrim").forEach(e => e.remove()); stack.length = 0 })
// дыхание
await page.click('[data-hl="breath"]'); await page.waitForTimeout(1500)
await sshot(SHOTS + "health-breath.png")
await page.evaluate(() => { document.querySelectorAll(".sheet, .scrim").forEach(e => e.remove()); stack.length = 0 })
// отчёт
await page.click('[data-hl="report"]'); await page.waitForTimeout(900)
const rep = await page.$eval(".sheet:last-child iframe", f => f.contentDocument.body.innerText)
check(/Вес/.test(rep) && /Сон/.test(rep) && /Омега-3/.test(rep) && /Шагов в день/.test(rep) && /Анализы и врачи/i.test(rep), "отчёт: вес, сон, лекарства, шаги, медкарта", rep.slice(0, 400))
await sshot(SHOTS + "health-report.png")
await page.evaluate(() => { document.querySelectorAll(".sheet, .scrim").forEach(e => e.remove()); stack.length = 0 })
// медкарта: «Записаться» → напоминание
await page.click('[data-mrbook="mr1"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => live(D.rems).some(r => /Записаться: Общий анализ крови/.test(r.title))), "«Записаться» → напоминание на сегодня")
// формы
await page.click('[data-hl="med-add"]'); await page.waitForTimeout(500); await sshot(SHOTS + "health-medform.png")
await page.evaluate(() => { document.querySelectorAll(".sheet, .scrim").forEach(e => e.remove()); stack.length = 0 })
await page.click('[data-hl="sleep"]'); await page.waitForTimeout(500); await sshot(SHOTS + "health-sleepform.png")
await page.evaluate(() => { document.querySelectorAll(".sheet, .scrim").forEach(e => e.remove()); stack.length = 0 })
// инструменты Изи
const r = await page.evaluate(async () => ({
  sleep: await runTool("log_sleep", { bed: "23:40", wake: "06:50" }),
  med: await runTool("add_med", { title: "Магний", times: ["22:00"], stock: 30 }),
  taken: await runTool("med_taken", { title: "магний" }),
  rec: await runTool("add_medrec", { who: "Я", title: "Стоматолог", last: "2026-03-01", every_months: 6 }),
  plan: await runTool("set_workout_plan", { goal: "сила", items: [{ day: "пн", title: "Жим 60 кг 5×5", minutes: 50, time: "07:00" }, { day: "пятница", title: "Бег 6 км", minutes: 40 }] }),
  set: await runTool("health_settings", { wake: "07:00" }),
  get: await runTool("get_health", {}),
  sys: agentSystem() }))
check(r.sleep.ok && Math.abs(r.sleep.hours - 7.17) < .05 && r.sleep.readiness > 0, "log_sleep", r.sleep)
check(r.med.ok && r.taken.ok && r.taken.stock === 29, "add_med и med_taken", { m: r.med, t: r.taken })
check(r.rec.ok && r.rec.due === "2026-09-01", "add_medrec считает срок", r.rec)
check(r.plan.ok && r.plan.days === 2 && r.set.bedtime === "23:30", "set_workout_plan и health_settings", { p: r.plan, s: r.set })
check(r.get.readiness && r.get.sleep_last_night && r.get.meds_today.length === 3 && r.get.workout_plan.items.length === 2 && r.get.weight_trend.goal === 86 && r.get.patterns.length, "get_health: сон, готовность, лекарства, план, вес, закономерности", Object.keys(r.get))
check(/Дневник пользователя личный/.test(r.sys) && /set_workout_plan/.test(r.sys), "Изи знает про здоровье и не читает дневник")
// прошлый день — сон и настроение той ночи
await page.evaluate(() => { selDay = addDays(sod(new Date()), -2); render() }); await page.waitForTimeout(500)
check(/Сон и самочувствие/.test(await txt()), "прошлый день: сон и настроение")
await page.evaluate(() => { selDay = sod(new Date()); render() })
// пустое состояние
await page.evaluate(() => { D.goals = D.goals.filter(g => !["med", "medrec", "wplan", "sleep", "mood"].includes(g.kind)); D.weight = []; D.snap.health = []; delete D.snap.watch.sleep; delete D.snap.watch.rhr; save(false); render() })
await page.waitForTimeout(600); t = await txt()
check(/Нужен сон этой ночи/.test(t) && /Ищу закономерности/.test(t) && /Составит Изи/.test(t), "пустое состояние объясняет, что делать")
await shot(page, SHOTS + "health-empty.png")
check(!errors.filter(e => !/favicon/.test(e)).length, "без ошибок в консоли", errors)
await browser.close(); server.close()
// тёмная тема
const b2 = await boot2({ root, time: NOW, lists, dark: true })
await b2.page.evaluate(({ days, today }) => { D.snap.health = days; D.snap.watch = Object.assign({}, D.snap.watch, today); save(false); setTab("health") },
  { days: [...Array(14)].map((_, i) => { const d = 14 - i, h = d <= 6 ? SLEEP[6 - d] : 7.3; return { day: b2.dk(b2.bkk(-d, 12)), steps: 7000, active: 420, exercise: 30, sleep: h, rhr: 58, bed: d % 2 ? "23:10" : "00:40" } }), today: { sleep: 7.2, rhr: 58 } })
await b2.page.waitForTimeout(1800)
await shot(b2.page, SHOTS + "health-dark.png")
await b2.browser.close(); b2.server.close()
console.log(ok ? "HEALTH2_OK" : "HEALTH2_FAIL")
