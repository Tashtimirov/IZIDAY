// Общий сервер для друзей (dist/Friends.gs из build_friends.py): вход через Google, своя таблица у каждого,
// никакого доступа к данным другого, свой календарь, Изи через ключ владельца с лимитом, подсказки пушем
import { friendsServer } from "./fake_friends.mjs"
const { code, gs, post, books, props, mails, aiCalls, tokens, tzFmt, trashed } = friendsServer()
let fail = 0
const check = (name, ok, got) => { console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + JSON.stringify(got)}`); if (!ok) fail++ }
check("в сервере нет служб Почты и Календаря владельца", !/CalendarApp|GmailApp|getActiveSpreadsheet/.test(code))

// ── вход ──
check("сервер отвечает", gs.doGet().friends === true)
check("чужой сайт не войдёт", post({ login: { id_token: "alien" } }).ok === false)
check("просроченный пропуск не пускает", post({ login: { id_token: "old" } }).ok === false)
check("поддельный пропуск не пускает", post({ login: { id_token: "fake" } }).ok === false)
check("пропуск не от этого нажатия (nonce) не пускает", post({ login: { id_token: "ann", nonce: "zzz" } }).ok === false)
const A = post({ login: { id_token: "ann", nonce: "n1", tz: "Europe/Moscow" } })
check("Аня вошла: ключ, имя, почта", A.ok && A.secret.length >= 32 && A.isNew && A.me.name === "Аня" && A.me.email === "ann@example.com", A)
const annSheet = Object.values(books).find(b => /Аня/.test(b.name))
check("Ане создана своя таблица с листами и её часовым поясом", annSheet && annSheet.getSheetByName("_hub") !== null || annSheet.getSheets().length > 3, annSheet && annSheet.getSheets().map(s => s.name))
check("часовой пояс Ани — Москва", annSheet.tz === "Europe/Moscow")
check("владельцу пришло письмо о новом друге", mails.length === 1 && mails[0][0] === "owner@example.com" && /Аня/.test(mails[0][1]))
check("ключ входа хранится только в виде хеша", !JSON.stringify(props).includes(A.secret))
const A2 = post({ login: { id_token: "ann", nonce: "n1" } })
check("повторный вход: та же таблица, новый ключ, без письма", A2.ok && !A2.isNew && A2.secret !== A.secret && mails.length === 1 && Object.keys(books).length === 1)
const B = post({ login: { id_token: "bob" } })
check("Боб вошёл со своей таблицей", B.ok && Object.keys(books).length === 2)

// ── данные: у каждого свои ──
const hub = (s, h) => post({ secret: s, hub: Object.assign({ from: "app" }, h) })
const now = Date.now()
let r = hub(A.secret, { since: 0, lists: { money: [{ id: "m1", date: now, u: now, type: "expense", amount: 500, method: "cash", category: "Кафе", comment: "кофе" }] } })
check("Аня записала расход", r.ok && r.lists.money.length === 1, r)
check("ссылка на таблицу владельца другу не отдаётся", r.url === undefined)
check("расход попал в лист «Операции» Аниной таблицы", annSheet.getSheetByName("Операции").getLastRow() === 2)
r = hub(B.secret, { since: 0 })
check("Боб не видит Аниных расходов", r.ok && r.lists.money.length === 0, r.lists.money)
check("неверный ключ — отказ", hub("x".repeat(40), { since: 0 }).error === "forbidden")
check("без ключа — отказ", post({ hub: { since: 0 } }).error === "forbidden")
r = hub(A.secret, { since: 0, mail: { action: "search", query: "in:inbox" }, fire: { url: "https://api.anthropic.com/v1/claude_code/routines/trig_x/fire", text: "x" } })
check("почта и Claude Code владельца другу недоступны", r.mail && r.mail.error && r.fire && r.fire.error && !aiCalls.length, r)
r = hub(A.secret, { read: {} })
check("Изи читает листы только своей таблицы", r.read && r.read.sheets.some(s => s.name === "Операции"), r.read)

// ── календарь внутри таблицы ──
const cal = (s, c) => hub(s, { cal: c }).cal
let c = cal(A.secret, { action: "create", title: "Падел", start: "2026-11-10T19:00", end: "2026-11-10T20:30", location: "Sport Club" })
check("событие создано", c.ok && c.event.start === "2026-11-10T19:00" && c.event.end === "2026-11-10T20:30" && c.event.calendar === "IZIDAY", c)
const padel = c.event.id
c = cal(A.secret, { action: "create", title: "Английский", start: "2026-11-09T09:00", repeat: { freq: "weekly", days: ["MO", "WE"] } })
const eng = c.event.id
c = cal(A.secret, { action: "create", title: "ДР мамы", start: "2026-11-12", all_day: true, end: "2026-11-12" })
let L = cal(A.secret, { action: "list", from: "2026-11-09", to: "2026-11-22" })
const titles = L.events.map(e => e.title + " " + e.start)
check("список: разовое, весь день и повторы пн/ср", L.calendars[0].primary && titles.includes("Падел 2026-11-10T19:00") && titles.includes("ДР мамы 2026-11-12") &&
  ["2026-11-09T09:00", "2026-11-11T09:00", "2026-11-16T09:00", "2026-11-18T09:00"].every(s => titles.includes("Английский " + s)) && titles.filter(t => /Английский/.test(t)).length === 4, titles)
check("событие весь день длится один день", L.events.find(e => e.title === "ДР мамы").end === "2026-11-12")
check("Боб не видит Аниного календаря", cal(B.secret, { action: "list", from: "2026-11-09", to: "2026-11-22" }).events.length === 0)
c = cal(A.secret, { action: "update", id: padel, start: "2026-11-10T20:00" })
check("перенос сохраняет длительность", c.ok && c.event.start === "2026-11-10T20:00" && c.event.end === "2026-11-10T21:30", c)
c = cal(A.secret, { action: "update", id: eng, occurrence_start: "2026-11-11T09:00", start: "2026-11-11T18:00" })
L = cal(A.secret, { action: "list", from: "2026-11-09", to: "2026-11-22" })
const engs = L.events.filter(e => e.title === "Английский").map(e => e.start)
check("перенос одного повторения не трогает остальные", engs.includes("2026-11-11T18:00") && !engs.includes("2026-11-11T09:00") && engs.includes("2026-11-16T09:00"), engs)
cal(A.secret, { action: "delete", id: eng, occurrence_start: "2026-11-16T09:00" })
cal(A.secret, { action: "delete", id: eng, occurrence_start: "2026-11-18T09:00", all_future: true })
L = cal(A.secret, { action: "list", from: "2026-11-09", to: "2026-11-30" })
const left = L.events.filter(e => e.title === "Английский").map(e => e.start)
check("удаление: одно повторение и «это и все следующие»", JSON.stringify(left) === JSON.stringify(["2026-11-09T09:00", "2026-11-11T18:00"]), left)
cal(A.secret, { action: "delete", id: padel })
check("удаление разового", !cal(A.secret, { action: "list", from: "2026-11-09", to: "2026-11-30" }).events.some(e => e.title === "Падел"))
c = cal(A.secret, { action: "create", title: "Каждый день", start: "2026-12-30T07:00", repeat: { freq: "daily" } })
L = cal(A.secret, { action: "list", from: "2026-12-31", to: "2027-01-02" })
check("ежедневное переходит через Новый год", L.events.filter(e => e.title === "Каждый день").length === 3, L.events.map(e => e.start))
check("ошибка календаря — текстом, а не падением", /нет события/.test(cal(A.secret, { action: "update", id: "nope", title: "x" }).error))

// ── Изи ──
r = post({ secret: A.secret, ai: { model: "claude-opus-5-5", max_tokens: 64000, fallbacks: "default", thinking: { type: "enabled" }, messages: [{ role: "user", content: "привет" }] } })
check("без ключа владельца Изи вежливо молчит", r.error && r.error.type === "nokey", r)
props.ANTHROPIC_KEY = "sk-owner"
r = post({ secret: A.secret, ai: { model: "claude-opus-5-5", max_tokens: 64000, fallbacks: "default", thinking: { type: "enabled" }, messages: [{ role: "user", content: "привет" }] } })
const call = aiCalls.at(-1)
check("Изи отвечает через ключ владельца", r.content[0].text === "Привет!" && call.key === "sk-owner")
check("модель и потолок задаёт сервер, не телефон", call.body.model === gs.FR.model && call.body.max_tokens === gs.FR.maxTokens && !call.body.fallbacks && !call.body.thinking, call.body)
props.AI_DAY = "3"
post({ secret: A.secret, ai: { messages: [{ role: "user", content: "2" }] } }); post({ secret: A.secret, ai: { messages: [{ role: "user", content: "3" }] } })
r = post({ secret: A.secret, ai: { messages: [{ role: "user", content: "4" }] } })
check("дневной лимит на человека", r.error && r.error.type === "limit", r)
r = post({ secret: B.secret, ai: { messages: [{ role: "user", content: "1" }] } })
check("лимит Ани не мешает Бобу", r.content && r.content[0].text === "Привет!")
check("ключ Claude телефону не отдаётся", !JSON.stringify(post({ secret: A.secret, me: 1 })).includes("sk-owner"))
check("сколько запросов осталось", post({ secret: B.secret, me: 1 }).me.left === 2)

// ── подсказки пушем ──
const sub = { endpoint: "https://web.push.apple.com/abc", keys: { p256dh: "x", auth: "y" } }
r = hub(A.secret, { push: { action: "subscribe", sub } })
check("Аня включила уведомления", r.ok && r.push && r.push.ok, r)
const nowWall = tzFmt(new Date(Date.now() + 5 * 60e3), "Europe/Moscow", "yyyy-MM-ddTHH:mm")
hub(A.secret, { lists: { rems: [{ id: "r1", date: now, u: now + 1, title: "Позвонить маме", due: tzFmt(new Date(Date.now() - 60e3), "Europe/Moscow", "yyyy-MM-ddTHH:mm") }] } })
let pushErr = null
try { gs.pushTick() } catch (e) { pushErr = e }
const out = JSON.parse(String(annSheet.getSheetByName("_hub").cells.find(x => x[0] === "push_out")?.slice(2).map(c => String(c).slice(1)).join("") || "[]"))
check("напоминание Ани ушло пушем", !pushErr && out.some(x => /Напоминание/.test(x.title) && /маме/.test(x.body || "")), pushErr ? String(pushErr.stack) : out)
check("у Боба без уведомлений обход не запускается", !Object.values(books).find(b => /Боб/.test(b.name)).getSheetByName("_hub").cells.some(x => x[0] === "push_last"))

// ── выход и места ──
post({ secret: A2.secret, logout: 1 })
check("после выхода ключ не работает", hub(A2.secret, { since: 0 }).error === "forbidden" && hub(A.secret, { since: 0 }).ok)
props.ALLOW = "bob@example.com"
check("список разрешённых почт: чужому вход закрыт", post({ login: { id_token: "ann", nonce: "n1" } }).ok === false)
delete props.ALLOW

// ── лиги общие ──
const lg = post({ secret: A.secret, league: { op: "new", name: "Друзья" } })
check("лигу создаёт вошедший друг", lg.ok && lg.league.code)
const lg2 = post({ league: { op: "put", code: lg.league.code, id: "u1", name: "Боб", week: "2026-11-09", pts: 10 } })
check("в лигу пишут по коду, без входа", lg2.ok && lg2.league.members.u1)

// ── удаление аккаунта ──
const nBooks = Object.keys(books).length, bobId = Object.keys(props).find(k => /^u:/.test(k) && /bob@/.test(props[k])).slice(2)
props["p:" + bobId + ":X"] = "1"; props["ai:2026-11-14:" + bobId] = "3"
check("удаление без подтверждения не срабатывает", post({ secret: B.secret, deleteMe: 1 }).ok === false && hub(B.secret, { since: 0 }).ok)
check("чужой ключ ничего не удаляет", post({ secret: "x".repeat(40), deleteMe: "delete" }).error === "forbidden")
const del = post({ secret: B.secret, deleteMe: "delete" })
check("Боб удалил аккаунт", del.ok && del.deleted, del)
check("таблица Боба ушла в корзину, Анина на месте", trashed.length === 1 && Object.keys(books).length === nBooks - 1 && hub(A.secret, { since: 0 }).ok)
check("ключ Боба больше не работает", hub(B.secret, { since: 0 }).error === "forbidden")
check("о Бобе на сервере не осталось записей", !Object.keys(props).some(k => k.indexOf(bobId) >= 0) && !JSON.stringify(props).includes("bob@example.com"), Object.keys(props).filter(k => k.indexOf(bobId) >= 0))
const B3 = post({ login: { id_token: "bob" } })
check("Боб может начать заново с пустого аккаунта", B3.ok && B3.isNew && hub(B3.secret, { since: 0 }).lists.money.length === 0, B3)

console.log(fail ? `FRIENDS_FAIL ${fail}` : "FRIENDS_OK")
