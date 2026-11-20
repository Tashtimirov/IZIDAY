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
    const m = /[?&]r=([0-9a-zA-Z]{3,16})(?:&|$)/.exec(location.search)   // 6 знаков у друзей, понятный код (ANNA) у партнёров
    if (m) {
      localStorage.setItem(REFK, JSON.stringify({ c: m[1].toLowerCase(), at: Date.now() }))
      history.replaceState(null, "", location.pathname + location.search.replace(/([?&])r=[0-9a-zA-Z]{3,16}&?/, "$1").replace(/[?&]$/, "") + location.hash)
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
    const l = D.plusLead, pl = refInfo && refInfo.plus
    const head = `<div class="card grow-card"><h2>${T("IZIDAY Плюс", "IZIDAY Plus")}</h2>` + (pl ? `<div class="set"><span>${T("Плюс уже работает", "Plus is active")}</span><span class="ok">${esc(plusTill(pl))}</span></div>` : "")
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
  const ST = { wait: ["ждёт одобрения", "awaiting approval"], ok: ["доступ открыт", "access granted"], in: ["в IZIDAY", "joined"], no: ["отказано", "declined"], act: ["бонус начислен", "bonus granted"] }
  const LV = { "Друг": "Friend", "Проводник": "Guide", "Амбассадор": "Ambassador" }
  const lvName = n => T(n, LV[n] || n)
  const dt = t => new Date(t).toLocaleDateString(window.L ? L.loc : "ru-RU", { day: "numeric", month: "long" })
  const plusTill = pl => pl.forever ? T("навсегда", "forever") : T("до ", "until ") + dt(pl.until)
  const daysW = n => T(`${n} ${plural(n, "день", "дня", "дней")}`, `${n} day${n === 1 ? "" : "s"}`)
  const MON = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]
  const MON_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  function bar(have, need) { const p = need ? Math.min(100, Math.round(have / need * 100)) : 100; return `<div class="gr-bar"><i style="width:${p}%"></i></div>` }
  function invCard() {
    if (!friend()) return ""
    if (!refInfo || Date.now() - refAt > 600e3) setTimeout(() => refLoad(), 60)
    const r = refInfo
    if (!r || !r.ok) return `<div class="card grow-card"><h2>${T("Пригласить друга", "Invite a friend")}</h2><div class="muted small">${T("Загружаю…", "Loading…")}</div></div>`
    const rule = r.invitee ? T(`Друг получит ${daysW(r.invitee)} Плюса, вы тоже, когда он проведёт в IZIDAY ${daysW(r.days)}.`, `Your friend gets ${daysW(r.invitee)} of Plus, and so do you, once they've used IZIDAY for ${daysW(r.days)}.`)
      : T(`Вы получите ${daysW(r.inviter)} Плюса, когда друг проведёт в IZIDAY ${daysW(r.days)}.`, `You get ${daysW(r.inviter)} of Plus once your friend has used IZIDAY for ${daysW(r.days)}.`)
    const st = r.status ? `<span class="gr-lv lv${r.lv}">${esc(lvName(r.status))}</span>` : ""
    const nx = r.next ? `<div class="gr-next"><div class="set"><span>${T(`До статуса «${esc(lvName(r.next.n))}»`, `To “${esc(lvName(r.next.n))}”`)}</span><span>${r.act} ${T("из", "of")} ${r.next.need}</span></div>${bar(r.act, r.next.need)}</div>` : ""
    const mine = r.myDays != null ? `<div class="set"><span>${T("Ваш бонус за вход по приглашению", "Your invite bonus")}</span><span>${r.myDays} ${T("из", "of")} ${daysW(r.days)}</span></div>${bar(r.myDays, r.days)}` : ""
    const rows = (r.list || []).map(x => {
      const v = x.st === "in" && x.d < r.days ? `${x.d} ${T("из", "of")} ${daysW(r.days)}` : T(...(ST[x.st] || ["", ""]))
      return `<div class="set"><span>${esc(x.name || "—")}</span><span class="${x.st === "act" || x.st === "ok" ? "ok" : x.st === "no" ? "exp" : "muted"}">${esc(v)}</span></div>` }).join("")
    const fam = r.fam ? `<div class="muted small gr-note">${r.fam.head ? T(`Вы глава семьи: ваш Плюс действует на всю семью (до ${r.fam.max} человек). За каждого взрослого, кто проведёт в IZIDAY ${daysW(r.days)}, вам ${daysW(r.famDays)} Плюса.`, `You're the family head: your Plus covers the whole family (up to ${r.fam.max} people). For each adult who uses IZIDAY for ${daysW(r.days)}, you get ${daysW(r.famDays)} of Plus.`)
      : r.plus && r.plus.fam ? T("Плюс действует от главы вашей семьи.", "Your Plus comes from your family head.") : ""}</div>` : ""
    const pt = r.partner ? `<div class="gr-partner"><div class="set"><span>${T("Партнёрский код", "Partner code")}</span><b>${esc(r.partner.code)}</b></div>
      <div class="set"><span>${T("Вошли по коду", "Joined with code")}</span><span>${r.partner.joined}</span></div><div class="set"><span>${T(`Активны ${daysW(r.days)}`, `Active ${daysW(r.days)}`)}</span><span>${r.partner.active}</span></div>
      <div class="muted small">${T("Подписчики входят по вашей ссылке без ожидания. Условия партнёрства — в договоре.", "Your followers join with your link without waiting. Partnership terms are in your agreement.")}</div></div>` : ""
    return `<div class="card grow-card gr-card"><div class="gr-head"><h2>${T("Приглашайте друзей", "Invite friends")}</h2>${st}</div>
      ${r.plus ? `<div class="set"><span>${T("IZIDAY Плюс", "IZIDAY Plus")}</span><span class="ok">${esc(plusTill(r.plus))}</span></div>` : ""}
      <div class="muted small">${rule}</div>
      ${mine}${nx}${pt}
      ${r.partner ? "" : `<div class="set"><span>${T("Осталось приглашений", "Invites left")}</span><span>${r.left} ${T("из", "of")} ${r.per}</span></div>`}
      ${rows}${fam}
      <div class="btns" style="margin-top:10px"><button class="btn primary" data-grow="inv"${r.left <= 0 ? " disabled" : ""}>${ei("send")}${T("Пригласить", "Invite")}</button><button class="btn" data-grow="card">${T("Карточка дня", "Day card")}</button></div>
      <div class="btns gr-links"><button class="btn small" data-grow="league">${T("Лига приглашений", "Invite league")}${r.league && r.league.place ? " · " + T(`${r.league.place}-е место`, `#${r.league.place}`) : ""}</button><button class="btn small" data-grow="how">${T("Как это работает", "How it works")}</button></div></div>`
  }
  async function invite() {
    act("Пригласить: нажал")
    const r = await refLoad(true)
    if (!r || !r.ok) return ui.info(T("Не получилось", "Something went wrong"), (r && r.error) || T("сервер не ответил", "no response from the server"))
    if (r.left <= 0) return ui.info(T("Приглашения закончились", "No invites left"), T("Новые приглашения появятся со следующим статусом. Или напишите создателю IZIDAY.", "You'll get more invites with your next status. Or message the IZIDAY creator."))
    const text = T("Пользуюсь IZIDAY: день, деньги, здоровье и помощник Изи в одном приложении. Вот приглашение:", "I use IZIDAY: my day, money, health and the Izi assistant in one app. Here's an invite:")
    try {
      if (navigator.share) { await navigator.share({ title: "IZIDAY", text, url: r.link }); act("Пригласить: отправил"); return }
    } catch (e) { if (e && e.name === "AbortError") return }
    try { await navigator.clipboard.writeText(text + " " + r.link); toast(T("Ссылка скопирована, отправьте её другу", "Link copied, send it to your friend")); act("Пригласить: скопировал") }
    catch (e) { ui.info(T("Ссылка-приглашение", "Invite link"), r.link) }
  }
  // ── Как это работает: правила одним окном ──
  function how() {
    const r = refInfo || {}, d = r.days || 7
    const li = (a, b) => `<div class="gr-rule"><b>${a}</b><span>${b}</span></div>`
    sheet(`<h3>${T("Как это работает", "How it works")}</h3>
      ${li(T("Приглашение", "Invite"), r.invitee ? T(`Друг проводит в IZIDAY ${daysW(d)}, и вы оба получаете по ${daysW(r.invitee)} Плюса. За одну регистрацию бонуса нет.`, `When your friend uses IZIDAY for ${daysW(d)}, you both get ${daysW(r.invitee)} of Plus. Signing up alone doesn't count.`)
        : T(`Друг проводит в IZIDAY ${daysW(d)}, и вы получаете ${daysW(r.inviter || 30)} Плюса.`, `When your friend uses IZIDAY for ${daysW(d)}, you get ${daysW(r.inviter || 30)} of Plus.`))}
      ${li(T("Друзья друзей", "Friends of friends"), T(`Если ваш друг кого-то пригласил, вам ещё ${daysW(r.l2days || 3)}. Только один шаг: дальше бонусов нет.`, `If your friend invites someone, you get ${daysW(r.l2days || 3)} more. One step only, nothing further down.`))}
      ${li(T("Статусы", "Statuses"), T("Друг: 1 активный приглашённый, +2 приглашения. Проводник: 3, +5 приглашений. Амбассадор: 10, Плюс навсегда и ранний доступ к новому.", "Friend: 1 active invitee, +2 invites. Guide: 3, +5 invites. Ambassador: 10, Plus forever and early access."))}
      ${li(T("Семья", "Family"), T(`Создатель семьи — её глава. Его Плюс действует на всю семью. За каждого взрослого, кто проведёт в IZIDAY ${daysW(d)}, главе ${daysW(r.famDays || 7)}.`, `The family creator is its head. Their Plus covers the whole family. For each adult who uses IZIDAY for ${daysW(d)}, the head gets ${daysW(r.famDays || 7)}.`))}
      ${li(T("Лига месяца", "Monthly league"), T("Рейтинг по активным приглашённым за месяц. Первые три места получают 30, 14 и 7 дней Плюса.", "Ranking by active invitees this month. Top three get 30, 14 and 7 days of Plus."))}
      ${li(T("Партнёрам", "Partners"), T("Блогерам и коучам даём свой код и условия по договору. Напишите создателю IZIDAY.", "Bloggers and coaches get their own code and terms by agreement. Message the IZIDAY creator."))}
      <div class="muted small" style="margin-top:8px">${T("Бонусы — дни IZIDAY Плюс. Деньги за приглашения не платим.", "Bonuses are days of IZIDAY Plus. We don't pay money for invites.")}</div>
      ${(r.bon || []).length ? `<h3 style="margin-top:14px">${T("Ваши бонусы", "Your bonuses")}</h3>` + r.bon.map(b => `<div class="set"><span>${esc(b.w)}</span><span class="ok">+${daysW(b.d)}</span></div>`).join("") : ""}
      <div class="btns"><button class="btn primary" data-a="ok">${T("Понятно", "Got it")}</button></div>`).el.querySelector('[data-a="ok"]').onclick = () => stack[stack.length - 1].close()
    act("Рост: правила")
  }
  // ── Лига приглашений месяца ──
  function league() {
    const g = refInfo && refInfo.league
    if (!g) return
    const mi = +g.month.slice(5) - 1, mon = T(MON[mi], MON_EN[mi])
    const rows = g.top.length ? g.top.map((x, i) => `<div class="gr-lg${x.me ? " me" : ""}"><span class="pl">${i + 1}</span><span class="grow">${x.me ? T("Вы", "You") : esc(x.n)}</span><b>${x.c}</b>${g.prize[i] ? `<span class="muted small">+${daysW(g.prize[i])}</span>` : ""}</div>`).join("")
      : `<div class="muted small">${T("В этом месяце пока никого. Первый активный приглашённый выведет вас в лидеры.", "Nobody yet this month. Your first active invitee puts you on top.")}</div>`
    const me = g.place > 5 ? `<div class="gr-lg me"><span class="pl">${g.place}</span><span class="grow">${T("Вы", "You")}</span><b>${g.mine}</b></div>` : ""
    sheet(`<h3>${T("Лига приглашений", "Invite league")}</h3>
      <div class="muted small"><b>${esc(mon[0].toUpperCase() + mon.slice(1))}.</b> ${T(`Считаются друзья, которые провели в IZIDAY ${daysW(refInfo.days)}. Первые три места 1-го числа получают ${g.prize.join(", ")} дней Плюса.`, `Counts friends who used IZIDAY for ${daysW(refInfo.days)}. On the 1st, the top three get ${g.prize.join(", ")} days of Plus.`)}</div>
      <div class="gr-lgs">${rows}${me}</div>
      <div class="btns"><button class="btn primary" data-a="ok">${T("Понятно", "Got it")}</button></div>`).el.querySelector('[data-a="ok"]').onclick = () => stack[stack.length - 1].close()
    act("Рост: лига")
  }
  // ── Карточка дня с реферальной ссылкой: картинка 1080×1350, без названий дел и сумм ──
  function dayStats() {
    let st = null
    try { st = window.GAMI && GAMI.stats && GAMI.stats() } catch (e) {}
    const t = st && st.today || {}
    return { done: (t.clean && t.clean.done) || 0, pts: t.total || 0, streak: (st && st.streak) || 0, week: (st && st.weekPts) || 0 }
  }
  function drawCard(link, gift) {
    const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H
    const x = c.getContext("2d"), dark = matchMedia("(prefers-color-scheme: dark)").matches
    const g = x.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, dark ? "#06110C" : "#F7F2E6"); g.addColorStop(1, dark ? "#0E3324" : "#E8F3EC"); x.fillStyle = g; x.fillRect(0, 0, W, H)
    const fg = dark ? "#F4EEDD" : "#063322", sub = dark ? "#9FB4A6" : "#6E7D72", acc = dark ? "#30D158" : "#0A9F6E"
    // шар: полупрозрачный круг с мягким краем
    const o = x.createRadialGradient(W - 210, 260, 20, W - 210, 260, 230)
    o.addColorStop(0, dark ? "rgba(48,209,88,.55)" : "rgba(10,159,110,.40)"); o.addColorStop(1, "rgba(10,159,110,0)"); x.fillStyle = o; x.beginPath(); x.arc(W - 210, 260, 230, 0, 7); x.fill()
    const font = (w, s) => `${w} ${s}px -apple-system, "SF Pro Display", system-ui, sans-serif`
    x.fillStyle = sub; x.font = font(600, 40); x.fillText("IZIDAY", 90, 140)
    const now = new Date()
    x.fillStyle = fg; x.font = font(700, 84); x.fillText(T("Мой день", "My day"), 90, 270)
    x.fillStyle = sub; x.font = font(500, 44); x.fillText(now.toLocaleDateString(window.L ? L.loc : "ru-RU", { weekday: "long", day: "numeric", month: "long" }), 90, 340)
    const s = dayStats(), cells = [[s.done, T("сделано сегодня", "done today")], [s.streak, T(plural(s.streak, "день подряд", "дня подряд", "дней подряд"), "day streak")], [s.pts, T("очков за день", "points today")], [s.week, T("очков за неделю", "points this week")]]
    cells.forEach(([v, l], i) => {
      const cx = 90 + (i % 2) * 460, cy = 450 + Math.floor(i / 2) * 290
      x.fillStyle = dark ? "rgba(18,52,37,.62)" : "rgba(255,255,255,.75)"; x.beginPath(); x.roundRect ? x.roundRect(cx, cy, 440, 250, 40) : x.rect(cx, cy, 440, 250); x.fill()
      x.fillStyle = i === 1 ? acc : fg; x.font = font(700, 110); x.fillText(String(v), cx + 44, cy + 140)
      x.fillStyle = sub; x.font = font(500, 38); x.fillText(l, cx + 44, cy + 205)
    })
    x.fillStyle = fg; x.font = font(700, 46); x.fillText(T("Попробуй со мной", "Try it with me"), 90, 1120)
    x.fillStyle = sub; x.font = font(500, 38)
    if (gift) x.fillText(gift, 90, 1175)
    x.fillStyle = acc; x.font = font(600, 40); x.fillText(link.replace(/^https?:\/\//, ""), 90, 1250)
    return c
  }
  async function dayCard() {
    act("Рост: карточка")
    const r = await refLoad()
    if (!r || !r.ok) return ui.info(T("Не получилось", "Something went wrong"), (r && r.error) || T("сервер не ответил", "no response from the server"))
    const gift = r.invitee ? T(`${daysW(r.invitee)} Плюса в подарок после ${daysW(r.days)} в IZIDAY`, `${daysW(r.invitee)} of Plus after ${daysW(r.days)} in IZIDAY`) : ""
    const c = drawCard(r.link, gift), url = c.toDataURL("image/png")
    const s = sheet(`<h3>${T("Карточка дня", "Day card")}</h3><img class="gr-img" src="${url}" alt="">
      <div class="muted small">${T("На карточке только цифры дня, без названий дел и сумм.", "Only the day's numbers are on the card, no task names or amounts.")}</div>
      <div class="btns"><button class="btn" data-a="no">${T("Закрыть", "Close")}</button><button class="btn primary" data-a="ok">${ei("send")}${T("Поделиться", "Share")}</button></div>`)
    $('[data-a="no"]', s.el).onclick = () => s.close()
    $('[data-a="ok"]', s.el).onclick = async () => {
      const text = T("Мой день в IZIDAY. Присоединяйся:", "My day in IZIDAY. Join me:")
      try {
        const blob = await new Promise(ok => c.toBlob(ok, "image/png")), file = new File([blob], "iziday-day.png", { type: "image/png" })
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: text + " " + r.link }); act("Рост: карточка отправлена"); return s.close() }
        if (navigator.share) { await navigator.share({ title: "IZIDAY", text, url: r.link }); act("Рост: карточка отправлена"); return s.close() }
      } catch (e) { if (e && e.name === "AbortError") return }
      const a = document.createElement("a"); a.href = url; a.download = "iziday-day.png"; a.click()
      try { await navigator.clipboard.writeText(text + " " + r.link) } catch (e) {}
      toast(T("Картинка сохранена, ссылка скопирована", "Image saved, link copied"))
    }
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
    const k = b.dataset.grow
    if (k === "plus") plus(); else if (k === "inv") invite(); else if (k === "how") how(); else if (k === "league") league(); else if (k === "card") dayCard()
  }, true)

  return { ref, refDone, loginWait, plusCard, invCard, drawCard, info: () => refInfo, cards: () => plusCard() + invCard() }
})()
