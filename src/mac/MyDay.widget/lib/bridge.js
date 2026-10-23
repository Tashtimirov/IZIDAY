// Мост виджета «Мой день» к Календарю, Напоминаниям и диалогам macOS (JavaScript for Automation).
// Запуск: osascript -l JavaScript bridge.js <команда> [аргументы…]
// Результат печатается в stdout (обычно JSON). Отмена диалога → "__CANCEL__".

ObjC.import("Foundation")

function app() {
  const a = Application.currentApplication()
  a.includeStandardAdditions = true
  return a
}

function json(x) { return JSON.stringify(x) }

function localISO(d) {
  if (!d) return null
  const z = n => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:00`
}

// ── Напоминания ──
function reminders() {
  const R = Application("Reminders")
  const items = R.reminders.whose({ completed: false })
  const ids = items.id(), names = items.name(), dues = items.dueDate(), allday = items.alldayDueDate()
  return json(ids.map((id, i) => ({
    id, title: names[i],
    due: dues[i] ? localISO(dues[i]) : (allday[i] ? localISO(allday[i]) : null),
    allday: !dues[i] && !!allday[i],
  })))
}

function addReminder(title, due, listName) {
  const R = Application("Reminders")
  const props = { name: title }
  if (due) { const d = new Date(due); props.dueDate = d; props.remindMeDate = d }
  const r = R.Reminder(props)
  let list = R.defaultList()
  if (listName) {
    const low = listName.toLowerCase()
    const all = R.lists()
    list = all.find(l => l.name().toLowerCase() === low) || all.find(l => l.name().toLowerCase().includes(low)) || list
  }
  list.reminders.push(r)
  return "ok"
}

function deleteReminders(idsJson) {
  const R = Application("Reminders")
  let n = 0
  for (const id of JSON.parse(idsJson)) {
    try { R.reminders.byId(id).delete(); n++ } catch (e) {}
  }
  return String(n)
}

function completeReminder(id) {
  const R = Application("Reminders")
  try { R.reminders.byId(id).completed = true; return "ok" } catch (e) { return "notfound" }
}

function showReminder(id) {
  const R = Application("Reminders")
  R.activate()
  try { if (id) R.show(R.reminders.byId(id)) } catch (e) {}
  return "ok"
}

// ── Календарь ──
function writableCalendar(name) {
  const Cal = Application("Calendar")
  if (name) {
    const low = name.toLowerCase()
    const all = Cal.calendars.whose({ writable: true })()
    const hit = all.find(c => c.name().toLowerCase() === low) || all.find(c => c.name().toLowerCase().includes(low))
    if (hit) return hit
  }
  const w = Cal.calendars.whose({ writable: true })()
  if (!w.length) throw new Error("Нет календаря, в который можно записывать")
  return w[0]
}

function calendars() {
  const Cal = Application("Calendar")
  return json(Cal.calendars.whose({ writable: true }).name())
}

function addEvent(title, start, minutes, rule, location, calName) {
  const Cal = Application("Calendar")
  const cal = writableCalendar(calName)
  const s = new Date(start)
  const props = { summary: title, startDate: s, endDate: new Date(s.getTime() + (+minutes || 60) * 60000) }
  if (location) props.location = location
  const ev = Cal.Event(props)
  cal.events.push(ev)
  if (rule) { try { ev.recurrence = rule } catch (e) {} }
  return "ok"
}

// Удаляет события с точными названиями. weekdays — дни недели (0 = вс) для фильтра,
// date — только этот день (у повторяющегося события тогда исключается одно повторение).
function deleteEvents(titlesJson, weekdaysJson, date) {
  const Cal = Application("Calendar")
  const titles = JSON.parse(titlesJson)
  const days = weekdaysJson ? JSON.parse(weekdaysJson) : null
  const day = date ? new Date(date) : null
  const same = (a, b) => a.toDateString() === b.toDateString()
  let n = 0
  for (const cal of Cal.calendars.whose({ writable: true })()) {
    for (const t of titles) {
      for (const ev of cal.events.whose({ summary: t })()) {
        try {
          const st = ev.startDate()
          const rec = ev.recurrence() || ""
          if (days && !days.includes(st.getDay())) continue
          if (day) {
            if (rec) {
              const occ = new Date(day); occ.setHours(st.getHours(), st.getMinutes(), 0, 0)
              ev.excludedDates = (ev.excludedDates() || []).concat([occ]); n++
            } else if (same(st, day)) { ev.delete(); n++ }
            continue
          }
          ev.delete(); n++
        } catch (e) {}
      }
    }
  }
  return String(n)
}

// Переносит разовое событие (повторяющиеся AppleScript двигает целиком, поэтому их не трогаем)
function moveEvent(title, oldStart, newStart) {
  const Cal = Application("Calendar")
  const old = new Date(oldStart), ns = new Date(newStart)
  for (const cal of Cal.calendars.whose({ writable: true })()) {
    for (const ev of cal.events.whose({ summary: title })()) {
      try {
        const st = ev.startDate()
        if (Math.abs(st - old) > 60000) continue
        if (ev.recurrence()) return "recurring"
        const dur = ev.endDate() - st
        ev.startDate = ns
        ev.endDate = new Date(ns.getTime() + dur)
        return "ok"
      } catch (e) {}
    }
  }
  return "notfound"
}

function showDate(iso) {
  const Cal = Application("Calendar")
  Cal.activate()
  try { Cal.switchView({ to: "day view" }); Cal.viewCalendar({ at: new Date(iso) }) } catch (e) {}
  return "ok"
}

// ── Диалоги ──
function ask(title, prompt, def) {
  const a = app(); a.activate()
  try {
    return a.displayDialog(prompt, { withTitle: title, defaultAnswer: def || "", buttons: ["Отмена", "OK"],
      defaultButton: "OK", cancelButton: "Отмена" }).textReturned
  } catch (e) { return "__CANCEL__" }
}

function choose(title, prompt, itemsJson) {
  const a = app(); a.activate()
  const items = JSON.parse(itemsJson)
  const r = a.chooseFromList(items, { withTitle: title, withPrompt: prompt, defaultItems: [items[0]],
    okButtonName: "Выбрать", cancelButtonName: "Отмена" })
  return r === false ? "-1" : String(items.indexOf(r[0]))
}

function confirm(title, message, buttonsJson) {
  const a = app(); a.activate()
  const buttons = JSON.parse(buttonsJson)
  try {
    return a.displayDialog(message, { withTitle: title, buttons, defaultButton: buttons[buttons.length - 1],
      cancelButton: buttons[0] }).buttonReturned
  } catch (e) { return "__CANCEL__" }
}

function info(title, message) {
  const a = app(); a.activate()
  try { a.displayDialog(message || " ", { withTitle: title, buttons: ["OK"], defaultButton: "OK" }) } catch (e) {}
  return "ok"
}

function run(argv) {
  const [cmd, ...a] = argv
  try {
    switch (cmd) {
      case "reminders": return reminders()
      case "add-reminder": return addReminder(a[0], a[1], a[2])
      case "delete-reminders": return deleteReminders(a[0])
      case "show-reminder": return showReminder(a[0])
      case "complete-reminder": return completeReminder(a[0])
      case "move-event": return moveEvent(a[0], a[1], a[2])
      case "calendars": return calendars()
      case "add-event": return addEvent(a[0], a[1], a[2], a[3], a[4], a[5])
      case "delete-events": return deleteEvents(a[0], a[1], a[2])
      case "show-date": return showDate(a[0])
      case "ask": return ask(a[0], a[1], a[2])
      case "choose": return choose(a[0], a[1], a[2])
      case "confirm": return confirm(a[0], a[1], a[2])
      case "info": return info(a[0], a[1])
      default: return "unknown command"
    }
  } catch (e) {
    return "__ERROR__ " + e.message
  }
}
