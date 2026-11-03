#!/usr/bin/env python3
"""Значки веб-приложения из варианта «Восход» (logo_variants.py): icon-180/192/512.png.
Квадрат без скруглений — iPhone скругляет сам."""
import pathlib, subprocess, sys, tempfile
from PIL import Image
HERE = pathlib.Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory() as t:
    subprocess.run([sys.executable, str(HERE / "tools/logo_variants.py"), t], check=True, stdout=subprocess.DEVNULL)
    im = Image.open(pathlib.Path(t) / "A-sunrise.png").convert("RGB")
for n in (180, 192, 512):
    im.resize((n, n), Image.LANCZOS).save(HERE / f"icon-{n}.png", optimize=True)
