// Скорость запуска: сколько скачивается и сколько телефон думает до первого экрана.
// Процессор замедлен в 4 раза (≈ средний iPhone), сеть — 4G. Холодный запуск (первый раз) и тёплый (из кэша приложения).
//   node tests/perf_start.mjs [папка сайта]   → таблица и строка PERF {...}
import { boot2 } from "./today_boot.mjs"
const root = process.argv[2] || new URL("../dist/web/", import.meta.url).pathname
const time = new Date("2026-11-12T03:30:00Z")
const { page, browser, server } = await boot2({ root, time })
const cdp = await page.context().newCDPSession(page)
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
const runs = []
for (const kind of ["тёплый", "тёплый", "тёплый"]) {
  await cdp.send("Performance.enable")
  const t0 = Date.now()
  await page.reload({ waitUntil: "load" })
  const ready = await page.waitForFunction(() => document.querySelector("#view") && document.querySelector("#view").innerText.length > 50, null, { timeout: 30000 }).then(() => Date.now() - t0).catch(() => -1)
  const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(x => [x.name, x.value]))
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } })
  const fp = await page.evaluate(() => Math.round((performance.getEntriesByName("first-contentful-paint")[0] || {}).startTime || -1))
  runs.push({ kind, ready, ...nav, fcp: fp, script: Math.round(m.ScriptDuration * 1000), layout: Math.round(m.LayoutDuration * 1000), style: Math.round(m.RecalcStyleDuration * 1000), heap: Math.round(m.JSHeapUsedSize / 1048576) })
  await cdp.send("Performance.disable")
}
// где тратится время при запуске (по функциям верхнего уровня): профиль одного тёплого запуска
await cdp.send("Profiler.enable"); await cdp.send("Profiler.start")
await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1500)
const { profile } = await cdp.send("Profiler.stop")
const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]))
const dt = profile.timeDeltas; let i = 0
for (const s of profile.samples) { const n = byId.get(s); const k = `${n.callFrame.functionName || "(аноним)"} ${(n.callFrame.url || "").split("/").pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + (dt[i++] || 0)) }
const top = [...self.entries()].filter(([k]) => !/^\((idle|program|garbage collector)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 15)
console.log("Запуск (мс, процессор ×4):"); console.table(runs)
console.log("Больше всего времени при запуске (собственное время функции, мс):")
for (const [k, v] of top) console.log(`  ${Math.round(v / 1000)}  ${k}`)
const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1]
console.log("PERF " + JSON.stringify({ ready: med(runs.map(r => r.ready)), script: med(runs.map(r => r.script)), style: med(runs.map(r => r.style)), layout: med(runs.map(r => r.layout)) }))
await browser.close(); server.close()
