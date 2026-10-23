// Скрипт таблицы (dist/Code-RU.gs) на поддельной таблице: листы создаются, записи не дублируются, ключ запоминается
import fs from "fs"
const code = fs.readFileSync(new URL("../dist/Code-RU.gs", import.meta.url), "utf8")
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
    for (const k of ["setFontWeight", "setBackground", "setFontColor", "setNumberFormat", "setFontSize"]) obj[k] = () => obj
    return obj
  }
  deleteRow(r) { this.cells.splice(r - 1, 1) }
  setFrozenRows() {} hideColumns() {} showColumns() {}
}
const sheets = [new Sheet("Лист1")]
const ss = { getSheetByName: n => sheets.find(s => s.name === n) || null, insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s },
  getSheets: () => sheets, deleteSheet: s => sheets.splice(sheets.indexOf(s), 1), getName: () => "Мой день", getUrl: () => "https://docs.google.com/spreadsheets/d/T/edit" }
const props = {}
const g = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ss },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v } }) },
  ContentService: { createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }), MimeType: { JSON: 1 } },
}
const gs = new Function(...Object.keys(g), code + "; return { doPost, doGet }")(...Object.values(g))
let fail = 0
const check = (name, ok, got) => { console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + JSON.stringify(got)}`); if (!ok) fail++ }
const post = b => gs.doPost({ postData: { contents: JSON.stringify(b) } })
const KEY = "k".repeat(32)
const t = new Date(2026, 9, 23, 12).getTime()
const body = { secret: KEY, deleted: [],
  entries: [{ id: "f1", date: t, type: "expense", amount: 500, method: "transfer", category: "Еда и продукты", comment: "Пятёрочка" }],
  food: [{ id: "m1", date: t, title: "Плов", kcal: 650, protein: 20, fat: 25, carbs: 80 }],
  water: [{ id: "w1", date: t, ml: 250 }, { id: "w2", date: t + 1000, ml: 300 }],
  health: [{ day: "2026-10-23", updated: t, steps: 7500, active: 410 }] }
let r = post(body)
check("первая запись", r.ok && r.added === 4 && r.url, r)
check("листы созданы, пустой Лист1 удалён", ["Операции", "Еда", "Вода", "Активность", "Итоги: еда", "Итоги: активность", "Итоги: вода", "Итоги: деньги"]
  .every(n => ss.getSheetByName(n)) && !ss.getSheetByName("Лист1"), sheets.map(s => s.name))
check("ключ запомнен", props.secret === KEY)
check("чужой ключ — отказ", post(Object.assign({}, body, { secret: "x".repeat(32) })).error === "forbidden")
r = post(body)
check("повтор не дублирует", r.added === 0 && ss.getSheetByName("Вода").getLastRow() === 3, r)
post(Object.assign({}, body, { health: [{ day: "2026-10-23", updated: t + 5000, steps: 9000, active: 520 }] }))
const act = ss.getSheetByName("Активность")
check("активность за день обновляется, а не дублируется", act.getLastRow() === 2 && act.cells[1][1] === 9000 && act.cells[1][2] === 520, act.cells)
r = post(Object.assign({}, body, { water: [body.water[0]], deleted: ["w2"] }))
check("удалённое убирается", r.removed === 1 && ss.getSheetByName("Вода").getLastRow() === 2, r)
check("итоги — формулы", Object.values(ss.getSheetByName("Итоги: деньги").formulas).length === 4 &&
  Object.values(ss.getSheetByName("Итоги: еда").formulas).every(f => f.startsWith("=QUERY(")))
console.log(fail ? `GS_FAIL ${fail}` : "GS_OK")
process.exit(fail ? 1 : 0)
