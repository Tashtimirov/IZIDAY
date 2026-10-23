// Общий доступ друзей к Claude: виджет без своего ключа идёт через Google-скрипт, скрипт держит лимиты
import fs from "fs"
let fail = 0
const check = (name, ok, got) => { console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + JSON.stringify(got)}`); if (!ok) fail++ }

// 1. Виджет (версия для Таиланда) с подставленной ссылкой общего доступа
const src = fs.readFileSync(new URL("../dist/MyDay-TH.js", import.meta.url), "utf8")
  .replace(/\/\/ ───────────── Запуск[\s\S]*$/, "").replace(/aiProxy: "[^"]*"/, 'aiProxy: "https://script.google.com/macros/s/P/exec"')
const token = (src.match(/aiProxyToken: "([^"]*)"/) || [])[1]
class Color { constructor(h) { this.hex = h } static dynamic(a) { return a } }
class DateFormatter { set dateFormat(p) {} string(d) { return "" } }
const fmo = { joinPath: (a, b) => a + "/" + b, documentsDirectory: () => "/d", fileExists: () => false, createDirectory() {}, isFileStoredIniCloud: () => false, readString: () => "[]", writeString() {} }
const keys = {}, sent = []
const Keychain = { contains: k => k in keys, get: k => keys[k], set: (k, v) => { keys[k] = v }, remove: k => { delete keys[k] } }
class Request { constructor(url) { this.url = url } async loadJSON() { sent.push(this); return { content: [{ type: "text", text: "работает" }], stop_reason: "end_turn" } } }
const g = { Color, DateFormatter, Request, Keychain, URLScheme: { forRunningScript: () => "x" }, FileManager: { iCloud: () => fmo, local: () => fmo } }
const app = await new Function(...Object.keys(g), "return (async()=>{" + src + "; return { callClaude, aiReady } })()")(...Object.values(g))
check("без своего ключа ассистент доступен", app.aiReady())
await app.callClaude([{ role: "user", content: "привет" }], "SYS")
let b = JSON.parse(sent[0].body)
check("запрос идёт в Google-скрипт с паролем и id телефона", sent[0].url.includes("script.google.com") && b.token === token && token.length === 32 &&
  /^[a-z0-9]{24}$/.test(b.device) && b.body.messages[0].content === "привет" && !sent[0].headers["x-api-key"], { url: sent[0].url, b })
await app.callClaude([{ role: "user", content: "ещё" }], "SYS")
check("id телефона постоянный", JSON.parse(sent[1].body).device === b.device)
keys["myday.anthropic.key"] = "sk-own"
await app.callClaude([{ role: "user", content: "свой" }], "SYS")
check("свой ключ важнее общего доступа", sent[2].url === "https://api.anthropic.com/v1/messages" && sent[2].headers["x-api-key"] === "sk-own")

// 2. Скрипт общего доступа (dist/Proxy.gs) на поддельном Google
const code = fs.readFileSync(new URL("../dist/Proxy.gs", import.meta.url), "utf8")
const props = { ANTHROPIC_KEY: "sk-owner" }, fetched = []
const gs = new Function("PropertiesService", "LockService", "UrlFetchApp", "ContentService", "Utilities", code + "; return { doPost }")(
  { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v }, getKeys: () => Object.keys(props), deleteProperty: k => { delete props[k] } }) },
  { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  { fetch: (url, o) => { fetched.push({ url, o }); return { getContentText: () => '{"content":[{"type":"text","text":"ok"}]}' } } },
  { createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }), MimeType: { JSON: 1 } },
  { formatDate: () => "2026-10-23" })
const post = r => gs.doPost({ postData: { contents: JSON.stringify(r) } })
const body = { model: "claude-opus-5-5", max_tokens: 100000, messages: [{ role: "user", content: "hi" }] }
check("чужой пароль — отказ", post({ token: "x", device: "abcdefgh", body }).error.message === "forbidden" && fetched.length === 0)
let r = post({ token, device: "abcdefgh", body })
const sentBody = JSON.parse(fetched[0].o.payload)
check("ключ владельца, модель и лимит ответа задаёт скрипт", r.content && fetched[0].o.headers["x-api-key"] === "sk-owner" &&
  sentBody.model === "claude-sonnet-5-5" && sentBody.max_tokens === 4000, sentBody)
for (let i = 1; i < 40; i++) post({ token, device: "abcdefgh", body })
r = post({ token, device: "abcdefgh", body })
check("41-й запрос за день с телефона — лимит", /лимит/.test(r.error && r.error.message) && fetched.length === 40, fetched.length)
check("другой телефон работает", !!post({ token, device: "zzzzzzzz", body }).content)
props["n:2026-10-22:abcdefgh"] = "40"
post({ token, device: "zzzzzzzz", body })
check("вчерашние счётчики удаляются", !("n:2026-10-22:abcdefgh" in props))
console.log(fail ? `PROXY_FAIL ${fail}` : "PROXY_OK")
process.exit(fail ? 1 : 0)
