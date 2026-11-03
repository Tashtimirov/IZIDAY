// Рисует виджет Scriptable в PNG (приближённо): дерево ListWidget/стеков → HTML → Chromium. Для макетов дизайна.
// node tests/widget_render.mjs <папка> [src/iphone/MyDay.js]
import fs from "fs"
import path from "path"
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
const OUT = process.argv[2] || "/tmp/widget"
const SRC = process.argv[3] || new URL("../src/iphone/MyDay.js", import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const full = fs.readFileSync(SRC, "utf8")
const src = full.replace(/\/\/ ───────────── Запуск[\s\S]*$/, "")
let MODE = "light"
const z = n => String(n).padStart(2, "0")
class Color {
  constructor(h, a = 1) { this.hex = h; this.alpha = a }
  static dynamic(l, d) { const c = new Color("#000"); c.dyn = [l, d]; return c }
  static white() { return new Color("#FFFFFF") } static black() { return new Color("#000000") } static clear() { return new Color("#000000", 0) }
  css() {
    if (this.dyn) return (MODE === "light" ? this.dyn[0] : this.dyn[1]).css()
    let h = this.hex.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join("")
    const a = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a * this.alpha})`
  }
}
const css = c => c && c.css ? c.css() : ""
class Size { constructor(w, h) { this.width = w; this.height = h } }
class Point { constructor(x, y) { this.x = x; this.y = y } }
const F = (w, r) => s => ({ size: s, weight: w, rounded: r })
class Font { constructor(name, size) { return { size, weight: /Bold/.test(name) ? 700 : 400, serif: /Georgia|Times|Serif/i.test(name) } } }
Object.assign(Font, { systemFont: F(400), mediumSystemFont: F(500), semiboldSystemFont: F(600), boldSystemFont: F(700), heavySystemFont: F(800),
  regularRoundedSystemFont: F(400, 1), mediumRoundedSystemFont: F(500, 1), semiboldRoundedSystemFont: F(600, 1), boldRoundedSystemFont: F(700, 1),
  heavyRoundedSystemFont: F(800, 1), lightSystemFont: F(300), ultraLightSystemFont: F(200), title1: () => F(700)(28), headline: () => F(600)(17),
  body: () => F(400)(17), caption1: () => F(400)(12), caption2: () => F(400)(11), footnote: () => F(400)(13), subheadline: () => F(400)(15) })
const SYM = { "mic.fill": "🎙", "camera.fill": "📷", "tablecells.fill": "▦", checklist: "☑", "bubble.left.and.bubble.right.fill": "💬", "square.and.pencil": "✎", keyboard: "⌨︎",
  calendar: "📅", "checkmark.circle": "✓", "drop.fill": "💧", "flame.fill": "🔥", "figure.walk": "🚶", "fork.knife": "🍴", "banknote": "฿", "bahtsign.circle.fill": "฿" }
const SFSymbol = { named: n => ({ image: { sym: n } }) }
class Node {
  constructor(kind) { this.kind = kind; this.kids = []; this.dir = kind === "widget" ? "v" : "h"; this.align = "center"; this.pad = null; this.spacing = 0 }
  addStack() { const s = new Node("stack"); this.kids.push(s); return s }
  addText(t) { const s = new Node("text"); s.text = String(t); this.kids.push(s); return s }
  addDate(d) { return this.addText(z(d.getHours()) + ":" + z(d.getMinutes())) }
  addImage(img) { const s = new Node("image"); s.img = img; this.kids.push(s); return s }
  addSpacer(n) { const s = new Node("spacer"); s.len = n; this.kids.push(s); return s }
  layoutVertically() { this.dir = "v" } layoutHorizontally() { this.dir = "h" }
  centerAlignContent() { this.align = "center" } topAlignContent() { this.align = "flex-start" } bottomAlignContent() { this.align = "flex-end" }
  setPadding(t, l, b, r) { this.pad = [t, r, b, l] } useDefaultPadding() {}
  centerAlignText() { this.talign = "center" } rightAlignText() { this.talign = "right" } leftAlignText() { this.talign = "left" }
  applyFillingContentMode() {} applyFittingContentMode() {} centerAlignImage() {}
}
class ListWidget extends Node { constructor() { super("widget") } async presentSmall() {} async presentMedium() {} async presentLarge() {} }
class LinearGradient { }
class DrawContext { constructor() { this.size = new Size(10, 10) } getImage() { return { sym: "" } } setFillColor() {} fillEllipse() {} fillRect() {} setStrokeColor() {} setLineWidth() {} strokeEllipse() {} addPath() {} strokePath() {} fillPath() {} drawTextInRect() {} setFont() {} setTextColor() {} setTextAlignedCenter() {} drawImageInRect() {} }
class Path { move() {} addLine() {} addArc() {} addEllipse() {} addRoundedRect() {} addRect() {} closeSubpath() {} }
class Rect { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }) } }

function html(n, parentDir) {
  const st = []
  if (n.kind === "spacer") return n.len == null ? `<div style="flex:1 1 0"></div>` : `<div style="flex:0 0 ${n.len}px"></div>`
  if (n.kind === "text") {
    const f = n.font || { size: 17, weight: 400 }
    st.push(`font-size:${f.size}px`, `font-weight:${f.weight}`, `font-family:${f.serif ? "Georgia,serif," : f.rounded ? "'SF Pro Rounded','Nunito'," : ""}-apple-system,'Inter',system-ui,sans-serif`,
      `color:${css(n.textColor) || (MODE === "light" ? "#000" : "#fff")}`, `opacity:${n.textOpacity ?? 1}`, `text-align:${n.talign || "left"}`, "white-space:pre-wrap", "line-height:1.18", "min-width:0")
    if (n.lineLimit) st.push("display:-webkit-box", `-webkit-line-clamp:${n.lineLimit}`, "-webkit-box-orient:vertical", "overflow:hidden")
    if (parentDir === "v") st.push("align-self:stretch")
    return `<div style="${st.join(";")}">${n.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`
  }
  if (n.kind === "image") {
    const s = n.imageSize || new Size(16, 16), c = css(n.tintColor) || "currentColor"
    return `<div style="flex:0 0 auto;width:${s.width}px;height:${s.height}px;display:flex;align-items:center;justify-content:center;font-size:${s.height * 0.85}px;color:${c};line-height:1">${SYM[n.img.sym] || "●"}</div>`
  }
  st.push("display:flex", `flex-direction:${n.dir === "v" ? "column" : "row"}`, `align-items:${n.dir === "v" ? "flex-start" : n.align}`, "min-width:0", "box-sizing:border-box")
  if (n.dir === "v") st.push("align-items:stretch")
  if (n.spacing) st.push(`gap:${n.spacing}px`)
  if (n.pad) st.push(`padding:${n.pad.map(x => x + "px").join(" ")}`)
  if (n.backgroundColor) st.push(`background:${css(n.backgroundColor)}`)
  if (n.backgroundGradient && n.backgroundGradient.colors) st.push(`background:linear-gradient(${n.backgroundGradient.colors.map(css).join(",")})`)
  if (n.cornerRadius) st.push(`border-radius:${n.cornerRadius}px`, "overflow:hidden")
  if (n.borderWidth) st.push(`border:${n.borderWidth}px solid ${css(n.borderColor)}`)
  if (n.size) { if (n.size.width) st.push(`width:${n.size.width}px`, "flex:0 0 auto"); if (n.size.height) st.push(`height:${n.size.height}px`) }
  if (n.kind === "widget") st.push("width:100%", "height:100%", `padding:${(n.pad || [16, 16, 16, 16]).map(x => x + "px").join(" ")}`)
  return `<div style="${st.join(";")}">${n.kids.map(k => html(k, n.dir)).join("")}</div>`
}

// данные: сегодняшний день как у Ильдара
const now = new Date(), D = (h, m = 0, dd = 0) => { const d = new Date(now); d.setDate(d.getDate() + dd); d.setHours(h, m, 0, 0); return d }
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
const dk = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
const files = {
  "/d/my-day/finance.json": JSON.stringify([{ id: "a", date: D(9).getTime(), type: "expense", amount: 450, method: "transfer", category: "Кафе и рестораны" },
    { id: "b", date: D(12).getTime(), type: "expense", amount: 1200, method: "transfer", category: "Продукты" }]),
  "/d/my-day/food.json": JSON.stringify([{ id: "m1", date: D(8, 30).getTime(), title: "Омлет", kcal: 420, protein: 25 }, { id: "m2", date: D(13).getTime(), title: "Том ям", kcal: 610, protein: 30 }]),
  "/d/my-day/water.json": JSON.stringify([{ id: "w1", date: D(9).getTime(), ml: 250 }, { id: "w2", date: D(11).getTime(), ml: 500 }, { id: "w3", date: D(14).getTime(), ml: 250 }]),
  "/d/my-day/health.json": JSON.stringify({ day: dk(now), steps: 6420, active: 340, exercise: 24, distance: 4.7, sleep: 7.2 }),
  "/d/my-day/rems.json": JSON.stringify([{ id: "r1", date: 1, u: 1, title: "Оплатить аренду", due: iso(D(18)) }, { id: "r2", date: 1, u: 1, title: "Позвонить застройщику", due: dk(now) },
    { id: "r3", date: 1, u: 1, title: "Купить подарок Алие", due: null }]),
  "/d/my-day/settings.json": JSON.stringify({ sheetHook: "https://script.google.com/x/exec" }),
}
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: p => p in files || p === "/d/my-day", createDirectory() {}, isFileStoredIniCloud: () => false,
  downloadFileFromiCloud: async () => {}, modificationDate: () => now, readString: p => files[p], writeString: (p, s) => { files[p] = s }, remove() {} }
const cal = t => ({ title: t, color: { hex: "0A84FF" } })
const store = [
  { title: "Планерка PTP", startDate: D(9), endDate: D(9, 30), calendar: cal("PTP") },
  { title: "Показ квартиры, Сукхумвит 24", startDate: D(16), endDate: D(17), calendar: cal("PTP"), location: "Сукхумвит 24" },
  { title: "Падел", startDate: D(19), endDate: D(20, 30), calendar: cal("Личное") },
  { title: "Оперативка с коллегами", startDate: D(10, 0, 1), endDate: D(11, 0, 1), calendar: cal("PTP") },
  { title: "Йога", startDate: D(8, 0, 2), endDate: D(9, 0, 2), calendar: cal("Личное") },
  { title: "Ужин с семьёй", startDate: D(19, 0, 3), endDate: D(21, 0, 3), calendar: cal("Семейная группа") },
]
class CalendarEvent { static async between(a, b) { return store.filter(e => e.startDate < b && e.endDate > a).map(e => Object.assign({ identifier: e.title, isAllDay: false }, e)) } }
class Reminder { static async allIncomplete() { return [] } static async allCompleted() { return [] } }
const Keychain = { contains: () => false, get: () => "", set() {} }
const g = { Color, Size, Point, Font, SFSymbol, ListWidget, LinearGradient, DrawContext, Path, Rect, CalendarEvent, Reminder, Keychain,
  DateFormatter: class { set dateFormat(p) { this.p = p } set locale(l) {} useNoDateStyle() {} useShortTimeStyle() {}
    string(d0) { const d = new Date(d0), WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"], MO = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
      const p = this.p || "HH:mm"; if (isNaN(d)) return ""
      return p.replace(/EEEE/g, WD[d.getDay()]).replace(/EEE|EE/g, WD[d.getDay()].slice(0, 2)).replace(/MMMM/g, MO[d.getMonth()]).replace(/MM/g, z(d.getMonth() + 1))
        .replace(/HH/g, z(d.getHours())).replace(/mm/g, z(d.getMinutes())).replace(/dd/g, z(d.getDate())).replace(/\bd\b/g, d.getDate()).replace(/yyyy/g, d.getFullYear()) } },
  URLScheme: { forRunningScript: () => "scriptable:///run/MyDay" }, FileManager: { iCloud: () => fmo, local: () => fmo },
  Calendar: { forEvents: async () => [], forReminders: async () => [] }, Notification: class { static async allPending() { return [] } async schedule() {} setTriggerDate() {} addAction() {} },
  Safari: { open() {} }, Request: class { constructor(u) { this.u = u } async loadJSON() {
    if (/open-meteo/.test(this.u)) { const t = [], c = [0, 2, 3, 61, 80, 1, 95, 2, 0, 3], tt = [33, 32, 31, 29, 30, 32, 28, 31, 33, 32]
      for (let i = 0; i < 10; i++) t.push(dk(new Date(now.getTime() + i * 864e5))); return { daily: { time: t, weather_code: c, temperature_2m_max: tt } } }
    return {} } async loadString() { return "" } }, Device: { locale: () => "ru_RU", isUsingDarkAppearance: () => MODE === "dark" },
  Location: { current: async () => ({ latitude: 13.73, longitude: 100.56 }), setAccuracyToHundredMeters() {}, setAccuracyToThreeKilometers() {} }, Script: { name: () => "MyDay", setWidget() {}, complete() {} },
  config: { runsInWidget: true, widgetFamily: "medium" }, args: { queryParameters: {}, widgetParameter: null }, Data: {}, Image: {}, Timer: { schedule: (ms, rep, f) => setTimeout(f, ms) }, WebView: class {}, UITable: class {}, Alert: class {}, QuickLook: {}, Pasteboard: {} }
const app = await new Function(...Object.keys(g), "return (async()=>{" + src + "; return { buildWidget } })()")(...Object.values(g))
const SIZES = { small: [170, 170], medium: [364, 170], large: [364, 382] }
const list = [["large"], ["medium"], ["small"], ["medium", "здоровье"]]
const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 820, height: 400 } })
const shots = []
for (const mode of ["light", "dark"]) {
  MODE = mode
  const cells = []
  for (const [fam, p] of list) {
    const w = await app.buildWidget(fam, p)
    const [W, H] = SIZES[fam]
    cells.push(`<figure><div class="w" style="width:${W}px;height:${H}px">${html(w)}</div><figcaption>${fam}${p ? " · " + p : ""}</figcaption></figure>`)
  }
  const bg = mode === "light" ? "linear-gradient(160deg,#9FB7D9,#E8D3C4)" : "linear-gradient(160deg,#1b2433,#2a1f2b)"
  await page.setContent(`<!doctype html><meta charset=utf-8><style>body{margin:0;padding:24px;background:${bg};font-family:-apple-system,Inter,system-ui,sans-serif}
    .grid{display:flex;flex-wrap:wrap;gap:22px;align-items:flex-start;width:780px} figure{margin:0} .w{border-radius:22px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.18)}
    figcaption{color:#fff;font-size:12px;text-align:center;margin-top:6px;opacity:.85}</style><div class="grid">${cells.join("")}</div>`)
  const file = path.join(OUT, `widget-${mode}.png`)
  await page.screenshot({ path: file, fullPage: true })
  shots.push(file)
}
await browser.close()
console.log(shots.join("\n"))
