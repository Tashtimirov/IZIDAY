#!/bin/sh
# Кладёт свежую веб-сборку в обёртку: сначала в корне `python3 build.py && python3 build_web.py`, затем этот файл.
# Страницы сайта, которые приложению не нужны (значки для закладки, pdf), внутрь не идут.
set -e
cd "$(dirname "$0")"
[ -f ../dist/web/index.html ] || { echo "нет ../dist/web — сначала соберите сайт"; exit 1; }
rm -rf www && mkdir www
cp -R ../dist/web/. www/
rm -f www/_headers www/w.json www/*.pdf www/googled*.html
echo "www: $(ls www | wc -l) файлов, $(du -sh www | cut -f1)"
