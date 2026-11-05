// Игра+ (quest.js): задания дня от Изи, комбо, боссы, карта пути к цели, шар Изи растёт с рангом; всё прячется в «Режиме игры: выкл.».
// Снимки — build/web-shots/q-*
import fs from "fs"
import { boot2, shot } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const dark = process.argv.includes("--dark")
const time = new Date("2026-11-05T08:40:00+07:00")
const { page, browser, server, errors } = await boot2({ root, time, dark, lists: ({ bkk, dk }) => {
  const hlog = [], rems = []
  for (let i = 2; i <= 9; i++) hlog.push({ id: `h:hz:${dk(bkk(-i, 0))}`, date: +bkk(-i, 7), u: 1, habit: "hz", day: dk(bkk(-i, 0)) })
  for (let i = 1; i <= 6; i++) rems.push({ id: "p" + i, date: +bkk(-9, 9), u: 1, title: "Дело " + i, due: dk(bkk(-i, 0)), done: true, doneAt: +bkk(-i, 11) })
  rems.push({ id: "old", date: +bkk(-14, 9), u: 1, title: "Отправить документы в банк", due: dk(bkk(-12, 0)), done: false })
  for (const [id, t] of [["ta", "Ответить Сомчаю"], ["tb", "Оплатить интернет"], ["tc", "Заказать воду"], ["td", "Купить подарок Оле"], ["te", "Записаться в барбершоп"]])
    rems.push({ id, date: +bkk(-1, 9), u: 1, title: t, due: dk(bkk(0, 0)), done: false })
  return { habits: [{ id: "hz", date: +bkk(-12, 9), u: 1, title: "Зарядка" }], hlog, rems,
    goals: [{ id: "dr", date: +bkk(-20, 9), u: 1, kind: "dream", title: "Переехать в свой дом", due: "2027-10-01",
      steps: [{ id: "s1", t: "Накопить первый взнос", done: true, at: +bkk(-6, 10) }, { id: "s2", t: "Выбрать район", done: true, at: +bkk(-2, 10) }, { id: "s3", t: "Посмотреть 5 домов", done: false, date: dk(bkk(4, 0)) },
        { id: "s4", t: "Одобрить ипотеку", done: false }, { id: "s5", t: "Подписать договор", done: false }, { id: "s6", t: "Переезд", done: false }] }] }
} })
const sfx = dark ? "-dark" : ""

// ── задания дня: три штуки под слабые места недели
const q = await page.evaluate(() => { const q = QUEST.today(); return q && q.list })
check(q && q.length === 3, "утром — три задания дня", q)
check(q.some(x => x.k === "water" && x.until === 12), "вода до 12:00 (неделя без нормы воды)", q)
check(q.some(x => x.k === "hang" && x.ref === "old"), "одно дело из висящих — самое старое", q)
check(q.some(x => x.k === "fam" || x.k === "habit"), "звонок маме или вернуть привычку", q)
check(await page.evaluate(() => !!$(".gq") && $$(".gq .gqr").length === 3), "на «Сегодня» — карточка «Задания дня»")
await page.evaluate(() => { const q = live(D.goals).filter(g => g.kind === "quests"); return q.length }).then(n => check(n === 1, "задания записаны один раз (синхронизируются)", n))

// вода до 12:00 засчитывается сама
const w = await page.evaluate(() => { upsert("water", { id: "wa", date: Date.now(), ml: 1000 }); return GAMI.stats().today.items.filter(i => i.kind === "quest").map(i => i.t) })
check(w.some(t => /воды/.test(t)), "выпил литр до 12 — задание засчитано само, +15", w)
// ручное: «Сделал»
const man = await page.evaluate(() => { const q = QUEST.today(), i = q.list.findIndex(x => x.manual || x.k === "habit"); QUEST.tap(i); return GAMI.stats().today.items.filter(i => i.kind === "quest").length })
check(man === 2, "второе задание отмечено", man)
await page.evaluate(() => setTab("today")); await page.waitForTimeout(300)
await shot(page, `${SHOTS}q-today${sfx}.png`)

// ── комбо: дела подряд
await page.evaluate(() => { for (const id of ["ta", "tb"]) remSet(id, { completed: true }); render() }); await page.waitForTimeout(200)
const c2 = await page.evaluate(() => ({ c: QUEST.combo(), pill: !!$("#gcombo.show"), cx: $$(".gp.gcx").map(e => e.textContent) }))
check(c2.c && c2.c.n === 2 && c2.c.next === 1.5, "два дела подряд — следующее даст ×1,5", c2)
check(c2.pill && c2.cx.length && c2.cx.every(t => /×1,5/.test(t)), "плашка «Комбо 2» и счётчик ×1,5 у галочек", c2)
await page.waitForTimeout(500); await shot(page, `${SHOTS}q-combo${sfx}.png`)
await page.evaluate(() => { remSet("tc", { completed: true }); render() })
const c3 = await page.evaluate(() => GAMI.stats().today.items.find(i => i.t === "Заказать воду"))
check(c3 && c3.mult === 1.5 && c3.p === 15, "третье подряд — 10 × 1,5 = 15", c3)
await page.evaluate(() => { remSet("td", { completed: true }); remSet("te", { completed: true }) })
const c5 = await page.evaluate(() => GAMI.stats().today.items.find(i => i.t === "Записаться в барбершоп"))
check(c5 && c5.mult === 2 && c5.p === 20, "пятое подряд — ×2", c5)

// ── висящее дело закрыто → задание засчитано
const hang = await page.evaluate(() => { remSet("old", { completed: true }); const q = QUEST.today(); return q.list.filter(x => QUEST.done(x, new Date())).length })
check(hang === 3, "все три задания сделаны", hang)
const all = await page.evaluate(() => GAMI.stats().today.extra.map(x => x.t + " +" + x.p))
check(all.includes("Все задания дня +30"), "бонус +30 сверх потолка за все три", all)

// ── боссы
const boss = await page.evaluate(async () => { const r = await runTool("boss_make", { title: "Налоги за год", steps: ["Собрать чеки", "Скачать выписки из банка", "Заполнить декларацию", "Отправить в налоговую"] }); return r })
check(boss.ok && boss.hp.all === 4 && boss.hp.left === 4, "Изи делает босса с 4 шагами: здоровье 4 из 4", boss)
const hit = await page.evaluate(async () => runTool("boss_hit", { boss: "налоги", step: "собрать чеки" }))
check(hit.ok && hit.hp.left === 3 && hit.points === 15, "удар: здоровье 3 из 4, +15", hit)
await page.evaluate(() => { const b = live(D.goals).find(g => g.kind === "boss"); QUEST.bossHit(b.id, b.steps[1].id, true); render() })
check(await page.evaluate(() => !!$(".gboss") && $$(".gboss .ghp i.hit").length === 2), "на «Сегодня» — босс с полоской здоровья")
await shot(page, `${SHOTS}q-today-boss${sfx}.png`)
await page.evaluate(() => QUEST.bossSheet(live(D.goals).find(g => g.kind === "boss").id)); await page.waitForTimeout(400)
await page.screenshot({ path: `${SHOTS}q-boss${sfx}.png` })
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
const win = await page.evaluate(async () => { const b = live(D.goals).find(g => g.kind === "boss"); QUEST.bossHit(b.id, b.steps[2].id); QUEST.bossHit(b.id, b.steps[3].id)
  await new Promise(r => setTimeout(r, 700)); return { won: !!D.goals.find(g => g.id === b.id).won, cele: !!$(".gcele"), extra: GAMI.stats().today.extra.map(x => x.t) } })
check(win.won && win.cele && win.extra.some(t => /Босс повержен/.test(t)), "последний удар — победа, праздник и +150", win)
await page.waitForTimeout(600); await page.screenshot({ path: `${SHOTS}q-boss-win${sfx}.png` })
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })

// ── «Мой путь» → «Квесты»
await page.evaluate(() => GAMI.openGame("quest")); await page.waitForTimeout(300)
check(await page.evaluate(() => $$(".gseg button").map(b => b.textContent).join(",") === "Путь,Квесты,Ачивки,Награды,Лига"), "в «Моём пути» — раздел «Квесты»")
check(await page.evaluate(() => !!$(".gq") && !!$("[data-qmap=dr]") && !!$(".gwon")), "квесты: задания дня, боссы, карты целей")
await shot(page, `${SHOTS}q-quests${sfx}.png`)

// ── карта пути к цели: видны пройденные и следующий шаг, дальше туман
const mp = await page.evaluate(async () => { QUEST.mapSheet("dr"); await new Promise(r => setTimeout(r, 400)); const s = stack[stack.length - 1].el
  return { done: s.querySelectorAll(".gmn.done").length, next: s.querySelectorAll(".gmn.next").length, fog: s.querySelectorAll(".gmn.fog").length, labels: [...s.querySelectorAll(".gml")].map(e => e.textContent) } })
check(mp.done === 2 && mp.next === 1 && mp.fog === 3, "карта: 2 вехи пройдены, 1 следующая, 3 в тумане", mp)
check(!mp.labels.some(t => /ипотек/.test(t)), "шаги в тумане не подписаны", mp.labels)
await page.waitForTimeout(1800); await page.screenshot({ path: `${SHOTS}q-map${sfx}.png` })
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
const mp2 = await page.evaluate(async () => { stepSet("dr", "s3", { done: true }); const g = D.goals.find(x => x.id === "dr"); const st = g.steps.find(s => s.id === "s3")
  QUEST.mapSheet("dr"); await new Promise(r => setTimeout(r, 300)); const s = stack[stack.length - 1].el
  return { at: !!st.at, pts: GAMI.stats().today.items.some(i => i.t === "Веха: Посмотреть 5 домов" && i.p === 10), next: s.querySelector(".gml.next").textContent, anim: !!s.querySelector(".gmap.anim") } })
check(mp2.at && mp2.pts && /ипотек/.test(mp2.next) && mp2.anim, "шаг сделан: +10, открылся следующий кусок карты с анимацией", mp2)
await page.waitForTimeout(2200); await page.screenshot({ path: `${SHOTS}q-map-open${sfx}.png` })
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
check(await page.evaluate(async () => { stepsForm("dr"); await new Promise(r => setTimeout(r, 300)); const has = !!stack[stack.length - 1].el.querySelector(".gmap"); while (stack.length) stack[stack.length - 1].close(); return has }), "карта видна и в окне шагов цели")

// ── шар Изи растёт с рангом
await page.evaluate(() => GAMI.openGame("path")); await page.waitForTimeout(600)
check(await page.evaluate(() => $$(".gorb canvas").length >= 3), "в «Пути» — шар на разных рангах")
await page.evaluate(() => $(".gorbs").scrollIntoView({ block: "center" })); await page.waitForTimeout(500)
await page.locator(".gorbs").screenshot({ path: `${SHOTS}q-orbs${sfx}.png` })
const f = await page.evaluate(() => { const c = $("#fab .orb canvas"); return c.style.filter })
const lv = await page.evaluate(() => GAMI.stats().lv)
check(lv === 1 ? f === "" : /saturate/.test(f), "шар на кнопке ярче по рангу", { lv, f })

// ── выключенный «Режим игры» прячет всё новое
await page.evaluate(() => GAMI.set(false)); await page.waitForTimeout(300)
await page.evaluate(() => setTab("today")); await page.waitForTimeout(300)
const offT = await page.evaluate(async () => ({ q: !!$(".gq"), boss: !!$(".gboss"), combo: !!$("#gcombo.show"), fab: $("#fab .orb canvas").style.filter, tools: AGENT_TOOLS.map(t => t.name).filter(n => /boss/.test(n)), sys: /Игра\+/.test(agentSystem()), r: await runTool("boss_make", { title: "x" }) }))
await page.waitForTimeout(200)
const fab2 = await page.evaluate(() => $("#fab .orb canvas").style.filter)
check(!offT.q && !offT.boss && !offT.combo && !offT.tools.length && !offT.sys && offT.r.error && !fab2, "режим игры выключен: нет заданий, босса, комбо, роста шара и инструментов", Object.assign(offT, { fab2 }))
await page.evaluate(() => GAMI.set(true)); await page.waitForTimeout(300)
check(await page.evaluate(() => { setTab("today"); return !!$(".gq") && live(D.goals).some(g => g.kind === "boss") }), "включили — всё вернулось")

const errs = errors.filter(e => !/navigator\.vibrate/.test(e))
check(!errs.length, "без ошибок в консоли", errs)
await browser.close(); server.close()
console.log(ok ? "QUEST_OK" : "QUEST_FAIL")
