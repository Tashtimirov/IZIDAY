// ───────────── Спрос на подписку и «Пригласить друга» ─────────────
// 1) «IZIDAY Плюс»: подписки пока нет. Карточка в Настройках честно говорит, что это заявка, а не покупка:
//    ничего не списывается, данные карты не нужны. Заявка уходит на общий сервер друзей → таблица «IZIDAY — Заявки и приглашения».
//    Ссылок на оплату нет нигде (для App Store: покупки внутри приложения — только через Apple).
// 2) «Пригласить друга»: у каждого друга своя ссылка iziday.pages.dev/?r=КОД. Новый человек входит через Google,
//    сервер пишет владельцу письмо «Открыть доступ / Отказать». Предел — 3 приглашения на человека (свойство REF_PER).
//    Это не приглашение в семью (шар Изи, family.js): у приглашённого свой отдельный аккаунт, записи он не видит.
"use strict"
window.GROW = (() => {
  const T = (ru, en) => (window.L && L.en ? en : ru)
  const REFK = "izi-ref"
  // ── пришли по ссылке-приглашению: запоминаем код до входа через Google (Google вернёт на адрес без ?r=) ──
  try {
    const m = /[?&]r=([0-9a-fA-F]{6})(?:&|$)/.exec(location.search)
    if (m) {
      localStorage.setItem(REFK, JSON.stringify({ c: m[1].toLowerCase(), at: Date.now() }))
      history.replaceState(null, "", location.pathname + location.search.replace(/([?&])r=[0-9a-fA-F]{6}&?/, "$1").replace(/[?&]$/, "") + location.hash)
    }
  } catch (e) {}
  function ref() {
    try { const r = JSON.parse(localStorage.getItem(REFK) || "null"); if (r && r.c && Date.now() - r.at < 30 * 864e5) return r.c } catch (e) {}
    return ""
  }
  const refDone = () => { try { localStorage.removeItem(REFK) } catch (e) {} }

  const friend = () => window.FRIEND && FRIEND.me && FRIEND.me()
  const owner = () => !!(D.conn && !D.conn.friend)
  const act = (w, i) => { try { window.METRICS && METRICS.act(w, i) } catch (e) {} }
  async function post(body, timeout = 30000) {
    if (!(window.FRIEND && FRIEND.on && FRIEND.on())) return { ok: false, error: T("сервер ещё не настроен", "server is not set up yet") }
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout)
    try {
      const r = await fetch(FRIEND.hook(), { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, credentials: "omit", cache: "no-store", signal: ctl.signal, body: JSON.stringify(body) })
      return JSON.parse(await r.text())
    } catch (e) { return { ok: false, error: e.name === "AbortError" ? T("сервер долго не отвечает", "the server takes too long") : T("нет связи с сервером", "no connection to the server") } } finally { clearTimeout(t) }
  }
  const anonId = () => {
    try { let v = localStorage.getItem("izi-anon"); if (!/^[0-9a-f]{16}$/.test(v || "")) { v = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, "0")).join(""); localStorage.setItem("izi-anon", v) } return v } catch (e) { return "" }
  }

  // ── IZIDAY Плюс: заявка ──
  const PRICES = [["до 3 $", "up to $3"], ["около 5 $", "about $5"], ["6,99 $ — нормально", "$6.99 is fine"], ["10 $ и больше", "$10 or more"], ["Пока не знаю", "Not sure yet"]]
  function plusCard() {
    const l = D.plusLead
    const head = `<div class="card grow-card"><h2>${T("IZIDAY Плюс", "IZIDAY Plus")}</h2>`
    const what = `<div class="grow-price">${T("6,99 $ в месяц", "$6.99 per month")}<span>${T("скоро, после теста", "coming after the test")}</span></div>
      <div class="muted small">${T(`В подписке: ${esc(iziName())} без дневного лимита и живой разговор голосом без ограничений.`, `Includes: ${esc(iziName())} with no daily limit and unlimited live voice chat.`)}</div>`
    if (l && l.at) return head + what + `<div class="set"><span>${T("Ваша заявка", "Your request")}</span><span class="ok">✓ ${esc(new Date(l.at).toLocaleDateString(window.L ? L.loc : "ru-RU", { day: "numeric", month: "long" }))}</span></div>
      <div class="muted small">${T("Напишем, когда подписка откроется. Сейчас ничего не списывается.", "We'll let you know when it opens. Nothing is charged now.")}</div>
      <div class="btns" style="margin-top:8px"><button class="btn small" data-grow="plus">${T("Изменить ответ о цене", "Change price answer")}</button></div></div>`
    return head + what + `<div class="muted small" style="margin-top:6px">${T("Сейчас IZIDAY бесплатный. Это не покупка: оставьте заявку, и мы напишем, когда подписка откроется. Денег не берём, карта не нужна.",
      "IZIDAY is free right now. This is not a purchase: leave a request and we'll tell you when the subscription opens. No payment, no card.")}</div>
      <div class="btns" style="margin-top:10px"><button class="btn primary" data-grow="plus">${T("Оставить заявку", "Leave a request")}</button></div></div>`
  }
  async function plus() {
    act("Плюс: открыл")
    let pick = D.plusLead && D.plusLead.price || "", v = null
    const chips = PRICES.map(p => `<button class="chip${pick === p[0] ? " on" : ""}" data-pp="${esc(p[0])}">${esc(T(p[0], p[1]))}</button>`).join("")
    const s = sheet(`<h3>${T("Заявка на IZIDAY Плюс", "IZIDAY Plus request")}</h3>
      <div class="msg">${T("Подписка откроется после теста, цена 6,99 $ в месяц. Сейчас вы ничего не покупаете и ничего не платите: это только заявка. Мы напишем вам, когда подписка появится.",
        "The subscription opens after the test, $6.99 per month. You are not buying or paying anything now: this is just a request. We'll let you know when it's available.")}</div>
      <div class="msg small muted" style="margin-top:4px">${T("Сколько вам было бы комфортно платить в месяц? Необязательно.", "How much would you be comfortable paying per month? Optional.")}</div>
      <div class="chips" style="margin:8px 0 4px">${chips}</div>
      <div class="btns"><button class="btn" data-a="no">${T("Не сейчас", "Not now")}</button><button class="btn primary" data-a="ok">${D.plusLead ? T("Сохранить", "Save") : T("Оставить заявку", "Leave a request")}</button></div>`,
      { onClose: () => done(v) })
    $$("[data-pp]", s.el).forEach(b => b.onclick = () => { pick = pick === b.dataset.pp ? "" : b.dataset.pp; $$("[data-pp]", s.el).forEach(x => x.classList.toggle("on", x.dataset.pp === pick)) })
    $('[data-a="no"]', s.el).onclick = () => s.close()
    $('[data-a="ok"]', s.el).onclick = () => { v = { price: pick }; s.close() }
    async function done(x) {
      if (!x) return act("Плюс: не сейчас")
      if (owner()) { toast(T("Так это видят друзья. Ваша заявка не считается", "This is what friends see. Your own request isn't counted")); return }
      let mi = {}
      try { mi = (window.METRICS && METRICS.info && METRICS.info()) || {} } catch (e) {}
      const r = await post({ secret: friend() && D.conn.secret || undefined, lead: { price: x.price, lang: window.L ? L.lang : "ru", id: anonId(),
        ver: String(mi.ver || ""), dev: String(mi.plat || "") } })
      if (!r.ok) return ui.info(T("Заявка не ушла", "Request not sent"), (r.error || "") + T("\n\nПопробуйте ещё раз чуть позже.", "\n\nPlease try again a bit later."))
      const first = !D.plusLead
      D.plusLead = { at: (D.plusLead && D.plusLead.at) || Date.now(), price: x.price }
      save(false); render()
      act(first ? "Плюс: заявка" : "Плюс: цена", x.price)
      if (first) ui.info(T("Заявка принята", "Request received"), T("Спасибо! Мы напишем, когда подписка откроется. Сейчас ничего не списывается.", "Thank you! We'll let you know when the subscription opens. Nothing is charged now."))
      else toast(T("Сохранено", "Saved"))
    }
  }

  // ── Пригласить друга ──
  let refInfo = null, refAt = 0
  async function refLoad(force) {
    if (!friend()) return null
    if (!force && refInfo && Date.now() - refAt < 600e3) return refInfo
    const r = await post({ secret: D.conn.secret, ref: { op: "get" } })
    if (r.ok) { refInfo = r; refAt = Date.now(); if (tab === "more") render() }
    return r
  }
  const ST = { wait: ["ждёт одобрения", "awaiting approval"], ok: ["доступ открыт", "access granted"], in: ["в IZIDAY", "joined"], no: ["отказано", "declined"] }
  function invCard() {
    if (!friend()) return ""
    if (!refInfo || Date.now() - refAt > 600e3) setTimeout(() => refLoad(), 60)
    const r = refInfo
    const rows = r && r.list && r.list.length ? r.list.map(x => `<div class="set"><span>${esc(x.name || "—")}</span><span class="${x.st === "in" || x.st === "ok" ? "ok" : x.st === "no" ? "exp" : "muted"}">${esc(T(...(ST[x.st] || ["", ""])))}</span></div>`).join("") : ""
    return `<div class="card grow-card"><h2>${T("Пригласить друга", "Invite a friend")}</h2>
      <div class="muted small">${T("Отправьте ссылку знакомому. Создатель IZIDAY откроет ему доступ, и друг войдёт через Google в свой отдельный аккаунт. Это не семья: ваши записи он не увидит.",
        "Send a link to someone you know. Once the IZIDAY creator approves, your friend signs in with Google to their own separate account. This is not family sharing: they won't see your entries.")}</div>
      <div class="set"><span>${T("Осталось приглашений", "Invites left")}</span><span>${r ? `${r.left} ${T("из", "of")} ${r.per}` : "…"}</span></div>
      ${rows}
      <div class="btns" style="margin-top:10px"><button class="btn primary" data-grow="inv"${r && r.left <= 0 ? " disabled" : ""}>${ei("send")}${T("Отправить приглашение", "Send invite")}</button></div></div>`
  }
  async function invite() {
    act("Пригласить: нажал")
    const r = await refLoad(true)
    if (!r || !r.ok) return ui.info(T("Не получилось", "Something went wrong"), (r && r.error) || T("сервер не ответил", "no response from the server"))
    if (r.left <= 0) return ui.info(T("Приглашения закончились", "No invites left"), T("Напишите создателю IZIDAY, если хотите позвать ещё кого-то.", "Message the IZIDAY creator if you'd like to invite someone else."))
    const text = T("Пользуюсь IZIDAY: день, деньги, здоровье и помощник Изи в одном приложении. Вот приглашение:", "I use IZIDAY: my day, money, health and the Izi assistant in one app. Here's an invite:")
    try {
      if (navigator.share) { await navigator.share({ title: "IZIDAY", text, url: r.link }); act("Пригласить: отправил"); return }
    } catch (e) { if (e && e.name === "AbortError") return }
    try { await navigator.clipboard.writeText(text + " " + r.link); toast(T("Ссылка скопирована — отправьте её другу", "Link copied — send it to your friend")); act("Пригласить: скопировал") }
    catch (e) { ui.info(T("Ссылка-приглашение", "Invite link"), r.link) }
  }

  // Ответ сервера на вход через Google с приглашением
  function loginWait(r) {
    if (!r || !r.wait) return false
    ui.info(T("Заявка отправлена", "Request sent"), r.error || "")
    return true
  }

  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-grow]")
    if (!b) return
    e.stopPropagation()
    if (b.dataset.grow === "plus") plus(); else if (b.dataset.grow === "inv") invite()
  }, true)

  return { ref, refDone, loginWait, plusCard, invCard, cards: () => plusCard() + invCard() }
})()
