// Вход в семью по коду-шару Изи: главный телефон показывает шар (orbcode.js), второй сканирует его камерой в приложении.
// Камера подменена: Chromium крутит снимок экрана первого телефона как видео. Сервер приглашений — Friends.gs inv_.
// Снимки — build/web-shots/orb-*
import fs from "fs"
import os from "os"
import path from "path"
import { createRequire } from "module"
import { boot2 } from "./today_boot.mjs"
import { friendsServer } from "./fake_friends.mjs"
const { chromium } = createRequire(import.meta.url)("playwright")
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = process.argv[2] || new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const F = friendsServer()
// ── сервер приглашений
const P = "eyJ1IjoiaHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9URVNUL2V4ZWMiLCJjIjoiMDAwMDAwMDAwMDAwMDAifQ"
let r = F.post({ inv: { op: "new", p: "<script>" } }); check(!r.ok, "мусор вместо приглашения не принимается", r)
r = F.post({ inv: { op: "new", p: P } }); check(r.ok && /^[0-9a-f]{10}$/.test(r.token) && r.ttl === 600, "приглашение: короткий код на 10 минут", r)
const t1 = r.token
check(F.post({ inv: { op: "stat", token: t1 } }).used === false, "шар ещё не отсканирован")
r = F.post({ inv: { op: "get", token: t1 } }); check(r.ok && r.p === P, "первое сканирование отдаёт приглашение", r)
r = F.post({ inv: { op: "get", token: t1 } }); check(!r.ok && r.gone && /уже использован/.test(r.error), "второй раз тот же шар не срабатывает", r)
check(F.post({ inv: { op: "stat", token: t1 } }).used === true, "главный телефон видит, что шар отсканирован")
r = F.post({ inv: { op: "new", p: P } }); F.cache["inv:" + r.token].exp = Date.now() - 1
check(F.post({ inv: { op: "get", token: r.token } }).gone, "через 10 минут шар устаревает")
check(!F.post({ inv: { op: "get", token: "zz" } }).ok, "плохой код отклоняется")

// ── главный телефон
const time = new Date("2026-11-14T11:00:00+07:00")
const dark = process.env.DARK === "1"
const { page, browser, server, errors, sheet } = await boot2({ root, time, dark })
const route = pg => pg.route("https://script.google.com/**", rt => { const b = JSON.parse(rt.request().postData())
  rt.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(b.inv ? F.post(b) : sheet.post(JSON.stringify(b))) }) })
await route(page)
const BASE = page.url().replace(/#.*$/, "")
const ask = async (pg, v) => { await pg.waitForSelector("#ask-v"); await pg.fill("#ask-v", String(v)); await pg.click('.sheet [data-a="ok"]'); await pg.waitForTimeout(350) }
const closeAll = pg => pg.evaluate(() => { while (stack.length) stack[stack.length - 1].close() })
await page.evaluate(() => { setTab("plans"); plansF = "fam"; render() }); await page.waitForTimeout(200)
check(await page.evaluate(() => !!$('[data-f="scan"]') && !!$('[data-f="new"]') && !!$('[data-f="paste"]')), "без семьи: «Сканировать шар», «Создать семью», вход по ссылке")
await page.screenshot({ path: SHOTS + "orb-0-nofam.png" })
await page.click('[data-f="new"]'); await ask(page, "Ильдар"); await ask(page, "Таштимировы"); await page.waitForTimeout(700)
await page.click('[data-f="invite"]'); await page.waitForSelector(".ocode:not(.wait)"); await page.waitForTimeout(900)
const tok = Object.keys(F.cache).filter(k => /^inv:/.test(k) && F.cache[k].exp > Date.now()).pop().slice(4)
check(await page.evaluate(() => !!$(".ocode-sheet .ocode-c") && !!$(".ocode-orb canvas") && /Шар действует ещё \d:\d\d/.test($(".ocode-t").textContent)), "главный видит шар с кольцами и сколько он ещё действует")
await page.evaluate(() => $("#toast").classList.remove("show")); await page.waitForTimeout(350); await page.screenshot({ path: SHOTS + "orb-1-show.png" })

// ── второй телефон: камера смотрит на экран первого
const cam = async name => {
  const box = await page.evaluate(() => { const b = $(".ocode").getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width } })
  const jpg = await page.screenshot({ type: "jpeg", quality: 82, clip: { x: 0, y: Math.max(0, box.y - 60), width: 390, height: box.w + 120 } })
  const f = path.join(os.tmpdir(), `orb_${process.pid}_${name}.mjpeg`); fs.writeFileSync(f, jpg)
  const b2 = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--use-file-for-fake-video-capture=" + f] })
  const ctx = await b2.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU", timezoneId: "Asia/Bangkok", colorScheme: dark ? "dark" : "light", permissions: ["camera"] })
  const p = await ctx.newPage(), err = []
  p.on("pageerror", e => err.push(String(e)))
  await route(p); await p.goto(BASE); await p.waitForTimeout(1800)
  return { p, b2, err }
}
const A = await cam("a")
await A.p.evaluate(() => { D.who = "adult"; D.onb = { done: true }; document.querySelectorAll(".onb, #onb").forEach(e => e.remove()); window._dec = ORBCODE.decode; ORBCODE.decode = () => null; FAM.scan() })
await A.p.waitForSelector(".oscan.show"); await A.p.waitForTimeout(700)
await A.p.screenshot({ path: SHOTS + "orb-2-scan.png" })
await A.p.evaluate(() => { ORBCODE.decode = window._dec })
await A.p.waitForSelector(".oscan.ok", { timeout: 15000 }).catch(() => {})
check(await A.p.evaluate(() => !!$(".oscan.ok")), "сканер прочитал шар с экрана первого телефона")
await A.p.waitForTimeout(900); await A.p.screenshot({ path: SHOTS + "orb-3-scan-ok.png" })
await page.waitForSelector(".ocode.ok", { timeout: 8000 }).catch(() => {})
check(await page.evaluate(() => !!$(".ocode.ok") && /Подключено/.test($(".ocode-t").textContent)), "на главном телефоне шар засветился: «Подключено»")
await page.waitForTimeout(900); await page.screenshot({ path: SHOTS + "orb-4-show-ok.png" })
await ask(A.p, "Алия"); await A.p.waitForTimeout(1200)
const code = await page.evaluate(() => D.fam.code)
check(await A.p.evaluate(c => D.fam && D.fam.code === c && D.fam.role === "adult" && plansF === "fam", code), "второй телефон в той же семье, открыта «Семья»")
check(!F.cache["inv:" + tok] && F.post({ inv: { op: "get", token: tok } }).gone, "шар погашен: повторно по нему не войти")
await page.waitForTimeout(4500)
check(await page.evaluate(() => !stack.length && Object.values(D.fam.data.members).some(m => m.name === "Алия")), "окно с шаром закрылось само, Алия в списке семьи", await page.evaluate(() => Object.values(D.fam.data.members).map(m => m.name)))
await page.screenshot({ path: SHOTS + "orb-5-family.png" })
await A.b2.close()

// ── ребёнок: родитель добавляет — сразу шар «Вход для Миши»
await page.click('[data-f="kid"]'); await ask(page, "Миша"); await ask(page, 9)
await page.waitForSelector(".ocode:not(.wait)"); await page.waitForTimeout(900)
check(await page.evaluate(() => /Миша: вход в семью/.test($(".ocode-sheet h3").textContent)), "после «Добавить ребёнка» сразу шар для входа")
await page.screenshot({ path: SHOTS + "orb-6-kid-show.png" })
const K = await cam("k")
check(await K.p.evaluate(() => typeof window.famJoin === "function"), "вход ребёнка из тура новичка на месте")
await K.p.evaluate(() => { D.who = "kid"; D.onb = { done: true }; document.querySelectorAll(".onb, #onb").forEach(e => e.remove()); render() }); await K.p.waitForTimeout(300)
if (await K.p.evaluate(() => !!$('[data-k="scan"]'))) { await K.p.screenshot({ path: SHOTS + "orb-7-kid-empty.png" }); await K.p.evaluate(() => $('[data-k="scan"]').click()) } else await K.p.evaluate(() => FAM.scan())
await K.p.waitForSelector(".oscan.ok", { timeout: 15000 }).catch(() => {})
await K.p.waitForTimeout(3200)
const kst = await K.p.evaluate(() => ({ kid: FAM.kidMode(), hi: ($(".kd h1") || {}).textContent, role: D.fam && D.fam.role }))
check(kst.kid && /Миша/.test(kst.hi || "") && kst.role === "kid", "ребёнок отсканировал шар и сразу в детском режиме под своим именем", kst)
await K.p.screenshot({ path: SHOTS + "orb-8-kid-in.png" })
await page.waitForSelector(".ocode.ok", { timeout: 8000 }).catch(() => {})
check(await page.evaluate(() => /Миша в семье/.test(($(".ocode-t") || {}).textContent || "")), "у родителя шар светится: «Миша в семье»")
check(!errors.length && !A.err.length && !K.err.length, "без ошибок на страницах", [errors, A.err, K.err])
await K.b2.close(); await browser.close(); server.close()
console.log(ok ? "FAMILY_ORB_OK" : "FAMILY_ORB_FAIL")
process.exit(0)
