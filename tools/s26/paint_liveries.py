"""Paint the Supercars 26 liveries into the projection atlas used by build_bodies.py.

    python3 tools/s26/paint_liveries.py [keys...]

The paint and bonnet UVs are flat projections in metres (see REGION / side_uv / top_uv / end_uv in
build_bodies.py), so a livery is painted as a function of the car's own 3D position (x left, y up, z forward)
and logos are dropped onto the side, top, front and rear views at real sizes. Same atlas on every body.
Writes assets/s26/liveries/<key>.png (preview), <key>.dds.gz.bin (DXT1 + mips) and <key>.webp.
Logos are real files: the game's own sponsor registry in assets/img and tools/s26/logos (vector files from
github.com/detain/svg-logos rendered by tools/livery/svgr.js). Nothing is typeset."""
import json, os, subprocess, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'assets/s26/liveries')
# the 2026 reveal photos (supercars.com galleries) are reference only and stay out of the repo
REFS = os.environ.get('S26_REFS', os.path.expanduser('~/s26_refs'))
K = 2                     # supersampling
ATLAS = 2048
S, S2 = 345.0, 180.0
ZF, ZB, YT, XL = 2.62, -2.62, 1.48, 1.06
REGION = {'left': (110, 0), 'right': (110, 520), 'top': (110, 1040), 'front': (40, 1772), 'rear': (500, 1772), 'lip': (905, 1780)}
SIZE = {'left': (1808, 511), 'right': (1808, 511), 'top': (1808, 732), 'front': (382, 267), 'rear': (382, 267), 'lip': (1116, 236)}
S3, LX0, LY1, LA = 900.0, -.62, .33, .698   # the splitter strip (lip bodies, see build_bodies.LIP): x = LX0 + u / S3,
#                                             w = LY1 - v / S3 where w = y cos LA - (z - 2.5) sin LA (seen from in front, above)
FIT = not os.environ.get('S26_NOFIT')
GRID = json.load(open(os.path.join(HERE, 'grid.json')))

# wheel axles (z) of each chassis; liveries are drawn against them
ENDPLATE = (55, 300)      # atlas pixel of the wing endplates (build_bodies.ENDPLATE_UV)
WING = (4, 400, 103, 593)  # atlas patch of the rear wing blade (build_bodies.WINGPLANE): u along z, v from the car's left
AX = {'Ford': (1.565, -1.264), 'Holden': (1.6215, -1.3125)}
# body tail / nose z (from build_bodies.py's spec.s26.bounds), for registering top-down photos
BODY_Z = {'mustang_Ford': (-2.383, 2.528), 'camaro_Holden': (-2.3565, 2.587), 'supra_Holden': (-2.31, 2.664), 'supra_Ford': (-2.261, 2.607)}


def hexc(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)


def ss(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- logos
_cache = {}


def logo(name):
    """name: a 10-hex id from assets/img, or a file in tools/s26/logos (without .png)."""
    if name in _cache:
        return _cache[name]
    p = os.path.join(ROOT, 'assets/img', name + '.png')
    if not os.path.exists(p):
        p = os.path.join(HERE, 'logos', name + '.png')
    im = Image.open(p).convert('RGBA')
    im = im.crop(im.getbbox())
    _cache[name] = im
    return im


def recol(im, c):
    a = np.asarray(im).copy()
    a[..., :3] = hexc(c).astype(np.uint8)
    return Image.fromarray(a)


def unbox(im, thresh=60):
    """Drop a dark plate behind light lettering (keeps the lettering)."""
    a = np.asarray(im).astype(np.float32)
    l = a[..., :3] @ np.array([.3, .59, .11])
    a[..., 3] *= np.clip((l - thresh) / 40, 0, 1)
    return Image.fromarray(a.astype(np.uint8)).crop(Image.fromarray(a.astype(np.uint8)).getbbox())


def lighten(im, keep_hue=True):
    """Dark ink -> white (for dark paint), coloured parts kept."""
    a = np.asarray(im).astype(np.float32)
    l = a[..., :3] @ np.array([.3, .59, .11])
    sat = a[..., :3].max(2) - a[..., :3].min(2)
    dark = (l < 90) & (sat < 60)
    a[dark, :3] = 255
    return Image.fromarray(a.astype(np.uint8))


def crop(name, box, bg=None, tol=45, soft=25, keep=None, ink=None):
    """Cut a sponsor mark out of a reveal photo: box = (x0, y0, x1, y1) photo pixels; the backing colour
    (bg, or the median of the box border) is keyed out. keep = colours to keep (others keyed too)."""
    global LAST_BB
    im = np.asarray(Image.open(os.path.join(REFS, name + '.jpg')).convert('RGB'), np.float32)[box[1]:box[3], box[0]:box[2]]
    if ink is not None:      # dark lettering on a light panel: cut by brightness, filled solid in one colour
        from scipy import ndimage
        lum = im @ np.array([.3, .59, .11])
        ref = np.percentile(lum, 90)
        sat = im.max(-1) - im.min(-1)
        a = np.clip((ref - lum - 40) / 50, 0, 1) * np.clip((70 - sat) / 30, 0, 1)
        a = ndimage.binary_opening(a > .5, iterations=1).astype(np.float32) * a
        h, w = a.shape
        ab = np.asarray(Image.fromarray((ndimage.gaussian_filter(a, .7) * 255).astype(np.uint8)).resize((w * 4, h * 4), Image.BICUBIC)) > 110
        out = np.zeros(ab.shape + (4,), np.uint8)
        out[..., :3] = hexc(ink).astype(np.uint8)
        out[..., 3] = ab * 255
        img = Image.fromarray(out, 'RGBA')
        LAST_BB = img.getbbox() or (0, 0, 1, 1)
        return img.crop(LAST_BB)
    if bg is None:
        border = np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]])
        bgc = np.median(border, 0)
    else:
        bgc = hexc(bg)
    d = np.sqrt(((im - bgc) ** 2).sum(-1))
    a = np.clip((d - tol) / soft, 0, 1)
    if keep is not None:
        kc = np.array([hexc(c) for c in keep])
        dk = np.sqrt(((im[..., None, :] - kc) ** 2).sum(-1)).min(-1)
        a = np.minimum(a, np.clip((tol * 2 - dk) / soft, 0, 1))
        im = kc[np.sqrt(((im[..., None, :] - kc) ** 2).sum(-1)).argmin(-1)]
    # photo cut-outs are soft and noisy: blow them up, then cut hard edges and flat colours like a decal
    h, w = a.shape
    big = Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)).resize((w * 4, h * 4), Image.LANCZOS)
    ab = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((w * 4, h * 4), Image.LANCZOS)) > 127
    q = np.asarray(big.quantize(colors=4 if keep is None else max(2, len(keep)), method=Image.Quantize.MEDIANCUT).convert('RGB'))
    out = np.dstack([q, ab * 255]).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    LAST_BB = img.getbbox() or (0, 0, 1, 1)
    return img.crop(LAST_BB)


LAST_BB = (0, 0, 1, 1)


def vectorise(lab, n, eps):
    """Redraw every colour field as straight-edged polygons (like a vinyl wrap cut from a design file)."""
    import cv2
    out = np.zeros_like(lab)
    order = sorted(range(1, n), key=lambda k: -(lab == k).sum())
    for k in order:
        m = (lab == k).astype(np.uint8)
        if not m.any():
            continue
        cs, hi = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        fill = np.zeros_like(m)
        for i, c in enumerate(cs):
            a = cv2.approxPolyDP(c, eps, True)
            cv2.fillPoly(fill, [a], 0 if hi[0][i][3] >= 0 else 1)
        out[fill > 0] = k
    return out



# ---------------------------------------------------------------- the atlas
_SAFE = {}


def safe_mask(kind_key, margin=.018):
    """Atlas pixels (K-supersampled) where a logo can sit whole: covered by a painted body panel that faces
    straight out of its projection (the flat of the doors, bonnet, roof), never a window, vent, arch lip or
    crease. Built from the body's own mesh, so it matches what the game draws."""
    if kind_key in _SAFE:
        return _SAFE[kind_key]
    import base64, gzip, cv2
    d = json.loads(gzip.decompress(open(os.path.join(ROOT, 'assets/s26', kind_key.lower() + '.json.gz.bin'), 'rb').read()))
    W = ATLAS * K
    lab = np.zeros((W, W), np.uint8)          # 0 none, 1 flat panel, 2 curved/crease
    tris = []
    for r in d['levels'][0]:
        if r['role'] not in ('wing', 'hood') or not r.get('q'):
            continue
        p = np.frombuffer(base64.b64decode(r['p']), np.int16).reshape(-1, 3).astype(np.float64) / 10000
        f = np.frombuffer(base64.b64decode(r['i']), np.uint16 if r.get('i16') else np.uint32).reshape(-1, 3)
        tris.append(p[f])
    t = np.concatenate(tris)
    fn = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
    nx, ny, nz = fn[:, 0], fn[:, 1], fn[:, 2]
    view = np.where(nx < 0, 'right', 'left').astype(object)
    view[ny > .62] = 'top'
    view[(nz > .78) & (ny <= .62)] = 'front'
    view[(nz < -.78) & (ny <= .62)] = 'rear'
    if kind_key.split('_')[0] in ('camaro',):      # matches build_bodies.view_of(lip=True)
        view[(nz > .45) & (ny <= .62) & (np.abs(nx) < .35)] = 'front'
        view[(nz < -.45) & (ny <= .62) & (np.abs(nx) < .35)] = 'rear'
        c = t.mean(1)
        view[(c[:, 2] > 2.38) & (c[:, 1] < .3) & (np.abs(c[:, 0]) < .6) & (np.abs(nx) < .5) & ((nz > .3) | (ny > .5))] = 'lip'
    for name in REGION:
        sel = np.nonzero(view == name)[0]
        if not len(sel):
            continue
        v = t[sel]
        u0, v0 = REGION[name]
        if name in ('left', 'right'):
            u = u0 + ((ZF - v[..., 2]) if name == 'left' else (v[..., 2] - ZB)) * S
            w = v0 + (YT - v[..., 1]) * S
            ok = np.abs(nx[sel]) > .6
            depth = np.abs(v[..., 0]).mean(1)
        elif name == 'top':
            u, w = u0 + (v[..., 2] - ZB) * S, v0 + (XL - v[..., 0]) * S
            ok = ny[sel] > .85
            depth = v[..., 1].mean(1)
        elif name == 'lip':
            u, w = u0 + (v[..., 0] - LX0) * S3, v0 + (LY1 - (v[..., 1] * np.cos(LA) - (v[..., 2] - 2.5) * np.sin(LA))) * S3
            ok = np.ones(len(sel), bool)
            depth = v[..., 2].mean(1)
        else:
            u = u0 + ((v[..., 0] + XL) if name == 'front' else (XL - v[..., 0])) * S2
            w = v0 + (YT - v[..., 1]) * S2
            ok = np.abs(nz[sel]) > .85
            depth = np.abs(v[..., 2]).mean(1)
        q = np.round(np.stack([u, w], -1) * K * 16).astype(np.int32)
        for i in np.argsort(depth):            # painter's order: the outermost skin wins
            cv2.fillPoly(lab, [q[i]], 1 if ok[i] else 2, cv2.LINE_8, 4)
    safe = lab == 1
    # specks (door handles, fuel caps, a stray curved triangle) don't cut a logo: fill unsafe blobs under 5 cm
    nlab, cc, stats, _ = cv2.connectedComponentsWithStats((~safe).astype(np.uint8), connectivity=4)
    small = np.zeros(nlab, bool)
    small[1:] = stats[1:, cv2.CC_STAT_AREA] < (.05 * S * K) ** 2
    safe |= small[cc]
    # a hairline crease (the Supra's dashed side swage) bends a logo but doesn't cut it: open thin lines away
    o = int(.03 * S * K) | 1
    unsafe = cv2.morphologyEx((~safe).astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (o, o)))
    safe = unsafe == 0
    # close hairline gaps between triangles, then keep a margin off every edge
    k = np.ones((3, 3), np.uint8)
    safe = cv2.morphologyEx(safe.astype(np.uint8), cv2.MORPH_CLOSE, k)
    m = max(1, int(margin * S * K))
    safe = cv2.erode(safe, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * m + 1, 2 * m + 1)))
    _SAFE[kind_key] = safe > 0
    return _SAFE[kind_key]


class Atlas:
    def __init__(self, make):
        self.make = make
        self.f, self.r = AX[make]
        self.img = np.zeros((ATLAS * K, ATLAS * K, 3), np.float32)
        self.logos = []
        self.soft = False
        self.exact = False
        self.endplate = '#141416'     # rear wing endplates (one flat patch, see build_bodies.ENDPLATE_UV)
        self.wingcol = None           # rear wing blade colour; None = whatever the top view has there
        self.wlogos = []
        self.wrap = None              # (xmin, ymax, zmin, zmax): copy the finished flanks onto sky-facing shoulder texels
        self.post = []                # logos laid after the wrap (marks painted straight onto a sloping shoulder)

    def coords(self, view):
        u0, v0 = REGION[view]
        w, h = SIZE[view]
        uu, vv = np.meshgrid((np.arange(w * K) + .5) / K, (np.arange(h * K) + .5) / K)
        if view in ('left', 'right'):
            z = ZF - uu / S if view == 'left' else ZB + uu / S
            y = YT - vv / S
            x = np.full_like(z, 1.0 if view == 'left' else -1.0)
        elif view == 'top':
            z = ZB + uu / S
            x = XL - vv / S
            y = np.full_like(z, 1.3)
        elif view == 'lip':
            x = LX0 + uu / S3
            y = LY1 - vv / S3
            z = np.full_like(x, 2.55)
        else:
            x = uu / S2 - XL if view == 'front' else XL - uu / S2
            y = YT - vv / S2
            z = np.full_like(x, 2.6 if view == 'front' else -2.6)
        return x, y, z

    def paint(self, fn):
        """fn(x, y, z, view) -> (h, w, 3) RGB 0-255 for the base design."""
        self.img[:] = 0
        for view in REGION:
            x, y, z = self.coords(view)
            col = fn(x, y, z, 'front' if view == 'lip' else view)     # the lip carries the front design
            u0, v0 = REGION[view]
            h, w = x.shape
            self.img[v0 * K:v0 * K + h, u0 * K:u0 * K + w] = col

    # logo placement -------------------------------------------------------
    def over(self, fn, where, views=('left', 'right')):
        """Repaint part of the atlas: fn as for paint(), where(x, y, z, view) -> 0..1 coverage."""
        for view in views:
            x, y, z = self.coords(view)
            u0, v0 = REGION[view]
            h, w = x.shape
            a = np.clip(where(x, y, z, view), 0, 1).astype(np.float32)[..., None]
            cur = self.img[v0 * K:v0 * K + h, u0 * K:u0 * K + w]
            self.img[v0 * K:v0 * K + h, u0 * K:u0 * K + w] = cur * (1 - a) + fn(x, y, z, view) * a

    def put(self, view, im, a, b, h, maxw=None, rot=0):
        """Centre (a, b) in metres: side (z, y), top (z, x), front/rear (x, y). h = height in metres,
        maxw = max width in metres. rot: degrees CCW in the atlas."""
        if view == 'sides':
            self.put('left', im, a, b, h, maxw, rot)
            self.put('right', im, a, b, h, maxw, rot)
            return
        u0, v0 = REGION[view]
        if view in ('left', 'right'):
            s = S
            u = (ZF - a) * S if view == 'left' else (a - ZB) * S
            v = (YT - b) * S
        elif view == 'top':
            s = S
            u, v = (a - ZB) * S, (XL - b) * S
        elif view == 'lip':
            s = S3
            u, v = (a - LX0) * S3, (LY1 - b) * S3
        else:
            s = S2
            u = (a + XL) * S2 if view == 'front' else (XL - a) * S2
            v = (YT - b) * S2
        # size the logo upright (h = its height, maxw = its width), then turn it
        hh = h * s * K
        ww = im.width * hh / im.height
        if maxw and ww > maxw * s * K:
            ww = maxw * s * K
            hh = ww * im.height / im.width
        im = im.resize((max(1, int(round(ww))), max(1, int(round(hh)))), Image.LANCZOS)
        if rot:
            im = im.rotate(rot, expand=True, resample=Image.BICUBIC)
        cx, cy = (u0 + u) * K, (v0 + v) * K
        self.logos.append((im, int(round(cx - im.width / 2)), int(round(cy - im.height / 2)), view, self.soft))

    def fit(self, im, x, y, view, occ=None, soft=False):
        """Shrink, and nudge if needed, a logo until all of it sits on one flat painted panel (see safe_mask), so
        no logo is cut by a window, vent, arch or crease. Returns the (possibly resized) image and position."""
        safe = safe_mask(self.kind_key)
        if occ is not None:
            safe = safe & ~occ
        import cv2
        a = (np.asarray(im)[:, :, 3] > 60).astype(np.uint8)
        n0 = a.sum()
        if n0 == 0:
            return im, x, y
        cx, cy = x + im.width / 2, y + im.height / 2
        st = .05 * (S2 if view in ('front', 'rear') else S3 if view == 'lip' else S) * K
        if view == 'top':
            shifts = [(i * st, 0) for i in range(0, 15)] + [(-i * st, 0) for i in range(1, 15)]
        elif view in ('left', 'right'):
            shifts = [(i * st, j * st * .6) for i in range(-4, 5) for j in (0, -1, 1, -2)]
        else:
            shifts = [(0, j * st * .6) for j in (0, -1, 1)]
        shifts.sort(key=lambda d: abs(d[0]) + 1.5 * abs(d[1]))
        best = None
        for sc in ((1, .9, .8, .7, .6) if soft else (1, .94, .88, .82, .76, .7, .64, .58, .52, .46, .4)):
            w, h = max(1, int(im.width * sc)), max(1, int(im.height * sc))
            aa = cv2.resize(a, (w, h), interpolation=cv2.INTER_NEAREST)
            n = aa.sum()
            for dx, dy in shifts:
                x0, y0 = int(round(cx + dx - w / 2)), int(round(cy + dy - h / 2))
                if x0 < 0 or y0 < 0 or x0 + w > safe.shape[1] or y0 + h > safe.shape[0]:
                    continue
                bad = (aa > 0) & ~safe[y0:y0 + h, x0:x0 + w]
                fr = bad.sum() / n
                if sc >= .6 and (best is None or fr < best[3] - 1e-9):
                    best = (sc, x0, y0, fr)
                if fr <= .002:
                    if sc < 1 or dx or dy:
                        self.moved.append((view, round(sc, 2), round(dx / S / K, 2), round(dy / S / K, 2), im.width, im.height))
                    return (im if sc == 1 else im.resize((w, h), Image.LANCZOS)), x0, y0
        if soft:
            return None, x, y
        if best is not None and best[3] < .4:
            sc, x0, y0, fr = best
            self.moved.append((view, 'BEST', round(sc, 2), round(fr, 3), im.width, im.height))
            return (im if sc == 1 else im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.LANCZOS)), x0, y0
        self.moved.append((view, 'NO FIT', im.width, im.height))
        return im, x, y

    def after(self, view, im, a, b, h, maxw=None, rot=0):
        """put(), but laid on top of the finished atlas after the shoulder wrap."""
        self.put(view, im, a, b, h, maxw, rot)
        self.post.append(self.logos.pop())

    def bonnet(self, im, z, h, x=0.0, maxw=1.2):
        """Reads from in front of the car."""
        self.put('top', im, z, x, h, maxw, rot=90)

    def roof(self, im, z, h, x=0.0, maxw=1.0):
        self.put('top', im, z, x, h, maxw, rot=90)

    def wing(self, im, h, maxw=1.5):
        """A mark on the wing blade's own patch (WING), centred, reading from behind. h = height along the chord."""
        hh = h * S * K
        ww = im.width * hh / im.height
        if ww > maxw * S * K:
            ww = maxw * S * K
            hh = ww * im.height / im.width
        self.wlogos.append(im.resize((max(1, int(ww)), max(1, int(hh))), Image.LANCZOS).rotate(-90, expand=True, resample=Image.BICUBIC))

    def wingtop(self, im, z, h, maxw=1.5):
        """Rear wing / boot: reads from behind."""
        self.put('top', im, z, 0, h, maxw, rot=-90)

    # photo tracing ----------------------------------------------------------
    def photo(self, name, pts, wheel_y=.34, tyre=.34):
        """Register a reveal photo (refs/<team>/<nn>.jpg, outside the repo) of one side of the car.
        pts = photo pixels of [front wheel centre, rear wheel centre, front tyre top, rear tyre top].
        Builds a homography from the car's side plane (z, y) to the photo."""
        im = np.asarray(Image.open(os.path.join(REFS, name + '.jpg')).convert('RGB'), np.float32)
        src = [(self.f, wheel_y), (self.r, wheel_y), (self.f, wheel_y + tyre), (self.r, wheel_y + tyre)]
        A = []
        for (z, y), (u, v) in zip(src, pts):
            A.append([z, y, 1, 0, 0, 0, -u * z, -u * y, -u])
            A.append([0, 0, 0, z, y, 1, -v * z, -v * y, -v])
        H = np.linalg.svd(np.array(A))[2][-1].reshape(3, 3)
        self.ph = (im, H / H[2, 2])
        self.ph_name = name
        return self

    def photo_top(self, name, nose_u, tail_u, centre_v, half_px, nose_left=True, left_down=True):
        """Register a top-down reveal photo: the nose and tail of the body (photo x), its centre line and
        half width (photo y) give an axis-aligned map from (z, x) to the photo."""
        im = np.asarray(Image.open(os.path.join(REFS, name + '.jpg')).convert('RGB'), np.float32)
        zt, zn = BODY_Z[self.kind_key]
        self.pt = (im, (nose_u, tail_u, centre_v, half_px, zn, zt, left_down))
        return self

    def top_to_photo(self, z, x):
        im, (nu, tu, cv, hp, zn, zt, ld) = self.pt
        u = nu + (zn - z) / (zn - zt) * (tu - nu)
        v = cv + (x if ld else -x) * hp
        return u, v

    def to_photo(self, z, y):
        im, H = self.ph
        q = H @ np.stack([z, y, np.ones_like(z)])
        return q[0] / q[2], q[1] / q[2]

    def from_photo(self, u, v):
        im, H = self.ph
        q = np.linalg.inv(H) @ np.array([u, v, 1.0])
        return q[0] / q[2], q[1] / q[2]

    def px_per_m(self):
        (u0, v0), (u1, v1) = self.to_photo(np.array([self.f]), np.array([.34])), self.to_photo(np.array([self.r]), np.array([.34]))
        return float(np.hypot(u1 - u0, v1 - v0)[0]) / (self.f - self.r)

    def trace(self, palette, belt=.93, zmin=-9, zmax=9, min_area=.06, min_len=.6, weights=None, erase=(), arch=.5, view='sides', zone=None, void=(), outline=None, allow=None):
        """Colour the sides below the belt line from the registered photo: every pixel takes the nearest
        palette colour, then lettering and small marks are dissolved into the paint around them, so only
        the big colour fields of the real livery stay (logos are laid on afterwards as real files)."""
        im, H = self.ph if view != 'top' else self.pt
        npal = len(palette)
        pal = np.array([hexc(c) for c in list(palette) + list(void)], np.float32)
        from scipy import ndimage
        for view in (('left', 'right') if view == 'sides' else (view,)):
            x, y, z = self.coords(view)
            if view == 'top':
                u, v = self.top_to_photo(z.ravel(), x.ravel())
            else:
                u, v = self.to_photo(z.ravel(), y.ravel())
            ui = np.clip(u, 0, im.shape[1] - 1).astype(int)
            vi = np.clip(v, 0, im.shape[0] - 1).astype(int)
            col = im[vi, ui].reshape(z.shape + (3,))
            col = ndimage.uniform_filter(col, (3, 3, 1))
            d = ((col[..., None, :] - pal[None, None]) ** 2 * np.array([1.0, 1.2, .8])).sum(-1)
            if weights is not None:
                d = d * np.array(weights, np.float32)
            lab = d.argmin(-1)
            # dissolve small islands (letters, stripes of reflections) into their surroundings
            px_area = (1 / (S * K)) ** 2
            keep = np.zeros(lab.shape, bool)
            for k in range(npal):        # void colours (studio backdrop) never keep
                cc, n = ndimage.label(lab == k)
                if not n:
                    continue
                area = ndimage.sum(np.ones_like(cc), cc, index=np.arange(1, n + 1)) * px_area
                sl = ndimage.find_objects(cc)
                length = np.array([max(a.stop - a.start, b.stop - b.start) for a, b in sl]) / (S * K)
                big = np.zeros(n + 1, bool)
                big[1:] = (area >= min_area) | (length >= min_len)   # long pinstripes stay, lettering goes
                keep |= big[cc]
            # the photo's tyres, arch shadows and the floor are not paint: let the paint grow over them
            for li, (za, zb) in (allow or {}).items():   # a colour only exists over this stretch of the car
                keep &= ~((lab == li) & ((z < za) | (z > zb)))
            if outline is not None:          # the car's silhouette in the photo: outside it is backdrop
                from PIL import ImageDraw
                mk = Image.new('L', (im.shape[1], im.shape[0]), 0)
                ImageDraw.Draw(mk).polygon([(a / .9375, b / .9375) for a, b in outline], fill=255)
                inside = ndimage.binary_dilation(np.asarray(mk)[vi, ui].reshape(z.shape) > 127, iterations=6 * K)
                keep &= inside
            if view != 'top':
                for ax in (self.f, self.r):
                    keep &= ~(np.hypot(z - ax, (y - .34) * 1.1) < arch)
                keep &= ~(y < .1)
            boxes = []
            for e in erase:      # photo boxes behind big lettering: repainted in one colour (default the base)
                e0, e1, e2, e3 = e[:4]
                inb = (u.reshape(z.shape) > e0) & (u.reshape(z.shape) < e2) & (v.reshape(z.shape) > e1) & (v.reshape(z.shape) < e3)
                boxes.append((inb, e[4] if len(e) > 4 else 0))
            idx = ndimage.distance_transform_edt(~keep, return_distances=False, return_indices=True)
            lab = lab[idx[0], idx[1]]
            for inb, li in boxes:
                lab[inb] = li
            if outline is not None:          # beyond the real car's silhouette our body takes the base colour
                lab[~inside] = 0
            # clean vector-like shapes: each colour field is blurred (about 3 cm) and the strongest wins, so
            # edges come out as smooth curves instead of the photo's ragged pixel steps
            sig = .03 * S * K
            score = np.stack([ndimage.gaussian_filter((lab == k).astype(np.float32), sig) for k in range(len(pal))], -1)
            lab = score.argmax(-1)
            lab = vectorise(lab, len(pal), .012 * S * K)
            out = pal[lab]
            m = ((y < belt) & (z > zmin) & (z < zmax)) if view != 'top' else ((z > zmin) & (z < zmax))
            if zone is not None:
                m &= zone(x, y, z)
            m = m[..., None]
            u0, v0 = REGION[view]
            h, w = z.shape
            cur = self.img[v0 * K:v0 * K + h, u0 * K:u0 * K + w]
            self.img[v0 * K:v0 * K + h, u0 * K:u0 * K + w] = np.where(m, out, cur)

    def project(self, outline, side, glass=(), belt=1.4, decals=(), arch=.37, blur=1, glass_fill=None, glass_pad=6, above=None):
        """Map the registered side photo straight onto both flanks (photo-exact colours and graphics).
        side = the flank the photo shows ('left' or 'right'); the other flank gets the same design mirrored,
        like the real cars, but with every piece of lettering in `decals` turned back the right way round:
        in each box the lettering (pixels away from the backing colours) is lifted off, the paint under it filled in,
        and the lettering laid back flipped, so it reads correctly once mirrored onto the far flank.
        outline / glass = photo polygons of the body and its windows (glass is filled from the paint around
        it, so pillars keep their colour). decals = [(box, backing colours, tol)]."""
        import cv2
        from PIL import ImageDraw
        from scipy import ndimage
        im, H = self.ph
        src = cv2.bilateralFilter(im.astype(np.uint8), 5, 18, 3) if blur else im.astype(np.uint8)
        far = src.copy()
        for dec in decals:
            box, keep, tol = dec[:3]
            mode = dec[3] if len(dec) > 3 else 'flip'
            x0, y0, x1, y1 = box
            R = src[y0:y1, x0:x1]
            kc = np.array([hexc(c) for c in keep], np.float32)      # the backing colours: anything else is lettering
            M = (np.sqrt(((R[..., None, :].astype(np.float32) - kc) ** 2).sum(-1)).min(-1) > tol).astype(np.uint8)
            M = cv2.dilate(M, np.ones((3, 3), np.uint8))
            bgR = cv2.inpaint(R, M, 4, cv2.INPAINT_TELEA)
            if mode == 'erase':             # wiped on both flanks: a clean vector mark goes on instead
                M = cv2.dilate(M, np.ones((3, 3), np.uint8))
                bgR = cv2.inpaint(R, M, 4, cv2.INPAINT_TELEA)
                if len(dec) > 4:            # lettering lifted off the photo's own panel: only the letter pixels go,
                    # found as grey strokes darker than the paint around them, and refilled by a smooth (Laplace)
                    # fill from their edges, so the panel's shading carries straight through with no box or patch
                    Rf = R.astype(np.float32)
                    lum = Rf.mean(-1)
                    sat = Rf.max(-1) - Rf.min(-1)
                    bgl = cv2.morphologyEx(lum, cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8))
                    L = ((bgl - lum > 45) & (sat < 40)).astype(np.uint8)
                    n_, lab, st, _ = cv2.connectedComponentsWithStats(L, 8)
                    L = np.isin(lab, [i for i in range(1, n_) if st[i, 4] > 60]).astype(np.uint8)
                    L = cv2.dilate(L, np.ones((5, 5), np.uint8))
                    bgR = laplace_fill(Rf, L > 0).astype(np.uint8)
                    self.letters = (x0, y0, L)
                src[y0:y1, x0:x1] = bgR
                far[y0:y1, x0:x1] = bgR
                continue
            cols = np.nonzero(M.any(0))[0]
            if not len(cols):
                continue
            a0, a1 = cols[0], cols[-1] + 1           # flip about the lettering's own centre, not the box's
            out = bgR.copy()
            fl = M[:, a0:a1][:, ::-1] > 0
            fR = R[:, a0:a1][:, ::-1]
            if len(dec) > 4 and dec[4]:     # a sloped mark keeps its own slope (dy/dx in photo px) once flipped
                sl = 2 * dec[4]
                cx = (a1 - a0) / 2
                Mw = np.float32([[1, 0, 0], [sl, 1, -sl * cx]])
                fR = cv2.warpAffine(np.ascontiguousarray(fR), Mw, (a1 - a0, R.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
                fl = cv2.warpAffine(fl.astype(np.uint8) * 255, Mw, (a1 - a0, R.shape[0]), flags=cv2.INTER_LINEAR) > 127
            out[:, a0:a1] = np.where(fl[..., None], fR, bgR[:, a0:a1])
            far[y0:y1, x0:x1] = out
        if glass_fill is not None:     # the photo's windows and their black surround become plain paint
            gm_ = Image.new('L', (im.shape[1], im.shape[0]), 0)
            for g in glass:
                ImageDraw.Draw(gm_).polygon([tuple(p) for p in g], fill=255)
            gm_ = cv2.dilate(np.asarray(gm_), np.ones((2 * glass_pad + 1, 2 * glass_pad + 1), np.uint8)) > 127
            src[gm_] = hexc(glass_fill).astype(np.uint8)
            far[gm_] = hexc(glass_fill).astype(np.uint8)
            glass = ()
        mk = Image.new('L', (im.shape[1], im.shape[0]), 0)
        dr = ImageDraw.Draw(mk)
        dr.polygon([tuple(p) for p in outline], fill=255)
        for g in glass:
            dr.polygon([tuple(p) for p in g], fill=0)
        mk = np.asarray(mk) > 127
        for view in ('left', 'right'):
            pic = (src if view == side else far).astype(np.float32)
            x, y, z = self.coords(view)
            u, v = self.to_photo(z.ravel(), y.ravel())
            col = np.stack([ndimage.map_coordinates(pic[..., c], [v, u], order=1, mode='nearest') for c in range(3)], -1).reshape(z.shape + (3,))
            ok = ndimage.map_coordinates(mk.astype(np.float32), [v, u], order=0, mode='constant').reshape(z.shape) > .5
            for ax in (self.f, self.r):
                ok &= ~(np.hypot(z - ax, (y - .34) * 1.1) < arch)
            ok &= y > .06
            idx = ndimage.distance_transform_edt(~ok, return_distances=False, return_indices=True)
            col = col[idx[0], idx[1]]
            if above is not None:      # off the photo's body (above its roofline): plain paint, not smeared edge pixels
                col = np.where((~ok & (y > above[0]))[..., None], hexc(above[1]).astype(np.float32), col)
            m = (y < belt)[..., None]
            u0, v0 = REGION[view]
            h, w = z.shape
            cur = self.img[v0 * K:v0 * K + h, u0 * K:u0 * K + w]
            self.img[v0 * K:v0 * K + h, u0 * K:u0 * K + w] = np.where(m, col, cur)
        self.exact = True

    def plogo(self, im, u, v, hpx=None, view='sides', maxw_px=None, rot=0, hm=None, wm=None):
        """A logo placed where it sits in the registered photo: centre (u, v) and height in photo pixels
        (or hm / wm metres on a three-quarter photo, where pixels are foreshortened)."""
        z, y = self.from_photo(u, v)
        k = self.px_per_m()
        self.put(view, im, z, y, hm or hpx / k, wm or (maxw_px / k if maxw_px else None), rot)

    def poly(self, view, pts, c, photo=False):
        """Fill a polygon: side views take (z, y) metres (or photo pixels with photo=True, both sides),
        top (z, x), front/rear (x, y)."""
        from PIL import ImageDraw
        if photo:
            pts = [self.from_photo(u, v) for u, v in pts]
        views = ('left', 'right') if view == 'sides' else (view,)
        for vw in views:
            u0, v0 = REGION[vw]
            w, h = SIZE[vw]
            q = []
            for a, b in pts:
                if vw == 'left':
                    q.append(((ZF - a) * S, (YT - b) * S))
                elif vw == 'right':
                    q.append(((a - ZB) * S, (YT - b) * S))
                elif vw == 'top':
                    q.append(((a - ZB) * S, (XL - b) * S))
                elif vw == 'front':
                    q.append(((a + XL) * S2, (YT - b) * S2))
                else:
                    q.append(((XL - a) * S2, (YT - b) * S2))
            mk = Image.new('L', (w * K, h * K), 0)
            ImageDraw.Draw(mk).polygon([(x * K, y * K) for x, y in q], fill=255)
            m = np.asarray(mk) > 127
            reg = self.img[v0 * K:v0 * K + h * K, u0 * K:u0 * K + w * K]
            reg[m[:reg.shape[0], :reg.shape[1]]] = hexc(c)

    def finish(self):
        # pad the gaps between regions with the nearest painted colour (mip bleed)
        filled = np.zeros(self.img.shape[:2], bool)
        for view in REGION:
            u0, v0 = REGION[view]
            w, h = SIZE[view]
            filled[v0 * K:(v0 + h) * K, u0 * K:(u0 + w) * K] = True
        from scipy import ndimage
        idx = ndimage.distance_transform_edt(~filled, return_distances=False, return_indices=True)
        self.img = self.img[idx[0], idx[1]]
        eu, ev = ENDPLATE
        self.img[(ev - 40) * K:(ev + 40) * K, (eu - 35) * K:(eu + 35) * K] = hexc(self.endplate)

        out = Image.fromarray(np.clip(self.img, 0, 255).astype(np.uint8)).convert('RGBA')
        self.moved = []
        import cv2
        occ = np.zeros((ATLAS * K, ATLAS * K), bool)
        pad = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(.05 * S * K) | 1,) * 2)
        for im, x, y, view, soft in self.logos:
            if FIT and soft is not None:
                im, x, y = self.fit(im, x, y, view, occ if soft else None, soft)
                if im is None:
                    continue
            al = (np.asarray(im)[:, :, 3] > 40).astype(np.uint8)
            x0, y0 = max(0, x), max(0, y)
            sub = cv2.dilate(al, pad)[y0 - y:, x0 - x:]
            h, w = min(sub.shape[0], occ.shape[0] - y0), min(sub.shape[1], occ.shape[1] - x0)
            occ[y0:y0 + h, x0:x0 + w] |= sub[:h, :w] > 0
            out.alpha_composite(im, (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
        if self.wrap:      # haunches/shoulders that face up are drawn from the top view: give them the flank design
            arr = np.asarray(out).copy()
            x, y, z = self.coords('top')
            ym = top_ymap(self.kind_key)[:x.shape[0], :x.shape[1]]
            sel = np.zeros(x.shape, bool)
            for xmin, ymax, zmin, zmax in (self.wrap if isinstance(self.wrap, list) else [self.wrap]):
                sel |= np.isfinite(ym) & (np.abs(x) > xmin) & (ym < ymax) & (z > zmin) & (z < zmax)
            tu0, tv0 = REGION['top']
            for vw, side in (('left', x > 0), ('right', x < 0)):
                m = sel & side
                u0, v0 = REGION[vw]
                zz, yy = z[m], ym[m]
                su = ((u0 + ((ZF - zz) if vw == 'left' else (zz - ZB)) * S) * K).astype(int)
                sv = ((v0 + (YT - yy) * S) * K).astype(int)
                rr, cc = np.nonzero(m)
                arr[tv0 * K + rr, tu0 * K + cc] = arr[np.clip(sv, 0, arr.shape[0] - 1), np.clip(su, 0, arr.shape[1] - 1)]
            out = Image.fromarray(arr)
        for im, x, y, view, soft in self.post:
            out.alpha_composite(im, (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
        # the wing blade's own patch: by default a copy of the top view under it (so every livery looks as before)
        u0, v0, w, h = WING
        uu, vv = np.meshgrid((np.arange(w * K) + .5) / K, (np.arange(h * K) + .5) / K)
        zl = BODY_Z.get(self.kind_key, (-2.36, 0))[0] + .40
        z, x = zl - .3 + uu / w * .3, .86 - vv / h * 1.72
        tu0, tv0 = REGION['top']
        tu = np.clip(((tu0 + (z - ZB) * S) * K).astype(int), 0, ATLAS * K - 1)
        tv = np.clip(((tv0 + (XL - x) * S) * K).astype(int), 0, ATLAS * K - 1)
        arr = np.asarray(out).copy()
        patch = arr[tv, tu]
        if self.wingcol:
            patch[..., :3] = hexc(self.wingcol).astype(np.uint8)
        arr[v0 * K:(v0 + h) * K, u0 * K:(u0 + w) * K] = patch
        out = Image.fromarray(arr)
        for im in self.wlogos:
            out.alpha_composite(im, (int((u0 + w / 2) * K - im.width / 2), int((v0 + h / 2) * K - im.height / 2)))
        return out.convert('RGB').resize((ATLAS, ATLAS), Image.LANCZOS)


# ---------------------------------------------------------------- design helpers
def C(h):
    return hexc(h)


def fill(shape, c):
    return np.broadcast_to(C(c) if isinstance(c, str) else c, shape + (3,)).astype(np.float32).copy()


def lay(base, mask, c):
    m = np.clip(mask, 0, 1)[..., None]
    col = C(c) if isinstance(c, str) else c
    return base * (1 - m) + col * m


def band(v, a, b, soft=.004):
    return ss(a - soft, a + soft, v) * (1 - ss(b - soft, b + soft, v))


def sweep(z, y, z0, y0, z1, y1, w):
    """Mask of a straight band from (z0,y0) to (z1,y1), w metres thick (perpendicular)."""
    dz, dy = z1 - z0, y1 - y0
    L = np.hypot(dz, dy)
    t = ((z - z0) * dz + (y - y0) * dy) / L
    d = ((z - z0) * dy - (y - y0) * dz) / L
    return band(d, -w / 2, w / 2) * band(t, -9, L)


def stripes(x, y, z, view, w=.16, gap=.06, lo=-9, hi=9):
    """Twin racing stripes over the nose, bonnet, roof, boot and tail."""
    m = band(np.abs(x), gap / 2, gap / 2 + w)
    if view in ('left', 'right'):
        return np.zeros_like(x)
    return m * band(z, lo, hi)


# ---------------------------------------------------------------- the liveries
def side_layout(A):
    f, r = A.f, A.r
    return dict(door=((f + r) / 2 + .32, .60), quarter=(r + .58, .62), guard=(f - .5, .80), sill=((f + r) / 2 + .1, .22),
                rq_top=(r - .05, .86), fq_top=(f + .1, .84))


def partners_row(A, names, recolor=None, y=.22, h=.07, z0=None, z1=None, view='sides'):
    """A row of small partner logos along the sill between the wheels."""
    f, r = A.f, A.r
    z0 = f - .55 if z0 is None else z0
    z1 = r + .55 if z1 is None else z1
    n = len(names)
    for i, nm in enumerate(names):
        z = z0 + (z1 - z0) * (i + .5) / n
        im = logo(nm)
        if recolor:
            im = recol(im, recolor)
        A.put(view, im, z, y, h, maxw=abs(z1 - z0) / n * .82)


def maker(A, kind, dark):
    """Manufacturer marks: front bumper, rear quarter."""
    L = side_layout(A)
    if kind == 'mustang':
        fr = logo('fordracing')
        A.put('sides', fr, A.r - .02, .85, .09, maxw=.3)
        A.put('front', logo('3952a5b529'), 0, .38, .09)
    elif kind == 'camaro':
        bt = logo('bowtie')
        A.put('sides', recol(bt, '#ffffff') if dark else bt, A.f + .05, .86, .06, maxw=.2)
        A.put('front', logo('224c9729d8').crop((0, 0, 181, 50)), 0, .36, .07)
    else:
        tgr = logo('tgr')
        A.put('sides', recol(tgr, '#ffffff') if dark else tgr, A.r - .02, .86, .07, maxw=.32)
        A.put('front', recol(tgr, '#ffffff') if dark else tgr, 0, .30, .07, maxw=.4)


def common(A, kind, dark):
    maker(A, kind, dark)
    dun = logo('4e18d3dc8c')
    A.put('sides', dun, A.f - .05, .13, .07)       # Dunlop control tyre patch on the front skirt
    A.put('sides', dun, A.r + .05, .13, .07)


def camaro_word(fill='#4a4a50'):
    """The Camaro wordmark: wide, squared block letters (drawn, so both flanks read clean and straight)."""
    from PIL import ImageDraw
    Hh, Wl, t, g = 120, 250, 36, 46
    out = Image.new('RGBA', (6 * Wl + 5 * g, Hh), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    def r(x0, y0, x1, y1):
        d.rectangle((x0, y0, x1 - 1, y1 - 1), fill=fill)
    for i, ch in enumerate('CAMARO'):
        x = i * (Wl + g)
        r(x, 0, x + Wl, t)                                   # top bar on every letter
        r(x, 0, x + t, Hh)                                   # left stem
        if ch == 'C':
            r(x, Hh - t, x + Wl, Hh)
        elif ch == 'A':
            r(x + Wl - t, 0, x + Wl, Hh); r(x, Hh // 2 - t // 2 + 6, x + Wl, Hh // 2 + t // 2 + 6)
        elif ch == 'M':
            r(x + Wl - t, 0, x + Wl, Hh); r(x + Wl // 2 - t // 2, 0, x + Wl // 2 + t // 2, Hh)
        elif ch == 'R':
            r(x + Wl - t, 0, x + Wl, Hh // 2 + 6); r(x, Hh // 2 - t // 2 + 6, x + Wl - t, Hh // 2 + t // 2 + 6)
            d.polygon([(x + Wl - t - 30, Hh // 2 + t // 2 + 6), (x + Wl - 30 + 6, Hh // 2 + t // 2 + 6),
                       (x + Wl, Hh), (x + Wl - t - 6, Hh)], fill=fill)
        elif ch == 'O':
            r(x + Wl - t, 0, x + Wl, Hh); r(x, Hh - t, x + Wl, Hh)
    # notch the top-left corner of each letter like the badge
    for i in range(6):
        x = i * (Wl + g)
        d.polygon([(x, 0), (x + 16, 0), (x, 16)], fill=(0, 0, 0, 0))
    return out


def laplace_fill(img, hole, iters=1500):
    """Fill the hole pixels of img with the harmonic interpolation of the pixels around them."""
    import cv2
    out = img.astype(np.float32).copy()
    # start from a coarse guess (mean of nearby known pixels), then relax
    known = (~hole).astype(np.float32)
    num = cv2.GaussianBlur(out * known[..., None], (0, 0), 6)
    den = cv2.GaussianBlur(known, (0, 0), 6)[..., None]
    out[hole] = (num / np.maximum(den, 1e-4))[hole]
    k = np.array([[0, .25, 0], [.25, 0, .25], [0, .25, 0]], np.float32)
    for _ in range(iters):
        sm = cv2.filter2D(out, -1, k, borderType=cv2.BORDER_REPLICATE)
        out[hole] = sm[hole]
    return np.clip(out, 0, 255)


def L_redbull(A, kind):
    """Triple Eight #88/#888 Red Bull Ampol Camaros, from Riley's renders (riley/1_t8_side, 2_t8_front):
    white car, navy and blue mountain shards from the front wheel back to the rear door, the Red Bull sun and
    charging bull on the door, Red Bull across the sill, CAMARO along the rear quarter, AMPOL AMPLIFY on both
    bumpers, navy bonnet with the sun, two bulls and Red Bull."""
    wht, navy, blue, sun, red = '#f1f1f3', '#26246a', '#2f8ad8', '#f3c51b', '#d42049'

    def base(x, y, z, view):
        c = fill(x.shape, wht)
        if view == 'top':
            bon = band(z, A.f - .62, 9) * band(np.abs(x), -1, .8)
            c = lay(c, bon, navy)
            c = lay(c, band(z, A.f - .62, 9) * band(np.abs(x), .62, .8), blue)
            c = lay(c, band(z, A.f - .82, A.f - .62) * band(np.abs(x), -1, .8), '#17172c')   # cowl: dark, meets the black trim
            c = lay(c, np.clip((z - 1.98) / .08, 0, 1), navy)                   # fender tops round the headlights: navy like the nose
        if view == 'front':
            c = lay(c, band(y, -1, .24), navy)                                  # lower bumper and splitter
            c = lay(c, band(np.abs(x), -1, .6) * band(y, -1, .66), navy)          # grille surround and nose
            c = lay(c, band(y, .24, 9), navy)                                    # whole nose navy: no white corners under the headlights
        if view == 'rear':
            c = lay(c, band(y, -1, .22), navy)
        return c
    A.paint(base)
    A.photo('riley/1_t8_side', [(930, 453), (290, 450), (930, 383), (290, 385)], tyre=.33)
    outline = [(85, 330), (110, 315), (160, 280), (250, 262), (330, 252), (420, 248), (520, 248), (600, 252), (650, 262),
               (700, 290), (760, 322), (840, 330), (960, 345), (1040, 360), (1080, 372), (1095, 385), (1100, 440), (1098, 500),
               (1060, 512), (1000, 507), (860, 507), (600, 507), (330, 507), (200, 502), (90, 492), (80, 440)]
    glass = [[(366, 320), (368, 300), (392, 270), (470, 262), (560, 262), (640, 272), (682, 296), (708, 320)]]
    T, N, B = '#141416', '#26246a', '#2f8ad8'          # tyre, navy, blue: never lettering
    decals = [((150, 324, 522, 380), ['#e6e6e8', N, B, T], 75, 'erase', '#ececef'),   # CAMARO: redrawn; panel wiped clean under it
              ((356, 406, 598, 478), [N, '#3a3f8a', T], 85, 'erase'),       # Red Bull: replaced by the flat wordmark
              ((1024, 412, 1094, 480), ['#eeeef0', T, B], 70, 'erase'),      # AMPOL AMPLIFY Premium Fuels (front)
              ((104, 402, 206, 464), ['#eeeef0', T, B], 70, 'erase'),       # (rear)
              ((384, 476, 582, 504), [N, '#3a3f8a', T], 75),                # Avery Dennison, mtaa super
              ((296, 275, 341, 316), ['#eeeef0'], 70, 'erase'),             # hp: re-laid a little lower
              ((893, 350, 1016, 388), ['#eeeef0', B, N, '#f3c51b'], 70, 'erase')]   # GM, SV: redrawn as badges
    hp = crop('riley/1_t8_side', (296, 275, 341, 316), bg='#eeeef0', tol=60)
    from scipy import ndimage as _ndi      # keep only the HP disc: the photo crop also catches a blue fleck of the pillar
    _a = np.asarray(hp)[..., 3] > 60
    _lab, _n = _ndi.label(_a)
    if _n > 1:
        _keep = _ndi.binary_fill_holes(_lab == (np.argmax(np.bincount(_lab.ravel())[1:]) + 1))
        _arr = np.asarray(hp).copy(); _arr[..., 3] = np.where(_keep, _arr[..., 3], 0); hp = Image.fromarray(_arr)
        hp = hp.crop(hp.getbbox())
    glass = glass + [[(652, 296), (700, 292), (712, 322), (690, 336), (655, 330)]]     # the ACDelco mirror
    A.project(outline, 'right', glass=glass, decals=decals, glass_fill='#eeeef0', glass_pad=7, above=(.95, '#eeeef0'))
    # the quarter window's sill (top-view texels just outside the glass) is the black window surround, not a white streak
    A.over(lambda x, y, z, view: fill(x.shape, '#141416'),
           lambda x, y, z, view: band(np.abs(x), .665, .745) * band(z, -1.0, -.62), views=('top',))
    _soft, A.soft = A.soft, None
    A.plogo(hp, 318, 309, 34)      # the photo's spot, a touch lower so its top doesn't wrap onto the C-pillar edge
    A.soft = _soft
    from PIL import ImageDraw
    # front and rear corners, ahead of / behind the wheel arches: repainted flat (the photo is patchy there)
    def ends(x, y, z, view):
        c = fill(x.shape, wht)
        c = lay(c, band(y, -1, .26), navy)
        c = lay(c, band(y, .26, .29), blue)
        c = lay(c, np.clip((z - 1.98) / .12, 0, 1) * band(y, .62, 9), navy)   # navy into the headlight, as on the nose
        return c
    A.over(ends, lambda x, y, z, view: np.clip((z - 1.98) / .06, 0, 1) + np.clip((-1.74 - z) / .06, 0, 1))
    # GM | SV badge (Riley's artwork) over the front wheel arch, on the flat of the fender below the crown
    gmsv = logo('gmsv')
    _soft, A.soft = A.soft, None
    A.put('sides', gmsv, 1.6, .70, .05, maxw=.32)
    A.put('lip', gmsv, 0, .152, .055, maxw=.34)      # centred on the navy splitter under the grille (w = .152: its shelf)
    A.soft = _soft
    A.plogo(camaro_word(), 336, 352, 38, maxw_px=362)     # same spot and size as before, on the untouched panel
    # Red Bull across the doors, flat and straight
    A.plogo(logo('74cca6ffe5'), 477, 441, 50, maxw_px=232)
    ampw = recol(logo('ampol_word'), '#e01b24')
    amply = text('AMPLIFY', 'ArchivoBlack-Regular', 200, '#e01b24', slant=.12)
    bar = Image.new('RGBA', (int(amply.height * 1.0), amply.height), (0, 0, 0, 0))
    ImageDraw.Draw(bar).polygon([(bar.width * .45, 0), (bar.width, 0), (bar.width * .55, bar.height), (0, bar.height)], fill='#e01b24')
    top = row(Image.new('RGBA', (bar.width, 2)), ampw.resize((int(ampw.width * amply.height / ampw.height), amply.height)), gap=.05)
    bot = row(bar, amply, gap=.05)
    prem = text('Premium Fuels', 'Montserrat', 130, '#303034', weight=600)
    W = max(top.width, bot.width)
    amp_block = Image.new('RGBA', (W, top.height + bot.height + prem.height + 60), (0, 0, 0, 0))
    amp_block.alpha_composite(top, (0, 0))
    amp_block.alpha_composite(bot, (0, top.height + 25))
    amp_block.alpha_composite(prem, (W - prem.width, top.height + bot.height + 55))
    amp_small = Image.new('RGBA', (W, top.height + bot.height + 25), (0, 0, 0, 0))   # front bumper side is narrow
    amp_small.alpha_composite(top, (0, 0)); amp_small.alpha_composite(bot, (0, top.height + 25))
    # AMPOL AMPLIFY on the clean front and rear corners, where the panel is flat enough to hold them whole
    A.put('sides', amp_small, 2.05, .57, .1, maxw=.21)
    A.put('sides', amp_block, -1.93, .52, .17, maxw=.3)
    # bonnet: big bulls and sun further up towards the screen, Red Bull ahead of them
    A.bonnet(logo('ed202fc404'), A.f - .05, .55, maxw=1.45)
    A.bonnet(logo('74cca6ffe5'), A.f + .4, .25, maxw=1.3)
    A.roof(logo('ampol_a'), -.35, .62, maxw=.9)    # middle of the roof (roof panel runs z -1.15..0.45)
    A.put('rear', logo('5630d1cdfa'), 0, .53, .25, maxw=.7)
    A.wingtop(recol(logo('5a20684e34'), '#ffffff'), -2.2, .1, maxw=1.0)


def grove_word(c='#ffffff'):
    """GROVE as on the team's wall: a bold serif with a red O."""
    p = lambda t, col: text(t, 'LibreBaskerville', 200, col, weight=700)
    return row(p('GR', c), p('O', '#d71e28'), p('VE', c), gap=.02)


def hundred(c, px=300, w=500):
    return text('100', 'Montserrat', px, c, weight=w, track=-.06)


def celebrating(gold, ink):
    """100 | Celebrating / YEARS block from the rear quarters."""
    h = hundred(gold)
    cel = text('Celebrating', 'KaushanScript-Regular', 120, gold)
    yrs = plate(text('YEARS', 'ArchivoBlack-Regular', 110, ink, track=.08), gold, pad=.16, radius=.05)
    right = stack(cel, yrs, gap=.1)
    right = right.resize((int(right.width * h.height * .95 / right.height), int(h.height * .95)), Image.LANCZOS)
    return row(h, right, gap=.05)


def wreath(gold, px=600, disc=.355 / .98):
    """Penrite's laurel as raced (penrite/06, grove/both close-ups): on each side of the door disc, stacked
    chevrons of two broad almond leaves hugging the rim. A branch grows up each side, so every chevron points up
    the arc: two at the base below the lettering, two at the tips beside the top of the disc, none in the
    black PENRITE band. Drawn 4x and scaled down so the edges are clean. disc = disc radius / image height."""
    from PIL import ImageDraw
    import math
    k = 4
    n = px * k
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = cy = n / 2
    r = disc * n
    R, L, W = 1.2 * r, .42 * r, .2 * r

    def leaf(x, y, ux, uy):
        """Almond leaf from (x, y) along unit (ux, uy) in image coordinates."""
        nx, ny = -uy, ux
        pts = []
        for t in range(0, 33):
            f = t / 32
            w = W / 2 * math.sin(math.pi * f) ** .8
            pts.append((x + ux * L * f + nx * w, y + uy * L * f + ny * w))
        for t in range(32, -1, -1):
            f = t / 32
            w = W / 2 * math.sin(math.pi * f) ** .8
            pts.append((x + ux * L * f - nx * w, y + uy * L * f - ny * w))
        d.polygon(pts, fill=gold)

    for sg in (-1, 1):
        for deg in (-58, -38, 38, 58):                      # two chevrons per corner, as raced
            a = math.radians(deg)
            x, y = cx + sg * R * math.cos(a), cy - R * math.sin(a)
            tx, ty = -sg * math.sin(a), -math.cos(a)            # image-space tangent, going up the branch
            for spread in (34, -34):
                c, s_ = math.cos(math.radians(spread)), math.sin(math.radians(spread))
                ux, uy = tx * c - ty * s_, tx * s_ + ty * c
                leaf(x, y, ux, uy)
    a = np.asarray(im).copy()                                  # a clean black gap round the disc, as raced
    yy, xx = np.mgrid[:n, :n]
    a[..., 3][np.hypot(xx - cx, yy - cy) < 1.07 * r] = 0
    return Image.fromarray(a).resize((px, px), Image.LANCZOS)


def apex_steel(c='#ffffff'):
    a = text('APE', 'ArchivoBlack-Regular', 200, c)
    x = text('X', 'ArchivoBlack-Regular', 200, '#f26b21', slant=.15)
    st = text('STEEL', 'Montserrat', 130, c, weight=600, track=.35)
    return row(row(a, x, gap=.0), st, gap=.25)


def airtouch(c='#ffffff'):
    from PIL import ImageDraw
    ring = Image.new('RGBA', (220, 220), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((6, 6, 213, 213), outline='#f26b21', width=18)
    t = text('airtouch', 'Montserrat', 200, c, weight=500)
    out = Image.new('RGBA', (int(t.width + 140), max(t.height, 260)), (0, 0, 0, 0))
    out.alpha_composite(ring.resize((260, 260)), (0, (out.height - 260) // 2))
    out.alpha_composite(t, (110, (out.height - t.height) // 2))
    return out


def groblox(c='#ffffff'):
    from PIL import ImageDraw
    g = text('GROBL', 'Montserrat', 200, c, weight=900)
    cube = Image.new('RGBA', (150, 150), (0, 0, 0, 0))
    ImageDraw.Draw(cube).polygon([(75, 0), (150, 75), (75, 150), (0, 75)], fill='#e3262a')
    x = text('X', 'Montserrat', 200, c, weight=900)
    top = row(g, cube.resize((g.height, g.height)), x, gap=.02)
    sub = text('POWERED BY GROVE', 'Montserrat', 60, c, weight=700)
    return stack(top, sub, gap=.05, align='c')


def L_penrite(A, kind):
    """Grove #19/#26 Penrite Mustangs, 100 years, from Riley's launch photo (grove/both) and the reveal set
    (penrite/01-07): satin black; a huge gold PENRITE across a gold disc (split by a black band behind the
    letters) inside a laurel wreath on the doors; 100 Celebrating YEARS on the rear quarters; gold beltline
    and sill pinstripes; PENRITE over a gold 100 on the bonnet; GROVE on the wing. Side placements converted
    from the photo with the wheel centres (z = 1.565 - (u - 277.5) / 181, y = .34 + (817 - v) / 181)."""
    blk, gold = '#121214', '#c49a52'
    zc, yc, rd = -.08, .59, .32               # door disc, centred on the lettering band (penrite/06 close-up)
    A.soft = None

    def belt(z):
        return np.interp(z, [-2.5, -1.85, -.6, .58, 2.08, 2.6], [1.0, .97, .9, .865, .69, .6])

    def base(x, y, z, view):
        c = fill(x.shape, blk)
        if view in ('left', 'right'):
            r = np.hypot(z - zc, y - yc)
            disc = (r < rd) & ~(np.abs(y - yc) < .17)
            c = lay(c, disc.astype(np.float32), gold)
            c = lay(c, (np.abs(y - belt(z)) < .007).astype(np.float32), gold)
            c = lay(c, band(y, .19, .205) * band(z, -.88, 1.2), gold)
        if view == 'top':
            c = lay(c, (np.abs(np.abs(x) - .62) < .007) * band(z, .75, 2.2), gold)     # shoulder lines on to the bonnet
        if view == 'front':
            c = lay(c, band(y, .15, .2), gold)                                         # lip bar and corner edges
        return c
    A.paint(base)
    pen = logo('ef64ee4a7a')
    word = pen.crop((int(pen.width * .25), 0, pen.width, pen.height))
    word = recol(word.crop(word.getbbox()), gold)
    A.put('sides', wreath(gold, disc=rd / .98), zc, yc, .98, maxw=.98)
    A.put('sides', word, -.075, .59, .30, maxw=1.57)
    A.put('sides', celebrating(gold, blk), -1.33, .80, .2, maxw=.86)
    A.put('sides', groblox(), 1.45, .715, .08, maxw=.55)
    A.put('sides', recol(logo('gates'), '#ffffff'), .95, .62, .2, maxw=.38)
    from PIL import ImageDraw
    acl = Image.new('RGBA', (300, 300), (0, 0, 0, 0))
    ImageDraw.Draw(acl).ellipse((8, 8, 291, 291), outline='#ffffff', width=16)
    t = text('ACL', 'ArchivoBlack-Regular', 110, '#ffffff')
    acl.alpha_composite(t, ((300 - t.width) // 2, (300 - t.height) // 2))
    A.put('sides', acl, .88, .44, .13)
    A.put('sides', text('DUNLOP', 'ArchivoBlack-Regular', 120, '#ffffff', slant=.2), .87, .335, .035, maxw=.28)
    A.put('sides', recol(logo('repco'), '#ffffff'), .85, .265, .035, maxw=.22)
    A.put('sides', grove_word(), 2.06, .56, .06, maxw=.22)
    A.put('sides', text('Haymes', 'KaushanScript-Regular', 120, '#ffffff'), 2.04, .44, .045, maxw=.15)
    A.put('sides', airtouch(), 2.1, .3, .05, maxw=.18)
    A.put('sides', stack(text('O', 'Montserrat', 160, '#ffffff', weight=500), text('Midea', 'Montserrat', 130, '#ffffff', weight=600)) if False else row(text('O', 'Montserrat', 160, '#ffffff', weight=400), text('Midea', 'Montserrat', 160, '#ffffff', weight=600), gap=.1), -1.83, .63, .06, maxw=.28)
    A.put('sides', apex_steel(), -1.76, .48, .045, maxw=.3)
    A.put('sides', logo('fordracing'), -1.71, .37, .08, maxw=.2)
    # bonnet: PENRITE over a gold 100 with YEARS in the last zero
    h = hundred(gold, 400, 600)
    yrs = plate(text('YEARS', 'ArchivoBlack-Regular', 110, blk, track=.08), gold, pad=.16, radius=.05)
    yrs = yrs.resize((int(h.height * .32 * yrs.width / yrs.height), int(h.height * .32)), Image.LANCZOS)
    h.alpha_composite(yrs, (int(h.width / 2 - yrs.width / 2), int(h.height / 2 - yrs.height / 2)))   # centred on the 100
    A.bonnet(h, 1.92, .55, maxw=1.45)
    A.bonnet(word, 1.38, .13, maxw=.85)
    A.roof(celebrating(gold, blk), .32, .1, maxw=.5)
    flag = Image.open(os.path.join(ROOT, 'tools/livery/logos/pr_ausflag21.png')).convert('RGBA')
    A.roof(flag, -.1, .32, maxw=.64)              # Riley: medium, centred, reading from the front
    # nose
    for s in (-1, 1):       # the bright strip beside the grille (only the frame, this strip and the lip bar are paintable)
        A.put('front', grove_word(), s * .62, .5, .04, maxw=.15)
    # tail (no photo of the rear: PENRITE and 100 years across it)
    A.put('rear', word, 0, .62, .07, maxw=.8)
    A.put('rear', celebrating(gold, blk), 0, .45, .07, maxw=.5)
    A.wingcol = blk
    A.wing(grove_word(), .14, maxw=1.0)
    A.exact = True


def _tf_text(t, px=160, c='#ffffff', w=800, **k):
    return text(t, 'Montserrat', px, c, weight=w, **k)


def tf_belt(z):
    """Mustang beltline (bottom of the side glass), from the Grove trace."""
    return np.interp(z, [-2.5, -1.85, -.6, .58, 2.08, 2.6], [1.0, .97, .9, .865, .69, .6])


def faw_trucks(c='#ffffff'):
    from PIL import ImageDraw
    ic = Image.new('RGBA', (200, 200), (0, 0, 0, 0))
    d = ImageDraw.Draw(ic)
    d.ellipse((6, 6, 193, 193), outline=c, width=16)
    for k in (-1, 0, 1):
        d.rectangle((60, 92 + k * 34 - 8, 140, 92 + k * 34 + 8), fill=c)
    d.rectangle((92, 50, 108, 150), fill=c)
    return row(ic, _tf_text('FAW', 170, c, 700), _tf_text('TRUCKS', 170, c, 500), gap=.12)


def gmg_hex(c='#bcd630', t='#ffffff'):
    from PIL import ImageDraw
    out = []
    for ch in 'GMG':
        im = Image.new('RGBA', (240, 260), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        pts = [(120 + 118 * np.cos(np.radians(a)), 130 + 128 * np.sin(np.radians(a))) for a in range(30, 390, 60)]
        d.polygon(pts, fill=c)
        g = _tf_text(ch, 150, t, 600)
        im.alpha_composite(g, ((240 - g.width) // 2, (260 - g.height) // 2))
        out.append(im)
    return row(*out, gap=.02)


def castrol_parts():
    """The Castrol mark split into its green C disc and the red word."""
    im = logo('2e167ec379')
    a = np.asarray(im)
    g = (a[..., 1].astype(int) > a[..., 0].astype(int) + 30) & (a[..., 3] > 60)
    cols = np.nonzero(g.any(0))[0]
    cut = cols.max() + 3
    disc, word = im.crop((0, 0, cut, im.height)), im.crop((cut, 0, im.width, im.height))
    return disc.crop(disc.getbbox()), word.crop(word.getbbox())


def autobarn(c='#ffffff'):
    return _tf_text('autObarn', 220, c, 800, track=-.02)


def ryco():
    from PIL import ImageDraw
    t = _tf_text('RYCO', 200, '#ffffff', 900, slant=.12)
    W, H = t.width + 90, t.height + 70
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, W - 1, H - 1), 26, fill='#e2231a')
    im.alpha_composite(t, (45, 35))
    return im


def srt_logistics(c='#ffffff'):
    from PIL import ImageDraw
    ch = Image.new('RGBA', (120, 160), (0, 0, 0, 0))
    d = ImageDraw.Draw(ch)
    for k, col in ((0, '#2f7fd8'), (50, '#f2d21a')):
        d.polygon([(k, 0), (k + 30, 0), (k + 70, 80), (k + 30, 160), (k, 160), (k + 40, 80)], fill=col)
    return row(_tf_text('SRT', 170, c, 900), _tf_text('logistics', 170, c, 500), ch, gap=.04)


def hyperix(c0='#2bb3a3', c1='#2f5fd8'):
    """Hyperix wordmark: teal-to-blue lettering under a swoosh with a little star."""
    from PIL import ImageDraw
    t = _tf_text('Hyperix', 220, '#ffffff', 600)
    W, H = t.width + 60, t.height + 90
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    im.alpha_composite(t, (0, 90))
    a = np.asarray(im).astype(np.float32)
    g = np.linspace(0, 1, W)[None, :, None]
    col = np.array(hexc(c0), np.float32) * (1 - g) + np.array(hexc(c1), np.float32) * g
    a[..., :3] = np.broadcast_to(col, a[..., :3].shape)
    im = Image.fromarray(a.astype(np.uint8))
    d = ImageDraw.Draw(im)
    d.arc((20, 40, W - 70, 300), 200, 300, fill=c0, width=14)
    st = _tf_text('*', 200, c1, 700)
    im.alpha_composite(st, (W - st.width, 0))
    return im


def paclease(c='#ffffff'):
    from PIL import ImageDraw
    ic = Image.new('RGBA', (150, 170), (0, 0, 0, 0))
    d = ImageDraw.Draw(ic)
    d.polygon([(30, 0), (150, 0), (120, 110), (60, 110), (40, 170), (0, 170)], fill=c)
    d.polygon([(70, 30), (115, 30), (102, 80), (57, 80)], fill=(0, 0, 0, 0))
    return row(ic, _tf_text('PacLease', 170, c, 700), gap=.1)


def mega_rewards():
    m = outline(text('MEGA', 'ArchivoBlack-Regular', 200, '#e2231a', slant=.18), '#ffffff', .05)
    r = outline(text('REWARDS', 'ArchivoBlack-Regular', 200, '#ffcc00', slant=.18), '#e2231a', .05)
    return row(m, r, gap=.05)


def L_monster(A, kind):
    """Tickford #6 Monster Energy Mustang from Riley's photos (tickford/6_studio, 6_track): satin black, a giant
    lime claw on the bonnet and roof, the claw and MONSTER ENERGY on the doors, autObarn over yellow/lime
    stripes on the rear quarters, lime skirts and splitter, RYCO / NARVA / FAW TRUCKS on the nose."""
    blk, lime, yel, wht = '#141516', '#b5e61d', '#f2d21a', '#f2f2f2'
    A.soft = None

    def base(x, y, z, view):
        c = fill(x.shape, blk)
        if view in ('left', 'right'):
            c = lay(c, band(y, .175, .245) * band(z, -.95, 1.15), lime)                 # sill skirt
            # autObarn stripes: yellow over lime, sweeping down to the tail under the rear-quarter word
            yc = np.interp(z, [-2.6, -2.0, -1.3, -.95], [.69, .7, .68, .64])
            m = band(z, -2.55, -.95)
            c = lay(c, band(y - yc, .02, .07) * m, yel)
            c = lay(c, band(y - yc, -.03, .012) * m, lime)
        if view == 'front':
            c = lay(c, band(y, .13, .2), lime)                                         # splitter lip
        if view == 'rear':
            c = lay(c, band(y, .2, .25), lime)
        return c
    A.paint(base)
    claw = logo('f3a8cd4401')
    word = logo('d8af11eb9d')
    for v, r in (('left', 1), ('right', -1)):
        A.put(v, claw, .62, .56, .66)
        A.put(v, word, -.3, .58, .48, maxw=1.5)
        A.put(v, ryco(), 2.07, .31, .055, maxw=.14)
        A.put(v, srt_logistics(), 2.08, .42, .024, maxw=.12)
        A.put(v, autobarn(), -1.42, .8, .15, maxw=.9)
        A.put(v, faw_trucks(), 1.2, .74, .06, maxw=.6, rot=6 * r)
        A.put(v, text('DUNLOP', 'ArchivoBlack-Regular', 120, wht, slant=.2), 1.05, .83, .03, maxw=.2)
        A.put(v, recol(logo('repco'), wht), .85, .2, .03, maxw=.2)
    A.bonnet(claw, 1.68, 1.2, maxw=1.25)
    A.roof(claw, -.25, .7, maxw=.6)
    for sx in (-1, 1):
        A.put('front', _tf_text('NARVA', 160, wht, 900), .655 * sx, .5, .028, maxw=.1)
    A.put('front', logo('3952a5b529'), 0, .62, .05)
    A.put('rear', word, 0, .62, .1, maxw=.6)
    A.put('rear', autobarn(), 0, .45, .06, maxw=.4)
    A.wingcol = blk
    A.wing(mega_rewards(), .12, maxw=1.4)
    A.endplate = wht
    A.exact = True


def L_castrol(A, kind):
    """Tickford #55 Castrol Mustang from Riley's photos (tickford/55_studio, 55_top, 55_rear): white body with a
    green nose and front guards, a green beltline band, a green sweep under the giant Castrol on the doors
    with a red wedge below it growing to the tail, GMG/GRAPHENE on the rear quarters, the green Castrol C and
    word on a white bonnet, bp helios and lime bp ultimate bands on the roof, a lime bp ultimate wing."""
    grn, wht, red, lim, blu = '#0b8a3e', '#f4f5f3', '#e2231a', '#cfe000', '#1e4fa3'
    A.soft = None

    def sweep(z):          # centre of the green sweep under the Castrol word
        return np.interp(z, [-2.6, -1.85, -.89, .78, 2.6], [.47, .47, .385, .23, .23])

    def base(x, y, z, view):
        c = fill(x.shape, wht)
        if view in ('left', 'right'):
            # from tickford/55_side: thin green band under the glass, green front guard behind a raked edge,
            # white doors, a green sweep along the bottom of the doors with a red wedge under it (never behind the word)
            zb = .68 + (.85 - y) * 2.16
            c = lay(c, ss(zb - .01, zb + .01, z) * (y > .2), grn)
            # green under the side glass, sweeping up behind the rear quarter window onto the deck (one smooth edge)
            lo = tf_belt(z) - .045
            lo = np.where(z < -1.0, np.interp(z, [-1.75, -1.35, -1.0], [1.12, 1.0, float(tf_belt(-1.0)) - .045]), lo)
            lo = np.where(z < -1.75, 9.0, lo)
            c = lay(c, ss(lo - .004, lo + .004, y) * (z < .9), grn)
            sy = sweep(z)
            c = lay(c, band(y - sy, -.042, .042) * (z < 1.2), grn)
            th = np.interp(z, [-2.6, -1.85, -.89, -.1, .35], [.26, .26, .16, .1, 0])
            c = lay(c, band(y, sy - .042 - th, sy - .042) * (y > .17), red)
            c = lay(c, (y < .17).astype(np.float32), '#1b1c1e')                        # black sill skirt
        if view == 'top':
            c = lay(c, ((np.abs(x) > .63) & (z > .6)).astype(np.float32), grn)          # green front guards
            c = lay(c, ((np.abs(x) > .5) & (z > -.8) & (z < .65)).astype(np.float32), grn)   # roof rails
            c = lay(c, band(z, .2, .4) * (np.abs(x) < .5), lim)                          # roof front band
            c = lay(c, band(z, -.92, -.7) * (np.abs(x) < .5), lim)                       # roof rear band
            for sx in (-1, 1):                                                          # bonnet corner bars
                for k, col in enumerate((grn, red, grn)):
                    x0 = sx * (.36 + k * .085)
                    c = lay(c, (band(z - (x - x0) * sx * .25, 1.1, 1.16) * (np.abs(x - x0) < .035)).astype(np.float32), col)
        if view == 'front':
            c = fill(x.shape, grn)
            c = lay(c, band(y, -1, .2), '#1b1c1e')
        if view == 'rear':
            c = lay(c, band(y, .2, .4), red)
            c = lay(c, band(y, .4, .45), grn)
            c = lay(c, band(y, .66, .74), lim)
        return c
    A.paint(base)
    disc, word = castrol_parts()
    full = logo('2e167ec379')
    for v in ('left', 'right'):
        # the C disc always reads first: at the back of the door on the right flank, the front on the left
        # the whole Castrol mark (C disc then the word, properly spaced), tilted to run with the sweep under it
        A.put(v, full, .1, .56, .4, maxw=1.3, rot=5.5 * (1 if v == 'left' else -1))
        A.put(v, hyperix(), -1.5, .79, .2, maxw=.78)
        A.put(v, _tf_text('AI & IT', 120, blu, 600), -1.5, .675, .04, maxw=.2)
        A.put(v, hyperix(wht, wht), 1.45, .75, .12, maxw=.48)
        A.put(v, stack(_tf_text('BAYFORD', 140, '#2a2a2a', 800)), -1.92, .56, .05, maxw=.36)
        A.put(v, paclease(), -.66, .235, .055, maxw=.36)
        A.put(v, recol(logo('ford_oval'), wht), -2.12, .3, .05, maxw=.14)
        A.put(v, text('DUNLOP', 'ArchivoBlack-Regular', 120, wht, slant=.2), 1.0, .86, .03, maxw=.2)
        A.put(v, ryco(), 2.07, .31, .055, maxw=.14)
    A.bonnet(disc, 1.68, .72, x=-.02, maxw=.72)
    A.bonnet(word, 2.2, .24, x=.05, maxw=1.2)
    hel = logo('bp-d2a4eb7d52')
    hel = hel.crop((0, int(hel.height * .24), hel.width, hel.height))
    A.roof(hel, -.3, .5, maxw=.5)
    bpu = logo('bp-ultimate')
    A.roof(bpu, -.81, .14, maxw=.7)
    A.put('top', bpu, .3, 0, .13, .7, rot=-90)        # front band reads from behind
    A.put('front', logo('3952a5b529'), 0, .62, .05)
    for sx in (-1, 1):
        A.put('front', _tf_text('NARVA', 160, wht, 900), .655 * sx, .5, .028, maxw=.1)
    A.put('rear', plate(full, wht, pad=.15, radius=.15), 0, .3, .1, maxw=.5)
    A.put('rear', bpu, 0, .7, .06, maxw=.5)
    A.put('rear', recol(logo('fordracing'), blu) if False else _tf_text('FORD RACING', 140, blu, 800), 0, .86, .035, maxw=.4)
    A.wingcol = lim
    A.wing(bpu, .12, maxw=1.3)
    A.endplate = wht
    A.exact = True


_WAU = {}


def wau_masks(name, hues, shard_boxes, r_hues=None, drop=(), min_area=60, r_smin=.45):
    """Colour masks (float, smoothed) cut from a Walkinshaw side photo: the accent skirts, the R of the GR shard
    and the white G. hues: (lo, hi) degrees of the accent; r_hues: of the R (default the accent).
    shard_boxes: photo boxes holding the shard; drop: photo boxes to clear (logos)."""
    if name in _WAU:
        return _WAU[name]
    import cv2
    rgb = np.asarray(Image.open(os.path.join(REFS, name + '.png')).convert('RGB'))
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV_FULL).astype(float)
    h, s, v = hsv[..., 0] * 360 / 256, hsv[..., 1] / 255, hsv[..., 2] / 255

    def hue(lo, hi, smin=.45):
        hh = (h >= lo) & (h <= hi) if lo < hi else (h >= lo) | (h <= hi)
        return hh & (s > smin) & (v > .3)
    acc = hue(*hues)
    red = hue(*(r_hues or hues), smin=r_smin)
    wht = (v > .55) & (s < .12)
    inbox = np.zeros(acc.shape, bool)
    for x0, y0, x1, y1 in shard_boxes:
        inbox[y0:y1, x0:x1] = True
    out = {}
    for k, m, cl in (('acc', acc & ~inbox, 5), ('r', red & inbox, 3), ('g', wht & inbox, 3)):
        m = m.astype(np.uint8)
        for x0, y0, x1, y1 in drop:
            m[y0:y1, x0:x1] = 0
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (cl, cl)))
        cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        hi = np.zeros((m.shape[0] * 4, m.shape[1] * 4), np.uint8)
        for c in cs:
            if cv2.contourArea(c) >= min_area:
                c = cv2.approxPolyDP(c.astype(np.float32) * 4, 5.0, True).astype(np.int32)
                cv2.fillPoly(hi, [c], 255)
        hi = cv2.GaussianBlur(hi.astype(np.float32) / 255, (0, 0), 1.2)
        out[k] = (hi, 4)
    _WAU[name] = out
    return out


_YMAP = {}


def top_ymap(kind_key):
    """For every texel of the top view, the height y (m) of the body surface the game draws there (NaN where
    nothing maps): lets a side design wrap up over a haunch or shoulder that faces the sky."""
    if kind_key in _YMAP:
        return _YMAP[kind_key]
    import base64, gzip, cv2
    d = json.loads(gzip.decompress(open(os.path.join(ROOT, 'assets/s26', kind_key.lower() + '.json.gz.bin'), 'rb').read()))
    w, h = SIZE['top']
    ym = np.full((h * K, w * K), -9.0, np.float32)
    tris = []
    for r in d['levels'][0]:
        if r['role'] not in ('wing', 'hood') or not r.get('q'):
            continue
        p = np.frombuffer(base64.b64decode(r['p']), np.int16).reshape(-1, 3).astype(np.float64) / 10000
        f = np.frombuffer(base64.b64decode(r['i']), np.uint16 if r.get('i16') else np.uint32).reshape(-1, 3)
        tris.append(p[f])
    t = np.concatenate(tris)
    fn = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
    t = t[fn[:, 1] > .62]
    yv = t[..., 1].mean(1)
    H_, W_ = ym.shape
    for i in np.argsort(yv):       # y interpolated across each triangle (a flat y per triangle left stair steps)
        q = np.stack([(t[i, :, 2] - ZB) * S * K, (XL - t[i, :, 0]) * S * K], -1)
        x0, y0 = np.floor(q.min(0)).astype(int)
        x1, y1 = np.ceil(q.max(0)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W_ - 1), min(y1, H_ - 1)
        if x1 < x0 or y1 < y0:
            continue
        px, py = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5)
        (ax, ay), (bx, by), (cx, cy) = q
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-9:
            continue
        l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den
        l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den
        l3 = 1 - l1 - l2
        m = (l1 >= -.02) & (l2 >= -.02) & (l3 >= -.02)
        if m.any():
            yy = l1 * t[i, 0, 1] + l2 * t[i, 1, 1] + l3 * t[i, 2, 1]
            ym[y0:y1 + 1, x0:x1 + 1][m] = yy[m]
    ym[ym < -8] = np.nan
    _YMAP[kind_key] = ym
    return ym


def side_H(A, pts):
    """Homography from side (z, y) to photo pixels from the two wheel centres (u, v); the vertical scale is taken
    equal to the horizontal one (a square-on side photo)."""
    (uf, vf), (ur, vr) = pts
    k = np.hypot(uf - ur, vf - vr) / (A.f - A.r)
    src = [(A.f, .34), (A.r, .34), (A.f, .67), (A.r, .67)]
    dst = [(uf, vf), (ur, vr), (uf, vf - .33 * k), (ur, vr - .33 * k)]
    M = []
    for (z, y), (u, v) in zip(src, dst):
        M.append([z, y, 1, 0, 0, 0, -u * z, -u * y, -u])
        M.append([0, 0, 0, z, y, 1, -v * z, -v * y, -v])
    H = np.linalg.svd(np.array(M))[2][-1].reshape(3, 3)
    return H / H[2, 2], k


def sample(m, H, z, y):
    from scipy import ndimage
    m, sc = m
    q = H @ np.stack([z.ravel(), y.ravel(), np.ones(z.size)])
    u, v = q[0] / q[2] * sc, q[1] / q[2] * sc
    return ndimage.map_coordinates(m, [v, u], order=1, mode='constant').reshape(z.shape)


def mobil1(c='#ffffff'):
    im = logo('mobil1')
    return im if c == '#ffffff' else recol(im, c)


def wau_round(px=400):
    """Chemical Guys roundel: white ring, CHEMICAL / GUYS round the rim."""
    from PIL import ImageDraw, ImageFont
    im = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((4, 4, px - 5, px - 5), fill='#141414', outline='#f4f4f4', width=int(px * .05))
    d.ellipse((px * .3, px * .3, px * .7, px * .7), outline='#f4f4f4', width=int(px * .03))
    f = ImageFont.truetype(os.path.join(FONTS, 'ArchivoBlack-Regular.ttf'), int(px * .12))
    for word, a0, a1, rr in (('CHEMICAL', 215, 325, .36), ('GUYS', 140, 40, .36)):
        n = len(word)
        for i, ch in enumerate(word):
            t = np.radians(a0 + (a1 - a0) * (i + .5) / n)
            cx, cy = px / 2 + rr * px * np.cos(t), px / 2 + rr * px * np.sin(t)
            g = Image.new('RGBA', (int(px * .2), int(px * .2)), (0, 0, 0, 0))
            ImageDraw.Draw(g).text((px * .1, px * .1), ch, font=f, fill='#f4f4f4', anchor='mm')
            rot = -(np.degrees(t) + 90) if a1 > a0 else -(np.degrees(t) - 90)
            g = g.rotate(rot, resample=Image.BICUBIC)
            im.alpha_composite(g, (int(cx - g.width / 2), int(cy - g.height / 2)))
    return im


def mobil_parts():
    """The Mobil word and the boxed 1, apart (the bonnet stacks them)."""
    im = logo('mobil1')
    a = np.asarray(im)[..., 3] > 60
    cols = np.nonzero(a.any(0))[0]
    gaps = np.nonzero(np.diff(cols) > im.width * .03)[0]
    cut = cols[gaps[-1]] + 1
    w, b = im.crop((0, 0, cut, im.height)), im.crop((cut, 0, im.width, im.height))
    return w.crop(w.getbbox()), b.crop(b.getbbox())


def gr_shard(gcol, rcol, stretch=1.15):
    """The giant GR on the Walkinshaw flanks: the letters of the TOYOTA GAZOO Racing mark (cut out of its black
    parallelogram), G and R in their own colours, stretched long as on the cars."""
    im = logo('tgr')
    a = np.asarray(im)
    H, W = a.shape[:2]
    box = (a[..., 3] > 128)
    cols = np.nonzero(box.any(0))[0]
    # the black parallelogram is the first run of columns; letters are the holes inside it
    run_end = cols[np.nonzero(np.diff(cols) > 1)[0][0]] if (np.diff(cols) > 1).any() else cols[-1]
    sub = box[:, :run_end + 1]
    import cv2
    filled = np.zeros_like(sub, np.uint8)
    cs, _ = cv2.findContours(sub.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(filled, cs, -1, 1, -1)
    letters = (filled > 0) & ~sub
    n, lab, st, _ = cv2.connectedComponentsWithStats(letters.astype(np.uint8))
    big = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 500]
    big.sort(key=lambda i: st[i, cv2.CC_STAT_LEFT])
    out = np.zeros(sub.shape + (4,), np.uint8)
    for i, col in zip(big[:2], (gcol, rcol)):
        out[lab == i] = tuple(hexc(col).astype(np.uint8)) + (255,)
    o = Image.fromarray(out)
    o = o.crop(o.getbbox())
    return o.resize((int(o.width * stretch), o.height), Image.LANCZOS)


def wau_ring(px=160):
    from PIL import ImageDraw
    im = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((6, 6, px - 7, px - 7), outline='#f2f2f2', width=int(px * .1))
    d.ellipse((px * .32, px * .32, px * .68, px * .68), fill='#f2f2f2')
    return im


def supercheap(px=200):
    red, yel = '#d71920', '#ffd400'
    top = plate(text('SUPERCHEAP', 'Anton-Regular', px, '#ffffff', slant=.12), red, pad=.08, radius=.05)
    bot = plate(text('AUTO', 'ArchivoBlack-Regular', int(px * .55), red), yel, pad=.12, radius=.05)
    return stack(top, bot, gap=.02)


def ta_parts():
    """Truck Assist logo split into its orange circle and the white words."""
    im = logo('6aa12045ea')
    a = np.asarray(im).copy()
    org = (a[..., 0] > 180) & (a[..., 2] < 120)
    circ, word = a.copy(), a.copy()
    circ[~org, 3] = 0
    word[org, 3] = 0
    for x in (circ, word):                 # faint edge residue of the other part would pad the crop
        x[x[..., 3] < 60, 3] = 0
    c, w = Image.fromarray(circ), Image.fromarray(word)
    return c.crop(c.getbbox()), w.crop(w.getbbox())


def L_wau(A, kind, car):
    """Walkinshaw TWG Toyota Supras from Riley's photos (wau/1_* Optus #1, wau/2_* Truck Assist #2): black with
    accent skirts (teal / orange), the white G and red (orange) R shard over the rear wheel, OPTUS or the Truck
    Assist mark on the doors, Mobil 1 bonnet and rear, LOCTITE on a red wing. Each flank is painted from its own
    side photo (1_side is the left flank, 2_side the right), mapped by the wheel centres."""
    blk, wht = '#1c1e20', '#f2f2f2'
    acc, rc = ('#25b5b4', '#e3312d') if car == 1 else ('#f06a1c', '#f06a1c')
    R = wau_masks('wau/2_side', (8, 35), [(170, 238, 420, 290), (260, 290, 420, 312)], drop=[(410, 235, 525, 340), (0, 0, 160, 262), (100, 0, 1024, 238), (188, 286, 236, 306)])
    L = wau_masks('wau/1_side', (165, 200), [(398, 205, 575, 262)], r_hues=(335, 20), drop=[(0, 0, 678, 205), (560, 205, 678, 262)], min_area=20, r_smin=.3)
    g, sc = L['g']
    vv, uu = np.mgrid[:g.shape[0], :g.shape[1]] / sc
    g[(uu > 482) & (vv < 219 + (uu - 482) * 11 / 93)] = 0          # the backdrop above the tail is not paint
    HL, kL = side_H(A, [(167, 282), (485, 282)])
    HR, kR = side_H(A, [(755, 337), (293, 337)])

    def zy(H, u, v):
        q = np.linalg.inv(H) @ np.array([u, v, 1.0])
        return q[0] / q[2], q[1] / q[2]
    zR0, zR1 = zy(HR, 172, 265)[0], zy(HR, 412, 265)[0]          # the GR shard on the right flank (G at the rear end)
    zL1 = zy(HL, 405, 240)[0]                                     # left flank: the G starts just behind OPTUS
    zL0 = zL1 - (zR1 - zR0)

    def base(x, y, z, view):
        c = fill(x.shape, blk)
        if view == 'front':
            c = lay(c, band(y, -1, .17), acc)
        if view == 'rear':                     # visible tail: y .40 (diffuser below) to the boot lip ~1.0
            c = lay(c, (band(y, -1, .495) * (1 - band(np.abs(x), -1, .16) * band(y, -1, .47))), acc)
            c = lay(c, ((np.abs(x) > .62) & (y < .6)).astype(np.float32), acc)
        if view == 'top':
            c = lay(c, ((np.abs(np.abs(x) - .56) < .008) & (z > -1.0) & (z < .55)).astype(np.float32), acc)
        return c
    A.paint(base)
    A.wrap = [(.5, .99, -2.6, 1.0), (.68, .99, 1.0, 2.3)]
    skirts = [[(356, 334), (686, 349.5), (687, 378.5), (420, 378), (418, 365), (356, 364)],         # sill
              [(145, 317.5), (172, 343), (194, 321), (234, 321), (234, 359), (165, 360), (150, 345)],  # rear quarter
              [(824, 349), (831, 349), (832, 365), (878, 366), (880, 372), (824, 373)],                 # splitter end
              [(196, 311.5), (234, 311.5), (234, 313.5), (196, 313.5)],                                 # pinline under Coates
              [(416, 336.2), (607, 347.2), (607, 348.4), (416, 337.6)]]                                 # pinline over the sill
    for pts in skirts:
        A.poly('sides', [zy(HR, u, v) for u, v in pts], acc)
    A.poly('sides', [zy(HR, u, v) for u, v in [(416, 337.6), (607, 348.4), (686, 349.5), (686, 350.6), (416, 339.5)]], blk)
    A.soft = None
    mont = lambda t, px=160, c=wht, w=800, **k: text(t, 'Montserrat', px, c, weight=w, **k)

    def at(view, im, u, v, hpx, maxw_px=None, rot=0):
        H, k = (HL, kL) if view == 'left' else (HR, kR)
        q = np.linalg.inv(H) @ np.array([u, v, 1.0])
        A.put(view, im, q[0] / q[2], q[1] / q[2], hpx / k, maxw_px / k if maxw_px else None, rot)

    def both(im, u, v, hpx, maxw_px=None, rot=0, im_left=None):
        """u, v on 2_side (right flank); the left flank gets the same (z, y)."""
        H, k = HR, kR
        q = np.linalg.inv(H) @ np.array([u, v, 1.0])
        z, y = q[0] / q[2], q[1] / q[2]
        A.put('right', im, z, y, hpx / k, maxw_px / k if maxw_px else None, rot)
        A.put('left', im_left or im, z, y, hpx / k, maxw_px / k if maxw_px else None, -rot)

    # doors
    if car == 1:
        optus = mont('OPTUS', 300, wht, 700, track=.02)
        at('left', optus, 305, 266, 40, 182)                 # low on the door, level
        q = np.linalg.inv(HL) @ np.array([305, 266, 1.0])
        A.put('right', optus, q[0] / q[2], q[1] / q[2], 40 / kL, 182 / kL)
    else:
        circ, word = ta_parts()
        at('right', row(circ, word, gap=.04), 560, 300, 102, 275, rot=-4)
        at('right', circ, 467, 288, 100) if False else None
        q = np.linalg.inv(HR) @ np.array([560, 300, 1.0])
        A.put('left', row(word, circ, gap=.04), q[0] / q[2], q[1] / q[2], 102 / kR, 275 / kR, rot=4)
    # the GR: right flank G over the rear arch with the R ahead of it; left flank G just behind OPTUS
    gr = gr_shard(wht, rc)
    at('right', gr, 292, 280, 57, 210)            # top at y .88: Mobil 1 sits above it
    if car == 1:
        at('left', gr, 488, 246, 46, 150)
    else:                                  # #2: the GR follows the Truck Assist circle, as on the right flank
        zc, yc = zy(HR, 560, 300)
        wg = 210 / kR
        A.put('left', gr, zc - 275 / kR / 2 - .06 - wg / 2, zy(HR, 292, 280)[1], 57 / kR, wg)
    # quarter panels and sills (positions from 2_side, mirrored to the left flank by (z, y))
    A.put('sides', mobil1(), -1.14, .925, .05, maxw=.36)   # the steep band under the rear side window
    both(supercheap(), 384, 324, 17, 54)
    # the small rear-quarter marks, laid out in the one flat column between the rear arch and the tail
    A.put('sides', wau_round(), -2.03, .565, .12)
    A.put('sides', mont('Coates', 200, '#f26a21', 800), -1.87, .585, .05, maxw=.15)
    A.put('sides', logo('ppg'), -1.78, .48, .06, maxw=.06)
    A.put('sides', mont('GEARWRENCH', 120, wht, 900), -1.96, .44, .022, maxw=.17)
    A.put('sides', stack(mont('move', 200, wht, 700), mont('my.wheels.com.au', 70, wht, 600), gap=.02), -1.86, .32, .07, maxw=.17)
    # RINGERS (o) WESTERN runs along the front flare, whose top slopes up to the bonnet: the side view smears it,
    # so it is laid in the top view along the flare, letter tops toward the bonnet
    rw = lambda t: text(t, 'LibreBaskerville', 240, wht, track=.05, weight=700)
    rwim = row(rw('RINGERS'), wau_ring(240), rw('WESTERN'), gap=.12)
    for sx in (1, -1):
        A.after('top', rwim, 1.5, .83 * sx, .05, .72, rot=180 if sx > 0 else 0)
    both(mont('CoreStaff', 140, wht, 700), 848, 308, 6, 30)
    both(text('DUNLOP', 'ArchivoBlack-Regular', 120, wht, slant=.2), 652, 251, 5, 40)
    both(row(mont('DesignEars', 110, wht, 600), mont('employmenthero', 110, wht, 600), mont('Lloyds', 110, wht, 600), mont('Spicers', 110, wht, 600), gap=.6), 430, 349, 6, 135)
    both(recol(logo('repco'), wht), 654, 370, 6, 32)
    # bonnet, roof, nose
    mw, mb = mobil_parts()
    A.bonnet(mw, 2.0, .26, maxw=1.45)
    A.bonnet(mb, 2.31, .2, maxw=.42)
    ngk = stack(mont('NGK', 200, wht, 900), mont('SPARK PLUGS', 90, wht, 700))
    A.bonnet(ngk, 2.3, .07, x=.6, maxw=.2)
    A.bonnet(ngk, 2.3, .07, x=-.6, maxw=.2)
    A.roof(mont('Coates', 200, '#f26a21', 800), .45, .14, maxw=.8)
    A.roof(mobil1(), -.2, .2, maxw=.9)
    A.roof(recol(logo('tgr'), wht), -.75, .14, maxw=.8)
    A.put('front', stack(mont('NTK', 200, wht, 900), mont('FILTERS', 110, wht, 800)), 0, .46, .05, maxw=.14)
    for sx in (-1, 1):
        A.put('front', text('Yes', 'KaushanScript-Regular', 200, wht), .62 * sx, .37, .06, maxw=.14)
        A.put('front', mont('CoreStaff', 140, wht, 700), .55 * sx, .46, .03, maxw=.18)
        A.put('front', mont('JB Caravans', 120, '#141414', 800), .4 * sx, .15, .035, maxw=.26)
    # tail
    A.put('rear', mont('OPTUS', 300, wht, 700) if car == 1 else row(ta_parts()[0], mont('TRUCK ASSIST', 200, wht, 900), gap=.05), 0, .665, .075, maxw=.55)
    A.put('rear', mobil1(), 0, .555, .07, maxw=.48)
    for sx in (-1, 1):
        A.put('rear', stack(mont('NTK', 200, '#1d9a56', 900), mont('FILTERS', 110, wht, 800)), .56 * sx, .56, .065, maxw=.15)
        A.put('rear', mont('employmenthero', 110, wht, 600), .4 * sx, .475, .025, maxw=.22)
        A.put('rear', mont(('PALM', 'TRANS')[sx > 0], 160, wht, 600), .25 * sx, .94, .03, maxw=.12)
    A.put('rear', recol(logo('toyota'), wht), 0, .44, .03, maxw=.2) if False else None
    A.endplate = '#d42a2a'
    A.wingcol = '#d42a2a'
    A.wing(outline(recol(logo('loctite'), wht), '#b81e1e', .03), .16, maxw=1.3)
    A.exact = True


def L_optus(A, kind):
    L_wau(A, kind, 1)


def L_truckassist(A, kind):
    L_wau(A, kind, 2)


def L_shell(A, kind):
    """DJR Shell V-Power Mustang (refs djr/*): white, red sills and rear bumper with a yellow pinline,
    red bonnet shield carrying the pecten, red/yellow roof stripes, black DXC wing."""
    wht, red, yel, blk = '#f4f4f2', '#d6202b', '#ffc72c', '#1a1a1a'

    def base(x, y, z, view):
        c = fill(x.shape, wht)
        if view == 'top':
            # bonnet shield: a red rounded panel, white border, from the nose to the scuttle
            zb0, zb1 = A.f - .55, A.f + .95
            sh = band(z, zb0, zb1) * (np.abs(x) < .62 - .25 * ss(zb1 - .4, zb1, z))
            c = lay(c, sh, red)
            # roof: red centre with yellow and red pinstripes running back to the wing
            c = lay(c, band(np.abs(x), 0, .28) * band(z, -2.4, zb0 - .05), red)
            c = lay(c, band(np.abs(x), .31, .35) * band(z, -2.4, zb0 - .05), yel)
            c = lay(c, band(np.abs(x), .37, .40) * band(z, -2.4, zb0 - .05), red)
            c = lay(c, band(z, -9, -2.15), blk)                        # wing / boot lip
        if view == 'front':
            c = lay(c, band(y, -1, .30), red)
        if view == 'rear':
            c = lay(c, band(y, -1, .42), red)
            c = lay(c, band(y, .42, .45), yel)
            c = lay(c, band(y, .85, .92) * (np.abs(x) < .55), red)
            c = lay(c, band(y, .66, .78) * (np.abs(x) < .55), blk)
        return c
    A.paint(base)
    A.photo('djr/18', [(315, 668), (1157, 668), (315, 572), (1157, 572)], tyre=.33)
    outline = [(117, 571), (187, 527), (400, 504), (560, 473), (627, 440), (747, 403), (933, 397), (1093, 420), (1200, 447), (1307, 467), (1393, 493), (1413, 527), (1433, 627), (1427, 700), (1333, 713), (1040, 733), (453, 737), (200, 733), (91, 727), (107, 627)]
    glass = [[(593, 503), (627, 460), (693, 424), (800, 407), (933, 407), (1053, 424), (1109, 443), (1073, 473), (933, 488), (747, 497), (627, 505)]]
    W, R, Y, T = '#f2f2f2', red, '#f2b81c', '#141416'
    RELAY = [(273, 515, 456, 543), (437, 541, 525, 625), (444, 635, 543, 661), (444, 661, 543, 688), (1123, 441, 1211, 485),
             (1309, 571, 1403, 605)]     # national tiles, Rheem, DUNLOP, Repco, MAN, Jet: lifted off, re-laid as cut-outs
    decals = [(bx, [W, T], 70, 'erase') for bx in RELAY] + [
              ((693, 535, 813, 588), [W], 70),                 # Shell
              ((693, 588, 1003, 641), [W], 70),                 # V-Power
              ((967, 527, 1023, 580), [W], 70),                 # V-Power star
              ((1083, 493, 1339, 549), [W], 70),                # Repco
              ((1267, 627, 1379, 696), [R, W, Y], 75),          # Ford, RACING
              ((987, 660, 1037, 699), [R, Y], 70),              # PPG
              ((507, 711, 1016, 735), [R, Y, T], 70)]           # sill partners
    A.exact = True           # the photo carries every real partner
    A.project(outline, 'left', glass=glass, decals=decals, glass_fill='#f4f4f2', glass_pad=7, above=(.95, '#f4f4f2'))
    _soft, A.soft = A.soft, None
    for bx in RELAY:         # each mark exactly where the photo has it, reading the right way on both flanks
        cut = crop('djr/18', bx, bg='#f2f2f2', tol=60)
        b0, b1, b2, b3 = LAST_BB
        if bx[0] == 273:     # national tiles: centred over the front wheel arch, up on the fender, clear of Rheem
            A.put('sides', cut, A.f, .73, (b3 - b1) / 4 / A.px_per_m(), maxw=.5)
            continue
        A.plogo(cut, bx[0] + (b0 + b2) / 8, bx[1] + (b1 + b3) / 8, (b3 - b1) / 4)
    # front corner under the headlight: repainted flat (the photo's corner smeared red and white into the lamp)
    def ends(x, y, z, view):
        c = fill(x.shape, wht)
        c = lay(c, band(y, -1, .30), red)
        c = lay(c, band(y, .30, .32), yel)
        return c
    A.over(ends, lambda x, y, z, view: np.clip((z - (A.f + .42)) / .06, 0, 1))
    A.soft = _soft
    pect = logo('755f654419').crop((0, 0, 324, 302))
    vpow = logo('755f654419').crop((456, 0, 1302, 302))
    from scipy import ndimage
    pa = np.asarray(pect.convert('RGBA')).copy()
    al = pa[..., 3] > 60
    pad = 60
    big = np.pad(al, pad)
    ring = ndimage.binary_dilation(big, iterations=48) & ~ndimage.binary_dilation(big, iterations=34)
    sh = np.zeros(big.shape + (4,), np.uint8)
    sh[ring] = (244, 244, 242, 255)
    sh[pad:-pad, pad:-pad][al] = pa[al]
    pect_ring = Image.fromarray(sh)
    _soft, A.soft = A.soft, None    # placed exactly (auto-fit kept pushing it off the vent to the back of the bonnet)
    A.bonnet(pect_ring, A.f + .2, 1.1, maxw=1.3)      # big, in the middle of the bonnet shield
    A.soft = _soft
    A.roof(pect, -.1, .3, maxw=.5)
    A.roof(recol(vpow, '#ffffff'), .35, .1, maxw=.6)
    A.wingtop(crop('djr/14', (480, 228, 1135, 282), bg='#111111'), -2.24, .09, maxw=1.3)    # DXC
    A.put('front', recol(logo('b609ba68f2').crop((560, 0, 1419, 369)), '#ffffff'), 0, .22, .05, maxw=.7)
    A.put('front', logo('3952a5b529'), 0, .62, .06)
    A.put('rear', crop('djr/14', (545, 505, 1030, 548), bg='#0d0d0d'), 0, .72, .045, maxw=.9)  # WM Waste on the black tail panel
    A.put('rear', crop('djr/14', (630, 640, 975, 722)), 0, .52, .08, maxw=.5)  # Shell Helix
    A.put('rear', crop('djr/14', (545, 400, 1030, 450), bg='#d6202b'), 0, .885, .035, maxw=.7)


# ---------------------------------------------------------------- typeset marks (any font, any colour)
FONTS = os.path.join(HERE, 'fonts')


def text(txt, font='ArchivoBlack-Regular', px=200, fill='#ffffff', track=0.0, slant=0.0, weight=None, lines=None):
    """A sharp RGBA wordmark in a real typeface (tools/s26/fonts): track = extra letter spacing (fraction of px),
    slant = italic shear. lines = [(txt, scale)] for stacked text, centred."""
    from PIL import ImageDraw, ImageFont
    def one(t, size):
        f = ImageFont.truetype(os.path.join(FONTS, font + '.ttf'), int(size))
        if weight:
            try:
                f.set_variation_by_axes([weight])
            except Exception:
                pass
        ws = [f.getbbox(ch)[2] - f.getbbox(ch)[0] if ch != ' ' else size * .3 for ch in t]
        adv = [f.getlength(ch) for ch in t]
        W = int(sum(adv) + track * size * (len(t) - 1) + size)
        H = int(size * 1.6)
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        x = size * .2
        for ch, ad in zip(t, adv):
            d.text((x, size * .1), ch, font=f, fill=fill)
            x += ad + track * size
        return im.crop(im.getbbox())
    if lines:
        parts = [one(t, px * k) for t, k in lines]
        W = max(p.width for p in parts)
        gap = int(px * .18)
        H = sum(p.height for p in parts) + gap * (len(parts) - 1)
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        y = 0
        for p in parts:
            im.alpha_composite(p, ((W - p.width) // 2, y))
            y += p.height + gap
    else:
        im = one(txt, px)
    if slant:
        sh = int(im.height * slant)
        im = im.transform((im.width + sh, im.height), Image.AFFINE, (1, slant, -sh, 0, 1, 0), Image.BICUBIC)
        im = im.crop(im.getbbox())
    return im


def plate(im, fill, pad=.18, radius=.25, outline=None, ow=.04):
    """A rounded decal plate behind a mark (pad / radius as a fraction of the mark's height)."""
    from PIL import ImageDraw
    p = int(im.height * pad)
    W, H = im.width + 2 * p, im.height + 2 * p
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    d.rounded_rectangle((0, 0, W - 1, H - 1), int(H * radius), fill=fill, outline=outline, width=int(H * ow) if outline else 0)
    out.alpha_composite(im, (p, p))
    return out


def row(*ims, gap=.25):
    """Marks side by side, centred vertically (gap as a fraction of the tallest)."""
    H = max(i.height for i in ims)
    g = int(H * gap)
    out = Image.new('RGBA', (sum(i.width for i in ims) + g * (len(ims) - 1), H), (0, 0, 0, 0))
    x = 0
    for i in ims:
        out.alpha_composite(i, (x, (H - i.height) // 2))
        x += i.width + g
    return out


def hino_badge():
    """HINO as raced: a red rounded plate, white Hino emblem in a white ring and HINO in heavy caps."""
    from PIL import ImageDraw
    em = recol(logo('hino').crop((0, 0, 1460, 1000)), '#ffffff')
    em = em.crop(em.getbbox())
    em.thumbnail((170, 170))
    ring = Image.new('RGBA', (220, 220), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((4, 4, 215, 215), outline='#ffffff', width=14)
    ring.alpha_composite(em, ((220 - em.width) // 2, (220 - em.height) // 2))
    word = text('HINO', 'ArchivoBlack-Regular', 230, '#ffffff', track=.08)
    return plate(row(ring, word, gap=.18), '#e3242b', pad=.22, radius=.22, outline='#ffffff', ow=.05)


def grunge(z, y, z0, slope, width, seed=3):
    """A smoky, broken edge: 1 behind z0 + slope*(y-.5) (towards the tail), fading over `width` with noise."""
    rng = np.random.default_rng(seed)
    from scipy import ndimage
    n = ndimage.gaussian_filter(rng.standard_normal((64, 64)), 2)
    n = n / (np.abs(n).max() + 1e-6)
    ny = ndimage.map_coordinates(n, [np.mod(y * 40, 63), np.mod(z * 25, 63)], order=1, mode='wrap')
    e = z0 + slope * (y - .5) + ny * width * .6
    return np.clip((e - z) / width + .5, 0, 1)


def key_out(im, col, tol=70):
    """Make one background colour transparent (e.g. the DEWALT box yellow, so the body paint shows through)."""
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    d = np.abs(a[..., :3] - hexc(col)).sum(-1)
    a[..., 3] *= np.clip((d - tol * .5) / tol, 0, 1)
    out = Image.fromarray(a.astype(np.uint8))
    return out.crop(out.getbbox())


def distress(im, amount=.1, seed=5, stretch=1.0):
    """Worn-print look like the real Team 18 lettering: rough edges and small chipped specks (amount = how much is
    chipped), optionally stretched tall (stretch = height factor)."""
    from scipy import ndimage
    if stretch != 1.0:
        im = im.resize((im.width, int(im.height * stretch)), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32).copy()
    rng = np.random.default_rng(seed)
    n = ndimage.gaussian_filter(rng.standard_normal(a.shape[:2]), 1.0)
    n2 = ndimage.gaussian_filter(rng.standard_normal(a.shape[:2]), 4)
    n = n / n.std() + .6 * n2 / n2.std()
    chip = n > np.quantile(n, 1 - amount)
    al = a[..., 3] / 255
    edge = ndimage.gaussian_filter(al, 2) * (1 + .35 * n2 / n2.std())
    keep = (edge > .45) & ~chip
    a[..., 3] = np.where(keep, a[..., 3], 0)
    return Image.fromarray(a.astype(np.uint8))


def triangle(c='#f26b21', px=120):
    from PIL import ImageDraw
    im = Image.new('RGBA', (int(px * 1.15), px), (0, 0, 0, 0))
    ImageDraw.Draw(im).polygon([(0, px - 1), (im.width / 2, 0), (im.width - 1, px - 1)], fill=c)
    return im


def L_team18(A, kind, main, brand):
    """Team 18 Camaros from Riley's photos (riley/9_t18_18, 10_t18_20), placed on the measured Camaro map
    (door z .87..-.6, belt y .93, nose band = top view z 2.42-2.52). Shared: black bonnet, nose band, roof and
    deck with body-colour fender tops, black sill and rear quarter, HUNGRY JACK'S splitter, BUILDING TRUST under
    the bow tie, Industrial Batteries panels, red wing endplates. #18: full-door DEWALT, smoky edge to the black
    quarter, HINO plates, Cub Cadet, white FUCHS bonnet. #20: worn SNOWY RIVER / CARAVANS lettering, a white
    mountain-ridge slash into the black quarter, TOYOTA FORKLIFTS, TRADIE, Snowy River bonnet, red KENWORTH wing."""
    blk, wht = '#141414', '#f4f4f2'
    f, r = A.f, A.r
    snowy = brand != 'dewalt'

    def edge(y):                       # #20: front edge of the white slash (leans back towards the roof)
        return -.42 - .45 * (y - .3)

    def base(x, y, z, view):
        c = fill(x.shape, main)
        if view in ('left', 'right'):
            if snowy:
                e = edge(y)
                ridge = e + .07 * np.sin(y * 23) + .04 * np.sin(y * 57 + 1)        # jagged mountain ridge
                back = e - .34 + .05 * np.sin(y * 31 + 2)
                c = lay(c, ((z < ridge) & (z > back)).astype(np.float32), wht)
                peaks = back + .1 + .09 * np.abs(np.sin(y * 9 + .5)) + .03 * np.sin(y * 41)
                c = lay(c, ((z > back) & (z < peaks)).astype(np.float32), '#9aa3a7')   # grey mountains
                shard = (z >= ridge) & (z < ridge + .14) & (np.sin((z * 1.3 + y) * 34) > .35)
                c = lay(c, shard.astype(np.float32), '#c3cacd')
                c = lay(c, (z <= back).astype(np.float32), blk)
                for k, off in ((0, .33), (1, .43)):                                   # teal streaks low on the quarter
                    c = lay(c, ((z < back - .05) & (z > back - .7) & (np.abs(y - off - .22 * (z - back)) < .012)).astype(np.float32), main)
            else:
                c = lay(c, grunge(z, y, -.62, .05, .1) * .55, blk)                     # smoke drifting onto the door
                c = lay(c, grunge(z, y, -.74, .05, .3, seed=11), blk)                  # smoky edge of the black quarter
                c = lay(c, ((z < -2.12) & (y > .72)).astype(np.float32), main)           # tail panel wraps the corner
                c = lay(c, band(y, .779, .821) * band(z, .8, 1.32), blk)                  # DEWALT bars run on along the guard
                c = lay(c, band(y, .349, .391) * band(z, .8, 1.08), blk)
            c = lay(c, np.clip((.27 - y) / .04 + .5, 0, 1) * (1 - .3 * grunge(-y * 4, z, 0, 0, 1.5, 7)), blk)   # sill
            c = lay(c, band(z, 2.2, 9) * band(y, .505, .7), blk)                         # nose corners beside the headlights
            c = lay(c, band(z, .25, .6) * band(y, .94, 1.12), '#d8262c')                  # red mirrors
        if view == 'top':
            c = fill(x.shape, blk)
            c = lay(c, (np.abs(x) > .74) * band(z, .55, 9), main)                    # fender tops
            c = lay(c, (np.abs(x) > .6) * band(z, -.55, .55), main)                  # roof rails
            c = lay(c, band(z, -9, -2.36), main)                                     # tail crease under the lamps
        if view == 'front':
            c = lay(c, band(y, .505, 9), blk)                                        # black band under the headlights
            c = lay(c, band(np.abs(x), -1, .42) * band(y, .2, 9), blk)
            c = lay(c, band(y, -1, .17), blk)
        if view == 'rear':
            c = lay(c, band(y, -1, .7), blk)
        return c
    A.paint(base)
    A.soft = None                      # every mark exactly where the photos have it
    A.endplate = '#d8262c'
    ib = text('', lines=[('Industrial', 1), ('Batteries', 1)], font='Montserrat', weight=800, px=120, fill='#ffffff')
    fuchs = logo('fuchs').crop((0, 0, 1460, 1230))
    kw_badge = logo('kenworth-53a6f510ec').crop((0, 0, 118, 128))
    hj = plate(text("HUNGRY JACK'S", 'ArchivoBlack-Regular', 160, '#ffffff', track=.04), '#d71e28', pad=.25, radius=.1)
    bt = row(triangle(), text('BUILDING TRUST', 'ArchivoBlack-Regular', 120, '#f26b21', track=.03), triangle(), gap=.35)
    A.bonnet(bt, 2.485, .026, maxw=.46)
    A.put('front', hj, 0, .1, .06, maxw=1.0)
    A.put('sides', triangle('#f26b21', 200), f + .55, .66, .08, maxw=.1)
    A.roof(text('Industrial Batteries', 'Montserrat', 160, '#ffffff', weight=800), .45, .08, maxw=.8)
    # side detail as raced: series partners along the black sill, team partners on the black C-pillar
    sill = [recol(logo('repco'), '#ffffff'), logo('dunlop'), text('Industrial Batteries', 'Montserrat', 160, '#ffffff', weight=800)]
    for zc, im in zip((.62, .12, -.38), sill):
        A.put('sides', im, zc, .21, .05, maxw=.42)
    A.put('sides', recol(fuchs, '#ffffff'), -1.2, 1.0, .08, maxw=.2)
    A.put('sides', plate(text('JAX', 'ArchivoBlack-Regular', 160, '#141414'), '#f6c800', pad=.15, radius=.1), -1.48, .96, .05, maxw=.2)
    if not snowy:
        hino = hino_badge()
        dw = key_out(logo('4ed2777886'), '#fcbd12')                       # black letters and bars on the body yellow
        dw = dw.resize((dw.width, int(dw.height * 1.3)), Image.LANCZOS)    # as raced: taller than the stock logo
        A.put('sides', dw, .13, .585, .53, maxw=1.5)
        A.put('sides', hino, -1.12, .8, .17, maxw=.7)
        A.put('sides', plate(recol(logo('cocacola'), '#ffffff'), '#e41e2b', pad=.2, radius=.2), 1.15, .8, .1, maxw=.45)
        cub = recol(key_out(logo('cubcadet').crop((60, 195, 560, 300)), '#ffffff', 200), main)
        A.put('sides', cub, -2.12, .44, .08, maxw=.28)
        A.put('sides', plate(row(ib, recol(fuchs, '#ffffff')), blk, pad=.2, radius=.15), f + .63, .36, .14, maxw=.45)
        fw = recol(fuchs, '#ffffff')
        fw = fw.resize((int(fw.width * 1.7), fw.height), Image.LANCZOS)        # stretched across the bonnet, as raced
        A.bonnet(fw, 1.75, .62, maxw=1.45)
        A.bonnet(logo('4ed2777886'), 2.27, .055, maxw=.36)
        for s in (-1, 1):
            A.put('front', hino, s * .7, .47, .055, maxw=.28)
        A.put('top', recol(dw, main), -1.05, 0, .12, maxw=.7, rot=-90)          # roof tail, reads from behind
        A.put('rear', dw, 0, .875, .085, maxw=.55)
        A.put('rear', hino, -.35, .57, .13, maxw=.5)
        A.put('rear', recol(fuchs, '#ffffff'), .12, .57, .09)
        A.put('rear', text('Taubmans', 'KaushanScript-Regular', 160, '#ffffff'), .42, .62, .05, maxw=.3)
        A.put('rear', text('WAVERLEY FORK LIFTS', 'ArchivoBlack-Regular', 120, '#ffffff'), -.35, .45, .03, maxw=.45)
    else:
        ink = '#161616'
        word = lambda t, c, px=200, tr=.1, amt=.04, st=1.0: distress(text(t, 'ArchivoBlack-Regular', px, c, track=tr), amt, stretch=st)
        A.put('sides', word('SNOWY RIVER', ink, st=2.0), .08, .68, .33, maxw=1.42)
        A.put('sides', word('CARAVANS', ink, 120, .45, st=1.3), .1, .44, .1, maxw=1.1)
        toy = logo('toyota')
        em = recol(toy.crop((0, 0, int(toy.height * 1.55), toy.height)), '#ffffff')
        tw = recol(toy.crop((int(toy.height * 1.55), 0, toy.width, toy.height)), '#ffffff')
        fk = plate(text('FORKLIFTS', 'ArchivoBlack-Regular', 120, ink, track=.06), wht, pad=.18, radius=.05)
        top = row(em.crop(em.getbbox()), tw.crop(tw.getbbox()), gap=.2)
        stack = Image.new('RGBA', (max(top.width, fk.width), top.height + fk.height + 20), (0, 0, 0, 0))
        stack.alpha_composite(top, (0, 0))
        stack.alpha_composite(fk, (stack.width - fk.width, top.height + 20))
        A.put('sides', stack.rotate(6, expand=True, resample=Image.BICUBIC), -1.4, .79, .3, maxw=1.0)
        A.put('sides', distress(text('TRADIE', 'ArchivoBlack-Regular', 200, ink, slant=.2), .03), 1.1, .8, .13, maxw=.5)
        A.put('sides', plate(row(ib, kw_badge), blk, pad=.2, radius=.15), f + .63, .36, .14, maxw=.45)
        sr = logo('e25c0e6ab0')
        mtn = sr.crop((0, 0, int(sr.height * 1.0), sr.height))
        A.bonnet(mtn.crop(mtn.getbbox()), 1.85, .45, maxw=.9)
        A.bonnet(word('SNOWY RIVER', '#ffffff', tr=.15), 2.2, .12, maxw=1.22)
        A.bonnet(word('CARAVANS', '#ffffff', 120, .45), 2.33, .05, maxw=.7)
        coke = plate(recol(logo('cocacola'), '#ffffff'), '#c81e2b', pad=.2, radius=.2)
        for s in (-1, 1):
            A.put('front', kw_badge, s * .7, .47, .055)
        A.put('rear', word('SNOWY RIVER', ink, tr=.12), 0, .905, .055, maxw=.65)
        A.put('rear', word('CARAVANS', ink, 120, .45), 0, .855, .025, maxw=.3)
        A.put('rear', text('Taubmans', 'KaushanScript-Regular', 160, '#ffffff'), -.2, .62, .05, maxw=.3)
        A.put('rear', text('WAVERLEY FORK LIFTS', 'ArchivoBlack-Regular', 120, '#ffffff'), .05, .46, .03, maxw=.45)
        A.wingcol = '#d8262c'
        A.wing(logo('kenworth-53a6f510ec'), .2, maxw=1.3)
    A.exact = True           # the photos' own sponsor set only


def L_dewalt(A, kind):
    """Team 18 #18 DEWALT Camaro (riley/9_t18_18)."""
    L_team18(A, kind, '#e39006', 'dewalt')


def L_snowyriver(A, kind):
    """Team 18 #20 Snowy River Caravans Camaro (riley/10_t18_20)."""
    L_team18(A, kind, '#1cb8b1', 'snowy')


def L_rjbatteries(A, kind):
    """WAU #8 R&J Batteries Supra (refs rjbatteries/01-02): white front half, navy tail half, a broad red slash
    with a white pinstripe between them, R&J Batteries on the doors, FUCHS on the navy quarter."""
    wht, red, navy = '#f3f4f5', '#e2231f', '#14213f'

    def base(x, y, z, view):
        c = fill(x.shape, wht)
        if view in ('left', 'right'):
            lean = (y - .2) * .45                                           # the slash leans forward at the top
            c = lay(c, ss(-.3 + lean + .01, -.3 + lean - .01, z) * band(y, .12, .95), red)
            c = lay(c, ss(-.86 + lean * .4 + .01, -.86 + lean * .4 - .01, z), wht)
            c = lay(c, ss(-.9 + lean * .4 + .01, -.9 + lean * .4 - .01, z), navy)
            c = lay(c, band(y, -1, .12), navy)
            c = lay(c, band(y, .12, .2) * band(z, A.f + .35, 9), red)        # red front lip
        if view == 'top':
            c = lay(c, band(z, -9, -.35), navy)
            c = lay(c, band(z, A.f - 1.1, 9) * band(np.abs(x), -1, .62), navy)
            c = lay(c, band(z, -.42, -.35), red)
        if view == 'rear':
            c = fill(x.shape, navy)
            c = lay(c, band(y, -1, .16), red)
        if view == 'front':
            c = lay(c, band(y, -1, .16), red)
            c = lay(c, band(y, .55, 9), navy)
        return c
    A.paint(base)
    rj = logo('3317885a69')
    A.put('sides', rj, .38, .52, .32, maxw=1.35)
    A.put('sides', recol(logo('fuchs'), '#ffffff'), -1.75, .58, .3, maxw=.75)
    A.put('sides', recol(logo('trico'), '#14213f'), A.f + .1, .72, .1, maxw=.7)
    A.put('sides', recol(logo('tgr'), '#ffffff'), -1.2, .86, .05, maxw=.3)
    A.bonnet(recol(logo('fuchs'), '#ffffff'), A.f + .45, .3, maxw=.5)
    A.roof(logo('2a6304aceb'), .1, .3, maxw=.6)
    A.wingtop(recol(logo('mack'), '#ffffff'), -2.2, .1, maxw=1.0)
    A.put('front', logo('tgr'), 0, .45, .05)
    A.put('front', rj, .5, .3, .06)
    A.put('rear', recol(logo('fuchs'), '#ffffff'), 0, .8, .08)


def L_dare(A, kind):
    """BJR #14 Dare Iced Coffee Supra (refs dare/10): navy black, a copper brown band through the middle,
    tan lower bumpers, dare roundel and FIX'LL FIX IT on the doors."""
    blk, brown, copper, tan = '#15131a', '#5a3524', '#a8643a', '#d6b48a'

    def base(x, y, z, view):
        c = fill(x.shape, blk)
        if view == 'top':
            c = lay(c, band(z, A.f - 1.4, A.f - .5) * band(np.abs(x), -1, .45), brown)
        if view in ('front', 'rear'):
            c = lay(c, band(y, -1, .18), tan)
        return c
    A.paint(base)
    A.photo('dare/10', [(427, 811), (1013, 784), (427, 736), (1013, 715)], tyre=.33)
    A.trace([blk, brown, copper, tan], belt=.92, erase=[],
            outline=[(225, 800), (240, 680), (300, 640), (450, 610), (560, 590), (640, 550), (800, 545), (950, 570), (1050, 600), (1070, 660), (1070, 760), (1000, 780), (900, 790), (500, 800), (300, 820)])
    d = logo('f4713fdf29')
    A.plogo(d, 688, 763, 101)
    A.plogo(crop('dare/10', (789, 670, 930, 784), tol=50, keep=['#f2f2f2', '#2a1a14']), 860, 727, 110)                 # FIX'LL FIX IT
    A.plogo(crop('dare/10', (971, 668, 1099, 697), tol=60), 1035, 682, 28)                # AS Automotive Superstore
    A.plogo(crop('dare/10', (389, 689, 523, 711), tol=60), 456, 700, 20)                  # Weathermate
    A.bonnet(d, A.f + .3, .42, maxw=.8)
    A.roof(crop('dare/10', (971, 668, 1099, 697), tol=60), -.5, .12, maxw=.8)
    A.wingtop(logo('cc604486c7'), -2.2, .1, maxw=.8)
    A.put('front', logo('tgr'), 0, .55, .05)
    A.put('front', d, .45, .32, .07)
    A.put('rear', d, 0, .8, .12)


def L_alphatheta(A, kind):
    """BJR #96 AlphaTheta Supra (refs alphatheta/01): white, purple and teal brush strokes from the door back,
    black tail. The AlphaTheta wordmark is cut from the reveal photo (no logo file exists)."""
    wht, pur, teal, blk = '#f2f3f6', '#7a3dc2', '#2cc2b6', '#15151a'

    def base(x, y, z, view):
        c = fill(x.shape, wht)
        if view == 'rear':
            c = fill(x.shape, blk)
            c = lay(c, band(y, -1, .2), teal)
        if view == 'top':
            c = lay(c, band(z, -9, -1.6), blk)
        if view == 'front':
            c = lay(c, band(y, -1, .16), teal)
        return c
    A.paint(base)
    A.photo('alphatheta/01', [(373, 805), (1173, 811), (373, 725), (1173, 731)], tyre=.33)
    word = crop('alphatheta/01', (632, 682, 952, 752), ink='#141414')
    wa = np.asarray(word).copy()
    wa[int(wa.shape[0] * .83):] = 0                                       # tagline scraps under the wordmark
    wa[int(wa.shape[0] * .55):, int(wa.shape[1] * .9):] = 0                # a corner of the stripe
    word = Image.fromarray(wa)
    word = word.crop(word.getbbox())
    A.trace([wht, pur, teal, blk], belt=.92, erase=[(629, 683, 960, 779), (496, 712, 608, 821), (288, 657, 440, 687)], allow={3: (-9, -1.0), 1: (-9, 1.2), 2: (-9, .2)},
            outline=[(180, 800), (185, 650), (230, 620), (400, 560), (540, 540), (650, 480), (800, 465), (1000, 480), (1200, 520), (1270, 560), (1300, 640), (1300, 780), (1200, 800), (1000, 820), (450, 820), (250, 830)])
    A.poly('sides', [(.6, .4), (-.25, .4), (-.25, .1), (.75, .1)], wht)       # the dark sill in the photo is shadow
    A.poly('sides', [(1.65, .12), (-1.0, .12), (-1.0, 0), (1.65, 0)], blk)
    A.plogo(word, 795, 731, 96)
    word.save(os.path.join(ROOT, 'assets/s26/alphatheta_logo.png'))           # also the menu/dash logo
    A.plogo(crop('alphatheta/01', (288, 657, 440, 687), tol=60), 364, 672, 26)            # Sydney City Toyota
    A.bonnet(word, A.f + .3, .2, maxw=1.0)
    A.roof(word, -.4, .14, maxw=.9)
    A.wingtop(recol(word, '#ffffff'), -2.2, .1, maxw=1.0)
    A.put('front', logo('tgr'), 0, .55, .05)
    A.put('rear', recol(word, '#ffffff'), 0, .8, .07)


def outline(im, col='#ffffff', w=.06):
    """A solid outline round a mark (w = thickness as a fraction of its height), like the cut-vinyl borders."""
    from scipy import ndimage
    p = max(2, int(im.height * w))
    a = np.asarray(im).astype(np.float32)
    big = np.zeros((a.shape[0] + 2 * p, a.shape[1] + 2 * p, 4), np.float32)
    big[p:-p, p:-p] = a
    yy, xx = np.mgrid[-p:p + 1, -p:p + 1]
    ring = ndimage.grey_dilation(big[..., 3], footprint=(xx ** 2 + yy ** 2) <= p * p)
    out = np.zeros_like(big)
    out[..., :3] = hexc(col)
    out[..., 3] = ring
    o = Image.fromarray(out.astype(np.uint8))
    o.alpha_composite(Image.fromarray(big.astype(np.uint8)))
    return o


def stack(*ims, gap=.12, align='c'):
    """Marks one above the other (gap as a fraction of the tallest)."""
    g = int(max(i.height for i in ims) * gap)
    W = max(i.width for i in ims)
    out = Image.new('RGBA', (W, sum(i.height for i in ims) + g * (len(ims) - 1)), (0, 0, 0, 0))
    y = 0
    for i in ims:
        out.alpha_composite(i, ((W - i.width) // 2 if align == 'c' else 0, y))
        y += i.height + g
    return out


def tyrepower(word='#ffffff'):
    """Tyrepower: the yellow / red swirl roundel and the word in a rounded sans."""
    from PIL import ImageDraw
    n = 240
    ring = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(ring)
    d.ellipse((0, 0, n - 1, n - 1), fill='#ffffff')
    d.pieslice((0, 0, n - 1, n - 1), 110, 300, fill='#f5b80c')
    d.pieslice((0, 0, n - 1, n - 1), 300, 470, fill='#e3262a')
    d.ellipse((34, 30, n - 30, n - 40), fill='#ffffff')
    d.ellipse((56, 50, n - 56, n - 62), fill='#1d3da8')
    t = text('Tyrepower', 'Montserrat', 200, word, weight=700)
    return row(ring.resize((int(t.height * 1.25),) * 2, Image.LANCZOS), t, gap=.2)


def ss_signs():
    ss = outline(text('SS', 'ArchivoBlack-Regular', 200, '#2a6fd6', slant=.22), '#ffffff', .05)
    sg = outline(text('SIGNS', 'ArchivoBlack-Regular', 200, '#ffffff', slant=.22, track=.02), '#1b2c8c', .05)
    return row(ss, sg, gap=.05)


def retra(fill='#d8262c'):
    return plate(text('retraVision.com.au', 'Montserrat', 120, '#ffffff', weight=800, slant=.12), fill, pad=.25, radius=.1)


def unit_plate(ink='#1b2c8c'):
    return plate(text('UNIT', 'ArchivoBlack-Regular', 140, ink, track=.12), '#ffffff', pad=.2, radius=.08)


def bruce_rock(c='#ffffff'):
    return stack(text('Bruce Rock', 'KaushanScript-Regular', 200, c), text('ENGINEERING', 'Michroma-Regular', 70, c, track=.15), gap=.05)


def L_msr(A, kind, car):
    """Matt Stone Racing Camaros from Riley's photos (msr/10_*, 4_*; reveal 02 / 05 for the noses), placed on the
    measured Camaro map with photo -> (z, y) conversions from the wheel centres. #10 Bendix: sky blue, black rear
    quarter and a black shard panel behind a huge outlined Bendix, black sill with the red retraVision stripe,
    black bonnet, TRUCK ASSIST on a black wing. #4 Sherrin: orange front, blue tail behind a fan of red speed
    stripes, blue sill with a red pinstripe, outlined SHERRIN / Rentals, Tyrepower on the blue quarter."""
    f, r = A.f, A.r
    blk, wht, red = '#16181d', '#f4f4f2', '#d8262c'
    bendix = car == 10
    if bendix:
        main = '#1aa0d6'

        def quarter_edge(y):        # front edge of the black rear quarter, leaning back down to the arch
            return np.where(y > .95, -.56, -.66 - 1.2 * (1.0 - y))

        def base(x, y, z, view):
            c = fill(x.shape, main)
            if view in ('left', 'right'):
                low = np.interp(z, [-9, -1.8, -1.6, 9], [.82, .82, .62, .62])
                c = lay(c, ((z < quarter_edge(y)) & (y > low)).astype(np.float32), blk)
                c = lay(c, ((z < -1.7) & (y < .46)).astype(np.float32), blk)                  # rear bumper bottom
                c = lay(c, ((z > -1.75) & (z < -.85) & (y < .7) & (np.hypot(z + 1.3, (y - .34) * 1.05) < .5)).astype(np.float32), blk)
                for k, (z0, y0) in enumerate(((-1.0, .74), (-1.15, .7), (-.9, .8))):          # blue shards in the black
                    t = np.clip((z0 - z) / .75, 0, 1)
                    c = lay(c, ((z < z0) & (z > z0 - .75) & (np.abs(y - y0 - .09 * (z0 - z)) < .012 * (1 - t) + .002)).astype(np.float32), main)
                # black shard panel behind the door lettering
                plate_pts = [(-.97, .935), (-.1, .9), (.88, .83), (1.1, .72), (.94, .64), (1.02, .52), (.88, .45), (-.82, .40)]
                A_poly = poly_mask(z, y, plate_pts)
                c = lay(c, A_poly, blk)
                for z0, y0, ln in ((-.92, .87, .55), (-.86, .5, .45), (.55, .46, .4)):          # blue slivers cut into it
                    t = np.clip((z - z0) / ln, 0, 1)
                    c = lay(c, ((z > z0) & (z < z0 + ln) & (np.abs(y - y0 + .03 * (z - z0)) < .016 * (1 - t))).astype(np.float32), main)
                sill = ((y < .40) & (z > -1.0) & (z < .95)) | ((y < .30) & (z > -1.0) & (z < 1.45)) | ((z > 1.9) & (y < .36))
                c = lay(c, sill.astype(np.float32), blk)
                rs = band(y, .205, .25) * np.clip((z + .72) / .05, 0, 1) * np.clip((.6 - z) / .25, 0, 1)
                c = lay(c, rs, red)
            if view == 'top':
                c = lay(c, (np.abs(x) < .74) * band(z, .55, 9), blk)                      # black bonnet and nose band
                c = lay(c, (np.abs(x) > .6) * band(z, -9, -.6) * band(z, -2.36, 9), blk)    # quarter tops
                c = lay(c, band(z, -9, -1.9), blk)                                        # deck and the crease under the lamps
                for k, xs in enumerate((-.62, .62)):                                       # blue shards at the bonnet edge
                    s = np.sign(xs)
                    c = lay(c, ((np.abs(x - xs + s * .12 * (z - .7)) < .02) & (z > .7) & (z < 1.5)).astype(np.float32), main)
            if view == 'front':
                c = lay(c, band(y, .505, 9), blk)
                c = lay(c, band(np.abs(x), -1, .42) * band(y, .2, 9), blk)
                c = lay(c, band(np.abs(x), .42, 9) * band(y, -1, .36), blk)
                c = lay(c, band(y, -1, .17), blk)
                c = lay(c, band(np.abs(x), .45, 9) * band(y, -1, .17), red)
                c = lay(c, band(np.abs(x), .4, .44) * band(y, .2, .5), '#e8e8e8')          # white grille surround
            if view == 'rear':
                c = lay(c, band(y, -1, .4), blk)
                c = lay(c, band(np.abs(x), -1, .37) * band(y, -1, .66), blk)
                c = lay(c, band(np.abs(x), -1, .5) * band(y, .7, .795), blk)
                c = lay(c, band(y, .95, 9), blk)                                          # boot spoiler
            return c
    else:
        main, blu = '#e8890f', '#1d3da8'

        def zl(y):                  # the blue tail's front edge (the speed stripes run parallel to it)
            return -.545 + (y - .986) / .53

        def ys(z):                  # top of the blue sill
            return np.where(z > 2.0, .265, .345 - .05 * (z + .4))

        def base(x, y, z, view):
            c = fill(x.shape, main)
            if view in ('left', 'right'):
                dz = z - zl(y)
                c = lay(c, ((dz < 0) | (z < -1.65)).astype(np.float32), blu)
                c = lay(c, ((dz >= 0) & (dz < .1)).astype(np.float32), red)
                for k in range(7):
                    a0 = .16 + .085 * k
                    w = .05 * (1 - k / 8)
                    c = lay(c, ((dz > a0) & (dz < a0 + w) & (y > .3)).astype(np.float32), red)
                s = ys(z)
                c = lay(c, (y < s + .014).astype(np.float32), red)
                c = lay(c, (y < s).astype(np.float32), blu)
                rs = band(y, .185, .235) * np.clip((z + .8) / .04, 0, 1) * np.clip((.6 - z) / .2, 0, 1)
                c = lay(c, rs, red)
                c = lay(c, band(z, 2.15, 9) * band(y, -1, .2), red)
            if view == 'top':
                zr = -1.05
                c = lay(c, band(z, -9, zr), blu)
                c = lay(c, band(z, zr, zr + .08), red)
                for k in range(5):
                    a0 = zr + .14 + .07 * k
                    c = lay(c, band(z, a0, a0 + .035 * (1 - k / 6)), red)
                c = lay(c, (np.abs(x) > .6) * band(z, -9, -.6), blu)
                c = lay(c, band(z, 2.42, 9), blu)                                          # nose band
                c = lay(c, band(z, -9, -2.36), main)                                       # orange strip under the lamps
            if view == 'front':
                c = lay(c, band(y, .505, 9), blu)
                c = lay(c, band(np.abs(x), -1, .42) * band(y, .2, 9), blk)
                c = lay(c, band(np.abs(x), .38, .44) * band(y, .2, .5), red)               # red grille surround
                c = lay(c, band(y, -1, .27), blu)
                c = lay(c, band(y, .265, .28), red)
                c = lay(c, band(np.abs(x), .5, 9) * band(y, -1, .17), red)
            if view == 'rear':
                c = fill(x.shape, blu)
                c = lay(c, band(np.abs(x), -1, .5) * band(y, .7, .795), main)              # orange strip under the lamps
                c = lay(c, band(y, -1, .4), blk)
            return c
    A.paint(base)
    A.soft = None
    mont = lambda t, px=160, c='#ffffff', w=800, **k: text(t, 'Montserrat', px, c, weight=w, **k)
    daf_w = recol(logo('daf'), '#ffffff')
    for s in (-1, 1):
        A.put('top', daf_w, -2.2, s * .42, .05, maxw=.22, rot=-90)
    A.bonnet(tyrepower(), 2.512, .026, maxw=.6)      # the bar above the grille (only z 2.5-2.525 lands there alone)
    if bendix:
        A.endplate = red
        A.wingcol = blk
        orangeo = Image.new('RGBA', (200, 200), (0, 0, 0, 0))
        from PIL import ImageDraw
        ImageDraw.Draw(orangeo).ellipse((10, 10, 190, 190), outline='#f26b21', width=46)
        A.wing(row(orangeo, text('TRUCK ASSIST', 'ArchivoBlack-Regular', 200, '#ffffff', slant=.15), gap=.15), .12, maxw=1.4)
        bx = outline(logo('90cbdec9f0'), blk, .07)
        A.put('sides', bx, -.03, .665, .38, maxw=1.78)
        A.put('sides', mont('TRICO', 200, track=.06), -1.52, .935, .14, maxw=.64)
        A.put('sides', mont('SUPERIOR', 120, w=900), -1.2, 1.13, .04, maxw=.33)
        A.put('sides', daf_w, -.6, .32, .055, maxw=.25)
        A.put('sides', mont('ORAFOL', 120), -.25, .315, .03, maxw=.17)
        A.put('sides', unit_plate('#16181d'), 0.0, .315, .04, maxw=.14)
        A.put('sides', text('retraVision.com.au', 'Montserrat', 120, '#ffffff', weight=800, slant=.12), -.1, .228, .028, maxw=.52)
        A.put('sides', recol(logo('repco'), '#ffffff'), 1.42, .21, .035, maxw=.25)
        A.put('sides', stack(mont('C', 200, w=900), mont('coregas', 80, w=600), gap=.05), 1.07, .79, .1, maxw=.18)
        A.put('sides', mont('Sullivans', 120, w=700), 1.07, .62, .04, maxw=.26)
        A.put('sides', stack(mont('PROCUREMENT', 80), mont('DIRECT', 80)), 1.07, .52, .06, maxw=.24)
        A.put('sides', mont('CAMELBAK', 110, w=900), 1.07, .42, .035, maxw=.25)
        A.put('sides', mont('TractiX', 120, w=700), 1.9, .8, .04, maxw=.25)
        A.put('sides', text('Wodens', 'Montserrat', 140, '#ffffff', weight=800), -1.93, .44, .05, maxw=.3)
        A.bonnet(logo('90cbdec9f0'), 2.02, .2, maxw=1.3)
        for s in (-1, 1):
            A.put('front', mont('MGMBULK', 160, '#141414', 900), s * .6, .47, .035, maxw=.27)
        A.put('rear', ss_signs(), 0, .905, .045, maxw=.45)
        A.put('rear', logo('90cbdec9f0'), 0, .757, .03, maxw=.36)      # the strip just under the lamps
        A.put('rear', bruce_rock(), 0, .53, .13, maxw=.56)
        for s in (-1, 1):
            A.put('rear', mont('AFFINITY', 120, w=700), s * .58, .62, .035, maxw=.28)
            A.put('rear', mont('TRIPLE M', 160, w=900), s * .58, .52, .05, maxw=.3)
            A.put('rear', unit_plate('#16181d'), s * .45, .33, .035, maxw=.15)
    else:
        A.endplate = wht
        A.wingcol = blu
        A.wing(daf_w, .1, maxw=.6)
        sh = outline(text('SHERRIN', 'ArchivoBlack-Regular', 260, '#141414'), '#ffffff', .07)
        rn = outline(text('Rentals', 'ArchivoBlack-Regular', 260, '#e3262a'), '#ffffff', .07)
        A.put('sides', sh.resize((sh.width, int(sh.height * 1.15)), Image.LANCZOS), .11, .724, .33, maxw=1.56)
        A.put('sides', rn, .10, .473, .29, maxw=1.08)
        A.put('sides', tyrepower(), -1.4, .875, .14, maxw=.84)
        A.put('sides', stack(mont('PCA', 200, w=900, slant=.1), mont('PUMP CONTROLLERS', 60, w=700), gap=.05), -1.19, 1.12, .1, maxw=.4)
        A.put('sides', mont('AUSPT', 160, w=900), -1.89, .42, .06, maxw=.25)
        A.put('sides', daf_w, -.77, .313, .048, maxw=.27)
        A.put('sides', mont('ORAFOL', 120), -.355, .298, .03, maxw=.17)
        A.put('sides', unit_plate(), -.115, .286, .042, maxw=.15)
        A.put('sides', text('retraVision.com.au', 'Montserrat', 120, '#ffffff', weight=800, slant=.12), -.3, .21, .028, maxw=.5)
        A.put('sides', recol(logo('repco'), '#ffffff'), 1.0, .21, .035, maxw=.23)
        A.put('sides', stack(mont('EverythingFleet', 160, blu, 700), mont('CAR & TRUCK RENTALS', 70, blu, 700), gap=.05), 1.52, .826, .09, maxw=.63)
        A.put('sides', stack(mont('C', 200, '#141414', 900), mont('coregas', 80, '#141414', 600), gap=.05), 1.04, .73, .12, maxw=.16)
        A.put('sides', mont('AUSPT', 160, '#141414', 900), 1.04, .59, .05, maxw=.22)
        A.put('sides', stack(mont('( - )', 160, '#141414', 900), mont('wake up!', 90, '#141414', 700), gap=.05), 1.04, .46, .12, maxw=.2)
        A.put('sides', logo('bic'), 2.1, .4, .1, maxw=.25)
        A.bonnet(sh, 1.93, .12, maxw=1.1)
        A.bonnet(rn, 2.14, .1, maxw=.78)
        for s in (-1, 1):
            A.put('front', mont('MGMBULK', 160, '#141414', 900), s * .6, .47, .035, maxw=.27)
        A.put('rear', ss_signs(), 0, .9, .06, maxw=.5)
        A.put('rear', row(text('SHERRIN', 'ArchivoBlack-Regular', 200, '#141414'), text('Rentals', 'ArchivoBlack-Regular', 200, '#e3262a')), 0, .757, .03, maxw=.5)
        A.put('rear', plate(bruce_rock('#141414'), '#ffffff', pad=.15, radius=.15), 0, .54, .12, maxw=.52)
        for s in (-1, 1):
            A.put('rear', mont('wake up!', 140, w=700), s * .58, .62, .04, maxw=.28)
            A.put('rear', mont('TRIPLE M', 160, w=900), s * .58, .52, .05, maxw=.3)
            A.put('rear', unit_plate(), s * .45, .33, .035, maxw=.15)
    A.exact = True


def poly_mask(z, y, pts):
    """0/1 mask of a polygon given in (z, y) metres, evaluated on a side view's coordinate grid (z runs
    linearly along columns, y along rows)."""
    from PIL import ImageDraw
    h, w = z.shape
    z0, z1, y0, y1 = z[0, 0], z[0, -1], y[0, 0], y[-1, 0]
    q = [((a - z0) / (z1 - z0) * (w - 1), (b - y0) / (y1 - y0) * (h - 1)) for a, b in pts]
    mk = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mk).polygon(q, fill=255)
    return (np.asarray(mk) > 127).astype(np.float32)


def L_sherrin(A, kind):
    """Matt Stone Racing #4 Sherrin Rentals Camaro (refs msr/4_side, 4_rq, 02, 05)."""
    L_msr(A, kind, 4)


def L_bendix(A, kind):
    """Matt Stone Racing #10 Bendix Camaro (refs msr/10_side, 10_fq, 10_rear, 10_front)."""
    L_msr(A, kind, 10)


def view_px(vw, a, b):
    """Metres -> atlas pixels (x K) inside a view's region: sides (z, y), top (z, x), front/rear (x, y)."""
    if vw == 'left':
        u, v = (ZF - a) * S, (YT - b) * S
    elif vw == 'right':
        u, v = (a - ZB) * S, (YT - b) * S
    elif vw == 'top':
        u, v = (a - ZB) * S, (XL - b) * S
    elif vw == 'front':
        u, v = (a + XL) * S2, (YT - b) * S2
    else:
        u, v = (XL - a) * S2, (YT - b) * S2
    return u * K, v * K


def bolt_paths(seed, starts, length=1.2, step=.07, jag=.6, branch=.35):
    """Branching lightning: from each (a, b, angle) a jagged random walk with forks (metres, view plane)."""
    import math
    rng = np.random.default_rng(seed)
    out = []

    def walk(a, b, ang, n, w):
        pts = [(a, b)]
        for i in range(n):
            ang += rng.normal(0, jag)
            a += math.cos(ang) * step * rng.uniform(.5, 1.3)
            b += math.sin(ang) * step * rng.uniform(.5, 1.3)
            pts.append((a, b))
            if w > .35 and rng.random() < branch:
                walk(a, b, ang + rng.choice([-1, 1]) * rng.uniform(.5, 1.0), max(2, n // 3), w * .55)
        out.append((pts, w))
    for a, b, ang in starts:
        walk(a, b, ang, int(length / step), 1.0)
    return out


def lightning(A, views, paths, core='#ffffff', glow='#ffc4f0', width=.008, glow_w=.05, strength=.85):
    """Paint glowing lightning bolts (bolt_paths) on to the base paint of the given views."""
    from PIL import ImageDraw
    from scipy import ndimage
    for vw in views:
        u0, v0 = REGION[vw]
        w, h = SIZE[vw]
        s = S2 if vw in ('front', 'rear') else S
        mc = Image.new('L', (w * K, h * K), 0)
        mg = Image.new('L', (w * K, h * K), 0)
        dc, dg = ImageDraw.Draw(mc), ImageDraw.Draw(mg)
        for pts, wt in paths:
            q = [view_px(vw, a, b) for a, b in pts]
            dc.line(q, fill=255, width=max(1, int(width * wt * s * K)), joint='curve')
            dg.line(q, fill=255, width=max(2, int(width * 3 * wt * s * K)), joint='curve')
        g = ndimage.gaussian_filter(np.asarray(mg, np.float32) / 255, glow_w * s * K / 3)
        g = np.clip(g * 2.2, 0, 1)[..., None] * strength
        c = np.clip(ndimage.gaussian_filter(np.asarray(mc, np.float32) / 255, .7), 0, 1)[..., None]
        reg = self_reg = A.img[v0 * K:v0 * K + h * K, u0 * K:u0 * K + w * K]
        reg[:] = reg * (1 - g) + hexc(glow) * g
        reg[:] = reg * (1 - c) + hexc(core) * c


def middys_badge(blue='#2b3aa0', edge='#ffffff'):
    """Middy's omega-M mark as on the car: a blue ring round a blue omega with an M in it, edged in white."""
    from PIL import ImageDraw
    n = 400
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((10, 10, n - 11, n - 11), outline=blue, width=34)
    om = text('\u03a9', 'Montserrat', 300, blue, weight=800)
    om = om.resize((int(n * .6), int(n * .6 * om.height / om.width)), Image.LANCZOS)
    im.alpha_composite(om, ((n - om.width) // 2, (n - om.height) // 2 + 8))
    m = text('M', 'ArchivoBlack-Regular', 150, blue, slant=.12)
    m = m.resize((int(n * .26 * m.width / m.height), int(n * .26)), Image.LANCZOS)
    hole = Image.new('RGBA', (m.width + 24, m.height + 16), (0, 0, 0, 0))
    im.alpha_composite(m, ((n - m.width) // 2, (n - m.height) // 2 + 2))
    return outline(im, edge, .02) if edge else im


def middys_word(blue='#2b3aa0'):
    return outline(text("MIDDY'S", 'ArchivoBlack-Regular', 260, blue, slant=.18, track=.02), '#ffffff', .06)


def scg_logo():
    """Southern Contracting Group's SCG mark: heavy letters in orange, white and green, overlapping."""
    s_ = text('S', 'ArchivoBlack-Regular', 300, '#f39c1f')
    c_ = text('C', 'ArchivoBlack-Regular', 300, '#ffffff')
    g_ = text('G', 'ArchivoBlack-Regular', 300, '#59b947')
    W = int(s_.width * .8 + c_.width * .8 + g_.width)
    im = Image.new('RGBA', (W, s_.height + 60), (0, 0, 0, 0))
    im.alpha_composite(s_, (0, 0))
    im.alpha_composite(outline(c_, '#141416', .05), (int(s_.width * .72), 20))
    im.alpha_composite(outline(g_, '#141416', .05), (int(s_.width * .72 + c_.width * .78), 50))
    return im.crop(im.getbbox())


def hut_icon(c='#ffffff', px=400):
    """The Pizza Hut roof: a wide low roof with a raised ridge."""
    from PIL import ImageDraw
    im = Image.new('RGBA', (px, int(px * .45)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    w, h = px, im.height
    d.polygon([(0, h * .97), (w * .2, h * .38), (w * .33, h * .38), (w * .4, h * .03), (w * .6, h * .03),
               (w * .67, h * .38), (w * .8, h * .38), (w, h * .97)], fill=c)
    return im


def pizza_word(c='#141414'):
    """Pizza Hut's heavy brush script: Kaushan Script thickened with a same-colour stroke."""
    return outline(text('Pizza Hut', 'KaushanScript-Regular', 300, c), c, .045)


def pizza_disc(red='#e3171e', px=600):
    """Red Pizza Hut roundel with a thin white inner ring and the white roof."""
    from PIL import ImageDraw
    im = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, px - 1, px - 1), fill=red)
    d.ellipse((px * .07, px * .07, px * .93, px * .93), outline='#ffffff', width=int(px * .025))
    hut = hut_icon('#ffffff', int(px * .52))
    im.alpha_composite(hut, ((px - hut.width) // 2, int(px * .52 - hut.height / 2)))
    return im


def L_middys(A, kind):
    """BJR #14 Middy's Electrical Camaro from Riley's photos (bjr/14_side, 14_rear, 14_diecast): hot pink
    under white lightning, a black nose split from the pink by a lightning edge, blue sills with pink swooshes,
    the Middy's roundel and sloping MIDDY'S / ELECTRICAL on the doors, Southern Contracting Group bonnet, big
    Middy's roundel on the roof, MACK on a black wing. Side positions from the photo homography (A.photo)."""
    pink, blk, blue, wht = '#e8389f', '#141416', '#2b3aa0', '#f4f4f4'

    def edge(y):
        e = np.interp(y, [.6, .65, .84, .97, 2], [1.24, 1.2, 1.05, .86, .8])
        return e + .05 * np.abs(((y * 9) % 1) - .5)            # jagged lightning edge

    def yb(z):
        return np.interp(z, [-2.6, -1.9, -.91, .79, 1.3, 2.6], [.55, .5, .38, .31, .28, .28])

    def base(x, y, z, view):
        c = fill(x.shape, pink)
        if view in ('left', 'right'):
            b = yb(z)
            c = lay(c, (y < b).astype(np.float32), blue)
            for k, off in enumerate((.035, .075)):                    # pink swooshes through the blue
                c = lay(c, (np.abs(y - (b - off - .02 * (z + .9))) < .007).astype(np.float32) * (z < .6), pink)
            for k, off in enumerate((.04, .09)):                      # blue streaks rising into the pink
                yy = b + off + .045 * (-.3 - z)
                c = lay(c, ((np.abs(y - yy) < .012 * np.clip((z + 1.6) / 1.2, 0, 1)) & (z > -1.6) & (z < .2)).astype(np.float32), blue)
            black = ((y > .6) & (z > edge(y))) | (z > 1.9)
            c = lay(c, black.astype(np.float32), blk)
            c = lay(c, (band(z, 2.0, 9) * band(y, -1, .13)), pink)    # pink splitter ends
        if view == 'top':
            c = lay(c, band(z, .8, 9), blk)
            c = lay(c, band(z, 2.45, 9), blk)
        if view == 'front':
            c = fill(x.shape, blk)
            c = lay(c, band(y, .2, .245), pink)
        if view == 'rear':
            c = lay(c, band(y, -1, .45), blue)
        return c
    A.paint(base)
    starts = [(-2.2, .8, .3), (-1.6, .95, -.4), (-.9, .5, .1), (.1, .9, -.2), (.6, .4, .5), (-2.3, .55, 0), (.85, .97, -1.2), (1.1, .7, -1.4)]
    lightning(A, ('left', 'right'), bolt_paths(14, starts, 1.1))
    lightning(A, ('top',), bolt_paths(15, [(-1.9, .5, .6), (-1.2, -.6, 2.4), (-.6, .3, -1.2), (.2, -.4, 2.0), (-2.0, -.3, 1.2)], 1.0))
    lightning(A, ('rear',), bolt_paths(16, [(-.7, .9, -.3), (.7, .85, 3.4), (.2, .7, -1.0)], .6), glow_w=.03)
    A.soft = None
    rot = {'left': 8, 'right': -8}
    for vw in ('left', 'right'):
        A.put(vw, middys_badge(), -.79, .78, .27)
        A.put(vw, middys_word(), .06, .65, .22, maxw=1.36, rot=rot[vw])
        A.put(vw, text('ELECTRICAL', 'Montserrat', 160, wht, weight=700, track=.55), -.19, .44, .07, maxw=1.3, rot=rot[vw] * 1.35)
    mont = lambda t, px=160, c=wht, w=800, **k: text(t, 'Montserrat', px, c, weight=w, **k)
    A.put('sides', mont('TOPPS', 160, wht, 900), .92, .57, .05, maxw=.2)
    A.put('sides', stack(mont('SUMMIT', 140, wht, 800), mont('Fleet Leasing and Management', 50, wht, 600)), .93, .47, .06, maxw=.24)
    A.put('sides', stack(text('Lansvale', 'ArchivoBlack-Regular', 140, wht), text('Smash Repairs', 'KaushanScript-Regular', 110, '#f6c800')), .94, .37, .08, maxw=.24)
    A.put('sides', text('DUNLOP', 'ArchivoBlack-Regular', 120, wht, slant=.2), .95, .28, .033, maxw=.22)
    A.put('sides', recol(logo('repco'), wht), .95, .21, .032, maxw=.2)
    from PIL import ImageDraw
    ring = Image.new('RGBA', (200, 200), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((8, 8, 191, 191), outline='#e3262a', width=22)
    A.put('sides', row(ring, stack(mont('TRG', 180, wht, 700), mont('transport', 80, wht, 600)), gap=.1), 2.18, .5, .09, maxw=.3)
    A.put('sides', stack(mont('GLIDEROL', 160, wht, 800), mont('garage doors', 130, wht, 500)), 2.18, .35, .1, maxw=.3)
    A.put('sides', plate(mont('UNIT', 140, wht, 900, track=.1), blue, pad=.15, radius=.08), -1.9, .48, .045, maxw=.14)
    A.put('sides', mont('SPEEDFLOW', 120, wht, 900, slant=.15), -1.9, .4, .03, maxw=.2)
    # bonnet / roof / nose
    A.bonnet(scg_logo(), 1.62, .3, maxw=.6)
    A.bonnet(stack(mont('SOUTHERN', 160, '#f39c1f', 900), mont('CONTRACTING', 160, '#59b947', 900), mont('GROUP PTY LTD', 130, wht, 800), gap=.08), 2.02, .2, maxw=.7)
    A.bonnet(mont('coregas', 160, wht, 500), 2.26, .055, maxw=.4)
    A.bonnet(mont('HARE & FORBES', 160, wht, 900), 2.512, .022, maxw=.55)
    A.roof(middys_badge(edge='#ffffff'), -.35, .62, maxw=.62)
    A.roof(middys_word(), .33, .1, maxw=.7)
    # tail
    A.put('rear', outline(text('SUMMIT', 'ArchivoBlack-Regular', 200, '#8fd3f4'), '#1b2a6b', .05), 0, .9, .055, maxw=.5)
    A.put('rear', plate(row(middys_badge(), text("MIDDY'S", 'ArchivoBlack-Regular', 200, '#e8389f', slant=.18), gap=.12) if False else row(middys_badge('#e8389f', None), text("MIDDY'S", 'ArchivoBlack-Regular', 200, '#e8389f', slant=.18), gap=.12), blue, pad=.15, radius=.15, outline=wht, ow=.04), 0, .56, .1, maxw=.55)
    A.put('rear', recol(logo('cocacola'), wht), -.48, .62, .05, maxw=.25)
    A.put('rear', logo('ppg'), .48, .62, .06, maxw=.15)
    A.put('rear', plate(mont('UNIT', 140, '#141414', 900, track=.1), wht, pad=.15, radius=.08), -.48, .7, .035, maxw=.13)
    A.endplate = pink
    A.wingcol = blk
    A.wing(recol(logo('mack'), wht), .12, maxw=1.0)
    A.exact = True


def L_pizzahut(A, kind):
    """BJR #96 Pizza Hut Camaro from Riley's photos (bjr/96_fq, 96_diecast, 96_top): white; red roof with a
    white-ringed 96 roundel; a big red Pizza Hut roundel across the bonnet; the red Pizza Hut disc on the door
    and black Pizza Hut script on the rear door and quarter; a red swoosh with white pinstripes rising along
    the lower body; Fastron on the front guard; DRILLPRO on a black wing with red endplates."""
    wht, red, blk = '#f4f4f4', '#cc0f17', '#141414'

    def yr(z):                     # top edge of the lower red swoosh
        return np.interp(z, [-2.6, -1.7, -.6, .5, .95, 1.0], [.52, .5, .4, .3, .24, .0])

    def base(x, y, z, view):
        c = fill(x.shape, wht)
        if view in ('left', 'right'):
            t = yr(z)
            c = lay(c, ((y < t) & (y > t - .12)).astype(np.float32), red)
            for off in (.045, .08):
                c = lay(c, ((np.abs(y - (t - off)) < .006) & (z < .8)).astype(np.float32), wht)
            c = lay(c, ((y < .22) & (z > -1.1) & (z < 1.0)).astype(np.float32), red)
            c = lay(c, ((z < -1.85) & (y < .5)).astype(np.float32), red)
            c = lay(c, band(z, 2.0, 9) * band(y, -1, .13), red)
        if view == 'top':
            c = lay(c, band(z, -1.0, .55) * (np.abs(x) < .8), red)                   # red roof
            r = np.hypot(z - 1.55, x)
            c = lay(c, (r < .56).astype(np.float32), red)                             # bonnet roundel
            c = lay(c, (np.abs(r - .5) < .012).astype(np.float32), wht)
            rr = np.hypot(z + .25, x)
            c = lay(c, (np.abs(rr - .42) < .03).astype(np.float32), wht)              # roof roundel ring
        if view == 'front':
            c = lay(c, band(y, .2, .245), red)
        if view == 'rear':
            c = lay(c, band(y, -1, .45), red)
        return c
    A.paint(base)
    A.soft = None
    mont = lambda t, px=160, c=blk, w=800, **k: text(t, 'Montserrat', px, c, weight=w, **k)
    A.put('sides', pizza_disc(red), .22, .56, .6)
    for vw, r in (('left', 6), ('right', -6)):
        A.put(vw, pizza_word(), -1.12, .73, .32, maxw=1.45, rot=r)
    A.put('sides', stack(mont('PERTAMINA', 70, blk, 800), mont('Fastron', 200, blk, 700), mont('Synthetic Oil', 70, '#1b3a8c', 600), gap=.05), 1.4, .78, .17, maxw=.6)
    A.put('sides', mont('DesignEars', 110, blk, 700), .97, .44, .035, maxw=.2)
    A.put('sides', text('DUNLOP', 'ArchivoBlack-Regular', 120, blk, slant=.2), .97, .37, .033, maxw=.22)
    A.put('sides', logo('repco'), .97, .3, .03, maxw=.2)
    from PIL import ImageDraw
    ring = Image.new('RGBA', (200, 200), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((8, 8, 191, 191), outline=red, width=22)
    A.put('sides', row(ring, stack(mont('TRG', 180, blk, 700), mont('transport', 80, '#1b3a8c', 600)), gap=.1), 2.15, .52, .09, maxw=.3)
    A.put('sides', mont('Kubota', 200, blk, 700), 2.15, .38, .07, maxw=.3)
    A.put('sides', plate(mont('UNIT', 140, blk, 900, track=.1), wht, pad=.15, radius=.08, outline=red, ow=.08), 2.15, .1, .045, maxw=.14)
    A.put('sides', recol(logo('cocacola'), red), -2.05, .72, .07, maxw=.3)
    # bonnet roundel, roof 96
    pw = pizza_word(wht)
    A.bonnet(hut_icon(wht, 400), 1.33, .14, maxw=.45)
    A.bonnet(pw, 1.62, .26, maxw=.8)
    A.bonnet(mont('coregas', 160, blk, 500), 2.22, .06, maxw=.42)
    A.bonnet(mont('DRILLPRO', 160, blk, 900), 2.512, .022, maxw=.5)
    A.roof(text('96', 'ArchivoBlack-Regular', 300, wht), -.25, .4, maxw=.6)
    A.roof(hut_icon(wht, 400), .32, .1, maxw=.35)
    # tail
    A.put('rear', pizza_word(blk), 0, .9, .05, maxw=.45)
    A.put('rear', recol(logo('cocacola'), wht), 0, .56, .07, maxw=.4)
    A.put('rear', mont('Kubota', 200, wht, 700), -.5, .6, .05, maxw=.25)
    A.put('rear', mont('DRILLPRO', 160, wht, 900), .5, .6, .04, maxw=.25)
    A.endplate = red
    A.wingcol = blk
    A.wing(stack(mont('DRILLPRO', 200, wht, 900, track=.06), mont('S E R V I C E S', 80, '#5bc0eb', 700)), .14, maxw=1.1)
    A.exact = True


def L_chiko(A, kind):
    """Erebus #9 CHIKO Camaro from Riley's photos (erebus/9_side left flank at Sydney, 9_front34 right front,
    99chiko_model for the bonnet layout). The flanks are the track photo projected onto the body: orange-to-red
    fade with the big CHIKO oval on the doors, navy-black rear quarters with Snap-on, PLUMBTRAX on the front guard,
    lettering turned the right way round on the far flank. The right front guard is black with PEDDERS, TFH, BiC
    and SS SIGNS (9_front34). Black bonnet with the CHIKO oval at the nose and orange edge lines, black roof and
    tail, black erebus wing."""
    red, org, blk, wht, gold = '#e2381f', '#f08a2a', '#14161c', '#f4f2ee', '#e09a3a'
    A.soft = None

    def base(x, y, z, view):
        c = fill(x.shape, red)
        if view == 'top':
            c = lay(c, band(np.abs(x), -1, .62) * band(z, A.f - 1.15, 9), blk)             # black bonnet
            for sx in (-1, 1):
                edge = .62 + (z - A.f) * .02
                c = lay(c, ((np.abs(x) > edge) & (np.abs(x) < edge + .03)).astype(np.float32) * band(z, A.f - 1.1, A.f + .9), org)
            c = lay(c, band(z, -9, A.f - 1.15), blk)                                          # roof, deck
        if view == 'rear':
            c = fill(x.shape, blk)
            c = lay(c, band(y, -1, .42), red)
        if view == 'front':
            c = lay(c, band(y, -1, .2), blk)
        return c
    A.paint(base)
    A.photo('erebus/9_side2x', [(850, 668), (1565, 612), (850, 560), (1565, 520)], tyre=.34)
    import cv2
    ph = A.ph[0]                       # the track shot carries reflections: smooth them out, keep the paint edges,
    sm = ph.astype(np.uint8)           # and lift the colour a touch
    for _ in range(3):
        sm = cv2.bilateralFilter(sm, 9, 45, 9)
    sm = sm.astype(np.float32)
    m = sm.mean(-1, keepdims=True)
    ph[:] = np.clip(m + (sm - m) * 1.15, 0, 255)
    outline = [(540, 640), (545, 500), (640, 478), (800, 455), (1000, 445), (1060, 350), (1250, 318), (1420, 328),
               (1520, 348), (1640, 365), (1705, 410), (1730, 520), (1725, 640), (1700, 685), (1450, 700), (1000, 722),
               (780, 762), (560, 760)]
    glass = [[(1000, 400), (1080, 345), (1250, 330), (1400, 345), (1440, 400), (1420, 440), (1250, 445), (1050, 452)],
             [(1045, 425), (1175, 425), (1175, 505), (1045, 505)]]
    R1, R2, O1, N1 = '#d4421f', '#c8302a', '#e07a2a', '#1a1c22'
    decals = [((1058, 466, 1424, 664), [R1, R2, '#b82a2a', '#a8242c'], 70),                      # CHIKO oval
              ((1448, 436, 1664, 524), [N1, '#14161a', '#262830', '#30323a'], 80),                # Snap-on
              ((768, 496, 1012, 562), [R1, O1, '#d86028', '#e89040'], 75),                        # PLUMBTRAX
              ((958, 516, 1034, 722), [R1, R2, '#c03826'], 75),                                   # Marina / sponsor column
              ((1138, 676, 1242, 704), [N1, '#14161a', '#0c0c0c'], 70),                           # Snap-on (sill)
              ((1650, 536, 1724, 624), [N1, '#14161a', '#262830', '#8a2a34'], 75)]                # rear-quarter stickers
    A.project(outline, 'left', glass=glass, decals=decals, above=(1.2, blk), arch=.42)
    A.wrap = [(.55, 1.0, -2.4, -.5)]
    # the nose corners (the photo sees them head-on): red with the CHIKO and QUARTZ stickers, black lower intake
    def ends(x, y, z, view):
        c = fill(x.shape, red)
        c = lay(c, band(y, -1, .17), blk)
        return c
    A.over(ends, lambda x, y, z, view: np.clip((z - 1.9) / .06, 0, 1), views=('left',))
    ch = logo('57c38ba607')
    # the big door oval and the rear-quarter Snap-on laid back sharp over the photo's soft ones
    z0, y0 = A.from_photo(1062, 565)
    z1, _ = A.from_photo(1420, 565)
    _, yt = A.from_photo(1240, 470)
    _, yb = A.from_photo(1240, 662)
    A.put('sides', ch, (z0 + z1) / 2, (yt + yb) / 2, yt - yb, maxw=abs(z1 - z0))
    z0, y0 = A.from_photo(1455, 480)
    z1, y1 = A.from_photo(1658, 470)
    A.put('sides', text('Snap-on', 'ArchivoBlack-Regular', 200, wht, slant=.18), (z0 + z1) / 2, (y0 + y1) / 2, .12, maxw=abs(z1 - z0), rot=-3)
    A.put('left', ch, 2.2, .5, .06, maxw=.2)
    A.put('left', quartz_mark(gold, wht), 2.2, .36, .07, maxw=.22)
    # right front guard: black panel with the PEDDERS / TFH / BiC / SS SIGNS stickers (9_front34)
    def guard(x, y, z, view):
        return fill(x.shape, blk)
    top = lambda z: .84 + np.clip(z - 1.2, 0, 2) * .03
    A.over(guard, lambda x, y, z, view: np.clip((z - 1.2) / .03, 0, 1) * band(y, .12, 9) * (y < top(z)), views=('right',))
    A.over(lambda x, y, z, view: fill(x.shape, org),
           lambda x, y, z, view: np.clip((z - 1.2) / .02, 0, 1) * (np.abs(y - top(z) - .012) < .012), views=('right',))
    A.put('right', plate(text('PEDDERS', 'ArchivoBlack-Regular', 200, '#d8202a'), '#ffffff', pad=.2, radius=.1), 1.95, .78, .06, maxw=.36)
    # the right bumper corner (front-view texels, x < 0) is black too, with TFH and BiC on it
    A.over(guard, lambda x, y, z, view: np.clip((-x - .42) / .03, 0, 1) * band(y, .1, .5), views=('front',))
    A.put('front', plate(text('TFH', 'ArchivoBlack-Regular', 200, '#141414'), '#f2c21a', pad=.15, radius=.1), -.64, .42, .055, maxw=.17)
    A.put('front', plate(text('BiC', 'ArchivoBlack-Regular', 200, '#141414'), '#f2a81a', pad=.15, radius=.5), -.64, .3, .06, maxw=.17)
    A.put('right', plate(text('TFH', 'ArchivoBlack-Regular', 200, '#141414'), '#f2c21a', pad=.15, radius=.1), 2.3, .56, .08, maxw=.24)
    A.put('right', plate(text('BiC', 'ArchivoBlack-Regular', 200, '#141414'), '#f2a81a', pad=.15, radius=.5), 2.3, .41, .085, maxw=.24)
    A.put('right', row(text('SS', 'ArchivoBlack-Regular', 200, '#2f8fe0'), text('SIGNS', 'ArchivoBlack-Regular', 200, '#ffffff'), gap=.1), 1.45, .68, .05, maxw=.26)
    A.put('right', plate(text('LINCOLN ELECTRIC', 'ArchivoBlack-Regular', 160, '#d8202a'), '#ffffff', pad=.2, radius=.1), 2.2, .22, .045, maxw=.3)
    # bonnet: the CHIKO oval at the nose, black panel behind
    A.bonnet(ch, A.f + .62, .3, maxw=.85)
    A.put('front', logo('bowtie'), 0, .55, .05)
    A.put('rear', ch, 0, .58, .11, maxw=.6)
    A.put('rear', text('Snap-on', 'ArchivoBlack-Regular', 200, wht, slant=.15), 0, .82, .05, maxw=.4)
    A.wingcol = blk
    A.wing(erebus_word('#ffffff'), .12, maxw=1.2)
    A.endplate = blk
    A.exact = True


def erebus_word(c):
    """The thin rounded lower-case erebus wordmark."""
    return text('erebus', 'Montserrat', 200, c, weight=500, track=.06)


def quartz_mark(gold, ink):
    """QUARTZ over an ENGINE OIL tab, in TotalEnergies' gold."""
    return stack(text('QUARTZ', 'ArchivoBlack-Regular', 200, gold, track=.04),
                 plate(text('ENGINE OIL', 'Montserrat', 120, ink, weight=700), gold, pad=.15, radius=.1), gap=.04)


def L_total(A, kind):
    """Erebus #99 TotalEnergies Camaro from Riley's photos (erebus/99_side right flank, 99_front34, 99_front34b).
    The flanks are the studio side photo projected onto the body: white with the TE mark and TotalEnergies on the
    door, rainbow ribbons sweeping up the rear quarter and behind the front wheel, black tail and C-pillar, PLUMBTRAX,
    MARINA, QUARTZ and the sponsor column, lettering turned the right way round on the far flank. White bonnet with
    the black centre panel and QUARTZ ENGINE OIL, black roof and tail, black erebus wing."""
    wht, blk, gold = '#f2f2f0', '#121214', '#b98a5a'
    A.soft = None

    def base(x, y, z, view):
        c = fill(x.shape, wht)
        if view == 'top':
            c = lay(c, band(np.abs(x), -1, .28) * band(z, A.f - .9, A.f + .2), blk)           # bonnet centre panel
            c = lay(c, band(z, -9, A.f - 1.15) * band(np.abs(x), -1, .62), blk)               # roof
            c = lay(c, band(z, -9, A.r - .5), blk)                                            # deck
        if view == 'rear':
            c = fill(x.shape, blk)
        if view == 'front':
            c = lay(c, band(y, -1, .2), blk)
        return c
    A.paint(base)
    A.photo('erebus/99_side', [(1275, 835), (357, 767), (1275, 705), (357, 655)], tyre=.34)
    outline = [(180, 600), (190, 545), (260, 500), (380, 470), (480, 445), (600, 425), (800, 430), (950, 450), (1050, 510),
               (1150, 560), (1300, 575), (1450, 600), (1560, 625), (1640, 690), (1690, 760), (1720, 840), (1700, 930),
               (1480, 960), (1050, 940), (420, 890), (300, 900), (200, 860), (180, 760)]
    glass = [[(500, 470), (560, 458), (800, 455), (900, 490), (960, 560), (840, 560), (700, 555), (520, 550)],
             [(838, 538), (955, 560), (955, 610), (838, 600)]]
    W1, W2 = '#e3e2e0', '#d6d5d3'
    decals = [((640, 610, 936, 838), [W1, W2, '#ecebe9', '#c9c8c6'], 70),                 # TE mark + TotalEnergies
              ((1108, 625, 1402, 692), [W1, W2, '#ffffff', '#f2f2f2'], 70),               # PLUMBTRAX
              ((1008, 652, 1098, 692), [W1, W2, '#ffffff', '#f2f2f2'], 70),               # MARINA
              ((1045, 745, 1148, 885), [W1, W2, '#ffffff', '#f2f2f2'], 70),               # sponsor column
              ((1532, 836, 1672, 892), [W1, W2, '#ffffff', '#f2f2f2'], 70),               # QUARTZ
              ((1565, 712, 1672, 748), ['#121214', '#1e1e20', '#2a2a2c'], 70),            # DRIVEN
              ((182, 636, 252, 722), ['#121214', '#1e1e20', '#323035'], 70),              # SUPAGAS / RedCut
              ((556, 812, 668, 848), ['#121214', '#1e1e20', '#0e0c0d'], 70),              # Snap-on (sill)
              ((1488, 926, 1702, 962), ['#121214', '#1e1e20', '#0e0c0d'], 70)]            # FASTMASTER / Clear-Com
    ph = A.ph[0]                       # the black tail and C-pillar carry studio reflections: take them back to black
    lum, sat = ph.mean(-1), ph.max(-1) - ph.min(-1)
    yy, xx = np.mgrid[:ph.shape[0], :ph.shape[1]]
    tail = ((xx < 300) | ((yy < 565) & (xx < 520))) & (sat < 40)
    tail &= ~((xx > 178) & (xx < 256) & (yy > 632) & (yy < 726))          # keep SUPAGAS / RedCut
    tail |= (lum < 120) & (sat < 30)
    ph[tail] = ph[tail] * .2 + np.array([18, 18, 20], np.float32) * .8
    A.project(outline, 'right', glass=glass, decals=decals, above=(1.2, blk), arch=.42)
    A.wrap = [(.55, 1.0, -2.4, -.5)]
    # the purple-to-red band across the nose under the bonnet edge, carried on under the headlights
    def band_col(x, y, z, view):
        t = np.clip((np.abs(x) - .05) / .7, 0, 1)[..., None]
        return hexc('#d2203c').astype(np.float32) * (1 - t) + hexc('#7a3ad0').astype(np.float32) * t
    A.over(band_col, lambda x, y, z, view: band(z, 2.42, 2.53), views=('top',))
    A.bonnet(text('PIT VIPER', 'ArchivoBlack-Regular', 200, '#ffffff', slant=.15), 2.475, .035, maxw=.4)
    A.bonnet(quartz_mark(gold, wht), A.f + .55, .3, maxw=.95)
    A.bonnet(text('99', 'ArchivoBlack-Regular', 200, wht), A.f - .45, .3, maxw=.4)
    A.put('front', logo('bowtie'), 0, .55, .05)
    A.put('rear', erebus_word('#ffffff'), 0, .72, .06, maxw=.6)
    A.put('rear', text('TotalEnergies', 'Montserrat', 200, wht, weight=600), 0, .5, .06, maxw=.6)
    A.wingcol = blk
    A.wing(erebus_word('#ffffff'), .12, maxw=1.2)
    A.endplate = blk
    A.exact = True


def L_premiair(A, kind):
    """PremiAir #777 / #31 Mr. Umami Camaros from Riley's photos (premiair/777_side, _front34, _top, _track, _rear).
    The sides are the side photo projected straight onto the body (the Mr. UMAMI panel, the mascot, the red and
    black rear quarter, PremiAir 1300 WE HIRE, NULON, fill'er app, HIFLEX, POWER CRANK), with the lettering turned
    the right way round on the far flank. White bonnet with black/red shoulder wedges, NAPA and the big NULON,
    red deck and tail with 1300 WE HIRE, NULON plate and POWER CRANK, silver SP TOOLS wing."""
    wht, red, blk = '#f4f5f6', '#de1a12', '#141516'
    A.soft = None

    def base(x, y, z, view):
        c = fill(x.shape, wht)
        if view == 'top':
            # black wedges on the bonnet shoulders: wide at the screen corners, tapering to a point mid-bonnet,
            # with a red inner edge
            t = np.clip((z - (A.f - .8)) / 1.15, 0, 1)
            inner = .47 + .12 * t
            w = .16 * (1 - t)
            on = band(z, A.f - .85, A.f + .35)
            for sx in (-1, 1):
                c = lay(c, ((sx * x > inner) & (sx * x < inner + w)).astype(np.float32) * on, blk)
                c = lay(c, ((sx * x > inner - .028) & (sx * x <= inner) & (w > .01)).astype(np.float32) * on, red)
            c = lay(c, band(z, -9, A.r - .7), red)                                     # red deck
            # the red C-pillar sail runs back over the haunch tops to a point above the tail, edged in black;
            # it stays above the shoulder crease (y > ~1.03) so it never cuts across the PremiAir lettering
            ym = top_ymap(A.kind_key)[:x.shape[0], :x.shape[1]]
            thr = np.interp(z, [-2.05, -1.6, -1.0, -.55], [1.08, 1.01, 1.0, .99])
            hz = (np.abs(x) > .55) & (z > -2.05) & (z < -.55) & (ym > -5) & (ym < 1.18)
            c = lay(c, (hz & (ym > thr)).astype(np.float32), red)
            c = lay(c, (hz & (ym > thr - .022) & (ym <= thr)).astype(np.float32), blk)
        if view == 'front':
            c = lay(c, band(y, -1, .14), blk)
            c = lay(c, band(y, .14, .165), red)
        if view == 'rear':
            c = lay(c, band(y, .36, 9), red)
            c = lay(c, band(y, -1, .36), blk)
        return c
    A.paint(base)
    A.photo('premiair/777_side', [(860, 1007), (290, 1012), (860, 940), (290, 944)], tyre=.34)
    outline = [(90, 1020), (87, 930), (110, 865), (160, 850), (225, 830), (360, 810), (460, 802), (560, 805), (635, 825),
               (700, 875), (810, 887), (910, 905), (1000, 925), (1032, 960), (1035, 1040), (960, 1042), (885, 1050),
               (710, 1032), (370, 1042), (225, 1040), (120, 1025)]
    glass = [[(362, 832), (560, 822), (620, 836), (684, 880), (440, 878), (382, 856)],
             [(640, 862), (690, 862), (700, 892), (650, 892)]]                         # the NAPA mirror
    R1, R2, W1, T = '#f2050f', '#c40206', '#f4f5f6', '#141516'
    decals = [((150, 862, 342, 926), [W1, '#d8dde2'], 70, 'erase'),   # PremiAir / 1300 WE HIRE: lifted, re-laid lower below
              ((470, 903, 786, 982), [R1, R2, '#f07a70'], 80),          # Mr.UMAMI
              ((498, 964, 748, 1006), [R1, R2, '#f07a70'], 80),         # "Smart Meals for Busy Lives"
              ((122, 962, 207, 1006), [R2, '#8a0004', T], 80),          # NULON (rear quarter)
              ((955, 950, 1015, 1028), [W1, '#d8dde2', '#b9c2cc'], 70),  # NULON / fill'er app (front bumper)
              ((812, 895, 912, 920), [W1, '#d8dde2'], 70),              # HIFLEX
              ((272, 828, 352, 852), [R1, R2], 80),                     # AIR & ALLIED
              ((408, 1018, 772, 1042), [T, '#2a2a2c'], 70)]             # sill sponsors
    # POWER CRANK on the front guard is taken off the photo (Riley): only the logo pixels above the black stripe
    # are filled from the white round them, so the stripe under it carries on untouched
    import cv2
    ph = A.ph[0]
    x0, y0, x1, y1 = 742, 886, 824, 932
    sub = ph[y0:y1, x0:x1]
    yy, xx = np.mgrid[y0:y1, x0:x1]
    top = 909.5 + (xx - 740) * .245                  # top edge of the black stripe under the logo
    lum, sat = sub.mean(-1), sub.max(-1) - sub.min(-1)
    clean = (lum > 232) & (sat < 25) & (yy < top - 2)
    white = np.median(sub[clean], 0)
    sub[(yy < top) & ~clean] = white                 # logo above the stripe -> the white panel
    sub[(yy >= top) & (yy < top + 9) & (xx < 792) & (sub.max(-1) > 70)] = (18, 18, 20)    # logo bits on the stripe -> black
    ph[y0:y1, x0:x1] = cv2.GaussianBlur(sub, (3, 3), 0) * .5 + sub * .5
    A.project(outline, 'right', glass=glass, decals=decals, glass_fill='#f4f5f6', glass_pad=5, above=(1.2, wht), arch=.42)
    # PremiAir / 1300 WE HIRE cut clean from the photo and laid back 4 cm lower, so the tops of the letters stay on
    # the flank instead of stretching over the shoulder
    ppm = A.px_per_m()
    bx = (152, 864, 340, 903)
    mark = crop('premiair/777_side', bx, ink='#141516')
    bb = LAST_BB
    zc, yc = A.from_photo(bx[0] + (bb[0] + bb[2]) / 8, bx[1] + (bb[1] + bb[3]) / 8)
    A.put('sides', mark, zc, yc - .04, (bb[3] - bb[1]) / 4 / ppm)
    # 1300 WE HIRE redrawn sharp (the photo's red lettering is too small to cut cleanly), same place and size
    z0, y0 = A.from_photo(161, 912)
    z1, _ = A.from_photo(298, 912)
    hire = text('1300 WE HIRE', 'Montserrat', 200, '#e3221c', weight=600, slant=.12)
    A.put('sides', hire, (z0 + z1) / 2, y0 - .04, .055, maxw=abs(z1 - z0))
    # the rear haunch tops (which face the sky) carry on the flank design: the red C-pillar sail and its black
    # stripe run up and over the shoulder instead of stopping at a white patch
    A.wrap = [(.55, 1.0, -2.4, -.5)]
    # the nose corners ahead of the front arches are repainted flat (the photo is patchy round the headlight)
    def ends(x, y, z, view):
        c = fill(x.shape, wht)
        c = lay(c, band(y, -1, .2), blk)
        c = lay(c, band(y, .2, .225), red)
        return c
    A.over(ends, lambda x, y, z, view: np.clip((z - 1.98) / .06, 0, 1))
    nulon = logo('8343746a47')
    napa = logo('ce3a7771bb')
    napa = napa.crop((0, 0, int(napa.width * .31), napa.height))
    napa = napa.crop(napa.getbbox())
    pa = logo('3fe2cb0d65')
    A.bonnet(napa, A.f - .22, .4, maxw=.6)
    A.bonnet(nulon_dark(nulon), A.f + .38, .3, maxw=1.25)
    A.bonnet(row(text('PremiAir', 'Montserrat', 160, blk, weight=700), text('Fuels', 'Montserrat', 160, red, weight=700, slant=.15), gap=.15), 2.46, .035, maxw=.5)
    for v in ('left', 'right'):
        A.put(v, nulon_dark(nulon), 2.1, .55, .07, maxw=.24)
        A.put(v, text("fill'er app", 'Montserrat', 150, blk, weight=700), 2.06, .4, .035, maxw=.15)
    A.put('front', recol(nulon, '#141516'), .6, .4, .05, maxw=.22)
    A.put('front', recol(nulon, '#141516'), -.6, .4, .05, maxw=.22)
    A.put('lip', text('HIFLEX', 'ArchivoBlack-Regular', 200, '#ffffff', slant=.15), 0, .152, .05, maxw=.5)
    A.put('front', logo('bowtie'), 0, .5, .05)
    A.put('rear', text('1300 WE HIRE', 'Montserrat', 200, '#ffffff', weight=700), 0, .85, .06, maxw=.62)
    A.put('rear', plate(nulon, blk, pad=.25, radius=.2), 0, .52, .12, maxw=.5)
    pc = power_crank()
    for sx in (-1, 1):
        A.put('rear', pc, .55 * sx, .52, .1, maxw=.26)
    A.roof(recol(pa, red), -.2, .12, maxw=.7)
    A.wingcol = '#b9bdc2'
    A.wing(text('SP TOOLS', 'ArchivoBlack-Regular', 200, '#ffffff', track=.08), .12, maxw=1.2)
    A.endplate = blk
    A.exact = True


def nulon_dark(nulon):
    """NULON with black lettering and its red swoosh (the logo file has white letters)."""
    a = np.asarray(nulon).copy()
    wht = (a[..., 0] > 150) & (a[..., 1] > 150) & (a[..., 2] > 150)
    a[wht, :3] = (20, 21, 22)
    return Image.fromarray(a)


def power_crank():
    y = '#f6d21a'
    t = stack(outline(text('POWER', 'ArchivoBlack-Regular', 200, y, slant=.1), '#141516', .08),
              outline(text('CRANK', 'ArchivoBlack-Regular', 200, y, slant=.1), '#141516', .08), gap=.02)
    return t


def bl_outline(sx, sy, ox, oy):
    """The Blanchard studio side photos are shot from the same spot: one body outline / window, scaled."""
    o = [(262, 700), (268, 660), (288, 628), (400, 628), (500, 606), (600, 582), (700, 558), (800, 543), (1000, 555),
         (1100, 598), (1220, 660), (1400, 664), (1560, 690), (1640, 742), (1652, 800), (1660, 860), (1686, 905),
         (1680, 918), (1580, 915), (1500, 945), (1400, 945), (1310, 920), (690, 920), (640, 935), (480, 935),
         (440, 872), (330, 858), (275, 830), (262, 790)]
    g = [[(628, 598), (700, 577), (800, 567), (1000, 567), (1100, 600), (1218, 662), (1000, 655), (800, 648), (680, 640)],
         [(1135, 615), (1200, 615), (1205, 664), (1135, 664)]]
    f = lambda p: (ox + (p[0] - 565) * sx, oy + (p[1] - 833) * sy)
    return [f(p) for p in o], [[f(p) for p in gg] for gg in g]


def bl_hash(A, cols, z0, n, step, w, x0, x1, slope):
    """Rows of thin stripes on the front-guard tops at the screen corners (top view, both sides)."""
    def fn(x, y, z, view):
        c = np.zeros(x.shape + (3,), np.float32)
        return c
    for i in range(n):
        zc = z0 - i * step
        col = cols[i * len(cols) // n]
        A.over(lambda x, y, z, view, zc=zc, col=col: fill(x.shape, col),
               lambda x, y, z, view, zc=zc: (np.abs(z - (zc + (np.abs(x) - x0) * slope)) < w / 2) * band(np.abs(x), x0, x1 - i * .012),
               views=('top',))


def bl_bar(im, ratio, fill='#141516'):
    """A mark centred on a plain bar `ratio` times as wide as it is tall."""
    H = int(im.height * 1.3)
    out = Image.new('RGBA', (max(int(H * ratio), im.width + H // 2), H), fill)
    out.alpha_composite(im, ((out.width - im.width) // 2, (H - im.height) // 2))
    return out


def bl_nose(A, hashc, side='#141516'):
    """Gen3 Mustang nose as Blanchard run it: black panels round the lower intakes beside the grille (sponsor
    plates), a black bar under the grille, and diagonal hash marks on the outer bumper corners."""
    blk = '#141516'
    def fn(x, y, z, view):
        c = fill(x.shape, blk)
        return c
    A.over(fn, lambda x, y, z, view: band(np.abs(x), .52, .8) * band(y, .16, .44), views=('front',))
    # the bumper corners beside the grille are side-facing texels: black intake panels there too
    A.over(fn, lambda x, y, z, view: np.clip((z - 2.02) / .04, 0, 1) * band(y, .17, .43))
    for i in range(4):
        A.over(lambda x, y, z, view: fill(x.shape, hashc),
               lambda x, y, z, view, i=i: (np.abs((np.abs(x) - .8) - (y - .1) * .45 - i * .045 + .02) < .012) * band(np.abs(x), .8, 1.1) * band(y, .08, .42),
               views=('front',))
    sak = row(plate(text('SAKURA', 'Montserrat', 120, '#ffffff', weight=800), '#d8101e', pad=.2, radius=.5), text('SAKURA', 'ArchivoBlack-Regular', 200, '#e3222a', slant=.1), gap=.15)
    for sx in (-1, 1):
        A.put('front', sak, .66 * sx, .36, .05, maxw=.24)
        A.put('front', text('BOSCH', 'ArchivoBlack-Regular', 200, '#e3222a'), .67 * sx, .24, .05, maxw=.2)
        A.put('front', text('Gabriel', 'Montserrat', 160, '#e3222a' if side != 'blue' else '#ffffff', weight=700, slant=.1), .74 * sx, .47, .03, maxw=.13)
    A.put('sides', text('SAKURA', 'ArchivoBlack-Regular', 200, '#e3222a'), 2.2, .36, .05, maxw=.25)
    A.put('sides', text('BOSCH', 'ArchivoBlack-Regular', 200, '#e3222a'), 2.2, .25, .05, maxw=.22)


def L_cooldrive(A, kind):
    """Blanchard Racing #7 CoolDrive Mustang from Riley's photos (cooldrive/03 side, blanchard/7_front34, 7_rear34,
    cooldrive/04-05 front and rear). The sides are the studio side photo projected onto the body (CoolDrive AUTO PARTS
    with the chequers, S&A Stairs, Roth's, Ballarat Isuzu, DUNLOP, white hash marks, the white sill with its
    sponsors), lettering turned the right way round on the far flank. Blue bonnet with white shoulder hash and the
    CoolDrive lockup, blue tail with FORD RACING, Aerpro, Bremtec Brakes and the CTE diffuser, white CoolDrive wing."""
    blue, wht, blk = '#0d3fae', '#f4f6f8', '#121314'
    A.soft = None

    def base(x, y, z, view):
        c = fill(x.shape, blue)
        if view == 'front':
            c = lay(c, band(y, -1, .2), wht)
        if view == 'rear':
            c = lay(c, band(y, -1, .3), blk)
        return c
    A.paint(base)
    A.photo('cooldrive/03', [(1217, 705), (465, 699), (1217, 618), (465, 610)], tyre=.34)
    outline, glass = bl_outline(.845, .845, 465, 699)
    B1, B2, B3, W1 = '#0a3a9e', '#1a52c4', '#2f6ad6', '#f2f6fa'
    decals = [((585, 540, 1106, 730), [B1, B2, B3, '#04236f', '#3f7fe0'], 75, 'flip', .073),   # CoolDrive AUTO PARTS lockup (keeps its slope)
              ((292, 536, 552, 588), [B1, B2, B3, '#04236f', '#3f7fe0'], 75),     # S&A Stairs
              ((226, 603, 314, 652), [B1, B2, B3, '#04236f', '#3f7fe0'], 75),     # Roth's
              ((300, 688, 364, 732), [W1, '#d8dee8', '#c0c8d6'], 70),             # Ford Racing
              ((1058, 568, 1150, 592), [B1, B2, B3, '#04236f'], 75),              # DUNLOP
              ((1155, 560, 1290, 612), [B1, B2, B3, '#04236f', '#3f7fe0'], 75),   # Ballarat Isuzu
              ((1322, 610, 1378, 640), [blk, '#2a2a2c'], 70),                     # ignite
              ((1350, 650, 1396, 720), [blk, '#2a2a2c'], 70),                     # SAKURA / BOSCH
              ((605, 740, 1040, 762), [W1, '#d8dee8'], 70)]                       # sill sponsors
    A.project(outline, 'right', glass=glass, decals=decals, above=(1.2, blue), arch=.42)
    A.wrap = [(.55, 1.0, -2.4, -.5)]
    A.wrap = [(.55, 1.0, -2.4, -.5), (.55, 1.0, .4, 2.4)]
    cd = crop('cooldrive/04', (520, 452, 1100, 628), keep=['#ffffff'], tol=70)
    cd = cd.resize((cd.width, int(cd.height * 1.7)), Image.LANCZOS)
    A.bonnet(cd, A.f + .3, .5, maxw=1.15)
    bl_nose(A, wht, 'blue')
    A.put('front', logo('3952a5b529'), 0, .62, .05)
    A.put('rear', text('FORD RACING', 'ArchivoBlack-Regular', 200, wht, track=.04), 0, .9, .05, maxw=.62)
    A.put('rear', text('Aerpro', 'Montserrat', 200, wht, weight=500), 0, .58, .04, maxw=.24)
    for sx in (-1, 1):
        A.put('rear', stack(text('Bremtec', 'Montserrat', 200, wht, weight=700), text('Brakes', 'Montserrat', 200, wht, weight=700), gap=.25), .6 * sx, .56, .09, maxw=.2)
        A.put('rear', plate(text('PPG', 'ArchivoBlack-Regular', 160, '#ffffff'), '#1d5bd8', pad=.25, radius=.2), .42 * sx, .74, .035, maxw=.09)
    A.put('rear', bl_bar(crop('cooldrive/05', (650, 625, 940, 692), keep=['#ffffff'], tol=60), 4.6), 0, .5, .075, maxw=.5)
    A.wingcol = wht
    A.wing(crop('cooldrive/05', (452, 314, 1152, 372), keep=['#1a3fd0', '#2a50e0', '#0a2fb0'], tol=60), .14, maxw=1.4)
    A.endplate = blk
    A.exact = True


def L_liquimoly(A, kind):
    """Blanchard Racing #3 LIQUI MOLY / BLAHST Mustang from Riley's photos (blanchard/3_side, 3_front, 3_front34,
    liquimoly/03 rear). The sides are the studio side photo projected onto the body (red over blue bands, the big
    LIQUI MOLY door logo, the BLAHST panel, red/blue/white hash marks, DUNLOP, BUSHRANGER, VICTA, Ford Racing, sill
    sponsors), lettering turned the right way round on the far flank. White bonnet with the LIQUI MOLY logo and
    blue/red shoulder pinstripes, red deck and tail, BLAHST on the grille and the diffuser, white BLAHST wing."""
    wht, red, blue, blk = '#f4f5f7', '#d8101e', '#1438a8', '#141516'
    A.soft = None

    def base(x, y, z, view):
        c = fill(x.shape, wht)
        if view == 'top':
            c = lay(c, band(z, -9, A.r - .7), red)
        if view == 'rear':
            c = lay(c, band(y, .9, 9), red)
            c = lay(c, band(y, .45, .66), blue)
            c = lay(c, band(y, -1, .45), blk)
        return c
    A.paint(base)
    A.photo('blanchard/3_side', [(1455, 844), (565, 833), (1455, 738), (565, 722)], tyre=.34)
    outline, glass = bl_outline(1, 1, 565, 833)
    W1, W2, R1, N1 = '#f6f7f9', '#dfe2e8', '#db0018', '#03256d'
    decals = [((462, 636, 796, 730), [W1, W2, '#c9ccd4'], 80),                   # BLAHST
              ((872, 664, 1160, 868), ['#2753f4', '#1d44d8', R1, '#c8001a'], 80),  # LIQUI MOLY
              ((292, 742, 364, 778), [W1, W2, '#c9ccd4'], 70),                   # VICTA
              ((376, 828, 444, 874), [W1, W2, '#c9ccd4', '#b7bccb'], 70),         # Ford Racing
              ((1276, 684, 1370, 704), [W1, W2], 70),                            # DUNLOP
              ((1372, 681, 1542, 720), [W1, W2], 70),                            # BUSHRANGER
              ((1578, 744, 1648, 776), [blk, '#2a2a2c', '#3f3d40'], 70),          # ignite
              ((1584, 798, 1614, 834), [W1, W2], 70),                            # LIQUI MOLY (bumper)
              ((1616, 795, 1668, 878), [blk, '#2a2a2c', '#3f3d40'], 70),          # SAKURA / BOSCH
              ((728, 884, 1242, 914), [W1, W2, '#ffffff'], 70)]                  # sill sponsors
    A.project(outline, 'right', glass=glass, decals=decals, above=(1.2, wht), arch=.42)
    A.wrap = [(.55, 1.0, -2.4, -.5)]
    A.wrap = [(.55, 1.0, -2.4, -.5), (.55, 1.0, .4, 2.4)]
    lm = logo('40cf8518a9')
    A.bonnet(lm, A.f + .28, .6, maxw=1.05)
    bl_nose(A, blue)
    A.put('front', logo('3952a5b529'), 0, .62, .05)
    A.put('rear', text('FORD RACING', 'ArchivoBlack-Regular', 200, wht, track=.04), 0, .92, .05, maxw=.62)
    A.put('rear', bl_bar(text('BLAHST', 'ArchivoBlack-Regular', 200, wht), 3.4), 0, .55, .13, maxw=.62)
    lmr = Image.open(os.path.join(REFS, 'liquimoly/03.jpg')).convert('RGBA').crop((510, 610, 606, 674))
    for sx in (-1, 1):
        A.put('rear', lmr, .55 * sx, .56, .085, maxw=.16)
        A.put('rear', plate(text('PPG', 'ArchivoBlack-Regular', 160, '#ffffff'), '#1d5bd8', pad=.25, radius=.2), .42 * sx, .71, .035, maxw=.09)
    A.wingcol = wht
    A.wing(text('BLAHST', 'ArchivoBlack-Regular', 200, blk), .14, maxw=1.3)
    A.endplate = blk
    A.exact = True


def L_objective(A, kind):
    """SCT #11 Objective Racing Mustang (refs sct/01-03): gloss black, red skirts and splitter, red and grey
    hash marks on the bonnet and front fenders, a giant white Objective along the doors."""
    blk, wht, red, grey = '#101012', '#ffffff', '#d8262c', '#6c6e72'

    def base(x, y, z, view):
        c = fill(x.shape, blk)
        if view in ('left', 'right'):
            c = lay(c, band(y, -1, .13), red)
            c = lay(c, band(y, .2, .23) * band(z, A.r + .4, A.f - .4) * ss(A.r + .4, A.r + .9, z + y), red)
            for i, col in enumerate((red, grey, grey)):                       # hash marks ahead of the A-pillar
                zz = A.f - .25 - i * .16 + (y - .7) * .35
                c = lay(c, band(z, zz - .04, zz) * band(y, .6, .88), col)
        if view == 'top':
            for i, col in enumerate((red, grey, grey, red)):
                xx = .55 - i * .17
                c = lay(c, band(np.abs(x), xx - .05, xx) * band(z, A.f - .55 - i * .1, A.f + .05), col)
        if view in ('front', 'rear'):
            c = lay(c, band(y, -1, .12), red)
        return c
    A.paint(base)
    ob = logo('779f4d33e6')
    ob = ob.crop((0, 0, ob.width, int(ob.height * .765)))     # drop the blue underline bar
    obw = recol(ob, '#ffffff')
    A.put('sides', obw, -.1, .52, .5, maxw=2.3)
    A.put('sides', logo('88e4647543'), A.f + .2, .7, .08, maxw=.6)
    A.put('sides', recol(logo('6fe8b8318e'), '#ffffff'), A.f + .45, .5, .09, maxw=.4)
    A.put('sides', logo('42bc4ecbd9'), A.f + .5, .3, .1, maxw=.45)
    A.put('sides', logo('059ae6e33c'), A.r - .3, .72, .09, maxw=.5)
    A.bonnet(obw, A.f + .25, .35, maxw=1.2)
    A.roof(logo('059ae6e33c'), .2, .25, maxw=.9)
    A.wingtop(logo('42bc4ecbd9'), -2.2, .12)
    A.put('front', obw, .45, .3, .06)
    A.put('front', logo('42bc4ecbd9'), -.45, .3, .07)
    A.put('front', logo('3952a5b529'), 0, .6, .05)
    A.put('rear', obw, 0, .8, .1)
    A.put('rear', logo('42bc4ecbd9'), 0, .3, .08)


DESIGNS = {k[2:]: v for k, v in globals().items() if k.startswith('L_')}


# real partner logos per livery (files in assets/img or tools/s26/logos); Repco and Dunlop go on every car
PARTNER_LOGOS = {'Ampol': 'e160ac7f24', 'Ford Racing': 'fordracing', 'Gates': 'gates', 'Snap-on': 'snapon', 'PPG': 'ppg',
                 'Coca-Cola': 'cocacola', 'Toyota': 'toyota', 'Pirtek': 'pirtek', 'Repco': 'repco', 'DXC': 'dxc',
                 'MAN': 'man', 'Cub Cadet': 'cubcadet', 'FUCHS': 'fuchs', 'Hino': 'hino', 'Seiko': 'seiko2', 'Sika': 'sika',
                 '3M': '3m', 'Trico': 'trico', 'Dayco': 'dayco', 'NAPA': 'napa', 'Panasonic': 'panasonic', 'Mobil 1': 'd5e7ef776a'}
EXTRA = {'optus': ['Mobil 1'], 'truckassist': ['Mobil 1', 'Coca-Cola'], 'alphatheta': ['Toyota'], 'dare': ['Toyota'],
         'rjbatteries': ['Toyota'], 'redbull': ['Ampol']}


def contrast_pick(im, base):
    """Keep a logo's own colours if they stand out on the paint under it, else white or near-black."""
    a = np.asarray(im).astype(np.float32)
    m = a[..., 3] > 100
    if not m.any():
        return im
    lum = lambda c: c @ np.array([.3, .59, .11])
    lo = lum(a[..., :3][m]).mean()
    lb = lum(base)
    if abs(lo - lb) > 70:
        return im
    return recol(im, '#ffffff' if lb < 128 else '#141414')


def decals(A, key, kind):
    """Cover the car in its partners like the real thing: Repco and Dunlop on every car, then the team's
    partners along the sills, up the rear quarters, on the front guards, the bumpers, roof and boot. These are
    placed last and only where they fit clear of the main graphics (Atlas.soft)."""
    info = GRID['liveries'].get(key, {})
    names = [n for n in info.get('partners', []) + EXTRA.get(key, []) if n in PARTNER_LOGOS]
    names = list(dict.fromkeys(names))
    f, r = A.f, A.r
    m = (f + r) / 2
    base = A.img

    def under(view, a, b):
        u0, v0 = REGION[view]
        if view in ('left', 'right'):
            u = (ZF - a) * S if view == 'left' else (a - ZB) * S
            v = (YT - b) * S
        elif view == 'top':
            u, v = (a - ZB) * S, (XL - b) * S
        else:
            u = (a + XL) * S2 if view == 'front' else (XL - a) * S2
            v = (YT - b) * S2
        y, x = int((v0 + v) * K), int((u0 + u) * K)
        return base[max(0, y - 6):y + 6, max(0, x - 6):x + 6].reshape(-1, 3).mean(0)

    def place(view, nm, a, b, h, maxw, how='put'):
        im = logo(PARTNER_LOGOS.get(nm, nm))
        views = ['left', 'right'] if view == 'sides' else [view]
        for vw in views:
            img = contrast_pick(im, under(vw, a, b))
            if how == 'bonnet':
                A.put('top', img, a, b, h, maxw, rot=90)
            elif how == 'wing':
                A.put('top', img, a, b, h, maxw, rot=-90)
            else:
                A.put(vw, img, a, b, h, maxw)

    A.soft = True
    # series marks
    place('sides', 'repco', f - .42, .79, .08, .55)
    place('sides', 'dunlop', f - .62, .3, .07, .45)
    place('sides', 'dunlop', r + .62, .3, .07, .45)
    place('front', 'repco', 0, .22, .045, .5)
    place('rear', 'repco', 0, .3, .05, .55)
    if names:
        spots = [('sides', m - .6, .29, .08, .5), ('sides', m, .29, .08, .5), ('sides', m + .6, .29, .08, .5),
                 ('sides', r + .62, .74, .08, .48), ('sides', r + .62, .58, .08, .48), ('sides', r + .62, .43, .08, .48),
                 ('sides', f - .6, .66, .07, .42), ('sides', f - .6, .52, .07, .42), ('sides', m + .1, .82, .06, .5)]
        for i, (vw, a, b, h, mw) in enumerate(spots):
            place(vw, names[i % len(names)], a, b, h, mw)
        place('rear', names[0], -.45, .42, .05, .4)
        place('rear', names[1 % len(names)], .45, .42, .05, .4)
        place('front', names[0], -.5, .32, .04, .34)
        place('front', names[-1], .5, .32, .04, .34)
        place('top', names[0], f + .75, 0, .12, .8, how='bonnet')
        place('top', names[-1], .55, 0, .14, .9, how='bonnet')
        place('top', names[1 % len(names)], r - .75, 0, .12, .9, how='wing')
    A.soft = False


def chassis_of(key):
    """The livery's body and chassis, from the roster."""
    MAKE = {0: 'Holden', 1: 'Ford', 2: 'Ford', 3: 'Holden', 4: 'Ford', 5: 'Holden', 6: 'Holden', 7: 'Holden', 8: 'Holden', 9: 'Holden', 10: 'Ford', 11: 'Ford'}
    for t, seats in GRID['roster'].items():
        for e in seats:
            if e['livery'] == key:
                return e['body'], e.get('make', MAKE[int(t)])
    return GRID['liveries'][key]['body'], 'Ford'


def build(key):
    kind, make = chassis_of(key)
    A = Atlas(make)
    A.kind_key = kind + '_' + make
    DESIGNS[key](A, kind)
    if kind == 'mustang':    # a small Ford oval at the nose of the bonnet, like the real cars
        A.bonnet(logo('ford_oval'), 2.40, .055, maxw=.17)
    if kind == 'mustang':    # splitter shelf (seen through the SHELBY cut-outs in the lip face): black, so no lettering shows
        A.over(lambda x, y, z, view: fill(x.shape, '#141416'), lambda x, y, z, view: np.clip((z - 2.44) / .01, 0, 1), views=('top',))
    if not A.exact:          # a photo-exact livery already carries every real mark
        maker(A, kind, dark=float(A.img.mean()) < 110)
        decals(A, key, kind)
    im = A.finish()
    os.makedirs(OUT, exist_ok=True)
    png = os.path.join(OUT, key + '.png')
    im.save(png)
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools/livery/bc1.py'), png, os.path.join(OUT, key + '.dds.gz.bin'), os.path.join(OUT, key + '.webp')], check=True)
    # bc1.py borrows the header of a 4096 texture: write this one's real size and mip count
    import gzip, struct
    fn = os.path.join(OUT, key + '.dds.gz.bin')
    raw = bytearray(gzip.open(fn).read())
    struct.pack_into('<I', raw, 12, ATLAS)
    struct.pack_into('<I', raw, 16, ATLAS)
    struct.pack_into('<I', raw, 20, ATLAS * ATLAS // 2)
    struct.pack_into('<I', raw, 28, 12)
    open(fn, 'wb').write(gzip.compress(bytes(raw), 9))
    os.replace(png, os.path.join(os.environ.get('S26_PREVIEW', OUT + '/../'), key + '.png')) if os.environ.get('S26_PREVIEW') else os.remove(png)
    print(key, kind, make, *A.moved, sep='\n  ')


if __name__ == '__main__':
    keys = sys.argv[1:] or list(GRID['liveries'])
    for k in keys:
        build(k)
