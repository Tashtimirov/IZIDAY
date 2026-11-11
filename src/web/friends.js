// ───────────── Вход для друзей через Google ─────────────
// У друзей нет виджета и своей таблицы: они нажимают «Войти через Google», общий сервер «IZIDAY Друзья»
// сам заводит им личную таблицу, календарь внутри неё и Изи через ключ владельца (с дневным лимитом).
// Google возвращает на сайт id_token (подписанный пропуск с почтой и именем); index.html забирает его из адреса
// до app.js, а здесь он уходит на сервер и меняется на ключ этого телефона.
window.FRIEND = (() => {
  const CFG = { hook: "__FRIENDS_HOOK__", client: "__GOOGLE_CLIENT__", owner: "__OWNER_HASHES__" }
  const on = () => /^https:\/\/script\.google\.com\//.test(CFG.hook) && /\.apps\.googleusercontent\.com$/.test(CFG.client)
  const me = () => (D.conn && D.conn.friend) || null
  const rnd = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("")
  const GICO = `<span style="display:inline-flex;background:#fff;border-radius:50%;padding:4px;margin-right:9px;vertical-align:-6px"><svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg></span>`

  // Почты владельца (у него свой виджет Scriptable со своим календарём) — только отпечатками sha256, сами адреса в сайт не попадают
  async function isOwner(email) {
    const e = String(email || "").trim().toLowerCase()
    if (!e || !/^[0-9a-f,]{64,}$/.test(CFG.owner)) return false
    try {
      const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(e)))].map(b => b.toString(16).padStart(2, "0")).join("")
      return CFG.owner.split(",").includes(h)
    } catch (x) { return false }
  }
  // Код подключения своей таблицы (тот же, что копирует виджет) — из текущего подключения телефона
  function mySetup() {
    const c = D.conn
    if (!c || c.friend || !c.hook || !c.secret) return ""
    try { return btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, hook: c.hook, secret: c.secret, key: c.key || "", routes: c.routes || [], sheetUrl: c.sheetUrl || "", run: c.run || "", cfg: c.cfg || null })))) } catch (e) { return "" }
  }
  // После подключения кодом из виджета — один раз предлагаем привязать вход Google к этой таблице
  if (typeof connect === "function") {
    const c0 = connect
    connect = async function (code) {
      const r = await c0.apply(this, arguments)
      if (on() && D.conn && !D.conn.friend && D.sync && D.sync.at && !D.sync.error && !D.gLink && !D.gLinkAsk) {
        D.gLinkAsk = Date.now(); save(false)
        setTimeout(async () => { if (await ui.confirm("Привязать вход Google?", `<div class="msg">Войдите один раз через Google своей почтой — и на новом телефоне или после переустановки хватит одной кнопки «Войти через Google»: откроется эта таблица со всеми записями.</div>`, ["Позже", "Привязать"]) === "Привязать") login() }, 1200)
      }
      return r
    }
  }
  // Подключиться к своему виджету вместо сервера друзей: Scriptable копирует код, приложение вставляет (app.js → autoConnect)
  async function widget(ask = true) {
    if (ask) {
      const b = await ui.confirm("Подключить свой виджет", `<div class="msg">Календарь, напоминания и все записи придут из вашего виджета Scriptable. Откроется Scriptable и скопирует код: вернитесь кнопкой «◀ IZIDAY» слева вверху и нажмите «Вставить».</div>`, ["Отмена", "Ввести код", "Подключить"])
      if (b === "Ввести код") { if (D.conn && D.conn.friend) { D.conn = null; save(false) } return DO.connect() }
      if (b !== "Подключить") return
    }
    if (D.conn && D.conn.friend) { D.conn = null; save(false); render() }
    autoConnect()
  }
  const ownerAsk = () => ui.confirm("Это ваш личный аккаунт", `<div class="msg">Ваш календарь и записи живут в виджете Scriptable. Вход через Google — для друзей: здесь будет отдельный пустой аккаунт.</div>`, ["Всё равно Google", "Подключить виджет"])

  async function post(body, timeout = 30000) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout)
    try {
      const r = await fetch(CFG.hook, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, credentials: "omit", cache: "no-store", signal: ctl.signal, body: JSON.stringify(body) })
      return JSON.parse(await r.text())
    } catch (e) { return { ok: false, error: e.name === "AbortError" ? "сервер долго не отвечает" : "нет связи с сервером" } } finally { clearTimeout(t) }
  }

  function login() {
    if (!on()) return ui.info("Вход скоро заработает", "Вход через Google ещё настраивается. Попробуйте чуть позже.")
    const nonce = rnd(), state = rnd()
    try { localStorage.setItem("izi-gstate", JSON.stringify({ nonce, state, at: Date.now() })) } catch (e) {}
    const q = new URLSearchParams({ client_id: CFG.client, redirect_uri: location.origin + location.pathname.replace(/index\.html$/, ""), response_type: "id_token",
      scope: "openid email profile", nonce, state, prompt: "select_account" })
    location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + q
  }

  // Google вернул на сайт: #state=…&id_token=… (или #error=…)
  async function finish(hash) {
    const p = new URLSearchParams(String(hash || "").replace(/^#/, ""))
    let st = {}
    try { st = JSON.parse(localStorage.getItem("izi-gstate") || "{}") || {}; localStorage.removeItem("izi-gstate") } catch (e) {}
    if (p.get("error")) { if (p.get("error") !== "access_denied") toast("Google не пустил: " + p.get("error")); return }
    const token = p.get("id_token")
    if (!token) return
    // state совпал — проверяем и nonce; не совпал (вход открылся в другом окне Safari) — сервер всё равно проверит пропуск у Google
    const nonce = st.state && st.state === p.get("state") ? st.nonce : ""
    const wait = sheet(`<h3>Настраиваю IZIDAY…</h3><div class="msg">Готовлю ваш календарь, деньги, здоровье и ${esc(iziName())}. Это 5–15 секунд.</div>`)
    const own = mySetup()   // подключены к своей таблице — сервер запомнит её для входа владельца (чужим почтам не сохранит)
    const r = await post({ login: { id_token: token, nonce, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "" , setup: own || undefined, own: 1 } }, 90000)
    wait.close()
    if (!r.ok) return ui.info("Не получилось войти", (r.error || "сервер не ответил") + "\n\nНажмите «Войти через Google» ещё раз.")
    // владелец: сервер вернул код его основной таблицы — подключаемся к ней, как кодом из виджета
    if (r.owner && r.setup) {
      D.gLink = Date.now(); save(false)
      if (own) return ui.info("Вход Google привязан", `Теперь на любом телефоне достаточно «Войти через Google» почтой ${r.me && r.me.email || ""}: откроется ваша основная таблица со всеми записями.`)
      return connect(r.setup)
    }
    if (own && await ui.confirm("Это другой аккаунт", `<div class="msg">Почта ${esc(r.me && r.me.email || "")} — не ваша основная. Если перейти, календарь и записи будут из отдельного аккаунта друзей.</div>`, ["Оставить свою таблицу", "Перейти"]) !== "Перейти") return
    if (await isOwner(r.me && r.me.email) && await ownerAsk() === "Подключить виджет") return widget(false)
    D.conn = { hook: CFG.hook, secret: r.secret, key: "srv", routes: [], sheetUrl: "", cfg: null, friend: r.me }
    D.sync = { since: 0, pushedAt: 0, snapAt: 0, at: 0, error: "" }
    save(false)
    pushConn()
    render()
    sync()
    const first = String((r.me && r.me.name) || "").split(" ")[0]
    // почту показываем всегда: в Safari бывает несколько аккаунтов Google (свой, детей), и легко войти не в тот
    const mail = r.me && r.me.email ? `\n\nАккаунт: ${r.me.email}. Не тот? Настройки → Аккаунт → «Выйти» и войдите снова, выбрав другую почту.` : ""
    ui.info(r.isNew ? `Готово${first ? ", " + first : ""}!` : `С возвращением${first ? ", " + first : ""}!`,
      (r.isNew ? `Всё настроено само: календарь, деньги, здоровье и ${iziName()}. Нажмите на ${iziName()} внизу и расскажите, что у вас сегодня.`
        : "Ваши записи снова здесь.") + mail)
  }

  // ── Google Календарь друга: по желанию, отдельной кнопкой (вход по-прежнему просит только имя и почту) ──
  const GCAL_SCOPES = "openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly"
  const home = () => location.origin + location.pathname.replace(/index\.html$/, "")
  async function gcalConnect() {
    const m = me()
    if (!m || !on()) return
    const b = await ui.confirm("Подключить Google Календарь", `<div class="msg">Ваши встречи из Google Календаря появятся в IZIDAY, а то, что вы добавите здесь или через ${esc(iziName())}, — в Google Календаре на всех устройствах.<br><br>Google спросит разрешение. Если он напишет «Приложение не проверено» — нажмите «Дополнительно» → «Перейти на iziday.pages.dev»: проверка IZIDAY у Google ещё идёт.</div>`, ["Позже", "Подключить"])
    if (b !== "Подключить") return
    const state = rnd()
    try { localStorage.setItem("izi-gcstate", JSON.stringify({ state, at: Date.now() })) } catch (e) {}
    const q = new URLSearchParams({ client_id: CFG.client, redirect_uri: home(), response_type: "code", scope: GCAL_SCOPES, access_type: "offline", prompt: "consent",
      include_granted_scopes: "true", state, login_hint: m.email || "" })
    location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + q
  }
  // Google вернул на сайт: ?code=…&state=… (или ?error=…) — код уходит на сервер и меняется там на постоянный доступ
  async function gcalFinish(search) {
    const p = new URLSearchParams(String(search || "").replace(/^\?/, ""))
    let st = {}
    try { st = JSON.parse(localStorage.getItem("izi-gcstate") || "{}") || {}; localStorage.removeItem("izi-gcstate") } catch (e) {}
    if (!me()) return
    if (p.get("error")) { if (p.get("error") !== "access_denied") toast("Google не дал доступ: " + p.get("error")); return }
    if (!p.get("code") || !st.state || st.state !== p.get("state")) return ui.info("Календарь не подключён", "Google вернул ответ не на это нажатие. Нажмите «Подключить Google Календарь» ещё раз.")
    if (!/calendar\.events/.test(p.get("scope") || "calendar.events")) return ui.info("Календарь не подключён", "Без галочки «Календарь» IZIDAY не увидит ваши встречи. Подключите ещё раз и оставьте её включённой.")
    const wait = sheet(`<h3>Подключаю Google Календарь…</h3><div class="msg">Это несколько секунд.</div>`)
    const r = await post({ secret: D.conn.secret, gcal: { code: p.get("code"), redirect_uri: home() } }, 90000)
    wait.close()
    if (!r.ok) return ui.info("Календарь не подключён", (r.error || "сервер не ответил") + "\n\nНажмите «Подключить Google Календарь» ещё раз.")
    if (r.me) D.conn.friend = r.me
    D.gcal = null; calForce = true; save(false); render(); sync()
    ui.info("Google Календарь подключён", `Встречи из ${r.me && r.me.gcal || "Google"} теперь в IZIDAY.` + (r.moved ? ` ${r.moved} ${plural(r.moved, "событие", "события", "событий")} из IZIDAY ${r.moved % 10 === 1 && r.moved % 100 !== 11 ? "перенесено" : "перенесены"} в Google Календарь.` : ""))
  }
  async function gcalOff() {
    const b = await ui.confirm("Отключить Google Календарь?", `<div class="msg">IZIDAY перестанет видеть ваши встречи и потеряет доступ к календарю. Сами события останутся в Google Календаре.</div>`, ["Отмена", "Отключить"])
    if (b !== "Отключить") return
    const r = await post({ secret: D.conn.secret, gcal: { off: 1 } })
    if (!r.ok) return ui.info("Не получилось", r.error || "сервер не ответил")
    if (r.me) D.conn.friend = r.me
    D.gcal = null; calForce = true; save(false); render(); sync()
    toast("Google Календарь отключён")
  }

  async function logout() {
    const b = await ui.confirm("Выйти?", `<div class="msg">Записи останутся на сервере IZIDAY: войдите снова той же почтой Google — и всё вернётся.</div>`, ["Отмена", "Выйти"])
    if (b !== "Выйти") return
    if (D.conn && D.conn.secret) post({ secret: D.conn.secret, logout: 1 })
    D = {}; localStorage.removeItem(STORE); load(); render()
  }

  // Изи для друзей: запрос к Claude уходит на сервер, ключ и модель — у владельца
  async function ai(body, signal) {
    const r = await fetch(D.conn.hook, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, credentials: "omit", cache: "no-store", signal,
      body: JSON.stringify({ secret: D.conn.secret, ai: body }) })
    const j = JSON.parse(await r.text())
    if (j && j.ok === false && j.error === "forbidden") return { type: "error", error: { type: "forbidden", message: "вход устарел — войдите через Google заново (Настройки → Аккаунт)" } }
    return j
  }
  // сколько запросов к Изи осталось сегодня — для Настроек, не чаще раза в 10 минут
  let meAt = 0
  async function refresh() {
    if (!me() || Date.now() - meAt < 600e3) return
    meAt = Date.now()
    const r = await post({ secret: D.conn.secret, me: 1 })
    if (r.ok && r.me && D.conn) { D.conn.friend = r.me; save(false); if (tab === "more") render() }
  }

  function ask() {
    return ui.confirm("Войдите через Google", `<div class="msg">Так ${esc(iziName())} узнает, что это вы, и всё настроится само: календарь, деньги, здоровье. Это одна кнопка.</div>`, ["Позже", "Войти"])
      .then(b => { if (b === "Войти") login() })
  }
  const banner = () => `<div class="banner"><b>Войдите через Google</b>Одна кнопка — и всё настроится само: календарь, деньги, здоровье и помощник ${esc(iziName())}. Ничего устанавливать не нужно.
    <div class="btns" style="margin-top:8px"><button class="btn primary" data-do="glogin">${GICO}Войти через Google</button></div></div>`
  function card() {
    const m = me()
    if (!m) return `<div class="card"><h2>Аккаунт</h2><div class="muted small">Войдите через Google: IZIDAY сам заведёт вам календарь, деньги, здоровье и подключит ${esc(iziName())}.</div>
      <div class="btns" style="margin-top:10px"><button class="btn primary" data-do="glogin">${GICO}Войти через Google</button></div>
      <div class="btns" style="margin-top:6px"><button class="btn small" data-fw="1">У меня есть виджет Scriptable</button></div></div>`
    setTimeout(refresh, 50)
    return `<div class="card"><h2>Аккаунт</h2>
      <div class="set"><span>${esc(m.name || "Вы")}</span><span class="ok">✓ ${esc(m.email || "")}</span></div>
      <div class="set"><span>Календарь</span><span>${m.gcal ? `<span class="ok">✓ Google · ${esc(m.gcal)}</span>` : gcalOn() ? `<span class="ok">✓ внутри IZIDAY</span>` : "загружается"}</span></div>
      ${D.gcal && D.gcal.error ? `<div class="msg exp small">${esc(D.gcal.error)}</div>` : ""}
      <div class="btns" style="margin-top:6px">${m.gcal ? `<button class="btn small" data-gc="off">Отключить Google Календарь</button>` : `<button class="btn small" data-gc="on">${GICO}Подключить Google Календарь</button>`}</div>
      <div class="set"><span>${esc(iziName())} сегодня</span><span>${m.left != null ? `ещё ${m.left} ${plural(m.left, "запрос", "запроса", "запросов")}` : "на связи"}</span></div>
      <div class="set"><span>Последний обмен</span><span>${esc(ago(D.sync.at))}</span></div>
      ${D.sync.error ? `<div class="msg exp small">${esc(D.sync.error)}</div>` : ""}
      <div class="btns" style="margin-top:10px"><button class="btn" data-do="sync">${ei("sync")}Обменяться сейчас</button><button class="btn red" data-do="glogout">Выйти</button></div>
      <div class="btns" style="margin-top:6px"><button class="btn small" data-fw="1">У меня свой виджет Scriptable</button></div>
      <div class="muted small" style="margin-top:8px">Записи хранятся на сервере IZIDAY в вашем личном разделе. Войдите той же почтой на другом телефоне — и всё будет там.</div></div>`
  }

  // вернулись от Google: index.html положил ответ в sessionStorage
  let pending = null
  try { pending = sessionStorage.getItem("izi-glogin"); sessionStorage.removeItem("izi-glogin") } catch (e) {}
  let gcPending = null
  try { gcPending = sessionStorage.getItem("izi-gcal"); sessionStorage.removeItem("izi-gcal") } catch (e) {}
  document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-fw]"); if (b) { e.stopPropagation(); widget() } }, true)
  document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-gc]"); if (b) { e.stopPropagation(); if (b.dataset.gc === "hide") { D.gcHide = Date.now(); save(false); render() } else b.dataset.gc === "off" ? gcalOff() : gcalConnect() } }, true)
  if (gcPending) setTimeout(() => gcalFinish(gcPending), 300)
  else if (pending) setTimeout(() => finish(pending), 300)
  // владелец по ошибке вошёл через Google (пустой аккаунт друзей) — при запуске предлагаем вернуться к своему виджету
  else setTimeout(async () => {
    try { if (me() && !sessionStorage.getItem("izi-own") && await isOwner(me().email)) { sessionStorage.setItem("izi-own", "1"); if (await ownerAsk() === "Подключить виджет") widget(false) } } catch (e) {}
  }, 1500)

  return { on, me, login, logout, finish, ai, ask, banner, card, widget, gcalConnect, gcalFinish, gico: GICO }
})()
