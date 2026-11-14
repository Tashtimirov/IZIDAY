// Заявка на подписку и «Пригласить друга» на общем сервере друзей (Friends.gs): лимит, одобрение владельцем, таблица
import { friendsServer } from "./fake_friends.mjs"
let fails = 0
const ok = (c, m) => { if (!c) { fails++; console.log("✗ " + m) } else console.log("✓ " + m) }
const S = friendsServer()
const { post, gs, props, mails, books } = S
const login = (tok, extra = {}) => post({ login: Object.assign({ id_token: tok }, extra) })
const a = login("ann", { nonce: "n1" })
ok(a.ok && a.secret, "Аня вошла")
// заявка без входа и со входом
let r = post({ lead: { price: "6,99 $ — нормально", lang: "ru", id: "abcdef0123456789", ver: "x", dev: "iPhone" } })
ok(r.ok && r.n === 1, "заявка без входа записана")
r = post({ secret: a.secret, lead: { price: "около 5 $" } })
ok(r.ok && r.n === 2, "заявка Ани записана")
const m0 = mails.length
r = post({ secret: a.secret, lead: { price: "10 $ и больше" } })
ok(r.ok && r.n === 2 && mails.length === m0, "повторная заявка обновляет строку, без нового письма")
const book = Object.values(books).find(b => b.name === "IZIDAY — Заявки и приглашения")
const lead = book.getSheetByName("Подписка")
ok(lead.cells[2][1] === "Аня" && lead.cells[2][4] === "10 $ и больше", "в таблице имя и новая цена")
ok(post({ lead: { id: "x" } }).ok === false, "заявка без id отклонена")
ok(post({ lead: { id: "abcdef0123456789", price: "=HYPERLINK(1)" } }).ok && !String(lead.cells[1][4]).startsWith("="), "формулы в таблицу не попадают")
// своя ссылка
r = post({ secret: a.secret, ref: { op: "get" } })
ok(r.ok && /^[0-9a-f]{6}$/.test(r.code) && r.left === 3 && r.per === 3 && /\?r=/.test(r.link), "у Ани ссылка и 3 приглашения")
const code = r.code
ok(post({ secret: a.secret, ref: {} }).code === code, "код постоянный")
ok(post({ ref: { op: "get" } }).ok === false, "без входа ссылку не дают")
// Боб пришёл по ссылке → ждёт одобрения
const m1 = mails.length
let b = login("bob", { ref: code })
ok(!b.ok && b.wait && /bob@example.com/.test(b.error), "Боб по приглашению ждёт одобрения")
ok(mails.length === m1 + 1 && /Открыть доступ: https:\/\/script.google.com\/macros\/s\/TEST\/exec\?ok=[0-9a-f]{40}&a=yes/.test(mails[mails.length - 1][2]), "владельцу письмо со ссылкой одобрения")
b = login("bob", { ref: code })
ok(!b.ok && b.wait && mails.length === m1 + 1, "повторный вход: без второго письма")
r = post({ secret: a.secret, ref: { op: "get" } })
ok(r.left === 2 && r.list[0].name === "Боб" && r.list[0].st === "wait", "у Ани: Боб ждёт, осталось 2")
const tok = mails[m1][2].match(/ok=([0-9a-f]{40})&a=yes/)[1]
// без кода — обычный вход по-прежнему (ALLOW пуст, REF_ONLY нет)
// владелец одобряет
const page = gs.doGet({ parameter: { ok: tok, a: "yes" } })
ok(page.html && /может войти/.test(page.html), "страница «Готово» владельцу")
ok(mails.some(m => m[0] === "bob@example.com" && /доступ открыт/i.test(m[1])), "Бобу письмо «доступ открыт»")
ok(/уже решена/.test(gs.doGet({ parameter: { ok: tok, a: "yes" } }).html), "ссылка второй раз не срабатывает")
ok(gs.doGet({}).friends === true, "обычный doGet без изменений")
b = login("bob", { ref: code })
ok(b.ok && b.secret && b.isNew, "Боб вошёл после одобрения")
r = post({ secret: a.secret, ref: { op: "get" } })
ok(r.list[0].st === "in" && r.left === 2, "у Ани: Боб в IZIDAY")
const inv = book.getSheetByName("Приглашения")
ok(inv.cells[1][3] === "Боб" && inv.cells[1][5] === "вошёл", "лист «Приглашения»: Боб вошёл")
// отказ не тратит приглашение
login("cat", { ref: code })
const tc = mails.filter(m => /Катя/.test(m[1])).pop()[2].match(/ok=([0-9a-f]{40})&a=no/)[1]
ok(/Отказано/.test(gs.doGet({ parameter: { ok: tc, a: "no" } }).html), "владелец отказал Кате")
r = post({ secret: a.secret, ref: { op: "get" } })
ok(r.left === 2 && r.list.find(x => x.name === "Катя").st === "no", "отказ не тратит приглашение")
ok(login("cat", { ref: code }).wait, "после отказа Катя снова может подать заявку")
// предел приглашений
props.REF_PER = "2"
const d = login("dan", { ref: code })
ok(!d.ok && !d.wait && /закончились приглашения/.test(d.error), "сверх предела — отказ")
props.REF_PER = "5"
// ALLOW: не в списке, но одобрен — входит; без одобрения — нет
props.ALLOW = "ann@example.com"
ok(!login("dan").ok, "ALLOW: Дэн без приглашения не входит")
ok(login("ann").ok, "ALLOW: Аня входит")
ok(login("bob").ok, "ALLOW: одобренный Боб входит без кода")
delete props.ALLOW
// REF_ONLY: без кода не пускаем
props.REF_ONLY = "1"
ok(!login("dan").ok, "REF_ONLY: без приглашения не входит")
delete props.REF_ONLY
// REF_AUTO: сразу, но в пределах
props.REF_AUTO = "1"
const dd = login("dan", { ref: code })
ok(dd.ok && dd.isNew, "REF_AUTO: Дэн вошёл сразу")
delete props.REF_AUTO
// чужой код и своя ссылка
ok(login("ann", { ref: "000000" }).ok, "неверный код не мешает знакомому")
// мест нет: заявка не создаётся
gs.FR.max = 2
const e = login("eve0", { ref: code })
ok(!e.ok, "без пропуска Google — отказ")
console.log(fails ? `GROW_FAIL (${fails})` : "GROW_OK")
