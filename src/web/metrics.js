// ───────────── Метрики и журнал действий (для теста на друзьях) ─────────────
// Подключается ПОСЛЕ остальных файлов и оборачивает их функции: какие экраны открывают, какие действия делают,
// сколько длятся запуск, обмен с таблицей и ответы Изи, какие ошибки и сбои случаются.
// Никакого содержимого: ни текстов, ни сумм, ни названий записей, ни разговоров — только имена экранов,
// виды действий, время в миллисекундах и обезличенный текст ошибок. Отправка — на общий сервер друзей
// (лист «IZIDAY — журнал действий» на Диске владельца). Выключается в «Настройках» → «Улучшение приложения».
window.METRICS = (() => {
  const QK = "izi-mq", DK = "izi-dev", LK = "izi-mlog"
  const MAXQ = 400, BATCH = 60, EVERY = 180e3
  const t0 = Date.now()
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch (e) { return d } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} },
  }
  const dev = (() => { let d = ls.get(DK, ""); if (!/^[0-9a-f]{6}$/.test(d)) { d = [...crypto.getRandomValues(new Uint8Array(3))].map(b => b.toString(16).padStart(2, "0")).join(""); ls.set(DK, d) } return d })()
  const ua = navigator.userAgent || ""
  const standalone = (() => { try { return !!(navigator.standalone || matchMedia("(display-mode: standalone)").matches) } catch (e) { return false } })()
  const plat = (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1 ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "другое") +
    (standalone ? " · приложение" : " · браузер")
  let ver = "?"
  try { caches.keys().then(ks => { const k = ks.find(x => /^myday-[0-9a-f]+$/.test(x)); if (k) ver = k.slice(6) }).catch(() => {}) } catch (e) {}

  const off = () => !!(typeof D !== "undefined" && D && D.metricsOff)
  const hook = () => window.FRIEND && FRIEND.on && FRIEND.on() && FRIEND.hook ? FRIEND.hook() : ""
  const who = () => { try { return D.conn ? (D.conn.friend ? "friend" : "owner") : "guest" } catch (e) { return "guest" } }

  // Обезличивание текста ошибки: без почт, ссылок, чисел, текста в кавычках («…» — там бывают слова человека)
  function clean(s) {
    return String(s == null ? "" : s)
      .replace(/«[^»]*»|"[^"]{3,}"|“[^”]*”/g, "«…»")
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<почта>")
      .replace(/https?:\/\/([^/\s?#]+)[^\s]*/g, "$1")
      .replace(/\b(sk-an[t]|AKf[y]|ya29|eyJ)[\w.-]{8,}/g, "<ключ>")
      .replace(/\d[\d\s.,:]{3,}\d/g, "#")
      .replace(/\s+/g, " ").trim().slice(0, 160)
  }

  // ── очередь ──
  let q = ls.get(QK, [])
  if (!Array.isArray(q)) q = []
  const log = ls.get(LK, [])   // последние события — для формы «Сообщить о проблеме» (recent)
  // событие: [время, тип, что, мс, раз, подробности]
  function push(type, what, ms, n, info) {
    const e = [Date.now(), type, clean(what).slice(0, 80), ms == null ? "" : Math.max(0, Math.round(ms)), n || 1, info ? clean(info) : ""]
    log.push(e); if (log.length > 60) log.splice(0, log.length - 60); ls.set(LK, log)
    if (off()) return
    q.push(e); if (q.length > MAXQ) q.splice(0, q.length - MAXQ)
    ls.set(QK, q)
    if (q.length >= 30 && !flushing) setTimeout(flush, 0)
  }
  // одинаковые действия подряд (одна запись несколько раз за секунду) — одним событием
  let lastAct = null
  function act(what, info) {
    const now = Date.now()
    if (lastAct && lastAct.what === what && now - lastAct.at < 1500) { lastAct.at = now; return }
    lastAct = { what, at: now }
    push("действие", what, null, 1, info)
  }
  // время: копим и отправляем сводно (среднее, максимум, сколько раз, сбои), чтобы не слать строку на каждый обмен
  const tm = {}
  function time(what, ms, ok = true) {
    if (!(ms >= 0) || ms > 30 * 60e3) return
    const s = tm[what] || (tm[what] = { n: 0, sum: 0, max: 0, bad: 0 })
    s.n++; s.sum += ms; s.max = Math.max(s.max, ms); if (!ok) s.bad++
  }
  function timesOut() {
    for (const [k, s] of Object.entries(tm)) {
      delete tm[k]
      push("скорость", k, s.sum / s.n, s.n, `макс ${(s.max / 1000).toFixed(1)} с${s.bad ? " · сбоев " + s.bad : ""}`)
    }
  }
  // ошибки: одна и та же за сеанс — один раз сразу, повторы считаются
  const seen = {}
  function err(kind, msg, where) {
    const m = clean(msg) || "без текста", key = kind + "|" + m
    if (seen[key]) { seen[key].n++; return }
    seen[key] = { n: 0 }
    push(kind, m, null, 1, where)
  }
  function errsOut() { for (const [k, s] of Object.entries(seen)) if (s.n) { const [kind, m] = k.split("|"); push(kind, m, null, s.n, "повторы"); s.n = 0 } }

  let sending = false, flushing = false, lastFlush = 0
  function body(ev) {
    const b = { metrics: { dev, who: who(), ver, plat, ev } }
    try { if (D.conn && D.conn.friend && D.conn.hook === hook() && D.conn.secret) b.secret = D.conn.secret } catch (e) {}
    return JSON.stringify(b)
  }
  async function flush(beacon) {
    if (off()) { q = []; ls.set(QK, q); return false }
    const url = hook()
    if (!url || sending || !navigator.onLine || Date.now() < lastFlush) return false
    flushing = true
    try { timesOut(); errsOut() } finally { flushing = false }
    if (!q.length) return true
    const ev = q.slice(0, BATCH)
    lastFlush = Date.now()
    const drop = () => { q.splice(0, ev.length); ls.set(QK, q) }
    if (beacon && navigator.sendBeacon) {
      try { if (navigator.sendBeacon(url, new Blob([body(ev)], { type: "text/plain;charset=utf-8" }))) { drop(); return true } } catch (e) {}
    }
    sending = true
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000)
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, body: body(ev), credentials: "omit", cache: "no-store", keepalive: !!beacon, signal: ctl.signal })
      const j = await r.json().catch(() => null)
      if (j && j.ok) { drop(); return true }
      if (j && j.error === "slow down") lastFlush = Date.now() + 10 * 60e3
      return false
    } catch (e) { return false } finally { clearTimeout(t); sending = false }
  }

  // ── обёртки над функциями приложения ──
  const KEYS = { money: "деньги", food: "еда", water: "вода", workouts: "тренировки", places: "места", rems: "напоминания", budgets: "бюджеты", recur: "регулярные платежи",
    habits: "привычки", hlog: "отметки привычек", weight: "вес", shop: "покупки", kids: "дела детей", fast: "голодание", goals: "цели и желания", pomo: "фокус", nudges: "подсказки" }
  const TABS = { today: "Сегодня", cal: "Календарь", plans: "Планы", chat: "Изи: чат", money: "Деньги", health: "Здоровье", more: "Настройки" }
  return { push, act, time, err, flush, clean, dev, plat, KEYS, TABS, t0, off,
    recent: n => log.slice(-(n || 30)).map(e => ({ at: e[0], type: e[1], what: e[2], ms: e[3], n: e[4], info: e[5] })),
    info: () => ({ dev, plat, ver, who: who() }),
    _q: () => q, _hook: hook, _lastFlush: () => lastFlush, _every: EVERY }
})()

;(() => {
  const M = METRICS
  // экраны и время на них
  let scr = null, scrAt = Date.now()
  const leave = () => { if (scr && document.visibilityState === "visible") M.time("на экране: " + (M.TABS[scr] || scr), Date.now() - scrAt) }
  if (typeof setTab === "function") {
    const f0 = setTab
    setTab = function (t) {
      const from = typeof tab !== "undefined" ? tab : null
      const r = f0.apply(this, arguments)
      try { const now = typeof tab !== "undefined" ? tab : t; if (now !== from || scr !== now) { leave(); scr = now; scrAt = Date.now(); M.push("экран", M.TABS[now] || String(now)) } } catch (e) {}
      return r
    }
  }
  // записи: какой список и что сделали (без содержимого)
  if (typeof upsert === "function") {
    const f0 = upsert
    upsert = function (key, rec) {
      try {
        if (M.KEYS[key] && rec) {
          const was = (D[key] || []).find(x => x.id === rec.id)
          const op = rec.deleted ? "удалено" : !was ? "добавлено" : (rec.done && !was.done) || (rec.doneAt && !was.doneAt) || (rec.end && !was.end) ? "выполнено" : "изменено"
          M.act(`${M.KEYS[key]}: ${op}`, /^[a-z]{2,12}$/.test(rec.kind || "") ? rec.kind : "")
        }
      } catch (e) {}
      return f0.apply(this, arguments)
    }
  }
  // обмен с таблицей
  if (typeof sync === "function") {
    const f0 = sync
    sync = function () {
      const t = performance.now()
      const p = f0.apply(this, arguments)
      if (p && p.then && !p.metered) {
        p.metered = true
        p.then(ok => {
          M.time("обмен с таблицей", performance.now() - t, !!ok)
          if (!ok && D.conn && D.sync && D.sync.error) M.err("сбой", "обмен: " + D.sync.error)
          if (ok && !first) { first = true; M.time("первый обмен после запуска", performance.now()) }
        }, () => {})
      }
      return p
    }
  }
  let first = false
  // ответы ИИ (чат, разговор, фото еды, документы)
  if (typeof claude === "function") {
    const f0 = claude
    claude = async function (body, timeout, opts) {
      const t = performance.now(), what = opts && opts.smart ? "ИИ: ответ (чат)" : (typeof TALK !== "undefined" && TALK) ? "ИИ: ответ (разговор)" : "ИИ: ответ"
      try { const r = await f0.apply(this, arguments); M.time(what, performance.now() - t, !(r && r.type === "error")); if (r && r.type === "error") M.err("сбой", "ИИ: " + ((r.error && (r.error.type || r.error.message)) || "ошибка")); return r }
      catch (e) { M.time(what, performance.now() - t, false); if (e && e.name !== "AbortError") M.err("сбой", "ИИ: " + (e.message || e)); throw e }
    }
  }
  // сообщение Изи в чате — целиком, с инструментами
  if (typeof chatSend === "function") {
    const f0 = chatSend
    chatSend = async function (text, opts = {}) {
      const busy = typeof chatBusy !== "undefined" && chatBusy, asking = typeof askWait !== "undefined" && askWait
      const t = performance.now()
      if (!busy && !asking && (String(text || "").trim() || opts.attach)) M.act("Изи: сообщение", opts.voice ? "голос" : (opts.attach || (typeof chatAtt !== "undefined" && chatAtt)) ? "с вложением" : "текст")
      try { return await f0.apply(this, arguments) }
      finally { if (!busy && !asking) { const ms = performance.now() - t; if (ms > 300) M.time("Изи: ответ в чате целиком", ms) } }
    }
  }
  // действия Изи (инструменты)
  if (typeof runTool === "function") {
    const f0 = runTool
    runTool = async function (name) {
      const t = performance.now()
      try { const r = await f0.apply(this, arguments); M.act("Изи сделал: " + name); M.time("Изи: инструмент " + name, performance.now() - t, !(r && r.error)); return r }
      catch (e) { M.err("сбой", "инструмент " + name + ": " + (e.message || e)); throw e }
    }
  }
  // живой разговор: открытие, длительность, ответы, сбои микрофона (из журнала разговора tdbg)
  let talk = null
  if (typeof talkOpen === "function") {
    const f0 = talkOpen
    talkOpen = function () { const had = typeof TALK !== "undefined" && TALK; const r = f0.apply(this, arguments); if (!had && typeof TALK !== "undefined" && TALK) { talk = { at: Date.now(), n: 0 }; M.act("разговор: открыт", (window.STT && STT.on && STT.on()) ? "Whisper" : "Safari") } return r }
  }
  if (typeof talkClose === "function") {
    const f0 = talkClose
    talkClose = function () { if (talk) { M.push("разговор", "закрыт", Date.now() - talk.at, 1, "реплик " + talk.n); talk = null } return f0.apply(this, arguments) }
  }
  if (typeof tdbg === "function") {
    const f0 = tdbg
    tdbg = function (m) {
      try {
        const s = String(m), a = s.match(/^ответ за ([\d.]+) с/)
        if (a) { M.time("Изи: ответ в разговоре", +a[1] * 1000); if (talk) talk.n++ }
        else if (/^ошибка /.test(s)) M.err("сбой", "разговор: " + s)
        else if (/нули|не пошёл|нет звука|голос замер/.test(s)) M.err("сбой", "микрофон: " + s.replace(/[\d.]+/g, "").trim())
      } catch (e) {}
      return f0.apply(this, arguments)
    }
  }
  // подсказки с ошибкой внизу экрана
  if (typeof toast === "function") {
    const f0 = toast
    toast = function (t) { try { if (/не удалось|ошибк|нет связи|не ответил|не получилось|не принял|не вышло/i.test(String(t))) M.err("сбой", "подсказка: " + t) } catch (e) {} return f0.apply(this, arguments) }
  }
  // ошибки кода
  addEventListener("error", e => { if (e && e.message) M.err("ошибка", e.message, (String(e.filename || "").split("/").pop().split("?")[0] || "") + (e.lineno ? ":" + e.lineno : "")) })
  addEventListener("unhandledrejection", e => { const r = e && e.reason; if (r && r.name === "AbortError") return; M.err("ошибка", "промис: " + ((r && r.message) || r)) })
  const ce = console.error
  console.error = function () { try { const a = [...arguments]; M.err("ошибка", a.map(x => x && x.message ? x.message : typeof x === "string" ? x : "").filter(Boolean).join(": ").slice(0, 200), "console") } catch (e) {} return ce.apply(console, arguments) }

  // ── настройки: карточка «Улучшение приложения» ──
  if (typeof renderMore === "function") {
    const f0 = renderMore
    renderMore = function () {
      const html = f0.apply(this, arguments)
      if (!M._hook()) return html
      const on = !M.off()
      const card = `<div class="card mtr"><h2>Улучшение приложения</h2>
        <div class="set"><span>Отправлять статистику</span><div class="seg"><button data-mtr="on" class="${on ? "on" : ""}">Вкл.</button><button data-mtr="off" class="${on ? "" : "on"}">Выкл.</button></div></div>
        <div class="muted small">Какие разделы открываются, сколько длятся загрузки и ответы ${esc(typeof iziName === "function" ? iziName() : "Изи")}, какие ошибки случаются. Тексты, суммы, записи, фото и разговоры не отправляются.</div></div>`
      const i = html.indexOf('<div class="card"><h2>Связь с виджетом')
      return i < 0 ? html + card : html.slice(0, i) + card + html.slice(i)
    }
  }
  document.addEventListener("click", e => {
    const b = e.target && e.target.closest && e.target.closest("[data-mtr]")
    if (!b) return
    const on = b.dataset.mtr === "on"
    if (!on) M.push("настройка", "статистика выключена")
    D.metricsOff = !on; save(false)
    if (on) M.push("настройка", "статистика включена")
    if (typeof render === "function") render()
  })

  // ── запуск, сеансы, отправка ──
  function boot() {
    try {
      const n = performance.getEntriesByType("navigation")[0]
      if (n) {
        M.time("запуск: страница готова", n.domContentLoadedEventEnd)
        M.push("сеанс", "открыт", n.domContentLoadedEventEnd, 1, (n.transferSize === 0 ? "из кэша" : "из сети") + (typeof tab !== "undefined" ? " · " + (M.TABS[tab] || tab) : ""))
      } else M.push("сеанс", "открыт", performance.now())
      scr = typeof tab !== "undefined" ? tab : null; scrAt = Date.now()
    } catch (e) {}
  }
  if (document.readyState === "complete") boot(); else addEventListener("load", boot, { once: true })
  let shownAt = Date.now()
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { leave(); M.push("сеанс", "свёрнут", Date.now() - shownAt); M.flush(true) }
    else { shownAt = Date.now(); scrAt = Date.now(); M.push("сеанс", "вернулся") }
  })
  addEventListener("pagehide", () => M.flush(true))
  setInterval(() => { if (document.visibilityState === "visible" && Date.now() - M._lastFlush() > M._every) M.flush() }, 30e3)
  setTimeout(() => M.flush(), 20e3)
})()
