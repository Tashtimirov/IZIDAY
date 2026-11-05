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
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.5A5.5 5.5 0 0 1 6 17.4L4.3 14a1.5 1.5 0 0 1 2.6-1.5L8 14"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  kid: '<circle cx="12" cy="9" r="5"/><path d="M10 9h.01M14 9h.01M10 11.3c1.2.9 2.8.9 4 0M6 21a6 6 0 0 1 12 0"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  drop: '<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  gift: '<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M3 9h18v3H3zM12 9v11M12 9c-1.5-3-5-4-5-1.5S10 9 12 9zM12 9c1.5-3 5-4 5-1.5S14 9 12 9z"/>',
  chev: '<path d="M9.5 5.5l6.5 6.5-6.5 6.5"/>',
}
const I = (n, s = 22) => `<svg class="ob-ic" width="${s}" height="${s}" viewBox="0 0 24 24">${P[n]}</svg>`
const orb = (s, st = "") => `<div class="ob-orb" style="width:${s}px;height:${s}px;${st}"><svg viewBox="0 0 100 100"><path class="w1" d="M14 50 C 26 30, 38 30, 50 50 S 74 70, 86 50"/><path class="w2" d="M14 50 C 26 64, 38 64, 50 50 S 74 36, 86 50"/></svg></div>`
const feat = (ic, bg, t, s) => `<div class="ob-feat"><div class="b" style="background:${bg}">${I(ic)}</div><div><b>${t}</b><span>${s}</span></div></div>`

// ───────────── Карточки знакомства ─────────────
function cards() {
  const who = `<div class="ob-q">Кто будет пользоваться?</div>
    <div class="ob-pick"><button data-who="adult" class="${kid() ? "" : "on"}">${I("user", 30)}Взрослый<small>полная версия</small></button><button data-who="kid" class="${kid() ? "on" : ""}">${I("kid", 30)}Ребёнок<small>детская версия</small></button></div>`
  if (kid()) return [
    `<div class="ob-hero">${orb(160)}<i class="ob-sp s1">${I("star", 26)}</i><i class="ob-sp s2">${I("sparkle", 22)}</i></div>
     <div class="ob-h">Привет! Я ${nm()},<br>твой друг-помощник</div>
     <div class="ob-p">Напомню про дела, похвалю за сделанное и помогу копить на мечту</div>${who}`,
    `<div class="ob-h">Скажи мне</div>
     <div class="ob-p">Держи круглую кнопку внизу и говори. Я всё запишу сам.</div>
     <div class="ob-say">«Завтра футбол в пять»</div><div class="ob-say">«Я почистил зубы»</div><div class="ob-say">«Хочу накопить на самокат»</div>
     <div class="ob-try">${orb(84)}<i>${I("hand", 40)}</i></div>`,
    `<div class="ob-h">Собирай звёзды</div>
     <div class="ob-p">Каждое сделанное дело приносит звёзды. За звёзды — награды, которые вы придумаете вместе с родителями.</div>
     <div class="ob-tri">${[["check", "#22c08a", "Делай дела"], ["star", "#ffb020", "Собирай звёзды"], ["gift", "#8b5cf6", "Получай награды"]].map(([n, c, t]) => `<div><span style="background:${c}">${I(n, 26)}</span>${t}</div>`).join("")}</div>`,
  ]
  return [
    `<div class="ob-hero">${orb(150)}</div>
     <div class="ob-h">Привет! Я&nbsp;${nm()}</div>
     <div class="ob-p">Помогу держать день под контролем: дела, деньги, здоровье. Расскажу, как всё устроено, — займёт минуту.</div>${who}`,
    `<div class="ob-h">Просто скажите</div>
     <div class="ob-p">Удерживайте круглую кнопку внизу и говорите как человеку. ${nm()} сам поймёт, что это: дело, трата или вода.</div>
     <div class="ob-say">«Завтра в 10 стоматолог, и запиши такси 350»</div>
     ${feat("cal", "#0FA89C", "Стоматолог", "завтра, 10:00 — в календарь")}${feat("money", "#1f8fff", "Такси · 350", "трата, Транспорт")}
     <div class="ob-try">${orb(84)}<i>${I("hand", 40)}</i></div><div class="ob-p ob-sm">Нажмите на кнопку — откроется чат, можно писать</div>`,
    `<div class="ob-h">Пять разделов</div>
     <div class="ob-p">Всё, что нужно на день, в одном месте</div>
     ${feat("cal", "#0B8F5C", "Сегодня", "события, дела, кольца дня")}${feat("list", "#8b5cf6", "Планы", "цели, списки, привычки")}
     ${feat("sparkle", "linear-gradient(135deg,#0b8f5c,#1f8fff)", nm(), "нажмите — чат, удерживайте — голос")}
     ${feat("money", "#1f8fff", "Деньги", "траты, бюджет, «можно сегодня»")}${feat("heart", "#ff5f6d", "Здоровье", "вода, еда, шаги, дневник")}`,
    `<div class="ob-hero">${orb(120)}</div>
     <div class="ob-h">Учимся на деле</div>
     <div class="ob-p">На «Сегодня» вас ждут «Первые шаги» — шесть простых дел, чтобы освоиться. А в каждом разделе ${nm()} один раз подскажет главное.</div>
     <div class="ob-p ob-sm">Знакомство можно повторить в настройках</div>`,
  ]
}

let ov = null
function intro() {
  if (ov) return
  ov = document.createElement("div")
  ov.id = "onb"
  document.body.appendChild(ov)
  let i = 0, list = cards()
  const draw = (dir = 0) => {
    list = cards()
    const last = i === list.length - 1
    // друг без виджета: последняя карточка сразу ведёт ко входу через Google (friends.js)
    const gl = last && !kid() && !D.conn && window.FRIEND && FRIEND.on()
    ov.className = "ob-ov" + (kid() ? " kid" : "")
    ov.innerHTML = `<div class="ob-card ${dir > 0 ? "in-r" : dir < 0 ? "in-l" : "in"}">${list[i]}${gl ? `<div class="ob-p">Осталось войти через Google — и всё настроится само.</div>` : ""}</div>
      <div class="ob-foot"><div class="ob-dots">${list.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      <button class="ob-btn" data-ob="next">${gl ? FRIEND.gico + "Войти через Google" : last ? (kid() ? "Поехали!" : "Начать") : "Дальше"}</button>
      <button class="ob-skip" data-ob="skip" ${last && !gl ? "hidden" : ""}>${gl ? "Позже" : "Пропустить"}</button></div>`
    ov.querySelectorAll("[data-who]").forEach(b => b.onclick = () => { setWho(b.dataset.who); draw() })
    ov.querySelector('[data-ob="next"]').onclick = () => last ? (done(), gl && setTimeout(() => FRIEND.login(), 340)) : (i++, draw(1))
    ov.querySelector('[data-ob="skip"]').onclick = done
  }
  // Листание пальцем: влево — дальше, вправо — назад
  let x0 = null, y0 = 0
  ov.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY }, { passive: true })
  ov.addEventListener("touchend", e => {
    if (x0 == null) return
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0 && i < list.length - 1) { i++; draw(1) } else if (dx > 0 && i > 0) { i--; draw(-1) }
  })
  const done = () => {
    O().intro = Date.now(); if (!D.who) setWho("adult"); save(false)
    ov.classList.add("out"); setTimeout(() => { if (ov) ov.remove(); ov = null; if (tab === "today") render() }, 320)
    if (kid() && typeof window.famJoin === "function") setTimeout(() => window.famJoin(), 360)   // вход ребёнка по коду семьи — family.js
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
    <div class="btns" style="margin-top:8px"><button class="btn" data-do="onb-intro">Показать знакомство</button><button class="btn" data-do="onb-reset">Первые шаги и подсказки заново</button></div></div>` + _more()
}
Object.assign(DO, {
  "onb-intro": () => intro(),
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
