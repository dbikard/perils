#!/usr/bin/env python3
"""Generate Perils app icons (neon-on-dark ship diamond) for PWA / home-screen install."""
from PIL import Image, ImageDraw, ImageFilter

BG = (5, 7, 13)
CYAN = (56, 232, 255)
WHITE = (234, 255, 255)
RED = (255, 90, 110)


def diamond(cx, cy, r):
    return [(cx, cy - r), (cx + r * 0.8, cy), (cx, cy + r), (cx - r * 0.8, cy)]


def make(size):
    S = size
    base = Image.new('RGB', (S, S), BG)

    # soft radial vignette glow behind the ship
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx = cy = S / 2
    gd.polygon(diamond(cx, cy, S * 0.30), fill=CYAN + (255,))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.06))
    base.paste(Image.new('RGB', (S, S), CYAN), (0, 0), glow.point(lambda a: int(a * 0.55)).convert('L'))

    d = ImageDraw.Draw(base, 'RGBA')

    # enemy dots around the ship (kept inside the maskable safe zone ~ center 80%)
    import math
    for i, ang in enumerate(range(0, 360, 60)):
        a = math.radians(ang + 15)
        rr = S * 0.34
        ex, ey = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        dot = S * (0.022 if i % 2 else 0.03)
        d.ellipse([ex - dot, ey - dot, ex + dot, ey + dot], fill=RED + (235,))

    # ship core diamond (bright) with white edge
    d.polygon(diamond(cx, cy, S * 0.22), fill=WHITE + (255,))
    d.polygon(diamond(cx, cy, S * 0.205), fill=CYAN + (255,))
    d.line(diamond(cx, cy, S * 0.22) + [diamond(cx, cy, S * 0.22)[0]], fill=WHITE + (255,), width=max(2, S // 110))

    return base


for s, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
    img = make(s)
    img.save(f'icons/{name}')
    print('wrote icons/' + name)
