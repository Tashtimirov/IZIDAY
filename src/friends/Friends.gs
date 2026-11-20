// ═══════════════ IZIDAY Друзья ═══════════════
// Общий сервер для друзей: каждый входит через Google, сервер сам заводит ему отдельную таблицу в папке «IZIDAY Друзья».
// Выше этого блока — код личной таблицы (src/sheet/Code.gs), пересобранный build_friends.py:
//   активная таблица → SS_()  (таблица того, кто прислал запрос)
//   свойства скрипта → UP_() (свойства этого человека)
//   служба Календаря → FCAL_ (календарь внутри таблицы друга или его Google Календарь, если он его подключил), служба Почты → NOGMAIL_ (почты нет)
// Почта, Google Календарь, банк и Claude Code владельца этому скрипту недоступны вовсе: их служб нет в коде,
// поэтому Google и не спрашивает владельца о доступе к ним (build_friends.py это проверяет).
//
// Свойства скрипта (задаёт владелец): ANTHROPIC_KEY — ключ Claude для Изи, GOOGLE_CLIENT — номер входа Google, GOOGLE_SECRET — его секрет
// (для подключения Google Календаря друга); необязательно: MODEL, ALLOW (почты через запятую:
// войти смогут только они и приглашённые с одобрения), AI_DAY (запросов к Claude в день на человека), AI_ALL (в день на всех, по умолчанию 1500),
// REF_PER / REF_AUTO / REF_ONLY / SITE / SELF_URL — приглашения друзей (см. раздел «Пригласить друга» внизу).

const FR = { client: "__GOOGLE_CLIENT__", max: 30, aiDay: 80, aiPlus: 300, aiAll: 1500, model: "claude-haiku-5-5", maxTokens: 4000,
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

function doGet(e) {
  const q = (e && e.parameter) || {};
  if (q.ok && (q.a === "yes" || q.a === "no")) return growPage_(refDecide_(q.ok, q.a === "yes"));   // владелец: ссылка из письма о приглашении
  return out_({ ok: true, friends: true });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: "bad json" }); }
  CUR = null; CUR_SS = null;
  if (body.login) return out_(login_(body.login));
  if (body.metrics) return out_(metrics_(body.metrics, body.secret ? userBySecret_(body.secret) : null));   // журнал действий — без доступа к данным
  if (body.bug) return out_(bug_(body.bug, body.secret));   // недочёты: можно и без входа
  if (body.inv) return out_(inv_(body.inv));                 // код-шар: одноразовое приглашение в семью на 10 минут
  if (body.lead) return out_(lead_(body.lead, body.secret ? userBySecret_(body.secret) : null));   // заявка на подписку: можно и без входа
  // Лиги и семьи общие для всех: хранятся в общей таблице и общих свойствах
  if (body.league && !body.secret) return out_(league_(body.league, false));
  if (body.family && !body.secret) return out_(family_(body.family, false));
  const u = userBySecret_(body.secret);
  if (!u) return out_({ ok: false, error: "forbidden" });
  if (body.league) return out_(league_(body.league, true));
  if (body.family) { const fr = family_(body.family, true); growFamNew_(u, body.family, fr); return out_(fr); }
  CUR = u; CUR_SS = null;
  if (body.ai) return out_(ai_(u, body.ai));
  if (body.me) return out_({ ok: true, me: meOut_(u) });
  if (body.logout) { logout_(u, body.secret); return out_({ ok: true }); }
  if (body.deleteMe) {   // удаление аккаунта: только по явному слову, чтобы случайный запрос ничего не стёр
    if (body.deleteMe !== "delete") return out_({ ok: false, error: "нужно подтверждение" });
    const lk = LockService.getScriptLock();
    lk.waitLock(25000);
    try { return out_(deleteMe_(u)); } finally { lk.releaseLock(); }
  }
  if (body.gcal) return out_(gcalLink_(u, body.gcal));
  if (body.ref) return out_(ref_(u, body.ref));   // «Пригласить друга»: своя ссылка и кого уже пригласил
  if (!body.hub) return out_({ ok: false, error: "нужно обновить приложение" });
  const h = body.hub, mail = h.mail, fire = h.fire;
  delete h.mail; delete h.fire; delete h.snap;   // почты, Claude Code и iPhone-виджета у друзей нет
  // Пуш пришёл — телефон забирает текст из «исходящих»: только чтение, без замка (iPhone даёт на пуш считаные секунды)
  if (h.push && h.push.action === "outbox") return out_(hub_(h));
  // Обмен и задания Изи одного человека идут по очереди, но только его собственной: у каждого своя таблица и свои свойства.
  // Раньше все друзья стояли в одной общей очереди (замок скрипта до 25 с) — при 20 тестерах ответы ждали друг друга
  const lock = userLock_(u.id, 25000);
  if (!lock) return out_({ ok: false, error: "сервер занят — повторю через минуту" });
  let out;
  try {
    if (h.push && h.push.action === "subscribe" && !u.push) { u.push = true; userPut_(u); }
    out = hubToolOnly_(h) ? hubTool_(h) : hub_(h);
  } finally { lock.release(); }
  if (mail) out.mail = { error: "почта Gmail в IZIDAY для друзей пока не подключена" };
  if (fire) out.fire = { error: "передача задач в Claude Code есть только у владельца" };
  delete out.url;   // таблица лежит на Диске владельца, друг её открыть не сможет
  if (Date.now() - (u.seen || 0) > 3600e3) { u.seen = Date.now(); userPut_(u); }
  try { growDay_(u, body.fam); } catch (e) { Logger.log("growDay_ " + e); }   // рост: активные дни, бонусы за приглашения
  return out_(out);
}

// Замок одного человека: общий замок скрипта держим только миг — чтобы атомарно поставить метку в кэше,
// сама работа идёт без него. Метка живёт 6 минут (дольше Google не даёт работать скрипту): если выполнение оборвалось,
// замок снимется сам. Нет замка за wait мс — null
function userLock_(id, wait) {
  const cache = CacheService.getScriptCache(), key = "ulk:" + id, me = Utilities.getUuid(), end = Date.now() + wait;
  for (;;) {
    const g = LockService.getScriptLock();
    if (g.tryLock(Math.max(1, Math.min(5000, end - Date.now())))) {
      let got = false;
      try { if (!cache.get(key)) { cache.put(key, me, 360); got = true; } } finally { g.releaseLock(); }
      if (got) return { release: () => { try { if (cache.get(key) === me) cache.remove(key); } catch (e) {} } };
    }
    if (Date.now() + 200 > end) return null;
    Utilities.sleep(200);
  }
}

// ── Вход через Google ──
// Телефон получает от Google id_token (подписанный Google пропуск с почтой и именем) и присылает сюда.
// Google сам подтверждает пропуск; aud — наш вход, а не чужого сайта
function login_(q) {
  const client = GP_().getProperty("GOOGLE_CLIENT") || FR.client;   // номер входа Google можно задать и свойством скрипта
  if (!client || client.indexOf("__") === 0) return { ok: false, error: "вход через Google ещё не настроен" };
  const r = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(String(q.id_token || "")), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { ok: false, error: "Google не подтвердил вход — попробуйте ещё раз" };
  let t; try { t = JSON.parse(r.getContentText()); } catch (e) { return { ok: false, error: "Google ответил непонятно" }; }
  if (t.aud !== client || !/^(https:\/\/)?accounts\.google\.com$/.test(t.iss || "") || !(Number(t.exp) * 1000 > Date.now()) ||
    String(t.email_verified) !== "true" || !t.sub) return { ok: false, error: "вход не подтверждён" };
  if (q.nonce && t.nonce !== q.nonce) return { ok: false, error: "вход устарел — нажмите «Войти» ещё раз" };
  const email = String(t.email || "").toLowerCase();
  // Владелец: у него своя основная таблица и виджет. Его вход через Google ведёт туда, а не в пустой аккаунт друзей.
  // Код подключения (как из виджета) приложение присылает само, когда уже подключено к основной таблице, — храним в свойстве OWNER_SETUP
  if (q.own && owner_(email)) {   // q.own — приложение умеет такой ответ (старые версии ждут обычный вход)
    if (setupOk_(q.setup)) GP_().setProperty("OWNER_SETUP", q.setup);
    const setup = GP_().getProperty("OWNER_SETUP");
    if (setup) return { ok: true, owner: true, setup, me: { id: "owner", name: String(t.name || "").slice(0, 60), email } };
  }
  const allow = String(GP_().getProperty("ALLOW") || "").toLowerCase().split(/[\s,;]+/).filter(Boolean);
  const id = "f" + sha_("sub:" + t.sub).slice(0, 12);
  // одобрен владельцем по приглашению (ok:<почта>) — пускаем, даже если почты нет в ALLOW
  let approved = GP_().getProperty("ok:" + email) === "1";
  const listed = allow.length > 0 && allow.indexOf(email) >= 0;
  const refBy = q.ref ? refOwner_(q.ref) : null, known = !!userGet_(id);
  if (!known && !approved && !listed && refBy && refBy.email !== email) {   // пришёл по ссылке-приглашению
    const lk = LockService.getScriptLock(); lk.waitLock(25000);
    try {
      const r = refAsk_(refBy, email, String(t.name || t.given_name || email.split("@")[0]), GP_().getProperty("REF_AUTO") === "1");
      if (!r.auto) return r;
      approved = true;
    } finally { lk.releaseLock(); }
  }
  if (allow.length && !listed && !approved) return { ok: false, error: "этой почте вход пока не открыт — попросите у друга ссылку-приглашение в IZIDAY" };
  if (!known && !listed && !approved && GP_().getProperty("REF_ONLY") === "1") return { ok: false, error: "вход в IZIDAY по приглашению — попросите у друга ссылку" };
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
    if (isNew && refBy) { u.by = refBy.id; userPut_(u); refJoined_(email, q.ref, u.id); }
    if (isNew) try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), "IZIDAY: новый друг — " + u.name,
      `${u.name} (${email}) вошёл в IZIDAY. Всего друзей: ${users_().length} из ${FR.max}.`); } catch (e) {}
    return { ok: true, secret, isNew, me: meOut_(u) };
  } finally { lock.releaseLock(); }
}
// Почты владельца: хозяин сервера и свойство OWNER_EMAILS (через запятую, например второй аккаунт Google)
function owner_(email) {
  const list = String(GP_().getProperty("OWNER_EMAILS") || "").toLowerCase().split(/[\s,;]+/).filter(Boolean);
  try { list.push(String(Session.getEffectiveUser().getEmail() || "").toLowerCase()); } catch (e) {}
  return !!email && list.indexOf(email) >= 0;
}
function setupOk_(s) {
  if (typeof s !== "string" || s.length < 40 || s.length > 30000) return false;
  try { const d = JSON.parse(Utilities.newBlob(Utilities.base64Decode(s)).getDataAsString()); return /^https:\/\/script\.google(usercontent)?\.com\//.test(d.hook || "") && !!d.secret; } catch (e) { return false; }
}
function logout_(u, secret) {
  const hash = sha_(secret);
  GP_().deleteProperty("t:" + hash);
  u.tokens = (u.tokens || []).filter(x => x !== hash);
  userPut_(u);
}
// Удаление аккаунта (обязательно для App Store): таблица человека уходит в корзину Диска (Google сам стирает её через 30 дней),
// ключи входа, личные настройки, счётчики Изи и доступ к его Google Календарю стираются сразу. Тем же входом можно начать заново с пустого аккаунта.
function deleteMe_(u) {
  const p = GP_(), g = gcalGet_(u);
  if (g && g.rt) try { UrlFetchApp.fetch("https://oauth2.googleapis.com/revoke", { method: "post", contentType: "application/x-www-form-urlencoded", payload: gform_({ token: g.rt }), muteHttpExceptions: true }); } catch (e) {}
  try { DriveApp.getFileById(u.sheet).setTrashed(true); } catch (e) {}
  (u.tokens || []).forEach(h => p.deleteProperty("t:" + h));
  const pre = "p:" + u.id + ":", tail = ":" + u.id;
  p.getKeys().forEach(k => { if (k.indexOf(pre) === 0 || (/^ai:/.test(k) && k.slice(-tail.length) === tail)) p.deleteProperty(k); });
  p.deleteProperty("u:" + u.id);
  CUR = null; CUR_SS = null;
  return { ok: true, deleted: true };
}
function meOut_(u) { const g = gcalGet_(u), pl = plusOf_(u); return { id: u.id, name: u.name, email: u.email, pic: u.pic, left: aiLeft_(u), limit: aiLimit_(u), gcal: g ? g.email || "Google" : "",
  plus: pl.on ? { until: pl.forever ? 0 : pl.until, forever: pl.forever, fam: pl.fam } : null }; }

// ── Изи: запросы к Claude через ключ владельца, с дневным лимитом ──
// Плюс (бонусные дни за приглашения, статус, семья) — больше запросов в день: свойство AI_PLUS, по умолчанию FR.aiPlus
const aiLimit_ = u => (u && plusOf_(u).on ? Number(GP_().getProperty("AI_PLUS")) || FR.aiPlus : 0) || Number(GP_().getProperty("AI_DAY")) || FR.aiDay;
function aiLeft_(u) { return Math.max(0, aiLimit_(u) - (Number(GP_().getProperty("ai:" + FDAY_() + ":" + u.id)) || 0)); }
function ai_(u, b) {
  const key = GP_().getProperty("ANTHROPIC_KEY");
  if (!key) return { type: "error", error: { type: "nokey", message: "Изи ещё не подключён: владелец не добавил ключ Claude" } };
  if (!b || !Array.isArray(b.messages)) return { type: "error", error: { type: "bad", message: "bad request" } };
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const p = GP_(), day = FDAY_(), kd = "ai:" + day + ":" + u.id, kt = "ai:" + day + ":*";
    const nd = Number(p.getProperty(kd)) || 0, nt = Number(p.getProperty(kt)) || 0;
    if (nd >= aiLimit_(u)) return { type: "error", error: { type: "limit", message: "На сегодня Изи устал: дневной лимит исчерпан. Завтра снова на связи." } };
    if (nt >= (Number(p.getProperty("AI_ALL")) || FR.aiAll)) return { type: "error", error: { type: "limit", message: "Сегодня Изи очень занят — попробуйте завтра." } };
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
function cal_(c) { return gcalGet_() ? calG_(c) : calLocal_(c); }   // подключил Google Календарь — события там
function calLocal_(c) {
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
  const fmt = d => Utilities.formatDate(d, tz(), "yyyy-MM-dd'T'HH:mm");
  const google = (a, b) => { try { return calG_({ action: "list", from: fmt(a), to: fmt(b) }).events; } catch (e) { return []; } };   // Google не ответил — остальные подсказки всё равно уходят
  const events = (a, b) => (gcalGet_() ? google(a, b) : calExpand_(calAll_(), wall(a), wall(b))).map(wrap);
  const cal = { isHidden: () => false, getName: () => FCAL_NAME, getId: () => "iziday", getEvents: events,
    getEventsForDay: d => { const s = new Date(d); s.setHours(0, 0, 0, 0); return events(s, new Date(+s + 864e5)); } };
  return { getDefaultCalendar: () => cal, getAllCalendars: () => [cal], getCalendarById: () => cal };
})();

// ── Google Календарь друга (по желанию) ──
// Друг сам нажимает «Подключить Google Календарь»: Google спрашивает его согласие и возвращает на сайт разовый код,
// сервер меняет его на ключ обновления (refresh token) и дальше читает и пишет события в его Google Календаре.
// Ключ хранится только здесь, в свойствах скрипта, под приставкой этого человека; «Отключить» отзывает его у Google.
// Нужно свойство скрипта GOOGLE_SECRET — секрет того же входа Google (GOOGLE_CLIENT).
const GC = { api: "https://www.googleapis.com/calendar/v3", token: "https://oauth2.googleapis.com/token",
  scope: "https://www.googleapis.com/auth/calendar.events", lists: "https://www.googleapis.com/auth/calendar.calendarlist.readonly" };
const gcalKey_ = u => "p:" + (u || CUR).id + ":GCAL";
function gcalGet_(u) { if (!u && !CUR) return null; try { return JSON.parse(GP_().getProperty(gcalKey_(u)) || "null"); } catch (e) { return null; } }
const gcalPut_ = (g, u) => g ? GP_().setProperty(gcalKey_(u), JSON.stringify(g)) : GP_().deleteProperty(gcalKey_(u));
const gform_ = o => Object.keys(o).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(o[k])).join("&");

function gcalLink_(u, q) {
  if (q.off) {
    const g = gcalGet_(u);
    if (g && g.rt) try { UrlFetchApp.fetch("https://oauth2.googleapis.com/revoke", { method: "post", contentType: "application/x-www-form-urlencoded", payload: gform_({ token: g.rt }), muteHttpExceptions: true }); } catch (e) {}
    gcalPut_(null, u);
    return { ok: true, me: meOut_(u) };
  }
  const client = GP_().getProperty("GOOGLE_CLIENT") || FR.client, secret = GP_().getProperty("GOOGLE_SECRET");
  if (!secret) return { ok: false, error: "Google Календарь ещё не настроен на сервере — напишите тому, кто прислал приложение" };
  const redirect = String(q.redirect_uri || "");
  if (!q.code || !/^(https:\/\/[a-z0-9.-]+|http:\/\/localhost(:\d+)?)\//.test(redirect)) return { ok: false, error: "Google не прислал код — попробуйте ещё раз" };
  const r = UrlFetchApp.fetch(GC.token, { method: "post", contentType: "application/x-www-form-urlencoded", muteHttpExceptions: true,
    payload: gform_({ code: String(q.code), client_id: client, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }) });
  let t; try { t = JSON.parse(r.getContentText()); } catch (e) { t = {}; }
  if (r.getResponseCode() !== 200 || !t.access_token) return { ok: false, error: "Google не выдал доступ (" + (t.error || r.getResponseCode()) + ") — попробуйте ещё раз" };
  const scopes = String(t.scope || "").split(" ");
  if (scopes.indexOf(GC.scope) < 0) return { ok: false, error: "без галочки «Календарь» IZIDAY не увидит события — подключите ещё раз и оставьте её включённой" };
  if (!t.refresh_token) return { ok: false, error: "Google не выдал постоянный доступ — отключите IZIDAY в myaccount.google.com/permissions и подключите снова" };
  // чей это календарь: Google сам говорит, для какой почты и для какого входа выдан доступ
  let email = "";
  const ti = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(t.access_token), { muteHttpExceptions: true });
  try { const j = JSON.parse(ti.getContentText()); if (j.aud && j.aud !== client) return { ok: false, error: "доступ выдан не IZIDAY" }; email = String(j.email || "").toLowerCase(); } catch (e) {}
  const old = gcalGet_(u);
  if (old && old.rt && old.rt !== t.refresh_token) try { UrlFetchApp.fetch("https://oauth2.googleapis.com/revoke", { method: "post", contentType: "application/x-www-form-urlencoded", payload: gform_({ token: old.rt }), muteHttpExceptions: true }); } catch (e) {}
  gcalPut_({ rt: t.refresh_token, at: t.access_token, exp: Date.now() + (Number(t.expires_in) || 3600) * 1000 - 120e3, email, lists: scopes.indexOf(GC.lists) >= 0, since: Date.now() }, u);
  // события, которые друг уже завёл в IZIDAY, переезжают в его Google Календарь (копия остаётся в таблице: cal_events_local)
  let moved = 0, failed = 0;
  CUR = u; CUR_SS = null;
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const local = calAll_();
    if (local.length) {
      hubSet_("cal_events_local", local);
      const keep = [];
      for (const e of local) {
        if (e.until && fd_(e.until).t < Date.now() - 864e5) continue;
        try { gcalCreate_({ title: e.title, start: e.start, end: e.end, all_day: e.all_day, location: e.location, notes: e.notes, repeat: e.repeat, until: e.until, ex: e.ex }); moved++; }
        catch (x) { failed++; keep.push(e); }
      }
      calSave_(keep);
    }
  } finally { lock.releaseLock(); }
  return { ok: true, moved, failed, me: meOut_(u) };
}

// Доступ на час: берём сохранённый или обновляем по ключу обновления
function gcalAccess_(force) {
  const g = gcalGet_();
  if (!g) throw new Error("Google Календарь не подключён");
  if (!force && g.at && g.exp > Date.now()) return g.at;
  const r = UrlFetchApp.fetch(GC.token, { method: "post", contentType: "application/x-www-form-urlencoded", muteHttpExceptions: true,
    payload: gform_({ client_id: GP_().getProperty("GOOGLE_CLIENT") || FR.client, client_secret: GP_().getProperty("GOOGLE_SECRET") || "", refresh_token: g.rt, grant_type: "refresh_token" }) });
  let t; try { t = JSON.parse(r.getContentText()); } catch (e) { t = {}; }
  if (t.error === "invalid_grant") { gcalPut_(null); throw new Error("доступ к Google Календарю отозван — подключите его снова: Настройки → Аккаунт"); }
  if (!t.access_token) throw new Error("Google Календарь не ответил (" + (t.error || r.getResponseCode()) + ")");
  g.at = t.access_token; g.exp = Date.now() + (Number(t.expires_in) || 3600) * 1000 - 120e3;
  gcalPut_(g);
  return g.at;
}
// Запрос к API Календаря; просроченный доступ обновляется один раз
function gapi_(method, path, body) {
  const go = tok => UrlFetchApp.fetch(GC.api + path, { method, muteHttpExceptions: true, headers: { Authorization: "Bearer " + tok },
    contentType: body ? "application/json" : undefined, payload: body ? JSON.stringify(body) : undefined });
  let r = go(gcalAccess_());
  if (r.getResponseCode() === 401) r = go(gcalAccess_(true));
  const code = r.getResponseCode(), txt = r.getContentText();
  if (code === 204 || code === 410 && method === "delete") return {};
  let j; try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = {}; }
  if (code >= 300) {
    if (code === 404) throw new Error("нет события в Google Календаре");
    if (code === 403 && /insufficient/i.test(txt)) throw new Error("Google Календарь не дал доступ — подключите его снова и оставьте галочку «Календарь»");
    throw new Error("Google Календарь: " + ((j.error && j.error.message) || code));
  }
  return j;
}
// id события для приложения: календарь «основной» — просто id Google, иначе id@@календарь
const gid_ = (cal, id) => cal === "primary" ? id : id + "@@" + cal;
const gsplit_ = s => { s = String(s || ""); const i = s.indexOf("@@"); return i < 0 ? { cal: "primary", id: s } : { cal: s.slice(i + 2), id: s.slice(0, i) }; };
const gtz_ = () => SS_().getSpreadsheetTimeZone();
const gparse_ = v => { const m = String(v || "").match(/^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/); if (!m) throw new Error("нет даты: " + v);
  return { d: Utilities.parseDate(`${m[1]}-${m[2]}-${m[3]} ${m[4] || "00"}:${m[5] || "00"}`, gtz_(), "yyyy-MM-dd HH:mm"), day: `${m[1]}-${m[2]}-${m[3]}`, timed: m[4] != null,
    wall: `${m[1]}-${m[2]}-${m[3]}T${m[4] || "00"}:${m[5] || "00"}:00` }; };
const gday_ = (day, n) => { const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) + n * 864e5); return d.toISOString().slice(0, 10); };
const gwhen_ = (v, all) => all ? { date: gparse_(v).day, dateTime: null } : { dateTime: gparse_(v).wall, timeZone: gtz_(), date: null };
function gout_(e, cal, calName) {
  const all = !!(e.start && e.start.date), tz = gtz_();
  const f = x => all ? x.date : Utilities.formatDate(new Date(x.dateTime), tz, "yyyy-MM-dd'T'HH:mm");
  return { id: gid_(cal, e.id), title: e.summary || "(без названия)", start: f(e.start), end: all ? gday_(e.end.date, -1) : f(e.end), all_day: all,
    location: e.location || "", notes: String(e.description || "").slice(0, 300), calendar: calName || "", recurring: !!(e.recurringEventId || e.recurrence) };
}
function gcals_() {
  const g = gcalGet_();
  if (g && g.lists) try {
    const j = gapi_("get", "/users/me/calendarList?minAccessRole=reader&maxResults=50");
    const list = (j.items || []).filter(k => !k.hidden && k.selected !== false && !k.deleted)
      .map(k => ({ id: k.primary ? "primary" : k.id, name: k.summaryOverride || k.summary || "Календарь", primary: !!k.primary, ro: /^(reader|freeBusyReader)$/.test(k.accessRole || "") }));
    if (list.length) return list;
  } catch (e) { if (!gcalGet_()) throw e; }   // доступ отозван — не прятать ошибку
  return [{ id: "primary", name: (g && g.email) || "Google", primary: true }];
}
function gcalCreate_(c) {
  const cals = c.calendar ? gcals_() : null, k = (cals && cals.find(x => x.name === c.calendar)) || { id: "primary", name: "" };
  const all = !!c.all_day || !gparse_(c.start).timed, s = gparse_(c.start);
  const end = all ? { date: gday_(c.end ? gparse_(c.end).day : s.day, 1) } : c.end ? gwhen_(c.end, false) : { dateTime: Utilities.formatDate(new Date(+s.d + 3600e3), gtz_(), "yyyy-MM-dd'T'HH:mm:ss"), timeZone: gtz_() };
  const body = { summary: String(c.title || "").slice(0, 300), location: String(c.location || ""), description: String(c.notes || ""), start: all ? { date: s.day } : { dateTime: s.wall, timeZone: gtz_() }, end };
  if (c.repeat && c.repeat.freq) {
    const F = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY", yearly: "YEARLY" }[c.repeat.freq] || "WEEKLY";
    const days = (c.repeat.days || []).filter(d => /^(MO|TU|WE|TH|FR|SA|SU)$/.test(d));
    let rule = "RRULE:FREQ=" + F + (F === "WEEKLY" && days.length ? ";BYDAY=" + days.join(",") : "");
    if (c.until) rule += ";UNTIL=" + gparse_(c.until).day.replace(/-/g, "") + (all ? "" : "T235959Z");
    body.recurrence = [rule];
    if ((c.ex || []).length) body.recurrence.push("EXDATE" + (all ? ";VALUE=DATE:" : ";TZID=" + gtz_() + ":") + c.ex.map(x => all ? gparse_(x).day.replace(/-/g, "") : gparse_(x).wall.replace(/[-:]/g, "")).join(","));
  }
  const e = gapi_("post", "/calendars/" + encodeURIComponent(k.id) + "/events", body);
  return gout_(e, k.id, k.name);
}
// Событие по id из приложения; у повторяющегося — нужное повторение (по occurrence_start)
function gfind_(c) {
  const p = gsplit_(c.id), base = "/calendars/" + encodeURIComponent(p.cal) + "/events/";
  let e = gapi_("get", base + encodeURIComponent(p.id));
  if (e.recurrence && c.occurrence_start) {
    const o = gparse_(c.occurrence_start), from = new Date(+o.d - 6e4).toISOString(), to = new Date(+o.d + (o.timed ? 6e4 : 864e5)).toISOString();
    const j = gapi_("get", base + encodeURIComponent(p.id) + "/instances?maxResults=5&timeMin=" + encodeURIComponent(from) + "&timeMax=" + encodeURIComponent(to));
    if ((j.items || [])[0]) e = j.items[0];
  }
  return { e, cal: p.cal, base };
}
function calG_(c) {
  const a = c.action || "list";
  if (a === "list") {
    const from = c.from ? gparse_(c.from).d : new Date(Date.now() - 2 * 864e5);
    const to = c.to ? (gparse_(c.to).timed ? gparse_(c.to).d : new Date(+gparse_(c.to).d + 864e5)) : new Date(Date.now() + 45 * 864e5);
    const cals = gcals_(), out = [];
    const all = tok => UrlFetchApp.fetchAll(cals.map(k => ({ url: GC.api + "/calendars/" + encodeURIComponent(k.id) + "/events?singleEvents=true&orderBy=startTime&maxResults=400&timeMin=" +
      encodeURIComponent(from.toISOString()) + "&timeMax=" + encodeURIComponent(to.toISOString()), headers: { Authorization: "Bearer " + tok }, muteHttpExceptions: true })));
    let res = all(gcalAccess_());   // все календари разом
    if (res.some(r => r.getResponseCode() === 401)) res = all(gcalAccess_(true));
    if (!res.some(r => r.getResponseCode() === 200)) throw new Error("Google Календарь не отдал события (" + res[0].getResponseCode() + ")");
    res.forEach((r, i) => {
      if (r.getResponseCode() !== 200) return;
      for (const e of JSON.parse(r.getContentText()).items || []) {
        if (e.status === "cancelled" || !e.start) continue;
        if ((e.attendees || []).some(x => x.self && x.responseStatus === "declined")) continue;   // отказался — не показываем
        out.push(gout_(e, cals[i].id, cals[i].name));
      }
    });
    out.sort((x, y) => x.start < y.start ? -1 : 1);
    return { events: out.slice(0, 600), calendars: cals.map(k => ({ name: k.name, primary: k.primary, ro: !!k.ro })), source: "google" };
  }
  if (a === "create") {
    if (!c.title || !c.start) throw new Error("нужны название и время");
    return { ok: true, event: gcalCreate_(c) };
  }
  if (a === "update") {
    const f = gfind_(c), e = f.e, body = {};
    if (c.title) body.summary = String(c.title).slice(0, 300);
    if (c.location != null) body.location = String(c.location);
    if (c.notes != null) body.description = String(c.notes);
    if (c.start) {
      const wasAll = !!e.start.date, all = wasAll && !gparse_(c.start).timed;
      const dur = wasAll ? (Date.parse(e.end.date) - Date.parse(e.start.date)) : (Date.parse(e.end.dateTime) - Date.parse(e.start.dateTime));
      body.start = gwhen_(c.start, all);
      if (c.end) body.end = all ? { date: gday_(gparse_(c.end).day, 1), dateTime: null } : gwhen_(c.end, false);
      else if (all) body.end = { date: gday_(gparse_(c.start).day, Math.max(1, Math.round(dur / 864e5))), dateTime: null };
      else body.end = { dateTime: Utilities.formatDate(new Date(+gparse_(c.start).d + (wasAll ? 3600e3 : dur)), gtz_(), "yyyy-MM-dd'T'HH:mm:ss"), timeZone: gtz_(), date: null };
    }
    const r = gapi_("patch", f.base + encodeURIComponent(e.id), body);
    return { ok: true, event: gout_(r, f.cal, "") };
  }
  if (a === "delete") {
    const f = gfind_(c), e = f.e, master = e.recurringEventId || (e.recurrence ? e.id : "");
    if (c.all_future && master) {
      const m = gapi_("get", f.base + encodeURIComponent(master)), all = !!m.start.date;
      const occ = c.occurrence_start ? gparse_(c.occurrence_start).d : new Date(e.start.dateTime || gparse_(e.start.date).d);
      const first = all ? gparse_(m.start.date).d : new Date(m.start.dateTime);
      if (+occ <= +first + 6e4) { gapi_("delete", f.base + encodeURIComponent(master)); return { ok: true, deleted: "series" }; }
      const until = all ? Utilities.formatDate(new Date(+occ - 864e5), gtz_(), "yyyyMMdd") : Utilities.formatDate(new Date(+occ - 6e4), "UTC", "yyyyMMdd'T'HHmmss'Z'");
      const recurrence = (m.recurrence || []).map(r => /^RRULE:/.test(r) ? r.replace(/;(UNTIL|COUNT)=[^;]*/g, "") + ";UNTIL=" + until : r);
      gapi_("patch", f.base + encodeURIComponent(master), { recurrence });
      return { ok: true, deleted: "from", until };
    }
    gapi_("delete", f.base + encodeURIComponent(e.id));
    return { ok: true };
  }
  throw new Error("неизвестное действие календаря: " + a);
}

// ── Подсказки пушем: тот же обход, что в личной таблице, по очереди для каждого, у кого включены уведомления ──
function pushTick() {
  const t0 = Date.now(), list = users_().filter(u => u.push).sort((a, b) => (a.pushAt || 0) - (b.pushAt || 0));
  for (const u of list) {
    if (Date.now() - t0 > FR.pushBudget) break;   // остальные — в следующий раз (давние идут первыми)
    const lk = userLock_(u.id, 3000);   // идёт обмен этого человека — подсказки ему в следующий раз (через 10 минут)
    if (!lk) continue;
    CUR = u; CUR_SS = null;
    try { pushTickOne_(); } catch (e) {} finally { lk.release(); }
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

// ── Журнал действий (метрики теста на друзьях) ──
// Приложение (metrics.js) присылает пачки событий: какой экран открыт, какое действие сделано, сколько длились загрузки
// и ответы Изи, какие ошибки случились. Содержимого (тексты, суммы, записи) в событиях нет. Всё пишется в отдельную
// таблицу владельца «IZIDAY — журнал действий» (папка «IZIDAY Друзья»): лист «События» и лист «Сводка» с формулами.
// Ключ друга нужен только чтобы подписать строку его именем; без ключа строка подписана «без входа» или «владелец».
const MT = { book: "IZIDAY — журнал действий", maxEv: 60, perDev: 40, dayAll: 40000, keep: 80000,
  types: ["экран", "действие", "скорость", "ошибка", "сбой", "сеанс", "разговор", "настройка"],
  head: ["Время", "Кто", "Устройство", "Версия", "Тип", "Что", "Мс", "Раз", "Подробности"] };
const mtStr_ = (v, n) => { const s = String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n); return /^[=+\-@]/.test(s) ? "'" + s : s; };
function metricsBook_() {
  const id = GP_().getProperty("METRICS");
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const ss = SpreadsheetApp.create(MT.book);
  try { DriveApp.getFileById(ss.getId()).moveTo(folder_()); } catch (e) {}
  try { ss.setSpreadsheetTimeZone("Asia/Bangkok"); } catch (e) {}
  const ev = ss.insertSheet("События");
  ev.getRange(1, 1, 1, MT.head.length).setValues([MT.head]).setFontWeight("bold");
  ev.setFrozenRows(1);
  ev.getRange("A2:A").setNumberFormat("dd.MM HH:mm:ss");
  const sm = ss.insertSheet("Сводка");
  metricsSummary_(sm);
  try { const l = ss.getSheetByName("Лист1") || ss.getSheetByName("Sheet1"); if (l) ss.deleteSheet(l); } catch (e) {}
  try { ss.setActiveSheet(sm); ss.moveActiveSheet(1); } catch (e) {}
  GP_().setProperty("METRICS", ss.getId());
  return ss;
}
// Сводка за 7 дней — формулами (всегда свежая, считать ничего не нужно)
function metricsSummary_(sm) {
  const E = "События!", W = (cond) => "FILTER(" + E + "A2:I," + E + "A2:A>=TODAY()-7" + (cond ? "," + cond : "") + ")";
  const Q = (cond, q) => '=IFERROR(QUERY(' + W(cond) + ',"' + q + '",0),"пока пусто")';
  sm.getRange(1, 1).setValue("Сводка теста за 7 дней").setFontWeight("bold").setFontSize(14);
  sm.getRange(2, 1).setValue("Все строки — на листе «События». Тексты, суммы и записи людей сюда не попадают.");
  const kpi = [
    ["Людей сегодня", '=IFERROR(COUNTUNIQUE(FILTER(' + E + 'B2:B,INT(' + E + 'A2:A)=TODAY())),0)'],
    ["Людей за 7 дней", '=IFERROR(COUNTUNIQUE(FILTER(' + E + 'B2:B,' + E + 'A2:A>=TODAY()-7)),0)'],
    ["Запусков за 7 дней", '=COUNTIFS(' + E + 'E2:E,"сеанс",' + E + 'F2:F,"открыт",' + E + 'A2:A,">="&(TODAY()-7))'],
    ["Ошибок и сбоев за 7 дней", '=SUMIFS(' + E + 'H2:H,' + E + 'E2:E,"ошибка",' + E + 'A2:A,">="&(TODAY()-7))+SUMIFS(' + E + 'H2:H,' + E + 'E2:E,"сбой",' + E + 'A2:A,">="&(TODAY()-7))'],
  ];
  kpi.forEach((k, i) => { sm.getRange(4 + i, 1).setValue(k[0]); sm.getRange(4 + i, 2).setFormula(k[1]); });
  const blocks = [
    [1, "Люди", Q("", "select Col2, count(Col1), max(Col1) group by Col2 order by max(Col1) desc label Col2 'Кто', count(Col1) 'Событий', max(Col1) 'Последний раз'")],
    [5, "Экраны", Q(E + 'E2:E="экран"', "select Col6, count(Col1) group by Col6 order by count(Col1) desc label Col6 'Экран', count(Col1) 'Открытий'")],
    [8, "Действия", Q(E + 'E2:E="действие"', "select Col6, sum(Col8) group by Col6 order by sum(Col8) desc label Col6 'Действие', sum(Col8) 'Раз'")],
    [11, "Скорость, секунды", Q(E + 'E2:E="скорость"', "select Col6, avg(Col7)/1000, max(Col7)/1000, sum(Col8) group by Col6 order by avg(Col7)/1000 desc label Col6 'Что', avg(Col7)/1000 'В среднем', max(Col7)/1000 'Хуже всего', sum(Col8) 'Раз' format avg(Col7)/1000 '0.0', max(Col7)/1000 '0.0'")],
    [16, "Ошибки и сбои (последние)", Q("(" + E + 'E2:E="ошибка")+(' + E + 'E2:E="сбой")', "select Col1, Col2, Col3, Col5, Col6, Col8, Col9 order by Col1 desc limit 50 label Col1 'Когда', Col2 'Кто', Col3 'Устройство', Col5 'Тип', Col6 'Что', Col8 'Раз', Col9 'Где'")],
  ];
  for (const [c, title, f] of blocks) { sm.getRange(9, c).setValue(title).setFontWeight("bold"); sm.getRange(10, c).setFormula(f); }
  sm.getRange("C10:C").setNumberFormat("dd.MM HH:mm");
  sm.getRange("P10:P").setNumberFormat("dd.MM HH:mm");
  sm.setFrozenRows(2);
}
function metrics_(m, u) {
  if (!m || !Array.isArray(m.ev) || !m.ev.length) return { ok: false, error: "нет событий" };
  if (GP_().getProperty("METRICS_OFF") === "1") return { ok: true, off: true };   // владелец выключил сбор свойством скрипта
  const dev = String(m.dev || "").replace(/[^0-9a-f]/g, "").slice(0, 6) || "?";
  if (typeof CacheService !== "undefined") {   // от одного телефона — не чаще 40 пачек за 10 минут; на всех — не больше 40 тыс. строк в день
    const c = CacheService.getScriptCache(), k = "mt:" + dev, n = +(c.get(k) || 0), kd = "mt:" + FDAY_(), all = +(c.get(kd) || 0);
    if (n >= MT.perDev) return { ok: false, error: "slow down" };
    if (all >= MT.dayAll) return { ok: true, skipped: true };
    c.put(k, String(n + 1), 600); c.put(kd, String(all + m.ev.length), 21600);
  }
  const who = u ? (String(u.name || "друг").split(/\s+/)[0].slice(0, 24) + " · " + String(u.id).slice(1, 5)) : m.who === "owner" ? "владелец" : "без входа";
  const plat = mtStr_(m.plat, 40) + " · " + dev, ver = mtStr_(m.ver, 12), now = Date.now();
  const rows = [];
  for (const e of m.ev.slice(0, MT.maxEv)) {
    if (!Array.isArray(e) || MT.types.indexOf(e[1]) < 0) continue;
    let t = +e[0]; if (!(t > now - 30 * 864e5 && t < now + 864e5)) t = now;
    const ms = e[3] === "" || e[3] == null ? "" : Math.max(0, Math.min(36e5, Math.round(+e[3] || 0)));
    rows.push([new Date(t), who, plat, ver, e[1], mtStr_(e[2], 80), ms, Math.max(1, Math.min(9999, Math.round(+e[4] || 1))), mtStr_(e[5], 160)]);
  }
  if (!rows.length) return { ok: true, n: 0 };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: "занято" };
  try {
    const sh = metricsBook_().getSheetByName("События");
    const last = sh.getLastRow();
    sh.getRange(last + 1, 1, rows.length, MT.head.length).setValues(rows);
    if (last > MT.keep && sh.deleteRows) sh.deleteRows(2, 10000);   // старые строки — прочь, таблица не разрастается
  } finally { lock.releaseLock(); }
  return { ok: true, n: rows.length };
}

// ═════════════ Недочёты от фокус-группы ═════════════
// Форма iziday.pages.dev/bug (и кнопка в Настройках приложения) присылает {bug:{…}}.
// Вход не нужен: друг может сообщить, даже если приложение не открывается. Если есть ключ телефона — подписываем именем друга.
// Всё складывается в таблицу «IZIDAY — Недочёты» в папке «IZIDAY Друзья», скриншоты — в соседнюю папку, владельцу приходит письмо.
const BUG = { sheet: "IZIDAY — Недочёты", shots: "IZIDAY — Недочёты (скриншоты)", hour: 40, maxShots: 3, maxShot: 2.5e6, maxAudio: 4e6, voiceCol: "Голос текстом",
  head: ["№", "Когда", "Кто", "Почта", "Что случилось", "Где", "Насколько мешает", "Как повторить / что ожидали", "Скриншоты", "Устройство", "Версия", "Ошибки приложения", "Статус", "Заметка"] };

function bugSheet_() {
  const p = GP_(), id = p.getProperty("BUGS_SHEET");
  if (id) { try { return SpreadsheetApp.openById(id).getSheets()[0]; } catch (e) {} }
  const ss = SpreadsheetApp.create(BUG.sheet);
  try { DriveApp.getFileById(ss.getId()).moveTo(folder_()); } catch (e) {}
  try { ss.setSpreadsheetTimeZone("Asia/Bangkok"); } catch (e) {}
  const sh = ss.getSheets()[0];
  sh.setName("Недочёты");
  sh.getRange(1, 1, 1, BUG.head.length).setValues([BUG.head]).setFontWeight("bold").setBackground("#eef2ff");
  sh.setFrozenRows(1);
  [40, 120, 130, 170, 360, 110, 120, 280, 160, 220, 110, 260, 110, 200].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange("E:E").setWrap(true); sh.getRange("H:H").setWrap(true); sh.getRange("L:L").setWrap(true);
  sh.getRange(2, 13, 999, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(["новый", "в работе", "исправлено", "не повторяется", "не баг"], true).build());
  p.setProperty("BUGS_SHEET", ss.getId());
  return sh;
}
function bugShots_() {
  const p = GP_(), id = p.getProperty("BUGS_SHOTS");
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = folder_().createFolder(BUG.shots);
  p.setProperty("BUGS_SHOTS", f.getId());
  return f;
}
// ── Код-шар: приглашение в семью. В шаре на экране помещается только короткий код (5 байт), а само приглашение
// (адрес семьи) лежит здесь 10 минут и отдаётся один раз. Старый снимок шара или повторное сканирование не сработают.
//   {op:"new", p}      → {ok, token, ttl}   p — то же, что в ссылке-приглашении после #fam=
//   {op:"get", token}  → {ok, p}            приглашение гасится
//   {op:"stat", token} → {ok, used, live}   главный телефон видит, что шар отсканирован
const INV = { ttl: 600, newHour: 400, missHour: 1500 };
function inv_(q) {
  if (!q || typeof q !== "object") return { ok: false, error: "пустой запрос" };
  const cache = CacheService.getScriptCache(), hh = Utilities.formatDate(new Date(), "UTC", "yyyyMMddHH");
  const bump = (k, max) => { const n = Number(cache.get(k) || 0); if (n >= max) return false; cache.put(k, String(n + 1), 3700); return true; };
  if (q.op === "new") {
    const p = String(q.p || "");
    if (!/^[A-Za-z0-9+\/=_-]{20,900}$/.test(p)) return { ok: false, error: "плохое приглашение" };
    if (!bump("invn:" + hh, INV.newHour)) return { ok: false, error: "слишком много приглашений за час — попробуйте позже" };
    let token = "";
    for (let i = 0; i < 5 && !token; i++) { const t = Utilities.getUuid().replace(/-/g, "").slice(0, 10); if (!cache.get("inv:" + t)) token = t; }
    if (!token) return { ok: false, error: "попробуйте ещё раз" };
    cache.put("inv:" + token, p, INV.ttl);
    return { ok: true, token: token, ttl: INV.ttl };
  }
  const token = String(q.token || "").toLowerCase();
  if (!/^[0-9a-f]{10}$/.test(token)) return { ok: false, error: "плохой код" };
  if (q.op === "stat") return { ok: true, used: !!cache.get("invu:" + token), live: !!cache.get("inv:" + token) };
  if (q.op === "get") {
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const p = cache.get("inv:" + token);
      if (!p) {
        if (!bump("invm:" + hh, INV.missHour)) return { ok: false, error: "слишком много попыток — попробуйте позже" };
        return { ok: false, error: cache.get("invu:" + token) ? "этот шар уже использован — попросите показать новый" : "шар устарел — попросите показать новый", gone: true };
      }
      cache.remove("inv:" + token); cache.put("invu:" + token, "1", INV.ttl);
      return { ok: true, p: p };
    } finally { lock.releaseLock(); }
  }
  return { ok: false, error: "неизвестная команда" };
}

const bugTxt_ = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n).replace(/^[=+\-@]/, "'$&");   // без формул в таблице

function bug_(q, secret) {
  if (!q || typeof q !== "object") return { ok: false, error: "пустой отчёт" };
  const what = String(q.what || "").trim();
  if (what.length < 3) return { ok: false, error: "напишите, что случилось" };
  // защита от потока: не больше BUG.hour отчётов в час на весь сервер
  const cache = CacheService.getScriptCache(), hk = "bugs:" + Utilities.formatDate(new Date(), "UTC", "yyyyMMddHH");
  const cnt = Number(cache.get(hk) || 0);
  if (cnt >= BUG.hour) return { ok: false, error: "слишком много отчётов за час — попробуйте позже" };
  cache.put(hk, String(cnt + 1), 3700);
  const u = secret ? userBySecret_(secret) : null;
  const who = u ? u.name : bugTxt_(q.name, 60) || "не представился";
  const mail = u ? u.email : bugTxt_(q.email, 100);
  // голосовое → текст: расшифровку присылает приложение (Whisper на Groq, если у человека есть ключ);
  // нет — расшифровываем здесь тем же Whisper, если в свойствах скрипта есть GROQ_KEY
  const am = /^data:audio\/(mp4|x-m4a|aac|mpeg|webm|ogg|wav)(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/.exec(String(q.audio || ""));
  const aok = !!am && am[2].length <= (BUG.maxAudio || 4e6) * 1.37;
  const aext = am ? { mp4: "m4a", "x-m4a": "m4a", aac: "aac", mpeg: "mp3", webm: "webm", ogg: "ogg", wav: "wav" }[am[1]] : "";
  let vt = bugTxt_(q.voiceText, 4000);
  if (!vt && aok) vt = bugWhisper_(Utilities.newBlob(Utilities.base64Decode(am[2]), "audio/" + am[1], "voice." + aext));
  const whatTxt = what === "(голосовое сообщение)" && vt ? vt : what;
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  let n, sh, links = [];
  try {
    sh = bugSheet_();
    n = Math.max(0, sh.getLastRow() - 1) + 1;
    const shots = Array.isArray(q.shots) ? q.shots.slice(0, BUG.maxShots) : [];
    if (shots.length) {
      const dir = bugShots_();
      shots.forEach((s, i) => {
        const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ""));
        if (!m || m[2].length > BUG.maxShot * 1.37) return;
        const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), "image/" + m[1], `№${n}-${i + 1} ${who}.${m[1] === "jpeg" ? "jpg" : m[1]}`);
        links.push(dir.createFile(blob).getUrl());
      });
    }
    // голосовое сообщение (до 3 минут): файл рядом со скриншотами, ссылка — в той же колонке
    if (aok) {
      const f = bugShots_().createFile(Utilities.newBlob(Utilities.base64Decode(am[2]), "audio/" + am[1], `№${n}-голос ${who}.${aext}`));
      links.push("Голос" + (q.sec ? " " + (Number(q.sec) | 0) + " с" : "") + ": " + f.getUrl());
    }
    const d = q.dev || {};
    const dev = [bugTxt_(d.model, 80), bugTxt_(d.os, 60), bugTxt_(d.browser, 60), d.w && d.h ? `${Number(d.w) | 0}×${Number(d.h) | 0}` : "",
      d.pwa ? "значок на экране" : "в браузере", d.lang ? bugTxt_(d.lang, 12) : ""].filter(Boolean).join(" · ");
    const errs = (Array.isArray(q.errors) ? q.errors : []).slice(-8).map(x => bugTxt_(x, 300)).join("\n");
    if (sh.getRange(1, 15).getValue() !== (BUG.voiceCol || "Голос текстом")) sh.getRange(1, 15).setValue(BUG.voiceCol || "Голос текстом").setFontWeight("bold").setBackground("#eef2ff");
    sh.appendRow([n, new Date(), who, mail, bugTxt_(whatTxt, 4000), bugTxt_(q.where, 60), bugTxt_(q.level, 40), bugTxt_(q.steps, 3000),
      links.join("\n"), dev, bugTxt_(q.ver, 40), errs, "новый", "", vt]);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  const url = sh.getParent().getUrl();
  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), `IZIDAY: недочёт №${n} — ${who}`,
      `${who}${mail ? " (" + mail + ")" : ""} сообщает:\n\n${whatTxt}\n\nГде: ${q.where || "—"}\nНасколько мешает: ${q.level || "—"}\n` +
      (q.steps ? `Как повторить: ${q.steps}\n` : "") + (links.length ? `Скриншоты и голос: ${links.join(" ")}\n` : "") + `\nВсе недочёты: ${url}`);
  } catch (e) {}
  return { ok: true, n, voiceText: vt || undefined };
}
// Whisper large-v3 на Groq (тот же, что в приложении). Ключ — свойство скрипта GROQ_KEY; нет ключа или ошибка — пусто
function bugWhisper_(blob) {
  const key = GP_().getProperty("GROQ_KEY") || "";
  if (!key) return "";
  try {
    const r = UrlFetchApp.fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "post", muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + key }, payload: { file: blob, model: "whisper-large-v3", language: "ru", response_format: "text" } });
    return r.getResponseCode() === 200 ? bugTxt_(String(r.getContentText()).trim(), 4000) : "";
  } catch (e) { return ""; }
}

// ═════════════ Спрос на подписку и «Пригласить друга» ═════════════
// Подписки пока нет: кнопка в Настройках только собирает заявки {lead:{…}}, денег никто не берёт.
// Приглашения: у каждого друга своя ссылка iziday.pages.dev/?r=КОД. Новый человек входит через Google с этим кодом —
// сервер не пускает его сразу, а пишет владельцу письмо со ссылками «Открыть доступ» / «Отказать».
// Предел: REF_PER приглашений на человека (по умолчанию 3) и общий FR.max на сервер. REF_AUTO=1 — пускать без одобрения,
// REF_ONLY=1 — новые люди без приглашения не входят (кроме почт из ALLOW). Всё видно в таблице «IZIDAY — Заявки и приглашения».
const GROW = { sheet: "IZIDAY — Заявки и приглашения", per: 3, leadHour: 60, askHour: 40, site: "https://iziday.pages.dev/",
  leadHead: ["Когда", "Кто", "Почта", "Тариф", "Сколько комфортно платить", "Язык", "Версия", "Устройство"],
  refHead: ["Когда", "Кто пригласил", "Почта пригласившего", "Кого", "Почта", "Статус"],
  st: { wait: "ждёт одобрения", ok: "доступ открыт", "in": "вошёл", no: "отказано" } };
const growPer_ = () => { const v = GP_().getProperty("REF_PER"); return v === null || v === "" ? GROW.per : Math.max(0, Number(v) || 0); };
const growSite_ = () => GP_().getProperty("SITE") || GROW.site;
function growBook_() {
  const p = GP_(), id = p.getProperty("GROW_SHEET");
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const ss = SpreadsheetApp.create(GROW.sheet);
  try { DriveApp.getFileById(ss.getId()).moveTo(folder_()); } catch (e) {}
  try { ss.setSpreadsheetTimeZone("Asia/Bangkok"); } catch (e) {}
  const a = ss.getSheets()[0];
  a.setName("Подписка");
  a.getRange(1, 1, 1, GROW.leadHead.length).setValues([GROW.leadHead]).setFontWeight("bold").setBackground("#eef2ff");
  a.setFrozenRows(1);
  const b = ss.insertSheet("Приглашения");
  b.getRange(1, 1, 1, GROW.refHead.length).setValues([GROW.refHead]).setFontWeight("bold").setBackground("#eef2ff");
  b.setFrozenRows(1);
  p.setProperty("GROW_SHEET", ss.getId());
  return ss;
}
const growTab_ = n => { const ss = growBook_(); return ss.getSheetByName(n) || ss.insertSheet(n); };
function growBump_(k, max) {
  const cache = CacheService.getScriptCache(), hk = k + ":" + Utilities.formatDate(new Date(), "UTC", "yyyyMMddHH"), n = Number(cache.get(hk) || 0);
  if (n >= max) return false;
  cache.put(hk, String(n + 1), 3700);
  return true;
}

// ── Заявка на подписку: одна строка на человека (повторное нажатие обновляет ответ о цене, письмо не дублируется) ──
//   {lead:{price, lang, ver, dev, id}} (+ secret, если человек вошёл)  → {ok, n}
function lead_(q, u) {
  if (!q || typeof q !== "object") return { ok: false, error: "пустая заявка" };
  const key = u ? u.id : "a" + String(q.id || "").replace(/[^0-9a-z]/gi, "").slice(0, 24);
  if (key.length < 7) return { ok: false, error: "нужно обновить приложение" };
  if (!growBump_("lead", GROW.leadHour)) return { ok: false, error: "слишком много заявок за час — попробуйте позже" };
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  let row, isNew = false, n, sh;
  try {
    sh = growTab_("Подписка");
    const who = u ? u.name : bugTxt_(q.name, 60) || "без входа", mail = u ? u.email : bugTxt_(q.email, 100);
    const vals = [new Date(), who, mail, "Плюс · 6,99 $ в месяц", bugTxt_(q.price, 40), bugTxt_(q.lang, 8), bugTxt_(q.ver, 40), bugTxt_(q.dev, 120)];
    row = Number(GP_().getProperty("ld:" + key)) || 0;
    if (row > 1 && row <= sh.getLastRow()) sh.getRange(row, 1, 1, vals.length).setValues([vals]);
    else { sh.appendRow(vals); row = sh.getLastRow(); isNew = true; GP_().setProperty("ld:" + key, String(row)); }
    n = Math.max(0, sh.getLastRow() - 1);
    SpreadsheetApp.flush();
    if (isNew) try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), `IZIDAY: заявка на подписку — ${who} (всего ${n})`,
      `${who}${mail ? " (" + mail + ")" : ""} оставил(а) заявку на IZIDAY Плюс.\nКомфортная цена: ${q.price || "не указал(а)"}\n\nВсе заявки: ${sh.getParent().getUrl()}`); } catch (e) {}
  } finally { lock.releaseLock(); }
  return { ok: true, n };
}

// ── Приглашения ──
function refCode_(u) {
  const pc = partnerCode_(u);   // партнёр (блогер, коуч): свой понятный код из свойства PARTNERS
  if (pc && u.ref !== pc && (!GP_().getProperty("r:" + pc) || GP_().getProperty("r:" + pc) === u.id)) { u.ref = pc; GP_().setProperty("r:" + pc, u.id); userPut_(u); }
  if (u.ref && GP_().getProperty("r:" + u.ref) === u.id) return u.ref;
  let c = "";
  for (let i = 0; i < 6 && !c; i++) { const t = Utilities.getUuid().replace(/-/g, "").slice(0, 6); if (!GP_().getProperty("r:" + t)) c = t; }
  u.ref = c; GP_().setProperty("r:" + c, u.id); userPut_(u);
  return c;
}
const refUsed_ = u => (u.inv || []).filter(x => x.st !== "no").length + (u.invOld || 0);
const refPer_ = u => partnerCode_(u) ? 9999 : growPer_() + (GROWTH.lv[growLv_(u)] || {}).inv;
const refPending_ = () => GP_().getKeys().filter(k => /^rq:/.test(k)).length;
function refOut_(u) {
  const per = refPer_(u);
  return Object.assign({ ok: true, code: refCode_(u), link: growSite_() + "?r=" + u.ref, per, left: Math.max(0, per - refUsed_(u)),
    list: (u.inv || []).slice(-10).map(x => ({ name: x.n, st: x.act ? "act" : x.st, at: x.at, d: x.id ? growDaysOf_(x.id) : 0 })) }, growOut_(u));
}
//   {secret, ref:{op:"get"}} → {ok, code, link, per, left, list:[{name, st, at}]}
function ref_(u, q) { return refOut_(u); }
function refOwner_(code) {
  const c = String(code || "").toLowerCase();
  if (!/^[0-9a-z]{3,16}$/.test(c)) return null;
  const id = GP_().getProperty("r:" + c);
  return id ? userGet_(id) : null;
}
// Новый человек пришёл по приглашению: заявка владельцу, сам человек пока не входит
function refAsk_(by, email, name, auto) {
  const p = GP_(), old = p.getProperty("rqe:" + email);
  if (old && p.getProperty("rq:" + old)) return { ok: false, wait: true, error: `Заявка уже у создателя IZIDAY. Когда он откроет доступ, на ${email} придёт письмо — тогда нажмите «Войти через Google» ещё раз.` };
  if (refUsed_(by) >= refPer_(by)) return { ok: false, error: `У ${by.name} закончились приглашения. Попросите его написать создателю IZIDAY.` };
  if (users_().length + refPending_() >= FR.max) return { ok: false, error: "мест пока нет — напишите тому, кто прислал приложение" };
  if (!growBump_("refask", GROW.askHour)) return { ok: false, error: "слишком много заявок за час — попробуйте позже" };
  const sh = growTab_("Приглашения");
  if (partnerCode_(by)) auto = true;   // подписчиков блогера владелец не одобряет по одному: пускаем в пределах мест
  if (auto) {   // REF_AUTO=1: без одобрения, но в пределах REF_PER и мест
    sh.appendRow([new Date(), by.name, by.email, bugTxt_(name, 60), email, GROW.st.ok]);
    p.setProperty("ok:" + email, "1");
    by.inv = (by.inv || []).filter(x => x.e !== email).concat([{ e: email, n: String(name).slice(0, 60), st: "ok", at: Date.now() }]).slice(-20);
    userPut_(by);
    return { auto: true };
  }
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "").slice(0, 40);
  sh.appendRow([new Date(), by.name, by.email, bugTxt_(name, 60), email, GROW.st.wait]);
  const row = sh.getLastRow();
  p.setProperty("rq:" + token, JSON.stringify({ email, name: String(name).slice(0, 60), by: by.id, at: Date.now(), row }));
  p.setProperty("rqe:" + email, token);
  by.inv = (by.inv || []).filter(x => x.e !== email).concat([{ e: email, n: String(name).slice(0, 60), st: "wait", at: Date.now() }]).slice(-20);
  userPut_(by);
  let base = "";
  try { base = ScriptApp.getService().getUrl(); } catch (e) {}
  base = p.getProperty("SELF_URL") || base;
  try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), `IZIDAY: ${by.name} приглашает ${name}`,
    `${by.name} (${by.email}) пригласил(а) в IZIDAY: ${name} (${email}).\n` +
    `Занято мест: ${users_().length} из ${FR.max}, ждут одобрения: ${refPending_()}. У ${by.name} осталось приглашений: ${Math.max(0, refPer_(by) - refUsed_(by))}.\n\n` +
    `Открыть доступ: ${base}?ok=${token}&a=yes\nОтказать: ${base}?ok=${token}&a=no\n\nВсе приглашения: ${sh.getParent().getUrl()}`); } catch (e) { Logger.log(e) }
  return { ok: false, wait: true, error: `Создатель IZIDAY получил заявку. Когда он откроет доступ, на ${email} придёт письмо — тогда нажмите «Войти через Google» ещё раз.` };
}
// Владелец нажал ссылку в письме
function refDecide_(token, yes) {
  token = String(token || "").replace(/[^0-9a-f]/g, "");
  const p = GP_(), raw = token ? p.getProperty("rq:" + token) : null;
  if (!raw) return "Эта заявка уже решена или ссылка устарела.";
  const rq = JSON.parse(raw), by = userGet_(rq.by);
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    if (yes && users_().length >= FR.max) return `Мест нет: занято ${users_().length} из ${FR.max}. Удалите кого-нибудь или поднимите предел.`;
    if (yes) p.setProperty("ok:" + rq.email, "1");
    p.deleteProperty("rq:" + token); p.deleteProperty("rqe:" + rq.email);
    if (by) { by.inv = (by.inv || []).map(x => x.e === rq.email ? Object.assign(x, { st: yes ? "ok" : "no" }) : x); userPut_(by); }
    try { growTab_("Приглашения").getRange(rq.row, 6).setValue(yes ? GROW.st.ok : GROW.st.no); } catch (e) {}
  } finally { lock.releaseLock(); }
  if (yes) try { MailApp.sendEmail(rq.email, "IZIDAY: доступ открыт",
    `Здравствуйте${rq.name ? ", " + rq.name : ""}!\n\nДоступ в IZIDAY открыт${by ? " по приглашению " + by.name : ""}. Откройте ${growSite_()} и нажмите «Войти через Google» той же почтой (${rq.email}).`); } catch (e) {}
  return yes ? `Готово: ${rq.name || rq.email} может войти в IZIDAY. Ему ушло письмо.` : `Отказано: ${rq.name || rq.email} не войдёт.`;
}
// Человек вошёл после одобрения — отмечаем у пригласившего
function refJoined_(email, refCode, id) {
  const by = refOwner_(refCode);
  if (!by || !(by.inv || []).some(x => x.e === email)) return;
  by.inv = by.inv.map(x => x.e === email ? Object.assign(x, { st: "in", id: id || x.id }) : x);
  userPut_(by);
  try { const sh = growTab_("Приглашения"), v = sh.getRange(2, 5, Math.max(1, sh.getLastRow() - 1), 1).getValues();
    for (let i = v.length - 1; i >= 0; i--) if (String(v[i][0]).toLowerCase() === email) { sh.getRange(i + 2, 6).setValue(GROW.st["in"]); break; } } catch (e) {}
}
function growPage_(msg) {
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>IZIDAY</title>` +
    `<div style="font:17px -apple-system,system-ui,sans-serif;max-width:460px;margin:60px auto;padding:0 20px;color:#1d1d1f"><h2 style="margin:0 0 12px">IZIDAY</h2><p>${String(msg).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</p></div>`;
  return HtmlService.createHtmlOutput(html).setTitle("IZIDAY");
}

// ═════════════ Рост: бонус за приглашение, второй уровень, статусы, партнёры, семья, лига приглашений ═════════════
// Всё начисляется ДНЯМИ IZIDAY Плюс, не деньгами (деньги — только партнёрам по договору, вне приложения).
//  • Двусторонний бонус: приглашённый был в IZIDAY GROWTH.days разных дней (обмен с сервером хотя бы раз в день) →
//    ему GROWTH.invitee дней Плюса, пригласившему GROWTH.inviter. За регистрацию ничего не даём (правила App Store, 3.2.2).
//  • Второй уровень (и только он): тот, кто пригласил пригласившего, получает GROWTH.l2 дня. Глубже — ничего.
//  • Статусы по числу активных приглашённых: Друг → Проводник → Амбассадор. Статус добавляет приглашений,
//    Амбассадор получает Плюс навсегда и ранний доступ.
//  • Партнёры (блогеры, коучи): свойство PARTNERS = "почта=КОД, почта2=КОД2". Ссылка iziday.pages.dev/?r=КОД,
//    подписчики входят без одобрения (в пределах мест FR.max), партнёру Плюс навсегда. Учёт — лист «Партнёры»; выплаты — по договору.
//  • Семья: создавший семью со своего аккаунта — глава. Плюс главы действует на всю семью; за каждого взрослого из семьи,
//    кто был активен GROWTH.days дней, глава получает GROWTH.fam дней.
//  • Лига приглашений: рейтинг месяца по активным приглашённым; топ-3 прошлого месяца получают GROWTH.prize дней.
// Свойства: GROW_OFF=1 — выключить начисления (данные копятся, ничего не выдаётся); GROW_INVITEE=0 — без бонуса приглашённому
// (если App Review попросит); AI_PLUS — запросов к Изи в день с Плюсом.
const GROWTH = { days: 7, invitee: 30, inviter: 30, l2: 3, fam: 7, prize: [30, 14, 7], famMax: 6, maxPlusDays: 730,
  lv: [{ n: "", inv: 0, need: 0 }, { n: "Друг", inv: 2, need: 1 }, { n: "Проводник", inv: 5, need: 3 }, { n: "Амбассадор", inv: 20, need: 10 }] };
const growOff_ = () => GP_().getProperty("GROW_OFF") === "1";
const growMonth_ = (d) => Utilities.formatDate(d || new Date(), "Asia/Bangkok", "yyyy-MM");
function partnerCode_(u) {
  if (!u || !u.email) return "";
  for (const part of String(GP_().getProperty("PARTNERS") || "").split(/[,;\n]+/)) {
    const m = part.trim().match(/^([^=\s]+)\s*=\s*([0-9A-Za-z]{3,16})$/);
    if (m && m[1].toLowerCase() === u.email) return m[2].toLowerCase();
  }
  return "";
}
const growLv_ = u => { const a = u.act || 0; let lv = 0; GROWTH.lv.forEach((x, i) => { if (i && a >= x.need) lv = i; }); return lv; };
function growDaysOf_(id) { const v = userGet_(id); return v ? Math.min(GROWTH.days, v.nd || 0) : 0; }
// Плюс человека: свой (бонусные дни / навсегда) или главы его семьи
function plusOf_(u, deep) {
  const now = Date.now(), forever = !!(u.pf || partnerCode_(u)), until = Number(u.plus) || 0;
  if (forever || until > now) return { on: true, forever, until, fam: false };
  if (!deep && u.fam) {
    const hid = GP_().getProperty("fh:" + u.fam), h = hid && hid !== u.id ? userGet_(hid) : null;
    if (h && h.fam === u.fam && plusOf_(h, true).on && growFamRank_(u.fam, u.id) < GROWTH.famMax) { const hp = plusOf_(h, true); return { on: true, forever: hp.forever, until: hp.until, fam: true }; }
  }
  return { on: false, forever: false, until, fam: false };
}
// место в семье по времени входа: Плюс главы — на первых GROWTH.famMax человек
function growFamRank_(code, id) { return users_().filter(x => x.fam === code).sort((a, b) => (a.famAt || 0) - (b.famAt || 0)).map(x => x.id).indexOf(id); }
function plusAdd_(u, days, why) {
  if (!u || !(days > 0) || growOff_()) return;
  const now = Date.now(), from = Math.max(now, Number(u.plus) || 0);
  u.plus = Math.min(from + days * 864e5, now + GROWTH.maxPlusDays * 864e5);
  u.bon = (u.bon || []).concat([{ d: days, w: String(why).slice(0, 80), at: now }]).slice(-12);
  userPut_(u);
}
// Семью создали с аккаунта друзей — этот человек глава
function growFamNew_(u, q, r) {
  if (!q || q.op !== "new" || !r || !r.ok || !r.family) return;
  const code = r.family.code;
  GP_().setProperty("fh:" + code, u.id);
  const v = userGet_(u.id) || u; v.fam = code; v.famAt = Date.now(); userPut_(v);
}
// Один раз в день на человека (при обмене): +1 активный день, проверка бонусов
function growDay_(u0, fam) {
  const day = FDAY_(), u = userGet_(u0.id);
  if (!u) return;
  let dirty = false;
  if (fam && /^[0-9a-f]{14}$/.test(String(fam)) && u.fam !== fam) { u.fam = String(fam); u.famAt = Date.now(); u.famNd = u.nd || 0; dirty = true; }   // бонус главе — один раз за человека, за 7 дней уже в семье
  if (u.ld !== day) { u.ld = day; u.nd = (u.nd || 0) + 1; dirty = true; }
  if (dirty) userPut_(u);
  if ((u.nd || 0) < GROWTH.days || (u.rw || !u.by) && (u.famRw || !u.fam)) return;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const v = userGet_(u.id);
    if (v.by && !v.rw) growReward_(v);
    if (v.fam && !v.famRw && (v.nd || 0) - (v.famNd || 0) >= GROWTH.days) growFamReward_(v);
  } finally { lock.releaseLock(); }
}
function growReward_(u) {
  u.rw = Date.now(); userPut_(u);
  const by = userGet_(u.by);
  if (!by) return;
  const name = String(u.name || "").split(" ")[0];
  if (GP_().getProperty("GROW_INVITEE") !== "0") plusAdd_(u, GROWTH.invitee, `Вы ${GROWTH.days} дней в IZIDAY по приглашению`);
  const lv0 = growLv_(by);
  by.act = (by.act || 0) + 1;
  by.inv = (by.inv || []).map(x => x.id === u.id || x.e === u.email ? Object.assign(x, { act: Date.now() }) : x);
  userPut_(by);
  const pc = partnerCode_(by);
  if (!pc) plusAdd_(by, GROWTH.inviter, `${name} с вами ${GROWTH.days} дней`);
  const lv = growLv_(by);
  if (lv === 3 && !by.pf) { by.pf = true; by.early = true; userPut_(by); }
  if (lv > lv0) by.lvAt = Date.now(), userPut_(by);
  // лига приглашений месяца
  const mk = "lm:" + growMonth_(), lm = JSON.parse(GP_().getProperty(mk) || "{}");
  lm[by.id] = (lm[by.id] || 0) + 1; GP_().setProperty(mk, JSON.stringify(lm));
  // второй уровень — только один шаг вверх
  const top = by.by ? userGet_(by.by) : null;
  if (top && top.id !== u.id) { plusAdd_(top, GROWTH.l2, `${name} — друг вашего друга ${String(by.name || "").split(" ")[0]}`); top.l2 = (top.l2 || 0) + 1; userPut_(top); }
  try {
    const sh = growTab_("Активные");
    if (sh.getLastRow() < 1) sh.appendRow(["Когда", "Кто", "Почта", "Пригласил(а)", "Почта пригласившего", "Партнёр", "Статус пригласившего"]);
    sh.appendRow([new Date(), u.name, u.email, by.name, by.email, pc ? pc.toUpperCase() : "", GROWTH.lv[lv].n]);
  } catch (e) {}
  if (pc) try {
    const sh = growTab_("Партнёры");
    if (sh.getLastRow() < 1) sh.appendRow(["Месяц", "Код", "Партнёр", "Почта", "Активный приглашённый", "Почта приглашённого"]);
    sh.appendRow([growMonth_(), pc.toUpperCase(), by.name, by.email, u.name, u.email]);
  } catch (e) {}
}
function growFamReward_(u) {
  u.famRw = Date.now(); userPut_(u);
  const hid = GP_().getProperty("fh:" + u.fam);
  if (!hid || hid === u.id) return;
  const h = userGet_(hid);
  if (h && h.fam === u.fam) plusAdd_(h, GROWTH.fam, `${String(u.name || "").split(" ")[0]} в вашей семье ${GROWTH.days} дней`);
}
// Призы лиги прошлого месяца — один раз, при первом запросе в новом месяце
function growPrizes_() {
  const d = new Date(); d.setDate(1); d.setDate(0);
  const pm = growMonth_(d), done = "lw:" + pm;
  if (GP_().getProperty(done)) return;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (GP_().getProperty(done)) return;
    GP_().setProperty(done, "1");
    const lm = JSON.parse(GP_().getProperty("lm:" + pm) || "{}");
    Object.keys(lm).sort((a, b) => lm[b] - lm[a]).slice(0, GROWTH.prize.length).forEach((id, i) => {
      const w = userGet_(id); if (w) plusAdd_(w, GROWTH.prize[i], `${i + 1}-е место в лиге приглашений`);
    });
  } finally { lock.releaseLock(); }
}
function growLeague_(u) {
  const lm = JSON.parse(GP_().getProperty("lm:" + growMonth_()) || "{}");
  const ids = Object.keys(lm).sort((a, b) => lm[b] - lm[a] || (a < b ? -1 : 1));
  const top = ids.slice(0, 5).map(id => { const w = userGet_(id); return { n: id === u.id ? "" : String((w && w.name) || "—").split(" ")[0], c: lm[id], me: id === u.id }; });
  return { month: growMonth_(), top, place: ids.indexOf(u.id) + 1, mine: lm[u.id] || 0, prize: GROWTH.prize };
}
function growOut_(u) {
  try { growPrizes_(); } catch (e) {}
  u = userGet_(u.id) || u;
  const lv = growLv_(u), next = GROWTH.lv[lv + 1] || null, pl = plusOf_(u), pc = partnerCode_(u);
  const head = u.fam && GP_().getProperty("fh:" + u.fam) === u.id;
  return {
    days: GROWTH.days, invitee: GP_().getProperty("GROW_INVITEE") === "0" ? 0 : GROWTH.invitee, inviter: GROWTH.inviter, l2days: GROWTH.l2, famDays: GROWTH.fam,
    act: u.act || 0, l2: u.l2 || 0, lv, status: GROWTH.lv[lv].n, next: next ? { n: next.n, need: next.need } : null, early: !!u.early,
    plus: pl.on ? { until: pl.forever ? 0 : pl.until, forever: pl.forever, fam: pl.fam } : null,
    myDays: u.by && !u.rw ? Math.min(GROWTH.days, u.nd || 0) : null,
    bon: (u.bon || []).slice(-6).reverse(),
    fam: u.fam ? { head, n: head ? users_().filter(x => x.fam === u.fam).length : 0, max: GROWTH.famMax } : null,
    partner: pc ? { code: pc.toUpperCase(), joined: (u.inv || []).filter(x => x.st === "in" || x.act).length, active: u.act || 0 } : null,
    league: growLeague_(u),
  };
}
