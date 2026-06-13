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


# ---- second fighter: Nova — violet armor, magenta trim, green visor, fin crest ----
NOVA = {
    'P': (34, 20, 54), 'Z': (88, 52, 128), 'z': (140, 96, 192), 'X': (196, 158, 236),
    'm': (236, 84, 164), 'I': (255, 150, 210), 'j': (110, 250, 168), 'J': (200, 255, 222),
}


def draw_nova(armor=2, frame=0):
    b = blank()
    heavy, plated, pauldron = armor >= 5, armor >= 2, armor >= 3
    bdx, fdx = LEGS.get(frame, (-1, 1))
    leg(b, 11 + bdx, 'P')   # back leg (dark violet)
    leg(b, 11 + fdx, 'Z')   # front leg (mid violet)
    if heavy:
        rect(b, 11 + fdx, 27, 11 + fdx + 2, 28, 'z')   # knee guard

    # torso
    rect(b, 8, 13, 15, 22, 'Z'); rect(b, 9, 14, 14, 21, 'z')
    if plated:
        rect(b, 9, 14, 14, 19, 'X'); rect(b, 10, 15, 13, 18, 'z')
    else:
        rect(b, 10, 15, 13, 18, 'P')
    rect(b, 8, 21, 15, 22, 'P'); px(b, 11, 21, 'm'); px(b, 12, 21, 'm')  # belt + magenta buckle
    px(b, 9, 15, 'm')                             # chest light
    rect(b, 7, 14, 9, 19, 'P')                    # back arm

    # rifle + front arm
    rect(b, 13, 16, 17, 18, 'P'); rect(b, 16, 15, 25, 17, 'g')
    rect(b, 14, 17, 19, 19, 'G'); rect(b, 13, 18, 15, 20, 'g'); px(b, 25, 16, 'I')
    if pauldron:
        rect(b, 12, 12, 16, 14, 'X'); rect(b, 13, 12, 15, 13, 'm')   # magenta pauldron trim
    if heavy:
        rect(b, 6, 13, 8, 16, 'X')

    # neck + helmet (swept fin crest + green visor, vs Ace's antenna + cyan)
    rect(b, 10, 11, 13, 12, 'P')
    rect(b, 7, 3, 15, 10, 'Z'); rect(b, 8, 3, 14, 9, 'z')
    px(b, 7, 3, None); px(b, 15, 3, None); px(b, 7, 10, None)
    rect(b, 9, 1, 13, 2, 'm'); px(b, 8, 2, 'm'); px(b, 14, 1, 'I'); px(b, 13, 0, 'I')  # swept fin crest
    rect(b, 6, 6, 7, 8, 'P')
    rect(b, 12, 5, 15, 9, 'j'); px(b, 14, 6, 'J'); px(b, 15, 7, 'J')   # green visor
    if armor >= 1:
        px(b, 13, 5, 'J'); px(b, 14, 8, 'J')
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

# Nova (player 2) — uses its own palette; added before the enemy palette so the
# keys are still free
C.update(NOVA)
for tname, alvl in TIERS.items():
    for f in FRAMES:
        to_image(outline(draw_nova(alvl, f))).save(os.path.join(OUT_DIR, f'nova_{tname}_{f}.png'))
print('wrote nova sprites')
nsheet = Image.new('RGBA', (W * 6 * 5 + 30, H * 6 + 20), (11, 20, 34, 255))
for f in FRAMES:
    img = to_image(outline(draw_nova(2, f)), scale=6)
    nsheet.paste(img, (10 + f * (W * 6 + 4), 10), img)
nsheet.save('/tmp/nova_walk.png')

# previews
sheet = Image.new('RGBA', (W * 6 * 5 + 30, H * 6 + 20), (11, 20, 34, 255))
for f in FRAMES:
    img = to_image(outline(draw_ace(2, f)), scale=6)
    sheet.paste(img, (10 + f * (W * 6 + 4), 10), img)
sheet.save('/tmp/ace_walk.png')
to_image(outline(draw_portrait()), scale=6).save('/tmp/ace_portrait.png')
print('wrote player previews')


# ============================ ENEMIES ============================
# extra palette (hostile reds / magentas / amber + eye glow)
C.update({
    'E': (232, 68, 79), 'e': (150, 40, 58), 'F': (255, 120, 140),
    'M': (205, 75, 150), 'p': (120, 42, 92), 'A': (255, 150, 60),
    'Y': (255, 214, 110), 'i': (255, 244, 170), 'c': (58, 28, 40),
    'h': (250, 220, 230),
})


def draw_swarmer(frame):  # small red bug-drone (~16x14)
    b = blank(16, 14)
    wig = 0 if frame == 0 else 1
    # legs (wiggle)
    for lx in (4, 7, 10):
        rect(b, lx, 10, lx, 12 - wig, 'e')
        rect(b, lx + 1, 10, lx + 1, 11 + wig, 'e')
    # body
    rect(b, 3, 3, 12, 10, 'e'); rect(b, 4, 3, 11, 8, 'E')
    rect(b, 5, 3, 9, 5, 'F')                  # carapace shine
    # mandibles (front = right)
    rect(b, 12, 6, 13, 6, 'e'); rect(b, 12, 8, 13, 8, 'e')
    # eye
    rect(b, 9, 6, 11, 8, 'i'); px(b, 10, 7, 'E')
    # antennae
    px(b, 11, 2, 'e'); px(b, 12, 1, 'e')
    return b


def draw_sprinter(frame):  # sleek fast amber dart (~18x12)
    b = blank(18, 12)
    tail = 0 if frame == 0 else 1
    # streak body, pointed right
    rect(b, 3, 4, 12, 8, 'A'); rect(b, 4, 4, 11, 6, 'Y')
    rect(b, 12, 5, 15, 7, 'A'); px(b, 16, 6, 'Y')   # snout
    # dorsal fin
    rect(b, 6, 2, 9, 4, 'A'); px(b, 7, 1, 'Y')
    # eye
    px(b, 13, 5, 'i'); px(b, 13, 6, 'w')
    # legs / thrust
    rect(b, 5, 8, 6, 10 - tail, 'e'); rect(b, 9, 8, 10, 9 + tail, 'e')
    # motion streak at back
    rect(b, 1, 5, 2, 7, 'Y')
    return b


def draw_spitter(frame):  # squat amber gunner with a glowing maw (~20x18)
    b = blank(20, 18)
    charged = frame == 1
    # legs
    for lx in (5, 9, 13):
        rect(b, lx, 13, lx + 1, 16, 'e')
    # body
    rect(b, 4, 5, 15, 14, 'e'); rect(b, 5, 5, 14, 12, 'A'); rect(b, 6, 5, 12, 8, 'Y')
    # back spines
    px(b, 6, 4, 'e'); px(b, 9, 3, 'e'); px(b, 12, 4, 'e')
    # eye
    rect(b, 7, 7, 9, 9, 'i'); px(b, 8, 8, 'e')
    # front maw / cannon (right), glows when charged
    mc = 'i' if charged else 'Y'
    rect(b, 15, 8, 18, 12, 'e'); rect(b, 16, 9, 18, 11, mc)
    if charged:
        px(b, 19, 10, 'i')
    return b


def draw_hulk(frame):  # big magenta brute (~28x26)
    b = blank(28, 26)
    st = 0 if frame == 0 else 1
    # legs
    rect(b, 7, 21, 11, 25 - st, 'p'); rect(b, 16, 21, 20, 24 + st, 'p')
    # torso
    rect(b, 5, 7, 22, 22, 'p'); rect(b, 6, 8, 21, 20, 'M'); rect(b, 8, 9, 19, 14, 'F')
    # armor plates
    rect(b, 9, 15, 18, 19, 'p'); rect(b, 10, 16, 17, 18, 'M')
    # shoulders / claws (front-right claw)
    rect(b, 3, 9, 6, 16, 'p'); rect(b, 21, 9, 24, 16, 'p')
    rect(b, 23, 11, 27, 13, 'e'); rect(b, 23, 15, 27, 17, 'e')   # claw prongs
    # head / maw
    rect(b, 18, 8, 23, 14, 'e'); rect(b, 19, 9, 22, 12, 'E')
    rect(b, 20, 10, 22, 11, 'i')                                 # eye
    px(b, 19, 13, 'i'); px(b, 21, 13, 'i')                       # fangs
    return b


def draw_boss(frame):  # hulking red war-mech beast (~46x40)
    b = blank(46, 40)
    st = 0 if frame == 0 else 1
    # legs
    rect(b, 11, 31, 18, 38 - st, 'c'); rect(b, 27, 31, 34, 37 + st, 'c')
    rect(b, 12, 32, 17, 35, 'e'); rect(b, 28, 32, 33, 35, 'e')
    # torso
    rect(b, 8, 10, 37, 33, 'e'); rect(b, 10, 11, 35, 30, 'E'); rect(b, 12, 12, 33, 20, 'F')
    # chest plate + core
    rect(b, 16, 20, 29, 28, 'c'); rect(b, 18, 21, 27, 27, 'E')
    rect(b, 20, 22, 25, 26, 'i'); rect(b, 21, 23, 24, 25, 'h')   # glowing core
    # shoulders
    rect(b, 4, 11, 10, 22, 'e'); rect(b, 35, 11, 41, 22, 'e')
    rect(b, 5, 12, 9, 18, 'E'); rect(b, 36, 12, 40, 18, 'E')
    # cannon arms
    rect(b, 38, 14, 45, 18, 'c'); rect(b, 1, 16, 7, 20, 'c'); px(b, 0, 18, 'i')
    # head
    rect(b, 17, 4, 28, 13, 'e'); rect(b, 18, 5, 27, 11, 'E')
    rect(b, 19, 7, 22, 9, 'i'); rect(b, 24, 7, 27, 9, 'i')       # two eyes
    # horns
    px(b, 17, 3, 'e'); px(b, 16, 2, 'e'); px(b, 28, 3, 'e'); px(b, 29, 2, 'e')
    return b


def draw_wraith(frame):  # spectral stalker (~20x24) — translucent in-game
    b = blank(20, 24)
    sway = 0 if frame == 0 else 1
    # trailing wisps (tattered hem, alternate frames)
    for i, wx in enumerate((4, 8, 12)):
        top = 17 + ((i + sway) % 2)
        rect(b, wx, top, wx + 2, top + 3, 'p')
        px(b, wx + 1, top + 4, 'x')
    # shroud body, tapering down
    rect(b, 4, 8, 15, 17, 'p'); rect(b, 5, 8, 14, 15, 'u')
    rect(b, 6, 8, 13, 11, 'U')                  # inner glow upper
    # cowl / head dome
    rect(b, 5, 2, 14, 9, 'p'); rect(b, 6, 3, 13, 8, 'u')
    px(b, 5, 2, None); px(b, 14, 2, None)
    # void face + glowing eyes
    rect(b, 7, 4, 12, 7, 'x')
    px(b, 8, 5, 'i'); px(b, 11, 5, 'i')
    if frame == 1:
        px(b, 8, 6, 'U'); px(b, 11, 6, 'U')     # eye flare
    # reaching claw (right, toward player)
    rect(b, 14, 10 + sway, 17, 11 + sway, 'u'); px(b, 18, 11 + sway, 'U')
    return b


# crew survivor NPC — cyan-suited astronaut, waving when waiting
def draw_crew(frame):  # ~18x28
    b = blank(18, 28)
    wave = frame == 1
    # legs
    rect(b, 6, 19, 8, 24, 't'); rect(b, 10, 19, 12, 24, 'T')
    rect(b, 5, 24, 8, 25, 'l'); rect(b, 10, 24, 13, 25, 'l')   # boots
    # torso suit
    rect(b, 5, 10, 13, 19, 'T'); rect(b, 6, 11, 12, 17, 't')
    rect(b, 7, 12, 11, 14, 'v')                                 # chest panel
    px(b, 9, 13, 'V')                                            # status light
    rect(b, 5, 17, 13, 18, 'l')                                  # belt
    # left arm (always down)
    rect(b, 3, 11, 5, 17, 'T'); rect(b, 3, 17, 4, 18, 'k')
    # right arm: waving for help vs down
    if wave:
        rect(b, 13, 5, 15, 11, 'T'); rect(b, 14, 3, 15, 5, 'k')  # raised + hand
    else:
        rect(b, 13, 11, 15, 17, 'T'); rect(b, 14, 17, 15, 18, 'k')
    # helmet
    rect(b, 5, 1, 13, 9, 'T'); rect(b, 6, 2, 12, 8, 't')
    px(b, 5, 1, None); px(b, 13, 1, None)
    rect(b, 7, 3, 12, 6, 'v'); rect(b, 8, 4, 10, 5, 'V')         # visor + face glint
    px(b, 9, 4, 'k'); px(b, 10, 4, 'k')                          # face behind visor
    return b


C.update({
    # wraith purples + crew teals
    'u': (150, 96, 210), 'U': (208, 168, 255), 'x': (44, 22, 66),
    't': (52, 120, 160), 'T': (30, 80, 116),
})

ENEMIES = {
    'swarmer': draw_swarmer, 'sprinter': draw_sprinter, 'spitter': draw_spitter,
    'hulk': draw_hulk, 'boss': draw_boss, 'wraith': draw_wraith,
}
for name, fn in ENEMIES.items():
    for f in (0, 1):
        to_image(outline(fn(f))).save(os.path.join(OUT_DIR, f'enemy_{name}_{f}.png'))
print('wrote enemy sprites')


# ============================ PICKUPS ============================
# medical pack — white case with a bold red cross
C.update({
    'W': (238, 245, 250), 'Q': (200, 214, 226), 'R': (232, 58, 72),
    'q': (188, 36, 50), 'J': (120, 140, 160),
})


def draw_pack(frame):  # health pack (~16x14), frame 1 = brighter pulse
    b = blank(16, 14)
    glow = frame == 1
    # case body
    rect(b, 2, 3, 13, 12, 'W')
    px(b, 2, 3, None); px(b, 13, 3, None); px(b, 2, 12, None); px(b, 13, 12, None)  # rounded corners
    rect(b, 3, 3, 12, 3, 'W')
    # casing shadow / base
    rect(b, 3, 11, 12, 12, 'Q')
    px(b, 3, 12, None); px(b, 12, 12, None)
    # carry handle
    rect(b, 6, 1, 9, 2, 'J'); rect(b, 7, 2, 8, 2, 'W')
    # side seam highlight
    rect(b, 3, 4, 3, 10, 'W')
    # red cross
    cr = 'R' if not glow else 'R'
    rect(b, 7, 5, 8, 10, cr)   # vertical bar
    rect(b, 5, 7, 10, 8, cr)   # horizontal bar
    rect(b, 8, 6, 8, 9, 'q'); rect(b, 9, 8, 10, 8, 'q')  # cross shading
    if glow:
        px(b, 7, 5, 'i'); px(b, 5, 7, 'i')  # bright glints when pulsing
    return b


for f in (0, 1):
    to_image(outline(draw_pack(f))).save(os.path.join(OUT_DIR, f'pickup_heal_{f}.png'))
print('wrote pickup sprites')

for f in (0, 1):
    to_image(outline(draw_crew(f))).save(os.path.join(OUT_DIR, f'crew_{f}.png'))
print('wrote crew sprites')

# enemy preview sheet
cols = list(ENEMIES.items())
maxw = max(len(fn(0)[0]) for _, fn in cols)
maxh = max(len(fn(0)) for _, fn in cols)
esheet = Image.new('RGBA', (maxw * 6 * len(cols) + 40, maxh * 6 * 2 + 30), (11, 20, 34, 255))
for i, (name, fn) in enumerate(cols):
    for f in (0, 1):
        img = to_image(outline(fn(f)), scale=6)
        esheet.paste(img, (10 + i * (maxw * 6 + 6), 10 + f * (maxh * 6 + 6)), img)
esheet.save('/tmp/enemies_preview.png')
print('wrote enemy preview')
