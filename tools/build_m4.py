"""Build the BMW M4 CSL safety car asset from Riley's OBJ export.

    python3 tools/build_m4.py "path/to/m4 csl.obj"

Writes assets/safetycar_m4.gz.bin (gzipped: uint32 header length, JSON header,
then per-part float32 positions, int8 normals, uint16 indices, float32 uvs for
decals). The OBJ is a Roblox Studio export in studs with the nose at -Z; it is
rescaled to metres (4.79 m long), turned to face +Z, decimated part by part to
an Xbox-friendly budget, and given crease-split normals so the chrome reflects
cleanly. Decal parts (Safety Car script, Supercars S, Repco) are clipped from
the body surface by planar projection and textured from assets/img/sc_m4_decals.png
(built by the same script).
"""
import gzip, json, os, struct, sys
import numpy as np, trimesh, fast_simplification
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'safetycar_m4.gz.bin')
ATLAS = os.path.join(ROOT, 'assets', 'img', 'sc_m4_decals.png')
FONT = os.path.join(ROOT, 'tools', 'fonts', 'KaushanScript-Regular.ttf')
LENGTH_M = 4.79

# Duplicate lamp states and spare meshes in the export; keeping them z-fights.
DROP = {'Ln9', 'Ln10', 'Ln11', 'Ln12', 'Ln14', 'Ln15', 'Ln16', 'Ln17', 'Ln18',
        'Spare1', 'Spare2', 'Spare3', 'Spare4', 'BadgeStage11', 'BadgeStage21', 'Parts1'}
BY_GROUP = {'Carbon2': 'chrome', 'Mirror1': 'chrome', 'Metal1': 'chrome',
            'Ln1': 'amber', 'Ln5': 'amber', 'Ln2': 'head', 'Ln4': 'head', 'Ln13': 'drl', 'Ddrl1': 'drl',
            'Ln3': 'tail', 'Ln6': 'tail', 'Ln7': 'tail', 'Ln8': 'tail'}
BY_MTL = {'Metal1Mtl': 'chrome', 'Livery1Mtl': 'chrome', 'MainBadge1Mtl': 'chrome', 'BadgeStage31Mtl': 'chrome',
          'Badge1Mtl': 'chrome', 'Carbon1Mtl': 'carbon', 'Casing1Mtl': 'trim', 'Casing5Mtl': 'trim',
          'Intercooler1Mtl': 'trim', 'Glass1Mtl': 'glass', 'Underbody1Mtl': 'under', 'Exhaust1Mtl': 'exhaust',
          'Rim1Mtl': 'rim', 'Tire1Mtl': 'rubber', 'Caliper1Mtl': 'caliper', 'Rotors1Mtl': 'rotor',
          'InnerRotor1Mtl': 'rotor'}
# Face budget per material class (whole car), roughly 50k triangles in all.
# Chrome keeps full detail: decimation ripples show up in the reflections.
BUDGET = {'chrome': 40000, 'carbon': 2600, 'trim': 5200, 'glass': 3300, 'under': 500, 'exhaust': 600,
          'rim': 5200, 'rubber': 2600, 'caliper': 900, 'rotor': 500, 'interior': 3000,
          'head': 900, 'drl': 700, 'tail': 1900, 'amber': 170}


def parse(path):
    V, groups, cur, g = [], [], None, '?'
    with open(path) as f:
        for line in f:
            t = line[:2]
            if t == 'v ':
                V.append(line[2:].split())
            elif t == 'f ':
                idx = [int(p.split('/')[0]) - 1 for p in line[2:].split()]
                for k in range(1, len(idx) - 1):
                    cur[2].append((idx[0], idx[k], idx[k + 1]))
            elif t == 'g ':
                g = line[2:].strip()
            elif line.startswith('usemtl'):
                cur = (g, line.split()[1], [])
                groups.append(cur)
    return np.array(V, dtype=np.float64), [(g, m, np.array(f)) for g, m, f in groups if f]


def classify(g, m):
    if g in BY_GROUP:
        return BY_GROUP[g]
    return BY_MTL.get(m, 'interior')


def crease_mesh(v, f, angle=38):
    """Weld, then split vertices along edges sharper than `angle` degrees."""
    mesh = trimesh.Trimesh(v, f, process=True)
    mesh.remove_unreferenced_vertices()
    s = trimesh.graph.smooth_shade(mesh, angle=np.radians(angle), facet_minarea=None)
    return np.asarray(s.vertices, np.float32), np.asarray(s.faces, np.int64), np.asarray(s.vertex_normals, np.float32)


def decimate(v, f, target):
    mesh = trimesh.Trimesh(v, f, process=True)
    if len(mesh.faces) <= target * 1.15:
        return mesh.vertices, mesh.faces
    ratio = 1 - target / len(mesh.faces)
    vo, fo = fast_simplification.simplify(mesh.vertices, mesh.faces, ratio, agg=5)
    return vo, fo


# ---------- decals ----------
def build_atlas():
    """Atlas 2048x1024: [0] Safety Car script (top 2048x512), [1] S logo, [2] Repco."""
    W, H = 2048, 1024
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    # Safety Car: red script with a dark keyline and a speed swoosh, tilted up.
    txt = Image.new('RGBA', (2048, 512), (0, 0, 0, 0))
    d = ImageDraw.Draw(txt)
    font = ImageFont.truetype(FONT, 250)
    box = d.textbbox((0, 0), 'Safety Car', font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    ox, oy = (2048 - tw) // 2 - box[0], (512 - th) // 2 - box[1] - 20
    d.text((ox, oy), 'Safety Car', font=font, fill=(18, 18, 22, 255), stroke_width=14, stroke_fill=(18, 18, 22, 255))
    d.text((ox, oy), 'Safety Car', font=font, fill=(226, 30, 38, 255))
    # underline swoosh
    sw = Image.new('RGBA', (2048, 512), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sw)
    y0 = oy + box[3] + 28
    sd.polygon([(ox + 40, y0 + 22), (ox + tw + 60, y0 - 6), (ox + tw + 10, y0 + 12), (ox + 60, y0 + 34)], fill=(18, 18, 22, 255))
    sd.polygon([(ox + 52, y0 + 20), (ox + tw + 40, y0 - 2), (ox + tw + 4, y0 + 10), (ox + 66, y0 + 28)], fill=(226, 30, 38, 255))
    txt = Image.alpha_composite(sw, txt)
    txt = txt.rotate(7, resample=Image.BICUBIC, center=(1024, 256))
    atlas.paste(txt, (0, 0))
    # Supercars S from the championship logo (red on white -> alpha).
    logo = Image.open(os.path.join(ROOT, 'assets', 'img', 'e30432e1ce.jpg')).convert('RGB')
    s = logo.crop((270, 50, 1020, 425))
    a = np.asarray(s).astype(np.float32)
    redness = np.clip((a[..., 0] - (a[..., 1] + a[..., 2]) / 2 - 40) / 90, 0, 1)
    rgba = np.zeros(a.shape[:2] + (4,), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2], rgba[..., 3] = 233, 39, 36, (redness * 255).astype(np.uint8)
    s = Image.fromarray(rgba, 'RGBA').resize((1000, 500), Image.LANCZOS)
    atlas.paste(s, (12, 512 + 6))
    # Repco: keep the official mark, key out the cream background, white keyline for chrome.
    rep = Image.open(os.path.join(ROOT, 'assets', 'img', 'repco-707ab89010.png')).convert('RGBA')
    ra = np.asarray(rep).astype(np.float32)
    bg = np.array([247, 247, 242], np.float32)
    dist = np.abs(ra[..., :3] - bg).max(-1)
    alpha = np.clip((dist - 18) / 50, 0, 1) * (ra[..., 3] / 255)
    out = ra.copy()
    out[..., 3] = alpha * 255
    rep = Image.fromarray(out.astype(np.uint8), 'RGBA').resize((960, 160), Image.LANCZOS)
    plate = Image.new('RGBA', (1000, 200), (0, 0, 0, 0))
    halo = rep.split()[3].filter(ImageFilter.MaxFilter(13))
    plate.paste(Image.new('RGBA', rep.size, (250, 250, 250, 255)), (20, 20), halo)
    plate.alpha_composite(rep, (20, 20))
    atlas.paste(plate, (1036, 512 + 156))
    os.makedirs(os.path.dirname(ATLAS), exist_ok=True)
    atlas.save(ATLAS, optimize=True)
    # atlas rects (u0, v0, u1, v1) in UV space (v up)
    def r(x, y, w, h):
        return (x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H)
    return {'script': r(0, 0, 2048, 512), 's': r(12, 518, 1000, 500), 'repco': r(1036, 668, 1000, 200)}


def clip_poly(poly, axis, val, keep_greater):
    out = []
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        ina = a[axis] >= val if keep_greater else a[axis] <= val
        inb = b[axis] >= val if keep_greater else b[axis] <= val
        if ina:
            out.append(a)
        if ina != inb:
            t = (val - a[axis]) / (b[axis] - a[axis])
            out.append(a + (b - a) * t)
    return out


def make_decal(v, f, n, origin, right, up, size, facing, rect, depth=.3, lift=0.006):
    """Project body triangles facing `facing` onto the plane (right, up) and clip to size."""
    right, up, facing = (np.asarray(x, np.float64) for x in (right, up, facing))
    w, h = size
    pos, nor, uv = [], [], []
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    fn /= np.linalg.norm(fn, axis=1, keepdims=True) + 1e-12
    rel = v - origin
    pu, pv, pd = rel @ right, rel @ up, rel @ facing
    for i, tri in enumerate(f):
        if fn[i] @ facing < 0.25 or abs(pd[tri].mean()) > depth:
            continue
        us, vs = pu[tri], pv[tri]
        if us.max() < -w / 2 or us.min() > w / 2 or vs.max() < -h / 2 or vs.min() > h / 2:
            continue
        # polygon in (u, v, x, y, z, nx, ny, nz)
        poly = [np.concatenate(([us[k], vs[k]], v[tri[k]], n[tri[k]])) for k in range(3)]
        for axis, val, g in ((0, -w / 2, True), (0, w / 2, False), (1, -h / 2, True), (1, h / 2, False)):
            poly = clip_poly(poly, axis, val, g)
            if len(poly) < 3:
                break
        if len(poly) < 3:
            continue
        for k in range(1, len(poly) - 1):
            for p in (poly[0], poly[k], poly[k + 1]):
                nn = p[5:8] / (np.linalg.norm(p[5:8]) + 1e-12)
                pos.append(p[2:5] + nn * lift)
                nor.append(nn)
                su, sv = p[0] / w + .5, p[1] / h + .5
                uv.append((rect[0] + su * (rect[2] - rect[0]), rect[1] + sv * (rect[3] - rect[1])))
    pos, nor, uv = np.array(pos, np.float32), np.array(nor, np.float32), np.array(uv, np.float32)
    return pos, nor, np.arange(len(pos)), uv


def main(path):
    V, groups = parse(path)
    body = np.concatenate([f.ravel() for g, m, f in groups if classify(g, m) == 'chrome'])
    bmin, bmax = V[body].min(0), V[body].max(0)
    scale = LENGTH_M / (bmax[2] - bmin[2])
    cx, cz = (bmin[0] + bmax[0]) / 2, (bmin[2] + bmax[2]) / 2
    ymin = V[:, 1].min()
    G = np.empty_like(V)
    G[:, 0] = (cx - V[:, 0]) * scale
    G[:, 1] = (V[:, 1] - ymin) * scale
    G[:, 2] = (cz - V[:, 2]) * scale

    # Collect faces per (class, wheel); wheel parts spin, so keep them per corner.
    buckets = {}
    tot = {}
    split = []
    for g, m, f in groups:
        if g in DROP:
            continue
        c = classify(g, m)
        cen = G[f].mean(1)
        if c == 'carbon':
            # carbon bonnet stripes go chrome with the rest of the body
            top = (np.abs(cen[:, 0]) < .4) & (cen[:, 1] > .78) & (cen[:, 2] > .95) & (cen[:, 2] < 2.05)
            if top.any():
                split.append((g + '_top', 'chrome', f[top]))
            f = f[~top]
        if c == 'interior':
            f = f[cen[:, 1] < 1.24]  # headliner pokes through the decimated roof
        if len(f):
            split.append((g, c, f))
    for g, c, f in split:
        wheel = -1
        if c in ('rim', 'rubber', 'rotor'):
            p = G[f.ravel()].mean(0)
            wheel = (0 if p[0] > 0 else 1) + (0 if p[2] > 0 else 2)  # 0 FL 1 FR 2 RL 3 RR
        buckets.setdefault((c, wheel), []).append(f)
        tot[c] = tot.get(c, 0) + len(f)
    parts = []
    chrome_mesh = None
    wheel_centres = {}
    for (c, wheel), fl in sorted(buckets.items()):
        f = np.concatenate(fl)
        share = len(f) / tot[c]
        target = max(60, int(BUDGET[c] * share))
        vd, fd = [], []
        off = 0
        # decimate each source group separately so panels keep their edges
        for sub in fl:
            t = max(12, int(target * len(sub) / len(f)))
            vv, ff = decimate(G, sub, t)
            vd.append(vv); fd.append(ff + off); off += len(vv)
        vv, ff = np.concatenate(vd), np.concatenate(fd)
        v2, f2, n2 = crease_mesh(vv, ff, 60 if c in ('rubber', 'rim', 'interior') else 38)
        part = {'mat': c, 'wheel': wheel, 'v': v2, 'f': f2, 'n': n2}
        if wheel >= 0:
            if c == 'rubber':
                lo, hi = v2.min(0), v2.max(0)
                wheel_centres[wheel] = [float((lo[0] + hi[0]) / 2), float((lo[1] + hi[1]) / 2), float((lo[2] + hi[2]) / 2), float((hi[1] - lo[1]) / 2)]
        parts.append(part)
        if c == 'chrome':
            chrome_mesh = (v2, f2, n2)
        print(f'{c:9s} wheel {wheel:2d}: {len(f):6d} -> {len(f2):6d} faces, {len(v2)} verts')
    # Wheel parts are stored relative to their hub so they can spin.
    for p in parts:
        if p['wheel'] >= 0:
            p['v'] = p['v'] - np.array(wheel_centres[p['wheel']][:3], np.float32)

    rects = build_atlas()
    v, f, n = chrome_mesh
    lo, hi = v.min(0), v.max(0)
    print('body bounds', lo.round(3), hi.round(3))
    decals = []
    # Sides: script over the doors, reading front-to-back on the left (+X) side.
    for side in (1, -1):
        right = (0, 0, -side)
        pos, nor, idx, uv = make_decal(v, f, n, np.array([side * 1.2, .62, -.15]), right, (0, 1, 0), (2.45, .62),
                                       (side, 0, 0), rects['script'], .5)
        decals.append({'mat': 'decal', 'v': pos, 'n': nor, 'f': idx.reshape(-1, 3), 'uv': uv})
    # Front: S on the nose of the bonnet, Repco just under it above the kidney grilles.
    def facing(y, z):
        d = np.array([0, y, z], np.float64); return d / np.linalg.norm(d)
    def up_of(d):
        u = np.cross(d, [1, 0, 0]); return u if u[1] > 0 else -u
    fwd = facing(.62, 1)
    pos, nor, idx, uv = make_decal(v, f, n, np.array([0, .825, 2.0]), (1, 0, 0), up_of(fwd), (.42, .21), fwd, rects['s'], .12)
    decals.append({'mat': 'decal', 'v': pos, 'n': nor, 'f': idx.reshape(-1, 3), 'uv': uv})
    nose = facing(.9, 1)
    pos, nor, idx, uv = make_decal(v, f, n, np.array([0, .705, 2.255]), (1, 0, 0), up_of(nose), (.5, .083), nose, rects['repco'], .1)
    decals.append({'mat': 'decal', 'v': pos, 'n': nor, 'f': idx.reshape(-1, 3), 'uv': uv})
    # Boot: Repco across the flat of the boot lid, in front of the lip spoiler.
    back = facing(1, -.3)
    pos, nor, idx, uv = make_decal(v, f, n, np.array([0, .975, -2.09]), (-1, 0, 0), up_of(back), (.6, .1), back, rects['repco'], .07)
    decals.append({'mat': 'decal', 'v': pos, 'n': nor, 'f': idx.reshape(-1, 3), 'uv': uv})
    for d in decals:
        print('decal faces', len(d['f']))
    parts += [d for d in decals if len(d['f'])]

    header = {'version': 1, 'wheels': [wheel_centres[i] for i in range(4)], 'roof': float(hi[1]),
              'bounds': [lo.tolist(), hi.tolist()], 'parts': []}
    blobs, off = [], 0
    def push(arr):
        nonlocal off
        b = arr.tobytes()
        pad = (-len(b)) % 4
        blobs.append(b + b'\0' * pad)
        start = off
        off += len(b) + pad
        return start
    for p in parts:
        vcount = len(p['v'])
        assert vcount < 65536
        e = {'mat': p['mat'], 'wheel': p.get('wheel', -1), 'vcount': vcount, 'icount': int(p['f'].size)}
        e['pos'] = push(np.asarray(p['v'], np.float32))
        nn = np.asarray(p['n'], np.float32)
        nn = nn / (np.linalg.norm(nn, axis=1, keepdims=True) + 1e-9)
        e['nor'] = push(np.round(nn * 127).astype(np.int8))
        e['idx'] = push(np.asarray(p['f'], np.uint16).ravel())
        if 'uv' in p:
            e['uv'] = push(np.asarray(p['uv'], np.float32))
        header['parts'].append(e)
    hj = json.dumps(header, separators=(',', ':')).encode()
    hj += b' ' * ((-len(hj)) % 4)
    data = struct.pack('<I', len(hj)) + hj + b''.join(blobs)
    with open(OUT, 'wb') as fo:
        fo.write(gzip.compress(data, 9, mtime=0))
    faces = sum(p['icount'] for p in header['parts']) // 3
    print(f'{OUT}: {faces} faces, {len(data)} bytes raw, {os.path.getsize(OUT)} gz')


if __name__ == '__main__':
    main(sys.argv[1])
