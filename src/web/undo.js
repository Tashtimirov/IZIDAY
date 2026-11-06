// IZIDAY · отмена действия. После удаления, отметки или правки внизу на 5 с появляется плашка «Отменить».
// Как работает: app.js перед каждой записью (upsert) зовёт UNDO.note. Если это ответ на нажатие человека (не фоновый обмен),
// прежняя версия записи берётся из последнего сохранения на телефоне (localStorage — там ещё состояние до действия).
// Всё, что записано за одно нажатие, — одно действие; «Отменить» возвращает прежние версии (с новым временем — уйдёт и в таблицу).
// Плашку можно смахнуть. На iPad с клавиатурой — ⌘Z (последнее действие за минуту). Память Изи и дневник не трогаем: «забыть» — значит забыть.
window.UNDO = (function () {
  const KEYS = new Set(["money", "food", "water", "workouts", "rems", "recur", "habits", "hlog", "weight", "shop", "kids", "fast", "goals", "pomo", "budgets", "nudges"])
  const NO_KIND = new Set(["diary", "hcfg", "vault"])
  const SIDE = r => r && (r.kind === "ach" || r.kind === "quests")   // идут следом за действием: откатываются, но сами плашку не зовут
  const LIFE = 5000, WIN = 1500
  let tap = 0, gest = 0, cur = null, last = null, replay = false, showT = 0, hideT = 0, el = null

  const now = () => performance.now()   // часы страницы могут стоять (тесты) — для «сразу после нажатия» берём счётчик страницы
  const mark = e => { if (e.isTrusted) { tap = now(); gest++ } }
  for (const t of ["pointerup", "click", "touchend"]) addEventListener(t, mark, true)
  addEventListener("keydown", e => {
    if (!e.isTrusted) return
    const z = (e.metaKey || e.ctrlKey) && !e.shiftKey && /^[zя]$/i.test(e.key)
    const f = e.target.closest && e.target.closest("input, textarea, [contenteditable]")
    const text = f && f.isConnected && !(f.tagName === "INPUT" && /^(checkbox|radio|range|button|submit|color|file)$/.test(f.type))
    if (z && !text) {   // в поле ввода ⌘Z — родная отмена текста
      if (last && !last.done && now() - last.at < 60e3) { e.preventDefault(); undo(last) }
      return
    }
    if (e.key === "Enter" || e.key === " ") mark(e)
  }, true)

  function base() { try { return JSON.parse(localStorage.getItem(STORE) || "{}") || {} } catch (e) { return {} } }
  const same = (a, b) => { const c = x => JSON.stringify(Object.assign({}, x, { u: 0 })); return c(a) === c(b) }

  function note(key, rec) {
    if (replay || !rec || rec.id == null || !KEYS.has(key) || now() - tap > WIN) return
    if (cur && cur.g !== gest && cur.items.size && !cur.shown) flush(cur)
    if (!cur || cur.g !== gest || cur.done) cur = { g: gest, at: now(), base: base(), items: new Map(), label: "", shown: false, done: false }
    const k = key + "\u0001" + rec.id
    if (cur.items.has(k)) return
    const prev = (cur.base[key] || []).find(x => x && x.id === rec.id) || null
    if (NO_KIND.has(rec.kind) || NO_KIND.has(prev && prev.kind)) return
    if (!prev && rec.kind === "quests") return   // задания дня создаются сами
    cur.items.set(k, { key, id: rec.id, prev })
    const b = cur
    clearTimeout(showT); showT = setTimeout(() => flush(b), 280)
  }

  // ── что изменилось: для подписи на плашке
  const nowRec = it => (D[it.key] || []).find(x => x && x.id === it.id) || null
  const alive = r => r && !r.deleted
  function titleOf(key, r) {
    if (!r) return ""
    if (key === "hlog") { const h = (D.habits || []).find(x => x.id === r.habit); return h ? h.title : "" }
    if (key === "water") return r.ml ? `${r.ml} мл воды` : "Вода"
    if (key === "money") return [r.comment || r.category, r.amount ? (typeof core !== "undefined" && core.money ? core.money(r.amount) : r.amount) : ""].filter(Boolean).join(" ")
    if (key === "weight") return r.kg ? `${r.kg} кг` : "Вес"
    if (key === "fast") return "Голодание"
    if (key === "pomo") return "Помидор"
    return String(r.title || r.text || r.t || r.name || "").trim()
  }
  function arrDiff(p, c) {
    for (const f of ["items", "steps", "list"]) {
      const a = Array.isArray(p && p[f]) ? p[f] : null, b = Array.isArray(c && c[f]) ? c[f] : null
      if (!a || !b) continue
      const id = x => x && (x.id != null ? x.id : x.t || x.title)
      const t = x => String((x && (x.t || x.title || x.text)) || "")
      const gone = a.find(x => !b.some(y => id(y) === id(x)) || (b.find(y => id(y) === id(x)) || {}).deleted && !x.deleted)
      if (gone) return ["Удалено", t(gone)]
      const add = b.find(y => !a.some(x => id(x) === id(y)))
      if (add) return ["Добавлено", t(add)]
      for (const y of b) { const x = a.find(z => id(z) === id(y)); if (x && !!x.done !== !!y.done) return [y.done ? "Отмечено" : "Снята отметка", t(y)] }
    }
    return null
  }
  function describe(it) {
    const p = it.prev, c = nowRec(it)
    if (!alive(p) && alive(c)) return [it.key === "hlog" ? "Отмечено" : "Добавлено", titleOf(it.key, c)]
    if (alive(p) && !alive(c)) return [it.key === "hlog" ? "Снята отметка" : "Удалено", titleOf(it.key, p)]
    if (!alive(p) && !alive(c)) return null
    if (same(p, c)) return null
    if (!p.archived && c.archived || !p.off && c.off) return ["Убрано", titleOf(it.key, c)]
    if (!!p.done !== !!c.done) return [c.done ? "Выполнено" : "Снята отметка", titleOf(it.key, c)]
    if (it.key === "rems" && p.due !== c.due && !c.done) return ["Перенесено", titleOf(it.key, c)]
    const d = arrDiff(p, c)
    if (d) return [d[0], d[1] || titleOf(it.key, c)]
    return ["Изменено", titleOf(it.key, c)]
  }
  function main(b) {
    const out = []
    for (const it of b.items.values()) {
      if (it.key === "nudges" || SIDE(it.prev) || SIDE(nowRec(it))) continue
      const d = describe(it); if (d) out.push(Object.assign({ key: it.key }, { v: d[0], t: d[1] }))
    }
    return out
  }
  // привычку снять можно тем же нажатием — плашка для неё лишняя
  const worth = m => m.length && !m.every(x => x.key === "hlog")

  // ── подпись: из всплывающей подсказки этого же действия («Выполнено», «Убрано») или из записи
  function toast(t) {
    const b = cur
    if (!b || b.done || now() - b.at > 900 || !worth(main(b))) return false
    b.label = String(t)
    if (b.shown) paint(b)
    return true
  }
  function labelOf(b) {
    const m = main(b), f = m[0] || { v: "Изменено", t: "" }
    let v = b.label ? b.label.replace(/^\s*(✓|✅|🗑|🔥|🍅)️?\s*/u, "") : f.v
    let t = f.t && !v.includes(f.t) ? f.t : ""
    if (m.length > 1) t = (t ? t + " " : "") + `и ещё ${m.length - 1}`
    return { v, t }
  }

  function bar() {
    if (el) return el
    el = document.createElement("div"); el.id = "undo"; el.setAttribute("role", "status")
    el.innerHTML = '<span class="u-tx"></span><button class="u-btn">Отменить</button><i class="u-line"></i>'
    document.body.appendChild(el)
    el.querySelector(".u-btn").onclick = e => { e.stopPropagation(); if (el._b) undo(el._b) }
    // смахнуть в сторону или вниз; палец на плашке — отсчёт на паузе
    let x0 = null, y0 = 0, dx = 0, dy = 0
    el.addEventListener("touchstart", e => { if (e.target.closest(".u-btn")) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = dy = 0; el.classList.add("drag"); pause(true) }, { passive: true })
    el.addEventListener("touchmove", e => { if (x0 == null) return; dx = e.touches[0].clientX - x0; dy = Math.max(0, e.touches[0].clientY - y0)
      el.style.setProperty("--dx", dx + "px"); el.style.setProperty("--dy", dy + "px"); el.style.opacity = String(Math.max(0, 1 - Math.max(Math.abs(dx) / 220, dy / 90))) }, { passive: true })
    const up = () => { if (x0 == null) return; x0 = null; el.classList.remove("drag")
      if (Math.abs(dx) > 70 || dy > 36) { el.classList.add("away"); el.style.setProperty("--dx", (dx === 0 ? 0 : Math.sign(dx) * 420) + "px"); hide(0) }
      else { el.style.removeProperty("--dx"); el.style.removeProperty("--dy"); el.style.opacity = ""; pause(false) } }
    el.addEventListener("touchend", up, { passive: true }); el.addEventListener("touchcancel", up, { passive: true })
    return el
  }
  function paint(b) {
    const { v, t } = labelOf(b)
    el.querySelector(".u-tx").innerHTML = `<b>${deEmo(esc(v))}</b>${t ? `<span>${esc(t)}</span>` : ""}`
  }
  let left = 0, startT = 0
  function pause(on) {
    if (!el || !el._b) return
    if (on) { clearTimeout(hideT); left = Math.max(800, left - (now() - startT)); el.classList.add("hold") }
    else { el.classList.remove("hold"); startT = now(); hideT = setTimeout(() => hide(), left); el.querySelector(".u-line").style.animationDuration = "" }
  }
  function flush(b) {
    if (b.done || b.shown) return
    const m = main(b)
    if (!m.length) return
    last = b
    if (!worth(m)) return
    b.shown = true
    bar(); el._b = b
    el.classList.toggle("top", !!document.querySelector("#layer .sheet"))   // открыто окно снизу — плашка сверху, чтобы не закрывать его
    el.classList.remove("away", "ok", "drag", "hold"); el.style.removeProperty("--dx"); el.style.removeProperty("--dy"); el.style.opacity = ""
    paint(b)
    document.getElementById("toast")?.classList.remove("show")
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show")
    clearTimeout(hideT); left = LIFE; startT = now(); hideT = setTimeout(() => hide(), LIFE)
  }
  function hide(ms = 0) {
    clearTimeout(hideT)
    hideT = setTimeout(() => { if (!el) return; el.classList.remove("show"); el._b = null }, ms)
  }

  function undo(b) {
    if (!b || b.done) return
    b.done = true; clearTimeout(showT)
    if (cur === b) cur = null
    replay = true
    try {
      for (const it of [...b.items.values()].reverse()) {
        if (alive(it.prev)) upsert(it.key, JSON.parse(JSON.stringify(it.prev)))
        else if (alive(nowRec(it))) remove(it.key, it.id)
      }
      try { if (typeof medNudges === "function") medNudges() } catch (e) {}
      try { if (typeof fastNudges === "function") fastNudges() } catch (e) {}
    } finally { replay = false }
    save()
    if (navigator.vibrate) navigator.vibrate(10)
    try { render() } catch (e) {}
    try { if (typeof undoRedraw === "function") undoRedraw() } catch (e) {}
    if (el && el._b === b) {
      el.classList.add("ok")
      el.querySelector(".u-tx").innerHTML = `<b>${ei("check")}Отменено</b>`
      hide(1300)
    }
  }
  return { note, toast, undo, get last() { return last } }
})()
