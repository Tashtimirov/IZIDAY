// Детская версия: ребёнок открывает дело и расписание; своё правит и удаляет сам; то, что добавили взрослые,
// убрать не может — отправляет просьбу изменить; взрослый отвечает «Да» (правка вносится) или «Нет».
// Снимки — build/web-shots/ke-*.png. Запуск после сборки: node tests/kid_edit_test.mjs
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const dark = process.argv.includes("--dark"), sfx = dark ? "-dark" : ""
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-05T03:11:00Z"), dark })
await page.waitForTimeout(800)
const ask = async v => { await page.waitForSelector("#ask-v"); await page.fill("#ask-v", String(v)); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(350) }
const closeAll = async () => { await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(350) }
const snap = async n => { await page.waitForTimeout(350); await page.screenshot({ path: SHOTS + `ke-${n}${sfx}.png` }) }
const T = () => page.textContent(".sheet.show")
await page.evaluate(() => { setTab("plans"); plansF = "fam"; render() }); await page.waitForTimeout(200)
await page.click('[data-f="new"]'); await ask("Папа"); await ask("Таштимировы"); await page.waitForTimeout(600)
await page.click('[data-f="kid"]'); await ask("Миша"); await ask(9); await page.waitForTimeout(600); await closeAll()
const dad = await page.evaluate(() => FAM.meId()), kid = await page.evaluate(() => FAM.members().find(m => m.name === "Миша").id)
await page.evaluate(({ kid }) => { const P = FAM.put, k = dayKey(new Date())
  P("events", { id: "f1", title: "Плавание", who: kid, day: k, time: "16:00", min: 60, place: "Бассейн на Чалонге", take: "очки", by: FAM.meId() })
  P("events", { id: "f2", title: "Ужин у бабушки", who: "fam", day: k, time: "19:00", min: 90, by: FAM.meId() })
  P("tasks", { id: "t1", kid, title: "Собрать рюкзак", stars: 5, days: [], when: "вечером" }) }, { kid })
const as = async (id, role) => { await closeAll(); await page.evaluate(([id, role]) => { D.fam.id = id; D.fam.role = role; D.fam.name = role === "kid" ? "Миша" : "Папа"; save(false); setTab("today"); render() }, [id, role]); await page.waitForTimeout(600) }

// ── ребёнок
await as(kid, "kid")
check((await page.$$("[data-kev]")).length === 2 && !!(await page.$('[data-kti="t1"]')), "ребёнок: строки расписания и дела открываются")
await snap("1-day")
await page.click('[data-kev="f1"]'); await page.waitForTimeout(400)
let t = await T()
check(/Плавание/.test(t) && /16:00/.test(t) && /Бассейн/.test(t) && /очки/.test(t), "карточка: время, место, что взять", t)
check(/добавили взрослые/.test(t) && /Попросить изменить/.test(t) && !(await page.$('.sheet.show [data-a="del"]')) && !(await page.$('.sheet.show [data-a="edit"]')), "добавленное взрослыми: нет «Удалить» и «Изменить», есть «Попросить изменить»", t)
await snap("2-card")
await page.click('.sheet.show [data-a="ask"]'); await page.waitForTimeout(400)
await page.fill(".sheet.show #kp-h", "17:00"); await page.fill(".sheet.show #kp-y", "В четыре у меня ещё уроки")
await snap("3-ask")
await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(500)
const pr = await page.evaluate(() => FAM.L("log").find(x => x.kind === "prop"))
check(pr && pr.st === "wait" && pr.ref === "f1" && pr.patch.time === "17:00" && Object.keys(pr.patch).length === 1 && /уроки/.test(pr.why), "просьба записана: только изменённое поле и «почему»", pr)
check(await page.evaluate(() => FAM.L("events").find(x => x.id === "f1").time === "16:00"), "само дело пока не изменилось")
check(/ждёт ответа/.test(await page.textContent('[data-kev="f1"]')), "в расписании пометка «ждёт ответа»")
await page.click('[data-kev="f1"]'); await page.waitForTimeout(400)
check(/Ты попросил изменить/.test(await T()) && !!(await page.$('.sheet.show [data-a="undo"]')), "в карточке видно просьбу, можно отменить")
await closeAll()
// своё дело: добавить, изменить
await page.click('[data-k="evnew"]'); await page.waitForTimeout(400)
await page.fill(".sheet.show #ke-t", "Футбол с Тимуром"); await page.fill(".sheet.show #ke-h", "18:00")
await snap("4-own")
await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(500)
const own = await page.evaluate(() => FAM.L("events").find(x => /Футбол/.test(x.title)))
check(own && own.by === own.who && own.time === "18:00", "своё дело добавлено ребёнком", own)
await page.click(`[data-kev="${own.id}"]`); await page.waitForTimeout(400)
check(!!(await page.$('.sheet.show [data-a="edit"]')) && !!(await page.$('.sheet.show [data-a="del"]')), "своё: «Изменить» и «Удалить»")
await page.click('.sheet.show [data-a="edit"]'); await page.waitForTimeout(500)
await page.fill(".sheet.show #ke-h", "18:30"); await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(500)
check(await page.evaluate(id => FAM.L("events").find(x => x.id === id).time === "18:30", own.id), "своё дело правится сразу, без просьбы")
// задание от взрослых
await page.click('[data-kti="t1"]'); await page.waitForTimeout(400)
t = await T()
check(/Собрать рюкзак/.test(t) && /\+5 звёзд/.test(t) && /Попросить изменить/.test(t) && !(await page.$('.sheet.show [data-a="del"]')), "задание: подробности и только «Попросить изменить»", t)
await page.click('.sheet.show [data-a="ask"]'); await page.waitForTimeout(400)
await page.fill(".sheet.show #kp-w", "утром"); await page.click('.sheet.show [data-a="ok"]'); await page.waitForTimeout(500)

// ── взрослый: плашка на «Сегодня», ответы «Да» и «Нет»
await as(dad, "adult")
t = await page.textContent(".fnote")
check(/2 дела ждут ответа/.test(t) && /просит изменить «Плавание»/.test(t), "взрослый: плашка на «Сегодня»", t)
await snap("5-parent-today")
await page.click(".fnote"); await page.waitForTimeout(700)
t = await page.textContent("#fwait")
check(/Миша · просит изменить «Плавание»/.test(t) && /время: 17:00/.test(t) && /уроки/.test(t) && /когда: утром/.test(t), "в «Ждут вашей проверки» — что и почему просит", t)
await page.evaluate(() => document.querySelector("#fwait").scrollIntoView({ block: "center" })); await snap("6-parent-wait")
await page.click('#fwait [data-fyes="0"]'); await page.waitForTimeout(500)
check(await page.evaluate(() => FAM.L("events").find(x => x.id === "f1").time === "17:00" && FAM.L("events").find(x => x.id === "f1").place === "Бассейн на Чалонге"), "«Да» — время изменилось, остальное на месте")
await page.click('#fwait [data-fno="0"]'); await page.waitForTimeout(500)
check(await page.evaluate(() => FAM.L("tasks").find(x => x.id === "t1").when === "вечером" && !FAM.waits().length), "«Нет» — задание осталось как было, очередь пуста")

// ── ребёнок видит ответы
await as(kid, "kid")
t = await page.textContent(".kans")
check(/Папа: да/.test(t) && /Папа: нет/.test(t) && /остаётся как было/.test(t), "ребёнок видит ответы взрослого", t)
check(/17:00/.test(await page.textContent('[data-kev="f1"]')) && !/ждёт ответа/.test(await page.textContent('[data-kev="f1"]')), "в расписании новое время")
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(3500); await snap("7-answer")
check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()
console.log(ok ? "KID_EDIT_OK" : "KID_EDIT_FAIL")
process.exit(ok ? 0 : 1)
