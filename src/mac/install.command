#!/bin/zsh
# Установка виджета «Мой день» для Mac.
# Запуск: откройте Терминал и выполните  zsh ~/Downloads/MyDay-Mac/install.command
set -e
cd "${0:A:h}"

say() { print -P "%F{cyan}▸%f $1"; }
ok()  { print -P "%F{green}✓%f $1"; }
err() { print -P "%F{red}✗%f $1"; }

print -P "\n%BУстановка виджета «Мой день»%b\n"

# 1. Homebrew
for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$($b shellenv)"; done
if ! command -v brew >/dev/null 2>&1; then
  say "Нужен Homebrew — менеджер программ для Mac (https://brew.sh)."
  read "ans?Установить Homebrew сейчас? Понадобится пароль от Mac. [y/N] "
  if [[ "$ans" == [yYдД]* ]]; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$($b shellenv)"; done
  else
    err "Без Homebrew установка невозможна. Запустите скрипт снова, когда будете готовы."; exit 1
  fi
fi
ok "Homebrew"

# 2. Übersicht — приложение для виджетов на рабочем столе
if [ -d "/Applications/Übersicht.app" ]; then ok "Übersicht уже установлен"
else say "Устанавливаю Übersicht…"; brew install --cask ubersicht; ok "Übersicht"; fi

# 3. icalBuddy — чтение Календаря
if command -v icalBuddy >/dev/null 2>&1; then ok "icalBuddy уже установлен"
else say "Устанавливаю icalBuddy…"; brew install ical-buddy; ok "icalBuddy"; fi

# 4. Виджет
WD="$HOME/Library/Application Support/Übersicht/widgets"
mkdir -p "$WD"
rm -rf "$WD/MyDay.widget"
cp -R MyDay.widget "$WD/"
rm -f "$WD/MyDay.widget/bridge.js"   # старое место файла (до версии с папкой lib)
chmod +x "$WD/MyDay.widget/data.sh"
xattr -dr com.apple.quarantine "$WD/MyDay.widget" 2>/dev/null || true
ok "Виджет скопирован в папку виджетов Übersicht"

# 5. Общая папка с iPhone (iCloud Drive → Scriptable → my-day)
SC="$HOME/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents"
if [ -d "$SC" ]; then
  mkdir -p "$SC/my-day"; ok "Заметки и деньги будут общими с iPhone"
else
  say "Папка Scriptable в iCloud Drive не найдена — заметки и деньги пока будут храниться только на Mac."
  say "Чтобы они стали общими с iPhone: включите iCloud Drive на обоих устройствах и для Scriptable на iPhone."
  mkdir -p "$SC/my-day" 2>/dev/null || true
fi

# 6. Запуск и первые разрешения
say "Запускаю Übersicht. macOS попросит разрешения — нажмите «Разрешить»:"
print "    • доступ к Календарям и Напоминаниям"
print "    • управление приложениями «Календарь» и «Напоминания»"
open -a "Übersicht"
sleep 3
osascript -l JavaScript "$WD/MyDay.widget/lib/bridge.js" reminders >/dev/null 2>&1 || true

print -P "\n%F{green}%BГотово!%b%f Виджет появится в правом верхнем углу рабочего стола.\n"
print "Если кнопки не нажимаются: значок Übersicht в строке меню → Preferences →"
print "Interaction Shortcut — выберите клавишу, и разрешите Übersicht доступ в"
print "Системные настройки → Конфиденциальность и безопасность → Универсальный доступ.\n"
