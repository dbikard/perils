#!/usr/bin/env python3
"""Generate Ace — the space-fighter player sprite — as crisp pixel art.
Draws a side-view (facing right) soldier into a small pixel buffer, auto-outlines
the silhouette, and exports transparent PNGs per armor tier + walk frame.
Game scales these up with image smoothing off."""
from PIL import Image
import os

W, H = 26, 34
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sprites')
os.makedirs(OUT_DIR, exist_ok=True)

# palette (RGB)
C = {
    'O': (9, 13, 24),       # outline
    'd': (22, 37, 66),      # navy dark
    'n': (36, 60, 100),     # navy
    'b': (58, 90, 138),     # navy light
    's': (96, 124, 162),    # steel highlight
    'r': (228, 130, 42),    # orange
    'y': (255, 180, 80),    # orange light
    'v': (130, 232, 255),   # visor
    'V': (208, 250, 255),   # visor core
    'k': (228, 186, 150),   # skin
    'g': (74, 86, 108),     # gunmetal
    'G': (40, 48, 64),      # gun dark
    'w': (224, 238, 255),   # white
    'l': (28, 36, 52),      # boot/leg dark
}


def blank():
    return [[None] * W for _ in range(H)]


def rect(buf, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < W and 0 <= y < H:
                buf[y][x] = c


def px(buf, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        buf[y][x] = c


def draw_ace(armor=2, frame=0):
    """frame: 0 idle, 1 walk-A, 2 walk-B. armor: tier int."""
    b = blank()
    heavy = armor >= 5
    plated = armor >= 2
    pauldron = armor >= 3

    # ---- legs (drawn first, behind torso) ----
    # stride by frame
    if frame == 1:
        lx_back, lx_front = 8, 14
    elif frame == 2:
        lx_back, lx_front = 10, 13
    else:
        lx_back, lx_front = 9, 13
    # back leg
    rect(b, lx_back, 22, lx_back + 2, 29, 'd')
    rect(b, lx_back - 1, 29, lx_back + 2, 31, 'l')   # boot
    # front leg
    rect(b, lx_front, 22, lx_front + 2, 29, 'n')
    rect(b, lx_front, 29, lx_front + 3, 31, 'l')     # boot
    if heavy:  # knee guards
        rect(b, lx_front, 25, lx_front + 2, 26, 's')
        rect(b, lx_back, 25, lx_back + 2, 26, 's')

    # ---- torso ----
    rect(b, 8, 13, 15, 22, 'n')
    rect(b, 9, 14, 14, 21, 'b')           # body highlight
    # chest plate
    if plated:
        rect(b, 9, 14, 14, 19, 's')
        rect(b, 10, 15, 13, 18, 'b')
    else:
        rect(b, 10, 15, 13, 18, 'd')      # plain suit panel
    # belt
    rect(b, 8, 21, 15, 22, 'd')
    px(b, 11, 21, 'y'); px(b, 12, 21, 'y')  # buckle
    # shoulder badge
    px(b, 9, 15, 'r')

    # ---- back arm (slightly behind) ----
    rect(b, 7, 14, 9, 19, 'd')

    # ---- rifle + front arm (pointing right) ----
    rect(b, 13, 16, 17, 18, 'd')          # forearm
    rect(b, 16, 15, 25, 17, 'g')          # barrel
    rect(b, 14, 17, 19, 19, 'G')          # body of gun
    rect(b, 13, 18, 15, 20, 'g')          # grip/stock
    px(b, 25, 16, 'k')                    # muzzle tip hint

    # pauldron over front shoulder
    if pauldron:
        rect(b, 12, 12, 16, 14, 's')
        rect(b, 13, 12, 15, 13, 'b')
    if heavy:
        rect(b, 6, 13, 8, 16, 's')        # back pauldron / pack

    # ---- neck ----
    rect(b, 10, 11, 13, 12, 'd')

    # ---- helmet (dome, facing right) ----
    rect(b, 7, 3, 15, 10, 'n')
    rect(b, 8, 3, 14, 9, 'b')
    # round the corners
    px(b, 7, 3, None); px(b, 15, 3, None)
    px(b, 7, 10, None)
    # orange crest along the top
    rect(b, 8, 2, 13, 3, 'r')
    rect(b, 9, 2, 12, 2, 'y')
    # ear/comm unit at back
    rect(b, 6, 6, 7, 8, 'd')
    # visor (front/right), glows brighter with armor
    rect(b, 13, 5, 15, 9, 'v')
    px(b, 14, 6, 'V'); px(b, 15, 7, 'V')
    if armor >= 1:
        px(b, 13, 5, 'V'); px(b, 14, 8, 'V')
    # a sliver of jaw/skin under the visor
    px(b, 13, 10, 'k'); px(b, 14, 10, 'k')

    return b


def outline(buf):
    """add a dark outline around the silhouette (transparent pixel touching a filled one)."""
    res = [row[:] for row in buf]
    for y in range(H):
        for x in range(W):
            if buf[y][x] is not None:
                continue
            touch = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and buf[ny][nx] is not None and buf[ny][nx] != 'O':
                    touch = True
                    break
            if touch:
                res[y][x] = 'O'
    return res


def to_image(buf, scale=1):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    pxs = img.load()
    for y in range(H):
        for x in range(W):
            c = buf[y][x]
            if c is not None:
                pxs[x, y] = C[c] + (255,)
    if scale != 1:
        img = img.resize((W * scale, H * scale), Image.NEAREST)
    return img


TIERS = {'basic': 0, 'armored': 2, 'heavy': 5}

# export native-res PNGs: ace_<tier>_<frame>.png
for tname, alvl in TIERS.items():
    for frame in (0, 1, 2):
        buf = outline(draw_ace(alvl, frame))
        to_image(buf).save(os.path.join(OUT_DIR, f'ace_{tname}_{frame}.png'))
print('wrote sprites to', OUT_DIR)

# preview sheet (scaled up) for eyeballing
sheet = Image.new('RGBA', (W * 8 * 3 + 40, H * 8 + 20), (11, 20, 34, 255))
for i, (tname, alvl) in enumerate(TIERS.items()):
    img = to_image(outline(draw_ace(alvl, 0)), scale=8)
    sheet.paste(img, (10 + i * (W * 8 + 10), 10), img)
sheet.save('/tmp/ace_preview.png')
# walk-cycle preview for the armored tier
walk = Image.new('RGBA', (W * 8 * 3 + 40, H * 8 + 20), (11, 20, 34, 255))
for f in (0, 1, 2):
    img = to_image(outline(draw_ace(2, f)), scale=8)
    walk.paste(img, (10 + f * (W * 8 + 10), 10), img)
walk.save('/tmp/ace_walk.png')
print('wrote previews')
