// «Мой день» — веб-приложение для iPhone. Открывается с экрана «Домой» мгновенно и работает без Scriptable.
// Деньги, еда, вода и тренировки хранятся на телефоне и через Google Таблицу совпадают с виджетом.
// Календарь — Google Календарь через таблицу; напоминания живут в приложении (уведомления по ним ставит виджет).
// Данные часов и место видит только iPhone: их присылает виджет (снимок).
// Разбор фраз, деньги и отчёты — общее ядро с виджетом (core.js, собирается build_web.py).
"use strict"

const core = window.CORE
const STORE = "myday.web"

// ───────────── Мелочи ─────────────
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
const z2 = n => String(n).padStart(2, "0")
const hm = d => `${z2(d.getHours())}:${z2(d.getMinutes())}`
const dayKey = d => `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`
const iso = d => `${dayKey(d)}T${hm(d)}`
const sod = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const sameDay = (a, b) => dayKey(new Date(a)) === dayKey(new Date(b))
const num = n => Math.round(n || 0).toLocaleString("ru-RU").replace(/ /g, " ")
const liters = ml => (Math.round((ml || 0) / 10) / 100).toString().replace(".", ",")
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"]
const DAY_NAMES = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"]
const MON_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
const fullDate = d => `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MON_GEN[d.getMonth()]}`
const shortDate = d => `${WD[d.getDay()]}, ${d.getDate()} ${MON_GEN[d.getMonth()]}`
function dayName(d) {
  const diff = Math.round((sod(d) - sod(new Date())) / 864e5)
  return diff === 0 ? "сегодня" : diff === 1 ? "завтра" : diff === -1 ? "вчера" : shortDate(d)
}
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10
  return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many
}
// «2026-11-03T15:00» или «2026-11-03» — местное время
function parseIso(s) {
  const m = String(s || "").match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/)
  return m ? new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0) : null
}
function ago(t) {
  if (!t) return "никогда"
  const m = Math.round((Date.now() - t) / 60000)
  return m < 1 ? "только что" : m < 60 ? `${m} мин назад` : sameDay(t, Date.now()) ? `в ${hm(new Date(t))}` : `${dayName(new Date(t))}, ${hm(new Date(t))}`
}

function toast(t) {
  const el = $("#toast")
  el.textContent = t
  el.classList.add("show")
  clearTimeout(toast.t)
  toast.t = setTimeout(() => el.classList.remove("show"), 2400)
}

const ICO = {
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8.5 15l2 2 4-4"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M8.5 8.5h7M8.5 11.5h4.5"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="13" rx="3"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/></svg>',
  health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/><path d="M7 12h3l1.3-2.5L13 14l1.2-2H17"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" fill="#fff"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>',
  find: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
  sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9"/><path d="M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2"/></svg>',
}

// ───────────── Данные на телефоне ─────────────
// Записи — как в виджете: { id, date, u (время изменения), ... }; удалённые остаются «надгробиями» { id, deleted, u },
// чтобы удаление дошло до виджета и таблицы
const LISTS = { money: 0, food: 120, water: 60, workouts: 400, places: 0, memory: 0, locs: 60, nudges: 3, rems: 0, skips: 60, budgets: 0, recur: 0, habits: 0, hlog: 400, weight: 0 }   // rems — напоминания живут в приложении, не в iPhone   // places — «напомни, когда буду рядом» (проверяет виджет)
let D = {}
function load() {
  try { D = JSON.parse(localStorage.getItem(STORE) || "{}") || {} } catch (e) { D = {} }
  for (const k of [...Object.keys(LISTS), "chat", "ops", "chatArchive"]) if (!Array.isArray(D[k])) D[k] = []
  D.conn = D.conn || null
  D.sync = Object.assign({ since: 0, pushedAt: 0, snapAt: 0, at: 0, error: "" }, D.sync || {})
  applyCfg()
}
let saveT = null
function save(push = true) {
  try { localStorage.setItem(STORE, JSON.stringify(D)) } catch (e) { toast("Не удалось сохранить на телефоне: " + e.message) }
  if (push) { clearTimeout(saveT); saveT = setTimeout(() => sync(), 900) }
}
// Личные настройки виджета (категории, календари, цели) приходят с кодом подключения
function applyCfg() {
  const cfg = D.conn && D.conn.cfg
  if (!cfg) return
  const c = core.CONFIG
  for (const k of ["currency", "currencyIn", "currencyWords", "agentModel", "defaultEventMinutes", "defaultReminderHour", "briefs", "categories"]) if (cfg[k] != null) c[k] = cfg[k]
  if (cfg.health) c.health = Object.assign({}, c.health, cfg.health)
  if (Array.isArray(cfg.calendars)) c.calendars = cfg.calendars
}
const H = () => Object.assign({ waterGoal: 2000, glass: 250, moveGoal: 500, exerciseGoal: 30, weight: 80, kcalGoal: 2000 }, core.CONFIG.health || {})
const live = list => list.filter(x => x && !x.deleted)
function upsert(key, rec) {
  rec.u = Date.now()
  const i = D[key].findIndex(x => x.id === rec.id)
  if (i >= 0) D[key][i] = rec; else D[key].push(rec)
  save()
  return rec
}
function remove(key, id) { upsert(key, { id, deleted: true }) }
// Слияние как в виджете (mergeSynced): по id побеждает более позднее изменение
function mergeIn(key, incoming) {
  const map = new Map(D[key].map(x => [x.id, x]))
  for (const x of incoming || []) {
    if (!x || !x.id) continue
    const cur = map.get(x.id)
    if (!cur || (x.u || 0) > (cur.u || 0)) { const y = Object.assign({}, x); delete y.s; map.set(x.id, y) }
  }
  const days = LISTS[key], keepTomb = Date.now() - 90 * 864e5
  D[key] = [...map.values()].filter(x => x.deleted ? (x.u || 0) > keepTomb : !days || (x.date || 0) > Date.now() - days * 864e5)
}

// ───────────── Обмен с таблицей (и через неё с виджетом) ─────────────
let syncing = null
// На iPhone Safari рвёт запрос («Load failed»), если приложение свернули или сменилась сеть — один повтор
async function hubPost(h, timeout = 30000) {
  try { return await hubPostOnce(h, timeout) } catch (e) {
    if (e.name !== "TypeError") throw e
    await sleep(1200)
    try { return await hubPostOnce(h, timeout) } catch (e2) {
      if (e2.name === "TypeError") throw new Error(`нет связи с таблицей (${e2.message})`)
      throw e2
    }
  }
}
async function hubPostOnce(h, timeout) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeout)
  try {
    const r = await fetch(D.conn.hook, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, signal: ctl.signal, credentials: "omit", cache: "no-store",
      body: JSON.stringify({ secret: D.conn.secret, hub: Object.assign({ from: "app" }, h) }) })
    const text = await r.text()
    let j
    try { j = JSON.parse(text) } catch (e) { throw new Error(r.ok ? "таблица ответила не данными — разверните скрипт заново с доступом «Все»" : `таблица ответила ошибкой ${r.status}`) }
    if (!j.ok) throw new Error(j.error === "forbidden" ? "таблица не приняла ключ — подключите приложение заново" : j.error || "ошибка таблицы")
    return j
  } finally { clearTimeout(t) }
}
function sync() {
  if (!D.conn || !D.conn.hook) return Promise.resolve(false)
  if (syncing) { syncing.again = true; return syncing.p }
  const state = { again: false }
  state.p = (async () => {
    $("#sync").classList.add("spin")
    try {
      do {
        state.again = false
        const started = Date.now(), lists = {}
        for (const k of Object.keys(LISTS)) lists[k] = D[k].filter(x => (x.u || 0) > D.sync.pushedAt - 60000)
        const ops = D.ops.filter(o => o.state === "local").map(o => ({ id: o.id, tool: o.tool, input: o.input }))
        const res = await hubPost({ since: D.sync.since, snapAt: D.sync.snapAt, lists, ops }, 60000)
        for (const k of Object.keys(LISTS)) mergeIn(k, res.lists && res.lists[k])
        if (res.snap) { D.snap = res.snap; D.sync.snapAt = res.snap.at }
        migrateRems()
        dropWaterRems()
        for (const o of D.ops) if (o.state === "local" && ops.some(x => x.id === o.id)) o.state = "sent"
        for (const so of res.ops || []) {
          const o = D.ops.find(x => x.id === so.id)
          if (o && so.state === "done" && o.state !== "done") { o.state = "done"; o.result = so.result; o.doneAt = so.doneAt; opDone(o) }
        }
        D.ops = D.ops.filter(o => o.state !== "done" || o.doneAt > Date.now() - 864e5)
        if (res.url) D.conn.sheetUrl = D.conn.sheetUrl || res.url
        Object.assign(D.sync, { since: res.now, pushedAt: started, at: Date.now(), error: "" })
        save(false)
      } while (state.again)
      if (!stack.length && tab !== "chat") render()
      else renderTop()
      calRefresh()   // Google Календарь — отдельным запросом, чтобы не задерживать обмен
      return true
    } catch (e) {
      D.sync.error = e.name === "AbortError" ? "таблица не ответила" : String(e.message || e)
      save(false)
      renderTop()
      return false
    } finally { $("#sync").classList.remove("spin"); syncing = null }
  })()
  syncing = state
  return state.p
}
let calForce = false, calBusy = false
async function calRefresh() {
  if (calBusy || !D.conn || !(calForce || !D.gcal || Date.now() - (D.gcal.at || 0) > 120e3)) return
  calBusy = true; calForce = false
  try {
    const r = (await hubPost({ cal: { action: "list", from: dayKey(addDays(sod(new Date()), -21)) } }, 60000)).cal
    if (r) D.gcal = r.events ? { ok: true, at: Date.now(), events: r.events, calendars: r.calendars || [] } : { ok: !!(D.gcal && D.gcal.ok), at: Date.now(), events: (D.gcal && D.gcal.events) || [], error: r.error || "" }
    save(false)
    if (!stack.length && tab !== "chat") render()
  } catch (e) {} finally { calBusy = false }
}
// Google Календарь — через таблицу (Apps Script). Пока доступ не выдан — по-старому, через календарь iPhone
const gcalOn = () => !!(D.gcal && D.gcal.ok)
async function calDo(action, input) {
  const res = await hubPost({ cal: Object.assign({ action }, input) })
  const r = res.cal || { error: "таблица не знает календарь — нужно обновить скрипт" }
  if (!r.error) { calForce = true; sync() }
  return r
}
// Напоминания приложения: { id, date, title, due, notes, repeat, done, doneAt }
function remAdd(x) {
  const now = Date.now()
  return upsert("rems", { id: `r${now}-${Math.random().toString(36).slice(2, 6)}`, date: now, title: String(x.title || "").trim(), due: x.due || null,
    notes: x.notes || "", repeat: x.repeat || null, done: false })
}
function nextDue(r) {
  const d = parseIso(r.due), rp = r.repeat
  if (!d || !rp || !rp.freq) return null
  const step = { daily: 1, weekly: 7, monthly: 0, yearly: 0 }[rp.freq]
  const n = new Date(d), now = new Date()
  for (let i = 0; i < 800 && (n <= d || n < now); i++) {
    if (rp.freq === "monthly") n.setMonth(n.getMonth() + 1)
    else if (rp.freq === "yearly") n.setFullYear(n.getFullYear() + 1)
    else if (rp.freq === "weekly" && (rp.days || []).length) { n.setDate(n.getDate() + 1); if (!rp.days.includes(RDAY[n.getDay()])) continue }
    else n.setDate(n.getDate() + step)
  }
  return /T/.test(r.due) ? iso(n) : dayKey(n)
}
function remSet(id, patch) {
  const r = D.rems.find(x => x.id === id && !x.deleted)
  if (!r) return null
  const y = Object.assign({}, r)
  if (patch.title) y.title = patch.title
  if (patch.notes !== undefined) y.notes = patch.notes
  if (patch.due !== undefined) y.due = patch.due || null
  if (patch.completed === true) {
    const nx = nextDue(r)
    if (nx) y.due = nx; else Object.assign(y, { done: true, doneAt: Date.now() })   // повторяющееся — на следующий раз
  }
  if (patch.completed === false) Object.assign(y, { done: false, doneAt: null })
  return upsert("rems", y)
}
// Напоминания про воду не нужны (пользователь: «захламляет») — о воде помощник напоминает сам подсказками plan_day
const WATER_REM = /💧|(стакан|выпе?й|попей|попить|пить)[^]{0,20}вод/i
function dropWaterRems() {
  if (D.waterRemsDropped) return
  for (const r of live(D.rems)) if (!r.done && WATER_REM.test(r.title || "")) remove("rems", r.id)
  D.waterRemsDropped = true
  save()
}
// Один раз: невыполненные напоминания iPhone и ещё не внесённые команды — в напоминания приложения
function migrateRems() {
  if (D.remsMigrated || !D.snap) return
  for (const r of D.snap.reminders || []) if (!r.completed && !D.rems.some(x => x.from === r.id))
    upsert("rems", { id: String(r.id), date: Date.now(), from: r.id, title: r.title, due: r.due || null, done: false })
  for (const o of D.ops) if (o.state === "local" && o.tool === "create_reminder") remAdd(o.input || {})
  D.ops = D.ops.filter(o => !(o.state === "local" && /_reminder$/.test(o.tool)))
  D.remsMigrated = true
  save()
}
// Команда выполнена на iPhone: сообщить, если не вышло
function opDone(o) {
  if (o.result && o.result.error) toast(`iPhone: не получилось — ${o.result.error}`)
}

// ───────────── Где я: сейчас — у браузера (только пока приложение открыто), иначе — последнее место от виджета ─────────────
const distM = (a, b) => {
  const R = 6371000, rad = v => v * Math.PI / 180, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const nearest = (here, list) => list.slice().sort((a, b) => distM(here, a) - distM(here, b))[0] || null
function whereAmI() {
  const fromWidget = () => { const l = D.snap && D.snap.loc; return l && l.lat != null ? { lat: l.lat, lng: l.lng, src: `по виджету, ${ago(l.at)}` } : null }
  if (!navigator.geolocation) return Promise.resolve(fromWidget())
  return new Promise(res => {
    const t = setTimeout(() => res(fromWidget()), 9000)
    navigator.geolocation.getCurrentPosition(p => { clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude, src: "сейчас" }) },
      () => { clearTimeout(t); res(fromWidget()) }, { enableHighAccuracy: false, maximumAge: 120000, timeout: 8000 })
  })
}

// ───────────── Календарь и напоминания iPhone (снимок от виджета + команды в очереди) ─────────────
const OP_LABEL = { create_event: "новое событие", update_event: "изменение события", delete_event: "удаление события",
  create_reminder: "новое напоминание", update_reminder: "изменение напоминания", delete_reminder: "удаление напоминания" }
function queueOp(tool, input) {
  const op = { id: uid("op"), tool, input, at: Date.now(), state: "local" }
  D.ops.push(op)
  save()
  return op
}
const pendingOps = () => D.ops.filter(o => o.state !== "done")
// То, что видит приложение: снимок iPhone + ещё не внесённые команды
function iphone() {
  const snap = D.snap || {}
  let events = (gcalOn() ? D.gcal.events.map(e => Object.assign({}, e, { repeats: !!e.recurring })) : (snap.events || []).map(e => Object.assign({}, e)))
  const reminders = live(D.rems).map(r => ({ id: r.id, title: r.title, due: r.due || null, completed: !!r.done, doneAt: r.doneAt || 0, notes: r.notes || "", repeat: r.repeat || null, list: "" }))
  for (const o of pendingOps()) {
    const x = o.input || {}
    if (o.tool === "create_event") events.push({ id: "op:" + o.id, title: x.title, start: x.start, end: x.end || x.start, all_day: !!x.all_day,
      calendar: x.calendar || "", location: x.location || "", pending: true })
    if (o.tool === "update_event") {
      const e = events.find(v => v.id === x.id && (!x.occurrence_start || v.start === x.occurrence_start))
      if (e) {
        const dur = (parseIso(e.end) - parseIso(e.start)) || 0
        if (x.start) { e.start = x.start; e.end = x.end || iso(new Date(+parseIso(x.start) + dur)) }
        if (x.title) e.title = x.title
        e.pending = true
      }
    }
    if (o.tool === "delete_event") events = events.filter(v => !(v.id === x.id && (x.all_future || !x.occurrence_start || v.start === x.occurrence_start)))
  }
  events = events.map(e => Object.assign(e, { s: parseIso(e.start), e: parseIso(e.end) || parseIso(e.start) })).filter(e => e.s)
    .sort((a, b) => a.s - b.s)
  return { events, reminders, watch: snap.watch && snap.watch.day === dayKey(new Date()) ? snap.watch : null, at: snap.at || 0 }
}
const openRems = v => v.reminders.filter(r => !r.completed)
const remDue = r => parseIso(r.due)
const remHasTime = r => /T/.test(r.due || "")
const remLate = r => { const d = remDue(r); return d && (remHasTime(r) ? d < new Date() : d < sod(new Date())) }
function remLabel(r) {
  const d = remDue(r)
  if (!d) return ""
  const day = dayName(d), t = remHasTime(r) ? hm(d) : ""
  return day === "сегодня" ? (t || "сегодня") : `${day}${t ? " " + t : ""}`
}

// ───────────── Окна (снизу экрана) ─────────────
const stack = []
function sheet(html, { onClose } = {}) {
  const layer = $("#layer")
  const scrim = document.createElement("div"); scrim.className = "scrim"
  const el = document.createElement("div"); el.className = "sheet"
  el.innerHTML = '<div class="grab"></div>' + html
  layer.append(scrim, el)
  requestAnimationFrame(() => { scrim.classList.add("show"); el.classList.add("show") })
  const entry = { el, close: null }
  entry.close = () => {
    const i = stack.indexOf(entry)
    if (i < 0) return
    stack.splice(i, 1)
    scrim.classList.remove("show"); el.classList.remove("show")
    setTimeout(() => { scrim.remove(); el.remove() }, 230)
    if (onClose) onClose()
  }
  scrim.onclick = () => entry.close()
  stack.push(entry)
  return entry
}
const ui = {
  info(title, message) {
    return new Promise(res => {
      const s = sheet(`<h3>${esc(title)}</h3><div class="msg">${esc(message || "")}</div><div class="btns"><button class="btn primary">Понятно</button></div>`, { onClose: () => res() })
      $(".btn", s.el).onclick = () => s.close()
    })
  },
  choose(title, message, options) {
    return new Promise(res => {
      let v = -1
      const s = sheet(`<h3>${esc(title)}</h3>${message ? `<div class="msg">${esc(message)}</div>` : ""}` +
        options.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join("") +
        `<div class="btns"><button class="btn" data-i="-1">Отмена</button></div>`, { onClose: () => res(v) })
      $$("button[data-i]", s.el).forEach(b => b.onclick = () => { v = +b.dataset.i; s.close() })
    })
  },
  ask(title, hint, value = "", opts = {}) {
    return new Promise(res => {
      let v = null
      const field = opts.multiline ? `<textarea id="ask-v" placeholder="${esc(opts.placeholder || "")}">${esc(value)}</textarea>`
        : `<input id="ask-v" ${opts.type ? `type="${opts.type}" inputmode="decimal"` : ""} value="${esc(value)}" placeholder="${esc(opts.placeholder || "")}">`
      const s = sheet(`<h3>${esc(title)}</h3>${hint ? `<div class="msg">${esc(hint)}</div>` : ""}<div class="field">${field}</div>` +
        `<div class="btns"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">${esc(opts.ok || "Готово")}</button></div>`,
        { onClose: () => res(v) })
      const inp = $("#ask-v", s.el)
      setTimeout(() => inp.focus(), 250)
      const ok = () => { v = inp.value.trim() || null; s.close() }
      $('[data-a="ok"]', s.el).onclick = ok
      $('[data-a="no"]', s.el).onclick = () => s.close()
      if (!opts.multiline) inp.onkeydown = e => { if (e.key === "Enter") ok() }
    })
  },
  confirm(title, html, buttons) {
    return new Promise(res => {
      let v = null
      const s = sheet(`<h3>${esc(title)}</h3>${html}<div class="btns">${buttons.map((b, i) =>
        `<button class="btn ${i === buttons.length - 1 ? "primary" : ""}" data-b="${esc(b)}">${esc(b)}</button>`).join("")}</div>`, { onClose: () => res(v) })
      $$("button[data-b]", s.el).forEach(b => b.onclick = () => { v = b.dataset.b; s.close() })
    })
  },
}

// ───────────── Claude ─────────────
const aiKey = () => (D.conn && D.conn.key) || ""
async function claude(body, timeout = 90000, opts = {}) {
  if (!aiKey()) throw new Error("нет ключа Claude — подключите приложение кодом из виджета («Ещё»)")
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeout)
  if (opts.signal) { if (opts.signal.aborted) ctl.abort(); else opts.signal.addEventListener("abort", () => ctl.abort()) }
  const send = async (b, beta) => {
    const headers = { "x-api-key": aiKey(), "anthropic-version": "2023-06-01", "content-type": "application/json", "anthropic-dangerous-direct-browser-access": "true" }
    if (beta) headers["anthropic-beta"] = beta
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ctl.signal, headers, body: JSON.stringify(b) })
    return await r.json()
  }
  try {
    const base = Object.assign({ model: opts.model || core.CONFIG.agentModel || "claude-sonnet-5-5" }, body)
    if (!opts.smart) return await send(base)
    // Помощник в чате: самая сильная модель с размышлением; если отказ фильтра — сервер сам переспросит другую модель
    let res = await send(Object.assign({}, base, { fallbacks: "default" }), "server-side-fallback-2026-07-01")
    if (res && res.error && /fallback|beta/i.test(res.error.message || "")) res = await send(base)
    if (res && res.error && /model/i.test(res.error.message || "") && res.error.type !== "overloaded_error")   // модель недоступна ключу — обычная модель виджета
      res = await send(Object.assign({}, body, { model: core.CONFIG.agentModel || "claude-sonnet-5-5", output_config: undefined }))
    return res
  } catch (e) {
    if (opts.signal && opts.signal.aborted) throw new Error("STOPPED")
    throw new Error(e.name === "AbortError" ? "Claude долго не отвечает" : "нет связи с Claude")
  } finally { clearTimeout(t) }
}
const CHAT_MODEL = "claude-opus-5-5"

// ── Еда по фото ──
const FOOD_SCHEMA = { type: "object", additionalProperties: false, properties: {
    title: { type: "string", description: "Короткое название приёма пищи по-русски, 2–5 слов" },
    items: { type: "array", items: { type: "object", properties: {
      name: { type: "string" }, grams: { type: "number" }, kcal: { type: "number" } }, required: ["name", "grams", "kcal"], additionalProperties: false } },
    kcal: { type: "number", description: "Всего ккал" },
    protein: { type: "number", description: "Белки, г" }, fat: { type: "number", description: "Жиры, г" }, carbs: { type: "number", description: "Углеводы, г" },
    confidence: { type: "string", enum: ["низкая", "средняя", "высокая"] },
    note: { type: "string", description: "Одна короткая фраза: что неточно или что уточнить. Можно пусто." },
    not_food: { type: "boolean", description: "true, если на фото нет еды" } },
  required: ["title", "items", "kcal", "protein", "fat", "carbs", "confidence", "note", "not_food"] }

function shrinkPhoto(file, max = 1024) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement("canvas")
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      res(c.toDataURL("image/jpeg", 0.82))
    }
    img.onerror = () => rej(new Error("не удалось открыть фото"))
    img.src = URL.createObjectURL(file)
  })
}
async function estimateFood(dataUrl, hint) {
  const content = []
  if (dataUrl) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: dataUrl.split(",")[1] } })
  content.push({ type: "text", text: (dataUrl ? "Оцени еду на фото." : "Оцени еду по описанию.") + (hint ? ` Уточнение от меня: ${hint}` : "") })
  const res = await claude({ max_tokens: 4000, output_config: { format: { type: "json_schema", schema: FOOD_SCHEMA } },
    system: "Ты нутрициолог. Определи блюда и продукты, оцени вес каждой части по размеру тарелки, приборов и упаковок, посчитай калории и БЖУ. " +
      "Учитывай масло и соусы. Если есть уточнение от пользователя — оно важнее того, что видно. Названия по-русски.",
    messages: [{ role: "user", content }] })
  if (!res || res.error) throw new Error(res && res.error ? res.error.message || res.error.type : "пустой ответ")
  if (res.stop_reason === "refusal") throw new Error("Claude отказался оценивать это фото")
  const t = (res.content || []).filter(c => c.type === "text").map(c => c.text).join("")
  try { return JSON.parse(t) } catch (e) { throw new Error("Claude не вернул оценку") }
}
function addFood(m) {
  const now = Date.now()
  return upsert("food", Object.assign({ id: `m${now}-${Math.random().toString(36).slice(2, 6)}`, date: now }, m, { kcal: Math.round(+m.kcal || 0) }))
}
// Защита от случайных серий: из виджета (#water) второй стакан за минуту не пишется, в приложении — спрашиваем
let lastWaterAt = 0
async function addWater(ml, from) {
  const now = Date.now(), last = Math.max(lastWaterAt, ...today(D.water).map(w => w.u || w.date || 0))
  if (from === "widget" && now - last < 60e3) return toast(`💧 Стакан уже записан ${Math.max(1, Math.round((now - last) / 1000))} с назад`)
  if (from !== "widget" && now - last < 10e3 && (await ui.confirm("Ещё стакан?", `<div class="msg">Только что уже добавлено ${ml} мл. Записать ещё один?</div>`, ["Отмена", "Записать"])) !== "Записать") return
  lastWaterAt = now
  upsert("water", { id: `w${now}`, date: now, ml: Math.round(ml) })
  render()
  toast(`💧 +${ml} мл · сегодня ${liters(waterToday())} л`)
}
const today = list => live(list).filter(x => sameDay(x.date, Date.now())).sort((a, b) => a.date - b.date)
const waterToday = () => today(D.water).reduce((s, w) => s + (w.ml || 0), 0)
// Еда: фото → оценка → сохранить / уточнить / поправить калории
async function foodFlow(dataUrl, hint) {
  if (!aiKey()) return ui.info("Нужен ключ Claude", "Калории по фото считает Claude. Подключите приложение кодом из виджета: «Ещё» → «Подключить».")
  while (true) {
    const wait = sheet(`<h3>🍽 Считаю калории…</h3>${dataUrl ? `<img class="photo-prev" src="${dataUrl}">` : ""}<div class="msg">Claude смотрит на ${dataUrl ? "фото" : "описание"}, это 5–15 секунд.</div>`)
    let est
    try { est = await estimateFood(dataUrl, hint) } catch (e) {
      wait.close()
      const b = await ui.confirm("Не получилось посчитать", `<div class="msg">${esc(e.message)}</div>`, ["Отмена", "Повторить"])
      if (b === "Повторить") continue
      return
    }
    wait.close()
    if (est.not_food) return ui.info("Еды не видно", "Попробуйте снять тарелку сверху, целиком в кадре.")
    const lines = (est.items || []).map(i => `• ${i.name} — ${num(i.grams)} г, ${num(i.kcal)} ккал`)
    lines.push("", `Итого ≈ ${num(est.kcal)} ккал`, `Б ${num(est.protein)} · Ж ${num(est.fat)} · У ${num(est.carbs)} г`, `Точность: ${est.confidence || "средняя"}`)
    if (est.note) lines.push(est.note)
    const b = await ui.confirm(`🍽 ${est.title}`, `<div class="cmd-list">${esc(lines.join("\n"))}</div>`, ["Отмена", "Уточнить", "Калории", "Сохранить"])
    if (!b || b === "Отмена") return
    if (b === "Уточнить") { const t = await ui.ask("Уточнение", "Например: половина порции, без соуса, рис 150 г", hint || ""); if (t) hint = t; continue }
    if (b === "Калории") {
      const v = parseFloat(String(await ui.ask("Калории", "ккал", String(Math.round(est.kcal)), { type: "number" }) || "").replace(",", "."))
      if (!(v > 0)) continue
      const k = v / (est.kcal || v);
      ["protein", "fat", "carbs"].forEach(x => { est[x] = Math.round((est[x] || 0) * k) })
      est.kcal = v
    }
    addFood({ title: est.title, kcal: est.kcal, protein: Math.round(est.protein || 0), fat: Math.round(est.fat || 0), carbs: Math.round(est.carbs || 0), items: est.items || [] })
    render()
    const kc = today(D.food).reduce((s, f) => s + (f.kcal || 0), 0)
    return toast(`✓ ${est.title}: ${num(est.kcal)} ккал · за день ${num(kc)}`)
  }
}
async function foodMenu() {
  const i = await ui.choose("🍽 Еда", "", ["📷 Сфотографировать", "🖼 Выбрать из фото", "⌨️ Описать словами", "✏️ Вписать калории вручную"])
  if (i === 0) $("#photo").click()
  if (i === 1) $("#photo-lib").click()
  if (i === 2) { const t = await ui.ask("Что съели?", "Например: тарелка том яма и рис", "", { ok: "Посчитать" }); if (t) foodFlow(null, t) }
  if (i === 3) foodForm()
}
function onPhoto(input) {
  input.onchange = async () => {
    const f = input.files && input.files[0]
    input.value = ""
    if (!f) return
    try { await scanFile(f) } catch (e) { ui.info("Фото", e.message) }
  }
}
// ── Фото или файл → помощник сам понимает, что это: еда, счёт, чек или другое ──
const SCAN_PROMPT = "Разбери это вложение по правилам для фото и документов."
function fileB64(f) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("не удалось прочитать файл")); r.readAsDataURL(f) })
}
async function scanFile(f) {
  let att
  if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name || "")) {
    if (f.size > 20e6) throw new Error("Файл больше 20 МБ — сократите его или сфотографируйте нужную страницу")
    att = { type: "document", media_type: "application/pdf", data: (await fileB64(f)).split(",")[1], name: f.name || "документ.pdf" }
  } else if (/^image\//.test(f.type) || /\.(jpe?g|png|heic|webp|gif)$/i.test(f.name || "")) {
    const url = await shrinkPhoto(f, 1568)
    att = { type: "image", media_type: "image/jpeg", data: url.split(",")[1], thumb: await shrinkData(url, 360) }
  } else throw new Error("Можно фото или PDF")
  chatSend(SCAN_PROMPT, { label: att.type === "document" ? `📄 ${att.name}` : "📷 Фото", attach: att })
}
function shrinkData(url, max) {
  return new Promise(res => { const img = new Image(); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas")
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", .7)) }
    img.onerror = () => res(""); img.src = url })
}

// ───────────── Помощник (чат) ─────────────
const AGENT_TOOLS = [
  { name: "add_food", description: "Записать съеденное. Калории и БЖУ оцени сам по описанию (обычная порция, если не сказано).",
    input_schema: { type: "object", properties: { title: { type: "string" }, kcal: { type: "number" },
      protein: { type: "number" }, fat: { type: "number" }, carbs: { type: "number" } }, required: ["title", "kcal"] } },
  { name: "add_water", description: "Записать выпитую воду. Стакан — 250 мл.",
    input_schema: { type: "object", properties: { ml: { type: "number" } }, required: ["ml"] } },
  { name: "add_workout", description: "Записать тренировку без часов. Оцени длительность и сожжённые калории сам по MET и весу пользователя из системной подсказки.",
    input_schema: { type: "object", properties: { title: { type: "string", description: "Коротко: «Плавание 180 м»" }, minutes: { type: "number" }, kcal: { type: "number" },
      date: { type: "string", description: "YYYY-MM-DDTHH:MM, если тренировка была не сейчас" } }, required: ["title", "minutes", "kcal"] } },
  { name: "get_health", description: "Еда, вода и активность с Apple Watch за сегодня (вместе с тренировками без часов).", input_schema: { type: "object", properties: {} } },
  { name: "get_events", description: "Найти события календаря (Google Календарь) в диапазоне дат (видно 45 дней вперёд и 2 дня назад). Для поиска по названию передайте query.",
    input_schema: { type: "object", properties: {
      start: { type: "string", description: "Начало диапазона, YYYY-MM-DDTHH:MM (местное время)" },
      end: { type: "string", description: "Конец диапазона, YYYY-MM-DDTHH:MM" },
      query: { type: "string" } }, required: ["start", "end"] } },
  { name: "create_event", description: "Создать событие в Google Календаре пользователя.",
    input_schema: { type: "object", properties: {
      title: { type: "string" }, start: { type: "string" }, end: { type: "string" },
      all_day: { type: "boolean" }, location: { type: "string" }, notes: { type: "string" },
      calendar: { type: "string", description: "Название календаря; не указывайте, если пользователь не назвал" },
      repeat: { type: "object", description: "Повтор: {freq: daily|weekly|monthly|yearly, days: [MO,TU,...]} — days только для weekly",
        properties: { freq: { type: "string" }, days: { type: "array", items: { type: "string" } } } } },
      required: ["title", "start", "end"] } },
  { name: "update_event", description: "Изменить или перенести событие. Для повторяющегося события меняется только указанное повторение (occurrence_start).",
    input_schema: { type: "object", properties: {
      id: { type: "string" }, occurrence_start: { type: "string", description: "Начало нужного повторения из get_events" },
      title: { type: "string" }, start: { type: "string" }, end: { type: "string" },
      location: { type: "string" }, notes: { type: "string" } }, required: ["id", "occurrence_start"] } },
  { name: "delete_event", description: "Удалить событие. Пользователь увидит запрос подтверждения.",
    input_schema: { type: "object", properties: {
      id: { type: "string" }, occurrence_start: { type: "string" },
      all_future: { type: "boolean", description: "true — удалить это и все следующие повторения" } }, required: ["id", "occurrence_start"] } },
  { name: "get_reminders", description: "Список невыполненных напоминаний (и выполненных сегодня, если include_completed).",
    input_schema: { type: "object", properties: { include_completed: { type: "boolean" }, query: { type: "string" } } } },
  { name: "create_reminder", description: "Создать напоминание в IZIDAY (напоминания живут в приложении; уведомление и контроль «Выполнил?» — от IZIDAY).",
    input_schema: { type: "object", properties: {
      title: { type: "string" }, due: { type: "string", description: "YYYY-MM-DDTHH:MM или YYYY-MM-DD; не указывайте, если срока нет" },
      list: { type: "string", description: "Название списка напоминаний, если пользователь назвал" },
      notes: { type: "string" },
      repeat: { type: "object", properties: { freq: { type: "string" }, days: { type: "array", items: { type: "string" } } } } },
      required: ["title"] } },
  { name: "update_reminder", description: "Изменить напоминание: текст, срок, отметить выполненным или вернуть.",
    input_schema: { type: "object", properties: {
      id: { type: "string" }, title: { type: "string" }, due: { type: "string", description: "Новый срок; пустая строка — убрать срок" },
      completed: { type: "boolean" } }, required: ["id"] } },
  { name: "delete_reminder", description: "Удалить напоминание. Пользователь увидит запрос подтверждения.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "skip_card_payment", description: "Будущий платёж по карте не вносить в личные расходы (рабочий, чужой, возмещаемый). Виджет, получив из банка платёж " +
      "на эту сумму в ближайшие days дней, не запишет его в расходы и сообщит. Если платёж уже пришёл — найди его в get_money и удали вместо этого.",
    input_schema: { type: "object", properties: { amount: { type: "number" }, note: { type: "string", description: "Почему: «по работе» и т. п." },
      days: { type: "number", description: "Сколько дней ждать платёж, по умолчанию 14" } }, required: ["amount"] } },
  { name: "add_money", description: () => `Записать расход или доход ${core.CONFIG.currencyIn}.`,
    input_schema: { type: "object", properties: {
      type: { type: "string", enum: ["expense", "income"] }, amount: { type: "number" },
      method: { type: "string", enum: ["cash", "transfer"], description: "cash — наличные; transfer — перевод, карта, QR" },
      category: { type: "string", description: "Строго одна из категорий из системного сообщения" },
      comment: { type: "string" }, date: { type: "string", description: "Только если не сегодня, YYYY-MM-DD" } },
      required: ["type", "amount", "method", "category"] } },
  { name: "set_budget", description: "Лимит расходов на месяц по категории (0 — убрать лимит).",
    input_schema: { type: "object", properties: { category: { type: "string", description: "Категория расходов из системного сообщения" }, limit: { type: "number" } }, required: ["category", "limit"] } },
  { name: "add_recurring", description: "Добавить регулярный ежемесячный платёж (аренда, интернет, подписка). В срок он появится в «Сегодня», оплату пользователь отметит одним нажатием. paid_now=true — уже оплачен в этом месяце (запишет расход).",
    input_schema: { type: "object", properties: { title: { type: "string" }, amount: { type: "number" }, day: { type: "number", description: "Число месяца, 1–31" },
      method: { type: "string", enum: ["cash", "transfer"] }, category: { type: "string" }, paid_now: { type: "boolean" } }, required: ["title", "amount", "day", "category"] } },
  { name: "pay_recurring", description: "Отметить регулярный платёж оплаченным в этом месяце (запишет расход). id из get_money.recurring.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "log_weight", description: "Записать вес пользователя в кг.", input_schema: { type: "object", properties: { kg: { type: "number" }, date: { type: "string", description: "YYYY-MM-DD, если не сегодня" } }, required: ["kg"] } },
  { name: "mark_habit", description: "Отметить привычку за день (или снять отметку done=false). Для «хочу бросить» отметка значит, что было (выпил, курил). Если такой привычки нет и create=true — создать.",
    input_schema: { type: "object", properties: { habit: { type: "string", description: "Название привычки" }, day: { type: "string", description: "YYYY-MM-DD, по умолчанию сегодня" },
      done: { type: "boolean" }, create: { type: "boolean" }, bad: { type: "boolean", description: "При создании: true — привычка, которую бросают" } }, required: ["habit"] } },
  { name: "get_money", description: "Операции и итоги по деньгам за месяц.",
    input_schema: { type: "object", properties: { month: { type: "string", description: "YYYY-MM, по умолчанию текущий" } } } },
  { name: "delete_money", description: "Удалить ошибочную операцию по id.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "get_history", description: "Сводка по дням за период (до 92 дней): еда (ккал, БЖУ), вода, тренировки, шаги и активность с часов, расходы и доходы. " +
      "details=true — ещё и сами записи с id (блюда, вода, операции). Для вопросов «как я питался на неделе», «сколько потратил за октябрь по дням», «сколько шагов вчера».",
    input_schema: { type: "object", properties: { from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD, по умолчанию сегодня" },
      details: { type: "boolean" } }, required: ["from"] } },
  { name: "read_sheet", description: "Прочитать таблицу виджета (Google Таблица) напрямую. Без sheet — список листов с колонками. " +
      "С sheet — строки листа (последние limit, можно from/to по дате в первом столбце). Листы: «Операции», «Еда», «Вода», «Тренировки», «Активность», " +
      "«Карта» (платежи по банковской карте из писем банка), «Итоги: …», «Еда и активность» и другие. Используй, когда нужны данные старше, чем есть в get_history, или лист, которого нет в других инструментах.",
    input_schema: { type: "object", properties: { sheet: { type: "string" }, from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" },
      limit: { type: "number", description: "сколько последних строк, по умолчанию 200" } } } },
  { name: "route_to", description: "Сколько ехать (или идти) от того места, где сейчас пользователь, до точки: минуты и километры по Google Картам. " +
      "to — название места или адрес («Декатлон», «аэропорт Суварнабхуми», «Central World»).",
    input_schema: { type: "object", properties: { to: { type: "string" }, mode: { type: "string", enum: ["driving", "walking", "transit"], description: "по умолчанию на машине" } }, required: ["to"] } },
  { name: "remind_near", description: "Напомнить, когда пользователь окажется рядом с местом («напомни заехать в Декатлон, когда буду рядом»). " +
      "Находит точки места рядом с пользователем (у сетей — несколько филиалов). Проверяет виджет примерно раз в 15 минут и присылает уведомление. " +
      "Если место не нашлось — попроси уточнить адрес или район.",
    input_schema: { type: "object", properties: { title: { type: "string", description: "Что сделать: «Заехать в Декатлон — купить мяч»" },
      query: { type: "string", description: "Место для поиска на карте: название, сеть или адрес" },
      radius_m: { type: "number", description: "Насколько близко, м. По умолчанию 1500 (за 15 минут машина проезжает много)" } }, required: ["title", "query"] } },
  { name: "list_places", description: "Активные и сработавшие напоминания по месту.", input_schema: { type: "object", properties: {} } },
  { name: "plan_day", description: "Составить или обновить план подсказок на сегодня: уведомления на iPhone в нужное время (их ставит виджет). " +
      "Заменяет ещё не наступившие подсказки сегодняшнего дня. Используй, когда пользователь просит вести его день, напоминать, подсказывать, или в утренней сводке.",
    input_schema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: {
      time: { type: "string", description: "YYYY-MM-DDTHH:MM сегодня" }, text: { type: "string", description: "Короткая подсказка, 1–2 предложения, живо и по делу" } }, required: ["time", "text"] } } }, required: ["items"] } },
  { name: "where_was_i", description: "Где был пользователь в указанный момент (история мест с iPhone, 60 дней, точка примерно раз в час или при переезде): адрес, ссылка на Google Карты, " +
      "насколько точка близка по времени. Используй для любого вопроса о платеже или переводе (особенно непонятном) и вообще «где я был тогда-то».",
    input_schema: { type: "object", properties: { time: { type: "string", description: "YYYY-MM-DDTHH:MM, местное время" } }, required: ["time"] } },
  { name: "mail_search", description: "Почта Gmail пользователя: найти цепочки писем. query — синтаксис поиска Gmail: from:, to:, subject:, is:unread, is:important, newer_than:2d, " +
      "older_than:, after:2026/10/01, has:attachment, in:inbox, in:sent, label:, category:primary, -category:promotions, слова. Возвращает id цепочек, тему, отправителя, дату и начало текста.",
    input_schema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number", description: "до 25, по умолчанию 10" } }, required: ["query"] } },
  { name: "mail_read", description: "Прочитать цепочку писем целиком по id из mail_search (последние 8 писем, текст и названия вложений).",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "mail_send", description: "Отправить новое письмо от имени пользователя. Приложение само покажет письмо и спросит подтверждение. Пиши в стиле пользователя, на языке получателя.",
    input_schema: { type: "object", properties: { to: { type: "string", description: "адреса через запятую" }, cc: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } },
  { name: "mail_reply", description: "Ответить в цепочке (id из mail_search). all=true — ответить всем. Приложение спросит подтверждение.",
    input_schema: { type: "object", properties: { id: { type: "string" }, body: { type: "string" }, all: { type: "boolean" } }, required: ["id", "body"] } },
  { name: "mail_draft", description: "Сохранить черновик (не отправляя): новое письмо (to, subject, body) или ответ в цепочке (id, body). Для случаев, когда пользователь хочет сам проверить и отправить.",
    input_schema: { type: "object", properties: { id: { type: "string" }, to: { type: "string" }, cc: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["body"] } },
  { name: "mail_modify", description: "Разобрать почту: op = archive | inbox | read | unread | star | unstar | label | unlabel | trash | spam для цепочек ids. Для label/unlabel — label (имя метки, создастся). Корзина и спам — с подтверждением.",
    input_schema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } }, op: { type: "string", enum: ["archive", "inbox", "read", "unread", "star", "unstar", "label", "unlabel", "trash", "spam"] }, label: { type: "string" } }, required: ["ids", "op"] } },
  { name: "remember", description: "Запомнить надолго факт о пользователе: люди и отношения, предпочтения, привычки, цели и планы, здоровье, работа и проекты, важные даты, договорённости. " +
      "Пиши коротко и самодостаточно, с датой, если важна («Жена — Алия, ДР 14 марта», «Цель на 2027: пробежать полумарафон»). Если факт изменился — сначала forget старый.",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
  { name: "forget", description: "Забыть факт из памяти по id (устарел, неверен или пользователь попросил).", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "search_chats", description: "Поиск по всем прошлым разговорам с пользователем (дословные сообщения и сводки). Используй, когда пользователь ссылается на прошлое " +
      "(«как мы договаривались», «что я говорил про…», «помнишь…») или нужна подробность, которой нет в памяти.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Ключевые слова; несколько вариантов через пробел" },
      from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" } }, required: ["query"] } },
  { name: "delete_record", description: "Удалить запись о воде, еде или тренировке по id (id есть в get_health и get_history с details). Для случайных дублей (несколько одинаковых записей в одну минуту): удаляй лишние, одну оставь. Приложение само спросит подтверждение.",
    input_schema: { type: "object", properties: { kind: { type: "string", enum: ["water", "food", "workouts"] }, ids: { type: "array", items: { type: "string" } } }, required: ["kind", "ids"] } },
  { name: "delete_place", description: "Убрать напоминание по месту по id.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "ask_user", description: "Задать пользователю уточняющий вопрос и получить ответ. Используйте, только если без ответа нельзя выполнить команду правильно.",
    input_schema: { type: "object", properties: {
      question: { type: "string" },
      options: { type: "array", items: { type: "string" }, description: "2–5 коротких вариантов ответа, если они очевидны" } },
      required: ["question"] } },
]
const routes = () => (D.conn && Array.isArray(D.conn.routes) ? D.conn.routes : [])
function chatTools() {
  const list = AGENT_TOOLS.map(t => Object.assign({}, t, { description: typeof t.description === "function" ? t.description() : t.description }))
  const r = routes()
  if (r.length) list.push({ name: "claude_code",
    description: "Передать задачу в Claude Code: запускается новая сессия, она работает сама (код, документы, исследование, " +
      "длинные многошаговые задачи) и возвращает ссылку. Маршруты:\n" + r.map(x => `- «${x.name}»: ${x.hint || "без описания"}`).join("\n"),
    input_schema: { type: "object", properties: {
      route: { type: "string", enum: r.map(x => x.name) },
      task: { type: "string", description: "Полная постановка задачи: что сделать, весь нужный контекст из разговора, что вернуть. Сессия этот чат не видит." },
    }, required: ["route", "task"] } })
  return list
}

const evOut = e => ({ id: e.id, title: e.title, start: e.start, end: e.end, all_day: !!e.all_day, calendar: e.calendar || "", location: e.location || "",
  repeats: !!e.repeats, ...(e.pending ? { pending: "ещё не внесено в iPhone" } : {}) })
const QUEUED = "Записано в очередь: виджет внесёт это в iPhone при ближайшем обновлении (обычно в течение 15 минут)."

async function runTool(name, x) {
  const v = iphone()
  switch (name) {
    case "get_events": {
      const from = parseIso(x.start), to = parseIso(x.end)
      if (!from || !to) return { error: "нужны start и end в формате YYYY-MM-DDTHH:MM" }
      let list = v.events.filter(e => e.s < to && e.e > from)
      if (x.query) { const q = x.query.toLowerCase(); list = list.filter(e => (e.title || "").toLowerCase().includes(q) || core.titleMatches(e.title || "", x.query)) }
      return { events: list.slice(0, 60).map(evOut), ...(gcalOn() ? { source: "Google Календарь", at: iso(new Date(D.gcal.at)) } : D.snap ? { snapshot_at: iso(new Date(D.snap.at)) } : { warning: "календарь ещё не загружен" }) }
    }
    case "create_event": {
      if (!parseIso(x.start)) return { error: "неверное начало" }
      if (gcalOn()) { const r = await calDo("create", x); return r.error ? { error: r.error } : { ok: true, id: r.event.id, event: r.event } }
      const op = queueOp("create_event", x)
      return { ok: true, id: "op:" + op.id, note: QUEUED }
    }
    case "update_event": {
      if (String(x.id).startsWith("op:")) return { error: "это событие ещё не внесено в iPhone — изменить его можно после обновления виджета" }
      const e = v.events.find(ev => ev.id === x.id && (!x.occurrence_start || ev.start === x.occurrence_start)) || v.events.find(ev => ev.id === x.id)
      if (!e) return { error: "событие не найдено" }
      if (x.start && x.start !== e.start) {
        const ok = await chatConfirm(`Перенести «${e.title}»?\n${core.cap(fullDate(e.s))}, ${hm(e.s)} → ${core.cap(fullDate(parseIso(x.start)))}, ${hm(parseIso(x.start))}`)
        if (!ok) return { cancelled: "пользователь отказался переносить" }
      }
      if (gcalOn()) { const r = await calDo("update", Object.assign({}, x, { occurrence_start: x.occurrence_start || e.start })); return r.error ? { error: r.error } : { ok: true, event: r.event } }
      queueOp("update_event", Object.assign({}, x, { occurrence_start: x.occurrence_start || e.start }))
      return { ok: true, note: QUEUED }
    }
    case "delete_event": {
      if (String(x.id).startsWith("op:")) { cancelOp(x.id.slice(3)); return { ok: true, note: "событие ещё не было внесено — отменено" } }
      const e = v.events.find(ev => ev.id === x.id && (!x.occurrence_start || ev.start === x.occurrence_start)) || v.events.find(ev => ev.id === x.id)
      if (!e) return { error: "событие не найдено" }
      if (!(await chatConfirm(`Удалить «${e.title}»?\n${core.cap(fullDate(e.s))}, ${hm(e.s)}${x.all_future ? "\nи все следующие повторения" : ""}`)))
        return { cancelled: "пользователь отказался удалять" }
      if (gcalOn()) { const r = await calDo("delete", Object.assign({}, x, { occurrence_start: x.occurrence_start || e.start })); return r.error ? { error: r.error } : { ok: true } }
      queueOp("delete_event", Object.assign({}, x, { occurrence_start: x.occurrence_start || e.start }))
      return { ok: true, note: QUEUED }
    }
    case "get_reminders": {
      let list = x.include_completed ? v.reminders : openRems(v)
      if (x.query) list = list.filter(r => (r.title || "").toLowerCase().includes(x.query.toLowerCase()) || core.titleMatches(r.title || "", x.query))
      return { reminders: list.slice(0, 80).map(r => ({ id: r.id, title: r.title, due: r.due, completed: !!r.completed, ...(r.repeat ? { repeat: r.repeat } : {}), ...(r.notes ? { notes: r.notes } : {}) })) }
    }
    case "create_reminder": {
      if (!String(x.title || "").trim()) return { error: "нужен текст" }
      if (WATER_REM.test(x.title)) return { error: "про воду напоминания не создаются — пользователь не хочет их в списке. Используй plan_day (подсказка-уведомление)" }
      if (x.due && !parseIso(x.due)) return { error: "срок — YYYY-MM-DDTHH:MM или YYYY-MM-DD" }
      const r = remAdd(x)
      return { ok: true, id: r.id, note: "Сохранено в IZIDAY; уведомление придёт от виджета IZIDAY в срок" }
    }
    case "update_reminder": {
      const r = remSet(x.id, x)
      return r ? { ok: true, reminder: { id: r.id, title: r.title, due: r.due, completed: !!r.done } } : { error: "напоминание не найдено" }
    }
    case "delete_reminder": {
      const r = v.reminders.find(z => z.id === x.id)
      if (!r) return { error: "напоминание не найдено" }
      if (!(await chatConfirm(`Удалить напоминание «${r.title}»?`))) return { cancelled: "пользователь отказался удалять" }
      remove("rems", r.id)
      return { ok: true }
    }
    case "skip_card_payment": {
      if (!(x.amount > 0)) return { error: "нужна сумма" }
      const now = Date.now()
      upsert("skips", { id: uid("k"), date: now, amount: x.amount, note: String(x.note || "").slice(0, 120), until: now + (x.days || 14) * 864e5 })
      return { ok: true, note: `Платёж ${x.amount} по карте в ближайшие ${x.days || 14} дн. не попадёт в расходы` }
    }
    case "add_money": {
      const names = core.CONFIG.categories[x.type] ? core.CONFIG.categories[x.type].map(c => c[0]) : []
      if (!names.includes(x.category)) return { error: `категория должна быть одной из: ${names.join(", ")}` }
      if (!(x.amount > 0)) return { error: "сумма должна быть больше нуля" }
      const now = Date.now(), d = parseIso(x.date)
      if (d) d.setHours(12, 0, 0, 0)
      const rec = upsert("money", { id: `f${now}-${Math.random().toString(36).slice(2, 6)}`, date: d ? d.getTime() : now, type: x.type, amount: x.amount,
        method: x.method, category: x.category, comment: x.comment || "" })
      const bs = x.type === "expense" && budgetState(x.category, core.monthKey(new Date(rec.date)))
      return { ok: true, id: rec.id, ...(bs ? { budget: { limit: bs.limit, spent_this_month: bs.spent, left: bs.left, warn: bs.p >= 0.8 ? "скажи пользователю, сколько осталось по лимиту" : undefined } } : {}) }
    }
    case "get_money": {
      const key = x.month || core.monthKey(new Date())
      const t = core.monthTotals(live(D.money), key)
      return { month: key, income: t.income, expense: t.expense, cash: t.cash, transfer: t.transfer, by_category: t.cats,
        items: t.items.slice(-60).map(e => ({ id: e.id, date: iso(new Date(e.date)), type: e.type, amount: e.amount, method: e.method, category: e.category, comment: e.comment })),
        budgets: live(D.budgets).filter(b => b.limit > 0).map(b => { const s = budgetState(b.category, key); return { category: b.category, limit: b.limit, spent: s.spent, left: s.left } }),
        recurring: live(D.recur).map(r => ({ id: r.id, title: r.title, amount: r.amount, day: r.day, category: r.category, paid: recurPaid(r, key), due: dayKey(recurDue(r, monthStart(key))) })) }
    }
    case "get_history": {
      const d0 = parseIso(x.from), d1 = x.to ? parseIso(x.to) : sod(new Date())
      if (!d0 || !d1) return { error: "даты в формате YYYY-MM-DD" }
      const from = sod(d0), to = addDays(sod(d1), 1)
      if ((to - from) / 864e5 > 92) return { error: "не больше 92 дней за раз" }
      const inDay = (list, d) => live(list).filter(e => e.date >= +d && e.date < +addDays(d, 1))
      const hd = {}
      for (const h of (D.snap && D.snap.health) || []) if (h && h.day) hd[h.day] = h
      const days = []
      for (let d = from; d < to; d = addDays(d, 1)) {
        const food = inDay(D.food, d), money = inDay(D.money, d), wk = inDay(D.workouts, d), h = hd[dayKey(d)]
        const sum = (a, k) => Math.round(a.reduce((s, m) => s + (+m[k] || 0), 0))
        const row = { date: dayKey(d), kcal: sum(food, "kcal"), protein: sum(food, "protein"), fat: sum(food, "fat"), carbs: sum(food, "carbs"),
          water_ml: sum(inDay(D.water, d), "ml"), expense: sum(money.filter(e => e.type === "expense"), "amount"), income: sum(money.filter(e => e.type === "income"), "amount") }
        if (wk.length) row.workouts = wk.map(w => ({ id: w.id, title: w.title, minutes: w.minutes, kcal: w.kcal }))
        if (h) Object.assign(row, { steps: h.steps, active_kcal: h.active, exercise_min: h.exercise, sleep_h: h.sleep })
        if (x.details) {
          if (food.length) row.food = food.map(m => ({ id: m.id, time: hm(new Date(m.date)), title: m.title, kcal: m.kcal }))
          const wa = inDay(D.water, d); if (wa.length) row.water = wa.map(w => ({ id: w.id, time: hm(new Date(w.date)), ml: w.ml }))
          if (money.length) row.money = money.map(e => ({ time: hm(new Date(e.date)), type: e.type, amount: e.amount, category: e.category, comment: e.comment, method: e.method }))
        }
        days.push(row)
      }
      return { days, note: Object.keys(hd).length ? "шаги и активность с часов есть только за дни, которые прислал виджет (обычно последние 14)" : "данных с часов нет" }
    }
    case "route_to": {
      const here = await whereAmI()
      if (!here) return { error: "не знаю, где пользователь: разрешите приложению доступ к геопозиции или обновите виджет" }
      try {
        let to = x.to
        const g = await hubPost({ geo: { query: x.to, near: here, km: 60 } }, 30000)
        const best = nearest(here, (g.geo && g.geo.results) || [])
        if (best) to = { lat: best.lat, lng: best.lng }
        const res = await hubPost({ route: { from: here, to, mode: x.mode || "driving" } }, 30000)
        if (!res.route) return { error: "скрипт таблицы старый: разверните новую версию Code.gs" }
        return Object.assign({ place: best ? best.name : x.to, from_location: here.src }, res.route)
      } catch (e) { return { error: String(e.message || e) } }
    }
    case "remind_near": {
      const here = await whereAmI()
      try {
        const g = await hubPost({ geo: { query: x.query, near: here || undefined, km: 60 } }, 30000)
        if (!g.geo) return { error: "скрипт таблицы старый: разверните новую версию Code.gs" }
        let pts = (g.geo.results || []).map(r => ({ name: r.name, lat: r.lat, lng: r.lng }))
        if (here) pts = pts.filter(p => distM(here, p) < 80000)
        if (!pts.length) return { error: `«${x.query}» не нашлось рядом — уточните адрес или район` }
        const p = upsert("places", { id: uid("p"), date: Date.now(), title: x.title, query: x.query, points: pts.slice(0, 8), radius: Math.round(+x.radius_m || 1500), done: false })
        return { ok: true, id: p.id, points: p.points.map(q => q.name + (here ? ` (${Math.round(distM(here, q) / 100) / 10} км от вас)` : "")),
          note: "напомнит виджет, когда окажетесь в радиусе; проверка примерно раз в 15 минут" }
      } catch (e) { return { error: String(e.message || e) } }
    }
    case "list_places":
      return { places: live(D.places).map(p => ({ id: p.id, title: p.title, query: p.query, radius_m: p.radius, done: !!p.done, fired: p.firedAt ? iso(new Date(p.firedAt)) : null })) }
    case "mail_search": case "mail_read": case "mail_send": case "mail_reply": case "mail_draft": case "mail_modify": {
      const action = name.slice(5)
      if (action === "send" && !(await chatConfirm(`Отправить письмо?\nКому: ${x.to}${x.cc ? `\nКопия: ${x.cc}` : ""}\nТема: ${x.subject}\n\n${x.body}`)))
        return { cancelled: "пользователь не стал отправлять — спроси, что поправить" }
      if (action === "reply" && !(await chatConfirm(`Ответить${x.all ? " всем" : ""}?\n\n${x.body}`)))
        return { cancelled: "пользователь не стал отправлять — спроси, что поправить" }
      if (action === "modify" && (x.op === "trash" || x.op === "spam") && !(await chatConfirm(`${x.op === "trash" ? "Удалить в корзину" : "Отправить в спам"} ${[].concat(x.ids || []).length} ${plural([].concat(x.ids || []).length, "цепочку", "цепочки", "цепочек")} писем?`)))
        return { cancelled: "пользователь отказался" }
      try {
        const res = await hubPost({ mail: Object.assign({ action }, x) }, 45000)
        return res.mail || { error: "скрипт таблицы старый: разверните новую версию Code.gs, где есть почта" }
      } catch (e) { return { error: String(e.message || e) } }
    }
    case "plan_day":
      return planDay(x.items || [])
    case "where_was_i": {
      const t = parseIso(x.time)
      if (!t) return { error: "время в формате YYYY-MM-DDTHH:MM" }
      const pts = live(D.locs).filter(p => p.lat != null).sort((a, b) => Math.abs(a.date - t) - Math.abs(b.date - t))
      if (!pts.length) return { error: "истории мест пока нет: она собирается виджетом (нужен доступ Scriptable к геопозиции «При использовании приложения или виджетов»)" }
      const p = pts[0], off = Math.round((p.date - t) / 60000)
      const out = { point_time: iso(new Date(p.date)).replace("T", " "), minutes_from_payment: off, lat: p.lat, lng: p.lng, link: `https://maps.google.com/?q=${p.lat},${p.lng}` }
      if (Math.abs(off) > 90) out.note = `ближайшая точка в ${Math.abs(Math.round(off / 60))} ч от платежа — место приблизительное`
      try { const g = await hubPost({ geo: { lat: p.lat, lng: p.lng } }, 20000); if (g.geo && g.geo.address) out.address = g.geo.address } catch (e) {}
      return out
    }
    case "remember": {
      const t = String(x.text || "").trim()
      if (!t) return { error: "пустой факт" }
      const dup = memFacts().find(f => f.text.toLowerCase() === t.toLowerCase())
      if (dup) return { ok: true, id: dup.id, note: "уже помню" }
      const f = upsert("memory", { id: uid("k"), date: Date.now(), kind: "fact", text: t.slice(0, 500) })
      return { ok: true, id: f.id }
    }
    case "forget": {
      if (!live(D.memory).some(f => f.id === x.id)) return { error: "нет такого факта" }
      remove("memory", x.id)
      return { ok: true }
    }
    case "search_chats":
      return searchChats(x.query, x.from, x.to)
    case "delete_record": {
      const list = D[x.kind]
      if (!Array.isArray(list)) return { error: "kind: water, food или workouts" }
      const ids = [].concat(x.ids || []).map(String), have = new Set(live(list).map(e => e.id))
      const gone = ids.filter(id => have.has(id)), missing = ids.filter(id => !have.has(id))
      if (!gone.length) return { error: "записи не найдены", not_found: missing }
      const recs = live(list).filter(e => gone.includes(e.id)), what = { water: "воды", food: "еды", workouts: "тренировок" }[x.kind]
      const desc = x.kind === "water" ? `${recs.reduce((a, w) => a + (+w.ml || 0), 0)} мл` : recs.slice(0, 5).map(e => e.title).join(", ")
      if (!(await chatConfirm(`Удалить ${gone.length} ${gone.length === 1 ? "запись" : gone.length < 5 ? "записи" : "записей"} ${what}? (${desc})`)))
        return { cancelled: "пользователь отказался удалять" }
      gone.forEach(id => remove(x.kind, id))
      if (gone.length) render()
      return { ok: gone.length > 0, deleted: gone.length, not_found: missing, today_water_ml: x.kind === "water" ? waterToday() : undefined }
    }
    case "delete_place": {
      if (!live(D.places).some(p => p.id === x.id)) return { error: "нет такого напоминания" }
      remove("places", x.id)
      return { ok: true }
    }
    case "read_sheet": {
      try {
        const res = await hubPost({ read: { sheet: x.sheet || "", from: x.from || "", to: x.to || "", limit: x.limit || 200 } }, 45000)
        return res.read || { error: "скрипт таблицы старый: разверните новую версию Code.gs" }
      } catch (e) { return { error: String(e.message || e) } }
    }
    case "delete_money": {
      const e = live(D.money).find(z => z.id === x.id)
      if (!e) return { error: "операция не найдена" }
      if (!(await chatConfirm(`Удалить операцию?\n${e.type === "expense" ? "−" : "+"}${core.money(e.amount)} · ${e.category}${e.comment ? " · " + e.comment : ""}`)))
        return { cancelled: "пользователь отказался удалять" }
      remove("money", x.id)
      return { ok: true }
    }
    case "add_food": {
      if (!(x.kcal > 0)) return { error: "калории должны быть больше нуля" }
      const m = addFood({ title: x.title, kcal: x.kcal, protein: Math.round(x.protein || 0), fat: Math.round(x.fat || 0), carbs: Math.round(x.carbs || 0) })
      return { ok: true, id: m.id }
    }
    case "add_water": {
      if (!(x.ml > 0)) return { error: "объём должен быть больше нуля" }
      const now = Date.now()
      upsert("water", { id: `w${now}`, date: now, ml: Math.round(x.ml) })
      return { ok: true, today_ml: waterToday() }
    }
    case "add_workout": {
      if (!(x.kcal > 0)) return { error: "калории должны быть больше нуля" }
      const when = parseIso(x.date) || new Date(), now = Date.now()
      const w = upsert("workouts", { id: `t${now}-${Math.random().toString(36).slice(2, 6)}`, date: +when, title: x.title, minutes: Math.round(+x.minutes || 0), kcal: Math.round(+x.kcal || 0) })
      return { ok: true, id: w.id }
    }
    case "set_budget": {
      const names = core.CONFIG.categories.expense.map(c => c[0])
      if (!names.includes(x.category)) return { error: `категория должна быть одной из: ${names.join(", ")}` }
      setBudget(x.category, x.limit)
      const s = budgetState(x.category)
      return s ? { ok: true, limit: s.limit, spent_this_month: s.spent, left: s.left } : { ok: true, note: "лимит убран" }
    }
    case "add_recurring": {
      const names = core.CONFIG.categories.expense.map(c => c[0])
      if (!names.includes(x.category)) return { error: `категория должна быть одной из: ${names.join(", ")}` }
      if (!(x.amount > 0) || !(x.day >= 1 && x.day <= 31)) return { error: "нужны сумма > 0 и число месяца 1–31" }
      const r = upsert("recur", { id: uid("p"), date: Date.now(), type: "expense", title: x.title, amount: x.amount, day: Math.round(x.day), method: x.method || "transfer", category: x.category, paid: {} })
      if (x.paid_now) recurPay(r)
      return { ok: true, id: r.id }
    }
    case "pay_recurring": {
      const r = live(D.recur).find(z => z.id === x.id)
      if (!r) return { error: "нет такого платежа" }
      if (recurPaid(r)) return { ok: true, note: "уже отмечен оплаченным в этом месяце" }
      const m = recurPay(r)
      return { ok: true, money_id: m.id }
    }
    case "log_weight": {
      if (!(x.kg > 20 && x.kg < 400)) return { error: "вес в кг" }
      const d = parseIso(x.date); if (d) d.setHours(9, 0, 0, 0)
      logWeight(x.kg, d ? +d : Date.now())
      const w = weights(), month = w.filter(z => z.date > Date.now() - 30 * 864e5)
      return { ok: true, kg: x.kg, change_30d: month.length > 1 ? Math.round((month[month.length - 1].kg - month[0].kg) * 10) / 10 : null }
    }
    case "mark_habit": {
      let h = findHabit(x.habit)
      if (!h && x.create) h = upsert("habits", { id: uid("h"), date: Date.now(), title: String(x.habit).trim(), emoji: x.bad ? "🚫" : "✓", bad: !!x.bad })
      if (!h) return { error: "нет такой привычки", habits: habitList().map(z => z.title) }
      const d = parseIso(x.day) || new Date()
      habitToggle(h, d, x.done !== false)
      return { ok: true, habit: h.title, day: dayKey(d), done: x.done !== false, streak_days: habitStreak(h) }
    }
    case "get_health": {
      const d = dayHealth()
      return { eaten_kcal: d.kcal, protein: d.protein, fat: d.fat, carbs: d.carbs, meals: d.food.map(m => ({ id: m.id, time: hm(new Date(m.date)), title: m.title, kcal: m.kcal })),
        water_ml: d.water, water_goal_ml: H().waterGoal, water: today(D.water).map(w => ({ id: w.id, time: hm(new Date(w.date)), ml: w.ml })),
        workouts: d.workouts.map(w => ({ id: w.id, title: w.title, minutes: w.minutes, kcal: w.kcal })),
        watch: d.watch || "нет данных с часов за сегодня",
        weight: (w => w ? { kg: w.kg, date: dayKey(new Date(w.date)) } : null)(weights().pop()),
        habits: habitList().map(h => ({ title: h.title, kind: h.bad ? "бросает" : "делает", done_today: habitOn(h, new Date()), streak_days: habitStreak(h) })) }
    }
    case "claude_code": {
      const r = routes().find(z => z.name === x.route)
      if (!r) return { error: `нет маршрута «${x.route}»` }
      try {
        const res = await hubPost({ fire: { url: r.url, token: r.token, text: x.task } }, 45000)
        if (res.fire && res.fire.session_url) { chatLinks.push(res.fire.session_url); return { ok: true, session_url: res.fire.session_url } }
        return { error: (res.fire && res.fire.error) || "таблица не запустила задачу (обновите скрипт таблицы)" }
      } catch (e) { return { error: String(e.message || e) } }
    }
    case "ask_user": {
      const answer = await chatAsk(x.question, (x.options || []).slice(0, 5))
      return { answer: answer == null ? "(пользователь не ответил — ничего не делай и коротко подтверди отмену)" : answer }
    }
  }
  return { error: `неизвестный инструмент ${name}` }
}
function cancelOp(id) { D.ops = D.ops.filter(o => !(o.id === id && o.state === "local")); save() }

// Как в виджете: с 9 до 21, больше 3 часов без записи воды — подсказка
function waterGap(h, now = new Date()) {
  if (now.getHours() < 9 || now.getHours() >= 21 || h.water >= H().waterGoal) return 0
  const start = new Date(now).setHours(9, 0, 0, 0)
  const last = Math.max(start, ...today(D.water).map(w => w.date || 0))
  const gap = (now - last) / 3600e3
  return gap >= 3 ? Math.floor(gap) : 0
}
// Активность с часов за прошлый день — из истории, которую присылает виджет (там тренировки уже учтены)
const histHealth = d => ((D.snap && D.snap.health) || []).find(h => h && h.day === dayKey(d)) || null
const onDay = (list, d) => live(list).filter(x => sameDay(x.date, d)).sort((a, b) => a.date - b.date)
function dayHealth(day = new Date()) {
  const d0 = sod(day), isToday = sameDay(d0, new Date())
  const food = onDay(D.food, d0), workouts = onDay(D.workouts, d0), waterList = onDay(D.water, d0)
  const sum = k => food.reduce((s, m) => s + (+m[k] || 0), 0)
  const wk = { kcal: workouts.reduce((s, w) => s + (w.kcal || 0), 0), min: workouts.reduce((s, w) => s + (w.minutes || 0), 0) }
  const base = { day: d0, isToday, food, kcal: sum("kcal"), protein: sum("protein"), fat: sum("fat"), carbs: sum("carbs"),
    water: waterList.reduce((s, w) => s + (w.ml || 0), 0), waterList, workouts }
  if (isToday) {
    const v = iphone(), watch = v.watch ? Object.assign({}, v.watch) : null
    return Object.assign(base, { watch, active: (watch && watch.active || 0) + wk.kcal, exercise: (watch && watch.exercise || 0) + wk.min, steps: watch && watch.steps })
  }
  const h = histHealth(d0)
  return Object.assign(base, { watch: h, hist: true, active: h && h.active != null ? h.active : wk.kcal, exercise: h && h.exercise != null ? h.exercise : wk.min,
    steps: h && h.steps != null ? h.steps : null })
}

function agentSystem() {
  const now = new Date(), c = core.CONFIG
  const cats = t => c.categories[t].map(x => x[0]).join(", ")
  const cals = c.calendars || []
  return `Ты — личный ассистент в приложении «Мой день» на iPhone. Пользователь часто говорит голосом по-русски; речь распознаётся с ошибками («падал», «падлу» = «падел»), восстанавливай смысл.
Сейчас ${iso(now).replace("T", " ")}, ${DAY_NAMES[now.getDay()].toLowerCase()}. Используй местное время без смещения, формат YYYY-MM-DDTHH:MM.

Как работать:
- Выполняй команду сам с помощью инструментов. Перед изменением или удалением события найди его через get_events (в разумном диапазоне дат), затем используй его id и start как occurrence_start.
- «Перенеси», «сдвинь», «поменяй время» — это update_event существующего события, а не новое событие.
- Повторяющиеся события меняй только в нужное повторение, если пользователь не сказал «все» или «каждую неделю».
- Время без «утра/вечера»: встречи, спорт, свидания, ужины после 6 обычно вечером; созвоны и работа — днём. Если перепутать дорого и неясно — спроси.
- Уточняй через ask_user, только если без ответа нельзя сделать правильно: не названо новое время переноса, несколько подходящих событий, не указан способ оплаты (наличные или перевод). Давай короткие варианты ответа.
- Календарь — Google Календарь пользователя: события создаёшь, переносишь и удаляешь сразу (create_event/update_event/delete_event). Если инструмент ответил, что изменение ушло в очередь виджета, — скажи коротко «внесу при обновлении виджета».
- Про воду НЕ создавай напоминаний (они захламляют список) — о воде напоминай сам: подсказки plan_day в нужное время и вопросы в чате.
- Напоминания живут в IZIDAY, а не в Напоминаниях iPhone: create_reminder сохраняет их в приложении, уведомление в срок и контроль «Выполнил?» — от IZIDAY. Повторяющиеся (каждый день, по будням) — через repeat. В Напоминания iPhone ничего не вноси.
${cals.length ? `- Календари по словам пользователя: ${cals.map(x => `«${x.calendar}» (список напоминаний «${x.list}»)`).join(", ")}.${cals.filter(x => x.hint).map(x => ` ${x.hint} — «${x.calendar}».`).join("")} Если календарь не назван, не указывай его.
` : ""}- Деньги — ${c.currencyIn}. Категории расходов: ${cats("expense")}. Категории доходов: ${cats("income")}.
- Фото или файл от пользователя — сначала пойми, что это, и действуй:
  • Еда или блюдо: что это, порция, ккал и БЖУ одной строкой; спроси ask_user «Записать в еду?» [Да, Нет] и при «Да» — add_food.
  • Счёт, инвойс, квитанция к оплате (коммуналка, интернет, аренда, штраф и т. п.): от кого, за что, сумма с валютой, срок оплаты (если есть — и сколько дней осталось), номер счёта/реквизиты кратко. Если есть срок или его можно понять — спроси ask_user «Напомнить об оплате?» [За день до срока, В день срока, Не нужно] и создай create_reminder «Оплатить <от кого> — <сумма>» на 10:00 нужного дня. Счёт ещё не оплачен — расход не записывай.
  • Чек из магазина, кафе или ресторана: где и когда, позиции списком «название — цена» (переведи на русский, оригинал в скобках, если неясно), скидки и сервисный сбор, итог. Затем ask_user «Записать расход <итог>?» [Наличные, Карта / перевод, Не записывать] и add_money с подходящей категорией и коротким комментарием (магазин, 2–3 главных позиции). Дата — из чека, если не сегодня.
  • Другое (документ, скриншот, визитка…): кратко перескажи главное и предложи, что можно сделать (событие, напоминание, расход).
  Отвечай коротко, без лишних вступлений.
- «Этот платёж не вноси / он по работе» про платёж, которого ещё нет в расходах (придёт по карте позже) — сразу skip_card_payment, не проси пользователя напомнить потом.
- Любой вопрос о платеже или переводе (особенно «что это за платёж?» или когда ты сам спрашиваешь о непонятной трате): всегда называй дату и точное время платежа и место, где был пользователь в тот момент, — where_was_i по времени платежа: адрес и ссылка на Google Карты (ссылкой целиком). Если точка далека по времени — так и скажи. Платежи по карте — лист «Карта» (read_sheet), остальные — get_money.
- Почта Gmail пользователя: mail_search → mail_read, ответы mail_reply, новые письма mail_send, черновики mail_draft, разбор mail_modify. Про письма отвечай по сути: от кого, что хотят, срок, что сделать; длинные — пересказывай. Найдёшь в письме встречу, срок оплаты или задачу — предложи событие или напоминание. Пиши письма сам, от первого лица пользователя, коротко и по-деловому; отправка — только когда пользователь попросил отправить или ответить (подтверждение приложение покажет само).
- Лимиты расходов по категориям — set_budget; при записи расхода, если инструмент вернул budget.warn, коротко скажи, сколько осталось. Регулярные платежи (аренда, подписки) — add_recurring и pay_recurring; список и лимиты — в get_money.
- Привычки (зарядка, чтение; «бросаю пить/курить») — mark_habit; «сегодня не пил» для привычки «бросаю» — done=false. Вес («вешу 78,5») — log_weight. Серии и вес — в get_health.
- «Съел», «выпил стакан воды» — add_food и add_water. «Удали лишнюю воду/еду/тренировку» — найди id через get_health (или get_history с details) и delete_record. На вопросы о калориях, шагах и воде смотри get_health.
- Тренировка без часов («проплыл бассейн 10 раз», «час падела, часы забыл») — add_workout. Вес пользователя ${H().weight || 80} кг. Скажи, сколько ккал и минут записал.
- Если пользователь спрашивает (что у меня завтра, сколько потратил), посмотри данные и ответь.
- У тебя есть доступ ко всем данным пользователя: Google Календарь, напоминания IZIDAY, деньги (и платежи по карте), еда, вода, тренировки, шаги и активность с часов — за сегодня и за прошлые дни.
  История по дням — get_history; любой лист таблицы виджета целиком — read_sheet.
- «Сколько ехать до …», «далеко ли …» — route_to: ответь минутами и километрами (если есть minutes_in_traffic — с учётом пробок).
- «Напомни, когда буду рядом с …», «напомни заехать в …» — remind_near. Скажи, какие точки нашлись, и что напомнит виджет при проезде рядом. Не говори, что данных нет, пока не посмотрел. Замечай закономерности (недобор воды, перерасход, мало шагов) и говори о них, когда к месту.
- Удаление и перенос пользователь подтверждает сам — не спрашивай отдельно «точно удалить?» или «точно перенести?».`
}
// ── Помощник ведёт день: план подсказок → уведомления от виджета ──
function planDay(items) {
  const now = Date.now(), end = +addDays(sod(new Date()), 1)
  live(D.nudges).filter(n => n.date > now && n.date < end).forEach(n => remove("nudges", n.id))
  const ok = []
  for (const it of items.slice(0, 14)) {
    const t = parseIso(it.time)
    if (!t || +t <= now || +t >= end || !String(it.text || "").trim()) continue
    ok.push(upsert("nudges", { id: uid("n"), date: +t, text: String(it.text).trim().slice(0, 240) }))
  }
  D.planDay = dayKey(new Date()); save()
  return { ok: true, planned: ok.map(n => ({ time: hm(new Date(n.date)), text: n.text })), note: "уведомления поставит виджет при следующем обновлении (обычно до 15 минут)" }
}
// Раз в день (при первом открытии после 6:00) помощник сам составляет план подсказок на день
let planBusy = false
async function autoPlan() {
  const now = new Date()
  if (planBusy || !aiKey() || now.getHours() < 6 || now.getHours() >= 21 || D.planDay === dayKey(now)) return
  planBusy = true
  try {
    const sys = chatSystem() + `

Сейчас ты сам, без запроса, планируешь день пользователя. Посмотри календарь и напоминания на сегодня, еду и воду, активность и вчерашний день (get_history), память.
Составь через plan_day 4–8 подсказок на оставшуюся часть дня: вода (с учётом выпитого и дел, не во время встреч), еда (если обычно пропускает — напомни), подготовка к важным встречам и дорога (за 30–60 мин), движение и шаги, одна идея или мысль дня по его целям из памяти, вечером — короткий итог. Не дублируй уведомления о встречах — они уже есть. Пиши тепло и коротко, на «ты»/«вы» — как пользователь привык. Ответь одной строкой, что запланировал.`
    const msgs = [{ role: "user", content: `[${hm(now)}] Спланируй мне сегодняшний день подсказками.` }]
    const tools = chatTools().filter(t => /^(get_|plan_day|list_places|read_sheet|mail_search|search_chats)/.test(t.name))
    const r = await agentTurn(msgs, sys, tools)
    if (D.planDay === dayKey(now) && r) { D.chat.push({ role: "assistant", text: `🗓 ${r}`, at: Date.now() }); save(false); if (tab === "chat") renderChat() }
  } catch (e) {} finally { planBusy = false }
}

// ── Память помощника: факты о человеке и сводки прошлых разговоров (лист «Память помощника» в таблице) ──
const memFacts = () => live(D.memory).filter(m => m.kind === "fact").sort((a, b) => a.date - b.date)
const memChats = () => live(D.memory).filter(m => m.kind === "chat").sort((a, b) => a.date - b.date)
const GAP = 3 * 3600e3   // пауза дольше трёх часов — новый разговор
function memoryBlock() {
  const f = memFacts().slice(-120), c = memChats().slice(-15)
  const d = t => { const x = new Date(t); return `${x.getDate()} ${MON_GEN[x.getMonth()].slice(0, 3)}` }
  return `
Твоя память о пользователе (храни и пополняй: remember / forget):
${f.length ? f.map(m => `- ${m.text} [${m.id}]`).join("\n") : "- пока пусто"}
Прошлые разговоры, кратко (подробности — search_chats):
${c.length ? c.map(m => `- ${d(m.date)}: ${m.text}`).join("\n") : "- пока нет"}`
}
const words = q => String(q || "").toLowerCase().replace(/ё/g, "е").split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2).map(w => w.length > 5 ? w.slice(0, -2) : w)   // грубая основа слова: «падела» ≈ «падел»
function searchChats(query, from, to) {
  const ws = words(query), f = parseIso(from), t = to ? +addDays(sod(parseIso(to) || new Date()), 1) : Infinity
  if (!ws.length) return { error: "нужны слова для поиска" }
  const all = [...D.chatArchive, ...D.chat].filter(m => !m.local && m.text)
  const score = txt => { const l = String(txt).toLowerCase().replace(/ё/g, "е"); return ws.reduce((s, w) => s + (l.includes(w) ? 1 : 0), 0) }
  const hits = []
  all.forEach((m, i) => { if ((f && m.at < +f) || m.at >= t) return; const sc = score(m.prompt || m.text); if (sc) hits.push({ sc, i }) })
  hits.sort((a, b) => b.sc - a.sc || all[b.i].at - all[a.i].at)
  const shown = new Set(), out = []
  for (const h of hits.slice(0, 12)) for (const j of [h.i - 1, h.i, h.i + 1]) {
    const m = all[j]; if (!m || shown.has(j) || m.local) continue; shown.add(j)
    out.push({ at: iso(new Date(m.at)).replace("T", " "), who: m.role === "user" ? "пользователь" : "ты", text: String(m.text).slice(0, 400) })
  }
  out.sort((a, b) => a.at < b.at ? -1 : 1)
  const sums = memChats().filter(m => score(m.text)).slice(-8).map(m => ({ date: iso(new Date(m.date)).slice(0, 10), summary: m.text }))
  return { messages: out, summaries: sums, note: out.length || sums.length ? undefined : "ничего не нашлось — попробуй другие слова" }
}
// Закончившийся разговор (пауза > 3 ч или «Очистить») — коротко в память и новые факты. Дешёвая быстрая модель, в фоне.
const MEM_SCHEMA = { type: "object", additionalProperties: false, required: ["summary", "facts", "outdated"], properties: {
  summary: { type: "string", description: "1–3 предложения: о чём говорили, что решили, что сделали, что осталось открытым" },
  facts: { type: "array", items: { type: "string" }, description: "Новые устойчивые факты о пользователе, которых ещё нет в памяти. Пусто, если нет." },
  outdated: { type: "array", items: { type: "string" }, description: "id фактов из памяти, которые этот разговор опроверг или заменил" } } }
let memBusy = false
async function memorize(force) {
  if (memBusy || !aiKey()) return
  const done = D.memAt || 0
  const msgs = [...D.chatArchive, ...D.chat].filter(m => m.at > done && !m.local && m.text)
  if (!msgs.length) return
  const lastAt = msgs[msgs.length - 1].at
  if (!force && Date.now() - lastAt < GAP) return
  if (msgs.length < 2 && !force) { D.memAt = lastAt; return save(false) }
  memBusy = true
  try {
    const conv = msgs.slice(-80).map(m => `${m.role === "user" ? "Пользователь" : "Помощник"} (${iso(new Date(m.at)).replace("T", " ")}): ${String(m.text).slice(0, 1200)}`).join("\n")
    const res = await claude({ max_tokens: 3000, output_config: { format: { type: "json_schema", schema: MEM_SCHEMA } },
      system: "Ты ведёшь долговременную память личного помощника. По разговору составь краткую сводку и выпиши только новые устойчивые факты о пользователе " +
        "(люди, предпочтения, цели, планы, здоровье, работа, договорённости, даты). Не записывай разовые мелочи (что выпил воды, разовую покупку). Пиши по-русски.",
      messages: [{ role: "user", content: `Память сейчас:\n${memFacts().map(f => `- ${f.text} [${f.id}]`).join("\n") || "- пусто"}\n\nРазговор:\n${conv}` }] }, 60000, { model: "claude-haiku-5-5" })
    const txt = res && res.content && (res.content.find(c => c.type === "text") || {}).text
    if (!txt) return
    const j = JSON.parse(txt)
    if (j.summary) upsert("memory", { id: uid("c"), date: msgs[0].at, kind: "chat", text: String(j.summary).slice(0, 600) })
    for (const t of j.facts || []) if (t && !memFacts().some(f => f.text.toLowerCase() === t.toLowerCase())) upsert("memory", { id: uid("k"), date: Date.now(), kind: "fact", text: String(t).slice(0, 500) })
    for (const id of j.outdated || []) if (memFacts().some(f => f.id === id)) remove("memory", id)
    D.memAt = lastAt
    save()
  } catch (e) { /* попробуем при следующем сообщении */ } finally { memBusy = false }
}

function chatSystem() {
  const r = routes()
  return agentSystem() + memoryBlock() + `

Это постоянный чат. Ты — личный помощник, секретарь и друг пользователя: помогаешь в любом деле — в жизни и в работе.
- Дела (встречи, напоминания, деньги, еда, вода, тренировки) делай сам инструментами, потом коротко скажи, что сделал.
- Когда просят совета или делятся чем-то личным — отвечай как умный друг: честно, по существу, с заботой, думай на годы вперёд, а не только о сегодняшнем дне. Можно мягко не согласиться.
- Длина ответа: обычно 1–6 строк; совет или разбор — сколько нужно, но без воды. Без Markdown-заголовков и таблиц, короткие списки можно.
- В начале сообщений пользователя в квадратных скобках время, когда оно отправлено; сам время в скобках не пиши.
- Понимай с полуслова: учитывай память, прошлые разговоры и данные (календарь, деньги, здоровье). Связывай новое с прошлым («в прошлый раз вы говорили…»), если это к месту. Если пользователь ссылается на прошлое, а в памяти нет — поищи search_chats, прежде чем переспрашивать.
- Узнал о пользователе что-то устойчивое (люди, предпочтения, цели, планы, договорённости) — запомни через remember, не спрашивая разрешения и не объявляя об этом. Попросят забыть — forget.
- Голосовые сообщения распознаются с ошибками: восстанавливай смысл по контексту и памяти; уточняй, только если цена ошибки высока.
- Перед ответом подумай, что человек на самом деле хочет и что ему пригодится дальше; можно одним предложением предложить следующий шаг.
- Ты ведёшь день пользователя: по календарю, здоровью, еде, воде и целям. Подсказки-уведомления на iPhone ставишь через plan_day (утром план составляется сам). Попросят «напоминай/подсказывай/веди меня» — обнови план.
- Напоминания контролируешь ты: невыполненное в срок — спрашиваешь, сделал ли, напоминаешь снова, предлагаешь перенести и выясняешь причину (уведомления «Выполнил?» приходят от IZIDAY). Если пользователь пишет, почему не сделал — посочувствуй коротко, перенеси через update_reminder на реальное время по календарю и запомни повторяющуюся причину.
- Учись: если пользователь поправил тебя, сказал «не так», «не надо», «лучше…», или видно его привычку — запомни это как предпочтение через remember («Предпочитает…», «Не любит…») и дальше делай так.
${r.length ? `- Сложную задачу, которую не решить здесь за пару сообщений (код, разбор документов, исследование, подготовка текста или плана, многошаговая работа), передай через claude_code. Рабочую — в маршрут нужного рабочего проекта по его описанию; личную, не связанную с работой, — в маршрут для личных задач. Если неясно, что именно нужно, сначала коротко уточни. После передачи скажи одной строкой, куда передал; ссылка на сессию покажется сама.`
  : "- Передавать задачи в Claude Code пока нельзя: маршруты не подключены (в виджете: меню → 🤖 Задачи в Claude Code, потом подключить приложение заново). Сложную задачу честно назови сложной и предложи подключить."}`
}
const BRIEFS = {
  morning: { label: "☀️ Утренняя сводка", prompt: "Сделай утреннюю сводку на сегодня. Посмотри события и напоминания на сегодня (и просроченные), " +
    "траты за месяц (и лимиты, если близко к превышению), регулярные платежи к оплате в ближайшие дни, важные непрочитанные письма за сутки (mail_search «is:unread newer_than:1d -category:promotions -category:social», если почта доступна). Расскажи: что сегодня по порядку со временем, что важно не забыть, что просрочено; сколько потрачено в этом месяце. " +
    "В конце одна короткая дружеская мысль или совет на день. Ничего не меняй." },
  evening: { label: "🌙 Вечерняя сводка", prompt: "Сделай вечернюю сводку за сегодня. Посмотри события и напоминания (вместе с выполненными), " +
    "деньги и еду с водой и активностью за сегодня, события на завтра. Расскажи: что сделано, что не сделано; сколько потрачено сегодня " +
    "(итог и главные траты); сколько съедено ккал и БЖУ, вода, активность; что завтра. Если есть невыполненные напоминания на сегодня " +
    "или просроченные — спроси через ask_user, перенести ли их на завтра (варианты: «Перенести всё на завтра», «Выберу сам», «Оставить как есть») " +
    "и сделай, как ответят; время у перенесённых сохраняй, без времени — на завтра." },
}
function chatContext() {
  const out = []
  for (const m of D.chat.slice(-40)) {
    let content = m.prompt || m.text
    if (!content || m.local) continue
    if (m.role === "user") { const d = new Date(m.at || Date.now()); content = `[${d.getDate()} ${MON_GEN[d.getMonth()].slice(0, 3)} ${hm(d)}] ${content}` }
    const last = out[out.length - 1]
    if (last && last.role === m.role) last.content += "\n\n" + content
    else out.push({ role: m.role, content })
  }
  while (out.length && out[0].role !== "user") out.shift()
  return out
}
const dropThinking = messages => messages.forEach(m => {
  if (m.role === "assistant" && Array.isArray(m.content)) m.content = m.content.filter(c => c.type !== "thinking" && c.type !== "redacted_thinking")
})
// Один ход помощника: Claude думает и вызывает инструменты, пока не даст ответ
let chatStopCtl = null
// Что помощник делает прямо сейчас — подпись у «…» в чате
const TOOL_STATUS = { get_events: "смотрю календарь", create_event: "создаю событие", update_event: "переношу событие", delete_event: "удаляю событие",
  get_reminders: "смотрю напоминания", create_reminder: "ставлю напоминание", update_reminder: "меняю напоминание", delete_reminder: "удаляю напоминание",
  add_money: "записываю расход", get_money: "смотрю деньги", delete_money: "удаляю операцию", set_budget: "ставлю лимит", add_recurring: "добавляю платёж", pay_recurring: "отмечаю оплату",
  add_food: "записываю еду", add_water: "записываю воду", add_workout: "записываю тренировку", get_health: "смотрю здоровье", get_history: "смотрю историю",
  log_weight: "записываю вес", mark_habit: "отмечаю привычку", read_sheet: "читаю таблицу", route_to: "считаю дорогу", remind_near: "ищу места", where_was_i: "смотрю, где вы были",
  mail_search: "ищу в почте", mail_read: "читаю письмо", mail_send: "отправляю письмо", mail_reply: "отвечаю на письмо", mail_draft: "сохраняю черновик", mail_modify: "разбираю почту",
  remember: "запоминаю", search_chats: "вспоминаю прошлые разговоры", plan_day: "составляю план дня", claude_code: "передаю задачу в Claude Code", delete_record: "удаляю запись" }
let chatStatus = "", chatStatusAt = 0
function setStatus(s) {
  chatStatus = s; chatStatusAt = Date.now()
  const el = $(".typing .st")
  if (el) el.textContent = s
  else if (tab === "chat" && chatBusy && !askWait) renderChat()
}
setInterval(() => {   // долгое ожидание — показать, сколько уже идёт
  const el = $(".typing .st")
  if (el && chatStatus) { const sec = Math.round((Date.now() - chatStatusAt) / 1000); el.textContent = chatStatus + (sec >= 8 ? ` · ${sec} с` : "") }
}, 1000)
async function agentTurn(messages, system, tools) {
  const stopSig = chatStopCtl && chatStopCtl.signal
  // Кэш: описание инструментов одинаковое всегда, а внутри хода каждый шаг повторяет предыдущие — повтор стоит в 10 раз дешевле
  const ctools = tools.map((t, i) => i === tools.length - 1 ? Object.assign({}, t, { cache_control: { type: "ephemeral" } }) : t)
  const ask = () => claude({ max_tokens: 16000, system, tools: ctools, messages, output_config: { effort: "high" }, cache_control: { type: "ephemeral" } }, 150000, { smart: true, model: CHAT_MODEL, signal: stopSig })
  for (let step = 0; step < 14; step++) {
    let res
    setStatus(step ? "готовлю ответ…" : "думаю…")
    try {
      res = await ask()
      if (res && res.error && /thinking/i.test(res.error.message || "")) { dropThinking(messages); res = await ask() }
    } catch (e) { if (stopSig && stopSig.aborted) return null; return `Нет связи с Claude: ${e.message || e}` }
    if (!res || res.error) return `Claude ответил ошибкой: ${res && res.error ? res.error.message || res.error.type : "пустой ответ"}`
    messages.push({ role: "assistant", content: res.content })
    const uses = (res.content || []).filter(c => c.type === "tool_use")
    if (res.stop_reason === "refusal") return "Не могу с этим помочь — попробуйте сформулировать иначе."
    if (!uses.length || res.stop_reason !== "tool_use") return (res.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim() || "Готово."
    const results = []
    if (stopSig && stopSig.aborted) return null
    for (const u of uses) {
      let out
      setStatus((TOOL_STATUS[u.name] || "работаю") + "…")
      try { out = await runTool(u.name, u.input || {}) } catch (e) { out = { error: String(e.message || e) } }
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) })
    }
    messages.push({ role: "user", content: results })
  }
  return "Не удалось закончить — попробуйте сформулировать проще."
}

let chatBusy = false, chatLinks = [], askWait = null
async function chatSend(text, opts = {}) {
  text = String(text || "").trim()
  if (!text) return
  // ответ на вопрос помощника (ask_user или подтверждение)
  if (askWait) { const w = askWait; askWait = null; D.chat.push({ role: "user", text, at: Date.now(), voice: !!opts.voice, local: true }); save(false); renderChat(); w(text); return }
  if (chatBusy) { toast("Помощник ещё отвечает…"); return }
  memorize()
  if (!aiKey()) { setTab("more"); return ui.info("Нужен ключ Claude", "Подключите приложение кодом из виджета: в Scriptable меню → 📱 Приложение «Мой день» → «Подключить приложение».") }
  const item = { role: "user", text: opts.label || text, prompt: opts.label ? text : undefined, at: Date.now(), voice: !!opts.voice, thumb: opts.attach && opts.attach.thumb || undefined }
  D.chat.push(item)
  chatBusy = true
  chatLinks = []
  save(false)
  if (tab !== "chat") setTab("chat"); else renderChat()
  let reply
  const ctx = chatContext()
  if (opts.attach && ctx.length) {   // само вложение уходит только в этот запрос; в истории остаются миниатюра и ответ помощника
    const a = opts.attach, last = ctx[ctx.length - 1]
    last.content = [{ type: a.type, source: { type: "base64", media_type: a.media_type, data: a.data } }, { type: "text", text: last.content }]
  }
  chatStopCtl = new AbortController()
  setBusyUI(true)
  try { reply = await agentTurn(ctx, chatSystem(), chatTools()) } catch (e) { reply = `Ошибка: ${e.message || e}` }
  const stopped = chatStopCtl.signal.aborted
  chatStopCtl = null
  chatBusy = false
  setBusyUI(false)
  if (stopped) {   // «Стоп»: вопрос возвращается в строку ввода — поправить и отправить заново
    const i = D.chat.lastIndexOf(item)
    if (i >= 0) D.chat.splice(i)
    save(false); if (tab === "chat") renderChat()
    const inp = $("#chat-in"); if (inp && !opts.attach && !opts.label) { inp.value = text; grow(inp); inp.focus() }
    toast("⏹ Остановлено — поправьте и отправьте")
    return
  }
  D.chat.push({ role: "assistant", text: reply, at: Date.now(), links: chatLinks.slice() })
  if (D.chat.length > 200) { D.chatArchive = D.chatArchive.concat(D.chat.slice(0, D.chat.length - 200).map(m => ({ role: m.role, text: m.text, prompt: m.prompt, at: m.at, local: m.local }))).slice(-1500); D.chat = D.chat.slice(-200) }
  D.chat.filter(m => m.thumb).slice(0, -12).forEach(m => { delete m.thumb })   // миниатюры только у последних фото — память телефона
  save(false)
  sync()
  if (tab === "chat") renderChat()
  else toast("💬 Помощник ответил")
}
function setBusyUI(on) {
  const b = $(".chat-bar .send"); if (!b) return
  b.classList.toggle("stop", on); b.innerHTML = on ? ICO.stop : ICO.send; b.setAttribute("aria-label", on ? "Остановить" : "Отправить")
}
function chatStop() {
  if (!chatStopCtl) return
  chatStopCtl.abort()
  if (askWait) { const w = askWait; askWait = null; w("") }   // помощник ждал ответа на вопрос — отменяем
}
// ✎ у своего сообщения: текст обратно в строку ввода, это сообщение и всё после него убираются
function chatEdit(idx) {
  const m = D.chat[idx]
  if (!m || m.role !== "user") return
  if (chatBusy) chatStop()
  const t = m.text
  setTimeout(() => {
    const j = D.chat.indexOf(m); if (j >= 0) D.chat.splice(j)
    save(false); renderChat()
    const inp = $("#chat-in"); if (inp) { inp.value = t; grow(inp); inp.focus() }
  }, chatBusy ? 50 : 0)
}
// Вопрос помощника прямо в чате: варианты кнопками, можно ответить голосом или текстом
function chatAsk(question, options) {
  return new Promise(res => {
    D.chat.push({ role: "assistant", text: question, at: Date.now(), opts: options, local: true })
    save(false)
    askWait = a => res(a)
    if (tab === "chat") renderChat(); else setTab("chat")
  })
}
async function chatConfirm(question) {
  const a = await chatAsk(question, ["Да", "Нет"])
  return /^(да|ага|конечно|давай|ок|okay|yes|удаляй|переноси)/i.test(String(a || "").trim())
}
function brief(kind) {
  const b = BRIEFS[kind]
  if (b) chatSend(b.prompt, { label: b.label })
}

// ── Голос: распознавание речи Safari, иначе — диктовка с клавиатуры ──
// Слушает, пока человек говорит: отправляет только после паузы тишины (SILENCE_MS).
// Повторное нажатие на 🎤 — отправить сразу. Если Safari сам обрывает распознавание раньше паузы — слушаем дальше.
const SILENCE_MS = 2500, FIRST_WORD_MS = 8000
let rec = null, voice = null
function micStart(auto) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  const inp = $("#chat-in")
  if (!SR) { if (inp) inp.focus(); toast("Нажмите 🎤 на клавиатуре и говорите"); return }
  if (voice) return voiceFinish()
  voice = { done: "", base: inp ? inp.value.trim() : "", timer: null, finishing: false }
  const v = voice
  const show = (extra = "") => { v.text = [v.base, v.done, extra].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(); const i = $("#chat-in"); if (i) { i.value = v.text; grow(i) } }
  const arm = ms => { clearTimeout(v.timer); v.timer = setTimeout(voiceFinish, ms) }
  $(".chat-bar .mic") && $(".chat-bar .mic").classList.add("on")
  if (inp) inp.placeholder = "Слушаю… ➤ — отправить сразу"
  const run = first => {
    const r = new SR()
    r.lang = "ru-RU"; r.interimResults = true; r.continuous = true
    let fin = "", all = ""
    r.onresult = e => {
      let interim = ""
      fin = ""
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + " "
        else interim += e.results[i][0].transcript
      }
      all = fin + interim
      show(all)
      arm(SILENCE_MS)
    }
    r.onerror = e => {
      if (e.error === "no-speech" || e.error === "aborted") return
      if (first && auto && e.error === "not-allowed") { voiceReset(); return micPrompt() }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { voiceReset(); toast("Нет доступа к микрофону: Настройки → Safari → Микрофон (и Siri и Диктовка включены)"); if (inp) inp.focus(); return }
      v.err = e.error   // сеть, занят микрофон и т. п. — не перезапускаем по кругу, отправляем услышанное
      toast(`Микрофон: ${({ network: "нет сети для распознавания", "audio-capture": "микрофон занят другим приложением", "language-not-supported": "русский язык недоступен" })[e.error] || e.error}`)
    }
    r.onend = () => {
      if (voice !== v) return
      v.done = [v.done, all.trim()].filter(Boolean).join(" ")
      if (v.finishing || v.err) return voiceSend(v)
      // Safari закончил сам, а пауза ещё не набралась — продолжаем слушать
      try { rec = run(false) } catch (e) { voiceSend(v) }
    }
    r.start()
    return r
  }
  const fail = e => { voiceReset(); if (auto) return micPrompt(); toast(`Микрофон не запустился: ${e && (e.message || e.name) || e}`); if (inp) inp.focus() }
  try { rec = run(true); arm(FIRST_WORD_MS) }
  catch (e) {   // прошлая запись ещё не отпустила микрофон (например, сразу после ➤) — пробуем ещё раз чуть позже
    setTimeout(() => { if (voice !== v) return; try { rec = run(true); arm(FIRST_WORD_MS) } catch (e2) { fail(e2) } }, 500)
  }
}
function voiceFinish() {
  const v = voice
  if (!v || v.finishing) return
  v.finishing = true
  clearTimeout(v.timer)
  try { rec && rec.stop() } catch (e) { voiceSend(v) }
  setTimeout(() => { if (voice === v) voiceSend(v) }, 1500)   // если onend не пришёл
}
function voiceSend(v) {
  if (voice !== v) return
  const inp = $("#chat-in")
  const t = [v.base, v.done].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
  voiceReset()
  if (v.done.trim() && inp) { inp.value = ""; grow(inp); chatSend(t, { voice: true }) }
}
// Зелёная ➤ во время записи: отправить то, что уже услышано, не дожидаясь паузы
function voiceSendNow() {
  const v = voice, i = $("#chat-in")
  const t = ((i && i.value) || v.text || "").trim()
  const r = rec
  voiceReset()
  try { r && r.stop() } catch (e) {}   // stop, не abort: Safari после abort иногда не отдаёт микрофон следующей записи
  if (i) { i.value = ""; grow(i) }
  if (t) chatSend(t, { voice: true })
}
function voiceReset() {
  if (voice) clearTimeout(voice.timer)
  voice = null; rec = null
  const b = $(".chat-bar .mic"); if (b) b.classList.remove("on")
  const inp = $("#chat-in"); if (inp) inp.placeholder = "Напишите или скажите…"
}
// Прокручивается только середина (main), шапка и нижнее меню стоят на месте
const scrollView = end => { const m = $("#view"); if (m) m.scrollTop = end ? m.scrollHeight : 0 }
const grow = el => { el.style.height = "auto"; el.style.height = Math.min(120, el.scrollHeight) + "px" }

// ───────────── Формы ─────────────
function moneyForm(type, entry) {
  return new Promise(res => {
    const e = entry || { type, amount: "", method: "cash", category: "", comment: "", date: Date.now() }
    type = e.type
    const cats = core.CONFIG.categories[type].map(c => c[0])
    let cat = e.category, method = e.method, manualCat = !!entry, done = false
    const s = sheet(`<h3>${entry ? "Изменить" : type === "expense" ? "➖ Расход" : "➕ Доход"}</h3>
      <div class="field"><input id="m-amt" class="huge" type="number" inputmode="decimal" placeholder="0 ${esc(core.CONFIG.currency)}" value="${e.amount}"></div>
      <div class="field"><input id="m-com" placeholder="Комментарий: такси, кафе, зарплата…" value="${esc(e.comment)}"></div>
      <div class="field"><div class="seg" id="m-meth"><button data-m="cash">💵 Наличные</button><button data-m="transfer">💳 Перевод / карта</button></div></div>
      <div class="field"><label>Категория</label><div class="chips" id="m-cats">${cats.map(c => `<button class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
      <div class="field"><label>Дата</label><input id="m-date" type="date" value="${dayKey(new Date(e.date))}"></div>
      <div class="btns">${entry ? '<button class="btn red" data-a="del">Удалить</button>' : `<button class="btn small" data-a="swap">${type === "expense" ? "➕ Это доход" : "➖ Это расход"}</button>`}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`,
    { onClose: () => res(done) })
    const paint = () => {
      $$("#m-meth button", s.el).forEach(b => b.classList.toggle("on", b.dataset.m === method))
      $$("#m-cats .chip", s.el).forEach(b => b.classList.toggle("on", b.dataset.c === cat))
    }
    paint()
    $$("#m-meth button", s.el).forEach(b => b.onclick = () => { method = b.dataset.m; paint() })
    $$("#m-cats .chip", s.el).forEach(b => b.onclick = () => { cat = b.dataset.c; manualCat = true; paint() })
    $("#m-com", s.el).oninput = ev => {
      if (manualCat) return
      const p = core.parseMoney(" " + ev.target.value + " ", type)
      if (p.category && p.category !== "Другое") { cat = p.category; paint() }
    }
    if (!entry) setTimeout(() => $("#m-amt", s.el).focus(), 250)
    $('[data-a="no"]', s.el).onclick = () => s.close()
    const swap = $('[data-a="swap"]', s.el)
    if (swap) swap.onclick = () => { s.close(); moneyForm(type === "expense" ? "income" : "expense").then(res) }
    if (entry) $('[data-a="del"]', s.el).onclick = () => { remove("money", entry.id); done = true; s.close(); render() }
    $('[data-a="ok"]', s.el).onclick = () => {
      const amount = parseFloat(String($("#m-amt", s.el).value).replace(",", "."))
      if (!(amount > 0)) { toast("Введите сумму"); return }
      const dv = $("#m-date", s.el).value
      let date = e.date
      if (dv && dv !== dayKey(new Date(e.date))) { const [y, m, d] = dv.split("-").map(Number); const x = new Date(); date = +new Date(y, m - 1, d, x.getHours(), x.getMinutes()) }
      const rec = upsert("money", Object.assign({}, entry || { id: `f${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, { type, amount, method,
        category: cat || cats[cats.length - 1], comment: $("#m-com", s.el).value.trim(), date }))
      done = true; s.close(); render()
      const bn = type === "expense" ? budgetNote(rec.category, rec.date) : ""
      toast(`${type === "expense" ? "−" : "+"}${core.money(amount)} · ${rec.category}${bn ? " · " + bn : ""}`)
    }
  })
}

function foodForm(f) {
  return new Promise(res => {
    let done = false
    const recent = []
    for (const x of live(D.food).sort((a, b) => b.date - a.date)) if (x.title && !recent.some(r => r.title.toLowerCase() === x.title.toLowerCase())) recent.push(x)
    const s = sheet(`<h3>${f ? "Еда" : "🍽 Что съели?"}</h3>
      ${!f && recent.length ? `<div class="field"><label>Недавнее — нажмите, чтобы добавить ещё раз</label><div class="chips">${recent.slice(0, 10).map((x, i) =>
        `<button class="chip" data-r="${i}">${esc(x.title)} · ${num(x.kcal)}</button>`).join("")}</div></div>` : ""}
      <div class="field"><input id="f-n" placeholder="Блюдо: овсянка, борщ, кофе с молоком" value="${esc(f ? f.title : "")}"></div>
      <div class="field"><label>Калории, ккал</label><input id="f-k" type="number" inputmode="numeric" value="${f ? f.kcal : ""}" placeholder="350"></div>
      ${f ? `<div class="muted small">Б ${num(f.protein)} · Ж ${num(f.fat)} · У ${num(f.carbs)} г · ${hm(new Date(f.date))}</div>` : ""}
      <div class="btns">${f ? '<button class="btn red" data-a="del">Удалить</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`,
    { onClose: () => res(done) })
    $('[data-a="no"]', s.el).onclick = () => s.close()
    $$("[data-r]", s.el).forEach(b => b.onclick = () => {
      const x = recent[+b.dataset.r]
      addFood({ title: x.title, kcal: x.kcal, protein: x.protein || 0, fat: x.fat || 0, carbs: x.carbs || 0 })
      done = true; s.close(); render(); toast(`+${num(x.kcal)} ккал · ${x.title}`)
    })
    if (f) $('[data-a="del"]', s.el).onclick = () => { remove("food", f.id); done = true; s.close(); render() }
    $('[data-a="ok"]', s.el).onclick = () => {
      const title = $("#f-n", s.el).value.trim() || "Еда"
      const kcal = Math.round(parseFloat($("#f-k", s.el).value))
      if (!(kcal >= 0)) { toast("Укажите калории"); return }
      if (f) upsert("food", Object.assign({}, f, { title, kcal })); else addFood({ title, kcal })
      done = true; s.close(); render()
    }
  })
}

const SPORTS = [["Ходьба", 3.8], ["Бег", 9], ["Велосипед", 7], ["Плавание", 7], ["Зал", 5], ["Йога", 3], ["Падел / теннис", 7], ["Танцы", 5], ["Другое", 4.5]]
function workoutForm(w) {
  return new Promise(res => {
    const weight = H().weight || 80
    let done = false, sport = w ? (SPORTS.find(x => (w.title || "").startsWith(x[0])) || SPORTS[SPORTS.length - 1])[0] : SPORTS[0][0], edited = !!w
    const s = sheet(`<h3>${w ? "Тренировка" : "🏃 Тренировка без часов"}</h3>
      <div class="field"><div class="chips" id="w-s">${SPORTS.map(x => `<button class="chip" data-s="${esc(x[0])}">${esc(x[0])}</button>`).join("")}</div></div>
      <div class="field"><label>Минут</label><input id="w-m" type="number" inputmode="numeric" value="${w ? w.minutes : 30}"></div>
      <div class="field"><label>Сожжено, ккал (примерно, по весу ${weight} кг)</label><input id="w-k" type="number" inputmode="numeric" value="${w ? w.kcal : ""}"></div>
      <div class="btns">${w ? '<button class="btn red" data-a="del">Удалить</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`,
    { onClose: () => res(done) })
    const est = () => {
      if (edited) return
      const met = (SPORTS.find(x => x[0] === sport) || SPORTS[SPORTS.length - 1])[1]
      $("#w-k", s.el).value = Math.round(met * weight * (+$("#w-m", s.el).value || 0) / 60)
    }
    const paint = () => $$("#w-s .chip", s.el).forEach(b => b.classList.toggle("on", b.dataset.s === sport))
    paint(); est()
    $$("#w-s .chip", s.el).forEach(b => b.onclick = () => { sport = b.dataset.s; edited = false; paint(); est() })
    $("#w-m", s.el).oninput = est
    $("#w-k", s.el).oninput = () => { edited = true }
    $('[data-a="no"]', s.el).onclick = () => s.close()
    if (w) $('[data-a="del"]', s.el).onclick = () => { remove("workouts", w.id); done = true; s.close(); render() }
    $('[data-a="ok"]', s.el).onclick = () => {
      const minutes = Math.round(+$("#w-m", s.el).value), kcal = Math.round(+$("#w-k", s.el).value)
      if (!(minutes > 0)) { toast("Укажите минуты"); return }
      const now = Date.now()
      upsert("workouts", Object.assign({}, w || { id: `t${now}-${Math.random().toString(36).slice(2, 6)}`, date: now }, { title: `${sport} ${minutes} мин`, minutes, kcal }))
      done = true; s.close(); render()
    }
  })
}

const RDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]
const repeatOf = recur => recur ? (recur.freq === "daily" ? { freq: "daily" } : { freq: "weekly", days: (recur.days || []).map(d => RDAY[d]) }) : undefined
async function reminderForm() {
  const s = sheet(`<h3>⏰ Новое напоминание</h3>
    <div class="field"><input id="r-t" placeholder="Что сделать?"></div>
    <div class="field"><label>Когда (можно пусто)</label><input id="r-w" placeholder="завтра в 9, в пятницу в 18:30, каждый день в 8"></div>
    <div class="btns"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  setTimeout(() => $("#r-t", s.el).focus(), 250)
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#r-t", s.el).value.trim()
    if (!title) { toast("Напишите, что напомнить"); return }
    const wtext = $("#r-w", s.el).value.trim()
    const x = { title }
    if (wtext) {
      const w = core.parseWhen(" " + core.normalizeSpeech(wtext) + " ")
      if (!w.date) { toast("Не понял, когда. Например: «завтра в 9»"); return }
      x.due = iso(w.date)
      if (w.recur) x.repeat = repeatOf(w.recur)
    }
    remAdd(x)
    s.close(); render(); toast("⏰ Напоминание сохранено")
  }
}
async function eventForm() {
  const t = await ui.ask("📅 Событие", "Название и время одной фразой: «завтра в 15 стоматолог», «в субботу с 12 до 14 обед с родителями»", "", { ok: "Дальше" })
  if (!t) return
  const a = core.buildActions([{ text: core.normalizeSpeech(t), kind: "event" }])[0] || {}
  let date = a.date ? new Date(a.date) : null
  if (!date || !a.hasTime) {
    const w = await ui.ask(`📅 ${a.title || t}`, "Когда? Например: «завтра в 15:00», «в пятницу с 19 до 21»")
    if (!w) return
    const p = core.parseWhen(" " + core.normalizeSpeech(w) + " ", date ? sod(date) : null)
    if (!p.date) return ui.info("Не понял время", w)
    date = p.date; a.minutes = p.minutes || a.minutes; a.recur = p.recur || a.recur
  }
  const end = new Date(+date + (a.minutes || core.CONFIG.defaultEventMinutes || 60) * 60000)
  const title = core.cap(a.title || t)
  const b = await ui.confirm("Добавить в календарь?", `<div class="cmd-list">📅 ${esc(title)}\n${esc(core.cap(fullDate(date)))}, ${hm(date)}–${hm(end)}${a.recur ? "\n🔁 " + esc(core.recurLabel(a.recur)) : ""}${a.calendar ? "\n" + esc(a.calendar) : ""}</div>`, ["Отмена", "Добавить"])
  if (b !== "Добавить") return
  const ev = { title, start: iso(date), end: iso(end), repeat: repeatOf(a.recur), calendar: a.calendar || undefined }
  if (gcalOn()) {
    const r = await calDo("create", ev)
    if (r.error) return ui.info("Не получилось", r.error)
    return toast("📅 Добавлено в Google Календарь")
  }
  queueOp("create_event", ev)
  render(); toast("📅 Внесётся в календарь iPhone при обновлении виджета")
}
async function eventSheet(e) {
  const when = e.all_day ? "весь день" : `${hm(e.s)}–${hm(e.e)}`
  const b = await ui.confirm(e.title || "(без названия)", `<div class="msg">${esc(core.cap(fullDate(e.s)))}, ${when}${e.location ? "\n📍 " + esc(e.location) : ""}${e.calendar ? "\n" + esc(e.calendar) : ""}${e.repeats ? "\n🔁 повторяется" : ""}${e.pending ? "\n⏳ ещё не внесено в iPhone" : ""}</div>`,
    e.pending ? ["Отменить"] : ["Удалить", "Перенести"])
  if (b === "Отменить") { cancelOp(e.id.slice(3)); render(); return }
  if (b === "Перенести") {
    const t = await ui.ask(`Куда перенести «${e.title}»?`, `Сейчас: ${shortDate(e.s)}, ${hm(e.s)}. Например: «на 20:00», «на пятницу в 15», «на час позже»`)
    if (!t) return
    const m = core.buildMove("перенеси x на " + t.replace(/^на\s+/i, ""))
    let ns
    if (m.shift) ns = new Date(+e.s + m.shift * 60000)
    else if (m.toDay || m.toTime) {
      ns = new Date(m.toDay || sod(e.s))
      const [hh, mm] = m.toTime ? m.toTime.split(":").map(Number) : [e.s.getHours(), e.s.getMinutes()]
      ns.setHours(hh, mm, 0, 0)
    }
    if (!ns) return ui.info("Не понял, куда перенести", t)
    if (gcalOn()) {
      const r = await calDo("update", { id: e.id, occurrence_start: e.start, start: iso(ns), end: iso(new Date(+ns + (e.e - e.s))) })
      toast(r.error ? `Не получилось: ${r.error}` : `↔️ ${shortDate(ns)}, ${hm(ns)}`); return
    }
    queueOp("update_event", { id: e.id, occurrence_start: e.start, start: iso(ns), end: iso(new Date(+ns + (e.e - e.s))) })
    render(); toast(`↔️ ${shortDate(ns)}, ${hm(ns)} — внесётся при обновлении виджета`)
  }
  if (b === "Удалить") {
    let all = false
    if (e.repeats) { const i = await ui.choose("Повторяющееся событие", "", ["Только это", "Это и все следующие"]); if (i < 0) return; all = i === 1 }
    if (gcalOn()) {
      toast("🗑 Удаляю…")
      const r = await calDo("delete", { id: e.id, occurrence_start: e.start, all_future: all })
      toast(r.error ? `Не получилось: ${r.error}` : all ? "🗑 Удалено это и все следующие" : "🗑 Удалено"); return
    }
    queueOp("delete_event", { id: e.id, occurrence_start: e.start, all_future: all })
    render(); toast("🗑 Удалится при обновлении виджета")
  }
}
async function addMenu() {
  const glass = H().glass || 250
  const opts = [["💬 Сказать помощнику", () => { setTab("chat"); setTimeout(micStart, 300) }], ["➖ Расход", () => moneyForm("expense")], ["➕ Доход", () => moneyForm("income")],
    ["📷 Фото: еда, счёт, чек", photoPrompt], ["🍽 Еда", foodMenu], [`💧 Стакан воды ${glass} мл`, () => addWater(glass)], ["🏃 Тренировка", () => workoutForm()],
    ["⏰ Напоминание", reminderForm], ["📅 Событие", eventForm]]
  const i = await ui.choose("Добавить", "", opts.map(o => o[0]))
  if (i >= 0) opts[i][1]()
}

// ───────────── Экраны ─────────────
let tab = "today", selDay = sod(new Date()), monthKey = null, hiddenAt = 0
function setTab(t) {
  tab = t
  $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === t))
  document.body.classList.toggle("chat", t === "chat")
  render()
  if (t === "chat") setTimeout(() => scrollView(true), 30)
  else scrollView(false)
}
// Перерисовка: если ничего не поменялось — экран не трогаем (иначе при каждом обмене с таблицей он «моргает»);
// плавное появление карточек — только при смене вкладки
let lastHTML = "", lastTab = ""
function render() {
  const fn = { today: renderToday, chat: renderChatHTML, money: renderMoney, health: renderHealth, more: renderMore }[tab]
  const html = fn(), v = $("#view")
  if (html === lastHTML && tab === lastTab && v.firstChild) { renderTop(); return }
  const strip = $("#strip", v), keep = strip && tab === lastTab ? strip.scrollLeft : null
  v.classList.toggle("anim", tab !== lastTab)
  lastHTML = html; lastTab = tab
  v.innerHTML = html
  bind()
  stripInit(keep)
  renderTop()
}
const TITLES = { chat: "Помощник", money: "Деньги", health: "Здоровье", more: "Ещё" }
function renderTop() {
  const v = iphone()
  if (tab === "today") { const d = new Date(); $("#top-title").innerHTML = `${esc(core.cap(WDF[d.getDay()]))}<span class="dt">${d.getDate()} ${MONTHS_GEN[d.getMonth()]}</span>` }
  else $("#top-title").textContent = TITLES[tab]
  let sub = ""
  if (!D.conn) sub = "Не подключено к виджету"
  else if (D.sync.error) sub = `⚠️ ${D.sync.error}`
  else if (tab === "money") { const t = core.monthTotals(live(D.money), monthKey || core.monthKey(new Date())); sub = `${core.monthTitle(monthKey || core.monthKey(new Date()))} · −${core.money(t.expense)}` }
  else {
    const p = gcalOn() ? 0 : pendingOps().length
    sub = gcalOn() ? `Обновлено ${ago(D.sync.at)}` : `iPhone: ${v.at ? ago(v.at) : "ждём виджет"}` + (p ? ` · ⏳ ${p} в очереди` : "")
  }
  $("#top-sub").textContent = sub
}

const WDF = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"]
const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"]
function renderToday() {
  const now = new Date(), t0 = sod(now), v = iphone()
  const isToday = sameDay(selDay, t0)
  const counts = {}
  let html = ""
  if (!D.conn) html += `<div class="banner"><b>Подключите приложение к виджету</b>Нажмите «Подключить»: откроется Scriptable, сам скопирует код, а вы вернётесь сюда кнопкой «◀ IZIDAY» слева вверху и нажмёте «Вставить».<div class="btns" style="margin-top:8px"><button class="btn" data-do="connect">Ввести код</button><button class="btn primary" data-do="autoconnect">🔗 Подключить</button></div></div>`
  else if (!gcalOn() && D.snap && pendingOps().length) html += `<div class="banner"><b>📲 ${pendingOps().length} ${plural(pendingOps().length, "изменение ждёт", "изменения ждут", "изменений ждут")} внесения в iPhone</b>Календарь и напоминания iPhone меняет только Scriptable. Нажмите — он внесёт сейчас и вернёт вас сюда.<div class="btns" style="margin-top:8px"><button class="btn primary" data-do="run-widget">Внести сейчас</button></div></div>`
  else if (!gcalOn() && D.gcal && D.gcal.error) html += `<div class="banner"><b>Google Календарь не ответил</b>${esc(D.gcal.error)}</div>`
  // Дни — лентой-каруселью: листаются пальцем, 7 видно сразу; лента ±10 недель вокруг выбранной недели
  const wOff = Math.floor(Math.round((sod(selDay) - t0) / 864e5) / 7), w0 = addDays(t0, wOff * 7)
  const wc = stripCenter || w0, s0 = addDays(wc, -70), s1 = addDays(wc, 77)
  for (const e of v.events) for (let d = sod(e.s); d < e.e && d < s1; d = addDays(d, 1)) if (d >= s0) counts[dayKey(d)] = (counts[dayKey(d)] || 0) + 1
  html += `<div class="month wnav"><b id="wk-lbl">${esc(weekLabel(w0))}</b><button class="today-btn" data-do="go-today" ${wOff === 0 && isToday ? "hidden" : ""}>Сегодня</button></div>`
  html += `<div class="week strip" id="strip" data-start="${+s0}" data-sel="${+wc}">${[...Array(147)].map((_, i) => {
    const d = addDays(s0, i), n = counts[dayKey(d)] || 0
    return `<button class="day ${sameDay(d, selDay) ? "on" : ""} ${sameDay(d, t0) ? "td" : ""} ${d.getDay() % 6 === 0 ? "we" : ""}" data-day="${+d}">
      <div class="wd">${WD[d.getDay()]}</div><div class="dn">${d.getDate()}</div><div class="n">${n ? n + " соб." : "—"}</div></button>`
  }).join("")}</div>`
  const onDay = d => v.events.filter(e => e.s < addDays(d, 1) && e.e > d).sort((a, b) => (b.all_day ? 1 : 0) - (a.all_day ? 1 : 0) || a.s - b.s)
  const dayEvs = onDay(selDay)
  const nSel = dayEvs.length
  html += `<div class="card daycard"><div class="dayhead"><div><div class="dh-t">${isToday ? "Сегодня" : esc(core.cap(dayName(selDay)))}, ${selDay.getDate()} ${MONTHS_GEN[selDay.getMonth()]}</div>
    <div class="dh-n">${nSel ? `${nSel} ${plural(nSel, "событие", "события", "событий")}` : "Нет событий"}</div></div><button class="act" data-do="event">+ Событие</button></div>`
  html += dayEvs.length ? dayEvs.map((e, i) => {
    const t = e.all_day ? "весь день" : e.s < selDay ? "до " + hm(e.e) : hm(e.s)
    const past = isToday && !e.all_day && e.e <= now
    return `<div class="row ${e.pending ? "pending" : ""} ${past ? "past" : ""}" data-ev="${i}"><div class="bar-l" style="background:${esc(e.color || "var(--teal)")}"></div>
      <div class="time" style="${e.all_day ? "font-size:11.5px" : ""}">${t}</div>
      <div class="grow"><div class="t">${esc(e.title || "(без названия)")}</div><div class="s">${e.all_day ? "" : hm(e.s) + "–" + hm(e.e)}${e.location ? " · " + esc(e.location) : ""}${e.calendar ? " · " + esc(e.calendar) : ""}</div></div></div>`
  }).join("") : `<div class="empty">${gcalOn() || D.snap ? "Ничего не запланировано" : "Загружаю Google Календарь…"}</div>`
  html += `</div>`
  dayEvsCache = dayEvs


  const isPast = selDay < t0
  if (isPast) return html + (habitList().length ? habitsCard(selDay) : "") + dayRecap(selDay)
  let rems = openRems(v)
  if (isToday) rems = rems.filter(r => !remDue(r) || remDue(r) < addDays(t0, 1))
  else rems = rems.filter(r => remDue(r) && sameDay(remDue(r), selDay))
  rems.sort((a, b) => (!remDue(a)) - (!remDue(b)) || (remDue(a) || 0) - (remDue(b) || 0))
  html += `<div class="card"><h2>Напоминания<button class="act" data-do="reminder">+ Добавить</button></h2>`
  html += rems.length ? rems.slice(0, 25).map(r => `<div class="row ${r.pending ? "pending" : ""}"><button class="check ${remLate(r) ? "late" : ""}" data-check="${esc(r.id)}"></button>
    <div class="grow"><div class="t">${esc(r.title)}</div>${r.due || r.list ? `<div class="s ${remLate(r) ? "exp" : ""}">${esc(remLabel(r))}${r.due && r.list ? " · " : ""}${esc(r.list || "")}</div>` : ""}</div></div>`).join("")
    : `<div class="empty">${isToday ? "Всё сделано" : "На этот день напоминаний нет"}</div>`
  const bills = isToday ? recurSoon() : []
  if (bills.length) html += bills.map(r => `<div class="row" data-recur="${esc(r.id)}"><span class="pin">🔁</span><div class="grow"><div class="t">${esc(r.title)} · ${esc(core.money(r.amount))}</div>
    <div class="s ${recurDue(r) < sod(now) ? "exp" : ""}">оплатить ${esc(recurLabel(r))}</div></div><button class="btn small" data-recur-pay="${esc(r.id)}">Оплачено</button></div>`).join("")
  const near = live(D.places).filter(p => !p.done)
  if (isToday && near.length) html += near.map(p => `<div class="row"><span class="pin">📍</span><div class="grow"><div class="t">${esc(p.title)}</div>
    <div class="s">напомню рядом: ${esc(p.query)} · ${(p.points || []).length} ${plural((p.points || []).length, "точка", "точки", "точек")}</div></div></div>`).join("")
  html += `</div>`

  if (isToday) html += habitsCard(selDay)
  if (isToday) {
    const h = dayHealth(), g = H()
    const t = core.monthTotals(live(D.money), core.monthKey(t0))
    const spent = live(D.money).filter(e => e.type === "expense" && sameDay(e.date, t0)).reduce((s, e) => s + e.amount, 0)
    const mini = (p, color, icon) => { const r = 23, c = 2 * Math.PI * r
      return `<span class="mr"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" class="mr-t"/><circle cx="28" cy="28" r="${r}" stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, p || 0)))}"/></svg><i>${icon}</i></span>` }
    html += `<div class="card"><h2>За день</h2><div class="stats">
      <button class="stat" data-do="water">${mini(h.water / g.waterGoal, "var(--teal)", "💧")}<div class="v">${liters(h.water)} л</div><div class="l">${waterGap(h) ? `<span class="exp">${waterGap(h)} ч без воды</span>` : `из ${liters(g.waterGoal)}`} · +стакан</div></button>
      <button class="stat" data-do="tab-health">${mini(h.kcal / (g.kcalGoal || 2000), "var(--gold)", "🍽")}<div class="v">${num(h.kcal)}</div><div class="l">ккал${h.active ? ` · −${num(h.active)}` : ""}</div></button>
      <button class="stat" data-do="tab-money">${mini(t.expense ? spent / Math.max(spent, t.expense / Math.max(1, t0.getDate())) : 0, "var(--red)", "฿")}<div class="v">−${num(spent)}</div><div class="l">сегодня · −${num(t.expense)} за мес.</div></button>
    </div></div>`
  }
  const failed = D.ops.filter(o => o.state === "done" && o.result && o.result.error)
  if (failed.length && !gcalOn()) html += `<div class="card"><h2>Не внеслось в iPhone</h2>${failed.map(o => `<div class="row"><div class="grow"><div class="t">${esc(OP_LABEL[o.tool] || o.tool)}: ${esc((o.input || {}).title || "")}</div><div class="s exp">${esc(o.result.error)}</div></div></div>`).join("")}</div>`
  return html
}
let dayEvsCache = []
function weekLabel(w0) {
  const w6 = addDays(w0, 6), t = sod(new Date()), off = Math.round((w0 - addDays(t, 0)) / 864e5)
  if (off <= 0 && off > -7) return "Эта неделя"
  if (off >= 7 && off < 14) return "Следующая неделя"
  if (off <= -7 && off > -14) return "Прошлая неделя"
  return w0.getMonth() === w6.getMonth() ? `${w0.getDate()}–${w6.getDate()} ${MONTHS_GEN[w0.getMonth()]}` : `${w0.getDate()} ${MONTHS_GEN[w0.getMonth()].slice(0, 3)} – ${w6.getDate()} ${MONTHS_GEN[w6.getMonth()].slice(0, 3)}`
}
// Лента дней: после перерисовки — на неделю выбранного дня (или туда, где пальцем оставили); подпись — по видимой неделе
let stripCenter = null, stripJump = false
function stripInit(keep) {
  const s = $("#strip")
  if (!s) return
  const col = s.children[1] ? s.children[1].offsetLeft - s.children[0].offsetLeft : 0
  if (!col) return
  const start = +s.dataset.start, idx = Math.round((+s.dataset.sel - start) / 864e5)
  s.scrollLeft = keep != null && !stripJump ? keep : idx * col
  stripJump = false
  let t = null, touched = false   // перестраивать ленту только после пальца, не от прокрутки кодом
  s.addEventListener("pointerdown", () => { touched = true }, { passive: true })
  s.addEventListener("touchstart", () => { touched = true }, { passive: true })
  s.onscroll = () => {
    if (!touched) return
    clearTimeout(t)
    t = setTimeout(() => {
      const first = addDays(new Date(start), Math.round(s.scrollLeft / col))
      const lbl = $("#wk-lbl"); if (lbl) lbl.textContent = weekLabel(first)
      const tb = $(".today-btn"); if (tb) tb.hidden = sameDay(selDay, new Date()) && Math.abs(Math.round((first - sod(new Date())) / 864e5)) < 4
      // докрутили до края ленты — перестроить ленту вокруг видимой недели
      if (s.scrollLeft < col * 7 || s.scrollLeft > s.scrollWidth - s.clientWidth - col * 7) { stripCenter = first; stripJump = true; render() }
    }, 120)
  }
}

function renderChatHTML() {
  return `<div class="chat-tools"><button data-brief="morning">☀️ Утренняя сводка</button><button data-brief="evening">🌙 Вечерняя</button><button data-do="memory">🧠 Память</button><button data-do="chat-clear">🧹 Очистить</button></div>
    <div class="chat-list" id="chat-list">${chatItems()}</div>
    <div class="chat-bar"><button class="cam" aria-label="Фото или файл">${ICO.cam}</button><textarea id="chat-in" rows="1" placeholder="Напишите или скажите…" enterkeyhint="send"></textarea>
    <button class="mic" aria-label="Сказать">${ICO.mic}</button><button class="send" aria-label="Отправить">${ICO.send}</button></div>`
}
const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`)
function chatItems() {
  if (!D.chat.length) return `<div class="empty" style="text-align:center;padding:30px 10px">Я ваш помощник: встречи, напоминания, деньги, еда — и просто поговорить.<br><br>Нажмите 🎤 и скажите, например: «завтра в 10 встреча с Олей», «потратил 300 на такси наличными», «что у меня на неделе?»</div>`
  const last = D.chat.length - 1
  return D.chat.slice(-60).map((m, i, arr) => {
    const isLast = i === arr.length - 1 && askWait
    const gi = D.chat.length - arr.length + i
    const edit = m.role === "user" && !m.local && !m.thumb && !m.prompt && i >= arr.length - 6 ? `<button class="ed" data-edit="${gi}" aria-label="Изменить">✎</button>` : ""
    return `<div class="m ${m.role}">${edit}${m.thumb ? `<img class="att" src="${esc(m.thumb)}" alt="">` : ""}${m.voice ? "🎤 " : ""}${linkify(m.text)}${(m.links || []).length ? `<div class="links">${m.links.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">🔗 Сессия Claude Code</a>`).join("")}</div>` : ""}` +
      `${m.opts && m.opts.length && isLast ? `<div class="opts">${m.opts.map(o => `<button data-opt="${esc(o)}">${esc(o)}</button>`).join("")}</div>` : ""}<span class="tm">${hm(new Date(m.at || Date.now()))}</span></div>`
  }).join("") + (chatBusy && !askWait ? `<div class="typing"><i></i><i></i><i></i>${chatStatus ? `<span class="st">${esc(chatStatus)}</span>` : ""}</div>` : "") + (last < 0 ? "" : "")
}
function renderChat() {
  const list = $("#chat-list")
  if (!list) return
  list.innerHTML = chatItems()
  bindChatList()
  scrollView(true)
}
function bindChatList() {
  $$("[data-opt]").forEach(b => b.onclick = () => { b.classList.add("on"); chatSend(b.dataset.opt) })
  $$("[data-edit]").forEach(b => b.onclick = e => { e.stopPropagation(); chatEdit(+b.dataset.edit) })
}

function renderMoney() {
  const now = new Date()
  monthKey = monthKey || core.monthKey(now)
  const t = core.monthTotals(live(D.money), monthKey)
  const bal = t.income - t.expense
  let html = `<div class="month"><button data-mon="-1">‹</button><b>${esc(core.monthTitle(monthKey))}</b><button data-mon="1" ${monthKey >= core.monthKey(now) ? "disabled style=opacity:.3" : ""}>›</button></div>
    <div class="card"><div class="totals">
      <div><div class="muted small">Расходы</div><div class="big exp">−${esc(core.money(t.expense))}</div></div>
      <div><div class="muted small">Доходы</div><div class="big inc">+${esc(core.money(t.income))}</div></div>
      <div class="muted small">💵 −${num(t.cash.expense)} · 💳 −${num(t.transfer.expense)}</div>
      <div class="muted small">Баланс ${bal < 0 ? "−" : "+"}${esc(core.money(bal))}</div>
    </div><div class="btns" style="margin-top:12px"><button class="btn primary" data-do="expense">− Расход</button><button class="btn teal" data-do="income">+ Доход</button></div></div>`
  const cats = Object.entries(t.cats.expense)
  for (const b of live(D.budgets)) if (b.limit > 0 && !cats.some(c => c[0] === b.category)) cats.push([b.category, 0])
  cats.sort((a, b) => b[1] - a[1])
  const top = Math.max(1, ...cats.map(c => c[1]))
  html += `<div class="card"><h2>Куда ушли деньги<button class="act" data-do="budgets">Лимиты</button></h2>` + (cats.length ? cats.map(([n, v]) => {
      const lim = budgetOf(n), p = lim ? v / lim : v / top
      return `<div class="cat"><div class="top"><span>${esc(n)}</span><b>${esc(core.money(v))}${lim ? `<span class="muted small"> из ${num(lim)}</span>` : ""}</b></div>
      <div class="prog ${lim && p > 1 ? "red" : lim && p >= 0.8 ? "warn" : "gold"}"><div style="width:${Math.min(1, p) * 100}%"></div></div>${lim && p > 1 ? `<div class="s exp small">превышено на ${esc(core.money(v - lim))}</div>` : ""}</div>`
    }).join("") : `<div class="empty">Расходов пока нет. «Лимиты» — сколько готовы тратить в месяц по категориям.</div>`) + `</div>`
  const rec = live(D.recur).sort((a, b) => (a.day || 0) - (b.day || 0)), rk = monthKey
  html += `<div class="card"><h2>Регулярные платежи<button class="act" data-do="recur-add">+ Добавить</button></h2>` + (rec.length ? rec.map(r => {
      const paid = recurPaid(r, rk), late = !paid && rk === core.monthKey(now) && recurDue(r) < sod(now)
      return `<div class="row" data-recur="${esc(r.id)}"><div class="grow"><div class="t">${esc(r.title)}</div><div class="s ${late ? "exp" : ""}">${r.day} числа · ${rk === core.monthKey(now) ? esc(recurLabel(r)) : paid ? "✓ оплачено" : "не оплачено"}</div></div>
        <div class="amt ${paid ? "inc" : ""}">${paid ? "✓ " : ""}${esc(core.money(r.amount))}</div></div>`
    }).join("") + `<div class="muted small" style="margin-top:6px">В месяц: ${esc(core.money(rec.filter(r => r.type !== "income").reduce((s, r) => s + r.amount, 0)))}</div>`
    : `<div class="empty">Аренда, интернет, подписки: в срок появятся в «Сегодня», оплата записывается в расходы одним нажатием.</div>`) + `</div>`
  const items = t.items.slice().reverse()
  html += `<div class="card"><h2>Операции<span class="muted small" style="text-transform:none;letter-spacing:0">${items.length}</span></h2>`
  if (!items.length) html += `<div class="empty">Скажите помощнику «потратил 300 на такси» или нажмите «− Расход»</div>`
  let last = ""
  for (const e of items) {
    const d = new Date(e.date), k = dayKey(d)
    if (k !== last) { html += `<div class="day-h">${esc(core.cap(dayName(d)))}</div>`; last = k }
    html += `<div class="row" data-money="${esc(e.id)}"><div class="grow"><div class="t">${esc(e.category)}</div>
      <div class="s">${e.method === "cash" ? "💵 нал" : "💳 перевод"}${e.comment ? " · " + esc(e.comment) : ""}</div></div>
      <div class="amt ${e.type === "expense" ? "exp" : "inc"}">${e.type === "expense" ? "−" : "+"}${esc(core.money(e.amount))}</div></div>`
  }
  html += `</div><div class="btns"><button class="btn" data-report="month">📊 Отчёт</button>${D.conn && D.conn.sheetUrl ? '<button class="btn" data-do="sheet">▦ Таблица</button>' : ""}</div>`
  return html
}

function ring(p, color, label, sub) {
  const r = 40, c = 2 * Math.PI * r
  return `<div class="ring"><svg viewBox="0 0 92 92" width="92" height="92"><circle cx="46" cy="46" r="${r}" fill="none" stroke="var(--track)" stroke-width="9"/>
    <circle cx="46" cy="46" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, p || 0))}"/></svg>
    <div class="c"><b>${label}</b><span>${sub}</span></div></div>`
}
function healthDay() { const t0 = sod(new Date()); return selDay > t0 ? t0 : sod(selDay) }
function dayNav(d, attr) {
  const isT = sameDay(d, new Date())
  return `<div class="month"><button data-${attr}="-1" aria-label="День назад">‹</button><b>${isT ? "Сегодня" : esc(core.cap(dayName(d)))}</b><button data-${attr}="1" ${isT ? "disabled style=opacity:.3" : ""} aria-label="День вперёд">›</button></div>`
}
// Итоги прошедшего дня: вода, еда, тренировки, шаги, расходы — для «Сегодня» на прошлой дате
function dayRecap(d) {
  const h = dayHealth(d), g = H()
  const money = onDay(D.money, d), spent = money.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0)
  const inc = money.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0)
  let html = `<div class="card"><h2>Итоги дня</h2><div class="stats">
    <button class="stat" data-do="tab-health"><div class="v">${liters(h.water)} л</div><div class="l">вода из ${liters(g.waterGoal)}</div></button>
    <button class="stat" data-do="tab-health"><div class="v">${num(h.kcal)}</div><div class="l">ккал съедено</div></button>
    <button class="stat" data-do="tab-money"><div class="v">−${num(spent)}</div><div class="l">расходы${inc ? ` · +${num(inc)}` : ""}</div></button></div>
    <div class="watch" style="margin-top:12px"><div><b>${h.steps != null ? num(h.steps) : "—"}</b><span>шагов</span></div><div><b>${num(h.active)}</b><span>актив. ккал</span></div><div><b>${num(h.exercise)}</b><span>мин упражнений</span></div></div>
    ${h.watch || h.workouts.length ? "" : `<div class="muted small" style="margin-top:8px">Данных с часов за этот день нет: виджет хранит их ${D.snap && (D.snap.health || []).length ? "за последние " + D.snap.health.length + " дн." : "только с момента подключения"}.</div>`}</div>`
  if (h.workouts.length) html += `<div class="card"><h2>Тренировки и прогулки</h2>${h.workouts.map(w => `<div class="row" data-wk="${esc(w.id)}"><div class="time">${hm(new Date(w.date))}</div><div class="grow"><div class="t">${esc(w.title)}</div><div class="s">${w.minutes} мин</div></div><div class="amt">−${num(w.kcal)}</div></div>`).join("")}</div>`
  if (h.food.length) html += `<div class="card"><h2>Еда<span class="muted small" style="text-transform:none;letter-spacing:0">Б ${num(h.protein)} · Ж ${num(h.fat)} · У ${num(h.carbs)}</span></h2>${h.food.map(f => `<div class="row" data-food="${esc(f.id)}"><div class="time">${hm(new Date(f.date))}</div><div class="grow"><div class="t">${esc(f.title || "Еда")}</div></div><div class="amt">${num(f.kcal)}</div></div>`).join("")}</div>`
  if (money.length) html += `<div class="card"><h2>Расходы и доходы</h2>${money.map(e => `<div class="row" data-money="${esc(e.id)}"><div class="time">${hm(new Date(e.date))}</div><div class="grow"><div class="t">${esc(e.category)}</div><div class="s">${e.method === "cash" ? "💵 нал" : "💳 перевод"}${e.comment ? " · " + esc(e.comment) : ""}</div></div><div class="amt ${e.type === "expense" ? "exp" : "inc"}">${e.type === "expense" ? "−" : "+"}${esc(core.money(e.amount))}</div></div>`).join("")}</div>`
  if (!h.workouts.length && !h.food.length && !money.length && !h.water) html += `<div class="card"><div class="empty">За этот день ничего не записано</div></div>`
  return html + `<div class="btns"><button class="btn" data-report="week">📊 Отчёт за неделю</button><button class="btn" data-report="month">За месяц</button><button class="btn" data-report="year">За год</button></div>`
}

function renderHealth() {
  const day = healthDay(), g = H(), h = dayHealth(day), t0 = day, isT = h.isToday
  let html = dayNav(day, "hday") + `<div class="card"><h2>${isT ? "Активность" : "Активность за день"}${h.watch ? `<span class="muted small" style="text-transform:none;letter-spacing:0">часы: ${ago(h.watch.updated)}</span>` : ""}</h2>
    <div class="watch"><div><b>${h.steps != null ? num(h.steps) : "—"}</b><span>шагов</span></div><div><b>${num(h.active)}</b><span>актив. ккал из ${num(g.moveGoal)}</span></div>
    <div><b>${num(h.exercise)}</b><span>мин упражнений</span></div></div>
    ${!h.watch ? `<div class="muted small" style="margin-top:8px">${isT ? "Данные часов приходят через виджет после Быстрой команды «Мой день - здоровье»." : "Данных с часов за этот день нет."}</div>` : ""}
    ${isT ? `<div class="btns" style="margin-top:10px"><button class="btn small" data-do="workout">+ Тренировка без часов</button></div>` : ""}
    ${h.workouts.map(w => `<div class="row" data-wk="${esc(w.id)}"><div class="time">${hm(new Date(w.date))}</div><div class="grow"><div class="t">${esc(w.title)}</div><div class="s">${w.minutes} мин</div></div><div class="amt">−${num(w.kcal)}</div></div>`).join("")}</div>`
  html += `<div class="card"><h2>Вода</h2><div class="ring-row">${ring(h.water / g.waterGoal, "var(--teal)", liters(h.water) + " л", "из " + liters(g.waterGoal))}
    ${isT ? `<div style="flex:1"><div class="btns"><button class="btn teal" data-water="${g.glass}">+ Стакан ${g.glass} мл</button></div>
    <div class="btns" style="margin-top:8px"><button class="btn small" data-water="500">+500</button><button class="btn small" data-water="other">Другое</button><button class="btn small" data-water="undo">Отменить</button></div></div>`
    : `<div style="flex:1" class="small muted">${h.waterList.length ? h.waterList.map(w => `${hm(new Date(w.date))} · ${w.ml} мл`).join("<br>") : "Воду не записывали"}</div>`}</div></div>`
  const kGoal = g.kcalGoal || 2000
  html += `<div class="card"><h2>Еда${isT ? `<button class="act" data-do="food">+ Добавить</button>` : ""}</h2><div class="ring-row">
    ${ring(h.kcal / kGoal, h.kcal > kGoal ? "var(--red)" : "var(--gold)", num(h.kcal), "ккал")}
    <div style="flex:1" class="small muted">Белки <b style="color:var(--text)">${num(h.protein)} г</b> · жиры <b style="color:var(--text)">${num(h.fat)} г</b> · углеводы <b style="color:var(--text)">${num(h.carbs)} г</b>
    ${isT ? `<div class="btns" style="margin-top:10px"><button class="btn gold small" data-do="photo">📷 По фото</button></div>` : ""}</div></div>`
  html += h.food.map(f => `<div class="row" data-food="${esc(f.id)}"><div class="time">${hm(new Date(f.date))}</div><div class="grow"><div class="t">${esc(f.title || "Еда")}</div>${f.protein || f.fat || f.carbs ? `<div class="s">Б ${num(f.protein)} · Ж ${num(f.fat)} · У ${num(f.carbs)}</div>` : ""}</div><div class="amt">${num(f.kcal)}</div></div>`).join("")
  html += `</div>`
  const days = [...Array(7)].map((_, i) => addDays(t0, i - 6))
  const kc = days.map(d => live(D.food).filter(f => sameDay(f.date, d)).reduce((s, f) => s + (f.kcal || 0), 0))
  const wa = days.map(d => live(D.water).filter(w => sameDay(w.date, d)).reduce((s, w) => s + (w.ml || 0), 0))
  const mk = Math.max(1, ...kc), mw = Math.max(1, ...wa)
  html += weightCard()
  html += `<div class="card"><h2>Неделя: калории</h2><div class="chart">${days.map((d, i) => `<div class="col"><div class="lbl">${kc[i] ? num(kc[i]) : ""}</div><div class="b" style="height:${kc[i] / mk * 100}%"></div><div class="lbl">${WD[d.getDay()]}</div></div>`).join("")}</div></div>`
  html += `<div class="card"><h2>Неделя: вода</h2><div class="chart">${days.map((d, i) => `<div class="col"><div class="lbl">${wa[i] ? liters(wa[i]) : ""}</div><div class="b w" style="height:${wa[i] / mw * 100}%"></div><div class="lbl">${WD[d.getDay()]}</div></div>`).join("")}</div></div>`
  const money = onDay(D.money, day), spent = money.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0)
  if (!isT) html += `<div class="card"><h2>Расходы за день<span class="muted small" style="text-transform:none;letter-spacing:0">−${esc(core.money(spent))}</span></h2>${money.length ? money.map(e => `<div class="row" data-money="${esc(e.id)}"><div class="time">${hm(new Date(e.date))}</div><div class="grow"><div class="t">${esc(e.category)}</div>${e.comment ? `<div class="s">${esc(e.comment)}</div>` : ""}</div><div class="amt ${e.type === "expense" ? "exp" : "inc"}">${e.type === "expense" ? "−" : "+"}${esc(core.money(e.amount))}</div></div>`).join("") : `<div class="empty">Расходов не было</div>`}</div>`
  html += `<div class="btns"><button class="btn" data-report="week">📊 Отчёт за неделю</button><button class="btn" data-report="month">За месяц</button><button class="btn" data-report="year">За год</button></div>`
  return html
}

const standalone = () => window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches
function renderMore() {
  const c = D.conn
  let html = ""
  if (!standalone()) html += `<div class="banner"><b>Поставьте на экран «Домой»</b>Нажмите «Поделиться» ⎋ внизу Safari → «На экран «Домой»». Приложение будет открываться отдельно и мгновенно.</div>`
  html += `<div class="card"><h2>Связь с виджетом</h2>`
  if (c) html += `<div class="set"><span>Таблица</span><span class="ok">✓ ${esc((c.hook.match(/\/s\/(.{8})/) || [, "подключена"])[1])}</span></div>
      <div class="set"><span>Последний обмен</span><span>${esc(ago(D.sync.at))}</span></div>
      <div class="set"><span>Уведомления на iPhone</span><span>${D.snap && D.snap.notif ? `${D.snap.notif.mine} запланировано` : "виджет старой версии — обновите MyDay.js"}</span></div>
      <div class="set"><span>Google Календарь</span>${gcalOn() ? `<span class="ok">✓ ${esc(ago(D.gcal.at))}</span>` : `<span class="exp">${esc((D.gcal && D.gcal.error) || "загружается")}</span>`}</div>
      <div class="set"><span>Ключ Claude</span>${c.key ? '<span class="ok">✓ Есть</span>' : '<span class="exp">нет</span>'}</div>
      <div class="set"><span>Маршруты в Claude Code</span><span>${routes().length ? esc(routes().map(r => r.name).join(", ")) : "нет"}</span></div>
      ${D.sync.error ? `<div class="msg exp small">${esc(D.sync.error)}</div>` : ""}
      <div class="btns" style="margin-top:10px"><button class="btn" data-do="sync">🔄 Обменяться сейчас</button>${!gcalOn() && pendingOps().length ? '<button class="btn primary" data-do="run-widget">📲 Внести в iPhone сейчас</button>' : ""}</div>
      ${!gcalOn() && pendingOps().length ? `<div class="muted small" style="margin-top:8px">В очереди ${pendingOps().length}: ${esc(pendingOps().map(o => OP_LABEL[o.tool] || o.tool).join(", "))}. Виджет внесёт их сам при обновлении; кнопка «Внести сейчас» на секунду откроет Scriptable.</div>` : ""}`
  html += `<div class="btns" style="margin-top:10px"><button class="btn ${c ? "" : "primary"}" data-do="connect">${c ? "Подключить заново" : "🔗 Подключить"}</button>${c ? '<button class="btn red" data-do="disconnect">Отключить</button>' : ""}</div>
    <div class="muted small" style="margin-top:8px">Код подключения даёт виджет: в Scriptable меню → 📱 Приложение «Мой день». В нём ключ Claude и ключ таблицы — он хранится только на этом телефоне.</div></div>`
  const g = H()
  html += `<div class="card"><h2>Цели</h2>
    <div class="set"><span>Вода в день, мл</span><input type="number" data-set="waterGoal" value="${g.waterGoal}"></div>
    <div class="set"><span>Стакан, мл</span><input type="number" data-set="glass" value="${g.glass}"></div>
    <div class="set"><span>Калории в день, ккал</span><input type="number" data-set="kcalGoal" value="${g.kcalGoal || 2000}"></div>
    <div class="set"><span>Вес, кг (для тренировок)</span><input type="number" data-set="weight" value="${g.weight}"></div></div>`
  html += `<div class="card"><h2>Кнопки виджета</h2><div class="muted small">🎤 и 💬 открывают помощника, 📷 — еду по фото, ${esc(core.CONFIG.currency)} — расход, 💧 — стакан воды. Ссылки из виджета открываются в Safari — данные там те же, через таблицу.</div></div>`
  html += `<div class="muted small" style="text-align:center;margin:14px 0">Мой день · веб-приложение</div>`
  return html
}

// ── Отчёты за неделю, месяц и год: деньги, еда, вода, активность, тренировки ──
const monthStart = key => { const [y, m] = (key || core.monthKey(new Date())).split("-").map(Number); return new Date(y, m - 1, 1) }
const MON_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
function periodOf(kind, at) {
  const d = sod(at)
  if (kind === "week") { const from = addDays(d, -((d.getDay() + 6) % 7)), to = addDays(from, 7), l = addDays(to, -1)
    return { from, to, title: `${from.getDate()} ${MON_GEN[from.getMonth()]} – ${l.getDate()} ${MON_GEN[l.getMonth()]} ${l.getFullYear()}` } }
  if (kind === "year") return { from: new Date(d.getFullYear(), 0, 1), to: new Date(d.getFullYear() + 1, 0, 1), title: `${d.getFullYear()} год` }
  return { from: new Date(d.getFullYear(), d.getMonth(), 1), to: new Date(d.getFullYear(), d.getMonth() + 1, 1), title: core.monthTitle(core.monthKey(d)) }
}
function periodStats(kind, at) {
  const p = periodOf(kind, at), now = new Date(), end = p.to < now ? p.to : addDays(sod(now), 1)
  const inP = list => live(list).filter(e => e.date >= +p.from && e.date < +p.to).sort((a, b) => a.date - b.date)
  const money = inP(D.money), food = inP(D.food), water = inP(D.water), workouts = inP(D.workouts)
  const sum = (a, k) => a.reduce((s, x) => s + (+x[k] || 0), 0)
  const exp = money.filter(e => e.type === "expense"), inc = money.filter(e => e.type === "income")
  const cats = {}; for (const e of exp) cats[e.category] = (cats[e.category] || 0) + e.amount
  const days = []
  for (let d = new Date(p.from); d < end; d = addDays(d, 1)) {
    const k = dayKey(d), h = histHealth(d) || (sameDay(d, now) && iphone().watch) || null
    const f = food.filter(x => sameDay(x.date, d)), w = water.filter(x => sameDay(x.date, d)), wk = workouts.filter(x => sameDay(x.date, d))
    days.push({ d, k, kcal: sum(f, "kcal"), water: sum(w, "ml"), steps: h && h.steps != null ? h.steps : null, active: h && h.active || 0, workouts: wk,
      spent: sum(exp.filter(x => sameDay(x.date, d)), "amount"), income: sum(inc.filter(x => sameDay(x.date, d)), "amount") })
  }
  const avg = (k, cond) => { const a = days.filter(cond); return a.length ? a.reduce((s, x) => s + x[k], 0) / a.length : 0 }
  return { p, kind, money, exp: sum(exp, "amount"), inc: sum(inc, "amount"), cash: sum(exp.filter(e => e.method === "cash"), "amount"),
    cats: Object.entries(cats).sort((a, b) => b[1] - a[1]), days, workouts,
    kcalAvg: avg("kcal", x => x.kcal > 0), waterAvg: avg("water", x => x.water > 0), stepsAvg: avg("steps", x => x.steps != null),
    stepsDays: days.filter(x => x.steps != null).length, wkMin: sum(workouts, "minutes"), wkKcal: sum(workouts, "kcal") }
}
function periodReportHTML(st) {
  const m = n => esc(core.money(n)), g = H()
  const rows = st.kind === "year"
    ? [...Array(12)].map((_, i) => { const a = st.days.filter(x => x.d.getMonth() === i); if (!a.length) return ""
        const s = k => a.reduce((t, x) => t + x[k], 0), fd = a.filter(x => x.kcal), sd = a.filter(x => x.steps != null)
        return `<tr><td>${MON_SHORT[i]}</td><td>${fd.length ? num(s("kcal") / fd.length) : "—"}</td><td>${sd.length ? num(sd.reduce((t, x) => t + x.steps, 0) / sd.length) : "—"}</td><td>${a.reduce((t, x) => t + x.workouts.length, 0) || "—"}</td><td class="expense">${s("spent") ? "−" + num(s("spent")) : "—"}</td></tr>` }).join("")
    : st.days.map(x => `<tr><td>${WD[x.d.getDay()]} ${x.d.getDate()}</td><td>${x.kcal ? num(x.kcal) : "—"}</td><td>${x.water ? liters(x.water) : "—"}</td><td>${x.steps != null ? num(x.steps) : "—"}</td><td>${x.workouts.length ? x.workouts.map(w => `${esc(w.title)} ${w.minutes}′`).join(", ") : "—"}</td><td class="expense">${x.spent ? "−" + num(x.spent) : "—"}</td></tr>`).join("")
  const head = st.kind === "year" ? "<th>Месяц</th><th>ккал/день</th><th>шагов/день</th><th>трен.</th><th>расходы</th>" : "<th>День</th><th>ккал</th><th>вода, л</th><th>шаги</th><th>тренировки</th><th>расходы</th>"
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{--bg:#F2F2F7;--card:#fff;--text:#1C1C1E;--sub:#6B7280;--line:#E5E5EA;--exp:#FF453A;--inc:#0A9F6E;--track:#EEF0F5}
@media (prefers-color-scheme:dark){:root{--bg:#000;--card:#1C1C1E;--text:#F2F2F7;--sub:#9AA1AD;--line:#2C2C2E;--track:#2C2C2E;--inc:#30D158}}
body{margin:0;padding:16px 12px 40px;background:var(--bg);color:var(--text);font:15px -apple-system,system-ui;-webkit-text-size-adjust:100%}
h1{font-size:24px;margin:0}h2{font-size:13px;margin:22px 4px 8px;color:var(--sub);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.muted{color:var(--sub)}.small{font-size:12px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.card{background:var(--card);border-radius:14px;padding:10px 12px}.card b{display:block;font-size:16px;margin-top:3px;font-variant-numeric:tabular-nums}
.list{background:var(--card);border-radius:14px;padding:2px 14px}.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.row:last-child{border-bottom:0}
.track{height:6px;border-radius:3px;background:var(--track);overflow:hidden;margin-top:5px}.bar{height:100%;background:var(--exp);border-radius:3px}
table{width:100%;border-collapse:collapse;background:var(--card);border-radius:14px;overflow:hidden;font-size:12.5px;font-variant-numeric:tabular-nums}
th,td{padding:7px 6px;text-align:right;border-bottom:1px solid var(--line)}th:first-child,td:first-child{text-align:left;white-space:nowrap}th{color:var(--sub);font-weight:600;font-size:11px}
td:nth-child(5){text-align:${st.kind === "year" ? "right" : "left"}}.expense{color:var(--exp)}.income{color:var(--inc)}b{white-space:nowrap}
</style></head><body><h1>${esc(st.p.title)}</h1><div class="muted small">Отчёт за ${st.kind === "week" ? "неделю" : st.kind === "year" ? "год" : "месяц"}</div>
<div class="cards"><div class="card"><span class="muted small">Расходы</span><b class="expense">${m(st.exp)}</b></div><div class="card"><span class="muted small">Доходы</span><b class="income">${m(st.inc)}</b></div>
<div class="card"><span class="muted small">Баланс</span><b class="${st.inc - st.exp < 0 ? "expense" : "income"}">${st.inc - st.exp < 0 ? "−" : "+"}${m(Math.abs(st.inc - st.exp))}</b></div>
<div class="card"><span class="muted small">Еда в день</span><b>${st.kcalAvg ? num(st.kcalAvg) + " ккал" : "—"}</b></div><div class="card"><span class="muted small">Вода в день</span><b>${st.waterAvg ? liters(st.waterAvg) + " л" : "—"}</b></div>
<div class="card"><span class="muted small">Шагов в день</span><b>${st.stepsDays ? num(st.stepsAvg) : "—"}</b></div></div>
<h2>Тренировки и прогулки</h2><div class="list">${st.workouts.length ? `<div class="row"><span>Всего ${st.workouts.length}</span><b>${num(st.wkMin)} мин · −${num(st.wkKcal)} ккал</b></div>` + (st.kind === "year" ? "" : st.workouts.map(w => `<div class="row"><span>${WD[new Date(w.date).getDay()]} ${new Date(w.date).getDate()} · ${esc(w.title)}</span><b>${w.minutes} мин</b></div>`).join("")) : `<div class="row"><span class="muted">Тренировок не записано</span></div>`}</div>
<h2>Расходы по категориям</h2><div class="list">${st.cats.length ? st.cats.map(([n, v]) => `<div class="row" style="display:block"><div style="display:flex;justify-content:space-between"><span>${esc(n)}</span><b>${m(v)} <span class="muted small">${Math.round(v / st.exp * 100)}%</span></b></div><div class="track"><div class="bar" style="width:${v / st.cats[0][1] * 100}%"></div></div></div>`).join("") : `<div class="row"><span class="muted">Расходов нет</span></div>`}
${st.cash ? `<div class="row"><span class="muted small">💵 наличными ${m(st.cash)} · 💳 переводом ${m(st.exp - st.cash)}</span></div>` : ""}</div>
<h2>${st.kind === "year" ? "По месяцам" : "По дням"}</h2><table><tr>${head}</tr>${rows}</table>
${st.stepsDays < st.days.length ? `<div class="muted small" style="margin:8px 4px">Шаги есть за ${st.stepsDays} из ${st.days.length} дн.: виджет присылает историю часов за последние дни. Цель воды — ${liters(g.waterGoal)} л.</div>` : ""}
</body></html>`
}
function periodReportText(st) {
  const lines = [`Отчёт: ${st.p.title}`, `Расходы ${core.money(st.exp)} · доходы ${core.money(st.inc)}`,
    `Еда в среднем ${st.kcalAvg ? num(st.kcalAvg) + " ккал" : "—"} · вода ${st.waterAvg ? liters(st.waterAvg) + " л" : "—"} · шагов ${st.stepsDays ? num(st.stepsAvg) : "—"} в день`,
    `Тренировок ${st.workouts.length}${st.workouts.length ? `, ${num(st.wkMin)} мин` : ""}`, "", "Расходы по категориям:", ...st.cats.map(([n, v]) => `— ${n}: ${core.money(v)}`)]
  return lines.join("\n")
}
function showReport(kind = "month", at = new Date()) {
  let cur = sod(at)
  const s = sheet(`<div class="seg" style="margin-bottom:10px"><button data-k="week">Неделя</button><button data-k="month">Месяц</button><button data-k="year">Год</button></div>
    <div class="month"><button data-p="-1">‹</button><b class="rt"></b><button data-p="1">›</button></div><iframe class="report"></iframe>
    <div class="btns"><button class="btn" data-a="share">Отправить текстом</button><button class="btn primary" data-a="close">Закрыть</button></div>`)
  const draw = () => {
    const st = periodStats(kind, cur), nextOff = periodOf(kind, cur).to > new Date()
    $$("[data-k]", s.el).forEach(b => b.classList.toggle("on", b.dataset.k === kind))
    $(".rt", s.el).textContent = st.p.title
    const nb = $('[data-p="1"]', s.el); nb.disabled = nextOff; nb.style.opacity = nextOff ? .3 : 1
    $("iframe", s.el).srcdoc = periodReportHTML(st)
    s.st = st
  }
  $$("[data-k]", s.el).forEach(b => b.onclick = () => { kind = b.dataset.k; draw() })
  $$("[data-p]", s.el).forEach(b => b.onclick = () => {
    const p = periodOf(kind, cur), n = +b.dataset.p
    cur = n < 0 ? addDays(p.from, -1) : p.to
    if (cur > new Date()) cur = sod(new Date())
    draw()
  })
  $('[data-a="close"]', s.el).onclick = () => s.close()
  $('[data-a="share"]', s.el).onclick = () => {
    const text = periodReportText(s.st)
    if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard.writeText(text).then(() => toast("Скопировано"))
  }
  draw()
}

function bind() {
  const v = $("#view")
  $$("[data-day]", v).forEach(b => b.onclick = () => { selDay = new Date(+b.dataset.day); render() })
  $$("[data-shift]", v).forEach(b => b.onclick = () => { selDay = addDays(selDay, +b.dataset.shift); render() })
  $$("[data-hday]", v).forEach(b => b.onclick = () => { const d = addDays(healthDay(), +b.dataset.hday); if (d <= sod(new Date())) { selDay = d; render() } })
  $$("[data-report]", v).forEach(b => b.onclick = () => showReport(b.dataset.report, tab === "money" ? monthStart(monthKey) : healthDay()))
  $$("[data-ev]", v).forEach(el => el.onclick = () => eventSheet(dayEvsCache[+el.dataset.ev]))
  $$("[data-check]", v).forEach(b => b.onclick = ev => {
    ev.stopPropagation()
    const id = b.dataset.check
    b.classList.add("on")
    b.closest(".row").classList.add("done-anim")
    remSet(id, { completed: true })
    toast("✓ Выполнено")
    setTimeout(render, 380)
  })
  $$("[data-money]", v).forEach(el => el.onclick = () => moneyForm(null, D.money.find(e => e.id === el.dataset.money)))
  $$("[data-food]", v).forEach(el => el.onclick = () => foodForm(D.food.find(e => e.id === el.dataset.food)))
  $$("[data-wk]", v).forEach(el => el.onclick = () => workoutForm(D.workouts.find(e => e.id === el.dataset.wk)))
  $$("[data-mon]", v).forEach(b => b.onclick = () => {
    const [y, m] = monthKey.split("-").map(Number)
    monthKey = core.monthKey(new Date(y, m - 1 + +b.dataset.mon, 1)); render()
  })
  $$("[data-water]", v).forEach(b => b.onclick = async () => {
    const w = b.dataset.water
    if (w === "undo") { const last = today(D.water).pop(); if (last) { remove("water", last.id); render(); toast(`Убрано ${last.ml} мл`) } return }
    if (w === "other") { const t = await ui.ask("💧 Сколько выпили?", "В миллилитрах", "", { type: "number" }); if (t && +t) addWater(Math.round(+t)) }
    else addWater(+w)
  })
  $$("[data-set]", v).forEach(inp => inp.onchange = () => {
    const n = Math.round(+inp.value)
    if (!(n > 0)) { inp.value = H()[inp.dataset.set]; return }
    core.CONFIG.health = Object.assign({}, core.CONFIG.health, { [inp.dataset.set]: n })
    if (D.conn) { D.conn.cfg = D.conn.cfg || {}; D.conn.cfg.health = core.CONFIG.health }
    save(false); toast("Сохранено")
  })
  $$("[data-habit]", v).forEach(b => b.onclick = () => {
    const h = D.habits.find(z => z.id === b.dataset.habit)
    const on = habitToggle(h, selDay > sod(new Date()) ? new Date() : selDay)
    if (navigator.vibrate) navigator.vibrate(10)
    render()
    if (on && !h.bad) { const st = habitStreak(h); if (st > 1) toast(`🔥 ${st} ${plural(st, "день", "дня", "дней")} подряд`) }
  })
  $$("[data-recur]", v).forEach(el => el.onclick = () => recurAsk(D.recur.find(z => z.id === el.dataset.recur)))
  $$("[data-recur-pay]", v).forEach(b => b.onclick = ev => {
    ev.stopPropagation()
    const r = D.recur.find(z => z.id === b.dataset.recurPay)
    recurPay(r); render()
    const n = budgetNote(r.category); toast(`−${core.money(r.amount)} · ${r.title}${n ? " · " + n : ""}`)
  })
  $$("[data-brief]", v).forEach(b => b.onclick = () => brief(b.dataset.brief))
  $$("[data-do]", v).forEach(b => b.onclick = () => DO[b.dataset.do]())
  const inp = $("#chat-in", v)
  if (inp) {
    inp.oninput = () => grow(inp)
    inp.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (voice) return voiceSendNow(); const t = inp.value; inp.value = ""; grow(inp); chatSend(t) } }
    $(".chat-bar .send", v).onclick = () => { if (voice) return voiceSendNow(); if (chatBusy && !askWait && !inp.value.trim()) return chatStop(); const t = inp.value; inp.value = ""; grow(inp); chatSend(t) }
    if (chatBusy && !askWait) setBusyUI(true)
    // тронули текст во время записи — не отправлять по паузе: можно поправить и нажать ➤
    inp.addEventListener("focus", () => { if (voice) { const t = inp.value, r = rec; voiceReset(); try { r && r.stop() } catch (e) {} inp.value = t; grow(inp); toast("✎ Поправьте и нажмите ➤") } })
    if (voice) { $(".chat-bar .mic", v).classList.add("on"); inp.placeholder = "Слушаю… ➤ — отправить сразу"; if (voice.text) { inp.value = voice.text; grow(inp) } }
    $(".chat-bar .mic", v).onclick = () => micStart()
    $(".chat-bar .cam", v).onclick = () => photoPrompt()
    bindChatList()
  }
}

const DO = {
  event: () => eventForm(), reminder: () => reminderForm(), food: () => foodMenu(), workout: () => workoutForm(), photo: () => photoPrompt(),
  expense: () => moneyForm("expense"), income: () => moneyForm("income"), water: () => addWater(H().glass || 250),
  "go-today": () => { selDay = sod(new Date()); stripCenter = null; stripJump = true; render(); if (stripJump) stripInit(null) },
  "tab-money": () => setTab("money"), "tab-health": () => setTab("health"), report: () => showReport("month"),
  sheet: () => window.open(D.conn.sheetUrl, "_blank"),
  budgets: () => budgetForm(), "recur-add": () => recurForm(), habits: () => habitsForm(), weight: () => weightForm(), search: () => searchSheet(),
  sync: () => (!D.conn || !D.conn.hook) ? DO.connect() : sync().then(ok => toast(ok ? "Обновлено" : `Не получилось: ${D.sync.error || "нет связи"}`)),
  "run-widget": () => sync().then(runWidgetNow),
  autoconnect: () => autoConnect(),
  connect: async () => {
    const t = await ui.ask("Подключить к виджету", "Вставьте код из виджета: Scriptable → меню → 📱 Приложение «Мой день» → «Скопировать код подключения».", "", { multiline: true, ok: "Подключить" })
    if (t) connect(t)
  },
  disconnect: async () => {
    const b = await ui.confirm("Отключить?", `<div class="msg">Ключи удалятся с этого телефона. Записи останутся в таблице и в виджете.</div>`, ["Отмена", "Отключить"])
    if (b === "Отключить") { D = {}; localStorage.removeItem(STORE); load(); render() }
  },
  memory: async () => {
    while (true) {
      const f = memFacts().slice().reverse()
      if (!f.length) return ui.info("🧠 Память помощника", "Пока пусто. Помощник запоминает важное из разговоров сам; можно сказать «запомни, что…».")
      const i = await ui.choose("🧠 Память помощника", `${f.length} ${plural(f.length, "факт", "факта", "фактов")} · ${memChats().length} ${plural(memChats().length, "разговор", "разговора", "разговоров")} в сводках. Нажмите факт, чтобы забыть его.`, f.map(m => m.text))
      if (i < 0) return
      if ((await ui.confirm("Забыть?", `<div class="msg">${esc(f[i].text)}</div>`, ["Отмена", "Забыть"])) === "Забыть") { remove("memory", f[i].id); save() }
    }
  },
  "chat-clear": async () => {
    const b = await ui.confirm("Очистить чат?", `<div class="msg">Экран чата очистится. Помощник сохранит краткую сводку разговора в память и сможет найти его потом.</div>`, ["Отмена", "Очистить"])
    if (b === "Очистить") {
      D.chatArchive = D.chatArchive.concat(D.chat.map(m => ({ role: m.role, text: m.text, prompt: m.prompt, at: m.at, local: m.local }))).slice(-1500)
      D.chat = []; save(false); render(); memorize(true)
    }
  },
}

// ───────────── Бюджеты, регулярные платежи, привычки, вес, поиск ─────────────
// budgets: { id: "b:<категория>", category, limit } — лимит расходов на месяц
// recur:   { id, title, type, amount, method, category, day (число месяца), paid: { "YYYY-MM": id операции } }
// habits:  { id, title, emoji, bad (true — хочу бросить), archived }
// hlog:    { id: "h:<привычка>:<YYYY-MM-DD>", date, habit, day } — отметка за день; снятая отметка — «надгробие»
// weight:  { id, date, kg }
const budgetOf = cat => { const b = live(D.budgets).find(x => x.category === cat); return b && b.limit > 0 ? b.limit : 0 }
function setBudget(cat, limit) {
  limit = Math.round(+limit || 0)
  if (limit > 0) upsert("budgets", { id: "b:" + cat, date: Date.now(), category: cat, limit })
  else if (D.budgets.some(x => x.id === "b:" + cat && !x.deleted)) remove("budgets", "b:" + cat)
}
function budgetState(cat, key = core.monthKey(new Date())) {
  const limit = budgetOf(cat)
  if (!limit) return null
  const spent = core.monthTotals(live(D.money), key).cats.expense[cat] || 0
  return { category: cat, limit, spent, left: limit - spent, p: spent / limit }
}
// Строка-предупреждение после расхода: «⚠️ Еда: 9 200 из 10 000 ฿»
function budgetNote(cat, date = Date.now()) {
  const b = budgetState(cat, core.monthKey(new Date(date)))
  if (!b || b.p < 0.8) return ""
  return b.p > 1 ? `⚠️ ${cat}: лимит превышен на ${core.money(b.spent - b.limit)}` : `⚠️ ${cat}: ${num(b.spent)} из ${core.money(b.limit)}`
}
function budgetForm() {
  const cats = core.CONFIG.categories.expense.map(c => c[0])
  const t = core.monthTotals(live(D.money), core.monthKey(new Date()))
  const s = sheet(`<h3>Лимиты на месяц</h3><div class="msg">Сколько готовы тратить в месяц по категории. Пусто — без лимита. Помощник предупредит, когда потрачено 80%.</div>
    ${cats.map(c => `<div class="set"><span>${esc(c)}<span class="muted small"> · ${num(t.cats.expense[c] || 0)}</span></span><input type="number" inputmode="numeric" data-b="${esc(c)}" value="${budgetOf(c) || ""}" placeholder="—"></div>`).join("")}
    <div class="btns" style="margin-top:12px"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => { $$("[data-b]", s.el).forEach(i => { if (Math.round(+i.value || 0) !== budgetOf(i.dataset.b)) setBudget(i.dataset.b, i.value) }); s.close(); render(); toast("Лимиты сохранены") }
}

// Регулярные платежи: срок в этом месяце, оплачен ли
function recurDue(r, at = new Date()) {
  const y = at.getFullYear(), m = at.getMonth(), last = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(Math.max(1, r.day || 1), last))
}
const recurPaid = (r, key = core.monthKey(new Date())) => !!(r.paid && r.paid[key])
// Неоплаченные в этом месяце, срок через 3 дня или раньше
const recurSoon = () => live(D.recur).filter(r => r.type !== "income" && !recurPaid(r) && recurDue(r) < addDays(sod(new Date()), 4)).sort((a, b) => recurDue(a) - recurDue(b))
function recurPay(r) {
  const now = new Date(), key = core.monthKey(now)
  const m = upsert("money", { id: `f${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, date: +now, type: r.type || "expense", amount: r.amount, method: r.method || "transfer",
    category: r.category, comment: r.title })
  upsert("recur", Object.assign({}, r, { paid: Object.assign({}, r.paid, { [key]: m.id }) }))
  return m
}
function recurLabel(r) {
  if (recurPaid(r)) return "✓ оплачено в этом месяце"
  const d = recurDue(r), t0 = sod(new Date()), n = Math.round((d - t0) / 864e5)
  return n < 0 ? `просрочено с ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}` : n === 0 ? "сегодня" : n === 1 ? "завтра" : `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`
}
function recurForm(r) {
  const e = r || { title: "", amount: "", day: new Date().getDate(), method: "transfer", category: "", type: "expense" }
  const cats = core.CONFIG.categories.expense.map(c => c[0])
  let cat = e.category || "", method = e.method
  const s = sheet(`<h3>${r ? "Регулярный платёж" : "🔁 Новый регулярный платёж"}</h3>
    <div class="field"><input id="p-t" placeholder="Что: аренда, интернет, Netflix" value="${esc(e.title)}"></div>
    <div class="field"><label>Сумма, ${esc(core.CONFIG.currency)}</label><input id="p-a" type="number" inputmode="decimal" value="${e.amount}"></div>
    <div class="field"><label>Какого числа каждый месяц</label><input id="p-d" type="number" inputmode="numeric" min="1" max="31" value="${e.day}"></div>
    <div class="field"><div class="seg" id="p-m"><button data-m="cash">💵 Наличные</button><button data-m="transfer">💳 Перевод / карта</button></div></div>
    <div class="field"><label>Категория</label><div class="chips" id="p-c">${cats.map(c => `<button class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
    <div class="btns">${r ? '<button class="btn red" data-a="del">Удалить</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  const paint = () => { $$("#p-m button", s.el).forEach(b => b.classList.toggle("on", b.dataset.m === method)); $$("#p-c .chip", s.el).forEach(b => b.classList.toggle("on", b.dataset.c === cat)) }
  paint()
  $$("#p-m button", s.el).forEach(b => b.onclick = () => { method = b.dataset.m; paint() })
  $$("#p-c .chip", s.el).forEach(b => b.onclick = () => { cat = b.dataset.c; paint() })
  $("#p-t", s.el).oninput = ev => { if (r) return; const p = core.parseMoney(" " + ev.target.value + " ", "expense"); if (p.category && p.category !== "Другое") { cat = p.category; paint() } }
  if (!r) setTimeout(() => $("#p-t", s.el).focus(), 250)
  $('[data-a="no"]', s.el).onclick = () => s.close()
  if (r) $('[data-a="del"]', s.el).onclick = async () => {
    if ((await ui.confirm("Удалить платёж?", `<div class="msg">${esc(r.title)} больше не будет напоминать. Прошлые операции останутся.</div>`, ["Отмена", "Удалить"])) !== "Удалить") return
    remove("recur", r.id); s.close(); render()
  }
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#p-t", s.el).value.trim(), amount = parseFloat(String($("#p-a", s.el).value).replace(",", ".")), day = Math.round(+$("#p-d", s.el).value)
    if (!title) return toast("Напишите, что за платёж")
    if (!(amount > 0)) return toast("Введите сумму")
    if (!(day >= 1 && day <= 31)) return toast("Число от 1 до 31")
    upsert("recur", Object.assign({}, r || { id: uid("p"), date: Date.now(), type: "expense", paid: {} }, { title, amount, day, method, category: cat || cats[cats.length - 1] }))
    s.close(); render(); toast("🔁 Сохранено")
  }
}
async function recurAsk(r) {
  const b = await ui.confirm(r.title, `<div class="msg">${esc(core.money(r.amount))} · ${r.method === "cash" ? "💵 наличные" : "💳 перевод"} · ${esc(r.category)} · каждое ${r.day} число<br>${esc(recurLabel(r))}</div>`,
    recurPaid(r) ? ["Изменить", "Готово"] : ["Изменить", "✓ Оплачено"])
  if (b === "Изменить") return recurForm(r)
  if (b === "✓ Оплачено") { recurPay(r); render(); const n = budgetNote(r.category); toast(`−${core.money(r.amount)} · ${r.title}${n ? " · " + n : ""}`) }
}

// Привычки
const habitList = () => live(D.habits).filter(h => !h.archived).sort((a, b) => (a.date || 0) - (b.date || 0))
const hlogId = (h, d) => `h:${h.id}:${dayKey(d)}`
const habitOn = (h, d) => D.hlog.some(x => x.id === hlogId(h, d) && !x.deleted)
function habitToggle(h, d, on = !habitOn(h, d)) {
  if (on) upsert("hlog", { id: hlogId(h, d), date: +sod(d), habit: h.id, day: dayKey(d) })
  else if (habitOn(h, d)) remove("hlog", hlogId(h, d))
  return on
}
// Серия: для полезной — дни подряд с отметкой (сегодня можно ещё не отметить); для вредной — дни без неё
function habitStreak(h, at = new Date()) {
  let d = sod(at), n = 0
  if (h.bad) {
    const start = sod(h.date || Date.now())
    for (; n < 3650 && d >= start && !habitOn(h, d); d = addDays(d, -1)) n++
    return n
  }
  if (!habitOn(h, d)) d = addDays(d, -1)
  for (; n < 3650 && habitOn(h, d); d = addDays(d, -1)) n++
  return n
}
const habitCount = (h, from, to) => D.hlog.filter(x => !x.deleted && x.habit === h.id && x.date >= +from && x.date < +to).length
// «алкоголь» найдёт «Без алкоголя»: сравниваем основы слов без окончаний
const stems = s => String(s || "").toLowerCase().replace(/ё/g, "е").split(/[^a-zа-я0-9]+/).filter(w => w.length > 2 && !["без", "не", "бросаю", "бросить"].includes(w)).map(w => w.slice(0, Math.max(3, w.length - 2)))
function findHabit(q) {
  const s = String(q || "").toLowerCase().trim(), qs = stems(q)
  return habitList().find(h => h.id === q || h.title.toLowerCase() === s) || habitList().find(h => h.title.toLowerCase().includes(s) || s.includes(h.title.toLowerCase())) ||
    habitList().find(h => { const hs = stems(h.title); return qs.length && qs.every(w => hs.some(x => x.startsWith(w) || w.startsWith(x))) })
}
function habitsCard(day) {
  const list = habitList(), isT = sameDay(day, new Date())
  let html = `<div class="card"><h2>Привычки<button class="act" data-do="habits">${list.length ? "Изменить" : "+ Добавить"}</button></h2>`
  if (!list.length) return html + `<div class="empty">Отмечайте каждый день то, что хотите делать (зарядка, чтение) или бросить (алкоголь, курение) — приложение посчитает серию.</div></div>`
  html += `<div class="habits">${list.map(h => {
    const on = habitOn(h, day), st = habitStreak(h, day)
    const sub = h.bad ? (on ? "было" : `${st} ${plural(st, "день", "дня", "дней")} без`) : (st ? `${st} ${plural(st, "день", "дня", "дней")} подряд` : isT ? "ещё не сегодня" : "не было")
    return `<button class="habit ${on ? "on" : ""} ${h.bad ? "bad" : ""}" data-habit="${esc(h.id)}"><i>${esc(h.emoji || (h.bad ? "🚫" : "✓"))}</i><b>${esc(h.title)}</b><span>${esc(sub)}</span></button>`
  }).join("")}</div></div>`
  return html
}
const HABIT_EMOJI = ["🏃", "📖", "🧘", "💪", "🥗", "😴", "🍷", "🚬", "📵", "🍬", "💊", "✍️"]
function habitsForm() {
  const s = sheet(`<h3>Привычки</h3>
    <div id="h-list">${habitList().map(h => `<div class="row"><span>${esc(h.emoji || "✓")}</span><div class="grow"><div class="t">${esc(h.title)}</div><div class="s">${h.bad ? "бросаю" : "хочу делать"}</div></div><button class="btn small red" data-del="${esc(h.id)}">Убрать</button></div>`).join("") || '<div class="empty">Пока нет привычек</div>'}</div>
    <div class="field" style="margin-top:12px"><label>Новая привычка</label><input id="h-t" placeholder="Зарядка, чтение, без алкоголя…"></div>
    <div class="field"><div class="chips" id="h-e">${HABIT_EMOJI.map(e => `<button class="chip" data-e="${e}">${e}</button>`).join("")}</div></div>
    <div class="field"><div class="seg" id="h-k"><button data-k="good" class="on">✓ Хочу делать</button><button data-k="bad">🚫 Хочу бросить</button></div></div>
    <div class="btns"><button class="btn" data-a="no">Готово</button><button class="btn primary" data-a="ok">Добавить</button></div>`, { onClose: () => render() })
  let emoji = "", bad = false
  const paint = () => { $$("#h-e .chip", s.el).forEach(b => b.classList.toggle("on", b.dataset.e === emoji)); $$("#h-k button", s.el).forEach(b => b.classList.toggle("on", (b.dataset.k === "bad") === bad)) }
  $$("#h-e .chip", s.el).forEach(b => b.onclick = () => { emoji = b.dataset.e; paint() })
  $$("#h-k button", s.el).forEach(b => b.onclick = () => { bad = b.dataset.k === "bad"; paint() })
  $("#h-t", s.el).oninput = ev => { if (/алког|кур|сигар|сладк|соцсет|телефон|без /i.test(ev.target.value) && !bad) { bad = true; paint() } }
  $$("[data-del]", s.el).forEach(b => b.onclick = async () => {
    const h = D.habits.find(x => x.id === b.dataset.del)
    if ((await ui.confirm("Убрать привычку?", `<div class="msg">«${esc(h.title)}» исчезнет с экрана. Отметки сохранятся в истории.</div>`, ["Отмена", "Убрать"])) !== "Убрать") return
    upsert("habits", Object.assign({}, h, { archived: true })); s.close(); habitsForm()
  })
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#h-t", s.el).value.trim()
    if (!title) return toast("Напишите привычку")
    upsert("habits", { id: uid("h"), date: Date.now(), title, emoji: emoji || (bad ? "🚫" : "✓"), bad })
    s.close(); habitsForm(); toast("Добавлено")
  }
}

// Вес
const weights = () => live(D.weight).filter(w => w.kg > 0).sort((a, b) => a.date - b.date)
function logWeight(kg, date = Date.now()) {
  kg = Math.round(+kg * 10) / 10
  const d = new Date(date), old = live(D.weight).find(w => sameDay(w.date, d))
  const rec = upsert("weight", Object.assign({}, old || { id: uid("w") }, { date: +d, kg }))
  if (sameDay(d, new Date()) || !weights().some(w => w.date > +d)) {   // последний вес — для расчёта тренировок
    core.CONFIG.health = Object.assign({}, core.CONFIG.health, { weight: Math.round(kg) })
    if (D.conn) { D.conn.cfg = D.conn.cfg || {}; D.conn.cfg.health = core.CONFIG.health }
    save()
  }
  return rec
}
const kgs = n => (Math.round(n * 10) / 10).toString().replace(".", ",")
function weightCard() {
  const list = weights(), last = list[list.length - 1]
  let html = `<div class="card"><h2>Вес<button class="act" data-do="weight">+ Записать</button></h2>`
  if (!last) return html + `<div class="empty">Взвешивайтесь раз в несколько дней — здесь появится график. Можно сказать помощнику «вешу 78,5».</div></div>`
  const month = list.filter(w => w.date > Date.now() - 30 * 864e5), first = month[0] || last, diff = last.kg - first.kg
  html += `<div class="wt"><b>${kgs(last.kg)} кг</b><span class="muted small">${esc(dayName(new Date(last.date)))}${month.length > 1 ? ` · за 30 дней ${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${kgs(Math.abs(diff))} кг` : ""}</span></div>`
  const pts = list.slice(-30)
  if (pts.length > 1) {
    const lo = Math.min(...pts.map(w => w.kg)) - 0.5, hi = Math.max(...pts.map(w => w.kg)) + 0.5, t0 = pts[0].date, t1 = pts[pts.length - 1].date
    const xy = pts.map(w => [((w.date - t0) / Math.max(1, t1 - t0)) * 300, 70 - ((w.kg - lo) / (hi - lo)) * 64].map(v => v.toFixed(1)))
    html += `<svg class="spark" viewBox="-4 0 308 74" preserveAspectRatio="none"><polyline points="${xy.map(p => p.join(",")).join(" ")}"/>${xy.slice(-1).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5"/>`).join("")}</svg>`
  }
  return html + `</div>`
}
async function weightForm() {
  const last = weights().pop()
  const t = await ui.ask("⚖️ Вес", "В килограммах, например 78,5", last ? kgs(last.kg) : "", { type: "text", ok: "Сохранить" })
  const kg = parseFloat(String(t || "").replace(",", "."))
  if (!(kg > 20 && kg < 400)) { if (t) toast("Не понял вес"); return }
  logWeight(kg); render(); toast(`⚖️ ${kgs(kg)} кг`)
}

// Поиск по всему: операции, еда, напоминания, события, регулярные платежи, привычки, чат
function searchAll(q) {
  const s = q.toLowerCase().trim(), n = parseFloat(s.replace(",", "."))
  if (s.length < 2 && !(n > 0)) return []
  const has = (...xs) => xs.some(x => x != null && String(x).toLowerCase().includes(s))
  const out = []
  for (const e of live(D.money).sort((a, b) => b.date - a.date)) if (has(e.category, e.comment) || (n > 0 && Math.abs(e.amount - n) < 0.5))
    out.push({ g: "Деньги", t: `${e.type === "expense" ? "−" : "+"}${core.money(e.amount)} · ${e.category}`, s: `${dayName(new Date(e.date))}${e.comment ? " · " + e.comment : ""}`, open: () => moneyForm(null, e) })
  for (const r of live(D.recur)) if (has(r.title, r.category) || (n > 0 && Math.abs(r.amount - n) < 0.5)) out.push({ g: "Регулярные платежи", t: r.title, s: `${core.money(r.amount)} · ${recurLabel(r)}`, open: () => recurAsk(r) })
  for (const r of live(D.rems).sort((a, b) => (b.u || 0) - (a.u || 0))) if (has(r.title, r.notes)) out.push({ g: "Напоминания", t: (r.done ? "✓ " : "") + r.title, s: remLabel(r) || (r.done ? "выполнено" : "без срока") })
  for (const e of iphone().events) if (has(e.title, e.location)) out.push({ g: "Календарь", t: e.title, s: `${dayName(e.s)} ${e.all_day ? "" : hm(e.s)}${e.location ? " · " + e.location : ""}`, open: () => eventSheet(e) })
  for (const f of live(D.food).sort((a, b) => b.date - a.date)) if (has(f.title)) out.push({ g: "Еда", t: f.title, s: `${dayName(new Date(f.date))} · ${num(f.kcal)} ккал`, open: () => foodForm(f) })
  for (const h of live(D.habits)) if (has(h.title)) out.push({ g: "Привычки", t: `${h.emoji || ""} ${h.title}`, s: h.bad ? "бросаю" : `${habitStreak(h)} дн. подряд` })
  for (const m of D.chat.concat(D.chatArchive || []).filter(m => m.text && !m.local).sort((a, b) => (b.at || 0) - (a.at || 0))) if (has(m.text)) {
    const i = m.text.toLowerCase().indexOf(s), cut = m.text.slice(Math.max(0, i - 40), i + 80)
    out.push({ g: "Чат", t: (m.role === "user" ? "Вы: " : "Помощник: ") + (i > 40 ? "…" : "") + cut, s: m.at ? `${dayName(new Date(m.at))}, ${hm(new Date(m.at))}` : "" })
  }
  return out
}
function searchSheet() {
  const s = sheet(`<h3>Поиск</h3><div class="field"><input id="q" type="search" placeholder="Такси, аренда, 1500, стоматолог…" autocomplete="off"></div><div id="q-res" class="q-res"></div>`)
  const inp = $("#q", s.el), box = $("#q-res", s.el)
  let res = []
  const run = () => {
    res = searchAll(inp.value)
    const groups = {}
    res.forEach((r, i) => { (groups[r.g] = groups[r.g] || []).push(i) })
    box.innerHTML = !inp.value.trim() ? `<div class="empty">Ищет по деньгам, напоминаниям, календарю, еде, привычкам и чату. Можно искать по сумме.</div>`
      : !res.length ? `<div class="empty">Ничего не нашлось</div>`
      : Object.entries(groups).map(([g, ids]) => `<div class="day-h">${esc(g)} · ${ids.length}</div>` + ids.slice(0, 15).map(i => `<div class="row" data-q="${i}"><div class="grow"><div class="t">${esc(res[i].t)}</div>${res[i].s ? `<div class="s">${esc(res[i].s)}</div>` : ""}</div></div>`).join("")).join("")
    $$("[data-q]", box).forEach(el => el.onclick = () => { const r = res[+el.dataset.q]; if (r.open) { s.close(); r.open() } })
  }
  let t = null
  inp.oninput = () => { clearTimeout(t); t = setTimeout(run, 150) }
  run()
  setTimeout(() => inp.focus(), 250)
}

// ───────────── Подключение ─────────────
function decodeSetup(code) {
  const s = String(code || "").trim().replace(/^.*#setup=/, "")
  const bin = atob(decodeURIComponent(s).replace(/\s+/g, ""))
  const json = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)))
  const d = JSON.parse(json)
  if (!d || !/^https:\/\/script\.google(usercontent)?\.com\//.test(d.hook || "") || !d.secret) throw new Error("в коде нет ссылки на таблицу")
  return d
}
async function connect(code) {
  let d
  try { d = decodeSetup(code) } catch (e) { return ui.info("Не тот код", "Скопируйте код подключения в виджете ещё раз. " + (e.message || "")) }
  const fresh = !D.conn || D.conn.hook !== d.hook
  D.conn = { hook: d.hook, secret: d.secret, key: d.key || "", routes: d.routes || [], sheetUrl: d.sheetUrl || "", cfg: d.cfg || null, run: d.run || "" }
  if (fresh) D.sync = { since: 0, pushedAt: 0, snapAt: 0, at: 0, error: "" }
  applyCfg()
  save(false)
  render()
  toast("Подключаюсь…")
  const ok = await sync()
  if (ok) toast(D.snap ? "✓ Подключено" : "✓ Подключено. Календарь придёт с обновлением виджета")
  else ui.info("Таблица не ответила", D.sync.error + "\n\nПроверьте, что в таблицу вставлен новый Code.gs и веб-приложение развёрнуто заново (новая версия).")
}

// Подключение в одно касание: Scriptable копирует код в буфер, приложение забирает его по нажатию «Вставить»
// (браузер читает буфер только по нажатию — iOS покажет кнопку «Вставить»)
let connectAt = 0
function autoConnect() {
  connectAt = Date.now()
  location.href = "scriptable:///run/MyDay?action=connect"
}
async function pasteConnect() {
  connectAt = 0
  const s = sheet(`<h3>🔗 Подключение</h3><div class="msg">Код скопирован в Scriptable. Нажмите «Вставить» — и всё.</div>
    <div class="btns"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">📋 Вставить</button></div>`)
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = async () => {
    let t = ""
    try { t = await navigator.clipboard.readText() } catch (e) {}
    s.close()
    if (t && /setup=|^[A-Za-z0-9+/=%\s]{40,}$/.test(t.trim())) return connect(t)
    DO.connect()
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !D.conn && connectAt && Date.now() - connectAt < 10 * 60e3) setTimeout(pasteConnect, 300)
})

// ───────────── Действия из виджета (ссылки вида …/#voice) ─────────────
async function hashAction() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ""))
  if (!h) return
  history.replaceState(null, "", location.pathname + location.search)
  while (stack.length) stack[stack.length - 1].close()
  if (h.startsWith("setup=")) return connect(h.slice(6))
  const eq = h.indexOf("="), a = eq < 0 ? h : h.slice(0, eq), arg = eq < 0 ? "" : h.slice(eq + 1)
  if (a === "voice") { setTab("chat"); return micStart(true) }
  if (a === "chat" || a === "note") return setTab("chat")
  if (a === "brief") { setTab("chat"); return brief(arg) }
  if (a === "money") return moneyForm("expense")
  if (a === "water") return addWater(H().glass || 250, "widget")
  if (a === "camera") return photoPrompt()
  if (a === "food") return foodMenu()
  if (a === "health") return setTab("health")
  if (a === "today") return setTab("today")
  if (a === "rem") return remFollow(arg)
  if (a === "synced") { setTab("today"); return sync().then(() => { render(); toast("✓ Внесено в iPhone") }) }
  if (a === "remdone") { remSet(arg, { completed: true }); setTab("today"); return toast("✓ Отмечено выполненным") }
  if (a === "remlater") { remSet(arg, { due: iso(new Date(Date.now() + 3600e3)) }); setTab("today"); return toast("⏰ Перенёс на час") }
  if (a === "place") { const p = D.places.find(z => z.id === arg); setTab("today"); if (p) ui.info(`📍 ${p.title}`, `Вы рядом: ${p.query}.`) }
}
// Запустить Scriptable сейчас: внесёт изменения в календарь и напоминания, пришлёт свежий снимок и вернёт в приложение
function runWidgetNow() {
  const run = (D.conn && D.conn.run) || "scriptable:///run/MyDay"
  const name = decodeURIComponent((run.split("/run/")[1] || "MyDay").split("?")[0])
  // Обычный запуск Scriptable (x-callback-url он не принимает — «The URL is not supported»).
  // Назад — кнопкой «◀ IZIDAY» слева вверху; при возврате приложение само обновится и скажет, всё ли внесено.
  runWidgetAt = Date.now()
  location.href = `scriptable:///run/${encodeURIComponent(name)}?action=hub`
}
let runWidgetAt = 0
// «Выполнил?» по напоминанию из уведомления: сделано / перенести / почему нет
async function remFollow(id) {
  setTab("today")
  const r = (iphone().reminders || []).find(x => x.id === id)
  if (!r) return ui.info("Напоминание", "Не нашёл его — возможно, уже выполнено или удалено.")
  if (r.completed) return toast("✓ Уже выполнено")
  const at = h => { const d = new Date(); d.setHours(h, 0, 0, 0); return d }
  const opts = [["✅ Сделано", () => { remSet(id, { completed: true }); toast("✓ Отлично!") }],
    ["⏰ Через час", () => remSet(id, { due: iso(new Date(Date.now() + 3600e3)) })],
    ...(new Date().getHours() < 19 ? [["🌆 Вечером в 19:00", () => remSet(id, { due: iso(at(19)) })]] : []),
    ["📅 Завтра в 10:00", () => remSet(id, { due: iso(addDays(at(10), 1)) })],
    ["💬 Не сделал — почему…", async () => {
      const why = await ui.ask("Что помешало?", `«${r.title}». Помощник учтёт и предложит, когда лучше сделать.`, "", { ok: "Отправить", multiline: true })
      if (why) chatSend(`Не выполнил напоминание «${r.title}»${r.due ? ` (срок ${r.due.replace("T", " ")})` : ""}. Причина: ${why}. Перенеси на подходящее время (посмотри календарь), а если это повторяется — запомни и подскажи, как не откладывать.`)
    }]]
  const i = await ui.choose(`⏰ ${r.title}`, r.due ? `Срок: ${r.due.replace("T", " ")}. Выполнили?` : "Выполнили?", opts.map(o => o[0]))
  if (i >= 0) { await opts[i][1](); render() }
}
// Safari включает микрофон и камеру только по нажатию — одна большая кнопка
function micPrompt() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { const i = $("#chat-in"); if (i) i.focus(); return }
  const s = sheet(`<h3>🎤 Скажите помощнику</h3><div class="btns"><button class="btn gold" style="padding:18px;font-size:18px">Нажмите и говорите</button></div>`)
  $(".btn", s.el).onclick = () => { s.close(); micStart() }
}
function photoPrompt() {
  const s = sheet(`<h3>📷 Фото или файл</h3><div class="msg">Еда — посчитаю калории. Счёт — от кого, сумма и срок, напомню оплатить. Чек — что куплено и почём, запишу расход.</div>
    <div class="btns"><button class="btn gold" data-a="cam" style="padding:18px;font-size:18px">Сфотографировать</button></div>
    <div class="btns"><button class="btn" data-a="lib">Из фото</button><button class="btn" data-a="doc">Файл / PDF</button></div>
    <div class="btns"><button class="btn" data-a="txt">Описать еду словами</button></div>`)
  $('[data-a="doc"]', s.el).onclick = () => { s.close(); $("#doc").click() }
  $('[data-a="cam"]', s.el).onclick = () => { s.close(); $("#photo").click() }
  $('[data-a="lib"]', s.el).onclick = () => { s.close(); $("#photo-lib").click() }
  $('[data-a="txt"]', s.el).onclick = async () => { s.close(); const t = await ui.ask("Что съели?", "Например: тарелка том яма и рис", "", { ok: "Посчитать" }); if (t) foodFlow(null, t) }
}

// ───────────── Старт ─────────────
document.querySelectorAll("[data-ico]").forEach(i => i.innerHTML = ICO[i.dataset.ico])
// Настоящая высота экрана: в приложении со значка iOS отдаёт в CSS высоту без строки состояния, и внизу оставалась пустая полоса
function fitHeight() {
  let h = window.innerHeight
  if (navigator.standalone || matchMedia("(display-mode: standalone)").matches) {
    const land = matchMedia("(orientation: landscape)").matches
    h = Math.max(h, land ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height))
  }
  document.documentElement.style.setProperty("--app-h", h + "px")
}
fitHeight()
addEventListener("resize", fitHeight)
// Клавиатура: поднять строку ввода чата над ней (окно страницы на iPhone при этом не уменьшается)
if (window.visualViewport) {
  const kb = () => {
    const app = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-h")) || innerHeight
    const hidden = Math.max(0, app - visualViewport.height - visualViewport.offsetTop)
    document.documentElement.style.setProperty("--kb", hidden > 80 ? hidden + "px" : "0px")
    document.body.classList.toggle("kb", hidden > 80)
  }
  visualViewport.addEventListener("resize", kb); visualViewport.addEventListener("scroll", kb)
}
addEventListener("orientationchange", () => setTimeout(fitHeight, 300))
$("#fab").innerHTML = ICO.mic
// Микрофон: нажатие — сразу слушает команду для помощника; долгое нажатие — меню «Добавить»
{
  const fab = $("#fab")
  let lp = null, long = false
  fab.addEventListener("pointerdown", () => { long = false; lp = setTimeout(() => { long = true; addMenu() }, 550) })
  const stop = () => clearTimeout(lp)
  fab.addEventListener("pointerup", stop); fab.addEventListener("pointercancel", stop); fab.addEventListener("pointerleave", stop)
  fab.addEventListener("contextmenu", e => e.preventDefault())
  fab.onclick = () => { if (long) return; if (tab !== "chat") setTab("chat"); micStart() }
}
$("#sync").innerHTML = ICO.sync
$("#sync").onclick = () => DO.sync()
$("#find").innerHTML = ICO.find
$("#find").onclick = () => searchSheet()
$$("#tabs button").forEach(b => b.onclick = () => setTab(b.dataset.tab))
onPhoto($("#photo")); onPhoto($("#photo-lib")); onPhoto($("#doc"))
load()
setTab("today")
hashAction()
setTimeout(memorize, 8000)   // прошлый разговор закончился — сложить в память
setTimeout(autoPlan, 15000)   // первый раз за день — план подсказок
window.addEventListener("hashchange", hashAction)
sync()
setInterval(() => { if (document.visibilityState === "visible") sync() }, 60000)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") { hiddenAt = Date.now(); return }
  if (hiddenAt && Date.now() - hiddenAt > 30 * 60e3 && !sameDay(selDay, new Date())) { selDay = sod(new Date()); stripCenter = null; stripJump = true }
  const back = runWidgetAt && Date.now() - runWidgetAt < 10 * 60e3
  runWidgetAt = 0
  sync().then(() => { if (back) { render(); toast(pendingOps().length ? "Ещё не всё внесено — откройте виджет ещё раз" : "✓ Внесено в iPhone") } })
})
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(r => r.update()).catch(() => {})
  // Пришла новая версия: в первые секунды после запуска — перезагрузиться сразу; если уже пользуетесь —
  // тихо перезагрузиться, когда приложение уйдёт в фон (перезагрузка заново спрашивает микрофон у iOS)
  const had = !!navigator.serviceWorker.controller, born = Date.now()
  let reloaded = false, pending = false
  const reload = () => { if (!reloaded) { reloaded = true; location.reload() } }
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!had) return; if (Date.now() - born < 4000) reload(); else pending = true })
  document.addEventListener("visibilitychange", () => { if (pending && document.visibilityState === "hidden") reload() })
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {}) })
}
