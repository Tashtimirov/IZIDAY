// IZIDAY · План недели и колесо баланса (функция по выбору «План недели», включается в Настройках → «Функции»).
// Основа — недельный планировщик партнёра («30 дней роста»): цель недели, задачи четырёх групп (регулярные, разовые,
// обучение, вне плана), у задачи результат, ★ ключевая (до 5), дни Пн–Вс, время, минуты на один раз и факт.
// Отличия для IZIDAY: план не закрывается после понедельника — задача, добавленная позже, считается «вне плана»;
// норму часов (по умолчанию 36) человек задаёт сам; задачи со временем сами встают в Google Календарь; факт
// спрашиваем, когда отмечаете задачу; Изи проверяет формулировки и добавляет задачи голосом.
// Колесо баланса живёт в «Здоровье»: человек сам оценивает 8 сфер (1–10). Сферы = разделы «100 мечт» (+ «Работа и
// бизнес», «Деньги», «Друзья»). «Выровнять колесо»: мечты из слабых сфер стоят первыми, 1–3 берутся целями недели или
// месяца. Ничего не навязываем: только подсказка.
// Хранится в общем списке goals (синхронизируется с таблицей без правки сервера):
//   { kind: "wt" } задача недели: wk (понедельник YYYY-MM-DD), cat reg|irr|edu|unp, title, prod, key, days [0=Пн…6=Вс],
//       tm "HH:MM", pm (минут на один раз), dn { день: минут факта } — отметка по дням, late, wish, ai {ok, note}, ev { день: id события }
//   { id: "wk:<wk>", kind: "wk" } цель недели: title, sentAt
//   { kind: "wg" } цель недели из «100 мечт»: wk, wish, title, sph, done
//   { kind: "wheel" } оценка колеса: v { сфера: 1–10 }
//   { id: "wcfg", kind: "wcfg" } настройки: h — норма часов в неделю
// Подключается после feat.js и до order.js.
(function () {
"use strict"
const CATS = [["reg", "Регулярные", "#34C759"], ["irr", "Разовые", "#FFB800"], ["edu", "Обучение", "#AF52DE"], ["unp", "Вне плана", "#FF453A"]]
const CAT = Object.fromEntries(CATS.map(c => [c[0], c]))
const SPH = [["body", "Здоровье", "#30B37A"], ["fam", "Семья", "#FF6B8B"], ["biz", "Работа и бизнес", "#4C7DFF"], ["money", "Деньги", "#E0A100"],
  ["home", "Дом", "#A27BFF"], ["trip", "Отдых и впечатления", "#FF8A3D"], ["learn", "Развитие", "#22B5C9"], ["friends", "Друзья", "#C25BD6"]]
const SP = Object.fromEntries(SPH.map(s => [s[0], s]))
const SHORT = { body: "Здоровье", fam: "Семья", biz: "Работа", money: "Деньги", home: "Дом", trip: "Отдых", learn: "Развитие", friends: "Друзья" }
const DUR = [5, 10, 15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480]
const DN = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"], DNF = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]
const KEY_MAX = 5, RESERVE_H = 4
const z2 = n => String(n).padStart(2, "0")

const isOn = () => !!(window.FEAT && FEAT.on("plan")) && !kidMode()
function kidMode() { return D.who === "kid" || (D.fam && D.fam.code && D.fam.role === "kid") || document.body.classList.contains("kidm") }

// ───────────── Недели ─────────────
const monday = d => { const x = sod(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x }
const wkOf = d => dayKey(monday(d))
const wkDate = wk => { const [y, m, d] = wk.split("-").map(Number); return new Date(y, m - 1, d) }
const wkShift = (wk, n) => dayKey(addDays(wkDate(wk), 7 * n))
const dayIdx = d => (new Date(d).getDay() + 6) % 7
const curWk = () => wkOf(new Date())
// в воскресенье план составляют на следующую неделю
const planWk = () => new Date().getDay() === 0 ? wkShift(curWk(), 1) : curWk()
function wkLabel(wk) {
  const a = wkDate(wk), b = addDays(a, 6)
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS_GEN[a.getMonth()]}` : `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`
}

// ───────────── Данные ─────────────
const G = () => live(D.goals || [])
const tasks = wk => G().filter(g => g.kind === "wt" && g.wk === wk).sort((a, b) => (a.ord || a.date) - (b.ord || b.date))
const meta = wk => G().find(g => g.id === "wk:" + wk) || null
const wgoals = wk => G().filter(g => g.kind === "wg" && g.wk === wk).sort((a, b) => a.date - b.date)
const cfg = () => Object.assign({ h: 36 }, G().find(g => g.id === "wcfg") || {})
const wheels = () => G().filter(g => g.kind === "wheel" && g.v).sort((a, b) => b.date - a.date)
const wheel = () => wheels()[0] || null
const save1 = (g, patch) => upsert("goals", Object.assign({}, D.goals.find(x => x.id === g.id) || g, patch))
// текст в полях: без плашки «Отменить» на каждую букву
const quiet = fn => window.UNDO && UNDO.quiet ? UNDO.quiet(fn) : fn()
const dnOf = t => t.dn && typeof t.dn === "object" ? t.dn : {}
const daysOf = t => Array.isArray(t.days) ? t.days.filter(d => d >= 0 && d <= 6) : []
const factMin = t => Object.values(dnOf(t)).reduce((s, m) => s + (+m || 0), 0)
const planMin = t => t.cat === "unp" ? 0 : (+t.pm || 0) * Math.max(1, daysOf(t).length)
const isDone = t => { const d = daysOf(t), dn = dnOf(t); return d.length ? d.every(i => dn[i] != null) : Object.keys(dn).length > 0 }
const offPlan = t => t.cat === "unp" || !!t.late
function fmtMin(m) { m = Math.round(+m || 0); if (m < 60) return `${m} мин`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} ч ${r} мин` : `${h} ч` }
const fmtH = m => { const h = Math.round(m / 6) / 10; return (Number.isInteger(h) ? h : String(h).replace(".", ",")) + " ч" }
function daysLabel(d) {
  d = [...d].sort()
  if (d.length === 7) return "каждый день"
  if (d.length === 5 && d.join() === "0,1,2,3,4") return "Пн–Пт"
  return d.map(i => DN[i]).join(", ")
}
function stats(wk) {
  const l = tasks(wk), on = l.filter(t => !offPlan(t))
  const pm = on.reduce((s, t) => s + planMin(t), 0), fm = l.reduce((s, t) => s + factMin(t), 0)
  const done = l.filter(t => (t.title || "").trim() && isDone(t)).length, total = l.filter(t => (t.title || "").trim()).length
  const keys = l.filter(t => t.key).length, unp = l.filter(offPlan), unpMin = unp.reduce((s, t) => s + factMin(t), 0)
  return { pm, fm, done, total, keys, unp: unp.length, unpMin, noProd: on.filter(t => (t.title || "").trim() && !(t.prod || "").trim()), l }
}
function hints(wk, st = stats(wk)) {
  const out = [], H = cfg().h
  if (st.pm > H * 60) out.push(["warn", `В плане ${fmtH(st.pm)} при норме ${H} ч. Оставьте около ${RESERVE_H} ч на незапланированное.`])
  else if (st.pm > (H - RESERVE_H) * 60) out.push(["warn", `В плане ${fmtH(st.pm)} из ${H}. На незапланированное остаётся меньше ${RESERVE_H} ч.`])
  else if (st.pm > 0) out.push(["ok", `В плане ${fmtH(st.pm)} из ${H}. Около ${RESERVE_H} ч остаётся на незапланированное.`])
  if (st.keys > KEY_MAX) out.push(["warn", `Ключевых задач ${st.keys}. Обычно успевают не больше ${KEY_MAX}.`])
  if (st.noProd.length) out.push(["warn", st.noProd.length === 1 ? `У задачи «${st.noProd[0].title}» нет результата. Напишите, что будет на руках, когда она сделана.` : `У ${st.noProd.length} задач нет результата. Напишите, что будет на руках, когда они сделаны.`])
  return out
}

// ───────────── Сферы и мечты ─────────────
function sphOf(w) {
  if (w.sph && SP[w.sph]) return w.sph
  const t = w.title || "", g = typeof wishGroup === "function" ? wishGroup(w) : (w.grp || "other")
  if (/друз|подруг|компани|знаком|общени|встреч[аи] с/i.test(t)) return "friends"
  if (g === "biz") return /деньг|доход|подушк|инвест|накоп|бат\b|доллар|капитал|долг|сбереж|пенси/i.test(t) ? "money" : "biz"
  if (g === "body") return "body"
  if (g === "fam") return "fam"
  if (g === "home") return "home"
  if (g === "trip") return "trip"
  if (g === "learn") return "learn"
  if (/деньг|доход|подушк|инвест|накоп|капитал/i.test(t)) return "money"
  if (/работ|бизнес|клиент|проект|карьер/i.test(t)) return "biz"
  if (/курс|книг|научить|выучить|освоить/i.test(t)) return "learn"
  return g === "buy" ? "home" : "trip"
}
const wishes = () => G().filter(g => g.kind === "wish" && g.title && !g.done)
function weakList(w = wheel()) {
  if (!w) return []
  const vals = SPH.map(s => [s[0], +w.v[s[0]] || 0]).sort((a, b) => a[1] - b[1])
  const avg = vals.reduce((s, x) => s + x[1], 0) / vals.length
  return vals.filter(x => x[1] < avg).slice(0, 3).map(x => x[0])
}
// цели, закрытые после оценки: колесо «растёт»
function grown(w = wheel()) {
  const since = w ? w.date : 0, out = {}
  for (const g of G()) if ((g.kind === "wg" || (g.kind === "month" && g.wish)) && g.done && (g.doneAt || g.u || 0) > since) { const k = g.sph || "trip"; out[k] = (out[k] || 0) + 1 }
  return out
}

// ───────────── Колесо: картинка ─────────────
function wheelSVG(w, size = 270) {
  const cx = size / 2, cy = size / 2, R = size * .37, n = SPH.length
  let g = ""
  for (let r = 2; r <= 10; r += 2) g += `<circle cx="${cx}" cy="${cy}" r="${(R * r / 10).toFixed(1)}" fill="none" stroke="var(--line)" stroke-width="${r === 10 ? 1.2 : .8}" ${r === 10 ? "" : 'stroke-dasharray="2 3"'}/>`
  const weak = new Set(weakList(w))
  SPH.forEach(([k, , col], i) => {
    const v = Math.max(0, Math.min(10, +w.v[k] || 0))
    const a0 = -Math.PI / 2 + i * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n, rr = Math.max(R * v / 10, 2)
    const p = (a, r) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
    g += `<line x1="${cx}" y1="${cy}" x2="${(cx + R * Math.cos(a0)).toFixed(1)}" y2="${(cy + R * Math.sin(a0)).toFixed(1)}" stroke="var(--line)" stroke-width=".8"/>`
    g += `<path d="M${cx} ${cy} L${p(a0 + .03, rr)} A${rr.toFixed(1)} ${rr.toFixed(1)} 0 0 1 ${p(a1 - .03, rr)} Z" fill="${col}" fill-opacity="${weak.has(k) ? .95 : .78}"/>`
    const am = (a0 + a1) / 2, tr = R + 18, x = cx + tr * Math.cos(am), y = cy + tr * Math.sin(am)
    const anc = Math.abs(Math.cos(am)) < .3 ? "middle" : Math.cos(am) > 0 ? "start" : "end"
    g += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anc}" class="${weak.has(k) ? "w" : ""}">${SHORT[k]} ${v}</text>`
  })
  return `<div class="wp-wheel"><svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Колесо баланса">${g}</svg></div>`
}
const pill = (k, v, on, attr = "") => `<button type="button" class="wp-pill ${on ? "on" : ""}" style="--c:${SP[k][2]}" ${attr}><i></i>${SHORT[k]}${v != null ? ` <b>${v}</b>` : ""}</button>`

// ───────────── «Здоровье»: карточка колеса ─────────────
function wheelCard() {
  const w = wheel()
  if (!w) return `<div class="card wp-card" id="wheel"><h2>Колесо баланса</h2>
    <div class="muted small" style="margin:-2px 0 12px">Оцените 8 сфер жизни от 1 до 10: здоровье, семью, работу, деньги, дом, отдых, развитие и друзей. Колесо покажет, где проседает, а ${esc(iziName())} предложит мечты, чтобы его выровнять.</div>
    <button type="button" class="wp-btn" data-wp="rate">Оценить сферы</button></div>`
  const d = new Date(w.date), avg = SPH.reduce((s, x) => s + (+w.v[x[0]] || 0), 0) / SPH.length
  const old = Date.now() - w.date > 30 * 864e5, weak = weakList(w), gr = grown(w), grs = Object.keys(gr)
  return `<div class="card wp-card" id="wheel"><h2>Колесо баланса<button class="act" data-wp="rate">Оценить заново</button></h2>
    <div class="muted small" style="margin:-4px 0 0">Оценка ${d.getDate()} ${MONTHS_GEN[d.getMonth()]} · средняя ${String(Math.round(avg * 10) / 10).replace(".", ",")} из 10</div>
    ${old ? `<div class="wp-hint" style="margin-top:10px">Прошёл месяц с прошлой оценки. Оцените колесо заново, чтобы увидеть, что изменилось.</div>` : ""}
    ${wheelSVG(w)}
    ${weak.length ? `<div class="small muted" style="margin-bottom:6px">Слабее всего сейчас</div><div class="wp-pills">${weak.map(k => pill(k, w.v[k], false, `data-wp-al="${k}"`)).join("")}</div>
    <button type="button" class="wp-btn" data-wp="align">Выровнять колесо</button>` : `<div class="wp-hint ok">Колесо ровное. Так держать.</div>`}
    ${grs.length ? `<div class="wp-note">С ${d.getDate()} ${MONTHS_GEN[d.getMonth()]} закрыто целей: ${grs.map(k => `${SHORT[k]} ${gr[k]}`).join(", ")}.</div>` : ""}
    <div class="wp-note">${esc(iziName())} предложит мечты из слабых сфер. Брать их необязательно. Сфера растёт, когда закрываете цели из неё, а раз в месяц колесо оценивается заново.</div></div>`
}
function rateSheet() {
  const w = wheel(), v = Object.assign({}, w ? w.v : {})
  SPH.forEach(([k]) => { if (!(v[k] >= 1)) v[k] = 5 })
  const s = sheet(`<h3>Колесо баланса</h3><div class="msg">Насколько вы довольны каждой сферой сейчас: 1 — совсем нет, 10 — полностью.</div>
    ${SPH.map(([k, name, col]) => `<div class="wp-rate" style="--c:${col}"><div class="wp-rate-h"><span><i></i>${name}</span><b data-rv="${k}">${v[k]}</b></div>
      <input type="range" min="1" max="10" step="1" value="${v[k]}" data-rk="${k}" aria-label="${name}"></div>`).join("")}
    <div class="btns"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  $$("[data-rk]", s.el).forEach(r => r.oninput = () => { v[r.dataset.rk] = +r.value; $(`[data-rv="${r.dataset.rk}"]`, s.el).textContent = r.value; if (navigator.vibrate) navigator.vibrate(4) })
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => {
    upsert("goals", { id: uid("wh"), kind: "wheel", date: Date.now(), v })
    s.close(); render(); toast("Колесо сохранено")
    if (weakList({ v }).length) setTimeout(() => alignSheet(), 350)
  }
}

// ───────────── «Выровнять колесо»: мечты из слабых сфер ─────────────
function alignSheet(first) {
  const w = wheel(), wk = planWk()
  const order = w ? SPH.map(s => s[0]).sort((a, b) => (+w.v[a] || 0) - (+w.v[b] || 0)) : SPH.map(s => s[0])
  let cur = first && SP[first] ? first : order[0]
  const sel = {}   // id мечты → "w" | "m"
  const taken = new Set([...wgoals(wk).map(g => g.wish), ...G().filter(g => g.kind === "month" && g.month === curMonth() && g.wish).map(g => g.wish)])
  const s = sheet(`<h3>Выровнять колесо</h3><div class="msg" style="margin-bottom:6px">Слабые сферы стоят первыми. Возьмите 1–3 мечты, они станут целями недели или месяца.</div><div id="wp-al"></div>`)
  const box = $("#wp-al", s.el)
  const draw = () => {
    const ws = wishes().filter(x => sphOf(x) === cur && !taken.has(x.id))
    const nW = wgoals(wk).length + Object.values(sel).filter(x => x === "w").length, n = Object.keys(sel).length
    const others = order.filter(k => k !== cur && (!w || weakList(w).includes(k))).map(k => [k, wishes().filter(x => sphOf(x) === k && !taken.has(x.id)).length]).filter(x => x[1])
    box.innerHTML = `<div class="wp-pills wp-scroll">${order.map(k => pill(k, w ? w.v[k] : null, k === cur, `data-al-s="${k}"`)).join("")}</div>
      <div class="card wp-list" style="--c:${SP[cur][2]}">${ws.length ? ws.map(x => { const h = sel[x.id]
        return `<div class="wp-wish" data-al-w="${esc(x.id)}"><span class="wp-box ${h ? "on" : ""}">${h ? "✓" : ""}</span><span class="t">${esc(x.title)}${h ? `<span class="s">Из «100 мечт» · ${SHORT[cur]}</span>` : ""}</span>
          ${h ? `<span class="wp-seg"><span class="${h === "w" ? "on" : ""}" data-al-h="w">Неделя</span><span class="${h === "m" ? "on" : ""}" data-al-h="m">Месяц</span></span>` : ""}</div>` }).join("")
        : `<div class="wp-empty">В «100 мечт» пока нет мечт для сферы «${SP[cur][1]}».</div>`}
        <button type="button" class="wp-add" data-al="add">+ Добавить мечту в «${SHORT[cur]}»</button></div>
      ${n ? `<div class="wp-hint ${nW > 3 ? "" : "ok"}">${nW > 3 ? `На неделю уже ${nW} ${plural(nW, "цель", "цели", "целей")}. Больше трёх обычно не успевают: часть можно поставить на месяц.` : `Выбрано ${n}.`}</div>` : ""}
      ${others.length ? `<div class="small muted" style="margin:10px 0 6px">Ещё ${others.map(([k, c]) => `в «${SHORT[k]}» ${c}`).join(", ")}</div>` : ""}
      <button type="button" class="wp-btn" data-al="ok" ${n ? "" : "disabled"}>${n ? `Поставить в план · ${n}` : "Выберите мечты"}</button>
      <div class="wp-note" style="text-align:center">Неделя ${wkLabel(wk)}. Брать необязательно.</div>`
  }
  box.addEventListener("click", async e => {
    const t = e.target.closest("[data-al-s], [data-al-w], [data-al-h], [data-al]")
    if (!t) return
    if (t.dataset.alS) { cur = t.dataset.alS; return draw() }
    if (t.dataset.alH) { e.stopPropagation(); sel[t.closest("[data-al-w]").dataset.alW] = t.dataset.alH; return draw() }
    if (t.dataset.alW) { const id = t.dataset.alW; if (sel[id]) delete sel[id]; else sel[id] = "w"; if (navigator.vibrate) navigator.vibrate(6); return draw() }
    if (t.dataset.al === "add") {
      const title = await ui.ask(`Мечта: ${SP[cur][1]}`, "Например: «выходные на Самуи вдвоём»")
      if (!title) return
      const r = goalAdd("wish", [title])
      if (r.added && r.added[0]) { const g = save1(r.added[0], { sph: cur }); sel[g.id] = "w" }
      return draw()
    }
    if (t.dataset.al === "ok") {
      let nw = 0, nm = 0
      for (const [id, h] of Object.entries(sel)) {
        const x = D.goals.find(g => g.id === id); if (!x) continue
        if (h === "w") { upsert("goals", { id: uid("wg"), kind: "wg", date: Date.now() + nw, wk, wish: id, title: x.title, sph: sphOf(x), done: false }); nw++ }
        else { const r = goalAdd("month", [x.title]); const g = (r.added && r.added[0]) || G().find(g => g.kind === "month" && g.month === curMonth() && normT(g.title) === normT(x.title)); if (g) save1(g, { wish: id, sph: sphOf(x) }); nm++ }
      }
      s.close(); render()
      toast([nw ? `на неделю ${nw}` : "", nm ? `на месяц ${nm}` : ""].filter(Boolean).join(", ").replace(/^./, c => "В плане: " + c))
    }
  })
  draw()
}

// ───────────── «Планы»: карточка «План недели» ─────────────
let wOff = null   // смещение недели в карточке (null — по умолчанию)
const viewWk = () => wkShift(planWk(), wOff || 0)
function goalProg(g, wk) {
  const l = tasks(wk).filter(t => t.wish && t.wish === g.wish)
  if (!l.length) return g.done ? "готово" : ""
  const occ = l.reduce((s, t) => s + Math.max(1, daysOf(t).length), 0), dn = l.reduce((s, t) => s + Object.keys(dnOf(t)).length, 0)
  return `${dn} из ${occ}`
}
function planCard() {
  const wk = viewWk(), m = meta(wk), st = stats(wk), gs = wgoals(wk)
  const mon = wkDate(wk), monthGs = G().filter(g => g.kind === "month" && g.wish && g.month === core.monthKey(mon))
  const isCur = wk === curWk(), past = wk < curWk()
  const status = past ? "прошла" : st.total ? (m && m.sentAt ? "план готов" : "черновик") : wk > curWk() ? "впереди" : "плана нет"
  let html = `<div class="card wp-card" id="wk-plan"><h2>План недели<button class="act" data-wp="edit">${st.total ? "Изменить" : "Запланировать"}</button></h2>
    <div class="wp-week"><button type="button" class="wp-arr" data-wp-w="-1" aria-label="Прошлая неделя">‹</button><span><b>${wkLabel(wk)}</b> · ${status}</span><button type="button" class="wp-arr" data-wp-w="1" aria-label="Следующая неделя">›</button></div>`
  html += `<button type="button" class="wp-goal" data-wp="goal"><span class="k">Цель недели</span><span class="v ${m && m.title ? "" : "ph"}">${m && m.title ? esc(m.title) : "Одна строка с цифрой, например «2 брони до пятницы»"}</span></button>`
  if (gs.length || monthGs.length) {
    html += `<div class="small muted" style="margin:0 0 6px">Цели из «100 мечт»</div><div class="wp-gl">`
    html += gs.map(g => `<button type="button" class="wp-gi ${g.done ? "done" : ""}" style="--c:${(SP[g.sph] || SP.trip)[2]}" data-wg="${esc(g.id)}"><i></i><span class="t">${esc(g.title)}<span class="s">${SHORT[g.sph] || ""} · неделя</span></span><span class="p">${g.done ? "готово" : goalProg(g, wk)}</span></button>`).join("")
    html += monthGs.map(g => `<button type="button" class="wp-gi ${g.done ? "done" : ""}" style="--c:${(SP[g.sph] || SP.trip)[2]}" data-wm="${esc(g.id)}"><i></i><span class="t">${esc(g.title)}<span class="s">${SHORT[g.sph] || ""} · месяц</span></span><span class="p">${g.done ? "готово" : ""}</span></button>`).join("")
    html += `</div>`
  }
  if (!gs.length && !past) html += `<button type="button" class="wp-add" data-wp="align" style="margin:0 0 10px">+ Цели из «100 мечт»${wheel() && weakList().length ? ` · слабые сферы: ${weakList().map(k => SHORT[k]).join(", ")}` : ""}</button>`
  if (st.total) {
    const pct = st.pm ? Math.min(100, Math.round(st.fm / st.pm * 100)) : 0
    html += `<div class="wp-stats"><div><b>${fmtH(st.pm)}</b><span>план</span></div><div><b>${fmtH(st.fm)}</b><span>факт</span></div><div><b>${st.done}/${st.total}</b><span>сделано</span></div><div><b>${st.keys}/${KEY_MAX}</b><span>ключевые</span></div></div>
      <div class="wp-bar"><i style="width:${pct}%"></i></div>`
    html += CATS.map(([c, name, col]) => { const l = st.l.filter(t => t.cat === c && (t.title || "").trim()); if (!l.length) return ""
      const right = c === "unp" ? `${l.length} · ${fmtMin(l.reduce((s, t) => s + factMin(t), 0))}` : `${l.filter(isDone).length} из ${l.length}`
      return `<button type="button" class="wp-grp" style="--c:${col}" data-wp-g="${c}"><i></i><span class="t">${name}</span><span class="n">${right}</span><span class="ch">›</span></button>` }).join("")
    const late = st.l.filter(t => t.late && t.cat !== "unp").length
    if (late) html += `<div class="wp-note">${late} ${plural(late, "задача добавлена", "задачи добавлены", "задач добавлено")} после понедельника и ${late === 1 ? "считается" : "считаются"} вне плана.</div>`
  } else if (!past) {
    html += `<div class="muted small" style="margin:4px 0 12px">План составляют в воскресенье: регулярные дела, разовые, обучение. У каждой задачи результат и время. Можно сказать ${esc(iziName())}: «обзвон базы по понедельникам и средам в 9, полчаса».</div>
      <div class="wp-row2">${tasks(wkShift(wk, -1)).some(t => t.cat === "reg") ? `<button type="button" class="wp-btn ghost" data-wp="copy">С прошлой недели</button>` : ""}<button type="button" class="wp-btn" data-wp="edit">Запланировать</button></div>`
  }
  return html + `</div>`
}
function goalSheet(id) {
  const g = D.goals.find(x => x.id === id); if (!g) return
  const s = sheet(`<h3>${esc(g.title)}</h3><div class="msg">${SHORT[g.sph] || ""} · цель недели ${wkLabel(g.wk)}</div>
    <button class="opt" data-a="task">Добавить задачу к цели</button>
    <button class="opt" data-a="done">${g.done ? "Вернуть в работу" : "Цель недели выполнена"}</button>
    ${g.wish ? `<button class="opt" data-a="wish">Мечта исполнена целиком</button>` : ""}
    <button class="opt" data-a="del" style="color:var(--red)">Убрать из недели</button>`)
  s.el.addEventListener("click", e => {
    const a = e.target.closest("[data-a]"); if (!a) return
    s.close()
    if (a.dataset.a === "task") { const t = newTask(g.wk, "irr", { title: g.title, wish: g.wish }); return editSheet(g.wk, t.id) }
    if (a.dataset.a === "done") save1(g, { done: !g.done, doneAt: Date.now() })
    if (a.dataset.a === "wish") { save1(g, { done: true, doneAt: Date.now() }); if (typeof goalToggle === "function") goalToggle(g.wish, true); toast("Мечта исполнена") }
    if (a.dataset.a === "del") remove("goals", g.id)
    render()
  })
}
async function goalEdit(wk) {
  const m = meta(wk)
  const t = await ui.ask("Цель недели", "Одна строка с цифрой: «2 брони до пятницы»", m ? m.title || "" : "")
  if (t == null) return
  upsert("goals", Object.assign({ id: "wk:" + wk, kind: "wk", date: wkDate(wk).getTime(), wk }, m || {}, { title: String(t).trim() }))
  render()
}

// ───────────── Задачи ─────────────
function newTask(wk, cat, extra = {}) {
  const mon = wkDate(wk), late = cat !== "unp" && Date.now() >= addDays(mon, 1).getTime() && wk <= curWk()
  const t = { id: uid("wt"), kind: "wt", date: Date.now(), ord: Date.now(), wk, cat, title: "", prod: "", key: false, days: [], tm: "", pm: 30, dn: {} }
  if (late) t.late = 1
  if (cat === "unp") { t.days = [wk === curWk() ? dayIdx(new Date()) : 0]; t.pm = 0 }
  return upsert("goals", Object.assign(t, extra))
}
function copyPrev(wk) {
  const prev = tasks(wkShift(wk, -1)).filter(t => t.cat === "reg" && (t.title || "").trim()), have = tasks(wk)
  let n = 0
  for (const t of prev) {
    if (have.some(x => x.cat === "reg" && normT(x.title) === normT(t.title))) continue
    upsert("goals", { id: uid("wt"), kind: "wt", date: Date.now() + n, ord: Date.now() + n, wk, cat: "reg", title: t.title, prod: t.prod || "", key: !!t.key, days: daysOf(t), tm: t.tm || "", pm: t.pm || 30, dn: {}, wish: t.wish || undefined })
    n++
  }
  return n
}
const durOpts = (v, zero) => (zero ? [`<option value="">—</option>`] : []).concat(DUR.map(m => `<option value="${m}" ${+v === m ? "selected" : ""}>${fmtMin(m)}</option>`)).join("")

// ───────────── Окно «Запланировать неделю» ─────────────
let edOpen = null, delAsk = null, aiBusy = false
function editSheet(wk = viewWk(), openId = null) {
  edOpen = openId; delAsk = null
  const s = sheet(`<h3>Неделя ${wkLabel(wk)}</h3><div id="wp-ed"></div>`, { onClose: () => { edOpen = null; render() } })
  const box = $("#wp-ed", s.el)
  const task = id => D.goals.find(x => x.id === id)
  const row = t => {
    const c = CAT[t.cat][2]
    if (edOpen !== t.id) {
      const sub = t.cat === "unp" ? `${DN[daysOf(t)[0] || 0]} · ${fmtMin(factMin(t))}` : [daysOf(t).length ? daysLabel(daysOf(t)) : "дни не выбраны", t.tm, t.pm ? fmtMin(t.pm) : ""].filter(Boolean).join(" · ")
      return `<button type="button" class="wp-mini ${isDone(t) ? "done" : ""}" style="--c:${c}" data-ed-o="${esc(t.id)}"><i></i><span class="t">${t.key ? '<span class="wp-star">★</span> ' : ""}${esc(t.title || "Без названия")}<span class="s">${esc(sub)}${t.late ? " · вне плана" : ""}${t.wish ? " · цель из мечт" : ""}</span>${t.ai ? `<span class="wp-ai ${t.ai.ok ? "ok" : ""}">${esc(t.ai.note)}</span>` : ""}</span></button>`
    }
    const days = daysOf(t)
    return `<div class="wp-ed" style="--c:${c}" data-ed="${esc(t.id)}">
      <div class="wp-ed-top"><input class="wp-in wp-what" data-f="title" value="${esc(t.title)}" placeholder="Что сделать" enterkeyhint="next"><button type="button" class="wp-starb ${t.key ? "on" : ""}" data-ed-a="key" aria-label="Ключевая">★</button></div>
      ${t.cat === "unp" ? "" : `<div class="wp-lab">Результат</div><input class="wp-in" data-f="prod" value="${esc(t.prod || "")}" placeholder="Что будет на руках: «20 контактов, 2 показа»">`}
      ${t.ai ? `<div class="wp-ai ${t.ai.ok ? "ok" : ""}">${esc(t.ai.note)}</div>` : ""}
      ${t.cat === "unp" ? `<div class="wp-lab">День</div><div class="wp-days">${DN.map((d, i) => `<button type="button" class="${days[0] === i ? "on" : ""}" data-ed-d1="${i}">${d}</button>`).join("")}</div>`
        : `<div class="wp-lab">Дни</div><div class="wp-days">${DN.map((d, i) => `<button type="button" class="${days.includes(i) ? "on" : ""}" data-ed-d="${i}">${d}</button>`).join("")}</div>
        <div class="wp-quick"><button type="button" data-ed-a="wd">Пн–Пт</button><button type="button" data-ed-a="all">Вся неделя</button></div>`}
      <div class="wp-tm">${t.cat === "unp" ? "" : `<label><span class="wp-lab">Начало</span><input class="wp-in" type="time" data-f="tm" value="${esc(t.tm || "")}"></label>
        <label><span class="wp-lab">На один раз</span><select class="wp-in" data-f="pm">${durOpts(t.pm)}</select></label>`}
        <label><span class="wp-lab">${t.cat === "unp" ? "Сколько ушло" : "Факт, всего"}</span><select class="wp-in" data-f="fm">${durOpts(factMin(t) || "", true)}</select></label></div>
      ${t.cat !== "unp" && days.length > 1 && t.pm ? `<div class="wp-note">Всего за неделю ${fmtMin(planMin(t))}</div>` : ""}
      <div class="wp-ed-b"><button type="button" class="wp-del ${delAsk === t.id ? "ask" : ""}" data-ed-a="del">${delAsk === t.id ? "Удалить?" : "✕"}</button><button type="button" class="wp-ok" data-ed-a="close">Готово</button></div></div>`
  }
  const draw = () => {
    const m = meta(wk), st = stats(wk), prevReg = tasks(wkShift(wk, -1)).some(t => t.cat === "reg" && (t.title || "").trim())
    let h = `<div class="msg" style="margin-bottom:4px">Можно говорить голосом: «обзвон базы по понедельникам, средам и пятницам в 9, полчаса».</div>
      <label class="wp-goal2"><span class="k">Цель недели</span><input class="wp-in" data-wkg="1" value="${esc(m && m.title || "")}" placeholder="2 брони до пятницы"></label>`
    for (const [c, name, col] of CATS) {
      const l = st.l.filter(t => t.cat === c)
      h += `<div class="wp-gh" style="--c:${col}"><i></i>${name}${c === "reg" && prevReg ? `<button type="button" class="n" data-ed-copy="1">С прошлой недели</button>` : ""}<button type="button" class="n" data-ed-new="${c}">+ ${c === "unp" ? "Вне плана" : "Задача"}</button></div>`
      h += l.length ? l.map(row).join("") : `<div class="wp-empty small">${{ reg: "Повторяются каждую неделю: зарядка, обзвон, отчёт.", irr: "Один раз за неделю: встреча, документ, покупка.", edu: "Курсы, книги, практика.", unp: "То, что пришлось сделать вне плана. Указывается сразу со временем." }[c]}</div>`
    }
    h += hints(wk, st).map(([k, t]) => `<div class="wp-hint ${k === "ok" ? "ok" : ""}">${esc(t)}</div>`).join("")
    if (st.total) h += `<button type="button" class="wp-izi" data-ed-ai="1" ${aiBusy ? "disabled" : ""}><b class="izi-orb" style="width:26px;height:26px"></b><span style="flex:1">${aiBusy ? `${esc(iziName())} читает задачи…` : `${esc(iziName())} проверит, понятен ли результат у каждой задачи`}</span><b>${aiBusy ? "" : "Проверить"}</b></button>`
    h += `<div class="wp-row2" style="margin-top:12px"><button type="button" class="wp-btn" data-ed-save="1">Сохранить план</button></div>
      <div class="wp-note" style="text-align:center">${gcalOn() ? "Задачи со временем сами встанут в Google Календарь" : "Подключите Google Календарь в Настройках, и задачи со временем будут ставиться туда сами"}</div>`
    const y = s.el.scrollTop
    box.innerHTML = h
    s.el.scrollTop = y
    if (edOpen) { const inp = $(`[data-ed="${edOpen}"] .wp-what`, box); if (inp && !inp.value) inp.focus() }
  }
  box.addEventListener("change", e => {
    const el = e.target
    if (el.dataset.wkg) { const m = meta(wk); quiet(() => upsert("goals", Object.assign({ id: "wk:" + wk, kind: "wk", date: wkDate(wk).getTime(), wk }, m || {}, { title: el.value.trim() }))); return }
    const ed = el.closest("[data-ed]"); if (!ed || !el.dataset.f) return
    const t = task(ed.dataset.ed); if (!t) return
    const f = el.dataset.f
    if (f === "fm") {   // факт: при выборе задача считается выполненной (по последнему дню плана или сегодня)
      const v = +el.value || 0, dn = {}
      if (v) { const d = daysOf(t); if (d.length) { const per = Math.round(v / d.length); d.forEach(i => dn[i] = per) } else dn[dayIdx(new Date())] = v }
      save1(t, { dn }); return draw()
    }
    quiet(() => save1(t, { [f]: f === "pm" ? +el.value : el.value.trim() }))
    // время не перерисовываем: колёсико выбора на iPhone закрывалось после часа (поле пересоздавалось)
    if (f === "pm") draw()
  })
  box.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return
    const ed = b.closest("[data-ed]"), t = ed && task(ed.dataset.ed)
    if (b.dataset.edO) { edOpen = b.dataset.edO; delAsk = null; return draw() }
    if (b.dataset.edNew) { const n = quiet(() => newTask(wk, b.dataset.edNew)); edOpen = n.id; return draw() }
    if (b.dataset.edCopy) { const n = copyPrev(wk); toast(n ? `Перенесено: ${n}` : "Всё уже перенесено"); return draw() }
    if (b.dataset.edAi) return aiCheck(wk, draw)
    if (b.dataset.edSave) {
      const m = meta(wk)
      upsert("goals", Object.assign({ id: "wk:" + wk, kind: "wk", date: wkDate(wk).getTime(), wk }, m || {}, { sentAt: Date.now() }))
      for (const x of tasks(wk)) if (!(x.title || "").trim()) remove("goals", x.id)
      s.close(); toast("План сохранён")
      calSync(wk).then(r => { if (r && r.added) toast(`В календаре: ${r.added}`) })
      return
    }
    if (!t) return
    if (b.dataset.edD != null) { const i = +b.dataset.edD, d = daysOf(t); save1(t, { days: d.includes(i) ? d.filter(x => x !== i) : [...d, i].sort() }); return draw() }
    if (b.dataset.edD1 != null) { const i = +b.dataset.edD1, v = factMin(t); save1(t, { days: [i], dn: v ? { [i]: v } : {} }); return draw() }
    const a = b.dataset.edA
    if (a === "key") { if (!t.key && stats(wk).keys >= KEY_MAX) toast(`Ключевых уже ${KEY_MAX}. Лучше выбрать главные`); save1(t, { key: !t.key }); return draw() }
    if (a === "wd") { save1(t, { days: [0, 1, 2, 3, 4] }); return draw() }
    if (a === "all") { save1(t, { days: [0, 1, 2, 3, 4, 5, 6] }); return draw() }
    if (a === "close") { if (t.cat === "unp" && !factMin(t) && (t.title || "").trim()) return toast("Укажите, сколько ушло времени"); edOpen = null; return draw() }
    if (a === "del") { if (delAsk !== t.id) { delAsk = t.id; return draw() } calDrop(t); remove("goals", t.id); edOpen = null; delAsk = null; return draw() }
  })
  box.addEventListener("input", e => { const el = e.target; if (el.dataset.f === "title") { const ed = el.closest("[data-ed]"), t = ed && task(ed.dataset.ed); if (t) quiet(() => save1(t, { title: el.value })) } })
  draw()
  return s
}

// ───────────── Изи проверяет формулировки ─────────────
async function aiCheck(wk, redraw) {
  const items = tasks(wk).filter(t => t.cat !== "unp" && (t.title || "").trim()).map(t => ({ id: t.id, group: CAT[t.cat][1], task: t.title, result: t.prod || "" }))
  if (!items.length || aiBusy) return
  aiBusy = true; redraw()
  const m = meta(wk)
  const prompt = `Проверь недельный план. Правила:
1. Задача сформулирована конкретно. Плохо: «переговоры». Хорошо: «переговоры с застройщиком X об увеличении комиссии».
2. Результат — то, что будет на руках, когда задача выполнена, а не процесс. Плохо: «проведённая встреча». Хорошо: «согласованная скидка». Хорошо, когда есть цифра или проверяемый факт.
Цель недели: ${m && m.title || "не указана"}.
Ответь ТОЛЬКО JSON-массивом [{"id":"...","ok":true|false,"note":"..."}] для каждой задачи. note по-русски, до 120 символов, простыми словами, без вступлений. ok=true: коротко, почему хорошо. ok=false: что не так и готовая формулировка результата.
Задачи:
${JSON.stringify(items)}`
  try {
    const r = await claude({ max_tokens: 2000, messages: [{ role: "user", content: prompt }] }, 60000)
    const txt = ((r && r.content) || []).filter(c => c.type === "text").map(c => c.text).join("")
    const arr = JSON.parse((txt.match(/\[[\s\S]*\]/) || ["[]"])[0])
    for (const x of arr) { const t = D.goals.find(g => g.id === x.id && g.kind === "wt"); if (t) save1(t, { ai: { ok: !!x.ok, note: String(x.note || "").slice(0, 200), at: Date.now() } }) }
    toast(arr.length ? "Комментарии под задачами" : "Не получилось проверить")
  } catch (e) { toast(String(e.message || "Не получилось проверить")) }
  aiBusy = false; redraw()
}

// ───────────── Google Календарь ─────────────
const evSig = t => [t.title, t.tm, t.pm].join("|")
function dayDate(wk, i) { return addDays(wkDate(wk), i) }
async function calSync(wk) {
  if (!gcalOn()) return null
  let added = 0
  for (const t0 of tasks(wk)) {
    let t = t0
    if (t.cat === "unp" || !(t.title || "").trim()) continue
    const ev = Object.assign({}, t.ev || {}), want = t.tm ? daysOf(t).filter(i => dayDate(wk, i) >= sod(new Date())) : []
    const sigOld = t.evs || ""
    // время или название поменялись — старые события убираем
    for (const k of Object.keys(ev)) if (!want.includes(+k) || sigOld !== evSig(t)) { if (dayDate(wk, +k) >= sod(new Date())) try { await calDo("delete", { id: ev[k] }) } catch (e) {} delete ev[k] }
    for (const i of want) {
      if (ev[i]) continue
      const d = dayDate(wk, i), [h, mi] = t.tm.split(":").map(Number), s = new Date(d); s.setHours(h, mi, 0, 0)
      const e = new Date(+s + Math.max(15, +t.pm || 30) * 60e3), iso = x => `${dayKey(x)}T${z2(x.getHours())}:${z2(x.getMinutes())}`
      try { const r = await calCreate({ title: t.title, start: iso(s), end: iso(e), notes: t.prod ? `Результат: ${t.prod}` : "" }); if (r && r.event && r.event.id) { ev[i] = r.event.id; added++ } } catch (e) {}
    }
    t = D.goals.find(x => x.id === t0.id) || t0
    save1(t, { ev, evs: evSig(t) })
  }
  return { added }
}
function calDrop(t) {
  if (!gcalOn() || !t.ev) return
  for (const [k, id] of Object.entries(t.ev)) if (dayDate(t.wk, +k) >= sod(new Date())) calDo("delete", { id }).catch(() => {})
}

// ───────────── «Сегодня»: задачи по плану недели ─────────────
let askId = null
function todayTasks(d = new Date()) {
  const wk = wkOf(d), i = dayIdx(d)
  return tasks(wk).filter(t => (t.title || "").trim() && daysOf(t).includes(i))
    .sort((a, b) => (a.tm || "99") < (b.tm || "99") ? -1 : (a.tm || "99") > (b.tm || "99") ? 1 : a.ord - b.ord)
}
function todayCard() {
  const d = new Date(), i = dayIdx(d), wk = curWk(), l = todayTasks(d)
  if (!l.length) {
    if (tasks(wk).length || ![0, 1].includes(d.getDay())) return ""
    return `<div class="card wp-card" id="wk-today"><h2>План недели</h2><div class="muted small" style="margin:-2px 0 10px">${d.getDay() === 0 ? `Воскресенье: время составить план на ${wkLabel(planWk())}.` : "На эту неделю плана нет. Десять минут сейчас сэкономят неделю."}</div><button type="button" class="wp-btn" data-wp="edit">Запланировать</button></div>`
  }
  const done = l.filter(t => dnOf(t)[i] != null).length, m = meta(wk)
  return `<div class="card wp-card" id="wk-today"><h2>По плану недели<button class="act" data-wp="week">${done} из ${l.length}</button></h2>
    ${m && m.title ? `<div class="muted small" style="margin:-4px 0 4px">Цель недели: ${esc(m.title)}</div>` : ""}
    ${l.map(t => taskRow(t, i)).join("")}
    <div class="wp-row2" style="margin-top:8px"><button type="button" class="wp-btn ghost" data-wp="unp">+ Вне плана</button><button type="button" class="wp-btn ghost" data-wp="week">Вся неделя</button></div></div>`
}
function taskRow(t, i) {
  const f = dnOf(t)[i], on = f != null, c = CAT[t.cat][2], g = t.wish && G().find(x => x.kind === "wg" && x.wish === t.wish)
  const tag = g ? `<span class="wp-tag" style="--c:${(SP[g.sph] || SP.trip)[2]}">${SHORT[g.sph] || ""}</span> ` : ""
  const ask = askId === t.id && !on
  const pm = +t.pm || 30, opts = [...new Set([Math.max(5, Math.round(pm / 2 / 5) * 5), pm, Math.round(pm * 1.5 / 5) * 5, pm * 2])]
  return `<div class="wp-task ${on ? "done" : ""}" data-tt="${esc(t.id)}"><button type="button" class="wp-box ${on ? "on" : ""}" style="--c:${c}" data-tt-c="1" aria-label="${on ? "Снять отметку" : "Выполнено"}">${on ? "✓" : ""}</button>
    <span class="t"><span class="w">${t.key ? '<span class="wp-star">★</span> ' : ""}${esc(t.title)}</span><span class="s">${tag}${esc(t.prod || CAT[t.cat][1])}</span>
    ${ask ? `<span class="wp-ask"><span class="q">Сколько ушло?</span>${opts.map(m => `<button type="button" data-tt-m="${m}">${fmtMin(m)}</button>`).join("")}</span>` : ""}</span>
    <span class="m"><b>${esc(t.tm || "")}</b>${on ? (f !== pm ? `${fmtMin(pm)} → ${fmtMin(f)}` : fmtMin(f)) : fmtMin(pm)}</span></div>`
}
function markDone(id, i, min) {
  const t = D.goals.find(x => x.id === id); if (!t) return
  const dn = Object.assign({}, dnOf(t)); if (min == null) delete dn[i]; else dn[i] = min
  save1(t, { dn }); askId = null
  if (min != null && navigator.vibrate) navigator.vibrate(10)
  render()
}
function unpSheet() {
  const s = sheet(`<h3>Вне плана</h3><div class="msg">То, что пришлось сделать сегодня, хотя в плане этого не было.</div>
    <div class="field"><label>Что сделали</label><input id="wp-u-t" class="wp-in" placeholder="Срочный звонок клиенту"></div>
    <div class="field"><label>Сколько ушло</label><select id="wp-u-m" class="wp-in">${durOpts(30)}</select></div>
    <div class="btns"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Записать</button></div>`)
  setTimeout(() => { const i = $("#wp-u-t", s.el); if (i) i.focus() }, 250)
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#wp-u-t", s.el).value.trim(), m = +$("#wp-u-m", s.el).value
    if (!title) return toast("Напишите, что сделали")
    const i = dayIdx(new Date())
    newTask(curWk(), "unp", { title, days: [i], dn: { [i]: m } })
    s.close(); render(); toast("Записано вне плана")
  }
}

// ───────────── Закрытие дня: неотмеченные задачи плана ─────────────
function enhanceClose(entry) {
  if (!entry || !isOn()) return
  const i = dayIdx(new Date()), left = todayTasks().filter(t => dnOf(t)[i] == null)
  if (!left.length) return
  const box = document.createElement("div"); box.className = "wp-close"
  box.innerHTML = `<div class="msg">По плану недели не отмечено. Сколько ушло?</div>` + left.map(t => { const pm = +t.pm || 30
    return `<div class="wp-cl" data-cl="${esc(t.id)}"><span class="t">${esc(t.title)}</span><span class="wp-ask">${[pm, Math.round(pm * 1.5 / 5) * 5].map(m => `<button type="button" data-cl-m="${m}">${fmtMin(m)}</button>`).join("")}<button type="button" data-cl-m="0">Не делал</button></span></div>` }).join("")
  box.addEventListener("click", e => {
    const b = e.target.closest("[data-cl-m]"); if (!b) return
    const row = b.closest("[data-cl]"), m = +b.dataset.clM
    if (m) { const t = D.goals.find(x => x.id === row.dataset.cl); if (t) save1(t, { dn: Object.assign({}, dnOf(t), { [i]: m }) }) }
    row.remove()
  })
  const h3 = $("h3", entry.el); if (h3) h3.after(box)
}

// ───────────── Изи ─────────────
const WDK = { пн: 0, вт: 1, ср: 2, чт: 3, пт: 4, сб: 5, вс: 6 }
const TOOL = { name: "week_plan", description: "План недели (функция «План недели»). action: add — добавить задачу (title, result — что будет на руках, group: регулярные|разовые|обучение|вне плана, days: [пн…вс], time HH:MM, minutes — на один раз, key — ключевая; для «вне плана» fact_minutes обязательно); done — отметить задачу сегодня выполненной (title, fact_minutes); goal — цель недели (title); get — показать план. week: this|next (по умолчанию: в воскресенье next, иначе this).",
  input_schema: { type: "object", properties: { action: { type: "string", enum: ["add", "done", "goal", "get"] }, title: { type: "string" }, result: { type: "string" },
    group: { type: "string", enum: ["регулярные", "разовые", "обучение", "вне плана"] }, days: { type: "array", items: { type: "string" } }, time: { type: "string" }, minutes: { type: "number" },
    fact_minutes: { type: "number" }, key: { type: "boolean" }, week: { type: "string", enum: ["this", "next"] } }, required: ["action"] } }
function weekJSON(wk) {
  const st = stats(wk), m = meta(wk)
  return { week: wkLabel(wk), goal: m && m.title || null, plan_h: Math.round(st.pm / 6) / 10, fact_h: Math.round(st.fm / 6) / 10, done: st.done, total: st.total, keys: st.keys,
    goals_from_wishes: wgoals(wk).map(g => ({ title: g.title, sphere: SHORT[g.sph], done: !!g.done })),
    tasks: st.l.filter(t => (t.title || "").trim()).map(t => ({ title: t.title, result: t.prod || "", group: CAT[t.cat][1].toLowerCase(), days: daysOf(t).map(i => DN[i]), time: t.tm || null, minutes: t.pm || 0, fact: factMin(t), done: isDone(t), key: !!t.key })) }
}
async function tool(x) {
  const wk = x.week === "next" ? wkShift(curWk(), 1) : x.week === "this" ? curWk() : planWk()
  if (x.action === "get") return weekJSON(wk)
  if (x.action === "goal") { if (!x.title) return { error: "нужна цель" }; const m = meta(wk); upsert("goals", Object.assign({ id: "wk:" + wk, kind: "wk", date: wkDate(wk).getTime(), wk }, m || {}, { title: x.title })); render(); return { ok: true, week: wkLabel(wk) } }
  if (x.action === "add") {
    if (!x.title) return { error: "нужно название" }
    const cat = { регулярные: "reg", разовые: "irr", обучение: "edu", "вне плана": "unp" }[x.group] || "irr"
    let days = (x.days || []).map(d => WDK[String(d).toLowerCase().slice(0, 2)]).filter(d => d != null)
    if (cat === "unp") { if (!(x.fact_minutes > 0)) return { error: "для задачи вне плана нужно fact_minutes — спроси, сколько ушло" }; const i = dayIdx(new Date()); days = [i]; const t = newTask(curWk(), "unp", { title: x.title, days, dn: { [i]: Math.round(x.fact_minutes) } }); render(); return { ok: true, id: t.id } }
    const tm = /^\d{1,2}:\d\d$/.test(x.time || "") ? x.time.padStart(5, "0") : ""
    const t = newTask(wk, cat, { title: x.title, prod: x.result || "", days: [...new Set(days)].sort(), tm, pm: Math.round(x.minutes) || 30, key: !!x.key })
    if (t.tm) calSync(wk).catch(() => {})
    render()
    return { ok: true, week: wkLabel(wk), late: !!t.late, note: t.late ? "добавлена после понедельника — считается вне плана" : undefined, no_result: !x.result ? "спроси, какой результат будет на руках" : undefined }
  }
  if (x.action === "done") {
    const i = dayIdx(new Date()), n = normT(x.title || ""), l = todayTasks()
    const t = l.find(t => normT(t.title) === n) || l.find(t => normT(t.title).includes(n) || n.includes(normT(t.title)))
    if (!t) return { error: "такой задачи сегодня в плане нет", today: l.map(t => t.title) }
    markDone(t.id, i, Math.round(x.fact_minutes) || +t.pm || 30); return { ok: true, title: t.title }
  }
  return { error: "action: add, done, goal или get" }
}

// ───────────── Делегированные нажатия ─────────────
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-wp], [data-wp-w], [data-wp-g], [data-wp-al], [data-wg], [data-wm], [data-tt-c], [data-tt-m]")
  if (!t || !isOn()) return
  e.stopPropagation()
  if (t.dataset.wpW) { wOff = (wOff || 0) + +t.dataset.wpW; return render() }
  if (t.dataset.wpG) return editSheet(viewWk())
  if (t.dataset.wpAl) return alignSheet(t.dataset.wpAl)
  if (t.dataset.wg) return goalSheet(t.dataset.wg)
  if (t.dataset.wm) { if (typeof goalToggle === "function") goalToggle(t.dataset.wm); return render() }
  if (t.dataset.ttC) { const id = t.closest("[data-tt]").dataset.tt, g = D.goals.find(x => x.id === id), i = dayIdx(new Date())
    if (g && dnOf(g)[i] != null) return markDone(id, i, null)
    askId = askId === id ? null : id; return render() }
  if (t.dataset.ttM) return markDone(t.closest("[data-tt]").dataset.tt, dayIdx(new Date()), +t.dataset.ttM)
  const a = t.dataset.wp
  if (a === "rate") return rateSheet()
  if (a === "align") return alignSheet()
  if (a === "edit") return editSheet(tab === "today" ? planWk() : viewWk())
  if (a === "goal") return goalEdit(viewWk())
  if (a === "copy") { const n = copyPrev(viewWk()); toast(n ? `Перенесено: ${n}` : "Нечего переносить"); return render() }
  if (a === "unp") return unpSheet()
  if (a === "week") { wOff = 0; if (new Date().getDay() === 0) wOff = -1; setTab("plans"); setTimeout(() => { const el = $("#wk-plan"); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }) }, 80) }
}, true)

// ───────────── Подключение ─────────────
function place(v) {
  if (!v) return
  // экран мог не перерисоваться (разметка раздела не изменилась) — свои блоки ставим заново
  const old = { wheel: $("#wheel", v), plan: $("#wk-plan", v), today: $("#wk-today", v) }
  const put = (k, html, where, pos) => {
    if (old[k]) { if (old[k].outerHTML === html) { old[k] = null; return } old[k].insertAdjacentHTML("beforebegin", html); return }
    if (where) where.insertAdjacentHTML(pos, html)
  }
  try { placeIn(v, put) } finally { for (const k in old) if (old[k]) old[k].remove() }
}
function placeIn(v, put) {
  if (!isOn()) return
  const first = () => $$(".card", v).find(c => !/^(wheel|wk-plan|wk-today)$/.test(c.id))
  if (tab === "health" && sameDay(healthDay(), new Date())) put("wheel", wheelCard(), first(), "beforebegin")
  if (tab === "plans" && plansF === "all") {
    const g = $("#goals", v)
    if (g) g.style.display = "none"   // «Цели на месяц» теперь внутри плана: цели из мечт и неделя
    put("plan", planCard(), first(), "beforebegin")
  }
  if (tab === "today" && sameDay(selDay, new Date())) {
    const h = todayCard(); if (!h) return
    const after = $(".daycard", v) || $(".hero-now", v)
    put("today", h, after || first(), after ? "afterend" : "beforebegin")
  }
}
function init() {
  const render0 = render
  render = function () { const out = render0.apply(this, arguments); try { place($("#view")) } catch (e) { console.error("plan", e) } return out }
  const cd0 = closeDay
  closeDay = function () { const out = cd0.apply(this, arguments); try { enhanceClose(stack[stack.length - 1]) } catch (e) { console.error("plan", e) } return out }
  if (!AGENT_TOOLS.some(x => x.name === TOOL.name)) AGENT_TOOLS.push(TOOL)
  try { TOOL_STATUS.week_plan = "обновляю план недели" } catch (e) {}
  const run0 = runTool
  runTool = async function (name, x) { if (name === "week_plan") return tool(x || {}); return run0.apply(this, arguments) }
  const sys0 = agentSystem
  agentSystem = function () {
    const s = sys0.apply(this, arguments)
    if (!isOn()) return s
    try {
      const wk = curWk(), m = meta(wk), l = todayTasks(), w = wheel(), weak = weakList(w), i = dayIdx(new Date())
      return s + `\n- План недели (week_plan): задачи с результатом, днями, временем и минутами; группы регулярные, разовые, обучение, вне плана; до ${KEY_MAX} ключевых. Добавляя задачу, спроси результат, если его нет. Задача, добавленная после понедельника, считается вне плана.` +
        (m && m.title ? ` Цель недели: «${m.title}».` : "") +
        (l.length ? ` Сегодня по плану: ${l.map(t => `${t.tm ? t.tm + " " : ""}${t.title}${dnOf(t)[i] != null ? " (сделано)" : ""}`).join("; ")}. В утреннем плане назови их.` : "") +
        (w ? ` Колесо баланса: ${SPH.map(([k]) => `${SHORT[k]} ${w.v[k]}`).join(", ")}${weak.length ? `; слабые сферы: ${weak.map(k => SHORT[k]).join(", ")} — можно мягко предложить мечту оттуда, не настаивая` : ""}.` : "")
    } catch (e) { return s }
  }
  window.WPLAN = { monday, wkOf, curWk, planWk, tasks, stats, hints, sphOf, weakList, wheel, editSheet, alignSheet, rateSheet, calSync, tool, todayTasks, SPH, CATS }
}
try { init() } catch (e) { console.error("plan", e) }
})()
