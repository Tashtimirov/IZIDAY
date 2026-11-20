// Рост на сервере друзей: двусторонний бонус после 7 активных дней, второй уровень, статусы, партнёры, семья, лига приглашений
import { friendsServer, CLIENT } from "./fake_friends.mjs"
let fails = 0
const ok = (c, m, got) => { if (!c) { fails++; console.log("✗ " + m, got === undefined ? "" : JSON.stringify(got)) } else console.log("✓ " + m) }
const S = friendsServer()
const { post, props, tokens, books } = S
props.ANTHROPIC_KEY = "sk-test"
const tok = (k, sub, email, name) => { tokens[k] = { aud: CLIENT, iss: "accounts.google.com", exp: String(Date.now() / 1000 + 3600 | 0), email_verified: "true", sub, email, name } }
tok("eve", "777", "eve@example.com", "Ева Смирнова"); tok("fox", "888", "fox@example.com", "Фёдор"); tok("gin", "999", "gin@example.com", "Гоша")
const login = (k, extra = {}) => post({ login: Object.assign({ id_token: k }, extra) })
const user = s => { for (const k of Object.keys(props)) if (/^t:/.test(k)) { const id = props[k]; const u = JSON.parse(props["u:" + id]); if ((u.tokens || []).length && post({ secret: s, me: 1 }).me.id === id) return u } }
const ref = s => post({ secret: s, ref: { op: "get" } })
const me = s => post({ secret: s, me: 1 }).me
// один «день» активности: обмен с сервером, потом сдвигаем день назад, чтобы следующий обмен был новым днём
function days(s, n, fam) {
  for (let i = 0; i < n; i++) {
    post({ secret: s, hub: { from: "app", since: 9e15, snapAt: 9e15 }, fam })
    const id = me(s).id, u = JSON.parse(props["u:" + id]); u.ld = "2000-01-0" + (i % 9); props["u:" + id] = JSON.stringify(u)
  }
}
props.REF_AUTO = "1"; props.REF_PER = "3"
const a = login("ann"); ok(a.ok, "Аня вошла")
const ra = ref(a.secret)
ok(ra.ok && ra.lv === 0 && ra.status === "" && ra.next.n === "Друг" && ra.invitee === 30 && ra.days === 7 && ra.league.top.length === 0, "у Ани пока нет статуса, правила 7 дней / 30 дней", ra)
const b = login("bob", { ref: ra.code }); ok(b.ok && b.isNew, "Боб вошёл по ссылке Ани")
const rb = ref(b.secret)
const c = login("cat", { ref: rb.code }); ok(c.ok && c.isNew, "Катя вошла по ссылке Боба")
ok(ref(b.secret).myDays === 0, "у Боба счётчик своих дней 0 из 7")
// Боб активен 6 дней — бонуса ещё нет
days(b.secret, 6)
ok(!me(b.secret).plus && !me(a.secret).plus, "6 дней — Плюса ещё нет ни у кого")
ok(ref(a.secret).list[0].d === 6, "у Ани видно: Боб 6 из 7 дней", ref(a.secret).list)
const lim0 = me(a.secret).left
days(b.secret, 1)
const mb = me(b.secret), ma = me(a.secret)
ok(mb.plus && mb.plus.until > Date.now() + 29 * 864e5, "Боб: 30 дней Плюса после 7 дней", mb)
ok(ma.plus && ma.plus.until > Date.now() + 29 * 864e5, "Аня: 30 дней Плюса за Боба", ma)
ok(ma.limit === 300 && ma.left > lim0, "с Плюсом лимит Изи 300 в день", [ma.limit, ma.left, lim0])
let r = ref(a.secret)
ok(r.act === 1 && r.status === "Друг" && r.per === 5 && r.list[0].st === "act", "Аня — «Друг», приглашений 3+2, у Боба «бонус начислен»", r)
ok(r.league.top[0].me && r.league.top[0].c === 1 && r.league.place === 1, "лига месяца: Аня первая", r.league)
ok(r.bon.length === 1 && r.bon[0].d === 30 && /Боб с вами 7 дней/.test(r.bon[0].w), "история бонусов у Ани", r.bon)
days(b.secret, 3)
ok(ref(a.secret).bon.length === 1, "повторно за Боба не начисляется")
// второй уровень: Катя активна 7 дней → Боб 30, Аня 3
const pa0 = me(a.secret).plus.until, pb0 = me(b.secret).plus.until
days(c.secret, 7)
ok(me(c.secret).plus, "Катя: Плюс после 7 дней")
ok(Math.round((me(b.secret).plus.until - pb0) / 864e5) === 30, "Боб +30 дней за Катю")
ok(Math.round((me(a.secret).plus.until - pa0) / 864e5) === 3, "Аня +3 дня (второй уровень)")
ok(ref(a.secret).l2 === 1 && ref(a.secret).act === 1, "второй уровень не прибавляет Ане статус")
// третий уровень — ничего
const d = login("dan", { ref: ref(c.secret).code }); ok(d.ok, "Дэн по ссылке Кати")
const pa1 = me(a.secret).plus.until, pb1 = me(b.secret).plus.until
days(d.secret, 7)
ok(me(a.secret).plus.until === pa1 && Math.round((me(b.secret).plus.until - pb1) / 864e5) === 3, "третий уровень: Ане ничего, Бобу 3 дня (он второй уровень для Дэна)")
// партнёр: свой код, вход без одобрения, без предела
delete props.REF_AUTO
props.PARTNERS = "eve@example.com=EVA2026"
const e = login("eve"); ok(e.ok, "Ева (блогер) вошла")
r = ref(e.secret)
ok(r.code === "eva2026" && /\?r=eva2026$/.test(r.link) && r.partner && r.partner.code === "EVA2026" && r.per === 9999, "у партнёра понятный код и без предела", r)
ok(me(e.secret).plus && me(e.secret).plus.forever, "партнёру Плюс навсегда")
const f = login("fox", { ref: "EVA2026" }); ok(f.ok && f.isNew, "подписчик Евы входит сразу, без одобрения")
days(f.secret, 7)
r = ref(e.secret)
ok(r.partner.joined === 1 && r.partner.active === 1, "у Евы: 1 вошёл, 1 активен", r.partner)
ok(me(f.secret).plus && !r.bon.length, "подписчик получил Плюс, партнёру днями не начисляется (у неё навсегда)")
const book = Object.values(books).find(x => x.name === "IZIDAY — Заявки и приглашения")
ok(book.getSheetByName("Партнёры").cells.some(x => x && x[1] === "EVA2026" && x[5] === "fox@example.com"), "лист «Партнёры» для выплат")
ok(book.getSheetByName("Активные").cells.length >= 5, "лист «Активные»")
// семья: Гоша создаёт семью, Боб… нет — новый человек без Плюса присоединяется
props.REF_AUTO = "1"
const g = login("gin"); ok(g.ok, "Гоша вошёл")
const fam = post({ secret: g.secret, family: { op: "new", name: "Гоши" } })
ok(fam.ok && props["fh:" + fam.family.code], "Гоша — глава семьи")
ok(!me(g.secret).plus, "у главы пока нет Плюса")
const fx = login("fox")
// Фёдор вступил в семью (у него свой Плюс). Глава получит 7 дней, когда Фёдор будет 7 дней уже в семье
days(fx.secret, 6, fam.family.code)
ok(!me(g.secret).plus, "6 дней в семье — главе ещё ничего")
days(fx.secret, 1, fam.family.code)
ok(me(g.secret).plus && Math.round((me(g.secret).plus.until - Date.now()) / 864e5) === 7, "главе +7 дней за активного взрослого в семье", me(g.secret).plus)
days(fx.secret, 7, fam.family.code)
ok(Math.round((me(g.secret).plus.until - Date.now()) / 864e5) === 7, "за того же человека второй раз не начисляется")
// теперь у главы Плюс — член семьи без своего Плюса получает его от главы
tok("hal", "1010", "hal@example.com", "Хал")
const h = login("hal"); days(h.secret, 1, fam.family.code)
ok(me(h.secret).plus && me(h.secret).plus.fam, "член семьи пользуется Плюсом главы")
ok(me(h.secret).limit === 300, "и лимитом Изи с Плюсом")
// чужой код семьи без главы на сервере ничего не даёт
tok("ivy", "1111", "ivy@example.com", "Ива")
const iv = login("ivy"); days(iv.secret, 1, "abcdefabcdef12")
ok(!me(iv.secret).plus, "выдуманный код семьи не даёт Плюс")
// статус Амбассадор: 10 активных → Плюс навсегда
const A = JSON.parse(props["u:" + me(a.secret).id]); A.act = 9; props["u:" + A.id] = JSON.stringify(A)
tok("jo", "1212", "jo@example.com", "Жора")
const j = login("jo", { ref: ra.code }); days(j.secret, 7)
r = ref(a.secret)
ok(r.status === "Амбассадор" && r.plus.forever && r.early && r.per === 23 && !r.next, "10 активных: Амбассадор, Плюс навсегда, ранний доступ, 3+20 приглашений", r)
// призы лиги прошлого месяца — один раз
const pm = (() => { const x = new Date(); x.setDate(1); x.setDate(0); return S.tzFmt(x, "Asia/Bangkok", "yyyy-MM") })()
delete props["lw:" + pm]
const bid = me(b.secret).id, cid = me(c.secret).id
props["lm:" + pm] = JSON.stringify({ [bid]: 5, [cid]: 2 })
const pb2 = me(b.secret).plus.until, pc2 = me(c.secret).plus.until
ref(b.secret)
ok(Math.round((me(b.secret).plus.until - pb2) / 864e5) === 30 && Math.round((me(c.secret).plus.until - pc2) / 864e5) === 14, "призы лиги: 1-е место +30, 2-е +14")
ref(b.secret)
ok(Math.round((me(b.secret).plus.until - pb2) / 864e5) === 30, "призы выдаются один раз")
// выключатели
props.GROW_OFF = "1"
tok("kim", "1313", "kim@example.com", "Ким")
const k = login("kim", { ref: rb.code }); days(k.secret, 7)
ok(!me(k.secret).plus, "GROW_OFF=1: ничего не начисляется")
delete props.GROW_OFF; props.GROW_INVITEE = "0"
tok("lu", "1414", "lu@example.com", "Лу")
const pb3 = me(b.secret).plus.until
const l = login("lu", { ref: rb.code }); days(l.secret, 7)
ok(!me(l.secret).plus && me(b.secret).plus.until > pb3 && ref(b.secret).invitee === 0, "GROW_INVITEE=0: приглашённому не даём, пригласившему даём")
delete props.GROW_INVITEE
// удаление аккаунта не ломает пригласившего
ok(post({ secret: l.secret, deleteMe: "delete" }).deleted && ref(b.secret).ok, "удаление приглашённого не ломает пригласившего")
console.log(fails ? "GROW_REF_FAIL" : "GROW_REF_OK")
