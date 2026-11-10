// Документы в чате Изи: Word, Excel, PowerPoint и др. → текст уходит Изи. node tests/docs_shots.mjs <папка> <файлы...>
import { boot2 } from "./today_boot.mjs"
import fs from "fs"
const [out, ...files] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true })
const sent = []
for (const dark of [false, true]) {
  const sfx = dark ? "-dark" : ""
  const { page, browser, server, errors } = await boot2({ root: new URL("../dist/web/", import.meta.url).pathname, time: new Date("2026-11-10T05:40:00Z"), dark })
  await page.route("https://api.anthropic.com/**", r => {
    const b = JSON.parse(r.request().postData()); sent.push(b)
    r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ role: "assistant", stop_reason: "end_turn", content: [{ type: "text", text: "Прочитал «Мои 100 мечт»: 100 пунктов в 9 разделах — от Toyota Camry до путешествий с семьёй. Повторов нашёл 6, например «купить MacBook» встречается дважды. Добавить список в «Мечты» без дублей?" }] }) })
  })
  await page.evaluate(() => { speechSynthesis.speak = () => {}; speechSynthesis.cancel = () => {}; setTab("chat") })
  await page.waitForTimeout(500)
  // меню «+»
  await page.click(".chat-bar .cam"); await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/1-menu${sfx}.png` })
  // нажали «Файл» — как на телефоне, через окно выбора файла
  const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.getByText("PDF, Word, Excel").click()])
  await fc.setFiles(files.slice(0, 1).map(f => ({ name: f.split("/").pop(), mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: fs.readFileSync(f) }))); await page.waitForTimeout(1500)
  await page.fill("#chat-in", "заведи в мои мечты, убери дубли"); await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/2-word${sfx}.png` })
  await page.click(".chat-bar .send"); await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/3-otvet${sfx}.png` })
  if (!dark) {   // остальные форматы — что получает Изи
    for (const f of files.slice(1)) {
      const r = await page.evaluate(async ([name, b64]) => { try { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const d = await DOCREAD.read(new File([u], name)); return d.image ? "картинка" : d.kind + ": " + d.text.slice(0, 90).replace(/\n/g, " ⏎ ") } catch (e) { return "ОШИБКА " + e.message } }, [f.split("/").pop(), fs.readFileSync(f).toString("base64")])
      console.log(f.split("/").pop().padEnd(10), r)
    }
  }
  console.log("errors", errors); await browser.close(); server.close()
}
const doc = sent.flatMap(b => (b.messages || []).flatMap(m => Array.isArray(m.content) ? m.content : [])).find(c => c.type === "document")
console.log("в запросе:", doc ? JSON.stringify({ title: doc.title, context: doc.context, src: doc.source.type, len: doc.source.data.length }) : "НЕТ ДОКУМЕНТА")
