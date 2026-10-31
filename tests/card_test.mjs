// Расходы по карте: скрипт таблицы разбирает письма Bangkok Bank, виджет добавляет расходы и спрашивает про дубли
import fs from "fs"
let fail = 0
const check = (name, ok, got) => { console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + JSON.stringify(got)}`); if (!ok) fail++ }

// ── Скрипт таблицы на поддельной таблице и почте ──
const code = fs.readFileSync(new URL("../dist/Code-RU.gs", import.meta.url), "utf8").replace('const CARD_SKIP = "";', 'const CARD_SKIP = "TASHTIMIROV";')
class Sheet {
  constructor(name) { this.name = name; this.cells = []; this.maxRows = 1000 }
  getName() { return this.name }
  getMaxRows() { return this.maxRows }
  getLastRow() { let n = 0; this.cells.forEach((r, i) => { if (r && r.some(v => v !== "" && v !== undefined)) n = i + 1 }); return n }
  getRange(r, c, nr = 1, nc = 1) {
    const sh = this, obj = {
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (sh.cells[r - 1 + i] || [])[c - 1 + j] ?? "")),
      setValues: v => { v.forEach((row, i) => row.forEach((x, j) => { (sh.cells[r - 1 + i] ||= [])[c - 1 + j] = x })); return obj },
      setValue: x => obj.setValues([[x]]),
      setFormula: () => obj,
      sort: ({ column }) => { const rows = obj.getValues(); rows.sort((a, b) => +a[column - c] - +b[column - c]); obj.setValues(rows); return obj },
    }
    for (const k of ["setFontWeight", "setBackground", "setFontColor", "setNumberFormat", "setFontSize", "merge", "setWrap"]) obj[k] = () => obj
    return obj
  }
  deleteRow(r) { this.cells.splice(r - 1, 1) }
  setFrozenRows() {} hideColumns() {} setColumnWidth() {}
  getSheetId() { return sheets.indexOf(this) + 100 }
}
const sheets = [new Sheet("Лист1")]
const ss = { getSheetByName: n => sheets.find(s => s.name === n) || null, insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s },
  getSheets: () => sheets, deleteSheet: s => sheets.splice(sheets.indexOf(s), 1), getUrl: () => "https://docs.google.com/spreadsheets/d/T/edit",
  setActiveSheet: s => { ss.active = s }, moveActiveSheet: () => {}, getSpreadsheetTimeZone: () => "Asia/Bangkok" }
const props = {}, triggers = [], searches = []
// письма — как их отдаёт Gmail (англ. половина письма, ячейки таблицы)
const mail = (id, at, subject, rows, from = "BualuangmBanking@bangkokbank.com") => ({ getId: () => id, getFrom: () => from, getDate: () => new Date(at), getSubject: () => subject, getPlainBody: () => "",
  getBody: () => `<p>ยืนยัน ... ไทย</p><p><b>Automatic e-mail: x</b></p><table>${rows.map(([k, v]) => `<tr><td></td><td>${k}</td><td>${v}</td></tr>`).join("")}</table><p>Yours sincerely</p>` })
const kmail = (id, at, subject, text) => ({ getId: () => id, getFrom: () => "K PLUS <KPLUS@kasikornbank.com>", getDate: () => new Date(at),
  getSubject: () => subject, getPlainBody: () => "", getBody: () => `<div>ธนาคารกสิกรไทย</div><div>${text.replace(/ (?=[A-Z][a-zA-Z ()0-9]{1,30}:)/g, "<br>")}</div>` })
const T0 = new Date("2026-10-28T00:00:00+07:00").getTime()
const inbox = [
  mail("m1", T0 + 12.5 * 3600e3, "ยืนยันการชำระเงิน / Payments confirmation (28/10/2026 @ 12:34:23)",
    [["To:", ""], ["Service code / Payee ID", "010753600031508"], ["Service name / Payee name", "heokaow reataurant"], ["From:", ""],
     ["Account no. / credit card no.", "970-0-xxx847"], ["Amount (Baht)", "70.00"], ["Fee (Baht)", "0.00"], ["Reference no.", "644646"]]),
  mail("m2", T0 + 13 * 3600e3, "ยืนยันการเติมเงินพร้อมเพย์ / PromptPay Top Up Confirmation (28/10/2026 @ 13:00:00)",
    [["To:", ""], ["e-wallet owner", "MR. ILDAR TASHTIMIROV"], ["e-wallet provider name", "K Plus Wallet"], ["From:", ""], ["Amount (Baht)", "4,000.00"], ["Fee (Baht)", "0.00"]]),
  mail("m3", T0 + 14 * 3600e3, "ยืนยันรายการโอนเงินไปยังหมายเลขโทรศัพท์มือถือโดยพร้อมเพย์ / Confirmation of funds transfer to Mobile Phone Number by PromptPay (28/10/2026 @ 14:00:00)",
    [["From:", ""], ["Account no.", "970-0-xxx847"], ["To:", ""], ["Mobile Phone Number", "080-xxx-0000"], ["Account name", "ERIK HYAN CHU"], ["Amount (Baht)", "450.00"], ["Fee (Baht)", "0.00"]]),
  mail("m4", T0 + 15 * 3600e3, "บริการแจ้งเตือน / Sign-on to Bangkok Bank Mobile Banking Notification", [["Date", "x"]]),
  mail("m5", T0 + 15.2 * 3600e3, "ยืนยันการโอนเงิน / Funds transfer confirmation (28/10/2026 @ 15:12:00)",
    [["From:", ""], ["Account no.", "970-0-xxx847"], ["To:", ""], ["Account no.", "1598272502"], ["Account name", "MR. ILDAR TASHTIMIROV"], ["Bank", "KBANK"], ["Amount (Baht)", "3,000.00"], ["Fee (Baht)", "0.00"]]),
  // K PLUS: письма вида «Поле: значение»
  kmail("k1", T0 + 15.5 * 3600e3, "Result of Payment (Success)", "Transaction Date: 28/10/2026 15:30:00 From Account: xxx-x-x1234-x Merchant Name: FOODLAND PATTAYA Amount (THB): 1,250.50 Fee (THB): 0.00 Available Balance (THB): 9,999.00"),
  kmail("k2", T0 + 15.6 * 3600e3, "Result of Funds Transfer (Success)", "Transaction Date: 28/10/2026 15:36:00 From Account: xxx-x-x1234-x From Account Name: ILDAR TASHTIMIROV To Bank: Bangkok Bank To Account: xxx-x-x0847-x Account Name: MR. ILDAR TASHTIMIROV Amount (THB): 500.00 Fee (THB): 0.00"),
  kmail("k3", T0 + 15.7 * 3600e3, "Result of PromptPay Funds Transfer (Success)", "From Account: xxx-x-x1234-x From Account Name: ILDAR TASHTIMIROV To PromptPay ID: 080-xxx-0000 Account Name: SOMCHAI JAIDEE Amount (THB): 200.00 Fee (THB): 0.00"),
  kmail("k4", T0 + 15.8 * 3600e3, "Result of updating Own E-Mail Address", "From E-Mail Address: a@b.c To E-Mail Address: realtashtimirov@gmail.com"),
  kmail("k5", T0 + 15.9 * 3600e3, "Result of Bill Payment (Success)", "Company Name: TRUE MOVE H Ref 1: 0812345678 Paid: 599.00 THB"),
  mail("m0", T0 - 3600e3, "ยืนยันการชำระเงิน / Payments confirmation (27/10/2026 @ 23:00:00)", [["Payee name", "old"], ["From:", ""], ["Amount (Baht)", "99.00"]]),
]
const g = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ({ alert() {} }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v }, deleteProperty: k => { delete props[k] } }) },
  ContentService: { createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }), MimeType: { JSON: 1 } },
  GmailApp: { search: q => (searches.push(q), /bangkokbank/.test(q) ? [{ getMessages: () => inbox, getLastMessageDate: () => new Date(Math.max(...inbox.map(m => +m.getDate()))) }] : []) },
  ScriptApp: { getProjectTriggers: () => triggers, deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1),
    newTrigger: f => ({ timeBased: () => ({ everyMinutes: m => ({ create: () => triggers.push({ getHandlerFunction: () => f, m }) }) }) }) },
}
const RealDate = Date
let clock = T0 + 16 * 3600e3
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(clock) } static now() { return clock } }
const gs = new Function(...Object.keys(g), code + "; return { doPost, cardOn, cardOff, cardMonth, importBank, parseBankMail_ }")(...Object.values(g))
const KEY = "k".repeat(32)
const post = b => gs.doPost({ postData: { contents: JSON.stringify(Object.assign({ secret: KEY, deleted: [], food: [], water: [] }, b)) } })

check("без включения таблица карту не присылает", post({ entries: [] }).card === undefined)
gs.cardOn()
check("включение: один триггер на 15 минут", triggers.length === 1 && triggers[0].m === 15)
gs.cardOn()
check("повторное включение не плодит триггеры", triggers.length === 1)
const card = ss.getSheetByName("Карта")
const rows = card.cells.slice(1)
check("лист «Карта»: платежи с сегодняшнего дня, вход в приложение, смена почты и вчерашнее — нет", rows.length === 8, rows.map(r => r[5]))
check("оплата: сумма и получатель", rows[0][1] === 70 && rows[0][2] === "heokaow reataurant" && rows[0][3] === "Оплата", rows[0])
check("пополнение своего кошелька K Plus — расход", rows[1][1] === 4000 && rows[1][4] === "ждёт виджет" && /K Plus Wallet/.test(rows[1][2]), rows[1])
check("перевод PromptPay человеку", rows[2][1] === 450 && rows[2][2] === "ERIK HYAN CHU" && rows[2][3] === "Перевод PromptPay", rows[2])
const row = id => rows.find(x => x[5] === id) || []
check("перевод Bangkok Bank → свой счёт в Kasikornbank — не расход", /свой счёт/.test(row("bbl-m5")[4]), row("bbl-m5"))
check("K PLUS: оплата в магазине", row("kb-k1")[1] === 1250.5 && row("kb-k1")[2] === "FOODLAND PATTAYA" && row("kb-k1")[3] === "Оплата K PLUS" && row("kb-k1")[4] === "ждёт виджет", row("kb-k1"))
check("K PLUS: перевод на свой счёт в Bangkok Bank — не расход (получатель, а не отправитель)", row("kb-k2")[1] === 500 && /свой счёт/.test(row("kb-k2")[4]) && row("kb-k2")[2] === "MR. ILDAR TASHTIMIROV", row("kb-k2"))
check("K PLUS: перевод человеку", row("kb-k3")[1] === 200 && row("kb-k3")[2] === "SOMCHAI JAIDEE" && row("kb-k3")[4] === "ждёт виджет", row("kb-k3"))
check("K PLUS: письмо без понятной суммы остаётся на листе и в расходы не идёт", /не разобрано/.test(row("kb-k5")[4]), row("kb-k5"))
let r = post({ entries: [] })
check("виджету — пять расходов (с пополнением кошелька)", r.card.length === 5 && r.card[0].id === "bbl-m1" && r.card[0].amount === 70 && r.card[2].to === "ERIK HYAN CHU" &&
  r.card.some(c => c.id === "kb-k1") && r.card.some(c => c.id === "kb-k3"), r.card)
r = post({ entries: [] })
check("выгрузка из виджета почту не читает (быстрый ответ)", searches.length === 2, searches.length)
gs.importBank({})
check("триггер смотрит только последние дни", /after:\d+/.test(searches[searches.length - 1]) && card.cells.length === 9, searches)
check("повторный опрос почты не дублирует строки", card.cells.length === 9, card.cells.length)
r = post({ entries: [{ id: "bbl-m1", date: rows[0][0].getTime(), type: "expense", amount: 70, method: "transfer", category: "Кафе и рестораны", comment: "heokaow" }],
  deleted: ["bbl-m2", "bbl-m3", "kb-k1", "kb-k3"] })
check("принятое виджетом — «в расходах», дубль — «не добавлено», больше не присылаются",
  r.card.length === 0 && card.cells[1][4] === "в расходах" && card.cells[3][4] === "дубль, не добавлено", card.cells.map(x => x[4]))
check("принятое попало в «Операции»", ss.getSheetByName("Операции").cells.some(x => x && x[6] === "bbl-m1"))
const plain = gs.parseBankMail_("Payments confirmation (28/10/2026 @ 12:34:23)",
  "*Automatic e-mail: Payment confirmation*\n\n| To: |\n| | Service name / Payee name | heokaow reataurant |\n| From: |\n| | Amount (Baht) | 1,070.00 |\n| | Fee (Baht) | 5.00 |")
check("письмо без HTML тоже разбирается, комиссия прибавляется", plain && plain.amount === 1075 && plain.to === "heokaow reataurant", plain)
gs.cardMonth()
check("«загрузить весь месяц» добавляет платежи до включения, без повторов", card.cells.filter(r => r && r[5] === "bbl-m0").length === 1 && card.cells.length === 10, card.cells.map(r => r && r[5]))
gs.cardMonth()
check("повторная загрузка месяца ничего не дублирует", card.cells.length === 10)
gs.cardOff()
check("выключение убирает триггер", triggers.length === 0 && post({ entries: [] }).card === undefined)

// ── Виджет (версия для Таиланда) ──
const src = fs.readFileSync(new URL("../dist/MyDay-TH.js", import.meta.url), "utf8").replace(/\/\/ ───────────── Запуск[\s\S]*$/, "")
class Color { constructor(h) { this.hex = h } static dynamic(a) { return a } }
class DateFormatter { set dateFormat(p) {} string(d) { return d.toISOString().slice(0, 16) } }
const files = {}
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: p => p in files || p === "/d/my-day",
  createDirectory() {}, isFileStoredIniCloud: () => false, readString: p => files[p], writeString: (p, s) => { files[p] = s } }
let reply = { ok: true }
const sent = [], notes = [], answers = [], alerts = []
class Request { async loadJSON() { sent.push(JSON.parse(this.body)); return JSON.parse(JSON.stringify(reply)) } }
class Notification { async schedule() { notes.push(this) } }
class Alert { constructor() { this.actions = [] } addAction(a) { this.actions.push(a) } addCancelAction() {} async presentAlert() { alerts.push(this); return answers.shift() } }
const w = { Color, DateFormatter, Request, Notification, Alert, URLScheme: { forRunningScript: () => "x" }, FileManager: { iCloud: () => fmo, local: () => fmo },
  Keychain: { contains: () => false }, Script: { setShortcutOutput() {} } }
const app = await new Function(...Object.keys(w), "return (async()=>{" + src +
  "; return { syncSheet, autoSyncSheet, saveSettings, loadSettings, saveMoney, loadMoney, askCardDups, cardCategory } })()")(...Object.values(w))
await app.saveSettings({ sheetHook: "https://script.google.com/macros/s/abc/exec" })
const at = h => T0 + h * 3600e3
await app.saveMoney([{ id: "f1", date: at(14.2), u: at(14.2), type: "expense", amount: 450, method: "cash", category: "Кафе и рестораны", comment: "ужин" }])
reply = { ok: true, sheets: {}, card: [{ id: "bbl-m1", date: at(12.5), amount: 70, to: "heokaow reataurant", kind: "Оплата" },
                           { id: "bbl-m3", date: at(14), amount: 450, to: "ERIK HYAN CHU", kind: "Перевод PromptPay" }] }
notes.length = 0
const res = await app.syncSheet(true)
let list = await app.loadMoney()
const e1 = list.find(x => x.id === "bbl-m1")
check("расход по карте записан сам: перевод, категория по названию", e1 && e1.method === "transfer" && e1.category === "Кафе и рестораны" && e1.comment === "heokaow reataurant" && e1.date === at(12.5), e1)
check("такая же сумма уже есть — не добавлено, вопрос отложен", !list.some(x => x.id === "bbl-m3") && (await app.loadSettings()).cardAsk.length === 1 && res.cardTaken.ask === 1)
check("уведомления: о расходе и о дубле", notes.length === 2 && /70/.test(notes[0].title) && /дубль/.test(notes[1].title) && /action=card/.test(notes[1].openURL), notes.map(n => n.title))
const n0 = sent.length
await app.autoSyncSheet()
check("новый расход по карте уходит в таблицу следующей выгрузкой", sent.length === n0 + 1 && sent[n0].entries.some(x => x.id === "bbl-m1"))
notes.length = 0
await app.syncSheet(true)
check("повторно присланное не дублируется и не спрашивается снова", (await app.loadMoney()).filter(x => x.id === "bbl-m1").length === 1 &&
  (await app.loadSettings()).cardAsk.length === 1 && notes.length === 0)
answers.push(-1)
await app.askCardDups()
check("«решить позже» — вопрос остаётся", alerts.length === 1 && /ERIK/.test(alerts[0].message) && /ужин/.test(alerts[0].message) && (await app.loadSettings()).cardAsk.length === 1)
answers.push(0)
await app.askCardDups()
list = await app.loadMoney()
check("«одно и то же» — не добавлено, вопрос снят", !list.some(x => x.id === "bbl-m3") && list.length === 2 && (await app.loadSettings()).cardAsk.length === 0)
await app.autoSyncSheet()
check("таблица узнаёт, что это дубль", sent[sent.length - 1].deleted.includes("bbl-m3"))
reply = { ok: true, sheets: {}, card: [{ id: "bbl-m5", date: at(15), amount: 450, to: "7-ELEVEN", kind: "Оплата" }] }
await app.syncSheet(true)
answers.push(1)
await app.askCardDups()
const e5 = (await app.loadMoney()).find(x => x.id === "bbl-m5")
check("«разные» — добавлено", e5 && e5.amount === 450 && e5.category === "Еда и продукты", e5)
reply = { ok: true, sheets: {}, card: [{ id: "kb-k9", date: at(12.6), amount: 70, to: "CAFE AMAZON", kind: "Оплата K PLUS" }] }
await app.syncSheet(true)
check("платёж K PLUS на ту же сумму, что и платёж Bangkok Bank, — не дубль (дубль ищется только среди ручных записей)",
  (await app.loadMoney()).some(x => x.id === "kb-k9") && !(await app.loadSettings()).cardAsk.length)
reply = { ok: true, sheets: {}, card: [{ id: "bbl-x1", date: at(14.3), amount: 450, to: "A", kind: "Оплата" }, { id: "bbl-x2", date: at(14.4), amount: 450, to: "B", kind: "Оплата" }] }
await app.syncSheet(true)
answers.push(2)
alerts.length = 0
await app.askCardDups()
list = await app.loadMoney()
check("«это и остальные — дубли»: один вопрос на всех", alerts.length === 1 && !list.some(x => x.id === "bbl-x1" || x.id === "bbl-x2") && !(await app.loadSettings()).cardAsk.length, alerts.length)
check("категории: grab, аптека, незнакомое", app.cardCategory("GRAB TAXI") === "Транспорт" && app.cardCategory("Boots pharmacy") === "Здоровье" && app.cardCategory("SOMCHAI") === "Другое")
await app.autoSyncSheet()   // добавленное «разные» уходит в таблицу
const st = await app.loadSettings(), n1 = sent.length
await app.autoSyncSheet()
check("без изменений таблица не опрашивается раньше 15 минут", sent.length === n1)
clock += 16 * 60 * 1000
await app.autoSyncSheet()
check("через 15 минут — опрос за новыми платежами", st.cardOn && sent.length === n1 + 1)
console.log(fail ? `CARD_FAIL ${fail}` : "CARD_OK")
process.exit(fail ? 1 : 0)
