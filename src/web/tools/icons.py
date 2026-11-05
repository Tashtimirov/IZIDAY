#!/usr/bin/env python3
"""Значки веб-приложения: одна сфера Изи — волны прямо на зелёном, без внутреннего стеклянного шара (2026-11-05): icon-180/192/512.png.
Исходник 1024px — tools/icon-orb-1024.png, нарисован tools/icon_orb.html (draw("flat") в Chromium).
Квадрат без скруглений — iPhone скругляет сам."""
import pathlib
from PIL import Image
HERE = pathlib.Path(__file__).resolve().parent.parent
im = Image.open(HERE / "tools/icon-orb-1024.png").convert("RGB")
for n in (180, 192, 512):
    im.resize((n, n), Image.LANCZOS).save(HERE / f"icon-{n}.png", optimize=True)
