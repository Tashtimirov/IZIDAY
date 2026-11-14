// IZIDAY · Игра+: задания дня от Изи, комбо, боссы, карта пути к цели, шар Изи растёт с рангом.
// Подключается после gami.js и работает через его расширения (window.GAMI.GX). Баллы, как и в gami.js, не хранятся —
// считаются из данных. Хранятся только задания дня (goals kind "quests") и боссы (goals kind "boss").
// Всё скрывается, когда в Настройках выключен «Режим игры» (D.gamiOff): данные остаются.
(function () {
"use strict"
document.addEventListener("DOMContentLoaded", () => { try { init() } catch (e) { console.error("quest", e) } })

const Q_PTS = 15, Q_ALL = 30, BOSS_HIT = 15, BOSS_WIN = 150, STEP_PTS = 10
const COMBO_GAP = 15 * 60e3                       // дела «подряд» — если между отметками не больше 15 минут
const multOf = n => n >= 5 ? 2 : n >= 3 ? 1.5 : 1   // 3-е дело подряд — ×1,5, с 5-го — ×2
const FAM_RE = /мам|пап|родител|бабуш|дедуш/i
const ml = n => String(n).replace(".", window.L && L.en ? "." : ",")
let G = null, loadAt = Date.now()
const off = () => !G || G.off()
const ico = (n, s, w) => G.svgI(n, s, w)
const goalsK = k => live(D.goals).filter(g => g && g.kind === k)

// ───────────── Задания дня ─────────────
// Изи утром смотрит на прошлую неделю и выбирает три маленьких задания под слабые места. Каждое +15, все три — ещё +30.
// Часть отмечается сама (вода до 12:00, дело, привычка, шаги…), часть — кнопкой «Сделал» (звонок маме).
const QK = {
  water: { ic: "drop", auto: (q, d) => live(D.water).filter(w => sameDay(w.date, d) && new Date(w.date).getHours() < q.until).reduce((s, w) => s + (w.ml || 0), 0) >= q.n },
  steps: { ic: "walk", auto: (q, d) => (dayHealth(d).steps || 0) >= q.n },
  hang: { ic: "check", auto: (q, d) => { const r = D.rems.find(x => x.id === q.ref); return !!(r && r.done && r.doneAt && sameDay(r.doneAt, d)) } },
  fam: { ic: "phone", auto: (q, d) => live(D.rems).some(r => r.done && r.doneAt && sameDay(r.doneAt, d) && FAM_RE.test(r.title || "")) },
  habit: { ic: "flame", auto: (q, d) => !!G.hOn({ id: q.ref }, d) },
  note: { ic: "moon", auto: (q, d) => goalsK("daynote").some(x => x.day === dayKey(d)) },
  money: { ic: "wallet", auto: (q, d) => !live(D.money).some(e => e.type === "expense" && e.category === "Другое" && e.date >= +addDays(d, -6) && e.date < +addDays(d, 1)) },
  sport: { ic: "dumbbell", auto: (q, d) => live(D.workouts).some(w => sameDay(w.date, d)) },
  top: { ic: "star", auto: (q, d) => { let ids = []; try { ids = top3Ids(dayKey(d)) } catch (e) {} return live(D.rems).some(r => ids.includes(r.id) && r.done && r.doneAt && sameDay(r.doneAt, d) && new Date(r.doneAt).getHours() < q.until) } },
  focus: { ic: "timer", auto: (q, d) => live(D.pomo).some(p => p.full && p.start && sameDay(p.start, d)) },
  // знакомство: первые три дня новичок пробует главное (вместо «Позвонить маме» на пустых данных)
  n_money: { ic: "wallet", auto: (q, d) => live(D.money).some(e => e.type === "expense" && sameDay(e.date, d)) },
  n_rem: { ic: "check", auto: (q, d) => live(D.rems).some(r => r.date && sameDay(r.date, d)) },
  n_ask: { ic: "sparkle", auto: (q, d) => (D.chat || []).some(m => m.role === "user" && m.at && sameDay(m.at, d)) },
  n_water: { ic: "drop", auto: (q, d) => live(D.water).some(w => sameDay(w.date, d)) },
  n_habit: { ic: "flame", auto: (q, d) => live(D.habits).some(h => h.title && h.date && sameDay(h.date, d)) },
  n_goal: { ic: "star", auto: (q, d) => live(D.goals).some(g => g.kind === "month" && g.date && sameDay(g.date, d)) },
}
// Новичок — первые три дня с начала пользования. Начало = самая ранняя запись (у старых пользователей она давно),
// без записей — сегодня. Запоминаем один раз.
const NEWBIE = [
  ["n_money", "Запишите расход голосом", "скажите Изи «кофе 120»", () => live(D.money).some(e => e.type === "expense")],
  ["n_rem", "Поставьте напоминание", "«напомни завтра в 9 позвонить в банк»", () => live(D.rems).length > 0],
  ["n_ask", "Спросите Изи про неделю", "«что у меня на этой неделе?»", () => (D.chat || []).some(m => m.role === "user")],
  ["n_water", "Отметьте стакан воды", "кнопка «+» вверху или скажите «выпил стакан»", () => live(D.water).length > 0],
  ["n_habit", "Заведите одну привычку", "зарядка, чтение — посчитаю серию", () => live(D.habits).some(h => h.title)],
  ["n_goal", "Поставьте цель на месяц", "«цель на месяц: прочитать книгу»", () => live(D.goals).some(g => g.kind === "month")],
]
function newbieDays(now = new Date()) {
  if (!D.firstAt) {
    const ds = [].concat(live(D.money), live(D.rems), live(D.goals), live(D.water), live(D.habits)).map(x => +x.date || 0).filter(x => x > 1e12)
      .concat((D.chat || []).map(m => +m.at || 0).filter(x => x > 1e12))
    D.firstAt = Math.min(Date.now(), ...ds); setTimeout(() => save(false), 0)
  }
  return Math.floor((sod(now) - sod(new Date(D.firstAt))) / 864e5)
}
function newbieQuests(now) {
  if (newbieDays(now) > 2) return null
  const l = NEWBIE.filter(x => !x[3]()).slice(0, 3).map(([k, t, s2]) => ({ k, t, s: s2 }))
  return l.length >= 2 ? l : null
}
const qDone = (q, d) => !!q.done || (QK[q.k] && QK[q.k].auto ? !!QK[q.k].auto(q, d) : false)
const questsOf = k => goalsK("quests").filter(x => x.day === k).sort((a, b) => a.date - b.date)[0] || null
function pickQuests(now = new Date()) {
  const nb = newbieQuests(now); if (nb) return nb
  const st = G.stats(), t0 = sod(now), past = st.days.filter(x => x.d < t0).slice(-7), n = past.length || 1, hr = now.getHours()
  const recent = new Set(); for (let i = 1; i <= 2; i++) { const q = questsOf(dayKey(addDays(t0, -i))); if (q) q.list.forEach(x => recent.add(x.k)) }
  const c = [], hg = H()
  const push = (score, q) => c.push(Object.assign({ score: score * (recent.has(q.k) ? .55 : 1) }, q))
  // вода: сколько дней недели без нормы
  const noW = past.filter(x => !x.items.some(i => i.id.startsWith("w:"))).length
  const until = hr < 10 ? 12 : Math.min(22, hr + 4)
  push(noW / n + .05, { k: "water", n: 1000, until, t: `Выпить литр воды до ${until}:00`, s: noW ? `вода — ${noW} ${plural(noW, "день", "дня", "дней")} из ${n} без нормы` : "чтобы день начался бодро" })
  // висящее дело: самое старое просроченное или давно без срока
  const hang = live(D.rems).filter(r => !r.done && r.title && ((r.due && parseIso(r.due) && parseIso(r.due) < t0) || (!r.due && r.date < +addDays(t0, -5))))
    .map(r => ({ r, age: Math.round((t0 - sod(r.due ? parseIso(r.due) : r.date)) / 864e5) })).sort((a, b) => b.age - a.age)[0]
  if (hang) push(.6 + Math.min(.35, hang.age / 30), { k: "hang", ref: hang.r.id, t: `Закрыть «${hang.r.title.slice(0, 40)}»`, s: `висит ${hang.age} ${plural(hang.age, "день", "дня", "дней")}` })
  // семья: за 10 дней ни одного дела для родителей
  const famDone = live(D.rems).some(r => r.done && r.doneAt > +addDays(t0, -10) && FAM_RE.test(r.title || ""))
  if (!famDone) push(.55, { k: "fam", t: "Позвонить маме", s: "давно не было дел для родителей", manual: 1 })
  // шаги: если часы присылают шаги и норма часто не набирается
  const sd = past.filter(x => dayHealth(x.d).steps != null), noS = sd.filter(x => !x.items.some(i => i.id.startsWith("s:"))).length
  if (sd.length >= 3 && noS) { const s = Math.round(Math.min(hg.stepGoal || 10000, 8000) / 500) * 500; push(noS / sd.length * .8, { k: "steps", n: s, t: `Пройти ${num(s)} шагов`, s: `шаги — ${noS} ${plural(noS, "день", "дня", "дней")} без нормы` }) }
  // привычка, у которой рвётся серия
  const hs = live(D.habits).filter(h => h.title && !h.bad && !h.archived)
  const br = hs.find(h => !G.hOn(h, addDays(t0, -1)) && G.hOn(h, addDays(t0, -2)) && !G.hOn(h, t0))
  if (br) push(.7, { k: "habit", ref: br.id, t: `Вернуть «${br.title}»`, s: "вчера серия прервалась — сегодня можно начать снова" })
  // итоги дня
  const notes = past.filter(x => x.items.some(i => i.kind === "day")).length
  if (past.length >= 3 && notes < Math.ceil(n / 2)) push(.45, { k: "note", t: "Подвести итоги дня вечером", s: `итоги — ${notes} из ${n} дней` })
  // траты «Другое»
  const other = live(D.money).filter(e => e.type === "expense" && e.category === "Другое" && e.date >= +addDays(t0, -7)).length
  if (other) push(.5, { k: "money", t: "Разнести траты по категориям", s: `${other} ${plural(other, "трата", "траты", "трат")} в «Другом»` })
  // тренировка
  if (!live(D.workouts).some(w => w.date >= +addDays(t0, -7))) push(.35, { k: "sport", t: "Тренировка или прогулка 20 минут", s: "за неделю не было тренировок" })
  // главное дело с утра
  if (hr < 11) push(.3, { k: "top", until: 13, t: "Главное дело до 13:00", s: "самое важное — пока свежая голова" })
  push(.2, { k: "focus", t: "Один фокус 25 минут", s: "помидор без отвлечений" })
  return c.sort((a, b) => b.score - a.score).slice(0, 3).map(({ score, ...q }) => q)
}
function questsToday() {
  const k = dayKey(new Date())
  let q = questsOf(k)
  // подбираем, когда данные свежие: после обмена с таблицей сегодня (иначе на пустых данных задания выйдут мимо)
  const fresh = !D.conn || !D.conn.hook || (D.sync && D.sync.at >= +sod(new Date())) || Date.now() - loadAt > 12000
  if (!q && fresh && !off() && D.who !== "kid") { q = upsert("goals", { id: uid("q"), date: Date.now(), kind: "quests", day: k, list: pickQuests() }); setTimeout(() => save(false), 0) }
  return q
}
function questTap(i) {
  const q = questsOf(dayKey(new Date())); if (!q) return
  const x = q.list[i]; if (!x) return
  if (qDone(x, new Date()) && !x.done) return toast("Засчитано само — по вашим данным")
  if (!x.done && !x.manual) {
    // авто-задание можно закрыть и вручную, если данные пришли не сюда (например, звонок с другого телефона)
    if (x.k === "habit" && typeof habitToggle === "function") { const h = D.habits.find(z => z.id === x.ref && !z.deleted); if (h) { habitToggle(h, new Date()); render(); return } }
    if (x.k === "hang") { const r = D.rems.find(z => z.id === x.ref); if (r && !r.done) { remSet(r.id, { completed: true }); render(); return } }
  }
  const list = q.list.map((y, j) => j === i ? Object.assign({}, y, { done: y.done ? 0 : Date.now() }) : y)
  upsert("goals", Object.assign({}, q, { list })); save(); render()
}
function questsHTML(st, full) {
  const q = questsToday(); if (!q || !q.list.length) return ""
  const now = new Date(), done = q.list.filter(x => qDone(x, now)).length, all = done === q.list.length
  return `<div class="card gq ${all ? "all" : ""}"><h2>Задания дня от ${esc(typeof iziName === "function" ? iziName() : "Изи")}<span class="gqn">${done} из ${q.list.length}</span></h2>
    ${q.list.map((x, i) => { const ok = qDone(x, now)
      return `<div class="row gqr ${ok ? "ok" : ""}"><button class="check ${ok ? "on" : ""}" data-qtap="${i}" aria-label="Отметить"></button><span class="gic quest">${ico((QK[x.k] || {}).ic || "sparkle", 17)}</span>
        <div class="grow"><div class="t ${ok ? "struck" : ""}">${esc(x.t)}</div><div class="s">${esc(x.s || "")}</div></div><span class="gp">+${Q_PTS}</span></div>` }).join("")}
    <div class="gqall"><span>${all ? `${ico("sparkle", 15)} Все три — бонус +${Q_ALL}` : `Все три — ещё +${Q_ALL} бонусом`}</span>${full ? "" : `<button class="linkbtn" data-qgo="quest">Все задания ›</button>`}</div></div>`
}

// ───────────── Комбо ─────────────
// Дела, отмеченные одно за другим (между отметками ≤ 15 минут), идут цепочкой: 3-е — ×1,5, с 5-го — ×2.
const isTask = i => (i.kind === "task" || i.kind === "top") && i.at
function comboPost(items, d) {
  const l = items.filter(isTask).sort((a, b) => a.at - b.at)
  let n = 0, last = 0
  for (const i of l) { n = last && i.at - last <= COMBO_GAP ? n + 1 : 1; last = i.at; const m = multOf(n); i.combo = n; if (m > 1) { i.mult = m; i.p = Math.round(i.p * m) } }
}
function comboNow() {
  const l = G.stats().today.items.filter(isTask).sort((a, b) => a.at - b.at), lastI = l[l.length - 1]
  if (!lastI) return null
  const left = COMBO_GAP - (Date.now() - lastI.at)
  return left > 0 && lastI.combo >= 1 ? { n: lastI.combo, left, next: multOf(lastI.combo + 1), m: multOf(lastI.combo) } : null
}
let comboT = 0
function comboUI(v) {
  let el = document.getElementById("gcombo")
  const c = !off() && (tab === "today" || tab === "plans") && !stack.length ? comboNow() : null
  if (!c || c.n < 2) { if (el && el.classList.contains("show")) { el.classList.remove("show"); if (!v && tab === "today" && !stack.length) render() } return }
  if (!el) { el = document.createElement("div"); el.id = "gcombo"; document.body.appendChild(el) }
  const mm = Math.floor(c.left / 60e3), ss = Math.floor(c.left % 60e3 / 1000)
  el.innerHTML = `<b>${ico("bolt", 15, 2.4)}Комбо ${c.n}</b><span>${c.next > 1 ? `следующее ×${ml(c.next)}` : "дальше"} · ${mm}:${String(ss).padStart(2, "0")}</span><i style="width:${Math.round(c.left / COMBO_GAP * 100)}%"></i>`
  el.classList.add("show")
  // счётчик у галочек: сколько даст следующее дело в цепочке
  if (v && c.next > 1) $$(".gp", v).forEach(b => { const row = b.closest(".row, .tl-it"); if (!row || !row.querySelector("[data-check]") || b.dataset.cx) return
    const base = +(b.textContent.match(/\d+/) || [0])[0]; if (!base) return
    b.dataset.cx = 1; b.classList.add("gcx"); b.innerHTML = `+${Math.round(base * c.next)}<small>×${ml(c.next)}</small>` })
  clearTimeout(comboT); comboT = setTimeout(() => comboUI(null), 1000)
}

// ───────────── Боссы ─────────────
// Большое неприятное дело — босс с полоской здоровья. Шаг — удар (+15), победа — +150 сверх потолка и праздник.
const BOSS_SVG = '<path d="M5 3.5l2.6 4.2M19 3.5l-2.6 4.2"/><path d="M6 10a6 6 0 0 1 12 0v3.5a6 6 0 0 1-12 0z"/><path d="M8.5 10.8l2 1.1M15.5 10.8l-2 1.1M10 16.2h4"/>'
const bosses = () => goalsK("boss").filter(b => b.title)
const bSteps = b => (b.steps || []).filter(x => x && x.t && !x.deleted)
const bHp = b => { const l = bSteps(b), left = l.filter(x => !x.done).length; return { all: l.length, left, p: l.length ? left / l.length : 1 } }
function bossFace(s = 56, won) {
  return `<span class="gboss-f ${won ? "won" : ""}" style="width:${s}px;height:${s}px"><svg width="${Math.round(s * .62)}" height="${Math.round(s * .62)}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${won ? G.P.crown : BOSS_SVG}</svg></span>`
}
function hpBar(b, big) {
  const h = bHp(b)
  return `<div class="ghp ${big ? "big" : ""}">${bSteps(b).map(x => `<i class="${x.done ? "hit" : ""}"></i>`).join("") || "<i></i>"}</div>
    <div class="ghp-s"><span>${h.all ? `здоровье ${h.left} из ${h.all}` : "нужны шаги — каждый станет ударом"}</span>${b.won ? "<b>побеждён</b>" : ""}</div>`
}
function bossCard(b) {
  const nx = bSteps(b).find(x => !x.done)
  return `<div class="gboss" data-qboss="${esc(b.id)}">${bossFace(48, b.won)}<div class="grow"><div class="k">Босс</div><div class="t">${esc(b.title)}</div>${hpBar(b)}
    ${nx && !b.won ? `<div class="gboss-n"><span>${esc(nx.t)}</span><button class="btn small primary" data-qhit="${esc(b.id)}|${esc(nx.id)}">${ico("bolt", 14, 2.4)} Удар</button></div>` : ""}</div></div>`
}
function bossTodayHTML() {
  const b = bosses().filter(x => !x.won).sort((a, b) => bHp(a).p - bHp(b).p)[0]
  return b ? bossCard(b) : ""
}
function bossHit(id, sid, fromTool) {
  const b = D.goals.find(x => x.id === id && x.kind === "boss"); if (!b || b.won) return null
  const steps = bSteps(b).map(x => x.id === sid && !x.done ? Object.assign({}, x, { done: true, at: Date.now() }) : x)
  const win = steps.length && steps.every(x => x.done)
  const out = upsert("goals", Object.assign({}, b, { steps }, win ? { won: Date.now() } : {})); save()
  if (win) { if (!fromTool) setTimeout(() => bossWin(out), 250) }
  else if (!fromTool) { const el = document.querySelector(`[data-qboss="${CSS.escape(id)}"] .gboss-f`); if (el) { el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit") } if (navigator.vibrate) navigator.vibrate([10, 30, 20]) }
  return out
}
function bossWin(b) {
  while (stack.length) stack[stack.length - 1].close()
  render()
  G.celeSheet(`<div class="k">Босс повержен</div><div class="emb">${bossFace(150, true)}</div><h1>${esc(b.title)}</h1><p>${bSteps(b).length} ${plural(bSteps(b).length, "удар", "удара", "ударов")} · +${BOSS_WIN} баллов бонусом</p>
    <div class="gift"><b>${ico("trophy", 17)} Приз</b>Самое неприятное позади. Можно взять награду из «Моего пути».</div>`)
}
function bossSheet(id) {
  const b = D.goals.find(x => x.id === id); if (!b) return
  const s = sheet(`<div class="gboss-h">${bossFace(76, b.won)}<div class="grow"><div class="k">Босс</div><h3>${esc(b.title)}</h3></div></div>${hpBar(b, true)}
    <div class="gbsteps">${bSteps(b).map(x => `<div class="row"><div class="grow"><div class="t ${x.done ? "struck" : ""}">${esc(x.t)}</div>${x.done && x.at ? `<div class="s">удар ${esc(shortDate(new Date(x.at)))} · +${BOSS_HIT}</div>` : ""}</div>${x.done ? `<span class="gok">${ico("check", 14, 2.6)}</span>` : b.won ? "" : `<button class="btn small primary" data-hit="${esc(x.id)}">${ico("bolt", 14, 2.4)} Удар</button>`}</div>`).join("")
      || `<div class="empty">Разбейте босса на маленькие шаги — каждый шаг будет ударом.</div>`}</div>
    ${b.won ? "" : `<div class="field"><label>Новый шаг</label><input id="gb-s" placeholder="Например: найти все чеки за год"></div>`}
    <div class="btns">${b.won ? "" : `<button class="btn" data-a="izi">${esc(typeof iziName === "function" ? iziName() : "Изи")} разобьёт</button>`}<button class="btn red" data-a="del">Удалить</button>${b.won ? "" : '<button class="btn primary" data-a="add">Добавить шаг</button>'}</div>`, { onClose: () => render() })
  $$("[data-hit]", s.el).forEach(x => x.onclick = () => { const out = bossHit(id, x.dataset.hit); if (out && !out.won) { s.close(); bossSheet(id) } })
  const add = $('[data-a="add"]', s.el); if (add) add.onclick = () => { const t = $("#gb-s", s.el).value.trim(); if (!t) return; bossSteps(id, [t]); s.close(); bossSheet(id) }
  const iz = $('[data-a="izi"]', s.el); if (iz) iz.onclick = () => { s.close(); bossAsk(b.title) }
  $('[data-a="del"]', s.el).onclick = async () => { const a = await ui.confirm("Удалить босса?", `<div class="msg">«${esc(b.title)}» и его шаги исчезнут. Баллы за прошлые удары тоже.</div>`, ["Отмена", "Удалить"]); if (a !== "Удалить") return; remove("goals", id); save(); s.close() }
}
function bossSteps(id, add) {
  const b = D.goals.find(x => x.id === id); if (!b) return null
  const l = bSteps(b).slice(); for (const t0 of add) { const t = String(t0 || "").trim(); if (t && !l.some(x => normT(x.t) === normT(t))) l.push({ id: uid("bs"), t: t.charAt(0).toUpperCase() + t.slice(1, 80), done: false }) }
  return upsert("goals", Object.assign({}, b, { steps: l, won: 0 }))
}
function bossNew(title, steps = []) {
  const t = String(title || "").trim(); if (!t) return null
  const old = bosses().find(b => !b.won && normT(b.title) === normT(t))
  const b = old || upsert("goals", { id: uid("b"), date: Date.now(), kind: "boss", title: t.charAt(0).toUpperCase() + t.slice(1, 60), steps: [] })
  return steps.length ? bossSteps(b.id, steps) : b
}
const bossAsk = t => { setTab("chat"); setTimeout(() => chatSend(`Помоги победить босса «${t}» — большое неприятное дело. Разбей его на 4–7 маленьких конкретных шагов (каждый — на 15–60 минут) и запиши через boss_make. Коротко скажи, с какого шага начать сегодня.`), 60) }
const BOSS_IDEAS = ["Налоговая декларация", "Разобрать балкон", "Запись к стоматологу", "Разобрать почту"]
function bossForm() {
  const hang = live(D.rems).filter(r => !r.done && r.title && r.date < +addDays(new Date(), -3)).sort((a, b) => a.date - b.date).slice(0, 4).map(r => r.title)
  const ideas = [...new Set(hang.concat(BOSS_IDEAS))].slice(0, 6)
  const s = sheet(`<div class="gboss-h">${bossFace(64)}<div class="grow"><h3>Новый босс</h3><div class="muted small">Большое неприятное дело, которое давно висит. Разбейте на шаги — и бейте по одному.</div></div></div>
    <div class="field"><label>Что за дело</label><input id="gb-t" placeholder="Например: налоги за год"></div>
    <div class="chips">${ideas.map(x => `<button class="chip" data-idea="${esc(x)}">${esc(x)}</button>`).join("")}</div>
    <div class="field" style="margin-top:12px"><label>Шаги — каждый с новой строки</label><textarea id="gb-l" rows="4" placeholder="Собрать справки&#10;Заполнить декларацию&#10;Отправить"></textarea></div>
    <div class="btns"><button class="btn" data-a="izi">${esc(typeof iziName === "function" ? iziName() : "Изи")} разобьёт на шаги</button><button class="btn primary" data-a="ok">Создать</button></div>`)
  $$("[data-idea]", s.el).forEach(b => b.onclick = () => { $("#gb-t", s.el).value = b.dataset.idea })
  setTimeout(() => $("#gb-t", s.el).focus(), 250)
  $('[data-a="izi"]', s.el).onclick = () => { const t = $("#gb-t", s.el).value.trim(); if (!t) return toast("Напишите, что за дело"); bossNew(t); save(); s.close(); bossAsk(t) }
  $('[data-a="ok"]', s.el).onclick = () => { const t = $("#gb-t", s.el).value.trim(); if (!t) return toast("Напишите, что за дело")
    const b = bossNew(t, $("#gb-l", s.el).value.split("\n")); save(); s.close(); render(); bossSheet(b.id) }
}

// ───────────── Карта пути к цели ─────────────
// Цель с шагами — дорога с вехами снизу вверх. Видны пройденные шаги и следующий; дальше — туман. Каждый шаг открывает новый кусок.
const mapGoals = () => live(D.goals).filter(g => ["month", "wish", "dream"].includes(g.kind) && g.title && stepsOf(g).length >= 2 && (g.kind !== "month" || g.month === curMonth()))
function mapSVG(g, anim) {
  const l = stepsOf(g), n = l.length, done = l.filter(x => x.done).length, open = Math.min(n, done + 1)
  const W = 320, step = 78, H = step * (n + 1) + 40, X = i => i % 2 ? W * .7 : W * .3, Y = i => H - 30 - i * step
  // точки дороги: 0 — старт, 1..n — шаги, n+1 — цель
  const pts = [[W / 2, H - 10]].concat(l.map((_, i) => [X(i), Y(i + 1) + step / 2 - 12])).concat([[W / 2, 34]])
  const seg = (a, b) => `C${a[0]},${(a[1] + b[1]) / 2} ${b[0]},${(a[1] + b[1]) / 2} ${b[0]},${b[1]}`
  let lit = `M${pts[0][0]},${pts[0][1]}`, fog = `M${pts[open][0]},${pts[open][1]}`, full = lit
  for (let i = 1; i < pts.length; i++) full += " " + seg(pts[i - 1], pts[i])
  for (let i = 1; i <= open; i++) lit += " " + seg(pts[i - 1], pts[i])
  for (let i = open + 1; i < pts.length; i++) fog += " " + seg(pts[i - 1], pts[i])
  const gid = "gm" + Math.random().toString(36).slice(2, 7)
  const node = (x, i) => {
    const [cx, cy] = pts[i + 1], st = x.done ? "done" : i === done ? "next" : "fog", right = cx > W / 2
    const label = st === "fog" ? "" : `<foreignObject x="${right ? 8 : cx + 26}" y="${cy - 22}" width="${right ? cx - 34 : W - cx - 34}" height="48"><div class="gml ${right ? "r" : ""} ${st}">${esc(x.t)}${x.date ? `<small>${esc(stepWhen(x))}</small>` : ""}</div></foreignObject>`
    return `<g class="gmn ${st} ${anim && i === done - 1 ? "new" : ""}" transform="translate(${cx} ${cy})"><circle r="${st === "next" ? 17 : 14}"/>${st === "done" ? `<path d="M-6 0.5l4 4 8-9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` : st === "next" ? `<text y="5" text-anchor="middle">${i + 1}</text>` : `<g transform="translate(-7 -8) scale(.6)" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">${G.P.lock}</g>`}</g>${label}`
  }
  const win = done === n
  return `<svg class="gmap ${anim ? "anim" : ""}" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px"><defs><linearGradient id="${gid}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:var(--g-a)"/><stop offset="1" style="stop-color:var(--g-b)"/></linearGradient>
    <linearGradient id="${gid}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--card);stop-opacity:.97"/><stop offset=".75" style="stop-color:var(--card);stop-opacity:.85"/><stop offset="1" style="stop-color:var(--card);stop-opacity:0"/></linearGradient></defs>
    <path class="road-bg" d="${full}"/>
    ${open < n ? `<path class="road-fog" d="${fog}"/>` : ""}<path class="road" d="${lit}" stroke="url(#${gid})"/>
    <g class="gmn start" transform="translate(${pts[0][0]} ${pts[0][1]})"><circle r="7"/></g>
    ${l.map(node).join("")}
    <g class="gmn goal ${win ? "win" : "dim"}" transform="translate(${W / 2} 34)"><circle r="24"/><g transform="translate(-11 -11) scale(.92)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${win ? G.P.trophy : '<path d="M6 21V4M6 4h11l-2.5 3.5L17 11H6"/>'}</g></g>
    <foreignObject x="${W / 2 + 30}" y="14" width="${W / 2 - 34}" height="44"><div class="gml goal ${win ? "" : "dim"}">${win ? "Цель достигнута" : esc(g.title)}</div></foreignObject></svg>`
}
function mapHTML(g) {
  const l = stepsOf(g), done = l.filter(x => x.done).length, seen = (D.gamiMap || {})[g.id] || 0, anim = done > seen
  if (anim) { D.gamiMap = Object.assign({}, D.gamiMap, { [g.id]: done }); setTimeout(() => save(false), 0) }
  return `<div class="gmapw">${mapSVG(g, anim)}<div class="muted small" style="text-align:center">${done === l.length ? "Все вехи пройдены" : `Пройдено ${done} из ${l.length} · каждый шаг открывает следующий кусок карты`}</div></div>`
}
function mapSheet(id) {
  const g = D.goals.find(x => x.id === id); if (!g) return
  const s = sheet(`<h3>${esc(g.title)}</h3><div class="muted small">Карта пути · шаг +${STEP_PTS} баллов</div>${mapHTML(g)}<div class="btns"><button class="btn primary wide" data-a="steps">Шаги</button></div>`)
  s.el.classList.add("gmap-sheet")
  $('[data-a="steps"]', s.el).onclick = () => { s.close(); stepsForm(id) }
}

// ───────────── Шар Изи растёт с рангом ─────────────
// С каждым рангом волны в шаре светятся ярче, а их оттенок понемногу светлеет к жемчужному. Цвет, выбранный в настройках, не меняется.
let orbCur = 1
const orbLv = c => +(c && c.dataset.lv) || orbCur
const mix = (a, b, t) => a.split(",").map((v, i) => Math.round(+v + (+b.split(",")[i] - v) * t)).join(",")
function orbGlow(c, d) {
  const lv = orbLv(c); if (lv <= 1) return
  const k = (lv - 1) / 9, P = iziCol(), x = c.getContext("2d"), W = c.width, H = c.height, R = W * .41
  const tint = mix(mix(P[3], P[4], k), "255,246,220", Math.max(0, k - .5))
  x.save(); x.globalCompositeOperation = "lighter"
  const g = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R)
  g.addColorStop(0, `rgba(${tint},${(.12 + .38 * k).toFixed(3)})`); g.addColorStop(.6, `rgba(${tint},${(.05 + .17 * k).toFixed(3)})`); g.addColorStop(1, `rgba(${tint},0)`)
  x.fillStyle = g; x.fillRect(0, 0, W, H); x.restore()
  // яркость — прямо в рисунке, без CSS-фильтра: фильтр на живом холсте пересчитывался каждый кадр и волна дёргалась
}
function orbPathHTML(st) {
  if (typeof silkCanvas !== "function") return ""
  const lv = st.lv, cells = [[1, G.RANKS[0][0]], [lv, "Сейчас"], [Math.min(10, Math.max(lv + 1, 5)), G.RANKS[Math.min(10, Math.max(lv + 1, 5)) - 1][0]], [10, G.RANKS[9][0]]]
    .filter((x, i, a) => a.findIndex(y => y[0] === x[0]) === i)
  return `<div class="card"><h2>Шар ${esc(typeof iziName === "function" ? iziName() : "Изи")} растёт с вами</h2><div class="gorbs">${cells.map(([l, t]) => `<div class="${l === lv ? "on" : ""}"><b class="gorb" data-olv="${l}"></b><span>${esc(t)}</span></div>`).join("")}</div>
    <div class="muted small">С каждым рангом волны в шаре на кнопке светятся ярче и светлеют. Прогресс виден без цифр.</div></div>`
}
function orbBind(v) { $$(".gorb[data-olv]", v).forEach(o => { if (o.firstChild) return; const c = document.createElement("canvas"); c.dataset.lv = o.dataset.olv; o.append(c); silkCanvas(c, "orb") }) }

// ───────────── Раздел «Квесты» в «Моём пути» ─────────────
function questPage(st) {
  let html = questsHTML(st, true)
  const bs = bosses().sort((a, b) => (a.won ? 1 : 0) - (b.won ? 1 : 0) || b.date - a.date)
  html += `<div class="card"><h2>Боссы<button class="act" data-qgo="boss-new">+ Босс</button></h2>${bs.filter(b => !b.won).map(bossCard).join("") || `<div class="muted small">Большое неприятное дело — налоги, разбор балкона — станет боссом. Каждый шаг — удар (+${BOSS_HIT}), победа — +${BOSS_WIN}.</div>`}
    ${bs.some(b => b.won) ? `<div class="gwon">${bs.filter(b => b.won).slice(0, 6).map(b => `<button data-qboss="${esc(b.id)}">${bossFace(34, true)}<span>${esc(b.title)}</span></button>`).join("")}</div>` : ""}</div>`
  const gs = mapGoals()
  html += `<div class="card"><h2>Карта пути к цели</h2>${gs.length ? gs.map(g => { const l = stepsOf(g), d = l.filter(x => x.done).length
    return `<button class="row list-row" data-qmap="${esc(g.id)}"><span class="gic goal">${ico("target", 18)}</span><div class="grow"><div class="t">${esc(g.title)}</div><div class="s">вех ${d} из ${l.length}</div><div class="gbar"><i style="width:${Math.round(d / l.length * 100)}%"></i></div></div><span class="chev">${ICO.chev}</span></button>` }).join("")
    : `<div class="muted small">Разбейте цель или мечту на шаги — и она станет дорогой с вехами.</div>`}</div>`
  html += `<div class="card"><h2>Комбо</h2><div class="muted small">Дела одно за другим, с перерывом не больше 15 минут: третье подряд — баллы ×1,5, с пятого — ×2. Счётчик виден у галочек и внизу экрана.</div></div>`
  return html
}

// ───────────── Изи: инструменты ─────────────
const TOOLS = [
  { name: "boss_make", description: "Сделать большое неприятное дело боссом с шагами-ударами (игра IZIDAY) или добавить шаги к боссу. Шаги — маленькие и конкретные, 4–7 штук.",
    input_schema: { type: "object", properties: { title: { type: "string" }, steps: { type: "array", items: { type: "string" } } }, required: ["title"] } },
  { name: "boss_hit", description: "Отметить шаг босса сделанным (удар). boss — название, step — текст шага.", input_schema: { type: "object", properties: { boss: { type: "string" }, step: { type: "string" } }, required: ["boss", "step"] } },
]
function wrapIzi() {
  TOOLS.forEach(t => { G.TOOLS.push(t); if (!AGENT_TOOLS.some(x => x.name === t.name)) AGENT_TOOLS.push(t) })
  try { Object.assign(TOOL_STATUS, { boss_make: "готовлю босса", boss_hit: "наношу удар" }) } catch (e) {}
  const run0 = runTool
  runTool = async function (name, x) {
    if (name !== "boss_make" && name !== "boss_hit") return run0.apply(this, arguments)
    if (off()) return { error: "Режим игры выключен пользователем. Включить: Настройки → Режим игры." }
    if (name === "boss_make") { const b = bossNew(x.title, x.steps || []); if (!b) return { error: "нужен title" }; save(); return { ok: true, boss: b.title, steps: bSteps(b).map(s => s.t), hp: bHp(b) } }
    const n = normT(x.boss || ""), b = bosses().find(z => !z.won && (normT(z.title) === n || normT(z.title).includes(n) || n.includes(normT(z.title))))
    if (!b) return { error: "нет такого босса", bosses: bosses().filter(z => !z.won).map(z => z.title) }
    const sn = normT(x.step || ""), st = bSteps(b).find(z => !z.done && (normT(z.t) === sn || normT(z.t).includes(sn) || sn.includes(normT(z.t))))
    if (!st) return { error: "нет такого шага", steps: bSteps(b).filter(z => !z.done).map(z => z.t) }
    const out = bossHit(b.id, st.id, true); if (out && out.won) setTimeout(() => bossWin(out), 1500)
    return { ok: true, boss: b.title, hp: bHp(out), won: !!out.won, points: out.won ? BOSS_HIT + BOSS_WIN : BOSS_HIT }
  }
  const sys0 = agentSystem
  agentSystem = function () {
    const s = sys0.apply(this, arguments)
    return off() ? s : s + `
- Игра+: каждое утро у пользователя три «задания дня» под слабые места недели (+${Q_PTS} каждое, все три — ещё +${Q_ALL}); в утренней сводке коротко назови их. Комбо: дела подряд с перерывом до 15 минут — третье ×1,5, с пятого ×2. Боссы: большое неприятное дело с шагами-ударами (+${BOSS_HIT} за удар, +${BOSS_WIN} за победу) — создавай через boss_make, когда пользователь жалуется на большое дело, которое откладывает; отмечай шаги через boss_hit.`
  }
}

// ───────────── Подключение к игре ─────────────
function init() {
  G = window.GAMI
  if (!G || !G.GX || typeof render !== "function") return
  const X = G.GX
  // задания дня: пункты в потолке и бонус сверх потолка за все три
  X.items.push((d, k, add) => { const q = questsOf(k); if (!q) return; q.list.forEach(x => { if (qDone(x, d)) add(`q:${x.k}:${k}`, "quest", "Задание дня: " + x.t, Q_PTS, typeof x.done === "number" && x.done > 1 ? x.done : +d) }) })
  X.extra.push((d, k, put) => { const q = questsOf(k); if (q && q.list.length >= 3 && q.list.every(x => qDone(x, d))) put({ id: `qa:${k}`, t: "Все задания дня", p: Q_ALL, ic: "sparkle" }) })
  // боссы: удар — в потолке, победа — сверх
  X.items.push((d, k, add) => { for (const b of bosses()) for (const s of bSteps(b)) if (s.done && s.at && sameDay(s.at, d)) add(`b:${b.id}:${s.id}`, "boss", `Удар по боссу «${b.title}»`, BOSS_HIT, s.at) })
  X.extra.push((d, k, put) => { for (const b of bosses()) if (b.won && sameDay(b.won, d)) put({ id: `bw:${b.id}`, t: `Босс повержен: ${b.title}`, p: BOSS_WIN, ic: "crown" }) })
  // шаги цели (карта пути): +10 за веху
  X.items.push((d, k, add) => { for (const g of live(D.goals)) if (["month", "wish", "dream"].includes(g.kind)) for (const s of stepsOf(g)) if (s.done && s.at && sameDay(s.at, d)) add(`gs:${g.id}:${s.id}`, "goal", `Веха: ${s.t}`, STEP_PTS, s.at) })
  X.post.push(comboPost)
  X.sum.push((out) => { const q = questsOf(dayKey(new Date())), c = comboNow()
    out.daily_quests = q ? q.list.map(x => `${x.t}${qDone(x, new Date()) ? " — сделано" : ""}`) : []
    out.combo = c ? { in_row: c.n, next_multiplier: c.next, minutes_left: Math.ceil(c.left / 60e3) } : null
    out.bosses = bosses().map(b => ({ title: b.title, hp: `${bHp(b).left}/${bHp(b).all}`, won: !!b.won, next_step: (bSteps(b).find(s => !s.done) || {}).t || null })) })
  X.today.push(st => questsHTML(st) + bossTodayHTML())
  X.path.push(orbPathHTML)
  X.segs.push(["quest", "Задания"])
  X.pages.quest = questPage
  G.RULES.push(["sparkle", "quest", "Задание дня", `три в день под слабые места; все три — ещё +${Q_ALL}`, Q_PTS], ["bolt", "top", "Комбо", "дела подряд: третье ×1,5, с пятого ×2", "×2"],
    ["bolt", "boss", "Удар по боссу", `победа над боссом — +${BOSS_WIN} бонусом`, BOSS_HIT], ["target", "goal", "Веха на карте цели", "каждый сделанный шаг цели", STEP_PTS])
  // шаг цели запоминает, когда сделан — для баллов и карты
  const ss0 = stepSet
  stepSet = function (id, sid, patch) { if (patch && patch.done === true && !patch.at) patch = Object.assign({}, patch, { at: Date.now() }); return ss0.call(this, id, sid, patch) }
  // в окне шагов цели — карта пути
  const sf0 = stepsForm
  stepsForm = function (id) {
    const out = sf0.apply(this, arguments)
    try { const g = D.goals.find(x => x.id === id), s = stack[stack.length - 1]
      if (!off() && g && stepsOf(g).length >= 2 && s) { const h = $(".prog", s.el) || $(".sh-head", s.el); if (h) h.insertAdjacentHTML("afterend", `<details class="gmap-d" ${D.gamiMapOpen === 0 ? "" : "open"}><summary>Карта пути</summary>${mapHTML(g)}</details>`)
        const dt = $(".gmap-d", s.el); if (dt) dt.ontoggle = () => { D.gamiMapOpen = dt.open ? 1 : 0; save(false) } } } catch (e) { console.error("quest map", e) }
    return out
  }
  // шар
  const orb0 = silkOrb
  silkOrb = function (c) { orb0.apply(this, arguments); try { orbGlow(c) } catch (e) {} }
  wrapIzi(); G.syncOff()
  const render0 = render
  render = function () {
    const out = render0.apply(this, arguments)
    try { const v = $("#view"); orbCur = off() ? 1 : G.stats().lv; bind(v); comboUI(tab === "today" ? v : null); orbBind(v) } catch (e) { console.error("quest", e) }
    return out
  }
  render()
  window.QUEST = { pick: pickQuests, today: questsToday, done: qDone, tap: questTap, combo: comboNow, bossNew, bossHit, bossSheet, mapSheet, mapSVG, multOf, COMBO_GAP }
}
const QDO = { quest: () => G.openGame("quest"), "boss-new": () => bossForm() }
function bind(v) {
  $$("[data-qtap]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); questTap(+b.dataset.qtap) })
  $$("[data-qgo]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); const f = QDO[b.dataset.qgo]; if (f) f() })
  $$("[data-qhit]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); const [id, sid] = b.dataset.qhit.split("|"); bossHit(id, sid); setTimeout(render, 380) })
  $$("[data-qboss]", v).forEach(b => b.onclick = () => bossSheet(b.dataset.qboss))
  $$("[data-qmap]", v).forEach(b => b.onclick = () => mapSheet(b.dataset.qmap))
}
})()
