# Google Календарь для друзей — поверх готового сайта (папка сборки на Mac), без пересборки.
#   python3 patch_gcal.py <папка сайта> <папка этого пакета>
import sys, os, re, hashlib, shutil
d, pkg = sys.argv[1], sys.argv[2]
P = lambda f: os.path.join(d, f)
def read(f): return open(P(f), encoding="utf-8").read()
def write(f, s): open(P(f), "w", encoding="utf-8").write(s)
sha = lambda f: hashlib.sha256(open(f, "rb").read()).hexdigest()
# 1) friends.js и privacy.html — целиком, если на сайте ровно та версия, от которой сделана правка
BASE = {"friends.js": "adc9f03dbf12d23c4018922bdbb48131f7b73e4c0d64bbb3d3f9cc254e605466", "privacy.html": "b2496a4547e74287840fec0ee30e4ef46667ae6270e3917fb4cdd2400a2a94db"}
for f, h in BASE.items():
    cur = sha(P(f))
    if cur == sha(os.path.join(pkg, f)): print(f, "уже новый"); continue
    assert cur == h, f"{f}: на сайте другая версия ({cur[:10]}) — нужна пересборка, не патч"
    shutil.copy(os.path.join(pkg, f), P(f)); print(f, "заменён")
# 2) index.html: забрать ?code=…&state=… от Google до app.js
s = read("index.html")
if "izi-gcal" not in s:
    a = 'history.replaceState(null,"",location.pathname+location.search)}}catch(e){}</script>'
    assert s.count(a) == 1, "index.html: нет места для вставки"
    s = s.replace(a, a + '\n<script>/* подключение Google Календаря: Google возвращает ?code=…&state=… — забрать до app.js */try{if(/(^|[?&])(code|error)=/.test(location.search)&&/[?&]state=/.test(location.search)){sessionStorage.setItem("izi-gcal",location.search.slice(1));history.replaceState(null,"",location.pathname+location.hash)}}catch(e){}</script>')
    write("index.html", s); print("index.html ok")
# 3) app.js: подсказка «Ваш Google Календарь» в «Календаре»
s = read("app.js")
if "data-gc=" not in s:
    rx = re.compile(r'(!gcalOn\(\)&&D\.gcal&&D\.gcal\.error&&\((\w+)\+=`<div class="banner"><b>Google Календарь не ответил</b>\$\{esc\(D\.gcal\.error\)\}</div>`\),)')
    m = rx.findall(s)
    assert len(m) == 1, f"app.js: место вставки найдено {len(m)} раз"
    v = m[0][1]
    s = rx.sub(lambda x: x.group(1) + 'window.FRIEND&&FRIEND.me()&&!FRIEND.me().gcal&&!D.gcHide&&(' + v + '+=`<div class="banner"><b>Ваш Google Календарь</b>Подключите — и встречи из него появятся здесь, а новые попадут в Google на всех устройствах.<div class="btns" style="margin-top:8px"><button class="btn primary small" data-gc="on">${FRIEND.gico}Подключить</button><button class="btn small" data-gc="hide">Не сейчас</button></div></div>`),', s)
    write("app.js", s); print("app.js ok")
# 4) sw.js: новая версия кэша
s = read("sw.js")
s2 = re.sub(r'const CACHE = "[^"]*"', 'const CACHE = "myday-gcal1111"', s, count=1)
assert 'myday-gcal1111' in s2, "sw.js: нет CACHE"
write("sw.js", s2); print("sw.js ok")
shutil.copy(os.path.join(pkg, "about.html"), P("about.html")); print("about.html ok")
print("ГОТОВО")
