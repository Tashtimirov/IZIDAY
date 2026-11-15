// «План недели» и колесо баланса (plan.js): функция по выбору, колесо в «Здоровье», выбор мечт по слабым сферам,
// карточка недели в «Планах», редактор, блок «Сегодня», факт, «вне плана», инструмент Изи. Снимки — в папку из argv[2].
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const out = process.argv[2]; if (out) fs.mkdirSync(out, { recursive: true })
const root = new URL("../dist/web/", import.meta.url).pathname
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const errs = []
for (const dark of out ? [false, true] : [false]) {
  const sfx = dark ? "-dark" : ""
  // вторник 17 ноября 2026, 08:30 Бангкок
  const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-17T01:30:00Z"), dark })
  const vp = async (f, h = 844) => { if (!out) return; await page.setViewportSize({ width: 390, height: h }); await page.waitForTimeout(450); await page.screenshot({ path: `${out}/${f}${sfx}.png` }); await page.setViewportSize({ width: 390, height: 844 }) }
  const closeAll = async () => { await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(350) }
  const tabTo = async t => { await page.evaluate(t => { setTab(t); window.scrollTo(0, 0) }, t); await page.waitForTimeout(450) }

  if (!dark) {
    console.log("Выключено по умолчанию")
    check(await page.evaluate(() => !FEAT.on("plan")), "функция выключена, пока человек не включил")
    await tabTo("plans"); check(!(await page.$("#wk-plan")), "в «Планах» карточки нет"); check(!!(await page.$("#goals")), "«Цели на месяц» на месте")
    await tabTo("health"); check(!(await page.$("#wheel")), "в «Здоровье» колеса нет")
    await tabTo("more"); check(await page.evaluate(() => !!document.querySelector('#ft-more [data-ft-tg="plan"]')), "строка «План недели» есть в «Функциях»")
    await page.click('#ft-more [data-ft-tg="plan"]'); await page.waitForTimeout(400)
    check(await page.evaluate(() => FEAT.on("plan") && D.feat.plan === 1), "включается переключателем")
  } else await page.evaluate(() => { FEAT.set("plan", true, true) })
  await tabTo("more"); if (out) await page.locator("#ft-more").screenshot({ path: `${out}/6-funkcii${sfx}.png` })

  // мечты по разделам
  await page.evaluate(() => {
    const W = [["Выходные на Самуи вдвоём с Алией", "trip"], ["Встретить рассвет на Пхукете", "trip"], ["Поездка в Китай", "trip"], ["Фестиваль фонарей в Чиангмае", "trip"],
      ["Играть в падел 2 раза в неделю", "body"], ["Пройти полное обследование", "body"], ["Подушка на 6 месяцев", "biz"], ["Открыть второе агентство", "biz"], ["Выучить тайский", "learn"], ["Собрать друзей на день рождения", "fam"]]
    W.forEach(([t, g], i) => upsert("goals", { id: "w" + i, date: Date.now() + i, kind: "wish", title: t, grp: g, done: false }))
  })
  if (!dark) {
    console.log("Сферы мечт")
    const sp = await page.evaluate(() => Object.fromEntries(D.goals.filter(g => g.kind === "wish").map(g => [g.title, WPLAN.sphOf(g)])))
    check(sp["Поездка в Китай"] === "trip" && sp["Играть в падел 2 раза в неделю"] === "body", "отдых и здоровье", sp)
    check(sp["Подушка на 6 месяцев"] === "money" && sp["Открыть второе агентство"] === "biz", "«Бизнес и деньги» делится на работу и деньги", sp)
    check(sp["Собрать друзей на день рождения"] === "friends", "друзья узнаются по словам", sp)
  }

  console.log("Колесо в «Здоровье»" + sfx)
  await tabTo("health")
  if (!dark) {
    check(await page.evaluate(() => /Оценить сферы/.test(document.querySelector("#wheel").textContent)), "пустое колесо предлагает оценить сферы")
    await page.click('#wheel [data-wp="rate"]'); await page.waitForTimeout(500)
    await page.evaluate(() => { const set = { body: 4, fam: 8, biz: 7, money: 5, home: 6, trip: 3, learn: 6, friends: 4 }
      for (const [k, v] of Object.entries(set)) { const r = document.querySelector(`.sheet [data-rk="${k}"]`); r.value = v; r.dispatchEvent(new Event("input", { bubbles: true })) } })
    await vp("0-ocenka", 1100)
    await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(900)
    check(await page.evaluate(() => !!WPLAN.wheel() && WPLAN.wheel().v.trip === 3), "оценка сохранена")
    check(await page.evaluate(() => WPLAN.weakList().join()) === "trip,body,friends", "слабые сферы: отдых, здоровье, друзья", await page.evaluate(() => WPLAN.weakList()))
    check(await page.evaluate(() => stack.length === 1 && /Выровнять колесо/.test(stack[0].el.textContent)), "после оценки открывается «Выровнять колесо»")
    await closeAll()
  } else await page.evaluate(() => { upsert("goals", { id: "wh1", kind: "wheel", date: Date.now(), v: { body: 4, fam: 8, biz: 7, money: 5, home: 6, trip: 3, learn: 6, friends: 4 } }); render() })
  await tabTo("health")
  await page.evaluate(() => { const e = document.querySelector("#wheel"); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 110) })
  await vp("1-zdorovie-koleso", 900)

  console.log("Выровнять колесо" + sfx)
  await page.click('#wheel [data-wp="align"]'); await page.waitForTimeout(500)
  check(await page.evaluate(() => document.querySelector(".sheet .wp-pill.on").textContent.includes("Отдых")), "первой стоит самая слабая сфера")
  check(await page.evaluate(() => document.querySelectorAll(".sheet [data-al-w]").length) === 4, "показаны мечты этой сферы")
  await page.click('.sheet [data-al-w="w0"]'); await page.click('.sheet [data-al-w="w2"]'); await page.waitForTimeout(200)
  await page.click('.sheet [data-al-w="w2"] [data-al-h="m"]'); await page.waitForTimeout(200)
  await page.click('.sheet [data-al-s="body"]'); await page.waitForTimeout(200); await page.click('.sheet [data-al-w="w4"]'); await page.waitForTimeout(200)
  await page.click('.sheet [data-al-s="trip"]'); await page.waitForTimeout(200)
  await vp("2-vyrovnyat", 1330)
  await page.click('.sheet [data-al="ok"]'); await page.waitForTimeout(500)
  const gs = await page.evaluate(() => ({ wg: D.goals.filter(g => g.kind === "wg" && !g.deleted).map(g => [g.title, g.sph, g.wk]), mo: D.goals.filter(g => g.kind === "month" && g.wish && !g.deleted).map(g => [g.title, g.sph]) }))
  check(gs.wg.length === 2 && gs.wg.every(g => g[2] === "2026-11-16"), "две цели недели на текущую неделю", gs)
  check(gs.mo.length === 1 && gs.mo[0][0] === "Поездка в Китай" && gs.mo[0][1] === "trip", "одна цель месяца со сферой", gs)

  console.log("План недели" + sfx)
  await page.evaluate(() => {
    let n = 0; const wk = "2026-11-16", T = (cat, title, prod, days, tm, pm, x = {}) => upsert("goals", Object.assign({ id: uid("wt"), kind: "wt", date: Date.now(), ord: Date.now() + (n++), wk, cat, title, prod, days, tm, pm, dn: {}, key: false }, x))
    upsert("goals", { id: "wk:" + wk, kind: "wk", date: Date.now(), wk, title: "2 брони до пятницы", sentAt: Date.now() })
    T("reg", "Обзвон базы", "20 контактов, 2 показа назначено", [0, 2, 4], "09:00", 30, { key: true, dn: { 0: 45 } })
    T("reg", "Падел", "2 тренировки", [1, 3], "19:00", 120, { wish: "w4" })
    T("reg", "Отчёт по сделкам", "таблица обновлена", [4], "17:00", 45)
    T("irr", "Показ на Пратамнаке", "договор брони подписан", [1], "11:00", 60, { key: true })
    T("irr", "Билеты и отель на Самуи", "", [1], "14:00", 30, { wish: "w0" })
    T("edu", "Курс по продажам, модуль 3", "конспект и 3 приёма", [0, 1, 2, 3, 4], "20:30", 20, { dn: { 0: 20 } })
    T("unp", "Срочный звонок застройщику", "", [0], "", 0, { dn: { 0: 90 } })
    render()
  })
  await tabTo("plans")
  check(await page.evaluate(() => { const g = document.querySelector("#goals"); return !g || g.style.display === "none" }), "«Цели на месяц» убраны: они внутри плана")
  const pc = await page.evaluate(() => document.querySelector("#wk-plan").textContent)
  check(/16–22 ноября/.test(pc) && /план готов/.test(pc) && /2 брони до пятницы/.test(pc), "неделя, статус и цель недели", pc.slice(0, 200))
  check(/Выходные на Самуи/.test(pc) && /Поездка в Китай/.test(pc), "цели из мечт: неделя и месяц")
  const st = await page.evaluate(() => { const s = WPLAN.stats("2026-11-16"); return { pm: s.pm, fm: s.fm, done: s.done, total: s.total, keys: s.keys, unp: s.unp } })
  check(st.pm === 90 + 240 + 45 + 60 + 30 + 100 && st.fm === 45 + 20 + 90 && st.total === 7 && st.keys === 2 && st.unp === 1 && st.done === 1, "итоги: план, факт, сделано, ключевые, вне плана", st)
  await vp("3-plany-nedelya", 1060)
  await page.click('#wk-plan [data-wp-w="1"]'); await page.waitForTimeout(300)
  check(await page.evaluate(() => /23–29 ноября/.test(document.querySelector("#wk-plan").textContent) && !!document.querySelector('#wk-plan [data-wp="copy"]')), "следующая неделя: пусто, есть «С прошлой недели»")
  await page.click('#wk-plan [data-wp="copy"]'); await page.waitForTimeout(300)
  check(await page.evaluate(() => WPLAN.tasks("2026-11-23").length === 3 && WPLAN.tasks("2026-11-23").every(t => t.cat === "reg" && !Object.keys(t.dn).length)), "регулярные перенесены без факта")
  await page.click('#wk-plan [data-wp-w="-1"]'); await page.waitForTimeout(300)

  console.log("Редактор недели" + sfx)
  await page.setViewportSize({ width: 390, height: 1700 })
  await page.click('#wk-plan [data-wp="edit"]'); await page.waitForTimeout(500)
  await page.evaluate(() => { stack[0].el.style.maxHeight = "none"; document.querySelector(".sheet [data-ed-o]").click() }); await page.waitForTimeout(300)
  if (out) await page.screenshot({ path: `${out}/4-zaplanirovat${sfx}.png` })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => { stack[0].el.style.maxHeight = "" }); await page.waitForTimeout(200)
  if (!dark) {
    check(await page.evaluate(() => /нет результата/.test(document.querySelector(".sheet").textContent)), "подсказка: у задачи нет результата")
    await page.click('.sheet [data-ed] [data-ed-d="1"]'); await page.waitForTimeout(200)
    { const d = await page.evaluate(() => { const id = document.querySelector(".sheet [data-ed]").dataset.ed; return D.goals.find(t => t.id === id).days })
      check(d.includes(1), "день добавляется нажатием", d) }
    await page.click('.sheet [data-ed] [data-ed-d="1"]'); await page.waitForTimeout(200)
    await page.click('.sheet [data-ed-new="irr"]'); await page.waitForTimeout(300)
    await page.fill(".sheet [data-ed] .wp-what", "Договор с юристом"); await page.waitForTimeout(100)
    const late = await page.evaluate(() => WPLAN.tasks("2026-11-16").find(t => t.title === "Договор с юристом"))
    check(late && late.late === 1, "задача после понедельника помечена «вне плана», а не запрещена", late)
    await page.click('.sheet [data-ed] [data-ed-a="del"]'); await page.waitForTimeout(150)
    check(await page.evaluate(() => document.querySelector(".sheet .wp-del").textContent) === "Удалить?", "удаление в два нажатия")
    await page.click('.sheet [data-ed] [data-ed-a="del"]'); await page.waitForTimeout(200)
    check(await page.evaluate(() => !WPLAN.tasks("2026-11-16").some(t => t.title === "Договор с юристом")), "задача удалена")
    // норма часов
    const h = await page.evaluate(() => { upsert("goals", { id: "wcfg", kind: "wcfg", date: Date.now(), h: 8 }); return WPLAN.hints("2026-11-16").map(x => x[1]).join(" | ") })
    check(/при норме 8 ч/.test(h), "норму часов человек задаёт сам", h)
    await page.evaluate(() => remove("goals", "wcfg"))
  }
  await closeAll()

  console.log("Сегодня" + sfx)
  await tabTo("today")
  const tt = await page.evaluate(() => [...document.querySelectorAll("#wk-today [data-tt]")].map(e => e.querySelector(".w").textContent.trim()))
  check(tt.join("|") === "★ Показ на Пратамнаке|Билеты и отель на Самуи|Падел|Курс по продажам, модуль 3", "задачи вторника по времени", tt)
  await page.click('#wk-today [data-tt] [data-tt-c]'); await page.waitForTimeout(300)
  check(await page.evaluate(() => /Сколько ушло/.test(document.querySelector("#wk-today").textContent)), "галочка спрашивает факт")
  await page.evaluate(() => { const e = document.querySelector("#wk-today"); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 250) })
  await vp("5-segodnya", 1150)
  if (!dark) {
    await page.click('#wk-today [data-tt-m="90"]'); await page.waitForTimeout(300)
    const t = await page.evaluate(() => WPLAN.tasks("2026-11-16").find(t => t.title === "Показ на Пратамнаке"))
    check(t.dn[1] === 90, "факт записан в день недели", t.dn)
    check(await page.evaluate(() => /1 ч → 1 ч 30 мин/.test(document.querySelector("#wk-today").textContent)), "показано план → факт")
    await page.click('#wk-today [data-wp="unp"]'); await page.waitForTimeout(400)
    await page.fill("#wp-u-t", "Забрать документы"); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(400)
    const u = await page.evaluate(() => WPLAN.tasks("2026-11-16").find(t => t.title === "Забрать документы"))
    check(u && u.cat === "unp" && u.dn[1] === 30, "«вне плана» пишется сразу с временем", u)

    console.log("Изи")
    const r1 = await page.evaluate(() => runTool("week_plan", { action: "add", title: "Отчёт владельцу", result: "письмо отправлено", group: "разовые", days: ["чт"], time: "9:00", minutes: 20 }))
    const a = await page.evaluate(() => WPLAN.tasks("2026-11-16").find(t => t.title === "Отчёт владельцу"))
    check(r1.ok && a && a.days.join() === "3" && a.tm === "09:00" && a.pm === 20 && a.late === 1, "Изи добавляет задачу по голосу", [r1, a])
    const r2 = await page.evaluate(() => runTool("week_plan", { action: "add", title: "Тушил пожар", group: "вне плана" }))
    check(!!r2.error, "вне плана без времени не принимается", r2)
    const r3 = await page.evaluate(() => runTool("week_plan", { action: "done", title: "падел", fact_minutes: 110 }))
    check(r3.ok && await page.evaluate(() => WPLAN.tasks("2026-11-16").find(t => t.title === "Падел").dn[1]) === 110, "Изи отмечает задачу выполненной", r3)
    const sys = await page.evaluate(() => agentSystem())
    check(/План недели \(week_plan\)/.test(sys) && /слабые сферы: Отдых, Здоровье, Друзья/.test(sys) && /2 брони до пятницы/.test(sys), "Изи знает план, цель недели и слабые сферы")

    console.log("Закрытие дня и выключение")
    await page.evaluate(() => closeDay()); await page.waitForTimeout(500)
    check(await page.evaluate(() => /По плану недели не отмечено/.test(document.querySelector(".sheet").textContent)), "закрытие дня спрашивает факт по неотмеченным")
    await closeAll()
    await page.evaluate(() => FEAT.set("plan", false, true)); await tabTo("plans")
    check(!(await page.$("#wk-plan")) && await page.evaluate(() => { const g = document.querySelector("#goals"); return !!g && g.style.display !== "none" }), "выключили: карточки нет, «Цели на месяц» вернулись")
    check(await page.evaluate(() => WPLAN.tasks("2026-11-16").length > 5), "данные при выключении сохранены")
    check(!/План недели \(week_plan\)/.test(await page.evaluate(() => agentSystem())), "Изи про выключенный план не напоминает")
    await tabTo("today"); check(!(await page.$("#wk-today")), "в «Сегодня» блока нет")
  }
  errs.push(...errors.map(e => (dark ? "dark: " : "") + e))
  await browser.close(); server.close()
}
check(!errs.length, "ошибок в консоли нет", errs)
console.log(ok ? "WEEK_PLAN_OK" : "WEEK_PLAN_FAIL")
