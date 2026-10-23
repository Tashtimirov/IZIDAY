// Проверка: system один на весь разговор, ошибка про thinking — повтор без «мыслей»
import fs from "fs"
const src = fs.readFileSync(new URL("../src/iphone/MyDay.js", import.meta.url), "utf8").replace(/\/\/ ───────────── Запуск[\s\S]*$/, "")
class Color { constructor(h) { this.hex = h } static dynamic(a) { return a } }
class DateFormatter { set dateFormat(p) {} string(d) { return String(d.getTime()) } }
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: () => false, createDirectory() {}, writeString() {} }
const bodies = []; let n = 0
class Request { constructor() {} async loadJSON() {
  const b = JSON.parse(this.body); bodies.push(b); n++
  if (n === 1) return { content: [{ type: "thinking", thinking: "", signature: "x" }, { type: "tool_use", id: "t1", name: "get_notes", input: {} }], stop_reason: "tool_use" }
  if (n === 2) return { error: { message: "Invalid `signature` in `thinking` block" } }
  return { content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" } } }
const g = { Color, DateFormatter, Request, URLScheme: { forRunningScript: () => "x" }, FileManager: { iCloud: () => fmo, local: () => fmo }, Keychain: { contains: () => true, get: () => "k" } }
const app = await new Function(...Object.keys(g), "return (async()=>{" + src + "; return { agentTurn, agentSystem } })()")(...Object.values(g))
const sys = "SYS"
const r = await app.agentTurn([{ role: "user", content: "hi" }], sys)
const ok = r.text === "ok" && bodies.every(b => b.system === "SYS") && !bodies[2].messages[1].content.some(c => c.type === "thinking")
console.log(ok ? "AGENT_OK" : "FAIL", r.text, bodies.map(b => b.system))
