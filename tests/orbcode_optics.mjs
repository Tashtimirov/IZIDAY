import { createRequire } from "module"
const { chromium } = createRequire(import.meta.url)("playwright")
import fs from "fs"
const src = fs.readFileSync(new URL("../src/web/orbcode.js", import.meta.url), "utf8")
const b = await chromium.launch()
const pg = await b.newPage({ viewport: { width: 640, height: 480 } })
const dec = await b.newPage()
await dec.setContent("<canvas id=c></canvas>"); await dec.addScriptTag({ content: src })
const cases = []
for (const bg of ["#fff", "#111", "linear-gradient(120deg,#e9d,#3a6 60%,#fff)"])
  for (const size of [130, 200, 300, 420])
    for (const tf of ["", "rotate(17deg)", "rotate(143deg)", "perspective(600px) rotateY(18deg)", "perspective(600px) rotateX(-22deg) rotate(60deg)", "perspective(500px) rotateY(30deg) rotateX(10deg)"])
      for (const fx of ["", "blur(1.2px)", "blur(2.5px) brightness(.7)", "brightness(1.6) contrast(.7)"])
        cases.push({ bg, size, tf, fx })
let ok = 0, wrong = 0; const fails = {}
let i = 0
for (const c of cases) {
  const tok = [1, 2, 3, 4, 5].map(() => Math.random() * 256 | 0)
  await pg.setContent(`<body style="margin:0;background:${c.bg};height:480px;display:flex;align-items:center;justify-content:center;overflow:hidden">
   <div style="position:relative;width:${c.size}px;height:${c.size}px;transform:${c.tf || "none"};filter:${c.fx || "none"};margin-left:${(i % 5) * 20 - 40}px">
   <canvas id=c width=900 height=900 style="width:100%;height:100%"></canvas>
   <div id=o style="position:absolute;left:50%;top:50%;border-radius:50%;transform:translate(-50%,-50%);background:linear-gradient(45deg,#0b8f5c,#18b98a,#1f8fff)"></div></div>
   ${i % 3 === 1 ? `<div style="position:absolute;left:50%;top:50%;width:${c.size * .3}px;height:${c.size * .12}px;margin:${c.size * .36}px 0 0 ${-c.size * .15}px;border-radius:20px;background:#000">` : ""}</div>
   <div style="position:absolute;left:10px;top:10px;width:90px;height:90px;border:6px solid #fff;border-radius:50%;background:#333"></div></body>`)
  await pg.addScriptTag({ content: src })
  await pg.evaluate(tok => { const x = document.getElementById("c").getContext("2d"); const r = ORBCODE.draw(x, 900, ORBCODE.encode(new Uint8Array(tok))); const o = document.getElementById("o"); o.style.width = o.style.height = (r.orb / 9) + "%" }, tok)
  const png = await pg.screenshot()
  if (c.size === 300 && c.tf === "rotate(17deg)" && !c.fx && c.bg === "#111") fs.writeFileSync("/tmp/claude-0/t/occ.png", png)
  if (i++ === 37) fs.writeFileSync("/tmp/claude-0/t/sample.png", png)
  const res = await dec.evaluate(async url => { const im = new Image(); im.src = url; await im.decode(); const c = document.getElementById("c"); c.width = im.width; c.height = im.height; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; const t0 = performance.now(); const t = ORBCODE.decode(ORBCODE.gray(d, c.width, c.height), c.width, c.height); return { t: t && Array.from(t), ms: performance.now() - t0 } }, "data:image/png;base64," + png.toString("base64"))
  if (res.t && res.t.join() === tok.join()) ok++; else { if (res.t) wrong++; const k = `${c.size}|${c.tf}|${c.fx}`; fails[k] = (fails[k] || 0) + 1 }
}
console.log("ok", ok, "of", cases.length, "wrong", wrong); console.log(fails)
await b.close()
