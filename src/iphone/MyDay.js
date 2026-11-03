// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: calendar-check;

/*
 * «Мой день» — виджет для iPhone (Scriptable)
 * Календарь на неделю + напоминания + быстрые заметки + голосовые команды
 * + учёт доходов и расходов с ежемесячным отчётом.
 * + личный трекер в Google Таблице.   // [личное]
 *
 * Кнопки в шапке виджета (средний и большой размер):
 *   🎤 — голосовая команда   📷 — еда по фото   ฿ — расход/доход
 *   ▦ — Google Таблица денег   ✎ — заметка (в личной версии 💬 — чат с помощником)
 *   ✓ — личный трекер (сегодняшняя строка)   // [личное]
 * Нажатие на день календаря открывает его в «Календаре».
 * Нажатие на строку месяца внизу большого виджета открывает отчёт.
 *
 * Голосом можно говорить свободно и несколько дел сразу:
 *   «Завтра в 10 встреча с Олей, потратил 300 на такси наличными
 *    и напомни в 18 купить цветы»
 * Без API-ключа работает встроенный разбор. С ключом Anthropic (меню →
 * «Умный режим») фразы разбирает Claude — точнее на свободной речи.
 *
 * Примеры голосовых команд:
 *   «Заметка купить батарейки для пульта»
 *   «Напомни завтра в 9 утра позвонить в банк»
 *   «Напомни через 2 часа забрать посылку»
 *   «Встреча в пятницу в 15:00 с риелтором»
 *   «Расход 250 кафе наличными»
 *   «Потратил 1200 на такси переводом»
 *   «Доход 30000 зарплата перевод»
 *   «Отчёт»
 *
 * Параметр виджета (Изменить виджет → Parameter):
 *   пусто    — средний виджет: встречи + напоминания
 *   неделя   — средний виджет: календарь на неделю
 *   здоровье — средний/маленький виджет: еда, вода, активность с часов
 *
 * 📷 в шапке — сфотографировать еду, Claude посчитает калории (нужен ключ ассистента).
 * Данные Apple Watch передаёт Быстрая команда «Мой день - здоровье» (см. README).
 */

// ═══ ЛИЧНЫЕ НАСТРОЙКИ (начало) ═══ build.py заменяет этот блок для версии другим людям
// ───────────── Настройки ─────────────
const CONFIG = {
  daysAhead: 2,                  // на сколько дней вперёд показывать встречи (средний виджет)
  notifyReminders: true,         // присылать уведомление в момент напоминания
  defaultReminderHour: 9,        // если сказали день без времени
  defaultEventMinutes: 60,       // длительность встречи по умолчанию (голосом)
  currency: "฿",                 // значок валюты в суммах
  currencyIcon: "bahtsign",      // значок кнопки денег в виджете (SF Symbols)
  currencyIn: "в батах",         // «Сумма в батах»
  currencyWords: "бат\\S*|฿",     // как валюту называют голосом (вырезается из комментария)
  agentModel: "claude-sonnet-5-5", // модель ассистента: выполняет команды, уточняет, отвечает
  aiProxy: "",                   // общий доступ к Claude через чужой Google-скрипт (версия для друзей); свой ключ важнее
  aiProxyToken: "",
  monthlyReportNotification: true, // 1-го числа в 10:00 прислать уведомление с отчётом
  assistantChat: true,           // кнопка 💬 — чат с помощником Claude вместо заметок; 🎤 сразу слушает и пишет в этот чат
  briefs: { morning: "08:00", evening: "21:00" },
  eventAlertMinutes: 10,         // с веб-приложением виджет сам присылает уведомления о встречах (за N минут) и напоминаниях
  routes: "__ROUTES__",          // маршруты в Claude Code из secrets.json (routes); заданные в меню 🤖 важнее   // утренняя и вечерняя сводка помощника (уведомление → чат); "" — без сводки
  webApp: "__WEB_APP__",         // веб-приложение «Мой день» (build.py берёт web_app из secrets.json): кнопки виджета открывают его, а виджет передаёт ему календарь и напоминания
  // Google Таблица с доходами и расходами (кнопка ▦ в виджете)
  sheetUrl: "https://docs.google.com/spreadsheets/d/1dsrjcRimF85iZptC0WOyLImhe-llh4BOJmSgGzK_om8/edit",
  sheetSecret: "__SHEET_SECRET__",   // совпадает с ключом в скрипте таблицы
  sheetHook: "__SHEET_HOOK__",   // веб-приложение таблицы (автозапись)
  // Личный трекер (кнопка ✓): открывается строка сегодняшнего дня. Пусто — кнопки нет
  trackerUrl: "https://docs.google.com/spreadsheets/d/10ZbtTHqkdcKRVE8kzivCCRdjdKOGLF3azeM1-6xg8aw/edit#gid=0",
  trackerStart: "2026-10-01",    // дата во 2-й строке листа «Дни»
  // Еда, вода и активность с Apple Watch (кнопка 📷, параметр виджета «здоровье»)
  health: { waterGoal: 2000, glass: 250, moveGoal: 500, exerciseGoal: 30, weight: 92 },   // weight, кг — для оценки тренировок без часов
  large:  { today: 3, rows: 5 },   // до 3 событий сегодня; вместе с напоминаниями — 5 строк (строка дней выше: в ней названия)
  medium: { events: 3, reminders: 3, weekChips: 2 },
  // Календари и списки напоминаний, которые можно назвать голосом.
  // calendar — имя календаря событий, list — имя списка напоминаний, words — как вы их называете.
  calendars: [
    { calendar: "Семейная группа", list: "Семья", hint: "«семейный календарь», «календарь семья»",
      words: /(?:^|\s)(?:в|во|на)?\s*(?:семейн\S*\s+календар\S*|календар\S*\s+(?:семь\S*|семейн\S*))(?=[\s,.]|$)/i },
    { calendar: "PTP", list: "Работа", hint: "«рабочий», «питипи», «PTP»",
      words: /(?:^|\s)(?:в|во|на)?\s*(?:(?:рабоч\S*|питипи|пи[\s-]*ти[\s-]*пи|пэ[\s-]*тэ[\s-]*пэ|ptp)\s+календар\S*|календар\S*\s+(?:рабоч\S*|питипи|пи[\s-]*ти[\s-]*пи|пэ[\s-]*тэ[\s-]*пэ|ptp)|питипи|пи[\s-]*ти[\s-]*пи|пэ[\s-]*тэ[\s-]*пэ|ptp)(?=[\s,.]|$)/i },
  ],
  week: {
    daysBefore: 0,               // прошедшие дни не показываются: их события уже ушли из виджета
    daysFromToday: 7,            // сколько дней показывать начиная с сегодня
    colWidth: 57,                // ширина колонки дня (5 колонок в строке)
  },
  // Категории: [название, [слова для распознавания голосом]]
  categories: {
    expense: [
      // первым: «пиво в супермаркете» — это алкоголь, а не продукты
      ["Алкоголь",         ["алкогол", "пиво", "пива", " вино ", " вина ", " вином ", " вине ", "виски", "водк", "коньяк", "шампанск", "сидр", "текил",
                            "коктейл", "выпивк", "бухл", " лео ", "чанг", "сингх", "бар "]],   // пробелы: не «виноград», не «половина»
      ["Еда и продукты",   ["продукт", "еда", "супермаркет", "макро", "севен", "7-eleven", "рынок", "фрукт", "овощ"]],
      ["Кафе и рестораны", ["кафе", "ресторан", "кофе", "обед", "ужин", "завтрак", "доставк"]],
      ["Транспорт",        ["такси", "грэб", "граб", "grab", "болт", "bolt", "бензин", "метро", "автобус", "байк", "мото", "парковк"]],
      ["Жильё",            ["аренд", "квартир", "кондо", "коммунал", "электрич", "за свет", "за воду"]],
      ["Связь и интернет", ["связь", "интернет", "телефон", "симк", "мобильн"]],
      ["Покупки",          ["одежд", "покупк", "шопинг", "техник", "обув"]],
      ["Здоровье",         ["аптек", "врач", "лекарств", "больниц", "стоматолог", "массаж"]],
      ["Спорт",            ["спорт", "фитнес", "тренир", "бассейн"]],
      ["Развлечения",      ["кино", "клуб", "развлеч", "концерт"]],
      ["Путешествия",      ["отель", "билет", "перелёт", "перелет", "виза", "поездк"]],
      ["Подарки",          ["подар"]],
      ["Другое",           []],
    ],
    income: [
      ["Зарплата",          ["зарплат", "оклад", "аванс"]],
      ["Фриланс и проекты", ["фриланс", "заказ", "проект", "клиент"]],
      ["Подарок",           ["подар"]],
      ["Возврат / кэшбэк",  ["возврат", "вернул", "кэшбэк", "кешбэк"]],
      ["Продажа",           ["продал", "продаж"]],
      ["Другое",            []],
    ],
  },
}

// Цвета в стиле Apple (как приложение IZIDAY): белые/графитовые карточки, изумрудный акцент, системные цвета iOS.
// Имена ключей остались прежними (gold — акцент, goldLight — текст на цветном), чтобы не переписывать отрисовку
const BRAND = {
  emerald: "#0A9F6E", emeraldDeep: "#1C1C1E", emeraldMid: "#30D158",
  gold: "#0A9F6E", goldLight: "#FFFFFF", goldDark: "#0A9F6E",
  teal: "#0A84FF", cream: "#F2F2F7", sand: "#FFFFFF", terracotta: "#FF3B30",
}
// ═══ ЛИЧНЫЕ НАСТРОЙКИ (конец) ═══
const dyn = (light, dark) => Color.dynamic(new Color(light), new Color(dark))
const dynA = (light, la, dark, da) => Color.dynamic(new Color(light, la), new Color(dark, da))
const C = {
  bgTop:    dyn("#F2F2F7", "#000000"),          // фон как в приложении
  bgBottom: dyn("#F2F2F7", "#000000"),
  card:     dyn("#FFFFFF", "#1C1C1E"),          // белые карточки
  weekend:  dyn("#FF3B30", "#FF453A"),
  text:     dyn("#1C1C1E", "#FFFFFF"),
  sub:      dyn("#8E8E93", "#98989F"),
  gold:     dyn("#0A9F6E", "#30D158"),          // акцент
  line:     dyn("#E5E5EA", "#38383A"),
  events:   dyn("#0A84FF", "#0A84FF"),
  rem:      dyn("#FF9500", "#FF9F0A"),
  notes:    dyn("#5856D6", "#5E5CE6"),
  overdue:  dyn("#FF3B30", "#FF453A"),
  income:   dyn("#0A9F6E", "#30D158"),
  expense:  dyn("#FF3B30", "#FF453A"),
  mic:      new Color("#FFFFFF"),
  btnBg:    dynA("#0A9F6E", 0.12, "#30D158", 0.18),
  btnFg:    dyn("#0A9F6E", "#30D158"),
  todayBg:  dyn("#0A9F6E", "#30D158"),
  todayFg:  new Color("#FFFFFF"),
  chipText: new Color("#FFFFFF"),
  cell:     dyn("#FFFFFF", "#1C1C1E"),          // ячейки дней недели — белые, как в приложении
  soft:     dynA("#0A9F6E", 0.14, "#30D158", 0.20),
  hint:     dyn("#C7C7CC", "#48484A"),
}
// Цвета плашек событий: по календарю, из фирменной палитры
const CHIP_COLORS = ["#0A84FF", "#30D158", "#FF9F0A", "#BF5AF2", "#FF375F", "#5AC8FA"]   // системные цвета iOS
function chipColor(calTitle) {
  let h = 0
  for (const ch of calTitle || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return CHIP_COLORS[h % CHIP_COLORS.length]
}

const RUN = URLScheme.forRunningScript()
const WRUN = `${RUN}?from=widget`   // запуск из виджета: после операции — обратно на экран «Домой»
// Веб-приложение «Мой день»: кнопки виджета открывают его вместо Scriptable (быстрее), иначе — этот скрипт
const WEB_APP = /^https:\/\//.test(CONFIG.webApp || "") ? CONFIG.webApp.replace(/[#?].*$/, "") : ""
const APP_ACTIONS = ["voice", "chat", "camera", "money", "water", "food", "health", "note"]
const actURL = action => (WEB_APP && APP_ACTIONS.includes(action) ? `${WEB_APP}#${action}` : `${WRUN}&action=${action}`)
const HOME_URL = WEB_APP || WRUN
const CUR_RE = new RegExp(CONFIG.currencyWords, "gi")   // название валюты в речи — вырезается

// ───────────── Хранилище ─────────────
const IN_ICLOUD = (() => { try { FileManager.iCloud(); return true } catch (e) { return false } })()
const fm = IN_ICLOUD ? FileManager.iCloud() : FileManager.local()
const DIR = fm.joinPath(fm.documentsDirectory(), "my-day")
if (!fm.fileExists(DIR)) fm.createDirectory(DIR, true)

// Файл читается с диска (и из iCloud) один раз за запуск, дальше — из памяти; запись обновляет память
const TEXT = new Map()
async function readText(name) {
  if (TEXT.has(name)) return TEXT.get(name)
  const p = fm.joinPath(DIR, name)
  let t = null
  if (fm.fileExists(p)) try {
    if (fm.isFileStoredIniCloud(p) && !fm.isFileDownloaded(p)) await fm.downloadFileFromiCloud(p)
    t = fm.readString(p)
  } catch (e) {}
  TEXT.set(name, t)
  return t
}
function writeText(name, t) { fm.writeString(fm.joinPath(DIR, name), t); TEXT.set(name, t) }

async function loadJSON(name) {
  try { return JSON.parse(await readText(name)) || [] } catch (e) { return [] }
}
function saveJSON(name, data) { writeText(name, JSON.stringify(data)) }

// ── Синхронизация с Mac: каждая запись имеет id и время изменения u.
// При сохранении свежая версия файла сливается с нашими изменениями по записям,
// поэтому правки, сделанные на другом устройстве, не теряются. Удалённое помечается deleted.
function withIds(list, prefix) {
  return (list || []).map(x => x && x.id ? x : Object.assign({}, x, { id: `${prefix}${x.date}` }))
}

function mergeSynced(fresh, mine, deletedIds) {
  const map = new Map()
  for (const x of fresh || []) map.set(x.id, x)
  for (const x of mine || []) {
    const cur = map.get(x.id)
    if (!cur || (x.u || 0) > (cur.u || 0)) map.set(x.id, x)
  }
  const now = Date.now()
  for (const id of deletedIds || []) map.set(id, { id, deleted: true, u: now })
  const keepTomb = now - 90 * 24 * 3600 * 1000
  return [...map.values()].filter(x => !x.deleted || (x.u || 0) > keepTomb)
}

const visible = list => list.filter(x => x && !x.deleted)
const rawNotes = async () => withIds(await loadJSON("notes.json"), "n")
const rawMoney = async () => withIds(await loadJSON("finance.json"), "f")
const loadNotes = async () => visible(await rawNotes()).sort((a, b) => b.date - a.date)
const loadMoney = async () => visible(await rawMoney())

async function saveNotes(notes, deletedIds = []) {
  const merged = mergeSynced(await rawNotes(), notes, deletedIds).sort((a, b) => (b.date || 0) - (a.date || 0))
  const live = merged.filter(x => !x.deleted)
  const drop = new Set(live.slice(100).map(x => x.id))
  saveJSON("notes.json", merged.filter(x => !drop.has(x.id)))
}
async function saveMoney(list, deletedIds = []) {
  saveJSON("finance.json", mergeSynced(await rawMoney(), list, deletedIds))
  await syncSheet(true)
}

// ── Google Таблица: общие настройки (iCloud, видны и Mac) и автозапись ──
async function loadSettings() {
  try {
    const v = JSON.parse(await readText("settings.json"))
    return v && typeof v === "object" && !Array.isArray(v) ? v : {}
  } catch (e) { return {} }
}
async function saveSettings(patch) {
  const cur = await loadSettings()
  writeText("settings.json", JSON.stringify(Object.assign(cur, patch)))
}

// Отправляет в таблицу все операции и удалённые ID. Таблица сама пропускает те, что уже есть.
async function syncSheet(silent, timeout = 30) {
  const st = await loadSettings()
  const hook = sheetHookOf(st)
  if (!hook) return silent ? null : { ok: false, error: "автозапись отключена" }
  const all = await rawMoney(), food = await rawFood(), water = await rawWater(), health = await healthDays(), workouts = await rawWorkouts()
  const live = list => list.filter(x => !x.deleted).sort((a, b) => a.date - b.date)
  // всё целиком: деньги, еда, вода, тренировки и активность по дням (таблица обновит строку каждого дня)
  const body = { secret: await sheetSecretOf(st),
    entries: live(all), food: live(food), water: live(water), workouts: live(workouts), health,
    deleted: [...all, ...food, ...water, ...workouts].filter(x => x.deleted).map(x => x.id) }
  try {
    const req = new Request(hook)
    req.method = "POST"
    req.timeoutInterval = timeout
    req.headers = { "content-type": "text/plain;charset=utf-8" }
    req.body = JSON.stringify(body)
    const res = await req.loadJSON()
    // старый скрипт таблицы (без номеров листов) еду, воду и шаги не принимает — их отпечаток не запоминаем, выгрузим снова
    if (res && res.ok && !res.sheets) res.oldScript = true
    if (res && res.ok) await saveSettings(Object.assign({ sheetSyncedAt: Date.now(), sheetSig: moneySig(all) },
      res.oldScript ? {} : { sheetSigAll: await syncSig() },
      res.sheets ? { sheetGids: res.sheets } : {},
      res.url && !st.sheetUrl && !CONFIG.sheetUrl ? { sheetUrl: res.url } : {},
      { cardOn: Array.isArray(res.card) }))
    // после отпечатка: новые расходы по карте не считаются выгруженными и уйдут в «Операции» следующей выгрузкой
    if (res && res.ok && Array.isArray(res.card)) res.cardTaken = await takeCard(res.card)
    return res
  } catch (e) { return { ok: false, error: String(e) } }
}

// Ссылка автозаписи: из общих настроек, иначе встроенная. Пустая строка в настройках — автозапись выключена.
const sheetHookOf = st => (typeof st.sheetHook === "string" ? st.sheetHook : CONFIG.sheetHook)
// «Отпечаток» списка операций: меняется при любом добавлении или удалении
const moneySig = all => `${all.length}:${all.reduce((m, x) => Math.max(m, x.u || x.date || 0), 0)}`
// То же для всего, что уходит в таблицу с iPhone (Mac следит только за деньгами — sheetSig)
async function syncSig() {
  const h = await loadHealth(true)
  // «v3» — один раз выгрузить всё заново: тренировки появились в таблице (лист «Тренировки»)
  return ["v3", moneySig(await rawMoney()), moneySig(await rawFood()), moneySig(await rawWater()), moneySig(await rawWorkouts()), h ? h.updated : 0].join("|")
}
// Ссылка на таблицу: из настроек (таблица сама сообщает её при первой записи), иначе встроенная
const sheetUrlOf = st => st.sheetUrl || CONFIG.sheetUrl
let SHEET_URL = CONFIG.sheetUrl   // для кнопки ▦ в виджете, уточняется при запуске
let STATS_URL = null              // лист «Еда и активность»: нажатие на калории и сожжённые калории в виджете
// Ссылка на лист таблицы по имени: номера листов (gid) таблица присылает при каждой выгрузке
function sheetTabUrl(st, name) {
  const url = sheetUrlOf(st), gid = st.sheetGids && st.sheetGids[name]
  return url && gid !== undefined ? `${url.replace(/[#?].*$/, "")}#gid=${gid}` : null
}
// Ключ для таблицы: встроенный, иначе свой для этого человека — создаётся один раз и хранится в общих настройках
async function sheetSecretOf(st) {
  if (CONFIG.sheetSecret && !/^__/.test(CONFIG.sheetSecret)) return CONFIG.sheetSecret
  if (st.sheetSecret) return st.sheetSecret
  const secret = Array.from({ length: 32 }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]).join("")
  await saveSettings({ sheetSecret: secret })
  return secret
}

// Догоняющая выгрузка: если операции менялись (на этом или другом устройстве) — отправить в таблицу
async function autoSyncSheet() {
  try {
    const st = await loadSettings()
    if (!sheetHookOf(st)) return
    // расходы по карте появляются в таблице сами — при включённом импорте спрашиваем таблицу и без своих изменений
    const cardDue = st.cardOn && Date.now() - (st.sheetSyncedAt || 0) > 15 * 60 * 1000
    if (st.sheetSigAll === await syncSig() && !cardDue) return
    await syncSheet(true)
  } catch (e) {}
}

// ── Связь с веб-приложением «Мой день» (CONFIG.webApp) через таблицу ──
// Виджет отдаёт таблице новые записи (деньги, еда, вода, тренировки) и снимок того, что видит только iPhone:
// события, напоминания, данные часов. Обратно получает записи приложения и команды для календаря и напоминаний.
const HUB_FILES = { money: ["finance.json", "f", 0], food: ["food.json", "m", 120], water: ["water.json", "w", 60], workouts: ["workouts.json", "t", 400],
  places: ["places.json", "p", 0], locs: ["locs.json", "l", 60], nudges: ["nudges.json", "n", 3], rems: ["rems.json", "r", 0], skips: ["skips.json", "k", 60] }   // skips — платежи по карте, которые не вносить (помощник)   // rems — напоминания IZIDAY (в приложении, не в iPhone)   // nudges — подсказки помощника на день   // locs — где был iPhone (помощник показывает место платежа)   // места «напомни, когда буду рядом» — создаёт помощник в приложении
const HUB_TOOLS = ["create_event", "update_event", "delete_event", "create_reminder", "update_reminder", "delete_reminder"]
let HUB_RUN = false   // команды из приложения пользователь уже подтвердил там — окон не показываем

async function hubSnapshot() {
  const from = startOfDay(new Date()), to = new Date(from.getTime() + 31 * 864e5)
  from.setDate(from.getDate() - 1)
  const list = await evRange(from, to), rep = await repeatingIds(from, to)
  const events = list.sort((a, b) => a.startDate - b.startDate).slice(0, 300).map(e => Object.assign(evOut(e, rep.has(e.identifier)),
    { color: e.calendar && e.calendar.color ? `#${e.calendar.color.hex}` : "" }))
  let open = [], done = []
  try { open = await Reminder.allIncomplete() } catch (e) {}
  try { done = (await Reminder.allCompleted()).filter(r => r.completionDate && sameDay(r.completionDate, new Date())) } catch (e) {}
  const rem = r => ({ id: r.identifier, title: r.title, completed: !!r.isCompleted, list: r.calendar ? r.calendar.title : "",
    due: r.dueDate ? (r.dueDateIncludesTime ? isoLocal(r.dueDate) : isoLocal(r.dueDate).slice(0, 10)) : null,
    recur: !!(r.hasRecurrenceRules), notes: r.notes || "" })
  const names = async forRem => { try { return (forRem ? await Calendar.forReminders() : await Calendar.forEvents()).map(c => c.title) } catch (e) { return [] } }
  return { events, reminders: open.slice(0, 200).map(rem).concat(done.slice(-30).map(rem)),
    calendars: await names(false), lists: await names(true), watch: await loadHealth(), health: (await healthDays()).slice(-14), loc: await hereNow(), notif: await notifInfo() }
}
// Для приложения: сколько уведомлений виджет поставил (видно в «Ещё» — проверить, что они вообще есть)
async function notifInfo() {
  try { const p = await Notification.allPending(); return { pending: p.length, mine: p.filter(n => /^myday-/.test(n.identifier || "")).length, at: Date.now() } } catch (e) { return null }
}

// ── Где я: виджет раз за обновление (~15 мин) берёт место с точностью ~100 м — для «сколько ехать» и напоминаний по месту
let HERE
async function hereNow() {
  if (HERE !== undefined) return HERE
  HERE = null
  if (!WEB_APP) return HERE
  try {
    Location.setAccuracyToHundredMeters()
    const l = await Promise.race([Location.current(), new Promise(r => Timer.schedule(8000, false, () => r(null)))])
    if (l && l.latitude != null) HERE = { lat: l.latitude, lng: l.longitude, at: Date.now() }
  } catch (e) {}
  return HERE
}
const distM = (a, b) => {
  const R = 6371000, rad = x => x * Math.PI / 180, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
// Напоминание по месту: рядом с любой из точек — уведомление (один раз), отметка уходит в приложение
// Точка в историю мест: при переезде дальше 200 м или раз в час на месте; хранится 60 дней
async function logLoc(here) {
  if (!here || !WEB_APP) return
  const list = withIds(await loadJSON("locs.json"), "l"), last = list.filter(x => !x.deleted).sort((a, b) => a.date - b.date).slice(-1)[0]
  if (last && distM(last, here) < 200 && Date.now() - last.date < 3600e3) return
  list.push({ id: `l${Date.now()}`, date: here.at || Date.now(), u: Date.now(), lat: Math.round(here.lat * 1e5) / 1e5, lng: Math.round(here.lng * 1e5) / 1e5 })
  saveJSON("locs.json", keepDays(list, 60))
}
// Вода: долго нет записи (9–21) — уведомление, и чем дольше, тем настойчивее:
// 3 ч — ласково, ещё через 1,5 ч — настойчивее, ещё через 1,5 ч — прямой вопрос «почему не пьёшь?»
const WATER_NUDGES = [
  ["💧 Глоток воды?", g => `Уже ${g} ч без воды. Налей стаканчик — нажми, и я запишу ${CONFIG.health.glass} мл 🙂`],
  ["💧 Вода ждёт", g => `${g} ч без воды — это много. Давай прямо сейчас стакан, организм скажет спасибо. Нажми — запишу.`],
  ["💧 Почему не пьёшь?", g => `${g} ч ни глотка. Что мешает — забываешь или некогда? Выпей стакан сейчас, а в чате скажи, как помочь не забывать.`],
]
function waterNudgeLevel(gap, st, lastWater) {
  const lvl = st.waterNudgeDay === dayKey(new Date()) && (st.waterNudgeAt || 0) > lastWater ? (st.waterNudgeLevel || 0) : 0   // попил после уведомления — сначала
  const due = lvl === 0 ? gap >= 3 : Date.now() - (st.waterNudgeAt || 0) >= 1.5 * 3600e3
  return due && lvl < WATER_NUDGES.length ? lvl : -1
}
async function waterNudge() {
  if (!WEB_APP) return
  try {
    const d = await dayHealth(), gap = waterGap(d)
    if (!gap) return
    const st = await loadSettings(), lastWater = Math.max(0, ...((d.waterList || []).map(w => w.date || 0)))
    const lvl = waterNudgeLevel(gap, st, lastWater)
    if (lvl < 0) return
    const [title, body] = WATER_NUDGES[lvl]
    const n = new Notification()
    n.identifier = "myday-water"; n.title = title; n.body = body(gap)
    n.openURL = lvl === 2 ? `${WEB_APP}#chat` : `${WEB_APP}#water`; n.sound = "default"
    await n.schedule()
    await saveSettings({ waterNudgeAt: Date.now(), waterNudgeLevel: lvl + 1, waterNudgeDay: dayKey(new Date()) })
  } catch (e) {}
}
async function placesCheck(here) {
  if (!here || !WEB_APP) return
  const list = withIds(await loadJSON("places.json"), "p")
  let changed = false
  for (const p of list) {
    if (p.deleted || p.done) continue
    const near = (p.points || []).map(q => ({ q, d: distM(here, q) })).sort((a, b) => a.d - b.d)[0]
    if (!near || near.d > (p.radius || 1500)) continue
    try {
      const n = new Notification()
      n.identifier = `myday-place-${p.id}`
      n.title = `📍 ${p.title}`
      n.body = `Вы рядом: ${near.q.name || p.query} — ${String(Math.round(near.d / 100) / 10).replace(".", ",")} км`
      n.openURL = `${WEB_APP}#place=${encodeURIComponent(p.id)}`
      n.sound = "default"
      await n.schedule()
    } catch (e) {}
    Object.assign(p, { done: true, firedAt: Date.now(), u: Date.now() })
    changed = true
  }
  if (changed) saveJSON("places.json", list)
}
// Уведомления о встречах (за CONFIG.eventAlertMinutes) и напоминаниях со временем на ближайшие 36 ч — от виджета, открывают приложение.
// Уведомления Календаря и Напоминаний после этого можно выключить в настройках iPhone
async function scheduleAgenda() {
  if (!WEB_APP || CONFIG.agendaAlerts === false) return
  try {
    const now = new Date(), to = new Date(now.getTime() + 36 * 3600e3), want = new Map()
    const hash = t => { let h = 0; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36) }
    const lead = (CONFIG.eventAlertMinutes ?? 10) * 60e3
    for (const e of await evRange(now, to)) {
      if (e.isAllDay || e.startDate <= now) continue
      const at = new Date(Math.max(e.startDate.getTime() - lead, now.getTime() + 30e3))
      want.set(`myday-ag-e-${e.identifier}-${e.startDate.getTime()}-${hash(e.title)}`,
        { at, title: `📅 ${e.title}`, body: `${eventTime(e)}${e.location ? " · " + e.location.split("\n")[0] : ""}` })
    }
    let rems = []
    try { rems = await appRems() } catch (e) {}   // напоминания IZIDAY (Напоминания iPhone больше не используются)
    for (const r of rems) if (r.dueDate && r.dueDateIncludesTime && r.dueDate > now && r.dueDate < to)
      want.set(`myday-ag-r-${r.identifier}-${r.dueDate.getTime()}-${hash(r.title)}`, { at: r.dueDate, title: `⏰ ${r.title}`, body: r.notes || "IZIDAY", rem: r.identifier,
        url: `${WEB_APP}#rem=${encodeURIComponent(r.identifier)}` })
    // Контроль: напоминание не отмечено — «Выполнил?» через час и через 3 часа после срока, дальше раз в день в 10:00 (до 3 дней);
    // напоминание на день без времени — в 13:00 и 18:00, просроченное — в 10:00. Отметили — вопросы исчезают сами.
    for (const r of rems) {
      if (!r.dueDate) continue
      const due = r.dueDate.getTime(), times = []
      if (r.dueDateIncludesTime) times.push(due + 3600e3, due + 3 * 3600e3)
      else { const d0 = startOfDay(r.dueDate); times.push(d0.getTime() + 13 * 3600e3, d0.getTime() + 18 * 3600e3) }
      for (let k = 1; k <= 3; k++) { const d = startOfDay(new Date(due + k * 864e5)); d.setHours(10, 0, 0, 0); times.push(d.getTime()) }
      times.forEach((t, i) => {
        if (t <= now.getTime() || t > to.getTime()) return
        const late = t - due > 864e5
        want.set(`myday-ag-f-${r.identifier}-${t}-${hash(r.title)}`, { at: new Date(t), rem: r.identifier,
          title: i === 0 ? "⏰ Выполнил?" : late ? "⏰ Всё ещё не сделано" : "⏰ Напоминаю ещё раз",
          body: `«${r.title}» — сделано? Если нет — перенесём или скажи, что мешает.`, url: `${WEB_APP}#rem=${encodeURIComponent(r.identifier)}` })
      })
    }
    // подсказки помощника на день (план составляет IZIDAY): вода, еда, подготовка к делам, идеи
    for (const x of withIds(await loadJSON("nudges.json"), "n")) {
      if (x.deleted || !x.date || x.date <= now.getTime() || x.date > to.getTime()) continue
      want.set(`myday-ag-n-${x.id}-${x.date}-${hash(x.text)}`, { at: new Date(x.date), title: x.title || "💡 IZIDAY", body: x.text || "", url: `${WEB_APP}#chat` })
    }
    const have = new Set(), stale = []
    for (const n of await Notification.allPending()) {
      const id = n.identifier || ""
      if (!id.startsWith("myday-ag-")) continue
      if (want.has(id)) have.add(id); else stale.push(id)
    }
    if (stale.length) Notification.removePending(stale)
    for (const [id, x] of want) {
      if (have.has(id)) continue
      const n = new Notification()
      n.identifier = id; n.title = x.title; n.body = x.body; n.openURL = x.url || WEB_APP; n.sound = "default"
      if (x.rem) {   // долгое нажатие на уведомление: ответить, не открывая приложение
        const q = encodeURIComponent(x.rem)
        try { n.addAction("✅ Сделано", `${WEB_APP}#remdone=${q}`); n.addAction("⏰ Через час", `${WEB_APP}#remlater=${q}`) } catch (e) {}
      }
      n.setTriggerDate(x.at)
      await n.schedule()
    }
  } catch (e) {}
}

async function hubPost(st, h, timeout) {
  const req = new Request(sheetHookOf(st))
  req.method = "POST"
  req.timeoutInterval = timeout
  req.headers = { "content-type": "text/plain;charset=utf-8" }
  req.body = JSON.stringify({ secret: await sheetSecretOf(st), hub: Object.assign({ from: "widget" }, h) })
  return await req.loadJSON()
}

// Обмен с приложением: раз за запуск виджета и после операций в Scriptable. Возвращает число выполненных команд
async function hubSync(timeout = 12) {
  if (!WEB_APP) return 0
  const st = await loadSettings()
  if (!sheetHookOf(st)) return 0
  const started = Date.now(), pushed = st.hubPushedAt || 0
  try {
    const lists = {}, raw = {}
    for (const [key, [file, prefix]] of Object.entries(HUB_FILES)) {
      raw[key] = withIds(await loadJSON(file), prefix)
      lists[key] = raw[key].filter(x => (x.u || x.date || 0) > pushed - 60000)   // минута запаса: часы iPhone и записи с Mac
    }
    let res = await hubPost(st, { since: st.hubSince || 0, lists, snap: await hubSnapshot() }, timeout)
    if (!res || !res.ok) return 0
    for (const [key, [file, , days]] of Object.entries(HUB_FILES)) {
      const got = (res.lists && res.lists[key]) || []
      if (!got.length) continue
      const merged = mergeSynced(withIds(await loadJSON(file), HUB_FILES[key][1]), got.map(x => { const y = Object.assign({}, x); delete y.s; return y }))
      saveJSON(file, days ? keepDays(merged, days) : merged)
    }
    const done = []
    HUB_RUN = true
    try {
      for (const op of res.ops || []) {
        let result
        try { result = HUB_TOOLS.includes(op.tool) ? await runTool(op.tool, op.input || {}) : { error: `команда ${op.tool} недоступна` } }
        catch (e) { result = { error: String(e) } }
        done.push({ id: op.id, result })
      }
    } finally { HUB_RUN = false }
    // выполненные команды и свежий снимок (новое событие сразу видно в приложении)
    if (done.length) res = await hubPost(st, { since: res.now, done, snap: await hubSnapshot() }, timeout) || res
    await saveSettings({ hubSince: res.now || st.hubSince || 0, hubPushedAt: started, hubAt: Date.now() })
    return done.length
  } catch (e) { return 0 }
}

// Код для подключения приложения: таблица, ключ Claude, маршруты и личные настройки. Только в Связке ключей и в буфере обмена
async function webAppSetupCode() {
  const st = await loadSettings()
  const cfg = { currency: CONFIG.currency, currencyIn: CONFIG.currencyIn, currencyWords: CONFIG.currencyWords, agentModel: CONFIG.agentModel,
    defaultEventMinutes: CONFIG.defaultEventMinutes, defaultReminderHour: CONFIG.defaultReminderHour, health: CONFIG.health, briefs: CONFIG.briefs,
    categories: CONFIG.categories, calendars: CONFIG.calendars.map(c => ({ calendar: c.calendar, list: c.list, hint: c.hint || "" })) }
  const data = { v: 1, hook: sheetHookOf(st), secret: await sheetSecretOf(st), key: OPENAI ? "" : (getAIKey() || ""),
    routes: CONFIG.assistantChat ? loadRoutes() : [], sheetUrl: sheetUrlOf(st) || "", run: RUN, cfg }
  return Data.fromString(JSON.stringify(data)).toBase64String()
}

async function webAppMenu() {
  const st = await loadSettings()
  const last = st.hubAt ? `Последний обмен с приложением: ${WHEN.string(new Date(st.hubAt))}.` : "Обмена с приложением ещё не было."
  const i = await choose("📱 Приложение «Мой день»", ["🔗 Подключить приложение на этом iPhone", "📋 Скопировать код подключения", "🔄 Обменяться сейчас", "🌐 Открыть приложение"],
    `${last}\n\nПриложение открывается мгновенно, а виджет передаёт ему календарь, напоминания и данные часов. ` +
    "Новые события и напоминания из приложения виджет вносит в iPhone при обновлении.\n\nКод подключения содержит ключ Claude и ключ таблицы — не пересылайте его.")
  if (i === 0) { const c = await webAppSetupCode(); Pasteboard.copy(c); Safari.open(`${WEB_APP}#setup=${encodeURIComponent(c)}`) }
  if (i === 1) { Pasteboard.copy(await webAppSetupCode()); await info("Код скопирован", "В приложении: «Ещё» → «Подключить» → вставьте код.") }
  if (i === 2) { const n = await hubSync(25); await info("Готово", n ? `Выполнено команд из приложения: ${n}` : "Новых команд из приложения нет.") }
  if (i === 3) Safari.open(WEB_APP)
}

// ───────────── Даты и числа ─────────────
function fmt(pattern) { const f = new DateFormatter(); f.locale = "ru_RU"; f.dateFormat = pattern; return f }
const TIME = fmt("HH:mm"), DAY = fmt("d MMM"), FULL = fmt("EEEE, d MMMM"), SHORT = fmt("EE, d MMM")
const WEEKDAY = fmt("EEEE"), DATE_LONG = fmt("d MMMM")
const WHEN = fmt("EEEE, d MMMM, HH:mm"), DM = fmt("dd.MM"), YMD = fmt("yyyy-MM-dd HH:mm")
const MONTH_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август",
  "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]

const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime()
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
const monthTitle = key => { const [y, m] = key.split("-"); return `${MONTH_NOM[+m - 1]} ${y}` }

function money(n) {
  const v = Math.abs(n)
  const [i, d] = (Math.round(v * 100) / 100).toFixed(2).split(".")
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return int + (d !== "00" ? "," + d : "") + " " + CONFIG.currency
}

function dayLabel(d) {
  const today = new Date(), tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  if (sameDay(d, today)) return ""
  if (sameDay(d, tomorrow)) return "завтра"
  return DAY.string(d)
}

function eventTime(e) {
  const now = new Date()
  if (e.isAllDay) return e.startDate <= now ? "весь день" : dayLabel(e.startDate)
  if (e.startDate <= now) return "идёт"
  const day = dayLabel(e.startDate)
  return day ? `${day} ${TIME.string(e.startDate)}` : TIME.string(e.startDate)
}

function isOverdue(r) {
  if (!r.dueDate) return false
  const now = new Date()
  return r.dueDateIncludesTime ? r.dueDate < now : r.dueDate < startOfDay(now)
}

function reminderTime(r) {
  if (!r.dueDate) return ""
  const now = new Date()
  const time = r.dueDateIncludesTime ? TIME.string(r.dueDate) : ""
  if (sameDay(r.dueDate, now)) return time || "сегодня"
  const day = dayLabel(r.dueDate) || DAY.string(r.dueDate)
  return time && day === "завтра" ? `завтра ${time}` : day
}

// ───────────── Данные календаря ─────────────
// Ближайшие встречи (до daysAhead) из общей выборки календаря
function upcoming(all) {
  const now = new Date()
  const end = startOfDay(now); end.setDate(end.getDate() + CONFIG.daysAhead + 1)
  return all.filter(e => e.startDate < end && e.endDate > now).sort((a, b) => a.startDate - b.startDate)
}

// Напоминания живут в приложении IZIDAY (rems.json приходит через таблицу) — вид как у Reminder, чтобы остальной код не менялся
async function appRems() {
  const all = withIds(await loadJSON("rems.json"), "r")
  return all.filter(x => !x.deleted && !x.done && x.title).map(x => {
    const m = String(x.due || "").match(/^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/)
    return { identifier: x.id, title: x.title, notes: x.notes || "", app: true, isCompleted: false, calendar: null,
      dueDate: m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null, dueDateIncludesTime: !!(m && m[4]),
      async save() {   // отметка «выполнено» из меню виджета — уходит в приложение
        if (!this.isCompleted) return
        const list = withIds(await loadJSON("rems.json"), "r"), r = list.find(y => y.id === x.id)
        if (r) { Object.assign(r, { done: true, doneAt: Date.now(), u: Date.now() }); await saveJSON("rems.json", list); await hubSync() }
      } }
  })
}
async function getReminders() {
  let list = []
  try { list = await appRems() } catch (e) {}
  return list.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate - b.dueDate
  })
}

// ───────────── Финансы: подсчёт ─────────────
function monthTotals(list, key) {
  const items = list.filter(e => monthKey(new Date(e.date)) === key).sort((a, b) => a.date - b.date)
  const t = { items, income: 0, expense: 0, cash: { income: 0, expense: 0 }, transfer: { income: 0, expense: 0 },
    cats: { income: {}, expense: {} } }
  items.forEach(e => {
    t[e.type] += e.amount
    t[e.method][e.type] += e.amount
    t.cats[e.type][e.category] = (t.cats[e.type][e.category] || 0) + e.amount
  })
  return t
}

// ───────────── Неделя ─────────────
function weekDays() {
  const today = startOfDay(new Date())
  const start = new Date(today)
  start.setDate(today.getDate() - CONFIG.week.daysBefore)
  const count = CONFIG.week.daysBefore + CONFIG.week.daysFromToday
  return Array.from({ length: count }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
}

// Один запрос к календарю на неделю и ближайшие встречи: запросы к календарю — самое долгое при обновлении виджета
async function getCalendar(days) {
  const from = new Date(Math.min(days[0], startOfDay(new Date())))
  const end = new Date(days[days.length - 1]); end.setDate(end.getDate() + 1)
  const near = startOfDay(new Date()); near.setDate(near.getDate() + CONFIG.daysAhead + 1)
  try { return await CalendarEvent.between(from, new Date(Math.max(end, near)), []) } catch (e) { return [] }
}

// В календаре — только события, которые ещё не закончились. Напоминания живут в своём разделе.
function itemsForDay(day, events) {
  const next = new Date(day); next.setDate(day.getDate() + 1)
  const now = new Date()
  return events
    .filter(e => e.startDate < next && e.endDate > day && e.endDate > now)
    .map(e => {
      const startsToday = sameDay(e.startDate, day)
      return {
        time: e.isAllDay || !startsToday ? "" : TIME.string(e.startDate),
        title: e.title || "Без названия",
        color: chipColor(e.calendar ? e.calendar.title : ""),
        sort: e.isAllDay || !startsToday ? 0 : e.startDate.getTime(),
      }
    })
    .sort((a, b) => a.sort - b.sort)
}

const REMINDERS_APP = "x-apple-reminderkit://"
const reminderURL = r => r && r.app && WEB_APP ? `${WEB_APP}#rem=${encodeURIComponent(r.identifier)}` : r && r.identifier ? `x-apple-reminderkit://REMCDReminder/${r.identifier}` : REMINDERS_APP

const calshowURL = d => `calshow:${Math.floor(d.getTime() / 1000) - 978307200}`

// Календарь сеткой: по 5 дней в строке, чтобы плашки были широкими и читаемыми.
// extraTile(stack) — чем заполнить пустую ячейку в последней строке (итоги месяца).
function weekGrid(parent, days, events, rems, maxChips, opts = {}) {
  const today = new Date()
  const W = opts.colWidth || CONFIG.week.colWidth
  const PER_ROW = opts.perRow || 5
  const titleLines = opts.titleLines || 2
  const LETTERS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
  for (let r = 0; r * PER_ROW < days.length; r++) {
    if (r) parent.addSpacer(7)
    const row = parent.addStack()
    row.topAlignContent()
    const chunk = days.slice(r * PER_ROW, r * PER_ROW + PER_ROW)
    for (let i = 0; i < PER_ROW; i++) {
      if (i) row.addSpacer()
      const day = chunk[i]
      if (!day) {
        const tile = row.addStack()
        tile.layoutVertically()
        tile.size = new Size(W, 0)
        if (opts.extraTile) opts.extraTile(tile)
        continue
      }
      dayColumn(row, day, today, events, rems, maxChips, titleLines, W, LETTERS, opts.compact)
    }
  }
}

// compact: плашка в одну строку «18:30 Падел»; если событий больше maxChips — их число в шапке дня
function dayColumn(row, day, today, events, rems, maxChips, titleLines, W, LETTERS, compact) {
  const isToday = sameDay(day, today)
  const past = day < startOfDay(today)
  const weekend = day.getDay() === 0 || day.getDay() === 6
  const col = row.addStack()
  col.layoutVertically()
  col.size = new Size(W, 0)
  col.url = calshowURL(day)

  // шапка дня: «ПТ 23», сегодня — золотая плашка
  const hd = col.addStack()
  hd.size = new Size(W, 20)
  hd.cornerRadius = 10
  hd.centerAlignContent()
  hd.setPadding(0, 6, 0, 6)
  if (isToday) hd.backgroundColor = C.todayBg
  const l = hd.addText(LETTERS[day.getDay()].toUpperCase())
  l.font = Font.boldSystemFont(9)
  l.textColor = isToday ? C.todayFg : (past ? C.sub : weekend ? C.gold : C.sub)
  const items = itemsForDay(day, events, rems)
  if (compact) {
    // «СБ 24» слева, справа кружок с числом событий за день
    hd.addSpacer(4)
    const n = hd.addText(String(day.getDate()))
    n.font = Font.heavyRoundedSystemFont(14)
    n.textColor = isToday ? C.todayFg : C.text
    hd.addSpacer()
    if (items.length) {
      const b = hd.addStack()
      b.size = new Size(16, 16)
      b.cornerRadius = 8
      b.centerAlignContent()
      b.backgroundColor = isToday ? C.todayFg : (items.length > maxChips ? C.todayBg : C.soft)
      const bt = b.addText(String(items.length))
      bt.font = Font.heavyRoundedSystemFont(10)
      bt.lineLimit = 1
      bt.minimumScaleFactor = 0.7
      bt.textColor = isToday ? C.todayBg : (items.length > maxChips ? C.todayFg : C.gold)
    }
  } else {
    hd.addSpacer()
    const n = hd.addText(String(day.getDate()))
    n.font = Font.heavyRoundedSystemFont(14)
    n.textColor = isToday ? C.todayFg : (past ? C.sub : C.text)
  }
  col.addSpacer(4)

  if (!items.length) {
    const e = col.addStack(); e.size = new Size(W, 0); e.addSpacer()
    const d = e.addText("·"); d.font = Font.boldSystemFont(12); d.textColor = C.hint
    e.addSpacer()
  }
  const shown = items.length > maxChips && !compact ? maxChips - 1 : maxChips   // место под «+N» не отнимает плашку зря
  items.slice(0, shown).forEach((it, k) => {
    if (compact) {
      // одна строка «18:30 Турнир по паделу»: время и название одной надписью, длинное — мельче шрифтом
      if (k) col.addSpacer(2)
      const chip = col.addStack()
      chip.size = new Size(W, 0)
      chip.setPadding(3, 5, 3, 3)
      chip.cornerRadius = 6
      chip.backgroundColor = new Color(it.color, 0.95)
      const ti = chip.addText(`${it.time ? it.time + " " : ""}${stripEmoji(it.title)}`)
      ti.font = Font.semiboldSystemFont(10.5)
      ti.textColor = C.chipText
      ti.lineLimit = 1
      ti.minimumScaleFactor = 0.7
      chip.addSpacer()
      return
    }
    if (k) col.addSpacer(3)
    const chip = col.addStack()
    chip.layoutVertically()
    chip.size = new Size(W, 0)
    chip.setPadding(3, 5, 4, 3)
    chip.cornerRadius = 7
    if (it.url) chip.url = it.url
    chip.backgroundColor = new Color(it.color, past ? 0.25 : 0.95)
    const fg = past ? C.sub : C.chipText
    const tfg = past ? C.sub : new Color(BRAND.goldLight)
    if (it.time) {
      const t = chip.addText(it.time)
      t.font = Font.boldRoundedSystemFont(9)
      t.textColor = tfg
      t.lineLimit = 1
    }
    const ti = chip.addText(stripEmoji(it.title))
    ti.font = Font.semiboldSystemFont(10)
    ti.textColor = fg
    ti.lineLimit = titleLines
    ti.minimumScaleFactor = 0.85
  })
  if (items.length > maxChips && !compact) {
    col.addSpacer(3)
    const mr = col.addStack(); mr.size = new Size(W, 0); mr.addSpacer()
    const m = mr.addText(`+${items.length - shown} ещё`)
    m.font = Font.boldSystemFont(9)
    m.textColor = C.gold
    mr.addSpacer()
  }
}

// Ширина содержимого виджета (без полей 12 + 12): зависит от экрана iPhone.
// Всё, что рисуется фиксированной ширины, должно в неё укладываться — иначе виджет съезжает и обрезается.
function contentWidth(family) {
  let sw = 390
  try { const z = Device.screenSize(); sw = Math.min(z.width, z.height) } catch (e) {}
  const w = sw >= 428 ? 364 : sw >= 414 ? 360 : sw >= 390 ? 338 : sw >= 375 ? 329 : 321   // large/medium одной ширины
  return w - 24
}

// Большой виджет: строка из 7 дней с сегодняшнего на всю ширину; под числом — названия событий этого дня.
// Не число («2 соб»), а сами названия: два события — по строке на каждое, одно — в две строки,
// больше двух — первое название и «+N», чтобы было понятно, что за событие.
function stripLines(items) {
  const names = items.map(it => stripEmoji(it.title) || "Без названия")
  if (!names.length) return []   // день без событий: только «—» (раньше тут было undefined и виджет падал)
  // ячейка узкая: название переносится по словам крупнее, а не сжимается в «Пра…»
  if (names.length === 1) return [{ text: names[0], lines: 4 }]
  if (names.length === 2) return names.map(t => ({ text: t, lines: 2 }))
  return [{ text: names[0], lines: 3 }, { text: `+${names.length - 1}`, lines: 1, more: true }]
}

function weekStrip(parent, days, events, weather, H = 64) {
  const GAP = 5, today = new Date()
  const W = Math.floor((contentWidth() - GAP * 6) / 7)
  const LETTERS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
  const row = parent.addStack()
  days.slice(0, 7).forEach((day, i) => {
    if (i) row.addSpacer(GAP)
    const isToday = sameDay(day, today)
    const weekend = day.getDay() === 0 || day.getDay() === 6
    const cell = row.addStack()
    cell.layoutVertically()
    cell.size = new Size(W, H)
    cell.cornerRadius = 13
    cell.setPadding(5, 2, 5, 2)
    cell.backgroundColor = isToday ? C.todayBg : C.cell
    cell.url = calshowURL(day)
    const txt = (s, font, color) => {
      const line = cell.addStack()
      line.addSpacer()
      const t = line.addText(s); t.font = font; t.textColor = color; t.lineLimit = 1; t.minimumScaleFactor = 0.6
      t.centerAlignText()
      line.addSpacer()
    }
    // как в приложении: день недели, число, а под ним — погода (вместо названий событий)
    txt(LETTERS[day.getDay()].toUpperCase(), Font.semiboldSystemFont(10), isToday ? C.todayFg : weekend ? C.weekend : C.sub)
    cell.addSpacer(1)
    txt(String(day.getDate()), Font.boldRoundedSystemFont(H > 56 ? 19 : 16), isToday ? C.todayFg : C.text)
    cell.addSpacer()
    const wx = weather && weather[dayKey(day)]
    txt(wx ? `${wxIcon(wx.code)} ${Math.round(wx.t)}°` : itemsForDay(day, events).length ? "•" : "", Font.semiboldRoundedSystemFont(10), isToday ? C.todayFg : C.sub)
  })
}

// ── Погода на неделю: Open-Meteo (без ключа), по месту iPhone; кэш на 2 часа ──
function wxIcon(c) {
  return c === 0 ? "☀️" : c <= 2 ? "🌤" : c === 3 ? "☁️" : c <= 48 ? "🌫" : c <= 67 ? "🌧" : c <= 77 ? "❄️" : c <= 82 ? "🌦" : "⛈"
}
async function weatherWeek() {
  let cache = null
  try { cache = JSON.parse(await readText("weather.json")) } catch (e) {}
  if (cache && Date.now() - cache.at < 2 * 3600e3) return cache.days
  try {
    let here = (await hereNow()) || (cache && cache.here) || ((await loadJSON("locs.json")).slice(-1)[0]) || null
    if (!here) try { Location.setAccuracyToThreeKilometers(); const l = await Location.current(); here = { lat: l.latitude, lng: l.longitude } } catch (e) {}
    if (!here || here.lat == null) return cache ? cache.days : null
    const r = new Request(`https://api.open-meteo.com/v1/forecast?latitude=${here.lat.toFixed(3)}&longitude=${here.lng.toFixed(3)}&daily=weather_code,temperature_2m_max&timezone=auto&forecast_days=10`)
    r.timeoutInterval = 6
    const j = await r.loadJSON()
    const days = {}
    ;(j.daily.time || []).forEach((d, i) => { days[d] = { code: j.daily.weather_code[i], t: j.daily.temperature_2m_max[i] } })
    saveJSON("weather.json", { at: Date.now(), here: { lat: here.lat, lng: here.lng }, days })
    return days
  } catch (e) { return cache ? cache.days : null }
}

// Белая карточка с заголовком, как в приложении
function cardBox(parent, title, count, url) {
  const box = parent.addStack()
  box.layoutVertically()
  box.backgroundColor = C.card
  box.cornerRadius = 16
  box.setPadding(9, 12, 10, 12)
  if (url) box.url = url
  const h = box.addStack()
  h.centerAlignContent()
  const t = h.addText(title)
  t.font = Font.boldSystemFont(14); t.textColor = C.text
  h.addSpacer()
  if (count) { const c = h.addText(String(count)); c.font = Font.semiboldRoundedSystemFont(12); c.textColor = C.sub }
  box.addSpacer(6)
  const inner = box.addStack()
  inner.layoutVertically()
  const fill = box.addStack(); fill.addSpacer()   // растянуть карточку на всю ширину
  return inner
}

// Под строкой дней — события только сегодняшнего дня, каждое в одну строку: название и время справа
function todayList(parent, events, n) {
  const now = new Date()
  const dayEvs = d => events.filter(e => e.endDate > now && e.endDate > d && e.startDate < new Date(d.getTime() + 864e5))
    .sort((a, b) => (a.isAllDay ? 0 : a.startDate) - (b.isAllDay ? 0 : b.startDate))
  let evs = dayEvs(startOfDay(now)), later = null
  // сегодня всё прошло — полными названиями события ближайшего дня: в узкой ячейке строки дней их не прочитать
  for (let k = 1; !evs.length && k < 7; k++) {
    const d = new Date(startOfDay(now)); d.setDate(d.getDate() + k)
    evs = dayEvs(d); if (evs.length) later = d
  }
  if (!evs.length) { empty(parent, "Событий на неделе нет"); return 1 }
  if (later) {
    const DOW = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"]
    const name = (later - startOfDay(now)) / 864e5 < 1.5 ? "завтра" : `${DOW[later.getDay()]}, ${later.getDate()}`
    const h = parent.addText(`Сегодня больше нет · ${name}`.toUpperCase())
    h.font = Font.boldSystemFont(10); h.textColor = C.gold
    parent.addSpacer(6)
    n = Math.max(1, n - 1)
  }
  const shown = evs.length > n ? n - 1 : n
  evs.slice(0, shown).forEach((e, i) => {
    if (i) parent.addSpacer(6)
    const s = parent.addStack()
    s.centerAlignContent()
    s.url = calshowURL(e.startDate < now ? now : e.startDate)
    const color = chipColor(e.calendar ? e.calendar.title : "")
    const bar = s.addStack()
    bar.size = new Size(4, 18)
    bar.cornerRadius = 2
    bar.backgroundColor = new Color(color)
    s.addSpacer(8)
    const t = s.addText(stripEmoji(e.title || "Без названия"))
    t.font = Font.semiboldSystemFont(13.5); t.textColor = C.text; t.lineLimit = 1
    s.addSpacer(6)
    s.addSpacer()
    const pill = s.addStack()
    pill.setPadding(2, 7, 2, 7)
    pill.cornerRadius = 8
    pill.backgroundColor = dynA("#767680", 0.12, "#767680", 0.24)   // серая «таблетка» времени, как в приложении
    const when = e.isAllDay || !sameDay(e.startDate, now) && e.startDate < now ? "весь день"
      : e.startDate <= now ? `идёт · до ${TIME.string(e.endDate)}` : `${TIME.string(e.startDate)}–${TIME.string(e.endDate)}`
    const wt = pill.addText(when)
    wt.font = Font.semiboldRoundedSystemFont(11); wt.textColor = C.text; wt.lineLimit = 1
  })
  if (evs.length > shown) {
    parent.addSpacer(6)
    const m = parent.addText(`ещё ${evs.length - shown} ${later ? "в этот день" : "сегодня"}`)
    m.font = Font.boldSystemFont(11); m.textColor = C.gold
  }
  return Math.min(evs.length, n) + (later ? 1 : 0)
}

// Эмодзи в начале и в конце названия в узкой плашке только отнимают место
const stripEmoji = t => String(t || "").replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+|[\s\uFE0F\u200D\p{Extended_Pictographic}]+$/gu, "") || t

// Компактная сумма для узкой ячейки: 850 ฿, 12,5к ฿, 1,2м ฿
function moneyShort(n) {
  const v = Math.abs(n)
  const f = (x, d) => (Math.round(x * 10 ** d) / 10 ** d).toString().replace(".", ",")
  if (v >= 1e6) return `${f(v / 1e6, 1)}м ${CONFIG.currency}`
  if (v >= 1e4) return `${f(v / 1e3, v >= 1e5 ? 0 : 1)}к ${CONFIG.currency}`
  return money(v)
}

// Золотая линия с ромбом, как под названием в логотипе
function goldDivider(parent) {
  const r = parent.addStack()
  r.centerAlignContent()
  const l = r.addStack(); l.size = new Size(0, 0.5); l.backgroundColor = C.line; l.addSpacer()   // тонкая линия, как в iOS
}

// ───────────── Элементы виджета ─────────────
function symbol(stack, name, color, size) {
  const sym = SFSymbol.named(name)
  if (!sym) return false
  const img = stack.addImage(sym.image)
  img.imageSize = new Size(size, size)
  img.tintColor = color
  return true
}

function sectionHeader(parent, icon, title, color, count) {
  const h = parent.addStack()
  h.centerAlignContent()
  symbol(h, icon, color, 12)
  h.addSpacer(5)
  const t = h.addText(title.toUpperCase())
  t.font = Font.boldSystemFont(10.5)
  t.textColor = color
  h.addSpacer()
  if (count) {
    const c = h.addText(String(count))
    c.font = Font.boldRoundedSystemFont(11)
    c.textColor = C.sub
  }
}

function row(parent, title, right, color, opts = {}) {
  const size = opts.size || 12.5
  const s = parent.addStack()
  s.centerAlignContent()
  const bar = s.addStack()
  bar.size = new Size(3, size + 2)
  bar.backgroundColor = color
  bar.cornerRadius = 1.5
  s.addSpacer(6)
  const t = s.addText(title)
  t.font = Font.systemFont(size)
  t.textColor = C.text
  t.lineLimit = 1
  s.addSpacer(4)
  s.addSpacer()
  if (right) {
    const r = s.addText(right)
    r.font = Font.mediumSystemFont(size - 1.5)
    r.textColor = opts.rightColor || C.sub
    r.lineLimit = 1
  }
}

function empty(parent, text) {
  const t = parent.addText(text)
  t.font = Font.systemFont(12)
  t.textColor = C.sub
}

function baseWidget() {
  const w = new ListWidget()
  const g = new LinearGradient()
  g.colors = [C.bgTop, C.bgBottom]
  g.locations = [0, 1]
  w.backgroundGradient = g
  w.setPadding(12, 12, 12, 12)
  w.url = HOME_URL
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000)   // чаще обновляться: прошедшие события и выполненные дела уходят быстрее
  return w
}

// Кнопки шапки — только три: голос, текст, фото (остальное есть в приложении)
// (в версии с помощником; у версий для других людей — прежний набор)
const BUTTONS = CONFIG.assistantChat ? [
  ["mic.fill", "🎤", "voice"],
  ["square.and.pencil", "✎", "chat"],
  ["camera.fill", "📷", "camera"],
] : [
  ["mic.fill", "🎤", "voice"],
  ["camera.fill", "📷", "camera"],
  [CONFIG.currencyIcon, CONFIG.currency, "money"],
  ["tablecells.fill", "▦", "sheet"],
  ["square.and.pencil", "✎", "note"],
]
// Кнопки шапки: ▦ — только когда таблица подключена
const headerButtons = () => BUTTONS.filter(b => b[2] !== "sheet" || SHEET_URL)

// [личное ▼]
// Ссылка на строку сегодняшнего дня в листе «Дни» (строка 2 — trackerStart)
function trackerLink(now = new Date()) {
  const [y, m, d] = CONFIG.trackerStart.split("-").map(Number)
  const days = Math.round((startOfDay(now) - new Date(y, m - 1, d)) / 864e5)
  const url = CONFIG.trackerUrl.replace(/#.*$/, "")
  const gid = (CONFIG.trackerUrl.match(/gid=(\d+)/) || [, "0"])[1]
  return days >= 0 ? `${url}#gid=${gid}&range=A${days + 2}` : CONFIG.trackerUrl
}
// [личное ▲]

function dateHeader(parent, size, withButtons) {
  const h = parent.addStack()
  h.centerAlignContent()
  // день недели и дата без сокращений, в две строки: «Пятница» / «23 октября»
  const now = new Date(), big = size === "large" ? 19 : 16
  const d = h.addStack()
  d.layoutVertically()
  // как в приложении: день недели крупно и жирно, дата — зелёным
  const t = d.addText(cap(WEEKDAY.string(now)))
  t.font = Font.heavySystemFont(big + 3)
  t.textColor = C.text
  t.lineLimit = 1
  t.minimumScaleFactor = 0.7
  const dt = d.addText(DATE_LONG.string(now))
  dt.font = Font.semiboldSystemFont(big - 3)
  dt.textColor = C.gold
  dt.lineLimit = 1
  dt.minimumScaleFactor = 0.8
  h.addSpacer()
  if (!withButtons) return
  const buttons = headerButtons()
  const bs = buttons.length <= 3 ? (size === "large" ? 36 : 32) : size === "large" ? (buttons.length > 5 ? 26 : 28) : buttons.length > 5 ? 22 : 24   // «Воскресенье» и кнопки должны уместиться в ширину
  buttons.forEach(([icon, fallback, action], i) => {
    if (i) h.addSpacer(buttons.length > 5 ? 5 : buttons.length <= 3 ? 9 : 6)
    const color = C.btnFg
    const b = h.addStack()
    b.size = new Size(bs, bs)
    b.cornerRadius = bs / 2
    b.backgroundColor = C.btnBg
    b.centerAlignContent()
    let url = action === "sheet" ? SHEET_URL : actURL(action)
    if (action === "tracker") url = trackerLink()   // [личное]
    b.url = url
    b.addSpacer()
    if (!symbol(b, icon, color, Math.round(bs * 0.5))) {
      const ft = b.addText(fallback)
      ft.font = Font.boldSystemFont(Math.round(bs * 0.5))
      ft.textColor = color
    }
    b.addSpacer()
  })
}

function addEvents(parent, events, n, size) {
  if (!events.length) return empty(parent, "Встреч нет")
  events.slice(0, n).forEach((e, i) => {
    if (i) parent.addSpacer(3)
    row(parent, e.title || "Без названия", eventTime(e), new Color(chipColor(e.calendar ? e.calendar.title : "")), { size })
  })
}

function addReminders(parent, rems, n, size) {
  if (!rems.length) {
    const e = parent.addStack(); e.url = REMINDERS_APP
    return empty(e, "Всё сделано 🎉")
  }
  rems.slice(0, n).forEach((r, i) => {
    if (i) parent.addSpacer(3)
    const late = isOverdue(r)
    const wrap = parent.addStack()
    wrap.url = reminderURL(r)                       // нажатие — открыть в «Напоминаниях»
    row(wrap, r.title || "Без названия", reminderTime(r), late ? C.overdue : C.rem,
      { size, rightColor: late ? C.overdue : C.sub })
  })
}

// Крупный список напоминаний: кружок, название, время справа; просроченные — терракотовые
function reminderPanel(parent, rems, n, bare) {
  const box = parent.addStack()
  box.layoutVertically()
  if (!bare) {
    const h = box.addStack()
    h.centerAlignContent()
    symbol(h, "checklist", C.gold, 13)
    h.addSpacer(6)
    const t = h.addText("НАПОМИНАНИЯ")
    t.font = Font.boldSystemFont(11); t.textColor = C.gold
    h.addSpacer()
    if (rems.length) { const c = h.addText(String(rems.length)); c.font = Font.heavyRoundedSystemFont(12); c.textColor = C.gold }
    box.addSpacer(6)
  }
  if (!rems.length) { empty(box, "Всё сделано 🎉"); return }
  rems.slice(0, n).forEach((r, i) => {
    if (i) box.addSpacer(5)
    const late = isOverdue(r)
    const s = box.addStack()
    s.centerAlignContent()
    s.url = reminderURL(r)
    const col = late ? new Color(BRAND.terracotta) : C.gold
    if (!symbol(s, "circle", col, 15)) { const o = s.addText("○"); o.font = Font.systemFont(14); o.textColor = col }
    s.addSpacer(8)
    const tt = s.addText(r.title || "Без названия")
    tt.font = Font.mediumSystemFont(13.5); tt.textColor = C.text; tt.lineLimit = 1
    s.addSpacer(6)
    s.addSpacer()
    const when = reminderTime(r)
    if (when) {
      const pill = s.addStack()
      pill.setPadding(2, 7, 2, 7)
      pill.cornerRadius = 8
      pill.backgroundColor = late ? dynA("#FF3B30", 0.12, "#FF453A", 0.2) : C.soft
      const wt = pill.addText(when)
      wt.font = Font.boldRoundedSystemFont(11); wt.textColor = col; wt.lineLimit = 1
    }
  })
}

// ───────────── Еда, вода и активность ─────────────
// Еда: фото → Claude оценивает калории (нужен ключ ассистента). Вода — стаканами.
// Активность с Apple Watch приходит из Быстрой команды «Мой день - здоровье»:
// она читает «Здоровье» и запускает этот скрипт с параметром-словарём (см. README).
const dayKey = d => `${monthKey(d)}-${String(d.getDate()).padStart(2, "0")}`
const nf = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")
const liters = ml => `${(Math.round(ml / 50) / 20).toString().replace(".", ",")} л`
const rawFood = async () => withIds(await loadJSON("food.json"), "m")
const rawWater = async () => withIds(await loadJSON("water.json"), "w")
// Тренировки со слов (часы забыл): { title, minutes, kcal, date } — прибавляются к активности дня
const rawWorkouts = async () => withIds(await loadJSON("workouts.json"), "t")
const todayOnly = list => visible(list).filter(x => sameDay(new Date(x.date), new Date())).sort((a, b) => a.date - b.date)
const loadFoodToday = async () => todayOnly(await rawFood())
const loadWaterToday = async () => todayOnly(await rawWater())
const keepDays = (list, n) => list.filter(x => (x.date || 0) > Date.now() - n * 864e5 || x.deleted)
async function saveFood(list, deletedIds = []) { saveJSON("food.json", keepDays(mergeSynced(await rawFood(), list, deletedIds), 120)) }
async function saveWater(list, deletedIds = []) { saveJSON("water.json", keepDays(mergeSynced(await rawWater(), list, deletedIds), 60)) }
async function saveWorkouts(list, deletedIds = []) { saveJSON("workouts.json", keepDays(mergeSynced(await rawWorkouts(), list, deletedIds), 400)) }
async function addWorkout(w) {
  const now = Date.now()
  const x = Object.assign({ id: `t${now}-${Math.random().toString(36).slice(2, 6)}`, date: now, u: now }, w)
  x.kcal = Math.round(+x.kcal || 0); x.minutes = Math.round(+x.minutes || 0)
  await saveWorkouts([x])
  return x
}
// Активность дня = данные часов + тренировки со слов (сожжённые ккал и минуты упражнений складываются)
function withWorkouts(act, day, workouts) {
  const ws = workouts.filter(w => dayKey(new Date(w.date)) === day)
  if (!ws.length) return act
  const out = Object.assign({ day, updated: 0 }, act || {})
  out.active = (out.active || 0) + ws.reduce((s, w) => s + (w.kcal || 0), 0)
  out.exercise = (out.exercise || 0) + ws.reduce((s, w) => s + (w.minutes || 0), 0)
  out.updated = Math.max(out.updated || 0, ...ws.map(w => w.u || w.date || 0))
  return out
}

async function addFood(m) {
  const now = Date.now()
  const x = Object.assign({ id: `m${now}-${Math.random().toString(36).slice(2, 6)}`, date: now, u: now }, m)
  x.kcal = Math.round(+x.kcal || 0)
  await saveFood([x])
  return x
}
async function addWater(ml) {
  const now = Date.now()
  await saveWater([{ id: `w${now}`, date: now, u: now, ml: Math.round(ml) }])
}

// Число из Быстрых команд: может прийти строкой «1 234,5»
function healthNum(v) {
  if (v === null || v === undefined || v === "") return null
  if (Array.isArray(v)) {                                  // несколько значений (без группировки по дню) — складываем
    const xs = v.map(healthNum).filter(x => x !== null)
    return xs.length ? xs.reduce((a, b) => a + b, 0) : null
  }
  if (typeof v === "object") return healthNum(v.value ?? v.quantity ?? v["Значение"] ?? null)
  // Список из Быстрых команд приходит текстом в несколько строк («8327\n0») — складываем строки, а не склеиваем цифры
  if (typeof v === "string" && /[\n\r;]/.test(v.trim())) return healthNum(v.split(/[\n\r;]+/).filter(x => x.trim()))
  const n = parseFloat(String(v).replace(/[\s ]/g, "").replace(",", "."))
  return isFinite(n) ? n : null
}
const HEALTH_KEYS = { steps: ["steps", "шаги"], active: ["active", "активные", "калории"], exercise: ["exercise", "упражнения", "тренировка"],
  stand: ["stand", "стоя"], hr: ["hr", "пульс"], sleep: ["sleep", "сон"], distance: ["distance", "дистанция", "км"] }
function parseHealth(param) {
  let p = param
  if (typeof p === "string") { try { p = JSON.parse(p) } catch (e) { return null } }
  if (!p || typeof p !== "object") return null
  const low = {}
  for (const k of Object.keys(p)) low[k.toLowerCase().trim()] = p[k]
  // день можно передать (прошлые дни из Здоровья): «2026-10-20» или любая дата, которую понимает Date
  const dv = low.day ?? low.date ?? low["дата"] ?? low["день"]
  const dd = dv ? (/^\d{4}-\d{2}-\d{2}$/.test(String(dv).trim()) ? String(dv).trim() : dayKey(new Date(dv))) : null
  const out = { day: dd && /^\d{4}-/.test(dd) ? dd : dayKey(new Date()), updated: Date.now() }
  const bad = []
  for (const [key, names] of Object.entries(HEALTH_KEYS)) {
    const k = names.find(n => n in low)
    const v = k ? (low[k] === "" ? 0 : healthNum(low[k])) : null   // пусто — за сегодня данных нет
    if (v !== null) out[key] = v
    else if (k) bad.push(`${k} = «${String(JSON.stringify(low[k])).slice(0, 40)}»`)
  }
  if (bad.length) Object.defineProperty(out, "bad", { value: bad })   // для сообщения в Быстрых командах, в файл не пишется
  return Object.keys(out).length > 2 ? out : null
}
async function loadHealth(anyDay = false) {
  try {
    const h = JSON.parse(await readText("health.json"))
    return h && (anyDay || h.day === dayKey(new Date())) ? h : null      // вчерашние цифры не показываем
  } catch (e) { return null }
}
// История активности по дням (для таблицы): последняя запись дня заменяет прежнюю, храним ~400 дней
async function saveHealthDay(h) {
  const log = (await loadJSON("health-days.json")).filter(x => x && x.day !== h.day)
  log.push(Object.assign({}, h))
  log.sort((a, b) => a.day < b.day ? -1 : 1)
  saveJSON("health-days.json", log.slice(-400))
}
async function healthDays() {
  const log = await loadJSON("health-days.json"), cur = await loadHealth(true), ws = visible(await rawWorkouts())
  if (cur && !log.some(x => x.day === cur.day)) log.push(cur)
  const days = new Set([...log.map(x => x.day), ...ws.map(w => dayKey(new Date(w.date)))])
  return [...days].sort().map(day => withWorkouts(log.find(x => x.day === day), day, ws))
}
async function dayHealth() {
  const [food, water, watch, workouts] = await Promise.all([loadFoodToday(), loadWaterToday(), loadHealth(), rawWorkouts().then(todayOnly)])
  const sum = k => food.reduce((s, m) => s + (+m[k] || 0), 0)
  return { food, kcal: sum("kcal"), protein: sum("protein"), fat: sum("fat"), carbs: sum("carbs"),
    water: water.reduce((s, w) => s + (w.ml || 0), 0), waterList: water, workouts, act: withWorkouts(watch, dayKey(new Date()), workouts) }
}

// ── Оценка калорий по фото через Claude ──
// Ответ в виде JSON по схеме (structured outputs): принудительный вызов инструмента новые модели не принимают
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

function shrinkPhoto(img, max = 1024) {
  const { width: w, height: h } = img.size
  const k = Math.min(1, max / Math.max(w, h))
  if (k >= 1) return img
  const dc = new DrawContext()
  dc.size = new Size(Math.round(w * k), Math.round(h * k))
  dc.respectScreenScale = false
  dc.opaque = true
  dc.drawImageInRect(img, new Rect(0, 0, dc.size.width, dc.size.height))
  return dc.getImage()
}

async function estimateFood(img, hint) {
  const content = []
  if (img) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: Data.fromJPEG(shrinkPhoto(img)).toBase64String() } })
  content.push({ type: "text", text: (img ? "Оцени еду на фото." : "Оцени еду по описанию.") + (hint ? ` Уточнение от меня: ${hint}` : "") })
  const res = await anthropic({ model: CONFIG.agentModel, max_tokens: 4000, output_config: { format: { type: "json_schema", schema: FOOD_SCHEMA } },
    system: "Ты нутрициолог. Определи блюда и продукты, оцени вес каждой части по размеру тарелки, приборов и упаковок, посчитай калории и БЖУ. " +
      "Учитывай масло и соусы. Если есть уточнение от пользователя — оно важнее того, что видно. Названия по-русски.",
    messages: [{ role: "user", content }] })
  if (!res || res.error) throw new Error(res && res.error ? res.error.message || res.error.type : "пустой ответ")
  if (res.stop_reason === "refusal") throw new Error(`${AI_NAME} отказался оценивать это фото`)
  const t = (res.content || []).filter(c => c.type === "text").map(c => c.text).join("")
  try { return JSON.parse(t) } catch (e) { throw new Error(`${AI_NAME} не вернул оценку`) }
}

function foodSummary(e) {
  const lines = (e.items || []).map(i => `• ${i.name} — ${nf(i.grams)} г, ${nf(i.kcal)} ккал`)
  lines.push("", `Итого ≈ ${nf(e.kcal)} ккал`, `Б ${nf(e.protein)} · Ж ${nf(e.fat)} · У ${nf(e.carbs)} г`)
  lines.push(`Точность: ${e.confidence || "средняя"}`)
  if (e.note) lines.push(e.note)
  return lines.join("\n")
}

async function foodPhoto(source) {
  if (!aiReady()) return info(`Нужен ключ ${AI_NAME}`,
    `Калории по фото считает ${AI_NAME}. Добавьте API-ключ: меню → 🧠 Ассистент ${AI_NAME}. Он же включит умный разбор команд.`)
  let src = source === "camera" ? 0 : await choose("🍽 Еда", ["📷 Сфотографировать", "🖼 Выбрать из фото", "⌨️ Описать словами"])
  let img = null, hint = ""
  try {
    if (src === 0) img = await Photos.fromCamera()
    else if (src === 1) img = await Photos.fromLibrary()
    else if (src === 2) hint = await ask("Что съели?", "Например: тарелка том яма и рис", "Посчитать")
    else return
  } catch (e) { return }                                   // закрыли камеру — ничего не делаем
  if (!img && !hint) return
  while (true) {
    let est
    try { est = await estimateFood(img, hint) } catch (e) {
      if ((await choose("Не получилось посчитать", ["Повторить"], String(e.message || e))) === 0) continue
      return
    }
    if (est.not_food) return info("Еды не видно", "Попробуйте снять тарелку сверху, целиком в кадре.")
    const a = new Alert()
    a.title = `🍽 ${est.title}`
    a.message = foodSummary(est)
    a.addAction("Сохранить")
    a.addAction("Уточнить (порция, состав)")
    a.addAction("Изменить калории")
    a.addCancelAction("Отмена")
    const i = await a.presentAlert()
    if (i === -1) return
    if (i === 1) {
      const t = await ask("Уточнение", "Например: половина порции, без соуса, рис 150 г", "Пересчитать", hint)
      if (t) hint = t
      continue
    }
    if (i === 2) {
      const v = healthNum(await ask("Калории", "ккал", "Сохранить", String(Math.round(est.kcal))))
      if (!v) continue
      const k = v / (est.kcal || v)
      ;["protein", "fat", "carbs"].forEach(x => { est[x] = Math.round((est[x] || 0) * k) })
      est.kcal = v
    }
    await addFood({ title: est.title, kcal: est.kcal, protein: Math.round(est.protein || 0), fat: Math.round(est.fat || 0),
      carbs: Math.round(est.carbs || 0), items: est.items || [] })
    const d = await dayHealth()
    return info("✓ Записано", `${est.title}: ${nf(est.kcal)} ккал\nЗа сегодня: ${nf(d.kcal)} ккал` + (d.act && d.act.active ? `, сожжено ${nf(d.act.active)} ккал` : ""))
  }
}

// ── Вода ──
async function waterMenu() {
  while (true) {
    const d = await dayHealth()
    const goal = CONFIG.health.waterGoal
    const i = await choose(`💧 ${liters(d.water)} из ${liters(goal)}`,
      [`+ стакан ${CONFIG.health.glass} мл`, "+ бутылка 500 мл", "Другое количество", "Отменить последнее"],
      d.water >= goal ? "Норма на сегодня выполнена 🎉" : `Осталось ${liters(goal - d.water)}`)
    if (i === 0) await addWater(CONFIG.health.glass)
    else if (i === 1) await addWater(500)
    else if (i === 2) { const v = healthNum(await ask("Сколько выпили?", "мл", "Добавить")); if (v > 0) await addWater(v) }
    else if (i === 3) { const last = d.waterList[d.waterList.length - 1]; if (last) await saveWater([], [last.id]) }
    else return
  }
}

// ── Активность с часов ──
const HEALTH_SHORTCUT = "Мой день - здоровье"   // дефис, как печатается с клавиатуры
async function refreshHealth() {
  const cb = new CallbackURL("shortcuts://x-callback-url/run-shortcut")
  cb.addParameter("name", HEALTH_SHORTCUT)
  try { await cb.open() } catch (e) { return info("Не удалось запустить команду", `Проверьте, что в «Быстрых командах» есть команда «${HEALTH_SHORTCUT}». Инструкция — в меню «Еда и активность».`) }
}
function actLines(act) {
  if (!act) return "Данных с часов за сегодня нет. Запустите обновление или настройте команду."
  const l = []
  if (act.steps != null) l.push(`👟 ${nf(act.steps)} шагов` + (act.distance ? ` · ${String(Math.round(act.distance * 10) / 10).replace(".", ",")} км` : ""))
  if (act.active != null) l.push(`🔥 ${nf(act.active)} из ${nf(CONFIG.health.moveGoal)} активных ккал`)
  if (act.exercise != null) l.push(`🏃 ${nf(act.exercise)} из ${CONFIG.health.exerciseGoal} мин упражнений`)
  if (act.stand != null) l.push(`🧍 ${nf(act.stand)} ч с разминкой`)
  if (act.hr != null) l.push(`❤️ пульс в покое ${nf(act.hr)}`)
  if (act.sleep != null) l.push(`😴 сон ${String(Math.round(act.sleep * 10) / 10).replace(".", ",")} ч`)
  l.push(`обновлено в ${TIME.string(new Date(act.updated))}`)
  return l.join("\n")
}
async function healthMenu() {
  while (true) {
    const d = await dayHealth()
    const food = d.food.length ? d.food.map(m => `${TIME.string(new Date(m.date))} ${m.title} — ${nf(m.kcal)}`).join("\n") : "Пока ничего не записано"
    const wk = d.workouts.length ? "\n\n🏋️ Без часов: " + d.workouts.map(w => `${w.title} — ${nf(w.kcal)} ккал${w.minutes ? `, ${w.minutes} мин` : ""}`).join("; ") : ""
    const msg = `🍽 Съедено ${nf(d.kcal)} ккал · Б ${nf(d.protein)} Ж ${nf(d.fat)} У ${nf(d.carbs)}\n${food}\n\n` +
      `💧 Вода ${liters(d.water)} из ${liters(CONFIG.health.waterGoal)}\n\n${actLines(d.act)}${wk}`
    const i = await choose("Еда и активность", ["📷 Добавить еду", "💧 Вода", "🗑 Удалить приём пищи", "⌚ Обновить данные с часов", "ℹ️ Как подключить часы", "🏋️ Тренировка без часов", "🗑 Удалить тренировку"], msg)
    if (i === 0) await foodPhoto()
    else if (i === 1) await waterMenu()
    else if (i === 2) {
      if (!d.food.length) continue
      const j = await choose("Удалить", d.food.map(m => `${TIME.string(new Date(m.date))} ${m.title} — ${nf(m.kcal)} ккал`))
      if (j >= 0) await saveFood([], [d.food[j].id])
    }
    else if (i === 5) {
      const t = await ask("Тренировка без часов", "Например: проплыл 10 раз бассейн 18 м", "Записать")
      if (t) await voiceCommand(`Тренировка без часов, запиши: ${t}`)
    }
    else if (i === 6) {
      if (!d.workouts.length) continue
      const j = await choose("Удалить тренировку", d.workouts.map(w => `${TIME.string(new Date(w.date))} ${w.title} — ${nf(w.kcal)} ккал`))
      if (j >= 0) await saveWorkouts([], [d.workouts[j].id])
    }
    else if (i === 3) return refreshHealth()
    else if (i === 4) await info("Подключение Apple Watch",
      `Scriptable не может читать «Здоровье» сам, поэтому данные передаёт Быстрая команда «${HEALTH_SHORTCUT}». ` +
      "Как её собрать — в README.txt рядом с виджетом (раздел «Apple Watch»). Потом добавьте автоматизацию: " +
      "Быстрые команды → Автоматизация → Время суток → каждый час или несколько раз в день, «Запускать сразу».")
    else return
  }
}

// Запуск из Быстрой команды: сохранить данные «Здоровья» и выйти без окон
async function receiveHealth(param) {
  const h = parseHealth(param)
  if (!h) { Script.setShortcutOutput("Мой день: не понял данные. Нужен словарь steps, active, exercise, hr…"); return }
  if (h.day === dayKey(new Date())) saveJSON("health.json", h)   // прошлый день — только в историю
  await saveHealthDay(h)
  const got = [h.steps != null && `${nf(h.steps)} шагов`, h.active != null && `${nf(h.active)} ккал`,
    h.exercise != null && `${nf(h.exercise)} мин`].filter(Boolean).join(", ")
  Script.setShortcutOutput(`Мой день: сохранено в ${TIME.string(new Date())} (${Object.keys(h).filter(k => k in HEALTH_KEYS).join(", ")})` +
    (got ? `\n${got}` : "") +
    (h.bad ? `\nНе понял: ${h.bad.join("; ")}` : ""))
  // ответ команде уже готов: если выгрузка не успеет, её догонит виджет
  await syncSheet(true, 15)   // день активности сразу в таблицу (если она подключена)
}

// ── В виджете ──
function progressBar(parent, frac, width, color) {
  const bg = parent.addStack()
  bg.size = new Size(width, 4)
  bg.cornerRadius = 2
  bg.backgroundColor = C.cell
  const f = Math.max(0, Math.min(1, frac || 0))
  if (f > 0) {
    const fill = bg.addStack()
    fill.size = new Size(Math.max(4, Math.round(width * f)), 4)
    fill.cornerRadius = 2
    fill.backgroundColor = color
  }
  bg.addSpacer()
}

// Подсказка про воду вместо расписания уведомлений: с 9:00 до 21:00, если больше 3 часов не было записи воды.
// Возвращает часы без воды или 0. Отсчёт — от последней записи сегодня, без записей — от 9:00
function waterGap(d, now = new Date()) {
  const h = now.getHours()
  if (h < 9 || h >= 21 || (d.water || 0) >= CONFIG.health.waterGoal) return 0
  const start = new Date(now); start.setHours(9, 0, 0, 0)
  const last = Math.max(start.getTime(), ...((d.waterList || []).map(w => w.date || 0)))
  const gap = (now.getTime() - last) / 3600e3
  return gap >= 3 ? Math.floor(gap) : 0
}

// Одна строка: еда · вода · активность, каждая часть открывает своё
function healthStrip(parent, d, entries) {
  const s = parent.addStack()
  s.centerAlignContent()
  const part = (icon, text, color, action) => {
    const p = s.addStack()
    p.centerAlignContent()
    p.url = (action === "food" || action === "health") && STATS_URL ? STATS_URL : actURL(action)   // калории и активность — в таблицу
    symbol(p, icon, color, 12)
    p.addSpacer(4)
    const t = p.addText(text)
    t.font = Font.semiboldRoundedSystemFont(12); t.textColor = C.text; t.lineLimit = 1; t.minimumScaleFactor = 0.7
  }
  const a = d.act
  // калории одной частью: съедено / сожжено (часы + тренировки со слов)
  part("flame.fill", `${nf(d.kcal)} / ${a && a.active != null ? nf(a.active) : "—"}${entries ? "" : " ккал"}`, C.gold, "food")
  s.addSpacer()
  const gap = waterGap(d)
  // давно не пили — вода подсвечивается и пишет, сколько часов без воды; нажатие добавляет стакан
  if (gap) part("drop.fill", `${gap} ч без воды`, C.overdue, "water")
  else part("drop.fill", `${liters(d.water)} / ${liters(CONFIG.health.waterGoal)}`, C.notes, "water")
  s.addSpacer()
  part(a && a.steps != null ? "figure.walk" : "applewatch", a && a.steps != null ? `${nf(a.steps)} ш.` : "часы", C.expense, "health")
  if (entries) {   // большой виджет: доходы и расходы за месяц, нажатие — отчёт
    const t = monthTotals(entries, monthKey(new Date()))
    s.addSpacer()
    part(CONFIG.currencyIcon, `+${moneyShort(t.income)} −${moneyShort(t.expense)}`, C.income, "report")
  }
}

// Средний/маленький виджет с параметром «здоровье»
function healthPanel(w, d, small) {
  const W = small ? 130 : Math.floor((contentWidth() - 12) / 2)   // две колонки на всю ширину
  const big = (parent, value, unit, color) => {
    const r = parent.addStack(); r.bottomAlignContent()
    const v = r.addText(value); v.font = Font.boldRoundedSystemFont(small ? 18 : 20); v.textColor = color; v.lineLimit = 1; v.minimumScaleFactor = 0.6
    r.addSpacer(3)
    const u = r.addText(unit); u.font = Font.mediumSystemFont(10); u.textColor = C.sub
  }
  const line = (parent, text) => { const t = parent.addText(text); t.font = Font.systemFont(11); t.textColor = C.sub; t.lineLimit = 1; t.minimumScaleFactor = 0.7 }
  const cols = w.addStack(); cols.topAlignContent()
  const left = cols.addStack(); left.layoutVertically(); left.size = new Size(W, 0); left.url = STATS_URL || actURL("food")
  sectionHeader(left, "fork.knife", "Еда", C.gold, d.food.length)
  left.addSpacer(3)
  big(left, nf(d.kcal), "ккал", C.text)
  if (!small) line(left, `Б ${nf(d.protein)} · Ж ${nf(d.fat)} · У ${nf(d.carbs)}`)
  left.addSpacer(6)
  const wt = left.addStack(); wt.layoutVertically(); wt.url = actURL("water")
  const wl = wt.addStack(); wl.centerAlignContent(); symbol(wl, "drop.fill", C.notes, 11); wl.addSpacer(4)
  const wv = wl.addText(`${liters(d.water)} из ${liters(CONFIG.health.waterGoal)}`); wv.font = Font.semiboldRoundedSystemFont(11.5); wv.textColor = C.text
  wt.addSpacer(3)
  progressBar(wt, d.water / CONFIG.health.waterGoal, W - 6, C.notes)
  if (small) return
  cols.addSpacer(12)
  const right = cols.addStack(); right.layoutVertically(); right.size = new Size(W, 0); right.url = STATS_URL || actURL("health")
  sectionHeader(right, "applewatch", "Активность", C.expense)
  right.addSpacer(3)
  const a = d.act
  if (!a) { empty(right, "Нет данных с часов"); return }
  big(right, nf(a.active || 0), "ккал", C.expense)
  progressBar(right, (a.active || 0) / CONFIG.health.moveGoal, W - 6, C.expense)
  right.addSpacer(4)
  line(right, `👟 ${nf(a.steps || 0)} · 🏃 ${nf(a.exercise || 0)} мин`)
  line(right, `обновлено в ${TIME.string(new Date(a.updated))}`)
}

// ───────────── Сборка виджета по размеру ─────────────
async function buildWidget(family, param) {
  const days = weekDays()
  const lock = /^accessory/.test(family)   // экрану блокировки деньги и еда не нужны
  const [calendar, rems, notes, entries, health] = await Promise.all(
    [getCalendar(days), getReminders(), loadNotes(), lock ? [] : loadMoney(), lock ? null : dayHealth()])
  const events = upcoming(calendar)
  const weekEnd = new Date(days[days.length - 1]); weekEnd.setDate(weekEnd.getDate() + 1)
  const weekEvents = calendar.filter(e => e.startDate < weekEnd && e.endDate > days[0])
  const weekMode = /нед|week/i.test(param || "")
  const healthMode = /здоров|еда|health/i.test(param || "")

  // Экран блокировки
  if (family === "accessoryInline") {
    const w = new ListWidget()
    const e = events[0]
    w.addText(e ? `${eventTime(e)} · ${e.title}` : rems[0] ? `☐ ${rems[0].title}` : "День свободен")
    w.url = HOME_URL
    return w
  }
  if (family === "accessoryCircular") {
    const w = new ListWidget()
    w.addAccessoryWidgetBackground = true
    const n = w.addText(String(rems.length))
    n.font = Font.boldRoundedSystemFont(22); n.centerAlignText()
    const l = w.addText("дел"); l.font = Font.systemFont(10); l.centerAlignText()
    w.url = actURL("voice")
    return w
  }
  if (family === "accessoryRectangular") {
    const w = new ListWidget()
    w.url = HOME_URL
    const lines = []
    if (events[0]) lines.push(`📅 ${eventTime(events[0])} ${events[0].title}`)
    rems.slice(0, events[0] ? 1 : 2).forEach(r => lines.push(`☐ ${r.title}`))
    if (notes[0] && lines.length < 3) lines.push(`✎ ${notes[0].text}`)
    if (!lines.length) lines.push("Свободный день")
    lines.forEach(s => { const t = w.addText(s); t.font = Font.systemFont(12); t.lineLimit = 1 })
    return w
  }

  const w = baseWidget()

  if (family === "small" && healthMode) {
    dateHeader(w, "small", false)
    w.addSpacer(8)
    healthPanel(w, health, true)
    w.addSpacer()
    return w
  }

  if (family === "medium" && healthMode) {
    dateHeader(w, "medium", true)
    w.addSpacer(8)
    healthPanel(w, health, false)
    w.addSpacer()
    return w
  }

  if (family === "small") {
    dateHeader(w, "small", false)
    w.addSpacer(8)
    sectionHeader(w, "calendar", "Встречи", C.events, events.length)
    w.addSpacer(4)
    addEvents(w, events, 2, 12)
    w.addSpacer(8)
    sectionHeader(w, "checklist", "Дела", C.rem, rems.length)
    w.addSpacer(4)
    addReminders(w, rems, 1, 12)
    w.addSpacer()
    return w
  }

  if (family === "medium" && weekMode) {
    dateHeader(w, "medium", true)
    w.addSpacer(5)
    goldDivider(w)
    w.addSpacer(5)
    const near = days.filter(d => d >= startOfDay(new Date())).slice(0, 5)   // средний виджет: сегодня и 4 дня вперёд
    weekGrid(w, near, weekEvents, rems, CONFIG.medium.weekChips, { titleLines: 1 })
    w.addSpacer()
    return w
  }

  if (family === "medium" && !/дела|списки|list/i.test(param || "")) {
    // как в приложении: шапка и неделя с погодой; под ней — ближайшее дело
    const weather = await weatherWeek()
    dateHeader(w, "medium", true)
    w.addSpacer(7)
    weekStrip(w, days, weekEvents, weather, 54)
    w.addSpacer(7)
    const e = events[0], r = rems[0]
    const line = w.addStack(); line.centerAlignContent()
    const t = line.addText(e ? `${eventTime(e)} · ${stripEmoji(e.title || "")}` : r ? `☐ ${r.title}` : "Сегодня свободно")
    t.font = Font.semiboldSystemFont(12.5); t.textColor = e ? C.text : C.sub; t.lineLimit = 1
    w.addSpacer()
    return w
  }

  if (family === "medium") {
    dateHeader(w, "medium", true)
    w.addSpacer(8)
    const cols = w.addStack()
    cols.topAlignContent()
    const left = cols.addStack(); left.layoutVertically(); left.size = new Size(Math.floor((contentWidth() - 12) / 2), 0)
    cols.addSpacer(12)
    const right = cols.addStack(); right.layoutVertically(); right.size = new Size(Math.floor((contentWidth() - 12) / 2), 0)
    sectionHeader(left, "calendar", "Встречи", C.events, events.length)
    left.addSpacer(5)
    addEvents(left, events, CONFIG.medium.events, 12)
    right.url = REMINDERS_APP
    sectionHeader(right, "checklist", "Напоминания", C.rem, rems.length)
    right.addSpacer(5)
    addReminders(right, rems, CONFIG.medium.reminders, 12)
    w.addSpacer()
    return w
  }

  // large и extraLarge — как экран «Сегодня» в приложении: шапка, неделя с погодой, дела на сегодня, напоминания
  const weather = await weatherWeek()
  dateHeader(w, "large", true)
  w.addSpacer(8)
  weekStrip(w, days, weekEvents, weather)
  w.addSpacer(8)
  // сегодняшние события и напоминания делят одно место: чем меньше событий, тем больше напоминаний
  const used = todayList(cardBox(w, "Сегодня", 0, HOME_URL), weekEvents, CONFIG.large.today)
  w.addSpacer(8)
  reminderPanel(cardBox(w, "Напоминания", rems.length, HOME_URL), rems, Math.max(2, CONFIG.large.rows - used), true)
  w.addSpacer()
  healthStrip(w, health, entries)
  return w
}

// ───────────── Диалоги ─────────────
async function ask(title, placeholder, okLabel = "Сохранить", text = "", message) {
  const a = new Alert()
  a.title = title
  if (message) a.message = message
  a.addTextField(placeholder, text)
  a.addAction(okLabel)
  a.addCancelAction("Отмена")
  if ((await a.presentAlert()) === -1) return null
  const v = a.textFieldValue(0).trim()
  return v || null
}

async function choose(title, options, message) {
  const a = new Alert()
  a.title = title
  if (message) a.message = message
  options.forEach(o => a.addAction(o))
  a.addCancelAction("Назад")
  return await a.presentSheet()
}

async function pickDate(initial) {
  const p = new DatePicker()
  p.initialDate = initial || new Date(Date.now() + 60 * 60 * 1000)
  p.minuteInterval = 5
  try { return await p.pickDateAndTime() } catch (e) { return null }
}

async function info(title, message) {
  if (typeof config !== "undefined" && config.runsWithSiri) { Script.setShortcutOutput(`${title}${message ? "\n" + message : ""}`); return }
  const a = new Alert(); a.title = title; if (message) a.message = message
  a.addAction("OK"); await a.presentAlert()
}

// Подтверждение голосовой команды: "save" | "edit" | "cancel"
async function confirmVoice(title, summary, heard) {
  const a = new Alert()
  a.title = title
  a.message = `${summary}\n\n🎤 «${heard}»`
  a.addAction("Сохранить")
  a.addAction("Исправить текст")
  a.addCancelAction("Отмена")
  const i = await a.presentAlert()
  return i === 0 ? "save" : i === 1 ? "edit" : "cancel"
}

// ───────────── Создание записей ─────────────
const DAYS_DAT = ["воскресеньям", "понедельникам", "вторникам", "средам", "четвергам", "пятницам", "субботам"]

function recurLabel(r) {
  if (!r) return ""
  if (r.freq === "daily") return "каждый день"
  const d = (r.days || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  if (d.join() === "1,2,3,4,5") return "по будням"
  if (d.join() === "6,0") return "по выходным"
  return d.length ? "по " + d.map(x => DAYS_DAT[x]).join(" и ") : "каждую неделю"
}

function makeRule(recur) {
  if (!recur) return null
  try {
    if (recur.freq === "daily") return RecurrenceRule.daily(1)
    if (recur.days && recur.days.length > 1) return RecurrenceRule.complexWeekly(1, recur.days.map(d => d + 1), [])
    return RecurrenceRule.weekly(1)
  } catch (e) { return null }
}

// Календарь или список по имени (без учёта регистра, допускает часть имени); null — не найден
async function findCalendar(name, forReminders) {
  if (!name) return null
  try {
    const list = forReminders ? await Calendar.forReminders() : await Calendar.forEvents()
    const low = name.toLowerCase()
    return list.find(c => c.title.toLowerCase() === low) || list.find(c => c.title.toLowerCase().includes(low)) || null
  } catch (e) { return null }
}

async function createReminder(title, date, recur, listName) {
  const r = new Reminder()
  r.title = title
  const cal = await findCalendar(listName, true)
  if (cal) r.calendar = cal
  const rule = makeRule(recur)
  if (rule) r.addRecurrenceRule(rule)
  if (date) {
    r.dueDate = date
    r.dueDateIncludesTime = true
    if (CONFIG.notifyReminders && !WEB_APP && date > new Date()) {
      try {
        const n = new Notification()
        n.title = "⏰ Напоминание"
        n.body = title
        n.setTriggerDate(date)
        await n.schedule()
      } catch (e) {}
    }
  }
  r.save()
}

async function createEvent(title, start, minutes, location, recur, calName) {
  const e = new CalendarEvent()
  e.title = title
  const cal = await findCalendar(calName, false)
  if (cal) e.calendar = cal
  const rule = makeRule(recur)
  if (rule) e.addRecurrenceRule(rule)
  e.startDate = start
  e.endDate = new Date(start.getTime() + minutes * 60000)
  if (location) e.location = location
  e.save()
}

async function saveNote(text) {
  const now = Date.now()
  await saveNotes([{ id: `n${now}-${Math.random().toString(36).slice(2, 6)}`, text, date: now, u: now }])
}

// ───────────── Ручной ввод ─────────────
async function addNote() {
  const text = await ask("Быстрая заметка", "Что запомнить?")
  if (text) await saveNote(text)
}

async function addReminder() {
  const title = await ask("Новое напоминание", "Что сделать?", "Далее")
  if (!title) return
  const when = await choose("Когда напомнить?", ["Выбрать дату и время", "Без срока"])
  if (when === -1) return
  let date = null
  if (when === 0) { date = await pickDate(); if (!date) return }
  await createReminder(title, date)
}

async function addEvent() {
  const title = await ask("Новая встреча", "Название")
  if (!title) return
  const start = await pickDate()
  if (!start) return
  const durations = [["30 минут", 30], ["1 час", 60], ["1,5 часа", 90], ["2 часа", 120]]
  const i = await choose("Длительность", durations.map(d => d[0]))
  if (i === -1) return
  const loc = await ask("Место (необязательно)", "Адрес или ссылка", "Готово")
  await createEvent(title, start, durations[i][1], loc)
}

async function completeReminder() {
  const rems = (await getReminders()).slice(0, 20)
  if (!rems.length) return info("Все напоминания выполнены 🎉")
  const i = await choose("Отметить выполненным", rems.map(r => {
    const t = reminderTime(r)
    return t ? `${r.title} · ${t}` : r.title
  }))
  if (i === -1) return
  rems[i].isCompleted = true
  rems[i].save()
}

async function manageNotes() {
  while (true) {
    const notes = await loadNotes()
    if (!notes.length) return info("Заметок пока нет")
    const labels = notes.map(n => n.text.length > 50 ? n.text.slice(0, 50) + "…" : n.text)
    labels.push("🗑 Удалить все заметки")
    const i = await choose("Заметки", labels)
    if (i === -1) return
    if (i === notes.length) {
      const c = await choose("Удалить все заметки?", ["Да, удалить"])
      if (c === 0) await saveNotes([], notes.map(x => x.id))
      continue
    }
    const n = notes[i]
    const act = await choose(n.text, ["Скопировать", "Изменить", "Сделать напоминанием", "Удалить"],
      new Date(n.date).toLocaleString("ru-RU"))
    if (act === 0) Pasteboard.copy(n.text)
    if (act === 1) {
      const t = await ask("Изменить заметку", "", "Сохранить", n.text)
      if (t) await saveNotes([Object.assign({}, n, { text: t, u: Date.now() })])
    }
    if (act === 2) {
      const d = await pickDate()
      if (d) { await createReminder(n.text, d); await saveNotes([], [n.id]) }
    }
    if (act === 3) await saveNotes([], [n.id])
  }
}

// ───────────── Финансы: ввод ─────────────
const METHOD = { cash: "💵 Наличные", transfer: "💳 Перевод" }
const TYPE = { expense: "Расход", income: "Доход" }

function matchCategory(type, low) {
  low = ` ${low} `                    // чтобы слова с пробелом по краям находились и в начале, и в конце фразы
  for (const [name, words] of CONFIG.categories[type]) {
    if (words.some(w => low.includes(w))) return name
    if (low.includes(name.toLowerCase().slice(0, 5))) return name
  }
  return null
}

function parseMoney(text, type) {
  let low = " " + text.toLowerCase() + " "
  let amount = null, method = null, m
  if ((m = low.match(/(\d+(?:[.,]\d+)?)\s*(тыс\S*|k|к)(?=\s)/))) {
    amount = parseFloat(m[1].replace(",", ".")) * 1000
    low = low.replace(m[0], " ")
  } else if ((m = low.match(/\d{1,3}(?:[\s ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/))) {
    amount = parseFloat(m[0].replace(/[\s ]/g, "").replace(",", "."))
    low = low.replace(m[0], " ")
  }
  if ((m = low.match(/наличн\S*|налом|кэш\S*|кеш\S*|cash/))) { method = "cash"; low = low.replace(m[0], " ") }
  else if ((m = low.match(/перевод\S*|переве\S*|карт\S*|qr|кьюар\S*|онлайн|банк\S*/))) { method = "transfer"; low = low.replace(m[0], " ") }
  low = low.replace(CUR_RE, " ")
  return { amount: amount > 0 ? amount : null, method, category: matchCategory(type, low), comment: text.trim() }
}

// type: "expense" | "income" | null (спросить). heard — текст голосовой команды (для подтверждения)
async function addFinance(type, pre = {}, heard) {
  if (!type) {
    const i = await choose("Что записать?", ["➖ Расход", "➕ Доход"])
    if (i === -1) return
    type = i === 0 ? "expense" : "income"
  }
  let { amount, method, category, comment } = pre

  if (!amount) {
    const a = new Alert()
    a.title = TYPE[type]
    a.message = `Сумма ${CONFIG.currencyIn}`
    const f = a.addTextField(`Сумма, ${CONFIG.currency}`, "")
    f.setDecimalPadKeyboard()
    a.addTextField("Комментарий (необязательно)", comment || "")
    a.addAction("Далее")
    a.addCancelAction("Отмена")
    if ((await a.presentAlert()) === -1) return
    amount = parseFloat(a.textFieldValue(0).replace(/\s/g, "").replace(",", "."))
    comment = a.textFieldValue(1).trim() || comment || ""
    if (!(amount > 0)) return info("Сумма не распознана", "Введите число, например 250")
  }
  if (!method) {
    const i = await choose(`${TYPE[type]} ${money(amount)}`, [METHOD.cash, METHOD.transfer], "Наличные или перевод?")
    if (i === -1) return
    method = i === 0 ? "cash" : "transfer"
  }
  if (!category) {
    const names = CONFIG.categories[type].map(c => c[0])
    const i = await choose(`${TYPE[type]} ${money(amount)}`, names, "Категория")
    if (i === -1) return
    category = names[i]
  }

  const summary = `${TYPE[type]}: ${money(amount)}\n${METHOD[method]} · ${category}${comment && !heard ? `\n${comment}` : ""}`
  if (heard) {
    const r = await confirmVoice("Записать?", summary, heard)
    if (r === "edit") return voiceCommand(await ask("Исправить команду", "", "Готово", heard))
    if (r !== "save") return
  }
  const now = Date.now()
  await saveMoney([{ id: `f${now}-${Math.random().toString(36).slice(2, 6)}`, date: now, u: now,
    type, amount, method, category, comment: comment || "" }])
  const list = await loadMoney()
  if (!heard) {
    const t = monthTotals(list, monthKey(new Date()))
    await info("Сохранено ✓", `${summary}\n\nЗа месяц: −${money(t.expense)} / +${money(t.income)}`)
  }
}

async function manageMoney() {
  while (true) {
    const list = await loadMoney()
    const last = list.slice().sort((a, b) => b.date - a.date).slice(0, 30)
    if (!last.length) return info("Операций пока нет")
    const labels = last.map(e =>
      `${DM.string(new Date(e.date))}  ${e.type === "expense" ? "−" : "+"}${money(e.amount)} · ${e.category}`)
    const i = await choose("Последние операции", labels, "Нажмите, чтобы удалить ошибочную запись")
    if (i === -1) return
    const e = last[i]
    const c = await choose(labels[i], ["🗑 Удалить"], `${METHOD[e.method]}${e.comment ? "\n" + e.comment : ""}`)
    if (c === 0) await saveMoney([], [e.id])
  }
}

// ───────────── Расходы по карте ─────────────
// Скрипт таблицы читает письма банков (Bangkok Bank, Kasikornbank) и при выгрузке присылает платежи, которых здесь ещё нет.
// Они записываются расходом «Перевод». Если такая же сумма уже записана вручную (разница до суток) — спросить.
const CARD_WORDS = [
  ["Еда и продукты",   /7-?eleven|seven|makro|lotus|big ?c\b|tops|villa market|foodland|family ?mart|mini ?big|gourmet|supermarket|market|fresh/i],
  ["Кафе и рестораны", /resta?u|reataurant|cafe|café|coffee|kitchen|bistro|noodle|pizza|burger|starbucks|amazon|bakery|grill|food|eat|bar\b|pub\b/i],
  ["Транспорт",        /grab|bolt|taxi|bts|mrt|airport rail|ptt|shell|bangchak|esso|caltex|parking|lineman|robinhood|indrive/i],
  ["Здоровье",         /pharma|hospital|clinic|dental|boots|watsons|medic/i],
  ["Красота и массаж", /massage|spa\b|salon|barber|beauty/i],
  ["Связь и интернет", /\bais\b|true ?move|dtac|true ?online|3bb|internet|mobile/i],
  ["Жильё",            /condo|juristic|electric|\bpea\b|\bmea\b|waterworks|\bpwa\b|rent/i],
  ["Спорт",            /fitness|gym|yoga|muay|sport/i],
  ["Покупки",          /homepro|uniqlo|central|robinson|lazada|shopee|ikea|power ?buy|mall|store|shop/i],
]
function cardCategory(to) {
  const names = CONFIG.categories.expense.map(c => c[0])
  const hit = CARD_WORDS.find(([name, re]) => names.includes(name) && re.test(to || ""))
  return hit ? hit[0] : (matchCategory("expense", String(to || "").toLowerCase()) || "Другое")
}
const cardEntry = c => ({ id: c.id, date: c.date, u: Date.now(), type: "expense", amount: c.amount, method: "transfer",
  category: cardCategory(c.to), comment: c.to || c.kind || "Карта", card: true })
// Запись, сделанная вручную, с той же суммой и не дальше суток от платежа
const cardTwin = (c, list) => list.find(x => x && !x.deleted && x.type === "expense" && !x.card && !/^(bbl|kb)-/.test(String(x.id))
  && Math.abs(x.amount - c.amount) < 0.01 && Math.abs(x.date - c.date) <= 24 * 3600 * 1000)

async function takeCard(card) {
  const all = await rawMoney(), known = new Set(all.map(x => x.id))   // и удалённые: «дубль» второй раз не спросим
  const st = await loadSettings()
  const ask = (st.cardAsk || []).filter(x => !known.has(x.id))
  const add = [], fresh = []
  const skips = withIds(await loadJSON("skips.json"), "k"), skipped = []
  for (const c of card) {
    if (!c || !c.id || !(c.amount > 0) || known.has(c.id) || ask.some(x => x.id === c.id)) continue
    // помощнику сказали «этот платёж не вноси» — запомнить как удалённый, чтобы не пришёл снова
    const sk = skips.find(k => !k.deleted && !k.used && Math.abs(k.amount - c.amount) < 0.01 && c.date >= k.date - 3 * 864e5 && c.date <= (k.until || 0))
    if (sk) { Object.assign(sk, { used: true, usedId: c.id, u: Date.now() }); skipped.push([c, sk]); continue }
    if (cardTwin(c, all)) { ask.push(c); fresh.push(c) } else add.push(cardEntry(c))
  }
  if (add.length || skipped.length) saveJSON("finance.json", mergeSynced(all, add, skipped.map(([c]) => c.id)))
  if (skipped.length) {
    saveJSON("skips.json", skips)
    try { const n = new Notification(); n.identifier = "myday-card-skip"; n.title = "💳 Не внесено в расходы"
      n.body = skipped.map(([c, k]) => `${money(c.amount)} · ${c.to || "карта"}${k.note ? " — " + k.note : ""}`).join("\n"); await n.schedule() } catch (e) {}
  }
  await saveSettings({ cardAsk: ask })
  try {
    if (add.length) {
      const n = new Notification()
      n.identifier = "myday-card"
      n.title = add.length === 1 ? `💳 Расход по карте: ${money(add[0].amount)}` : `💳 Расходы по карте: ${add.length}`
      n.body = add.map(e => `−${money(e.amount)} · ${e.comment} · ${e.category}`).join("\n")
      n.openURL = `${RUN}?action=report`
      await n.schedule()
    }
    if (fresh.length) {
      const n = new Notification()
      n.identifier = "myday-card-dup"
      n.title = "💳 Похоже на дубль"
      n.body = `${fresh.map(c => `${money(c.amount)} · ${c.to}`).join(", ")}: такая сумма уже записана. Нажмите, чтобы решить.`
      n.openURL = `${RUN}?action=card`
      await n.schedule()
    }
  } catch (e) {}
  return { added: add.length, ask: fresh.length }
}

// Спросить про возможные дубли: «одно и то же» — не добавлять, «разные» — добавить, «позже» — спросить в следующий раз
async function askCardDups() {
  const st = await loadSettings()
  let allSame = false
  const list = st.cardAsk || []
  for (const [i, c] of list.entries()) {
    const all = await rawMoney()
    let r = 1
    if (!all.some(x => x.id === c.id)) {
      const twin = cardTwin(c, all)
      if (twin && allSame) r = 0
      else if (twin) {
        const a = new Alert()
        a.title = "💳 Похоже на дубль"
        a.message = `По карте: ${WHEN_S.string(new Date(c.date))}\n−${money(c.amount)} · ${c.to || c.kind}\n\n` +
          `Уже записано: ${WHEN_S.string(new Date(twin.date))}\n−${money(twin.amount)} · ${twin.category}${twin.comment ? " · " + twin.comment : ""}`
        a.addAction("Это одно и то же — не добавлять")
        a.addAction("Разные — добавить")
        const left = list.length - i - 1
        if (left) a.addAction(`Это и ещё ${left} — дубли, не добавлять`)   // после загрузки месяца вопросов много
        a.addCancelAction("Решить позже")
        r = await a.presentAlert()
        if (r === -1) return
        if (r === 2) { allSame = true; r = 0 }
      }
      saveJSON("finance.json", mergeSynced(all, r === 0 ? [] : [cardEntry(c)], r === 0 ? [c.id] : []))
    }
    const cur = await loadSettings()
    await saveSettings({ cardAsk: (cur.cardAsk || []).filter(x => x.id !== c.id) })
  }
}

async function cardMenu() {
  const title = "💳 Расходы по карте"
  const r = await syncSheet(false)
  if (!r || !r.ok) return info(title, `Таблица не ответила: ${(r && r.error) || "нет связи"}`)
  if (!Array.isArray(r.card)) return info(title, "Выключено. Включается один раз в Google Таблице: меню «Мой день» → " +
    "«Расходы по карте: включить» (Google попросит разрешить доступ к почте). Скрипт таблицы при этом нужно обновить и развернуть заново.")
  await askCardDups()
  const t = r.cardTaken || { added: 0 }
  await info(title, "Включено: таблица каждые 15 минут читает письма Bangkok Bank и Kasikornbank, а виджет сам записывает оплаты " +
    "расходом «Перевод». Если такая же сумма уже записана вручную, виджет спросит, дубль ли это.\n\n" +
    `Сейчас добавлено: ${t.added}. Наличные по-прежнему записывайте сами.`)
}

// ───────────── Финансы: отчёт ─────────────
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])) }

function catRows(obj, total, color) {
  const rows = Object.entries(obj).sort((a, b) => b[1] - a[1])
  if (!rows.length) return `<div class="row"><span class="muted">Нет записей</span></div>`
  return rows.map(([name, sum]) => {
    const pct = total ? Math.round(sum / total * 100) : 0
    return `<div class="row col"><div class="line"><span>${esc(name)}</span><b>${money(sum)}</b></div>
      <div class="track"><div class="bar" style="width:${pct}%;background:${color}"></div></div>
      <span class="muted small">${pct}%</span></div>`
  }).join("")
}

function reportHTML(key, list) {
  const t = monthTotals(list, key)
  const bal = t.income - t.expense
  const ops = t.items.slice().reverse().map(e => `
    <div class="row">
      <div><div>${esc(e.category)}</div>
        <div class="muted small">${DM.string(new Date(e.date))} · ${e.method === "cash" ? "наличные" : "перевод"}${e.comment ? " · " + esc(e.comment) : ""}</div></div>
      <b class="${e.type}">${e.type === "expense" ? "−" : "+"}${money(e.amount)}</b>
    </div>`).join("")
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#F5F6FA;--card:#fff;--text:#14161A;--sub:#6B7280;--line:#E6E8EF;--exp:#FF6B5E;--inc:#30C48D;--track:#EEF0F5}
@media (prefers-color-scheme:dark){:root{--bg:#0F1115;--card:#1A1D24;--text:#F2F3F5;--sub:#9AA1AD;--line:#2A2E37;--track:#262A33}}
body{margin:0;padding:20px 16px 48px;background:var(--bg);color:var(--text);font:15px -apple-system,system-ui;-webkit-text-size-adjust:100%}
h1{font-size:28px;margin:0}
h2{font-size:13px;margin:24px 4px 8px;color:var(--sub);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.muted{color:var(--sub)}.small{font-size:12px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}
.card{background:var(--card);border-radius:16px;padding:12px}
.card b{display:block;font-size:16px;margin-top:4px;font-variant-numeric:tabular-nums}
.list{background:var(--card);border-radius:16px;padding:2px 14px}
.row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}
.row.col{flex-direction:column;align-items:stretch;gap:4px}
.line{display:flex;justify-content:space-between;gap:12px}
.track{height:6px;border-radius:3px;background:var(--track);overflow:hidden}
.bar{height:100%;border-radius:3px}
b{font-variant-numeric:tabular-nums;white-space:nowrap}
.expense{color:var(--exp)}.income{color:var(--inc)}
</style></head><body>
<h1>${monthTitle(key)}</h1>
<div class="muted">Доходы и расходы ${CONFIG.currencyIn} · ${t.items.length} операций</div>
<div class="cards">
  <div class="card"><span class="muted small">Доходы</span><b class="income">${money(t.income)}</b></div>
  <div class="card"><span class="muted small">Расходы</span><b class="expense">${money(t.expense)}</b></div>
  <div class="card"><span class="muted small">Баланс</span><b class="${bal < 0 ? "expense" : "income"}">${bal < 0 ? "−" : "+"}${money(bal)}</b></div>
</div>
<h2>Наличные и переводы</h2>
<div class="list">
  <div class="row"><span>💵 Расходы наличными</span><b class="expense">${money(t.cash.expense)}</b></div>
  <div class="row"><span>💳 Расходы переводом</span><b class="expense">${money(t.transfer.expense)}</b></div>
  <div class="row"><span>💵 Доходы наличными</span><b class="income">${money(t.cash.income)}</b></div>
  <div class="row"><span>💳 Доходы переводом</span><b class="income">${money(t.transfer.income)}</b></div>
</div>
<h2>Расходы по категориям</h2>
<div class="list">${catRows(t.cats.expense, t.expense, "var(--exp)")}</div>
<h2>Доходы по категориям</h2>
<div class="list">${catRows(t.cats.income, t.income, "var(--inc)")}</div>
<h2>Все операции</h2>
<div class="list">${ops || `<div class="row"><span class="muted">Нет записей за этот месяц</span></div>`}</div>
</body></html>`
}

function reportText(key, list) {
  const t = monthTotals(list, key)
  const cats = obj => Object.entries(obj).sort((a, b) => b[1] - a[1])
  const lines = [
    `Отчёт за ${monthTitle(key).toLowerCase()} (THB)`,
    `Доходы: ${money(t.income)} (наличные ${money(t.cash.income)}, перевод ${money(t.transfer.income)})`,
    `Расходы: ${money(t.expense)} (наличные ${money(t.cash.expense)}, перевод ${money(t.transfer.expense)})`,
    `Баланс: ${t.income - t.expense < 0 ? "−" : "+"}${money(t.income - t.expense)}`,
    "", "Расходы по категориям:",
    ...cats(t.cats.expense).map(([n, s]) => `— ${n}: ${money(s)} (${t.expense ? Math.round(s / t.expense * 100) : 0}%)`),
    "", "Доходы по категориям:",
    ...cats(t.cats.income).map(([n, s]) => `— ${n}: ${money(s)}`),
    "", "Операции:",
    ...t.items.map(e => `${DM.string(new Date(e.date))} ${e.type === "expense" ? "−" : "+"}${money(e.amount)} · ${e.category} · ${e.method === "cash" ? "нал" : "перевод"}${e.comment ? " · " + e.comment : ""}`),
  ]
  return lines.join("\n")
}

function reportCSV(key, list) {
  const q = s => `"${String(s).replace(/"/g, '""')}"`
  const rows = monthTotals(list, key).items.map(e => [
    YMD.string(new Date(e.date)), e.type === "expense" ? "Расход" : "Доход",
    String(e.amount).replace(".", ","), e.method === "cash" ? "Наличные" : "Перевод", q(e.category), q(e.comment || ""),
  ].join(";"))
  return ["Дата;Тип;Сумма THB;Способ;Категория;Комментарий", ...rows].join("\n")
}

async function report(key) {
  const list = await loadMoney()
  if (!key) {
    const keys = [...new Set(list.map(e => monthKey(new Date(e.date))).concat([monthKey(new Date())]))].sort().reverse()
    if (keys.length > 1) {
      const i = await choose("Отчёт за месяц", keys.map(monthTitle))
      if (i === -1) return
      key = keys[i]
    } else key = keys[0]
  }
  await WebView.loadHTML(reportHTML(key, list), null, null, true)
  const i = await choose(`Отчёт: ${monthTitle(key)}`, ["📋 Скопировать текстом", "📄 Сохранить CSV в Файлы"])
  if (i === 0) {
    Pasteboard.copy(reportText(key, list))
    await info("Скопировано", `Отчёт в буфере обмена — можно вставить в чат с ${AI_NAME} для разбора`)
  }
  if (i === 1) {
    try { await DocumentPicker.exportString(reportCSV(key, list), `finance-${key}.csv`) } catch (e) {}
  }
}

async function scheduleMonthlyReport() {
  if (!CONFIG.monthlyReportNotification) return
  try {
    const now = new Date()
    const n = new Notification()
    n.identifier = "myday-monthly-report"
    n.title = `📊 Отчёт за ${MONTH_NOM[now.getMonth()].toLowerCase()}`
    n.body = "Месяц закончился — нажмите, чтобы посмотреть доходы и расходы"
    n.openURL = `${RUN}?action=report&month=${monthKey(now)}`
    n.setTriggerDate(new Date(now.getFullYear(), now.getMonth() + 1, 1, 10, 0, 0))
    await n.schedule()
  } catch (e) {}
}

// ───────────── Голосовые команды ─────────────
const WEEKDAYS = [["воскресен", 0], ["понедельн", 1], ["вторн", 2], ["сред", 3], ["четверг", 4], ["пятниц", 5], ["суббот", 6]]
const MONTH_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа",
  "сентября", "октября", "ноября", "декабря"]
const WHEN_S = fmt("EE, d MMM, HH:mm")

function cleanText(s) {
  return s.replace(/\s+/g, " ").trim()
    .replace(/^(и|а|ну|так|ещё|еще)\s+/i, "")
    .replace(/^(мне|что|чтобы|о том,? что|про)\s+/i, "")
    .replace(/\s+(и|а)$/i, "")
    .replace(/^[,:.\-—\s]+|[,.:;\s—-]+$/g, "")
}

// Достаёт из фразы дату/время. inheritDay — день из предыдущей команды («завтра встреча в 10, и в 12 ещё одна»)
function parseWhen(text, inheritDay) {
  let s = " " + text + " "
  const now = new Date()
  const take = re => { const m = s.match(re); if (m) s = s.replace(m[0], " "); return m }
  let m, day = null, weekday = false

  if ((m = take(/\sчерез\s+(полчаса|(\d+)?\s*(минут\S*|мин\.?|час\S*|дн\S*|день|недел\S*))(?=[\s,.])/i))) {
    const d = new Date(now)
    if (/полчаса/i.test(m[1])) { d.setMinutes(d.getMinutes() + 30); return { date: d, hasTime: true, explicitDay: false, rest: cleanText(s) } }
    const n = m[2] ? parseInt(m[2]) : 1, u = m[3].toLowerCase()
    if (u.startsWith("мин")) { d.setMinutes(d.getMinutes() + n); return { date: d, hasTime: true, explicitDay: false, rest: cleanText(s) } }
    if (u.startsWith("час")) { d.setHours(d.getHours() + n); return { date: d, hasTime: true, explicitDay: false, rest: cleanText(s) } }
    day = startOfDay(now); day.setDate(day.getDate() + (u.startsWith("нед") ? 7 * n : n))
  }

  if (!day && take(/\sпослезавтра(?=[\s,.])/i)) { day = startOfDay(now); day.setDate(day.getDate() + 2) }
  else if (!day && take(/\sзавтра(?=[\s,.])/i)) { day = startOfDay(now); day.setDate(day.getDate() + 1) }
  else if (!day && take(/\sсегодня(?=[\s,.])/i)) day = startOfDay(now)

  let recur = null
  const nextOf = list => { const d = startOfDay(now); d.setDate(d.getDate() + Math.min(...list.map(wd => (wd - now.getDay() + 7) % 7))); return d }
  const ROOTS = WEEKDAYS.map(w => w[0]).join("|")
  if (!day && (m = take(new RegExp(`\\s(?:по|кажд\\S*)\\s+((?:(?:${ROOTS})\\S*(?:\\s*,\\s*|\\s+и\\s+|\\s+)?)+)`, "i")))) {
    const days = WEEKDAYS.filter(([r]) => new RegExp(r, "i").test(m[1])).map(([, wd]) => wd)
    recur = { freq: "weekly", days }
    day = nextOf(days); weekday = true
  } else if (take(/\s(каждый день|ежедневно)(?=[\s,.])/i)) {
    recur = { freq: "daily" }
    if (!day) day = startOfDay(now)
  } else if (!day && take(/\sпо будням(?=[\s,.])/i)) {
    recur = { freq: "weekly", days: [1, 2, 3, 4, 5] }; day = nextOf(recur.days); weekday = true
  } else if (!day && take(/\sпо выходным(?=[\s,.])/i)) {
    recur = { freq: "weekly", days: [6, 0] }; day = nextOf(recur.days); weekday = true
  }

  if (!day) {
    for (const [root, wd] of WEEKDAYS) {
      if ((m = take(new RegExp(`\\s(?:в|во|на)?\\s*(следующ\\S*\\s+|эт\\S*\\s+)?${root}\\S*(?=[\\s,.?])`, "i")))) {
        day = startOfDay(now)
        day.setDate(day.getDate() + ((wd - now.getDay() + 7) % 7))
        if (m[1] && /следующ/i.test(m[1])) day.setDate(day.getDate() + 7)
        weekday = true
        break
      }
    }
  }

  if (!day && (m = take(new RegExp(`\\s(\\d{1,2})(?:-?(?:го|е|ое))?\\s+(${MONTH_GEN.join("|")})(?=[\\s,.])`, "i")))) {
    const mi = MONTH_GEN.indexOf(m[2].toLowerCase())
    day = new Date(now.getFullYear(), mi, parseInt(m[1]))
    if (day < startOfDay(now)) day.setFullYear(day.getFullYear() + 1)
  }
  const explicitDay = !!day

  let h = null, min = 0, endH = null, endMin = 0, noPart = false
  const adj = (x, part) => ((part === "дня" || part === "вечера") && x < 12) ? x + 12 : (part === "ночи" && x === 12) ? 0 : x
  if ((m = take(/\sс\s+(\d{1,2})(?:[:.](\d{2}))?(?:\s*час\S*)?\s+до\s+(\d{1,2})(?:[:.](\d{2}))?(?:\s*час\S*)?(?:\s+(утра|дня|вечера|ночи))?(?=[\s,.])/i))) {
    const part = (m[5] || "").toLowerCase()
    noPart = !part
    h = adj(+m[1], part); min = +(m[2] || 0); endH = adj(+m[3], part); endMin = +(m[4] || 0)
    if (!part && h >= 1 && h <= 6) { h += 12; if (endH < 12) endH += 12 }
    if (endH * 60 + endMin <= h * 60 + min && endH < 12) endH += 12
    if (h > 23 || endH > 24 || min > 59 || endMin > 59) { h = endH = null; min = endMin = 0 }
  }
  else if ((m = take(/\sс\s+(\d{1,2})(?:[:.](\d{2}))?(?:\s*час\S*)?(?:\s+(утра|дня|вечера|ночи))?(?=[\s,.?])(?!\s+до\s)/i))) {
    h = adj(+m[1], (m[3] || "").toLowerCase()); min = +(m[2] || 0)   // «с 6 вечера» без «до» — это начало
    noPart = !m[3]
    if (noPart && h >= 1 && h <= 6) h += 12
    if (h > 23 || min > 59) { h = null; min = 0 }
  }
  else if (take(/\sв\s+полдень(?=[\s,.])/i)) h = 12
  else if ((m = take(/\s(?:в|к|на)\s+(\d{1,2})(?:[:.](\d{2}))?(?:\s*(?:час\S*|ч\.?))?(?:\s*(\d{1,2})\s*(?:минут\S*|мин\.?))?(?:\s+(утра|дня|вечера|ночи))?(?=[\s,.])/i))) {
    h = parseInt(m[1]); min = parseInt(m[2] || m[3] || "0")
    const part = (m[4] || "").toLowerCase()
    noPart = !part
    if ((part === "дня" || part === "вечера") && h < 12) h += 12
    else if (part === "ночи" && h === 12) h = 0
    else if (!part && h >= 1 && h <= 6) h += 12
    if (h > 23 || min > 59) { h = null; min = 0 }
  }

  // Часть суток словами, если час не назван
  let soft = false
  if (h === null) {
    if (take(/\s(утром|с\s+утра|поутру)(?=[\s,.?])/i)) { h = 9; soft = true }
    else if (take(/\s(в\s+обед|в\s+обеденное\s+время|днём|днем)(?=[\s,.?])/i)) { h = 13; soft = true }
    else if (take(/\s(вечером|под\s+вечер)(?=[\s,.?])/i)) { h = 19; soft = true }
    else if (take(/\s(ночью|перед\s+сном)(?=[\s,.?])/i)) { h = 23; soft = true }
  }
  // «вечером», когда вечер уже идёт: ближайший целый час, а не завтра
  if (soft && !day && h >= 19 && now.getHours() >= h && now.getHours() < 23) {
    const d0 = new Date(now); d0.setHours(now.getHours() + 1, 0, 0, 0)
    return { date: d0, hasTime: true, explicitDay: false, recur, minutes: null, noPart: false, rest: cleanText(s) }
  }
  if (!day && h !== null && inheritDay) day = new Date(inheritDay)
  if (!day && h === null) return { date: null, hasTime: false, explicitDay: false, recur, rest: cleanText(s) }
  const d = day ? new Date(day) : startOfDay(now)
  if (h !== null) d.setHours(h, min, 0, 0)
  else d.setHours(CONFIG.defaultReminderHour, 0, 0, 0)
  if (d < now) {
    if (recur && recur.freq === "daily") d.setDate(d.getDate() + 1)
    else if (recur && recur.days && recur.days.length > 1) {
      do { d.setDate(d.getDate() + 1) } while (!recur.days.includes(d.getDay()))
    }
    else if (!day) d.setDate(d.getDate() + 1)
    else if (weekday) d.setDate(d.getDate() + 7)
  }
  const minutes = endH !== null ? (endH * 60 + endMin) - (h * 60 + min) : null
  return { date: d, hasTime: h !== null, explicitDay, recur, minutes, noPart, rest: cleanText(s) }
}

// Числа словами → цифры: «с семи до девяти» → «с 7 до 9», «триста пятьдесят» → «350»
const NUM_WORDS = { ноль: 0, один: 1, одна: 1, одну: 1, одного: 1, одной: 1, два: 2, две: 2, двух: 2, три: 3, трёх: 3, трех: 3,
  четыре: 4, четырёх: 4, четырех: 4, пять: 5, пяти: 5, шесть: 6, шести: 6, семь: 7, семи: 7, восемь: 8, восьми: 8,
  девять: 9, девяти: 9, десять: 10, десяти: 10, одиннадцать: 11, одиннадцати: 11, двенадцать: 12, двенадцати: 12,
  тринадцать: 13, тринадцати: 13, четырнадцать: 14, четырнадцати: 14, пятнадцать: 15, пятнадцати: 15,
  шестнадцать: 16, шестнадцати: 16, семнадцать: 17, семнадцати: 17, восемнадцать: 18, восемнадцати: 18,
  девятнадцать: 19, девятнадцати: 19, двадцать: 20, двадцати: 20, тридцать: 30, тридцати: 30, сорок: 40, сорока: 40,
  пятьдесят: 50, пятидесяти: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90,
  сто: 100, ста: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700,
  восемьсот: 800, девятьсот: 900 }
const NUM_MULT = { тысяча: 1000, тысячи: 1000, тысячу: 1000, тысяч: 1000 }
const NUM_SEQ = new RegExp(`(^|[^а-яё0-9])((?:(?:${Object.keys(NUM_WORDS).concat(Object.keys(NUM_MULT))
  .sort((a, b) => b.length - a.length).join("|")})(?=[^а-яё]|$)\\s*)+)`, "gi")

const ORD_GEN = { первого: 1, второго: 2, третьего: 3, четвёртого: 4, четвертого: 4, пятого: 5, шестого: 6, седьмого: 7,
  восьмого: 8, девятого: 9, десятого: 10, одиннадцатого: 11, двенадцатого: 12 }
const ORD_RE = Object.keys(ORD_GEN).join("|")

function normalizeSpeech(text) {
  return (" " + text + " ")
    .replace(/(\s)послезавтрашн\S*/gi, "$1послезавтра")
    .replace(/(\s)завтрашн\S*/gi, "$1завтра")
    .replace(/(\s)сегодняшн\S*/gi, "$1сегодня")
    .replace(/(\s)вчерашн\S*/gi, "$1вчера")
    // «в половине восьмого», «полвосьмого» → 7:30; «в четверть восьмого» → 7:15
    .replace(new RegExp(`(\\s)(?:в\\s+)?(?:половин\\S*\\s+|пол)(${ORD_RE})(?=[\\s,.?])`, "gi"), (m, sp, o) => `${sp}в ${ORD_GEN[o.toLowerCase()] - 1 || 12}:30`)
    .replace(new RegExp(`(\\s)(?:в\\s+)?четверть\\s+(${ORD_RE})(?=[\\s,.?])`, "gi"), (m, sp, o) => `${sp}в ${ORD_GEN[o.toLowerCase()] - 1 || 12}:15`)
    .replace(/(\s)(в|к|с|до)\s+час(?=[\s,.])/gi, "$1$2 1")
    // «2 тысячи», «2,5 тысячи» → 2000, 2500 (иначе «2 1000» читается как 2 100)
    .replace(/(\d+(?:[.,]\d+)?)\s*тысяч\S*/gi, (m, n) => String(Math.round(parseFloat(n.replace(",", ".")) * 1000)))
    .replace(NUM_SEQ, (m, pre, seq) => {
      const nums = []
      let total = 0, cur = 0, last = Infinity, any = false
      const flush = () => { if (any) nums.push(total + cur); total = 0; cur = 0; last = Infinity; any = false }
      for (const w of seq.toLowerCase().trim().split(/\s+/)) {
        if (NUM_MULT[w]) { total += (cur || 1) * 1000; cur = 0; last = 1000; any = true; continue }
        const v = NUM_WORDS[w]
        if (v >= last || (last >= 10 && last < 20)) flush()   // «десяти три» — это 10 и 3, а не 13
        cur += v; last = v || 1; any = true
      }
      flush()
      return `${pre}${nums.join(" ")}${/\s$/.test(seq) ? " " : ""}`
    })
    .replace(/(\s(?:в|к|с|до)\s+)(\d{1,2}) (\d{2})(?=[\s,.])/gi, "$1$2:$3")
    // «без четверти семь» → 6:45, «без десяти восемь» → 7:50
    .replace(/(\s)(?:в\s+)?без\s+четверти\s+(\d{1,2})(?=[\s,.?])/gi, (m, sp, n) => `${sp}в ${(+n - 1) || 12}:45`)
    .replace(/(\s)(?:в\s+)?без\s+(\d{1,2})(?:\s+минут\S*)?\s+(\d{1,2})(?=[\s,.?])/gi, (m, sp, mm, n) => `${sp}в ${(+n - 1) || 12}:${String(60 - +mm).padStart(2, "0")}`)
    .replace(/\s+/g, " ").trim()
}

// ── Встроенный разбор: определяет тип по смыслу и делит фразу на несколько команд ──
const VOICE = {
  report:   /отч[её]т|итоги месяца|сколько\s+(я\s+)?(потратил|заработал)/,
  income:   /доход|получил|заработал|зарплат|поступлен|вернули|кэшбэк|кешбэк|продал|аванс|гонорар|пришл\S*\s+(деньги|оплата|перевод)/,
  spend:    /расход|потрат|купил|заплатил|оплатил|трат[аиы]|стоил|обошл|отдал/,
  currency: new RegExp(`${CONFIG.currencyWords}|налич|налом|наликом|кэш|переводом|картой|по qr|кьюар`),
  event:    /встреч|созвон|показ|просмотр|сделк|подписани|звонок с|совещан|собеседован|при[её]м у|запись к|запиши меня|записан|свидани|митинг|колл|зум|zoom|(ужин|обед|завтрак) с|конференц|вебинар|тренировк|урок|заняти|визит|турнир|матч|игр[аеуы]|падел|падл|теннис|футбол|йог|репетиц|экскурс|вечеринк|день рождени|праздник|концерт|спектакл|выставк|стрижк|барбер|маникюр/,
  remove:   /^(убери|убрать|удали|удалить|отмени|отменить|сотри|вычеркни)/,
  move:     /^(перенеси|перенести|перенесите|перенос|сдвинь|сдвинуть|передвинь|перемести|переставь|измени\s+время|поменяй\s+время)/,
  query:    /^(что|чем|какие|какой|какая|какое|сколько|когда|покажи|есть\s+ли|во\s+сколько|где)(\s|$)/,
  doneStart: /^(отметь|отметить|отмечай)(\s+(как\s+)?(выполненн\S*|сделанн\S*|готов\S*))?\s+/,
  doneVerb: /(^|\s)(купил[аи]?|сделал[аи]?|выполнил[аи]?|позвонил[аи]?|сходил[аи]?|отправил[аи]?|забрал[аи]?|оплатил[аи]?|написал[аи]?|записал(ся|ась)|готово|выполнено|сделано)(\s|$)/,
  remind:   /^(напомни|напоминани|не забыть|не забудь)/,
  task:     /напомни|не забыть|не забудь|надо|нужно|должен|должна|задач/,
  note:     /заметк|запиши(?! меня)|запомни|идея|мысль/,
}
const REM_TRIG = /^\s*(напомни(те)?(\s+мне)?|напоминание|не забыть|не забудь|надо|нужно)[\s,:]*/i
const NOTE_TRIG = /^\s*((запиши\S*|запомни\S*|сохрани)\s+)?(заметк\S*|идея|мысль)?[\s,:]*/i
const EVT_TRIG = /^\s*(запиши меня( на| к)?|поставь|добавь|создай)\s+/i
const DEL_TRIG = /^\s*(убери|убрать|удали|удалить|отмени|отменить|сотри|вычеркни)\s*/i
const ADD_TRIG = /^\s*(добав(ь|ить|ьте)|создай|создать|поставь|запланируй|сделай|сохрани|внеси)\s+/i

// «в семейный календарь», «в рабочий календарь» (CONFIG.calendars) → какой календарь; слова вырезаются из текста
function extractCalendar(text) {
  for (const c of CONFIG.calendars) {
    const m = (" " + text + " ").match(c.words)
    if (m) return { cal: c, text: (" " + text + " ").replace(m[0], " ").replace(/\s+/g, " ").trim() }
  }
  return { cal: null, text }
}

function classify(seg, prev) {
  const low = seg.toLowerCase().trim()
  if (/^(заметк|запомни|идея|мысль|запиши(?!\s+меня))/.test(low)) return "note"   // явная заметка важнее слов вроде «день рождения»
  if (VOICE.move.test(low)) return "move"
  if (VOICE.query.test(low)) return "query"
  if (VOICE.doneStart.test(low)) return "done"
  // «хлеб купил», «сделал отчёт» — без сумм и денег это выполненное дело, а не расход
  if (VOICE.doneVerb.test(low) && !/\d/.test(low) && !VOICE.currency.test(low) && !VOICE.event.test(low)) return "done"
  if (VOICE.report.test(low)) return "report"
  if (VOICE.remove.test(low)) return "delete"
  const w = parseWhen(seg)
  if (!w.rest) return null                         // только дата/время — это уточнение к соседней команде
  const rest = w.rest.toLowerCase()
  if (VOICE.remind.test(low)) return "reminder"
  if (extractCalendar(low).cal && !VOICE.task.test(low)) return "event"        // назван календарь — это событие
  if (/\d/.test(rest)) {
    const moneyish = VOICE.spend.test(low) || VOICE.currency.test(low) || VOICE.income.test(low)
      || matchCategory("expense", " " + rest + " ") !== null
    if (moneyish) return VOICE.income.test(low) ? "income" : (prev === "income" && !VOICE.spend.test(low) ? "income" : "expense")
    if ((prev === "expense" || prev === "income") && !w.date) return prev   // «…и ещё 500 на обед»
  }
  if (w.minutes) return "event"                                              // «с 7 до 9» — это событие
  if (VOICE.event.test(low)) return "event"
  if (prev === "event" && /^с\s/.test(rest)) return "event"                // «…и с Машей в 12»
  if (VOICE.task.test(low) || w.date) return "reminder"
  if (VOICE.note.test(low)) return "note"
  return null
}

function hasTrigger(piece) {
  const low = piece.toLowerCase()
  return VOICE.spend.test(low) || VOICE.income.test(low) || VOICE.event.test(low) || VOICE.task.test(low)
    || VOICE.note.test(low) || VOICE.remove.test(low) || VOICE.move.test(low) || VOICE.query.test(low) || VOICE.doneStart.test(low)
}

function splitCommands(text) {
  const pieces = text.replace(/\s+/g, " ")
    .split(/[.!?;\n]+|\s*,\s*|\s+(?:а\s+)?(?:ещё|еще|также|потом|затем|после этого|кроме того)\s+|\s+и\s+/i)
    .map(p => (p || "").replace(ADD_TRIG, "").trim()).filter(Boolean)
  const segs = []
  let pending = ""
  for (const piece of pieces) {
    const last = segs[segs.length - 1]
    const text = pending ? `${pending} ${piece}` : piece
    const kind = classify(text, last ? last.kind : null)
    if (!kind) {
      const pureWhen = !parseWhen(piece).rest
      if (pureWhen && last && (last.kind === "event" || last.kind === "reminder") && !parseWhen(last.text).date) {
        last.text += " " + piece; continue
      }
      if (pureWhen || !last) { pending = text; continue }
      last.text += " и " + piece; continue
    }
    if (last && kind === last.kind && kind !== "expense" && kind !== "income"
        && !hasTrigger(piece) && !parseWhen(piece).date) {
      last.text += " и " + piece; continue
    }
    segs.push({ text, kind }); pending = ""
  }
  if (pending) {
    if (segs.length) segs[segs.length - 1].text += " " + pending
    else segs.push({ text: pending, kind: classify(pending, null) })
  }
  return segs
}

function moneyDate(text) {
  const d = new Date(); d.setHours(12, 0, 0, 0)
  if (/позавчера/i.test(text)) { d.setDate(d.getDate() - 2); return d.getTime() }
  if (/вчера/i.test(text)) { d.setDate(d.getDate() - 1); return d.getTime() }
  return Date.now()
}

function moneyComment(text) {
  return cleanText(text
    .replace(/(\d+(?:[.,]\d+)?)\s*тыс\S*/gi, " ")
    .replace(/\d{1,3}(?:[\s ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g, " ")
    .replace(CUR_RE, " ")
    .replace(/наличн\S*|налом|наликом|кэш\S*|кеш\S*|переводом|перевод|картой|по qr|qr|позавчера|вчера|сегодня/gi, " ")
    .replace(/^\s*(расход\S*|доход\S*|потратил\S*|купил\S*|заплатил\S*|оплатил\S*|получил\S*|заработал\S*|трата|ещё|еще)\s*/i, " "))
    .replace(/^(на|за)\s+/i, "")
    .replace(/\s+(на|за|в)$/i, "")
}

function buildActions(segs) {
  let lastDay = null
  return segs.map(({ text, kind }) => {
    if (!kind) return { kind: null, raw: text }
    if (kind === "report") return { kind }
    if (kind === "expense" || kind === "income") {
      const p = parseMoney(text, kind)
      return { kind, amount: p.amount, method: p.method, category: p.category, comment: moneyComment(text), at: moneyDate(text) }
    }
    if (kind === "note") return { kind, title: cap(cleanText(text.replace(NOTE_TRIG, ""))) }
    if (kind === "move") return buildMove(text)
    if (kind === "query") return buildQuery(text)
    if (kind === "done") {
      const q = cleanText(text.trim().replace(new RegExp(VOICE.doneStart.source, "i"), " ").replace(new RegExp(VOICE.doneVerb.source, "gi"), " ")
        .replace(/(^|\s)(уже|я|напоминани\S*|дело|задач\S*)(?=\s|$)/gi, " "))
      return { kind, query: q }
    }
    if (kind === "delete") {
      const w = parseWhen(text)
      const query = cleanText(w.rest.replace(DEL_TRIG, "")
        .replace(/(^|\s)(событи\S*|встреч\S*|напоминани\S*|все|всё|мо[ейюяи]\S*|из|календар\S*|в)(?=\s|$)/gi, " "))
      return { kind, query, days: w.recur && w.recur.days ? w.recur.days : null,
        date: !w.recur && w.explicitDay ? w.date : null,
        what: /напоминани/i.test(text) ? "reminders" : /событи|встреч|календар/i.test(text) ? "events" : "both" }
    }
    const ec = extractCalendar(text)
    text = ec.text
    const w = parseWhen(text, lastDay)
    // «турнир с семи до девяти» — для досуга и спорта время без «утра/вечера» считаем вечерним
    if (kind === "event" && w.date && w.noPart && w.date.getHours() >= 7 && w.date.getHours() <= 11
        && /турнир|матч|игр|падел|падл|теннис|футбол|ужин|вечеринк|концерт|кино|бар|клуб|свидани/i.test(text)) {
      w.date.setHours(w.date.getHours() + 12)
    }
    if (w.explicitDay) lastDay = startOfDay(w.date)
    let title = cleanText(w.rest.replace(kind === "reminder" ? REM_TRIG : EVT_TRIG, ""))
    if (kind === "event" && /^с\s/i.test(title)) title = "Встреча " + title
    title = cleanText(title.replace(/(^|\s)(в|во|на)\s*$/i, ""))
    return { kind, title: cap(title) || (kind === "event" ? "Встреча" : "Напоминание"),
      date: w.date, hasTime: w.hasTime, minutes: w.minutes || CONFIG.defaultEventMinutes, recur: w.recur,
      calendar: kind === "event" && ec.cal ? ec.cal.calendar : null,
      list: kind === "reminder" && ec.cal ? ec.cal.list : null }
  })
}

// ── Перенос: «перенеси свидание завтрашнее с 6 вечера на 8», «сдвинь йогу на час позже» ──
const EVENING_WORDS = /свидани|ужин|вечеринк|концерт|кино|бар|клуб|турнир|матч|падел|теннис|футбол/i

function buildMove(text) {
  const body = " " + text.trim().replace(new RegExp(VOICE.move.source, "i"), " ").replace(/^\s*(время|встреч\S*\s+)?/i, m => /встреч/i.test(m) ? m : " ") + " "
  const a = { kind: "move", query: "", from: null, fromHasTime: false, toDay: null, toTime: null, shift: 0 }
  let src = body, dst = ""
  const sh = body.match(/\sна\s+(\d+|полчаса|час|пару\s+часов)?\s*(час\S*|минут\S*|дн\S*|день)?\s*(позже|попозже|раньше|пораньше|вперёд|вперед|назад)(?=[\s,.?])/i)
  if (sh) {
    let n = sh[1] ? (/полчаса/i.test(sh[1]) ? 30 : /пару/i.test(sh[1]) ? 120 : /^час/i.test(sh[1]) ? 60 : +sh[1]) : 60
    const unit = (sh[2] || (/^\d+$/.test(sh[1] || "") ? "час" : "")).toLowerCase()
    if (unit.startsWith("мин")) n = +sh[1]
    else if (unit.startsWith("д")) n = (+sh[1] || 1) * 1440
    else if (unit.startsWith("час") && /^\d+$/.test(sh[1] || "")) n = +sh[1] * 60
    a.shift = /раньше|пораньше|назад/i.test(sh[3]) ? -n : n
    src = body.replace(sh[0], " ")
  } else {
    // последнее « на …», после которого стоит день или время, — это куда переносим
    const re = /\sна\s+/gi
    let cut = -1, mm
    while ((mm = re.exec(body))) {
      const after = body.slice(mm.index + mm[0].length)
      const tw = parseWhen(" в " + after)
      if (tw.date && !cleanText(tw.rest).split(" ").filter(w => w.length > 3).length) cut = mm.index
    }
    if (cut >= 0) { src = body.slice(0, cut); dst = body.slice(cut).replace(/^\s*на\s+/i, " ") }
  }
  const sw = parseWhen(src)
  a.query = cleanText(sw.rest.replace(/(^|\s)(мне|моё|мое|мою|мой|мои)(?=\s|$)/gi, " "))
  if (sw.explicitDay || sw.hasTime) { a.from = sw.date; a.fromHasTime = sw.hasTime }
  if (dst) {
    const tw = parseWhen(" в " + dst)
    if (tw.explicitDay) a.toDay = startOfDay(tw.date)
    if (tw.hasTime) {
      let hh = tw.date.getHours()
      // «на 8», когда событие вечернее (или свидание/ужин), — это 20:00
      if (tw.noPart && hh < 12 && ((a.fromHasTime && a.from.getHours() >= 12) || EVENING_WORDS.test(a.query))) hh += 12
      a.toTime = `${String(hh).padStart(2, "0")}:${String(tw.date.getMinutes()).padStart(2, "0")}`
    }
  }
  return a
}

// ── Вопросы: «что у меня завтра», «сколько ушло на такси», «когда падел» ──
function buildQuery(text) {
  const low = text.toLowerCase()
  const w = parseWhen(text)
  const a = { kind: "query", topic: "schedule", day: w.explicitDay ? startOfDay(w.date) : null, text }
  if (/потрат|трат|расход|ушл|доход|заработ|баланс|денег|деньги|получил/.test(low) || new RegExp(CONFIG.currencyWords).test(low)) {
    a.topic = "money"
    a.category = matchCategory("expense", " " + low + " ") || matchCategory("income", " " + low + " ")
    if (a.category === "Другое") a.category = null
    a.income = /доход|заработ|получил/.test(low)
  } else if (/^(когда|во\s+сколько)/.test(low)) {
    a.topic = "when"
    a.q = cleanText(w.rest.replace(/^(когда|во\s+сколько)\s+/i, "").replace(/(^|\s)(у\s+меня|будет|следующ\S*|ближайш\S*|мой|моя|моё|мое|мои)(?=\s|$)/gi, " "))
  }
  return a
}

// ── Выполнение новых команд (iPhone) ──
const fmtShort = d => `${cap(SHORT.string(d))}, ${TIME.string(d)}`

async function completeMove(a) {
  const from = a.from ? startOfDay(a.from) : new Date(Date.now() - 864e5)
  const to = new Date(from.getTime() + (a.from ? 1 : 45) * 864e5)
  let list = []
  try { list = await CalendarEvent.between(from, to, []) } catch (e) {}
  list = list.filter(e => !e.isAllDay && (!a.query || titleMatches(e.title, a.query)))
  if (a.fromHasTime) list = list.filter(e => e.startDate.getHours() === a.from.getHours())
  list.sort((x, y) => x.startDate - y.startDate)
  if (!list.length) {
    await info("Не нашёл событие", `«${a.query || "…"}»${a.from ? " на " + DAY.string(a.from) : " в ближайшие недели"}. Проверьте название.`)
    return null
  }
  let ev = list[0]
  if (list.length > 1) {
    const i = await choose("Какое событие перенести?", list.slice(0, 8).map(e => `${e.title} · ${fmtShort(e.startDate)}`))
    if (i === -1) return null
    ev = list[i]
  }
  let ns
  if (a.shift) ns = new Date(ev.startDate.getTime() + a.shift * 60000)
  else if (a.toDay || a.toTime) {
    ns = new Date(a.toDay || startOfDay(ev.startDate))
    const [hh, mm] = a.toTime ? a.toTime.split(":").map(Number) : [ev.startDate.getHours(), ev.startDate.getMinutes()]
    ns.setHours(hh, mm, 0, 0)
  } else {
    const i = await choose(`Куда перенести «${ev.title}»?`, ["На час позже", "На час раньше", "На завтра, то же время", "Выбрать дату и время"],
      fmtShort(ev.startDate))
    if (i === -1) return null
    if (i === 0) ns = new Date(ev.startDate.getTime() + 36e5)
    else if (i === 1) ns = new Date(ev.startDate.getTime() - 36e5)
    else if (i === 2) ns = new Date(ev.startDate.getTime() + 864e5)
    else { ns = await pickDate(ev.startDate); if (!ns) return null }
  }
  a.event = ev
  a.newStart = ns
  return a
}

async function completeDone(a) {
  let list = []
  try { list = await Reminder.allIncomplete() } catch (e) {}
  const q = (a.query || "").toLowerCase()
  let hits = list.filter(r => q && ((r.title || "").toLowerCase().includes(q) || titleMatches(r.title, a.query)))
  if (!hits.length && q) hits = list.filter(r => words(a.query).some(w => words(r.title).some(t => t.startsWith(w.slice(0, 4)))))
  if (!hits.length) {
    const i = await choose(`Не нашёл напоминание «${a.query || "…"}»`, ["Выбрать из списка", "Записать как заметку"])
    if (i === 1) { a.kind = "note"; a.title = cap(a.query || "Сделано"); return a }
    if (i !== 0 || !list.length) return null
    hits = list
  }
  let r = hits[0]
  if (hits.length > 1) {
    const i = await choose("Что отметить выполненным?", hits.slice(0, 10).map(x => x.title + (x.dueDate ? ` · ${reminderTime(x)}` : "")))
    if (i === -1) return null
    r = hits[i]
  }
  a.reminder = r
  return a
}

async function answerQuery(a) {
  if (a.topic === "money") {
    const key = monthKey(new Date())
    const t = monthTotals(await loadMoney(), key)
    if (a.category) {
      const type = CONFIG.categories.income.some(c => c[0] === a.category) && a.income ? "income" : "expense"
      const items = t.items.filter(e => e.category === a.category && e.type === type)
      const sum = items.reduce((x, e) => x + e.amount, 0)
      return info(`${a.category} · ${MONTH_NOM[new Date().getMonth()]}`,
        `${type === "income" ? "Получено" : "Потрачено"}: ${money(sum)} (${items.length} опер.)` +
        (items.length ? "\n\n" + items.slice(-6).reverse().map(e => `${DM.string(new Date(e.date))} ${money(e.amount)}${e.comment ? " · " + e.comment : ""}`).join("\n") : ""))
    }
    const top = Object.entries(t.cats.expense).sort((x, y) => y[1] - x[1]).slice(0, 4)
    const i = await choose(`${MONTH_NOM[new Date().getMonth()]}: −${money(t.expense)} / +${money(t.income)}`, ["📊 Открыть полный отчёт"],
      `Баланс: ${t.income - t.expense < 0 ? "−" : "+"}${money(t.income - t.expense)}` +
      (top.length ? "\n\nБольше всего:\n" + top.map(([n, v]) => `${n}: ${money(v)}`).join("\n") : ""))
    if (i === 0) await report(key)
    return
  }
  if (a.topic === "when") {
    let list = []
    try { list = await CalendarEvent.between(new Date(), new Date(Date.now() + 90 * 864e5), []) } catch (e) {}
    list = list.filter(e => titleMatches(e.title, a.q) || (e.title || "").toLowerCase().includes((a.q || "").toLowerCase())).sort((x, y) => x.startDate - y.startDate)
    return info(list.length ? cap(list[0].title) : "Не нашёл", list.length
      ? list.slice(0, 4).map(e => `${fmtShort(e.startDate)}–${TIME.string(e.endDate)}`).join("\n")
      : `В ближайшие 3 месяца нет событий «${a.q}».`)
  }
  const day = a.day || startOfDay(new Date())
  const next = new Date(day.getTime() + 864e5)
  let evs = [], rems = []
  try { evs = await CalendarEvent.between(day, next, []) } catch (e) {}
  try { rems = (await Reminder.allIncomplete()).filter(r => r.dueDate && sameDay(r.dueDate, day)) } catch (e) {}
  evs.sort((x, y) => x.startDate - y.startDate)
  const lines = evs.map(e => `📅 ${e.isAllDay ? "весь день" : TIME.string(e.startDate) + "–" + TIME.string(e.endDate)} ${e.title}`)
    .concat(rems.map(r => `⏰ ${r.dueDateIncludesTime ? TIME.string(r.dueDate) : "—"} ${r.title}`))
  return info(cap(FULL.string(day)), lines.length ? lines.join("\n") : "Ничего не запланировано 🎉")
}

// ── Удаление: нечёткий поиск по названию («падал» найдёт «Падел») ──
function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}
const STOP = ["для", "про", "все", "всё", "это", "эту", "этот", "мой", "моя", "мое", "мои", "моё"]
const words = s => (s || "").toLowerCase().replace(/ё/g, "е").split(/[^a-zа-я0-9]+/).filter(w => w.length >= 3 && !STOP.includes(w))

function titleMatches(title, query) {
  const q = words(query), t = words(title)
  if (!q.length) return false
  return q.every(qw => t.some(tw => tw === qw ||
    (qw.length >= 4 && tw.length >= 4 && (tw.startsWith(qw.slice(0, 4)) || lev(qw, tw) <= (qw.length >= 5 ? 2 : 1)))))
}

async function findForDelete(a) {
  const hasQuery = words(a.query).length > 0
  if (!hasQuery && !a.date) return { events: [], reminders: [] }
  const from = a.date ? startOfDay(a.date) : startOfDay(new Date())
  const to = new Date(from); to.setDate(to.getDate() + (a.date ? 1 : 365))
  const okDay = d => !a.days || a.days.includes(d.getDay())
  let events = [], reminders = []
  if (a.what !== "reminders") {
    try { events = await CalendarEvent.between(from, to, []) } catch (e) {}
    events = events.filter(e => okDay(e.startDate) && (!hasQuery || titleMatches(e.title, a.query)))
  }
  if (a.what !== "events") {
    try { reminders = await Reminder.allIncomplete() } catch (e) {}
    reminders = reminders.filter(r =>
      (!hasQuery || titleMatches(r.title, a.query)) &&
      (!a.days || (r.dueDate && okDay(r.dueDate))) &&
      (!a.date || (r.dueDate && sameDay(r.dueDate, a.date))))
  }
  return { events, reminders }
}

// ── Умный режим: разбор через Claude или ChatGPT (CONFIG.ai, нужен API-ключ) ──
const OPENAI = CONFIG.ai === "openai"
const AI_NAME = OPENAI ? "ChatGPT" : "Claude"
const AI_KEY = OPENAI ? "myday.openai.key" : "myday.anthropic.key"
const AI_KEY_HINT = OPENAI ? "sk-…" : "sk-ant-…"

function getAIKey() {
  try { return Keychain.contains(AI_KEY) ? Keychain.get(AI_KEY) : null } catch (e) { return null }
}
// Общий доступ (версия для друзей): запросы идут через Google-скрипт владельца, его ключ телефону не виден
const sharedAI = () => !!CONFIG.aiProxy && !/^__/.test(CONFIG.aiProxy)
const aiReady = () => !!getAIKey() || sharedAI()
function deviceId() {
  const k = "myday.device"
  try {
    if (Keychain.contains(k)) return Keychain.get(k)
    const id = Array.from({ length: 24 }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]).join("")
    Keychain.set(k, id)
    return id
  } catch (e) { return "unknown0" }
}
// Запрос к Claude: со своим ключом — напрямую, иначе через общий доступ
async function anthropic(body) {
  if (OPENAI) return openai(body)
  const own = getAIKey()
  const req = new Request(own ? "https://api.anthropic.com/v1/messages" : CONFIG.aiProxy)
  req.method = "POST"
  req.timeoutInterval = 90
  if (own) {
    req.headers = { "x-api-key": own, "anthropic-version": "2023-06-01", "content-type": "application/json" }
    req.body = JSON.stringify(body)
  } else {
    req.headers = { "content-type": "text/plain;charset=utf-8" }
    req.body = JSON.stringify({ token: CONFIG.aiProxyToken, device: deviceId(), body })
  }
  return await req.loadJSON()
}

// ChatGPT: запрос в формате Claude переводится в Chat Completions, ответ — обратно,
// поэтому фото еды и ассистент работают с ним без изменений
async function openai(body) {
  const msgs = body.system ? [{ role: "system", content: body.system }] : []
  for (const m of body.messages) {
    if (typeof m.content === "string") { msgs.push({ role: m.role, content: m.content }); continue }
    if (m.role === "assistant") {
      const text = m.content.filter(c => c.type === "text").map(c => c.text).join("\n")
      const calls = m.content.filter(c => c.type === "tool_use")
        .map(c => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.input || {}) } }))
      msgs.push(Object.assign({ role: "assistant", content: text || null }, calls.length ? { tool_calls: calls } : {}))
      continue
    }
    m.content.filter(c => c.type === "tool_result")
      .forEach(c => msgs.push({ role: "tool", tool_call_id: c.tool_use_id, content: String(c.content) }))
    const parts = m.content.filter(c => c.type !== "tool_result").map(c => c.type === "image"
      ? { type: "image_url", image_url: { url: `data:${c.source.media_type};base64,${c.source.data}` } }
      : { type: "text", text: c.text })
    if (parts.length) msgs.push({ role: "user", content: parts })
  }
  const req_ = { model: CONFIG.agentModel, messages: msgs, max_completion_tokens: Math.max(body.max_tokens || 0, 8000) }   // запас на «мысли» модели
  if (body.tools) req_.tools = body.tools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }))
  const fmt_ = body.output_config && body.output_config.format
  if (fmt_ && fmt_.type === "json_schema") req_.response_format = { type: "json_schema", json_schema: { name: "result", schema: fmt_.schema, strict: false } }
  const req = new Request("https://api.openai.com/v1/chat/completions")
  req.method = "POST"
  req.timeoutInterval = 90
  req.headers = { "authorization": `Bearer ${getAIKey()}`, "content-type": "application/json" }
  req.body = JSON.stringify(req_)
  const res = await req.loadJSON()
  if (!res || res.error || !res.choices) return res && res.error ? res : { error: { message: "пустой ответ" } }
  const ch = res.choices[0], msg = ch.message || {}
  const content = []
  if (msg.content) content.push({ type: "text", text: msg.content })
  for (const c of msg.tool_calls || []) {
    let input = {}
    try { input = JSON.parse(c.function.arguments || "{}") } catch (e) {}
    content.push({ type: "tool_use", id: c.id, name: c.function.name, input })
  }
  const stop = msg.refusal || ch.finish_reason === "content_filter" ? "refusal" : ch.finish_reason === "tool_calls" ? "tool_use" : "end_turn"
  return { content, stop_reason: stop }
}

async function aiSettings() {
  const has = !!getAIKey()
  let k = null
  if (!has && sharedAI()) {
    const i = await choose(`🧠 Ассистент ${AI_NAME} включён`, ["Проверить связь", "Подключить свой ключ"],
      "Работает через общий доступ: ключ не нужен, в день до 40 запросов (фото еды и команды).")
    if (i === 0) {
      let res = null
      try { res = await callClaude([{ role: "user", content: "Проверка связи. Ответь одним словом: работает" }]) } catch (e) {}
      return info(res && res.content ? "Связь есть ✓" : "Не удалось подключиться", res && res.error ? res.error.message : "")
    }
    if (i !== 1) return
    k = await ask(`API-ключ ${OPENAI ? "OpenAI" : "Anthropic"}`, AI_KEY_HINT, "Сохранить")
  } else if (has) {
    const i = await choose(`🧠 Ассистент ${AI_NAME} включён`, ["Заменить ключ", "Выключить"],
      `Команды выполняет ${AI_NAME}: понимает свободную речь, переносит и удаляет события, уточняет, если неясно. Без ключа работает встроенный разбор.`)
    if (i === 1) { Keychain.remove(AI_KEY); return info("Ассистент выключен", "Команды снова разбирает встроенный разбор.") }
    if (i !== 0) return
    k = await ask(`API-ключ ${OPENAI ? "OpenAI" : "Anthropic"}`, AI_KEY_HINT, "Сохранить")
  } else {
    k = await ask(`🧠 Ассистент ${AI_NAME}`, AI_KEY_HINT, "Сохранить", "",
      `Команды будет выполнять ${AI_NAME}: свободная речь, перенос и удаление событий, вопросы о расписании и тратах, уточнения. ` +
      `Нужен API-ключ с ${OPENAI ? "platform.openai.com" : "console.anthropic.com"} (оплата за использование отдельно). Ключ хранится в связке ключей iPhone.`)
  }
  if (!k) return
  Keychain.set(AI_KEY, k.trim())
  let res = null
  try { res = await callClaude([{ role: "user", content: "Проверка связи. Ответь одним словом: работает" }]) } catch (e) {}
  if (res && res.content) await info("Ассистент подключён ✓", "Нажмите 🎤 в виджете и говорите как с человеком: «перенеси завтрашнее свидание на 8 вечера», «что у меня в пятницу?»")
  else await info("Не удалось подключиться", `${res && res.error ? res.error.message : "Проверьте ключ и интернет."}\nПока работает встроенный разбор.`)
}

// ── Общий конвейер: разбор → уточнение недостающего → подтверждение → сохранение ──
function plural(n) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return "действие"
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "действия"
  return "действий"
}

function describe(a) {
  const rl = a.recur ? ` · 🔁 ${recurLabel(a.recur)}` : ""
  if (a.kind === "event") return `📅 ${a.title} — ${WHEN_S.string(a.date)}–${TIME.string(new Date(a.date.getTime() + a.minutes * 60000))}${rl}${a.calendar ? " · 🗂 " + a.calendar : ""}`
  if (a.kind === "reminder") return `⏰ ${a.title}${a.date ? " — " + WHEN_S.string(a.date) : ""}${rl}${a.list ? " · 🗂 " + a.list : ""}`
  if (a.kind === "delete") {
    const titles = [...new Set(a.events.map(e => e.title).concat(a.reminders.map(r => r.title)))]
    const parts = []
    if (a.events.length) parts.push(`${a.events.length} в календаре`)
    if (a.reminders.length) parts.push(`${a.reminders.length} в напоминаниях`)
    return `🗑 Удалить «${titles.slice(0, 3).join("», «")}»${titles.length > 3 ? "…" : ""}` +
      `${a.days ? " " + recurLabel({ freq: "weekly", days: a.days }) : ""}${a.date ? " на " + DAY.string(a.date) : ""} — ${parts.join(", ")}`
  }
  if (a.kind === "note") return `📝 ${a.title}`
  if (a.kind === "report") return "📊 Открыть отчёт за месяц"
  if (a.kind === "move" && a.event && a.newStart)
    return `↔️ ${a.event.title}: ${WHEN_S.string(a.event.startDate)} → ${WHEN_S.string(a.newStart)}–${TIME.string(new Date(a.newStart.getTime() + (a.event.endDate - a.event.startDate)))}`
  if (a.kind === "done" && a.reminder) return `✅ Выполнено: ${a.reminder.title}`
  const day = !sameDay(new Date(a.at), new Date()) ? ` · ${DM.string(new Date(a.at))}` : ""
  return `${a.kind === "expense" ? "➖" : "➕"} ${money(a.amount)} · ${a.category} · ${a.method === "cash" ? "нал" : "перевод"}${a.comment ? " · " + a.comment : ""}${day}`
}

// Дозапрашивает то, чего не хватает. Возвращает действие или null (пропустить)
async function completeAction(a) {
  if (!a.kind) {
    const opts = [["📅 Встреча", "event"], ["⏰ Напоминание", "reminder"], ["📝 Заметка", "note"],
      ["➖ Расход", "expense"], ["➕ Доход", "income"], ["↔️ Перенести событие", "move"], ["✅ Отметить выполненным", "done"], ["🗑 Удалить", "delete"]]
    const i = await choose("Что это?", opts.map(o => o[0]), `«${a.raw}»`)
    if (i === -1) return null
    return completeAction(buildActions([{ text: a.raw, kind: opts[i][1] }])[0])
  }
  if (a.kind === "query") { await answerQuery(a); return null }
  if (a.kind === "move") return completeMove(a)
  if (a.kind === "done") return completeDone(a)
  if (a.kind === "delete") {
    const found = await findForDelete(a)
    a.events = found.events; a.reminders = found.reminders
    if (!a.events.length && !a.reminders.length) {
      await info("Нечего удалять", `Не нашёл «${a.query || "…"}»` +
        `${a.days ? " " + recurLabel({ freq: "weekly", days: a.days }) : ""}${a.date ? " на " + DAY.string(a.date) : ""}` +
        " в календаре и напоминаниях.")
      return null
    }
    return a
  }
  if (a.kind === "note" && !a.title) {
    a.title = await ask("Заметка", "Текст")
    if (!a.title) return null
  }
  if ((a.kind === "event" && a.calendar) || (a.kind === "reminder" && a.list)) {
    const isEv = a.kind === "event", name = isEv ? a.calendar : a.list
    if (!(await findCalendar(name, !isEv))) {
      let all = []
      try { all = (isEv ? await Calendar.forEvents() : await Calendar.forReminders()).filter(c => !isEv || c.isWritable !== false) } catch (e) {}
      const i = await choose(`Не нашёл ${isEv ? "календарь" : "список"} «${name}»`, all.map(c => c.title), "Куда сохранить?")
      if (i === -1) return null
      if (isEv) a.calendar = all[i].title; else a.list = all[i].title
    }
  }
  if (a.kind === "event" && (!a.date || !a.hasTime)) {
    await info(`📅 ${a.title}`, "Выберите дату и время встречи")
    const d = await pickDate(a.date || undefined)
    if (!d) return null
    a.date = d; a.hasTime = true
  }
  if (a.kind === "expense" || a.kind === "income") {
    const label = `${TYPE[a.kind]}${a.comment ? ": " + a.comment : ""}`
    if (!a.amount) {
      const al = new Alert()
      al.title = label
      al.message = `Сумма ${CONFIG.currencyIn}`
      al.addTextField(`Сумма, ${CONFIG.currency}`, "").setDecimalPadKeyboard()
      al.addAction("Далее"); al.addCancelAction("Пропустить")
      if ((await al.presentAlert()) === -1) return null
      a.amount = parseFloat(al.textFieldValue(0).replace(/\s/g, "").replace(",", "."))
      if (!(a.amount > 0)) return null
    }
    if (!a.method) {
      const i = await choose(`${label} — ${money(a.amount)}`, [METHOD.cash, METHOD.transfer], "Наличные или перевод?")
      if (i === -1) return null
      a.method = i === 0 ? "cash" : "transfer"
    }
    if (!a.category) {
      const names = CONFIG.categories[a.kind].map(c => c[0])
      const i = await choose(`${label} — ${money(a.amount)}`, names, "Категория")
      if (i === -1) return null
      a.category = names[i]
    }
  }
  return a
}

async function executeAll(list) {
  let entries = null, openReport = false
  for (const a of list) {
    if (a.kind === "event") await createEvent(a.title, a.date, a.minutes || CONFIG.defaultEventMinutes, a.location, a.recur, a.calendar)
    else if (a.kind === "reminder") await createReminder(a.title, a.date, a.recur, a.list)
    else if (a.kind === "delete") {
      for (const e of a.events) { try { e.remove() } catch (x) {} }
      for (const r of a.reminders) { try { r.remove() } catch (x) {} }
    }
    else if (a.kind === "note") await saveNote(a.title)
    else if (a.kind === "report") openReport = true
    else if (a.kind === "move") {
      const dur = a.event.endDate - a.event.startDate
      a.event.startDate = a.newStart
      a.event.endDate = new Date(a.newStart.getTime() + dur)
      a.event.save()
    }
    else if (a.kind === "done") { a.reminder.isCompleted = true; a.reminder.save() }
    else {
      entries = entries || []
      entries.push({ id: `f${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date: a.at || Date.now(), u: Date.now(),
        type: a.kind, amount: a.amount, method: a.method, category: a.category, comment: a.comment || "" })
    }
  }
  if (entries) await saveMoney(entries)
  if (openReport) await report()
}

// Голосовая запись: танцующий рыжий котик + поле ввода, говорят через микрофон клавиатуры iOS.
// Системная диктовка Scriptable закрывает экран целиком, а сам WebView микрофон не получает,
// поэтому котик остаётся виден только так. Текст забираем, пока окно открыто, и после «Закрыть».
async function dictate() {
  if (CONFIG.assistantChat) return listen()   // личная версия: без котика, системная диктовка слушает сразу
  try {
    const wv = new WebView()
    await wv.loadHTML(catHTML())
    let open = true, text = ""
    const wait = ms => new Promise(r => Timer.schedule(ms, false, r))
    // при запуске из виджета Scriptable ещё не готов показать окно: present() сразу завершается,
    // и котик не появлялся до второго-третьего нажатия. Ждём и повторяем, если окно закрылось мгновенно.
    await wait(400)
    let shown = null
    for (let i = 0; i < 4; i++) {
      const t0 = Date.now()
      open = true
      shown = wv.present(false).then(() => { open = false })
      await Promise.race([shown, wait(700)])
      if (open || Date.now() - t0 > 650) break
      await wait(500)
    }
    // «Отправить» на странице: забираем текст и идём дальше, окно с котиком остаётся под следующими окнами
    while (open) {
      try {
        const r = JSON.parse(await wv.evaluateJavaScript("val()"))
        text = r.text
        if (r.sent) return (text || "").trim()
      } catch (e) {}
      await Promise.race([shown, wait(300)])
    }
    try { text = JSON.parse(await wv.evaluateJavaScript("val()")).text } catch (e) {}
    return (text || "").trim()
  } catch (e) {}
  try { return (await Dictation.start("ru-RU")) || "" } catch (e) { return "" }
}

function catHTML() {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
  body { margin: 0; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 3vh; box-sizing: border-box;
    font: 17px -apple-system, sans-serif; background: #FAF9F5; color: #3a2a1a; -webkit-user-select: none; }
  @media (prefers-color-scheme: dark) { body { background: #1c1712; color: #f3e6d6 } }
  svg { height: 34vh; max-width: 90vw; overflow: visible }
  #tx { margin-top: 14px; width: calc(100vw - 40px); box-sizing: border-box; padding: 12px 14px; border-radius: 14px;
    border: 2px solid #D97757; background: transparent; color: inherit; font: 19px -apple-system, sans-serif; resize: none; outline: none }
  #go { margin-top: 12px; width: calc(100vw - 40px); padding: 13px; border: 0; border-radius: 14px;
    background: #D97757; color: #fff; font: 600 18px -apple-system, sans-serif }
  #go:disabled { opacity: .7 }
  .hips  { transform-origin: 120px 230px; animation: hips .9s ease-in-out infinite alternate }
  .upper { transform-origin: 120px 240px; animation: upper .9s ease-in-out infinite alternate }
  .tail  { transform-origin: 150px 244px; animation: tail .9s ease-in-out infinite alternate }
  .ear   { transform-origin: 120px 60px; animation: ear 2.4s ease-in-out infinite }
  .lids  { transform-origin: 120px 78px; animation: blink 4s infinite }
  .look  { animation: look 6s ease-in-out infinite }
  .belly { transform-origin: 120px 206px; animation: spin 12s linear infinite }
  .think { transform-origin: 120px 22px; animation: think 1.8s ease-in-out infinite }
  @keyframes hips  { from { transform: translateX(-10px) rotate(-8deg) } to { transform: translateX(10px) rotate(8deg) } }
  @keyframes upper { from { transform: rotate(3deg) } to { transform: rotate(-3deg) } }
  @keyframes tail  { from { transform: rotate(-26deg) } to { transform: rotate(20deg) } }
  @keyframes ear   { 0%, 88%, 100% { transform: none } 93% { transform: rotate(-4deg) } }
  @keyframes blink { 0%, 90%, 100% { transform: none } 94% { transform: scaleY(1.9) } }
  @keyframes look  { 0%, 40%, 100% { transform: none } 50%, 70% { transform: translate(-5px, -2px) } }
  @keyframes spin  { to { transform: rotate(360deg) } }
  @keyframes think { 0%, 100% { transform: scale(.6) rotate(0); opacity: .35 } 50% { transform: scale(1) rotate(45deg); opacity: 1 } }
  #hint { margin-top: 14px; font-size: 14px; opacity: .6; text-align: center }
</style></head><body>
<svg viewBox="0 0 240 320" onclick="start()">
  <ellipse cx="120" cy="306" rx="70" ry="8" fill="#000" opacity=".13"/>
  <g class="think"><circle cx="120" cy="22" r="3.4" fill="#D97757"/><path d="M122.4 23.6 L129.9 22.5 Q131.4 21.5 129.9 20.7 L122.3 20.2 Z M120.6 24.8 L126.5 29.1 Q128.3 29.5 127.8 27.8 L122.9 22.3 Z M118.7 24.6 L120.8 32.7 Q122.0 34.0 122.7 32.4 L122.1 24.0 Z M117.5 23.5 L114.6 31.9 Q114.8 33.6 116.3 32.6 L120.6 24.8 Z M117.2 21.5 L109.8 26.0 Q108.8 27.5 110.6 27.7 L118.7 24.6 Z M118.1 19.8 L110.8 18.7 Q109.1 19.3 110.4 20.5 L117.3 23.1 Z M120.2 19.1 L114.4 10.9 Q112.8 10.1 112.8 11.9 L117.3 20.9 Z M121.9 19.8 L121.8 11.9 Q121.0 10.3 119.9 11.8 L118.5 19.5 Z M122.9 21.9 L130.6 14.8 Q131.3 13.1 129.5 13.3 L120.8 19.2 Z" fill="#D97757"/></g>
  <g class="hips">
    <g class="tail"><path d="M150 236 C196 246 214 214 204 176 C200 162 212 156 218 168 C232 214 210 262 150 252 Z" fill="#D97757" stroke="#4A2416" stroke-width="3" stroke-linejoin="round"/>
      <path d="M205 186 l10 -3 M208 204 l12 -1 M203 222 l12 3" stroke="#B4573A" stroke-width="5" stroke-linecap="round"/>
      <g class=""><circle cx="214" cy="166" r="2.6" fill="#F5E6D3"/><path d="M215.8 167.4 L223.3 167.0 Q224.4 166.3 223.3 165.6 L215.8 164.8 Z M214.4 168.2 L220.6 173.4 Q221.9 173.7 221.6 172.3 L216.2 166.3 Z M212.9 167.9 L214.4 175.8 Q215.3 176.9 215.9 175.6 L215.5 167.6 Z M212.1 167.1 L210.0 173.5 Q210.1 174.9 211.3 174.1 L214.5 168.2 Z M211.9 165.2 L205.1 167.5 Q204.1 168.4 205.4 168.9 L212.6 167.7 Z M212.9 164.1 L207.5 162.1 Q206.2 162.3 206.9 163.4 L211.8 166.4 Z M214.2 163.8 L210.6 158.8 Q209.4 158.2 209.4 159.6 L212.0 165.1 Z M215.6 164.5 L216.3 157.5 Q215.8 156.2 214.9 157.2 L213.1 164.0 Z M216.2 165.6 L219.9 160.8 Q220.2 159.5 218.8 159.8 L214.3 163.8 Z" fill="#F5E6D3"/></g></g>
    <path d="M92 258 L90 282 M148 258 L150 282" stroke="#4A2416" stroke-width="30" stroke-linecap="round"/>
    <path d="M92 258 L90 282 M148 258 L150 282" stroke="#D97757" stroke-width="24" stroke-linecap="round"/>
    <path d="M60 236 C60 200 180 200 180 236 C180 276 60 276 60 236 Z" fill="#D97757" stroke="#4A2416" stroke-width="3"/>
  </g>
  <path d="M66 298 C66 284 106 282 108 298 Z M132 298 C134 282 174 284 174 298 Z" fill="#D97757" stroke="#4A2416" stroke-width="3" stroke-linejoin="round"/>
  <path d="M80 296 v-6 M90 296 v-7 M150 296 v-7 M160 296 v-6" stroke="#4A2416" stroke-width="2" stroke-linecap="round"/>
  <g class="upper">
    <path d="M120 128 C176 128 186 180 182 214 C178 252 152 262 120 262 C88 262 62 252 58 214 C54 180 64 128 120 128 Z" fill="#D97757" stroke="#4A2416" stroke-width="3"/>
    <path d="M66 176 q10 4 14 -2 M62 200 q12 4 16 -2 M174 176 q-10 4 -14 -2 M178 200 q-12 4 -16 -2" stroke="#B4573A" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M120 150 C152 150 160 186 158 212 C156 240 142 252 120 252 C98 252 84 240 82 212 C80 186 88 150 120 150 Z" fill="#F5E6D3"/>
    <g class="belly"><circle cx="120" cy="206" r="6.8" fill="#D97757"/><path d="M124.9 209.1 L142.8 206.4 Q145.7 204.4 142.5 202.7 L124.5 202.3 Z M122.3 211.3 L138.9 219.5 Q142.4 219.4 140.8 216.3 L125.8 205.5 Z M118.7 211.6 L125.7 224.4 Q128.6 226.5 129.2 223.0 L124.9 209.0 Z M116.5 210.6 L117.5 230.8 Q119.3 233.8 121.2 230.9 L123.3 210.8 Z M114.5 207.6 L106.1 221.0 Q105.7 224.6 109.0 223.3 L119.8 211.8 Z M114.8 203.4 L97.9 207.8 Q95.2 210.2 98.5 211.5 L115.9 210.1 Z M116.8 201.2 L100.0 196.3 Q96.4 197.0 98.6 199.8 L114.4 207.5 Z M119.7 200.2 L109.0 189.4 Q105.6 188.2 106.1 191.8 L114.4 204.5 Z M122.8 201.0 L119.1 180.9 Q116.9 178.1 115.4 181.3 L116.1 201.7 Z M125.0 203.2 L131.8 184.9 Q131.4 181.4 128.5 183.3 L118.9 200.3 Z M125.7 206.6 L137.5 197.9 Q139.2 194.8 135.6 194.7 L122.3 200.7 Z" fill="#D97757"/></g>
    <path d="M78 150 L40 186 L78 214" fill="none" stroke="#4A2416" stroke-width="27" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M78 150 L40 186 L78 214" fill="none" stroke="#D97757" stroke-width="21" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M162 150 L200 186 L162 214" fill="none" stroke="#4A2416" stroke-width="27" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M162 150 L200 186 L162 214" fill="none" stroke="#D97757" stroke-width="21" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M46 176 l10 8 M194 176 l-10 8" stroke="#B4573A" stroke-width="5" stroke-linecap="round"/>
    <path d="M70 88 L38 92 L50 102 L28 110 L50 116 L36 130 L70 128 Z M170 88 L202 92 L190 102 L212 110 L190 116 L204 130 L170 128 Z" fill="#D97757" stroke="#4A2416" stroke-width="3" stroke-linejoin="round"/>
    <g class="ear">
      <path d="M70 72 L66 22 L106 50 Z M170 72 L174 22 L134 50 Z" fill="#D97757" stroke="#4A2416" stroke-width="3" stroke-linejoin="round"/>
      <path d="M76 62 L74 34 L98 52 Z M164 62 L166 34 L142 52 Z" fill="#F2A7A0"/>
      <path d="M70 26 l-4 -8 M72 28 l2 -9 M170 26 l4 -8 M168 28 l-2 -9" stroke="#4A2416" stroke-width="2" stroke-linecap="round"/>
    </g>
    <path d="M120 40 C172 40 186 74 184 100 C182 130 156 142 120 142 C84 142 58 130 56 100 C54 74 68 40 120 40 Z" fill="#D97757" stroke="#4A2416" stroke-width="3"/>
    <path d="M106 44 L110 62 M120 42 L120 64 M134 44 L130 62 M68 76 l12 4 M172 76 l-12 4" stroke="#B4573A" stroke-width="5" stroke-linecap="round"/>
    <path d="M120 98 C146 98 156 110 154 122 C152 134 138 138 120 138 C102 138 88 134 86 122 C84 110 94 98 120 98 Z" fill="#F5E6D3"/>
    <g class="eyes">
      <ellipse cx="96" cy="90" rx="14" ry="12" fill="#fff" stroke="#4A2416" stroke-width="2"/>
      <ellipse cx="144" cy="90" rx="14" ry="12" fill="#fff" stroke="#4A2416" stroke-width="2"/>
      <g class="look"><circle cx="99" cy="93" r="6.5" fill="#2A1A10"/><circle cx="147" cy="93" r="6.5" fill="#2A1A10"/>
      <circle cx="101" cy="90.5" r="2" fill="#fff"/><circle cx="149" cy="90.5" r="2" fill="#fff"/></g>
      <g class="lids"><path d="M81 90 C81 74 111 74 111 90 C104 86 88 86 81 90 Z M129 90 C129 74 159 74 159 90 C152 86 136 86 129 90 Z" fill="#D97757" stroke="#4A2416" stroke-width="2.5" stroke-linejoin="round"/></g>
    </g>
    <g fill="none" stroke="#4A2416" stroke-width="3"><circle cx="96" cy="90" r="18"/><circle cx="144" cy="90" r="18"/><path d="M114 88 q6 -5 12 0 M78 86 l-16 -4 M162 86 l16 -4"/></g>
    <path d="M89 76 q8 -9 16 -4 M135 70 q9 -4 17 4" stroke="#4A2416" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M113 108 L127 108 L120 116 Z" fill="#7A3B2A" stroke="#4A2416" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M120 116 v5 M120 121 C114 128 106 126 103 120 M120 121 C127 129 138 126 142 116" stroke="#4A2416" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M90 112 L42 104 M90 118 L44 124 M150 112 L198 104 M150 118 L196 124" stroke="#4A2416" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="100" cy="114" r="1.6" fill="#4A2416"/><circle cx="106" cy="118" r="1.6" fill="#4A2416"/><circle cx="140" cy="114" r="1.6" fill="#4A2416"/><circle cx="134" cy="118" r="1.6" fill="#4A2416"/>
  </g>
</svg>
<textarea id="tx" rows="3" placeholder="Нажмите 🎤 на клавиатуре и говорите" enterkeyhint="send" autofocus></textarea>
<button id="go">Отправить</button>
<script>
  const tx = document.getElementById("tx"), go = document.getElementById("go")
  let sent = false
  function start() { tx.focus() }
  function val() { return JSON.stringify({ text: tx.value, sent }) }
  function send() {
    if (!tx.value.trim()) return tx.focus()
    sent = true; tx.blur(); go.textContent = "Выполняю…"; go.disabled = true
  }
  go.onclick = send
  tx.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); send() } }
  setTimeout(start, 300)
</script></body></html>`
}

async function voiceCommand(given) {
  let heard = given !== undefined ? given : await dictate()
  if (!heard || !heard.trim()) {
    heard = await ask("Голосовая команда", "Например: завтра в 10 встреча с Олей, потратил 300 на такси",
      "Далее", "", "Не удалось распознать речь — можно написать текстом")
    if (!heard) return
  }
  if (aiReady()) return agentCommand(heard)   // ассистент Claude: понимает свободную речь и уточняет

  let actions = buildActions(splitCommands(normalizeSpeech(heard)))
  if (!actions.length) actions = [{ kind: null, raw: heard }]
  if (actions.length === 1 && actions[0].kind === "report") return report()

  const ready = []
  for (const a of actions) {
    const r = await completeAction(a)
    if (r) ready.push(r)
  }
  if (!ready.length) return

  const al = new Alert()
  al.title = ready.length === 1 ? "Сохранить?" : `Сохранить ${ready.length} ${plural(ready.length)}?`
  al.message = ready.map(describe).join("\n") + `\n\n🎤 «${heard}»`
  al.addAction(ready.length === 1 ? "Сохранить" : "Сохранить всё")
  al.addAction("Исправить текст")
  al.addCancelAction("Отмена")
  const i = await al.presentAlert()
  if (i === 1) {
    const t = await ask("Исправить команду", "", "Готово", heard)
    return t ? voiceCommand(t) : undefined
  }
  if (i === 0) await executeAll(ready)
}

// ───────────── Ассистент: Claude выполняет команды сам ─────────────
// Работает, если в меню «🧠 Ассистент Claude» добавлен API-ключ. Claude видит календарь,
// напоминания, заметки и деньги через инструменты ниже, сам решает, что сделать,
// переспрашивает, если неясно, и показывает итог. После ответа можно продолжить разговор.

const ISO = fmt("yyyy-MM-dd'T'HH:mm")
const isoLocal = d => (d ? ISO.string(d) : null)

function parseIsoLocal(s) {
  const m = String(s || "").match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0)
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]

function ruleFrom(rep) {
  if (!rep || !rep.freq) return null
  if (rep.freq === "daily") return { freq: "daily" }
  if (rep.freq === "weekly") {
    const days = (rep.days || []).map(d => DAY_CODES.indexOf(String(d).toUpperCase())).filter(d => d >= 0)
    return { freq: "weekly", days }
  }
  return null
}

function makeRuleFull(rep) {
  try {
    if (!rep) return null
    if (rep.freq === "monthly") return RecurrenceRule.monthly(1)
    if (rep.freq === "yearly") return RecurrenceRule.yearly(1)
    return makeRule(ruleFrom(rep))
  } catch (e) { return null }
}

// ── Календарь ──
async function evRange(from, to) {
  let list = []
  try { list = await CalendarEvent.between(from, to, []) } catch (e) {}
  return list
}

function evOut(e, repeats) {
  return {
    id: e.identifier, title: e.title, start: isoLocal(e.startDate), end: isoLocal(e.endDate),
    all_day: !!e.isAllDay, calendar: e.calendar ? e.calendar.title : "", location: e.location || "",
    repeats: !!repeats,
  }
}

// Ищет конкретное событие: по id и (для повторяющихся) по дате начала повторения
async function findEvent(id, occurrenceStart) {
  const at = parseIsoLocal(occurrenceStart)
  const from = at ? new Date(at.getTime() - 36e5 * 24) : new Date(Date.now() - 864e5 * 60)
  const to = at ? new Date(at.getTime() + 36e5 * 24) : new Date(Date.now() + 864e5 * 365)
  const all = (await evRange(from, to)).filter(e => e.identifier === id)
  if (!all.length) return null
  if (!at) return all.sort((a, b) => Math.abs(a.startDate - Date.now()) - Math.abs(b.startDate - Date.now()))[0]
  return all.sort((a, b) => Math.abs(a.startDate - at) - Math.abs(b.startDate - at))[0]
}

async function repeatingIds(from, to) {
  const wide = await evRange(new Date(from.getTime() - 864e5 * 21), new Date(to.getTime() + 864e5 * 21))
  const n = {}
  for (const e of wide) n[e.identifier] = (n[e.identifier] || 0) + 1
  return new Set(Object.keys(n).filter(k => n[k] > 1))
}

async function calendarByName(name, forReminders) {
  try {
    const list = forReminders ? await Calendar.forReminders() : await Calendar.forEvents()
    if (name) {
      const low = name.toLowerCase()
      const hit = list.find(c => c.title.toLowerCase() === low) || list.find(c => c.title.toLowerCase().includes(low))
      if (hit) return hit
    }
    return forReminders ? await Calendar.defaultForReminders() : await Calendar.defaultForEvents()
  } catch (e) { return null }
}

// ── Подтверждение опасных действий ──
async function confirmAction(title, message) {
  if (HUB_RUN) return true
  const a = new Alert()
  a.title = title
  a.message = message
  a.addDestructiveAction("Да")
  a.addCancelAction("Нет")
  return (await a.presentAlert()) === 0
}

// ── Инструменты для Claude ──
const AGENT_TOOLS = [
  { name: "add_food", description: "Записать съеденное. Калории и БЖУ оцени сам по описанию (обычная порция, если не сказано).",
    input_schema: { type: "object", properties: { title: { type: "string" }, kcal: { type: "number" },
      protein: { type: "number" }, fat: { type: "number" }, carbs: { type: "number" } }, required: ["title", "kcal"] } },
  { name: "add_water", description: "Записать выпитую воду. Стакан — 250 мл.",
    input_schema: { type: "object", properties: { ml: { type: "number" } }, required: ["ml"] } },
  { name: "add_workout", description: "Записать тренировку без часов (пользователь забыл часы и рассказывает сам). Оцени длительность и сожжённые калории сам по MET и весу пользователя из системной подсказки: например, бассейн 18 м × 10 раз = 180 м ≈ 6–8 минут спокойного плавания.",
    input_schema: { type: "object", properties: { title: { type: "string", description: "Коротко: «Плавание 180 м»" }, minutes: { type: "number" }, kcal: { type: "number" },
      date: { type: "string", description: "YYYY-MM-DDTHH:MM, если тренировка была не сейчас" } }, required: ["title", "minutes", "kcal"] } },
  { name: "get_health", description: "Еда, вода и активность с Apple Watch за сегодня (вместе с тренировками без часов).", input_schema: { type: "object", properties: {} } },
  { name: "get_events", description: "Найти события календаря в диапазоне дат. Для поиска по названию передайте query (ищет по подстроке без учёта регистра).",
    input_schema: { type: "object", properties: {
      start: { type: "string", description: "Начало диапазона, YYYY-MM-DDTHH:MM (местное время)" },
      end: { type: "string", description: "Конец диапазона, YYYY-MM-DDTHH:MM" },
      query: { type: "string" } }, required: ["start", "end"] } },
  { name: "create_event", description: "Создать событие в календаре.",
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
  { name: "get_reminders", description: "Список невыполненных напоминаний (и выполненных, если include_completed).",
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
  { name: "get_notes", description: "Быстрые заметки виджета.", input_schema: { type: "object", properties: {} } },
  { name: "add_note", description: "Сохранить быструю заметку.",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
  { name: "delete_note", description: "Удалить заметку.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "add_money", description: `Записать расход или доход ${CONFIG.currencyIn}.`,
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

async function runTool(name, x) {
  switch (name) {
    case "get_events": {
      const from = parseIsoLocal(x.start), to = parseIsoLocal(x.end)
      if (!from || !to) return { error: "нужны start и end в формате YYYY-MM-DDTHH:MM" }
      let list = await evRange(from, to)
      if (x.query) { const q = x.query.toLowerCase(); list = list.filter(e => (e.title || "").toLowerCase().includes(q) || titleMatches(e.title, x.query)) }
      const rep = await repeatingIds(from, to)
      return { events: list.sort((a, b) => a.startDate - b.startDate).slice(0, 60).map(e => evOut(e, rep.has(e.identifier))) }
    }
    case "create_event": {
      const s = parseIsoLocal(x.start), en = parseIsoLocal(x.end)
      if (!s) return { error: "неверное начало" }
      const e = new CalendarEvent()
      e.title = x.title
      e.startDate = s
      e.endDate = en && en > s ? en : new Date(s.getTime() + CONFIG.defaultEventMinutes * 60000)
      if (x.all_day) e.isAllDay = true
      if (x.location) e.location = x.location
      if (x.notes) e.notes = x.notes
      const cal = x.calendar ? await calendarByName(x.calendar, false) : null
      if (cal) e.calendar = cal
      const rule = makeRuleFull(x.repeat)
      if (rule) e.addRecurrenceRule(rule)
      e.save()
      return { ok: true, event: evOut(e, !!rule) }
    }
    case "update_event": {
      const e = await findEvent(x.id, x.occurrence_start)
      if (!e) return { error: "событие не найдено" }
      const before = evOut(e)
      const dur = e.endDate - e.startDate
      const s = x.start ? parseIsoLocal(x.start) : null, en = x.end ? parseIsoLocal(x.end) : null
      const newStart = s || e.startDate, newEnd = en || (s ? new Date(s.getTime() + dur) : e.endDate)
      // перенос подтверждает пользователь: время могли попросить сменить не он, а текст в чужом приглашении
      if (newStart.getTime() !== e.startDate.getTime() || newEnd.getTime() !== e.endDate.getTime()) {
        const what = `${e.title}\n${cap(WHEN.string(e.startDate))} → ${cap(WHEN.string(newStart))}`
        if (!(await confirmAction("Перенести событие?", what))) return { cancelled: "пользователь отказался переносить" }
      }
      if (x.title) e.title = x.title
      e.startDate = newStart
      e.endDate = newEnd
      if (x.location !== undefined) e.location = x.location
      if (x.notes !== undefined) e.notes = x.notes
      e.save()
      return { ok: true, before, after: evOut(e) }
    }
    case "delete_event": {
      const e = await findEvent(x.id, x.occurrence_start)
      if (!e) return { error: "событие не найдено" }
      const what = `${e.title}\n${cap(WHEN.string(e.startDate))}${x.all_future ? "\nи все следующие повторения" : ""}`
      if (!(await confirmAction("Удалить событие?", what))) return { cancelled: "пользователь отказался удалять" }
      if (x.all_future && typeof e.removeForFutureEvents === "function") e.removeForFutureEvents()
      else e.remove()
      return { ok: true, deleted: evOut(e) }
    }
    case "get_reminders": {
      let list = []
      try { list = await Reminder.allIncomplete() } catch (e) {}
      if (x.include_completed) { try { list = list.concat((await Reminder.allCompleted()).slice(-30)) } catch (e) {} }
      if (x.query) list = list.filter(r => (r.title || "").toLowerCase().includes(x.query.toLowerCase()) || titleMatches(r.title, x.query))
      return { reminders: list.slice(0, 80).map(r => ({ id: r.identifier, title: r.title,
        due: r.dueDate ? (r.dueDateIncludesTime ? isoLocal(r.dueDate) : isoLocal(r.dueDate).slice(0, 10)) : null,
        completed: !!r.isCompleted, list: r.calendar ? r.calendar.title : "" })) }
    }
    case "create_reminder": {
      const r = new Reminder()
      r.title = x.title
      if (x.notes) r.notes = x.notes
      const cal = x.list ? await calendarByName(x.list, true) : null
      if (cal) r.calendar = cal
      const d = parseIsoLocal(x.due)
      if (d) {
        r.dueDate = d
        r.dueDateIncludesTime = /T|\s\d/.test(x.due)
        if (r.dueDateIncludesTime && CONFIG.notifyReminders && !WEB_APP && d > new Date()) {
          try { const n = new Notification(); n.title = "⏰ Напоминание"; n.body = x.title; n.setTriggerDate(d); await n.schedule() } catch (e) {}
        }
      }
      const rule = makeRuleFull(x.repeat)
      if (rule) r.addRecurrenceRule(rule)
      r.save()
      return { ok: true, id: r.identifier }
    }
    case "update_reminder": {
      let all = []
      try { all = (await Reminder.allIncomplete()).concat(await Reminder.allCompleted()) } catch (e) {}
      const r = all.find(z => z.identifier === x.id)
      if (!r) return { error: "напоминание не найдено" }
      if (x.title) r.title = x.title
      if (x.due === "") r.dueDate = null
      else if (x.due) { const d = parseIsoLocal(x.due); if (d) { r.dueDate = d; r.dueDateIncludesTime = /T|\s\d/.test(x.due) } }
      if (typeof x.completed === "boolean") r.isCompleted = x.completed
      r.save()
      return { ok: true }
    }
    case "delete_reminder": {
      let all = []
      try { all = (await Reminder.allIncomplete()).concat(await Reminder.allCompleted()) } catch (e) {}
      const r = all.find(z => z.identifier === x.id)
      if (!r) return { error: "напоминание не найдено" }
      if (!(await confirmAction("Удалить напоминание?", r.title))) return { cancelled: "пользователь отказался удалять" }
      r.remove()
      return { ok: true }
    }
    case "get_notes":
      return { notes: (await loadNotes()).slice(0, 50).map(n => ({ id: n.id, text: n.text, date: isoLocal(new Date(n.date)) })) }
    case "add_note":
      await saveNote(x.text)
      return { ok: true }
    case "delete_note":
      await saveNotes([], [x.id])
      return { ok: true }
    case "add_money": {
      const names = CONFIG.categories[x.type] ? CONFIG.categories[x.type].map(c => c[0]) : []
      if (!names.includes(x.category)) return { error: `категория должна быть одной из: ${names.join(", ")}` }
      if (!(x.amount > 0)) return { error: "сумма должна быть больше нуля" }
      const now = Date.now()
      const d = parseIsoLocal(x.date)
      if (d) d.setHours(12, 0, 0, 0)
      const id = `f${now}-${Math.random().toString(36).slice(2, 6)}`
      await saveMoney([{ id, date: d ? d.getTime() : now, u: now, type: x.type, amount: x.amount,
        method: x.method, category: x.category, comment: x.comment || "" }])
      return { ok: true, id }
    }
    case "get_money": {
      const key = x.month || monthKey(new Date())
      const t = monthTotals(await loadMoney(), key)
      return { month: key, income: t.income, expense: t.expense, cash: t.cash, transfer: t.transfer, by_category: t.cats,
        items: t.items.slice(-60).map(e => ({ id: e.id, date: isoLocal(new Date(e.date)), type: e.type, amount: e.amount,
          method: e.method, category: e.category, comment: e.comment })) }
    }
    case "delete_money": {
      const e = (await loadMoney()).find(z => z.id === x.id)
      if (!e) return { error: "операция не найдена" }
      if (!(await confirmAction("Удалить операцию?", `${e.type === "expense" ? "−" : "+"}${money(e.amount)} · ${e.category}${e.comment ? " · " + e.comment : ""}`)))
        return { cancelled: "пользователь отказался удалять" }
      await saveMoney([], [x.id])
      return { ok: true }
    }
    case "add_food": {
      if (!(x.kcal > 0)) return { error: "калории должны быть больше нуля" }
      const m = await addFood({ title: x.title, kcal: x.kcal, protein: Math.round(x.protein || 0), fat: Math.round(x.fat || 0), carbs: Math.round(x.carbs || 0) })
      return { ok: true, id: m.id }
    }
    case "add_water":
      if (!(x.ml > 0)) return { error: "объём должен быть больше нуля" }
      await addWater(x.ml)
      return { ok: true }
    case "add_workout": {
      if (!(x.kcal > 0)) return { error: "калории должны быть больше нуля" }
      const when = x.date && !isNaN(new Date(x.date)) ? new Date(x.date).getTime() : Date.now()
      const w = await addWorkout({ title: x.title, minutes: x.minutes, kcal: x.kcal, date: when })
      return { ok: true, id: w.id }
    }
    case "get_health": {
      const d = await dayHealth()
      return { eaten_kcal: d.kcal, protein: d.protein, fat: d.fat, carbs: d.carbs, meals: d.food.map(m => ({ time: TIME.string(new Date(m.date)), title: m.title, kcal: m.kcal })),
        water_ml: d.water, water_goal_ml: CONFIG.health.waterGoal, watch: d.act || "нет данных с часов за сегодня" }
    }
    case "claude_code": {   // чат помощника: задача уходит в новую сессию Claude Code
      const r = loadRoutes().find(z => z.name === x.route)
      if (!r) return { error: `нет маршрута «${x.route}»` }
      return await fireRoute(r, x.task)
    }
    case "ask_user": {
      const opts = (x.options || []).slice(0, 5)
      const a = new Alert()
      a.title = "Уточните"
      a.message = x.question
      opts.forEach(o => a.addAction(o))
      a.addAction("🎤 Ответить голосом")
      a.addAction("⌨️ Написать")
      a.addCancelAction("Отмена")
      const i = await a.presentAlert()
      if (i === -1) return { answer: "(пользователь отменил команду — ничего не делай и коротко подтверди отмену)" }
      if (i < opts.length) return { answer: opts[i] }
      const text = i === opts.length ? await dictate() : await ask("Ваш ответ", "", "Готово", "", x.question)
      return { answer: text || "(нет ответа)" }
    }
  }
  return { error: `неизвестный инструмент ${name}` }
}

function agentSystem() {
  const now = new Date()
  const cats = t => CONFIG.categories[t].map(c => c[0]).join(", ")
  return `Ты — личный ассистент в виджете «Мой день» на iPhone. Пользователь говорит голосом по-русски; речь распознаётся с ошибками («падал», «падлу» = «падел»), восстанавливай смысл.
Сейчас ${fmt("yyyy-MM-dd HH:mm").string(now)}, ${fmt("EEEE").string(now)}. Часовой пояс устройства — используй местное время без смещения, формат YYYY-MM-DDTHH:MM.

Как работать:
- Выполняй команду сам с помощью инструментов. Перед изменением или удалением события найди его через get_events (в разумном диапазоне дат), затем используй его id и start как occurrence_start.
- «Перенеси», «сдвинь», «поменяй время» — это update_event существующего события, а не новое событие.
- Повторяющиеся события меняй только в нужное повторение, если пользователь не сказал «все» или «каждую неделю».
- Время без «утра/вечера»: встречи, спорт, свидания, ужины после 6 обычно вечером; созвоны и работа — днём. Если перепутать дорого и неясно — спроси.
- Уточняй через ask_user, только если без ответа нельзя сделать правильно: не названо новое время переноса, несколько подходящих событий, не указан способ оплаты (наличные или перевод). Давай короткие варианты ответа.
${CONFIG.calendars.length ? `- Календари по словам пользователя: ${CONFIG.calendars.map(c => `«${c.calendar}» (список напоминаний «${c.list}»)`).join(", ")}.${CONFIG.calendars.filter(c => c.hint).map(c => ` ${c.hint} — «${c.calendar}».`).join("")} Если календарь не назван, не указывай его.
` : ""}- Деньги — ${CONFIG.currencyIn}. Категории расходов: ${cats("expense")}. Категории доходов: ${cats("income")}.
- «Съел», «выпил стакан воды» — add_food и add_water. На вопросы о калориях, шагах и воде смотри get_health.
- Тренировка без часов («проплыл бассейн 10 раз», «час падела, часы забыл») — add_workout. Вес пользователя ${CONFIG.health.weight || 80} кг. Скажи, сколько ккал и минут записал.
- Если пользователь спрашивает (что у меня завтра, сколько потратил), посмотри данные и ответь.
- Удаление и перенос пользователь подтверждает сам — не спрашивай отдельно «точно удалить?» или «точно перенести?».
- В конце ответь по-русски коротко, 1–4 строки: что сделано (с днём и временем) или ответ на вопрос. Без Markdown, без заголовков.`
}

// system передаётся один на весь разговор: в нём текущее время, а «мысли» Claude из прошлых шагов
// API принимает только с тем же system, с которым они созданы
async function callClaude(messages, system = agentSystem(), tools = AGENT_TOOLS) {
  return await anthropic({ model: CONFIG.agentModel, max_tokens: 2000, system, tools, messages })
}

// Один «ход»: Claude думает, вызывает инструменты, пока не даст ответ
const dropThinking = messages => messages.forEach(m => {
  if (m.role === "assistant" && Array.isArray(m.content)) m.content = m.content.filter(c => c.type !== "thinking" && c.type !== "redacted_thinking")
})

async function agentTurn(messages, system, tools) {
  const changed = []
  for (let step = 0; step < 14; step++) {
    let res
    try {
      res = await callClaude(messages, system, tools)
      // запасной путь: если API всё же не принял старые «мысли», убираем их и повторяем
      if (res && res.error && /thinking/i.test(res.error.message || "")) { dropThinking(messages); res = await callClaude(messages, system, tools) }
    } catch (e) { return { text: `Нет связи с ${AI_NAME}: ${e}`, changed } }
    if (!res || res.error) return { text: `${AI_NAME} ответил ошибкой: ${res && res.error ? res.error.message || res.error.type : "пустой ответ"}`, changed }
    messages.push({ role: "assistant", content: res.content })
    const uses = (res.content || []).filter(c => c.type === "tool_use")
    if (!uses.length || res.stop_reason !== "tool_use") {
      return { text: (res.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim() || "Готово.", changed }
    }
    const results = []
    for (const u of uses) {
      let out
      try { out = await runTool(u.name, u.input || {}) } catch (e) { out = { error: String(e) } }
      if (out && out.ok && u.name !== "ask_user") changed.push(u.name)
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) })
    }
    messages.push({ role: "user", content: results })
  }
  return { text: "Не удалось закончить команду — попробуйте сформулировать проще.", changed }
}

async function agentCommand(first) {
  const messages = []
  const system = agentSystem()       // один на весь разговор
  let text = first
  while (text && text.trim()) {
    messages.push({ role: "user", content: text.trim() })
    const r = await agentTurn(messages, system)
    const a = new Alert()
    a.title = r.changed.length ? "✓ Готово" : "Мой день"
    a.message = `${r.text}\n\n🎤 «${text.trim()}»`
    a.addAction("🎤 Ещё команда")
    a.addAction("⌨️ Написать")
    a.addCancelAction("Готово")
    const i = await a.presentAlert()
    if (i === -1) break
    text = i === 0 ? await dictate() : await ask("Команда", "Что сделать?", "Отправить")
    if (messages.length > 40) messages.splice(0, messages.length - 20)
    while (messages.length && (messages[0].role !== "user" || typeof messages[0].content !== "string")) messages.shift()
  }
}

// ───────────── Чат с помощником (личная версия: CONFIG.assistantChat) ─────────────
// 💬 в виджете открывает постоянный чат с Claude, 🎤 открывает его же и сразу включает системную диктовку.
// Помощник делает дела в календаре, напоминаниях, деньгах и еде сам, советует как друг,
// а сложные задачи передаёт в Claude Code (новая сессия по API «рутин» claude.ai/code/routines).
const CHAT_FILE = "chat.json"
const ROUTES_KEY = "myday.routes"
const CHAT_SESSIONS = []
const sleep = ms => new Promise(r => Timer.schedule(ms, false, r))

// Системная диктовка: слушает сразу. Из виджета Scriptable первые доли секунды не готов показать окно —
// если диктовка закрылась мгновенно, пробуем ещё раз; закрытие пользователем — пустой ответ
async function listen() {
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now()
    try { return ((await Dictation.start("ru-RU")) || "").trim() } catch (e) { if (Date.now() - t0 > 1500) return "" }
    await sleep(500)
  }
  return ""
}

// ── Маршруты в Claude Code: [{ name, hint, url, token }] — токены только в Связке ключей iPhone
function loadRoutes() {
  try { if (Keychain.contains(ROUTES_KEY)) { const r = JSON.parse(Keychain.get(ROUTES_KEY)); if (r.length) return r } } catch (e) {}
  return Array.isArray(CONFIG.routes) ? CONFIG.routes : []   // встроенные при сборке (только личная версия)
}
function saveRoutes(list) { Keychain.set(ROUTES_KEY, JSON.stringify(list)) }
const ROUTE_URL = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/trig_[A-Za-z0-9_-]+\/fire$/

async function fireRoute(route, text) {
  const req = new Request(route.url)
  req.method = "POST"
  req.timeoutInterval = 30
  req.headers = { "Authorization": `Bearer ${route.token}`, "anthropic-version": "2023-06-01",
    "anthropic-beta": "experimental-cc-routine-2026-04-01", "content-type": "application/json" }
  req.body = JSON.stringify({ text: String(text || "").slice(0, 60000) })
  let r
  try { r = await req.loadJSON() } catch (e) { return { error: `нет связи: ${e}` } }
  if (r && r.claude_code_session_url) { CHAT_SESSIONS.push(r.claude_code_session_url); return { ok: true, session_url: r.claude_code_session_url } }
  return { error: r && r.error ? `${r.error.type}: ${r.error.message}` : "пустой ответ" }
}

function routeTool(routes) {
  return { name: "claude_code",
    description: "Передать задачу в Claude Code: запускается новая сессия, она работает сама (код, документы, исследование, " +
      "длинные многошаговые задачи) и возвращает ссылку. Маршруты:\n" + routes.map(r => `- «${r.name}»: ${r.hint || "без описания"}`).join("\n"),
    input_schema: { type: "object", properties: {
      route: { type: "string", enum: routes.map(r => r.name) },
      task: { type: "string", description: "Полная постановка задачи: что сделать, весь нужный контекст из разговора, что вернуть. Сессия этот чат не видит." },
    }, required: ["route", "task"] } }
}
const chatTools = () => { const r = loadRoutes(); return r.length ? AGENT_TOOLS.concat([routeTool(r)]) : AGENT_TOOLS }

function chatSystem() {
  const routes = loadRoutes()
  return agentSystem().replace(/\n- В конце ответь[^\n]*/, "") + `

Это постоянный чат в виджете. Ты — личный помощник, секретарь и друг пользователя: помогаешь в любом деле — в жизни и в работе.
- Дела (встречи, напоминания, деньги, еда, вода, тренировки) делай сам инструментами, потом коротко скажи, что сделал.
- Когда просят совета или делятся чем-то личным — отвечай как умный друг: честно, по существу, с заботой, думай на годы вперёд, а не только о сегодняшнем дне. Можно мягко не согласиться.
- Длина ответа: обычно 1–6 строк; совет или разбор — сколько нужно, но без воды. Без Markdown-заголовков и таблиц, короткие списки можно.
- В начале сообщений пользователя в квадратных скобках время, когда оно отправлено; сам время в скобках не пиши.
${routes.length ? `- Сложную задачу, которую не решить здесь за пару сообщений (код, разбор документов, исследование, подготовка текста или плана, многошаговая работа), передай через claude_code. Рабочую — в маршрут нужного рабочего проекта по его описанию; личную, не связанную с работой, — в маршрут для личных задач. Если неясно, что именно нужно, сначала коротко уточни. После передачи скажи одной строкой, куда передал; ссылка на сессию покажется сама.`
  : "- Передавать задачи в Claude Code пока нельзя: маршруты не подключены (меню → 🤖 Задачи в Claude Code). Сложную задачу честно назови сложной и предложи подключить."}`
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

// Сообщения чата для API: только текст, подряд идущие от одного автора склеиваются, первым — пользователь
function chatContext(hist) {
  const out = []
  for (const m of hist.slice(-30)) {
    let content = m.prompt || m.text
    if (!content) continue
    if (m.role === "user") content = `[${fmt("d MMM HH:mm").string(new Date(m.at || Date.now()))}] ${content}`
    const last = out[out.length - 1]
    if (last && last.role === m.role) last.content += "\n\n" + content
    else out.push({ role: m.role, content })
  }
  while (out.length && out[0].role !== "user") out.shift()
  return out
}

async function chatReply(hist, item) {
  hist.push(item)
  CHAT_SESSIONS.length = 0
  const r = await agentTurn(chatContext(hist), chatSystem(), chatTools())
  const reply = { role: "assistant", text: r.text, at: Date.now() }
  if (CHAT_SESSIONS.length) reply.links = CHAT_SESSIONS.slice()   // ссылки на запущенные сессии Claude Code — под ответом
  hist.push(reply)
  saveJSON(CHAT_FILE, hist.slice(-200))
  return reply
}

// Окно WebView из виджета: Scriptable не сразу готов его показать — повторяем, если закрылось мгновенно
async function presentWebView(wv) {
  const st = { open: true, shown: null }
  await sleep(400)
  for (let i = 0; i < 4; i++) {
    const t0 = Date.now()
    st.open = true
    st.shown = wv.present(false).then(() => { st.open = false })
    await Promise.race([st.shown, sleep(700)])
    if (st.open || Date.now() - t0 > 650) break
    await sleep(500)
  }
  return st
}

const chatView = m => ({ role: m.role, text: m.text, voice: !!m.voice, links: m.links || [],
  time: TIME.string(new Date(m.at || Date.now())) })

async function openChat(opts = {}) {
  if (!aiReady()) {
    await info(`Нужен ключ ${AI_NAME}`, "Помощнику нужен API-ключ: меню → 🧠 Ассистент.")
    return aiSettings()
  }
  const hist = await loadJSON(CHAT_FILE)
  const wv = new WebView()
  wv.shouldAllowRequest = req => {
    const u = req.url || ""
    if (/^(about:|data:)/.test(u) || u === "" ) return true
    Safari.open(u)   // ссылки (сессии Claude Code) — в Safari, чат остаётся
    return false
  }
  await wv.loadHTML(chatHTML(hist.slice(-60).map(chatView)))
  const st = await presentWebView(wv)
  const js = async s => { try { return await wv.evaluateJavaScript(s) } catch (e) { return null } }
  let pending = opts.brief && BRIEFS[opts.brief] ? { role: "user", text: BRIEFS[opts.brief].label, prompt: BRIEFS[opts.brief].prompt, at: Date.now() } : null
  let mic = !!opts.listen && !pending
  while (st.open) {
    if (mic) {
      mic = false
      await js("micOn(true)")
      const t = await listen()
      await js("micOn(false)")
      if (t) pending = { role: "user", text: t, voice: true, at: Date.now() }
      else await js("focusInput()")   // не услышал — можно надиктовать с клавиатуры или написать
    }
    if (pending) {
      const item = pending
      pending = null
      await js(`add(${JSON.stringify(chatView(item))}); typing(true)`)
      let reply
      try { reply = await chatReply(hist, item) } catch (e) { reply = { role: "assistant", text: `Ошибка: ${e}`, at: Date.now() } }
      await js(`typing(false); add(${JSON.stringify(chatView(reply))})`)
      continue
    }
    try {
      const o = JSON.parse(await js("take()") || "{}")
      if (o.clear) { hist.length = 0; saveJSON(CHAT_FILE, []) }
      if (o.mic) mic = true
      else if (o.text) pending = { role: "user", text: o.text, at: Date.now() }
    } catch (e) {}
    if (!mic && !pending) await Promise.race([st.shown, sleep(300)])
  }
}

function chatHTML(items) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,viewport-fit=cover">
<style>
  :root { --bg: #F2F2F7; --me: #0A9F6E; --meFg: #fff; --ai: #fff; --aiFg: #1C1C1E; --sub: #8E8E93; --gold: #0A9F6E; --bar: rgba(242,242,247,.92) }
  @media (prefers-color-scheme: dark) { :root { --bg: #000; --me: #30D158; --meFg: #000; --ai: #1C1C1E; --aiFg: #fff; --sub: #98989F; --gold: #30D158; --bar: rgba(0,0,0,.88) } }
  * { box-sizing: border-box }
  body { margin: 0; background: var(--bg); color: var(--aiFg); font: 17px -apple-system, sans-serif; -webkit-text-size-adjust: none }
  header { position: sticky; top: 0; z-index: 2; padding: 12px 16px 10px 84px;   /* слева — кнопка Close от Scriptable */ background: var(--bar); -webkit-backdrop-filter: blur(12px);
    display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(0,0,0,.06) }
  header b { font: 700 19px -apple-system, sans-serif } header span { color: var(--sub); font-size: 13px; flex: 1 }
  header button { border: 0; background: none; color: var(--gold); font-size: 15px; margin-right: 36px }   /* справа — кнопка «Поделиться» от Scriptable */
  #list { padding: 12px 12px 120px; display: flex; flex-direction: column; gap: 8px }
  .m { max-width: 84%; padding: 9px 13px; border-radius: 18px; white-space: pre-wrap; word-wrap: break-word; line-height: 1.32 }
  .u { align-self: flex-end; background: var(--me); color: var(--meFg); border-bottom-right-radius: 6px }
  .a { align-self: flex-start; background: var(--ai); border-bottom-left-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,.06) }
  .t { display: block; font-size: 11px; opacity: .55; margin-top: 3px; text-align: right }
  .m a { color: inherit; font-weight: 600 } .a a { color: #0A84FF }
  .link { display: block; margin-top: 6px; padding: 7px 10px; border-radius: 10px; background: rgba(15,168,156,.12); text-decoration: none }
  #typing { display: none; align-self: flex-start; color: var(--sub); padding: 4px 8px }
  #typing i { display: inline-block; width: 7px; height: 7px; margin: 0 2px; border-radius: 50%; background: var(--gold); animation: b 1s infinite }
  #typing i:nth-child(2) { animation-delay: .15s } #typing i:nth-child(3) { animation-delay: .3s }
  @keyframes b { 0%, 80%, 100% { opacity: .25 } 40% { opacity: 1 } }
  .empty { color: var(--sub); text-align: center; margin: 30vh 24px 0; line-height: 1.4 }
  form { position: fixed; left: 0; right: 0; bottom: 0; padding: 8px 10px calc(8px + env(safe-area-inset-bottom)); background: var(--bar);
    -webkit-backdrop-filter: blur(12px); display: flex; gap: 8px; align-items: flex-end; border-top: 1px solid rgba(0,0,0,.06) }
  textarea { flex: 1; resize: none; max-height: 30vh; padding: 9px 13px; border-radius: 20px; border: 1px solid rgba(120,120,128,.3);
    background: transparent; color: inherit; font: 17px -apple-system, sans-serif; outline: none }
  .btn { width: 40px; height: 40px; border-radius: 50%; border: 0; font-size: 19px; flex: none }
  #mic { background: rgba(120,120,128,.16); color: var(--gold) } #mic.on { background: #FF3B30; color: #fff; animation: p 1s infinite alternate }
  @keyframes p { to { transform: scale(1.12) } }
  #send { background: var(--me); color: #fff }
</style></head><body>
<header><b>Помощник</b><span>Claude</span><button id="clr">Очистить</button></header>
<div id="list"></div>
<div id="typing"><i></i><i></i><i></i></div>
<form id="f"><button type="button" class="btn" id="mic">🎤</button>
<textarea id="tx" rows="1" placeholder="Напишите или нажмите 🎤" enterkeyhint="send"></textarea>
<button class="btn" id="send">↑</button></form>
<script>
  const list = document.getElementById("list"), tx = document.getElementById("tx"), typingEl = document.getElementById("typing")
  let queue = [], mic = false, clear = false
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))
  const linkify = s => esc(s).replace(/https?:\\/\\/[^\\s<]+[^\\s<.,;:!?)»]/g, u => '<a href="' + u + '">' + u.replace(/^https?:\\/\\//, "").slice(0, 40) + '…</a>')
  function add(m) {
    const e = document.querySelector(".empty"); if (e) e.remove()
    const d = document.createElement("div")
    d.className = "m " + (m.role === "user" ? "u" : "a")
    d.innerHTML = (m.voice ? "🎤 " : "") + linkify(m.text) +
      (m.links || []).map(u => '<a class="link" href="' + esc(u) + '">🤖 Открыть сессию Claude Code</a>').join("") +
      '<span class="t">' + esc(m.time || "") + "</span>"
    list.appendChild(d)
    list.appendChild(typingEl)
    scrollTo(0, document.body.scrollHeight)
  }
  function typing(on) { typingEl.style.display = on ? "block" : "none"; scrollTo(0, document.body.scrollHeight) }
  function micOn(on) { document.getElementById("mic").classList.toggle("on", on) }
  function focusInput() { tx.focus() }
  function take() { const o = { text: queue.shift() || "", mic, clear }; mic = false; clear = false; return JSON.stringify(o) }
  function grow() { tx.style.height = "auto"; tx.style.height = tx.scrollHeight + "px" }
  function send() { const v = tx.value.trim(); if (!v) return; queue.push(v); tx.value = ""; grow() }
  document.getElementById("f").onsubmit = e => { e.preventDefault(); send() }
  document.getElementById("mic").onclick = () => { tx.blur(); mic = true }
  document.getElementById("clr").onclick = () => { if (confirm("Очистить переписку? Помощник забудет разговор.")) { clear = true; list.innerHTML = "" } }
  tx.oninput = grow
  tx.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }
  const items = ${JSON.stringify(items)}
  if (!items.length) list.innerHTML = '<div class="empty">Я ваш помощник: дела, напоминания, деньги, еда, советы.<br>Сложные задачи передам в Claude Code.</div>'
  items.forEach(add)
  list.appendChild(typingEl)
</script></body></html>`
}

// ── Утренняя и вечерняя сводка: ежедневное уведомление, нажатие открывает чат и помощник собирает сводку
async function scheduleBriefs() {
  if (!CONFIG.assistantChat) return
  for (const kind of ["morning", "evening"]) {
    try {
      const at = (CONFIG.briefs || {})[kind]
      const id = `myday-brief-${kind}`
      if (!at) { Notification.removePending([id]); continue }
      const [h, m] = at.split(":").map(Number)
      const n = new Notification()
      n.identifier = id
      n.title = BRIEFS[kind].label
      n.body = kind === "morning" ? "Что сегодня: встречи, дела, деньги — нажмите" : "Итоги дня: сделано, потрачено, съедено, что перенести — нажмите"
      n.openURL = WEB_APP ? `${WEB_APP}#brief=${kind}` : `${RUN}?action=brief&kind=${kind}`
      n.setDailyTrigger(h, m || 0, true)
      await n.schedule()
    } catch (e) {}
  }
}

async function briefsInfo() {
  const b = CONFIG.briefs || {}
  const i = await choose("🌅 Сводки помощника", ["☀️ Утренняя сводка сейчас", "🌙 Вечерняя сводка сейчас"],
    `Каждый день приходит уведомление: утром в ${b.morning || "—"}, вечером в ${b.evening || "—"}. ` +
    "Нажатие открывает чат, и помощник собирает сводку. Вечером он предложит перенести несделанное на завтра.\n\nВремя меняется в CONFIG.briefs.")
  if (i === 0) return openChat({ brief: "morning" })
  if (i === 1) return openChat({ brief: "evening" })
}

// ── Настройка маршрутов в Claude Code
async function routesMenu() {
  while (true) {
    const routes = loadRoutes()
    const i = await choose("🤖 Задачи в Claude Code", [...routes.map(r => `✏️ ${r.name}`), "➕ Добавить маршрут", "❓ Как получить ссылку и токен"],
      routes.length ? "Помощник передаёт сложные задачи в новую сессию Claude Code по этим маршрутам." :
        "Маршрутов нет: помощник пока не может передавать задачи. Добавьте хотя бы «Личное».")
    if (i === -1) return
    if (i === routes.length + 1) {
      await info("Как подключить", "1. На компьютере откройте claude.ai/code/routines → «New routine».\n" +
        "2. Промпт, например: «Ты мой личный помощник. Выполни задачу из сообщения до конца и коротко отчитайся». Выберите репозиторий и окружение (для рабочего проекта — его репозиторий).\n" +
        "3. В «Select a trigger» → «Add another trigger» → API → «Generate token». Токен показывается один раз.\n" +
        "4. Здесь «Добавить маршрут»: название (например «Личное» или «Работа: название проекта»), когда туда передавать, ссылка …/fire и токен.\n\n" +
        "Каждая передача — новая сессия, она расходует лимиты подписки Claude. Лимит: 30 запусков в час на маршрут.")
      continue
    }
    const old = i < routes.length ? routes[i] : null
    if (old) {
      const j = await choose(old.name, ["Изменить", "Проверить (запустить тестовую сессию)", "Удалить"], `${old.hint || ""}\n${old.url}`)
      if (j === 2) { saveRoutes(routes.filter(r => r !== old)); continue }
      if (j === 1) {
        const r = await fireRoute(old, "Проверка связи из виджета «Мой день». Ничего не делай, просто ответь «Связь есть».")
        if (r.ok) { const k = await choose("Работает ✓", ["Открыть сессию"], "Сессия запущена."); if (k === 0) Safari.open(r.session_url) }
        else await info("Не получилось", r.error)
        continue
      }
      if (j !== 0) continue
    }
    const name = await ask("Название маршрута", "Личное / Работа: проект", "Далее", old ? old.name : "")
    if (!name) continue
    const hint = await ask("Когда передавать сюда", "Например: личные дела, не про работу", "Далее", old ? old.hint : "",
      "Помощник выбирает маршрут по этому описанию.")
    const url = await ask("Ссылка API", "https://api.anthropic.com/v1/claude_code/routines/trig_…/fire", "Далее", old ? old.url : "")
    if (!url) continue
    if (!ROUTE_URL.test(url.trim())) { await info("Похоже, это не та ссылка", "Нужна ссылка вида https://api.anthropic.com/v1/claude_code/routines/trig_…/fire"); continue }
    const token = await ask("Токен", "sk-ant-oat01-…", "Сохранить", "", old ? "Оставьте пустым, чтобы не менять." : "")
    if (!token && !old) continue
    const r = { name, hint: hint || "", url: url.trim(), token: token || old.token }
    saveRoutes(old ? routes.map(z => z === old ? r : z) : routes.concat([r]))
  }
}

// ───────────── Меню ─────────────
async function sheetMenu() {
  const st = await loadSettings()
  const when = st.sheetSyncedAt ? fmt("d MMM, HH:mm").string(new Date(st.sheetSyncedAt)) : "ещё не было"
  const on = !!sheetHookOf(st)
  const i = await choose("▦ Google Таблица",
    ["Открыть таблицу", on ? "Выгрузить всё сейчас" : "Подключить автозапись",
     ...(on ? ["Изменить ссылку автозаписи", "Отключить автозапись"] : [])],
    on ? `Автозапись включена. Последняя выгрузка: ${when}` :
      "Автозапись выключена: деньги, еда, вода и активность пока не попадают в таблицу сами.")
  if (i === 0) return sheetUrlOf(st) ? Safari.open(sheetUrlOf(st)) :
    info("Таблица ещё не подключена", "Подключите автозапись: таблица сама пришлёт свою ссылку после первой записи.")
  if (i === 1 && on) {
    const r = await syncSheet(false)
    if (r && r.oldScript) return info("Скрипт таблицы старый",
      "Деньги записаны, а еду, воду и шаги эта версия скрипта не принимает. Вставьте новый Code.gs и обновите развёртывание: «Управление развёртываниями» → карандаш → «Новая версия».")
    return info(r && r.ok ? "Таблица обновлена ✓" : "Не получилось",
      r && r.ok ? `Добавлено: ${r.added || 0}, удалено: ${r.removed || 0}` :
        r && r.error === "forbidden" ? "Таблица не узнала ключ этого виджета." : `${r && r.error || "нет ответа"}`)
  }
  if (i === 1 || i === 2) {
    const url = await ask("Ссылка автозаписи", "https://script.google.com/macros/s/…/exec", "Подключить", st.sheetHook || "",
      "Скопируйте ссылку веб-приложения из Apps Script (Начать развёртывание → Веб-приложение). Настройка один раз — Mac подхватит её сам.")
    if (!url) return
    if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(url)) return info("Похоже, это не та ссылка", "Нужна ссылка вида https://script.google.com/macros/s/…/exec")
    await saveSettings(CONFIG.sheetUrl ? { sheetHook: url } : { sheetHook: url, sheetUrl: "" })   // ссылку на новую таблицу она пришлёт сама
    const r = await syncSheet(false)
    return info(r && r.ok ? "Автозапись подключена ✓" : "Ссылка сохранена, но таблица не ответила",
      r && r.ok ? `В таблицу выгружено записей: ${r.added || 0}` : `${r && r.error || ""}\nПроверьте, что доступ веб-приложения — «Все».`)
  }
  if (i === 3) { await saveSettings({ sheetHook: "" }); return info("Автозапись отключена") }
}

async function syncStatus() {
  const lines = []
  lines.push(IN_ICLOUD ? "☁️ iCloud Drive: включён ✓" :
    "⚠️ iCloud для Scriptable выключен — заметки и деньги сохраняются только на iPhone.\n" +
    "Включите: Настройки → [ваше имя] → iCloud → iCloud Drive → Scriptable.")
  for (const [file, label] of [["notes.json", "Заметки"], ["finance.json", "Деньги"]]) {
    const p = fm.joinPath(DIR, file)
    if (!fm.fileExists(p)) { lines.push(`${label}: файла ещё нет`); continue }
    const n = file === "notes.json" ? (await loadNotes()).length : (await loadMoney()).length
    let when = ""
    try { when = ` · изменён ${fmt("d MMM, HH:mm").string(fm.modificationDate(p))}` } catch (e) {}
    lines.push(`${label}: ${n} записей${when}`)
  }
  lines.push("\nКалендарь и напоминания синхронизируются через iCloud автоматически. " +
    "На Mac откройте ☰ → «Синхронизация», чтобы сравнить.")
  await info("Синхронизация с Mac", lines.join("\n"))
}

async function preview() {
  const i = await choose("Предпросмотр", ["Маленький", "Средний", "Средний — неделя", "Большой"])
  if (i === 0) await (await buildWidget("small")).presentSmall()
  if (i === 1) await (await buildWidget("medium")).presentMedium()
  if (i === 2) await (await buildWidget("medium", "неделя")).presentMedium()
  if (i === 3) await (await buildWidget("large")).presentLarge()
}

async function menu() {
  const actions = [
    ...(CONFIG.assistantChat ? [["💬 Чат с помощником", () => openChat()]] : []),
    ["🎤 Голосовая команда", () => CONFIG.assistantChat ? openChat({ listen: true }) : voiceCommand()],
    ["📷 Еда по фото", () => foodPhoto()],
    ["💧 Вода", waterMenu],
    ["⌚ Еда и активность", healthMenu],
    [`${CONFIG.currency} Расход / доход`, () => addFinance(null)],
    ...(CONFIG.assistantChat ? [] : [["📝 Быстрая заметка", addNote]]),
    ["⏰ Новое напоминание", addReminder],
    ["📅 Новая встреча", addEvent],
    ["✅ Отметить выполненным", completeReminder],
    ...(CONFIG.assistantChat ? [] : [["🗒 Мои заметки", manageNotes]]),
    ["📊 Отчёт за месяц", () => report()],
    ["🧾 Последние операции", manageMoney],
    ...(CONFIG.currency === "฿" ? [["💳 Расходы по карте", cardMenu]] : []),
    ["⌨️ Команда текстом", async () => { const t = await ask("Команда", "Что сделать?", "Отправить"); if (t) await voiceCommand(t) }],
    [`🧠 Ассистент ${AI_NAME}`, aiSettings],
    ...(CONFIG.assistantChat ? [["🤖 Задачи в Claude Code", routesMenu], ["🌅 Утренняя и вечерняя сводка", briefsInfo]] : []),
    ...(WEB_APP ? [["📱 Приложение «Мой день»", webAppMenu]] : []),
    ...(CONFIG.trackerUrl ? [["✓ Личный трекер", () => Safari.open(trackerLink())]] : []),   // [личное]
    ["▦ Google Таблица", sheetMenu],
    ["☁️ Синхронизация с Mac", syncStatus],
    ["👀 Предпросмотр виджета", preview],
    ["🏠 Возврат к виджету", homeSettings],
  ]
  if (!IN_ICLOUD) await info("⚠️ iCloud выключен для Scriptable",
    "Заметки и деньги не будут видны на Mac. Включите: Настройки → [ваше имя] → iCloud → iCloud Drive → Scriptable.")
  while (true) {
    const a = new Alert()
    a.title = "Мой день"
    actions.forEach(x => a.addAction(x[0]))
    a.addCancelAction("Закрыть")
    const i = await a.presentSheet()
    if (i === -1) break
    await actions[i][1]()
  }
}

// ── Возврат на экран «Домой» после операции из виджета ──
// Scriptable сам свернуться не умеет, поэтому в конце запускается Быстрая команда с одним действием «Перейти на экран «Домой»»
const HOME_SHORTCUT = "Мой день - домой"
const HOME_KEY = "myday.home"
const homeOn = () => { try { return Keychain.contains(HOME_KEY) } catch (e) { return false } }
const goHome = () => Safari.open(`shortcuts://run-shortcut?name=${encodeURIComponent(HOME_SHORTCUT)}`)
async function homeSettings() {
  const on = homeOn()
  const i = await choose("🏠 Возврат к виджету", on ? ["Проверить", "Выключить"] : ["Команда создана — включить"],
    (on ? "Включено: после операции из виджета iPhone возвращается на экран «Домой».\n\n" : "") +
    `Один раз создайте Быструю команду «${HOME_SHORTCUT}» (название ровно так) с одним действием ` +
    "«Перейти на экран «Домой»». Её будет запускать виджет после каждой операции.")
  if (i === -1) return
  if (on && i === 1) { Keychain.remove(HOME_KEY); return info("Возврат выключен") }
  Keychain.set(HOME_KEY, "1")
  goHome()   // проверка: должен открыться экран «Домой»
}

async function runAction(action, q) {
  if (action === "voice") return CONFIG.assistantChat ? openChat({ listen: true }) : voiceCommand()
  if (action === "chat") return CONFIG.assistantChat ? openChat() : addNote()
  if (action === "brief") return openChat({ brief: q.kind })
  if (action === "money") return addFinance(null)
  if (action === "camera") return foodPhoto("camera")
  if (action === "food") return foodPhoto()
  if (action === "water") return waterMenu()
  if (action === "health") return healthMenu()
  if (action === "note") return addNote()
  if (action === "report") return report(q.month)
  if (action === "connect") {                   // «Подключить» в приложении: код — в буфер, пользователь возвращается и вставляет
    if (!WEB_APP) return info("Приложение не настроено", "В настройках виджета нет адреса приложения.")
    Pasteboard.copy(await webAppSetupCode())
    return info("✓ Код скопирован", "Вернитесь в IZIDAY кнопкой «◀ IZIDAY» слева вверху и нажмите «Вставить».")
  }
  if (action === "hub") {                       // «Внести в iPhone сейчас» из приложения
    await hubSync(25)
    return info("✓ Внесено в iPhone", "Вернитесь в IZIDAY кнопкой «◀ IZIDAY» слева вверху.")
  }
  return menu()
}

// ───────────── Запуск ─────────────
// Из Быстрой команды (без «Run In App») окна показывать нельзя: Scriptable падает с «Alerts are not supported in Siri»
const SHORTCUT_PARAM = args.shortcutParameter ?? (args.plainTexts && args.plainTexts.length ? args.plainTexts.join("\n") : null)
if (SHORTCUT_PARAM && !config.runsInWidget) {
  await receiveHealth(SHORTCUT_PARAM)        // запуск из Быстрой команды «Мой день - здоровье»
} else if (config.runsWithSiri) {
  Script.setShortcutOutput("Мой день: команда не передала данные о здоровье. В действии «Выполнить скрипт» в поле Parameter должен стоять «Словарь».")
} else if (config.runsInWidget) {
  const st = await loadSettings()
  SHEET_URL = sheetUrlOf(st)
  STATS_URL = sheetTabUrl(st, "Еда и активность") || SHEET_URL   // пока таблица не прислала номер листа — просто таблица
  await placesCheck(await hereNow())         // рядом с местом из «напомни, когда буду рядом» — уведомление
  await logLoc(await hereNow())              // история мест: где я был в момент платежа
  await waterNudge()                         // давно не пили — уведомление
  await hubSync()                            // сначала обмен с приложением: виджет сразу покажет воду, еду и деньги оттуда
  Script.setWidget(await buildWidget(config.widgetFamily, args.widgetParameter))
  await autoSyncSheet()
  await scheduleAgenda()
} else {
  // Сначала окно, потом всё остальное: раньше перед открытием ждали выгрузку в таблицу (до 30 с)
  const q = args.queryParameters || {}
  try {
    if (q.action === "card") await askCardDups()        // уведомление «Похоже на дубль»
    else if (q.action) await runAction(q.action, q)
    else { await askCardDups(); await menu() }
  } finally {
    if (q.from === "widget" && homeOn()) goHome()
  }
  await autoSyncSheet()   // еда, вода и деньги, добавленные сейчас, — сразу в таблицу (не успеет — догонит виджет)
  if (q.action !== "hub") await hubSync()
  await scheduleMonthlyReport()
  await scheduleBriefs()
  await scheduleAgenda()
}
Script.complete()
