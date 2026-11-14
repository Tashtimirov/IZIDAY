// Язык интерфейса: русский (как написан код) или английский — переводом на лету.
// Выбор хранится на телефоне (izi-lang). Без выбора: у кого уже есть данные — русский, у новых — по языку телефона.
// Перевод: словарь i18n-en.js (EN_DICT: русская строка → английская; {0}, {1} — вставки). Текст на экране
// переводится до отрисовки (MutationObserver срабатывает раньше, чем браузер рисует кадр).
// Записи пользователя (свои сообщения в чате) не трогаем. Валюта выбирается отдельно — в Настройках.
"use strict"
;(function () {
  const KEY = "izi-lang"
  let lang = ""
  try { lang = localStorage.getItem(KEY) || "" } catch (e) {}
  if (lang !== "ru" && lang !== "en") {
    let had = false
    try { had = !!localStorage.getItem("myday.web") } catch (e) {}
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "ru"
    lang = had || /^(ru|uk|be|kk|ky|uz|tg|tt|ba)\b/i.test(nav) ? "ru" : "en"
  }
  const en = lang === "en"
  const L = window.L = {
    lang, en, loc: en ? "en-US" : "ru-RU",
    set(l) { try { localStorage.setItem(KEY, l) } catch (e) {} },
    t: s => s, miss: new Set(),
  }
  try { document.documentElement.lang = lang } catch (e) {}
  if (!en) return
  // Английский словарь (~280 КБ) грузим только тем, кто выбрал английский: русским он не нужен при запуске.
  // document.write во время разбора страницы ставит его сразу за этим файлом — до bug.js и app.js, как раньше.
  // В кэш оболочки (sw.js) он входит всегда, поэтому английский работает и без сети
  if (!window.EN_DICT) try { document.write('<script src="i18n-en.js"><\/script>') } catch (e) {}

  const CY = /[А-Яа-яЁё]/
  const SEPS = [/([.!?…]+\s+)/, /(\s+[·•|]\s+)/, /(\s+[—–]\s+)/, /(:\s+)/, /(,\s+)/, /(\s*\/\s*|\s*[«»"()]\s*)/]
  let DICT = null, PAT = null, LOW = null
  function init() {
    if (DICT) return true
    const src = window.EN_DICT
    if (!src) return false
    DICT = new Map(); LOW = new Map(); PAT = { pre: new Map(), any: [] }
    for (const k in src) {
      const v = src[k]
      if (!v) continue
      if (/\{\d\}/.test(k)) {
        const parts = k.split(/\{(\d)\}/), idx = []
        let re = "^"
        for (let i = 0; i < parts.length; i++) {
          if (i % 2) { idx.push(+parts[i]); re += "([\\s\\S]+?)" } else re += parts[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        }
        let rx; try { rx = new RegExp(re + "$") } catch (e) { continue }
        // вставка в кавычках («{0}») — обычно название записи: её можно оставить как есть
        const q = idx.map(n => new RegExp("[«\"“]\\{" + n + "\\}").test(k))
        const p = { rx, idx, v, q, len: k.length }
        const head = parts[0]
        if (head.length >= 2) { const h = head.slice(0, 2); if (!PAT.pre.has(h)) PAT.pre.set(h, []); PAT.pre.get(h).push(p) }
        else { p.need = parts.filter((x, i) => !(i % 2)).sort((a, b) => b.length - a.length)[0] || ""; PAT.any.push(p) }
      } else { DICT.set(k, v); LOW.set(k.toLowerCase(), v) }
    }
    const byLen = (a, b) => b.len - a.len
    for (const l of PAT.pre.values()) l.sort(byLen)
    PAT.any.sort(byLen)
    return true
  }
  const capFirst = (src, out) => /^[А-ЯЁ]/.test(src) && /^[a-z]/.test(out) ? out[0].toUpperCase() + out.slice(1) : out
  function exact(s) {
    let v = DICT.get(s)
    if (v != null) return v
    v = LOW.get(s.toLowerCase())
    if (v != null) return capFirst(s, v)
    return null
  }
  function pattern(s) {
    const tryP = p => {
      if (p.need && !s.includes(p.need)) return null
      const m = s.match(p.rx)
      if (!m) return null
      const caps = p.idx.map((n, i) => m[i + 1])
      const tr2 = caps.map((c, i) => { if (!CY.test(c)) return c; const y = piece(c.trim(), 1); return CY.test(y) && !p.q[i] ? null : c.replace(c.trim(), y) })
      if (tr2.includes(null)) return null
      return p.v.replace(/\{(\d)\}/g, (_, n) => { const i = p.idx.indexOf(+n); return i < 0 ? "" : tr2[i] })
    }
    const l = PAT.pre.get(s.slice(0, 2))
    if (l) for (const p of l) { const r = tryP(p); if (r != null) return r }
    for (const p of PAT.any) { const r = tryP(p); if (r != null) return r }
    return null
  }
  // Кусок без пробелов по краям: словарь → шаблон → по частям → по словам
  function piece(s, depth) {
    if (!CY.test(s)) return s
    let r = exact(s)
    if (r != null) return r
    // склеенные куски «… · сегодня уже −470», «Фраза. Фраза.» — сначала по крупным разделителям
    for (const sep of SEPS.slice(0, 2)) {
      const m = s.split(sep)
      if (m.length < 2 || depth > 3) continue
      let ok = true
      const out = m.map((x, i) => { if (i % 2 || !x.trim()) return x; const y = piece(x.trim(), depth + 1); if (CY.test(y)) ok = false; return x.replace(x.trim(), y) }).join("")
      if (ok) return out
    }
    r = pattern(s)
    if (r != null) return r
    if (depth > 2) return s
    // значок или символ в начале/конце: «$ Доллар США», «Готово ✓»
    const ed = s.match(/^([^А-Яа-яЁёA-Za-z0-9«"(]+\s*)([\s\S]*?)(\s*[^А-Яа-яЁёA-Za-z0-9»".!?)…]*)$/)
    if (ed && (ed[1] || ed[3]) && ed[2]) { const y = piece(ed[2], depth + 1); if (!CY.test(y)) return ed[1] + y + ed[3] }
    // по частям, от крупных к мелким: предложения → « · » → « — » → «: », «, »
    for (const sep of SEPS) {
      const m = s.split(sep)
      if (m.length < 2) continue
      let ok = true
      const out = m.map((x, i) => { if (i % 2 || !x.trim()) return x; const y = piece(x.trim(), depth + 1); if (CY.test(y)) ok = false; return x.replace(x.trim(), y) }).join("")
      if (ok) return out
    }
    // по словам: «3 дня», «12 событий»
    const w = s.split(/(\s+)/)
    if (w.length > 1) {
      let ok = true
      const out = w.map((x, i) => { if (i % 2 || !CY.test(x)) return x; const mm = x.match(/^([^А-Яа-яЁё]*)([\s\S]*?)([^А-Яа-яЁё]*)$/); const y = exact(mm[2]); if (y == null) { ok = false; return x } return mm[1] + y + mm[3] }).join("")
      if (ok) return out.replace(/\b1 (\w+?)s\b/g, "1 $1")
    }
    return s
  }
  function tr(s) {
    if (!s || !CY.test(s) || !init()) return s
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/)
    const core = m[2].replace(/[ \t ]+/g, " ")
    const r = piece(core, 0)
    if (r === core) { if (L.miss.size < 2000) L.miss.add(core); return s }
    return m[1] + r.replace(/«/g, "“").replace(/»/g, "”") + m[3]
  }
  L.t = tr
  // Только целиком (словарь или шаблон) — для сообщений пользователя: свой русский текст не трогаем
  function trWhole(s) {
    if (!s || !CY.test(s) || !init()) return s
    const t = s.trim(), r = exact(t) ?? pattern(t)
    return r == null || CY.test(r) ? s : s.replace(t, r)
  }

  // Не переводим: поля ввода, код, помеченное data-noi18n. Сообщения пользователя переводятся только целиком
  // (это подсказки, которые отправило само приложение: «Помоги дополнить мои «100 желаний»…»)
  const SKIP = "[contenteditable], textarea, script, style, code, pre, [data-noi18n]"
  const done = new WeakMap()
  function tNode(n) {
    const v = n.nodeValue
    if (!v || !CY.test(v) || done.get(n) === v) return
    const p = n.parentElement
    if (p && p.closest(SKIP)) return
    const r = p && p.closest(".m.user, .tk-m.u") ? trWhole(v) : tr(v)
    done.set(n, r)
    if (r !== v) n.nodeValue = r
  }
  const ATTR = ["placeholder", "aria-label", "title", "alt", "data-ph"]
  function tEl(el) {
    for (const a of ATTR) {
      const v = el.getAttribute && el.getAttribute(a)
      if (v && CY.test(v)) { const r = tr(v); if (r !== v) el.setAttribute(a, r) }
    }
    if ((el.tagName === "INPUT" && /^(button|submit)$/i.test(el.type)) && CY.test(el.value)) el.value = tr(el.value)
  }
  function walk(root) {
    if (root.nodeType === 3) { tNode(root); return }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return
    if (root.nodeType === 1) { if (root.matches(SKIP)) return; tEl(root) }
    const it = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT })
    let n
    while ((n = it.nextNode())) n.nodeType === 3 ? tNode(n) : tEl(n)
  }
  const mo = new MutationObserver(list => {
    for (const r of list) {
      if (r.type === "childList") r.addedNodes.forEach(walk)
      else if (r.type === "characterData") tNode(r.target)
      else if (r.type === "attributes") tEl(r.target)
    }
  })
  function start() {
    if (!init()) return setTimeout(start, 0)
    walk(document.documentElement)
    if (CY.test(document.title)) document.title = tr(document.title)
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR })
  }
  start()
  // Системные окна браузера
  for (const f of ["alert", "confirm", "prompt"]) {
    const o = window[f]
    if (o) window[f] = function (msg, ...rest) { return o.call(window, tr(String(msg == null ? "" : msg)), ...rest) }
  }
})()
