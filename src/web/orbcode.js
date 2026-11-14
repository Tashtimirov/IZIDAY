// IZIDAY · Код-шар: приглашение в семью в виде шара Изи. Вокруг шара три кольца светящихся дуг (в них 5 байт
// одноразового кода приглашения + проверка), снаружи тонкое сплошное кольцо — по нему сканер находит шар в кадре.
// Это свой формат: обычная камера телефона его не читает, только сканер внутри IZIDAY (family.js → scan).
//   ORBCODE.encode(bytes5) → 120 бит · ORBCODE.draw(ctx, size, bits, цвета) · ORBCODE.decode(gray, W, H) → bytes5 | null
// Защита от ошибок: код Рида — Соломона (15 байт, из них 6 данных): читается, даже если блик закрыл четверть шара.
(function () {
"use strict"
const N = 40, RINGS = [.62, .74, .86], NB = 15, KD = 6, NP = NB - KD      // 40 секторов × 3 кольца = 120 бит = 15 байт
const LW = .065, RING_W = .045, PLATE = 1.2, ORB_R = .5                    // всё в долях радиуса опорного кольца
// ───────────── Рид — Соломон над GF(256) ─────────────
const EXP = new Uint8Array(512), LOG = new Uint8Array(256)
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
const mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0
const inv = a => EXP[255 - LOG[a]]
const GEN = (() => { let g = [1]; for (let i = 0; i < NP; i++) { const n = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { n[j] ^= g[j]; n[j + 1] ^= mul(g[j], EXP[i]) } g = n } return g })()
function rsEncode(data) {
  const r = new Uint8Array(NP)
  for (let i = 0; i < KD; i++) { const f = data[i] ^ r[0]; for (let j = 0; j < NP - 1; j++) r[j] = r[j + 1] ^ mul(f, GEN[j + 1]); r[NP - 1] = mul(f, GEN[NP]) }
  const out = new Uint8Array(NB); out.set(data.subarray(0, KD)); out.set(r, KD); return out
}
const syn = c => { const s = new Uint8Array(NP); let any = 0; for (let j = 0; j < NP; j++) { let v = 0; for (let i = 0; i < NB; i++) v = mul(v, EXP[j]) ^ c[i]; s[j] = v; any |= v } return any ? s : null }
// Исправляет до 4 испорченных байт на месте; false — не получилось
function rsFix(c) {
  const S = syn(c); if (!S) return true
  let sig = [1], B = [1], L = 0, m = 1, b = 1
  for (let n = 0; n < NP; n++) {
    let d = S[n]; for (let i = 1; i <= L; i++) d ^= mul(sig[i] || 0, S[n - i])
    if (!d) { m++; continue }
    const T = sig.slice(), k = mul(d, inv(b))
    while (sig.length < B.length + m) sig.push(0)
    for (let i = 0; i < B.length; i++) sig[i + m] ^= mul(k, B[i])
    if (2 * L <= n) { L = n + 1 - L; B = T; b = d; m = 1 } else m++
  }
  if (L > NP >> 1) return false
  const om = new Uint8Array(NP)
  for (let i = 0; i < NP; i++) { let v = 0; for (let j = 0; j <= i && j <= L; j++) v ^= mul(sig[j] || 0, S[i - j]); om[i] = v }
  let found = 0
  for (let i = 0; i < NB; i++) {
    const X = EXP[NB - 1 - i], Xi = inv(X)
    let v = 0, p = 1; for (let j = 0; j <= L; j++) { v ^= mul(sig[j] || 0, p); p = mul(p, Xi) }
    if (v) continue
    let o = 0; p = 1; for (let j = 0; j < NP; j++) { o ^= mul(om[j], p); p = mul(p, Xi) }
    let dv = 0; p = 1; for (let j = 1; j <= L; j += 2) { dv ^= mul(sig[j] || 0, p); p = mul(p, mul(Xi, Xi)) }
    if (!dv) return false
    c[i] ^= mul(X, mul(o, inv(dv))); found++
  }
  return found === L && !syn(c)
}
const crc8 = b => { let c = 0x5b; for (let i = 0; i < 5; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = c & 128 ? ((c << 1) ^ 0x07) & 255 : (c << 1) & 255 } return c }
// рисунок-маска: чтобы дуги ложились ровно по всему кругу, даже если в коде много нулей подряд
const MASK = (() => { const m = new Uint8Array(N * 3); let s = 0x2f6e2b1; for (let i = 0; i < m.length; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; m[i] = (s >>> 7) & 1 } return m })()

function encode(tok) {
  const d = new Uint8Array(KD); d.set(tok.subarray(0, 5)); d[5] = crc8(d)
  const cw = rsEncode(d), bits = new Uint8Array(N * 3)
  for (let i = 0; i < bits.length; i++) bits[i] = ((cw[i >> 3] >> (7 - (i & 7))) & 1) ^ MASK[i]
  return bits   // бит i: сектор i/3, кольцо i%3
}
function unbits(bits, shift) {
  const cw = new Uint8Array(NB), n = bits.length
  for (let i = 0; i < n; i++) if (bits[(i + shift * 3) % n] ^ MASK[i]) cw[i >> 3] |= 128 >> (i & 7)
  if (!rsFix(cw) || cw[5] !== crc8(cw)) return null
  return cw.slice(0, 5)
}

// ───────────── Рисунок ─────────────
// ctx — холст size×size (в пикселях холста). col: { a, b } — «r,g,b» двух волн шара. Шар в центре рисует само приложение.
function draw(x, size, bits, col = {}, o = {}) {
  const c = size / 2, R = size / 2 / PLATE, a = col.a || "150,255,220", b = col.b || "140,205,255", TAU = Math.PI * 2
  x.clearRect(0, 0, size, size)
  const bg = x.createRadialGradient(c, c, R * .3, c, c, R * PLATE)
  bg.addColorStop(0, "#0a1626"); bg.addColorStop(.8, "#070d18"); bg.addColorStop(1, "#05080f")
  x.fillStyle = bg; x.beginPath(); x.arc(c, c, R * PLATE, 0, TAU); x.fill()
  const g = x.createLinearGradient(c - R, c + R, c + R, c - R); g.addColorStop(0, `rgb(${a})`); g.addColorStop(1, `rgb(${b})`)
  const g2 = x.createLinearGradient(c - R, c - R, c + R, c + R); g2.addColorStop(0, "#fff"); g2.addColorStop(.5, `rgb(${a})`); g2.addColorStop(1, "#fff")
  x.lineCap = "round"; x.strokeStyle = g2; x.lineWidth = R * RING_W
  x.beginPath(); x.arc(c, c, R, 0, TAU); x.stroke()
  x.strokeStyle = g; x.lineWidth = R * LW
  const st = TAU / N
  RINGS.forEach((rr, k) => {
    const on = s => bits[((s + N) % N) * 3 + k], cap = LW / 2 / rr   // круглые концы не вылезают в соседний сектор
    for (let s = 0; s < N; s++) {
      if (!on(s) || on(s - 1)) continue
      let e = s; while (e - s < N - 1 && on(e + 1)) e++
      x.beginPath(); x.arc(c, c, R * rr, s * st - st * .5 + cap + st * .08, e * st + st * .5 - cap - st * .08); x.stroke()
    }
    if (bits.every((v, i) => i % 3 !== k || v)) { x.beginPath(); x.arc(c, c, R * rr, 0, TAU); x.stroke() }
  })
  return { R, orb: R * ORB_R * 2 }
}

// ───────────── Чтение из кадра камеры ─────────────
const sqrtSym = (a, b, d) => { const t = a + d, det = a * d - b * b, s = Math.sqrt(Math.max(det, 0)), k = Math.sqrt(Math.max(t + 2 * s, 1e-9)); return [(a + s) / k, b / k, (d + s) / k] }   // корень из [[a,b],[b,d]]
function solve(M, v, n) {
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r
    if (Math.abs(M[p][i]) < 1e-12) return null
    ;[M[i], M[p]] = [M[p], M[i]]; [v[i], v[p]] = [v[p], v[i]]
    for (let r = i + 1; r < n; r++) { const f = M[r][i] / M[i][i]; for (let k = i; k < n; k++) M[r][k] -= f * M[i][k]; v[r] -= f * v[i] }
  }
  for (let i = n - 1; i >= 0; i--) { for (let k = i + 1; k < n; k++) v[i] -= M[i][k] * v[k]; v[i] /= M[i][i] }
  return v
}
function decode(g, W, H) {
  // 1. Светлое на тёмном: ярче среднего по окрестности. Размер шара в кадре неизвестен — пробуем три окрестности
  const I = new Float64Array((W + 1) * (H + 1))
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += g[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row } }
  for (const win of [Math.round(Math.min(W, H) / 22), Math.round(Math.min(W, H) / 45), Math.round(Math.min(W, H) / 90)]) { const t = decodeAt(g, W, H, I, Math.max(3, win)); if (t) return t }
  return null
}
function decodeAt(g, W, H, I, win) {
  const bin = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - win), y1 = Math.min(H, y + win + 1)
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - win), x1 = Math.min(W, x + win + 1)
      const m = (I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0))
      if (g[y * W + x] > m + 10 + m * .08) bin[y * W + x] = 1
    }
  }
  // 2. Связные пятна; опорное кольцо — тонкое пятно в виде эллипса
  const lab = new Int32Array(W * H), stack = new Int32Array(W * H), cands = []
  let nl = 0
  for (let p0 = 0; p0 < W * H; p0++) {
    if (!bin[p0] || lab[p0]) continue
    nl++; let sp = 0, n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0, bx0 = W, bx1 = 0, by0 = H, by1 = 0
    stack[sp++] = p0; lab[p0] = nl
    while (sp) {
      const p = stack[--sp], x = p % W, y = (p - x) / W
      n++; sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue
        for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue
          const q = yy * W + xx; if (bin[q] && !lab[q]) { lab[q] = nl; stack[sp++] = q } } }
    }
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1
    if (n < 120 || bw < 36 || bh < 36 || bw > bh * 2.2 || bh > bw * 2.2 || n > bw * bh * .4) continue
    const cx = sx / n, cy = sy / n, a = sxx / n - cx * cx, b = sxy / n - cx * cy, d = syy / n - cy * cy
    const A = sqrtSym(2 * a, 2 * b, 2 * d), det = A[0] * A[2] - A[1] * A[1]
    if (det < 100) continue
    // пиксели пятна должны лежать у единичной окружности
    const i0 = A[2] / det, i1 = -A[1] / det, i2 = A[0] / det
    let m1 = 0, m2 = 0, cnt = 0
    for (let y = by0; y <= by1; y += 2) for (let x = bx0; x <= bx1; x += 2) if (lab[y * W + x] === nl) {
      const ux = x - cx, uy = y - cy, r = Math.hypot(i0 * ux + i1 * uy, i1 * ux + i2 * uy); m1 += r; m2 += r * r; cnt++ }
    if (!cnt) continue
    m1 /= cnt; const sd = Math.sqrt(Math.max(0, m2 / cnt - m1 * m1))
    if (sd < .12) cands.push({ cx, cy, A, sd, n })
  }
  cands.sort((p, q) => q.n - p.n)
  const at = (x, y) => { const xi = x | 0, yi = y | 0; if (xi < 0 || yi < 0 || xi >= W - 1 || yi >= H - 1) return 0
    const fx = x - xi, fy = y - yi, p = yi * W + xi; return g[p] * (1 - fx) * (1 - fy) + g[p + 1] * fx * (1 - fy) + g[p + W] * (1 - fx) * fy + g[p + W + 1] * fx * fy }
  for (const cd of cands.slice(0, 4)) {
    let { cx, cy, A } = cd, ok = true
    // 3. Уточнение: по 96 лучам ищем гребень кольца и подгоняем эллипс
    for (let it = 0; it < 3 && ok; it++) {
      const sc = Math.sqrt(Math.abs(A[0] * A[2] - A[1] * A[1])), pts = [], span = it ? .07 : .14
      for (let k = 0; k < 96; k++) {
        const th = k / 96 * Math.PI * 2, ux = A[0] * Math.cos(th) + A[1] * Math.sin(th), uy = A[1] * Math.cos(th) + A[2] * Math.sin(th)
        let sw = 0, sr = 0, mn = 255, vals = []
        for (let r = 1 - span; r <= 1 + span + 1e-9; r += span / 8) { const v = at(cx + ux * r, cy + uy * r); vals.push([r, v]); if (v < mn) mn = v }
        for (const [r, v] of vals) { const w = (v - mn) * (v - mn); sw += w; sr += w * r }
        if (sw > 200) { const r = sr / sw; pts.push([(ux * r) / sc, (uy * r) / sc]) }
      }
      if (pts.length < 40) { ok = false; break }
      const M = Array.from({ length: 5 }, () => new Array(5).fill(0)), v = new Array(5).fill(0)
      for (const [x, y] of pts) { const f = [x * x, x * y, y * y, x, y]; for (let i = 0; i < 5; i++) { v[i] += f[i]; for (let j = 0; j < 5; j++) M[i][j] += f[i] * f[j] } }
      const s = solve(M, v, 5); if (!s) { ok = false; break }
      const [qa, qb, qc, qd, qe] = s, dq = 4 * qa * qc - qb * qb
      if (dq <= 0 || qa <= 0) { ok = false; break }
      const x0 = (qb * qe - 2 * qc * qd) / dq, y0 = (qb * qd - 2 * qa * qe) / dq, k = 1 + qa * x0 * x0 + qb * x0 * y0 + qc * y0 * y0
      if (k <= 0) { ok = false; break }
      // (p-p0)ᵀ Q (p-p0) = k → A = (Q/k)^(-1/2)
      const ma = qa / k, mb = qb / 2 / k, mc = qc / k, md = ma * mc - mb * mb
      A = sqrtSym(mc / md * sc * sc, -mb / md * sc * sc, ma / md * sc * sc); cx += x0 * sc; cy += y0 * sc
    }
    if (!ok) continue
    // 4. Наклон: шар снят под углом — центр круга в кадре смещён от центра эллипса. Подбираем смещение (ex, ey),
    //    при котором тёмные промежутки между кольцами самые тёмные
    let ex = 0, ey = 0
    const map = (qx, qy) => {
      const a = Math.hypot(ex, ey)
      if (a > 1e-6) { const ux = ex / a, uy = ey / a, x = qx * ux + qy * uy, y = -qx * uy + qy * ux, w = 1 + a * x, x2 = (x + a) / w, y2 = y * Math.sqrt(1 - a * a) / w; qx = x2 * ux - y2 * uy; qy = x2 * uy + y2 * ux }
      return at(cx + A[0] * qx + A[1] * qy, cy + A[1] * qx + A[2] * qy)
    }
    const GAPS = [.56, .68, .80, .936], dark = () => { let s = 0; for (const r of GAPS) for (let k = 0; k < 72; k++) { const th = k / 72 * Math.PI * 2; s += map(r * Math.cos(th), r * Math.sin(th)) } return s }
    let best = dark(), bx = 0, by = 0
    for (const [step, n] of [[.06, 3], [.02, 2], [.007, 2]]) {
      const ox = bx, oy = by
      for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { ex = ox + i * step; ey = oy + j * step; if (Math.hypot(ex, ey) > .3) continue; const d = dark(); if (d < best) { best = d; bx = ex; by = ey } }
    }
    ex = bx; ey = by
    // 5. Чтение дуг: порог — между яркостью опорного кольца и тёмного поля на том же луче
    const OS = 8, M2 = N * OS, val = RINGS.map(() => new Float32Array(M2)), thr = new Array(M2), smp = (ux, uy, r) => map(ux * r, uy * r)
    for (let k = 0; k < M2; k++) {
      const th = k / M2 * Math.PI * 2, ux = Math.cos(th), uy = Math.sin(th)
      let w = 0; for (let r = .97; r <= 1.031; r += .01) w = Math.max(w, smp(ux, uy, r))
      const bl = Math.min(smp(ux, uy, .925), smp(ux, uy, .935), smp(ux, uy, .945), smp(ux, uy, 1.07))
      thr[k] = [w, bl]
      RINGS.forEach((rr, j) => { val[j][k] = (smp(ux, uy, rr - .012) + smp(ux, uy, rr) + smp(ux, uy, rr + .012)) / 3 })
    }
    // сгладить опорные яркости по соседним лучам
    const wS = new Float32Array(M2), bS = new Float32Array(M2)
    for (let k = 0; k < M2; k++) { let w = 0, b = 0; for (let d = -OS; d <= OS; d++) { const t = thr[(k + d + M2) % M2]; w += t[0]; b += t[1] } wS[k] = w / (2 * OS + 1); bS[k] = b / (2 * OS + 1) }
    const phases = []
    for (let ph = 0; ph < OS; ph++) {
      const bits = new Uint8Array(N * 3); let margin = 0
      for (let s = 0; s < N; s++) for (let j = 0; j < 3; j++) {
        let v = 0, w = 0, b = 0
        for (let d = -1; d <= 1; d++) { const k = (s * OS + ph + d + M2) % M2; v += val[j][k]; w += wS[k]; b += bS[k] }
        const t = b + (w - b) * .45; bits[s * 3 + j] = v > t ? 1 : 0; margin += Math.abs(v - t)
      }
      phases.push({ bits, margin })
    }
    phases.sort((p, q) => q.margin - p.margin)
    for (const p of phases) for (let s = 0; s < N; s++) { const t = unbits(p.bits, s); if (t) return t }
  }
  return null
}
// кадр видео/холста → серый массив
function gray(img, W, H) { const g = new Uint8Array(W * H); for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = (img[p] * 77 + img[p + 1] * 150 + img[p + 2] * 29) >> 8; return g }
const str = t => Array.from(t, b => b.toString(16).padStart(2, "0")).join("")
const api = { encode, draw, decode, gray, str, N, RINGS, ORB_R, PLATE, _rs: { rsEncode, rsFix } }
if (typeof window !== "undefined") window.ORBCODE = api
if (typeof module !== "undefined") module.exports = api
})()
