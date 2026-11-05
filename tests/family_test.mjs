// Семья и детский режим (family.js + Code.gs family_): создать семью, добавить ребёнка, его дела, вход ребёнка по ссылке,
// детский «Мой день», урок, мечты, копилки, проверка взрослым, семейные баллы и цели. Снимки — build/web-shots/fm-*
import fs from "fs"
import { createRequire } from "module"
import { boot2, shot } from "./today_boot.mjs"
const { chromium } = createRequire(import.meta.url)("playwright")
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const time = new Date("2026-11-05T11:00:00+07:00")
const { page, browser, server, errors, sheet, bkk, dk } = await boot2({ root, time, lists: ({ bkk, dk }) => {
  const rems = []; for (let i = 1; i <= 4; i++) rems.push({ id: "p" + i, date: +bkk(-6, 9), u: 1, title: "Дело " + i, due: dk(bkk(-i, 0)), done: true, doneAt: +bkk(-i, 11) })
  return { rems }
} })
const SECRET = "s".repeat(32)
// сервер
let r = sheet.post(JSON.stringify({ family: { op: "new", name: "X" } }))
check(!r.ok, "без ключа таблицы семью не создать", r)
r = sheet.post(JSON.stringify({ secret: SECRET, family: { op: "new", name: "Тест" } }))
check(r.ok && /^[0-9a-f]{14}$/.test(r.family.code), "хозяин создаёт семью", r)
const big = Array.from({ length: 300 }, (_, i) => ({ id: "L" + i, kid: "k", title: "x".repeat(200), u: 1 }))
r = sheet.post(JSON.stringify({ family: { op: "put", code: r.family.code, id: "a1", me: { name: "Аня", role: "adult" }, log: big } }))
check(r.ok && r.family.log.length === 200 && r.family.members.a1.name === "Аня", "семья хранится на листе кусками, принимает до 200 записей за раз", r.ok && r.family.log.length)
check(!sheet.post(JSON.stringify({ family: { op: "put", code: "00000000000000", id: "x" } })).ok, "чужой код — нет такой семьи")

const ask = async (v) => { await page.waitForSelector("#ask-v"); await page.fill("#ask-v", String(v)); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(350) }
// взрослый: «Планы → Семья» → создать
await page.evaluate(() => { setTab("plans"); plansF = "fam"; render() }); await page.waitForTimeout(200)
check(await page.evaluate(() => !!$(".pf [data-pf=fam].on") && !!$('[data-f="new"]')), "в «Планах» есть «Семья» с кнопкой «Создать семью»")
await page.click('[data-f="new"]'); await ask("Папа"); await ask("Ташимировы"); await page.waitForTimeout(600)
check(await page.evaluate(() => D.fam && D.fam.code && D.fam.role === "adult" && !!$(".fhero")), "семья создана, у взрослого — счёт семьи")
check(await page.evaluate(() => D.fam.key === true && /Один ключ Claude на семью/.test($("#view").textContent) && !JSON.stringify(D.fam.data).includes("sk-test")), "общий ключ Claude включён, в данных семьи ключа нет")
// ребёнок
await page.click('[data-f="kid"]'); await ask("Миша"); await ask(9); await page.waitForTimeout(600)
const kid = await page.evaluate(() => Object.entries(D.fam.data.members).find(([, m]) => m.name === "Миша"))
check(kid && kid[1].role === "kid" && kid[1].age === 9, "ребёнок 9 лет — детский режим", kid)
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(300)
const kidId = kid[0]
await page.click('[data-f="kid"]'); await ask("Соня"); await ask(15); await page.waitForTimeout(600)
check(await page.evaluate(() => Object.values(D.fam.data.members).find(m => m.name === "Соня").role === "teen"), "15 лет — подросток (обычное приложение)")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(300)
// дела ребёнка: одно через форму, остальные сразу
await page.evaluate(id => FAM.kidSheet(id), kidId); await page.waitForTimeout(300)
await page.click('.sheet [data-a="task"]'); await page.waitForTimeout(350)
await page.fill("#ft-t", "Почистить зубы"); await page.fill("#ft-w", "утро"); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(400)
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
await page.evaluate(k => { const P = FAM.put
  P("tasks", { id: "t2", kid: k, title: "Собрать рюкзак", stars: 5, when: "до школы", days: [] })
  P("tasks", { id: "t3", kid: k, title: "Читать 20 минут", stars: 10, check: true, days: [] })
  P("tasks", { id: "t4", kid: k, title: "Покормить кота", stars: 5, when: "вечер", days: [] })
  P("tasks", { id: "e1", kid: k, title: "Полить сад", pay: 30, check: true, days: [] })
  P("goals", { id: "g1", title: "Аквапарк всей семьёй", target: 3000, start: dayKey(addDays(new Date(), -3)), date: Date.now() - 864e5 })
  P("goals", { id: "g2", title: "Кино с попкорном", target: 1000, repeat: true, start: dayKey(addDays(new Date(), -3)), date: Date.now() - 864e5 })
  const f = D.fam.data; f.set = f.set || {}; f.set[k] = { pocket: 500, wd: 4, split: [50, 40, 10], limit: 100, since: dayKey(new Date()) }
  return FAM.push(true, { set: { [k]: f.set[k] } }) }, kidId)
await page.waitForTimeout(500)
const link = await page.evaluate(id => FAM.link(Object.assign({ id }, D.fam.data.members[id])), kidId)
check(/#fam=/.test(link), "ссылка для входа ребёнка", link)

// телефон ребёнка: без таблицы, только ссылка
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", timezoneId: "Asia/Bangkok" })
const kp = await ctx2.newPage(); const kerr = []
kp.on("pageerror", e => kerr.push(String(e)))
await kp.clock.setFixedTime(time)
await kp.route("https://script.google.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(sheet.post(r.request().postData())) }))
await kp.goto(link.replace(/^https?:\/\/[^/]+\//, page.url().replace(/#.*$/, "").replace(/[^/]*$/, "")))
await kp.waitForTimeout(2200)
const kst = await kp.evaluate(() => ({ kid: FAM.kidMode(), body: document.body.classList.contains("kidm"), hi: ($(".kd h1") || {}).textContent, tasks: $$(".ktask").length, nav: $$("#knav button").length, top: getComputedStyle($("#top")).display }))
check(kst.kid && kst.body && /Миша/.test(kst.hi) && kst.tasks === 4 && kst.nav === 5 && kst.top === "none", "ребёнок вошёл по ссылке: детский «Мой день», 4 дела, своё меню", kst)
check(await kp.evaluate(() => D.who === "kid" && !D.conn), "у ребёнка нет доступа к таблице, только семья")
// отметить дела
await kp.click('[data-ktask="t2"]'); await kp.waitForTimeout(150); await kp.click('[data-ktask="t3"]'); await kp.waitForTimeout(150)
const zid = await kp.evaluate(() => FAM.put && D.fam.data.tasks.find(t => t.title === "Почистить зубы").id); await kp.click(`[data-ktask="${zid}"]`); await kp.waitForTimeout(300)
let ks = await kp.evaluate(() => ({ stars: FAM.kidStars(D.fam.id), wait: $$(".kcb.wait").length, ok: $$(".kcb.ok").length }))
check(ks.stars === 10 && ks.wait === 1 && ks.ok === 2, "без проверки — сразу звёзды, «Читать» ждёт взрослого", ks)
await kp.screenshot({ path: SHOTS + "fm-kid-day.png", fullPage: true })
// урок «Три копилки»
await kp.evaluate(() => { const l = FAM.LESSONS.find(x => x.id === "g1"); FAM.lesson(l) }); await kp.waitForTimeout(400)
await kp.click('.klesson [data-a="next"]'); await kp.waitForTimeout(150)
check(await kp.evaluate(() => $('.klesson [data-a="next"]').disabled), "в вопросе «Дальше» ждёт ответа")
await kp.click('.klesson [data-o="1"]'); await kp.waitForTimeout(150)
check(await kp.evaluate(() => !!$(".kopts .ok") && /Верно/.test($(".kwhy").textContent)), "верный ответ подсвечен и объяснён")
await kp.screenshot({ path: SHOTS + "fm-kid-lesson.png" })
await kp.click('.klesson [data-a="next"]'); await kp.waitForTimeout(150); await kp.click('.klesson [data-a="next"]'); await kp.waitForTimeout(500)
check(await kp.evaluate(() => FAM.kidStars(D.fam.id) === 25), "урок пройден: +15 звёзд")
await kp.evaluate(() => { const l = FAM.LESSONS.find(x => x.id === "m2"); FAM.lesson(l) }); await kp.waitForTimeout(300)
await kp.click('.klesson [data-a="next"]'); await kp.waitForTimeout(150)
for (const j of ["spend", "spend", "spend", "spend", "spend", "save", "save", "save", "save", "share"]) { await kp.click(`.klesson [data-j="${j}"]`); await kp.waitForTimeout(40) }
check(await kp.evaluate(() => !$('.klesson [data-a="next"]').disabled && /Отлично/.test($(".kwhy").textContent)), "монетки разложены 50/40/10")
await kp.screenshot({ path: SHOTS + "fm-kid-coins.png" })
await kp.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await kp.waitForTimeout(300)
// учёба
await kp.click('#knav [data-kt="learn"]'); await kp.waitForTimeout(300)
check(await kp.evaluate(() => $$(".knode.done").length === 1 && $$(".knode.now").length === 1), "путь уроков: пройден один, следующий подсвечен")
await kp.screenshot({ path: SHOTS + "fm-kid-learn.png", fullPage: true })
// мечты
await kp.click('#knav [data-kt="dreams"]'); await kp.waitForTimeout(200)
for (const w of ["Велосипед", "Лего-замок", "Щенок"]) { await kp.click('[data-k="wish"]'); await kp.waitForSelector("#ask-v"); await kp.fill("#ask-v", w); await kp.click('.sheet [data-a="ok"]'); await kp.waitForTimeout(400) }
await kp.click('[data-kd]'); await kp.waitForTimeout(300)
await kp.fill("#kd-p", "4500"); await kp.click('.sheet [data-a="goal"]'); await kp.waitForTimeout(400)
check(await kp.evaluate(() => /Велосипед/.test($(".kmt").textContent) && $$(".kstep").length === 4 && $$(".kchips button").length === 2), "мечта стала главной с шагами, в банке ещё 2", await kp.evaluate(() => $(".kd").textContent.slice(0, 200)))
await kp.screenshot({ path: SHOTS + "fm-kid-dreams.png", fullPage: true })
// деньги: заработать
await kp.click('#knav [data-kt="money"]'); await kp.waitForTimeout(200)
await kp.click('[data-ktask="e1"]'); await kp.waitForTimeout(200)
await kp.evaluate(() => FAM.push(true)); await kp.waitForTimeout(400)

// чат ребёнка с Изи через общий ключ
await kp.click('#knav [data-kt="izi"]'); await kp.waitForTimeout(300)
check(await kp.evaluate(() => $$(".kquick button").length === 3), "чат Изи: подсказка и быстрые вопросы")
await kp.fill("#kc-t", "Что мне сделать сейчас?"); await kp.click(".ksend"); await kp.waitForTimeout(600)
const ka = globalThis.__famAsk || {}
check(await kp.evaluate(() => /зубов/.test($$(".kmsg.a").pop().textContent) && !JSON.stringify(D).includes("sk-test")), "Изи ответил ребёнку; ключа на телефоне ребёнка нет")
check(ka.key === "sk-test" && /Миша, 9 лет/.test(ka.body.system) && /Покормить кота — не сделано/.test(ka.body.system) && !ka.body.tools, "запрос ушёл с ключом родителя и детскими правилами из таблицы", ka.body && ka.body.system)
await kp.screenshot({ path: SHOTS + "fm-kid-chat.png" })
await kp.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await kp.waitForTimeout(300)
let lim = null; for (let i = 0; i < 31; i++) lim = sheet.post(JSON.stringify({ family: { op: "ask", code: await kp.evaluate(() => D.fam.code), id: kidId, messages: [{ role: "user", content: "привет" }] } }))
check(!lim.ok && lim.error === "limit", "лимит 30 сообщений в день", lim)

// взрослый видит проверки
await page.evaluate(() => FAM.push(true)); await page.waitForTimeout(500)
await page.evaluate(() => { setTab("today") }); await page.waitForTimeout(300)
check(await page.evaluate(() => !!$(".fnote") && /2 дела ждут/.test($(".fnote").textContent)), "на «Сегодня» у взрослого — «2 дела ждут проверки»", await page.evaluate(() => ($(".fnote") || {}).textContent))
await page.click(".fnote"); await page.waitForTimeout(300)
check(await page.evaluate(() => tab === "plans" && $$("#fwait [data-fyes]").length === 2), "открылась «Семья» с проверкой")
await page.click('#fwait [data-fyes="0"]'); await page.waitForTimeout(200); await page.click('#fwait [data-fyes="0"]'); await page.waitForTimeout(300)
const after = await page.evaluate(k => ({ stars: FAM.kidStars(k), jars: FAM.jars(k), waits: FAM.waits().length }), kidId)
check(after.stars === 35 && after.jars.save === 212 && after.jars.spend === 265 && after.waits === 0, "проверено: +10 звёзд; 30 ฿ за сад и карманные 500 разложены по копилкам", after)
// семейные баллы: взрослый (gami) + звёзды ×2
const sum = await page.evaluate(k => { const s = FAM.sumSince("2026-11-01"); return { total: s.total, kid: s.by[k], me: s.by[D.fam.id] } }, kidId)
check(sum.kid === 70 && sum.me > 0 && sum.total === sum.kid + sum.me, "семейный счёт: баллы взрослого + звёзды ребёнка ×2", sum)
await page.evaluate(() => { const G = FAM.goalProg; render() })
await shot(page, SHOTS + "fm-family.png")
// мечты детей у взрослых: «К себе»
await page.evaluate(() => FAM.push(true)); await page.waitForTimeout(400); await page.evaluate(() => render()); await page.waitForTimeout(200)
const wb = await page.$('[data-fwish]'); if (wb) { await wb.click(); await page.waitForTimeout(300) }
check(await page.evaluate(() => live(D.goals).some(g => g.kind === "wish" && /Миша: /.test(g.title) && g.from)), "мечта ребёнка добавлена во взрослые желания")
await page.evaluate(id => FAM.kidSheet(id), kidId); await page.waitForTimeout(400)
await page.screenshot({ path: SHOTS + "fm-kid-admin.png" })
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
// ребёнок обновился: копилки
await kp.evaluate(() => FAM.push(true)); await kp.waitForTimeout(400); await kp.evaluate(() => render())
check(await kp.evaluate(() => /530/.test($(".kbig").textContent)), "у ребёнка в копилках 530 ฿", await kp.evaluate(() => $(".kbig").textContent))
await kp.screenshot({ path: SHOTS + "fm-kid-money.png", fullPage: true })
// покупка дороже лимита — спросить
await kp.click('[data-k="buy"]'); await kp.waitForSelector("#ask-v"); await kp.fill("#ask-v", "Слайм"); await kp.click('.sheet [data-a="ok"]'); await kp.waitForTimeout(350)
await kp.fill("#ask-v", "120"); await kp.click('.sheet [data-a="ok"]'); await kp.waitForTimeout(350)
await kp.click('.sheet [data-b="Спросить"]'); await kp.waitForTimeout(300)
check(await kp.evaluate(() => live(D.fam.data.money).some(m => m.kind === "buy" && m.st === "wait" && m.amount === -120)), "покупка 120 ฿ при лимите 100 ждёт разрешения")

// Оля: взрослый в семье без своего ключа и без таблицы — говорит с Изи через общий ключ семьи
const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", timezoneId: "Asia/Bangkok" })
const op = await ctx3.newPage(); const oerr = []; op.on("pageerror", e => oerr.push(String(e)))
await op.route("https://script.google.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(sheet.post(r.request().postData())) }))
let direct = 0; await op.route("https://api.anthropic.com/**", r => { direct++; const k = r.request().headers()["x-api-key"]
  r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" }, body: JSON.stringify(k === "sk-ant-" + "f".repeat(30) ? { content: [{ type: "text", text: "ok" }] } : { error: { type: "authentication_error", message: "bad" } }) }) })
const adultLink = await page.evaluate(() => FAM.link(null))
await op.goto(adultLink.replace(/^https?:\/\/[^/]+\//, page.url().replace(/#.*$/, "").replace(/[^/]*$/, ""))); await op.waitForTimeout(1500)
await op.waitForSelector("#ask-v"); await op.fill("#ask-v", "Оля"); await op.click('.sheet [data-a="ok"]'); await op.waitForTimeout(900)
const ol = await op.evaluate(async () => { const r = await claude({ max_tokens: 50, messages: [{ role: "user", content: "привет" }] }); return { on: FAM.keyOn(), key: aiKey(), conn: !!D.conn, text: r.content && r.content[0].text, plans: tab === "plans" && plansF === "fam" } })
check(ol.on && ol.key === "fam" && !ol.conn && /зубов/.test(ol.text) && ol.plans && direct === 0 && globalThis.__famAsk.key === "sk-test", "Оля вошла как взрослый; Изи отвечает ей через общий ключ, ключ к ней не попал", ol)
r = sheet.post(JSON.stringify({ family: { op: "ai", code: await page.evaluate(() => D.fam.code), id: kidId, body: { messages: [{ role: "user", content: "x" }] } } }))
check(r.error && r.error.type === "forbidden", "ребёнку общий ключ напрямую не отдаётся — только детский чат", r)
r = sheet.post(JSON.stringify({ family: { op: "ai", code: await page.evaluate(() => D.fam.code), id: "chuzhoy", body: { messages: [{ role: "user", content: "x" }] } } }))
check(r.error, "посторонний (друг, лига) общим ключом не воспользуется", r)
await op.evaluate(() => { setTab("more") }); await op.waitForTimeout(300)
check(await op.evaluate(() => /общий ключ семьи/.test($("#fkey").textContent)), "в «Настройках» у Оли: «Ключ Claude — общий ключ семьи»")
await op.close()
// друг: своего ключа нет, семьи нет — подключает свой ключ в три шага
const fp = await ctx3.newPage()
await fp.route("https://api.anthropic.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" }, body: JSON.stringify(r.request().headers()["x-api-key"] === "sk-ant-" + "f".repeat(30) ? { content: [{ type: "text", text: "ok" }] } : { error: { type: "authentication_error", message: "bad" } }) }))
await fp.goto(page.url().replace(/#.*$/, "")); await fp.waitForTimeout(1200)
await fp.evaluate(() => { localStorage.clear(); D = {}; load(); setTab("more") }); await fp.waitForTimeout(300)
check(await fp.evaluate(() => /Не подключён/.test($("#fkey").textContent) && !aiKey()), "у друга без ключа — «Ключ Claude: не подключён»")
await fp.click('[data-f="keyadd"]'); await fp.waitForTimeout(300)
await fp.fill("#fk-v", "sk-ant-wrong-wrong-wrong-wrong-wrong"); await fp.click('.sheet [data-a="ok"]'); await fp.waitForTimeout(400)
check(await fp.evaluate(() => /не подошёл/.test($("#fk-m").textContent)), "неверный ключ — понятная подсказка")
await fp.screenshot({ path: SHOTS + "fm-key.png" })
await fp.fill("#fk-v", "sk-ant-" + "f".repeat(30)); await fp.click('.sheet [data-a="ok"]'); await fp.waitForTimeout(500)
check(await fp.evaluate(() => aiKey() === "sk-ant-" + "f".repeat(30) && /свой/.test($("#fkey").textContent)), "свой ключ проверен и сохранён на телефоне")
check(!oerr.length, "у Оли без ошибок", oerr)

// праздник семейной цели (кино каждые 1000)
await page.evaluate(() => { D.fam.data.members[D.fam.id].pts["2026-11-05"] = 1200; FAM.put("goals", Object.assign({}, D.fam.data.goals.find(g => g.id === "g2"))) }); await page.waitForTimeout(200)
const gp = await page.evaluate(() => FAM.goalProg(D.fam.data.goals.find(g => g.id === "g2")))
check(gp.times >= 1, "повторяющаяся цель «Кино» достигнута", gp)

check(!errors.filter(e => !/favicon|net::|Failed to load|vibrate/.test(e)).length && !kerr.length, "без ошибок в консоли", [errors, kerr])
await browser.close(); server.close()
console.log(ok ? "FAMILY_OK" : "FAMILY_FAIL")
