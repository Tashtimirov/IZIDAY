// IZIDAY · улучшения дизайна (идеи 52–60). Подключается последним и работает поверх готовых экранов:
// следит за #view и окнами (#layer) и дорисовывает — код разделов не трогает, поэтому не мешает другим доработкам.
//  52 карточка раскрывается в окно · 55 отклик на касание (вибрация, галочка, кольца, бегущие цифры)
//  56 заглушки при загрузке · 54 пустые экраны с Изи и примерами · 57 длинные окна до половины экрана
//  58 оттенок раздела (body[data-tab]) · 60 крупный текст iPhone и «Размер текста» в Настройках
window.DS = (function () {
  const DS = { slow: 1 }
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches
  const escA = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
  const store = { get(k) { try { return localStorage.getItem("ds." + k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem("ds." + k, v) } catch (e) {} } }

  // ── 55. Вибрация: iPhone (iOS 18+) даёт лёгкий отклик на переключатель — нажимаем невидимый
  let hl = null
  DS.buzz = function () {
    try {
      if (!hl) { hl = document.createElement("label"); hl.setAttribute("aria-hidden", "true"); hl.style.cssText = "position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none"
        const i = document.createElement("input"); i.type = "checkbox"; i.setAttribute("switch", ""); i.tabIndex = -1; hl.append(i); document.body.append(hl) }
      hl.click()
      if (/Android/i.test(navigator.userAgent) && navigator.vibrate) navigator.vibrate(8)   // Android: обычная лёгкая вибрация
    } catch (e) {}
  }
  const BUZZ = ".check, .day, #tabs button, .seg button, .chip, .tgl, .opt, .ds-ex button, .ds-say, .rg, .btn.primary, .dot"
  let popId = null
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest(BUZZ)
    if (!t || (hl && hl.contains(e.target))) return
    DS.buzz()
    if (t.matches(".check")) { popId = t.dataset.check || null; const el = t; setTimeout(() => pop(el), 0) }
  }, true)
  function pop(el) {
    const cur = popId && $(`.check[data-check="${CSS.escape(popId)}"]`) || el
    if (!cur || !cur.isConnected) return
    cur.classList.remove("ds-pop"); void cur.offsetWidth; cur.classList.add("ds-pop")
    setTimeout(() => cur.classList.remove("ds-pop"), 650)
  }

  // ── 52. Карточка раскрывается в окно: запоминаем, на что нажали, и окно «вырастает» из её рамки
  let src = null
  document.addEventListener("pointerdown", e => {
    const t = e.target.closest && e.target.closest(".row, .stat, .rg, .card, .chip, .opt, .mn-hero, [data-do]")
    if (!t || t.closest("#tabs, .chat-bar, .plus-menu, #talk")) { src = null; return }
    const el = t.closest(".row, .stat, .rg, .mn-hero") || t.closest(".card") || t
    src = { el, t: Date.now() }
  }, true)
  const H = () => (document.body.getBoundingClientRect().height || innerHeight)
  function geom(el, from) {
    const r = from.getBoundingClientRect(), lay = el.parentElement.getBoundingClientRect()
    if (!r.width || r.bottom < 0 || r.top > H()) return null
    const sl = el.offsetLeft, st = el.offsetTop, sw = el.offsetWidth, sh = el.offsetHeight
    const top = r.top - lay.top, left = r.left - lay.left
    const cs = getComputedStyle(from)
    return { y: top - st, l: Math.max(0, left - sl), r: Math.max(0, sl + sw - (left + r.width)), b: Math.max(0, sh - r.height), rad: parseFloat(cs.borderTopLeftRadius) || 18 }
  }
  function setGeom(el, g) {
    const s = el.style
    s.setProperty("--m-y", g.y + "px"); s.setProperty("--m-t", "0px"); s.setProperty("--m-r", g.r + "px"); s.setProperty("--m-b", g.b + "px"); s.setProperty("--m-l", g.l + "px"); s.setProperty("--m-r0", g.rad + "px")
  }
  function sheetOpen(el) {
    if (el.dataset.ds) return
    el.dataset.ds = "1"
    // 57. Длинное окно открывается до половины экрана — кнопки внизу, под большим пальцем; листнули — раскрылось
    if (el.scrollHeight > H() * 0.62 + 48 && !el.querySelector(".kid-sheet, input, textarea, select")) {
      el.classList.add("half")
      const full = () => { el.classList.remove("half"); el.removeEventListener("scroll", onScroll) }
      const onScroll = () => { if (el.scrollTop > 6) full() }
      el.addEventListener("scroll", onScroll, { passive: true })
      el.addEventListener("focusin", full)
      const g = el.querySelector(".grab"); if (g) g.addEventListener("click", full)
      let y0 = null
      el.addEventListener("touchstart", e => { y0 = e.touches[0].clientY }, { passive: true })
      el.addEventListener("touchmove", e => { if (y0 != null && e.touches[0].clientY - y0 < -24) { full(); y0 = null } }, { passive: true })
    }
    if (!src || Date.now() - src.t > 700 || !src.el.isConnected || reduce() || el.closest("#layer") == null) return
    const g = geom(el, src.el)
    if (!g || Math.abs(g.y) > H()) return
    // сразу ставим окно в рамку карточки, без анимации — дальше оно раскрывается вместе с классом show
    el.style.transition = "none"; el.classList.add("morph"); setGeom(el, g); void el.offsetWidth; el.style.transition = ""
    el._src = src.el; src.el.classList.add("ds-src")
    if (DS.slow > 1) el.style.transitionDuration = (0.5 * DS.slow) + "s"
    src = null
  }
  function sheetClose(el) {
    const from = el._src
    if (from) from.classList.remove("ds-src")
    if (!el.classList.contains("morph")) return
    const g = from && from.isConnected && !el.classList.contains("flick") && !el.classList.contains("drag") ? geom(el, from) : null
    if (g) { setGeom(el, g); el.classList.add("gone") }
    else el.classList.remove("morph")
  }
  new MutationObserver(recs => {
    for (const r of recs) {
      if (r.type === "childList") r.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains("sheet")) sheetOpen(n) })
      else if (r.target.classList.contains("sheet") && r.oldValue && /\bshow\b/.test(r.oldValue) && !r.target.classList.contains("show")) sheetClose(r.target)
    }
  }).observe(document.getElementById("layer"), { childList: true, subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true })

  // ── 56. Заглушки-силуэты
  DS.skel = (n = 3, ic) => [...Array(n)].map((_, i) => `<div class="skel-row">${ic ? '<i class="skel ic"></i>' : '<i class="skel t"></i>'}<div class="grow"><i class="skel" style="width:${[72, 54, 64, 46][i % 4]}%"></i><i class="skel" style="width:${[38, 30, 44, 26][i % 4]}%;height:9px"></i></div></div>`).join("")
  DS.skelCard = (n = 3) => `<div class="card skel-card"><i class="skel h"></i>${DS.skel(n, true)}</div>`

  // ── 54. Пустые экраны: шар Изи, короткая фраза, примеры — нажали, и пример уже в строке чата
  const EX_CHAT = ["что у меня на неделе?", "потратил 300 на такси", "напомни завтра в 9 позвонить маме", "составь план на день"].map(x => window.L && L.en ? L.t(x) : x)
  const EX_EMPTY = { "Ничего не запланировано": ["завтра в 10 встреча с Олей"], "За этот день ничего не записано": ["выпил стакан воды", "обед 450"] }
  DS.say = function (text) {
    while (typeof stack !== "undefined" && stack.length) stack[stack.length - 1].close()
    if (typeof setTab === "function") setTab("chat")
    setTimeout(() => { const i = $("#chat-in"); if (!i) return; i.value = text; i.dispatchEvent(new Event("input", { bubbles: true })); i.focus(); try { i.setSelectionRange(text.length, text.length) } catch (e) {} }, 120)
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-ds-say]")
    if (b) { e.preventDefault(); e.stopPropagation(); DS.say(b.dataset.dsSay) }
  })
  function chatEmpty() {
    const name = typeof iziName === "function" ? iziName() : "Изи"
    return `<div class="ds-empty"><b class="mini-orb ds-orb"></b><div class="t">Я — ${escA(name)}. Чем помочь?</div>
      <div class="s">Напишите или нажмите микрофон в строке внизу и скажите.</div>
      <div class="ds-ex">${EX_CHAT.map(x => `<button data-ds-say="${escA(x)}">${escA(x)}</button>`).join("")}</div></div>`
  }
  function empties(root) {
    $$(".empty:not([data-ds])", root).forEach(el => {
      el.dataset.ds = "1"
      const txt = el.textContent.trim()
      if (el.parentElement && el.parentElement.classList.contains("chat-list") && !el.parentElement.querySelector(".m")) { el.outerHTML = chatEmpty(); return }
      if (/^Загружаю/.test(txt)) { el.outerHTML = `<div class="ds-loading" aria-label="${escA(txt)}">${DS.skel(3)}</div>`; return }
      if (/«[^«»]{3,60}»/.test(el.innerHTML)) { el.innerHTML = el.innerHTML.replace(/«([^«»<]{3,60})»/g, (m, q) => `<button class="ds-say" data-ds-say="${escA(q.replace(/&quot;/g, '"').replace(/&amp;/g, "&"))}">${q}</button>`); return }
      if (txt.length <= 42 && !el.querySelector("button, a")) {
        el.classList.add("ds-quiet")
        const ex = EX_EMPTY[txt] || []
        el.innerHTML = `<b class="mini-orb"></b><span>${el.innerHTML}${ex.length ? " " + ex.map(x => `<button class="ds-say" data-ds-say="${escA(x)}">${escA(x)}</button>`).join(" ") : ""}</span>`
      }
    })
    $$(".ds-orb:not(:has(canvas))", root).forEach(o => { if (typeof silkCanvas === "function") { const c = document.createElement("canvas"); o.append(c); silkCanvas(c, "orb") } })
  }

  // ── 55. Кольца наполняются, цифры «бегут» к новому значению
  const NUM = ".rings .rg b, .stat .v, .totals .big, .ring .c b, [data-ds-num]"
  let prev = new Map()
  const NRE = /([−-]?)(\d{1,3}(?:[   ]\d{3})+|\d+)(?:([.,])(\d+))?/
  function fmt(v, m) {
    const dec = m[4] ? m[4].length : 0, sep = (m[2].match(/[   ]/) || [""])[0]
    let [i, f] = Math.abs(v).toFixed(dec).split(".")
    if (sep) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, sep)
    return (m[1] || "") + i + (dec ? m[3] + f : "")
  }
  function numbers(root, fresh) {
    const seen = new Map()
    $$(NUM, root).forEach((el, k) => {
      if (el.children.length || el.closest("[data-count]")) return
      const txt = el.textContent, m = txt.match(NRE)
      if (!m) return
      const to = parseFloat(m[2].replace(/[   ]/g, "") + (m[4] ? "." + m[4] : ""))
      const key = k + ":" + txt.replace(NRE, "#"), from = fresh ? 0 : prev.get(key)
      seen.set(key, to)
      if (from == null || from === to || reduce() || !isFinite(to)) return
      // бегущее число рисуется поверх (aria-hidden), а настоящий текст остаётся на месте — его читают VoiceOver и поиск
      const a = txt.slice(0, m.index), z = txt.slice(m.index + m[0].length), t0 = performance.now(), dur = 700 * DS.slow
      const o = document.createElement("i"); o.className = "ds-cnt"; o.setAttribute("aria-hidden", "true")
      o.style.color = getComputedStyle(el).color; o.textContent = a + fmt(from, m) + z; el.classList.add("ds-num", "ds-counting"); el.append(o)
      const step = now => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3)
        if (!o.isConnected) return
        o.textContent = a + fmt(from + (to - from) * e, m) + z
        if (p < 1) requestAnimationFrame(step); else { o.remove(); el.classList.remove("ds-counting") }
      }
      requestAnimationFrame(step)
    })
    prev = seen
  }
  function rings(root, fresh) {
    $$("circle[stroke-dasharray]", root).forEach(c => {
      if (c.dataset.ds) return
      c.dataset.ds = "1"
      if (!fresh || reduce()) return
      const da = c.getAttribute("stroke-dasharray").trim().split(/[\s,]+/).map(Number), off = c.getAttribute("stroke-dashoffset")
      c.style.transition = "none"
      if (off != null) c.style.strokeDashoffset = String(da[0])
      else if (da.length >= 2) c.style.strokeDasharray = `0.001 ${da[1]}`
      else return
      void c.getBoundingClientRect()
      requestAnimationFrame(() => requestAnimationFrame(() => {
        c.style.transition = `stroke-dashoffset ${1.1 * DS.slow}s cubic-bezier(.2,.8,.2,1), stroke-dasharray ${1.1 * DS.slow}s cubic-bezier(.2,.8,.2,1)`
        c.style.strokeDashoffset = ""; c.style.strokeDasharray = ""
      }))
    })
  }

  // ── 60. Крупный текст: «Как в iPhone» берёт размер из настроек iPhone (Экран и яркость → Размер текста)
  const PH = /Android/i.test(navigator.userAgent) ? "телефоне" : "iPhone"
  const TS = [["auto", `Как в ${PH}`], ["1", "Обычный"], ["1.15", "Крупнее"], ["1.3", "Ещё крупнее"]]
  function iphoneScale() {
    if (!(window.CSS && CSS.supports && CSS.supports("font", "-apple-system-body"))) return 1
    const p = document.createElement("span"); p.style.cssText = "font:-apple-system-body;position:absolute;visibility:hidden"; p.textContent = "A"
    document.body.append(p); const px = parseFloat(getComputedStyle(p).fontSize) || 17; p.remove()
    return Math.max(0.94, Math.min(1.35, px / 17))
  }
  DS.textScale = function (x) {
    const v = x != null ? x : (store.get("ts") || "auto")
    const s = v === "auto" ? iphoneScale() : +v || 1
    document.documentElement.style.setProperty("--ts", String(Math.round(s * 100) / 100))
    return s
  }
  function tsCard() {
    const cur = store.get("ts") || "auto", now = Math.round(DS.textScale() * 100)
    return `<div class="card ds-ts" data-ds="ts"><h2>Размер текста</h2><div class="seg">${TS.map(([k, l]) => `<button class="${k === cur ? "on" : ""}" data-ds-ts="${k}">${l}</button>`).join("")}</div>
      <div class="muted small" style="margin-top:8px">${PH === "iPhone" ? "«Как в iPhone» — как в Настройках iPhone → Экран и яркость → Размер текста." : "«Как в телефоне» — как в настройках Chrome и телефона (размер шрифта)."} Сейчас ${now}%.</div></div>`
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-ds-ts]")
    if (!b) return
    store.set("ts", b.dataset.dsTs); DS.textScale()
    const c = b.closest(".ds-ts"); if (c) c.outerHTML = tsCard()
  })
  addEventListener("pageshow", () => DS.textScale()); document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") DS.textScale() })

  // ── 58 и общий проход по экрану после каждой перерисовки
  let lastTab = "", busy = false
  const tabNow = () => { const b = $("#tabs button.on"); return b ? b.dataset.tab : ($("#gear.on") ? "more" : "today") }
  function hydrate() {
    const v = $("#view"); if (!v || busy) return
    busy = true
    try {
      const t = tabNow(), fresh = t !== lastTab
      if (document.body.dataset.dsTab !== t) document.body.dataset.dsTab = t
      lastTab = t
      empties(v)
      if (t === "more" && !$(".ds-ts", v)) { const last = v.lastElementChild, slot = $(".ds-ts-slot", v); const box = document.createElement("div"); box.innerHTML = tsCard(); slot ? slot.replaceWith(box.firstChild) : last && last.classList.contains("muted") ? v.insertBefore(box.firstChild, last) : v.append(box.firstChild) }   // «Размер текста» — в группу «Приложение» (место готовит settings.js)
      rings(v, fresh); numbers(v, fresh)
    } finally { mo.takeRecords(); busy = false }
  }
  // наблюдатель срабатывает сразу после перерисовки, до показа кадра — экран не «моргает»
  const mo = new MutationObserver(() => hydrate())
  DS.start = () => { DS.textScale(); mo.observe($("#view"), { childList: true, subtree: true }); hydrate() }
  DS.hydrate = hydrate
  return DS
})()
DS.start()
