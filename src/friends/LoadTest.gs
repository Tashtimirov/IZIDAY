// ═══════════════ Проверка нагрузки — ТОЛЬКО ДЛЯ КОПИИ сервера «IZIDAY Друзья» ═══════════════
// Не вставлять в живой сервер. Копия: в редакторе Apps Script «Обзор» → «Создать копию». Свойства скрипта
// (ключ Claude, вход Google) в копию не переносятся — значит, проверка не тратит ключ: Изи отвечает «не подключён».
// 1) В копии добавить этот файл, выполнить loadSeed() — в журнале появится строка с ключами 20 тестовых людей.
// 2) «Развернуть» → «Новое развёртывание» → веб-приложение, от моего имени, доступ «Все» → ссылка /exec.
// 3) На Mac: node friends_load.mjs <ссылка /exec> <файл с ключами> — 20 человек одновременно, 3 минуты.
// 4) После проверки: loadClean() (тестовые таблицы — в корзину) и удалить копию.
function loadSeed() {
  const n = 20, secrets = [];
  for (let i = 1; i <= n; i++) {
    const id = "load" + i;
    let u = userGet_(id);
    if (!u) {
      const ss = SpreadsheetApp.create("IZIDAY нагрузка " + i);
      u = { id, sub: id, email: id + "@test.invalid", name: "Тест " + i, pic: "", sheet: ss.getId(), at: Date.now(), tokens: [] };
      CUR = u; CUR_SS = ss; ensureSheets_();
    }
    const secret = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ""), hash = sha_(secret);
    u.tokens = (u.tokens || []).concat([hash]).slice(-FR.tokens);
    GP_().setProperty("t:" + hash, id);
    userPut_(u);
    secrets.push(secret);
  }
  CUR = null; CUR_SS = null;
  Logger.log(JSON.stringify(secrets));
  return secrets;
}
function loadClean() {
  for (const u of users_()) if (/^load\d+$/.test(u.id)) { CUR = u; deleteMe_(u); }
  CUR = null; CUR_SS = null;
}
