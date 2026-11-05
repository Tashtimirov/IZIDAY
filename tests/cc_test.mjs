// Задача в Claude Code возвращает итог в чат: карточка «в работе» → сессия пишет строку в лист «Ответы Claude Code» →
// при обмене Изи пишет «Готово: …» со ссылками, карточка «готово», пуш «Задача готова»; долго молчит — Изи скажет.
// Провал — строка CC_FAIL. Скриншоты: node tests/cc_test.mjs <папка>
import { boot2 } from "./today_boot.mjs"
const out = process.argv[2]
const time = new Date("2026-11-05T05:00:00Z")
const { page, browser, server, errors, sheet } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
const shot = async name => { if (out) { await page.waitForTimeout(300); await page.screenshot({ path: `${out}/${name}.png` }) } }
// Claude: сначала вызывает claude_code, потом коротко говорит, куда передал
let turn = 0
await page.route("https://api.anthropic.com/v1/messages", r => {
  if (r.request().method() === "OPTIONS") return r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } })
  turn++
  const body = turn === 1
    ? { content: [{ type: "tool_use", id: "t1", name: "claude_code", input: { route: "Личное", title: "Отель на Пхукете", task: "Подобрать отель на Пхукете на 12–15 ноября, до 4000 ฿ за ночь, у пляжа Ката." } }], stop_reason: "tool_use" }
    : { content: [{ type: "text", text: "Передал в Claude Code. Итог пришлю сюда, как только сессия закончит." }], stop_reason: "end_turn" }
  return r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) })
})
sheet.props.ROUTES = JSON.stringify([{ name: "Личное", url: "https://api.anthropic.com/v1/claude_code/routines/trig_x/fire", token: "t" }])   // ключ рутины — в свойствах скрипта
await page.evaluate(() => { D.conn.routes = [{ name: "Личное", hint: "личные задачи", url: "https://api.anthropic.com/v1/claude_code/routines/trig_x/fire" }]; save(false); setTab("chat") })
await page.waitForTimeout(300)
await page.evaluate(() => chatSend("Подбери мне отель на Пхукете на 12–15 ноября, до 4000 бат, у Каты"))
await page.waitForTimeout(1200)
const id = await page.evaluate(() => Object.keys(D.cc)[0])
ok(id && await page.evaluate(id => D.cc[id].state === "run" && D.cc[id].title === "Отель на Пхукете" && D.cc[id].url === "https://claude.ai/code/session_test", id), "задача запомнена: номер, название, ссылка")
ok(await page.$eval(".m.assistant:last-of-type .cc-card", e => !e.classList.contains("done") && /в работе/.test(e.textContent)).catch(() => false), "под ответом — карточка «в работе»")
ok(await page.$$eval(".m.assistant .links a", a => a.length) === 0, "старой голой ссылки нет — она в карточке")
const ccSh = sheet.ss.getSheetByName("Ответы Claude Code")
ok(ccSh && ccSh.cells[0][0] === "Номер задачи", "в таблице появился лист «Ответы Claude Code»")
await shot("cc-1-run")
// прошло 25 минут: статус на карточке обновился
await page.clock.setFixedTime(+time + 25 * 60e3)
await page.evaluate(() => sync()); await page.waitForTimeout(800)
ok(await page.$eval(".cc-card .cc-st", e => e.textContent) === "в работе · 25 мин", "статус: в работе · 25 мин")
// сессия закончила и вписала итог
ccSh.cells.push([id, "2026-11-05 12:40", "Нашёл 3 отеля у Каты до 4000 ฿: Kata Sea Breeze (3200 ฿), Sugar Marina (3700 ฿), Kata Palm (3900 ฿).\nЛучший по отзывам — Sugar Marina, 300 м до пляжа.\nСравнение — в документе, бронировать не стал.", "https://docs.google.com/document/d/abc javascript:alert(1)"])
await page.clock.setFixedTime(+time + 41 * 60e3)
await page.evaluate(() => sync()); await page.waitForTimeout(900)
const done = await page.evaluate(() => D.chat[D.chat.length - 1])
ok(done.role === "assistant" && done.ccDone === id && /^Готово: «Отель на Пхукете»\.\nНашёл 3 отеля/.test(done.text), "Изи пишет итог в чат: " + done.text.split("\n")[0])
ok(await page.$eval(".cc-card", e => e.classList.contains("done") && /готово/.test(e.textContent)), "карточка «готово»")
ok(await page.$$eval(".m.assistant:last-of-type .cc-links a", a => a.map(x => x.textContent).join("|")) === "Документ Google|Открыть сессию", "ссылки: документ и сессия, javascript: отброшен")
ok(await page.$$eval(".cc-card.done", e => e.length) === 1, "первая карточка стала «готово», под итогом — только ссылки")
await shot("cc-2-done")
await page.evaluate(() => sync()); await page.waitForTimeout(700)
ok(await page.evaluate(() => D.chat.filter(m => /^Готово: «Отель/.test(m.text)).length) === 1, "итог не дублируется при следующем обмене")
// пуш «Задача готова» (если приложение закрыто)
sheet.post({ secret: "s".repeat(32), hub: { from: "app", push: { action: "subscribe", sub: { endpoint: "https://push.example/a", keys: { p256dh: "x", auth: "y" } } } } })
sheet.pushTick()
const outbox = sheet.post({ secret: "s".repeat(32), hub: { from: "app", push: { action: "outbox" } } }).push.items
ok(outbox.some(x => x.title === "Задача готова" && /Отель на Пхукете/.test(x.body) && x.url === "./#chat"), "пуш «Задача готова»")
// задача молчит больше 3 часов — Изи скажет один раз
await page.evaluate(() => { ccSet({ id: "ccOld", title: "Разбор договора", route: "Личное", url: "https://claude.ai/code/session_old", at: Date.now() - 4 * 3600e3, state: "run" }); ccLate(); ccLate() })
ok(await page.evaluate(() => D.chat.filter(m => /«Разбор договора» идёт уже 4 ч/.test(m.text)).length) === 1, "долгая задача: одно сообщение со ссылкой")
// голосовой разговор: итог читается вслух
ok(await page.evaluate(() => typeof talkHear === "function"), "итог уходит в talkHear (вслух в разговоре)")
// вопрос, где нужен интернет («лучшие кафе в округе»): Изи сам передаёт в Claude Code, с местом пользователя
ok(await page.evaluate(() => /Интернета у тебя нет/.test(chatSystem()) && /near_me/.test(chatSystem()) && chatTools().find(t => t.name === "claude_code").input_schema.properties.near_me), "правило: вопросы из интернета — сразу в Claude Code, near_me")
let turn2 = 0
await page.unroute("https://api.anthropic.com/v1/messages")
await page.route("https://api.anthropic.com/v1/messages", r => {
  if (r.request().method() === "OPTIONS") return r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } })
  turn2++
  const body = turn2 === 1
    ? { content: [{ type: "tool_use", id: "t2", name: "claude_code", input: { route: "Личное", title: "Лучшие кафе рядом", near_me: true, task: "Найти три лучших кафе рядом с пользователем по отзывам и рейтингам: название, чем хорошо, сколько идти." } }], stop_reason: "tool_use" }
    : { content: [{ type: "text", text: "Узнаю по отзывам и рейтингам — итог пришлю сюда через несколько минут." }], stop_reason: "end_turn" }
  return r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) })
})
await page.evaluate(() => { D.chat = []; renderChat() })
await page.evaluate(() => chatSend("Какие три кафе в округе ты считаешь лучшими", { voice: true }))
await page.waitForTimeout(1500)
ok(/Где сейчас пользователь/.test(globalThis.__fired || "") && /координаты 7\.84/.test(globalThis.__fired || ""), "к задаче добавлено место пользователя: " + String(globalThis.__fired || "").split("\n").find(l => /Где сейчас/.test(l)))
ok(/Как вернуть результат/.test(globalThis.__fired || ""), "и инструкция вернуть итог")
await shot("cc-3-cafe")
ok(!errors.length, "без ошибок на странице " + errors.join("; "))
console.log(fails ? `CC_FAIL ${fails}` : "CC_OK")
await browser.close(); server.close()
