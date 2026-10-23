// «Мой день» для Mac — виджет Übersicht.
// Неделя из Календаря, напоминания, быстрые заметки, голосовые/текстовые команды, доходы и расходы в батах.
// Заметки и деньги общие с iPhone-виджетом (iCloud Drive → Scriptable → my-day).

import { run, css } from "uebersicht"
import * as core from "./lib/core.js"

// ───────────── Настройки ─────────────
const MAC = {
  top: 40, right: 30, width: 520,   // начальное положение и ширина (виджет можно перетащить за дату)
  chips: 4,                         // сколько дел в день в календаре
  calendar: "",                     // календарь для новых событий (пусто — первый доступный)
}
const DAYS_BEFORE = core.CONFIG.week.daysBefore
const DAYS_FROM_TODAY = core.CONFIG.week.daysFromToday

const W = "$HOME/Library/Application Support/Übersicht/widgets/MyDay.widget"
const ICLOUD = "$HOME/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/my-day"
// Фирменные цвета Prime Thai Property (из логотипа)
const BRAND = { emerald: "#0B4A33", emeraldDeep: "#063322", emeraldMid: "#2E6B57", gold: "#D4A23C", goldLight: "#F0CC60",
  goldDark: "#A9791A", teal: "#0FA89C", cream: "#FBF8F0", sand: "#F1EAD8", terracotta: "#B5532F" }
const PALETTE = [BRAND.emerald, BRAND.teal, BRAND.goldDark, BRAND.emeraldMid]

const DATA_CMD = `"${W}/data.sh" ${DAYS_BEFORE} ${DAYS_FROM_TODAY}`
// Каждое обновление: данные для виджета + догоняющая выгрузка в Google Таблицу, если операции менялись
export const command = async dispatch => {
  let output = ""
  try { output = await run(DATA_CMD) } catch (e) { output = "" }
  dispatch({ type: "DATA", output })
  autoSyncSheet(output)
}
export const refreshFrequency = 2 * 60 * 1000   // раз в 2 минуты — подхватывает изменения с iPhone
export const initialState = { output: "", busy: false }
export const updateState = (event, prev) => {
  if (event.type === "BUSY") return { ...prev, busy: event.busy }
  if (event.type === "DATA") return { ...prev, output: event.output }
  if (event.output !== undefined) return { ...prev, output: event.output, error: event.error }
  return prev
}

// ───────────── Разбор данных ─────────────
function sections(out) {
  const res = {}
  let cur = null
  for (const line of (out || "").split("\n")) {
    const m = line.match(/^@@([A-Z_]+)\s*$/)
    if (m) { cur = m[1]; res[cur] = []; continue }
    if (cur) res[cur].push(line)
  }
  return res
}

const safeJSON = (lines, def) => {
  try { const v = JSON.parse((lines || []).join("\n").trim() || "null"); return v || def } catch (e) { return def }
}

const ymd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d) }
const at = (dateStr, time) => { const d = ymd(dateStr); if (time) { const [h, mi] = time.split(":").map(Number); d.setHours(h, mi, 0, 0) } return d }

function colorFor(name) {
  let h = 0
  for (const ch of name || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

// Строки icalBuddy: «Название (Календарь) §§ 2026-10-22 at 19:00 - 21:00»
function parseEvents(lines) {
  const re = /^(\d{4}-\d{2}-\d{2})(?: at (\d{2}:\d{2}))?(?: - (\d{4}-\d{2}-\d{2})?(?: at )?(\d{2}:\d{2})?)?$/
  const list = []
  for (const raw of lines) {
    const line = raw.trim()
    const i = line.lastIndexOf(" §§ ")
    if (i < 0) continue
    const head = line.slice(0, i), when = line.slice(i + 4).trim()
    const m = when.match(re)
    if (!m) continue
    let title = head, cal = ""
    const cm = head.match(/^(.*) \(([^()]*)\)$/)
    if (cm) { title = cm[1]; cal = cm[2] }
    const allDay = !m[2]
    const start = at(m[1], m[2])
    let end
    if (allDay) { end = ymd(m[3] || m[1]); end.setDate(end.getDate() + 1) }
    else end = at(m[3] || m[1], m[4] || m[2])
    list.push({ title, cal, start, end, allDay, color: colorFor(cal) })
  }
  return list.sort((a, b) => a.start - b.start)
}

const toReminder = r => ({
  identifier: r.id, title: r.title,
  dueDate: r.due ? new Date(r.due) : null,
  dueDateIncludesTime: !!r.due && !r.allday,
})

function sortReminders(list) {
  return list.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate - b.dueDate
  })
}

function weekDays() {
  const today = core.startOfDay(new Date())
  return Array.from({ length: DAYS_BEFORE + DAYS_FROM_TODAY }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - DAYS_BEFORE + i); return d
  })
}

function dayItems(day, events, rems) {
  const next = new Date(day); next.setDate(day.getDate() + 1)
  const ev = events.filter(e => e.start < next && e.end > day).map(e => {
    const startsToday = core.sameDay(e.start, day)
    return { kind: "event", title: e.title, color: e.color, date: day,
      time: e.allDay || !startsToday ? "" : core.TIME.string(e.start),
      sort: e.allDay || !startsToday ? 0 : e.start.getTime() }
  })
  const rm = rems.filter(r => r.dueDate && core.sameDay(r.dueDate, day)).map(r => ({
    kind: "rem", id: r.identifier, title: r.title, date: day, late: core.isOverdue(r),
    color: core.isOverdue(r) ? BRAND.terracotta : BRAND.gold,
    time: "○ " + (r.dueDateIncludesTime ? core.TIME.string(r.dueDate) : "дело"),
    sort: r.dueDateIncludesTime ? r.dueDate.getTime() : day.getTime() + 1,
  }))
  return ev.concat(rm).sort((a, b) => a.sort - b.sort)
}

// ───────────── Связь с macOS ─────────────
const q = s => `'${String(s).replace(/'/g, `'\\''`)}'`
const b64 = s => btoa(unescape(encodeURIComponent(s)))
const z2 = n => String(n).padStart(2, "0")
const localISO = d => `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}T${z2(d.getHours())}:${z2(d.getMinutes())}:00`

async function bridge(...args) {
  const out = (await run(`osascript -l JavaScript "${W}/lib/bridge.js" ${args.map(q).join(" ")}`)).trim()
  if (out.startsWith("__ERROR__")) throw new Error(out.slice(10))
  return out
}
const ask = async (title, prompt, def = "") => { const r = await bridge("ask", title, prompt, def); return r === "__CANCEL__" ? null : (r.trim() || null) }
const choose = async (title, prompt, items) => +(await bridge("choose", title, prompt, JSON.stringify(items)))
const confirmBox = async (title, msg, buttons) => { const r = await bridge("confirm", title, msg, JSON.stringify(buttons)); return r === "__CANCEL__" ? null : r }
const info = (title, msg = "") => bridge("info", title, msg)

// Заметки и деньги — общие файлы с iPhone. Сохранение сливает изменения по записям (см. core.mergeSynced),
// поэтому одновременные правки на телефоне и Mac не перетирают друг друга.
const PREFIX = { notes: "n", finance: "f" }
async function rawData(name) {
  try {
    const out = await run(`cat "${ICLOUD}/${name}.json" 2>/dev/null || echo "[]"`)
    return core.withIds(JSON.parse(out.trim() || "[]") || [], PREFIX[name])
  } catch (e) { return [] }
}
const loadData = async name => {
  const list = core.visible(await rawData(name))
  return name === "notes" ? list.sort((a, b) => b.date - a.date) : list
}
async function saveData(name, mine, deletedIds = []) {
  let merged = core.mergeSynced(await rawData(name), mine, deletedIds)
  if (name === "notes") {
    merged.sort((a, b) => (b.date || 0) - (a.date || 0))
    const drop = new Set(merged.filter(x => !x.deleted).slice(100).map(x => x.id))
    merged = merged.filter(x => !drop.has(x.id))
  }
  const res = await run(`"${W}/data.sh" save ${name} ${b64(JSON.stringify(merged))}`)
  if (name === "finance") await syncSheet(true)
  return res
}

// ── Google Таблица: настройки общие с iPhone (iCloud → my-day/settings.json) ──
const asObj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {})
async function loadSettings() {
  try { return asObj(JSON.parse((await run(`cat "${ICLOUD}/settings.json" 2>/dev/null || echo "{}"`)).trim() || "{}")) }
  catch (e) { return {} }
}
async function saveSettings(patch) {
  const cur = Object.assign(await loadSettings(), patch)
  await run(`"${W}/data.sh" save settings ${b64(JSON.stringify(cur))}`)
}

// Отправляет в таблицу все операции и удалённые ID; таблица сама пропускает уже записанные
async function syncSheet(silent) {
  const st = await loadSettings()
  const hook = sheetHookOf(st)
  if (!hook) return silent ? null : { ok: false, error: "автозапись отключена" }
  const all = await rawData("finance")
  const body = JSON.stringify({ secret: core.CONFIG.sheetSecret,
    entries: all.filter(x => !x.deleted).sort((a, b) => a.date - b.date),
    deleted: all.filter(x => x.deleted).map(x => x.id) })
  try {
    const out = await run(`printf %s ${b64(body)} | base64 -D > /tmp/myday-sheet.json && ` +
      `curl -sL --max-time 40 -H "content-type: text/plain;charset=utf-8" --data-binary @/tmp/myday-sheet.json ${q(hook)}; ` +
      `rm -f /tmp/myday-sheet.json`)
    const res = JSON.parse(out.trim())
    if (res && res.ok) await saveSettings({ sheetSyncedAt: Date.now(), sheetSig: moneySig(all) })
    return res
  } catch (e) { return { ok: false, error: "таблица не ответила" } }
}

// Ссылка автозаписи: из общих настроек (iCloud), иначе встроенная. "" в настройках — выключено.
const sheetHookOf = st => (typeof st.sheetHook === "string" ? st.sheetHook : core.CONFIG.sheetHook)
const moneySig = all => `${all.length}:${all.reduce((m, x) => Math.max(m, x.u || x.date || 0), 0)}`
let syncing = false
async function autoSyncSheet(output) {
  if (syncing) return
  try {
    const sec = sections(output)
    const all = core.withIds(safeJSON(sec.MONEY, []), "f")
    const st = sec.SETTINGS ? asObj(safeJSON(sec.SETTINGS, {})) : await loadSettings()
    if (!sheetHookOf(st) || st.sheetSig === moneySig(all)) return
    syncing = true
    await syncSheet(true)
  } catch (e) {} finally { syncing = false }
}

const openSheet = () => run(`open ${q(core.CONFIG.sheetUrl)}`)

async function sheetMenu() {
  const st = await loadSettings()
  const when = st.sheetSyncedAt ? new Date(st.sheetSyncedAt).toLocaleString("ru-RU") : "ещё не было"
  const on = !!sheetHookOf(st)
  const items = ["Открыть таблицу", on ? "Выгрузить все операции сейчас" : "Подключить автозапись"]
  if (on) items.push("Изменить ссылку автозаписи", "Отключить автозапись")
  const i = await choose("▦ Google Таблица", on ? `Автозапись включена. Последняя выгрузка: ${when}` :
    "Автозапись выключена: операции пока не попадают в таблицу сами.", items)
  if (i === 0) return openSheet()
  if (i === 1 && on) {
    const r = await syncSheet(false)
    return info(r && r.ok ? "Таблица обновлена ✓" : "Не получилось",
      r && r.ok ? `Добавлено: ${r.added || 0}, удалено: ${r.removed || 0}` : (r && r.error) || "")
  }
  if (i === 1 || i === 2) {
    const url = await ask("Ссылка автозаписи", "Вставьте ссылку веб-приложения из Apps Script (вида https://script.google.com/macros/s/…/exec). " +
      "Настраивается один раз: iPhone подхватит её сам.", st.sheetHook || "")
    if (!url) return
    if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(url)) return info("Похоже, это не та ссылка", "Нужна ссылка вида https://script.google.com/macros/s/…/exec")
    await saveSettings({ sheetHook: url })
    const r = await syncSheet(false)
    return info(r && r.ok ? "Автозапись подключена ✓" : "Ссылка сохранена, но таблица не ответила",
      r && r.ok ? `В таблицу выгружено операций: ${r.added || 0}` : `${(r && r.error) || ""}\nПроверьте, что у веб-приложения доступ «Все».`)
  }
  if (i === 3) { await saveSettings({ sheetHook: "" }); return info("Автозапись отключена") }
}

const newId = p => `${p}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

// Календарь для новых событий: выбирается один раз (лучше iCloud-календарь — тогда событие будет и на iPhone)
const CAL_KEY = "myday-calendar"
async function targetCalendar(forceChoose) {
  if (MAC.calendar && !forceChoose) return MAC.calendar
  let saved = null
  try { saved = localStorage.getItem(CAL_KEY) } catch (e) {}
  if (saved && !forceChoose) return saved
  const names = JSON.parse(await bridge("calendars"))
  if (!names.length) throw new Error("Нет календаря, в который можно записывать")
  const i = await choose("📅 Календарь для новых событий",
    "Выберите календарь из iCloud — тогда события будут видны и на iPhone. Выбор запомнится.", names)
  if (i < 0) return null
  try { localStorage.setItem(CAL_KEY, names[i]) } catch (e) {}
  return names[i]
}

async function reload(dispatch) {
  try { dispatch({ type: "DATA", output: await run(DATA_CMD) }) } catch (e) {}
}

// Обёртка для кнопок: индикатор, ошибки, обновление после действия
const action = (dispatch, fn) => async e => {
  if (e && e.stopPropagation) e.stopPropagation()
  dispatch({ type: "BUSY", busy: true })
  try { await fn() } catch (err) { await info("Что-то пошло не так", String(err && err.message || err)) }
  dispatch({ type: "BUSY", busy: false })
  reload(dispatch)
}

const RRULE_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]
function rrule(recur) {
  if (!recur) return ""
  if (recur.freq === "daily") return "FREQ=DAILY;INTERVAL=1"
  const days = recur.days && recur.days.length ? `;BYDAY=${recur.days.map(d => RRULE_DAYS[d]).join(",")}` : ""
  return `FREQ=WEEKLY;INTERVAL=1${days}`
}

// ───────────── Умный режим (Claude) ─────────────
// Разбор фразы через Claude (если в меню добавлен API-ключ). Только для Mac: на iPhone вместо него ассистент.
const { CONFIG, cap, sameDay, fmt } = core
function parseLocalDate(s, defHour) {
  const m = String(s || "").match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : defHour, m[5] ? +m[5] : 0)
}

function normalizeAI(a) {
  if (!a || !["event", "reminder", "note", "expense", "income", "report", "delete"].includes(a.kind)) return null
  if (a.kind === "report") return { kind: "report" }
  const toJsDays = arr => Array.isArray(arr) && arr.length ? arr.map(d => +d % 7) : null
  if (a.kind === "delete") {
    const dd = parseLocalDate(a.date, 12)
    return { kind: "delete", query: String(a.query || ""), days: toJsDays(a.weekdays), date: dd,
      what: ["events", "reminders"].includes(a.target) ? a.target : "both" }
  }
  if (a.kind === "expense" || a.kind === "income") {
    const names = CONFIG.categories[a.kind].map(c => c[0])
    const sd = parseLocalDate(a.spent_date, 12)
    return {
      kind: a.kind,
      amount: +a.amount > 0 ? +a.amount : null,
      method: a.method === "cash" || a.method === "transfer" ? a.method : null,
      category: names.includes(a.category) ? a.category : null,
      comment: a.comment || "",
      at: sd && !sameDay(sd, new Date()) ? sd.getTime() : Date.now(),
    }
  }
  if (a.kind === "note") return a.title ? { kind: "note", title: cap(String(a.title)) } : null
  const date = parseLocalDate(a.date, CONFIG.defaultReminderHour)
  let recur = null
  if (a.repeat && a.repeat.freq === "daily") recur = { freq: "daily" }
  else if (a.repeat && a.repeat.freq === "weekly") recur = { freq: "weekly", days: toJsDays(a.repeat.days) || (date ? [date.getDay()] : []) }
  let minutes = +a.duration_min > 0 ? +a.duration_min : null
  const em = String(a.end || "").match(/(\d{1,2}):(\d{2})/)
  if (date && em) { const end = (+em[1]) * 60 + (+em[2]), st = date.getHours() * 60 + date.getMinutes(); if (end > st) minutes = end - st }
  return {
    recur,
    kind: a.kind,
    title: cap(String(a.title || (a.kind === "event" ? "Встреча" : "Напоминание"))),
    date, hasTime: !!(date && a.has_time),
    minutes: minutes || CONFIG.defaultEventMinutes,
    location: a.location || null,
  }
}

function aiSystemPrompt(now) {
  const cats = t => CONFIG.categories[t].map(c => c[0]).join(", ")
  return `Ты разбираешь голосовые команды на русском для личного планировщика и учёта денег в тайских батах.
Сейчас: ${fmt("yyyy-MM-dd HH:mm").string(now)}, ${fmt("EEEE").string(now)}.
Одна фраза может содержать несколько команд — верни их все, в порядке упоминания.
Ответь ТОЛЬКО JSON-массивом без пояснений. Каждый элемент — объект с полем "kind":
- "event" — встреча, созвон, приём, визит, игра, турнир, занятие: {"kind","title","date":"YYYY-MM-DD HH:MM"|null,"has_time":bool,"end":"HH:MM"|null,"duration_min":число|null,"location":строка|null,"repeat":повтор|null}
- "reminder" — дело или просьба напомнить: {"kind","title","date":"YYYY-MM-DD HH:MM"|null,"has_time":bool,"repeat":повтор|null}
  повтор: {"freq":"daily"} или {"freq":"weekly","days":[номера дней, 1=понедельник … 7=воскресенье]}; «по средам» → weekly [3], date — ближайшая среда
- "delete" — убрать/удалить/отменить существующее событие или напоминание: {"kind":"delete","query":"ключевое слово из названия, в именительном падеже","weekdays":[1–7]|null,"date":"YYYY-MM-DD"|null,"target":"events"|"reminders"|"both"}
- "note" — мысль, идея, то, что надо просто записать: {"kind","title"}
- "expense" / "income" — деньги с суммой: {"kind","amount":число в батах,"method":"cash"|"transfer"|null,"category":строка|null,"comment":кратко что это,"spent_date":"YYYY-MM-DD"|null}
- "report" — просьба показать отчёт по деньгам: {"kind":"report"}
Категории расходов: ${cats("expense")}.
Категории доходов: ${cats("income")}.
Правила: category — строго одна из списка или null. method: наличные/нал/кэш → "cash"; перевод/карта/QR/банк → "transfer"; не сказано → null.
Относительные даты («завтра», «в пятницу», «через 2 часа») переводи в абсолютные. Время 1–6 без «утра» считай дневным (13–18).
title — коротко, с заглавной буквы, без слов «напомни», «встреча» оставляй только если это суть («Встреча с риелтором»).
Слова «добавь», «создай», «поставь» в title не включай. «С семи до девяти» — это интервал: для спорта, турниров, ужинов и развлечений по умолчанию вечер (19:00–21:00), для работы и врачей — утро.
Распознавание речи может искажать слова («падал», «падлу» вместо «падел») — восстанавливай очевидный смысл.
Если «5 тысяч» — amount 5000. spent_date заполняй, только если трата была не сегодня («вчера»).`
}


const KEY_CMD = `security find-generic-password -s myday-anthropic -a myday -w 2>/dev/null`

async function aiParse(heard) {
  try {
    const has = (await run(`${KEY_CMD} >/dev/null && echo yes || echo no`)).trim() === "yes"
    if (!has) return null
    const body = JSON.stringify({ model: core.CONFIG.aiModel, max_tokens: 1500,
      system: aiSystemPrompt(new Date()), messages: [{ role: "user", content: heard }] })
    const out = await run(`printf %s ${b64(body)} | base64 -D > /tmp/myday-ai.json && ` +
      `curl -s --max-time 25 https://api.anthropic.com/v1/messages -H "x-api-key: $(${KEY_CMD})" ` +
      `-H "anthropic-version: 2023-06-01" -H "content-type: application/json" --data-binary @/tmp/myday-ai.json; ` +
      `rm -f /tmp/myday-ai.json`)
    const res = JSON.parse(out)
    const txt = (res.content || []).map(c => c.text || "").join("")
    const m = txt.match(/\[[\s\S]*\]/)
    if (!m) return null
    return JSON.parse(m[0]).map(normalizeAI).filter(Boolean)
  } catch (e) { return null }
}

async function aiSettings() {
  const has = (await run(`${KEY_CMD} >/dev/null && echo yes || echo no`)).trim() === "yes"
  if (has) {
    const i = await choose("🧠 Умный режим включён", "Команды разбирает Claude.", ["Заменить ключ", "Выключить"])
    if (i === 1) { await run(`security delete-generic-password -s myday-anthropic -a myday >/dev/null 2>&1; true`); return info("Умный режим выключен") }
    if (i !== 0) return
  }
  const key = await ask("🧠 Умный режим", "Вставьте API-ключ Anthropic (console.anthropic.com).\n" +
    "Команды будет разбирать Claude — точнее на свободной речи. Использование API оплачивается отдельно. Ключ хранится в Связке ключей.", "")
  if (!key) return
  await run(`security add-generic-password -U -s myday-anthropic -a myday -w ${q(key)}`)
  const test = await aiParse("заметка проверка связи")
  await info(test && test.length ? "Ключ работает ✓" : "Не удалось подключиться",
    test && test.length ? "Теперь команды разбирает Claude." : "Проверьте ключ и интернет. Пока работает встроенный разбор.")
}

// ───────────── Команды: разбор → уточнение → подтверждение → сохранение ─────────────
async function freshReminders() {
  try { return sortReminders(JSON.parse(await bridge("reminders")).map(toReminder)) } catch (e) { return [] }
}

const fmtShortM = d => `${core.cap(core.SHORT.string(d))}, ${core.TIME.string(d)}`

async function upcomingEvents() { return parseEvents((await run(`"${W}/data.sh" find`)).split("\n")) }

async function answerQuery(a) {
  if (a.topic === "money") {
    const t = core.monthTotals(await loadData("finance"), core.monthKey(new Date()))
    const month = core.MONTH_NOM[new Date().getMonth()]
    if (a.category) {
      const type = a.income ? "income" : "expense"
      const items = t.items.filter(e => e.category === a.category && e.type === type)
      return info(`${a.category} · ${month}`, `${type === "income" ? "Получено" : "Потрачено"}: ${core.money(items.reduce((x, e) => x + e.amount, 0))} (${items.length} опер.)\n\n` +
        items.slice(-6).reverse().map(e => `${core.DM.string(new Date(e.date))} ${core.money(e.amount)}${e.comment ? " · " + e.comment : ""}`).join("\n"))
    }
    const top = Object.entries(t.cats.expense).sort((x, y) => y[1] - x[1]).slice(0, 4)
    const b = await confirmBox(`${month}: −${core.money(t.expense)} / +${core.money(t.income)}`,
      `Баланс: ${t.income - t.expense < 0 ? "−" : "+"}${core.money(t.income - t.expense)}` +
      (top.length ? "\n\nБольше всего:\n" + top.map(([n, v]) => `${n}: ${core.money(v)}`).join("\n") : ""), ["Закрыть", "Открыть отчёт"])
    if (b === "Открыть отчёт") await showReport()
    return
  }
  if (a.topic === "when") {
    const list = (await upcomingEvents()).filter(e => e.start >= new Date() && (core.titleMatches(e.title, a.q) || e.title.toLowerCase().includes((a.q || "").toLowerCase())))
    return info(list.length ? list[0].title : "Не нашёл", list.length ? list.slice(0, 4).map(e => `${fmtShortM(e.start)}–${core.TIME.string(e.end)}`).join("\n") : `В ближайший год нет событий «${a.q}».`)
  }
  const day = a.day || core.startOfDay(new Date())
  const evs = (await upcomingEvents()).filter(e => core.sameDay(e.start, day))
  const rems = (await freshReminders()).filter(r => r.dueDate && core.sameDay(r.dueDate, day))
  const lines = evs.map(e => `📅 ${e.allDay ? "весь день" : core.TIME.string(e.start) + "–" + core.TIME.string(e.end)} ${e.title}`)
    .concat(rems.map(r => `⏰ ${r.dueDateIncludesTime ? core.TIME.string(r.dueDate) : "—"} ${r.title}`))
  return info(core.cap(core.FULL.string(day)), lines.length ? lines.join("\n") : "Ничего не запланировано 🎉")
}

async function completeMove(a) {
  const from = a.from ? core.startOfDay(a.from) : new Date(Date.now() - 864e5)
  const to = new Date(from.getTime() + (a.from ? 1 : 45) * 864e5)
  let list = (await upcomingEvents()).filter(e => !e.allDay && e.start >= from && e.start < to && (!a.query || core.titleMatches(e.title, a.query)))
  if (a.fromHasTime) list = list.filter(e => e.start.getHours() === a.from.getHours())
  if (!list.length) { await info("Не нашёл событие", `«${a.query || "…"}»${a.from ? " на " + core.DAY.string(a.from) : " в ближайшие недели"}.`); return null }
  let ev = list[0]
  if (list.length > 1) { const i = await choose("Какое событие перенести?", "Выберите", list.slice(0, 8).map(e => `${e.title} · ${fmtShortM(e.start)}`)); if (i < 0) return null; ev = list[i] }
  let ns
  if (a.shift) ns = new Date(ev.start.getTime() + a.shift * 60000)
  else if (a.toDay || a.toTime) {
    ns = new Date(a.toDay || core.startOfDay(ev.start))
    const [hh, mm] = a.toTime ? a.toTime.split(":").map(Number) : [ev.start.getHours(), ev.start.getMinutes()]
    ns.setHours(hh, mm, 0, 0)
  } else {
    const t = await ask(`Куда перенести «${ev.title}»?`, `Сейчас: ${fmtShortM(ev.start)}. Например: «на 20:00», «на пятницу в 15», «на час позже»`)
    if (!t) return null
    const b = core.buildMove("перенеси x на " + t.replace(/^на\s+/i, ""))
    return completeMove(Object.assign(a, { toDay: b.toDay, toTime: b.toTime, shift: b.shift, from: ev.start, fromHasTime: true, query: ev.title }))
  }
  a.event = { title: ev.title, startDate: ev.start, endDate: ev.end }
  a.newStart = ns
  return a
}

async function completeDone(a) {
  const list = await freshReminders()
  const q = (a.query || "").toLowerCase()
  let hits = list.filter(r => q && (r.title.toLowerCase().includes(q) || core.titleMatches(r.title, a.query)))
  if (!hits.length) {
    const i = await choose(`Не нашёл напоминание «${a.query || "…"}»`, "Что сделать?", ["Выбрать из списка", "Записать как заметку"])
    if (i === 1) { a.kind = "note"; a.title = core.cap(a.query || "Сделано"); return a }
    if (i !== 0 || !list.length) return null
    hits = list
  }
  let r = hits[0]
  if (hits.length > 1) { const i = await choose("Что отметить выполненным?", "Выберите", hits.slice(0, 10).map(x => x.title)); if (i < 0) return null; r = hits[i] }
  a.reminder = r
  return a
}

async function completeAction(a) {
  if (a.kind === "query") { await answerQuery(a); return null }
  if (a.kind === "move") return completeMove(a)
  if (a.kind === "done") return completeDone(a)
  if (!a.kind) {
    const opts = [["📅 Встреча", "event"], ["⏰ Напоминание", "reminder"], ["📝 Заметка", "note"],
      ["➖ Расход", "expense"], ["➕ Доход", "income"], ["↔️ Перенести событие", "move"], ["✅ Отметить выполненным", "done"], ["🗑 Удалить", "delete"]]
    const i = await choose("Что это?", `«${a.raw}»`, opts.map(o => o[0]))
    if (i < 0) return null
    return completeAction(core.buildActions([{ text: a.raw, kind: opts[i][1] }])[0])
  }
  if (a.kind === "delete") {
    const hasQ = core.words(a.query).length > 0
    if (!hasQ && !a.date) { await info("Что удалить?", "Назовите событие или напоминание, например: «убери падел по вторникам»"); return null }
    const okDay = d => !a.days || a.days.includes(d.getDay())
    const all = parseEvents((await run(`"${W}/data.sh" find`)).split("\n"))
    a.events = a.what === "reminders" ? [] : all.filter(e => okDay(e.start) &&
      (!a.date || core.sameDay(e.start, a.date)) && (!hasQ || core.titleMatches(e.title, a.query)))
    a.reminders = a.what === "events" ? [] : (await freshReminders()).filter(r =>
      (!hasQ || core.titleMatches(r.title, a.query)) && (!a.days || (r.dueDate && okDay(r.dueDate))) &&
      (!a.date || (r.dueDate && core.sameDay(r.dueDate, a.date))))
    if (!a.events.length && !a.reminders.length) {
      await info("Нечего удалять", `Не нашёл «${a.query || "…"}»` +
        `${a.days ? " " + core.recurLabel({ freq: "weekly", days: a.days }) : ""}` + " в календаре и напоминаниях.")
      return null
    }
    return a
  }
  if (a.kind === "note" && !a.title) { a.title = await ask("📝 Заметка", "Текст заметки"); if (!a.title) return null }
  if (a.kind === "event" && (!a.date || !a.hasTime)) {
    const t = await ask(`📅 ${a.title}`, "Когда? Например: «завтра в 15:00», «в пятницу с 19 до 21», «25 октября в 11»")
    if (!t) return null
    const w = core.parseWhen(" " + core.normalizeSpeech(t) + " ", a.date ? core.startOfDay(a.date) : null)
    if (!w.date) { await info("Не понял время", t); return null }
    a.date = w.date; a.hasTime = true
    if (w.minutes) a.minutes = w.minutes
    if (w.recur) a.recur = w.recur
  }
  if (a.kind === "expense" || a.kind === "income") {
    const label = `${core.TYPE[a.kind]}${a.comment ? ": " + a.comment : ""}`
    if (!a.amount) {
      const t = await ask(label, "Сумма в батах")
      a.amount = t ? parseFloat(core.normalizeSpeech(t).replace(/[^\d.,]/g, "").replace(",", ".")) : NaN
      if (!(a.amount > 0)) return null
    }
    if (!a.method) {
      const i = await choose(label, `${core.money(a.amount)} — наличные или перевод?`, ["💵 Наличные", "💳 Перевод"])
      if (i < 0) return null
      a.method = i === 0 ? "cash" : "transfer"
    }
    if (!a.category) {
      const names = core.CONFIG.categories[a.kind].map(c => c[0])
      const i = await choose(label, `${core.money(a.amount)} — категория`, names)
      if (i < 0) return null
      a.category = names[i]
    }
  }
  return a
}

async function executeAll(list) {
  let notes = null, money = null, openReport = false, recurWarn = false
  for (const a of list) {
    if (a.kind === "event") {
      const cal = await targetCalendar()
      if (!cal) continue
      await bridge("add-event", a.title, localISO(a.date), String(a.minutes || core.CONFIG.defaultEventMinutes),
        rrule(a.recur), a.location || "", cal)
    } else if (a.kind === "reminder") {
      await bridge("add-reminder", a.title, a.date ? localISO(a.date) : "")
      if (a.recur) recurWarn = true
    } else if (a.kind === "delete") {
      const titles = [...new Set(a.events.map(e => e.title))]
      if (titles.length) await bridge("delete-events", JSON.stringify(titles), a.days ? JSON.stringify(a.days) : "", a.date ? localISO(a.date) : "")
      if (a.reminders.length) await bridge("delete-reminders", JSON.stringify(a.reminders.map(r => r.identifier)))
    } else if (a.kind === "move") {
      const r = await bridge("move-event", a.event.title, localISO(a.event.startDate), localISO(a.newStart))
      if (r === "recurring") await info("Повторяющееся событие", `«${a.event.title}» повторяется — на Mac его можно перенести только целиком. Скажите эту команду на iPhone, и он перенесёт одно повторение.`)
      else if (r !== "ok") await info("Не удалось перенести", a.event.title)
    } else if (a.kind === "done") {
      await bridge("complete-reminder", a.reminder.identifier)
    } else if (a.kind === "note") {
      notes = notes || []
      notes.push({ id: newId("n"), text: a.title, date: Date.now(), u: Date.now() })
    } else if (a.kind === "report") {
      openReport = true
    } else {
      money = money || []
      money.push({ id: newId("f"), date: a.at || Date.now(), u: Date.now(),
        type: a.kind, amount: a.amount, method: a.method, category: a.category, comment: a.comment || "" })
    }
  }
  if (notes) await saveData("notes", notes)
  if (money) await saveData("finance", money)
  if (recurWarn) await info("Напоминание создано", "Повтор для напоминаний на Mac задаётся в приложении «Напоминания» — на iPhone он ставится автоматически.")
  if (openReport) await showReport()
}

async function voiceCommand(given) {
  const heard = given || await ask("🎤 Мой день",
    "Скажите или напишите команду. Диктовка — клавиша 🎤 (F5) или дважды Fn.\n\n" +
    "Например: «завтра в 10 встреча с Олей, потратил 300 бат на такси наличными и напомни в 18 купить цветы»")
  if (!heard) return
  let actions = await aiParse(heard)
  const byAI = !!(actions && actions.length)
  if (!byAI) actions = core.buildActions(core.splitCommands(core.normalizeSpeech(heard)))
  if (!actions.length) actions = [{ kind: null, raw: heard }]
  if (actions.length === 1 && actions[0].kind === "report") return showReport()

  const ready = []
  for (const a of actions) { const r = await completeAction(a); if (r) ready.push(r) }
  if (!ready.length) return
  const one = ready.length === 1
  const msg = ready.map(core.describe).join("\n") + `\n\n🎤 «${heard}»` + (byAI ? "\n🧠 Разобрано Claude" : "")
  const b = await confirmBox(one ? "Сохранить?" : `Сохранить ${ready.length} ${core.plural(ready.length)}?`, msg,
    ["Отмена", "Исправить текст", one ? "Сохранить" : "Сохранить всё"])
  if (b === "Исправить текст") { const t = await ask("Исправить команду", "Текст команды", heard); return t ? voiceCommand(t) : undefined }
  if (b === "Сохранить" || b === "Сохранить всё") await executeAll(ready)
}

// ───────────── Ручной ввод, заметки, деньги, отчёт ─────────────
async function addNote() {
  const t = await ask("📝 Быстрая заметка", "Что запомнить?")
  if (!t) return
  await saveData("notes", [{ id: newId("n"), text: t, date: Date.now(), u: Date.now() }])
}

async function addMoney() {
  const i = await choose("฿ Деньги", "Что записать?", ["➖ Расход", "➕ Доход"])
  if (i < 0) return
  const type = i === 0 ? "expense" : "income"
  const comment = await ask(core.TYPE[type], "Комментарий (необязательно) — например «кафе» или «зарплата»", "") || ""
  const p = core.parseMoney(comment, type)
  const a = await completeAction({ kind: type, amount: p.amount, method: p.method, category: p.category, comment, at: Date.now() })
  if (!a) return
  await saveData("finance", [{ id: newId("f"), date: Date.now(), u: Date.now(), type,
    amount: a.amount, method: a.method, category: a.category, comment: a.comment || "" }])
  const t = core.monthTotals(await loadData("finance"), core.monthKey(new Date()))
  await info("Сохранено ✓", `${core.describe(a)}\n\nЗа месяц: −${core.money(t.expense)} / +${core.money(t.income)}`)
}

async function manageNotes() {
  const notes = await loadData("notes")
  if (!notes.length) return info("Заметок пока нет")
  const i = await choose("🗒 Заметки", "Выберите заметку", notes.map(n => n.text.length > 70 ? n.text.slice(0, 70) + "…" : n.text))
  if (i < 0) return
  const a = await choose("Заметка", notes[i].text, ["📋 Скопировать", "🗑 Удалить"])
  if (a === 0) await run(`printf %s ${b64(notes[i].text)} | base64 -D | pbcopy`)
  if (a === 1) await saveData("notes", [], [notes[i].id])
}

async function manageMoney() {
  const list = await loadData("finance")
  const last = list.slice().sort((a, b) => b.date - a.date).slice(0, 40)
  if (!last.length) return info("Операций пока нет")
  const labels = last.map(e => `${core.DM.string(new Date(e.date))}  ${e.type === "expense" ? "−" : "+"}${core.money(e.amount)} · ${e.category}${e.comment ? " · " + e.comment : ""}`)
  const i = await choose("🧾 Последние операции", "Выберите ошибочную запись, чтобы удалить", labels)
  if (i < 0) return
  const b = await confirmBox("Удалить запись?", labels[i], ["Отмена", "Удалить"])
  if (b === "Удалить") await saveData("finance", [], [last[i].id])
}

async function showReport(key) {
  const list = await loadData("finance")
  if (!key) {
    const keys = [...new Set(list.map(e => core.monthKey(new Date(e.date))).concat([core.monthKey(new Date())]))].sort().reverse()
    if (keys.length > 1) {
      const i = await choose("📊 Отчёт", "За какой месяц?", keys.map(core.monthTitle))
      if (i < 0) return
      key = keys[i]
    } else key = keys[0]
  }
  await run(`printf %s ${b64(core.reportHTML(key, list))} | base64 -D > /tmp/myday-report.html && open /tmp/myday-report.html`)
  const i = await choose(`📊 ${core.monthTitle(key)}`, "Отчёт открыт в браузере. Что ещё?", ["📋 Скопировать текстом", "📄 Сохранить CSV в Загрузки", "Готово"])
  if (i === 0) {
    await run(`printf %s ${b64(core.reportText(key, list))} | base64 -D | pbcopy`)
    await info("Скопировано", "Отчёт в буфере обмена — можно вставить в чат с Claude для разбора")
  }
  if (i === 1) {
    await run(`printf %s ${b64(core.reportCSV(key, list))} | base64 -D > "$HOME/Downloads/finance-${key}.csv"`)
    await info("Сохранено", `Загрузки → finance-${key}.csv`)
  }
}

async function syncStatus() {
  const sh = `D="${ICLOUD}"; if [ -d "$D" ]; then echo "folder:yes"; else echo "folder:no"; fi; ` +
    `for f in notes finance; do if [ -f "$D/$f.json" ]; then echo "$f:$(stat -f '%Sm' -t '%d.%m %H:%M' "$D/$f.json")"; ` +
    `elif [ -f "$D/.$f.json.icloud" ]; then echo "$f:cloud"; else echo "$f:none"; fi; done`
  const out = await run(sh)
  const get = k => ((out.match(new RegExp(`^${k}:(.*)$`, "m")) || [])[1] || "").trim()
  const lines = []
  lines.push(get("folder") === "yes" ? "☁️ Общая папка с iPhone найдена ✓" :
    "⚠️ Общая папка не найдена. Включите iCloud Drive на Mac и для Scriptable на iPhone, затем запишите что-нибудь на iPhone.")
  for (const [k, label] of [["notes", "Заметки"], ["finance", "Деньги"]]) {
    const st = get(k)
    const n = (await loadData(k)).length
    lines.push(`${label}: ${n} записей · ${st === "none" ? "файла ещё нет" : st === "cloud" ? "ещё скачивается из iCloud" : "изменён " + st}`)
  }
  let cal = MAC.calendar
  try { cal = cal || localStorage.getItem(CAL_KEY) } catch (e) {}
  lines.push(`Календарь для новых событий: ${cal || "ещё не выбран"}`)
  lines.push("\nНа iPhone: Scriptable → MyDay → «Синхронизация с Mac» — числа записей должны совпадать.")
  const b = await confirmBox("☁️ Синхронизация с iPhone", lines.join("\n"), ["Готово", "Сменить календарь"])
  if (b === "Сменить календарь") await targetCalendar(true)
}

async function menu(dispatch) {
  const items = [
    ["🎤 Команда (голосом или текстом)", voiceCommand],
    ["฿ Расход / доход", addMoney],
    ["📝 Быстрая заметка", addNote],
    ["🗒 Мои заметки", manageNotes],
    ["📊 Отчёт за месяц", () => showReport()],
    ["🧾 Последние операции", manageMoney],
    ["▦ Google Таблица", sheetMenu],
    ["☁️ Синхронизация с iPhone", syncStatus],
    ["🧠 Умный режим (Claude)", aiSettings],
    ["↩️ Вернуть виджет в угол экрана", async () => { try { localStorage.removeItem(POS_KEY) } catch (e) {} }],
    ["🔄 Обновить", async () => {}],
  ]
  const i = await choose("Мой день", "Что сделать?", items.map(x => x[0]))
  if (i >= 0) await items[i][1]()
}

// ───────────── Оформление (фирменный стиль) ─────────────
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})` }
const stripEmoji = t => String(t || "").replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+|[\s\uFE0F\u200D\p{Extended_Pictographic}]+$/gu, "") || t
const panel = css`
  --text: #F6F1E4; --sub: #A9BBAE; --gold: ${BRAND.goldLight}; --line: rgba(212,162,60,.55);
  --bg: linear-gradient(160deg, rgba(13,59,42,.92), rgba(5,35,26,.94)); --btn: #1D5A43; --hover: rgba(240,204,96,.08);
  --expense: #E07A55;
  @media (prefers-color-scheme: light) {
    --text: ${BRAND.emeraldDeep}; --sub: #6E7D72; --gold: ${BRAND.goldDark}; --line: rgba(212,162,60,.7);
    --bg: linear-gradient(160deg, rgba(251,248,240,.95), rgba(241,234,216,.95)); --btn: ${BRAND.emerald}; --hover: rgba(11,74,51,.06);
    --expense: ${BRAND.terracotta};
  }
  box-sizing: border-box; width: 100%; padding: 18px 18px 14px; border-radius: 24px;
  background: var(--bg); color: var(--text);
  -webkit-backdrop-filter: blur(30px) saturate(1.4); backdrop-filter: blur(30px) saturate(1.4);
  box-shadow: 0 14px 44px rgba(0,0,0,.28), inset 0 0 0 1px rgba(212,162,60,.35);
  font: 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  -webkit-font-smoothing: antialiased; user-select: none; cursor: default;
`
const header = css`display: flex; align-items: center; gap: 7px;`
const dateCss = css`flex: 1; cursor: grab; &:active { cursor: grabbing; } font: 700 21px Georgia, "Times New Roman", serif;
  letter-spacing: -.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`
const btn = css`
  width: 32px; height: 32px; border-radius: 16px; display: grid; place-items: center; cursor: pointer;
  background: var(--btn); color: ${BRAND.goldLight}; font-size: 14px; font-weight: 700;
  box-shadow: inset 0 0 0 1px rgba(240,204,96,.35); transition: transform .12s, filter .12s;
  &:hover { filter: brightness(1.2); transform: scale(1.06); } &:active { transform: scale(.94); }
`
const divider = css`display: flex; align-items: center; gap: 8px; margin: 12px 0 12px; color: ${BRAND.gold}; font-size: 7px;
  &::before, &::after { content: ""; flex: 1; height: 1px; background: var(--line); }`
const grid = css`display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px 8px; margin-bottom: 4px;`
const dayCol = css`min-width: 0; cursor: pointer; border-radius: 10px; padding: 0 0 4px; &:hover { background: var(--hover); }`
const dayHead = (today, past, weekend) => css`
  display: flex; align-items: baseline; justify-content: space-between; height: 24px; padding: 0 9px; margin-bottom: 6px;
  border-radius: 12px; background: ${today ? BRAND.gold : "transparent"};
  .w { font-size: 10px; font-weight: 800; letter-spacing: .5px; line-height: 24px;
       color: ${today ? BRAND.emeraldDeep : past ? "var(--sub)" : weekend ? "var(--gold)" : "var(--sub)"}; }
  .d { font: 800 17px ui-rounded, -apple-system; line-height: 24px; color: ${today ? BRAND.emeraldDeep : past ? "var(--sub)" : "var(--text)"}; }
`
const chip = (it, past) => {
  const rem = it.kind === "rem"
  const c = it.color
  return css`
    margin-bottom: 4px; padding: 4px 7px 5px; border-radius: 8px; cursor: pointer; overflow: hidden;
    background: ${rem ? rgba(c, past ? 0.1 : 0.18) : rgba(c, past ? 0.25 : 0.95)};
    ${rem ? `box-shadow: inset 0 0 0 1px ${rgba(c, past ? 0.35 : 0.85)};` : ""}
    &:hover { filter: brightness(1.12); }
    .t { font: 700 10px ui-rounded, -apple-system; color: ${past ? "var(--sub)" : rem ? (it.late ? BRAND.terracotta : "var(--gold)") : BRAND.goldLight}; }
    .n { font-size: 11.5px; font-weight: 600; line-height: 1.2; color: ${past ? "var(--sub)" : rem ? "var(--text)" : "#FFFFFF"};
         display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
  `
}
const more = css`text-align: center; font-size: 10px; font-weight: 700; color: var(--gold);`
const emptyDay = css`text-align: center; color: ${rgba(BRAND.gold, 0.5)}; font-weight: 800;`
const monthTileCss = css`
  border-radius: 12px; padding: 9px 10px; cursor: pointer; background: ${rgba(BRAND.gold, 0.12)};
  box-shadow: inset 0 0 0 1px ${rgba(BRAND.gold, 0.6)}; &:hover { filter: brightness(1.08); }
  .m { font-size: 10px; font-weight: 800; letter-spacing: .5px; color: var(--gold); margin-bottom: 6px; }
  .e { font: 700 14px ui-rounded, -apple-system; color: var(--expense); }
  .i { font: 700 14px ui-rounded, -apple-system; color: ${BRAND.teal}; margin-top: 2px; }
  .b { font-size: 11px; font-weight: 600; margin-top: 6px; color: var(--text); }
`
const remLine = css`display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line);
  font-size: 12.5px; cursor: pointer; .ic { color: var(--gold); } .tx { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`
const busyCss = css`font-size: 12px; color: var(--sub); animation: p 1s infinite alternate; @keyframes p { from { opacity: .3 } to { opacity: 1 } }`
const warn = css`font-size: 11.5px; color: ${BRAND.goldDark}; background: ${rgba(BRAND.gold, 0.14)}; border-radius: 8px; padding: 6px 8px; margin-bottom: 10px;`
const fmtK = n => { const v = Math.abs(n); return v >= 1e4 ? `${(Math.round(v / 100) / 10).toString().replace(".", ",")}к ฿` : core.money(v) }

export const className = `top: 0; left: 0;`

// ───────────── Перетаскивание (положение запоминается) ─────────────
const POS_KEY = "myday-pos"
function getPos() {
  try { const p = JSON.parse(localStorage.getItem(POS_KEY)); if (p && isFinite(p.x) && isFinite(p.y)) return p } catch (e) {}
  return null
}
function panelStyle() {
  const p = getPos()
  return p ? { position: "fixed", left: p.x, top: p.y, width: MAC.width }
           : { position: "fixed", top: MAC.top, left: Math.max(0, window.innerWidth - MAC.width - MAC.right), width: MAC.width }
}
function startDrag(e) {
  if (e.button !== 0) return
  const el = e.currentTarget.closest("[data-myday]")
  if (!el) return
  e.preventDefault()
  const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top
  const move = ev => {
    el.style.right = "auto"
    el.style.left = Math.max(0, Math.min(window.innerWidth - 80, ev.clientX - dx)) + "px"
    el.style.top = Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - dy)) + "px"
  }
  const up = () => {
    document.removeEventListener("mousemove", move)
    document.removeEventListener("mouseup", up)
    try { localStorage.setItem(POS_KEY, JSON.stringify({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) })) } catch (err) {}
  }
  document.addEventListener("mousemove", move)
  document.addEventListener("mouseup", up)
}

// ───────────── Отрисовка ─────────────
export const render = ({ output, busy }, dispatch) => {
  const s = sections(output)
  const events = parseEvents(s.EVENTS || [])
  const rems = sortReminders(safeJSON(s.REMINDERS, []).map(toReminder))
  const money = core.visible(core.withIds(safeJSON(s.MONEY, []), "f"))
  const now = new Date()
  const today = core.startOfDay(now)
  const totals = core.monthTotals(money, core.monthKey(now))
  const bal = totals.income - totals.expense
  const go = fn => action(dispatch, fn)
  const icalMissing = !!s.NO_ICALBUDDY
  const icalError = !icalMissing && (s.EVENTS || []).some(l => /error|not authorized|access/i.test(l))
  const days = weekDays()
  const undated = rems.filter(r => !r.dueDate)

  const dayCell = day => {
    const items = dayItems(day, events, rems)
    const past = day < today
    const isToday = core.sameDay(day, now)
    const weekend = day.getDay() === 0 || day.getDay() === 6
    const shown = items.length > MAC.chips ? MAC.chips - 1 : MAC.chips
    return (
      <div className={dayCol} key={day.getTime()} title={core.cap(core.FULL.string(day))} onClick={go(() => bridge("show-date", localISO(day)))}>
        <div className={dayHead(isToday, past, weekend)}>
          <span className="w">{core.SHORT.string(day).slice(0, 2).toUpperCase()}</span>
          <span className="d">{day.getDate()}</span>
        </div>
        {!items.length && <div className={emptyDay}>·</div>}
        {items.slice(0, shown).map((it, k) => (
          <div key={k} className={chip(it, past)} title={`${it.time ? it.time + " " : ""}${it.title}`}
            onClick={go(() => it.kind === "rem" ? bridge("show-reminder", it.id) : bridge("show-date", localISO(day)))}>
            {it.time && <div className="t">{it.time}</div>}
            <div className="n">{stripEmoji(it.title)}</div>
          </div>
        ))}
        {items.length > MAC.chips && <div className={more}>+{items.length - shown} ещё</div>}
      </div>
    )
  }

  return (
    <div className={panel} data-myday="1" style={panelStyle()}>
      <div className={header}>
        <div className={dateCss} title="Перетащите, чтобы переместить виджет" onMouseDown={startDrag}>{core.cap(core.FULL.string(now))}</div>
        {busy && <div className={busyCss}>⏳</div>}
        <div className={btn} title="Команда голосом или текстом" onClick={go(() => voiceCommand())}>🎤</div>
        <div className={btn} title="Расход / доход" onClick={go(addMoney)}>฿</div>
        <div className={btn} title="Открыть Google Таблицу с доходами и расходами" onClick={go(openSheet)}>▦</div>
        <div className={btn} title="Быстрая заметка" onClick={go(addNote)}>✎</div>
        <div className={btn} title="Меню" onClick={go(() => menu(dispatch))}>☰</div>
      </div>
      <div className={divider}>◆</div>

      {icalMissing && <div className={warn}>Календарь не подключён: выполните в Терминале «brew install ical-buddy»</div>}
      {icalError && <div className={warn}>Нет доступа к Календарю: Системные настройки → Конфиденциальность → Календари → разрешите Übersicht</div>}

      <div className={grid}>
        {days.map(dayCell)}
        {Array.from({ length: (5 - (days.length % 5)) % 5 }).map((_, i) => i === 0 ? (
          <div key="m" className={monthTileCss} title="Отчёт за месяц" onClick={go(() => showReport())}>
            <div className="m">{core.MONTH_NOM[now.getMonth()].toUpperCase()}</div>
            <div className="e">−{fmtK(totals.expense)}</div>
            <div className="i">+{fmtK(totals.income)}</div>
            <div className="b">= {bal < 0 ? "−" : ""}{fmtK(bal)}</div>
          </div>
        ) : <div key={"x" + i} />)}
      </div>

      {undated.length > 0 && (
        <div className={remLine} title="Напоминания без срока" onClick={go(() => bridge("show-reminder", ""))}>
          <span className="ic">☑︎</span>
          <span className="tx">{undated.slice(0, 4).map(r => r.title).join("  ·  ")}</span>
        </div>
      )}
    </div>
  )
}
