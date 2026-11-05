// Значки приложения в цветах Изи (настройки → Помощник → Цвет). Берёт настоящий рисунок значка из icon_orb.html (вариант flat — одна сфера, 2026-11-05)
// и меняет только цвета. Запуск: node src/web/tools/icon_colors.mjs → src/web/icon-<цвет>-180.png
import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
const DIR = new URL(".", import.meta.url).pathname
const COL = {
  space: [["#3b22c4", "#7b5cff", "#2fb7ff"], "170,190,255", "200,175,255"],
  sunset: [["#e2365f", "#ff7a59", "#ffb547"], "255,200,170", "255,236,170"],
  lagoon: [["#06708f", "#16b3c4", "#5fe0b0"], "150,235,255", "190,255,230"],
  neon: [["#3a1f8f", "#b73cff", "#ff5fc8"], "255,170,240", "170,220,255"],
  night: [["#0d1433", "#24306e", "#4257d6"], "140,205,255", "150,255,220"],
}
const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1024, height: 1024 } })).newPage()
await p.goto("file://" + DIR + "icon_orb.html")
for (const [id, [bgc, w1, w2]] of Object.entries(COL)) {
  const url = await p.evaluate(([bgc, w1, w2]) => {
    window.bg = () => { const g = x.createLinearGradient(0, W, W, 0); g.addColorStop(0, bgc[0]); g.addColorStop(.55, bgc[1]); g.addColorStop(1, bgc[2]); x.fillStyle = g; x.fillRect(0, 0, W, W)
      const s = x.createRadialGradient(W * .25, W * .15, 0, W * .25, W * .15, W * .8); s.addColorStop(0, "rgba(255,255,255,.22)"); s.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = s; x.fillRect(0, 0, W, W) }
    window.ONE.w1 = w1; window.ONE.w2 = w2; x.clearRect(0, 0, W, W); V.flat()   // одна сфера: волны прямо на цвете, без внутреннего шара
    const o = document.createElement("canvas"); o.width = o.height = 180; const ox = o.getContext("2d"); ox.imageSmoothingQuality = "high"; ox.drawImage(c, 0, 0, 180, 180); return o.toDataURL("image/png")
  }, [bgc, w1, w2])
  createRequire(import.meta.url)("fs").writeFileSync(DIR + "../icon-" + id + "-180.png", Buffer.from(url.split(",")[1], "base64")); console.log(id)
}
await b.close()
