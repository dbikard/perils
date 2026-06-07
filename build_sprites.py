#!/usr/bin/env python3
"""Generate Ace — the space-fighter player sprite + portrait — as crisp pixel art.
Side-view walk frames (idle + 4-frame cycle) per armor tier, plus a front-facing
portrait for the menu. Auto-outlines the silhouette; exports transparent PNGs."""
from PIL import Image
import os

W, H = 26, 34
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sprites')
os.makedirs(OUT_DIR, exist_ok=True)

C = {
    'O': (9, 13, 24), 'd': (22, 37, 66), 'n': (36, 60, 100), 'b': (58, 90, 138),
    's': (96, 124, 162), 'r': (228, 130, 42), 'y': (255, 180, 80), 'v': (130, 232, 255),
    'V': (208, 250, 255), 'k': (228, 186, 150), 'g': (74, 86, 108), 'G': (40, 48, 64),
    'w': (224, 238, 255), 'l': (28, 36, 52),
}


def blank(w=W, h=H):
    return [[None] * w for _ in range(h)]


def rect(buf, x0, y0, x1, y1, c):
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            if 0 <= x < len(buf[0]) and 0 <= y < len(buf):
                buf[y][x] = c


def px(buf, x, y, c):
    if 0 <= x < len(buf[0]) and 0 <= y < len(buf):
        buf[y][x] = c


# ---- side-view fighter (facing right) ----
# 4-frame walk cycle leg foot offsets (back, front) from the hip; frame 0 = idle
LEGS = {0: (-1, 1), 1: (-3, 3), 2: (-1, 1), 3: (3, -3), 4: (-1, 1)}


def leg(b, footx, col):
    rect(b, 10, 22, 12, 26, col)                 # upper leg at hip
    kx0, kx1 = min(10, footx), max(12, footx + 2)
    rect(b, kx0, 26, kx1, 26, col)               # knee bridge
    rect(b, footx, 26, footx + 2, 30, col)       # lower leg
    rect(b, footx - 1, 30, footx + 3, 31, 'l')   # boot


def draw_ace(armor=2, frame=0):
    b = blank()
    heavy, plated, pauldron = armor >= 5, armor >= 2, armor >= 3
    bdx, fdx = LEGS.get(frame, (-1, 1))
    leg(b, 11 + bdx, 'd')   # back leg (darker)
    leg(b, 11 + fdx, 'n')   # front leg
    if heavy:
        rect(b, 11 + fdx, 27, 11 + fdx + 2, 28, 's')  # knee guard

    # torso
    rect(b, 8, 13, 15, 22, 'n'); rect(b, 9, 14, 14, 21, 'b')
    if plated:
        rect(b, 9, 14, 14, 19, 's'); rect(b, 10, 15, 13, 18, 'b')
    else:
        rect(b, 10, 15, 13, 18, 'd')
    rect(b, 8, 21, 15, 22, 'd'); px(b, 11, 21, 'y'); px(b, 12, 21, 'y')
    px(b, 9, 15, 'r')
    rect(b, 7, 14, 9, 19, 'd')                    # back arm

    # rifle + front arm
    rect(b, 13, 16, 17, 18, 'd'); rect(b, 16, 15, 25, 17, 'g')
    rect(b, 14, 17, 19, 19, 'G'); rect(b, 13, 18, 15, 20, 'g'); px(b, 25, 16, 'k')
    if pauldron:
        rect(b, 12, 12, 16, 14, 's'); rect(b, 13, 12, 15, 13, 'b')
    if heavy:
        rect(b, 6, 13, 8, 16, 's')

    # neck + helmet
    rect(b, 10, 11, 13, 12, 'd')
    rect(b, 7, 3, 15, 10, 'n'); rect(b, 8, 3, 14, 9, 'b')
    px(b, 7, 3, None); px(b, 15, 3, None); px(b, 7, 10, None)
    rect(b, 8, 2, 13, 3, 'r'); rect(b, 9, 2, 12, 2, 'y')
    rect(b, 6, 6, 7, 8, 'd')
    rect(b, 13, 5, 15, 9, 'v'); px(b, 14, 6, 'V'); px(b, 15, 7, 'V')
    if armor >= 1:
        px(b, 13, 5, 'V'); px(b, 14, 8, 'V')
    px(b, 13, 10, 'k'); px(b, 14, 10, 'k')
    return b


# ---- front-facing portrait bust ----
PW, PH = 38, 38


def draw_portrait():
    b = blank(PW, PH)
    rect(b, 0, 0, PW - 1, PH - 1, None)
    # background panel
    for y in range(PH):
        for x in range(PW):
            b[y][x] = 'l' if (x + y) % 7 == 0 else None  # subtle dotted bg
    rect(b, 2, 2, PW - 3, PH - 3, None)
    bgfill = (13, 26, 46)
    for y in range(2, PH - 2):
        for x in range(2, PW - 2):
            b[y][x] = '_bg'
    # shoulders / pauldrons
    rect(b, 4, 28, 14, 35, 'n'); rect(b, 23, 28, 33, 35, 'n')
    rect(b, 5, 29, 12, 31, 's'); rect(b, 25, 29, 32, 31, 's')
    rect(b, 13, 30, 24, 35, 'd'); rect(b, 15, 31, 22, 34, 'n')  # chest
    px(b, 8, 31, 'r'); px(b, 28, 31, 'r')
    # neck
    rect(b, 16, 26, 21, 29, 'k')
    # helmet dome
    rect(b, 8, 4, 29, 24, 'n'); rect(b, 9, 5, 28, 22, 'b')
    for cx, cy in [(8, 4), (29, 4), (8, 24), (29, 24)]:
        px(b, cx, cy, None)
    px(b, 9, 4, None); px(b, 28, 4, None)
    # ear units
    rect(b, 6, 12, 8, 18, 'd'); rect(b, 29, 12, 31, 18, 'd')
    # orange crest
    rect(b, 16, 3, 21, 6, 'r'); rect(b, 17, 2, 20, 3, 'y'); rect(b, 18, 6, 19, 11, 'o' if False else 'r')
    # visor band (cyan, glowing) with two lenses
    rect(b, 10, 12, 27, 18, 'v')
    rect(b, 11, 13, 17, 16, 'V'); rect(b, 20, 13, 26, 16, 'V')
    px(b, 13, 14, 'w'); px(b, 23, 14, 'w')   # glints
    rect(b, 17, 14, 20, 17, 'v')             # nose bridge
    # face below visor
    rect(b, 13, 19, 24, 25, 'k')
    rect(b, 15, 23, 22, 24, (0, 0, 0)) if False else None
    px(b, 16, 23, 'O'); px(b, 17, 24, 'O'); px(b, 18, 24, 'O'); px(b, 19, 24, 'O'); px(b, 20, 24, 'O'); px(b, 21, 23, 'O')  # grin
    px(b, 18, 21, 'O'); px(b, 19, 21, 'O')   # nostrils hint
    return b


def outline(buf, bg_key='_bg'):
    h, w = len(buf), len(buf[0])
    res = [row[:] for row in buf]
    for y in range(h):
        for x in range(w):
            if buf[y][x] is not None:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    nb = buf[ny][nx]
                    if nb is not None and nb != 'O' and nb != bg_key:
                        res[y][x] = 'O'; break
    return res


def to_image(buf, scale=1, bg=(13, 26, 46)):
    h, w = len(buf), len(buf[0])
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    pxs = img.load()
    for y in range(h):
        for x in range(w):
            c = buf[y][x]
            if c is None:
                continue
            if c == '_bg':
                pxs[x, y] = bg + (255,)
            elif isinstance(c, tuple):
                pxs[x, y] = c + (255,)
            else:
                pxs[x, y] = C[c] + (255,)
    if scale != 1:
        img = img.resize((w * scale, h * scale), Image.NEAREST)
    return img


TIERS = {'basic': 0, 'armored': 2, 'heavy': 5}
FRAMES = range(5)  # idle + 4 walk

for tname, alvl in TIERS.items():
    for f in FRAMES:
        to_image(outline(draw_ace(alvl, f))).save(os.path.join(OUT_DIR, f'ace_{tname}_{f}.png'))

to_image(outline(draw_portrait()), scale=1).save(os.path.join(OUT_DIR, 'ace_portrait.png'))
print('wrote sprites + portrait to', OUT_DIR)

# previews
sheet = Image.new('RGBA', (W * 6 * 5 + 30, H * 6 + 20), (11, 20, 34, 255))
for f in FRAMES:
    img = to_image(outline(draw_ace(2, f)), scale=6)
    sheet.paste(img, (10 + f * (W * 6 + 4), 10), img)
sheet.save('/tmp/ace_walk.png')
to_image(outline(draw_portrait()), scale=6).save('/tmp/ace_portrait.png')
print('wrote previews')
