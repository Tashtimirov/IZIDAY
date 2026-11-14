// IZIDAY · Семья и детский режим. Одно приложение: взрослый видит «Планы → Семья», ребёнок 8–13 лет — яркий детский режим
// (Мой день, Учёба, Изи, Копилки, Мечты), подросток 14–17 — обычное приложение в семье без права проверять других.
// Семья живёт в Google Таблице того, кто её создал (Code.gs family_), остальные ходят туда по коду семьи — как лига в gami.js.
// Файл подключается ДО app.js (ловит ссылку-приглашение #fam=…), а работает после него: по DOMContentLoaded дополняет
// render, renderPlans и todayTop. Семейные баллы = баллы взрослых из gami.js + звёзды детей ×2. Выбор «Взрослый/Ребёнок»
// при первом запуске делает тур новичка (onb.js): D.who и событие "izi:who"; вход ребёнка по ссылке — window.famJoin().
(function () {
"use strict"
let pendingFam = null
const grab = h => { const m = decodeURIComponent(h || "").match(/fam=([A-Za-z0-9+/=_-]+)/); if (m) pendingFam = m[1] }
grab(location.hash)
window.addEventListener("hashchange", () => { grab(location.hash); if (pendingFam && window.FAM) setTimeout(() => window.FAM.join(), 60) })
document.addEventListener("DOMContentLoaded", () => { try { init() } catch (e) { console.error("family", e) } })

// ───────────── Правила ─────────────
const KID_X = 2                 // звёзды ребёнка в семейном счёте
const LESSON_STARS = 15
const SPLIT = [50, 40, 10]      // Трачу · Коплю · Делюсь
const JARS = [["spend", "Трачу", "bag", "#FF8A3D", "на мелочи сейчас"], ["save", "Коплю", "bike", "#18B57A", "на мечту"], ["share", "Делюсь", "gift", "#FF5FA2", "подарки, помощь"]]
const COLORS = ["#0A9F6E", "#FF6FA8", "#6A4BF2", "#FFB547", "#2FB7FF", "#FF8A3D", "#18B57A", "#AF52DE"]
const roleOf = age => age >= 18 ? "adult" : age >= 14 ? "teen" : "kid"
const ROLE_T = { adult: "взрослый", teen: "подросток", kid: "детский режим" }

// ───────────── Иконки ─────────────
const P = {
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>', coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7M3 11v4c0 1.7 2.7 3 6 3 1 0 2-.1 2.8-.4"/><ellipse cx="17" cy="15" rx="4.5" ry="2.3"/><path d="M12.5 15v3c0 1.3 2 2.3 4.5 2.3s4.5-1 4.5-2.3v-3"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', play: '<path d="M7 4.5v15l12-7.5z"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  chev: '<path d="M9.5 5.5l6.5 6.5-6.5 6.5"/>', bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', gift: '<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M3 9h18v3H3zM12 9v11M12 9c-1.5-3-5-4-5-1.5S10 9 12 9zM12 9c1.5-3 5-4 5-1.5S14 9 12 9z"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l2 7h-6M14 6h3"/>', tooth: '<path d="M7 3c-2 0-3.5 1.6-3.5 4 0 3 1.5 4.5 2 8 .4 3 1 6 2.5 6s1.5-5 4-5 2.5 5 4 5 2.1-3 2.5-6c.5-3.5 2-5 2-8 0-2.4-1.5-4-3.5-4-2 0-3 1-5 1s-3-1-5-1z"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M19 19v2H6"/>', paw: '<circle cx="7" cy="9" r="1.8"/><circle cx="12" cy="6.5" r="1.8"/><circle cx="17" cy="9" r="1.8"/><path d="M8 16.5c0-2.5 2-4.5 4-4.5s4 2 4 4.5c0 1.8-1.5 2.5-4 2.5s-4-.7-4-2.5z"/>',
  plant: '<path d="M12 21v-9M12 12c0-4 3-7 8-7 0 5-3 7-8 7zM12 15c0-3-2.5-5-7-5 0 4 2.5 5 7 5z"/>', bed: '<path d="M3 18V8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/><path d="M12 3v4M21 11l-5-1M17 20l-2.5-5.5M7 20l2.5-5.5M3 11l5-1"/>', dish: '<path d="M3 13h18a9 9 0 0 1-18 0z"/><path d="M12 4v4M8 6l1 2M16 6l-1 2"/>',
  shirt: '<path d="M8.5 3.5L3.5 6.5l2 4 2-1v11h9v-11l2 1 2-4-5-3c-.6 1.5-1.9 2.5-3.5 2.5S9.1 5 8.5 3.5z"/>', music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>', bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14a5 5 0 0 1 5.5 5"/>',
  wave: '<path d="M2 12c2.5-4 5-4 7.5 0s5 4 7.5 0 4-3 5-2"/>', plane: '<path d="M21 4L3 11l7 2.5L12.5 21z"/><path d="M10 13.5L21 4"/>', film: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18M3 15h18M8 5v14M16 5v14"/>',
  pizza: '<path d="M12 21L3 6a14 14 0 0 1 18 0z"/><circle cx="10" cy="9" r="1"/><circle cx="14" cy="12" r="1"/>', tent: '<path d="M3 20L12 4l9 16zM12 4v16M9 20l3-6 3 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6h14v-6"/>', briefcase: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5h6v2M3 12h18"/>',
  wand: '<path d="M4 20L15 9M14 4v3M19 9h-3M17.5 5.5l-2 2M12 3l.5 1.5M20 11l1.5.5"/>', out: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>', stopsq: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3.5"/>', link: '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/>',
}
const ic = (n, s = 20, c = "currentColor", sw = 2) => `<svg class="fi" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${P[n] || P.star}</svg>`
const TASK_IC = [["tooth", "#2FB7FF"], ["bag", "#FF8A3D"], ["book", "#8B6CFF"], ["paw", "#18B57A"], ["home", "#FF5FA2"], ["bed", "#6A4BF2"], ["dish", "#FFB547"], ["plant", "#18B57A"], ["shirt", "#2FB7FF"], ["ball", "#FF8A3D"], ["music", "#AF52DE"], ["star", "#E89A00"]]
const taskIc = t => { const s = String(t || "").toLowerCase()
  return /зуб/.test(s) ? "tooth" : /велосипед|самокат|ролик/.test(s) ? "bike" : /собак|щен|кот[её]н/.test(s) ? "paw" : /лего|игр/.test(s) && !/игрушк/.test(s) ? "gift" : /рюкзак|портфел|сумк/.test(s) ? "bag" : /чита|книг|урок|домашн/.test(s) ? "book" : /кот|собак|корм|пит[оа]м|хомяк|рыб/.test(s) ? "paw" : /игрушк|убра|комнат|порядок/.test(s) ? "home"
    : /кроват|спать|постел/.test(s) ? "bed" : /посуд|стол|ужин|обед/.test(s) ? "dish" : /цвет|сад|полить/.test(s) ? "plant" : /одеж|форм|носк/.test(s) ? "shirt" : /футбол|спорт|трениров|бассейн|плава/.test(s) ? "ball" : /музык|пиани|гитар/.test(s) ? "music" : "star" }
const icColor = n => (TASK_IC.find(x => x[0] === n) || [0, "#8B6CFF"])[1]
const GOAL_IC = [["wave", "#2FB7FF", /аквапарк|бассейн|мор|пляж/i], ["plane", "#0A9F6E", /поезд|путеш|самол|отпуск|чианг|бангкок/i], ["film", "#FF6FA8", /кино|фильм|мульт/i], ["pizza", "#FF8A3D", /пицц|кафе|ресторан|бургер|мороже/i], ["tent", "#18B57A", /поход|палат|природ|пикник|парк/i], ["gift", "#AF52DE", /.*/]]
const goalIc = t => GOAL_IC.find(x => x[2].test(t || ""))

// ───────────── Данные ─────────────
// D.fam = { url, code, id, role, name, fname, owner, data, at, out{list:[items]}, seen{}, err }
const famOn = () => !!(D.fam && D.fam.code && D.fam.url)
const F = () => (D.fam && D.fam.data) || { members: {}, set: {}, tasks: [], log: [], goals: [], money: [], dreams: [], events: [] }
const L = k => (F()[k] || []).filter(x => x && !x.del)
const meId = () => D.fam && D.fam.id
const kidMode = () => (famOn() && D.fam.role === "kid") || (!famOn() && D.who === "kid")
const isAdult = () => famOn() && D.fam.role === "adult"
// Что делим с семьёй: каждый решает за себя, по умолчанию всё выключено. D.fam.share = { cal, money }
const SHARE = [["cal", "Календарь семьи", "Общие дела семьи, расписание детей и календари близких — каждый своим цветом."],
  ["money", "Общий бюджет", "Можно отмечать траты и копилки как общие и смотреть их отдельно. Остальные траты остаются только вашими."]]
const share = k => famOn() && D.fam.role !== "kid" && !!(D.fam.share || {})[k]
function shareSet(k, on) { D.fam.share = Object.assign({}, D.fam.share, { [k]: on ? 1 : 0 }); save(false) }
const shareRows = () => SHARE.map(([k, t, sub]) => `<button class="set tg-row" data-fsh="${k}"><span><b>${t}</b><small>${sub}</small></span><i class="tgl ${share(k) ? "on" : ""}" role="switch" aria-checked="${share(k)}"></i></button>`).join("")
function shareBind(el) {
  $$("[data-fsh]", el).forEach(b => b.onclick = () => { const k = b.dataset.fsh, on = !share(k); shareSet(k, on); const i = $(".tgl", b); i.classList.toggle("on", on); i.setAttribute("aria-checked", on) })
}
// один раз после входа в семью; потом — в «Семье» и в «Деньги → Семья»
function shareSheet(first) {
  if (!famOn() || D.fam.role === "kid") return
  D.fam.shareAsked = 1; save(false)
  const s = sheet(`<h3>Что делим с семьёй</h3><div class="msg">${first === "old" ? "Теперь вы сами решаете, что делить с семьёй. Календарь семьи остался включённым, как был. Каждый в семье решает только за себя." : (first ? "Вы в семье. " : "") + "Всё выключено, пока вы сами не включите. Каждый в семье решает только за себя."}</div>
    <div class="fshare">${shareRows()}</div>
    <div class="btns"><button class="btn primary" data-a="ok">Готово</button></div>`, { onClose: () => render() })
  shareBind(s.el)
  $('[data-a="ok"]', s.el).onclick = () => s.close()
}
const members = () => Object.entries(F().members || {}).map(([id, m]) => Object.assign({ id }, m)).sort((a, b) => (a.role === "adult" ? 0 : 1) - (b.role === "adult" ? 0 : 1) || (a.joined || 0) - (b.joined || 0))
const kids = () => members().filter(m => m.role === "kid")
const member = id => members().find(m => m.id === id)
const today = () => dayKey(new Date())
const wd = d => ((d || new Date()).getDay() + 6) % 7 + 1     // пн = 1 … вс = 7
const short = n => String(n || "").split(" ")[0]

let ver = 0
function put(list, item) {
  item.u = Date.now()
  const f = D.fam.data || (D.fam.data = F()), arr = f[list] || (f[list] = [])
  const i = arr.findIndex(x => x.id === item.id)
  if (i < 0) arr.push(item); else arr[i] = item
  const out = D.fam.out || (D.fam.out = {}), q = out[list] || (out[list] = [])
  const j = q.findIndex(x => x.id === item.id); if (j < 0) q.push(item); else q[j] = item
  ver++; save(false); flushSoon()
  return item
}
let flushT = null
const flushSoon = () => { clearTimeout(flushT); flushT = setTimeout(() => push(true), 700) }
// Запрос к таблице семьи. Safari на iPhone иногда рвёт первый запрос («Load failed»), а таблица
// бывает занята синхронизацией (скрипт отвечает страницей ошибки, а не данными) — пробуем до 3 раз
async function post(url, q, secret) {
  let last = "нет связи"
  for (let i = 0; i < 3; i++) {
    if (i) await new Promise(r => setTimeout(r, 1500 * i))
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 60000)
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, credentials: "omit", cache: "no-store", signal: ctl.signal,
        body: JSON.stringify(Object.assign(secret ? { secret } : {}, { family: q })) })
      const txt = await r.text()
      try { return JSON.parse(txt) } catch (e) { last = r.ok ? "таблица занята" : "таблица ответила ошибкой " + r.status }
    } catch (e) { last = e && e.name === "AbortError" ? "таблица долго не отвечает" : "нет связи" } finally { clearTimeout(t) }
  }
  return { ok: false, error: last, net: true }
}
// Баллы взрослого из игры (gami.js) по дням за 40 дней — для семейного счёта
function myPts() {
  if (!window.GAMI || D.fam.role === "kid") return null
  try { const out = {}, lim = +addDays(sod(new Date()), -40); for (const x of GAMI.stats().days) if (+x.d >= lim && x.total) out[x.k] = x.total; return out } catch (e) { return null }
}
let busy = false, again = false
async function push(force, extra) {
  if (!famOn()) return
  if (busy) { again = true; return }
  if (!force && Date.now() - (D.fam.at || 0) < 60e3) return
  busy = true
  try {
    const out = D.fam.out || {}, sent = {}
    const q = Object.assign({ op: "put", code: D.fam.code, id: D.fam.id, me: { name: D.fam.name, role: D.fam.role } }, extra || {})
    const pts = myPts(); if (pts) q.me.pts = pts
    if (D.fam.me) Object.assign(q.me, D.fam.me)
    for (const k in out) if (out[k] && out[k].length) { q[k] = out[k].slice(); sent[k] = new Set(q[k].map(x => x.id + ":" + x.u)) }
    const r = await post(D.fam.url, q)
    if (r && r.ok && r.family) {
      const f = r.family
      // события семьи: пока таблица семьи их не хранит (старая версия скрипта), держим у себя и шлём снова
      for (const k in sent) if (k !== "events" || Array.isArray(f.events)) D.fam.out[k] = (D.fam.out[k] || []).filter(x => !sent[k].has(x.id + ":" + x.u))
      for (const k in D.fam.out) for (const x of D.fam.out[k] || []) { const arr = f[k] || (f[k] = []), i = arr.findIndex(y => y.id === x.id); if (i < 0) arr.push(x); else if ((arr[i].u || 0) <= x.u) arr[i] = x }
      D.fam.data = f; D.fam.at = Date.now(); D.fam.err = ""; D.fam.fname = f.name; if (r.key != null) D.fam.key = !!r.key
      const m = f.members[D.fam.id]; if (m && D.fam.role !== m.role && !D.fam.me) D.fam.role = m.role
      delete D.fam.me
      ver++; save(false); after()
      if (!stack.length && (kidMode() || tab === "plans" || tab === "today")) render()
    } else if (r) { D.fam.err = r.error || "семья не ответила"; save(false) }
  } finally { busy = false; if (again) { again = false; setTimeout(() => push(true), 50) } }
}
// После обмена: карманные по расписанию, достигнутые семейные цели, праздник
function after() {
  try { pocketTick() } catch (e) {}
  try { goalsTick() } catch (e) {}
}

// ───────────── Счёт ─────────────
// Баллы семьи по дням: взрослые — из своих приложений (pts), дети — звёзды ×2 из журнала
function famDays() {
  const days = {}, add = (k, id, n) => { if (!n) return; const d = days[k] || (days[k] = {}); d[id] = (d[id] || 0) + n }
  const ms = F().members || {}
  for (const id in ms) if (ms[id].role !== "kid") for (const k in ms[id].pts || {}) add(k, id, ms[id].pts[k])
  for (const x of L("log")) if (x.st === "ok" && x.stars && ms[x.kid]) add(x.day, x.kid, x.stars * KID_X)
  return days
}
function sumSince(from, to) {
  const days = famDays(), by = {}
  let total = 0
  for (const k in days) if (k >= from && (!to || k <= to)) for (const id in days[k]) { by[id] = (by[id] || 0) + days[k][id]; total += days[k][id] }
  return { total, by }
}
const monthStartK = () => { const d = new Date(); return dayKey(new Date(d.getFullYear(), d.getMonth(), 1)) }
function kidStars(kid, from) { return L("log").filter(x => x.kid === kid && x.st === "ok" && (!from || x.day >= from)).reduce((s, x) => s + (x.stars || 0), 0) }
function goalProg(g) {
  const s = sumSince(g.start || "0000").total, t = Math.max(1, +g.target || 1)
  if (g.repeat) return { have: s % t, need: t, times: Math.floor(s / t), p: (s % t) / t }
  return { have: Math.min(s, t), need: t, times: s >= t ? 1 : 0, p: Math.min(1, s / t) }
}
const famGoals = () => L("goals").sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || goalProg(b).p - goalProg(a).p)
function goalsTick() {
  const seen = D.fam.seen || (D.fam.seen = {})
  for (const g of famGoals()) {
    const p = goalProg(g), key = g.id + ":" + p.times
    if (!p.times) continue
    if (!g.repeat && !g.done) put("goals", Object.assign({}, g, { done: true, doneAt: Date.now() }))
    if (!seen[key]) { seen[key] = Date.now(); save(false); if (Date.now() - (g.date || 0) > 1000) setTimeout(() => party(g, p), 400); break }
  }
}

// ───────────── Дела ребёнка ─────────────
const kidTasks = kid => L("tasks").filter(t => t.kid === kid && !t.pay)
const kidEarn = kid => L("tasks").filter(t => t.kid === kid && t.pay)
const tasksOn = (kid, d) => { const w = wd(d), day = dayKey(d), l = kidTasks(kid).filter(t => !t.days || !t.days.length || t.days.includes(w))
  return { n: l.length, done: l.filter(t => { const x = logOf(kid, t.id, day); return x && x.st === "ok" }).length } }
// Расписание ребёнка и общие дела семьи на день (список events: разовые {day} и по дням недели {days}; who — "fam" или id)
const evOn = (id, d) => L("events").filter(x => x.title && (x.who === "fam" || x.who === id) && (x.day ? x.day === dayKey(d) : (x.days || []).map(Number).includes(wd(d))))
  .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")))
const todayTasks = kid => kidTasks(kid).filter(t => !t.days || !t.days.length || t.days.includes(wd()))
const logOf = (kid, task, day) => L("log").find(x => x.kid === kid && x.task === task && x.day === (day || today()))
function tick(task) {
  const k = today(), id = `t:${task.id}:${k}`, old = (F().log || []).find(x => x.id === id)
  if (old && !old.del) { if (old.st === "ok" && task.check) return toast("Уже проверено"); put("log", Object.assign({}, old, { del: true })); return }
  put("log", { id, kid: task.kid, task: task.id, title: task.title, day: k, at: Date.now(), kind: task.pay ? "earn" : "task", st: task.check || task.pay ? "wait" : "ok", stars: task.pay ? 0 : +task.stars || 5, pay: +task.pay || 0 })
  if (!task.check && !task.pay) { burst(); toast(`+${task.stars || 5} звёзд`) } else toast(task.pay ? "Ждёт, когда взрослый подтвердит" : "Ждёт проверки")
}
const waits = () => {
  const out = []
  for (const x of L("log")) if (x.st === "wait" && member(x.kid)) out.push({ t: "log", x })
  for (const x of L("money")) if (x.st === "wait" && member(x.kid)) out.push({ t: "money", x })
  return out.sort((a, b) => (a.x.at || 0) - (b.x.at || 0))
}
function approve(w, yes) {
  if (w.t === "log" && w.x.kind === "prop") {   // просьба ребёнка изменить дело или расписание: «Да» вносит правку
    const t = L(w.x.list).find(z => z.id === w.x.ref)
    if (yes && t) put(w.x.list, Object.assign({}, t, w.x.patch || {}))
    put("log", Object.assign({}, w.x, { st: yes ? "ok" : "no", by: meId() }))
    toast(yes ? (t ? "Изменено — ребёнок увидит ответ" : "Этого дела уже нет") : "Оставили как было — ребёнок увидит ответ")
  } else if (w.t === "log") {
    put("log", Object.assign({}, w.x, { st: yes ? "ok" : "no", by: meId() }))
    if (yes && w.x.pay) credit(w.x.kid, w.x.pay, "earn", w.x.title, "er:" + w.x.id)
  } else put("money", Object.assign({}, w.x, { st: yes ? "ok" : "no", by: meId() }))
  render()
}

// ───────────── Копилки ─────────────
const kset = kid => Object.assign({ pocket: 0, wd: 5, split: SPLIT, limit: 200 }, (F().set || {})[kid] || {})
// Валюта ребёнка — выбирает взрослый в «Деньги ребёнка» (set[kid].cur); без выбора — валюта этого телефона
const kcur = kid => { const c = kid && kset(kid).cur; return (c && typeof CUR !== "undefined" && CUR[c]) || core.CONFIG.currency || "฿" }
function jars(kid) {
  const j = { spend: 0, save: 0, share: 0 }
  for (const m of L("money")) if (m.kid === kid && m.st === "ok" && j[m.jar] != null) j[m.jar] += +m.amount || 0
  return j
}
function credit(kid, amount, kind, note, idp) {
  const sp = kset(kid).split, parts = [Math.round(amount * sp[0] / 100), Math.round(amount * sp[1] / 100)]
  parts.push(amount - parts[0] - parts[1])
  JARS.forEach(([jar], i) => { if (parts[i]) put("money", { id: `${idp}:${jar}`, kid, at: Date.now(), amount: parts[i], jar, kind, note, st: "ok" }) })
}
// Карманные: в выбранный день недели, начиная с дня настройки; id от даты — не задвоится с разных телефонов
function pocketTick() {
  if (!famOn()) return
  for (const k of kids()) {
    const s = kset(k.id)
    if (!(s.pocket > 0) || !s.since) continue
    const have = new Set((F().money || []).map(x => x.id))
    for (let d = new Date(Math.max(+parseIso(s.since), +addDays(sod(new Date()), -35))); d <= new Date(); d = addDays(d, 1))
      if (wd(d) === +s.wd && !have.has(`pk:${k.id}:${dayKey(d)}:spend`)) credit(k.id, +s.pocket, "pocket", "Карманные", `pk:${k.id}:${dayKey(d)}`)
  }
}
const nextPocket = kid => { const s = kset(kid); if (!(s.pocket > 0)) return null; for (let i = 0; i < 8; i++) { const d = addDays(sod(new Date()), i); if (wd(d) === +s.wd) return i } return null }

// ───────────── Мечты ─────────────
const kidDreams = kid => L("dreams").filter(d => d.kid === kid).sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0) || (b.at || 0) - (a.at || 0))
const mainDream = kid => kidDreams(kid).find(d => d.main && !d.done)
const DREAM_STEPS = ["Узнать, сколько стоит", "Откладывать в «Коплю» с каждых карманных", "Заработать на делах", "Посоветоваться с мамой или папой"]

// ───────────── Школа Изи: уроки ─────────────
// шаг: { say } — Изи говорит; { q, a:[варианты], ok, why } — вопрос; { split } — разложить монетки по копилкам
const COURSES = [["goals", "Цели", "#18B57A", "target"], ["wish", "Желания", "#FF5FA2", "heart"], ["money", "Деньги", "#8B6CFF", "coins"]]
const LESSONS = [
  { id: "g1", c: "goals", t: "Что такое цель", ic: "target", steps: [
    { say: "Цель — это желание, у которого есть план и срок. «Хочу велосипед» — желание. «Накоплю на велосипед к лету» — уже цель!" },
    { q: "Что из этого цель?", a: ["Хочу быть сильным", "Каждый день 10 отжиманий до конца месяца", "Было бы здорово поехать на море"], ok: 1, why: "Тут есть что делать и до какого срока. Это и делает желание целью." },
    { say: "У хорошей цели три вещи: что именно, сколько и к какому дню. Попробуй придумать свою!" }] },
  { id: "g2", c: "goals", t: "Большая мечта — маленькие шаги", ic: "map", steps: [
    { say: "Большую мечту страшно начинать. Поэтому её режут на шаги, как пиццу на кусочки." },
    { q: "Мечта: научиться плавать. Какой первый шаг самый удачный?", a: ["Сразу переплыть реку", "Записаться в бассейн и сходить первый раз", "Подождать, пока само получится"], ok: 1, why: "Маленький шаг, который можно сделать уже на этой неделе." },
    { say: "Каждый сделанный шаг — повод порадоваться. В «Мечтах» у каждой цели есть свои шаги." }] },
  { id: "g3", c: "goals", t: "Если не получилось", ic: "sun", steps: [
    { say: "Иногда шаг не получается. Это нормально, даже у взрослых! Главное — не бросать, а немножко изменить план." },
    { q: "Ты хотел читать 20 минут, но не успел. Что лучше?", a: ["Бросить чтение совсем", "Завтра почитать 10 минут, но обязательно", "Сказать, что книга скучная"], ok: 1, why: "Чуть меньше, но каждый день — так цели и достигаются." }] },
  { id: "g4", c: "goals", t: "Цель на месяц", ic: "target", age: 11, steps: [
    { say: "Месяц — удобный срок: достаточно долго, чтобы успеть, и достаточно коротко, чтобы не забыть." },
    { q: "Какая цель на месяц лучше?", a: ["Стать отличником", "Получить по математике не ниже четвёрки за 4 контрольные", "Больше заниматься"], ok: 1, why: "Её можно проверить: понятно, что именно, сколько и когда." },
    { say: "Запиши свою цель на месяц в «Мечтах» и раздели на шаги по неделям." }] },
  { id: "w1", c: "wish", t: "Желание или нужно?", ic: "heart", steps: [
    { say: "«Нужно» — без этого никак: еда, одежда, учебники. «Хочу» — то, что приятно, но можно и без него." },
    { q: "Зимние ботинки, когда старые малы, — это…", a: ["Нужно", "Хочу"], ok: 0, why: "Без них холодно, значит, это нужно." },
    { q: "Пятая машинка в коллекцию — это…", a: ["Нужно", "Хочу"], ok: 1, why: "Приятно, но можно и без неё. Хотеть — это нормально, просто важно отличать." }] },
  { id: "w2", c: "wish", t: "Банка желаний", ic: "gift", steps: [
    { say: "Записывай в банку желаний всё, чего хочется: большое и маленькое. Записанное желание не забудется." },
    { say: "Раз в неделю я спрошу, какое желание ты хочешь сделать целью. Тогда мы вместе придумаем шаги." },
    { q: "Где хранить желания, чтобы не забыть?", a: ["В голове", "В банке желаний в «Мечтах»"], ok: 1, why: "Голова для идей, а записанное не теряется." }] },
  { id: "w3", c: "wish", t: "Подождать — и выбрать лучшее", ic: "clock", steps: [
    { say: "Есть хитрость: захотел что-то купить — подожди 3 дня. Если хочется так же сильно, значит, правда нужно." },
    { q: "Ты увидел новую игрушку и очень хочешь. Что сделать?", a: ["Сразу потратить все деньги", "Записать в банку желаний и подождать 3 дня"], ok: 1, why: "Часто через 3 дня хочется уже другого, а деньги остались целы." }] },
  { id: "w4", c: "wish", t: "Желания других", ic: "users", age: 11, steps: [
    { say: "У мамы, папы, брата или сестры тоже есть мечты. Узнать их и помочь — очень круто." },
    { q: "Как узнать, о чём мечтает мама?", a: ["Угадать", "Спросить и записать", "Ничего не делать"], ok: 1, why: "Спроси, и тогда подарок попадёт точно в цель." }] },
  { id: "m1", c: "money", t: "Откуда берутся деньги", ic: "briefcase", steps: [
    { say: "Деньги появляются, когда люди делают полезную работу: лечат, учат, строят, продают дома." },
    { q: "Как ты сам можешь заработать?", a: ["Найти на дороге", "Сделать полезное дело, о котором договорились с родителями", "Попросить ещё"], ok: 1, why: "В «Копилках» есть «Заработать»: полезные дела за деньги." }] },
  { id: "m2", c: "money", t: "Три копилки", ic: "coins", steps: [
    { say: "Умные люди не тратят всё сразу. Деньги раскладывают в три копилки: Трачу, Коплю и Делюсь." },
    { split: true, say: "Бабушка подарила тебе 100 монет. Разложи их по копилкам — нажимай на копилки!" },
    { say: "Твои карманные сами раскладываются так, как договорились с родителями." }] },
  { id: "m3", c: "money", t: "Копить выгодно", ic: "bike", steps: [
    { say: "Велосипед стоит 4 500. Если откладывать по 500 в неделю, сколько недель ждать?" },
    { q: "Сколько недель?", a: ["5 недель", "9 недель", "20 недель"], ok: 1, why: "4 500 ÷ 500 = 9. Чем больше откладываешь, тем быстрее мечта." },
    { say: "В «Мечтах» видно, сколько уже накоплено и сколько осталось." }] },
  { id: "m4", c: "money", t: "Делиться — тоже цель", ic: "gift", steps: [
    { say: "Копилка «Делюсь» — на подарки близким и помощь тем, кому трудно. Отдавать приятно!" },
    { q: "На что можно потратить «Делюсь»?", a: ["Подарок маме на день рождения", "Корм для приюта животных", "И то, и другое"], ok: 2, why: "Подарок и помощь — это и есть «Делюсь»." }] },
  { id: "m5", c: "money", t: "Проценты и бюджет", ic: "target", age: 11, steps: [
    { say: "Бюджет — это план: сколько придёт денег и куда они пойдут. Взрослые делают так каждый месяц." },
    { q: "Карманные — 500 в неделю, 40% в «Коплю». Сколько это?", a: ["40", "200", "400"], ok: 1, why: "500 × 40 ÷ 100 = 200." },
    { say: "Если положить деньги в банк, банк доплачивает проценты. Подробнее спроси у родителей — это интересная тема!" }] },
]
const lessonsFor = kid => { const age = (member(kid) || {}).age || 10; return LESSONS.filter(l => !l.age || age >= l.age) }
const lessonDone = (kid, id) => L("log").some(x => x.kid === kid && x.kind === "lesson" && x.task === id && x.st === "ok")
function nextLesson(kid, c) { return lessonsFor(kid).find(l => (!c || l.c === c) && !lessonDone(kid, l.id)) }

// ═════════════ Детский режим ═════════════
let kTab = "day", kCourse = "goals"
const star = (n, cls = "") => `<span class="kstar ${cls}">${ic("star", 16, "#E89A00", 2.4)}${n}</span>`
const orb = (s = 56) => `<b class="orb kidorb" style="width:${s}px;height:${s}px"></b>`
function kidRender() {
  if (famOn() && meId() && kset(meId()).cur && typeof CUR !== "undefined" && CUR[kset(meId()).cur]) core.CONFIG.currency = CUR[kset(meId()).cur]
  if (!famOn()) return kidNoFam()
  const me = member(meId()) || { name: D.fam.name || "Друг", age: 10 }
  const body = { day: kDay, learn: kLearn, money: kMoney, dreams: kDreams }[kTab](me)
  return `<div class="kd">${body}</div>`
}
function kHead(sub, title, right) { return `<div class="khd"><div class="grow"><div class="ks">${esc(sub)}</div><h1>${esc(title)}</h1></div>${right || ""}</div>` }
function kidNoFam() {
  return `<div class="kd"><div class="kempty">${orb(110)}<h1>Привет!</h1><p>Попроси маму или папу показать тебе шар Изи. Он у них в «Планы → Семья».</p>
  <button class="kbtn" data-k="scan">Сканировать шар</button><button class="klink" data-k="paste">У меня есть ссылка</button><button class="klink" data-k="adult">Я взрослый</button></div></div>`
}
function kDay(me) {
  const d = new Date(), tasks = todayTasks(me.id), done = tasks.filter(t => { const l = logOf(me.id, t.id); return l && l.st !== "no" }).length
  const g = famGoals().find(x => !x.done), les = nextLesson(me.id)
  let h = kHead(`${core.cap(WDF[d.getDay()])}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`, `Привет, ${short(me.name)}!`, `<div class="kmy">${star(num(kidStars(me.id)))}<span>мои звёзды</span></div>`)
  h += `<div class="ksay">${orb(64)}<div class="kbub">${esc(kidTip(me, tasks, done))}</div></div>`
  h += `<div class="kcard"><h2>Мои дела <span>${done} из ${tasks.length}</span></h2>${tasks.map(t => kTask(me, t)).join("") || `<div class="kmuted">Сегодня дел нет. Попроси маму или папу добавить их в приложении.</div>`}</div>`
  const sch = evOn(me.id, d)
  h += propNews(me.id)
  h += `<div class="kcard ksch"><h2>Расписание <button class="kadd" data-k="evnew">${ic("plus", 16, "#6A4BF2", 2.6)}Своё</button></h2>${sch.map(x => `<div class="krow" data-kev="${esc(x.id)}"><div class="ktm">${esc(x.time || "днём")}</div><div class="grow"><b>${esc(x.title)}</b>${x.who === "fam" || x.take || x.place ? `<div class="kmuted">${[x.who === "fam" && "вся семья", x.place, x.take && "взять: " + x.take].filter(Boolean).map(esc).join(" · ")}</div>` : ""}</div>${propWait(x.id) ? `<span class="kwait">${ic("clock", 13, "#C98500")}ждёт ответа</span>` : ""}<i style="background:${x.who === "fam" ? layerC("fam") : kidC(me.id)}"></i>${ic("chev", 18, "#A19BC7")}</div>`).join("") || `<div class="kmuted">На сегодня ничего нет. Можно добавить своё дело: кружок, встречу с другом.</div>`}</div>`
  if (g) { const p = goalProg(g), gi = goalIc(g.title), mine = sumSince(g.start || "0000").by[me.id] || 0
    h += `<div class="kcard kgoal"><h2>Семейная цель</h2><div class="krow"><div class="kgi">${ic(g.ic || gi[0], 30, gi[1])}</div><div class="grow"><b>${esc(g.title)}</b><div class="kmuted">${num(p.have)} из ${num(p.need)}${mine ? ` · ты принёс ${num(mine)}` : ""}</div></div></div><div class="kbar"><i style="width:${Math.round(p.p * 100)}%"></i></div></div>` }
  if (les) h += `<button class="kcard krow kles" data-kles="${les.id}"><div class="kplay">${ic("play", 24, "#fff")}</div><div class="grow"><b>Урок дня: «${esc(les.t)}»</b><div class="kmuted">3 минуты · +${LESSON_STARS} звёзд</div></div>${ic("chev", 22, "#A19BC7")}</button>`
  h += `<button class="klink kout" data-k="out">${ic("out", 18)}Выйти из IZIDAY</button>`
  return h
}
function kidTip(me, tasks, done) {
  const left = tasks.length - done, h = new Date().getHours()
  if (!tasks.length) return "Сегодня свободный день! Можно пройти урок и получить звёзды."
  if (!left) return "Все дела сделаны! Ты молодец. Звёзды уже идут в семейную цель."
  const t = tasks.find(t => !logOf(me.id, t.id))
  return `${h < 12 ? "Доброе утро!" : h < 18 ? "Привет!" : "Добрый вечер!"} Осталось ${left} ${plural(left, "дело", "дела", "дел")}${t ? `. Начнём с «${t.title}»?` : "."}`
}
function kTask(me, t) {
  const l = logOf(me.id, t.id), st = l ? l.st : "", n = t.ic || taskIc(t.title), c = icColor(n)
  return `<div class="ktw"><button class="ktask ${st === "ok" ? "done" : ""}" data-ktask="${esc(t.id)}"><div class="kic" style="background:${c}22">${ic(n, 24, c)}</div>
  <div class="grow"><div class="kt">${esc(t.title)}</div><div class="km">${st === "wait" ? "ждёт проверки" : st === "no" ? "не засчитано — попробуй ещё" : esc(t.when || (t.check ? "проверит взрослый" : ""))}</div></div>
  <span class="kplus">${ic("star", 15, "#E89A00", 2.4)}+${t.stars || 5}</span><span class="kcb ${st}">${st === "ok" ? ic("check", 18, "#fff", 3) : st === "wait" ? ic("clock", 16, "#C98500") : ""}</span></button><button class="kmore" data-kti="${esc(t.id)}" aria-label="Подробнее">${ic("chev", 20, propWait(t.id) ? "#C98500" : "#A19BC7")}</button></div>`
}

// ───────────── Ребёнок: открыть дело или расписание, своё — править, добавленное взрослыми — попросить изменить ─────────────
// Просьба — запись в log: { id "pr…", kind "prop", kid, list "events"|"tasks", ref, patch, why, title, st "wait" → "ok"|"no", by }.
// Взрослый видит её в «Ждут вашей проверки» (и плашкой на «Сегодня»); «Да» вносит правку, «Нет» оставляет как было.
const PROP_F = { title: "название", day: "день", time: "время", place: "место", when: "когда" }
const propsOf = ref => L("log").filter(x => x.kind === "prop" && x.ref === ref)
const propWait = ref => propsOf(ref).find(x => x.st === "wait" && x.kid === meId())
const propVal = (k, v) => !v ? "нет" : k === "day" ? shortDate(parseIso(v)) : String(v)
const propText = x => Object.keys(x.patch || {}).map(k => `${PROP_F[k] || k}: ${propVal(k, x.patch[k])}`).join(" · ") + (x.why ? `${Object.keys(x.patch || {}).length ? " · " : ""}«${x.why}»` : "")
const whoName = id => { const m = member(id); return !m ? "Взрослые" : /мам/i.test(m.name) ? "Мама" : /пап/i.test(m.name) ? "Папа" : short(m.name) }
function propNews(kid) {   // ответы взрослых — сутки после ответа
  const l = L("log").filter(x => x.kind === "prop" && x.kid === kid && (x.st === "ok" || x.st === "no") && Date.now() - (x.u || 0) < 864e5).sort((a, b) => (b.u || 0) - (a.u || 0)).slice(0, 3)
  return l.length ? `<div class="kcard kans"><h2>Ответ взрослых</h2>${l.map(x => `<div class="krow"><span class="kcb ${x.st === "ok" ? "ok" : "no"}">${ic(x.st === "ok" ? "check" : "x", 16, "#fff", 3)}</span><div class="grow"><b>${esc(whoName(x.by))}: ${x.st === "ok" ? "да" : "нет"}</b><div class="kmuted">${esc(String(x.title || "").replace(/^изменить /, ""))}${x.st === "ok" ? " — изменено, как ты просил" : " — остаётся как было"}</div></div></div>`).join("")}</div>` : ""
}
function kidItemSheet(list, id) {
  const x = L(list).find(z => z.id === id); if (!x) return
  const ev = list === "events", mine = ev && x.by === meId(), w = propWait(id)
  const rows = ev ? [["clock", (x.day ? core.cap(fullDate(parseIso(x.day))) : "Каждую неделю: " + (x.days || []).map(d => WD7[d - 1]).join(", ")) + (x.time ? " · " + x.time : " · весь день")],
      x.place && ["map", x.place], x.take && ["bag", "Взять с собой: " + x.take], ["users", x.who === "fam" ? "Вся семья" : mine ? "Добавил ты" : "Для тебя"]]
    : [["clock", x.when || ((x.days || []).length ? (x.days || []).map(d => WD7[d - 1]).join(", ") : "Каждый день")], ["star", `+${x.stars || 5} звёзд` + (x.check ? " · проверит взрослый" : "")]]
  const s = sheet(`<h3>${esc(x.title)}</h3><div class="kinfo">${rows.filter(Boolean).map(([i, t]) => `<div class="krow">${ic(i, 20, "#6A4BF2")}<div class="grow">${esc(t)}</div></div>`).join("")}</div>
    ${w ? `<div class="kask">${ic("clock", 18, "#C98500")}<div><b>Ты попросил изменить</b>${esc(propText(w))}<br>Ждём ответ мамы или папы.</div></div>` : ""}
    ${mine ? `<button class="kbtn" data-a="edit">Изменить</button><button class="klink" data-a="del">Удалить</button>`
      : `<div class="kmuted knote">${ic("lock", 15, "#8C86B3")} Это ${ev ? "дело" : "задание"} добавили взрослые. Убрать его нельзя, но можно попросить изменить.</div>
        ${w ? `<button class="kbtn soft" data-a="undo">Отменить просьбу</button>` : `<button class="kbtn" data-a="ask">Попросить изменить</button>`}`}`)
  s.el.classList.add("kid-sheet")
  const on = (a, f) => { const b = $(`[data-a="${a}"]`, s.el); if (b) b.onclick = f }
  on("edit", () => { s.close(); kidEvForm(x) })
  on("del", async () => { if (await ui.confirm("Удалить?", `<div class="msg">«${esc(x.title)}» пропадёт из расписания.</div>`, ["Оставить", "Удалить"]) !== "Удалить") return
    put("events", Object.assign({}, x, { del: true })); s.close(); render(); toast("Удалено") })
  on("ask", () => { s.close(); kidPropForm(list, x) })
  on("undo", () => { put("log", Object.assign({}, w, { del: true })); s.close(); render(); toast("Просьба отменена") })
}
// Своё дело в расписании (ребёнок добавляет и правит сам; взрослые видят его в календаре семьи)
function kidEvForm(x) {
  const b = x || { title: "", day: today(), time: "", place: "" }
  const s = sheet(`<h3>${x ? "Изменить" : "Моё дело"}</h3>
    <div class="field"><label>Что</label><input id="ke-t" value="${esc(b.title)}" placeholder="Кружок, встреча с другом…"></div>
    <div class="grid2"><div class="field"><label>День</label><input id="ke-d" type="date" value="${esc(b.day || today())}"></div>
    <div class="field"><label>Во сколько</label><input id="ke-h" type="time" value="${esc(b.time || "")}"></div></div>
    <div class="field"><label>Где</label><input id="ke-p" value="${esc(b.place || "")}" placeholder="Можно не писать"></div>
    <div class="kmuted">Мама и папа увидят это дело в календаре семьи.</div>
    <button class="kbtn" data-a="ok">Сохранить</button>`)
  s.el.classList.add("kid-sheet")
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#ke-t", s.el).value.trim().slice(0, 60), day = $("#ke-d", s.el).value
    if (!title) return toast("Напиши, что за дело"); if (!day) return toast("Выбери день")
    put("events", Object.assign({}, x || { id: uid("fe"), who: meId(), by: meId(), at: Date.now(), min: 60 }, { title, day, time: $("#ke-h", s.el).value || "", place: $("#ke-p", s.el).value.trim().slice(0, 80) }))
    s.close(); render(); toast("Сохранено")
  }
}
// Просьба изменить то, что добавили взрослые
function kidPropForm(list, x) {
  const ev = list === "events"
  const s = sheet(`<h3>Попросить изменить</h3><div class="kmuted">Напиши, как хочешь. Мама или папа ответят «да» или «нет».</div>
    <div class="field"><label>Что</label><input id="kp-t" value="${esc(x.title)}"></div>
    ${ev ? `<div class="grid2">${x.day ? `<div class="field"><label>День</label><input id="kp-d" type="date" value="${esc(x.day)}"></div>` : ""}
      <div class="field"><label>Во сколько</label><input id="kp-h" type="time" value="${esc(x.time || "")}"></div></div>
      <div class="field"><label>Где</label><input id="kp-p" value="${esc(x.place || "")}"></div>`
      : `<div class="field"><label>Когда</label><input id="kp-w" value="${esc(x.when || "")}" placeholder="Например: после школы"></div>`}
    <div class="field"><label>Почему</label><input id="kp-y" placeholder="Например: в это время у меня кружок"></div>
    <button class="kbtn" data-a="ok">Отправить взрослым</button>`)
  s.el.classList.add("kid-sheet")
  $('[data-a="ok"]', s.el).onclick = () => {
    const v = q => { const el = $(q, s.el); return el ? el.value.trim() : null }
    const patch = {}, set = (k, val, max) => { if (val != null && val !== String(x[k] || "")) patch[k] = val.slice(0, max || 80) }
    const title = v("#kp-t"); if (!title) return toast("Название не может быть пустым")
    set("title", title, 60); set("day", v("#kp-d")); set("time", v("#kp-h")); set("place", v("#kp-p")); set("when", v("#kp-w"), 40)
    if (patch.day === "") delete patch.day
    const why = (v("#kp-y") || "").slice(0, 120)
    if (!Object.keys(patch).length && !why) return toast("Напиши, что изменить")
    put("log", { id: uid("pr"), kind: "prop", kid: meId(), list, ref: x.id, patch, why, title: `изменить «${x.title}»`, day: today(), at: Date.now(), st: "wait" })
    s.close(); render(); toast("Отправил — ответ придёт сюда")
  }
}
function kLearn(me) {
  const ls = lessonsFor(me.id).filter(l => l.c === kCourse), cur = nextLesson(me.id, kCourse), [, , color] = COURSES.find(c => c[0] === kCourse)
  let h = kHead("Школа Изи", "Учимся мечтать", star(num(kidStars(me.id))))
  h += `<div class="kseg">${COURSES.map(([k, t, c]) => `<button data-kc="${k}" style="${k === kCourse ? `background:${c};color:#fff` : `color:${c}`}">${t}</button>`).join("")}</div>`
  h += `<div class="kcard kpath">${ls.map((l, i) => { const done = lessonDone(me.id, l.id), now = cur && cur.id === l.id, lock = !done && !now
    return `<button class="knode ${done ? "done" : now ? "now" : "lock"}" data-kles="${l.id}" style="--c:${color};margin-left:${[8, 52, 30, 60, 14][i % 5]}%">
      <span class="kdot">${done ? ic("check", 32, "#fff", 3) : lock ? ic("lock", 26, "#B7AEE8") : ic(l.ic, 32, "#fff")}</span><span class="kl">${esc(l.t)}</span></button>` }).join("")}</div>`
  h += `<div class="kcard"><b>Возраст: ${me.age || "?"} ${plural(me.age || 0, "год", "года", "лет")}</b><div class="kmuted">Уроки подобраны под возраст: 8–10 — истории и задачки, 11–13 — ещё бюджет, проценты и цели на месяц.</div></div>`
  return h
}
function kMoney(me) {
  const j = jars(me.id), all = j.spend + j.save + j.share, s = kset(me.id), np = nextPocket(me.id), cur = kcur(me.id)
  let h = kHead("Мои деньги", "Копилки")
  h += `<div class="kcard kc"><div class="kmuted">У меня всего</div><div class="kbig">${num(all)} ${esc(cur)}</div><div class="kjars">${JARS.map(([k, t, n, c]) => `<div style="background:${c}18"><span class="kji" style="background:${c}">${ic(n, 22, "#fff")}</span><b>${t}</b><em style="color:${c}">${num(j[k])}</em></div>`).join("")}</div></div>`
  if (s.pocket > 0) h += `<div class="kcard"><h2>Карманные <span>${["", "по понедельникам", "по вторникам", "по средам", "по четвергам", "по пятницам", "по субботам", "по воскресеньям"][s.wd]}</span></h2><div class="krow"><div class="grow"><div class="kbig s">${num(s.pocket)} ${esc(cur)}</div><div class="kmuted">сами разложатся: ${s.split.join("% · ")}%</div></div><div class="kr"><div class="kmuted">${np === 0 ? "" : "через"}</div><b>${np === 0 ? "сегодня" : np + " " + plural(np, "день", "дня", "дней")}</b></div></div></div>`
  const earn = kidEarn(me.id)
  if (earn.length) h += `<div class="kcard"><h2>Заработать</h2>${earn.map(t => { const l = logOf(me.id, t.id), n = t.ic || taskIc(t.title), c = icColor(n)
    return `<button class="ktask" data-ktask="${esc(t.id)}"><div class="kic" style="background:${c}22">${ic(n, 24, c)}</div><div class="grow"><div class="kt">${esc(t.title)}</div><div class="km">${l ? (l.st === "ok" ? "заработано сегодня" : l.st === "wait" ? "ждёт подтверждения" : "не засчитано") : "взрослый подтвердит"}</div></div><span class="kpay" style="color:${c}">+${num(t.pay)} ${esc(cur)}</span></button>` }).join("")}</div>`
  const wt = L("money").filter(m => m.kid === me.id && m.st === "wait")
  h += `<div class="kcard">${wt.map(m => `<div class="krow kwait">${ic("clock", 22, "#C98500")}<div class="grow"><b>${esc(m.note)}</b><div class="kmuted">${num(-m.amount)} ${esc(cur)} · ждёт ответа</div></div></div>`).join("")}
    <button class="kbtn" data-k="buy">Хочу купить</button><button class="kbtn soft" data-k="hist">Что было с деньгами</button></div>`
  return h
}
function kDreams(me) {
  const ds = kidDreams(me.id), main = mainDream(me.id), bank = ds.filter(d => !d.main && !d.done), j = jars(me.id), cur = kcur(me.id)
  let h = kHead("Банка желаний", "Мои мечты", `<button class="kadd" data-k="wish" aria-label="Добавить желание">${ic("plus", 24, "#fff", 2.6)}</button>`)
  if (main) { const p = main.price ? Math.min(1, j.save / main.price) : 0
    h += `<div class="kcard kmain"><div class="krow"><div class="kmi">${ic(main.ic || "star", 34, "#fff")}</div><div class="grow"><div class="kcap">ГЛАВНАЯ МЕЧТА</div><div class="kmt">${esc(main.title)}</div>${main.price ? `<div class="kmp">${num(Math.min(j.save, main.price))} из ${num(main.price)} ${esc(cur)}</div>` : ""}</div></div>
    ${main.price ? `<div class="kbar w"><i style="width:${Math.round(p * 100)}%"></i></div>` : ""}<div class="kcap2">Шаги к мечте</div>
    ${(main.steps || []).map((s, i) => `<button class="kstep ${s.d ? "on" : ""}" data-kstep="${esc(main.id)}:${i}"><span>${s.d ? ic("check", 16, "#18B57A", 3) : ""}</span>${esc(s.t)}</button>`).join("")}
    ${p >= 1 ? `<button class="kbtn white" data-kgot="${esc(main.id)}">Мечта сбылась!</button>` : ""}</div>` }
  h += `<div class="kcard"><h2>Банка желаний <span>${bank.length}</span></h2><div class="kchips">${bank.map((d, i) => `<button data-kd="${esc(d.id)}" style="--c:${COLORS[(i + 2) % COLORS.length]}">${esc(d.title)}</button>`).join("") || `<div class="kmuted">Пока пусто. Нажми плюс и напиши, чего хочется.</div>`}</div>
  <div class="kmuted" style="margin-top:10px">Нажми на желание — и Изи поможет сделать его целью.</div></div>`
  const done = ds.filter(d => d.done)
  if (done.length) h += `<div class="kcard"><h2>Сбылось <span>${done.length}</span></h2>${done.map(d => `<div class="krow kdone">${ic("check", 18, "#18B57A", 3)}<b>${esc(d.title)}</b></div>`).join("")}</div>`
  return h
}
function kidNav() {
  let n = $("#knav")
  if (!n) { n = document.createElement("nav"); n.id = "knav"; document.body.append(n) }
  const t = [["day", "Мой день", "home"], ["learn", "Учёба", "map"], ["izi", "", ""], ["money", "Копилки", "coins"], ["dreams", "Мечты", "heart"]]
  n.innerHTML = t.map(([k, s, i]) => k === "izi" ? `<button class="kfab" data-kt="izi" aria-label="${esc(iziName())}">${orb(66)}</button>` : `<button data-kt="${k}" class="${kTab === k ? "on" : ""}">${ic(i, 26)}<span>${s}</span></button>`).join("")
  $$("[data-kt]", n).forEach(b => b.onclick = () => { if (b.dataset.kt === "izi") return kidIzi(); kTab = b.dataset.kt; render(); window.scrollTo(0, 0) })
}
function kidBind(v) {
  $$("[data-kev]", v).forEach(b => b.onclick = () => kidItemSheet("events", b.dataset.kev))
  $$("[data-kti]", v).forEach(b => b.onclick = () => kidItemSheet("tasks", b.dataset.kti))
  $$("[data-ktask]", v).forEach(b => b.onclick = () => { const t = L("tasks").find(x => x.id === b.dataset.ktask); if (t) { tick(t); render() } })
  $$("[data-kles]", v).forEach(b => b.onclick = () => { const l = LESSONS.find(x => x.id === b.dataset.kles), me = meId(); if (!l) return
    if (!lessonDone(me, l.id) && nextLesson(me, l.c) && nextLesson(me, l.c).id !== l.id) return toast("Сначала пройди предыдущий урок"); lesson(l) })
  $$("[data-kc]", v).forEach(b => b.onclick = () => { kCourse = b.dataset.kc; render() })
  $$("[data-kd]", v).forEach(b => b.onclick = () => dreamTalk(L("dreams").find(x => x.id === b.dataset.kd)))
  $$("[data-kstep]", v).forEach(b => b.onclick = () => { const [id, i] = b.dataset.kstep.split(":"), d = L("dreams").find(x => x.id === id); if (!d) return
    const steps = (d.steps || []).map((s, k) => k === +i ? Object.assign({}, s, { d: !s.d }) : s); put("dreams", Object.assign({}, d, { steps })); if (steps[+i].d) burst(); render() })
  $$("[data-kgot]", v).forEach(b => b.onclick = () => dreamGot(L("dreams").find(x => x.id === b.dataset.kgot)))
  $$("[data-k]", v).forEach(b => b.onclick = () => (KDO[b.dataset.k] || (() => {}))())
}
const KDO = {
  paste: () => famPaste(), scan: () => scan(), adult: () => { D.who = "adult"; save(false); render() }, out: () => window.EXIT && EXIT.out(),
  wish: async () => { const t = await ui.ask("Чего тебе хочется?", "Большое или маленькое — всё подходит.", "", { placeholder: "Например: лего-замок", ok: "В банку" }); if (!t) return
    put("dreams", { id: uid("dr"), kid: meId(), title: t.slice(0, 60), at: Date.now() }); burst(); render() },
  buy: () => buyForm(), hist: () => moneyHist(meId()), evnew: () => kidEvForm(),
}
function dreamTalk(d) {
  if (!d) return
  const s = sheet(`<div class="ksheet"><div class="ksay">${orb(60)}<div class="kbub">«${esc(d.title)}» — это желание или цель? Если сделать целью, придумаем шаги и посчитаем, сколько копить.</div></div>
    <div class="field"><label>Сколько стоит (если знаешь)</label><input id="kd-p" type="number" inputmode="numeric" placeholder="например, 4500" value="${d.price || ""}"></div>
    <div class="btns"><button class="kbtn" data-a="goal">Сделать главной мечтой</button><button class="kbtn soft" data-a="later">Пусть мечтается</button><button class="klink" data-a="del">Убрать из банки</button></div></div>`)
  s.el.classList.add("kid-sheet")
  $('[data-a="goal"]', s.el).onclick = () => { const price = Math.round(+$("#kd-p", s.el).value || 0)
    for (const x of kidDreams(meId())) if (x.main && x.id !== d.id) put("dreams", Object.assign({}, x, { main: false }))
    put("dreams", Object.assign({}, d, { main: true, price, ic: taskIc(d.title) === "star" ? "star" : taskIc(d.title), steps: DREAM_STEPS.map((t, i) => ({ t, d: i === 0 && price > 0 })) }))
    s.close(); burst(); render() }
  $('[data-a="later"]', s.el).onclick = () => s.close()
  $('[data-a="del"]', s.el).onclick = () => { put("dreams", Object.assign({}, d, { del: true })); s.close(); render() }
}
function dreamGot(d) {
  if (!d) return
  if (d.price) put("money", { id: "dg:" + d.id, kid: d.kid, at: Date.now(), amount: -Math.min(d.price, jars(d.kid).save), jar: "save", kind: "dream", note: d.title, st: "ok" })
  put("dreams", Object.assign({}, d, { done: true, main: false, doneAt: Date.now() }))
  party({ title: d.title, kid: true }); render()
}
async function buyForm() {
  const me = meId(), j = jars(me), s = kset(me), cur = kcur(me)
  const t = await ui.ask("Что хочешь купить?", "", "", { placeholder: "Например: слайм", ok: "Дальше" }); if (!t) return
  const p = Math.round(+(await ui.ask("Сколько стоит?", `В копилке «Трачу» сейчас ${num(j.spend)} ${cur}.`, "", { type: "number", ok: "Дальше" })) || 0); if (!p) return
  if (p > j.spend) {
    const v = await ui.confirm("Пока не хватает", `<div class="msg">В «Трачу» ${num(j.spend)} ${esc(cur)}, а нужно ${num(p)} ${esc(cur)}. Можно подождать карманных, заработать на делах или положить «${esc(t)}» в банку желаний — и копить на мечту.</div>`, ["Понятно", "В банку желаний"])
    if (v === "В банку желаний") { put("dreams", { id: uid("dr"), kid: me, title: t.slice(0, 60), price: p, at: Date.now() }); burst(); toast("Лежит в банке желаний"); kTab = "dreams"; render(); window.scrollTo(0, 0) }
    return
  }
  const ask = p > (+s.limit || 0)
  const v = await ui.confirm(ask ? "Спросить взрослых?" : "Записать покупку?", `<div class="msg">${esc(t)} — ${num(p)} ${esc(cur)} из копилки «Трачу».${ask ? ` Покупки дороже ${num(s.limit)} ${esc(cur)} — с разрешения мамы или папы.` : ""}</div>`, ["Подожду", ask ? "Спросить" : "Купил"])
  if (!v || v === "Подожду") return
  put("money", { id: uid("mb"), kid: me, at: Date.now(), amount: -p, jar: "spend", kind: "buy", note: t.slice(0, 60), st: ask ? "wait" : "ok" })
  toast(ask ? "Спросил — ответ придёт сюда" : "Записано"); render()
}
function moneyHist(kid) {
  const cur = kcur(kid), l = L("money").filter(m => m.kid === kid).sort((a, b) => b.at - a.at).slice(0, 40)
  const s = sheet(`<h3>Что было с деньгами</h3>${l.map(m => `<div class="row"><div class="grow"><div class="t">${esc(m.note || "")}</div><div class="s">${esc(shortDate(new Date(m.at)))} · ${(JARS.find(j => j[0] === m.jar) || [0, ""])[1]}${m.st === "wait" ? " · ждёт" : m.st === "no" ? " · отказано" : ""}</div></div><b style="color:${m.amount < 0 ? "var(--red,#FF453A)" : "#18B57A"}">${m.amount > 0 ? "+" : ""}${num(m.amount)} ${esc(cur)}</b></div>`).join("") || '<div class="empty">Пока ничего</div>'}`)
  s.el.classList.add("kid-sheet")
}
function kidTipText() {
  const me = meId(), les = nextLesson(me), left = todayTasks(me).filter(t => !logOf(me, t.id)).length, m = mainDream(me)
  return left ? `У тебя ${left} ${plural(left, "дело", "дела", "дел")} на сегодня. Сделаешь — получишь звёзды для семьи!` : les ? `Дела сделаны! Хочешь урок «${les.t}»?` : m ? `Как там «${m.title}»? Загляни в «Мечты»: может, пора отметить шаг.` : "Ты сегодня молодец! Придумай новое желание для банки."
}
// Что Изи знает о ребёнке: только его дела, звёзды, копилки и мечты
function kidCtx() {
  const j = jars(meId()), m = mainDream(meId()), les = nextLesson(meId())
  const t = todayTasks(meId()).map(x => { const st = (logOf(meId(), x.id) || {}).st; return `${x.title} — ${st === "ok" ? "сделано" : st === "wait" ? "ждёт проверки" : "не сделано"}` }).join("; ")
  return `Сегодня ${fullDate(new Date())}. Дела: ${t || "нет"}. Звёзд всего: ${kidStars(meId())}. Копилки: Трачу ${j.spend}, Коплю ${j.save}, Делюсь ${j.share} ${core.CONFIG.currency || "฿"}. ${m ? `Главная мечта: ${m.title}${m.price ? `, стоит ${m.price}` : ""}.` : ""} Банка желаний: ${kidDreams(meId()).filter(d => !d.main && !d.done).map(d => d.title).join(", ") || "пусто"}. ${les ? `Следующий урок: ${les.t}.` : ""} Семейная цель: ${(famGoals().find(x => !x.done) || {}).title || "нет"}.`
}
const MIC_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>'
function kidIzi() {
  const chat = D.kchat || (D.kchat = [])
  let busyK = false
  // Остановить и закрыть — всегда на виду: «Стоп» прерывает голос Изи и микрофон, «Закрыть» ещё и убирает окно
  let recK = null
  const hush = () => { try { if (recK) recK.cancel() } catch (e) {} ; try { if (typeof ttsStop === "function") ttsStop() } catch (e) {} }
  const s = sheet(`<div class="ksheet kchat"><div class="kchat-h">${orb(44)}<b class="grow">${esc(iziName())}</b><button class="kstop" hidden>${ic("stopsq", 18)}Стоп</button><button class="kclose" aria-label="Закрыть">${ic("x", 20, "currentColor", 2.6)}<span>Закрыть</span></button></div><div class="kmsgs"></div>
    <div class="kin"><button class="kmic" aria-label="Сказать голосом">${MIC_SVG}</button><input id="kc-t" placeholder="Скажи или напиши ${esc(iziName())}…" enterkeyhint="send"><button class="ksend" aria-label="Отправить">${ic("chev", 22, "#fff", 3)}</button></div></div>`)
  s.el.classList.add("kid-sheet", "kfull")
  try { if (typeof ttsUnlock === "function") ttsUnlock() } catch (e) {}
  const stopB = $(".kstop", s.el)
  const live = () => { if (!s.el.isConnected) return clearInterval(tick); stopB.hidden = !(recK || (typeof TTS !== "undefined" && (TTS.speaking || TTS.wait))) }
  const tick = setInterval(live, 250)
  stopB.onclick = () => { hush(); live() }
  $(".kclose", s.el).onclick = () => s.close()
  const close0 = s.close; s.close = () => { hush(); clearInterval(tick); close0() }
  const box = $(".kmsgs", s.el), inp = $("#kc-t", s.el)
  const draw = () => {
    const l = chat.slice(-30)
    box.innerHTML = (l.length ? "" : `<div class="kmsg a">${esc(kidTipText())}</div><div class="kquick">${["Что мне сделать сейчас?", "Как быстрее накопить на мечту?", "Придумай мне цель на неделю"].map(q => `<button data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>`) +
      l.map(x => `<div class="kmsg ${x.role === "user" ? "u" : "a"}">${esc(x.content)}${x.why ? `<small class="kwhy2">${esc(x.why)}</small>` : ""}</div>`).join("") + (busyK ? `<div class="kmsg a kdots"><i></i><i></i><i></i></div>` : "")
    $$("[data-q]", box).forEach(b => b.onclick = () => send(b.dataset.q))
    box.scrollTop = box.scrollHeight
  }
  let byVoice = false
  const say = t => { try { if (typeof speak === "function") speak(t, { force: true }) } catch (e) {} }
  // Голос: ребёнок говорит — Изи слушает до паузы, отправляет и отвечает вслух.
  // Как у взрослых: Safari слушает непрерывно, конец фразы — 2,2 с тишины. Синтез речи здесь не трогаем:
  // на iPhone/iPad «говорить» и «слушать» в одно касание вешают страницу — синтез будится при открытии окна.
  const listen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $(".kmic", s.el)
    if (recK) return recK.finish()
    if (!SR) { inp.focus(); return toast("Нажми микрофон на клавиатуре и говори") }
    try { if (typeof TTS !== "undefined" && TTS.speaking && typeof ttsStop === "function") ttsStop() } catch (e) {}
    const r = new SR(); r.lang = ((window.L && L.loc) || "ru-RU"); r.interimResults = true; r.continuous = true
    let txt = "", t = null, done = false
    const stopNow = () => { clearTimeout(t); try { r.stop() } catch (e) {} ; t = setTimeout(end, 1500) }   // Safari не прислал onend — закончим сами
    const end = () => { if (done) return; done = true; clearTimeout(t); try { r.abort() } catch (e) {}
      recK = null; mic.classList.remove("on"); inp.placeholder = `Скажи или напиши ${iziName()}…`; if (txt) { byVoice = true; send(txt) } }
    r.onresult = e => { const a = []; for (let i = 0; i < e.results.length; i++) a.push(e.results[i][0].transcript)
      txt = a.join(" ").replace(/\s+/g, " ").trim(); inp.value = txt; clearTimeout(t); t = setTimeout(stopNow, 2200) }
    r.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed") toast("Разреши микрофон в настройках Safari"); if (e.error !== "no-speech") end() }
    r.onend = end
    recK = { finish: stopNow, cancel: () => { txt = ""; end() } }; mic.classList.add("on"); inp.placeholder = "Слушаю… нажми ещё раз — отправить"
    t = setTimeout(stopNow, 8000)   // ничего не сказал — выключаемся
    try { r.start() } catch (err) { end() }
  }
  const send = async text => {
    text = String(text || "").trim(); if (!text || busyK) return
    const voiceNow = byVoice; byVoice = false
    chat.push({ role: "user", content: text.slice(0, 500), at: Date.now() }); inp.value = ""; busyK = true; draw()
    // в историю для Claude — только настоящий разговор, без наших «не получилось»
    const ask = () => post(D.fam.url, { op: "ask", code: D.fam.code, id: D.fam.id, ctx: kidCtx(), messages: chat.filter(x => !x.err).slice(-12).map(x => ({ role: x.role, content: x.content })) })
    let r = await ask()
    // Claude перегружен или упёрся в минутный лимит ключа — подождать и спросить ещё раз
    if (r && !r.ok && /overload|rate|529|429|занята|долго/i.test(r.error || "")) { await new Promise(z => setTimeout(z, 2500)); r = await ask() }
    busyK = false
    const err = !(r && r.ok && r.text)
    const ans = !err ? r.text : r && r.error === "nokey" ? `Мама или папа ещё не включили для меня разговоры. А пока подсказка: ${kidTipText()}` : r && r.error === "limit" ? "На сегодня мы наболтались! Завтра продолжим. А пока можно пройти урок или отметить дела." : "Ой, не получилось ответить. Спроси ещё раз, пожалуйста."
    chat.push(Object.assign({ role: "assistant", content: ans, at: Date.now() }, err ? { err: true, why: String((r && r.error) || "нет ответа").slice(0, 120) } : {}))
    while (chat.length > 60) chat.shift()
    save(false); draw()
    if (voiceNow && s.el.isConnected) say(ans)
  }
  $(".kmic", s.el).onclick = listen
  $(".ksend", s.el).onclick = () => send(inp.value)
  inp.onkeydown = e => { if (e.key === "Enter") send(inp.value) }
  draw()
}
function lesson(l) {
  let i = 0, picked = null, coins = { spend: 0, save: 0, share: 0 }
  const s = sheet(`<div class="klesson"></div>`); s.el.classList.add("kid-sheet", "kfull")
  const box = $(".klesson", s.el)
  const draw = () => {
    const st = l.steps[i], last = i === l.steps.length - 1
    let b = `<div class="kprog"><div class="kbar"><i style="width:${Math.round((i + 1) / l.steps.length * 100)}%"></i></div><span>${i + 1} / ${l.steps.length}</span></div>`
    b += `<div class="ksay">${orb(72)}<div class="kbub">${esc(st.say || st.q)}</div></div>`
    if (st.q) b += `<div class="kopts">${st.a.map((a, k) => `<button data-o="${k}" class="${picked == null ? "" : k === st.ok ? "ok" : k === picked ? "bad" : ""}">${esc(a)}</button>`).join("")}</div>${picked != null ? `<div class="kwhy ${picked === st.ok ? "ok" : ""}">${ic("bulb", 26, picked === st.ok ? "#18B57A" : "#FF8A3D")}<div>${picked === st.ok ? "Верно! " : "Почти! "}${esc(st.why)}</div></div>` : ""}`
    if (st.split) { const tot = coins.spend + coins.save + coins.share
      b += `<div class="kjars big">${JARS.map(([k, t, n, c, sub]) => `<button data-j="${k}" style="--c:${c}"><span class="kjar" style="--f:${coins[k]}%">${ic(n, 30, coins[k] > 45 ? "#fff" : c)}</span><b>${t}</b><em>${coins[k]}</em><small>${sub}</small></button>`).join("")}</div>
      <div class="kcoins">${Array.from({ length: (100 - tot) / 10 }, () => `<i>10</i>`).join("")}</div>${tot === 100 ? `<div class="kwhy ok">${ic("bulb", 26, "#18B57A")}<div>${coins.save >= 30 ? `Отлично! Если копить по ${coins.save} монет, мечта будет ближе с каждой неделей.` : "Готово! Но подумай: если в «Коплю» класть побольше, мечта сбудется быстрее."}</div></div>` : ""}` }
    const can = (!st.q || picked != null) && (!st.split || coins.spend + coins.save + coins.share === 100)
    b += `<button class="kbtn" data-a="next" ${can ? "" : "disabled"}>${last ? `Готово · +${LESSON_STARS} звёзд` : "Дальше"}</button>`
    box.innerHTML = b
    $$("[data-o]", box).forEach(x => x.onclick = () => { if (picked == null) { picked = +x.dataset.o; if (picked === st.ok) burst(); draw() } })
    $$("[data-j]", box).forEach(x => x.onclick = () => { if (coins.spend + coins.save + coins.share < 100) { coins[x.dataset.j] += 10; draw() } })
    $('[data-a="next"]', box).onclick = () => { if (!last) { i++; picked = null; draw(); return }
      const me = meId(); if (!lessonDone(me, l.id)) put("log", { id: `ls:${me}:${l.id}`, kid: me, task: l.id, title: "Урок: " + l.t, day: today(), at: Date.now(), kind: "lesson", st: "ok", stars: LESSON_STARS })
      s.close(); burst(); toast(`+${LESSON_STARS} звёзд`); render() }
  }
  draw()
}
// Праздник: конфетти и общий экран, когда семейная цель достигнута (или сбылась мечта ребёнка)
function burst(el) {
  const host = document.createElement("div"); host.className = "kburst"
  for (let k = 0; k < 18; k++) { const i = document.createElement("i"); i.style.cssText = `--x:${Math.cos(k / 18 * 6.28) * (60 + k % 3 * 30)}px;--y:${Math.sin(k / 18 * 6.28) * (60 + k % 3 * 30)}px;background:${COLORS[k % COLORS.length]}`; host.append(i) }
  document.body.append(host); setTimeout(() => host.remove(), 900)
}
function party(g, p) {
  const ms = members(), by = g.kid ? {} : sumSince(g.start || "0000").by, best = Object.entries(by).sort((a, b) => b[1] - a[1])[0], bm = best && member(best[0])
  const s = sheet(`<div class="kparty">${Array.from({ length: 36 }, (_, k) => `<i style="left:${(k * 53) % 100}%;animation-delay:${(k % 9) * 0.12}s;background:${COLORS[k % COLORS.length]}"></i>`).join("")}
    ${orb(130)}<div class="kcap3">${g.kid ? "МЕЧТА СБЫЛАСЬ" : "СЕМЕЙНАЯ ЦЕЛЬ ДОСТИГНУТА"}</div><h1>${esc(g.title)}!</h1>
    ${g.kid ? "" : `<p>${num(p ? (g.repeat ? p.need : p.need) : 0)} баллов вместе.${bm ? ` Больше всех помог${bm.role === "kid" ? "" : "(ла)"} ${esc(short(bm.name))} — ${num(best[1])}.` : ""}</p><div class="kfaces">${ms.map(m => `<span style="background:${m.color || COLORS[0]}">${esc((m.name || "?").charAt(0))}</span>`).join("")}</div>`}
    <button class="kbtn" data-a="ok">Ура!</button></div>`)
  s.el.classList.add("kid-sheet", "kfull", "kparty-sheet")
  $('[data-a="ok"]', s.el).onclick = () => s.close()
}

// ═════════════ Взрослые: «Планы → Семья» ═════════════
function famPage() {
  if (!famOn()) return `<div class="card fcard"><h2>Семья</h2><div class="muted">Общие семейные баллы и цели, дела и копилки детей, уроки Изи про цели, желания и деньги. Дети 8–13 лет получают яркий детский режим, подростки 14–17 — обычное приложение в семье.</div>
    <div class="btns" style="margin-top:12px"><button class="btn" data-f="scan">${ic("scan", 16)} Сканировать шар</button><button class="btn primary" data-f="new">Создать семью</button></div>
    <button class="flink" data-f="paste">У меня есть ссылка-приглашение</button></div>`
  const mk = monthStartK(), mon = sumSince(mk), g = famGoals().find(x => !x.done), gp = g && goalProg(g), adult = isAdult(), cur = core.CONFIG.currency || "฿"
  let h = `<div class="fhero"><div class="k">Семейные баллы за ${MONTH_NOM_L()}</div><div class="v">${num(mon.total)}</div>`
  if (g) h += `<div class="fbar"><i style="width:${Math.round(gp.p * 100)}%"></i></div><div class="fl"><span>цель: ${esc(g.title)} · ${num(gp.need)}</span><span>ещё ${num(gp.need - gp.have)}</span></div>`
  h += `<span class="fpill">${ic("users", 15)}${members().length} ${plural(members().length, "человек", "человека", "человек")}</span>${kids().length ? `<span class="fpill">${ic("star", 15)}звёзды детей ×${KID_X}</span>` : ""}</div>`
  const ms = members(), mx = Math.max(1, ...ms.map(m => mon.by[m.id] || 0))
  h += `<div class="card fcard"><h2>Кто сколько принёс</h2>${ms.map(m => `<button class="row frow" data-fm="${esc(m.id)}"><span class="fav" style="background:${m.color || COLORS[0]}">${esc((m.name || "?").charAt(0))}</span><div class="grow"><div class="fsp"><div class="t">${esc(m.name || "?")}${m.age && m.role !== "adult" ? ", " + m.age : ""}${m.id === meId() ? " · вы" : ""}</div><span class="fpts">${num(mon.by[m.id] || 0)}</span></div>
    <div class="s">${m.role === "kid" ? `детский режим · ${num(kidStars(m.id, mk))} звёзд` : ROLE_T[m.role] || ""}${m.role !== "adult" && !m.at ? " · ещё не вошёл" : ""}</div><div class="fgbar"><i style="width:${Math.round((mon.by[m.id] || 0) / mx * 100)}%;background:${m.color || COLORS[0]}"></i></div></div></button>`).join("")}
    ${kids().length ? `<div class="muted small" style="margin-top:8px">Звёзды детей идут в семейные баллы ×${KID_X}, чтобы вклад был честным.</div>` : ""}
    ${adult ? `<div class="btns" style="margin-top:10px"><button class="btn" data-f="invite">Пригласить взрослого</button><button class="btn primary" data-f="kid">Добавить ребёнка</button></div>` : ""}</div>`
  const w = waits()
  if (adult && w.length) h += `<div class="card fcard" id="fwait"><h2>Ждут вашей проверки <span class="muted small">${w.length}</span></h2>${w.map((x, i) => { const m = member(x.x.kid) || {}, pr = x.x.kind === "prop", n = pr ? "clock" : x.t === "money" ? "bag" : x.x.kind === "earn" ? "coins" : taskIc(x.x.title), c = pr ? "#6A4BF2" : icColor(n)
    return `<div class="row"><span class="ftile" style="background:${c}1F">${ic(n, 22, c)}</span><div class="grow"><div class="t">${esc(short(m.name))} · ${esc(x.t === "money" ? "хочет купить: " + x.x.note : pr ? "просит " + x.x.title : x.x.title)}</div><div class="s">${pr ? esc(propText(x.x) || "без подробностей") : x.t === "money" ? `${num(-x.x.amount)} ${esc(cur)} из «Трачу»` : x.x.pay ? `+${num(x.x.pay)} ${esc(cur)}` : `+${x.x.stars} звёзд`}${!sameDay(x.x.at, Date.now()) ? " · " + esc(dayName(new Date(x.x.at))) : ""}</div></div><button class="btn small" data-fno="${i}">Нет</button><button class="btn small primary" data-fyes="${i}">Да</button></div>` }).join("")}</div>`
  const gs = famGoals()
  h += `<div class="card fcard"><h2>Семейные цели<button class="act" data-f="goal">Добавить</button></h2>${gs.map(g => { const p = goalProg(g), gi = goalIc(g.title)
    return `<div class="row" data-fg="${esc(g.id)}"><span class="ftile" style="background:${gi[1]}1F">${ic(g.ic || gi[0], 22, gi[1])}</span><div class="grow"><div class="t">${esc(g.title)}${g.done ? " · достигнута" : ""}</div><div class="s">${g.repeat ? `каждые ${num(g.target)} баллов${p.times ? ` · было ${p.times} ${plural(p.times, "раз", "раза", "раз")}` : ""}` : `${num(p.have)} из ${num(g.target)} баллов${g.due ? " · до " + esc(g.due.split("-").reverse().slice(0, 2).join(".")) : ""}`}</div><div class="fgbar"><i style="width:${Math.round(p.p * 100)}%;background:${gi[1]}"></i></div></div></div>` }).join("") || `<div class="empty">Например: «Аквапарк всей семьёй» за 3 000 баллов или «Кино с попкорном» каждые 1 000.</div>`}</div>`
  const kd = kids().filter(k => mainDream(k.id) || kidDreams(k.id).length)
  if (kd.length) h += `<div class="card fcard"><h2>Мечты детей</h2>${kd.map(k => kidDreams(k.id).filter(d => !d.done).slice(0, 4).map(d => dreamRow(k, d)).join("")).join("")}</div>`
  if (!kidMode()) h += `<div class="card fcard fshare"><h2>Что делим с семьёй</h2>${shareRows()}<div class="muted small" style="margin-top:6px">По умолчанию всё выключено. Каждый в семье решает за себя.</div></div>`
  if (D.fam.owner) h += `<div class="card fcard"><div class="row"><span class="ftile" style="background:#6A4BF21F">${ic("bulb", 22, "#6A4BF2")}</span><div class="grow"><div class="t">Один ключ Claude на семью</div><div class="s">${D.fam.key ? "взрослые без своего ключа и дети говорят с " + esc(iziName()) + " через ваш ключ (детям — до 30 сообщений в день). Ключ лежит в вашей таблице, на телефоны не попадает. Друзьям и лиге он не доступен" : D.conn && D.conn.key ? "выключен — дети видят только подсказки" : "нужен ключ Claude в вашем приложении"}</div></div>${D.conn && D.conn.key ? `<button class="btn small ${D.fam.key ? "" : "primary"}" data-f="${D.fam.key ? "keyoff" : "keyon"}">${D.fam.key ? "Выключить" : "Включить"}</button>` : ""}</div></div>`
  h += `<div class="muted small" style="text-align:center;margin:4px 0 14px">Семья «${esc(F().name || D.fam.fname || "")}»${D.fam.err ? ` · ${esc(D.fam.err)}` : ""} · <button class="linkbtn" data-f="leave">Выйти</button></div>`
  return h
}
const MONTH_NOM_L = () => ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"][new Date().getMonth()]
const mineWish = d => live(D.goals).find(g => g.kind === "wish" && g.from === d.id)
function dreamRow(k, d) {
  const n = d.ic || taskIc(d.title), c = icColor(n), have = mineWish(d), cur = kcur(k && k.id || k)
  return `<div class="row"><span class="ftile" style="background:${c}1F">${ic(n, 22, c)}</span><div class="grow"><div class="t">${esc(short(k.name))}: ${esc(d.title)}</div><div class="s">${d.main ? `главная мечта${d.price ? ` · ${num(Math.min(jars(k.id).save, d.price))} из ${num(d.price)} ${esc(cur)}` : ""}` : "в банке желаний"}</div></div>${have ? `<span class="tag">в моих желаниях</span>` : `<button class="btn small" data-fwish="${esc(d.id)}">К себе</button>`}</div>`
}
function kidSheet(id) {
  const k = member(id); if (!k) return
  if (id === meId() || k.role === "adult") return ui.info(k.name, k.role === "adult" ? "Взрослый: баллы приходят из его приложения IZIDAY." : "")
  const adult = isAdult(), w0 = dayKey(addDays(sod(new Date()), -6)), cur = kcur(id)
  const tl = L("log").filter(x => x.kid === id && x.day >= w0), tasksDone = tl.filter(x => x.kind === "task" && x.st === "ok").length
  const plan = kidTasks(id).reduce((s, t) => s + (t.days && t.days.length ? t.days.length : 7), 0), les = tl.filter(x => x.kind === "lesson").length, st = kset(id), j = jars(id)
  const html = `<h3>${esc(k.name)}${k.age ? ", " + k.age : ""}</h3><div class="msg">${ROLE_T[k.role]}${k.at ? "" : " · ещё не вошёл на своём телефоне"}</div>
  ${k.role === "kid" ? `<div class="fstats"><div style="--c:#0A9F6E"><span>Дела за неделю</span><b>${tasksDone} из ${plan}</b></div><div style="--c:#6A4BF2"><span>Уроки</span><b>${lessonsFor(id).filter(l => lessonDone(id, l.id)).length} из ${lessonsFor(id).length}</b></div><div style="--c:#E0A800"><span>В копилках</span><b>${num(j.spend + j.save + j.share)}</b></div></div>
  <div class="msg">${esc(praise(k, tl, les))}</div>
  <h4>Дела и награды</h4>${[...kidTasks(id), ...kidEarn(id)].map(t => `<div class="row"><span class="ftile" style="background:${icColor(t.ic || taskIc(t.title))}1F">${ic(t.ic || taskIc(t.title), 20, icColor(t.ic || taskIc(t.title)))}</span><div class="grow"><div class="t">${esc(t.title)}</div><div class="s">${t.days && t.days.length && t.days.length < 7 ? t.days.map(d => WD7S[d - 1]).join(", ") : "каждый день"}${t.check || t.pay ? " · нужна проверка" : ""}</div></div><span class="fpts">${t.pay ? num(t.pay) + " " + esc(cur) : (t.stars || 5) + " ★"}</span>${adult ? `<button class="x-btn" data-ftdel="${esc(t.id)}" aria-label="Убрать">${ic("x", 16)}</button>` : ""}</div>`).join("") || '<div class="empty">Дел пока нет</div>'}
  ${adult ? `<div class="btns"><button class="btn" data-a="earn">Дело за деньги</button><button class="btn primary" data-a="task">Добавить дело</button></div>` : ""}
  <h4>Мечты</h4>${kidDreams(id).filter(d => !d.done).map(d => dreamRow(k, d)).join("") || '<div class="empty">Мечт пока нет</div>'}
  <h4>Деньги</h4><div class="row"><div class="grow t">Карманные</div><div class="s">${st.pocket > 0 ? `${num(st.pocket)} ${esc(cur)} ${["", "по пн", "по вт", "по ср", "по чт", "по пт", "по сб", "по вс"][st.wd]}` : "не заданы"}</div></div>
  <div class="row"><div class="grow t">Раскладка</div><div class="s">Трачу ${st.split[0]} · Коплю ${st.split[1]} · Делюсь ${st.split[2]}</div></div>
  <div class="row"><div class="grow t">Покупки без спроса</div><div class="s">до ${num(st.limit)} ${esc(cur)}</div></div>
  <div class="row"><div class="grow t">Копилки</div><div class="s">${JARS.map(([key, t]) => `${t} ${num(j[key])}`).join(" · ")}</div></div>
  ${adult ? `<div class="btns"><button class="btn" data-a="gift">Положить деньги</button><button class="btn" data-a="money">Настроить</button></div>` : ""}
  <h4>Что видит ребёнок</h4><div class="msg">Свои дела, мечты, копилки и уроки, семейные цели и общий счёт. Ваши траты, дневник, здоровье и календарь ему не видны.</div>` : ""}
  ${adult ? `<div class="btns"><button class="btn" data-a="link">${ic("link", 16)} Ссылка для входа</button><button class="btn red" data-a="drop">Убрать из семьи</button></div>` : ""}`
  const s = sheet(html); s.el.classList.add("fam-sheet")
  const on = (a, f) => { const b = $(`[data-a="${a}"]`, s.el); if (b) b.onclick = f }
  on("task", () => { s.close(); taskForm(id) }); on("earn", () => { s.close(); taskForm(id, true) }); on("money", () => { s.close(); moneyForm(id) })
  on("link", () => orbInvite(k)); on("gift", async () => { const v = Math.round(+(await ui.ask("Сколько положить?", "Разложится по копилкам по раскладке ребёнка.", "", { type: "number" })) || 0); if (v > 0) { credit(id, v, "gift", "Подарок", uid("gf")); s.close(); toast("Положено") } })
  on("drop", async () => { if (await ui.confirm(`Убрать ${k.name} из семьи?`, `<div class="msg">Дела и звёзды останутся в журнале, но в семье ${esc(short(k.name))} больше не будет.</div>`, ["Отмена", "Убрать"]) === "Убрать") { s.close(); push(true, { drop: id }) } })
  $$("[data-ftdel]", s.el).forEach(b => b.onclick = () => { const t = L("tasks").find(x => x.id === b.dataset.ftdel); if (t) { put("tasks", Object.assign({}, t, { del: true })); b.closest(".row").remove() } })
  $$("[data-fwish]", s.el).forEach(b => b.onclick = () => { toWish(b.dataset.fwish); b.outerHTML = '<span class="tag">в моих желаниях</span>' })
}
const WD7S = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]
function praise(k, tl, les) {
  const n = tl.filter(x => x.st === "ok").length, saved = L("money").some(m => m.kid === k.id && m.jar === "save" && m.amount < 0 && m.kind !== "dream" && m.at > +addDays(new Date(), -7))
  if (!n) return `${iziName()}: на этой неделе ${short(k.name)} пока ничего не отметил. Можно вместе выбрать одно простое дело на завтра.`
  return `${iziName()}: за неделю ${n} ${plural(n, "отметка", "отметки", "отметок")}${les ? `, ${les} ${plural(les, "урок", "урока", "уроков")}` : ""}${saved ? "" : ", копилку «Коплю» не трогал"}. Хороший повод похвалить.`
}
function toWish(did) {
  const d = L("dreams").find(x => x.id === did), k = d && member(d.kid); if (!d) return
  if (mineWish(d)) return toast("Уже в ваших желаниях")
  upsert("goals", { id: uid("w"), date: Date.now(), kind: "wish", title: `${short(k && k.name)}: ${d.title}`, from: d.id }); save()
  toast("Добавлено в ваши желания"); if (!stack.length) render()
}
async function taskForm(kid, pay) {
  const k = member(kid), cur = kcur(kid)
  const s = sheet(`<h3>${pay ? "Дело за деньги" : "Новое дело"} · ${esc(short(k.name))}</h3>
    <div class="field"><label>Что сделать</label><input id="ft-t" placeholder="${pay ? "Полить сад" : "Почистить зубы, собрать рюкзак…"}"></div>
    ${pay ? `<div class="field"><label>Сколько платим, ${esc(cur)}</label><input id="ft-p" type="number" inputmode="numeric" value="50"></div>` : `<div class="field"><label>Звёзд</label><div class="chips">${[5, 10, 15, 20].map(n => `<button class="chip ${n === 5 ? "on" : ""}" data-st="${n}">${n}</button>`).join("")}</div></div>
    <div class="field"><label>Когда</label><input id="ft-w" placeholder="утро, до школы, перед сном"></div>`}
    <div class="field"><label>Дни</label><div class="chips">${WD7S.map((d, i) => `<button class="chip on" data-d="${i + 1}">${d}</button>`).join("")}</div></div>
    ${pay ? "" : `<label class="row" style="gap:10px"><input type="checkbox" id="ft-c"> Нужна проверка взрослым</label>`}
    <div class="btns"><button class="btn" data-a="ai">Пусть ${esc(iziName())} предложит</button><button class="btn primary" data-a="ok">Добавить</button></div>`)
  let stars = 5
  $$("[data-st]", s.el).forEach(b => b.onclick = () => { stars = +b.dataset.st; $$("[data-st]", s.el).forEach(x => x.classList.toggle("on", x === b)) })
  $$("[data-d]", s.el).forEach(b => b.onclick = () => b.classList.toggle("on"))
  $('[data-a="ai"]', s.el).onclick = () => { s.close(); setTab("chat"); setTimeout(() => chatSend(`Предложи 5 простых ежедневных дел для ${k.name}${k.age ? ", " + k.age + " лет" : ""}, за которые давать звёзды в детском режиме IZIDAY. Коротко, списком, с количеством звёзд (5–20). Добавлю их сам в «Семье».`), 60) }
  $('[data-a="ok"]', s.el).onclick = () => { const t = $("#ft-t", s.el).value.trim(); if (!t) return toast("Напишите, что сделать")
    const days = $$("[data-d].on", s.el).map(b => +b.dataset.d)
    put("tasks", { id: uid("ft"), kid, title: t.slice(0, 60), ic: taskIc(t), stars: pay ? 0 : stars, pay: pay ? Math.max(1, Math.round(+$("#ft-p", s.el).value || 0)) : 0, check: pay ? true : $("#ft-c", s.el).checked, when: pay ? "" : $("#ft-w", s.el).value.trim().slice(0, 30), days: days.length === 7 ? [] : days, at: Date.now() })
    s.close(); toast("Добавлено"); kidSheet(kid) }
}
async function moneyForm(kid) {
  const k = member(kid), st = kset(kid), cur = kcur(kid)
  const s = sheet(`<h3>Деньги · ${esc(short(k.name))}</h3>
    <div class="field"><label>Карманные, ${esc(cur)} (0 — без карманных)</label><input id="fm-p" type="number" inputmode="numeric" value="${st.pocket || ""}" placeholder="500"></div>
    <div class="field"><label>День</label><div class="chips">${WD7S.map((d, i) => `<button class="chip ${+st.wd === i + 1 ? "on" : ""}" data-d="${i + 1}">${d}</button>`).join("")}</div></div>
    <div class="field"><label>Раскладка, %: Трачу · Коплю · Делюсь</label><div class="row" style="gap:8px">${st.split.map((v, i) => `<input class="fm-s" type="number" inputmode="numeric" value="${v}" style="width:30%">`).join("")}</div></div>
    <div class="field"><label>Покупки без спроса — до, ${esc(cur)}</label><input id="fm-l" type="number" inputmode="numeric" value="${st.limit}"></div>
    ${typeof CURS !== "undefined" ? `<div class="field"><label>Валюта копилок</label><select id="fm-c">${CURS.map(c => `<option value="${c[0]}" ${c[0] === (st.cur || baseCur()) ? "selected" : ""}>${esc(c[1] + "  " + c[2])}</option>`).join("")}</select></div>` : ""}
    <div class="btns"><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  let day = +st.wd
  $$("[data-d]", s.el).forEach(b => b.onclick = () => { day = +b.dataset.d; $$("[data-d]", s.el).forEach(x => x.classList.toggle("on", x === b)) })
  $('[data-a="ok"]', s.el).onclick = () => {
    const sp = $$(".fm-s", s.el).map(x => Math.max(0, Math.round(+x.value || 0)))
    if (sp[0] + sp[1] + sp[2] !== 100) return toast("Раскладка должна давать 100%")
    const pocket = Math.max(0, Math.round(+$("#fm-p", s.el).value || 0))
    const v = { pocket, wd: day, split: sp, limit: Math.max(0, Math.round(+$("#fm-l", s.el).value || 0)), ...($("#fm-c", s.el) ? { cur: $("#fm-c", s.el).value } : {}), since: pocket && !st.since ? today() : st.since || "" }
    const f = D.fam.data; f.set = f.set || {}; f.set[kid] = Object.assign({}, f.set[kid] || {}, v)
    s.close(); push(true, { set: { [kid]: v } }); toast("Сохранено")
  }
}
async function goalForm() {
  const s = sheet(`<h3>Семейная цель</h3><div class="msg">Цель — общая награда, которую семья получает за баллы: взрослые — из своих дел, дети — звёздами ×${KID_X}.</div>
    <div class="field"><label>Что получим</label><input id="fg-t" placeholder="Аквапарк всей семьёй"></div>
    <div class="field"><label>Сколько баллов</label><div class="chips">${[1000, 3000, 5000, 15000].map(n => `<button class="chip ${n === 3000 ? "on" : ""}" data-n="${n}">${num(n)}</button>`).join("")}</div></div>
    <div class="field"><label>Срок (необязательно)</label><input id="fg-d" type="date"></div>
    <label class="row" style="gap:10px"><input type="checkbox" id="fg-r"> Повторять каждый раз (например, кино каждые 1 000)</label>
    <div class="msg" id="fg-h"></div><div class="btns"><button class="btn primary" data-a="ok">Поставить цель</button></div>`)
  let n = 3000
  const hint = () => { const pace = Math.max(1, sumSince(dayKey(addDays(sod(new Date()), -13))).total / 14); $("#fg-h", s.el).textContent = `В вашем темпе (${num(pace)} в день) это примерно ${Math.ceil(n / pace)} ${plural(Math.ceil(n / pace), "день", "дня", "дней")}.` }
  $$("[data-n]", s.el).forEach(b => b.onclick = () => { n = +b.dataset.n; $$("[data-n]", s.el).forEach(x => x.classList.toggle("on", x === b)); hint() }); hint()
  $('[data-a="ok"]', s.el).onclick = () => { const t = $("#fg-t", s.el).value.trim(); if (!t) return toast("Напишите, что получим")
    put("goals", { id: uid("fg"), title: t.slice(0, 50), target: n, due: $("#fg-d", s.el).value || "", repeat: $("#fg-r", s.el).checked, start: today(), date: Date.now(), by: meId(), ic: goalIc(t)[0] })
    s.close(); render() }
}
async function goalOpen(id) {
  const g = L("goals").find(x => x.id === id); if (!g) return
  const p = goalProg(g), by = sumSince(g.start || "0000").by
  const v = await ui.confirm(g.title, `<div class="msg">${num(p.have)} из ${num(p.need)} баллов${g.repeat ? " · повторяется" : ""}. ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${esc(short((member(m) || {}).name || "?"))} ${num(n)}`).join(" · ")}</div>`, isAdult() ? ["Убрать цель", "Закрыть"] : ["Закрыть"])
  if (v === "Убрать цель") { put("goals", Object.assign({}, g, { del: true })); render() }
}
// ───────────── Создать, пригласить, вступить ─────────────
async function famNew() {
  if (!D.conn || !D.conn.hook) return ui.info("Нужна таблица", "Семья хранится в вашей Google Таблице. Сначала подключите приложение к виджету.")
  const me = await ui.ask("Как вас подписать?", "Это имя увидят все в семье.", D.gamiName || "", { placeholder: "Например: Папа или Ильдар" }); if (!me) return
  const name = await ui.ask("Название семьи", "", "Наша семья") || "Семья"
  toast("Создаю семью…")
  const r = await post(D.conn.hook, { op: "new", name }, D.conn.secret)
  if (!r || !r.ok || !r.family) return ui.info("Семья пока не создаётся", r && r.net ? `Не дозвался до таблицы (${r.error}), хотя пробовал трижды. Проверьте интернет и нажмите ещё раз.` : r && r.error ? `Таблица ответила: ${r.error}` : r && r.ok ? "В таблице ещё старая версия скрипта — после её обновления семья заработает." : "Нет связи с таблицей. Попробуйте позже.")
  D.fam = { url: D.conn.hook, code: r.family.code, id: uid("m"), role: "adult", name: me, owner: true, data: r.family, at: 0, out: {}, seen: {}, me: { color: COLORS[0], owner: true } }
  save(false); await push(true); await shareKey(true); render(); shareSheet(true)
}
// Взрослый без своего ключа — к Claude через общий ключ семьи
const keyOn = () => famOn() && D.fam.role !== "kid" && !!D.fam.key
async function ai(body, signal) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 120000)
  if (signal) signal.addEventListener("abort", () => ctl.abort())
  try {
    const r = await fetch(D.fam.url, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, credentials: "omit", cache: "no-store", signal: ctl.signal,
      body: JSON.stringify({ family: { op: "ai", code: D.fam.code, id: D.fam.id, body } }) })
    return await r.json()
  } finally { clearTimeout(t) }
}
// Свой ключ — в «Настройках»: три шага, проверка и сохранение только на этом телефоне
function keyCard() {
  const src = D.conn && D.conn.friend ? "общий ключ IZIDAY" : D.conn && D.conn.key ? "из виджета" : D.myKey ? "свой, вставлен вручную" : keyOn() ? `общий ключ семьи «${F().name || D.fam.fname || ""}»` : ""
  return `<div class="card fcard" id="fkey"><h2>Ключ Claude</h2><div class="row"><span class="ftile" style="background:${src ? "#0A9F6E1F" : "#FF9F0A1F"}">${ic(src ? "check" : "bulb", 22, src ? "#0A9F6E" : "#FF9F0A")}</span>
    <div class="grow"><div class="t">${src ? "Подключён" : "Не подключён"}</div><div class="s">${src ? esc(src) : `без ключа работает всё, кроме разговора с ${esc(iziName())} и калорий по фото`}</div></div>
    ${D.conn && D.conn.key ? "" : D.myKey ? `<button class="btn small" data-f="keydel">Убрать</button>` : `<button class="btn small primary" data-f="keyadd">Подключить</button>`}</div>
    ${!src || D.myKey ? `<div class="muted small" style="margin-top:8px">Ключ хранится только на этом телефоне. Им пользуетесь вы и ваша семья, если вы её создали, — больше никто.</div>` : ""}</div>`
}
async function keyAdd() {
  const s = sheet(`<h3>Свой ключ Claude</h3><div class="msg">Три шага, около двух минут.</div>
    <div class="fsteps"><div><b>1</b>Откройте сайт Anthropic и войдите (можно через Google).</div><div><b>2</b>Нажмите «Create Key», назовите «IZIDAY» и скопируйте ключ.</div><div><b>3</b>Вставьте его сюда — ${esc(iziName())} проверит, что он работает.</div></div>
    <div class="btns"><button class="btn" data-a="open">${ic("link", 16)} Открыть сайт</button></div>
    <div class="field"><label>Ключ</label><input id="fk-v" placeholder="sk-…" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
    <div class="btns"><button class="btn" data-a="paste">Вставить</button><button class="btn primary" data-a="ok">Проверить и сохранить</button></div><div class="msg" id="fk-m"></div>`)
  const inp = $("#fk-v", s.el), msg = $("#fk-m", s.el)
  $('[data-a="open"]', s.el).onclick = () => window.open("https://console.anthropic.com/settings/keys", "_blank")
  $('[data-a="paste"]', s.el).onclick = async () => { try { inp.value = (await navigator.clipboard.readText()).trim() } catch (e) { inp.focus() } }
  $('[data-a="ok"]', s.el).onclick = async () => {
    const k = inp.value.trim()
    if (!/^sk-an[t]-[A-Za-z0-9_-]{20,}$/.test(k)) { msg.textContent = "Это не похоже на ключ: он начинается с «sk-» и довольно длинный"; return }
    msg.textContent = "Проверяю…"
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": k, "anthropic-version": "2023-06-01", "content-type": "application/json", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: core.CONFIG.agentModel || "claude-sonnet-5-5", max_tokens: 5, messages: [{ role: "user", content: "ok" }] }) }).then(x => x.json())
      if (r.error) { msg.textContent = r.error.type === "authentication_error" ? "Ключ не подошёл. Скопируйте его ещё раз целиком." : /credit|billing/i.test(r.error.message || "") ? "Ключ верный, но на счёте Anthropic нет денег: пополните баланс в разделе Billing." : "Anthropic ответил: " + r.error.message; return }
    } catch (e) { msg.textContent = "Нет связи — попробуйте ещё раз."; return }
    D.myKey = k; save(false); s.close(); toast("Ключ подключён"); render()
  }
}
// Общий ключ Claude: детям — чат с Изи через таблицу хозяина семьи; ключ лежит в скрипте таблицы, телефонам не виден
async function shareKey(on) {
  if (!famOn() || !D.fam.owner || !D.conn || !D.conn.hook) return
  const r = await post(D.conn.hook, { op: "key", code: D.fam.code, key: on && D.conn.key ? D.conn.key : "", model: core.CONFIG.agentModel || "claude-sonnet-5-5" }, D.conn.secret)
  if (r && r.ok) { D.fam.key = !!r.key; save(false) } else if (on) toast("Общий ключ не включился: " + ((r && r.error) || "нет связи"))
  if (!stack.length) render()
}
async function kidAdd() {
  const name = await ui.ask("Как зовут ребёнка?", "", "", { placeholder: "Имя" }); if (!name) return
  const age = Math.round(+(await ui.ask(`Сколько лет ${name}?`, "8–13 — детский режим, 14–17 — обычное приложение в семье.", "", { type: "number" })) || 0); if (!age) return
  const id = uid("k"), role = roleOf(age), color = COLORS[(members().length) % COLORS.length]
  D.fam.data.members[id] = { name, age, role, color, joined: Date.now(), pts: {}, at: 0 }
  await push(true, { add: [{ id, name, age, role, color }] })
  render(); orbInvite(member(id) || { id, name, role })
}
function link(m) { return location.origin + location.pathname + "#fam=" + btoa(unescape(encodeURIComponent(JSON.stringify(Object.assign({ u: D.fam.url, c: D.fam.code, n: F().name || D.fam.fname || "Семья" }, m ? { m: m.id, r: m.role, nm: m.name } : {}))))).replace(/=+$/, "") }
async function invite(m) {
  const url = link(m && m.id ? m : null), who = m && m.name ? short(m.name) : ""
  const text = m && m.id ? `${who}, это твой вход в IZIDAY. Открой ссылку на своём телефоне: ${url}` : `Присоединяйся к нашей семье в IZIDAY: общие цели и баллы. Открой ссылку: ${url}`
  try { if (navigator.share) return await navigator.share({ title: "Семья в IZIDAY", text }) } catch (e) { if (e && e.name === "AbortError") return }
  try { await navigator.clipboard.writeText(text); toast("Ссылка скопирована") } catch (e) { ui.info("Ссылка-приглашение", url) }
}
function parseLink(code) {
  let x; try { x = JSON.parse(decodeURIComponent(escape(atob(code.replace(/-/g, "+").replace(/_/g, "/"))))) } catch (e) { return null }
  return x && x.u && x.c && /^https:\/\/script\.google\.com\//.test(x.u) ? x : null
}
async function join() {
  const code = pendingFam; pendingFam = null
  if (!code) return
  const x = parseLink(code); if (!x) return toast("Ссылка на семью повреждена")
  if (famOn() && D.fam.code === x.c && (!x.m || D.fam.id === x.m)) { if (!kidMode()) { setTab("plans"); openFam() } return }
  if (famOn() && D.fam.code !== x.c && await ui.confirm("Перейти в другую семью?", `<div class="msg">Сейчас вы в семье «${esc(D.fam.fname || "")}».</div>`, ["Отмена", "Перейти"]) !== "Перейти") return
  if (x.m && x.r === "kid") {
    D.fam = { url: x.u, code: x.c, id: x.m, role: "kid", name: x.nm || "", fname: x.n, data: null, at: 0, out: {}, seen: {} }
    D.who = "kid"; save(false); await push(true); render(); window.scrollTo(0, 0)
    return
  }
  const me = x.m ? x.nm : await ui.ask(`Вступить в семью «${x.n || "Семья"}»?`, "Как вас подписать?", D.gamiName || "", { placeholder: "Например: Мама", ok: "Вступить" })
  if (!me) return
  D.fam = { url: x.u, code: x.c, id: x.m || uid("m"), role: x.r || "adult", name: me, fname: x.n, data: null, at: 0, out: {}, seen: {}, me: x.m ? null : { color: COLORS[1] } }
  if (D.who === "kid") D.who = "adult"
  save(false); await push(true); if (D.fam.err) toast(`Семья: ${D.fam.err}`)
  setTab("plans"); openFam(); if (!D.fam.shareAsked) setTimeout(() => shareSheet(true), 400)
}
// Вход по ссылке вручную («У меня есть ссылка»)
async function famPaste() {
  if (famOn()) return
  const v = await ui.ask("Ссылка-приглашение", "Вставь ссылку, которую прислали мама или папа.", "", { placeholder: "https://…#fam=…", ok: "Войти" })
  if (!v) return
  const m = v.match(/fam=([A-Za-z0-9+/=_-]+)/); if (!m) return toast("Это не ссылка на семью")
  pendingFam = m[1]; join()
}
// Вход в семью из тура новичка после «Ребёнок»: шар Изи с телефона родителя или ссылка
window.famJoin = async function () {
  if (famOn()) return
  if (!scanCan()) return famPaste()
  const v = await ui.choose("Вход в семью", "Попроси маму или папу показать шар Изи: «Планы → Семья».", ["Сканировать шар", "У меня есть ссылка"])
  if (v === 0) scan(); else if (v === 1) famPaste()
}

// ───────────── Код-шар: приглашение по шару Изи ─────────────
// Главный телефон показывает шар с кольцами дуг (orbcode.js), второй наводит на него камеру в IZIDAY. В шаре — короткий
// одноразовый код; само приглашение 10 минут лежит на общем сервере IZIDAY (Friends.gs inv_) и отдаётся один раз.
const invHook = () => { try { const h = window.FRIEND && FRIEND.hook && FRIEND.hook(); return /^https:\/\/script\.google\.com\//.test(h || "") ? h : "" } catch (e) { return "" } }
async function invCall(q) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000)
  try {
    const r = await fetch(invHook(), { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, credentials: "omit", cache: "no-store", signal: ctl.signal, body: JSON.stringify({ inv: q }) })
    return await r.json()
  } catch (e) { return { ok: false, error: "нет связи", net: true } } finally { clearTimeout(t) }
}
const hexBytes = h => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)))
const orbBox = (cls = "") => `<div class="ocode ${cls}"><i class="ocode-glow"></i><canvas class="ocode-c"></canvas><i class="ocode-shine"></i><b class="izi-orb ocode-orb"></b></div>`
function orbPaint(box, token) {
  const c = $(".ocode-c", box), d = Math.min(3, devicePixelRatio || 1), px = Math.round((box.clientWidth || 280) * d)
  c.width = c.height = px
  const P = typeof iziCol === "function" ? iziCol() : null
  ORBCODE.draw(c.getContext("2d"), px, ORBCODE.encode(hexBytes(token)), P ? { a: P[4], b: P[3] } : {})
}
async function orbInvite(m) {
  if (!invHook() || !window.ORBCODE) return invite(m)
  const who = m && m.name ? short(m.name) : ""
  let alive = true, tm = 0, token = "", until = 0, n = 0
  const s = sheet(`<h3>${who ? `${esc(who)}: вход в семью` : "Пригласить в семью"}</h3>${orbBox("wait")}
    <div class="ocode-t">Готовлю шар…</div>
    <div class="msg ocode-how">На втором телефоне откройте IZIDAY и нажмите «Сканировать шар».</div>
    <div class="btns"><button class="btn" data-a="link">${ic("link", 16)} Отправить ссылкой</button></div>`, { onClose: () => { alive = false; clearTimeout(tm) } })
  s.el.classList.add("ocode-sheet")
  const box = $(".ocode", s.el), txt = $(".ocode-t", s.el)
  $('[data-a="link"]', s.el).onclick = () => invite(m)
  const make = async () => {
    token = ""; box.classList.add("wait"); txt.textContent = "Готовлю шар…"
    const r = await invCall({ op: "new", p: link(m && m.id ? m : null).split("#fam=")[1] })
    if (!alive) return
    if (!r || !r.ok || !r.token) { txt.textContent = r && r.net ? "Нет связи. Шар появится, когда вернётся интернет." : `Шар не получился${r && r.error ? `: ${r.error}` : ""}. Отправьте приглашение ссылкой.`; if (r && r.net) tm = setTimeout(make, 5000); return }
    token = r.token; until = Date.now() + (r.ttl || 600) * 1000 - 5000
    orbPaint(box, token); box.classList.remove("wait"); tick()
  }
  const tick = async () => {
    if (!alive || !token) return
    const left = Math.max(0, Math.round((until - Date.now()) / 1000))
    if (!left) return make()
    txt.textContent = `Шар действует ещё ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`
    if (++n % 2 === 0 && document.visibilityState === "visible") {
      const t0 = token, r = await invCall({ op: "stat", token: t0 })
      if (!alive || t0 !== token) return
      if (r && r.ok && r.used) return done()
    }
    tm = setTimeout(tick, 1000)
  }
  const done = async () => {
    token = ""; box.classList.add("ok"); txt.textContent = who ? `${who} в семье` : "Подключено"
    try { if (navigator.vibrate) navigator.vibrate([20, 60, 40]) } catch (e) {}
    const how = $(".ocode-how", s.el); if (how) how.textContent = "Шар отсканирован."
    setTimeout(() => push(true), 2500)
    tm = setTimeout(() => { if (alive) s.close(); push(true) }, 3600)
  }
  make()
}
// Сканер шара: своя камера в приложении. Смахнуть вниз — закрыть
const scanCan = () => !!(invHook() && window.ORBCODE && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
let scanOn = false
async function scan() {
  if (scanOn) return
  if (famOn() && kidMode()) return
  if (!scanCan()) { await ui.info("Сканер недоступен", "На этом телефоне камера из приложения не открывается. Попросите прислать приглашение ссылкой."); return famPaste() }
  scanOn = true
  const el = document.createElement("div"); el.className = "oscan"
  el.innerHTML = `<video playsinline muted autoplay></video><div class="oscan-aim"><i></i></div>
    <div class="oscan-top">Смахните вниз — закрыть</div>
    <div class="oscan-bot"><b>Наведите на шар Изи</b><span>Шар показывает тот, кто приглашает: «Планы → Семья».</span></div>
    <div class="oscan-ok"><div class="ocode solo"><i class="ocode-glow"></i><i class="ocode-shine"></i><b class="izi-orb ocode-orb"></b></div><b>Готово</b></div>`
  document.body.append(el)
  const v = $("video", el), msg = $(".oscan-bot b", el), sub = $(".oscan-bot span", el)
  let stream = null, tm = 0, busy = false
  const tried = new Set(), cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true })
  const close = () => { if (!scanOn) return; scanOn = false; clearTimeout(tm); if (stream) stream.getTracks().forEach(t => t.stop()); el.classList.remove("show"); setTimeout(() => el.remove(), 320) }
  el.addEventListener("izi-back", close)
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
    v.srcObject = stream; try { await v.play() } catch (e) {}
  } catch (e) {
    scanOn = false; el.remove()
    await ui.info("Камера недоступна", (typeof IS_DROID !== "undefined" && IS_DROID ? "Разрешите камеру: Настройки телефона → Приложения → IZIDAY (или Chrome) → Разрешения → Камера." : "Разрешите камеру: Настройки → IZIDAY (или Safari) → Камера → «Разрешить».") + " Или попросите прислать приглашение ссылкой.")
    return
  }
  requestAnimationFrame(() => el.classList.add("show"))
  let y0 = null, dy = 0
  el.addEventListener("touchstart", e => { y0 = e.touches[0].clientY; dy = 0; el.style.transition = "none" }, { passive: true })
  el.addEventListener("touchmove", e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); el.style.transform = `translateY(${dy}px)` }, { passive: true })
  el.addEventListener("touchend", () => { if (y0 == null) return; y0 = null; el.style.transition = ""; el.style.transform = ""; if (dy > 110) close() })
  const say = (a, b) => { msg.textContent = a; if (b != null) sub.textContent = b }
  const loop = async () => {
    if (!scanOn) return
    let wait = 140
    if (!busy && v.videoWidth) {
      const k = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight)), W = Math.round(v.videoWidth * k), H = Math.round(v.videoHeight * k)
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H }
      cx.drawImage(v, 0, 0, W, H)
      let tok = null
      try { tok = ORBCODE.decode(ORBCODE.gray(cx.getImageData(0, 0, W, H).data, W, H), W, H) } catch (e) { console.error("scan", e) }
      const hex = tok && ORBCODE.str(tok)
      if (hex && !tried.has(hex)) {
        busy = true; tried.add(hex); el.classList.add("found"); say("Шар найден", "Подключаю…")
        const r = await invCall({ op: "get", token: hex })
        if (!scanOn) return
        if (r && r.ok && r.p && parseLink(r.p)) {
          el.classList.add("ok"); try { if (navigator.vibrate) navigator.vibrate([20, 60, 40]) } catch (e) {}
          const x = parseLink(r.p); $(".oscan-ok > b", el).textContent = x.n ? `Семья «${x.n}»` : "Готово"
          tm = setTimeout(() => { close(); pendingFam = r.p; join() }, 1700)
          return
        }
        el.classList.remove("found"); busy = false
        if (r && r.net) tried.delete(hex)
        say(r && r.net ? "Нет связи" : "Этот шар уже не действует", r && r.net ? "Проверьте интернет, сканер попробует ещё раз." : "Попросите показать шар заново: он обновится сам.")
        wait = 1800
      }
    }
    tm = setTimeout(loop, wait)
  }
  loop()
}
async function leave() {
  if (await ui.confirm("Выйти из семьи?", `<div class="msg">Ваши баллы перестанут идти в семейный счёт.</div>`, ["Отмена", "Выйти"]) !== "Выйти") return
  post(D.fam.url, { op: "leave", code: D.fam.code, id: D.fam.id }); D.fam = null; save(false); render()
}

// ───────────── Встраивание в экраны ─────────────
function openFam() { plansF = "fam"; if (tab !== "plans") setTab("plans"); else render(); scrollView(false) }
const FDO = { keyadd: () => keyAdd(), keydel: () => { delete D.myKey; save(false); render(); toast("Ключ убран") }, keyon: () => shareKey(true), keyoff: () => shareKey(false), new: () => famNew(), paste: () => famPaste(), scan: () => scan(), invite: () => orbInvite(null), kid: () => kidAdd(), goal: () => goalForm(), leave: () => leave(), open: () => openFam() }
function bindFam(v) {
  $$("[data-f]", v).forEach(b => b.onclick = e => { e.stopPropagation(); const f = FDO[b.dataset.f]; if (f) f() })
  shareBind(v)
  $$("[data-fm]", v).forEach(b => b.onclick = () => kidSheet(b.dataset.fm))
  $$("[data-fg]", v).forEach(b => b.onclick = () => goalOpen(b.dataset.fg))
  $$("[data-fwish]", v).forEach(b => b.onclick = e => { e.stopPropagation(); toWish(b.dataset.fwish) })
  const w = waits()
  $$("[data-fyes]", v).forEach(b => b.onclick = () => approve(w[+b.dataset.fyes], true))
  $$("[data-fno]", v).forEach(b => b.onclick = () => approve(w[+b.dataset.fno], false))
}
function wrap() {
  PLAN_F.push(["fam", "Семья"])
  const plans0 = renderPlans
  renderPlans = function () {
    const html = plans0.apply(this, arguments)
    if (window.FEAT && !FEAT.on("family")) return html   // «Семья» выключена в «Функциях» (feat.js)
    if (plansF === "fam") { const i = html.indexOf("</div>") + 6; return html.slice(0, i) + famPage() }
    if (plansF === "all") { try { return html + famPage() } catch (e) { console.error("fam", e) } }   // семья и в общем списке, в конце
    return html
  }
  const top0 = todayTop
  todayTop = function () {
    const n = isAdult() ? waits().length : 0
    return (n ? `<button class="card fnote" data-f="open"><span class="ftile" style="background:#0A9F6E1F">${ic("users", 22, "#0A9F6E")}</span><div class="grow"><div class="t">Семья: ${n} ${plural(n, "дело ждёт", "дела ждут", "дел ждут")} ${waits().every(w => w.x.kind === "prop") ? "ответа" : "проверки"}</div><div class="s">${esc(waits().slice(0, 2).map(w => short((member(w.x.kid) || {}).name) + " · " + (w.t === "money" ? w.x.note : w.x.kind === "prop" ? "просит " + w.x.title : w.x.title)).join(", "))}</div></div>${ic("chev", 18, "#8A8A8E")}</button>` : "") + top0.apply(this, arguments)
  }
  const more0 = renderMore
  renderMore = function () { const html = more0.apply(this, arguments), i = html.indexOf('<div class="card"><h2>Связь с виджетом'); return i < 0 ? keyCard() + html : html.slice(0, i) + keyCard() + html.slice(i) }
  const render0 = render
  render = function () {
    const kid = kidMode()
    document.body.classList.toggle("kidm", kid)
    if (kid) {
      const v = $("#view"), html = kidRender()
      if (v.dataset.kh !== html || !v.firstChild) { v.innerHTML = html; v.dataset.kh = html; kidBind(v) }
      kidNav(); return
    }
    const n = $("#knav"); if (n) n.remove()
    delete $("#view").dataset.kh
    const out = render0.apply(this, arguments)
    try { bindFam($("#view")) } catch (e) { console.error("family", e) }
    return out
  }
  // Изи знает о семье: помогает с целями и делами детей
  const sys0 = agentSystem
  agentSystem = function () {
    let s = sys0.apply(this, arguments)
    if (famOn() && !kidMode()) {
      const ks = kids().map(k => `${k.name}${k.age ? ` (${k.age})` : ""}: звёзд ${kidStars(k.id)}, дел ${kidTasks(k.id).length}${mainDream(k.id) ? `, мечта «${mainDream(k.id).title}»` : ""}`).join("; ")
      const g = famGoals().filter(x => !x.done).map(x => { const p = goalProg(x); return `${x.title} ${p.have}/${p.need}` }).join("; ")
      s += `\n- Семья в IZIDAY: ${members().length} чел.${ks ? `; дети — ${ks}` : ""}${g ? `; семейные цели — ${g}` : ""}. Звёзды детей идут в семейные баллы ×${KID_X}. Дела детей, копилки и цели родитель настраивает в «Планы → Семья». С детьми и их мечтами говори тепло и без нравоучений.`
    }
    return s
  }
}
function init() {
  if (typeof D === "undefined" || typeof render !== "function") return
  wrap()
  render()
  window.addEventListener("izi:who", () => render())   // ссылку для входа ребёнка спрашивает сам тур (onb.js → window.famJoin)
  setTimeout(() => push(false), 1500)
  setInterval(() => { if (document.visibilityState === "visible") push(false) }, 60e3)
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") push(Date.now() - ((D.fam && D.fam.at) || 0) > 20e3) })
  if (pendingFam) setTimeout(join, 1000)
  // семья была до «Что делим с семьёй»: календарь оставляем как был (включён), общий бюджет — если уже отмечали общее; окно — один раз
  if (famOn() && D.fam.role !== "kid" && !D.fam.shareAsked) {
    if (!D.fam.share) D.fam.share = { cal: 1, money: live(D.money).some(e => e.shared) || live(D.goals).some(g => g.kind === "jar" && g.shared) ? 1 : 0 }
    save(false); setTimeout(() => { if (famOn() && !D.fam.shareAsked && !stack.length) shareSheet("old") }, 2500)
  }
  window.FAM = { scan, orbInvite, on: famOn, share, shareSheet, members, meId, isAdult, L, tasksOn, COLORS, keyOn, ai, link, kidSheet, join, push, put, famDays, sumSince, goalProg, jars, kidStars, waits, approve, kidMode, openFam, LESSONS, lesson, credit, pocketTick }
}
})()
