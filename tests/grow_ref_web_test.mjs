// Экран роста в приложении (grow.js): статус, Плюс, приглашённые с днями, правила, лига месяца, карточка дня.
// Снимки светлой и тёмной темы — в папку из аргумента (по умолчанию build/web-shots/)
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
import http from "http"
import fs from "fs"
import path from "path"
import { friendsServer, CLIENT } from "./fake_friends.mjs"
const ROOT = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = process.argv[2] || new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]).replace(/\/$/, "/index.html"))
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end() }
  const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" }[path.extname(p)]
  res.writeHead(200, { "content-type": (type || "text/plain") + "; charset=utf-8" }); fs.createReadStream(p).pipe(res)
}).listen(0)
const BASE = `http://localhost:${server.address().port}/`
const F = friendsServer()
F.props.ANTHROPIC_KEY = "sk-owner"; F.props.REF_AUTO = "1"
let ok = true
const check = (cond, msg, got) => { console.log(cond ? "   ✓" : "   ✗", msg, cond ? "" : JSON.stringify(got)); ok = ok && !!cond }
const browser = await chromium.launch()
const errors = []
// соперники в лиге
for (const k of ["ann", "bob"]) F.post({ login: { id_token: k } })
const uid = email => Object.keys(F.props).filter(k => /^u:/.test(k)).map(k => JSON.parse(F.props[k])).find(u => u.email === email)
async function open(dark, en) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: en ? "en-US" : "ru-RU", timezoneId: "Asia/Bangkok", colorScheme: dark ? "dark" : "light" })
  const page = await ctx.newPage()
  page.on("pageerror", e => errors.push(String(e)))
  let n = 0
  await page.route("https://accounts.google.com/**", r => {
    const q = new URL(r.request().url()).searchParams, id = "masha" + (++n)
    F.tokens[id] = { aud: CLIENT, iss: "https://accounts.google.com", exp: String(Date.now() / 1000 + 3600 | 0), email_verified: "true", sub: "771", email: "masha@example.com", name: "Маша Иванова", nonce: q.get("nonce") }
    r.fulfill({ status: 302, headers: { location: q.get("redirect_uri") + "#state=" + q.get("state") + "&id_token=" + id } })
  })
  await page.route("https://script.google.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(F.post(JSON.parse(r.request().postData()))) }))
  await page.addInitScript(() => { window.__shared = []; Object.defineProperty(navigator, "share", { value: d => { window.__shared.push(d); return Promise.resolve() }, configurable: true }); Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true }) })
  if (en) await page.addInitScript(() => localStorage.setItem("izi-lang", "en"))
  await page.goto(BASE); await page.waitForTimeout(700)
  if (await page.$("#onb .ob-btn")) {
    for (let k = 0; k < 14 && /Дальше|Начнём|Next|Start/i.test(await page.textContent('#onb [data-ob="next"]')); k++) { await page.click('#onb [data-ob="next"]'); await page.waitForTimeout(300) }
    await page.click('#onb [data-ob="next"]')
  } else await page.evaluate(() => FRIEND.login())
  await page.waitForTimeout(1800)
  return page
}
const closeAll = page => page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + ".png") })
for (const dark of [false, true]) {
  const sfx = dark ? "-dark" : ""
  console.log(dark ? "Тёмная тема" : "Светлая тема")
  const m = await open(dark)
  await closeAll(m)
  check(await m.evaluate(() => !!(D.conn && D.conn.friend)), "Маша вошла")
  // состояние: Проводник (3 активных), Плюс 44 дня, приглашённые на разных шагах, лига месяца
  const u = uid("masha@example.com"), now = Date.now()
  Object.assign(u, { act: 3, plus: now + 44 * 864e5, l2: 1,
    inv: [{ e: "oleg@x", n: "Олег Петров", st: "in", act: now - 5 * 864e5, at: now - 20 * 864e5 }, { e: "lena@x", n: "Лена", st: "in", id: uid("ann@example.com").id, at: now - 6 * 864e5 },
      { e: "petr@x", n: "Пётр", st: "wait", at: now - 864e5 }],
    bon: [{ d: 30, w: "Олег с вами 7 дней", at: now - 5 * 864e5 }, { d: 3, w: "Ира — друг вашего друга Олега", at: now - 2 * 864e5 }] })
  F.props["u:" + u.id] = JSON.stringify(u)
  const A = uid("ann@example.com"); A.nd = 4; F.props["u:" + A.id] = JSON.stringify(A)
  const month = F.tzFmt(new Date(), "Asia/Bangkok", "yyyy-MM")
  F.props["lm:" + month] = JSON.stringify({ [uid("bob@example.com").id]: 4, [u.id]: 3, [A.id]: 1 })
  await m.evaluate(() => setTab("more")); await m.waitForTimeout(1200)
  await m.evaluate(() => { const b = document.querySelector('[data-grow="how"]'); b && b.closest(".card").scrollIntoView({ block: "start" }); scrollBy(0, -70) }); await m.waitForTimeout(400)
  const txt = await m.textContent("#view")
  check(/Приглашайте друзей/.test(txt) && /Проводник/.test(txt), "карточка роста со статусом «Проводник»")
  check(/До статуса «Амбассадор»\s*3 из 10/.test(txt), "прогресс до «Амбассадор»: 3 из 10")
  check(/Лена\s*4 из 7 дней/.test(txt) && /Олег Петров\s*бонус начислен/.test(txt) && /Пётр\s*ждёт одобрения/.test(txt), "приглашённые: дни, бонус, ожидание")
  check(/Плюс уже работает/.test(txt), "в карточке Плюса видно, что Плюс работает")
  check(!/заработ|доход|выплат/i.test(await m.textContent(".gr-card")), "в карточке роста нет слов про заработок")
  await shot(m, "growref-1-card" + sfx)
  await m.click('[data-grow="how"]'); await m.waitForTimeout(450)
  const how = await m.textContent("#layer")
  check(/Друзья друзей/.test(how) && /Только один шаг/.test(how) && /Деньги за приглашения не платим/.test(how) && /Олег с вами 7 дней/.test(how), "правила: второй уровень, без денег, история бонусов")
  await shot(m, "growref-2-how" + sfx)
  await closeAll(m)
  await m.click('[data-grow="league"]'); await m.waitForTimeout(450)
  const lg = await m.textContent("#layer")
  check(/Лига приглашений/.test(lg) && /Боб/.test(lg) && /Вы/.test(lg) && /30 дней/.test(lg), "лига месяца: Боб первый, Маша вторая, призы")
  await shot(m, "growref-3-league" + sfx)
  await closeAll(m)
  await m.evaluate(() => { GAMI.stats = () => ({ today: { clean: { done: 7 }, total: 42 }, streak: 12, weekPts: 236 }) })   // цифры для снимка
  await m.click('[data-grow="card"]'); await m.waitForTimeout(700)
  check(await m.$("#layer .gr-img"), "карточка дня нарисована")
  await shot(m, "growref-4-daycard" + sfx)
  const png = await m.evaluate(() => { const r = GROW.info(); return GROW.drawCard(r.link, "30 дней Плюса в подарок после 7 дней в IZIDAY").toDataURL("image/png") })
  fs.writeFileSync(path.join(SHOTS, "growref-5-image" + sfx + ".png"), Buffer.from(png.split(",")[1], "base64"))
  await m.click('#layer [data-a="ok"]'); await m.waitForTimeout(500)
  const sh = await m.evaluate(() => window.__shared.map(x => ({ files: (x.files || []).length, text: x.text })))
  check(sh.length === 1 && sh[0].files === 1 && /\?r=[0-9a-f]{6}/.test(sh[0].text), "«Поделиться»: картинка и ссылка с кодом", sh)
  // семья: код семьи уходит на сервер при обмене
  await m.evaluate(() => { D.fam = { url: D.conn.hook, code: "abcdefabcdef12", id: "m1" }; save(false) })
  await m.evaluate(() => hubPost({ since: 9e15 }, 8000).catch(() => {})); await m.waitForTimeout(500)
  check(uid("masha@example.com").fam === "abcdefabcdef12", "код семьи сохранён на сервере")
  await m.context().close()
}
const e = await open(false, true)
await closeAll(e); await e.evaluate(() => setTab("more")); await e.waitForTimeout(1200)
const et = await e.textContent("#view")
check(/Invite friends/.test(et) && /Guide/.test(et) && /How it works/.test(et), "английская версия")
check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()
console.log(ok ? "GROW_REF_WEB_OK" : "GROW_REF_WEB_FAIL")
process.exit(0)
