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
// войти смогут только они), AI_DAY (запросов к Claude в день на человека).

const FR = { client: "__GOOGLE_CLIENT__", max: 30, aiDay: 80, aiAll: 1500, model: "claude-haiku-5-5", maxTokens: 4000,
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
  if (body.metrics) return out_(metrics_(body.metrics, body.secret ? userBySecret_(body.secret) : null));   // журнал действий — без доступа к данным
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
  if (body.gcal) return out_(gcalLink_(u, body.gcal));
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
function meOut_(u) { const g = gcalGet_(u); return { id: u.id, name: u.name, email: u.email, pic: u.pic, left: aiLeft_(u), gcal: g ? g.email || "Google" : "" }; }

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
      .map(k => ({ id: k.primary ? "primary" : k.id, name: k.summaryOverride || k.summary || "Календарь", primary: !!k.primary }));
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
    return { events: out.slice(0, 600), calendars: cals.map(k => ({ name: k.name, primary: k.primary })), source: "google" };
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
