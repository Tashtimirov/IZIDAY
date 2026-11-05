// Поддельная Google Таблица для скрипта src/sheet/Code.gs: doPost работает в Node как в Apps Script
import fs from "fs"
import crypto from "crypto"
const sbytes = buf => [...buf].map(b => b > 127 ? b - 256 : b)   // как byte[] в Apps Script
// Почта: две цепочки; отправленное и действия складываются в mail.log
function fakeMail() {
  const log = []
  const msg = (id, from, subject, body, date) => ({ getId: () => id, getFrom: () => from, getTo: () => "me@example.com", getCc: () => "", getDate: () => new Date(date),
    getSubject: () => subject, getPlainBody: () => body, getAttachments: () => [], reply: b => log.push(["reply", id, b]), replyAll: b => log.push(["replyAll", id, b]),
    createDraftReply: b => (log.push(["draftReply", id, b]), { getId: () => "d1" }), star: () => log.push(["star", id]), unstar: () => {} })
  const th = (id, ms) => ({ getId: () => id, getMessages: () => ms, getFirstMessageSubject: () => ms[0].getSubject(), getLastMessageDate: () => ms.at(-1).getDate(),
    isUnread: () => true, hasStarredMessages: () => false, getLabels: () => [], moveToArchive: () => log.push(["archive", id]), moveToTrash: () => log.push(["trash", id]),
    markRead: () => log.push(["read", id]), markUnread: () => {}, moveToInbox: () => {}, moveToSpam: () => {}, addLabel: () => {}, removeLabel: () => {} })
  const threads = [th("T1", [msg("M1", "Landlord <rent@condo.th>", "Аренда за ноябрь", "Здравствуйте! Оплата аренды 25 000 THB до 5 ноября.", Date.now() - 3600e3)]),
    th("T2", [msg("M2", "Shop <promo@shop.com>", "Скидки", "Распродажа", Date.now() - 7200e3)])]
  const api = { search: (q, s, n) => (log.push(["search", q]), threads.filter(t => !/аренд|rent/i.test(q) || t.getId() === "T1").slice(0, n)),
    getThreadById: id => threads.find(t => t.getId() === id) || null, sendEmail: (to, subj, body, o) => log.push(["send", to, subj, body, o]),
    createDraft: (to, subj, body) => (log.push(["draft", to, subj, body]), { getId: () => "d2" }), getUserLabelByName: () => null, createLabel: n => ({ n }),
    getUserLabels: () => [], getInboxUnreadCount: () => 2 }
  return { api, log }
}
// Google Календарь: один календарь, события в памяти
function fakeCal() {
  const events = [], log = []
  const mk = (title, s, e, opt = {}, all = false, rec = null) => {
    const ev = { id: "G" + (events.length + 1), title, s, e, all, loc: opt.location || "", desc: opt.description || "", rec }
    const o = { getId: () => ev.id, getTitle: () => ev.title, getStartTime: () => ev.s, getEndTime: () => ev.e, isAllDayEvent: () => ev.all, getLocation: () => ev.loc,
      getDescription: () => ev.desc, getOriginalCalendarId: () => "primary", isRecurringEvent: () => !!ev.rec,
      setTitle: t => { ev.title = t; log.push(["title", ev.id, t]) }, setLocation: l => { ev.loc = l }, setDescription: d => { ev.desc = d },
      setTime: (s2, e2) => { ev.s = s2; ev.e = e2; log.push(["move", ev.id, s2]) }, setAllDayDate: d => { ev.s = d },
      deleteEvent: () => { events.splice(events.indexOf(o), 1); log.push(["delete", ev.id]) }, getEventSeries: () => ({ deleteEventSeries: () => o.deleteEvent() }) }
    events.push(o); log.push(["create", ev.id, title]); return o
  }
  const k = { getId: () => "primary", getName: () => "Ильдар", isHidden: () => false, isOwnedByMe: () => true,
    getEvents: (f, t) => events.filter(e => e.getStartTime() < t && e.getEndTime() > f), getEventById: id => events.find(e => e.getId() === id) || null,
    createEvent: (t, s, e, o) => mk(t, s, e, o), createAllDayEvent: (t, s, e, o) => mk(t, s, e, o, true),
    createEventSeries: (t, s, e, r, o) => mk(t, s, e, o, false, r), createAllDayEventSeries: (t, s, r, o) => mk(t, s, new Date(+s + 864e5), o, true, r) }
  const rule = { onlyOnWeekdays: () => rule }
  const self = { off: false }
  const api = { getAllCalendars: () => { if (self.off) throw new Error("нет разрешения на Календарь"); return [k] }, getDefaultCalendar: () => k, getCalendarById: () => k,
    newRecurrence: () => ({ addDailyRule: () => rule, addWeeklyRule: () => rule, addMonthlyRule: () => rule, addYearlyRule: () => rule }),
    Weekday: { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 0 } }
  return Object.assign(self, { api, events, log, mk })
}
export function sheetScript() {
  const mail = fakeMail(), cal = fakeCal()
  const code = fs.readFileSync(new URL("../src/sheet/Code.gs", import.meta.url), "utf8").replace("__SHEET_SECRET__", "").replace("__CARD_SKIP__", "")
  const sheets = []
  class Sheet {
    constructor(name) { this.name = name; this.cells = []; this.formulas = {}; this.maxRows = 1000 }
    getName() { return this.name }
    getMaxRows() { return this.maxRows }
    getLastRow() { let n = 0; this.cells.forEach((r, i) => { if (r && r.some(v => v !== "" && v !== undefined)) n = i + 1 }); return n }
    getRange(r, c, nr = 1, nc = 1) {
      const sh = this, obj = {
        getDisplayValues: () => obj.getValues().map(r => r.map(v => v instanceof Date ? v.toISOString() : String(v))),
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (sh.cells[r - 1 + i] || [])[c - 1 + j] ?? "")),
        setValues: v => { v.forEach((row, i) => row.forEach((x, j) => { (sh.cells[r - 1 + i] ||= [])[c - 1 + j] = x })); return obj },
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
  const ss = { getSheetByName: n => sheets.find(s => s.name === n) || null, insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s },
    getSheets: () => sheets, deleteSheet: s => sheets.splice(sheets.indexOf(s), 1), getName: () => "Мой день", getUrl: () => "https://docs.google.com/spreadsheets/d/T/edit",
    setActiveSheet: s => { ss.active = s }, moveActiveSheet: i => { sheets.splice(sheets.indexOf(ss.active), 1); sheets.splice(i - 1, 0, ss.active) },
    getSpreadsheetTimeZone: () => "Asia/Bangkok" }
  const props = {}, triggers = [], pushes = []
  const g = {
    Maps: { DirectionFinder: { Mode: { DRIVING: "driving", WALKING: "walking", TRANSIT: "transit" } },
    newDirectionFinder: () => { const f = { o: null, d: null, setLanguage: () => f, setMode: m => (f.m = m, f), setDepart: () => f,
      setOrigin: (...a) => (f.o = a, f), setDestination: (...a) => (f.d = a, f),
      getDirections: () => (globalThis.__mapsCalls = (globalThis.__mapsCalls || []).concat([{ o: f.o, d: f.d, m: f.m }]), { status: "OK", routes: [{ legs: [{ duration: { value: 1500 }, distance: { value: 12345 },
        duration_in_traffic: { value: 1860 }, start_address: "Сукхумвит", end_address: "Decathlon Rama 4" }] }] }) }; return f },
    newGeocoder: () => { const gc = { setLanguage: () => gc, setBounds: () => gc, setRegion: () => gc,
      reverseGeocode: (lat, lng) => ({ status: "OK", results: [{ formatted_address: `Central World, Rama I Rd (${lat}, ${lng})` }] }),
      geocode: q => ({ status: "OK", results: /нигде/.test(q) ? [] : [{ formatted_address: "Decathlon Rama 4", geometry: { location: { lat: 13.72, lng: 100.55 } } },
        { formatted_address: "Decathlon Chiang Mai", geometry: { location: { lat: 18.79, lng: 98.98 } } }] }) }; return gc } },
  SpreadsheetApp: { getActiveSpreadsheet: () => ss },
  Utilities: {
    DigestAlgorithm: { SHA_256: "sha256" }, Charset: { UTF_8: "utf8" },
    computeDigest: (alg, v) => sbytes(crypto.createHash(alg).update(typeof v === "string" ? Buffer.from(v, "utf8") : Buffer.from(v.map(b => b & 255))).digest()),
    base64EncodeWebSafe: b => Buffer.from(b.map(x => x & 255)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_"),
    getUuid: () => crypto.randomUUID(),
    newBlob: s => ({ getBytes: () => sbytes(Buffer.from(s, "utf8")) }),
    formatDate: (d, tz, f) => { const z = n => String(n).padStart(2, "0"), day = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`, t = `${z(d.getHours())}:${z(d.getMinutes())}`
      if (f === "yyyyMMdd") return day.replace(/-/g, "")
      if (f === "yyyyMMdd'T'HHmmss'Z'") return d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "")
      if (f === "HH:mm") return t
      if (f === "H") return String(d.getHours())
      if (f === "u") return String(((d.getDay() + 6) % 7) + 1)
      return f === "yyyy-MM-dd" ? day : f === "yyyy-MM-dd'T'HH:mm" ? `${day}T${t}` : `${day} ${t}` },
    parseDate: (s, tz, f) => { const m = s.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/); return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) } },
  CalendarApp: cal.api,
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true }, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v } }) },
    ContentService: { createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }), MimeType: { JSON: 1 } },
    ScriptApp: { getOAuthToken: () => "tok", getProjectTriggers: () => triggers,
      newTrigger: fn => { const t = { fn, getHandlerFunction: () => fn }; const b = { timeBased: () => b, everyMinutes: m => { t.every = m; return b }, create: () => { triggers.push(t); return t } }; return b } },
    // API Календаря (обрезка серии): GET по iCalUID — главное событие с правилом, PATCH — новое правило
    UrlFetchApp: { fetch: (url, o = {}) => {
      if (/googleapis\.com\/calendar/.test(url)) {
        const m = url.match(/iCalUID=([^&]+)/), ev = m && cal.events.find(x => x.getId() === decodeURIComponent(m[1]))
        if (m) return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ items: ev ? [{ id: "M" + ev.getId(), start: ev.isAllDayEvent() ? { date: "x" } : { dateTime: ev.getStartTime().toISOString() }, recurrence: ["RRULE:FREQ=WEEKLY;COUNT=20"] }] : [] }) }
        cal.log.push(["cut", url.split("/").pop(), JSON.parse(o.payload).recurrence[0]])
        return { getResponseCode: () => 200, getContentText: () => "{}" }
      }
      if (/api\.anthropic\.com\/v1\/messages/.test(url)) { const b = JSON.parse(o.payload); globalThis.__famAsk = { key: o.headers["x-api-key"], body: b }; return { getContentText: () => JSON.stringify({ content: [{ type: "text", text: "Привет! Давай начнём с зубов — это быстро." }] }) } }
      if (/push\.example/.test(url)) { pushes.push({ url, headers: o.headers }); return { getResponseCode: () => /gone/.test(url) ? 410 : 201, getContentText: () => "" } }
      return { getContentText: () => JSON.stringify({ claude_code_session_url: "https://claude.ai/code/session_test" }) } } },
    GmailApp: mail.api,
  }
  const gs = new Function(...Object.keys(g), code + "; return { doPost, pushTick: typeof pushTick === 'function' ? pushTick : null }")(...Object.values(g))
  return { ss, mail, cal, props, triggers, pushes, pushTick: gs.pushTick, post: body => gs.doPost({ postData: { contents: typeof body === "string" ? body : JSON.stringify(body) } }) }
}
