// Автозапись операций из виджета «Мой день» в лист «Операции».
// Виджет присылает весь список операций и удалённые ID; скрипт добавляет новые строки
// и убирает удалённые. Повторная отправка ничего не дублирует (сверка по столбцу ID, G).

const SECRET = "__SHEET_SECRET__";   // тот же ключ прописан в виджете
const SHEET = "Операции";
const TYPE = { expense: "Расход", income: "Доход" };
const METHOD = { cash: "Наличные", transfer: "Перевод" };

function doGet() {
  return out_({ ok: true, sheet: SpreadsheetApp.getActiveSpreadsheet().getName() });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: "bad json" }); }
  if (body.secret !== SECRET) return out_({ ok: false, error: "forbidden" });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET);
    const deleted = new Set(body.deleted || []);
    let removed = 0, added = 0;

    // 1. Удалить строки, удалённые в виджете (снизу вверх, чтобы номера не съезжали)
    let ids = readIds_(sh);
    for (let i = ids.length - 1; i >= 0; i--) {
      if (ids[i] && deleted.has(ids[i])) { sh.deleteRow(i + 2); removed++; }
    }

    // 2. Добавить операции, которых ещё нет в таблице
    ids = readIds_(sh);
    const have = new Set(ids.filter(String));
    const rows = [], idCol = [];
    for (const x of body.entries || []) {
      if (!x || !x.id || x.deleted || have.has(x.id) || deleted.has(x.id)) continue;
      rows.push([new Date(x.date), TYPE[x.type] || x.type, Number(x.amount) || 0,
                 METHOD[x.method] || x.method || "", x.category || "", x.comment || ""]);
      idCol.push([x.id]);
      have.add(x.id);
    }
    if (rows.length) {
      const start = lastDataRow_(sh) + 1;
      sh.getRange(start, 1, rows.length, 6).setValues(rows);
      sh.getRange(start, 7, rows.length, 1).setValues(idCol);
      added = rows.length;
      // новые строки — по дате, чтобы таблица читалась сверху вниз
      const last = lastDataRow_(sh);
      if (last > 2) sh.getRange(2, 1, last - 1, 7).sort({ column: 1, ascending: true });
    }
    return out_({ ok: true, added, removed });
  } finally {
    lock.releaseLock();
  }
}

// ID из столбца G для строк 2…последняя
function readIds_(sh) {
  const last = lastDataRow_(sh);
  if (last < 2) return [];
  return sh.getRange(2, 7, last - 1, 1).getValues().map(r => String(r[0] || ""));
}

// Последняя строка, где заполнена дата (A) или ID (G). Столбец H (месяц) — формула, не учитывается.
function lastDataRow_(sh) {
  const n = sh.getMaxRows();
  const a = sh.getRange(1, 1, n, 1).getValues();
  const g = sh.getRange(1, 7, n, 1).getValues();
  for (let i = n - 1; i >= 0; i--) if (a[i][0] !== "" || g[i][0] !== "") return i + 1;
  return 1;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
