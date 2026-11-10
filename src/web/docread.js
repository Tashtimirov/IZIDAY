// Чтение документов прямо в телефоне: Word, Excel, PowerPoint, OpenDocument, RTF, EPUB, текст, таблицы CSV,
// старые .doc/.xls/.ppt (насколько получится) и файлы Pages/Numbers/Keynote (по их картинке-превью).
// Из файла достаётся текст — его и видит Изи. PDF и фото идут как раньше, мимо этого модуля.
;(function () {
  const MAX_TEXT = 150000   // столько символов Изи получает за раз (≈ 60–80 страниц); остальное отрезается с пометкой

  const ext = name => ((String(name || "").match(/\.([a-z0-9]+)$/i) || [])[1] || "").toLowerCase()
  const KIND = {
    docx: "Word", docm: "Word", dotx: "Word", doc: "Word (старый формат)", rtf: "RTF",
    xlsx: "Excel", xlsm: "Excel", xls: "Excel (старый формат)", csv: "таблица CSV", tsv: "таблица",
    pptx: "PowerPoint", ppsx: "PowerPoint", ppt: "PowerPoint (старый формат)",
    odt: "документ OpenDocument", ods: "таблица OpenDocument", odp: "презентация OpenDocument",
    epub: "книга EPUB", pages: "Pages", numbers: "Numbers", key: "Keynote",
    txt: "текст", md: "текст", json: "JSON", xml: "XML", html: "веб-страница", htm: "веб-страница",
    ics: "календарь", vcf: "контакты", log: "текст", yaml: "текст", yml: "текст",
  }
  // что выбирается кнопкой «Файл» (iOS серит всё, чего нет в списке)
  const isDoc = f => !!KIND[ext(f.name)] || /officedocument|msword|ms-excel|ms-powerpoint|opendocument|rtf|^text\//i.test(f.type || "")

  // ── zip: свои двадцать строк вместо библиотеки; распаковка — встроенный DecompressionStream ──
  async function unzip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf)
    let e = -1
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break }
    if (e < 0) throw new Error("файл повреждён или это не документ")
    const n = dv.getUint16(e + 10, true)
    let p = dv.getUint32(e + 16, true)
    const files = {}
    for (let k = 0; k < n && dv.getUint32(p, true) === 0x02014b50; k++) {
      const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true)
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true)
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl))
      files[name] = { method, size, off }
      p += 46 + nl + xl + cl
    }
    const raw = async name => {
      const f = files[name]; if (!f) return null
      const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true)
      const data = u8.subarray(start, start + f.size)
      if (f.method === 0) return data
      if (f.method !== 8) throw new Error("непривычное сжатие внутри файла")
      if (typeof DecompressionStream === "undefined") throw new Error("браузер слишком старый — обновите iOS или откройте в Safari")
      const s = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
      return new Uint8Array(await new Response(s).arrayBuffer())
    }
    const text = async name => { const b = await raw(name); return b ? new TextDecoder().decode(b) : "" }
    return { names: Object.keys(files), raw, text }
  }

  const ent = s => s.replace(/&(#x?[0-9a-f]+|lt|gt|amp|quot|apos|nbsp);/gi, (m, c) => {
    const l = c.toLowerCase()
    if (l[0] === "#") return String.fromCodePoint(l[1] === "x" ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10))
    return { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", nbsp: " " }[l]
  })
  const tidy = s => s.replace(/ \|[ \t]*$/gm, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  const byNum = (a, b) => (parseInt(a.replace(/\D+/g, "")) || 0) - (parseInt(b.replace(/\D+/g, "")) || 0)

  // Word: абзацы, списки (• или номер), таблицы (ячейки через « | »)
  const lastP = p => { let i = -1; p.replace(/<w:p[ >]/g, (m, at) => { i = at; return m }); return i < 0 ? p.length : i }
  function wordXml(x, fmt = {}) {
    const out = [], cnt = {}
    for (const p of x.split(/<\/w:p>/)) {
      const at = lastP(p), tail = p.slice(at)   // только сам абзац (до него могла закрыться ячейка таблицы)
      let s = ""
      tail.replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\b[^>]*\/>|<w:cr\/>|<w:noBreakHyphen\/>/g, (m, t) => {
        s += t != null ? ent(t) : m.startsWith("<w:tab") ? "\t" : m.startsWith("<w:no") ? "-" : "\n"; return ""
      })
      const st = (tail.match(/<w:pStyle w:val="([^"]+)"/) || [])[1]
      let num = tail.match(/<w:numPr>[\s\S]*?<w:ilvl w:val="(\d+)"[\s\S]*?<w:numId w:val="(\d+)"/) || tail.match(/<w:numPr>[\s\S]*?<w:numId w:val="(\d+)"/)
      if (!num && st && fmt.style && fmt.style[st]) num = [null, fmt.style[st].lvl, fmt.style[st].id]   // список задан стилем («Нумерованный список»)
      if (st && /^(Heading\d|Title|Заголовок)/i.test(st) && s.trim()) s = "# " + s
      if (num && s.trim()) {
        const lvl = num.length > 2 ? +num[1] : 0, id = num.length > 2 ? num[2] : num[1], key = id + ":" + lvl
        cnt[key] = (cnt[key] || 0) + 1
        Object.keys(cnt).forEach(k => { const [i2, l2] = k.split(":"); if (i2 === id && +l2 > lvl) delete cnt[k] })   // новый пункт — подсписок нумеруется заново
        s = "  ".repeat(lvl) + (fmt[key] === "bullet" ? "• " : cnt[key] + ". ") + s
      }
      const before = p.slice(0, at)
      if (/<\/w:tc>/.test(before) && out.length && !/<\/w:tr>/.test(before)) out[out.length - 1] += " | "
      out.push(s)
    }
    // строки таблиц склеены через « | »: абзацы одной ячейки идут в одну строку
    return tidy(out.join("\n").replace(/ \| \n/g, " | ").replace(/\n \| /g, " | "))
  }

  async function docx(z) {
    // какие списки маркированные (•), а какие нумерованные (1. 2. 3.)
    const nx = await z.text("word/numbering.xml"), abs = {}, fmt = {}
    nx.replace(/<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g, (m, id, body) => {
      abs[id] = {}; body.replace(/<w:lvl\b[^>]*w:ilvl="(\d+)"[^>]*>[\s\S]*?<w:numFmt w:val="(\w+)"/g, (m2, l, f) => { abs[id][l] = f; return "" }); return ""
    })
    nx.replace(/<w:num\b[^>]*w:numId="(\d+)"[^>]*>[\s\S]*?<w:abstractNumId w:val="(\d+)"/g, (m, n, a) => { Object.entries(abs[a] || {}).forEach(([l, f]) => { fmt[n + ":" + l] = f }); return "" })
    fmt.style = {}
    ;(await z.text("word/styles.xml")).replace(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g, (m, id, body) => {
      const n = body.match(/<w:numId w:val="(\d+)"/); if (n && n[1] !== "0") fmt.style[id] = { id: n[1], lvl: +((body.match(/<w:ilvl w:val="(\d+)"/) || [])[1] || 0) }; return ""
    })
    let t = wordXml(await z.text("word/document.xml"), fmt)
    const notes = await z.text("word/footnotes.xml")
    if (notes) { const n = wordXml(notes); if (n.replace(/\d+\.\s*/g, "").trim()) t += "\n\nСноски:\n" + n }
    return t
  }

  // Excel: каждый лист — строками, ячейки через « | », пустые ячейки на своих местах
  async function xlsx(z) {
    const shared = []
    ;(await z.text("xl/sharedStrings.xml")).replace(/<si>([\s\S]*?)<\/si>/g, (m, si) => {
      let s = ""; si.replace(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g, (m2, t) => { s += ent(t); return "" }); shared.push(s); return ""
    })
    const rels = {}
    ;(await z.text("xl/_rels/workbook.xml.rels")).replace(/<Relationship\b[^>]*>/g, r => {
      const id = (r.match(/Id="([^"]+)"/) || [])[1], tg = (r.match(/Target="([^"]+)"/) || [])[1]
      if (id && tg) rels[id] = tg.replace(/^\/?(xl\/)?/, "xl/"); return ""
    })
    const sheets = []
    ;(await z.text("xl/workbook.xml")).replace(/<sheet\b[^>]*>/g, s => {
      const name = ent((s.match(/name="([^"]*)"/) || [])[1] || ""), rid = (s.match(/r:id="([^"]+)"/) || [])[1]
      sheets.push({ name, path: rels[rid] }); return ""
    })
    if (!sheets.length) z.names.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort(byNum).forEach((p, i) => sheets.push({ name: `Лист ${i + 1}`, path: p }))
    const col = r => { let n = 0; for (const ch of (r.match(/^[A-Z]+/) || [""])[0]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1 }
    const parts = []
    for (const sh of sheets) {
      const x = sh.path && await z.text(sh.path); if (!x) continue
      const rows = []
      x.replace(/<row\b[^>]*>([\s\S]*?)<\/row>/g, (m, row) => {
        const cells = []
        row.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (m2, at, body) => {
          const r = (at.match(/r="([A-Z]+)\d+"/) || [])[1], t = (at.match(/t="(\w+)"/) || [])[1]
          let v = body ? ((body.match(/<v>([\s\S]*?)<\/v>/) || [])[1]) : null
          if (t === "inlineStr" && body) { v = ""; body.replace(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g, (m3, s) => { v += s; return "" }) }
          if (v == null) return ""
          v = t === "s" ? shared[+v] || "" : ent(v)
          if (t === "b") v = v === "1" ? "да" : "нет"
          cells[r ? col(r) : cells.length] = String(v).replace(/\s*\n\s*/g, " ")
          return ""
        })
        if (cells.some(c => c && c.trim())) rows.push(Array.from(cells, c => c || "").join(" | ").replace(/( \| )+$/, ""))
        return ""
      })
      if (rows.length) parts.push((sheets.length > 1 ? `Лист «${sh.name}»:\n` : "") + rows.join("\n"))
    }
    return parts.join("\n\n")
  }

  // PowerPoint: слайд за слайдом, плюс заметки докладчика
  async function pptx(z) {
    const grab = x => { const ps = []; x.split(/<\/a:p>/).forEach(p => { let s = ""; p.replace(/<a:t>([^<]*)<\/a:t>|<a:br\/>/g, (m, t) => { s += t != null ? ent(t) : "\n"; return "" }); if (s.trim()) ps.push(s) }); return ps.join("\n") }
    const out = []
    const slides = z.names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(byNum)
    for (const [i, s] of slides.entries()) {
      let t = grab(await z.text(s))
      const note = await z.text(s.replace("slides/slide", "notesSlides/notesSlide"))
      const nt = note && grab(note).replace(/^\d+$/m, "").trim()
      if (nt) t += `\n(заметки: ${nt})`
      out.push(`— Слайд ${i + 1} —\n${t.trim() || "(без текста)"}`)
    }
    return out.join("\n\n")
  }

  // OpenDocument (LibreOffice, Google Документы при скачивании в .odt)
  async function odf(z) {
    let slide = 0
    const x = (await z.text("content.xml")).replace(/^[\s\S]*?<office:body>/, "")
      .replace(/<presentation:notes\b[\s\S]*?<\/presentation:notes>/g, m => { const t = m.replace(/<\/text:p>/g, " ").replace(/<[^>]+>/g, "").replace(/&lt;number&gt;/g, "").trim(); return t ? `<text:p>(заметки: ${t})</text:p>` : "" })
      .replace(/<draw:page[\s>]/g, m => `\n\n— Слайд ${++slide} —\n` + m)
      // ячейка таблицы — одной строкой, ячейки через « | »
      .replace(/<table:table-cell\b[^>]*?(?:\/>|>([\s\S]*?)<\/table:table-cell>)/g, (m, c) => c ? c.replace(/<\/text:(p|h)>/g, " ").replace(/<text:(p|h)\b[^>]*>/g, "").trim() + " | " : " | ")
    return tidy(ent(x
      .replace(/<text:s\b[^>]*?(?:text:c="(\d+)")?[^>]*\/>/g, (m, c) => " ".repeat(+c || 1))
      .replace(/<text:tab\/>/g, "\t").replace(/<text:line-break\/>/g, "\n")
      .replace(/<table:table\b[^>]*table:name="([^"]*)"[^>]*>/g, "\n\nТаблица «$1»:\n")
      .replace(/<\/table:table-row>/g, "\n")
      .replace(/<\/text:(p|h)>/g, m => m + "\n")
      .replace(/<[^>]+>/g, "")
    ).replace(/(?: \| )+(?=\n|$)/g, "").replace(/^(?: \| )+/gm, "").replace(/\n /g, "\n"))
  }

  async function epub(z) {
    const opf = z.names.find(n => /\.opf$/i.test(n))
    let order = []
    if (opf) {
      const x = await z.text(opf), dir = opf.includes("/") ? opf.slice(0, opf.lastIndexOf("/") + 1) : "", man = {}
      x.replace(/<item\b[^>]*>/g, it => { const id = (it.match(/id="([^"]+)"/) || [])[1], h = (it.match(/href="([^"]+)"/) || [])[1]; if (id && h) man[id] = dir + decodeURIComponent(h); return "" })
      x.replace(/<itemref\b[^>]*idref="([^"]+)"/g, (m, id) => { if (man[id]) order.push(man[id]); return "" })
    }
    if (!order.length) order = z.names.filter(n => /\.x?html?$/i.test(n)).sort()
    const out = []
    for (const p of order) out.push(htmlText(await z.text(p)))
    return out.join("\n\n")
  }

  // Pages / Numbers / Keynote: сам текст у Apple закрыт, но внутри лежит картинка первой страницы — Изи её увидит
  async function apple(z) {
    const pv = ["preview.jpg", "QuickLook/Thumbnail.jpg", "preview-web.jpg", "QuickLook/Preview.jpg"].find(n => z.names.includes(n))
    if (!pv) throw new Error("файлы Pages, Numbers и Keynote не читаются напрямую — экспортируйте в PDF или Word («Поделиться» → «Экспортировать»)")
    const b = await z.raw(pv)
    return { image: new Blob([b], { type: "image/jpeg" }) }
  }

  function htmlText(h) {
    return tidy(ent(String(h)
      .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, "")
      .replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (m, row) => {   // строка таблицы — ячейки через « | »
        const cells = []; row.replace(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi, (m2, t, c) => { cells.push(c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()); return "" })
        return "\n" + cells.join(" | ") + "\n" })
      .replace(/<br\s*\/?>/gi, "\n").replace(/<li\b[^>]*>/gi, "\n• ")
      .replace(/<\/(p|div|h\d|tr|li|section|article|blockquote|pre|table|ul|ol)>/gi, "\n")
      .replace(/<[^>]+>/g, "")).replace(/[ \t]{2,}/g, " "))
  }

  // RTF: снимаем разметку, переводим \'e0 и ၲ в буквы (кодировка из \ansicpg, обычно 1251 у русских файлов)
  function rtf(s) {
    const cp = (s.match(/\\ansicpg(\d+)/) || [])[1] || "1252"
    let dec; try { dec = new TextDecoder("windows-" + cp) } catch (e) { dec = new TextDecoder("windows-1252") }
    let out = "", depth = 0, skipAt = -1, uc = 1, skip = 0, bytes = []
    const flush = () => { if (bytes.length) { out += dec.decode(new Uint8Array(bytes)); bytes = [] } }
    const SKIP = /^(fonttbl|colortbl|stylesheet|info|pict|object|themedata|colorschememapping|datastore|latentstyles|listtable|listoverridetable|rsidtbl|generator|xmlnstbl|mmathPr|header|footer|headerl|headerr|footerl|footerr)$/
    for (let i = 0; i < s.length; i++) {
      const c = s[i]
      if (c === "{") { depth++; continue }
      if (c === "}") { if (depth === skipAt) skipAt = -1; depth--; continue }
      if (c === "\\") {
        const m = s.slice(i + 1).match(/^([a-z]+)(-?\d+)? ?|^'([0-9a-f]{2})|^([\\{}~_\-*])|^(\r?\n)/i)
        if (!m) continue
        i += m[0].length
        if (skipAt >= 0) continue
        if (m[3]) { if (skip) { skip--; continue } bytes.push(parseInt(m[3], 16)); continue }
        flush()
        if (m[4]) { if (m[4] === "*") { skipAt = depth } else if (m[4] === "~") out += " "; else if (m[4] === "_" || m[4] === "-") out += m[4] === "_" ? "-" : ""; else out += m[4]; continue }
        if (m[5]) { out += "\n"; continue }
        const w = m[1], n = m[2]
        if (SKIP.test(w)) { skipAt = depth; continue }
        if (w === "par" || w === "line" || w === "sect" || w === "page" || w === "row") out += "\n"
        else if (w === "tab") out += "\t"
        else if (w === "cell") out += " | "
        else if (w === "uc") uc = +n
        else if (w === "u") { out += String.fromCharCode(+n < 0 ? +n + 65536 : +n); skip = uc }
        else if (w === "emdash") out += "—"; else if (w === "endash") out += "–"; else if (w === "bullet") out += "•"
        else if (w === "lquote" || w === "rquote") out += "'"; else if (w === "ldblquote" || w === "rdblquote") out += '"'
        continue
      }
      if (skipAt >= 0 || c === "\r" || c === "\n") continue
      if (skip) { skip--; continue }
      flush(); out += c
    }
    flush()
    return tidy(out.replace(/^[ \t]+(?=\S)/gm, ""))
  }

  // Обычный текст: UTF-8, UTF-16 или Windows-1251 (так часто приходят старые русские .txt и .csv)
  function decodeText(u8) {
    if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder("utf-16le").decode(u8.subarray(2))
    if (u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder("utf-16be").decode(u8.subarray(2))
    try { return new TextDecoder("utf-8", { fatal: true }).decode(u8).replace(/^﻿/, "") } catch (e) { return new TextDecoder("windows-1251").decode(u8) }
  }
  const looksText = u8 => { const n = Math.min(u8.length, 4096); let bad = 0; for (let i = 0; i < n; i++) { const b = u8[i]; if (b === 0) return false; if (b < 9 || (b > 13 && b < 32)) bad++ } return bad < n * 0.02 }

  // Старые .doc/.xls/.ppt — это «файл в файле» (OLE): достаём нужный поток, где лежит сам текст,
  // чтобы не цеплять названия стилей и шрифтов из соседних потоков
  function ole(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
    const ss = 1 << dv.getUint16(30, true), ms = 1 << dv.getUint16(32, true), cutoff = dv.getUint32(56, true)
    const sec = i => u8.subarray(512 + i * ss, 512 + (i + 1) * ss)
    const difat = []
    for (let i = 0; i < 109; i++) { const v = dv.getUint32(76 + i * 4, true); if (v < 0xfffffffa) difat.push(v) }
    for (let d = dv.getUint32(68, true), n = 0; d < 0xfffffffa && n < 1000; n++) {
      const b = sec(d), bv = new DataView(b.buffer, b.byteOffset, b.byteLength)
      for (let i = 0; i < ss / 4 - 1; i++) { const v = bv.getUint32(i * 4, true); if (v < 0xfffffffa) difat.push(v) }
      d = bv.getUint32(ss - 4, true)
    }
    const fat = []
    for (const s of difat) { const b = sec(s), bv = new DataView(b.buffer, b.byteOffset, b.byteLength); for (let i = 0; i < ss / 4; i++) fat.push(bv.getUint32(i * 4, true)) }
    const chain = (start, tbl) => { const out = []; for (let x = start; x < 0xfffffffa && out.length < 1e6 && x < tbl.length + 1; x = tbl[x]) out.push(x); return out }
    const join = (list, get, size) => { const out = new Uint8Array(list.length * size); list.forEach((x, i) => out.set(get(x), i * size)); return out }
    const big = (start, len) => join(chain(start, fat), sec, ss).subarray(0, len)
    const dir = big(dv.getUint32(48, true), Infinity), dd = new DataView(dir.buffer, dir.byteOffset, dir.byteLength), ents = []
    for (let o = 0; o + 128 <= dir.length; o += 128) {
      const nl = dd.getUint16(o + 64, true); if (!nl) continue
      ents.push({ name: new TextDecoder("utf-16le").decode(dir.subarray(o, o + nl - 2)), type: dir[o + 66], start: dd.getUint32(o + 116, true), size: dd.getUint32(o + 120, true) })
    }
    const root = ents.find(e => e.type === 5)
    let mini = null, minifat = null
    const stream = name => {
      const e = ents.find(x => x.name === name && x.type === 2); if (!e) return null
      if (e.size >= cutoff) return big(e.start, e.size)
      if (!mini) {
        mini = big(root.start, root.size)
        const mf = big(dv.getUint32(60, true), dv.getUint32(64, true) * ss), mv = new DataView(mf.buffer, mf.byteOffset, mf.byteLength)
        minifat = []; for (let i = 0; i < mf.length / 4; i++) minifat.push(mv.getUint32(i * 4, true))
      }
      return join(chain(e.start, minifat), x => mini.subarray(x * ms, (x + 1) * ms), ms).subarray(0, e.size)
    }
    return { stream, names: ents.map(e => e.name) }
  }

  // Достаём из потока строки текста (Word хранит русский текст по два байта на букву, английский — по одному)
  function legacy(u8) {
    const runs = [], seen = new Set()
    const ok = c => (c >= 32 && c < 127) || (c >= 0x400 && c < 0x500) || c === 0xab || c === 0xbb || c === 0x2014 || c === 0x2013 || c === 0x2116 || c === 0xa0 || (c >= 0x2018 && c <= 0x201e) || c === 9 || c === 13
    let cur = ""
    const push = () => { const t = cur.replace(/\r/g, "\n").trim(); if (t.length >= 6 && /[A-Za-zА-Яа-яЁё]{3}/.test(t) && !seen.has(t)) { seen.add(t); runs.push(t) } cur = "" }
    for (let i = 0; i + 1 < u8.length; i += 2) { const c = u8[i] | (u8[i + 1] << 8); if (ok(c)) cur += String.fromCharCode(c); else push() }
    push()
    for (let i = 1; i + 1 < u8.length; i += 2) { const c = u8[i] | (u8[i + 1] << 8); if (ok(c)) cur += String.fromCharCode(c); else push() }
    push()
    if (runs.join("").length < 200) {   // текст без русских букв Word хранит по байту на знак
      for (let i = 0; i < u8.length; i++) { const c = u8[i]; if ((c >= 32 && c < 127) || c === 13 || c === 9) cur += String.fromCharCode(c); else { if (cur.length >= 12) push(); else cur = "" } }
      push()
    }
    // служебные строки (шрифты, стили, пути) отбрасываем
    return runs.filter(t => !/^(Times New Roman|Arial|Calibri|Cambria|Symbol|Wingdings|Normal|Default Paragraph Font|Microsoft|Root Entry|WordDocument|SummaryInformation|DocumentSummaryInformation|CompObj|Workbook|PowerPoint Document|Current User|Table Paragraph|Body Text|Heading)/i.test(t)).join("\n")
  }

  // старый Excel: все тексты ячеек лежат в одной таблице строк (запись SST), числа там не хранятся
  function xlsStrings(b) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), names = [], parts = []
    let p = 0, inSst = false
    while (p + 4 <= b.length) {
      const t = dv.getUint16(p, true), n = dv.getUint16(p + 2, true), body = b.subarray(p + 4, p + 4 + n)
      if (t === 0x0085 && n > 8) { const cch = body[6], u = body[7] & 1; names.push(new TextDecoder(u ? "utf-16le" : "latin1").decode(body.subarray(8, 8 + cch * (u ? 2 : 1)))) }
      if (t === 0x00fc) { parts.push(body); inSst = true } else if (t === 0x003c && inSst) parts.push(body); else inSst = false
      p += 4 + n
    }
    if (!parts.length) return null
    // строки могут переходить через границу записей CONTINUE: там заново стоит байт «один или два байта на знак»
    let pi = 0, o = 8
    const out = []
    const byte = () => { if (o >= parts[pi].length) { pi++; o = 0 } return parts[pi][o++] }
    const u16 = () => byte() | (byte() << 8), u32 = () => (u16() | (u16() << 16)) >>> 0
    const total = new DataView(parts[0].buffer, parts[0].byteOffset).getUint32(4, true)
    try {
      for (let k = 0; k < total && pi < parts.length; k++) {
        let cch = u16(), fl = byte(), wide = fl & 1, runs = fl & 8 ? u16() : 0, ext = fl & 4 ? u32() : 0, s = ""
        while (cch > 0) {
          if (o >= parts[pi].length) { pi++; o = 0; wide = parts[pi][o++] & 1 }
          s += String.fromCharCode(wide ? u16() : byte()); cch--
        }
        for (let i = 0; i < runs * 4 + ext; i++) byte()
        out.push(s)
      }
    } catch (e) { /* хвост не дочитали — берём что есть */ }
    return (names.length ? "Листы: " + names.join(", ") + "\n" : "") + out.join("\n")
  }

  function oldOffice(u8) {
    let st = null, o = null
    try { o = ole(u8); st = o.stream("WordDocument") || o.stream("Workbook") || o.stream("Book") || o.stream("PowerPoint Document") } catch (e) { st = null }
    if (o && st && (o.names.includes("Workbook") || o.names.includes("Book"))) { const x = xlsStrings(st); if (x) return x }
    return legacy(st || u8).split("\n").filter(t => !/^(Click to edit|Нажмите|Образец|Second level|Third level|Fourth level|Fifth level|Второй уровень|Третий уровень|___PPT)|Outline Level|^(WenQuanYi|DejaVu|Liberation|Calibri|Arial|Times New Roman|Cambria|Helvetica)/i.test(t)).join("\n")
  }

  async function read(f) {
    if (f.size > 30e6) throw new Error("Файл больше 30 МБ — сократите его или пришлите нужную часть")
    const e = ext(f.name), buf = await f.arrayBuffer(), u8 = new Uint8Array(buf)
    const zip = u8[0] === 0x50 && u8[1] === 0x4b
    let kind = KIND[e] || "документ", text = "", note = "", image = null
    if (zip) {
      const z = await unzip(buf), has = n => z.names.includes(n)
      if (has("word/document.xml")) { kind = "Word"; text = await docx(z) }
      else if (has("xl/workbook.xml")) { kind = "Excel"; text = await xlsx(z) }
      else if (z.names.some(n => /^ppt\/slides\//.test(n))) { kind = "PowerPoint"; text = await pptx(z) }
      else if (has("content.xml")) text = await odf(z)
      else if (has("META-INF/container.xml") && z.names.some(n => /\.opf$/i.test(n))) text = await epub(z)
      else if (/^(pages|numbers|key)$/.test(e) || z.names.some(n => /^Index\/.*\.iwa$/.test(n))) {
        image = (await apple(z)).image; note = "у Pages/Numbers/Keynote читается только первая страница картинкой"
      }
      else throw new Error("это архив, а не документ — распакуйте и пришлите нужный файл")
    } else if (/^\{\\rtf/.test(new TextDecoder("latin1").decode(u8.subarray(0, 6)))) { kind = "RTF"; text = rtf(new TextDecoder("latin1").decode(u8)) }
    else if (u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0) {   // старый Office (.doc .xls .ppt)
      text = oldOffice(u8); note = "старый формат Office: текст извлечён без оформления и мог прочитаться не полностью; если чего-то не хватает — попроси прислать в DOCX/XLSX или PDF"
    } else if (looksText(u8) || /^(txt|csv|tsv|md|json|xml|html?|ics|vcf|log|ya?ml)$/.test(e)) {
      text = decodeText(u8)
      if (/^html?$/.test(e) || /^\s*<(!doctype html|html)/i.test(text)) { kind = "веб-страница"; text = htmlText(text) }
      else if (e === "xml") text = tidy(ent(text.replace(/<[^>]+>/g, " ")))
    } else throw new Error(`Формат .${e || "?"} пока не читаю. Подойдут PDF, Word, Excel, PowerPoint, текст и фото`)
    if (image) return { image, kind, note }
    text = (text || "").trim()
    if (!text) throw new Error("в файле не нашлось текста — если это скан, пришлите его как PDF или фото")
    const full = text.length
    if (full > MAX_TEXT) { text = text.slice(0, MAX_TEXT); note = (note ? note + "; " : "") + `документ длинный — прочитано первые ${Math.round(MAX_TEXT / 1000)} тыс. знаков из ${Math.round(full / 1000)} тыс.` }
    return { text, kind, note }
  }

  window.DOCREAD = { read, isDoc, ext, _t: { wordXml, rtf, htmlText, legacy, decodeText } }
})()
