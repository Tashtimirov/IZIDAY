// «IZIDAY Плюс» (заявка без оплаты) и «Пригласить друга» в приложении (grow.js) на подменённом сервере друзей.
// Снимки светлой и тёмной темы — в папку из аргумента (по умолчанию build/web-shots/grow-*)
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
F.props.ANTHROPIC_KEY = "sk-owner"
let ok = true
const check = (cond, msg, got) => { console.log(cond ? "   ✓" : "   ✗", msg, cond ? "" : JSON.stringify(got)); ok = ok && !!cond }
const browser = await chromium.launch()
const errors = []
const PEOPLE = { masha: ["771", "masha@example.com", "Маша Иванова"], oleg: ["772", "oleg@example.com", "Олег Петров"] }
async function open(who, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: opt.en ? "en-US" : "ru-RU", timezoneId: "Asia/Bangkok", colorScheme: opt.dark ? "dark" : "light" })
  const page = await ctx.newPage()
  page.on("pageerror", e => errors.push(String(e)))
  let n = 0
  await page.route("https://accounts.google.com/**", r => {
    const q = new URL(r.request().url()).searchParams, id = who + (++n), p = PEOPLE[who]
    F.tokens[id] = { aud: CLIENT, iss: "https://accounts.google.com", exp: String(Date.now() / 1000 + 3600 | 0), email_verified: "true", sub: p[0], email: p[1], name: p[2], nonce: q.get("nonce") }
    r.fulfill({ status: 302, headers: { location: q.get("redirect_uri") + "#state=" + q.get("state") + "&id_token=" + id } })
  })
  await page.route("https://script.google.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(F.post(JSON.parse(r.request().postData()))) }))
  await page.addInitScript(() => { window.__shared = []; Object.defineProperty(navigator, "share", { value: d => { window.__shared.push(d); return Promise.resolve() }, configurable: true }) })
  await page.goto(BASE + (opt.q || ""))
  await page.waitForTimeout(700)
  return page
}
async function login(page) {
  if (await page.$("#onb .ob-btn")) {
    for (let k = 0; k < 14 && /Дальше|Начнём|Next|Start/i.test(await page.textContent('#onb [data-ob="next"]')); k++) { await page.click('#onb [data-ob="next"]'); await page.waitForTimeout(300) }
    await page.click('#onb [data-ob="next"]')
  } else await page.evaluate(() => FRIEND.login())
  await page.waitForTimeout(1800)
}
const closeAll = page => page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
const toCard = async (page, sel) => { await page.evaluate(s => { const el = document.querySelector(s); el && el.closest(".card").scrollIntoView({ block: "start" }); scrollBy(0, -70) }, sel); await page.waitForTimeout(400) }
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + ".png") })

for (const dark of [false, true]) {
  F.props.REF_PER = "3"
  const sfx = dark ? "-dark" : ""
  console.log(dark ? "Тёмная тема" : "Светлая тема")
  if (dark) { for (const k of Object.keys(F.props)) if (/^(u:|t:|r:|rq|ok:|ld:|p:)/.test(k)) delete F.props[k] }
  const m = await open("masha", { dark })
  await login(m)
  check(await m.evaluate(() => !!(D.conn && D.conn.friend)), "Маша вошла")
  await closeAll(m)
  await m.evaluate(() => setTab("more"))
  await m.waitForTimeout(900)
  const txt = await m.textContent("#view")
  check(/IZIDAY Плюс/.test(txt) && /6,99 \$ в месяц/.test(txt) && /Это не покупка/.test(txt), "карточка «IZIDAY Плюс»: цена и «это не покупка»")
  check(!/оплат|купить|Оформить подписку/i.test(txt.match(/IZIDAY Плюс[\s\S]{0,400}/)[0]), "в карточке нет слов про оплату и покупку")
  check(/Приглашайте друзей/.test(txt) && /3 из 3/.test(txt) && /30 дней Плюса/.test(txt), "карточка «Приглашайте друзей»: 3 из 3 и правило 30 дней")
  await toCard(m, '[data-grow="plus"]')
  await shot(m, "grow-1-cards" + sfx)
  await m.click('[data-grow="plus"]')
  await m.waitForTimeout(450)
  check(/ничего не покупаете и ничего не платите/.test(await m.textContent("#layer")), "окно заявки: ничего не платите")
  await m.click('#layer [data-pp="около 5 $"]')
  await shot(m, "grow-2-request" + sfx)
  await m.click('#layer [data-a="ok"]')
  await m.waitForTimeout(700)
  check(/Заявка принята/.test(await m.textContent("#layer")), "«Заявка принята»")
  await shot(m, "grow-3-thanks" + sfx)
  await closeAll(m)
  const book = Object.values(F.books).find(b => b.name === "IZIDAY — Заявки и приглашения")
  const rows = book.getSheetByName("Подписка").cells.filter(r => r && r[1] === "Маша Иванова")
  check(rows.length === (dark ? 2 : 1) && rows[rows.length - 1][4] === "около 5 $", "заявка Маши в таблице с ценой (одна строка на человека)", rows)
  await m.waitForTimeout(300)
  check(/Ваша заявка/.test(await m.textContent("#view")), "после заявки карточка показывает «Ваша заявка ✓»")
  // приглашение
  await m.click('[data-grow="inv"]')
  await m.waitForTimeout(800)
  const sh = await m.evaluate(() => window.__shared)
  check(sh.length === 1 && /\?r=[0-9a-f]{6}$/.test(sh[0].url), "Поделиться: ссылка с кодом", sh)
  const link = sh[0].url, code = link.split("?r=")[1]
  // Олег открывает ссылку и входит
  const o = await open("oleg", { dark, q: "?r=" + code })
  check(await o.evaluate(() => GROW.ref()) === code && !/r=/.test(await o.evaluate(() => location.search)), "код запомнен, адрес очищен")
  await login(o)
  check(/Заявка отправлена/.test(await o.textContent("#layer")) && !(await o.evaluate(() => !!(D.conn && D.conn.friend))), "Олег ждёт одобрения, не вошёл")
  await shot(o, "grow-5-wait" + sfx)
  await closeAll(o)
  const mail = F.mails.filter(x => /приглашает Олег/.test(x[1])).pop()
  check(!!mail, "владельцу письмо «Маша приглашает Олега»")
  await m.evaluate(() => { setTab("today"); setTab("more") })
  await m.evaluate(() => GROW && 0)
  await m.evaluate(() => { const b = document.querySelector('[data-grow="inv"]'); b && b.click() })   // обновит список
  await m.waitForTimeout(900)
  await m.evaluate(() => render())
  check(/Олег Петров/.test(await m.textContent("#view")) && /ждёт одобрения/.test(await m.textContent("#view")) && /2 из 3/.test(await m.textContent("#view")), "у Маши: Олег ждёт одобрения, 2 из 3")
  // владелец одобряет
  const tok = mail[2].match(/ok=([0-9a-f]{40})&a=yes/)[1]
  F.gs.doGet({ parameter: { ok: tok, a: "yes" } })
  await login(o)
  check(await o.evaluate(() => !!(D.conn && D.conn.friend)) && !(await o.evaluate(() => GROW.ref())), "после одобрения Олег вошёл, код стёрт")
  await m.evaluate(() => { const b = document.querySelector('[data-grow="inv"]'); b && b.click() })
  await m.waitForTimeout(900)
  await m.evaluate(() => render())
  check(/в IZIDAY/.test(await m.textContent("#view")), "у Маши: Олег в IZIDAY")
  await toCard(m, '[data-grow="inv"]')
  await shot(m, "grow-4-invite" + sfx)
  await m.context().close(); await o.context().close()
}
// английская версия
const e = await open("masha", { en: true })
await e.evaluate(() => { localStorage.setItem("izi-lang", "en") }); await e.reload(); await e.waitForTimeout(700)
await login(e); await closeAll(e)
await e.evaluate(() => setTab("more")); await e.waitForTimeout(900)
const et = await e.textContent("#view")
check(/IZIDAY Plus/.test(et) && /\$6\.99 per month/.test(et) && /Invite friends/.test(et), "английская версия карточек")
await toCard(e, '[data-grow="plus"]')
await shot(e, "grow-6-en")
// владелец (своя таблица): заявка не уходит
const before = F.post({ lead: { id: "zzzzzzzzzzzzzzzz" } }).n
await e.evaluate(() => { D.conn = { hook: "https://script.google.com/macros/s/OWN/exec", secret: "x".repeat(40) }; render() })
await e.click('[data-grow="plus"]'); await e.waitForTimeout(300); await e.click('#layer [data-a="ok"]'); await e.waitForTimeout(500)
check(F.post({ lead: { id: "zzzzzzzzzzzzzzzz" } }).n === before, "заявка владельца не считается")
check(!(await e.textContent("#view")).includes("Invite friends"), "у владельца нет карточки приглашения")
check(!errors.length, "без ошибок на странице", errors)
await browser.close(); server.close()
console.log(ok ? "GROW_WEB_OK" : "GROW_WEB_FAIL")
process.exit(0)
