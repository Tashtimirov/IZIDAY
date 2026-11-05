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
