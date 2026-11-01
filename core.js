// АВТОМАТИЧЕСКИ СОБРАНО build_web.py из src/iphone/MyDay.js + profile-th.js — не редактируйте вручную.
window.CORE = (function () {
// АВТОМАТИЧЕСКИ СОБРАНО из iPhone-скрипта MyDay.js (build_core.py) — не редактируйте вручную.
// Общий код: разбор голосовых команд, деньги, отчёты. Работает и в Übersicht, и в Node.

// Замена DateFormatter из Scriptable
const RU_MON_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
const RU_MON_SHORT = ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."]
const RU_DAY = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"]
const RU_DAY_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"]
const z2 = n => String(n).padStart(2, "0")
function fmt(pattern) {
  return {
    string(d) {
      return pattern.replace(/yyyy|MMMM|MMM|MM|dd|d|EEEE|EE|HH|mm/g, t => ({
        yyyy: d.getFullYear(), MMMM: RU_MON_GEN[d.getMonth()], MMM: RU_MON_SHORT[d.getMonth()],
        MM: z2(d.getMonth() + 1), dd: z2(d.getDate()), d: d.getDate(),
        EEEE: RU_DAY[d.getDay()], EE: RU_DAY_SHORT[d.getDay()], HH: z2(d.getHours()), mm: z2(d.getMinutes()),
      })[t])
    },
  }
}

const TIME = fmt("HH:mm"), DAY = fmt("d MMM"), FULL = fmt("EEEE, d MMMM"), SHORT = fmt("EE, d MMM")
const WHEN = fmt("EEEE, d MMMM, HH:mm"), DM = fmt("dd.MM"), YMD = fmt("yyyy-MM-dd HH:mm")

const CONFIG = {
  daysAhead: 2,                  // на сколько дней вперёд показывать встречи (средний виджет)
  notifyReminders: true,         // присылать уведомление в момент напоминания
  defaultReminderHour: 9,        // если сказали день без времени
  defaultEventMinutes: 60,       // длительность встречи по умолчанию (голосом)
  currency: "฿",                 // значок валюты в суммах
  currencyIcon: "bahtsign",      // значок кнопки денег в виджете (SF Symbols)
  currencyIn: "в батах",         // «Сумма в батах»
  currencyWords: "бат\\S*|฿|thb", // как валюту называют голосом (вырезается из комментария)
  agentModel: "claude-sonnet-5-5", // модель ассистента (если есть ключ Anthropic)
  aiProxy: "",   // общий доступ к Claude через Google-скрипт владельца (подставляется при сборке)
  aiProxyToken: "",
  assistantChat: false,
  webApp: "",                    // веб-приложение — только в личной версии          // чат с помощником и маршруты в Claude Code — пока только в личной версии
  briefs: { morning: "", evening: "" },
  monthlyReportNotification: true, // 1-го числа в 10:00 прислать уведомление с отчётом
  // Google Таблица с доходами и расходами (кнопка ▦). Пусто — кнопки нет
  sheetUrl: "",
  sheetSecret: "",
  sheetHook: "",
  // Еда, вода и активность с Apple Watch (кнопка 📷, параметр виджета «здоровье»)
  health: { waterGoal: 2000, glass: 250, moveGoal: 500, exerciseGoal: 30, weight: 80 },   // weight, кг — для оценки тренировок без часов
  large:  { today: 3, rows: 5 },   // до 3 событий сегодня; вместе с напоминаниями — 5 строк (строка дней выше: в ней названия)
  medium: { events: 3, reminders: 3, weekChips: 2 },
  // Календари, которые можно назвать голосом («в рабочий календарь»). Пусто — всё идёт в основной.
  // Пример: { calendar: "Работа", list: "Работа", hint: "«рабочий»", words: /(?:^|\s)(?:в|во|на)?\s*рабоч\S*\s+календар\S*(?=[\s,.]|$)/i },
  calendars: [],
  week: {
    daysBefore: 0,               // прошедшие дни не показываются: их события уже ушли из виджета
    daysFromToday: 7,            // сколько дней показывать начиная с сегодня
    colWidth: 57,                // ширина колонки дня (5 колонок в строке)
  },
  // Категории: [название, [слова для распознавания голосом]]
  categories: {
    expense: [
      ["Еда и продукты",   ["продукт", "еда", "супермаркет", "макро", "makro", "севен", "7-eleven", "севен-элевен", "лотус", "lotus", "биг си", "big c",
                            "топс", "tops", "фудленд", "foodland", "вилла маркет", "рынок", "фрукт", "овощ"]],
      ["Кафе и рестораны", ["кафе", "ресторан", "кофе", "обед", "ужин", "завтрак", "доставк", "фудпанда", "foodpanda", "лайнман", "lineman", "стритфуд", "макашниц"]],
      ["Транспорт",        ["такси", "грэб", "граб", "grab", "болт", "bolt", "бензин", "заправк", "bts", "бтс", "mrt", "метро", "автобус", "сонгтео", "тук-тук", "туктук",
                            "байк", "мото", "аренда байка", "парковк", "паром"]],
      ["Жильё",            ["аренд", "квартир", "кондо", "вилл", "коммунал", "электрич", "за свет", "за воду", "депозит"]],
      ["Связь и интернет", ["связь", "интернет", "телефон", "симк", "мобильн", "ais", "true", "тру ", "dtac", "дтак"]],
      ["Покупки",          ["одежд", "покупк", "шопинг", "техник", "обув", "лазад", "lazada", "шопи", "shopee", "тц ", "молл", "mall"]],
      ["Здоровье",         ["аптек", "врач", "лекарств", "больниц", "клиник", "стоматолог", "страховк"]],
      ["Красота и массаж", ["массаж", "спа", "spa", "стрижк", "барбер", "маникюр"]],
      ["Спорт",            ["спорт", "фитнес", "тренир", "бассейн", "падел", "тайский бокс", "муай тай", "йог"]],
      ["Визы и документы", ["виза", "визоран", "продлени", "иммиграц", "90 дней", "документ"]],
      ["Дети",             ["детск", "садик", "школ", "кружок", "секци", "игрушк"]],
      ["Развлечения",      ["кино", "клуб", "развлеч", "концерт", "экскурс"]],
      ["Путешествия",      ["отель", "билет", "перелёт", "перелет", "поездк", "остров"]],
      ["Подарки",          ["подар"]],
      ["Другое",           []],
    ],
    income: [
      ["Зарплата",          ["зарплат", "оклад", "аванс", "преми"]],
      ["Фриланс и проекты", ["фриланс", "заказ", "проект", "клиент", "подработ"]],
      ["Подарок",           ["подар"]],
      ["Возврат / кэшбэк",  ["возврат", "вернул", "кэшбэк", "кешбэк", "депозит вернули"]],
      ["Продажа",           ["продал", "продаж"]],
      ["Сдача жилья",       ["сдал", "арендатор", "квартплат"]],
      ["Другое",            []],
    ],
  },
}

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

const DAYS_DAT = ["воскресеньям", "понедельникам", "вторникам", "средам", "четвергам", "пятницам", "субботам"]

function recurLabel(r) {
  if (!r) return ""
  if (r.freq === "daily") return "каждый день"
  const d = (r.days || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  if (d.join() === "1,2,3,4,5") return "по будням"
  if (d.join() === "6,0") return "по выходным"
  return d.length ? "по " + d.map(x => DAYS_DAT[x]).join(" и ") : "каждую неделю"
}

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

const ORD_GEN = { первого: 1, второго: 2, третьего: 3, четвёртого: 4, четвертого: 4, пятого: 5, шестого: 6, седьмого: 7,
  восьмого: 8, девятого: 9, десятого: 10, одиннадцатого: 11, двенадцатого: 12 }

const ORD_RE = Object.keys(ORD_GEN).join("|")

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

function extractCalendar(text) {
  for (const c of CONFIG.calendars) {
    const m = (" " + text + " ").match(c.words)
    if (m) return { cal: c, text: (" " + text + " ").replace(m[0], " ").replace(/\s+/g, " ").trim() }
  }
  return { cal: null, text }
}

const CUR_RE = new RegExp(CONFIG.currencyWords, "gi")   // название валюты в речи — вырезается

return { ADD_TRIG, CONFIG, DAY, DAYS_DAT, DEL_TRIG, DM, EVENING_WORDS, EVT_TRIG, FULL, METHOD, MONTH_GEN, MONTH_NOM, NOTE_TRIG, NUM_MULT, NUM_SEQ, NUM_WORDS, ORD_GEN, ORD_RE, REM_TRIG, SHORT, STOP, TIME, TYPE, VOICE, WEEKDAYS, WHEN, WHEN_S, YMD, buildActions, buildMove, buildQuery, cap, catRows, classify, cleanText, dayLabel, describe, esc, extractCalendar, fmt, hasTrigger, isOverdue, lev, matchCategory, mergeSynced, money, moneyComment, moneyDate, monthKey, monthTitle, monthTotals, normalizeSpeech, parseMoney, parseWhen, plural, recurLabel, reminderTime, reportCSV, reportHTML, reportText, sameDay, splitCommands, startOfDay, titleMatches, visible, withIds, words }
})()
