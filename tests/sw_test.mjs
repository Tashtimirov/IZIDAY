// Уведомления: заголовок — суть подсказки (не «IZIDAY»), подсказка открывает чат с ней и микрофоном
import fs from "fs"
const src = fs.readFileSync(new URL("../src/web/sw.js", import.meta.url), "utf8")
const pretty = new Function(src.slice(src.indexOf("const EMO"), src.indexOf('self.addEventListener("push"')) + "; return pretty")()
let ok = true
const check = (c, msg, got) => { console.log((c ? "✓ " : "✗ ") + msg + (c ? "" : "  → " + JSON.stringify(got))); ok = ok && !!c }
let p = pretty({ title: "💡 IZIDAY", body: "Ужин: осталось около 1400 ккал, сделай упор на белок. И ещё стакан воды." })
check(p.t === "🍽 Ужин" && p.b.startsWith("Осталось около 1400"), "«Ужин: …» → заголовок «🍽 Ужин»", p)
p = pretty({ title: "", body: "Пора размяться. Ты сидишь уже 3 часа, пройдись 10 минут." })
check(p.t === "💡 Пора размяться" && p.b.startsWith("Ты сидишь"), "первое предложение — заголовок", p)
p = pretty({ title: "IZIDAY", body: "Выпей стакан воды" })
check(p.t === "💧 Выпей стакан воды" && p.b === "", "короткая — целиком в заголовок", p)
p = pretty({ title: "🚗 Пора выезжать", body: "«Школа» в 15:00" })
check(p.t === "🚗 Пора выезжать" && p.b === "«Школа» в 15:00", "свой заголовок не трогаем", p)
check(/#reply=/.test(src) && /#chat\$\/\.test/.test(src), "подсказка ведёт в чат с ответом голосом")
console.log(ok ? "SW_OK" : "SW_FAIL"); process.exit(ok ? 0 : 1)
