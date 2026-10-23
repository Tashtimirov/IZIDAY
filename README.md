# Мой день

Виджеты для iPhone и Mac: календарь на 9 дней, напоминания, быстрые заметки, голосовые команды,
учёт доходов и расходов в батах с автозаписью в Google Таблицу. Оформление — в цветах Prime Thai Property.

## Состав

| Папка | Что внутри |
|---|---|
| `src/iphone/MyDay.js` | Скрипт для Scriptable на iPhone: виджеты всех размеров, меню, встроенный разбор речи, ассистент Claude (по API-ключу) |
| `src/mac/` | Виджет Übersicht для Mac и установщик `install.command` |
| `src/sheet/Code.gs` | Apps Script для Google Таблицы: принимает операции из виджетов |
| `build_core.py` | Вырезает из iPhone-скрипта общее ядро (разбор речи, деньги, отчёты) для Mac |
| `build.py` | Собирает `dist/` и подставляет секреты из `secrets.json` |
| `tests/` | Набор фраз для проверки встроенного разбора |

## Сборка

```
cp secrets.example.json secrets.json   # заполнить
python3 build.py
```

Получится `dist/MyDay.js` (вставить в Scriptable), `dist/MyDay-Mac.zip` (установка на Mac:
`unzip MyDay-Mac.zip && zsh MyDay-Mac/install.command`) и `dist/Code.gs` (вставить в Apps Script таблицы).

## Тесты разбора речи

```
node tests/run_corpus.mjs
node tests/run_corpus.mjs src/iphone/MyDay.js ./corpus2.mjs
```

Секреты (`secrets.json`) в репозиторий не попадают.
