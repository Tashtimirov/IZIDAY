# IZIDAY для iPhone (обёртка Capacitor)

Веб-приложение из `src/web` кладётся внутрь приложения (`ios-app/www`) и открывается без интернета.
Собирается в облаке Codemagic (`codemagic.yaml`): на Mac владельца нет Xcode и места под него.

## Обновить веб-часть

```
python3 build.py && python3 build_web.py
ios-app/update_www.sh
cd ios-app && npm ci && npx cap sync ios
```

## Что уже есть

- проект Xcode `ios/App` (Capacitor 8, пакеты через SPM, iOS 15+), идентификатор `com.tashtimirov.izi`
  (его можно сменить до первой загрузки в App Store Connect, потом нельзя);
- значок 1024 без прозрачности, тексты запросов микрофона, камеры, фото и геопозиции;
- схема адресов `iziday://` для возврата из окна входа;
- плагины: App, Browser, Push Notifications, Splash Screen.

## Что ещё не сделано (нужен аккаунт разработчика Apple)

- вход через Google в системном окне с возвратом по `iziday://` и вход через Apple;
- пуши Apple (APNs) вместо веб-пушей, право `aps-environment`;
- докачка свежей веб-версии с сайта (тихие обновления);
- первая сборка и проверка на iPhone: голос, живой разговор, камера, сейф памяти.

Ни одна сборка ещё не запускалась: проект создан на Linux, без Xcode.
