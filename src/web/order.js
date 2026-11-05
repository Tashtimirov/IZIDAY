// IZIDAY · порядок блоков в разделах «Сегодня», «Планы», «Деньги», «Здоровье».
// Удерживайте блок ~0,4 с — он приподнимается; ведите пальцем, остальные плавно расступаются; отпустите — порядок
// запоминается на телефоне (D.blocks[раздел] = ключи блоков). Код разделов не трогаем: после каждой отрисовки
// расставляем готовые блоки #view в сохранённом порядке. Новые блоки, которых нет в сохранённом списке, встают на своё
// обычное место — сразу за тем блоком, за которым стоят по умолчанию. Навигация (лента дней, фильтры, переключатели,
// кнопки отчётов) не двигается. Подключается последним: его обёртка render — самая внешняя.
window.BLOCKS = (function () {
  const TABS = ["today", "plans", "money", "health"]
  const FIX = ".month, .wnav, .strip, .chips, .seg, .btns, .banner"
  const NO_HOLD = "input, textarea, select, [contenteditable], [data-tpl], #strip, .bk-nohold"
  const GENERIC = new Set(["card", "mn-in", "hl-in", "hl-tip", "empty", "gnew", "pending", "gone", "on", "anim", "bk-lift"])
  const HOLD = 420, SLOP = 9
  const $v = () => document.getElementById("view")
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches
  const scope = () => (document.body.classList.contains("kidm") ? "kid:" : "") + tab
  const on = () => TABS.includes(tab) && !document.body.classList.contains("chat")

  // ── ключ блока: id → отличительный класс → заголовок без цифр и кнопок
  function head(el) {
    const h = el.querySelector("h2, .dh-t, .k")
    if (!h) return ""
    const c = h.cloneNode(true)
    c.querySelectorAll("button, .act, .muted, .hl-h2r, b, svg").forEach(x => x.remove())
    return c.textContent.replace(/[\d−+.,:·%]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 32)
  }
  function keyOf(el) {
    if (el.id) return "#" + el.id
    const c = [...el.classList].find(c => !GENERIC.has(c))
    if (c && !(el.classList.contains("card") && c === "card")) return "." + c
    return head(el) || el.tagName.toLowerCase()
  }
  const movable = el => el.nodeType === 1 && !el.matches(FIX) && el.offsetParent !== null
  function blocks(v = $v()) {
    const list = [...v.children].filter(movable), seen = {}
    for (const el of list) { const k = keyOf(el); seen[k] = (seen[k] || 0) + 1; el.dataset.bk = seen[k] > 1 ? k + "~" + seen[k] : k }
    return list
  }

  // ── сохранённый порядок + блоки, которых в нём нет (встают за своим соседом по умолчанию)
  function merge(def, saved) {
    const s = new Set(saved), res = saved.filter(k => def.includes(k))
    let anchor = null
    for (const k of def) {
      if (s.has(k)) { anchor = k; continue }
      res.splice(anchor == null ? 0 : res.indexOf(anchor) + 1, 0, k); anchor = k
    }
    return res
  }
  const store = () => (D.blocks && typeof D.blocks === "object" && !Array.isArray(D.blocks)) ? D.blocks : (D.blocks = {})
  // переставить блоки в нужном порядке: двигаем только сами блоки, навигация остаётся на своём месте
  function arrange(v, list, order) {
    const by = Object.fromEntries(list.map(el => [el.dataset.bk, el])), want = order.map(k => by[k]).filter(Boolean)
    if (want.length !== list.length || want.every((el, i) => el === list[i])) return false
    // группы подряд идущих блоков между неподвижными элементами — сохраняем их размеры
    const groups = [], kids = [...v.children]
    let g = null
    for (const el of kids) {
      if (list.includes(el)) { if (!g) groups.push(g = { n: 0, before: null }); g.n++ }
      else if (g) { g.before = el; g = null }
    }
    let i = 0
    for (const gr of groups) for (let j = 0; j < gr.n; j++, i++) v.insertBefore(want[i], gr.before)
    return true
  }
  function apply() {
    const v = $v()
    if (!v || !on()) return
    const list = blocks(v), saved = store()[scope()]
    if (!Array.isArray(saved) || !saved.length) return
    arrange(v, list, merge(list.map(el => el.dataset.bk), saved))
  }

  // ── перетаскивание
  let hold = null, drag = null, eatClick = 0, pendingRender = false
  const zoomOf = el => parseFloat(getComputedStyle(el).zoom) || 1
  function start(e, x, y, touch) {
    if (drag || hold) return
    const v = $v()
    if (!v || !on() || !e.target.closest || e.target.closest(NO_HOLD)) return
    let el = e.target
    while (el && el.parentElement !== v) el = el.parentElement
    if (!el || !movable(el)) return
    const list = blocks(v)
    if (list.length < 2) return
    hold = { el, x0: x, y0: y, x, y, touch, t: setTimeout(() => lift(), HOLD), p: setTimeout(() => el.classList.add("bk-press"), 110) }
  }
  function cancelHold() { if (!hold) return; clearTimeout(hold.t); clearTimeout(hold.p); hold.el.classList.remove("bk-press"); hold = null }

  function lift() {
    const h = hold; hold = null
    if (!h || !h.el.isConnected) return
    const v = $v(), el = h.el
    clearTimeout(h.p); el.classList.remove("bk-press")
    v.classList.remove("anim"); v.classList.add("bk-on", "bk-done")
    const r = el.getBoundingClientRect()
    drag = { el, v, x0: h.x, y0: h.y, x: h.x, y: h.y, cx0: r.left + r.width / 2, cy0: r.top + r.height / 2, tx: 0, ty: 0, z: zoomOf(el), raf: 0, cool: 0, touch: h.touch, dirty: 0 }
    // края для автопрокрутки — один раз, чтобы в каждом кадре не пересчитывать раскладку
    const vr = v.getBoundingClientRect(), tabs = document.getElementById("tabs"), topEl = document.getElementById("top")
    drag.bottom = Math.min(vr.bottom, innerHeight, tabs ? tabs.getBoundingClientRect().top : innerHeight)
    drag.top = Math.max(vr.top, topEl ? topEl.getBoundingClientRect().bottom : 0)
    el.classList.add("bk-lift")
    snapshot()
    drag.keys0 = drag.list.map(b => b.dataset.bk).join("|")
    try { if (window.DS && DS.buzz) DS.buzz() } catch (e) {}
    if (navigator.vibrate) navigator.vibrate(12)
    tickLoop()
  }
  // места блоков без сдвигов (в координатах содержимого #view) — по ним решаем, куда вставить
  function snapshot() {
    const { v } = drag, st = v.scrollTop
    drag.list = blocks(v)
    // один пересчёт раскладки на все блоки: сдвиг снимаем только у блока в руке (у остальных он уже снят)
    const el0 = drag.el, tr = el0.style.transform
    el0.style.transform = ""
    drag.rects = new Map(drag.list.map(el => { const r = el.getBoundingClientRect(); return [el, { l: r.left, t: r.top + st, w: r.width, h: r.height }] }))
    el0.style.transform = tr
    const me = drag.rects.get(drag.el)
    drag.lcx = me.l + me.w / 2; drag.lcy = me.t + me.h / 2   // центр блока в раскладке (без сдвига), в координатах содержимого
  }
  function follow() {
    const d = drag, el = d.el
    // центр блока держим под пальцем: смещение = путь пальца − сдвиг самого блока в раскладке
    // без чтения раскладки в каждом кадре: место блока известно из снимка, меняется только прокрутка
    d.tx = (d.cx0 + (d.x - d.x0) - d.lcx) / d.z
    d.ty = (d.cy0 + (d.y - d.y0) - (d.lcy - d.v.scrollTop)) / d.z
    el.style.transform = `translate3d(${Math.round(d.tx * 10) / 10}px, ${Math.round(d.ty * 10) / 10}px, 0)`
  }
  function move(x, y) {
    const d = drag
    d.x = x; d.y = y
    follow()
    if (d.cool) return
    const st = d.v.scrollTop, me = d.rects.get(d.el), i = d.list.indexOf(d.el)
    for (const [el, r] of d.rects) {
      if (el === d.el) continue
      const top = r.t - st
      if (x < r.l || x > r.l + r.w || y < top || y > top + r.h) continue
      const j = d.list.indexOf(el), row = r.l >= me.l + me.w - 4 || r.l + r.w <= me.l + 4   // рядом по горизонтали (две колонки на iPad)
      const past = j > i ? (row ? x > r.l + r.w / 2 : y > top + r.h / 2) : (row ? x < r.l + r.w / 2 : y < top + r.h / 2)
      if (!past) break
      const order = d.list.filter(b => b !== d.el).map(b => b.dataset.bk)
      order.splice(j > i ? order.indexOf(el.dataset.bk) + 1 : order.indexOf(el.dataset.bk), 0, d.el.dataset.bk)
      reorder(order)
      break
    }
  }
  // FLIP: запомнили, где блоки сейчас, переставили, и плавно довели их с прежнего места на новое
  function reorder(order) {
    const d = drag, others = d.list.filter(b => b !== d.el)
    const first = new Map(others.map(b => [b, b.getBoundingClientRect()]))
    if (!arrange(d.v, d.list, order)) return
    for (const b of others) { b.style.transition = "none"; b.style.transform = "" }
    snapshot()
    for (const b of others) {
      const a = first.get(b), r = b.getBoundingClientRect(), z = zoomOf(b)
      const dx = (a.left - r.left) / z, dy = (a.top - r.top) / z
      if (!dx && !dy) continue
      b.style.transform = `translate(${dx}px, ${dy}px)`
    }
    void d.v.offsetWidth
    // как на iPhone: мягкая «пружина» без отскока — быстро трогается и долго, плавно доезжает
    for (const b of others) { b.style.transition = reduce() ? "none" : "transform .42s cubic-bezier(.22,1,.36,1)"; b.style.transform = "" }
    follow()
    d.cool = 1; setTimeout(() => { if (drag === d) { d.cool = 0; d.dirty = 1 } }, 120)
    try { if (window.DS && DS.buzz) DS.buzz() } catch (e) {}
  }
  // у края экрана — листаем сами
  function tickLoop() {
    const d = drag
    if (!d) return
    const top = d.top, bottom = d.bottom
    let sp = 0
    if (d.y < top + 70) sp = -Math.min(18, (top + 70 - d.y) / 3)
    else if (d.y > bottom - 80) sp = Math.min(18, (d.y - bottom + 80) / 3)
    if (sp) { const s0 = d.v.scrollTop; d.v.scrollTop += sp; if (d.v.scrollTop !== s0) d.dirty = 1 }
    // движения пальца копятся и применяются раз в кадр экрана (60/120 Гц) — без лишней работы между кадрами
    if (d.dirty) { d.dirty = 0; move(d.x, d.y) }
    d.raf = requestAnimationFrame(tickLoop)
  }
  function drop() {
    const d = drag
    if (!d) return
    drag = null
    cancelAnimationFrame(d.raf)
    const el = d.el
    el.style.transition = reduce() ? "none" : "transform .46s cubic-bezier(.22,1.12,.36,1), scale .46s cubic-bezier(.22,1.12,.36,1), box-shadow .46s"
    el.style.transform = ""
    el.classList.remove("bk-lift")
    eatClick = 1; clearTimeout(drop.t); drop.t = setTimeout(() => { eatClick = 0 }, 500)
    const keys = blocks(d.v).map(b => b.dataset.bk), S = store(), old = Array.isArray(S[scope()]) ? S[scope()] : null
    const next = old ? merge(old, keys) : keys
    const moved = keys.join("|") !== d.keys0
    if (moved) S[scope()] = next
    setTimeout(() => {
      for (const b of d.list) { b.style.transition = ""; if (b !== drag?.el) b.style.transform = "" }
      d.v.classList.remove("bk-on")
      if (moved) { save(false); hint(true) }   // запись на телефон — после того как блок сел на место, чтобы не мешать анимации
      if (pendingRender) { pendingRender = false; render() }
    }, 480)
  }
  function end() { if (drag) drop(); else cancelHold() }

  // касание
  document.addEventListener("touchstart", e => { if (e.touches.length > 1) return end(); const t = e.touches[0]; start(e, t.clientX, t.clientY, true) }, { passive: true })
  document.getElementById("view").addEventListener("touchmove", e => {
    const t = e.touches[0]
    if (drag) { e.preventDefault(); drag.x = t.clientX; drag.y = t.clientY; drag.dirty = 1; return }
    if (hold && Math.hypot(t.clientX - hold.x0, t.clientY - hold.y0) > SLOP) cancelHold()
  }, { passive: false })
  document.addEventListener("touchend", end, { passive: true })
  document.addEventListener("touchcancel", end, { passive: true })
  // мышь (компьютер, iPad с мышью)
  document.addEventListener("pointerdown", e => { if (e.pointerType === "mouse" && e.button === 0) start(e, e.clientX, e.clientY, false) })
  document.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return
    if (drag && !drag.touch) { e.preventDefault(); drag.x = e.clientX; drag.y = e.clientY; drag.dirty = 1 }
    else if (hold && !hold.touch && Math.hypot(e.clientX - hold.x0, e.clientY - hold.y0) > SLOP) cancelHold()
  })
  document.addEventListener("pointerup", e => { if (e.pointerType === "mouse") end() })
  // после долгого нажатия нажатие внутри блока не срабатывает; меню «скопировать/поделиться» не всплывает
  document.addEventListener("click", e => { if (eatClick && e.isTrusted) { e.preventDefault(); e.stopPropagation(); eatClick = 0 } }, true)
  document.addEventListener("contextmenu", e => { if (hold || drag) e.preventDefault() }, true)
  document.addEventListener("selectstart", e => { if (drag) e.preventDefault() }, true)

  // ── подсказка: один раз, когда человек впервые зашёл в раздел с блоками (и не раньше знакомства)
  function hint(done) {
    if (D.blocksHint) return
    if (done) { D.blocksHint = Date.now(); save(false); toast("Порядок запомнен. Вернуть как было — в Настройках"); return }
    const o = D.onb || {}
    if (!o.intro || !on() || tab === "today" && !(o.steps && (o.steps.done || o.steps.hide))) return
    clearTimeout(hint.t)
    hint.t = setTimeout(() => { if (!D.blocksHint && on() && !drag) { D.blocksHint = Date.now(); save(false); toast("Блоки можно менять местами: удерживайте блок и ведите") } }, 2500)
  }

  // ── Настройки: вернуть порядок как было
  function card() {
    const n = Object.keys(store()).filter(k => (store()[k] || []).length).length
    return `<div class="card bk-set"><h2>Порядок блоков</h2><div class="small muted">Удерживайте любой блок в разделах «Сегодня», «Планы», «Деньги» и «Здоровье» и перетащите его — порядок запомнится.</div>
      ${n ? `<div class="btns" style="margin-top:10px"><button class="btn small" data-do="bk-reset">Вернуть как было</button></div>` : ""}</div>`
  }

  document.addEventListener("DOMContentLoaded", () => {
    try {
      const more0 = renderMore
      renderMore = function () { const html = more0.apply(this, arguments), i = html.indexOf('<div class="card"><h2>Связь с виджетом'); return i < 0 ? html + card() : html.slice(0, i) + card() + html.slice(i) }
      const render0 = render
      render = function () {
        if (drag) { pendingRender = true; return }   // пока блок в руке, экран не перерисовываем
        const v = $v(), first = v && v.firstElementChild
        const out = render0.apply(this, arguments)
        try {
          if (v && v.firstElementChild !== first) v.classList.remove("bk-done")
          apply()
          if (on()) hint(false)
          const b = v && v.querySelector('[data-do="bk-reset"]')
          if (b) b.onclick = ev => { ev.stopPropagation(); D.blocks = {}; save(false); toast("Порядок блоков — как было"); lastHTML = ""; render() }
        } catch (e) { console.error("blocks", e) }
        return out
      }
      render()
    } catch (e) { console.error("blocks", e) }
  })
  return { apply, merge, keyOf, blocks, scope }
})()
