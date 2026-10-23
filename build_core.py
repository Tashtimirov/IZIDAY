#!/usr/bin/env python3
"""Собирает MyDay.widget/lib/core.js из iPhone-скрипта MyDay.js,
чтобы Mac и iPhone разбирали команды и считали деньги одним и тем же кодом."""
import re, sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent
SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else HERE / "src/iphone/MyDay.js").read_text()
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else HERE / "src/mac/MyDay.widget/lib/core.js")

NAMES = """CONFIG MONTH_NOM startOfDay sameDay cap monthKey monthTitle money dayLabel monthTotals
METHOD TYPE matchCategory parseMoney esc catRows reportHTML reportText reportCSV
DAYS_DAT recurLabel WEEKDAYS MONTH_GEN WHEN_S cleanText parseWhen NUM_WORDS NUM_MULT NUM_SEQ normalizeSpeech
VOICE REM_TRIG NOTE_TRIG EVT_TRIG DEL_TRIG ADD_TRIG classify hasTrigger splitCommands moneyDate moneyComment
buildActions lev STOP words titleMatches  plural describe isOverdue reminderTime
withIds mergeSynced visible ORD_GEN ORD_RE EVENING_WORDS buildMove buildQuery extractCalendar""".split()

# Режем файл на top-level блоки: каждый начинается со строки без отступа
starts = [m.start() for m in re.finditer(r"^(?:async function|function|const|let) ", SRC, re.M)]
starts.append(len(SRC))
chunks = {}
for a, b in zip(starts, starts[1:]):
    block = SRC[a:b]
    m = re.match(r"(?:async function|function|const|let)\s+([A-Za-z_$][\w$]*)", block)
    if not m:
        continue
    # обрезаем хвост: комментарии/код верхнего уровня после конца блока
    lines = block.rstrip().split("\n")
    while lines and (lines[-1].startswith("//") or lines[-1].strip() == "" or
                     re.match(r"^(if|Script|await|\})", lines[-1]) and lines[-1] != "}"):
        lines.pop()
    chunks[m.group(1)] = "\n".join(lines)

# Константы форматов дат объявлены одной строкой
fmt_line = re.search(r"^const TIME = fmt\(.*$", SRC, re.M).group(0)
fmt_line2 = re.search(r"^const WHEN = fmt\(.*$", SRC, re.M).group(0)

missing = [n for n in NAMES if n not in chunks]
if missing:
    sys.exit(f"Не найдено в MyDay.js: {missing}")

HEADER = r'''// АВТОМАТИЧЕСКИ СОБРАНО из iPhone-скрипта MyDay.js (build_core.py) — не редактируйте вручную.
// Общий код: разбор голосовых команд, деньги, отчёты. Работает и в Übersicht, и в Node.

// Замена DateFormatter из Scriptable
const RU_MON_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
const RU_MON_SHORT = ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."]
const RU_DAY = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"]
const RU_DAY_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"]
const z2 = n => String(n).padStart(2, "0")
function fmt(pattern) {
  return {
    string(d) {
      return pattern.replace(/yyyy|MMMM|MMM|MM|dd|d|EEEE|EE|HH|mm/g, t => ({
        yyyy: d.getFullYear(), MMMM: RU_MON_GEN[d.getMonth()], MMM: RU_MON_SHORT[d.getMonth()],
        MM: z2(d.getMonth() + 1), dd: z2(d.getDate()), d: d.getDate(),
        EEEE: RU_DAY[d.getDay()], EE: RU_DAY_SHORT[d.getDay()], HH: z2(d.getHours()), mm: z2(d.getMinutes()),
      })[t])
    },
  }
}
'''

order = NAMES[:]
body = [HEADER, fmt_line, fmt_line2, ""]
for n in order:
    body.append(chunks[n])
    body.append("")
exports = sorted(set(NAMES + ["fmt", "TIME", "DAY", "FULL", "SHORT", "WHEN", "DM", "YMD"]))
body.append("export {\n  " + ",\n  ".join(exports) + ",\n}\n")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(body))
print(f"core.js: {len(order)} блоков, {OUT.stat().st_size} байт")
