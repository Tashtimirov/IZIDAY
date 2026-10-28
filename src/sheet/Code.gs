// Автозапись из виджета «Мой день» в Google Таблицу: деньги, еда, вода и активность с Apple Watch.
// Виджет присылает свои списки целиком и удалённые ID; скрипт добавляет новые строки и убирает удалённые.
// Повторная отправка ничего не дублирует (сверка по столбцу ID). Недостающие листы и листы-итоги
// скрипт создаёт сам — в пустой таблице достаточно вставить этот код и развернуть веб-приложение.

// Ключ, который знает только ваш виджет. Пусто — таблица запоминает ключ первого виджета, который в неё напишет.
const SECRET = "__SHEET_SECRET__";
const TYPE = { expense: "Расход", income: "Доход" };
const METHOD = { cash: "Наличные", transfer: "Перевод" };
const DT = "dd.MM.yyyy HH:mm";
// Расходы по карте из писем банка. Переводы получателям, в чьём имени есть одно из этих слов
// (свои счета, кошельки и семья), расходом не считаются. Через запятую, например "IVANOV, PETROVA".
const CARD_SKIP = "__CARD_SKIP__";

// Листы с записями: имя, заголовки (последний столбец — ID), как запись из виджета превращается в строку
const LISTS = {
  money: { name: "Операции", head: ["Дата", "Тип", "Сумма", "Способ", "Категория", "Комментарий", "ID"], formats: [DT, "", "#,##0.##"],
           row: x => [new Date(x.date), txt_(TYPE[x.type] || x.type), Number(x.amount) || 0, txt_(METHOD[x.method] || x.method), txt_(x.category), txt_(x.comment)] },
  food:  { name: "Еда", head: ["Дата", "Блюдо", "Ккал", "Белки, г", "Жиры, г", "Углеводы, г", "ID"], formats: [DT, "", "0", "0", "0", "0"],
           row: x => [new Date(x.date), txt_(x.title), num_(x.kcal), num_(x.protein), num_(x.fat), num_(x.carbs)] },
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

// Лист «Еда и активность»: цели (можно менять), сегодня, неделя, рекомендации и самые калорийные блюда.
// [подпись, значение или формула, формат]; строки с заголовком без значения — разделы. Ссылки B3–B5 — цели.
const DAYS7 = "'Еда'!A2:A, \">=\"&(TODAY()-6)";
const ANALYSIS = { name: "Еда и активность", rows: [
  ["Цели (можно менять)"],
  ["Калории в день", 2000, "#,##0"],
  ["Белок в день, г", 100, "0"],
  ["Вода в день, л", 2, "0.0"],
  [""],
  ["Сегодня"],
  ["Съедено, ккал", "=SUMIFS('Еда'!C2:C, 'Еда'!A2:A, \">=\"&TODAY(), 'Еда'!A2:A, \"<\"&(TODAY()+1))", "#,##0"],
  ["Осталось до цели, ккал", "=B3-B8", "#,##0"],
  ["Белок, г", "=SUMIFS('Еда'!D2:D, 'Еда'!A2:A, \">=\"&TODAY(), 'Еда'!A2:A, \"<\"&(TODAY()+1))", "0"],
  ["Сожжено (часы), ккал", "=IFERROR(VLOOKUP(TODAY(), 'Активность'!A2:C, 3, FALSE), 0)", "#,##0"],
  ["Шагов", "=IFERROR(VLOOKUP(TODAY(), 'Активность'!A2:B, 2, FALSE), 0)", "#,##0"],
  ["Последние 7 дней"],
  ["Дней с записями", "=IFERROR(ROWS(UNIQUE(FILTER(INT('Еда'!A2:A), 'Еда'!A2:A>=TODAY()-6))), 0)", "0"],
  ["Ккал в день", `=IF(B14=0, 0, SUMIFS('Еда'!C2:C, ${DAYS7})/B14)`, "#,##0"],
  ["Белок в день, г", `=IF(B14=0, 0, SUMIFS('Еда'!D2:D, ${DAYS7})/B14)`, "0"],
  ["Жиры в день, г", `=IF(B14=0, 0, SUMIFS('Еда'!E2:E, ${DAYS7})/B14)`, "0"],
  ["Углеводы в день, г", `=IF(B14=0, 0, SUMIFS('Еда'!F2:F, ${DAYS7})/B14)`, "0"],
  ["Белки / жиры / углеводы, % калорий", "=IF(B15=0, \"—\", ROUND(B16*400/B15)&\"% / \"&ROUND(B17*900/B15)&\"% / \"&ROUND(B18*400/B15)&\"%\")", ""],
  ["Сожжено в день (часы), ккал", "=IFERROR(AVERAGEIFS('Активность'!C2:C, 'Активность'!A2:A, \">=\"&(TODAY()-6)), 0)", "#,##0"],
  ["Шагов в день", "=IFERROR(AVERAGEIFS('Активность'!B2:B, 'Активность'!A2:A, \">=\"&(TODAY()-6)), 0)", "#,##0"],
  ["Воды в день, л", "=IFERROR(SUMIFS('Вода'!B2:B, 'Вода'!A2:A, \">=\"&(TODAY()-6))/1000/ROWS(UNIQUE(FILTER(INT('Вода'!A2:A), 'Вода'!A2:A>=TODAY()-6))), 0)", "0.0"],
  [""],
  ["Рекомендации"],
  ["", "=IF(B14<5, \"📝 Записывайте всю еду: за неделю записи есть только за \"&B14&\" дн., выводы по неполным данным неточные.\", \"\")"],
  ["", "=IF(B14=0, \"\", IF(B15>B3*1.1, \"⬇️ В среднем \"&ROUND(B15)&\" ккал в день, на \"&ROUND(B15-B3)&\" больше цели. Уберите один перекус или сладкие напитки.\", IF(B15<B3*0.8, \"⬆️ В среднем \"&ROUND(B15)&\" ккал, заметно меньше цели \"&B3&\". Слишком большой дефицит отнимает силы и портит сон.\", \"✅ Калории в норме: в среднем \"&ROUND(B15)&\" при цели \"&B3&\".\")))"],
  ["", "=IF(B14=0, \"\", IF(B16<B4*0.9, \"🥩 Белка в среднем \"&ROUND(B16)&\" г из \"&B4&\". Добавьте яйца, курицу, рыбу, творог или тофу к каждому приёму пищи.\", \"✅ Белка достаточно: \"&ROUND(B16)&\" г в день.\"))"],
  ["", "=IF(B15=0, \"\", IF(B17*9/B15>0.35, \"🧈 Жиры дают \"&ROUND(B17*900/B15)&\"% калорий (лучше до 35%). Меньше жареного, соусов и орехов горстями.\", \"\"))"],
  ["", "=IF(B15=0, \"\", IF(B18*4/B15>0.55, \"🍚 Углеводы дают \"&ROUND(B18*400/B15)&\"% калорий. Замените часть риса, лапши и сладкого овощами и белком.\", \"\"))"],
  ["", "=IF(B22<B5*0.8, \"💧 Воды в среднем \"&ROUND(B22, 1)&\" л из \"&B5&\". Держите бутылку на виду и выпивайте стакан перед едой.\", \"\")"],
  ["", "=IF(B21=0, \"\", IF(B21<6000, \"👟 В среднем \"&ROUND(B21)&\" шагов в день. Прогулка 20–30 минут после ужина добавит 2–3 тысячи.\", \"\"))"],
  [""],
  ["Совет Claude"],
  ["", "Появится вечером, если в свойства скрипта добавлен ключ ANTHROPIC_KEY. Обновить сейчас: меню «Мой день» → «Совет по еде»."],
  ["Обновлено", ""],
], top: ["Самые калорийные блюда за 30 дней",
  "=IFERROR(QUERY('Еда'!A2:C, \"select B, count(B), sum(C) where A >= date '\"&TEXT(TODAY()-29, \"yyyy-mm-dd\")&\"' and B is not null group by B order by sum(C) desc limit 10 label B 'Блюдо', count(B) 'Раз', sum(C) 'Ккал всего'\", 0), \"Пока нет записей\")"],
  // съедено, сожжено и шаги за 14 дней, по строке на день (с G15, под топом блюд)
  days: ["Съедено и сожжено по дням", "=LET(d, SEQUENCE(14, 1, TODAY(), -1), " +
    "e, MAP(d, LAMBDA(x, SUMIFS('Еда'!C2:C, 'Еда'!A2:A, \">=\"&x, 'Еда'!A2:A, \"<\"&(x+1)))), " +
    "b, MAP(d, LAMBDA(x, IFERROR(VLOOKUP(x, 'Активность'!A2:C, 3, FALSE), 0))), " +
    "s, MAP(d, LAMBDA(x, IFERROR(VLOOKUP(x, 'Активность'!A2:B, 2, FALSE), 0))), " +
    "VSTACK(HSTACK(\"День\", \"Съедено ккал\", \"Сожжено ккал\", \"Шаги\", \"Разница ккал\"), HSTACK(d, e, b, s, MAP(e, b, LAMBDA(p, q, p-q)))))"] };
// rows[i] — строка i + 2 (в строке 1 заголовок листа)
const ADVICE_ROW = ANALYSIS.rows.findIndex(r => r[0] === "Совет Claude") + 3;   // строка с текстом совета

// Без ключа — только «работает»: адрес таблицы отдаёт doPost тому, кто знает ключ
function doGet() {
  ensureSheets_();
  return out_({ ok: true });
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
    // расходы по карте: свежие письма банка → лист «Карта», виджету — те, которых у него ещё нет
    let card;
    if (PropertiesService.getScriptProperties().getProperty("cardOn")) {
      try { importBank_(); } catch (err) {}
      if (Array.isArray(body.entries)) card = cardForWidget_(body.entries, deleted);
    }
    if (Array.isArray(body.food)) dailyAdvice_();
    // номера листов — чтобы виджет открывал нужный лист (калории и активность → «Еда и активность»)
    const sheets = {};
    ss.getSheets().forEach(sh => { sheets[sh.getName()] = sh.getSheetId(); });
    return out_(Object.assign({ ok: true, added, removed, url: ss.getUrl(), sheets }, card ? { card } : {}));
  } finally {
    lock.releaseLock();
  }
}

// Меню в таблице: создать листы вручную, не дожидаясь первой записи из виджета
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Мой день").addItem("Создать листы", "setup").addItem("Совет по еде", "advice")
    .addItem("Расходы по карте: включить", "cardOn").addItem("Расходы по карте: выключить", "cardOff").addToUi();
}
function setup() { ensureSheets_(); }
function advice() { ensureSheets_(); writeAdvice_(); }

// ── Расходы по карте ──
// Скрипт раз в 15 минут читает письма Bangkok Bank о платежах и складывает их на лист «Карта».
// Виджет при выгрузке получает платежи, которых у него ещё нет, и добавляет их расходом («Перевод»);
// если такая же сумма уже записана вручную, виджет спрашивает. Принятые виджетом попадают в «Операции» как обычно.
const CARD = { name: "Карта", head: ["Дата", "Сумма", "Кому", "Вид", "Статус", "ID"], formats: [DT, "#,##0.##"],
  query: "from:bangkokbank.com", days: 60 };
const CARD_NEW = "ждёт виджет", CARD_ADDED = "в расходах", CARD_DUP = "дубль, не добавлено", CARD_OWN = "свой счёт, не расход";

function cardOn() {
  const props = PropertiesService.getScriptProperties();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "importBank").forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("importBank").timeBased().everyMinutes(15).create();
  // письма с начала сегодняшнего дня: то, что было раньше, вы, скорее всего, уже записали
  if (!props.getProperty("cardSince")) { const d = new Date(); d.setHours(0, 0, 0, 0); props.setProperty("cardSince", String(d.getTime())); }
  props.setProperty("cardOn", "1");
  const n = importBank();
  try { SpreadsheetApp.getUi().alert(`Расходы по карте включены. Новых платежей: ${n}. Дальше письма банка проверяются каждые 15 минут.`); } catch (e) {}
}
function cardOff() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "importBank").forEach(t => ScriptApp.deleteTrigger(t));
  PropertiesService.getScriptProperties().deleteProperty("cardOn");
}
function importBank() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { ensureSheets_(); return importBank_(); } finally { lock.releaseLock(); }
}

// Новые письма банка → строки листа «Карта». Повторно одно письмо не добавляется (ID — номер письма).
function importBank_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CARD.name) || makeCardSheet_(ss);
  const props = PropertiesService.getScriptProperties();
  const since = Number(props.getProperty("cardSince") || 0);
  const idCol = CARD.head.length;
  const have = new Set(readIds_(sh, idCol).filter(String));
  const skip = CARD_SKIP.indexOf("__") === 0 ? [] : CARD_SKIP.split(",").map(x => x.trim().toUpperCase()).filter(String);
  const rows = [];
  const threads = GmailApp.search(`${CARD.query} newer_than:${CARD.days}d`, 0, 100);
  for (const th of threads) for (const m of th.getMessages()) {
    const id = "bbl-" + m.getId();
    if (have.has(id) || m.getDate().getTime() < since) continue;
    const p = parseBankMail_(m.getSubject(), m.getBody() || m.getPlainBody());
    if (!p) continue;
    const own = skip.some(w => p.to.toUpperCase().indexOf(w) >= 0);
    rows.push([m.getDate(), p.amount, txt_(p.to), p.kind, own ? CARD_OWN : CARD_NEW, id]);
    have.add(id);
  }
  if (rows.length) {
    rows.sort((a, b) => a[0] - b[0]);
    const start = lastDataRow_(sh, idCol) + 1;
    sh.getRange(start, 1, rows.length, idCol).setValues(rows);
  }
  return rows.filter(r => r[4] === CARD_NEW).length;
}

function makeCardSheet_(ss) {
  const sh = ss.insertSheet(CARD.name);
  sh.getRange(1, 1, 1, CARD.head.length).setValues([CARD.head]).setFontWeight("bold").setBackground("#0B4A33").setFontColor("#F0CC60");
  sh.setFrozenRows(1);
  CARD.formats.forEach((f, i) => { if (f) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat(f); });
  sh.hideColumns(CARD.head.length);
  return sh;
}

// Письмо Bangkok Bank → { kind, to, amount } или null (вход в приложение, зачисления и прочее — не платёж).
// Берётся английская половина письма: «Amount (Baht) 70.00», «Payee name …», «Account name …».
function parseBankMail_(subject, body) {
  const kinds = [[/Payments? confirmation/i, "Оплата"], [/PromptPay Top ?Up/i, "Пополнение кошелька"],
    [/transfer.*PromptPay|PromptPay.*transfer/i, "Перевод PromptPay"], [/Funds transfer/i, "Перевод на счёт"], [/Bill payment/i, "Оплата счёта"]];
  const k = kinds.find(([re]) => re.test(subject || ""));
  if (!k) return null;
  const text = String(body || "").replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/[|*]/g, " ").replace(/\s+/g, " ");
  const en = text.slice(Math.max(0, text.search(/Automatic e-mail/i)));
  const num = re => { const m = en.match(re); return m ? parseFloat(m[1].replace(/,/g, "")) : 0; };
  const amount = num(/Amount \(Baht\)\s*([\d,]+(?:\.\d+)?)/i) + num(/Fee \(Baht\)\s*([\d,]+(?:\.\d+)?)/i);
  if (!(amount > 0)) return null;
  const pick = re => { const m = en.match(re); return m ? m[1].trim() : ""; };
  const to = pick(/Payee name\s+(.+?)\s+From:/i) || pick(/e-wallet owner\s+(.+?)\s+(?:e-wallet provider|From:)/i)
    || pick(/Account name\s+(.+?)\s+(?:Amount|Bank\b)/i) || pick(/(?:Biller|Company) name\s+(.+?)\s+(?:From:|Account)/i);
  const wallet = pick(/e-wallet provider name\s+(.+?)\s+From:/i);
  return { kind: k[1], to: wallet ? `${to} (${wallet})` : to, amount: Math.round(amount * 100) / 100 };
}

// Платежи «ждёт виджет», которых у виджета нет. Статусы на листе обновляются по тому, что виджет прислал.
function cardForWidget_(entries, deleted) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CARD.name);
  if (!sh) return [];
  const idCol = CARD.head.length, last = lastDataRow_(sh, idCol);
  if (last < 2) return [];
  const mine = new Set(entries.filter(x => x && x.id).map(x => x.id));
  const rows = sh.getRange(2, 1, last - 1, idCol).getValues();
  const out = [];
  rows.forEach((r, i) => {
    const id = String(r[idCol - 1] || "");
    if (!id || r[4] === CARD_OWN) return;
    const status = mine.has(id) ? CARD_ADDED : deleted.has(id) ? CARD_DUP : r[4] === CARD_NEW ? CARD_NEW : r[4];
    if (status !== r[4]) sh.getRange(i + 2, 5).setValue(status);
    if (status === CARD_NEW && r[0] instanceof Date)
      out.push({ id, date: r[0].getTime(), amount: Number(r[1]) || 0, to: String(r[2] || "").replace(/^'/, ""), kind: String(r[3] || "") });
  });
  return out;
}

// Совет Claude по еде: раз в день, при первой выгрузке после 20:00, если в свойствах скрипта есть ANTHROPIC_KEY
function dailyAdvice_() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("ANTHROPIC_KEY")) return;
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const now = new Date(), day = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  if (Number(Utilities.formatDate(now, tz, "H")) < 20 || props.getProperty("adviceDay") === day) return;
  props.setProperty("adviceDay", day);
  try { writeAdvice_(); } catch (e) {}
}

function writeAdvice_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone();
  const sh = ss.getSheetByName(ANALYSIS.name);
  const key = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_KEY");
  if (!key) { sh.getRange(ADVICE_ROW, 2).setValue("Добавьте ANTHROPIC_KEY: «Расширения» → «Apps Script» → «Настройки проекта» → «Свойства скрипта»."); return; }
  const since = new Date(Date.now() - 14 * 864e5);
  const fmt = d => Utilities.formatDate(d, tz, "dd.MM HH:mm");
  const rows = (name, cols) => { const s = ss.getSheetByName(name); const n = s.getLastRow();
    return n < 2 ? [] : s.getRange(2, 1, n - 1, cols).getValues().filter(r => r[0] instanceof Date && r[0] >= since); };
  const food = rows("Еда", 6).map(r => `${fmt(r[0])} ${r[1]}: ${r[2]} ккал, Б${r[3]} Ж${r[4]} У${r[5]}`);
  const act = rows("Активность", 4).map(r => `${fmt(r[0]).slice(0, 5)}: ${r[1]} шагов, сожжено ${r[2]} ккал, упражнения ${r[3]} мин`);
  const goals = sh.getRange(3, 2, 3, 1).getValues().map(r => r[0]);
  if (!food.length) { sh.getRange(ADVICE_ROW, 2).setValue("За две недели нет записей еды — совета пока нет."); return; }
  const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 1500,
      system: "Ты внимательный нутрициолог. Пиши по-русски, просто и по делу, без Markdown. 4–6 коротких пунктов, каждый с новой строки и с эмодзи в начале: " +
        "что получается хорошо, что стоит поменять и конкретные замены блюд из списка. Опирайся только на данные; если данных мало, скажи об этом.",
      messages: [{ role: "user", content: `Цели: ${goals[0]} ккал в день, белок ${goals[1]} г, вода ${goals[2]} л.\n\nЕда за 14 дней:\n${food.join("\n")}\n\nАктивность:\n${act.join("\n") || "нет данных"}` }] }),
  });
  const j = JSON.parse(res.getContentText());
  const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("").trim();
  sh.getRange(ADVICE_ROW, 2).setValue(text || `Не получилось: ${j.error ? j.error.message : "пустой ответ"}`);
  sh.getRange(ADVICE_ROW + 1, 2).setValue(new Date()).setNumberFormat("dd.MM.yyyy HH:mm");
}

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

// Формулы в коде записаны по-английски (запятые, 0.35). В таблице с русской и похожей локалью
// setFormula ждёт «;» между аргументами и десятичную запятую, иначе ячейка показывает #ERROR!.
// Текст в кавычках (запросы QUERY, подписи) не меняется.
function localFormula_(locale) {
  if (!/^(ru|uk|be|kk|uz|az|hy|ka|de|fr|es|it|pt|pl|nl|tr|cs|sk|sl|sv|fi|da|nb|no|id|vi|ro|hu|el|bg|sr|hr|lt|lv|et)/.test(locale || "")) return f => f;
  return f => {
    const stack = [];   // ( или {: запятая прямо внутри {…} разделяет столбцы массива — там «\»
    return f.split(/("(?:[^"]|"")*"|'[^']*')/).map((part, i) => i % 2 ? part :
      part.replace(/[(){},]/g, c => {
        if (c === "(" || c === "{") stack.push(c);
        else if (c === ")" || c === "}") stack.pop();
        else return stack[stack.length - 1] === "{" ? "\\" : ";";
        return c;
      }).replace(/(\d)\.(\d)/g, "$1,$2")).join("");
  };
}

// Создаёт недостающие листы с заголовками и листы-итоги. Существующие не трогает.
function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fx = localFormula_(ss.getSpreadsheetLocale ? ss.getSpreadsheetLocale() : "en_US");
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
      sh.getRange(2, col).setFormula(fx(formula));
      sh.getRange(2, col, 1, formats.length).setFontWeight("bold").setBackground("#F1EAD8");
      formats.forEach((f, i) => { if (f) sh.getRange(3, col + i, sh.getMaxRows() - 2, 1).setNumberFormat(f); });
      col += formats.length + 1;
    }
    sh.setFrozenRows(2);
  }
  const an = make(ANALYSIS.name);
  if (an) {
    ANALYSIS.rows.forEach(([label, value, format], i) => {
      const r = i + 2;
      if (label !== undefined) an.getRange(r, 1).setValue(label);
      if (value === undefined) { if (label) an.getRange(r, 1).setFontWeight("bold").setFontSize(12).setFontColor("#0B4A33"); return; }
      const cell = an.getRange(r, 2);
      if (typeof value === "string" && value[0] === "=") cell.setFormula(fx(value)); else cell.setValue(value);
      if (format) cell.setNumberFormat(format);
      if (!label) an.getRange(r, 2, 1, 4).merge().setWrap(true);   // рекомендации — во всю ширину
    });
    an.getRange(1, 1).setValue(ANALYSIS.name).setFontWeight("bold").setFontSize(14);
    an.getRange(3, 2, 3, 1).setBackground("#FFF6D6");   // цели можно менять
    an.setColumnWidth(1, 260); an.setColumnWidth(2, 140);
    an.getRange(1, 7).setValue(ANALYSIS.top[0]).setFontWeight("bold").setFontSize(12);
    an.getRange(2, 7).setFormula(fx(ANALYSIS.top[1]));
    an.getRange(2, 7, 1, 3).setFontWeight("bold").setBackground("#F1EAD8");
    an.setColumnWidth(7, 220);
    an.getRange(15, 7).setValue(ANALYSIS.days[0]).setFontWeight("bold").setFontSize(12);
    an.getRange(16, 7).setFormula(fx(ANALYSIS.days[1]));
    an.getRange(16, 7, 1, 5).setFontWeight("bold").setBackground("#F1EAD8");
    an.getRange(17, 7, 14, 1).setNumberFormat("dd.mm ddd");
    an.getRange(17, 8, 14, 4).setNumberFormat("#,##0");
    ss.setActiveSheet(an); ss.moveActiveSheet(1);   // первым листом: сюда ведёт нажатие на калории
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

// Текст из виджета — всегда текст: «=…», «+…», «-…», «@…» таблица иначе выполнит как формулу
// (например, IMAGE или IMPORTXML, которые отправят данные таблицы на чужой сайт)
function txt_(v) { const s = String(v == null ? "" : v); return /^[=+\-@]/.test(s) ? "'" + s : s; }

function num_(v) { const n = Number(v); return isFinite(n) ? Math.round(n * 10) / 10 : 0; }

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
