// Поддельный Apps Script для общего сервера друзей (dist/Friends.gs): много таблиц, свойства, «пропуска» Google, Claude
import fs from "fs"
import os from "os"
import path from "path"
import crypto from "crypto"
import { execFileSync } from "child_process"
export const CLIENT = "123-test.apps.googleusercontent.com"
export function friendsServer(opt = {}) {
  const ROOT = new URL("..", import.meta.url).pathname
  const tmp = path.join(os.tmpdir(), "friends_" + process.pid + ".gs")
  execFileSync("python3", [path.join(ROOT, "build_friends.py"), tmp, CLIENT])
  const code = fs.readFileSync(tmp, "utf8")
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
        sort: () => obj,
      }
      for (const k of ["setFontWeight", "setBackground", "setFontColor", "setNumberFormat", "setFontSize", "merge", "setWrap"]) obj[k] = () => obj
      return obj
    }
    deleteRow(r) { this.cells.splice(r - 1, 1) }
    setFrozenRows() {} hideColumns() {} showColumns() {} setColumnWidth() {} hideSheet() { this.hidden = true } isSheetHidden() { return !!this.hidden }
    getLastColumn() { return this.cells.reduce((m, r) => Math.max(m, r ? r.length : 0), 0) }
    getSheetId() { return 100 }
  }
  const books = {}, trashed = [], cache = {}
  function book(name) {
    const id = "S" + (Object.keys(books).length + 1), sheets = [new Sheet("Лист1")]
    const ss = { name, tz: "Asia/Bangkok", getSheetByName: n => sheets.find(s => s.name === n) || null, insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s },
      getSheets: () => sheets, deleteSheet: s => sheets.splice(sheets.indexOf(s), 1), getName: () => name, getId: () => id, getUrl: () => "https://docs.google.com/spreadsheets/d/" + id,
      setActiveSheet: s => { ss.active = s }, moveActiveSheet: () => {}, getSpreadsheetTimeZone: () => ss.tz, setSpreadsheetTimeZone: z => { ss.tz = z } }
    books[id] = ss
    return ss
  }
  const props = {}, mails = [], aiCalls = [], pushes = []
  const tokens = {   // «пропуска» Google: настоящий проверяет tokeninfo, здесь — таблица
    ann: { aud: CLIENT, iss: "https://accounts.google.com", exp: String(Date.now() / 1000 + 3600 | 0), email_verified: "true", sub: "111", email: "Ann@example.com", name: "Аня", nonce: "n1" },
    bob: { aud: CLIENT, iss: "accounts.google.com", exp: String(Date.now() / 1000 + 3600 | 0), email_verified: "true", sub: "222", email: "bob@example.com", name: "Боб" },
    alien: { aud: "other-site", iss: "accounts.google.com", exp: String(Date.now() / 1000 + 3600 | 0), email_verified: "true", sub: "333", email: "x@example.com" },
    old: { aud: CLIENT, iss: "accounts.google.com", exp: String(Date.now() / 1000 - 10 | 0), email_verified: "true", sub: "444", email: "y@example.com" },
  }
  const tzFmt = (d, tz, f) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(d).map(x => [x.type, x.value]))
    const u = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday]
    return f.replace("yyyy", p.year).replace("MM", p.month).replace("dd", p.day).replace("HH", p.hour).replace("mm", p.minute).replace("ss", p.second).replace("'T'", "T").replace("'Z'", "Z").replace(/^H$/, String(+p.hour)).replace(/^u$/, String(u))
  }
  const g = {
    SpreadsheetApp: { create: n => book(n), openById: id => { if (!books[id]) throw new Error("нет таблицы"); return books[id] } },
    DriveApp: { createFolder: n => ({ getId: () => "FOLDER" }), getFolderById: () => ({}), getFileById: id => ({ moveTo: () => {}, setTrashed: v => { if (v) { trashed.push(id); delete books[id] } } }) },
    MailApp: { sendEmail: (...a) => mails.push(a) },
    Session: { getEffectiveUser: () => ({ getEmail: () => "owner@example.com" }) },
    Logger: { log: () => {} },
    Maps: {},
    Utilities: {
      formatDate: tzFmt,
      parseDate: (s, tz) => { const [d, t] = s.split(" "); const guess = new Date(d + "T" + t + ":00Z"); const off = new Date(tzFmt(guess, tz, "yyyy-MM-ddTHH:mm") + ":00Z") - guess; return new Date(+guess - off) },
      getUuid: () => crypto.randomUUID(),
      computeDigest: (alg, s) => [...crypto.createHash("sha256").update(String(s)).digest()].map(b => b > 127 ? b - 256 : b),
      DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 },
    },
    CacheService: { getScriptCache: () => ({ get: k => { const v = cache[k]; return v && v.exp > Date.now() ? v.v : null }, put: (k, v, sec) => { cache[k] = { v: String(v), exp: Date.now() + (sec || 600) * 1000 } }, remove: k => { delete cache[k] } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true }, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v) }, deleteProperty: k => { delete props[k] }, getKeys: () => Object.keys(props) }) },
    ContentService: { createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }), MimeType: { JSON: 1 } },
    ScriptApp: { getProjectTriggers: () => [{ getHandlerFunction: () => "pushTick" }], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create() {} }) }) }) },
    UrlFetchApp: { fetchAll: reqs => reqs.map(q => g.UrlFetchApp.fetch(q.url, q)), fetch: (url, o = {}) => {
      if (opt.google) { const r = opt.google(url, o); if (r) return { getResponseCode: () => r.code || 200, getContentText: () => r.body == null ? "" : typeof r.body === "string" ? r.body : JSON.stringify(r.body) } }
      if (/tokeninfo/.test(url)) { const k = decodeURIComponent(url.split("id_token=")[1]); const t = tokens[k]
        return { getResponseCode: () => t ? 200 : 400, getContentText: () => JSON.stringify(t || { error: "invalid_token" }) } }
      if (/anthropic/.test(url)) { aiCalls.push({ key: o.headers["x-api-key"], body: JSON.parse(o.payload) }); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ type: "text", text: "Привет!" }] }) } }
      pushes.push(url); return { getResponseCode: () => 201, getContentText: () => "" }
    } },
  }
  const gs = new Function(...Object.keys(g), code + "; return { doPost, doGet, pushTick, cal_, FR }")(...Object.values(g))
  const post = b => gs.doPost({ postData: { contents: JSON.stringify(b) } })
  return { code, gs, post, cache, books, props, mails, aiCalls, pushes, tokens, tzFmt, trashed }
}
