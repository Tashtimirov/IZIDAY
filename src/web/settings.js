// Настройки по группам: «Изи», «Приложение», «Аккаунт», «Для владельца» (раньше 15 карточек подряд вперемешку).
// Карточки собирают разные части приложения: одни дописывают разметку в renderMore, другие вставляют карточку
// после отрисовки. Поэтому раскладываем уже готовый экран: после каждой перерисовки «Настроек» ставим карточки
// по группам. Признаки — классы и кнопки карточки, а не заголовок (заголовок переводится на английский).
"use strict"
;(function () {
  const GROUPS = [["izi", "Изи"], ["app", "Приложение"], ["acct", "Аккаунт"], ["owner", "Для владельца"]]
  const q = (el, s) => { try { return !!el.querySelector(s) } catch (e) { return false } }
  function groupOf(el) {
    if (el.id === "bug-card" || el.classList.contains("banner")) return "top"
    if (el.dataset.grp) return el.dataset.grp
    if (el.classList.contains("izi-card") || el.id === "fkey" || el.classList.contains("fcard")) return "izi"
    if (q(el, '[data-do="connect"], [data-do="run-widget"]')) return "owner"
    if (q(el, '[data-do="glogin"], [data-do="glogout"], [data-fw]')) return "acct"
    return "app"
  }
  // порядок внутри «Приложения»: язык, валюта, размер текста, уведомления, блоки, игра, знакомство, статистика
  const rank = el => q(el, '[data-do="lang-pick"]') ? 0 : q(el, '[data-do="cur-pick"]') ? 1 : el.classList.contains("ds-ts") ? 2 : q(el, "#push-state") ? 3
    : el.classList.contains("bk-set") ? 4 : el.classList.contains("goff") ? 5 : q(el, "[data-onb-who]") ? 6 : el.classList.contains("mtr") ? 8 : 7
  let busy = false
  function arrange() {
    const v = document.getElementById("view")
    if (busy || !v || typeof tab === "undefined" || tab !== "more") return
    const kids = [...v.children].filter(el => !el.classList.contains("set-grp"))
    if (!kids.length) return
    const by = { top: [], izi: [], app: [], acct: [], owner: [] }, tail = []
    kids.forEach(el => { if (el.classList.contains("app-ver")) tail.push(el); else (by[groupOf(el)] || by.app).push(el) })
    by.app = by.app.map((el, i) => [rank(el), i, el]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2])
    const want = [...by.top]
    for (const [k, name] of GROUPS) if (by[k].length) {
      let h = v.querySelector(`:scope > .set-grp[data-g="${k}"]`)
      if (!h) { h = document.createElement("div"); h.className = "set-grp"; h.dataset.g = k; h.textContent = name }
      want.push(h, ...by[k])
    }
    want.push(...tail)
    const now = [...v.children]
    if (now.length === want.length && now.every((el, i) => el === want[i])) return
    busy = true
    try {
      v.querySelectorAll(":scope > .set-grp").forEach(h => { if (!want.includes(h)) h.remove() })
      want.forEach(el => v.appendChild(el))
    } finally { busy = false }
  }
  const start = () => { const v = document.getElementById("view"); if (!v) return
    new MutationObserver(() => arrange()).observe(v, { childList: true }); arrange() }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start()
})()
