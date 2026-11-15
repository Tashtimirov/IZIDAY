// IZIDAY · порядок блоков в разделах «Сегодня», «Планы», «Деньги», «Здоровье».
// Удерживайте блок ~0,4 с — он приподнимается; ведите пальцем, остальные плавно расступаются; отпустите — порядок
// запоминается на телефоне (D.blocks[раздел] = ключи блоков). Код разделов не трогаем: после каждой отрисовки
// расставляем готовые блоки #view в сохранённом порядке. Новые блоки, которых нет в сохранённом списке, встают на своё
// обычное место — сразу за тем блоком, за которым стоят по умолчанию. Навигация (лента дней, фильтры, переключатели,
// кнопки отчётов) не двигается. Подключается последним: его обёртка render — самая внешняя.
// Убрать и вернуть: удержали блок и отпустили, не двигая (или «Изменить блоки» внизу раздела) — у блоков появляется «−».
// Убранный блок плавно уходит в «Скрытые блоки» внизу раздела, оттуда «+» возвращает его на прежнее место.
// Скрытые хранятся в D.blocksOff[раздел] = { ключ: название }.
window.BLOCKS = (function () {
  const TABS = ["today", "plans", "money", "health"]
  const FIX = ".month, .wnav, .strip, .chips, .seg, .btns, .banner, .bk-tray, .bk-foot, .ft-tray, .ft-hint, .ft-show, .ft-ops"
  const NO_HOLD = "input, textarea, select, [contenteditable], [data-tpl], #strip, .bk-nohold, .bk-rm, .bk-tray, .bk-foot, .ft-tray, .ft-hint, .ft-show, .ft-ops"
  const GENERIC = new Set(["card", "mn-in", "hl-in", "hl-tip", "empty", "gnew", "pending", "gone", "on", "anim"])
  const HOLD = 420, HOLD_EDIT = 180, SLOP = 9
  const EASE = "cubic-bezier(.22,1,.36,1)"
  // названия блоков без заголовка
  const NAMES = { ".daycard": "События дня", ".gizi": "Новое в игре", ".gstrip": "Баллы и ранг", ".hero-now": "Что дальше", ".hero-eve": "Вечер",
    ".rings-card": "Кольца дня", ".top3": "Три главных", ".gq": "Задания дня", ".mn-hero": "Можно потратить сегодня", ".mn-tot": "Итог месяца",
    ".mn-ops": "Операции", ".hl-hero": "Готовность", ".tip-card": "Подсказка Изи", "#pomo": "Помидоро" }
  const SVG = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="${d}"/></svg>`
  const MINUS = SVG("M7 12h10"), PLUS = SVG("M12 7v10M7 12h10")
  const PEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><path d="M16.5 13.5v6M13.5 16.5h6"/></svg>'
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
    const c = [...el.classList].find(c => !GENERIC.has(c) && !c.startsWith("bk-"))
    if (c && !(el.classList.contains("card") && c === "card")) return "." + c
    return head(el) || el.tagName.toLowerCase()
  }
  const movable = el => el.nodeType === 1 && !el.matches(FIX) && el.offsetParent !== null
  // all = вместе со скрытыми (нумерация ключей одна и та же, есть скрытые или нет)
  function blocks(v = $v(), all) {
    const list = [...v.children].filter(el => el.nodeType === 1 && !el.matches(FIX) && (el.offsetParent !== null || el.classList.contains("bk-hid"))), seen = {}
    for (const el of list) { const k = keyOf(el); seen[k] = (seen[k] || 0) + 1; el.dataset.bk = seen[k] > 1 ? k + "~" + seen[k] : k }
    return all ? list : list.filter(el => !el.classList.contains("bk-hid"))
  }
  function title(el) {
    const k = (el.dataset.bk || "").replace(/~\d+$/, "")
    if (NAMES[k]) return NAMES[k]
    const h = el.querySelector("h2, .dh-t, .k")
    if (h) {
      const c = h.cloneNode(true)
      c.querySelectorAll("button, .act, .muted, .hl-h2r, svg").forEach(x => x.remove())
      const t = c.textContent.replace(/\s+/g, " ").trim()
      if (t) return t.slice(0, 40)
    }
    return "Блок"
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
  const offs = () => (D.blocksOff && typeof D.blocksOff === "object" && !Array.isArray(D.blocksOff)) ? D.blocksOff : (D.blocksOff = {})
  const offOf = (s = scope()) => { const o = offs()[s]; return o && typeof o === "object" ? o : {} }
  function apply() {
    const v = $v()
    if (!v || !on()) return
    const list = blocks(v, true), saved = store()[scope()], off = offOf()
    for (const el of list) el.classList.toggle("bk-hid", !!off[el.dataset.bk])
    if (Array.isArray(saved) && saved.length) arrange(v, list, merge(list.map(el => el.dataset.bk), saved))
    if (edit) decorate(); else foot()
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
    hold = { el, x0: x, y0: y, x, y, touch, t: setTimeout(() => lift(), edit ? HOLD_EDIT : HOLD), p: setTimeout(() => el.classList.add("bk-press"), 110) }
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
    // удержали и отпустили, не двигая, — как на iPhone: включается правка раздела
    if (!moved && !edit) setTimeout(() => { if (!drag) enter(d.el) }, 200)
    setTimeout(() => {
      for (const b of d.list) { b.style.transition = ""; if (b !== drag?.el) b.style.transform = "" }
      d.v.classList.remove("bk-on")
      if (moved) { save(false); hint(true) }   // запись на телефон — после того как блок сел на место, чтобы не мешать анимации
      if (pendingRender) { pendingRender = false; render() }
    }, 480)
  }
  function end() { if (drag) drop(); else cancelHold() }

  // ── правка раздела: «−» у блоков, внизу — скрытые блоки с «+», сверху над меню — «Готово»
  let edit = false, editTab = null, pill = null
  function enter(from) {
    const v = $v()
    if (!v || !on() || edit) return
    edit = true; editTab = scope()
    v.classList.remove("anim"); v.classList.add("bk-done")
    const f = v.querySelector(":scope > .bk-foot")
    if (f) f.remove()
    decorate(true)
    if (!pill) {
      pill = document.createElement("div"); pill.id = "bk-pill"
      pill.innerHTML = `<button type="button">Готово</button>`
      pill.firstChild.onclick = e => { e.stopPropagation(); leave() }
      document.body.appendChild(pill)
    }
    requestAnimationFrame(() => pill.classList.add("show"))
    try { if (window.DS && DS.buzz) DS.buzz() } catch (e) {}
    if (!from) { const t = v.querySelector(":scope > .bk-tray"); if (t) setTimeout(() => t.scrollIntoView({ block: "nearest", behavior: reduce() ? "auto" : "smooth" }), 60) }
  }
  function leave() {
    if (!edit) return
    edit = false; editTab = null
    const v = $v()
    if (pill) pill.classList.remove("show")
    if (!v) return
    v.querySelectorAll(":scope > * > .bk-rm").forEach(b => b.remove())
    const t = v.querySelector(":scope > .bk-tray")
    if (t && !reduce()) { const a = t.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(8px)" }], { duration: 200, easing: "ease-out" }); a.onfinish = () => { t.remove(); foot() } }
    else { if (t) t.remove(); foot() }
    v.classList.remove("bk-edit")
  }
  function decorate(first) {
    const v = $v()
    if (!v) return
    v.classList.add("bk-edit")
    for (const el of blocks(v)) addRm(el, first)
    tray()
  }
  function addRm(el, anim) {
    if (el.querySelector(":scope > .bk-rm")) return
    const b = document.createElement("button")
    b.type = "button"; b.className = "bk-rm"; b.innerHTML = MINUS
    b.setAttribute("aria-label", "Убрать блок «" + title(el) + "»")
    el.appendChild(b)
    if (anim && !reduce()) b.animate([{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 360, easing: "cubic-bezier(.3,1.5,.5,1)" })
  }
  function tray(fresh) {
    const v = $v()
    if (!v) return
    let t = v.querySelector(":scope > .bk-tray")
    if (!t) { t = document.createElement("div"); t.className = "bk-tray" }
    if (t !== v.lastElementChild) v.appendChild(t)
    const off = offOf(), ks = Object.keys(off)
    t.innerHTML = `<div class="bk-tray-h">Скрытые блоки</div>` + (ks.length
      ? `<div class="bk-list">${ks.map(k => `<button type="button" class="bk-add" data-bk-add="${esc(k)}"><i>${PLUS}</i><span>${esc(off[k])}</span></button>`).join("")}</div>`
        + `<div class="bk-tray-n">Напоминания и подсказки по скрытым блокам не приходят. Данные сохранены — вернёте блок, и всё будет на месте.</div>`
      : `<div class="bk-tray-e">Нажмите «−» у блока, который не нужен. Он появится здесь, и его можно будет вернуть. Пока блок скрыт, напоминания и подсказки по нему не приходят.</div>`)
    if (fresh && !reduce()) { const r = t.querySelector(`[data-bk-add="${CSS.escape(fresh)}"]`); if (r) r.animate([{ opacity: 0, transform: "scale(.92) translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: EASE }) }
  }
  // кнопка внизу раздела — вход в правку без долгого нажатия
  function foot() {
    const v = $v()
    if (!v || !on() || edit) return
    let f = v.querySelector(":scope > .bk-foot")
    if (!f) { f = document.createElement("div"); f.className = "bk-foot"; f.innerHTML = `<button type="button">${PEN}<span>Изменить блоки</span></button>`; f.firstChild.onclick = e => { e.stopPropagation(); enter() } }
    if (f !== v.lastElementChild) v.appendChild(f)
  }
  // FLIP для всех блоков раздела: запомнили места → изменили → плавно довели
  function flip(change) {
    const v = $v(), was = new Map([...v.children].map(b => [b, b.getBoundingClientRect()]))
    change()
    if (reduce()) return
    for (const b of v.children) {
      const a = was.get(b)
      if (!a || b.classList.contains("bk-hid")) continue
      const r = b.getBoundingClientRect(), z = zoomOf(b), dx = (a.left - r.left) / z, dy = (a.top - r.top) / z
      if (Math.abs(dx) < .5 && Math.abs(dy) < .5) continue
      b.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 460, easing: EASE })
    }
  }
  // скрытый блок — без подсказок и пушей по нему (app.js tipsSync); данные блока не трогаем
  const sync = () => { try { if (window.tipsSync) tipsSync() } catch (e) {} }
  function hide(el) {
    const k = el.dataset.bk, s = scope(), off = offs()
    off[s] = Object.assign({}, offOf(s), { [k]: title(el) })
    save(false); sync()
    try { if (window.DS && DS.buzz) DS.buzz() } catch (e) {}
    const done = () => flip(() => { el.classList.add("bk-hid"); tray(k) })
    if (reduce()) return done()
    const a = el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.86)" }], { duration: 240, easing: "cubic-bezier(.4,0,.6,1)", fill: "forwards" })
    a.onfinish = () => { done(); a.cancel() }
  }
  function show(k) {
    const v = $v(), s = scope(), o = Object.assign({}, offOf(s)), name = o[k]
    delete o[k]
    if (Object.keys(o).length) offs()[s] = o; else delete offs()[s]
    save(false); sync()
    try { if (window.DS && DS.buzz) DS.buzz() } catch (e) {}
    const el = blocks(v, true).find(b => b.dataset.bk === k)
    if (!el) { tray(); toast(`«${name || "Блок"}» вернётся, когда в нём что-то появится`); return }
    flip(() => { el.classList.remove("bk-hid"); addRm(el); tray() })
    if (!reduce()) el.animate([{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 460, easing: "cubic-bezier(.3,1.25,.5,1)" })
    setTimeout(() => {
      const r = el.getBoundingClientRect()
      if (r.top < 90 || r.bottom > innerHeight - 140) el.scrollIntoView({ block: "center", behavior: reduce() ? "auto" : "smooth" })
    }, 120)
  }
  // в режиме правки нажатия внутри блоков не срабатывают; «−», «+» и «Готово» — да; нажатие мимо блоков — выход
  document.addEventListener("click", e => {
    if (!edit || !e.target.closest) return
    const v = $v()
    const rm = e.target.closest(".bk-rm"), add = e.target.closest("[data-bk-add]")
    if (rm && v.contains(rm)) { e.preventDefault(); e.stopPropagation(); hide(rm.parentElement); return }
    if (add && v.contains(add)) { e.preventDefault(); e.stopPropagation(); show(add.dataset.bkAdd); return }
    if (e.target === v) { leave(); return }
    if (v.contains(e.target) && !e.target.closest(".bk-tray")) { e.preventDefault(); e.stopPropagation() }
  }, true)

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
    if (edit) return
    const o = D.onb || {}
    if (!o.intro || !on() || tab === "today" && !(o.steps && (o.steps.done || o.steps.hide))) return
    clearTimeout(hint.t)
    hint.t = setTimeout(() => { if (!D.blocksHint && on() && !drag) { D.blocksHint = Date.now(); save(false); toast("Блоки можно менять местами, убирать и возвращать: удерживайте блок") } }, 2500)
  }

  // ── Настройки: вернуть порядок как было
  function card() {
    const n = Object.keys(store()).filter(k => (store()[k] || []).length).length + Object.keys(offs()).filter(k => Object.keys(offs()[k] || {}).length).length
    return `<div class="card bk-set"><h2>Блоки в разделах</h2><div class="small muted">В разделах «Сегодня», «Планы», «Деньги» и «Здоровье» удерживайте блок и ведите — он переедет. Удержите и отпустите, не двигая (или нажмите «Изменить блоки» внизу раздела), — у блоков появится «−»: так можно убрать лишнее. Убранные блоки ждут внизу раздела, «+» возвращает их на место.</div>
      ${n ? `<div class="btns" style="margin-top:10px"><button class="btn small" data-do="bk-reset">Вернуть как было</button></div>` : ""}</div>`
  }

  document.addEventListener("DOMContentLoaded", () => {
    try {
      const more0 = renderMore
      renderMore = function () { const html = more0.apply(this, arguments), i = html.indexOf('<div class="card"><h2>Связь с виджетом'); return i < 0 ? html + card() : html.slice(0, i) + card() + html.slice(i) }
      const render0 = render
      render = function () {
        if (drag) { pendingRender = true; return }   // пока блок в руке, экран не перерисовываем
        if (edit && (!on() || scope() !== editTab)) leave()   // ушли в другой раздел — правка закончилась
        const v = $v(), first = v && v.firstElementChild
        const out = render0.apply(this, arguments)
        try {
          if (v && v.firstElementChild !== first) v.classList.remove("bk-done")
          apply()
          if (on()) hint(false)
          const b = v && v.querySelector('[data-do="bk-reset"]')
          if (b) b.onclick = ev => { ev.stopPropagation(); D.blocks = {}; D.blocksOff = {}; save(false); sync(); toast("Блоки — как было"); lastHTML = ""; render() }
        } catch (e) { console.error("blocks", e) }
        return out
      }
      render()
    } catch (e) { console.error("blocks", e) }
  })
  return { apply, merge, keyOf, blocks, scope, enter, leave, editing: () => edit }
})()
