#!/usr/bin/env python3
"""Рисует значки приложения (res/drawable-*dpi). Запускать один раз, результат хранится в git."""
import pathlib
from PIL import Image, ImageDraw

RES = pathlib.Path(__file__).resolve().parent.parent / "res"
NAVY, GOLD, TEAL, CREAM = (30, 58, 95), (217, 149, 43), (30, 158, 143), (248, 247, 243)
DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}

def launcher(px):
    S = px * 4
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    m = S * 0.06
    d.rounded_rectangle([m, m, S - m, S - m], radius=S * 0.22, fill=NAVY)
    # солнце дня
    r = S * 0.17
    cx, cy = S * 0.66, S * 0.34
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD)
    # строки списка
    for i, y in enumerate((0.52, 0.64, 0.76)):
        d.rounded_rectangle([S * 0.22, S * y, S * (0.62 if i else 0.78), S * y + S * 0.055], radius=S * 0.03, fill=CREAM if i else TEAL)
    # галочка
    w = int(S * 0.055)
    d.line([(S * 0.20, S * 0.33), (S * 0.29, S * 0.42), (S * 0.45, S * 0.24)], fill=CREAM, width=w, joint="curve")
    return im.resize((px, px), Image.LANCZOS)

def notify(px):
    S = px * 4
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    w = int(S * 0.13)
    d.line([(S * 0.15, S * 0.52), (S * 0.40, S * 0.76), (S * 0.86, S * 0.24)], fill=(255, 255, 255, 255), width=w, joint="curve")
    return im.resize((px, px), Image.LANCZOS)

for name, k in DENS.items():
    p = RES / f"drawable-{name}"
    p.mkdir(parents=True, exist_ok=True)
    launcher(int(48 * k)).save(p / "ic_launcher.png")
    notify(int(24 * k)).save(p / "ic_notify.png")
launcher(512).save(RES.parent / "icon-512.png")
print("ok")
