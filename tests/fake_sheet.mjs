// Поддельная Google Таблица для скрипта src/sheet/Code.gs: doPost работает в Node как в Apps Script
import fs from "fs"
export function sheetScript() {
  const code = fs.readFileSync(new URL("../src/sheet/Code.gs", import.meta.url), "utf8").replace("__SHEET_SECRET__", "").replace("__CARD_SKIP__", "")
  const sheets = []
  class Sheet {
    constructor(name) { this.name = name; this.cells = []; this.formulas = {}; this.maxRows = 1000 }
    getName() { return this.name }
    getMaxRows() { return this.maxRows }
    getLastRow() { let n = 0; this.cells.forEach((r, i) => { if (r && r.some(v => v !== "" && v !== undefined)) n = i + 1 }); return n }
    getRange(r, c, nr = 1, nc = 1) {
      const sh = this, obj = {
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
    setFrozenRows() {} hideColumns() {} showColumns() {} setColumnWidth() {} hideSheet() {}
    getSheetId() { return sheets.indexOf(this) + 100 }
  }
  const ss = { getSheetByName: n => sheets.find(s => s.name === n) || null, insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s },
    getSheets: () => sheets, deleteSheet: s => sheets.splice(sheets.indexOf(s), 1), getName: () => "Мой день", getUrl: () => "https://docs.google.com/spreadsheets/d/T/edit",
    setActiveSheet: s => { ss.active = s }, moveActiveSheet: i => { sheets.splice(sheets.indexOf(ss.active), 1); sheets.splice(i - 1, 0, ss.active) },
    getSpreadsheetTimeZone: () => "Asia/Bangkok" }
  const props = {}
  const g = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v } }) },
    ContentService: { createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }), MimeType: { JSON: 1 } },
    UrlFetchApp: { fetch: () => ({ getContentText: () => JSON.stringify({ claude_code_session_url: "https://claude.ai/code/session_test" }) }) },
  }
  const gs = new Function(...Object.keys(g), code + "; return { doPost }")(...Object.values(g))
  return { ss, post: body => gs.doPost({ postData: { contents: typeof body === "string" ? body : JSON.stringify(body) } }) }
}
