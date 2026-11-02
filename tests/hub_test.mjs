// Связь виджета и веб-приложения через таблицу (hub_ в Code.gs): списки, снимок iPhone, очередь команд, рутины
import fs from "fs"
const code = fs.readFileSync(new URL("../src/sheet/Code.gs", import.meta.url), "utf8").replace("__SHEET_SECRET__", "").replace("__CARD_SKIP__", "")
class Sheet {
  constructor(name) { this.name = name; this.cells = []; this.formulas = {}; this.maxRows = 1000 }
  getName() { return this.name }
  getMaxRows() { return this.maxRows }
  getLastRow() { let n = 0; this.cells.forEach((r, i) => { if (r && r.some(v => v !== "" && v !== undefined)) n = i + 1 }); return n }
  getRange(r, c, nr = 1, nc = 1) {
    const sh = this, obj = {
      // как в настоящей таблице: строка «=…» становится формулой, строка из цифр — числом
      getDisplayValues: () => obj.getValues().map(r => r.map(v => v instanceof Date ? v.toISOString() : String(v))),
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (sh.cells[r - 1 + i] || [])[c - 1 + j] ?? "")),
      setValues: v => { v.forEach((row, i) => row.forEach((x, j) => { (sh.cells[r - 1 + i] ||= [])[c - 1 + j] = typeof x === "string" && /^=/.test(x) ? "#ERROR!" : typeof x === "string" && /^\d+$/.test(x) ? +x : x })); return obj },
      setValue: x => obj.setValues([[x]]),
      setFormula: f => { sh.formulas[`${r},${c}`] = f; return obj },
      sort: ({ column }) => { const rows = obj.getValues(); rows.sort((a, b) => +a[column - c] - +b[column - c]); obj.setValues(rows); return obj },
    }
    for (const k of ["setFontWeight", "setBackground", "setFontColor", "setNumberFormat", "setFontSize", "merge", "setWrap"]) obj[k] = () => obj
    return obj
  }
  deleteRow(r) { this.cells.splice(r - 1, 1) }
  setFrozenRows() {} hideColumns() {} showColumns() {} setColumnWidth() {} hideSheet() { this.hidden = true } isSheetHidden() { return !!this.hidden }
  getLastColumn() { return this.cells.reduce((m, r) => Math.max(m, r ? r.length : 0), 0) }
  getSheetId() { return sheets.indexOf(this) + 100 }
}
const sheets = [new Sheet("Лист1")]
const ss = { getSheetByName: n => sheets.find(s => s.name === n) || null, insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s },
  getSheets: () => sheets, deleteSheet: s => sheets.splice(sheets.indexOf(s), 1), getName: () => "Мой день", getUrl: () => "https://docs.google.com/spreadsheets/d/T/edit",
  setActiveSheet: s => { ss.active = s }, moveActiveSheet: i => { sheets.splice(sheets.indexOf(ss.active), 1); sheets.splice(i - 1, 0, ss.active) },
  getSpreadsheetTimeZone: () => "Asia/Bangkok" }
const props = {}, fetched = [], overpassQ = []
const g = {
  Maps: { DirectionFinder: { Mode: { DRIVING: "driving", WALKING: "walking", TRANSIT: "transit" } },
    newDirectionFinder: () => { const f = { o: null, d: null, setLanguage: () => f, setMode: m => (f.m = m, f), setDepart: () => f,
      setOrigin: (...a) => (f.o = a, f), setDestination: (...a) => (f.d = a, f),
      getDirections: () => (globalThis.__mapsCalls = (globalThis.__mapsCalls || []).concat([{ o: f.o, d: f.d, m: f.m }]), { status: "OK", routes: [{ legs: [{ duration: { value: 1500 }, distance: { value: 12345 },
        duration_in_traffic: { value: 1860 }, start_address: "Сукхумвит", end_address: "Decathlon Rama 4" }] }] }) }; return f },
    newGeocoder: () => { const gc = { setLanguage: () => gc, setBounds: () => gc, setRegion: () => gc,
      geocode: q => ({ status: "OK", results: /нигде/.test(q) ? [] : [{ formatted_address: "Decathlon Rama 4", geometry: { location: { lat: 13.72, lng: 100.55 } } },
        { formatted_address: "Decathlon Chiang Mai", geometry: { location: { lat: 18.79, lng: 98.98 } } }] }) }; return gc } },
  SpreadsheetApp: { getActiveSpreadsheet: () => ss },
  Utilities: { formatDate: (d, tz, f) => { const z = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}` } },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v } }) },
  ContentService: { createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }), MimeType: { JSON: 1 } },
  UrlFetchApp: { fetch: (url, o) => {
    if (/overpass/.test(url)) { overpassQ.push(o.payload.data); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ elements: /Decathlon/.test(o.payload.data) ? [
      { type: "node", lat: 13.7201, lon: 100.5502, tags: { name: "Decathlon", branch: "Rama 4", shop: "sports", "addr:street": "Rama IV Rd" } },
      { type: "way", center: { lat: 13.7202, lon: 100.5503 }, tags: { name: "Decathlon", shop: "sports" } },
      { type: "node", lat: 13.6683, lon: 100.6347, tags: { brand: "Decathlon", name: "Decathlon Bangna", shop: "sports" } },
      { type: "node", lat: 13.70, lon: 100.50, tags: { name: "Decathlon street" } }] : [] }) } }
    if (/nominatim/.test(url)) return { getResponseCode: () => 200, getContentText: () => "[]" }
    fetched.push({ url, o }); return { getContentText: () => JSON.stringify({ claude_code_session_url: "https://claude.ai/code/session_x" }) } } },
}
const gs = new Function(...Object.keys(g), code + "; return { doPost }")(...Object.values(g))
let fail = 0
const check = (name, ok, got) => { console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + JSON.stringify(got)}`); if (!ok) fail++ }
const KEY = "k".repeat(32)
const hub = h => gs.doPost({ postData: { contents: JSON.stringify({ secret: KEY, hub: h }) } })
const now = Date.now()

// виджет присылает всё, что у него есть, и снимок iPhone
let w = hub({ from: "widget", since: 0,
  lists: { money: [{ id: "f1", date: now, u: now, type: "expense", amount: 300, method: "cash", category: "Транспорт", comment: "такси" }],
           water: [{ id: "w1", date: now, u: now, ml: 250 }], food: [], workouts: [] },
  snap: { events: [{ id: "E1", title: "Падел", start: "2026-11-01T19:00", end: "2026-11-01T21:00" }], reminders: [{ id: "R1", title: "Купить цветы" }] } })
check("виджет: принято, ответ с временем таблицы", w.ok && w.now >= now && w.lists.money.length === 1, w)
check("деньги виджета попали в «Операции»", ss.getSheetByName("Операции").getLastRow() === 2)
check("лист _hub скрыт", ss.getSheetByName("_hub").hidden === true)

// приложение: первый запрос получает всё и снимок
let a = hub({ from: "app", since: 0, snapAt: 0 })
check("приложение получает списки и снимок", a.lists.money.length === 1 && a.lists.water.length === 1 && a.snap && a.snap.events[0].title === "Падел", a)
const since = a.now, snapAt = a.snap.at
// приложение добавляет расход и воду, удаляет воду виджета, ставит команды для iPhone
a = hub({ from: "app", since, snapAt,
  lists: { money: [{ id: "fA", date: now + 5, u: now + 5, type: "expense", amount: 1500, method: "transfer", category: "Кафе и рестораны", comment: "=HYPERLINK(1)" }],
           water: [{ id: "w1", deleted: true, u: now + 10 }] },
  ops: [{ id: "op1", tool: "create_event", input: { title: "Стоматолог", start: "2026-11-03T15:00", end: "2026-11-03T16:00" } },
        { id: "op2", tool: "update_reminder", input: { id: "R1", completed: true } }] })
check("снимок не присылается повторно", !a.snap, a.snap)
check("свои изменения возвращаются (с s), старое — нет", a.lists.money.length === 1 && a.lists.money[0].id === "fA" && a.lists.water[0].deleted, a.lists)
check("расход приложения в «Операции», вода удалена", ss.getSheetByName("Операции").getLastRow() === 3 && ss.getSheetByName("Вода").getLastRow() === 1)
check("очередь: обе команды ждут", a.ops.length === 2 && a.ops.every(o => o.state === "new"), a.ops)
// повтор той же команды (приложение не дождалось ответа) не дублирует её
hub({ from: "app", since: a.now, snapAt, ops: [{ id: "op1", tool: "create_event", input: {} }] })

// виджет: получает изменения и команды
w = hub({ from: "widget", since: w.now })
check("виджет получает расход приложения и удаление воды", w.lists.money.some(x => x.id === "fA") && w.lists.water.some(x => x.id === "w1" && x.deleted), w.lists)
check("виджет получает 2 команды", w.ops.length === 2 && w.ops[0].tool === "create_event", w.ops)
// старая версия записи с другого устройства не затирает новую
hub({ from: "widget", lists: { money: [{ id: "fA", date: now, u: now, type: "expense", amount: 1, method: "cash", category: "Другое" }] } })
a = hub({ from: "app", since: 0 })
check("старое u не побеждает", a.lists.money.find(x => x.id === "fA").amount === 1500)
// виджет выполнил команды и прислал новый снимок
w = hub({ from: "widget", since: w.now, done: [{ id: "op1", result: { ok: true } }, { id: "op2", result: { ok: true } }],
  snap: { events: [{ id: "E2", title: "Стоматолог", start: "2026-11-03T15:00", end: "2026-11-03T16:00" }], reminders: [] } })
check("у виджета очередь пуста", w.ops.length === 0, w.ops)
a = hub({ from: "app", since: a.now, snapAt })
check("приложение видит выполненные команды и новый снимок", a.ops.length === 2 && a.ops.every(o => o.state === "done" && o.result.ok) && a.snap.events[0].id === "E2", a)

// большие списки: делятся на куски по ячейкам и читаются обратно (в т.ч. кусок, начинающийся с «=» или из цифр)
const many = Array.from({ length: 1500 }, (_, i) => ({ id: "fX" + i, date: now - i * 1000, u: now + 100, type: "expense", amount: 1000 + i, method: "cash", category: "Другое", comment: "=1+1 " + "x".repeat(i % 40) }))
hub({ from: "app", lists: { money: many } })
a = hub({ from: "app", since: 0 })
const rowHub = ss.getSheetByName("_hub").cells.find(r => r[0] === "money")
check("большой список в нескольких ячейках читается целиком", rowHub[1] > 1 && a.lists.money.length === 1502, { parts: rowHub[1], n: a.lists.money.length })

// задача в Claude Code: только адрес рутины Anthropic
a = hub({ from: "app", fire: { url: "https://api.anthropic.com/v1/claude_code/routines/trig_abc/fire", token: "t", text: "сделай" } })
check("рутина запущена, ссылка на сессию", a.fire && a.fire.session_url === "https://claude.ai/code/session_x" && fetched[0].o.headers.Authorization === "Bearer t", a.fire)
a = hub({ from: "app", fire: { url: "https://evil.example/fire", token: "t", text: "x" } })
check("чужой адрес не вызывается", !a.fire && fetched.length === 1)
// чтение листов для помощника
a = hub({ from: "app", read: {} })
check("список листов без скрытого _hub", a.read && a.read.sheets.some(x => x.name === "Операции" && x.head.includes("Сумма")) && !a.read.sheets.some(x => x.name === "_hub"), a.read)
a = hub({ from: "app", read: { sheet: "операции", limit: 5 } })
check("строки листа: последние limit, даты строкой", a.read.rows.length === 5 && a.read.total > 5 && /^\d{4}-\d{2}-\d{2}/.test(a.read.rows[0][0]), a.read && a.read.rows && a.read.rows[0])
a = hub({ from: "app", read: { sheet: "Нет такого" } })
check("неизвестный лист — ошибка и список", a.read.error && a.read.sheets.includes("Операции"))
// Карты: дорога и поиск места
a = hub({ from: "app", route: { from: { lat: 13.75, lng: 100.5 }, to: { lat: 13.72, lng: 100.55 }, mode: "driving" } })
check("маршрут: минуты, км, с пробками", a.route && a.route.minutes === 25 && a.route.km === 12.3 && a.route.minutes_in_traffic === 31, a.route)
a = hub({ from: "app", geo: { query: "Decathlon", near: { lat: 13.75, lng: 100.5 } } })
check("поиск сети по OpenStreetMap: два филиала, без дублей и без «улицы»", a.geo && a.geo.source === "osm" && a.geo.results.length === 2 && /Rama 4/.test(a.geo.results[0].name), a.geo)
check("запрос к карте без спецсимволов", overpassQ.at(-1).includes('"name"~"Decathlon",i') && /around:40000,13.75,100.5/.test(overpassQ.at(-1)), overpassQ.at(-1))
a = hub({ from: "app", geo: { query: "Аэропорт (Суварнабхуми)", near: { lat: 13.75, lng: 100.5 } } })
check("не нашлось на карте — Геокодер Google", a.geo.source === "google" && a.geo.results.length === 2 && !/[()]/.test(overpassQ.at(-1).match(/~"[^"]*"/)[0]), a.geo)
check("без ключа — отказ", gs.doPost({ postData: { contents: JSON.stringify({ secret: "x".repeat(32), hub: { from: "app" } }) } }).error === "forbidden")
console.log(fail ? `\n✗ ошибок: ${fail}` : "\nВсё в порядке")
process.exit(fail ? 1 : 0)
