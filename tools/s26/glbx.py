"""GLB reader with full node transforms, UVs and embedded images (for the Supercars 26 bodies)."""
import json, struct
import numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def qmat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def local(n):
    M = np.eye(4)
    if 'matrix' in n:
        return np.array(n['matrix'], float).reshape(4, 4).T
    R = qmat(n.get('rotation', [0, 0, 0, 1]))
    S = np.diag(n.get('scale', [1, 1, 1]))
    M[:3, :3] = R @ S
    M[:3, 3] = n.get('translation', [0, 0, 0])
    return M


class GLB:
    def __init__(self, path):
        with open(path, 'rb') as f:
            magic, ver, length = struct.unpack('<III', f.read(12))
            l, t = struct.unpack('<II', f.read(8))
            self.j = json.loads(f.read(l))
            l2, t2 = struct.unpack('<II', f.read(8))
            self.bin = f.read(l2)

    def acc(self, i):
        j = self.j
        a = j['accessors'][i]
        bv = j['bufferViews'][a['bufferView']]
        n = NC[a['type']]
        dt = np.dtype(CT[a['componentType']])
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = bv.get('byteStride', 0)
        if stride and stride != dt.itemsize * n:
            raw = np.frombuffer(self.bin, np.uint8, count=stride * a['count'], offset=off).reshape(a['count'], stride)
            arr = raw[:, :dt.itemsize * n].copy().view(dt).reshape(a['count'], n)
        else:
            arr = np.frombuffer(self.bin, dt, count=a['count'] * n, offset=off).reshape(a['count'], n)
        if a.get('normalized'):
            arr = arr.astype(np.float32) / np.iinfo(dt).max
        return arr if n > 1 else arr.ravel()

    def image(self, idx):
        im = self.j['images'][idx]
        bv = self.j['bufferViews'][im['bufferView']]
        o = bv.get('byteOffset', 0)
        return self.bin[o:o + bv['byteLength']]

    def prims(self):
        """Yield every primitive with world-space positions/normals, uv, indices, material, node path."""
        j = self.j
        out = []
        scene = j['scenes'][j.get('scene', 0)]

        def walk(ni, M, path):
            n = j['nodes'][ni]
            W = M @ local(n)
            p2 = path + [n.get('name', str(ni))]
            if 'mesh' in n:
                m = j['meshes'][n['mesh']]
                for pi, p in enumerate(m['primitives']):
                    if p.get('mode', 4) != 4:
                        continue
                    pos = self.acc(p['attributes']['POSITION']).astype(np.float64)
                    pos = pos @ W[:3, :3].T + W[:3, 3]
                    nor = None
                    if 'NORMAL' in p['attributes']:
                        N = np.linalg.inv(W[:3, :3]).T
                        nor = self.acc(p['attributes']['NORMAL']).astype(np.float64) @ N.T
                        nor /= np.maximum(np.linalg.norm(nor, axis=1, keepdims=True), 1e-9)
                    uv = self.acc(p['attributes']['TEXCOORD_0']).astype(np.float64) if 'TEXCOORD_0' in p['attributes'] else None
                    idx = self.acc(p['indices']).astype(np.int64).reshape(-1, 3) if 'indices' in p else np.arange(len(pos)).reshape(-1, 3)
                    if np.linalg.det(W[:3, :3]) < 0:
                        idx = idx[:, ::-1]
                    mat = j['materials'][p['material']] if 'material' in p else {'name': 'none'}
                    out.append({'node': '/'.join(p2), 'name': n.get('name', ''), 'mat': mat.get('name', ''), 'matd': mat,
                                'pos': pos, 'nor': nor, 'uv': uv, 'idx': idx})
            for c in n.get('children', []):
                walk(c, W, p2)
        for r in scene['nodes']:
            walk(r, np.eye(4), [])
        return out
