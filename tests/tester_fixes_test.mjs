// Исправления по замечаниям тестеров (таблица «IZIDAY — Недочёты», 17.11):
//  №11/№17 — снятый слой календаря (своя категория «Муж») не виден и на «Сегодня», и в карточке «Сейчас»
//  №13 — «Нет сети» пропадает, как только таблица ответила на любой запрос
//  №14 — поле даты не залезает на «Время» (iPhone)
//  №15 — «Добавить» серая и неактивна, пока строка пустая
//  №9  — после паузы разговор берёт свежий микрофон (STT.reset), тишина при живом микрофоне не уводит в паузу через 9 с
//   node tests/tester_fixes_test.mjs [папка для снимков]
import fs from "fs"
import { boot2 } from "./today_boot.mjs"
const out = process.argv[2] || ""
if (out) fs.mkdirSync(out, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const NOW = new Date("2026-11-16T03:30:00Z")   // 10:30 в Бангкоке
const ev = (id, title, h, h2, calendar) => ({ bkk, iso }) => ({ id, title, start: iso(bkk(0, h)), end: iso(bkk(0, h2)), calendar, all_day: false, location: "", repeats: false })
const EVS = [ev("M1", "Моя встреча", 11, 12, "Личное"), ev("H1", "Игра Кирилла", 11, 12, "kirill@gmail.com"), ev("H2", "Совещание Кирилла", 15, 16, "kirill@gmail.com")]
const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: NOW, events: ctx => EVS.map(f => f(ctx)) })
const shot = async n => { if (!out) return; await page.waitForTimeout(400); await page.screenshot({ path: `${out}/${n}.png` }) }
const todayTxt = () => page.evaluate(() => { setTab("today"); render(); return document.querySelector(".daycard").textContent })

// 1. Слой «Муж»: своя категория для календаря мужа, снята галочка — пропадает с «Сегодня»
let t = await todayTxt()
check(/Совещание Кирилла/.test(t) && /Моя встреча/.test(t), "до: на «Сегодня» видны и свои, и события мужа", t)
await page.evaluate(() => { const k = calCustAdd("Муж"); calS().map["kirill@gmail.com"] = k; save(false) })
t = await todayTxt()
check(/Совещание Кирилла/.test(t), "категория «Муж» включена — события видны", t)
await page.evaluate(() => { const l = calLayers().find(l => l.name === "Муж"); calS().layers[l.k] = 0; save(false) })
t = await todayTxt()
check(!/Кирилла/.test(t) && /Моя встреча/.test(t), "слой «Муж» снят — событий мужа на «Сегодня» нет, свои на месте", t)
const nc = await page.evaluate(() => nowCard(iphone(), new Date(2026, 10, 16, 10, 50)))
check(!/Кирилла/.test(nc), "и в карточке «Сейчас»", nc)
const dots = await page.evaluate(() => document.querySelector("#strip .day.on .n").textContent)
check(dots === "1 соб.", "счётчик дня в ленте — только видимые события", dots)
await shot("tf-1-today-layer-off")
await page.evaluate(() => { const l = calLayers().find(l => l.name === "Муж"); calS().layers[l.k] = 1; save(false) })
check(/Совещание Кирилла/.test(await todayTxt()), "слой вернули — события снова видны")

// 2. «Нет сети» — пока таблица не ответила; ответила на любой запрос — строки нет
const net = await page.evaluate(async () => {
  D.sync.error = "нет связи с таблицей (Load failed)"; D.sync.errAt = Date.now(); netOkAt = 0; const a = netDown()
  netOk(); const b = netDown()
  D.sync.error = "таблица не ответила"; D.sync.errAt = Date.now() + 5; const c = netDown()
  D.sync.error = ""; return [a, b, c]
})
check(net[0] === true && net[1] === false && net[2] === true, "netDown: ошибка → да; таблица ответила → нет; новая ошибка → снова да", net)

// 3. Форма напоминания: «День» не залезает на «Время»
await page.evaluate(() => { setTab("today"); render(); remAdd({ title: "Сделать инвойс Дмитрию — Cosy Beach View", due: "2026-11-16T10:00" }); const r = D.rems.filter(x => !x.deleted).slice(-1)[0]; remSheet(r.id) })
await page.waitForTimeout(500)
const box = await page.evaluate(() => { const d = document.querySelector("#rm-d"), tt = document.querySelector("#rm-h")
  if (!d || !tt) return null; const a = d.getBoundingClientRect(), b = tt.getBoundingClientRect(); return { dr: a.right, tl: b.left, cs: getComputedStyle(d).minWidth } })
check(box && box.dr <= box.tl + 0.5 && box.cs === "0px", "поле даты кончается до поля времени, min-width 0", box)
await shot("tf-3-reminder")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })

// 4. «Добавить» в списке: пустая строка — кнопка неактивна; текст — активна
await page.evaluate(() => shopSheet()); await page.waitForTimeout(400)
const b0 = await page.evaluate(() => document.querySelector('#layer .sheet:last-child [data-a="add"]').disabled)
await page.fill("#it-t", "Молоко")
const b1 = await page.evaluate(() => document.querySelector('#layer .sheet:last-child [data-a="add"]').disabled)
await page.fill("#it-t", "  ")
const b2 = await page.evaluate(() => document.querySelector('#layer .sheet:last-child [data-a="add"]').disabled)
check(b0 === true && b1 === false && b2 === true, "«Добавить»: пусто — неактивна, текст — активна, пробелы — снова неактивна", [b0, b1, b2])
const bg = await page.evaluate(() => getComputedStyle(document.querySelector('#layer .sheet:last-child [data-a="add"]')).backgroundColor)
check(!/rgb\(\s*(2[0-9]|3[0-9]|4[0-9]),\s*1[3-9][0-9]/.test(bg), "неактивная — не зелёная", bg)
await shot("tf-4-add-empty")
await page.fill("#it-t", "Молоко"); await page.click('#layer .sheet:last-child [data-a="add"]'); await page.waitForTimeout(400)
check(await page.evaluate(() => live(D.shop).some(x => x.title === "Молоко")), "после ввода «Добавить» добавляет пункт")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })

// 5. Живой разговор: STT.reset есть, касание на паузе будит свежий микрофон
const tk = await page.evaluate(() => {
  let reset = 0; const real = window.STT; window.STT = Object.assign({}, real || {}, { on: () => true, reset: () => { reset++ }, prime: () => {} })
  window.TALK = { state: "pause", el: document.body }; const lis = window.talkListen; window.talkListen = () => {}
  try { talkWake(true) } finally { window.talkListen = lis; window.TALK = null; window.STT = real }
  return { reset, has: typeof (real && real.reset) }
})
check(tk.reset === 1, "касание на паузе — свежий микрофон (STT.reset)", tk)

// 6. Уже исправлено раньше (выкладка 15.11) — держим проверкой: «Оля» не подставляется, валюту спрашивают, вода выключается
const old = await page.evaluate(() => { D.mny = { partner: "Оля" }; const p = mnyPartner(); const ins = partnerIns(p)
  const ask = (() => { const c = D.cur; D.cur = ""; const r = curChosen(); D.cur = c; return r })()
  waterTipsSet(false); const w = waterTips(); waterTipsSet(true)
  return { p, ins, ask, w, cal: calStateLine() } })
check(old.p === "" && old.ins === "семьёй", "старое «Оля» не подставляется: «Общая с семьёй»", old)
check(old.w === false, "подсказки про воду выключаются насовсем", old)
check(!/не подключ/i.test(old.cal) || /НЕ подключён/.test(old.cal), "Изи знает настоящее состояние календаря", old.cal)
check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()
console.log(ok ? "TESTERFIX_OK" : "TESTERFIX_FAIL")
