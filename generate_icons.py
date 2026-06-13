#!/usr/bin/env python3
"""Generate Perils app icons for PWA / home-screen install.

The logo reuses the menu's home-screen image — Ace's portrait bust — rendered
crisp (nearest-neighbour, integer upscale) over a neon-on-dark glow, with a ring
of red enemy dots for game flavour. Everything sits inside the maskable safe zone
(centre ~80%) so the bust survives Android's circle/squircle crop.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
BG = (5, 7, 13)
CYAN = (56, 232, 255)
RED = (255, 90, 110)

PORTRAIT = Image.open(os.path.join(HERE, 'sprites', 'ace_portrait.png')).convert('RGBA')
PW = PORTRAIT.width


def make(size):
    S = size
    cx = cy = S / 2
    base = Image.new('RGB', (S, S), BG)

    # soft cyan halo behind the bust
    glow = Image.new('L', (S, S), 0)
    gd = ImageDraw.Draw(glow)
    gr = S * 0.34
    gd.ellipse([cx - gr, cy - gr, cx + gr, cy + gr], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.07))
    base.paste(Image.new('RGB', (S, S), CYAN), (0, 0), glow.point(lambda a: int(a * 0.5)))

    d = ImageDraw.Draw(base, 'RGBA')

    # enemy dots circling the bust (inside the maskable safe zone ~ centre 80%)
    for i, ang in enumerate(range(0, 360, 60)):
        a = math.radians(ang + 25)
        rr = S * 0.355
        ex, ey = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        dot = S * (0.02 if i % 2 else 0.028)
        d.ellipse([ex - dot, ey - dot, ex + dot, ey + dot], fill=RED + (235,))

    # Ace bust — crisp integer upscale, centred, sized to ~60% so it survives the crop
    scale = max(1, round(S * 0.6 / PW))
    bust = PORTRAIT.resize((PW * scale, PW * scale), Image.NEAREST)
    bx = int(cx - bust.width / 2)
    by = int(cy - bust.height / 2)
    # faint drop-glow so the bust reads against the halo
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 150), (bx, by), bust.split()[3])
    shadow = shadow.filter(ImageFilter.GaussianBlur(S * 0.012))
    base.paste(shadow, (0, 0), shadow)
    base.paste(bust, (bx, by), bust)

    return base


for s, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
    make(s).save(os.path.join(HERE, 'icons', name))
    print('wrote icons/' + name)
