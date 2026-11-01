#!/usr/bin/env python3
"""Рисует значки веб-приложения: icon-180.png (экран «Домой» iPhone), icon-192.png, icon-512.png.
Квадрат без скруглений — iPhone скругляет сам. Цвета виджета: изумруд, золото, бирюза, кремовый."""
import pathlib
from PIL import Image, ImageDraw
HERE = pathlib.Path(__file__).resolve().parent.parent
S = 1024
im = Image.new("RGB", (S, S), "#0B4A33")
d = ImageDraw.Draw(im)
d.ellipse((560, 170, 860, 470), fill="#D4A23C")                         # солнце/монета
d.line([(200, 360), (300, 460), (480, 250)], fill="#FBF8F0", width=64, joint="curve")
for x, y in [(200, 360), (480, 250)]:
    d.ellipse((x - 32, y - 32, x + 32, y + 32), fill="#FBF8F0")
d.rounded_rectangle((200, 560, 820, 616), radius=28, fill="#0FA89C")
d.rounded_rectangle((200, 680, 640, 736), radius=28, fill="#FBF8F0")
d.rounded_rectangle((200, 800, 640, 856), radius=28, fill="#FBF8F0")
for n in (180, 192, 512):
    im.resize((n, n), Image.LANCZOS).save(HERE / f"icon-{n}.png", optimize=True)
