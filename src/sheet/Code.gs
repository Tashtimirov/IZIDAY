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
  workouts: { name: "Тренировки", head: ["Дата", "Тренировка", "Минуты", "Ккал", "ID"], formats: [DT, "", "0", "0"],
           row: x => [new Date(x.date), txt_(x.title), num_(x.minutes), num_(x.kcal)] },
  memory: { name: "Память помощника", head: ["Дата", "Что", "Текст", "ID"], formats: [DT, ""],
           row: x => [new Date(x.date), x.kind === "chat" ? "разговор" : "факт", txt_(x.text)] },
  rems:  { name: "Напоминания", update: true, head: ["Создано", "Напоминание", "Срок", "Выполнено", "ID"], formats: [DT, "", "", DT],
           row: x => [new Date(x.date), txt_(x.title), txt_(String(x.due || "").replace("T", " ")), x.done ? (x.doneAt ? new Date(x.doneAt) : "✓") : ""] },
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
    if (body.hub) return out_(hub_(body.hub));
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const deleted = new Set(body.deleted || []);
    let added = 0, removed = 0;
    // деньги — в body.entries (так шлют и старые версии виджета), еда и вода — в body.food и body.water
    const lists = { money: body.entries, food: body.food, water: body.water, workouts: body.workouts };
    for (const key of Object.keys(LISTS)) {
      if (!Array.isArray(lists[key])) continue;
      const r = syncList_(ss.getSheetByName(LISTS[key].name), LISTS[key], lists[key], deleted);
      added += r.added; removed += r.removed;
    }
    for (const h of body.health || []) upsertActivity_(ss.getSheetByName(ACTIVITY.name), h);
    // расходы по карте: виджету — платежи с листа «Карта», которых у него ещё нет. Почту здесь не читаем:
    // это долго, а Быстрая команда и виджет ждут ответа недолго; письма раз в 15 минут разбирает триггер
    let card;
    if (PropertiesService.getScriptProperties().getProperty("cardOn") && Array.isArray(body.entries))
      card = cardForWidget_(body.entries, deleted);
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
    .addItem("Расходы по карте: включить", "cardOn").addItem("Расходы по карте: загрузить весь месяц", "cardMonth")
    .addItem("Расходы по карте: выключить", "cardOff").addToUi();
}
function setup() { ensureSheets_(); }
function advice() { ensureSheets_(); writeAdvice_(); }

// ── Связь виджета и веб-приложения «Мой день» ──
// Таблица хранит общие списки (деньги, еда, вода, тренировки) на скрытом листе «_hub» и раздаёт их обоим.
// Виджет присылает снимок того, что видит только iPhone (календарь, напоминания, часы), и выполняет
// очередь команд приложения (создать или перенести событие, отметить напоминание). Каждая запись хранит
// s — время, когда таблица её приняла: клиент получает только записи новее своего прошлого запроса.
const HUB = { name: "_hub", lists: { money: 0, food: 120, water: 60, workouts: 400, places: 0, memory: 0, locs: 60, nudges: 3, rems: 0, skips: 60, budgets: 0, recur: 0, habits: 0, hlog: 400, weight: 0, shop: 0, kids: 0, fast: 90, goals: 0 },   // сколько дней хранить (0 — всё); rems — напоминания IZIDAY; budgets, recur, habits, hlog, weight — лимиты, регулярные платежи, привычки, вес; shop — покупки, kids — дела детей, fast — голодание
  tomb: 90, chunk: 45000, opsKeep: 3 };
const ROUTE_URL = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/trig_[A-Za-z0-9_-]+\/fire$/;

function hub_(h) {
  if (h.push) { try { return { ok: true, push: push_(h.push, h.from) }; } catch (e) { return { ok: true, push: { error: String(e.message || e) } }; } }
  const now = Date.now(), since = Number(h.since) || 0, out = { ok: true, now, lists: {} };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // 1. Списки: побеждает запись с более поздним u; изменившиеся уходят и в обычные листы таблицы
  for (const key of Object.keys(HUB.lists)) {
    const cur = hubGet_(key) || [];
    const incoming = (h.lists && Array.isArray(h.lists[key])) ? h.lists[key] : [];
    const map = new Map(cur.map(x => [x.id, x]));
    const won = [];
    for (const x of incoming) {
      if (!x || !x.id) continue;
      const old = map.get(x.id);
      if (old && (Number(old.u) || 0) >= (Number(x.u) || 0)) continue;
      const rec = Object.assign({}, x, { s: now });
      map.set(x.id, rec);
      won.push(rec);
    }
    const keepDays = HUB.lists[key], tomb = now - HUB.tomb * 864e5;
    const list = [...map.values()].filter(x => (x.deleted ? (Number(x.u) || 0) > tomb : !keepDays || (Number(x.date) || 0) > now - keepDays * 864e5));
    if (won.length) {
      hubSet_(key, list);
      if (LISTS[key]) syncList_(ss.getSheetByName(LISTS[key].name), LISTS[key], won.filter(x => !x.deleted), new Set(won.filter(x => x.deleted).map(x => x.id)));
    }
    out.lists[key] = list.filter(x => (Number(x.s) || 0) >= since);   // >=: в ту же миллисекунду могла прийти чужая запись
  }
  // 2. Снимок iPhone: присылает виджет, получает приложение
  if (h.snap && h.from === "widget") hubSet_("snap", Object.assign({}, h.snap, { at: now }));
  const snap = hubGet_("snap");
  if (h.from === "app" && snap && snap.at > (Number(h.snapAt) || 0)) out.snap = snap;
  // 3. Очередь команд для iPhone: приложение добавляет, виджет выполняет и сообщает результат
  let ops = hubGet_("ops") || [];
  const before = JSON.stringify(ops);
  for (const op of h.ops || []) {
    if (op && op.id && op.tool && !ops.some(o => o.id === op.id)) ops.push({ id: String(op.id), tool: String(op.tool), input: op.input || {}, at: now, state: "new" });
  }
  for (const d of h.done || []) {
    const op = ops.find(o => o.id === d.id);
    if (op && op.state === "new") Object.assign(op, { state: "done", result: d.result || {}, doneAt: now });
  }
  ops = ops.filter(o => o.state === "new" || o.doneAt > now - HUB.opsKeep * 864e5);
  if (JSON.stringify(ops) !== before) hubSet_("ops", ops);
  out.ops = h.from === "widget" ? ops.filter(o => o.state === "new") : ops.filter(o => o.state === "new" || o.doneAt >= since);
  // 4. Задача в Claude Code (браузер не может обратиться к API рутин напрямую)
  if (h.fire && ROUTE_URL.test(h.fire.url || "")) {
    try {
      const res = UrlFetchApp.fetch(h.fire.url, { method: "post", contentType: "application/json", muteHttpExceptions: true,
        headers: { Authorization: "Bearer " + h.fire.token, "anthropic-version": "2023-06-01", "anthropic-beta": "experimental-cc-routine-2026-04-01" },
        payload: JSON.stringify({ text: String(h.fire.text || "").slice(0, 60000) }) });
      const j = JSON.parse(res.getContentText() || "{}");
      out.fire = j.claude_code_session_url ? { ok: true, session_url: j.claude_code_session_url }
        : { error: j.error ? j.error.type + ": " + j.error.message : "пустой ответ" };
    } catch (err) { out.fire = { error: "нет связи: " + err }; }
  }
  // 6. Карты Google: дорога до точки и поиск места рядом
  if (h.route) out.route = route_(h.route);
  if (h.geo) out.geo = geo_(h.geo);
  // 5. Чтение любого листа для помощника (только чтение; скрытый «_hub» не отдаётся)
  if (h.read) out.read = readSheet_(ss, h.read);
  if (h.cal) { try { out.cal = cal_(h.cal); } catch (e) { out.cal = { error: String(e.message || e) }; } }
  if (h.mail) { try { out.mail = mail_(h.mail); } catch (e) { out.mail = { error: String(e.message || e) }; } }
  out.pushOn = pushOn_();
  out.url = ss.getUrl();
  return out;
}

// Время и расстояние в пути (встроенный сервис Карт Apps Script, ключ не нужен). from/to — {lat,lng} или адрес
function route_(r) {
  try {
    const M = Maps.DirectionFinder.Mode, f = Maps.newDirectionFinder().setLanguage("ru")
      .setMode(r.mode === "walking" ? M.WALKING : r.mode === "transit" ? M.TRANSIT : M.DRIVING);
    const at = (x, fn) => x && x.lat != null ? f[fn](Number(x.lat), Number(x.lng)) : f[fn](String(x || ""));
    at(r.from, "setOrigin"); at(r.to, "setDestination");
    if (r.mode !== "walking") f.setDepart(new Date());
    const d = f.getDirections();
    if (!d || d.status !== "OK" || !d.routes || !d.routes.length) return { error: "маршрут не найден" + (d && d.status ? " (" + d.status + ")" : "") };
    const leg = d.routes[0].legs[0];
    const out = { minutes: Math.round(leg.duration.value / 60), km: Math.round(leg.distance.value / 100) / 10, from: leg.start_address, to: leg.end_address };
    if (leg.duration_in_traffic) out.minutes_in_traffic = Math.round(leg.duration_in_traffic.value / 60);
    return out;
  } catch (e) { return { error: String(e) }; }
}
// Поиск места: сетевые магазины и заведения — по карте OpenStreetMap (Overpass: филиалы по названию или бренду рядом),
// потом Nominatim, адреса — Геокодер Google. near — {lat,lng}; города и районы целиком не возвращаем
function geo_(g) {
  if (g.lat != null && g.lng != null) {   // обратный геокодинг: адрес точки (место платежа)
    try { const r = Maps.newGeocoder().setLanguage("ru").reverseGeocode(Number(g.lat), Number(g.lng));
      return { address: r.results && r.results[0] ? r.results[0].formatted_address : "" }; } catch (e) { return { address: "", error: String(e) }; }
  }
  const q = String(g.query || "").trim(), near = g.near && g.near.lat != null ? g.near : null;
  const km = Math.max(3, Math.min(Number(g.km) || 40, 80));
  const ua = { "User-Agent": "IZIDAY personal assistant (Google Apps Script)" };
  const fromOsm = (x, lat, lng) => {
    const t = x.tags || {}, addr = [t["addr:street"], t["addr:housenumber"]].filter(String).join(" ");
    return { name: [t.name || t.brand || q, t.branch, addr || t["addr:city"] || ""].filter(String).join(", "), lat: lat, lng: lng };
  };
  // Сначала Nominatim (отвечает за секунды), Overpass — запасной
  try {
    let url = "https://nominatim.openstreetmap.org/search?format=json&limit=8&accept-language=ru&q=" + encodeURIComponent(q);
    if (near) { const k = km / 111; url += "&bounded=1&viewbox=" + [near.lng - k, near.lat + k, near.lng + k, near.lat - k].join(","); }
    const res = UrlFetchApp.fetch(url, { headers: ua, muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const out = JSON.parse(res.getContentText()).filter(x => !/^(city|town|state|country|administrative|suburb|county)$/.test(x.type))
        .map(x => ({ name: x.display_name, lat: Number(x.lat), lng: Number(x.lon) }));
      if (out.length) return { source: "nominatim", results: out };
    }
  } catch (e) {}
  try {
    if (near && q) {
      const re = q.replace(/[^\p{L}\p{N} &'-]/gu, "").trim() || "-";   // без спецсимволов регулярного выражения
      const data = "[out:json][timeout:8];(nwr[\"name\"~\"" + re + "\",i](around:" + km * 1000 + "," + near.lat + "," + near.lng + ");" +
        "nwr[\"brand\"~\"" + re + "\",i](around:" + km * 1000 + "," + near.lat + "," + near.lng + "););out center 40;";
      let res = null;   // один сервер и только если Nominatim ничего не нашёл: перегруженный Overpass может висеть минуту
      try { res = UrlFetchApp.fetch("https://overpass-api.de/api/interpreter", { method: "post", payload: { data: data }, headers: ua, muteHttpExceptions: true }); } catch (e) { res = null; }
      if (res && res.getResponseCode() === 200) {
        const seen = {}, out = [];
        for (const x of JSON.parse(res.getContentText()).elements || []) {
          const lat = x.lat != null ? x.lat : x.center && x.center.lat, lng = x.lon != null ? x.lon : x.center && x.center.lon;
          if (lat == null || !(x.tags && (x.tags.shop || x.tags.amenity || x.tags.brand || x.tags.leisure || x.tags.tourism || x.tags.office))) continue;
          const key = Math.round(lat * 500) + ":" + Math.round(lng * 500);   // одно место, отмеченное и точкой, и зданием
          if (seen[key]) continue;
          seen[key] = 1; out.push(fromOsm(x, lat, lng));
        }
        if (out.length) return { source: "osm", results: out.slice(0, 15) };
      }
    }
  } catch (e) {}
  try {
    const gc = Maps.newGeocoder().setLanguage("ru");
    if (near) { const k = km / 111; gc.setBounds(near.lat - k, near.lng - k, near.lat + k, near.lng + k); }
    const res = gc.geocode(q);
    const out = (res.results || []).filter(x => !(x.types || []).some(t => /^(locality|political|country|administrative_area_level_\d|sublocality.*)$/.test(t)))
      .slice(0, 8).map(x => ({ name: x.formatted_address, lat: x.geometry.location.lat, lng: x.geometry.location.lng }));
    return { source: "google", status: res.status, results: out };
  } catch (e) { return { error: String(e), results: [] }; }
}

// Почта Gmail для помощника: поиск, чтение, ответ, отправка, черновики, архив/метки/корзина.
// Отправку и корзину приложение показывает человеку на подтверждение до запроса сюда.
// ── Google Календарь: события для приложения и виджета, создание/изменение/удаление ──
// Время — строки "yyyy-MM-ddTHH:mm" в часовом поясе таблицы; день без времени — "yyyy-MM-dd"
function cal_(c) {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const fmt = (d, day) => Utilities.formatDate(d, tz, day ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
  const parse = v => { const m = String(v || "").match(/^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/); if (!m) throw new Error("нет даты: " + v);
    return Utilities.parseDate(`${m[1]}-${m[2]}-${m[3]} ${m[4] || "00"}:${m[5] || "00"}`, tz, "yyyy-MM-dd HH:mm"); };
  const ev = (e, calName) => { const all = e.isAllDayEvent(), cal = calName != null ? null : CalendarApp.getCalendarById(e.getOriginalCalendarId());
    return { id: e.getId(), title: e.getTitle(), start: fmt(e.getStartTime(), all), end: fmt(all ? new Date(e.getEndTime().getTime() - 864e5) : e.getEndTime(), all), all_day: all,
      location: e.getLocation() || "", notes: String(e.getDescription() || "").slice(0, 300), calendar: calName != null ? calName : cal ? cal.getName() : "", recurring: e.isRecurringEvent() }; };
  const cals = () => CalendarApp.getAllCalendars().filter(k => !k.isHidden());
  const find = (id, start) => { for (const k of cals()) { let e = null; try { e = k.getEventById(id); } catch (x) {}
      if (e) { if (start && e.isRecurringEvent()) { const d = parse(start), hit = k.getEvents(new Date(d.getTime() - 6e4), new Date(d.getTime() + 864e5)).find(x => x.getId() === id); if (hit) return hit; } return e; } }
    throw new Error("нет события " + id); };
  const a = c.action || "list";
  if (a === "list") {
    const from = c.from ? parse(c.from) : new Date(Date.now() - 2 * 864e5), to = c.to ? parse(c.to) : new Date(Date.now() + 45 * 864e5);
    const out = [], list = cals(), def = CalendarApp.getDefaultCalendar().getId(), info = [];
    for (const k of list) { const name = k.getName(); info.push({ name, primary: k.getId() === def }); for (const e of k.getEvents(from, to)) out.push(ev(e, name)); }   // имя календаря — из цикла: getCalendarById на каждое событие очень медленный
    out.sort((x, y) => x.start < y.start ? -1 : 1);
    return { events: out.slice(0, 600), calendars: info };
  }
  if (a === "create") {
    const k = (c.calendar && cals().find(x => x.getName() === c.calendar)) || CalendarApp.getDefaultCalendar();
    const opt = { location: c.location || "", description: c.notes || "" };
    let e, rec = null;
    if (c.repeat && c.repeat.freq) {   // повтор: daily | weekly (+ days: MO..SU) | monthly | yearly
      const W = { MO: CalendarApp.Weekday.MONDAY, TU: CalendarApp.Weekday.TUESDAY, WE: CalendarApp.Weekday.WEDNESDAY, TH: CalendarApp.Weekday.THURSDAY,
        FR: CalendarApp.Weekday.FRIDAY, SA: CalendarApp.Weekday.SATURDAY, SU: CalendarApp.Weekday.SUNDAY };
      rec = CalendarApp.newRecurrence();
      const f = c.repeat.freq;
      if (f === "daily") rec.addDailyRule();
      else if (f === "monthly") rec.addMonthlyRule();
      else if (f === "yearly") rec.addYearlyRule();
      else { const r = rec.addWeeklyRule(), days = (c.repeat.days || []).map(d => W[d]).filter(Boolean); if (days.length) r.onlyOnWeekdays(days); }
    }
    const s0 = parse(c.start);
    if (c.all_day) e = rec ? k.createAllDayEventSeries(String(c.title), s0, rec, opt) : k.createAllDayEvent(String(c.title), s0, new Date(parse(c.end || c.start).getTime() + 864e5), opt);
    else { const e0 = c.end ? parse(c.end) : new Date(s0.getTime() + 60 * 6e4);
      e = rec ? k.createEventSeries(String(c.title), s0, e0, rec, opt) : k.createEvent(String(c.title), s0, e0, opt); }
    if (rec) return { ok: true, event: { id: e.getId(), title: String(c.title), start: c.start, end: c.end || c.start, all_day: !!c.all_day, recurring: true } };
    return { ok: true, event: ev(e) };
  }
  if (a === "update") {
    const e = find(c.id, c.occurrence_start);
    if (c.title) e.setTitle(String(c.title));
    if (c.location != null) e.setLocation(String(c.location));
    if (c.notes != null) e.setDescription(String(c.notes));
    if (c.start) { const dur = e.getEndTime() - e.getStartTime(), s = parse(c.start);
      if (e.isAllDayEvent() && !/T/.test(c.start)) e.setAllDayDate(s); else e.setTime(s, c.end ? parse(c.end) : new Date(s.getTime() + dur)); }
    return { ok: true, event: ev(e) };
  }
  if (a === "delete") {
    const e = find(c.id, c.occurrence_start);
    if (c.all_future && e.isRecurringEvent()) return calCutSeries_(e, c.occurrence_start ? parse(c.occurrence_start) : e.getStartTime(), tz);
    e.deleteEvent();
    return { ok: true };
  }
  throw new Error("неизвестное действие календаря: " + a);
}

// «Это и все следующие повторения»: правило повтора обрезается датой повторения (UNTIL), прошлые встречи остаются.
// CalendarApp так не умеет — нужен API Календаря; токен скрипта уже даёт доступ к Календарю. Если повторение первое — удаляется вся серия.
function calCutSeries_(e, occ, tz) {
  const api = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(e.getOriginalCalendarId()) + "/events";
  const headers = { Authorization: "Bearer " + ScriptApp.getOAuthToken() };
  const got = UrlFetchApp.fetch(api + "?iCalUID=" + encodeURIComponent(e.getId()) + "&showDeleted=false&maxResults=10", { headers, muteHttpExceptions: true });
  if (got.getResponseCode() !== 200) throw new Error("Календарь не отдал правило повтора (" + got.getResponseCode() + ") — ничего не удалено");
  const master = (JSON.parse(got.getContentText()).items || []).find(x => x.recurrence && x.recurrence.length);
  if (!master) throw new Error("не нашёл правило повтора — ничего не удалено");
  const all = !!master.start.date;
  const first = all ? Utilities.parseDate(master.start.date + " 00:00", tz, "yyyy-MM-dd HH:mm") : new Date(master.start.dateTime);
  if (occ.getTime() <= first.getTime() + 6e4) { e.getEventSeries().deleteEventSeries(); return { ok: true, deleted: "series" }; }
  const until = all ? Utilities.formatDate(new Date(occ.getTime() - 864e5), tz, "yyyyMMdd") : Utilities.formatDate(new Date(occ.getTime() - 6e4), "UTC", "yyyyMMdd'T'HHmmss'Z'");
  const recurrence = master.recurrence.map(r => /^RRULE:/.test(r) ? r.replace(/;(UNTIL|COUNT)=[^;]*/g, "") + ";UNTIL=" + until : r);
  const put = UrlFetchApp.fetch(api + "/" + encodeURIComponent(master.id), { method: "patch", contentType: "application/json", headers, muteHttpExceptions: true, payload: JSON.stringify({ recurrence }) });
  if (put.getResponseCode() !== 200) throw new Error("Календарь не принял изменение повтора (" + put.getResponseCode() + ") — ничего не удалено");
  return { ok: true, deleted: "from", until };
}

function mail_(m) {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), when = d => Utilities.formatDate(d, tz, "yyyy-MM-dd HH:mm");
  const plain = (msg, n) => String(msg.getPlainBody() || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
  const thread = id => { const t = GmailApp.getThreadById(String(id || "")); if (!t) throw new Error("нет письма с id " + id); return t; };
  const a = m.action;
  if (a === "search") {
    const lim = Math.max(1, Math.min(Number(m.limit) || 10, 25));
    return { threads: GmailApp.search(String(m.query || "in:inbox"), 0, lim).map(t => {
      const ms = t.getMessages(), last = ms[ms.length - 1];
      return { id: t.getId(), subject: t.getFirstMessageSubject(), from: last.getFrom(), date: when(t.getLastMessageDate()), messages: ms.length,
        unread: t.isUnread(), starred: t.hasStarredMessages(), labels: t.getLabels().map(l => l.getName()), snippet: plain(last, 220) };
    }) };
  }
  if (a === "read") {
    const t = thread(m.id);
    return { id: t.getId(), subject: t.getFirstMessageSubject(), labels: t.getLabels().map(l => l.getName()), messages: t.getMessages().slice(-8).map(x => ({
      id: x.getId(), from: x.getFrom(), to: x.getTo(), cc: x.getCc(), date: when(x.getDate()), subject: x.getSubject(),
      body: plain(x, 6000), attachments: x.getAttachments().map(f => f.getName()) })) };
  }
  const opts = o => { const r = {}; if (o.cc) r.cc = o.cc; if (o.bcc) r.bcc = o.bcc; return r; };
  if (a === "send") { GmailApp.sendEmail(m.to, m.subject || "", m.body || "", opts(m)); return { ok: true }; }
  if (a === "reply") { const t = thread(m.id), last = t.getMessages().slice(-1)[0]; m.all ? last.replyAll(m.body || "") : last.reply(m.body || ""); return { ok: true }; }
  if (a === "draft") {
    const d = m.id ? thread(m.id).getMessages().slice(-1)[0].createDraftReply(m.body || "") : GmailApp.createDraft(m.to, m.subject || "", m.body || "", opts(m));
    return { ok: true, draft_id: d.getId() };
  }
  if (a === "modify") {
    const ids = [].concat(m.ids || m.id || []), done = [];
    for (const id of ids) {
      const t = thread(id);
      if (m.op === "archive") t.moveToArchive(); else if (m.op === "inbox") t.moveToInbox();
      else if (m.op === "read") t.markRead(); else if (m.op === "unread") t.markUnread();
      else if (m.op === "star") t.getMessages().slice(-1)[0].star(); else if (m.op === "unstar") t.getMessages().forEach(x => x.unstar());
      else if (m.op === "trash") t.moveToTrash(); else if (m.op === "spam") t.moveToSpam();
      else if (m.op === "label" || m.op === "unlabel") { const l = GmailApp.getUserLabelByName(m.label) || (m.op === "label" ? GmailApp.createLabel(m.label) : null); if (l) m.op === "label" ? t.addLabel(l) : t.removeLabel(l); }
      else throw new Error("неизвестное действие " + m.op);
      done.push(id);
    }
    return { ok: true, done: done };
  }
  if (a === "labels") return { labels: GmailApp.getUserLabels().map(l => l.getName()), unread_inbox: GmailApp.getInboxUnreadCount() };
  throw new Error("неизвестное действие почты " + a);
}

// Без имени листа — список листов с заголовками и числом строк. С именем — строки (последние limit),
// по первому столбцу-дате можно отфильтровать from/to (YYYY-MM-DD). Даты отдаются как «YYYY-MM-DD HH:MM»
function readSheet_(ss, r) {
  const tz = ss.getSpreadsheetTimeZone();
  const cell = v => v instanceof Date ? Utilities.formatDate(v, tz, "yyyy-MM-dd HH:mm").replace(" 00:00", "") : v;
  const sheets = ss.getSheets().filter(sh => sh.getName() !== HUB.name && !sh.isSheetHidden());
  if (!r.sheet) return { sheets: sheets.map(sh => ({ name: sh.getName(), rows: Math.max(0, sh.getLastRow() - 1),
    head: sh.getLastColumn() ? sh.getRange(1, 1, 1, Math.min(sh.getLastColumn(), 20)).getDisplayValues()[0].filter(String) : [] })) };
  const sh = sheets.find(x => x.getName().toLowerCase() === String(r.sheet).toLowerCase());
  if (!sh) return { error: "нет листа «" + r.sheet + "»", sheets: sheets.map(x => x.getName()) };
  const n = sh.getLastRow(), w = Math.min(sh.getLastColumn(), 30);
  if (n < 1 || w < 1) return { sheet: sh.getName(), head: [], rows: [] };
  const all = sh.getRange(1, 1, n, w).getValues();
  const head = all[0].map(String);
  let rows = all.slice(1).filter(x => x.some(v => v !== ""));
  const from = r.from ? new Date(r.from + "T00:00:00") : null, to = r.to ? new Date(r.to + "T23:59:59") : null;
  if ((from || to) && rows.some(x => x[0] instanceof Date))
    rows = rows.filter(x => x[0] instanceof Date && (!from || x[0] >= from) && (!to || x[0] <= to));
  const limit = Math.max(1, Math.min(Number(r.limit) || 200, 1000)), total = rows.length;
  rows = rows.slice(-limit).map(x => x.map(cell));
  return { sheet: sh.getName(), head, total, rows };
}

// Скрытый лист «_hub»: в столбце A ключ, в B число кусков, дальше JSON по кускам (в ячейку влезает 50 000 знаков).
// Перед каждым куском «~»: иначе кусок вроде «=…» или «123» таблица прочитает как формулу или число
function hubSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HUB.name);
  if (!sh) { sh = ss.insertSheet(HUB.name); if (sh.hideSheet) sh.hideSheet(); }
  return sh;
}
function hubRow_(sh, key) {
  const last = sh.getLastRow();
  const keys = last ? sh.getRange(1, 1, last, 1).getValues() : [];
  const i = keys.findIndex(r => r[0] === key);
  return i >= 0 ? i + 1 : 0;
}
function hubGet_(key) {
  const sh = hubSheet_(), r = hubRow_(sh, key);
  if (!r) return null;
  const n = Number(sh.getRange(r, 2).getValues()[0][0]) || 0;
  if (!n) return null;
  try { return JSON.parse(sh.getRange(r, 3, 1, n).getValues()[0].map(c => String(c).slice(1)).join("")); } catch (err) { return null; }
}
function hubSet_(key, value) {
  const sh = hubSheet_(), s = JSON.stringify(value), parts = [];
  for (let i = 0; i < s.length; i += HUB.chunk) parts.push("~" + s.slice(i, i + HUB.chunk));
  const r = hubRow_(sh, key) || sh.getLastRow() + 1;
  const old = Number(sh.getRange(r, 2).getValues()[0][0]) || 0;
  const row = [key, parts.length].concat(parts);
  for (let i = parts.length; i < old; i++) row.push("");   // хвост прежнего, более длинного значения
  sh.getRange(r, 1, 1, row.length).setValues([row]);
}

// ── Расходы по карте ──
// Скрипт раз в 15 минут читает письма Bangkok Bank и Kasikornbank (K PLUS) о платежах и складывает их на лист «Карта».
// Виджет при выгрузке получает платежи, которых у него ещё нет, и добавляет их расходом («Перевод»);
// если такая же сумма уже записана вручную, виджет спрашивает. Принятые виджетом попадают в «Операции» как обычно.
const CARD = { name: "Карта", head: ["Дата", "Сумма", "Кому", "Вид", "Статус", "ID"], formats: [DT, "#,##0.##"],
  query: "{from:bangkokbank.com from:kasikornbank.com}", days: 60 };
const CARD_NEW = "ждёт виджет", CARD_ADDED = "в расходах", CARD_DUP = "дубль, не добавлено", CARD_OWN = "свой счёт, не расход";
// письмо похоже на платёж, но сумму найти не удалось: строка остаётся на листе, в расходы не идёт
const CARD_ODD = "не разобрано, проверьте письмо";

function cardOn() {
  const props = PropertiesService.getScriptProperties();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "importBank").forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("importBank").timeBased().everyMinutes(15).create();
  // письма с начала сегодняшнего дня: то, что было раньше, вы, скорее всего, уже записали
  if (!props.getProperty("cardSince")) { const d = new Date(); d.setHours(0, 0, 0, 0); props.setProperty("cardSince", String(d.getTime())); }
  props.setProperty("cardOn", "1");
  const n = importBank(true);
  try { SpreadsheetApp.getUi().alert(`Расходы по карте включены. Новых платежей: ${n}. Дальше письма банка проверяются каждые 15 минут.`); } catch (e) {}
}
// Платежи с 1-го числа текущего месяца (то, что было до включения). Похожие на ручные записи виджет спросит.
function cardMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
  const props = PropertiesService.getScriptProperties();
  if (Number(props.getProperty("cardSince") || Infinity) > d.getTime()) props.setProperty("cardSince", String(d.getTime()));
  if (!props.getProperty("cardOn")) return cardOn();
  const n = importBank(true);
  try { SpreadsheetApp.getUi().alert(`Загружено платежей с начала месяца: ${n}. Виджет добавит их и спросит про похожие на ручные записи.`); } catch (e) {}
}
function cardOff() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "importBank").forEach(t => ScriptApp.deleteTrigger(t));
  PropertiesService.getScriptProperties().deleteProperty("cardOn");
}
function importBank(full) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { ensureSheets_(); return importBank_(full === true); } finally { lock.releaseLock(); }
}

// Новые письма банка → строки листа «Карта». Повторно одно письмо не добавляется (ID — номер письма).
// Обычный запуск смотрит письма за последние 3 дня (быстро), full — всё с момента включения.
function importBank_(full) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CARD.name) || makeCardSheet_(ss);
  const props = PropertiesService.getScriptProperties();
  const start = Number(props.getProperty("cardSince") || 0);
  const since = full ? start : Math.max(start, Date.now() - 3 * 864e5);
  const idCol = CARD.head.length;
  const have = new Set(readIds_(sh, idCol).filter(String));
  const skip = CARD_SKIP.indexOf("__") === 0 ? [] : CARD_SKIP.split(",").map(x => x.trim().toUpperCase()).filter(String);
  const rows = [];
  const after = Math.max(Math.floor(since / 1000) - 3600, Math.floor(Date.now() / 1000) - CARD.days * 86400);
  // по 100 цепочек за раз: за месяц писем банка бывает больше сотни
  const threads = [];
  for (let page; threads.length < 1000; ) {
    page = GmailApp.search(`${CARD.query} -subject:Sign-on after:${after}`, threads.length, 100);
    threads.push(...page);
    if (page.length < 100) break;
  }
  for (const th of threads) for (const m of (th.getLastMessageDate().getTime() < since ? [] : th.getMessages())) {
    const kb = /kasikornbank/i.test(m.getFrom ? m.getFrom() : "");
    const id = (kb ? "kb-" : "bbl-") + m.getId();
    if (have.has(id) || m.getDate().getTime() < since) continue;
    const body = m.getBody() || m.getPlainBody();
    const p = kb ? parseKBankMail_(m.getSubject(), body) : parseBankMail_(m.getSubject(), body);
    if (!p) continue;
    // переводы между своими счетами (Bangkok Bank ⇄ Kasikornbank) — не расход, иначе траты задвоятся.
    // Пополнение своего кошелька — расход: о покупках из кошелька письма не приходят, иначе их не будет видно
    const own = !/Пополнение/.test(p.kind) && skip.some(w => p.to.toUpperCase().indexOf(w) >= 0);
    rows.push([m.getDate(), p.amount, txt_(p.to), p.kind, !(p.amount > 0) ? CARD_ODD : own ? CARD_OWN : CARD_NEW, id]);
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

// Письмо K PLUS (Kasikornbank) → { kind, to, amount } или null. Только списания: зачисления, вход, смена почты — нет.
// Поля английской части: «Amount (THB): 100.00», «Fee (THB): 0.00», «Account Name / Merchant Name / Company Name: …».
function parseKBankMail_(subject, body) {
  subject = String(subject || "");
  if (/receiv|deposit|incoming|e-?mail|sign|log ?in|password|register|change|unsuccess|fail|เงินเข้า|รับเงิน/i.test(subject)) return null;
  const kinds = [[/top ?up|เติมเงิน/i, "Пополнение (K PLUS)"], [/transfer|โอน/i, "Перевод K PLUS"],
    [/pay|bill|qr|scan|purchase|ชำระ|จ่าย/i, "Оплата K PLUS"], [/withdraw|ถอน/i, "Снятие K PLUS"]];
  const k = kinds.find(([re]) => re.test(subject));
  if (!k) return null;
  const text = String(body || "").replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/[|*\t]/g, " ").replace(/\s+/g, " ");
  const num = re => { const m = text.match(re); return m ? parseFloat(m[1].replace(/,/g, "")) : 0; };
  const amount = num(/\bAmount\s*(?:\((?:THB|Baht)\))?\s*:?\s*(?:THB|฿)?\s*([\d,]+(?:\.\d+)?)/i)
    + num(/\bFee\s*(?:\((?:THB|Baht)\))?\s*:?\s*(?:THB|฿)?\s*([\d,]+(?:\.\d+)?)/i);
  // значение поля — до следующего «Поле:» или до суммы
  // подписи полей — как в письмах K PLUS: «Account Name:», «Amount (THB):» (с заглавной буквы)
  const pick = label => { const m = text.match(new RegExp(`(?:${label})\\s*:?\\s+(.+?)(?=\\s+(?:(?:[A-Z][a-z]+ ?){1,4}(?:\\([A-Z]+\\) ?)?:|Amount\\b|Fee\\b)|$)`)); return m ? m[1].trim() : ""; };
  const to = pick("Merchant Name|Shop Name|Company Name|Biller Name|To Account Name|Receiver Name|Recipient Name|Paid to") || pick("(?<!From )Account Name")
    || pick("To e-?Wallet|To Wallet") || "K PLUS";
  return { kind: k[1], to: to.slice(0, 80), amount: Math.round(amount * 100) / 100 };
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
  // 2. Добавить записи, которых ещё нет (листы с update: изменённые — переписать на месте)
  ids = readIds_(sh, idCol);
  if (def.update) entries.forEach(x => { const i = x && !x.deleted ? ids.indexOf(x.id) : -1; if (i >= 0) sh.getRange(i + 2, 1, 1, idCol - 1).setValues([def.row(x)]); });
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

// ═════════════ Пуш-уведомления IZIDAY (Web Push) ═════════════
// Расписание подсказок живёт здесь, в таблице: каждые 5 минут pushTick() смотрит подсказки помощника, напоминания,
// воду и ближайшие события с адресом (сколько ехать — по Картам Google) и шлёт пуш в приложение на iPhone.
// Пуш приходит пустым (без шифрования содержимого) — приложение само забирает текст из «исходящих» (push: outbox).
// Ключи VAPID (P-256) создаются здесь при первом запросе и хранятся в свойствах скрипта.
const PUSH = { tick: 5, sub: "https://tashtimirov.github.io/IZIDAY/", water: [2, 3.5, 5], waterFrom: 9, waterTo: 21, buffer: 10, look: 3 * 3600e3, kidsAt: 7, kidsLead: 30, briefs: { morning: "08:00", evening: "21:00" } };

function push_(p, from) {
  const a = p.action;
  if (a === "key") return { key: vapid_().pub };
  if (a === "subscribe") {
    const s = p.sub || {};
    if (!/^https:\/\//.test(s.endpoint || "") || !s.keys) throw new Error("нет подписки");
    const subs = (hubGet_("push_subs") || []).filter(x => x.endpoint !== s.endpoint);
    subs.push({ endpoint: s.endpoint, keys: s.keys, at: Date.now(), ua: String(p.ua || "").slice(0, 120) });
    hubSet_("push_subs", subs.slice(-5));
    if (p.cfg) hubSet_("push_cfg", p.cfg);
    pushTrigger_();
    return { ok: true, subs: subs.length };
  }
  if (a === "unsubscribe") { hubSet_("push_subs", (hubGet_("push_subs") || []).filter(x => x.endpoint !== (p.endpoint || ""))); return { ok: true }; }
  if (a === "here") { if (p.lat != null) hubSet_("push_here", { lat: Number(p.lat), lng: Number(p.lng), at: Number(p.at) || Date.now() }); return { ok: true }; }
  if (a === "outbox") { const since = Date.now() - 2 * 3600e3; return { items: (hubGet_("push_out") || []).filter(x => x.at > since) }; }
  if (a === "test") { const r = pushSend_([{ id: "test" + Date.now(), title: "🔔 IZIDAY", body: "Уведомления работают. Подсказки будут приходить сюда.", url: "./" }]); return r; }
  if (a === "status") return { subs: (hubGet_("push_subs") || []).length, trigger: ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === "pushTick"), last: hubGet_("push_last") || null };
  if (a === "tick") return pushTick();
  throw new Error("неизвестное действие push: " + a);
}
// Виджет новой версии (snap.pushAware) молчит про воду, подсказки и напоминания, когда их шлёт таблица
function pushOn_() { const s = hubGet_("push_subs"); return !!(s && s.length); }
function pushTrigger_() {
  if (ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === "pushTick")) return;
  ScriptApp.newTrigger("pushTick").timeBased().everyMinutes(PUSH.tick).create();
}

// Каждые 5 минут: что пора сказать
function pushTick() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { busy: true };
  try {
    const subs = hubGet_("push_subs") || [];
    if (!subs.length) return { subs: 0 };
    const now = Date.now(), from = now - 15 * 60e3;   // окно с запасом на пропущенный запуск; повторы отсекает push_sent
    const sent = hubGet_("push_sent") || {}, items = [];
    const once = (id, x) => { if (sent[id]) return; sent[id] = now; items.push(Object.assign({ id }, x)); };
    const snap = hubGet_("snap") || {}, full = !!snap.pushAware;   // старый виджет сам шлёт воду, подсказки и напоминания
    const alive = l => (hubGet_(l) || []).filter(x => x && !x.deleted);
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const hourOf = t => Number(Utilities.formatDate(new Date(t), tz, "H")), dayOf = t => Utilities.formatDate(new Date(t), tz, "yyyy-MM-dd");
    if (full) {
      // 1. подсказки помощника (plan_day)
      for (const n of alive("nudges")) if (n.date > from && n.date <= now + 60e3) once("n:" + n.id + ":" + n.date, { title: n.title || "💡 IZIDAY", body: n.text || "", url: "./#chat" });
      // 2. напоминания: в срок, потом «Выполнил?» через 1 и 3 часа, дальше раз в день в 10:00 (до 3 дней);
      //    на день без времени — в 13:00 и 18:00. Отметили выполненным — вопросы прекращаются
      for (const r of alive("rems")) {
        if (r.done || !r.due) continue;
        const d = pushParse_(r.due, tz); if (!d) continue;
        const due = d.getTime(), timed = /T/.test(r.due), url = "./#rem=" + encodeURIComponent(r.id), times = [];
        if (timed) times.push([due, "⏰ Напоминание", r.title], [due + 3600e3, "⏰ Выполнил?"], [due + 3 * 3600e3, "⏰ Напоминаю ещё раз"]);
        else times.push([due + 13 * 3600e3, "⏰ Напоминание", r.title], [due + 18 * 3600e3, "⏰ Напоминаю ещё раз"]);
        for (let k = 1; k <= 3; k++) times.push([pushParse_(Utilities.formatDate(new Date(due + k * 864e5 + 12 * 3600e3), tz, "yyyy-MM-dd") + "T10:00", tz).getTime(), "⏰ Всё ещё не сделано"]);
        times.forEach(([t, title, body], i) => { if (t > from && t <= now + 60e3)
          once("r" + i + ":" + r.id + ":" + r.due, { title, body: body || `«${r.title}» — сделано? Если нет — перенесём или скажи, что мешает.`, url }); });
      }
      // 3. вода: через 2 ч после последнего стакана, потом настойчивее (9:00–21:00, пока не выпита норма)
      const h = hourOf(now), today = dayOf(now);
      if (h >= PUSH.waterFrom && h < PUSH.waterTo) {
        const water = alive("water").filter(w => dayOf(w.date) === today), goal = Number((hubGet_("push_cfg") || {}).waterGoal) || 2000;
        const drank = water.reduce((s, w) => s + (Number(w.ml) || 0), 0);
        if (drank < goal) {
          const start = pushParse_(today + "T" + String(PUSH.waterFrom).padStart(2, "0") + ":00", tz).getTime();
          const lastW = Math.max(start, ...water.map(w => Number(w.date) || 0));
          const texts = ["💧 Пора стакан воды", "💧 Вода ждёт", "💧 Почему не пьёшь?"];
          PUSH.water.forEach((hh, i) => {
            const t = lastW + hh * 3600e3, gap = Math.floor((now - lastW) / 3600e3);
            if (t <= now + 60e3 && (i === PUSH.water.length - 1 || lastW + PUSH.water[i + 1] * 3600e3 > now))
              once("w:" + lastW + ":" + i, { title: texts[i], body: i === 0 ? `${gap >= 2 ? gap + " ч без воды. " : ""}Выпито ${Math.round(drank / 100) / 10} л из ${goal / 1000}. Нажми — запишу стакан.` :
                i === 1 ? `${gap} ч ни глотка. Давай прямо сейчас стакан.` : `${gap} ч без воды. Что мешает? Выпей стакан и скажи мне, как помочь не забывать.`, url: i === 2 ? "./#chat" : "./#water" });
          });
        }
      }
    }
    // 5. дела детей: утром в 7:00 — что сегодня (кружки, кто забирает, что взять); за 30 минут до дела со временем — ещё раз
    const wd = Number(Utilities.formatDate(new Date(now), tz, "u"));   // 1 — понедельник … 7 — воскресенье
    const kids = alive("kids").filter(k => (k.days || []).map(Number).includes(wd) && k.title);
    if (kids.length) {
      const line = k => `${k.time ? k.time + " " : ""}${k.title}${k.kid ? " (" + k.kid + ")" : ""}${k.who ? ", забирает " + k.who : ""}${k.take ? " — взять: " + k.take : ""}`;
      const morning = pushParse_(dayOf(now) + "T" + String(PUSH.kidsAt).padStart(2, "0") + ":00", tz).getTime();
      if (morning > from && morning <= now + 60e3)
        once("k:" + dayOf(now), { title: "👧 Сегодня у детей", body: kids.slice().sort((x, y) => String(x.time || "").localeCompare(String(y.time || ""))).map(line).join("\n"), url: "./#kids" });
      for (const k of kids) if (k.time) {
        const t = pushParse_(dayOf(now) + "T" + k.time, tz); if (!t) continue;
        const at = t.getTime() - PUSH.kidsLead * 60e3;
        if (at > from && at <= now + 60e3) once("k:" + k.id + ":" + dayOf(now), { title: `👧 Через ${PUSH.kidsLead} мин: ${k.title}`, body: line(k), url: "./#kids" });
      }
    }
    // 6. интервальное голодание: окно открылось — пуш
    for (const f of alive("fast")) if (!f.end && f.start && f.hours) {
      const at = Number(f.start) + Number(f.hours) * 3600e3;
      if (at <= now + 60e3 && at > now - 6 * 3600e3) once("f:" + f.id, { title: "🍽 Окно открыто", body: `${f.hours} ч голодания позади — можно есть. Записать еду — по фото или словами.`, url: "./#health" });
    }
    // 7. утренняя (8:00) и вечерняя (21:00) сводка: нажатие — помощник собирает сводку; вечером разбираем непонятные траты
    const UNKNOWN = /^(другое|прочее|без категории)?$/i;
    const briefAt = Object.assign({}, PUSH.briefs, (hubGet_("push_cfg") || {}).briefs);   // время можно поменять из приложения
    for (const kind of ["morning", "evening"]) {
      const hm = briefAt[kind]; if (!hm) continue;
      const at = pushParse_(dayOf(now) + "T" + hm, tz); if (!at || !(at.getTime() > from && at.getTime() <= now + 60e3)) continue;
      const cur = (hubGet_("push_cfg") || {}).currency || "฿", fmt = n => Math.round(n).toLocaleString("ru-RU") + " " + cur;
      const spent = alive("money").filter(e => e.type === "expense" && dayOf(e.date) === dayOf(now));
      if (kind === "morning") {
        let ev = [];
        try { ev = CalendarApp.getDefaultCalendar().getEventsForDay(new Date(now)).filter(e => !e.isAllDayEvent()); } catch (e) {}
        const first = ev[0] ? `Первое: ${Utilities.formatDate(ev[0].getStartTime(), tz, "HH:mm")} ${ev[0].getTitle()}. ` : "";
        once("b:m:" + dayOf(now), { title: "☀️ Утренняя сводка", body: `${ev.length ? `Сегодня ${ev.length} ${ev.length === 1 ? "встреча" : ev.length < 5 ? "встречи" : "встреч"}. ${first}` : "Встреч в календаре нет. "}Нажмите — расскажу план дня.`, url: "./#brief=morning" });
      } else {
        const sum = spent.reduce((s, e) => s + (Number(e.amount) || 0), 0), unk = spent.filter(e => UNKNOWN.test(String(e.category || "").trim()));
        once("b:e:" + dayOf(now), { title: "🌙 Итоги дня", body: `${spent.length ? `Потрачено ${fmt(sum)}` : "Трат сегодня нет"}${unk.length ? `, ${unk.length} без категории — разберём, куда отнести` : ""}. Нажмите — пройдём по дню.`, url: "./#brief=evening" });
      }
    }
    // 4. «Пора выезжать»: события с адресом в ближайшие 3 часа, дорога от того места, где пользователь сейчас
    const here = pushHere_(), travel = hubGet_("push_travel") || {};
    const oldNote = here && here.old ? ` Считаю от места, где вы были ${here.old} ч назад — откройте IZIDAY, чтобы уточнить.` : "";
    if (here) {
      for (const k of CalendarApp.getAllCalendars().filter(c => !c.isHidden())) for (const e of k.getEvents(new Date(now), new Date(now + PUSH.look))) {
        const loc = String(e.getLocation() || "").trim();
        if (!loc || e.isAllDayEvent() || /^https?:|zoom|meet\.google|teams|онлайн|online/i.test(loc)) continue;   // созвон — ехать не нужно
        const start = e.getStartTime().getTime(), key = e.getId() + ":" + start;
        let tr = travel[key];
        if (!tr || now - tr.at > (start - now < 3600e3 ? 10 : 25) * 60e3) {   // ближе к выезду — пересчитываем чаще (пробки)
          const r = route_({ from: here, to: loc, mode: "driving" });
          tr = travel[key] = r.error ? { at: now, error: r.error } : { at: now, min: r.minutes_in_traffic || r.minutes, base: r.minutes, km: r.km };
        }
        if (!tr.min || tr.min < 4) continue;   // уже на месте или рядом
        const leave = start - (tr.min + PUSH.buffer) * 60e3;
        const at = Utilities.formatDate(new Date(start), tz, "HH:mm");
        if (leave - 20 * 60e3 <= now && leave - 20 * 60e3 > from - 60e3 && leave - now > 15 * 60e3)
          once("g20:" + key, { title: "🚗 Через 20 минут выезжать", body: `«${e.getTitle()}» в ${at}. Ехать ~${tr.min} мин (${tr.km} км).${oldNote}`, url: "./" });
        if (leave <= now + 60e3 && start > now)
          once("g:" + key, { title: "🚗 Пора выезжать", body: `«${e.getTitle()}» в ${at}, ехать ~${tr.min} мин${tr.min > (tr.base || 0) ? " с пробками" : ""}. Выезжай сейчас — будешь за ${Math.max(0, Math.round((start - now) / 60e3) - tr.min)} мин.${oldNote}`, url: "./" });
      }
      for (const k of Object.keys(travel)) if (now - travel[k].at > 6 * 3600e3) delete travel[k];
      hubSet_("push_travel", travel);
    }
    for (const k of Object.keys(sent)) if (now - sent[k] > 3 * 864e5) delete sent[k];
    hubSet_("push_sent", sent);
    const res = items.length ? pushSend_(items) : { sent: 0 };
    hubSet_("push_last", { at: now, items: items.length, res });
    return res;
  } finally { lock.releaseLock(); }
}
function pushParse_(s, tz) {
  const m = String(s || "").match(/^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/);
  return m ? Utilities.parseDate(`${m[1]}-${m[2]}-${m[3]} ${m[4] || "00"}:${m[5] || "00"}`, tz, "yyyy-MM-dd HH:mm") : null;
}
// Где пользователь: последнее место от приложения или от виджета (не старше 3 суток; старше 12 ч — с пометкой)
function pushHere_() {
  const a = hubGet_("push_here"), locs = (hubGet_("locs") || []).filter(x => x && !x.deleted && x.lat != null).sort((x, y) => (y.date || 0) - (x.date || 0));
  const b = locs[0] ? { lat: locs[0].lat, lng: locs[0].lng, at: locs[0].date } : null;
  const best = [a, b].filter(Boolean).sort((x, y) => (y.at || 0) - (x.at || 0))[0];
  if (!best) return null;
  const h = (Date.now() - best.at) / 3600e3;   // свежее 12 ч — как есть; до 3 суток — тоже считаем, но предупреждаем: лучше так, чем без подсказки
  return h < 72 ? { lat: best.lat, lng: best.lng, old: h >= 12 ? Math.round(h) : 0 } : null;
}
// Отправка: текст кладётся в «исходящие», на каждое устройство — пустой пуш с подписью VAPID
function pushSend_(items) {
  const out = (hubGet_("push_out") || []).filter(x => x.at > Date.now() - 864e5);
  for (const x of items) out.push(Object.assign({ at: Date.now() }, x));
  hubSet_("push_out", out.slice(-60));
  let subs = hubGet_("push_subs") || [], ok = 0;
  const errors = [], gone = [];
  for (const s of subs) {
    try {
      const r = UrlFetchApp.fetch(s.endpoint, { method: "post", muteHttpExceptions: true, payload: "",
        headers: { TTL: "3600", Urgency: "high", Authorization: vapidAuth_(s.endpoint) } });
      const c = r.getResponseCode();
      if (c >= 200 && c < 300) ok++;
      else { errors.push(c + " " + String(r.getContentText()).slice(0, 120)); if (c === 404 || c === 410) gone.push(s.endpoint); }
    } catch (e) { errors.push(String(e).slice(0, 120)); }
  }
  if (gone.length) hubSet_("push_subs", subs.filter(s => gone.indexOf(s.endpoint) < 0));
  return { sent: ok, items: items.length, errors };
}

// ── VAPID: подпись ES256 (ECDSA P-256 + SHA-256) на BigInt — в Apps Script нет готовой ──
const B0 = BigInt(0), B1 = BigInt(1), B2 = BigInt(2), B3 = BigInt(3), B4 = BigInt(4), B8 = BigInt(8), B255 = BigInt(255);   // редактор Apps Script не принимает литералы вида 0n
const P256 = (() => {
  const p = BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"), n = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
  const G = [BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"), BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")];
  const mod = (a, m = p) => { const r = a % m; return r < B0 ? r + m : r; };
  const inv = (a, m = p) => { let [o, r] = [mod(a, m), m], [x, y] = [B1, B0]; while (r) { const q = o / r; [o, r] = [r, o - q * r]; [x, y] = [y, x - q * y]; } return mod(x, m); };
  // точки в координатах Якоби [X, Y, Z]; null — бесконечность
  const dbl = P => { if (!P) return null; const [X, Y, Z] = P; if (!Y) return null;
    const d = mod(B4 * X * Y * Y), m = mod(B3 * (X - Z * Z) * (X + Z * Z)), X3 = mod(m * m - B2 * d);
    return [X3, mod(m * (d - X3) - B8 * Y * Y * Y * Y), mod(B2 * Y * Z)]; };
  const add = (P, Q) => { if (!P) return Q; if (!Q) return P;
    const [X1, Y1, Z1] = P, [X2, Y2, Z2] = Q, z1 = mod(Z1 * Z1), z2 = mod(Z2 * Z2);
    const U1 = mod(X1 * z2), U2 = mod(X2 * z1), S1 = mod(Y1 * Z2 * z2), S2 = mod(Y2 * Z1 * z1);
    if (U1 === U2) return S1 === S2 ? dbl(P) : null;
    const H = mod(U2 - U1), R = mod(S2 - S1), H2 = mod(H * H), H3 = mod(H * H2), X3 = mod(R * R - H3 - B2 * U1 * H2);
    return [X3, mod(R * (U1 * H2 - X3) - S1 * H3), mod(H * Z1 * Z2)]; };
  const mul = (k, P = [G[0], G[1], B1]) => { let R = null; for (let i = 255; i >= 0; i--) { R = dbl(R); if ((k >> BigInt(i)) & B1) R = add(R, P); } return R; };
  const affine = P => { const zi = inv(P[2]), z2 = mod(zi * zi); return [mod(P[0] * z2), mod(P[1] * z2 * zi)]; };
  return { p, n, mod, inv, mul, affine };
})();
const big_ = bytes => bytes.reduce((a, b) => (a << B8) | BigInt(b & 255), B0);
const bytes32_ = x => { const out = []; for (let i = 31; i >= 0; i--) out.push(Number((x >> BigInt(i * 8)) & B255)); return out; };
const b64u_ = bytes => Utilities.base64EncodeWebSafe(bytes.map(b => (b > 127 ? b - 256 : b))).replace(/=+$/, "");
const rand32_ = () => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random() + Date.now() + Utilities.getUuid()).map(b => b & 255);
function vapid_() {
  const props = PropertiesService.getScriptProperties();
  let v = props.getProperty("VAPID");
  if (v) return JSON.parse(v);
  let d = B0;
  while (d === B0 || d >= P256.n) d = big_(rand32_());
  const [x, y] = P256.affine(P256.mul(d));
  v = { d: d.toString(16), pub: b64u_([4].concat(bytes32_(x), bytes32_(y))) };
  props.setProperty("VAPID", JSON.stringify(v));
  return v;
}
function es256_(msg, d) {
  const z = big_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, msg, Utilities.Charset.UTF_8));
  for (;;) {
    const k = P256.mod(big_(rand32_()), P256.n); if (!k) continue;
    const r = P256.mod(P256.affine(P256.mul(k))[0], P256.n); if (!r) continue;
    const s = P256.mod(P256.inv(k, P256.n) * (z + r * d), P256.n); if (!s) continue;
    return b64u_(bytes32_(r).concat(bytes32_(s)));
  }
}
function vapidAuth_(endpoint) {
  const v = vapid_(), aud = endpoint.match(/^https:\/\/[^/]+/)[0];
  const enc = o => b64u_(Utilities.newBlob(JSON.stringify(o)).getBytes());
  const head = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: PUSH.sub });
  return `vapid t=${head}.${es256_(head, BigInt("0x" + v.d))}, k=${v.pub}`;
}
