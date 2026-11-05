#!/usr/bin/env python3
"""Собирает готовые к установке файлы в dist/ и подставляет секреты из secrets.json.

  python3 build.py            → dist/MyDay.js, dist/MyDay-Mac/, dist/MyDay-Mac.zip, dist/Code.gs,
                                dist/MyDay-RU.js, dist/MyDay-TH.js и dist/Code-RU.gs (версии для других: рубли / баты, без личных данных)

secrets.json (не хранится в git, пример — secrets.example.json):
  {"sheet_secret": "...", "sheet_hook": "https://script.google.com/macros/s/…/exec",
   "card_skip": "IVANOV"}   ← слова из имён своих счетов: переводы туда не считаются расходом
"""
import hashlib, json, os, re, shutil, subprocess, sys, zipfile, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
DIST = ROOT / "dist"
sec_path = ROOT / "secrets.json"
if not sec_path.exists():
    sys.exit("Нет secrets.json — скопируйте secrets.example.json и заполните")
sec = json.loads(sec_path.read_text())

def fill(text):
    return text.replace("__SHEET_SECRET__", sec["sheet_secret"]).replace("__SHEET_HOOK__", sec["sheet_hook"]).replace("__CARD_SKIP__", sec.get("card_skip", "")).replace("__WEB_APP__", sec.get("web_app", "")).replace('"__ROUTES__"', json.dumps([{k: v for k, v in r.items() if k != "token"} for r in sec.get("routes", [])], ensure_ascii=False))   # ключ рутины в файл не вшивается: он только в свойствах скрипта таблицы

shutil.rmtree(DIST, ignore_errors=True)
DIST.mkdir()
_my = fill((ROOT / "src/iphone/MyDay.js").read_text())
# номер сборки — по содержимому: виджет сам скачивает новую, когда номер на сайте другой (build_web.py → dist/web/w.json)
_my = _my.replace('const BUILD = "__BUILD__"', 'const BUILD = "%s"' % hashlib.sha256(_my.encode()).hexdigest()[:12])
(DIST / "MyDay.js").write_text(_my)
# Версии для других iPhone: личный блок настроек заменяется на src/iphone/profile-<страна>.js
START, END = "// ═══ ЛИЧНЫЕ НАСТРОЙКИ (начало)", "// ═══ ЛИЧНЫЕ НАСТРОЙКИ (конец) ═══\n"
src = (ROOT / "src/iphone/MyDay.js").read_text()
i, j = src.index(START), src.index(END) + len(END)
# у профиля должны быть те же настройки, что и у личной версии (кроме личных), иначе код получит undefined
shape = r"""const f = require("fs"), [a, b] = process.argv.slice(1).map(p => f.readFileSync(p, "utf8"))
const cfg = s => new Function(s.slice(s.indexOf("const CONFIG"), s.indexOf("// ═══ ЛИЧНЫЕ НАСТРОЙКИ (конец)")) + "; return CONFIG")()
const keys = (o, p = "") => Object.entries(o).flatMap(([k, v]) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof RegExp) && k !== "categories" ? keys(v, p + k + ".") : [p + k])
const miss = keys(cfg(a)).filter(k => !keys(cfg(b)).includes(k) && !/^tracker/.test(k))
if (miss.length) { console.log(miss.join(", ")); process.exit(1) }"""
for country in ["ru", "th"]:
    prof = ROOT / f"src/iphone/profile-{country}.js"
    r = subprocess.run(["node", "-e", shape, str(ROOT / "src/iphone/MyDay.js"), str(prof)], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"В {prof.name} не хватает настроек: {r.stdout.strip() or r.stderr.strip()}")
    out = src[:i] + prof.read_text().replace("__AI_PROXY_TOKEN__", sec.get("ai_proxy_token", "")).replace("__AI_PROXY__", sec.get("ai_proxy", "")) + src[j:]
    # Личное (трекер) в версию для других не попадает: строки с «[личное]» и блоки «[личное ▼] … [личное ▲]»
    out = re.sub(r"[ \t]*// \[личное ▼\][\s\S]*?// \[личное ▲\]\n", "", out)
    out = "".join(l for l in out.splitlines(True) if "[личное]" not in l)
    if country == "ru" and sec.get("ai_proxy_token") and sec["ai_proxy_token"] in out:
        sys.exit("В версии для России не должно быть общего доступа к Claude")
    for private in ["docs.google.com/spreadsheets/d/1", "трекер", "tracker", "Курение", "Секс", "Алкоголь", "Prime Thai", "PTP", "Семейная группа", sec["sheet_secret"], sec["sheet_hook"], *[r.get("token", "") for r in sec.get("routes", [])]]:
        if private and private in out:
            sys.exit(f"В MyDay-{country.upper()}.js осталось личное: {private}")
    (DIST / f"MyDay-{country.upper()}.js").write_text(out)
# Скрипт таблицы для других: без вашего ключа — таблица запомнит ключ виджета, который первым в неё напишет
# Общий доступ друзей к Claude: ваш ключ остаётся в Google-скрипте, виджет знает только пароль
(DIST / "Proxy.gs").write_text((ROOT / "src/proxy/Proxy.gs").read_text().replace("__AI_PROXY_TOKEN__", sec.get("ai_proxy_token", "")))
(DIST / "Code-RU.gs").write_text((ROOT / "src/sheet/Code.gs").read_text().replace("__SHEET_SECRET__", "").replace("__CARD_SKIP__", ""))
(DIST / "Code.gs").write_text(fill((ROOT / "src/sheet/Code.gs").read_text()))
# Общий сервер для друзей: вход через Google, у каждого своя таблица (build_friends.py)
sys.path.insert(0, str(ROOT))
from build_friends import friends_gs
(DIST / "Friends.gs").write_text(friends_gs(sec.get("google_client", "")))

mac = DIST / "MyDay-Mac"
shutil.copytree(ROOT / "src/mac", mac)
subprocess.run([sys.executable, str(ROOT / "build_core.py"), str(DIST / "MyDay.js"), str(mac / "MyDay.widget/lib/core.js")], check=True)
for p in (mac / "install.command", mac / "MyDay.widget/data.sh"):
    p.chmod(0o755)

with zipfile.ZipFile(DIST / "MyDay-Mac.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(mac.rglob("*")):
        if p.is_file():
            z.write(p, p.relative_to(DIST))
print("Готово:", ", ".join(sorted(x.name for x in DIST.iterdir())))
