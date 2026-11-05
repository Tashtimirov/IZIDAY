// iPad и большие экраны: карточки в две колонки (без дыр между ними) и быстрые клавиши для клавиатуры.
// На iPhone ничего не делает: колонки включаются, только когда середина экрана шире 700 px.
(function () {
  const v = document.getElementById("view")
  if (!v) return
  const COLS = { today: 1, plans: 1, money: 1, health: 1 }
  const ROW = 2, GAP = 14   // шаг сетки и зазор между карточками, px
  let on = false

  const wants = () => COLS[tab] && v.clientWidth >= 700 && !document.body.classList.contains("kidm") && !document.body.classList.contains("chat")
  // каждой карточке — столько строк сетки, сколько она высотой: так короткие карточки подтягиваются под соседние, без пустых мест
  const fit = el => {
    if (!on || el.parentNode !== v) return
    el.style.gridRowEnd = ""
    const h = el.getBoundingClientRect().height
    if (!h) { el.style.gridRowEnd = "span 1"; return }
    el.style.gridRowEnd = `span ${Math.ceil((h + GAP) / ROW)}`
  }
  const ro = new ResizeObserver(es => { for (const e of es) fit(e.target) })
  function layout() {
    const want = !!wants()
    if (want !== on) {
      on = want; v.classList.toggle("mas", on)
      if (!on) for (const el of v.children) el.style.gridRowEnd = el.style.marginTop = el.style.marginBottom = ""
    }
    ro.disconnect()
    // лента дней: после смены ширины колонки день «уезжает» — снова ставим выбранную неделю в начало (один раз на каждую новую ленту)
    const s = document.getElementById("strip")
    if (v.clientWidth >= 700 && s && s.children[1] && s.dataset.al !== String(s.clientWidth)) {
      const col = s.children[1].offsetLeft - s.children[0].offsetLeft
      if (col) { s.scrollLeft = Math.round((+s.dataset.sel - +s.dataset.start) / 864e5) * col; s.dataset.al = String(s.clientWidth) }
    }
    if (!on) return
    for (const el of v.children) {
      const cs = getComputedStyle(el)
      el.style.marginTop = el.style.marginBottom = "0px"
      if (cs.display === "none" || cs.position === "absolute" || cs.position === "fixed") continue
      ro.observe(el); fit(el)
    }
  }
  let t = 0
  const soon = () => { cancelAnimationFrame(t); t = requestAnimationFrame(layout) }
  new MutationObserver(soon).observe(v, { childList: true })
  addEventListener("resize", soon)
  const st = setTab
  setTab = function (x) { const r = st.apply(this, arguments); soon(); return r }
  soon()

  // ── клавиатура (Magic Keyboard, Smart Keyboard) ──
  // ⌘1…⌘5 — разделы, ⌘K или ⌘F — поиск, ⌘N — добавить, ⌘J — чат Изи, Esc — закрыть окно
  const TABS = ["today", "plans", "chat", "money", "health"]
  addEventListener("keydown", e => {
    const mod = e.metaKey || e.ctrlKey
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "")
    if (e.key === "Escape") {
      if (stack.length) { e.preventDefault(); stack[stack.length - 1].close() }
      else if (typing) document.activeElement.blur()
      return
    }
    if (!mod || e.altKey) return
    const k = e.key.toLowerCase()
    if (/^[1-5]$/.test(k)) { e.preventDefault(); while (stack.length) stack[stack.length - 1].close(); setTab(TABS[+k - 1]); return }
    if (k === "k" || k === "f" || k === "л" || k === "а") { e.preventDefault(); const b = document.getElementById("find"); if (b) b.click(); return }
    if (k === "n" || k === "т") { e.preventDefault(); const b = document.getElementById("add"); if (b) b.click(); return }
    if (k === "j" || k === "о") {
      e.preventDefault(); setTab("chat")
      setTimeout(() => { const i = document.getElementById("chat-in"); if (i) i.focus() }, 80)
    }
  })
})()
