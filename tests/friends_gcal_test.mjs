// Google Календарь друга на общем сервере: подключение по коду Google, перенос событий из IZIDAY,
// список/создание/перенос/удаление через API Календаря, подсказки из него, отзыв доступа и отключение
import { friendsServer } from "./fake_friends.mjs"
import { fakeGoogle } from "./fake_gcal.mjs"

// поддельный Google: повторы — только DAILY/WEEKLY с BYDAY, этого хватает для проверки
const { G, google } = fakeGoogle()
const { gs, post, props, books, tzFmt } = friendsServer({ google })
let fail = 0
const check = (name, ok, got) => { console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + JSON.stringify(got)}`); if (!ok) fail++ }
const A = post({ login: { id_token: "ann", nonce: "n1", tz: "Europe/Moscow" } })
const B = post({ login: { id_token: "bob" } })
const hub = (s, h) => post({ secret: s, hub: Object.assign({ from: "app" }, h) })
const cal = (s, c) => hub(s, { cal: c }).cal
const RU = "https://iziday.pages.dev/"

// до подключения — календарь внутри IZIDAY
cal(A.secret, { action: "create", title: "Падел", start: "2026-11-20T19:00", end: "2026-11-20T20:30", location: "Sport Club" })
cal(A.secret, { action: "create", title: "Английский", start: "2026-11-16T09:00", repeat: { freq: "weekly", days: ["MO", "WE"] } })
check("до подключения: свой календарь IZIDAY", cal(A.secret, { action: "list", from: "2026-11-16", to: "2026-11-22" }).calendars[0].name === "IZIDAY")

let r = post({ secret: A.secret, gcal: { code: "c1", redirect_uri: RU } })
check("без секрета на сервере — понятный отказ", r.ok === false && /не настроен/.test(r.error), r)
props.GOOGLE_SECRET = "sec"
r = post({ secret: A.secret, gcal: { code: "c1", redirect_uri: "http://evil.example/" } })
check("адрес возврата только https", r.ok === false, r)
r = post({ secret: "x".repeat(40), gcal: { code: "c1", redirect_uri: RU } })
check("без входа подключить нельзя", r.error === "forbidden", r)
G.scope = "openid https://www.googleapis.com/auth/userinfo.email"
r = post({ secret: A.secret, gcal: { code: "c1", redirect_uri: RU } })
check("сняли галочку «Календарь» — просим подключить снова", r.ok === false && /галочк/.test(r.error), r)
delete G.scope; G.codes.c1 = "rt-ann"
r = post({ secret: A.secret, gcal: { code: "c1", redirect_uri: RU } })
check("подключён: почта календаря и перенос событий", r.ok && r.me.gcal === "ann.real@gmail.com" && r.moved === 2 && r.failed === 0, r)
check("ключ обновления хранится только на сервере", !JSON.stringify(r).includes("rt-ann") && props["p:" + A.me.id + ":GCAL"].includes("rt-ann"))
check("перенесённые события — в Google, повтор правилом", G.cals.primary.length === 2 && G.cals.primary.some(e => e.recurrence && /FREQ=WEEKLY;BYDAY=MO,WE/.test(e.recurrence[0])) &&
  G.cals.primary.some(e => e.summary === "Падел" && e.start.dateTime === "2026-11-20T19:00:00+03:00" && e.start.timeZone === "Europe/Moscow"), G.cals.primary)
check("Боба подключение Ани не касается", post({ secret: B.secret, me: 1 }).me.gcal === "" && cal(B.secret, { action: "list" }).calendars[0].name === "IZIDAY")

// список: все видимые календари, повторы раскрыты, отклонённые и отменённые не видны
G.cals["fam@group.calendar.google.com"].push({ id: "fam1", summary: "Ужин у мамы", start: { date: "2026-11-21" }, end: { date: "2026-11-22" } })
G.cals.primary.push({ id: "dec", summary: "Отказался", start: { dateTime: "2026-11-18T12:00:00+03:00" }, end: { dateTime: "2026-11-18T13:00:00+03:00" }, attendees: [{ self: true, responseStatus: "declined" }] })
let L = cal(A.secret, { action: "list", from: "2026-11-16", to: "2026-11-22" })
const T = L.events.map(e => `${e.title} ${e.start}`)
check("список из Google: разовое, повторы пн/ср, весь день из «Семьи»", T.includes("Падел 2026-11-20T19:00") && T.includes("Английский 2026-11-16T09:00") && T.includes("Английский 2026-11-18T09:00") &&
  L.events.find(e => e.title === "Ужин у мамы").end === "2026-11-21" && L.events.find(e => e.title === "Ужин у мамы").calendar === "Семья", T)
check("отклонённое приглашение не показывается", !T.some(t => /Отказался/.test(t)), T)
check("календари: основной и «Семья», скрытого нет", JSON.stringify(L.calendars) === JSON.stringify([{ name: "ann.real@gmail.com", primary: true }, { name: "Семья", primary: false }]), L.calendars)
check("время событий — в поясе Ани", L.events.find(e => e.title === "Падел").end === "2026-11-20T20:30")

// изменение одного повторения, перенос, удаление
const eng = L.events.find(e => e.start === "2026-11-18T09:00")
let c = cal(A.secret, { action: "update", id: eng.id, occurrence_start: eng.start, start: "2026-11-18T18:00" })
L = cal(A.secret, { action: "list", from: "2026-11-16", to: "2026-11-26" })
let engs = L.events.filter(e => e.title === "Английский").map(e => e.start)
check("перенос одного повторения: длительность та же, остальные на месте", c.ok && c.event.start === "2026-11-18T18:00" && c.event.end === "2026-11-18T19:00" && engs.includes("2026-11-23T09:00") && engs.includes("2026-11-18T18:00") && !engs.includes("2026-11-18T09:00"), [c, engs])
const fam = L.events.find(e => e.title === "Ужин у мамы")
c = cal(A.secret, { action: "update", id: fam.id, occurrence_start: fam.start, title: "Ужин у мамы и папы" })
check("событие из второго календаря меняется в нём же", c.ok && G.cals["fam@group.calendar.google.com"][0].summary === "Ужин у мамы и папы", c)
const e23 = L.events.find(e => e.start === "2026-11-23T09:00")
cal(A.secret, { action: "delete", id: e23.id, occurrence_start: e23.start })
const e25 = L.events.find(e => e.start === "2026-11-25T09:00")
c = cal(A.secret, { action: "delete", id: e25.id, occurrence_start: e25.start, all_future: true })
L = cal(A.secret, { action: "list", from: "2026-11-16", to: "2026-12-10" })
engs = L.events.filter(e => e.title === "Английский").map(e => e.start)
check("удаление одного повторения и «это и все следующие»", c.ok && c.deleted === "from" && JSON.stringify(engs) === JSON.stringify(["2026-11-16T09:00", "2026-11-18T18:00"]), [c, engs])
c = cal(A.secret, { action: "create", title: "Врач", start: "2026-11-19T10:00", calendar: "Семья" })
check("создание в выбранном календаре, час по умолчанию", c.ok && c.event.calendar === "Семья" && c.event.end === "2026-11-19T11:00" && G.cals["fam@group.calendar.google.com"].some(e => e.summary === "Врач"), c)
c = cal(A.secret, { action: "create", title: "Отпуск", start: "2026-12-01", end: "2026-12-03", all_day: true })
check("событие на несколько дней целиком", c.ok && c.event.all_day && c.event.start === "2026-12-01" && c.event.end === "2026-12-03" && G.cals.primary.find(e => e.summary === "Отпуск").end.date === "2026-12-04", c)
check("ошибка Google — текстом", /нет события/.test(cal(A.secret, { action: "update", id: "nope", occurrence_start: "2026-11-19T10:00", title: "x" }).error))

// доступ на час истёк — обновляется сам
G.expired = JSON.parse(props["p:" + A.me.id + ":GCAL"]).at
const ref0 = G.refreshes
L = cal(A.secret, { action: "list", from: "2026-11-16", to: "2026-11-22" })
check("истёкший доступ обновляется по ключу", L.events && L.events.length > 0 && G.refreshes > ref0, L)

// подсказки: утренняя сводка берёт встречи из Google Календаря
const today = tzFmt(new Date(), "Europe/Moscow", "yyyy-MM-dd")
G.cals.primary.push({ id: "td", summary: "Созвон с Кириллом", start: { dateTime: today + "T23:30:00+03:00" }, end: { dateTime: today + "T23:50:00+03:00" } })
r = hub(A.secret, { push: { action: "subscribe", sub: { endpoint: "https://web.push.apple.com/abc", keys: { p256dh: "x", auth: "y" } } } })
let pushErr = null
try { gs.pushTick() } catch (e) { pushErr = e }
check("обход подсказок с Google Календарём не падает", !pushErr, pushErr && String(pushErr.stack))
check("подсказки читали Google Календарь", G.calls.some(x => /\/calendars\/primary\/events$/.test(x)), G.calls.slice(-5))

// доступ отозван в Google — понятная ошибка и возврат к своему календарю
G.dead.add("rt-ann"); G.expired = JSON.parse(props["p:" + A.me.id + ":GCAL"]).at
r = cal(A.secret, { action: "list" })
check("отозванный доступ: просим подключить снова", /отозван/.test(r.error || ""), r)
check("после отзыва — снова свой календарь IZIDAY", post({ secret: A.secret, me: 1 }).me.gcal === "" && cal(A.secret, { action: "list" }).calendars[0].name === "IZIDAY")

// подключить заново и отключить
G.dead.delete("rt-ann"); G.codes.c2 = "rt-ann2"
r = post({ secret: A.secret, gcal: { code: "c2", redirect_uri: RU } })
check("повторное подключение: в IZIDAY событий не осталось — переносить нечего", r.ok && r.moved === 0, r)
r = post({ secret: A.secret, gcal: { off: 1 } })
check("отключение отзывает доступ у Google", r.ok && r.me.gcal === "" && G.revoked.includes("rt-ann2") && !props["p:" + A.me.id + ":GCAL"], r)

// без доступа к списку календарей — только основной
G.lists = false; G.codes.c3 = "rt-ann3"; G.scope = "openid https://www.googleapis.com/auth/calendar.events"
r = post({ secret: A.secret, gcal: { code: "c3", redirect_uri: RU } })
L = cal(A.secret, { action: "list", from: "2026-11-16", to: "2026-11-22" })
check("без списка календарей работает основной", r.ok && L.calendars.length === 1 && L.calendars[0].primary && L.events.some(e => e.title === "Падел"), L)

console.log(fail ? `FRIENDS_GCAL_FAIL ${fail}` : "FRIENDS_GCAL_OK")
