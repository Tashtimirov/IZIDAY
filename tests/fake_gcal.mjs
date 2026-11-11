// Поддельный Google для сервера друзей: обмен кода на ключ, обновление, отзыв и API Календаря (часовой пояс событий — Москва)
import { CLIENT } from "./fake_friends.mjs"
export function fakeGoogle() {
const G = { cals: { primary: [], "fam@group.calendar.google.com": [] }, codes: { c1: "rt-ann" }, revoked: [], seq: 0, calls: [], refreshes: 0, dead: new Set(), lists: true }
const WD = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]
const json = (body, code = 200) => ({ code, body })
const parseQ = u => Object.fromEntries(new URL(u).searchParams)
const form = s => Object.fromEntries(new URLSearchParams(s))
// время события → UTC (часовой пояс у всех событий в тесте — Москва, +3)
const toUtc = x => x.date ? Date.parse(x.date + "T00:00:00+03:00") : Date.parse(/[Z+]/.test(x.dateTime.slice(19)) ? x.dateTime : x.dateTime + "+03:00")
const iso = t => new Date(t).toISOString().replace(".000Z", "Z")
function instances(e) {
  const rule = (e.recurrence || []).find(r => /^RRULE:/.test(r))
  if (!rule) return [e]
  const p = Object.fromEntries(rule.slice(6).split(";").map(x => x.split("="))), s = toUtc(e.start), dur = toUtc(e.end) - s
  const until = p.UNTIL ? Date.parse(p.UNTIL.replace(/^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)Z)?$/, (m, y, mo, d, h, mi, se) => `${y}-${mo}-${d}T${h || "23"}:${mi || "59"}:${se || "59"}Z`)) : Infinity
  const out = []
  for (let i = 0; i < 400; i++) {
    const st = s + i * 864e5
    if (st > until) break
    const wd = WD[new Date(st + 3 * 3600e3).getUTCDay()]
    if (p.FREQ === "WEEKLY" && (p.BYDAY ? p.BYDAY.split(",") : [WD[new Date(s + 3 * 3600e3).getUTCDay()]]).indexOf(wd) < 0) continue
    const id = e.id + "_" + iso(st).replace(/[-:]/g, "")
    if ((e.ex || []).includes(id)) continue
    const ov = (e.over || {})[id]
    out.push(Object.assign({ id, recurringEventId: e.id, summary: e.summary, location: e.location, description: e.description,
      start: { dateTime: iso(st) }, end: { dateTime: iso(st + dur) }, originalStartTime: { dateTime: iso(st) } }, ov || {}))
  }
  return out
}
function find(cal, id) {
  const list = G.cals[cal]
  const e = list.find(x => x.id === id)
  if (e) return { e }
  const m = list.find(x => id.indexOf(x.id + "_") === 0)
  if (m) { const i = instances(m).find(x => x.id === id); if (i) return { e: i, master: m } }
  return null
}
function google(url, o) {
  const method = (o.method || "get").toLowerCase()
  if (/oauth2\.googleapis\.com\/token$/.test(url)) {
    const f = form(o.payload)
    if (f.client_id !== CLIENT || f.client_secret !== "sec") return json({ error: "invalid_client" }, 401)
    if (f.grant_type === "authorization_code") {
      const rt = G.codes[f.code]; if (!rt) return json({ error: "invalid_grant" }, 400)
      delete G.codes[f.code]
      return json({ access_token: "at-" + (++G.seq), expires_in: 3599, refresh_token: rt, scope: G.scope || "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly" })
    }
    if (G.dead.has(f.refresh_token)) return json({ error: "invalid_grant" }, 400)
    G.refreshes++
    return json({ access_token: "at-" + (++G.seq), expires_in: 3599 })
  }
  if (/oauth2\.googleapis\.com\/revoke/.test(url)) { G.revoked.push(form(o.payload).token); return json({}) }
  if (/tokeninfo\?access_token=/.test(url)) return json({ aud: CLIENT, email: "Ann.Real@gmail.com", scope: "x" })
  if (!/googleapis\.com\/calendar\/v3/.test(url)) return null
  const auth = (o.headers || {}).Authorization || ""
  if (!/^Bearer at-\d+$/.test(auth) || G.expired === auth.slice(7)) return json({ error: { message: "expired" } }, 401)
  G.calls.push(method + " " + url.split("/calendar/v3")[1].split("?")[0])
  const path = decodeURIComponent(new URL(url).pathname.replace("/calendar/v3", "")), q = parseQ(url)
  if (path === "/users/me/calendarList") return G.lists ? json({ items: [{ id: "ann.real@gmail.com", primary: true, summary: "ann.real@gmail.com" }, { id: "fam@group.calendar.google.com", summary: "Семья" }, { id: "hid", summary: "Скрытый", hidden: true }] }) : json({ error: { message: "insufficient scopes" } }, 403)
  let m = path.match(/^\/calendars\/([^/]+)\/events(?:\/([^/]+))?(\/instances)?$/)
  if (!m) return json({ error: { message: "no route " + path } }, 404)
  const cal = m[1] === "ann.real@gmail.com" ? "primary" : m[1], id = m[2]
  const list = G.cals[cal]
  if (!id && method === "get") {
    const from = Date.parse(q.timeMin), to = Date.parse(q.timeMax)
    const items = list.flatMap(e => q.singleEvents ? instances(e) : [e]).filter(e => toUtc(e.start) < to && toUtc(e.end) > from).sort((a, b) => toUtc(a.start) - toUtc(b.start))
    return json({ items })
  }
  if (!id && method === "post") { const b = JSON.parse(o.payload)
    for (const k of ["start", "end"]) if (b[k].dateTime && b[k].timeZone === "Europe/Moscow") b[k].dateTime += "+03:00"   // Google отдаёт время со сдвигом пояса
    const e = Object.assign({ id: "ev" + (++G.seq) }, b); list.push(e); return json(e) }
  const hit = find(cal, id)
  if (!hit) return json({ error: { message: "Not Found" } }, 404)
  if (m[3]) { const from = Date.parse(q.timeMin), to = Date.parse(q.timeMax); return json({ items: instances(hit.e).filter(e => toUtc(e.start) >= from && toUtc(e.start) < to) }) }
  if (method === "get") return json(hit.e)
  if (method === "delete") {
    if (hit.master) (hit.master.ex ||= []).push(id); else G.cals[cal] = list.filter(x => x !== hit.e)
    return json(null, 204)
  }
  if (method === "patch") {
    const b = JSON.parse(o.payload)
    for (const k of ["start", "end"]) if (b[k]) { b[k] = Object.fromEntries(Object.entries(b[k]).filter(([, v]) => v != null)); if (b[k].dateTime && b[k].timeZone === "Europe/Moscow") b[k].dateTime += "+03:00" }
    if (hit.master) { const ov = ((hit.master.over ||= {})[id] ||= {}); Object.assign(ov, b); return json(Object.assign({}, hit.e, b)) }
    Object.assign(hit.e, b); return json(hit.e)
  }
  return json({ error: { message: "?" } }, 400)
}

  return { G, google }
}
