# Мой день для Android

Автономная версия: приложение + виджет рабочего стола, всё хранится на телефоне (`data.json` во внутренней памяти),
разрешения на интернет у приложения нет. Разбор голосовых команд, деньги и отчёт — то же ядро, что на iPhone:
`build_android.py` вырезает его из `src/iphone/MyDay.js` с профилями `profile-ru.js` / `profile-th.js`
(без ключей и общего доступа к Claude) и кладёт в `assets/core-ru.js`, `assets/core-th.js`.

| Файл | Что внутри |
|---|---|
| `assets/index.html`, `app.js`, `style.css` | Экраны «Сегодня», «Деньги», «Здоровье», «Ещё», голосовые команды (WebView) |
| `java/…/MainActivity.java` | WebView и мост `window.Android`: файл данных, календарь, распознавание речи, файлы |
| `java/…/WidgetProvider.java` | Виджет: события, напоминания, вода, калории, расходы; 💧 добавляет стакан без открытия приложения |
| `java/…/Alarms.java` | Уведомления о напоминаниях (кнопка «Готово»), обновление виджета в полночь, после перезагрузки |
| `java/…/Cal.java` | Календарь телефона (CalendarContract): чтение, создание, перенос, удаление |
| `tools/icons.py` | Рисует значки |

Сборка (Ubuntu): `apt install aapt dalvik-exchange zipalign apksigner android-sdk-platform-23 default-jdk nodejs`,
затем `python3 build_android.py` → `dist/MyDay-Android.apk`. Ключ подписи — `android.keystore` в корне (не в git);
без него обновление не встанет поверх установленного приложения.

Проверка экранов в обычном браузере: открыть `build/android/assets/index.html` — без Android подставляется заглушка
с примерами событий, голос заменяется окном ввода текста.
