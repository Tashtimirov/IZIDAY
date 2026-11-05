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
  wand: '<path d="M4 20L15 9M14 4v3M19 9h-3M17.5 5.5l-2 2M12 3l.5 1.5M20 11l1.5.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', link: '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/>',
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
const F = () => (D.fam && D.fam.data) || { members: {}, set: {}, tasks: [], log: [], goals: [], money: [], dreams: [] }
const L = k => (F()[k] || []).filter(x => x && !x.del)
const meId = () => D.fam && D.fam.id
const kidMode = () => (famOn() && D.fam.role === "kid") || (!famOn() && D.who === "kid")
const isAdult = () => famOn() && D.fam.role === "adult"
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
async function post(url, q, secret) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000)
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, credentials: "omit", cache: "no-store", signal: ctl.signal,
      body: JSON.stringify(Object.assign(secret ? { secret } : {}, { family: q })) })
    return await r.json()
  } catch (e) { return { ok: false, error: "нет связи" } } finally { clearTimeout(t) }
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
      for (const k in sent) D.fam.out[k] = (D.fam.out[k] || []).filter(x => !sent[k].has(x.id + ":" + x.u))
      const f = r.family
      for (const k in D.fam.out) for (const x of D.fam.out[k] || []) { const arr = f[k] || (f[k] = []), i = arr.findIndex(y => y.id === x.id); if (i < 0) arr.push(x); else if ((arr[i].u || 0) <= x.u) arr[i] = x }
      D.fam.data = f; D.fam.at = Date.now(); D.fam.err = ""; D.fam.fname = f.name
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
  if (w.t === "log") {
    put("log", Object.assign({}, w.x, { st: yes ? "ok" : "no", by: meId() }))
    if (yes && w.x.pay) credit(w.x.kid, w.x.pay, "earn", w.x.title, "er:" + w.x.id)
  } else put("money", Object.assign({}, w.x, { st: yes ? "ok" : "no", by: meId() }))
  render()
}

// ───────────── Копилки ─────────────
const kset = kid => Object.assign({ pocket: 0, wd: 5, split: SPLIT, limit: 200 }, (F().set || {})[kid] || {})
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
  if (!famOn()) return kidNoFam()
  const me = member(meId()) || { name: D.fam.name || "Друг", age: 10 }
  const body = { day: kDay, learn: kLearn, money: kMoney, dreams: kDreams }[kTab](me)
  return `<div class="kd">${body}</div>`
}
function kHead(sub, title, right) { return `<div class="khd"><div class="grow"><div class="ks">${esc(sub)}</div><h1>${esc(title)}</h1></div>${right || ""}</div>` }
function kidNoFam() {
  return `<div class="kd"><div class="kempty">${orb(110)}<h1>Привет!</h1><p>Попроси маму или папу прислать тебе ссылку-приглашение в семью. Они найдут её в «Планы → Семья».</p>
  <button class="kbtn" data-k="paste">У меня есть ссылка</button><button class="klink" data-k="adult">Я взрослый</button></div></div>`
}
function kDay(me) {
  const d = new Date(), tasks = todayTasks(me.id), done = tasks.filter(t => { const l = logOf(me.id, t.id); return l && l.st !== "no" }).length
  const g = famGoals().find(x => !x.done), les = nextLesson(me.id)
  let h = kHead(`${core.cap(WDF[d.getDay()])}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`, `Привет, ${short(me.name)}!`, `<div class="kmy">${star(num(kidStars(me.id)))}<span>мои звёзды</span></div>`)
  h += `<div class="ksay">${orb(64)}<div class="kbub">${esc(kidTip(me, tasks, done))}</div></div>`
  h += `<div class="kcard"><h2>Мои дела <span>${done} из ${tasks.length}</span></h2>${tasks.map(t => kTask(me, t)).join("") || `<div class="kmuted">Сегодня дел нет. Попроси маму или папу добавить их в приложении.</div>`}</div>`
  if (g) { const p = goalProg(g), gi = goalIc(g.title), mine = sumSince(g.start || "0000").by[me.id] || 0
    h += `<div class="kcard kgoal"><h2>Семейная цель</h2><div class="krow"><div class="kgi">${ic(g.ic || gi[0], 30, gi[1])}</div><div class="grow"><b>${esc(g.title)}</b><div class="kmuted">${num(p.have)} из ${num(p.need)}${mine ? ` · ты принёс ${num(mine)}` : ""}</div></div></div><div class="kbar"><i style="width:${Math.round(p.p * 100)}%"></i></div></div>` }
  if (les) h += `<button class="kcard krow kles" data-kles="${les.id}"><div class="kplay">${ic("play", 24, "#fff")}</div><div class="grow"><b>Урок дня: «${esc(les.t)}»</b><div class="kmuted">3 минуты · +${LESSON_STARS} звёзд</div></div>${ic("chev", 22, "#A19BC7")}</button>`
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
  return `<button class="ktask ${st === "ok" ? "done" : ""}" data-ktask="${esc(t.id)}"><div class="kic" style="background:${c}22">${ic(n, 24, c)}</div>
  <div class="grow"><div class="kt">${esc(t.title)}</div><div class="km">${st === "wait" ? "ждёт проверки" : st === "no" ? "не засчитано — попробуй ещё" : esc(t.when || (t.check ? "проверит взрослый" : ""))}</div></div>
  <span class="kplus">${ic("star", 15, "#E89A00", 2.4)}+${t.stars || 5}</span><span class="kcb ${st}">${st === "ok" ? ic("check", 18, "#fff", 3) : st === "wait" ? ic("clock", 16, "#C98500") : ""}</span></button>`
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
  const j = jars(me.id), all = j.spend + j.save + j.share, s = kset(me.id), np = nextPocket(me.id), cur = core.CONFIG.currency || "฿"
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
  const ds = kidDreams(me.id), main = mainDream(me.id), bank = ds.filter(d => !d.main && !d.done), j = jars(me.id), cur = core.CONFIG.currency || "฿"
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
  paste: () => window.famJoin(), adult: () => { D.who = "adult"; save(false); render() },
  wish: async () => { const t = await ui.ask("Чего тебе хочется?", "Большое или маленькое — всё подходит.", "", { placeholder: "Например: лего-замок", ok: "В банку" }); if (!t) return
    put("dreams", { id: uid("dr"), kid: meId(), title: t.slice(0, 60), at: Date.now() }); burst(); render() },
  buy: () => buyForm(), hist: () => moneyHist(meId()),
}
function dreamTalk(d) {
  if (!d) return
  const s = sheet(`<div class="ksheet"><div class="ksay">${orb(60)}<div class="kbub">«${esc(d.title)}» — это желание или цель? Если сделать целью, придумаем шаги и посчитаем, сколько копить.</div></div>
    <div class="field"><label>Сколько стоит (если знаешь)</label><input id="kd-p" type="number" inputmode="numeric" placeholder="например, 4500"></div>
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
  const me = meId(), j = jars(me), s = kset(me), cur = core.CONFIG.currency || "฿"
  const t = await ui.ask("Что хочешь купить?", "", "", { placeholder: "Например: слайм", ok: "Дальше" }); if (!t) return
  const p = Math.round(+(await ui.ask("Сколько стоит?", `В копилке «Трачу» сейчас ${num(j.spend)} ${cur}.`, "", { type: "number", ok: "Дальше" })) || 0); if (!p) return
  if (p > j.spend) return ui.info("Пока не хватает", `В «Трачу» ${num(j.spend)} ${cur}, а нужно ${num(p)}. Можно подождать карманных, заработать на делах или записать это в банку желаний.`)
  const ask = p > (+s.limit || 0)
  const v = await ui.confirm(ask ? "Спросить взрослых?" : "Записать покупку?", `<div class="msg">${esc(t)} — ${num(p)} ${esc(cur)} из копилки «Трачу».${ask ? ` Покупки дороже ${num(s.limit)} ${esc(cur)} — с разрешения мамы или папы.` : ""}</div>`, ["Подожду", ask ? "Спросить" : "Купил"])
  if (!v || v === "Подожду") return
  put("money", { id: uid("mb"), kid: me, at: Date.now(), amount: -p, jar: "spend", kind: "buy", note: t.slice(0, 60), st: ask ? "wait" : "ok" })
  toast(ask ? "Спросил — ответ придёт сюда" : "Записано"); render()
}
function moneyHist(kid) {
  const cur = core.CONFIG.currency || "฿", l = L("money").filter(m => m.kid === kid).sort((a, b) => b.at - a.at).slice(0, 40)
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
function kidIzi() {
  const chat = D.kchat || (D.kchat = [])
  let busyK = false
  const s = sheet(`<div class="ksheet kchat"><div class="kchat-h">${orb(44)}<b>${esc(iziName())}</b></div><div class="kmsgs"></div>
    <div class="kin"><input id="kc-t" placeholder="Напиши ${esc(iziName())}…" enterkeyhint="send"><button class="ksend" aria-label="Отправить">${ic("chev", 22, "#fff", 3)}</button></div></div>`)
  s.el.classList.add("kid-sheet", "kfull")
  const box = $(".kmsgs", s.el), inp = $("#kc-t", s.el)
  const draw = () => {
    const l = chat.slice(-30)
    box.innerHTML = (l.length ? "" : `<div class="kmsg a">${esc(kidTipText())}</div><div class="kquick">${["Что мне сделать сейчас?", "Как быстрее накопить на мечту?", "Придумай мне цель на неделю"].map(q => `<button data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>`) +
      l.map(x => `<div class="kmsg ${x.role === "user" ? "u" : "a"}">${esc(x.content)}</div>`).join("") + (busyK ? `<div class="kmsg a kdots"><i></i><i></i><i></i></div>` : "")
    $$("[data-q]", box).forEach(b => b.onclick = () => send(b.dataset.q))
    box.scrollTop = box.scrollHeight
  }
  const send = async text => {
    text = String(text || "").trim(); if (!text || busyK) return
    chat.push({ role: "user", content: text.slice(0, 500), at: Date.now() }); inp.value = ""; busyK = true; draw()
    const r = await post(D.fam.url, { op: "ask", code: D.fam.code, id: D.fam.id, ctx: kidCtx(), messages: chat.slice(-12).map(x => ({ role: x.role, content: x.content })) })
    busyK = false
    const ans = r && r.ok && r.text ? r.text : r && r.error === "nokey" ? `Мама или папа ещё не включили для меня разговоры. А пока подсказка: ${kidTipText()}` : r && r.error === "limit" ? "На сегодня мы наболтались! Завтра продолжим. А пока можно пройти урок или отметить дела." : "Ой, связь пропала. Попробуй ещё раз чуть позже."
    chat.push({ role: "assistant", content: ans, at: Date.now() })
    while (chat.length > 60) chat.shift()
    save(false); draw()
  }
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
    <div class="btns" style="margin-top:12px"><button class="btn" data-f="paste">У меня есть ссылка</button><button class="btn primary" data-f="new">Создать семью</button></div></div>`
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
  if (adult && w.length) h += `<div class="card fcard" id="fwait"><h2>Ждут вашей проверки <span class="muted small">${w.length}</span></h2>${w.map((x, i) => { const m = member(x.x.kid) || {}, n = x.t === "money" ? "bag" : x.x.kind === "earn" ? "coins" : taskIc(x.x.title), c = icColor(n)
    return `<div class="row"><span class="ftile" style="background:${c}1F">${ic(n, 22, c)}</span><div class="grow"><div class="t">${esc(short(m.name))} · ${esc(x.t === "money" ? "хочет купить: " + x.x.note : x.x.title)}</div><div class="s">${x.t === "money" ? `${num(-x.x.amount)} ${esc(cur)} из «Трачу»` : x.x.pay ? `+${num(x.x.pay)} ${esc(cur)}` : `+${x.x.stars} звёзд`}${!sameDay(x.x.at, Date.now()) ? " · " + esc(dayName(new Date(x.x.at))) : ""}</div></div><button class="btn small" data-fno="${i}">Нет</button><button class="btn small primary" data-fyes="${i}">Да</button></div>` }).join("")}</div>`
  const gs = famGoals()
  h += `<div class="card fcard"><h2>Семейные цели<button class="act" data-f="goal">Добавить</button></h2>${gs.map(g => { const p = goalProg(g), gi = goalIc(g.title)
    return `<div class="row" data-fg="${esc(g.id)}"><span class="ftile" style="background:${gi[1]}1F">${ic(g.ic || gi[0], 22, gi[1])}</span><div class="grow"><div class="t">${esc(g.title)}${g.done ? " · достигнута" : ""}</div><div class="s">${g.repeat ? `каждые ${num(g.target)} баллов${p.times ? ` · было ${p.times} ${plural(p.times, "раз", "раза", "раз")}` : ""}` : `${num(p.have)} из ${num(g.target)} баллов${g.due ? " · до " + esc(g.due.split("-").reverse().slice(0, 2).join(".")) : ""}`}</div><div class="fgbar"><i style="width:${Math.round(p.p * 100)}%;background:${gi[1]}"></i></div></div></div>` }).join("") || `<div class="empty">Например: «Аквапарк всей семьёй» за 3 000 баллов или «Кино с попкорном» каждые 1 000.</div>`}</div>`
  const kd = kids().filter(k => mainDream(k.id) || kidDreams(k.id).length)
  if (kd.length) h += `<div class="card fcard"><h2>Мечты детей</h2>${kd.map(k => kidDreams(k.id).filter(d => !d.done).slice(0, 4).map(d => dreamRow(k, d)).join("")).join("")}</div>`
  if (D.fam.owner) h += `<div class="card fcard"><div class="row"><span class="ftile" style="background:#6A4BF21F">${ic("bulb", 22, "#6A4BF2")}</span><div class="grow"><div class="t">Чат детей с ${esc(iziName())}</div><div class="s">${D.fam.key ? "через ваш ключ Claude, до 30 сообщений в день на ребёнка; ключ детям не виден" : aiKey() ? "выключен — дети видят только подсказки" : "нужен ключ Claude в вашем приложении"}</div></div>${aiKey() ? `<button class="btn small ${D.fam.key ? "" : "primary"}" data-f="${D.fam.key ? "keyoff" : "keyon"}">${D.fam.key ? "Выключить" : "Включить"}</button>` : ""}</div></div>`
  h += `<div class="muted small" style="text-align:center;margin:4px 0 14px">Семья «${esc(F().name || D.fam.fname || "")}»${D.fam.err ? ` · ${esc(D.fam.err)}` : ""} · <button class="linkbtn" data-f="leave">Выйти</button></div>`
  return h
}
const MONTH_NOM_L = () => ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"][new Date().getMonth()]
const mineWish = d => live(D.goals).find(g => g.kind === "wish" && g.from === d.id)
function dreamRow(k, d) {
  const n = d.ic || taskIc(d.title), c = icColor(n), have = mineWish(d), cur = core.CONFIG.currency || "฿"
  return `<div class="row"><span class="ftile" style="background:${c}1F">${ic(n, 22, c)}</span><div class="grow"><div class="t">${esc(short(k.name))}: ${esc(d.title)}</div><div class="s">${d.main ? `главная мечта${d.price ? ` · ${num(Math.min(jars(k.id).save, d.price))} из ${num(d.price)} ${esc(cur)}` : ""}` : "в банке желаний"}</div></div>${have ? `<span class="tag">в моих желаниях</span>` : `<button class="btn small" data-fwish="${esc(d.id)}">К себе</button>`}</div>`
}
function kidSheet(id) {
  const k = member(id); if (!k) return
  if (id === meId() || k.role === "adult") return ui.info(k.name, k.role === "adult" ? "Взрослый: баллы приходят из его приложения IZIDAY." : "")
  const adult = isAdult(), w0 = dayKey(addDays(sod(new Date()), -6)), cur = core.CONFIG.currency || "฿"
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
  on("link", () => invite(k)); on("gift", async () => { const v = Math.round(+(await ui.ask("Сколько положить?", "Разложится по копилкам по раскладке ребёнка.", "", { type: "number" })) || 0); if (v > 0) { credit(id, v, "gift", "Подарок", uid("gf")); s.close(); toast("Положено") } })
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
  const k = member(kid), cur = core.CONFIG.currency || "฿"
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
  const k = member(kid), st = kset(kid), cur = core.CONFIG.currency || "฿"
  const s = sheet(`<h3>Деньги · ${esc(short(k.name))}</h3>
    <div class="field"><label>Карманные, ${esc(cur)} (0 — без карманных)</label><input id="fm-p" type="number" inputmode="numeric" value="${st.pocket || ""}" placeholder="500"></div>
    <div class="field"><label>День</label><div class="chips">${WD7S.map((d, i) => `<button class="chip ${+st.wd === i + 1 ? "on" : ""}" data-d="${i + 1}">${d}</button>`).join("")}</div></div>
    <div class="field"><label>Раскладка, %: Трачу · Коплю · Делюсь</label><div class="row" style="gap:8px">${st.split.map((v, i) => `<input class="fm-s" type="number" inputmode="numeric" value="${v}" style="width:30%">`).join("")}</div></div>
    <div class="field"><label>Покупки без спроса — до, ${esc(cur)}</label><input id="fm-l" type="number" inputmode="numeric" value="${st.limit}"></div>
    <div class="btns"><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  let day = +st.wd
  $$("[data-d]", s.el).forEach(b => b.onclick = () => { day = +b.dataset.d; $$("[data-d]", s.el).forEach(x => x.classList.toggle("on", x === b)) })
  $('[data-a="ok"]', s.el).onclick = () => {
    const sp = $$(".fm-s", s.el).map(x => Math.max(0, Math.round(+x.value || 0)))
    if (sp[0] + sp[1] + sp[2] !== 100) return toast("Раскладка должна давать 100%")
    const pocket = Math.max(0, Math.round(+$("#fm-p", s.el).value || 0))
    const v = { pocket, wd: day, split: sp, limit: Math.max(0, Math.round(+$("#fm-l", s.el).value || 0)), since: pocket && !st.since ? today() : st.since || "" }
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
  if (!r || !r.ok || !r.family) return ui.info("Семья пока не создаётся", r && r.error && r.error !== "нет связи" ? `Таблица ответила: ${r.error}` : r && r.ok ? "В таблице ещё старая версия скрипта — после её обновления семья заработает." : "Нет связи с таблицей. Попробуйте позже.")
  D.fam = { url: D.conn.hook, code: r.family.code, id: uid("m"), role: "adult", name: me, owner: true, data: r.family, at: 0, out: {}, seen: {}, me: { color: COLORS[0], owner: true } }
  save(false); await push(true); await shareKey(true); render()
}
// Общий ключ Claude: детям — чат с Изи через таблицу хозяина семьи; ключ лежит в скрипте таблицы, телефонам не виден
async function shareKey(on) {
  if (!famOn() || !D.fam.owner || !D.conn || !D.conn.hook) return
  const r = await post(D.conn.hook, { op: "key", code: D.fam.code, key: on && aiKey() ? aiKey() : "", model: core.CONFIG.agentModel || "claude-sonnet-5-5" }, D.conn.secret)
  if (r && r.ok) { D.fam.key = !!r.key; save(false) } else if (on) toast("Общий ключ не включился: " + ((r && r.error) || "нет связи"))
  if (!stack.length) render()
}
async function kidAdd() {
  const name = await ui.ask("Как зовут ребёнка?", "", "", { placeholder: "Имя" }); if (!name) return
  const age = Math.round(+(await ui.ask(`Сколько лет ${name}?`, "8–13 — детский режим, 14–17 — обычное приложение в семье.", "", { type: "number" })) || 0); if (!age) return
  const id = uid("k"), role = roleOf(age), color = COLORS[(members().length) % COLORS.length]
  D.fam.data.members[id] = { name, age, role, color, joined: Date.now(), pts: {}, at: 0 }
  await push(true, { add: [{ id, name, age, role, color }] })
  render(); invite(member(id) || { id, name, role })
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
  const me = x.m ? x.nm : await ui.ask(`Вступить в семью «${x.n || "Семья"}»?`, "Как вас подписать?", D.gamiName || "", { placeholder: "Например: Оля", ok: "Вступить" })
  if (!me) return
  D.fam = { url: x.u, code: x.c, id: x.m || uid("m"), role: x.r || "adult", name: me, fname: x.n, data: null, at: 0, out: {}, seen: {}, me: x.m ? null : { color: COLORS[1] } }
  if (D.who === "kid") D.who = "adult"
  save(false); await push(true); if (D.fam.err) toast(`Семья: ${D.fam.err}`)
  setTab("plans"); openFam()
}
// Вход по ссылке вручную (из тура новичка после «Ребёнок» и из «У меня есть ссылка»)
window.famJoin = async function () {
  const v = await ui.ask("Ссылка-приглашение", "Вставь ссылку, которую прислали мама или папа.", "", { placeholder: "https://…#fam=…", ok: "Войти" })
  if (!v) return
  const m = v.match(/fam=([A-Za-z0-9+/=_-]+)/); if (!m) return toast("Это не ссылка на семью")
  pendingFam = m[1]; join()
}
async function leave() {
  if (await ui.confirm("Выйти из семьи?", `<div class="msg">Ваши баллы перестанут идти в семейный счёт.</div>`, ["Отмена", "Выйти"]) !== "Выйти") return
  post(D.fam.url, { op: "leave", code: D.fam.code, id: D.fam.id }); D.fam = null; save(false); render()
}

// ───────────── Встраивание в экраны ─────────────
function openFam() { plansF = "fam"; if (tab !== "plans") setTab("plans"); else render(); scrollView(false) }
const FDO = { keyon: () => shareKey(true), keyoff: () => shareKey(false), new: () => famNew(), paste: () => window.famJoin(), invite: () => invite(null), kid: () => kidAdd(), goal: () => goalForm(), leave: () => leave(), open: () => openFam() }
function bindFam(v) {
  $$("[data-f]", v).forEach(b => b.onclick = e => { e.stopPropagation(); const f = FDO[b.dataset.f]; if (f) f() })
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
    if (plansF === "fam") { const i = html.indexOf("</div>") + 6; return html.slice(0, i) + famPage() }
    return html
  }
  const top0 = todayTop
  todayTop = function () {
    const n = isAdult() ? waits().length : 0
    return (n ? `<button class="card fnote" data-f="open"><span class="ftile" style="background:#0A9F6E1F">${ic("users", 22, "#0A9F6E")}</span><div class="grow"><div class="t">Семья: ${n} ${plural(n, "дело ждёт", "дела ждут", "дел ждут")} проверки</div><div class="s">${esc(waits().slice(0, 2).map(w => short((member(w.x.kid) || {}).name) + " · " + (w.t === "money" ? w.x.note : w.x.title)).join(", "))}</div></div>${ic("chev", 18, "#8A8A8E")}</button>` : "") + top0.apply(this, arguments)
  }
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
  window.addEventListener("izi:who", e => { const w = e && e.detail; if (w === "kid" && !famOn()) setTimeout(() => window.famJoin(), 300); render() })
  setTimeout(() => push(false), 1500)
  setInterval(() => { if (document.visibilityState === "visible") push(false) }, 60e3)
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") push(Date.now() - ((D.fam && D.fam.at) || 0) > 20e3) })
  if (pendingFam) setTimeout(join, 1000)
  window.FAM = { link, kidSheet, join, push, put, famDays, sumSince, goalProg, jars, kidStars, waits, approve, kidMode, openFam, LESSONS, lesson, credit, pocketTick }
}
})()
