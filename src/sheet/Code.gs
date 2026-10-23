// Автозапись из виджета «Мой день» в Google Таблицу: деньги, еда, вода и активность с Apple Watch.
// Виджет присылает свои списки целиком и удалённые ID; скрипт добавляет новые строки и убирает удалённые.
// Повторная отправка ничего не дублирует (сверка по столбцу ID). Недостающие листы и листы-итоги
// скрипт создаёт сам — в пустой таблице достаточно вставить этот код и развернуть веб-приложение.

// Ключ, который знает только ваш виджет. Пусто — таблица запоминает ключ первого виджета, который в неё напишет.
const SECRET = "__SHEET_SECRET__";
const TYPE = { expense: "Расход", income: "Доход" };
const METHOD = { cash: "Наличные", transfer: "Перевод" };
const DT = "dd.MM.yyyy HH:mm";

// Листы с записями: имя, заголовки (последний столбец — ID), как запись из виджета превращается в строку
const LISTS = {
  money: { name: "Операции", head: ["Дата", "Тип", "Сумма", "Способ", "Категория", "Комментарий", "ID"], formats: [DT, "", "#,##0.##"],
           row: x => [new Date(x.date), TYPE[x.type] || x.type, Number(x.amount) || 0, METHOD[x.method] || x.method || "", x.category || "", x.comment || ""] },
  food:  { name: "Еда", head: ["Дата", "Блюдо", "Ккал", "Белки, г", "Жиры, г", "Углеводы, г", "ID"], formats: [DT, "", "0", "0", "0", "0"],
           row: x => [new Date(x.date), x.title || "", num_(x.kcal), num_(x.protein), num_(x.fat), num_(x.carbs)] },
  water: { name: "Вода", head: ["Дата", "Мл", "ID"], formats: [DT, "0"],
           row: x => [new Date(x.date), num_(x.ml)] },
};
// Активность с часов: одна строка на день, обновляется в течение дня
const ACTIVITY = { name: "Активность", head: ["День", "Шаги", "Сожжено ккал", "Упражнения, мин", "Дистанция, км", "Сон, ч", "Обновлено"],
  keys: ["steps", "active", "exercise", "distance", "sleep"], formats: ["dd.MM.yyyy", "#,##0", "0", "0", "0.0", "0.0", "dd.MM HH:mm"] };

// Листы-итоги: только формулы (синтаксис Apps Script — английский, через запятую), считаются сами
const BY_MONTH = "group by year(A), month(A)+1 order by year(A) desc, month(A)+1 desc label year(A) 'Год', month(A)+1 'Месяц'";
const SUMMARIES = [
  { name: "Итоги: еда", blocks: [
    ["По дням", "=QUERY('Еда'!A2:F, \"select toDate(A), sum(C), sum(D), sum(E), sum(F), count(C) where A is not null group by toDate(A) order by toDate(A) desc label toDate(A) 'День', sum(C) 'Ккал', sum(D) 'Белки, г', sum(E) 'Жиры, г', sum(F) 'Углеводы, г', count(C) 'Приёмов пищи'\", 0)",
     ["dd.MM.yyyy ddd", "#,##0", "0", "0", "0", "0"]],
    ["По месяцам", `=QUERY(A3:B, "select year(A), month(A)+1, avg(B), sum(B) where A is not null ${BY_MONTH}, avg(B) 'Ккал в день', sum(B) 'Ккал за месяц'", 0)`,
     ["0", "0", "#,##0", "#,##0"]]] },
  { name: "Итоги: активность", blocks: [
    ["По дням", "=QUERY('Активность'!A2:D, \"select A, B, C, D where A is not null order by A desc label A 'День', B 'Шаги', C 'Сожжено ккал', D 'Упражнения, мин'\", 0)",
     ["dd.MM.yyyy ddd", "#,##0", "#,##0", "0"]],
    ["По месяцам", `=QUERY('Активность'!A2:D, "select year(A), month(A)+1, avg(B), avg(C), sum(C), sum(D) where A is not null ${BY_MONTH}, avg(B) 'Шагов в день', avg(C) 'Сожжено ккал в день', sum(C) 'Сожжено за месяц', sum(D) 'Упражнения за месяц, мин'", 0)`,
     ["0", "0", "#,##0", "#,##0", "#,##0", "#,##0"]]] },
  { name: "Итоги: вода", blocks: [
    ["По дням", "=QUERY('Вода'!A2:B, \"select toDate(A), sum(B)/1000, count(B) where A is not null group by toDate(A) order by toDate(A) desc label toDate(A) 'День', sum(B)/1000 'Литров', count(B) 'Раз'\", 0)",
     ["dd.MM.yyyy ddd", "0.00", "0"]],
    ["По месяцам", `=QUERY(A3:B, "select year(A), month(A)+1, avg(B), sum(B) where A is not null ${BY_MONTH}, avg(B) 'Литров в день', sum(B) 'Литров за месяц'", 0)`,
     ["0", "0", "0.00", "0.0"]]] },
  { name: "Итоги: деньги", blocks: [
    ["Доходы и расходы по месяцам", "=ARRAYFORMULA(QUERY({'Операции'!A2:A, IF('Операции'!B2:B=\"Доход\", 'Операции'!C2:C, 0), IF('Операции'!B2:B=\"Расход\", 'Операции'!C2:C, 0)}, \"select year(Col1), month(Col1)+1, sum(Col2), sum(Col3), sum(Col2)-sum(Col3) where Col1 is not null group by year(Col1), month(Col1)+1 order by year(Col1) desc, month(Col1)+1 desc label year(Col1) 'Год', month(Col1)+1 'Месяц', sum(Col2) 'Доходы', sum(Col3) 'Расходы', sum(Col2)-sum(Col3) 'Баланс'\", 0))",
     ["0", "0", "#,##0", "#,##0", "#,##0"]],
    ["Расходы по категориям: этот месяц", "=QUERY('Операции'!A2:E, \"select E, sum(C) where B = 'Расход' and A >= date '\"&TEXT(EOMONTH(TODAY(), -1)+1, \"yyyy-mm-dd\")&\"' group by E order by sum(C) desc label E 'Категория', sum(C) 'Сумма'\", 0)",
     ["", "#,##0"]],
    ["Расходы по категориям: всё время", "=QUERY('Операции'!A2:E, \"select E, sum(C) where B = 'Расход' group by E order by sum(C) desc label E 'Категория', sum(C) 'Сумма'\", 0)",
     ["", "#,##0"]],
    ["Доходы по категориям: всё время", "=QUERY('Операции'!A2:E, \"select E, sum(C) where B = 'Доход' group by E order by sum(C) desc label E 'Категория', sum(C) 'Сумма'\", 0)",
     ["", "#,##0"]]] },
];

function doGet() {
  ensureSheets_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return out_({ ok: true, sheet: ss.getName(), url: ss.getUrl() });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: "bad json" }); }
  if (!checkSecret_(body.secret)) return out_({ ok: false, error: "forbidden" });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    ensureSheets_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const deleted = new Set(body.deleted || []);
    let added = 0, removed = 0;
    // деньги — в body.entries (так шлют и старые версии виджета), еда и вода — в body.food и body.water
    const lists = { money: body.entries, food: body.food, water: body.water };
    for (const key of Object.keys(LISTS)) {
      if (!Array.isArray(lists[key])) continue;
      const r = syncList_(ss.getSheetByName(LISTS[key].name), LISTS[key], lists[key], deleted);
      added += r.added; removed += r.removed;
    }
    for (const h of body.health || []) upsertActivity_(ss.getSheetByName(ACTIVITY.name), h);
    return out_({ ok: true, added, removed, url: ss.getUrl() });
  } finally {
    lock.releaseLock();
  }
}

// Меню в таблице: создать листы вручную, не дожидаясь первой записи из виджета
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Мой день").addItem("Создать листы", "setup").addToUi();
}
function setup() { ensureSheets_(); }

function checkSecret_(got) {
  if (SECRET && SECRET.indexOf("__") !== 0) return got === SECRET;
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty("secret");
  if (saved) return got === saved;
  if (!got || String(got).length < 16) return false;
  props.setProperty("secret", String(got));   // первый виджет, который написал в таблицу, становится её хозяином
  return true;
}

function syncList_(sh, def, entries, deleted) {
  const idCol = def.head.length;
  let removed = 0, added = 0;
  // 1. Удалить строки, удалённые в виджете (снизу вверх, чтобы номера не съезжали)
  let ids = readIds_(sh, idCol);
  for (let i = ids.length - 1; i >= 0; i--) {
    if (ids[i] && deleted.has(ids[i])) { sh.deleteRow(i + 2); removed++; }
  }
  // 2. Добавить записи, которых ещё нет
  ids = readIds_(sh, idCol);
  const have = new Set(ids.filter(String));
  const rows = [], idList = [];
  for (const x of entries) {
    if (!x || !x.id || x.deleted || have.has(x.id) || deleted.has(x.id)) continue;
    rows.push(def.row(x));
    idList.push([x.id]);
    have.add(x.id);
  }
  if (rows.length) {
    const start = lastDataRow_(sh, idCol) + 1;
    sh.getRange(start, 1, rows.length, idCol - 1).setValues(rows);
    sh.getRange(start, idCol, rows.length, 1).setValues(idList);
    added = rows.length;
    // по дате, чтобы таблица читалась сверху вниз
    const last = lastDataRow_(sh, idCol);
    if (last > 2) sh.getRange(2, 1, last - 1, idCol).sort({ column: 1, ascending: true });
  }
  return { added, removed };
}

// Данные часов за день: строка с этой датой обновляется, иначе добавляется
function upsertActivity_(sh, h) {
  if (!h || !/^\d{4}-\d{2}-\d{2}$/.test(h.day || "")) return;
  const [y, m, d] = h.day.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const row = [day].concat(ACTIVITY.keys.map(k => (h[k] === undefined || h[k] === null ? "" : Number(h[k]))), [new Date(h.updated || Date.now())]);
  const last = Math.max(sh.getLastRow(), 1);
  const days = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues() : [];
  const i = days.findIndex(r => r[0] instanceof Date && r[0].getTime() === day.getTime());
  if (i >= 0) { sh.getRange(i + 2, 1, 1, row.length).setValues([row]); return; }
  sh.getRange(last + 1, 1, 1, row.length).setValues([row]);
  if (last + 1 > 2) sh.getRange(2, 1, last, row.length).sort({ column: 1, ascending: true });
}

// Создаёт недостающие листы с заголовками и листы-итоги. Существующие не трогает.
function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const make = name => (ss.getSheetByName(name) ? null : ss.insertSheet(name));
  const header = (sh, head, formats) => {
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold").setBackground("#0B4A33").setFontColor("#F0CC60");
    sh.setFrozenRows(1);
    formats.forEach((f, i) => { if (f) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat(f); });
  };
  for (const key of Object.keys(LISTS)) {
    const def = LISTS[key], sh = make(def.name);
    if (sh) { header(sh, def.head, def.formats); sh.hideColumns(def.head.length); }   // ID — служебный
  }
  const act = make(ACTIVITY.name);
  if (act) header(act, ACTIVITY.head, ACTIVITY.formats);
  for (const s of SUMMARIES) {
    const sh = make(s.name);
    if (!sh) continue;
    let col = 1;
    for (const [title, formula, formats] of s.blocks) {
      sh.getRange(1, col).setValue(title).setFontWeight("bold").setFontSize(12);
      sh.getRange(2, col).setFormula(formula);
      sh.getRange(2, col, 1, formats.length).setFontWeight("bold").setBackground("#F1EAD8");
      formats.forEach((f, i) => { if (f) sh.getRange(3, col + i, sh.getMaxRows() - 2, 1).setNumberFormat(f); });
      col += formats.length + 1;
    }
    sh.setFrozenRows(2);
  }
  // пустой лист, который Google создаёт в новой таблице, больше не нужен
  const blank = ss.getSheets().find(sh => /^(Лист|Sheet)\s*1$/.test(sh.getName()) && sh.getLastRow() === 0);
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);
}

// ID из последнего столбца для строк 2…последняя
function readIds_(sh, idCol) {
  const last = lastDataRow_(sh, idCol);
  if (last < 2) return [];
  return sh.getRange(2, idCol, last - 1, 1).getValues().map(r => String(r[0] || ""));
}

// Последняя строка, где заполнена дата (A) или ID. Столбцы правее ID (формулы) не учитываются.
function lastDataRow_(sh, idCol) {
  const n = sh.getMaxRows();
  const a = sh.getRange(1, 1, n, 1).getValues();
  const g = sh.getRange(1, idCol, n, 1).getValues();
  for (let i = n - 1; i >= 0; i--) if (a[i][0] !== "" || g[i][0] !== "") return i + 1;
  return 1;
}

function num_(v) { const n = Number(v); return isFinite(n) ? Math.round(n * 10) / 10 : 0; }

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
