// Дни рождения: три источника (вручную, контакты iPhone, Google Контакты) без дублей, «не напоминать»,
// пуши таблицы за неделю (10:00), накануне (19:00) и в сам день (9:00); в приложении — карточка на «Сегодня»,
// окно «Дни рождения» и инструменты Изи. Снимки — build/web-shots/bd-*
import { createRequire } from "module"
import http from "http"
import fs from "fs"
import path from "path"
import { sheetScript } from "./fake_sheet.mjs"
const { chromium } = createRequire(import.meta.url)("playwright")

let ok = true
const check = (c, msg, got) => { console.log(c ? "   ✓" : "   ✗", msg, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const z = n => String(n).padStart(2, "0")
const ymd = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`, md = d => ymd(d).slice(5)
const at = (days, h, m = 0) => { const x = new Date(); x.setDate(x.getDate() + days); x.setHours(h, m, 0, 0); return x }
const T0 = at(0, 0), IN7 = at(7, 0), TMR = at(1, 0), IN3 = at(3, 0)

// ── 1. Таблица: пуши
const sh = sheetScript(), S = "s".repeat(32), hub = h => sh.post({ secret: S, hub: h })
hub({ from: "app", since: 0 })
hub({ from: "app", push: { action: "subscribe", sub: { endpoint: "https://push.example/bd", keys: { p256dh: "x", auth: "y" } } } })
const u = Date.now()
hub({ from: "app", since: 0, lists: { bdays: [
  { id: "y1", date: u, u, name: "Мама", md: md(T0), year: 1960 },
  { id: "c:3", date: u, u, name: "Босс", off: true }] } })
hub({ from: "widget", since: 0, snap: { events: [], bdays: [
  { id: "c:1", name: "Кирилл Иванов", md: md(IN7), year: 1990 },
  { id: "c:3", name: "Босс", md: md(TMR), year: 0 },
  { id: "c:4", name: "мама", md: md(T0), year: 0 }] } })   // та же мама из контактов — не второй пуш
globalThis.__gbdays = [
  { id: "g1", summary: "Иванов Кирилл", start: { date: ymd(IN7) }, birthdayProperties: { contact: "people/c1" } },   // он же из Google
  { id: "g2", summary: "Надя", start: { date: ymd(TMR) }, birthdayProperties: { contact: "people/c2" } }]
const realNow = Date.now
const tickAt = d => { Date.now = () => +d; try { sh.pushTick() } finally { Date.now = realNow }
  Date.now = () => +d + 1000; try { return hub({ from: "app", push: { action: "outbox" } }).push.items.map(x => x.title + " | " + x.body) } finally { Date.now = realNow } }
let out = tickAt(at(0, 9, 5))
console.log("   9:05 → " + out.join(" ; "))
const age = T0.getFullYear() - 1960
check(out.filter(x => /Сегодня день рождения/.test(x)).length === 1 && out.some(x => x.includes(`Мама (${age}) — исполняется ${age}`)), "в сам день в 9:00 — один пуш про маму (из приложения и контактов) с возрастом", out)
check(!out.some(x => /Кирилл|Надя|Босс/.test(x)), "в 9:00 нет лишних", out)
out = tickAt(at(0, 9, 20))
check(out.filter(x => /Сегодня день рождения/.test(x)).length === 1, "повтор не шлётся", out)
out = tickAt(at(0, 10, 5))
const wk = out.filter(x => /Через неделю/.test(x))
check(wk.length === 1 && /Кирилл Иванов \(\d+\)/.test(wk[0]) && /Подумай о подарке/.test(wk[0]), "за неделю в 10:00 — один пуш про Кирилла (контакт iPhone + Google), год из контакта", out)
out = tickAt(at(0, 19, 5))
const tm = out.filter(x => /Завтра день рождения/.test(x))
check(tm.length === 1 && /Надя/.test(tm[0]), "накануне в 19:00 — Надя из Google", out)
check(!out.some(x => /Босс/.test(x)), "«Не напоминать» выключает контакт", out)

// ── 2. Приложение
const ROOT = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]).replace(/\/$/, "/index.html"))
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end() }
  const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json" }[path.extname(p)]
  res.writeHead(200, { "content-type": (type || "text/plain") + "; charset=utf-8" }); fs.createReadStream(p).pipe(res)
}).listen(0)
const BASE = `http://localhost:${server.address().port}/`
const sheet = sheetScript(), HOOK = "https://script.google.com/macros/s/TEST/exec"
sheet.post({ secret: S, hub: { from: "widget", since: 0, snap: { events: [], reminders: [], calendars: ["Личное"], lists: ["Напоминания"], bdays: [
  { id: "c:1", name: "Кирилл Иванов", md: md(IN3), year: 1990 },
  { id: "c:5", name: "Саида", md: md(T0), year: 2015 }] } } })
const setup = Buffer.from(JSON.stringify({ v: 1, hook: HOOK, secret: S, key: "sk-test", routes: [], sheetUrl: "", run: "scriptable:///run/MyDay",
  cfg: { currency: "฿", health: { waterGoal: 2000, glass: 250 }, categories: { expense: [["Другое", []]], income: [["Другое", []]] }, calendars: [] } }), "utf8").toString("base64")
const browser = await chromium.launch()
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", colorScheme: scheme })
  const page = await ctx.newPage(), errors = []
  page.on("pageerror", e => errors.push(String(e)))
  await page.route("https://script.google.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(sheet.post(r.request().postData())) }))
  await page.route("https://open.er-api.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ rates: { THB: 1 } }) }))
  globalThis.__gbdays = [{ id: "g9", summary: "Иванов Кирилл", start: { date: ymd(IN3) } }, { id: "g8", summary: "Надя", start: { date: ymd(TMR) } }]
  await page.goto(BASE + "#setup=" + encodeURIComponent(setup))
  await page.waitForTimeout(1600); await page.evaluate(() => { calForce = true; return sync() }); await page.waitForTimeout(1600)
  if (scheme === "light") {
    const all = await page.evaluate(() => bdaysAll().map(b => b.name + ":" + b.src + ":" + (b.year || 0)))
    check(all.length === 3 && all.includes("Кирилл Иванов:c:1990") && all.some(x => /^Надя:g/.test(x)), "приложение: контакты + Google без дублей", all)
    const a = await page.evaluate(() => runTool("add_birthday", { name: "Мама", date: "03-05", note: "любит пионы" }))
    check(a.ok && a.next && a.next.date === "5 марта", "Изи: add_birthday", a)
    const a2 = await page.evaluate(() => runTool("add_birthday", { name: "мама", date: "1960-03-05" }))
    check(a2.id === a.id && (await page.evaluate(() => bdaysMine().length)) === 1, "повторное «мама» обновляет, а не дублирует", a2)
    const g = await page.evaluate(() => runTool("get_birthdays", { days: 5 }))
    check(g.items.length === 3 && g.items[0].name === "Саида" && g.items[0].when === "сегодня" && g.items[0].turns === T0.getFullYear() - 2015, "Изи: get_birthdays — ближайшие, сегодня первым, возраст", g)
    const d = await page.evaluate(() => runTool("delete_birthday", { id: "g:g8" }))
    check(d.ok && !(await page.evaluate(() => bdaysAll().some(b => b.name === "Надя"))), "Изи: delete_birthday для Google — «не напоминать»", d)
    await page.evaluate(() => sync()); await page.waitForTimeout(800)
    const srv = sheet.post({ secret: S, hub: { from: "app", since: 0 } }).lists.bdays
    check(srv.some(b => b.id === "g:g8" && b.off) && srv.some(b => b.name === "Мама" && b.year === 1960), "в таблицу ушли ручной ДР и «не напоминать»", srv)
    check(await page.evaluate(() => bdayParse("29.02") && bdayNext("02-29", new Date(2027, 0, 1)).getDate() === 28 && !bdayParse("31.04")), "29 февраля → 28-го в невисокосный год; 31 апреля — не дата")
  }
  await page.evaluate(() => setTab("today")); await page.waitForTimeout(500)
  const card = await page.textContent("#bdays").catch(() => "")
  check(/Дни рождения/.test(card) && /Саида · \d+/.test(card) && /сегодня/.test(card), `карточка на «Сегодня» (${scheme})`, card)
  await page.locator("#bdays").scrollIntoViewIfNeeded()
  await page.locator("#bdays").screenshot({ path: SHOTS + `bd-card-${scheme}.png` })
  await page.click('#bdays [data-do="bdays"]'); await page.waitForTimeout(600)
  await page.screenshot({ path: SHOTS + `bd-sheet-${scheme}.png` })
  if (scheme === "light") {
    await page.fill("#bd-n", "Алия"); await page.fill("#bd-d", ymd(IN7)); await page.click('.sheet [data-a="ok"]'); await page.waitForTimeout(500)
    check(await page.evaluate(() => bdaysMine().some(b => b.name === "Алия" && b.year === 0)), "добавление из окна", null)
  }
  check(!errors.length, `без ошибок (${scheme})`, errors)
  await ctx.close()
}
await browser.close(); server.close()
console.log(ok ? "\nBDAYS_OK" : "\nBDAYS_FAIL")
process.exit(ok ? 0 : 1)
