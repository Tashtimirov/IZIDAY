// IZIDAY · Память Изи и сейф. Подключается ПОСЛЕ app.js и дополняет hubPost, upsert, runTool, memoryBlock и DO.memory.
//
// Сейф (window.vault). Два ключа, оба создаются на телефоне:
//  • ключ данных (AES-GCM 256) — им шифруется вся память и журнал перед отправкой в таблицу ("d1:…"). На телефоне он лежит
//    в IndexedDB неизвлекаемым CryptoKey, поэтому Изи читает обычную память всегда, а в таблице — только шифр;
//  • ключ «сокровенного» (RSA-OAEP 2048 + AES-GCM на запись, "v1:…"). Записать можно всегда (открытым ключом),
//    прочитать — только после Face ID (passkey с расширением PRF) или кода восстановления; открыт 5/15 мин или до выхода.
// Оба ключа завёрнуты (а) ключом из Face ID и (б) ключом из кода восстановления; обёртки лежат в записи памяти
// { id: "vault", kind: "vault", meta } — она синхронизируется, поэтому на новом iPhone или Mac (тот же Apple ID,
// passkey приходит через iCloud) сейф открывается по лицу, а без iCloud — кодом.
// Пароли, коды, номера карт и паспорта помощник не запоминает вовсе.
// Журнал Изи: список log (90 дней) — что помощник сделал сам; изменения записей в приложении можно отменить.
(function () {
"use strict"
const PW = /Android/i.test(navigator.userAgent) ? "менеджере паролей Google" : "«Паролях» iPhone"
const SB = crypto.subtle, te = new TextEncoder(), td = new TextDecoder()
const rnd = n => crypto.getRandomValues(new Uint8Array(n))
const b64 = buf => { const a = new Uint8Array(buf); let s = ""; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") }
const unb64 = s => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a }
const cat = (...xs) => { const o = new Uint8Array(xs.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of xs) { o.set(x, p); p += x.length } return o }
const gcmKey = raw => SB.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"])
const gcmEnc = async (key, bytes) => { const iv = rnd(12); return cat(iv, new Uint8Array(await SB.encrypt({ name: "AES-GCM", iv }, key, bytes))) }
const gcmDec = async (key, bytes) => new Uint8Array(await SB.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12)))
const RSA = { name: "RSA-OAEP", hash: "SHA-256" }

// ───────────── Хранилище ключа на телефоне ─────────────
const idb = () => new Promise((res, rej) => { const r = indexedDB.open("iziday-vault", 1); r.onupgradeneeded = () => r.result.createObjectStore("k"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
async function idbGet(k) { try { const db = await idb(); return await new Promise((res, rej) => { const q = db.transaction("k").objectStore("k").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) }) } catch (e) { return null } }
async function idbSet(k, v) { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction("k", "readwrite"); if (v === undefined) t.objectStore("k").delete(k); else t.objectStore("k").put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error) }) }

// ───────────── Код восстановления: 24 знака (120 бит), без похожих букв ─────────────
const ABC = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const genCode = () => Array.from(rnd(24), b => ABC[b & 31]).join("").replace(/(.{4})(?!$)/g, "$1-")
const normCode = c => String(c || "").toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/[^0-9A-Z]/g, "")
async function codeKey(code, salt, it) {
  const base = await SB.importKey("raw", te.encode(normCode(code)), "PBKDF2", false, ["deriveKey"])
  return SB.deriveKey({ name: "PBKDF2", salt, iterations: it, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
}
async function prfKey(out) {
  const base = await SB.importKey("raw", out, "HKDF", false, ["deriveKey"])
  return SB.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: te.encode("iziday-vault-v1") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
}

// ───────────── Face ID: passkey с PRF (iOS 18+, macOS 15+) ─────────────
const canFace = () => !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create)
async function passkeyCreate(salt) {
  const cred = await navigator.credentials.create({ publicKey: {
    rp: { name: "IZIDAY" }, user: { id: rnd(16), name: "IZIDAY", displayName: "Сейф памяти IZIDAY" }, challenge: rnd(32),
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
    authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" }, timeout: 120000,
    extensions: { prf: { eval: { first: salt } } } } })
  const ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {}
  const out = ext.prf && ext.prf.results && ext.prf.results.first
  return { id: b64(cred.rawId), out: out ? new Uint8Array(out) : null, noprf: !ext.prf || ext.prf.enabled === false }
}
async function passkeyGet(id, salt) {
  const a = await navigator.credentials.get({ publicKey: { challenge: rnd(32), allowCredentials: id ? [{ type: "public-key", id: unb64(id) }] : [],
    userVerification: "required", timeout: 120000, extensions: { prf: { eval: { first: salt } } } } })
  const ext = a.getClientExtensionResults ? a.getClientExtensionResults() : {}
  const out = ext.prf && ext.prf.results && ext.prf.results.first
  if (!out) throw new Error("Face ID не выдал ключ: нужен iOS 18 или новее")
  return new Uint8Array(out)
}

// ───────────── Состояние сейфа ─────────────
const V = { dk: null, priv: null, pub: null, cache: new Map(), timer: 0, until: 0 }
const metaRec = () => live(D.memory).find(m => m.kind === "vault" && m.meta)
const meta = () => { const r = metaRec(); return r ? r.meta : null }
const vaultOn = () => !!meta()
const secretOpen = () => !!V.priv
const ttl = () => (D.vaultTtl == null ? 15 : D.vaultTtl)   // минуты; 0 — до выхода из приложения

async function pubKey() { const m = meta(); if (!m) throw new Error("сейф не включён"); return V.pub || (V.pub = await SB.importKey("spki", unb64(m.pub), RSA, false, ["encrypt"])) }
async function seal(obj) {   // сокровенное: записать можно всегда, прочитать — после Face ID
  const k = rnd(32), ek = new Uint8Array(await SB.encrypt({ name: "RSA-OAEP" }, await pubKey(), k))
  return "v1:" + b64(cat(ek, await gcmEnc(await gcmKey(k), te.encode(JSON.stringify(obj)))))
}
async function unseal(str) {
  if (!V.priv) throw new Error("сейф закрыт")
  const b = unb64(String(str).slice(3)), k = new Uint8Array(await SB.decrypt({ name: "RSA-OAEP" }, V.priv, b.slice(0, 256)))
  return JSON.parse(td.decode(await gcmDec(await gcmKey(k), b.slice(256))))
}
const sealD = async obj => "d1:" + b64(await gcmEnc(V.dk, te.encode(JSON.stringify(obj))))
const unsealD = async str => JSON.parse(td.decode(await gcmDec(V.dk, unb64(String(str).slice(3)))))

async function loadDeviceKey() {
  const m = meta(); if (!m || V.dk) return !!V.dk
  const r = await idbGet("dk")
  if (r && r.kid === m.kid && r.key) { V.dk = r.key; await decryptLocal(); return true }
  return false
}
async function installDK(raw, m) {
  V.dk = await gcmKey(raw)
  try { await idbSet("dk", { kid: m.kid, key: V.dk }) } catch (e) { /* без IndexedDB ключ живёт до закрытия */ }
  await decryptLocal(); touchPlain()
}
// Записи, пришедшие шифром, на телефоне раскрываем: Изи читает их без Face ID
async function decryptLocal() {
  if (!V.dk) return
  let n = 0
  for (const k of ["memory", "log"]) for (let i = 0; i < D[k].length; i++) {
    const x = D[k][i]
    if (!x || x.deleted || typeof x.sealed !== "string" || !x.sealed.startsWith("d1:")) continue
    try { const y = await unsealD(x.sealed); D[k][i] = Object.assign({ id: x.id, date: x.date, u: x.u, kind: x.kind }, y); n++ } catch (e) {}
  }
  if (n) { save(false); if (window.memRefresh) memRefresh() }
}
// Записи, сделанные без ключа (новый телефон до открытия сейфа), — отправить заново, уже шифром
function touchPlain() {
  let n = 0
  for (const k of ["memory", "log"]) for (const x of D[k]) if (x && !x.deleted && x.kind !== "vault" && !x.sealed) { x.u = (typeof nowSrv === "function" ? nowSrv() : Date.now()) + (n++); }
  if (n) save()
}
async function applyBundle(b) {
  V.priv = await SB.importKey("pkcs8", unb64(b.sk), RSA, false, ["decrypt"])
  V.bundle = te.encode(JSON.stringify(b))   // пока открыто — чтобы можно было добавить Face ID
  if (!V.dk) await installDK(unb64(b.dk), meta())
  await fillCache(); arm()
  journal("vault", "Открывал сокровенное" + (ttl() ? ` на ${ttl()} мин` : " до выхода"))
}
async function fillCache() {
  if (!V.priv) return
  for (const x of live(D.memory)) if (x.secret && x.sealed && !V.cache.has(x.id)) { try { V.cache.set(x.id, await unseal(x.sealed)) } catch (e) {} }
}
function arm() {
  clearTimeout(V.timer); V.until = ttl() ? Date.now() + ttl() * 60000 : 0
  if (V.until) V.timer = setTimeout(lock, ttl() * 60000)
}
function lock() { clearTimeout(V.timer); V.priv = null; V.bundle = null; V.cache.clear(); V.until = 0; if (window.memRefresh) memRefresh() }
document.addEventListener("visibilitychange", () => { if (!document.hidden && V.until && Date.now() > V.until) lock() })

async function unlockFace() {
  const m = meta(); if (!m || !m.pk) throw new Error("Face ID для сейфа не настроен")
  const out = await passkeyGet(m.pk.id, unb64(m.pk.salt))
  let b; try { b = await gcmDec(await prfKey(out), unb64(m.pk.w)) } catch (e) { throw new Error("этот Face ID не подходит к сейфу") }
  await applyBundle(JSON.parse(td.decode(b)))
}
async function unlockCode(code) {
  const m = meta(); if (!m) throw new Error("сейф не включён")
  let b; try { b = await gcmDec(await codeKey(code, unb64(m.rc.s), m.rc.it), unb64(m.rc.w)) } catch (e) { throw new Error("код не подошёл") }
  await applyBundle(JSON.parse(td.decode(b)))
}

// Создать сейф: ключи, обёртки кодом и Face ID. Вызывать по нажатию (Face ID требует жеста)
async function createVault(code) {
  const dk = rnd(32)
  const kp = await SB.generateKey(Object.assign({ modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, RSA), true, ["encrypt", "decrypt"])
  const bundle = te.encode(JSON.stringify({ dk: b64(dk), sk: b64(await SB.exportKey("pkcs8", kp.privateKey)) }))
  const rs = rnd(16), it = 310000
  const m = { v: 1, kid: b64(rnd(9)), at: Date.now(), pub: b64(await SB.exportKey("spki", kp.publicKey)),
    rc: { s: b64(rs), it, w: b64(await gcmEnc(await codeKey(code, rs, it), bundle)) } }
  let face = ""
  if (canFace()) {
    try {
      const salt = rnd(32), pk = await passkeyCreate(salt)
      let out = pk.out
      if (!out && !pk.noprf) out = await passkeyGet(pk.id, salt)
      if (out) m.pk = { id: pk.id, salt: b64(salt), w: b64(await gcmEnc(await prfKey(out), bundle)) }
      else face = "Этот браузер не умеет открывать сейф по Face ID — сокровенное откроется кодом."
    } catch (e) { face = e.name === "NotAllowedError" ? "Face ID отменён — сокровенное пока откроется кодом, Face ID можно добавить позже." : "Face ID не подключился: " + (e.message || e) }
  } else face = "Face ID здесь недоступен — сокровенное откроется кодом."
  upsert("memory", { id: "vault", date: Date.now(), kind: "vault", meta: m })
  V.pub = kp.publicKey
  await installDK(dk, m)
  touchPlain()
  journal("vault", "Включил сейф памяти")
  return face
}
async function addFace() {   // Face ID позже: нужен открытый сейф (ключи в памяти)
  if (!V.priv) throw new Error("сначала откройте сейф кодом")
  const m = Object.assign({}, meta())
  const salt = rnd(32), pk = await passkeyCreate(salt)
  let out = pk.out; if (!out && !pk.noprf) out = await passkeyGet(pk.id, salt)
  if (!out) throw new Error("этот браузер не умеет Face ID для сейфа")
  m.pk = { id: pk.id, salt: b64(salt), w: b64(await gcmEnc(await prfKey(out), V.bundle)) }
  upsert("memory", Object.assign({}, metaRec(), { meta: m }))
}

// ───────────── Граница с таблицей: память и журнал уходят шифром ─────────────
const SEALED = ["memory", "log"]
async function sealOut(x) {
  if (!x || x.deleted || x.kind === "vault" || x.sealed) return x
  if (!V.dk) return null   // ключа ещё нет на этом телефоне — уйдёт после открытия сейфа (touchPlain)
  const { id, date, u, kind, ...rest } = x
  return { id, date, u, kind, sealed: await sealD(rest) }
}
async function openIn(x) {
  if (!x || !V.dk || typeof x.sealed !== "string" || !x.sealed.startsWith("d1:")) return x
  try { return Object.assign({ id: x.id, date: x.date, u: x.u, kind: x.kind }, await unsealD(x.sealed)) } catch (e) { return x }
}
const _hubPost = hubPost
hubPost = async function (h, timeout) {
  if (h && h.lists && vaultOn()) {
    await loadDeviceKey()
    const lists = Object.assign({}, h.lists)
    for (const k of SEALED) if (lists[k]) lists[k] = (await Promise.all(lists[k].map(sealOut))).filter(Boolean)
    h = Object.assign({}, h, { lists })
  }
  const r = await _hubPost(h, timeout)
  if (r && r.lists) {
    const m = (r.lists.memory || []).find(x => x && x.kind === "vault" && x.meta)
    if (vaultOn()) await loadDeviceKey()
    for (const k of SEALED) if (r.lists[k]) r.lists[k] = await Promise.all(r.lists[k].map(openIn))
  }
  return r
}

// ───────────── Сферы и люди ─────────────
const SPH = [
  ["me", "Я", "#5E5CE6", "user"], ["goals", "Цели", "#0A9F6E", "target"], ["health", "Здоровье", "#FF453A", "heart"],
  ["family", "Семья", "#AF52DE", "users"], ["friends", "Друзья и знакомые", "#FF9F0A", "chat"], ["work", "Работа", "#0A84FF", "briefcase"],
  ["money", "Деньги", "#30B0C7", "wallet"], ["values", "Ценности и правила", "#34C759", "plant"]]
const SPH_IDS = SPH.map(s => s[0])
const sphName = id => (SPH.find(s => s[0] === id) || [0, "Без сферы"])[1]
// Все факты, которые Изи может прочитать сейчас: обычные + сокровенные, если сейф открыт
function allFacts() {
  const out = []
  for (const x of live(D.memory)) {
    if (x.kind !== "fact") continue
    if (x.secret) { const c = V.cache.get(x.id); if (c) out.push(Object.assign({}, x, c, { secret: 1 })) }
    else if (typeof x.text === "string") out.push(x)
  }
  return out.sort((a, b) => a.date - b.date)
}
const secretCount = () => live(D.memory).filter(x => x.kind === "fact" && x.secret).length
const people = facts => { const m = new Map(); for (const f of facts) if (f.person) { const k = f.person.trim(); if (k) (m.get(k) || m.set(k, []).get(k)).push(f) } return m }
const lockedCount = () => live(D.memory).filter(x => x.kind === "fact" && !x.secret && x.sealed).length

// ───────────── Чего не запоминать ─────────────
function luhn(d) { let s = 0; for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9 } s += n } return s % 10 === 0 }
function sensitive(t) {
  const s = String(t || "")
  if (/парол|password|passcode|пин[- ]?код|\bpin\b|\bcvv\b|\bcvc\b|код из смс|код подтвержд|сид[- ]?фраз|seed phrase|секретн\w* (слово|вопрос|фраз)|логин и пароль/i.test(s)) return "пароль или код"
  for (const m of s.match(/(?:\d[ -]?){13,19}/g) || []) { const d = m.replace(/\D/g, ""); if (d.length >= 13 && luhn(d)) return "номер карты" }
  if (/паспорт\w*[^.\n]{0,20}\d{2}\s?\d{2}\s?\d{6}|\b[A-Z]{1,2}\d{7}\b/i.test(s) && /паспорт|passport/i.test(s)) return "номер паспорта"
  if (/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/.test(s.replace(/\s/g, ""))) return "номер счёта"
  return ""
}

// ───────────── Журнал Изи ─────────────
LISTS.log = 90
if (!Array.isArray(D.log)) D.log = []
const LOG_CAT = { money: ["add_money", "update_money", "delete_money", "add_jar", "jar_deposit", "add_debt", "set_budget", "add_recurring", "pay_recurring", "skip_card_payment"],
  cal: ["create_event", "update_event", "delete_event", "create_reminder", "update_reminder", "delete_reminder", "plan_day"],
  mem: ["remember", "forget", "open_secret"], health: ["add_food", "add_water", "add_workout", "log_weight", "mark_habit", "delete_record", "set_protein_goal"] }
const catOf = name => Object.keys(LOG_CAT).find(k => LOG_CAT[k].includes(name)) || "other"
const READ_ONLY = /^(get_|search_|read_|list_|where_was_i|route_to|ask_user|recall|mail_search|mail_read)/
const PAST = { add_money: x => `Записал ${x.type === "income" ? "доход" : "расход"} ${x.amount || ""}${x.category ? " · " + x.category : ""}${x.comment ? " · " + x.comment : ""}`,
  update_money: x => `Поправил операцию${x.category ? ": " + x.category : ""}`, delete_money: () => "Удалил операцию",
  create_event: x => `Создал событие «${x.title || ""}»`, update_event: x => `Изменил событие${x.title ? " «" + x.title + "»" : ""}`, delete_event: () => "Удалил событие",
  create_reminder: x => `Поставил напоминание «${x.title || ""}»`, update_reminder: () => "Изменил напоминание", delete_reminder: () => "Удалил напоминание",
  add_food: x => `Записал еду: ${x.title || ""}`, add_water: x => `Записал воду ${x.ml || ""} мл`, add_workout: x => `Записал тренировку: ${x.title || ""}`,
  remember: x => `Запомнил: «${String(x.text || "").slice(0, 80)}»`, forget: () => "Забыл факт", claude_code: x => `Передал задачу в Claude Code: «${String(x.task || "").slice(0, 60)}»`,
  mail_send: x => `Отправил письмо${x.to ? " " + x.to : ""}`, mail_reply: () => "Ответил на письмо", mail_draft: () => "Сохранил черновик письма", mail_modify: x => `Разобрал почту (${x.op || ""})`,
  add_shopping: x => `Добавил в покупки: ${(x.items || []).join(", ")}`, save_receipt: x => `Запомнил цены из чека: ${x.store || ""}`, add_goal: x => `Добавил цель: ${(x.items || []).join(", ")}`, log_weight: x => `Записал вес ${x.kg || ""} кг`,
  mark_habit: x => `Отметил привычку ${x.habit || x.title || ""}`, plan_day: () => "Составил план подсказок на день", delete_record: () => "Удалил запись" }
function journal(cat, text, extra) {
  const r = Object.assign({ id: uid("j"), date: Date.now(), kind: "log", cat, text: String(text).slice(0, 300) }, extra || {})
  _upsert("log", r)
  return r
}
let TXN = null
const _upsert = upsert
upsert = function (key, rec) {
  if (key === "memory" && rec && rec.kind === "fact" && typeof rec.text === "string" && !rec.secret) {
    const why = sensitive(rec.text)
    if (why) { journal("mem", `Отказался запомнить ${why}`); return rec }   // и из разговора, и из сводки разговора
  }
  if (TXN && key !== "log" && rec && rec.id) { const before = D[key].find(x => x.id === rec.id); TXN.push({ key, id: rec.id, before: before ? JSON.parse(JSON.stringify(before)) : null }) }
  return _upsert(key, rec)
}
async function undo(id) {
  const j = live(D.log).find(x => x.id === id)
  if (!j || !j.undo || j.undone) return false
  for (const c of j.undo.slice().reverse()) {
    if (c.before && !c.before.deleted) _upsert(c.key, Object.assign({}, c.before))
    else _upsert(c.key, { id: c.id, deleted: true })
  }
  _upsert("log", Object.assign({}, j, { undone: Date.now() }))
  return true
}

// ───────────── Подборка памяти для разговора ─────────────
let lastPick = []
function pickMemory() {
  const all = allFacts(), msgs = D.chat.filter(m => m.role === "user" && !m.local).slice(-3).map(m => m.prompt || m.text).join(" ")
  const toks = s => String(s || "").toLowerCase().replace(/ё/g, "е").split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const STOP = new Set("что как это для мне меня тебя его она они мой моя мои твой есть было будет когда где куда зачем почему надо нужно можно сегодня завтра вчера очень просто ещё еще".split(" "))
  const mt = toks(msgs).filter(w => !STOP.has(w)), ws = words(mt.filter(w => w.length >= 4).join(" "))
  // имя склоняется: «Оля» — «Оле», «Сергей» — «Сергеем»: сравниваем начало слова
  const nameHit = p => toks(p).some(n => { const st = n.length <= 4 ? n.slice(0, -1) : n.slice(0, -2); return st.length >= 2 && mt.some(w => w.startsWith(st) && w.length <= n.length + 3) })
  const score = f => { const fw = toks(f.text); let s = ws.reduce((k, w) => k + (fw.some(x => x.startsWith(w)) ? 1 : 0), 0)
    if (f.person && nameHit(f.person)) s += 3; return s }
  const matched = all.map(f => ({ f, s: score(f) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 40).map(x => x.f)
  let take
  if (all.length <= 60) take = all.filter(f => !f.secret || matched.includes(f))
  else {
    const core = all.filter(f => !f.secret && (f.sphere === "me" || f.sphere === "values" || !f.sphere)).slice(-25)
    const recent = all.filter(f => !f.secret).slice(-10)
    take = [...new Set([...core, ...matched, ...recent])].sort((a, b) => a.date - b.date)
  }
  const names = []
  for (const f of matched) { const n = f.secret ? "сокровенное" : f.person || sphName(f.sphere || "me"); if (!names.includes(n)) names.push(n) }
  lastPick = names.slice(0, 5)
  return { take, all }
}
memoryBlock = function () {
  const { take, all } = pickMemory(), c = memChats().slice(-15)
  const d = t => { const x = new Date(t); return `${x.getDate()} ${MON_GEN[x.getMonth()].slice(0, 3)}` }
  const ppl = [...people(all.filter(f => !f.secret)).keys()]
  const sec = secretCount(), lockedN = lockedCount()
  const line = f => `- ${f.secret ? "🔒 " : ""}${f.person ? f.person + ": " : ""}${f.text} [${f.id}${f.sphere ? " · " + sphName(f.sphere) : ""}]`
  D.memLast = { at: Date.now(), names: lastPick.slice(), n: take.length }
  return `
Твоя память о пользователе (по сферам; храни и пополняй: remember / forget; больше — recall):
${take.length ? take.map(line).join("\n") : "- пока пусто"}
${all.length > take.length ? `Это не всё: всего ${all.length} фактов. Сферы: ${SPH.map(s => s[1]).join(", ")}. Люди: ${ppl.slice(0, 40).join(", ") || "—"}. Нужна подробность о человеке или сфере — recall.\n` : ""}${sec && !secretOpen() ? `Сокровенное: ${sec} ${plural(sec, "запись", "записи", "записей")} закрыты Face ID (психология, конфликты, мнения о людях). Если без них не ответить — вызови open_secret, иначе отвечай без них.\n` : ""}${lockedN ? `Ещё ${lockedN} фактов зашифрованы и откроются на этом телефоне после Face ID.\n` : ""}Прошлые разговоры, кратко (подробности — search_chats):
${c.length ? c.map(m => `- ${d(m.date)}: ${m.text}`).join("\n") : "- пока нет"}
Правила памяти: пароли, коды, PIN, номера карт, счетов и паспортов не запоминай никогда, даже если просят, — скажи, что их лучше хранить в ${PW}. Психологию, ссоры и конфликты, мнения о конкретных людях, интимное и диагнозы запоминай с secret: true — они шифруются. Мнения о людях записывай как наблюдения пользователя, а не ярлыки.`
}

// ───────────── Инструменты ─────────────
const remTool = AGENT_TOOLS.find(t => t.name === "remember")
if (remTool) remTool.input_schema = { type: "object", required: ["text", "sphere"], properties: {
  text: { type: "string", description: "Факт коротко и самодостаточно" },
  sphere: { type: "string", enum: SPH_IDS, description: "me — о самом человеке (характер, предпочтения, привычки); goals; health; family; friends — друзья и знакомые, коллеги; work; money; values — ценности и правила жизни" },
  person: { type: "string", description: "Если факт о конкретном человеке — его имя, как называет пользователь (Оля, Мама, Михаил)" },
  secret: { type: "boolean", description: "true — сокровенное: психология, ссоры, мнения о людях, интимное, диагнозы. Шифруется, читается только после Face ID" } } }
AGENT_TOOLS.push(
  { name: "recall", description: "Достать из памяти факты по сфере, человеку или словам (когда в подборке памяти не хватает подробностей).",
    input_schema: { type: "object", properties: { sphere: { type: "string", enum: SPH_IDS }, person: { type: "string" }, query: { type: "string" } } } },
  { name: "open_secret", description: "Попросить пользователя открыть сокровенное по Face ID, чтобы прочитать закрытые записи (психология, конфликты, мнения о людях). Только если без них не дать хороший ответ.",
    input_schema: { type: "object", properties: { reason: { type: "string", description: "Коротко, зачем: «чтобы ответить про Сергея»" }, person: { type: "string" }, query: { type: "string" } }, required: ["reason"] } })
Object.assign(TOOL_STATUS, { recall: "вспоминаю", open_secret: "жду Face ID" })

function filterFacts(x) {
  const ws = words(x.query || ""), p = String(x.person || "").toLowerCase()
  return allFacts().filter(f => (!x.sphere || f.sphere === x.sphere) && (!p || String(f.person || "").toLowerCase().includes(p) || f.text.toLowerCase().includes(p))
    && (!ws.length || ws.some(w => (f.text + " " + (f.person || "")).toLowerCase().replace(/ё/g, "е").includes(w))))
}
const _runTool = runTool
runTool = async function (name, x) {
  x = x || {}
  if (name === "remember") {
    const t = String(x.text || "").trim()
    if (!t) return { error: "пустой факт" }
    const why = sensitive(t)
    if (why) { journal("mem", `Отказался запомнить ${why}`); return { error: `Это похоже на ${why}. Такое не запоминаю даже в зашифрованном виде — посоветуй сохранить в ${PW} (там под защитой блокировки экрана).` } }
    const dup = allFacts().find(f => f.text.toLowerCase() === t.toLowerCase())
    if (dup) return { ok: true, id: dup.id, note: "уже помню" }
    const sphere = SPH_IDS.includes(x.sphere) ? x.sphere : "me", person = String(x.person || "").trim().slice(0, 60) || undefined
    let rec
    if (x.secret && vaultOn()) {
      rec = { id: uid("k"), date: Date.now(), kind: "fact", secret: 1, sealed: await seal({ text: t.slice(0, 500), sphere, person }) }
      if (V.priv) V.cache.set(rec.id, { text: t.slice(0, 500), sphere, person })
    } else rec = { id: uid("k"), date: Date.now(), kind: "fact", text: t.slice(0, 500), sphere, person }
    upsert("memory", rec)
    return { ok: true, id: rec.id, stored: x.secret ? (vaultOn() ? "сокровенное, зашифровано" : "сейф не включён — записано как обычный факт; предложи включить сейф в «Память»") : sphName(sphere) }
  }
  if (name === "recall") { const f = filterFacts(x); return { facts: f.slice(-60).map(z => ({ id: z.id, text: z.text, sphere: sphName(z.sphere), person: z.person, secret: !!z.secret })), locked_secret: secretOpen() ? 0 : secretCount() } }
  if (name === "open_secret") {
    if (!vaultOn()) return { error: "сейф не включён — сокровенного нет" }
    if (!secretOpen()) { const ok = await askUnlock(x.reason || ""); if (!ok) return { declined: true, note: "пользователь не стал открывать — ответь без сокровенного" } }
    const f = filterFacts(Object.assign({}, x, { sphere: undefined })).filter(z => z.secret)
    lastPick = [...new Set([...lastPick, "сокровенное"])]
    return { facts: (f.length ? f : allFacts().filter(z => z.secret)).slice(-60).map(z => ({ id: z.id, text: z.text, person: z.person, sphere: sphName(z.sphere) })) }
  }
  // Журнал: что изменилось в приложении — можно отменить
  const logIt = !READ_ONLY.test(name)
  const prev = TXN; TXN = []
  let out
  try { out = await _runTool(name, x) } finally {
    const changes = TXN; TXN = prev
    if (logIt && out && !out.error && !(name === "forget" && !changes.length)) {
      const text = (PAST[name] ? PAST[name](x) : "Сделал: " + (TOOL_STATUS[name] || name))
      journal(catOf(name), text, changes.length ? { undo: changes, tool: name } : { tool: name })
    }
  }
  return out
}
// «Запомнил» из remember тоже в журнал: TXN там свой
const _rt2 = runTool
runTool = async function (name, x) {
  if (name !== "remember") return _rt2(name, x)
  const prev = TXN; TXN = []
  let out
  try { out = await _rt2(name, x) } finally { const ch = TXN; TXN = prev; if (out && out.ok && !out.note) journal("mem", x.secret && vaultOn() ? `Запомнил сокровенное${x.person ? " о человеке" : ""} (зашифровано)` : PAST.remember(x), { undo: ch, tool: name }) }
  return out
}

// ───────────── Разложить старые факты по сферам (в фоне, дёшево) ─────────────
const CLS = { type: "object", additionalProperties: false, required: ["items"], properties: { items: { type: "array", items: { type: "object", additionalProperties: false,
  required: ["id", "sphere", "person", "secret"], properties: { id: { type: "string" }, sphere: { type: "string", enum: SPH_IDS }, person: { type: "string" }, secret: { type: "boolean" } } } } } }
let clsBusy = false
async function classify() {
  if (clsBusy || !aiKey() || Date.now() - (D.memClsAt || 0) < 600000) return
  const todo = live(D.memory).filter(x => x.kind === "fact" && typeof x.text === "string" && !x.sphere).slice(0, 80)
  if (!todo.length) return
  clsBusy = true; D.memClsAt = Date.now()
  try {
    const res = await claude({ max_tokens: 4000, output_config: { format: { type: "json_schema", schema: CLS } },
      system: "Разложи факты личного помощника по сферам жизни. sphere: me — о самом человеке; goals; health; family; friends — друзья, знакомые, коллеги; work; money; values. " +
        "person — имя человека, о котором факт (как в тексте), иначе пустая строка. secret — true только для психологии, ссор и конфликтов, мнений о конкретных людях, интимного, диагнозов.",
      messages: [{ role: "user", content: todo.map(f => `${f.id}: ${f.text}`).join("\n") }] }, 60000, { model: "claude-haiku-5-5" })
    const txt = res && res.content && (res.content.find(c => c.type === "text") || {}).text
    const j = JSON.parse(txt || "{}")
    for (const it of j.items || []) {
      const f = live(D.memory).find(x => x.id === it.id && typeof x.text === "string"); if (!f) continue
      const sphere = SPH_IDS.includes(it.sphere) ? it.sphere : "me", person = (it.person || "").trim() || undefined
      if (it.secret && vaultOn()) _upsert("memory", { id: f.id, date: f.date, kind: "fact", secret: 1, sealed: await seal({ text: f.text, sphere, person }) })
      else _upsert("memory", Object.assign({}, f, { sphere, person }))
    }
  } catch (e) {} finally { clsBusy = false }
}

// ───────────── Экраны ─────────────
const PI = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14a5 5 0 0 1 5.5 5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>', briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5h6v2M3 12h18"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/>', plant: '<path d="M12 21v-9M12 12C12 7 8 5 4 5c0 4 3 7 8 7zM12 14c0-4 3-6 8-6 0 4-3 6-8 6z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  face: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 16a4 4 0 0 0 5 0"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>', key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>', ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>', chev: '<path d="M9 6l6 6-6 6"/>' }
const ic = (n, c = "currentColor", s = 20) => `<svg class="mm-i" viewBox="0 0 24 24" width="${s}" height="${s}" style="color:${c}"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PI[n] || ""}</g></svg>`
const chev = `<span class="mm-chev">${ic("chev", "var(--sub)", 16)}</span>`
const row = (attrs, icon, t, s, right = chev) => `<button class="mm-row" ${attrs}>${icon}<span class="grow"><span class="t">${t}</span>${s ? `<span class="s">${s}</span>` : ""}</span>${right}</button>`
const tile = (n, c) => `<span class="mm-tile" style="background:${c}">${ic(n, "#fff", 18)}</span>`
const dshort = t => { const x = new Date(t); return `${x.getDate()} ${MON_GEN[x.getMonth()].slice(0, 3)}` }
const prev = (fs, n = 3) => esc(fs.slice(-n).reverse().map(f => f.text.length > 60 ? f.text.slice(0, 58) + "…" : f.text).join(" · "))

let knowS = null
window.memRefresh = () => { if (knowS && stack.includes(knowS)) { const sc = knowS.el.scrollTop; knowS.el.querySelector(".mm-body").innerHTML = knowHTML(); knowS.el.scrollTop = sc } }
function knowHTML() {
  const all = allFacts(), open = all.filter(f => !f.secret), ppl = people(open), sec = secretCount(), lockedN = lockedCount(), m = meta()
  const banner = !m ? `<button class="mm-hero off" data-a="setup">${tile("shield", "rgba(255,255,255,.22)")}<span class="grow"><b>Включить сейф памяти</b><span>Всё, что Изи знает о вас, уйдёт в таблицу шифром. 2 минуты.</span></span></button>`
    : !V.dk ? `<button class="mm-hero warn" data-a="unlock">${tile("lock", "rgba(255,255,255,.22)")}<span class="grow"><b>Память зашифрована</b><span>На этом устройстве её ещё нет: откройте сейф по Face ID или кодом.</span></span></button>`
    : `<div class="mm-hero">${tile("shield", "rgba(255,255,255,.22)")}<span class="grow"><b>Память зашифрована</b><span>${esc(iziName())} читает всё на этом телефоне. В Google Таблице — только шифр.</span></span></div>`
  const sph = SPH.map(([id, nm, col, icn]) => { const fs = open.filter(f => (f.sphere || "me") === id); return fs.length ? row(`data-sph="${id}"`, tile(icn, col), `${esc(nm)} <span class="mm-n">${fs.length}</span>`, prev(fs)) : "" }).join("")
  const secRow = m ? row(`data-a="secret"`, tile("lock", "#8A5A00"), `Сокровенное <span class="mm-lock">${ic("lock", "#8A5A00", 11)} ${secretOpen() ? "открыто" : "Face ID"}</span>`,
    secretOpen() ? `${sec} ${plural(sec, "запись", "записи", "записей")} · закроется ${V.until ? "в " + hm(new Date(V.until)) : "при выходе"}` : `${sec ? sec + " " + plural(sec, "запись", "записи", "записей") + " · " : ""}психология, конфликты, мнения о людях, дневник`) : ""
  const pplRows = [...ppl.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 30).map(([nm, fs]) =>
    row(`data-person="${esc(nm)}"`, `<span class="mm-ava">${esc(nm[0] || "?")}</span>`, `${esc(nm)}${live(D.memory).some(x => x.secret && V.cache.get(x.id) && V.cache.get(x.id).person === nm) ? "" : ""}`, prev(fs, 2))).join("")
  return `${banner}
${lockedN ? `<div class="mm-note">${ic("lock", "var(--sub)", 14)} ${lockedN} ${plural(lockedN, "факт", "факта", "фактов")} пока зашифрованы на этом устройстве</div>` : ""}
<div class="mm-card"><div class="mm-h">Сферы</div>${sph || `<div class="mm-empty">Пока пусто. ${esc(iziName())} запоминает важное из разговоров сам; можно сказать «запомни, что…».</div>`}${secRow}</div>
<div class="mm-card"><div class="mm-h"><span>Люди</span><button class="mm-link" data-a="add-person">+ Человек</button></div>${pplRows || `<div class="mm-empty">Когда вы расскажете о ком-то, здесь появится карточка.</div>`}</div>
<div class="mm-card"><div class="mm-h">Управление</div>
${row(`data-a="last"`, ic("eye", "var(--blue,#0A84FF)", 22), "Что ушло в последний разговор", `${esc(iziName())} показывает, какие карточки брал с собой`)}
${row(`data-a="journal"`, ic("list", "var(--blue,#0A84FF)", 22), `Журнал ${esc(iziName())}`, "что сделано без вас · можно отменить")}
${row(`data-a="security"`, ic("shield", "var(--blue,#0A84FF)", 22), "Сейф и безопасность", m ? "код восстановления, Face ID, когда закрывать" : "сейф выключен")}
${row(`data-a="export"`, ic("down", "var(--blue,#0A84FF)", 22), "Выгрузить всё", "один файл, расшифрованный, только вам")}
${row(`data-a="forget"`, ic("trash", "var(--red,#FF375F)", 22), `<span style="color:var(--red,#FF375F)">Забыть…</span>`, "факт, человека, сферу или всё")}</div>`
}
function openKnow() {
  const all = allFacts()
  knowS = sheet(`<div class="mm"><h3>Что ${esc(iziName())} знает</h3><div class="mm-sub">${all.length} ${plural(all.length, "факт", "факта", "фактов")} · ${people(all).size} ${plural(people(all).size, "человек", "человека", "людей")}</div><div class="mm-body">${knowHTML()}</div></div>`)
  knowS.el.addEventListener("click", async e => {
    const b = e.target.closest("[data-a],[data-sph],[data-person]"); if (!b) return
    if (b.dataset.sph) return openFacts(sphName(b.dataset.sph), f => !f.secret && (f.sphere || "me") === b.dataset.sph)
    if (b.dataset.person) return openPerson(b.dataset.person)
    const a = b.dataset.a
    if (a === "setup") return openSetup()
    if (a === "unlock" || a === "secret") { if (a === "secret" && secretOpen()) return openFacts("Сокровенное", f => f.secret, true); if (await askUnlock("")) { memRefresh(); if (a === "secret") openFacts("Сокровенное", f => f.secret, true) } return }
    if (a === "journal") return openJournal()
    if (a === "security") return openSecurity()
    if (a === "export") return exportAll()
    if (a === "last") { const l = D.memLast; return ui.info("Последний разговор", !l ? "Разговоров ещё не было." : `${dshort(l.at)} в ${hm(new Date(l.at))} ${iziName()} ${iziG("взял", "взяла")} с собой ${l.n} ${plural(l.n, "факт", "факта", "фактов")}${l.names.length ? ", по теме: " + l.names.join(", ") : ""}. Остальная память в разговор не уходила.`) }
    if (a === "add-person") {
      const nm = await ui.ask("Новый человек", "Как вы его называете?", "", { placeholder: "Оля, Мама, Михаил" }); if (!nm) return
      const t = await ui.ask(nm, "Что о нём запомнить?", "", { multiline: true, placeholder: "кто он вам, что для него важно, даты" }); if (!t) return
      await runTool("remember", { text: t, sphere: "friends", person: nm }); memRefresh(); return
    }
    if (a === "forget") return forgetMenu()
  })
  classify().then(() => memRefresh())
}
function factRows(fs) {
  return fs.slice().reverse().map(f => `<button class="mm-row" data-f="${esc(f.id)}"><span class="grow"><span class="t mm-wrap">${f.secret ? ic("lock", "#8A5A00", 13) + " " : ""}${esc(f.text)}</span><span class="s">${dshort(f.date)}${f.person ? " · " + esc(f.person) : ""}${f.sphere ? " · " + esc(sphName(f.sphere)) : ""}</span></span></button>`).join("")
}
function openFacts(title, pred, secret) {
  const draw = () => { const fs = allFacts().filter(pred); return `<h3>${esc(title)}</h3><div class="mm-sub">${fs.length} ${plural(fs.length, "факт", "факта", "фактов")}${secret ? " · зашифровано" : ""} · нажмите, чтобы забыть</div><div class="mm-card">${factRows(fs) || '<div class="mm-empty">Пусто</div>'}</div>` }
  const s = sheet(`<div class="mm">${draw()}</div>`)
  s.el.addEventListener("click", async e => {
    const b = e.target.closest("[data-f]"); if (!b) return
    const f = allFacts().find(x => x.id === b.dataset.f); if (!f) return
    if ((await ui.confirm("Забыть?", `<div class="msg">${esc(f.text)}</div>`, ["Отмена", "Забыть"])) === "Забыть") { remove("memory", f.id); V.cache.delete(f.id); journal("mem", `Забыл по вашей просьбе: «${f.text.slice(0, 60)}»`); s.el.querySelector(".mm").innerHTML = draw(); memRefresh() }
  })
}
function openPerson(nm) {
  const s = sheet(`<div class="mm"><h3>${esc(nm)}</h3><div class="mm-sub">карточка человека</div><div class="mm-card">${factRows(allFacts().filter(f => f.person === nm))}</div>
    ${secretCount() && !secretOpen() ? `<div class="mm-note">${ic("lock", "var(--sub)", 14)} Ваши сокровенные заметки о человеке откроются по Face ID</div>` : ""}
    <div class="btns"><button class="btn red" data-a="forget-person">Забыть всё о человеке</button></div></div>`)
  s.el.addEventListener("click", async e => {
    const b = e.target.closest("[data-f],[data-a]"); if (!b) return
    if (b.dataset.a === "forget-person") {
      if ((await ui.confirm(`Забыть ${nm}?`, `<div class="msg">Все факты о человеке удалятся отовсюду, в том числе из таблицы.</div>`, ["Отмена", "Забыть"])) !== "Забыть") return
      for (const f of allFacts().filter(f => f.person === nm)) { remove("memory", f.id); V.cache.delete(f.id) }
      journal("mem", `Забыл всё о человеке: ${nm}`); s.close(); memRefresh(); return
    }
    const f = allFacts().find(x => x.id === b.dataset.f); if (!f) return
    if ((await ui.confirm("Забыть?", `<div class="msg">${esc(f.text)}</div>`, ["Отмена", "Забыть"])) === "Забыть") { remove("memory", f.id); V.cache.delete(f.id); b.remove(); memRefresh() }
  })
}
async function forgetMenu() {
  const i = await ui.choose("Забыть", "", ["Сферу целиком", "Всё, что знаю о вас"])
  if (i === 0) {
    const j = await ui.choose("Какую сферу?", "", SPH.map(s => s[1])); if (j < 0) return
    const id = SPH[j][0], fs = allFacts().filter(f => !f.secret && (f.sphere || "me") === id)
    if ((await ui.confirm(`Забыть «${SPH[j][1]}»?`, `<div class="msg">${fs.length} ${plural(fs.length, "факт", "факта", "фактов")} удалятся отовсюду.</div>`, ["Отмена", "Забыть"])) !== "Забыть") return
    fs.forEach(f => remove("memory", f.id)); journal("mem", `Забыл сферу «${SPH[j][1]}»`); memRefresh()
  } else if (i === 1) {
    if ((await ui.confirm("Забыть всё?", `<div class="msg">Вся память ${esc(iziName())} о вас удалится с телефона и из таблицы, включая сокровенное. Это не отменить.</div>`, ["Отмена", "Забыть всё"])) !== "Забыть всё") return
    for (const x of live(D.memory)) if (x.kind === "fact") remove("memory", x.id)
    V.cache.clear(); journal("mem", "Забыл всё по вашей просьбе"); memRefresh()
  }
}

// Окно «Открыть сокровенное»: Face ID или код. true — открыто
function askUnlock(reason) {
  return new Promise(res => {
    let done = false
    const m = meta(), face = !!(m && m.pk)
    const s = sheet(`<div class="mm mm-center"><div class="mm-big">${ic("face", "#8A5A00", 40)}</div>
      <h3>${reason ? `${esc(iziName())} нужно сокровенное` : "Открыть сокровенное"}</h3>
      <div class="msg">${reason ? esc(reason[0].toUpperCase() + reason.slice(1)) + ". Эти записи зашифрованы." : "Психология, конфликты, мнения о людях и дневник зашифрованы."}</div>
      ${face ? `<button class="btn primary mm-wide" data-a="face">${ic("face", "#fff", 18)} Открыть по Face ID</button>` : ""}
      <div class="mm-seg">${[[5, "5 минут"], [15, "15 минут"], [0, "До выхода"]].map(([v, t]) => `<button data-ttl="${v}" class="${ttl() === v ? "on" : ""}">${t}</button>`).join("")}</div>
      <div class="field"><input id="mm-code" placeholder="или код восстановления" autocomplete="off" autocapitalize="characters" spellcheck="false"></div>
      <button class="btn mm-wide" data-a="code">Открыть кодом</button>
      ${reason ? `<button class="btn mm-wide mm-ghost" data-a="no">Ответить без этого</button>` : ""}
      <div class="mm-err"></div></div>`, { onClose: () => { if (!done) res(false) } })
    const err = t => { s.el.querySelector(".mm-err").textContent = t }
    s.el.addEventListener("click", async e => {
      const b = e.target.closest("[data-a],[data-ttl]"); if (!b) return
      if (b.dataset.ttl != null) { D.vaultTtl = +b.dataset.ttl; save(false); s.el.querySelectorAll("[data-ttl]").forEach(x => x.classList.toggle("on", x === b)); return }
      if (b.dataset.a === "no") return s.close()
      try {
        b.disabled = true; err("")
        if (b.dataset.a === "face") await unlockFace()
        else { const c = s.el.querySelector("#mm-code").value; if (normCode(c).length < 24) { b.disabled = false; return err("В коде 24 знака") } await unlockCode(c) }
        done = true; res(true); s.close(); toast("Сокровенное открыто")
      } catch (x) { b.disabled = false; err(x.name === "NotAllowedError" ? "Face ID отменён" : String(x.message || x)) }
    })
  })
}

// Окно «Сейф памяти»: как работает, код восстановления, включить
function openSetup() {
  if (vaultOn()) return openSecurity()
  const code = genCode()
  const s = sheet(`<div class="mm"><h3>Сейф памяти</h3><div class="mm-sub">один раз, 2 минуты</div>
    <div class="mm-card"><div class="mm-h">Как это работает</div>
      <div class="mm-row">${ic("phone", "var(--accent,#0A9F6E)", 22)}<span class="grow"><span class="t">Ключ живёт только в этом телефоне</span><span class="s">Его не видит ни Google, ни виджет, ни тот, кто откроет таблицу</span></span></div>
      <div class="mm-row">${ic("table", "var(--accent,#0A9F6E)", 22)}<span class="grow"><span class="t">В таблицу уходит шифр</span><span class="s">вместо «Оля любит пионы» — «d1:Qm9sYXI…»</span></span></div>
      <div class="mm-row">${ic("face", "var(--accent,#0A9F6E)", 22)}<span class="grow"><span class="t">Сокровенное — ещё и под Face ID</span><span class="s">обычная память открыта ${esc(iziName())} всегда, сокровенное — по вашему лицу. Ключ Face ID хранится в «Паролях» и есть на всех ваших устройствах Apple</span></span></div></div>
    <div class="mm-card mm-warn"><div class="mm-h">Код восстановления</div>
      <div class="msg">Если пропадут и телефон, и доступ к iCloud, память вернёт только этот код. Без него её не прочитать никому, даже вам.</div>
      <div class="mm-code">${code.slice(0, 14)}<br>${code.slice(15)}</div>
      <div class="mm-chips"><button class="btn small" data-a="copy">Скопировать</button><button class="btn small" data-a="share">Сохранить…</button></div>
      <div class="mm-sub" style="margin-top:8px">Лучше всего: «Пароли» → «+» → сайт «IZIDAY сейф», пароль — этот код.</div></div>
    <button class="btn primary mm-wide" data-a="go">Я сохранил код — включить</button><div class="mm-err"></div></div>`)
  s.el.addEventListener("click", async e => {
    const b = e.target.closest("[data-a]"); if (!b) return
    if (b.dataset.a === "copy") { try { await navigator.clipboard.writeText(code); toast("Код скопирован") } catch (x) { toast("Не получилось скопировать") } return }
    if (b.dataset.a === "share") { try { await navigator.share({ title: "Код восстановления IZIDAY", text: `Код восстановления сейфа IZIDAY: ${code}` }) } catch (x) {} return }
    if (b.dataset.a === "go") {
      b.disabled = true; b.textContent = "Включаю…"
      try {
        const note = await createVault(code)
        s.close(); sync(); memRefresh()
        ui.info("Сейф включён", `Память ${iziName()} теперь уходит в таблицу шифром.${note ? " " + note : " Сокровенное открывается по Face ID."}`)
      } catch (x) { b.disabled = false; b.textContent = "Я сохранил код — включить"; s.el.querySelector(".mm-err").textContent = String(x.message || x) }
    }
  })
}

function openSecurity() {
  const m = meta()
  if (!m) return openSetup()
  const routesOk = !routes().some(r => r.token)
  const s = sheet(`<div class="mm"><h3>Безопасность</h3><div class="mm-sub">сейф включён ${dshort(m.at)}</div>
    <div class="mm-card"><div class="mm-h">Ключи и доступы</div>
      <div class="mm-row">${ic("key", "var(--accent,#0A9F6E)", 22)}<span class="grow"><span class="t">Ключ рутины Claude Code</span><span class="s">${routesOk ? "хранится только в свойствах скрипта таблицы, в телефоне и файлах его нет" : "ещё лежит в приложении — подключите приложение заново"}</span></span>${routesOk ? '<b class="mm-ok">✓</b>' : ""}</div>
      <div class="mm-row">${ic("shield", "var(--accent,#0A9F6E)", 22)}<span class="grow"><span class="t">Память и журнал в таблице</span><span class="s">только шифр</span></span><b class="mm-ok">✓</b></div>
      <div class="mm-row">${ic("face", "var(--accent,#0A9F6E)", 22)}<span class="grow"><span class="t">Face ID для сокровенного</span><span class="s">${m.pk ? "включён · ключ в «Паролях», есть на ваших устройствах Apple" : "не настроен — открывается кодом"}</span></span>${m.pk ? '<b class="mm-ok">✓</b>' : secretOpen() ? '<button class="btn small" data-a="face">Подключить</button>' : ""}</div></div>
    <div class="mm-card"><div class="mm-h">Сейф</div>
      <div class="mm-row"><span class="grow"><span class="t">Сокровенное закрывается</span></span><div class="mm-seg mm-seg-s">${[[5, "5 мин"], [15, "15 мин"], [0, "При выходе"]].map(([v, t]) => `<button data-ttl="${v}" class="${ttl() === v ? "on" : ""}">${t}</button>`).join("")}</div></div>
      ${secretOpen() ? row(`data-a="lock"`, ic("lock", "#8A5A00", 22), "Закрыть сокровенное сейчас", "") : ""}
      ${row(`data-a="mac"`, ic("phone", "var(--blue,#0A84FF)", 22), "Открыть на Mac или новом телефоне", "по Face ID / Touch ID через iCloud или кодом восстановления")}</div>
    <div class="mm-card"><div class="mm-h">Советы</div>
      <div class="mm-row">${ic("shield", "var(--orange,#FF9F0A)", 22)}<span class="grow"><span class="t">Двухэтапная защита Google</span><span class="s">таблица — главное хранилище, включите вход с подтверждением</span></span></div>
      <div class="mm-row">${ic("shield", "var(--orange,#FF9F0A)", 22)}<span class="grow"><span class="t">${/Android/i.test(navigator.userAgent) ? "Блокировка экрана: PIN из 6 цифр или отпечаток" : "Код-пароль iPhone из 6 цифр и больше"}</span><span class="s">сейф защищён не сильнее, чем сам телефон</span></span></div></div></div>`)
  s.el.addEventListener("click", e => {
    const b = e.target.closest("[data-a],[data-ttl]"); if (!b) return
    if (b.dataset.ttl != null) { D.vaultTtl = +b.dataset.ttl; save(false); if (secretOpen()) arm(); s.el.querySelectorAll("[data-ttl]").forEach(x => x.classList.toggle("on", x === b)); return }
    if (b.dataset.a === "lock") { lock(); s.close(); toast("Сокровенное закрыто") }
    if (b.dataset.a === "face") addFace().then(() => { s.close(); toast("Face ID подключён") }).catch(x => toast(String(x.message || x)))
    if (b.dataset.a === "mac") ui.info("Другое устройство", "Откройте IZIDAY в Safari на Mac или новом iPhone с тем же Apple ID и подключите приложение кодом из виджета. Сейф откроется по Face ID или Touch ID: ключ приходит через «Пароли» iCloud. Без iCloud — кодом восстановления.")
  })
}

function openJournal(filter = "all") {
  const CATS = [["all", "Все"], ["money", "Деньги"], ["cal", "Календарь"], ["mem", "Память"]]
  const ICN = { money: ["wallet", "#30B0C7"], cal: ["clock", "var(--accent,#0A9F6E)"], mem: ["sparkle", "#AF52DE"], vault: ["lock", "#8A5A00"], health: ["heart", "#FF453A"], other: ["send", "var(--blue,#0A84FF)"] }
  const draw = () => {
    const xs = live(D.log).filter(j => typeof j.text === "string" && (filter === "all" || j.cat === filter || (filter === "mem" && j.cat === "vault"))).sort((a, b) => b.date - a.date).slice(0, 200)
    let last = "", html = ""
    for (const j of xs) {
      const d = new Date(j.date), day = dayKey(d) === dayKey(new Date()) ? "Сегодня" : dayKey(d) === dayKey(addDays(new Date(), -1)) ? "Вчера" : `${d.getDate()} ${MON_GEN[d.getMonth()]}`
      if (day !== last) { html += `${last ? "</div>" : ""}<div class="mm-tag">${day}</div><div class="mm-card">`; last = day }
      const [n, c] = ICN[j.cat] || ICN.other
      const right = j.undone ? `<span class="mm-s">отменено</span>` : j.undo && j.undo.length ? `<button class="btn small" data-undo="${esc(j.id)}">${ic("undo", "currentColor", 14)} Отменить</button>` : ""
      html += `<div class="mm-row">${ic(n, c, 20)}<span class="grow"><span class="t mm-wrap${j.undone ? " mm-struck" : ""}">${esc(j.text)}</span><span class="s">${hm(d)}</span></span>${right}</div>`
    }
    return `<h3>Журнал ${esc(iziName())}</h3><div class="mm-sub">что ${esc(iziName())} ${iziG("сделал", "сделала")} сам · 90 дней</div>
      <div class="mm-seg">${CATS.map(([k, t]) => `<button data-cat="${k}" class="${filter === k ? "on" : ""}">${t}</button>`).join("")}</div>
      ${html ? html + "</div>" : '<div class="mm-card"><div class="mm-empty">Пока пусто</div></div>'}
      <div class="mm-sub mm-c">Журнал лежит в приложении и копией в таблице (лист «Журнал», шифр). Старше 90 дней удаляется сам.</div>`
  }
  const s = sheet(`<div class="mm">${draw()}</div>`)
  s.el.addEventListener("click", async e => {
    const b = e.target.closest("[data-cat],[data-undo]"); if (!b) return
    if (b.dataset.cat) { filter = b.dataset.cat; s.el.querySelector(".mm").innerHTML = draw(); return }
    if (await undo(b.dataset.undo)) { toast("Отменено"); s.el.querySelector(".mm").innerHTML = draw(); if (!stack.length || tab !== "chat") render() }
  })
}

function exportAll() {
  const facts = allFacts().map(f => ({ date: iso(new Date(f.date)), sphere: sphName(f.sphere), person: f.person || "", secret: !!f.secret, text: f.text }))
  const data = { exported: new Date().toISOString(), facts, conversations: memChats().map(c => ({ date: iso(new Date(c.date)), summary: c.text })),
    journal: live(D.log).filter(j => j.text).map(j => ({ date: iso(new Date(j.date)), text: j.text })),
    note: secretCount() && !secretOpen() ? "Сокровенное не выгружено: сейф был закрыт" : "" }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const file = new File([blob], `iziday-pamyat-${dayKey(new Date())}.json`, { type: "application/json" })
  if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: "Память IZIDAY" }).catch(() => {})
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

// «Взял с собой» под ответом
window.memUsed = () => lastPick.slice()
window.memLine = m => m && m.role === "assistant" && m.mem && m.mem.length ? `<div class="mm-took">${ic("eye", "var(--sub)", 12)} ${iziG("взял", "взяла")} с собой: ${m.mem.map(esc).join(", ")}</div>` : ""

// Ключи рутин больше не держим в телефоне: задачу отправляет таблица со своим ключом
if (D.conn && Array.isArray(D.conn.routes) && D.conn.routes.some(r => r && r.token)) { D.conn.routes = D.conn.routes.map(({ token, ...r }) => r); save(false) }

DO.memory = openKnow
DO.journal = openJournal
DO.security = openSecurity

window.vault = { isOpen: secretOpen, isOn: vaultOn,
  open: async () => vaultOn() ? (secretOpen() || await askUnlock("")) : (openSetup(), false),
  seal, unseal, lock, setup: openSetup }
window.memAll = allFacts

// Запуск: ключ с телефона, раскрыть пришедшее, разложить старые факты
;(async () => { try { await loadDeviceKey() } catch (e) {} setTimeout(() => classify(), 8000) })()
})()
