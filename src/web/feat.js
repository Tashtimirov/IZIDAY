// IZIDAY · Функции по выбору. Новичок при знакомстве сам решает, что включить сейчас, остальное подключает позже:
// в Настройках → «Функции», в выключенном разделе (там витрина и кнопка «Подключить»), внизу «Сегодня» («Выключенные
// функции» с зелёным «+»), из чата (Изи выполнил просьбу к выключенной функции — под ответом карточка «Подключить»)
// и по карточке «Можно подключить» на «Сегодня» (не чаще раза в 3 дня, по одной функции).
// Всегда включены: Сегодня, Планы, Изи, дни рождения. По выбору: Деньги, Здоровье (вместе с лекарствами), Игра,
// Голодание, Семья. Выключение ничего не удаляет и ничего не запрещает Изи: просьба выполняется, данные сохраняются.
// Хранится на телефоне: D.feat { money, health, fast, family: 0|1 } (нет ключа — включено: у старых пользователей всё
// как было), игра — прежний D.gamiOff (gami.js). D.featAsk { f: когда предлагали } , D.featHint = 0 — не предлагать.
// Детский режим не затрагивается. Подключается после mem.js и до order.js.
window.FEAT = (function () {
"use strict"
const P = {
  money: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M3 10h18M7 15h3"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2.5h6"/>',
  family: '<circle cx="8" cy="7" r="2.6"/><circle cx="16.5" cy="8.5" r="2"/><path d="M3.5 20v-3.5a4.5 4.5 0 0 1 9 0V20M13 20v-3a3.5 3.5 0 0 1 7 0v3"/>',
  mic: '<path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  cam: '<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M9 7l1.5-2.5h3L15 7"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  drop: '<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z"/>',
  pill: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-40 12 12)"/><path d="M9.2 8.4l6.4 7.2"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  gift: '<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M3 9h18v3H3zM12 9v11M12 9c-1.5-3-5-4-5-1.5S10 9 12 9zM12 9c1.5-3 5-4 5-1.5S14 9 12 9z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
}
const I = (n, s = 20) => `<svg class="ft-ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`
const nm = () => esc(typeof iziName === "function" ? iziName() : "Изи")

// [ключ, иконка, название, коротко, что умеет (витрина), инструменты Изи]
const LIST = [
  ["money", "money", "Деньги", "траты, бюджет, «можно сегодня»",
    [["mic", "Трату можно просто сказать", "«кофе 120», «такси 350»"], ["cam", "Чек по фото", "сумму и категорию {n} разберёт сам"], ["chart", "Сколько можно потратить сегодня", "бюджет по категориям, копилки и подписки"]],
    /^(add_money|get_money|set_budget|add_recurring|pay_recurring|add_jar|jar_deposit|add_debt)$/],
  ["health", "heart", "Здоровье", "вода, еда, шаги, сон, лекарства",
    [["drop", "Вода одним касанием", "и напоминание, если забыли попить"], ["cam", "Калории по фото тарелки", "белки, жиры, углеводы"], ["pill", "Лекарства и витамины", "когда что принять, напомню вовремя"], ["moon", "Сон и самочувствие", "дневник и неделя на графике"]],
    /^(add_food|add_water|get_health|log_weight|log_sleep|log_mood|add_med|add_medrec)$/],
  ["game", "star", "Игра", "баллы, задания дня, альбом", null, null],
  ["fast", "clock", "Голодание", "таймер окна еды, от 16 часов до 7 суток", null, /^(start_fast|stop_fast)$/],
  ["family", "family", "Семья", "общий календарь, дети", null, null],
]
const META = Object.fromEntries(LIST.map(x => [x[0], x]))
const NAME = k => (META[k] || [])[2] || k
const F = () => (D.feat = D.feat || {})
const kid = () => D.who === "kid" || (D.fam && D.fam.code && D.fam.role === "kid") || document.body.classList.contains("kidm")
const famIn = () => !!(D.fam && D.fam.code)

function on(k) {
  if (!D) return true
  if (k === "game") return !D.gamiOff
  if (k === "family" && famIn()) return true
  return !D.feat || D.feat[k] !== 0
}
// Включить / выключить. Игра — через gami.js (он сам убирает баллы, задания и инструменты Изи)
function set(k, v, quiet) {
  v = !!v
  if (on(k) === v) return
  if (k === "game") { if (window.GAMI && GAMI.set) GAMI.set(v); else { if (v) delete D.gamiOff; else D.gamiOff = 1 } }
  else { if (v) delete F()[k]; else F()[k] = 0 }
  if (D.featAsk) delete D.featAsk[k]
  syncPlans(); save(false)
  if (typeof tipsSync === "function") try { tipsSync() } catch (e) {}   // выключенная функция — без подсказок по ней (и на сервере)
  if (!quiet) { toast(v ? `${NAME(k)}: подключено` : `${NAME(k)}: выключено, данные сохранены`); render() }
}
const offList = () => kid() ? [] : LIST.map(x => x[0]).filter(k => !on(k))

// Набор для новичка: всегда — Сегодня, Планы, Изи; Деньги и Здоровье — по ответам анкеты (анкету пропустили — включены);
// Игра, Голодание и Семья — выключены, подключаются позже
function defaults() {
  const fo = (D.prof && D.prof.focus) || []
  return {
    money: !fo.length || fo.includes("money"),
    health: !fo.length || fo.some(x => /^(health|sleep|sport|food)$/.test(x)),
    game: false, fast: false, family: false,
  }
}
function apply(st) { for (const [k] of LIST) if (k in st) set(k, st[k], true) }

// «Семья» в фильтрах «Планов» (family.js добавляет её сам; без семьи и с выключенной функцией — убираем)
let famF = null
function syncPlans() {
  if (typeof PLAN_F === "undefined") return
  const i = PLAN_F.findIndex(x => x[0] === "fam"), want = on("family")
  if (i >= 0) famF = PLAN_F[i]
  if (!want && i >= 0) { PLAN_F.splice(i, 1); if (typeof plansF !== "undefined" && plansF === "fam") plansF = "all" }
  if (want && i < 0 && famF) PLAN_F.push(famF)
}

// ───────────── Переключатели (знакомство и настройки) ─────────────
function rowHTML(k, val, cls = "") {
  const m = META[k]
  return `<button type="button" class="ft-row ${cls}" data-ft-tg="${k}" aria-pressed="${val ? "true" : "false"}"><span class="ft-b">${I(m[1])}</span><span class="ft-t"><b>${m[2]}</b><span>${m[3]}</span></span><span class="tgl ${val ? "on" : ""}"></span></button>`
}
// Карточка знакомства: вместо «Пять разделов». draft — выбор до «Начать»
let draft = null
function pickHTML(first) {
  // пока человек сам ничего не трогал, набор следует ответам анкеты (их можно поменять, вернувшись назад)
  if (!draft || !draft._touched) { draft = {}; const d = first ? defaults() : null; for (const [k] of LIST) draft[k] = d ? d[k] : on(k) }
  if (famIn()) draft.family = true
  return `<div class="ob-h">Что включить сейчас?</div><div class="ob-p">Остальное подключите, когда понадобится. ${nm()} подскажет.</div>
    <div class="ft-lab">Всегда с вами</div>
    <div class="ft-base"><span>${I("cal", 17)}Сегодня</span><span>${I("list", 17)}Планы</span><span><b class="izi-orb" style="width:18px;height:18px"></b>${nm()}</span></div>
    <div class="ft-lab">По выбору</div>
    <div class="ft-pick">${LIST.map(([k]) => rowHTML(k, draft[k])).join("")}</div>`
}
function pickBind(root) {
  root.querySelectorAll("[data-ft-tg]").forEach(b => b.onclick = () => {
    const k = b.dataset.ftTg; if (k === "family" && famIn()) return
    draft[k] = !draft[k]; draft._touched = 1
    b.querySelector(".tgl").classList.toggle("on", draft[k]); b.setAttribute("aria-pressed", draft[k] ? "true" : "false")
    if (navigator.vibrate) navigator.vibrate(8)
  })
}
// first — первое знакомство: если человек нажал «Пропустить», ставим набор новичка
function pickDone(first) {
  if (kid()) { draft = null; return }
  apply(draft || (first ? defaults() : {}))
  draft = null
}
function pickAll() { draft = draft || {}; for (const [k] of LIST) draft[k] = true; draft._touched = 1 }

function moreCard() {
  if (kid()) return ""
  return `<div class="card ft-more" id="ft-more"><h2>Функции</h2><div class="muted small" style="margin:-2px 0 6px">Сегодня, Планы, ${nm()} и дни рождения работают всегда. Остальное включайте, когда нужно: выключение ничего не удаляет.</div>
    ${LIST.map(([k]) => rowHTML(k, on(k), "ft-set")).join("")}
    <button type="button" class="ft-row ft-set" data-ft-hint="1"><span class="ft-b">${I("bulb")}</span><span class="ft-t"><b>Предлагать новое</b><span>не чаще раза в 3 дня</span></span><span class="tgl ${D.featHint === 0 ? "" : "on"}"></span></button></div>`
}

// ───────────── Выключенный раздел: витрина с «Подключить» ─────────────
function showHTML(k) {
  const m = META[k], fill = s => s.replace(/\{n\}/g, nm())
  let extra = ""
  if (k === "money") {
    // траты, которые человек уже назвал Изи, видны и удаляются прямо здесь
    // если в приложении есть смахивание для удаления (moneySwipe), своя кнопка не нужна: вид как во всём приложении
    const swipe = typeof moneySwipe === "function"
    const ops = live(D.money || []).sort((a, b) => b.date - a.date).slice(0, 30)
    if (ops.length) extra = `<div class="card ft-ops"><h2>Уже записано</h2>${ops.map(e => `<div class="row" data-money="${esc(e.id)}"><div class="grow"><div class="t">${e.type === "income" ? "+" : "−"}${esc(core.money(e.amount))} · ${esc(e.category || "")}</div><div class="s">${esc(dayName(new Date(e.date)))}${e.comment ? " · " + esc(e.comment) : ""}</div></div>${swipe ? "" : `<button type="button" class="ft-del" data-ft-del="${esc(e.id)}" aria-label="Удалить">${I("trash", 18)}<span>Удалить</span></button>`}</div>`).join("")}</div>`
  }
  return `<div class="card ft-show"><div class="ft-sh"><span class="ft-b ft-bb">${I(m[1], 24)}</span><div><h2>${m[2]}</h2><div class="muted small">Раздел выключен. Подключается одним касанием</div></div></div>
    ${(m[4] || []).map(([ic, t, s]) => `<div class="ft-li"><span class="ft-b">${I(ic, 19)}</span><div><b>${t}</b><span>${fill(s)}</span></div></div>`).join("")}
    <button type="button" class="btn primary ft-go" data-ft-on="${k}">${I("plus", 20)}Подключить: ${m[2]}</button>
    <div class="muted small" style="text-align:center;margin-top:8px">Включить и выключить можно в Настройках → «Функции»</div></div>${extra}`
}

// ───────────── Чат: Изи выполнил просьбу к выключенной функции — предложить подключить ─────────────
let pend = null
const WEEK = 7 * 864e5
function touched(name) {
  if (kid()) return
  const m = LIST.find(x => x[5] && x[5].test(name))
  if (!m || on(m[0])) return
  const ask = D.featAsk = D.featAsk || {}
  if (Date.now() - (ask[m[0]] || 0) < WEEK) return
  ask[m[0]] = Date.now(); save(false)
  pend = { k: m[0], at: Date.now() }
}
function offerHTML() {
  if (!pend || on(pend.k) || Date.now() - pend.at > 20 * 60e3) { pend = null; return "" }
  const k = pend.k, why = { money: "В нём видно траты за месяц и сколько можно потратить сегодня.", health: "В нём вода, еда, шаги, сон и лекарства за день и за неделю.", fast: "В нём таймер и напоминания про воду." }[k] || ""
  return `<div class="ft-offer-c"><div class="ft-oc-t">${I(META[k][1], 19)}<span>Раздел «${NAME(k)}» у вас выключен. ${why}</span></div>
    <div class="ft-oc-b"><button type="button" class="btn primary small" data-ft-on="${k}">Подключить</button><button type="button" class="btn small" data-ft-no="${k}">Не сейчас</button></div></div>`
}

// ───────────── «Сегодня»: карточка «Можно подключить» и список выключенных ─────────────
const DAY = 864e5
const WHY = {
  money: () => { const n = live(D.money || []).length; return n ? `${nm()} уже записал ${n} ${plural(n, "операцию", "операции", "операций")}. В разделе видно траты за месяц и сколько можно потратить сегодня.` : "Трату можно просто сказать или сфотографировать чек. В разделе видно, сколько можно потратить сегодня." },
  health: () => "Вода, еда по фото, шаги, сон и лекарства в одном месте. Напомню попить и принять таблетку.",
  game: () => "За дела и привычки будут баллы и ранги, а каждое утро три задания дня.",
  fast: () => "Таймер окна еды от 16 часов до 7 суток и напоминания про воду.",
  family: () => "Общий календарь с близкими и детская версия с заданиями и звёздами.",
}
function hintKey() {
  if (kid() || D.featHint === 0 || !D.onb || !D.onb.intro || D.onb.steps === "old") return ""
  if (Date.now() - D.onb.intro < 3 * DAY) return ""
  const ask = D.featAsk = D.featAsk || {}
  if (Date.now() - (ask._card || 0) < 3 * DAY) return ""
  return offList().find(k => Date.now() - (ask[k] || 0) >= 14 * DAY) || ""
}
let hintToday = null
function todayHTML() {
  if (kid() || tab !== "today" || !sameDay(selDay, new Date())) return ""
  let html = ""
  const day = dayKey(new Date())
  if (!hintToday || hintToday.day !== day) hintToday = { day, k: hintKey() }
  const k = hintToday.k
  if (k && !on(k)) {
    if (!(D.featAsk || {})._shown || D.featAsk._shown !== day) { D.featAsk._shown = day; D.featAsk._card = Date.now(); D.featAsk[k] = Date.now(); setTimeout(() => save(false), 0) }
    html += `<div class="card ft-hint" id="ft-hint"><div class="ft-pill">Можно подключить</div><div class="ft-sh"><span class="ft-b ft-bb">${I(META[k][1], 22)}</span><div><h2>${NAME(k)}</h2><div class="muted small">${META[k][3]}</div></div></div>
      <div class="ft-hint-p">${WHY[k]()}</div>
      <div class="ft-oc-b"><button type="button" class="btn primary" data-ft-on="${k}">Подключить</button><button type="button" class="btn" data-ft-hide="1">Не сейчас</button></div>
      <div class="ft-sw">смахните в сторону, чтобы скрыть</div></div>`
  }
  const off = offList()
  if (off.length) html += `<div class="ft-tray"><div class="bk-tray-h">Выключенные функции</div><div class="bk-list">${off.map(k => `<button type="button" class="bk-add" data-ft-on="${k}"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 7v10M7 12h10"/></svg></i><span>${NAME(k)}</span><small>${META[k][3]}</small></button>`).join("")}</div></div>`
  return html
}
function hideHint() {
  const c = document.getElementById("ft-hint"); if (hintToday) hintToday.k = ""
  if (!c) return render()
  c.classList.add("gone"); setTimeout(render, 260)
}
function bindHint() {
  const c = document.getElementById("ft-hint"); if (!c || c._ft) return; c._ft = 1
  let x0 = null
  c.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; c.style.transition = "none" }, { passive: true })
  c.addEventListener("touchmove", e => { if (x0 != null) { const dx = e.touches[0].clientX - x0; c.style.transform = `translateX(${dx}px)`; c.style.opacity = 1 - Math.min(Math.abs(dx) / 300, .7) } }, { passive: true })
  c.addEventListener("touchend", e => {
    if (x0 == null) return
    const dx = e.changedTouches[0].clientX - x0; x0 = null; c.style.transition = ""
    if (Math.abs(dx) > 110) { c.style.transform = `translateX(${dx > 0 ? 120 : -120}%)`; c.style.opacity = 0; if (hintToday) hintToday.k = ""; setTimeout(render, 260) }
    else { c.style.transform = ""; c.style.opacity = "" }
  })
}

// ───────────── Подключение к app.js ─────────────
function wrap() {
  const money0 = renderMoney
  renderMoney = function () { return kid() || on("money") ? money0.apply(this, arguments) : showHTML("money") }
  const health0 = renderHealth
  renderHealth = function () { return kid() || on("health") ? health0.apply(this, arguments) : showHTML("health") }
  const fast0 = fastCard
  fastCard = function () { return kid() || on("fast") ? fast0.apply(this, arguments) : "" }
  // кольца дня: без выключенных разделов
  const rings0 = ringsCard
  ringsCard = function () {
    let h = rings0.apply(this, arguments)
    if (kid()) return h
    if (!on("health")) h = h.replace(/<button class="rg" data-do="(water|tab-health)">[\s\S]*?<\/button>/g, "")
    if (!on("money")) h = h.replace(/<button class="rg" data-do="tab-money">[\s\S]*?<\/button>/g, "")
    return h
  }
  const today0 = renderToday
  renderToday = function () { return today0.apply(this, arguments) + todayHTML() }
  const items0 = chatItems
  chatItems = function () { const h = items0.apply(this, arguments); return chatBusy ? h : h + offerHTML() }
  const tool0 = runTool
  runTool = async function (name) { const r = await tool0.apply(this, arguments); try { touched(name) } catch (e) {} return r }
  // Изи знает, что выключено, но просьбы выполняет как обычно и не уговаривает: кнопку покажет приложение
  const sys0 = agentSystem
  agentSystem = function () {
    const s = sys0.apply(this, arguments), off = offList().filter(k => k !== "game")
    return off.length ? s + `\n- Пользователь выключил разделы: ${off.map(NAME).join(", ")}. Просьбы про них выполняй как обычно, данные сохранятся. Не уговаривай включить и не объясняй, как: кнопку «Подключить» приложение покажет само.` : s
  }
  const more0 = renderMore
  renderMore = function () { return moreCard() + more0.apply(this, arguments) }
  const render0 = render
  render = function () { render0.apply(this, arguments); try { bindHint() } catch (e) {} }
  syncPlans()
}
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-ft-on], [data-ft-no], [data-ft-hide], [data-ft-del], .ft-set[data-ft-tg], [data-ft-hint]")
  if (!t) return
  e.stopPropagation()
  if (t.dataset.ftOn) { pend = null; if (hintToday && hintToday.k === t.dataset.ftOn) hintToday.k = ""; set(t.dataset.ftOn, true); return }
  if (t.dataset.ftNo) { pend = null; if (typeof renderChat === "function") renderChat(); return }
  if (t.dataset.ftHide) return hideHint()
  if (t.dataset.ftDel) { remove("money", t.dataset.ftDel); toast("Удалено"); return render() }
  if (t.dataset.ftHint) { D.featHint = D.featHint === 0 ? 1 : 0; if (D.featHint) delete D.featHint; save(false); return render() }
  if (t.dataset.ftTg) { const k = t.dataset.ftTg; if (k === "family" && famIn()) return toast("Вы в семье: выйти можно в разделе «Семья»"); set(k, !on(k)) }
}, true)
wrap()
return { on, set, offList, defaults, pickHTML, pickBind, pickDone, pickAll, LIST, NAME, touched, _reset: () => { draft = null; pend = null; hintToday = null } }
})()
