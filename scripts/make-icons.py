"""Generate app icons (needs Pillow): python3 scripts/make-icons.py"""
from PIL import Image, ImageDraw

LACQUER, PAPER, INK = (168, 36, 28), (243, 234, 219), (27, 25, 21)

def icon(size, maskable=False, path=None):
    s = size * 4  # draw large, downsample for smooth edges
    im = Image.new('RGB', (s, s), LACQUER)
    d = ImageDraw.Draw(im)
    scale = 0.62 if maskable else 0.78  # maskable: keep inside the safe zone
    c, r = s / 2, s / 2 * scale
    d.ellipse([c - r, c - r, c + r, c + r], fill=PAPER, outline=INK, width=int(s * 0.025))
    # beacon arrow, pointing north-east like the design
    pts = [(0, -0.72), (0.48, 0.6), (0, 0.32), (-0.48, 0.6)]
    import math
    a = math.radians(32)
    rot = [(x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)) for x, y in pts]
    poly = [(c + x * r * 0.8, c + y * r * 0.8) for x, y in rot]
    d.polygon(poly, fill=LACQUER, outline=INK, width=int(s * 0.02))
    im.resize((size, size), Image.LANCZOS).save(path)

icon(192, path='public/icons/icon-192.png')
icon(512, path='public/icons/icon-512.png')
icon(512, maskable=True, path='public/icons/maskable-512.png')
icon(180, maskable=True, path='public/icons/apple-touch-icon.png')
icon(32, path='public/favicon.png')
print('icons written')
