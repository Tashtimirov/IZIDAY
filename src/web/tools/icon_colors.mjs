// Значки приложения в цветах Изи (настройки → Помощник → Цвет). Берёт настоящий рисунок значка из icon_orb.html (вариант a2)
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
    x.clearRect(0, 0, W, W); bg(); const cx = W / 2, cy = W / 2, R = W * .42; orbShell(cx, cy, R)
    inside(cx, cy, R, () => { waveF(cx, cy + R * .04, R * 1.85, R * .32, w1, .95, 2.1, R * .035, R * .18); waveF(cx, cy - R * .03, R * 1.85, R * .42, w2, 1, 0, R * .045, R * .22) })
    orbGlass(cx, cy, R)
    const o = document.createElement("canvas"); o.width = o.height = 180; const ox = o.getContext("2d"); ox.imageSmoothingQuality = "high"; ox.drawImage(c, 0, 0, 180, 180); return o.toDataURL("image/png")
  }, [bgc, w1, w2])
  createRequire(import.meta.url)("fs").writeFileSync(DIR + "../icon-" + id + "-180.png", Buffer.from(url.split(",")[1], "base64")); console.log(id)
}
await b.close()
