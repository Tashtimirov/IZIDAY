#!/usr/bin/env python3
"""Варианты значка IZIDAY в стиле Apple: градиент, простой знак, мягкий объём. Рисуется в 4× и уменьшается — ровные края."""
import math, pathlib, sys
from PIL import Image, ImageDraw, ImageFilter

S, K = 1024, 4                     # итоговый размер и запас для сглаживания
W = S * K
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT.mkdir(parents=True, exist_ok=True)

def hexrgb(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def gradient(c1, c2, angle=135):
    """Линейный градиент по диагонали."""
    a, b = hexrgb(c1), hexrgb(c2)
    g = Image.new("RGB", (256, 256))
    px = g.load()
    dx, dy = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    for y in range(256):
        for x in range(256):
            t = ((x - 128) * dx + (y - 128) * dy) / 181 * .5 + .5
            t = max(0, min(1, t))
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return g.resize((W, W), Image.BICUBIC)

def arc(d, cx, cy, r, w, a0, a1, fill):
    d.arc((cx - r, cy - r, cx + r, cy + r), a0, a1, fill=fill, width=w)
    for a in (a0, a1):   # круглые концы
        x, y = cx + (r - w / 2) * math.cos(math.radians(a)), cy + (r - w / 2) * math.sin(math.radians(a))
        d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=fill)

def gloss(im):
    """Лёгкий верхний блик — объём как у значков iOS."""
    hl = Image.new("L", (W, W), 0)
    ImageDraw.Draw(hl).ellipse((-W * .3, -W * .9, W * 1.3, W * .45), fill=34)
    hl = hl.filter(ImageFilter.GaussianBlur(W / 18))
    white = Image.new("RGB", (W, W), "white")
    return Image.composite(white, im, hl)

def finish(im, name):
    im = im.resize((S, S), Image.LANCZOS)
    im.save(OUT / f"{name}.png")
    return im

# A — «Восход»: изумрудный градиент, белое солнце над горизонтом — начало дня
def variant_a():
    im = gradient("#34DBA0", "#05704E")
    d = ImageDraw.Draw(im)
    c, hz, r = W / 2, W * .62, W * .23
    sun = Image.new("L", (W, W), 0); ImageDraw.Draw(sun).ellipse((c - r, hz - r * 1.05, c + r, hz + r * .95), fill=255)
    ImageDraw.Draw(sun).rectangle((0, hz - W * .01, W, W), fill=0)          # солнце наполовину над горизонтом
    im.paste((255, 255, 255), (0, 0), sun)
    w = int(W * .062)
    d.rounded_rectangle((W * .16, hz + W * .035, W * .84, hz + W * .035 + w), radius=w / 2, fill="white")
    d.rounded_rectangle((W * .30, hz + W * .14, W * .70, hz + W * .14 + w), radius=w / 2, fill=(205, 245, 228))
    for a in (-150, -120, -90, -60, -30):   # лучи
        a = math.radians(a); r1, r2 = r * 1.32, r * 1.62
        d.line([(c + r1 * math.cos(a), hz + r1 * math.sin(a)), (c + r2 * math.cos(a), hz + r2 * math.sin(a))], fill="white", width=w)
        for rr in (r1, r2): x, y = c + rr * math.cos(a), hz + rr * math.sin(a); d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill="white")
    return finish(im, "A-sunrise")

# B — «Кольца»: тёмный фон, три кольца — дела, здоровье, деньги
def variant_b():
    im = gradient("#232326", "#000000", 90)
    d = ImageDraw.Draw(im)
    c, w = W / 2, int(W * .08)
    for r, col, end in ((W * .37, "#30D158", 290), (W * .27, "#0A84FF", 220), (W * .17, "#FF9F0A", 160)):
        d.ellipse((c - r, c - r, c + r, c + r), outline=tuple(int(v * .25) for v in hexrgb(col)), width=w)
        arc(d, c, c, r, w, -90, end - 90, col)
    return finish(im, "B-rings")

# C — «День»: светлый значок, листок календаря с изумрудной шапкой и галочкой
def variant_c():
    im = gradient("#FFFFFF", "#ECEEF2", 90)
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1, rr = W * .20, W * .20, W * .80, W * .80, W * .11
    sh = Image.new("L", (W, W), 0); ImageDraw.Draw(sh).rounded_rectangle((x0, y0 + W * .02, x1, y1 + W * .03), radius=rr, fill=70)
    im.paste((60, 70, 80), (0, 0), sh.filter(ImageFilter.GaussianBlur(W * .025)))
    d.rounded_rectangle((x0, y0, x1, y1), radius=rr, fill="white")
    head = Image.new("L", (W, W), 0); hd = ImageDraw.Draw(head)
    hd.rounded_rectangle((x0, y0, x1, y1), radius=rr, fill=255); hd.rectangle((0, y0 + W * .17, W, W), fill=0)
    im.paste(gradient("#34DBA0", "#05704E"), (0, 0), head)
    w = int(W * .07)
    pts = [(W * .36, W * .58), (W * .46, W * .68), (W * .65, W * .48)]
    d.line(pts, fill=hexrgb("#0A9F6E"), width=w, joint="curve")
    for x, y in (pts[0], pts[2]): d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=hexrgb("#0A9F6E"))
    for x in (W * .35, W * .65): d.rounded_rectangle((x - w * .35, y0 - W * .04, x + w * .35, y0 + W * .06), radius=w * .35, fill=hexrgb("#E6E8EC"))
    return finish(im, "C-day")

def preview(icons):
    """Как на экране «Домой»: скругление iOS, подписи."""
    from PIL import ImageFont
    bg = gradient("#9FB7D9", "#E8D3C4", 160).resize((1600, 760))
    d = ImageDraw.Draw(bg)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 34)
    except Exception: font = None
    for i, (im, label) in enumerate(icons):
        n = 380
        ic = im.resize((n, n), Image.LANCZOS)
        mk = Image.new("L", (n * 4, n * 4), 0); ImageDraw.Draw(mk).rounded_rectangle((0, 0, n * 4, n * 4), radius=n * 4 * .225, fill=255)
        mk = mk.resize((n, n), Image.LANCZOS)
        x, y = 110 + i * 500, 130
        sh = Image.new("L", (n + 80, n + 80), 0); ImageDraw.Draw(sh).rounded_rectangle((40, 50, n + 40, n + 50), radius=n * .225, fill=90)
        bg.paste((40, 40, 60), (x - 40, y - 40), sh.filter(ImageFilter.GaussianBlur(18)))
        bg.paste(ic, (x, y), mk)
        tw = d.textlength(label, font=font) if font else 0
        d.text((x + n / 2 - tw / 2, y + n + 40), label, fill="white", font=font)
    bg.save(OUT / "preview.png")

if __name__ == "__main__":
    preview([(variant_a(), "A · Восход"), (variant_b(), "B · Кольца"), (variant_c(), "C · День")])
    print("ok")
