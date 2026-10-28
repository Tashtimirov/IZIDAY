// «Мой день» для Android. Всё хранится на телефоне (data.json через мост Android), интернет не нужен.
// Разбор голосовых команд, деньги и отчёты — общее ядро с iPhone (core-ru.js / core-th.js, собираются build_android.py).
"use strict"

// ───────────── Мост к Android (в браузере — заглушка для проверки) ─────────────
const A = window.Android || (() => {
  const day = (d, h, m) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return +x }
  const evs = [
    { id: 1, start: day(0, 10, 0), end: day(0, 11, 0), title: "Встреча с Олей", calendar: "Личный", color: "#1E9E8F" },
    { id: 2, start: day(0, 19, 0), end: day(0, 21, 0), title: "Падел", calendar: "Спорт", color: "#D9952B", recurring: true },
    { id: 3, start: day(1, 9, 30), end: day(1, 10, 0), title: "Созвон с командой", calendar: "Работа", color: "#3B5A80" },
    { id: 4, start: day(3, 0, 0), end: day(4, 0, 0), title: "День рождения мамы", calendar: "Личный", color: "#C0502E", allDay: true },
  ]
  return {
    mock: true,
    load: () => localStorage.getItem("myday") || "",
    save: s => localStorage.setItem("myday", s),
    takeAction: () => null,
    events: (f, t) => JSON.stringify(evs.filter(e => e.end > f && e.start < t)),
    hasCalendar: () => true,
    addEvent: (title, s, e) => { evs.push({ id: Date.now(), start: s, end: e, title, calendar: "Личный", color: "#1E9E8F" }); return "ok" },
    deleteEvent: id => { const i = evs.findIndex(e => e.id === id); if (i >= 0) evs.splice(i, 1); return "ok" },
    deleteOccurrence: () => "ok",
    moveEvent: (id, b, s, e) => { const x = evs.find(v => v.id === id); if (x) { x.start = s; x.end = e } return "ok" },
    openEvent: () => {}, insertEventUi: () => {},
    requestPermissions: () => setTimeout(() => app.onPermissions(), 50),
    canNotify: () => true,
    listen: () => setTimeout(() => app.onSpeech(prompt("Голосовая команда (в браузере — текстом)")), 50),
    exportFile: (n, m, t) => console.log("export", n, t.length), importFile: () => {}, share: t => console.log(t),
    toast: t => console.log("toast", t), home: () => console.log("home"), version: () => "1.0 (браузер)",
  }
})()

// ───────────── Данные ─────────────
const PROFILES = { ru: { name: "Россия", currency: "₽" }, th: { name: "Таиланд", currency: "฿" } }
let D = {}
let core = window.CORES.ru

function load() {
  try { D = JSON.parse(A.load() || "{}") || {} } catch (e) { D = {} }
  for (const k of ["money", "reminders", "notes", "food", "workouts"]) if (!Array.isArray(D[k])) D[k] = []
  if (!D.water || typeof D.water !== "object") D.water = {}
  D.settings = Object.assign({ profile: null, waterGoal: 2000, glass: 250, kcalGoal: 2000, weight: 75 }, D.settings || {})
  core = window.CORES[D.settings.profile] || window.CORES.ru
  D.settings.currency = core.CONFIG.currency
}
function save() {
  D.v = 1
  D.changed = Date.now()
  A.save(JSON.stringify(D))
}
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

// ───────────── Мелочи ─────────────
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
const z2 = n => String(n).padStart(2, "0")
const hm = d => `${z2(d.getHours())}:${z2(d.getMinutes())}`
const dayKey = d => `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`
const sod = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const sameDay = (a, b) => dayKey(new Date(a)) === dayKey(new Date(b))
const num = n => Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ")
const liters = ml => (Math.round(ml / 10) / 100).toString().replace(".", ",")
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"]
const DAY_NAMES = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"]
const MON_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
const fullDate = d => `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MON_GEN[d.getMonth()]}`
const shortDate = d => `${WD[d.getDay()]}, ${d.getDate()} ${MON_GEN[d.getMonth()]}`
function dayName(d) {
  const t = sod(new Date())
  const diff = Math.round((sod(d) - t) / 864e5)
  return diff === 0 ? "сегодня" : diff === 1 ? "завтра" : diff === -1 ? "вчера" : shortDate(d)
}
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10
  return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many
}

function toast(t) {
  const el = $("#toast")
  el.textContent = t
  el.classList.add("show")
  clearTimeout(toast.t)
  toast.t = setTimeout(() => el.classList.remove("show"), 2200)
}

const ICO = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8.5 15l2 2 4-4"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="13" rx="3"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/></svg>',
  health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/><path d="M7 12h3l1.3-2.5L13 14l1.2-2H17"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/></svg>',
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
      const s = sheet(`<h3>${esc(title)}</h3><div class="msg">${esc(message || "")}</div><div class="btns"><button class="btn primary">Понятно</button></div>`,
        { onClose: () => res() })
      $(".btn", s.el).onclick = () => s.close()
    })
  },
  // варианты — список строк; ответ — номер или -1
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
        `<div class="btns">${opts.mic ? '<button class="btn" data-a="mic">🎤 Сказать</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">${esc(opts.ok || "Готово")}</button></div>`,
        { onClose: () => res(v) })
      const inp = $("#ask-v", s.el)
      setTimeout(() => inp.focus(), 250)
      const ok = () => { v = inp.value.trim() || null; s.close() }
      $('[data-a="ok"]', s.el).onclick = ok
      $('[data-a="no"]', s.el).onclick = () => s.close()
      if (opts.mic) $('[data-a="mic"]', s.el).onclick = () => { v = "__MIC__"; s.close() }
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

// ───────────── Календарь телефона ─────────────
let calCache = { key: "", list: null }
function events(from, to) {
  const key = `${+from}-${+to}`
  if (calCache.key === key && Date.now() - calCache.at < 15000) return calCache.list
  let list = null
  try {
    const raw = JSON.parse(A.events(+from, +to))
    list = raw ? raw.map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) })) : null
  } catch (e) { list = [] }
  calCache = { key, list, at: Date.now() }
  return list
}
const dropCalCache = () => { calCache = { key: "", list: null } }

let permWait = null
function askPermission(which) {
  return new Promise(res => { permWait = res; A.requestPermissions(which) })
}

const RRULE_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]
function rrule(recur) {
  if (!recur) return ""
  if (recur.freq === "daily") return "FREQ=DAILY;INTERVAL=1"
  const days = recur.days && recur.days.length ? `;BYDAY=${recur.days.map(d => RRULE_DAYS[d]).join(",")}` : ""
  return `FREQ=WEEKLY;INTERVAL=1${days}`
}

async function addEvent(a) {
  const start = new Date(a.date), end = new Date(start.getTime() + (a.minutes || core.CONFIG.defaultEventMinutes) * 60000)
  let r = A.addEvent(a.title, +start, +end, rrule(a.recur), a.location || "", false)
  if (r === "noperm") {
    await askPermission("calendar")
    r = A.addEvent(a.title, +start, +end, rrule(a.recur), a.location || "", false)
  }
  if (r !== "ok") {
    // без доступа или без календаря — откроем календарь телефона с заполненным событием
    A.insertEventUi(a.title, +start, +end, rrule(a.recur), a.location || "")
  }
  dropCalCache()
}

// ───────────── Напоминания ─────────────
function nextDue(due, recur) {
  const d = new Date(due), now = Date.now()
  for (let i = 0; i < 800; i++) {
    d.setDate(d.getDate() + 1)
    if ((!recur.days || !recur.days.length || recur.days.includes(d.getDay())) && +d > now) return +d
  }
  return +d
}
const openReminders = () => D.reminders.filter(r => !r.done && !r.deleted)
const isLate = r => r.due != null && (r.time ? r.due < Date.now() : r.due < +sod(new Date()))
function reminderLabel(r) {
  if (r.due == null) return ""
  const d = new Date(r.due)
  const t = r.time ? hm(d) : ""
  const day = dayName(d)
  return day === "сегодня" ? (t || "сегодня") : `${day}${t ? " " + t : ""}`
}
function completeReminder(r) {
  if (r.recur && r.due != null) r.due = nextDue(r.due, r.recur)
  else { r.done = true; r.doneAt = Date.now() }
  r.u = Date.now()
}
function addReminder(a) {
  const due = a.date ? new Date(a.date) : null
  D.reminders.push({ id: uid("r"), title: a.title, due: due ? +due : null, time: !!due, recur: a.recur || null, done: false, u: Date.now() })
}

// ───────────── Голосовые команды ─────────────
let speechWait = null
function listen() {
  return new Promise(res => { speechWait = res; A.listen() })
}

async function answerQuery(a) {
  if (a.topic === "money") {
    const t = core.monthTotals(visibleMoney(), core.monthKey(new Date()))
    const month = core.MONTH_NOM[new Date().getMonth()]
    if (a.category) {
      const type = a.income ? "income" : "expense"
      const items = t.items.filter(e => e.category === a.category && e.type === type)
      return ui.info(`${a.category} · ${month}`, `${type === "income" ? "Получено" : "Потрачено"}: ${core.money(items.reduce((x, e) => x + e.amount, 0))} (${items.length} опер.)\n\n` +
        items.slice(-6).reverse().map(e => `${core.DM.string(new Date(e.date))} ${core.money(e.amount)}${e.comment ? " · " + e.comment : ""}`).join("\n"))
    }
    const top = Object.entries(t.cats.expense).sort((x, y) => y[1] - x[1]).slice(0, 4)
    return ui.info(`${month}: −${core.money(t.expense)} / +${core.money(t.income)}`,
      `Баланс: ${t.income - t.expense < 0 ? "−" : "+"}${core.money(t.income - t.expense)}` +
      (top.length ? "\n\nБольше всего:\n" + top.map(([n, v]) => `${n}: ${core.money(v)}`).join("\n") : ""))
  }
  if (a.topic === "when") {
    const now = new Date()
    const list = (events(now, addDays(now, 365)) || []).filter(e => core.titleMatches(e.title, a.q) || e.title.toLowerCase().includes((a.q || "").toLowerCase()))
    return ui.info(list.length ? list[0].title : "Не нашёл", list.length ? list.slice(0, 4).map(e => `${shortDate(e.start)}, ${e.allDay ? "весь день" : hm(e.start) + "–" + hm(e.end)}`).join("\n")
      : `В ближайший год нет событий «${a.q || ""}».`)
  }
  const day = a.day ? new Date(a.day) : sod(new Date())
  const evs = events(day, addDays(day, 1)) || []
  const rems = openReminders().filter(r => r.due != null && sameDay(r.due, day))
  const lines = evs.map(e => `📅 ${e.allDay ? "весь день" : hm(e.start) + "–" + hm(e.end)} ${e.title}`)
    .concat(rems.map(r => `⏰ ${r.time ? hm(new Date(r.due)) : "—"} ${r.title}`))
  return ui.info(core.cap(fullDate(day)), lines.length ? lines.join("\n") : "Ничего не запланировано 🎉")
}

async function completeMove(a) {
  const from = a.from ? sod(a.from) : new Date(Date.now() - 864e5)
  const to = addDays(from, a.from ? 1 : 45)
  let list = (events(from, to) || []).filter(e => !e.allDay && e.start >= from && (!a.query || core.titleMatches(e.title, a.query)))
  if (a.fromHasTime) list = list.filter(e => e.start.getHours() === new Date(a.from).getHours())
  if (!list.length) { await ui.info("Не нашёл событие", `«${a.query || "…"}»${a.from ? " на " + dayName(new Date(a.from)) : " в ближайшие недели"}.`); return null }
  let ev = list[0]
  if (list.length > 1) {
    const i = await ui.choose("Какое событие перенести?", "", list.slice(0, 8).map(e => `${e.title} · ${shortDate(e.start)}, ${hm(e.start)}`))
    if (i < 0) return null
    ev = list[i]
  }
  let ns
  if (a.shift) ns = new Date(ev.start.getTime() + a.shift * 60000)
  else if (a.toDay || a.toTime) {
    ns = new Date(a.toDay || sod(ev.start))
    const [hh, mm] = a.toTime ? a.toTime.split(":").map(Number) : [ev.start.getHours(), ev.start.getMinutes()]
    ns.setHours(hh, mm, 0, 0)
  } else {
    const t = await ui.ask(`Куда перенести «${ev.title}»?`, `Сейчас: ${shortDate(ev.start)}, ${hm(ev.start)}. Например: «на 20:00», «на пятницу в 15», «на час позже»`)
    if (!t) return null
    const b = core.buildMove("перенеси x на " + t.replace(/^на\s+/i, ""))
    return completeMove(Object.assign(a, { toDay: b.toDay, toTime: b.toTime, shift: b.shift, from: ev.start, fromHasTime: true, query: ev.title }))
  }
  a.event = { id: ev.id, title: ev.title, startDate: ev.start, endDate: ev.end }
  a.newStart = ns
  return a
}

async function completeDone(a) {
  const list = openReminders()
  const q = (a.query || "").toLowerCase()
  let hits = list.filter(r => q && (r.title.toLowerCase().includes(q) || core.titleMatches(r.title, a.query)))
  if (!hits.length) {
    const i = await ui.choose(`Не нашёл напоминание «${a.query || "…"}»`, "Что сделать?", ["Выбрать из списка", "Записать как заметку"])
    if (i === 1) { a.kind = "note"; a.title = core.cap(a.query || "Сделано"); return a }
    if (i !== 0 || !list.length) return null
    hits = list
  }
  let r = hits[0]
  if (hits.length > 1) { const i = await ui.choose("Что отметить выполненным?", "", hits.slice(0, 10).map(x => x.title)); if (i < 0) return null; r = hits[i] }
  a.reminder = { id: r.id, title: r.title }
  return a
}

async function completeAction(a) {
  if (a.kind === "query") { await answerQuery(a); return null }
  if (a.kind === "move") return completeMove(a)
  if (a.kind === "done") return completeDone(a)
  if (!a.kind) {
    const opts = [["📅 Встреча", "event"], ["⏰ Напоминание", "reminder"], ["📝 Заметка", "note"],
      ["➖ Расход", "expense"], ["➕ Доход", "income"], ["↔️ Перенести событие", "move"], ["✅ Отметить выполненным", "done"], ["🗑 Удалить", "delete"]]
    const i = await ui.choose("Что это?", `«${a.raw}»`, opts.map(o => o[0]))
    if (i < 0) return null
    return completeAction(core.buildActions([{ text: a.raw, kind: opts[i][1] }])[0])
  }
  if (a.kind === "delete") {
    const hasQ = core.words(a.query).length > 0
    if (!hasQ && !a.date) { await ui.info("Что удалить?", "Назовите событие или напоминание, например: «убери падел по вторникам»"); return null }
    const okDay = d => !a.days || a.days.includes(new Date(d).getDay())
    const now = new Date()
    const from = a.date ? sod(a.date) : sod(now), to = a.date ? addDays(sod(a.date), 1) : addDays(now, 60)
    const evs = a.what === "reminders" ? [] : (events(from, to) || []).filter(e => okDay(e.start) && (!hasQ || core.titleMatches(e.title, a.query)))
    // повторяющееся событие без даты удаляется целиком, один раз
    const seen = new Set()
    a.events = evs.filter(e => a.date || !e.recurring || (seen.has(e.id) ? false : seen.add(e.id)))
    a.reminders = a.what === "events" ? [] : openReminders().filter(r =>
      (!hasQ || core.titleMatches(r.title, a.query)) && (!a.days || (r.due != null && okDay(r.due))) &&
      (!a.date || (r.due != null && sameDay(r.due, a.date))))
    if (!a.events.length && !a.reminders.length) {
      await ui.info("Нечего удалять", `Не нашёл «${a.query || "…"}»` +
        `${a.days ? " " + core.recurLabel({ freq: "weekly", days: a.days }) : ""} в календаре и напоминаниях.`)
      return null
    }
    return a
  }
  if (a.kind === "note" && !a.title) { a.title = await ui.ask("📝 Заметка", "Текст заметки"); if (!a.title) return null }
  if (a.kind === "event" && (!a.date || !a.hasTime)) {
    const t = await ui.ask(`📅 ${a.title}`, "Когда? Например: «завтра в 15:00», «в пятницу с 19 до 21», «25 октября в 11»")
    if (!t) return null
    const w = core.parseWhen(" " + core.normalizeSpeech(t) + " ", a.date ? sod(a.date) : null)
    if (!w.date) { await ui.info("Не понял время", t); return null }
    a.date = w.date; a.hasTime = true
    if (w.minutes) a.minutes = w.minutes
    if (w.recur) a.recur = w.recur
  }
  if (a.kind === "expense" || a.kind === "income") {
    const label = `${core.TYPE[a.kind]}${a.comment ? ": " + a.comment : ""}`
    if (!a.amount) {
      const t = await ui.ask(label, `Сумма ${core.CONFIG.currencyIn}`, "", { type: "number" })
      a.amount = t ? parseFloat(core.normalizeSpeech(t).replace(/[^\d.,]/g, "").replace(",", ".")) : NaN
      if (!(a.amount > 0)) return null
    }
    if (!a.method) {
      const i = await ui.choose(label, `${core.money(a.amount)} — наличные или перевод?`, ["💵 Наличные", "💳 Перевод / карта"])
      if (i < 0) return null
      a.method = i === 0 ? "cash" : "transfer"
    }
    if (!a.category) {
      const names = core.CONFIG.categories[a.kind].map(c => c[0])
      const i = await ui.choose(label, `${core.money(a.amount)} — категория`, names)
      if (i < 0) return null
      a.category = names[i]
    }
  }
  return a
}

async function executeAll(list) {
  let report = false
  for (const a of list) {
    if (a.kind === "event") await addEvent(a)
    else if (a.kind === "reminder") addReminder(a)
    else if (a.kind === "delete") {
      for (const e of a.events) {
        if (e.recurring && a.date) A.deleteOccurrence(e.id, +e.start)
        else A.deleteEvent(e.id)
      }
      const ids = new Set(a.reminders.map(r => r.id))
      D.reminders = D.reminders.filter(r => !ids.has(r.id))
      dropCalCache()
    } else if (a.kind === "move") {
      const dur = a.event.endDate - a.event.startDate
      const r = A.moveEvent(a.event.id, +a.event.startDate, +a.newStart, +a.newStart + dur)
      if (r === "noperm") { await askPermission("calendar"); A.moveEvent(a.event.id, +a.event.startDate, +a.newStart, +a.newStart + dur) }
      else if (r !== "ok") await ui.info("Не удалось перенести", a.event.title)
      dropCalCache()
    } else if (a.kind === "done") {
      const r = D.reminders.find(x => x.id === a.reminder.id)
      if (r) completeReminder(r)
    } else if (a.kind === "note") {
      D.notes.push({ id: uid("n"), text: a.title, date: Date.now(), u: Date.now() })
    } else if (a.kind === "report") {
      report = true
    } else if (a.kind === "expense" || a.kind === "income") {
      D.money.push({ id: uid("f"), date: a.at || Date.now(), u: Date.now(),
        type: a.kind, amount: a.amount, method: a.method, category: a.category, comment: a.comment || "" })
    }
  }
  save()
  render()
  if (report) { setTab("money"); showReport() }
}

const EXAMPLES = [
  "завтра в 10 встреча с Олей",
  "каждый вторник в 19 падел",
  "напомни в 18 купить цветы",
  "потратил 300 на такси наличными",
  "получил зарплату 50 000 переводом",
  "заметка: идея подарка — книга",
  "перенеси встречу с Олей на пятницу в 15",
  "убери падел по вторникам",
  "что у меня завтра?",
  "сколько я потратил на кафе?",
  "выполнил купить цветы",
]

async function voiceCommand(given, fromWidget) {
  let heard = given
  if (heard == null) heard = await listen()
  while (heard == null || heard === "__MIC__") {
    if (heard === "__MIC__") { heard = await listen(); if (heard != null) break }
    heard = await ui.ask("🎤 Команда", "Скажите или напишите. Можно несколько сразу: «завтра в 10 встреча с Олей, потратил 300 на такси и напомни в 18 купить цветы»",
      "", { multiline: true, mic: true, ok: "Разобрать" })
    if (heard == null) return false
  }
  if (!heard.trim()) return false
  let actions = core.buildActions(core.splitCommands(core.normalizeSpeech(heard)))
  if (!actions.length) actions = [{ kind: null, raw: heard }]
  if (actions.length === 1 && actions[0].kind === "report") { setTab("money"); showReport(); return false }

  const ready = []
  for (const a of actions) { const r = await completeAction(a); if (r) ready.push(r) }
  if (!ready.length) return false
  const one = ready.length === 1
  const b = await ui.confirm(one ? "Сохранить?" : `Сохранить ${ready.length} ${core.plural(ready.length)}?`,
    `<div class="cmd-list">${esc(ready.map(core.describe).join("\n"))}</div><div class="heard">🎤 «${esc(heard)}»</div>`,
    ["Отмена", "Исправить", one ? "Сохранить" : "Сохранить всё"])
  if (b === "Исправить") {
    const t = await ui.ask("Исправить команду", "", heard, { multiline: true, ok: "Разобрать" })
    return t ? voiceCommand(t, fromWidget) : false
  }
  if (b === "Сохранить" || b === "Сохранить всё") {
    await executeAll(ready)
    toast("Сохранено ✓")
    return true
  }
  return false
}

// ───────────── Формы ─────────────
const visibleMoney = () => D.money.filter(e => !e.deleted)

function moneyForm(type, entry) {
  return new Promise(res => {
    const e = entry || { type, amount: "", method: "cash", category: "", comment: "", date: Date.now() }
    type = e.type
    const cats = core.CONFIG.categories[type].map(c => c[0])
    let cat = e.category, method = e.method, manualCat = !!entry
    const s = sheet(`<h3>${entry ? "Изменить" : type === "expense" ? "➖ Расход" : "➕ Доход"}</h3>
      <div class="field"><input id="m-amt" class="huge" type="number" inputmode="decimal" placeholder="0 ${esc(core.CONFIG.currency)}" value="${e.amount}"></div>
      <div class="field"><input id="m-com" placeholder="Комментарий: такси, кафе, зарплата…" value="${esc(e.comment)}"></div>
      <div class="field"><div class="seg" id="m-meth"><button data-m="cash">💵 Наличные</button><button data-m="transfer">💳 Перевод / карта</button></div></div>
      <div class="field"><label>Категория</label><div class="chips" id="m-cats">${cats.map(c => `<button class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
      <div class="field"><label>Дата</label><input id="m-date" type="date" value="${dayKey(new Date(e.date))}"></div>
      <div class="btns">${entry ? '<button class="btn red" data-a="del">Удалить</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`,
    { onClose: () => res(done) })
    let done = false
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
    if (entry) $('[data-a="del"]', s.el).onclick = () => {
      D.money = D.money.filter(x => x.id !== entry.id); save(); done = true; s.close(); render()
    }
    $('[data-a="ok"]', s.el).onclick = () => {
      const amount = parseFloat(String($("#m-amt", s.el).value).replace(",", "."))
      if (!(amount > 0)) { toast("Введите сумму"); return }
      const dv = $("#m-date", s.el).value
      let date = e.date
      if (dv && dv !== dayKey(new Date(e.date))) { const [y, m, d] = dv.split("-").map(Number); const x = new Date(); date = +new Date(y, m - 1, d, x.getHours(), x.getMinutes()) }
      const rec = Object.assign(entry || { id: uid("f") }, { type, amount, method, category: cat || cats[cats.length - 1],
        comment: $("#m-com", s.el).value.trim(), date, u: Date.now() })
      if (!entry) D.money.push(rec)
      save(); done = true; s.close(); render()
      toast(`${type === "expense" ? "−" : "+"}${core.money(amount)} · ${rec.category}`)
    }
  })
}

function reminderForm(r) {
  return new Promise(res => {
    let done = false
    const when = r && r.due != null ? `${dayName(new Date(r.due))}${r.time ? " в " + hm(new Date(r.due)) : ""}` : ""
    const s = sheet(`<h3>${r ? "Напоминание" : "⏰ Новое напоминание"}</h3>
      <div class="field"><input id="r-t" placeholder="Что сделать?" value="${esc(r ? r.title : "")}"></div>
      <div class="field"><label>Когда (можно пусто)</label><input id="r-w" placeholder="завтра в 9, в пятницу в 18:30, каждый день в 8" value="${esc(when)}"></div>
      <div class="btns">${r ? '<button class="btn red" data-a="del">Удалить</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`,
    { onClose: () => res(done) })
    if (!r) setTimeout(() => $("#r-t", s.el).focus(), 250)
    $('[data-a="no"]', s.el).onclick = () => s.close()
    if (r) $('[data-a="del"]', s.el).onclick = () => { D.reminders = D.reminders.filter(x => x.id !== r.id); save(); done = true; s.close(); render() }
    $('[data-a="ok"]', s.el).onclick = () => {
      const title = $("#r-t", s.el).value.trim()
      if (!title) { toast("Напишите, что напомнить"); return }
      const wtext = $("#r-w", s.el).value.trim()
      let due = null, recur = null
      if (wtext && wtext !== when) {
        const w = core.parseWhen(" " + core.normalizeSpeech(wtext) + " ")
        if (!w.date) { toast("Не понял, когда. Например: «завтра в 9»"); return }
        due = +w.date; recur = w.recur || null
      } else if (r) { due = r.due; recur = r.recur || null }
      if (r) Object.assign(r, { title, due, time: due != null, recur, u: Date.now() })
      else D.reminders.push({ id: uid("r"), title, due, time: due != null, recur, done: false, u: Date.now() })
      save(); done = true; s.close(); render()
      if (due != null && !A.canNotify()) askPermission("notify")
    }
  })
}

function noteForm(n) {
  return new Promise(res => {
    let done = false
    const s = sheet(`<h3>${n ? "Заметка" : "📝 Новая заметка"}</h3>
      <div class="field"><textarea id="n-t" placeholder="Что запомнить?">${esc(n ? n.text : "")}</textarea></div>
      ${n ? `<div class="muted small">${esc(shortDate(new Date(n.date)))}, ${hm(new Date(n.date))}</div>` : ""}
      <div class="btns">${n ? '<button class="btn red" data-a="del">Удалить</button><button class="btn" data-a="share">Отправить</button>' : '<button class="btn" data-a="no">Отмена</button>'}<button class="btn primary" data-a="ok">Сохранить</button></div>`,
    { onClose: () => res(done) })
    if (!n) setTimeout(() => $("#n-t", s.el).focus(), 250)
    const no = $('[data-a="no"]', s.el); if (no) no.onclick = () => s.close()
    if (n) {
      $('[data-a="del"]', s.el).onclick = () => { D.notes = D.notes.filter(x => x.id !== n.id); save(); done = true; s.close(); render() }
      $('[data-a="share"]', s.el).onclick = () => A.share(n.text)
    }
    $('[data-a="ok"]', s.el).onclick = () => {
      const text = $("#n-t", s.el).value.trim()
      if (!text) { s.close(); return }
      if (n) Object.assign(n, { text, u: Date.now() })
      else D.notes.push({ id: uid("n"), text, date: Date.now(), u: Date.now() })
      save(); done = true; s.close(); render()
    }
  })
}

function foodForm(f) {
  return new Promise(res => {
    let done = false
    const recent = []
    for (const x of D.food.slice().reverse()) if (!recent.some(r => r.name.toLowerCase() === x.name.toLowerCase())) recent.push(x)
    const s = sheet(`<h3>${f ? "Еда" : "🍽 Что съели?"}</h3>
      ${!f && recent.length ? `<div class="field"><label>Недавнее — нажмите, чтобы добавить</label><div class="chips">${recent.slice(0, 10).map((x, i) =>
        `<button class="chip" data-r="${i}">${esc(x.name)} · ${x.kcal}</button>`).join("")}</div></div>` : ""}
      <div class="field"><input id="f-n" placeholder="Блюдо: овсянка, борщ, кофе с молоком" value="${esc(f ? f.name : "")}"></div>
      <div class="field"><label>Калории, ккал</label><input id="f-k" type="number" inputmode="numeric" value="${f ? f.kcal : ""}" placeholder="350"></div>
      <div class="btns">${f ? '<button class="btn red" data-a="del">Удалить</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`,
    { onClose: () => res(done) })
    $('[data-a="no"]', s.el).onclick = () => s.close()
    $$("[data-r]", s.el).forEach(b => b.onclick = () => {
      const x = recent[+b.dataset.r]
      D.food.push({ id: uid("e"), name: x.name, kcal: x.kcal, date: Date.now(), u: Date.now() })
      save(); done = true; s.close(); render(); toast(`+${x.kcal} ккал · ${x.name}`)
    })
    if (f) $('[data-a="del"]', s.el).onclick = () => { D.food = D.food.filter(x => x.id !== f.id); save(); done = true; s.close(); render() }
    $('[data-a="ok"]', s.el).onclick = () => {
      const name = $("#f-n", s.el).value.trim() || "Еда"
      const kcal = Math.round(parseFloat($("#f-k", s.el).value))
      if (!(kcal >= 0)) { toast("Укажите калории"); return }
      if (f) Object.assign(f, { name, kcal, u: Date.now() })
      else D.food.push({ id: uid("e"), name, kcal, date: Date.now(), u: Date.now() })
      save(); done = true; s.close(); render()
    }
  })
}

// MET — сколько раз энергозатраты выше покоя: ккал ≈ MET × вес × часы
const SPORTS = [["Ходьба", 3.8], ["Бег", 9], ["Велосипед", 7], ["Плавание", 7], ["Зал", 5], ["Йога", 3], ["Падел / теннис", 7], ["Танцы", 5], ["Другое", 4.5]]
function workoutForm(w) {
  return new Promise(res => {
    let done = false, sport = w ? w.type : SPORTS[0][0], edited = !!w
    const s = sheet(`<h3>${w ? "Тренировка" : "🏃 Тренировка"}</h3>
      <div class="field"><div class="chips" id="w-s">${SPORTS.map(x => `<button class="chip" data-s="${esc(x[0])}">${esc(x[0])}</button>`).join("")}</div></div>
      <div class="field"><label>Минут</label><input id="w-m" type="number" inputmode="numeric" value="${w ? w.minutes : 30}"></div>
      <div class="field"><label>Сожжено, ккал (примерно, по весу ${D.settings.weight} кг)</label><input id="w-k" type="number" inputmode="numeric" value="${w ? w.kcal : ""}"></div>
      <div class="btns">${w ? '<button class="btn red" data-a="del">Удалить</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`,
    { onClose: () => res(done) })
    const est = () => {
      if (edited) return
      const met = (SPORTS.find(x => x[0] === sport) || SPORTS[SPORTS.length - 1])[1]
      $("#w-k", s.el).value = Math.round(met * D.settings.weight * (+$("#w-m", s.el).value || 0) / 60)
    }
    const paint = () => $$("#w-s .chip", s.el).forEach(b => b.classList.toggle("on", b.dataset.s === sport))
    paint(); est()
    $$("#w-s .chip", s.el).forEach(b => b.onclick = () => { sport = b.dataset.s; edited = false; paint(); est() })
    $("#w-m", s.el).oninput = est
    $("#w-k", s.el).oninput = () => { edited = true }
    $('[data-a="no"]', s.el).onclick = () => s.close()
    if (w) $('[data-a="del"]', s.el).onclick = () => { D.workouts = D.workouts.filter(x => x.id !== w.id); save(); done = true; s.close(); render() }
    $('[data-a="ok"]', s.el).onclick = () => {
      const minutes = Math.round(+$("#w-m", s.el).value), kcal = Math.round(+$("#w-k", s.el).value)
      if (!(minutes > 0)) { toast("Укажите минуты"); return }
      if (w) Object.assign(w, { type: sport, minutes, kcal, u: Date.now() })
      else D.workouts.push({ id: uid("w"), type: sport, minutes, kcal, date: Date.now(), u: Date.now() })
      save(); done = true; s.close(); render()
    }
  })
}

async function addMenu() {
  const opts = [["🎤 Голосом / текстом", () => voiceCommand()], ["⏰ Напоминание", () => reminderForm()], ["📅 Событие в календарь", () => eventForm()],
    ["📝 Заметка", () => noteForm()], ["➖ Расход", () => moneyForm("expense")], ["➕ Доход", () => moneyForm("income")],
    ["🍽 Еда", () => foodForm()], ["💧 Стакан воды", async () => { addWater(D.settings.glass); return true }], ["🏃 Тренировка", () => workoutForm()]]
  const i = await ui.choose("Добавить", "", opts.map(o => o[0]))
  return i >= 0 ? opts[i][1]() : false
}

async function eventForm() {
  const t = await ui.ask("📅 Событие", "Название и время одной фразой: «завтра в 15 стоматолог», «в субботу с 12 до 14 обед с родителями»", "", { ok: "Дальше" })
  if (!t) return false
  const a = core.buildActions([{ text: t, kind: "event" }])[0]
  return voiceCommandFromActions([a], t)
}
async function voiceCommandFromActions(actions, heard) {
  const ready = []
  for (const a of actions) { const r = await completeAction(a); if (r) ready.push(r) }
  if (!ready.length) return false
  const b = await ui.confirm("Сохранить?", `<div class="cmd-list">${esc(ready.map(core.describe).join("\n"))}</div>`, ["Отмена", "Сохранить"])
  if (b !== "Сохранить") return false
  await executeAll(ready)
  return true
}

// ───────────── Вода ─────────────
function addWater(ml) {
  const k = dayKey(new Date())
  D.water[k] = Math.max(0, (D.water[k] || 0) + ml)
  save(); render()
  if (ml > 0) toast(`💧 +${ml} мл · сегодня ${liters(D.water[k])} л`)
}

// ───────────── Экраны ─────────────
let tab = "today", selDay = sod(new Date()), monthKey = null

function setTab(t) {
  tab = t
  $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === t))
  render()
  window.scrollTo(0, 0)
}

function render() {
  const fn = { today: renderToday, money: renderMoney, health: renderHealth, more: renderMore }[tab]
  $("#view").innerHTML = fn()
  bind()
}

function todayKcal(day = new Date()) {
  return D.food.filter(f => sameDay(f.date, day)).reduce((s, f) => s + (+f.kcal || 0), 0)
}
function todayBurn(day = new Date()) {
  return D.workouts.filter(w => sameDay(w.date, day)).reduce((s, w) => s + (+w.kcal || 0), 0)
}

function renderToday() {
  const today = sod(new Date())
  const isToday = sameDay(selDay, today)
  const week = events(today, addDays(today, 7))
  const counts = {}
  for (const e of week || []) for (let d = sod(e.start); d < e.end && d < addDays(today, 7); d = addDays(d, 1)) counts[dayKey(d)] = (counts[dayKey(d)] || 0) + 1
  for (const r of openReminders()) if (r.due != null) counts[dayKey(new Date(r.due))] = (counts[dayKey(new Date(r.due))] || 0) + 1

  $("#top-title").textContent = fullDate(new Date())
  const todayEvs = (week || []).filter(e => e.start < addDays(today, 1) && e.end > new Date())
  const remToday = openReminders().filter(r => r.due != null && r.due < +addDays(today, 1))
  $("#top-sub").textContent = week == null ? "Календарь не подключён" :
    `${todayEvs.length ? todayEvs.length + " " + plural(todayEvs.length, "событие", "события", "событий") : "Событий нет"}` +
    (remToday.length ? ` · ${remToday.length} ${plural(remToday.length, "напоминание", "напоминания", "напоминаний")}` : "")

  let html = `<div class="week">${[...Array(7)].map((_, i) => {
    const d = addDays(today, i), n = counts[dayKey(d)] || 0
    return `<button class="day ${sameDay(d, selDay) ? "on" : ""} ${d.getDay() % 6 === 0 ? "we" : ""}" data-day="${+d}">
      <div class="wd">${WD[d.getDay()]}</div><div class="dn">${d.getDate()}</div><div class="n">${n ? "•".repeat(Math.min(n, 4)) : ""}</div></button>`
  }).join("")}</div>`

  // события выбранного дня
  const dayEvs = (week || []).filter(e => e.start < addDays(selDay, 1) && e.end > selDay)
  html += `<div class="card"><h2>${isToday ? "Сегодня" : esc(core.cap(dayName(selDay)))}<button class="act" data-do="event">+ Событие</button></h2>`
  if (week == null) html += `<div class="empty">Разрешите доступ к календарю телефона — здесь появятся ваши встречи из Google Календаря и других.</div>
    <div class="btns" style="margin-top:10px"><button class="btn primary" data-do="perm-cal">Разрешить доступ к календарю</button></div>`
  else if (!dayEvs.length) html += `<div class="empty">${isToday ? "Событий больше нет 🎉" : "Ничего не запланировано"}</div>`
  else html += dayEvs.map(e => {
    const past = e.end < new Date()
    const t = e.allDay ? "весь день" : e.start < selDay ? "до " + hm(e.end) : hm(e.start)
    return `<div class="row" data-ev="${e.id}" data-b="${+e.start}" data-e="${+e.end}" style="${past ? "opacity:.5" : ""}">
      <div class="bar-l" style="background:${esc(e.color || "#1E9E8F")}"></div><div class="time" style="${e.allDay ? "font-size:11.5px" : ""}">${t}</div>
      <div class="grow"><div class="t">${esc(e.title || "(без названия)")}</div><div class="s">${e.allDay ? "" : hm(e.start) + "–" + hm(e.end)}${e.location ? " · " + esc(e.location) : ""}${e.calendar ? " · " + esc(e.calendar) : ""}</div></div></div>`
  }).join("")
  html += `</div>`

  // напоминания
  let rems = openReminders()
  if (isToday) rems = rems.filter(r => r.due == null || r.due < +addDays(today, 1))
  else rems = rems.filter(r => r.due != null && sameDay(r.due, selDay))
  rems.sort((a, b) => (a.due == null) - (b.due == null) || (a.due || 0) - (b.due || 0))
  html += `<div class="card"><h2>Напоминания<button class="act" data-do="reminder">+ Добавить</button></h2>`
  html += rems.length ? rems.map(r => `<div class="row" data-rem="${r.id}"><button class="check ${isLate(r) ? "late" : ""}" data-check="${r.id}"></button>
    <div class="grow" data-open-rem="${r.id}"><div class="t">${esc(r.title)}</div>${r.due != null || r.recur ? `<div class="s ${isLate(r) ? "exp" : ""}">${esc(reminderLabel(r))}${r.recur ? " · 🔁 " + esc(core.recurLabel(r.recur)) : ""}</div>` : ""}</div></div>`).join("")
    : `<div class="empty">${isToday ? "Всё сделано" : "На этот день напоминаний нет"}</div>`
  const later = isToday ? openReminders().filter(r => r.due != null && r.due >= +addDays(today, 1)).length : 0
  if (later) html += `<div class="muted small" style="margin-top:6px">Ещё ${later} ${plural(later, "напоминание", "напоминания", "напоминаний")} позже — выберите день вверху</div>`
  html += `</div>`

  if (isToday) {
    const ml = D.water[dayKey(today)] || 0, kcal = todayKcal(), burn = todayBurn()
    const t = core.monthTotals(visibleMoney(), core.monthKey(today))
    const spentToday = visibleMoney().filter(e => e.type === "expense" && sameDay(e.date, today)).reduce((s, e) => s + e.amount, 0)
    html += `<div class="card"><h2>За день</h2><div class="stats">
      <button class="stat" data-do="water"><div class="v">💧 ${liters(ml)} л</div><div class="l">из ${liters(D.settings.waterGoal)} · +стакан</div><div class="prog"><div style="width:${Math.min(100, ml / D.settings.waterGoal * 100)}%"></div></div></button>
      <button class="stat" data-do="food"><div class="v">🍽 ${num(kcal)}</div><div class="l">ккал${burn ? ` · −${num(burn)} спорт` : ""}</div><div class="prog gold"><div style="width:${Math.min(100, kcal / D.settings.kcalGoal * 100)}%"></div></div></button>
      <button class="stat" data-do="tab-money"><div class="v">−${num(spentToday)}</div><div class="l">${esc(core.CONFIG.currency)} сегодня · −${num(t.expense)} за месяц</div></button>
    </div></div>`
  }

  const notes = D.notes.slice().sort((a, b) => b.date - a.date)
  html += `<div class="card"><h2>Заметки<button class="act" data-do="note">+ Добавить</button></h2>`
  html += notes.length ? notes.slice(0, isToday ? 5 : 3).map(n => `<div class="row" data-note="${n.id}"><div class="grow"><div class="t" style="white-space:pre-wrap">${esc(n.text)}</div>
    <div class="s">${esc(dayName(new Date(n.date)))}, ${hm(new Date(n.date))}</div></div></div>`).join("") +
    (notes.length > 5 ? `<button class="btn small" data-do="all-notes" style="margin-top:8px">Все заметки (${notes.length})</button>` : "")
    : `<div class="empty">Скажите «заметка: …» или нажмите «+ Добавить»</div>`
  html += `</div>`
  return html
}

function renderMoney() {
  const now = new Date()
  monthKey = monthKey || core.monthKey(now)
  const list = visibleMoney()
  const t = core.monthTotals(list, monthKey)
  const bal = t.income - t.expense
  $("#top-title").textContent = "Деньги"
  $("#top-sub").textContent = `${core.monthTitle(monthKey)} · баланс ${bal < 0 ? "−" : "+"}${core.money(bal)}`
  const [y, m] = monthKey.split("-").map(Number)
  let html = `<div class="month"><button data-mon="-1">‹</button><b>${esc(core.monthTitle(monthKey))}</b><button data-mon="1" ${monthKey >= core.monthKey(now) ? "disabled style=opacity:.3" : ""}>›</button></div>
    <div class="card"><div class="totals">
      <div><div class="muted small">Расходы</div><div class="big exp">−${esc(core.money(t.expense))}</div></div>
      <div><div class="muted small">Доходы</div><div class="big inc">+${esc(core.money(t.income))}</div></div>
      <div class="muted small">💵 −${num(t.cash.expense)} · 💳 −${num(t.transfer.expense)}</div>
      <div class="muted small">Баланс ${bal < 0 ? "−" : "+"}${esc(core.money(bal))}</div>
    </div><div class="btns" style="margin-top:12px"><button class="btn primary" data-do="expense">− Расход</button><button class="btn teal" data-do="income">+ Доход</button></div></div>`
  const cats = Object.entries(t.cats.expense).sort((a, b) => b[1] - a[1])
  if (cats.length) {
    html += `<div class="card"><h2>Куда ушли деньги</h2>` + cats.map(([n, v]) => `<div class="cat"><div class="top"><span>${esc(n)}</span><b>${esc(core.money(v))}</b></div>
      <div class="prog gold"><div style="width:${v / cats[0][1] * 100}%"></div></div></div>`).join("") + `</div>`
  }
  const items = t.items.slice().reverse()
  html += `<div class="card"><h2>Операции<span class="muted small" style="text-transform:none;letter-spacing:0">${items.length}</span></h2>`
  if (!items.length) html += `<div class="empty">Скажите «потратил 300 на такси» или нажмите «− Расход»</div>`
  let last = ""
  for (const e of items) {
    const d = new Date(e.date), k = dayKey(d)
    if (k !== last) { html += `<div class="day-h">${esc(core.cap(dayName(d)))}</div>`; last = k }
    html += `<div class="row" data-money="${e.id}"><div class="grow"><div class="t">${esc(e.category)}</div>
      <div class="s">${e.method === "cash" ? "💵 нал" : "💳 перевод"}${e.comment ? " · " + esc(e.comment) : ""}</div></div>
      <div class="amt ${e.type === "expense" ? "exp" : "inc"}">${e.type === "expense" ? "−" : "+"}${esc(core.money(e.amount))}</div></div>`
  }
  html += `</div><div class="btns"><button class="btn" data-do="report">📊 Отчёт за месяц</button><button class="btn" data-do="csv">⬇︎ Таблица CSV</button></div>`
  return html
}

function ring(p, color, label, sub) {
  const r = 40, c = 2 * Math.PI * r
  return `<div class="ring"><svg viewBox="0 0 92 92" width="92" height="92"><circle cx="46" cy="46" r="${r}" fill="none" stroke="var(--track)" stroke-width="9"/>
    <circle cx="46" cy="46" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, p))}"/></svg>
    <div class="c"><b>${label}</b><span>${sub}</span></div></div>`
}

function renderHealth() {
  const today = sod(new Date()), st = D.settings
  const ml = D.water[dayKey(today)] || 0, kcal = todayKcal(), burn = todayBurn()
  $("#top-title").textContent = "Здоровье"
  $("#top-sub").textContent = `Сегодня: ${num(kcal)} ккал · ${liters(ml)} л воды${burn ? ` · спорт −${num(burn)} ккал` : ""}`
  let html = `<div class="card"><h2>Вода</h2><div class="ring-row">${ring(ml / st.waterGoal, "var(--teal)", liters(ml) + " л", "из " + liters(st.waterGoal))}
    <div style="flex:1"><div class="btns"><button class="btn teal" data-water="${st.glass}">+ Стакан ${st.glass} мл</button></div>
    <div class="btns" style="margin-top:8px"><button class="btn small" data-water="500">+500</button><button class="btn small" data-water="other">Другое</button><button class="btn small" data-water="-${st.glass}">−${st.glass}</button></div></div></div></div>`

  const food = D.food.filter(f => sameDay(f.date, today)).sort((a, b) => a.date - b.date)
  html += `<div class="card"><h2>Еда<button class="act" data-do="food">+ Добавить</button></h2><div class="ring-row">
    ${ring(kcal / st.kcalGoal, kcal > st.kcalGoal ? "var(--red)" : "var(--gold)", num(kcal), "из " + num(st.kcalGoal))}
    <div style="flex:1" class="small muted">Осталось: <b style="color:var(--text)">${num(Math.max(0, st.kcalGoal - kcal + burn))} ккал</b><br>${burn ? `Спорт добавил ${num(burn)} ккал к цели<br>` : ""}Калории вписываются вручную — без интернета фото не распознаётся.</div></div>`
  html += food.map(f => `<div class="row" data-food="${f.id}"><div class="time">${hm(new Date(f.date))}</div><div class="grow"><div class="t">${esc(f.name)}</div></div><div class="amt">${num(f.kcal)}</div></div>`).join("")
  html += `</div>`

  const wk = D.workouts.filter(w => sameDay(w.date, today))
  html += `<div class="card"><h2>Активность<button class="act" data-do="workout">+ Тренировка</button></h2>`
  html += wk.length ? wk.map(w => `<div class="row" data-wk="${w.id}"><div class="time">${hm(new Date(w.date))}</div><div class="grow"><div class="t">${esc(w.type)}</div><div class="s">${w.minutes} мин</div></div><div class="amt">−${num(w.kcal)}</div></div>`).join("")
    : `<div class="empty">Сегодня тренировок нет</div>`
  html += `</div>`

  const days = [...Array(7)].map((_, i) => addDays(today, i - 6))
  const kc = days.map(d => todayKcal(d)), wa = days.map(d => D.water[dayKey(d)] || 0)
  const mk = Math.max(1, ...kc), mw = Math.max(1, ...wa)
  html += `<div class="card"><h2>Неделя: калории</h2><div class="chart">${days.map((d, i) => `<div class="col"><div class="lbl">${kc[i] ? num(kc[i]) : ""}</div><div class="b" style="height:${kc[i] / mk * 100}%"></div><div class="lbl">${WD[d.getDay()]}</div></div>`).join("")}</div></div>`
  html += `<div class="card"><h2>Неделя: вода</h2><div class="chart">${days.map((d, i) => `<div class="col"><div class="lbl">${wa[i] ? liters(wa[i]) : ""}</div><div class="b w" style="height:${wa[i] / mw * 100}%"></div><div class="lbl">${WD[d.getDay()]}</div></div>`).join("")}</div></div>`
  return html
}

function renderMore() {
  const st = D.settings
  $("#top-title").textContent = "Настройки"
  $("#top-sub").textContent = "Всё хранится только на этом телефоне"
  const cal = A.hasCalendar(), ntf = A.canNotify()
  return `<div class="card"><h2>Страна и валюта</h2><div class="seg" id="prof">${Object.entries(PROFILES).map(([k, p]) =>
      `<button data-prof="${k}" class="${st.profile === k ? "on" : ""}">${p.name} ${p.currency}</button>`).join("")}</div>
    <div class="muted small" style="margin-top:8px">Меняет значок валюты и категории расходов (магазины, сервисы). Уже записанные суммы не пересчитываются.</div></div>
  <div class="card"><h2>Цели</h2>
    <div class="set"><span>Вода в день, мл</span><input type="number" data-set="waterGoal" value="${st.waterGoal}"></div>
    <div class="set"><span>Стакан, мл</span><input type="number" data-set="glass" value="${st.glass}"></div>
    <div class="set"><span>Калории в день, ккал</span><input type="number" data-set="kcalGoal" value="${st.kcalGoal}"></div>
    <div class="set"><span>Вес, кг (для тренировок)</span><input type="number" data-set="weight" value="${st.weight}"></div></div>
  <div class="card"><h2>Доступы</h2>
    <div class="set"><span>Календарь телефона</span>${cal ? '<span class="ok">✓ Есть</span>' : '<button class="btn small primary" data-do="perm-cal">Разрешить</button>'}</div>
    <div class="set"><span>Уведомления о напоминаниях</span>${ntf ? '<span class="ok">✓ Есть</span>' : '<button class="btn small primary" data-do="perm-notify">Разрешить</button>'}</div></div>
  <div class="card"><h2>Резервная копия</h2>
    <div class="muted small" style="margin-bottom:10px">Сохраните файл в «Загрузки» или Google Диск — по нему можно перенести всё на новый телефон.</div>
    <div class="btns"><button class="btn" data-do="backup">⬇︎ Сохранить копию</button><button class="btn" data-do="restore">⬆︎ Восстановить</button></div></div>
  <div class="card"><h2>Голосовые команды</h2><div class="muted small">Нажмите оранжевую кнопку 🎤 и скажите, например:</div>
    <ul class="help">${EXAMPLES.map(e => `<li>«${esc(e)}»</li>`).join("")}</ul>
    <div class="muted small">Чтобы голос работал без интернета: Настройки телефона → Google → Голосовой ввод (или «Распознавание речи офлайн») → скачайте русский язык.</div></div>
  <div class="card"><h2>Виджет</h2><div class="muted small">Долгое нажатие на пустом месте рабочего стола → Виджеты → «Мой день». Кнопки виджета: 🎤 команда, ${esc(core.CONFIG.currency)} расход, 💧 стакан воды (сразу, без открытия), + добавить.</div></div>
  <div class="muted small" style="text-align:center;margin:14px 0">Мой день для Android · версия ${esc(A.version())}</div>`
}

function allNotes() {
  const notes = D.notes.slice().sort((a, b) => b.date - a.date)
  const s = sheet(`<h3>Заметки</h3>` + notes.map(n => `<div class="row" data-note="${n.id}"><div class="grow"><div class="t" style="white-space:pre-wrap">${esc(n.text)}</div>
    <div class="s">${esc(dayName(new Date(n.date)))}, ${hm(new Date(n.date))}</div></div></div>`).join(""))
  $$("[data-note]", s.el).forEach(el => el.onclick = () => { s.close(); noteForm(D.notes.find(n => n.id === el.dataset.note)) })
}

function showReport() {
  const html = core.reportHTML(monthKey || core.monthKey(new Date()), visibleMoney())
  const s = sheet(`<h3>Отчёт · ${esc(core.monthTitle(monthKey || core.monthKey(new Date())))}</h3><iframe class="report"></iframe>
    <div class="btns"><button class="btn" data-a="share">Отправить текстом</button><button class="btn primary" data-a="close">Закрыть</button></div>`)
  $("iframe", s.el).srcdoc = html
  $('[data-a="close"]', s.el).onclick = () => s.close()
  $('[data-a="share"]', s.el).onclick = () => A.share(core.reportText(monthKey || core.monthKey(new Date()), visibleMoney()))
}

function bind() {
  const v = $("#view")
  $$("[data-day]", v).forEach(b => b.onclick = () => { selDay = new Date(+b.dataset.day); render() })
  $$("[data-ev]", v).forEach(el => el.onclick = () => A.openEvent(+el.dataset.ev, +el.dataset.b, +el.dataset.e))
  $$("[data-check]", v).forEach(b => b.onclick = ev => {
    ev.stopPropagation()
    const r = D.reminders.find(x => x.id === b.dataset.check)
    if (!r) return
    b.classList.add("on")
    b.closest(".row").classList.add("done-anim")
    completeReminder(r)
    save()
    toast(r.done ? "✓ Выполнено" : `✓ Следующее: ${reminderLabel(r)}`)
    setTimeout(render, 380)
  })
  $$("[data-open-rem]", v).forEach(el => el.onclick = () => reminderForm(D.reminders.find(r => r.id === el.dataset.openRem)))
  $$("[data-note]", v).forEach(el => el.onclick = () => noteForm(D.notes.find(n => n.id === el.dataset.note)))
  $$("[data-money]", v).forEach(el => el.onclick = () => moneyForm(null, D.money.find(e => e.id === el.dataset.money)))
  $$("[data-food]", v).forEach(el => el.onclick = () => foodForm(D.food.find(e => e.id === el.dataset.food)))
  $$("[data-wk]", v).forEach(el => el.onclick = () => workoutForm(D.workouts.find(e => e.id === el.dataset.wk)))
  $$("[data-mon]", v).forEach(b => b.onclick = () => {
    const [y, m] = monthKey.split("-").map(Number)
    monthKey = core.monthKey(new Date(y, m - 1 + +b.dataset.mon, 1)); render()
  })
  $$("[data-water]", v).forEach(b => b.onclick = async () => {
    if (b.dataset.water === "other") {
      const t = await ui.ask("💧 Сколько выпили?", "В миллилитрах", "", { type: "number" })
      if (t && +t) addWater(Math.round(+t))
    } else addWater(+b.dataset.water)
  })
  $$("[data-prof]", v).forEach(b => b.onclick = () => { D.settings.profile = b.dataset.prof; core = window.CORES[b.dataset.prof]; D.settings.currency = core.CONFIG.currency; save(); render() })
  $$("[data-set]", v).forEach(inp => inp.onchange = () => {
    const n = Math.round(+inp.value)
    if (n > 0) { D.settings[inp.dataset.set] = n; save(); toast("Сохранено") } else inp.value = D.settings[inp.dataset.set]
  })
  $$("[data-do]", v).forEach(b => b.onclick = () => DO[b.dataset.do]())
}

const DO = {
  event: () => eventForm(), reminder: () => reminderForm(), note: () => noteForm(), food: () => foodForm(), workout: () => workoutForm(),
  expense: () => moneyForm("expense"), income: () => moneyForm("income"), water: () => addWater(D.settings.glass),
  "tab-money": () => setTab("money"), "all-notes": () => allNotes(), report: () => showReport(),
  "perm-cal": async () => { await askPermission("calendar"); dropCalCache(); render() },
  "perm-notify": async () => { await askPermission("notify"); render() },
  csv: () => {
    const key = monthKey || core.monthKey(new Date())
    A.exportFile(`Мой день — деньги ${key}.csv`, "text/csv", "﻿" + core.reportCSV(key, visibleMoney()))
  },
  backup: () => A.exportFile(`Мой день — копия ${dayKey(new Date())}.json`, "application/json", JSON.stringify(D)),
  restore: () => A.importFile(),
}

// ───────────── Первый запуск ─────────────
async function welcome() {
  const s = sheet(`<h3>Добро пожаловать в «Мой день»</h3>
    <div class="msg">Календарь, напоминания, заметки, деньги, вода и еда — в одном месте. Всё хранится на телефоне и работает без интернета.\n\nГде вы живёте? От этого зависят валюта и категории расходов.</div>
    ${Object.entries(PROFILES).map(([k, p]) => `<button class="opt" data-p="${k}">${p.name} · ${p.currency}</button>`).join("")}`)
  await new Promise(res => $$("[data-p]", s.el).forEach(b => b.onclick = () => {
    D.settings.profile = b.dataset.p; core = window.CORES[b.dataset.p]; D.settings.currency = core.CONFIG.currency
    save(); s.close(); res()
  }))
  await ui.info("Два разрешения", "Сейчас телефон спросит доступ к календарю (чтобы показывать и добавлять встречи) и к уведомлениям (чтобы напоминать вовремя). Их можно дать и позже — в «Ещё».")
  await askPermission("calendar notify")
  dropCalCache()
  render()
}

// ───────────── Вызовы из Android ─────────────
let fromWidget = false
const app = window.app = {
  reload() { if (stack.length) return; load(); dropCalCache(); if (selDay < sod(new Date())) selDay = sod(new Date()); render() },
  back() {
    if (stack.length) { stack[stack.length - 1].close(); return true }
    if (tab !== "today") { setTab("today"); return true }
    return false
  },
  onSpeech(text) { const w = speechWait; speechWait = null; if (w) w(text == null ? null : String(text)) },
  onPermissions() { const w = permWait; permWait = null; dropCalCache(); if (w) w(); else render() },
  onImport(text) {
    let d
    try { d = JSON.parse(text) } catch (e) { return ui.info("Не тот файл", "Это не копия «Моего дня».") }
    if (!d || !Array.isArray(d.money) || !d.settings) return ui.info("Не тот файл", "Это не копия «Моего дня».")
    ui.confirm("Восстановить копию?", `<div class="msg">${d.money.length} операций, ${(d.reminders || []).length} напоминаний, ${(d.notes || []).length} заметок. Текущие данные на телефоне заменятся.</div>`, ["Отмена", "Восстановить"])
      .then(b => { if (b === "Восстановить") { A.save(JSON.stringify(d)); load(); render(); toast("Копия восстановлена") } })
  },
  async action(a) {
    while (stack.length) stack[stack.length - 1].close()
    let done = false
    if (a === "voice") done = await voiceCommand(null, true)
    else if (a === "expense") done = await moneyForm("expense")
    else if (a === "add") done = await addMenu()
    else if (a === "health") { setTab("health"); return }
    // после операции с виджета — обратно на рабочий стол, как на iPhone
    if (done) setTimeout(() => A.home(), 700)
  },
}

// ───────────── Старт ─────────────
document.querySelectorAll("[data-ico]").forEach(i => i.innerHTML = ICO[i.dataset.ico])
$("#fab").innerHTML = ICO.mic
$("#fab").onclick = () => voiceCommand()
$$("#tabs button").forEach(b => b.onclick = () => setTab(b.dataset.tab))
load()
setTab("today")
const first = A.takeAction()
if (!D.settings.profile) welcome()
else if (first) app.action(first)
