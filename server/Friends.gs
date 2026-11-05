// Автозапись из виджета «Мой день» в Google Таблицу: деньги, еда, вода и активность с Apple Watch.
// Виджет присылает свои списки целиком и удалённые ID; скрипт добавляет новые строки и убирает удалённые.
// Повторная отправка ничего не дублирует (сверка по столбцу ID). Недостающие листы и листы-итоги
// скрипт создаёт сам — в пустой таблице достаточно вставить этот код и развернуть веб-приложение.

// Ключ, который знает только ваш виджет. Пусто — таблица запоминает ключ первого виджета, который в неё напишет.
const SECRET = "";
const TYPE = { expense: "Расход", income: "Доход" };
const METHOD = { cash: "Наличные", transfer: "Перевод" };
const DT = "dd.MM.yyyy HH:mm";
// Расходы по карте из писем банка. Переводы получателям, в чьём имени есть одно из этих слов
// (свои счета, кошельки и семья), расходом не считаются. Через запятую, например "IVANOV, PETROVA".
const CARD_SKIP = "";

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
  memory: { name: "Память помощника", update: true, head: ["Дата", "Что", "Текст", "ID"], formats: [DT, ""],   // зашифрованное приложением — только пометка, сам шифр в _hub
           row: x => [new Date(x.date), x.kind === "chat" ? "разговор" : x.kind === "vault" ? "сейф" : "факт", x.sealed || x.kind === "vault" ? "🔒 зашифровано" : txt_(x.text)] },
  log:   { name: "Журнал", update: true, head: ["Дата", "Что сделал помощник", "ID"], formats: [DT, ""],
           row: x => [new Date(x.date), x.sealed ? "🔒 зашифровано" : txt_(x.text)] },
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
function doGetOwner_() {
  ensureSheets_();
  return out_({ ok: true });
}

function doPostOwner_(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: "bad json" }); }
  // Лига друзей: без ключа таблицы, только по коду лиги — друзья видят друг у друга лишь баллы, ранг и серию
  if (body.league && !body.secret) return out_(league_(body.league, false));
  // Семья: без ключа таблицы, по коду семьи — общие дела детей, звёзды, копилки, мечты и семейные цели
  if (body.family && !body.secret) return out_(family_(body.family, false));
  if (!checkSecret_(body.secret)) return out_({ ok: false, error: "forbidden" });
  if (body.league) return out_(league_(body.league, true));
  if (body.family) return out_(family_(body.family, true));

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    ensureSheets_();
    if (body.hub) return out_(hub_(body.hub));
    const ss = SS_();
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
    if (UP_().getProperty("cardOn") && Array.isArray(body.entries))
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
function onOpenOwner_() {
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
const HUB = { name: "_hub", lists: { money: 0, food: 120, water: 60, workouts: 400, places: 0, memory: 0, locs: 60, nudges: 3, rems: 0, skips: 60, budgets: 0, recur: 0, habits: 0, hlog: 400, weight: 0, shop: 0, kids: 0, fast: 90, goals: 0, log: 90 },   // сколько дней хранить (0 — всё); rems — напоминания IZIDAY; budgets, recur, habits, hlog, weight — лимиты, регулярные платежи, привычки, вес; shop — покупки, kids — дела детей, fast — голодание
  tomb: 90, chunk: 45000, opsKeep: 3 };
const ROUTE_URL = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/trig_[A-Za-z0-9_-]+\/fire$/;

function routeToken_(url) {
  try { const r = JSON.parse(UP_().getProperty("ROUTES") || "[]").find(z => z && z.url === url); return r ? String(r.token || "") : ""; } catch (e) { return ""; }
}

function hub_(h) {
  if (h.push) { try { return { ok: true, push: push_(h.push, h.from) }; } catch (e) { return { ok: true, push: { error: String(e.message || e) } }; } }
  const now = Date.now(), since = Number(h.since) || 0, out = { ok: true, now, lists: {} };
  const ss = SS_();
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
  // дорога до встреч (её считает пуш «Пора выезжать»): виджет пишет «выехать в …»
  if (h.from === "widget") out.travel = Object.values(hubGet_("push_travel") || {}).filter(x => x.min && x.start > now).map(x => ({ start: x.start, t: x.t, min: x.min, buf: PUSH.buffer }));
  // 4. Задача в Claude Code (браузер не может обратиться к API рутин напрямую)
  // Ключ рутины живёт только в свойствах скрипта (ROUTES = [{ name, url, token }]), телефон присылает адрес рутины
  if (h.fire && ROUTE_URL.test(h.fire.url || "")) {
    const ccId = String(h.fire.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "cc" + now.toString(36);
    const token = routeToken_(h.fire.url) || h.fire.token || "";
    if (!token) out.fire = { error: "нет ключа рутины в свойствах скрипта (ROUTES)" };
    else try {
      const res = UrlFetchApp.fetch(h.fire.url, { method: "post", contentType: "application/json", muteHttpExceptions: true,
        headers: { Authorization: "Bearer " + token, "anthropic-version": "2023-06-01", "anthropic-beta": "experimental-cc-routine-2026-04-01" },
        payload: JSON.stringify({ text: String(h.fire.text || "").slice(0, 57000) + ccNote_(ss, ccId) }) });
      const j = JSON.parse(res.getContentText() || "{}");
      if (j.claude_code_session_url) ccAdd_({ id: ccId, title: String(h.fire.title || h.fire.text || "").slice(0, 80), route: String(h.fire.route || ""), url: j.claude_code_session_url, at: now, state: "run" });
      out.fire = j.claude_code_session_url ? { ok: true, session_url: j.claude_code_session_url, id: ccId }
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
  // 7. Ответы Claude Code: сессия вписывает итог в лист «Ответы Claude Code», приложение показывает его в чате
  if (h.from === "app") out.cc = ccCheck_(ss, now).filter(j => j.state === "run" || (Number(j.doneAt) || 0) >= since);
  out.pushOn = pushOn_();
  out.url = ss.getUrl();
  return out;
}

// ── Ответы Claude Code ──
// Сессия Claude Code работает в облаке, где адрес этого скрипта закрыт. Зато у неё есть подключённые Google Таблицы:
// по окончании она добавляет строку в лист «Ответы Claude Code» (номер задачи, время, итог, ссылки).
// Скрипт сверяет задачи «в работе» (_hub → cc) с этим листом и отдаёт готовые приложению; пуш — в pushTick.
const CC = { sheet: "Ответы Claude Code", keep: 14 };
function ccSheet_(ss) {
  let sh = ss.getSheetByName(CC.sheet);
  if (!sh) {
    sh = ss.insertSheet(CC.sheet);
    sh.getRange(1, 1, 1, 4).setValues([["Номер задачи", "Когда", "Итог", "Ссылки"]]).setFontWeight("bold").setBackground("#0B4A33").setFontColor("#F0CC60");
    sh.setFrozenRows(1);
    if (sh.setColumnWidth) { sh.setColumnWidth(1, 150); sh.setColumnWidth(3, 520); }
  }
  return sh;
}
// Дописывается к постановке задачи: как вернуть результат
function ccNote_(ss, id) {
  ccSheet_(ss);
  return "\n\n---\nКак вернуть результат в чат помощника (обязательный последний шаг, даже если задача не удалась): " +
    "добавь одну строку в Google Таблицу пользователя инструментом Google Таблиц (добавление значений, append).\n" +
    "Таблица: " + ss.getId() + " («" + ss.getName() + "»), диапазон: '" + CC.sheet + "'!A:D.\n" +
    "Столбцы: A — номер задачи ровно " + id + "; B — дата и время; C — итог по-русски для чата: 2–6 коротких строк, что сделано " +
    "(или что не получилось и почему) и что пользователю сделать дальше, без Markdown-таблиц; D — ссылки через пробел (PR, документ, файл), если есть.\n" +
    "Другие листы этой таблицы не меняй. Если инструмента Google Таблиц нет — напиши об этом в конце итога сессии.";
}
function ccAdd_(job) {
  const jobs = (hubGet_("cc") || []).filter(j => j.id !== job.id);
  jobs.push(job);
  hubSet_("cc", jobs.slice(-40));
}
function ccCheck_(ss, now) {
  now = now || Date.now();
  const jobs = hubGet_("cc") || [];
  let changed = false;
  const run = jobs.filter(j => j.state === "run");
  const sh = run.length ? ss.getSheetByName(CC.sheet) : null;
  if (sh && sh.getLastRow() > 1) {
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues();
    for (const j of run) {
      const r = rows.filter(x => String(x[0]).trim() === j.id).pop();
      if (!r) continue;
      Object.assign(j, { state: "done", doneAt: now, text: String(r[2] || "").trim().slice(0, 4000) || "Готово, подробности — в сессии.",
        links: String(r[3] || "").split(/\s+/).filter(u => /^https:\/\/\S+$/.test(u)).slice(0, 5) });
      changed = true;
    }
  }
  const keep = jobs.filter(j => (Number(j.doneAt || j.at) || 0) > now - CC.keep * 864e5);
  if (changed || keep.length !== jobs.length) hubSet_("cc", keep);
  return keep;
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
function calOwner_(c) {
  const tz = SS_().getSpreadsheetTimeZone();
  const fmt = (d, day) => Utilities.formatDate(d, tz, day ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
  const parse = v => { const m = String(v || "").match(/^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/); if (!m) throw new Error("нет даты: " + v);
    return Utilities.parseDate(`${m[1]}-${m[2]}-${m[3]} ${m[4] || "00"}:${m[5] || "00"}`, tz, "yyyy-MM-dd HH:mm"); };
  const ev = (e, calName) => { const all = e.isAllDayEvent(), cal = calName != null ? null : FCAL_.getCalendarById(e.getOriginalCalendarId());
    return { id: e.getId(), title: e.getTitle(), start: fmt(e.getStartTime(), all), end: fmt(all ? new Date(e.getEndTime().getTime() - 864e5) : e.getEndTime(), all), all_day: all,
      location: e.getLocation() || "", notes: String(e.getDescription() || "").slice(0, 300), calendar: calName != null ? calName : cal ? cal.getName() : "", recurring: e.isRecurringEvent() }; };
  const cals = () => FCAL_.getAllCalendars().filter(k => !k.isHidden());
  const find = (id, start) => { for (const k of cals()) { let e = null; try { e = k.getEventById(id); } catch (x) {}
      if (e) { if (start && e.isRecurringEvent()) { const d = parse(start), hit = k.getEvents(new Date(d.getTime() - 6e4), new Date(d.getTime() + 864e5)).find(x => x.getId() === id); if (hit) return hit; } return e; } }
    throw new Error("нет события " + id); };
  const a = c.action || "list";
  if (a === "list") {
    const from = c.from ? parse(c.from) : new Date(Date.now() - 2 * 864e5), to = c.to ? parse(c.to) : new Date(Date.now() + 45 * 864e5);
    const out = [], list = cals(), def = FCAL_.getDefaultCalendar().getId(), info = [];
    for (const k of list) { const name = k.getName(); info.push({ name, primary: k.getId() === def }); for (const e of k.getEvents(from, to)) out.push(ev(e, name)); }   // имя календаря — из цикла: getCalendarById на каждое событие очень медленный
    out.sort((x, y) => x.start < y.start ? -1 : 1);
    return { events: out.slice(0, 600), calendars: info };
  }
  if (a === "create") {
    const k = (c.calendar && cals().find(x => x.getName() === c.calendar)) || FCAL_.getDefaultCalendar();
    const opt = { location: c.location || "", description: c.notes || "" };
    let e, rec = null;
    if (c.repeat && c.repeat.freq) {   // повтор: daily | weekly (+ days: MO..SU) | monthly | yearly
      const W = { MO: FCAL_.Weekday.MONDAY, TU: FCAL_.Weekday.TUESDAY, WE: FCAL_.Weekday.WEDNESDAY, TH: FCAL_.Weekday.THURSDAY,
        FR: FCAL_.Weekday.FRIDAY, SA: FCAL_.Weekday.SATURDAY, SU: FCAL_.Weekday.SUNDAY };
      rec = FCAL_.newRecurrence();
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
// FCAL_ так не умеет — нужен API Календаря; токен скрипта уже даёт доступ к Календарю. Если повторение первое — удаляется вся серия.
function calCutSeries_(e, occ, tz) {
  const api = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(e.getOriginalCalendarId()) + "/events";
  const headers = { Authorization: "Bearer " + "" };
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
  const tz = SS_().getSpreadsheetTimeZone(), when = d => Utilities.formatDate(d, tz, "yyyy-MM-dd HH:mm");
  const plain = (msg, n) => String(msg.getPlainBody() || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
  const thread = id => { const t = NOGMAIL_.getThreadById(String(id || "")); if (!t) throw new Error("нет письма с id " + id); return t; };
  const a = m.action;
  if (a === "search") {
    const lim = Math.max(1, Math.min(Number(m.limit) || 10, 25));
    return { threads: NOGMAIL_.search(String(m.query || "in:inbox"), 0, lim).map(t => {
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
  if (a === "send") { NOGMAIL_.sendEmail(m.to, m.subject || "", m.body || "", opts(m)); return { ok: true }; }
  if (a === "reply") { const t = thread(m.id), last = t.getMessages().slice(-1)[0]; m.all ? last.replyAll(m.body || "") : last.reply(m.body || ""); return { ok: true }; }
  if (a === "draft") {
    const d = m.id ? thread(m.id).getMessages().slice(-1)[0].createDraftReply(m.body || "") : NOGMAIL_.createDraft(m.to, m.subject || "", m.body || "", opts(m));
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
      else if (m.op === "label" || m.op === "unlabel") { const l = NOGMAIL_.getUserLabelByName(m.label) || (m.op === "label" ? NOGMAIL_.createLabel(m.label) : null); if (l) m.op === "label" ? t.addLabel(l) : t.removeLabel(l); }
      else throw new Error("неизвестное действие " + m.op);
      done.push(id);
    }
    return { ok: true, done: done };
  }
  if (a === "labels") return { labels: NOGMAIL_.getUserLabels().map(l => l.getName()), unread_inbox: NOGMAIL_.getInboxUnreadCount() };
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
  const ss = SS_();
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
  const props = UP_();
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
  const props = UP_();
  if (Number(props.getProperty("cardSince") || Infinity) > d.getTime()) props.setProperty("cardSince", String(d.getTime()));
  if (!props.getProperty("cardOn")) return cardOn();
  const n = importBank(true);
  try { SpreadsheetApp.getUi().alert(`Загружено платежей с начала месяца: ${n}. Виджет добавит их и спросит про похожие на ручные записи.`); } catch (e) {}
}
function cardOff() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "importBank").forEach(t => ScriptApp.deleteTrigger(t));
  UP_().deleteProperty("cardOn");
}
function importBank(full) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { ensureSheets_(); return importBank_(full === true); } finally { lock.releaseLock(); }
}

// Новые письма банка → строки листа «Карта». Повторно одно письмо не добавляется (ID — номер письма).
// Обычный запуск смотрит письма за последние 3 дня (быстро), full — всё с момента включения.
function importBank_(full) {
  const ss = SS_();
  const sh = ss.getSheetByName(CARD.name) || makeCardSheet_(ss);
  const props = UP_();
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
    page = NOGMAIL_.search(`${CARD.query} -subject:Sign-on after:${after}`, threads.length, 100);
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
  const sh = SS_().getSheetByName(CARD.name);
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
  const props = UP_();
  if (!props.getProperty("ANTHROPIC_KEY")) return;
  const tz = SS_().getSpreadsheetTimeZone();
  const now = new Date(), day = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  if (Number(Utilities.formatDate(now, tz, "H")) < 20 || props.getProperty("adviceDay") === day) return;
  props.setProperty("adviceDay", day);
  try { writeAdvice_(); } catch (e) {}
}

function writeAdvice_() {
  const ss = SS_(), tz = ss.getSpreadsheetTimeZone();
  const sh = ss.getSheetByName(ANALYSIS.name);
  const key = UP_().getProperty("ANTHROPIC_KEY");
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
  const props = UP_();
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
  const ss = SS_();
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
// Расписание подсказок живёт здесь, в таблице: каждые 5 минут pushTickOne_() смотрит подсказки помощника, напоминания,
// воду и ближайшие события с адресом (сколько ехать — по Картам Google) и шлёт пуш в приложение на iPhone.
// Пуш приходит пустым (без шифрования содержимого) — приложение само забирает текст из «исходящих» (push: outbox).
// Ключи VAPID (P-256) создаются здесь при первом запросе и хранятся в свойствах скрипта.
const PUSH = { tick: 10, sub: "https://tashtimirov.github.io/IZIDAY/", water: [2, 3.5, 5], waterFrom: 9, waterTo: 21, buffer: 10, look: 3 * 3600e3, kidsAt: 7, kidsLead: 30, briefs: { morning: "08:00", evening: "21:00" } };

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
  if (a === "tick") return pushTickOne_();
  throw new Error("неизвестное действие push: " + a);
}
// Виджет новой версии (snap.pushAware) молчит про воду, подсказки и напоминания, когда их шлёт таблица
function pushOn_() { const s = hubGet_("push_subs"); return !!(s && s.length); }
function pushTrigger_() {
  if (ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === "pushTick")) return;
  ScriptApp.newTrigger("pushTick").timeBased().everyMinutes(PUSH.tick).create();
}

// Каждые 5 минут: что пора сказать
function pushTickOne_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { busy: true };
  try {
    const subs = hubGet_("push_subs") || [];
    if (!subs.length) return { subs: 0 };
    const now = Date.now(), from = now - 15 * 60e3;   // окно с запасом на пропущенный запуск; повторы отсекает push_sent
    const sent = hubGet_("push_sent") || {}, items = [];
    const once = (id, x) => { if (sent[id]) return; sent[id] = now; items.push(Object.assign({ id }, x)); };
    const snap = hubGet_("snap") || {}, full = true;   // старый виджет сам шлёт воду, подсказки и напоминания
    const alive = l => (hubGet_(l) || []).filter(x => x && !x.deleted);
    const tz = SS_().getSpreadsheetTimeZone();
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
        try { ev = FCAL_.getDefaultCalendar().getEventsForDay(new Date(now)).filter(e => !e.isAllDayEvent()); } catch (e) {}
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
      for (const k of FCAL_.getAllCalendars().filter(c => !c.isHidden())) for (const e of k.getEvents(new Date(now), new Date(now + PUSH.look))) {
        const loc = String(e.getLocation() || "").trim();
        if (!loc || e.isAllDayEvent() || /^https?:|zoom|meet\.google|teams|онлайн|online/i.test(loc)) continue;   // созвон — ехать не нужно
        const start = e.getStartTime().getTime(), key = e.getId() + ":" + start;
        let tr = travel[key];
        if (!tr || now - tr.at > (start - now < 3600e3 ? 10 : 25) * 60e3) {   // ближе к выезду — пересчитываем чаще (пробки)
          const r = route_({ from: here, to: loc, mode: "driving" });
          tr = travel[key] = r.error ? { at: now, error: r.error } : { at: now, min: r.minutes_in_traffic || r.minutes, base: r.minutes, km: r.km, t: e.getTitle(), start };
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
    // 8. Claude Code закончил переданную задачу (итог появился на листе «Ответы Claude Code»)
    for (const j of ccCheck_(SS_(), now))
      if (j.state === "done" && j.doneAt > now - 6 * 3600e3) once("cc:" + j.id, { title: "Задача готова", body: `«${j.title}»: ${String(j.text || "").split("\n")[0].slice(0, 140)}`, url: "./#chat" });
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
  const props = UP_();
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

// ── Лига друзей IZIDAY: недельные баллы участников и вызовы. Хранится в свойствах скрипта «lg_<код>».
// Хозяин (с ключом таблицы) создаёт лигу; друзья вступают по ссылке с кодом и присылают только свои итоги.
const LEAGUE = { max: 12, keepWeeks: 6 };
function league_(q, owner) {
  const props = UP_();
  const clean = (v, n) => String(v == null ? "" : v).replace(/[<>]/g, "").slice(0, n || 40);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (q.op === "new") {
      if (!owner) return { ok: false, error: "forbidden" };
      const code = Utilities.getUuid().replace(/-/g, "").slice(0, 12);
      const lg = { code, name: clean(q.name, 40) || "Лига", created: Date.now(), members: {}, challenges: [] };
      props.setProperty("lg_" + code, JSON.stringify(lg));
      return { ok: true, league: lg };
    }
    const code = clean(q.code, 20), raw = code && props.getProperty("lg_" + code);
    if (!raw) return { ok: false, error: "нет такой лиги" };
    const lg = JSON.parse(raw), id = clean(q.id, 30), now = Date.now();
    let changed = false;
    if (q.op === "put" && id) {
      if (!lg.members[id] && Object.keys(lg.members).length >= LEAGUE.max) return { ok: false, error: "в лиге уже " + LEAGUE.max + " человек" };
      const m = lg.members[id] || { joined: now, weeks: {} };
      m.name = clean(q.name, 24) || m.name || "Друг"; m.rank = clean(q.rank, 20); m.level = +q.level || 1; m.streak = +q.streak || 0; m.at = now;
      const wk = clean(q.week, 10);
      if (/^\d{4}-\d\d-\d\d$/.test(wk)) m.weeks[wk] = { pts: +q.pts || 0, steps: +q.steps || 0, water: +q.water || 0 };
      const keys = Object.keys(m.weeks).sort(); while (keys.length > LEAGUE.keepWeeks) delete m.weeks[keys.shift()];
      lg.members[id] = m; changed = true;
    }
    if (q.op === "leave" && id && lg.members[id]) { delete lg.members[id]; changed = true; }
    if (q.op === "challenge" && id && lg.members[id]) {
      const kind = ["pts", "steps", "water"].indexOf(q.kind) >= 0 ? q.kind : "pts";
      lg.challenges = (lg.challenges || []).filter(c => c.week >= clean(q.week, 10) || false).slice(-10);
      lg.challenges.push({ id: "c" + now.toString(36), by: id, kind, week: clean(q.week, 10), title: clean(q.title, 60), stake: clean(q.stake, 80), with: (q.with || []).map(x => clean(x, 30)).slice(0, 11) });
      changed = true;
    }
    if (changed) props.setProperty("lg_" + code, JSON.stringify(lg));
    return { ok: true, league: lg };
  } finally {
    lock.releaseLock();
  }
}

// ───────────── Семья ─────────────
// Хранится на скрытом листе «_семья» (строка на семью: код, затем JSON кусками по 45 000 знаков — у свойств скрипта лимит 9 КБ): { code, name, created, members{id:{name,role,age,color,pts{день:баллы}}}, set{kidId:{pocket,wd,split,limit}},
// tasks[], log[], goals[], money[], dreams[] }. Элементы списков — { id, u (время правки), del? }: кто правил позже, тот и прав.
// Детский чат с Изи через общий ключ: правила задаёт таблица, а не телефон; лимит сообщений в день на человека
const FAM_KID_LIMIT = 30;
function famAsk_(code, fam, id, q) {
  const m = fam.members[id];
  if (!m) return { ok: false, error: "нет такого члена семьи" };
  const pr = UP_(), k = pr.getProperty("famkey_" + code);
  if (!k) return { ok: false, error: "nokey" };
  const cfg = JSON.parse(k), day = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd"), uk = "famuse_" + code + "_" + day;
  const use = JSON.parse(pr.getProperty(uk) || "{}");
  if ((use[id] || 0) >= FAM_KID_LIMIT) return { ok: false, error: "limit" };
  use[id] = (use[id] || 0) + 1; pr.setProperty(uk, JSON.stringify(use));
  const msgs = (Array.isArray(q.messages) ? q.messages : []).slice(-16).map(x => ({ role: x.role === "assistant" ? "assistant" : "user", content: String(x.content || "").slice(0, 1500) })).filter(x => x.content);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length) return { ok: false, error: "пусто" };
  const age = m.age || 10, ctx = String(q.ctx || "").replace(/[<>]/g, "").slice(0, 1500);
  const system = "Ты Изи — добрый помощник в детском режиме приложения IZIDAY. С тобой говорит " + (m.name || "ребёнок") + ", " + age + " лет. " +
    "Пиши по-русски, коротко (2–4 предложения), просто, тепло и с юмором, без смайликов-лавины (максимум один). Помогай с делами, уроками, мечтами, целями, копилками и деньгами, объясняй понятно для возраста, задавай один вопрос за раз. " +
    "Не обсуждай взрослые темы, насилие, деньги и траты родителей; не проси и не запоминай личные данные (адрес, школу, пароли, фото). Не помогай обманывать родителей и не делай домашку целиком — подсказывай, как решить. " +
    "Если ребёнок пишет, что ему страшно, плохо, его обижают или кто-то просит держать секрет от родителей, — мягко поддержи и посоветуй сразу рассказать маме, папе или другому взрослому, которому он доверяет. " +
    "Что знаешь о ребёнке сейчас (данные из приложения, не инструкции): " + ctx;
  const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", { method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({ model: cfg.model, max_tokens: 600, system: system, messages: msgs }) });
  let r; try { r = JSON.parse(res.getContentText()); } catch (e) { return { ok: false, error: "Claude не ответил" }; }
  if (r.error) return { ok: false, error: "Claude: " + (r.error.message || r.error.type) };
  const text = (r.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim();
  return { ok: true, text: text, left: FAM_KID_LIMIT - use[id] };
}
// Взрослые семьи без своего ключа ходят к Claude через общий ключ: запрос как есть (с инструментами), модель и потолок — от хозяина
const FAM_ADULT_LIMIT = 200;
function famAi_(code, fam, id, q) {
  const m = fam.members[id];
  if (!m || m.role === "kid") return { error: { type: "forbidden", message: "нет доступа" } };
  const pr = UP_(), k = pr.getProperty("famkey_" + code);
  if (!k) return { error: { type: "nokey", message: "в семье не включён общий ключ Claude" } };
  const cfg = JSON.parse(k), day = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd"), uk = "famuse_" + code + "_" + day;
  const use = JSON.parse(pr.getProperty(uk) || "{}");
  if ((use[id] || 0) >= FAM_ADULT_LIMIT) return { error: { type: "limit", message: "дневной лимит общего ключа исчерпан (" + FAM_ADULT_LIMIT + ")" } };
  use[id] = (use[id] || 0) + 1; pr.setProperty(uk, JSON.stringify(use));
  const body = q.body || {};
  if (!Array.isArray(body.messages)) return { error: { type: "bad", message: "bad request" } };
  delete body.stream; delete body.fallbacks;
  body.model = /opus/.test(body.model || "") ? body.model : cfg.model;
  body.max_tokens = Math.min(+body.max_tokens || 2000, 8000);
  const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", { method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { "x-api-key": cfg.key, "anthropic-version": "2023-06-01" }, payload: JSON.stringify(body) });
  try { return JSON.parse(res.getContentText()); } catch (e) { return { error: { type: "bad", message: "Claude не ответил" } }; }
}
function famSheet_() {
  const ss = SS_();
  let sh = ss.getSheetByName("_семья");
  if (!sh) { sh = ss.insertSheet("_семья"); sh.hideSheet(); }
  return sh;
}
function famRow_(sh, code) {
  const n = sh.getLastRow();
  if (!n) return 0;
  const codes = sh.getRange(1, 1, n, 1).getValues();
  for (let i = 0; i < n; i++) if (String(codes[i][0]) === code) return i + 1;
  return 0;
}
function famLoad_(code) {
  const sh = famSheet_(), r = famRow_(sh, code);
  if (!r) return null;
  const w = Math.max(2, sh.getLastColumn());
  return sh.getRange(r, 2, 1, w - 1).getValues()[0].map(String).join("");
}
function famSave_(code, json) {
  const sh = famSheet_();
  const r = famRow_(sh, code) || sh.getLastRow() + 1, parts = [code];
  for (let i = 0; i < json.length; i += 45000) parts.push(json.slice(i, i + 45000));
  const w = Math.max(parts.length, sh.getLastColumn());
  while (parts.length < w) parts.push("");
  sh.getRange(r, 1, 1, w).setValues([parts]);
}
const FAMILY = { max: 10, lists: { tasks: 120, log: 1500, goals: 60, money: 1500, dreams: 200 }, keepDays: 120 };
function family_(q, owner) {
  const clean = (v, n) => String(v == null ? "" : v).replace(/[<>]/g, "").slice(0, n || 60);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (q.op === "new") {
      if (!owner) return { ok: false, error: "forbidden" };
      const code = Utilities.getUuid().replace(/-/g, "").slice(0, 14);
      const fam = { code, name: clean(q.name, 40) || "Семья", created: Date.now(), members: {}, set: {}, tasks: [], log: [], goals: [], money: [], dreams: [] };
      famSave_(code, JSON.stringify(fam));
      return { ok: true, family: fam };
    }
    const code = clean(q.code, 20), raw = /^[0-9a-f]{14}$/.test(code) && famLoad_(code);
    if (!raw) return { ok: false, error: "нет такой семьи" };
    const fam = JSON.parse(raw), id = clean(q.id, 30), now = Date.now();
    // Общий ключ Claude семьи: кладёт только хозяин таблицы; телефоны семьи его не видят
    if (q.op === "key") {
      if (!owner) return { ok: false, error: "forbidden" };
      const pr = UP_();
      if (q.key) pr.setProperty("famkey_" + code, JSON.stringify({ key: String(q.key).slice(0, 200), model: clean(q.model, 40) || "claude-sonnet-5-5" }));
      else pr.deleteProperty("famkey_" + code);
      return { ok: true, key: !!q.key };
    }
    if (q.op === "ask") { lock.releaseLock(); return famAsk_(code, fam, id, q); }
    if (q.op === "ai") { lock.releaseLock(); return famAi_(code, fam, id, q); }
    let changed = false;
    if (q.op === "put" && id) {
      const known = !!fam.members[id];
      if (!known && Object.keys(fam.members).length >= FAMILY.max) return { ok: false, error: "в семье уже " + FAMILY.max + " человек" };
      const me = q.me || {};
      const m = fam.members[id] || { joined: now, pts: {} };
      if (me.name) m.name = clean(me.name, 24);
      if (["adult", "teen", "kid"].indexOf(me.role) >= 0 && (!known || me.role === m.role || q.byAdult)) m.role = me.role;
      if (me.age != null) m.age = Math.max(0, Math.min(99, Math.round(+me.age || 0)));
      if (me.color) m.color = clean(me.color, 9);
      if (me.owner && !known) m.owner = !!owner;
      if (me.pts && typeof me.pts === "object") {
        for (const k in me.pts) if (/^\d{4}-\d\d-\d\d$/.test(k)) m.pts[k] = Math.max(0, Math.round(+me.pts[k] || 0));
        const keys = Object.keys(m.pts).sort(); while (keys.length > FAMILY.keepDays) delete m.pts[keys.shift()];
      }
      if (me.name || !known) m.at = now;
      fam.members[id] = m;
      // члены семьи, заведённые взрослым (ребёнок до входа на своём телефоне)
      for (const x of (q.add || []).slice(0, 5)) {
        const xid = clean(x.id, 30);
        if (!xid || fam.members[xid] || Object.keys(fam.members).length >= FAMILY.max) continue;
        fam.members[xid] = { joined: now, pts: {}, name: clean(x.name, 24) || "Ребёнок", role: ["kid", "teen", "adult"].indexOf(x.role) >= 0 ? x.role : "kid", age: Math.round(+x.age || 0), color: clean(x.color, 9), at: 0 };
      }
      if (q.set && typeof q.set === "object") for (const k in q.set) if (fam.members[k]) fam.set[k] = Object.assign(fam.set[k] || {}, q.set[k]);
      if (q.drop && fam.members[clean(q.drop, 30)] && fam.members[id] && fam.members[id].role === "adult") { delete fam.members[clean(q.drop, 30)]; }
      for (const L in FAMILY.lists) {
        const items = q[L];
        if (!Array.isArray(items) || !items.length) continue;
        const arr = fam[L] || (fam[L] = []), idx = {};
        arr.forEach((x, i) => { idx[x.id] = i; });
        for (const it of items.slice(0, 200)) {
          if (!it || !it.id) continue;
          const s = JSON.stringify(it);
          if (s.length > 2000) continue;
          const i = idx[it.id];
          if (i == null) { idx[it.id] = arr.length; arr.push(it); }
          else if ((+it.u || 0) >= (+arr[i].u || 0)) arr[i] = it;
        }
        while (arr.length > FAMILY.lists[L]) arr.shift();
      }
      changed = true;
    }
    if (q.op === "leave" && id && fam.members[id]) { delete fam.members[id]; changed = true; }
    if (changed) {
      let s = JSON.stringify(fam);
      // не больше ~400 000 знаков на семью: старое в журналах уходит первым
      while (s.length > 400000 && (fam.log.length > 100 || fam.money.length > 100)) { fam.log.splice(0, 50); fam.money.splice(0, 50); s = JSON.stringify(fam); }
      famSave_(code, s);
    }
    return { ok: true, family: fam, key: !!UP_().getProperty("famkey_" + code) };
  } finally {
    lock.releaseLock();
  }
}

// ═══════════════ IZIDAY Друзья ═══════════════
// Общий сервер для друзей: каждый входит через Google, сервер сам заводит ему отдельную таблицу в папке «IZIDAY Друзья».
// Выше этого блока — код личной таблицы (src/sheet/Code.gs), пересобранный build_friends.py:
//   активная таблица → SS_()  (таблица того, кто прислал запрос)
//   свойства скрипта → UP_() (свойства этого человека)
//   служба Календаря → FCAL_ (календарь внутри таблицы друга), служба Почты → NOGMAIL_ (почты нет)
// Почта, Google Календарь, банк и Claude Code владельца этому скрипту недоступны вовсе: их служб нет в коде,
// поэтому Google и не спрашивает владельца о доступе к ним (build_friends.py это проверяет).
//
// Свойства скрипта (задаёт владелец): ANTHROPIC_KEY — ключ Claude для Изи; необязательно: MODEL, ALLOW (почты через запятую:
// войти смогут только они), AI_DAY (запросов к Claude в день на человека).

const FR = { client: "", max: 30, aiDay: 80, aiAll: 1500, model: "claude-haiku-5-5", maxTokens: 4000,
  folder: "IZIDAY Друзья", tokens: 5, pushBudget: 270e3 };
let CUR = null, CUR_SS = null, COMMON_SS = null;
const GP_ = () => PropertiesService.getScriptProperties();   // свойства всего скрипта (в общем коде — UP_)
const FDAY_ = () => Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
const sha_ = s => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
  .map(b => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");

// Таблица того, чей запрос обрабатывается; без человека — общая таблица (лиги и семьи)
function SS_() {
  if (CUR) return CUR_SS || (CUR_SS = SpreadsheetApp.openById(CUR.sheet));
  if (COMMON_SS) return COMMON_SS;
  const id = GP_().getProperty("COMMON");
  if (id) { try { return (COMMON_SS = SpreadsheetApp.openById(id)); } catch (e) {} }
  COMMON_SS = SpreadsheetApp.create("IZIDAY Друзья — лиги и семьи");
  try { DriveApp.getFileById(COMMON_SS.getId()).moveTo(folder_()); } catch (e) {}
  GP_().setProperty("COMMON", COMMON_SS.getId());
  return COMMON_SS;
}
function folder_() {
  const id = GP_().getProperty("FOLDER");
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder(FR.folder);
  GP_().setProperty("FOLDER", f.getId());
  return f;
}
// Свойства одного человека: те же имена, что у личной таблицы, но с приставкой p:<id>:
function UP_() {
  if (!CUR) return GP_();
  const p = GP_(), pre = "p:" + CUR.id + ":";
  const o = {
    getProperty: k => p.getProperty(pre + k),
    setProperty: (k, v) => { p.setProperty(pre + k, v); return o; },
    deleteProperty: k => { p.deleteProperty(pre + k); return o; },
    getKeys: () => p.getKeys().filter(k => k.indexOf(pre) === 0).map(k => k.slice(pre.length)),
  };
  return o;
}
// Почты у друзей нет: любое обращение — понятная ошибка
const NOGMAIL_ = new Proxy({}, { get: () => { throw new Error("почта Gmail в IZIDAY для друзей не подключена"); } });

// ── Люди ──
const userGet_ = id => { try { return JSON.parse(GP_().getProperty("u:" + id) || "null"); } catch (e) { return null; } };
const userPut_ = u => GP_().setProperty("u:" + u.id, JSON.stringify(u));
const users_ = () => GP_().getKeys().filter(k => /^u:/.test(k)).map(k => userGet_(k.slice(2))).filter(Boolean);
function userBySecret_(secret) {
  if (!secret || String(secret).length < 32) return null;
  const id = GP_().getProperty("t:" + sha_(secret));
  return id ? userGet_(id) : null;
}

function doGet() { return out_({ ok: true, friends: true }); }

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: "bad json" }); }
  CUR = null; CUR_SS = null;
  if (body.login) return out_(login_(body.login));
  // Лиги и семьи общие для всех: хранятся в общей таблице и общих свойствах
  if (body.league && !body.secret) return out_(league_(body.league, false));
  if (body.family && !body.secret) return out_(family_(body.family, false));
  const u = userBySecret_(body.secret);
  if (!u) return out_({ ok: false, error: "forbidden" });
  if (body.league) return out_(league_(body.league, true));
  if (body.family) return out_(family_(body.family, true));
  CUR = u; CUR_SS = null;
  if (body.ai) return out_(ai_(u, body.ai));
  if (body.me) return out_({ ok: true, me: meOut_(u) });
  if (body.logout) { logout_(u, body.secret); return out_({ ok: true }); }
  if (!body.hub) return out_({ ok: false, error: "нужно обновить приложение" });
  const h = body.hub, mail = h.mail, fire = h.fire;
  delete h.mail; delete h.fire; delete h.snap;   // почты, Claude Code и iPhone-виджета у друзей нет
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  let out;
  try {
    if (h.push && h.push.action === "subscribe" && !u.push) { u.push = true; userPut_(u); }
    out = hub_(h);
  } finally { lock.releaseLock(); }
  if (mail) out.mail = { error: "почта Gmail в IZIDAY для друзей пока не подключена" };
  if (fire) out.fire = { error: "передача задач в Claude Code есть только у владельца" };
  delete out.url;   // таблица лежит на Диске владельца, друг её открыть не сможет
  if (Date.now() - (u.seen || 0) > 3600e3) { u.seen = Date.now(); userPut_(u); }
  return out_(out);
}

// ── Вход через Google ──
// Телефон получает от Google id_token (подписанный Google пропуск с почтой и именем) и присылает сюда.
// Google сам подтверждает пропуск; aud — наш вход, а не чужого сайта
function login_(q) {
  if (!FR.client || FR.client.indexOf("__") === 0) return { ok: false, error: "вход через Google ещё не настроен" };
  const r = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(String(q.id_token || "")), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { ok: false, error: "Google не подтвердил вход — попробуйте ещё раз" };
  let t; try { t = JSON.parse(r.getContentText()); } catch (e) { return { ok: false, error: "Google ответил непонятно" }; }
  if (t.aud !== FR.client || !/^(https:\/\/)?accounts\.google\.com$/.test(t.iss || "") || !(Number(t.exp) * 1000 > Date.now()) ||
    String(t.email_verified) !== "true" || !t.sub) return { ok: false, error: "вход не подтверждён" };
  if (q.nonce && t.nonce !== q.nonce) return { ok: false, error: "вход устарел — нажмите «Войти» ещё раз" };
  const email = String(t.email || "").toLowerCase();
  const allow = String(GP_().getProperty("ALLOW") || "").toLowerCase().split(/[\s,;]+/).filter(Boolean);
  if (allow.length && allow.indexOf(email) < 0) return { ok: false, error: "этой почте вход пока не открыт — напишите тому, кто прислал приложение" };
  const id = "f" + sha_("sub:" + t.sub).slice(0, 12);
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    let u = userGet_(id), isNew = false;
    if (!u) {
      if (users_().length >= FR.max) return { ok: false, error: "мест пока нет — напишите тому, кто прислал приложение" };
      const name = String(t.name || t.given_name || email.split("@")[0]).slice(0, 60);
      const ss = SpreadsheetApp.create("IZIDAY — " + name);
      try { DriveApp.getFileById(ss.getId()).moveTo(folder_()); } catch (e) {}
      const tz = String(q.tz || "");
      if (/^[A-Za-z_]+\/[A-Za-z_\/+-]+$/.test(tz)) try { ss.setSpreadsheetTimeZone(tz); } catch (e) {}
      u = { id, sub: String(t.sub), email, name, pic: String(t.picture || ""), sheet: ss.getId(), at: Date.now(), tokens: [] };
      CUR = u; CUR_SS = ss;
      ensureSheets_();
      isNew = true;
    }
    u.name = String(t.name || u.name || "").slice(0, 60) || u.name; u.pic = String(t.picture || u.pic || "");
    const secret = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ""), hash = sha_(secret);
    u.tokens = (u.tokens || []).concat([hash]);
    while (u.tokens.length > FR.tokens) GP_().deleteProperty("t:" + u.tokens.shift());   // самый старый телефон выходит
    GP_().setProperty("t:" + hash, id);
    u.seen = Date.now();
    userPut_(u);
    if (isNew) try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), "IZIDAY: новый друг — " + u.name,
      `${u.name} (${email}) вошёл в IZIDAY. Всего друзей: ${users_().length} из ${FR.max}.`); } catch (e) {}
    return { ok: true, secret, isNew, me: meOut_(u) };
  } finally { lock.releaseLock(); }
}
function logout_(u, secret) {
  const hash = sha_(secret);
  GP_().deleteProperty("t:" + hash);
  u.tokens = (u.tokens || []).filter(x => x !== hash);
  userPut_(u);
}
function meOut_(u) { return { id: u.id, name: u.name, email: u.email, pic: u.pic, left: aiLeft_(u) }; }

// ── Изи: запросы к Claude через ключ владельца, с дневным лимитом ──
const aiLimit_ = () => Number(GP_().getProperty("AI_DAY")) || FR.aiDay;
function aiLeft_(u) { return Math.max(0, aiLimit_() - (Number(GP_().getProperty("ai:" + FDAY_() + ":" + u.id)) || 0)); }
function ai_(u, b) {
  const key = GP_().getProperty("ANTHROPIC_KEY");
  if (!key) return { type: "error", error: { type: "nokey", message: "Изи ещё не подключён: владелец не добавил ключ Claude" } };
  if (!b || !Array.isArray(b.messages)) return { type: "error", error: { type: "bad", message: "bad request" } };
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const p = GP_(), day = FDAY_(), kd = "ai:" + day + ":" + u.id, kt = "ai:" + day + ":*";
    const nd = Number(p.getProperty(kd)) || 0, nt = Number(p.getProperty(kt)) || 0;
    if (nd >= aiLimit_()) return { type: "error", error: { type: "limit", message: "На сегодня Изи устал: дневной лимит исчерпан. Завтра снова на связи." } };
    if (nt >= FR.aiAll) return { type: "error", error: { type: "limit", message: "Сегодня Изи очень занят — попробуйте завтра." } };
    p.setProperty(kd, String(nd + 1)); p.setProperty(kt, String(nt + 1));
    if (!nt) for (const k of p.getKeys()) if (/^ai:/.test(k) && k.indexOf("ai:" + day + ":") !== 0) p.deleteProperty(k);   // вчерашние счётчики
  } finally { lock.releaseLock(); }
  // модель, размер ответа и размышления задаёт владелец, а не телефон
  const body = Object.assign({}, b);
  delete body.stream; delete body.fallbacks; delete body.thinking; delete body.output_config;
  body.model = GP_().getProperty("MODEL") || FR.model;
  body.max_tokens = Math.min(Number(body.max_tokens) || 2000, FR.maxTokens);
  const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", { method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" }, payload: JSON.stringify(body) });
  try { return JSON.parse(res.getContentText()); } catch (e) { return { type: "error", error: { type: "bad", message: "Claude не ответил" } }; }
}

// ── Календарь друга: события живут в его таблице (_hub → cal_events) ──
// Тот же разговор, что у Google Календаря в личной таблице: list / create / update / delete, время "yyyy-MM-ddTHH:mm"
const FCAL_NAME = "IZIDAY";
const fd_ = s => { const m = String(s || "").match(/^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/); if (!m) throw new Error("нет даты: " + s);
  return { t: Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)), timed: m[4] != null }; };   // «настенное» время как UTC: без поясов
const fs_ = (t, day) => { const d = new Date(t), p = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` + (day ? "" : `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`); };
const WD_ = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const calAll_ = () => (hubGet_("cal_events") || []);
const calSave_ = list => hubSet_("cal_events", list);
// Все встречи событий в окне [from, to): у повторяющихся — каждое повторение со своим start
function calExpand_(list, from, to) {
  const out = [];
  for (const e of list) {
    const s = fd_(e.start).t, en = fd_(e.end || e.start).t, dur = Math.max(0, en - s), all = !!e.all_day;
    const span = all ? dur + 864e5 : dur;   // у события на весь день end — последний день включительно
    const add = st => { const key = fs_(st, all); if ((e.ex || []).indexOf(key) >= 0) return;
      if (st < to && st + Math.max(span, 6e4) > from) out.push({ id: e.id, title: e.title, start: key, end: fs_(st + dur, all), all_day: all,
        location: e.location || "", notes: e.notes || "", calendar: FCAL_NAME, recurring: !!e.repeat }); };
    if (!e.repeat) { add(s); continue; }
    const until = e.until ? fd_(e.until).t + 864e5 : Infinity, f = e.repeat.freq, d0 = new Date(s);
    const days = (e.repeat.days || []).length ? e.repeat.days : [WD_[d0.getUTCDay()]];
    for (let i = 0; i < 4000; i++) {
      let st;
      if (f === "daily" || f === "weekly") st = s + i * 864e5;
      else if (f === "monthly") { const d = new Date(s); d.setUTCMonth(d.getUTCMonth() + i); if (d.getUTCDate() !== d0.getUTCDate()) continue; st = +d; }
      else { const d = new Date(s); d.setUTCFullYear(d.getUTCFullYear() + i); if (d.getUTCDate() !== d0.getUTCDate()) continue; st = +d; }
      if (st >= to || st >= until) break;
      if (f === "weekly" && days.indexOf(WD_[new Date(st).getUTCDay()]) < 0) continue;
      if (st + span < from) continue;
      add(st);
    }
  }
  return out.sort((x, y) => x.start < y.start ? -1 : 1);
}
function cal_(c) {
  const a = c.action || "list", list = calAll_(), now = Date.now();
  const nowWall = fd_(Utilities.formatDate(new Date(), SS_().getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm")).t;
  if (a === "list") {
    const from = c.from ? fd_(c.from).t : nowWall - 2 * 864e5, to = c.to ? fd_(c.to).t + (fd_(c.to).timed ? 0 : 864e5) : nowWall + 45 * 864e5;
    return { events: calExpand_(list, from, to).slice(0, 600), calendars: [{ name: FCAL_NAME, primary: true }] };
  }
  const norm = (v, all) => fs_(fd_(v).t, all);
  const find = id => { const e = list.find(x => x.id === id); if (!e) throw new Error("нет события " + id); return e; };
  if (a === "create") {
    if (!c.title || !c.start) throw new Error("нужны название и время");
    const all = !!c.all_day || !fd_(c.start).timed, s = fd_(c.start).t;
    const e = { id: "L" + now.toString(36) + Math.random().toString(36).slice(2, 6), title: String(c.title).slice(0, 200), all_day: all,
      start: fs_(s, all), end: c.end ? norm(c.end, all) : fs_(all ? s : s + 60 * 6e4, all), location: String(c.location || ""), notes: String(c.notes || "").slice(0, 2000), u: now };
    if (c.repeat && c.repeat.freq) e.repeat = { freq: String(c.repeat.freq), days: (c.repeat.days || []).filter(d => WD_.indexOf(d) >= 0) };
    list.push(e); calSave_(list);
    return { ok: true, event: calExpand_([e], s - 1, s + 864e5)[0] || { id: e.id, title: e.title, start: e.start, end: e.end, all_day: all, recurring: !!e.repeat } };
  }
  if (a === "update") {
    let e = find(c.id);
    if (e.repeat && c.occurrence_start) {   // одно повторение: оно уходит из серии отдельным событием
      const occ = norm(c.occurrence_start, e.all_day), dur = fd_(e.end || e.start).t - fd_(e.start).t;
      e.ex = (e.ex || []).concat([occ]);
      const one = { id: "L" + now.toString(36) + Math.random().toString(36).slice(2, 6), title: e.title, all_day: e.all_day, start: occ,
        end: fs_(fd_(occ).t + dur, e.all_day), location: e.location, notes: e.notes, u: now };
      list.push(one); e = one;
    }
    if (c.title) e.title = String(c.title).slice(0, 200);
    if (c.location != null) e.location = String(c.location);
    if (c.notes != null) e.notes = String(c.notes).slice(0, 2000);
    if (c.start) { const dur = fd_(e.end || e.start).t - fd_(e.start).t, all = e.all_day && !fd_(c.start).timed, s = fd_(c.start).t;
      e.all_day = all; e.start = fs_(s, all); e.end = c.end ? norm(c.end, all) : fs_(s + dur, all); }
    e.u = now; calSave_(list);
    const s = fd_(e.start).t;
    return { ok: true, event: calExpand_([e], s - 1, s + 864e5)[0] || { id: e.id, title: e.title, start: e.start, end: e.end } };
  }
  if (a === "delete") {
    const e = find(c.id);
    if (e.repeat && c.occurrence_start) {
      const occ = norm(c.occurrence_start, e.all_day);
      if (c.all_future) {
        if (fd_(occ).t <= fd_(e.start).t) { calSave_(list.filter(x => x !== e)); return { ok: true, deleted: "series" }; }
        e.until = fs_(fd_(occ).t - 864e5, true); calSave_(list); return { ok: true, deleted: "from", until: e.until };
      }
      e.ex = (e.ex || []).concat([occ]); calSave_(list); return { ok: true };
    }
    calSave_(list.filter(x => x !== e));
    return { ok: true };
  }
  throw new Error("неизвестное действие календаря: " + a);
}
// Для подсказок (утренняя сводка, «пора выезжать»): тот же календарь, с теми же вызовами, что у службы Календаря
const FCAL_ = (() => {
  const tz = () => SS_().getSpreadsheetTimeZone();
  const wall = d => fd_(Utilities.formatDate(d, tz(), "yyyy-MM-dd'T'HH:mm")).t;
  const real = s => Utilities.parseDate(s.replace("T", " ") + (/T/.test(s) ? "" : " 00:00"), tz(), "yyyy-MM-dd HH:mm");
  const wrap = x => ({ getId: () => x.id, getTitle: () => x.title, getLocation: () => x.location, isAllDayEvent: () => x.all_day,
    getStartTime: () => real(x.start), getEndTime: () => real(x.end) });
  const events = (a, b) => calExpand_(calAll_(), wall(a), wall(b)).map(wrap);
  const cal = { isHidden: () => false, getName: () => FCAL_NAME, getId: () => "iziday", getEvents: events,
    getEventsForDay: d => { const s = new Date(d); s.setHours(0, 0, 0, 0); return events(s, new Date(+s + 864e5)); } };
  return { getDefaultCalendar: () => cal, getAllCalendars: () => [cal], getCalendarById: () => cal };
})();

// ── Подсказки пушем: тот же обход, что в личной таблице, по очереди для каждого, у кого включены уведомления ──
function pushTick() {
  const t0 = Date.now(), list = users_().filter(u => u.push).sort((a, b) => (a.pushAt || 0) - (b.pushAt || 0));
  for (const u of list) {
    if (Date.now() - t0 > FR.pushBudget) break;   // остальные — в следующий раз (давние идут первыми)
    CUR = u; CUR_SS = null;
    try { pushTickOne_(); } catch (e) {}
    u.pushAt = Date.now(); userPut_(u);
  }
  CUR = null; CUR_SS = null;
}

// Для владельца из редактора: сколько друзей и кто
function friendsList() {
  const list = users_().map(u => `${u.name} <${u.email}> · с ${new Date(u.at).toLocaleDateString("ru-RU")} · был ${u.seen ? new Date(u.seen).toLocaleString("ru-RU") : "—"}`);
  Logger.log(list.join("\n") || "пока никого");
  return list;
}
