// Недочёты: кнопка «Сообщить о недочёте» в Настройках + журнал последних ошибок приложения (уходит вместе с отчётом).
// Отдельный файл: код приложения не меняется. Форма — bug.html (тот же адрес, работает и без входа).
(() => {
  const LOG = "izi.errlog"
  let tab = "today"
  // последняя вкладка до Настроек — чтобы форма сразу знала, где был недочёт
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("#tabs [data-tab]")
    if (b) tab = b.dataset.tab
    if (e.target.closest && e.target.closest("#talk, .talk, [data-do=talk]")) tab = "talk"
  }, true)
  function note(m) {
    try {
      const a = JSON.parse(localStorage.getItem(LOG) || "[]") || []
      const t = new Date().toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      m = String(m || "").slice(0, 240)
      if (a.length && a[a.length - 1].m === m) return
      a.push({ t, tab, m }); localStorage.setItem(LOG, JSON.stringify(a.slice(-15)))
    } catch (e) {}
  }
  addEventListener("error", e => { if (e.message) note(`${e.message}${e.filename ? " @" + String(e.filename).split("/").pop() + ":" + e.lineno : ""}`) })
  addEventListener("unhandledrejection", e => { const r = e.reason; note("promise: " + (r && (r.message || r)) ) })

  const open = () => { location.href = "bug.html?from=app&where=" + encodeURIComponent(tab) }
  window.IZIBUG = { open, note }
  const CARD = `<div class="card" id="bug-card"><h2>Нашли недочёт?</h2>
    <div class="muted small">Расскажите, что пошло не так, — можно со скриншотом. Это займёт минуту.</div>
    <div class="btns" style="margin-top:10px"><button class="btn primary" type="button" data-bug="1">Сообщить о недочёте</button></div></div>`
  function inject() {
    const gear = document.getElementById("gear"), view = document.getElementById("view")
    if (!gear || !view || !gear.classList.contains("on") || document.getElementById("bug-card")) return
    view.insertAdjacentHTML("afterbegin", CARD)
  }
  document.addEventListener("click", e => { if (e.target.closest && e.target.closest("[data-bug]")) { e.preventDefault(); open() } })
  const start = () => { const v = document.getElementById("view"); if (!v) return
    new MutationObserver(inject).observe(v, { childList: true }); new MutationObserver(inject).observe(document.getElementById("gear"), { attributes: true, attributeFilter: ["class"] }); inject() }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start()
})()
