// IZIDAY · Обучение новичков: при первом запуске — карточки знакомства с Изи (на первой выбор «Взрослый / Ребёнок»),
// потом на «Сегодня» карточка «Первые шаги» (отмечаются сами по данным) и по одной подсказке при первом входе в раздел.
// Файл подключается ПОСЛЕ app.js и дополняет его функции todayTop, setTab и renderMore.
// Хранится только на телефоне: D.onb { intro, steps, tips{} } и D.who ("adult" | "kid"; детский режим включает свой файл
// по событию window "izi:who"). Тем, кто уже пользовался приложением, знакомство само не показывается — его можно
// открыть в настройках. В автотестах (navigator.webdriver) всё выключено, пока тест не поставит window.ONB_TEST.
(function () {
"use strict"
const auto = () => !navigator.webdriver || window.ONB_TEST
const O = () => (D.onb = D.onb || {})
const kid = () => D.who === "kid"
const nm = () => esc(iziName())

// ───────────── Иконки ─────────────
const P = {
  mic: '<path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M3 10h18M7 15h3"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  kid: '<circle cx="12" cy="7.5" r="3.2"/><path d="M7 21v-4.5a5 5 0 0 1 10 0V21M9.5 21v-3M14.5 21v-3"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  drop: '<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  gift: '<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M3 9h18v3H3zM12 9v11M12 9c-1.5-3-5-4-5-1.5S10 9 12 9zM12 9c1.5-3 5-4 5-1.5S14 9 12 9z"/>',
  chev: '<path d="M9.5 5.5l6.5 6.5-6.5 6.5"/>',
  bag: '<rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7M3.5 12.5h17"/>',
  home: '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M9.5 20.5v-6h5v6"/>',
  store: '<path d="M4 9l1.5-4.5h13L20 9M4 9h16v1.5a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0A2.7 2.7 0 0 1 4 10.5zM5.5 13v7h13v-7M10 20v-4h4v4"/>',
  book: '<path d="M4 19.5V5.5A2 2 0 0 1 6 3.5h14v13H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14"/>',
  family: '<circle cx="8" cy="7" r="2.6"/><circle cx="16.5" cy="8.5" r="2"/><path d="M3.5 20v-3.5a4.5 4.5 0 0 1 9 0V20M13 20v-3a3.5 3.5 0 0 1 7 0v3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7M9.5 16.4c-.2 0-.3.1-.5.1-3 0-5.5-1.1-5.5-2.5v-3"/><ellipse cx="15" cy="15" rx="5.5" ry="2.5"/><path d="M9.5 15v3.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V15"/>',
  run: '<circle cx="14" cy="4.5" r="1.8"/><path d="M6 20l3.5-5 3 2.5V21M8 10.5l3-3 3 2.5 2.5 2.5h3M11 7.5l1.5 6.5"/>',
  rise: '<path d="M4 18.5h16M7 15a5 5 0 0 1 10 0M12 4.5v4M9.5 7l2.5-2.5L14.5 7"/>',
  cup: '<path d="M5 8.5h11v5.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2M11 3.5v2"/>',
  chat: '<path d="M4.5 18.5l1-3.5a7.5 7.5 0 1 1 3 3z"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  quiet: '<path d="M4 12h3l2-5 3 10 2-5h6"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M9 6h3M10 9l2.5 7"/>',
  plane: '<path d="M10.5 13.5L3.5 11l1.5-1.5 7 1L16 6.5a2 2 0 0 1 3 3l-4 4 1 7-1.5 1.5-2.5-7-2.5 2.5v2.5L8 22l-1-3-3-1 1.5-1.5H8z"/>',
  paw: '<circle cx="7" cy="10" r="1.8"/><circle cx="10.5" cy="6.5" r="1.8"/><circle cx="14.5" cy="6.5" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M12.5 11.5c-3 0-5.5 4-5.5 6a2 2 0 0 0 2.6 1.9c1-.3 1.9-.4 2.9-.4s1.9.1 2.9.4A2 2 0 0 0 18 17.5c0-2-2.5-6-5.5-6z"/>',
  game: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4M15.5 11.5h.01M17.5 13.5h.01"/>',
}
const I = (n, s = 22) => `<svg class="ob-ic" width="${s}" height="${s}" viewBox="0 0 24 24">${P[n]}</svg>`
// Маленький шар — тот же живой рисунок, что на главной кнопке «Изи» (холст вешает app.js на все .izi-orb)
const orb = (s, st = "") => `<b class="izi-orb" style="width:${s}px;height:${s}px;${st}"></b>`
const feat = (ic, bg, t, s) => `<div class="ob-feat"><div class="b" style="background:${bg}">${I(ic)}</div><div><b>${t}</b><span>${s}</span></div></div>`

// ───────────── Анкета: привычки, цели, предпочтения (без личных данных; любой вопрос можно пропустить) ─────────────
// Ответы — D.prof { occ, wake, sleep, focus[], habits[], goal, goalText, likes[], dream } — только на телефоне.
// Изи учитывает их в разговоре (см. iziStyle ниже), выбранные привычки появляются в «Планах»
const PF = () => (D.prof = D.prof || {})
// [ключ, вопрос, подсказка, тип: one | many | rows(несколько строк по одному), варианты]
const Q_ADULT = [
  ["occ", "Чем вы заняты большую часть дня?", "Подстрою подсказки под ваш ритм", "one", [
    ["office", "bag", "Работаю в офисе"], ["remote", "home", "Работаю из дома"], ["biz", "store", "Своё дело"],
    ["study", "book", "Учусь"], ["family", "family", "Дом и семья"], ["free", "sun", "Свободный график"]]],
  ["rhythm", "Ваш обычный режим", "Когда присылать утреннюю сводку и напоминать о сне", "rows", [
    ["wake", "Обычно встаю", [["5", "до 6"], ["6", "6–7"], ["7", "7–8"], ["8", "8–9"], ["9", "позже 9"]]],
    ["sleep", "Обычно ложусь", [["21", "до 22"], ["22", "22–23"], ["23", "23–24"], ["24", "после 24"]]]]],
  ["focus", "Что хочется наладить в первую очередь?", "Можно выбрать несколько", "many", [
    ["tasks", "Порядок в делах"], ["money", "Деньги"], ["health", "Здоровье"], ["sleep", "Сон"], ["sport", "Спорт"],
    ["food", "Питание"], ["calm", "Меньше стресса"], ["close", "Время с близкими"], ["learn", "Учёба и развитие"]]],
  ["habits", "Какие привычки хотите завести?", "Отмечу их в «Планах» — лишние потом легко убрать", "many", [
    ["water", "Пить воду"], ["gym", "Зарядка"], ["read", "Читать"], ["bed", "Ложиться вовремя"], ["mind", "Медитация"],
    ["phone", "Меньше телефона"], ["steps", "Больше ходить"], ["lang", "Учить язык"], ["diary", "Вести дневник"]]],
  ["goal", "Главная цель на ближайшие месяцы", "Помогу разбить её на шаги", "one", [
    ["save", "coins", "Накопить на крупную покупку"], ["fit", "run", "Похудеть или окрепнуть"], ["career", "rise", "Вырасти в работе"],
    ["own", "store", "Запустить своё дело"], ["skill", "book", "Научиться новому"], ["rest", "cup", "Больше отдыхать"]], 1],
  ["izi", "Как мне с вами общаться?", "Можно поменять в настройках", "rows", [
    ["mode", "Характер", [["friend", "Как друг"], ["coach", "Строгий тренер"], ["brief", "Кратко"]]],
    ["first", "Писать первым", [["1", "Да, к месту"], ["0", "Только когда спрошу"]]]]],
]
const Q_KID = [
  ["likes", "Что тебе нравится?", "Выбери всё, что любишь", "many", [
    ["sport", "Спорт"], ["draw", "Рисовать"], ["read", "Читать"], ["games", "Игры"], ["music", "Музыка"], ["dance", "Танцы"],
    ["build", "Конструкторы"], ["animals", "Животные"], ["science", "Опыты и наука"]]],
  ["habits", "Что хочешь делать каждый день?", "Добавлю это в твои дела — за каждое звёзды", "many", [
    ["teeth", "Чистить зубы"], ["read", "Читать 15 минут"], ["gym", "Зарядка"], ["water", "Пить воду"], ["room", "Убирать комнату"], ["lessons", "Уроки сразу после школы"]]],
  ["dream", "О чём ты мечтаешь?", "Помогу накопить", "one", [
    ["toy", "game", "Игрушка или гаджет"], ["bike", "bike", "Велосипед или самокат"], ["trip", "plane", "Поездка"], ["pet", "paw", "Питомец"], ["gift", "gift", "Подарок кому-то"]], 1],
  ["izi", "Как мне с тобой говорить?", "", "rows", [["mode", "", [["friend", "Весело, как друг"], ["brief", "Коротко"]]]]],
]
const QS = () => kid() ? Q_KID : Q_ADULT
// Ответ на вопрос (для строк «rows» — поле в строке); характер и «писать первым» сразу идут в настройки Изи
function qVal(k) {
  const p = PF()
  if (k === "mode") return (D.izi || {}).mode || ""
  if (k === "first") return D.izi && "first" in D.izi ? (D.izi.first ? "1" : "0") : ""
  return p[k] == null ? "" : p[k]
}
function qSet(k, v, many) {
  if (k === "mode") return iziSet("mode", v)
  if (k === "first") return iziSet("first", v === "1")
  const p = PF()
  if (many) { const a = new Set(p[k] || []); a.has(v) ? a.delete(v) : a.add(v); p[k] = [...a] }
  else p[k] = p[k] === v ? "" : v
  p.at = Date.now(); save(false)
}
function qHTML(q, n, total) {
  const [k, t, hint, type, opts, txt] = q
  let b = ""
  if (type === "one") b = `<div class="ob-list">${opts.map(([v, ic, l], j) => `<button class="ob-row ${qVal(k) === v ? "on" : ""}" data-q="${k}" data-v="${v}" style="--d:${j * 35}ms"><span class="i">${I(ic, 20)}</span><span class="l">${l}</span><span class="c">${I("check", 16)}</span></button>`).join("")}</div>`
  if (type === "many") { const cur = qVal(k) || []; b = `<div class="ob-chips">${opts.map(([v, l], j) => `<button class="ob-chip ${cur.includes(v) ? "on" : ""}" data-q="${k}" data-v="${v}" data-many="1" style="--d:${j * 30}ms">${l}</button>`).join("")}</div>` }
  if (type === "rows") b = opts.map(([f, l, os], r) => `<div class="ob-seg-l">${l}</div><div class="ob-chips ob-seg">${os.map(([v, lb], j) => `<button class="ob-chip ${qVal(f) === v ? "on" : ""}" data-q="${f}" data-v="${v}" style="--d:${(r * 4 + j) * 30}ms">${lb}</button>`).join("")}</div>`).join("")
  if (txt) b += `<input class="ob-in" data-qt="${k}Text" placeholder="${kid() ? "или напиши своё" : "или своими словами"}" maxlength="80" value="${esc(PF()[k + "Text"] || "")}" enterkeyhint="done">`
  return `<div class="ob-step">Вопрос ${n} из ${total}</div><div class="ob-h ob-hq">${t}</div>${hint ? `<div class="ob-p ob-sm">${hint}</div>` : ""}<div class="ob-ans">${b}</div>`
}
// Привычки из анкеты — сразу в «Планы» (если такой ещё нет)
const HB = { water: ["Пить воду", "drop"], gym: ["Зарядка", "dumbbell"], read: ["Читать", "book"], bed: ["Ложиться вовремя", "moon"], mind: ["Медитация", "sun"],
  phone: ["Меньше телефона", "phone"], steps: ["Больше ходить", "activity"], lang: ["Учить язык", "pen"], diary: ["Вести дневник", "pen"],
  teeth: ["Чистить зубы", "check"], room: ["Убирать комнату", "check"], lessons: ["Уроки сразу после школы", "book"] }
function habitsFromQuiz() {
  const p = PF(), have = new Set(live(D.habits || []).map(h => String(h.title).toLowerCase()))
  for (const id of p.habits || []) {
    const h = HB[id]; if (!h || have.has(h[0].toLowerCase())) continue
    if (kid() && id === "read") h[0] = "Читать 15 минут"
    try { upsert("habits", { id: uid("h"), date: Date.now(), title: h[0], ico: h[1], emoji: (typeof ICO_EMO !== "undefined" && ICO_EMO[h[1]]) || "✓", bad: false, quiz: 1 }) } catch (e) {}
    have.add(h[0].toLowerCase())
  }
}
// Что Изи знает из анкеты — коротко в системную подсказку чата
function profText() {
  const p = D.prof || {}, out = [], lbl = (qk, v) => { for (const q of [...Q_ADULT, ...Q_KID]) if (q[0] === qk) { const o = q[4].find(x => x[0] === v); if (o) return o[o.length - 1] } return v }
  const many = (qk, k) => (p[k] || []).map(v => { for (const q of [...Q_ADULT, ...Q_KID]) if (q[0] === qk) { const o = q[4].find(x => x[0] === v); if (o) return o[1] } return v }).join(", ")
  if (p.occ) out.push("днём: " + lbl("occ", p.occ).toLowerCase())
  const W = { 5: "до 6", 6: "в 6–7", 7: "в 7–8", 8: "в 8–9", 9: "после 9" }, S = { 21: "до 22", 22: "в 22–23", 23: "в 23–24", 24: "после полуночи" }
  if (p.wake) out.push("встаёт " + W[p.wake]); if (p.sleep) out.push("ложится " + S[p.sleep])
  if ((p.focus || []).length) out.push("хочет наладить: " + many("focus", "focus").toLowerCase())
  if ((p.habits || []).length) out.push("хочет привычки: " + many("habits", "habits").toLowerCase())
  if (p.goal || p.goalText) out.push("главная цель: " + [p.goal && lbl("goal", p.goal).toLowerCase(), p.goalText].filter(Boolean).join(" — "))
  if ((p.likes || []).length) out.push("любит: " + many("likes", "likes").toLowerCase())
  if (p.dream || p.dreamText) out.push("мечта: " + [p.dream && lbl("dream", p.dream).toLowerCase(), p.dreamText].filter(Boolean).join(" — "))
  return out.length ? `Из анкеты при знакомстве (сам рассказал, можно опираться, не пересказывай дословно): ${out.join("; ")}.` : ""
}
if (typeof iziStyle === "function") { const _st = iziStyle; iziStyle = function () { const t = profText(); return _st() + (t ? "\n- " + t : "") } }

// ───────────── Знакомство: большой шар живого разговора и анкета ─────────────
// Шар — тот же, что в разговоре с Изи: когда «говорит» Изи (новая карточка), дрожит его волна,
// когда отвечает человек (касание варианта) — вторая. Шар один на всё знакомство и плавно меняет размер
function cards() {
  const who = `<div class="ob-pick"><button data-who="adult" class="${kid() ? "" : "on"}">${I("user", 28)}<b>Взрослый</b><small>полная версия</small></button><button data-who="kid" class="${kid() ? "on" : ""}">${I("kid", 28)}<b>Ребёнок</b><small>детская версия</small></button></div>`
  const qs = QS(), L = []
  L.push({ big: 1, h: kid() ? `<div class="ob-h">Привет! Я ${nm()}</div><div class="ob-p">Напомню про дела, похвалю за сделанное и помогу копить на мечту. Кто будет пользоваться?</div>${who}`
    : `<div class="ob-h">Привет! Я&nbsp;${nm()}</div><div class="ob-p">Помогу держать день под контролем: дела, деньги, здоровье. Кто будет пользоваться?</div>${who}` })
  L.push({ big: 1, h: `<div class="ob-h">${kid() ? "Давай познакомимся" : "Пара вопросов о вас"}</div>
    <div class="ob-p">${kid() ? `${qs.length} коротких вопроса, чтобы я лучше тебя понимал${iziG("", "а")}.` : `${qs.length} коротких вопросов о привычках и целях — так советы будут точнее. Ничего личного: ни имени, ни адреса.`}</div>
    <div class="ob-p ob-sm">${kid() ? "Любой вопрос можно пропустить" : "Любой вопрос можно пропустить, ответы видны только на этом телефоне"}</div>`, start: 1 })
  qs.forEach((q, j) => L.push({ q, h: qHTML(q, j + 1, qs.length) }))
  if (kid()) {
    L.push({ h: `<div class="ob-h">Скажи мне</div><div class="ob-p">Держи круглую кнопку внизу и говори. Я всё запишу сам${iziG("", "а")}.</div>
      <div class="ob-say">«Завтра футбол в пять»</div><div class="ob-say">«Я почистил зубы»</div><div class="ob-say">«Хочу накопить на самокат»</div>` })
    L.push({ h: `<div class="ob-h">Собирай звёзды</div><div class="ob-p">Каждое сделанное дело приносит звёзды. За звёзды — награды, которые вы придумаете вместе с родителями.</div>
      <div class="ob-tri">${[["check", "Делай дела"], ["star", "Собирай звёзды"], ["gift", "Получай награды"]].map(([n, t]) => `<div><span>${I(n, 24)}</span>${t}</div>`).join("")}</div>` })
    return L
  }
  L.push({ h: `<div class="ob-h">Просто скажите</div><div class="ob-p">Удерживайте шар внизу и говорите как человеку. ${nm()} сам поймёт, что это: дело, трата или вода.</div>
    <div class="ob-say">«Завтра в 10 стоматолог, и запиши такси 350»</div>
    ${feat("cal", "rgba(255,255,255,.14)", "Стоматолог", "завтра, 10:00 — в календарь")}${feat("money", "rgba(255,255,255,.14)", "Такси · 350", "трата, Транспорт")}` })
  L.push({ h: `<div class="ob-h">Пять разделов</div><div class="ob-p">Всё, что нужно на день, в одном месте</div>
    ${feat("cal", "rgba(255,255,255,.14)", "Сегодня", "события, дела, кольца дня")}${feat("list", "rgba(255,255,255,.14)", "Планы", "цели, списки, привычки")}
    <div class="ob-feat"><div class="b">${orb(30)}</div><div><b>${nm()}</b><span>нажмите — чат, удерживайте — голос</span></div></div>
    ${feat("money", "rgba(255,255,255,.14)", "Деньги", "траты, бюджет, «можно сегодня»")}${feat("heart", "rgba(255,255,255,.14)", "Здоровье", "вода, еда, шаги, дневник")}` })
  L.push({ big: 1, h: `<div class="ob-h">Учимся на деле</div><div class="ob-p">На «Сегодня» вас ждут «Первые шаги» — шесть простых дел, чтобы освоиться. А в каждом разделе ${nm()} один раз подскажет главное.</div>
    <div class="ob-p ob-sm">Знакомство и анкету можно повторить в настройках</div>` })
  return L
}

// Изи «говорит» — дрожит его волна; человек ответил — вторая
let speakT = 0
function iziSays(ms = 1500) {
  if (typeof SILK === "undefined") return
  clearInterval(speakT); SILK.demo = "say"; const t0 = Date.now()
  speakT = setInterval(() => { if (Date.now() - t0 > ms) { clearInterval(speakT); if (SILK.demo === "say") SILK.demo = "" ; return } SILK.ie = Math.min(1.3, SILK.ie + .25 + Math.random() * .3) }, 170)
}
function youSay() {
  if (typeof SILK === "undefined") return
  clearInterval(speakT); SILK.demo = "listen"; SILK.ye = Math.min(1.3, (SILK.ye || 0) + .9)
  speakT = setTimeout(() => { if (SILK.demo === "listen") SILK.demo = "" }, 700)
}

let ov = null
function intro(at) {
  if (ov) return
  ov = document.createElement("div")
  ov.id = "onb"
  ov.innerHTML = `<div class="ob-top"><div class="ob-prog"></div></div>
    <div class="ob-stage"><canvas></canvas></div><div class="ob-body"></div><div class="ob-foot"></div>`
  document.body.appendChild(ov)
  if (typeof silkCanvas === "function") silkCanvas(ov.querySelector(".ob-stage canvas"), "talk")
  const body = ov.querySelector(".ob-body"), foot = ov.querySelector(".ob-foot")
  let list = cards(), i = 0
  if (at === "quiz") i = list.findIndex(c => c.q) || 0
  const draw = (dir = 0) => {
    list = cards()
    const c = list[i], last = i === list.length - 1, qs = list.filter(x => x.q), inQuiz = !!c.q
    // друг без виджета: последняя карточка сразу ведёт ко входу через Google (friends.js)
    const gl = last && !kid() && !D.conn && window.FRIEND && FRIEND.on()
    ov.className = "ob-ov" + (kid() ? " kid" : "") + (c.big ? " big" : "") + (inQuiz ? " quiz" : "")
    ov.querySelector(".ob-prog").innerHTML = list.map((_, k) => `<i class="${k < i ? "done" : k === i ? "on" : ""}"></i>`).join("")
    body.innerHTML = `<div class="ob-card ${dir > 0 ? "in-r" : dir < 0 ? "in-l" : "in"}">${c.h}${gl ? `<div class="ob-p">Осталось войти через Google — и всё настроится само.</div>` : ""}</div>`
    foot.innerHTML = `<button class="ob-btn" data-ob="next">${gl ? FRIEND.gico + "Войти через Google" : last ? (kid() ? "Поехали!" : "Начать") : c.start ? "Начнём" : "Дальше"}</button>
      ${gl ? `<button class="ob-skip" data-ob="widget">У меня свой виджет Scriptable</button>` : ""}
      <button class="ob-skip" data-ob="${inQuiz || c.start ? "quiz-skip" : "skip"}" ${last && !gl ? "hidden" : ""}>${gl ? "Позже" : inQuiz || c.start ? "Пропустить анкету" : "Пропустить"}</button>`
    body.querySelectorAll("[data-who]").forEach(b => b.onclick = () => { youSay(); setWho(b.dataset.who); draw() })
    body.querySelectorAll("[data-q]").forEach(b => b.onclick = () => {
      youSay(); qSet(b.dataset.q, b.dataset.v, !!b.dataset.many)
      if (navigator.vibrate) navigator.vibrate(8)
      const one = !b.dataset.many && c.q[3] === "one"
      // выбор одного варианта — отметка и сам переход дальше; несколько — только отметка
      if (b.dataset.many || c.q[3] === "rows") { b.classList.toggle("on"); if (!b.dataset.many) b.parentNode.querySelectorAll(".ob-chip").forEach(x => x !== b && x.classList.remove("on")); return refreshFoot() }
      body.querySelectorAll(`[data-q="${b.dataset.q}"]`).forEach(x => x.classList.toggle("on", x === b && qVal(b.dataset.q) === b.dataset.v))
      refreshFoot()   // дальше — только кнопкой «Дальше»
    })
    const inp = body.querySelector("[data-qt]")
    if (inp) { inp.oninput = () => { PF()[inp.dataset.qt] = inp.value.trim().slice(0, 80); save(false); refreshFoot() }; inp.onkeydown = e => { if (e.key === "Enter") inp.blur() } }
    function refreshFoot() {}
    foot.querySelectorAll("button").forEach(b => b.onclick = () => act(b.dataset.ob))
    if (dir !== 0 || !draw.done) iziSays(c.q ? 1100 : 1600)
    draw.done = 1
  }
  const go = d => { const n = i + d; if (n < 0 || n >= list.length) return; i = n; draw(d) }
  const act = a => {
    const last = i === list.length - 1, gl = last && !kid() && !D.conn && window.FRIEND && FRIEND.on()
    if (a === "next") { if (list[i].q && list[i].q[0] === "habits") habitsFromQuiz(); return last ? (done(), gl && setTimeout(() => FRIEND.login(), 340)) : go(1) }
    if (a === "back") return go(-1)
    if (a === "skip") return done()
    if (a === "quiz-skip") { const k = list.findIndex((c, j) => j > i && !c.q && !c.start); i = k > 0 ? k : list.length - 1; return draw(1) }
    // владелец со своим виджетом: подключиться к нему, а не к серверу друзей (иначе — новый пустой аккаунт)
    if (a === "widget") { done(); setTimeout(() => FRIEND.widget(), 340) }
  }
  // Листание пальцем: влево — дальше, вправо — назад
  let x0 = null, y0 = 0
  ov.addEventListener("touchstart", e => { if (e.target.closest("input")) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY }, { passive: true })
  ov.addEventListener("touchend", e => {
    if (x0 == null) return
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) { if (list[i].q && list[i].q[0] === "habits") habitsFromQuiz(); go(1) } else go(-1)
  })
  const done = () => {
    O().intro = Date.now(); if (!D.who) setWho("adult"); habitsFromQuiz(); save(false)
    clearInterval(speakT); if (typeof SILK !== "undefined") SILK.demo = ""
    ov.classList.add("out"); setTimeout(() => { if (ov) ov.remove(); ov = null; if (tab === "today") render() }, 420)
    if (kid() && typeof window.famJoin === "function") setTimeout(() => window.famJoin(), 460)   // вход ребёнка по коду семьи — family.js
  }
  draw()
}
function setWho(w) {
  if (D.who === w) return
  D.who = w; save(false)
  window.dispatchEvent(new CustomEvent("izi:who", { detail: w }))
}

// ───────────── Первые шаги ─────────────
const has = k => live(D[k] || []).length > 0
const STEPS = () => [
  ["voice", "mic", kid() ? `Скажи ${nm()} первое дело` : `Скажите ${nm()} первое дело`, () => (D.chat || []).some(m => m.role === "user"), () => setTab("chat")],
  ["water", "drop", kid() ? "Отметь стакан воды" : "Отметьте стакан воды", () => has("water"), () => addWater(H().glass || 250)],
  ["money", "money", kid() ? "Запиши, что потратил" : "Запишите первую трату", () => has("money"), () => moneyForm("expense")],
  ["top3", "star", kid() ? "Выбери три главных дела" : "Выберите три главных дела", () => live(D.goals || []).some(g => g.kind === "top3"), () => top3Pick()],
  ["plan", "target", kid() ? "Загадай мечту в «Планах»" : "Добавьте цель или список в «Планы»", () => live(D.goals || []).some(g => /^(month|wish|dream|list|chore)$/.test(g.kind || "") || (D.habits && live(D.habits).length)), () => setTab("plans")],
  ["push", "bell", "Включите уведомления", () => typeof Notification !== "undefined" && Notification.permission === "granted", () => pushEnable()],
]
function stepsHTML() {
  const o = O()
  if (!auto() || !o.intro || o.steps) return ""
  const st = STEPS(), n = st.filter(s => s[3]()).length, pts = !!window.GAMI && !GAMI.off()
  if (n === st.length) { o.steps = "done"; save(false); setTimeout(() => toast(kid() ? "Ура! Ты освоился" : "Первые шаги пройдены"), 400); return "" }
  return `<div class="card ob-steps" id="ob-steps"><div class="ob-st-h">${orb(42, "margin:0;flex:none")}<div><b>Первые шаги с ${nm()}</b><span>${n} из ${st.length}${pts ? " · за каждый шаг баллы" : ""}</span></div></div>
    <div class="ob-bar"><i style="width:${Math.round(n / st.length * 100)}%"></i></div>
    ${st.map(([id, ic, t, isDone]) => { const d = isDone(); return `<button class="ob-st ${d ? "done" : ""}" data-obs="${id}"><span class="c">${d ? I("check", 15) : I(ic, 15)}</span><span class="t">${t}</span>${d ? "" : I("chev", 16)}</button>` }).join("")}
    <div class="ob-hide">смахните в сторону, чтобы скрыть</div></div>`
}
function bindSteps() {
  const c = document.getElementById("ob-steps"); if (!c || c._ob) return; c._ob = 1
  c.querySelectorAll("[data-obs]").forEach(b => b.onclick = () => { const s = STEPS().find(x => x[0] === b.dataset.obs); if (s && !s[3]()) s[4]() })
  let x0 = null
  c.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; c.style.transition = "none" }, { passive: true })
  c.addEventListener("touchmove", e => { if (x0 != null) { const dx = e.touches[0].clientX - x0; c.style.transform = `translateX(${dx}px)`; c.style.opacity = 1 - Math.min(Math.abs(dx) / 300, .7) } }, { passive: true })
  c.addEventListener("touchend", e => {
    if (x0 == null) return
    const dx = e.changedTouches[0].clientX - x0; x0 = null; c.style.transition = ""
    if (Math.abs(dx) > 110) { c.style.transform = `translateX(${dx > 0 ? 120 : -120}%)`; c.style.opacity = 0; O().steps = "hidden"; save(false); setTimeout(() => { toast("Первые шаги скрыты — вернуть можно в настройках"); render() }, 260) }
    else { c.style.transform = ""; c.style.opacity = "" }
  })
}

// ───────────── Подсказки по разделам (по одной, при первом входе) ─────────────
const TIPS = {
  plans: ["list", "Планы", "Здесь цели, свои списки, привычки и «Снова пора» — дела, которые повторяются. Скажите «Добавь в покупки молоко» — список появится сам.", "Ваши мечты, цели и списки живут здесь. Скажи «Хочу самокат» — и мечта появится."],
  money: ["money", "Деньги", "Трату не обязательно вводить руками: сфотографируйте чек или скажите «кофе 120». Категорию {n} выберет сам.", "Скажи «купил мороженое за 50» — я запишу. Так видно, сколько осталось на мечту."],
  health: ["heart", "Здоровье", "Вода, еда, шаги и дневник. Сфотографируйте тарелку — {n} посчитает калории и белок.", "Отмечай воду и что ел. Нажми на кольцо — увидишь, сколько осталось."],
  chat: ["sparkle", "{n}", "Пишите или удерживайте шар и говорите. {n} помнит важное о вас и может сам добавить дело, трату или напоминание.", "Можно писать или держать кнопку и говорить. Я всё пойму."],
  cal: ["cal", "Календарь", "Листайте дни пальцем. Скажите «Когда я свободен в пятницу?» — {n} найдёт окна с учётом дороги.", "Тут все твои дела по дням. Листай пальцем влево и вправо."],
}
let tipEl = null
function tip(t) {
  const o = O(), d = TIPS[t]
  if (!d || !auto() || !o.intro || (o.tips || {})[t] || tipEl || ov) return
  o.tips = Object.assign(o.tips || {}, { [t]: Date.now() }); save(false)
  const fill = s => s.replace(/\{n\}/g, nm())
  tipEl = document.createElement("div")
  tipEl.className = "ob-tip" + (kid() ? " kid" : "")
  tipEl.innerHTML = `<div class="ob-grab"></div><div class="ob-tip-b"><span class="ob-tip-i">${I(d[0] === "sparkle" ? "bulb" : d[0], 20)}</span><div><b>${fill(d[1])}</b><p>${fill(kid() && d[3] ? d[3] : d[2])}</p></div></div>
    <div class="ob-tip-f"><span>смахните вниз — скрыть</span><button>Понятно</button></div>`
  document.body.appendChild(tipEl)
  const el = tipEl, close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 300); if (tipEl === el) tipEl = null }
  el.querySelector("button").onclick = close
  let y0 = null
  el.addEventListener("touchstart", e => { y0 = e.touches[0].clientY; el.style.transition = "none" }, { passive: true })
  el.addEventListener("touchmove", e => { if (y0 != null) el.style.transform = `translateY(${Math.max(0, e.touches[0].clientY - y0)}px)` }, { passive: true })
  el.addEventListener("touchend", e => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null; el.style.transition = ""; if (dy > 60) close(); else el.style.transform = "" })
  setTimeout(() => { if (tipEl === el) close() }, 14000)
}

// ───────────── Подключение к app.js ─────────────
const _top = todayTop
todayTop = function (v, now) { return stepsHTML() + _top(v, now) }
const _setTab = setTab
setTab = function (t) { if (tipEl) { tipEl.remove(); tipEl = null } _setTab(t); setTimeout(() => tip(t), 650) }
const _render = render
render = function () { _render(); bindSteps() }
const _more = renderMore
renderMore = function () {
  return `<div class="card"><h2>Знакомство</h2>
    <div class="set"><span>Кто пользуется</span><div class="seg"><button data-onb-who="adult" class="${kid() ? "" : "on"}">Взрослый</button><button data-onb-who="kid" class="${kid() ? "on" : ""}">Ребёнок</button></div></div>
    <div class="btns" style="margin-top:8px"><button class="btn" data-do="onb-intro">Показать знакомство</button><button class="btn" data-do="onb-quiz">Анкета о привычках и целях</button><button class="btn" data-do="onb-reset">Первые шаги и подсказки заново</button></div></div>` + _more()
}
Object.assign(DO, {
  "onb-intro": () => intro(),
  "onb-quiz": () => intro("quiz"),
  "onb-reset": () => { const o = O(); delete o.steps; o.tips = {}; o.intro = o.intro || Date.now(); save(false); toast("Первые шаги — на «Сегодня»"); setTab("today") },
})
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-onb-who]"); if (b) { setWho(b.dataset.onbWho); render() } })

// Кто уже пользовался приложением (есть записи или разговор) — знакомство само не показываем
function start() {
  const o = O()
  if (!o.intro && !o.seen) {
    o.seen = Date.now()
    const used = ["money", "water", "food", "rems", "goals"].some(has) || (D.chat || []).some(m => m.role === "user")
    if (used) { o.intro = Date.now(); o.steps = "old"; o.tips = { plans: 1, money: 1, health: 1, chat: 1, cal: 1 }; if (!D.who) D.who = "adult" }
    save(false)
  }
  if (auto() && !o.intro) intro()
  render()
}
window.ONB = { intro, tip, who: () => D.who || "adult", start }
start()
})()
