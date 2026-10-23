#!/usr/bin/env python3
"""Собирает готовые к установке файлы в dist/ и подставляет секреты из secrets.json.

  python3 build.py            → dist/MyDay.js, dist/MyDay-Mac/, dist/MyDay-Mac.zip, dist/Code.gs,
                                dist/MyDay-RU.js (версия для других: рубли, без личных данных)

secrets.json (не хранится в git, пример — secrets.example.json):
  {"sheet_secret": "...", "sheet_hook": "https://script.google.com/macros/s/…/exec"}
"""
import json, os, re, shutil, subprocess, sys, zipfile, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
DIST = ROOT / "dist"
sec_path = ROOT / "secrets.json"
if not sec_path.exists():
    sys.exit("Нет secrets.json — скопируйте secrets.example.json и заполните")
sec = json.loads(sec_path.read_text())

def fill(text):
    return text.replace("__SHEET_SECRET__", sec["sheet_secret"]).replace("__SHEET_HOOK__", sec["sheet_hook"])

shutil.rmtree(DIST, ignore_errors=True)
DIST.mkdir()
(DIST / "MyDay.js").write_text(fill((ROOT / "src/iphone/MyDay.js").read_text()))
# Версия для других iPhone: личный блок настроек заменяется на src/iphone/profile-ru.js
START, END = "// ═══ ЛИЧНЫЕ НАСТРОЙКИ (начало)", "// ═══ ЛИЧНЫЕ НАСТРОЙКИ (конец) ═══\n"
src = (ROOT / "src/iphone/MyDay.js").read_text()
i, j = src.index(START), src.index(END) + len(END)
ru = src[:i] + (ROOT / "src/iphone/profile-ru.js").read_text() + src[j:]
# Личное (трекер) в версию для других не попадает: строки с «[личное]» и блоки «[личное ▼] … [личное ▲]»
ru = re.sub(r"[ \t]*// \[личное ▼\][\s\S]*?// \[личное ▲\]\n", "", ru)
ru = "".join(l for l in ru.splitlines(True) if "[личное]" not in l)
for private in ["docs.google.com/spreadsheets/d/1", "трекер", "tracker", "Курение", "Секс", "Алкоголь", "Prime Thai", "PTP", "Семейная группа", sec["sheet_secret"], sec["sheet_hook"]]:
    if private and private in ru:
        sys.exit(f"В MyDay-RU.js осталось личное: {private}")
(DIST / "MyDay-RU.js").write_text(ru)
(DIST / "Code.gs").write_text(fill((ROOT / "src/sheet/Code.gs").read_text()))

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
