// «Мой день» — веб-приложение для iPhone. Открывается с экрана «Домой» мгновенно и работает без Scriptable.
// Деньги, еда, вода и тренировки хранятся на телефоне и через Google Таблицу совпадают с виджетом.
// Календарь, напоминания и данные часов видит только iPhone: их присылает виджет (снимок), а новые события
// и напоминания приложение ставит в очередь — виджет вносит их в iPhone при обновлении.
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
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8.5 15l2 2 4-4"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M8.5 8.5h7M8.5 11.5h4.5"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="13" rx="3"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/></svg>',
  health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/><path d="M7 12h3l1.3-2.5L13 14l1.2-2H17"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>',
  sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9"/><path d="M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2"/></svg>',
}

// ───────────── Данные на телефоне ─────────────
// Записи — как в виджете: { id, date, u (время изменения), ... }; удалённые остаются «надгробиями» { id, deleted, u },
// чтобы удаление дошло до виджета и таблицы
const LISTS = { money: 0, food: 120, water: 60, workouts: 400 }
let D = {}
function load() {
  try { D = JSON.parse(localStorage.getItem(STORE) || "{}") || {} } catch (e) { D = {} }
  for (const k of [...Object.keys(LISTS), "chat", "ops"]) if (!Array.isArray(D[k])) D[k] = []
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
        const res = await hubPost({ since: D.sync.since, snapAt: D.sync.snapAt, lists, ops })
        for (const k of Object.keys(LISTS)) mergeIn(k, res.lists && res.lists[k])
        if (res.snap) { D.snap = res.snap; D.sync.snapAt = res.snap.at }
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
// Команда выполнена на iPhone: сообщить, если не вышло
function opDone(o) {
  if (o.result && o.result.error) toast(`iPhone: не получилось — ${o.result.error}`)
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
  let events = (snap.events || []).map(e => Object.assign({}, e))
  let reminders = (snap.reminders || []).map(r => Object.assign({}, r))
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
    if (o.tool === "create_reminder") reminders.push({ id: "op:" + o.id, title: x.title, due: x.due || null, list: x.list || "", completed: false, pending: true })
    if (o.tool === "update_reminder") {
      const r = reminders.find(v => v.id === x.id)
      if (r) { if (typeof x.completed === "boolean") r.completed = x.completed; if (x.title) r.title = x.title; if (x.due !== undefined) r.due = x.due || null; r.pending = true }
    }
    if (o.tool === "delete_reminder") reminders = reminders.filter(v => v.id !== x.id)
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
async function claude(body, timeout = 90000) {
  if (!aiKey()) throw new Error("нет ключа Claude — подключите приложение кодом из виджета («Ещё»)")
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeout)
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ctl.signal,
      headers: { "x-api-key": aiKey(), "anthropic-version": "2023-06-01", "content-type": "application/json", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify(Object.assign({ model: core.CONFIG.agentModel || "claude-sonnet-5-5" }, body)) })
    return await r.json()
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "Claude долго не отвечает" : "нет связи с Claude")
  } finally { clearTimeout(t) }
}

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
function addWater(ml) {
  const now = Date.now()
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
    try { foodFlow(await shrinkPhoto(f)) } catch (e) { ui.info("Фото", e.message) }
  }
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
  { name: "get_events", description: "Найти события календаря iPhone в диапазоне дат (видно 30 дней вперёд и вчера). Для поиска по названию передайте query.",
    input_schema: { type: "object", properties: {
      start: { type: "string", description: "Начало диапазона, YYYY-MM-DDTHH:MM (местное время)" },
      end: { type: "string", description: "Конец диапазона, YYYY-MM-DDTHH:MM" },
      query: { type: "string" } }, required: ["start", "end"] } },
  { name: "create_event", description: "Создать событие в календаре iPhone.",
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
  { name: "create_reminder", description: "Создать напоминание.",
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
  { name: "add_money", description: () => `Записать расход или доход ${core.CONFIG.currencyIn}.`,
    input_schema: { type: "object", properties: {
      type: { type: "string", enum: ["expense", "income"] }, amount: { type: "number" },
      method: { type: "string", enum: ["cash", "transfer"], description: "cash — наличные; transfer — перевод, карта, QR" },
      category: { type: "string", description: "Строго одна из категорий из системного сообщения" },
      comment: { type: "string" }, date: { type: "string", description: "Только если не сегодня, YYYY-MM-DD" } },
      required: ["type", "amount", "method", "category"] } },
  { name: "get_money", description: "Операции и итоги по деньгам за месяц.",
    input_schema: { type: "object", properties: { month: { type: "string", description: "YYYY-MM, по умолчанию текущий" } } } },
  { name: "delete_money", description: "Удалить ошибочную операцию по id.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
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
      return { events: list.slice(0, 60).map(evOut), ...(D.snap ? { snapshot_at: iso(new Date(D.snap.at)) } : { warning: "виджет ещё не прислал календарь" }) }
    }
    case "create_event": {
      if (!parseIso(x.start)) return { error: "неверное начало" }
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
      queueOp("update_event", Object.assign({}, x, { occurrence_start: x.occurrence_start || e.start }))
      return { ok: true, note: QUEUED }
    }
    case "delete_event": {
      if (String(x.id).startsWith("op:")) { cancelOp(x.id.slice(3)); return { ok: true, note: "событие ещё не было внесено — отменено" } }
      const e = v.events.find(ev => ev.id === x.id && (!x.occurrence_start || ev.start === x.occurrence_start)) || v.events.find(ev => ev.id === x.id)
      if (!e) return { error: "событие не найдено" }
      if (!(await chatConfirm(`Удалить «${e.title}»?\n${core.cap(fullDate(e.s))}, ${hm(e.s)}${x.all_future ? "\nи все следующие повторения" : ""}`)))
        return { cancelled: "пользователь отказался удалять" }
      queueOp("delete_event", Object.assign({}, x, { occurrence_start: x.occurrence_start || e.start }))
      return { ok: true, note: QUEUED }
    }
    case "get_reminders": {
      let list = x.include_completed ? v.reminders : openRems(v)
      if (x.query) list = list.filter(r => (r.title || "").toLowerCase().includes(x.query.toLowerCase()) || core.titleMatches(r.title || "", x.query))
      return { reminders: list.slice(0, 80).map(r => ({ id: r.id, title: r.title, due: r.due, completed: !!r.completed, list: r.list || "",
        ...(r.pending ? { pending: "ещё не внесено в iPhone" } : {}) })) }
    }
    case "create_reminder": {
      const op = queueOp("create_reminder", x)
      return { ok: true, id: "op:" + op.id, note: QUEUED }
    }
    case "update_reminder": {
      if (String(x.id).startsWith("op:")) {
        const o = D.ops.find(p => p.id === x.id.slice(3) && p.state === "local")
        if (!o) return { error: "напоминание ещё не внесено в iPhone — изменить его можно после обновления виджета" }
        if (x.completed) { cancelOp(o.id); return { ok: true, note: "напоминание ещё не было внесено — отменено" } }
        Object.assign(o.input, x.title ? { title: x.title } : {}, x.due !== undefined ? { due: x.due } : {}); save()
        return { ok: true }
      }
      if (!v.reminders.some(r => r.id === x.id)) return { error: "напоминание не найдено" }
      queueOp("update_reminder", x)
      return { ok: true, note: QUEUED }
    }
    case "delete_reminder": {
      if (String(x.id).startsWith("op:")) { cancelOp(x.id.slice(3)); return { ok: true } }
      const r = v.reminders.find(z => z.id === x.id)
      if (!r) return { error: "напоминание не найдено" }
      if (!(await chatConfirm(`Удалить напоминание «${r.title}»?`))) return { cancelled: "пользователь отказался удалять" }
      queueOp("delete_reminder", x)
      return { ok: true, note: QUEUED }
    }
    case "add_money": {
      const names = core.CONFIG.categories[x.type] ? core.CONFIG.categories[x.type].map(c => c[0]) : []
      if (!names.includes(x.category)) return { error: `категория должна быть одной из: ${names.join(", ")}` }
      if (!(x.amount > 0)) return { error: "сумма должна быть больше нуля" }
      const now = Date.now(), d = parseIso(x.date)
      if (d) d.setHours(12, 0, 0, 0)
      const rec = upsert("money", { id: `f${now}-${Math.random().toString(36).slice(2, 6)}`, date: d ? d.getTime() : now, type: x.type, amount: x.amount,
        method: x.method, category: x.category, comment: x.comment || "" })
      return { ok: true, id: rec.id }
    }
    case "get_money": {
      const key = x.month || core.monthKey(new Date())
      const t = core.monthTotals(live(D.money), key)
      return { month: key, income: t.income, expense: t.expense, cash: t.cash, transfer: t.transfer, by_category: t.cats,
        items: t.items.slice(-60).map(e => ({ id: e.id, date: iso(new Date(e.date)), type: e.type, amount: e.amount, method: e.method, category: e.category, comment: e.comment })) }
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
    case "get_health": {
      const d = dayHealth()
      return { eaten_kcal: d.kcal, protein: d.protein, fat: d.fat, carbs: d.carbs, meals: d.food.map(m => ({ time: hm(new Date(m.date)), title: m.title, kcal: m.kcal })),
        water_ml: d.water, water_goal_ml: H().waterGoal, workouts: d.workouts.map(w => ({ title: w.title, minutes: w.minutes, kcal: w.kcal })),
        watch: d.watch || "нет данных с часов за сегодня" }
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

function dayHealth() {
  const food = today(D.food), workouts = today(D.workouts), v = iphone()
  const sum = k => food.reduce((s, m) => s + (+m[k] || 0), 0)
  const watch = v.watch ? Object.assign({}, v.watch) : null
  const wk = { kcal: workouts.reduce((s, w) => s + (w.kcal || 0), 0), min: workouts.reduce((s, w) => s + (w.minutes || 0), 0) }
  return { food, kcal: sum("kcal"), protein: sum("protein"), fat: sum("fat"), carbs: sum("carbs"), water: waterToday(), workouts, watch,
    active: (watch && watch.active || 0) + wk.kcal, exercise: (watch && watch.exercise || 0) + wk.min, steps: watch && watch.steps }
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
- Календарь и напоминания iPhone приложение меняет через виджет: изменения ставятся в очередь и вносятся при обновлении виджета. Так и скажи коротко («внесу в календарь при обновлении виджета»), не извиняйся.
${cals.length ? `- Календари по словам пользователя: ${cals.map(x => `«${x.calendar}» (список напоминаний «${x.list}»)`).join(", ")}.${cals.filter(x => x.hint).map(x => ` ${x.hint} — «${x.calendar}».`).join("")} Если календарь не назван, не указывай его.
` : ""}- Деньги — ${c.currencyIn}. Категории расходов: ${cats("expense")}. Категории доходов: ${cats("income")}.
- «Съел», «выпил стакан воды» — add_food и add_water. На вопросы о калориях, шагах и воде смотри get_health.
- Тренировка без часов («проплыл бассейн 10 раз», «час падела, часы забыл») — add_workout. Вес пользователя ${H().weight || 80} кг. Скажи, сколько ккал и минут записал.
- Если пользователь спрашивает (что у меня завтра, сколько потратил), посмотри данные и ответь.
- Удаление и перенос пользователь подтверждает сам — не спрашивай отдельно «точно удалить?» или «точно перенести?».`
}
function chatSystem() {
  const r = routes()
  return agentSystem() + `

Это постоянный чат. Ты — личный помощник, секретарь и друг пользователя: помогаешь в любом деле — в жизни и в работе.
- Дела (встречи, напоминания, деньги, еда, вода, тренировки) делай сам инструментами, потом коротко скажи, что сделал.
- Когда просят совета или делятся чем-то личным — отвечай как умный друг: честно, по существу, с заботой, думай на годы вперёд, а не только о сегодняшнем дне. Можно мягко не согласиться.
- Длина ответа: обычно 1–6 строк; совет или разбор — сколько нужно, но без воды. Без Markdown-заголовков и таблиц, короткие списки можно.
- В начале сообщений пользователя в квадратных скобках время, когда оно отправлено; сам время в скобках не пиши.
${r.length ? `- Сложную задачу, которую не решить здесь за пару сообщений (код, разбор документов, исследование, подготовка текста или плана, многошаговая работа), передай через claude_code. Рабочую — в маршрут нужного рабочего проекта по его описанию; личную, не связанную с работой, — в маршрут для личных задач. Если неясно, что именно нужно, сначала коротко уточни. После передачи скажи одной строкой, куда передал; ссылка на сессию покажется сама.`
  : "- Передавать задачи в Claude Code пока нельзя: маршруты не подключены (в виджете: меню → 🤖 Задачи в Claude Code, потом подключить приложение заново). Сложную задачу честно назови сложной и предложи подключить."}`
}
const BRIEFS = {
  morning: { label: "☀️ Утренняя сводка", prompt: "Сделай утреннюю сводку на сегодня. Посмотри события и напоминания на сегодня (и просроченные), " +
    "траты за месяц. Расскажи: что сегодня по порядку со временем, что важно не забыть, что просрочено; сколько потрачено в этом месяце. " +
    "В конце одна короткая дружеская мысль или совет на день. Ничего не меняй." },
  evening: { label: "🌙 Вечерняя сводка", prompt: "Сделай вечернюю сводку за сегодня. Посмотри события и напоминания (вместе с выполненными), " +
    "деньги и еду с водой и активностью за сегодня, события на завтра. Расскажи: что сделано, что не сделано; сколько потрачено сегодня " +
    "(итог и главные траты); сколько съедено ккал и БЖУ, вода, активность; что завтра. Если есть невыполненные напоминания на сегодня " +
    "или просроченные — спроси через ask_user, перенести ли их на завтра (варианты: «Перенести всё на завтра», «Выберу сам», «Оставить как есть») " +
    "и сделай, как ответят; время у перенесённых сохраняй, без времени — на завтра." },
}
function chatContext() {
  const out = []
  for (const m of D.chat.slice(-30)) {
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
async function agentTurn(messages, system, tools) {
  for (let step = 0; step < 14; step++) {
    let res
    try {
      res = await claude({ max_tokens: 2000, system, tools, messages })
      if (res && res.error && /thinking/i.test(res.error.message || "")) { dropThinking(messages); res = await claude({ max_tokens: 2000, system, tools, messages }) }
    } catch (e) { return `Нет связи с Claude: ${e.message || e}` }
    if (!res || res.error) return `Claude ответил ошибкой: ${res && res.error ? res.error.message || res.error.type : "пустой ответ"}`
    messages.push({ role: "assistant", content: res.content })
    const uses = (res.content || []).filter(c => c.type === "tool_use")
    if (!uses.length || res.stop_reason !== "tool_use") return (res.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim() || "Готово."
    const results = []
    for (const u of uses) {
      let out
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
  if (!aiKey()) { setTab("more"); return ui.info("Нужен ключ Claude", "Подключите приложение кодом из виджета: в Scriptable меню → 📱 Приложение «Мой день» → «Подключить приложение».") }
  const item = { role: "user", text: opts.label || text, prompt: opts.label ? text : undefined, at: Date.now(), voice: !!opts.voice }
  D.chat.push(item)
  chatBusy = true
  chatLinks = []
  save(false)
  if (tab !== "chat") setTab("chat"); else renderChat()
  let reply
  try { reply = await agentTurn(chatContext(), chatSystem(), chatTools()) } catch (e) { reply = `Ошибка: ${e.message || e}` }
  chatBusy = false
  D.chat.push({ role: "assistant", text: reply, at: Date.now(), links: chatLinks.slice() })
  D.chat = D.chat.slice(-200)
  save(false)
  sync()
  if (tab === "chat") renderChat()
  else toast("💬 Помощник ответил")
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
let rec = null
function micStart(auto) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  const inp = $("#chat-in")
  if (!SR) { if (inp) inp.focus(); toast("Нажмите 🎤 на клавиатуре и говорите"); return }
  if (rec) { rec.stop(); return }
  rec = new SR()
  rec.lang = "ru-RU"
  rec.interimResults = true
  rec.continuous = false
  let final = "", base = inp ? inp.value.trim() : ""
  $(".chat-bar .mic") && $(".chat-bar .mic").classList.add("on")
  rec.onresult = e => {
    let interim = ""
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript
      else interim += e.results[i][0].transcript
    }
    if (inp) { inp.value = [base, final + interim].filter(Boolean).join(" "); grow(inp) }
  }
  rec.onerror = e => {
    if (auto && e.error === "not-allowed") { rec = null; return micPrompt() }
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { toast("Нет доступа к микрофону — скажите через 🎤 на клавиатуре"); if (inp) inp.focus() }
  }
  rec.onend = () => {
    rec = null
    const b = $(".chat-bar .mic"); if (b) b.classList.remove("on")
    const t = [base, final].filter(Boolean).join(" ").trim()
    if (final.trim() && inp) { inp.value = ""; grow(inp); chatSend(t, { voice: true }) }
  }
  try { rec.start() } catch (e) { rec = null; if (auto) return micPrompt(); if (inp) inp.focus() }
}
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
      toast(`${type === "expense" ? "−" : "+"}${core.money(amount)} · ${rec.category}`)
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
    queueOp("create_reminder", x)
    s.close(); render(); toast("⏰ Внесётся в Напоминания iPhone при обновлении виджета")
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
  queueOp("create_event", { title, start: iso(date), end: iso(end), repeat: repeatOf(a.recur), calendar: a.calendar || undefined })
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
    queueOp("update_event", { id: e.id, occurrence_start: e.start, start: iso(ns), end: iso(new Date(+ns + (e.e - e.s))) })
    render(); toast(`↔️ ${shortDate(ns)}, ${hm(ns)} — внесётся при обновлении виджета`)
  }
  if (b === "Удалить") {
    let all = false
    if (e.repeats) { const i = await ui.choose("Повторяющееся событие", "", ["Только это", "Это и все следующие"]); if (i < 0) return; all = i === 1 }
    queueOp("delete_event", { id: e.id, occurrence_start: e.start, all_future: all })
    render(); toast("🗑 Удалится при обновлении виджета")
  }
}
async function addMenu() {
  const glass = H().glass || 250
  const opts = [["💬 Сказать помощнику", () => { setTab("chat"); setTimeout(micStart, 300) }], ["➖ Расход", () => moneyForm("expense")], ["➕ Доход", () => moneyForm("income")],
    ["📷 Еда по фото", () => $("#photo").click()], ["🍽 Еда", foodMenu], [`💧 Стакан воды ${glass} мл`, () => addWater(glass)], ["🏃 Тренировка", () => workoutForm()],
    ["⏰ Напоминание", reminderForm], ["📅 Событие", eventForm]]
  const i = await ui.choose("Добавить", "", opts.map(o => o[0]))
  if (i >= 0) opts[i][1]()
}

// ───────────── Экраны ─────────────
let tab = "today", selDay = sod(new Date()), monthKey = null
function setTab(t) {
  tab = t
  $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === t))
  document.body.classList.toggle("chat", t === "chat")
  render()
  if (t === "chat") setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 30)
  else window.scrollTo(0, 0)
}
function render() {
  const fn = { today: renderToday, chat: renderChatHTML, money: renderMoney, health: renderHealth, more: renderMore }[tab]
  $("#view").innerHTML = fn()
  bind()
  renderTop()
}
const TITLES = { chat: "Помощник", money: "Деньги", health: "Здоровье", more: "Ещё" }
function renderTop() {
  const v = iphone()
  if (tab === "today") $("#top-title").textContent = fullDate(new Date())
  else $("#top-title").textContent = TITLES[tab]
  let sub = ""
  if (!D.conn) sub = "Не подключено к виджету"
  else if (D.sync.error) sub = `⚠️ ${D.sync.error}`
  else if (tab === "money") { const t = core.monthTotals(live(D.money), monthKey || core.monthKey(new Date())); sub = `${core.monthTitle(monthKey || core.monthKey(new Date()))} · −${core.money(t.expense)}` }
  else {
    const p = pendingOps().length
    sub = `iPhone: ${v.at ? ago(v.at) : "ждём виджет"}` + (p ? ` · ⏳ ${p} в очереди` : "")
  }
  $("#top-sub").textContent = sub
}

function renderToday() {
  const now = new Date(), t0 = sod(now), v = iphone()
  const isToday = sameDay(selDay, t0)
  const counts = {}
  for (const e of v.events) for (let d = sod(e.s); d < e.e && d < addDays(t0, 7); d = addDays(d, 1)) counts[dayKey(d)] = (counts[dayKey(d)] || 0) + 1
  let html = ""
  if (!D.conn) html += `<div class="banner"><b>Подключите приложение к виджету</b>В Scriptable: меню виджета → 📱 → «📋 Скопировать код подключения», затем нажмите кнопку ниже и вставьте код. Значок на экране «Домой» подключается отдельно от Safari.<div class="btns" style="margin-top:8px"><button class="btn primary" data-do="connect">🔗 Вставить код</button></div></div>`
  else if (!D.snap) html += `<div class="banner"><b>Ждём календарь от виджета</b>Он придёт при ближайшем обновлении виджета на экране «Домой» (обычно в течение 15 минут).</div>`
  html += `<div class="week">${[...Array(7)].map((_, i) => {
    const d = addDays(t0, i), n = counts[dayKey(d)] || 0
    return `<button class="day ${sameDay(d, selDay) ? "on" : ""} ${d.getDay() % 6 === 0 ? "we" : ""}" data-day="${+d}">
      <div class="wd">${WD[d.getDay()]}</div><div class="dn">${d.getDate()}</div><div class="n">${n || ""}</div></button>`
  }).join("")}</div>`
  const onDay = d => v.events.filter(e => e.s < addDays(d, 1) && e.e > d).sort((a, b) => (b.all_day ? 1 : 0) - (a.all_day ? 1 : 0) || a.s - b.s)
  const dayEvs = onDay(selDay)
  html += `<div class="card"><h2>${isToday ? "Сегодня" : esc(core.cap(dayName(selDay)))}<button class="act" data-do="event">+ Событие</button></h2>`
  html += dayEvs.length ? dayEvs.map((e, i) => {
    const t = e.all_day ? "весь день" : e.s < selDay ? "до " + hm(e.e) : hm(e.s)
    const past = isToday && !e.all_day && e.e <= now
    return `<div class="row ${e.pending ? "pending" : ""} ${past ? "past" : ""}" data-ev="${i}"><div class="bar-l" style="background:${esc(e.color || "var(--teal)")}"></div>
      <div class="time" style="${e.all_day ? "font-size:11.5px" : ""}">${t}</div>
      <div class="grow"><div class="t">${esc(e.title || "(без названия)")}</div><div class="s">${e.all_day ? "" : hm(e.s) + "–" + hm(e.e)}${e.location ? " · " + esc(e.location) : ""}${e.calendar ? " · " + esc(e.calendar) : ""}</div></div></div>`
  }).join("") : `<div class="empty">${D.snap ? "Ничего не запланировано" : "Календарь ещё не пришёл от виджета"}</div>`
  html += `</div>`
  dayEvsCache = dayEvs

  // Дальше на неделю: названия событий по дням, чтобы видеть план целиком
  const ahead = []
  for (let i = 0; i < 7; i++) {
    const d = addDays(t0, i)
    if (sameDay(d, selDay)) continue
    const evs = onDay(d).filter(e => !(i === 0 && !e.all_day && e.e <= now))
    if (evs.length) ahead.push([d, evs])
  }
  if (ahead.length) {
    html += `<div class="card"><h2>На неделе</h2>` + ahead.map(([d, evs]) => `<button class="agenda-day" data-day="${+d}">${esc(core.cap(dayName(d)))}</button>` +
      evs.slice(0, 8).map(e => `<div class="agenda"><span class="dot" style="background:${esc(e.color || "var(--teal)")}"></span><span class="at">${e.all_day ? "весь день" : e.s < d ? "до " + hm(e.e) : hm(e.s)}</span><span class="t">${esc(e.title || "(без названия)")}</span></div>`).join("") +
      (evs.length > 8 ? `<div class="agenda more">ещё ${evs.length - 8}</div>` : "")).join("") + `</div>`
  }

  let rems = openRems(v)
  if (isToday) rems = rems.filter(r => !remDue(r) || remDue(r) < addDays(t0, 1))
  else rems = rems.filter(r => remDue(r) && sameDay(remDue(r), selDay))
  rems.sort((a, b) => (!remDue(a)) - (!remDue(b)) || (remDue(a) || 0) - (remDue(b) || 0))
  html += `<div class="card"><h2>Напоминания<button class="act" data-do="reminder">+ Добавить</button></h2>`
  html += rems.length ? rems.slice(0, 25).map(r => `<div class="row ${r.pending ? "pending" : ""}"><button class="check ${remLate(r) ? "late" : ""}" data-check="${esc(r.id)}"></button>
    <div class="grow"><div class="t">${esc(r.title)}</div>${r.due || r.list ? `<div class="s ${remLate(r) ? "exp" : ""}">${esc(remLabel(r))}${r.due && r.list ? " · " : ""}${esc(r.list || "")}</div>` : ""}</div></div>`).join("")
    : `<div class="empty">${isToday ? "Всё сделано" : "На этот день напоминаний нет"}</div>`
  html += `</div>`

  if (isToday) {
    const h = dayHealth(), g = H()
    const t = core.monthTotals(live(D.money), core.monthKey(t0))
    const spent = live(D.money).filter(e => e.type === "expense" && sameDay(e.date, t0)).reduce((s, e) => s + e.amount, 0)
    html += `<div class="card"><h2>За день</h2><div class="stats">
      <button class="stat" data-do="water"><div class="v">💧 ${liters(h.water)} л</div><div class="l">из ${liters(g.waterGoal)} · +стакан</div><div class="prog"><div style="width:${Math.min(100, h.water / g.waterGoal * 100)}%"></div></div></button>
      <button class="stat" data-do="tab-health"><div class="v">🍽 ${num(h.kcal)}</div><div class="l">ккал${h.active ? ` · −${num(h.active)} актив.` : ""}</div><div class="prog gold"><div style="width:${Math.min(100, h.kcal / (g.kcalGoal || 2000) * 100)}%"></div></div></button>
      <button class="stat" data-do="tab-money"><div class="v">−${num(spent)}</div><div class="l">${esc(core.CONFIG.currency)} сегодня · −${num(t.expense)} за месяц</div></button>
    </div></div>`
  }
  const failed = D.ops.filter(o => o.state === "done" && o.result && o.result.error)
  if (failed.length) html += `<div class="card"><h2>Не внеслось в iPhone</h2>${failed.map(o => `<div class="row"><div class="grow"><div class="t">${esc(OP_LABEL[o.tool] || o.tool)}: ${esc((o.input || {}).title || "")}</div><div class="s exp">${esc(o.result.error)}</div></div></div>`).join("")}</div>`
  return html
}
let dayEvsCache = []

function renderChatHTML() {
  return `<div class="chat-tools"><button data-brief="morning">☀️ Утренняя сводка</button><button data-brief="evening">🌙 Вечерняя</button><button data-do="chat-clear">🧹 Очистить</button></div>
    <div class="chat-list" id="chat-list">${chatItems()}</div>
    <div class="chat-bar"><textarea id="chat-in" rows="1" placeholder="Напишите или скажите…" enterkeyhint="send"></textarea>
    <button class="mic" aria-label="Сказать">${ICO.mic}</button><button class="send" aria-label="Отправить">${ICO.send}</button></div>`
}
const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`)
function chatItems() {
  if (!D.chat.length) return `<div class="empty" style="text-align:center;padding:30px 10px">Я ваш помощник: встречи, напоминания, деньги, еда — и просто поговорить.<br><br>Нажмите 🎤 и скажите, например: «завтра в 10 встреча с Олей», «потратил 300 на такси наличными», «что у меня на неделе?»</div>`
  const last = D.chat.length - 1
  return D.chat.slice(-60).map((m, i, arr) => {
    const isLast = i === arr.length - 1 && askWait
    return `<div class="m ${m.role}">${m.voice ? "🎤 " : ""}${linkify(m.text)}${(m.links || []).length ? `<div class="links">${m.links.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">🔗 Сессия Claude Code</a>`).join("")}</div>` : ""}` +
      `${m.opts && m.opts.length && isLast ? `<div class="opts">${m.opts.map(o => `<button data-opt="${esc(o)}">${esc(o)}</button>`).join("")}</div>` : ""}<span class="tm">${hm(new Date(m.at || Date.now()))}</span></div>`
  }).join("") + (chatBusy && !askWait ? `<div class="typing"><i></i><i></i><i></i></div>` : "") + (last < 0 ? "" : "")
}
function renderChat() {
  const list = $("#chat-list")
  if (!list) return
  list.innerHTML = chatItems()
  bindChatList()
  window.scrollTo(0, document.body.scrollHeight)
}
function bindChatList() {
  $$("[data-opt]").forEach(b => b.onclick = () => { b.classList.add("on"); chatSend(b.dataset.opt) })
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
  const cats = Object.entries(t.cats.expense).sort((a, b) => b[1] - a[1])
  if (cats.length) html += `<div class="card"><h2>Куда ушли деньги</h2>` + cats.map(([n, v]) => `<div class="cat"><div class="top"><span>${esc(n)}</span><b>${esc(core.money(v))}</b></div>
      <div class="prog gold"><div style="width:${v / cats[0][1] * 100}%"></div></div></div>`).join("") + `</div>`
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
  html += `</div><div class="btns"><button class="btn" data-do="report">📊 Отчёт за месяц</button>${D.conn && D.conn.sheetUrl ? '<button class="btn" data-do="sheet">▦ Таблица</button>' : ""}</div>`
  return html
}

function ring(p, color, label, sub) {
  const r = 40, c = 2 * Math.PI * r
  return `<div class="ring"><svg viewBox="0 0 92 92" width="92" height="92"><circle cx="46" cy="46" r="${r}" fill="none" stroke="var(--track)" stroke-width="9"/>
    <circle cx="46" cy="46" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, p || 0))}"/></svg>
    <div class="c"><b>${label}</b><span>${sub}</span></div></div>`
}
function renderHealth() {
  const g = H(), h = dayHealth(), t0 = sod(new Date())
  let html = `<div class="card"><h2>Активность${h.watch ? `<span class="muted small" style="text-transform:none;letter-spacing:0">часы: ${ago(h.watch.updated)}</span>` : ""}</h2>
    <div class="watch"><div><b>${h.steps != null ? num(h.steps) : "—"}</b><span>шагов</span></div><div><b>${num(h.active)}</b><span>актив. ккал из ${num(g.moveGoal)}</span></div>
    <div><b>${num(h.exercise)}</b><span>мин упражнений</span></div></div>
    ${!h.watch ? `<div class="muted small" style="margin-top:8px">Данные часов приходят через виджет после Быстрой команды «Мой день - здоровье».</div>` : ""}
    <div class="btns" style="margin-top:10px"><button class="btn small" data-do="workout">+ Тренировка без часов</button></div>
    ${h.workouts.map(w => `<div class="row" data-wk="${esc(w.id)}"><div class="time">${hm(new Date(w.date))}</div><div class="grow"><div class="t">${esc(w.title)}</div><div class="s">${w.minutes} мин</div></div><div class="amt">−${num(w.kcal)}</div></div>`).join("")}</div>`
  html += `<div class="card"><h2>Вода</h2><div class="ring-row">${ring(h.water / g.waterGoal, "var(--teal)", liters(h.water) + " л", "из " + liters(g.waterGoal))}
    <div style="flex:1"><div class="btns"><button class="btn teal" data-water="${g.glass}">+ Стакан ${g.glass} мл</button></div>
    <div class="btns" style="margin-top:8px"><button class="btn small" data-water="500">+500</button><button class="btn small" data-water="other">Другое</button><button class="btn small" data-water="undo">Отменить</button></div></div></div></div>`
  const kGoal = g.kcalGoal || 2000
  html += `<div class="card"><h2>Еда<button class="act" data-do="food">+ Добавить</button></h2><div class="ring-row">
    ${ring(h.kcal / kGoal, h.kcal > kGoal ? "var(--red)" : "var(--gold)", num(h.kcal), "ккал")}
    <div style="flex:1" class="small muted">Белки <b style="color:var(--text)">${num(h.protein)} г</b> · жиры <b style="color:var(--text)">${num(h.fat)} г</b> · углеводы <b style="color:var(--text)">${num(h.carbs)} г</b>
    <div class="btns" style="margin-top:10px"><button class="btn gold small" data-do="photo">📷 По фото</button></div></div></div>`
  html += h.food.map(f => `<div class="row" data-food="${esc(f.id)}"><div class="time">${hm(new Date(f.date))}</div><div class="grow"><div class="t">${esc(f.title || "Еда")}</div>${f.protein || f.fat || f.carbs ? `<div class="s">Б ${num(f.protein)} · Ж ${num(f.fat)} · У ${num(f.carbs)}</div>` : ""}</div><div class="amt">${num(f.kcal)}</div></div>`).join("")
  html += `</div>`
  const days = [...Array(7)].map((_, i) => addDays(t0, i - 6))
  const kc = days.map(d => live(D.food).filter(f => sameDay(f.date, d)).reduce((s, f) => s + (f.kcal || 0), 0))
  const wa = days.map(d => live(D.water).filter(w => sameDay(w.date, d)).reduce((s, w) => s + (w.ml || 0), 0))
  const mk = Math.max(1, ...kc), mw = Math.max(1, ...wa)
  html += `<div class="card"><h2>Неделя: калории</h2><div class="chart">${days.map((d, i) => `<div class="col"><div class="lbl">${kc[i] ? num(kc[i]) : ""}</div><div class="b" style="height:${kc[i] / mk * 100}%"></div><div class="lbl">${WD[d.getDay()]}</div></div>`).join("")}</div></div>`
  html += `<div class="card"><h2>Неделя: вода</h2><div class="chart">${days.map((d, i) => `<div class="col"><div class="lbl">${wa[i] ? liters(wa[i]) : ""}</div><div class="b w" style="height:${wa[i] / mw * 100}%"></div><div class="lbl">${WD[d.getDay()]}</div></div>`).join("")}</div></div>`
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
      <div class="set"><span>Календарь от виджета</span><span>${esc(D.snap ? ago(D.snap.at) : "ещё не было")}</span></div>
      <div class="set"><span>Ключ Claude</span>${c.key ? '<span class="ok">✓ Есть</span>' : '<span class="exp">нет</span>'}</div>
      <div class="set"><span>Маршруты в Claude Code</span><span>${routes().length ? esc(routes().map(r => r.name).join(", ")) : "нет"}</span></div>
      ${D.sync.error ? `<div class="msg exp small">${esc(D.sync.error)}</div>` : ""}
      <div class="btns" style="margin-top:10px"><button class="btn" data-do="sync">🔄 Обменяться сейчас</button>${pendingOps().length ? '<button class="btn primary" data-do="run-widget">📲 Внести в iPhone сейчас</button>' : ""}</div>
      ${pendingOps().length ? `<div class="muted small" style="margin-top:8px">В очереди ${pendingOps().length}: ${esc(pendingOps().map(o => OP_LABEL[o.tool] || o.tool).join(", "))}. Виджет внесёт их сам при обновлении; кнопка «Внести сейчас» на секунду откроет Scriptable.</div>` : ""}`
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

function showReport() {
  const key = monthKey || core.monthKey(new Date())
  const s = sheet(`<h3>Отчёт · ${esc(core.monthTitle(key))}</h3><iframe class="report"></iframe>
    <div class="btns"><button class="btn" data-a="share">Отправить текстом</button><button class="btn primary" data-a="close">Закрыть</button></div>`)
  $("iframe", s.el).srcdoc = core.reportHTML(key, live(D.money))
  $('[data-a="close"]', s.el).onclick = () => s.close()
  $('[data-a="share"]', s.el).onclick = () => {
    const text = core.reportText(key, live(D.money))
    if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard.writeText(text).then(() => toast("Скопировано"))
  }
}

function bind() {
  const v = $("#view")
  $$("[data-day]", v).forEach(b => b.onclick = () => { selDay = new Date(+b.dataset.day); render() })
  $$("[data-ev]", v).forEach(el => el.onclick = () => eventSheet(dayEvsCache[+el.dataset.ev]))
  $$("[data-check]", v).forEach(b => b.onclick = ev => {
    ev.stopPropagation()
    const id = b.dataset.check
    b.classList.add("on")
    b.closest(".row").classList.add("done-anim")
    if (id.startsWith("op:")) cancelOp(id.slice(3)); else queueOp("update_reminder", { id, completed: true })
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
  $$("[data-brief]", v).forEach(b => b.onclick = () => brief(b.dataset.brief))
  $$("[data-do]", v).forEach(b => b.onclick = () => DO[b.dataset.do]())
  const inp = $("#chat-in", v)
  if (inp) {
    inp.oninput = () => grow(inp)
    inp.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const t = inp.value; inp.value = ""; grow(inp); chatSend(t) } }
    $(".chat-bar .send", v).onclick = () => { const t = inp.value; inp.value = ""; grow(inp); chatSend(t) }
    $(".chat-bar .mic", v).onclick = () => micStart()
    bindChatList()
  }
}

const DO = {
  event: () => eventForm(), reminder: () => reminderForm(), food: () => foodMenu(), workout: () => workoutForm(), photo: () => $("#photo").click(),
  expense: () => moneyForm("expense"), income: () => moneyForm("income"), water: () => addWater(H().glass || 250),
  "tab-money": () => setTab("money"), "tab-health": () => setTab("health"), report: () => showReport(),
  sheet: () => window.open(D.conn.sheetUrl, "_blank"),
  sync: () => (!D.conn || !D.conn.hook) ? DO.connect() : sync().then(ok => toast(ok ? "Обновлено" : `Не получилось: ${D.sync.error || "нет связи"}`)),
  "run-widget": () => { sync().then(() => { location.href = `${(D.conn && D.conn.run) || "scriptable:///run/MyDay"}?action=hub` }) },
  connect: async () => {
    const t = await ui.ask("Подключить к виджету", "Вставьте код из виджета: Scriptable → меню → 📱 Приложение «Мой день» → «Скопировать код подключения».", "", { multiline: true, ok: "Подключить" })
    if (t) connect(t)
  },
  disconnect: async () => {
    const b = await ui.confirm("Отключить?", `<div class="msg">Ключи удалятся с этого телефона. Записи останутся в таблице и в виджете.</div>`, ["Отмена", "Отключить"])
    if (b === "Отключить") { D = {}; localStorage.removeItem(STORE); load(); render() }
  },
  "chat-clear": async () => {
    const b = await ui.confirm("Очистить чат?", `<div class="msg">Переписка удалится с этого телефона.</div>`, ["Отмена", "Очистить"])
    if (b === "Очистить") { D.chat = []; save(false); render() }
  },
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

// ───────────── Действия из виджета (ссылки вида …/#voice) ─────────────
async function hashAction() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ""))
  if (!h) return
  history.replaceState(null, "", location.pathname + location.search)
  while (stack.length) stack[stack.length - 1].close()
  if (h.startsWith("setup=")) return connect(h.slice(6))
  const [a, arg] = h.split("=")
  if (a === "voice") { setTab("chat"); return micStart(true) }
  if (a === "chat" || a === "note") return setTab("chat")
  if (a === "brief") { setTab("chat"); return brief(arg) }
  if (a === "money") return moneyForm("expense")
  if (a === "water") return addWater(H().glass || 250)
  if (a === "camera") return photoPrompt()
  if (a === "food") return foodMenu()
  if (a === "health") return setTab("health")
  if (a === "today") return setTab("today")
}
// Safari включает микрофон и камеру только по нажатию — одна большая кнопка
function micPrompt() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { const i = $("#chat-in"); if (i) i.focus(); return }
  const s = sheet(`<h3>🎤 Скажите помощнику</h3><div class="btns"><button class="btn gold" style="padding:18px;font-size:18px">Нажмите и говорите</button></div>`)
  $(".btn", s.el).onclick = () => { s.close(); micStart() }
}
function photoPrompt() {
  const s = sheet(`<h3>📷 Еда по фото</h3><div class="btns"><button class="btn gold" data-a="cam" style="padding:18px;font-size:18px">Сфотографировать</button></div>
    <div class="btns"><button class="btn" data-a="lib">Выбрать из фото</button><button class="btn" data-a="txt">Описать словами</button></div>`)
  $('[data-a="cam"]', s.el).onclick = () => { s.close(); $("#photo").click() }
  $('[data-a="lib"]', s.el).onclick = () => { s.close(); $("#photo-lib").click() }
  $('[data-a="txt"]', s.el).onclick = async () => { s.close(); const t = await ui.ask("Что съели?", "Например: тарелка том яма и рис", "", { ok: "Посчитать" }); if (t) foodFlow(null, t) }
}

// ───────────── Старт ─────────────
document.querySelectorAll("[data-ico]").forEach(i => i.innerHTML = ICO[i.dataset.ico])
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
$$("#tabs button").forEach(b => b.onclick = () => setTab(b.dataset.tab))
onPhoto($("#photo")); onPhoto($("#photo-lib"))
load()
setTab("today")
hashAction()
window.addEventListener("hashchange", hashAction)
sync()
setInterval(() => { if (document.visibilityState === "visible") sync() }, 60000)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return
  if (selDay < sod(new Date())) selDay = sod(new Date())
  sync()
})
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {})
