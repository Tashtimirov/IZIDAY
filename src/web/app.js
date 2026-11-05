// «Мой день» — веб-приложение для iPhone. Открывается с экрана «Домой» мгновенно и работает без Scriptable.
// Деньги, еда, вода и тренировки хранятся на телефоне и через Google Таблицу совпадают с виджетом.
// Календарь — Google Календарь через таблицу; напоминания живут в приложении (уведомления по ним ставит виджет).
// Данные часов и место видит только iPhone: их присылает виджет (снимок).
// Разбор фраз, деньги и отчёты — общее ядро с виджетом (core.js, собирается build_web.py).
"use strict"

const core = window.CORE
const STORE = "myday.web"

// ───────────── Мелочи ─────────────
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
const z2 = n => String(n).padStart(2, "0")
const hm = d => `${z2(d.getHours())}:${z2(d.getMinutes())}`
const dayKey = d => `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`
const iso = d => `${dayKey(d)}T${hm(d)}`
const sod = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const sameDay = (a, b) => dayKey(new Date(a)) === dayKey(new Date(b))
const num = n => Math.round(n || 0).toLocaleString("ru-RU").replace(/ /g, " ")
const liters = ml => (Math.round((ml || 0) / 10) / 100).toString().replace(".", ",")
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"]
const DAY_NAMES = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"]
const MON_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
const fullDate = d => `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MON_GEN[d.getMonth()]}`
const shortDate = d => `${WD[d.getDay()]}, ${d.getDate()} ${MON_GEN[d.getMonth()]}`
function dayName(d) {
  const diff = Math.round((sod(d) - sod(new Date())) / 864e5)
  return diff === 0 ? "сегодня" : diff === 1 ? "завтра" : diff === -1 ? "вчера" : shortDate(d)
}
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10
  return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many
}
// «2026-11-03T15:00» или «2026-11-03» — местное время
function parseIso(s) {
  const m = String(s || "").match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/)
  return m ? new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0) : null
}
function ago(t) {
  if (!t) return "никогда"
  const m = Math.round((Date.now() - t) / 60000)
  return m < 1 ? "только что" : m < 60 ? `${m} мин назад` : sameDay(t, Date.now()) ? `в ${hm(new Date(t))}` : `${dayName(new Date(t))}, ${hm(new Date(t))}`
}

function toast(t) {
  const el = $("#toast")
  el.innerHTML = deEmo(esc(t))
  el.classList.add("show")
  clearTimeout(toast.t)
  toast.t = setTimeout(() => el.classList.remove("show"), 2400)
}

const ICO = {
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8.5 15l2 2 4-4"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M8.5 8.5h7M8.5 11.5h4.5"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="13" rx="3"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/></svg>',
  health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/><path d="M7 12h3l1.3-2.5L13 14l1.2-2H17"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  gallery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" fill="#fff"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>',
  add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  find: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
  plans: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="M3.5 6.5l1.5 1.5 2.5-3M3.5 12l1.5 1.5 2.5-3"/><circle cx="5.3" cy="17.5" r="1.3"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/><path d="M3 4h2.3l2.2 11h10.3l2-7.5H6.2"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>',
  summit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 20l7-11.5 4 6.5 2.5-3.8L21.5 20z"/><path d="M9.5 8.5V3.5l3.5 1.6-3.5 1.6"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 2M9.5 2.5h5M19 6.5l-1.5 1.5"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2.5l3 3-3 3"/><path d="M4 11.5V10a4.5 4.5 0 0 1 4.5-4.5H20"/><path d="M7 21.5l-3-3 3-3"/><path d="M20 12.5V14a4.5 4.5 0 0 1-4.5 4.5H4"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19.5C5 11 10 5.5 19.5 4.5 18.8 13.5 13.5 19 5 19.5z"/><path d="M5 19.5l7.5-7.5"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l1.6-4.3A2.2 2.2 0 0 1 8.7 6.2h6.6a2.2 2.2 0 0 1 2.1 1.5L19 12"/><rect x="3.5" y="12" width="17" height="5.5" rx="2"/><path d="M6.5 17.5v2M17.5 17.5v2M7 14.8h1M16 14.8h1"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M9.5 20.5v-6h5v6"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
  shirt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 3.5L3.5 6.5l2 4 2-1v11h9v-11l2 1 2-4-5-3c-.6 1.5-1.9 2.5-3.5 2.5S9.1 5 8.5 3.5z"/></svg>',
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5s6 6.3 6 10.5a6 6 0 0 1-12 0c0-4.2 6-10.5 6-10.5z"/></svg>',
  pill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7z"/><path d="M7 10l7 7"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5"/><path d="M12 8C10.5 4 7 3.5 7 6s5 2 5 2zM12 8c1.5-4 5-4.5 5-2s-5 2-5 2z"/></svg>',
  plane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4L3 11l7 2.5L12.5 21z"/><path d="M10 13.5L21 4"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5.5A2 2 0 0 1 6 3.5h14v13H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-6.5 5 13 2.5-6.5h4"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>',
  apple: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7.5C10.8 5.6 8.3 5 6.4 6.2 3.9 7.8 4.2 12.3 5.7 15.6 7.2 19 9.2 20.8 12 19.5c2.8 1.3 4.8-.5 6.3-3.9 1.5-3.3 1.8-7.8-.7-9.4C15.7 5 13.2 5.6 12 7.5z"/><path d="M12 7.5c0-2 .9-3.4 2.8-4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4.2-1L19 8.2a2.1 2.1 0 0 0-3-3L5.2 16z"/><path d="M14.5 6.5l3 3"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  paw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="10" r="1.8"/><circle cx="9.5" cy="5.8" r="1.8"/><circle cx="14.5" cy="5.8" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M12 12c-2.8 0-5 3.2-5 5.5 0 1.7 1.3 2.5 2.7 2.5 1 0 1.5-.5 2.3-.5s1.3.5 2.3.5c1.4 0 2.7-.8 2.7-2.5 0-2.3-2.2-5.5-5-5.5z"/></svg>',
  tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6.5a4 4 0 0 0 5.2 5.2L13 18.5a2.1 2.1 0 0 1-3-3L16.8 8.7"/><path d="M14.5 6.5L17 4a4 4 0 0 1 3 3l-2.5 2.5"/><path d="M10 15.5L4.5 21"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5l6.5 6.5-6.5 6.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9"/><path d="M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2"/></svg>',
}

// Ещё иконки — вместо смайликов в заголовках, кнопках и всплывающих подсказках
Object.assign(ICO, {
  brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2 3.2 3.2 0 0 0 2.3 5.3A2.8 2.8 0 0 0 12 19.5V6.3a2.6 2.6 0 0 0-2.5-1.8z"/><path d="M14.5 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3.2 3.2 0 0 1-2.3 5.3A2.8 2.8 0 0 1 12 19.5V6.3a2.6 2.6 0 0 1 2.5-1.8z"/><path d="M8.5 10.5c1 0 2 .6 2.5 1.5M15.5 10.5c-1 0-2 .6-2.5 1.5"/></svg>',
  eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 20.5h12"/><path d="M4.6 14.6l9.9-9.9a2 2 0 0 1 2.8 0l2.5 2.5a2 2 0 0 1 0 2.8L11 18.8a2 2 0 0 1-1.4.6H8.4a2 2 0 0 1-1.4-.6z"/><path d="M9.5 9.7l5.3 5.3"/></svg>',
  micl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  fork: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v5a2.5 2.5 0 0 0 5 0V3M7.5 3v18"/><path d="M18 21V3c-2.2 1.3-3.5 4-3.5 7.5V14H18"/></svg>',
  keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h0M10 10h0M14 10h0M17.5 10h0M7.5 14h9"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 12.3A1.8 1.8 0 0 0 8.8 21h6.4a1.8 1.8 0 0 0 1.8-1.7L18 7M10 11v6M14 11v6"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 4.5L2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h0"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20.5h16M7 16.5v-5M12 16.5V6.5M17 16.5v-8"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19M6.5 14.5h3"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.5a6.5 6.5 0 0 0 6.5-6.5c0-4.2-3.2-6.8-4.3-10.5C12 6 11 8.5 11 10.6 9.9 10 9 8.8 8.7 7.5 7 9.4 5.5 12 5.5 15a6.5 6.5 0 0 0 6.5 6.5z"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M8 9.5a5.5 5.5 0 0 1 8 0M12 10l1.4-2"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z"/></svg>',
  kid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7.5" r="3.5"/><path d="M5.5 20.5a6.5 6.5 0 0 1 13 0"/></svg>',
  sunset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17.5h18M7 17.5a5 5 0 0 1 10 0M12 4v4M5.3 9.8l1.6 1.6M18.7 9.8l-1.6 1.6M8 21h8"/></svg>',
})
// Смайлик → иконка. Тексты по-прежнему пишутся со смайликом (так проще и их понимает виджет), а на экран идёт иконка
const EMO = { "☀": "sun", "🌙": "moon", "🧠": "brain", "🧹": "eraser", "🎤": "micl", "🔗": "link", "🍽": "fork", "📷": "cam", "🖼": "gallery", "⌨": "keyboard",
  "✏": "pen", "✎": "pen", "📄": "doc", "🎬": "video", "🛒": "cart", "🗓": "today", "📅": "today", "🔁": "repeat", "🔄": "sync", "📍": "pin", "↔": "move", "🗑": "trash",
  "💬": "chat", "➖": "minus", "➕": "plus", "💧": "drop", "🏃": "activity", "👧": "kid", "🎯": "target", "✨": "sparkle", "🌠": "star", "📋": "list", "⏱": "timer",
  "🍅": "timer", "⏰": "bell", "🔔": "bell", "⚠": "warn", "📲": "phone", "📱": "phone", "📊": "chart", "💵": "money", "💳": "card", "🔥": "flame", "⚖": "scale",
  "💡": "bulb", "✅": "check", "✓": "check", "🌆": "sunset", "⏳": "timer" }
const EMO_SRC = "(" + Object.keys(EMO).join("|") + ")\uFE0F? ?"
const EMO_RE = new RegExp(EMO_SRC, "gu"), EMO_RE1 = new RegExp("^" + EMO_SRC, "u")
const ei = k => `<i class="ei ei-${k}">${ICO[k] || ""}</i>`
const deEmo = s => String(s).replace(EMO_RE, (m, e) => ei(EMO[e]))   // только для готового (экранированного) текста, не для атрибутов
const deEmo1 = s => String(s).replace(EMO_RE1, (m, e) => ei(EMO[e]))   // только смайлик в начале — для сообщений чата

// ───────────── Данные на телефоне ─────────────
// Записи — как в виджете: { id, date, u (время изменения), ... }; удалённые остаются «надгробиями» { id, deleted, u },
// чтобы удаление дошло до виджета и таблицы
const LISTS = { money: 0, food: 120, water: 60, workouts: 400, places: 0, memory: 0, locs: 60, nudges: 3, rems: 0, skips: 60, budgets: 0, recur: 0, habits: 0, hlog: 400, weight: 0, shop: 0, kids: 0, fast: 90, goals: 0, pomo: 30 }   // pomo — помидоры (фокус 25 мин), живут в приложении; goals — цели, желания, мечты; shop — покупки, kids — дела детей, fast — голодание   // rems — напоминания живут в приложении, не в iPhone   // places — «напомни, когда буду рядом» (проверяет виджет)
let D = {}
function load() {
  try { D = JSON.parse(localStorage.getItem(STORE) || "{}") || {} } catch (e) { D = {} }
  for (const k of [...Object.keys(LISTS), "chat", "ops", "chatArchive"]) if (!Array.isArray(D[k])) D[k] = []
  D.conn = D.conn || null
  if (!D.cc || typeof D.cc !== "object" || Array.isArray(D.cc)) D.cc = {}
  D.sync = Object.assign({ since: 0, pushedAt: 0, snapAt: 0, at: 0, error: "" }, D.sync || {})
  applyCfg()
}
let saveT = null
function save(push = true) {
  try { localStorage.setItem(STORE, JSON.stringify(D)) } catch (e) { toast("Не удалось сохранить на телефоне: " + e.message) }
  if (push) { clearTimeout(saveT); saveT = setTimeout(() => sync(), 900) }
}
// Личные настройки виджета (категории, календари, цели) приходят с кодом подключения
function applyCfg() {
  const cfg = D.conn && D.conn.cfg
  if (!cfg) return
  const c = core.CONFIG
  for (const k of ["currency", "currencyIn", "currencyWords", "agentModel", "defaultEventMinutes", "defaultReminderHour", "briefs", "categories"]) if (cfg[k] != null) c[k] = cfg[k]
  if (cfg.health) c.health = Object.assign({}, c.health, cfg.health)
  if (Array.isArray(cfg.calendars)) c.calendars = cfg.calendars
}
const H = () => Object.assign({ waterGoal: 2000, glass: 250, moveGoal: 500, exerciseGoal: 30, weight: 80, kcalGoal: 2000, proteinGoal: 0 }, core.CONFIG.health || {})
// Имя и пол помощника — меняются в настройках и показываются как введены; по умолчанию «Изи» (у владельца с маршрутами в Claude Code — «ИЗИ»), мужской род
const IZI = () => { const z = D.izi || {}; return { name: String(z.name || "").trim() || (routes().length ? "ИЗИ" : "Изи"), g: z.g === "f" ? "f" : "m" } }
const iziName = () => IZI().name
const iziG = (m, f) => IZI().g === "f" ? f : m
// Цвет Изи — выбирают в настройках (особенно дети): форма шара и волн та же, меняется только цвет. [id, название, фон, волна 1, волна 2]
const IZI_COL = [
  ["em", "Изумруд", ["#0b8f5c", "#18b98a", "#1f8fff"], "140,205,255", "150,255,220"],
  ["space", "Космос", ["#3b22c4", "#7b5cff", "#2fb7ff"], "170,190,255", "200,175,255"],
  ["sunset", "Закат", ["#e2365f", "#ff7a59", "#ffb547"], "255,200,170", "255,236,170"],
  ["lagoon", "Лагуна", ["#06708f", "#16b3c4", "#5fe0b0"], "150,235,255", "190,255,230"],
  ["neon", "Неон", ["#3a1f8f", "#b73cff", "#ff5fc8"], "255,170,240", "170,220,255"],
  ["night", "Ночь", ["#0d1433", "#24306e", "#4257d6"], "140,205,255", "150,255,220"],
]
const iziCol = () => IZI_COL.find(p => p[0] === (D.izi && D.izi.c)) || IZI_COL[0]
let iziPainted = ""
function iziPaint() {
  const p = iziCol(); if (iziPainted === p[0]) return; iziPainted = p[0]
  const st = document.documentElement.style; p[2].forEach((c, i) => st.setProperty("--izi" + (i + 1), c))
  const l = document.querySelector('link[rel="apple-touch-icon"]'); if (l) l.href = p[0] === "em" ? "icon-180.png?v=5" : `icon-${p[0]}-180.png?v=2`   // значок берётся при добавлении на экран «Домой»
}
const proteinGoal = () => H().proteinGoal || Math.round((H().weight || 80) * 1.6)   // по умолчанию 1,6 г на кг веса
const live = list => list.filter(x => x && !x.deleted)
function upsert(key, rec) {
  rec.u = Date.now()
  const i = D[key].findIndex(x => x.id === rec.id)
  if (i >= 0) D[key][i] = rec; else D[key].push(rec)
  save()
  return rec
}
function remove(key, id) { upsert(key, { id, deleted: true }) }
// Слияние как в виджете (mergeSynced): по id побеждает более позднее изменение
function mergeIn(key, incoming) {
  const map = new Map(D[key].map(x => [x.id, x]))
  for (const x of incoming || []) {
    if (!x || !x.id) continue
    const cur = map.get(x.id)
    if (!cur || (x.u || 0) > (cur.u || 0)) { const y = Object.assign({}, x); delete y.s; map.set(x.id, y) }
  }
  const days = LISTS[key], keepTomb = Date.now() - 90 * 864e5
  D[key] = [...map.values()].filter(x => x.deleted ? (x.u || 0) > keepTomb : !days || (x.date || 0) > Date.now() - days * 864e5)
}

// ───────────── Обмен с таблицей (и через неё с виджетом) ─────────────
let syncing = null
// На iPhone Safari рвёт запрос («Load failed»), если приложение свернули или сменилась сеть — один повтор
async function hubPost(h, timeout = 30000) {
  try { return await hubPostOnce(h, timeout) } catch (e) {
    if (e.name !== "TypeError") throw e
    await sleep(1200)
    try { return await hubPostOnce(h, timeout) } catch (e2) {
      if (e2.name === "TypeError") throw new Error(`нет связи с таблицей (${e2.message})`)
      throw e2
    }
  }
}
async function hubPostOnce(h, timeout) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeout)
  try {
    const r = await fetch(D.conn.hook, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, signal: ctl.signal, credentials: "omit", cache: "no-store",
      body: JSON.stringify({ secret: D.conn.secret, hub: Object.assign({ from: "app" }, h) }) })
    const text = await r.text()
    let j
    try { j = JSON.parse(text) } catch (e) { throw new Error(r.ok ? "таблица ответила не данными — разверните скрипт заново с доступом «Все»" : `таблица ответила ошибкой ${r.status}`) }
    if (!j.ok) throw new Error(j.error === "forbidden" ? "таблица не приняла ключ — подключите приложение заново" : j.error || "ошибка таблицы")
    return j
  } finally { clearTimeout(t) }
}
function sync() {
  if (!D.conn || !D.conn.hook) return Promise.resolve(false)
  if (syncing) { syncing.again = true; return syncing.p }
  const state = { again: false }
  state.p = (async () => {
    $("#sync").classList.add("spin")
    try {
      do {
        state.again = false
        const started = Date.now(), lists = {}
        for (const k of Object.keys(LISTS)) lists[k] = D[k].filter(x => (x.u || 0) > D.sync.pushedAt - 60000)
        const ops = D.ops.filter(o => o.state === "local").map(o => ({ id: o.id, tool: o.tool, input: o.input }))
        const res = await hubPost({ since: D.sync.since, snapAt: D.sync.snapAt, lists, ops }, 60000)
        for (const k of Object.keys(LISTS)) mergeIn(k, res.lists && res.lists[k])
        if (res.snap) { D.snap = res.snap; D.sync.snapAt = res.snap.at }
        migrateRems()
        dropWaterRems()
        rulesApply()
        for (const o of D.ops) if (o.state === "local" && ops.some(x => x.id === o.id)) o.state = "sent"
        for (const so of res.ops || []) {
          const o = D.ops.find(x => x.id === so.id)
          if (o && so.state === "done" && o.state !== "done") { o.state = "done"; o.result = so.result; o.doneAt = so.doneAt; opDone(o) }
        }
        D.ops = D.ops.filter(o => o.state !== "done" || o.doneAt > Date.now() - 864e5)
        if (res.cc) ccIn(res.cc)
        if (res.url) D.conn.sheetUrl = D.conn.sheetUrl || res.url
        Object.assign(D.sync, { since: res.now, pushedAt: started, at: Date.now(), error: "" })
        save(false)
      } while (state.again)
      if (!stack.length && tab !== "chat") render()
      else renderTop()
      pushHere()
      ccLate()
      calRefresh()   // Google Календарь — отдельным запросом, чтобы не задерживать обмен
      return true
    } catch (e) {
      D.sync.error = e.name === "AbortError" ? "таблица не ответила" : String(e.message || e)
      save(false)
      renderTop()
      return false
    } finally { $("#sync").classList.remove("spin"); syncing = null }
  })()
  syncing = state
  return state.p
}
let calForce = false, calBusy = false
async function calRefresh() {
  if (calBusy || !D.conn || !(calForce || !D.gcal || Date.now() - (D.gcal.at || 0) > 120e3)) return
  calBusy = true; calForce = false
  try {
    const r = (await hubPost({ cal: { action: "list", from: dayKey(addDays(sod(new Date()), -21)) } }, 60000)).cal
    if (r) D.gcal = r.events ? { ok: true, at: Date.now(), events: r.events, calendars: r.calendars || [] } : { ok: !!(D.gcal && D.gcal.ok), at: Date.now(), events: (D.gcal && D.gcal.events) || [], error: r.error || "" }
    if (r && r.events) calReflow()
    save(false)
    if (!stack.length && tab !== "chat") render()
  } catch (e) {} finally { calBusy = false }
}
// Google Календарь — через таблицу (Apps Script). Пока доступ не выдан — по-старому, через календарь iPhone
const gcalOn = () => !!(D.gcal && D.gcal.ok)
async function calDo(action, input) {
  const res = await hubPost({ cal: Object.assign({ action }, input) })
  const r = res.cal || { error: "таблица не знает календарь — нужно обновить скрипт" }
  if (!r.error) { calForce = true; sync() }
  return r
}
// Напоминания приложения: { id, date, title, due, notes, repeat, done, doneAt }
function remAdd(x) {
  const now = Date.now()
  return upsert("rems", { id: `r${now}-${Math.random().toString(36).slice(2, 6)}`, date: now, title: String(x.title || "").trim(), due: x.due || null,
    notes: x.notes || "", repeat: x.repeat || null, done: false })
}
function nextDue(r) {
  const d = parseIso(r.due), rp = r.repeat
  if (!d || !rp || !rp.freq) return null
  const step = { daily: 1, weekly: 7, monthly: 0, yearly: 0 }[rp.freq]
  const n = new Date(d), now = new Date()
  for (let i = 0; i < 800 && (n <= d || n < now); i++) {
    if (rp.freq === "monthly") n.setMonth(n.getMonth() + 1)
    else if (rp.freq === "yearly") n.setFullYear(n.getFullYear() + 1)
    else if (rp.freq === "weekly" && (rp.days || []).length) { n.setDate(n.getDate() + 1); if (!rp.days.includes(RDAY[n.getDay()])) continue }
    else n.setDate(n.getDate() + step)
  }
  return /T/.test(r.due) ? iso(n) : dayKey(n)
}
function remSet(id, patch) {
  const r = D.rems.find(x => x.id === id && !x.deleted)
  if (!r) return null
  const y = Object.assign({}, r)
  if (patch.title) y.title = patch.title
  if (patch.notes !== undefined) y.notes = patch.notes
  if (patch.due !== undefined) y.due = patch.due || null
  if (patch.completed === true) {
    const nx = nextDue(r)
    if (nx) y.due = nx; else Object.assign(y, { done: true, doneAt: Date.now() })   // повторяющееся — на следующий раз
  }
  if (patch.completed === false) Object.assign(y, { done: false, doneAt: null })
  return upsert("rems", y)
}
// Напоминания про воду не нужны (пользователь: «захламляет») — о воде помощник напоминает сам подсказками plan_day
const WATER_REM = /💧|(стакан|выпе?й|попей|попить|пить)[^]{0,20}вод/i
function dropWaterRems() {
  if (D.waterRemsDropped) return
  for (const r of live(D.rems)) if (!r.done && WATER_REM.test(r.title || "")) remove("rems", r.id)
  D.waterRemsDropped = true
  save()
}
// Один раз: невыполненные напоминания iPhone и ещё не внесённые команды — в напоминания приложения
function migrateRems() {
  if (D.remsMigrated || !D.snap) return
  for (const r of D.snap.reminders || []) if (!r.completed && !D.rems.some(x => x.from === r.id))
    upsert("rems", { id: String(r.id), date: Date.now(), from: r.id, title: r.title, due: r.due || null, done: false })
  for (const o of D.ops) if (o.state === "local" && o.tool === "create_reminder") remAdd(o.input || {})
  D.ops = D.ops.filter(o => !(o.state === "local" && /_reminder$/.test(o.tool)))
  D.remsMigrated = true
  save()
}
// Команда выполнена на iPhone: сообщить, если не вышло
function opDone(o) {
  if (o.result && o.result.error) toast(`iPhone: не получилось — ${o.result.error}`)
}

// ───────────── Где я: сейчас — у браузера (только пока приложение открыто), иначе — последнее место от виджета ─────────────
const distM = (a, b) => {
  const R = 6371000, rad = v => v * Math.PI / 180, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const nearest = (here, list) => list.slice().sort((a, b) => distM(here, a) - distM(here, b))[0] || null
function whereAmI() {
  const fromWidget = () => { const l = D.snap && D.snap.loc; return l && l.lat != null ? { lat: l.lat, lng: l.lng, src: `по виджету, ${ago(l.at)}` } : null }
  if (!navigator.geolocation) return Promise.resolve(fromWidget())
  return new Promise(res => {
    const t = setTimeout(() => res(fromWidget()), 9000)
    navigator.geolocation.getCurrentPosition(p => { clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude, src: "сейчас" }) },
      () => { clearTimeout(t); res(fromWidget()) }, { enableHighAccuracy: false, maximumAge: 120000, timeout: 8000 })
  })
}

// ───────────── Календарь и напоминания iPhone (снимок от виджета + команды в очереди) ─────────────
const OP_LABEL = { create_event: "новое событие", update_event: "изменение события", delete_event: "удаление события",
  create_reminder: "новое напоминание", update_reminder: "изменение напоминания", delete_reminder: "удаление напоминания" }
function queueOp(tool, input) {
  const op = { id: uid("op"), tool, input, at: Date.now(), state: "local" }
  D.ops.push(op)
  save()
  return op
}
const pendingOps = () => D.ops.filter(o => o.state !== "done")
// То, что видит приложение: снимок iPhone + ещё не внесённые команды
function iphone() {
  const snap = D.snap || {}
  let events = (gcalOn() ? D.gcal.events.map(e => Object.assign({}, e, { repeats: !!e.recurring })) : (snap.events || []).map(e => Object.assign({}, e)))
  const reminders = live(D.rems).map(r => ({ id: r.id, title: r.title, due: r.due || null, completed: !!r.done, doneAt: r.doneAt || 0, notes: r.notes || "", repeat: r.repeat || null, list: "" }))
  for (const o of pendingOps()) {
    const x = o.input || {}
    if (o.tool === "create_event") events.push({ id: "op:" + o.id, title: x.title, start: x.start, end: x.end || x.start, all_day: !!x.all_day,
      calendar: x.calendar || "", location: x.location || "", pending: true })
    if (o.tool === "update_event") {
      const e = events.find(v => v.id === x.id && (!x.occurrence_start || v.start === x.occurrence_start))
      if (e) {
        const dur = (parseIso(e.end) - parseIso(e.start)) || 0
        if (x.start) { e.start = x.start; e.end = x.end || iso(new Date(+parseIso(x.start) + dur)) }
        if (x.title) e.title = x.title
        e.pending = true
      }
    }
    if (o.tool === "delete_event") events = events.filter(v => !(v.id === x.id && (x.all_future || !x.occurrence_start || v.start === x.occurrence_start)))
  }
  events = events.map(e => Object.assign(e, { s: parseIso(e.start), e: parseIso(e.end) || parseIso(e.start) })).filter(e => e.s)
    .sort((a, b) => a.s - b.s)
  return { events, reminders, watch: snap.watch && snap.watch.day === dayKey(new Date()) ? snap.watch : null, at: snap.at || 0 }
}
const openRems = v => v.reminders.filter(r => !r.completed)
const remDue = r => parseIso(r.due)
const remHasTime = r => /T/.test(r.due || "")
const remLate = r => { const d = remDue(r); return d && (remHasTime(r) ? d < new Date() : d < sod(new Date())) }
function remLabel(r) {
  const d = remDue(r)
  if (!d) return ""
  const day = dayName(d), t = remHasTime(r) ? hm(d) : ""
  return day === "сегодня" ? (t || "сегодня") : `${day}${t ? " " + t : ""}`
}

// ───────────── Окна (снизу экрана) ─────────────
const stack = []
function sheet(html, { onClose } = {}) {
  const layer = $("#layer")
  const scrim = document.createElement("div"); scrim.className = "scrim"
  const el = document.createElement("div"); el.className = "sheet"
  el.innerHTML = '<div class="grab"></div>' + String(html).replace(/<h3>([^<]*)/g, (m, t) => "<h3>" + deEmo(t))
  layer.append(scrim, el)
  requestAnimationFrame(() => { scrim.classList.add("show"); el.classList.add("show") })
  const entry = { el, close: null }
  entry.close = () => {
    const i = stack.indexOf(entry)
    if (i < 0) return
    stack.splice(i, 1)
    scrim.classList.remove("show"); el.classList.remove("show")
    setTimeout(() => { scrim.remove(); el.remove() }, 230)
    if (onClose) onClose()
  }
  scrim.onclick = () => entry.close()
  // смахнуть вниз: окно едет за пальцем, фон светлеет; отпустили быстро или ниже трети — закрылось, иначе пружиной назад
  let y0 = null, dy = 0, t0 = 0, vy = 0, ly = 0, lt = 0
  const follow = d => { el.style.transform = `translateY(${d}px)`; scrim.style.opacity = String(Math.max(0, 1 - d / (el.offsetHeight || 600))) }
  el.addEventListener("touchstart", e => { const top = el.scrollTop <= 0 || e.target.closest(".grab")
    y0 = top ? e.touches[0].clientY : null; dy = 0; vy = 0; ly = y0; lt = t0 = e.timeStamp }, { passive: true })
  el.addEventListener("touchmove", e => { if (y0 == null) return
    const y = e.touches[0].clientY; dy = y - y0
    if (e.timeStamp > lt) { vy = (y - ly) / (e.timeStamp - lt); ly = y; lt = e.timeStamp }
    if (dy > 0 && el.scrollTop <= 0) { el.classList.add("drag"); follow(dy) } else if (dy < 0) { y0 = null; el.classList.remove("drag"); el.style.transform = ""; scrim.style.opacity = "" } }, { passive: true })
  const release = () => { if (y0 == null) return; y0 = null; el.classList.remove("drag")
    if (dy > Math.min(140, el.offsetHeight / 3) || (vy > 0.45 && dy > 24)) { el.classList.add("flick"); el.style.transform = ""; scrim.style.opacity = ""; entry.close() }
    else { el.classList.add("spring"); el.style.transform = ""; scrim.style.opacity = ""; setTimeout(() => el.classList.remove("spring"), 500) } }
  el.addEventListener("touchend", release, { passive: true }); el.addEventListener("touchcancel", release, { passive: true })
  stack.push(entry)
  return entry
}
const ui = {
  info(title, message) {
    return new Promise(res => {
      const s = sheet(`<h3>${esc(title)}</h3><div class="msg">${esc(message || "")}</div><div class="btns"><button class="btn primary">Понятно</button></div>`, { onClose: () => res() })
      $(".btn", s.el).onclick = () => s.close()
    })
  },
  choose(title, message, options) {
    return new Promise(res => {
      let v = -1
      const s = sheet(`<h3>${esc(title)}</h3>${message ? `<div class="msg">${esc(message)}</div>` : ""}` +
        options.map((o, i) => `<button class="opt" data-i="${i}">${deEmo(esc(o))}</button>`).join("") +
        `<div class="btns"><button class="btn" data-i="-1">Отмена</button></div>`, { onClose: () => res(v) })
      $$("button[data-i]", s.el).forEach(b => b.onclick = () => { v = +b.dataset.i; s.close() })
    })
  },
  ask(title, hint, value = "", opts = {}) {
    return new Promise(res => {
      let v = null
      const field = opts.multiline ? `<textarea id="ask-v" placeholder="${esc(opts.placeholder || "")}">${esc(value)}</textarea>`
        : `<input id="ask-v" ${opts.type ? `type="${opts.type}" inputmode="decimal"` : ""} value="${esc(value)}" placeholder="${esc(opts.placeholder || "")}">`
      const s = sheet(`<h3>${esc(title)}</h3>${hint ? `<div class="msg">${esc(hint)}</div>` : ""}<div class="field">${field}</div>` +
        `<div class="btns"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">${esc(opts.ok || "Готово")}</button></div>`,
        { onClose: () => res(v) })
      const inp = $("#ask-v", s.el)
      setTimeout(() => inp.focus(), 250)
      const ok = () => { v = inp.value.trim() || null; s.close() }
      $('[data-a="ok"]', s.el).onclick = ok
      $('[data-a="no"]', s.el).onclick = () => s.close()
      if (!opts.multiline) inp.onkeydown = e => { if (e.key === "Enter") ok() }
    })
  },
  confirm(title, html, buttons) {
    return new Promise(res => {
      let v = null
      const s = sheet(`<h3>${esc(title)}</h3>${html}<div class="btns">${buttons.map((b, i) =>
        `<button class="btn ${i === buttons.length - 1 ? "primary" : ""}" data-b="${esc(b)}">${deEmo(esc(b))}</button>`).join("")}</div>`, { onClose: () => res(v) })
      $$("button[data-b]", s.el).forEach(b => b.onclick = () => { v = b.dataset.b; s.close() })
    })
  },
}

// ───────────── Claude ─────────────
// Ключ Claude: из виджета, свой (вставлен в «Настройках») или общий ключ семьи (window.FAM, «fam» — запросы идут через таблицу семьи)
const aiKey = () => (D.conn && D.conn.key) || D.myKey || (window.FAM && FAM.keyOn() ? "fam" : "")
async function claude(body, timeout = 90000, opts = {}) {
  if (!aiKey()) throw new Error("нет ключа Claude — подключите его в «Настройках» → «Ключ Claude»")
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeout)
  if (opts.signal) { if (opts.signal.aborted) ctl.abort(); else opts.signal.addEventListener("abort", () => ctl.abort()) }
  const send = async (b, beta) => {
    if (aiKey() === "fam") return await FAM.ai(b, ctl.signal)
    const headers = { "x-api-key": aiKey(), "anthropic-version": "2023-06-01", "content-type": "application/json", "anthropic-dangerous-direct-browser-access": "true" }
    if (beta) headers["anthropic-beta"] = beta
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ctl.signal, headers, body: JSON.stringify(b) })
    return await r.json()
  }
  try {
    const base = Object.assign({ model: opts.model || core.CONFIG.agentModel || "claude-sonnet-5-5" }, body)
    if (!opts.smart) return await send(base)
    // Помощник в чате: самая сильная модель с размышлением; если отказ фильтра — сервер сам переспросит другую модель
    let res = await send(Object.assign({}, base, { fallbacks: "default" }), "server-side-fallback-2026-07-01")
    if (res && res.error && /fallback|beta/i.test(res.error.message || "")) res = await send(base)
    if (res && res.error && /model/i.test(res.error.message || "") && res.error.type !== "overloaded_error")   // модель недоступна ключу — обычная модель виджета
      res = await send(Object.assign({}, body, { model: core.CONFIG.agentModel || "claude-sonnet-5-5", output_config: undefined }))
    return res
  } catch (e) {
    if (opts.signal && opts.signal.aborted) throw new Error("STOPPED")
    throw new Error(e.name === "AbortError" ? "Claude долго не отвечает" : "нет связи с Claude")
  } finally { clearTimeout(t) }
}
const CHAT_MODEL = "claude-opus-5-5"

// ── Еда по фото ──
const FOOD_SCHEMA = { type: "object", additionalProperties: false, properties: {
    title: { type: "string", description: "Короткое название приёма пищи по-русски, 2–5 слов" },
    items: { type: "array", items: { type: "object", properties: {
      name: { type: "string" }, grams: { type: "number" }, kcal: { type: "number" } }, required: ["name", "grams", "kcal"], additionalProperties: false } },
    kcal: { type: "number", description: "Всего ккал" },
    protein: { type: "number", description: "Белки, г" }, fat: { type: "number", description: "Жиры, г" }, carbs: { type: "number", description: "Углеводы, г" },
    confidence: { type: "string", enum: ["низкая", "средняя", "высокая"] },
    note: { type: "string", description: "Одна короткая фраза: что неточно или что уточнить. Можно пусто." },
    not_food: { type: "boolean", description: "true, если на фото нет еды" } },
  required: ["title", "items", "kcal", "protein", "fat", "carbs", "confidence", "note", "not_food"] }

function shrinkPhoto(file, max = 1024) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement("canvas")
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      res(c.toDataURL("image/jpeg", 0.82))
    }
    img.onerror = () => rej(new Error("не удалось открыть фото"))
    img.src = URL.createObjectURL(file)
  })
}
async function estimateFood(dataUrl, hint) {
  const content = []
  if (dataUrl) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: dataUrl.split(",")[1] } })
  content.push({ type: "text", text: (dataUrl ? "Оцени еду на фото." : "Оцени еду по описанию.") + (hint ? ` Уточнение от меня: ${hint}` : "") })
  const res = await claude({ max_tokens: 4000, output_config: { format: { type: "json_schema", schema: FOOD_SCHEMA } },
    system: "Ты нутрициолог. Определи блюда и продукты, оцени вес каждой части по размеру тарелки, приборов и упаковок, посчитай калории и БЖУ. " +
      "Учитывай масло и соусы. Если есть уточнение от пользователя — оно важнее того, что видно. Названия по-русски.",
    messages: [{ role: "user", content }] })
  if (!res || res.error) throw new Error(res && res.error ? res.error.message || res.error.type : "пустой ответ")
  if (res.stop_reason === "refusal") throw new Error("Claude отказался оценивать это фото")
  const t = (res.content || []).filter(c => c.type === "text").map(c => c.text).join("")
  try { return JSON.parse(t) } catch (e) { throw new Error("Claude не вернул оценку") }
}
function addFood(m) {
  const now = Date.now()
  return upsert("food", Object.assign({ id: `m${now}-${Math.random().toString(36).slice(2, 6)}`, date: now }, m, { kcal: Math.round(+m.kcal || 0) }))
}
// Защита от случайных серий: из виджета (#water) второй стакан за минуту не пишется, в приложении — спрашиваем
let lastWaterAt = 0
async function addWater(ml, from) {
  const now = Date.now(), last = Math.max(lastWaterAt, ...today(D.water).map(w => w.u || w.date || 0))
  if (from === "widget" && now - last < 60e3) return toast(`💧 Стакан уже записан ${Math.max(1, Math.round((now - last) / 1000))} с назад`)
  if (from !== "widget" && now - last < 10e3 && (await ui.confirm("Ещё стакан?", `<div class="msg">Только что уже добавлено ${ml} мл. Записать ещё один?</div>`, ["Отмена", "Записать"])) !== "Записать") return
  lastWaterAt = now
  upsert("water", { id: `w${now}`, date: now, ml: Math.round(ml) })
  render()
  toast(`💧 +${ml} мл · сегодня ${liters(waterToday())} л`)
}
const today = list => live(list).filter(x => sameDay(x.date, Date.now())).sort((a, b) => a.date - b.date)
const waterToday = () => today(D.water).reduce((s, w) => s + (w.ml || 0), 0)
// Еда: фото → оценка → сохранить / уточнить / поправить калории
async function foodFlow(dataUrl, hint) {
  if (!aiKey()) return ui.info("Нужен ключ Claude", "Калории по фото считает Claude. Подключите ключ: шестерёнка → «Ключ Claude» → «Подключить», это около двух минут.")
  while (true) {
    const wait = sheet(`<h3>🍽 Считаю калории…</h3>${dataUrl ? `<img class="photo-prev" src="${dataUrl}">` : ""}<div class="msg">Claude смотрит на ${dataUrl ? "фото" : "описание"}, это 5–15 секунд.</div>`)
    let est
    try { est = await estimateFood(dataUrl, hint) } catch (e) {
      wait.close()
      const b = await ui.confirm("Не получилось посчитать", `<div class="msg">${esc(e.message)}</div>`, ["Отмена", "Повторить"])
      if (b === "Повторить") continue
      return
    }
    wait.close()
    if (est.not_food) return ui.info("Еды не видно", "Попробуйте снять тарелку сверху, целиком в кадре.")
    const lines = (est.items || []).map(i => `• ${i.name} — ${num(i.grams)} г, ${num(i.kcal)} ккал`)
    lines.push("", `Итого ≈ ${num(est.kcal)} ккал`, `Б ${num(est.protein)} · Ж ${num(est.fat)} · У ${num(est.carbs)} г`, `Точность: ${est.confidence || "средняя"}`)
    if (est.note) lines.push(est.note)
    const b = await ui.confirm(`🍽 ${est.title}`, `<div class="cmd-list">${esc(lines.join("\n"))}</div>`, ["Отмена", "Уточнить", "Калории", "Сохранить"])
    if (!b || b === "Отмена") return
    if (b === "Уточнить") { const t = await ui.ask("Уточнение", "Например: половина порции, без соуса, рис 150 г", hint || ""); if (t) hint = t; continue }
    if (b === "Калории") {
      const v = parseFloat(String(await ui.ask("Калории", "ккал", String(Math.round(est.kcal)), { type: "number" }) || "").replace(",", "."))
      if (!(v > 0)) continue
      const k = v / (est.kcal || v);
      ["protein", "fat", "carbs"].forEach(x => { est[x] = Math.round((est[x] || 0) * k) })
      est.kcal = v
    }
    addFood({ title: est.title, kcal: est.kcal, protein: Math.round(est.protein || 0), fat: Math.round(est.fat || 0), carbs: Math.round(est.carbs || 0), items: est.items || [] })
    render()
    const kc = today(D.food).reduce((s, f) => s + (f.kcal || 0), 0)
    return toast(`✓ ${est.title}: ${num(est.kcal)} ккал · за день ${num(kc)}`)
  }
}
async function foodMenu() {
  const i = await ui.choose("🍽 Еда", "", ["📷 Сфотографировать", "🖼 Выбрать из фото", "⌨️ Описать словами", "✏️ Вписать калории вручную"])
  if (i === 0) $("#photo").click()
  if (i === 1) $("#photo-lib").click()
  if (i === 2) { const t = await ui.ask("Что съели?", "Например: тарелка том яма и рис", "", { ok: "Посчитать" }); if (t) foodFlow(null, t) }
  if (i === 3) foodForm()
}
function onPhoto(input) {
  input.onchange = async () => {
    const f = input.files && input.files[0]
    input.value = ""
    if (!f) return
    try { await scanFile(f) } catch (e) { ui.info("Фото", e.message) }
  }
}
// ── Фото или файл → помощник сам понимает, что это: еда, счёт, чек или другое ──
const SCAN_PROMPT = "Разбери это вложение по правилам для фото и документов."
function fileB64(f) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("не удалось прочитать файл")); r.readAsDataURL(f) })
}
async function scanFile(f) {
  let att
  if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name || "")) {
    if (f.size > 20e6) throw new Error("Файл больше 20 МБ — сократите его или сфотографируйте нужную страницу")
    att = { type: "document", media_type: "application/pdf", data: (await fileB64(f)).split(",")[1], name: f.name || "документ.pdf" }
  } else if (/^image\//.test(f.type) || /\.(jpe?g|png|heic|webp|gif)$/i.test(f.name || "")) {
    const url = await shrinkPhoto(f, 1568)
    att = { type: "image", media_type: "image/jpeg", data: url.split(",")[1], thumb: await shrinkData(url, 360) }
  } else if (/^video\//.test(f.type) || /\.(mov|mp4|m4v|webm)$/i.test(f.name || "")) {
    const url = await videoFrame(f)   // помощник видит кадр из середины видео
    att = { type: "image", media_type: "image/jpeg", data: url.split(",")[1], thumb: await shrinkData(url, 360), video: true }
  } else throw new Error("Можно фото, видео или PDF")
  const label = att.type === "document" ? `📄 ${att.name}` : att.video ? "🎬 Видео" : "📷 Фото"
  delete att.video
  attStage(att, label)
}
// Вложение не уходит сразу: над полем появляется карточка, можно добавить подпись текстом или голосом («это мой обед»)
// и отправить вместе. «Отправить» на карточке — без подписи. Смахнуть карточку — убрать вложение
let chatAtt = null
function attStage(att, label) {
  chatAtt = { att, label }
  if (tab !== "chat") setTab("chat"); else attTray()
  if (navigator.vibrate) navigator.vibrate(8)
}
function attCaption(c, text, voice) {   // что увидит Изи и что останется в ленте
  const a = c.att
  return {
    prompt: SCAN_PROMPT + (text ? `\nПодпись пользователя к вложению${voice ? " (сказал голосом)" : ""}: «${text}». Она главнее того, что видно: из неё понятно, что это и что с этим сделать.` : ""),
    show: !text ? c.label : a.thumb ? text : `${c.label}\n${text}`,
  }
}
function attTray() {
  const t = $("#att-tray"); if (!t) return
  const bar = t.closest(".chat-bar"), inp = $("#chat-in")
  if (bar) bar.classList.toggle("has-att", !!chatAtt)
  if (inp && !voice) inp.placeholder = chatAtt ? "Добавьте подпись…" : "Напишите или скажите…"
  if (!chatAtt) { t.classList.remove("show"); setTimeout(() => { if (!chatAtt) t.innerHTML = "" }, 260); return }
  const a = chatAtt.att, doc = a.type === "document", kind = doc ? "Файл" : /Видео/.test(chatAtt.label) ? "Видео" : "Фото"
  t.innerHTML = `<div class="att-card">${a.thumb ? `<img src="${esc(a.thumb)}" alt="">` : `<span class="att-doc">${ICO.doc}</span>`}
    <div class="att-t"><b>${esc(doc ? a.name : kind)}</b><small>Добавьте подпись или отправьте так</small></div>
    <button class="att-go" aria-label="Отправить без подписи">${ICO.send}</button></div>`
  requestAnimationFrame(() => t.classList.add("show"))
  const card = $(".att-card", t)
  $(".att-go", t).onclick = () => { const i = $("#chat-in"), v = i ? i.value : ""; if (i) { i.value = ""; grow(i) } chatSend(v) }
  // смахнуть вниз или в сторону — убрать
  let x0 = null, y0 = null, dx = 0, dy = 0
  card.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = dy = 0; card.style.transition = "none" }, { passive: true })
  card.addEventListener("touchmove", e => { if (x0 == null) return; dx = e.touches[0].clientX - x0; dy = Math.max(0, e.touches[0].clientY - y0)
    card.style.transform = `translate(${dx}px, ${dy}px)`; card.style.opacity = String(1 - Math.min(.7, (Math.abs(dx) + dy) / 220)) }, { passive: true })
  card.addEventListener("touchend", () => { card.style.transition = ""
    if (Math.abs(dx) > 70 || dy > 40) { card.style.transform = `translate(${dx * 2}px, ${dy * 2 + 40}px)`; card.style.opacity = "0"; attDrop() }
    else { card.style.transform = ""; card.style.opacity = "" }
    x0 = null })
}
function attDrop() { chatAtt = null; attTray(); toast("Вложение убрано") }
function videoFrame(f) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(f), v = document.createElement("video")
    const fail = () => { clearTimeout(t); URL.revokeObjectURL(u); rej(new Error("Не удалось открыть видео — пришлите фото или кадр с экрана")) }
    const t = setTimeout(fail, 12000)
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = u
    v.onloadeddata = () => { v.currentTime = Math.min(1.5, (v.duration || 2) / 2) }
    v.onseeked = () => {
      clearTimeout(t)
      const k = Math.min(1, 1568 / Math.max(v.videoWidth || 1, v.videoHeight || 1)), c = document.createElement("canvas")
      c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k)
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height)
      URL.revokeObjectURL(u); res(c.toDataURL("image/jpeg", .85))
    }
    v.onerror = fail
    v.load()
  })
}
function shrinkData(url, max) {
  return new Promise(res => { const img = new Image(); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas")
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", .7)) }
    img.onerror = () => res(""); img.src = url })
}

// ───────────── Помощник (чат) ─────────────
const AGENT_TOOLS = [
  { name: "add_food", description: "Записать съеденное. Калории и БЖУ оцени сам по описанию (обычная порция, если не сказано).",
    input_schema: { type: "object", properties: { title: { type: "string" }, kcal: { type: "number" },
      protein: { type: "number" }, fat: { type: "number" }, carbs: { type: "number" } }, required: ["title", "kcal"] } },
  { name: "add_water", description: "Записать выпитую воду. Стакан — 250 мл.",
    input_schema: { type: "object", properties: { ml: { type: "number" } }, required: ["ml"] } },
  { name: "add_workout", description: "Записать тренировку без часов. Оцени длительность и сожжённые калории сам по MET и весу пользователя из системной подсказки.",
    input_schema: { type: "object", properties: { title: { type: "string", description: "Коротко: «Плавание 180 м»" }, minutes: { type: "number" }, kcal: { type: "number" },
      date: { type: "string", description: "YYYY-MM-DDTHH:MM, если тренировка была не сейчас" } }, required: ["title", "minutes", "kcal"] } },
  { name: "get_health", description: "Еда, вода и активность с Apple Watch за сегодня (вместе с тренировками без часов).", input_schema: { type: "object", properties: {} } },
  { name: "get_events", description: "Найти события календаря (Google Календарь) в диапазоне дат (видно 45 дней вперёд и 2 дня назад). Для поиска по названию передайте query.",
    input_schema: { type: "object", properties: {
      start: { type: "string", description: "Начало диапазона, YYYY-MM-DDTHH:MM (местное время)" },
      end: { type: "string", description: "Конец диапазона, YYYY-MM-DDTHH:MM" },
      query: { type: "string" } }, required: ["start", "end"] } },
  { name: "create_event", description: "Создать событие в Google Календаре пользователя.",
    input_schema: { type: "object", properties: {
      title: { type: "string" }, start: { type: "string" }, end: { type: "string" },
      all_day: { type: "boolean" }, location: { type: "string" }, notes: { type: "string" },
      force: { type: "boolean", description: "true — поставить, даже если время защищено (только после «да» пользователя)" },
      calendar: { type: "string", description: "Название календаря; не указывайте, если пользователь не назвал" },
      repeat: { type: "object", description: "Повтор: {freq: daily|weekly|monthly|yearly, days: [MO,TU,...]} — days только для weekly",
        properties: { freq: { type: "string" }, days: { type: "array", items: { type: "string" } } } } },
      required: ["title", "start", "end"] } },
  { name: "update_event", description: "Изменить или перенести событие. Для повторяющегося события меняется только указанное повторение (occurrence_start).",
    input_schema: { type: "object", properties: {
      id: { type: "string" }, occurrence_start: { type: "string", description: "Начало нужного повторения из get_events" },
      title: { type: "string" }, start: { type: "string" }, end: { type: "string" },
      location: { type: "string" }, notes: { type: "string" } }, required: ["id", "occurrence_start"] } },
  { name: "delete_event", description: "Удалить событие. Пользователь увидит запрос подтверждения.",
    input_schema: { type: "object", properties: {
      id: { type: "string" }, occurrence_start: { type: "string" },
      all_future: { type: "boolean", description: "true — удалить это и все следующие повторения" } }, required: ["id", "occurrence_start"] } },
  { name: "get_reminders", description: "Список невыполненных напоминаний (и выполненных сегодня, если include_completed).",
    input_schema: { type: "object", properties: { include_completed: { type: "boolean" }, query: { type: "string" } } } },
  { name: "create_reminder", description: "Создать напоминание в IZIDAY (напоминания живут в приложении; уведомление и контроль «Выполнил?» — от IZIDAY).",
    input_schema: { type: "object", properties: {
      title: { type: "string" }, due: { type: "string", description: "YYYY-MM-DDTHH:MM или YYYY-MM-DD; не указывайте, если срока нет" },
      list: { type: "string", description: "Название списка напоминаний, если пользователь назвал" },
      notes: { type: "string" },
      repeat: { type: "object", properties: { freq: { type: "string" }, days: { type: "array", items: { type: "string" } } } } },
      required: ["title"] } },
  { name: "update_reminder", description: "Изменить напоминание: текст, срок, отметить выполненным или вернуть.",
    input_schema: { type: "object", properties: {
      id: { type: "string" }, title: { type: "string" }, due: { type: "string", description: "Новый срок; пустая строка — убрать срок" },
      completed: { type: "boolean" } }, required: ["id"] } },
  { name: "delete_reminder", description: "Удалить напоминание. Пользователь увидит запрос подтверждения.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "skip_card_payment", description: "Будущий платёж по карте не вносить в личные расходы (рабочий, чужой, возмещаемый). Виджет, получив из банка платёж " +
      "на эту сумму в ближайшие days дней, не запишет его в расходы и сообщит. Если платёж уже пришёл — найди его в get_money и удали вместо этого.",
    input_schema: { type: "object", properties: { amount: { type: "number" }, note: { type: "string", description: "Почему: «по работе» и т. п." },
      days: { type: "number", description: "Сколько дней ждать платёж, по умолчанию 14" } }, required: ["amount"] } },
  { name: "add_money", description: () => `Записать расход или доход ${core.CONFIG.currencyIn}.`,
    input_schema: { type: "object", properties: {
      type: { type: "string", enum: ["expense", "income"] }, amount: { type: "number" },
      method: { type: "string", enum: ["cash", "transfer"], description: "cash — наличные; transfer — перевод, карта, QR" },
      category: { type: "string", description: "Строго одна из категорий из системного сообщения" },
      comment: { type: "string" }, date: { type: "string", description: "Только если не сегодня, YYYY-MM-DD" },
      currency: { type: "string", enum: ["THB", "RUB", "USD"], description: "Валюта суммы, если не основная («5000 рублей», «$12»): пересчитаю по курсу" },
      shared: { type: "boolean", description: "Общая семейная трата (с женой)" } },
      required: ["type", "amount", "method", "category"] } },
  { name: "add_jar", description: "Копилка на цель со сроком («коплю на Японию 150 000 к июню»). Сама считает, сколько откладывать в месяц.",
    input_schema: { type: "object", properties: { title: { type: "string" }, target: { type: "number" }, due: { type: "string", description: "YYYY-MM — к какому месяцу" },
      saved: { type: "number", description: "Уже отложено" }, shared: { type: "boolean" } }, required: ["title", "target"] } },
  { name: "jar_deposit", description: "Отложить в копилку (amount < 0 — взять из неё). title — название копилки из get_money.jars.",
    input_schema: { type: "object", properties: { title: { type: "string" }, amount: { type: "number" } }, required: ["title", "amount"] } },
  { name: "add_debt", description: "Долг: dir in — должны пользователю, out — он должен, loan — кредит (amount — остаток, pay — платёж в месяц, rate — % годовых).",
    input_schema: { type: "object", properties: { title: { type: "string", description: "Кто или что: Андрей, автокредит" }, dir: { type: "string", enum: ["in", "out", "loan"] },
      amount: { type: "number" }, due: { type: "string", description: "YYYY-MM-DD, до какого числа" }, pay: { type: "number" }, rate: { type: "number" } }, required: ["title", "dir", "amount"] } },
  { name: "set_budget", description: "Лимит расходов на месяц по категории (0 — убрать лимит).",
    input_schema: { type: "object", properties: { category: { type: "string", description: "Категория расходов из системного сообщения" }, limit: { type: "number" } }, required: ["category", "limit"] } },
  { name: "add_recurring", description: "Добавить регулярный ежемесячный платёж (аренда, интернет, подписка). В срок он появится в «Сегодня», оплату пользователь отметит одним нажатием. paid_now=true — уже оплачен в этом месяце (запишет расход).",
    input_schema: { type: "object", properties: { title: { type: "string" }, amount: { type: "number" }, day: { type: "number", description: "Число месяца, 1–31" },
      method: { type: "string", enum: ["cash", "transfer"] }, category: { type: "string" }, paid_now: { type: "boolean" } }, required: ["title", "amount", "day", "category"] } },
  { name: "pay_recurring", description: "Отметить регулярный платёж оплаченным в этом месяце (запишет расход). id из get_money.recurring.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "add_shopping", description: "Добавить в список покупок («купить молоко и хлеб» — два пункта). Рядом с магазином из списка (add_store) придёт напоминание.",
    input_schema: { type: "object", properties: { items: { type: "array", items: { type: "string" } } }, required: ["items"] } },
  { name: "get_shopping", description: "Что осталось купить и у каких магазинов напоминать.", input_schema: { type: "object", properties: {} } },
  { name: "shop_done", description: "Отметить купленным (done=false — вернуть в список).", input_schema: { type: "object", properties: { items: { type: "array", items: { type: "string" } }, done: { type: "boolean" } }, required: ["items"] } },
  { name: "add_store", description: "Магазин, у которого напоминать о покупках («напоминай о покупках у Big C / Makro»). Находит филиалы рядом; виджет пришлёт список, когда пользователь будет рядом и есть что купить.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Сеть или адрес магазина" }, radius_m: { type: "number", description: "По умолчанию 400" } }, required: ["query"] } },
  { name: "add_kids_item", description: "Дело детей по дням недели: кружок, секция, кто забирает, что взять («по вторникам и четвергам в 17:00 плавание у Алии, взять очки»). Утром в 7:00 и за 30 минут придёт пуш.",
    input_schema: { type: "object", properties: { title: { type: "string" }, days: { type: "array", items: { type: "number" }, description: "1 — пн … 7 — вс" },
      time: { type: "string", description: "HH:MM, если есть" }, kid: { type: "string", description: "Кто из детей" }, who: { type: "string", description: "Кто забирает / везёт" }, take: { type: "string", description: "Что взять" } }, required: ["title", "days"] } },
  { name: "get_kids", description: "Дела детей по дням недели.", input_schema: { type: "object", properties: {} } },
  { name: "delete_kids_item", description: "Убрать дело детей по id (из get_kids).", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "start_fast", description: "Начать интервальное голодание (по умолчанию 16 ч). Когда окно откроется — придёт пуш.", input_schema: { type: "object", properties: { hours: { type: "number" } } } },
  { name: "stop_fast", description: "Закончить голодание сейчас (поел).", input_schema: { type: "object", properties: {} } },
  { name: "add_goal", description: "Цели: kind=month — цели на этот месяц; wish — «100 желаний» (любые желания, большие и маленькие); dream — «10 мечт», крупное на срок до 2 лет (due YYYY-MM-DD, по умолчанию через год). Мечты разбивай на шаги через add_goal_steps. " +
      "Если пользователю трудно придумать — задавай по одному вопросу про разные стороны жизни (поездки, учёба, семья, тело, деньги, дом, люди, творчество) и записывай ответы.",
    input_schema: { type: "object", properties: { kind: { type: "string", enum: ["month", "wish", "dream"] }, items: { type: "array", items: { type: "string" } }, due: { type: "string", description: "Для dream: YYYY-MM-DD" } }, required: ["kind", "items"] } },
  { name: "start_pomodoro", description: "Начать помидор: фокус на одном деле (по умолчанию 25 минут, потом 5 минут отдыха). Когда время выйдет — придёт уведомление.",
    input_schema: { type: "object", properties: { title: { type: "string", description: "Над чем работаем" }, minutes: { type: "number" } } } },
  { name: "stop_pomodoro", description: "Остановить текущий помидор.", input_schema: { type: "object", properties: {} } },
  { name: "add_chore", description: "«Снова пора»: дело, которое повторяется раз в N дней (полить цветы — 3, помыть машину — 14, сменить постель — 7). last_done — YYYY-MM-DD, когда делали в последний раз (если сказали). То же название — обновит.",
    input_schema: { type: "object", properties: { title: { type: "string" }, every_days: { type: "number" }, last_done: { type: "string" } }, required: ["title", "every_days"] } },
  { name: "chore_done", description: "Отметить «снова пора» сделанным (сегодня или date YYYY-MM-DD) — следующий раз посчитается сам.", input_schema: { type: "object", properties: { title: { type: "string" }, date: { type: "string" } }, required: ["title"] } },
  { name: "get_chores", description: "Дела «снова пора»: как часто, когда делали, когда снова пора (самое срочное — первым).", input_schema: { type: "object", properties: {} } },
  { name: "delete_chore", description: "Удалить дело «снова пора» по id (из get_chores).", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "add_list_items", description: "Свои списки пользователя (на выходные, в отпуск, подарки, фильмы…): добавить пункты в список list (название). Нет такого и create=true — создать. Для покупок — add_shopping, для желаний и мечт — add_goal.",
    input_schema: { type: "object", properties: { list: { type: "string" }, items: { type: "array", items: { type: "string" } }, create: { type: "boolean" } }, required: ["list", "items"] } },
  { name: "list_item_done", description: "Отметить пункты своего списка (done=false — снять отметку).", input_schema: { type: "object", properties: { list: { type: "string" }, items: { type: "array", items: { type: "string" } }, done: { type: "boolean" } }, required: ["list", "items"] } },
  { name: "get_lists", description: "Свои списки пользователя и пункты в них.", input_schema: { type: "object", properties: {} } },
  { name: "delete_list", description: "Удалить свой список целиком по id (из get_lists) — только если пользователь прямо попросил.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "wish_to_goal", description: "Перевести желание из «100 желаний» в цели на этот месяц (желание остаётся в списке с пометкой). Потом предложи разбить цель на шаги с датами (add_goal_steps).",
    input_schema: { type: "object", properties: { wish: { type: "string" } }, required: ["wish"] } },
  { name: "add_goal_steps", description: "Разбить цель на месяц, мечту или желание на шаги — конкретный план: goal — название или id, steps — шаги по порядку («узнать цены», «записаться в школу»), dates — даты шагов в том же порядке (YYYY-MM-DD или YYYY-MM-DDTHH:MM, можно пропускать). Повторы не добавляются; у существующего шага без даты дата проставится. Внести шаги в календарь — отдельно через create_event, после согласия.",
    input_schema: { type: "object", properties: { goal: { type: "string" }, steps: { type: "array", items: { type: "string" } }, dates: { type: "array", items: { type: "string" } } }, required: ["goal", "steps"] } },
  { name: "goal_step_done", description: "Отметить шаг мечты сделанным (done=false — снять отметку).", input_schema: { type: "object", properties: { goal: { type: "string" }, step: { type: "string" }, done: { type: "boolean" } }, required: ["goal", "step"] } },
  { name: "get_goals", description: "Цели на месяц, 100 желаний, 10 мечт: что есть и что сбылось.", input_schema: { type: "object", properties: { kind: { type: "string", enum: ["month", "wish", "dream"] } } } },
  { name: "goal_done", description: "Отметить цель, желание или мечту выполненной (done=false — снять отметку).", input_schema: { type: "object", properties: { items: { type: "array", items: { type: "string" } }, kind: { type: "string", enum: ["month", "wish", "dream"] }, done: { type: "boolean" } }, required: ["items"] } },
  { name: "delete_goal", description: "Убрать цель, желание или мечту по id (из get_goals).", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "set_protein_goal", description: "Цель по белку, г в день (по умолчанию 1,6 г на кг веса).", input_schema: { type: "object", properties: { grams: { type: "number" } }, required: ["grams"] } },
  { name: "log_weight", description: "Записать вес пользователя в кг.", input_schema: { type: "object", properties: { kg: { type: "number" }, date: { type: "string", description: "YYYY-MM-DD, если не сегодня" } }, required: ["kg"] } },
  { name: "mark_habit", description: "Отметить привычку за день (или снять отметку done=false). Для «хочу бросить» отметка значит, что было (выпил, курил). Если такой привычки нет и create=true — создать.",
    input_schema: { type: "object", properties: { habit: { type: "string", description: "Название привычки" }, day: { type: "string", description: "YYYY-MM-DD, по умолчанию сегодня" },
      done: { type: "boolean" }, create: { type: "boolean" }, bad: { type: "boolean", description: "При создании: true — привычка, которую бросают" } }, required: ["habit"] } },
  { name: "get_money", description: "Операции и итоги по деньгам за месяц.",
    input_schema: { type: "object", properties: { month: { type: "string", description: "YYYY-MM, по умолчанию текущий" } } } },
  { name: "update_money", description: "Исправить операцию по id (из get_money или get_history details): категорию и/или комментарий. Для разбора непонятных трат.",
    input_schema: { type: "object", properties: { id: { type: "string" }, category: { type: "string", description: "Одна из категорий из системного сообщения" }, comment: { type: "string" } }, required: ["id"] } },
  { name: "delete_money", description: "Удалить ошибочную операцию по id.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "get_history", description: "Сводка по дням за период (до 92 дней): еда (ккал, БЖУ), вода, тренировки, шаги и активность с часов, расходы и доходы. " +
      "details=true — ещё и сами записи с id (блюда, вода, операции). Для вопросов «как я питался на неделе», «сколько потратил за октябрь по дням», «сколько шагов вчера».",
    input_schema: { type: "object", properties: { from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD, по умолчанию сегодня" },
      details: { type: "boolean" } }, required: ["from"] } },
  { name: "read_sheet", description: "Прочитать таблицу виджета (Google Таблица) напрямую. Без sheet — список листов с колонками. " +
      "С sheet — строки листа (последние limit, можно from/to по дате в первом столбце). Листы: «Операции», «Еда», «Вода», «Тренировки», «Активность», " +
      "«Карта» (платежи по банковской карте из писем банка), «Итоги: …», «Еда и активность» и другие. Используй, когда нужны данные старше, чем есть в get_history, или лист, которого нет в других инструментах.",
    input_schema: { type: "object", properties: { sheet: { type: "string" }, from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" },
      limit: { type: "number", description: "сколько последних строк, по умолчанию 200" } } } },
  { name: "route_to", description: "Сколько ехать (или идти) от того места, где сейчас пользователь, до точки: минуты и километры по Google Картам. " +
      "to — название места или адрес («Декатлон», «аэропорт Суварнабхуми», «Central World»).",
    input_schema: { type: "object", properties: { to: { type: "string" }, mode: { type: "string", enum: ["driving", "walking", "transit"], description: "по умолчанию на машине" } }, required: ["to"] } },
  { name: "remind_near", description: "Напомнить, когда пользователь окажется рядом с местом («напомни заехать в Декатлон, когда буду рядом»). " +
      "Находит точки места рядом с пользователем (у сетей — несколько филиалов). Проверяет виджет примерно раз в 15 минут и присылает уведомление. " +
      "Если место не нашлось — попроси уточнить адрес или район.",
    input_schema: { type: "object", properties: { title: { type: "string", description: "Что сделать: «Заехать в Декатлон — купить мяч»" },
      query: { type: "string", description: "Место для поиска на карте: название, сеть или адрес" },
      radius_m: { type: "number", description: "Насколько близко, м. По умолчанию 1500 (за 15 минут машина проезжает много)" } }, required: ["title", "query"] } },
  { name: "list_places", description: "Активные и сработавшие напоминания по месту.", input_schema: { type: "object", properties: {} } },
  { name: "plan_day", description: "Составить или обновить план подсказок на сегодня: уведомления на iPhone в нужное время (их ставит виджет). " +
      "Заменяет ещё не наступившие подсказки сегодняшнего дня. Используй, когда пользователь просит вести его день, напоминать, подсказывать, или в утренней сводке.",
    input_schema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: {
      time: { type: "string", description: "YYYY-MM-DDTHH:MM сегодня" }, text: { type: "string", description: "Короткая подсказка, 1–2 предложения, живо и по делу" } }, required: ["time", "text"] } } }, required: ["items"] } },
  { name: "where_was_i", description: "Где был пользователь в указанный момент (история мест с iPhone, 60 дней, точка примерно раз в час или при переезде): адрес, ссылка на Google Карты, " +
      "насколько точка близка по времени. Используй для любого вопроса о платеже или переводе (особенно непонятном) и вообще «где я был тогда-то».",
    input_schema: { type: "object", properties: { time: { type: "string", description: "YYYY-MM-DDTHH:MM, местное время" } }, required: ["time"] } },
  { name: "mail_search", description: "Почта Gmail пользователя: найти цепочки писем. query — синтаксис поиска Gmail: from:, to:, subject:, is:unread, is:important, newer_than:2d, " +
      "older_than:, after:2026/10/01, has:attachment, in:inbox, in:sent, label:, category:primary, -category:promotions, слова. Возвращает id цепочек, тему, отправителя, дату и начало текста.",
    input_schema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number", description: "до 25, по умолчанию 10" } }, required: ["query"] } },
  { name: "mail_read", description: "Прочитать цепочку писем целиком по id из mail_search (последние 8 писем, текст и названия вложений).",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "mail_send", description: "Отправить новое письмо от имени пользователя. Приложение само покажет письмо и спросит подтверждение. Пиши в стиле пользователя, на языке получателя.",
    input_schema: { type: "object", properties: { to: { type: "string", description: "адреса через запятую" }, cc: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } },
  { name: "mail_reply", description: "Ответить в цепочке (id из mail_search). all=true — ответить всем. Приложение спросит подтверждение.",
    input_schema: { type: "object", properties: { id: { type: "string" }, body: { type: "string" }, all: { type: "boolean" } }, required: ["id", "body"] } },
  { name: "mail_draft", description: "Сохранить черновик (не отправляя): новое письмо (to, subject, body) или ответ в цепочке (id, body). Для случаев, когда пользователь хочет сам проверить и отправить.",
    input_schema: { type: "object", properties: { id: { type: "string" }, to: { type: "string" }, cc: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["body"] } },
  { name: "mail_modify", description: "Разобрать почту: op = archive | inbox | read | unread | star | unstar | label | unlabel | trash | spam для цепочек ids. Для label/unlabel — label (имя метки, создастся). Корзина и спам — с подтверждением.",
    input_schema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } }, op: { type: "string", enum: ["archive", "inbox", "read", "unread", "star", "unstar", "label", "unlabel", "trash", "spam"] }, label: { type: "string" } }, required: ["ids", "op"] } },
  { name: "remember", description: "Запомнить надолго факт о пользователе: люди и отношения, предпочтения, привычки, цели и планы, здоровье, работа и проекты, важные даты, договорённости. " +
      "Пиши коротко и самодостаточно, с датой, если важна («Жена — Алия, ДР 14 марта», «Цель на 2027: пробежать полумарафон»). Если факт изменился — сначала forget старый.",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
  { name: "forget", description: "Забыть факт из памяти по id (устарел, неверен или пользователь попросил).", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "search_chats", description: "Поиск по всем прошлым разговорам с пользователем (дословные сообщения и сводки). Используй, когда пользователь ссылается на прошлое " +
      "(«как мы договаривались», «что я говорил про…», «помнишь…») или нужна подробность, которой нет в памяти.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Ключевые слова; несколько вариантов через пробел" },
      from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" } }, required: ["query"] } },
  { name: "delete_record", description: "Удалить запись о воде, еде или тренировке по id (id есть в get_health и get_history с details). Для случайных дублей (несколько одинаковых записей в одну минуту): удаляй лишние, одну оставь. Приложение само спросит подтверждение.",
    input_schema: { type: "object", properties: { kind: { type: "string", enum: ["water", "food", "workouts"] }, ids: { type: "array", items: { type: "string" } } }, required: ["kind", "ids"] } },
  { name: "delete_place", description: "Убрать напоминание по месту по id.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "ask_user", description: "Задать пользователю уточняющий вопрос и получить ответ. Используйте, только если без ответа нельзя выполнить команду правильно.",
    input_schema: { type: "object", properties: {
      question: { type: "string" },
      options: { type: "array", items: { type: "string" }, description: "2–5 коротких вариантов ответа, если они очевидны" } },
      required: ["question"] } },
]
const routes = () => (D.conn && Array.isArray(D.conn.routes) ? D.conn.routes : [])
function chatTools() {
  const list = AGENT_TOOLS.map(t => Object.assign({}, t, { description: typeof t.description === "function" ? t.description() : t.description }))
  const r = routes()
  if (r.length) list.push({ name: "claude_code",
    description: "Передать задачу в Claude Code: запускается новая сессия, она работает сама (код, документы, исследование, " +
      "длинные многошаговые задачи). Сразу появляется ссылка на сессию, а когда сессия закончит, её итог сам придёт в этот чат. Маршруты:\n" + r.map(x => `- «${x.name}»: ${x.hint || "без описания"}`).join("\n"),
    input_schema: { type: "object", properties: {
      route: { type: "string", enum: r.map(x => x.name) },
      title: { type: "string", description: "Короткое название задачи, 2–5 слов: так она будет подписана в чате" },
      task: { type: "string", description: "Полная постановка задачи: что сделать, весь нужный контекст из разговора, что вернуть. Сессия этот чат не видит." },
    }, required: ["route", "task"] } })
  return list.concat(IZI_TOOL_DEFS)
}

const evOut = e => ({ id: e.id, title: e.title, start: e.start, end: e.end, all_day: !!e.all_day, calendar: e.calendar || "", location: e.location || "",
  repeats: !!e.repeats, ...(e.pending ? { pending: "ещё не внесено в iPhone" } : {}) })
const QUEUED = "Записано в очередь: виджет внесёт это в iPhone при ближайшем обновлении (обычно в течение 15 минут)."

async function runTool(name, x) {
  if (IZI_TOOLS[name]) return IZI_TOOLS[name](x)
  const v = iphone()
  switch (name) {
    case "get_events": {
      const from = parseIso(x.start), to = parseIso(x.end)
      if (!from || !to) return { error: "нужны start и end в формате YYYY-MM-DDTHH:MM" }
      let list = v.events.filter(e => e.s < to && e.e > from)
      if (x.query) { const q = x.query.toLowerCase(); list = list.filter(e => (e.title || "").toLowerCase().includes(q) || core.titleMatches(e.title || "", x.query)) }
      return { events: list.slice(0, 60).map(evOut), ...(gcalOn() ? { source: "Google Календарь", at: iso(new Date(D.gcal.at)) } : D.snap ? { snapshot_at: iso(new Date(D.snap.at)) } : { warning: "календарь ещё не загружен" }) }
    }
    case "create_event": {
      if (!parseIso(x.start)) return { error: "неверное начало" }
      { const hit = !x.force && !x.all_day && protHit(parseIso(x.start), parseIso(x.end) || new Date(+parseIso(x.start) + 3600e3))
        if (hit) return { warning: `Это время защищено: «${hit.p.title}» ${hm(hit.s)}–${hm(hit.e)}. Спроси пользователя: поставить всё равно (повтори с force: true) или найти другое время.` } }
      x = Object.assign({}, x); delete x.force
      if (gcalOn()) { const r = await calDo("create", x); return r.error ? { error: r.error } : { ok: true, id: r.event.id, event: r.event } }
      const op = queueOp("create_event", x)
      return { ok: true, id: "op:" + op.id, note: QUEUED }
    }
    case "update_event": {
      if (String(x.id).startsWith("op:")) return { error: "это событие ещё не внесено в iPhone — изменить его можно после обновления виджета" }
      const e = v.events.find(ev => ev.id === x.id && (!x.occurrence_start || ev.start === x.occurrence_start)) || v.events.find(ev => ev.id === x.id)
      if (!e) return { error: "событие не найдено" }
      if (x.start && x.start !== e.start) {
        const ok = await chatConfirm(`Перенести «${e.title}»?\n${core.cap(fullDate(e.s))}, ${hm(e.s)} → ${core.cap(fullDate(parseIso(x.start)))}, ${hm(parseIso(x.start))}`)
        if (!ok) return { cancelled: "пользователь отказался переносить" }
      }
      if (gcalOn()) { const r = await calDo("update", Object.assign({}, x, { occurrence_start: x.occurrence_start || e.start })); return r.error ? { error: r.error } : { ok: true, event: r.event } }
      queueOp("update_event", Object.assign({}, x, { occurrence_start: x.occurrence_start || e.start }))
      return { ok: true, note: QUEUED }
    }
    case "delete_event": {
      if (String(x.id).startsWith("op:")) { cancelOp(x.id.slice(3)); return { ok: true, note: "событие ещё не было внесено — отменено" } }
      const e = v.events.find(ev => ev.id === x.id && (!x.occurrence_start || ev.start === x.occurrence_start)) || v.events.find(ev => ev.id === x.id)
      if (!e) return { error: "событие не найдено" }
      if (!(await chatConfirm(`Удалить «${e.title}»?\n${core.cap(fullDate(e.s))}, ${hm(e.s)}${x.all_future ? "\nи все следующие повторения" : ""}`)))
        return { cancelled: "пользователь отказался удалять" }
      if (gcalOn()) { const r = await calDo("delete", Object.assign({}, x, { occurrence_start: x.occurrence_start || e.start })); return r.error ? { error: r.error } : { ok: true } }
      queueOp("delete_event", Object.assign({}, x, { occurrence_start: x.occurrence_start || e.start }))
      return { ok: true, note: QUEUED }
    }
    case "get_reminders": {
      let list = x.include_completed ? v.reminders : openRems(v)
      if (x.query) list = list.filter(r => (r.title || "").toLowerCase().includes(x.query.toLowerCase()) || core.titleMatches(r.title || "", x.query))
      return { reminders: list.slice(0, 80).map(r => ({ id: r.id, title: r.title, due: r.due, completed: !!r.completed, ...(r.repeat ? { repeat: r.repeat } : {}), ...(r.notes ? { notes: r.notes } : {}) })) }
    }
    case "create_reminder": {
      if (!String(x.title || "").trim()) return { error: "нужен текст" }
      if (WATER_REM.test(x.title)) return { error: "про воду напоминания не создаются — пользователь не хочет их в списке. Используй plan_day (подсказка-уведомление)" }
      if (x.due && !parseIso(x.due)) return { error: "срок — YYYY-MM-DDTHH:MM или YYYY-MM-DD" }
      const r = remAdd(x)
      return { ok: true, id: r.id, note: "Сохранено в IZIDAY; уведомление придёт от виджета IZIDAY в срок" }
    }
    case "update_reminder": {
      const r = remSet(x.id, x)
      return r ? { ok: true, reminder: { id: r.id, title: r.title, due: r.due, completed: !!r.done } } : { error: "напоминание не найдено" }
    }
    case "delete_reminder": {
      const r = v.reminders.find(z => z.id === x.id)
      if (!r) return { error: "напоминание не найдено" }
      if (!(await chatConfirm(`Удалить напоминание «${r.title}»?`))) return { cancelled: "пользователь отказался удалять" }
      remove("rems", r.id)
      return { ok: true }
    }
    case "skip_card_payment": {
      if (!(x.amount > 0)) return { error: "нужна сумма" }
      const now = Date.now()
      upsert("skips", { id: uid("k"), date: now, amount: x.amount, note: String(x.note || "").slice(0, 120), until: now + (x.days || 14) * 864e5 })
      return { ok: true, note: `Платёж ${x.amount} по карте в ближайшие ${x.days || 14} дн. не попадёт в расходы` }
    }
    case "update_money": {
      const e = live(D.money).find(m => m.id === x.id)
      if (!e) return { error: "нет такой операции" }
      const names = (core.CONFIG.categories[e.type] || []).map(c => c[0])
      if (x.category != null && !names.includes(x.category)) return { error: `категория должна быть одной из: ${names.join(", ")}` }
      const rec = upsert("money", Object.assign({}, e, x.category != null ? { category: x.category } : {}, x.comment != null ? { comment: String(x.comment).trim() } : {}))
      const learned = x.category != null && x.category !== e.category && rec.comment ? ruleLearn(rec.comment, rec.category, rec.type) : null
      return { ok: true, id: rec.id, category: rec.category, comment: rec.comment || "", ...(learned ? { learned: `дальше «${learned.label}» сам ставлю в «${learned.cat}» — скажи об этом коротко` } : {}) }
    }
    case "add_money": {
      const names = core.CONFIG.categories[x.type] ? core.CONFIG.categories[x.type].map(c => c[0]) : []
      if (!names.includes(x.category)) return { error: `категория должна быть одной из: ${names.join(", ")}` }
      if (!(x.amount > 0)) return { error: "сумма должна быть больше нуля" }
      const now = Date.now(), d = parseIso(x.date)
      if (d) d.setHours(12, 0, 0, 0)
      const B = baseCur(), fc = x.currency && x.currency !== B && CUR[x.currency]
      const ruled = x.category === "Другое" && x.comment ? ruleFor(x.comment, x.type) : null
      const rec = upsert("money", Object.assign({ id: `f${now}-${Math.random().toString(36).slice(2, 6)}`, date: d ? d.getTime() : now, type: x.type, amount: fc ? Math.round(fx(x.amount, x.currency, B)) : x.amount,
        method: x.method, category: ruled && names.includes(ruled) ? ruled : x.category, comment: x.comment || "" }, fc ? { cur: x.currency, orig: x.amount } : {}, x.shared ? { shared: true } : {}))
      const bs = x.type === "expense" && budgetState(x.category, core.monthKey(new Date(rec.date)))
      return { ok: true, id: rec.id, category: rec.category, ...(fc ? { converted: `${fmtCur(x.amount, x.currency)} ≈ ${core.money(rec.amount)}` } : {}), ...(bs ? { budget: { limit: bs.limit, spent_this_month: bs.spent, left: bs.left, warn: bs.p >= 0.8 ? "скажи пользователю, сколько осталось по лимиту" : undefined } } : {}) }
    }
    case "add_jar": {
      if (!x.title || !(x.target > 0)) return { error: "нужны название и цель" }
      if (x.due && !/^\d{4}-\d\d$/.test(x.due)) return { error: "due — YYYY-MM" }
      const j = jarSave(jarFind(x.title) || null, { title: x.title, target: Math.round(x.target), saved: Math.round(x.saved || 0), due: x.due || "", shared: !!x.shared })
      return { ok: true, id: j.id, per_month: jarPlan(j), status: jarState(j).txt }
    }
    case "jar_deposit": {
      const j = jarFind(x.title)
      if (!j) return { error: "нет такой копилки", have: jars().map(z => z.title) }
      const r = jarDeposit(j, x.amount)
      return { ok: true, title: r.title, saved: r.saved, target: r.target, status: jarState(r).txt }
    }
    case "add_debt": {
      if (!x.title || !(x.amount > 0)) return { error: "нужны кто/что и сумма" }
      const d = upsert("goals", { id: uid("q"), date: Date.now(), kind: "debt", title: x.title, dir: x.dir, amount: Math.round(x.amount), due: x.due || "", pay: Math.round(x.pay || 0), rate: +x.rate || 0 })
      return { ok: true, id: d.id, line: debtLine(d).s }
    }
    case "get_money": {
      const key = x.month || core.monthKey(new Date())
      const t = core.monthTotals(live(D.money), key)
      const cs = canSpend(), cap = capital()
      return { month: key, income: t.income, expense: t.expense, cash: t.cash, transfer: t.transfer, by_category: t.cats,
        can_spend_today: cs ? cs.today : "нет дохода в этом месяце", left_this_month: cs ? cs.left : undefined,
        jars: jars().map(j => ({ title: j.title, saved: j.saved || 0, target: j.target, due: j.due, status: jarState(j).txt })),
        debts: debts().map(d => ({ title: d.title, dir: d.dir, amount: d.amount, due: d.due || undefined, note: debtLine(d).s })),
        capital: accts().length ? { total: cap.total, accounts: accts().map(a => ({ title: a.title, amount: a.amount, currency: a.cur || baseCur() })) } : undefined,
        fx: fxLine(), learned_categories: catRules().length,
        income_plan: { saved_by_user: !!aplan(), items: planItems().map(z => ({ item: z.title || ENV(z.k).t, percent: z.pct, ...(envJar(z.k) ? { accumulated: envJar(z.k).saved || 0 } : {}) })) },
        items: t.items.slice(-60).map(e => ({ id: e.id, date: iso(new Date(e.date)), type: e.type, amount: e.amount, method: e.method, category: e.category, comment: e.comment })),
        budgets: live(D.budgets).filter(b => b.limit > 0).map(b => { const s = budgetState(b.category, key); return { category: b.category, limit: b.limit, spent: s.spent, left: s.left } }),
        recurring: live(D.recur).map(r => ({ id: r.id, title: r.title, amount: r.amount, day: r.day, category: r.category, paid: recurPaid(r, key), due: dayKey(recurDue(r, monthStart(key))) })) }
    }
    case "get_history": {
      const d0 = parseIso(x.from), d1 = x.to ? parseIso(x.to) : sod(new Date())
      if (!d0 || !d1) return { error: "даты в формате YYYY-MM-DD" }
      const from = sod(d0), to = addDays(sod(d1), 1)
      if ((to - from) / 864e5 > 92) return { error: "не больше 92 дней за раз" }
      const inDay = (list, d) => live(list).filter(e => e.date >= +d && e.date < +addDays(d, 1))
      const hd = {}
      for (const h of (D.snap && D.snap.health) || []) if (h && h.day) hd[h.day] = h
      const days = []
      for (let d = from; d < to; d = addDays(d, 1)) {
        const food = inDay(D.food, d), money = inDay(D.money, d), wk = inDay(D.workouts, d), h = hd[dayKey(d)]
        const sum = (a, k) => Math.round(a.reduce((s, m) => s + (+m[k] || 0), 0))
        const row = { date: dayKey(d), kcal: sum(food, "kcal"), protein: sum(food, "protein"), fat: sum(food, "fat"), carbs: sum(food, "carbs"),
          water_ml: sum(inDay(D.water, d), "ml"), expense: sum(money.filter(e => e.type === "expense"), "amount"), income: sum(money.filter(e => e.type === "income"), "amount") }
        if (wk.length) row.workouts = wk.map(w => ({ id: w.id, title: w.title, minutes: w.minutes, kcal: w.kcal }))
        if (h) Object.assign(row, { steps: h.steps, active_kcal: h.active, exercise_min: h.exercise, sleep_h: h.sleep })
        if (x.details) {
          if (food.length) row.food = food.map(m => ({ id: m.id, time: hm(new Date(m.date)), title: m.title, kcal: m.kcal }))
          const wa = inDay(D.water, d); if (wa.length) row.water = wa.map(w => ({ id: w.id, time: hm(new Date(w.date)), ml: w.ml }))
          if (money.length) row.money = money.map(e => ({ time: hm(new Date(e.date)), type: e.type, amount: e.amount, category: e.category, comment: e.comment, method: e.method }))
        }
        days.push(row)
      }
      return { days, note: Object.keys(hd).length ? "шаги и активность с часов есть только за дни, которые прислал виджет (обычно последние 14)" : "данных с часов нет" }
    }
    case "route_to": {
      const here = await whereAmI()
      if (!here) return { error: "не знаю, где пользователь: разрешите приложению доступ к геопозиции или обновите виджет" }
      try {
        let to = x.to
        const g = await hubPost({ geo: { query: x.to, near: here, km: 60 } }, 30000)
        const best = nearest(here, (g.geo && g.geo.results) || [])
        if (best) to = { lat: best.lat, lng: best.lng }
        const res = await hubPost({ route: { from: here, to, mode: x.mode || "driving" } }, 30000)
        if (!res.route) return { error: "скрипт таблицы старый: разверните новую версию Code.gs" }
        return Object.assign({ place: best ? best.name : x.to, from_location: here.src }, res.route)
      } catch (e) { return { error: String(e.message || e) } }
    }
    case "remind_near": {
      const here = await whereAmI()
      try {
        const g = await hubPost({ geo: { query: x.query, near: here || undefined, km: 60 } }, 30000)
        if (!g.geo) return { error: "скрипт таблицы старый: разверните новую версию Code.gs" }
        let pts = (g.geo.results || []).map(r => ({ name: r.name, lat: r.lat, lng: r.lng }))
        if (here) pts = pts.filter(p => distM(here, p) < 80000)
        if (!pts.length) return { error: `«${x.query}» не нашлось рядом — уточните адрес или район` }
        const p = upsert("places", { id: uid("p"), date: Date.now(), title: x.title, query: x.query, points: pts.slice(0, 8), radius: Math.round(+x.radius_m || 1500), done: false })
        return { ok: true, id: p.id, points: p.points.map(q => q.name + (here ? ` (${Math.round(distM(here, q) / 100) / 10} км от вас)` : "")),
          note: "напомнит виджет, когда окажетесь в радиусе; проверка примерно раз в 15 минут" }
      } catch (e) { return { error: String(e.message || e) } }
    }
    case "list_places":
      return { places: live(D.places).map(p => ({ id: p.id, title: p.title, query: p.query, radius_m: p.radius, done: !!p.done, fired: p.firedAt ? iso(new Date(p.firedAt)) : null })) }
    case "mail_search": case "mail_read": case "mail_send": case "mail_reply": case "mail_draft": case "mail_modify": {
      const action = name.slice(5)
      if (action === "send" && !(await chatConfirm(`Отправить письмо?\nКому: ${x.to}${x.cc ? `\nКопия: ${x.cc}` : ""}\nТема: ${x.subject}\n\n${x.body}`)))
        return { cancelled: "пользователь не стал отправлять — спроси, что поправить" }
      if (action === "reply" && !(await chatConfirm(`Ответить${x.all ? " всем" : ""}?\n\n${x.body}`)))
        return { cancelled: "пользователь не стал отправлять — спроси, что поправить" }
      if (action === "modify" && (x.op === "trash" || x.op === "spam") && !(await chatConfirm(`${x.op === "trash" ? "Удалить в корзину" : "Отправить в спам"} ${[].concat(x.ids || []).length} ${plural([].concat(x.ids || []).length, "цепочку", "цепочки", "цепочек")} писем?`)))
        return { cancelled: "пользователь отказался" }
      try {
        const res = await hubPost({ mail: Object.assign({ action }, x) }, 45000)
        return res.mail || { error: "скрипт таблицы старый: разверните новую версию Code.gs, где есть почта" }
      } catch (e) { return { error: String(e.message || e) } }
    }
    case "plan_day":
      return planDay(x.items || [])
    case "where_was_i": {
      const t = parseIso(x.time)
      if (!t) return { error: "время в формате YYYY-MM-DDTHH:MM" }
      const pts = live(D.locs).filter(p => p.lat != null).sort((a, b) => Math.abs(a.date - t) - Math.abs(b.date - t))
      if (!pts.length) return { error: "истории мест пока нет: она собирается виджетом (нужен доступ Scriptable к геопозиции «При использовании приложения или виджетов»)" }
      const p = pts[0], off = Math.round((p.date - t) / 60000)
      const out = { point_time: iso(new Date(p.date)).replace("T", " "), minutes_from_payment: off, lat: p.lat, lng: p.lng, link: `https://maps.google.com/?q=${p.lat},${p.lng}` }
      if (Math.abs(off) > 90) out.note = `ближайшая точка в ${Math.abs(Math.round(off / 60))} ч от платежа — место приблизительное`
      try { const g = await hubPost({ geo: { lat: p.lat, lng: p.lng } }, 20000); if (g.geo && g.geo.address) out.address = g.geo.address } catch (e) {}
      return out
    }
    case "remember": {
      const t = String(x.text || "").trim()
      if (!t) return { error: "пустой факт" }
      const dup = memFacts().find(f => f.text.toLowerCase() === t.toLowerCase())
      if (dup) return { ok: true, id: dup.id, note: "уже помню" }
      const f = upsert("memory", { id: uid("k"), date: Date.now(), kind: "fact", text: t.slice(0, 500) })
      return { ok: true, id: f.id }
    }
    case "forget": {
      if (!live(D.memory).some(f => f.id === x.id)) return { error: "нет такого факта" }
      remove("memory", x.id)
      return { ok: true }
    }
    case "search_chats":
      return searchChats(x.query, x.from, x.to)
    case "delete_record": {
      const list = D[x.kind]
      if (!Array.isArray(list)) return { error: "kind: water, food или workouts" }
      const ids = [].concat(x.ids || []).map(String), have = new Set(live(list).map(e => e.id))
      const gone = ids.filter(id => have.has(id)), missing = ids.filter(id => !have.has(id))
      if (!gone.length) return { error: "записи не найдены", not_found: missing }
      const recs = live(list).filter(e => gone.includes(e.id)), what = { water: "воды", food: "еды", workouts: "тренировок" }[x.kind]
      const desc = x.kind === "water" ? `${recs.reduce((a, w) => a + (+w.ml || 0), 0)} мл` : recs.slice(0, 5).map(e => e.title).join(", ")
      if (!(await chatConfirm(`Удалить ${gone.length} ${gone.length === 1 ? "запись" : gone.length < 5 ? "записи" : "записей"} ${what}? (${desc})`)))
        return { cancelled: "пользователь отказался удалять" }
      gone.forEach(id => remove(x.kind, id))
      if (gone.length) render()
      return { ok: gone.length > 0, deleted: gone.length, not_found: missing, today_water_ml: x.kind === "water" ? waterToday() : undefined }
    }
    case "delete_place": {
      if (!live(D.places).some(p => p.id === x.id)) return { error: "нет такого напоминания" }
      remove("places", x.id)
      return { ok: true }
    }
    case "read_sheet": {
      try {
        const res = await hubPost({ read: { sheet: x.sheet || "", from: x.from || "", to: x.to || "", limit: x.limit || 200 } }, 45000)
        return res.read || { error: "скрипт таблицы старый: разверните новую версию Code.gs" }
      } catch (e) { return { error: String(e.message || e) } }
    }
    case "delete_money": {
      const e = live(D.money).find(z => z.id === x.id)
      if (!e) return { error: "операция не найдена" }
      if (!(await chatConfirm(`Удалить операцию?\n${e.type === "expense" ? "−" : "+"}${core.money(e.amount)} · ${e.category}${e.comment ? " · " + e.comment : ""}`)))
        return { cancelled: "пользователь отказался удалять" }
      remove("money", x.id)
      return { ok: true }
    }
    case "add_food": {
      if (!(x.kcal > 0)) return { error: "калории должны быть больше нуля" }
      const m = addFood({ title: x.title, kcal: x.kcal, protein: Math.round(x.protein || 0), fat: Math.round(x.fat || 0), carbs: Math.round(x.carbs || 0) })
      return { ok: true, id: m.id }
    }
    case "add_water": {
      if (!(x.ml > 0)) return { error: "объём должен быть больше нуля" }
      const now = Date.now()
      upsert("water", { id: `w${now}`, date: now, ml: Math.round(x.ml) })
      return { ok: true, today_ml: waterToday() }
    }
    case "add_workout": {
      if (!(x.kcal > 0)) return { error: "калории должны быть больше нуля" }
      const when = parseIso(x.date) || new Date(), now = Date.now()
      const w = upsert("workouts", { id: `t${now}-${Math.random().toString(36).slice(2, 6)}`, date: +when, title: x.title, minutes: Math.round(+x.minutes || 0), kcal: Math.round(+x.kcal || 0) })
      return { ok: true, id: w.id }
    }
    case "set_budget": {
      const names = core.CONFIG.categories.expense.map(c => c[0])
      if (!names.includes(x.category)) return { error: `категория должна быть одной из: ${names.join(", ")}` }
      setBudget(x.category, x.limit)
      const s = budgetState(x.category)
      return s ? { ok: true, limit: s.limit, spent_this_month: s.spent, left: s.left } : { ok: true, note: "лимит убран" }
    }
    case "add_recurring": {
      const names = core.CONFIG.categories.expense.map(c => c[0])
      if (!names.includes(x.category)) return { error: `категория должна быть одной из: ${names.join(", ")}` }
      if (!(x.amount > 0) || !(x.day >= 1 && x.day <= 31)) return { error: "нужны сумма > 0 и число месяца 1–31" }
      const r = upsert("recur", { id: uid("p"), date: Date.now(), type: "expense", title: x.title, amount: x.amount, day: Math.round(x.day), method: x.method || "transfer", category: x.category, paid: {} })
      if (x.paid_now) recurPay(r)
      return { ok: true, id: r.id }
    }
    case "pay_recurring": {
      const r = live(D.recur).find(z => z.id === x.id)
      if (!r) return { error: "нет такого платежа" }
      if (recurPaid(r)) return { ok: true, note: "уже отмечен оплаченным в этом месяце" }
      const m = recurPay(r)
      return { ok: true, money_id: m.id }
    }
    case "add_shopping": { const added = shopAdd(x.items || []); return { ok: true, added: added.map(s => s.title), to_buy: shopOpen().map(s => s.title) } }
    case "get_shopping": return { to_buy: shopOpen().map(s => s.title), stores: shopStores().map(p => p.query) }
    case "shop_done": {
      const done = x.done !== false, hit = []
      for (const t of x.items || []) { const s = done ? shopFind(t) : live(D.shop).filter(z => z.done).sort((a, b) => b.doneAt - a.doneAt).find(z => normT(z.title).includes(normT(t))); if (s) { shopToggle(s.id, done); hit.push(s.title) } }
      return hit.length ? { ok: true, marked: hit, to_buy: shopOpen().map(s => s.title) } : { error: "в списке такого нет", to_buy: shopOpen().map(s => s.title) }
    }
    case "add_store": {
      const here = await whereAmI()
      try {
        const g = await hubPost({ geo: { query: x.query, near: here || undefined, km: 60 } }, 30000)
        if (!g.geo) return { error: "скрипт таблицы старый: разверните новую версию Code.gs" }
        let pts = (g.geo.results || []).map(z => ({ name: z.name, lat: z.lat, lng: z.lng }))
        if (here) pts = pts.filter(q => distM(here, q) < 80000)
        if (!pts.length) return { error: `«${x.query}» не нашлось рядом — уточните район` }
        const p = upsert("places", { id: uid("p"), date: Date.now(), title: `🛒 ${x.query}`, query: x.query, points: pts.slice(0, 12), radius: Math.round(+x.radius_m || 400), done: false, shop: true })
        return { ok: true, id: p.id, points: p.points.map(q => q.name), note: "виджет пришлёт список покупок, когда будете рядом (не чаще раза в 3 часа)" }
      } catch (e) { return { error: String(e.message || e) } }
    }
    case "add_kids_item": {
      const days = (x.days || []).map(Number).filter(d => d >= 1 && d <= 7)
      if (!days.length) return { error: "нужны дни недели: 1 — пн … 7 — вс" }
      const k = upsert("kids", { id: uid("c"), date: Date.now(), title: String(x.title).trim(), days, time: /^\d{1,2}:\d\d$/.test(x.time || "") ? x.time.padStart(5, "0") : "", kid: x.kid || "", who: x.who || "", take: x.take || "" })
      return { ok: true, id: k.id, days: days.map(d => WD7[d - 1]).join(", ") }
    }
    case "get_kids": return { items: kidsList().map(k => ({ id: k.id, title: k.title, days: (k.days || []).map(d => WD7[d - 1]).join(", "), time: k.time, kid: k.kid, who: k.who, take: k.take })) }
    case "delete_kids_item": { if (!live(D.kids).some(k => k.id === x.id)) return { error: "нет такого" }; remove("kids", x.id); return { ok: true } }
    case "start_fast": { if (fastNow()) return { error: "голодание уже идёт", since: iso(new Date(fastNow().start)) }; const f = fastStart(x.hours); return { ok: true, hours: f.hours, window_opens: iso(new Date(f.start + f.hours * 3600e3)) } }
    case "stop_fast": { const f = fastStop(); return f ? { ok: true, fasted: durTxt(f.end - f.start) } : { error: "голодание не идёт" } }
    case "add_goal": { const r = goalAdd(x.kind, x.items || [], x.due); if (r.error) return r
      return { ok: true, added: r.added.map(g => g.title), total: r.total, max: GOAL_MAX[x.kind] || undefined, note: r.added.length < (x.items || []).length ? "часть уже есть или места кончились" : undefined } }
    case "get_goals": { const kinds = x.kind ? [x.kind] : Object.keys(GOAL_KIND), out = {}
      for (const k of kinds) out[k] = goalsOf(k).map(g => Object.assign({ id: g.id, title: g.title, done: !!g.done, due: g.due }, g.toMonth ? { moved_to_goals: g.toMonth } : {}, stepsOf(g).length ? { steps: stepsOf(g).map(x => Object.assign({ step: x.t, done: !!x.done }, x.date ? { date: x.date, in_calendar: !!x.cal } : {})) } : {}))
      if (!x.kind || x.kind === "month") out.month_left_from_last = goalsLeft().map(g => g.title)
      return out }
    case "start_pomodoro": { const p = pomoStart(x.title, "", x.minutes); return { ok: true, title: p.title, minutes: p.min, ends: iso(new Date(p.start + p.min * 60e3)), today_done: pomoToday().length } }
    case "stop_pomodoro": { const p = pomoStop(); return p ? { ok: true, title: p.title, completed: !!p.full, today_done: pomoToday().length } : { error: "помидор не идёт" } }
    case "add_chore": { const last = /^\d{4}-\d\d-\d\d$/.test(x.last_done || "") ? +new Date(x.last_done + "T12:00") : undefined
      const c = choreAdd(x.title, x.every_days, last); if (!c) return { error: "нужно название" }
      return { ok: true, id: c.id, title: c.title, every: everyTxt(c.every), next: choreWhen(c) } }
    case "chore_done": { const c = choreFind(x.title); if (!c) return { error: "нет такого дела", have: chores().map(z => z.title) }
      const at = /^\d{4}-\d\d-\d\d$/.test(x.date || "") ? +new Date(x.date + "T12:00") : Date.now(), r = choreDone(c.id, at); return { ok: true, title: r.title, next: choreWhen(r) } }
    case "get_chores": return { items: chores().map(c => ({ id: c.id, title: c.title, every_days: c.every, last_done: c.last ? dayKey(new Date(c.last)) : null, next: choreWhen(c) })) }
    case "delete_chore": { const c = chores().find(z => z.id === x.id); if (!c) return { error: "нет такого" }; remove("goals", c.id); return { ok: true } }
    case "add_list_items": { let l = listFind(x.list); if (!l && x.create !== false) l = listNew(x.list); if (!l) return { error: "нет такого списка", have: myLists().map(z => z.title) }
      const a = listItems(l.id, x.items || []); return { ok: true, list: l.title, added: a.map(z => z.t), total: itemsOf(D.goals.find(z => z.id === l.id)).length } }
    case "list_item_done": { const l = listFind(x.list); if (!l) return { error: "нет такого списка", have: myLists().map(z => z.title) }
      const got = []; for (const t of x.items || []) { const n = normT(t), it = itemsOf(D.goals.find(z => z.id === l.id)), i = it.find(z => normT(z.t) === n) || it.find(z => normT(z.t).includes(n) || n.includes(normT(z.t)))
        if (i) { listItemSet(l.id, i.id, { done: x.done !== false }); got.push(i.t) } }
      return got.length ? { ok: true, marked: got } : { error: "нет таких пунктов", items: itemsOf(l).map(z => z.t) } }
    case "get_lists": return { lists: myLists().map(l => ({ id: l.id, title: l.title, items: itemsOf(l).map(i => ({ item: i.t, done: !!i.done })) })) }
    case "delete_list": { const l = myLists().find(z => z.id === x.id); if (!l) return { error: "нет такого" }; remove("goals", l.id); return { ok: true } }
    case "wish_to_goal": { const w = goalFind(x.wish, "wish"); if (!w) return { error: "нет такого желания", have: goalsOf("wish").map(z => z.title).slice(0, 40) }
      const g = wishToGoal(w.id); return g ? { ok: true, goal: g.title, id: g.id, month: curMonth() } : { error: "не получилось" } }
    case "add_goal_steps": { const g = goalFind(x.goal, "month") || goalFind(x.goal, "dream") || goalFind(x.goal); if (!g) return { error: "не нашёл такую мечту или цель" }
      const a = goalSteps(g.id, x.steps || [], x.dates || []); return { ok: true, goal: g.title, added: a.map(z => z.t), steps: stepsOf(D.goals.find(z => z.id === g.id)).map(z => z.t + (z.date ? ` (${z.date})` : "")) } }
    case "goal_step_done": { const g = goalFind(x.goal, "month") || goalFind(x.goal, "dream") || goalFind(x.goal); if (!g) return { error: "не нашёл такую мечту или цель" }
      const st = stepFind(g, x.step); if (!st) return { error: "нет такого шага", steps: stepsOf(g).map(z => z.t) }
      const g2 = stepSet(g.id, st.id, { done: x.done !== false, doneAt: x.done !== false ? Date.now() : 0 })
      return { ok: true, step: st.t, progress: stepsTxt(g2), all_done: stepsOf(g2).every(z => z.done) } }
    case "goal_done": { const got = []; for (const t of x.items || []) { const g = goalFind(t, x.kind); if (g) { goalToggle(g.id, x.done !== false); got.push(g.title) } }
      return got.length ? { ok: true, marked: got } : { error: "не нашёл такую цель", have: live(D.goals).filter(g => x.kind ? g.kind === x.kind : GOAL_KIND[g.kind]).map(g => g.title).slice(0, 30) } }
    case "delete_goal": { if (!live(D.goals).some(g => g.id === x.id && GOAL_KIND[g.kind])) return { error: "нет такой" }; remove("goals", x.id); return { ok: true } }
    case "set_protein_goal": {
      const n = Math.round(+x.grams)
      if (!(n >= 30 && n <= 400)) return { error: "цель белка — от 30 до 400 г" }
      core.CONFIG.health = Object.assign({}, core.CONFIG.health, { proteinGoal: n })
      if (D.conn) { D.conn.cfg = D.conn.cfg || {}; D.conn.cfg.health = core.CONFIG.health }
      save(); return { ok: true, protein_goal_g: n }
    }
    case "log_weight": {
      if (!(x.kg > 20 && x.kg < 400)) return { error: "вес в кг" }
      const d = parseIso(x.date); if (d) d.setHours(9, 0, 0, 0)
      logWeight(x.kg, d ? +d : Date.now())
      const w = weights(), month = w.filter(z => z.date > Date.now() - 30 * 864e5)
      return { ok: true, kg: x.kg, change_30d: month.length > 1 ? Math.round((month[month.length - 1].kg - month[0].kg) * 10) / 10 : null }
    }
    case "mark_habit": {
      let h = findHabit(x.habit)
      if (!h && x.create) h = upsert("habits", { id: uid("h"), date: Date.now(), title: String(x.habit).trim(), ico: x.bad ? "ban" : "check", emoji: x.bad ? "🚫" : "✓", bad: !!x.bad })
      if (!h) return { error: "нет такой привычки", habits: habitList().map(z => z.title) }
      const d = parseIso(x.day) || new Date()
      habitToggle(h, d, x.done !== false)
      return { ok: true, habit: h.title, day: dayKey(d), done: x.done !== false, streak_days: habitStreak(h) }
    }
    case "get_health": {
      const d = dayHealth()
      const fs = fastNow()
      return { eaten_kcal: d.kcal, protein: d.protein, protein_goal_g: proteinGoal(), fasting: fs ? { since: iso(new Date(fs.start)), hours: fs.hours, window_opens: iso(new Date(fs.start + fs.hours * 3600e3)) } : null, fat: d.fat, carbs: d.carbs, meals: d.food.map(m => ({ id: m.id, time: hm(new Date(m.date)), title: m.title, kcal: m.kcal })),
        water_ml: d.water, water_goal_ml: H().waterGoal, water: today(D.water).map(w => ({ id: w.id, time: hm(new Date(w.date)), ml: w.ml })),
        workouts: d.workouts.map(w => ({ id: w.id, title: w.title, minutes: w.minutes, kcal: w.kcal })),
        watch: d.watch || "нет данных с часов за сегодня",
        weight: (w => w ? { kg: w.kg, date: dayKey(new Date(w.date)) } : null)(weights().pop()),
        habits: habitList().map(h => ({ title: h.title, kind: h.bad ? "бросает" : "делает", done_today: habitOn(h, new Date()), streak_days: habitStreak(h) })) }
    }
    case "claude_code": {
      const r = routes().find(z => z.name === x.route)
      if (!r) return { error: `нет маршрута «${x.route}»` }
      try {
        const id = "cc" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
        const title = String(x.title || x.task).replace(/\s+/g, " ").trim().slice(0, 60)
        const res = await hubPost({ fire: { id, title, route: r.name, url: r.url, token: r.token, text: x.task } }, 45000)
        if (res.fire && res.fire.session_url) {
          ccSet({ id: res.fire.id || id, title, route: r.name, url: res.fire.session_url, at: Date.now(), state: "run" })
          if (res.fire.id) chatCC.push(res.fire.id); else chatLinks.push(res.fire.session_url)   // старый скрипт таблицы итог не вернёт — только ссылка
          return { ok: true, session_url: res.fire.session_url, result: res.fire.id ? "итог сам придёт в этот чат, когда сессия закончит" : "итог останется в сессии" }
        }
        return { error: (res.fire && res.fire.error) || "таблица не запустила задачу (обновите скрипт таблицы)" }
      } catch (e) { return { error: String(e.message || e) } }
    }
    case "ask_user": {
      const answer = await chatAsk(x.question, (x.options || []).slice(0, 5))
      return { answer: answer == null ? "(пользователь не ответил — ничего не делай и коротко подтверди отмену)" : answer }
    }
  }
  return { error: `неизвестный инструмент ${name}` }
}
function cancelOp(id) { D.ops = D.ops.filter(o => !(o.id === id && o.state === "local")); save() }

// Как в виджете: с 9 до 21, больше 3 часов без записи воды — подсказка
function waterGap(h, now = new Date()) {
  if (now.getHours() < 9 || now.getHours() >= 21 || h.water >= H().waterGoal) return 0
  const start = new Date(now).setHours(9, 0, 0, 0)
  const last = Math.max(start, ...today(D.water).map(w => w.date || 0))
  const gap = (now - last) / 3600e3
  return gap >= 3 ? Math.floor(gap) : 0
}
// Активность с часов за прошлый день — из истории, которую присылает виджет (там тренировки уже учтены)
const histHealth = d => ((D.snap && D.snap.health) || []).find(h => h && h.day === dayKey(d)) || null
const onDay = (list, d) => live(list).filter(x => sameDay(x.date, d)).sort((a, b) => a.date - b.date)
function dayHealth(day = new Date()) {
  const d0 = sod(day), isToday = sameDay(d0, new Date())
  const food = onDay(D.food, d0), workouts = onDay(D.workouts, d0), waterList = onDay(D.water, d0)
  const sum = k => food.reduce((s, m) => s + (+m[k] || 0), 0)
  const wk = { kcal: workouts.reduce((s, w) => s + (w.kcal || 0), 0), min: workouts.reduce((s, w) => s + (w.minutes || 0), 0) }
  const base = { day: d0, isToday, food, kcal: sum("kcal"), protein: sum("protein"), fat: sum("fat"), carbs: sum("carbs"),
    water: waterList.reduce((s, w) => s + (w.ml || 0), 0), waterList, workouts }
  if (isToday) {
    const v = iphone(), watch = v.watch ? Object.assign({}, v.watch) : null
    return Object.assign(base, { watch, active: (watch && watch.active || 0) + wk.kcal, exercise: (watch && watch.exercise || 0) + wk.min, steps: watch && watch.steps })
  }
  const h = histHealth(d0)
  return Object.assign(base, { watch: h, hist: true, active: h && h.active != null ? h.active : wk.kcal, exercise: h && h.exercise != null ? h.exercise : wk.min,
    steps: h && h.steps != null ? h.steps : null })
}

function agentSystem() {
  const now = new Date(), c = core.CONFIG
  const cats = t => c.categories[t].map(x => x[0]).join(", ")
  const cals = c.calendars || []
  return `Ты — личный ассистент в приложении «Мой день» на iPhone. Тебя зовут ${iziName()}; ${iziG("о себе говори в мужском роде («я записал», «я понял»)", "ты девушка, о себе говори в женском роде («я записала», «я поняла»)")}. Пользователь часто говорит голосом по-русски; речь распознаётся с ошибками («падал», «падлу» = «падел»), восстанавливай смысл.
Сейчас ${iso(now).replace("T", " ")}, ${DAY_NAMES[now.getDay()].toLowerCase()}. Используй местное время без смещения, формат YYYY-MM-DDTHH:MM.

Как работать:
- Выполняй команду сам с помощью инструментов. Перед изменением или удалением события найди его через get_events (в разумном диапазоне дат), затем используй его id и start как occurrence_start.
- «Перенеси», «сдвинь», «поменяй время» — это update_event существующего события, а не новое событие.
- Повторяющиеся события меняй только в нужное повторение, если пользователь не сказал «все» или «каждую неделю».
- Время без «утра/вечера»: встречи, спорт, свидания, ужины после 6 обычно вечером; созвоны и работа — днём. Если перепутать дорого и неясно — спроси.
- Уточняй через ask_user, только если без ответа нельзя сделать правильно: не названо новое время переноса, несколько подходящих событий, не указан способ оплаты (наличные или перевод). Давай короткие варианты ответа.
- Календарь — Google Календарь пользователя: события создаёшь, переносишь и удаляешь сразу (create_event/update_event/delete_event). Если инструмент ответил, что изменение ушло в очередь виджета, — скажи коротко «внесу при обновлении виджета».
- Про воду НЕ создавай напоминаний (они захламляют список) — о воде напоминай сам: подсказки plan_day в нужное время и вопросы в чате.
- Напоминания живут в IZIDAY, а не в Напоминаниях iPhone: create_reminder сохраняет их в приложении, уведомление в срок и контроль «Выполнил?» — от IZIDAY. Повторяющиеся (каждый день, по будням) — через repeat. В Напоминания iPhone ничего не вноси.
${cals.length ? `- Календари по словам пользователя: ${cals.map(x => `«${x.calendar}» (список напоминаний «${x.list}»)`).join(", ")}.${cals.filter(x => x.hint).map(x => ` ${x.hint} — «${x.calendar}».`).join("")} Если календарь не назван, не указывай его.
` : ""}- Деньги — ${c.currencyIn}. Категории расходов: ${cats("expense")}. Категории доходов: ${cats("income")}.
- Фото или файл от пользователя — сначала пойми, что это, и действуй. Если к вложению есть подпись («это мой обед», «оплатить до пятницы», «это для Оли») — исходи из неё: она важнее догадок по картинке.
  • Еда или блюдо: что это, порция, ккал и БЖУ одной строкой; спроси ask_user «Записать в еду?» [Да, Нет] и при «Да» — add_food.
  • Счёт, инвойс, квитанция к оплате (коммуналка, интернет, аренда, штраф и т. п.): от кого, за что, сумма с валютой, срок оплаты (если есть — и сколько дней осталось), номер счёта/реквизиты кратко. Если есть срок или его можно понять — спроси ask_user «Напомнить об оплате?» [За день до срока, В день срока, Не нужно] и создай create_reminder «Оплатить <от кого> — <сумма>» на 10:00 нужного дня. Счёт ещё не оплачен — расход не записывай.
  • Чек из магазина, кафе или ресторана: где и когда, позиции списком «название — цена» (переведи на русский, оригинал в скобках, если неясно), скидки и сервисный сбор, итог. Затем ask_user «Записать расход <итог>?» [Наличные, Карта / перевод, Не записывать] и add_money с подходящей категорией и коротким комментарием (магазин, 2–3 главных позиции). Дата — из чека, если не сегодня.
  • Другое (документ, скриншот, визитка…): кратко перескажи главное и предложи, что можно сделать (событие, напоминание, расход).
  Отвечай коротко, без лишних вступлений.
- «Этот платёж не вноси / он по работе» про платёж, которого ещё нет в расходах (придёт по карте позже) — сразу skip_card_payment, не проси пользователя напомнить потом.
- Любой вопрос о платеже или переводе (особенно «что это за платёж?» или когда ты сам спрашиваешь о непонятной трате): всегда называй дату и точное время платежа и место, где был пользователь в тот момент, — where_was_i по времени платежа: адрес и ссылка на Google Карты (ссылкой целиком). Если точка далека по времени — так и скажи. Платежи по карте — лист «Карта» (read_sheet), остальные — get_money.
- Почта Gmail пользователя: mail_search → mail_read, ответы mail_reply, новые письма mail_send, черновики mail_draft, разбор mail_modify. Про письма отвечай по сути: от кого, что хотят, срок, что сделать; длинные — пересказывай. Найдёшь в письме встречу, срок оплаты или задачу — предложи событие или напоминание. Пиши письма сам, от первого лица пользователя, коротко и по-деловому; отправка — только когда пользователь попросил отправить или ответить (подтверждение приложение покажет само).
- Раскладка дохода — по плану в процентах (get_money.income_plan): статьи выбирает пользователь в «Деньги → Как раскладываю доход», проценты предлагаешь ты — платежи и копилки по факту, подушка 10% пока нет 6 месяцев расходов, инвестиции около 10%, благотворительность от 3%, на жизнь — остаток, но не меньше обычных трат. Пришёл доход — предложи разложить по плану и коротко назови суммы.
- Деньги 2.0: «сколько можно потратить» — get_money.can_spend_today (после платежей и копилок). Копилки — add_jar и jar_deposit; долги и кредиты — add_debt. Сумма в рублях или долларах — add_money с currency (пересчитается по курсу). Общая с женой трата — shared=true. Итоги по деньгам за неделю — в тоне, который выбрал пользователь: ${{ praise: "похвали (тепло, с юмором)", roast: "пожури (по-дружески строго)", dry: "сухо, только цифры" }[MNY().tone]}.
- Лимиты расходов по категориям — set_budget; при записи расхода, если инструмент вернул budget.warn, коротко скажи, сколько осталось. Регулярные платежи (аренда, подписки) — add_recurring и pay_recurring; список и лимиты — в get_money.
- Привычки (зарядка, чтение; «бросаю пить/курить») — mark_habit; «сегодня не пил» для привычки «бросаю» — done=false. Вес («вешу 78,5») — log_weight. Серии и вес — в get_health.
- «Съел», «выпил стакан воды» — add_food и add_water. «Удали лишнюю воду/еду/тренировку» — найди id через get_health (или get_history с details) и delete_record. На вопросы о калориях, шагах и воде смотри get_health.
- Тренировка без часов («проплыл бассейн 10 раз», «час падела, часы забыл») — add_workout. Вес пользователя ${H().weight || 80} кг. Скажи, сколько ккал и минут записал.
- Если пользователь спрашивает (что у меня завтра, сколько потратил), посмотри данные и ответь.
- У тебя есть доступ ко всем данным пользователя: Google Календарь, напоминания IZIDAY, деньги (и платежи по карте), еда, вода, тренировки, шаги и активность с часов — за сегодня и за прошлые дни.
  История по дням — get_history; любой лист таблицы виджета целиком — read_sheet.
- «Сколько ехать до …», «далеко ли …» — route_to: ответь минутами и километрами (если есть minutes_in_traffic — с учётом пробок).
- «Напомни, когда буду рядом с …», «напомни заехать в …» — remind_near. Скажи, какие точки нашлись, и что напомнит виджет при проезде рядом. Не говори, что данных нет, пока не посмотрел. Замечай закономерности (недобор воды, перерасход, мало шагов) и говори о них, когда к месту.
- Удаление и перенос пользователь подтверждает сам — не спрашивай отдельно «точно удалить?» или «точно перенести?».`
}
// ── Помощник ведёт день: план подсказок → уведомления от виджета ──
function planDay(items) {
  const now = Date.now(), end = +addDays(sod(new Date()), 1)
  live(D.nudges).filter(n => n.date > now && n.date < end && !String(n.id).startsWith("pq")).forEach(n => remove("nudges", n.id))   // pq… — конец помидора, не трогаем
  const ok = []
  for (const it of items.slice(0, 14)) {
    const t = parseIso(it.time)
    if (!t || +t <= now || +t >= end || !String(it.text || "").trim()) continue
    ok.push(upsert("nudges", { id: uid("n"), date: +t, text: String(it.text).trim().slice(0, 240) }))
  }
  D.planDay = dayKey(new Date()); save()
  return { ok: true, planned: ok.map(n => ({ time: hm(new Date(n.date)), text: n.text })), note: "уведомления поставит виджет при следующем обновлении (обычно до 15 минут)" }
}
// Раз в день (при первом открытии после 6:00) помощник сам составляет план подсказок на день
let planBusy = false
async function autoPlan() {
  const now = new Date()
  if (planBusy || !aiKey() || now.getHours() < 6 || now.getHours() >= 21 || D.planDay === dayKey(now)) return
  planBusy = true
  try {
    const sys = chatSystem() + `

Сейчас ты сам, без запроса, планируешь день пользователя. Посмотри календарь и напоминания на сегодня, еду и воду, активность и вчерашний день (get_history), память.
Составь через plan_day 4–8 подсказок на оставшуюся часть дня: вода (с учётом выпитого и дел, не во время встреч), еда (если обычно пропускает — напомни), подготовка к важным встречам и дорога (за 30–60 мин), движение и шаги, одна идея или мысль дня по его целям из памяти, вечером — короткий итог. Не дублируй уведомления о встречах — они уже есть. Пиши тепло и коротко, на «ты»/«вы» — как пользователь привык. Ответь одной строкой, что запланировал.`
    const msgs = [{ role: "user", content: `[${hm(now)}] Спланируй мне сегодняшний день подсказками.` }]
    const tools = chatTools().filter(t => /^(get_|plan_day|list_places|read_sheet|mail_search|search_chats)/.test(t.name))
    const r = await agentTurn(msgs, sys, tools)
    if (D.planDay === dayKey(now) && r) { D.chat.push({ role: "assistant", text: `🗓 ${r}`, at: Date.now() }); save(false); if (tab === "chat") renderChat() }
  } catch (e) {} finally { planBusy = false }
}

// ── Память помощника: факты о человеке и сводки прошлых разговоров (лист «Память помощника» в таблице) ──
const memFacts = () => live(D.memory).filter(m => m.kind === "fact").sort((a, b) => a.date - b.date)
const memChats = () => live(D.memory).filter(m => m.kind === "chat").sort((a, b) => a.date - b.date)
const GAP = 3 * 3600e3   // пауза дольше трёх часов — новый разговор
function memoryBlock() {
  const f = memFacts().slice(-120), c = memChats().slice(-15)
  const d = t => { const x = new Date(t); return `${x.getDate()} ${MON_GEN[x.getMonth()].slice(0, 3)}` }
  return `
Твоя память о пользователе (храни и пополняй: remember / forget):
${f.length ? f.map(m => `- ${m.text} [${m.id}]`).join("\n") : "- пока пусто"}
Прошлые разговоры, кратко (подробности — search_chats):
${c.length ? c.map(m => `- ${d(m.date)}: ${m.text}`).join("\n") : "- пока нет"}`
}
const words = q => String(q || "").toLowerCase().replace(/ё/g, "е").split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2).map(w => w.length > 5 ? w.slice(0, -2) : w)   // грубая основа слова: «падела» ≈ «падел»
function searchChats(query, from, to) {
  const ws = words(query), f = parseIso(from), t = to ? +addDays(sod(parseIso(to) || new Date()), 1) : Infinity
  if (!ws.length) return { error: "нужны слова для поиска" }
  const all = [...D.chatArchive, ...D.chat].filter(m => !m.local && m.text)
  const score = txt => { const l = String(txt).toLowerCase().replace(/ё/g, "е"); return ws.reduce((s, w) => s + (l.includes(w) ? 1 : 0), 0) }
  const hits = []
  all.forEach((m, i) => { if ((f && m.at < +f) || m.at >= t) return; const sc = score(m.prompt || m.text); if (sc) hits.push({ sc, i }) })
  hits.sort((a, b) => b.sc - a.sc || all[b.i].at - all[a.i].at)
  const shown = new Set(), out = []
  for (const h of hits.slice(0, 12)) for (const j of [h.i - 1, h.i, h.i + 1]) {
    const m = all[j]; if (!m || shown.has(j) || m.local) continue; shown.add(j)
    out.push({ at: iso(new Date(m.at)).replace("T", " "), who: m.role === "user" ? "пользователь" : "ты", text: String(m.text).slice(0, 400) })
  }
  out.sort((a, b) => a.at < b.at ? -1 : 1)
  const sums = memChats().filter(m => score(m.text)).slice(-8).map(m => ({ date: iso(new Date(m.date)).slice(0, 10), summary: m.text }))
  return { messages: out, summaries: sums, note: out.length || sums.length ? undefined : "ничего не нашлось — попробуй другие слова" }
}
// Закончившийся разговор (пауза > 3 ч или «Очистить») — коротко в память и новые факты. Дешёвая быстрая модель, в фоне.
const MEM_SCHEMA = { type: "object", additionalProperties: false, required: ["summary", "facts", "outdated"], properties: {
  summary: { type: "string", description: "1–3 предложения: о чём говорили, что решили, что сделали, что осталось открытым" },
  facts: { type: "array", items: { type: "string" }, description: "Новые устойчивые факты о пользователе, которых ещё нет в памяти. Пусто, если нет." },
  outdated: { type: "array", items: { type: "string" }, description: "id фактов из памяти, которые этот разговор опроверг или заменил" } } }
let memBusy = false
async function memorize(force) {
  if (memBusy || !aiKey()) return
  const done = D.memAt || 0
  const msgs = [...D.chatArchive, ...D.chat].filter(m => m.at > done && !m.local && m.text)
  if (!msgs.length) return
  const lastAt = msgs[msgs.length - 1].at
  if (!force && Date.now() - lastAt < GAP) return
  if (msgs.length < 2 && !force) { D.memAt = lastAt; return save(false) }
  memBusy = true
  try {
    const conv = msgs.slice(-80).map(m => `${m.role === "user" ? "Пользователь" : "Помощник"} (${iso(new Date(m.at)).replace("T", " ")}): ${String(m.text).slice(0, 1200)}`).join("\n")
    const res = await claude({ max_tokens: 3000, output_config: { format: { type: "json_schema", schema: MEM_SCHEMA } },
      system: "Ты ведёшь долговременную память личного помощника. По разговору составь краткую сводку и выпиши только новые устойчивые факты о пользователе " +
        "(люди, предпочтения, цели, планы, здоровье, работа, договорённости, даты). Не записывай разовые мелочи (что выпил воды, разовую покупку). Пиши по-русски.",
      messages: [{ role: "user", content: `Память сейчас:\n${memFacts().map(f => `- ${f.text} [${f.id}]`).join("\n") || "- пусто"}\n\nРазговор:\n${conv}` }] }, 60000, { model: "claude-haiku-5-5" })
    const txt = res && res.content && (res.content.find(c => c.type === "text") || {}).text
    if (!txt) return
    const j = JSON.parse(txt)
    if (j.summary) upsert("memory", { id: uid("c"), date: msgs[0].at, kind: "chat", text: String(j.summary).slice(0, 600) })
    for (const t of j.facts || []) if (t && !memFacts().some(f => f.text.toLowerCase() === t.toLowerCase())) upsert("memory", { id: uid("k"), date: Date.now(), kind: "fact", text: String(t).slice(0, 500) })
    for (const id of j.outdated || []) if (memFacts().some(f => f.id === id)) remove("memory", id)
    D.memAt = lastAt
    save()
  } catch (e) { /* попробуем при следующем сообщении */ } finally { memBusy = false }
}

function chatSystem() {
  const r = routes()
  return agentSystem() + memoryBlock() + `

Это постоянный чат. Ты — личный помощник, секретарь и друг пользователя: помогаешь в любом деле — в жизни и в работе.
- Дела (встречи, напоминания, деньги, еда, вода, тренировки) делай сам инструментами, потом коротко скажи, что сделал.
- Когда просят совета или делятся чем-то личным — отвечай как умный друг: честно, по существу, с заботой, думай на годы вперёд, а не только о сегодняшнем дне. Можно мягко не согласиться.
- Длина ответа: обычно 1–6 строк; совет или разбор — сколько нужно, но без воды. Без Markdown-заголовков и таблиц, короткие списки можно.
- В начале сообщений пользователя в квадратных скобках время, когда оно отправлено; сам время в скобках не пиши.
- Понимай с полуслова: учитывай память, прошлые разговоры и данные (календарь, деньги, здоровье). Связывай новое с прошлым («в прошлый раз вы говорили…»), если это к месту. Если пользователь ссылается на прошлое, а в памяти нет — поищи search_chats, прежде чем переспрашивать.
- Узнал о пользователе что-то устойчивое (люди, предпочтения, цели, планы, договорённости) — запомни через remember, не спрашивая разрешения и не объявляя об этом. Попросят забыть — forget.
- Голосовые сообщения распознаются с ошибками: восстанавливай смысл по контексту и памяти; уточняй, только если цена ошибки высока.
- Перед ответом подумай, что человек на самом деле хочет и что ему пригодится дальше; можно одним предложением предложить следующий шаг.
- Ты ведёшь день пользователя: по календарю, здоровью, еде, воде и целям. Подсказки-уведомления на iPhone ставишь через plan_day (утром план составляется сам). Попросят «напоминай/подсказывай/веди меня» — обнови план.
- Напоминания контролируешь ты: невыполненное в срок — спрашиваешь, сделал ли, напоминаешь снова, предлагаешь перенести и выясняешь причину (уведомления «Выполнил?» приходят от IZIDAY). Если пользователь пишет, почему не сделал — посочувствуй коротко, перенеси через update_reminder на реальное время по календарю и запомни повторяющуюся причину.
- Учись: если пользователь поправил тебя, сказал «не так», «не надо», «лучше…», или видно его привычку — запомни это как предпочтение через remember («Предпочитает…», «Не любит…») и дальше делай так.
${r.length ? `- Сложную задачу, которую не решить здесь за пару сообщений (код, разбор документов, исследование, подготовка текста или плана, многошаговая работа), передай через claude_code. Рабочую — в маршрут нужного рабочего проекта по его описанию; личную, не связанную с работой, — в маршрут для личных задач. Если неясно, что именно нужно, сначала коротко уточни. После передачи скажи одной строкой, куда передал; ссылка на сессию покажется сама.`
  : "- Передавать задачи в Claude Code пока нельзя: маршруты не подключены (в виджете: меню → 🤖 Задачи в Claude Code, потом подключить приложение заново). Сложную задачу честно назови сложной и предложи подключить."}` + iziStyle()
}
const BRIEFS = {
  morning: { label: "☀️ Утренняя сводка", prompt: "Сделай утреннюю сводку на сегодня. Посмотри события и напоминания на сегодня (и просроченные), " +
    "траты за месяц (и лимиты, если близко к превышению), регулярные платежи к оплате в ближайшие дни, важные непрочитанные письма за сутки (mail_search «is:unread newer_than:1d -category:promotions -category:social», если почта доступна). Расскажи: что сегодня по порядку со временем, что важно не забыть, что просрочено; сколько потрачено в этом месяце. " +
    "В конце одна короткая дружеская мысль или совет на день. Ничего не меняй." },
  evening: { label: "🌙 Вечерняя сводка", prompt: "Сделай вечернюю сводку за сегодня. Посмотри события и напоминания (вместе с выполненными), " +
    "деньги и еду с водой и активностью за сегодня, события на завтра. Расскажи: что сделано, что не сделано; сколько потрачено сегодня " +
    "(итог и главные траты); сколько съедено ккал и БЖУ, вода, активность; что завтра. Если есть невыполненные напоминания на сегодня " +
    "или просроченные — спроси через ask_user, перенести ли их на завтра (варианты: «Перенести всё на завтра», «Выберу сам», «Оставить как есть») " +
    "и сделай, как ответят; время у перенесённых сохраняй, без времени — на завтра. " +
    "Обязательно разбери расходы за сегодня (и вчера, если не разбирали): каждую трату с категорией «Другое» или с непонятным комментарием (платёж по карте без описания, перевод без пояснения) " +
    "по одной спроси через ask_user, на что она была, — с 3–4 самыми вероятными категориями как вариантами; ответ запиши через update_money (категория и короткий комментарий)." },
}
function chatContext() {
  const out = []
  const msgs = D.chat.slice(-40), cur = msgs[msgs.length - 1]
  for (const m of msgs) {
    let content = m.prompt || m.text
    if (!content || m.local) continue
    // старое вложение: самого файла в запросе уже нет — иначе Изи думает, что его прислали снова, и просит повторить
    if (m !== cur && m.prompt && m.prompt.startsWith(SCAN_PROMPT)) content = `(Раньше прислал вложение «${m.text}» — оно уже разобрано в ответе ниже; файла здесь больше нет, повторно не проси.)`
    if (m.role === "user") { const d = new Date(m.at || Date.now()); content = `[${d.getDate()} ${MON_GEN[d.getMonth()].slice(0, 3)} ${hm(d)}] ${content}` }
    const last = out[out.length - 1]
    if (last && last.role === m.role) last.content += "\n\n" + content
    else out.push({ role: m.role, content })
  }
  while (out.length && out[0].role !== "user") out.shift()
  return out
}
const dropThinking = messages => messages.forEach(m => {
  if (m.role === "assistant" && Array.isArray(m.content)) m.content = m.content.filter(c => c.type !== "thinking" && c.type !== "redacted_thinking")
})
// Один ход помощника: Claude думает и вызывает инструменты, пока не даст ответ
let chatStopCtl = null
// Что помощник делает прямо сейчас — подпись у «…» в чате
const TOOL_STATUS = { get_events: "смотрю календарь", create_event: "создаю событие", update_event: "переношу событие", delete_event: "удаляю событие",
  get_reminders: "смотрю напоминания", create_reminder: "ставлю напоминание", update_reminder: "меняю напоминание", delete_reminder: "удаляю напоминание",
  add_money: "записываю расход", add_jar: "завожу копилку", jar_deposit: "откладываю в копилку", add_debt: "записываю долг", get_money: "смотрю деньги", delete_money: "удаляю операцию", set_budget: "ставлю лимит", add_recurring: "добавляю платёж", pay_recurring: "отмечаю оплату",
  add_food: "записываю еду", add_water: "записываю воду", add_workout: "записываю тренировку", get_health: "смотрю здоровье", get_history: "смотрю историю",
  log_weight: "записываю вес", mark_habit: "отмечаю привычку", read_sheet: "читаю таблицу", route_to: "считаю дорогу", remind_near: "ищу места", where_was_i: "смотрю, где вы были",
  mail_search: "ищу в почте", mail_read: "читаю письмо", mail_send: "отправляю письмо", mail_reply: "отвечаю на письмо", mail_draft: "сохраняю черновик", mail_modify: "разбираю почту",
  remember: "запоминаю", search_chats: "вспоминаю прошлые разговоры", plan_day: "составляю план дня", claude_code: "передаю задачу в Claude Code", delete_record: "удаляю запись" }
let chatStatus = "", chatStatusAt = 0
function setStatus(s) {
  chatStatus = s; chatStatusAt = Date.now()
  const el = $(".typing .st")
  if (el) el.textContent = s
  else if (tab === "chat" && chatBusy && !askWait) renderChat()
}
setInterval(() => {   // долгое ожидание — показать, сколько уже идёт
  const el = $(".typing .st")
  if (el && chatStatus) { const sec = Math.round((Date.now() - chatStatusAt) / 1000); el.textContent = chatStatus + (sec >= 8 ? ` · ${sec} с` : "") }
}, 1000)
async function agentTurn(messages, system, tools) {
  const stopSig = chatStopCtl && chatStopCtl.signal
  // Кэш: описание инструментов одинаковое всегда, а внутри хода каждый шаг повторяет предыдущие — повтор стоит в 10 раз дешевле
  const ctools = tools.map((t, i) => i === tools.length - 1 ? Object.assign({}, t, { cache_control: { type: "ephemeral" } }) : t)
  const ask = () => claude({ max_tokens: 16000, system, tools: ctools, messages, output_config: { effort: "high" }, cache_control: { type: "ephemeral" } }, 150000, { smart: true, model: CHAT_MODEL, signal: stopSig })
  for (let step = 0; step < 14; step++) {
    let res
    setStatus(step ? "готовлю ответ…" : "думаю…")
    try {
      res = await ask()
      if (res && res.error && /thinking/i.test(res.error.message || "")) { dropThinking(messages); res = await ask() }
    } catch (e) { if (stopSig && stopSig.aborted) return null; return `Нет связи с Claude: ${e.message || e}` }
    if (!res || res.error) return `Claude ответил ошибкой: ${res && res.error ? res.error.message || res.error.type : "пустой ответ"}`
    messages.push({ role: "assistant", content: res.content })
    const uses = (res.content || []).filter(c => c.type === "tool_use")
    if (res.stop_reason === "refusal") return "Не могу с этим помочь — попробуйте сформулировать иначе."
    if (!uses.length || res.stop_reason !== "tool_use") return (res.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim() || "Готово."
    const results = []
    if (stopSig && stopSig.aborted) return null
    for (const u of uses) {
      let out
      setStatus((TOOL_STATUS[u.name] || "работаю") + "…")
      try { out = await runTool(u.name, u.input || {}) } catch (e) { out = { error: String(e.message || e) } }
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) })
    }
    messages.push({ role: "user", content: results })
  }
  return "Не удалось закончить — попробуйте сформулировать проще."
}

let chatBusy = false, chatLinks = [], chatCC = [], askWait = null
async function chatSend(text, opts = {}) {
  text = String(text || "").trim()
  if (!text && !(chatAtt && !opts.attach && !askWait)) return
  // ответ на вопрос помощника (ask_user или подтверждение)
  if (askWait) { const w = askWait; askWait = null; setBusyUI(); D.chat.push({ role: "user", text, at: Date.now(), voice: !!opts.voice, local: true }); save(false); renderChat(); w(text); return }
  if (chatBusy) { toast(`${iziName()} ещё отвечает…`); return }
  memorize()
  if (!aiKey()) { setTab("more"); return ui.info("Нужен ключ Claude", "Здесь откроется «Ключ Claude» → «Подключить»: три шага, около двух минут. Если вы в семье, где включён общий ключ, он подключится сам.") }
  let staged = null
  if (chatAtt && !opts.attach) {   // фото или файл ждали подписи — уходят вместе с этим сообщением
    staged = chatAtt; chatAtt = null; attTray()
    const c = attCaption(staged, text, opts.voice)
    opts = Object.assign({}, opts, { attach: staged.att, label: c.show, caption: text })
    text = c.prompt
  }
  const item = { role: "user", text: opts.label || text, prompt: opts.label ? text : undefined, at: Date.now(), voice: !!opts.voice, thumb: opts.attach && opts.attach.thumb || undefined }
  D.chat.push(item)
  chatBusy = true
  chatLinks = []
  chatCC = []
  chatDraft = null
  save(false)
  if (tab !== "chat") setTab("chat"); else renderChat()
  let reply
  const ctx = chatContext()
  if (opts.attach && ctx.length) {   // само вложение уходит только в этот запрос; в истории остаются миниатюра и ответ помощника
    const a = opts.attach, last = ctx[ctx.length - 1]
    last.content = [{ type: a.type, source: { type: "base64", media_type: a.media_type, data: a.data } }, { type: "text", text: last.content }]
  }
  chatStopCtl = new AbortController()
  setBusyUI(true)
  try { reply = await agentTurn(ctx, chatSystem(), chatTools()) } catch (e) { reply = `Ошибка: ${e.message || e}` }
  const stopped = chatStopCtl.signal.aborted
  chatStopCtl = null
  chatBusy = false
  setBusyUI(false)
  if (stopped && TALK) { const i = D.chat.lastIndexOf(item); if (i >= 0) D.chat.splice(i); save(false); return talkListen() }
  if (stopped) {   // «Стоп»: вопрос возвращается в строку ввода — поправить и отправить заново
    const i = D.chat.lastIndexOf(item)
    if (i >= 0) D.chat.splice(i)
    save(false); if (tab === "chat") renderChat()
    const inp = $("#chat-in"); if (inp && !opts.attach && !opts.label) { inp.value = text; grow(inp); inp.focus() }
    if (staged) { chatAtt = staged; attTray(); if (inp) { inp.value = opts.caption || ""; grow(inp) } }   // вложение и подпись — обратно над полем
    toast("⏹ Остановлено — поправьте и отправьте")
    return
  }
  D.chat.push({ role: "assistant", text: reply, at: Date.now(), links: chatLinks.slice(), cc: chatCC.length ? chatCC.slice() : undefined, draft: chatDraft || undefined })
  chatDraft = null
  talkHear(reply)
  if (D.chat.length > 200) { D.chatArchive = D.chatArchive.concat(D.chat.slice(0, D.chat.length - 200).map(m => ({ role: m.role, text: m.text, prompt: m.prompt, at: m.at, local: m.local }))).slice(-1500); D.chat = D.chat.slice(-200) }
  D.chat.filter(m => m.thumb).slice(0, -12).forEach(m => { delete m.thumb })   // миниатюры только у последних фото — память телефона
  save(false)
  sync()
  if (tab === "chat") renderChat()
  else toast(`${iziName()} ${iziG("ответил", "ответила")}`)
}
// Кнопка справа от поля: есть текст — ➤; Изи пишет или говорит ответ — рабочий «стоп»; иначе (закончил или ждёт ответа на вопрос) — микрофон «ответить голосом»
function setBusyUI() {
  const b = $(".chat-bar .send"); if (!b) return
  const inp = $("#chat-in"), st = inp && inp.value.trim() ? "send" : chatBusy && !askWait ? "stop" : "mic"
  b.classList.toggle("stop", st === "stop"); b.classList.toggle("mic-on", st === "mic"); b.parentNode.classList.toggle("busy", st !== "send")
  b.innerHTML = st === "stop" ? ICO.stop : st === "mic" ? ICO.mic : ICO.send
  b.setAttribute("aria-label", st === "stop" ? "Остановить ответ" : st === "mic" ? "Ответить голосом" : "Отправить")
}
function chatStop() {
  if (!chatStopCtl) return
  chatStopCtl.abort()
  if (askWait) { const w = askWait; askWait = null; setBusyUI(); w("") }   // помощник ждал ответа на вопрос — отменяем
}
// ✎ у своего сообщения: текст обратно в строку ввода, это сообщение и всё после него убираются
function chatEdit(idx) {
  const m = D.chat[idx]
  if (!m || m.role !== "user") return
  if (chatBusy) chatStop()
  const t = m.text
  setTimeout(() => {
    const j = D.chat.indexOf(m); if (j >= 0) D.chat.splice(j)
    save(false); renderChat()
    const inp = $("#chat-in"); if (inp) { inp.value = t; grow(inp); inp.focus() }
  }, chatBusy ? 50 : 0)
}
// Вопрос помощника прямо в чате: варианты кнопками, можно ответить голосом или текстом
function chatAsk(question, options) {
  return new Promise(res => {
    D.chat.push({ role: "assistant", text: question, at: Date.now(), opts: options, local: true })
    save(false)
    talkHear(question, options)
    askWait = a => res(a)
    if (tab === "chat") renderChat(); else setTab("chat")
    setBusyUI()
  })
}
async function chatConfirm(question) {
  const a = await chatAsk(question, ["Да", "Нет"])
  return /^(да|ага|конечно|давай|ок|okay|yes|удаляй|переноси)/i.test(String(a || "").trim())
}
function brief(kind) {
  const b = BRIEFS[kind]
  if (b) chatSend(b.prompt, { label: b.label })
}

// ── Голос: распознавание речи Safari, иначе — диктовка с клавиатуры ──
// Слушает, пока человек говорит: отправляет только после паузы тишины (SILENCE_MS).
// Повторное нажатие на 🎤 — отправить сразу. Если Safari сам обрывает распознавание раньше паузы — слушаем дальше.
const SILENCE_MS = 2500, FIRST_WORD_MS = 8000
let rec = null, voice = null, lastVoice = null   // lastVoice — последняя запись: её итоги, пришедшие после отправки, не нужны
const voiceSent = () => { if (lastVoice) lastVoice.sent = true }
function micStart(auto) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  const inp = $("#chat-in")
  if (!SR) { if (inp) inp.focus(); toast("Нажмите 🎤 на клавиатуре и говорите"); return }
  if (voice) return voiceFinish()
  voice = { done: "", base: inp ? inp.value.trim() : "", timer: null, finishing: false, ptt: !!PTT.holding }
  const v = voice
  lastVoice = v
  const show = (extra = "") => { SILK.en = 1; v.text = [v.base, v.done, extra].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(); const i = $("#chat-in"); if (i) { i.value = v.text; grow(i) }; pttShow(v.text) }
  const arm = ms => { clearTimeout(v.timer); if (!v.ptt) v.timer = setTimeout(voiceFinish, ms) }   // пока кнопку держат — пауза не обрывает запись
  v.t0 = Date.now()
  $(".chat-bar .mic") && $(".chat-bar .mic").classList.add("on")
  if (inp) inp.placeholder = "Слушаю… ➤ — отправить сразу"
  pttShow("")
  const run = first => {
    const r = new SR()
    r.lang = "ru-RU"; r.interimResults = true; r.continuous = true
    let fin = "", all = ""
    r.onresult = e => {
      if (v.sent) return   // уже отправлено: поздний итог после stop() не должен снова заполнить поле (а после касания поля — пусть дописывает)
      let interim = ""
      fin = ""
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + " "
        else interim += e.results[i][0].transcript
      }
      all = fin + interim
      show(all)
      arm(SILENCE_MS)
    }
    r.onerror = e => {
      if (e.error === "no-speech" || e.error === "aborted") return
      if (first && auto && e.error === "not-allowed") { voiceReset(); return micPrompt() }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { voiceReset(); toast("Нет доступа к микрофону: Настройки → Safari → Микрофон (и Siri и Диктовка включены)"); if (inp) inp.focus(); return }
      v.err = e.error   // сеть, занят микрофон и т. п. — не перезапускаем по кругу, отправляем услышанное
      toast(`Микрофон: ${({ network: "нет сети для распознавания", "audio-capture": "микрофон занят другим приложением", "language-not-supported": "русский язык недоступен" })[e.error] || e.error}`)
    }
    r.onend = () => {
      if (voice !== v) return
      v.done = [v.done, all.trim()].filter(Boolean).join(" ")
      if (v.finishing || v.err) return voiceSend(v)
      // Safari закончил сам, а пауза ещё не набралась — продолжаем слушать
      try { rec = run(false) } catch (e) { voiceSend(v) }
    }
    r.start()
    return r
  }
  const fail = e => { voiceReset(); if (auto) return micPrompt(); toast(`Микрофон не запустился: ${e && (e.message || e.name) || e}`); if (inp) inp.focus() }
  try { rec = run(true); arm(FIRST_WORD_MS) }
  catch (e) {   // прошлая запись ещё не отпустила микрофон (например, сразу после ➤) — пробуем ещё раз чуть позже
    setTimeout(() => { if (voice !== v) return; try { rec = run(true); arm(FIRST_WORD_MS) } catch (e2) { fail(e2) } }, 500)
  }
}
function voiceFinish() {
  const v = voice
  if (!v || v.finishing) return
  v.finishing = true
  clearTimeout(v.timer)
  try { rec && rec.stop() } catch (e) { voiceSend(v) }
  setTimeout(() => { if (voice === v) voiceSend(v) }, 1500)   // если onend не пришёл
}
function voiceSend(v) {
  if (voice !== v) return
  const inp = $("#chat-in")
  const t = [v.base, v.done].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
  voiceReset()
  if (!v.done.trim()) return
  v.sent = true
  if (!inp) { setTab("chat"); return setTimeout(() => chatSend(t, { voice: true }), 30) }   // команда, сказанная с кнопки на любом экране
  inp.value = ""; grow(inp); chatSend(t, { voice: true })
}
// Зелёная ➤ во время записи: отправить то, что уже услышано, не дожидаясь паузы
function voiceSendNow() {
  const v = voice, i = $("#chat-in")
  const t = ((i && i.value) || v.text || "").trim()
  const r = rec
  voiceSent()
  voiceReset()
  try { r && r.stop() } catch (e) {}   // stop, не abort: Safari после abort иногда не отдаёт микрофон следующей записи
  if (i) { i.value = ""; grow(i) }
  if (t) chatSend(t, { voice: true })
}
// «‹ отмена» на полосе или смахнуть влево: запись выбрасывается, в поле возвращается то, что было до неё
function voiceCancel() {
  const v = voice; if (!v) return
  const r = rec
  v.sent = true
  voiceReset()
  try { r && r.stop() } catch (e) {}
  const i = $("#chat-in"); if (i) { i.value = v.base || ""; grow(i) }
  toast("Запись отменена")
}
function voiceReset() {
  if (voice) clearTimeout(voice.timer)
  voice = null; rec = null
  const b = $(".chat-bar .mic"); if (b) b.classList.remove("on")
  pttShow(null)
  const inp = $("#chat-in"); if (inp) inp.placeholder = "Напишите или скажите…"
}
// Прокручивается только середина (main), шапка и нижнее меню стоят на месте
const scrollView = end => { const m = $("#view"); if (m) m.scrollTop = end ? m.scrollHeight : 0 }
const grow = el => { el.style.height = "auto"; el.style.height = Math.min(120, el.scrollHeight) + "px"
  const bar = el.closest && el.closest(".chat-bar"); if (bar) { bar.classList.toggle("typed", !!el.value.trim()); setBusyUI() } }   // есть текст — стрелка «отправить», нет — микрофон или стоп

// ───────────── Формы ─────────────
function moneyForm(type, entry) {
  return new Promise(res => {
    const e = entry || { type, amount: "", method: "cash", category: "", comment: "", date: Date.now() }
    type = e.type
    const cats = core.CONFIG.categories[type].map(c => c[0]), B = baseCur()
    let cat = e.category, method = e.method, manualCat = !!entry, done = false, cur = e.cur || B, shared = !!e.shared
    const s = sheet(`<h3>${entry ? "Изменить" : type === "expense" ? "Расход" : "Доход"}</h3>
      <div class="field"><div class="mn-amt"><input id="m-amt" class="huge" type="number" inputmode="decimal" placeholder="0" value="${e.cur && e.orig ? e.orig : e.amount}"><div class="mn-cur" id="m-cur">${Object.keys(CUR).map(c => `<button data-c="${c}">${CUR[c]}</button>`).join("")}</div></div><div class="small muted" id="m-fx"></div></div>
      <div class="field"><input id="m-com" placeholder="Комментарий: такси, кафе, зарплата…" value="${esc(e.comment)}"></div>
      <div class="field"><div class="seg two" id="m-meth"><button data-m="cash">Наличные</button><button data-m="transfer">Перевод / карта</button></div></div>
      <div class="field"><label>Категория</label><div class="chips" id="m-cats">${cats.map(c => `<button class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div><div class="small muted" id="m-rule"></div></div>
      <div class="field"><button class="chip ${shared ? "on" : ""}" id="m-sh">${tdIco("people", 14)} Общая с ${esc(partnerIns(MNY().partner))}</button></div>
      <div class="field"><label>Дата</label><input id="m-date" type="date" value="${dayKey(new Date(e.date))}"></div>
      <div class="btns">${entry ? '<button class="btn red" data-a="del">Удалить</button>' : `<button class="btn small" data-a="swap">${type === "expense" ? "Это доход" : "Это расход"}</button>`}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`,
    { onClose: () => res(done) })
    const amtOf = () => parseFloat(String($("#m-amt", s.el).value).replace(",", "."))
    const paint = () => {
      $$("#m-meth button", s.el).forEach(b => b.classList.toggle("on", b.dataset.m === method))
      $$("#m-cats .chip", s.el).forEach(b => b.classList.toggle("on", b.dataset.c === cat))
      $$("#m-cur button", s.el).forEach(b => b.classList.toggle("on", b.dataset.c === cur))
      const a = amtOf(); $("#m-fx", s.el).textContent = cur !== B ? (a > 0 ? `≈ ${core.money(Math.round(fx(a, cur, B)))} по курсу сегодня` : `курс: ${fxLine()}`) : ""
    }
    paint(); fxLoad()
    $$("#m-meth button", s.el).forEach(b => b.onclick = () => { method = b.dataset.m; paint() })
    $$("#m-cur button", s.el).forEach(b => b.onclick = () => { cur = b.dataset.c; paint() })
    $("#m-amt", s.el).oninput = paint
    $("#m-sh", s.el).onclick = ev => { shared = !shared; ev.currentTarget.classList.toggle("on", shared) }
    $$("#m-cats .chip", s.el).forEach(b => b.onclick = () => { cat = b.dataset.c; manualCat = true; paint()
      const c = $("#m-com", s.el).value.trim(); $("#m-rule", s.el).textContent = c && cat !== "Другое" && ruleFor(c, type) !== cat ? `Запомню: «${c.split(/[,.;]/)[0].trim()}» → ${cat}` : "" })
    $("#m-com", s.el).oninput = ev => {
      if (manualCat) return
      const r = ruleFor(ev.target.value, type)
      if (r && cats.includes(r)) { cat = r; paint(); return }
      const p = core.parseMoney(" " + ev.target.value + " ", type)
      if (p.category && p.category !== "Другое") { cat = p.category; paint() }
    }
    if (!entry) setTimeout(() => $("#m-amt", s.el).focus(), 250)
    $('[data-a="no"]', s.el).onclick = () => s.close()
    const swap = $('[data-a="swap"]', s.el)
    if (swap) swap.onclick = () => { s.close(); moneyForm(type === "expense" ? "income" : "expense").then(res) }
    if (entry) $('[data-a="del"]', s.el).onclick = () => { remove("money", entry.id); done = true; s.close(); render() }
    $('[data-a="ok"]', s.el).onclick = () => {
      const a = amtOf()
      if (!(a > 0)) { toast("Введите сумму"); return }
      const amount = cur === B ? a : Math.round(fx(a, cur, B))
      const dv = $("#m-date", s.el).value
      let date = e.date
      if (dv && dv !== dayKey(new Date(e.date))) { const [y, m, d] = dv.split("-").map(Number); const x = new Date(); date = +new Date(y, m - 1, d, x.getHours(), x.getMinutes()) }
      const comment = $("#m-com", s.el).value.trim()
      const rec = Object.assign({}, entry || { id: `f${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, { type, amount, method,
        category: cat || cats[cats.length - 1], comment, date, shared })
      if (cur !== B) Object.assign(rec, { cur, orig: a }); else { delete rec.cur; delete rec.orig }
      upsert("money", rec)
      const learned = manualCat && comment && (!entry || entry.category !== rec.category) ? ruleLearn(comment, rec.category, type) : null
      done = true; s.close(); render()
      const bn = type === "expense" ? budgetNote(rec.category, rec.date) : ""
      toast(`${type === "expense" ? "−" : "+"}${cur !== B ? fmtCur(a, cur) + " ≈ " : ""}${core.money(amount)} · ${rec.category}${learned ? " · запомнил" : bn ? " · " + bn : ""}`)
    }
  })
}

function foodForm(f) {
  return new Promise(res => {
    let done = false
    const recent = []
    for (const x of live(D.food).sort((a, b) => b.date - a.date)) if (x.title && !recent.some(r => r.title.toLowerCase() === x.title.toLowerCase())) recent.push(x)
    const s = sheet(`<h3>${f ? "Еда" : "🍽 Что съели?"}</h3>
      ${!f && recent.length ? `<div class="field"><label>Недавнее — нажмите, чтобы добавить ещё раз</label><div class="chips">${recent.slice(0, 10).map((x, i) =>
        `<button class="chip" data-r="${i}">${esc(x.title)} · ${num(x.kcal)}</button>`).join("")}</div></div>` : ""}
      <div class="field"><input id="f-n" placeholder="Блюдо: овсянка, борщ, кофе с молоком" value="${esc(f ? f.title : "")}"></div>
      <div class="field"><label>Калории, ккал</label><input id="f-k" type="number" inputmode="numeric" value="${f ? f.kcal : ""}" placeholder="350"></div>
      ${f ? `<div class="muted small">Б ${num(f.protein)} · Ж ${num(f.fat)} · У ${num(f.carbs)} г · ${hm(new Date(f.date))}</div>` : ""}
      <div class="btns">${f ? '<button class="btn red" data-a="del">Удалить</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`,
    { onClose: () => res(done) })
    $('[data-a="no"]', s.el).onclick = () => s.close()
    $$("[data-r]", s.el).forEach(b => b.onclick = () => {
      const x = recent[+b.dataset.r]
      addFood({ title: x.title, kcal: x.kcal, protein: x.protein || 0, fat: x.fat || 0, carbs: x.carbs || 0 })
      done = true; s.close(); render(); toast(`+${num(x.kcal)} ккал · ${x.title}`)
    })
    if (f) $('[data-a="del"]', s.el).onclick = () => { remove("food", f.id); done = true; s.close(); render() }
    $('[data-a="ok"]', s.el).onclick = () => {
      const title = $("#f-n", s.el).value.trim() || "Еда"
      const kcal = Math.round(parseFloat($("#f-k", s.el).value))
      if (!(kcal >= 0)) { toast("Укажите калории"); return }
      if (f) upsert("food", Object.assign({}, f, { title, kcal })); else addFood({ title, kcal })
      done = true; s.close(); render()
    }
  })
}

const SPORTS = [["Ходьба", 3.8], ["Бег", 9], ["Велосипед", 7], ["Плавание", 7], ["Зал", 5], ["Йога", 3], ["Падел / теннис", 7], ["Танцы", 5], ["Другое", 4.5]]
function workoutForm(w) {
  return new Promise(res => {
    const weight = H().weight || 80
    let done = false, sport = w ? (SPORTS.find(x => (w.title || "").startsWith(x[0])) || SPORTS[SPORTS.length - 1])[0] : SPORTS[0][0], edited = !!w
    const s = sheet(`<h3>${w ? "Тренировка" : "🏃 Тренировка без часов"}</h3>
      <div class="field"><div class="chips" id="w-s">${SPORTS.map(x => `<button class="chip" data-s="${esc(x[0])}">${esc(x[0])}</button>`).join("")}</div></div>
      <div class="field"><label>Минут</label><input id="w-m" type="number" inputmode="numeric" value="${w ? w.minutes : 30}"></div>
      <div class="field"><label>Сожжено, ккал (примерно, по весу ${weight} кг)</label><input id="w-k" type="number" inputmode="numeric" value="${w ? w.kcal : ""}"></div>
      <div class="btns">${w ? '<button class="btn red" data-a="del">Удалить</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`,
    { onClose: () => res(done) })
    const est = () => {
      if (edited) return
      const met = (SPORTS.find(x => x[0] === sport) || SPORTS[SPORTS.length - 1])[1]
      $("#w-k", s.el).value = Math.round(met * weight * (+$("#w-m", s.el).value || 0) / 60)
    }
    const paint = () => $$("#w-s .chip", s.el).forEach(b => b.classList.toggle("on", b.dataset.s === sport))
    paint(); est()
    $$("#w-s .chip", s.el).forEach(b => b.onclick = () => { sport = b.dataset.s; edited = false; paint(); est() })
    $("#w-m", s.el).oninput = est
    $("#w-k", s.el).oninput = () => { edited = true }
    $('[data-a="no"]', s.el).onclick = () => s.close()
    if (w) $('[data-a="del"]', s.el).onclick = () => { remove("workouts", w.id); done = true; s.close(); render() }
    $('[data-a="ok"]', s.el).onclick = () => {
      const minutes = Math.round(+$("#w-m", s.el).value), kcal = Math.round(+$("#w-k", s.el).value)
      if (!(minutes > 0)) { toast("Укажите минуты"); return }
      const now = Date.now()
      upsert("workouts", Object.assign({}, w || { id: `t${now}-${Math.random().toString(36).slice(2, 6)}`, date: now }, { title: `${sport} ${minutes} мин`, minutes, kcal }))
      done = true; s.close(); render()
    }
  })
}

const RDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]
const repeatOf = recur => recur ? (recur.freq === "daily" ? { freq: "daily" } : { freq: "weekly", days: (recur.days || []).map(d => RDAY[d]) }) : undefined
async function reminderForm() {
  const s = sheet(`<h3>⏰ Новое напоминание</h3>
    <div class="field"><input id="r-t" placeholder="Что сделать?"></div>
    <div class="field"><label>Когда (можно пусто)</label><input id="r-w" placeholder="завтра в 9, в пятницу в 18:30, каждый день в 8"></div>
    <div class="btns"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  setTimeout(() => $("#r-t", s.el).focus(), 250)
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#r-t", s.el).value.trim()
    if (!title) { toast("Напишите, что напомнить"); return }
    const wtext = $("#r-w", s.el).value.trim()
    const x = { title }
    if (wtext) {
      const w = core.parseWhen(" " + core.normalizeSpeech(wtext) + " ")
      if (!w.date) { toast("Не понял, когда. Например: «завтра в 9»"); return }
      x.due = iso(w.date)
      if (w.recur) x.repeat = repeatOf(w.recur)
    }
    remAdd(x)
    s.close(); render(); toast("⏰ Напоминание сохранено")
  }
}
async function eventForm() {
  const t = await ui.ask("📅 Событие", "Название и время одной фразой: «завтра в 15 стоматолог», «в субботу с 12 до 14 обед с родителями»", "", { ok: "Дальше" })
  if (!t) return
  const a = core.buildActions([{ text: core.normalizeSpeech(t), kind: "event" }])[0] || {}
  let date = a.date ? new Date(a.date) : null
  if (!date || !a.hasTime) {
    const w = await ui.ask(`📅 ${a.title || t}`, "Когда? Например: «завтра в 15:00», «в пятницу с 19 до 21»")
    if (!w) return
    const p = core.parseWhen(" " + core.normalizeSpeech(w) + " ", date ? sod(date) : null)
    if (!p.date) return ui.info("Не понял время", w)
    date = p.date; a.minutes = p.minutes || a.minutes; a.recur = p.recur || a.recur
  }
  const end = new Date(+date + (a.minutes || core.CONFIG.defaultEventMinutes || 60) * 60000)
  const title = core.cap(a.title || t)
  const b = await ui.confirm("Добавить в календарь?", deEmo(`<div class="cmd-list">📅 ${esc(title)}\n${esc(core.cap(fullDate(date)))}, ${hm(date)}–${hm(end)}${a.recur ? "\n🔁 " + esc(core.recurLabel(a.recur)) : ""}${a.calendar ? "\n" + esc(a.calendar) : ""}</div>`), ["Отмена", "Добавить"])
  if (b !== "Добавить") return
  const ev = { title, start: iso(date), end: iso(end), repeat: repeatOf(a.recur), calendar: a.calendar || undefined }
  if (gcalOn()) {
    const r = await calDo("create", ev)
    if (r.error) return ui.info("Не получилось", r.error)
    return toast("📅 Добавлено в Google Календарь")
  }
  queueOp("create_event", ev)
  render(); toast("📅 Внесётся в календарь iPhone при обновлении виджета")
}
async function eventSheet(e) {
  const when = e.all_day ? "весь день" : `${hm(e.s)}–${hm(e.e)}`
  const b = await ui.confirm(e.title || "(без названия)", deEmo(`<div class="msg">${esc(core.cap(fullDate(e.s)))}, ${when}${e.location ? "\n📍 " + esc(e.location) : ""}${e.calendar ? "\n" + esc(e.calendar) : ""}${e.repeats ? "\n🔁 повторяется" : ""}${e.pending ? "\n⏳ ещё не внесено в iPhone" : ""}</div>`),
    e.pending ? ["Отменить"] : ["Удалить", "Перенести"])
  if (b === "Отменить") { cancelOp(e.id.slice(3)); render(); return }
  if (b === "Перенести") {
    const t = await ui.ask(`Куда перенести «${e.title}»?`, `Сейчас: ${shortDate(e.s)}, ${hm(e.s)}. Например: «на 20:00», «на пятницу в 15», «на час позже»`)
    if (!t) return
    const m = core.buildMove("перенеси x на " + t.replace(/^на\s+/i, ""))
    let ns
    if (m.shift) ns = new Date(+e.s + m.shift * 60000)
    else if (m.toDay || m.toTime) {
      ns = new Date(m.toDay || sod(e.s))
      const [hh, mm] = m.toTime ? m.toTime.split(":").map(Number) : [e.s.getHours(), e.s.getMinutes()]
      ns.setHours(hh, mm, 0, 0)
    }
    if (!ns) return ui.info("Не понял, куда перенести", t)
    if (gcalOn()) {
      const r = await calDo("update", { id: e.id, occurrence_start: e.start, start: iso(ns), end: iso(new Date(+ns + (e.e - e.s))) })
      toast(r.error ? `Не получилось: ${r.error}` : `↔️ ${shortDate(ns)}, ${hm(ns)}`); return
    }
    queueOp("update_event", { id: e.id, occurrence_start: e.start, start: iso(ns), end: iso(new Date(+ns + (e.e - e.s))) })
    render(); toast(`↔️ ${shortDate(ns)}, ${hm(ns)} — внесётся при обновлении виджета`)
  }
  if (b === "Удалить") {
    let all = false
    if (e.repeats) { const i = await ui.choose("Повторяющееся событие", "", ["Только это", "Это и все следующие"]); if (i < 0) return; all = i === 1 }
    if (gcalOn()) {
      toast("🗑 Удаляю…")
      const r = await calDo("delete", { id: e.id, occurrence_start: e.start, all_future: all })
      toast(r.error ? `Не получилось: ${r.error}` : all ? "🗑 Удалено это и все следующие" : "🗑 Удалено"); return
    }
    queueOp("delete_event", { id: e.id, occurrence_start: e.start, all_future: all })
    render(); toast("🗑 Удалится при обновлении виджета")
  }
}
async function addMenu() {
  const glass = H().glass || 250
  const opts = [["💬 Сказать помощнику", () => { setTab("chat"); setTimeout(micStart, 300) }], ["➖ Расход", () => moneyForm("expense")], ["➕ Доход", () => moneyForm("income")],
    ["📷 Фото: еда, счёт, чек", photoPrompt], ["🍽 Еда", foodMenu], [`💧 Стакан воды ${glass} мл`, () => addWater(glass)], ["🏃 Тренировка", () => workoutForm()], ["🛒 Покупка", shopForm], ["👧 Дела детей", kidsForm], ["🎯 Цель или желание", () => goalsForm("month")], ["🔁 Снова пора: повторяющееся дело", () => choreForm()], ["📋 Новый список", listForm], ["⏱ Помидоро — фокус 25 мин", pomoAsk],
    ["⏰ Напоминание", reminderForm], ["📅 Событие", () => calQuick()]]
  const i = await ui.choose("Добавить", "", opts.map(o => o[0]))
  if (i >= 0) opts[i][1]()
}

// ───────────── Экраны ─────────────
let tab = "today", selDay = sod(new Date()), monthKey = null, hiddenAt = 0
function setTab(t) {
  tab = t
  $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === t || t === "cal" && b.dataset.tab === "today"))
  $("#gear").classList.toggle("on", t === "more")
  document.body.classList.toggle("chat", t === "chat")
  if (plusClose) plusClose()
  render()
  if (t === "chat") setTimeout(() => scrollView(true), 30)
  else scrollView(false)
}
// Перерисовка: если ничего не поменялось — экран не трогаем (иначе при каждом обмене с таблицей он «моргает»);
// плавное появление карточек — только при смене вкладки
let lastHTML = "", lastTab = ""
function render() {
  const fn = { today: renderToday, cal: renderCal, plans: renderPlans, chat: renderChatHTML, money: renderMoney, health: renderHealth, more: renderMore }[tab]
  const html = fn(), v = $("#view")
  if (html === lastHTML && tab === lastTab && v.firstChild) { renderTop(); return }
  const strip = $("#strip", v), keep = strip && tab === lastTab ? strip.scrollLeft : null
  v.classList.toggle("anim", tab !== lastTab)
  lastHTML = html; lastTab = tab
  v.innerHTML = html
  bind()
  stripInit(keep)
  if (tab === "more") pushCard()
  renderTop()
}
const TITLES = { cal: "Календарь", plans: "Планы", chat: "Помощник", money: "Деньги", health: "Здоровье", more: "Настройки" }
function renderTop() {
  const v = iphone()
  if (tab === "today") { const d = new Date(); $("#top-title").innerHTML = `${esc(core.cap(WDF[d.getDay()]))}<span class="dt">${d.getDate()} ${MONTHS_GEN[d.getMonth()]}</span>` }
  else $("#top-title").textContent = tab === "chat" ? iziName() : TITLES[tab]
  iziPaint()
  const fl = $("#fab span"); if (fl && fl.textContent !== iziName()) { fl.textContent = iziName(); $("#fab").setAttribute("aria-label", `${iziName()}: нажмите — чат, держите — голосовая команда`) }
  let sub = ""
  if (!D.conn) sub = "Не подключено к виджету"
  else if (D.sync.error) sub = D.sync.error
  else if (tab === "cal") { const S = calS(), st = calStart || new Date(); sub = `${core.cap(core.MONTH_NOM[st.getMonth()])} · ${({ 1: "день", 3: "3 дня", 7: "неделя", m: "месяц" })[S.view]}` }
  else if (tab === "money") { const t = core.monthTotals(live(D.money), monthKey || core.monthKey(new Date())); sub = `${core.monthTitle(monthKey || core.monthKey(new Date()))} · −${core.money(t.expense)}` }
  else {
    const p = gcalOn() ? 0 : pendingOps().length
    sub = gcalOn() ? `Обновлено ${ago(D.sync.at)}` : `iPhone: ${v.at ? ago(v.at) : "ждём виджет"}` + (p ? ` · ${p} в очереди` : "")
    if (tab === "today" && wxLine()) sub = wxLine() + " · " + sub
  }
  $("#top-sub").textContent = sub
}

const WDF = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"]
const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"]
function renderToday() {
  const now = new Date(), t0 = sod(now), v = iphone()
  const isToday = sameDay(selDay, t0)
  const counts = {}
  let html = ""
  if (!D.conn) html += `<div class="banner"><b>Подключите приложение к виджету</b>Нажмите «Подключить»: откроется Scriptable, сам скопирует код, а вы вернётесь сюда кнопкой «◀ IZIDAY» слева вверху и нажмёте «Вставить».<div class="btns" style="margin-top:8px"><button class="btn" data-do="connect">Ввести код</button><button class="btn primary" data-do="autoconnect">🔗 Подключить</button></div></div>`
  else if (!gcalOn() && D.snap && pendingOps().length) html += `<div class="banner"><b>${ei("phone")}${pendingOps().length} ${plural(pendingOps().length, "изменение ждёт", "изменения ждут", "изменений ждут")} внесения в iPhone</b>Календарь и напоминания iPhone меняет только Scriptable. Нажмите — он внесёт сейчас и вернёт вас сюда.<div class="btns" style="margin-top:8px"><button class="btn primary" data-do="run-widget">Внести сейчас</button></div></div>`
  else if (!gcalOn() && D.gcal && D.gcal.error) html += `<div class="banner"><b>Google Календарь не ответил</b>${esc(D.gcal.error)}</div>`
  // Дни — лентой-каруселью: листаются пальцем, 7 видно сразу; лента ±10 недель вокруг выбранной недели
  if (D.conn && standalone() && pushAble() && Notification.permission === "default") html += `<div class="banner"><b>${ei("bell")}Включите уведомления</b>Подсказки про воду, «пора выезжать» и напоминания будут приходить пушем.<div class="btns" style="margin-top:8px"><button class="btn primary" data-do="push-on">Включить</button></div></div>`
  const wOff = Math.floor(Math.round((sod(selDay) - t0) / 864e5) / 7), w0 = addDays(t0, wOff * 7)
  const wc = stripCenter || w0, s0 = addDays(wc, -70), s1 = addDays(wc, 77)
  for (const e of v.events) for (let d = sod(e.s); d < e.e && d < s1; d = addDays(d, 1)) if (d >= s0) counts[dayKey(d)] = (counts[dayKey(d)] || 0) + 1
  html += `<div class="month wnav"><b id="wk-lbl">${esc(weekLabel(w0))}</b><button class="today-btn" data-do="go-today" ${wOff === 0 && isToday ? "hidden" : ""}>Сегодня</button><button class="cal-open" data-do="cal-open">${tdIco("grid", 16)} Календарь</button></div>`
  html += `<div class="week strip" id="strip" data-start="${+s0}" data-sel="${+wc}">${[...Array(147)].map((_, i) => {
    const d = addDays(s0, i), n = counts[dayKey(d)] || 0
    return `<button class="day ${sameDay(d, selDay) ? "on" : ""} ${sameDay(d, t0) ? "td" : ""} ${d.getDay() % 6 === 0 ? "we" : ""}" data-day="${+d}">
      <div class="wd">${WD[d.getDay()]}</div><div class="dn">${d.getDate()}</div><div class="n">${n ? n + " соб." : "—"}</div></button>`
  }).join("")}</div>`
  const onDay = d => v.events.filter(e => e.s < addDays(d, 1) && e.e > d).sort((a, b) => (b.all_day ? 1 : 0) - (a.all_day ? 1 : 0) || a.s - b.s)
  const dayEvs = onDay(selDay)
  const nSel = dayEvs.length
  if (isToday) html += todayTop(v, now)
  html += `<div class="card daycard"><div class="dayhead"><div><div class="dh-t">${isToday ? "Сегодня" : esc(core.cap(dayName(selDay)))}, ${selDay.getDate()} ${MONTHS_GEN[selDay.getMonth()]}</div>
    <div class="dh-n">${nSel ? `${nSel} ${plural(nSel, "событие", "события", "событий")}` : "Нет событий"}</div></div><button class="act" data-do="event">+ Событие</button></div>`
  const useTl = selDay >= t0
  const allDay = dayEvs.map((e, i) => [e, i]).filter(([e]) => e.all_day || e.s < selDay)
  if (useTl) html += allDay.map(([e, i]) => `<div class="row" data-ev="${i}"><div class="bar-l" style="background:${esc(e.color || "var(--teal)")}"></div><div class="time" style="font-size:11.5px">${e.all_day ? "весь день" : "до " + hm(e.e)}</div><div class="grow"><div class="t">${esc(e.title || "(без названия)")}</div></div></div>`).join("") + timelineHTML(v, selDay, dayEvs, now)
  else html += dayEvs.length ? dayEvs.map((e, i) => {
    const t = e.all_day ? "весь день" : e.s < selDay ? "до " + hm(e.e) : hm(e.s)
    const past = isToday && !e.all_day && e.e <= now
    return `<div class="row ${e.pending ? "pending" : ""} ${past ? "past" : ""}" data-ev="${i}"><div class="bar-l" style="background:${esc(e.color || "var(--teal)")}"></div>
      <div class="time" style="${e.all_day ? "font-size:11.5px" : ""}">${t}</div>
      <div class="grow"><div class="t">${esc(e.title || "(без названия)")}</div><div class="s">${e.all_day ? "" : hm(e.s) + "–" + hm(e.e)}${e.location ? " · " + esc(e.location) : ""}${e.calendar ? " · " + esc(e.calendar) : ""}</div></div></div>`
  }).join("") : `<div class="empty">${gcalOn() || D.snap ? "Ничего не запланировано" : "Загружаю Google Календарь…"}</div>`
  html += `</div>`
  dayEvsCache = dayEvs


  const isPast = selDay < t0
  if (isPast) return html + (habitList().length ? habitsCard(selDay) : "") + dayRecap(selDay)
  let rems = openRems(v)
  if (isToday) rems = rems.filter(r => !remDue(r) || remDue(r) < addDays(t0, 1))
  else rems = rems.filter(r => remDue(r) && sameDay(remDue(r), selDay))
  rems.sort((a, b) => (!remDue(a)) - (!remDue(b)) || (remDue(a) || 0) - (remDue(b) || 0))
  html += `<div class="card"><h2>Напоминания<button class="act" data-do="reminder">+ Добавить</button></h2>`
  html += rems.length ? rems.slice(0, 25).map(r => `<div class="row ${r.pending ? "pending" : ""}"><button class="check ${remLate(r) ? "late" : ""}" data-check="${esc(r.id)}"></button>
    <div class="grow"><div class="t">${esc(r.title)}</div>${r.due || r.list ? `<div class="s ${remLate(r) ? "exp" : ""}">${esc(remLabel(r))}${r.due && r.list ? " · " : ""}${esc(r.list || "")}</div>` : ""}</div></div>`).join("")
    : `<div class="empty">${isToday ? "Всё сделано" : "На этот день напоминаний нет"}</div>`
  const bills = isToday ? recurSoon() : []
  if (bills.length) html += bills.map(r => `<div class="row" data-recur="${esc(r.id)}"><span class="pin">${ei("repeat")}</span><div class="grow"><div class="t">${esc(r.title)} · ${esc(core.money(r.amount))}</div>
    <div class="s ${recurDue(r) < sod(now) ? "exp" : ""}">оплатить ${esc(recurLabel(r))}</div></div><button class="btn small" data-recur-pay="${esc(r.id)}">Оплачено</button></div>`).join("")
  const near = live(D.places).filter(p => !p.done && !p.shop)
  if (isToday && near.length) html += near.map(p => `<div class="row"><span class="pin">${ei("pin")}</span><div class="grow"><div class="t">${deEmo(esc(p.title))}</div>
    <div class="s">напомню рядом: ${esc(p.query)} · ${(p.points || []).length} ${plural((p.points || []).length, "точка", "точки", "точек")}</div></div></div>`).join("")
  html += `</div>`

  html += kidsCard(selDay)
  if (isToday && shopOpen().length) html += shopCard()
  if (isToday) html += habitsCard(selDay)
  if (isToday) html += choresToday()
  if (isToday && pomoNow()) html += pomoCard()
  if (isToday) html += goalsCard()
  if (isToday) html += todayBottom(v, now)
  const failed = D.ops.filter(o => o.state === "done" && o.result && o.result.error)
  if (failed.length && !gcalOn()) html += `<div class="card"><h2>Не внеслось в iPhone</h2>${failed.map(o => `<div class="row"><div class="grow"><div class="t">${esc(OP_LABEL[o.tool] || o.tool)}: ${esc((o.input || {}).title || "")}</div><div class="s exp">${esc(o.result.error)}</div></div></div>`).join("")}</div>`
  return html
}
let dayEvsCache = []
function weekLabel(w0) {
  const w6 = addDays(w0, 6), t = sod(new Date()), off = Math.round((w0 - addDays(t, 0)) / 864e5)
  if (off <= 0 && off > -7) return "Эта неделя"
  if (off >= 7 && off < 14) return "Следующая неделя"
  if (off <= -7 && off > -14) return "Прошлая неделя"
  return w0.getMonth() === w6.getMonth() ? `${w0.getDate()}–${w6.getDate()} ${MONTHS_GEN[w0.getMonth()]}` : `${w0.getDate()} ${MONTHS_GEN[w0.getMonth()].slice(0, 3)} – ${w6.getDate()} ${MONTHS_GEN[w6.getMonth()].slice(0, 3)}`
}
// Лента дней: после перерисовки — на неделю выбранного дня (или туда, где пальцем оставили); подпись — по видимой неделе
let stripCenter = null, stripJump = false
function stripInit(keep) {
  const s = $("#strip")
  if (!s) return
  const col = s.children[1] ? s.children[1].offsetLeft - s.children[0].offsetLeft : 0
  if (!col) return
  const start = +s.dataset.start, idx = Math.round((+s.dataset.sel - start) / 864e5)
  s.scrollLeft = keep != null && !stripJump ? keep : idx * col
  stripJump = false
  let t = null, touched = false   // перестраивать ленту только после пальца, не от прокрутки кодом
  s.addEventListener("pointerdown", () => { touched = true }, { passive: true })
  s.addEventListener("touchstart", () => { touched = true }, { passive: true })
  s.onscroll = () => {
    if (!touched) return
    clearTimeout(t)
    t = setTimeout(() => {
      const first = addDays(new Date(start), Math.round(s.scrollLeft / col))
      const lbl = $("#wk-lbl"); if (lbl) lbl.textContent = weekLabel(first)
      const tb = $(".today-btn"); if (tb) tb.hidden = sameDay(selDay, new Date()) && Math.abs(Math.round((first - sod(new Date())) / 864e5)) < 4
      // докрутили до края ленты — перестроить ленту вокруг видимой недели
      if (s.scrollLeft < col * 7 || s.scrollLeft > s.scrollWidth - s.clientWidth - col * 7) { stripCenter = first; stripJump = true; render() }
    }, 120)
  }
}

function renderChatHTML() {
  return `<div class="chat-tools"><button data-do="talk" class="tk-chip"><b class="mini-orb"></b>Поговорить</button><button data-brief="morning">${ei("sun")}Утренняя сводка</button><button data-brief="evening">${ei("moon")}Вечерняя</button><button data-do="memory">${ei("brain")}Память</button><button data-do="chat-clear">${ei("eraser")}Очистить</button></div>
    <div class="chat-list" id="chat-list">${chatItems()}</div>
    <div class="chat-bar"><div class="att-tray" id="att-tray"></div><button class="cam plus" aria-label="Добавить фото, видео или файл">${ICO.add}</button><textarea id="chat-in" rows="1" placeholder="Напишите или скажите…" enterkeyhint="send"></textarea>
    <button class="send" aria-label="Отправить">${ICO.send}</button></div>`
}
const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`)
function chatItems() {
  if (!D.chat.length) return `<div class="empty" style="text-align:center;padding:30px 10px">Я — ${esc(iziName())}, ${iziG("ваш помощник", "ваша помощница")}: встречи, напоминания, деньги, еда — и просто поговорить.<br><br>Нажмите на волну справа и скажите — или держите её, как рацию. Например: «завтра в 10 встреча с Олей», «потратил 300 на такси наличными», «что у меня на неделе?»</div>`
  const last = D.chat.length - 1
  return D.chat.slice(-60).map((m, i, arr) => {
    const isLast = i === arr.length - 1 && askWait
    const gi = D.chat.length - arr.length + i
    const edit = m.role === "user" && !m.local && !m.thumb && !m.prompt && i >= arr.length - 6 ? `<button class="ed" data-edit="${gi}" aria-label="Изменить">${ICO.pen}</button>` : ""
    return `<div class="m ${m.role}" data-i="${gi}">${edit}${m.thumb ? `<img class="att" src="${esc(m.thumb)}" alt="">` : ""}${m.voice ? ei("micl") : ""}${deEmo1(linkify(m.text))}${draftHTML(m)}${m.pro && m.opts && m.opts.length && i === arr.length - 1 ? `<div class="opts">${m.opts.map(o => `<button data-pro="${esc(o)}">${esc(o)}</button>`).join("")}</div>` : ""}${(m.links || []).length && !m.ccDone ? `<div class="links">${m.links.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${ei("link")}Сессия Claude Code</a>`).join("")}</div>` : ""}${ccCards(m)}` +
      `${m.opts && m.opts.length && isLast ? `<div class="opts">${m.opts.map(o => `<button data-opt="${esc(o)}">${esc(o)}</button>`).join("")}</div>` : ""}<span class="tm">${hm(new Date(m.at || Date.now()))}</span></div>`
  }).join("") + (chatBusy && !askWait ? `<div class="typing"><i></i><i></i><i></i>${chatStatus ? `<span class="st">${esc(chatStatus)}</span>` : ""}</div>` : "") + (last < 0 ? "" : "")
}
function renderChat() {
  const list = $("#chat-list")
  if (!list) return
  list.innerHTML = chatItems()
  bindChatList()
  scrollView(true)
}
function bindChatList() {
  $$("[data-opt]").forEach(b => b.onclick = () => { b.classList.add("on"); chatSend(b.dataset.opt) })
  $$("[data-edit]").forEach(b => b.onclick = e => { e.stopPropagation(); chatEdit(+b.dataset.edit) })
  bindIziChat()
}

function ring(p, color, label, sub) {
  const r = 40, c = 2 * Math.PI * r
  return `<div class="ring"><svg viewBox="0 0 92 92" width="92" height="92"><circle cx="46" cy="46" r="${r}" fill="none" stroke="var(--track)" stroke-width="9"/>
    <circle cx="46" cy="46" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, p || 0))}"/></svg>
    <div class="c"><b>${label}</b><span>${sub}</span></div></div>`
}
function healthDay() { const t0 = sod(new Date()); return selDay > t0 ? t0 : sod(selDay) }
function dayNav(d, attr) {
  const isT = sameDay(d, new Date())
  return `<div class="month"><button data-${attr}="-1" aria-label="День назад">‹</button><b>${isT ? "Сегодня" : esc(core.cap(dayName(d)))}</b><button data-${attr}="1" ${isT ? "disabled style=opacity:.3" : ""} aria-label="День вперёд">›</button></div>`
}
// Итоги прошедшего дня: вода, еда, тренировки, шаги, расходы — для «Сегодня» на прошлой дате
function dayRecap(d) {
  const h = dayHealth(d), g = H()
  const money = onDay(D.money, d), spent = money.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0)
  const inc = money.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0)
  let html = `<div class="card"><h2>Итоги дня</h2><div class="stats">
    <button class="stat" data-do="tab-health"><div class="v">${liters(h.water)} л</div><div class="l">вода из ${liters(g.waterGoal)}</div></button>
    <button class="stat" data-do="tab-health"><div class="v">${num(h.kcal)}</div><div class="l">ккал съедено</div></button>
    <button class="stat" data-do="tab-money"><div class="v">−${num(spent)}</div><div class="l">расходы${inc ? ` · +${num(inc)}` : ""}</div></button></div>
    <div class="watch" style="margin-top:12px"><div><b>${h.steps != null ? num(h.steps) : "—"}</b><span>шагов</span></div><div><b>${num(h.active)}</b><span>актив. ккал</span></div><div><b>${num(h.exercise)}</b><span>мин упражнений</span></div></div>
    ${h.watch || h.workouts.length ? "" : `<div class="muted small" style="margin-top:8px">Данных с часов за этот день нет: виджет хранит их ${D.snap && (D.snap.health || []).length ? "за последние " + D.snap.health.length + " дн." : "только с момента подключения"}.</div>`}</div>`
  if (h.workouts.length) html += `<div class="card"><h2>Тренировки и прогулки</h2>${h.workouts.map(w => `<div class="row" data-wk="${esc(w.id)}"><div class="time">${hm(new Date(w.date))}</div><div class="grow"><div class="t">${esc(w.title)}</div><div class="s">${w.minutes} мин</div></div><div class="amt">−${num(w.kcal)}</div></div>`).join("")}</div>`
  if (h.food.length) html += `<div class="card"><h2>Еда<span class="muted small" style="text-transform:none;letter-spacing:0">Б ${num(h.protein)} · Ж ${num(h.fat)} · У ${num(h.carbs)}</span></h2>${h.food.map(f => `<div class="row" data-food="${esc(f.id)}"><div class="time">${hm(new Date(f.date))}</div><div class="grow"><div class="t">${esc(f.title || "Еда")}</div></div><div class="amt">${num(f.kcal)}</div></div>`).join("")}</div>`
  if (money.length) html += `<div class="card"><h2>Расходы и доходы</h2>${money.map(e => `<div class="row" data-money="${esc(e.id)}"><div class="time">${hm(new Date(e.date))}</div><div class="grow"><div class="t">${esc(e.category)}</div><div class="s">${e.method === "cash" ? "💵 нал" : "💳 перевод"}${e.comment ? " · " + esc(e.comment) : ""}</div></div><div class="amt ${e.type === "expense" ? "exp" : "inc"}">${e.type === "expense" ? "−" : "+"}${esc(core.money(e.amount))}</div></div>`).join("")}</div>`
  if (!h.workouts.length && !h.food.length && !money.length && !h.water) html += `<div class="card"><div class="empty">За этот день ничего не записано</div></div>`
  return html + `<div class="btns"><button class="btn" data-report="week">${ei("chart")}Отчёт за неделю</button><button class="btn" data-report="month">За месяц</button><button class="btn" data-report="year">За год</button></div>`
}

function renderHealth() {
  const day = healthDay(), g = H(), h = dayHealth(day), t0 = day, isT = h.isToday
  let html = dayNav(day, "hday") + `<div class="card"><h2>${isT ? "Активность" : "Активность за день"}${h.watch ? `<span class="muted small" style="text-transform:none;letter-spacing:0">часы: ${ago(h.watch.updated)}</span>` : ""}</h2>
    <div class="watch"><div><b>${h.steps != null ? num(h.steps) : "—"}</b><span>шагов</span></div><div><b>${num(h.active)}</b><span>актив. ккал из ${num(g.moveGoal)}</span></div>
    <div><b>${num(h.exercise)}</b><span>мин упражнений</span></div></div>
    ${!h.watch ? `<div class="muted small" style="margin-top:8px">${isT ? "Данные часов приходят через виджет после Быстрой команды «Мой день - здоровье»." : "Данных с часов за этот день нет."}</div>` : ""}
    ${isT ? `<div class="btns" style="margin-top:10px"><button class="btn small" data-do="workout">+ Тренировка без часов</button></div>` : ""}
    ${h.workouts.map(w => `<div class="row" data-wk="${esc(w.id)}"><div class="time">${hm(new Date(w.date))}</div><div class="grow"><div class="t">${esc(w.title)}</div><div class="s">${w.minutes} мин</div></div><div class="amt">−${num(w.kcal)}</div></div>`).join("")}</div>`
  html += `<div class="card"><h2>Вода</h2><div class="ring-row">${ring(h.water / g.waterGoal, "var(--teal)", liters(h.water) + " л", "из " + liters(g.waterGoal))}
    ${isT ? `<div style="flex:1"><div class="btns"><button class="btn teal" data-water="${g.glass}">+ Стакан ${g.glass} мл</button></div>
    <div class="btns" style="margin-top:8px"><button class="btn small" data-water="500">+500</button><button class="btn small" data-water="other">Другое</button><button class="btn small" data-water="undo">Отменить</button></div></div>`
    : `<div style="flex:1" class="small muted">${h.waterList.length ? h.waterList.map(w => `${hm(new Date(w.date))} · ${w.ml} мл`).join("<br>") : "Воду не записывали"}</div>`}</div></div>`
  const kGoal = g.kcalGoal || 2000
  html += `<div class="card"><h2>Еда${isT ? `<button class="act" data-do="food">+ Добавить</button>` : ""}</h2><div class="ring-row">
    ${ring(h.kcal / kGoal, h.kcal > kGoal ? "var(--red)" : "var(--gold)", num(h.kcal), "ккал")}
    <div style="flex:1" class="small muted">Белки <b style="color:var(--text)">${num(h.protein)} из ${proteinGoal()} г</b><div class="prog ${h.protein >= proteinGoal() ? "" : "gold"}" style="margin:4px 0 6px"><div style="width:${Math.min(1, (h.protein || 0) / proteinGoal()) * 100}%"></div></div>жиры <b style="color:var(--text)">${num(h.fat)} г</b> · углеводы <b style="color:var(--text)">${num(h.carbs)} г</b>
    ${isT ? `<div class="btns" style="margin-top:10px"><button class="btn gold small" data-do="photo">${ei("cam")}По фото</button></div>` : ""}</div></div>`
  html += h.food.map(f => `<div class="row" data-food="${esc(f.id)}"><div class="time">${hm(new Date(f.date))}</div><div class="grow"><div class="t">${esc(f.title || "Еда")}</div>${f.protein || f.fat || f.carbs ? `<div class="s">Б ${num(f.protein)} · Ж ${num(f.fat)} · У ${num(f.carbs)}</div>` : ""}</div><div class="amt">${num(f.kcal)}</div></div>`).join("")
  html += `</div>`
  const days = [...Array(7)].map((_, i) => addDays(t0, i - 6))
  const kc = days.map(d => live(D.food).filter(f => sameDay(f.date, d)).reduce((s, f) => s + (f.kcal || 0), 0))
  const wa = days.map(d => live(D.water).filter(w => sameDay(w.date, d)).reduce((s, w) => s + (w.ml || 0), 0))
  const mk = Math.max(1, ...kc), mw = Math.max(1, ...wa)
  if (isT) html += fastCard()
  html += weightCard()
  html += `<div class="card"><h2>Неделя: калории</h2><div class="chart">${days.map((d, i) => `<div class="col"><div class="lbl">${kc[i] ? num(kc[i]) : ""}</div><div class="b" style="height:${kc[i] / mk * 100}%"></div><div class="lbl">${WD[d.getDay()]}</div></div>`).join("")}</div></div>`
  html += `<div class="card"><h2>Неделя: вода</h2><div class="chart">${days.map((d, i) => `<div class="col"><div class="lbl">${wa[i] ? liters(wa[i]) : ""}</div><div class="b w" style="height:${wa[i] / mw * 100}%"></div><div class="lbl">${WD[d.getDay()]}</div></div>`).join("")}</div></div>`
  const money = onDay(D.money, day), spent = money.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0)
  if (!isT) html += `<div class="card"><h2>Расходы за день<span class="muted small" style="text-transform:none;letter-spacing:0">−${esc(core.money(spent))}</span></h2>${money.length ? money.map(e => `<div class="row" data-money="${esc(e.id)}"><div class="time">${hm(new Date(e.date))}</div><div class="grow"><div class="t">${esc(e.category)}</div>${e.comment ? `<div class="s">${esc(e.comment)}</div>` : ""}</div><div class="amt ${e.type === "expense" ? "exp" : "inc"}">${e.type === "expense" ? "−" : "+"}${esc(core.money(e.amount))}</div></div>`).join("") : `<div class="empty">Расходов не было</div>`}</div>`
  html += `<div class="btns"><button class="btn" data-report="week">${ei("chart")}Отчёт за неделю</button><button class="btn" data-report="month">За месяц</button><button class="btn" data-report="year">За год</button></div>`
  return html
}

const standalone = () => window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches
function renderMore() {
  const c = D.conn
  let html = ""
  if (!standalone()) html += `<div class="banner"><b>Поставьте на экран «Домой»</b>Нажмите «Поделиться» ⎋ внизу Safari → «На экран «Домой»». Приложение будет открываться отдельно и мгновенно.</div>`
  const z = IZI()
  html += iziCard()
  html += `<div class="card"><h2>Связь с виджетом</h2>`
  if (c) html += `<div class="set"><span>Таблица</span><span class="ok">✓ ${esc((c.hook.match(/\/s\/(.{8})/) || [, "подключена"])[1])}</span></div>
      <div class="set"><span>Последний обмен</span><span>${esc(ago(D.sync.at))}</span></div>
      <div class="set"><span>Уведомления на iPhone</span><span>${D.snap && D.snap.notif ? `${D.snap.notif.mine} запланировано` : "виджет старой версии — обновите MyDay.js"}</span></div>
      <div class="set"><span>Google Календарь</span>${gcalOn() ? `<span class="ok">✓ ${esc(ago(D.gcal.at))}</span>` : `<span class="exp">${esc((D.gcal && D.gcal.error) || "загружается")}</span>`}</div>
      <div class="set"><span>Ключ Claude</span>${c.key ? '<span class="ok">✓ Есть</span>' : '<span class="exp">нет</span>'}</div>
      <div class="set"><span>Маршруты в Claude Code</span><span>${routes().length ? esc(routes().map(r => r.name).join(", ")) : "нет"}</span></div>
      ${D.sync.error ? `<div class="msg exp small">${esc(D.sync.error)}</div>` : ""}
      <div class="btns" style="margin-top:10px"><button class="btn" data-do="sync">${ei("sync")}Обменяться сейчас</button>${!gcalOn() && pendingOps().length ? '<button class="btn primary" data-do="run-widget">${ei("phone")}Внести в iPhone сейчас</button>' : ""}</div>
      ${!gcalOn() && pendingOps().length ? `<div class="muted small" style="margin-top:8px">В очереди ${pendingOps().length}: ${esc(pendingOps().map(o => OP_LABEL[o.tool] || o.tool).join(", "))}. Виджет внесёт их сам при обновлении; кнопка «Внести сейчас» на секунду откроет Scriptable.</div>` : ""}`
  html += `<div class="btns" style="margin-top:10px"><button class="btn ${c ? "" : "primary"}" data-do="connect">${c ? "Подключить заново" : ei("link") + "Подключить"}</button>${c ? '<button class="btn red" data-do="disconnect">Отключить</button>' : ""}</div>
    <div class="muted small" style="margin-top:8px">Код подключения даёт виджет: в Scriptable меню → 📱 Приложение «Мой день». В нём ключ Claude и ключ таблицы — он хранится только на этом телефоне.</div></div>`
  const g = H()
  html += `<div class="card"><h2>Уведомления</h2><div class="set"><span>Подсказки и напоминания</span><span id="push-state">…</span></div>
    <div class="muted small">Подсказки помощника, напоминания, вода и «пора выезжать» приходят прямо от IZIDAY: их по расписанию (каждые 5 минут) отправляет таблица. Для «пора выезжать» разрешите приложению место.</div>
    <div class="btns" id="push-btns" style="margin-top:10px"></div></div>`
  html += `<div class="card"><h2>Цели</h2>
    <div class="set"><span>Вода в день, мл</span><input type="number" data-set="waterGoal" value="${g.waterGoal}"></div>
    <div class="set"><span>Белок в день, г</span><input type="number" data-set="proteinGoal" value="${proteinGoal()}"></div>
    <div class="set"><span>Стакан, мл</span><input type="number" data-set="glass" value="${g.glass}"></div>
    <div class="set"><span>Калории в день, ккал</span><input type="number" data-set="kcalGoal" value="${g.kcalGoal || 2000}"></div>
    <div class="set"><span>Вес, кг (для тренировок)</span><input type="number" data-set="weight" value="${g.weight}"></div></div>`
  html += `<div class="card"><h2>Кнопки виджета</h2><div class="muted small">🎤 и 💬 открывают помощника, 📷 — еду по фото, ${esc(core.CONFIG.currency)} — расход, 💧 — стакан воды. Ссылки из виджета открываются в Safari — данные там те же, через таблицу.</div></div>`
  html += `<div class="muted small" style="text-align:center;margin:14px 0">Мой день · веб-приложение</div>`
  return html
}

// ── Отчёты за неделю, месяц и год: деньги, еда, вода, активность, тренировки ──
const monthStart = key => { const [y, m] = (key || core.monthKey(new Date())).split("-").map(Number); return new Date(y, m - 1, 1) }
const MON_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
function periodOf(kind, at) {
  const d = sod(at)
  if (kind === "week") { const from = addDays(d, -((d.getDay() + 6) % 7)), to = addDays(from, 7), l = addDays(to, -1)
    return { from, to, title: `${from.getDate()} ${MON_GEN[from.getMonth()]} – ${l.getDate()} ${MON_GEN[l.getMonth()]} ${l.getFullYear()}` } }
  if (kind === "year") return { from: new Date(d.getFullYear(), 0, 1), to: new Date(d.getFullYear() + 1, 0, 1), title: `${d.getFullYear()} год` }
  return { from: new Date(d.getFullYear(), d.getMonth(), 1), to: new Date(d.getFullYear(), d.getMonth() + 1, 1), title: core.monthTitle(core.monthKey(d)) }
}
function periodStats(kind, at) {
  const p = periodOf(kind, at), now = new Date(), end = p.to < now ? p.to : addDays(sod(now), 1)
  const inP = list => live(list).filter(e => e.date >= +p.from && e.date < +p.to).sort((a, b) => a.date - b.date)
  const money = inP(D.money), food = inP(D.food), water = inP(D.water), workouts = inP(D.workouts)
  const sum = (a, k) => a.reduce((s, x) => s + (+x[k] || 0), 0)
  const exp = money.filter(e => e.type === "expense"), inc = money.filter(e => e.type === "income")
  const cats = {}; for (const e of exp) cats[e.category] = (cats[e.category] || 0) + e.amount
  const days = []
  for (let d = new Date(p.from); d < end; d = addDays(d, 1)) {
    const k = dayKey(d), h = histHealth(d) || (sameDay(d, now) && iphone().watch) || null
    const f = food.filter(x => sameDay(x.date, d)), w = water.filter(x => sameDay(x.date, d)), wk = workouts.filter(x => sameDay(x.date, d))
    days.push({ d, k, kcal: sum(f, "kcal"), water: sum(w, "ml"), steps: h && h.steps != null ? h.steps : null, active: h && h.active || 0, workouts: wk,
      spent: sum(exp.filter(x => sameDay(x.date, d)), "amount"), income: sum(inc.filter(x => sameDay(x.date, d)), "amount") })
  }
  const avg = (k, cond) => { const a = days.filter(cond); return a.length ? a.reduce((s, x) => s + x[k], 0) / a.length : 0 }
  return { p, kind, money, exp: sum(exp, "amount"), inc: sum(inc, "amount"), cash: sum(exp.filter(e => e.method === "cash"), "amount"),
    cats: Object.entries(cats).sort((a, b) => b[1] - a[1]), days, workouts,
    kcalAvg: avg("kcal", x => x.kcal > 0), waterAvg: avg("water", x => x.water > 0), stepsAvg: avg("steps", x => x.steps != null),
    stepsDays: days.filter(x => x.steps != null).length, wkMin: sum(workouts, "minutes"), wkKcal: sum(workouts, "kcal") }
}
function periodReportHTML(st) {
  const m = n => esc(core.money(n)), g = H()
  const rows = st.kind === "year"
    ? [...Array(12)].map((_, i) => { const a = st.days.filter(x => x.d.getMonth() === i); if (!a.length) return ""
        const s = k => a.reduce((t, x) => t + x[k], 0), fd = a.filter(x => x.kcal), sd = a.filter(x => x.steps != null)
        return `<tr><td>${MON_SHORT[i]}</td><td>${fd.length ? num(s("kcal") / fd.length) : "—"}</td><td>${sd.length ? num(sd.reduce((t, x) => t + x.steps, 0) / sd.length) : "—"}</td><td>${a.reduce((t, x) => t + x.workouts.length, 0) || "—"}</td><td class="expense">${s("spent") ? "−" + num(s("spent")) : "—"}</td></tr>` }).join("")
    : st.days.map(x => `<tr><td>${WD[x.d.getDay()]} ${x.d.getDate()}</td><td>${x.kcal ? num(x.kcal) : "—"}</td><td>${x.water ? liters(x.water) : "—"}</td><td>${x.steps != null ? num(x.steps) : "—"}</td><td>${x.workouts.length ? x.workouts.map(w => `${esc(w.title)} ${w.minutes}′`).join(", ") : "—"}</td><td class="expense">${x.spent ? "−" + num(x.spent) : "—"}</td></tr>`).join("")
  const head = st.kind === "year" ? "<th>Месяц</th><th>ккал/день</th><th>шагов/день</th><th>трен.</th><th>расходы</th>" : "<th>День</th><th>ккал</th><th>вода, л</th><th>шаги</th><th>тренировки</th><th>расходы</th>"
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{--bg:#F2F2F7;--card:#fff;--text:#1C1C1E;--sub:#6B7280;--line:#E5E5EA;--exp:#FF453A;--inc:#0A9F6E;--track:#EEF0F5}
@media (prefers-color-scheme:dark){:root{--bg:#000;--card:#1C1C1E;--text:#F2F2F7;--sub:#9AA1AD;--line:#2C2C2E;--track:#2C2C2E;--inc:#30D158}}
body{margin:0;padding:16px 12px 40px;background:var(--bg);color:var(--text);font:15px -apple-system,system-ui;-webkit-text-size-adjust:100%}
h1{font-size:24px;margin:0}h2{font-size:13px;margin:22px 4px 8px;color:var(--sub);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.muted{color:var(--sub)}.small{font-size:12px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.card{background:var(--card);border-radius:14px;padding:10px 12px}.card b{display:block;font-size:16px;margin-top:3px;font-variant-numeric:tabular-nums}
.list{background:var(--card);border-radius:14px;padding:2px 14px}.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.row:last-child{border-bottom:0}
.track{height:6px;border-radius:3px;background:var(--track);overflow:hidden;margin-top:5px}.bar{height:100%;background:var(--exp);border-radius:3px}
table{width:100%;border-collapse:collapse;background:var(--card);border-radius:14px;overflow:hidden;font-size:12.5px;font-variant-numeric:tabular-nums}
th,td{padding:7px 6px;text-align:right;border-bottom:1px solid var(--line)}th:first-child,td:first-child{text-align:left;white-space:nowrap}th{color:var(--sub);font-weight:600;font-size:11px}
td:nth-child(5){text-align:${st.kind === "year" ? "right" : "left"}}.expense{color:var(--exp)}.income{color:var(--inc)}b{white-space:nowrap}
</style></head><body><h1>${esc(st.p.title)}</h1><div class="muted small">Отчёт за ${st.kind === "week" ? "неделю" : st.kind === "year" ? "год" : "месяц"}</div>
<div class="cards"><div class="card"><span class="muted small">Расходы</span><b class="expense">${m(st.exp)}</b></div><div class="card"><span class="muted small">Доходы</span><b class="income">${m(st.inc)}</b></div>
<div class="card"><span class="muted small">Баланс</span><b class="${st.inc - st.exp < 0 ? "expense" : "income"}">${st.inc - st.exp < 0 ? "−" : "+"}${m(Math.abs(st.inc - st.exp))}</b></div>
<div class="card"><span class="muted small">Еда в день</span><b>${st.kcalAvg ? num(st.kcalAvg) + " ккал" : "—"}</b></div><div class="card"><span class="muted small">Вода в день</span><b>${st.waterAvg ? liters(st.waterAvg) + " л" : "—"}</b></div>
<div class="card"><span class="muted small">Шагов в день</span><b>${st.stepsDays ? num(st.stepsAvg) : "—"}</b></div></div>
<h2>Тренировки и прогулки</h2><div class="list">${st.workouts.length ? `<div class="row"><span>Всего ${st.workouts.length}</span><b>${num(st.wkMin)} мин · −${num(st.wkKcal)} ккал</b></div>` + (st.kind === "year" ? "" : st.workouts.map(w => `<div class="row"><span>${WD[new Date(w.date).getDay()]} ${new Date(w.date).getDate()} · ${esc(w.title)}</span><b>${w.minutes} мин</b></div>`).join("")) : `<div class="row"><span class="muted">Тренировок не записано</span></div>`}</div>
<h2>Расходы по категориям</h2><div class="list">${st.cats.length ? st.cats.map(([n, v]) => `<div class="row" style="display:block"><div style="display:flex;justify-content:space-between"><span>${esc(n)}</span><b>${m(v)} <span class="muted small">${Math.round(v / st.exp * 100)}%</span></b></div><div class="track"><div class="bar" style="width:${v / st.cats[0][1] * 100}%"></div></div></div>`).join("") : `<div class="row"><span class="muted">Расходов нет</span></div>`}
${st.cash ? `<div class="row"><span class="muted small">${ei("money")}наличными ${m(st.cash)} · ${ei("card")}переводом ${m(st.exp - st.cash)}</span></div>` : ""}</div>
<h2>${st.kind === "year" ? "По месяцам" : "По дням"}</h2><table><tr>${head}</tr>${rows}</table>
${st.stepsDays < st.days.length ? `<div class="muted small" style="margin:8px 4px">Шаги есть за ${st.stepsDays} из ${st.days.length} дн.: виджет присылает историю часов за последние дни. Цель воды — ${liters(g.waterGoal)} л.</div>` : ""}
</body></html>`
}
function periodReportText(st) {
  const lines = [`Отчёт: ${st.p.title}`, `Расходы ${core.money(st.exp)} · доходы ${core.money(st.inc)}`,
    `Еда в среднем ${st.kcalAvg ? num(st.kcalAvg) + " ккал" : "—"} · вода ${st.waterAvg ? liters(st.waterAvg) + " л" : "—"} · шагов ${st.stepsDays ? num(st.stepsAvg) : "—"} в день`,
    `Тренировок ${st.workouts.length}${st.workouts.length ? `, ${num(st.wkMin)} мин` : ""}`, "", "Расходы по категориям:", ...st.cats.map(([n, v]) => `— ${n}: ${core.money(v)}`)]
  return lines.join("\n")
}
function showReport(kind = "month", at = new Date()) {
  let cur = sod(at)
  const s = sheet(`<div class="seg" style="margin-bottom:10px"><button data-k="week">Неделя</button><button data-k="month">Месяц</button><button data-k="year">Год</button></div>
    <div class="month"><button data-p="-1">‹</button><b class="rt"></b><button data-p="1">›</button></div><iframe class="report"></iframe>
    <div class="btns"><button class="btn" data-a="share">Отправить текстом</button><button class="btn primary" data-a="close">Закрыть</button></div>`)
  const draw = () => {
    const st = periodStats(kind, cur), nextOff = periodOf(kind, cur).to > new Date()
    $$("[data-k]", s.el).forEach(b => b.classList.toggle("on", b.dataset.k === kind))
    $(".rt", s.el).textContent = st.p.title
    const nb = $('[data-p="1"]', s.el); nb.disabled = nextOff; nb.style.opacity = nextOff ? .3 : 1
    $("iframe", s.el).srcdoc = periodReportHTML(st)
    s.st = st
  }
  $$("[data-k]", s.el).forEach(b => b.onclick = () => { kind = b.dataset.k; draw() })
  $$("[data-p]", s.el).forEach(b => b.onclick = () => {
    const p = periodOf(kind, cur), n = +b.dataset.p
    cur = n < 0 ? addDays(p.from, -1) : p.to
    if (cur > new Date()) cur = sod(new Date())
    draw()
  })
  $('[data-a="close"]', s.el).onclick = () => s.close()
  $('[data-a="share"]', s.el).onclick = () => {
    const text = periodReportText(s.st)
    if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard.writeText(text).then(() => toast("Скопировано"))
  }
  draw()
}

function bind() {
  const v = $("#view")
  $$("[data-day]", v).forEach(b => b.onclick = () => { selDay = new Date(+b.dataset.day); render() })
  $$("[data-shift]", v).forEach(b => b.onclick = () => { selDay = addDays(selDay, +b.dataset.shift); render() })
  $$("[data-hday]", v).forEach(b => b.onclick = () => { const d = addDays(healthDay(), +b.dataset.hday); if (d <= sod(new Date())) { selDay = d; render() } })
  $$("[data-report]", v).forEach(b => b.onclick = () => showReport(b.dataset.report, tab === "money" ? monthStart(monthKey) : healthDay()))
  $$("[data-ev]", v).forEach(el => el.onclick = () => eventSheet(dayEvsCache[+el.dataset.ev]))
  $$("[data-check]", v).forEach(b => b.onclick = ev => {
    ev.stopPropagation()
    const id = b.dataset.check
    b.classList.add("on")
    const row = b.closest(".row, .tl-it"); if (row) row.classList.add("done-anim")
    remSet(id, { completed: true })
    toast("✓ Выполнено")
    setTimeout(render, 380)
  })
  $$("[data-money]", v).forEach(el => el.onclick = () => moneyForm(null, D.money.find(e => e.id === el.dataset.money)))
  $$("[data-food]", v).forEach(el => el.onclick = () => foodForm(D.food.find(e => e.id === el.dataset.food)))
  $$("[data-wk]", v).forEach(el => el.onclick = () => workoutForm(D.workouts.find(e => e.id === el.dataset.wk)))
  $$("[data-mon]", v).forEach(b => b.onclick = () => {
    const [y, m] = monthKey.split("-").map(Number)
    monthKey = core.monthKey(new Date(y, m - 1 + +b.dataset.mon, 1)); render()
  })
  $$("[data-water]", v).forEach(b => b.onclick = async () => {
    const w = b.dataset.water
    if (w === "undo") { const last = today(D.water).pop(); if (last) { remove("water", last.id); render(); toast(`Убрано ${last.ml} мл`) } return }
    if (w === "other") { const t = await ui.ask("💧 Сколько выпили?", "В миллилитрах", "", { type: "number" }); if (t && +t) addWater(Math.round(+t)) }
    else addWater(+w)
  })
  bindIzi(v)
  $$("[data-izi]", v).forEach(inp => inp.onchange = () => {
    D.izi = Object.assign({}, D.izi, { name: inp.value.trim().slice(0, 20) }); save(false); render(); toast("Сохранено") })
  $$("[data-izi-c]", v).forEach(b => b.onclick = () => {
    D.izi = Object.assign({}, D.izi, { c: b.dataset.iziC }); save(false); iziPaint(); render(); toast(`Цвет «${iziCol()[1]}»`) })
  $$("[data-izi-g]", v).forEach(b => b.onclick = () => {
    D.izi = Object.assign({}, D.izi, { g: b.dataset.iziG }); save(false)
    const sg = b.parentNode; sg.querySelector("i").style.setProperty("--i", b.dataset.iziG === "f" ? 1 : 0); $$("button", sg).forEach(x => x.classList.toggle("on", x === b))
    setTimeout(render, 400); toast(iziG("Мужской род", "Женский род")) })
  $$("[data-set]", v).forEach(inp => inp.onchange = () => {
    const n = Math.round(+inp.value)
    if (!(n > 0)) { inp.value = H()[inp.dataset.set]; return }
    core.CONFIG.health = Object.assign({}, core.CONFIG.health, { [inp.dataset.set]: n })
    if (D.conn) { D.conn.cfg = D.conn.cfg || {}; D.conn.cfg.health = core.CONFIG.health }
    save(false); toast("Сохранено")
  })
  $$("[data-shop]", v).forEach(b => b.onclick = () => { const s = D.shop.find(z => z.id === b.dataset.shop); shopToggle(b.dataset.shop); if (navigator.vibrate) navigator.vibrate(10); render(); toast(`✓ ${s ? s.title : "Куплено"}`) })
  $$("[data-fast]", v).forEach(b => b.onclick = () => { const k = b.dataset.fast
    if (k === "stop") { const f = fastStop(); render(); return toast(f ? `Голодание: ${durTxt(f.end - f.start)}` : "") }
    const f = fastStart(+k); render(); toast(`⏱ Окно откроется в ${hm(new Date(f.start + f.hours * 3600e3))}`) })
  $$("[data-goal]", v).forEach(b => b.onclick = () => { const g = goalToggle(b.dataset.goal); if (navigator.vibrate) navigator.vibrate(10); render(); if (g && g.done) toast("🎯 Готово!") })
  $$("[data-goals]", v).forEach(b => b.onclick = () => goalsForm(b.dataset.goals))
  $$("[data-gsteps]", v).forEach(b => b.onclick = () => stepsForm(b.dataset.gsteps))
  $$("[data-pf]", v).forEach(b => b.onclick = () => { plansF = b.dataset.pf; render(); scrollView(false) })
  $$("[data-list]", v).forEach(b => b.onclick = () => listOpen(b.dataset.list))
  $$("[data-chore]", v).forEach(el => el.onclick = () => choreForm(D.goals.find(z => z.id === el.dataset.chore)))
  $$("[data-chore-done]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); const c = choreDone(b.dataset.choreDone); if (navigator.vibrate) navigator.vibrate(10); b.classList.add("on"); setTimeout(render, 300); toast(`Готово. Снова — ${choreWhen(c)}`) })
  $$("[data-hd]", v).forEach(b => b.onclick = () => { const h = D.habits.find(z => z.id === b.dataset.hd), on = habitToggle(h, new Date(+b.dataset.hdd)); if (navigator.vibrate) navigator.vibrate(10); render()
    if (on && !h.bad && sameDay(+b.dataset.hdd, new Date())) { const st = habitStreak(h); if (st > 1) toast(`Серия ${st} ${plural(st, "день", "дня", "дней")}`) } })
  $$("[data-pomo]", v).forEach(b => b.onclick = () => { if (b.dataset.pomo === "stop") { const p = pomoStop(); render(); return toast(p && p.full ? "🍅 Готово" : "Помидор остановлен") } pomoAsk() })
  $$("[data-habit]", v).forEach(b => b.onclick = () => {
    const h = D.habits.find(z => z.id === b.dataset.habit)
    const on = habitToggle(h, selDay > sod(new Date()) ? new Date() : selDay)
    if (navigator.vibrate) navigator.vibrate(10)
    render()
    if (on && !h.bad) { const st = habitStreak(h); if (st > 1) toast(`🔥 ${st} ${plural(st, "день", "дня", "дней")} подряд`) }
  })
  $$("[data-recur]", v).forEach(el => el.onclick = () => recurAsk(D.recur.find(z => z.id === el.dataset.recur)))
  $$("[data-recur-pay]", v).forEach(b => b.onclick = ev => {
    ev.stopPropagation()
    const r = D.recur.find(z => z.id === b.dataset.recurPay)
    recurPay(r); render()
    const n = budgetNote(r.category); toast(`−${core.money(r.amount)} · ${r.title}${n ? " · " + n : ""}`)
  })
  $$("[data-brief]", v).forEach(b => b.onclick = () => brief(b.dataset.brief))
  $$("[data-do]", v).forEach(b => { if (DO[b.dataset.do]) b.onclick = () => DO[b.dataset.do]() })
  if (tab === "today") bindToday(v)
  if (tab === "cal") bindCal(v)
  if (tab === "money") bindMoney(v)
  const inp = $("#chat-in", v)
  if (inp) {
    inp.oninput = () => grow(inp)
    inp.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (voice) return voiceSendNow(); const t = inp.value; inp.value = ""; grow(inp); voiceSent(); chatSend(t) } }
    $(".chat-bar .send", v).onclick = () => { if (voice) return voiceSendNow(); if (!inp.value.trim()) return chatBusy && !askWait ? chatStop() : micStart(); const t = inp.value; inp.value = ""; grow(inp); voiceSent(); chatSend(t) }
    setBusyUI()
    // тронули текст во время записи — не отправлять по паузе: можно поправить и нажать ➤
    inp.addEventListener("focus", () => { if (voice) { const t = inp.value, r = rec; voiceReset(); try { r && r.stop() } catch (e) {} inp.value = t; grow(inp); toast("✎ Поправьте и нажмите ➤") } })
    if (voice) { inp.placeholder = "Слушаю… ➤ — отправить сразу"; if (voice.text) { inp.value = voice.text; grow(inp) } }
    // голос — одна кнопка: большая «Изи» внизу (держать — как рация, ещё раз нажать — разговор); справа только ➤, когда есть текст
    $(".chat-bar .cam", v).onclick = e => plusMenu(e.currentTarget)
    grow(inp)
    attTray()
    bindChatList()
  }
}

const DO = {
  talk: () => talkOpen(), "izi-voice": () => voicePicker(),
  event: () => eventForm(), reminder: () => reminderForm(), food: () => foodMenu(), workout: () => workoutForm(), photo: () => photoPrompt(),
  expense: () => moneyForm("expense"), income: () => moneyForm("income"), water: () => addWater(H().glass || 250),
  "push-on": () => pushEnable(),
  "go-today": () => { selDay = sod(new Date()); stripCenter = null; stripJump = true; render(); if (stripJump) stripInit(null) },
  "tab-money": () => setTab("money"), "tab-health": () => setTab("health"), report: () => showReport("month"),
  sheet: () => window.open(D.conn.sheetUrl, "_blank"),
  budgets: () => budgetForm(), "recur-add": () => recurForm(), "chore-add": () => choreForm(), "list-add": () => listForm(), habits: () => habitsForm(), weight: () => weightForm(), shop: () => shopForm(), kids: () => kidsForm(), goals: () => goalsForm("month"), search: () => searchSheet(),
  sync: () => (!D.conn || !D.conn.hook) ? DO.connect() : sync().then(ok => toast(ok ? "Обновлено" : `Не получилось: ${D.sync.error || "нет связи"}`)),
  "run-widget": () => sync().then(runWidgetNow),
  autoconnect: () => autoConnect(),
  connect: async () => {
    const t = await ui.ask("Подключить к виджету", "Вставьте код из виджета: Scriptable → меню → 📱 Приложение «Мой день» → «Скопировать код подключения».", "", { multiline: true, ok: "Подключить" })
    if (t) connect(t)
  },
  disconnect: async () => {
    const b = await ui.confirm("Отключить?", `<div class="msg">Ключи удалятся с этого телефона. Записи останутся в таблице и в виджете.</div>`, ["Отмена", "Отключить"])
    if (b === "Отключить") { D = {}; localStorage.removeItem(STORE); load(); render() }
  },
  memory: async () => {
    while (true) {
      const f = memFacts().slice().reverse()
      if (!f.length) return ui.info("🧠 Память помощника", "Пока пусто. Помощник запоминает важное из разговоров сам; можно сказать «запомни, что…».")
      const i = await ui.choose("🧠 Память помощника", `${f.length} ${plural(f.length, "факт", "факта", "фактов")} · ${memChats().length} ${plural(memChats().length, "разговор", "разговора", "разговоров")} в сводках. Нажмите факт, чтобы забыть его.`, f.map(m => m.text))
      if (i < 0) return
      if ((await ui.confirm("Забыть?", `<div class="msg">${esc(f[i].text)}</div>`, ["Отмена", "Забыть"])) === "Забыть") { remove("memory", f[i].id); save() }
    }
  },
  "chat-clear": async () => {
    const b = await ui.confirm("Очистить чат?", `<div class="msg">Экран чата очистится. Помощник сохранит краткую сводку разговора в память и сможет найти его потом.</div>`, ["Отмена", "Очистить"])
    if (b === "Очистить") {
      D.chatArchive = D.chatArchive.concat(D.chat.map(m => ({ role: m.role, text: m.text, prompt: m.prompt, at: m.at, local: m.local }))).slice(-1500)
      D.chat = []; save(false); render(); memorize(true)
    }
  },
}

// ───────────── Бюджеты, регулярные платежи, привычки, вес, поиск ─────────────
// budgets: { id: "b:<категория>", category, limit } — лимит расходов на месяц
// recur:   { id, title, type, amount, method, category, day (число месяца), paid: { "YYYY-MM": id операции } }
// habits:  { id, title, emoji, bad (true — хочу бросить), archived }
// hlog:    { id: "h:<привычка>:<YYYY-MM-DD>", date, habit, day } — отметка за день; снятая отметка — «надгробие»
// weight:  { id, date, kg }
const budgetOf = cat => { const b = live(D.budgets).find(x => x.category === cat); return b && b.limit > 0 ? b.limit : 0 }
function setBudget(cat, limit) {
  limit = Math.round(+limit || 0)
  if (limit > 0) upsert("budgets", { id: "b:" + cat, date: Date.now(), category: cat, limit })
  else if (D.budgets.some(x => x.id === "b:" + cat && !x.deleted)) remove("budgets", "b:" + cat)
}
function budgetState(cat, key = core.monthKey(new Date())) {
  const limit = budgetOf(cat)
  if (!limit) return null
  const spent = core.monthTotals(live(D.money), key).cats.expense[cat] || 0
  return { category: cat, limit, spent, left: limit - spent, p: spent / limit }
}
// Строка-предупреждение после расхода: «⚠️ Еда: 9 200 из 10 000 ฿»
function budgetNote(cat, date = Date.now()) {
  const b = budgetState(cat, core.monthKey(new Date(date)))
  if (!b || b.p < 0.8) return ""
  return b.p > 1 ? `⚠️ ${cat}: лимит превышен на ${core.money(b.spent - b.limit)}` : `⚠️ ${cat}: ${num(b.spent)} из ${core.money(b.limit)}`
}
function budgetForm() {
  const cats = core.CONFIG.categories.expense.map(c => c[0])
  const t = core.monthTotals(live(D.money), core.monthKey(new Date()))
  const s = sheet(`<h3>Лимиты на месяц</h3><div class="msg">Сколько готовы тратить в месяц по категории. Пусто — без лимита. Помощник предупредит, когда потрачено 80%.</div>
    ${cats.map(c => `<div class="set"><span>${esc(c)}<span class="muted small"> · ${num(t.cats.expense[c] || 0)}</span></span><input type="number" inputmode="numeric" data-b="${esc(c)}" value="${budgetOf(c) || ""}" placeholder="—"></div>`).join("")}
    <div class="btns" style="margin-top:12px"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => { $$("[data-b]", s.el).forEach(i => { if (Math.round(+i.value || 0) !== budgetOf(i.dataset.b)) setBudget(i.dataset.b, i.value) }); s.close(); render(); toast("Лимиты сохранены") }
}

// Регулярные платежи: срок в этом месяце, оплачен ли
function recurDue(r, at = new Date()) {
  const y = at.getFullYear(), m = at.getMonth(), last = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(Math.max(1, r.day || 1), last))
}
const recurPaid = (r, key = core.monthKey(new Date())) => !!(r.paid && r.paid[key])
// Неоплаченные в этом месяце, срок через 3 дня или раньше
const recurSoon = () => live(D.recur).filter(r => r.type !== "income" && !recurPaid(r) && recurDue(r) < addDays(sod(new Date()), 4)).sort((a, b) => recurDue(a) - recurDue(b))
function recurPay(r) {
  const now = new Date(), key = core.monthKey(now)
  const m = upsert("money", { id: `f${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, date: +now, type: r.type || "expense", amount: r.amount, method: r.method || "transfer",
    category: r.category, comment: r.title })
  upsert("recur", Object.assign({}, r, { paid: Object.assign({}, r.paid, { [key]: m.id }) }))
  return m
}
function recurLabel(r) {
  if (recurPaid(r)) return "✓ оплачено в этом месяце"
  const d = recurDue(r), t0 = sod(new Date()), n = Math.round((d - t0) / 864e5)
  return n < 0 ? `просрочено с ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}` : n === 0 ? "сегодня" : n === 1 ? "завтра" : `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`
}
function recurForm(r) {
  const e = r || { title: "", amount: "", day: new Date().getDate(), method: "transfer", category: "", type: "expense" }
  const cats = core.CONFIG.categories.expense.map(c => c[0])
  let cat = e.category || "", method = e.method
  const s = sheet(`<h3>${r ? "Регулярный платёж" : "🔁 Новый регулярный платёж"}</h3>
    <div class="field"><input id="p-t" placeholder="Что: аренда, интернет, Netflix" value="${esc(e.title)}"></div>
    <div class="field"><label>Сумма, ${esc(core.CONFIG.currency)}</label><input id="p-a" type="number" inputmode="decimal" value="${e.amount}"></div>
    <div class="field"><label>Какого числа каждый месяц</label><input id="p-d" type="number" inputmode="numeric" min="1" max="31" value="${e.day}"></div>
    <div class="field"><div class="seg" id="p-m"><button data-m="cash">${ei("money")}Наличные</button><button data-m="transfer">${ei("card")}Перевод / карта</button></div></div>
    <div class="field"><label>Категория</label><div class="chips" id="p-c">${cats.map(c => `<button class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
    <div class="btns">${r ? '<button class="btn red" data-a="del">Удалить</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  const paint = () => { $$("#p-m button", s.el).forEach(b => b.classList.toggle("on", b.dataset.m === method)); $$("#p-c .chip", s.el).forEach(b => b.classList.toggle("on", b.dataset.c === cat)) }
  paint()
  $$("#p-m button", s.el).forEach(b => b.onclick = () => { method = b.dataset.m; paint() })
  $$("#p-c .chip", s.el).forEach(b => b.onclick = () => { cat = b.dataset.c; paint() })
  $("#p-t", s.el).oninput = ev => { if (r) return; const p = core.parseMoney(" " + ev.target.value + " ", "expense"); if (p.category && p.category !== "Другое") { cat = p.category; paint() } }
  if (!r) setTimeout(() => $("#p-t", s.el).focus(), 250)
  $('[data-a="no"]', s.el).onclick = () => s.close()
  if (r) $('[data-a="del"]', s.el).onclick = async () => {
    if ((await ui.confirm("Удалить платёж?", `<div class="msg">${esc(r.title)} больше не будет напоминать. Прошлые операции останутся.</div>`, ["Отмена", "Удалить"])) !== "Удалить") return
    remove("recur", r.id); s.close(); render()
  }
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#p-t", s.el).value.trim(), amount = parseFloat(String($("#p-a", s.el).value).replace(",", ".")), day = Math.round(+$("#p-d", s.el).value)
    if (!title) return toast("Напишите, что за платёж")
    if (!(amount > 0)) return toast("Введите сумму")
    if (!(day >= 1 && day <= 31)) return toast("Число от 1 до 31")
    upsert("recur", Object.assign({}, r || { id: uid("p"), date: Date.now(), type: "expense", paid: {} }, { title, amount, day, method, category: cat || cats[cats.length - 1] }))
    s.close(); render(); toast("🔁 Сохранено")
  }
}
async function recurAsk(r) {
  const b = await ui.confirm(r.title, deEmo(`<div class="msg">${esc(core.money(r.amount))} · ${r.method === "cash" ? "💵 наличные" : "💳 перевод"} · ${esc(r.category)} · каждое ${r.day} число<br>${esc(recurLabel(r))}</div>`),
    recurPaid(r) ? ["Изменить", "Готово"] : ["Изменить", "✓ Оплачено"])
  if (b === "Изменить") return recurForm(r)
  if (b === "✓ Оплачено") { recurPay(r); render(); const n = budgetNote(r.category); toast(`−${core.money(r.amount)} · ${r.title}${n ? " · " + n : ""}`) }
}

// Привычки
const habitList = () => live(D.habits).filter(h => !h.archived).sort((a, b) => (a.date || 0) - (b.date || 0))
const hlogId = (h, d) => `h:${h.id}:${dayKey(d)}`
const habitOn = (h, d) => D.hlog.some(x => x.id === hlogId(h, d) && !x.deleted)
function habitToggle(h, d, on = !habitOn(h, d)) {
  if (on) upsert("hlog", { id: hlogId(h, d), date: +sod(d), habit: h.id, day: dayKey(d) })
  else if (habitOn(h, d)) remove("hlog", hlogId(h, d))
  return on
}
// Серия: для полезной — дни подряд с отметкой (сегодня можно ещё не отметить); для вредной — дни без неё
function habitStreak(h, at = new Date()) {
  let d = sod(at), n = 0
  if (h.bad) {
    const start = sod(h.date || Date.now())
    for (; n < 3650 && d >= start && !habitOn(h, d); d = addDays(d, -1)) n++
    return n
  }
  if (!habitOn(h, d)) d = addDays(d, -1)
  for (; n < 3650 && habitOn(h, d); d = addDays(d, -1)) n++
  return n
}
const habitCount = (h, from, to) => D.hlog.filter(x => !x.deleted && x.habit === h.id && x.date >= +from && x.date < +to).length
// «алкоголь» найдёт «Без алкоголя»: сравниваем основы слов без окончаний
const stems = s => String(s || "").toLowerCase().replace(/ё/g, "е").split(/[^a-zа-я0-9]+/).filter(w => w.length > 2 && !["без", "не", "бросаю", "бросить"].includes(w)).map(w => w.slice(0, Math.max(3, w.length - 2)))
function findHabit(q) {
  const s = String(q || "").toLowerCase().trim(), qs = stems(q)
  return habitList().find(h => h.id === q || h.title.toLowerCase() === s) || habitList().find(h => h.title.toLowerCase().includes(s) || s.includes(h.title.toLowerCase())) ||
    habitList().find(h => { const hs = stems(h.title); return qs.length && qs.every(w => hs.some(x => x.startsWith(w) || w.startsWith(x))) })
}
function habitsCard(day) {
  const list = habitList(), isT = sameDay(day, new Date())
  let html = `<div class="card"><h2>Привычки<button class="act" data-do="habits">${list.length ? "Изменить" : "+ Добавить"}</button></h2>`
  if (!list.length) return html + `<div class="empty">Отмечайте каждый день то, что хотите делать (зарядка, чтение) или бросить (алкоголь, курение) — приложение посчитает серию.</div></div>`
  html += `<div class="habits">${list.map(h => {
    const on = habitOn(h, day), st = habitStreak(h, day)
    const sub = h.bad ? (on ? "было" : `${st} ${plural(st, "день", "дня", "дней")} без`) : (st ? `${st} ${plural(st, "день", "дня", "дней")} подряд` : isT ? "ещё не сегодня" : "не было")
    return `<button class="habit ${on ? "on" : ""} ${h.bad ? "bad" : ""}" data-habit="${esc(h.id)}"><i>${ICO[habitIco(h)]}</i><b>${esc(h.title)}</b><span>${esc(sub)}</span></button>`
  }).join("")}</div></div>`
  return html
}
const HABIT_ICO = ["activity", "dumbbell", "book", "sun", "apple", "moon", "drop", "pill", "pen", "phone", "heart", "ban"]
const EMO_ICO = { "🏃": "activity", "📖": "book", "🧘": "sun", "💪": "dumbbell", "🥗": "apple", "😴": "moon", "🍷": "ban", "🚬": "ban", "📵": "phone", "🍬": "ban", "💊": "pill", "✍️": "pen", "💧": "drop" }
const ICO_EMO = { activity: "🏃", dumbbell: "💪", book: "📖", sun: "🧘", apple: "🥗", moon: "😴", drop: "💧", pill: "💊", pen: "✍️", phone: "📵", heart: "❤️", ban: "🚫" }   // смайлик — для виджета
const habitIco = h => (h.ico && ICO[h.ico] ? h.ico : EMO_ICO[h.emoji]) || (h.bad ? "ban" : "check")
function habitsForm() {
  const s = sheet(`<h3>Привычки</h3>
    <div id="h-list">${habitList().map(h => `<div class="row">${icoBox(habitIco(h), h.bad ? "red" : "")}<div class="grow"><div class="t">${esc(h.title)}</div><div class="s">${h.bad ? "бросаю" : "хочу делать"}</div></div><button class="btn small red" data-del="${esc(h.id)}">Убрать</button></div>`).join("") || '<div class="empty">Пока нет привычек</div>'}</div>
    <div class="field" style="margin-top:12px"><label>Новая привычка</label><input id="h-t" placeholder="Зарядка, чтение, без алкоголя…"></div>
    <div class="field"><label>Значок</label><div class="icos" id="h-e">${HABIT_ICO.map(e => `<button class="icon-pick" data-e="${e}">${icoBox(e, e === "ban" ? "red" : "")}</button>`).join("")}</div></div>
    <div class="field"><div class="seg" id="h-k"><button data-k="good" class="on">Хочу делать</button><button data-k="bad">Хочу бросить</button></div></div>
    <div class="btns"><button class="btn" data-a="no">Готово</button><button class="btn primary" data-a="ok">Добавить</button></div>`, { onClose: () => render() })
  let emoji = "", bad = false
  const paint = () => { $$("#h-e button", s.el).forEach(b => b.classList.toggle("on", b.dataset.e === emoji)); $$("#h-k button", s.el).forEach(b => b.classList.toggle("on", (b.dataset.k === "bad") === bad)) }
  $$("#h-e button", s.el).forEach(b => b.onclick = () => { emoji = b.dataset.e; paint() })
  $$("#h-k button", s.el).forEach(b => b.onclick = () => { bad = b.dataset.k === "bad"; paint() })
  $("#h-t", s.el).oninput = ev => { if (/алког|кур|сигар|сладк|соцсет|телефон|без /i.test(ev.target.value) && !bad) { bad = true; paint() } }
  $$("[data-del]", s.el).forEach(b => b.onclick = async () => {
    const h = D.habits.find(x => x.id === b.dataset.del)
    if ((await ui.confirm("Убрать привычку?", `<div class="msg">«${esc(h.title)}» исчезнет с экрана. Отметки сохранятся в истории.</div>`, ["Отмена", "Убрать"])) !== "Убрать") return
    upsert("habits", Object.assign({}, h, { archived: true })); s.close(); habitsForm()
  })
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#h-t", s.el).value.trim()
    if (!title) return toast("Напишите привычку")
    upsert("habits", { id: uid("h"), date: Date.now(), title, ico: emoji || (bad ? "ban" : "check"), emoji: ICO_EMO[emoji] || (bad ? "🚫" : "✓"), bad })
    s.close(); habitsForm(); toast("Добавлено")
  }
}

// Вес
const weights = () => live(D.weight).filter(w => w.kg > 0).sort((a, b) => a.date - b.date)
function logWeight(kg, date = Date.now()) {
  kg = Math.round(+kg * 10) / 10
  const d = new Date(date), old = live(D.weight).find(w => sameDay(w.date, d))
  const rec = upsert("weight", Object.assign({}, old || { id: uid("w") }, { date: +d, kg }))
  if (sameDay(d, new Date()) || !weights().some(w => w.date > +d)) {   // последний вес — для расчёта тренировок
    core.CONFIG.health = Object.assign({}, core.CONFIG.health, { weight: Math.round(kg) })
    if (D.conn) { D.conn.cfg = D.conn.cfg || {}; D.conn.cfg.health = core.CONFIG.health }
    save()
  }
  return rec
}
const kgs = n => (Math.round(n * 10) / 10).toString().replace(".", ",")
function weightCard() {
  const list = weights(), last = list[list.length - 1]
  let html = `<div class="card"><h2>Вес<button class="act" data-do="weight">+ Записать</button></h2>`
  if (!last) return html + `<div class="empty">Взвешивайтесь раз в несколько дней — здесь появится график. Можно сказать помощнику «вешу 78,5».</div></div>`
  const month = list.filter(w => w.date > Date.now() - 30 * 864e5), first = month[0] || last, diff = last.kg - first.kg
  html += `<div class="wt"><b>${kgs(last.kg)} кг</b><span class="muted small">${esc(dayName(new Date(last.date)))}${month.length > 1 ? ` · за 30 дней ${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${kgs(Math.abs(diff))} кг` : ""}</span></div>`
  const pts = list.slice(-30)
  if (pts.length > 1) {
    const lo = Math.min(...pts.map(w => w.kg)) - 0.5, hi = Math.max(...pts.map(w => w.kg)) + 0.5, t0 = pts[0].date, t1 = pts[pts.length - 1].date
    const xy = pts.map(w => [((w.date - t0) / Math.max(1, t1 - t0)) * 300, 70 - ((w.kg - lo) / (hi - lo)) * 64].map(v => v.toFixed(1)))
    html += `<svg class="spark" viewBox="-4 0 308 74" preserveAspectRatio="none"><polyline points="${xy.map(p => p.join(",")).join(" ")}"/>${xy.slice(-1).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5"/>`).join("")}</svg>`
  }
  return html + `</div>`
}
async function weightForm() {
  const last = weights().pop()
  const t = await ui.ask("⚖️ Вес", "В килограммах, например 78,5", last ? kgs(last.kg) : "", { type: "text", ok: "Сохранить" })
  const kg = parseFloat(String(t || "").replace(",", "."))
  if (!(kg > 20 && kg < 400)) { if (t) toast("Не понял вес"); return }
  logWeight(kg); render(); toast(`⚖️ ${kgs(kg)} кг`)
}

// ── Список покупок: голосом «купить молоко», у магазина из списка — напоминание (проверяет виджет) ──
const normT = s => String(s || "").toLowerCase().replace(/ё/g, "е").trim()
const shopOpen = () => live(D.shop).filter(s => !s.done).sort((a, b) => a.date - b.date)
const shopStores = () => live(D.places).filter(p => p.shop && !p.done)
function shopAdd(items) {
  const out = []
  for (const t of items.map(s => String(s).replace(/^(купить|ещё|еще)\s+/i, "").trim()).filter(Boolean))
    if (!shopOpen().some(s => normT(s.title) === normT(t))) out.push(upsert("shop", { id: uid("b"), date: Date.now() + out.length, title: t.charAt(0).toUpperCase() + t.slice(1), done: false }))
  return out
}
function shopFind(t) { const n = normT(t); return shopOpen().find(s => normT(s.title) === n) || shopOpen().find(s => normT(s.title).includes(n) || n.includes(normT(s.title))) }
function shopToggle(id, done = true) { const s = D.shop.find(x => x.id === id); if (s) upsert("shop", Object.assign({}, s, { done, doneAt: done ? Date.now() : 0 })) }
function shopCard() {
  const list = shopOpen(), st = shopStores()
  let html = `<div class="card" id="shop"><h2>Покупки<button class="act" data-do="shop">+ Добавить</button></h2>`
  html += list.map(s => `<div class="row"><button class="check" data-shop="${esc(s.id)}"></button><div class="grow"><div class="t">${esc(s.title)}</div></div></div>`).join("")
  html += `<div class="muted small" style="margin:8px 4px 0">${st.length ? ei("cart") + "Напомню у: " + st.map(p => esc(p.query)).join(", ") : "Скажите помощнику «напоминай о покупках у Big C» — пришлю список, когда будете рядом."}</div>`
  return html + `</div>`
}
async function shopForm() {
  const t = await ui.ask("🛒 Купить", "Молоко, хлеб, яйца", "", { type: "text", ok: "Добавить" })
  if (!t) return
  const a = shopAdd(t.split(/[,;\n]|\s+и\s+/))
  render(); toast(a.length ? `🛒 В списке: ${shopOpen().length}` : "Уже в списке")
}

// ── Дела детей по дням недели: кружки, кто забирает, что взять. Пуш утром в 7:00 и за 30 минут (таблица) ──
const WD7 = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]   // 1 — пн … 7 — вс
const kidsList = () => live(D.kids).filter(k => k.title)
const wdOf = d => ((d.getDay() + 6) % 7) + 1
const kidsOn = d => kidsList().filter(k => (k.days || []).map(Number).includes(wdOf(d))).sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")))
function kidsCard(day) {
  const l = kidsOn(day)
  if (!l.length) return ""
  return `<div class="card" id="kids"><h2>Дети<button class="act" data-do="kids">Изменить</button></h2>${l.map(k => `<div class="row"><div class="time">${esc(k.time || "")}</div><div class="grow"><div class="t">${esc(k.title)}${k.kid ? ` · ${esc(k.kid)}` : ""}</div>${k.take || k.who ? `<div class="s">${[k.who && "забирает " + k.who, k.take && "взять: " + k.take].filter(Boolean).map(esc).join(" · ")}</div>` : ""}</div></div>`).join("")}</div>`
}
function kidsForm() {
  const s = sheet(`<h3>Дела детей</h3>
    <div>${kidsList().map(k => `<div class="row"><div class="grow"><div class="t">${esc(k.title)}${k.kid ? ` · ${esc(k.kid)}` : ""}</div><div class="s">${(k.days || []).map(d => WD7[d - 1]).join(", ")}${k.time ? " · " + esc(k.time) : ""}${k.take ? " · взять: " + esc(k.take) : ""}</div></div><button class="btn small red" data-del="${esc(k.id)}">Убрать</button></div>`).join("") || '<div class="empty">Кружки, секции, кто забирает, что взять в школу — утром придёт пуш на день</div>'}</div>
    <div class="field" style="margin-top:12px"><label>Что</label><input id="k-t" placeholder="Плавание, рисование, забрать из школы…"></div>
    <div class="field"><div class="chips" id="k-d">${WD7.map((d, i) => `<button class="chip" data-d="${i + 1}">${d}</button>`).join("")}</div></div>
    <div class="field"><label>Во сколько</label><input id="k-h" type="time"></div>
    <div class="field"><label>Кто из детей</label><input id="k-k" placeholder="Необязательно"></div>
    <div class="field"><label>Кто забирает</label><input id="k-w" placeholder="Необязательно"></div>
    <div class="field"><label>Что взять</label><input id="k-x" placeholder="Форма, очки, сменка…"></div>
    <div class="btns"><button class="btn" data-a="no">Готово</button><button class="btn primary" data-a="ok">Добавить</button></div>`, { onClose: () => render() })
  const days = new Set()
  $$("#k-d .chip", s.el).forEach(b => b.onclick = () => { const d = +b.dataset.d; days.has(d) ? days.delete(d) : days.add(d); b.classList.toggle("on", days.has(d)) })
  $$("[data-del]", s.el).forEach(b => b.onclick = () => { remove("kids", b.dataset.del); s.close(); kidsForm() })
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#k-t", s.el).value.trim()
    if (!title) return toast("Напишите, что за дело")
    if (!days.size) return toast("Выберите дни недели")
    upsert("kids", { id: uid("c"), date: Date.now(), title, days: [...days].sort(), time: $("#k-h", s.el).value || "", kid: $("#k-k", s.el).value.trim(), who: $("#k-w", s.el).value.trim(), take: $("#k-x", s.el).value.trim() })
    s.close(); kidsForm(); toast("Добавлено")
  }
}

// ── Интервальное голодание: таймер; когда окно откроется — пуш (таблица) ──
const durTxt = ms => { const m = Math.max(0, Math.round(ms / 60e3)); return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин` }
const fastNow = () => live(D.fast).filter(f => !f.end && f.start).sort((a, b) => b.start - a.start)[0] || null
function fastStart(hours) { return fastNow() || upsert("fast", { id: uid("g"), date: Date.now(), start: Date.now(), hours: Math.max(10, Math.min(48, Math.round(+hours || 16))) }) }
function fastStop() { const f = fastNow(); return f ? upsert("fast", Object.assign({}, f, { end: Date.now() })) : null }
function fastCard() {
  const f = fastNow()
  let html = `<div class="card" id="fast"><h2>Голодание</h2>`
  if (!f) {
    const last = live(D.fast).filter(x => x.end).sort((a, b) => b.end - a.end)[0]
    return html + `<div class="btns"><button class="btn" data-fast="14">14:10</button><button class="btn primary" data-fast="16">16:8</button><button class="btn" data-fast="18">18:6</button></div>
      <div class="muted small" style="margin-top:8px">${last ? `Прошлое: ${durTxt(last.end - last.start)}` : "Нажмите после последней еды — когда окно откроется, придёт пуш."}</div></div>`
  }
  const el = Date.now() - f.start, goal = f.hours * 3600e3, left = goal - el
  return html + `<div class="wt"><b>${durTxt(el)}</b><span class="muted small">${left > 0 ? `из ${f.hours} ч · окно в ${hm(new Date(f.start + goal))}` : "окно открыто — можно есть"}</span></div>
    <div class="prog ${left > 0 ? "gold" : ""}"><div style="width:${Math.min(1, el / goal) * 100}%"></div></div>
    <div class="btns" style="margin-top:10px"><button class="btn small" data-fast="stop">${left > 0 ? "Прервать" : "Поел — закончить"}</button></div></div>`
}

// ── Цели: на месяц, «100 желаний» (с подсказками), «10 мечт» — крупное, на срок до 2 лет, с разбивкой на шаги ──
const GOAL_KIND = { month: ["🎯", "На месяц"], wish: ["✨", "100 желаний"], dream: ["🌠", "10 мечт"] }
const GOAL_MAX = { month: 0, wish: 100, dream: 10 }
const GOAL_ICO = { month: "target", wish: "star", dream: "summit" }
const WISH_HINTS = ["Куда хочу поехать?", "Чему хочу научиться?", "Что хочу попробовать впервые?", "Что хочу сделать вместе с детьми?", "Что хочу для семьи и дома?",
  "Каким хочу чувствовать своё тело?", "Сколько хочу зарабатывать и откладывать?", "С кем хочу встретиться или подружиться?", "Какое приключение хочу пережить?",
  "Что хочу сделать для других?", "Какие книги и фильмы хочу открыть?", "Что хочу создать своими руками?", "Какой рабочий навык хочу прокачать?",
  "Что хочу купить себе в радость?", "Какой праздник хочу устроить?", "От чего хочу освободиться?", "Где хочу встретить рассвет?", "Каким спортом хочу заняться?",
  "Что хочу сделать для родителей?", "О чём мечтал в детстве?"]
const DREAM_HINTS = ["Большая поездка", "Дом, квартира, машина", "Свой проект или бизнес", "Сумма на счёте", "Форма и здоровье", "Новый уровень в работе", "Важное для семьи", "Навык, на который нужен год"]
const curMonth = () => core.monthKey(new Date())
const goalsOf = (kind, month = curMonth()) => live(D.goals).filter(g => g.title && g.kind === kind && (kind !== "month" || g.month === month))
  .sort((a, b) => (!!a.done - !!b.done) || a.date - b.date)
const yearAhead = (n = 1) => { const d = new Date(); d.setMonth(d.getMonth() + Math.round(n * 12)); return dayKey(d) }
const DREAM_MAX_Y = 2   // мечта: по умолчанию год, не дальше 2 лет
function goalAdd(kind, items, due) {
  if (!GOAL_KIND[kind]) return { error: "kind: month, wish или dream" }
  const have = goalsOf(kind), out = []
  if (kind === "dream" && due) { if (!/^\d{4}-\d\d-\d\d$/.test(due)) due = ""; else if (due > yearAhead(DREAM_MAX_Y)) due = yearAhead(DREAM_MAX_Y) }
  for (const t of items.map(s => String(s).trim()).filter(Boolean)) {
    if (GOAL_MAX[kind] && have.length + out.length >= GOAL_MAX[kind]) break
    if ([...have, ...out].some(g => normT(g.title) === normT(t))) continue
    out.push(upsert("goals", Object.assign({ id: uid("o"), date: Date.now() + out.length, kind, title: t.charAt(0).toUpperCase() + t.slice(1), done: false },
      kind === "month" ? { month: curMonth() } : {}, kind === "dream" ? { due: due || yearAhead() } : {})))
  }
  return { added: out, total: have.length + out.length }
}
function goalFind(t, kind) { const n = normT(t), l = live(D.goals).filter(g => g.title && (kind ? g.kind === kind : GOAL_KIND[g.kind]) && (g.kind !== "month" || g.month === curMonth()))
  return l.find(g => g.id === t || normT(g.title) === n) || l.find(g => normT(g.title).includes(n) || n.includes(normT(g.title))) }
function wishToGoal(id) {
  const w = D.goals.find(x => x.id === id); if (!w) return null
  const r = goalAdd("month", [w.title]), g = r.added[0] || goalsOf("month").find(x => normT(x.title) === normT(w.title))
  if (g) { upsert("goals", Object.assign({}, g, { from: w.id, steps: stepsOf(g).length ? g.steps : stepsOf(w) })); upsert("goals", Object.assign({}, w, { toMonth: curMonth() })) }
  return g
}
function goalToggle(id, done) { const g = D.goals.find(x => x.id === id); if (g) return upsert("goals", Object.assign({}, g, { done: done == null ? !g.done : !!done, doneAt: (done == null ? !g.done : done) ? Date.now() : 0 })) }
const goalsLeft = () => { const p = new Date(); p.setDate(0); return goalsOf("month", core.monthKey(p)).filter(g => !g.done) }   // незавершённые прошлого месяца
const dueTxt = d => { if (!d) return ""; const [y, m] = d.split("-").map(Number); return `до ${MON_GEN[m - 1]} ${y}` }
// Шаги мечты: из чего она складывается. Отметили все шаги — мечта сбылась (спросим)
const stepsOf = g => (g && Array.isArray(g.steps) ? g.steps : []).filter(x => x && x.t)
const stepsTxt = g => { const l = stepsOf(g); return l.length ? `шаги ${l.filter(x => x.done).length} из ${l.length}` : "" }
function goalSteps(id, add, dates = []) {
  const g = D.goals.find(x => x.id === id); if (!g) return null
  const l = stepsOf(g).slice(), out = []
  add.forEach((x, i) => { const t = String(x || "").trim(), d = String(dates[i] || "").trim(), date = /^\d{4}-\d\d-\d\d(T\d\d:\d\d)?$/.test(d) ? d : ""
    if (!t) return
    const old = l.find(z => normT(z.t) === normT(t))
    if (old) { if (date && !old.date) { old.date = date; out.push(old) } return }
    const st = Object.assign({ id: uid("s"), t: t.charAt(0).toUpperCase() + t.slice(1), done: false }, date ? { date } : {}); l.push(st); out.push(st) })
  upsert("goals", Object.assign({}, g, { steps: l }))
  return out
}
function stepSet(id, sid, patch) {
  const g = D.goals.find(x => x.id === id); if (!g) return null
  const l = stepsOf(g).map(x => x.id === sid ? Object.assign({}, x, patch) : x).filter(x => !x.deleted)
  return upsert("goals", Object.assign({}, g, { steps: l }))
}
function stepFind(g, q) { const n = normT(q), l = stepsOf(g); return l.find(x => x.id === q || normT(x.t) === n) || l.find(x => normT(x.t).includes(n) || n.includes(normT(x.t))) }
// Дата шага: «2026-11-10» (весь день) или «2026-11-10T10:00»
const stepWhen = x => { const d = parseIso(x.date); if (!d) return ""; return `${dayName(d)}${/T/.test(x.date) ? " " + hm(d) : ""}` }
function stepDate(text) {
  const p = core.parseWhen(" " + core.normalizeSpeech(String(text || "")) + " ")
  if (!p.date) return ""
  const d = new Date(p.date), timed = d.getHours() || d.getMinutes()
  return timed ? iso(d) : dayKey(d)
}
async function stepToCal(id, sid) {
  const g = D.goals.find(x => x.id === id), st = stepsOf(g).find(x => x.id === sid), d = st && parseIso(st.date)
  if (!d) return { error: "у шага нет даты" }
  const timed = /T/.test(st.date)
  const ev = timed ? { title: st.t, start: iso(d), end: iso(new Date(+d + 60 * 60e3)), notes: `Шаг к цели «${g.title}»` }
    : { title: st.t, start: dayKey(d), end: dayKey(addDays(d, 1)), all_day: true, notes: `Шаг к цели «${g.title}»` }
  if (gcalOn()) { const r = await calDo("create", ev); if (r.error) return { error: r.error } }
  else queueOp("create_event", ev)
  stepSet(id, sid, { cal: true })
  return { ok: true }
}
function stepsForm(id) {
  const g = D.goals.find(x => x.id === id); if (!g) return
  const l = stepsOf(g), done = l.filter(x => x.done).length, noCal = l.filter(x => !x.done && x.date && !x.cal)
  const back = g.kind === "dream" ? "Мечты" : g.kind === "wish" ? "Желания" : "Цели"
  const sub = [g.kind === "month" ? "цель на " + core.monthTitle(g.month || curMonth()).toLowerCase() : dueTxt(g.due), l.length ? `сделано ${done} из ${l.length}` : ""].filter(Boolean).join(" · ")
  const s = sheet(`<div class="sh-head">${icoBox(GOAL_ICO[g.kind] || "target")}<div class="grow"><h3>${esc(g.title)}</h3><div class="muted small">${esc(sub)}</div></div></div>
    ${l.length ? `<div class="prog"><div style="width:${done / l.length * 100}%"></div></div>` : ""}
    <div style="margin-top:8px">${l.map((x, i) => `<div class="row step"><button class="check ${x.done ? "on" : ""}" data-st="${esc(x.id)}"></button><div class="grow"><div class="t ${x.done ? "struck" : ""}">${i + 1}. ${esc(x.t)}</div>${x.date ? `<div class="s">${esc(stepWhen(x))}${x.cal ? " · в календаре" : ""}</div>` : ""}</div>
      ${x.done ? "" : `<button class="i-btn ${x.date ? "on" : ""}" data-sdate="${esc(x.id)}" aria-label="Дата">${ICO.today}</button><button class="i-btn" data-spomo="${esc(x.id)}" aria-label="Помидоро">${ICO.timer}</button>`}<button class="x-btn" data-sdel="${esc(x.id)}" aria-label="Убрать">${ICO.x}</button></div>`).join("")
      || '<div class="empty">Разбейте на шаги: что сделать первым, вторым… Каждому шагу можно дать дату и внести в календарь. Не знаете, с чего начать, — «План с помощником».</div>'}</div>
    <div class="add-line" style="margin-top:12px"><input id="st-t" placeholder="${l.length ? "+ Следующий шаг" : "+ Первый шаг: узнать цены, записаться…"}"><button class="btn primary small" data-a="ok">Добавить</button></div>
    ${noCal.length ? `<button class="btn primary" data-a="cal" style="width:100%;margin-top:10px">Внести план в календарь · ${noCal.length}</button>` : ""}
    <div class="btns" style="margin-top:10px"><button class="btn" data-a="back">‹ ${back}</button><button class="btn" data-a="ai">План с помощником</button></div>`, { onClose: () => render() })
  const again = () => { s.close(); stepsForm(id) }
  $$("[data-st]", s.el).forEach(b => b.onclick = async () => {
    const st = l.find(x => x.id === b.dataset.st), g2 = stepSet(id, st.id, { done: !st.done, doneAt: st.done ? 0 : Date.now() })
    if (!st.done && stepsOf(g2).every(x => x.done) && !g2.done) { s.close()
      const ok = g2.kind === "month" ? "Готово!" : "Сбылась!"
      if ((await ui.confirm("Все шаги сделаны!", `<div class="msg">«${esc(g2.title)}» — отметить ${g2.kind === "month" ? "цель выполненной" : "сбывшейся"}?</div>`, ["Пока нет", ok])) === ok) { goalToggle(id, true); toast(g2.kind === "month" ? "Цель выполнена" : "Сбылось!") }
      return stepsForm(id) }
    again()
  })
  $$("[data-sdel]", s.el).forEach(b => b.onclick = () => { stepSet(id, b.dataset.sdel, { deleted: true }); again() })
  $$("[data-spomo]", s.el).forEach(b => b.onclick = () => { const st = l.find(x => x.id === b.dataset.spomo); pomoStart(st.t, id); s.close(); setTab("today"); toast(`Фокус ${POMO.work} минут: ${st.t}`) })
  $$("[data-sdate]", s.el).forEach(b => b.onclick = async () => {
    const st = l.find(x => x.id === b.dataset.sdate); s.close()
    const w = await ui.ask(st.t, "Когда? Например: «завтра», «в субботу в 10», «15 ноября»", st.date ? stepWhen(st) : "", { ok: "Дальше" })
    if (!w) return stepsForm(id)
    const date = stepDate(w); if (!date) { toast("Не понял дату"); return stepsForm(id) }
    stepSet(id, st.id, { date, cal: false })
    const b2 = await ui.confirm("Внести в календарь?", `<div class="msg">${esc(st.t)}\n${esc(core.cap(stepWhen({ date })))}</div>`, ["Только дата", "В календарь"])
    if (b2 === "В календарь") { const r = await stepToCal(id, st.id); toast(r.error ? "Не получилось: " + r.error : "Внесено в календарь") }
    stepsForm(id)
  })
  const cal = $('[data-a="cal"]', s.el); if (cal) cal.onclick = async () => {
    cal.disabled = true; cal.textContent = "Вношу…"; let n = 0, err = ""
    for (const x of noCal) { const r = await stepToCal(id, x.id); if (r.error) err = r.error; else n++ }
    toast(err ? `Внесено ${n}, ошибка: ${err}` : `В календаре: ${n} ${plural(n, "шаг", "шага", "шагов")}`); again()
  }
  $('[data-a="back"]', s.el).onclick = () => { s.close(); goalsForm(g.kind) }
  $('[data-a="ai"]', s.el).onclick = () => {
    s.close(); setTab("chat")
    const what = g.kind === "month" ? `цель на месяц «${g.title}»` : g.kind === "dream" ? `мечту «${g.title}» (${dueTxt(g.due)})` : `«${g.title}»`
    setTimeout(() => chatSend(`Помоги превратить ${what} в конкретный план${l.length ? `; уже есть шаги: ${l.map(x => x.t + (x.date ? ` (${stepWhen(x)})` : "")).join("; ")}` : ""}. Задай 1–2 уточняющих вопроса, учти мой календарь, потом предложи 3–7 шагов по порядку с конкретными датами (и временем, где уместно) и запиши их через add_goal_steps с датами. Затем спроси через ask_user, внести ли шаги в календарь, и если да — создай события через create_event.`), 30)
  }
  const add = () => { const t = $("#st-t", s.el).value.trim(); if (!t) return toast("Напишите шаг"); goalSteps(id, [t]); again() }
  $('[data-a="ok"]', s.el).onclick = add; $("#st-t", s.el).onkeydown = e => { if (e.key === "Enter") add() }
}
// ── Помидоро: 25 минут фокуса на одном деле (шаг мечты, цель, что угодно), потом 5 минут отдыха.
// Конец помидора приходит пушем: это подсказка (nudges) со временем окончания — её шлёт таблица
const POMO = { work: 25, rest: 5 }
const pomoNow = () => { const p = live(D.pomo).filter(x => !x.end && x.start).sort((a, b) => b.start - a.start)[0]; return p && Date.now() < p.start + p.min * 60e3 ? p : null }
const pomoToday = () => live(D.pomo).filter(x => x.full && sameDay(x.start, new Date()))
function pomoStart(title, link = "", min = POMO.work) {
  pomoStop()
  min = Math.max(5, Math.min(90, Math.round(+min || POMO.work)))
  const p = upsert("pomo", { id: uid("q"), date: Date.now(), start: Date.now(), min, title: String(title || "Фокус").trim(), link })
  upsert("nudges", { id: "pq" + p.id, date: p.start + min * 60e3, title: "🍅 Помидор готов", text: `${min} минут на «${p.title}». Теперь ${POMO.rest} минут отдыха — встаньте, попейте воды.` })
  save(); return p
}
function pomoStop() {
  const p = live(D.pomo).filter(x => !x.end && x.start).sort((a, b) => b.start - a.start)[0]; if (!p) return null
  const end = Math.min(Date.now(), p.start + p.min * 60e3), full = end >= p.start + p.min * 60e3 - 30e3
  if (!full) remove("nudges", "pq" + p.id)
  return upsert("pomo", Object.assign({}, p, { end, full }))
}
const pomoLeft = p => { const ms = Math.max(0, p.start + p.min * 60e3 - Date.now()), m = Math.floor(ms / 60e3), sec = Math.floor(ms / 1000) % 60; return `${m}:${String(sec).padStart(2, "0")}` }
function pomoCard() {
  const p = pomoNow(), n = pomoToday().length
  let html = `<div class="card" id="pomo"><h2>Помидоро${n ? `<span class="muted small" style="margin-left:auto">сегодня ${n}</span>` : ""}</h2>`
  if (p) return html + `<div class="wt"><b id="pomo-left">${pomoLeft(p)}</b><span class="muted small">${esc(p.title)}</span></div>
    <div class="prog"><div id="pomo-bar" style="width:${Math.min(1, (Date.now() - p.start) / (p.min * 60e3)) * 100}%"></div></div>
    <div class="btns" style="margin-top:10px"><button class="btn small" data-pomo="stop">Остановить</button></div></div>`
  return html + `<div class="btns"><button class="btn primary" data-pomo="start">Фокус ${POMO.work} минут</button></div>
    <div class="muted small" style="margin-top:8px">${n ? `${n * POMO.work} минут фокуса сегодня. ` : ""}Начните с шага мечты или скажите помощнику «помидор на отчёт».</div></div>`
}
async function pomoAsk() {
  const t = await ui.ask("🍅 Фокус 25 минут", "Над чем работаете?", "", { type: "text", ok: "Начать" })
  if (t == null) return
  pomoStart(t || "Фокус"); render(); toast(`🍅 ${POMO.work} минут. Когда закончится — придёт уведомление`)
}
setInterval(() => { const p = pomoNow(), el = $("#pomo-left"); if (el && p) { el.textContent = pomoLeft(p); const b = $("#pomo-bar"); if (b) b.style.width = Math.min(1, (Date.now() - p.start) / (p.min * 60e3)) * 100 + "%" } else if (el && !p && !stack.length) render() }, 1000)
function goalsCard(always) {
  const l = goalsOf("month"), done = l.filter(g => g.done).length, day = new Date().getDate()
  if (!l.length && day > 7 && !always) return ""
  let html = `<div class="card" id="goals"><h2>Цели на месяц<button class="act" data-do="goals">${l.length ? `${done} из ${l.length}` : "+ Поставить"}</button></h2>`
  if (!l.length) return html + `<div class="empty">Новый месяц — 3–5 целей на него. Можно сказать помощнику: «цели на месяц: …»${goalsLeft().length ? `. С прошлого осталось ${goalsLeft().length}.` : ""}</div></div>`
  html += l.map(g => { const nx = stepsOf(g).find(x => !x.done)
    return `<div class="row"><button class="check ${g.done ? "on" : ""}" data-goal="${esc(g.id)}"></button><button class="grow goal-open" data-gsteps="${esc(g.id)}"><div class="t ${g.done ? "struck" : ""}">${esc(g.title)}</div><div class="s">${stepsOf(g).length ? esc(stepsTxt(g) + (nx ? " · дальше: " + nx.t + (nx.date ? ", " + stepWhen(nx) : "") : "")) : g.done ? "" : "разбить на шаги ›"}</div></button></div>` }).join("")
  return html + `<div class="prog"><div style="width:${done / l.length * 100}%"></div></div></div>`
}
function goalsMore() {
  const n = k => goalsOf(k).length, d = k => goalsOf(k).filter(g => g.done).length
  return `<div class="card"><h2>Цели и мечты</h2>${["month", "wish", "dream"].map(k => `<button class="row list-row" data-goals="${k}">${icoBox(GOAL_ICO[k])}
    <div class="grow"><div class="t">${GOAL_KIND[k][1]}</div><div class="s">${n(k) ? `${d(k)} ${k === "month" ? "сделано" : "сбылось"} из ${n(k)}${GOAL_MAX[k] ? ` · мест ${GOAL_MAX[k]}` : ""}` : k === "wish" ? "Пишите всё, чего хочется: большое и маленькое" : k === "dream" ? "Крупное: на год, два, три" : "3–5 целей на этот месяц"}</div></div><span class="chev">${ICO.chev}</span></button>`).join("")}</div>`
}
function goalsForm(kind = "month") {
  const l = goalsOf(kind), hints = kind === "dream" ? DREAM_HINTS : WISH_HINTS, full = GOAL_MAX[kind] && l.length >= GOAL_MAX[kind]
  let hi = Math.floor(Math.random() * hints.length)
  const left = kind === "month" ? goalsLeft().filter(g => !l.some(x => normT(x.title) === normT(g.title))) : []
  const s = sheet(`<h3>${kind === "month" ? "Цели на " + esc(core.monthTitle(curMonth()).toLowerCase()) : GOAL_KIND[kind][1]}</h3>
    <div class="seg" id="g-k">${Object.keys(GOAL_KIND).map(k => `<button data-k="${k}" class="${k === kind ? "on" : ""}">${{ month: "Месяц", wish: "Желания", dream: "Мечты" }[k]}</button>`).join("")}</div>
    <div style="margin-top:10px">${l.map(g => `<div class="row"><button class="check ${g.done ? "on" : ""}" data-g="${esc(g.id)}"></button><div class="grow"><div class="t">${esc(g.title)}</div>${g.due || stepsOf(g).length ? `<div class="s">${esc([dueTxt(g.due), stepsTxt(g)].filter(Boolean).join(" · "))}</div>` : ""}</div>${kind === "wish" && !g.done ? (g.toMonth === curMonth() ? `<span class="tag">в целях</span>` : `<button class="btn small" data-tomonth="${esc(g.id)}">В цели</button>`) : ""}${kind !== "wish" ? `<button class="btn small" data-steps="${esc(g.id)}">Шаги</button>` : ""}<button class="x-btn" data-del="${esc(g.id)}" aria-label="Убрать">${ICO.x}</button></div>`).join("")
      || `<div class="empty">${kind === "wish" ? "Пишите всё, чего хочется, — большое и маленькое. Не получается? Нажмите «Подсказка» или «Помочь придумать»." : kind === "dream" ? "До 10 крупных мечт на срок до 2 лет. Каждую можно разбить на шаги." : "3–5 целей на этот месяц."}</div>`}</div>
    ${left.length ? `<button class="btn small" data-a="carry" style="margin-top:8px">Перенести с прошлого месяца (${left.length})</button>` : ""}
    ${full ? `<div class="muted small" style="margin-top:12px">Все ${GOAL_MAX[kind]} мест заняты — отметьте сбывшееся или уберите лишнее.</div>` : `
    <div class="field" style="margin-top:12px"><label>${kind === "month" ? "Новая цель" : kind === "wish" ? `Желание №${l.length + 1}` : `Мечта №${l.length + 1}`}</label><input id="g-t" placeholder="${esc(kind === "month" ? "Пробежать 50 км, прочитать книгу…" : hints[hi])}"></div>
    ${kind === "dream" ? `<div class="field"><label>Срок</label><div class="chips" id="g-y">${[[0.5, "полгода"], [1, "1 год"], [1.5, "1,5 года"], [2, "2 года"]].map(([n, t]) => `<button class="chip ${n === 1 ? "on" : ""}" data-y="${n}">${t}</button>`).join("")}</div><input id="g-d" type="date" style="margin-top:8px" value="${yearAhead()}" max="${yearAhead(DREAM_MAX_Y)}" min="${dayKey(new Date())}"></div>` : ""}
    ${kind !== "month" ? `<div class="muted small" id="g-h">${ei("bulb")}${esc(hints[hi])}</div>` : ""}`}
    <div class="btns" style="margin-top:10px">${kind !== "month" && !full ? '<button class="btn" data-a="hint">Подсказка</button>' : ""}<button class="btn" data-a="ai">Помочь придумать</button>${full ? "" : '<button class="btn primary" data-a="ok">Добавить</button>'}</div>`, { onClose: () => render() })
  const again = k => { s.close(); goalsForm(k) }
  $$("#g-y .chip", s.el).forEach(b => b.onclick = () => { $("#g-d", s.el).value = yearAhead(+b.dataset.y); $$("#g-y .chip", s.el).forEach(c => c.classList.toggle("on", c === b)) })
  $$("#g-k button", s.el).forEach(b => b.onclick = () => again(b.dataset.k))
  $$("[data-g]", s.el).forEach(b => b.onclick = () => { const g = goalToggle(b.dataset.g); b.classList.toggle("on", !!(g && g.done)); if (g && g.done) toast(kind === "month" ? "🎯 Готово!" : "✨ Сбылось!") })
  $$("[data-del]", s.el).forEach(b => b.onclick = () => { remove("goals", b.dataset.del); again(kind) })
  $$("[data-steps]", s.el).forEach(b => b.onclick = () => { s.close(); stepsForm(b.dataset.steps) })
  $$("[data-tomonth]", s.el).forEach(b => b.onclick = async () => { const g = wishToGoal(b.dataset.tomonth); s.close(); if (!g) return goalsForm(kind)
    const c = await ui.confirm("Теперь это цель на месяц", `<div class="msg">«${esc(g.title)}». Разбить на шаги с датами и внести план в календарь?</div>`, ["Позже", "Разбить на шаги"])
    if (c === "Разбить на шаги") stepsForm(g.id); else goalsForm(kind) })
  const carry = $('[data-a="carry"]', s.el); if (carry) carry.onclick = () => { goalAdd("month", left.map(g => g.title)); again(kind) }
  const hint = $('[data-a="hint"]', s.el); if (hint) hint.onclick = () => { hi = (hi + 1) % hints.length; $("#g-h", s.el).innerHTML = ei("bulb") + esc(hints[hi]); $("#g-t", s.el).placeholder = hints[hi]; $("#g-t", s.el).focus() }
  $('[data-a="ai"]', s.el).onclick = () => {
    s.close(); setTab("chat")
    const have = l.map(g => g.title).join("; ")
    const q = kind === "wish" ? `Помоги дополнить мои «100 желаний» (сейчас ${l.length}${have ? ": " + have : ""}). Задавай по одному вопросу про разные стороны жизни и записывай мои ответы.`
      : kind === "dream" ? `Помоги сформулировать крупные мечты на срок до 2 лет (сейчас ${l.length} из 10${have ? ": " + have : ""}). Спроси, что для меня важно, запиши мечты со сроком и для каждой предложи 3–7 шагов (add_goal_steps).`
      : `Помоги поставить 3–5 целей на этот месяц${have ? ` (уже есть: ${have})` : ""}. Учти мои мечты и то, что не успел в прошлом месяце.`
    setTimeout(() => chatSend(q), 30)
  }
  const ok = $('[data-a="ok"]', s.el)
  if (ok) { const add = () => { const t = $("#g-t", s.el).value.trim(); if (!t) return toast("Напишите, что хотите")
      const r = goalAdd(kind, [t], kind === "dream" ? $("#g-d", s.el).value : ""); again(kind); toast(r.added.length ? (kind === "wish" ? `✨ ${r.total} из 100` : "Добавлено") : "Уже есть") }
    ok.onclick = add; $("#g-t", s.el).onkeydown = e => { if (e.key === "Enter") add() } }
}

// ═════════════ Планы: списки, привычки по неделе, «Снова пора», цели, помидоро ═════════════
// Свои списки и «снова пора» живут в синхронизируемом списке goals (kind: "list" / "chore") — виджет и таблица их пропускают
const TONE = { cart: "orange", star: "pink", summit: "violet", target: "green", list: "blue", leaf: "green", car: "blue", home: "orange", sparkle: "violet", shirt: "blue",
  drop: "blue", pill: "pink", heart: "pink", repeat: "green", gift: "pink", plane: "blue", book: "orange", timer: "pink", activity: "green", dumbbell: "orange",
  apple: "green", moon: "violet", sun: "orange", pen: "blue", phone: "blue", ban: "red", check: "green", paw: "orange", tool: "blue" }
const icoBox = (k, tone) => `<span class="ic ${tone || TONE[k] || "green"}">${ICO[k] || ICO.list}</span>`
let plansF = "all"
const PLAN_F = [["all", "Всё"], ["lists", "Списки"], ["habits", "Привычки"], ["again", "Снова пора"], ["goals", "Цели"]]
function renderPlans() {
  const f = plansF, all = f === "all"
  let html = `<div class="chips pf">${PLAN_F.map(([k, t]) => `<button class="chip ${f === k ? "on" : ""}" data-pf="${k}">${t}</button>`).join("")}</div>`
  if (all || f === "again") html += choresCard(all ? 4 : 0)
  if (all || f === "lists") html += listsCard()
  if (all || f === "habits") html += habitsWeek()
  if (all || f === "goals") html += goalsCard(true)
  if (f === "goals") html += goalsMore()
  if (all || f === "goals") html += pomoCard()
  return html
}

// ── «Снова пора»: дела, которые повторяются раз в N дней (полить цветы, помыть машину, сменить постель)
const CHORE_ICO = ["leaf", "home", "sparkle", "shirt", "car", "drop", "pill", "heart", "paw", "tool", "cart", "repeat"]
const chores = () => live(D.goals).filter(g => g.kind === "chore" && g.title).sort((a, b) => choreLeft(a) - choreLeft(b) || a.date - b.date)
const choreDue = c => c.last ? addDays(sod(new Date(c.last)), Math.max(1, +c.every || 7)) : sod(new Date())
const choreLeft = c => Math.round((choreDue(c) - sod(new Date())) / 864e5)
const choreWhen = c => { const n = choreLeft(c); return n < 0 ? `просрочено на ${-n} ${plural(-n, "день", "дня", "дней")}` : n === 0 ? "сегодня" : n === 1 ? "завтра" : `через ${n} ${plural(n, "день", "дня", "дней")}` }
const everyTxt = n => +n === 1 ? "каждый день" : +n === 7 ? "раз в неделю" : +n === 14 ? "раз в 2 недели" : +n === 30 ? "раз в месяц" : `каждые ${n} ${plural(+n, "день", "дня", "дней")}`
const agoTxt = t => { if (!t) return "ещё не делали"; const n = Math.round((sod(new Date()) - sod(new Date(t))) / 864e5); return n <= 0 ? "сделано сегодня" : n === 1 ? "было вчера" : `было ${n} ${plural(n, "день", "дня", "дней")} назад` }
function choreAdd(title, every, last, ico) {
  title = String(title || "").trim(); if (!title) return null
  const old = chores().find(c => normT(c.title) === normT(title))
  return upsert("goals", Object.assign({}, old || { id: uid("o"), date: Date.now(), kind: "chore" }, { title: title.charAt(0).toUpperCase() + title.slice(1),
    every: Math.max(1, Math.min(365, Math.round(+every || (old && old.every) || 7))), last: last != null ? last : (old ? old.last : 0), ico: ico || (old && old.ico) || choreGuess(title) }))
}
const choreGuess = t => /цвет|полив|растен|сад/i.test(t) ? "leaf" : /машин|авто|шин|масл/i.test(t) ? "car" : /стир|постел|бель|полотен/i.test(t) ? "shirt" : /убор|пыл|пылесос|мыть пол|холодил/i.test(t) ? "sparkle"
  : /кош|собак|корм|лоток|питом/i.test(t) ? "paw" : /фильтр|вод/i.test(t) ? "drop" : /таблет|витамин|лекар/i.test(t) ? "pill" : /стриж|парикмах|ногт|врач|стомат/i.test(t) ? "heart" : /ремонт|почин|батар/i.test(t) ? "tool" : "repeat"
const choreFind = q => { const n = normT(q); return chores().find(c => c.id === q || normT(c.title) === n) || chores().find(c => normT(c.title).includes(n) || n.includes(normT(c.title))) }
function choreDone(id, at = Date.now()) { const c = D.goals.find(x => x.id === id); return c ? upsert("goals", Object.assign({}, c, { last: at })) : null }
const choreRow = c => { const n = choreLeft(c)
  return `<div class="row chore" data-chore="${esc(c.id)}">${icoBox(c.ico || "repeat")}<div class="grow"><div class="t">${esc(c.title)}</div><div class="s"><span class="due ${n < 0 ? "late" : n === 0 ? "now" : ""}">${esc(core.cap(choreWhen(c)))}</span> · ${esc(everyTxt(c.every))}</div></div><button class="check" data-chore-done="${esc(c.id)}" aria-label="Сделано"></button></div>` }
function choresCard(max = 0) {
  const l = chores(), show = max ? l.slice(0, max) : l
  let html = `<div class="card" id="chores"><h2>Снова пора<button class="act" data-do="chore-add">+ Дело</button></h2>`
  if (!l.length) return html + `<div class="empty">Дела, которые повторяются: полить цветы раз в 3 дня, помыть машину раз в 2 недели, сменить постель раз в неделю. Отметили — приложение посчитает, когда снова пора.</div></div>`
  html += show.map(choreRow).join("")
  if (max && l.length > max) html += `<button class="more-link" data-pf="again">Все дела · ${l.length}</button>`
  return html + `</div>`
}
function choresToday() {
  const l = chores().filter(c => choreLeft(c) <= 0)
  return l.length ? `<div class="card" id="chores-today"><h2>Снова пора<span class="muted small">${l.length}</span></h2>${l.map(choreRow).join("")}</div>` : ""
}
function choreForm(c) {
  let every = c ? c.every : 7, ico = c ? c.ico : ""
  const s = sheet(`<h3>${c ? esc(c.title) : "Снова пора"}</h3>${c ? `<div class="muted small" style="margin:-4px 0 10px">${esc(core.cap(agoTxt(c.last)))} · снова ${esc(choreWhen(c))}</div>` : ""}
    <div class="field"><label>Что делать</label><input id="c-t" value="${c ? esc(c.title) : ""}" placeholder="Полить цветы, помыть машину…"></div>
    <div class="field"><label>Как часто</label><div class="chips" id="c-n">${[[1, "каждый день"], [3, "3 дня"], [7, "неделя"], [14, "2 недели"], [30, "месяц"]].map(([n, t]) => `<button class="chip ${n === every ? "on" : ""}" data-n="${n}">${t}</button>`).join("")}</div>
      <div class="set" style="margin-top:8px"><span>Каждые, дней</span><input id="c-e" type="number" min="1" max="365" value="${every}"></div></div>
    ${c ? "" : `<div class="field"><label>Последний раз</label><div class="seg" id="c-l"><button data-l="0" class="on">Сегодня</button><button data-l="1">Вчера</button><button data-l="-1">Не помню</button></div></div>`}
    <div class="field"><label>Значок</label><div class="icos" id="c-i">${CHORE_ICO.map(k => `<button class="icon-pick ${k === ico ? "on" : ""}" data-i="${k}">${icoBox(k)}</button>`).join("")}</div></div>
    <div class="btns">${c ? '<button class="btn red" data-a="del">Удалить</button>' : '<button class="btn" data-a="no">Отмена</button>'}<button class="btn primary" data-a="ok">${c ? "Сохранить" : "Добавить"}</button></div>`, { onClose: () => render() })
  let lastAgo = 0
  $$("#c-n .chip", s.el).forEach(b => b.onclick = () => { every = +b.dataset.n; $("#c-e", s.el).value = every; $$("#c-n .chip", s.el).forEach(x => x.classList.toggle("on", x === b)) })
  $("#c-e", s.el).oninput = ev => { every = Math.round(+ev.target.value) || every; $$("#c-n .chip", s.el).forEach(x => x.classList.toggle("on", +x.dataset.n === every)) }
  $$("#c-l button", s.el).forEach(b => b.onclick = () => { lastAgo = +b.dataset.l; $$("#c-l button", s.el).forEach(x => x.classList.toggle("on", x === b)) })
  $$("#c-i button", s.el).forEach(b => b.onclick = () => { ico = b.dataset.i; $$("#c-i button", s.el).forEach(x => x.classList.toggle("on", x === b)) })
  const no = $('[data-a="no"]', s.el); if (no) no.onclick = () => s.close()
  const del = $('[data-a="del"]', s.el); if (del) del.onclick = async () => {
    if ((await ui.confirm("Удалить дело?", `<div class="msg">«${esc(c.title)}» больше не будет напоминать.</div>`, ["Отмена", "Удалить"])) !== "Удалить") return
    remove("goals", c.id); s.close(); render()
  }
  $('[data-a="ok"]', s.el).onclick = () => {
    const t = $("#c-t", s.el).value.trim(); if (!t) return toast("Напишите, что делать")
    if (!(every >= 1 && every <= 365)) return toast("От 1 до 365 дней")
    const r = c ? upsert("goals", Object.assign({}, c, { title: t, every, ico: ico || c.ico })) : choreAdd(t, every, lastAgo < 0 ? 0 : +addDays(new Date(), -lastAgo), ico)
    s.close(); render(); toast(`Снова пора: ${choreWhen(r)}`)
  }
}

// ── Списки: покупки, 100 желаний, 10 мечт и свои (на выходные, в отпуск, подарки…)
const LIST_ICO = ["list", "cart", "gift", "plane", "book", "home", "star", "heart", "sparkle", "tool", "paw", "apple"]
const myLists = () => live(D.goals).filter(g => g.kind === "list" && g.title).sort((a, b) => (!!b.pin - !!a.pin) || a.date - b.date)
const itemsOf = l => (l && Array.isArray(l.items) ? l.items : []).filter(x => x && x.t)
const listFind = q => { const n = normT(q); return myLists().find(l => l.id === q || normT(l.title) === n) || myLists().find(l => normT(l.title).includes(n) || n.includes(normT(l.title))) }
function listNew(title, ico) {
  title = String(title || "").trim(); if (!title) return null
  return listFind(title) && normT(listFind(title).title) === normT(title) ? listFind(title)
    : upsert("goals", { id: uid("o"), date: Date.now(), kind: "list", title: title.charAt(0).toUpperCase() + title.slice(1), ico: ico || listGuess(title), items: [] })
}
const listGuess = t => /подар/i.test(t) ? "gift" : /отпуск|поезд|путеш|чемодан|взять/i.test(t) ? "plane" : /книг|чита|фильм|сериал/i.test(t) ? "book" : /дом|ремонт|квартир/i.test(t) ? "home" : /куп|магаз/i.test(t) ? "cart" : "list"
function listItems(id, add) {
  const l = D.goals.find(x => x.id === id); if (!l) return []
  const it = itemsOf(l).slice(), out = []
  for (const t of add.map(x => String(x).trim()).filter(Boolean)) if (!it.some(x => !x.done && normT(x.t) === normT(t))) { const x = { id: uid("i"), t: t.charAt(0).toUpperCase() + t.slice(1), done: false }; it.push(x); out.push(x) }
  upsert("goals", Object.assign({}, l, { items: it }))
  return out
}
function listItemSet(id, iid, patch) {
  const l = D.goals.find(x => x.id === id); if (!l) return null
  return upsert("goals", Object.assign({}, l, { items: itemsOf(l).map(x => x.id === iid ? Object.assign({}, x, patch) : x).filter(x => !x.deleted) }))
}
function listsCard() {
  const wish = goalsOf("wish"), dream = goalsOf("dream"), sh = shopOpen(), d1 = dream.find(g => !g.done && stepsOf(g).length) || dream.find(g => !g.done)
  const row = (k, key, title, sub, n = "") => `<button class="row list-row" data-list="${esc(key)}">${icoBox(k)}<div class="grow"><div class="t">${esc(title)}</div><div class="s">${esc(sub)}</div></div>${n ? `<span class="cnt">${esc(n)}</span>` : ""}<span class="chev">${ICO.chev}</span></button>`
  let html = `<div class="card" id="lists"><h2>Списки<button class="act" data-do="list-add">+ Список</button></h2>`
  html += row("cart", "shop", "Покупки", sh.length ? sh.slice(0, 3).map(s => s.title).join(", ") + (sh.length > 3 ? "…" : "") : "Пусто — скажите «купить молоко»", sh.length ? String(sh.length) : "")
  html += row("star", "wish", "100 желаний", wish.length ? `сбылось ${wish.filter(g => g.done).length}` : "Всё, чего хочется, — большое и маленькое", wish.length ? `${wish.length} из 100` : "")
  html += row("summit", "dream", "10 мечт", d1 ? `${d1.title}${stepsOf(d1).length ? " · " + stepsTxt(d1) : ""}` : "Крупное на срок до 2 лет, с шагами", dream.length ? `${dream.length} из 10` : "")
  html += myLists().map(l => { const it = itemsOf(l), done = it.filter(x => x.done).length, open = it.filter(x => !x.done)
    return row(l.ico || "list", l.id, l.title, it.length ? open.slice(0, 3).map(x => x.t).join(", ") || "всё отмечено" : "Пустой список", it.length ? `${done} из ${it.length}` : "") }).join("")
  return html + `</div>`
}
function listOpen(key) {
  if (key === "shop") return shopSheet()
  if (key === "wish" || key === "dream") return goalsForm(key)
  return listSheet(key)
}
function itemSheet(title, sub, items, h) {
  const open = items.filter(x => !x.done), done = items.filter(x => x.done)
  const one = x => `<div class="row"><button class="check ${x.done ? "on" : ""}" data-it="${esc(x.id)}"></button><div class="grow"><div class="t ${x.done ? "struck" : ""}">${esc(x.t)}</div></div><button class="x-btn" data-ix="${esc(x.id)}" aria-label="Убрать">${ICO.x}</button></div>`
  const s = sheet(`<div class="sh-head">${h.ico ? icoBox(h.ico) : ""}<div class="grow"><h3>${esc(title)}</h3><div class="muted small">${esc(sub)}</div></div></div>
    <div class="add-line"><input id="it-t" placeholder="+ Добавить пункт" enterkeyhint="done"><button class="btn primary small" data-a="add">Добавить</button></div>
    <div>${open.map(one).join("") || (done.length ? "" : `<div class="empty">${esc(h.empty)}</div>`)}</div>
    ${done.length ? `<div class="sub-h">Отмечено · ${done.length}</div><div>${done.map(one).join("")}</div>` : ""}
    <div class="btns" style="margin-top:12px">${h.extra || ""}<button class="btn" data-a="no">Готово</button></div>`, { onClose: () => render() })
  $$("[data-it]", s.el).forEach(b => b.onclick = () => { h.toggle(b.dataset.it); if (navigator.vibrate) navigator.vibrate(10); h.again(s) })
  $$("[data-ix]", s.el).forEach(b => b.onclick = () => { h.del(b.dataset.ix); h.again(s) })
  const add = () => { const t = $("#it-t", s.el).value.trim(); if (!t) return; h.add(t); h.again(s, true) }
  $('[data-a="add"]', s.el).onclick = add; $("#it-t", s.el).onkeydown = e => { if (e.key === "Enter") add() }
  $('[data-a="no"]', s.el).onclick = () => s.close()
  if (h.bind) h.bind(s)
  if (h.focus) setTimeout(() => $("#it-t", s.el).focus(), 50)
  return s
}
function listSheet(id, focus) {
  const l = D.goals.find(x => x.id === id); if (!l || l.deleted) return
  const it = itemsOf(l), done = it.filter(x => x.done).length
  itemSheet(l.title, it.length ? `${done} из ${it.length}` : "Пустой список", it, { ico: l.ico || "list", focus, empty: "Добавьте первый пункт",
    extra: `<button class="btn" data-a="pin">${l.pin ? "Открепить" : "Закрепить"}</button><button class="btn red" data-a="del">Удалить</button>`,
    toggle: iid => { const x = it.find(z => z.id === iid); listItemSet(id, iid, { done: !x.done }) },
    del: iid => listItemSet(id, iid, { deleted: true }), add: t => listItems(id, [t]),
    again: (s, f) => { s.close(); listSheet(id, f) },
    bind: s => {
      $('[data-a="pin"]', s.el).onclick = () => { upsert("goals", Object.assign({}, l, { pin: !l.pin })); s.close(); render() }
      $('[data-a="del"]', s.el).onclick = async () => {
        if ((await ui.confirm("Удалить список?", `<div class="msg">«${esc(l.title)}» и все пункты в нём.</div>`, ["Отмена", "Удалить"])) !== "Удалить") return
        remove("goals", id); s.close(); render()
      }
    } })
}
function shopSheet(focus) {
  const it = live(D.shop).filter(x => !x.done || (x.doneAt && x.doneAt > Date.now() - 3 * 864e5)).sort((a, b) => a.date - b.date).map(x => ({ id: x.id, t: x.title, done: !!x.done }))
  const st = shopStores()
  itemSheet("Покупки", st.length ? "Напомню у: " + st.map(p => p.query).join(", ") : `${it.filter(x => !x.done).length} купить`, it, { ico: "cart", focus, empty: "Скажите помощнику «купить молоко и хлеб» или добавьте здесь",
    toggle: iid => { const x = it.find(z => z.id === iid); shopToggle(iid, !x.done) }, del: iid => remove("shop", iid), add: t => shopAdd(t.split(/[,;\n]/)),
    again: (s, f) => { s.close(); shopSheet(f) } })
}
function listForm() {
  let ico = "list"
  const s = sheet(`<h3>Новый список</h3>
    <div class="field"><label>Название</label><input id="l-t" placeholder="На выходные, в отпуск, подарки…"></div>
    <div class="field"><label>Значок</label><div class="icos" id="l-i">${LIST_ICO.map(k => `<button class="icon-pick ${k === ico ? "on" : ""}" data-i="${k}">${icoBox(k)}</button>`).join("")}</div></div>
    <div class="btns"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Создать</button></div>`)
  let picked = false
  $$("#l-i button", s.el).forEach(b => b.onclick = () => { ico = b.dataset.i; picked = true; $$("#l-i button", s.el).forEach(x => x.classList.toggle("on", x === b)) })
  $("#l-t", s.el).oninput = ev => { if (!picked) { ico = listGuess(ev.target.value); $$("#l-i button", s.el).forEach(x => x.classList.toggle("on", x.dataset.i === ico)) } }
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => { const t = $("#l-t", s.el).value.trim(); if (!t) return toast("Назовите список"); const l = listNew(t, ico); s.close(); render(); listSheet(l.id, true) }
}

// ── Привычки по неделе: 7 последних дней кружками, нажатие — отметить день
function habitsWeek() {
  const list = habitList(), t0 = sod(new Date()), days = [...Array(7)].map((_, i) => addDays(t0, i - 6))
  let html = `<div class="card" id="habits-week"><h2>Привычки<button class="act" data-do="habits">${list.length ? "Изменить" : "+ Добавить"}</button></h2>`
  if (!list.length) return html + `<div class="empty">Что хотите делать каждый день (зарядка, чтение) или бросить (сладкое, алкоголь). Отмечайте — увидите серию и неделю целиком.</div></div>`
  const doneToday = list.filter(h => !h.bad && habitOn(h, t0)).length, good = list.filter(h => !h.bad).length
  html += `<div class="hw-head"><span class="muted small">${good ? `сегодня ${doneToday} из ${good}` : ""}</span><div class="dots">${days.map(d => `<span class="${sameDay(d, t0) ? "td" : ""}">${WD[d.getDay()].slice(0, 2)}</span>`).join("")}</div></div>`
  html += list.map(h => {
    const st = habitStreak(h), n = days.filter(d => habitOn(h, d)).length
    const sub = h.bad ? `${st} ${plural(st, "день", "дня", "дней")} без` : st ? `серия ${st}` : `${n} из 7`
    return `<div class="row hw">${icoBox(habitIco(h), h.bad ? "red" : "")}<div class="grow"><div class="t">${esc(h.title)}</div><div class="s">${esc(sub)}</div></div>
      <div class="dots">${days.map(d => `<button class="dot ${habitOn(h, d) ? "on" : ""} ${h.bad ? "bad" : ""} ${sameDay(d, t0) ? "td" : ""}" data-hd="${esc(h.id)}" data-hdd="${+d}" aria-label="${esc(WD[d.getDay()])}"></button>`).join("")}</div></div>`
  }).join("")
  return html + `</div>`
}

// Поиск по всему: операции, еда, напоминания, события, регулярные платежи, привычки, чат
function searchAll(q) {
  const s = q.toLowerCase().trim(), n = parseFloat(s.replace(",", "."))
  if (s.length < 2 && !(n > 0)) return []
  const has = (...xs) => xs.some(x => x != null && String(x).toLowerCase().includes(s))
  const out = []
  for (const e of live(D.money).sort((a, b) => b.date - a.date)) if (has(e.category, e.comment) || (n > 0 && Math.abs(e.amount - n) < 0.5))
    out.push({ g: "Деньги", t: `${e.type === "expense" ? "−" : "+"}${core.money(e.amount)} · ${e.category}`, s: `${dayName(new Date(e.date))}${e.comment ? " · " + e.comment : ""}`, open: () => moneyForm(null, e) })
  for (const r of live(D.recur)) if (has(r.title, r.category) || (n > 0 && Math.abs(r.amount - n) < 0.5)) out.push({ g: "Регулярные платежи", t: r.title, s: `${core.money(r.amount)} · ${recurLabel(r)}`, open: () => recurAsk(r) })
  for (const r of live(D.rems).sort((a, b) => (b.u || 0) - (a.u || 0))) if (has(r.title, r.notes)) out.push({ g: "Напоминания", t: (r.done ? "✓ " : "") + r.title, s: remLabel(r) || (r.done ? "выполнено" : "без срока") })
  for (const e of iphone().events) if (has(e.title, e.location)) out.push({ g: "Календарь", t: e.title, s: `${dayName(e.s)} ${e.all_day ? "" : hm(e.s)}${e.location ? " · " + e.location : ""}`, open: () => eventSheet(e) })
  for (const f of live(D.food).sort((a, b) => b.date - a.date)) if (has(f.title)) out.push({ g: "Еда", t: f.title, s: `${dayName(new Date(f.date))} · ${num(f.kcal)} ккал`, open: () => foodForm(f) })
  for (const h of live(D.habits)) if (has(h.title)) out.push({ g: "Привычки", t: h.title, s: h.bad ? "бросаю" : `${habitStreak(h)} дн. подряд` })
  for (const m of D.chat.concat(D.chatArchive || []).filter(m => m.text && !m.local).sort((a, b) => (b.at || 0) - (a.at || 0))) if (has(m.text)) {
    const i = m.text.toLowerCase().indexOf(s), cut = m.text.slice(Math.max(0, i - 40), i + 80)
    out.push({ g: "Чат", t: (m.role === "user" ? "Вы: " : iziName() + ": ") + (i > 40 ? "…" : "") + cut, s: m.at ? `${dayName(new Date(m.at))}, ${hm(new Date(m.at))}` : "" })
  }
  return out
}
function searchSheet() {
  const s = sheet(`<h3>Поиск</h3><div class="field"><input id="q" type="search" placeholder="Такси, аренда, 1500, стоматолог…" autocomplete="off"></div><div id="q-res" class="q-res"></div>`)
  const inp = $("#q", s.el), box = $("#q-res", s.el)
  let res = []
  const run = () => {
    res = searchAll(inp.value)
    const groups = {}
    res.forEach((r, i) => { (groups[r.g] = groups[r.g] || []).push(i) })
    box.innerHTML = !inp.value.trim() ? `<div class="empty">Ищет по деньгам, напоминаниям, календарю, еде, привычкам и чату. Можно искать по сумме.</div>`
      : !res.length ? `<div class="empty">Ничего не нашлось</div>`
      : Object.entries(groups).map(([g, ids]) => `<div class="day-h">${esc(g)} · ${ids.length}</div>` + ids.slice(0, 15).map(i => `<div class="row" data-q="${i}"><div class="grow"><div class="t">${esc(res[i].t)}</div>${res[i].s ? `<div class="s">${esc(res[i].s)}</div>` : ""}</div></div>`).join("")).join("")
    $$("[data-q]", box).forEach(el => el.onclick = () => { const r = res[+el.dataset.q]; if (r.open) { s.close(); r.open() } })
  }
  let t = null
  inp.oninput = () => { clearTimeout(t); t = setTimeout(run, 150) }
  run()
  setTimeout(() => inp.focus(), 250)
}

// ───────────── Пуш-уведомления: подписка у таблицы, она по расписанию шлёт подсказки ─────────────
const pushAble = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
const b64uBytes = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0))
// Сервис-воркеру нужны адрес таблицы и ключ, чтобы забрать текст пуша
async function pushConn() {
  if (!("caches" in window)) return
  try { const c = await caches.open("myday-conn"); await c.put("conn", new Response(JSON.stringify(D.conn ? { hook: D.conn.hook, secret: D.conn.secret } : {}))) } catch (e) {}
}
async function pushSub() {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}
async function pushEnable() {
  if (!D.conn) return toast("Сначала подключите приложение")
  if (!pushAble()) return ui.info("Уведомления", standalone() ? "Этот телефон не умеет получать уведомления от сайтов: нужна iOS 16.4 или новее." : "Сначала поставьте IZIDAY на экран «Домой» (Поделиться → На экран «Домой») и откройте оттуда — уведомления работают только так.")
  const perm = await Notification.requestPermission()
  if (perm !== "granted") return ui.info("Уведомления выключены", "Разрешите их: Настройки → Уведомления → IZIDAY.")
  try {
    await pushConn()
    const key = ((await hubPost({ push: { action: "key" } })).push || {}).key
    if (!key) throw new Error("таблица не дала ключ — обновите скрипт таблицы")
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (sub && D.pushKey && D.pushKey !== key) { await sub.unsubscribe(); sub = null }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(key) })
    const r = (await hubPost({ push: { action: "subscribe", sub: sub.toJSON(), ua: navigator.userAgent, cfg: { waterGoal: H().waterGoal } } })).push || {}
    if (r.error) throw new Error(r.error)
    D.pushKey = key; D.pushAt = Date.now(); save(false)
    pushHere(true)
    render(); toast("🔔 Уведомления включены")
  } catch (e) { ui.info("Не получилось включить", String(e.message || e)) }
}
async function pushTest() {
  try { const r = (await hubPost({ push: { action: "test" } })).push || {}; toast(r.sent ? "🔔 Отправил — сейчас придёт" : `Не дошло: ${(r.errors || [r.error || "нет подписки"]).join("; ")}`) }
  catch (e) { toast("Не получилось: " + e.message) }
}
// Раз в день обновить подписку у таблицы (на случай, если iPhone выдал новую)
async function pushKeep() {
  if (!D.conn || !pushAble() || Notification.permission !== "granted" || Date.now() - (D.pushAt || 0) < 864e5) return
  try { const sub = await pushSub(); if (!sub) return
    await pushConn(); await hubPost({ push: { action: "subscribe", sub: sub.toJSON(), ua: navigator.userAgent, cfg: { waterGoal: H().waterGoal } } }); D.pushAt = Date.now(); save(false) } catch (e) {}
}
// Где я — для «пора выезжать» (только если место уже разрешено; не чаще раза в 10 минут, пока приложение открыто)
let hereAt = 0
async function pushHere(force) {
  if (!D.conn || !navigator.geolocation || (!force && Date.now() - hereAt < 10 * 60e3)) return
  try { if (navigator.permissions) { const p = await navigator.permissions.query({ name: "geolocation" }); if (p.state !== "granted" && !force) return } } catch (e) {}
  hereAt = Date.now()
  navigator.geolocation.getCurrentPosition(p => hubPost({ push: { action: "here", lat: p.coords.latitude, lng: p.coords.longitude, at: Date.now() } }).catch(() => {}),
    () => {}, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 })
}
async function pushCard() {
  const el = $("#push-state")
  if (!el) return
  let on = false
  try { on = pushAble() && Notification.permission === "granted" && !!(await pushSub()) } catch (e) {}
  el.innerHTML = on ? '<span class="ok">✓ Включены</span>' : '<span class="exp">выключены</span>'
  const b = $("#push-btns")
  if (b) b.innerHTML = on ? '<button class="btn" data-push="test">' + ei("bell") + 'Проверить</button>' : '<button class="btn primary" data-push="on">' + ei("bell") + 'Включить уведомления</button>'
  $$("[data-push]").forEach(x => x.onclick = () => x.dataset.push === "on" ? pushEnable() : pushTest())
}

// ───────────── Подключение ─────────────
function decodeSetup(code) {
  const s = String(code || "").trim().replace(/^.*#setup=/, "")
  const bin = atob(decodeURIComponent(s).replace(/\s+/g, ""))
  const json = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)))
  const d = JSON.parse(json)
  if (!d || !/^https:\/\/script\.google(usercontent)?\.com\//.test(d.hook || "") || !d.secret) throw new Error("в коде нет ссылки на таблицу")
  return d
}
async function connect(code) {
  let d
  try { d = decodeSetup(code) } catch (e) { return ui.info("Не тот код", "Скопируйте код подключения в виджете ещё раз. " + (e.message || "")) }
  const fresh = !D.conn || D.conn.hook !== d.hook
  D.conn = { hook: d.hook, secret: d.secret, key: d.key || "", routes: d.routes || [], sheetUrl: d.sheetUrl || "", cfg: d.cfg || null, run: d.run || "" }
  if (fresh) D.sync = { since: 0, pushedAt: 0, snapAt: 0, at: 0, error: "" }
  applyCfg()
  save(false)
  pushConn()
  render()
  toast("Подключаюсь…")
  const ok = await sync()
  if (ok) toast(D.snap ? "✓ Подключено" : "✓ Подключено. Календарь придёт с обновлением виджета")
  else ui.info("Таблица не ответила", D.sync.error + "\n\nПроверьте, что в таблицу вставлен новый Code.gs и веб-приложение развёрнуто заново (новая версия).")
}

// Подключение в одно касание: Scriptable копирует код в буфер, приложение забирает его по нажатию «Вставить»
// (браузер читает буфер только по нажатию — iOS покажет кнопку «Вставить»)
let connectAt = 0
function autoConnect() {
  connectAt = Date.now()
  location.href = "scriptable:///run/MyDay?action=connect"
}
async function pasteConnect() {
  connectAt = 0
  const s = sheet(`<h3>🔗 Подключение</h3><div class="msg">Код скопирован в Scriptable. Нажмите «Вставить» — и всё.</div>
    <div class="btns"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">${ei("list")}Вставить</button></div>`)
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = async () => {
    let t = ""
    try { t = await navigator.clipboard.readText() } catch (e) {}
    s.close()
    if (t && /setup=|^[A-Za-z0-9+/=%\s]{40,}$/.test(t.trim())) return connect(t)
    DO.connect()
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !D.conn && connectAt && Date.now() - connectAt < 10 * 60e3) setTimeout(pasteConnect, 300)
})

// ───────────── Действия из виджета (ссылки вида …/#voice) ─────────────
async function hashAction() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ""))
  if (!h) return
  history.replaceState(null, "", location.pathname + location.search)
  while (stack.length) stack[stack.length - 1].close()
  if (h.startsWith("setup=")) return connect(h.slice(6))
  const eq = h.indexOf("="), a = eq < 0 ? h : h.slice(0, eq), arg = eq < 0 ? "" : h.slice(eq + 1)
  if (a === "voice") { setTab("chat"); return micStart(true) }
  if (a === "chat" || a === "note") return setTab("chat")
  if (a === "reply") {   // нажали на подсказку в уведомлении: она — в чате, микрофон сразу слушает ответ
    const t = String(arg || "").trim(), last = D.chat[D.chat.length - 1]
    if (t && !(last && last.role === "assistant" && last.text === t)) { D.chat.push({ role: "assistant", text: t, at: Date.now(), push: true }); save(false) }
    setTab("chat"); return setTimeout(() => micStart(true), 250)
  }
  if (a === "brief") { setTab("chat"); return brief(arg) }
  if (a === "money") return moneyForm("expense")
  if (a === "water") return addWater(H().glass || 250, "widget")
  if (a === "camera") return photoPrompt()
  if (a === "food") return foodMenu()
  if (a === "health") return setTab("health")
  if (a === "shop") { setTab("today"); return setTimeout(() => { const el = $("#shop"); if (el) el.scrollIntoView({ block: "start" }) }, 50) }
  if (a === "kids") return setTab("today")
  if (a === "goals") { setTab("today"); return goalsForm(["wish", "dream"].includes(arg) ? arg : "month") }
  if (a === "today") return setTab("today")
  if (a === "rem") return remFollow(arg)
  if (a === "synced") { setTab("today"); return sync().then(() => { render(); toast("✓ Внесено в iPhone") }) }
  if (a === "remdone") { remSet(arg, { completed: true }); setTab("today"); return toast("✓ Отмечено выполненным") }
  if (a === "remlater") { remSet(arg, { due: iso(new Date(Date.now() + 3600e3)) }); setTab("today"); return toast("⏰ Перенёс на час") }
  if (a === "place") { const p = D.places.find(z => z.id === arg); setTab("today"); if (p) ui.info(`📍 ${p.title}`, `Вы рядом: ${p.query}.`) }
}
// Запустить Scriptable сейчас: внесёт изменения в календарь и напоминания, пришлёт свежий снимок и вернёт в приложение
function runWidgetNow() {
  const run = (D.conn && D.conn.run) || "scriptable:///run/MyDay"
  const name = decodeURIComponent((run.split("/run/")[1] || "MyDay").split("?")[0])
  // Обычный запуск Scriptable (x-callback-url он не принимает — «The URL is not supported»).
  // Назад — кнопкой «◀ IZIDAY» слева вверху; при возврате приложение само обновится и скажет, всё ли внесено.
  runWidgetAt = Date.now()
  location.href = `scriptable:///run/${encodeURIComponent(name)}?action=hub`
}
let runWidgetAt = 0
// «Выполнил?» по напоминанию из уведомления: сделано / перенести / почему нет
async function remFollow(id) {
  setTab("today")
  const r = (iphone().reminders || []).find(x => x.id === id)
  if (!r) return ui.info("Напоминание", "Не нашёл его — возможно, уже выполнено или удалено.")
  if (r.completed) return toast("✓ Уже выполнено")
  const at = h => { const d = new Date(); d.setHours(h, 0, 0, 0); return d }
  const opts = [["✅ Сделано", () => { remSet(id, { completed: true }); toast("✓ Отлично!") }],
    ["⏰ Через час", () => remSet(id, { due: iso(new Date(Date.now() + 3600e3)) })],
    ...(new Date().getHours() < 19 ? [["🌆 Вечером в 19:00", () => remSet(id, { due: iso(at(19)) })]] : []),
    ["📅 Завтра в 10:00", () => remSet(id, { due: iso(addDays(at(10), 1)) })],
    ["💬 Не сделал — почему…", async () => {
      const why = await ui.ask("Что помешало?", `«${r.title}». Помощник учтёт и предложит, когда лучше сделать.`, "", { ok: "Отправить", multiline: true })
      if (why) chatSend(`Не выполнил напоминание «${r.title}»${r.due ? ` (срок ${r.due.replace("T", " ")})` : ""}. Причина: ${why}. Перенеси на подходящее время (посмотри календарь), а если это повторяется — запомни и подскажи, как не откладывать.`)
    }]]
  const i = await ui.choose(`⏰ ${r.title}`, r.due ? `Срок: ${r.due.replace("T", " ")}. Выполнили?` : "Выполнили?", opts.map(o => o[0]))
  if (i >= 0) { await opts[i][1](); render() }
}
// Safari включает микрофон и камеру только по нажатию — одна большая кнопка
function micPrompt() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { const i = $("#chat-in"); if (i) i.focus(); return }
  const s = sheet(`<h3>🎤 Скажите помощнику</h3><div class="btns"><button class="btn gold" style="padding:18px;font-size:18px">Нажмите и говорите</button></div>`)
  $(".btn", s.el).onclick = () => { s.close(); micStart() }
}
function photoPrompt() {
  const s = sheet(`<h3>📷 Фото или файл</h3><div class="msg">Еда — посчитаю калории. Счёт — от кого, сумма и срок, напомню оплатить. Чек — что куплено и почём, запишу расход.</div>
    <div class="btns"><button class="btn gold" data-a="cam" style="padding:18px;font-size:18px">Сфотографировать</button></div>
    <div class="btns"><button class="btn" data-a="lib">Из фото</button><button class="btn" data-a="doc">Файл / PDF</button></div>
    <div class="btns"><button class="btn" data-a="txt">Описать еду словами</button></div>`)
  $('[data-a="doc"]', s.el).onclick = () => { s.close(); $("#doc").click() }
  $('[data-a="cam"]', s.el).onclick = () => { s.close(); $("#photo").click() }
  $('[data-a="lib"]', s.el).onclick = () => { s.close(); $("#photo-lib").click() }
  $('[data-a="txt"]', s.el).onclick = async () => { s.close(); const t = await ui.ask("Что съели?", "Например: тарелка том яма и рис", "", { ok: "Посчитать" }); if (t) foodFlow(null, t) }
}

// ── «Шёлк»: живая волна из двух линий ──
// В покое плывёт медленно; пока говорите — быстрее и выше. Громкость iPhone не отдаёт, пока работает
// распознавание речи, поэтому волна «слышит» по приходящим словам: каждое слово подталкивает её.
const SILK = { cv: new Set(), raf: 0, en: 0, lv: 0, last: 0 }
function silkCanvas(c, kind) { if (!c) return; c.dataset.k = kind; SILK.cv.add(c); silkLoop() }
function silkLoop() {
  if (SILK.raf || document.hidden) return
  SILK.raf = requestAnimationFrame(silkFrame)
}
document.addEventListener("visibilitychange", silkLoop)
function silkFrame(t) {
  SILK.raf = 0
  if (document.hidden) return
  const live = [...SILK.cv].filter(c => c.isConnected); SILK.cv = new Set(live)
  if (!live.length) return
  SILK.raf = requestAnimationFrame(silkFrame)
  if (t - SILK.last < 32) return   // ~30 кадров в секунду — плавно и бережно к батарее
  SILK.last = t
  const T = t / 1000
  const syl = .6 + .4 * Math.sin(T * 1.1) * Math.sin(T * .5)
  const target = voice ? (.18 + .82 * syl) * Math.max(.2, SILK.en) : 0
  SILK.lv += (target - SILK.lv) * (target > SILK.lv ? .06 : .03)
  SILK.en *= .985
  const d = Math.min(2, devicePixelRatio || 1)
  for (const c of live) {
    const w = Math.round(c.clientWidth * d), h = Math.round(c.clientHeight * d)
    if (!w || !h) continue
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
    const k = c.dataset.k
    if (k === "talk") silkTalk(c, T, d); else if (k === "comet") silkComet(c, T, d); else if (k === "orb") silkOrb(c, T, d, voice && PTT.holding); else silkLines(c, T, d, false)
  }
  const tm = $("#silk .tm"); if (tm && voice && voice.t0) { const sec = Math.floor((Date.now() - voice.t0) / 1000); tm.textContent = Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0") }
}
function silkLines(c, T, d, active) {
  const x = c.getContext("2d"), W = c.width, H = c.height, a = active ? SILK.lv : 0
  x.clearRect(0, 0, W, H)
  const pad = W * .2, amp = (.14 + a * .25) * H, sp = active ? 3 + a * 3 : .9
  ;[["rgba(255,255,255,.98)", 0, 1], ["rgba(255,255,255,.55)", 2.2, .75]].forEach(([col, off, k], j) => {
    x.beginPath()
    for (let px = pad; px <= W - pad; px += 2) {
      const u = (px - pad) / (W - 2 * pad), env = Math.pow(Math.sin(Math.PI * u), 1.4)
      const y = H / 2 + amp * k * env * Math.sin(u * Math.PI * 2 * 1.15 + T * sp * (j ? 1.25 : 1) + off)
      px === pad ? x.moveTo(px, y) : x.lineTo(px, y)
    }
    const g = x.createLinearGradient(pad, 0, W - pad, 0), c0 = col.replace(/[\d.]+\)$/, "0)")
    g.addColorStop(0, c0); g.addColorStop(.25, col); g.addColorStop(.75, col); g.addColorStop(1, c0)   // концы растворяются
    x.strokeStyle = g; x.lineWidth = 1.8 * d; x.lineCap = "round"; x.lineJoin = "round"; x.stroke()
  })
}
// Кнопка «Помощник» — как иконка приложения: одна цветная сфера, волны прямо в ней (без внутреннего шара и обводки).
// Край сферы тает наружу в ноль, концы волн растворяются, без светящихся точек
function iziSphere(x, W, H, R, edge, P, waves, o = {}) {
  const cx = W / 2, cy = H / 2
  x.globalAlpha = o.alpha || 1
  const bg = x.createLinearGradient(cx - R, cy + R, cx + R, cy - R); bg.addColorStop(0, P[2][0]); bg.addColorStop(.55, P[2][1]); bg.addColorStop(1, P[2][2]); x.fillStyle = bg; x.fillRect(0, 0, W, H)
  const lt = x.createRadialGradient(cx - R * .35, cy - R * .45, 0, cx - R * .2, cy - R * .25, R * 1.25)   // объём: свет сверху слева
  lt.addColorStop(0, "rgba(255,255,255,.3)"); lt.addColorStop(.5, "rgba(255,255,255,.06)"); lt.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = lt; x.fillRect(0, 0, W, H)
  const sd = x.createRadialGradient(cx - R * .15, cy - R * .2, R * .6, cx, cy, R * 1.05)                  // и мягкая тень к краю
  sd.addColorStop(0, "rgba(0,40,50,0)"); sd.addColorStop(1, "rgba(0,40,60,.22)"); x.fillStyle = sd; x.fillRect(0, 0, W, H)
  x.globalAlpha = 1; x.globalCompositeOperation = o.mode || "lighter"; waves(); x.globalCompositeOperation = "destination-in"
  const fm = x.createRadialGradient(cx, cy, 0, cx, cy, edge); fm.addColorStop(0, "#000"); fm.addColorStop(R / edge, "#000"); fm.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = fm; x.fillRect(0, 0, W, H)
  x.globalCompositeOperation = "source-over"
}
function silkOrb(c, T, d, active) {
  const x = c.getContext("2d"), W = c.width, H = c.height, a = active ? SILK.lv : 0
  x.clearRect(0, 0, W, H)
  const cx = W / 2, cy = H / 2, R = W * .4, P = iziCol()
  iziSphere(x, W, H, R, W / 2, P, () => {
    const sp = active ? 2 + a * 1.5 : .9, len = R * 1.8
    ;[[P[3], .95, .04, .32, 2.1, .035, .18, 1.25], [P[4], 1, -.03, .42, 0, .045, .22, 1]].forEach(([rgb, al, dy, am, ph, lw, gw, k]) => {
      const amp = R * am * (1 + a * .5), g = x.createLinearGradient(cx - len / 2, 0, cx + len / 2, 0)
      g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(.28, `rgba(${rgb},${al})`); g.addColorStop(.72, `rgba(${rgb},${al})`); g.addColorStop(1, `rgba(${rgb},0)`)
      x.beginPath()
      for (let i = 0; i <= 80; i++) {
        const u = i / 80, env = Math.pow(Math.sin(Math.PI * u), 1.5), px = cx - len / 2 + u * len
        const py = cy + dy * R + amp * env * Math.sin(u * Math.PI * 2.3 + ph + T * sp * k)
        i ? x.lineTo(px, py) : x.moveTo(px, py)
      }
      x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = g; x.lineWidth = Math.max(1.2 * d, R * lw)
      x.shadowColor = `rgba(${rgb},1)`; x.shadowBlur = R * gw; x.stroke(); x.shadowBlur = 0
    })
  })
}
// Полоса записи: две волны плывут медленно, как на кнопке; пока говорите — чуть шире размах, но не быстрее.
// Без точки: только волны, концы растворяются. Всё свечение помещается внутри полосы
function silkComet(c, T, d) {
  const x = c.getContext("2d"), W = c.width, H = c.height, a = SILK.lv
  x.clearRect(0, 0, W, H)
  const L = 6 * d, Rt = W - 6 * d, mid = W / 2, sp = .8 + a * .25
  const glow = 4 * d, amp = (.12 + a * .16) * H   // волна + свечение не выходят за высоту полосы
  const wy = (u, j) => H / 2 + amp * (j ? .75 : 1) * Math.pow(Math.sin(Math.PI * u), 1.4) * Math.sin(u * Math.PI * 2 * 1.15 + T * sp * (j ? 1.2 : 1) + (j ? 2.2 : 0))
  ;[["rgba(255,255,255,", 0], ["rgba(190,240,255,", 1]].forEach(([col, j]) => {
    const g = x.createLinearGradient(L, 0, Rt, 0)
    g.addColorStop(0, col + "0)"); g.addColorStop(.2, col + ".55)"); g.addColorStop(.5, col + "1)"); g.addColorStop(.8, col + ".55)"); g.addColorStop(1, col + "0)")
    x.beginPath()
    for (let px = L; px <= Rt; px += 2) { const y = wy((px - L) / (Rt - L), j); px === L ? x.moveTo(px, y) : x.lineTo(px, y) }
    x.strokeStyle = g; x.lineWidth = (j ? 1.6 : 2) * d; x.lineCap = "round"; x.lineJoin = "round"
    x.shadowColor = "#bff"; x.shadowBlur = glow; x.stroke(); x.shadowBlur = 0
  })
}
let silkHide = null
function silkShow(text) {
  const el = $("#silk"); if (!el) return
  clearTimeout(silkHide)
  document.body.classList.toggle("voice", text !== null)
  if (text === null) { el.classList.remove("on"); silkHide = setTimeout(() => { el.hidden = true }, 320); return }
  const tx = $(".tx span", el)
  tx.textContent = text || "Слушаю…"; tx.classList.toggle("ph", !text)
  if (el.hidden) { el.hidden = false; void el.offsetWidth }
  el.classList.add("on"); silkLoop()
}
// «+» в чате: плюс поворачивается, из него раскрывается короткий список. Закрыть — смахнуть вниз или нажать мимо
let plusClose = null
function plusMenu(btn) {
  if (plusClose) return plusClose()
  const layer = $("#layer"), bar = btn.closest(".chat-bar")
  const scrim = document.createElement("div"); scrim.className = "plus-scrim"
  const m = document.createElement("div"); m.className = "plus-menu"
  const items = [["photo", "cam", "c-cam", "Камера", "Снять фото или видео"], ["photo-lib", "gallery", "c-lib", "Фото и видео", "Загрузить из галереи"], ["doc", "doc", "c-doc", "Файл", "PDF или документ"]]
  m.innerHTML = items.map(([id, ic, cl, t, sub]) => `<button data-in="${id}"><span class="ic ${cl}">${ICO[ic]}</span><span><b>${t}</b><small>${sub}</small></span></button>`).join("")
  layer.append(scrim, m)
  btn.classList.add("open"); if (bar) bar.classList.add("menu")
  requestAnimationFrame(() => { scrim.classList.add("show"); m.classList.add("show") })
  const close = () => {
    if (plusClose !== close) return
    plusClose = null
    btn.classList.remove("open"); scrim.classList.remove("show"); m.classList.remove("show")
    setTimeout(() => { scrim.remove(); m.remove(); if (bar) bar.classList.remove("menu") }, 320)
  }
  plusClose = close
  scrim.onclick = close
  $$("[data-in]", m).forEach(b => b.onclick = () => { close(); $("#" + b.dataset.in).click() })
  let y0 = null
  m.addEventListener("touchstart", e => { y0 = e.touches[0].clientY }, { passive: true })
  m.addEventListener("touchmove", e => { if (y0 != null && e.touches[0].clientY - y0 > 36) { y0 = null; close() } }, { passive: true })
}

// ───────────── Старт ─────────────
document.querySelectorAll("[data-ico]").forEach(i => i.innerHTML = ICO[i.dataset.ico])
// Настоящая высота экрана: в приложении со значка iOS отдаёт в CSS высоту без строки состояния, и внизу оставалась пустая полоса
function fitHeight() {
  let h = window.innerHeight
  if (navigator.standalone || matchMedia("(display-mode: standalone)").matches) {
    const land = matchMedia("(orientation: landscape)").matches
    h = Math.max(h, land ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height))
  }
  document.documentElement.style.setProperty("--app-h", h + "px")
}
fitHeight()
addEventListener("resize", fitHeight)
// Клавиатура: поднять строку ввода чата над ней (окно страницы на iPhone при этом не уменьшается)
if (window.visualViewport) {
  const kb = () => {
    const app = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-h")) || innerHeight
    const hidden = Math.max(0, app - visualViewport.height - visualViewport.offsetTop)
    document.documentElement.style.setProperty("--kb", hidden > 80 ? hidden + "px" : "0px")
    document.body.classList.toggle("kb", hidden > 80)
  }
  visualViewport.addEventListener("resize", kb); visualViewport.addEventListener("scroll", kb)
}
addEventListener("orientationchange", () => setTimeout(fitHeight, 300))
{ const c = document.createElement("canvas"); $("#fab .orb").append(c); silkCanvas(c, "orb") }
// Зелёная кнопка с волной: нажатие — чат с помощником; держите — сразу запись голосовой команды,
// отпустили — команда уходит помощнику (как рация). Меню «Добавить» — кнопка «+» вверху
const PTT = { holding: false }
function pttShow(text) {
  const fab = $("#fab"), on = text !== null && !!voice
  if (fab) fab.classList.toggle("rec", !!(on && (PTT.holding || voice.ptt)))
  silkShow(on ? text : null)
}
// Нажатие — onTap; держите дольше 280 мс — запись, пока держите; отпустили — ушло; увели палец влево — отмена
function holdToTalk(btn, onTap) {
  let lp = null, long = false, id = null, x0 = 0
  btn.addEventListener("pointerdown", e => {
    long = false; id = e.pointerId; x0 = e.clientX
    try { btn.setPointerCapture(e.pointerId) } catch (err) {}
    clearTimeout(lp)
    lp = setTimeout(() => {
      long = true; PTT.holding = true
      if (navigator.vibrate) navigator.vibrate(15)
      if (voice) voiceReset()
      micStart(true)
      pttShow("")
    }, 280)
  })
  btn.addEventListener("pointermove", e => {
    if (!long || e.pointerId !== id || !voice || e.clientX - x0 > -90) return
    PTT.holding = false; voiceCancel()
  })
  const up = e => {
    if (e && id !== null && e.pointerId !== id) return
    clearTimeout(lp); id = null
    if (!long) return
    PTT.holding = false
    if (voice) { voice.ptt = false; pttShow(voice.text || ""); voiceFinish() } else pttShow(null)
  }
  btn.addEventListener("pointerup", up); btn.addEventListener("pointercancel", up)
  btn.addEventListener("contextmenu", e => e.preventDefault())
  btn.onclick = () => { if (long) { long = false; return } onTap() }
}
holdToTalk($("#fab"), () => tab === "chat" ? talkOpen() : setTab("chat"))   // Изи ещё раз на экране чата — живой разговор голосом
// Полоса записи «Шёлк»: сверху текст, ниже волна с яркой точкой, «‹ отмена» и секунды.
// Нажать на текст — поправить его в поле; на волну или секунды — отправить сразу; смахнуть влево — отмена
{
  const el = $("#silk")
  silkCanvas($("canvas", el), "comet")
  $(".x", el).onclick = e => { e.stopPropagation(); voiceCancel() }
  $(".tx", el).onclick = e => { e.stopPropagation(); const i = $("#chat-in"); if (voice && i && tab === "chat") i.focus() }
  el.onclick = () => { if (voice && !PTT.holding) voiceSendNow() }
  let sx = null
  el.addEventListener("pointerdown", e => { sx = e.clientX })
  el.addEventListener("pointermove", e => { if (sx != null && e.clientX - sx < -70) { sx = null; voiceCancel() } })
  el.addEventListener("pointerup", () => { sx = null })
}
$("#add").innerHTML = ICO.add
$("#add").onclick = () => tab === "cal" ? calQuick() : addMenu()
$("#sync").innerHTML = ICO.sync
$("#gear").innerHTML = ICO.more
$("#gear").onclick = () => setTab(tab === "more" ? "today" : "more")
$("#sync").onclick = () => DO.sync()
$("#find").innerHTML = ICO.find
$("#find").onclick = () => searchSheet()
$$("#tabs button:not(#fab)").forEach(b => b.onclick = () => setTab(b.dataset.tab))
onPhoto($("#photo")); onPhoto($("#photo-lib")); onPhoto($("#doc"))
// ═════════════ «Сегодня» 2.0: сейчас, кольца, три главных, перегруз, таймлайн, погода, подсказка, шаблоны, итоги ═════════════
// Хранится в goals (синхронизируется без нового деплоя скрипта): kind "top3" {day, ids}, "daynote" {day, text, mood}, "dtpl" {title, items:[{t, time}]}
const TD_ICO = {
  car: '<path d="M5 16l1.5-5A2 2 0 0 1 8.4 9.5h7.2a2 2 0 0 1 1.9 1.5L19 16"/><rect x="3" y="15" width="18" height="4" rx="1.5"/><circle cx="7" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  focus: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>', alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17v.5"/>',
  rain: '<path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3.5 3.5 0 0 1-1 6.9z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cloud: '<path d="M7 18a4 4 0 1 1 1-7.9A5 5 0 0 1 18 11a3.5 3.5 0 0 1-1 7z"/>', wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>', bill: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  brief: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5h6v2M3 12h18"/>', kid: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>', tpl: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16M10 10v10"/>'
}
const tdIco = (n, s = 16) => `<i class="tdi" style="width:${s}px;height:${s}px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TD_ICO[n]}</svg></i>`
const goalOf = (kind, day) => live(D.goals).find(g => g.kind === kind && g.day === day)
const DAY_FROM = 8, DAY_TO = 22   // рабочее окно дня для окон и перегруза

// ═════════════ Деньги 2.0: «сегодня можно потратить», копилки, распределение дохода, валюты, капитал, подписки,
// категории с одной поправки, семейный бюджет, долги и займы, неделя в деньгах с характером ═════════════
// Хранится в goals (синхронизируется без нового деплоя скрипта): kind "jar" {title, target, saved, s0, start, due "YYYY-MM", dep {месяц: сумма}, shared},
// "acct" {title, type, amount, cur}, "caphist" {m {месяц: капитал}}, "debt" {title, dir in|out|loan, amount, due, rate, pay}, "catrule" {key, label, cat, type},
// "subdec" {key, keep}, "alloc" {inc, skip}, "spend" {day, today, perDay} — число для виджета. У операции: cur, orig (сумма в своей валюте), shared.
// Настройки на телефоне: D.mny {view all|mine|shared, tone praise|roast|dry, partner}
Object.assign(TD_ICO, {
  jar: '<path d="M7 4h10M8 4v2.5a6.5 6.5 0 0 0-3 5.5v4.5A3.5 3.5 0 0 0 8.5 20h7a3.5 3.5 0 0 0 3.5-3.5V12a6.5 6.5 0 0 0-3-5.5V4"/><path d="M12 10.5v5M10 12.5h3.2a1.2 1.2 0 0 1 0 2.4H10"/>',
  chart: '<path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/><path d="M15 7h3v3"/>', home: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M3 10h18M7 15h3"/>', cash: '<rect x="2.5" y="6.5" width="19" height="11" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
  hand: '<path d="M7 11.5V6.8a1.5 1.5 0 0 1 3 0V11M10 10.5V5.3a1.5 1.5 0 0 1 3 0V11M13 10.5V6.3a1.5 1.5 0 0 1 3 0V12M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6.5 6.5 0 0 1-5.2-2.6L4 15.2a1.6 1.6 0 0 1 2.4-2.1L7 13.8"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M12 8.5l1.2 2.3 2.3 1.2-2.3 1.2L12 15.5l-1.2-2.3L8.5 12l2.3-1.2z"/>',
  repeat: '<path d="M17 2.5l3 3-3 3"/><path d="M4 11.5v-1a5 5 0 0 1 5-5h11"/><path d="M7 21.5l-3-3 3-3"/><path d="M20 12.5v1a5 5 0 0 1-5 5H4"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>',
  car2: '<path d="M5 16l1.5-5A2 2 0 0 1 8.4 9.5h7.2a2 2 0 0 1 1.9 1.5L19 16"/><rect x="3" y="15" width="18" height="4" rx="1.5"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>', plus: '<path d="M12 5v14M5 12h14"/>',
})
const MNY = () => (D.mny = Object.assign({ view: "all", tone: "praise", partner: "Оля" }, D.mny || {}))
const gk = kind => live(D.goals).filter(g => g.kind === kind)
const sumBy = (l, f = x => x.amount) => l.reduce((s, x) => s + (+f(x) || 0), 0)
const MONTHS_DAT = ["январю", "февралю", "марту", "апрелю", "маю", "июню", "июлю", "августу", "сентябрю", "октябрю", "ноябрю", "декабрю"]
const MONTHS_PREP = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"]
const mIdx = key => { const [y, m] = String(key).split("-").map(Number); return y * 12 + (m - 1) }
const mKeyOf = i => `${Math.floor(i / 12)}-${z2(i % 12 + 1)}`
const r100 = n => Math.ceil(n / 100) * 100

// — 4. Валюты: курс раз в 12 часов (open.er-api.com, без ключа); сумма операции хранится в основной валюте, своя — в orig/cur
const CUR = { THB: "฿", RUB: "₽", USD: "$" }
const baseCur = () => ({ "₽": "RUB", "$": "USD" }[core.CONFIG.currency] || "THB")
const FX_DEF = { THB: 1, USD: 0.0283, RUB: 2.33 }   // единиц валюты за 1 бат, пока курса нет
const fxRate = c => (D.fx && D.fx.r && D.fx.r[c]) || FX_DEF[c] || 1
const fx = (n, from, to = baseCur()) => from === to ? n : n / fxRate(from) * fxRate(to)
const fmtCur = (n, c) => c === "USD" ? `$${num(n)}` : `${num(n)} ${CUR[c] || core.CONFIG.currency}`
async function fxLoad(force) {
  if (!force && D.fx && Date.now() - D.fx.at < 12 * 3600e3) return
  try {
    const j = await (await fetch("https://open.er-api.com/v6/latest/THB", { cache: "no-store" })).json()
    if (j && j.rates && j.rates.USD && j.rates.RUB) { D.fx = { at: Date.now(), r: { THB: 1, USD: j.rates.USD, RUB: j.rates.RUB } }; save(false); if (tab === "money") render() }
  } catch (e) {}
}
const fxLine = () => { const b = baseCur(), o = ["USD", "RUB", "THB"].filter(c => c !== b)
  return o.map(c => `${c === "USD" ? "$1" : "1 " + CUR[c]} = ${String(Math.round(fx(1, c, b) * 100) / 100).replace(".", ",")} ${CUR[b]}`).join(" · ") }

// — 8. Семейный бюджет: «Все / Мои / Общие с Олей»
const mnyView = list => { const v = MNY().view; return v === "mine" ? list.filter(e => !e.shared) : v === "shared" ? list.filter(e => e.shared) : list }

// — 2. Копилки
const jars = () => gk("jar").filter(j => j.title && !j.env).sort((a, b) => (a.due || "9").localeCompare(b.due || "9") || a.date - b.date)
const jarDep = (j, key = core.monthKey(new Date())) => +((j.dep || {})[key]) || 0
const jarMonthsLeft = (j, key = core.monthKey(new Date())) => j.due ? Math.max(1, mIdx(j.due) - mIdx(key)) : 12
// план на месяц: сколько не хватало на начало месяца, делённое на оставшиеся месяцы
function jarPlan(j, key = core.monthKey(new Date())) {
  const before = (+j.saved || 0) - jarDep(j, key)
  return Math.max(0, r100((j.target - before) / jarMonthsLeft(j, key)))
}
function jarState(j, now = new Date()) {
  const key = core.monthKey(now), plan = jarPlan(j, key), dep = jarDep(j, key), saved = +j.saved || 0
  if (!(j.target > 0)) return { plan: 0, dep, need: 0, late: 0, cls: "", p: 0, txt: `накоплено ${num(saved)}${dep ? ` · в ${MONTHS_PREP[now.getMonth()]} +${num(dep)}` : ""}` }
  const total = j.due ? Math.max(1, mIdx(j.due) - mIdx(j.start || key)) : 12, m0 = Math.max(1, ((j.target - (+j.s0 || 0)) / total))
  const expected = (+j.s0 || 0) + m0 * Math.max(0, mIdx(key) - mIdx(j.start || key)), behind = expected - (saved - dep)
  const late = behind > m0 * 0.6 ? Math.max(1, Math.round(behind / m0)) : 0
  const [, dm] = String(j.due || "").split("-").map(Number)
  const by = j.due ? `к ${MONTHS_DAT[dm - 1]}${mIdx(j.due) - mIdx(key) > 11 ? " " + j.due.slice(0, 4) : ""}` : ""
  let txt, cls = ""
  if (saved >= j.target) { txt = "собрано — можно тратить по назначению"; cls = "ok" }
  else if (late) { txt = `отстаёте на ${late} ${plural(late, "месяц", "месяца", "месяцев")} — добавить ${num(r100(Math.max(plan - dep, behind)))} ${core.CONFIG.currency} в ${MONTHS_PREP[now.getMonth()]}?`; cls = "late" }
  else if (dep >= plan) { txt = `в ${MONTHS_PREP[now.getMonth()]} отложено ${num(dep)} — успеваете${by ? " " + by : ""}`; cls = "ok" }
  else txt = `${by ? by + " — " : ""}откладывать ${num(plan)} ${core.CONFIG.currency} в месяц · успеваете`
  return { plan, dep, need: Math.max(0, plan - dep), late, txt, cls, p: Math.min(1, saved / (j.target || 1)) }
}
function jarDeposit(j, amount, key = core.monthKey(new Date())) {
  const a = Math.round(+amount || 0)
  if (!a) return j
  return upsert("goals", Object.assign({}, j, { saved: Math.max(0, (+j.saved || 0) + a), dep: Object.assign({}, j.dep, { [key]: Math.max(0, jarDep(j, key) + a) }) }))
}
const jarFind = t => { const n = String(t || "").toLowerCase().trim(), ws = n.split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 3).map(w => w.slice(0, Math.max(3, w.length - 2)))
  return jars().find(j => j.id === t) || jars().find(j => j.title.toLowerCase() === n) || jars().find(j => n && (j.title.toLowerCase().includes(n) || n.includes(j.title.toLowerCase())))
    || jars().find(j => ws.length && ws.every(w => j.title.toLowerCase().split(/[^\p{L}\p{N}]+/u).some(x => x.startsWith(w)))) }
// сколько этот месяц уходит в копилки: план или уже отложенное, что больше
const jarsMonth = (key = core.monthKey(new Date())) => sumBy(jars(), j => Math.max(jarPlan(j, key), jarDep(j, key)))

// — 1. «Сегодня можно потратить»: доходы месяца − траты − неоплаченные платежи − копилки, делённое на оставшиеся дни
function canSpend(now = new Date()) {
  const key = core.monthKey(now), t = core.monthTotals(live(D.money), key)
  const bills = live(D.recur).filter(r => r.type !== "income" && !recurPaid(r)).reduce((s, r) => s + (+r.amount || 0), 0)
  const spentToday = live(D.money).filter(e => e.type === "expense" && sameDay(e.date, now)).reduce((s, e) => s + e.amount, 0)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), daysLeft = last - now.getDate() + 1
  if (!t.income) return null
  const jarsM = planMonth(key), pool = t.income - (t.expense - spentToday) - bills - jarsM
  return { today: Math.max(0, Math.round(pool / daysLeft - spentToday)), perDay: Math.round(pool / daysLeft), left: Math.round(pool - spentToday), bills, jars: jarsM, last, daysLeft, spentToday }
}
// число для виджета: пишется в goals, только когда изменилось
function spendPublish() {
  const cs = canSpend(), day = dayKey(new Date()), v = cs ? cs.today : null, g = D.goals.find(x => x.id === "spend")
  if (g && !g.deleted && g.day === day && g.today === v) return
  if (v == null && (!g || g.deleted)) return
  upsert("goals", { id: "spend", date: Date.now(), kind: "spend", day, today: v, perDay: cs ? cs.perDay : null, cur: core.CONFIG.currency })
}

// — 3. Распределение дохода по плану: человек выбирает статьи из списка, Изи предлагает проценты; пришёл доход — раскладка по процентам.
// План — goals {id "aplan", kind "aplan", items [{k, title, pct, why}]}; статьи-конверты — копилки без цели {env: k} (кроме «Платежи», «На жизнь», «Копилки на цели»)
const ENVS = [
  { k: "bills", t: "Обязательные платежи", ico: "bill", c: "#FF9F0A", d: "аренда, школа, связь — по регулярным платежам" },
  { k: "goals", t: "Копилки на цели", ico: "jar", c: "#12C28A", d: "делится между копилками по их плану" },
  { k: "cushion", t: "Подушка безопасности", ico: "star", c: "#0A84FF", d: "запас на 6 месяцев расходов" },
  { k: "invest", t: "Инвестиции", ico: "trend", c: "#5E5CE6", d: "долгосрочно, на капитал" },
  { k: "debt", t: "Гасить долги досрочно", ico: "hand", c: "#FF375F", d: "сверх обязательного платежа" },
  { k: "charity", t: "Благотворительность", ico: "people", c: "#FF6482", d: "" },
  { k: "edu", t: "Обучение", ico: "brief", c: "#30B0C7", d: "курсы, книги, свои и детей" },
  { k: "health", t: "Здоровье", ico: "drop", c: "#34C759", d: "врачи, анализы, спорт" },
  { k: "kids", t: "Дети", ico: "kid", c: "#FFB340", d: "кружки, одежда, игрушки" },
  { k: "parents", t: "Помощь родителям", ico: "home", c: "#AC8E68", d: "" },
  { k: "gifts", t: "Подарки и праздники", ico: "spark", c: "#BF5AF2", d: "" },
  { k: "fun", t: "Отдых и хобби", ico: "sun", c: "#64D2FF", d: "" },
  { k: "life", t: "На жизнь", ico: "wallet", c: "#8E8E93", d: "еда, транспорт, кафе — всё, что осталось" },
]
const ENV = k => ENVS.find(e => e.k === k) || { k, t: k, ico: "wallet", c: "#8E8E93", d: "" }
const ENV_STD = { invest: 10, charity: 3, edu: 4, health: 3, kids: 5, parents: 5, gifts: 3, fun: 5 }   // привычные доли, если нечего посчитать
const FLEX = ["fun", "gifts", "invest", "edu", "cushion", "debt", "parents", "kids", "health", "charity"]   // что ужать первым, если на жизнь не хватает
const aplan = () => { const g = D.goals.find(x => x.id === "aplan" && !x.deleted); return g && Array.isArray(g.items) && g.items.length ? g : null }
const CUSH_RE = /подушк|резерв|запас/i
const envJar = k => gk("jar").find(j => j.env === k) || (k === "cushion" ? jars().find(j => CUSH_RE.test(j.title)) : null)
const planHas = k => planItems().some(z => z.k === k && z.pct > 0)
// копилки на цели (без подушки, если подушка — отдельная статья)
const goalJars = (cush = planHas("cushion")) => jars().filter(j => (+j.saved || 0) < j.target && !(cush && j === envJar("cushion")))
// обычный месячный доход: среднее за 3 последних месяца с доходом
function incomeBase(now = new Date()) {
  const ks = [0, 1, 2, 3].map(i => mKeyOf(mIdx(core.monthKey(now)) - i)), v = ks.map(k => core.monthTotals(live(D.money), k).income).filter(x => x > 0)
  return v.length ? Math.round(sumBy(v, x => x) / v.length) : 0
}
// обычные траты на жизнь в месяц (без регулярных платежей): среднее за прошлые месяцы, а если истории мало — темп этого месяца
function spendVar(now = new Date()) {
  const rt = new Set(live(D.recur).map(r => r.title)), cur = core.monthKey(now)
  const varOf = k => core.monthTotals(live(D.money), k).items.filter(e => e.type === "expense" && !rt.has(e.comment))
  const past = [1, 2, 3].map(i => varOf(mKeyOf(mIdx(cur) - i))).filter(l => l.length >= 5)
  if (past.length >= 2) return Math.round(sumBy(past, l => sumBy(l)) / past.length)
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), passed = Math.max(3, now.getDate())
  return Math.round(sumBy(varOf(cur)) / passed * days)
}
// Предложить проценты под выбранные статьи
function planSuggest(keys, now = new Date()) {
  const I = incomeBase(now) || 1, pc = n => Math.max(0, Math.ceil(n / I * 100))
  const billsM = sumBy(live(D.recur).filter(r => r.type !== "income")), vs = spendVar(now), spend = billsM + vs
  const lifeNeed = vs ? Math.max(15, pc(vs)) : 35   // на жизнь — сколько обычно уходит помимо платежей
  const items = []
  for (const k of keys.filter(k => k !== "life")) {
    let pct = ENV_STD[k] || 5, why = "обычная доля"
    if (k === "bills") { pct = pc(billsM); why = billsM ? `${num(billsM)} в месяц: ${live(D.recur).filter(r => r.type !== "income").slice(0, 3).map(r => r.title.toLowerCase()).join(", ")}` : "добавьте регулярные платежи" }
    if (k === "goals") { const need = sumBy(goalJars(keys.includes("cushion")), j => jarPlan(j)); pct = need ? pc(need) : 10; why = need ? `${num(need)} в месяц, чтобы копилки успели к сроку` : "копилок пока нет — 10%" }
    if (k === "cushion") { const goal = 6 * spend, have = envJar("cushion") ? +envJar("cushion").saved || 0 : 0
      const mo = spend ? Math.floor(have / spend) : 0
      pct = have >= goal && goal ? 0 : mo >= 3 ? 5 : 10; why = goal ? (pct ? `есть ${mo} мес. из 6 — ${pct === 10 ? "сначала подушка" : "добираем"}` : "6 месяцев уже есть — можно не откладывать") : "10%, пока подушки нет" }
    if (k === "debt") { const l = debts().filter(d => d.dir === "loan" && d.pay > 0); const x = sumBy(l, loanExtra); pct = x ? pc(x) : 0; why = x ? `+${num(x)} в месяц к кредиту — закроете раньше` : "кредитов нет" }
    if (k === "invest") why = "10% — привычная доля для капитала"
    if (k === "charity") why = "3% — можно больше"
    items.push({ k, pct, why })
  }
  // на жизнь должно хватать: ужимаем гибкие статьи, пока не хватит
  let rest = 100 - sumBy(items, z => z.pct)
  // не хватает на жизнь: гибкие статьи уступают пропорционально, но не больше половины своей доли
  let short = false
  if (rest < lifeNeed) {
    const fl = items.filter(z => FLEX.includes(z.k) && z.pct > 1), give = z => Math.floor(z.pct / 2), A = sumBy(fl, give), take = Math.min(lifeNeed - rest, A)
    for (const z of fl) { const c = A ? Math.round(give(z) * take / A) : 0; if (c > 0) { z.pct -= c; rest += c; z.why = (z.why ? z.why + " · " : "") + `было ${z.pct + c}%, ужал ради жизни` } }
    short = rest < lifeNeed
  }
  items.push({ k: "life", pct: Math.max(0, 100 - sumBy(items, z => z.pct)), why: (vs ? `обычно уходит ≈ ${num(vs)} в месяц помимо платежей` : "всё, что осталось") + (short ? " — остаётся меньше обычного: уменьшите копилки или срок" : "") })
  return items.map(z => Object.assign(z, { title: ENV(z.k).t }))
}
const planDefault = () => planSuggest(["bills", ...(jars().length ? ["goals"] : []), "cushion", "life"])
const planItems = () => (aplan() || { items: planDefault() }).items
// Свежий доход без раскладки — суммы по статьям
function allocPending(now = new Date()) {
  const key = core.monthKey(now)
  const inc = live(D.money).filter(e => e.type === "income" && e.amount >= 3000 && core.monthKey(new Date(e.date)) === key && now - e.date < 10 * 864e5 && e.date <= +now
    && !D.goals.some(a => a.id === "al:" + e.id)).sort((a, b) => b.date - a.date)[0]
  if (!inc) return null
  const rows = planItems().map(z => ({ k: z.k, title: z.title || ENV(z.k).t, pct: z.pct, x: Math.round(inc.amount * z.pct / 100 / 10) * 10 }))
  const fix = inc.amount - sumBy(rows, r => r.x), life = rows.find(r => r.k === "life"); if (life) life.x += fix
  // копилки на цели: делим по нужде каждой
  const g = rows.find(r => r.k === "goals")
  let js = []
  if (g && g.x > 0) { const l = goalJars().map(j => ({ j, need: Math.max(jarState(j, now).need, 1) })), tot = sumBy(l, z => z.need)
    js = l.map(z => ({ j: z.j, x: Math.floor(g.x * z.need / tot / 10) * 10 })); if (js.length) js[0].x += g.x - sumBy(js, z => z.x) }
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1
  return { inc, rows, js, perDay: Math.max(0, Math.round((life ? life.x : 0) / days)), planned: !!aplan(), jarSum: sumBy(rows.filter(r => r.k !== "bills" && r.k !== "life"), r => r.x) }
}
function envDeposit(k, x) {
  let j = envJar(k)
  if (!j) j = upsert("goals", { id: uid("j"), date: Date.now(), kind: "jar", env: k, title: ENV(k).t, target: 0, saved: 0, s0: 0, start: core.monthKey(new Date()), dep: {} })
  return jarDeposit(j, x)
}
function allocApply(a, skip) {
  if (!skip) for (const r of a.rows) {
    if (r.k === "bills" || r.k === "life" || !(r.x > 0)) continue
    if (r.k === "goals") { if (a.js.length) for (const z of a.js) jarDeposit(z.j, z.x); else envDeposit("goals", r.x) }
    else envDeposit(r.k, r.x)
  }
  upsert("goals", { id: "al:" + a.inc.id, date: Date.now(), kind: "alloc", inc: a.inc.id, skip: !!skip, jars: skip ? 0 : a.jarSum })
}
// сколько этот месяц уходит в статьи плана (кроме платежей и жизни): доля от дохода или уже отложенное
function planMonth(key = core.monthKey(new Date())) {
  const p = aplan()
  if (!p) return jarsMonth(key)
  const inc = core.monthTotals(live(D.money), key).income
  return sumBy(p.items.filter(z => z.k !== "bills" && z.k !== "life"), z => Math.max(inc * z.pct / 100, z.k === "goals" ? sumBy(goalJars(), j => jarDep(j, key)) : envJar(z.k) ? jarDep(envJar(z.k), key) : 0))
}
const planBar = items => `<div class="pl-bar">${items.filter(z => z.pct > 0).map(z => `<i style="flex:${z.pct};background:${ENV(z.k).c}" title="${esc(ENV(z.k).t)}"></i>`).join("")}</div>`
function planCard(anim) {
  const p = aplan(), items = planItems()
  return `<div class="card mn-in" ${anim()}><h2>Как раскладываю доход<button class="act" data-do="plan-edit">${p ? "Изменить" : "Настроить"}</button></h2>${planBar(items)}
    ${items.map(z => { const j = envJar(z.k), dep = j ? jarDep(j) : 0
      return `<div class="row pl-row" ${j ? `data-jar="${esc(j.id)}"` : ""}><span class="pl-ic" style="background:${ENV(z.k).c}">${tdIco(ENV(z.k).ico, 15)}</span><div class="grow"><div class="t">${esc(z.title || ENV(z.k).t)}</div>
        ${j ? `<div class="s">накоплено ${esc(core.money(j.saved || 0))}${dep ? ` · в ${MONTHS_PREP[new Date().getMonth()]} +${num(dep)}` : ""}</div>` : ""}</div><div class="amt">${z.pct}%</div></div>` }).join("")}
    ${p ? "" : `<div class="muted small" style="margin-top:6px">Это предложение по умолчанию. Нажмите «Настроить», выберите свои статьи — Изи подберёт проценты.</div>`}</div>`
}
function planForm() {
  const cur = aplan()
  let items = cur ? cur.items.map(z => Object.assign({}, z)) : planDefault()
  const s = sheet(`<h3>Как раскладывать доход</h3><div class="msg">Выберите статьи — Изи предложит проценты под ваши платежи, копилки и обычные траты. Любой процент можно поправить, «На жизнь» пересчитается сам.</div>
    <div class="field"><div class="chips" id="pl-ch">${ENVS.filter(e => e.k !== "life").map(e => `<button class="chip" data-k="${e.k}">${tdIco(e.ico, 14)} ${esc(e.t)}</button>`).join("")}</div></div>
    <div id="pl-bar"></div><div id="pl-l"></div>
    <div class="btns" style="margin-top:12px"><button class="btn" data-a="opt">Предложить оптимально</button><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  const lifeFix = () => { const l = items.find(z => z.k === "life"); l.pct = Math.max(0, 100 - sumBy(items.filter(z => z.k !== "life"), z => z.pct)) }
  const paint = () => {
    $$("#pl-ch .chip", s.el).forEach(b => b.classList.toggle("on", items.some(z => z.k === b.dataset.k)))
    $("#pl-bar", s.el).innerHTML = planBar(items)
    const over = sumBy(items.filter(z => z.k !== "life"), z => z.pct) > 100
    $("#pl-l", s.el).innerHTML = items.map(z => `<div class="row pl-row"><span class="pl-ic" style="background:${ENV(z.k).c}">${tdIco(ENV(z.k).ico, 15)}</span><div class="grow"><div class="t">${esc(ENV(z.k).t)}</div>${z.why ? `<div class="s">${esc(z.why)}</div>` : ""}</div>
      ${z.k === "life" ? `<b class="pl-life ${over ? "exp" : ""}">${z.pct}%</b>` : `<div class="pl-pct"><input type="number" inputmode="numeric" data-p="${z.k}" value="${z.pct}"><span>%</span></div>`}</div>`).join("") + (over ? `<div class="small exp">Больше 100% — уменьшите что-нибудь</div>` : "")
    $$("[data-p]", s.el).forEach(i => i.oninput = () => { const z = items.find(x => x.k === i.dataset.p); z.pct = Math.max(0, Math.round(+i.value || 0)); z.why = "ваш процент"; lifeFix()
      $("#pl-bar", s.el).innerHTML = planBar(items); const lb = $(".pl-life", s.el); lb.textContent = items.find(x => x.k === "life").pct + "%" })
  }
  $$("#pl-ch .chip", s.el).forEach(b => b.onclick = () => { const k = b.dataset.k, keys = items.map(z => z.k)
    const next = keys.includes(k) ? keys.filter(x => x !== k) : [...keys.filter(x => x !== "life"), k, "life"]
    items = planSuggest(ENVS.map(e => e.k).filter(x => next.includes(x))); if (navigator.vibrate) navigator.vibrate(8); paint() })
  $('[data-a="opt"]', s.el).onclick = () => { items = planSuggest(ENVS.map(e => e.k).filter(x => items.some(z => z.k === x))); paint(); toast("Предложил под ваши цифры") }
  $('[data-a="ok"]', s.el).onclick = () => { lifeFix(); if (sumBy(items.filter(z => z.k !== "life"), z => z.pct) > 100) return toast("Больше 100%")
    upsert("goals", { id: "aplan", date: Date.now(), kind: "aplan", items: items.map(z => ({ k: z.k, title: ENV(z.k).t, pct: z.pct, why: z.why || "" })) }); s.close(); render(); toast("План сохранён") }
  paint()
}

// — 5. Капитал: счета, наличные, вклады, имущество, долги; по месяцам
const ACCT_T = { cash: ["Наличные", "cash"], bank: ["Счёт или карта", "card"], dep: ["Вклад", "jar"], inv: ["Инвестиции", "trend"], prop: ["Недвижимость", "home"], car: ["Машина", "car2"] }
const accts = () => gk("acct").filter(a => a.title).sort((a, b) => Object.keys(ACCT_T).indexOf(a.type) - Object.keys(ACCT_T).indexOf(b.type) || a.date - b.date)
const debts = () => gk("debt").filter(d => d.title && d.amount > 0).sort((a, b) => (a.due || "9").localeCompare(b.due || "9"))
function capital() {
  const assets = sumBy(accts(), a => fx(+a.amount || 0, a.cur || baseCur())), jarSum = sumBy(gk("jar"), j => +j.saved || 0)
  const owe = sumBy(debts().filter(d => d.dir !== "in")), lent = sumBy(debts().filter(d => d.dir === "in"))
  return { assets, jarSum, owe, lent, total: Math.round(assets + lent - owe) }
}
function capSnap() {
  if (!accts().length) return
  const key = core.monthKey(new Date()), c = capital().total, g = D.goals.find(x => x.id === "caphist")
  if (g && !g.deleted && g.m && g.m[key] === c) return
  upsert("goals", { id: "caphist", date: Date.now(), kind: "caphist", m: Object.assign({}, g && !g.deleted ? g.m : {}, { [key]: c }) })
}
function capChart() {
  const g = D.goals.find(x => x.id === "caphist" && !x.deleted), m = (g && g.m) || {}
  const keys = Object.keys(m).sort().slice(-8)
  if (keys.length < 2) return ""
  const vals = keys.map(k => m[k]), lo = Math.min(...vals), hi = Math.max(...vals), W = 320, Hh = 70, pad = (hi - lo) * 0.15 || 1
  const pt = (v, i) => [Math.round(i * W / (keys.length - 1)), Math.round(Hh - 6 - (v - lo + pad) / (hi - lo + 2 * pad) * (Hh - 14))]
  const pts = vals.map(pt), line = pts.map(p => p.join(",")).join(" ")
  return `<svg class="cap-ch" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none"><defs><linearGradient id="capg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    <polygon points="0,${Hh} ${line} ${W},${Hh}" fill="url(#capg)"/><polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
    <div class="cap-m">${keys.map(k => `<span>${esc(core.monthTitle(k).slice(0, 3).toLowerCase())}</span>`).join("")}</div>`
}

// — 9. Долги и займы: план погашения кредита
function loanMonths(B, P, rate) {
  const r = (+rate || 0) / 1200
  if (!(P > 0)) return Infinity
  if (!r) return Math.ceil(B / P)
  const x = 1 - r * B / P
  return x <= 0 ? Infinity : Math.ceil(-Math.log(x) / Math.log(1 + r))
}
const loanExtra = d => Math.max(1000, Math.round((+d.pay || 0) * 0.3 / 1000) * 1000)
function debtLine(d, now = new Date()) {
  const due = parseIso(d.due), dd = due ? `${due.getDate()} ${MONTHS_GEN[due.getMonth()]}` : ""
  const late = due && sod(due) < sod(now)
  if (d.dir === "loan") {
    const n = loanMonths(d.amount, d.pay, d.rate)
    if (!isFinite(n)) return { t: d.title, s: d.pay ? "платёж не покрывает проценты — увеличьте платёж" : "укажите ежемесячный платёж — посчитаю срок", late: false }
    const x = loanExtra(d), n2 = loanMonths(d.amount, d.pay + x, d.rate), end = addDays(new Date(now.getFullYear(), now.getMonth() + n, 1), 0)
    return { t: d.title, s: `${num(d.pay)} в месяц · закроете в ${MONTHS_PREP[end.getMonth()]} ${end.getFullYear()}${n - n2 > 0 ? ` · +${num(x)} ${core.CONFIG.currency} в месяц → на ${n - n2} ${plural(n - n2, "месяц", "месяца", "месяцев")} раньше` : ""}`, late: false }
  }
  if (d.dir === "in") return { t: `${d.title} должен вам`, s: dd ? (late ? `обещал до ${dd} — срок прошёл` : `обещал до ${dd}`) : "без срока", late, ask: true }
  return { t: `Вы должны: ${d.title}`, s: dd ? (late ? `вернуть до ${dd} — срок прошёл` : `вернуть до ${dd}`) : "без срока", late }
}

// — 6. Охотник за подписками: регулярные платежи-подписки и повторяющиеся траты
const SUB_RE = /netflix|spotify|youtube|icloud|apple|google one|chatgpt|openai|claude|disney|hbo|кинопоиск|яндекс плюс|okko|ivi|telegram|телеграм|подписк|фитнес|gym|спортзал|xbox|playstation|adobe|canva|notion|dropbox|prime/i
const mKey = t => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").slice(0, 2).join(" ")
function subsFound(now = new Date()) {
  const out = [], since = +new Date(now.getFullYear(), now.getMonth() - 3, 1)
  for (const r of live(D.recur)) if (r.type !== "income" && (SUB_RE.test(r.title) || /подпис/i.test(r.category || "")))
    out.push({ key: "r:" + r.id, title: r.title, amount: r.amount, recur: r, why: `каждое ${r.day} число` })
  const groups = {}
  for (const e of live(D.money)) if (e.type === "expense" && e.date >= since && e.comment) { const k = mKey(e.comment); if (k) (groups[k] = groups[k] || []).push(e) }
  for (const [k, l] of Object.entries(groups)) {
    const months = new Set(l.map(e => core.monthKey(new Date(e.date))))
    if (months.size < 2 || l.length > months.size * 1.5) continue
    const am = l.map(e => e.amount).sort((a, b) => a - b), med = am[am.length >> 1]
    if (am.some(a => Math.abs(a - med) > med * 0.15) || (!SUB_RE.test(l[0].comment) && med > 5000)) continue
    if (out.some(o => mKey(o.title) === k)) continue
    const last = l.sort((a, b) => b.date - a.date)[0]
    out.push({ key: "m:" + k, title: core.cap(last.comment.split(/[,.;]/)[0].trim()), amount: med, why: `${months.size} ${plural(months.size, "месяц", "месяца", "месяцев")} подряд` })
  }
  const dec = k => D.goals.find(g => g.id === "sd:" + k && !g.deleted)
  return out.map(o => Object.assign(o, { dec: dec(o.key) })).filter(o => !o.dec || o.dec.keep)
}
function subDecide(o, keep) {
  upsert("goals", { id: "sd:" + o.key, date: Date.now(), kind: "subdec", key: o.key, keep, title: "" })
  if (keep) return
  if (o.recur) remove("recur", o.recur.id)
  remAdd({ title: `Отменить подписку: ${o.title}`, due: dayKey(new Date()) })
}

// — 7. Категории с одной поправки: «7-Eleven → Продукты»
const catRules = () => gk("catrule").filter(r => r.key && r.cat)
function ruleFor(comment, type = "expense") {
  const k = mKey(comment)
  if (!k) return null
  const l = catRules().filter(r => (r.type || "expense") === type)
  const r = l.find(r => r.key === k) || l.find(r => r.key.length >= 4 && (k.startsWith(r.key) || k.split(" ")[0] === r.key))
  return r ? r.cat : null
}
function ruleLearn(comment, cat, type = "expense") {
  const k = mKey(comment)
  if (!k || k.length < 2 || !cat || cat === "Другое") return null
  if (ruleFor(comment, type) === cat) return null
  const auto = core.parseMoney(" " + comment + " ", type).category
  if (auto === cat && !ruleFor(comment, type)) return null
  return upsert("goals", { id: "cr:" + type + ":" + k, date: Date.now(), kind: "catrule", key: k, label: comment.split(/[,.;]/)[0].trim().slice(0, 30), cat, type, title: "" })
}
// траты «Другое» из виджета и банка за 2 недели — по выученным правилам
function rulesApply() {
  let n = 0
  for (const e of live(D.money)) {
    if (e.category !== "Другое" || !e.comment || e.rk || Date.now() - e.date > 14 * 864e5) continue
    const c = ruleFor(e.comment, e.type)
    if (c && (core.CONFIG.categories[e.type] || []).some(x => x[0] === c)) { upsert("money", Object.assign({}, e, { category: c, rk: 1 })); n++ }
  }
  return n
}
const otherCount = key => core.monthTotals(live(D.money), key).items.filter(e => e.type === "expense" && e.category === "Другое").length

// — 10. Неделя в деньгах: похвали / пожури / сухо
function weekMoney(now = new Date()) {
  const t0 = sod(now), a = +addDays(t0, -6), b = +addDays(t0, 1), a0 = +addDays(t0, -13)
  const ex = (x, y) => mnyView(live(D.money)).filter(e => e.type === "expense" && e.date >= x && e.date < y)
  const w1 = ex(a, b), w0 = ex(a0, a)
  const byCat = l => l.reduce((m, e) => (m[e.category] = (m[e.category] || 0) + e.amount, m), {})
  const c1 = byCat(w1), c0 = byCat(w0)
  const deltas = [...new Set([...Object.keys(c1), ...Object.keys(c0)])].map(c => [c, (c1[c] || 0) - (c0[c] || 0)]).filter(d => d[0] !== "Другое")
  const v = MNY().view, js = jars().filter(j => (+j.saved || 0) < j.target && (v === "all" || (v === "shared") === !!j.shared)).map(j => ({ j, st: jarState(j, now) }))
  return { s1: sumBy(w1), s0: sumBy(w0), n1: w1.length, top: Object.entries(c1).sort((x, y) => y[1] - x[1])[0],
    better: deltas.filter(d => d[1] < -200).sort((x, y) => x[1] - y[1])[0], worse: deltas.filter(d => d[1] > 200).sort((x, y) => y[1] - x[1])[0],
    good: js.find(z => !z.st.late), bad: js.find(z => z.st.late), cs: canSpend(now), had0: w0.length > 0 }
}
function weekText(tone, w) {
  const m = n => `${num(n)} ${core.CONFIG.currency}`
  if (!w.n1) return tone === "roast" ? "За неделю ни одной записанной траты. Либо вы святой, либо забыли записать." : tone === "dry" ? "За 7 дней трат не записано." : "Неделя без трат — или без записей. Если первое — вы герой."
  const dlt = w.had0 && w.s0 ? Math.round((w.s1 - w.s0) / w.s0 * 100) : null
  const jarDue = z => { const [, dm] = String(z.j.due || "").split("-").map(Number); return dm ? MONTHS_NOM[dm - 1].toLowerCase() : "цель" }
  if (tone === "dry") return [`Неделя: −${m(w.s1)}${dlt != null ? ` (неделей раньше −${m(w.s0)}, ${dlt > 0 ? "+" : ""}${dlt}%)` : ""}.`,
    w.top ? `Больше всего: ${w.top[0]} — ${m(w.top[1])}.` : "", w.good || w.bad ? `Копилки: ${[w.good && `«${w.good.j.title}» по плану`, w.bad && `«${w.bad.j.title}» отстаёт на ${w.bad.st.late} мес.`].filter(Boolean).join(", ")}` : "",
    w.cs ? `Можно тратить: ${m(w.cs.perDay)} в день.` : ""].filter(Boolean).join(" ")
  if (tone === "roast") return [w.worse ? `Ну что ж: на «${w.worse[0]}» ушло на ${m(w.worse[1])} больше, чем неделю назад.` : dlt != null && dlt > 0 ? `Потрачено на ${dlt}% больше прошлой недели.` : `Потрачено ${m(w.s1)}. Придраться почти не к чему, но я постараюсь.`,
    w.bad ? `Копилка «${w.bad.j.title}» отстаёт на ${w.bad.st.late} ${plural(w.bad.st.late, "месяц", "месяца", "месяцев")}.` : w.top ? `Лидер недели — ${w.top[0]}: ${m(w.top[1])}.` : "",
    w.bad ? `Без героизма: минус одно кафе в неделю — и догоните.` : `Следующая неделя покажет, случайность это или характер.`].filter(Boolean).join(" ")
  return [w.better ? `Красавчик: «${w.better[0]}» на ${m(-w.better[1])} меньше, чем неделю назад` : dlt != null && dlt < 0 ? `Красавчик: потрачено на ${-dlt}% меньше, чем неделю назад` : `Неделя под контролем: ${m(w.s1)} на всё`,
    w.good ? `, и копилка «${w.good.j.title}» растёт по плану.` : ".", w.good ? ` Ещё неделя так — и ${jarDue(w.good)} в кармане.` : w.cs && w.cs.today > 0 ? ` Сегодня ещё можно ${m(w.cs.today)}.` : ""].join("")
}
const MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]

// ───────────── Экран «Деньги» ─────────────
function renderMoney() {
  const now = new Date(), cur = core.monthKey(now)
  monthKey = monthKey || cur
  fxLoad(); spendPublish(); capSnap()
  const mn = MNY(), all = live(D.money), list = mnyView(all), isCur = monthKey === cur
  const t = core.monthTotals(list, monthKey), bal = t.income - t.expense
  let html = "", k = 0
  const anim = () => `style="animation-delay:${(k++) * 45}ms"`
  // 1. Сегодня можно потратить
  if (isCur) {
    const cs = canSpend(now), b = baseCur()
    const pills = cs ? ["USD", "RUB", "THB"].filter(c => c !== b).map(c => `<span class="pill">≈ ${esc(fmtCur(Math.round(fx(cs.today, b, c)), c))}</span>`).join("") : ""
    html += cs ? `<div class="mn-hero mn-in" ${anim()} data-do="mn-why"><div class="k">Сегодня можно потратить</div><div class="v" data-count="${cs.today}">${esc(core.money(cs.today))}</div>
      <div class="s2">${cs.left > 0 ? `После платежей и копилок до ${cs.last} ${MONTHS_GEN[now.getMonth()]} остаётся ${esc(core.money(cs.left))}` : `Бюджет месяца уже потрачен на ${esc(core.money(-cs.left))} больше`}${cs.spentToday ? ` · сегодня уже −${num(cs.spentToday)}` : ""}</div>
      <div class="pills">${pills}</div></div>`
      : `<div class="mn-hero mn-in empty" ${anim()} data-do="income"><div class="k">Сегодня можно потратить</div><div class="v">—</div><div class="s2">Запишите доход этого месяца — посчитаю, сколько можно тратить в день после платежей и копилок</div></div>`
  }
  // 3. Пришёл доход — разложим?
  const al = isCur && allocPending(now)
  if (al) html += `<div class="card mn-alloc mn-in mn-swipe" ${anim()} data-swipe="alloc"><h2>Пришло ${esc(core.money(al.inc.amount))} — разложим?<button class="act" data-do="plan-edit">План</button></h2>${planBar(al.rows)}
    ${al.rows.filter(r => r.x > 0).map(r => { const sub = r.k === "bills" ? live(D.recur).filter(x => x.type !== "income").slice(0, 4).map(x => x.title.toLowerCase()).join(", ") : r.k === "goals" && al.js.length ? al.js.map(z => `${z.j.title} ${num(z.x)}`).join(" · ") : r.k === "life" ? `≈ ${num(al.perDay)} ${core.CONFIG.currency} в день` : ENV(r.k).d
      return `<div class="row pl-row"><span class="pl-ic" style="background:${ENV(r.k).c}">${tdIco(ENV(r.k).ico, 15)}</span><div class="grow"><div class="t">${esc(r.title)} <span class="muted small">${r.pct}%</span></div>${sub ? `<div class="s">${esc(sub)}</div>` : ""}</div><div class="amt ${r.k === "life" ? "inc" : ""}">${num(r.x)}</div></div>` }).join("")}
    ${al.planned ? "" : `<div class="muted small" style="margin-top:4px">Изи предложил по вашим платежам и копилкам. Свои статьи — благотворительность, инвестиции, обучение — в «План».</div>`}
    <button class="btn primary wide" data-do="mn-alloc">Разложить так</button><button class="btn ghost wide" data-do="mn-alloc-no">Не сейчас</button></div>`
  // 8. Все / Мои / Общие
  const vi = ["all", "mine", "shared"].indexOf(mn.view)
  html += `<div class="seg mn-seg mn-in" ${anim()} style="--i:${vi}"><i></i><button data-mv="all" class="${vi === 0 ? "on" : ""}">Все</button><button data-mv="mine" class="${vi === 1 ? "on" : ""}">Мои</button><button data-mv="shared" class="${vi === 2 ? "on" : ""}">Общие с ${esc(partnerIns(mn.partner))}</button></div>`
  // Месяц
  html += `<div class="card mn-in mn-tot" ${anim()}><div class="month mn-mon"><button data-mon="-1" aria-label="Месяц назад">‹</button><b>${esc(core.monthTitle(monthKey))}</b><button data-mon="1" ${isCur ? "disabled style=opacity:.3" : ""} aria-label="Месяц вперёд">›</button></div>
    <div class="totals"><div><div class="muted small">Расходы</div><div class="big exp">−${esc(core.money(t.expense))}</div></div>
      <div><div class="muted small">Доходы</div><div class="big inc">+${esc(core.money(t.income))}</div></div>
      <div class="muted small">Наличными −${num(t.cash.expense)} · картой −${num(t.transfer.expense)}</div>
      <div class="muted small">Баланс ${bal < 0 ? "−" : "+"}${esc(core.money(Math.abs(bal)))}</div></div>
    <div class="btns" style="margin-top:12px"><button class="btn primary" data-do="expense">Расход</button><button class="btn teal" data-do="income">Доход</button></div></div>`
  // 7. Запомнил правило
  const rule = isCur && catRules().filter(r => Date.now() - r.date < 3 * 864e5 && !(D.mnyOff || {})["rule:" + r.id]).sort((a, b) => b.date - a.date)[0]
  if (rule) {
    const o1 = otherCount(cur), o0 = otherCount(mKeyOf(mIdx(cur) - 1))
    html += `<div class="tip-card mn-in mn-swipe" ${anim()} data-swipe="rule:${esc(rule.id)}" data-do="mn-rules"><div class="ic" style="background:linear-gradient(160deg,#12C28A,#0A8F64)">${tdIco("spark", 20)}</div>
      <div class="grow"><b>Запомнил: ${esc(rule.label || rule.key)} → ${esc(rule.cat)}</b><div class="small muted">Дальше буду ставить так сам. «Другое» в этом месяце: ${o1} ${plural(o1, "трата", "траты", "трат")}${o0 ? `, в прошлом — ${o0}` : ""}.</div></div></div>`
  }
  // 2. Копилки
  const jl = jars().filter(j => mn.view === "all" || (mn.view === "shared") === !!j.shared)
  html += `<div class="card mn-in" ${anim()}><h2>Копилки<button class="act" data-do="jar-add">+ Новая</button></h2>` + (jl.length ? jl.map(j => {
    const st = jarState(j, now)
    return `<button class="mn-jar ${st.cls}" data-jar="${esc(j.id)}"><div class="top"><span>${tdIco("jar", 17)}<b>${esc(j.title)}</b>${j.shared ? `<em class="sh">${tdIco("people", 12)}</em>` : ""}</span><span class="am">${num(j.saved || 0)} / ${esc(core.money(j.target))}</span></div>
      <div class="bar"><i style="--w:${Math.round(st.p * 100)}%"></i></div><div class="s">${esc(st.txt)}</div></button>`
  }).join("") : `<div class="empty">Отпуск, подушка на полгода, новая машина: копилка со сроком сама посчитает, сколько откладывать в месяц и успеваете ли вы.</div>`) + `</div>`
  if (isCur && mn.view === "all") html += planCard(anim)
  // Лимиты по категориям
  const cats = Object.entries(t.cats.expense)
  for (const b of live(D.budgets)) if (b.limit > 0 && !cats.some(c => c[0] === b.category)) cats.push([b.category, 0])
  cats.sort((a, b) => b[1] - a[1])
  const top = Math.max(1, ...cats.map(c => c[1]))
  html += `<div class="card mn-in" ${anim()}><h2>Куда ушли деньги<button class="act" data-do="budgets">Лимиты</button></h2>` + (cats.length ? cats.map(([n, v]) => {
      const lim = budgetOf(n), p = lim ? v / lim : v / top
      return `<div class="cat"><div class="top"><span>${esc(n)}</span><b>${esc(core.money(v))}${lim ? `<span class="muted small"> из ${num(lim)}</span>` : ""}</b></div>
      <div class="prog ${lim && p > 1 ? "red" : lim && p >= 0.8 ? "warn" : "gold"}"><div style="width:${Math.min(1, p) * 100}%"></div></div>${lim && p > 1 ? `<div class="s exp small">превышено на ${esc(core.money(v - lim))}</div>` : ""}</div>`
    }).join("") : `<div class="empty">Расходов пока нет. «Лимиты» — сколько готовы тратить в месяц по категориям.</div>`) + `</div>`
  // Регулярные платежи
  const rec = live(D.recur).sort((a, b) => (a.day || 0) - (b.day || 0)), rk = monthKey
  html += `<div class="card mn-in" ${anim()}><h2>Регулярные платежи<button class="act" data-do="recur-add">+ Добавить</button></h2>` + (rec.length ? rec.map(r => {
      const paid = recurPaid(r, rk), late = !paid && rk === cur && recurDue(r) < sod(now)
      return `<div class="row" data-recur="${esc(r.id)}"><div class="grow"><div class="t">${esc(r.title)}</div><div class="s ${late ? "exp" : ""}">${r.day} числа · ${rk === cur ? esc(recurLabel(r)) : paid ? "оплачено" : "не оплачено"}</div></div>
        <div class="amt ${paid ? "inc" : ""}">${paid ? tdIco("check", 14) + " " : ""}${esc(core.money(r.amount))}</div></div>`
    }).join("") + `<div class="muted small" style="margin-top:6px">В месяц: ${esc(core.money(rec.filter(r => r.type !== "income").reduce((s, r) => s + r.amount, 0)))}</div>`
    : `<div class="empty">Аренда, интернет, подписки: в срок появятся в «Сегодня», оплата записывается в расходы одним нажатием.</div>`) + `</div>`
  // 6. Похоже на подписки
  const subs = isCur ? subsFound(now) : []
  if (subs.length) html += `<div class="card mn-in" ${anim()}><h2>Похоже на подписки</h2>${subs.slice(0, 6).map(o => o.dec ? `<div class="row mn-sub kept"><div class="grow"><div class="t">${esc(o.title)} · ${esc(core.money(o.amount))} / мес</div><div class="s">оставили · ${esc(core.money(o.amount * 12))} в год</div></div><span class="ok">${tdIco("check", 18)}</span></div>`
    : `<div class="row mn-sub"><div class="grow"><div class="t">${esc(o.title)} · ${esc(core.money(o.amount))} / мес</div><div class="s">${esc(o.why)} · ${esc(core.money(o.amount * 12))} в год — ещё нужно?</div></div>
      <div class="mn-yn"><button class="chip" data-sub="${esc(o.key)}" data-keep="1">Оставить</button><button class="chip no" data-sub="${esc(o.key)}" data-keep="0">Отменить</button></div></div>`).join("")}</div>`
  // 5. Капитал
  const cap = capital(), al2 = accts(), dl = debts()
  html += `<div class="card mn-in" ${anim()}><h2>Капитал${al2.length ? `<span class="cap-t">${esc(core.money(cap.total))}</span>` : `<button class="act" data-do="acct-add">+ Счёт</button>`}</h2>` + (al2.length ? capChart() + `<div class="grid2 cap-g">${al2.map(a => {
      const c = a.cur || baseCur()
      return `<button class="tile" data-acct="${esc(a.id)}"><div class="k">${tdIco(ACCT_T[a.type] ? ACCT_T[a.type][1] : "card", 13)} ${esc(a.title)}</div><div class="v">${esc(fmtCur(a.amount, c))}</div>${c !== baseCur() ? `<div class="k">≈ ${esc(core.money(Math.round(fx(a.amount, c))))}</div>` : ""}</button>` }).join("")}
      ${cap.jarSum ? `<div class="tile"><div class="k">${tdIco("jar", 13)} В копилках</div><div class="v">${esc(core.money(cap.jarSum))}</div><div class="k">уже внутри счетов</div></div>` : ""}
      ${dl.length ? `<button class="tile" data-do="mn-debts"><div class="k">${tdIco("hand", 13)} Долги</div><div class="v ${cap.lent - cap.owe < 0 ? "exp" : "inc"}">${cap.lent - cap.owe < 0 ? "−" : "+"}${esc(core.money(Math.abs(cap.lent - cap.owe)))}</div></button>` : ""}
      <button class="tile add" data-do="acct-add">${tdIco("plus", 16)} Счёт</button></div><div class="muted small" style="margin-top:8px">${esc(fxLine())}</div>`
    : `<div class="empty">Счета, наличные, вклады, квартира и долги — в один итог с графиком по месяцам. Валюты пересчитаются по курсу.</div>`) + `</div>`
  // 9. Долги и займы
  html += `<div class="card mn-in" id="mn-debts" ${anim()}><h2>Долги и займы<button class="act" data-do="debt-add">+ Добавить</button></h2>` + (dl.length ? dl.map(d => {
      const x = debtLine(d, now), sign = d.dir === "in" ? "+" : "−"
      return `<div class="row" data-debt="${esc(d.id)}"><div class="grow"><div class="t">${esc(x.t)}</div><div class="s ${x.late ? "exp" : ""}">${esc(x.s)}</div>${x.ask ? `<button class="chip mn-ask" data-debt-ask="${esc(d.id)}">Напомнить ему</button>` : ""}</div><div class="amt ${d.dir === "in" ? "inc" : ""}">${sign}${num(d.amount)}</div></div>` }).join("")
    : `<div class="empty">Кто кому должен и до какого числа. Для кредита — план погашения: насколько раньше закроете, если добавлять немного каждый месяц.</div>`) + `</div>`
  // 10. Неделя в деньгах
  if (isCur) { const ti = ["praise", "roast", "dry"].indexOf(mn.tone)
    html += `<div class="card mn-in" ${anim()}><h2>Неделя в деньгах</h2><div class="seg mn-seg" style="--i:${ti}"><i></i>${[["praise", "Похвали"], ["roast", "Пожури"], ["dry", "Сухо"]].map(([k2, n], i) => `<button data-tone="${k2}" class="${i === ti ? "on" : ""}">${n}</button>`).join("")}</div>
      <div class="mn-week" id="mn-week">${esc(weekText(mn.tone, weekMoney(now)))}</div></div>` }
  // Операции (4. валюты)
  const items = t.items.slice().reverse()
  html += `<div class="card mn-in mn-ops" ${anim()}><h2>Операции<span class="muted small" style="text-transform:none;letter-spacing:0">${items.length}</span></h2>`
  if (!items.length) html += `<div class="empty">Скажите помощнику «потратил 300 на такси» или «подарок маме 5000 рублей» — валюта пересчитается сама</div>`
  let last = ""
  for (const e of items) {
    const d = new Date(e.date), dk2 = dayKey(d)
    if (dk2 !== last) { html += `<div class="day-h">${esc(core.cap(dayName(d)))}</div>`; last = dk2 }
    const fc = e.cur && e.cur !== baseCur() && e.orig
    html += `<div class="row" data-money="${esc(e.id)}"><div class="time">${hm(d)}</div><div class="grow"><div class="t">${esc(e.comment ? core.cap(e.comment) : e.category)}${e.shared ? ` <em class="sh">${tdIco("people", 12)}</em>` : ""}</div>
      <div class="s">${esc(e.comment ? e.category : e.method === "cash" ? "наличные" : "карта / перевод")}${fc ? ` · ${esc(fmtCur(e.orig, e.cur))} ≈ ${esc(core.money(e.amount))}` : ""}</div></div>
      <div class="amt ${e.type === "expense" ? "exp" : "inc"}">${e.type === "expense" ? "−" : "+"}${esc(fc ? fmtCur(e.orig, e.cur) : core.money(e.amount))}</div></div>`
  }
  html += `</div><div class="btns"><button class="btn" data-report="month">Отчёт</button><button class="btn" data-do="mn-family">Семья</button>${D.conn && D.conn.sheetUrl ? '<button class="btn" data-do="sheet">Таблица</button>' : ""}</div>`
  return html
}
const partnerIns = n => { const s = String(n || "").trim() || "семьёй"; return /а$/.test(s) ? s.slice(0, -1) + "ой" : /я$/.test(s) ? s.slice(0, -1) + "ей" : s }

function bindMoney(v) {
  // число «можно потратить» набегает
  const cnt = $(".mn-hero [data-count]", v)
  if (cnt && !matchMedia("(prefers-reduced-motion: reduce)").matches) { const to = +cnt.dataset.count, t0 = performance.now(), dur = 700
    const step = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); cnt.textContent = core.money(Math.round(to * e)); if (p < 1) requestAnimationFrame(step) }
    if (to > 0) requestAnimationFrame(step) }
  $$("[data-mv]", v).forEach(b => b.onclick = () => { MNY().view = b.dataset.mv; save(false); const s = b.parentNode; s.style.setProperty("--i", ["all", "mine", "shared"].indexOf(b.dataset.mv)); setTimeout(render, 220) })
  $$("[data-tone]", v).forEach(b => b.onclick = () => { MNY().tone = b.dataset.tone; save(false); const s = b.parentNode; s.style.setProperty("--i", ["praise", "roast", "dry"].indexOf(b.dataset.tone))
    $$("button", s).forEach(x => x.classList.toggle("on", x === b)); const w = $("#mn-week", v); w.classList.remove("swap"); void w.offsetWidth; w.classList.add("swap"); w.textContent = weekText(b.dataset.tone, weekMoney()) })
  $$("[data-jar]", v).forEach(b => b.onclick = () => jarSheet(D.goals.find(x => x.id === b.dataset.jar)))
  $$("[data-acct]", v).forEach(b => b.onclick = () => acctForm(D.goals.find(x => x.id === b.dataset.acct)))
  $$("[data-debt]", v).forEach(b => b.onclick = () => debtForm(D.goals.find(x => x.id === b.dataset.debt)))
  $$("[data-debt-ask]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); debtRemind(D.goals.find(x => x.id === b.dataset.debtAsk)) })
  $$("[data-sub]", v).forEach(b => b.onclick = () => { const o = subsFound().find(z => z.key === b.dataset.sub); if (!o) return
    const keep = b.dataset.keep === "1"; subDecide(o, keep); if (navigator.vibrate) navigator.vibrate(10)
    const row = b.closest(".row"); row.classList.add("done-anim"); setTimeout(render, 300); toast(keep ? `Оставили: ${o.title}` : `Дело на сегодня: отменить ${o.title}`) })
  $$(".mn-swipe", v).forEach(c => { let x0 = null, dx = 0
    c.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; dx = 0 }, { passive: true })
    c.addEventListener("touchmove", e => { if (x0 == null) return; dx = e.touches[0].clientX - x0; c.style.transform = `translateX(${dx}px)`; c.style.opacity = 1 - Math.min(1, Math.abs(dx) / 240) }, { passive: true })
    c.addEventListener("touchend", () => { x0 = null; if (Math.abs(dx) > 90) { c.classList.add("gone"); mnDismiss(c.dataset.swipe); setTimeout(render, 250) } else { c.style.transform = ""; c.style.opacity = "" } }) })
}
function mnDismiss(k) {
  if (k === "alloc") { const a = allocPending(); if (a) allocApply(a, true); return }
  D.mnyOff = D.mnyOff || {}; D.mnyOff[k] = 1; save(false)
}
Object.assign(DO, {
  "mn-alloc": () => { const a = allocPending(); if (!a) return; allocApply(a); if (navigator.vibrate) navigator.vibrate(12); render(); toast(a.jarSum ? `Отложено ${core.money(a.jarSum)} · на жизнь ≈ ${core.money(a.perDay)} в день` : "Разложено") },
  "mn-alloc-no": () => { const c = $(".mn-alloc"); if (c) c.classList.add("gone"); mnDismiss("alloc"); setTimeout(render, 250) },
  "jar-add": () => jarForm(), "plan-edit": () => planForm(), "acct-add": () => acctForm(), "debt-add": () => debtForm(),
  "mn-debts": () => { const el = $("#mn-debts"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }) },
  "mn-rules": () => rulesSheet(), "mn-family": () => familyForm(),
  "mn-why": () => { const cs = canSpend(); if (!cs) return
    const t = core.monthTotals(live(D.money), core.monthKey(new Date()))
    ui.info("Как посчитано", `Доходы месяца ${core.money(t.income)}\n− уже потрачено ${core.money(t.expense - cs.spentToday)}\n− неоплаченные платежи ${core.money(cs.bills)}\n− копилки в этом месяце ${core.money(cs.jars)}\n= ${core.money(cs.left + cs.spentToday)} на ${cs.daysLeft} ${plural(cs.daysLeft, "день", "дня", "дней")}, то есть ${core.money(cs.perDay)} в день${cs.spentToday ? `.\nСегодня уже потрачено ${core.money(cs.spentToday)}` : ""}.`) },
})

function jarForm(j) {
  const e = j || { title: "", target: "", saved: "", due: core.monthKey(addDays(new Date(), 200)), shared: false }
  let shared = !!e.shared
  const s = sheet(`<h3>${j ? "Копилка" : "Новая копилка"}</h3>
    <div class="field"><input id="j-t" placeholder="На что: отпуск в Японии, подушка" value="${esc(e.title)}"></div>
    <div class="field"><label>Цель, ${esc(core.CONFIG.currency)}</label><input id="j-a" type="number" inputmode="decimal" value="${e.target}"></div>
    <div class="field"><label>Уже отложено</label><input id="j-s" type="number" inputmode="decimal" value="${e.saved || ""}" placeholder="0"></div>
    <div class="field"><label>Собрать к</label><input id="j-d" type="month" value="${esc(e.due || "")}"></div>
    <div class="field"><button class="chip ${shared ? "on" : ""}" id="j-sh">${tdIco("people", 14)} Общая с ${esc(partnerIns(MNY().partner))}</button></div>
    <div class="btns">${j ? '<button class="btn red" data-a="del">Удалить</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  $("#j-sh", s.el).onclick = ev => { shared = !shared; ev.currentTarget.classList.toggle("on", shared) }
  if (!j) setTimeout(() => $("#j-t", s.el).focus(), 250)
  $('[data-a="no"]', s.el).onclick = () => s.close()
  if (j) $('[data-a="del"]', s.el).onclick = async () => { if ((await ui.confirm("Удалить копилку?", `<div class="msg">«${esc(j.title)}» и её история пропадут. Деньги на счетах не тронутся.</div>`, ["Отмена", "Удалить"])) !== "Удалить") return; remove("goals", j.id); s.close(); render() }
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#j-t", s.el).value.trim(), target = Math.round(+$("#j-a", s.el).value || 0), saved = Math.round(+$("#j-s", s.el).value || 0), due = $("#j-d", s.el).value
    if (!title) return toast("Напишите, на что копите")
    if (!(target > 0)) return toast("Введите цель")
    jarSave(j, { title, target, saved, due, shared }); s.close(); render(); toast(j ? "Сохранено" : `Копилка «${title}»: ${core.money(jarPlan(jarFind(title)))} в месяц`)
  }
}
function jarSave(j, x) {
  const key = core.monthKey(new Date())
  const base = j || { id: uid("j"), date: Date.now(), kind: "jar", start: key, dep: {} }
  const rec = Object.assign({}, base, x)
  if (!j || j.target !== x.target || j.due !== x.due) { rec.s0 = (+rec.saved || 0) - jarDep(rec, key); rec.start = key }
  return upsert("goals", rec)
}
function jarSheet(j) {
  if (!j) return
  const st = jarState(j)
  const s = sheet(`<h3>${esc(j.title)}</h3><div class="msg">${num(j.saved || 0)} из ${esc(core.money(j.target))} · ${esc(st.txt)}</div>
    <div class="field"><label>Отложить сейчас</label><input id="jd-a" type="number" inputmode="decimal" value="${st.need || ""}" placeholder="0"></div>
    <div class="btns"><button class="btn" data-a="edit">Изменить</button><button class="btn" data-a="take">Взять</button><button class="btn primary" data-a="ok">Отложить</button></div>`)
  $('[data-a="edit"]', s.el).onclick = () => { s.close(); jarForm(j) }
  const go = sign => { const a = Math.round(+$("#jd-a", s.el).value || 0); if (!(a > 0)) return toast("Введите сумму")
    const r = jarDeposit(j, sign * Math.min(a, sign < 0 ? +j.saved || 0 : a)); s.close(); if (navigator.vibrate) navigator.vibrate(12); render()
    toast(sign > 0 ? (r.saved >= r.target ? `«${r.title}» собрана!` : `+${core.money(a)} в «${r.title}»`) : `Взято из «${r.title}»`) }
  $('[data-a="ok"]', s.el).onclick = () => go(1)
  $('[data-a="take"]', s.el).onclick = () => go(-1)
}

function acctForm(a) {
  const e = a || { title: "", type: "bank", amount: "", cur: baseCur() }
  let type = e.type, cur = e.cur || baseCur()
  const s = sheet(`<h3>${a ? "Счёт" : "Новый счёт"}</h3>
    <div class="field"><div class="chips" id="a-ty">${Object.entries(ACCT_T).map(([k, [n, ic]]) => `<button class="chip" data-t="${k}">${tdIco(ic, 14)} ${esc(n)}</button>`).join("")}</div></div>
    <div class="field"><input id="a-t" placeholder="Название: Kasikorn, наличные дома, квартира" value="${esc(e.title)}"></div>
    <div class="field"><label>Сколько сейчас</label><div class="mn-amt"><input id="a-a" type="number" inputmode="decimal" value="${e.amount}"><div class="mn-cur" id="a-c">${Object.keys(CUR).map(c => `<button data-c="${c}">${CUR[c]}</button>`).join("")}</div></div></div>
    <div class="msg small">Обновляйте остатки раз в месяц — график капитала строится по ним.</div>
    <div class="btns">${a ? '<button class="btn red" data-a="del">Удалить</button>' : ""}<button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  const paint = () => { $$("#a-ty .chip", s.el).forEach(b => b.classList.toggle("on", b.dataset.t === type)); $$("#a-c button", s.el).forEach(b => b.classList.toggle("on", b.dataset.c === cur)) }
  paint()
  $$("#a-ty .chip", s.el).forEach(b => b.onclick = () => { type = b.dataset.t; if (!$("#a-t", s.el).value) $("#a-t", s.el).placeholder = ACCT_T[type][0]; paint() })
  $$("#a-c button", s.el).forEach(b => b.onclick = () => { cur = b.dataset.c; paint() })
  $('[data-a="no"]', s.el).onclick = () => s.close()
  if (a) $('[data-a="del"]', s.el).onclick = () => { remove("goals", a.id); s.close(); render() }
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#a-t", s.el).value.trim() || ACCT_T[type][0], amount = Math.round(+$("#a-a", s.el).value || 0)
    upsert("goals", Object.assign({}, a || { id: uid("a"), date: Date.now(), kind: "acct" }, { title, type, amount, cur })); s.close(); render(); toast("Капитал обновлён")
  }
}

function debtForm(d) {
  const e = d || { title: "", dir: "in", amount: "", due: "", rate: "", pay: "" }
  let dir = e.dir
  const s = sheet(`<h3>${d ? "Долг" : "Новый долг"}</h3>
    <div class="field"><div class="seg mn-seg" id="d-k" style="--i:${["in", "out", "loan"].indexOf(dir)}"><i></i><button data-k="in">Мне должны</button><button data-k="out">Я должен</button><button data-k="loan">Кредит</button></div></div>
    <div class="field"><input id="d-t" placeholder="Кто или что: Андрей, автокредит" value="${esc(e.title)}"></div>
    <div class="field"><label id="d-al">Сумма, ${esc(core.CONFIG.currency)}</label><input id="d-a" type="number" inputmode="decimal" value="${e.amount}"></div>
    <div class="field d-due"><label>До какого числа</label><input id="d-d" type="date" value="${esc(e.due || "")}"></div>
    <div class="field d-loan"><label>Платёж в месяц</label><input id="d-p" type="number" inputmode="decimal" value="${e.pay || ""}"></div>
    <div class="field d-loan"><label>Ставка, % годовых</label><input id="d-r" type="number" inputmode="decimal" value="${e.rate || ""}" placeholder="0"></div>
    <div class="btns">${d ? '<button class="btn red" data-a="del">Удалить</button><button class="btn" data-a="pay">Внести платёж</button>' : '<button class="btn" data-a="no">Отмена</button>'}<button class="btn primary" data-a="ok">Сохранить</button></div>`)
  const paint = () => { $$("#d-k button", s.el).forEach(b => b.classList.toggle("on", b.dataset.k === dir)); $("#d-k", s.el).style.setProperty("--i", ["in", "out", "loan"].indexOf(dir))
    $$(".d-loan", s.el).forEach(x => x.hidden = dir !== "loan"); $(".d-due", s.el).hidden = dir === "loan"; $("#d-al", s.el).textContent = dir === "loan" ? `Осталось выплатить, ${core.CONFIG.currency}` : `Сумма, ${core.CONFIG.currency}` }
  paint()
  $$("#d-k button", s.el).forEach(b => b.onclick = () => { dir = b.dataset.k; paint() })
  const no = $('[data-a="no"]', s.el); if (no) no.onclick = () => s.close()
  if (d) {
    $('[data-a="del"]', s.el).onclick = () => { remove("goals", d.id); s.close(); render(); toast("Долг закрыт") }
    $('[data-a="pay"]', s.el).onclick = async () => { const v = await ui.ask(d.dir === "in" ? "Вернули часть" : "Платёж", d.dir === "in" ? "Сколько вернули" : "Сколько внесли — запишу в расходы", d.dir === "loan" ? String(d.pay || "") : "", { type: "number" })
      const a = Math.round(+v || 0); if (!(a > 0)) return
      const left = Math.max(0, d.amount - a)
      if (left) upsert("goals", Object.assign({}, d, { amount: left })); else remove("goals", d.id)
      if (d.dir !== "in") upsert("money", { id: `f${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, date: Date.now(), type: "expense", amount: a, method: "transfer", category: catPick(["Кредиты", "Долги", "Другое"]), comment: d.dir === "loan" ? `${d.title}: платёж` : `Вернул: ${d.title}` })
      s.close(); render(); toast(left ? `Осталось ${core.money(left)}` : "Долг закрыт полностью") }
  }
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#d-t", s.el).value.trim(), amount = Math.round(+$("#d-a", s.el).value || 0)
    if (!title) return toast("Напишите, кто или что")
    if (!(amount > 0)) return toast("Введите сумму")
    upsert("goals", Object.assign({}, d || { id: uid("q"), date: Date.now(), kind: "debt" }, { title, dir, amount, due: dir === "loan" ? "" : $("#d-d", s.el).value,
      pay: dir === "loan" ? Math.round(+$("#d-p", s.el).value || 0) : 0, rate: dir === "loan" ? +$("#d-r", s.el).value || 0 : 0 })); s.close(); render(); toast("Сохранено")
  }
}
const catPick = l => { const have = (core.CONFIG.categories.expense || []).map(c => c[0]); return l.find(c => have.includes(c)) || have[have.length - 1] || "Другое" }
function debtRemind(d) {
  if (!d) return
  const due = parseIso(d.due), text = `Привет! Напоминаю про ${core.money(d.amount)}${due ? `, договаривались до ${due.getDate()} ${MONTHS_GEN[due.getMonth()]}` : ""}. Когда удобно вернуть?`
  if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard.writeText(text).then(() => toast("Текст скопирован — вставьте в мессенджер"))
}
function rulesSheet() {
  const l = catRules().sort((a, b) => b.date - a.date)
  const s = sheet(`<h3>Выученные категории</h3><div class="msg">Один раз поправили категорию — дальше Изи ставит её сам, и для трат из банка тоже.</div>
    ${l.map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.label || r.key)}</div><div class="s">→ ${esc(r.cat)}</div></div><button class="chip" data-del="${esc(r.id)}">Забыть</button></div>`).join("") || '<div class="empty">Пока ничего</div>'}
    <div class="btns"><button class="btn" data-a="no">Готово</button></div>`)
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $$("[data-del]", s.el).forEach(b => b.onclick = () => { remove("goals", b.dataset.del); b.closest(".row").remove() })
}
function familyForm() {
  const mn = MNY()
  const s = sheet(`<h3>Семейный бюджет</h3><div class="msg">Общие траты и копилки отмечаются в форме. Фильтр «Общие» показывает только их. Когда ${esc(mn.partner)} подключит IZIDAY к той же таблице, она увидит общее, а ваше личное — нет.</div>
    <div class="field"><label>Имя</label><input id="fm-n" value="${esc(mn.partner)}"></div>
    <div class="btns"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Сохранить</button></div>`)
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => { mn.partner = $("#fm-n", s.el).value.trim() || "Оля"; save(false); s.close(); render() }
}

// — Погода (Open-Meteo, без ключа): по месту из телефона или виджета, раз в час
async function wxLoad(force) {
  if (!force && D.wx && Date.now() - D.wx.at < 3600e3) return
  const here = await whereAmI().catch(() => null)
  if (!here) return
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${here.lat.toFixed(3)}&longitude=${here.lng.toFixed(3)}&hourly=temperature_2m,precipitation_probability,precipitation&forecast_days=7&timezone=auto`)
    const j = await r.json()
    if (!j.hourly) return
    D.wx = { at: Date.now(), h: j.hourly.time.map((t, i) => ({ t: +parseIso(t), c: Math.round(j.hourly.temperature_2m[i]), p: j.hourly.precipitation_probability[i] || 0, mm: j.hourly.precipitation[i] || 0 })) }
    save(false); if ((tab === "today" || tab === "cal") && !stack.length) render()
  } catch (e) {}
}
const wxAt = at => D.wx && D.wx.h.find(x => x.t <= +at && +at < x.t + 3600e3)
function wxLine(now = new Date()) {
  if (!D.wx) return ""
  const cur = wxAt(now); if (!cur) return ""
  const rain = D.wx.h.find(x => x.t > +now && x.t < +addDays(sod(now), 1) && x.p >= 60 && x.mm >= 0.5)
  return `${cur.c}°${rain ? `, после ${hm(new Date(rain.t))} ${rain.mm >= 4 ? "ливень" : "дождь"}` : cur.p >= 60 ? ", дождь" : ""}`
}
const wxRain = (s, e) => D.wx && D.wx.h.find(x => x.t + 3600e3 > +s && x.t < +e && x.p >= 60 && x.mm >= 0.5)

// — Дорога до места события: считает таблица (route), кэш на 20 минут
function travelOf(e) {
  if (!e || !e.location || e.all_day) return null
  const k = (e.id || e.title) + "|" + e.start, c = (D.trav || {})[k]
  if (c && Date.now() - c.at < 20 * 60e3) return c
  if (!travBusy[k] && D.conn) { travBusy[k] = 1; travelCalc(e, k).finally(() => { delete travBusy[k] }) }
  return c || null
}
const travBusy = {}
async function travelCalc(e, k) {
  const r = await runTool("route_to", { to: e.location }).catch(() => null)
  D.trav = D.trav || {}
  for (const x of Object.keys(D.trav)) if (Date.now() - D.trav[x].at > 12 * 3600e3) delete D.trav[x]
  D.trav[k] = r && !r.error && (r.minutes_in_traffic || r.minutes) ? { at: Date.now(), min: Math.round(r.minutes_in_traffic || r.minutes), km: r.km } : { at: Date.now(), min: 0 }
  save(false); if ((tab === "today" || tab === "cal") && !stack.length) render()
}

// — 4. «Сейчас»: текущее или следующее событие, когда выезжать, кнопка «Фокус»
function nowCard(v, now = new Date()) {
  const evs = v.events.filter(e => !e.all_day && e.e > now && sameDay(e.s, now)).sort((a, b) => a.s - b.s)
  const e = evs[0]
  if (!e) return ""
  const tr = travelOf(e), going = e.s <= now, mins = Math.round((e.s - now) / 60e3)
  const leave = tr && tr.min ? new Date(+e.s - (tr.min + 10) * 60e3) : null, inL = leave ? Math.round((leave - now) / 60e3) : null
  const when = going ? `идёт · до ${hm(e.e)}` : mins < 60 ? `через ${mins} мин` : `в ${hm(e.s)}`
  return `<div class="hero-now" data-now="${esc(e.id || "")}"><div class="k">${going ? "Сейчас" : "Дальше"} · ${when}</div><div class="v">${esc(e.title || "(без названия)")}</div>
    <div class="s2">${hm(e.s)}–${hm(e.e)}${e.location ? " · " + esc(e.location) : ""}${tr && tr.km ? `, ${Math.round(tr.km)} км` : ""}</div>
    <div class="pills">${leave && !going ? `<span class="pill ${inL < 15 ? "hot" : ""}">${tdIco("car")} ${inL <= 0 ? "пора выезжать" : `выехать в ${hm(leave)} — через ${inL} мин`}</span>` : ""}
    <button class="pill" data-do="td-focus">${tdIco("focus")} Фокус ${POMO.work} мин</button></div></div>`
}

// — 6. Кольца дня
function ringsCard(v, now = new Date()) {
  const h = dayHealth(), g = H(), t0 = sod(now)
  const remsToday = v.reminders.filter(r => { const d = remDue(r); return d && sameDay(d, now) || r.completed && r.doneAt && sameDay(r.doneAt, now) })
  const done = remsToday.filter(r => r.completed).length
  const cs = canSpend(now)
  const R = (p, color, label, val, act) => { const r = 21, L = 2 * Math.PI * r
    return `<button class="rg" data-do="${act}"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="${r}" class="mr-t"/><circle cx="26" cy="26" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${L * Math.max(0.001, Math.min(1, p || 0))} ${L}" transform="rotate(-90 26 26)"/></svg><span>${label}</span><b>${val}</b></button>` }
  return `<div class="card rings-card"><div class="rings">
    ${R(remsToday.length ? done / remsToday.length : 0, "var(--ok, #0A9F6E)", "дела", `${done} из ${remsToday.length}`, "td-top3")}
    ${R(h.water / g.waterGoal, "#0A84FF", "вода", liters(h.water) + " л", "water")}
    ${R((h.steps || 0) / (g.stepGoal || 10000), "#FF9F0A", "шаги", h.steps != null ? num(h.steps) : "—", "tab-health")}
    ${R((h.protein || 0) / proteinGoal(), "#AF52DE", "белок", num(h.protein) + " г", "tab-health")}
    ${cs ? R(cs.perDay ? cs.today / cs.perDay : 0, "#30B0C7", "можно", core.money(cs.today), "tab-money") : R(0, "#30B0C7", "траты", "−" + num(live(D.money).filter(e => e.type === "expense" && sameDay(e.date, now)).reduce((s, e) => s + e.amount, 0)), "tab-money")}
  </div></div>`
}

// — 2. Три главных дела дня
function top3Ids(day = dayKey(new Date())) { const g = goalOf("top3", day); return g ? (g.ids || []) : [] }
function top3Card(v, now = new Date()) {
  const ids = top3Ids(), byId = id => v.reminders.find(r => r.id === id)
  const list = ids.map(byId).filter(Boolean)
  if (!list.length) {
    const cand = openRems(v).filter(r => !remDue(r) || remDue(r) < addDays(sod(now), 1))
    if (!cand.length || now.getHours() >= 15) return ""
    return `<div class="card top3"><h2>Три главных<button class="act" data-do="td-top3">Выбрать</button></h2><div class="muted small">Минута утром: выберите три дела, ради которых день будет удачным. Они встанут наверх.</div></div>`
  }
  return `<div class="card top3"><h2>Три главных<button class="act" data-do="td-top3">Изменить</button></h2>${list.map((r, i) => `<div class="row ${r.completed ? "past" : ""}">
    <button class="n ${r.completed ? "on" : ""}" ${r.completed ? "" : `data-check="${esc(r.id)}"`}>${r.completed ? tdIco("check", 14) : i + 1}</button>
    <div class="grow"><div class="t">${esc(r.title)}</div>${remDue(r) && remHasTime(r) ? `<div class="s">${hm(remDue(r))}</div>` : ""}</div></div>`).join("")}</div>`
}
function top3Pick() {
  const v = iphone(), now = new Date(), cur = top3Ids()
  const cand = openRems(v).filter(r => !remDue(r) || remDue(r) < addDays(sod(now), 2)).sort((a, b) => (cur.includes(b.id) - cur.includes(a.id)) || (!remDue(a)) - (!remDue(b)) || (remDue(a) || 0) - (remDue(b) || 0))
  let sel = cur.filter(id => cand.some(r => r.id === id))
  const s = sheet(`<h3>Три главных на сегодня</h3><div class="msg">Отметьте до трёх дел. Остальное — если останется время.</div>
    <div id="t3">${cand.slice(0, 30).map(r => `<button class="opt t3 ${sel.includes(r.id) ? "on" : ""}" data-id="${esc(r.id)}">${esc(r.title)}${remDue(r) ? `<span class="muted small"> · ${esc(remLabel(r))}</span>` : ""}</button>`).join("") || '<div class="empty">Нет открытых дел</div>'}</div>
    <div class="field"><input id="t3-new" placeholder="Или новое дело…"></div>
    <div class="btns"><button class="btn" data-a="no">Отмена</button><button class="btn primary" data-a="ok">Готово</button></div>`)
  $$(".t3", s.el).forEach(b => b.onclick = () => {
    const id = b.dataset.id
    if (sel.includes(id)) sel = sel.filter(x => x !== id); else if (sel.length < 3) sel.push(id); else return toast("Не больше трёх")
    $$(".t3", s.el).forEach(x => x.classList.toggle("on", sel.includes(x.dataset.id)))
  })
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => {
    const t = $("#t3-new", s.el).value.trim()
    if (t && sel.length < 3) sel.push(remAdd({ title: t, due: dayKey(new Date()) }).id)
    const day = dayKey(new Date()), g = goalOf("top3", day)
    upsert("goals", Object.assign(g || { id: uid("t"), date: Date.now(), kind: "top3", day }, { ids: sel }))
    s.close(); render()
  }
}

// — 3. Перегруз: дела без времени по 30 мин против свободного времени до 22:00
function dayLoad(v, now = new Date()) {
  const end = new Date(sod(now)); end.setHours(DAY_TO, 0, 0, 0)
  const from = new Date(Math.max(+now, +new Date(sod(now)).setHours(DAY_FROM, 0, 0, 0)))
  if (from >= end) return null
  const busy = v.events.filter(e => !e.all_day && e.e > from && e.s < end).reduce((s, e) => s + (Math.min(+e.e, +end) - Math.max(+e.s, +from)) / 60e3 + ((travelOf(e) || {}).min || 0) * 2, 0)
  const tasks = openRems(v).filter(r => { const d = remDue(r); return d && sameDay(d, now) || (d && d < sod(now)) })
  const need = tasks.reduce((s, r) => s + (+(D.rems.find(x => x.id === r.id) || {}).est || 30), 0)
  const free = Math.max(0, (end - from) / 60e3 - busy)
  return { need, free, tasks }
}
function loadCard(v, now = new Date()) {
  const day = dayKey(now)
  if ((D.tdOff || {})["load:" + day] || now.getHours() >= 18) return ""
  const l = dayLoad(v, now)
  if (!l || l.need <= l.free + 30 || l.tasks.length < 3) return ""
  const keep = new Set(top3Ids(day)), move = l.tasks.filter(r => !keep.has(r.id)).slice(-Math.max(1, Math.ceil((l.need - l.free) / 30)))
  if (!move.length) return ""
  const h = m => (m / 60).toFixed(m % 60 ? 1 : 0).replace(".", ",")
  return `<div class="warn-card">${tdIco("alert", 22)}<div><b>День перегружен</b>Дел примерно на ${h(l.need)} ч, свободно ${h(l.free)} ч. Перенести ${move.slice(0, 2).map(r => `«${esc(r.title)}»`).join(" и ")}${move.length > 2 ? ` и ещё ${move.length - 2}` : ""} на завтра?
    <div class="chips"><button class="chip on" data-do="td-move" data-ids="${esc(move.map(r => r.id).join(","))}">Перенести</button><button class="chip" data-do="td-load-off">Оставить</button></div></div></div>`
}
function tdMoveTomorrow(ids) {
  const tm = addDays(sod(new Date()), 1)
  for (const id of ids) { const r = D.rems.find(x => x.id === id); if (!r) continue
    const d = remDue(r), nd = d && remHasTime(r) ? iso(new Date(tm.getFullYear(), tm.getMonth(), tm.getDate(), d.getHours(), d.getMinutes())) : dayKey(tm)
    remSet(id, { due: nd }) }
  toast(`Перенесено на завтра: ${ids.length}`); render()
}

// — 1. Таймлайн дня: события, дорога, дела со временем, свободные окна, линия «сейчас», дождь
function timelineHTML(v, day, evs, now = new Date()) {
  const isT = sameDay(day, now), t0 = sod(day)
  const items = []
  evs.forEach((e, i) => {
    if (e.all_day || e.s < t0) return
    const tr = isT && e.s > now ? travelOf(e) : null
    if (tr && tr.min) items.push({ s: new Date(+e.s - tr.min * 60e3), e: e.s, kind: "road", min: tr.min })
    items.push({ s: e.s, e: e.e, kind: "ev", ev: e, i })
  })
  const rems = v.reminders.filter(r => !r.completed && remHasTime(r) && sameDay(remDue(r), day))
  rems.forEach(r => items.push({ s: remDue(r), e: new Date(+remDue(r) + 30 * 60e3), kind: "rem", r }))
  items.sort((a, b) => a.s - b.s)
  // свободные окна ≥ 45 мин в пределах 8–22 (на сегодня — от текущего момента)
  const start = new Date(t0); start.setHours(DAY_FROM, 0, 0, 0)
  const end = new Date(t0); end.setHours(DAY_TO, 0, 0, 0)
  let cur = isT ? new Date(Math.max(+start, Math.ceil(+now / 9e5) * 9e5)) : start
  const gaps = []
  for (const it of items.filter(x => x.kind !== "rem")) { if (it.s - cur >= 45 * 60e3) gaps.push({ s: new Date(cur), e: it.s, kind: "free" }); if (it.e > cur) cur = new Date(it.e) }
  if (end - cur >= 45 * 60e3) gaps.push({ s: new Date(cur), e: end, kind: "free" })
  const undated = openRems(v).filter(r => !remDue(r) || (!remHasTime(r) && sameDay(remDue(r), day)))
  const all = items.concat(gaps).sort((a, b) => a.s - b.s || (a.kind === "road" ? -1 : 1))
  let html = "", nowDone = !isT, lastH = -1
  const dur = (a, b) => { const m = Math.round((b - a) / 60e3); return m >= 60 ? `${Math.floor(m / 60)} ч${m % 60 ? " " + (m % 60) + " мин" : ""}` : m + " мин" }
  let sugg = 0
  for (const it of all) {
    if (!nowDone && it.s > now) { html += `<div class="tl-now"><span>${hm(now)}</span></div>`; nowDone = true }
    const hh = it.s.getHours(), lbl = hh !== lastH && it.kind !== "road" ? `<div class="tl-h">${hm(it.s)}</div>` : ""
    if (it.kind !== "road") lastH = hh
    const past = isT && it.e <= now
    if (it.kind === "road") html += `<div class="tl-it road">${tdIco("car", 14)} дорога ${it.min} мин · выехать в ${hm(it.s)}</div>`
    else if (it.kind === "ev") { const e = it.ev, rain = wxRain(e.s, e.e)
      html += `${lbl}<div class="tl-it ev ${past ? "past" : ""} ${e.pending ? "pending" : ""}" data-ev="${it.i}" style="--c:${esc(e.color || "var(--teal)")}"><b>${esc(e.title || "(без названия)")}</b><small>${hm(e.s)}–${hm(e.e)}${e.location ? " · " + esc(e.location) : ""}${rain ? ` · ${tdIco("rain", 12)} ${rain.mm >= 4 ? "ливень" : "дождь"}` : ""}</small></div>` }
    else if (it.kind === "rem") { const r = it.r
      html += `${lbl}<div class="tl-it task ${r.completed ? "past" : ""}"><button class="check ${r.completed ? "on" : ""}" ${r.completed ? "" : `data-check="${esc(r.id)}"`}></button><div><b>${esc(r.title)}</b><small>${hm(it.s)}</small></div></div>` }
    else if (it.kind === "free") { const pick = undated[sugg++]
      html += `${lbl}<button class="tl-it free" data-gap="${+it.s}" data-gap-end="${+it.e}">+ Свободно ${hm(it.s)}–${hm(it.e)} · ${dur(it.s, it.e)}${pick ? ` · поставить «${esc(pick.title)}»?` : ""}</button>` }
  }
  if (!nowDone) html += `<div class="tl-now"><span>${hm(now)}</span></div>`
  return `<div class="tl">${html || '<div class="empty">Ничего не запланировано</div>'}</div>`
}
// Нажали на свободное окно: выбрать дело и поставить его на это время
function gapPick(s, e) {
  const v = iphone(), day = new Date(s)
  const cand = openRems(v).filter(r => !remDue(r) || !remHasTime(r) || remDue(r) < new Date())
  ui.choose(`Свободно ${hm(new Date(s))}–${hm(new Date(e))}`, "Что поставить на это время?", cand.slice(0, 12).map(r => r.title).concat(["+ Новое дело"])).then(async i => {
    if (i < 0) return
    let r = cand[i]
    if (!r) { const t = await ui.ask("Новое дело", "", ""); if (!t) return; r = remAdd({ title: t }) }
    remSet(r.id, { due: iso(day) }); toast(`«${r.title}» — в ${hm(day)}`); render()
  })
}

// — 7. Одна подсказка дня (можно смахнуть или скрыть до завтра)
function tipCard(v, now = new Date()) {
  const day = dayKey(now), off = (D.tdOff || {})
  const tips = []
  const cats = (core.CONFIG.categories.expense || []).map(c => c[0])
  for (const c of cats) { const b = budgetState(c); if (b && b.p >= 0.8 && b.p <= 1.5) tips.push({ k: "b:" + c, ico: "wallet", col: "#30B0C7", t: b.left >= 0 ? `До лимита «${c}» осталось ${core.money(b.left)}` : `«${c}»: лимит превышен на ${core.money(-b.left)}`, s: `Потрачено ${num(b.spent)} из ${core.money(b.limit)} в этом месяце` }) }
  const bill = recurSoon()[0]; if (bill) tips.push({ k: "r:" + bill.id, ico: "bill", col: "#FF9F0A", t: `${bill.title}: ${core.money(bill.amount)} ${recurLabel(bill)}`, s: "Регулярный платёж — нажмите «Оплачено» в напоминаниях, когда оплатите" })
  for (const d of debts()) { const due = parseIso(d.due); if (d.dir !== "loan" && due && sod(due) - sod(now) <= 2 * 864e5) { const x = debtLine(d, now); tips.push({ k: "d:" + d.id, ico: "hand", col: "#5E5CE6", t: `${x.t}: ${core.money(d.amount)}`, s: x.s }); break } }
  const h = dayHealth(), gap = waterGap(h); if (gap) tips.push({ k: "w", ico: "drop", col: "#0A84FF", t: `${gap} ч без воды`, s: `Выпито ${liters(h.water)} из ${liters(H().waterGoal)} л — стакан сейчас` })
  const tip = tips.find(t => !off["tip:" + day + ":" + t.k])
  if (!tip) return ""
  return `<div class="tip-card" data-tip="${esc(tip.k)}"><div class="ic" style="background:${tip.col}">${tdIco(tip.ico, 20)}</div><div class="grow"><b>${esc(tip.t)}</b><div class="small muted">${esc(tip.s)}</div></div><button class="x" data-tip-off="${esc(tip.k)}" aria-label="Скрыть">${ICO.x}</button></div>`
}

// — 8. Шаблоны дня: набор дел со временем одним нажатием
const dayTpls = () => live(D.goals).filter(g => g.kind === "dtpl" && g.title)
function tplCard(now = new Date()) {
  const l = dayTpls()
  return `<div class="card"><h2>Шаблон дня<button class="act" data-do="td-tpl-new">+ Свой</button></h2>${l.length ? `<div class="chips">${l.map(t => `<button class="chip" data-tpl="${esc(t.id)}">${tdIco(t.ico || "tpl", 15)} ${esc(t.title)}</button>`).join("")}</div>`
    : '<div class="muted small">Сохраните обычный день как шаблон — «Рабочий», «Выходной с детьми», «Поездка» — и ставьте все его дела одним нажатием.</div>'}</div>`
}
function tplApply(id) {
  const t = D.goals.find(x => x.id === id); if (!t) return
  const d = sod(new Date()), have = new Set(live(D.rems).filter(r => !r.done && remDue(r) && sameDay(remDue(r), d)).map(r => normT(r.title)))
  let n = 0
  for (const it of t.items || []) { if (have.has(normT(it.t))) continue
    const [hh, mm] = String(it.time || "").split(":").map(Number)
    remAdd({ title: it.t, due: it.time ? iso(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm || 0)) : dayKey(d) }); n++ }
  toast(n ? `«${t.title}»: добавлено ${n} ${plural(n, "дело", "дела", "дел")}` : "Все дела шаблона уже есть"); render()
}
function tplForm(t) {
  const d = sod(new Date())
  const base = t ? (t.items || []) : live(D.rems).filter(r => remDue(r) && sameDay(remDue(r), d)).map(r => ({ t: r.title, time: remHasTime(r) ? hm(remDue(r)) : "" }))
  let ico = t ? t.ico || "tpl" : "brief"
  const s = sheet(`<h3>${t ? esc(t.title) : "Новый шаблон дня"}</h3><div class="msg">По строке на дело. Время в начале — по желанию: «9:00 Зарядка».</div>
    <div class="field"><label>Название</label><input id="tp-t" value="${t ? esc(t.title) : ""}" placeholder="Рабочий, Выходной с детьми…"></div>
    <div class="field"><label>Значок</label><div class="chips" id="tp-i">${["brief", "kid", "car", "sun", "moon", "star"].map(k => `<button class="chip ${k === ico ? "on" : ""}" data-i="${k}">${tdIco(k, 16)}</button>`).join("")}</div></div>
    <div class="field"><label>Дела</label><textarea id="tp-l" rows="7">${esc(base.map(x => (x.time ? x.time + " " : "") + x.t).join("\n"))}</textarea></div>
    <div class="btns">${t ? '<button class="btn red" data-a="del">Удалить</button>' : '<button class="btn" data-a="no">Отмена</button>'}<button class="btn primary" data-a="ok">Сохранить</button></div>`)
  $$("#tp-i .chip", s.el).forEach(b => b.onclick = () => { ico = b.dataset.i; $$("#tp-i .chip", s.el).forEach(x => x.classList.toggle("on", x === b)) })
  const no = $('[data-a="no"]', s.el); if (no) no.onclick = () => s.close()
  const del = $('[data-a="del"]', s.el); if (del) del.onclick = () => { remove("goals", t.id); s.close(); render() }
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#tp-t", s.el).value.trim(); if (!title) return toast("Назовите шаблон")
    const items = $("#tp-l", s.el).value.split("\n").map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(/^(\d{1,2})[:.](\d{2})\s+(.+)$/); return m ? { t: m[3], time: `${z2(+m[1])}:${m[2]}` } : { t: x, time: "" } })
    if (!items.length) return toast("Добавьте хотя бы одно дело")
    upsert("goals", Object.assign(t || { id: uid("d"), date: Date.now(), kind: "dtpl" }, { title, ico, items })); s.close(); render(); toast("Шаблон сохранён")
  }
}

// — 5. Вечернее закрытие дня (с 19:00): что сделано, что перенести, строка о дне и настроение
const MOODS = [["#FF453A", "M8 16c2-2 6-2 8 0"], ["#FF9F0A", "M8 16h8"], ["#E5B800", "M8 15.5c2 1 6 1 8 0"], ["#34C759", "M8 14.5c2 2.5 6 2.5 8 0"], ["#0A9F6E", "M7.5 13.5c2 4 7 4 9 0"]]
const moodFace = (i, s = 28) => { const [c, m] = MOODS[i]; return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><circle cx="9" cy="10" r=".7" fill="${c}"/><circle cx="15" cy="10" r=".7" fill="${c}"/><path d="${m}"/></svg>` }
function closeDayCard(v, now = new Date()) {
  if (now.getHours() < 19) return ""
  const day = dayKey(now), note = goalOf("daynote", day)
  const st = dayStats(v, now)
  return `<div class="hero-eve" data-do="td-close"><div class="k">${note ? "День закрыт" : "Закрыть день"}</div><div class="v">${st.done} из ${st.total}</div>
    <div class="s2">${st.top ? `Главные: ${st.topDone} из ${st.top}. ` : ""}Вода ${liters(st.water)} л${st.steps != null ? `, шаги ${num(st.steps)}` : ""}.${note && note.text ? ` «${esc(note.text.slice(0, 60))}»` : ""}</div>
    ${note ? "" : '<span class="pill">Подвести итог за минуту →</span>'}</div>`
}
function dayStats(v, now = new Date()) {
  const rs = v.reminders.filter(r => { const d = remDue(r); return d && sameDay(d, now) || r.completed && r.doneAt && sameDay(r.doneAt, now) })
  const ids = top3Ids(dayKey(now)), h = dayHealth()
  return { total: rs.length, done: rs.filter(r => r.completed).length, top: ids.length, topDone: ids.filter(id => (v.reminders.find(r => r.id === id) || {}).completed).length, water: h.water, steps: h.steps }
}
function closeDay() {
  const v = iphone(), now = new Date(), day = dayKey(now), g = goalOf("daynote", day)
  const left = openRems(v).filter(r => { const d = remDue(r); return d && d < addDays(sod(now), 1) })
  let mood = g ? g.mood : -1
  const s = sheet(`<h3>Итоги дня</h3>${left.length ? `<div class="msg">Не сделано — перенести на завтра или убрать:</div>${left.map(r => `<div class="row cd" data-id="${esc(r.id)}"><div class="grow"><div class="t">${esc(r.title)}</div><div class="s">${esc(remLabel(r))}</div></div><button class="chip" data-m="tm">Завтра</button><button class="chip" data-m="del">Убрать</button></div>`).join("")}` : '<div class="msg">Все дела на сегодня сделаны.</div>'}
    <div class="field"><label>Одна строка о дне</label><textarea id="cd-t" rows="2" placeholder="Что было главным, что получилось">${g ? esc(g.text || "") : ""}</textarea></div>
    <div class="field"><label>Настроение</label><div class="moods" id="cd-m">${MOODS.map((_, i) => `<button class="${i === mood ? "on" : ""}" data-i="${i}">${moodFace(i)}</button>`).join("")}</div></div>
    <div class="btns"><button class="btn" data-a="no">Позже</button><button class="btn primary" data-a="ok">Закрыть день</button></div>`)
  $$(".cd [data-m]", s.el).forEach(b => b.onclick = () => { const row = b.closest(".cd"), id = row.dataset.id
    if (b.dataset.m === "tm") tdMoveTomorrow([id]); else { const r = D.rems.find(x => x.id === id); if (r) upsert("rems", Object.assign({}, r, { deleted: true })) }
    row.remove() })
  $$("#cd-m button", s.el).forEach(b => b.onclick = () => { mood = +b.dataset.i; $$("#cd-m button", s.el).forEach(x => x.classList.toggle("on", x === b)) })
  $('[data-a="no"]', s.el).onclick = () => s.close()
  $('[data-a="ok"]', s.el).onclick = () => {
    upsert("goals", Object.assign(g || { id: uid("n"), date: Date.now(), kind: "daynote", day }, { text: $("#cd-t", s.el).value.trim().slice(0, 500), mood }))
    s.close(); render(); toast("День закрыт. Хорошего вечера")
  }
}

// — 10. Итог недели: по воскресеньям после 17:00 и в понедельник утром
function weekCard(v, now = new Date()) {
  const dw = now.getDay()
  if (!(dw === 0 && now.getHours() >= 17 || dw === 1 && now.getHours() < 12)) return ""
  const end = dw === 0 ? addDays(sod(now), 1) : sod(now), start = addDays(end, -7), pstart = addDays(start, -7)
  const inW = (t, a = start, b = end) => t && t >= +a && t < +b
  const doneN = live(D.rems).filter(r => r.done && inW(r.doneAt)).length
  const dueN = live(D.rems).filter(r => { const d = remDue(r); return d && inW(+d) }).length
  const exp = (a, b) => live(D.money).filter(e => e.type === "expense" && inW(e.date, a, b)).reduce((s, e) => s + e.amount, 0)
  const e1 = exp(start, end), e0 = exp(pstart, start), dlt = e0 ? Math.round((e1 - e0) / e0 * 100) : 0
  const hb = habitList().map(h => ({ h, n: habitStreak(h, addDays(end, -1)) })).sort((a, b) => b.n - a.n)[0]
  const steps = []; for (let d = start; d < end; d = addDays(d, 1)) { const x = dayHealth(d); if (x.steps) steps.push(x.steps) }
  const tile = (val, k, p, col) => `<div class="tile"><div class="v">${val}</div><div class="k">${k}</div>${p != null ? `<div class="bar"><i style="width:${Math.round(Math.min(1, p) * 100)}%;${col ? "background:" + col : ""}"></i></div>` : ""}</div>`
  return `<div class="card"><h2>Итог недели<span class="muted small" style="font-weight:500">${start.getDate()}–${addDays(end, -1).getDate()} ${MONTHS_GEN[addDays(end, -1).getMonth()]}</span></h2><div class="grid2">
    ${tile(`${doneN}${dueN ? " / " + Math.max(dueN, doneN) : ""}`, "дел сделано", dueN ? doneN / Math.max(dueN, doneN) : null)}
    ${hb ? tile(`${hb.n} ${plural(hb.n, "день", "дня", "дней")}`, `серия «${esc(hb.h.title)}»`, hb.n / 7, "#FF9F0A") : tile("—", "привычек нет")}
    ${tile("−" + core.money(e1), e0 ? `расходы, ${dlt <= 0 ? "на " + -dlt + "% меньше" : "на " + dlt + "% больше"}` : "расходы за неделю")}
    ${tile(steps.length ? num(steps.reduce((a, b) => a + b, 0) / steps.length) : "—", "шагов в среднем")}</div>
    <button class="btn primary wide" data-do="td-week-plan">План на следующую неделю</button></div>`
}

// — сборка экрана «Сегодня» для текущего дня
function todayTop(v, now = new Date()) {
  wxLoad()
  return closeDayCard(v, now) + nowCard(v, now) + ringsCard(v, now) + loadCard(v, now) + top3Card(v, now) + weekCard(v, now)
}
function todayBottom(v, now = new Date()) { return tipCard(v, now) + tplCard(now) }
Object.assign(DO, {
  "td-focus": () => { const v = iphone(), now = new Date(), e = v.events.filter(e => !e.all_day && e.e > now && sameDay(e.s, now)).sort((a, b) => a.s - b.s)[0]
    const t = top3Ids().map(id => v.reminders.find(r => r.id === id)).find(r => r && !r.completed)
    pomoStart(t ? t.title : e ? "Подготовка: " + e.title : "Фокус"); render() },
  "td-top3": () => top3Pick(),
  "td-load-off": () => { D.tdOff = D.tdOff || {}; D.tdOff["load:" + dayKey(new Date())] = 1; save(false); render() },
  "td-tpl-new": () => tplForm(),
  "td-close": () => closeDay(),
  "td-week-plan": () => { setTab("chat"); setTimeout(() => chatSend("Составь со мной план на следующую неделю: посмотри мой календарь, дела, цели месяца и итоги этой недели. Предложи три главных цели недели и разложи их по дням."), 50) },
})
function bindToday(v) {
  $$('[data-do="td-move"]', v).forEach(b => b.onclick = () => tdMoveTomorrow(b.dataset.ids.split(",")))
  $$("[data-gap]", v).forEach(b => b.onclick = () => gapPick(+b.dataset.gap, +b.dataset.gapEnd))
  $$("[data-tpl]", v).forEach(b => { let t = null
    b.onpointerdown = () => { t = setTimeout(() => { t = "long"; tplForm(D.goals.find(x => x.id === b.dataset.tpl)) }, 600) }
    b.onpointerup = b.onpointerleave = () => { if (t && t !== "long") clearTimeout(t) }
    b.onclick = () => { if (t === "long") { t = null; return } tplApply(b.dataset.tpl) } })
  $$("[data-tip-off]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); D.tdOff = D.tdOff || {}; D.tdOff["tip:" + dayKey(new Date()) + ":" + b.dataset.tipOff] = 1
    for (const k of Object.keys(D.tdOff)) if (!k.includes(dayKey(new Date()))) delete D.tdOff[k]
    save(false); const c = b.closest(".tip-card"); c.classList.add("gone"); setTimeout(render, 250) })
  $$(".tip-card", v).forEach(c => { let x0 = null
    c.addEventListener("touchstart", e => { x0 = e.touches[0].clientX }, { passive: true })
    c.addEventListener("touchmove", e => { if (x0 == null) return; const dx = e.touches[0].clientX - x0; c.style.transform = `translateX(${dx}px)`; c.style.opacity = 1 - Math.min(1, Math.abs(dx) / 220) }, { passive: true })
    c.addEventListener("touchend", e => { const dx = (e.changedTouches[0].clientX - x0) || 0; x0 = null; if (Math.abs(dx) > 90) $("[data-tip-off]", c).click(); else { c.style.transform = ""; c.style.opacity = "" } }) })
}

// ═════════════ Календарь 2.0: день / 3 дня / неделя / месяц, слои семьи, дорога блоками, защищённое время, дела в окна,
// ввод фразой с предпросмотром, шаблоны событий, нагрузка месяца, «когда я свободен», погода, второй часовой пояс ═════════════
// В goals (синхронизируется без нового деплоя скрипта): kind "etpl" {title, min, location, remind, bring}, "pblk" {title, days:[1..7], from, to}
// Настройки экрана — только на телефоне: D.cal {view, layers, tz, tzOn, map: {календарь: me|olya|kids|off}, names: {olya}}
Object.assign(TD_ICO, {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
  share: '<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  grid: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.7 7-6.5 7-2.6 0-4.3-1.3-5.7-3.5L3 14a1.5 1.5 0 0 1 2.4-1.8L8 15"/>',
  chev: '<path d="M9 5l7 7-7 7"/>', back: '<path d="M15 5l-7 7 7 7"/>', wand: '<path d="M4 20L16 8M14 4v3M19 9h-3M18.5 4.5l-2 2"/>'
})
const LAYER_C = { me: "#0A9F6E", olya: "#AF52DE", kids: "#FF9F0A" }
const TZS = [["Europe/Moscow", "Москва", "Мск"], ["Asia/Yekaterinburg", "Уфа", "Уфа"], ["Asia/Dubai", "Дубай", "Дуб"], ["Europe/London", "Лондон", "Лон"], ["America/New_York", "Нью-Йорк", "НЙ"]]
function calS() {
  const c = D.cal = D.cal || {}
  for (const [k, v] of Object.entries({ view: "3", tz: "Europe/Moscow", tzOn: 0, map: {}, names: {}, layers: {} })) if (c[k] == null) c[k] = v
  for (const k of ["me", "olya", "kids"]) if (c.layers[k] == null) c.layers[k] = 1
  return c
}
function layerName(k) {
  if (k === "me") return "Я"
  if (k === "kids") return "Дети"
  const S = calS(); if (S.names.olya) return S.names.olya
  const c = ((D.gcal && D.gcal.events) || []).map(e => e.calendar).find(n => n && evLayer({ calendar: n }) === "olya")
  return c && c.length <= 12 ? c : "Семья"
}
const tzInfo = () => TZS.find(t => t[0] === calS().tz) || TZS[0]
function tzHm(d, tz = calS().tz) { try { return new Intl.DateTimeFormat("ru-RU", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d) } catch (e) { return "" } }
function evLayer(e) {
  const m = calS().map[e.calendar || ""]
  if (m) return m
  const c = normT(e.calendar)
  if (/(^|\s)ол[яиеью]|olya|olga|жен[аы]|wife|муж|husband|семь|family/.test(c)) return "olya"
  if (/дет|kid|сын|доч|школ|school|сад/.test(c)) return "kids"
  return "me"
}
const atHM = (d, s) => { const [h, m] = String(s || "0:0").split(":").map(Number); const x = sod(d); x.setHours(h || 0, m || 0, 0, 0); return x }
const durLbl = m => m >= 60 ? `${Math.floor(m / 60)} ч${m % 60 ? " " + (m % 60) + " мин" : ""}` : `${m} мин`
const dayWord = d => { const t = sod(new Date()), k = Math.round((sod(d) - t) / 864e5); return k === 0 ? "сегодня" : k === 1 ? "завтра" : WD[d.getDay()] }

// — 5. Защищённые блоки
const pblks = () => live(D.goals).filter(g => g.kind === "pblk" && g.title)
const pblkOn = d => pblks().filter(p => (p.days || []).map(Number).includes(wdOf(d))).map(p => ({ p, s: atHM(d, p.from), e: atHM(d, p.to) })).filter(x => x.e > x.s)
function protHit(s, e) { for (let d = sod(s); d < e; d = addDays(d, 1)) { const h = pblkOn(d).find(x => x.s < e && x.e > s); if (h) return h } return null }

// — занятость и свободные окна: мои события, совместные из других слоёв («Обед с Олей»), дорога, защищённое время, дела со временем
const evMine = e => { const L = evLayer(e); return L === "me" || L !== "off" && /(^|\s)(с|со)\s+\S/i.test(e.title || "") }
function travCached(e) { if (!e || !e.location || e.all_day) return null; const c = (D.trav || {})[(e.id || e.title) + "|" + e.start]; return c && c.min ? c : null }
const remEst = r => +(D.rems.find(x => x.id === r.id) || {}).est || 30
function busyOn(v, day) {
  const d0 = sod(day), d1 = addDays(d0, 1), out = []
  for (const e of v.events) {
    if (e.all_day || e.e <= d0 || e.s >= d1 || !evMine(e)) continue
    const tr = travCached(e)
    out.push({ s: new Date(+e.s - (tr ? tr.min : 0) * 60e3), e: e.e, t: e.title, ev: e })
  }
  for (const x of pblkOn(d0)) out.push({ s: x.s, e: x.e, t: x.p.title, prot: 1 })
  for (const r of v.reminders) if (!r.completed && remHasTime(r) && sameDay(remDue(r), d0)) out.push({ s: remDue(r), e: new Date(+remDue(r) + remEst(r) * 60e3), t: r.title, rem: r })
  return out.sort((a, b) => a.s - b.s)
}
function freeGaps(v, day, from = DAY_FROM, to = DAY_TO, min = 30, after = null) {
  const s0 = atHM(day, from + ":00"), s1 = atHM(day, to + ":00"), out = []
  let cur = after && after > s0 ? new Date(Math.ceil(+after / 9e5) * 9e5) : s0, prev = null
  for (const b of busyOn(v, day)) {
    if (cur < s1 && Math.min(+b.s, +s1) - cur >= min * 60e3) out.push({ s: new Date(cur), e: new Date(Math.min(+b.s, +s1)), prev, next: b })
    if (b.e > cur) { cur = new Date(b.e); prev = b }
  }
  if (s1 - cur >= min * 60e3) out.push({ s: new Date(cur), e: s1, prev, next: null })
  return out
}
// — 1. Дело без времени → первое подходящее окно (после встречи — 15 минут запаса)
function slotsFor(v, r, from = new Date(), taken = [], max = 1) {
  const need = remEst(r), out = []
  for (let i = 0; i < 4 && out.length < max; i++) {
    const d = addDays(sod(from), i)
    for (const g of freeGaps(v, d, DAY_FROM, DAY_TO, need, i === 0 ? from : null)) {
      let s = g.prev && g.prev.ev ? new Date(Math.ceil((+g.s + 15 * 60e3) / 9e5) * 9e5) : g.s
      for (const t of taken.filter(t => sameDay(t.s, d)).sort((a, b) => a.s - b.s)) if (t.s < new Date(+s + need * 60e3) && t.e > s) s = t.e
      if (g.e - s >= need * 60e3) { out.push({ s, e: new Date(+s + need * 60e3), prev: g.prev, next: g.next }); if (out.length >= max) break }
    }
  }
  return out
}
const slotWhy = sl => sl.prev && sl.next ? ` (между «${sl.prev.t}» и «${sl.next.t}»)` : sl.prev ? ` (после «${sl.prev.t}»)` : sl.next ? ` (до «${sl.next.t}»)` : ""
function slotPut(r, sl) {
  const x = D.rems.find(z => z.id === r.id); if (!x) return
  const ev = sl.prev && sl.prev.ev
  upsert("rems", Object.assign({}, x, { due: iso(sl.s), anchor: ev ? { ev: ev.id, at: ev.end, off: Math.round((sl.s - ev.e) / 60e3) } : null }))
}
// Встречу перенесли — дела, поставленные «после неё», едут следом
function calReflow() {
  const v = iphone(); let n = 0
  for (const r of live(D.rems)) {
    const a = r.anchor
    if (!a || r.done || !remHasTime(r)) continue
    const was = parseIso(a.at), c = v.events.filter(e => e.id === a.ev).sort((x, y) => Math.abs(x.e - was) - Math.abs(y.e - was))[0]
    if (!c || Math.abs(c.e - was) > 3 * 864e5) { upsert("rems", Object.assign({}, r, { anchor: null })); continue }
    if (c.end === a.at) continue
    upsert("rems", Object.assign({}, r, { due: iso(new Date(+c.e + a.off * 60e3)), anchor: Object.assign({}, a, { at: c.end }) })); n++
  }
  if (n) toast(`Встреча сдвинулась — ${n} ${plural(n, "дело переехало", "дела переехали", "дел переехали")} следом`)
}

// — 9. Погода на день: максимум и дождь днём
function wxDay(d) {
  if (!D.wx) return ""
  const a = +atHM(d, "08:00"), b = +atHM(d, "20:00"), h = D.wx.h.filter(x => x.t >= a && x.t < b)
  if (!h.length) return ""
  const rain = h.some(x => x.p >= 60 && x.mm >= 0.5)
  return `<i class="wx ${rain ? "r" : ""}">${tdIco(rain ? "rain" : "sun", 13)}${Math.max(...h.map(x => x.c))}°</i>`
}

// — что рисуется в колонке дня
let calCache = []
function calItems(v, d, now) {
  const S = calS(), d0 = sod(d), d1 = addDays(d0, 1), out = [], allDay = []
  const prots = S.layers.me ? pblkOn(d0) : []
  for (const e of v.events) {
    if (e.e <= d0 || e.s >= d1) continue
    const L = evLayer(e)
    if (L === "off" || !S.layers[L]) continue
    if (e.all_day) { allDay.push({ kind: "ev", ev: e, L }); continue }
    const s = e.s < d0 ? d0 : e.s, en = e.e > d1 ? d1 : e.e
    const pr = prots.find(p => normT(p.p.title) === normT(e.title) && p.s < en && p.e > s)
    if (pr) pr.used = 1
    out.push({ kind: "ev", ev: e, s, e: en, L, prot: !!pr })
    if (L === "me" && e.location && e.s > now && e.s - now < 2 * 864e5) {
      const tr = travelOf(e) || travCached(e)
      if (tr && tr.min) out.push({ kind: "road", s: new Date(+e.s - tr.min * 60e3), e: e.s, min: tr.min, ev: e })
    }
  }
  for (const p of prots) if (!p.used) out.push({ kind: "prot", s: p.s, e: p.e, p: p.p })
  if (S.layers.kids) for (const k of kidsOn(d0)) if (/^\d{1,2}:\d\d/.test(k.time || "")) { const s = atHM(d0, k.time); out.push({ kind: "kid", s, e: new Date(+s + (+k.min || 60) * 60e3), k }) }
  if (S.layers.me) for (const r of v.reminders) if (!r.completed && remHasTime(r) && sameDay(remDue(r), d0)) out.push({ kind: "rem", s: remDue(r), e: new Date(+remDue(r) + Math.max(30, remEst(r)) * 60e3), r })
  // дорога, на которую нет времени: предыдущая встреча кончается позже, чем надо выезжать
  for (const it of out) if (it.kind === "road") it.late = out.some(x => x.kind === "ev" && x.ev !== it.ev && x.L === "me" && x.e > it.s && x.s < it.s)
  return { items: out.sort((a, b) => a.s - b.s), allDay }
}
// раскладка пересекающихся блоков по дорожкам
function calLanes(items) {
  const lane = items.filter(x => x.kind === "ev" || x.kind === "kid" || x.kind === "rem").sort((a, b) => a.s - b.s || b.e - a.e)
  let grp = [], end = 0
  const flush = () => { const n = Math.max(...grp.map(x => x.ln + 1)); grp.forEach(x => x.n = n); grp = [] }
  for (const it of lane) {
    if (grp.length && +it.s >= end) { flush(); end = 0 }
    const used = grp.filter(x => x.e > it.s).map(x => x.ln)
    let l = 0; while (used.includes(l)) l++
    it.ln = l; grp.push(it); end = Math.max(end, +it.e)
  }
  if (grp.length) flush()
}
const CALL_RE = /звон|созвон|call|zoom|мам|пап|родител|москв|уф[аеу]/i
function calGrid(v, start, n, now) {
  const S = calS(), days = [...Array(n)].map((_, i) => addDays(start, i)), PX = n === 1 ? 62 : n === 3 ? 54 : 46
  const cols = days.map(d => calItems(v, d, now))
  let h0 = DAY_FROM, h1 = 21
  for (const c of cols) for (const it of c.items) { h0 = Math.min(h0, it.s.getHours()); h1 = Math.max(h1, it.e.getHours() + (it.e.getMinutes() || sameDay(it.e, addDays(it.s, 1)) ? 1 : 0)) }
  h0 = Math.max(0, h0); h1 = Math.min(24, Math.max(h1, h0 + 8))
  const y = t => Math.round((t.getHours() + t.getMinutes() / 60 - h0) * PX)
  const tz = tzInfo()
  let html = `<div class="cg n${n}" style="--px:${PX}px"><div class="cg-head"><div class="cg-tc"></div>${days.map(d => `<button class="cg-dh ${sameDay(d, now) ? "td" : ""} ${d.getDay() % 6 === 0 ? "we" : ""}" data-cday="${+d}"><span>${WD[d.getDay()]}</span><b>${d.getDate()}</b>${wxDay(d)}</button>`).join("")}</div>`
  if (cols.some(c => c.allDay.length)) html += `<div class="cg-ad"><div class="cg-tc"><small>весь день</small></div>${cols.map(c => `<div>${c.allDay.map(a => { calCache.push(a); return `<button class="cg-a" style="--c:${LAYER_C[a.L] || LAYER_C.me}" data-ci="${calCache.length - 1}">${esc(a.ev.title || "(без названия)")}</button>` }).join("")}</div>`).join("")}</div>`
  html += `<div class="cg-body" style="height:${(h1 - h0) * PX}px"><div class="cg-tc">${[...Array(h1 - h0)].map((_, i) => `<div style="top:${i * PX}px"><b>${h0 + i}:00</b>${S.tzOn ? `<small>${tzHm(atHM(days[0], (h0 + i) + ":00")).replace(/^0/, "")} ${tz[2]}</small>` : ""}</div>`).join("")}</div>`
  cols.forEach((c, di) => {
    const d = days[di]
    calLanes(c.items)
    html += `<div class="cg-col ${sameDay(d, now) ? "td" : ""}" data-cd="${+d}" data-h0="${h0}">`
    c.items.forEach((it, k) => {
      const top = y(it.s), hh = Math.max(18, y(it.e) - top - 2)
      const lw = it.n ? `left:calc(${(it.ln / it.n) * 100}% + 1px);width:calc(${100 / it.n}% - 3px);` : ""
      calCache.push(it); const ci = calCache.length - 1, past = it.e <= now
      const st = `top:${top}px;height:${hh}px;${lw}--d:${(di * 4 + k) * 22}ms;`
      if (it.kind === "road") html += `<div class="cg-it road ${it.late ? "late" : ""}" style="${st}" data-ci="${ci}">${hh >= 20 ? `${tdIco("car", 11)} ${it.late ? "не успеть" : "дорога"} ${it.min} мин` : ""}</div>`
      else if (it.kind === "prot") html += `<div class="cg-it prot" style="${st}" data-ci="${ci}"><b>${esc(it.p.title)}</b>${hh >= 34 ? "<small>защищено</small>" : ""}</div>`
      else if (it.kind === "kid") html += `<div class="cg-it ev ${past ? "past" : ""}" style="${st}--c:${LAYER_C.kids}" data-ci="${ci}"><b>${esc(it.k.title)}${it.k.kid ? " · " + esc(it.k.kid) : ""}</b></div>`
      else if (it.kind === "rem") html += `<div class="cg-it task" style="${st}" data-ci="${ci}"><b>${esc(it.r.title)}</b></div>`
      else {
        const e = it.ev, rain = e.location && wxRain(e.s, e.e), call = S.tzOn && CALL_RE.test(e.title || "")
        const sub = [hh >= 46 && e.location ? esc(e.location) : "", rain ? `${tdIco("rain", 11)} дождь` : "", call ? `${tdIco("globe", 11)} у них ${tzHm(e.s)}` : "", it.prot ? "защищено" : ""].filter(Boolean)
        html += `<div class="cg-it ev ${it.prot ? "prot" : ""} ${past ? "past" : ""} ${e.pending ? "pending" : ""}" style="${st}--c:${LAYER_C[it.L] || LAYER_C.me}" data-ci="${ci}"><b>${esc(e.title || "(без названия)")}</b>${sub.length && hh >= 34 ? `<small>${sub.join(" · ")}</small>` : ""}</div>`
      }
    })
    if (sameDay(d, now) && now.getHours() >= h0 && now.getHours() < h1) html += `<div class="cg-now" style="top:${y(now)}px"></div>`
    html += `</div>`
  })
  return html + `</div></div>`
}

// — 7. Нагрузка месяца: дни подсвечены по занятым часам
function dayBusy(v, d) {
  const d0 = sod(d), d1 = addDays(d0, 1); let min = 0, n = 0
  for (const e of v.events) { if (e.all_day || e.e <= d0 || e.s >= d1 || evLayer(e) !== "me") continue; n++; min += (Math.min(+e.e, +d1) - Math.max(+e.s, +d0)) / 60e3 + ((travCached(e) || {}).min || 0) }
  return { n, h: min / 60 }
}
function loadMonth(v, m0, big) {
  const y = m0.getFullYear(), m = m0.getMonth(), last = new Date(y, m + 1, 0).getDate(), pad = (new Date(y, m, 1).getDay() + 6) % 7, t0 = sod(new Date())
  const cells = [...Array(pad)].map(() => "<i></i>"), L = []
  for (let i = 1; i <= last; i++) {
    const d = new Date(y, m, i), b = dayBusy(v, d), lv = !b.n ? 0 : b.h < 2 ? 1 : b.h < 4 ? 2 : b.h < 6 ? 3 : 4
    L.push(Object.assign({ d, lv }, b))
    cells.push(`<button class="hm l${lv} ${sameDay(d, t0) ? "td" : ""} ${d < t0 ? "old" : ""}" data-cday="${+d}" style="--d:${i * 12}ms"><b>${i}</b>${big && b.n ? `<small>${b.n} ${plural(b.n, "встр.", "встр.", "встр.")}</small>` : ""}</button>`)
  }
  let warn = ""
  const runs = []; let run = []
  for (const x of L) { if (x.d >= t0 && (x.lv >= 4 || x.n >= 5)) run.push(x); else { if (run.length) runs.push(run); run = [] } }
  if (run.length) runs.push(run)
  const r = runs.sort((a, b) => b.length - a.length || a[0].d - b[0].d)[0]
  if (r) {
    const a = r[0].d, b = r[r.length - 1].d, cnt = r.reduce((s, x) => s + x.n, 0)
    warn = `<button class="hm-warn" data-do="cal-unload" data-from="${+a}" data-to="${+b}">${tdIco("alert", 15)} ${a.getDate()}${r.length > 1 ? "–" + b.getDate() : ""} ${MONTHS_GEN[m]} ${r.length > 1 ? "перегружены" : "перегружен"}: ${cnt} ${plural(cnt, "встреча", "встречи", "встреч")}. Перенести часть?</button>`
  }
  return `<div class="card cal-load ${big ? "big" : ""}"><h2>Нагрузка ${MONTHS_GEN[m]}<span class="hm-key"><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i></span></h2>
    <div class="hm-g hm-wd">${WD7.map(w => `<span>${w}</span>`).join("")}</div><div class="hm-g">${cells.join("")}</div>${warn}</div>`
}

// — 1. Дела без времени
let calSlots = {}
function undatedCard(v, now) {
  const list = openRems(v).filter(r => !remDue(r) || (!remHasTime(r) && remDue(r) < addDays(sod(now), 3))).slice(0, 5)
  if (!list.length) return ""
  const taken = []; calSlots = {}
  const rows = list.map(r => { const sl = slotsFor(v, r, now, taken)[0]; if (sl) { taken.push(sl); calSlots[r.id] = sl } return { r, sl } })
  return `<div class="card cal-nt"><h2>Без времени<span class="muted small" style="text-transform:none;letter-spacing:0;font-weight:500">поставлю в окна</span></h2>${rows.map(({ r, sl }) => `<div class="row" data-nt="${esc(r.id)}"><div class="grow"><div class="t">${esc(r.title)}</div>
    <div class="s">${durLbl(remEst(r))} · ${sl ? `предлагаю ${dayWord(sl.s)} ${hm(sl.s)}${esc(slotWhy(sl))}` : "окон на 3 дня нет"}</div></div>${sl ? `<button class="ok-b" data-slot="${esc(r.id)}">Ок</button>` : ""}</div>`).join("")}</div>`
}
async function slotChoose(id) {
  const v = iphone(), r = v.reminders.find(x => x.id === id); if (!r) return
  const l = slotsFor(v, r, new Date(), [], 6)
  if (!l.length) return ui.info("Окон нет", "В ближайшие 4 дня свободного времени под это дело нет")
  const i = await ui.choose(r.title, "Когда поставить?", l.map(sl => `${core.cap(dayWord(sl.s))} ${hm(sl.s)}–${hm(sl.e)}${slotWhy(sl)}`))
  if (i < 0) return
  slotPut(r, l[i]); toast(`«${r.title}» — ${dayWord(l[i].s)} в ${hm(l[i].s)}`); render()
}

// — экран
let calStart = null, calAnim = ""
function calLabel(start, n) {
  if (n === 1) return core.cap(fullDate(start))
  const e = addDays(start, n - 1)
  return start.getMonth() === e.getMonth() ? `${start.getDate()}–${e.getDate()} ${MONTHS_GEN[e.getMonth()]}` : `${start.getDate()} ${MON_SHORT[start.getMonth()]} – ${e.getDate()} ${MON_SHORT[e.getMonth()]}`
}
function renderCal() {
  const S = calS(), v = iphone(), now = new Date(), t0 = sod(now)
  if (!calStart) calStart = S.view === "7" ? addDays(t0, -(wdOf(t0) - 1)) : t0
  calCache = []
  const views = [["1", "День"], ["3", "3 дня"], ["7", "Неделя"], ["m", "Месяц"]], vi = views.findIndex(x => x[0] === S.view)
  let html = `<div class="seg" style="--i:${vi}"><i></i>${views.map(([k, l]) => `<button data-cv="${k}" class="${S.view === k ? "on" : ""}">${l}</button>`).join("")}</div>`
  html += `<div class="chips pf cal-l">${["me", "olya", "kids"].map(k => `<button class="chip ly ${S.layers[k] ? "on" : ""}" data-ly="${k}" style="--c:${LAYER_C[k]}">${k === "me" ? "<i>Я</i>" : `<em></em>${esc(layerName(k))}`}</button>`).join("")}
    <button class="chip ly tz ${S.tzOn ? "on" : ""}" data-ly="tz">${tdIco("globe", 15)} ${S.tzOn ? "" : "+ "}${esc(tzInfo()[1])}</button><button class="chip ly cog" data-do="cal-set" aria-label="Слои и календари">${tdIco("layers", 16)}</button></div>`
  if (!gcalOn() && D.gcal && D.gcal.error) html += `<div class="banner"><b>Google Календарь не ответил</b>${esc(D.gcal.error)}</div>`
  if (S.view === "m") {
    const m0 = new Date(calStart.getFullYear(), calStart.getMonth(), 1)
    html += `<div class="month wnav cal-nav"><button data-cs="-1" aria-label="Назад">${tdIco("back", 16)}</button><b>${esc(core.cap(core.MONTH_NOM[m0.getMonth()]))} ${m0.getFullYear()}</b><button data-cs="1" aria-label="Вперёд">${tdIco("chev", 16)}</button><button class="today-btn" data-do="cal-today" ${m0.getMonth() === now.getMonth() && m0.getFullYear() === now.getFullYear() ? "hidden" : ""}>Сегодня</button></div>`
    html += `<div class="cal-anim ${calAnim}">${loadMonth(v, m0, true)}</div>`
  } else {
    const n = +S.view
    html += `<div class="month wnav cal-nav"><button data-cs="-1" aria-label="Назад">${tdIco("back", 16)}</button><b>${esc(calLabel(calStart, n))}</b><button data-cs="1" aria-label="Вперёд">${tdIco("chev", 16)}</button><button class="today-btn" data-do="cal-today" ${calStart <= t0 && addDays(calStart, n) > t0 ? "hidden" : ""}>Сегодня</button></div>`
    html += `<div class="card cal-card cal-anim ${calAnim}">${calGrid(v, calStart, n, now)}</div>`
  }
  calAnim = ""
  html += undatedCard(v, now)
  if (S.view !== "m") html += loadMonth(v, calStart, false)
  html += `<div class="card cal-acts">
    <button class="row" data-do="cal-free"><span class="ic" style="background:#0A84FF">${tdIco("share", 18)}</span><div class="grow"><div class="t">Когда я свободен</div><div class="s">Окна текстом — клиенту или другу в мессенджер</div></div>${tdIco("chev", 15)}</button>
    <button class="row" data-do="cal-tpls"><span class="ic" style="background:#5E5CE6">${tdIco("tpl", 18)}</span><div class="grow"><div class="t">Шаблоны событий</div><div class="s">${etpls().length ? esc(etpls().slice(0, 3).map(t => t.title).join(", ")) : "Длительность, адрес, напоминание и «взять с собой»"}</div></div>${tdIco("chev", 15)}</button>
    <button class="row" data-do="cal-prot"><span class="ic" style="background:#FF9F0A">${tdIco("shield", 18)}</span><div class="grow"><div class="t">Защищённое время</div><div class="s">${pblks().length ? esc(pblks().slice(0, 3).map(p => p.title).join(", ")) : "Спорт, дети, вечер с женой — помощник его не займёт"}</div></div>${tdIco("chev", 15)}</button></div>`
  return html
}
function calShift(k) {
  const S = calS()
  if (S.view === "m") calStart = new Date(calStart.getFullYear(), calStart.getMonth() + k, 1)
  else calStart = addDays(calStart, k * +S.view)
  calAnim = k > 0 ? "in-r" : "in-l"; render()
}
function calSetView(k) {
  const S = calS(), t0 = sod(new Date()), keep = calStart && (S.view === "m" ? null : calStart)
  S.view = k; save(false)
  const base = keep && Math.abs(keep - t0) < 40 * 864e5 ? keep : t0
  calStart = k === "7" ? addDays(sod(base), -(wdOf(base) - 1)) : k === "m" ? new Date(base.getFullYear(), base.getMonth(), 1) : sod(base > t0 || k !== "1" ? base : t0)
  calAnim = "in-f"; render()
}
function bindCal(v) {
  const S = calS()
  $$("[data-cv]", v).forEach(b => b.onclick = () => calSetView(b.dataset.cv))
  $$("[data-cs]", v).forEach(b => b.onclick = () => calShift(+b.dataset.cs))
  $$("[data-ly]", v).forEach(b => b.onclick = () => { const k = b.dataset.ly; if (k === "tz") S.tzOn = S.tzOn ? 0 : 1; else S.layers[k] = S.layers[k] ? 0 : 1; save(false); if (navigator.vibrate) navigator.vibrate(8); render() })
  $$("[data-cday]", v).forEach(b => b.onclick = () => { S.view = "1"; calStart = sod(new Date(+b.dataset.cday)); calAnim = "in-f"; save(false); render() })
  $$("[data-ci]", v).forEach(el => el.onclick = ev => { ev.stopPropagation(); calTap(calCache[+el.dataset.ci]) })
  $$("[data-slot]", v).forEach(b => b.onclick = ev => { ev.stopPropagation(); const r = iphone().reminders.find(x => x.id === b.dataset.slot), sl = calSlots[b.dataset.slot]; if (!r || !sl) return
    slotPut(r, sl); b.classList.add("on"); if (navigator.vibrate) navigator.vibrate(10); toast(`«${r.title}» — ${dayWord(sl.s)} в ${hm(sl.s)}`); setTimeout(render, 300) })
  $$("[data-nt]", v).forEach(el => el.onclick = () => slotChoose(el.dataset.nt))
  $$('[data-do="cal-unload"]', v).forEach(b => b.onclick = () => { const a = new Date(+b.dataset.from), z = new Date(+b.dataset.to)
    setTab("chat"); setTimeout(() => chatSend(`С ${shortDate(a)} по ${shortDate(z)} у меня перегруз в календаре. Посмотри эти дни и предложи, какие встречи перенести и куда, чтобы не трогать защищённое время. Ничего не переноси без моего «да».`), 50) })
  $$(".cg-col", v).forEach(c => c.onclick = ev => {
    if (ev.target !== c) return
    const px = parseFloat(getComputedStyle(c.closest(".cg")).getPropertyValue("--px")) || 54
    const h = +c.dataset.h0 + ev.offsetY / px, d = new Date(+c.dataset.cd); d.setHours(Math.floor(h), Math.round((h % 1) * 2) * 30 % 60, 0, 0)
    if (Math.round((h % 1) * 2) === 2) d.setHours(Math.floor(h) + 1, 0)
    calQuick({ start: d })
  })
  const body = $(".cal-anim", v)
  if (body) { let x0 = null, y0 = 0
    body.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY }, { passive: true })
    body.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) calShift(dx < 0 ? 1 : -1) }, { passive: true }) }
}
async function calTap(it) {
  if (!it) return
  if (it.kind === "ev") return eventSheet(it.ev)
  if (it.kind === "prot") return protForm(it.p)
  if (it.kind === "kid") return kidsForm()
  if (it.kind === "road") return ui.info(`Дорога ${it.min} мин`, `До «${it.ev.title}»${it.ev.location ? " (" + it.ev.location + ")" : ""}: выехать в ${hm(it.s)}.${it.late ? "\nПредыдущая встреча кончается позже — не успеваете. Сдвиньте одну из встреч." : ""}`)
  if (it.kind === "rem") {
    const i = await ui.choose(it.r.title, `${core.cap(dayWord(it.s))} в ${hm(it.s)}`, ["Выполнено", "Другое время", "Убрать время"])
    if (i === 0) { remSet(it.r.id, { completed: true }); toast("Выполнено") }
    if (i === 1) return slotChoose(it.r.id)
    if (i === 2) { const x = D.rems.find(z => z.id === it.r.id); if (x) upsert("rems", Object.assign({}, x, { due: dayKey(it.s), anchor: null })) }
    render()
  }
}

// — 2 и 6. Ввод фразой с предпросмотром + шаблоны событий
const etpls = () => live(D.goals).filter(g => g.kind === "etpl" && g.title).sort((a, b) => a.date - b.date)
function calParse(text, base) {
  let t = " " + core.normalizeSpeech(String(text || "")) + " ", remind = null, dur = null
  const unit = u => /^ч/i.test(u) ? 60 : 1
  t = t.replace(/[,\s]*напомни(?:ть)?\s+за\s+(полчаса|час|сутки|день|(\d+)\s*(минут\w*|мин|час\w*|ч)(?=[\s,.]|$))/i, (_, w, n, u) => { remind = /полчаса/i.test(w) ? 30 : /^час/i.test(w) ? 60 : /сутки|день/i.test(w) ? 1440 : +n * unit(u); return " " })
  t = t.replace(/\s+на\s+(полтора\s+час\w*|полчаса|час|(\d+(?:[.,]\d+)?)\s*(час\w*|ч|минут\w*|мин)(?=[\s,.]|$))/i, (_, w, n, u) => { dur = /полтора/i.test(w) ? 90 : /полчаса/i.test(w) ? 30 : /^час/i.test(w) ? 60 : Math.round(parseFloat(n.replace(",", ".")) * unit(u)); return " " })
  const a = core.buildActions([{ text: t.trim(), kind: "event" }])[0] || {}
  let title = String(a.title || "").replace(/[\s,.]+$/, "").trim(), location = ""
  const lm = title.match(/^(.+?)\s+(?:на|в|во)\s+((?:[A-ZА-ЯЁ0-9][^,]*))$/)
  if (lm) { title = lm[1]; location = lm[2].trim() }
  const tpl = title && etpls().find(p => normT(title).startsWith(normT(p.title)) || normT(p.title).startsWith(normT(title)) && normT(title).length >= 4)
  if (tpl) { if (normT(title) !== normT(tpl.title) && normT(tpl.title).startsWith(normT(title))) title = tpl.title; location = location || tpl.location || ""; if (remind == null && tpl.remind) remind = +tpl.remind }
  const explicit = dur != null || /\sдо\s+\d/.test(t)
  const minutes = dur || (explicit ? a.minutes : tpl && +tpl.min || a.minutes || core.CONFIG.defaultEventMinutes || 60)
  let start = a.date && a.hasTime ? new Date(a.date) : null
  if (!start && base) { start = new Date(base); if (a.date && !sameDay(a.date, base)) { const x = new Date(a.date); x.setHours(base.getHours(), base.getMinutes(), 0, 0); start = x } }
  if (!title) return null
  return { title: core.cap(title), start, end: start ? new Date(+start + minutes * 60e3) : null, minutes, location, remind, bring: tpl ? tpl.bring || "" : "", tpl, recur: a.recur || null }
}
const remindLbl = m => m >= 1440 ? "за день" : m >= 60 ? `за ${m % 60 ? durLbl(m) : m / 60 === 1 ? "час" : m / 60 + " ч"}` : `за ${m} мин`
const qTrav = {}
function calQuick(pref = {}) {
  let x = null, edit = false, force = false, timer = 0
  const s = sheet(`<h3>Новое событие</h3><div class="cq-box"><textarea id="cq" rows="2" placeholder="Например: завтра в 15 стоматолог на Сукхумвите, напомни за час">${esc(pref.text || "")}</textarea>${pref.start ? `<div class="muted small">${esc(core.cap(fullDate(pref.start)))}, ${hm(pref.start)} — если время не скажете</div>` : ""}</div>
    <div id="cq-pv"></div><div id="cq-tp"></div>`)
  const inp = $("#cq", s.el), pv = $("#cq-pv", s.el)
  const tpList = () => { const l = etpls(); $("#cq-tp", s.el).innerHTML = l.length ? `<div class="cq-tpl"><div class="k">${tdIco("tpl", 14)} Шаблоны</div>${l.map(t => `<button class="chip" data-tp="${esc(t.id)}">${esc(t.title)}</button>`).join("")}</div>` : ""
    $$("[data-tp]", s.el).forEach(b => b.onclick = () => { const t = D.goals.find(z => z.id === b.dataset.tp); inp.value = t.title + " "; inp.focus(); upd() }) }
  const draw = () => {
    if (!x) { pv.innerHTML = `<div class="cq-hint">${tdIco("wand", 16)} Пишите как удобно — событие появится здесь до сохранения</div>`; return }
    const hit = x.start && !force ? protHit(x.start, x.end) : null
    const tr = x.location && qTrav[x.location], leave = tr && tr.min && x.start ? new Date(+x.start - (tr.min + 10) * 60e3) : null
    const rain = x.start && wxRain(x.start, x.end), rem = x.remind && x.start ? new Date(+x.start - x.remind * 60e3) : null
    pv.innerHTML = edit ? `<div class="cq-form">
        <div class="field"><label>Название</label><input id="cf-t" value="${esc(x.title)}"></div>
        <div class="field"><label>Начало</label><input id="cf-s" type="datetime-local" value="${x.start ? iso(x.start) : ""}"></div>
        <div class="grid2"><div class="field"><label>Минут</label><input id="cf-m" type="number" inputmode="numeric" value="${x.minutes}"></div>
        <div class="field"><label>Напомнить за, мин</label><input id="cf-r" type="number" inputmode="numeric" value="${x.remind || ""}" placeholder="нет"></div></div>
        <div class="field"><label>Место</label><input id="cf-l" value="${esc(x.location)}" placeholder="адрес или название"></div>
        <div class="field"><label>Взять с собой</label><input id="cf-b" value="${esc(x.bring)}" placeholder="необязательно"></div></div>`
      : `<div class="cq-card"><b>${esc(x.title)}</b>
        <div>${tdIco("clock", 14)} ${x.start ? `${esc(core.cap(fullDate(x.start)))} · ${hm(x.start)}–${hm(x.end)}` : '<span class="exp">когда? допишите время</span>'}</div>
        ${x.location ? `<div>${tdIco("pin", 14)} ${esc(x.location)}${leave ? ` · ${tdIco("car", 14)} выехать в ${hm(leave)}` : ""}</div>` : ""}
        ${rem || rain ? `<div>${rem ? `${tdIco("bell", 14)} напомнить в ${hm(rem)}` : ""}${rem && rain ? " · " : ""}${rain ? `<span class="rn">${tdIco("rain", 14)} в ${hm(new Date(rain.t))} ${rain.mm >= 4 ? "ливень" : "дождь"} — зонт</span>` : ""}</div>` : ""}
        ${x.bring ? `<div>${tdIco("brief", 14)} взять: ${esc(x.bring)}</div>` : ""}${x.tpl ? `<div class="muted small">по шаблону «${esc(x.tpl.title)}»</div>` : ""}</div>`
    pv.innerHTML += (hit ? `<div class="warn-card prot-w">${tdIco("hand", 22)}<div><b>Это время защищено</b>«${esc(hit.p.title)}» ${WD[hit.s.getDay()]} ${hm(hit.s)}–${hm(hit.e)}. Поставить всё равно или найти другое время?
        <div class="chips"><button class="chip on" data-a="other">Другое время</button><button class="chip" data-a="force">Всё равно</button></div></div></div>` : "")
      + `<div class="btns"><button class="btn primary" data-a="ok" ${x.start ? "" : "disabled"}>Сохранить</button><button class="btn" data-a="edit">${edit ? "Готово" : "Изменить"}</button></div>
        ${x.tpl ? "" : `<button class="chip cq-mk" data-a="mk">${tdIco("tpl", 15)} Сделать шаблоном</button>`}`
    const A = k => $(`[data-a="${k}"]`, pv)
    if (A("other")) A("other").onclick = () => { const sl = calFindSlot(x.start, x.minutes); if (!sl) return toast("Свободного окна на неделю нет"); x.start = sl; x.end = new Date(+sl + x.minutes * 60e3); toast(`Предлагаю ${dayWord(sl)} ${hm(sl)}`); draw() }
    if (A("force")) A("force").onclick = () => { force = true; draw() }
    A("edit").onclick = () => { if (edit) readForm(); edit = !edit; draw() }
    A("ok").onclick = async () => { if (edit) readForm(); if (!x.start) return; if (!force && protHit(x.start, x.end)) { draw(); return toast("Время защищено — выберите") }
      A("ok").disabled = true; A("ok").textContent = "Сохраняю…"; const ok = await calSave(x); if (ok) s.close(); else { A("ok").disabled = false; A("ok").textContent = "Сохранить" } }
    if (A("mk")) A("mk").onclick = () => { if (edit) readForm(); etplForm(null, x) }
  }
  const readForm = () => { const g = id => $(id, pv) && $(id, pv).value
    const st = parseIso(g("#cf-s")); x.title = (g("#cf-t") || x.title).trim(); x.minutes = Math.max(5, Math.round(+g("#cf-m") || x.minutes))
    if (st) x.start = st; x.end = x.start ? new Date(+x.start + x.minutes * 60e3) : null; x.remind = Math.round(+g("#cf-r")) || null; x.location = (g("#cf-l") || "").trim(); x.bring = (g("#cf-b") || "").trim() }
  const upd = () => { x = calParse(inp.value, pref.start); force = false; edit = false; draw()
    if (x && x.location && !qTrav[x.location] && D.conn) { const loc = x.location; qTrav[loc] = { min: 0 }; runTool("route_to", { to: loc }).then(r => { qTrav[loc] = r && !r.error ? { min: Math.round(r.minutes_in_traffic || r.minutes || 0) } : { min: 0 }; if (x && x.location === loc) draw() }).catch(() => {}) } }
  inp.oninput = () => { clearTimeout(timer); timer = setTimeout(upd, 220) }
  tpList(); upd()
  setTimeout(() => inp.focus(), 250)
  return s
}
// ближайшее свободное время той же длины (сначала в тот же день, потом дальше)
function calFindSlot(from, minutes) {
  const v = iphone()
  for (let i = 0; i < 7; i++) { const d = addDays(sod(from), i)
    const g = freeGaps(v, d, DAY_FROM, DAY_TO, minutes, i === 0 ? new Date(Math.max(+from, Date.now())) : (sameDay(d, new Date()) ? new Date() : null))[0]
    if (g) return g.prev && g.prev.ev ? new Date(Math.min(+g.e - minutes * 60e3, Math.ceil((+g.s + 15 * 60e3) / 9e5) * 9e5)) : g.s }
  return null
}
async function calSave(x) {
  const ev = { title: x.title, start: iso(x.start), end: iso(x.end) }
  if (x.location) ev.location = x.location
  if (x.bring) ev.notes = "Взять с собой: " + x.bring
  if (gcalOn()) { const r = await calDo("create", ev); if (r.error) { ui.info("Не получилось", r.error); return false } }
  else queueOp("create_event", ev)
  if (x.remind) remAdd({ title: `${x.title} в ${hm(x.start)}${x.bring ? " · взять: " + x.bring : ""}`, due: iso(new Date(+x.start - x.remind * 60e3)) })
  toast(`${x.title} — ${dayWord(x.start)} в ${hm(x.start)}`); render()
  return true
}
function etplForm(t, from) {
  const b = t || { title: from ? from.title : "", min: from ? from.minutes : 60, location: from ? from.location : "", remind: from ? from.remind || "" : 60, bring: from ? from.bring : "" }
  const s = sheet(`<h3>${t ? esc(t.title) : "Новый шаблон события"}</h3><div class="msg">Напишите «${esc(b.title || "Стоматолог")} завтра в 15» — длительность, место и напоминание подставятся сами.</div>
    <div class="field"><label>Название</label><input id="et-t" value="${esc(b.title)}" placeholder="Показ объекта"></div>
    <div class="grid2"><div class="field"><label>Длительность, мин</label><input id="et-m" type="number" inputmode="numeric" value="${esc(b.min || 60)}"></div>
    <div class="field"><label>Напомнить за, мин</label><input id="et-r" type="number" inputmode="numeric" value="${esc(b.remind || "")}" placeholder="нет"></div></div>
    <div class="field"><label>Место</label><input id="et-l" value="${esc(b.location || "")}" placeholder="адрес — или пусто, если каждый раз разное"></div>
    <div class="field"><label>Взять с собой</label><input id="et-b" value="${esc(b.bring || "")}" placeholder="ключи, буклет, договор"></div>
    <div class="btns">${t ? '<button class="btn red" data-a="del">Удалить</button>' : '<button class="btn" data-a="no">Отмена</button>'}<button class="btn primary" data-a="ok">Сохранить</button></div>`)
  const no = $('[data-a="no"]', s.el); if (no) no.onclick = () => s.close()
  const del = $('[data-a="del"]', s.el); if (del) del.onclick = () => { remove("goals", t.id); s.close(); render() }
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#et-t", s.el).value.trim(); if (!title) return toast("Назовите шаблон")
    upsert("goals", Object.assign(t || { id: uid("e"), date: Date.now(), kind: "etpl" }, { title, min: Math.max(5, Math.round(+$("#et-m", s.el).value || 60)), remind: Math.round(+$("#et-r", s.el).value) || 0,
      location: $("#et-l", s.el).value.trim(), bring: $("#et-b", s.el).value.trim() }))
    s.close(); render(); toast(`Шаблон «${title}» сохранён`)
  }
}
function etplList() {
  const tline = t => [durLbl(+t.min || 60), t.location, t.bring && `«${t.bring}»`, t.remind && "напомнить " + remindLbl(+t.remind)].filter(Boolean).map(esc).join(" · ")
  const s = sheet(`<h3>Шаблоны событий</h3><div class="msg">Нажмите шаблон — откроется новое событие с ним. Значок справа — изменить.</div>
    <div>${etpls().map(t => `<div class="row" data-u="${esc(t.id)}"><div class="grow"><div class="t">${esc(t.title)}</div><div class="s">${tline(t)}</div></div><button class="ibtn" data-e="${esc(t.id)}" aria-label="Изменить">${tdIco("tpl", 18)}</button></div>`).join("") || '<div class="empty">Пока пусто. «Показ объекта», «Стоматолог», «Тренировка» — заполните один раз.</div>'}</div>
    <div class="btns"><button class="btn primary" data-a="new">+ Новый шаблон</button></div>`)
  $$("[data-u]", s.el).forEach(r => r.onclick = () => { const t = D.goals.find(z => z.id === r.dataset.u); s.close(); calQuick({ text: t.title + " " }) })
  $$("[data-e]", s.el).forEach(b => b.onclick = ev => { ev.stopPropagation(); s.close(); etplForm(D.goals.find(z => z.id === b.dataset.e)) })
  $('[data-a="new"]', s.el).onclick = () => { s.close(); etplForm() }
}

// — 5. Защищённое время: список и форма
const daysLbl = ds => { const l = (ds || []).map(Number).sort(); return l.length === 7 ? "каждый день" : l.join() === "1,2,3,4,5" ? "по будням" : l.join() === "6,7" ? "по выходным" : l.map(d => WD7[d - 1].toLowerCase()).join(", ") }
function protList() {
  const sug = [["Ужин с семьёй", [1, 2, 3, 4, 5, 6, 7], "19:00", "21:00"], ["Время с детьми", [6, 7], "10:00", "13:00"], ["Спорт", [1, 3, 5], "07:00", "08:00"], ["Вечер с женой", [5], "19:00", "22:00"]].filter(x => !pblks().some(p => normT(p.title) === normT(x[0])))
  const s = sheet(`<h3>Защищённое время</h3><div class="msg">В эти часы помощник не ставит дела и предупредит, если туда попадёт встреча.</div>
    <div>${pblks().map(p => `<div class="row" data-p="${esc(p.id)}"><span class="ic sm" style="background:#FF9F0A">${tdIco("shield", 15)}</span><div class="grow"><div class="t">${esc(p.title)}</div><div class="s">${esc(daysLbl(p.days))} · ${esc(p.from)}–${esc(p.to)}</div></div>${tdIco("chev", 15)}</div>`).join("") || '<div class="empty">Пока ничего не защищено</div>'}</div>
    ${sug.length ? `<div class="field"><label>Быстро добавить</label><div class="chips">${sug.map((x, i) => `<button class="chip" data-sg="${i}">+ ${esc(x[0])}</button>`).join("")}</div></div>` : ""}
    <div class="btns"><button class="btn primary" data-a="new">+ Своё время</button></div>`)
  $$("[data-p]", s.el).forEach(r => r.onclick = () => { s.close(); protForm(D.goals.find(z => z.id === r.dataset.p)) })
  $$("[data-sg]", s.el).forEach(b => b.onclick = () => { const x = sug[+b.dataset.sg]; s.close(); protForm(null, { title: x[0], days: x[1], from: x[2], to: x[3] }) })
  $('[data-a="new"]', s.el).onclick = () => { s.close(); protForm() }
}
function protForm(p, pre) {
  const b = p || pre || { title: "", days: [1, 2, 3, 4, 5], from: "19:00", to: "21:00" }
  let days = (b.days || []).map(Number)
  const s = sheet(`<h3>${p ? esc(p.title) : "Защитить время"}</h3>
    <div class="field"><label>Что это</label><input id="pb-t" value="${esc(b.title)}" placeholder="Падел, ужин с семьёй, свидание"></div>
    <div class="field"><label>Дни</label><div class="chips" id="pb-d">${WD7.map((w, i) => `<button class="chip ${days.includes(i + 1) ? "on" : ""}" data-d="${i + 1}">${w}</button>`).join("")}</div></div>
    <div class="grid2"><div class="field"><label>С</label><input id="pb-f" type="time" value="${esc(b.from)}"></div><div class="field"><label>До</label><input id="pb-o" type="time" value="${esc(b.to)}"></div></div>
    <div class="btns">${p ? '<button class="btn red" data-a="del">Убрать</button>' : '<button class="btn" data-a="no">Отмена</button>'}<button class="btn primary" data-a="ok">Сохранить</button></div>`)
  $$("#pb-d .chip", s.el).forEach(c => c.onclick = () => { const d = +c.dataset.d; days = days.includes(d) ? days.filter(x => x !== d) : days.concat(d); c.classList.toggle("on", days.includes(d)) })
  const no = $('[data-a="no"]', s.el); if (no) no.onclick = () => s.close()
  const del = $('[data-a="del"]', s.el); if (del) del.onclick = () => { remove("goals", p.id); s.close(); render() }
  $('[data-a="ok"]', s.el).onclick = () => {
    const title = $("#pb-t", s.el).value.trim(), from = $("#pb-f", s.el).value, to = $("#pb-o", s.el).value
    if (!title) return toast("Назовите время"); if (!days.length) return toast("Выберите дни"); if (!(to > from)) return toast("Конец позже начала")
    upsert("goals", Object.assign(p || { id: uid("p"), date: Date.now(), kind: "pblk" }, { title, days: days.sort(), from, to })); s.close(); render(); toast(`«${title}» защищено`)
  }
}

// — 8. «Когда я свободен»: окна текстом для мессенджера
function freeText(days = 3, who = "client", eve = false) {
  const v = iphone(), now = new Date(), to = eve ? 22 : 19, lines = []
  for (let i = 0; lines.length < days && i < 14; i++) {
    const d = addDays(sod(now), i)
    const gs = freeGaps(v, d, 9, to, 60, i === 0 ? new Date(+now + 3600e3) : null)
    if (!gs.length) continue
    lines.push(`• ${WD[d.getDay()]} ${d.getDate()} ${MONTHS_GEN[d.getMonth()]} — ${gs.map(g => +g.e === +atHM(d, to + ":00") && g.s.getHours() >= 12 && gs.length === 1 ? `после ${hm(g.s)}` : `${hm(g.s)}–${hm(g.e)}`).join(", ")}`)
  }
  if (!lines.length) return "На ближайшие две недели свободных окон нет."
  return who === "client" ? `Здравствуйте! Могу показать объект:\n${lines.join("\n")}\nКакое время удобно?` : `Привет! Я свободен:\n${lines.join("\n")}\nКогда тебе удобно?`
}
function freeSheet() {
  let days = 3, who = "client", eve = false
  const s = sheet(`<h3>Когда я свободен</h3><div class="msg">Отправлю текстом — без ссылок и регистраций. Защищённое время и дорога учтены.</div>
    <div class="chips" id="fs-w"><button class="chip on" data-w="client">Клиенту</button><button class="chip" data-w="friend">Другу</button><span class="sp"></span><button class="chip on" data-n="3">3 дня</button><button class="chip" data-n="5">5</button><button class="chip" data-n="7">7</button><button class="chip" data-e="1">вечер тоже</button></div>
    <div class="field"><textarea id="fs-t" rows="6"></textarea></div>
    <div class="share-row"><button class="sh wa" data-s="wa">WhatsApp</button><button class="sh tg" data-s="tg">Telegram</button><button class="sh ln" data-s="line">LINE</button><button class="sh cp" data-s="copy">${tdIco("copy", 16)}</button></div>`)
  const ta = $("#fs-t", s.el), fill = () => { ta.value = freeText(days, who, eve) }
  $$("#fs-w [data-w]", s.el).forEach(b => b.onclick = () => { who = b.dataset.w; $$("#fs-w [data-w]", s.el).forEach(x => x.classList.toggle("on", x === b)); fill() })
  $$("#fs-w [data-n]", s.el).forEach(b => b.onclick = () => { days = +b.dataset.n; $$("#fs-w [data-n]", s.el).forEach(x => x.classList.toggle("on", x === b)); fill() })
  $("#fs-w [data-e]", s.el).onclick = e => { eve = !eve; e.currentTarget.classList.toggle("on", eve); fill() }
  $$("[data-s]", s.el).forEach(b => b.onclick = async () => {
    const t = ta.value, u = encodeURIComponent(t), k = b.dataset.s
    if (k === "copy") { try { await navigator.clipboard.writeText(t); toast("Скопировано") } catch (e) { ta.select(); toast("Выделено — скопируйте") } return }
    window.open(k === "wa" ? `https://wa.me/?text=${u}` : k === "tg" ? `https://t.me/share/url?url=%20&text=${u}` : `https://line.me/R/share?text=${u}`, "_blank")
  })
  fill()
}

// — 4 и 10. Слои семьи, календари и второй часовой пояс
function calSettings() {
  const S = calS(), names = [...new Set(((D.gcal && D.gcal.calendars) || []).map(c => c.name || c).concat(iphone().events.map(e => e.calendar).filter(Boolean)))]
  const opts = [["me", "Я"], ["olya", layerName("olya")], ["kids", "Дети"], ["off", "Скрыть"]]
  const s = sheet(`<h3>Слои календаря</h3><div class="msg">Каждый календарь Google — в свой слой. Чужой календарь появится здесь, когда владелец откроет вам доступ к нему в Google Календаре (Настройки → Открыть доступ).</div>
    ${names.map((n, i) => `<div class="field"><label>${esc(n)}</label><div class="chips" data-cal="${i}">${opts.map(([k, l]) => `<button class="chip ${evLayer({ calendar: n }) === k ? "on" : ""}" data-k="${k}">${esc(l)}</button>`).join("")}</div></div>`).join("") || '<div class="empty">Календари ещё не загружены</div>'}
    <div class="field"><label>Как зовут второй слой</label><input id="cs-o" value="${esc(layerName("olya"))}"></div>
    <div class="field"><label>Второй часовой пояс</label><div class="chips" id="cs-tz">${TZS.map(t => `<button class="chip ${S.tz === t[0] ? "on" : ""}" data-tz="${t[0]}">${t[1]}</button>`).join("")}</div></div>
    <div class="btns"><button class="btn primary" data-a="ok">Готово</button></div>`, { onClose: () => render() })
  $$("[data-cal]", s.el).forEach(g => $$(".chip", g).forEach(c => c.onclick = () => { S.map[names[+g.dataset.cal]] = c.dataset.k; $$(".chip", g).forEach(x => x.classList.toggle("on", x === c)); save(false) }))
  $$("#cs-tz .chip", s.el).forEach(c => c.onclick = () => { S.tz = c.dataset.tz; S.tzOn = 1; $$("#cs-tz .chip", s.el).forEach(x => x.classList.toggle("on", x === c)); save(false) })
  $("#cs-o", s.el).onchange = e => { S.names.olya = e.target.value.trim(); save(false) }
  $('[data-a="ok"]', s.el).onclick = () => { const v = $("#cs-o", s.el).value.trim(); S.names.olya = v; save(false); s.close() }
}
Object.assign(DO, {
  event: () => calQuick(), "cal-open": () => { calStart = null; setTab("cal") }, "cal-today": () => { calStart = null; calAnim = "in-f"; render() },
  "cal-set": () => calSettings(), "cal-free": () => freeSheet(), "cal-tpls": () => etplList(), "cal-prot": () => protList(),
})

// ═════════════ Изи: характер, голос и живой разговор ═════════════
// Настройки помощника (только на телефоне, в D.izi): имя, пол, характер, голос, скорость речи,
// советы по целям, психология, самообучение. Голос — системный голос iPhone под пол помощника.
function IZX() { return Object.assign({ mode: "friend", rate: 1, goals: true, psy: true, learn: true, first: true, voice: "" }, D.izi || {}, { g: IZI().g }) }
function iziSet(k, val) { D.izi = Object.assign({}, D.izi, { [k]: val }); save(false) }
var IZI_MODES = { friend: ["Друг", "тепло, с юмором, поддерживает"], coach: ["Строгий тренер", "прямо, без поблажек, держит планку"], brief: ["Кратко и по делу", "минимум слов, только суть"] }
var IZI_RATES = [[.9, "Спокойно"], [1, "Обычно"], [1.12, "Быстрее"]]

// Добавка к системному промпту чата: характер, цели, психология, самообучение и правила живого разговора
function iziStyle() {
  const z = IZX(), out = []
  out.push({ friend: "Характер: друг — тепло, с лёгким юмором, поддерживаешь, но говоришь правду, даже неудобную.",
    coach: "Характер: строгий тренер — прямо, без поблажек и сюсюканья, держишь планку, требуешь конкретики и сроков, хвалишь только за дело. Не грубишь и не унижаешь.",
    brief: "Характер: кратко и по делу — минимум слов, только суть, без вступлений, оценок и эмоций." }[z.mode] || "")
  if (z.goals) out.push(`Цели: ты коуч по целям (подсказки включены пользователем). Когда речь о целях, мечтах, планах, деньгах на цель или застрявшем деле — подскажи, как поставить и достичь: цель конкретная и измеримая, со сроком (SMART); большой цели — веха на месяц и шаг на эту неделю; первый шаг — меньше 15 минут и в календарь; план «если — то» («если вечером устал, то хотя бы 10 минут»); заранее назвать главное препятствие и что делать с ним (WOOP); финансовая цель — сумма, срок и сколько откладывать в месяц (копилка add_jar). Застряло 2 недели — уменьшить шаг, а не ругать себя. Отмечай маленькие победы. Не больше одного совета за ответ и не в каждом сообщении — только к месту.`)
  if (z.psy) out.push(`Психология: опирайся на доказательные подходы (КПТ, мотивационное интервью, теория самодетерминации, привязанность, эмоциональный интеллект). Когда человеку тяжело — сначала услышь и назови чувство, потом спроси, чего он хочет: совета или просто выговориться. Мягко замечай искажения мышления («всё или ничего», катастрофизация, чтение мыслей) и предлагай взгляд шире. В отношениях с женой, детьми, родителями и людьми помогай понять другую сторону и подобрать слова; про токсичных людей — честно про границы. Ты не врач и не ставишь диагнозов. Если звучат мысли о самоповреждении или о том, что жить не хочется, — отнесись серьёзно, будь рядом и мягко предложи сразу связаться с близким человеком и специалистом или экстренной помощью (в Таиланде 1669, психологическая линия 1323).`)
  out.push(`Люди и сообщения: помочь написать кому-то (жене, родителям, другу, клиенту) — draft_message, в нужном тоне и с учётом того, что знаешь о человеке; в ответе черновик не повторяй. После встречи пользователь рассказывает, что договорились — сам создай дела и напоминания со сроками и запомни договорённости о человеке через remember.`)
  out.push(`«Напомни, когда придёт зарплата / буду с Олей / приду в офис» — remind_when (по доходу, человеку или событию календаря); «когда буду рядом с местом» — remind_near. Фото договора — стороны, суммы и сроки, предложи напоминания; меню или этикетка — ккал и БЖУ; дневник или задание ребёнка — что и к какому сроку.`)
  out.push(z.learn ? "Самообучение включено: замечай, что работает с этим человеком (какие советы он принимает, что раздражает, как ему удобнее), и сохраняй выводы через remember как предпочтения." : "Самообучение выключено: сам выводы и предпочтения не запоминай — только факты, которые просят запомнить.")
  if (TALK) out.push(`Сейчас живой голосовой разговор: твой ответ сразу читается вслух голосом ${z.g === "f" ? "девушки" : "мужчины"}. Отвечай как в разговоре: 1–3 коротких предложения, без списков, Markdown, ссылок, эмодзи и сокращений («мин», «ч», «руб»); суммы и время — словами, как их говорят. Длинное (список, письмо, план) — коротко скажи суть и что подробности в чате. Варианты выбора называй голосом. Тебя могут перебить — это нормально.`)
  return "\n" + out.filter(Boolean).map(s => "- " + s).join("\n")
}

// ── Голос: системные русские голоса iPhone ──
var FEM_V = /milena|милена|katya|катя|alena|ал[её]на|irina|ирина|anna\b|анна|svetlana|светлана|elena|елена|daria|дарья|marina|марина|google русский/i
var MAL_V = /yuri|юрий|maxim|максим|pavel|павел|dmitr|дмитр|ivan|иван|artem|арт[её]м|aleksandr|александр/i
function ttsVoices() { try { return window.speechSynthesis ? speechSynthesis.getVoices().filter(v => /^ru/i.test(v.lang)) : [] } catch (e) { return [] } }
function voiceSex(v) { return FEM_V.test(v.name) ? "f" : MAL_V.test(v.name) ? "m" : "" }
function voiceQ(v) { return (/premium|enhanced|улучш|siri/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0) }
function voiceLabel(v) { return v ? v.name.replace(/\s*\((enhanced|premium|улучшенн\S*|русский.*)\)/ig, (m, a) => /enh|prem|улучш/i.test(a) ? " · улучшенный" : "").trim() : "Нет русского голоса" }
function iziVoice() {
  const vs = ttsVoices(), z = IZX()
  const set = vs.find(x => x.voiceURI === z.voice); if (set) return set
  const by = l => l.slice().sort((a, b) => voiceQ(b) - voiceQ(a))[0]
  return by(vs.filter(x => voiceSex(x) === z.g)) || by(vs.filter(x => !voiceSex(x))) || by(vs) || null
}
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { if (tab === "more") render() }
// Текст для чтения вслух: без ссылок, разметки и смайликов, валюта и единицы — словами
function sayable(t) {
  return String(t || "").replace(/https?:\/\/\S+/g, "ссылка в чате").replace(/[*_#`>|~]+/g, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu, "").replace(/^\s*[-•·]\s*/gm, "")
    .replace(/(\d)\s*฿/g, "$1 бат").replace(/฿\s*(\d[\d\s]*)/g, "$1 бат").replace(/(\d)\s*₽/g, "$1 рублей").replace(/\$\s*(\d[\d\s]*)/g, "$1 долларов")
    .replace(/(\d)\s*ккал/g, "$1 килокалорий").replace(/(\d)\s*км\b/g, "$1 километров").replace(/(\d)\s*мин\b\.?/g, "$1 минут")
    .replace(/[ \t]+/g, " ").trim()
}
// Разбить на предложения: iPhone обрывает длинные фразы, а подпись на экране меняется по предложению
function sentences(t) { return (sayable(t).match(/[^.!?…\n]+[.!?…]*["»)]?\s*|\n+/g) || []).map(s => s.trim()).filter(s => s.length > 1) }
var TTS = { keep: [], token: 0 }
function speak(text, { onSentence, onEnd } = {}) {
  ttsStop()
  const S = window.speechSynthesis, parts = sentences(text)
  if (!S || !parts.length) { if (onEnd) setTimeout(onEnd, 0); return }
  const my = ++TTS.token, z = IZX(), v = iziVoice()
  TTS.keep = []   // ссылки держим, иначе Safari выбрасывает фразу и onend не приходит
  let i = 0
  const next = () => {
    if (my !== TTS.token) return
    if (i >= parts.length) { TTS.speaking = false; if (onEnd) onEnd(); return }
    const s = parts[i++], u = new SpeechSynthesisUtterance(s)
    u.lang = "ru-RU"; try { if (v) u.voice = v } catch (e) {}; u.rate = z.rate || 1; u.pitch = 1
    u.onstart = () => { if (my === TTS.token) { TTS.speaking = true; SILK.ie = 1; if (onSentence) onSentence(s) } }
    u.onboundary = () => { SILK.ie = Math.min(1.3, SILK.ie + .45) }   // каждое слово подталкивает волну Изи
    u.onend = next
    u.onerror = e => { if (e.error === "interrupted" || e.error === "canceled") return; next() }
    TTS.keep.push(u); S.speak(u)
  }
  next()
}
function ttsStop() { TTS.token++; TTS.speaking = false; try { window.speechSynthesis && speechSynthesis.cancel() } catch (e) {} }
// Safari разрешает говорить только после касания — «разбудить» синтез пустой фразой в момент нажатия
function ttsUnlock() { try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u) } catch (e) {} }

// ── Живой разговор: слушаю → думаю → говорю → снова слушаю ──
// Шар со стеклом и двумя волнами: голубая — голос Изи, мятная — ваш. Нажать на шар, пока Изи говорит, — перебить;
// пока слушает — отправить сразу; на паузе — продолжить. Закончить — смахнуть вниз.
var TALK = null
var TALK_SILENCE = 1300
function talkOpen() {
  if (TALK) return
  if (!aiKey()) { setTab("more"); return ui.info("Нужен ключ Claude", "Подключите приложение кодом из виджета: в Scriptable меню → 📱 Приложение «Мой день» → «Подключить приложение».") }
  if (voice) voiceReset()
  ttsUnlock()
  const el = document.createElement("div"); el.id = "talk"
  el.innerHTML = `<div class="tk-sheet"><div class="grab"></div>
    <div class="tk-top"><b>${esc(iziName())}</b><span class="tk-st"></span></div>
    <button class="tk-orb" aria-label="Шар: перебить, отправить или продолжить"><canvas></canvas></button>
    <div class="tk-cap"><p class="tk-izi"></p><p class="tk-you"></p></div>
    <div class="tk-bar"><button class="tk-btn tk-mic" aria-label="Пауза">${ICO.mic}</button><button class="tk-btn tk-chat" aria-label="Перейти в чат">${ICO.chat}</button></div>
    <div class="tk-hint">Смахните вниз, чтобы закончить</div></div>`
  document.body.append(el)
  TALK = { el, state: "", rec: null, timer: null, heard: "", n: 0 }
  silkCanvas($("canvas", el), "talk")
  requestAnimationFrame(() => el.classList.add("on"))
  $(".tk-orb", el).onclick = () => talkTap()
  $(".tk-mic", el).onclick = () => TALK.state === "pause" ? talkListen() : talkPause()
  $(".tk-chat", el).onclick = () => { talkClose(); setTab("chat") }
  // смахнуть вниз — закончить разговор
  const sh = $(".tk-sheet", el); let y0 = null, dy = 0
  el.addEventListener("touchstart", e => { y0 = e.touches[0].clientY; dy = 0 }, { passive: true })
  el.addEventListener("touchmove", e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; el.style.setProperty("--fade", String(1 - Math.min(1, dy / 400))) }, { passive: true })
  el.addEventListener("touchend", () => { if (y0 == null) return; y0 = null; if (dy > 110) talkClose(); else { sh.style.transform = ""; el.style.removeProperty("--fade") } }, { passive: true })
  // если Изи как раз задал вопрос в чате — прочитать его, иначе сразу слушать
  const last = D.chat[D.chat.length - 1]
  if (askWait && last && last.role === "assistant") talkHear(last.text, last.opts)
  else talkListen(true)
}
function talkClose() {
  const t = TALK; if (!t) return
  TALK = null
  ttsStop(); clearTimeout(t.timer)
  try { t.rec && t.rec.abort() } catch (e) {}
  t.el.classList.remove("on"); t.el.classList.add("off")
  setTimeout(() => t.el.remove(), 380)
  if (tab === "chat") renderChat()
}
function talkState(s, izi, you) {
  const t = TALK; if (!t) return
  t.state = s; t.el.dataset.st = s
  $(".tk-st", t.el).textContent = { listen: "Слушаю", think: "Думаю…", say: "Говорит", pause: "Пауза" }[s] || ""
  if (izi != null) { const p = $(".tk-izi", t.el); p.textContent = izi; p.classList.toggle("ph", !!izi && izi.startsWith("·")) }
  if (you != null) $(".tk-you", t.el).textContent = you
  $(".tk-mic", t.el).classList.toggle("off", s === "pause")
  $(".tk-mic", t.el).setAttribute("aria-label", s === "pause" ? "Продолжить" : "Пауза")
}
function talkTap() {
  const t = TALK; if (!t) return
  if (t.state === "say") { ttsStop(); return talkListen() }       // перебить
  if (t.state === "listen") return talkSendNow()                  // сказали всё — отправить сразу
  if (t.state === "pause") return talkListen()
}
function talkPause() { const t = TALK; if (!t) return; ttsStop(); clearTimeout(t.timer); const r = t.rec; t.rec = null; try { r && r.abort() } catch (e) {}; talkState("pause", null, "Нажмите на шар, чтобы продолжить") }
function talkListen(first) {
  const t = TALK; if (!t) return
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { talkState("pause", "Распознавание речи недоступно в этом браузере", ""); return }
  clearTimeout(t.timer); t.heard = ""
  const prev = t.rec; t.rec = null; try { prev && prev.abort() } catch (e) {}
  talkState("listen", null, first ? "Говорите — я слушаю" : "")
  const my = ++t.n
  const r = new SR(); r.lang = "ru-RU"; r.interimResults = true; r.continuous = true
  r.onresult = e => {
    if (TALK !== t || t.n !== my) return
    let s = ""; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript
    t.heard = s.trim(); SILK.ye = Math.min(1.3, SILK.ye + .5)
    talkState("listen", null, t.heard)
    clearTimeout(t.timer); t.timer = setTimeout(() => talkSendNow(), TALK_SILENCE)
  }
  r.onerror = e => {
    if (TALK !== t || t.n !== my) return
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { talkState("pause", "Нет доступа к микрофону", "Настройки → Safari → Микрофон"); return }
  }
  r.onend = () => {   // Safari сам закрывает распознавание — слушаем дальше, пока не отправили
    if (TALK !== t || t.n !== my || t.state !== "listen") return
    if (t.heard) return talkSendNow()
    setTimeout(() => { if (TALK === t && t.n === my && t.state === "listen") talkListen() }, 250)
  }
  try { r.start(); t.rec = r } catch (e) { setTimeout(() => { if (TALK === t && t.n === my) talkListen() }, 500) }
  // 20 секунд тишины — пауза, чтобы микрофон не висел впустую
  t.timer = setTimeout(() => { if (TALK === t && t.n === my && !t.heard) talkPause() }, 20000)
}
function talkSendNow() {
  const t = TALK; if (!t || t.state !== "listen") return
  const text = t.heard.trim()
  clearTimeout(t.timer); t.n++
  const r = t.rec; t.rec = null; try { r && r.stop() } catch (e) {}
  if (!text) return talkListen()
  talkState("think", "·  ·  ·", text)
  chatSend(text, { voice: true })
}
// Ответ или вопрос Изи пришёл в чат — прочитать вслух, потом снова слушать
function talkHear(text, opts) {
  const t = TALK; if (!t) return
  const say = String(text || "") + (opts && opts.length ? " " + (opts.length === 2 ? `${opts[0]} или ${opts[1]}?` : opts.slice(0, 4).join(", ") + "?") : "")
  talkState("say", sentences(say)[0] || "", "")
  speak(say, { onSentence: s => { if (TALK === t) talkState("say", s, null) }, onEnd: () => { if (TALK === t && t.state === "say") talkListen() } })
}
// Шар разговора: стекло, две волны с растворяющимися концами и внешнее кольцо, которое тает наружу.
// Темп медленный; кто говорит — у того волна дрожит, размах чуть больше
function silkTalk(c, T, d) {
  const x = c.getContext("2d"), W = c.width, H = c.height, st = TALK ? TALK.state : ""
  const syl = .55 + .45 * Math.sin(T * 2.3) * Math.sin(T * .9 + 1)
  const ti = st === "say" ? (.35 + .65 * syl) * Math.max(.4, SILK.ie) : st === "think" ? .12 + .08 * Math.sin(T * 1.6) : 0
  const ty = st === "listen" ? (.12 + .88 * syl) * Math.max(.12, SILK.ye) : 0
  SILK.il += (ti - SILK.il) * (ti > SILK.il ? .07 : .035); SILK.yl += (ty - SILK.yl) * (ty > SILK.yl ? .07 : .035)
  SILK.ie *= .975; SILK.ye *= .975
  x.clearRect(0, 0, W, H)
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * .34
  // одна сфера в цветах Изи, без стеклянной оболочки; край тает наружу и дышит с голосом
  const P = iziCol(), ci = P[0] === "em" ? "95,185,255" : P[3], cy2 = P[0] === "em" ? "80,245,190" : P[4]
  const edge = R * (1.2 + .1 * Math.max(SILK.il, SILK.yl))
  iziSphere(x, W, H, R, edge, P, () => {
    const len = R * 1.9
    // [цвет, уровень, смещение, базовый размах, фаза, скорость, толщина]
    ;[[ci, SILK.il, .05, .2, 2.1, .75, .03], [cy2, SILK.yl, -.05, .24, 0, .62, .034]].forEach(([rgb, lv, dy, am, ph, sp, lw]) => {
      const amp = R * am * (1 + lv * .6), jit = lv * .14
      const g = x.createLinearGradient(cx - len / 2, 0, cx + len / 2, 0)
      g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(.3, `rgba(${rgb},${.8 + lv * .2})`); g.addColorStop(.7, `rgba(${rgb},${.8 + lv * .2})`); g.addColorStop(1, `rgba(${rgb},0)`)
      x.beginPath()
      for (let i = 0; i <= 120; i++) {
        const u = i / 120, env = Math.pow(Math.sin(Math.PI * u), 1.5), px = cx - len / 2 + u * len
        const py = cy + dy * R + amp * env * (Math.sin(u * Math.PI * 2.2 + ph + T * sp) + jit * Math.sin(u * Math.PI * 9 + T * 7.5))
        i ? x.lineTo(px, py) : x.moveTo(px, py)
      }
      x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = g; x.lineWidth = Math.max(1.4 * d, R * lw * (1 + lv * .25))
      x.shadowColor = `rgba(${rgb},.9)`; x.shadowBlur = R * (.1 + lv * .12); x.stroke(); x.shadowBlur = 0
    })
  }, { alpha: .5, mode: "screen" })
}
Object.assign(SILK, { il: 0, yl: 0, ie: 0, ye: 0 })

// ── Настройки помощника ──
function iziCard() {
  const z = IZI(), x = IZX(), v = iziVoice(), canTalk = !!window.speechSynthesis
  const tg = (k, t, s) => `<button class="set tg-row" data-izi-tg="${k}"><span><b>${t}</b><small>${s}</small></span><i class="tgl ${x[k] ? "on" : ""}" role="switch" aria-checked="${!!x[k]}"></i></button>`
  return `<div class="card izi-card"><h2>Помощник</h2>
    <div class="set"><span>Имя</span><input type="text" data-izi="name" value="${esc(z.name)}" maxlength="20" autocomplete="off" style="text-align:right"></div>
    <div class="set"><span>Пол</span><div class="seg izi-g"><i style="--i:${z.g === "f" ? 1 : 0}"></i><button data-izi-g="m" class="${z.g === "m" ? "on" : ""}">Мужской</button><button data-izi-g="f" class="${z.g === "f" ? "on" : ""}">Женский</button></div></div>
    <div class="set"><span>Цвет</span><div class="izi-c">${IZI_COL.map(p => `<button data-izi-c="${p[0]}" class="${p[0] === iziCol()[0] ? "on" : ""}" style="background:linear-gradient(45deg,${p[2].join(",")})" aria-label="${p[1]}"></button>`).join("")}</div></div>
    <div class="muted small">Цвет «${iziCol()[1]}» — на кнопке, в чате, в разговоре и на значке (значок меняется, если заново добавить приложение на экран «Домой»). От пола зависят окончания в ответах и голос: «${esc(z.name)} ${z.g === "f" ? "записала" : "записал"}».</div>
    <div class="izi-sub">Характер</div>
    ${Object.entries(IZI_MODES).map(([k, [t, s]]) => `<button class="set mode-row" data-izi-mode="${k}"><span><b>${t}</b><small>${s}</small></span>${x.mode === k ? `<i class="ck">${ICO.check}</i>` : "<i></i>"}</button>`).join("")}
    <div class="izi-sub">Голос</div>
    <button class="set voice-row" data-do="izi-voice"><span><b>${esc(voiceLabel(v))}</b><small>${canTalk ? "голос iPhone · нажмите, чтобы выбрать и послушать" : "в этом браузере нет голоса"}</small></span><i class="chev">${ICO.chev}</i></button>
    <div class="set col"><span>Темп речи</span><div class="seg izi-rate">${IZI_RATES.map(([r, t]) => `<button data-izi-rate="${r}" class="${Math.abs((x.rate || 1) - r) < .01 ? "on" : ""}">${t}</button>`).join("")}</div></div>
    <div class="izi-sub">Чему учится и как помогает</div>
    ${tg("goals", "Советы по целям", "как ставить цели и доходить до конца: шаг на неделю, «если — то», копилка")}
    ${tg("psy", "Психология", "сначала слышит, бережно помогает разобраться в чувствах и отношениях")}
    ${tg("first", "Пишет первым", "свободное окно, подготовка к встрече, «как прошло?», сверка целей в воскресенье — до 3 раз в день")}
    ${tg("learn", "Учиться на мне", "сам замечает, что вам подходит, и запоминает поправки")}
    <div class="btns" style="margin-top:12px"><button class="btn primary talk-btn" data-do="talk"><b class="mini-orb"></b>Поговорить с ${esc(iziName())}</button></div></div>`
}
function voicePicker() {
  const vs = ttsVoices(), z = IZX(), cur = iziVoice()
  if (!vs.length) return ui.info("Голосов пока нет", "Русские голоса появятся, когда iPhone их загрузит: Настройки → Универсальный доступ → Устный контент → Голоса → Русский.")
  const mine = vs.filter(v => voiceSex(v) === z.g), other = vs.filter(v => voiceSex(v) !== z.g)
  const row = v => `<button class="opt vrow ${cur && v.voiceURI === cur.voiceURI ? "on" : ""}" data-v="${esc(v.voiceURI)}"><span>${esc(voiceLabel(v))}</span><small>${voiceSex(v) === "f" ? "женский" : voiceSex(v) === "m" ? "мужской" : ""}</small></button>`
  const s = sheet(`<h3>Голос ${esc(iziName())}</h3>
    ${mine.length ? `<div class="izi-sub">${z.g === "f" ? "Женские" : "Мужские"}</div>${mine.map(row).join("")}` : ""}
    ${other.length ? `<div class="izi-sub">${mine.length ? "Другие" : "Голоса"}</div>${other.map(row).join("")}` : ""}
    <div class="muted small" style="margin-top:10px">Нажмите — ${esc(iziName())} скажет фразу этим голосом. Живее звучат улучшенные голоса: Настройки iPhone → Универсальный доступ → Устный контент → Голоса → Русский${z.g === "m" ? " (мужской — «Юрий»)" : " («Милена», «Катя»)"}.</div>`, { onClose: () => { ttsStop(); if (tab === "more") render() } })
  $$(".vrow", s.el).forEach(b => b.onclick = () => {
    iziSet("voice", b.dataset.v); $$(".vrow", s.el).forEach(x => x.classList.toggle("on", x === b))
    speak(`Привет! Я ${iziName()}. ${iziG("Готов", "Готова")} поговорить, когда удобно.`)
  })
}
function bindIzi(v) {
  $$("[data-izi-mode]", v).forEach(b => b.onclick = () => { iziSet("mode", b.dataset.iziMode); render(); toast(`Характер: ${IZI_MODES[b.dataset.iziMode][0].toLowerCase()}`) })
  $$("[data-izi-tg]", v).forEach(b => b.onclick = () => { const k = b.dataset.iziTg, on = !IZX()[k]; iziSet(k, on); const i = $(".tgl", b); i.classList.toggle("on", on); i.setAttribute("aria-checked", on) })
  $$("[data-izi-rate]", v).forEach(b => b.onclick = () => { iziSet("rate", +b.dataset.iziRate); $$("[data-izi-rate]", v).forEach(x => x.classList.toggle("on", x === b)); speak(`Так ${iziG("я буду", "я буду")} говорить.`) })
  $$(".talk-btn .mini-orb, .chat-tools .mini-orb", v).forEach(o => { if (!o.firstChild) { const c = document.createElement("canvas"); o.append(c); silkCanvas(c, "orb") } })
}

// ── Изи пишет первым: окно в расписании, подготовка к встрече, «как прошло?», сверка целей в воскресенье ──
// ───────────── Задачи в Claude Code: карточка «в работе» и итог в чате ─────────────
// Сессия по окончании вписывает итог в лист «Ответы Claude Code» таблицы, таблица отдаёт его при обмене (res.cc).
// D.cc[id] = { id, title, route, url, at, state: "run" | "done", text, links, doneAt, said, late }
var CC_LATE = 3 * 3600e3, CC_LOST = 24 * 3600e3
function ccSet(j) {
  D.cc[j.id] = Object.assign(D.cc[j.id] || {}, j)
  for (const k of Object.keys(D.cc)) if ((D.cc[k].doneAt || D.cc[k].at || 0) < Date.now() - 30 * 864e5) delete D.cc[k]
}
function ccIn(list) {
  let said = false
  for (const x of list || []) {
    if (!x || !x.id) continue
    const j = D.cc[x.id]
    if (!j) { if (x.state === "run") ccSet(x); continue }   // задача с другого устройства: молча следим
    if (x.state !== "done" || j.state === "done") continue
    ccSet({ id: x.id, state: "done", text: String(x.text || ""), links: (x.links || []).filter(u => /^https:\/\//.test(u)), doneAt: x.doneAt || Date.now() })
    if (j.said) continue
    j.said = 1; said = true
    const text = `Готово: «${j.title}».\n${j.text}`
    D.chat.push({ role: "assistant", at: Date.now(), text, ccDone: j.id })
    if (!chatBusy && !askWait) talkHear(text)
    if (tab !== "chat") toast(`${iziName()}: готово «${j.title}»`)
  }
  if (said && tab === "chat") renderChat()
  else if (tab === "chat") ccRefresh()
}
// Долго молчит — сказать один раз и дать ссылку на сессию
function ccLate() {
  const now = Date.now()
  for (const j of Object.values(D.cc)) {
    if (j.state !== "run" || j.late || now - j.at < CC_LATE || now - j.at > CC_LOST) continue
    j.late = 1
    D.chat.push({ role: "assistant", at: now, text: `Задача «${j.title}» идёт уже ${Math.round((now - j.at) / 3600e3)} ч и пока без итога. Возможно, сессия ждёт ответа или застряла — загляните в неё.`, ccDone: j.id })
    save(false)
    if (tab === "chat") renderChat()
  }
}
function ccStatus(j) {
  if (j.state === "done") return "готово"
  const min = Math.round((Date.now() - j.at) / 60e3)
  if (Date.now() - j.at > CC_LOST) return "нет ответа"
  return min < 1 ? "в работе" : min < 60 ? `в работе · ${min} мин` : `в работе · ${Math.floor(min / 60)} ч ${min % 60} мин`
}
const ccHost = u => { try { const h = new URL(u).hostname.replace(/^www\./, ""); return /github/.test(h) ? "GitHub" : /docs\.google/.test(h) ? "Документ Google" : /claude\.ai/.test(h) ? "Claude" : h } catch (e) { return "Ссылка" } }
function ccCards(m) {
  const ids = m.cc || (m.ccDone ? [m.ccDone] : [])
  return ids.map(id => {
    const j = D.cc[id]; if (!j) return ""
    const done = j.state === "done", res = m.ccDone && done ? (j.links || []) : []
    return (m.ccDone ? "" : `<div class="cc-card ${done ? "done" : ""}" data-cc="${esc(id)}"><span class="cc-ic">${done ? ICO.check : ICO.timer}</span><span class="cc-tx"><b>${esc(j.title)}</b><small>Claude Code · <span class="cc-st">${esc(ccStatus(j))}</span></small></span></div>`) +
      `<div class="cc-links">${res.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(ccHost(u))}</a>`).join("")}<a href="${esc(j.url)}" target="_blank" rel="noopener">Открыть сессию</a></div>`
  }).join("")
}
// Обновить статусы на карточках без перерисовки всего чата
function ccRefresh() { $$(".cc-card").forEach(el => { const j = D.cc[el.dataset.cc]; if (!j) return; const st = el.querySelector(".cc-st"); if (st) st.textContent = ccStatus(j); el.classList.toggle("done", j.state === "done") }) }

// Не чаще 3 раз в день, только пока приложение открыто и Изи свободен. Состояние — D.izi.pro (на телефоне)
var PRO_MAX = 3
function proState() { const p = Object.assign({ day: "", n: 0, seen: {} }, (D.izi || {}).ps), dk = iso(new Date()).slice(0, 10); if (p.day !== dk) { p.day = dk; p.n = 0; p.seen = {} } return p }
function proSay(p, key, msg) {
  p.seen[key] = 1; p.n++; iziSet("ps", p)
  D.chat.push(Object.assign({ role: "assistant", at: Date.now(), pro: true }, msg)); save(false)
  if (tab === "chat") renderChat(); else toast(`${iziName()}: ${String(msg.text).slice(0, 60)}`)
}
function iziProactive() {
  if (!aiKey() || chatBusy || askWait || TALK || voice || !IZX().first) return
  const p = proState(); if (p.n >= PRO_MAX) return
  const now = Date.now(), v = iphone(), work = /показ|встреч|созвон|звон|клиент|переговор|собеседов/i
  const evs = v.events.filter(e => !e.all_day && e.start && e.end).map(e => ({ e, s: +parseIso(e.start), t: +parseIso(e.end) })).filter(x => x.s && x.t).sort((a, b) => a.s - b.s)
  // 1) за 5–20 минут до встречи — карточка подготовки (через Claude: память о человеке и прошлые встречи)
  const soon = evs.find(x => x.s - now > 5 * 60e3 && x.s - now < 20 * 60e3 && work.test(x.e.title || ""))
  if (soon && !p.seen["prep:" + soon.e.id]) {
    p.seen["prep:" + soon.e.id] = 1; p.n++; iziSet("ps", p)
    return chatSend(`Через ${Math.round((soon.s - now) / 60e3)} минут «${soon.e.title}»${soon.e.location ? ` (${soon.e.location})` : ""}. Сделай короткую карточку подготовки в 2–4 строки: кто это и что о нём известно (память, прошлые события и переписка), о чём говорили в прошлый раз и что пользователь обещал. Если ничего не известно — одной строкой, что спросить. Ничего не меняй.`, { label: `Перед встречей «${soon.e.title}»` })
  }
  // 2) встреча закончилась до часа назад — «Как прошло? Что договорились?», ответ Изи разложит в дела
  const done = evs.filter(x => now - x.t > 0 && now - x.t < 60 * 60e3 && x.t - x.s >= 25 * 60e3 && work.test(x.e.title || "")).pop()
  if (done && !p.seen["after:" + done.e.id]) return proSay(p, "after:" + done.e.id, { text: `Как прошло «${done.e.title}»? Что договорились — запишу дела и сроки.` })
  // 3) свободное окно от часа в ближайшие 2 часа и есть дела без времени — предложить занять
  const end = new Date(); end.setHours(21, 0, 0, 0)
  if (now < +end - 60 * 60e3) {
    let from = now, gap = null
    for (const x of evs.filter(x => x.t > now)) { if (x.s - from >= 60 * 60e3) { gap = [from, x.s]; break } from = Math.max(from, x.t) }
    if (!gap && +end - from >= 60 * 60e3) gap = [from, +end]
    const todo = v.reminders.filter(r => !r.completed && !r.due).map(r => r.title).slice(0, 2)
    if (gap && gap[0] - now < 2 * 3600e3 && todo.length) {
      const a = new Date(Math.ceil(gap[0] / 900e3) * 900e3), key = "gap:" + iso(a)
      if (!p.seen[key] && !Object.keys(p.seen).some(k => k.startsWith("gap:") && Math.abs(+parseIso(k.slice(4)) - +a) < 3 * 3600e3))
        return proSay(p, key, { text: `С ${hm(a)} до ${hm(new Date(gap[1]))} у вас свободно. Сделаем ${todo.map(t => `«${t}»`).join(" или ")}?`, opts: [...todo, "Ничего"], win: [iso(a), iso(new Date(gap[1]))] })
    }
  }
  // 4) воскресенье вечером — сверка целей недели (если включены советы по целям)
  const d = new Date(), wk = iso(addDays(sod(d), -((d.getDay() + 6) % 7))).slice(0, 10)
  if (IZX().goals && d.getDay() === 0 && d.getHours() >= 18 && (D.izi || {}).wk !== wk) {
    iziSet("wk", wk); p.n++; iziSet("ps", p)
    return chatSend("Сделай короткую сверку целей недели: посмотри get_goals (и копилки в get_money, вес и привычки в get_health, если они связаны с целями). По каждой активной цели одной-двумя строками: где сейчас и по плану ли, что помешало на этой неделе (если видно по данным), и один конкретный шаг на следующую неделю — со временем, если есть свободное окно в календаре. В конце спроси через ask_user «Принять план на неделю?» [Принять, Обсудить] и при «Принять» поставь шаги в календарь или напоминания.", { label: "Сверка целей недели" })
  }
}
function proPick(m, opt) {
  m.opts = null; save(false)
  if (opt === "Ничего") { D.chat.push({ role: "user", text: "Ничего", at: Date.now(), local: true }); save(false); return renderChat() }
  chatSend(`В свободное окно ${m.win[0].slice(11)}–${m.win[1].slice(11)} сегодня займусь «${opt}». Поставь это в календарь на это время (не дольше окна) и отметь напоминание, если оно было без срока.`, { label: opt })
}

// ── «Напомни, когда…»: придёт зарплата / буду с человеком / начнётся событие ──
// Хранится на телефоне в D.izi.when; проверяется при каждом обмене с таблицей
function iziWhen() { return ((D.izi || {}).when || []).slice() }
function iziWhenCheck() {
  const list = iziWhen(); if (!list.length) return
  const now = Date.now(), v = iphone(), low = s => String(s || "").toLowerCase()
  const fired = list.filter(w => {
    if (w.on === "income") return live(D.money).some(e => e.type === "income" && e.date >= w.at && (!w.match || low(e.category + " " + e.comment).includes(low(w.match))))
    if (w.on === "person" || w.on === "event") return v.events.some(e => { const s = +parseIso(e.start), t = +parseIso(e.end); return s <= now + 10 * 60e3 && t > now && low(e.title + " " + (e.location || "")).includes(low(w.match)) })
    return false
  })
  if (!fired.length) return
  iziSet("when", list.filter(w => !fired.includes(w)))
  for (const w of fired) {
    const why = w.on === "income" ? "пришёл доход" + (w.match ? ` «${w.match}»` : "") : w.on === "person" ? `вы с ${w.match}` : `начинается «${w.match}»`
    D.chat.push({ role: "assistant", text: `Напоминаю, ${why}: ${w.text}`, at: Date.now() })
    toast(`${iziName()}: ${w.text}`)
  }
  save(false); if (tab === "chat") renderChat()
}

// ── Черновик сообщения человеку: карточка с «WhatsApp», «Telegram», «Скопировать», «Мягче», «Короче» ──
function draftHTML(m) {
  const d = m.draft; if (!d) return ""
  const t = encodeURIComponent(d.text), ph = String(d.phone || "").replace(/[^\d]/g, "")
  return `<div class="draft"><div class="dr-to">${esc(d.to ? "Для: " + d.to : "Черновик")}</div><div class="dr-tx">${esc(d.text)}</div>
    <div class="opts dr-opts"><a class="on" href="https://wa.me/${ph}?text=${t}" target="_blank" rel="noopener">WhatsApp</a><a href="https://t.me/share/url?url=%20&text=${t}" target="_blank" rel="noopener">Telegram</a>
    <button data-dr="copy">Скопировать</button><button data-dr="soft">Мягче</button><button data-dr="short">Короче</button></div></div>`
}
function bindIziChat() {
  $$("[data-dr]").forEach(b => b.onclick = () => {
    const m = D.chat[+b.closest(".m").dataset.i]; if (!m || !m.draft) return
    if (b.dataset.dr === "copy") { try { navigator.clipboard.writeText(m.draft.text); toast("Скопировано") } catch (e) { toast("Не удалось скопировать") } return }
    chatSend(`Перепиши черновик для ${m.draft.to || "этого человека"} ${b.dataset.dr === "soft" ? "мягче и теплее" : "короче"}: «${m.draft.text}»`, { label: b.dataset.dr === "soft" ? "Мягче" : "Короче" })
  })
  $$("[data-pro]").forEach(b => b.onclick = () => { const m = D.chat[+b.closest(".m").dataset.i]; if (m) proPick(m, b.dataset.pro) })
}
var IZI_TOOLS = {
  draft_message(x) {
    const text = String(x.text || "").trim(); if (!text) return { error: "нужен text" }
    chatDraft = { to: String(x.to || "").slice(0, 60), text: text.slice(0, 2000), phone: x.phone || "" }
    return { ok: true, note: "Черновик показан пользователю карточкой с кнопками WhatsApp/Telegram/Скопировать. В ответе текст черновика не повторяй — одна короткая строка." }
  },
  remind_when(x) {
    if (!x.text || !/^(income|person|event)$/.test(x.on)) return { error: "нужны text и on: income | person | event" }
    if (x.on !== "income" && !x.match) return { error: "для person/event нужен match — имя человека или слово из названия события" }
    const w = { id: uid("w"), text: String(x.text).slice(0, 200), on: x.on, match: String(x.match || "").slice(0, 60), at: Date.now() }
    iziSet("when", iziWhen().concat(w).slice(-30))
    return { ok: true, active: iziWhen().map(w => ({ text: w.text, on: w.on, match: w.match })) }
  },
  list_when() { return { active: iziWhen().map(w => ({ id: w.id, text: w.text, on: w.on, match: w.match })) } },
  cancel_when(x) { const l = iziWhen(); iziSet("when", l.filter(w => w.id !== x.id)); return { ok: l.some(w => w.id === x.id) } },
}
var IZI_TOOL_DEFS = [
  { name: "draft_message", description: "Показать пользователю черновик сообщения человеку (жене, родителям, другу, клиенту) карточкой с кнопками WhatsApp, Telegram, «Скопировать», «Мягче», «Короче». Используй, когда просят помочь написать кому-то. Пиши от первого лица пользователя, в нужном тоне, с учётом того, что знаешь о человеке.",
    input_schema: { type: "object", properties: { to: { type: "string", description: "кому, как называет пользователь («Оля», «мама», «Михаил»)" }, text: { type: "string" }, phone: { type: "string", description: "номер в международном формате, если известен" } }, required: ["text"] } },
  { name: "remind_when", description: "Напомнить не по времени, а по событию: on=income — когда придёт доход (match — категория или слово из комментария, например «Зарплата»); on=person — когда пользователь будет с человеком (по событию календаря с его именем, match — имя); on=event — когда начнётся событие со словом match в названии («офис», «Big C»). Место «когда буду рядом» — это remind_near.",
    input_schema: { type: "object", properties: { text: { type: "string", description: "что напомнить" }, on: { type: "string", enum: ["income", "person", "event"] }, match: { type: "string" } }, required: ["text", "on"] } },
  { name: "list_when", description: "Список напоминаний «когда…» (по доходу, человеку, событию).", input_schema: { type: "object", properties: {} } },
  { name: "cancel_when", description: "Отменить напоминание «когда…» по id из list_when.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
]
var chatDraft = null

load()
pushConn()
setTab("today")
setTimeout(pushKeep, 5000)
hashAction()
setTimeout(memorize, 8000)   // прошлый разговор закончился — сложить в память
setTimeout(autoPlan, 15000)   // первый раз за день — план подсказок
window.addEventListener("hashchange", hashAction)
sync()
setInterval(() => { if (document.visibilityState === "visible") sync() }, 60000)
setInterval(() => { if (document.visibilityState === "visible") { iziWhenCheck(); iziProactive() } }, 60000)   // Изи пишет первым и «напомни, когда…»
setTimeout(() => { iziWhenCheck(); iziProactive() }, 20000)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") { hiddenAt = Date.now(); return }
  if (hiddenAt && Date.now() - hiddenAt > 30 * 60e3 && !sameDay(selDay, new Date())) { selDay = sod(new Date()); stripCenter = null; stripJump = true }
  const back = runWidgetAt && Date.now() - runWidgetAt < 10 * 60e3
  runWidgetAt = 0
  sync().then(() => { if (back) { render(); toast(pendingOps().length ? "Ещё не всё внесено — откройте виджет ещё раз" : "✓ Внесено в iPhone") } })
})
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(r => r.update()).catch(() => {})
  // Пришла новая версия: в первые секунды после запуска — перезагрузиться сразу; если уже пользуетесь —
  // тихо перезагрузиться, когда приложение уйдёт в фон (перезагрузка заново спрашивает микрофон у iOS)
  const had = !!navigator.serviceWorker.controller, born = Date.now()
  let reloaded = false, pending = false
  const reload = () => { if (!reloaded) { reloaded = true; location.reload() } }
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!had) return; if (Date.now() - born < 4000) reload(); else pending = true })
  document.addEventListener("visibilitychange", () => { if (pending && document.visibilityState === "hidden") reload() })
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {}) })
}

