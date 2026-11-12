// Запросы помощника к таблице (дорога, место, календарь, почта, чтение листа) без обмена списками — без общего замка и без чтения всех списков. Провал — TOOLFAST_FAIL
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
  getSheets: () => sheets, deleteSheet: s => sheets.splice(sheets.indexOf(s), 1), getName: () => "Мой день", getId: () => "SHEETID", getUrl: () => "https://docs.google.com/spreadsheets/d/T/edit",
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
  LockService: { getScriptLock: () => ({ waitLock() { globalThis.__locks = (globalThis.__locks || 0) + 1 }, releaseLock() {} }) },
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
const locks = () => globalThis.__locks || 0
hub({ from: "app", lists: { money: [{ id: "m1", date: Date.now(), u: Date.now(), type: "expense", amount: 5, method: "cash", category: "Другое" }] } })
let l0 = locks()
const r = hub({ from: "app", since: 9e15, snapAt: 9e15, route: { from: { lat: 13.7, lng: 100.5 }, to: "Decathlon", mode: "driving" } })
check("дорога: ответ есть", r.ok && r.route && r.route.minutes === 25, r)
check("дорога: без замка", locks() === l0, locks() - l0)
check("дорога: списки не читались и не пришли", r.lists && !Object.keys(r.lists).length && !r.ops && !r.snap, r)
l0 = locks()
const g2 = hub({ from: "app", since: 9e15, snapAt: 9e15, geo: { query: "Decathlon", near: { lat: 13.72, lng: 100.55 }, km: 40 } })
check("место: без замка, результат есть", locks() === l0 && g2.geo && (g2.geo.results || []).length > 0, g2)
l0 = locks()
const s = hub({ from: "app", since: 0, snapAt: 0, lists: {} })
check("обмен по-прежнему под замком и со списками", locks() === l0 + 1 && s.lists.money.some(x => x.id === "m1"), s.lists)
l0 = locks()
hub({ from: "app", fire: { url: "https://api.anthropic.com/v1/claude_code/routines/trig_abc/fire", token: "t", text: "x" }, since: 9e15 })
check("задача в Claude Code — под замком (пишет в _hub)", locks() === l0 + 1)
l0 = locks()
hub({ from: "app", route: { from: { lat: 1, lng: 1 }, to: "x" } })
check("старое приложение (без since) — как раньше, под замком", locks() === l0 + 1)
console.log(fail ? "TOOLFAST_FAIL " + fail : "TOOLFAST_OK"); process.exit(fail ? 1 : 0)
