"""Textures for the VE Commodore cabin (ve89 cabin), drawn from Riley's reference photos of a
VE Series 2 SS-V: red-lit instrument faces, the black centre stack (red display pod, twin vents,
hazard switch, Blaupunkt head unit with its screen, climate knobs) and the chrome lion wheel badge.

    python3 tools/roadcars/cabin_tex.py <lion.png>

lion.png is the 1994-2016 Holden lion roundel rendered from github.com/detain/svg-logos (holden-1.svg)
at 1024 px. Writes assets/roadcars/cabin/{dials,stack,pod,badge}.webp.
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'roadcars', 'cabin')
MONT = os.path.join(ROOT, 'tools', 'fonts', 'Montserrat.ttf')
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def font(size, path=MONT, weight=None):
    f = ImageFont.truetype(path, size)
    if weight:
        try:
            f.set_variation_by_axes([weight])
        except Exception:
            pass
    return f


def dial(size, maxv, step, minor, label, unit, red_from=None, v8=False):
    """One round SS-V instrument: red-lit face, white numerals and ticks, the red zone, an inset gauge."""
    S = size
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    c = S / 2
    # Face: deep red that glows brighter towards the rim (the backlight sits behind the ring).
    y, x = np.mgrid[0:S, 0:S]
    r = np.hypot(x - c, y - c) / c
    glow = np.clip((r - .25) / .7, 0, 1) ** 1.6
    face = np.zeros((S, S, 4), np.uint8)
    face[..., 0] = (48 + 150 * glow).clip(0, 255)
    face[..., 1] = (4 + 30 * glow).clip(0, 255)
    face[..., 2] = (8 + 14 * glow).clip(0, 255)
    face[..., 3] = np.where(r < .965, 255, 0)
    im = Image.fromarray(face)
    d = ImageDraw.Draw(im)
    # Satin chrome bezel ring
    for i in range(10):
        t = i / 9
        col = tuple(int(v) for v in (90 + 120 * (1 - abs(t - .4)), 92 + 120 * (1 - abs(t - .4)), 96 + 122 * (1 - abs(t - .4))))
        d.ellipse([c - S * .5 + i, c - S * .5 + i, c + S * .5 - i, c + S * .5 - i], outline=col, width=1)
    d.ellipse([c - S * .48, c - S * .48, c + S * .48, c + S * .48], outline=(20, 4, 4), width=3)
    a0, a1 = math.radians(225), math.radians(-45)  # sweep 270 degrees clockwise from bottom left
    def ang(v):
        return a0 + (a1 - a0) * v / maxv
    def pt(a, rr):
        return c + math.cos(a) * rr, c - math.sin(a) * rr
    if red_from is not None:
        for k in range(60):
            v0 = red_from + (maxv - red_from) * k / 60
            v1 = red_from + (maxv - red_from) * (k + 1) / 60
            d.line([pt(ang(v0), S * .415), pt(ang(v1), S * .415)], fill=(255, 30, 22), width=int(S * .025))
    nv = int(round(maxv / minor))
    for k in range(nv + 1):
        v = k * minor
        major = abs(v / step - round(v / step)) < 1e-6
        a = ang(v)
        d.line([pt(a, S * (.36 if major else .395)), pt(a, S * .44)], fill=(255, 246, 236), width=max(2, int(S * (.012 if major else .005))))
    fN = font(int(S * (.085 if maxv < 20 else .062)), weight=700)
    for k in range(int(maxv / step) + 1):
        v = k * step
        a = ang(v)
        x0, y0 = pt(a, S * (.285 if maxv < 20 else .3))
        txt = str(int(v))
        d.text((x0, y0), txt, font=fN, fill=(255, 248, 240), anchor='mm')
    d.text((c, c - S * .17), unit, font=font(int(S * .045), weight=600), fill=(255, 210, 200), anchor='mm')
    if v8:
        d.text((c, c + S * .2), 'V8', font=font(int(S * .1), MONT.replace('.ttf', 'I.ttf'), 800), fill=(230, 232, 236), anchor='mm')
    d.text((c, c + S * .36), label, font=font(int(S * .04), weight=600), fill=(255, 200, 190), anchor='mm')
    return im.filter(ImageFilter.GaussianBlur(.5))


def dials():
    W, H = 1024, 512
    im = Image.new('RGBA', (W, H), (8, 8, 9, 255))
    d = ImageDraw.Draw(im)
    # cluster backing: black graining with a faint red spill from the dials
    tach = dial(440, 7, 1, .5, 'x1000 r/min', 'RPM', red_from=6)
    speed = dial(440, 260, 20, 10, 'km/h', 'km/h', v8=True)
    im.alpha_composite(tach, (10, 36))
    im.alpha_composite(speed, (W - 450, 36))
    # Driver information display between the dials
    d.rounded_rectangle([456, 160, 568, 352], 12, fill=(10, 2, 2), outline=(70, 70, 74), width=4)
    f = font(26, weight=700)
    d.text((512, 200), 'SS-V', font=f, fill=(255, 52, 40), anchor='mm')
    d.text((512, 252), 'ODO', font=font(20, weight=600), fill=(255, 60, 48), anchor='mm')
    d.text((512, 284), '128460', font=font(22, weight=700), fill=(255, 70, 52), anchor='mm')
    d.text((512, 330), 'D', font=font(30, weight=800), fill=(255, 70, 52), anchor='mm')
    im.convert('RGB').save(os.path.join(OUT, 'dials.webp'), quality=92)


def vent(d, box, slats=6):
    x0, y0, x1, y1 = box
    d.rounded_rectangle(box, 10, fill=(14, 14, 15), outline=(52, 53, 56), width=4)
    for i in range(slats):
        yy = y0 + (y1 - y0) * (i + .7) / (slats + .4)
        d.line([(x0 + 14, yy), (x1 - 14, yy)], fill=(58, 59, 62), width=5)
        d.line([(x0 + 14, yy + 4), (x1 - 14, yy + 4)], fill=(4, 4, 5), width=3)


def knob(d, cx, cy, r, ring=True):
    if ring:
        d.ellipse([cx - r - 9, cy - r - 9, cx + r + 9, cy + r + 9], outline=(220, 30, 26), width=4)
    for i in range(int(r)):
        t = i / r
        g = int(40 + 120 * (1 - t) ** 2)
        d.ellipse([cx - r + i, cy - r + i, cx + r - i, cy + r - i], outline=(g, g, g + 4))
    d.ellipse([cx - r * .62, cy - r * .62, cx + r * .62, cy + r * .62], fill=(24, 24, 26))
    d.line([(cx, cy - r * .55), (cx, cy - r * .2)], fill=(235, 235, 240), width=4)


def button(d, box, text=None, red=False):
    d.rounded_rectangle(box, 6, fill=(26, 26, 28), outline=(60, 60, 64), width=2)
    if text:
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        d.text((cx, cy), text, font=font(17, weight=700), fill=(255, 64, 50) if red else (205, 205, 210), anchor='mm')


def stack():
    """Centre stack face, 512 x 1024 px for about 0.24 m x 0.48 m (y 0.40 -> 0.88)."""
    W, H = 512, 1024
    im = Image.new('RGBA', (W, H), (12, 12, 13, 255))
    d = ImageDraw.Draw(im)
    # Gloss black side rails (the two uprights either side of the stack)
    for x0 in (0, W - 40):
        for i in range(40):
            g = int(18 + 40 * math.sin(math.pi * i / 40) ** 4)
            d.line([(x0 + i, 0), (x0 + i, H)], fill=(g, g, g + 2))
    # Twin centre vents with the adjuster between them
    vent(d, (56, 40, 236, 170)); vent(d, (276, 40, 456, 170))
    d.rounded_rectangle((238, 70, 274, 140), 6, fill=(30, 30, 32), outline=(80, 80, 84), width=2)
    for i in range(4):
        d.line([(246, 82 + i * 15), (266, 82 + i * 15)], fill=(150, 150, 155), width=3)
    # Hazard switch
    d.rounded_rectangle((222, 190, 290, 232), 8, fill=(22, 22, 24), outline=(70, 70, 74), width=2)
    d.polygon([(256, 196), (241, 226), (271, 226)], outline=(235, 40, 30), width=4)
    # Head unit
    d.rounded_rectangle((52, 250, 460, 640), 12, fill=(6, 6, 7), outline=(60, 60, 64), width=3)
    button(d, (66, 262, 136, 290), 'LOAD'); button(d, (376, 262, 446, 290), 'EJECT')
    for i, t in enumerate(['RPT', 'BAND', 'AM', 'TUNE', 'HELP']):
        button(d, (66, 310 + i * 52, 120, 348 + i * 52), t)
    for i, t in enumerate(['A/C', 'CD', 'FM', 'AUX', 'SET']):
        button(d, (392, 310 + i * 52, 446, 348 + i * 52), t)
    # Screen: red-on-black like the photo
    d.rounded_rectangle((134, 304, 378, 520), 6, fill=(3, 0, 0), outline=(40, 40, 44), width=3)
    d.text((256, 336), 'FM1  101.9', font=font(26, weight=700), fill=(255, 52, 40), anchor='mm')
    d.text((256, 386), 'Saturday  12:09 pm', font=font(22, weight=600), fill=(255, 64, 48), anchor='mm')
    d.text((256, 432), 'EQ  Rock', font=font(22, weight=600), fill=(220, 40, 30), anchor='mm')
    for i in range(6):
        d.rectangle((152 + i * 37, 470, 180 + i * 37, 500), outline=(200, 36, 28), width=2)
        d.text((166 + i * 37, 485), str(i + 1), font=font(16, weight=700), fill=(255, 64, 48), anchor='mm')
    d.text((256, 560), 'BLAUPUNKT', font=font(22, weight=700), fill=(200, 200, 205), anchor='mm')
    knob(d, 116, 590, 30, ring=False); knob(d, 396, 590, 30, ring=False)
    # Climate panel: two big knobs with red rings and the button row between
    d.rounded_rectangle((52, 662, 460, 860), 12, fill=(10, 10, 11), outline=(56, 56, 60), width=3)
    knob(d, 136, 760, 52); knob(d, 376, 760, 52)
    for i, t in enumerate(['AUTO', 'A/C', 'REC', 'OFF']):
        button(d, (214, 690 + i * 40, 298, 722 + i * 40), t, red=(t == 'A/C'))
    d.text((136, 838), 'ZONE', font=font(16, weight=700), fill=(190, 190, 196), anchor='mm')
    d.text((376, 838), 'AUTO', font=font(16, weight=700), fill=(190, 190, 196), anchor='mm')
    # Lower trim: piano black to the console
    for yy in range(880, H):
        g = int(10 + 26 * math.exp(-((yy - 900) / 30) ** 2))
        d.line([(40, yy), (W - 40, yy)], fill=(g, g, g + 2))
    im = im.filter(ImageFilter.GaussianBlur(.6))
    im.convert('RGB').save(os.path.join(OUT, 'stack.webp'), quality=92)


def pod():
    """Red trip/clock display in the hood on top of the stack."""
    W, H = 512, 128
    im = Image.new('RGB', (W, H), (10, 10, 11))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((70, 22, 442, 106), 8, fill=(5, 0, 0), outline=(40, 40, 44), width=3)
    d.text((150, 64), '22°C', font=font(30, weight=700), fill=(255, 48, 36), anchor='mm')
    d.text((256, 64), '12:09', font=font(36, weight=800), fill=(255, 56, 40), anchor='mm')
    d.text((362, 64), 'AUTO', font=font(22, weight=700), fill=(255, 48, 36), anchor='mm')
    im.save(os.path.join(OUT, 'pod.webp'), quality=92)


def badge(lion_png):
    """Chrome lion on a black field inside a chrome ring, as on the VE steering wheel."""
    src = np.array(Image.open(lion_png).convert('RGBA')).astype(np.float32)
    cx, cy, rr = 509.5, 423, 423
    crop = src[int(cy - rr):int(cy + rr), int(cx - rr):int(cx + rr)]
    S = crop.shape[0]
    white = (crop[..., 0] > 200) & (crop[..., 1] > 200) & (crop[..., 2] > 200) & (crop[..., 3] > 128)
    y, x = np.mgrid[0:S, 0:S]
    r = np.hypot(x - S / 2, y - S / 2) / (S / 2)
    lion = white & (r < .9)
    ring = (r >= .9) & (r <= 1)
    shade = np.clip(1.05 - .55 * (y / S) + .25 * np.sin(x / S * 6.0), .35, 1.1)
    out = np.zeros((S, S, 4), np.float32)
    out[..., 0:3] = 14
    out[..., 3] = np.where(r <= 1, 255, 0)
    chrome = np.stack([215 * shade, 218 * shade, 224 * shade], -1)
    out[lion, 0:3] = chrome[lion]
    out[ring, 0:3] = chrome[ring] * .95
    im = Image.fromarray(out.clip(0, 255).astype(np.uint8)).resize((256, 256), Image.LANCZOS)
    im.save(os.path.join(OUT, 'badge.webp'), quality=94)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    dials(); stack(); pod(); badge(sys.argv[1])
    print('ok', sorted(os.listdir(OUT)))
