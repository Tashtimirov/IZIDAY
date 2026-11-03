// Самообновление виджета: w.json на сайте — общий код без личного блока; виджет вставляет свой блок
// и получает ровно новую личную сборку. Испорченный или чужой пакет не принимается. Ключей в w.json нет
import fs from "fs"
let ok = true
const check = (c, msg, got) => { console.log(c ? "✓" : "✗", msg, c ? "" : JSON.stringify(got).slice(0, 200)); ok = ok && !!c }
const root = new URL("..", import.meta.url).pathname
const mine = fs.readFileSync(root + "dist/MyDay.js", "utf8")
const w = JSON.parse(fs.readFileSync(root + "dist/web/w.json", "utf8"))
const pick = name => { const i = mine.indexOf(name); return mine.slice(i, mine.indexOf("\n}\n", i) + 2) }
const lib = mine.slice(mine.indexOf("const P_START"), mine.indexOf("async function selfUpdate"))
const { mergeUpdate, fnv32 } = new Function(lib + "; return { mergeUpdate, fnv32 }")()

check(w.build && mine.includes(`const BUILD = "${w.build}"`), "номер сборки в w.json совпадает с личной сборкой", w.build)
check(w.code.length === w.len && fnv32(w.code) === w.sum, "длина и контрольная сумма считаются одинаково в Python и JS")
check(!/sheetSecret: "[^_"]/.test(w.code) && !/sk-ant-oat01-[\w-]{20,}/.test(w.code) && !w.code.includes("ЛИЧНЫЕ НАСТРОЙКИ (начало)"), "в w.json нет личного блока и ключей")

// старая версия виджета: другой номер сборки и чуть другой код — личный блок тот же
const old = mine.replace(`const BUILD = "${w.build}"`, 'const BUILD = "000000000000"').replace("// ───────────── Запуск ─────────────", "// старый код\n// ───────────── Запуск ─────────────")
const merged = mergeUpdate(w, old)
check(merged === mine, "старый виджет + w.json = ровно новая личная сборка", merged && merged.length)

check(mergeUpdate(Object.assign({}, w, { sum: w.sum ^ 1 }), old) === null, "испорченная сумма — не принимается")
check(mergeUpdate(Object.assign({}, w, { code: w.code + " " }), old) === null, "изменённый код — не принимается")
check(mergeUpdate(w, "нет личного блока") === null, "файл без личного блока — не трогаем")
const bad = w.code.replace(`const BUILD = "${w.build}"`, 'const BUILD = "ffffffffffff"')
check(mergeUpdate(Object.assign({}, w, { code: bad, len: bad.length, sum: fnv32(bad) }), old) === null, "номер сборки внутри не совпадает — не принимается")

// личный блок со своими значениями переносится как есть
const custom = old.replace('eventAlertMinutes: 10,', 'eventAlertMinutes: 7,')
const m2 = mergeUpdate(w, custom)
check(m2 && m2.includes("eventAlertMinutes: 7,") && m2.includes(`const BUILD = "${w.build}"`), "свои настройки из личного блока сохраняются")
check(/for \(const \[k, v\] of Object\.entries\(\{ selfUpdate: "" \}\)\)/.test(mine), "у новых настроек есть значения по умолчанию")
void pick
console.log(ok ? "\nSELFUPDATE_OK" : "\nSELFUPDATE_FAIL")
process.exit(ok ? 0 : 1)
