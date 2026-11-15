// IZIDAY · «Выйти» на этом телефоне — для всех: вход через Google, свой виджет, без входа (только телефон), семья и детский режим.
// Выход ≠ удаление аккаунта: записи на сервере IZIDAY, в таблице и в семье остаются, стирается только этот телефон.
// Кто не входил ни через Google, ни виджетом, хранит всё только здесь — его предупреждаем и даём сначала войти через Google.
// Подключается после app.js, friends.js, family.js; кнопки: Настройки → «Выход» (EXIT.card), детский «Мой день» (KDO.out).
window.EXIT = (() => {
  const mode = () => {
    const c = D.conn
    if (window.FAM && FAM.kidMode && FAM.kidMode()) return "kid"
    if (c && c.friend) return "google"
    if (c && c.hook) return "widget"
    return "local"
  }
  const DOOR = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;vertical-align:-3px" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/></svg>`
  const inFam = () => !!(D.fam && D.fam.code)
  const albumPh = () => (D.goals || []).some(g => g && g.kind === "daynote" && g.ph && !g.deleted)
  const TXT = {
    google: () => `Записи останутся на сервере IZIDAY. Войдите снова той же почтой Google — и всё вернётся.`,
    widget: () => `Ключи удалятся с этого телефона. Записи останутся в таблице и в виджете: чтобы вернуться, вставьте код из виджета снова.`,
    local: () => `Вы не входили через Google, поэтому записи хранятся только на этом телефоне. После выхода они сотрутся.`,
  }

  // Стереть этот телефон: данные приложения, ключ сейфа (обёртки сейфа живут в записях и вернутся при входе), фото альбома
  async function wipe() {
    try { ttsStop() } catch (e) {}
    for (const k of [STORE, "izi-kq", "izi-kth", "izi-gstate", "izi-gcstate", "gamiTold"]) try { localStorage.removeItem(k) } catch (e) {}
    for (const db of ["iziday-vault", "iziday-album", "iziday-chat"]) try { indexedDB.deleteDatabase(db) } catch (e) {}
    try { document.body.classList.remove("kidm"); delete document.body.dataset.kth; const n = $("#knav"); if (n) n.remove() } catch (e) {}
    try { while (stack.length) stack[stack.length - 1].close() } catch (e) {}
    D = {}; load(); setTab("today"); render(); window.scrollTo(0, 0)
  }

  async function out() {
    const m = mode()
    if (m === "kid") {
      const b = await ui.confirm("Выйти из IZIDAY?", `<div class="msg">Твои звёзды, дела и копилки останутся в семье. Чтобы вернуться, попроси маму или папу снова показать тебе шар Изи.</div>`, ["Остаться", "Выйти"])
      if (b !== "Выйти") return
      return wipe()
    }
    const fam = inFam() ? `<div class="msg small muted">Семья останется. Чтобы вернуться в неё на этом телефоне, отсканируйте шар Изи ещё раз.</div>` : ""
    const ph = m !== "local" && albumPh() ? `<div class="msg small muted">Фото «Снимка дня» хранятся только на этом телефоне — они сотрутся.</div>` : ""
    if (m === "local") {
      const g = window.FRIEND && FRIEND.on()
      const b = await ui.confirm("Выйти из IZIDAY?", `<div class="msg">${TXT.local()}</div>${g ? `<div class="msg small">Чтобы сохранить их, сначала войдите через Google: тогда после выхода всё вернётся одной кнопкой.</div>` : ""}${fam}`,
        g ? ["Отмена", "Выйти и стереть", "Войти через Google"] : ["Отмена", "Выйти и стереть"])
      if (b === "Войти через Google") return FRIEND.login()
      if (b !== "Выйти и стереть") return
      if (await ui.confirm("Точно стереть?", `<div class="msg">Дела, деньги, здоровье и разговоры с ${esc(iziName())} на этом телефоне удалятся. Вернуть их будет нельзя.</div>`, ["Отмена", "Стереть"]) !== "Стереть") return
      return wipe()
    }
    const b = await ui.confirm("Выйти из IZIDAY?", `<div class="msg">${TXT[m]()}</div>${fam}${ph}`, ["Отмена", "Выйти"])
    if (b !== "Выйти") return
    if (m === "google" && D.conn.secret && window.FRIEND) try { fetch(FRIEND.hook(), { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, credentials: "omit", cache: "no-store", keepalive: true, body: JSON.stringify({ secret: D.conn.secret, logout: 1 }) }).catch(() => {}) } catch (e) {}
    await wipe()
    toast("Вы вышли")
  }

  // Карточка внизу Настроек: всегда видна, подпись меняется по способу входа
  function card() {
    const m = mode(), c = D.conn
    const who = m === "google" ? `Вы вошли как ${esc((c.friend && c.friend.email) || "")}` : m === "widget" ? "Подключено к своему виджету" : "Без входа: записи только на этом телефоне"
    return `<div class="card exit-card"><h2>Выход</h2><div class="muted small">${who}.</div>
      <div class="btns" style="margin-top:10px"><button class="btn exit-btn" data-do="exit">${DOOR}Выйти из IZIDAY</button></div>
      <div class="muted small" style="margin-top:8px">${m === "local" ? "Перед выходом можно войти через Google, чтобы ничего не потерять." : "Записи не удаляются: войдите снова — и всё вернётся."}</div></div>`
  }
  return { out, card, mode, wipe }
})()
// Карточка — самая последняя в Настройках (после всех карточек, что добавляют другие файлы), над подписью внизу
addEventListener("load", () => {
  const f0 = renderMore, FOOT = /<div class="muted small" style="text-align:center;margin:14px 0">[^<]*<\/div>/
  renderMore = function () { const html = f0.apply(this, arguments), m = html.match(FOOT); return html.replace(FOOT, "") + EXIT.card() + (m ? m[0] : "") }
  if (tab === "more") render()
})
DO.exit = () => EXIT.out()
DO.glogout = () => EXIT.out()
DO.disconnect = () => EXIT.out()
