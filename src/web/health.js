// IZIDAY · Здоровье 2.0: сон и «готовность», закономерности, настроение и дыхание, дневник (открытый или с паролем),
// лекарства с подсказками и «заканчивается → в покупки», вода-сосуд, план тренировок, тренд веса с прогнозом,
// медкарта семьи, отчёт за месяц для врача или тренера.
// Файл подключается ПОСЛЕ app.js и дополняет его функции (renderHealth, renderTop, runTool, agentSystem, bind).
// Хранение — в списке goals (синхронизируется с таблицей без нового деплоя скрипта):
//   kind "hcfg"   id "hcfg"  {wake "06:30", need 7.5, wgoal, sleepPush, lock {salt, check}}  — настройки здоровья
//   kind "sleep"  {day, h, bed, wake}           — сон, записанный вручную (день = утро после ночи)
//   kind "mood"   {day, v 1..5}                  — настроение одним касанием
//   kind "diary"  {day, text, mood} или {day, sealed "p1:…" | "v1:…"} — дневник; с паролем в таблицу уходит только шифр
//   kind "med"    {title, dose, times ["08:00"], per, stock, taken {день: ["08:00"]}, off} — лекарства и витамины
//   kind "medrec" {who, title, last, every (мес.), next}    — медкарта семьи
//   kind "wplan"  id "wplan" {goal, items [{wd 1..7, title, min, time}]} — план тренировок
// Подсказки (лекарства, «пора спать», медкарта) — это nudges с id md…/sl…/mr…: их пушем шлёт таблица.
// Сон и пульс покоя приходят от виджета (Быстрая команда «Мой день - здоровье», ключи sleep, rhr, bed, wake).
(function () {
"use strict"
if (typeof D === "undefined" || typeof renderHealth !== "function") return

// ───────────── Общее ─────────────
const z2h = n => String(n).padStart(2, "0")
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const goals = kind => live(D.goals).filter(g => g.kind === kind)
const CFG = () => Object.assign({ wake: "06:30", need: 7.5, wgoal: 0, sleepPush: true }, live(D.goals).find(g => g.id === "hcfg") || {})
function cfgSet(patch) { const c = live(D.goals).find(g => g.id === "hcfg") || { id: "hcfg", kind: "hcfg", date: Date.now() }; return upsert("goals", Object.assign({}, c, patch)) }
const hmToMin = s => { const m = String(s || "").match(/(\d{1,2})[:.](\d{2})/); return m ? +m[1] * 60 + +m[2] : null }
const minToHm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${z2h(Math.floor(m / 60))}:${z2h(m % 60)}` }
const hTxt = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} ч${m % 60 ? " " + (m % 60) + " мин" : ""}` }
const hShort = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${z2h(m % 60)}` }
const dec = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString().replace(".", window.L && L.en ? "." : ",")
const fdate = s => { const [y, m, d] = String(s).split("-").map(Number); return `${d} ${MON_GEN[m - 1]}${y !== new Date().getFullYear() ? " " + y : ""}` }
const addMonths = (s, n) => { const [y, m, d] = s.split("-").map(Number); return dayKey(new Date(y, m - 1 + n, Math.min(d, 28))) }
const monthsAgo = s => { const [y, m] = s.split("-").map(Number), n = new Date(); return (n.getFullYear() - y) * 12 + n.getMonth() - (m - 1) }
const HI = Object.assign({}, typeof TD_ICO !== "undefined" ? TD_ICO : {}, {
  bed: '<path d="M3 18V7M3 14h18v4M21 14v-2.5A3.5 3.5 0 0 0 17.5 8H11v6"/><circle cx="7" cy="10.5" r="1.8"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
  wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7"/>',
  book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
  pill: '<rect x="3" y="9" width="18" height="6.5" rx="3.25" transform="rotate(-35 12 12)"/><path d="M9.6 8.6l4.8 6.8"/>',
  dumbbell: '<path d="M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12"/>', spark: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>', steth: '<path d="M6 3v6a5 5 0 0 0 10 0V3"/><path d="M11 14v2a5 5 0 0 0 10 0v-2"/><circle cx="21" cy="12" r="2"/>',
  scale: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8.5 9a5 5 0 0 1 7 0l-2 2.5a2 2 0 0 0-3 0z"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', cart: '<path d="M3 4h2.5l2 11h10.5l2-8H7"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
  share: '<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6 7l1 12.3A1.8 1.8 0 0 0 8.8 21h6.4a1.8 1.8 0 0 0 1.8-1.7L18 7"/>', drop: '<path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/>',
  chev: '<path d="M9 5l7 7-7 7"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
})
const hi = (n, s = 16, c) => `<i class="tdi" style="width:${s}px;height:${s}px${c ? ";color:" + c : ""}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${HI[n] || ""}</svg></i>`
const anim = (() => { let k = 0; const f = () => `style="animation-delay:${(k++) * 40}ms"`; f.reset = () => { k = 0 }; return f })()

// ───────────── Сон и пульс покоя ─────────────
// Часы: если пришло больше 24 — это минуты
const sleepH = v => { const n = +v; return n > 0 ? (n > 24 ? n / 60 : n) : 0 }
function nightOf(d) {   // сон в ночь перед днём d
  const k = dayKey(d)
  const man = goals("sleep").filter(s => s.day === k).sort((a, b) => b.u - a.u)[0]
  if (man && man.h > 0) return { h: man.h, bed: man.bed || null, wake: man.wake || null, src: "man" }
  const w = sameDay(d, new Date()) && D.snap && D.snap.watch && D.snap.watch.day === k ? D.snap.watch : null
  const h = w && w.sleep ? w : histHealth(d)
  if (h && sleepH(h.sleep)) return { h: sleepH(h.sleep), bed: h.bed || null, wake: h.wake || null, src: "watch" }
  return null
}
function rhrOf(d) {
  const k = dayKey(d)
  const w = sameDay(d, new Date()) && D.snap && D.snap.watch && D.snap.watch.day === k ? D.snap.watch : null
  for (const h of [w, histHealth(d)]) if (h) { const v = +(h.rhr || h.hr); if (v > 30 && v < 130) return Math.round(v) }
  return null
}
const nights = (n, end = new Date()) => [...Array(n)].map((_, i) => { const d = addDays(sod(end), i - n + 1); return { d, s: nightOf(d) } })
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null }
const sd = a => { if (a.length < 2) return 0; const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) }
const bedtime = () => minToHm(hmToMin(CFG().wake) - CFG().need * 60)

// «Готовность» утром: сон (50), пульс покоя к своей норме за 2 недели (25), вчерашняя нагрузка (25)
function readiness(d = new Date()) {
  const s = nightOf(d), need = CFG().need
  if (!s) return null
  let got = 0, max = 0, parts = []
  const sl = s.h >= need ? 50 : s.h < 4.5 ? 10 : 50 * Math.pow(s.h / need, 1.6)
  got += sl; max += 50
  const rhr = rhrOf(d), base = median([...Array(14)].map((_, i) => rhrOf(addDays(sod(d), -i - 1))).filter(Boolean))
  if (rhr && base) { const diff = rhr - base; got += clamp(25 - Math.max(0, diff) * 4 + Math.max(0, -diff) * 1, 5, 25); max += 25; parts.push({ rhr, base }) }
  else if (rhr) { got += 20; max += 25; parts.push({ rhr }) }
  const y = dayHealth(addDays(sod(d), -1)), g = H()
  if (y && (y.exercise || y.active)) { const heavy = (y.exercise || 0) > 75 || (y.active || 0) > (g.moveGoal || 500) * 1.6; got += heavy ? 12 : (y.exercise || 0) > 45 ? 20 : 25; max += 25; parts.push({ load: y.exercise || 0, heavy }) }
  const score = Math.round(clamp(got / max * 100, 5, 100))
  const rp = parts.find(p => p.rhr), lp = parts.find(p => "load" in p)
  const why = [`Сон ${hTxt(s.h)}`, rp && `пульс покоя ${rp.rhr}${rp.base && Math.abs(rp.rhr - rp.base) >= 3 ? ` (обычно ${Math.round(rp.base)})` : ""}`, lp && lp.heavy && "вчера была большая нагрузка"].filter(Boolean).join(", ")
  const adv = score >= 82 ? "можно тренироваться в полную силу" : score >= 66 ? "можно тренироваться, но без рекордов" : score >= 50 ? "лучше лёгкая тренировка или прогулка" : "день восстановления: прогулка, вода и лечь пораньше"
  return { score, s, rhr, adv, why }
}

// ───────────── Закономерности (личные выводы из своих данных) ─────────────
function patterns() {
  const end = sod(new Date()), out = []
  const days = [...Array(60)].map((_, i) => addDays(end, i - 60))   // без сегодняшнего (день ещё идёт)
  const rows = days.map(d => { const h = dayHealth(d), s = nightOf(d), moods = goals("mood").filter(m => m.day === dayKey(d)).map(m => m.v)
    return { d, kcal: h.kcal, sleep: s ? s.h : null, steps: h.steps, wk: (h.workouts.length || (h.exercise || 0) >= 20) ? 1 : 0, water: h.water, mood: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null } })
  const avg = (a, k) => a.length ? a.reduce((s, x) => s + x[k], 0) / a.length : 0
  const sl = rows.filter(r => r.sleep), short = sl.filter(r => r.sleep < 6), ok = sl.filter(r => r.sleep >= 6.5)
  const fk = a => a.filter(r => r.kcal > 0)
  if (fk(short).length >= 3 && fk(ok).length >= 3) { const dk = avg(fk(short), "kcal") - avg(fk(ok), "kcal")
    if (dk >= 150) out.push({ w: dk / 100, t: `После ночей короче 6 ч вы съедаете в среднем на ${num(dk)} ккал больше` + (short.length >= 3 && avg(short, "wk") + .25 <= avg(ok, "wk") ? " и чаще пропускаете тренировку." : ".") }) }
  if (short.length >= 3 && ok.length >= 3 && !out.length && avg(short, "wk") + .3 <= avg(ok, "wk")) out.push({ w: 3, t: `После короткой ночи тренировка случается в ${Math.round(avg(short, "wk") * 100)}% дней, после нормальной — в ${Math.round(avg(ok, "wk") * 100)}%.` })
  const md = rows.filter(r => r.mood != null)
  const pair = (cond, name, k = "mood") => { const a = md.filter(cond), b = md.filter(r => !cond(r)); if (a.length >= 3 && b.length >= 3) { const x = avg(a, k) - avg(b, k); if (Math.abs(x) >= .45) out.push({ w: Math.abs(x) * 4, t: `${name}: настроение в среднем ${x > 0 ? "выше" : "ниже"} на ${dec(Math.abs(x))} балла из 5.` }) } }
  pair(r => (r.steps || 0) >= 8000, "В дни от 8 000 шагов")
  pair(r => r.sleep != null && r.sleep >= 7, "После сна от 7 часов")
  pair(r => r.wk, "В дни с тренировкой")
  pair(r => r.water >= (H().waterGoal || 2000), "Когда выпита норма воды")
  out.sort((a, b) => b.w - a.w)
  const have = { sleep: sl.length, mood: md.length }
  return { list: out.slice(0, 2), have }
}

// ───────────── Настроение ─────────────
const MOODS = [["#FF453A", "M8 16c2-2 6-2 8 0", "плохо"], ["#FF9F0A", "M8 16h8", "так себе"], ["#E8B90C", "M8 15.5c2 1 6 1 8 0", "нормально"], ["#34C759", "M8 14.5c2 2.5 6 2.5 8 0", "хорошо"], ["#0A9F6E", "M7.5 13.5c2 4 7 4 9 0", "отлично"]]
const face = (i, s = 30) => { const [c, m] = MOODS[i]; return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><circle cx="9" cy="10" r=".7" fill="${c}"/><circle cx="15" cy="10" r=".7" fill="${c}"/><path d="${m}"/></svg>` }
const moodToday = () => goals("mood").filter(m => m.day === dayKey(new Date())).sort((a, b) => b.date - a.date)[0] || null
function logMood(v, note) { v = clamp(Math.round(+v), 1, 5); return upsert("goals", { id: uid("md"), date: Date.now(), kind: "mood", day: dayKey(new Date()), v, ...(note ? { note: String(note).slice(0, 200) } : {}) }) }

// ───────────── Шифр дневника ─────────────
// Общий «сейф» (window.vault) делает тред про шифрование памяти. Пока его нет — временная замена с тем же API:
// код-пароль → PBKDF2 (200 000 итераций) → AES-GCM 256. Шифр помечен "p1:". Ключ живёт только в памяти, до закрытия приложения.
const b64 = u => btoa(String.fromCharCode(...new Uint8Array(u)))
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const tmpVault = {
  key: null,
  isSet: () => !!(CFG().lock && CFG().lock.salt),
  isOpen() { return !!this.key },
  async derive(pass, salt) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"])
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: unb64(salt), iterations: 200000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
  },
  async setup(pass) {
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)))
    this.key = await this.derive(pass, salt)
    cfgSet({ lock: { salt, check: await this.seal({ ok: 1 }) } })
  },
  async unlock(pass) {
    const l = CFG().lock; if (!l) return false
    const k = await this.derive(pass, l.salt), keep = this.key
    this.key = k
    try { const o = await this.unseal(l.check); if (o && o.ok) return true } catch (e) {}
    this.key = keep; return false
  },
  async open() { if (this.key) return true; return askPass(this.isSet() ? "unlock" : "setup") },
  async seal(obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.key, new TextEncoder().encode(JSON.stringify(obj)))
    return "p1:" + b64(iv) + ":" + b64(ct)
  },
  async unseal(str) {
    const [, iv, ct] = String(str).split(":")
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, this.key, unb64(ct))))
  },
  forget() { this.key = null },
}
const V = () => window.vault && typeof window.vault.seal === "function" ? window.vault : tmpVault
const sealedBy = s => /^p1:/.test(s) ? tmpVault : V()
function askPass(mode) {
  return new Promise(res => {
    let ok = false
    const s = sheet(`<div class="hl-lockhead">${hi("lock", 26)}</div><h3 style="text-align:center">${mode === "setup" ? "Пароль для дневника" : "Дневник закрыт"}</h3>
      <div class="msg" style="text-align:center">${mode === "setup" ? "Записи зашифруются на этом телефоне, в таблицу уйдёт только шифр. Пароль не хранится нигде: если забыть — записи не открыть." : "Введите пароль дневника"}</div>
      <div class="field"><input id="hp1" type="password" autocomplete="off" placeholder="Пароль"></div>
      ${mode === "setup" ? `<div class="field"><input id="hp2" type="password" autocomplete="off" placeholder="Ещё раз"></div>` : ""}
      <div class="msg exp small" id="hp-e" hidden></div>
      <div class="btns"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">${mode === "setup" ? "Закрыть паролем" : "Открыть"}</button></div>`, { onClose: () => res(ok) })
    const p1 = $("#hp1", s.el), err = t => { const e = $("#hp-e", s.el); e.textContent = t; e.hidden = false; s.el.classList.remove("shake"); void s.el.offsetWidth; s.el.classList.add("shake") }
    setTimeout(() => p1.focus(), 250)
    const go = async () => {
      const p = p1.value
      if (mode === "setup") { if (p.length < 4) return err("Не короче 4 символов"); if (p !== $("#hp2", s.el).value) return err("Пароли не совпадают"); await tmpVault.setup(p); ok = true; return s.close() }
      if (await tmpVault.unlock(p)) { ok = true; s.close() } else err("Неверный пароль")
    }
    $('[data-a="ok"]', s.el).onclick = go; $('[data-a="no"]', s.el).onclick = () => s.close()
    $$("input", s.el).forEach(i => i.onkeydown = e => { if (e.key === "Enter") go() })
  })
}
const diaryLocked = () => !!CFG().diaryLock
async function diaryRead() {
  const list = goals("diary").sort((a, b) => b.date - a.date).slice(0, 60), out = []
  for (const e of list) {
    if (e.sealed) { try { out.push(Object.assign({ id: e.id, date: e.date }, await sealedBy(e.sealed).unseal(e.sealed))) } catch (x) { out.push({ id: e.id, date: e.date, text: "Запись не открылась", bad: true }) } }
    else out.push(e)
  }
  return out
}
async function diaryAdd(text, mood) {
  const rec = { id: uid("dy"), date: Date.now(), kind: "diary", day: dayKey(new Date()) }, body = { text: String(text).slice(0, 4000), ...(mood ? { mood } : {}) }
  if (diaryLocked()) { if (!(await V().open())) return null; rec.sealed = await V().seal(body) } else Object.assign(rec, body)
  return upsert("goals", rec)
}
async function diaryLock(on) {
  if (!(await V().open())) return false
  const list = goals("diary")
  for (const e of list) {
    if (on && !e.sealed) upsert("goals", { id: e.id, date: e.date, kind: "diary", day: e.day, sealed: await V().seal({ text: e.text, ...(e.mood ? { mood: e.mood } : {}) }) })
    if (!on && e.sealed) { try { const o = await sealedBy(e.sealed).unseal(e.sealed); upsert("goals", { id: e.id, date: e.date, kind: "diary", day: e.day, text: o.text, ...(o.mood ? { mood: o.mood } : {}) }) } catch (x) {} }
  }
  cfgSet({ diaryLock: !!on })
  return true
}
// Переход на общий сейф: записи "p1:" перешифровать в "v1:", когда сейф открыт
async function diaryMigrate() {
  if (V() === tmpVault || !tmpVault.isOpen() || !V().isOpen()) return
  for (const e of goals("diary").filter(x => /^p1:/.test(x.sealed || ""))) { try { upsert("goals", Object.assign({}, e, { sealed: await V().seal(await tmpVault.unseal(e.sealed)) })) } catch (x) {} }
}
async function diaryOpen(pre) {
  if (diaryLocked() && !(await V().open())) return
  await diaryMigrate()
  const list = await diaryRead(), m = moodToday()
  const s = sheet(`<h3>Дневник</h3>
    <div class="hl-lockrow">${hi(diaryLocked() ? "lock" : "unlock", 15)}<span>${diaryLocked() ? "Закрыт паролем — в таблице только шифр. Изи его не читает." : "Открытый. Изи его не читает."}</span><button class="act" data-a="lock">${diaryLocked() ? "Снять пароль" : "Закрыть паролем"}</button></div>
    <div class="field"><textarea id="dy-t" placeholder="Что сегодня было, что чувствуете, за что благодарны…">${esc(pre || "")}</textarea></div>
    <div class="btns"><button class="btn primary" data-a="ok">Записать</button></div>
    <div class="hl-diary">${list.map(e => `<div class="dy"><div class="s">${esc(dayName(new Date(e.date)))}, ${hm(new Date(e.date))}${e.mood ? " · " + face(e.mood - 1, 15) : ""}</div><div class="${e.bad ? "muted" : ""}">${esc(e.text).replace(/\n/g, "<br>")}</div></div>`).join("") || '<div class="empty">Записей пока нет. Пара строк в день — и через месяц видно, что помогает, а что выматывает.</div>'}</div>`)
  $('[data-a="ok"]', s.el).onclick = async () => { const t = $("#dy-t", s.el).value.trim(); if (!t) return toast("Напишите пару слов"); const r = await diaryAdd(t, m && sameDay(m.date, new Date()) ? m.v : 0); if (r) { s.close(); toast("Записано в дневник"); setTimeout(diaryOpen, 260) } }
  $('[data-a="lock"]', s.el).onclick = async () => {
    const on = !diaryLocked()
    if (!on && (await ui.confirm("Снять пароль?", `<div class="msg">Записи расшифруются и будут храниться в таблице открытым текстом.</div>`, ["Отмена", "Снять"])) !== "Снять") return
    s.close(); if (await diaryLock(on)) { toast(on ? "Дневник закрыт паролем" : "Пароль снят"); render(); setTimeout(diaryOpen, 260) }
  }
}

// ───────────── Дыхание на минуту ─────────────
function breathe() {
  let t0 = Date.now(), timer = null
  const s = sheet(`<h3 style="text-align:center">Дыхание · 1 минута</h3><div class="msg" style="text-align:center">Вдох 4 секунды, выдох 6. Плечи вниз.</div>
    <div class="hl-breath"><div class="orb"><i></i><i></i><i></i></div><b id="br-t">Вдох</b></div><div class="muted small" style="text-align:center" id="br-c">60</div>`, { onClose: () => clearInterval(timer) })
  const tick = () => {
    const el = (Date.now() - t0) / 1000, left = Math.max(0, 60 - Math.floor(el))
    $("#br-t", s.el).textContent = left ? (el % 10 < 4 ? "Вдох" : "Выдох") : "Готово"
    $("#br-c", s.el).textContent = left ? left + " с" : "Как вы теперь?"
    if (!left) { clearInterval(timer); $(".hl-breath", s.el).classList.add("done")
      s.el.insertAdjacentHTML("beforeend", `<div class="hl-mood" style="margin-top:6px">${MOODS.map((_, i) => `<button data-v="${i + 1}">${face(i)}</button>`).join("")}</div>`)
      $$("[data-v]", s.el).forEach(b => b.onclick = () => { logMood(+b.dataset.v); s.close(); render(); toast("Записано") }) }
  }
  timer = setInterval(tick, 250); tick()
}

// ───────────── Лекарства и витамины ─────────────
const meds = () => goals("med").filter(m => m.title && !m.off).sort((a, b) => (hmToMin((a.times || [])[0]) || 0) - (hmToMin((b.times || [])[0]) || 0))
const SLOT_NAME = t => { const m = hmToMin(t); return m < 11 * 60 ? "утром" : m < 16 * 60 ? "днём" : m < 21 * 60 ? "вечером" : "на ночь" }
const takenOn = (m, k) => ((m.taken || {})[k] || [])
const perDay = m => Math.max(1, (m.times || []).length) * (m.per || 1)
const daysLeft = m => m.stock != null && m.stock !== "" ? Math.floor(+m.stock / perDay(m)) : null
function medTake(id, slot, on = true) {
  const m = D.goals.find(x => x.id === id); if (!m) return null
  const k = dayKey(new Date()), t = Object.assign({}, m.taken), l = (t[k] || []).filter(x => x.split("@")[0] !== slot)
  const was = (t[k] || []).some(x => x.split("@")[0] === slot)
  if (on) l.push(slot + "@" + hm(new Date()))
  t[k] = l
  for (const d of Object.keys(t)) if (d < dayKey(addDays(new Date(), -120))) delete t[d]
  const stock = m.stock != null && m.stock !== "" ? Math.max(0, +m.stock + (on && !was ? -(m.per || 1) : !on && was ? (m.per || 1) : 0)) : m.stock
  const out = upsert("goals", Object.assign({}, m, { taken: t, stock }))
  medNudges(); return out
}
const slotTaken = (m, k, slot) => takenOn(m, k).find(x => x.split("@")[0] === slot)
function medFind(t) { const n = normT(t); return meds().find(m => normT(m.title) === n) || meds().find(m => normT(m.title).includes(n) || n.includes(normT(m.title))) }
function medForm(m) {
  const times = new Set(m ? m.times || [] : ["08:00"])
  const PRE = [["08:00", "Утром"], ["13:00", "Днём"], ["20:00", "Вечером"], ["22:30", "На ночь"]]
  const s = sheet(`<h3>${m ? "Лекарство" : "Лекарство или витамин"}</h3>
    <div class="field"><label>Название</label><input id="md-t" value="${esc(m ? m.title : "")}" placeholder="Витамин D 2000, Омега-3…"></div>
    <div class="field"><label>Доза</label><input id="md-d" value="${esc(m ? m.dose || "" : "")}" placeholder="1 капсула, с едой — необязательно"></div>
    <div class="field"><label>Когда</label><div class="chips" id="md-w">${PRE.map(([t, n]) => `<button class="chip" data-t="${t}">${n} · ${t}</button>`).join("")}</div>
      <div class="chips" id="md-x" style="margin-top:7px"></div><div class="md-add"><input id="md-h" type="time" value="09:00"><button class="btn primary" id="md-ok" aria-label="Добавить время"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button></div></div>
    <div class="field"><label>Осталось, штук</label><input id="md-s" type="number" inputmode="numeric" value="${m && m.stock != null ? esc(m.stock) : ""}" placeholder="Напомню купить, когда останется на неделю"></div>
    <div class="btns">${m ? '<button class="btn red" data-a="del">Убрать</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>
    <div class="muted small" style="margin-top:8px">В нужное время придёт пуш. Отметка «принял» — касанием кружка или словами Изи.</div>`, { onClose: () => render() })
  const paint = () => { $$("#md-w .chip", s.el).forEach(b => b.classList.toggle("on", times.has(b.dataset.t)))
    $("#md-x", s.el).innerHTML = [...times].filter(t => !PRE.some(p => p[0] === t)).sort().map(t => `<button class="chip on" data-x="${t}">${t} ✕</button>`).join("")
    $$("#md-x .chip", s.el).forEach(b => b.onclick = () => { times.delete(b.dataset.x); paint() }) }
  $$("#md-w .chip", s.el).forEach(b => b.onclick = () => { times.has(b.dataset.t) ? times.delete(b.dataset.t) : times.add(b.dataset.t); paint() })
  // Колесо времени на iPhone шлёт change при каждой остановке, поэтому время добавляем только по галочке
  $("#md-ok", s.el).onclick = () => { const v = $("#md-h", s.el).value; if (!v) return toast("Выберите время"); times.add(v); paint() }
  paint()
  $('[data-a="no"]', s.el).onclick = () => s.close()
  if (m) $('[data-a="del"]', s.el).onclick = () => { upsert("goals", Object.assign({}, m, { off: true })); medNudges(); s.close(); toast("Убрано") }
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#md-t", s.el).value.trim(); if (!title) return toast("Напишите название")
    if (!times.size) return toast("Выберите время")
    const st = $("#md-s", s.el).value
    upsert("goals", Object.assign({}, m || { id: uid("me"), date: Date.now(), kind: "med", taken: {} }, { title, dose: $("#md-d", s.el).value.trim(), times: [...times].sort(), stock: st === "" ? null : Math.max(0, Math.round(+st)) }))
    medNudges(); s.close(); toast(m ? "Сохранено" : "Добавлено")
  }
}
function medAdd(x) {
  const times = (Array.isArray(x.times) ? x.times : [x.times || "08:00"]).map(t => minToHm(hmToMin(t) ?? 480))
  const old = medFind(x.title || "")
  const rec = upsert("goals", Object.assign({}, old || { id: uid("me"), date: Date.now(), kind: "med", taken: {} }, { title: String(x.title).trim(), dose: x.dose || (old && old.dose) || "", times, per: +x.per || 1,
    stock: x.stock != null ? Math.round(+x.stock) : old ? old.stock : null, off: false }))
  medNudges(); return rec
}

// ───────────── Подсказки пушем: лекарства, «пора спать», медкарта ─────────────
// Это nudges: таблица шлёт их пушем в срок. Пересобираем на сегодня и завтра при каждом изменении и при запуске.
let nudgeBusy = false
function medNudges() {
  if (nudgeBusy) return; nudgeBusy = true
  try {
    const now = Date.now(), want = new Map(), on = k => typeof tipOn !== "function" || tipOn(k)   // блок скрыт — подсказок по нему нет
    for (let i = 0; i < 2; i++) {
      const d = addDays(sod(new Date()), i), k = dayKey(d)
      if (on("meds")) for (const m of meds()) for (const t of m.times || []) {
        if (slotTaken(m, k, t)) continue
        const at = +d + (hmToMin(t) || 0) * 60e3; if (at <= now) continue
        want.set(`md${m.id}${k}${t.replace(":", "")}`, { date: at, title: "Лекарства", text: `Пора принять: ${m.title}${m.dose ? " — " + m.dose : ""}. Ответь «принял» — отмечу.` })
      }
      const c = CFG()
      if (c.sleepPush !== false && on("sleep")) { let m = hmToMin(bedtime()) - 30; if (m < 12 * 60) m += 1440; const at = +d + m * 60e3
        if (at > now) want.set(`sl${k}`, { date: at, title: "Скоро спать", text: `Чтобы встать в ${c.wake} выспавшимся, лечь лучше до ${bedtime()}. Через 30 минут — экран в сторону.` }) }
      if (on("medrec")) for (const r of medrecs()) if (r.due === k) { const at = +d + 10 * 3600e3; if (at > now) want.set(`mr${r.id}${k}`, { date: at, title: "Медкарта", text: `Пора: ${r.title}${r.who && r.who !== "Я" ? " — " + r.who : ""}. Записаться сегодня?` }) }
    }
    for (const n of live(D.nudges)) if (/^(md|sl|mr)/.test(String(n.id)) && n.date > now && !want.has(n.id)) remove("nudges", n.id)
    for (const [id, x] of want) { const o = live(D.nudges).find(n => n.id === id); if (!o || o.date !== x.date || o.text !== x.text) upsert("nudges", Object.assign({ id }, x)) }
  } finally { nudgeBusy = false }
}

// ───────────── Медкарта семьи ─────────────
const medrecs = () => goals("medrec").filter(r => r.title).map(r => Object.assign({}, r, { due: r.next || (r.last && r.every ? addMonths(r.last, +r.every) : "") }))
  .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"))
const MR_PRE = ["Общий анализ крови", "Биохимия крови", "Терапевт", "Стоматолог", "Окулист", "Прививка", "Педиатр", "Флюорография", "Чек-ап"]
const MR_EVERY = { "Общий анализ крови": 12, "Биохимия крови": 12, "Терапевт": 12, "Стоматолог": 6, "Окулист": 12, "Флюорография": 12, "Чек-ап": 12, "Педиатр": 6 }
const family = () => { const s = new Set(["Я"]); const p = D.mny && D.mny.partner !== "Оля" && D.mny.partner; if (p) s.add(p); for (const k of (typeof kidsList === "function" ? kidsList() : [])) if (k.kid) s.add(k.kid); for (const r of goals("medrec")) if (r.who) s.add(r.who); return [...s] }
function medrecAdd(x) {
  const title = String(x.title || "").trim(); if (!title) return null
  const rec = { id: uid("mr"), date: Date.now(), kind: "medrec", who: String(x.who || "Я").trim(), title, last: /^\d{4}-\d\d-\d\d$/.test(x.last || "") ? x.last : "",
    every: +x.every || (x.every === 0 ? 0 : MR_EVERY[title] || 0), next: /^\d{4}-\d\d-\d\d$/.test(x.next || "") ? x.next : "" }
  const out = upsert("goals", rec); medNudges(); return out
}
function medrecForm(r) {
  let who = r ? r.who : "Я", title = r ? r.title : ""
  const s = sheet(`<h3>${r ? esc(r.title) : "Запись в медкарту"}</h3>
    <div class="field"><label>Кто</label><div class="chips" id="mr-w">${family().map(n => `<button class="chip" data-w="${esc(n)}">${esc(n)}</button>`).join("")}<button class="chip" data-w="+">+ Другой</button></div></div>
    <div class="field"><label>Что</label><input id="mr-t" value="${esc(title)}" placeholder="Анализ, врач, прививка"><div class="chips" style="margin-top:7px" id="mr-p">${MR_PRE.map(t => `<button class="chip" data-p="${esc(t)}">${esc(t)}</button>`).join("")}</div></div>
    <div class="field"><label>Когда был в последний раз</label><input id="mr-l" type="date" value="${esc(r ? r.last || "" : "")}"></div>
    <div class="field"><label>Повторять</label><div class="seg" id="mr-e">${[[0, "Не надо"], [6, "Раз в полгода"], [12, "Раз в год"]].map(([v, t]) => `<button data-e="${v}">${t}</button>`).join("")}</div></div>
    <div class="field"><label>Следующий раз (если уже известно)</label><input id="mr-n" type="date" value="${esc(r ? r.next || "" : "")}"></div>
    <div class="btns">${r ? '<button class="btn red" data-a="del">Убрать</button><button class="btn" data-a="done">Сделано сегодня</button>' : '<button class="btn" data-a="no">Отмена</button>'}<button class="btn primary" data-a="ok">Сохранить</button></div>`, { onClose: () => render() })
  let every = r ? +r.every || 0 : 12
  const paint = () => { $$("#mr-w .chip", s.el).forEach(b => b.classList.toggle("on", b.dataset.w === who)); $$("#mr-e button", s.el).forEach(b => b.classList.toggle("on", +b.dataset.e === every)) }
  $$("#mr-w .chip", s.el).forEach(b => b.onclick = async () => { if (b.dataset.w === "+") { const n = await ui.ask("Кто", "Имя", "", { ok: "Готово" }); if (n) { who = n; b.insertAdjacentHTML("beforebegin", `<button class="chip on">${esc(n)}</button>`) } } else who = b.dataset.w; paint() })
  $$("#mr-p .chip", s.el).forEach(b => b.onclick = () => { $("#mr-t", s.el).value = b.dataset.p; if (MR_EVERY[b.dataset.p] != null) every = MR_EVERY[b.dataset.p]; paint() })
  $$("#mr-e button", s.el).forEach(b => b.onclick = () => { every = +b.dataset.e; paint() })
  paint()
  const no = $('[data-a="no"]', s.el); if (no) no.onclick = () => s.close()
  if (r) {
    $('[data-a="del"]', s.el).onclick = () => { remove("goals", r.id); medNudges(); s.close() }
    $('[data-a="done"]', s.el).onclick = () => { upsert("goals", Object.assign({}, D.goals.find(x => x.id === r.id), { last: dayKey(new Date()), next: "" })); medNudges(); s.close(); toast("Отмечено. Напомню, когда снова пора") }
  }
  $('[data-a="ok"]', s.el).onclick = () => {
    const t = $("#mr-t", s.el).value.trim(); if (!t) return toast("Напишите, что это")
    const base = r ? D.goals.find(x => x.id === r.id) : { id: uid("mr"), date: Date.now(), kind: "medrec" }
    upsert("goals", Object.assign({}, base, { who, title: t, last: $("#mr-l", s.el).value || "", every, next: $("#mr-n", s.el).value || "" }))
    medNudges(); s.close(); toast("Сохранено")
  }
}
function medrecBook(id) {
  const r = medrecs().find(x => x.id === id); if (!r) return
  remAdd({ title: `Записаться: ${r.title}${r.who && r.who !== "Я" ? " (" + r.who + ")" : ""}`, due: dayKey(new Date()) + "T" + minToHm(Math.max(new Date().getHours() * 60 + new Date().getMinutes() + 60, 10 * 60)) })
  render(); toast("Добавил в напоминания на сегодня")
}

// ───────────── План тренировок ─────────────
const WDN = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
const WD_RE = [[1, /^пн|понед/i], [2, /^вт|вторн/i], [3, /^ср|сред/i], [4, /^чт|четв/i], [5, /^пт|пятн/i], [6, /^сб|субб/i], [7, /^вс|воскр/i]]
const wdParse = v => { if (+v >= 1 && +v <= 7) return +v; const s = String(v || "").trim(); const f = WD_RE.find(([, r]) => r.test(s)); return f ? f[0] : 0 }
const plan = () => live(D.goals).find(g => g.id === "wplan" && (g.items || []).length) || null
const weekStart = () => { const d = sod(new Date()); return addDays(d, -((d.getDay() + 6) % 7)) }
function planStatus(it) {
  const d = addDays(weekStart(), it.wd - 1), h = dayHealth(d), t0 = sod(new Date())
  const done = h.workouts.length || (h.exercise || 0) >= Math.max(20, (it.min || 30) * .6)
  const ev = iphone().events.find(e => sameDay(e.s, d) && normT(e.title).includes(normT(it.title).split(/[ ·,]/)[0]))
  return { d, done: !!done && d <= t0, ev, past: d < t0, today: sameDay(d, t0) }
}
function planSet(goal, items) {
  const its = (items || []).map(x => ({ wd: wdParse(x.wd ?? x.day), title: String(x.title || "").trim().slice(0, 60), min: Math.round(+x.min || +x.minutes || 45), time: hmToMin(x.time) != null ? minToHm(hmToMin(x.time)) : "" }))
    .filter(x => x.wd && x.title).sort((a, b) => a.wd - b.wd)
  const old = live(D.goals).find(g => g.id === "wplan") || { id: "wplan", kind: "wplan", date: Date.now() }
  return upsert("goals", Object.assign({}, old, { goal: String(goal || old.goal || "").slice(0, 60), items: its, week: dayKey(weekStart()) }))
}
async function planToCal() {
  const p = plan(); if (!p) return { added: 0 }
  let n = 0, warn = []
  for (const it of p.items) {
    const st = planStatus(it); if (st.past || st.ev) continue
    const at = new Date(+st.d + (hmToMin(it.time || "07:00")) * 60e3); if (at < new Date()) continue
    const r = await runTool("create_event", { title: it.title, start: iso(at), end: iso(new Date(+at + (it.min || 45) * 60e3)), calendar: "" })
    if (r && r.ok) n++; else if (r && r.warning) warn.push(it.title)
  }
  return { added: n, conflicts: warn }
}
function planForm() {
  const p = plan() || { goal: "", items: [] }
  let items = p.items.map(x => Object.assign({}, x))
  const s = sheet(`<h3>План тренировок</h3>
    <div class="field"><label>Цель</label><input id="wp-g" value="${esc(p.goal || "")}" placeholder="−6 кг и сила, 10 км без остановки…"></div>
    <div id="wp-l"></div>
    <div class="btns"><button class="btn small" data-a="add">+ День</button><button class="btn small" data-a="izi">${hi("spark", 14)} Составит Изи</button></div>
    <div class="btns" style="margin-top:12px"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`, { onClose: () => render() })
  const draw = () => {
    $("#wp-l", s.el).innerHTML = items.map((it, i) => `<div class="hl-wprow"><select data-i="${i}" data-k="wd">${WDN.slice(1).map((d, j) => `<option value="${j + 1}" ${it.wd === j + 1 ? "selected" : ""}>${d}</option>`).join("")}</select>
      <input data-i="${i}" data-k="title" value="${esc(it.title)}" placeholder="Что"><input data-i="${i}" data-k="time" type="time" value="${esc(it.time || "")}"><input data-i="${i}" data-k="min" type="number" inputmode="numeric" value="${it.min || 45}" title="минут"><button data-del="${i}" aria-label="Убрать">−</button></div>`).join("") || `<div class="empty">Добавьте дни или попросите Изи составить план под цель</div>`
    $$("#wp-l [data-k]", s.el).forEach(inp => inp.onchange = () => { const it = items[+inp.dataset.i]; it[inp.dataset.k] = inp.dataset.k === "wd" || inp.dataset.k === "min" ? +inp.value : inp.value })
    $$("#wp-l [data-del]", s.el).forEach(b => b.onclick = () => { items.splice(+b.dataset.del, 1); draw() })
  }
  draw()
  $('[data-a="add"]', s.el).onclick = () => { items.push({ wd: (items.length ? items[items.length - 1].wd % 7 : 0) + 1, title: "", min: 45, time: "07:00" }); draw() }
  $('[data-a="izi"]', s.el).onclick = () => { const g = $("#wp-g", s.el).value.trim(); s.close(); askIzi(`Составь мне план тренировок на неделю${g ? " под цель: " + g : ""}. Учти мой вес, шаги и готовность, нагрузку повышай постепенно. Сохрани план и поставь тренировки в календарь.`) }
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => { planSet($("#wp-g", s.el).value.trim(), items); s.close(); toast("План сохранён") }
}
const askIzi = text => { setTab("chat"); setTimeout(() => chatSend(text), 60) }

// ───────────── Вес: сглаженный тренд и прогноз ─────────────
function weightTrend() {
  const list = weights(); if (!list.length) return null
  const a = .3; let e = list[0].kg
  const sm = list.map(w => (e = e + a * (w.kg - e), { date: w.date, kg: w.kg, t: e }))
  const recent = sm.filter(p => p.date > Date.now() - 35 * 864e5)
  let slope = 0
  if (recent.length >= 3 && recent[recent.length - 1].date - recent[0].date > 6 * 864e5) {
    const xs = recent.map(p => (p.date - recent[0].date) / 864e5), ys = recent.map(p => p.t), mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length
    slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / Math.max(1e-9, xs.reduce((s, x) => s + (x - mx) ** 2, 0))
  }
  const last = sm[sm.length - 1], goal = +CFG().wgoal || 0
  let eta = null
  if (goal && slope && Math.sign(goal - last.t) === Math.sign(slope)) { const days = (goal - last.t) / slope; if (days > 0 && days < 730) eta = new Date(last.date + days * 864e5) }
  return { sm, last, week: slope * 7, goal, eta }
}
function weightCard2() {
  const tr = weightTrend()
  let html = `<div class="card hl-in" ${anim()}><h2><span>${hi("scale", 15)} Вес</span><span class="hl-h2r">${tr ? `<b class="hl-big">${kgs(tr.last.kg)} кг</b>` : ""}<button class="act" data-do="weight">+ Записать</button></span></h2>`
  if (!tr) return html + `<div class="empty">Взвешивайтесь раз в несколько дней — покажу ровную линию тренда без скачков и когда дойдёте до цели. Можно сказать Изи «вешу 91,5».</div></div>`
  const pts = tr.sm.slice(-40)
  if (pts.length > 1) {
    const t0 = pts[0].date, t1 = tr.eta && tr.eta - pts[pts.length - 1].date < 120 * 864e5 ? +tr.eta : pts[pts.length - 1].date + (pts[pts.length - 1].date - t0) * .3
    const all = pts.map(p => p.kg).concat(tr.goal && tr.eta ? [tr.goal] : []), lo = Math.min(...all) - .4, hi2 = Math.max(...all) + .4
    const X = t => ((t - t0) / Math.max(1, t1 - t0)) * 300, Y = v => 70 - ((v - lo) / (hi2 - lo)) * 62
    const lastP = pts[pts.length - 1], fx = tr.week ? (tr.eta ? +tr.eta : t1) : null, fy = tr.eta ? tr.goal : lastP.t + tr.week / 7 * ((t1 - lastP.date) / 864e5)
    html += `<svg class="hl-wt" viewBox="-6 0 312 76" preserveAspectRatio="none">${pts.map(p => `<circle cx="${X(p.date).toFixed(1)}" cy="${Y(p.kg).toFixed(1)}" r="2.3" class="raw"/>`).join("")}
      <polyline class="tr" points="${pts.map(p => X(p.date).toFixed(1) + "," + Y(p.t).toFixed(1)).join(" ")}"/>
      ${fx ? `<path class="fc" d="M${X(lastP.date).toFixed(1)} ${Y(lastP.t).toFixed(1)} L${X(fx).toFixed(1)} ${Y(fy).toFixed(1)}"/><circle class="end" cx="${X(fx).toFixed(1)}" cy="${Y(fy).toFixed(1)}" r="4"/>` : ""}</svg>`
  }
  const wk = tr.week, wkT = Math.abs(wk) < .05 ? "Вес стоит на месте" : `Тренд ${wk > 0 ? "+" : "−"}${dec(Math.abs(wk))} кг в неделю`
  html += `<div class="small" style="margin-top:6px">${wkT}.${tr.goal ? (tr.eta ? ` Цель ${kgs(tr.goal)} кг — примерно <b>${tr.eta.getDate()} ${MON_GEN[tr.eta.getMonth()]}${tr.eta.getFullYear() !== new Date().getFullYear() ? " " + tr.eta.getFullYear() : ""}</b>.` : Math.abs(tr.last.t - tr.goal) < .3 ? ` Цель ${kgs(tr.goal)} кг достигнута.` : ` До цели ${kgs(tr.goal)} кг при таком темпе не дойти — нужен ${tr.goal < tr.last.t ? "дефицит" : "профицит"} калорий.`) : ` <button class="link" data-hl="wgoal">Поставить цель</button>`}</div>`
  return html + `</div>`
}
async function wgoalForm() {
  const t = await ui.ask("Цель по весу", "В килограммах — посчитаю дату по тренду", CFG().wgoal ? kgs(CFG().wgoal) : "", { type: "text", ok: "Сохранить" })
  if (t == null) return
  const kg = parseFloat(String(t).replace(",", "."))
  if (!(kg > 20 && kg < 300)) return toast("Не понял вес")
  cfgSet({ wgoal: Math.round(kg * 10) / 10 }); render(); toast("Цель сохранена")
}

// ───────────── Сон: запись вручную и настройки ─────────────
function sleepForm() {
  const c = CFG(), s0 = nightOf(new Date())
  const s = sheet(`<h3>Сон</h3>
    <div class="grid2"><div class="field"><label>Лёг</label><input id="sl-b" type="time" value="${esc((s0 && s0.bed) || minToHm(hmToMin(c.wake) - c.need * 60))}"></div><div class="field"><label>Встал</label><input id="sl-w" type="time" value="${esc((s0 && s0.wake) || c.wake)}"></div></div>
    <div class="btns"><button class="btn primary" data-a="ok">Записать сон этой ночи</button></div>
    <h3 style="margin-top:18px">Режим</h3>
    <div class="set"><span>Встаю в</span><input id="sl-wk" type="time" value="${esc(c.wake)}"></div>
    <div class="set"><span>Нужно сна, часов</span><input id="sl-n" type="number" inputmode="decimal" step="0.5" value="${c.need}"></div>
    <div class="set"><span>Пуш «скоро спать»</span><div class="seg" id="sl-p" style="min-width:130px"><button data-p="1">Да</button><button data-p="0">Нет</button></div></div>
    <div class="muted small" style="margin-top:8px">Сон и пульс покоя сами приходят из Apple Здоровья, если в Быструю команду «Мой день - здоровье» добавить два шага. <button class="link" data-a="how">Как добавить</button></div>`, { onClose: () => render() })
  let push = c.sleepPush !== false
  const paint = () => $$("#sl-p button", s.el).forEach(b => b.classList.toggle("on", (b.dataset.p === "1") === push))
  $$("#sl-p button", s.el).forEach(b => b.onclick = () => { push = b.dataset.p === "1"; paint() }); paint()
  const saveCfg = () => { const wk = $("#sl-wk", s.el).value || c.wake, n = clamp(parseFloat(String($("#sl-n", s.el).value).replace(",", ".")) || 7.5, 5, 10)
    if (wk !== c.wake || n !== c.need || push !== (c.sleepPush !== false)) { cfgSet({ wake: wk, need: n, sleepPush: push }); medNudges() } }
  $('[data-a="ok"]', s.el).onclick = () => { const b = $("#sl-b", s.el).value, w = $("#sl-w", s.el).value; if (!b || !w) return toast("Укажите время"); logSleep({ bed: b, wake: w }); saveCfg(); s.close(); toast("Сон записан") }
  $('[data-a="how"]', s.el).onclick = () => { saveCfg(); s.close(); setTimeout(shortcutHow, 260) }
  $$("#sl-wk, #sl-n", s.el).forEach(i => i.onchange = saveCfg)
  $$("#sl-p button", s.el).forEach(b => b.addEventListener("click", saveCfg))
}
function logSleep(x) {
  let h = +x.hours || 0
  const b = hmToMin(x.bed), w = hmToMin(x.wake)
  if (!h && b != null && w != null) h = ((w - b + 1440) % 1440) / 60
  if (!(h > 0 && h < 16)) return null
  const day = /^\d{4}-\d\d-\d\d$/.test(x.day || "") ? x.day : dayKey(new Date())
  const old = goals("sleep").find(s => s.day === day)
  return upsert("goals", Object.assign({}, old || { id: uid("sl"), kind: "sleep", day }, { date: Date.now(), h: Math.round(h * 100) / 100, bed: b != null ? minToHm(b) : "", wake: w != null ? minToHm(w) : "" }))
}
function shortcutHow() {
  const s = sheet(`<h3>Сон и пульс из Apple Здоровья</h3>
    <div class="msg">Откройте Быстрые команды → «Мой день - здоровье». Перед шагом «Выполнить скрипт» добавьте:</div>
    <ol class="hl-steps">
      <li><b>Найти образцы здоровья</b>: тип «Анализ сна», дата начала — «за последние 1 день», значение — «Сон». Затем <b>Вычислить статистику</b> → «Сумма» по длительности.</li>
      <li><b>Найти образцы здоровья</b>: «Пульс в покое», сортировка «сначала новые», ограничение 1.</li>
      <li>В словарь, который уходит в Scriptable, добавьте ключи <b>sleep</b> (сумма сна, в часах или минутах) и <b>rhr</b> (пульс в покое). Можно ещё <b>bed</b> и <b>wake</b> — время отхода ко сну и подъёма.</li>
    </ol>
    <div class="muted small">Пока не настроено — сон можно записать вручную или сказать Изи «спал с 23:40 до 6:50».</div>
    <div class="btns"><button class="btn primary" data-a="ok">Понятно</button></div>`)
  $('[data-a="ok"]', s.el).onclick = () => s.close()
}

// ───────────── Отчёт за месяц для врача или тренера ─────────────
function monthHealth(at) {
  const from = new Date(at.getFullYear(), at.getMonth(), 1), to = new Date(at.getFullYear(), at.getMonth() + 1, 1), now = new Date(), end = to < now ? to : addDays(sod(now), 1)
  const days = []; for (let d = new Date(from); d < end; d = addDays(d, 1)) days.push(d)
  const H0 = days.map(d => dayHealth(d)), sl = days.map(nightOf).filter(Boolean), st = H0.filter(h => h.steps != null)
  const fd = H0.filter(h => h.kcal > 0), wd = H0.filter(h => h.water > 0)
  const ws = weights().filter(w => w.date >= +from && w.date < +to)
  const md = goals("mood").filter(m => m.date >= +from && m.date < +to)
  const wk = live(D.workouts).filter(w => w.date >= +from && w.date < +to)
  const medRows = goals("med").filter(m => m.title).map(m => { let need = 0, got = 0; for (const d of days) { if (d > now) break; const k = dayKey(d), tt = (m.times || []); need += tt.length; got += tt.filter(t => slotTaken(m, k, t)).length } return { title: m.title, dose: m.dose, need, got, off: m.off } }).filter(r => r.got || !r.off)
  const rh = days.map(rhrOf).filter(Boolean)
  const a = (l, f) => l.length ? l.reduce((s, x) => s + f(x), 0) / l.length : 0
  return { from, to, title: core.monthTitle(core.monthKey(from)), n: days.length, sleep: a(sl, x => x.h), sleepN: sl.length, short: sl.filter(x => x.h < 6).length,
    steps: a(st, x => x.steps), stepsN: st.length, kcal: a(fd, x => x.kcal), prot: a(fd, x => x.protein), water: a(wd, x => x.water), wk, wkMin: wk.reduce((s, w) => s + (w.minutes || 0), 0),
    w0: ws[0], w1: ws[ws.length - 1], mood: a(md, x => x.v), moodN: md.length, meds: medRows, rhr: a(rh, x => x), rhrN: rh.length, recs: medrecs() }
}
function reportHTML(r) {
  const row = (k, v) => `<div class="row"><span>${k}</span><b>${v}</b></div>`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Здоровье · ${esc(r.title)}</title><style>
:root{--bg:#F2F2F7;--card:#fff;--text:#1C1C1E;--sub:#6B7280;--line:#E5E5EA}@media (prefers-color-scheme:dark){:root{--bg:#000;--card:#1C1C1E;--text:#F2F2F7;--sub:#9AA1AD;--line:#2C2C2E}}
@media print{:root{--bg:#fff;--card:#fff;--text:#000;--sub:#555;--line:#ddd}body{padding:0}}
body{margin:0;padding:16px 12px 30px;background:var(--bg);color:var(--text);font:14.5px -apple-system,system-ui}h1{font-size:22px;margin:0}h2{font-size:12px;margin:18px 4px 6px;color:var(--sub);text-transform:uppercase;letter-spacing:.05em}
.list{background:var(--card);border-radius:14px;padding:2px 14px}.row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)}.row:last-child{border-bottom:0}.row span{color:var(--sub)}b{font-variant-numeric:tabular-nums;text-align:right}
</style></head><body><h1>Здоровье · ${esc(r.title)}</h1><div style="color:var(--sub);font-size:12px;margin-top:2px">Сводка из IZIDAY · ${r.n} дн.</div>
<h2>Тело</h2><div class="list">${row("Вес", r.w1 ? `${kgs(r.w1.kg)} кг${r.w0 && r.w0 !== r.w1 ? ` (${r.w1.kg - r.w0.kg > 0 ? "+" : "−"}${kgs(Math.abs(r.w1.kg - r.w0.kg))} за месяц)` : ""}` : "—")}
${row("Пульс покоя", r.rhrN ? `${Math.round(r.rhr)} уд/мин` : "—")}${row("Сон", r.sleepN ? `${hTxt(r.sleep)} в среднем${r.short ? `, ночей короче 6 ч: ${r.short}` : ""}` : "—")}</div>
<h2>Движение</h2><div class="list">${row("Шагов в день", r.stepsN ? num(r.steps) : "—")}${row("Тренировок", r.wk.length ? `${r.wk.length}, ${num(r.wkMin)} мин` : "—")}</div>
<h2>Питание</h2><div class="list">${row("Калории в день", r.kcal ? num(r.kcal) + " ккал" : "—")}${row("Белок в день", r.prot ? num(r.prot) + " г" : "—")}${row("Вода в день", r.water ? liters(r.water) + " л" : "—")}</div>
<h2>Лекарства и витамины</h2><div class="list">${r.meds.length ? r.meds.map(m => row(esc(m.title) + (m.dose ? " · " + esc(m.dose) : ""), m.need ? `принято ${m.got} из ${m.need} (${Math.round(m.got / m.need * 100)}%)` : "—")).join("") : row("Не записаны", "")}</div>
<h2>Самочувствие</h2><div class="list">${row("Настроение", r.moodN ? `${dec(r.mood)} из 5 (${r.moodN} отметок)` : "—")}</div>
${r.recs.length ? `<h2>Анализы и врачи</h2><div class="list">${r.recs.map(x => row(esc((x.who && x.who !== "Я" ? x.who + " · " : "") + x.title), x.last ? "был " + fdate(x.last) : x.due ? "следующий " + fdate(x.due) : "—")).join("")}</div>` : ""}
</body></html>`
}
function reportText(r) {
  return [`Здоровье · ${r.title}`, r.w1 ? `Вес ${kgs(r.w1.kg)} кг${r.w0 && r.w0 !== r.w1 ? ` (${r.w1.kg - r.w0.kg > 0 ? "+" : "−"}${kgs(Math.abs(r.w1.kg - r.w0.kg))})` : ""}` : "",
    r.sleepN ? `Сон в среднем ${hTxt(r.sleep)}` : "", r.rhrN ? `Пульс покоя ${Math.round(r.rhr)}` : "", r.stepsN ? `Шагов в день ${num(r.steps)}` : "",
    r.wk.length ? `Тренировок ${r.wk.length}, ${num(r.wkMin)} мин` : "", r.kcal ? `Питание ${num(r.kcal)} ккал, белок ${num(r.prot)} г в день` : "", r.water ? `Вода ${liters(r.water)} л в день` : "",
    ...r.meds.filter(m => m.need).map(m => `${m.title}: принято ${m.got} из ${m.need}`), r.moodN ? `Настроение ${dec(r.mood)} из 5` : ""].filter(Boolean).join("\n")
}
function reportSheet() {
  let cur = new Date()
  const s = sheet(`<div class="month"><button data-p="-1">‹</button><b class="rt"></b><button data-p="1">›</button></div><iframe class="report"></iframe>
    <div class="btns"><button class="btn" data-a="share">${hi("share", 15)} Тренеру</button><button class="btn primary" data-a="pdf">${hi("doc", 15)} PDF для врача</button></div>`)
  const draw = () => { const r = monthHealth(cur), nx = new Date(cur.getFullYear(), cur.getMonth() + 1, 1) > new Date()
    $(".rt", s.el).textContent = r.title; const nb = $('[data-p="1"]', s.el); nb.disabled = nx; nb.style.opacity = nx ? .3 : 1
    $("iframe", s.el).srcdoc = reportHTML(r); s.r = r }
  $$("[data-p]", s.el).forEach(b => b.onclick = () => { cur = new Date(cur.getFullYear(), cur.getMonth() + +b.dataset.p, 1); draw() })
  $('[data-a="share"]', s.el).onclick = () => { const text = reportText(s.r); if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard.writeText(text).then(() => toast("Скопировано")) }
  // «Печать» в iOS сразу даёт «Сохранить в PDF» и «Отправить»
  $('[data-a="pdf"]', s.el).onclick = () => { try { $("iframe", s.el).contentWindow.print() } catch (e) { toast("Не получилось открыть печать") } }
  draw()
}

// ───────────── Экран «Здоровье» ─────────────
function heroCard(rd) {
  if (!rd) {
    const c = CFG()
    return `<div class="hl-hero hl-in empty" ${anim()} data-hl="sleep"><div class="k">Готовность сегодня</div><div class="v">—</div>
      <div class="s2">Нужен сон этой ночи. Запишите его касанием или подключите Apple Здоровье — посчитаю готовность по сну, пульсу покоя и вчерашней нагрузке.</div>
      <span class="pill">${hi("bed", 15)} Записать сон</span><span class="pill">${hi("clock", 15)} подъём ${esc(c.wake)}</span></div>`
  }
  const c = 2 * Math.PI * 30
  return `<div class="hl-hero hl-in" ${anim()} data-hl="sleep"><div class="hl-hrow"><div class="grow"><div class="k">Готовность сегодня</div><div class="v"><span data-hcount="${rd.score}">${rd.score}</span> <small>из 100</small></div></div>
    <svg class="hl-gauge" viewBox="0 0 72 72"><circle cx="36" cy="36" r="30" class="tr"/><circle cx="36" cy="36" r="30" class="fg" style="stroke-dasharray:${c};stroke-dashoffset:${c * (1 - rd.score / 100)}"/></svg></div>
    <div class="s2">${esc(rd.why)} — ${esc(rd.adv)}.</div>
    <span class="pill">${hi("bed", 15)} сон ${hShort(rd.s.h)}</span>${rd.rhr ? `<span class="pill">${hi("heart", 15)} ${rd.rhr} уд/мин</span>` : ""}</div>`
}
function sleepCard() {
  const n = nights(7), c = CFG(), max = Math.max(c.need + 1, ...n.map(x => x.s ? x.s.h : 0))
  const got = n.filter(x => x.s), bt = bedtime()
  let html = `<div class="card hl-in" ${anim()}><h2><span>${hi("bed", 15)} Сон</span><button class="act" data-hl="sleep">${got.length ? "Записать" : "Добавить"}</button></h2>`
  html += `<div class="hl-bars">${n.map(x => { const h = x.s ? x.s.h : 0, p = h / max
    return `<div class="${sameDay(x.d, new Date()) ? "on" : ""}"><span class="lbl">${h ? hShort(h) : ""}</span><i class="${h && h < 6 ? "short" : ""}" style="height:${Math.max(h ? 8 : 3, p * 100)}%"></i><span>${WD[x.d.getDay()].replace(/^./, ch => ch.toUpperCase())}</span></div>` }).join("")}</div>`
  if (!got.length) return html + `<div class="small muted" style="margin-top:8px">Сна пока нет. Он придёт из Apple Здоровья через Быструю команду, а пока — запишите вручную. <button class="link" data-hl="how">Как подключить</button></div></div>`
  const avg = got.reduce((s, x) => s + x.s.h, 0) / got.length
  const beds = got.map(x => hmToMin(x.s.bed)).filter(v => v != null).map(v => v < 12 * 60 ? v + 1440 : v), spread = beds.length >= 3 ? sd(beds) : 0
  const reg = beds.length >= 3 ? (spread > 40 ? `Ложитесь в разное время (±${dec(spread / 60)} ч) — ровный режим даёт больше, чем лишний час сна. ` : "Режим ровный — так держать. ") : ""
  const debt = got.reduce((s, x) => s + Math.max(0, c.need - x.s.h), 0)
  html += `<div class="small" style="margin-top:8px">В среднем ${hTxt(avg)}${debt >= 2 ? `, недосып за неделю ${dec(debt)} ч` : ""}. ${reg}Сегодня лучше лечь до <b>${bt}</b>, чтобы встать в ${esc(c.wake)}.</div>`
  return html + `</div>`
}
function patternCard() {
  const p = patterns()
  if (p.list.length) return p.list.map((x, i) => `<div class="tip-card hl-in hl-tip" ${anim()}><div class="ic" style="background:linear-gradient(160deg,#C77DFF,#8E44E8)">${hi("spark", 20)}</div><div class="grow"><b>${i ? "Ещё закономерность" : "Закономерность"}</b><div class="small muted">${esc(x.t)}</div></div></div>`).join("")
  const need = Math.max(0, 14 - Math.min(p.have.sleep, p.have.mood))
  return `<div class="tip-card hl-in hl-tip" ${anim()}><div class="ic" style="background:linear-gradient(160deg,#C77DFF,#8E44E8)">${hi("spark", 20)}</div><div class="grow"><b>Ищу закономерности</b><div class="small muted">Сравниваю сон, еду, шаги, тренировки и настроение. ${need ? `Нужно ещё около ${need} ${plural(need, "дня", "дней", "дней")} со сном и настроением — и покажу личные выводы.` : "Пока явных связей нет — это тоже хороший знак."}</div></div></div>`
}
function moodCard() {
  const m = moodToday()
  return `<div class="card hl-in" ${anim()}><h2><span>Как вы сейчас?</span>${m ? `<span class="small muted" style="text-transform:none;letter-spacing:0;font-weight:500">${MOODS[m.v - 1][2]} · ${hm(new Date(m.date))}</span>` : ""}</h2>
    <div class="hl-mood">${MOODS.map((x, i) => `<button data-mood="${i + 1}" class="${m && m.v === i + 1 ? "on" : ""}" aria-label="${x[2]}">${face(i)}</button>`).join("")}</div>
    <div class="chips" style="margin-top:10px"><button class="chip" data-hl="breath">${hi("wind", 15, "#0A84FF")} Дыхание 1 мин</button><button class="chip" data-hl="diary">${hi(diaryLocked() ? "lock" : "book", 15, "#8A5A00")} Дневник</button></div></div>`
}
function activityCard(h, g) {
  return `<div class="card hl-in" ${anim()}><h2>Активность${h.watch ? `<span class="muted small" style="text-transform:none;letter-spacing:0">часы: ${ago(h.watch.updated)}</span>` : ""}</h2>
    <div class="watch"><div><b>${h.steps != null ? num(h.steps) : "—"}</b><span>шагов</span></div><div><b>${num(h.active)}</b><span>актив. ккал из ${num(g.moveGoal)}</span></div><div><b>${num(h.exercise)}</b><span>мин упражнений</span></div></div>
    ${!h.watch ? `<div class="muted small" style="margin-top:8px">Данные часов приходят через виджет после Быстрой команды «Мой день - здоровье».</div>` : h.watch && !h.active && !h.exercise && (h.steps || 0) > 2000 ? `<div class="muted small" style="margin-top:8px">Шаги есть, а калорий и минут нет — в Быстрой команде сбились шаги «Активная энергия» и «Время упражнений».</div>` : ""}
    <div class="btns" style="margin-top:10px"><button class="btn small" data-do="workout">+ Тренировка без часов</button></div>
    ${h.workouts.map(w => `<div class="row" data-wk="${esc(w.id)}"><div class="time">${hm(new Date(w.date))}</div><div class="grow"><div class="t">${esc(w.title)}</div><div class="s">${w.minutes} мин</div></div><div class="amt">−${num(w.kcal)}</div></div>`).join("")}</div>`
}
function waterCard(h, g) {
  const p = clamp(h.water / g.waterGoal, 0, 1.08)
  return `<div class="card hl-in" ${anim()}><h2><span>${hi("drop", 15)} Вода</span>${p >= 1 ? `<span class="small" style="color:#0A84FF;text-transform:none;letter-spacing:0">норма выпита</span>` : ""}</h2><div class="hl-water">
    <div class="hl-glass ${p >= 1 ? "full" : ""}" data-water="${g.glass}"><div class="liq" style="height:${Math.max(4, p * 92)}%"><svg viewBox="0 0 120 12" preserveAspectRatio="none"><path d="M0 6 Q15 0 30 6 T60 6 T90 6 T120 6 V12 H0z"/></svg><svg viewBox="0 0 120 12" preserveAspectRatio="none" class="b"><path d="M0 6 Q15 12 30 6 T60 6 T90 6 T120 6 V12 H0z"/></svg></div><i class="shine"></i></div>
    <div style="flex:1;min-width:0"><div class="hl-wtop"><div><div class="hl-big2">${liters(h.water)} л</div><div class="small muted">из ${liters(g.waterGoal)} л</div></div>${waterLog(h)}</div>
    <div class="btns" style="margin-top:10px"><button class="btn small hl-blue" data-water="${g.glass}">+ ${g.glass} мл</button><button class="btn small" data-water="500">+500</button></div>
    <div class="btns" style="margin-top:6px"><button class="btn small" data-water="other">Другое</button><button class="btn small" data-water="undo">Отменить</button></div></div></div></div>`
}
// История воды за сегодня — коротко справа от итога: время и объём, новые сверху, больше трёх — прокрутка.
// Нажать на отметку — удалить её (с вопросом).
function waterLog(h) {
  const l = (h.waterList || []).slice().sort((a, b) => b.date - a.date)
  if (!l.length) return ""
  return `<div class="hl-wlog${l.length > 3 ? " more" : ""}">${l.map((w, i) => `<button class="hl-wrow" data-wdel="${esc(w.id)}" style="--i:${Math.min(i, 6)}"><span>${hm(new Date(w.date))}</span><b>${num(w.ml)}<small> мл</small></b></button>`).join("")}</div>`
}
async function waterDel(id) {
  const w = live(D.water).find(x => x.id === id); if (!w) return
  const b = await ui.confirm(`Удалить ${num(w.ml)} мл?`, `<div class="msg">Отметка в ${hm(new Date(w.date))}</div>`, ["Отмена", "Удалить"])
  if (b !== "Удалить") return
  remove("water", id); render(); toast(`Убрано ${num(w.ml)} мл`)
}
function medsCard() {
  const l = meds(), k = dayKey(new Date()), now = new Date().getHours() * 60 + new Date().getMinutes()
  let html = `<div class="card hl-in" ${anim()} id="meds"><h2><span>${hi("pill", 15)} Лекарства и витамины</span><button class="act" data-hl="med-add">+ Добавить</button></h2>`
  if (!l.length) return html + `<div class="empty">Витамины, таблетки, курс антибиотиков — пришлю пуш в нужное время и подскажу, когда пора купить ещё. Можно сказать Изи «пью омегу с обедом».</div></div>`
  const shopHas = t => shopOpen().some(s => normT(s.title).includes(normT(t).split(" ")[0]))
  for (const m of l) for (const t of m.times || []) {
    const tk = slotTaken(m, k, t), dl = daysLeft(m), late = !tk && hmToMin(t) + 60 < now
    const low = dl != null && dl <= 7 ? (shopHas(m.title) ? ` · осталось ${m.stock} — уже в покупках` : ` · осталось ${m.stock} <button class="link" data-medshop="${esc(m.id)}">→ в покупки</button>`) : ""
    html += `<div class="row hl-med"><button class="check ${tk ? "on" : ""}" data-med="${esc(m.id)}" data-slot="${t}" aria-label="Принял"></button><div class="grow" data-medit="${esc(m.id)}"><div class="t">${esc(m.title)}${m.dose ? ` <span class="muted small">${esc(m.dose)}</span>` : ""}</div>
      <div class="s ${late ? "exp" : ""}">${SLOT_NAME(t)} · ${tk ? "принят " + (tk.split("@")[1] || "") : late ? "пропущен " + t : t}${low}</div></div></div>`
  }
  return html + `</div>`
}
function foodCard(h) {
  const kGoal = H().kcalGoal || 2000
  return `<div class="card hl-in" ${anim()}><h2>Еда<button class="act" data-do="food">+ Добавить</button></h2><div class="ring-row">
    ${ring(h.kcal / kGoal, h.kcal > kGoal ? "var(--red)" : "var(--gold)", num(h.kcal), "ккал")}
    <div style="flex:1" class="small muted">Белки <b style="color:var(--text)">${num(h.protein)} из ${proteinGoal()} г</b><div class="prog ${h.protein >= proteinGoal() ? "" : "gold"}" style="margin:4px 0 6px"><div style="width:${Math.min(1, (h.protein || 0) / proteinGoal()) * 100}%"></div></div>жиры <b style="color:var(--text)">${num(h.fat)} г</b> · углеводы <b style="color:var(--text)">${num(h.carbs)} г</b>
    <div class="btns" style="margin-top:10px"><button class="btn gold small" data-do="photo">По фото</button></div></div></div>
    ${h.food.map(f => `<div class="row" data-food="${esc(f.id)}"><div class="time">${hm(new Date(f.date))}</div><div class="grow"><div class="t">${esc(f.title || "Еда")}</div>${f.protein || f.fat || f.carbs ? `<div class="s">Б ${num(f.protein)} · Ж ${num(f.fat)} · У ${num(f.carbs)}</div>` : ""}</div><div class="amt">${num(f.kcal)}</div></div>`).join("")}</div>`
}
function planCard() {
  const p = plan()
  let html = `<div class="card hl-in" ${anim()}><h2><span>${hi("dumbbell", 15)} План тренировок</span>${p && p.goal ? `<span class="small muted" style="text-transform:none;letter-spacing:0;font-weight:500">цель: ${esc(p.goal)}</span>` : ""}</h2>`
  if (!p) return html + `<div class="small muted">Скажите цель — «минус 6 кг и сила, 3 раза в неделю» — Изи составит план, будет понемногу повышать нагрузку и поставит тренировки в календарь.</div>
    <div class="btns" style="margin-top:10px"><button class="btn small" data-hl="plan">Составить сам</button><button class="btn small primary" data-hl="plan-izi">${hi("spark", 14)} Составит Изи</button></div></div>`
  let need = 0
  html += p.items.map(it => { const st = planStatus(it); if (!st.past && !st.ev && !st.done) need++
    return `<div class="row"><div class="time" style="width:34px">${WDN[it.wd]}</div><div class="grow"><div class="t">${esc(it.title)}</div><div class="s">${it.min} мин${it.time ? " · " + it.time : ""} · ${st.done ? "сделано" : st.past ? "пропущено" : st.ev ? (st.today ? "сегодня, в календаре" : "в календаре") : st.today ? "сегодня" : "не в календаре"}</div></div>${st.done ? hi("check", 18, "#0A9F6E") : hi("dumbbell", 18, st.past ? "var(--red)" : "#8A8A8E")}</div>` }).join("")
  return html + `<div class="btns" style="margin-top:10px"><button class="btn small" data-hl="plan">Изменить</button>${need ? `<button class="btn small primary" data-hl="plan-cal">${hi("cal", 14)} В календарь (${need})</button>` : ""}</div></div>`
}
function medrecCard() {
  const l = medrecs(), t = dayKey(new Date())
  let html = `<div class="card hl-in" ${anim()}><h2><span>${hi("steth", 15)} Медкарта семьи</span><button class="act" data-hl="mr-add">+ Запись</button></h2>`
  if (!l.length) return html + `<div class="empty">Анализы, врачи, прививки детей. Отметьте, когда были в последний раз, — напомню, когда снова пора.</div></div>`
  return html + l.slice(0, 8).map(r => { const over = r.due && r.due <= t
    const sub = over ? (r.last ? `был${r.title.match(/а$/) ? "а" : ""} ${monthsAgo(r.last)} мес. назад — пора` : "пора") : r.due ? `следующий раз ${fdate(r.due)}` : r.last ? `был ${fdate(r.last)}` : "без даты"
    return `<div class="row" data-mr="${esc(r.id)}"><div class="grow"><div class="t">${r.who && r.who !== "Я" ? esc(r.who) + " · " : ""}${esc(r.title)}</div><div class="s">${esc(sub)}${r.every ? ` · раз в ${r.every === 12 ? "год" : r.every === 6 ? "полгода" : r.every + " мес."}` : ""}</div></div>${over ? `<button class="chip hl-warn" data-mrbook="${esc(r.id)}">Записаться</button>` : hi("clock", 18, "#8A8A8E")}</div>` }).join("") + `</div>`
}
function weekCharts(t0) {
  const days = [...Array(7)].map((_, i) => addDays(t0, i - 6))
  const kc = days.map(d => live(D.food).filter(f => sameDay(f.date, d)).reduce((s, f) => s + (f.kcal || 0), 0))
  const wa = days.map(d => live(D.water).filter(w => sameDay(w.date, d)).reduce((s, w) => s + (w.ml || 0), 0))
  const mk = Math.max(1, ...kc), mw = Math.max(1, ...wa)
  return `<div class="card hl-in" ${anim()}><h2>Неделя: калории</h2><div class="chart">${days.map((d, i) => `<div class="col"><div class="lbl">${kc[i] ? num(kc[i]) : ""}</div><div class="b" style="height:${kc[i] / mk * 100}%"></div><div class="lbl">${WD[d.getDay()]}</div></div>`).join("")}</div></div>
    <div class="card hl-in" ${anim()}><h2>Неделя: вода</h2><div class="chart">${days.map((d, i) => `<div class="col"><div class="lbl">${wa[i] ? liters(wa[i]) : ""}</div><div class="b w" style="height:${wa[i] / mw * 100}%"></div><div class="lbl">${WD[d.getDay()]}</div></div>`).join("")}</div></div>`
}
function reportCard() {
  return `<div class="card hl-in" ${anim()}><h2><span>${hi("doc", 15)} Отчёт за месяц</span></h2><div class="small muted">Вес, сон, пульс, шаги, питание и лекарства на одной странице.</div>
    <div class="btns" style="margin-top:10px"><button class="btn small primary" data-hl="report">${hi("doc", 14)} PDF для врача</button><button class="btn small" data-hl="report">${hi("share", 14)} Отправить тренеру</button></div>
    <div class="btns" style="margin-top:6px"><button class="btn small" data-report="week">Неделя</button><button class="btn small" data-report="month">Месяц</button><button class="btn small" data-report="year">Год</button></div></div>`
}
let health0 = null
function renderHealth2() {
  const day = healthDay(), isT = sameDay(day, new Date())
  anim.reset()
  if (!isT) {   // прошлый день — как было, плюс сон той ночи и настроение
    const html = health0(), s = nightOf(day), md = goals("mood").filter(m => m.day === dayKey(day)), i = html.indexOf("</div>") + 6
    const extra = s || md.length ? `<div class="card"><h2>Сон и самочувствие</h2><div class="watch"><div><b>${s ? hShort(s.h) : "—"}</b><span>сон</span></div><div><b>${rhrOf(day) || "—"}</b><span>пульс покоя</span></div><div><b>${md.length ? md.map(m => face(m.v - 1, 22)).join("") : "—"}</b><span>настроение</span></div></div></div>` : ""
    return html.slice(0, i) + extra + html.slice(i)
  }
  const g = H(), h = dayHealth(day), rd = readiness(day)
  let html = dayNav(day, "hday")
  html += heroCard(rd) + sleepCard() + patternCard() + moodCard() + waterCard(h, g) + medsCard() + activityCard(h, g) + foodCard(h)
  html += fastCard() + planCard() + weightCard2() + medrecCard() + weekCharts(day) + reportCard()
  return html
}

// ───────────── Изи: инструменты и знания ─────────────
const TOOLS = [
  { name: "log_sleep", description: "Записать сон: «спал с 23:40 до 6:50», «спал 6 часов». day — утро после ночи (YYYY-MM-DD, по умолчанию сегодня).", input_schema: { type: "object", properties: { hours: { type: "number" }, bed: { type: "string", description: "HH:MM" }, wake: { type: "string", description: "HH:MM" }, day: { type: "string" } } } },
  { name: "log_mood", description: "Отметить настроение 1–5 (1 плохо, 5 отлично), когда пользователь говорит о самочувствии: «паршиво», «отлично себя чувствую».", input_schema: { type: "object", properties: { value: { type: "number" }, note: { type: "string" } }, required: ["value"] } },
  { name: "add_med", description: "Добавить или изменить лекарство/витамин: время приёма (HH:MM, можно несколько), доза, сколько штук осталось. В срок придёт пуш.", input_schema: { type: "object", properties: { title: { type: "string" }, dose: { type: "string" }, times: { type: "array", items: { type: "string" } }, stock: { type: "number" }, per: { type: "number", description: "штук за приём" } }, required: ["title"] } },
  { name: "med_taken", description: "Отметить, что лекарство принято («выпил витамин D», «принял»). Без названия — ближайшее по времени непринятое.", input_schema: { type: "object", properties: { title: { type: "string" }, time: { type: "string", description: "приём HH:MM, если их несколько" } } } },
  { name: "add_medrec", description: "Запись в медкарту семьи: анализ, врач, прививка. last — когда был (YYYY-MM-DD), every_months — как часто повторять, next — назначенная дата. who — «Я» или имя.", input_schema: { type: "object", properties: { who: { type: "string" }, title: { type: "string" }, last: { type: "string" }, every_months: { type: "number" }, next: { type: "string" } }, required: ["title"] } },
  { name: "set_workout_plan", description: "Сохранить план тренировок на неделю. items: день недели (пн…вс), что делать (с конкретикой: веса, дистанция, темп), минут, время HH:MM. to_calendar — сразу поставить оставшиеся на этой неделе в календарь.", input_schema: { type: "object", properties: { goal: { type: "string" }, items: { type: "array", items: { type: "object", properties: { day: { type: "string" }, title: { type: "string" }, minutes: { type: "number" }, time: { type: "string" } }, required: ["day", "title"] } }, to_calendar: { type: "boolean" } }, required: ["items"] } },
  { name: "health_settings", description: "Настройки здоровья: wake — во сколько встаю (HH:MM), sleep_need — сколько часов сна нужно, weight_goal — цель по весу, кг.", input_schema: { type: "object", properties: { wake: { type: "string" }, sleep_need: { type: "number" }, weight_goal: { type: "number" } } } },
]
const STATUS = { log_sleep: "записываю сон", log_mood: "отмечаю настроение", add_med: "добавляю лекарство", med_taken: "отмечаю приём", add_medrec: "пишу в медкарту", set_workout_plan: "составляю план тренировок", health_settings: "меняю настройки" }
async function tool(name, x) {
  switch (name) {
    case "log_sleep": { const r = logSleep(x); if (!r) return { error: "нужны hours или bed и wake" }; const rd = readiness(); return { ok: true, hours: r.h, readiness: rd ? rd.score : null, advice: rd ? rd.adv : "" } }
    case "log_mood": { const r = logMood(x.value, x.note); return { ok: true, value: r.v } }
    case "add_med": { if (!x.title) return { error: "нужно название" }; const m = medAdd(x); return { ok: true, title: m.title, times: m.times, stock: m.stock, note: "пуш придёт в каждое время приёма" } }
    case "med_taken": {
      const k = dayKey(new Date()), now = new Date().getHours() * 60 + new Date().getMinutes()
      const cand = (x.title ? [medFind(x.title)].filter(Boolean) : meds()).flatMap(m => (m.times || []).filter(t => !slotTaken(m, k, t)).map(t => ({ m, t })))
      if (!cand.length) return x.title && !medFind(x.title) ? { error: "такого лекарства нет в списке — добавь через add_med" } : { ok: true, note: "всё на сегодня уже отмечено" }
      const pick = x.time ? cand.find(c => c.t === minToHm(hmToMin(x.time))) || cand[0] : cand.sort((a, b) => Math.abs(hmToMin(a.t) - now) - Math.abs(hmToMin(b.t) - now))[0]
      const r = medTake(pick.m.id, pick.t); const dl = daysLeft(r)
      return { ok: true, title: r.title, slot: pick.t, ...(dl != null ? { stock: r.stock, days_left: dl } : {}) }
    }
    case "add_medrec": { const r = medrecAdd({ who: x.who, title: x.title, last: x.last, every: x.every_months, next: x.next }); return r ? { ok: true, due: medrecs().find(z => z.id === r.id).due || null } : { error: "нужно название" } }
    case "set_workout_plan": { const p = planSet(x.goal, x.items); let cal = null; if (x.to_calendar) cal = await planToCal(); return { ok: true, days: p.items.length, ...(cal ? { calendar_added: cal.added, conflicts: cal.conflicts } : {}) } }
    case "health_settings": { const p = {}; if (hmToMin(x.wake) != null) p.wake = minToHm(hmToMin(x.wake)); if (+x.sleep_need) p.need = clamp(+x.sleep_need, 5, 10); if (+x.weight_goal) p.wgoal = +x.weight_goal; cfgSet(p); medNudges(); return { ok: true, bedtime: bedtime() } }
  }
  return null
}
function healthExtra() {
  const rd = readiness(), n = nights(7).filter(x => x.s), p = patterns(), k = dayKey(new Date()), tr = weightTrend(), pl = plan()
  return {
    sleep_last_night: rd ? { hours: Math.round(rd.s.h * 10) / 10, bed: rd.s.bed, wake: rd.s.wake } : null,
    sleep_week_avg_h: n.length ? Math.round(n.reduce((s, x) => s + x.s.h, 0) / n.length * 10) / 10 : null,
    resting_hr: rhrOf(new Date()), readiness: rd ? { score: rd.score, advice: rd.adv } : null, bedtime_tonight: bedtime(), wake: CFG().wake,
    mood_today: moodToday() ? moodToday().v : null, patterns: p.list.map(x => x.t),
    meds_today: meds().map(m => ({ title: m.title, dose: m.dose, times: m.times, taken: takenOn(m, k).map(x => x.split("@")[0]), stock: m.stock })),
    weight_trend: tr ? { kg: tr.last.kg, per_week: Math.round(tr.week * 100) / 100, goal: tr.goal || null, eta: tr.eta ? dayKey(tr.eta) : null } : null,
    workout_plan: pl ? { goal: pl.goal, items: pl.items.map(it => ({ day: WDN[it.wd], title: it.title, min: it.min, done: planStatus(it).done })) } : null,
    medcard: medrecs().slice(0, 10).map(r => ({ who: r.who, title: r.title, last: r.last || null, due: r.due || null })),
  }
}
function wrapIzi() {
  TOOLS.forEach(t => { if (!AGENT_TOOLS.some(x => x.name === t.name)) AGENT_TOOLS.push(t) })
  try { Object.assign(TOOL_STATUS, STATUS) } catch (e) {}
  const run0 = runTool
  runTool = async function (name, x) {
    const r = await tool(name, x || {}); if (r) return r
    const out = await run0.apply(this, arguments)
    if (name === "get_health" && out && typeof out === "object" && !out.error) try { Object.assign(out, healthExtra()) } catch (e) {}
    return out
  }
  const sys0 = agentSystem
  agentSystem = function () {
    return sys0.apply(this, arguments) + `
- Здоровье: сон, пульс покоя, «готовность» (0–100), настроение, лекарства, план тренировок, тренд веса и медкарта семьи — в get_health. Утром, если спрашивают про день или тренировку, опирайся на готовность. «Спал с … до …» — log_sleep; «мне паршиво / отлично» — log_mood; «пью витамин D утром» — add_med; «выпил таблетку», «принял» — med_taken; анализы, врачи, прививки — add_medrec.
- План тренировок (set_workout_plan): под цель и уровень, 3–5 дней, конкретно (веса, подходы, дистанция, темп), нагрузку повышай постепенно — не больше 5–10% в неделю; учитывай готовность и вчерашнюю нагрузку. Если просят — to_calendar: true.
- Дневник пользователя личный: ты его не читаешь и не пересказываешь. Можешь предложить записать мысли в дневник (раздел «Здоровье» → «Дневник»).
- Не ставь диагнозов и не назначай лекарства и дозы; при тревожных симптомах советуй врача.`
  }
}

// ───────────── Встраивание ─────────────
const HDO = {
  sleep: () => sleepForm(), how: () => shortcutHow(), breath: () => breathe(), diary: () => diaryOpen(),
  "med-add": () => medForm(), "mr-add": () => medrecForm(), plan: () => planForm(), "plan-izi": () => askIzi("Составь мне план тренировок на неделю. Сначала спроси цель, если не знаешь, потом сохрани план и поставь тренировки в календарь."),
  "plan-cal": async () => { const r = await planToCal(); render(); toast(r.added ? `В календаре: ${r.added}` : r.conflicts && r.conflicts.length ? "Время занято защищённым блоком — измените время" : "Нечего добавлять") },
  report: () => reportSheet(), wgoal: () => wgoalForm(),
}
function bindHealth(v) {
  if (tab !== "health") return
  $$("[data-wdel]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); waterDel(b.dataset.wdel) })
  $$("[data-hl]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); const f = HDO[b.dataset.hl]; if (f) f() })
  $$("[data-mood]", v).forEach(b => b.onclick = () => { const val = +b.dataset.mood; logMood(val); if (navigator.vibrate) navigator.vibrate(8)
    $$("[data-mood]", v).forEach(x => x.classList.toggle("on", x === b)); b.classList.add("pop")
    setTimeout(render, 420); toast(val <= 2 ? "Записал. Минута дыхания может помочь" : "Записано") })
  $$("[data-med]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); const on = !b.classList.contains("on"); medTake(b.dataset.med, b.dataset.slot, on); b.classList.toggle("on", on); if (navigator.vibrate) navigator.vibrate(10); setTimeout(render, 320) })
  $$("[data-medit]", v).forEach(el => el.onclick = () => medForm(D.goals.find(m => m.id === el.dataset.medit)))
  $$("[data-medshop]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); const m = D.goals.find(x => x.id === b.dataset.medshop); if (m) { shopAdd([m.title]); render(); toast("Добавил в покупки") } })
  $$("[data-mr]", v).forEach(el => el.onclick = () => medrecForm(medrecs().find(r => r.id === el.dataset.mr)))
  $$("[data-mrbook]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); medrecBook(b.dataset.mrbook) })
  const cnt = $("[data-hcount]", v)
  if (cnt && v.classList.contains("anim")) { const to = +cnt.dataset.hcount, t0 = performance.now(); const step = t => { const p = Math.min(1, (t - t0) / 700); cnt.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step) }; requestAnimationFrame(step) }
}
function init() {
  health0 = renderHealth
  renderHealth = renderHealth2
  const top0 = renderTop
  renderTop = function () {
    const out = top0.apply(this, arguments)
    if (tab === "health" && D.conn && !D.sync.error && !(typeof netDown === "function" && netDown())) { const rd = sameDay(healthDay(), new Date()) && readiness(); $("#top-sub").textContent = rd ? `Сегодня · готовность ${rd.score}` : "Сон, вода, лекарства, тренировки" }
    return out
  }
  const render0 = render
  let nAt = 0
  render = function () { const out = render0.apply(this, arguments); try { bindHealth($("#view")) } catch (e) { console.error("health", e) }
    if (Date.now() - nAt > 3000) { nAt = Date.now(); setTimeout(medNudges, 50) }   // после обмена с таблицей лекарства могли прийти — пересобрать подсказки
    return out }
  // planDay стирает подсказки дня — наши (лекарства, сон, медкарта) после этого собираем заново
  const pd0 = planDay
  planDay = function () { const out = pd0.apply(this, arguments); medNudges(); return out }
  wrapIzi()
  medNudges()
  setInterval(() => { if (document.visibilityState === "visible") medNudges() }, 30 * 60e3)
  render()
  window.HEALTH = { readiness, patterns, nightOf, rhrOf, medNudges, logSleep, logMood, medAdd, medTake, medrecAdd, planSet, weightTrend, monthHealth, reportHTML, healthExtra, tmpVault, diaryAdd, diaryRead, diaryLock, CFG, cfgSet }
}
try { init() } catch (e) { console.error("health", e) }
})()
