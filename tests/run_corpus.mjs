import fs from "fs"
const { CORPUS } = await import(process.argv[3] || "./corpus.mjs")
const NOW = new Date(2026, 9, 22, 20, 0)
const RealDate = Date
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(NOW) } static now() { return NOW.getTime() } }
const src = fs.readFileSync(process.argv[2] || new URL("../src/iphone/MyDay.js", import.meta.url).pathname, "utf8").replace(/\/\/ ───────────── Запуск[\s\S]*$/, "")
class Color { constructor(h) { this.hex = h } static dynamic(a) { return a } static white() { return new Color("#fff") } }
const W = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"], z = n => String(n).padStart(2, "0")
class DateFormatter { set dateFormat(p) {} string(d) { return `${W[d.getDay()]} ${z(d.getDate())}.${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}` } }
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: () => true, createDirectory() {}, isFileStoredIniCloud: () => false, readString: () => "[]", writeString() {} }
const g = { Color, DateFormatter, URLScheme: { forRunningScript: () => "x" }, FileManager: { iCloud: () => fmo, local: () => fmo }, Keychain: { contains: () => false } }
const app = await new Function(...Object.keys(g), "return (async()=>{" + src + "; return { buildActions, splitCommands, normalizeSpeech } })()")(...Object.values(g))
const fmtD = d => d ? `${W[d.getDay()]} ${z(d.getDate())}.${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}` : "?"
const val = (a, f) => {
  if (f === "date") return fmtD(a.date)
  if (f === "from") return a.from ? `${z(a.from.getDate())}.${z(a.from.getMonth() + 1)}${a.fromHasTime ? " " + z(a.from.getHours()) + ":" + z(a.from.getMinutes()) : ""}` : "?"
  if (f === "to") return !a.to && !a.toTime && !a.toDay ? "?" : [a.toDay ? `${W[a.toDay.getDay()]} ${z(a.toDay.getDate())}.${z(a.toDay.getMonth() + 1)}` : "", a.toTime || ""].filter(Boolean).join(" ")
  if (f === "day") return a.day ? `${z(a.day.getDate())}.${z(a.day.getMonth() + 1)}` : "?"
  const v = a[f]; return v === undefined || v === null ? "?" : String(v).toLowerCase()
}
let pass = 0
for (const c of CORPUS) {
  let acts = []
  try { acts = app.buildActions(app.splitCommands(app.normalizeSpeech(c.t))) } catch (e) { acts = [{ kind: "ERR:" + e.message }] }
  const kinds = acts.map(a => a.kind)
  const errs = []
  if (kinds.join(",") !== c.kinds.join(",")) errs.push(`типы ${kinds.join(",")} ≠ ${c.kinds.join(",")}`)
  for (const x of c.extra || []) {
    const k = x.slice(0, x.indexOf(":")), rest = x.slice(x.indexOf(":") + 1); const f = rest.slice(0, rest.indexOf("=")), want = rest.slice(rest.indexOf("=") + 1)
    const a = acts.find(a => a.kind === k); const got = a ? val(a, f) : "нет действия"
    if (got !== want.toLowerCase()) errs.push(`${k}.${f}: ${got} ≠ ${want}`)
  }
  if (!errs.length) pass++
  console.log(errs.length ? "✗" : "✓", c.t, errs.length ? "\n    " + errs.join("\n    ") : "")
}
console.log(`\nИТОГО: ${pass}/${CORPUS.length}`)
