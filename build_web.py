#!/usr/bin/env python3
"""Собирает веб-приложение «Мой день» для iPhone: dist/web/ (выкладывается на GitHub Pages как есть).

Общее ядро (разбор речи, деньги, отчёты) вырезается из src/iphone/MyDay.js с настройками profile-th.js —
в сайте нет ни личных ссылок, ни ключей. Личное (ключ Claude, таблица, категории, календари, маршруты)
приложение получает от виджета кодом подключения и хранит только на телефоне.

  python3 build_web.py            → dist/web/ (сжатый код)
  python3 build_web.py --no-minify → dist/web/ как есть, для отладки
"""
import hashlib, re, shutil, subprocess, sys, pathlib, tempfile

ROOT = pathlib.Path(__file__).resolve().parent
WEB = ROOT / "src/web"
OUT = ROOT / "dist/web"
START, END = "// ═══ ЛИЧНЫЕ НАСТРОЙКИ (начало)", "// ═══ ЛИЧНЫЕ НАСТРОЙКИ (конец) ═══\n"

def run(*cmd):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"Ошибка: {' '.join(map(str, cmd[:2]))}\n{r.stdout}\n{r.stderr}")
    return r.stdout

shutil.rmtree(OUT, ignore_errors=True)
shutil.copytree(WEB, OUT, ignore=shutil.ignore_patterns("tools"))

src = (ROOT / "src/iphone/MyDay.js").read_text()
i, j = src.index(START), src.index(END) + len(END)
prof = (ROOT / "src/iphone/profile-th.js").read_text().replace("__AI_PROXY_TOKEN__", "").replace("__AI_PROXY__", "")
full = src[:i] + prof + src[j:]
full = re.sub(r"[ \t]*// \[личное ▼\][\s\S]*?// \[личное ▲\]\n", "", full)
full = "".join(l for l in full.splitlines(True) if "[личное]" not in l)
with tempfile.TemporaryDirectory() as tmp:
    a, b = pathlib.Path(tmp, "MyDay.js"), pathlib.Path(tmp, "core.js")
    a.write_text(full)
    run(sys.executable, ROOT / "build_core.py", a, b)
    core = b.read_text()
m = re.search(r"^export \{([\s\S]*?)\}\s*$", core, re.M)
names = [n.strip() for n in m.group(1).split(",") if n.strip()]
body = core[:m.start()]
for extra in ["CUR_RE"]:
    if not re.search(rf"^const {extra} ", body, re.M):
        body += re.search(rf"^const {extra} = .*$", full, re.M).group(0) + "\n"
wrapped = ("// АВТОМАТИЧЕСКИ СОБРАНО build_web.py из src/iphone/MyDay.js + profile-th.js — не редактируйте вручную.\n"
           f"window.CORE = (function () {{\n{body}\nreturn {{ {', '.join(names)} }}\n}})()\n")
(OUT / "core.js").write_text(wrapped)

# Сжатие: код и стили без пробелов и комментариев — телефон грузит меньше. Нужен esbuild (через npx);
# без него сайт собирается как есть. Исходники в src/web остаются читаемыми.
def minify(p):
    r = subprocess.run(["npx", "-y", "esbuild@0.24.0", str(p), "--minify", "--charset=utf8", f"--outfile={p}", "--allow-overwrite", "--log-level=error"],
                       capture_output=True, text=True)
    if r.returncode:
        print(f"Внимание: {p.name} не сжат (esbuild недоступен): {r.stderr.strip()[:200]}")
    return not r.returncode
if "--no-minify" not in sys.argv:
    for name in ["core.js", "app.js", "gami.js", "onb.js", "health.js", "family.js", "style.css", "gami.css", "onb.css", "health.css", "family.css"]:
        if not minify(OUT / name):
            break

# В сайте не должно быть ничего личного: он лежит в открытом репозитории
for p in OUT.rglob("*"):
    if p.is_file() and p.suffix in (".js", ".html", ".css", ".json", ".webmanifest"):
        t = p.read_text()
        for private in ["docs.google.com/spreadsheets/d/1", "script.google.com/macros/s/", "sk-ant", "трекер", "Prime Thai", "PTP", "Семейная группа", "trig_0", "trig_1"]:
            if private in t:
                sys.exit(f"В {p.relative_to(OUT)} осталось личное: {private}")

# проверка: ядро загружается в браузерном окружении и разбирает фразу
smoke = ("global.window = {}; require('vm').runInThisContext(require('fs').readFileSync(process.argv[1], 'utf8'));"
         "const c = window.CORE; const a = c.buildActions(c.splitCommands(c.normalizeSpeech('завтра в 10 встреча с Олей и потратил 300 на такси наличными')));"
         "if (a.length !== 2 || a.some(x => !x.kind)) { console.log(JSON.stringify(a)); process.exit(1) }")
run("node", "-e", smoke, OUT / "core.js")

# Самообновление виджета: общий код личной сборки БЕЗ личного блока настроек → dist/web/w.json.
# Виджет вставит в него свой личный блок сам (см. mergeUpdate в MyDay.js)
my = ROOT / "dist/MyDay.js"
if my.exists():
    import json
    code = my.read_text()
    build = re.search(r'const BUILD = "([0-9a-f]{12})"', code)
    if build and 'selfUpdate: "https' in code:
        a, b = code.index(START), code.index(END) + len(END)
        shared = code[:a] + "//@@ЛИЧНЫЕ НАСТРОЙКИ@@\n" + code[b:]
        sec = json.loads((ROOT / "secrets.json").read_text()) if (ROOT / "secrets.json").exists() else {}
        vals = [v for v in [sec.get("sheet_secret"), sec.get("sheet_hook")] + [r.get("token") for r in sec.get("routes", [])] if v and len(v) > 8]
        for pat in [r"sk-ant-\w+-[\w-]{20,}", r"macros/s/AKfy", r"trig_0[1-9][A-Za-z0-9]{10,}", r"spreadsheets/d/1[\w-]{20,}", r"Prime Thai", r"\bPTP\b"]:
            if re.search(pat, shared):
                sys.exit(f"В общем коде виджета осталось личное: {pat}")
        if any(v in shared for v in vals):
            sys.exit("В общем коде виджета остался ключ из secrets.json")
        s = 0x811c9dc5
        for ch in shared.encode("utf-16-le").decode("utf-16-le"):
            for u in ([ord(ch)] if ord(ch) < 0x10000 else [0xD800 + ((ord(ch) - 0x10000) >> 10), 0xDC00 + ((ord(ch) - 0x10000) & 0x3FF)]):
                s = ((s ^ u) * 0x01000193) & 0xffffffff
        n16 = len(shared.encode("utf-16-le")) // 2
        (OUT / "w.json").write_text(json.dumps({"build": build.group(1), "len": n16, "sum": s, "code": shared}, ensure_ascii=False))

# Версия кэша: меняется вместе с файлами, иначе телефон держит старое приложение
h = hashlib.sha256()
for p in sorted(OUT.rglob("*")):
    if p.is_file() and p.name != "sw.js":
        h.update(p.read_bytes())
sw = OUT / "sw.js"
sw.write_text(sw.read_text().replace("__VERSION__", h.hexdigest()[:10]))
print("Готово: dist/web/ —", ", ".join(sorted(p.name for p in OUT.iterdir())))
