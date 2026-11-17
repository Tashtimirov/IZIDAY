#!/usr/bin/env python3
"""Собирает общий сервер для друзей dist/Friends.gs из кода личной таблицы (src/sheet/Code.gs) и src/friends/Friends.gs.

  python3 build_friends.py [выход] [client_id]   (без аргументов: dist/Friends.gs, client_id из secrets.json → google_client)

Каждая замена проверяется: если в Code.gs что-то переименуют, сборка остановится, а не выпустит сервер с дырой.
В готовом файле не должно остаться служб владельца (Почта, Календарь, ключи рутин, личный ключ таблицы).
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent


def friends_gs(client=""):
    code = (ROOT / "src/sheet/Code.gs").read_text()
    shim = (ROOT / "src/friends/Friends.gs").read_text()

    def sub(pattern, repl, n=None, text=None):
        nonlocal code
        new, k = re.subn(pattern, repl, code)
        if not k or (n is not None and k != n):
            sys.exit(f"build_friends: «{pattern}» найдено {k} раз(а), ожидалось {n or '≥1'} — проверьте Code.gs")
        code = new

    sub(r'const SECRET = "__SHEET_SECRET__";', 'const SECRET = "";', 1)
    sub(r'"__CARD_SKIP__"', '""', 1)
    # точки входа личной таблицы — под другими именами (их место занимают версии из Friends.gs)
    sub(r"\bfunction doGet\(\)", "function doGetOwner_()", 1)
    sub(r"\bfunction doPost\(e\)", "function doPostOwner_(e)", 1)
    sub(r"\bfunction onOpen\(\)", "function onOpenOwner_()", 1)
    sub(r"\bfunction cal_\(c\)", "function calOwner_(c)", 1)
    sub(r"\bfunction pushTick\(\)", "function pushTickOne_()", 1)
    sub(r"(?<!function )\bpushTick\(\)", "pushTickOne_()")
    # данные — в таблице и свойствах того, кто прислал запрос
    sub(r"SpreadsheetApp\.getActiveSpreadsheet\(\)", "SS_()")
    sub(r"PropertiesService\.getScriptProperties\(\)", "UP_()")
    # службы владельца: календарь — свой, почты нет (и упоминаний в комментариях тоже: Google ищет имена служб по всему тексту)
    sub(r"\bCalendarApp\b", "FCAL_")
    sub(r"\bGmailApp\b", "NOGMAIL_")
    sub(r"ScriptApp\.getOAuthToken\(\)", '""', 3)   # 3: обрезка серии, одно повторение серии и дни рождения из Google (у друзей — пусто)
    # подсказки шлёт сервер (виджета у друзей нет), раз в 10 минут: время работы скриптов у Google ограничено
    sub(r"full = !!snap\.pushAware;", "full = true;", 1)
    sub(r"const PUSH = \{ tick: 5,", "const PUSH = { tick: 10,", 1)
    out = code.rstrip() + "\n\n" + shim.replace("__GOOGLE_CLIENT__", client)
    for bad in ["CalendarApp", "GmailApp", "getActiveSpreadsheet", "getScriptProperties()\n", "__SHEET_SECRET__"]:
        if bad in out:
            sys.exit(f"build_friends: в Friends.gs осталось «{bad}»")
    if out.count("PropertiesService.getScriptProperties()") != 1:
        sys.exit("build_friends: общие свойства скрипта должны читаться только через GP_()")
    return out


if __name__ == "__main__":
    dest = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist/Friends.gs"
    client = sys.argv[2] if len(sys.argv) > 2 else ""
    if len(sys.argv) <= 2 and (ROOT / "secrets.json").exists():
        client = json.loads((ROOT / "secrets.json").read_text()).get("google_client", "")
    out = friends_gs(client)
    sec = (ROOT / "secrets.json")
    if sec.exists():
        s = json.loads(sec.read_text())
        for k in ["sheet_secret", "ai_proxy_token"]:
            if s.get(k) and s[k] in out:
                sys.exit(f"build_friends: в Friends.gs попал {k}")
        for r in s.get("routes", []):
            if r.get("token") and r["token"] in out:
                sys.exit("build_friends: в Friends.gs попал ключ рутины")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out)
    print(f"{dest} · {len(out) // 1024} КБ")
