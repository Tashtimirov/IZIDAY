#!/bin/zsh
# Данные для виджета «Мой день».
#   data.sh <дней до сегодня> <дней с сегодня>  — события, напоминания, заметки, деньги
#   data.sh find                                 — события на год вперёд (для удаления голосом)
#   data.sh save <notes|finance> <base64-json>   — записать заметки или деньги (общие с iPhone)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
W="${0:A:h}"
D="$HOME/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/my-day"

ical() {
  icalBuddy -nrd -npn -b "" -ps "| §§ |" -iep "title,datetime" -po "title,datetime" \
    -df "%Y-%m-%d" -tf "%H:%M" -li 2000 eventsFrom:"$1" to:"$2" 2>&1
}

# Файлы iCloud могут быть ещё не скачаны на Mac — просим скачать
fetch() {
  if [ ! -f "$D/$1" ] && [ -f "$D/.$1.icloud" ]; then
    brctl download "$D/$1" >/dev/null 2>&1
    for i in 1 2 3 4 5 6; do [ -f "$D/$1" ] && break; sleep 0.5; done
  fi
  cat "$D/$1" 2>/dev/null || echo "[]"
}

case "$1" in
  find)
    ical "$(date +%Y-%m-%d)" "$(date -v+365d +%Y-%m-%d)"
    exit 0 ;;
  save)
    mkdir -p "$D"
    case "$2" in notes|finance|settings) ;; *) echo "bad name"; exit 1 ;; esac
    echo "$3" | base64 -D > "$D/$2.json.tmp" && mv "$D/$2.json.tmp" "$D/$2.json" && echo ok
    exit 0 ;;
esac

BEFORE="${1:-2}"; FROM_TODAY="${2:-7}"
echo "@@EVENTS"
if command -v icalBuddy >/dev/null 2>&1; then
  ical "$(date -v-"${BEFORE}"d +%Y-%m-%d)" "$(date -v+"$((FROM_TODAY - 1))"d +%Y-%m-%d)"
else
  echo "@@NO_ICALBUDDY"
fi
echo "@@REMINDERS"
osascript -l JavaScript "$W/lib/bridge.js" reminders 2>/dev/null || echo "[]"
echo
echo "@@NOTES"
fetch notes.json
echo
echo "@@MONEY"
fetch finance.json
echo
echo "@@SETTINGS"
fetch settings.json
echo
echo "@@END"
