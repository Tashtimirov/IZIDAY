// Проверка: в тёмной теме нет «белых» полей ввода со светлым текстом. node tests/input_audit.mjs [папка сайта]
// Открывает все вкладки, настройки и все формы (функции *Form/*Sheet/*Pick/*Open без аргументов) и меряет контраст каждого поля.
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const { page, browser, server, errors } = await boot2({ root, time: new Date("2026-11-12T08:40:00Z"), dark: true })
await page.evaluate(() => { speechSynthesis.speak = () => {}; speechSynthesis.cancel = () => {} })
const names = await page.evaluate(() => Object.keys(window).filter(k => !/^show/.test(k) && /^[a-z][A-Za-z0-9]*(Form|Sheet|Pick|Picker|Open|Edit)$/.test(k) && typeof window[k] === "function" && !/^(sheetOpen|talkOpen|sideOpen|chatEdit)$/.test(k)))
const scan = label => page.evaluate(label => {
  const rgb = s => { const m = s.match(/[\d.]+/g) || [0, 0, 0, 0]; return { r: +m[0], g: +m[1], b: +m[2], a: m[3] == null ? 1 : +m[3] } }
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b) }
  // фон поля: свой, если непрозрачный, иначе — ближайшего непрозрачного родителя (в тёмной теме полупрозрачный белый ≈ тёмный)
  const bgOf = el => { let cur = el, acc = null
    while (cur && cur.nodeType === 1) { const c = rgb(getComputedStyle(cur).backgroundColor); if (c.a > 0) { if (!acc) acc = c; if (c.a >= .9) return acc.a >= .5 ? acc : c } cur = cur.parentElement }
    return acc && acc.a >= .5 ? acc : { r: 0, g: 0, b: 0, a: 1 } }
  const out = []
  for (const el of document.querySelectorAll("input, select, textarea")) {
    if (/^(checkbox|radio|range|color|file|hidden|button|submit)$/.test(el.type)) continue
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue
    const bg = bgOf(el), fg = rgb(getComputedStyle(el).color), L1 = lum(bg), L2 = lum(fg)
    const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05)
    if (L1 > .5 && ratio < 4.5) out.push({ label, id: el.id, cls: el.className, ph: el.placeholder, ctx: (el.closest(".sheet,.card,section,#view") || {}).className, bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color, ratio: +ratio.toFixed(2) })
    else if (L1 > .5) out.push({ label, light: true, id: el.id, cls: el.className, ph: el.placeholder, ratio: +ratio.toFixed(2) })
  }
  return out
}, label)
const bad = [], light = [], seen = new Set()
const add = l => l.forEach(x => { const k = x.label + x.id + x.cls + x.ph; if (seen.has(k)) return; seen.add(k); (x.light ? light : bad).push(x) })
for (const t of ["today", "cal", "plans", "money", "health", "chat", "more"]) { await page.evaluate(t => { try { setTab(t) } catch (e) {} }, t); await page.waitForTimeout(500); add(await scan("tab:" + t)) }
let opened = 0
for (const n of names) {
  await page.evaluate(() => { document.querySelectorAll(".sheet, .sheet-bg, .scrim").forEach(e => e.remove()); try { setTab("money") } catch (e) {} })
  const ok = await page.evaluate(n => { try { const r = window[n](); if (r && r.catch) r.catch(() => {}); return true } catch (e) { return String(e) } }, n)
  await page.waitForTimeout(350); if (ok) opened++
  const got = await scan(n); if (process.env.DBG) console.log(n, ok, got.length, await page.evaluate(() => document.querySelectorAll(".sheet input, .sheet select, .sheet textarea").length)); add(got)
}
console.log("форм открыто:", opened, "из", names.length)
console.log("светлые поля с тёмным текстом (читаемо, напр. детский режим):", light.map(x => x.label + (x.id ? "#" + x.id : "")).join(", ") || "нет")
if (bad.length) { console.log("INPUT_AUDIT_FAIL"); console.log(JSON.stringify(bad, null, 1)) } else console.log("INPUT_AUDIT_OK")
await browser.close(); server.close()
