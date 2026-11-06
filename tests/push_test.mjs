// Пуш-уведомления из таблицы: ключи VAPID, подпись ES256 (проверяется Node crypto), расписание pushTick —
// подсказки, напоминания, вода и «пора выезжать» с дорогой по Картам; повтор не шлётся; исчезнувшая подписка удаляется
import crypto from "crypto"
import { sheetScript } from "./fake_sheet.mjs"
let ok = true
const check = (c, msg, got) => { console.log(c ? "✓" : "✗", msg, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const sh = sheetScript(), S = "s".repeat(32)
const hub = h => sh.post({ secret: S, hub: h })
hub({ from: "app", since: 0 })
const z = n => String(n).padStart(2, "0"), iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
const now = Date.now()

// 1. ключ и подписка
const key = hub({ from: "app", push: { action: "key" } }).push.key
const raw = Buffer.from(key, "base64url")
check(raw.length === 65 && raw[0] === 4, "открытый ключ VAPID — 65 байт P-256", raw.length)
check(hub({ from: "app", push: { action: "key" } }).push.key === key, "ключ один и тот же (хранится в свойствах)")
const sub = hub({ from: "app", push: { action: "subscribe", sub: { endpoint: "https://push.example/abc", keys: { p256dh: "x", auth: "y" } }, cfg: { waterGoal: 2000 } } }).push
check(sub.ok && sh.triggers.length === 1 && sh.triggers[0].every === 5, "подписка сохранена, расписание каждые 5 минут", sh.triggers)
hub({ from: "app", push: { action: "subscribe", sub: { endpoint: "https://push.example/abc", keys: { p256dh: "x", auth: "y" } } } })
check(sh.triggers.length === 1, "повторная подписка не плодит расписаний")

// 2. проверочный пуш и подпись
const t = hub({ from: "app", push: { action: "test" } }).push
check(t.sent === 1, "проверочный пуш ушёл", t)
const auth = sh.pushes[0].headers.Authorization, m = auth.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)
const pub = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33).toString("base64url") }, format: "jwk" })
const valid = m && crypto.verify("sha256", Buffer.from(m[1] + "." + m[2]), { key: pub, dsaEncoding: "ieee-p1363" }, Buffer.from(m[3], "base64url"))
const claims = m && JSON.parse(Buffer.from(m[2], "base64url"))
check(valid, "подпись JWT ES256 верна", auth.slice(0, 80))
check(claims.aud === "https://push.example" && claims.exp > now / 1000 && /^https:/.test(claims.sub) && m[4] === key, "JWT: aud, exp, sub, ключ k", claims)
check(sh.pushes[0].headers.TTL && sh.pushes[0].headers.Urgency === "high", "заголовки TTL и Urgency")

// 3. старый виджет: таблица шлёт только «пора выезжать»
hub({ from: "widget", since: 0, snap: { events: [] }, lists: { nudges: [{ id: "n1", date: now - 60e3, u: now, text: "Выпей воды и разомнись" }] } })
sh.pushes.length = 0
let r = sh.pushTick()
check(r.sent === 0 && !sh.pushes.length, "со старым виджетом подсказки шлёт он сам, без повторов", r)

// 4. новый виджет (pushAware): подсказки, напоминания, вода, дорога
const ev = (min, title) => { const s = new Date(now + min * 60e3); const e = sh.cal.mk(title, s, new Date(+s + 3600e3), { location: "International School Bangkok" }); return e }
ev(40, "Забрать детей"); ev(60, "Падел"); ev(120, "Ужин")
hub({ from: "widget", since: 0, snap: { pushAware: 1, events: [] },
  lists: { nudges: [{ id: "n2", date: now - 2 * 60e3, u: now + 1, text: "Через час встреча — подготовь договор" }],
           rems: [{ id: "r1", date: now, u: now, title: "Позвонить маме", due: iso(new Date(now - 2 * 60e3)), done: false }],
           water: [{ id: "w1", date: now - 2.2 * 3600e3, u: now, ml: 250 }],
           locs: [{ id: "l1", date: now - 600e3, u: now, lat: 13.74, lng: 100.55 }] } })
r = sh.pushTick()
const out = hub({ from: "app", push: { action: "outbox" } }).push.items
const titles = out.map(x => x.title + " | " + x.body)
console.log("   " + titles.join("\n   "))
check(r.sent === 1, "один пуш на устройство за раз", r)
check(titles.some(x => /подготовь договор/.test(x)), "подсказка помощника")
check(titles.some(x => /Напоминание \| Позвонить маме/.test(x)), "напоминание в срок")
const h = new Date().getHours()
if (h < 21 && now - 2.2 * 3600e3 >= new Date().setHours(9, 0, 0, 0)) check(titles.some(x => /Пора стакан воды/.test(x)), "вода: через 2 ч после стакана")
check(titles.some(x => /Пора выезжать \| «Забрать детей».*~31 мин с пробками/.test(x)), "«пора выезжать» к детям с учётом пробок (31 мин + 10)")
check(titles.some(x => /Через 20 минут выезжать \| «Падел»/.test(x)), "за 20 минут до выезда на падел")
check(!titles.some(x => /Ужин/.test(x)), "до ужина ещё рано")
sh.pushes.length = 0
r = sh.pushTick()
check(!sh.pushes.length, "повторно то же самое не шлётся", r)

// 4б. место старше 12 часов: подсказка всё равно приходит, с пометкой
ev(39, "Забрать детей завтра")
hub({ from: "widget", since: 0, lists: { locs: [{ id: "l1", date: now - 20 * 3600e3, u: now + 5, lat: 13.74, lng: 100.55 }] } })
sh.pushTick()
const out2 = hub({ from: "app", push: { action: "outbox" } }).push.items.map(x => x.title + " | " + x.body)
check(out2.some(x => /Забрать детей завтра.*где вы были 20 ч назад/.test(x)), "место старое — «пора выезжать» всё равно, с пометкой", out2.slice(-2))
// 4б2. поездка («Отвезти детей в школу»): конец события — прибытие, пуш за ~3 мин до выезда (прибытие − дорога), без запаса сверху
const tripEv = (s, e, title) => sh.cal.mk(title, new Date(now + s * 60e3), new Date(now + e * 60e3), { location: "Phoenix School" })
tripEv(-2, 33, "Отвезти детей в школу")      // ехать 31 мин → выезд через 2 мин → пуш сейчас
tripEv(10, 60, "Отвезти Олю на танцы")        // выезд через 29 мин → рано; по старой логике (начало − 31 − 10) пуш ушёл бы уже
sh.pushTick()
const outTrip = hub({ from: "app", push: { action: "outbox" } }).push.items.map(x => x.title + " | " + x.body)
console.log("   " + outTrip.slice(-3).join("\n   "))
check(outTrip.some(x => /Пора выезжать \| Отвезти детей в школу: быть на месте к \d\d:\d\d, ехать ~31 мин.*Выезд в/.test(x)), "поездка: «пора выезжать» за пару минут до выезда, время — прибытие", outTrip.slice(-3))
check(!outTrip.some(x => /танцы/.test(x)), "поездка: за полчаса до выезда пуша ещё нет")
check(!outTrip.some(x => /Через 20 минут выезжать \| «Отвезти/.test(x)), "поездка: без лишнего «через 20 минут»")
// 4в. дела детей и голодание
const wdNow = ((new Date().getDay() + 6) % 7) + 1, hhmm = d => `${z(d.getHours())}:${z(d.getMinutes())}`
hub({ from: "app", since: 0, lists: { kids: [{ id: "k1", date: now, u: now + 9, title: "Плавание", kid: "Алия", take: "очки и полотенце", days: [wdNow], time: hhmm(new Date(now + 30 * 60e3)) },
  { id: "k2", date: now, u: now + 9, title: "Не сегодня", days: [wdNow % 7 + 1], time: hhmm(new Date(now + 30 * 60e3)) }],
  fast: [{ id: "g1", date: now, u: now + 9, start: now - 16 * 3600e3 - 60e3, hours: 16 }] } })
sh.pushTick()
const out3 = hub({ from: "app", push: { action: "outbox" } }).push.items.map(x => x.title + " | " + x.body)
check(out3.some(x => /Через 30 мин: Плавание \| .*Плавание \(Алия\) — взять: очки и полотенце/.test(x)), "дети: за 30 минут — что взять", out3.slice(-3))
check(!out3.some(x => /Не сегодня/.test(x)), "дети: дела другого дня не приходят")
check(out3.some(x => /Окно открыто \| 16 ч голодания позади/.test(x)), "голодание: окно открылось — пуш", out3.slice(-3))
// 4г. утренняя и вечерняя сводка: пуш в своё время, вечером — сколько трат без категории
hub({ from: "app", push: { action: "subscribe", sub: { endpoint: "https://push.example/abc", keys: { p256dh: "x", auth: "y" } }, cfg: { waterGoal: 2000, currency: "฿", briefs: { morning: hhmm(new Date(now)), evening: hhmm(new Date(now + 60e3)) } } } })
hub({ from: "app", since: 0, lists: { money: [{ id: "f1", date: now, u: now + 9, type: "expense", amount: 300, category: "Транспорт", method: "cash" },
  { id: "f2", date: now, u: now + 9, type: "expense", amount: 1250, category: "Другое", method: "transfer", comment: "Платёж по карте" }] } })
sh.pushTick()
const out4 = hub({ from: "app", push: { action: "outbox" } }).push.items
check(out4.some(x => x.title === "☀️ Утренняя сводка" && x.url === "./#brief=morning"), "утренняя сводка — пуш, открывает сводку в приложении", out4.slice(-3).map(x => x.title))
const evn = out4.find(x => x.title === "🌙 Итоги дня")
check(evn && /Потрачено 1\s?550 ฿, 1 без категории — разберём/.test(evn.body) && evn.url === "./#brief=evening", "вечером: итог трат и сколько без категории", evn)
const n4 = sh.pushes.length; sh.pushTick()
check(!hub({ from: "app", push: { action: "outbox" } }).push.items.slice(out4.length).some(x => /сводка|Итоги/.test(x.title)), "сводка — раз в день", n4)
// 5. исчезнувшая подписка удаляется
hub({ from: "app", push: { action: "subscribe", sub: { endpoint: "https://push.example/gone", keys: { p256dh: "x", auth: "y" } } } })
hub({ from: "app", push: { action: "test" } })
const st = hub({ from: "app", push: { action: "status" } }).push
check(st.subs === 1 && st.trigger, "ответ 410 — подписка удалена", st)
check(hub({ from: "widget", since: 0 }).pushOn === true, "виджет узнаёт, что пуши шлёт таблица")
console.log(ok ? "\nPUSH_OK" : "\nPUSH_FAIL")
process.exit(ok ? 0 : 1)
