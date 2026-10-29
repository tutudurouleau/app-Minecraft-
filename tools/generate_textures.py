#!/usr/bin/env python3
"""
Génère les textures ORIGINALES de BlocNav (pixel-art 16x16) et les icônes.

Tout est dessiné par ce script (bruit aléatoire + formes simples) :
aucune image de Minecraft n'est utilisée. Les vraies textures du jeu
s'importent depuis l'app (Réglages > Importer un pack) et restent sur
le téléphone.

Usage (sur un ordinateur avec Python + Pillow) :
    python3 tools/generate_textures.py

Résultat :
    textures/*.png        -> textures de blocs 16x16
    textures/icons/*.png  -> icônes 18x18 (16x16 + contour automatique)
    icons/*.png           -> icônes de l'application (écran d'accueil)
"""
import math
import os
import random

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX_DIR = os.path.join(ROOT, 'textures')
ICON_DIR = os.path.join(TEX_DIR, 'icons')
APP_DIR = os.path.join(ROOT, 'icons')

# Teintes appliquées par l'app aux textures grises (doivent correspondre
# aux valeurs "tint" de js/textures.js). Servent ici pour l'icône de l'app.
TINT_GRASS = '#84C858'


# ---------------------------------------------------------------------------
# Outils de dessin
# ---------------------------------------------------------------------------

def rgba(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def gray(v):
    v = max(0, min(255, int(v)))
    return (v, v, v, 255)


def shade(c, f):
    """Assombrit (f<1) ou éclaircit (f>1) une couleur RGBA."""
    return tuple(max(0, min(255, int(round(ch * f)))) for ch in c[:3]) + (c[3],)


def new(size=16):
    return Image.new('RGBA', (size, size), (0, 0, 0, 0))


def noise_fill(img, rng, palette, weights=None):
    px = img.load()
    cols = [rgba(c) if isinstance(c, str) else c for c in palette]
    for y in range(img.height):
        for x in range(img.width):
            px[x, y] = rng.choices(cols, weights)[0]


def specks(img, rng, color, count, size=1):
    px = img.load()
    c = rgba(color) if isinstance(color, str) else color
    for _ in range(count):
        x, y = rng.randrange(img.width), rng.randrange(img.height)
        for dx in range(size):
            px[(x + dx) % img.width, y] = c


def tint(img, color):
    """Multiplie une image grise par une couleur (comme le fait l'app)."""
    t = rgba(color)
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r * t[0] // 255, g * t[1] // 255, b * t[2] // 255, a)
    return out


# ---------------------------------------------------------------------------
# Textures de blocs (16x16, se répètent sans couture)
# ---------------------------------------------------------------------------

def tex_grass(seed=11):
    """Herbe vue de dessus, en GRIS : l'app la colore selon le biome."""
    rng = random.Random(seed)
    img = new()
    noise_fill(img, rng, [gray(v) for v in (196, 206, 216, 226, 236)], [2, 3, 4, 3, 2])
    px = img.load()
    for _ in range(10):  # petites touffes plus sombres
        x, y = rng.randrange(16), rng.randrange(16)
        for dx, dy in [(0, 0), (1, 0), (0, 1)][:rng.randint(1, 3)]:
            px[(x + dx) % 16, (y + dy) % 16] = gray(rng.choice((160, 170, 180)))
    specks(img, rng, gray(248), 7)  # brins clairs
    return img


def tex_flowers():
    """Herbe fleurie (parcs) : déjà en couleur."""
    img = tint(tex_grass(seed=12), TINT_GRASS)
    px = img.load()
    flowers = [((3, 3), '#E04B3A'), ((11, 5), '#F5F5F0'), ((6, 11), '#9B6FD6'), ((13, 13), '#F4D03F')]
    for (x, y), petal in flowers:
        for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            px[(x + dx) % 16, (y + dy) % 16] = rgba(petal)
        px[x, y] = rgba('#E8912B') if petal != '#F4D03F' else rgba('#B5651D')
    return img


def tex_leaves():
    """Feuillage de forêt vu de dessus, en GRIS (coloré par l'app)."""
    rng = random.Random(21)
    img = new()
    noise_fill(img, rng, [gray(v) for v in (150, 170, 190, 205, 222)], [2, 3, 4, 3, 2])
    px = img.load()
    for _ in range(14):  # trous d'ombre entre les feuilles
        x, y = rng.randrange(16), rng.randrange(16)
        px[x, y] = gray(rng.choice((70, 85, 95)))
        if rng.random() < 0.5:
            px[(x + 1) % 16, y] = gray(100)
    specks(img, rng, gray(240), 8)
    return img


def tex_farmland():
    """Champ cultivé : rangées de cultures et sillons de terre."""
    rng = random.Random(31)
    img = new()
    px = img.load()
    crops = [rgba(c) for c in ('#7DA23A', '#94B843', '#B9B451', '#6E8F31', '#A9B84A')]
    soil = [rgba(c) for c in ('#5B3D22', '#4E3219', '#664729')]
    for y in range(16):
        for x in range(16):
            if y % 4 == 3:
                px[x, y] = rng.choice(soil)
            else:
                px[x, y] = rng.choices(crops + soil[:1], [3, 3, 2, 2, 2, 1])[0]
    return img


def tex_dirt():
    rng = random.Random(41)
    img = new()
    noise_fill(img, rng, ['#7A5435', '#8B6340', '#6B4A2E', '#946B47'], [3, 3, 2, 1])
    specks(img, rng, '#55391F', 10)
    specks(img, rng, '#8F8B87', 5)
    return img


def tex_path():
    """Chemin de terre tassée."""
    rng = random.Random(51)
    img = new()
    noise_fill(img, rng, ['#9C7F4A', '#A98B53', '#8E7342', '#B4975E'], [3, 3, 2, 2])
    specks(img, rng, '#7A6136', 12)
    specks(img, rng, '#C2A66C', 6)
    return img


def tex_gravel():
    rng = random.Random(61)
    img = new()
    noise_fill(img, rng, ['#6F6A66', '#66625E', '#77726D'])
    px = img.load()
    colors = [rgba(c) for c in ('#8F8A85', '#A6A19B', '#5A5652', '#7D766F', '#9C8B7A')]
    for _ in range(38):  # petits cailloux
        x, y = rng.randrange(16), rng.randrange(16)
        c = rng.choice(colors)
        w, h = rng.choice([(1, 1), (2, 1), (2, 2), (1, 2)])
        for dy in range(h):
            for dx in range(w):
                px[(x + dx) % 16, (y + dy) % 16] = c
        px[x, y] = shade(c, 1.15)
    return img


def tex_stone():
    rng = random.Random(71)
    img = new()
    noise_fill(img, rng, ['#7A7A7A', '#858585', '#8E8E8E', '#717171'], [3, 3, 2, 2])
    px = img.load()
    for color, n in (('#646464', 7), ('#9C9C9C', 5)):  # veines horizontales
        for _ in range(n):
            x, y = rng.randrange(16), rng.randrange(16)
            for dx in range(rng.randint(2, 4)):
                px[(x + dx) % 16, y] = rgba(color)
    return img


def tex_cobble():
    """Pavés irréguliers (cellules de Voronoï qui se répètent)."""
    rng = random.Random(81)
    seeds = [(rng.uniform(0, 16), rng.uniform(0, 16)) for _ in range(9)]
    colors = [rgba(rng.choice(('#7B7B7B', '#8C8C8C', '#6E6E6E', '#979797'))) for _ in seeds]

    def cell(x, y):
        best, bi = 1e9, 0
        for i, (sx, sy) in enumerate(seeds):
            dx = min(abs(x + .5 - sx), 16 - abs(x + .5 - sx))
            dy = min(abs(y + .5 - sy), 16 - abs(y + .5 - sy))
            d = dx * dx + dy * dy
            if d < best:
                best, bi = d, i
        return bi

    ids = [[cell(x, y) for x in range(16)] for y in range(16)]
    img = new()
    px = img.load()
    for y in range(16):
        for x in range(16):
            i = ids[y][x]
            border = ids[y][(x + 1) % 16] != i or ids[(y + 1) % 16][x] != i
            if border:
                px[x, y] = rgba('#4A4A4A')
                continue
            c = colors[i]
            if ids[(y - 1) % 16][x] != i or ids[y][(x - 1) % 16] != i:
                c = shade(c, 1.2)  # arête éclairée
            elif rng.random() < 0.15:
                c = shade(c, 0.9)
            px[x, y] = c
    return img


def tex_sand():
    rng = random.Random(91)
    img = new()
    noise_fill(img, rng, ['#DCCB92', '#E3D4A0', '#D2C084', '#E9DCAD'], [3, 3, 2, 1])
    specks(img, rng, '#C4B077', 8)
    return img


def tex_snow():
    rng = random.Random(101)
    img = new()
    noise_fill(img, rng, ['#F2F6F8', '#E9EFF3', '#FAFCFD', '#E1E9EE'], [3, 3, 2, 1])
    specks(img, rng, '#D3DEE6', 6)
    return img


def tex_ice():
    rng = random.Random(111)
    img = new()
    noise_fill(img, rng, ['#9DC3F0', '#A9CCF3', '#93BAE9'], [3, 2, 2])
    px = img.load()
    for off in (2, 9):  # reflets en diagonale
        for t in range(16):
            if rng.random() < 0.8:
                px[(t + off) % 16, t] = rgba('#D2E6FA')
    specks(img, rng, '#E8F2FC', 4)
    return img


def tex_water():
    """Eau en GRIS avec vaguelettes (colorée en bleu par l'app)."""
    rng = random.Random(121)
    img = new()
    noise_fill(img, rng, [gray(v) for v in (150, 160, 170)])
    px = img.load()
    for i in range(7):
        x, y = rng.randrange(16), (i * 16 // 7 + rng.randint(0, 1)) % 16
        n = rng.randint(3, 5)
        for dx in range(n):
            px[(x + dx) % 16, y] = gray(rng.choice((222, 232, 242)))
            px[(x + dx) % 16, (y + 1) % 16] = gray(135)
        px[(x + 1) % 16, (y - 1) % 16] = gray(195)
    return img


def tex_mud():
    """Marais / zone humide."""
    rng = random.Random(131)
    img = new()
    noise_fill(img, rng, ['#4F4634', '#5A5040', '#463E2D'])
    px = img.load()
    for _ in range(5):
        x, y = rng.randrange(16), rng.randrange(16)
        c = rgba(rng.choice(('#3F5D6E', '#4E7488')))
        px[x, y] = c
        px[(x + 1) % 16, y] = c
    specks(img, rng, '#5E7A3A', 7)
    return img


def tex_planks():
    """Planches de bois (toits des petites maisons)."""
    rng = random.Random(141)
    img = new()
    px = img.load()
    bases = [rgba(c) for c in ('#A27A4B', '#9A7246', '#AA8352', '#96703F')]
    seam = rgba('#6B4E2C')
    seams_x = [7, 3, 11, 15]
    for row in range(4):
        base = bases[row]
        for y in range(row * 4, row * 4 + 4):
            for x in range(16):
                f = rng.choice((0.94, 1.0, 1.0, 1.05))
                px[x, y] = shade(base, f)
        for _ in range(3):  # fibres du bois
            x, y = rng.randrange(16), row * 4 + rng.randint(0, 2)
            for dx in range(rng.randint(3, 6)):
                px[(x + dx) % 16, y] = shade(base, 0.85)
        for x in range(16):
            px[x, row * 4 + 3] = seam
        sx = seams_x[row]
        for y in range(row * 4, row * 4 + 3):
            px[sx, y] = seam
    return img


def tex_bricks():
    """Briques de pierre (toits des grands immeubles)."""
    rng = random.Random(151)
    img = new()
    px = img.load()
    mortar = rgba('#5E5E5E')
    for y in range(16):
        row = y // 4
        offset = 0 if row % 2 == 0 else 4
        for x in range(16):
            if y % 4 == 3 or (x + offset) % 8 == 7:
                px[x, y] = mortar
            elif y % 4 == 0:
                px[x, y] = rgba('#A3A3A3')
            else:
                px[x, y] = rgba(rng.choice(('#8E8E8E', '#878787', '#959595')))
    return img


def tex_rail():
    """Rails vus de dessus (dans le sens de la ligne = horizontal)."""
    img = new()
    px = img.load()
    for x0 in (1, 5, 9, 13):  # traverses en bois
        for y in range(2, 14):
            px[x0, y] = rgba('#7A5530')
            px[x0 + 1, y] = rgba('#5C3F22')
    for y0 in (4, 10):  # deux rails en métal
        for x in range(16):
            px[x, y0] = rgba('#C8C8C8')
            px[x, y0 + 1] = rgba('#7E7E7E')
    return img


TEXTURES = {
    'grass': tex_grass,
    'flowers': tex_flowers,
    'leaves': tex_leaves,
    'farmland': tex_farmland,
    'dirt': tex_dirt,
    'path': tex_path,
    'gravel': tex_gravel,
    'stone': tex_stone,
    'cobble': tex_cobble,
    'sand': tex_sand,
    'snow': tex_snow,
    'ice': tex_ice,
    'water': tex_water,
    'mud': tex_mud,
    'planks': tex_planks,
    'bricks': tex_bricks,
    'rail': tex_rail,
}


# ---------------------------------------------------------------------------
# Icônes (16x16 dessinées en ASCII ou avec des formes simples)
# ---------------------------------------------------------------------------

PAL = {
    'k': '#1E1E1E', 'w': '#F4F4F4', 'g': '#BDBDBD', 'G': '#7A7A7A', 'd': '#4A4A4A',
    'r': '#D93B2B', 'R': '#8E1E14', 'y': '#F2C230', 'Y': '#C98A1B', 'o': '#E8792B',
    'b': '#3C7BD9', 'B': '#23498C', 'c': '#8FDDF0', 'n': '#8A5A2B', 'N': '#5A3818',
    't': '#D9A55B', 'l': '#6CC24A', 'L': '#2F8A2A', 's': '#E9B88E', 'p': '#F08AB0',
    'v': '#9B6FD6',
}


def from_ascii(rows, pal=PAL):
    img = new()
    px = img.load()
    assert len(rows) <= 16, rows
    for y, row in enumerate(rows):
        assert len(row) <= 16, (row, len(row))
        for x, ch in enumerate(row):
            if ch != '.':
                px[x, y] = rgba(pal[ch])
    return img


class Pix:
    """Petit pinceau pour dessiner des icônes géométriques."""

    def __init__(self, size=16):
        self.img = new(size)
        self.px = self.img.load()
        self.size = size

    def dot(self, x, y, c):
        if 0 <= x < self.size and 0 <= y < self.size:
            self.px[x, y] = rgba(PAL.get(c, c))

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.dot(x, y, c)

    def line(self, x0, y0, x1, y1, c, w=1):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n)
            y = round(y0 + (y1 - y0) * i / n)
            o = (w - 1) // 2
            self.rect(x - o, y - o, x - o + w - 1, y - o + w - 1, c)

    def ring(self, cx, cy, r0, r1, c):
        for y in range(self.size):
            for x in range(self.size):
                d = math.hypot(x + .5 - cx, y + .5 - cy)
                if r0 <= d <= r1:
                    self.dot(x, y, c)

    def head(self, tx, ty, direction, c, size=4):
        """Pointe de flèche (triangle) pointant dans 'direction'."""
        for j in range(size + 1):
            for i in range(-j, j + 1):
                if direction == 'up':
                    self.dot(tx + i, ty + j, c)
                elif direction == 'down':
                    self.dot(tx + i, ty - j, c)
                elif direction == 'right':
                    self.dot(tx - j, ty + i, c)
                elif direction == 'left':
                    self.dot(tx + j, ty + i, c)
        if direction in ('upright', 'upleft'):
            sgn = 1 if direction == 'upright' else -1
            for i in range(size + 2):
                for j in range(size + 2 - i):
                    self.dot(tx - sgn * i, ty + j, c)


def outline(img, color='#1E1E1E'):
    """Ajoute un contour de 1 pixel autour du dessin (image 18x18)."""
    out = Image.new('RGBA', (img.width + 2, img.height + 2), (0, 0, 0, 0))
    out.paste(img, (1, 1))
    src = out.copy().load()
    px = out.load()
    c = rgba(color)
    for y in range(out.height):
        for x in range(out.width):
            if src[x, y][3] > 0:
                continue
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < out.width and 0 <= ny < out.height and src[nx, ny][3] > 0:
                        px[x, y] = c
    return out


def mirror(img):
    return img.transpose(Image.FLIP_LEFT_RIGHT)


# --- Icônes de l'interface -------------------------------------------------

def ic_car():
    return from_ascii([
        '................',
        '................',
        '................',
        '................',
        '....kkkkkkk.....',
        '...krrrrrrrk....',
        '..krcccrcccrk...',
        '..krcccrcccrk...',
        'kkkrrrrrrrrrrkkk',
        'krrrrrrrrrrrrrrk',
        'kyrrrrrrrrrrrrRk',
        'krrrrrrrrrrrrrrk',
        'kkdddkkkkkkdddkk',
        '..dgd......dgd..',
        '..ddd......ddd..',
    ])


def ic_bike():
    p = Pix()
    p.ring(3.5, 11.5, 2.2, 3.6, 'd')
    p.ring(12.5, 11.5, 2.2, 3.6, 'd')
    p.dot(3, 11, 'g')
    p.dot(12, 11, 'g')
    p.line(3, 11, 7, 11, 'r')     # base arrière
    p.line(7, 11, 5, 6, 'r')      # tube de selle
    p.line(5, 7, 11, 7, 'r')      # tube horizontal
    p.line(7, 11, 11, 7, 'r')     # tube oblique
    p.line(11, 6, 12, 11, 'G')    # fourche
    p.rect(3, 5, 6, 5, 'k')       # selle
    p.rect(10, 4, 13, 4, 'k')     # guidon
    p.dot(11, 5, 'G')
    return p.img


def ic_walk():
    return from_ascii([
        '......ss........',
        '.....ssss.......',
        '.....ssss.......',
        '......ss........',
        '.....bbbb.......',
        '....bbbbbb......',
        '...bb.bbb.b.....',
        '...b..bbb..b....',
        '..s...bbb...s...',
        '......BBB.......',
        '.....BB.BB......',
        '.....B...BB.....',
        '....BB....B.....',
        '....B.....BB....',
        '...dd......dd...',
    ])


def ic_search():
    p = Pix()
    p.ring(6.5, 6.5, 3.2, 5.2, 'g')
    p.ring(6.5, 6.5, 0, 3.2, 'c')
    p.line(10, 10, 14, 14, 'n', w=3)
    return p.img


def ic_gear():
    p = Pix()
    for y in range(16):
        for x in range(16):
            dx, dy = x + .5 - 8, y + .5 - 8
            d = math.hypot(dx, dy)
            a = (math.degrees(math.atan2(dy, dx)) + 360) % 45
            tooth = d <= 7.4 and (a < 12 or a > 33)
            if (2.4 <= d <= 5.2) or (5.2 < d and tooth):
                p.dot(x, y, 'g' if dy < 0 else 'G')
    return p.img


def ic_locate():
    p = Pix()
    p.ring(8, 8, 4.0, 5.4, 'w')
    p.rect(7, 0, 8, 3, 'w')
    p.rect(7, 12, 8, 15, 'w')
    p.rect(0, 7, 3, 8, 'w')
    p.rect(12, 7, 15, 8, 'w')
    p.rect(6, 6, 9, 9, 'r')
    return p.img


def ic_close():
    p = Pix()
    p.line(2, 2, 13, 13, 'w', w=3)
    p.line(13, 2, 2, 13, 'w', w=3)
    return p.img


def ic_list():
    p = Pix()
    for y in (2, 7, 12):
        p.rect(1, y, 3, y + 2, 'y')
        p.rect(6, y, 14, y + 2, 'w')
    return p.img


def ic_compass():
    p = Pix()
    for y in range(16):
        for x in range(16):
            dx, dy = abs(x + .5 - 8), y + .5 - 8
            if dx <= (7.5 - abs(dy)) / 1.5:
                p.dot(x, y, 'r' if dy < 0 else 'w')
    return p.img


def ic_flag(colors):
    rows = []
    for y in range(15):
        row = ['.'] * 16
        row[2] = 'n'
        if 0 <= y <= 6:
            width = 10 if y in (0, 6) else 11
            for x in range(3, 3 + width):
                if colors == 'checker':
                    row[x] = 'k' if ((x // 2) + (y // 2)) % 2 else 'w'
                else:
                    row[x] = colors
        rows.append(''.join(row))
    rows.append('.NNN............')
    return from_ascii(rows)


def ic_pin():
    return from_ascii([
        '.....kkkkkk.....',
        '....krrrrrrk....',
        '...krrrrrrrrk...',
        '..krrrwwwwrrrk..',
        '..krrwwwwwwrrk..',
        '..krrwwwwwwrrk..',
        '..krrrwwwwrrrk..',
        '...krrrrrrrrk...',
        '...krrrrrrrrk...',
        '....krrrrrrk....',
        '....krrrrrrk....',
        '.....krrrrk.....',
        '.....krrrrk.....',
        '......krrk......',
        '......krrk......',
        '.......kk.......',
    ])


def ic_player():
    """Flèche de position (pointe vers le haut = direction du déplacement)."""
    return from_ascii([
        '.......bb.......',
        '.......bb.......',
        '......cbbb......',
        '......cbbb......',
        '.....ccbbbb.....',
        '.....ccbbbb.....',
        '....cccbbbbb....',
        '....cccbbbbb....',
        '...ccccbbbbbb...',
        '...ccccbbbbbb...',
        '..cccccbbbbbbb..',
        '..ccccc..bbbbb..',
        '.cccc......bbbb.',
        '.ccc........bbb.',
        'cc............bb',
    ])


# --- Flèches de manœuvre -----------------------------------------------------

def ic_straight():
    p = Pix()
    p.rect(6, 6, 8, 15, 'w')
    p.head(7, 1, 'up', 'w', 4)
    return p.img


def ic_right():
    p = Pix()
    p.rect(3, 6, 5, 15, 'w')
    p.rect(3, 6, 10, 8, 'w')
    p.head(14, 7, 'right', 'w', 4)
    return p.img


def ic_slight_right():
    p = Pix()
    p.rect(4, 10, 6, 15, 'w')
    p.line(5, 10, 10, 5, 'w', w=3)
    p.head(13, 2, 'upright', 'w', 4)
    return p.img


def ic_uturn():
    p = Pix()
    p.rect(10, 5, 12, 15, 'w')
    p.rect(3, 2, 12, 4, 'w')
    p.rect(3, 2, 5, 8, 'w')
    p.head(4, 13, 'down', 'w', 4)
    return p.img


def ic_roundabout():
    """Rond-point : anneau ouvert à droite + flèche (sens de rotation)."""
    p = Pix()
    for y in range(16):
        for x in range(16):
            dx, dy = x + .5 - 8, y + .5 - 9
            d = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx))  # 0 = droite, 90 = bas
            if 3.2 <= d <= 5.4 and not (-75 <= a <= 25):
                p.dot(x, y, 'w')
    p.head(12, 2, 'up', 'w', 3)   # pointe vers le haut, côté droit
    p.rect(11, 6, 13, 9, 'w')     # relie la pointe à l'anneau
    return p.img


# --- Icônes de lieux ------------------------------------------------------------

def ic_food():
    return from_ascii([
        '................',
        '................',
        '....tttttttt....',
        '..tttwttttwttt..',
        '.tttttttttwtttt.',
        '.tttttttttttttt.',
        '.llllllllllllll.',
        '..yyyyyyyyyyyy..',
        '.NNNNNNNNNNNNNN.',
        '.NNNNNNNNNNNNNN.',
        '.tttttttttttttt.',
        '..tttttttttttt..',
    ])


def ic_cafe():
    return from_ascii([
        '................',
        '....g..g..g.....',
        '.....g..g..g....',
        '....g..g..g.....',
        '................',
        '..wwwwwwwwww....',
        '..wnnnnnnnnwww..',
        '..wwwwwwwwww.w..',
        '..wwwwwwwwww.w..',
        '..wwwwwwwwwwww..',
        '..wwwwwwwwww....',
        '...wwwwwwww.....',
        '....wwwwww......',
        '.gggggggggggg...',
    ])


def ic_fuel():
    return from_ascii([
        '................',
        '..rrrrrrr.......',
        '..rrrrrrr.dd....',
        '..rwwwwwr..d....',
        '..rwwwwwr..d....',
        '..rrrrrrrdd.d...',
        '..rrrrrrr...d...',
        '..rrrrrrr..dd...',
        '..rrrrrrr.dd....',
        '..rrrrrrrdd.....',
        '..rrrrrrr.......',
        '..rrrrrrr.......',
        '.GGGGGGGGG......',
        '.ddddddddd......',
    ])


def ic_shop():
    return from_ascii([
        '................',
        '......kkkk......',
        '.....k....k.....',
        '.....k....k.....',
        '...yyyyyyyyyy...',
        '...yyyyyyyyyy...',
        '...yyykyykyyy...',
        '...yyyyyyyyyy...',
        '...yyyyyyyyyy...',
        '...YYYYYYYYYY...',
        '...yyyyyyyyyy...',
        '...yyyyyyyyyy...',
        '...YYYYYYYYYY...',
    ])


def ic_parking():
    rows = []
    p_shape = [
        '..............',
        '..wwwwwww.....',
        '..wwwwwwww....',
        '..ww....www...',
        '..ww.....ww...',
        '..ww....www...',
        '..wwwwwwww....',
        '..wwwwwww.....',
        '..ww..........',
        '..ww..........',
        '..ww..........',
        '..ww..........',
        '..............',
    ]
    for y in range(14):
        inner = p_shape[y] if y < len(p_shape) else '..............'
        rows.append('.' + ''.join('b' if ch == '.' else ch for ch in inner) + '.')
    return from_ascii(['................'] + rows)


def ic_cross(color):
    p = Pix()
    p.rect(1, 1, 14, 14, 'w')
    p.rect(6, 3, 9, 12, color)
    p.rect(3, 6, 12, 9, color)
    return p.img


def ic_hotel():
    p = Pix()
    p.rect(1, 3, 2, 13, 'n')       # tête de lit
    p.rect(3, 6, 6, 7, 'w')        # oreiller
    p.rect(7, 6, 14, 7, 'r')       # couverture
    p.rect(3, 8, 14, 9, 'r')
    p.rect(1, 10, 15, 11, 'N')     # cadre
    p.rect(14, 12, 15, 13, 'N')    # pied
    return p.img


def ic_school():
    return from_ascii([
        '................',
        '..bbbbbbbbbbb...',
        '..bbbbbbbbbbbb..',
        '..bbbbbbbbbbbb..',
        '..bbwwwwwwwbbb..',
        '..bbbbbbbbbbbb..',
        '..bbbbbbbbbbbb..',
        '..bbbbbbbbbbbb..',
        '..bbbbbbbbbbbb..',
        '..bbbbbbbbbbbb..',
        '..Bwwwwwwwwwwww.',
        '..BBBBBBBBBBBBB.',
    ])


def ic_bank():
    p = Pix()
    p.ring(8, 8, 0, 7.2, 'Y')
    p.ring(8, 8, 0, 5.8, 'y')
    euro = [
        '..YYY',
        '.Y...',
        'YYYY.',
        '.Y...',
        'YYYY.',
        '.Y...',
        '..YYY',
    ]
    for y, row in enumerate(euro):
        for x, ch in enumerate(row):
            if ch != '.':
                p.dot(6 + x, 4 + y, ch)
    return p.img


def ic_bus():
    return from_ascii([
        '................',
        '..bbbbbbbbbbbb..',
        '..bccccccccccb..',
        '..bccccccccccb..',
        '..bccccccccccb..',
        '..bbbbbbbbbbbb..',
        '..bbbbbbbbbbbb..',
        '..bybbbbbbbbyb..',
        '..bbbbbbbbbbbb..',
        '..dddddddddddd..',
        '...dd......dd...',
    ])


def ic_train():
    return from_ascii([
        '................',
        '....rrrrrrrr....',
        '...rrrrrrrrrr...',
        '...rccccccccr...',
        '...rccccccccr...',
        '...rrrrrrrrrr...',
        '...rrrrrrrrrr...',
        '...ryrrrrrryr...',
        '...rrrrrrrrrr...',
        '....dddddddd....',
        '...d........d...',
        '..GGGGGGGGGGGG..',
    ])


def ic_star():
    return from_ascii([
        '.......y........',
        '.......y........',
        '......yyy.......',
        '......yyy.......',
        '.yyyyyyyyyyyyy..',
        '..yyyyyyyyyyy...',
        '...yyyyyyyyy....',
        '....yyyyyyy.....',
        '....yyyyyyy.....',
        '...yyyy.yyyy....',
        '...yyy...yyy....',
        '..yyy.....yyy...',
        '..yy.......yy...',
    ])


def ic_generic():
    p = Pix()
    p.ring(8, 8, 0, 4.2, 'v')
    p.ring(8, 8, 0, 2.0, 'w')
    return p.img


def ic_tex_pack():
    """Petit bloc (pour le bouton d'import de textures)."""
    rows = [
        '................',
        '.llllllllllllll.',
        '.lLllllLlllllLl.',
        '.llllLlllllLlll.',
        '.nnnnnnnnnnnnnn.',
        '.nNnnnnnNnnnnnn.',
        '.nnnnNnnnnnNnnn.',
        '.nnnnnnnnnnnnnn.',
        '.nnNnnnnnnNnnnn.',
        '.nnnnnnNnnnnnnn.',
        '.nnnnnnnnnnnNnn.',
        '.nNnnnnnnnnnnnn.',
        '.nnnnnNnnnnnnNn.',
        '.nnnnnnnnnnnnnn.',
    ]
    return from_ascii(rows)


def make_icons():
    straight = ic_straight()
    right = ic_right()
    slight = ic_slight_right()
    uturn = ic_uturn()
    icons = {
        # interface
        'car': (ic_car(), None),
        'bike': (ic_bike(), '#F4F4F4'),
        'walk': (ic_walk(), None),
        'search': (ic_search(), None),
        'gear': (ic_gear(), None),
        'locate': (ic_locate(), None),
        'close': (ic_close(), None),
        'list': (ic_list(), None),
        'compass': (ic_compass(), None),
        'flag-start': (ic_flag('l'), None),
        'flag-end': (ic_flag('checker'), None),
        'pin': (ic_pin(), '#F4F4F4'),
        'player': (ic_player(), '#F4F4F4'),
        'texture-pack': (ic_tex_pack(), None),
        # manœuvres
        'turn-straight': (straight, None),
        'turn-right': (right, None),
        'turn-left': (mirror(right), None),
        'turn-slight-right': (slight, None),
        'turn-slight-left': (mirror(slight), None),
        'turn-uturn': (uturn, None),
        'turn-roundabout': (ic_roundabout(), None),
        # lieux
        'poi-food': (ic_food(), None),
        'poi-cafe': (ic_cafe(), None),
        'poi-fuel': (ic_fuel(), None),
        'poi-shop': (ic_shop(), None),
        'poi-parking': (ic_parking(), None),
        'poi-hospital': (ic_cross('r'), None),
        'poi-pharmacy': (ic_cross('L'), None),
        'poi-hotel': (ic_hotel(), None),
        'poi-school': (ic_school(), None),
        'poi-bank': (ic_bank(), None),
        'poi-bus': (ic_bus(), None),
        'poi-train': (ic_train(), None),
        'poi-star': (ic_star(), None),
        'poi-generic': (ic_generic(), None),
    }
    out = {}
    for name, (img, outline_color) in icons.items():
        out[name] = outline(img, outline_color or '#1E1E1E')
    return out


# ---------------------------------------------------------------------------
# Icône de l'application (écran d'accueil)
# ---------------------------------------------------------------------------

def app_icon_16():
    img = tint(tex_grass(seed=7), TINT_GRASS)
    path = tex_path()
    px, pp = img.load(), path.load()
    for y in range(16):  # chemin en diagonale
        for x in range(16):
            if abs((x + y) - 15) <= 1:
                px[x, y] = pp[x, y]
    pin = [
        '..kkkkk..',
        '.krrrrrk.',
        'krrwwwrrk',
        'krwwwwwrk',
        'krrwwwrrk',
        '.krrrrrk.',
        '.krrrrrk.',
        '..krrrk..',
        '...krk...',
        '...krk...',
        '....k....',
    ]
    for y, row in enumerate(pin):
        for x, ch in enumerate(row):
            if ch != '.':
                px[3 + x + 1, 2 + y] = rgba(PAL[ch])
    return img


def main():
    os.makedirs(TEX_DIR, exist_ok=True)
    os.makedirs(ICON_DIR, exist_ok=True)
    os.makedirs(APP_DIR, exist_ok=True)

    for name, fn in TEXTURES.items():
        fn().save(os.path.join(TEX_DIR, name + '.png'), optimize=True)

    for name, img in make_icons().items():
        img.save(os.path.join(ICON_DIR, name + '.png'), optimize=True)

    icon = app_icon_16()
    for size, fname in ((512, 'icon-512.png'), (192, 'icon-192.png'), (32, 'favicon.png')):
        icon.resize((size, size), Image.NEAREST).save(os.path.join(APP_DIR, fname), optimize=True)
    print('Textures et icônes générées.')


if __name__ == '__main__':
    main()
