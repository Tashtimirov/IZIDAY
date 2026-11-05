// IZIDAY · Голодание: интервальное (16:8, 18:6), сутки и своё — до 7 суток.
// Файл подключается ПОСЛЕ health.js и заменяет карточку голодания (fastCard) и запуск (fastStart) из app.js.
// Хранение — список fast (как и было): {id, date, start, hours, end?, ack?} — ack: человек подтвердил предупреждение (> 48 ч).
// Пуш в конце шлёт таблица (Code.gs, «Окно открыто»). Пока идёт голодание от суток — подсказки-nudges с id fs…:
// вода раз в 3 часа днём, «сутки позади», за час до конца — как мягко выйти.
(function () {
"use strict"
if (typeof D === "undefined" || typeof fastCard !== "function") return

const MAX_H = 168          // 7 суток — дальше только под присмотром врача, сами не ставим
const WARN_H = 48          // дольше — предупреждение и подтверждение
const DOC_H = 72           // дольше — «лучше с врачом»
const z2h = n => String(n).padStart(2, "0")
const isKid = () => { try { return !!(window.FAM && FAM.kidMode && FAM.kidMode()) } catch (e) { return false } }
const ico = (p, s = 16) => `<i class="tdi" style="width:${s}px;height:${s}px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg></i>`
const IC = {
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 2M9.5 2.5h5M19 6.5l-1.5 1.5"/>',
  drop: '<path d="M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11z"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M12 8.5v4.5M12 16h.01"/>',
  bowl: '<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z"/><path d="M9 7c0-1.2 1-1.5 1-2.7M13 7c0-1.2 1-1.5 1-2.7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
}
const durLabel = h => h % 24 === 0 && h >= 24 ? (h === 24 ? "сутки" : `${h / 24} ${plural(h / 24, "сутки", "суток", "суток")}`) : `${h} ч`
const clock = ms => { const m = Math.max(0, Math.floor(ms / 60e3)); return `${Math.floor(m / 60)}:${z2h(m % 60)}` }
const left = ms => { const m = Math.max(0, Math.round(ms / 60e3)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60
  return d ? `${d} д ${h} ч` : h ? `${h} ч ${mm} мин` : `${mm} мин` }
const when = t => { const d = new Date(t); return `${dayName(d)} в ${hm(d)}` }
const endOf = f => f.start + f.hours * 3600e3

// Стадии — примерные, у всех по-разному
const STAGES = [
  [0, "Пищеварение", "Тело ещё переваривает последнюю еду."],
  [4, "Сахар снижается", "Инсулин падает, тело берёт энергию из запасов печени."],
  [12, "Переход на жиры", "Запасы сахара заканчиваются, тело начинает жечь жир."],
  [18, "Кетоз", "Растут кетоны — у многих в это время ровная энергия и ясная голова."],
  [24, "Сутки", "Самое трудное обычно позади. Обновление клеток (аутофагия) усиливается."],
  [48, "Двое суток", "Глубокий кетоз. Следите за самочувствием, пейте воду с щепоткой соли."],
  [72, "Долгое голодание", "Это уже серьёзная нагрузка — лучше под присмотром врача."],
]
const stageOf = h => { let i = 0; STAGES.forEach((s, k) => { if (h >= s[0]) i = k }); return i }

// Мягкие предупреждения по длительности
function safety(h) {
  if (h <= 24) return h > 18 ? { lvl: 0, t: "Пейте воду в течение дня — 2–2,5 л. Если закружится голова или станет плохо — просто поешьте, это нормально." } : null
  const base = "Пейте 2–3 л воды в сутки, добавляйте щепотку соли. Без тяжёлых тренировок."
  if (h <= WARN_H) return { lvl: 1, t: base + " Прервите, если появятся слабость, головокружение или сердцебиение." }
  return { lvl: 2, t: base, list: [
      "Не голодайте дольше 2 суток при диабете, болезнях сердца, почек или печени, низком весе, беременности и кормлении, если были расстройства пищевого поведения, и до 18 лет.",
      "Если пьёте лекарства — особенно от давления или сахара — сначала спросите врача.",
      "Сразу прервите и поешьте при сильной слабости, обмороке, сердцебиении, спутанности.",
      h >= DOC_H ? "От 3 суток — лучше под присмотром врача." : "Выходите мягко: бульон, овощи, небольшие порции.",
    ] }
}
const safetyHTML = (h, cls = "") => { const s = safety(h); if (!s) return ""
  return `<div class="fs-warn l${s.lvl} ${cls}">${ico(IC.shield, 16)}<div>${s.list ? `<b>Долгое голодание — бережно</b><div>${s.t}</div><ul>${s.list.map(x => `<li>${x}</li>`).join("")}</ul>` : s.t}</div></div>` }

// ───────────── Запуск и остановка ─────────────
const start0 = fastStart, stop0 = fastStop
fastStart = function (hours, opt = {}) {
  const cur = fastNow(); if (cur) return cur
  const h = Math.max(1, Math.min(MAX_H, Math.round(+hours || 16)))
  const at = opt.start && opt.start < Date.now() && Date.now() - opt.start < h * 3600e3 ? Math.round(opt.start) : Date.now()
  const f = upsert("fast", { id: uid("g"), date: Date.now(), start: at, hours: h, ...(opt.ack ? { ack: 1 } : {}) })
  setTimeout(fastNudges, 30)
  return f
}
fastStop = function () { const f = stop0.apply(this, arguments); setTimeout(fastNudges, 30); return f }
function fastExtend(hours) { const f = fastNow(); if (!f) return null; const h = Math.max(1, Math.min(MAX_H, Math.round(+hours)))
  const r = upsert("fast", Object.assign({}, f, { hours: h }, h > WARN_H ? { ack: 1 } : {})); setTimeout(fastNudges, 30); return r }

// ───────────── Подсказки пушем (nudges fs…) на ближайшие 60 часов ─────────────
let busy = false
function fastNudges() {
  if (busy) return; busy = true
  try {
    const now = Date.now(), f = fastNow(), want = new Map(), horizon = now + 60 * 3600e3
    if (f && f.hours >= 20) {
      const end = endOf(f)
      // вода: каждые 3 часа с 9 до 21, не позже чем за час до конца
      for (let t = f.start + 3 * 3600e3; t < Math.min(end - 3600e3, horizon); t += 3 * 3600e3) {
        if (t <= now) continue
        const hr = new Date(t).getHours(); if (hr < 9 || hr > 21) continue
        const h = Math.round((t - f.start) / 3600e3)
        want.set(`fs${f.id}w${h}`, { date: t, title: "Голодание · вода", text: `Уже ${h} ч. Выпейте стакан воды${f.hours > 24 ? ", можно с щепоткой соли" : ""}.` })
      }
      // каждые сутки
      for (let d = 24; d < f.hours; d += 24) { const t = f.start + d * 3600e3; if (t <= now || t > horizon) continue
        want.set(`fs${f.id}d${d}`, { date: t, title: d === 24 ? "Сутки позади" : `${d / 24} ${plural(d / 24, "сутки", "суток", "суток")} позади`,
          text: `До конца ${left(end - t)}. Как самочувствие? Слабость или головокружение — повод спокойно закончить.` }) }
      // за час до конца — как выйти
      const pre = end - 3600e3
      if (pre > now && pre <= horizon) want.set(`fs${f.id}e`, { date: pre, title: "Через час — конец голодания", text: f.hours > 24 ? "Начните с лёгкого: бульон, яйцо, овощи. Небольшими порциями, без сладкого и жирного." : "Первая еда — лёгкая: белок и овощи." })
    }
    for (const n of live(D.nudges)) if (/^fs/.test(String(n.id)) && n.date > now && !want.has(n.id)) remove("nudges", n.id)
    for (const [id, x] of want) { const o = live(D.nudges).find(n => n.id === id); if (!o || o.date !== x.date || o.text !== x.text) upsert("nudges", Object.assign({ id }, x)) }
  } finally { busy = false }
}

// ───────────── Карточка ─────────────
function ringSVG(p) {
  const r = 46, c = 2 * Math.PI * r
  return `<svg class="fs-ring" viewBox="0 0 108 108"><defs><linearGradient id="fsg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--gold-light)"/><stop offset="1" stop-color="#E8803A"/></linearGradient></defs>
    <circle class="tr" cx="54" cy="54" r="${r}"/><circle class="fg" cx="54" cy="54" r="${r}" stroke="url(#fsg)" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - Math.min(1, p))).toFixed(1)}" style="--c:${c.toFixed(1)}"/></svg>`
}
function timeline(f, elH) {
  const marks = STAGES.filter(s => s[0] < f.hours).concat([[f.hours, "Конец"]])
  return `<div class="fs-line"><div class="bar"><i style="width:${Math.min(100, elH / f.hours * 100)}%"></i></div>${marks.map(s => `<span class="${elH >= s[0] ? "on" : ""}" style="left:${s[0] / f.hours * 100}%"></span>`).join("")}</div>`
}
function waterSince(f) { return live(D.water).filter(w => w.date >= f.start).reduce((s, w) => s + (w.ml || 0), 0) }
function activeHTML(f) {
  const el = Date.now() - f.start, goal = f.hours * 3600e3, rest = goal - el, elH = el / 3600e3, st = STAGES[stageOf(elH)]
  const wl = waterSince(f), wNeed = Math.round(Math.min(f.hours, Math.max(elH, 1)) / 24 * 25) * 100
  return `<div class="fs-top">
      <div class="fs-dial">${ringSVG(el / goal)}<div class="c"><b data-fs-clock>${clock(el)}</b><span>из ${f.hours % 24 === 0 && f.hours >= 48 ? f.hours / 24 + " суток" : f.hours + " ч"}</span></div></div>
      <div class="fs-info"><div class="fs-st">${rest > 0 ? st[1] : "Готово"}</div><div class="small muted">${rest > 0 ? st[2] : "Вы справились. Первая еда — лёгкая и небольшая."}</div>
        <div class="fs-kv"><span>${rest > 0 ? "Осталось" : "Цель"}</span><b data-fs-left>${rest > 0 ? left(rest) : durLabel(f.hours)}</b></div>
        <div class="fs-kv"><span>Конец</span><b>${when(endOf(f))}</b></div></div>
    </div>
    ${timeline(f, elH)}
    <div class="fs-water">${ico(IC.drop, 16)}<div class="grow"><b>${liters(wl)} л</b> <span class="muted small">воды с начала${f.hours >= 20 ? ` · стоит около ${liters(wNeed)} л` : ""}</span></div><button class="btn small hl-blue" data-water="250">+250 мл</button></div>
    ${f.hours > 24 ? safetyHTML(Math.min(f.hours, WARN_H), "mini") : ""}
    <div class="btns" style="margin-top:10px"><button class="btn small" data-fs="more">Подробнее</button><button class="btn small ${rest > 0 ? "" : "primary"}" data-fs="stop">${rest > 0 ? "Прервать" : "Поел — закончить"}</button></div>`
}
function idleHTML() {
  const last = live(D.fast).filter(x => x.end).sort((a, b) => b.end - a.end)[0]
  const lastH = last ? (last.end - last.start) / 3600e3 : 0, fresh = last && Date.now() - last.end < 24 * 3600e3 && lastH >= 24
  return `<div class="fs-opts">
      <button class="fs-opt day" data-fs="24"><b>Сутки</b><span>24 часа</span></button>
      <button class="fs-opt" data-fs="16"><b>16:8</b><span>16 часов</span></button>
      <button class="fs-opt" data-fs="18"><b>18:6</b><span>18 часов</span></button>
      <button class="fs-opt own" data-fs="own"><b>Своё</b><span>до 7 суток</span></button>
    </div>
    ${fresh ? `<div class="fs-warn l0">${ico(IC.bowl, 16)}<div><b>Выход из голодания</b><div>Вы голодали ${left(last.end - last.start)}. Сегодня ешьте понемногу: бульон, яйца, овощи, кисломолочное. Сладкое и жирное — завтра.</div></div></div>`
      : `<div class="muted small" style="margin-top:10px">${last ? `Прошлое: ${left(last.end - last.start)}, ${dayName(new Date(last.end))}.` : "Нажмите после последней еды. Когда время выйдет — придёт пуш."}</div>`}`
}
fastCard = function () {
  if (isKid()) return ""
  const f = fastNow()
  return `<div class="card hl-in fs-card ${f ? "on" : ""}" id="fast"><h2><span>${ico(IC.timer, 15)} Голодание</span>${f ? `<span class="small fs-tag">${durLabel(f.hours)}</span>` : ""}</h2>${f ? activeHTML(f) : idleHTML()}</div>`
}

// ───────────── Окно запуска: сутки или своё ─────────────
function startSheet(preset) {
  let h = preset || 24, unit = "h", ago = false, ack = false
  const CH = [24, 36, 48, 72]
  const s = sheet(`<h3>Голодание</h3>
    <div class="chips fs-chips">${CH.map(x => `<button class="chip" data-h="${x}">${x === 24 ? "Сутки" : durLabel(x)}</button>`).join("")}</div>
    <div class="fs-own"><div class="field" style="flex:1;margin:0"><label>Своё</label><input id="fs-n" type="number" inputmode="numeric" min="1" placeholder="например, 60"></div>
      <div class="seg" id="fs-u"><button data-u="h">часов</button><button data-u="d">суток</button></div></div>
    <div class="set"><span>Последняя еда</span><div class="seg fs-seg" id="fs-a"><button data-a="0">Сейчас</button><button data-a="1">Раньше</button></div></div>
    <div class="field" id="fs-at" hidden><label>Когда поели в последний раз</label><input id="fs-t" type="datetime-local"></div>
    <div class="fs-sum"></div>
    <div class="fs-safe"></div>
    <label class="fs-ack" hidden><input type="checkbox" id="fs-ok"><span>Я здоров, мне есть 18, и я прочитал предупреждение</span></label>
    <div class="btns"><button class="btn primary wide" data-go>Начать</button></div>`, { onClose: () => render() })
  const $s = q => $(q, s.el)
  const d0 = new Date(Date.now() - 2 * 3600e3), pad = n => z2h(n)
  $s("#fs-t").value = `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}T${pad(d0.getHours())}:${pad(d0.getMinutes())}`
  const startAt = () => { if (!ago) return Date.now(); const t = new Date($s("#fs-t").value).getTime(); return t && t < Date.now() ? t : Date.now() }
  const paint = () => {
    $$(".fs-chips .chip", s.el).forEach(b => b.classList.toggle("on", +b.dataset.h === h && !$s("#fs-n").value))
    $$("#fs-u button", s.el).forEach(b => b.classList.toggle("on", b.dataset.u === unit))
    $$("#fs-a button", s.el).forEach(b => b.classList.toggle("on", (b.dataset.a === "1") === ago)); $s("#fs-at").hidden = !ago
    const over = h > MAX_H, end = startAt() + h * 3600e3
    $s(".fs-sum").innerHTML = over ? `<div class="fs-warn l2">${ico(IC.shield, 16)}<div>Больше 7 суток не ставлю — так долго голодать можно только под присмотром врача.</div></div>`
      : `<div class="fs-sumrow"><div><span>Длительность</span><b>${h === 24 ? "24 часа" : durLabel(h)}</b></div><div><span>Конец</span><b>${end <= Date.now() ? "уже прошло" : when(end)}</b></div></div>`
    $s(".fs-safe").innerHTML = over ? "" : safetyHTML(h)
    $s(".fs-ack").hidden = over || h <= WARN_H
    const can = !over && h >= 1 && end > Date.now() && (h <= WARN_H || ack)
    $s("[data-go]").disabled = !can; $s("[data-go]").textContent = h > WARN_H && !ack ? "Отметьте предупреждение" : `Начать на ${durLabel(h)}`
  }
  const readOwn = () => { const n = parseFloat(String($s("#fs-n").value).replace(",", ".")); if (n > 0) h = Math.round(unit === "d" ? n * 24 : n) }
  $$(".fs-chips .chip", s.el).forEach(b => b.onclick = () => { $s("#fs-n").value = ""; h = +b.dataset.h; if (navigator.vibrate) navigator.vibrate(6); paint() })
  $s("#fs-n").oninput = () => { readOwn(); paint() }
  $$("#fs-u button", s.el).forEach(b => b.onclick = () => { unit = b.dataset.u; readOwn(); paint() })
  $$("#fs-a button", s.el).forEach(b => b.onclick = () => { ago = b.dataset.a === "1"; paint() })
  $s("#fs-t").onchange = paint
  $s("#fs-ok").onchange = e => { ack = e.target.checked; paint() }
  $s("[data-go]").onclick = () => { const f = fastStart(h, { start: startAt(), ack }); s.close(); toast(`Голодание началось · конец ${when(endOf(f))}`) }
  if (preset === "own") { h = 36; setTimeout(() => $s("#fs-n").focus(), 300) }
  paint()
  return s
}

// ───────────── Подробнее: стадии, вода, продлить ─────────────
function moreSheet() {
  const f = fastNow(); if (!f) return
  const elH = (Date.now() - f.start) / 3600e3, cur = stageOf(elH)
  const st = STAGES.filter(x => x[0] < Math.max(f.hours, 1))
  const s = sheet(`<h3>Голодание · ${durLabel(f.hours)}</h3>
    <div class="small muted">Началось ${when(f.start)} · конец ${when(endOf(f))}</div>
    <div class="fs-stages">${st.map((x, i) => `<div class="fs-stage ${i < cur ? "done" : i === cur ? "now" : ""}"><i>${i < cur ? ico(IC.check, 13) : ""}</i><div><b>${x[0] ? x[0] + " ч · " : ""}${x[1]}</b><span>${x[2]}</span></div></div>`).join("")}</div>
    <div class="small muted" style="margin:4px 0 12px">Стадии примерные — у всех по-разному.</div>
    ${safetyHTML(Math.max(f.hours, 20))}
    <h3 style="margin-top:16px">Продлить или сократить</h3>
    <div class="chips fs-chips">${[16, 24, 36, 48, 72].filter(x => x * 3600e3 > Date.now() - f.start).map(x => `<button class="chip ${x === f.hours ? "on" : ""}" data-h="${x}">${durLabel(x)}</button>`).join("")}</div>
    <div class="btns" style="margin-top:14px"><button class="btn red wide" data-stop>Закончить сейчас</button></div>`, { onClose: () => render() })
  $$(".fs-chips .chip", s.el).forEach(b => b.onclick = async () => {
    const h = +b.dataset.h
    if (h > WARN_H && !f.ack && (await ui.confirm("Больше 2 суток", safetyHTML(h), ["Отмена", "Я здоров, продлить"])) !== "Я здоров, продлить") return
    fastExtend(h); s.close(); toast(`Теперь ${durLabel(h)} · конец ${when(f.start + h * 3600e3)}`) })
  $("[data-stop]", s.el).onclick = () => { const r = fastStop(); s.close(); toast(r ? `Голодание: ${left(r.end - r.start)}` : "") }
}

// ───────────── Привязка и живой таймер ─────────────
function bindFast(v) {
  $$("[data-fs]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); const k = b.dataset.fs
    if (k === "16" || k === "18") { const f = fastStart(+k); render(); return toast(`Окно откроется ${when(endOf(f))}`) }
    if (k === "24") return startSheet(24)
    if (k === "own") return startSheet("own")
    if (k === "more") return moreSheet()
    if (k === "stop") { const r = fastStop(); render(); return toast(r ? `Голодание: ${left(r.end - r.start)}` : "") }
  })
  const card = $("#fast.on", v); if (card) card.onclick = ev => { if (!ev.target.closest("button")) moreSheet() }
}
function tick() {
  const f = fastNow(), c = document.querySelector("#fast [data-fs-clock]"); if (!f || !c) return
  const el = Date.now() - f.start, goal = f.hours * 3600e3
  if ((el >= goal) !== (c.dataset.done === "1") && c.dataset.done != null) return render()
  c.dataset.done = el >= goal ? "1" : "0"; c.textContent = clock(el)
  const l = document.querySelector("#fast [data-fs-left]"); if (l && el < goal) l.textContent = left(goal - el)
  const fg = document.querySelector("#fast .fs-ring .fg"); if (fg) fg.style.strokeDashoffset = (+fg.style.getPropertyValue("--c") * (1 - Math.min(1, el / goal))).toFixed(1)
  const bar = document.querySelector("#fast .fs-line .bar i"); if (bar) bar.style.width = Math.min(100, el / goal * 100) + "%"
}

// ───────────── Изи ─────────────
function wrapIzi() {
  const t = AGENT_TOOLS.find(x => x.name === "start_fast")
  if (t) { t.description = "Начать голодание: 16 (16:8), 18, 24 — сутки, или своё до 168 ч (7 суток). started_hours_ago — если человек уже не ест N часов. Больше 48 ч: сначала мягко предупреди (противопоказания, вода и соль, когда прервать) и вызывай с confirm: true только после его «да»."
    t.input_schema = { type: "object", properties: { hours: { type: "number" }, started_hours_ago: { type: "number" }, confirm: { type: "boolean" } } } }
  const run0 = runTool
  runTool = async function (name, x) {
    x = x || {}
    if (name === "start_fast") {
      if (isKid()) return { error: "в детском режиме голодание выключено — детям голодать нельзя" }
      if (fastNow()) return { error: "голодание уже идёт", since: iso(new Date(fastNow().start)), hours: fastNow().hours }
      const h = Math.round(+x.hours || 16)
      if (h > MAX_H) return { error: "больше 7 суток не ставлю — только под присмотром врача", max_hours: MAX_H }
      if (h > WARN_H && !x.confirm) return { need_confirm: true, warning: safety(h).list.join(" "), note: "перескажи мягко и спроси подтверждение" }
      const f = fastStart(h, { start: +x.started_hours_ago > 0 ? Date.now() - x.started_hours_ago * 3600e3 : 0, ack: h > WARN_H })
      return { ok: true, hours: f.hours, started: iso(new Date(f.start)), ends: iso(new Date(endOf(f))), pushes: f.hours >= 20 ? "вода днём, каждые сутки, за час до конца и в конце" : "в конце" }
    }
    return run0.apply(this, arguments)
  }
  const sys0 = agentSystem
  agentSystem = function () {
    return sys0.apply(this, arguments) + `
- Голодание (start_fast / stop_fast): 16:8 и 18:6 — интервальное, «на сутки» — 24 ч, своё — до 7 суток. Дольше 48 ч — мягко предупреди: не при диабете, болезнях сердца и почек, беременности и кормлении, расстройствах пищевого поведения, низком весе и до 18 лет; с лекарствами — к врачу; пить 2–3 л воды с щепоткой соли; прервать при слабости, головокружении, сердцебиении. Больше 3 суток — лучше с врачом. Выход — мягкий: бульон, овощи, маленькие порции. Не стыди за прерывание.`
  }
}

function init() {
  const render0 = render
  render = function () { const out = render0.apply(this, arguments); try { if (tab === "health") bindFast($("#view")) } catch (e) { console.error("fast", e) }; return out }
  const pd0 = planDay
  planDay = function () { const out = pd0.apply(this, arguments); fastNudges(); return out }
  wrapIzi()
  fastNudges()
  setInterval(() => { if (document.visibilityState === "visible") { tick(); fastNudges() } }, 30e3)
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tick() })
  render()
  window.FAST = { fastStart, fastStop, fastExtend, fastNudges, safety, stageOf, startSheet, moreSheet, MAX_H }
}
try { init() } catch (e) { console.error("fast", e) }
})()
