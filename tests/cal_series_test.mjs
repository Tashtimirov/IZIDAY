// Google Календарь через таблицу: «это и все следующие повторения» не трогает прошлые встречи (обрезка правила UNTIL)
import { sheetScript } from "./fake_sheet.mjs"
let ok = true
const check = (c, msg, got) => { console.log(c ? "✓" : "✗", msg, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const sheet = sheetScript(), S = "s".repeat(32)
const cal = a => sheet.post({ secret: S, hub: { from: "app", cal: a } }).cal
sheet.post({ secret: S, hub: { from: "app", since: 0 } })   // таблица запоминает ключ
const z = n => String(n).padStart(2, "0"), iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
const d0 = new Date(); d0.setDate(d0.getDate() - 14); d0.setHours(19, 0, 0, 0)
const occ = new Date(d0); occ.setDate(occ.getDate() + 14)

const c1 = cal({ action: "create", title: "Падел", start: iso(d0), end: iso(new Date(+d0 + 2 * 3600e3)), repeat: { freq: "weekly" } })
const r1 = cal({ action: "delete", id: c1.event.id, occurrence_start: iso(occ), all_future: true })
const cut = sheet.cal.log.find(x => x[0] === "cut")
const until = new Date(+occ - 60e3).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "")
check(r1.ok && r1.deleted === "from", "серия обрезана, а не удалена", r1)
check(cut && cut[2] === `RRULE:FREQ=WEEKLY;UNTIL=${until}`, "правило: COUNT убран, UNTIL — минута до повторения", cut)
check(sheet.cal.events.some(e => e.getId() === c1.event.id), "прошлые повторения на месте")

const c2 = cal({ action: "create", title: "Йога", start: iso(occ), repeat: { freq: "daily" } })
const r2 = cal({ action: "delete", id: c2.event.id, occurrence_start: iso(occ), all_future: true })
check(r2.ok && r2.deleted === "series" && !sheet.cal.events.some(e => e.getId() === c2.event.id), "с первого повторения — вся серия", r2)

const c3 = cal({ action: "create", title: "Разовое", start: iso(occ) })
const r3 = cal({ action: "delete", id: c3.event.id })
check(r3.ok && !sheet.cal.events.some(e => e.getId() === c3.event.id), "обычное событие удаляется как раньше", r3)
console.log(ok ? "\nCAL_SERIES_OK" : "\nCAL_SERIES_FAIL")
process.exit(ok ? 0 : 1)
