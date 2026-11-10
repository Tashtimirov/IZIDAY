// ── Точное распознавание речи: Whisper large-v3 на Groq (бесплатный ключ) ──
// Safari распознаёт на лету и часто пишет чепуху, а потом переправляет. Здесь иначе: звук пишется сам
// (WAV 16 кГц, без потерь), паузы ловятся по громкости, и вся фраза целиком уходит в Whisper —
// он видит её всю сразу и знает контекст (имя помощника, последний ответ, слова из памяти).
// Нет ключа, нет сети или Groq не ответил — работает обычное распознавание Safari.
;(function () {
  const RATE = 16000
  const MODEL = "whisper-large-v3"
  const URL_ = "https://api.groq.com/openai/v1/audio/transcriptions"
  // Whisper на тишине «досочиняет» титры из роликов — такие куски выбрасываем
  const JUNK = /(продолжение следует|субтитр|dimatorzok|спасибо за (просмотр|внимание)|подписывайтесь|ставьте лайк|редактор|корректор|амара|amara\.org|смотрите (далее|в следующей))/i

  const key = () => (typeof D !== "undefined" && D && D.stt && D.stt.key) || ""
  const on = () => !!(key() && (!D.stt || D.stt.mode !== "safari") && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext))

  // Подсказка для Whisper: как пишутся имена и слова этого человека, о чём сейчас разговор
  function prompt() {
    const p = []
    try { p.push(`${iziName()}, привет.`) } catch (e) { p.push("Изи, привет.") }
    try {
      const last = (D.chat || []).filter(m => m.role === "assistant" && m.text).slice(-1)[0]
      if (last) p.push(String(last.text).replace(/[*_#`>\[\]()]/g, "").replace(/\s+/g, " ").slice(-180))
    } catch (e) {}
    try { const w = (D.stt && D.stt.words) || ""; if (w) p.push(w) } catch (e) {}
    return p.join(" ").slice(-600)
  }

  // ── Запись: микрофон → моно 16 кГц → WAV; громкость — для пауз и для волны ──
  // Один звуковой контекст на всё время: iPhone разрешает его запустить только по касанию — поэтому
  // он создаётся синхронно в первом нажатии и дальше живёт (в разговоре микрофон включается и без касания)
  let CTX = null, ACTIVE = 0, STREAM = null, SRC = null
  // Один микрофон на весь живой разговор. iPhone: если отпустить микрофон и через пару секунд (после голоса Изи)
  // взять заново, новый поток в том же звуковом контексте часто отдаёт тишину — одни нули. Поэтому пока
  // разговор открыт, поток держим и только подключаем/отключаем запись; отпускаем — release() при закрытии
  const alive = st => !!st && st.getAudioTracks().some(t => t.readyState === "live" && t.enabled)
  async function getStream(ctx) {
    if (alive(STREAM) && SRC && SRC.context === ctx) return { stream: STREAM, src: SRC }
    release()
    STREAM = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
    SRC = null
    return { stream: STREAM, src: null }
  }
  function release() {
    try { SRC && SRC.disconnect() } catch (e) {}
    try { STREAM && STREAM.getTracks().forEach(t => t.stop()) } catch (e) {}
    STREAM = null; SRC = null
  }
  function prime() {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!CTX || CTX.state === "closed") CTX = new AC()
    try { if (CTX.state !== "running") CTX.resume() } catch (e) {}
    return CTX
  }
  async function record(opts = {}) {
    const ctx = prime()
    const got = await getStream(ctx), stream = got.stream
    try { if (ctx.state !== "running") await ctx.resume() } catch (e) {}
    // iPhone после голоса Изи может оставить звук «прерванным»: ещё раз попробовать, иначе — честно сказать, что не пишется
    if (ctx.state !== "running") { await new Promise(r => setTimeout(r, 300)); try { await ctx.resume() } catch (e) {} }
    if (ctx.state !== "running") { release(); const e = new Error("audio context " + ctx.state); e.name = "CtxDown"; throw e }
    const src = got.src || (SRC = ctx.createMediaStreamSource(stream))
    const node = ctx.createScriptProcessor(4096, 1, 1)
    const ratio = ctx.sampleRate / RATE
    const h = { parts: [], len: 0, level: 0, noise: .004, voiced: 0, lastVoice: 0, t0: Date.now(), stopped: false, stream, ctx, frames: 0, peak: 0, opts }
    let carry = 0
    node.onaudioprocess = ev => {
      if (h.stopped) return
      h.frames++
      const x = ev.inputBuffer.getChannelData(0)
      if (h.peak < 1e-6) for (let i = 0; i < x.length; i += 16) { const a = Math.abs(x[i]); if (a > h.peak) h.peak = a }   // живой микрофон никогда не отдаёт ровные нули
      // уровень (RMS) и простая граница речи: заметно громче фонового шума
      let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]
      const rms = Math.sqrt(s / x.length)
      h.level = rms
      const loud = rms > Math.max(.012, h.noise * 3.2)
      if (!loud) h.noise = h.noise * .96 + rms * .04   // шум подстраивается только в тишине
      if (loud) { h.voiced += x.length / ctx.sampleRate; h.lastVoice = Date.now(); h.opts.onVoice && h.opts.onVoice(rms) }
      if (h.opts.onLevel) h.opts.onLevel(rms, x.length / ctx.sampleRate)   // каждый кадр — для «перебить голосом»
      // понижение частоты до 16 кГц (усреднение)
      const n = Math.floor((x.length - carry) / ratio)
      const out = new Float32Array(Math.max(0, n))
      for (let i = 0; i < n; i++) {
        const a = Math.floor(carry + i * ratio), b = Math.min(x.length, Math.floor(carry + (i + 1) * ratio))
        let m = 0; for (let j = a; j < b; j++) m += x[j]
        out[i] = b > a ? m / (b - a) : x[a] || 0
      }
      carry = carry + n * ratio - x.length; if (carry < 0) carry = 0
      h.parts.push(out); h.len += out.length
    }
    src.connect(node); node.connect(ctx.destination); ACTIVE++
    h.wav = () => wav(h.parts, h.len)
    h.abort = h.stop = () => h.close()   // как у распознавания Safari: старый код просто «обрывает» запись
    h.secs = () => h.len / RATE
    // оставить только последние sec секунд (запись передаётся дальше — например, с момента, когда человек перебил Изи)
    h.keepLast = sec => {
      let need = Math.round(sec * RATE), out = []
      for (let i = h.parts.length - 1; i >= 0 && need > 0; i--) { const p = h.parts[i]; out.unshift(p.length > need ? p.slice(p.length - need) : p); need -= p.length }
      h.parts = out; h.len = out.reduce((a, p) => a + p.length, 0)
    }
    h.close = () => {
      if (h.stopped) return; h.stopped = true
      try { src.disconnect(node) } catch (e) {}
      try { node.disconnect() } catch (e) {}
      if (!window.TALK) release()   // вне живого разговора микрофон отпускаем сразу; в разговоре — при закрытии
      if (--ACTIVE <= 0) { ACTIVE = 0; setTimeout(() => { if (!ACTIVE && !window.TALK) try { ctx.suspend() } catch (e) {} }, 400) }   // в живом разговоре не усыплять: iPhone не разбудит его без касания, и после ответа Изи микрофон оглохнет   // звук не держим, когда никто не пишет
    }
    return h
  }
  function wav(parts, len) {
    const b = new ArrayBuffer(44 + len * 2), v = new DataView(b)
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
    w(0, "RIFF"); v.setUint32(4, 36 + len * 2, true); w(8, "WAVE"); w(12, "fmt ")
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, RATE, true)
    v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, len * 2, true)
    let o = 44
    for (const p of parts) for (let i = 0; i < p.length; i++, o += 2) { const s = Math.max(-1, Math.min(1, p[i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true) }
    return new Blob([b], { type: "audio/wav" })
  }

  // ── Whisper: вся фраза целиком, язык русский, температура 0 ──
  async function transcribe(blob, signal, k = key()) {
    const f = new FormData()
    f.append("file", blob, "speech.wav")
    f.append("model", MODEL)
    f.append("language", "ru")
    f.append("temperature", "0")
    f.append("response_format", "verbose_json")
    f.append("prompt", prompt())
    const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + k }, body: f, signal })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { const e = new Error((j.error && j.error.message) || "Groq " + r.status); e.status = r.status; throw e }
    return clean(j)
  }
  function clean(j) {
    const segs = Array.isArray(j.segments) ? j.segments : null
    let t = segs ? segs.filter(s => !(s.no_speech_prob > .6 && s.avg_logprob < -.7) && !JUNK.test(s.text || "")).map(s => s.text).join(" ") : String(j.text || "")
    t = t.replace(/\s+/g, " ").trim()
    if (JUNK.test(t) && t.length < 80) t = ""
    if (/^[.,!?…\s-]*$/.test(t)) t = ""
    return t
  }

  // ── Настройки: «Помощник» → «Распознавание речи» ──
  function row() {
    const k = key(), m = (D.stt && D.stt.mode) || "whisper"
    const t = !k ? "Обычное — iPhone" : m === "safari" ? "Обычное — iPhone" : "Точное — Whisper"
    const sub = !k ? "ошибается на лету · нажмите, чтобы сделать точнее бесплатно" : m === "safari" ? "ключ Groq подключён · нажмите, чтобы включить точное" : "фраза целиком, с запятыми и именами · бесплатно"
    return `<button class="set voice-row" data-do="stt"><span><b>${t}</b><small>${sub}</small></span><i class="chev">${ICO.chev}</i></button>`
  }
  function sheetOpen() {
    D.stt = D.stt || {}
    const k = key(), m = D.stt.mode || "whisper"
    const s = sheet(`<h3>Распознавание речи</h3>
      <div class="msg">Сейчас ${k && m !== "safari" ? "речь распознаёт Whisper — одна из самых точных моделей для русского" : "речь распознаёт iPhone: на лету, поэтому сначала пишет чепуху и не всегда успевает исправить"}.</div>
      ${k ? `<div class="field"><div class="seg two" id="stt-m"><button data-m="whisper" class="${m !== "safari" ? "on" : ""}">Точное — Whisper</button><button data-m="safari" class="${m === "safari" ? "on" : ""}">Обычное — iPhone</button></div></div>
        <div class="muted small">Точное: пока вы говорите — волна, слова появляются после паузы, сразу правильные. Не ответил сервер — само переключится на iPhone.</div>
        <div class="field"><label>Имена и слова, которые путаются</label><textarea id="stt-w" rows="2" placeholder="Например: Ильдар, падел, Grand Prime, Пхукет">${esc(D.stt.words || "")}</textarea></div>
        <div class="btns"><button class="btn" data-a="del">Убрать ключ</button><button class="btn primary" data-a="save">Готово</button></div>`
      : `<div class="msg">Whisper слушает фразу целиком и пишет почти без ошибок. Бесплатно: нужен ключ Groq, до 8 часов речи в день.</div>
        <div class="fsteps"><div><b>1</b>Откройте сайт Groq и войдите через Google.</div><div><b>2</b>Нажмите «Create API Key», назовите «IZIDAY» и скопируйте ключ.</div><div><b>3</b>Вставьте его сюда — ${esc(iziName())} проверит, что он работает.</div></div>
        <div class="btns"><button class="btn" data-a="open">Открыть сайт</button></div>
        <div class="field"><label>Ключ</label><input id="stt-k" placeholder="gsk_…" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
        <div class="btns"><button class="btn" data-a="paste">Вставить</button><button class="btn primary" data-a="ok">Проверить и сохранить</button></div>`}
      <div class="msg" id="stt-msg"></div>
      <div class="muted small" style="margin-top:8px">Ключ хранится только на этом телефоне. Звук фразы уходит в Groq только чтобы превратить его в текст.</div>`)
    const $s = q => s.el.querySelector(q), msg = $s("#stt-msg")
    const done = () => { save(false); s.close(); render() }
    if (k) {
      s.el.querySelectorAll("#stt-m button").forEach(b => b.onclick = () => { D.stt.mode = b.dataset.m; s.el.querySelectorAll("#stt-m button").forEach(x => x.classList.toggle("on", x === b)); save(false) })
      $s('[data-a="save"]').onclick = () => { D.stt.words = $s("#stt-w").value.trim().slice(0, 300); done(); toast("Сохранено") }
      $s('[data-a="del"]').onclick = () => { delete D.stt.key; done(); toast("Ключ убран — распознаёт iPhone") }
      return
    }
    const inp = $s("#stt-k")
    $s('[data-a="open"]').onclick = () => window.open("https://console.groq.com/keys", "_blank")
    $s('[data-a="paste"]').onclick = async () => { try { inp.value = (await navigator.clipboard.readText()).trim() } catch (e) { inp.focus() } }
    $s('[data-a="ok"]').onclick = async () => {
      const v = inp.value.trim()
      if (!/^gsk_[A-Za-z0-9]{20,}$/.test(v)) { msg.textContent = "Это не похоже на ключ Groq: он начинается с «gsk_» и довольно длинный"; return }
      msg.textContent = "Проверяю…"
      try {
        const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: "Bearer " + v } })
        if (r.status === 401 || r.status === 403) { msg.textContent = "Ключ не подошёл. Скопируйте его ещё раз целиком."; return }
        if (!r.ok) { msg.textContent = "Groq ответил ошибкой " + r.status + ". Попробуйте чуть позже."; return }
      } catch (e) { msg.textContent = "Нет связи — попробуйте ещё раз."; return }
      D.stt.key = v; D.stt.mode = "whisper"; done(); toast("Точное распознавание включено")
    }
  }

  window.STT = { row, sheetOpen, on, prime, record, release, live: () => alive(STREAM), transcribe, clean, key, prompt, JUNK }
})()
