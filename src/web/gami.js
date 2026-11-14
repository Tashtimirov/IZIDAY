// IZIDAY · Игра: баллы за дела, привычки и цели дня, 10 рангов, ачивки, свои награды, лига друзей и вызовы.
// Файл подключается ДО app.js (ловит ссылку-приглашение в лигу, пока app.js не стёр адрес), а работает ПОСЛЕ него:
// по DOMContentLoaded дополняет несколько функций app.js (render, save, remSet, choreDone, todayTop, renderPlans,
// runTool, agentSystem). Баллы не хранятся — считаются из данных (дела, привычки, вода, шаги, итоги дня…),
// поэтому сходятся на всех устройствах. Хранятся только награды, покупки, ачивки и заморозки — в списке goals.
(function () {
"use strict"
let pendingJoin = null
const grabJoin = h => { const m = decodeURIComponent(h || "").match(/league=([A-Za-z0-9+/=_-]+)/); if (m) pendingJoin = m[1] }
grabJoin(location.hash)
window.addEventListener("hashchange", () => { grabJoin(location.hash); if (pendingJoin && window.GAMI) setTimeout(() => window.GAMI.join(), 60) })
document.addEventListener("DOMContentLoaded", () => { try { init() } catch (e) { console.error("gami", e) } })

// ───────────── Правила ─────────────
const RANKS = [["Новичок", 0, "#D1D1D6", "#8E8E93"], ["Стажёр", 150, "#3DDCA6", "#0A7F58"], ["Практик", 500, "#5AC8FA", "#0A6FE0"],
  ["Профи", 1200, "#A78BFA", "#6D28D9"], ["Мастер", 2500, "#FFB86B", "#E5532B"], ["Стратег", 4500, "#FF8FB1", "#D6336C"],
  ["Наставник", 7500, "#7DE0EC", "#1E8FA3"], ["Гуру", 12000, "#C9A7FF", "#5B21B6"], ["Легенда", 18000, "#FFE680", "#D49A00"], ["Мудрец", 26000, "#E5E5EA", "#3A3A3C"]]
const CAP = 250, ACH_PTS = 25, FREEZE = 200, START_MAX = 90
const PTS = { task: 10, top: 20, habit: 5, health: 10, workout: 15, note: 15, money: 10, chore: 10, month: 50, wish: 30, focus: 10 }
// Расширения игры (quest.js: задания дня, комбо, боссы, карта пути, шар растёт): items — свои пункты дня (в потолке),
// post — правка пунктов дня (комбо), extra — призы сверх потолка, sum — данные для Изи, today — карточки на «Сегодня», pages — разделы «Моего пути»
const GX = { items: [], post: [], extra: [], sum: [], today: [], path: [], pages: {}, segs: [] }
const gx = (l, ...a) => { for (const f of l) try { f(...a) } catch (e) { console.error("gami+", e) } }
// Призы за ранг: открываются сами
const THEMES = { base: ["Изумруд", "#0A9F6E", "#12C28A", 1], ocean: ["Ночной океан", "#0A84FF", "#5AC8FA", 3], sunset: ["Закат", "#FF6B3D", "#FF9F0A", 5], aurora: ["Аврора", "#AF52DE", "#5E5CE6", 7], gold: ["Золото", "#C99A06", "#F0CC60", 9] }
const PRIZES = [[3, "sparkle", "Тема «Ночной океан»", "для приложения"], [3, "snow", "Вторая заморозка в неделю", "серия не сгорает дважды"], [5, "sparkle", "Тема «Закат»", "тёплые цвета"],
  [7, "sparkle", "Тема «Аврора»", "фиолетовое сияние"], [9, "crown", "Тема «Золото»", "для Легенд"]]

// ───────────── Иконки ─────────────
const P = {
  flame: '<path d="M12 21c-4 0-6.5-2.7-6.5-6.3 0-3.6 3-5.6 3.8-9.2 2.2 1.4 3.4 3.4 3.5 5.6 1-1 1.6-2.2 1.8-3.6 2.4 1.8 3.9 4.4 3.9 7.2 0 3.6-2.5 6.3-6.5 6.3z"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="M10 21l2-6-3-3 1.5-5 3.5 3 3 1M9 12l-3 2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z"/>',
  sunrise: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 6v4M5.6 10.6l1.4 1.4M18.4 10.6L17 12M2 22h20"/>',
  coffee: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18M3 15h18M8 5v14M16 5v14"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14a5 5 0 0 1 5.5 5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/>',
  piggy: '<path d="M5 11a7 6 0 0 1 12-3h2l-1 3a6 6 0 0 1 1 3v2h-2l-1 3h-3v-2H9v2H6l-1-3a5 5 0 0 1 0-5z"/><circle cx="15" cy="11" r=".8"/>',
  bed: '<path d="M3 18V8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', drop: '<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M19 19v2H6"/>', gift: '<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M3 9h18v3H3zM12 9v11M12 9c-1.5-3-5-4-5-1.5S10 9 12 9zM12 9c1.5-3 5-4 5-1.5S14 9 12 9z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 2M9.5 2.5h5"/>', dumbbell: '<path d="M6 7v10M3.5 9.5v5M18 7v10M20.5 9.5v5M6 12h12"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', plane: '<path d="M21 4L3 11l7 2.5L12.5 21z"/><path d="M10 13.5L21 4"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6h14v-6"/>', chev: '<path d="M9.5 5.5l6.5 6.5-6.5 6.5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  shirt: '<path d="M8.5 3.5L3.5 6.5l2 4 2-1v11h9v-11l2 1 2-4-5-3c-.6 1.5-1.9 2.5-3.5 2.5S9.1 5 8.5 3.5z"/>', calm: '<circle cx="12" cy="12" r="9"/><path d="M8 14.5c2 2 6 2 8 0M9 9.5h.01M15 9.5h.01"/>',
  pen: '<path d="M4 20l4.2-1L19 8.2a2.1 2.1 0 0 0-3-3L5.2 16z"/>', seed: '<path d="M12 21v-9M12 12c0-4 3-7 8-7 0 5-3 7-8 7zM12 15c0-3-2.5-5-7-5 0 4 2.5 5 7 5z"/>',
}
const svgI = (n, s = 18, sw = 2) => `<svg class="gi" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${P[n] || P.star}</svg>`
const coin = (n, cls = "") => `<span class="gcoin ${cls}">${svgI("star", 15, 2.2)}${num(n)}</span>`
let gid = 0
function emblem(level, s = 56) {
  const [, , a, b] = RANKS[level - 1], id = "ge" + (gid++)
  return `<svg class="gemb" width="${s}" height="${s}" viewBox="0 0 64 64"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<path d="M32 3l25 14.5v29L32 61 7 46.5v-29z" fill="url(#${id})" stroke="rgba(255,255,255,.75)" stroke-width="2"/><path d="M32 11l18 10.5v21L32 53 14 42.5v-21z" fill="rgba(255,255,255,.17)"/>
<text x="32" y="40.5" text-anchor="middle" font-family="-apple-system,system-ui,sans-serif" font-weight="800" font-size="22" fill="#fff">${level}</text></svg>`
}
function medal(ic, a, b, s = 72) {
  const id = "gm" + (gid++)
  return `<svg class="gmed" width="${s}" height="${s}" viewBox="0 0 74 74"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<circle cx="37" cy="37" r="34" fill="url(#${id})"/><circle cx="37" cy="37" r="27" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5" stroke-dasharray="2 3"/><circle cx="37" cy="37" r="22" fill="rgba(255,255,255,.18)"/>
<g transform="translate(23 23) scale(1.17)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[ic] || P.star}</g></svg>`
}

// ───────────── Расчёт баллов из данных ─────────────
let ver = 0
const memo = new Map()
let HS = null   // множество отметок привычек на время расчёта
const hOn = (h, d) => HS.has(`h:${h.id}:${dayKey(d)}`)
function hStreak(h, d) { let n = 0, x = sod(d); for (; n < 400 && hOn(h, x); x = addDays(x, -1)) n++; return n }
const goalsK = k => live(D.goals).filter(g => g && g.kind === k)
const topIds = k => { try { return top3Ids(k) } catch (e) { return [] } }
const doneOn = (d, k) => {
  const out = []
  for (const r of live(D.rems)) {
    if (r.done && r.doneAt && sameDay(r.doneAt, d)) out.push({ r, at: r.doneAt })
    for (const x of r.hist || []) if (x && x.day === k) out.push({ r, at: x.at })
  }
  return out
}
function dayItems(d) {
  const k = dayKey(d), past = d < sod(new Date()), items = [], seen = new Set()
  const add = (id, kind, t, p, at) => { if (seen.has(id)) return; seen.add(id); items.push({ id, kind, t: String(t || ""), p: Math.round(p), at: at || +d }) }
  const top = topIds(k)
  for (const { r, at } of doneOn(d, k)) { const isTop = top.includes(r.id); add(`t:${r.id}:${k}`, isTop ? "top" : "task", r.title, isTop ? PTS.top : PTS.task, at) }
  for (const h of live(D.habits)) {
    if (!h.title) continue
    const born = sod(h.date || 0)
    if (d < born) continue
    if (h.bad) { if (past && !hOn(h, d)) add(`hb:${h.id}:${k}`, "habit", `Без «${h.title}»`, PTS.habit); continue }
    if (!hOn(h, d)) continue
    const st = hStreak(h, d), fresh = d - born < 3 * 864e5
    add(`h:${h.id}:${k}`, "habit", h.title, PTS.habit * (fresh || st >= 21 ? 2 : st >= 5 ? 1.5 : 1))
  }
  const dh = dayHealth(d), g = H()
  if (dh.water >= (g.waterGoal || 2000)) add(`w:${k}`, "health", "Вода — цель дня", PTS.health)
  if (dh.steps != null && dh.steps >= (g.stepGoal || 10000)) add(`s:${k}`, "health", "Шаги — цель дня", PTS.health)
  if (dh.food.length && dh.protein >= proteinGoal()) add(`p:${k}`, "health", "Белок — цель дня", PTS.health)
  dh.workouts.slice(0, 2).forEach(w => add(`wk:${w.id}`, "health", "Тренировка" + (w.title || w.sport ? ": " + (w.title || w.sport) : ""), PTS.workout, w.date))
  const note = goalsK("daynote").find(x => x.day === k)
  if (note) add(`n:${k}`, "day", "Итоги дня", PTS.note, note.date)
  if (past) { const ex = live(D.money).filter(e => e.type === "expense" && sameDay(e.date, d)); if (ex.length && !ex.some(e => e.category === "Другое")) add(`m:${k}`, "money", "Все траты разнесены", PTS.money) }
  for (const c of goalsK("chore")) {
    const at = ((c.hist || []).find(x => x && x.day === k) || {}).at || (c.last && sameDay(c.last, d) ? c.last : 0)
    if (at) add(`c:${c.id}:${k}`, "task", c.title, PTS.chore, at)
  }
  for (const x of live(D.goals)) if (x.done && x.doneAt && sameDay(x.doneAt, d) && ["month", "wish", "dream"].includes(x.kind))
    add(`g:${x.id}`, "goal", (x.kind === "month" ? "Цель месяца: " : "Сбылось: ") + x.title, x.kind === "month" ? PTS.month : PTS.wish, x.doneAt)
  live(D.pomo).filter(p => p.full && p.start && sameDay(p.start, d)).slice(0, 4).forEach(p => add(`f:${p.id}`, "focus", "Фокус: " + (p.title || "25 мин"), PTS.focus, p.end))
  gx(GX.items, d, k, add, past)
  gx(GX.post, items, d)
  return items
}
// Чистый день: все дела на день и все полезные привычки закрыты (минимум 3 пункта) — баллы за день ×2
function dayClean(d, items) {
  const t0 = sod(new Date()), end = addDays(d, 1), isT = sameDay(d, t0)
  let open = 0
  for (const r of live(D.rems)) {
    const due = parseIso(r.due)
    if (!due) continue
    if (isT ? due < end && !r.done : sameDay(due, d) && (!r.done || (r.doneAt || 0) >= +end)) open++
  }
  const done = items.filter(i => i.kind === "task" || i.kind === "top").length
  const hs = live(D.habits).filter(h => h.title && !h.bad && !h.archived && sod(h.date || 0) <= d)
  const hDone = hs.filter(h => hOn(h, d)).length
  const total = done + open + hs.length, left = open + hs.length - hDone
  return { total, left, done: done + hDone, ok: total >= 3 && left === 0 }
}
function daySum(d) {
  const k = dayKey(d), isT = sameDay(d, new Date()), m = memo.get(k)
  if (m && m.ver === ver && (!isT || Date.now() - m.at < 4000)) return m
  const items = dayItems(d), base = items.reduce((s, i) => s + i.p, 0), capped = Math.min(CAP, base)
  const clean = dayClean(d, items), bonus = clean.ok ? capped : 0
  const ach = goalsK("ach").filter(a => a.day === k).length * ACH_PTS
  const extra = []; gx(GX.extra, d, k, x => extra.push(x))
  const ex = extra.reduce((s, x) => s + x.p, 0)
  const r = { k, d, items, base, capped, clean, bonus, ach, extra, ex, total: capped + bonus + ach + ex, ver, at: Date.now() }
  memo.set(k, r)
  return r
}
const monday = d => { const x = sod(d); return addDays(x, -((x.getDay() + 6) % 7)) }
const wkKey = d => dayKey(monday(d))
function startDay() {
  const t0 = sod(new Date()), lim = addDays(t0, -START_MAX)
  let s = +t0
  for (const k of ["rems", "habits", "hlog", "goals"]) for (const x of live(D[k] || [])) if (x.date && x.date < s && x.date > +lim) s = x.date
  if (D.gamiStart && D.gamiStart < s) s = Math.max(D.gamiStart, +lim)
  return sod(s)
}
let S = null
function stats() {
  if (S && S.ver === ver && Date.now() - S.at < 4000) return S
  HS = new Set(live(D.hlog).map(x => x.id))
  const t0 = sod(new Date()), start = startDay(), days = []
  for (let d = start; d <= t0; d = addDays(d, 1)) days.push(daySum(d))
  const earned = days.reduce((s, x) => s + x.total, 0)
  const spent = goalsK("spend").reduce((s, x) => s + (+x.cost || 0), 0)
  let lv = 1; for (let i = 0; i < RANKS.length; i++) if (earned >= RANKS[i][1]) lv = i + 1
  const frozen = new Set(goalsK("freeze").filter(f => f.day).map(f => f.day))
  const active = x => x.total > 0 || frozen.has(x.k)
  let streak = 0, i = days.length - 1
  if (i >= 0 && !active(days[i])) i--
  for (; i >= 0 && active(days[i]); i--) streak++
  const today = days[days.length - 1]
  const wk0 = monday(t0), inW = (x, a, b) => x.d >= a && x.d < b
  const week = days.filter(x => inW(x, wk0, addDays(wk0, 7)))
  const lastSpan = days.filter(x => inW(x, addDays(wk0, -7), addDays(t0, -6)))
  const lastWeek = days.filter(x => inW(x, addDays(wk0, -7), wk0))
  S = { ver, at: Date.now(), days, earned, spent, balance: earned - spent, lv, rank: RANKS[lv - 1][0], next: RANKS[lv] || null, streak, today, week, lastSpan, lastWeek,
    weekPts: week.reduce((s, x) => s + x.total, 0), lastSpanPts: lastSpan.reduce((s, x) => s + x.total, 0), lastWeekPts: lastWeek.reduce((s, x) => s + x.total, 0),
    freezes: goalsK("freeze").filter(f => !f.day).length, cleanDays: days.filter(x => x.clean.ok).length }
  return S
}
const pct = (a, b) => Math.max(0, Math.min(1, b ? a / b : 0))
function rankProg(st) { if (!st.next) return { p: 1, have: st.earned, need: st.earned }; const a = RANKS[st.lv - 1][1]; return { p: pct(st.earned - a, st.next[1] - a), have: st.earned, need: st.next[1] } }

// ───────────── Ачивки ─────────────
// cat: Дела, Здоровье, Деньги, Семья, Особые; f(c) → [сейчас, нужно]
const maxRun = (arr, ok) => { let m = 0, n = 0; for (const x of arr) { n = ok(x) ? n + 1 : 0; if (n > m) m = n } return m }
function achCtx(st) {
  const habits = live(D.habits).filter(h => h.title && !h.bad)
  const hMax = habits.reduce((m, h) => { let best = 0, n = 0; for (const x of st.days) { n = hOn(h, x.d) ? n + 1 : 0; best = Math.max(best, n) } return Math.max(m, best) }, 0)
  const waterRun = maxRun(st.days, x => x.items.some(i => i.id.startsWith("w:")))
  const weeks = {}; for (const x of st.days) { const w = wkKey(x.d), s = dayHealth(x.d).steps || 0; weeks[w] = (weeks[w] || 0) + s }
  const early = st.days.reduce((m, x) => Math.max(m, x.items.filter(i => i.kind === "top" && new Date(i.at).getHours() < 10).length), 0)
  const fam = new Set(); for (const x of st.days) if (x.items.some(i => (i.kind === "task" || i.kind === "top") && /мам|пап|родител|бабуш|дедуш/i.test(i.t))) fam.add(wkKey(x.d))
  const owl = st.days.some(x => x.items.some(i => (i.kind === "task" || i.kind === "top") && new Date(i.at).getHours() < 4 && sameDay(i.at, x.d)))
  const prevM = (() => { const d = new Date(); d.setDate(0); return core.monthKey(d) })()
  const bud = live(D.budgets).filter(b => b.limit > 0)
  const inBudget = bud.length && bud.every(b => { const s = budgetState(b.category, prevM); return !s || s.spent <= s.limit }) && live(D.money).some(e => core.monthKey(new Date(e.date)) === prevM)
  const lg = D.league && D.league.data, wonWeek = !!(D.league && D.league.won)
  return { st, hMax, waterRun, stepsWeek: Math.max(0, ...Object.values(weeks)), early, fam: fam.size, owl, inBudget, wonWeek, lg,
    notes: goalsK("daynote").length, pomo: live(D.pomo).filter(p => p.full).length, workouts: live(D.workouts).length,
    habitsN: habits.filter(h => !h.archived).length, goalsDone: goalsK("month").filter(g => g.done).length,
    dreams: live(D.goals).filter(g => ["wish", "dream"].includes(g.kind) && g.title).length, bought: goalsK("spend").length,
    cleanRun: maxRun(st.days, x => x.clean.ok), chWon: (D.league && D.league.chWon) || 0 }
}
const ACH = [
  ["first", "Первый шаг", "первые баллы", "seed", "#9BE15D", "#2E9E46", "Дела", c => [c.st.earned > 0 ? 1 : 0, 1]],
  ["early", "Ранняя пташка", "3 главных дела до 10:00", "sunrise", "#FFD27A", "#FF8A3D", "Дела", c => [c.early, 3]],
  ["clean1", "Чистый день", "закрыть все дела и привычки", "check", "#3DDCA6", "#0A7F58", "Дела", c => [Math.min(1, c.st.cleanDays), 1]],
  ["clean10", "Безупречный", "10 чистых дней", "bolt", "#FFD84D", "#FF9F0A", "Дела", c => [c.st.cleanDays, 10]],
  ["focus10", "Фокус", "10 помидоров по 25 минут", "timer", "#FF9FB0", "#E0245E", "Дела", c => [c.pomo, 10]],
  ["goal", "Цель месяца", "закрыть цель месяца", "target", "#FF9FB0", "#C2185B", "Дела", c => [Math.min(1, c.goalsDone), 1]],
  ["ritual", "Вечерний ритуал", "7 раз подвести итоги дня", "moon", "#A5B4FC", "#4338CA", "Дела", c => [c.notes, 7]],
  ["fire7", "Неделя огня", "привычка 7 дней подряд", "flame", "#FFB340", "#FF453A", "Здоровье", c => [c.hMax, 7]],
  ["fire30", "Месяц огня", "привычка 30 дней подряд", "crown", "#FFE680", "#D49A00", "Здоровье", c => [c.hMax, 30]],
  ["fire100", "Сто дней", "привычка 100 дней подряд", "trophy", "#FFD27A", "#B7791F", "Здоровье", c => [c.hMax, 100]],
  ["water7", "Водный баланс", "норма воды 7 дней подряд", "drop", "#7CC8FF", "#0A6FE0", "Здоровье", c => [c.waterRun, 7]],
  ["walk70", "Марафонец", "70 000 шагов за неделю", "walk", "#9BE15D", "#2E9E46", "Здоровье", c => [c.stepsWeek, 70000]],
  ["sport10", "Спортсмен", "10 тренировок", "dumbbell", "#FFB86B", "#C2410C", "Здоровье", c => [c.workouts, 10]],
  ["habits5", "Коллекционер", "5 привычек одновременно", "sparkle", "#C9A7FF", "#7E3FD9", "Здоровье", c => [c.habitsN, 5]],
  ["budget", "В рамках", "месяц без перерасхода лимитов", "piggy", "#7DE0EC", "#1E8FA3", "Деньги", c => [c.inBudget ? 1 : 0, 1]],
  ["shop1", "Заслужил", "купить первую награду", "gift", "#FFE680", "#E0A800", "Деньги", c => [Math.min(1, c.bought), 1]],
  ["k1", "Тысяча", "1 000 баллов", "star", "#FFE680", "#E0A800", "Деньги", c => [c.st.earned, 1000]],
  ["k10", "Десять тысяч", "10 000 баллов", "crown", "#FFD27A", "#B7791F", "Деньги", c => [c.st.earned, 10000]],
  ["family", "Хороший сын", "дела для родителей 4 недели", "phone", "#C9A7FF", "#7E3FD9", "Семья", c => [c.fam, 4]],
  ["dream10", "Мечтатель", "10 желаний и мечт", "plane", "#7DE0EC", "#0A84FF", "Семья", c => [c.dreams, 10]],
  ["league1", "Чемпион недели", "первое место в лиге за неделю", "trophy", "#FFE680", "#D49A00", "Особые", c => [c.wonWeek ? 1 : 0, 1]],
  ["duel", "Дуэлянт", "выиграть вызов", "users", "#FF9FB0", "#E0245E", "Особые", c => [Math.min(1, c.chWon), 1]],
  ["owl", "Сова", "секретная", "moon", "#5E5CE6", "#1E1B4B", "Особые", c => [c.owl ? 1 : 0, 1], 1],
  ["perfect", "Идеальная неделя", "секретная", "crown", "#FFE680", "#0A9F6E", "Особые", c => [c.cleanRun, 7], 1],
]
const ACH_DESC = { owl: "дело, сделанное после полуночи", perfect: "7 чистых дней подряд" }
function achList(st) {
  const c = achCtx(st), got = new Map(goalsK("ach").map(a => [a.key, a]))
  return ACH.map(([key, t, s, ic, a, b, cat, f, secret]) => { const [have, need] = f(c), g = got.get(key)
    return { key, t, s: g && secret ? ACH_DESC[key] : s, ic, a, b, cat, have: Math.min(have, need), need, p: pct(have, need), ok: !!g, ready: !g && have >= need, at: g && g.date, secret: !!secret } })
}

// ───────────── Отметки: повторяющиеся дела и «Снова пора» хранят историю ─────────────
function wrapData() {
  const remSet0 = remSet
  remSet = function (id, patch) {
    const r = D.rems.find(x => x.id === id && !x.deleted)
    const rep = r && patch && patch.completed === true && nextDue(r)
    const out = remSet0(id, patch)
    if (rep && out) { const k = dayKey(new Date()); out.hist = (out.hist || []).filter(x => x && x.day >= dayKey(addDays(new Date(), -400))).concat([{ day: k, at: Date.now() }]); upsert("rems", out) }
    return out
  }
  const chore0 = choreDone
  choreDone = function (id, at = Date.now()) {
    const out = chore0(id, at)
    if (out) { const k = dayKey(new Date(at)); out.hist = (out.hist || []).filter(x => x && x.day !== k).concat([{ day: k, at }]).slice(-120); upsert("goals", out) }
    return out
  }
  const up0 = upsert
  upsert = function () { ver++; return up0.apply(this, arguments) }
  const save0 = save
  save = function (push) { ver++; return save0.apply(this, arguments) }
  const merge0 = mergeIn
  mergeIn = function () { ver++; return merge0.apply(this, arguments) }
}

// ───────────── Выключатель игры (Настройки → Режим игры) ─────────────
// D.gamiOff = 1 — игра скрыта целиком: баллы, ранги, ачивки, награды, лига, праздники и плашки «+10», инструменты Изи.
// Ничего не удаляется: баллы считаются из данных, награды и ачивки лежат в goals — при включении всё возвращается.
// Хранится только на этом телефоне. Детский режим и семейные баллы (family.js) выключатель не трогает.
const gOff = () => !!(D && D.gamiOff)
function syncOff() {
  const i = PLAN_F.findIndex(f => f[0] === "game")
  if (gOff() && i >= 0) PLAN_F.splice(i, 1)
  if (!gOff() && i < 0) PLAN_F.splice(1, 0, ["game", "Мой путь"])
  if (gOff() && plansF === "game") plansF = "all"
  for (const t of TOOLS) { const j = AGENT_TOOLS.findIndex(x => x.name === t.name); if (gOff() && j >= 0) AGENT_TOOLS.splice(j, 1); if (!gOff() && j < 0) AGENT_TOOLS.push(t) }
  applyTheme()
}
function setGame(on) {
  if (on === !gOff()) return
  if (on) {
    delete D.gamiOff
    // за время паузы могли накопиться ранги и ачивки — записываем их тихо, без лавины праздников
    const st = stats()
    for (const a of achList(st).filter(a => a.ready)) upsert("goals", { id: uid("a"), date: Date.now(), kind: "ach", key: a.key, day: dayKey(new Date()) })
    D.gamiSeen = { rank: stats().lv, ach: goalsK("ach").map(a => a.key) }; D.gamiRankPending = 0; D.gamiSettled = dayKey(new Date())
    lastToday = null; bornAt = Date.now()
  } else { D.gamiOff = 1; D.gamiRankPending = 0; toastQ.length = 0; const el = document.getElementById("gtoast"); if (el) el.classList.remove("show") }
  syncOff(); save(); render()
  toast(on ? "Режим игры включён — прогресс на месте" : "Режим игры выключен. Данные сохранены")
  if (on) lgPush(true)
}
function offCard() {
  if (D.who === "kid" || (D.fam && D.fam.code && D.fam.role === "kid")) return ""
  const off = gOff(), fam = !!(D.fam && D.fam.code)
  return `<div class="card goff"><h2>Режим игры</h2>
    <div class="set"><span>Баллы и ранги</span><div class="seg"><button data-g="game-on" class="${off ? "" : "on"}">Вкл.</button><button data-g="game-off" class="${off ? "on" : ""}">Выкл.</button></div></div>
    <div class="muted small">${off ? `Игра выключена: не видно баллов, рангов, ачивок, наград и лиги, нет праздников и плашек «+10», ${esc(typeof iziName === "function" ? iziName() : "Изи")} о них не говорит. Всё сохранено — включите, и прогресс вернётся.`
      : "Баллы за дела и привычки, ранги, ачивки, свои награды и лига друзей. Можно выключить — ничего не удалится."}${fam ? " Семейные баллы и цели работают в любом случае." : ""}</div></div>`
}

// ───────────── Отклик: «+10», новый ранг, ачивки ─────────────
const toastQ = []
function showPending() { if (gOff()) return; const lv = D.gamiRankPending; if (!lv) return; D.gamiRankPending = 0; save(false); const st = stats(); if (st.lv >= lv) rankUp(st) }
let lastToday = null, lastIds = null, lastTop = "", busy = false, bornAt = Date.now()
// что уже показано плашкой «+N» сегодня (на этом устройстве; только сегодняшний день)
function toldGet(k) { try { const o = JSON.parse(localStorage.getItem("gamiTold") || "{}"); return new Set(o.k === k ? o.ids || [] : []) } catch (e) { return new Set() } }
function toldSet(k, set) { try { localStorage.setItem("gamiTold", JSON.stringify({ k, ids: [...set].slice(-400) })) } catch (e) {} }
function gToast(n, t, big, onTap) {
  let el = document.getElementById("gtoast")
  if (!el) { el = document.createElement("div"); el.id = "gtoast"; document.body.appendChild(el) }
  el.innerHTML = `<span class="c">${typeof n === "number" ? "+" + n : n}</span><span class="t">${esc(t)}</span>`
  el.onclick = () => { el.classList.remove("show"); if (onTap) onTap() }
  el.classList.toggle("big", !!big)
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show")
  if (navigator.vibrate) navigator.vibrate(big ? [12, 40, 12] : 8)
  clearTimeout(gToast.t); gToast.t = setTimeout(() => el.classList.remove("show"), 2600)
}
function settleFreeze(st) {
  const y = st.days[st.days.length - 2], yy = st.days[st.days.length - 3]
  if (!y || !yy || y.total > 0 || !(yy.total > 0)) return false
  const f = goalsK("freeze").find(x => x.day === y.k) || goalsK("freeze").find(x => !x.day)
  if (!f || f.day) return false
  upsert("goals", Object.assign({}, f, { day: y.k })); save()
  toast("Заморозка сохранила серию")
  return true
}
function tick() {
  if (busy || !D || !D.goals || gOff()) return
  busy = true
  try {
    let st = stats()
    if (D.gamiSettled !== dayKey(new Date())) { D.gamiSettled = dayKey(new Date()); if (settleFreeze(st)) st = stats(); save(false) }
    // новые ачивки
    const fresh = achList(st).filter(a => a.ready)
    if (fresh.length) {
      for (const a of fresh) upsert("goals", { id: uid("a"), date: Date.now(), kind: "ach", key: a.key, day: dayKey(new Date()) })
      save(); st = stats()
    }
    const seen = D.gamiSeen
    if (!seen) { D.gamiSeen = { rank: st.lv, ach: goalsK("ach").map(a => a.key) }; D.gamiIntro = 1; save(false) }
    else {
      // праздник не перебивает работу: сначала плашка сверху (нажать — открыть), весь экран — при следующем входе в приложение
      if (st.lv > seen.rank) { seen.rank = st.lv; D.gamiRankPending = st.lv; save(false); toastQ.push([emblem(st.lv, 28), `Новый ранг: ${st.rank}`, () => showPending()]) }
      const nw = goalsK("ach").map(a => a.key).filter(k => !seen.ach.includes(k))
      if (nw.length) { seen.ach = seen.ach.concat(nw); save(false); const l = achList(st).filter(a => nw.includes(a.key))
        toastQ.push([`+${ACH_PTS * nw.length}`, `Достижение: ${l.map(a => a.t).join(", ")}`, () => achSheet(nw)]) }
    }
    if (toastQ.length) { const [c, t, f] = toastQ.shift(); gToast(c, t, true, f); lastToday = st.today.total; lastIds = new Set(st.today.items.map(i => i.id).concat(st.today.extra.map(x => x.id))); if (toastQ.length) setTimeout(tick, 2800); return }
    const tt = st.today.total, ids = new Set(st.today.items.map(i => i.id).concat(st.today.extra.map(x => x.id)))
    // уже показанное за день помнится между запусками: данные, пришедшие с сервера после старта, не дают «+15» повторно
    const told = toldGet(st.today.k), isNew = x => !lastIds.has(x.id) && !told.has(x.id) && !(x.at > sod(new Date()) && Date.now() - x.at > 10 * 60e3)
    if (lastToday == null) { ids.forEach(i => told.add(i)); if (st.today.clean.ok) told.add("clean") }
    else if (tt > lastToday && Date.now() - bornAt > 6000 && !stack.length) {
      const it = st.today.items.filter(isNew).sort((a, b) => b.p - a.p)[0]
      const clean = st.today.clean.ok && !lastTop.includes("clean") && !told.has("clean"), ex = st.today.extra.find(isNew)
      if (clean || ex || it) gToast(tt - lastToday, clean ? "Чистый день — баллы ×2" : ex ? ex.t : it.t + (it.mult > 1 ? ` · комбо ×${String(it.mult).replace(".", window.L && L.en ? "." : ",")}` : ""), clean || !!ex)
    }
    ids.forEach(i => told.add(i)); if (st.today.clean.ok) told.add("clean"); toldSet(st.today.k, told)
    lastToday = tt; lastIds = ids; lastTop = st.today.clean.ok ? "clean" : ""
  } finally { busy = false }
}

// ───────────── Окна-праздники (закрываются смахиванием) ─────────────
const sparks = () => [...Array(14)].map((_, i) => `<i style="left:${(i * 37) % 100}%;top:${(i * 53) % 60 + 5}%;animation-delay:${(i % 7) * .35}s;width:${4 + (i % 3) * 3}px;height:${4 + (i % 3) * 3}px"></i>`).join("")
function celeSheet(html) {
  const s = sheet(`<div class="gcele-in"><div class="ray"></div><div class="sparks">${sparks()}</div>${html}<div class="hint">смахните вниз, чтобы закрыть</div></div>`)
  s.el.classList.add("gcele")
  if (navigator.vibrate) navigator.vibrate([15, 60, 15, 60, 30])
  return s
}
function rankUp(st) {
  const pr = PRIZES.filter(p => p[0] === st.lv)
  celeSheet(`<div class="k">Новый ранг</div><div class="emb">${emblem(st.lv, 150)}</div><h1>${esc(st.rank)}</h1><p>Уровень ${st.lv} из ${RANKS.length} · ${num(st.earned)} баллов</p>
    ${pr.length ? `<div class="gift"><b>${svgI("gift", 17)} Открыто</b>${esc(pr.map((p, i) => i ? p[2][0].toLowerCase() + p[2].slice(1) : p[2]).join(" и "))}</div>` : ""}
    ${GX.path.length ? `<div class="gift"><b>${svgI("sparkle", 17)} Шар Изи</b>волны в шаре стали ярче</div>` : ""}
    ${D.league && D.league.code ? `<div class="gift"><b>${svgI("users", 17)} Лига</b>Друзья увидят новый ранг в лиге недели</div>` : ""}`)
  lgPush(true)
}
function achSheet(keys) {
  const l = achList(stats()).filter(a => keys.includes(a.key))
  if (!l.length) return
  celeSheet(`<div class="k">${l.length > 1 ? "Новые ачивки" : "Новая ачивка"}</div><div class="meds">${l.slice(0, 3).map(a => `<div>${medal(a.ic, a.a, a.b, l.length > 1 ? 96 : 140)}</div>`).join("")}</div>
    <h1>${esc(l.map(a => a.t).slice(0, 3).join(", "))}</h1><p>${esc(l.length === 1 ? (ACH_DESC[l[0].key] || l[0].s) : `+${ACH_PTS * l.length} баллов`)}${l.length === 1 ? ` · +${ACH_PTS} баллов` : ""}</p>`)
}
function introHTML(st) {
  if (!D.gamiIntro) return ""
  return `<div class="gizi gnew"><span class="gnew-e">${emblem(st.lv, 40)}</span><div class="grow"><b>Новое: баллы, ранги и награды</b><span>За дела, привычки, воду, шаги и итоги дня — баллы. Уже посчитано: ${esc(st.rank)}, ${num(st.earned)} баллов.</span>
    <div class="chips"><button class="chip on" data-g="intro-go">Мой путь</button><button class="chip" data-g="intro-off">Понятно</button></div></div></div>`
}

// ───────────── «Сегодня»: полоска ранга, чистый день, совет Изи ─────────────
function stripHTML(st) {
  const rp = rankProg(st)
  return `<button class="gstrip" data-g="path">${emblem(st.lv, 46)}<div class="grow"><div class="t">${esc(st.rank)} · ${num(st.earned)}${st.next ? ` / ${num(st.next[1])}` : ""}</div>
    <div class="gbar"><i style="width:${Math.round(rp.p * 100)}%"></i></div><div class="s">${st.next ? `ещё ${num(st.next[1] - st.earned)} до «${esc(st.next[0])}»` : "высший ранг"}</div></div>
    <div class="gtd">${coin(st.today.total)}<span>сегодня</span></div></button>`
}
function cleanHTML(st) {
  const c = st.today.clean
  if (c.total < 3) return ""
  if (c.ok) return `<div class="gclean ok">${svgI("bolt", 22)}<div><b>Чистый день — баллы ×2</b><span>Всё закрыто. Сегодня ${num(st.today.total)} баллов.</span></div></div>`
  if (new Date().getHours() < 12 && c.done === 0) return ""
  return `<div class="gclean"><span class="ic">${svgI("bolt", 20)}</span><div class="grow"><b>Чистый день — ×2</b><span>Закройте все дела и привычки на сегодня, и баллы за день удвоятся. Осталось ${c.left}.</span>
    <div class="gbar"><i style="width:${Math.round(pct(c.done, c.total) * 100)}%"></i></div></div></div>`
}
// Изи предлагает привычку: когда одна держится 14+ дней (не чаще раза в неделю), или предлагает убрать лишнее, если серия рвётся
function iziPick(st) {
  const now = Date.now(), snooze = D.gamiSug || 0
  if (now - snooze < 7 * 864e5) return null
  const hs = live(D.habits).filter(h => h.title && !h.bad && !h.archived), t0 = sod(new Date())
  const strong = hs.map(h => ({ h, n: hStreak(h, hOn(h, t0) ? t0 : addDays(t0, -1)) })).sort((a, b) => b.n - a.n)[0]
  const broke = hs.find(h => !hOn(h, t0) && !hOn(h, addDays(t0, -1)) && hStreak(h, addDays(t0, -2)) >= 5)
  if (broke && hs.length >= 4) return { kind: "trim", h: broke.title, t: `Серия «${broke.title}» прервалась`, s: "Привычек много, и это нормально, что не всё получается. Изи поможет оставить главное.", btn: "Обсудить" }
  if (strong && strong.n >= 14 && hs.length < 8) return { kind: "add", h: strong.h.title, t: `«${strong.h.title}» держится ${strong.n} ${plural(strong.n, "день", "дня", "дней")}`, s: "Она стала привычкой. Изи подберёт следующую под ваш день: первые 3 дня — двойные баллы.", btn: "Подобрать" }
  if (!hs.length && st.days.length >= 3) return { kind: "first", t: "Добавим первую привычку?", s: "Изи подберёт одну простую привычку под ваш день. За каждый день — баллы, за серию — больше.", btn: "Подобрать" }
  return null
}
function iziHTML(st) {
  const p = iziPick(st)
  return p ? `<div class="gizi"><b class="orb"></b><div class="grow"><b>${esc(p.t)}</b><span>${esc(p.s)}</span>
    <div class="chips"><button class="chip on" data-g="izi-${p.kind}">${esc(p.btn)}</button><button class="chip" data-g="izi-later">Не сейчас</button></div></div></div>` : ""
}
const IZI_ASK = {
  add: h => `Привычка «${h}» у меня держится уже две недели. Подбери мне три следующие полезные привычки под мой день и мои данные (сон, вода, шаги, тренировки, деньги, семья). Для каждой коротко: зачем именно мне и когда делать. Предложи выбрать через ask_user, а выбранную создай через mark_habit (create=true, done=false) и скажи, что первые 3 дня баллы двойные.`,
  first: () => `Подбери мне одну простую полезную привычку для начала под мой день и мои данные. Предложи три варианта через ask_user, а выбранную создай через mark_habit (create=true, done=false).`,
  trim: h => `У меня прервалась серия привычки «${h}». Посмотри все мои привычки (get_health) и помоги оставить главное: что упростить, что убрать на время. Без упрёков.`,
}
function badges(v) {
  const top = new Set(topIds(dayKey(new Date())))
  $$("[data-check]", v).forEach(b => { const row = b.closest(".row, .tl-it"); if (!row || row.querySelector(".gp")) return
    const isTop = top.has(b.dataset.check) || row.closest(".top3"); row.insertAdjacentHTML("beforeend", `<span class="gp">+${isTop ? PTS.top : PTS.task}</span>`) })
  $$(".habit[data-habit]", v).forEach(b => { if (b.classList.contains("on") || b.classList.contains("bad") || b.querySelector(".gp")) return; b.insertAdjacentHTML("beforeend", `<em class="gp">+${PTS.habit}</em>`) })
}

// ───────────── «Мой путь» в «Планах»: путь, ачивки, награды, лига ─────────────
let gSeg = "path", achCat = "Все"
const SEGS = [["path", "Путь"], ["ach", "Достижения"], ["rew", "Награды"], ["lg", "Лига"]]
function gamePage() {
  const st = stats(), segs = SEGS.slice(0, 1).concat(GX.segs, SEGS.slice(1))
  if (!segs.some(x => x[0] === gSeg)) gSeg = "path"
  let html = `<div class="gseg">${segs.map(([k, t]) => `<button class="${gSeg === k ? "on" : ""}" data-gseg="${k}">${t}</button>`).join("")}</div>`
  html += GX.pages[gSeg] ? GX.pages[gSeg](st) : gSeg === "ach" ? achPage(st) : gSeg === "rew" ? rewPage(st) : gSeg === "lg" ? lgPage(st) : pathPage(st)
  return html
}
function pathPage(st) {
  const rp = rankProg(st)
  let html = `<div class="grank">${emblem(st.lv, 72)}<div class="grow"><div class="lv">Уровень ${st.lv} из ${RANKS.length}</div><div class="nm">${esc(st.rank)}</div></div>
    <div class="gxp"><i style="width:${Math.round(rp.p * 100)}%"></i></div><div class="sub"><span>${num(st.earned)}${st.next ? ` / ${num(st.next[1])}` : ""}</span><span>${st.next ? "следующий — " + esc(st.next[0]) : "высший ранг"}</span></div>
    <div class="pills"><span>${svgI("star", 15)} ${num(st.balance)} на счету</span><span>${svgI("flame", 15)} серия ${st.streak} ${plural(st.streak, "день", "дня", "дней")}</span>${st.freezes ? `<span>${svgI("snow", 15)} заморозка ×${st.freezes}</span>` : ""}</div></div>`
  html += `<div class="card"><h2>Лестница рангов</h2><div class="gladder">${RANKS.map((r, i) => `<div class="${i + 1 === st.lv ? "on" : i + 1 > st.lv ? "off" : ""}">${emblem(i + 1, i + 1 === st.lv ? 52 : 40)}<b>${esc(r[0])}</b><small>${num(r[1])}</small></div>`).join("")}</div></div>`
  html += GX.path.map(f => { try { return f(st) || "" } catch (e) { console.error("gami+", e); return "" } }).join("")
  const it = st.today.items.slice().sort((a, b) => b.at - a.at)
  html += `<div class="card"><h2>Сегодня<span class="muted small" style="font-weight:500;text-transform:none;letter-spacing:0">${coin(st.today.total)}</span></h2>
    ${it.length ? it.slice(0, 12).map(i => `<div class="row"><span class="gic ${i.kind}">${svgI(KIND_IC[i.kind] || "check", 18)}</span><div class="grow"><div class="t">${esc(i.t)}</div>${+sod(i.at) === i.at ? "" : `<div class="s">${hm(new Date(i.at))}</div>`}</div><span class="gp">+${i.p}</span></div>`).join("")
      : '<div class="empty">Пока ни одного балла — отметьте дело или привычку</div>'}
    ${st.today.base > CAP ? `<div class="muted small" style="margin-top:6px">Потолок ${CAP} в день — дальше баллы не растут.</div>` : ""}${st.today.bonus ? `<div class="row"><span class="gic top">${svgI("bolt", 18)}</span><div class="grow"><div class="t">Чистый день</div></div><span class="gp">+${st.today.bonus}</span></div>` : ""}${st.today.ach ? `<div class="row"><span class="gic goal">${svgI("trophy", 18)}</span><div class="grow"><div class="t">Достижения</div></div><span class="gp">+${st.today.ach}</span></div>` : ""}${st.today.extra.map(x => `<div class="row"><span class="gic top">${svgI(x.ic || "trophy", 18)}</span><div class="grow"><div class="t">${esc(x.t)}</div><div class="s">бонус</div></div><span class="gp">+${x.p}</span></div>`).join("")}</div>`
  const wk = [...Array(7)].map((_, i) => { const d = addDays(monday(new Date()), i), x = st.days.find(y => y.k === dayKey(d)); return { d, v: x ? x.total : 0 } })
  const mx = Math.max(60, ...wk.map(x => x.v))
  html += `<div class="card"><h2>Неделя<span class="muted small" style="font-weight:500;text-transform:none;letter-spacing:0">${num(st.weekPts)} баллов</span></h2><div class="gweek">${wk.map(x => `<div class="${sameDay(x.d, new Date()) ? "td" : ""}"><i style="height:${Math.round(x.v / mx * 86) + 4}px;${x.v ? "" : "background:var(--track)"}"></i><b>${x.v || ""}</b>${WD[x.d.getDay()]}</div>`).join("")}</div></div>`
  html += `<div class="card"><h2>За что баллы</h2>${RULES.map(([ic, k, t, s, p]) => `<div class="row"><span class="gic ${k}">${svgI(ic, 18)}</span><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div><span class="gp">+${p}</span></div>`).join("")}
    <div class="muted small" style="margin-top:6px">Потолок — ${CAP} баллов в день, чтобы не было смысла дробить дела. Чистый день удваивает всё за день.</div></div>`
  const th = Object.entries(THEMES).filter(([, t]) => st.lv >= t[3])
  if (th.length > 1) html += `<div class="card"><h2>Оформление</h2><div class="chips">${th.map(([k, t]) => `<button class="chip ${(D.gamiTheme || "base") === k ? "on" : ""}" data-gtheme="${k}"><i class="gdot" style="background:linear-gradient(135deg,${t[1]},${t[2]})"></i>${esc(t[0])}</button>`).join("")}</div></div>`
  return html
}
const KIND_IC = { task: "check", top: "star", habit: "flame", health: "drop", day: "moon", money: "wallet", goal: "target", focus: "timer", quest: "sparkle", boss: "bolt" }
const RULES = [["check", "task", "Дело", "главное из трёх — 20, повторяющееся — 10", PTS.task], ["flame", "habit", "Привычка", "×1,5 после 5 дней серии, ×2 после 21; новая — ×2 три дня", PTS.habit],
  ["drop", "health", "Цели здоровья", "вода, шаги, белок; тренировка — 15", PTS.health], ["wallet", "money", "День в бюджете", "все траты разнесены по категориям", PTS.money],
  ["moon", "day", "Итоги дня", "закрыть день вечером", PTS.note], ["target", "goal", "Цель месяца", "сбылось желание или мечта — 30", PTS.month], ["timer", "focus", "Фокус 25 минут", "до 4 в день", PTS.focus],
  ["trophy", "goal", "Достижение", "за каждое", ACH_PTS]]
function achPage(st) {
  const l = achList(st), cats = ["Все", "Дела", "Здоровье", "Деньги", "Семья", "Особые"]
  const f = l.filter(a => achCat === "Все" || a.cat === achCat), got = f.filter(a => a.ok), rest = f.filter(a => !a.ok).sort((a, b) => b.p - a.p)
  const cell = a => `<button class="${a.ok ? "" : "lockd"}" data-gach="${a.key}">${medal(a.ok || !a.secret ? a.ic : "star", a.ok || !a.secret ? a.a : "#E5E5EA", a.ok || !a.secret ? a.b : "#8E8E93", 70)}<b>${esc(a.ok || !a.secret ? a.t : "???")}</b><small>${esc(a.s)}</small>${a.ok || a.secret ? "" : `<span class="gprog"><i style="width:${Math.round(a.p * 100)}%"></i></span>`}</button>`
  return `<div class="chips pf">${cats.map(c => `<button class="chip ${achCat === c ? "on" : ""}" data-gcat="${c}">${c}</button>`).join("")}</div>
    <div class="card"><h2>Получены<span class="muted small" style="font-weight:500;text-transform:none;letter-spacing:0">${l.filter(a => a.ok).length} из ${l.length}</span></h2>${got.length ? `<div class="gbdg">${got.map(cell).join("")}</div>` : '<div class="empty">Пока нет — ближайшие ниже</div>'}</div>
    ${rest.length ? `<div class="card"><h2>Скоро</h2><div class="gbdg">${rest.map(cell).join("")}</div></div>` : ""}`
}
const REW_IC = ["coffee", "film", "gift", "heart", "plane", "shirt", "book", "calm", "dumbbell", "star"]
const REW_IDEAS = [["Кофе в любимом месте", 150, "coffee"], ["Вечер кино без дел", 500, "film"], ["Ужин в ресторане", 1200, "heart"], ["Новая вещь для себя", 3000, "shirt"], ["Выходной без планов", 2000, "calm"]]
const rewards = () => goalsK("reward").filter(r => r.title).sort((a, b) => (a.cost || 0) - (b.cost || 0))
function rewPage(st) {
  const wkFreeze = goalsK("freeze").filter(f => f.date >= +monday(new Date())).length, maxF = st.lv >= 3 ? 2 : 1
  let html = `<div class="gbal"><span class="ic">${svgI("star", 24, 2.2)}</span><div class="grow"><b>На счету ${num(st.balance)}</b><span>Потратили — ранг остаётся: он считается по всем заработанным баллам.</span></div></div>`
  const rs = rewards()
  html += `<div class="card"><h2>Мои награды<button class="act" data-g="rew-add">+ Своя</button></h2>${rs.length ? rs.map(r => { const can = st.balance >= r.cost
    const ev = smartOf(r.cost, r.due, st)
    return `<div class="row grw"><span class="gic rew">${svgI(r.ico || "gift", 20)}</span><div class="grow" data-gedit="${esc(r.id)}"><div class="t">${esc(r.title)}</div><div class="s">${r.due ? `к ${esc(dueLbl(r.due))} · ` : ""}${can ? "можно получить" : `${num(Math.max(0, st.balance))} из ${num(r.cost)}`}${!can && r.due ? ` · <b class="gpace ${ev.late ? "late" : ""}">${ev.late ? `отстаёте: нужно ${num(ev.needPerDay)} в день` : "в темпе"}</b>` : ""}</div>${can ? "" : `<div class="gbar"><i style="width:${Math.round(pct(st.balance, r.cost) * 100)}%"></i></div>`}</div>
      <button class="gbuy ${can ? "" : "off"}" data-gbuy="${esc(r.id)}">${svgI("star", 13, 2.4)} ${num(r.cost)}</button></div>` }).join("")
    : `<div class="muted small" style="margin-bottom:8px">Назначьте себе награду и срок — Изи подскажет честную цену. Например:</div><div class="chips">${REW_IDEAS.map((x, i) => `<button class="chip" data-gidea="${i}">${esc(x[0])} · ${x[1]}</button>`).join("")}</div>`}</div>`
  html += `<div class="card"><h2>Приз за ранг</h2>
    <div class="row grw"><span class="gic health">${svgI("snow", 20)}</span><div class="grow"><div class="t">Заморозка серии</div><div class="s">пропустили день — серия не сгорает · ${maxF} в неделю${st.freezes ? ` · есть ${st.freezes}` : ""}</div></div>
      <button class="gbuy ${st.balance >= FREEZE && wkFreeze < maxF ? "" : "off"}" data-g="freeze">${svgI("star", 13, 2.4)} ${FREEZE}</button></div>
    ${PRIZES.map(([lv, ic, t, s]) => `<div class="row grw"><span class="gic ${st.lv >= lv ? "top" : "lock"}">${svgI(st.lv >= lv ? ic : "lock", 20)}</span><div class="grow"><div class="t">${esc(t)}</div><div class="s">${esc(RANKS[lv - 1][0])} · ${esc(s)}</div></div>${st.lv >= lv ? '<span class="gok">открыто</span>' : `<span class="glock">через ${num(RANKS[lv - 1][1] - st.earned)}</span>`}</div>`).join("")}</div>`
  const sp = goalsK("spend").sort((a, b) => b.date - a.date).slice(0, 6)
  if (sp.length) html += `<div class="card"><h2>Получено</h2>${sp.map(x => `<div class="row"><div class="grow"><div class="t">${esc(x.title)}</div><div class="s">${esc(shortDate(new Date(x.date)))}</div></div><span class="muted">−${num(x.cost)}</span></div>`).join("")}</div>`
  return html
}
// ── Награда по SMART: конкретная (что именно), измеримая (цена в баллах), достижимая (по вашему темпу),
// значимая (зачем), ограниченная сроком (к какой дате). Изи советует цену и говорит, если планка слишком низкая или высокая.
const REW_KIND = [[/кофе|чай|десерт|морожен|пирож|сладк|снек/i, 150, 2], [/кино|фильм|сериал|игр|вечер|ванн|книг|прогулк/i, 500, 5],
  [/ресторан|ужин|обед|массаж|спа|spa|салон|бар/i, 1200, 14], [/купить|куплю|нов|ракетк|кроссов|одежд|часы|телефон|наушник|гаджет|вещ/i, 3000, 30],
  [/поездк|отпуск|путешеств|билет|море|выходные|уикенд/i, 8000, 90]]
const kindOf = t => (REW_KIND.find(k => k[0].test(t || "")) || [null, 500, 7])
function pace(st = stats()) {   // средние баллы в день за 14 прошлых дней (без сегодня); новичку — 80
  const past = st.days.slice(-15, -1), n = past.length
  const avg = n ? past.reduce((a, x) => a + x.total, 0) / n : 0
  return Math.round(n >= 3 ? Math.max(30, avg) : Math.max(80, avg))
}
const r50 = n => Math.max(50, Math.round(n / 50) * 50)
const daysTo = due => { const d = due && parseIso(due); return d ? Math.max(1, Math.round((sod(d) - sod(new Date())) / 864e5)) : 0 }
const dueLbl = due => { const d = parseIso(due); return d ? `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""}` : "" }
// Оценка: на награды уходит ~70% заработанного, остальное — на другие награды и заморозки
function smartOf(cost, due, st = stats(), title = "") {
  const p = pace(st), share = Math.round(p * 0.7), days = daysTo(due) || kindOf(title)[2]
  const rec = r50(share * days), need = Math.max(0, cost - st.balance), daysNeed = Math.ceil(need / Math.max(1, share))
  const needPerDay = Math.ceil(need / Math.max(1, daysTo(due) || days))
  const late = !!due && need > 0 && needPerDay > p
  let v = "ok", msg
  if (!cost) { v = "none"; msg = `Совет Изи: ${num(rec)} баллов — столько вы наберёте за ${days} ${plural(days, "день", "дня", "дней")} в своём темпе (${num(p)} в день).` }
  else if (cost < rec * 0.5 && need === 0) { v = "low"; msg = `Слишком легко: баллов уже хватает, а срок ${days} ${plural(days, "день", "дня", "дней")}. Награда радует, когда заслужена — поднимите до ${num(rec)}.` }
  else if (cost < rec * 0.5) { v = "low"; msg = `Планка низковата: за ${days} ${plural(days, "день", "дня", "дней")} вы наберёте около ${num(share * days)}. Поднимите до ${num(rec)}, чтобы было ради чего стараться.` }
  else if (cost > rec * 1.6) { const fit = addDays(new Date(), daysNeed); v = "high"
    msg = `Слишком высоко для этого срока: в вашем темпе нужно ${daysNeed} ${plural(daysNeed, "день", "дня", "дней")}. Понизьте до ${num(rec)} или перенесите срок на ${dueLbl(dayKey(fit))}.` }
  else msg = `В самый раз: в вашем темпе (${num(p)} в день) успеете${due ? " к " + dueLbl(due) : ""}${daysNeed ? ` — нужно около ${daysNeed} ${plural(daysNeed, "дня", "дней", "дней")}` : ""}.`
  return { v, msg, rec, pace: p, days, daysNeed, needPerDay, late, fit: dayKey(addDays(new Date(), daysNeed)) }
}
const DUES = [["Завтра", 1], ["Неделя", 7], ["2 недели", 14], ["Месяц", 30], ["3 месяца", 90]]
function rewAdd(idea, edit) {
  const st = stats(), r0 = edit || {}
  let title = r0.title || (idea ? idea[0] : ""), cost = r0.cost || (idea ? idea[1] : 0), why = r0.why || ""
  let due = r0.due || (idea || title ? dayKey(addDays(new Date(), kindOf(title)[2])) : "")
  const s = sheet(`<h3>${edit ? "Награда" : "Своя награда"}</h3><div class="msg">Цель по SMART: что именно, сколько баллов и к какому сроку.</div>
    <div class="field"><label>Что именно</label><input id="rw-t" value="${esc(title)}" placeholder="Например: массаж в субботу"></div>
    <div class="field"><label>К какому сроку</label><div class="chips" id="rw-d">${DUES.map(([t, n]) => `<button class="chip" data-n="${n}">${t}</button>`).join("")}</div><input id="rw-due" type="date" value="${esc(due)}" style="margin-top:8px"></div>
    <div class="field"><label>Цена в баллах</label><input id="rw-c" type="number" inputmode="numeric" value="${cost || ""}" placeholder="Совет Изи ниже"></div>
    <div class="gsmart" id="rw-h"></div>
    <div class="field"><label>Зачем мне это (необязательно)</label><input id="rw-w" value="${esc(why)}" placeholder="Например: отдохнуть после сделки"></div>
    <div class="btns">${edit ? '<button class="btn red" data-a="del">Удалить</button>' : '<button class="btn" data-a="no">Отмена</button>'}<button class="btn primary" data-a="ok">Сохранить</button></div>`)
  const $t = $("#rw-t", s.el), $c = $("#rw-c", s.el), $d = $("#rw-due", s.el), $h = $("#rw-h", s.el)
  const upd = () => {
    title = $t.value.trim(); cost = Math.round(+$c.value || 0); due = $d.value
    const e = smartOf(cost, due, stats(), title)
    $$("#rw-d .chip", s.el).forEach(b => b.classList.toggle("on", daysTo(due) === +b.dataset.n))
    $h.className = "gsmart " + e.v
    $h.innerHTML = `<b class="orb"></b><div>${esc(e.msg)}${e.v !== "ok" ? `<div class="chips"><button class="chip on" data-rec="${e.rec}">Поставить ${num(e.rec)}</button>${e.v === "high" ? `<button class="chip" data-fit="${e.fit}">Срок ${esc(dueLbl(e.fit))}</button>` : ""}</div>` : ""}</div>`
    $$("[data-rec]", $h).forEach(b => b.onclick = () => { $c.value = b.dataset.rec; upd() })
    $$("[data-fit]", $h).forEach(b => b.onclick = () => { $d.value = b.dataset.fit; upd() })
  }
  $$("#rw-d .chip", s.el).forEach(b => b.onclick = () => { $d.value = dayKey(addDays(new Date(), +b.dataset.n)); if (!$c.value) $c.value = ""; upd() })
  $t.oninput = () => { if (!$d.value && $t.value.trim().length > 2) $d.value = dayKey(addDays(new Date(), kindOf($t.value)[2])); upd() }
  $c.oninput = upd; $d.onchange = upd
  upd()
  if (!title) setTimeout(() => $t.focus(), 250)
  const close = () => s.close()
  const no = $('[data-a="no"]', s.el); if (no) no.onclick = close
  const del = $('[data-a="del"]', s.el); if (del) del.onclick = () => { remove("goals", r0.id); save(); close(); render() }
  $('[data-a="ok"]', s.el).onclick = () => {
    upd()
    if (!title) return toast("Напишите, что за награда")
    if (!cost || cost < 10) cost = smartOf(0, due, stats(), title).rec
    const ico = r0.ico || (idea && idea[2]) || REW_IC[Math.abs([...title].reduce((a, c) => a + c.charCodeAt(0), 0)) % REW_IC.length]
    upsert("goals", Object.assign({}, r0.id ? r0 : { id: uid("w"), date: Date.now(), kind: "reward" }, { title: title.slice(0, 60), cost, ico, due: due || null, why: $("#rw-w", s.el).value.trim().slice(0, 120) }))
    save(); close(); render()
  }
}
async function rewBuy(id) {
  const r = rewards().find(x => x.id === id), st = stats()
  if (!r) return
  if (st.balance < r.cost) return toast(`Не хватает ${num(r.cost - st.balance)} баллов`)
  const a = await ui.confirm(r.title, `<div class="msg">Списать ${num(r.cost)} баллов? Ранг не изменится. Награду можно взять снова, когда накопите.</div>`, ["Отмена", "Получить"])
  if (a !== "Получить") return
  upsert("goals", { id: uid("s"), date: Date.now(), kind: "spend", title: r.title, cost: r.cost, reward: r.id })
  save(); render()
  celeSheet(`<div class="k">Награда</div><div class="emb">${medal(r.ico || "gift", "#FFE680", "#FFB800", 140)}</div><h1>${esc(r.title)}</h1><p>Заслужено. Наслаждайтесь.</p>`)
}
async function freezeBuy() {
  const st = stats(), maxF = st.lv >= 3 ? 2 : 1, wk = goalsK("freeze").filter(f => f.date >= +monday(new Date())).length
  if (wk >= maxF) return toast(`Не больше ${maxF} в неделю`)
  if (st.balance < FREEZE) return toast(`Не хватает ${num(FREEZE - st.balance)} баллов`)
  upsert("goals", { id: uid("z"), date: Date.now(), kind: "freeze", day: null })
  upsert("goals", { id: uid("s"), date: Date.now(), kind: "spend", title: "Заморозка серии", cost: FREEZE })
  save(); render(); toast("Заморозка готова: пропуск одного дня не сожжёт серию")
}

// ───────────── Лига друзей и вызовы ─────────────
// D.league = { url, code, name, id, me, owner, data, at, won, chWon } — живёт на телефоне; сама лига — в таблице хозяина
const lgOn = () => !!(D.league && D.league.code && D.league.url)
async function lgPost(url, q, secret) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000)
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, credentials: "omit", cache: "no-store", signal: ctl.signal,
      body: JSON.stringify(Object.assign(secret ? { secret } : {}, { league: q })) })
    return await r.json()
  } catch (e) { return { ok: false, error: "нет связи" } } finally { clearTimeout(t) }
}
function myWeek(st) {
  const t0 = sod(new Date()), w0 = monday(t0)
  let steps = 0, water = 0
  for (let d = w0; d <= t0; d = addDays(d, 1)) { const h = dayHealth(d); steps += h.steps || 0; if (h.water >= (H().waterGoal || 2000)) water++ }
  return { week: dayKey(w0), pts: st.weekPts, steps, water }
}
let lgBusy = false
async function lgPush(force) {
  if (gOff() || !lgOn() || lgBusy || (!force && Date.now() - (D.league.at || 0) < 20 * 60e3)) return
  lgBusy = true
  try {
    const st = stats(), w = myWeek(st), L = D.league
    const r = await lgPost(L.url, Object.assign({ op: "put", code: L.code, id: L.id, name: L.me, rank: st.rank, level: st.lv, streak: st.streak }, w))
    if (r && r.ok && r.league) { lgResults(r.league, st); L.data = r.league; L.at = Date.now(); L.error = ""; save(false); if (tab === "plans" && gSeg === "lg") render() }
    else if (r) { L.error = r.error || "лига не ответила"; save(false) }
  } finally { lgBusy = false }
}
// Победы прошлой недели: первое место в лиге и выигранные вызовы — для ачивок
function lgResults(lg, st) {
  const L = D.league, last = dayKey(addDays(monday(new Date()), -7))
  if (L.judged === last) return
  const ms = Object.entries(lg.members || {}).map(([id, m]) => ({ id, w: (m.weeks || {})[last] })).filter(x => x.w)
  if (ms.length >= 2) {
    const best = ms.slice().sort((a, b) => b.w.pts - a.w.pts)[0]
    if (best.id === L.id) L.won = true
    for (const c of (lg.challenges || []).filter(c => c.week === last)) {
      const who = ms.filter(x => x.id === c.by || (c.with || []).includes(x.id)).sort((a, b) => (b.w[c.kind] || 0) - (a.w[c.kind] || 0))[0]
      if (who && who.id === L.id) L.chWon = (L.chWon || 0) + 1
    }
  }
  L.judged = last
}
const CH = { pts: ["Кто больше баллов", "star", "баллов"], steps: ["Кто больше шагов", "walk", "шагов"], water: ["Кто чаще пьёт норму воды", "drop", "дней с нормой"] }
const AV = [["#C9A7FF", "#7E3FD9"], ["#7CC8FF", "#0A6FE0"], ["#FFB86B", "#E5532B"], ["#9BE15D", "#2E9E46"], ["#FF9FB0", "#E0245E"], ["#7DE0EC", "#1E8FA3"]]
function lgPage(st) {
  let html = ""
  const w = myWeek(st), lead = st.weekPts - st.lastSpanPts
  html += `<div class="card"><h2>Вы против себя прошлой недели</h2><div class="gvs"><div><b class="g">${num(st.weekPts)}</b><span>эта неделя</span></div><em>к ${WD[new Date().getDay()]}</em><div><b>${num(st.lastSpanPts)}</b><span>прошлая</span></div></div>
    <div class="gtwo"><i style="flex:${Math.max(1, st.weekPts)}"></i><i style="flex:${Math.max(1, st.lastSpanPts)}"></i></div>
    <div class="muted small" style="margin-top:8px">${st.lastSpanPts ? (lead >= 0 ? `Опережаете на ${num(lead)} баллов.` : `Отстаёте на ${num(-lead)} баллов — ещё можно догнать.`) : "Прошлая неделя ещё не записана — сравнение появится через неделю."}${weakSpot(st)}</div></div>`
  if (!lgOn()) {
    html += `<div class="card"><h2>Лига друзей</h2><div class="muted small">Неделя баллов с семьёй и друзьями. Друзья видят только ваши баллы, ранг и серию — не дела и не траты. Нужно, чтобы у друга тоже был IZIDAY.</div>
      <button class="btn primary wide" style="margin-top:12px" data-g="lg-new">${svgI("users", 16)} Создать лигу</button>
      <div class="muted small" style="margin-top:8px">Есть ссылка от друга? Просто откройте её — вступите сразу.</div></div>`
    return html
  }
  const L = D.league, lg = L.data || { members: {}, challenges: [] }, wk = w.week
  const ms = Object.entries(lg.members || {}).map(([id, m]) => ({ id, m, w: (m.weeks || {})[wk] || { pts: 0, steps: 0, water: 0 } })).sort((a, b) => b.w.pts - a.w.pts)
  if (!ms.some(x => x.id === L.id)) ms.push({ id: L.id, m: { name: L.me, rank: st.rank, streak: st.streak }, w })
  html += `<div class="card glb"><h2>${esc(lg.name || L.name || "Лига")}<span class="muted small" style="font-weight:500;text-transform:none;letter-spacing:0">${L.error ? esc(L.error) : "видны только баллы"}</span></h2>
    ${ms.map((x, i) => { const me = x.id === L.id, c = AV[i % AV.length], pts = me ? st.weekPts : x.w.pts
      return `<div class="row ${me ? "me" : ""}"><span class="pl">${i + 1}</span><span class="av" style="background:linear-gradient(135deg,${c[0]},${c[1]})">${esc((x.m.name || "?").slice(0, 1).toUpperCase())}</span><div class="grow"><div class="t">${me ? "Вы" : esc(x.m.name)}</div><div class="s">${esc(me ? st.rank : x.m.rank || "")}${(me ? st.streak : x.m.streak) ? ` · серия ${me ? st.streak : x.m.streak}` : ""}</div></div>${coin(pts)}</div>` }).join("")}
    <div class="btns" style="margin-top:10px"><button class="btn" data-g="lg-invite">${svgI("link", 16)} Пригласить</button><button class="btn" data-g="lg-ch">${svgI("users", 16)} Вызов</button></div></div>`
  const chs = (lg.challenges || []).filter(c => c.week === wk)
  for (const c of chs) {
    const [t, ic, unit] = CH[c.kind] || CH.pts, who = ms.filter(x => x.id === c.by || (c.with || []).includes(x.id) || !(c.with || []).length)
    const val = x => x.id === L.id ? w[c.kind] : x.w[c.kind] || 0, top = Math.max(1, ...who.map(val))
    html += `<div class="card"><h2>${esc(c.title || t)}<span class="muted small" style="font-weight:500;text-transform:none;letter-spacing:0">до воскресенья</span></h2>${c.stake ? `<div class="muted small" style="margin-bottom:6px">Ставка: ${esc(c.stake)}</div>` : ""}
      ${who.sort((a, b) => val(b) - val(a)).map(x => `<div class="gch"><span>${x.id === L.id ? "Вы" : esc(x.m.name)}</span><div class="gbar"><i style="width:${Math.round(val(x) / top * 100)}%"></i></div><b>${num(val(x))}</b></div>`).join("")}<div class="muted small">${esc(unit)}</div></div>`
  }
  html += `<div class="muted small" style="text-align:center;margin:4px 0 12px"><button class="linkbtn" data-g="lg-leave">Выйти из лиги</button></div>`
  return html
}
function weakSpot(st) {
  const d = st.week.filter(x => x.d < sod(new Date()))
  if (d.length < 2) return ""
  const noW = d.filter(x => !x.items.some(i => i.id.startsWith("w:"))).length
  return noW >= Math.ceil(d.length / 2) ? ` Слабое место — вода: ${noW} ${plural(noW, "день", "дня", "дней")} из ${d.length} без нормы.` : ""
}
async function lgNew() {
  if (!D.conn || !D.conn.hook) return ui.info("Нужна таблица", "Лига хранится в вашей Google Таблице. Сначала подключите приложение к виджету.")
  const me = await ui.ask("Как вас подписать?", "Это имя увидят друзья в лиге.", D.gamiName || "", { placeholder: "Например: Ильдар" })
  if (!me) return
  const name = await ui.ask("Название лиги", "", "Семья и друзья") || "Лига"
  toast("Создаю лигу…")
  const r = await lgPost(D.conn.hook, { op: "new", name }, D.conn.secret)
  if (!r || !r.ok || !r.league) return ui.info("Лига пока не создаётся", r && r.error && r.error !== "нет связи" ? `Таблица ответила: ${r.error}` : r && r.ok ? "В таблице ещё старая версия скрипта — после её обновления лига заработает." : "Нет связи с таблицей. Попробуйте позже.")
  D.gamiName = me
  D.league = { url: D.conn.hook, code: r.league.code, name: r.league.name, id: uid("u"), me, owner: true, data: r.league, at: 0 }
  save(false); await lgPush(true); render(); lgInvite()
}
function lgLink() { const L = D.league; return location.origin + location.pathname + "#league=" + btoa(unescape(encodeURIComponent(JSON.stringify({ u: L.url, c: L.code, n: L.name })))).replace(/=+$/, "") }
async function lgInvite() {
  const url = lgLink(), text = `Давай соревноваться в IZIDAY: лига «${D.league.name}». Открой ссылку в IZIDAY: ${url}`
  try { if (navigator.share) return await navigator.share({ title: "Лига IZIDAY", text }) } catch (e) { if (e && e.name === "AbortError") return }
  try { await navigator.clipboard.writeText(text); toast("Ссылка скопирована") } catch (e) { ui.info("Ссылка-приглашение", url) }
}
async function lgJoin() {
  const code = pendingJoin; pendingJoin = null
  if (!code) return
  if (gOff()) return toast("Лига — часть режима игры. Включите его в Настройках")
  let x; try { x = JSON.parse(decodeURIComponent(escape(atob(code.replace(/-/g, "+").replace(/_/g, "/"))))) } catch (e) { return toast("Ссылка на лигу повреждена") }
  if (!x || !x.u || !x.c || !/^https:\/\/script\.google\.com\//.test(x.u)) return toast("Ссылка на лигу повреждена")
  if (lgOn() && D.league.code === x.c) { setTab("plans"); return openGame("lg") }
  const me = await ui.ask(`Вступить в лигу «${x.n || "Лига"}»?`, "Друзья увидят только ваши баллы, ранг и серию. Как вас подписать?", D.gamiName || "", { placeholder: "Ваше имя", ok: "Вступить" })
  if (!me) return
  D.gamiName = me
  D.league = { url: x.u, code: x.c, name: x.n || "Лига", id: uid("u"), me, owner: false, data: null, at: 0 }
  save(false); await lgPush(true)
  if (D.league.error) toast(`Лига: ${D.league.error}`)
  openGame("lg")
}
async function lgChallenge() {
  const L = D.league, lg = L.data || {}, others = Object.entries(lg.members || {}).filter(([id]) => id !== L.id)
  if (!others.length) return ui.info("Пока не с кем", "Пригласите друга по ссылке — тогда можно будет бросить вызов.")
  const k = await ui.choose("Вызов до воскресенья", "", Object.values(CH).map(c => c[0]))
  if (k < 0) return
  const kind = Object.keys(CH)[k]
  let withIds = []
  if (others.length > 1) { const j = await ui.choose("С кем?", "", ["Со всеми", ...others.map(([, m]) => m.name)]); if (j < 0) return; if (j > 0) withIds = [others[j - 1][0]] }
  else withIds = [others[0][0]]
  const stake = await ui.ask("Ставка", "Необязательно. Например: проигравший готовит ужин.", "", { placeholder: "На что спорим" }) || ""
  const r = await lgPost(L.url, { op: "challenge", code: L.code, id: L.id, kind, week: wkKey(new Date()), title: CH[kind][0], stake, with: withIds })
  if (r && r.ok && r.league) { L.data = r.league; save(false); render(); toast("Вызов брошен") } else toast(`Не получилось: ${(r && r.error) || "нет связи"}`)
}
async function lgLeave() {
  const a = await ui.confirm("Выйти из лиги?", '<div class="msg">Ваши баллы и ранг останутся. Вернуться можно по ссылке друга.</div>', ["Отмена", "Выйти"])
  if (a !== "Выйти") return
  const L = D.league; lgPost(L.url, { op: "leave", code: L.code, id: L.id })
  D.league = null; save(false); render()
}

// ───────────── Изи: инструменты и правила ─────────────
function summary0() {
  const st = stats(), l = achList(st)
  return { rank: st.rank, level: st.lv, of: RANKS.length, points_total: st.earned, balance: st.balance, next_rank: st.next ? { name: st.next[0], need: st.next[1] - st.earned } : null,
    streak_days: st.streak, freezes: st.freezes, today: { points: st.today.total, items: st.today.items.map(i => `${i.t} +${i.p}`), clean_day: st.today.clean.ok, left_for_clean_day: st.today.clean.left },
    week: { points: st.weekPts, last_week_same_days: st.lastSpanPts }, achievements: l.filter(a => a.ok).map(a => a.t), nearest: l.filter(a => !a.ok && !a.secret).sort((a, b) => b.p - a.p).slice(0, 3).map(a => `${a.t}: ${a.s} (${num(a.have)} из ${num(a.need)})`),
    rewards: rewards().map(r => `${r.title} — ${r.cost}${r.due ? ", к " + r.due : ""}`), pace_per_day: pace(st), league: lgOn() && D.league.data ? Object.values(D.league.data.members || {}).map(m => `${m.name}: ${((m.weeks || {})[wkKey(new Date())] || {}).pts || 0}`) : null,
    rules: `дело ${PTS.task}, главное из трёх ${PTS.top}, привычка ${PTS.habit} (×1,5 с 5 дней серии, ×2 с 21), цели воды/шагов/белка ${PTS.health}, тренировка ${PTS.workout}, итоги дня ${PTS.note}, цель месяца ${PTS.month}; потолок ${CAP} в день; чистый день ×2` }
}
function summary() { const out = summary0(); gx(GX.sum, out, stats()); return out }
const TOOLS = [
  { name: "get_progress", description: "Баллы, ранг, серия, ачивки, награды и лига друзей пользователя (игра IZIDAY). Вызывай, когда спрашивают про баллы, ранг, награды, соревнование, или чтобы похвалить за день.", input_schema: { type: "object", properties: {} } },
  { name: "add_reward", description: "Добавить награду, которую пользователь купит за баллы, по SMART: что именно, цена в баллах, срок (due). Без cost — поставит цену по темпу пользователя. Ответ содержит оценку (verdict low/high/ok, recommended) — если цена слишком низкая или высокая для срока, скажи об этом и предложи recommended или другой срок.",
    input_schema: { type: "object", properties: { title: { type: "string" }, cost: { type: "number" }, due: { type: "string", description: "YYYY-MM-DD — к какому сроку" }, why: { type: "string" } }, required: ["title"] } },
]
function wrapIzi() {
  TOOLS.forEach(t => { if (!AGENT_TOOLS.some(x => x.name === t.name)) AGENT_TOOLS.push(t) })
  try { Object.assign(TOOL_STATUS, { get_progress: "смотрю баллы", add_reward: "добавляю награду" }) } catch (e) {}
  const run0 = runTool
  runTool = async function (name, x) {
    if ((name === "get_progress" || name === "add_reward") && gOff()) return { error: "Режим игры выключен пользователем. Включить: Настройки → Режим игры." }
    if (name === "get_progress") return summary()
    if (name === "add_reward") { if (!x.title) return { error: "нужен title" }
      const st = stats(), due = /^\d{4}-\d\d-\d\d$/.test(x.due || "") ? x.due : dayKey(addDays(new Date(), kindOf(x.title)[2]))
      const cost = Math.round(+x.cost || 0) >= 10 ? Math.round(+x.cost) : smartOf(0, due, st, x.title).rec, e = smartOf(cost, due, st, x.title)
      upsert("goals", { id: uid("w"), date: Date.now(), kind: "reward", title: String(x.title).trim().slice(0, 60), cost, due, why: String(x.why || "").slice(0, 120), ico: REW_IC[cost % REW_IC.length] }); save()
      return { ok: true, cost, due, balance: st.balance, pace_per_day: e.pace, verdict: e.v, recommended: e.rec, advice: e.msg } }
    return run0.apply(this, arguments)
  }
  const sys0 = agentSystem
  agentSystem = function () {
    if (gOff()) return sys0.apply(this, arguments) + `
- Режим игры (баллы, ранги, ачивки, награды, лига) пользователь выключил. Не упоминай баллы, ранги и ачивки. Если спросит про них — скажи, что включить можно в Настройках → «Режим игры», прогресс сохранён.`
    return sys0.apply(this, arguments) + `
- Игра IZIDAY: за дела, привычки, нормы воды и шагов, итоги дня начисляются баллы, из них растёт ранг (10 рангов), есть ачивки, свои награды за баллы и лига друзей. Подробности — get_progress. Когда пользователь закрыл дело или день, можно коротко сказать, сколько баллов это дало и сколько до следующего ранга, без пафоса. Награду за баллы добавляй через add_reward по SMART: уточни, что именно и к какому сроку; если пользователь назвал цену слишком низкую или высокую для своего темпа — мягко предложи recommended или другой срок.
- Предлагая новую привычку: не больше трёх вариантов, под реальный день и данные пользователя, каждая — маленькая и конкретная (что и когда). Новые привычки первые 3 дня дают двойные баллы. Если серия привычки рвётся и привычек много, предлагай упростить, а не добавлять.`
  }
}

// ───────────── Встраивание в экраны ─────────────
function openGame(seg) { if (seg) gSeg = seg; plansF = "game"; if (tab !== "plans") setTab("plans"); else render(); scrollView(false) }
function applyTheme() { const t = !gOff() && D.gamiTheme && D.gamiTheme !== "base" && THEMES[D.gamiTheme] && stats().lv >= THEMES[D.gamiTheme][3] ? D.gamiTheme : ""; if (t) document.documentElement.dataset.gtheme = t; else delete document.documentElement.dataset.gtheme }
function wrapScreens() {
  PLAN_F.splice(1, 0, ["game", "Мой путь"])
  const plans0 = renderPlans
  renderPlans = function () {
    if (gOff() && plansF === "game") plansF = "all"
    const html = plans0.apply(this, arguments)
    if (gOff()) return html
    if (plansF === "game") { const i = html.indexOf("</div>") + 6; return html.slice(0, i) + gamePage() }
    // полоса ранга — только на «Сегодня» (на «Планах» она повторялась)
    return html
  }
  const top0 = todayTop
  todayTop = function () { if (gOff()) return top0.apply(this, arguments); const st = stats(); return introHTML(st) + stripHTML(st) + top0.apply(this, arguments) + cleanHTML(st) + GX.today.map(f => { try { return f(st) || "" } catch (e) { console.error("gami+", e); return "" } }).join("") + iziHTML(st) }
  const render0 = render
  const more0 = renderMore
  renderMore = function () { const html = more0.apply(this, arguments), i = html.indexOf('<div class="card"><h2>Связь с виджетом'); return i < 0 ? html + offCard() : html.slice(0, i) + offCard() + html.slice(i) }
  render = function () {
    const out = render0.apply(this, arguments)
    try { const v = $("#view"); if (tab === "today" && !gOff()) badges(v); bindGame(v); if (!gOff()) setTimeout(tick, 30) } catch (e) { console.error("gami", e) }
    return out
  }
}
const GDO = {
  "game-on": () => setGame(true), "game-off": () => setGame(false),
  path: () => openGame("path"),
  "rew-add": () => rewAdd(), freeze: () => freezeBuy(),
  "lg-new": () => lgNew(), "lg-invite": () => lgInvite(), "lg-ch": () => lgChallenge(), "lg-leave": () => lgLeave(),
  "intro-go": () => { D.gamiIntro = 0; save(false); openGame("path") }, "intro-off": () => { D.gamiIntro = 0; save(false); render() },
  "izi-later": () => { D.gamiSug = Date.now(); save(false); render() },
}
for (const k of ["add", "first", "trim"]) GDO["izi-" + k] = () => { const p = iziPick(stats()); D.gamiSug = Date.now(); save(false); setTab("chat"); setTimeout(() => chatSend(IZI_ASK[k](p && p.h || "")), 60) }
function bindGame(v) {
  $$("[data-g]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); const f = GDO[b.dataset.g]; if (f) f() })
  $$("[data-gseg]", v).forEach(b => b.onclick = () => { gSeg = b.dataset.gseg; render(); if (gSeg === "lg") lgPush(false) })
  $$("[data-gcat]", v).forEach(b => b.onclick = () => { achCat = b.dataset.gcat; render() })
  $$("[data-gbuy]", v).forEach(b => b.onclick = () => rewBuy(b.dataset.gbuy))
  $$("[data-gedit]", v).forEach(b => b.onclick = () => { const r = rewards().find(x => x.id === b.dataset.gedit); if (r) rewAdd(null, r) })
  $$("[data-gidea]", v).forEach(b => b.onclick = () => rewAdd(REW_IDEAS[+b.dataset.gidea]))
  $$("[data-gtheme]", v).forEach(b => b.onclick = () => { D.gamiTheme = b.dataset.gtheme; save(false); applyTheme(); render() })
  $$("[data-gach]", v).forEach(b => b.onclick = () => { const a = achList(stats()).find(x => x.key === b.dataset.gach); if (!a) return
    const s = sheet(`<div class="gachs">${medal(a.ok || !a.secret ? a.ic : "star", a.ok || !a.secret ? a.a : "#E5E5EA", a.ok || !a.secret ? a.b : "#8E8E93", 120)}<h3>${esc(a.ok || !a.secret ? a.t : "Секретная ачивка")}</h3><div class="msg">${esc(a.ok ? (ACH_DESC[a.key] || a.s) : a.secret ? "Откроется сама, когда случится." : a.s)}</div>
      <div class="muted small">${a.ok ? `Получена ${esc(shortDate(new Date(a.at)))} · +${ACH_PTS} баллов` : a.secret ? "" : `${num(a.have)} из ${num(a.need)}`}</div></div>`)
    s.el.classList.add("gach-sheet") })
}

function init() {
  if (typeof D === "undefined" || typeof render !== "function") return
  if (!D.gamiStart) { D.gamiStart = Date.now(); save(false) }
  wrapData(); wrapIzi(); wrapScreens()
  syncOff()
  render()
  setTimeout(() => lgPush(false), 9000)
  setInterval(() => { if (document.visibilityState === "visible") { lgPush(false); if (tab === "today") tick() } }, 5 * 60e3)
  if (pendingJoin) setTimeout(lgJoin, 900)
  else if (D.gamiRankPending) setTimeout(() => { if (!stack.length) showPending() }, 1500)
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && D.gamiRankPending) setTimeout(() => { if (!stack.length) showPending() }, 900) })
  window.GAMI = { off: gOff, set: setGame, stats, achList, summary, smartOf, pace, join: lgJoin, openGame, tick, RANKS, PTS, CAP, GX, RULES, TOOLS, P, svgI, coin, medal, emblem, celeSheet, gToast, hOn, syncOff,
    seg: () => gSeg, setSeg: k => { gSeg = k }, bump: () => { ver++ } }
}
})()
