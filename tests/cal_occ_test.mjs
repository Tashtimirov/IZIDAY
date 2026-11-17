// Изи меняет одно повторение серии (время/название) — Code.gs cal_ update → calPatchOcc_ через API Календаря.
// Раньше CalendarApp менял название всей серии, а время оставалось прежним (17.11: «Забрать детей с экстраклассов»).
// Запуск: node tests/cal_occ_test.mjs → CALOCC_OK
import fs from "fs"
import vm from "vm"
const src = fs.readFileSync(new URL("../src/sheet/Code.gs", import.meta.url), "utf8")
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const TZ = "Asia/Bangkok", off = 7 * 36e5
const pad = n => String(n).padStart(2, "0")
const fmtD = (d, f) => { const x = new Date(d.getTime() + off); const Y = x.getUTCFullYear(), M = pad(x.getUTCMonth() + 1), D = pad(x.getUTCDate()), h = pad(x.getUTCHours()), m = pad(x.getUTCMinutes())
  return f === "yyyy-MM-dd" ? `${Y}-${M}-${D}` : `${Y}-${M}-${D}T${h}:${m}` }
const calls = [], seriesTouched = []
const occ = d => ({ id: "S_" + d, start: { dateTime: `2026-11-${d}T17:00:00+07:00`, timeZone: TZ }, end: { dateTime: `2026-11-${d}T17:35:00+07:00`, timeZone: TZ },
  originalStartTime: { dateTime: `2026-11-${d}T17:00:00+07:00` }, summary: "Забрать детей", recurringEventId: "S" })
const inst = { "12": occ("12"), "17": occ("17"), "19": occ("19") }
const ctx = {
  console,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSpreadsheetTimeZone: () => TZ }) },
  Session: { getScriptTimeZone: () => TZ },
  Utilities: { formatDate: (d, tz, f) => fmtD(d, f), parseDate: (s, tz) => { const m = s.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/); return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) - off) } },
  ScriptApp: { getOAuthToken: () => "T" },
  UrlFetchApp: { fetch: (url, o = {}) => { calls.push({ url, o })
    const resp = (code, obj) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(obj) })
    if (/\?iCalUID=/.test(url)) return resp(200, { items: [{ id: "S", recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"], start: { dateTime: "2026-11-12T17:00:00+07:00", timeZone: TZ } }] })
    if (/\/S\/instances/.test(url)) { const u = new URL(url), a = Date.parse(u.searchParams.get("timeMin")), b = Date.parse(u.searchParams.get("timeMax"))
      return resp(200, { items: Object.values(inst).filter(x => Date.parse(x.start.dateTime) >= a && Date.parse(x.start.dateTime) < b) }) }
    const m = url.match(/\/events\/(S_\d+)$/)
    if (m && o.method === "patch") { const x = Object.values(inst).find(v => v.id === m[1]); Object.assign(x, JSON.parse(o.payload)); return resp(200, x) }
    return resp(404, {}) } },
  CalendarApp: {
    getCalendarById: () => ({ getName: () => "me@gmail.com" }),
    getAllCalendars: () => [cal], getDefaultCalendar: () => cal,
  },
}
const seriesEv = { getId: () => "abc@google.com", isRecurringEvent: () => true, isAllDayEvent: () => false, getOriginalCalendarId: () => "me@gmail.com",
  getStartTime: () => new Date("2026-11-12T10:00:00Z"), getEndTime: () => new Date("2026-11-12T10:35:00Z"), getTitle: () => "Забрать детей",
  setTitle: t => seriesTouched.push("title"), setTime: () => seriesTouched.push("time"), setLocation: () => seriesTouched.push("loc"), setDescription: () => seriesTouched.push("desc"), getLocation: () => "", getDescription: () => "" }
const cal = { isHidden: () => false, getName: () => "me@gmail.com", getId: () => "me@gmail.com", getEventById: () => seriesEv, getEvents: () => [seriesEv] }
vm.createContext(ctx)
vm.runInContext(src, ctx)
const r = vm.runInContext(`cal_({ action: "update", id: "abc@google.com", occurrence_start: "2026-11-17T17:00", title: "Забрать детей с экстраклассов", start: "2026-11-17T17:00", end: "2026-11-17T17:15" })`, ctx)
check(r.ok && r.event.start === "2026-11-17T17:00" && r.event.end === "2026-11-17T17:15", "ответ Изи — сегодняшнее повторение 17:00–17:15, не 12 ноября", r)
check(Date.parse(inst["17"].end.dateTime) === Date.parse("2026-11-17T17:15:00+07:00") && inst["17"].summary === "Забрать детей с экстраклассов", "изменено именно 17.11", inst["17"])
check(inst["12"].summary === "Забрать детей" && inst["19"].summary === "Забрать детей" && inst["19"].end.dateTime.includes("17:35"), "другие повторения не тронуты", [inst["12"], inst["19"]])
check(!seriesTouched.length, "CalendarApp не трогает всю серию", seriesTouched)
// перенос без конца — длительность сохраняется; повторение ищется по новому началу
const r2 = vm.runInContext(`cal_({ action: "update", id: "abc@google.com", occurrence_start: "2026-11-19T17:00", start: "2026-11-20T09:00" })`, ctx)
check(r2.ok && r2.event.start === "2026-11-20T09:00" && r2.event.end === "2026-11-20T09:35", "перенос повторения на другой день, длительность 35 мин", r2)
const r3 = vm.runInContext(`(() => { try { return cal_({ action: "update", id: "abc@google.com", occurrence_start: "2026-11-25T17:00", start: "2026-11-25T18:00" }) } catch (e) { return { error: e.message } } })()`, ctx)
check(r3.error && /ничего не изменено/.test(r3.error), "нет такого повторения — понятная ошибка, ничего не меняем", r3)
console.log(ok ? "CALOCC_OK" : "CALOCC_FAIL")
