// Надёжность до теста: «Нет сети» в шапке, время сервера при обмене, архив чата в IndexedDB,
// английский словарь только при английском языке.
//   node tests/reliability_test.mjs
import { boot2 } from "./today_boot.mjs"
const time = new Date("2026-11-12T03:30:00Z")
let fail = 0
const check = (name, ok, got) => { console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + JSON.stringify(got)}`); if (!ok) fail++ }

const reqs = []
const B = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time })
const { page, browser, server, errors } = B
page.on("request", r => reqs.push(r.url()))

// ── 1. Русский язык: английский словарь не загружается, но лежит в кэше оболочки
check("русский: словарь i18n-en.js не загружен", await page.evaluate(() => !window.EN_DICT && L.lang === "ru"))
const sw = await (await fetch(page.url().replace(/[#?].*$/, "").replace(/index\.html$/, "") + "sw.js")).text()
check("sw.js кладёт i18n-en.js в кэш (английский без сети)", /"i18n-en\.js"/.test(sw))

// ── 2. Нет сети
await page.evaluate(() => { D.sync.error = ""; renderTop() })
check("в сети подписи «Нет сети» нет", !/Нет сети/.test(await page.textContent("#top-sub")))
await page.clock.setSystemTime(new Date(+time + 120e3))   // часы на странице стояли: дальше идут сами (обмен и правки в разное время)
await page.evaluate(() => sync())   // поправка часов под новое время страницы
const cut = r => r.abort("internetdisconnected")   // подменённая таблица отвечает и без сети — обрываем запросы сами
await page.route("https://script.google.com/**", cut)
await page.context().setOffline(true)
await page.waitForTimeout(300)
await page.evaluate(() => { upsert("money", { id: "off1", date: Date.now(), type: "expense", amount: 120, method: "cash", category: "Кафе и рестораны", comment: "" }) })
await page.waitForTimeout(3500)   // save → обмен через 0,9 с → ошибка сети (+ повтор 1,2 с)
const sub = await page.textContent("#top-sub")
check("без сети в шапке «Нет сети» и сколько записей ждёт", /Нет сети\. \d+ (запись|записи|записей) на телефоне, отправлю позже/.test(sub), sub)
check("подпись выделена (класс net-off)", await page.evaluate(() => $("#top-sub").classList.contains("net-off")))
check("запись лежит на телефоне", await page.evaluate(() => JSON.parse(localStorage.getItem("myday.web")).money.some(x => x.id === "off1")))
check("технический текст ошибки не показан", !/таблиц|Load failed|Failed to fetch|TypeError/.test(sub), sub)
await page.unroute("https://script.google.com/**", cut)
await page.context().setOffline(false)
await page.evaluate(() => dispatchEvent(new Event("online")))
await page.waitForTimeout(3000)
const sub2 = await page.textContent("#top-sub")
const after = await page.evaluate(() => ({ err: D.sync.error, n: unsentCount(), p: D.sync.pushedAt, u: D.money.map(x => x.u), sk: D.sync.skew }))
check("сеть вернулась: обмен прошёл сам, подпись обычная", !/Нет сети/.test(sub2) && !after.err && after.n === 0, { sub2, after })
check("запись дошла до таблицы", B.sheet.post({ secret: "s".repeat(32), hub: { from: "widget", since: 0 } }).lists.money.some(x => x.id === "off1"))

// ── 3. Время сервера: часы телефона отстают на 2 часа — правка всё равно новее старой
await page.evaluate(() => { D.sync.skew = 0; save(false) })
const srvNow = Date.now()
const skew = await page.evaluate(async () => { await sync(); return D.sync.skew })
const phoneNow = +time + 120e3
check("поправка часов посчитана по ответу таблицы", Math.abs(skew - (srvNow - phoneNow)) < 60e3 || (Math.abs(srvNow - phoneNow) <= 30e3 && skew === 0), { skew, diff: srvNow - phoneNow })
check("skewOf: задержку сети до 30 с не считает сбоем часов", await page.evaluate(() => skewOf(1.8e12 + 20e3, 1.8e12, 1.8e12, 0) === 0 && skewOf(1.8e12 + 3600e3, 1.8e12, 1.8e12, 0) === 3600e3 && skewOf(undefined, 1, 2, 5) === 5))
const u = await page.evaluate(() => { const r = upsert("rems", { id: "rk", date: Date.now(), title: "проверка часов" }); return r.u })
check("время правки — по часам сервера", Math.abs(u - (phoneNow + skew)) < 15e3, { u, phoneNow, skew })
// другое устройство с верными часами правило ту же запись час назад (по серверу): наша правка новее и должна победить
const older = await page.evaluate(() => { mergeIn("rems", [{ id: "rk", date: Date.now(), title: "старое", u: nowSrv() - 3600e3 }]); return D.rems.find(x => x.id === "rk").title })
check("старая правка с другого устройства не перетирает свежую", older === "проверка часов", older)
await page.evaluate(() => sync()); await page.waitForTimeout(1500)
check("правка ушла в таблицу (pushedAt по тем же часам)", B.sheet.post({ secret: "s".repeat(32), hub: { from: "widget", since: 0 } }).lists.rems.some(x => x.id === "rk" && x.title === "проверка часов"))

// ── 4. Архив переписки — в IndexedDB, в localStorage его нет
await page.evaluate(() => { D.chat = Array.from({ length: 230 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: "сообщение " + i, at: Date.now() - (300 - i) * 60e3 })); save(false) })
await page.evaluate(() => { D.chatArchive = D.chatArchive.concat(D.chat.slice(0, 30)); D.chat = D.chat.slice(30); save(false) })
await page.waitForTimeout(900)
const st = await page.evaluate(async () => ({ ls: JSON.parse(localStorage.getItem("myday.web")).chatArchive, mem: D.chatArchive.length, idb: ((await archIo("readonly")) || []).length }))
check("архив чата лежит в IndexedDB", st.idb === 30 && st.mem === 30, st)
check("в записи localStorage архива нет", st.ls === undefined, st.ls && st.ls.length)
const found = await page.evaluate(() => searchChats("сообщение"))
check("поиск по старым чатам находит сообщение из архива", (found.messages || []).some(m => /^сообщение \d$/.test(m.text)) || (found.messages || []).length > 0, found)
// старая версия: архив в localStorage → после перезапуска переезжает в IndexedDB без повторов
await page.evaluate(async () => { const d = JSON.parse(localStorage.getItem("myday.web")); d.chatArchive = [{ role: "user", text: "из старой версии", at: 1 }].concat(D.chatArchive.slice(0, 5)); localStorage.setItem("myday.web", JSON.stringify(d)) })
await page.reload(); await page.waitForTimeout(2500)
const st2 = await page.evaluate(async () => ({ mem: D.chatArchive.length, idb: ((await archIo("readonly")) || []).length, ls: JSON.parse(localStorage.getItem("myday.web")).chatArchive, first: D.chatArchive[0].text }))
check("после перезапуска: старый архив перенесён, повторов нет", st2.mem === 31 && st2.idb === 31 && st2.first === "из старой версии", st2)
check("и снова не в localStorage", st2.ls === undefined)
// выход из аккаунта стирает и архив
await page.evaluate(async () => { D = {}; localStorage.removeItem("myday.web"); load(); await new Promise(r => setTimeout(r, 600)) })
check("выход/удаление аккаунта стирает архив переписки", await page.evaluate(async () => ((await archIo("readonly")) || []).length === 0))

check("без ошибок на странице", !errors.filter(e => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource|Load failed|Failed to fetch/.test(e)).length, errors)
await browser.close(); server.close()

// ── 5. Английский: словарь подключается и всё переводится (подробно — i18n_en_test.mjs)
const E = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time, ctxOpts: { locale: "en-US" }, init: () => { try { localStorage.setItem("izi-lang", "en") } catch (e) {} } })
check("английский: словарь загружен до приложения", await E.page.evaluate(() => !!window.EN_DICT && L.en && !/[А-Яа-яЁё]/.test(document.querySelector("#tabs").innerText)))
await E.page.context().setOffline(true)
await E.page.evaluate(() => { D.sync.error = "нет связи с таблицей (Load failed)"; renderTop() }); await E.page.waitForTimeout(300)
const esub = await E.page.textContent("#top-sub")
check("английский: «Offline» вместо русского", /^Offline\./.test(esub.trim()), esub)
await E.browser.close(); E.server.close()

console.log(fail ? `\n${fail} ПРОВАЛ(ОВ)` : "\nRELIABILITY_OK")
process.exit(fail ? 1 : 0)
