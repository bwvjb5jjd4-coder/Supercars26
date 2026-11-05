import os
"""Build the Supercars 26 race bodies (Gen3 Mustang, Camaro ZL1, GR Supra) from Riley's three GLBs.

    python3 tools/s26/build_bodies.py <mustang.glb> <camaro.glb> <supra.glb>

Each road car becomes a Gen3 race body that plugs straight into the game's own car builder
(dc35MakeGeometry), so every Supercars 18 system keeps working on it: LODs, crumple and dent shaders,
bonnet loss, bumper damage, brake and head lamps, wheel spin/steer/damage, pit crews, AI and sounds.

What happens to each car:
  * exterior parts only (interior, engine, suspension, wheels, brakes, plates are dropped);
  * fitted to the stock chassis it runs on: wheel centres moved onto the game's axles (piecewise
    stretch between the arches, overhangs untouched), width trimmed to the race track, ride height
    lowered to the race wheel centre;
  * a Gen3 rear wing on swan-neck stands (Mustang, Camaro; the LB Supra keeps its own wing) and a flat floor;
  * decimated to three LODs that keep the source normals;
  * livery surfaces get a projection atlas (left side, right side, top, front, rear; 2048 x 2048,
    345 px per metre) so tools/s26/paint_liveries.py can paint each car in metres;
  * side windows get UVs that put the race number on the rear side glass (RF41_WINDOW_LAYOUT);
  * the stock race interior (dash, seat, cage, driver, screens) is copied in mirrored to the right-hand side.

Writes assets/s26/<body>_<make>.json.gz.bin: {"spec":..., "levels":[rows, rows, rows]} using the same
row encoding as assets/models.json.gz.bin.
"""
import base64, gzip, io, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools', 'roadcars'))
from glbx import GLB  # noqa: E402
from build_ve import decimate_shaded  # noqa: E402

OUT = os.path.join(ROOT, 'assets', 's26')
STOCK = json.loads(gzip.open(os.path.join(ROOT, 'assets', 'models.json.gz.bin')).read())

# Game frame: metres, X = car's left, Y up, Z forward. The race wheels sit at these hub centres.
AXLE = {'Ford': dict(f=1.565, r=-1.264, y=.34, x=.78), 'Holden': dict(f=1.6215, r=-1.3125, y=.34, x=.79)}
# Livery atlas (pixels of a 2048 texture), see paint_liveries.py
ATLAS = 2048
S = 345.0           # px per metre on the side and top views
S2 = 180.0          # px per metre on the front and rear views
ZF, ZB, YT, XL = 2.62, -2.62, 1.48, 1.06
REGION = {'left': (110, 0), 'right': (110, 520), 'top': (110, 1040), 'front': (40, 1772), 'rear': (500, 1772)}
INTERIOR = {'fabric', 'cage', 'helmet', 'harness', 'screen', 'screen2', 'led', 'rearview'}
KEEP_AS_IS = {'steering', 'glove'}
WHEEL = ('wheelrubber', 'wheelmetal', 'wheelmark', 'rotorblack', 'rotor', 'caliper')


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def unb64(s, t):
    return np.frombuffer(base64.b64decode(s), t)


# ---------------------------------------------------------------- classification
def classify_mustang(p):
    n, m = p['name'], p['mat']
    drop = ('leather', 'seat', 'lambert1', 'tire', 'brake', 'plate', 'roll')
    if m in drop or 'Wheel' in n:
        return None
    if any(k in n for k in ('Sunvisor', 'Steeringbox', 'Screen', 'Lowerarm', 'Subframe', 'Swaybar', 'RadiatorFan', 'Strutbar',
                            'Radiator', 'Transmission', 'Engine', 'Stut', 'Hub', 'Pedal', 'Stalk', 'Gauges', 'Supercharger',
                            'Shifter', 'Halfshaft', 'Shock', 'Spring', 'Tierod', 'Upperarm', 'Mirror.Int', 'Dash', 'Steer_',
                            'Wipers', 'Wing_')):
        return None
    if 'Headlight' in n and 'Glass' not in n:
        return 'headlight' if m in ('light', 'mirror') else 'black'
    if m == 'carpaint':
        return 'hood' if 'Hood' in n else 'wing'
    if m == 'tinted_glass':
        return 'glass'
    if m == 'rearlight':
        return 'tail'
    if m == 'orange':
        return 'amber'
    if m == 'mirror':
        return 'mirror'
    if m == 'white_gloss':
        return None
    return 'black'


def classify_hennessey(p):  # Camaro and Supra share the same kit structure
    n, m = p['name'], p['mat']
    path = p['node']
    if any(k in path for k in ('Wheel', 'Calliper', 'Caliper')) or any(k in m for k in ('TireBlur', 'BrakeDisc', 'rim_', 'Calliper', 'phong4')):
        return None
    if any(k in m for k in ('Interior', 'Engine', 'ManufacturerPlate')) or 'SeatBelt' in n:
        return None
    if 'WindowInside' in n:
        return None
    if 'Paint' in m:
        return 'hood' if 'Hood' in n else 'wing'
    if m.endswith('phong1') or 'red_glass' in m:
        return 'tail'
    if 'ORANGE' in m:
        return 'amber'
    if 'Window' in m and 'glass_surr' not in m:
        return 'glass'
    if 'Light' in m:
        return 'light'           # split per triangle below
    if 'Badge' in m:
        return 'metal'
    if 'Carbon' in m:
        return 'carbon'
    return 'black'


def tex_luma(g, p):
    mat = p['matd']
    ti = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture', {}).get('index')
    if ti is None or p['uv'] is None:
        return None
    im = np.asarray(Image.open(io.BytesIO(g.image(g.j['textures'][ti]['source']))).convert('RGB'), np.float32) / 255
    h, w = im.shape[:2]
    uv = p['uv'][p['idx']].mean(1)
    x = np.clip((uv[:, 0] % 1) * w, 0, w - 1).astype(int)
    y = np.clip((uv[:, 1] % 1) * h, 0, h - 1).astype(int)
    c = im[y, x]
    return c @ np.array([.3, .59, .11])


# ---------------------------------------------------------------- fitting
def wheel_centres(prims, is_wheel):
    pts = np.concatenate([p['pos'] for p in prims if is_wheel(p)])
    out = {}
    for sx in (-1, 1):
        for sz in (-1, 1):
            q = pts[(np.sign(pts[:, 0]) == sx) & (np.sign(pts[:, 2] - pts[:, 2].mean()) == sz)]
            out[(sx, sz)] = (q.min(0) + q.max(0)) / 2
    zf = (out[(1, 1)][2] + out[(-1, 1)][2]) / 2
    zr = (out[(1, -1)][2] + out[(-1, -1)][2]) / 2
    cy = np.mean([c[1] for c in out.values()])
    cx = np.mean([abs(c[0]) for c in out.values()])
    return zf, zr, cy, cx


class Fit:
    def __init__(self, zf, zr, cy, halfw, make, drop=.025, arch=.47):
        a = AXLE[make]
        self.zf, self.zr, self.af, self.ar, self.arch = zf, zr, a['f'], a['r'], arch
        self.dy = a['y'] - cy - drop
        self.sx = float(np.clip(.985 / halfw, .94, 1.0))
        self.k = ((a['f'] - arch) - (a['r'] + arch)) / ((zf - arch) - (zr + arch))

    def z(self, z):
        lo, hi = self.zr + self.arch, self.zf - self.arch
        out = np.where(z <= lo, self.ar + (z - self.zr),
                       np.where(z >= hi, self.af + (z - self.zf), self.ar + self.arch + (z - lo) * self.k))
        return out

    def kz(self, z):
        lo, hi = self.zr + self.arch, self.zf - self.arch
        return np.where((z > lo) & (z < hi), self.k, 1.0)

    def apply(self, v, n):
        v2 = np.stack([v[:, 0] * self.sx, v[:, 1] + self.dy, self.z(v[:, 2])], 1)
        if n is None:
            return v2, None
        n2 = np.stack([n[:, 0] / self.sx, n[:, 1], n[:, 2] / self.kz(v[:, 2])], 1)
        n2 /= np.maximum(np.linalg.norm(n2, axis=1, keepdims=True), 1e-9)
        return v2, n2


# ---------------------------------------------------------------- procedural race parts
def box(c, s, rot=0.0):
    """Axis box (centre, size) as 24 vertices with flat normals, optional pitch about X."""
    cx, cy, cz = c
    sx, sy, sz = [x / 2 for x in s]
    faces = [((1, 0, 0), [(1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)]), ((-1, 0, 0), [(-1, -1, 1), (-1, 1, 1), (-1, 1, -1), (-1, -1, -1)]),
             ((0, 1, 0), [(-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1)]), ((0, -1, 0), [(-1, -1, 1), (-1, -1, -1), (1, -1, -1), (1, -1, 1)]),
             ((0, 0, 1), [(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]), ((0, 0, -1), [(1, -1, -1), (-1, -1, -1), (-1, 1, -1), (1, 1, -1)])]
    V, N, F = [], [], []
    ca, sa = np.cos(rot), np.sin(rot)
    R = np.array([[1, 0, 0], [0, ca, -sa], [0, sa, ca]])
    for nrm, quad in faces:
        b = len(V)
        for q in quad:
            V.append(R @ np.array([q[0] * sx, q[1] * sy, q[2] * sz]) + np.array([cx, cy, cz]))
            N.append(R @ np.array(nrm, float))
        F += [(b, b + 1, b + 2), (b, b + 2, b + 3)]
    F = np.array(F)
    # make winding agree with the normal
    V, N = np.array(V), np.array(N)
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    flip = (fn * N[F[:, 0]]).sum(1) < 0
    F[flip] = F[flip][:, ::-1]
    return V, N, F


def wing_parts(top_y, tail_z, width=1.72):
    """Gen3-style rear wing: a cambered main plane on two swan-neck stands, with endplates.
    tail_z is the rearmost point of the body; the blade's trailing edge sits just inside it."""
    parts = []
    span = width
    chord = .30
    y = top_y + .19                  # underside of the blade above the boot lid
    zl = tail_z + .40                # leading edge
    prof = [(0, 0), (.04, .016), (.10, .026), (.18, .026), (.26, .016), (.30, .004)]
    lower = [(0, 0), (.04, -.010), (.10, -.012), (.18, -.008), (.26, -.003), (.30, .0)]
    xs = (-span / 2, span / 2)
    V, N, F = [], [], []
    for skin, pr, sgn in ((0, prof, 1), (1, lower, -1)):
        for u, h in pr:
            for x in xs:
                V.append((x, y + h + (u / chord) * .07, zl - u))   # nose down, tail up (angle of attack)
                N.append((0, sgn, 0))
    V, N = np.array(V, float), np.array(N, float)
    npf = len(prof)
    for s in range(2):
        base = s * npf * 2
        for i in range(npf - 1):
            a, b = base + i * 2, base + (i + 1) * 2
            F += [(a, a + 1, b + 1), (a, b + 1, b)]
    F = np.array(F)
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    flip = (fn * N[F[:, 0]]).sum(1) < 0
    F[flip] = F[flip][:, ::-1]
    parts.append(('wing', V, N, F))
    zt = zl - chord
    # gurney flap on the trailing edge
    parts.append(('black',) + box((0, y + .07 + .004 + .018, zt + .004), (span, .036, .006)))
    # endplates
    for sx in (-1, 1):
        parts.append(('black',) + box((sx * (span / 2 + .004), y + .025, zl - chord / 2 + .01), (.006, .15, .33)))
    # swan-neck stands: an upright from the boot lid to the blade's underside
    h = y - top_y
    for sx in (-1, 1):
        parts.append(('black',) + box((sx * .36, top_y + h / 2 - .01, zl - .12), (.018, h + .03, .11)))
        parts.append(('black',) + box((sx * .36, top_y - .005, zl - .12), (.07, .02, .16)))
    return parts


# ---------------------------------------------------------------- UVs
def side_uv(v, left):
    u0, v0 = REGION['left' if left else 'right']
    if left:
        u = u0 + (ZF - v[:, 2]) * S
    else:
        u = u0 + (v[:, 2] - ZB) * S
    vv = v0 + (YT - v[:, 1]) * S
    return u, vv


def top_uv(v):
    u0, v0 = REGION['top']
    return u0 + (v[:, 2] - ZB) * S, v0 + (XL - v[:, 0]) * S


def end_uv(v, front):
    u0, v0 = REGION['front' if front else 'rear']
    u = u0 + ((v[:, 0] + XL) if front else (XL - v[:, 0])) * S2
    return u, v0 + (YT - v[:, 1]) * S2


def view_of(fn):
    nx, ny, nz = fn[:, 0], fn[:, 1], fn[:, 2]
    k = np.full(len(fn), 'left', object)
    k[nx < 0] = 'right'
    k[(ny > .62)] = 'top'
    k[(nz > .78) & (ny <= .62)] = 'front'
    k[(nz < -.78) & (ny <= .62)] = 'rear'
    return k


def paint_uv(v, n, f):
    """Unweld per view so every triangle sits in exactly one projection region."""
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
    views = view_of(fn)
    OV, ON, OU, OF = [], [], [], []
    base = 0
    for name in ('left', 'right', 'top', 'front', 'rear'):
        sel = f[views == name]
        if not len(sel):
            continue
        used, inv = np.unique(sel.ravel(), return_inverse=True)
        vv, nn = v[used], n[used]
        if name in ('left', 'right'):
            u, w = side_uv(vv, name == 'left')
        elif name == 'top':
            u, w = top_uv(vv)
        else:
            u, w = end_uv(vv, name == 'front')
        OV.append(vv); ON.append(nn); OU.append(np.stack([u, w], 1) / ATLAS); OF.append(inv.reshape(-1, 3) + base)
        base += len(used)
    return np.concatenate(OV), np.concatenate(ON), np.clip(np.concatenate(OU), 0, 1), np.concatenate(OF)


def glass_uv(v, n, f, make):
    """Race numbers live on the rear side windows: place the RF41 window layout spots on them."""
    lay = {'Ford': [(.1825, .2325), (.8175, .2325)], 'Holden': [(.136, .2125), (.864, .2125)]}[make]
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
    out_v, out_n, out_u, out_f = [], [], [], []
    base = 0
    spot = {}
    for side, sgn in (('left', 1), ('right', -1)):
        cen = v[f].mean(1)
        # cabin side glass only (lamp lenses and the like also sit in the glass role)
        m = (fn[:, 0] * sgn > .45) & (cen[:, 1] > .82) & (cen[:, 2] > -1.6) & (cen[:, 2] < 1.4)
        if m.any():
            pts = v[f[m]].reshape(-1, 3)
            # the rearmost side glass (quarter window / rear door glass)
            zc = np.percentile(pts[:, 2], 22)
            near = pts[np.abs(pts[:, 2] - zc) < .25]
            spot[side] = (zc, (near[:, 1].min() + near[:, 1].max()) / 2 if len(near) else pts[:, 1].mean())
    scale = .036 / .2   # uv units per metre: a 0.2 m tall number at h=.035-.04
    keys = np.where(fn[:, 0] > .45, 0, np.where(fn[:, 0] < -.45, 1, 2))
    for k in (0, 1, 2):
        sel = f[keys == k]
        if not len(sel):
            continue
        used, inv = np.unique(sel.ravel(), return_inverse=True)
        vv, nn = v[used], n[used]
        if k == 2 or ('left' if k == 0 else 'right') not in spot:
            uv = np.tile([.5, .62], (len(vv), 1))
        else:
            side = 'left' if k == 0 else 'right'
            zc, yc = spot[side]
            cx, cy = lay[0] if k == 0 else lay[1]
            du = (zc - vv[:, 2]) if k == 0 else (vv[:, 2] - zc)
            # the number canvas is a CanvasTexture (flipY), so v runs up from the bottom of the canvas
            uv = np.stack([cx + du * scale, (1 - cy) + (vv[:, 1] - yc) * scale], 1)
        out_v.append(vv); out_n.append(nn); out_u.append(uv); out_f.append(inv.reshape(-1, 3) + base)
        base += len(used)
    return np.concatenate(out_v), np.concatenate(out_n), np.clip(np.concatenate(out_u), 0, 1), np.concatenate(out_f), spot


# ---------------------------------------------------------------- rows
def rows_for(role, v, n, uv, f, source):
    """Encode a part as dc35 rows (quantised, uint16 indices, split under 65k vertices)."""
    out = []
    if not len(f):
        return out
    if len(v) > 60000:
        order = np.argsort(v[f].mean(1)[:, 2])
        step = max(1, int(len(f) * 60000 / len(v) / 2))
        for s in range(0, len(f), step):
            ff = f[order[s:s + step]]
            used, inv = np.unique(ff.ravel(), return_inverse=True)
            out += rows_for(role, v[used], n[used], uv[used], inv.reshape(-1, 3), source)
        return out
    p = np.round(v * 10000).astype(np.int16)
    nn = np.round(np.clip(n, -1, 1) * 32767).astype(np.int16)
    u = np.round(np.clip(uv, 0, 1) * 65535).astype(np.uint16)
    i = f.astype(np.uint16)
    out.append({'role': role, 'source': source, 'q': True, 'i16': True, 'p': b64(p), 'n': b64(nn), 'u': b64(u), 'i': b64(i),
                'vertices': int(len(v)), 'triangles': int(len(f)), 'rf41uv': True, 's26': True})
    return out


def clip_row(row, hm, lo, cell, fm=None, flo=None, sm=None, slo=None):
    """Drop stock-interior triangles that poke through this body's lower roof (the stock ZB/Mustang liner and
    cage top sit higher than the Supra and Camaro roofs)."""
    if not row.get('q'):
        return row
    p = unb64(row['p'], np.int16).reshape(-1, 3).astype(np.float32) / 10000
    it = np.uint16 if row.get('i16') else np.uint32
    f = unb64(row['i'], it).reshape(-1, 3)
    ia = np.clip(((p[:, 0] - lo[0]) / cell).astype(int), 0, hm.shape[0] - 1)
    ib = np.clip(((p[:, 2] - lo[1]) / cell).astype(int), 0, hm.shape[1] - 1)
    over = p[:, 1] > hm[ia, ib] - .03
    if fm is not None:     # ...and anything in front of the (more raked) windscreen
        ja = np.clip(((p[:, 0] - flo[0]) / cell).astype(int), 0, fm.shape[0] - 1)
        jb = np.clip(((p[:, 1] - flo[1]) / cell).astype(int), 0, fm.shape[1] - 1)
        over |= (p[:, 1] > .85) & (fm[ja, jb] > -9) & (p[:, 2] > fm[ja, jb] + .02)
    if sm is not None:     # ...and anything outside the body's sides (narrower glasshouse than the stock car)
        ka = np.clip(((p[:, 1] - slo[0]) / cell).astype(int), 0, sm.shape[0] - 1)
        kb = np.clip(((p[:, 2] - slo[1]) / cell).astype(int), 0, sm.shape[1] - 1)
        over |= (p[:, 1] > .6) & (sm[ka, kb] > 0) & (np.abs(p[:, 0]) > sm[ka, kb] - .03)
    bad = over[f].any(1)
    if not bad.any():
        return row
    r = dict(row)
    r['i'] = b64(f[~bad].astype(it))
    r['triangles'] = int((~bad).sum())
    return r


def mirror_row(row):
    """Copy a stock interior row to the right-hand side: negate X and reverse the winding."""
    r = dict(row)
    if row.get('q'):
        p = unb64(row['p'], np.int16).reshape(-1, 3).copy()
        n = unb64(row['n'], np.int16).reshape(-1, 3).copy()
        p[:, 0] = -p[:, 0]
        n[:, 0] = -n[:, 0]
        r['p'], r['n'] = b64(p), b64(n)
    else:
        p = unb64(row['p'], np.float32).reshape(-1, 3).copy()
        n = unb64(row['n'], np.float32).reshape(-1, 3).copy()
        p[:, 0] *= -1
        n[:, 0] *= -1
        r['p'], r['n'] = b64(p), b64(n)
    it = np.uint16 if row.get('i16') else np.uint32
    i = unb64(row['i'], it).reshape(-1, 3)[:, ::-1].copy()
    r['i'] = b64(i)
    r['s26rhd'] = True
    return r


# ---------------------------------------------------------------- build
BUDGET = [{'wing': 46000, 'hood': 6000, 'black': 16000, 'carbon': 2500, 'glass': 2400, 'headlight': 3200, 'tail': 2600,
           'amber': 300, 'mirror': 200, 'metal': 1200},
          {'wing': 13000, 'hood': 1800, 'black': 4200, 'carbon': 600, 'glass': 700, 'headlight': 900, 'tail': 800,
           'amber': 100, 'mirror': 60, 'metal': 300},
          {'wing': 3200, 'hood': 500, 'black': 900, 'carbon': 120, 'glass': 220, 'headlight': 200, 'tail': 200,
           'amber': 30, 'mirror': 20, 'metal': 60}]


def gather(path, kind):
    g = GLB(path)
    prims = g.prims()
    # Sketchfab exports come in different units; work out the scale from the overall length (~4.4-4.9 m)
    allp = np.concatenate([p['pos'] for p in prims])
    span = allp.max(0) - allp.min(0)
    scale = 1.0 if span.max() > 2 else 4.6 / span.max() if span.max() < .2 else 1.0
    if span.max() < .2:
        scale = 100.0
    for p in prims:
        p['pos'] = p['pos'] * scale
    if kind == 'mustang':
        is_wheel = lambda p: 'Wheel.' in p['name'] and p['mat'] == 'tire'
        cls = classify_mustang
    else:
        is_wheel = lambda p: ('Wheel' in p['node'] and 'Calliper' not in p['node']) or 'TireBlur' in p['mat']
        cls = classify_hennessey
        if kind == 'supra' and os.environ.get('S26_NOSURR'):
            cls = lambda p, _c=classify_hennessey: None if 'glass_surr' in p['mat'] else _c(p)
    parts = {}
    for p in prims:
        role = cls(p)
        if role is None:
            continue
        v, n, f = p['pos'], p['nor'], p['idx']
        if n is None:
            continue
        if role == 'light':
            lum = tex_luma(g, p)
            zc = v[f].mean(1)[:, 2]
            mid = (allp[:, 2].max() + allp[:, 2].min()) / 2 * scale
            front = zc > mid
            bright = lum > .42 if lum is not None else np.ones(len(f), bool)
            for r, m in (('headlight', front & bright), ('black', ~(front & bright))):
                if m.any():
                    parts.setdefault(r, []).append((v, n, f[m]))
            continue
        parts.setdefault(role, []).append((v, n, f))
    merged = {}
    for r, lst in parts.items():
        V, N, F, b = [], [], [], 0
        for v, n, f in lst:
            V.append(v); N.append(n); F.append(f + b); b += len(v)
        merged[r] = (np.concatenate(V), np.concatenate(N), np.concatenate(F))
    zf, zr, cy, cx = wheel_centres(prims, is_wheel)
    body = merged['wing'][0]
    halfw = np.percentile(np.abs(body[:, 0]), 99.7)
    return merged, (zf, zr, cy, cx, halfw)


def build(path, kind, make, key, wing=True):
    merged, (zf, zr, cy, cx, halfw) = gather(path, kind)
    fit = Fit(zf, zr, cy, halfw, make)
    print(f'{key}: wheelbase {zf - zr:.3f} -> {AXLE[make]["f"] - AXLE[make]["r"]:.3f}, half width {halfw:.3f} x{fit.sx:.3f}, arches {cx:.3f}, dy {fit.dy:+.3f}')
    fitted = {}
    for r, (v, n, f) in merged.items():
        fitted[r] = fit.apply(v, n) + (f,)
    # The road cars' door cards, pillar trims and roof liner carry the paint material on their inside faces.
    # From the right-hand seat they read as chrome shards: make anything facing into the cabin black trim.
    # Decide by position, not winding (the source meshes mix wound-in and wound-out panels): a paint triangle in
    # the cabin that has other paint or glass further out at the same spot is an inner skin -> black trim.
    from scipy import ndimage as _nd
    outer = [fitted[r][0] for r in ('wing', 'hood') if r in fitted]
    pv = np.concatenate(outer)
    CELL = .03
    def grid_max(a, b, val, lo_a, lo_b, shape):
        g = np.full(shape, -9.0)
        ia = np.clip(((a - lo_a) / CELL).astype(int), 0, shape[0] - 1)
        ib = np.clip(((b - lo_b) / CELL).astype(int), 0, shape[1] - 1)
        np.maximum.at(g, (ia, ib), val)
        return g
    zlo, xlo, ylo = -3.0, -1.3, -.2
    shp_top = (int(2.6 / CELL) + 1, int(6 / CELL) + 1)        # (x, z)
    shp_side = (int(1.8 / CELL) + 1, int(6 / CELL) + 1)       # (y, z)
    top = grid_max(pv[:, 0], pv[:, 2], pv[:, 1], xlo, zlo, shp_top)
    sideL = grid_max(pv[pv[:, 0] > 0][:, 1], pv[pv[:, 0] > 0][:, 2], pv[pv[:, 0] > 0][:, 0], ylo, zlo, shp_side)
    sideR = grid_max(pv[pv[:, 0] < 0][:, 1], pv[pv[:, 0] < 0][:, 2], -pv[pv[:, 0] < 0][:, 0], ylo, zlo, shp_side)
    def look(g, a, b, lo_a, lo_b):
        ia = np.clip(((a - lo_a) / CELL).astype(int), 0, g.shape[0] - 1)
        ib = np.clip(((b - lo_b) / CELL).astype(int), 0, g.shape[1] - 1)
        return g[ia, ib]
    for r in ('wing', 'hood'):
        if r not in fitted:
            continue
        v, n, f = fitted[r]
        c = v[f].mean(1)
        cab = (c[:, 2] > AXLE[make]['r'] + .1) & (c[:, 2] < AXLE[make]['f'] - .15) & (c[:, 1] > .3)
        ax = np.abs(c[:, 0])
        side_out = np.where(c[:, 0] > 0, look(sideL, c[:, 1], c[:, 2], ylo, zlo), look(sideR, c[:, 1], c[:, 2], ylo, zlo))
        roof_out = look(top, c[:, 0], c[:, 2], xlo, zlo)
        fw = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
        fw /= np.maximum(np.linalg.norm(fw, axis=1, keepdims=True), 1e-12)
        # inner = wound to face the cabin AND not the outermost skin at that spot
        inward = cab & (((ax > .35) & (fw[:, 0] * np.sign(c[:, 0]) < -.25) & (ax < side_out - .02))
                        | ((c[:, 1] > .9) & (fw[:, 1] < -.4) & (c[:, 1] < roof_out - .02)))
        if inward.any():
            moved = f[inward]
            fitted[r] = (v, n, f[~inward])
            vb, nb, fb = fitted.get('black', (np.zeros((0, 3)), np.zeros((0, 3)), np.zeros((0, 3), int)))
            used, inv = np.unique(moved.ravel(), return_inverse=True)
            fitted['black'] = (np.concatenate([vb, v[used]]), np.concatenate([nb, n[used]]), np.concatenate([fb, inv.reshape(-1, 3) + len(vb)]))
            print(f'   {r}: {inward.sum()} inner-skin triangles -> black trim (roof {(inward & (c[:, 1] > 1.1)).sum()})')
    # The Camaro's carbon bonnet insert reads as a black hole in every livery: paint it like the rest of the bonnet.
    if 'carbon' in fitted:
        v, n, f = fitted['carbon']
        c = v[f].mean(1)
        top = (c[:, 2] > AXLE[make]['f'] - 1.5) & (c[:, 1] > .7) & (np.abs(c[:, 0]) < .7)
        if top.any():
            used, inv = np.unique(f[top].ravel(), return_inverse=True)
            tgt = 'hood' if 'hood' in fitted else 'wing'
            vh, nh, fh = fitted[tgt]
            fitted[tgt] = (np.concatenate([vh, v[used]]), np.concatenate([nh, n[used]]), np.concatenate([fh, inv.reshape(-1, 3) + len(vh)]))
            fitted['carbon'] = (v, n, f[~top])
            print(f'   carbon bonnet insert: {top.sum()} triangles -> paint')
    # The source models' roofs are black trim panels (sitting on or above the painted roof): a Supercar's roof
    # carries the livery, so every upward-facing trim panel over the cabin becomes paint.
    if 'black' in fitted:
        v, n, f = fitted['black']
        c = v[f].mean(1)
        nu = n[f].mean(1)
        roof = (np.abs(c[:, 0]) < .72) & (c[:, 1] > 1.0) & (c[:, 2] > AXLE[make]['r'] - .2) & (c[:, 2] < AXLE[make]['f'] - .5) & (nu[:, 1] > .5)
        if roof.any():
            used, inv = np.unique(f[roof].ravel(), return_inverse=True)
            vw, nw, fw = fitted['wing']
            fitted['wing'] = (np.concatenate([vw, v[used]]), np.concatenate([nw, n[used]]), np.concatenate([fw, inv.reshape(-1, 3) + len(vw)]))
            fitted['black'] = (v, n, f[~roof])
            print(f'   black roof panel: {roof.sum()} triangles -> paint')
    # Black bonnet vent surrounds and louvre panels (the Mustang's big GT vent): on a Supercar they carry the
    # livery like the rest of the bonnet, so upward-facing trim on the bonnet becomes paint too.
    if 'black' in fitted:
        v, n, f = fitted['black']
        c = v[f].mean(1)
        nu = n[f].mean(1)
        bon = (np.abs(c[:, 0]) < .75) & (c[:, 1] > .8) & (c[:, 2] > AXLE[make]['f'] - .6) & (nu[:, 1] > .3)
        if bon.any():
            used, inv = np.unique(f[bon].ravel(), return_inverse=True)
            tgt = 'hood' if 'hood' in fitted else 'wing'
            vh, nh, fh = fitted[tgt]
            fitted[tgt] = (np.concatenate([vh, v[used]]), np.concatenate([nh, n[used]]), np.concatenate([fh, inv.reshape(-1, 3) + len(vh)]))
            fitted['black'] = (v, n, f[~bon])
            print(f'   black bonnet panels: {bon.sum()} triangles -> paint')
    # Some bodies have no roof liner or pillar trims at all, and the paint is double sided, so from the seat
    # you look at the underside of the paint. Line the cabin with a dark skin 15 mm inside the roof and glasshouse.
    liner = []
    for r in ('wing', 'hood'):
        if r not in fitted:
            continue
        v, n, f = fitted[r]
        c = v[f].mean(1)
        cab = (c[:, 2] > AXLE[make]['r'] - .1) & (c[:, 2] < AXLE[make]['f'] - .3) & (c[:, 1] > .78)
        m = cab & ((c[:, 1] > .9) | (np.abs(c[:, 0]) > .4))
        if m.any():
            used, inv = np.unique(f[m].ravel(), return_inverse=True)
            vu = v[used]
            out = np.stack([vu[:, 0], (vu[:, 1] - .55) * 1.5, np.zeros(len(vu))], 1)     # away from the cabin centre
            out /= np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-9)
            liner.append((vu - out * .015, -out, inv.reshape(-1, 3)))
    if liner and not os.environ.get('S26_NOLINER'):
        vb, nb, fb = fitted.get('black', (np.zeros((0, 3)), np.zeros((0, 3)), np.zeros((0, 3), int)))
        for lv, ln, lf in liner:
            fb = np.concatenate([fb, lf + len(vb)]); vb = np.concatenate([vb, lv]); nb = np.concatenate([nb, ln])
        fitted['black'] = (vb, nb, fb)
        print(f'   cabin liner: {sum(len(x[2]) for x in liner)} triangles')
    if os.environ.get('S26_DEBUG'):
        for r, (v, n, f) in fitted.items():
            c = v[f].mean(1)
            m = (np.abs(c[:, 0]) < .4) & (c[:, 1] > 1.05) & (c[:, 2] > AXLE[make]['r']) & (c[:, 2] < AXLE[make]['f'] - .8)
            if m.any():
                print('   ROOF', r, m.sum(), np.round(np.percentile(c[m][:, 1], [5, 50, 95]), 3))
    allv = np.concatenate([x[0] for x in fitted.values()])
    lo, hi = allv.min(0), allv.max(0)
    print('   bounds', lo.round(3), hi.round(3))
    extra = []
    if wing:
        tail_z = lo[2]
        # top of the boot lid at the tail
        b = fitted['wing'][0]
        nearb = b[(b[:, 2] < tail_z + .35) & (np.abs(b[:, 0]) < .4)]
        top_y = nearb[:, 1].max() if len(nearb) else 1.0
        extra += wing_parts(top_y, tail_z)
    # flat floor under the cabin so the road never shows through the body
    extra.append(('black',) + box((0, .11, (AXLE[make]['f'] + AXLE[make]['r']) / 2), (1.62, .02, AXLE[make]['f'] - AXLE[make]['r'] - .75)))
    # the hand-built parts are already low-poly: keep them out of the decimator
    extras = {}
    for r, V, N, F in extra:
        if r in extras:
            v0, n0, f0 = extras[r]
            extras[r] = (np.concatenate([v0, V]), np.concatenate([n0, N]), np.concatenate([f0, F + len(v0)]))
        else:
            extras[r] = (V, N, F)
        fitted.setdefault(r, (np.zeros((0, 3)), np.zeros((0, 3)), np.zeros((0, 3), int)))

    # the body's roof height over the cabin (paint), to keep the stock interior under it
    vw, _, fw = fitted['wing']
    cw = vw[fw].mean(1)
    roof_lo = (-1.2, -3.2)
    roof_hm = np.full((int(2.4 / .04) + 1, int(6.4 / .04) + 1), 9.0)
    top = cw[:, 1] > .9
    ia = np.clip(((cw[top, 0] - roof_lo[0]) / .04).astype(int), 0, roof_hm.shape[0] - 1)
    ib = np.clip(((cw[top, 2] - roof_lo[1]) / .04).astype(int), 0, roof_hm.shape[1] - 1)
    hmax = np.full(roof_hm.shape, -9.0)
    np.maximum.at(hmax, (ia, ib), cw[top, 1])
    from scipy import ndimage as _nd2
    hmax = _nd2.maximum_filter(hmax, size=3)
    roof_hm = np.where(hmax > 0, hmax, 9.0)
    # the windscreen's front-most surface over (x, y), from the glass and the paint round it
    gv = np.concatenate([fitted[r][0] for r in ('glass', 'wing', 'hood') if r in fitted])
    gv = gv[(gv[:, 1] > .8) & (gv[:, 2] > AXLE[make]['r'] + .8) & (gv[:, 2] < AXLE[make]['f'] + .2)]
    front_lo = (-1.2, 0.0)
    front_m = np.full((int(2.4 / .04) + 1, int(1.6 / .04) + 1), -9.0)
    ja = np.clip(((gv[:, 0] - front_lo[0]) / .04).astype(int), 0, front_m.shape[0] - 1)
    jb = np.clip(((gv[:, 1] - front_lo[1]) / .04).astype(int), 0, front_m.shape[1] - 1)
    np.maximum.at(front_m, (ja, jb), gv[:, 2])
    front_m = _nd2.maximum_filter(front_m, size=3)
    # the body's half width over (y, z), from paint and glass (minimum of the two sides)
    sv = np.concatenate([fitted[r][0] for r in ('glass', 'wing', 'hood') if r in fitted])
    side_lo = (0.0, -3.2)
    side_m = np.zeros((int(1.6 / .04) + 1, int(6.4 / .04) + 1))
    ka = np.clip(((sv[:, 1] - side_lo[0]) / .04).astype(int), 0, side_m.shape[0] - 1)
    kb = np.clip(((sv[:, 2] - side_lo[1]) / .04).astype(int), 0, side_m.shape[1] - 1)
    np.maximum.at(side_m, (ka, kb), np.abs(sv[:, 0]))
    side_m = _nd2.maximum_filter(side_m, size=3)
    levels = []
    spots = None
    for L in range(3):
        rows = []
        for r, (v, n, f) in fitted.items():
            tgt = BUDGET[L].get(r, 1000)
            if len(f) > tgt:
                v2, f2, n2 = decimate_shaded(v.astype(np.float32), n.astype(np.float32), f, tgt)
            else:
                v2, n2, f2 = v.astype(np.float32), n.astype(np.float32), f
            if r in extras:
                ve, ne, fe = extras[r]
                f2 = np.concatenate([np.asarray(f2).reshape(-1, 3), fe + len(v2)])
                v2 = np.concatenate([np.asarray(v2, np.float32).reshape(-1, 3), ve.astype(np.float32)])
                n2 = np.concatenate([np.asarray(n2, np.float32).reshape(-1, 3), ne.astype(np.float32)])
            if not len(f2):
                continue
            if r in ('wing', 'hood'):
                v3, n3, uv, f3 = paint_uv(v2, n2, f2)
                if r == 'hood':
                    uv = uv.copy(); uv[:, 1] = 1.5 - uv[:, 1]   # dc35RawGeometry flips hood v back
                rows += rows_for(r, v3, n3, uv, f3, key + '_' + r)
            elif r == 'glass':
                v3, n3, uv, f3, sp = glass_uv(v2, n2, f2, make)
                spots = spots or sp
                rows += rows_for(r, v3, n3, uv, f3, key + '_' + r)
            else:
                rows += rows_for(r, v2, n2, np.zeros((len(v2), 2)), f2, key + '_' + r)
        # stock race interior (mirrored to the right-hand seat), steering wheel and the race wheels
        for row in STOCK['cars'][make]['levels'][L]:
            role = row['role']
            if role.split('_')[0] in WHEEL or role in KEEP_AS_IS:
                rows.append(row)
            elif role in INTERIOR and not os.environ.get('S26_NOINT'):
                rows.append(clip_row(mirror_row(row), roof_hm, roof_lo, .04, front_m, front_lo, side_m, side_lo))
        levels.append(rows)
        print(f'   LOD{L}: {sum(r["triangles"] for r in rows)} triangles ({sum(r["triangles"] for r in rows if r.get("s26"))} body)')
    spec = dict(STOCK['cars'][make]['spec'])
    spec['model'] = {'mustang': 'Mustang GT Gen3', 'camaro': 'Camaro ZL1 Gen3', 'supra': 'GR Supra Gen3'}[kind]
    spec['s26'] = {'body': kind, 'bounds': [[float(x) for x in lo.round(4)], [float(x) for x in hi.round(4)]], 'windows': {k: [round(float(a), 4) for a in v] for k, v in (spots or {}).items()}}
    data = {'version': 2, 'spec': spec, 'levels': levels,
            'source': os.path.basename(path) + '; geometry only, fitted to the Gen3 chassis; road-car interior, wheels and running gear removed'}
    os.makedirs(OUT, exist_ok=True)
    fn = os.path.join(OUT, f'{kind}_{make.lower()}.json.gz.bin')
    with gzip.open(fn, 'wb', compresslevel=9) as fh:
        fh.write(json.dumps(data, separators=(',', ':')).encode())
    print('   wrote', fn, os.path.getsize(fn) // 1024, 'KB')
    return spec


if __name__ == '__main__':
    must, cam, sup = sys.argv[1:4]
    only = sys.argv[4:] or None
    jobs = [(must, 'mustang', 'Ford', True), (cam, 'camaro', 'Holden', True), (sup, 'supra', 'Holden', False), (sup, 'supra', 'Ford', False)]
    for path, kind, make, wing in jobs:
        if only and kind not in only:
            continue
        build(path, kind, make, kind + '_' + make.lower(), wing)
