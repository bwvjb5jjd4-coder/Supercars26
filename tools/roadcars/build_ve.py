"""Build the four VE Commodore road cars from Riley's GLB pack.

    python3 tools/roadcars/build_ve.py "path/to/Holden Commodore VE Ute, Sedan, racecar and Wagon.glb"

Writes assets/roadcars/ve_<key>.gz.bin for key in sedan, ute, wagon, v8 (same container as
assets/safetycar_m4.gz.bin: gzipped uint32 header length, JSON header, then per-part float32
positions, int8 normals, uint16 indices).

The pack is a Blender export in centimetres, nose at +Z, 0.75-1.2 million triangles per car and
no textures. Each car is rescaled to its real wheelbase (VE sedan/wagon 2.915 m, ute 3.009 m),
centred on its body, then decimated material by material to a budget an Xbox can hold at 60 fps
(about 95k triangles for the whole car, plus a 3k triangle shadow proxy). Lamp lenses keep far more
of their detail than the body because that is where the eye goes. Wheels are stored per corner,
relative to their hub, so they spin and steer.
"""
import ctypes, gzip, json, os, sys
import numpy as np, trimesh, meshoptimizer
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import glb  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'assets', 'roadcars')
NODES = {'Holden_Commodore_VE_sedan_2012': 'sedan', 'Holden_Commodore_VE_ute_2012': 'ute',
         'Holden_Commodore_VE_sportwagon_2012': 'wagon', 'Holden_Commodore_V8_Supercar_2012': 'v8'}
WHEELBASE = {'sedan': 2.915, 'ute': 3.009, 'wagon': 2.915, 'v8': 2.915}
MAT = {'black': 'trim', 'carpaint': 'paint', 'windowglass': 'glass', 'clearglass': 'lens', 'chrome': 'chrome',
       'orangeglass': 'amber', 'mirror': 'mirror', 'interior': 'interior', 'mattemetal': 'metal',
       'brakedisk': 'rotor', 'tire': 'rubber', 'rim': 'rim', 'redglass': 'tail', 'red': 'red',
       'Material__1': 'plate', 'Material__2': 'plateink', 'Material__3': 'plateink', 'Material__4': 'plateink'}
# Triangle budgets for the whole car (wheel parts share theirs across the four corners).
BUDGET = {'seat': 5000, 'dash': 2600, 'door': 1800, 'headliner': 900, 'carpet': 1400, 'paint': 60000, 'trim': 18000, 'chrome': 9000, 'glass': 2400, 'lens': 5200, 'reverse': 1400,
          'amber': 400, 'mirror': 500, 'interior': 7000, 'metal': 2600, 'rotor': 1200, 'rubber': 5600,
          'rim': 9000, 'tail': 7000, 'red': 900, 'plate': 600, 'plateink': 2400, 'reflector': 2600}
CREASE = {'seat': 60, 'dash': 60, 'door': 60, 'headliner': 60, 'carpet': 60, 'rubber': 60, 'rim': 50, 'interior': 60, 'metal': 60, 'rotor': 60}
WHEEL_PARTS = ('rubber', 'rim', 'rotor')
ERROR = .0035  # relative to the part's size: about 1.5 cm on a body shell


def weld(v, f):
    m = trimesh.Trimesh(v, f, process=True)
    m.remove_unreferenced_vertices()
    return m


def decimate(v, f, target, sloppy=False, error=None):
    """meshoptimizer quadric simplification; tiny shells are pruned, sloppy collapse as a last resort."""
    m = weld(v, f)
    V, F = np.ascontiguousarray(m.vertices, np.float32), np.ascontiguousarray(m.faces, np.uint32)
    target = int(max(4, target))
    if len(F) <= target * 1.1:
        return np.asarray(m.vertices), np.asarray(m.faces)
    dst = np.zeros(F.size, np.uint32)
    if not sloppy:
        n = meshoptimizer.simplify(dst, F.ravel(), V, target_index_count=target * 3, target_error=error or ERROR,
                                   options=meshoptimizer.SIMPLIFY_PRUNE)
    if sloppy or n > target * 3 * 1.35:
        n = meshoptimizer.simplify_sloppy(dst, F.ravel(), V, target_index_count=target * 3, target_error=.05)
    return np.asarray(m.vertices), dst[:n].reshape(-1, 3).astype(np.int64)


def _simplify_attr(dst, F, V, A, w, target, err):
    """meshopt_simplifyWithAttributes through ctypes with full argtypes (the pip binding passes untyped floats)."""
    from meshoptimizer._loader import lib
    fn = lib.meshopt_simplifyWithAttributes
    P = ctypes.POINTER
    fn.argtypes = [P(ctypes.c_uint), P(ctypes.c_uint), ctypes.c_size_t, P(ctypes.c_float), ctypes.c_size_t, ctypes.c_size_t,
                   P(ctypes.c_float), ctypes.c_size_t, P(ctypes.c_float), ctypes.c_size_t, P(ctypes.c_ubyte),
                   ctypes.c_size_t, ctypes.c_float, ctypes.c_uint, P(ctypes.c_float)]
    fn.restype = ctypes.c_size_t
    c = lambda a, t: a.ctypes.data_as(P(t))
    return fn(c(dst, ctypes.c_uint), c(F, ctypes.c_uint), F.size, c(V, ctypes.c_float), len(V), 12, c(A, ctypes.c_float), A.shape[1] * 4,
              c(w, ctypes.c_float), len(w), P(ctypes.c_ubyte)(), target, err, meshoptimizer.SIMPLIFY_PRUNE, P(ctypes.c_float)())


def decimate_shaded(v, n, f, target):
    """Simplify keeping the artist's vertex normals: identical position+normal vertices are welded, the
    rest stay as seams, and the attribute metric stops collapses that would bend the shading."""
    n = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-9)
    key = np.concatenate([np.round(v * 2e4), np.round(n * 200)], 1).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    v, n, f = v[first], n[first], inv.ravel()[f]
    f = f[(f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
    target = int(max(4, target))
    if len(f) > target * 1.1:
        V, A = np.ascontiguousarray(v, np.float32), np.ascontiguousarray(n, np.float32)
        F = np.ascontiguousarray(f, np.uint32).ravel()
        dst = np.zeros(F.size, np.uint32)
        k = _simplify_attr(dst, F, V, A, np.array([.6, .6, .6], np.float32), target * 3, ERROR)
        if k > target * 3 * 1.4:
            k = meshoptimizer.simplify_sloppy(dst, F, V, target_index_count=target * 3, target_error=ERROR * 4)
        f = dst[:k].reshape(-1, 3).astype(np.int64)
    used, inv = np.unique(f.ravel(), return_inverse=True)
    return v[used].astype(np.float32), inv.reshape(-1, 3), n[used].astype(np.float32)


def crease_mesh(v, f, angle=36):
    m = weld(v, f)
    if not len(m.faces):
        return np.zeros((0, 3), np.float32), np.zeros((0, 3), np.int64), np.zeros((0, 3), np.float32)
    s = trimesh.graph.smooth_shade(m, angle=np.radians(angle), facet_minarea=None)
    return np.asarray(s.vertices, np.float32), np.asarray(s.faces, np.int64), np.asarray(s.vertex_normals, np.float32)


def transfer_normals(v, n, src_v, src_n):
    """Give decimated vertices the artist's smooth normals from the full-detail mesh, so the paint reflects
    like the original instead of showing the facets of the lighter mesh. At creases the source normal that best
    matches the crease-split normal wins; anything far from the original surface keeps its computed normal."""
    if not len(v):
        return n
    tree = cKDTree(src_v)
    d, idx = tree.query(v, k=min(16, len(src_v)))
    cand = src_n[idx]
    cand = cand / (np.linalg.norm(cand, axis=2, keepdims=True) + 1e-9)
    dots = (cand * n[:, None, :]).sum(-1) - (d / .02) * .15
    best = dots.argmax(1)
    pick = cand[np.arange(len(v)), best]
    ok = ((pick * n).sum(1) > .55) & (d[np.arange(len(v)), best] < .03)
    out = n.copy()
    out[ok] = pick[ok]
    return out


def chunks(v, f, n, ao, limit=65000):
    """Split a part into pieces under the uint16 index limit."""
    if len(v) <= limit:
        yield v, f, n, ao
        return
    order = np.argsort(v[f].mean(1)[:, 2])
    step = max(1, len(f) * limit // (len(v) * 2))
    for s in range(0, len(f), step):
        ff = f[order[s:s + step]]
        used, inv = np.unique(ff.ravel(), return_inverse=True)
        yield v[used], inv.reshape(-1, 3), n[used], ao[used]


def cabin_groups(G, F, cabin):
    """Split the pack's one-material cabin into dash, seats, door trims, headlining and carpet by connected
    piece, and drop its left-hand-drive steering wheel and column (the game builds a right-hand-drive VE
    wheel and dash detail). Records the dash and seat bounds so the cabin detail can be placed per body."""
    m = trimesh.Trimesh(G, F, process=False)
    m.merge_vertices()
    labels = trimesh.graph.connected_component_labels(m.face_adjacency, node_count=len(F))
    out = {}
    for lab in np.unique(labels):
        ff = F[labels == lab]
        q = G[np.unique(ff)]
        lo, hi = q.min(0), q.max(0)
        ctr = (lo + hi) / 2
        if lo[0] > .15 and hi[0] < .75 and lo[2] > .38 and hi[2] < .9 and lo[1] > .5 and hi[1] < 1.05 and len(ff) > 1000:
            cabin['dropped_wheel'] = [lo.tolist(), hi.tolist()]
            continue
        if lo[1] > 1.28:
            g = 'headliner'
        elif min(abs(lo[0]), abs(hi[0])) > .7 and np.sign(lo[0]) == np.sign(hi[0]):
            g = 'door'
        elif lo[2] > .45 and hi[0] - lo[0] > 1.2:
            g = 'dash'
            cabin['dash'] = [lo.tolist(), hi.tolist()]
        elif lo[2] > .45:
            g = 'dash'
        elif hi[2] - lo[2] > 2.0:
            g = 'carpet'
        elif lo[1] > 1.18 and abs(ctr[0]) < .2 and lo[2] > 0:
            g = 'trim'
        else:
            g = 'seat'
            if hi[2] > -.5 and ctr[0] < -.1 and hi[1] - lo[1] > .3:
                cabin.setdefault('seats', []).append([lo.tolist(), hi.tolist()])
        out.setdefault(g, []).append(ff)
    return [(g, np.concatenate(v)) for g, v in out.items()]


def bake_ao(parts, rays=24, reach=.55):
    """Ambient occlusion per vertex (embree ray casts against the whole car), so panel gaps, arches,
    grille, footwells and seat creases darken the way real light does."""
    solid = [p for p in parts if p['mat'] not in ('glass', 'lens', 'reverse', 'tail', 'amber', 'shadow')]
    V = np.concatenate([p['v'] for p in solid]); offs = np.cumsum([0] + [len(p['v']) for p in solid])
    Fa = np.concatenate([p['f'] + o for p, o in zip(solid, offs[:-1])])
    scene = trimesh.Trimesh(V, Fa, process=False)
    ray = trimesh.ray.ray_pyembree.RayMeshIntersector(scene) if trimesh.ray.has_embree else scene.ray
    rng = np.random.default_rng(7)
    u1, u2 = rng.random(rays), rng.random(rays)
    # cosine-weighted hemisphere directions around +Z
    local = np.stack([np.sqrt(u1) * np.cos(2 * np.pi * u2), np.sqrt(u1) * np.sin(2 * np.pi * u2), np.sqrt(1 - u1)], 1)
    for p in parts:
        v, n = p['v'].astype(np.float64), p['n'].astype(np.float64)
        n = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-9)
        if p['mat'] in ('glass', 'lens', 'reverse', 'tail', 'amber', 'shadow') or not len(v):
            p['ao'] = np.full(len(v), 255, np.uint8)
            continue
        a = np.where(np.abs(n[:, 0:1]) < .9, np.array([[1., 0, 0]]), np.array([[0, 1., 0]]))
        t = np.cross(n, a); t /= np.linalg.norm(t, axis=1, keepdims=True); b = np.cross(n, t)
        dirs = (local[None, :, 0:1] * t[:, None] + local[None, :, 1:2] * b[:, None] + local[None, :, 2:3] * n[:, None]).reshape(-1, 3)
        orig = np.repeat(v + n * .004, rays, 0)
        hit = np.zeros(len(dirs), bool)
        for s0 in range(0, len(dirs), 400000):
            sl = slice(s0, s0 + 400000)
            loc, idx_ray, _ = ray.intersects_location(orig[sl], dirs[sl], multiple_hits=False)
            if len(idx_ray):
                d = np.linalg.norm(loc - orig[sl][idx_ray], axis=1)
                hit[s0 + idx_ray[d < reach]] = True
        occ = hit.reshape(len(v), rays).mean(1)
        p['ao'] = np.clip(255 * (1 - .82 * occ), 0, 255).astype(np.uint8)


def build(car):
    key = NODES[car['name']]
    prims = [(MAT.get(p['mat'], 'trim'), p['pos'], p['nor'], p['idx']) for p in car['prims']]
    paint = np.concatenate([P[np.unique(F)] for c, P, N, F in prims if c == 'paint'])
    tyres = np.concatenate([P[np.unique(F)] for c, P, N, F in prims if c == 'rubber'])
    front, rear = tyres[tyres[:, 2] > 0], tyres[tyres[:, 2] < 0]
    wb = ((front[:, 2].min() + front[:, 2].max()) - (rear[:, 2].min() + rear[:, 2].max())) / 2
    scale = WHEELBASE[key] / wb
    lo, hi = paint.min(0), paint.max(0)
    cx, cz = (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2
    ymin = tyres[:, 1].min()

    def tf(P):
        G = np.empty_like(P)
        G[:, 0] = (P[:, 0] - cx) * scale
        G[:, 1] = (P[:, 1] - ymin) * scale
        G[:, 2] = (P[:, 2] - cz) * scale
        return G

    buckets, tot = {}, {}
    body_shadow, plate_pts, lamp_pts = [], [], {}
    cabin = {}
    for c, P, N, F in prims:
        G = tf(P)
        cen = G[F].mean(1)
        groups = []
        if c == 'lens':
            # Clear lenses at the back are the reversing lamps; at the front they cover the headlamps.
            groups += [('lens', F[cen[:, 2] > 0]), ('reverse', F[cen[:, 2] <= 0])]
        elif c == 'chrome':
            # Chrome inside the lamp housings becomes the lamp reflector bowls.
            lamp = ((cen[:, 2] > 1.95) & (cen[:, 1] > .58) & (cen[:, 1] < 1.02) & (np.abs(cen[:, 0]) > .38)) | \
                   ((cen[:, 2] < -1.95) & (cen[:, 1] > .5) & (np.abs(cen[:, 0]) > .3))
            groups += [('reflector', F[lamp]), ('chrome', F[~lamp])]
        elif c == 'interior':
            groups += cabin_groups(G, F, cabin)
        else:
            groups.append((c, F))
        for g, ff in groups:
            if not len(ff):
                continue
            if g in ('paint', 'glass', 'trim'):
                body_shadow.append((G, N, ff))
            if g in ('plate', 'plateink'):
                # Number plates are redrawn at runtime (the pack's say HUMSTER3D); keep only their outline.
                plate_pts.append(G[np.unique(ff)]) if g == 'plate' else None
                continue
            if g in ('lens', 'tail'):
                lamp_pts.setdefault(g, []).append(G[np.unique(ff)])
            if g in WHEEL_PARTS:
                cc = G[ff].mean(1)
                for w, (sx, sz) in enumerate(((1, 1), (-1, 1), (1, -1), (-1, -1))):
                    sel = ff[(np.sign(cc[:, 0]) == sx) & (np.sign(cc[:, 2]) == sz)]
                    if len(sel):
                        buckets.setdefault((g, w), []).append((G, N, sel))
                        tot[g] = tot.get(g, 0) + len(sel)
            else:
                buckets.setdefault((g, -1), []).append((G, N, ff))
                tot[g] = tot.get(g, 0) + len(ff)

    parts, centres = [], {}
    for (c, w), fl in sorted(buckets.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        n = sum(len(ff) for G, N, ff in fl)
        target = max(40, int(BUDGET.get(c, 2000) * n / tot[c]))
        vs, fs, ns, off = [], [], [], 0
        for G, N, ff in fl:
            used, inv = np.unique(ff.ravel(), return_inverse=True)
            if c in WHEEL_PARTS:
                # Wheels are small and spin, so plain decimation with crease normals is enough.
                vv, f2 = decimate(G[used], inv.reshape(-1, 3), target * len(ff) / n)
                vv, f2, nn = crease_mesh(vv, f2, CREASE.get(c, 36))
            else:
                vv, f2, nn = decimate_shaded(G[used], N[used], inv.reshape(-1, 3), target * len(ff) / n)
            vs.append(vv); fs.append(f2 + off); ns.append(nn); off += len(vv)
        v2, f2, n2 = np.concatenate(vs), np.concatenate(fs), np.concatenate(ns)
        if not len(f2):
            continue
        if c == 'rubber':
            a, b = v2.min(0), v2.max(0)
            centres[w] = [float((a[0] + b[0]) / 2), float((a[1] + b[1]) / 2), float((a[2] + b[2]) / 2), float((b[1] - a[1]) / 2)]
        print(f'  {key:6s} {c:10s} wheel {w:2d}: {n:7d} -> {len(f2):6d} tris, {len(v2)} verts')
        parts.append({'mat': c, 'wheel': w, 'v': v2, 'f': f2, 'n': n2})
    print(f'  {key:6s} baking ambient occlusion...')
    bake_ao(parts)
    for p in parts:
        if p['wheel'] >= 0:
            p['v'] = p['v'] - np.array(centres[p['wheel']][:3], np.float32)
    # Shadow proxy: the body shell at a fraction of the detail; it only ever draws into the shadow map.
    vs, fs, off = [], [], 0
    for G, N, ff in body_shadow:
        used, inv = np.unique(ff.ravel(), return_inverse=True)
        vs.append(G[used]); fs.append(inv.reshape(-1, 3) + off); off += len(used)
    sv, sf = decimate(np.concatenate(vs), np.concatenate(fs), 4000, error=.01)
    sv, sf, sn = crease_mesh(sv, sf, 80)
    parts.append({'mat': 'shadow', 'wheel': -1, 'v': sv, 'f': sf, 'n': sn, 'ao': np.full(len(sv), 255, np.uint8)})
    print(f'  {key:6s} shadow: {len(sf)} tris')

    # Plate rectangles (centre, outward normal, right, up, width, height) and lamp centres for the bulbs.
    plates = []
    if plate_pts and key != 'v8':
        pts = np.concatenate(plate_pts)
        for side in (1, -1):
            q = pts[np.sign(pts[:, 2]) == side]
            if len(q) < 8:
                continue
            c0 = q.mean(0)
            u_, s_, vt = np.linalg.svd(q - c0, full_matrices=False)
            nrm = vt[2] * (1 if vt[2][2] * side > 0 else -1)
            # Plates sit level: right runs across the car, up is whatever is left.
            right = np.array([side, 0., 0.]); right -= nrm * (right @ nrm); right /= np.linalg.norm(right)
            up = np.cross(nrm, right); up *= 1 if up[1] > 0 else -1
            a, b = (q - c0) @ right, (q - c0) @ up
            ctr = c0 + right * (a.max() + a.min()) / 2 + up * (b.max() + b.min()) / 2
            front_face = ((q - c0) @ nrm).max()
            plates.append({'c': (ctr + nrm * (front_face + .003)).tolist(), 'n': nrm.tolist(), 'r': right.tolist(), 'u': up.tolist(),
                           'w': float(a.max() - a.min()), 'h': float(b.max() - b.min())})
    lamps = {}
    for g, pl in lamp_pts.items():
        pts = np.concatenate(pl)
        lamps[g] = []
        for side in (1, -1):
            q = pts[np.sign(pts[:, 0]) == side]
            if g == 'lens':
                q = q[q[:, 2] > 1.8]
            if len(q):
                lo_, hi_ = q.min(0), q.max(0)
                lamps[g].append({'lo': lo_.tolist(), 'hi': hi_.tolist()})
    allv = np.concatenate([p['v'] for p in parts if p['wheel'] < 0 and p['mat'] == 'paint'])
    blo, bhi = allv.min(0), allv.max(0)
    header = {'version': 1, 'key': key, 'wheels': [centres[i] for i in range(4)], 'roof': float(bhi[1]),
              'bounds': [blo.tolist(), bhi.tolist()], 'plates': plates, 'lamps': lamps, 'cabin': cabin, 'parts': []}
    blobs, off = [], 0

    def push(arr):
        nonlocal off
        b = arr.tobytes(); pad = (-len(b)) % 4
        blobs.append(b + b'\0' * pad); s = off; off += len(b) + pad
        return s
    for p in parts:
        for v, f, nn, ao in chunks(p['v'], p['f'], p['n'], p['ao']):
            nn = nn / (np.linalg.norm(nn, axis=1, keepdims=True) + 1e-9)
            e = {'mat': p['mat'], 'wheel': p['wheel'], 'vcount': len(v), 'icount': int(f.size)}
            e['pos'] = push(np.asarray(v, np.float32))
            e['nor'] = push(np.round(nn * 127).astype(np.int8))
            e['idx'] = push(np.asarray(f, np.uint16).ravel())
            e['ao'] = push(np.asarray(ao, np.uint8))
            header['parts'].append(e)
    hj = json.dumps(header, separators=(',', ':')).encode()
    hj += b' ' * ((-len(hj)) % 4)
    data = len(hj).to_bytes(4, 'little') + hj + b''.join(blobs)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f've_{key}.gz.bin')
    with open(path, 'wb') as fo:
        fo.write(gzip.compress(data, 9, mtime=0))
    faces = sum(e['icount'] for e in header['parts'] if e['mat'] != 'shadow') // 3
    print(f'{path}: {faces} tris (+shadow), {len(data)} raw, {os.path.getsize(path)} gz, bounds {blo.round(2)} {bhi.round(2)}')


def main(path, only=None):
    for car in glb.load(path):
        if only and NODES[car['name']] not in only:
            continue
        build(car)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
