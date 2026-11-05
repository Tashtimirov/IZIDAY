// Рисует виджет Scriptable в PNG (приближённо): дерево ListWidget/стеков → HTML → Chromium. Для макетов дизайна.
// node tests/widget_render.mjs <папка> [src/iphone/MyDay.js] [--glass]  (--glass — стеклянный фон поверх обоев)
import fs from "fs"
import path from "path"
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
const ARGS = process.argv.slice(2).filter(a => !a.startsWith("--")), GLASS = process.argv.includes("--glass")
const OUT = ARGS[0] || "/tmp/widget"
const SRC = ARGS[1] || new URL("../src/iphone/MyDay.js", import.meta.url).pathname
// время как днём: часть встреч прошла, следующая — через час с небольшим
const RealDate = Date, FAKE = new RealDate(); FAKE.setHours(14, 40, 0, 0)
globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(FAKE) } static now() { return FAKE.getTime() } }
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
// SF Symbols, нарисованные похоже (залитые, одним цветом)
const SVG = { "mic.fill": '<rect x="8.5" y="2" width="7" height="13" rx="3.5"/><path d="M5 11a1 1 0 0 1 2 0 5 5 0 0 0 10 0 1 1 0 0 1 2 0 7 7 0 0 1-6 6.93V21h3a1 1 0 0 1 0 2H8a1 1 0 0 1 0-2h3v-3.07A7 7 0 0 1 5 11z"/>',
  "camera.fill": '<path d="M9 3.5h6l1.6 2.5H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.4z"/><circle cx="12" cy="13" r="4" fill="#fff" fill-opacity=".9"/><circle cx="12" cy="13" r="2.6"/>',
  "square.and.pencil": '<path d="M5 4h8a1 1 0 0 1 0 2H6v12h12v-7a1 1 0 0 1 2 0v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L12.5 14.3 9 15l.7-3.5z"/>' }
// контурные значки похожей формы (Lucide) для SF Symbols, которых нет выше
const LUC = {"sun.max.fill":"<circle cx=\"12\" cy=\"12\" r=\"4\" /><path d=\"M12 2v2\" /><path d=\"M12 20v2\" /><path d=\"m4.93 4.93 1.41 1.41\" /><path d=\"m17.66 17.66 1.41 1.41\" /><path d=\"M2 12h2\" /><path d=\"M20 12h2\" /><path d=\"m6.34 17.66-1.41 1.41\" /><path d=\"m19.07 4.93-1.41 1.41\" />","cloud.sun.fill":"<path d=\"M12 2v2\" /><path d=\"m4.93 4.93 1.41 1.41\" /><path d=\"M20 12h2\" /><path d=\"m19.07 4.93-1.41 1.41\" /><path d=\"M15.947 12.65a4 4 0 0 0-5.925-4.128\" /><path d=\"M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z\" />","cloud.fill":"<path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\" />","cloud.fog.fill":"<path d=\"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242\" /><path d=\"M16 17H7\" /><path d=\"M17 21H9\" />","cloud.rain.fill":"<path d=\"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242\" /><path d=\"M16 14v6\" /><path d=\"M8 14v6\" /><path d=\"M12 16v6\" />","cloud.drizzle.fill":"<path d=\"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242\" /><path d=\"M8 19v1\" /><path d=\"M8 14v1\" /><path d=\"M16 19v1\" /><path d=\"M16 14v1\" /><path d=\"M12 21v1\" /><path d=\"M12 16v1\" />","cloud.heavyrain.fill":"<path d=\"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242\" /><path d=\"M16 14v6\" /><path d=\"M8 14v6\" /><path d=\"M12 16v6\" />","cloud.bolt.rain.fill":"<path d=\"M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973\" /><path d=\"m13 12-3 5h4l-3 5\" />","snowflake":"<line x1=\"2\" x2=\"22\" y1=\"12\" y2=\"12\" /><line x1=\"12\" x2=\"12\" y1=\"2\" y2=\"22\" /><path d=\"m20 16-4-4 4-4\" /><path d=\"m4 8 4 4-4 4\" /><path d=\"m16 4-4 4-4-4\" /><path d=\"m8 20 4-4 4 4\" />","car.fill":"<path d=\"M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2\" /><circle cx=\"7\" cy=\"17\" r=\"2\" /><path d=\"M9 17h6\" /><circle cx=\"17\" cy=\"17\" r=\"2\" />","fork.knife":"<path d=\"M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2\" /><path d=\"M7 2v20\" /><path d=\"M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7\" />","drop.fill":"<path d=\"M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z\" />","flame.fill":"<path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\" />","creditcard.fill":"<rect width=\"20\" height=\"14\" x=\"2\" y=\"5\" rx=\"2\" /><line x1=\"2\" x2=\"22\" y1=\"10\" y2=\"10\" />","bell.fill":"<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\" /><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\" />","circle":"<circle cx=\"12\" cy=\"12\" r=\"10\" />","figure.run":"<path d=\"M14.4 14.4 9.6 9.6\" /><path d=\"M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z\" /><path d=\"m21.5 21.5-1.4-1.4\" /><path d=\"M3.9 3.9 2.5 2.5\" /><path d=\"M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z\" />","figure.walk":"<path d=\"M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z\" /><path d=\"M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z\" /><path d=\"M16 17h4\" /><path d=\"M4 13h4\" />","checklist":"<path d=\"m3 17 2 2 4-4\" /><path d=\"m3 7 2 2 4-4\" /><path d=\"M13 6h8\" /><path d=\"M13 12h8\" /><path d=\"M13 18h8\" />","calendar":"<path d=\"M8 2v4\" /><path d=\"M16 2v4\" /><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\" /><path d=\"M3 10h18\" />","applewatch":"<circle cx=\"12\" cy=\"12\" r=\"6\" /><polyline points=\"12 10 12 12 13 13\" /><path d=\"m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05\" /><path d=\"m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05\" />"}
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
class DrawContext {
  constructor() { this.size = new Size(10, 10); this.ops = []; this.fill = ""; this.stroke = ""; this.lw = 1 }
  getImage() { return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${this.size.width}" height="${this.size.height}">${this.ops.join("")}</svg>` } }
  setFillColor(c) { this.fill = css(c) } setStrokeColor(c) { this.stroke = css(c) } setLineWidth(w) { this.lw = w }
  fillEllipse(r) { this.ops.push(`<ellipse cx="${r.x + r.width / 2}" cy="${r.y + r.height / 2}" rx="${r.width / 2}" ry="${r.height / 2}" fill="${this.fill}"/>`) }
  strokeEllipse(r) { this.ops.push(`<ellipse cx="${r.x + r.width / 2}" cy="${r.y + r.height / 2}" rx="${r.width / 2}" ry="${r.height / 2}" fill="none" stroke="${this.stroke}" stroke-width="${this.lw}"/>`) }
  fillRect(r) { this.ops.push(`<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${this.fill}"/>`) }
  addPath(p) { this.path = p } strokePath() { if (this.path) this.ops.push(`<path d="${this.path.d}" fill="none" stroke="${this.stroke}" stroke-width="${this.lw}"/>`) }
  fillPath() {} drawTextInRect() {} setFont() {} setTextColor() {} setTextAlignedCenter() {} drawImageInRect() {} drawImageAtPoint() {}
}
class Path { constructor() { this.d = "" } move(p) { this.d += `M${p.x} ${p.y}` } addLine(p) { this.d += `L${p.x} ${p.y}` } addArc() {} addEllipse() {} addRoundedRect() {} addRect() {} closeSubpath() { this.d += "Z" } }
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
    const svg = SVG[n.img.sym]
    const luc = !svg && LUC[n.img.sym]
    return `<div style="flex:0 0 auto;width:${s.width}px;height:${s.height}px;display:flex;align-items:center;justify-content:center;font-size:${s.height * 0.85}px;color:${c};line-height:1">${svg ? `<svg viewBox="0 0 24 24" width="${s.width}" height="${s.height}" fill="${c}">${svg}</svg>` : luc ? `<svg viewBox="0 0 24 24" width="${s.width}" height="${s.height}" fill="none" stroke="${c}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${luc}</svg>` : SYM[n.img.sym] || "●"}</div>`
  }
  st.push("display:flex", `flex-direction:${n.dir === "v" ? "column" : "row"}`, `align-items:${n.dir === "v" ? "flex-start" : n.align}`, "min-width:0", "box-sizing:border-box")
  if (n.dir === "v") st.push("align-items:stretch")
  if (n.spacing) st.push(`gap:${n.spacing}px`)
  if (n.pad) st.push(`padding:${n.pad.map(x => x + "px").join(" ")}`)
  if (n.backgroundColor) st.push(`background:${css(n.backgroundColor)}`)
  if (n.backgroundImage && n.backgroundImage.svg) st.push(`background:url('data:image/svg+xml;base64,${Buffer.from(n.backgroundImage.svg).toString("base64")}') center/100% 100% no-repeat`)
  if (n.backgroundImage && n.backgroundImage.glass) st.push(`background:${MODE === "light" ? "rgba(255,255,255,.42)" : "rgba(18,18,22,.42)"}`, "backdrop-filter:blur(26px) saturate(170%)", "border-radius:22px", "-webkit-backdrop-filter:blur(26px) saturate(170%)", `box-shadow:inset 0 0 0 .5px ${MODE === "light" ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.14)"}`)
  else if (n.backgroundGradient && n.backgroundGradient.colors) st.push(`background:linear-gradient(${n.backgroundGradient.startPoint ? "135deg," : ""}${n.backgroundGradient.colors.map(css).join(",")})`)
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
  "/d/my-day/settings.json": JSON.stringify({ sheetHook: "https://script.google.com/x/exec", glass: GLASS ? { small: "top-left", medium: "top", large: "top" } : {} }),
  "/d/my-day/workouts.json": JSON.stringify([{ id: "t1", date: D(7).getTime(), title: "Падел", minutes: 90, kcal: 0 }]),
  "/d/my-day/travel.json": JSON.stringify([{ start: D(16).getTime(), t: "Показ квартиры, Сукхумвит 24", min: 25, buf: 10 }]),
}
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: p => p in files || p === "/d/my-day" || GLASS && /my-day-glass\//.test(p), createDirectory() {}, isFileStoredIniCloud: () => false,
  downloadFileFromiCloud: async () => {}, modificationDate: () => now, readString: p => files[p], listContents: () => [],
  readImage: () => ({ glass: true }), writeImage() {}, writeString: (p, s) => { files[p] = s }, remove() {} }
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
    return {} } async loadString() { return "" } }, Device: { screenScale: () => 3, screenSize: () => ({ width: 430, height: 932 }), locale: () => "ru_RU", isUsingDarkAppearance: () => MODE === "dark" },
  Location: { current: async () => ({ latitude: 13.73, longitude: 100.56 }), setAccuracyToHundredMeters() {}, setAccuracyToThreeKilometers() {} }, Script: { name: () => "MyDay", setWidget() {}, complete() {} },
  config: { runsInWidget: true, widgetFamily: "medium" }, args: { queryParameters: {}, widgetParameter: null }, Data: {}, Image: {}, Timer: { schedule: (ms, rep, f) => setTimeout(f, ms) }, WebView: class {}, UITable: class {}, Alert: class {}, QuickLook: {}, Pasteboard: {} }
const app = await new Function(...Object.keys(g), "return (async()=>{" + src + "; return { buildWidget } })()")(...Object.values(g))
const SIZES = { small: [170, 170], medium: [364, 170], large: [364, 382] }
const list = [["large"], ["medium"], ["medium", "здоровье"], ["small"], ["small", "здоровье"]]
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
  const bg = !GLASS ? (mode === "light" ? "linear-gradient(160deg,#9FB7D9,#E8D3C4)" : "linear-gradient(160deg,#1b2433,#2a1f2b)")
    : mode === "light" ? "radial-gradient(60% 50% at 15% 10%,#F6C8A8 0%,transparent 70%),radial-gradient(55% 45% at 90% 30%,#9EC5F0 0%,transparent 70%),radial-gradient(60% 50% at 30% 85%,#B9E4CF 0%,transparent 70%),radial-gradient(50% 45% at 85% 90%,#D8C3F0 0%,transparent 70%),#EDE7E1"
    : "radial-gradient(60% 50% at 15% 10%,#5B2A4E 0%,transparent 70%),radial-gradient(55% 45% at 90% 30%,#1E3F73 0%,transparent 70%),radial-gradient(60% 50% at 30% 85%,#0F4A3A 0%,transparent 70%),radial-gradient(50% 45% at 85% 90%,#3A2468 0%,transparent 70%),#0C0D14"
  await page.setContent(`<!doctype html><meta charset=utf-8><style>body{margin:0;padding:24px;background:${bg};font-family:-apple-system,Inter,system-ui,sans-serif}
    .grid{display:flex;flex-wrap:wrap;gap:22px;align-items:flex-start;width:780px} figure{margin:0} .w{border-radius:22px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.18)}
    figcaption{color:#fff;font-size:12px;text-align:center;margin-top:6px;opacity:.85}</style><div class="grid">${cells.join("")}</div>`)
  const file = path.join(OUT, `widget-${mode}.png`)
  await page.screenshot({ path: file, fullPage: true })
  shots.push(file)
}
await browser.close()
console.log(shots.join("\n"))
