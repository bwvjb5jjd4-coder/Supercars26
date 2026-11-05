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
REGION = {'left': (110, 0), 'right': (110, 520), 'top': (110, 1040), 'front': (40, 1772), 'rear': (500, 1772)}
SIZE = {'left': (1808, 511), 'right': (1808, 511), 'top': (1808, 732), 'front': (382, 267), 'rear': (382, 267)}
FIT = not os.environ.get('S26_NOFIT')
GRID = json.load(open(os.path.join(HERE, 'grid.json')))

# wheel axles (z) of each chassis; liveries are drawn against them
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
        return img.crop(img.getbbox() or (0, 0, 1, 1))
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
    return img.crop(img.getbbox() or (0, 0, 1, 1))


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
            col = fn(x, y, z, view)
            u0, v0 = REGION[view]
            h, w = x.shape
            self.img[v0 * K:v0 * K + h, u0 * K:u0 * K + w] = col

    # logo placement -------------------------------------------------------
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
        st = .05 * (S2 if view in ('front', 'rear') else S) * K
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

    def bonnet(self, im, z, h, x=0.0, maxw=1.2):
        """Reads from in front of the car."""
        self.put('top', im, z, x, h, maxw, rot=90)

    def roof(self, im, z, h, x=0.0, maxw=1.0):
        self.put('top', im, z, x, h, maxw, rot=90)

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

        out = Image.fromarray(np.clip(self.img, 0, 255).astype(np.uint8)).convert('RGBA')
        self.moved = []
        import cv2
        occ = np.zeros((ATLAS * K, ATLAS * K), bool)
        pad = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(.05 * S * K) | 1,) * 2)
        for im, x, y, view, soft in self.logos:
            if FIT:
                im, x, y = self.fit(im, x, y, view, occ if soft else None, soft)
                if im is None:
                    continue
            al = (np.asarray(im)[:, :, 3] > 40).astype(np.uint8)
            x0, y0 = max(0, x), max(0, y)
            sub = cv2.dilate(al, pad)[y0 - y:, x0 - x:]
            h, w = min(sub.shape[0], occ.shape[0] - y0), min(sub.shape[1], occ.shape[1] - x0)
            occ[y0:y0 + h, x0:x0 + w] |= sub[:h, :w] > 0
            out.alpha_composite(im, (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
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


def L_redbull(A, kind):
    """Triple Eight #88/#888 Red Bull Ampol Mustangs (refs redbull/01-03): matte navy with fine tonal
    horizontal stripes, the Red Bull sun and bulls over the front fender and door, a giant white AMPOL over
    the rear door and quarter, a bright blue skirt line."""
    navy, navy2, blue, red = '#1b2150', '#262e66', '#1f56d6', '#d6001c'

    def base(x, y, z, view):
        c = fill(x.shape, navy)
        if view in ('left', 'right', 'front', 'rear'):
            c = lay(c, (np.mod(y, .07) < .03).astype(np.float32) * band(y, .12, .9), navy2)
            c = lay(c, band(y, .1, .13), blue)
        if view == 'top':
            c = lay(c, (np.mod(x + 2, .07) < .03).astype(np.float32), navy2)
        if view == 'rear':
            c = lay(c, band(y, .9, 9), red)
        return c
    A.paint(base)
    bulls = logo('ed202fc404')
    rb = logo('74cca6ffe5')
    amp = logo('e160ac7f24')
    A.put('sides', bulls, A.f - .7, .52, .5, maxw=1.2)
    A.put('sides', rb, -.2, .34, .17, maxw=.75)
    A.put('sides', amp, -.85, .7, .22, maxw=1.35)
    A.put('sides', recol(logo('a91bdcf82d'), '#ffffff'), A.r - .25, .4, .07, maxw=.4)
    A.put('sides', logo('3952a5b529'), A.r - .3, .25, .06, maxw=.3)
    A.bonnet(bulls, A.f - .25, .5, maxw=1.0)
    A.bonnet(rb, A.f + .45, .14, maxw=.7)
    A.roof(amp, .1, .14, maxw=1.0)
    A.wingtop(recol(logo('5a20684e34'), '#ffffff'), -2.2, .1, maxw=1.0)
    A.put('front', rb, 0, .55, .06)
    A.put('front', amp, 0, .25, .06)
    A.put('rear', bulls, .5, .6, .14)
    A.put('rear', rb, -.4, .6, .1)
    A.put('rear', amp, 0, .35, .08)


def L_penrite(A, kind):
    """Grove #19/#26 Penrite Mustangs, 100 years (refs penrite/01-06): satin black, a huge gold PENRITE over a
    gold 100 roundel on the doors, gold beltline and sill pinstripes, Celebrating 100 Years on the quarters,
    PENRITE 100 on the bonnet, gold splitter."""
    blk, gold, dgold = '#0d0d0f', '#c9a24b', '#8a6f35'
    zc, yc = .15, .5

    def base(x, y, z, view):
        c = fill(x.shape, blk)
        if view in ('left', 'right'):
            c = lay(c, band(y, .84, .855) * band(z, A.r - .45, A.f + .55), gold)
            c = lay(c, band(y, .2, .215) * band(z, A.r + .38, A.f - .38), gold)
            r = np.sqrt((z - zc) ** 2 + ((y - yc) * 1.0) ** 2)
            c = lay(c, band(r, .27, .34), dgold)
        if view == 'top':
            c = lay(c, band(np.abs(x), .52, .535) * band(z, A.f - .25, 9), gold)
            rr = np.sqrt((z - (A.f - .55)) ** 2 + x ** 2)
            c = lay(c, band(rr, .26, .33), dgold)
        if view == 'front':
            c = lay(c, band(y, -1, .08), gold)
        return c
    A.paint(base)
    pen = logo('ef64ee4a7a')
    word = pen.crop((int(pen.width * .25), 0, pen.width, pen.height))
    word = word.crop(word.getbbox())
    A.put('sides', word, zc, yc, .3, maxw=1.95)
    A.put('sides', crop('penrite/06', (219, 336, 421, 459), bg='#0d0d0f', tol=50), A.r - .35, .66, .2, maxw=.7)
    A.put('sides', recol(logo('bd1a1c5c47'), '#ffffff'), A.f + .45, .55, .08, maxw=.5)
    A.bonnet(word, A.f - .2, .16, maxw=.8)
    A.roof(recol(logo('bd1a1c5c47'), '#ffffff'), .2, .16, maxw=.8)
    A.wingtop(recol(logo('bd1a1c5c47'), '#ffffff'), -2.2, .1)
    A.put('front', pen, 0, .36, .06, maxw=.8)
    A.put('front', logo('3952a5b529'), 0, .6, .05)
    A.put('rear', pen, 0, .80, .07, maxw=.9)


def L_monster(A, kind):
    """Tickford #6 Monster Energy Mustang (refs tickford/05-10): satin black, lime sill and quarter stripes."""
    blk, lime, wht = '#232527', '#bfe01e', '#eeeeee'
    A.paint(lambda x, y, z, view: lay(fill(x.shape, blk), band(y, -1, .16) * (view == 'front'), lime))
    A.photo('tickford/09', [(475, 485), (1040, 485), (475, 427), (1040, 427)], tyre=.33)
    A.trace([blk, lime, wht], belt=.9, erase=[(540, 380, 940, 500), (950, 375, 1180, 425)])
    A.poly('sides', [(A.f - .4, .2), (A.r + .4, .2), (A.r + .4, .23), (A.f - .4, .23)], lime)
    A.poly('sides', [(A.r + .62, .62), (A.r - .35, .64), (A.r - .35, .69), (A.r + .62, .67)], lime)
    A.plogo(logo('f3a8cd4401'), 587, 448, 112)
    A.plogo(logo('d8af11eb9d'), 787, 459, 78, maxw_px=290)
    A.plogo(crop('tickford/09', (955, 382, 1175, 422), tol=60), 1064, 402, 38)     # autObarn
    A.plogo(crop('tickford/09', (318, 488, 372, 520), tol=60), 345, 503, 30)       # RYCO
    A.bonnet(logo('f3a8cd4401'), A.f + .25, .62, maxw=.9)
    A.roof(logo('f3a8cd4401'), -.1, .52, maxw=.75)
    A.wingtop(logo('d8af11eb9d'), -2.22, .1)
    A.put('front', logo('3952a5b529'), 0, .62, .06)
    A.put('front', crop('tickford/07', (1180, 790, 1260, 830), tol=60), .45, .33, .06)
    A.put('front', crop('tickford/07', (1180, 790, 1260, 830), tol=60), -.45, .33, .06)
    A.put('rear', logo('d8af11eb9d'), 0, .62, .1)


def L_castrol(A, kind):
    """Tickford #55 Castrol Mustang (refs tickford/01-04): green body, white upper, red/white Castrol ribbon."""
    grn, wht, red, yel = '#0d8a43', '#f2f2f2', '#d9262a', '#e2e33a'
    A.paint(lambda x, y, z, view: fill(x.shape, grn) if view != 'top' else fill(x.shape, wht))
    A.photo('tickford/01', [(784, 683), (1141, 619), (784, 581), (1141, 539)], tyre=.33)
    # white upper bodywork from the nose over the front guards, white rear-door panel edged by the red ribbon
    m = (A.f + A.r) / 2
    A.poly('sides', [(2.7, .62), (A.f - .45, .78), (A.f - .7, 1.2), (2.7, 1.2)], wht)
    A.poly('sides', [(m - .05, .95), (m + .2, .55), (m + .05, .28), (A.r + .2, .28), (A.r - .25, .95)], wht)
    A.poly('sides', [(m + .2, .55), (m + .32, .55), (m + .17, .28), (m + .05, .28)], red)
    A.poly('sides', [(A.r + .2, .26), (m + .17, .26), (m + .17, .3), (A.r + .2, .3)], red)
    A.photo_top('tickford/04', 342, 1180, 451, 174)
    A.trace([grn, wht, red, yel, '#1c3f94'], view='top', erase=[(350, 300, 420, 560), (690, 320, 800, 600), (1150, 300, 1240, 600)])
    cas = logo('2e167ec379')
    A.put('sides', cas, (A.r + m) / 2 + .05, .62, .26, maxw=1.0)
    A.put('sides', crop('tickford/01', (700, 505, 870, 540), tol=70), A.f - .55, .78, .06, maxw=.5)   # FAW Trucks
    A.bonnet(cas, A.f + .2, .3, maxw=1.0)
    A.put('front', crop('tickford/01', (470, 700, 650, 780), tol=60), .42, .25, .09)   # RYCO
    A.put('front', crop('tickford/01', (470, 700, 650, 780), tol=60), -.42, .25, .09)
    A.put('front', logo('3952a5b529'), 0, .6, .05)
    A.put('rear', cas, 0, .62, .1)


def L_optus(A, kind):
    """Walkinshaw #1 Mobil 1 Optus Supra (refs wau/01-05): black, teal skirts, red and white GR shard."""
    blk, teal, wht, red = '#1c1e20', '#22b3b0', '#f2f2f2', '#e3312d'

    def base(x, y, z, view):
        c = fill(x.shape, blk)
        if view in ('front', 'rear'):
            c = lay(c, band(y, -1, .2), teal)
        if view == 'top':
            c = lay(c, band(z, -9, -2.12), red)
        return c
    A.paint(base)
    A.photo('wau/02', [(1211, 677), (469, 683), (1211, 597), (469, 603)], tyre=.33)
    A.trace([blk, teal, wht, red], belt=.92, erase=[(650, 555, 1100, 670)], allow={2: (A.r - .1, 0.1)},
            outline=[(240, 690), (235, 545), (265, 505), (345, 480), (500, 440), (700, 420), (930, 490), (1050, 505), (1270, 555), (1305, 640), (1300, 690), (1000, 700)])
    A.plogo(logo('f29dbe61eb'), 875, 611, 92, maxw_px=430)
    A.plogo(logo('d5e7ef776a'), 491, 510, 24)
    A.plogo(crop('wau/02', (320, 610, 385, 640), tol=60), 352, 625, 22)         # Coates
    A.plogo(crop('wau/02', (570, 640, 665, 680), tol=60), 617, 659, 30)         # Supercheap
    A.plogo(crop('wau/02', (1095, 545, 1280, 580), tol=60), 1188, 562, 20)      # Ringers Western
    A.bonnet(logo('d5e7ef776a'), A.f + .25, .3, maxw=1.1)
    A.roof(logo('f29dbe61eb'), -.05, .15, maxw=.7)
    A.wingtop(crop('wau/02', (170, 425, 255, 470), tol=70), -2.24, .1, maxw=.6)
    A.put('front', logo('f1175a1e66'), 0, .55, .06)
    A.put('rear', logo('f29dbe61eb'), 0, .7, .07)
    A.put('rear', logo('d5e7ef776a'), 0, .5, .06)


def L_truckassist(A, kind):
    """Walkinshaw #2 Mobil 1 Truck Assist Supra (refs wau/06-08): black, orange skirts, white/orange GR shard."""
    blk, org, wht = '#222426', '#ef6b1f', '#f0f0f0'

    def base(x, y, z, view):
        c = fill(x.shape, blk)
        if view in ('front', 'rear'):
            c = lay(c, band(y, -1, .2), org)
        if view == 'top':
            c = lay(c, band(z, -9, -2.12), '#e8452c')
        return c
    A.paint(base)
    A.photo('wau/06', [(416, 683), (1147, 683), (416, 603), (1147, 603)], tyre=.33)
    A.trace([blk, org, wht], belt=.92, erase=[(540, 525, 1000, 680)], allow={2: (A.r - .1, 0.1)},
            outline=[(205, 680), (215, 570), (300, 520), (560, 470), (720, 410), (900, 405), (1150, 460), (1230, 480), (1285, 540), (1290, 660), (1250, 690), (205, 690)])
    A.plogo(logo('6aa12045ea'), 744, 602, 139, maxw_px=410)
    A.plogo(logo('d5e7ef776a'), 1125, 496, 24)
    A.plogo(crop('wau/06', (1225, 590, 1300, 625), tol=60), 1262, 607, 24)       # Coates
    A.plogo(crop('wau/06', (960, 625, 1050, 665), tol=60), 1005, 645, 30)        # Supercheap
    A.plogo(crop('wau/06', (345, 535, 525, 565), tol=60), 435, 550, 20)          # Ringers Western
    A.bonnet(logo('d5e7ef776a'), A.f + .25, .3, maxw=1.1)
    A.roof(logo('6aa12045ea'), -.05, .2, maxw=.7)
    A.wingtop(crop('wau/06', (1355, 410, 1445, 450), tol=70), -2.24, .1, maxw=.6)
    A.put('front', logo('f1175a1e66'), 0, .55, .06)
    A.put('rear', logo('6aa12045ea'), 0, .7, .09)


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
    A.trace([wht, red, yel, blk], belt=.88, erase=[(890, 500, 1030, 600), (480, 560, 660, 650)], allow={3: (-9, -9)})
    k = A.px_per_m()
    pect = logo('755f654419').crop((0, 0, 324, 302))
    vpow = logo('755f654419').crop((456, 0, 1302, 302))
    A.plogo(pect, 613, 604, 104)
    A.plogo(vpow, 848, 593, 96)
    A.plogo(crop('djr/18', (440, 540, 525, 625)), 483, 582, 76)               # Rheem
    A.plogo(logo('71cdf80cee'), 1211, 526, 52)                                  # Repco
    A.plogo(logo('71cdf80cee'), 495, 678, 15)
    A.plogo(logo('4e18d3dc8c'), 470, 648, 15)
    A.plogo(crop('djr/18', (275, 518, 455, 545)), 365, 531, 22)               # national tiles
    A.plogo(logo('941b73578c'), 1016, 680, 24)                                   # PPG
    A.plogo(logo('3952a5b529'), 1324, 651, 28)
    A.plogo(recol(crop('djr/18', (1275, 668, 1420, 690)), '#ffffff'), 1347, 679, 16)   # RACING
    A.plogo(crop('djr/18', (955, 518, 1022, 582)), 988, 550, 52)               # V-Power star
    A.plogo(crop('djr/18', (1330, 575, 1400, 605)), 1365, 590, 26)             # Jet
    A.bonnet(pect, A.f + .2, .55, maxw=.8)
    A.roof(recol(vpow, '#ffffff'), -.25, .11, maxw=.5)
    A.wingtop(crop('djr/14', (480, 228, 1135, 282), bg='#111111'), -2.24, .09, maxw=1.3)    # DXC
    A.put('front', recol(logo('b609ba68f2').crop((560, 0, 1419, 369)), '#ffffff'), 0, .22, .05, maxw=.7)
    A.put('front', logo('3952a5b529'), 0, .62, .06)
    A.put('rear', crop('djr/14', (545, 505, 1030, 548), bg='#0d0d0d'), 0, .72, .045, maxw=.9)  # WM Waste on the black tail panel
    A.put('rear', crop('djr/14', (630, 640, 975, 722)), 0, .52, .08, maxw=.5)  # Shell Helix
    A.put('rear', crop('djr/14', (545, 400, 1030, 450), bg='#d6202b'), 0, .885, .035, maxw=.7)


def L_dewalt(A, kind):
    """Team 18 #18 DEWALT Camaro (refs dewalt/02): DEWALT yellow, black bonnet with a giant FUCHS, black roof,
    black nose and front fenders, black tail fading in over the rear quarters, huge DEWALT on the doors."""
    yel, blk, red = '#febd17', '#121212', '#e0262c'

    def base(x, y, z, view):
        c = fill(x.shape, yel)
        t = ss(A.r + .6, A.r - .1, z)
        if view == 'rear':
            t = np.ones_like(z)
        c = c * (1 - t[..., None]) + C(blk) * t[..., None]
        if view in ('left', 'right'):
            c = lay(c, band(y, -1, .2), blk)
            c = lay(c, band(y, .93, 9), blk)
            c = lay(c, ss(A.f + .02, A.f + .12, z + (y - .35) * .5), blk)        # black nose and fender tip
            c = lay(c, band(y, .86, .9) * band(z, A.r + .3, A.f - .2), blk)     # shoulder pinstripe
        if view == 'top':
            shoulder = band(np.abs(x), .8, 9) * band(z, A.r + .5, A.f - .45)
            c = fill(x.shape, blk)
            c = lay(c, shoulder, yel)
        if view == 'front':
            c = fill(x.shape, blk)
            c = lay(c, band(np.abs(x), .72, 9) * band(y, .2, .6), yel)
        return c
    A.paint(base)
    dw = logo('4ed2777886')
    hino_badge = crop('dewalt/02', (901, 736, 1067, 784), keep=['#e0262c', '#ffffff'])
    A.put('sides', dw, -.05, .52, .46, maxw=2.15)
    A.put('sides', recol(logo('seiko'), '#ffffff'), A.f + .55, .6, .07, maxw=.42)
    A.put('sides', hino_badge, A.f + .5, .45, .1, maxw=.45)
    A.put('sides', recol(logo('fuchs'), '#ffffff'), A.f + .5, .3, .1, maxw=.32)
    A.put('sides', logo('5e0810194f'), A.f - .55, .78, .08, maxw=.4)
    A.put('sides', hino_badge, A.r - .3, .72, .12, maxw=.5)
    A.bonnet(recol(logo('fuchs'), '#ffffff'), A.f + .45, .75, maxw=1.1)
    A.roof(logo('79c3639571'), -.4, .14, maxw=.8)
    A.wingtop(dw, -2.2, .1, maxw=1.0)
    A.put('front', dw, 0, .5, .07)
    A.put('front', logo('bowtie'), 0, .42, .05)
    A.put('front', hino_badge, .5, .2, .06)
    A.put('rear', hino_badge, 0, .82, .1)


def L_snowyriver(A, kind):
    """Team 18 #20 Snowy River Caravans Camaro (refs snowyriver/06): the #18 layout in teal. Black bonnet with
    SNOWY RIVER CARAVANS, black nose, white rear quarters with a black mountain line, giant name on the doors."""
    teal, blk, wht = '#2ec4c6', '#121314', '#f4f6f6'

    def base(x, y, z, view):
        c = fill(x.shape, teal)
        if view in ('left', 'right'):
            q = ss(A.r + .75, A.r + .55, z)                                    # white rear quarter
            c = lay(c, q * band(y, .2, .93), wht)
            ridge = .5 + .08 * np.sin(z * 9) + .05 * np.sin(z * 23)            # mountain silhouette
            c = lay(c, q * band(y, -1, ridge), blk)
            c = lay(c, band(y, -1, .2), blk)
            c = lay(c, band(y, .2, .26) * band(z, A.r + .5, A.f - .4), wht)
            c = lay(c, ss(A.f + .02, A.f + .12, z + (y - .35) * .5) * band(y, .45, 9), blk)
        if view == 'top':
            c = lay(c, band(z, A.f - 1.25, 9) * band(np.abs(x), -1, .78), blk)
            c = lay(c, band(z, -9, A.r - .55), blk)
        if view == 'front':
            c = lay(c, band(y, .3, 9), blk)
            c = lay(c, band(y, -1, .12), blk)
        if view == 'rear':
            c = fill(x.shape, blk)
        return c
    A.paint(base)
    sr = logo('e25c0e6ab0')
    A.put('sides', recol(sr, '#ffffff'), .05, .56, .42, maxw=2.0)
    A.put('sides', recol(logo('f372e7f1ca'), '#121314'), A.f - .45, .82, .09, maxw=.5)
    A.put('sides', logo('5e0810194f'), A.f + .5, .62, .06, maxw=.4)
    A.put('sides', recol(logo('hino'), '#ffffff'), A.r - .3, .7, .1, maxw=.3)
    A.bonnet(recol(sr, '#ffffff'), A.f + .45, .4, maxw=1.2)
    A.roof(recol(logo('f372e7f1ca'), '#121314'), -.4, .14, maxw=.8)
    A.wingtop(logo('f372e7f1ca'), -2.2, .1, maxw=1.0)
    A.put('front', logo('bowtie'), 0, .42, .05)
    A.put('front', recol(sr, '#ffffff'), 0, .55, .06)
    A.put('rear', logo('f372e7f1ca'), 0, .82, .08)


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


def L_sherrin(A, kind):
    """Matt Stone Racing #4 Sherrin Rentals Camaro (refs msr/01, 02, 05): orange, blue rear half and sills,
    red speed stripes where they meet."""
    org, blue, red, wht, blk = '#f2a12b', '#2546b5', '#e3262a', '#f0f0f0', '#151515'

    def base(x, y, z, view):
        c = fill(x.shape, org)
        if view in ('front', 'rear'):
            c = lay(c, band(y, -1, .34), blue)
        if view == 'rear':
            c = fill(x.shape, blue)
        if view == 'top':
            c = lay(c, band(z, -9, -.9), blue)
            c = lay(c, band(z, -9, -2.12), wht)
        return c
    A.paint(base)
    A.photo('msr/01', [(1269, 704), (395, 704), (1269, 613), (395, 613)], tyre=.33)
    A.trace([org, blue, red, wht], belt=.92, erase=[(581, 533, 1051, 709), (197, 501, 507, 560)], allow={3: (-9, -.2)},
            outline=[(125, 700), (130, 520), (165, 460), (250, 440), (330, 420), (560, 395), (780, 390), (960, 480), (1200, 505), (1330, 550), (1395, 600), (1420, 720), (1320, 740), (480, 730)])
    A.plogo(logo('ddc016a379'), 816, 621, 176, maxw_px=470)
    A.plogo(crop('msr/01', (197, 501, 507, 560), tol=60), 352, 530, 59)       # Tyrepower
    A.plogo(crop('msr/01', (1140, 535, 1345, 575), tol=60), 1243, 555, 40)    # EverythingFleet
    A.plogo(logo('71cdf80cee'), 1085, 744, 14)
    A.bonnet(logo('ddc016a379'), A.f + .2, .42, maxw=1.0)
    A.roof(crop('msr/01', (197, 501, 507, 560), tol=60), -.6, .14, maxw=.8)
    A.wingtop(recol(logo('daf'), '#1d3c8f'), -2.24, .1, maxw=.5)
    A.put('front', logo('bic'), .5, .45, .07)
    A.put('front', logo('bic'), -.5, .45, .07)
    A.put('front', logo('bowtie'), 0, .55, .05)
    A.put('rear', crop('msr/01', (197, 501, 507, 560), tol=60), 0, .72, .08)


def L_bendix(A, kind):
    """Matt Stone Racing #10 Bendix Camaro (refs msr/03-05): sky blue, black rear half and sills, white Bendix."""
    lb, blk, wht, red = '#33a9d8', '#1b1d22', '#eeeeee', '#d9262a'

    def base(x, y, z, view):
        c = fill(x.shape, lb)
        if view in ('front', 'rear'):
            c = lay(c, band(y, -1, .3), blk)
        if view == 'rear':
            c = fill(x.shape, blk)
        if view == 'top':
            c = lay(c, band(z, -9, -.9), blk)
            c = lay(c, band(z, -9, -2.12), wht)
        return c
    A.paint(base)
    A.photo('msr/03', [(1285, 757), (405, 757), (1285, 667), (405, 667)], tyre=.33)
    A.trace([lb, blk, wht, red], belt=.92, erase=[(533, 597, 1067, 747, 1), (245, 555, 443, 608, 1)], allow={2: (-9, -9)},
            outline=[(120, 745), (125, 560), (150, 520), (260, 500), (340, 475), (560, 445), (800, 435), (960, 520), (1200, 550), (1330, 580), (1400, 640), (1420, 760), (1320, 790), (480, 790)])
    b = logo('90cbdec9f0')
    A.plogo(b, 795, 672, 128, maxw_px=500)
    A.plogo(recol(logo('trico'), '#ffffff'), 343, 581, 43)
    A.plogo(logo('71cdf80cee'), 1100, 805, 14)
    A.bonnet(b, A.f + .2, .2, maxw=1.0)
    A.roof(recol(logo('trico'), '#ffffff'), -.6, .12, maxw=.6)
    A.wingtop(recol(logo('daf'), '#1d3c8f'), -2.24, .1, maxw=.5)
    A.put('front', logo('bowtie'), 0, .55, .05)
    A.put('rear', b, 0, .72, .08)


def L_chiko(A, kind):
    """Erebus #9 CHIKO Camaro (refs chiko/01-02): red and orange flames over a black tail."""
    red, org, blk, wht = '#e5352a', '#f39a1e', '#1a1a1a', '#f0f0f0'

    def base(x, y, z, view):
        c = fill(x.shape, red)
        if view == 'rear':
            c = fill(x.shape, blk)
        if view == 'front':
            c = lay(c, band(y, -1, .2), blk)
        if view == 'top':
            c = lay(c, band(z, -9, -1.2), blk)
            c = lay(c, band(np.abs(x), .3, .36) * band(z, -1.2, A.f + 1), org)
        return c
    A.paint(base)
    A.photo('chiko/01', [(613, 827), (1157, 784), (613, 736), (1157, 704)], tyre=.33)
    A.trace([red, org, blk, wht], belt=.92, erase=[(795, 693, 1067, 821)], allow={3: (-9, -9)},
            outline=[(225, 820), (250, 700), (300, 650), (560, 610), (640, 560), (800, 545), (1000, 560), (1170, 590), (1180, 760), (1100, 800), (600, 840)])
    ch = logo('57c38ba607')
    A.plogo(ch, 930, 757, 123)
    A.plogo(crop('chiko/01', (1088, 651, 1221, 699)), 1155, 675, 46)                              # Snap-on
    A.bonnet(ch, A.f + .5, .3, maxw=.8)
    A.roof(ch, -.3, .25, maxw=.7)
    A.wingtop(crop('chiko/01', (1088, 651, 1221, 699)), -2.24, .1, maxw=1.0)
    A.put('front', logo('bowtie'), 0, .55, .05)
    A.put('front', logo('cc604486c7'), .45, .4, .04)
    A.put('rear', ch, 0, .7, .1)


def L_total(A, kind):
    """Erebus #99 TotalEnergies Camaro (refs total/01-02): white, black tail, rainbow ribbons from the TE mark."""
    wht, blk, red, yel, blue, pur = '#f2f3f5', '#16181b', '#e8242d', '#f6c21c', '#2e5bd8', '#8b3fa4'

    def base(x, y, z, view):
        c = fill(x.shape, wht)
        if view == 'rear':
            c = fill(x.shape, blk)
        if view == 'front':
            c = lay(c, band(y, -1, .2), blk)
        if view == 'top':
            c = lay(c, band(z, -9, -1.7), blk)
        return c
    A.paint(base)
    A.photo('total/01', [(955, 736), (512, 693), (955, 672), (512, 635)], tyre=.33)
    A.trace([wht, blk, red, yel, blue, pur], belt=.92, erase=[(651, 624, 795, 736)], min_area=.04,
            outline=[(400, 640), (405, 560), (440, 520), (560, 505), (700, 495), (800, 520), (950, 560), (1080, 600), (1120, 700), (1080, 740), (900, 745), (500, 700)])
    te = logo('2dd6e13bf9')
    A.plogo(te, 722, 677, 112)
    A.plogo(crop('total/01', (880, 615, 1010, 650)), 945, 632, 26)                                # Plumbtrax
    A.plogo(logo('cc604486c7'), 1105, 735, 14)
    A.bonnet(te, A.f + .2, .5, maxw=.8)
    A.roof(logo('cdadefee3e'), -.3, .12, maxw=.8)
    A.wingtop(recol(logo('cdadefee3e'), '#ffffff'), -2.24, .08, maxw=1.2)
    A.put('front', logo('bowtie'), 0, .55, .05)
    A.put('front', logo('cc604486c7'), .5, .4, .04)
    A.put('front', logo('cc604486c7'), -.5, .4, .04)
    A.put('rear', recol(logo('cdadefee3e'), '#ffffff'), 0, .7, .07)


def L_premiair(A, kind):
    """PremiAir Camaros (refs premiair/01-03): white, a red Mr UMAMI panel over the doors, red over the rear
    quarter, black sills with a red line, NULON on the nose, NAPA on the bonnet, PremiAir on the quarter."""
    wht, red, blk = '#f5f6f6', '#e0301e', '#141516'

    def base(x, y, z, view):
        c = fill(x.shape, wht)
        if view in ('left', 'right'):
            front = .98 - (y - .2) * .6
            c = lay(c, ss(front + .01, front - .01, z) * ss(A.r + .3, A.r + .32, z) * band(y, .2, .84), red)
            c = lay(c, ss(A.r + .55, A.r + .5, z) * band(y, .8, .93), red)
            c = lay(c, band(y, -1, .17), blk)
            c = lay(c, band(y, .19, .215) * band(z, A.r - .6, A.f + .6), red)
        if view == 'top':
            c = lay(c, band(np.abs(x), .3, .34), red)
            c = lay(c, band(z, -9, A.r - .7), red)
        if view == 'front':
            c = lay(c, band(y, -1, .14), blk)
            c = lay(c, band(y, .14, .17), red)
        if view == 'rear':
            c = lay(c, band(y, .4, 9), red)
            c = lay(c, band(y, -1, .16), blk)
        return c
    A.paint(base)
    nulon = logo('8343746a47')
    napa = logo('ce3a7771bb')
    pa = logo('3fe2cb0d65')
    A.put('sides', crop('premiair/03', (704, 576, 1088, 747), bg='#e2341f', tol=40, keep=['#f8f8f8']), -.05, .5, .4, maxw=1.7)
    A.put('sides', pa, A.r - .2, .66, .14, maxw=.75)
    A.put('sides', recol(nulon, '#141516'), A.f + .45, .48, .1, maxw=.6)
    A.put('sides', napa, .75, .86, .06, maxw=.3)
    A.bonnet(napa, A.f + .4, .3, maxw=.6)
    A.bonnet(recol(nulon, '#141516'), A.f + 1.05, .2, maxw=1.2)
    A.roof(pa, -.4, .14, maxw=.8)
    A.wingtop(recol(nulon, '#ffffff'), -2.2, .1, maxw=1.0)
    A.put('front', recol(nulon, '#141516'), 0, .3, .07)
    A.put('front', logo('bowtie'), 0, .5, .05)
    A.put('rear', recol(pa, '#ffffff'), 0, .7, .08)


def L_cooldrive(A, kind):
    """Blanchard Racing #7 CoolDrive Mustang (refs cooldrive/01-05): CoolDrive blue, white sill band with
    the chequered AUTO PARTS strip, white hash marks."""
    blue, wht, lb = '#1e4fc0', '#f2f4f7', '#49a7e4'

    def base(x, y, z, view):
        c = fill(x.shape, blue)
        if view in ('front', 'rear'):
            c = lay(c, band(y, -1, .2), wht)
        if view == 'top':
            c = lay(c, band(z, -9, -2.12), wht)
        return c
    A.paint(base)
    A.photo('cooldrive/03', [(1216, 699), (466, 699), (1216, 619), (466, 619)], tyre=.33)
    A.trace([blue, wht, lb], belt=.92, erase=[(581, 560, 1099, 650), (299, 539, 549, 587)],
            outline=[(200, 640), (205, 560), (225, 500), (330, 470), (450, 450), (640, 420), (780, 420), (960, 520), (1180, 540), (1300, 575), (1310, 700), (1250, 720), (1020, 720), (540, 720), (330, 690)])
    cd = logo('f28f9d1197')
    A.plogo(cd, 843, 612, 82, maxw_px=520)
    A.plogo(crop('cooldrive/03', (587, 651, 1099, 717), tol=70), 843, 684, 66, maxw_px=515)
    A.plogo(crop('cooldrive/03', (299, 539, 549, 587), tol=70), 424, 563, 48)          # S&A Stairs
    A.plogo(crop('cooldrive/03', (1155, 562, 1280, 605), tol=70), 1217, 583, 40)       # Ballarat Isuzu
    A.bonnet(cd, A.f + .2, .22, maxw=1.0)
    A.roof(crop('cooldrive/03', (299, 539, 549, 587), tol=70), -.5, .12, maxw=.7)
    A.wingtop(cd, -2.24, .1, maxw=1.3)
    A.put('front', logo('3952a5b529'), 0, .6, .05)
    A.put('front', logo('bosch'), 0, .3, .05)
    A.put('rear', cd, 0, .72, .09)


def L_liquimoly(A, kind):
    """Blanchard Racing #3 LIQUI MOLY / BLAHST Mustang (refs liquimoly/01-05): white, red over blue sweep,
    hash marks, BLAHST panel."""
    wht, red, blue, blk = '#f3f4f6', '#e3242b', '#1a3fa6', '#151515'

    def base(x, y, z, view):
        c = fill(x.shape, wht)
        if view in ('front', 'rear'):
            c = lay(c, band(y, -1, .2), blue)
        if view == 'top':
            c = lay(c, band(np.abs(x), .62, 2) * band(z, A.f - .6, 9), red)
            c = lay(c, band(z, -9, -2.12), blk)
        return c
    A.paint(base)
    A.photo('liquimoly/02', [(1216, 699), (469, 693), (1216, 613), (469, 613)], tyre=.33)
    A.trace([wht, red, blue, blk], belt=.92, erase=[(725, 555, 965, 725)], allow={3: (-9, -9)},
            outline=[(200, 640), (205, 560), (225, 500), (330, 470), (450, 450), (640, 420), (780, 420), (960, 520), (1180, 540), (1300, 575), (1310, 700), (1250, 720), (1020, 720), (540, 720), (330, 690)])
    lm = logo('40cf8518a9')
    A.plogo(lm, 845, 640, 171, maxw_px=245)
    A.plogo(crop('liquimoly/02', (380, 525, 670, 610), tol=80), 525, 567, 66, maxw_px=300)   # BLAHST
    A.plogo(crop('liquimoly/02', (1140, 568, 1285, 598), tol=70), 1212, 583, 26)              # Bushranger
    A.bonnet(lm, A.f + .2, .52, maxw=.8)
    A.roof(logo('b186a2271a'), -.5, .16, maxw=.7)
    A.wingtop(recol(logo('b186a2271a').convert('RGBA'), '#ffffff') if False else logo('b186a2271a'), -2.24, .12, maxw=1.2)
    A.put('front', logo('b186a2271a'), 0, .32, .07)
    A.put('front', logo('3952a5b529'), 0, .6, .05)
    A.put('rear', logo('b186a2271a'), 0, .62, .1)


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
    MAKE = {0: 'Ford', 1: 'Ford', 2: 'Ford', 3: 'Holden', 4: 'Ford', 5: 'Holden', 6: 'Holden', 7: 'Holden', 8: 'Holden', 9: 'Holden', 10: 'Ford', 11: 'Ford'}
    for t, seats in GRID['roster'].items():
        for e in seats:
            if e['livery'] == key:
                return e['body'], MAKE[int(t)]
    return GRID['liveries'][key]['body'], 'Ford'


def build(key):
    kind, make = chassis_of(key)
    A = Atlas(make)
    A.kind_key = kind + '_' + make
    DESIGNS[key](A, kind)
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
