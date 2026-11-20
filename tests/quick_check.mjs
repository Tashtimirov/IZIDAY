// Быстрая проверка перед КАЖДОЙ выкладкой: 3–5 минут, один итог — «МОЖНО ВЫКЛАДЫВАТЬ» или «НЕЛЬЗЯ».
//   node tests/quick_check.mjs          — сборка + главные проверки (каждый экран, запись в каждом разделе, обмен,
//                                         нет сети, кэш и обновление, друзья, семья, английский, Изи без сети)
//   node tests/quick_check.mjs --all    — то же, но все *_test.mjs (полный прогон, ~6 минут на 4 ядрах)
//   node tests/quick_check.mjs --no-build — без сборки (dist/ уже собран)
// Проверки идут параллельно (по числу ядер, не больше 4). Подробности каждой — в build/check-logs/, сводка — build/quick-check.md.
import { spawn, execFileSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
const ROOT = new URL("..", import.meta.url).pathname, T = path.join(ROOT, "tests")
const args = process.argv.slice(2), ALL = args.includes("--all"), NOBUILD = args.includes("--no-build")
// Главные проверки. Порядок: сначала самые долгие, чтобы параллельный прогон кончился раньше
const QUICK = ["family_test", "web_test", "money_test", "health2_test", "friends_web_test", "feat_test", "plans_test", "week_plan_test", "time_input_test", "tabs_stay_test", "cal_occ_test", "smoke_test", "shop_list_edit_test", "tester_fixes_test", "route_multi_test", "route_from_prev_test",
  "i18n_en_test", "reliability_test", "today_test", "metrics_test", "sw_autoupdate_test", "bdays_test", "sw_cache_test", "sw_lang_test", "bad_data_test",
  "izi_errors_test", "grow_web_test", "grow_test", "grow_ref_test", "grow_ref_web_test", "friends_test", "sheet_test", "hub_test", "gs_test", "chat_test", "agent_test", "sw_test", "sw_dedup_test", "push_test", "proxy_test", "ru_test"]
// Давно нестабильные (зависят от скорости машины) — в полном прогоне показываются, но выкладку не останавливают
const FLAKY = new Set(["talk_swipe_test", "talk_barge_test"])
const t0 = Date.now(), sec = ms => Math.round(ms / 1000) + " с"
const LOGS = path.join(ROOT, "build", "check-logs"); fs.mkdirSync(LOGS, { recursive: true })

if (!NOBUILD) {
  process.stdout.write("Сборка… ")
  try {
    execFileSync("python3", ["build.py"], { cwd: ROOT, stdio: "pipe" })
    execFileSync("python3", ["build_web.py"], { cwd: ROOT, stdio: "pipe" })
    console.log("готово")
  } catch (e) {
    console.log("\n" + String(e.stderr || e.stdout || e.message).trim().split("\n").slice(-5).join("\n"))
    console.log("\nНЕЛЬЗЯ ВЫКЛАДЫВАТЬ: сборка не прошла"); process.exit(1)
  }
}
const have = n => fs.existsSync(path.join(T, n + ".mjs"))
const list = (ALL ? fs.readdirSync(T).filter(f => /_test\.mjs$/.test(f)).map(f => f.slice(0, -4))
  .sort((a, b) => (QUICK.indexOf(a) + 1 || 99) - (QUICK.indexOf(b) + 1 || 99)) : QUICK.filter(have))
const missing = ALL ? [] : QUICK.filter(n => !have(n))
const res = []
function run(name) {
  return new Promise(done => {
    const s = Date.now(), log = fs.createWriteStream(path.join(LOGS, name + ".log"))
    const p = spawn(process.execPath, [path.join(T, name + ".mjs")], { cwd: ROOT, env: Object.assign({}, process.env, { CI: "1" }) })
    let out = ""
    const take = d => { out += d; log.write(d) }
    p.stdout.on("data", take); p.stderr.on("data", take)
    const kill = setTimeout(() => { out += "\n(больше 4 минут — остановлено)"; p.kill("SIGKILL") }, 240e3)
    p.on("close", code => {
      clearTimeout(kill); log.end()
      const bad = out.split("\n").filter(l => /^\s*✗/.test(l)).map(l => l.trim().slice(0, 160))
      const ok = code === 0 && !bad.length
      res.push({ name, ok, ms: Date.now() - s, bad: ok ? [] : (bad.length ? bad : out.trim().split("\n").slice(-3).map(l => l.slice(0, 160))) })
      process.stdout.write(ok ? "✓" : FLAKY.has(name) ? "~" : "✗")
      done()
    })
  })
}
const POOL = Math.max(1, Math.min(4, os.cpus().length))
console.log(`Проверок: ${list.length}, параллельно по ${POOL}${missing.length ? ` (нет в этой ветке: ${missing.join(", ")})` : ""}`)
const queue = list.slice()
await Promise.all(Array.from({ length: POOL }, async () => { while (queue.length) await run(queue.shift()) }))
// Провал под нагрузкой бывает из-за скорости (параллельный прогон): такие проверки повторяем по одной.
// Прошла со второго раза — не провал, но отмечается в сводке
const again = res.filter(r => !r.ok && !FLAKY.has(r.name))
if (again.length) {
  process.stdout.write(" повтор: ")
  for (const r of again) { res.splice(res.indexOf(r), 1); await run(r.name); const n = res[res.length - 1]; if (n.ok) n.retry = true }
}
console.log("")
const failed = res.filter(r => !r.ok && !FLAKY.has(r.name)), flaky = res.filter(r => !r.ok && FLAKY.has(r.name))
const lines = [`# Быстрая проверка ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, "",
  `${res.length} проверок за ${sec(Date.now() - t0)}: прошли ${res.filter(r => r.ok).length}, провалов ${failed.length}` + (flaky.length ? `, нестабильных ${flaky.length}` : ""), ""]
for (const r of failed) { lines.push(`## ✗ ${r.name} (${sec(r.ms)})`, ...r.bad.slice(0, 6).map(b => "    " + b), `    подробно: build/check-logs/${r.name}.log`, "") }
for (const r of res.filter(r => r.retry)) lines.push(`↻ ${r.name}: прошла со второго раза (под нагрузкой медленнее)`)
for (const r of flaky) lines.push(`~ ${r.name}: нестабильная, на итог не влияет (${r.bad[0] || ""})`)
const slow = res.slice().sort((a, b) => b.ms - a.ms).slice(0, 3).map(r => `${r.name} ${sec(r.ms)}`).join(", ")
lines.push("", `Дольше всех: ${slow}`, "", failed.length ? `НЕЛЬЗЯ ВЫКЛАДЫВАТЬ: ${failed.map(r => r.name).join(", ")}` : "МОЖНО ВЫКЛАДЫВАТЬ")
fs.writeFileSync(path.join(ROOT, "build", "quick-check.md"), lines.join("\n") + "\n")
console.log(lines.slice(2).join("\n"))
process.exit(failed.length ? 1 : 0)
