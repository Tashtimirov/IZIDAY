// Микрофон: распознавание речи Safari (и Chrome) должно запускаться каждый раз, а не только первый.
// iPhone/iPad отдают микрофон одному распознавателю: если прошлый не закрыт до конца
// (stop() не дошёл, страница ушла в фон, остался «немой» звук синтеза), новый молча не слышит.
// Здесь все распознаватели приложения (чат, живой разговор, детский чат) проходят через одну обёртку:
// перед запуском прошлые закрываются, после stop() — гарантированно abort(), висящий синтез снимается.
(function () {
  "use strict"
  const Orig = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Orig || Orig.__iziWrapped) return
  const live = new Set()
  const W = window.IZI_MIC = { live, starts: 0, retries: 0 }

  const quietTTS = () => {
    // Свой голос Изи (TTS.speaking) не трогаем — его останавливает сам код. Снимаем только «залипший»
    // синтез: пустую фразу разблокировки или очередь, которая на iOS держит звук в режиме воспроизведения.
    try {
      const s = window.speechSynthesis
      const own = typeof TTS !== "undefined" && TTS && TTS.speaking
      if (s && !own && (s.speaking || s.pending || s.paused)) s.cancel()
    } catch (e) {}
  }

  class IziSR extends Orig {
    constructor() {
      super()
      this.__on = false
      this.__heard = false
      this.__dog = null
      this.addEventListener("start", () => { this.__on = true })
      this.addEventListener("result", () => { this.__heard = true })
      this.addEventListener("end", () => {
        this.__on = false
        clearTimeout(this.__dog)
        live.delete(this)
      })
    }
    start() {
      if (live.has(this)) return
      quietTTS()
      const others = [...live].filter(r => r !== this)
      others.forEach(r => { try { r.abort() } catch (e) {} ; live.delete(r) })
      live.add(this)
      this.__heard = false
      W.starts++
      const go = () => {
        if (!live.has(this)) return
        try { super.start() } catch (e) {
          if (e && e.name === "InvalidStateError") return
          live.delete(this)
          throw e
        }
      }
      if (!others.length) return go()
      // Прошлый распознаватель ещё держал микрофон — даём iOS отпустить его.
      setTimeout(() => { try { go() } catch (e) { this.__fail(e) } }, 350)
    }
    __fail(e) {
      live.delete(this)
      try { this.dispatchEvent(Object.assign(new Event("error"), { error: "audio-capture", message: String(e && e.message || e) })) } catch (x) {}
      try { this.dispatchEvent(new Event("end")) } catch (x) {}
    }
    stop() {
      try { super.stop() } catch (e) {}
      // В Safari stop() иногда не завершает распознавание — тогда микрофон остаётся занятым навсегда.
      clearTimeout(this.__dog)
      this.__dog = setTimeout(() => { if (live.has(this)) this.abort() }, 1200)
    }
    abort() {
      clearTimeout(this.__dog)
      try { super.abort() } catch (e) {}
      // Если «end» так и не придёт, всё равно считаем микрофон свободным.
      setTimeout(() => live.delete(this), 600)
    }
  }
  IziSR.__iziWrapped = true
  try { new IziSR() } catch (e) { return } // браузер не даёт обернуть — оставляем как было
  if (window.SpeechRecognition) window.SpeechRecognition = IziSR
  if (window.webkitSpeechRecognition) window.webkitSpeechRecognition = IziSR

  // Ушли в фон / свернули приложение — отпускаем микрофон, иначе после возврата он «занят».
  const release = () => { [...live].forEach(r => { try { r.abort() } catch (e) {} }) }
  document.addEventListener("visibilitychange", () => { if (document.hidden) release() })
  window.addEventListener("pagehide", release)
})()
