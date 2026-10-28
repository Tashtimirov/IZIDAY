#!/usr/bin/env python3
"""Собирает приложение для Android: dist/MyDay-Android.apk.

Всё работает на телефоне без интернета: разбор речи, деньги и отчёты — тот же код, что на iPhone
(build_core.py вырезает его из src/iphone/MyDay.js с настройками profile-ru.js и profile-th.js).

Нужно (Ubuntu/Debian):  apt install aapt dalvik-exchange zipalign apksigner android-sdk-platform-23 default-jdk nodejs
Ключ подписи — android.keystore рядом со скриптом (в git не хранится). Его нельзя терять:
обновление поверх установленного приложения ставится, только если подпись та же.

  python3 build_android.py
"""
import json, os, re, shutil, subprocess, sys, pathlib, tempfile

ROOT = pathlib.Path(__file__).resolve().parent
APP = ROOT / "src/android"
DIST = ROOT / "dist"
OUT = ROOT / "build/android"
ANDROID_JAR = pathlib.Path(os.environ.get("ANDROID_JAR", "/usr/lib/android-sdk/platforms/android-23/android.jar"))
KEYSTORE = ROOT / "android.keystore"
KEYPASS = os.environ.get("MYDAY_KEYPASS", "myday-android")

def run(*cmd, **kw):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, **kw)
    if r.returncode:
        sys.exit(f"Ошибка: {' '.join(map(str, cmd[:2]))}\n{r.stdout}\n{r.stderr}")
    return r.stdout

for tool in ["aapt", "javac", "dalvik-exchange", "zipalign", "apksigner", "node"]:
    if not shutil.which(tool):
        sys.exit(f"Нет программы {tool} — см. начало build_android.py")
if not ANDROID_JAR.exists():
    sys.exit(f"Нет {ANDROID_JAR} (пакет android-sdk-platform-23 или переменная ANDROID_JAR)")

shutil.rmtree(OUT, ignore_errors=True)
for d in ["gen", "classes", "assets"]:
    (OUT / d).mkdir(parents=True)

# ── 1. Общее ядро (разбор речи, деньги, отчёты) для России и Таиланда ──
START, END = "// ═══ ЛИЧНЫЕ НАСТРОЙКИ (начало)", "// ═══ ЛИЧНЫЕ НАСТРОЙКИ (конец) ═══\n"
src = (ROOT / "src/iphone/MyDay.js").read_text()
i, j = src.index(START), src.index(END) + len(END)
shutil.copytree(APP / "assets", OUT / "assets", dirs_exist_ok=True)
for country in ["ru", "th"]:
    prof = (ROOT / f"src/iphone/profile-{country}.js").read_text()
    prof = prof.replace("__AI_PROXY_TOKEN__", "").replace("__AI_PROXY__", "")   # в приложении нет ни ключей, ни общего доступа
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
    # то, что появилось в MyDay.js позже списка build_core.py (однострочные константы)
    for extra in ["CUR_RE"]:
        if not re.search(rf"^const {extra} ", body, re.M):
            body += re.search(rf"^const {extra} = .*$", full, re.M).group(0) + "\n"
    wrapped = (f"// АВТОМАТИЧЕСКИ СОБРАНО build_android.py из src/iphone/MyDay.js + profile-{country}.js — не редактируйте вручную.\n"
               f"window.CORES = window.CORES || {{}}\nwindow.CORES.{country} = (function () {{\n{body}\nreturn {{ {', '.join(names)} }}\n}})()\n")
    for private in ["docs.google.com/spreadsheets/d/1", "трекер", "Prime Thai", "PTP", "Семейная группа", "sk-ant", "script.google.com/macros/s/"]:
        if private in wrapped:
            sys.exit(f"В ядре {country} осталось личное: {private}")
    (OUT / "assets" / f"core-{country}.js").write_text(wrapped)
    # проверка: ядро загружается без Scriptable и разбирает фразу целиком
    smoke = ("global.window = {}; require('vm').runInThisContext(require('fs').readFileSync(process.argv[1], 'utf8'));"
             f"const c = window.CORES.{country}; const a = c.buildActions(c.splitCommands(c.normalizeSpeech("
             "'завтра в 10 встреча с Олей, потратил 300 на такси наличными и напомни в 18 купить цветы')));"
             "if (a.length !== 3 || a.some(x => !x.kind)) { console.log(JSON.stringify(a)); process.exit(1) }"
             "a.map(c.describe); c.reportHTML(c.monthKey(new Date()), [])")
    run("node", "-e", smoke, OUT / "assets" / f"core-{country}.js")

# ── 2. Ресурсы, код, dex ──
unsigned = OUT / "app.unsigned.apk"
run("aapt", "package", "-f", "-m", "-J", OUT / "gen", "-M", APP / "AndroidManifest.xml", "-S", APP / "res",
    "-A", OUT / "assets", "-I", ANDROID_JAR, "-F", unsigned)
java = [str(p) for p in (APP / "java").rglob("*.java")] + [str(p) for p in (OUT / "gen").rglob("*.java")]
run("javac", "-nowarn", "-encoding", "UTF-8", "--release", "8", "-Xlint:-options", "-cp", ANDROID_JAR, "-d", OUT / "classes", *java)
run("dalvik-exchange", "--dex", f"--output={OUT / 'classes.dex'}", OUT / "classes")
run("aapt", "add", unsigned.name, "classes.dex", cwd=OUT)

# ── 3. Подпись ──
if not KEYSTORE.exists():
    run("keytool", "-genkeypair", "-keystore", KEYSTORE, "-alias", "myday", "-keyalg", "RSA", "-keysize", "2048",
        "-validity", "10000", "-storepass", KEYPASS, "-keypass", KEYPASS, "-dname", "CN=Moi den, O=MyDay, C=RU")
    print("Создан новый ключ подписи:", KEYSTORE.name, "— сохраните его, без него обновления не встанут поверх")
aligned = OUT / "app.aligned.apk"
run("zipalign", "-f", "-p", "4", unsigned, aligned)
DIST.mkdir(exist_ok=True)
apk = DIST / "MyDay-Android.apk"
run("apksigner", "sign", "--ks", KEYSTORE, "--ks-pass", f"pass:{KEYPASS}", "--ks-key-alias", "myday", "--min-sdk-version", "23",
    "--out", apk, aligned)
run("apksigner", "verify", apk)
print(f"Готово: {apk.relative_to(ROOT)} ({apk.stat().st_size // 1024} КБ)")
