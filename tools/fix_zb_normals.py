"""Clean up the ZB Commodore body in assets/models.json.gz.bin.

The supplied OBJ carried noisy normals (roof, rear glass, C-pillars): smooth panels
shaded as if they were folded and crumpled. Each corner now gets the angle-weighted
average of the faces that meet at that point and bend less than CREASE degrees from
its own face, so panels read smooth and real panel edges stay sharp.

The black glass frit (Windows_black) wove up to 6 mm in front of and behind the glass,
and its outline is ragged, so it showed as black shards along the top of the rear window
and the pillars. Frit triangles lying on the glass (all corners within 12 mm) are dropped;
the window seals and pillar trim in the same part stay.

Run once: python3 tools/fix_zb_normals.py   (idempotent; rows are tagged 'zbn').
"""
import base64, gzip, json, sys
from pathlib import Path
import numpy as np

CREASE = 40.0
ASSET = Path(__file__).resolve().parent.parent / 'assets' / 'models.json.gz.bin'
WHEEL = ('wheelrubber', 'wheelmetal', 'wheelmark', 'rotor', 'caliper')


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def fix(row):
    P = np.frombuffer(base64.b64decode(row['p']), np.int16).reshape(-1, 3)
    N0 = np.frombuffer(base64.b64decode(row['n']), np.int16).reshape(-1, 3).astype(np.float64)
    U = np.frombuffer(base64.b64decode(row['u']), np.uint16).reshape(-1, 2)
    I = np.frombuffer(base64.b64decode(row['i']), np.uint16 if row.get('i16') else np.uint32).reshape(-1, 3).astype(np.int64)
    X = P.astype(np.float64)
    a, b, c = X[I[:, 0]], X[I[:, 1]], X[I[:, 2]]
    fn = np.cross(b - a, c - a)
    ln = np.linalg.norm(fn, axis=1)
    ok = ln > 1e-9
    fn[ok] /= ln[ok, None]
    # Face winding in the OBJ is not consistent; point each face the way its supplied normals agree.
    fn[(fn * N0[I].sum(1)).sum(1) < 0] *= -1
    # Corner angles for angle weighting (fans of long slivers otherwise dominate).
    def ang(p, q, r):
        u, v = q - p, r - p
        nu, nv = np.linalg.norm(u, axis=1), np.linalg.norm(v, axis=1)
        return np.arccos(np.clip((u * v).sum(1) / np.maximum(nu * nv, 1e-12), -1, 1))
    A = np.stack([ang(a, b, c), ang(b, c, a), ang(c, a, b)], 1)
    A[~ok] = 0
    _, weld = np.unique(P, axis=0, return_inverse=True)
    weld = weld.reshape(-1)
    cw = weld[I].reshape(-1)              # welded position of each corner
    cf = np.repeat(np.arange(len(I)), 3)  # face of each corner
    ca = A.reshape(-1)
    order = np.argsort(cw, kind='stable')
    bounds = np.flatnonzero(np.diff(cw[order])) + 1
    cosT = np.cos(np.radians(CREASE))
    out = np.zeros((len(cw), 3))
    for g in np.split(order, bounds):
        F = fn[cf[g]]
        W = (F @ F.T > cosT) * ca[g][None, :]
        out[g] = W @ F
    nl = np.linalg.norm(out, axis=1)
    bad = nl < 1e-9
    orig = N0[I.reshape(-1)]
    out[~bad] /= nl[~bad, None]
    out[bad] = orig[bad] / np.maximum(np.linalg.norm(orig[bad], axis=1), 1e-9)[:, None]
    Nq = np.round(out * 32767).astype(np.int16)
    # One vertex per (source vertex, normal); corners that agree share it.
    key = np.concatenate([I.reshape(-1, 1), Nq.astype(np.int64)], 1)
    uk, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    src = uk[:, 0]
    i16 = len(uk) < 65536
    row['p'] = b64(P[src])
    row['u'] = b64(U[src])
    row['n'] = b64(uk[:, 1:].astype(np.int16))
    row['i'] = b64(inv.astype(np.uint16 if i16 else np.uint32))
    row['i16'] = i16
    row['vertices'] = int(len(uk))
    row['triangles'] = int(len(I))
    row['zbn'] = True


# The roof skin and the rear window are long slivers fanned from a dense patch at the back
# of the roof, so even good per-vertex normals streak into a sunburst under reflections.
# Those surfaces get their normals from a smooth quartic y = f(x, z) fitted to them.
FIT = {
    'Roof': lambda P, N: (N[:, 1] > .6) & (P[:, 1] > 1.2),
    'Windows': lambda P, N: (P[:, 2] < -1.3) & (np.abs(P[:, 0]) < .8) & (N[:, 1] > .45),
}


def terms(x, z):
    return np.stack([np.ones_like(x), x, z, x * x, x * z, z * z, x ** 3, x * x * z, x * z * z, z ** 3,
                     x ** 4, x ** 3 * z, x * x * z * z, x * z ** 3, z ** 4], 1)


def fit_normals(row, sel):
    P = np.frombuffer(base64.b64decode(row['p']), np.int16).reshape(-1, 3) / 1e4
    N = np.frombuffer(base64.b64decode(row['n']), np.int16).reshape(-1, 3) / 32767
    m = sel(P, N)
    if m.sum() < 30:
        return 0
    Q = P[m]
    A = terms(Q[:, 0], Q[:, 2])
    keep = np.ones(len(Q), bool)
    for _ in range(4):
        c, *_ = np.linalg.lstsq(A[keep], Q[keep, 1], rcond=None)
        res = np.abs(A @ c - Q[:, 1])
        keep = res < max(.002, 3 * np.median(res))
    x, z, h = P[:, 0], P[:, 2], 1e-4
    dx = (terms(x + h, z) @ c - terms(x - h, z) @ c) / (2 * h)
    dz = (terms(x, z + h) @ c - terms(x, z - h) @ c) / (2 * h)
    F = np.stack([-dx, np.ones_like(dx), -dz], 1)
    F /= np.linalg.norm(F, axis=1)[:, None]
    # Only vertices on the fitted skin, already facing roughly the same way (keeps real edges,
    # the antenna base and the roof camera as they are).
    on = m.copy()
    on[m] = np.abs(A @ c - Q[:, 1]) < .004
    on &= (F * N).sum(1) > .8
    N = N.copy()
    N[on] = F[on]
    row['n'] = b64(np.round(N * 32767).astype(np.int16))
    return int(on.sum())


def decode(row):
    P = np.frombuffer(base64.b64decode(row['p']), np.int16).reshape(-1, 3)
    I = np.frombuffer(base64.b64decode(row['i']), np.uint16 if row.get('i16') else np.uint32).reshape(-1, 3)
    return P, I


def drop_frit(level):
    rows = {r.get('source'): r for r in level}
    frit = rows.get('Windows_black')
    glass = [rows[k] for k in ('Windows', 'Window') if k in rows]
    if not frit or not glass:
        return 0
    tris = []
    for g in glass:
        P, I = decode(g)
        X = P / 1e4
        tris.append(X[I])
    T = np.concatenate(tris)
    T = T[np.linalg.norm(np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]), axis=1) > 1e-7]
    A, B, C = T[:, 0], T[:, 1], T[:, 2]
    N = np.cross(B - A, C - A)
    N /= np.linalg.norm(N, axis=1)[:, None] + 1e-12
    # Outward = away from a line through the middle of the cabin.
    cen = T.mean(1)
    mid = np.stack([np.zeros(len(cen)), np.full(len(cen), .75), np.clip(cen[:, 2], -1.0, .6)], 1)
    N[(N * (cen - mid)).sum(1) < 0] *= -1
    v0, v1 = B - A, C - A
    d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1)
    den = d00 * d11 - d01 * d01 + 1e-18
    P, I = decode(frit)
    X = P / 1e4
    on = np.zeros(len(X), bool)
    for k, p in enumerate(X):
        v2 = p - A
        d20, d21 = (v2 * v0).sum(1), (v2 * v1).sum(1)
        v = (d11 * d20 - d01 * d21) / den
        w = (d00 * d21 - d01 * d20) / den
        inside = (v > -.01) & (w > -.01) & (v + w < 1.01)
        sd = ((p - A) * N).sum(1)
        dist = np.abs(sd)
        dist[~inside] = np.inf
        j = int(np.argmin(dist))
        on[k] = dist[j] < .012
    keep = ~on[I].all(1)
    frit['i'] = b64(I[keep])
    frit['triangles'] = int(keep.sum())
    return int((~keep).sum())


def main():
    data = json.loads(gzip.decompress(ASSET.read_bytes()))
    n = 0
    for level in data['cars']['Holden']['levels']:
        if any(row.get('zbn') for row in level):
            continue
        print('frit triangles dropped from the glass:', drop_frit(level))
        for row in level:
            if row.get('zbn') or not row.get('q') or row['role'].startswith(WHEEL):
                continue
            fix(row)
            if row.get('source') in FIT:
                print('  smooth fit on', row['source'] + ':', fit_normals(row, FIT[row['source']]), 'vertices')
            n += 1
    ASSET.write_bytes(gzip.compress(json.dumps(data, separators=(',', ':')).encode(), 9, mtime=0))
    print('rebuilt normals on', n, 'ZB parts')


if __name__ == '__main__':
    sys.exit(main())
