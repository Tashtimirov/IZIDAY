// Снимок дня и альбом года (album.js): фото + фраза в «Итогах дня», неделя без пропусков → карточка, лента, «год назад»,
// поведение без режима игры. Снимки — build/web-shots/al-*
import fs from "fs"
import { boot2, shot } from "./today_boot.mjs"
const root = new URL("../dist/web/", import.meta.url).pathname
const SHOTS = new URL("../build/web-shots/", import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
let ok = true
const check = (c, m, got) => { console.log(c ? "   ✓" : "   ✗", m, c ? "" : JSON.stringify(got)); ok = ok && !!c }
const time = new Date("2026-11-05T20:30:00+07:00")   // четверг, вечер
const PH = ["Утро на пирсе, тихо и солнечно", "Сдал проект, наконец-то", "Ужин с семьёй у моря", "Первая пробежка после перерыва", "Дождь весь день, читал",
  "Сын научился плавать", "Встреча с Олей, много смеялись", "Новый рецепт карри", "Длинный рабочий день", "Закат с террасы", "Купили велосипед", "Тренировка и баня"]
const { page, browser, server, errors } = await boot2({ root, time, lists: ({ bkk, dk }) => {
  const goals = []
  const note = (dd, i, mood) => goals.push({ id: "n" + dd, date: +bkk(dd, 21), u: 1, kind: "daynote", day: dk(bkk(dd, 12)), text: PH[i % PH.length], mood })
  for (let dd = -10; dd <= -4; dd++) note(dd, dd + 10, (dd + 12) % 5)          // прошлая неделя 26 окт – 1 нояб: 7 из 7
  for (let dd = -3; dd <= -1; dd++) note(dd, dd + 6, 3)                       // эта неделя: пн–ср
  for (const dd of [-17, -16, -15, -13, -12]) note(dd, -dd, 2)                // 19–25 окт: 5 из 7
  for (let dd = -24; dd <= -18; dd++) note(dd, -dd, 4)                        // 12–18 окт: 7 из 7
  goals.push({ id: "ny", date: +bkk(-365, 21), u: 1, kind: "daynote", day: dk(bkk(-365, 12)), text: "Первый день на Пхукете, всё впервые", mood: 4, ph: 1 })
  return { goals }
} })

// «фото» для проверки: рисуем пейзажи прямо в браузере и кладём в альбом
const scene = `(i, w = 1200, h = 1500) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d")
  const P = [["#FF7E5F", "#FEB47B", "#2B5876"], ["#4FACFE", "#00F2FE", "#0B486B"], ["#F7971E", "#FFD200", "#1D976C"], ["#614385", "#516395", "#1A2980"], ["#E96443", "#904E95", "#2C3E50"], ["#56CCF2", "#2F80ED", "#134E5E"]][i % 6]
  let g = x.createLinearGradient(0, 0, 0, h * .62); g.addColorStop(0, P[0]); g.addColorStop(1, P[1]); x.fillStyle = g; x.fillRect(0, 0, w, h)
  x.fillStyle = "rgba(255,255,240,.9)"; x.beginPath(); x.arc(w * (.25 + (i % 3) * .25), h * .38, 90 + (i % 4) * 20, 0, 7); x.fill()
  x.fillStyle = "rgba(0,0,0,.25)"; x.beginPath(); x.moveTo(0, h * .62); for (let k = 0; k <= 8; k++) x.lineTo(k * w / 8, h * (.5 + ((k * 37 + i * 13) % 10) / 90)); x.lineTo(w, h * .62); x.fill()
  g = x.createLinearGradient(0, h * .6, 0, h); g.addColorStop(0, P[2]); g.addColorStop(1, "#06121F"); x.fillStyle = g; x.fillRect(0, h * .62, w, h)
  x.strokeStyle = "rgba(255,255,255,.22)"; x.lineWidth = 4; for (let k = 0; k < 9; k++) { x.beginPath(); const y = h * .66 + k * 40; x.moveTo(w * .1 + k * 9, y); x.lineTo(w * .9 - k * 9, y); x.stroke() }
  return c }`
await page.evaluate(async ({ scene, days }) => {
  const mk = eval(scene)
  for (const [k, i] of days) {
    const c = mk(i), full = await new Promise(r => c.toBlob(r, "image/jpeg", .85))
    const t = document.createElement("canvas"); t.width = 384; t.height = 480; t.getContext("2d").drawImage(c, 0, 0, 384, 480)
    const thumb = await new Promise(r => t.toBlob(r, "image/jpeg", .8))
    await ALBUM.photoPut(k, { full, thumb })
  }
  render()
}, { scene, days: await page.evaluate(() => { const out = [], t = sod(new Date())
  for (let dd = -24; dd <= -1; dd++) if (![-11, -14, -9, -20, -21].includes(dd)) out.push([dayKey(addDays(t, dd)), dd + 30])
  out.push([dayKey(new Date(t.getFullYear() - 1, t.getMonth(), t.getDate())), 2]); return out }) })

// «Сегодня» вечером: «год назад», «Закрыть день», неделя снимков
await page.evaluate(() => { setTab("today"); render() }); await page.waitForTimeout(400)
await shot(page, `${SHOTS}al-today.png`)
check(await page.evaluate(() => /Ровно год назад/.test($(".al-ago").textContent) && !!$(".al-ago img")), "«Ровно год назад» с фото и фразой")
check(await page.evaluate(() => /3 из 7/.test($(".al-week").textContent) && $$(".al-week .al-dot.on").length === 3), "неделя снимков: 3 из 7, три кружка")

// «Итоги дня»: фото, фраза, настроение
await page.evaluate(() => $(".hero-eve").click()); await page.waitForTimeout(400)
check(await page.evaluate(() => !!$(".sheet .al-field") && /Фраза дня/.test($(".sheet").textContent)), "в «Итогах дня» — фото и фраза дня")
const png = await page.evaluate(async scene => { const c = eval(scene)(4); return c.toDataURL("image/jpeg", .9).split(",")[1] }, scene)
fs.writeFileSync(`${SHOTS}al-in.jpg`, Buffer.from(png, "base64"))
await page.setInputFiles(".sheet [data-alfile]", `${SHOTS}al-in.jpg`); await page.waitForTimeout(900)
await page.fill("#cd-t", "Закат с террасы и звонок маме"); await page.evaluate(() => $$("#cd-m button")[4].click())
check(await page.evaluate(() => !!$(".sheet .al-ph.has img")), "выбранное фото видно в окне")
await page.screenshot({ path: `${SHOTS}al-close.png` })
await page.evaluate(() => $('.sheet [data-a="ok"]').click()); await page.waitForTimeout(900)
let r = await page.evaluate(() => { const n = ALBUM.snapOf(dayKey(new Date())); return { ph: n && n.ph, text: n && n.text, url: ALBUM.URLS.has(dayKey(new Date())), w: ALBUM.weekInfo(ALBUM.monday(new Date())).have, sheet: !!$(".sheet .al-field") } })
check(r.ph === 1 && r.url && r.text === "Закат с террасы и звонок маме" && r.w === 4, "снимок сохранён: фото на телефоне, фраза в таблице", r)
check(await page.evaluate(() => { const n = live(D.goals).find(g => g.kind === "daynote" && g.day === dayKey(new Date())); return !JSON.stringify(n).includes("data:") && !JSON.stringify(n).includes("blob:") }), "в таблицу не уходит само фото")

// Альбом в «Планах»
await page.evaluate(() => ALBUM.openAlbum("cards")); await page.waitForTimeout(500)
await shot(page, `${SHOTS}al-album.png`)
r = await page.evaluate(() => ({ chip: !!$(".pf [data-pf=album].on"), open: $$(".al-wk.open").length, miss: $$(".al-wk.miss").length, cur: !!$(".al-week") }))
check(r.chip && r.open === 2 && r.miss === 1 && r.cur, "альбом: 2 карточки открыты, 1 неделя не собрана, текущая — кружками", r)

// карточка недели
await page.evaluate(() => $$(".al-wk.open")[0].click()); await page.waitForTimeout(800)
await page.screenshot({ path: `${SHOTS}al-card.png` })
check(await page.evaluate(() => $$(".sheet .al-t").length === 7 && /7 из 7/.test($(".sheet .al-card").textContent) && !!$(".sheet [data-alshare]")), "карточка: 7 дней, «7 из 7», «Сохранить картинкой»")
const jpg = await page.evaluate(async () => { const w = ALBUM.weekInfo(addDays(ALBUM.monday(new Date()), -7)); const c = await ALBUM.cardCanvas(w); return c.toDataURL("image/jpeg", .9).split(",")[1] })
fs.writeFileSync(`${SHOTS}al-export.jpg`, Buffer.from(jpg, "base64"))
check(jpg.length > 50000, "картинка карточки 1080×1350 собирается")
// день из карточки
await page.evaluate(() => $$(".sheet .al-t")[2].click()); await page.waitForTimeout(700)
await page.screenshot({ path: `${SHOTS}al-day.png` })
check(await page.evaluate(() => !!$(".sheet .al-dp img") && !!$(".sheet .al-dt")), "день: большое фото и фраза")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(300)

// неделя с пропуском и запертая текущая
await page.evaluate(() => $(".al-wk.miss").click()); await page.waitForTimeout(600)
check(await page.evaluate(() => /не собрана/.test($(".sheet").textContent) && !$(".sheet [data-alshare]")), "неделя с пропуском: карточка не собрана, картинки нет")
await page.evaluate(() => { while (stack.length) stack[stack.length - 1].close() }); await page.waitForTimeout(300)
check(await page.evaluate(() => { const d = addDays(sod(new Date()), -3); return !ALBUM.canFill(d) && ALBUM.canFill(addDays(sod(new Date()), -1)) }), "в игре пропуск дописать нельзя, вчерашний — можно")

// лента
await page.evaluate(() => { $('[data-alseg="feed"]').click() }); await page.waitForTimeout(400)
await shot(page, `${SHOTS}al-feed.png`)
check(await page.evaluate(() => $$(".al-fr").length >= 20 && !!$(".al-feed h2")), "лента по месяцам")

// Режим игры выключен: без замков и счётчиков, каждая неделя — карточка
await page.evaluate(() => { GAMI.set(false); ALBUM.openAlbum("cards") }); await page.waitForTimeout(500)
await shot(page, `${SHOTS}al-album-off.png`)
r = await page.evaluate(() => ({ miss: $$(".al-wk.miss").length, lock: $$(".al-lk").length, open: $$(".al-wk.open").length, cur: !!$(".al-week"), canOld: ALBUM.canFill(addDays(sod(new Date()), -3)) }))
check(r.miss === 0 && r.lock === 0 && r.open === 4 && !r.cur && r.canOld, "без игры: замков нет, все 4 недели — карточки, любой день можно дописать", r)
await page.evaluate(() => { setTab("today"); render() }); await page.waitForTimeout(400)
check(await page.evaluate(() => /Снимки недели/.test($(".al-week").textContent) && !/из 7/.test($(".al-week").textContent)), "без игры на «Сегодня» — просто «Снимки недели»")
await shot(page, `${SHOTS}al-today-off.png`)
await page.evaluate(() => GAMI.set(true)); await page.waitForTimeout(300)

// неделя собрана → праздник (воскресенье вечером)
await page.evaluate(() => { const t = sod(new Date()); for (const dd of [1, 2]) upsert("goals", { id: "nf" + dd, date: Date.now(), kind: "daynote", day: dayKey(addDays(t, dd)), text: "День " + dd, mood: 3 }) })
await page.clock.setFixedTime(new Date("2026-11-08T21:00:00+07:00"))
await page.evaluate(() => { selDay = sod(new Date()); setTab("today"); render(); $(".hero-eve").click() }); await page.waitForTimeout(400)
await page.fill("#cd-t", "Воскресенье у моря — неделя собрана"); await page.evaluate(() => $('.sheet [data-a="ok"]').click()); await page.waitForTimeout(1300)
await page.screenshot({ path: `${SHOTS}al-cele.png` })
check(await page.evaluate(() => !!$(".sheet.cele") && /Неделя без пропусков/.test($(".sheet.cele").textContent)), "7 из 7 → праздник и карточка недели")
const again = await page.evaluate(async () => { while (stack.length) stack[stack.length - 1].close(); await new Promise(r => setTimeout(r, 300)); ALBUM.snapEdit(dayKey(new Date())); await new Promise(r => setTimeout(r, 300)); $('.sheet [data-a="ok"]').click(); await new Promise(r => setTimeout(r, 900)); return !!$(".sheet.cele") })
check(!again, "праздник один раз на неделю")

check(!errors.length, "без ошибок в консоли", errors)
await browser.close(); server.close()
console.log(ok ? "ALBUM_OK" : "ALBUM_FAIL")
