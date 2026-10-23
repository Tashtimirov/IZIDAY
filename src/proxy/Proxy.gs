// Доступ друзей к Claude через ваш ключ Anthropic. Ключ хранится только здесь, в свойствах скрипта,
// виджеты друзей его не видят. У каждого телефона — дневной лимит запросов, у всех вместе — общий.
//
// Установка: script.google.com → «Новый проект» → вставить этот код → «Настройки проекта» →
// «Свойства скрипта» → ANTHROPIC_KEY = ваш ключ → «Начать развёртывание» → «Веб-приложение»,
// запуск от вашего имени, доступ «Все» → ссылку /exec прислать для сборки версии друзей.

const TOKEN = "__AI_PROXY_TOKEN__";   // пароль, который знают только виджеты друзей
const MODEL = "claude-sonnet-5-5";
const PER_DEVICE = 40;                 // запросов в день с одного телефона
const TOTAL = 300;                     // запросов в день на всех
const MAX_TOKENS = 4000;

function doGet() {
  return out_({ ok: true, today: usage_() });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_(error_("bad json")); }
  if (!TOKEN || TOKEN.indexOf("__") === 0 || req.token !== TOKEN) return out_(error_("forbidden"));
  const key = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_KEY");
  if (!key) return out_(error_("Владелец ещё не добавил ключ Anthropic"));
  const device = String(req.device || "").slice(0, 40);
  if (!/^[a-z0-9]{8,40}$/.test(device)) return out_(error_("bad device"));
  const body = req.body || {};
  if (!Array.isArray(body.messages)) return out_(error_("bad request"));
  if (!take_(device)) return out_(error_(`Дневной лимит исчерпан (${PER_DEVICE} запросов). Завтра снова заработает.`));

  // Модель и размер ответа задаёт владелец, а не телефон
  body.model = MODEL;
  body.max_tokens = Math.min(Number(body.max_tokens) || 2000, MAX_TOKENS);
  delete body.stream;
  const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify(body),
  });
  return ContentService.createTextOutput(res.getContentText()).setMimeType(ContentService.MimeType.JSON);
}

// Счётчики за сегодня: по телефону и общий. false — лимит исчерпан
function take_(device) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const day = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
    const kd = `n:${day}:${device}`, kt = `n:${day}:*`;
    const nd = Number(props.getProperty(kd) || 0), nt = Number(props.getProperty(kt) || 0);
    if (nd >= PER_DEVICE || nt >= TOTAL) return false;
    props.setProperty(kd, String(nd + 1));
    props.setProperty(kt, String(nt + 1));
    // вчерашние счётчики больше не нужны
    for (const k of props.getKeys()) if (k.indexOf("n:") === 0 && k.indexOf(`n:${day}:`) !== 0) props.deleteProperty(k);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function usage_() {
  const props = PropertiesService.getScriptProperties();
  const day = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
  return { day, total: Number(props.getProperty(`n:${day}:*`) || 0),
    devices: props.getKeys().filter(k => k.indexOf(`n:${day}:`) === 0 && !/\*$/.test(k)).length };
}

const error_ = message => ({ type: "error", error: { type: "proxy_error", message } });
function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
