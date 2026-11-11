// Голосовой Изи: настройки, промпт, живой разговор (слушаю → думаю → говорит → слушаю), перебивание,
// черновик сообщения, «напомни, когда придёт зарплата», Изи пишет первым. Провал — строка VOICE_FAIL
import { boot2 } from "./today_boot.mjs"
const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-05T03:00:00Z"),
  events: ({ bkk, iso }) => [{ id: "E1", title: "Показ виллы клиенту", start: iso(bkk(0, 10, 0)), end: iso(bkk(0, 10, 40)), calendar: "Работа", all_day: false, location: "Rawai" },
    { id: "E2", title: "Обед с Олей", start: iso(bkk(0, 14)), end: iso(bkk(0, 15)), calendar: "Личное", all_day: false, location: "Kata" }] })
let fails = 0
const ok = (c, m) => { if (c) console.log("✓", m); else { fails++; console.log("✗", m) } }
// ответы Claude: сначала обычный ответ, для черновика — вызов draft_message
let reply = "Лучше перенести падел на субботу. В пятницу у вас показ до 19:00."
await page.route("https://api.anthropic.com/**", r => r.request().method() === "OPTIONS" ? r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } })
  : r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ content: [{ type: "text", text: reply }], stop_reason: "end_turn" }) }))
await page.evaluate(() => {
  const V = (name, uri) => ({ name, voiceURI: uri, lang: "ru-RU", localService: true, default: false })
  const vs = [V("Milena", "m1"), V("Yuri", "y1"), V("Samantha", "en")].filter(v => v.voiceURI !== "en")
  speechSynthesis.getVoices = () => vs
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t } }
  window.SAID = []
  speechSynthesis.speak = u => { SAID.push({ text: u.text, voice: u.voice && u.voice.name, rate: u.rate }); setTimeout(() => { u.onstart && u.onstart(); if (!window.HOLD) setTimeout(() => u.onend && u.onend(), 20) }, 10) }
  speechSynthesis.cancel = () => { window.CANCELS = (window.CANCELS || 0) + 1 }
  window.RECS = []
  window.SpeechRecognition = class { constructor() { RECS.push(this) } start() { this.on = true } stop() { this.on = false; setTimeout(() => this.onend && this.onend(), 5) } abort() { this.on = false } }
  window.hearSay = t => { const r = RECS[RECS.length - 1]; r.onresult({ results: [Object.assign([{ transcript: t }], { isFinal: true })] }) }
})
// 1. настройки
await page.evaluate(() => setTab("more")); await page.waitForTimeout(400)
ok(await page.$$eval(".izi-card [data-izi-mode]", b => b.length) === 3, "три характера")
ok(await page.$eval(".izi-card .voice-row b", b => b.textContent) === "Yuri", "мужской голос по умолчанию — Юрий")
await page.click('[data-izi-g="f"]'); await page.waitForTimeout(600)
ok(await page.evaluate(() => iziVoice().name) === "Milena", "женский пол — голос Милена")
await page.click('[data-izi-g="m"]'); await page.waitForTimeout(600)
await page.click('[data-izi-mode="coach"]'); await page.waitForTimeout(200)
ok(await page.evaluate(() => IZX().mode === "coach" && /строгий тренер/.test(chatSystem())), "характер «строгий тренер» в промпте")
await page.click('[data-izi-tg="goals"]')
ok(await page.evaluate(() => IZX().goals === false && !/коуч по целям/.test(chatSystem())), "советы по целям выключаются")
await page.click('[data-izi-tg="goals"]')
ok(await page.evaluate(() => IZX().goals && /SMART/.test(chatSystem()) && /психолог|КПТ/.test(chatSystem())), "по умолчанию — советы по целям и психология")
ok(await page.evaluate(() => /draft_message/.test(chatSystem()) && chatTools().some(t => t.name === "remind_when")), "инструменты черновика и «когда…»")
await page.click('[data-izi-rate="1.12"]')
ok(await page.evaluate(() => IZX().rate === 1.12), "темп речи")
// 2. текст для голоса
ok(await page.evaluate(() => sayable("**Готово** 🎉 потратили 450 ฿, см. https://x.y") === "Готово потратили 450 бат, см. ссылка в чате"), "чистка текста для голоса")
ok(await page.evaluate(() => sentences("Раз. Два! Три?").length === 3), "деление на фразы")
// 2б. «Читать ответы вслух» по умолчанию включено; выключили — speak молчит, но сообщает о конце
ok(await page.evaluate(() => IZX().aloud === true && !!document.querySelector('.izi-card [data-izi-tg="aloud"]') || (setTab("more"), false)), "переключатель «Читать ответы вслух», по умолчанию вкл.")
await page.evaluate(() => iziSet("aloud", false))
ok(await page.evaluate(() => new Promise(r => { SAID.length = 0; speak("Тест.", { onEnd: () => r(SAID.length === 0) }) })), "выключено — вслух не читает, разговор идёт дальше")
await page.evaluate(() => iziSet("aloud", true))
// 3. живой разговор
await page.evaluate(() => setTab("chat")); await page.waitForTimeout(300)
await page.click('.chat-tools [data-do="talk"]'); await page.waitForTimeout(500)
ok(await page.evaluate(() => !!TALK && TALK.state === "listen" && /Говорите/.test(document.querySelector(".tk-you").textContent)), "«Поговорить» в чате — разговор, слушаю")
ok(await page.evaluate(() => /живой голосовой разговор/.test(chatSystem())), "в разговоре — правила для голоса в промпте")
await page.evaluate(() => { SAID.length = 0; hearSay("а если в пятницу вечером") })
await page.waitForTimeout(3000)
ok(await page.evaluate(() => D.chat.some(m => m.role === "user" && m.voice && /пятницу вечером/.test(m.text))), "пауза — фраза ушла Изи")
await page.waitForTimeout(800)
const said = await page.evaluate(() => SAID.filter(s => s.text.trim()).map(s => s.text))
ok(said.length === 2 && /субботу/.test(said[0]) && said.every(s => !/[*🎉]/.test(s)), "ответ прочитан вслух по фразам: " + said.join(" | "))
ok(await page.evaluate(() => SAID.filter(s => s.text.trim()).every(s => s.voice === "Yuri" && s.rate === 1.12)), "голос и темп из настроек")
ok(await page.evaluate(() => TALK.state === "listen"), "после ответа снова слушает")
// перебить касанием шара
await page.evaluate(() => { window.HOLD = true; talkHear("Длинный ответ. Ещё фраза. И ещё одна.") }); await page.waitForTimeout(100)
ok(await page.evaluate(() => TALK.state === "say"), "Изи говорит")
const c0 = await page.evaluate(() => window.CANCELS || 0)
await page.click(".tk-orb"); await page.waitForTimeout(100)
ok(await page.evaluate(c0 => TALK.state === "listen" && CANCELS > c0, c0), "касание шара перебивает и слушает")
await page.evaluate(() => { window.HOLD = false })
// пауза и продолжение
await page.click("#talk .tk-in .tk-dict"); ok(await page.evaluate(() => TALK.state === "pause"), "пауза")
await page.click(".tk-orb"); ok(await page.evaluate(() => TALK.state === "listen"), "касание шара на паузе — снова слушает")
// смахнуть вниз — закончить
const box = await page.$eval(".tk-sheet", e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 300 } })
await page.evaluate(({ x, y }) => {
  const el = document.querySelector("#talk"), T = (yy) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: yy })]
  el.dispatchEvent(new TouchEvent("touchstart", { touches: T(y), bubbles: true }))
  el.dispatchEvent(new TouchEvent("touchmove", { touches: T(y + 200), bubbles: true }))
  el.dispatchEvent(new TouchEvent("touchend", { touches: [], bubbles: true }))
}, box)
await page.waitForTimeout(500)
ok(await page.evaluate(() => !TALK && !document.querySelector("#talk")), "смахнуть вниз — разговор закончен")
// 4. черновик сообщения
await page.evaluate(() => runTool("draft_message", { to: "Оля", text: "Оль, прости, показ затянулся — буду к 15:20." }))
reply = "Вот вариант."
await page.evaluate(() => { chatDraft = { to: "Оля", text: "Оль, прости, показ затянулся — буду к 15:20.", phone: "" } })
await page.evaluate(() => { D.chat.push({ role: "assistant", text: "Вот вариант:", at: Date.now(), draft: chatDraft }); chatDraft = null; renderChat() })
ok(await page.$$eval(".draft .dr-opts a, .draft .dr-opts button", b => b.map(x => x.textContent).join(",")) === "WhatsApp,Telegram,Скопировать,Мягче,Короче", "карточка черновика с кнопками")
ok(await page.$eval(".draft a", a => a.href.includes("wa.me/?text=%D0%9E%D0%BB%D1%8C")), "WhatsApp с текстом")
// 5. «напомни, когда придёт зарплата»
await page.evaluate(() => runTool("remind_when", { text: "Купить подарок Оле", on: "income", match: "Зарплата" }))
await page.evaluate(() => iziWhenCheck())
ok(await page.evaluate(() => iziWhen().length === 1), "пока зарплаты нет — ждёт")
await page.evaluate(() => { upsert("money", { id: "inc1", date: Date.now(), type: "income", amount: 120000, method: "transfer", category: "Зарплата", comment: "" }); iziWhenCheck() })
ok(await page.evaluate(() => !iziWhen().length && /пришёл доход «Зарплата»: Купить подарок Оле/.test(D.chat[D.chat.length - 1].text)), "пришла зарплата — напомнил")
await page.evaluate(() => runTool("remind_when", { text: "Отдать ключи", on: "person", match: "Олей" }))
// 6. Изи пишет первым: встреча закончилась — «Как прошло?» (сейчас 10:00 по Бангкоку, показ 10:00–10:40 ещё идёт)
await page.evaluate(() => { D.izi.ps = null; iziProactive() }); await page.waitForTimeout(300)
const last = await page.evaluate(() => D.chat[D.chat.length - 1])
ok(last.pro && /свободно/.test(last.text) || !last.pro, "проверка окна без ошибок")
await page.evaluate(() => { const r = upsert("rems", { id: "r9", title: "Сверить договор", due: null }); D.izi.ps = null; D.chat = []; iziProactive(); renderChat() })
await page.waitForTimeout(300)
const pro = await page.evaluate(() => D.chat.find(m => m.pro))
ok(pro && /свободно/.test(pro.text) && pro.opts.includes("Сверить договор") && pro.opts.includes("Ничего"), "свободное окно — предлагает дело: " + (pro && pro.text))
ok(await page.$$eval("[data-pro]", b => b.length) >= 2, "кнопки выбора под сообщением")
await page.evaluate(() => { D.izi.ps = null; iziSet("first", false); D.chat = []; iziProactive() })
ok(await page.evaluate(() => !D.chat.length), "«Пишет первым» выключено — молчит")
ok(!errors.length, "без ошибок на странице " + errors.join("; "))
console.log(fails ? `VOICE_FAIL ${fails}` : "VOICE_OK")
await browser.close(); server.close()
