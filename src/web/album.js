// IZIDAY · «Снимок дня» и альбом года.
// Вечером к итогам дня добавляются одно фото и фраза дня. Неделя (пн–вс) без пропусков открывает карточку недели
// из своих же фото и фраз; из карточек собирается альбом года. Есть лента всех снимков и «ровно год назад».
// Режим игры выключен (D.gamiOff): замков, счётчика «4 из 7» и праздника нет, альбом просто собирает каждую неделю,
// где есть хоть один снимок. Включили игру снова — полные недели открыты, неполные снова «не собраны»: ничего не теряется.
// Хранение: фраза и настроение — как раньше, в goals kind "daynote" {day, text, mood} (+ ph: 1, если к дню есть фото).
// Фото — ТОЛЬКО на этом устройстве, в IndexedDB «iziday-album» (большое ≤1600px и миниатюра ≤480px). В таблицу фото не уходит.
// Файл подключается ПОСЛЕ app.js и дополняет closeDay, closeDayCard, renderPlans, render.
(function () {
"use strict"
if (typeof D === "undefined" || typeof closeDay !== "function" || typeof renderPlans !== "function") return

const gameOn = () => !D.gamiOff
const WDS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
const MON_SHORT = ["янв.", "февр.", "марта", "апр.", "мая", "июня", "июля", "авг.", "сент.", "окт.", "нояб.", "дек."]
const MON_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
// палитры карточек по месяцам: зима — холодная, лето — тёплая
const PAL = [["#1E3C72", "#2A5298"], ["#355C7D", "#6C5B7B"], ["#11998E", "#38EF7D"], ["#56AB2F", "#A8E063"], ["#F7971E", "#FFD200"], ["#FF5F6D", "#FFC371"],
  ["#F857A6", "#FF5858"], ["#FC4A1A", "#F7B733"], ["#C06C84", "#6C5B7B"], ["#D38312", "#A83279"], ["#3A1C71", "#D76D77"], ["#141E30", "#243B55"]]
const AI = {
  cam: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  album: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 15l5-4.5 4 3.5 3-2.5 6 5"/><circle cx="15.5" cy="8.5" r="1.6"/>',
  share: '<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', next: '<path d="M9 5l7 7-7 7"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', spark: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>', pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
}
const ai = (n, s = 16) => `<i class="tdi" style="width:${s}px;height:${s}px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${AI[n]}</svg></i>`
const fromKey = k => { const [y, m, d] = String(k).split("-").map(Number); return new Date(y, m - 1, d) }
const monday = d => { const x = sod(d); return addDays(x, -((x.getDay() + 6) % 7)) }
const weekYear = mon => addDays(mon, 3).getFullYear()         // неделя относится к году своего четверга
const range = mon => { const a = mon, b = addDays(mon, 6)
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MON_GEN[b.getMonth()]}` : `${a.getDate()} ${MON_SHORT[a.getMonth()]} – ${b.getDate()} ${MON_SHORT[b.getMonth()]}` }
const dayLbl = d => `${WD[d.getDay()]}, ${d.getDate()} ${MON_GEN[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""}`

// ───────────── Фото на устройстве (IndexedDB) ─────────────
let dbP = null
function db() {
  if (!dbP) dbP = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error("нет IndexedDB"))
    const r = indexedDB.open("iziday-album", 1)
    r.onupgradeneeded = () => r.result.createObjectStore("ph", { keyPath: "day" })
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
  return dbP
}
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction("ph", mode), st = t.objectStore("ph"), out = fn(st); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error) }) }
const URLS = new Map()   // день → blob:-адрес миниатюры
const toUrl = v => v instanceof Blob ? URL.createObjectURL(v) : String(v || "")
async function loadThumbs() {
  try {
    const all = await tx("readonly", st => st.getAll())
    for (const x of all || []) if (x && x.day && x.thumb && !URLS.has(x.day)) URLS.set(x.day, toUrl(x.thumb))
  } catch (e) { console.warn("album: фото не прочитаны", e) }
}
async function photoPut(day, ph) {
  const rec = { day, thumb: ph.thumb, full: ph.full, at: Date.now() }
  try { await tx("readwrite", st => st.put(rec)) }
  catch (e) {   // старый Safari не хранит Blob — сохраняем строкой
    const s = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b) })
    const thumb = await s(ph.thumb), full = await s(ph.full)
    await tx("readwrite", st => st.put({ day, thumb, full, at: rec.at }))
  }
  const old = URLS.get(day); if (old && old.startsWith("blob:")) URL.revokeObjectURL(old)
  URLS.set(day, toUrl(ph.thumb))
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist() } catch (e) { }
}
async function photoDel(day) { try { await tx("readwrite", st => st.delete(day)) } catch (e) { } const u = URLS.get(day); if (u && u.startsWith("blob:")) URL.revokeObjectURL(u); URLS.delete(day) }
async function photoFull(day) { try { const x = await tx("readonly", st => st.get(day)); return x ? toUrl(x.full || x.thumb) : URLS.get(day) || "" } catch (e) { return URLS.get(day) || "" } }
// снимок с камеры/из галереи → большое фото и миниатюра (JPEG)
function shrink(file) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = async () => {
      const blob = (max, q) => new Promise(r => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas")
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height)
        c.toBlob(b => r(b), "image/jpeg", q) })
      const full = await blob(1600, .85), thumb = await blob(480, .8)
      URL.revokeObjectURL(img.src)
      if (!full || !thumb) return rej(new Error("фото не прочиталось"))
      res({ full, thumb, url: URL.createObjectURL(thumb) })
    }
    img.onerror = () => rej(new Error("не удалось открыть фото"))
    img.src = URL.createObjectURL(file)
  })
}

// ───────────── Снимки и недели ─────────────
const notes = () => live(D.goals).filter(g => g.kind === "daynote" && g.day)
const noteOf = k => notes().find(g => g.day === k)
const isSnap = n => !!(n && ((n.text || "").trim() || n.ph || URLS.has(n.day)))
const snapOf = k => { const n = noteOf(k); return isSnap(n) ? n : URLS.has(k) ? { day: k, text: "", mood: -1, ph: 1 } : null }
const allSnaps = () => { const m = new Map(); for (const n of notes()) if (isSnap(n)) m.set(n.day, n); for (const k of URLS.keys()) if (!m.has(k)) m.set(k, { day: k, text: "", mood: -1, ph: 1 }); return [...m.values()].sort((a, b) => a.day < b.day ? -1 : 1) }
function weekInfo(mon) {
  const t0 = sod(new Date()), days = []
  for (let i = 0; i < 7; i++) { const d = addDays(mon, i), k = dayKey(d); days.push({ d, k, n: snapOf(k), url: URLS.get(k) || "", fut: d > t0, today: sameDay(d, t0) }) }
  const have = days.filter(x => x.n).length, cur = sameDay(monday(t0), mon)
  const full = have === 7, left = days.filter(x => !x.n && !x.fut).length
  // open — карточка открыта; progress — неделя идёт; missed — неделя прошла с пропусками (только в режиме игры)
  const state = full ? "open" : cur ? "progress" : gameOn() ? "missed" : "open"
  return { mon, k: dayKey(mon), days, have, full, cur, left, state }
}
// в режиме игры пропущенный день можно дописать только до конца следующего дня (забыли вечером — допишите утром)
const canFill = d => { const t0 = sod(new Date()); return !gameOn() || d >= addDays(t0, -1) }
function weeksOf(year) {
  const t0 = sod(new Date()), snaps = allSnaps().filter(n => weekYear(monday(fromKey(n.day))) === year)
  const ks = new Set(snaps.map(n => dayKey(monday(fromKey(n.day)))))
  if (weekYear(monday(t0)) === year) ks.add(dayKey(monday(t0)))
  return [...ks].sort().reverse().map(k => weekInfo(fromKey(k)))
}
const years = () => { const s = new Set(allSnaps().map(n => weekYear(monday(fromKey(n.day))))); s.add(weekYear(monday(new Date()))); return [...s].sort((a, b) => b - a) }

// ───────────── Общие куски разметки ─────────────
const pic = (url, cls = "") => url ? `<img class="${cls}" src="${esc(url)}" alt="" loading="lazy" decoding="async">` : ""
const moodTint = m => m >= 0 && typeof MOODS !== "undefined" && MOODS[m] ? MOODS[m][0] : "#8E8E93"
function dots(w) {
  return `<div class="al-dots">${w.days.map((x, i) => `<button class="al-dot${x.n ? " on" : ""}${x.today ? " td" : ""}${x.fut ? " fut" : ""}" data-alday="${x.k}" aria-label="${WDS[i]}">
    ${x.url ? pic(x.url) : x.n ? `<b style="background:${moodTint(x.n.mood)}"></b>` : ""}<span>${WDS[i]}</span></button>`).join("")}</div>`
}
function collage(w, n = 4) {
  const ph = w.days.filter(x => x.url).slice(0, n)
  if (ph.length) return `<div class="al-col c${Math.min(ph.length, 4)}">${ph.map(x => pic(x.url)).join("")}</div>`
  const t = w.days.find(x => x.n && x.n.text)
  return `<div class="al-col c0" style="--a:${PAL[w.mon.getMonth()][0]};--b:${PAL[w.mon.getMonth()][1]}">${t ? `<q>${esc(t.n.text.slice(0, 70))}</q>` : ai("album", 26)}</div>`
}
function yearAgo(now = new Date()) {
  const d = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()), k = dayKey(d), n = snapOf(k)
  if (!n) return ""
  const url = URLS.get(k)
  return `<div class="al-ago" data-alday="${k}">${url ? pic(url, "al-ago-p") : `<div class="al-ago-p ph" style="background:${moodTint(n.mood)}">${ai(n.ph ? "phone" : "spark", 22)}</div>`}
    <div class="grow"><div class="k">${ai("clock", 13)} Ровно год назад · ${d.getDate()} ${MON_GEN[d.getMonth()]} ${d.getFullYear()}</div>
    <div class="t">${n.text ? `«${esc(n.text.slice(0, 120))}»` : "Фото дня"}</div></div></div>`
}

// ───────────── «Сегодня»: неделя снимков вечером и «год назад» ─────────────
function todayExtra(now = new Date()) {
  let html = yearAgo(now)
  const w = weekInfo(monday(now)), lw = weekInfo(addDays(monday(now), -7))
  if (now.getDay() === 1 && now.getHours() < 12 && lw.full) html += `<button class="al-ready" data-alwk="${lw.k}">${collage(lw, 3)}<div class="grow"><div class="k">${gameOn() ? "Карточка недели открыта" : "Карточка недели"}</div><div class="t">${range(lw.mon)} · 7 снимков без пропусков</div></div>${ai("next", 18)}</button>`
  if (now.getHours() < 19) return html
  const need = 7 - w.have
  const head = gameOn()
    ? (w.full ? "Неделя собрана — карточка открыта" : `Карточка недели · ${w.have} из 7`)
    : "Снимки недели"
  const sub = gameOn() && !w.full ? (w.days.some(x => !x.n && !x.fut && !canFill(x.d)) ? "Неделя с пропуском — со следующей получится" : `Ещё ${need} ${plural(need, "снимок", "снимка", "снимков")} — и откроется карточка`) : ""
  return html + `<div class="card al-week" data-alwk="${w.k}"><div class="al-wh"><b>${head}</b>${sub ? `<span>${sub}</span>` : ""}</div>${dots(w)}</div>`
}

// ───────────── Окно снимка: фото + фраза + настроение ─────────────
// Встраивается в «Итоги дня» (closeDay) и открывается само для любого дня из альбома
function photoField(k) {
  const url = URLS.get(k), n = noteOf(k), away = n && n.ph && !url
  return `<div class="field al-field"><label>Фото дня</label><div class="al-pick">
    <button type="button" class="al-ph${url ? " has" : ""}" data-alpick>${url ? pic(url) : ai("cam", 26)}</button>
    <div class="al-pick-s"><b>${url ? "Сменить фото" : away ? "Фото на другом устройстве" : "Одно фото, которое запомнит день"}</b><span>Хранится только на этом телефоне и в таблицу не уходит</span>
    ${url ? '<button type="button" class="link al-rm" data-alrm>Убрать фото</button>' : ""}</div></div>
    <input type="file" accept="image/*" hidden data-alfile></div>`
}
// state: {ph: {full, thumb, url} | null, rm: bool}
function bindPhoto(el, state) {
  const inp = $("[data-alfile]", el), btn = $("[data-alpick]", el)
  if (!inp || !btn) return
  btn.onclick = () => inp.click()
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return
    btn.classList.add("busy")
    try { state.ph = await shrink(f); state.rm = false; btn.innerHTML = pic(state.ph.url); btn.classList.add("has", "pop"); const b = $(".al-pick-s b", el); if (b) b.textContent = "Сменить фото" }
    catch (e) { toast(e.message) }
    btn.classList.remove("busy"); inp.value = ""
  }
  const rm = $("[data-alrm]", el)
  if (rm) rm.onclick = () => { state.ph = null; state.rm = true; btn.innerHTML = ai("cam", 26); btn.classList.remove("has"); rm.remove() }
}
async function applyPhoto(k, state) {
  if (!state.ph && !state.rm) return
  if (state.ph) await photoPut(k, state.ph); else await photoDel(k)
  const n = noteOf(k)
  if (n || state.ph) upsert("goals", Object.assign(n || { id: uid("n"), date: Date.now(), kind: "daynote", day: k, text: "", mood: -1 }, { ph: state.ph ? 1 : 0 }))
}
function snapEdit(k) {
  const d = fromKey(k), n = noteOf(k), state = { ph: null, rm: false }
  let mood = n && n.mood >= 0 ? n.mood : -1
  const s = sheet(`<h3>Снимок дня</h3><div class="msg">${esc(core.cap(dayLbl(d)))}</div>${photoField(k)}
    <div class="field"><label>Фраза дня</label><textarea id="al-t" rows="2" placeholder="Что было главным, что запомнилось">${n ? esc(n.text || "") : ""}</textarea></div>
    ${typeof MOODS !== "undefined" ? `<div class="field"><label>Настроение</label><div class="moods" id="al-m">${MOODS.map((_, i) => `<button class="${i === mood ? "on" : ""}" data-i="${i}">${moodFace(i)}</button>`).join("")}</div></div>` : ""}
    <div class="btns"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  bindPhoto(s.el, state)
  $$("#al-m button", s.el).forEach(b => b.onclick = () => { mood = +b.dataset.i; $$("#al-m button", s.el).forEach(x => x.classList.toggle("on", x === b)) })
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = async () => {
    const text = $("#al-t", s.el).value.trim().slice(0, 500)
    const g = noteOf(k)
    if (text || mood >= 0 || g) upsert("goals", Object.assign(g || { id: uid("n"), date: Date.now(), kind: "daynote", day: k }, { text, mood }))
    await applyPhoto(k, state)
    s.close(); render(); afterSnap(k)
  }
  return s
}
// «Итоги дня» из app.js: добавляем фото над строкой о дне и неделю снимков
function enhanceClose(s) {
  if (!s || !s.el || !$("#cd-t", s.el) || $(".al-field", s.el)) return
  const k = dayKey(new Date()), state = { ph: null, rm: false }
  const f = $("#cd-t", s.el).closest(".field")
  const lb = $("label", f); if (lb) lb.textContent = "Фраза дня"
  f.insertAdjacentHTML("beforebegin", photoField(k))
  if (gameOn()) { const w = weekInfo(monday(new Date())); f.insertAdjacentHTML("afterend", `<div class="al-cdw"><span>Карточка недели · ${w.have + (snapOf(k) ? 0 : 1)} из 7 после этого снимка</span>${dots(w)}</div>`) }
  bindPhoto(s.el, state)
  const ok = $('[data-a="ok"]', s.el), f0 = ok.onclick
  ok.onclick = async ev => { f0.call(ok, ev); try { await applyPhoto(k, state) } catch (e) { toast("Фото не сохранилось: " + e.message) } render(); afterSnap(k) }
}

// ───────────── Праздник: неделя собрана ─────────────
const seen = () => (D.albumSeen = Array.isArray(D.albumSeen) ? D.albumSeen : [])
function afterSnap(k) {
  if (!gameOn()) return
  const w = weekInfo(monday(fromKey(k)))
  if (!w.full || seen().includes(w.k)) return
  seen().push(w.k); save(false)
  setTimeout(() => openWeek(w.k, true), 450)
}
// при первом запуске прошлые полные недели не празднуем
function seedSeen() {
  if (D.albumSeen) return
  const lim = addDays(monday(new Date()), -7)
  D.albumSeen = years().flatMap(y => weeksOf(y)).filter(w => w.full && w.mon < lim).map(w => w.k)
  save(false)
}

// ───────────── Карточка недели ─────────────
function cardHTML(w) {
  const [a, b] = PAL[w.mon.getMonth()]
  const tiles = w.days.map((x, i) => {
    const inner = x.url ? pic(x.url) : x.n ? `<div class="al-tq" style="background:linear-gradient(150deg, ${moodTint(x.n.mood)}, ${b})">${x.n.text ? esc(x.n.text.slice(0, 60)) : ai(x.n.ph ? "phone" : "spark", 18)}</div>` : `<div class="al-tq none">${x.fut ? "" : "—"}</div>`
    return `<button class="al-t${i < 3 ? " big" : ""}" data-alday="${x.k}" ${x.n || canFill(x.d) && !x.fut ? "" : "disabled"}>${inner}<span>${WDS[i]} ${x.d.getDate()}</span>${x.n && x.n.mood >= 0 && x.url ? `<em>${moodFace(x.n.mood, 18)}</em>` : ""}</button>`
  }).join("")
  const lines = w.days.filter(x => x.n && x.n.text).map(x => `<div class="al-ln"><b>${WDS[(x.d.getDay() + 6) % 7]}</b><span>${esc(x.n.text)}</span></div>`).join("")
  const badge = w.full ? "7 из 7 · без пропусков" : `${w.have} из 7`
  return `<div class="al-card${w.state === "missed" ? " miss" : ""}${w.state === "progress" && gameOn() ? " lock" : ""}" style="--a:${a};--b:${b}">
    <div class="al-ch"><div><div class="al-cy">${weekYear(w.mon)} · неделя ${isoWeek(w.mon)}</div><div class="al-ct">${range(w.mon)}</div></div><div class="al-cb">${badge}</div></div>
    <div class="al-tiles">${tiles}</div>${lines ? `<div class="al-lines">${lines}</div>` : ""}</div>`
}
const isoWeek = mon => { const th = addDays(mon, 3), j = new Date(th.getFullYear(), 0, 4); return 1 + Math.round((monday(th) - monday(j)) / (7 * 864e5)) }
function openWeek(k, cele) {
  const w = weekInfo(fromKey(k))
  const all = years().flatMap(y => weeksOf(y)).map(x => x.k).sort()
  const i = all.indexOf(k), prev = all[i - 1], next = all[i + 1]
  const share = w.full || !gameOn() && w.have
  const note = gameOn() && !w.full ? (w.state === "missed" ? `<div class="al-note">${ai("lock", 14)} Неделя с пропуском — карточка не собрана. Снимки остаются в ленте.</div>`
    : `<div class="al-note">${ai("lock", 14)} Ещё ${7 - w.have} ${plural(7 - w.have, "снимок", "снимка", "снимков")} — и карточка откроется</div>`) : ""
  const s = sheet(`${cele ? `<div class="al-cele"><div class="al-burst">${ai("spark", 26)}</div><h3>Неделя без пропусков</h3><div class="msg">Карточка недели открыта и легла в альбом ${weekYear(w.mon)}.</div></div>` : ""}
    ${cardHTML(w)}${note}
    <div class="btns">${prev ? `<button class="btn" data-alnav="${prev}">${ai("back", 15)}</button>` : ""}${share ? `<button class="btn primary" data-alshare>${ai("share", 15)} Сохранить картинкой</button>` : '<button class="btn" data-a="no">Закрыть</button>'}${next ? `<button class="btn" data-alnav="${next}">${ai("next", 15)}</button>` : ""}</div>`)
  s.el.classList.add("al-sheet")
  if (cele) { s.el.classList.add("cele"); if (navigator.vibrate) navigator.vibrate([12, 60, 18]) }
  const no = $('[data-a="no"]', s.el); if (no) no.onclick = () => s.close()
  $$("[data-alnav]", s.el).forEach(b => b.onclick = () => { s.close(); setTimeout(() => openWeek(b.dataset.alnav), 120) })
  $$("[data-alday]", s.el).forEach(b => b.onclick = () => openDay(b.dataset.alday))
  const sh = $("[data-alshare]", s.el); if (sh) sh.onclick = () => shareCard(w)
  return s
}

// день: большое фото, фраза, настроение; правка
async function openDay(k) {
  const d = fromKey(k), n = snapOf(k)
  if (!n) { if (canFill(d) && d <= sod(new Date())) return snapEdit(k); return toast(gameOn() ? "Пропущенный день уже не дописать" : "В этот день снимка нет") }
  const s = sheet(`<div class="al-day"><div class="al-dp">${URLS.get(k) ? pic(URLS.get(k)) : `<div class="al-dp0" style="background:linear-gradient(150deg, ${moodTint(n.mood)}, ${PAL[d.getMonth()][1]})">${n.ph ? `${ai("phone", 22)}<span>Фото на другом устройстве</span>` : ai("spark", 26)}</div>`}</div>
    <div class="al-dm"><div class="k">${esc(core.cap(dayLbl(d)))}</div>${n.mood >= 0 && typeof moodFace === "function" ? moodFace(n.mood, 24) : ""}</div>
    ${n.text ? `<div class="al-dt">«${esc(n.text)}»</div>` : ""}</div>
    <div class="btns"><button class="btn" data-a="no">Закрыть</button><button class="btn" data-a="ed">${ai("pen", 15)} Изменить</button></div>`)
  s.el.classList.add("al-sheet")
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ed"]', s.el).onclick = () => { s.close(); setTimeout(() => snapEdit(k), 120) }
  const full = await photoFull(k); const im = $(".al-dp img", s.el); if (im && full) im.src = full
}

// ───────────── Картинка карточки (canvas → поделиться / сохранить) ─────────────
const loadImg = src => new Promise(r => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src })
function wrapText(c, text, maxW, maxLines) {
  const words = String(text).split(/\s+/), out = []; let line = ""
  for (const w of words) { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; if (out.length === maxLines) break } else line = t }
  if (out.length < maxLines && line) out.push(line)
  if (out.length === maxLines && words.join(" ").length > out.join(" ").length) out[maxLines - 1] = out[maxLines - 1].replace(/\s*\S*$/, "") + "…"
  return out
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }
async function cardCanvas(w) {
  const W = 1080, H = 1350, c0 = document.createElement("canvas"); c0.width = W; c0.height = H
  const c = c0.getContext("2d"), [a, b] = PAL[w.mon.getMonth()], F = "-apple-system, 'SF Pro Display', system-ui, sans-serif"
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, W, H)
  const glow = c.createRadialGradient(W * .85, H * .1, 0, W * .85, H * .1, W * .7); glow.addColorStop(0, "rgba(255,255,255,.28)"); glow.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = glow; c.fillRect(0, 0, W, H)
  c.fillStyle = "rgba(255,255,255,.78)"; c.font = `600 30px ${F}`; c.fillText(`${weekYear(w.mon)} · неделя ${isoWeek(w.mon)}`, 64, 104)
  c.fillStyle = "#fff"; c.font = `700 64px ${F}`; c.fillText(range(w.mon), 64, 178)
  const imgs = await Promise.all(w.days.map(x => x.url ? photoFull(x.k).then(loadImg) : null))
  const P = 64, G = 16, w1 = (W - 2 * P - 2 * G) / 3, w2 = (W - 2 * P - 3 * G) / 4
  const pos = w.days.map((_, i) => i < 3 ? [P + i * (w1 + G), 226, w1, w1] : [P + (i - 3) * (w2 + G), 226 + w1 + G, w2, w2])
  w.days.forEach((x, i) => {
    const [px, py, pw, ph] = pos[i]
    c.save(); rr(c, px, py, pw, ph, 28); c.clip()
    const im = imgs[i]
    if (im) { const k = Math.max(pw / im.width, ph / im.height), iw = im.width * k, ih = im.height * k; c.drawImage(im, px + (pw - iw) / 2, py + (ph - ih) / 2, iw, ih) }
    else { c.fillStyle = x.n ? moodTint(x.n.mood) : "rgba(255,255,255,.14)"; c.fillRect(px, py, pw, ph)
      if (x.n && x.n.text) { c.fillStyle = "#fff"; c.font = `600 ${i < 3 ? 28 : 22}px ${F}`; wrapText(c, x.n.text, pw - 36, 4).forEach((l, j) => c.fillText(l, px + 18, py + 44 + j * (i < 3 ? 36 : 29))) } }
    const sh = c.createLinearGradient(0, py + ph - 70, 0, py + ph); sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.45)"); c.fillStyle = sh; c.fillRect(px, py + ph - 70, pw, 70)
    c.restore()
    c.fillStyle = "#fff"; c.font = `700 24px ${F}`; c.fillText(`${WDS[i]} ${x.d.getDate()}`, px + 18, py + ph - 18)
  })
  let y = 226 + w1 + G + w2 + 70
  const lines = w.days.filter(x => x.n && x.n.text)
  c.font = `500 30px ${F}`
  for (const x of lines) {
    if (y > H - 130) break
    const ls = wrapText(c, x.n.text, W - 2 * P - 90, 2)
    c.fillStyle = "rgba(255,255,255,.7)"; c.font = `700 26px ${F}`; c.fillText(WDS[(x.d.getDay() + 6) % 7], P, y)
    c.fillStyle = "#fff"; c.font = `500 30px ${F}`; ls.forEach((l, j) => c.fillText(l, P + 90, y + j * 40))
    y += ls.length * 40 + 22
  }
  c.fillStyle = "rgba(255,255,255,.75)"; c.font = `600 26px ${F}`; c.fillText(w.full ? "7 из 7 · неделя без пропусков" : `${w.have} из 7`, P, H - 64)
  c.textAlign = "right"; c.fillText(`IZIDAY · альбом ${weekYear(w.mon)}`, W - P, H - 64)
  return c0
}
async function shareCard(w) {
  try {
    const c = await cardCanvas(w), blob = await new Promise(r => c.toBlob(r, "image/jpeg", .92))
    const name = `IZIDAY-${w.k}.jpg`, file = new File([blob], name, { type: "image/jpeg" })
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: `Неделя ${range(w.mon)}` }); return }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove()
    toast("Карточка сохранена")
  } catch (e) { if (e && e.name !== "AbortError") toast("Не получилось: " + e.message) }
}

// ───────────── «Планы» → «Альбом» ─────────────
let alYear = null, alSeg = "cards"
function albumPage() {
  const ys = years(); if (!ys.includes(alYear)) alYear = ys[0]
  const ws = weeksOf(alYear), snaps = allSnaps().filter(n => weekYear(monday(fromKey(n.day))) === alYear)
  const open = ws.filter(w => w.full || !gameOn() && w.have), photos = snaps.filter(n => URLS.has(n.day))
  const cover = photos.slice(-6).reverse().map(n => pic(URLS.get(n.day))).join("")
  const td = dayKey(new Date()), tdSnap = snapOf(td), cur = ws.find(w => w.cur)
  let html = `<div class="al-hero${cover ? "" : " empty"}"><div class="al-hc">${cover}</div><div class="al-hi">
    <div class="k">${ai("album", 15)} Альбом ${alYear}</div>
    <div class="v">${open.length} ${plural(open.length, "карточка", "карточки", "карточек")}</div>
    <div class="s2">${snaps.length} ${plural(snaps.length, "снимок", "снимка", "снимков")} дня${gameOn() ? " · неделя без пропусков открывает карточку" : ""}</div>
    ${tdSnap ? "" : `<button class="pill" data-alday="${td}">${ai("cam", 14)} Снимок за сегодня</button>`}</div></div>`
  if (ys.length > 1) html += `<div class="chips al-years">${ys.map(y => `<button class="chip ${y === alYear ? "on" : ""}" data-alyear="${y}">${y}</button>`).join("")}</div>`
  html += yearAgo()
  html += `<div class="seg al-seg"><button class="${alSeg === "cards" ? "on" : ""}" data-alseg="cards">Карточки</button><button class="${alSeg === "feed" ? "on" : ""}" data-alseg="feed">Лента</button></div>`
  if (alSeg === "cards") {
    if (cur && gameOn() && !cur.full) html += `<div class="card al-week" data-alwk="${cur.k}"><div class="al-wh"><b>Эта неделя · ${cur.have} из 7</b><span>${cur.days.some(x => !x.n && !x.fut && !canFill(x.d)) ? "Есть пропуск — со следующей недели получится" : "Снимок каждый день — и карточка откроется"}</span></div>${dots(cur)}</div>`
    const list = ws.filter(w => !(w.cur && gameOn() && !w.full))
    html += list.length ? `<div class="al-grid">${list.map((w, i) => {
      const st = w.full ? "open" : gameOn() ? (w.cur ? "lock" : "miss") : "open"
      return `<button class="al-wk ${st}" data-alwk="${w.k}" style="--a:${PAL[w.mon.getMonth()][0]};--b:${PAL[w.mon.getMonth()][1]};animation-delay:${Math.min(i, 12) * 35}ms">${collage(w)}
        ${st === "miss" ? `<i class="al-lk">${ai("lock", 15)}</i>` : ""}<div class="al-wt">${range(w.mon)}</div><div class="al-ws">${w.full ? "7 из 7" : st === "miss" ? `${w.have} из 7 · не собрана` : `${w.have} из 7`}</div></button>` }).join("")}</div>`
      : `<div class="card al-empty">${ai("album", 30)}<b>Здесь соберётся ваш год</b><span>Вечером в «Итогах дня» добавьте фото и фразу. ${gameOn() ? "Семь дней подряд — и откроется первая карточка." : "Каждая неделя станет карточкой."}</span></div>`
  } else {
    const byM = {}; for (const n of snaps.slice().reverse()) { const m = fromKey(n.day).getMonth(); (byM[m] = byM[m] || []).push(n) }
    const ms = Object.keys(byM).map(Number).sort((a, b) => b - a)
    html += ms.length ? ms.map(m => `<div class="card al-feed"><h2>${MON_NOM[m]}<span class="muted small">${byM[m].length}</span></h2>${byM[m].map(n => { const d = fromKey(n.day), u = URLS.get(n.day)
      return `<button class="al-fr" data-alday="${n.day}">${u ? pic(u, "al-fp") : `<div class="al-fp ph" style="background:${moodTint(n.mood)}">${ai(n.ph ? "phone" : "spark", 16)}</div>`}
        <div class="grow"><div class="k">${d.getDate()} ${MON_GEN[d.getMonth()]}, ${WD[d.getDay()]}</div><div class="t">${n.text ? esc(n.text) : '<span class="muted">без фразы</span>'}</div></div>${n.mood >= 0 ? moodFace(n.mood, 20) : ""}</button>` }).join("")}</div>`).join("")
      : `<div class="card al-empty">${ai("album", 30)}<b>Лента пока пустая</b><span>Здесь по дням будут ваши фото и фразы.</span></div>`
  }
  html += `<div class="al-foot">${ai("lock", 12)} Фото хранятся только на этом телефоне и не уходят в таблицу. Фразы дня — в вашей таблице, как и раньше.</div>`
  return html
}
function bindAlbum(v) {
  $$("[data-alwk]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); if (ev.target.closest("[data-alday]")) return; openWeek(b.dataset.alwk) })
  $$("[data-alday]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); openDay(b.dataset.alday) })
  $$("[data-alseg]", v).forEach(b => b.onclick = () => { alSeg = b.dataset.alseg; render() })
  $$("[data-alyear]", v).forEach(b => b.onclick = () => { alYear = +b.dataset.alyear; render() })
}
function openAlbum(seg) { if (seg) alSeg = seg; plansF = "album"; if (tab !== "plans") setTab("plans"); else render(); scrollView(false) }

// ───────────── Встраивание ─────────────
function init() {
  const cd0 = closeDay
  closeDay = function () { const out = cd0.apply(this, arguments); try { enhanceClose(stack[stack.length - 1]) } catch (e) { console.error("album", e) } return out }
  const cdc0 = closeDayCard
  closeDayCard = function (v, now = new Date()) { let x = ""; try { x = todayExtra(now) } catch (e) { console.error("album", e) } return cdc0.apply(this, arguments) + x }
  PLAN_F.push(["album", "Альбом"])
  const plans0 = renderPlans
  renderPlans = function () {
    if (plansF === "all") { let x = ""; try { x = albumPage() } catch (e) { console.error("album", e) } return plans0.apply(this, arguments) + x }   // альбом и в общем списке, в конце
    if (plansF !== "album") return plans0.apply(this, arguments)
    const html = plans0.apply(this, arguments), i = html.indexOf("</div>") + 6
    return html.slice(0, i) + albumPage()
  }
  const render0 = render
  render = function () { const out = render0.apply(this, arguments); try { bindAlbum($("#view")) } catch (e) { console.error("album", e) } return out }
  window.ALBUM = { monday, weekInfo, weeksOf, years, snapOf, allSnaps, openWeek, openDay, snapEdit, openAlbum, cardCanvas, photoPut, photoDel, shrink, loadThumbs, URLS, canFill }
  loadThumbs().then(() => { seedSeen(); render() })
}
try { init() } catch (e) { console.error("album", e) }
})()
