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
check(await page.evaluate(() => plansF === "fam" && !!$(".pf-back") && !!$('[data-f="new"]')), "в «Планах» есть «Семья» с кнопкой «Создать семью»")
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
// iPad лёжа: у ребёнка нет бокового меню взрослых — слева не должно быть пустой полосы
await kp.setViewportSize({ width: 1180, height: 820 }); await kp.waitForTimeout(400)
const ip = await kp.evaluate(() => ({ pad: parseFloat(getComputedStyle(document.body).paddingLeft), kd: Math.round($(".kd").getBoundingClientRect().left), nav: Math.round($("#knav").getBoundingClientRect().left), navR: Math.round(innerWidth - $("#knav").getBoundingClientRect().right) }))
check(ip.pad === 0 && ip.kd === 0 && Math.abs(ip.nav - ip.navR) < 2, "iPad: детский режим на всю ширину, меню по центру", ip)
await kp.screenshot({ path: SHOTS + "fm-kid-ipad.png" })
await kp.setViewportSize({ width: 390, height: 844 }); await kp.waitForTimeout(300)
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
{ const km = await kp.evaluate(() => ({ map: !!$(".kl-map"), done: $$(".kl-map .kl-row.done").length, now: $$(".kl-map .kl-row.now").length })); check(km.map && km.now === 1, "карта обучения открывается, первый урок подсвечен", km) }
await kp.screenshot({ path: SHOTS + "kids-map.png" })
await kp.click(".kl-map .kl-row.now"); await kp.waitForTimeout(400)
check(await kp.evaluate(() => stack.length > 0), "урок из карты обучения открывается")
await kp.screenshot({ path: SHOTS + "kids-lesson.png" })
await kp.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await kp.waitForTimeout(300)
await kp.click('#knav [data-kt="learn"]'); await kp.waitForTimeout(300)
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
// «Хочу купить» дороже, чем в «Трачу»: окно светлое детское (даже в тёмной теме) и можно положить в банку желаний
await kp.emulateMedia({ colorScheme: "dark" })
const kask = async v => { await kp.waitForSelector("#ask-v"); await kp.fill("#ask-v", String(v)); await kp.click('.sheet [data-a="ok"]'); await kp.waitForTimeout(350) }
await kp.click('[data-k="buy"]'); await kask("Велосипед")
await kp.waitForSelector("#ask-v"); await kp.fill("#ask-v", "18000")
const sbg = await kp.evaluate(() => { const s = $$(".sheet").pop(); return { bg: getComputedStyle(s).backgroundImage, c: getComputedStyle(s).color, ok: getComputedStyle($('.sheet [data-a="ok"]')).backgroundImage } })
await kp.screenshot({ path: SHOTS + "fm-kid-buy-ask.png" })
check(/237, 231, 255/.test(sbg.bg) && sbg.c === "rgb(42, 35, 80)" && /139, 108, 255/.test(sbg.ok), "окна ребёнка светлые и фиолетовые в тёмной теме", sbg)
await kp.click('.sheet [data-a="ok"]'); await kp.waitForTimeout(400)
await kp.screenshot({ path: SHOTS + "fm-kid-buy-short.png" })
await kp.click('.sheet button:has-text("В банку желаний")'); await kp.waitForTimeout(500)
const wd = await kp.evaluate(() => (D.fam.data.dreams || []).find(d => d.title === "Велосипед" && d.price === 18000 && d.kid === D.fam.id))
check(!!wd && await kp.evaluate(() => !!$(".kchips")), "не хватает денег → «В банку желаний» с ценой, открылись «Мечты»", wd)
await kp.emulateMedia({ colorScheme: "light" }); await kp.click('#knav [data-kt="money"]'); await kp.waitForTimeout(200)
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
// голос: ребёнок нажимает микрофон, говорит — Изи отвечает вслух
await kp.evaluate(() => {
  window.__said = []; window.speak = t => window.__said.push(t)
  window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => { this.onresult({ results: [[{ transcript: "Как накопить на велосипед?" }]] }); this.onend() }, 50) } stop() {} abort() {} }
})
await kp.click(".kmic"); await kp.waitForTimeout(900)
const kv = await kp.evaluate(() => ({ said: window.__said.length, last: $$(".kmsg.u").pop().textContent }))
check(kv.said === 1 && /велосипед/.test(kv.last), "голос: Изи услышал ребёнка и ответил вслух", kv)
// Safari не прислал onend (так бывает на iPad) — страница не виснет: через паузу фраза уходит сама
await kp.evaluate(() => { window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => this.onresult({ results: [[{ transcript: "Сколько у меня звёзд?" }]] }), 50) } stop() {} abort() {} } })
await kp.click(".kmic"); await kp.waitForTimeout(4500)
const kv2 = await kp.evaluate(() => ({ said: window.__said.length, last: $$(".kmsg.u").pop().textContent, on: !!$(".kmic.on") }))
check(kv2.said === 2 && /звёзд/.test(kv2.last) && !kv2.on, "голос без onend: фраза ушла после паузы, микрофон выключился", kv2)
// Остановить разговор: пока Изи говорит, слушает или думает — видна кнопка «Стоп» с подписью; «Закрыть» и смахивание гасят всё
await kp.evaluate(() => {
  window.__stops = 0; const st0 = window.ttsStop; window.ttsStop = () => { window.__stops++; try { st0() } catch (e) {} }
  window.speak = (t, o) => { window.__said.push(t); window.__sayEnd = o && o.onEnd }   // говорит, пока не нажмут «Стоп»
  window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => { this.onresult({ results: [[{ transcript: "Расскажи про копилку" }]] }); this.onend() }, 50) } stop() {} abort() {} }
})
check(await kp.evaluate(() => /Закрыть/.test($(".kclose").textContent) && /Стоп/.test($(".kstop").textContent)), "в чате ребёнка есть «Закрыть» и «Стоп» с подписями")
await kp.click(".kmic"); await kp.waitForTimeout(900)
const ks1 = await kp.evaluate(() => ({ vis: !$(".kstop").hidden, st: $(".kstop").dataset.st, t: $(".kstop").textContent, said: window.__said.length }))
check(ks1.vis && ks1.st === "say" && /Стоп — Изи замолчит/.test(ks1.t) && ks1.said === 3, "Изи отвечает вслух — видна кнопка «Стоп — Изи замолчит»", ks1)
await kp.screenshot({ path: SHOTS + "kstop-1-say.png" })
await kp.click(".kstop"); await kp.waitForTimeout(300)
const ks2 = await kp.evaluate(() => ({ hid: $(".kstop").hidden, stops: window.__stops, open: stack.length }))
check(ks2.hid && ks2.stops >= 1 && ks2.open === 1, "«Стоп» — Изи замолкает, чат остаётся открытым", ks2)
await kp.waitForTimeout(2600)   // подсказка «Разговор остановлен» уходит — снимок без неё
// слушает — «Стоп» выключает микрофон, ничего не отправляя
await kp.evaluate(() => { window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { window.__rec = this } stop() {} abort() { setTimeout(() => this.onend && this.onend(), 0) } } })
const n0 = await kp.evaluate(() => D.kchat.length)
await kp.click(".kmic"); await kp.waitForTimeout(300)
await kp.evaluate(() => window.__rec.onresult({ results: [[{ transcript: "ой, не то" }]] })); await kp.waitForTimeout(100)
const ks3 = await kp.evaluate(() => ({ vis: !$(".kstop").hidden, st: $(".kstop").dataset.st, t: $(".kstop").textContent, on: !!$(".kmic.on") }))
check(ks3.vis && ks3.st === "listen" && /не слушать/.test(ks3.t) && ks3.on, "Изи слушает — видна «Стоп — не слушать»", ks3)
await kp.screenshot({ path: SHOTS + "kstop-2-listen.png" })
await kp.click(".kstop"); await kp.waitForTimeout(2600)
const ks4 = await kp.evaluate(() => ({ hid: $(".kstop").hidden, on: !!$(".kmic.on"), n: D.kchat.length, v: $("#kc-t").value }))
check(ks4.hid && !ks4.on && ks4.n === n0 && !ks4.v, "«Стоп» во время слушания — микрофон выключен, ничего не отправилось", ks4)
// спросил голосом и нажал «Стоп», пока Изи думает — ответ приходит текстом, вслух не звучит
await kp.evaluate(() => { window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => { this.onresult({ results: [[{ transcript: "Сколько стоит щенок?" }]] }); this.onend() }, 50) } stop() {} abort() {} } })
const said0 = await kp.evaluate(() => window.__said.length)
globalThis.__famFail = 1   // Claude перегружен — Изи думает дольше (повтор через 2,5 с)
await kp.click(".kmic"); await kp.waitForTimeout(600)
const ks5 = await kp.evaluate(() => ({ st: $(".kstop").dataset.st, vis: !$(".kstop").hidden }))
await kp.click(".kstop"); await kp.waitForTimeout(3200)
const ks6 = await kp.evaluate(() => ({ said: window.__said.length, hid: $(".kstop").hidden, last: $$(".kmsg.a").pop().textContent }))
check(ks5.vis && ks5.st === "think" && ks6.said === said0 && ks6.hid && /зубов/.test(ks6.last), "«Стоп», пока Изи думает, — ответ только текстом, без голоса", { ks5, ks6 })
// снова говорит — «Закрыть» закрывает окно и гасит голос
await kp.evaluate(() => { window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => { this.onresult({ results: [[{ transcript: "Ещё вопрос" }]] }); this.onend() }, 50) } stop() {} abort() {} } })
await kp.click(".kmic"); await kp.waitForTimeout(900)
const stc = await kp.evaluate(() => window.__stops)
await kp.click(".kclose"); await kp.waitForTimeout(500)
check(await kp.evaluate(s => !$(".kchat") && window.__stops > s, stc), "«Закрыть» — окно закрыто, Изи замолчал")
await kp.click('#knav [data-kt="izi"]'); await kp.waitForTimeout(300)
// Живой разговор у ребёнка: «Поговорить» — Изи слушает, отвечает голосом и снова слушает; «Закончить разговор» — всё выключено
await kp.evaluate(() => {
  window.__srN = 0
  window.speak = (t, o) => { window.__said.push(t); setTimeout(() => o && o.onEnd && o.onEnd(), 150) }
  window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { const n = ++window.__srN; if (n === 1) setTimeout(() => { this.onresult({ results: [[{ transcript: "Давай поговорим" }]] }); this.onend() }, 50); else window.__rec = this } stop() {} abort() { setTimeout(() => this.onend && this.onend(), 0) } }
})
check(await kp.evaluate(() => /Поговорить/.test($(".kgo").textContent)), "в чате ребёнка есть кнопка «Поговорить» с подписью")
const said1 = await kp.evaluate(() => window.__said.length)
await kp.click(".kgo"); await kp.waitForTimeout(1200)
const kl = await kp.evaluate(() => ({ live: $(".kchat").classList.contains("klive"), panel: !$(".klivep").hidden, inHid: getComputedStyle($(".kin")).display === "none", stop: $(".kstop").textContent, sr: window.__srN, st: $(".klivep").dataset.st }))
check(kl.live && kl.panel && kl.inHid && /Закончить разговор/.test(kl.stop) && kl.sr >= 2 && kl.st === "listen" && await kp.evaluate(n => window.__said.length === n + 1, said1), "живой разговор: услышал, ответил вслух и снова слушает; внизу «Закончить разговор»", kl)
await kp.evaluate(() => window.__rec.onresult({ results: [[{ transcript: "А что такое" }]] })); await kp.waitForTimeout(100)
await kp.screenshot({ path: SHOTS + "kstop-3-live.png" })
await kp.click(".kstop"); await kp.waitForTimeout(400)
const kl2 = await kp.evaluate(() => ({ live: $(".kchat").classList.contains("klive"), panel: !$(".klivep").hidden, stop: !$(".kstop").hidden, inp: getComputedStyle($(".kin")).display }))
check(!kl2.live && !kl2.panel && !kl2.stop && kl2.inp !== "none", "«Закончить разговор» — снова обычный чат, микрофон выключен", kl2)
await kp.waitForTimeout(2600)
// «+»: фото и файлы
await kp.click(".kplus"); await kp.waitForTimeout(200)
check(await kp.evaluate(() => !$(".kplusm").hidden && $$(".kplusm [data-kp]").length === 3 && /Камера/.test($(".kplusm").textContent) && /Файл/.test($(".kplusm").textContent)), "«+»: Камера, Фото, Файл")
const PNG = Buffer.from((await kp.evaluate(() => { const c = document.createElement("canvas"); c.width = 400; c.height = 300; const g = c.getContext("2d")
  g.fillStyle = "#fffdf4"; g.fillRect(0, 0, 400, 300); g.strokeStyle = "#cfe0ff"; for (let y = 30; y < 300; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(400, y); g.stroke() }
  g.fillStyle = "#2b3a8c"; g.font = "bold 30px sans-serif"; g.fillText("Задача 3", 30, 70); g.font = "26px sans-serif"; g.fillText("24 + 18 = ?", 30, 130); g.fillText("56 − 29 = ?", 30, 185)
  return c.toDataURL("image/png").split(",")[1] })), "base64")
let fc = kp.waitForEvent("filechooser"); await kp.click('[data-kp="lib"]'); await (await fc).setFiles([{ name: "домашка.png", mimeType: "image/png", buffer: PNG }]); await kp.waitForTimeout(600)
await kp.click(".kplus"); fc = kp.waitForEvent("filechooser"); await kp.click('[data-kp="doc"]'); await (await fc).setFiles([{ name: "расписание.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") }]); await kp.waitForTimeout(500)
check(await kp.evaluate(() => $$(".ktray .kat").length === 2 && !!$(".ktray img")), "фото и PDF лежат карточками над строкой ввода")
await kp.screenshot({ path: SHOTS + "kstop-4-files.png" })
await kp.fill("#kc-t", "Помоги с задачей"); await kp.click(".ksend"); await kp.waitForTimeout(900)
const lastU = (globalThis.__famAsk.body.messages || []).slice(-1)[0] || {}
const types = Array.isArray(lastU.content) ? lastU.content.map(c => c.type) : []
check(types.join() === "image,document,text" && lastU.content[2].text === "Помоги с задачей" && await kp.evaluate(() => $$(".ktray .kat").length === 0 && !!$$(".kmsg.u").pop().querySelector(".kthumbs img") && /расписание\.pdf/.test($$(".kmsg.u").pop().textContent)), "фото и файл ушли Изи вместе с сообщением, в переписке — миниатюра и имя файла", types)
check((globalThis.__famAsk.body.messages || []).slice(0, -1).every(m => typeof m.content === "string"), "в старые сообщения вложения не попадают")
await kp.screenshot({ path: SHOTS + "kstop-5-sent.png" })
// iPad: окно на всю ширину карточки, ничего не обрезано
await kp.setViewportSize({ width: 820, height: 1180 }); await kp.waitForTimeout(500)
const ipw = await kp.evaluate(() => ({ chat: $(".kchat").getBoundingClientRect().width, sheet: $(".kchat").closest(".sheet").clientWidth, inBottom: $(".kin").getBoundingClientRect().bottom, sheetBottom: $(".kchat").closest(".sheet").getBoundingClientRect().bottom }))
check(ipw.chat > ipw.sheet * .85 && ipw.inBottom <= ipw.sheetBottom + 1, "iPad: чат на всю ширину окна, строка ввода видна целиком", ipw)
await kp.screenshot({ path: SHOTS + "kstop-ipad-1-chat.png" })
await kp.click(".kgo"); await kp.waitForTimeout(500)
await kp.evaluate(() => window.__rec && window.__rec.onresult({ results: [[{ transcript: "Расскажи, как решить задачу" }]] })); await kp.waitForTimeout(100)
await kp.screenshot({ path: SHOTS + "kstop-ipad-2-live.png" })
await kp.click(".kstop"); await kp.waitForTimeout(300)
await kp.setViewportSize({ width: 390, height: 844 }); await kp.waitForTimeout(300)
// Claude перегружен: один раз — спрашиваем ещё раз сами; два раза — понятная ошибка, и она не уходит в историю
globalThis.__famFail = 1
await kp.fill("#kc-t", "Расскажи сказку"); await kp.click(".ksend"); await kp.waitForTimeout(3500)
check(await kp.evaluate(() => /зубов/.test($$(".kmsg.a").pop().textContent)), "Claude перегружен один раз — Изи всё равно ответил")
globalThis.__famFail = 2
await kp.fill("#kc-t", "Ты меня слышишь?"); await kp.click(".ksend"); await kp.waitForTimeout(3500)
const ke = await kp.evaluate(() => ({ t: $$(".kmsg.a").pop().textContent, err: D.kchat[D.kchat.length - 1].err }))
await kp.fill("#kc-t", "А сейчас?"); await kp.click(".ksend"); await kp.waitForTimeout(800)
const hist = (globalThis.__famAsk.body.messages || []).map(m => m.content).join(" | ")
check(/не получилось/.test(ke.t) && /Overload/.test(ke.t) && ke.err && !/не получилось/.test(hist) && /зубов/.test(await kp.evaluate(() => $$(".kmsg.a").pop().textContent)), "ошибка Claude видна с причиной и не попадает в историю", { ke, hist })
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
